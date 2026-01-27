from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import redis
import json
import uuid
from datetime import datetime, timezone
import os
import sys
import requests
import jwt
from jwt import InvalidTokenError, PyJWKClient

# Add parent directory to sys.path to import env
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))
try:
    from env import REDIS_PASSWORD
except Exception:
    REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")

# FastAPI app setup
app = FastAPI(title="Ballot Backend API", description="API for ballot petition signing")
security = HTTPBearer(auto_error=False)

# Redis setup - use ballot Redis instance
redis_host = os.environ.get('BALLOT_REDIS_HOST', 'ballot_redis')
redis_port = int(os.environ.get('BALLOT_REDIS_PORT', 6380))
redis_client = redis.Redis(host=redis_host, port=redis_port, db=0, password=REDIS_PASSWORD)

# PIdP + SpiceDB settings
pidp_base_url = os.environ.get('PIDP_BASE_URL', 'http://pidp:8000')
pidp_jwks_url = os.environ.get('PIDP_JWKS_URL', f"{pidp_base_url}/.well-known/jwks.json")
pidp_jwt_issuer = os.environ.get('PIDP_JWT_ISSUER')
pidp_jwt_audience = os.environ.get('PIDP_JWT_AUDIENCE')
spicedb_http_url = os.environ.get('SPICEDB_HTTP_URL', 'http://spicedb:8443')
spicedb_preshared_key = os.environ.get('SPICEDB_PRESHARED_KEY', 'dev-spicedb-key')
moderator_emails = [email.strip().lower() for email in os.environ.get("MODERATOR_EMAILS", "").split(",") if email.strip()]

SPICEDB_HEADERS = {
    "Authorization": f"Bearer {spicedb_preshared_key}",
    "X-Authzed-Token": spicedb_preshared_key,
    "Content-Type": "application/json",
}

_jwks_client = PyJWKClient(pidp_jwks_url)

_spicedb_schema_loaded = False

LEGISLATIVE_BODIES = [
    "US House of Representatives",
    "US Senate",
    "Maryland General Assembly",
    "Baltimore City Council",
    "DC Council",
    "Virginia General Assembly",
    "Pennsylvania General Assembly",
    "New York State Legislature",
    "California State Legislature",
    "Texas Legislature",
]

DEFAULT_LEGISLATIVE_BODY = "US House of Representatives"

SPICEDB_SCHEMA = """
definition user {}

definition initiative {
  relation owner: user
  relation collaborator: user

  permission manage = owner
  permission edit = owner + collaborator
  permission view = owner + collaborator
}

definition comment {
  relation author: user
  relation initiative: initiative

  permission manage = initiative->manage
  permission edit = author + initiative->manage
  permission delete = author + initiative->manage
  permission view = initiative->view
}
""".strip()

# Pydantic models
class PetitionSignRequest(BaseModel):
    initiative_id: str
    user_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    zip_code: Optional[str] = None
    signature_image: Optional[str] = None

class Initiative(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    required_signatures: int
    current_signatures: int
    progress_percentage: float
    upvote_count: int = 0
    downvote_count: int = 0
    icon: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    collaborators: Optional[List[str]] = None
    created_by: Optional[str] = None

class InitiativeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    required_signatures: int = 25000
    icon: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    collaborators: Optional[List[str]] = None

class VoteRequest(BaseModel):
    vote: str

class InitiativeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_signatures: Optional[int] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None

class CollaboratorUpdate(BaseModel):
    collaborators: List[str]

class EditRequestCreate(BaseModel):
    message: Optional[str] = None

class CommentCreate(BaseModel):
    body: str

class CommentUpdate(BaseModel):
    body: str

def _normalize_legislative_body(value: Optional[str]) -> str:
    if value and value in LEGISLATIVE_BODIES:
        return value
    return DEFAULT_LEGISLATIVE_BODY

def _validate_legislative_body(value: Optional[str]) -> None:
    if value is None:
        return
    if value not in LEGISLATIVE_BODIES:
        raise HTTPException(status_code=400, detail="Invalid legislative body")

def _is_moderator(email: Optional[str]) -> bool:
    if not email:
        return False
    return email.lower() in moderator_emails

def _admin_guard(current_user: dict) -> None:
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not _is_moderator(current_user.get("email")):
        raise HTTPException(status_code=403, detail="Not authorized")

# Helper functions for Redis keys
def get_initiative_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}"

def get_signatures_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}:signatures"

def get_user_signatures_key(user_id: str) -> str:
    return f"ballot:user:{user_id}:signatures"

def get_user_signature_key(initiative_id: str, user_id: str) -> str:
    return f"ballot:initiative:{initiative_id}:signature:{user_id}"

def _find_signature_id(initiative_id: str, user_id: str) -> Optional[str]:
    for key in redis_client.scan_iter(match="ballot:signature:*"):
        data = redis_client.hgetall(key)
        if not data:
            continue
        try:
            init_id = data.get(b"initiative_id", b"").decode()
            uid = data.get(b"user_id", b"").decode()
        except Exception:
            continue
        if init_id == initiative_id and uid == user_id:
            return key.decode().split("ballot:signature:")[-1]
    return None
def get_all_initiatives_key() -> str:
    return "ballot:initiatives:all"

def get_edit_requests_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}:edit-requests"

def get_comments_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}:comments"

def get_votes_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}:votes"

def _initiative_relations_to_delete(initiative_id: str, owner_id: str | None, collaborators: List[str]) -> List[Dict[str, Any]]:
    updates: List[Dict[str, Any]] = []
    if owner_id:
        updates.append(
            {
                "operation": "OPERATION_DELETE",
                "relationship": {
                    "resource": {"objectType": "initiative", "objectId": initiative_id},
                    "relation": "owner",
                    "subject": {"object": {"objectType": "user", "objectId": owner_id}},
                },
            }
        )
    for collaborator_id in collaborators:
        updates.append(
            {
                "operation": "OPERATION_DELETE",
                "relationship": {
                    "resource": {"objectType": "initiative", "objectId": initiative_id},
                    "relation": "collaborator",
                    "subject": {"object": {"objectType": "user", "objectId": collaborator_id}},
                },
            }
        )
    return updates

def _verify_token(token: str) -> Dict[str, Any]:
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=pidp_jwt_issuer,
            audience=pidp_jwt_audience,
            options={"verify_aud": bool(pidp_jwt_audience)},
        )
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def _spicedb_write_relationships(updates: List[Dict[str, Any]]) -> None:
    resp = requests.post(
        f"{spicedb_http_url}/v1/relationships/write",
        headers=SPICEDB_HEADERS,
        json={"updates": updates},
        timeout=2,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to update access control")

def _spicedb_write_schema() -> None:
    resp = requests.post(
        f"{spicedb_http_url}/v1/schema/write",
        headers=SPICEDB_HEADERS,
        json={"schema": SPICEDB_SCHEMA},
        timeout=2,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Failed to load access schema: {resp.status_code} {resp.text}")

def _ensure_spicedb_schema_loaded() -> None:
    global _spicedb_schema_loaded
    if _spicedb_schema_loaded:
        return
    try:
        _spicedb_write_schema()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"SpiceDB unavailable: {exc}")
    _spicedb_schema_loaded = True

def _spicedb_check_permission(initiative_id: str, permission: str, user_id: str) -> bool:
    resp = requests.post(
        f"{spicedb_http_url}/v1/permissions/check",
        headers=SPICEDB_HEADERS,
        json={
            "resource": {"objectType": "initiative", "objectId": initiative_id},
            "permission": permission,
            "subject": {"object": {"objectType": "user", "objectId": user_id}},
        },
        timeout=2,
    )
    if resp.status_code != 200:
        return False
    data = resp.json()
    return data.get("permissionship") == "PERMISSIONSHIP_HAS_PERMISSION"

def _spicedb_check_comment_permission(comment_id: str, permission: str, user_id: str) -> bool:
    resp = requests.post(
        f"{spicedb_http_url}/v1/permissions/check",
        headers=SPICEDB_HEADERS,
        json={
            "resource": {"objectType": "comment", "objectId": comment_id},
            "permission": permission,
            "subject": {"object": {"objectType": "user", "objectId": user_id}},
        },
        timeout=2,
    )
    if resp.status_code != 200:
        return False
    data = resp.json()
    return data.get("permissionship") == "PERMISSIONSHIP_HAS_PERMISSION"

def _pidp_lookup_users_by_email(token: str, email: str) -> List[Dict[str, Any]]:
    resp = requests.get(
        f"{pidp_base_url}/auth/users",
        params={"email": email},
        headers={"Authorization": f"Bearer {token}"},
        timeout=5,
    )
    if resp.status_code != 200:
        return []
    return resp.json()

def _resolve_collaborator_ids(collaborators: List[str], token: str) -> List[str]:
    resolved: List[str] = []
    for entry in collaborators:
        entry = entry.strip()
        if not entry:
            continue
        if "@" in entry:
            matches = _pidp_lookup_users_by_email(token, entry)
            if not matches:
                raise HTTPException(status_code=400, detail=f"No user found for {entry}")
            resolved.append(matches[0]["id"])
        else:
            resolved.append(entry)
    return resolved

def _comment_key(comment_id: str) -> str:
    return f"ballot:comment:{comment_id}"

def _comment_list(initiative_id: str) -> List[Dict[str, Any]]:
    comment_ids = redis_client.lrange(get_comments_key(initiative_id), 0, -1)
    comments = []
    for comment_id in comment_ids:
        key = _comment_key(comment_id.decode() if isinstance(comment_id, bytes) else str(comment_id))
        data = redis_client.hgetall(key)
        if not data:
            continue
        item = {k.decode(): v.decode() for k, v in data.items()}
        comments.append(item)
    return comments

def _dedupe_signatures_for_initiative(initiative_id: str) -> Dict[str, int]:
    signature_ids = []
    for key in redis_client.scan_iter(match="ballot:signature:*"):
        data = redis_client.hgetall(key)
        if not data:
            continue
        try:
            init_id = data.get(b"initiative_id", b"").decode()
        except Exception:
            continue
        if init_id == initiative_id:
            signature_ids.append(key.decode().split("ballot:signature:")[-1])

    signatures_by_user: Dict[str, List[Dict[str, str]]] = {}
    removed = 0
    for sig_id in signature_ids:
        data = redis_client.hgetall(f"ballot:signature:{sig_id}")
        if not data:
            continue
        decoded = {k.decode(): v.decode() for k, v in data.items()}
        user_id = decoded.get("user_id")
        if not user_id:
            continue
        if user_id.startswith("anonymous-"):
            redis_client.delete(f"ballot:signature:{sig_id}")
            removed += 1
            continue
        signatures_by_user.setdefault(user_id, []).append(decoded)

    kept = 0
    signatures_key = get_signatures_key(initiative_id)
    redis_client.delete(signatures_key)

    for user_id, signatures in signatures_by_user.items():
        signatures.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
        keep = signatures[0]
        keep_id = keep.get("id")
        if not keep_id:
            continue
        redis_client.sadd(signatures_key, user_id)
        redis_client.set(get_user_signature_key(initiative_id, user_id), keep_id)
        kept += 1
        for duplicate in signatures[1:]:
            dup_id = duplicate.get("id")
            if dup_id:
                redis_client.delete(f"ballot:signature:{dup_id}")
                removed += 1

    redis_client.hset(get_initiative_key(initiative_id), mapping={"current_signatures": kept})
    required = int(redis_client.hget(get_initiative_key(initiative_id), "required_signatures") or 25000)
    progress = (kept / required * 100) if required > 0 else 0
    redis_client.hset(get_initiative_key(initiative_id), "progress_percentage", f"{progress:.1f}")
    return {"kept": kept, "removed": removed}

# Authentication (validate via PIdP)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return {"id": f"anonymous-{uuid.uuid4()}", "is_anonymous": True}
    token = credentials.credentials
    claims = _verify_token(token)
    return {
        "id": claims.get("sub"),
        "email": claims.get("email"),
        "token": token,
    }

# Initialize some sample data if not exists
@app.on_event("startup")
async def startup_event():
    try:
        _ensure_spicedb_schema_loaded()
    except Exception as exc:
        print(f"SpiceDB schema load failed: {exc}")
    # Create sample initiatives if they don't exist
    sample_initiatives = [
        {
            "id": "parks-bond",
            "title": "Local Parks & Rec Bond: Your City Initiative",
            "description": "Funding for local parks and recreation facilities",
            "required_signatures": 25000,
            "current_signatures": 12400,
            "progress_percentage": 49.6,
            "upvote_count": 120,
            "downvote_count": 14,
            "icon": "park",
            "category": "Environment",
            "location": "US House of Representatives"
        },
        {
            "id": "education-funding",
            "title": "Public Education Funding Initiative",
            "description": "Increased funding for public schools",
            "required_signatures": 25000,
            "current_signatures": 18000,
            "progress_percentage": 72.0,
            "upvote_count": 240,
            "downvote_count": 22,
            "icon": "education",
            "category": "Education",
            "location": "US House of Representatives"
        },
        {
            "id": "clean-energy",
            "title": "Clean Energy for All Act",
            "description": "Transition to renewable energy sources",
            "required_signatures": 25000,
            "current_signatures": 22000,
            "progress_percentage": 88.0,
            "upvote_count": 410,
            "downvote_count": 38,
            "icon": "energy",
            "category": "Environment",
            "location": "US House of Representatives"
        }
    ]
    
    for initiative in sample_initiatives:
        initiative_key = get_initiative_key(initiative["id"])
        if not redis_client.exists(initiative_key):
            redis_client.hset(initiative_key, mapping=initiative)
            # Add to all initiatives set
            redis_client.sadd(get_all_initiatives_key(), initiative["id"])

# API Endpoints
@app.get("/api/ballot/initiatives", response_model=List[Initiative])
async def get_initiatives():
    """Get all initiatives"""
    initiative_ids = redis_client.smembers(get_all_initiatives_key())
    initiatives = []
    
    for initiative_id_bytes in initiative_ids:
        initiative_id = initiative_id_bytes.decode()
        initiative_key = get_initiative_key(initiative_id)
        initiative_data = redis_client.hgetall(initiative_key)
        
        if initiative_data:
            # Convert bytes to strings and appropriate types
            initiative_dict = {k.decode(): v.decode() for k, v in initiative_data.items()}
            # Convert numeric fields
            initiative_dict["required_signatures"] = int(initiative_dict.get("required_signatures", 0))
            initiative_dict["current_signatures"] = int(initiative_dict.get("current_signatures", 0))
            initiative_dict["progress_percentage"] = float(initiative_dict.get("progress_percentage", 0))
            initiative_dict["upvote_count"] = int(initiative_dict.get("upvote_count", 0))
            initiative_dict["downvote_count"] = int(initiative_dict.get("downvote_count", 0))
            
            if "collaborators" in initiative_dict:
                try:
                    initiative_dict["collaborators"] = json.loads(initiative_dict["collaborators"])
                except Exception:
                    initiative_dict["collaborators"] = []

            initiatives.append(Initiative(**initiative_dict))
    
    return initiatives

@app.get("/api/ballot/initiatives/{initiative_id}", response_model=Initiative)
async def get_initiative(initiative_id: str):
    """Get a specific initiative by ID"""
    initiative_key = get_initiative_key(initiative_id)
    initiative_data = redis_client.hgetall(initiative_key)
    
    if not initiative_data:
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    initiative_dict = {k.decode(): v.decode() for k, v in initiative_data.items()}
    initiative_dict["required_signatures"] = int(initiative_dict.get("required_signatures", 0))
    initiative_dict["current_signatures"] = int(initiative_dict.get("current_signatures", 0))
    initiative_dict["progress_percentage"] = float(initiative_dict.get("progress_percentage", 0))
    initiative_dict["upvote_count"] = int(initiative_dict.get("upvote_count", 0))
    initiative_dict["downvote_count"] = int(initiative_dict.get("downvote_count", 0))
    if "collaborators" in initiative_dict:
        try:
            initiative_dict["collaborators"] = json.loads(initiative_dict["collaborators"])
        except Exception:
            initiative_dict["collaborators"] = []
    
    return Initiative(**initiative_dict)

@app.put("/api/ballot/initiatives/{initiative_id}", response_model=Initiative)
async def update_initiative(
    initiative_id: str,
    update: InitiativeUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not _spicedb_check_permission(initiative_id, "edit", current_user.get("id")):
        raise HTTPException(status_code=403, detail="Not allowed to edit initiative")

    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")

    updates = {k: v for k, v in update.model_dump(exclude_unset=True).items()}
    if "location" in updates:
        _validate_legislative_body(updates.get("location"))
    if updates:
        redis_client.hset(initiative_key, mapping=updates)

    initiative_data = redis_client.hgetall(initiative_key)
    initiative_dict = {k.decode(): v.decode() for k, v in initiative_data.items()}
    initiative_dict["required_signatures"] = int(initiative_dict.get("required_signatures", 0))
    initiative_dict["current_signatures"] = int(initiative_dict.get("current_signatures", 0))
    initiative_dict["progress_percentage"] = float(initiative_dict.get("progress_percentage", 0))
    if "collaborators" in initiative_dict:
        try:
            initiative_dict["collaborators"] = json.loads(initiative_dict["collaborators"])
        except Exception:
            initiative_dict["collaborators"] = []
    return Initiative(**initiative_dict)

@app.delete("/api/ballot/initiatives/{initiative_id}")
async def delete_initiative(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not _is_moderator(current_user.get("email")) and not _spicedb_check_permission(initiative_id, "manage", current_user.get("id")):
        raise HTTPException(status_code=403, detail="Not allowed to delete initiative")

    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")

    data = redis_client.hgetall(initiative_key)
    initiative_dict = {k.decode(): v.decode() for k, v in data.items()}
    collaborators: List[str] = []
    if "collaborators" in initiative_dict:
        try:
            collaborators = json.loads(initiative_dict["collaborators"])
        except Exception:
            collaborators = []

    try:
        _ensure_spicedb_schema_loaded()
        updates = _initiative_relations_to_delete(initiative_id, initiative_dict.get("created_by"), collaborators)
        if updates:
            _spicedb_write_relationships(updates)
    except Exception:
        pass

    # Remove initiative data
    redis_client.delete(initiative_key)
    redis_client.srem(get_all_initiatives_key(), initiative_id)

    # Remove related comments
    for comment_id in redis_client.lrange(get_comments_key(initiative_id), 0, -1):
        comment_id_str = comment_id.decode() if isinstance(comment_id, bytes) else str(comment_id)
        redis_client.delete(_comment_key(comment_id_str))
    redis_client.delete(get_comments_key(initiative_id))

    # Remove signature sets for this initiative
    redis_client.delete(get_signatures_key(initiative_id))
    redis_client.delete(get_votes_key(initiative_id))

    return {"message": "Initiative deleted"}

@app.post("/api/ballot/initiatives/{initiative_id}/vote")
async def vote_on_initiative(
    initiative_id: str,
    payload: VoteRequest,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    vote = payload.vote.lower()
    if vote not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Vote must be 'up' or 'down'")

    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")

    votes_key = get_votes_key(initiative_id)
    user_id = current_user.get("id")
    prev_vote = redis_client.hget(votes_key, user_id)
    prev_vote_str = prev_vote.decode() if isinstance(prev_vote, bytes) else prev_vote

    if prev_vote_str == vote:
        redis_client.hdel(votes_key, user_id)
        redis_client.hincrby(initiative_key, f"{vote}vote_count", -1)
        return {"vote": None}

    if prev_vote_str in ("up", "down"):
        redis_client.hincrby(initiative_key, f"{prev_vote_str}vote_count", -1)

    redis_client.hset(votes_key, user_id, vote)
    redis_client.hincrby(initiative_key, f"{vote}vote_count", 1)
    return {"vote": vote}

@app.get("/api/ballot/initiatives/{initiative_id}/vote")
async def get_my_vote(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    votes_key = get_votes_key(initiative_id)
    user_id = current_user.get("id")
    value = redis_client.hget(votes_key, user_id)
    if not value:
        return {"vote": None}
    vote = value.decode() if isinstance(value, bytes) else value
    return {"vote": vote}

@app.post("/api/ballot/initiatives/{initiative_id}/sign")
async def sign_petition(
    initiative_id: str,
    sign_request: PetitionSignRequest,
    current_user: dict = Depends(get_current_user)
):
    """Sign a petition for an initiative"""
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = current_user.get("id")
    
    # Check if initiative exists
    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    # Check if user already signed this initiative
    signatures_key = get_signatures_key(initiative_id)
    user_signatures_key = get_user_signatures_key(user_id)
    
    if redis_client.sismember(signatures_key, user_id):
        signature_id = redis_client.get(get_user_signature_key(initiative_id, user_id))
        if not signature_id:
            recovered_id = _find_signature_id(initiative_id, user_id)
            if recovered_id:
                redis_client.set(get_user_signature_key(initiative_id, user_id), recovered_id)
            else:
                redis_client.srem(signatures_key, user_id)
        if redis_client.sismember(signatures_key, user_id):
            raise HTTPException(status_code=400, detail="User already signed this petition")
    
    # Record the signature
    signature_id = str(uuid.uuid4())
    signature_data = {
        "id": signature_id,
        "initiative_id": initiative_id,
        "user_id": user_id,
        "name": sign_request.name,
        "email": sign_request.email,
        "zip_code": sign_request.zip_code,
        "signature_image": sign_request.signature_image,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    signature_data = {key: value for key, value in signature_data.items() if value is not None}
    
    # Store signature in multiple places
    redis_client.sadd(signatures_key, user_id)
    redis_client.sadd(user_signatures_key, initiative_id)
    
    # Store signature details
    signature_key = f"ballot:signature:{signature_id}"
    redis_client.hset(signature_key, mapping=signature_data)
    redis_client.set(get_user_signature_key(initiative_id, user_id), signature_id)
    
    # Update initiative signature count
    redis_client.hincrby(initiative_key, "current_signatures", 1)
    
    # Recalculate progress percentage
    initiative_data = redis_client.hgetall(initiative_key)
    current = int(initiative_data.get(b"current_signatures", b"0"))
    required = int(initiative_data.get(b"required_signatures", b"25000"))
    progress = (current / required * 100) if required > 0 else 0
    redis_client.hset(initiative_key, "progress_percentage", f"{progress:.1f}")
    
    return {
        "message": "Petition signed successfully",
        "signature_id": signature_id,
        "current_signatures": current + 1,
        "progress_percentage": progress
    }

@app.get("/api/ballot/initiatives/{initiative_id}/signatures/me")
async def get_my_signature(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = current_user.get("id")
    signature_id = redis_client.get(get_user_signature_key(initiative_id, user_id))
    if not signature_id:
        recovered_id = _find_signature_id(initiative_id, user_id)
        if recovered_id:
            redis_client.set(get_user_signature_key(initiative_id, user_id), recovered_id)
            signature_id = recovered_id
        else:
            raise HTTPException(status_code=404, detail="Signature not found")
    signature_key = f"ballot:signature:{signature_id.decode() if isinstance(signature_id, bytes) else signature_id}"
    signature_data = redis_client.hgetall(signature_key)
    if not signature_data:
        raise HTTPException(status_code=404, detail="Signature not found")
    decoded = {k.decode(): v.decode() for k, v in signature_data.items()}
    return decoded

@app.delete("/api/ballot/initiatives/{initiative_id}/signatures/me")
async def delete_my_signature(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = current_user.get("id")
    signature_id = redis_client.get(get_user_signature_key(initiative_id, user_id))
    if not signature_id:
        recovered_id = _find_signature_id(initiative_id, user_id)
        if recovered_id:
            redis_client.set(get_user_signature_key(initiative_id, user_id), recovered_id)
            signature_id = recovered_id
        else:
            raise HTTPException(status_code=404, detail="Signature not found")
    signature_id_str = signature_id.decode() if isinstance(signature_id, bytes) else str(signature_id)

    signatures_key = get_signatures_key(initiative_id)
    user_signatures_key = get_user_signatures_key(user_id)
    signature_key = f"ballot:signature:{signature_id_str}"

    redis_client.srem(signatures_key, user_id)
    redis_client.srem(user_signatures_key, initiative_id)
    redis_client.delete(signature_key)
    redis_client.delete(get_user_signature_key(initiative_id, user_id))

    initiative_key = get_initiative_key(initiative_id)
    if redis_client.exists(initiative_key):
        current = int(redis_client.hget(initiative_key, "current_signatures") or 0)
        new_current = max(current - 1, 0)
        redis_client.hset(initiative_key, "current_signatures", new_current)
        required = int(redis_client.hget(initiative_key, "required_signatures") or 25000)
        progress = (new_current / required * 100) if required > 0 else 0
        redis_client.hset(initiative_key, "progress_percentage", f"{progress:.1f}")

    return {"message": "Signature removed"}

@app.get("/api/ballot/user/signatures")
async def get_user_signatures(current_user: dict = Depends(get_current_user)):
    """Get all initiatives signed by the current user"""
    user_id = current_user.get("id")
    user_signatures_key = get_user_signatures_key(user_id)
    
    initiative_ids = redis_client.smembers(user_signatures_key)
    signed_initiatives = []
    
    for initiative_id_bytes in initiative_ids:
        initiative_id = initiative_id_bytes.decode()
        initiative = await get_initiative(initiative_id)
        signed_initiatives.append(initiative)
    
    return {"signed_initiatives": signed_initiatives}

@app.post("/api/ballot/initiatives", response_model=Initiative)
async def create_initiative(
    initiative: InitiativeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new initiative (admin function)"""
    # In production, check if user has admin privileges
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    _validate_legislative_body(initiative.location)
    initiative_id = str(uuid.uuid4())[:8]
    
    new_initiative = {
        "id": initiative_id,
        "title": initiative.title,
        "description": initiative.description or "",
        "required_signatures": initiative.required_signatures,
        "current_signatures": 0,
        "progress_percentage": 0.0,
        "icon": initiative.icon or "default",
        "category": initiative.category or "General",
        "location": initiative.location or DEFAULT_LEGISLATIVE_BODY,
        "upvote_count": 0,
        "downvote_count": 0,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    _ensure_spicedb_schema_loaded()
    collaborators = initiative.collaborators or []
    collaborators = _resolve_collaborator_ids(collaborators, current_user["token"])
    new_initiative["collaborators"] = json.dumps(collaborators)
    
    initiative_key = get_initiative_key(initiative_id)
    redis_client.hset(initiative_key, mapping=new_initiative)
    redis_client.sadd(get_all_initiatives_key(), initiative_id)

    # Write access control relationships
    updates = [
        {
            "operation": "OPERATION_TOUCH",
            "relationship": {
                "resource": {"objectType": "initiative", "objectId": initiative_id},
                "relation": "owner",
                "subject": {"object": {"objectType": "user", "objectId": current_user.get("id")}},
            },
        }
    ]
    for collaborator_id in collaborators:
        updates.append(
            {
                "operation": "OPERATION_TOUCH",
                "relationship": {
                    "resource": {"objectType": "initiative", "objectId": initiative_id},
                    "relation": "collaborator",
                    "subject": {"object": {"objectType": "user", "objectId": collaborator_id}},
                },
            }
        )
    if updates:
        _spicedb_write_relationships(updates)
    
    response_data = dict(new_initiative)
    response_data["collaborators"] = collaborators
    return Initiative(**response_data)

@app.put("/api/ballot/initiatives/{initiative_id}/collaborators")
async def update_initiative_collaborators(
    initiative_id: str,
    payload: CollaboratorUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Replace initiative collaborators (owner only)."""
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")

    user_id = current_user.get("id")
    if not _spicedb_check_permission(initiative_id, "manage", user_id):
        raise HTTPException(status_code=403, detail="Not allowed to manage collaborators")

    _ensure_spicedb_schema_loaded()
    collaborators = _resolve_collaborator_ids(payload.collaborators, current_user["token"])
    redis_client.hset(initiative_key, mapping={"collaborators": json.dumps(collaborators)})

    updates = []
    # Touch owner again to keep it present.
    updates.append(
        {
            "operation": "OPERATION_TOUCH",
            "relationship": {
                "resource": {"objectType": "initiative", "objectId": initiative_id},
                "relation": "owner",
                "subject": {"object": {"objectType": "user", "objectId": user_id}},
            },
        }
    )
    for collaborator_id in collaborators:
        updates.append(
            {
                "operation": "OPERATION_TOUCH",
                "relationship": {
                    "resource": {"objectType": "initiative", "objectId": initiative_id},
                    "relation": "collaborator",
                    "subject": {"object": {"objectType": "user", "objectId": collaborator_id}},
                },
            }
        )
    _spicedb_write_relationships(updates)

    return {"ok": True, "collaborators": collaborators}

@app.get("/api/ballot/initiatives/{initiative_id}/permissions")
async def get_initiative_permissions(
    initiative_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    user_id = current_user.get("id")
    return {
        "can_edit": _spicedb_check_permission(initiative_id, "edit", user_id),
        "can_manage": _spicedb_check_permission(initiative_id, "manage", user_id),
    }

@app.get("/api/ballot/initiatives/editable-list")
async def get_editable_initiatives_list(current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    initiative_ids = redis_client.smembers(get_all_initiatives_key())
    editable = []
    for initiative_id_bytes in initiative_ids:
        initiative_id = initiative_id_bytes.decode()
        if not _spicedb_check_permission(initiative_id, "edit", current_user.get("id")):
            continue
        initiative_key = get_initiative_key(initiative_id)
        initiative_data = redis_client.hgetall(initiative_key)
        if not initiative_data:
            continue
        initiative_dict = {k.decode(): v.decode() for k, v in initiative_data.items()}
        initiative_dict["required_signatures"] = int(initiative_dict.get("required_signatures", 0))
        initiative_dict["current_signatures"] = int(initiative_dict.get("current_signatures", 0))
        initiative_dict["progress_percentage"] = float(initiative_dict.get("progress_percentage", 0))
        initiative_dict["upvote_count"] = int(initiative_dict.get("upvote_count", 0))
        initiative_dict["downvote_count"] = int(initiative_dict.get("downvote_count", 0))
        if "collaborators" in initiative_dict:
            try:
                initiative_dict["collaborators"] = json.loads(initiative_dict["collaborators"])
            except Exception:
                initiative_dict["collaborators"] = []
        editable.append(initiative_dict)
    return editable

@app.get("/api/ballot/initiatives/editable")
async def get_editable_initiatives(current_user: dict = Depends(get_current_user)):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    initiative_ids = redis_client.smembers(get_all_initiatives_key())
    editable = []
    for initiative_id_bytes in initiative_ids:
        initiative_id = initiative_id_bytes.decode()
        if not _spicedb_check_permission(initiative_id, "edit", current_user.get("id")):
            continue
        initiative_key = get_initiative_key(initiative_id)
        initiative_data = redis_client.hgetall(initiative_key)
        if not initiative_data:
            continue
        initiative_dict = {k.decode(): v.decode() for k, v in initiative_data.items()}
        initiative_dict["required_signatures"] = int(initiative_dict.get("required_signatures", 0))
        initiative_dict["current_signatures"] = int(initiative_dict.get("current_signatures", 0))
        initiative_dict["progress_percentage"] = float(initiative_dict.get("progress_percentage", 0))
        initiative_dict["upvote_count"] = int(initiative_dict.get("upvote_count", 0))
        initiative_dict["downvote_count"] = int(initiative_dict.get("downvote_count", 0))
        if "collaborators" in initiative_dict:
            try:
                initiative_dict["collaborators"] = json.loads(initiative_dict["collaborators"])
            except Exception:
                initiative_dict["collaborators"] = []
        editable.append(initiative_dict)
    return editable

@app.get("/api/ballot/initiatives/{initiative_id}/comments")
async def list_comments(initiative_id: str):
    if not redis_client.exists(get_initiative_key(initiative_id)):
        raise HTTPException(status_code=404, detail="Initiative not found")
    return _comment_list(initiative_id)

@app.get("/api/ballot/admin/me")
async def admin_me(current_user: dict = Depends(get_current_user)):
    return {"is_admin": _is_moderator(current_user.get("email"))}

@app.post("/api/ballot/admin/dedupe-signatures")
async def admin_dedupe_signatures(current_user: dict = Depends(get_current_user)):
    _admin_guard(current_user)
    initiative_ids = redis_client.smembers(get_all_initiatives_key())
    totals = {"kept": 0, "removed": 0}
    for initiative_id_bytes in initiative_ids:
        initiative_id = initiative_id_bytes.decode()
        result = _dedupe_signatures_for_initiative(initiative_id)
        totals["kept"] += result.get("kept", 0)
        totals["removed"] += result.get("removed", 0)
    return totals

@app.post("/api/ballot/initiatives/{initiative_id}/comments")
async def create_comment(
    initiative_id: str,
    payload: CommentCreate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not redis_client.exists(get_initiative_key(initiative_id)):
        raise HTTPException(status_code=404, detail="Initiative not found")
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body required")

    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    author_name = current_user.get("email") or current_user.get("id")
    data = {
        "id": comment_id,
        "initiative_id": initiative_id,
        "author_id": current_user.get("id"),
        "author_name": author_name,
        "body": body,
        "created_at": now,
        "updated_at": now,
    }

    _ensure_spicedb_schema_loaded()
    updates = [
        {
            "operation": "OPERATION_TOUCH",
            "relationship": {
                "resource": {"objectType": "comment", "objectId": comment_id},
                "relation": "author",
                "subject": {"object": {"objectType": "user", "objectId": current_user.get("id")}},
            },
        },
        {
            "operation": "OPERATION_TOUCH",
            "relationship": {
                "resource": {"objectType": "comment", "objectId": comment_id},
                "relation": "initiative",
                "subject": {"object": {"objectType": "initiative", "objectId": initiative_id}},
            },
        },
    ]
    _spicedb_write_relationships(updates)

    redis_client.hset(_comment_key(comment_id), mapping=data)
    redis_client.rpush(get_comments_key(initiative_id), comment_id)
    return data

@app.put("/api/ballot/initiatives/{initiative_id}/comments/{comment_id}")
async def update_comment(
    initiative_id: str,
    comment_id: str,
    payload: CommentUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not _spicedb_check_comment_permission(comment_id, "edit", current_user.get("id")):
        raise HTTPException(status_code=403, detail="Not allowed to edit comment")
    key = _comment_key(comment_id)
    if not redis_client.exists(key):
        raise HTTPException(status_code=404, detail="Comment not found")
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment body required")
    redis_client.hset(key, mapping={"body": body, "updated_at": datetime.now(timezone.utc).isoformat()})
    data = redis_client.hgetall(key)
    return {k.decode(): v.decode() for k, v in data.items()}

@app.delete("/api/ballot/initiatives/{initiative_id}/comments/{comment_id}")
async def delete_comment(
    initiative_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    if not _spicedb_check_comment_permission(comment_id, "delete", current_user.get("id")):
        raise HTTPException(status_code=403, detail="Not allowed to delete comment")
    key = _comment_key(comment_id)
    if not redis_client.exists(key):
        raise HTTPException(status_code=404, detail="Comment not found")
    try:
        _spicedb_write_relationships(
            [
                {
                    "operation": "OPERATION_DELETE",
                    "relationship": {
                        "resource": {"objectType": "comment", "objectId": comment_id},
                        "relation": "author",
                        "subject": {"object": {"objectType": "user", "objectId": current_user.get("id")}},
                    },
                },
                {
                    "operation": "OPERATION_DELETE",
                    "relationship": {
                        "resource": {"objectType": "comment", "objectId": comment_id},
                        "relation": "initiative",
                        "subject": {"object": {"objectType": "initiative", "objectId": initiative_id}},
                    },
                },
            ]
        )
    except Exception:
        pass
    redis_client.delete(key)
    redis_client.lrem(get_comments_key(initiative_id), 0, comment_id)
    return {"message": "Comment deleted"}

@app.post("/api/ballot/initiatives/{initiative_id}/edit-requests")
async def request_initiative_edit(
    initiative_id: str,
    payload: EditRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("is_anonymous"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")

    request_id = str(uuid.uuid4())
    request_data = {
        "id": request_id,
        "initiative_id": initiative_id,
        "user_id": current_user.get("id"),
        "message": payload.message or "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    redis_client.hset(f"ballot:edit-request:{request_id}", mapping=request_data)
    redis_client.sadd(get_edit_requests_key(initiative_id), request_id)
    return {"ok": True, "request_id": request_id}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Redis connection
        redis_client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redis connection failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_dirs=[os.path.dirname(__file__)],
    )
