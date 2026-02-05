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

# Add parent directory to sys.path to import env
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))
from env import REDIS_PASSWORD

# FastAPI app setup
app = FastAPI(title="Ballot Backend API", description="API for ballot petition signing")
security = HTTPBearer()

# Redis setup - use ballot Redis instance
redis_host = os.environ.get('BALLOT_REDIS_HOST', 'ballot_redis')
redis_port = int(os.environ.get('BALLOT_REDIS_PORT', 6380))
redis_client = redis.Redis(host=redis_host, port=redis_port, db=0, password=REDIS_PASSWORD)

# Pydantic models
class PetitionSignRequest(BaseModel):
    initiative_id: str
    user_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    zip_code: Optional[str] = None

class Initiative(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    required_signatures: int
    current_signatures: int
    progress_percentage: float
    icon: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None

class InitiativeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    required_signatures: int = 25000
    icon: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None

# Helper functions for Redis keys
def get_initiative_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}"

def get_signatures_key(initiative_id: str) -> str:
    return f"ballot:initiative:{initiative_id}:signatures"

def get_user_signatures_key(user_id: str) -> str:
    return f"ballot:user:{user_id}:signatures"

def get_all_initiatives_key() -> str:
    return "ballot:initiatives:all"

# Authentication (simplified - in production use proper JWT validation)
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # For now, we'll accept any token and extract user_id from it
    # In a real implementation, validate JWT with Keycloak
    token = credentials.credentials
    # Simplified: assume token contains user_id after "user-"
    if token.startswith("user-"):
        return {"sub": token}
    else:
        # For demo purposes, create a mock user
        return {"sub": f"user-{token}"}

# Initialize some sample data if not exists
@app.on_event("startup")
async def startup_event():
    # Create sample initiatives if they don't exist
    sample_initiatives = [
        {
            "id": "parks-bond",
            "title": "Local Parks & Rec Bond: Your City Initiative",
            "description": "Funding for local parks and recreation facilities",
            "required_signatures": 25000,
            "current_signatures": 12400,
            "progress_percentage": 49.6,
            "icon": "park",
            "category": "Environment",
            "location": "[City, State]"
        },
        {
            "id": "education-funding",
            "title": "Public Education Funding Initiative",
            "description": "Increased funding for public schools",
            "required_signatures": 25000,
            "current_signatures": 18000,
            "progress_percentage": 72.0,
            "icon": "education",
            "category": "Education",
            "location": "[City, State]"
        },
        {
            "id": "clean-energy",
            "title": "Clean Energy for All Act",
            "description": "Transition to renewable energy sources",
            "required_signatures": 25000,
            "current_signatures": 22000,
            "progress_percentage": 88.0,
            "icon": "energy",
            "category": "Environment",
            "location": "[City, State]"
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
    
    return Initiative(**initiative_dict)

@app.post("/api/ballot/initiatives/{initiative_id}/sign")
async def sign_petition(
    initiative_id: str,
    sign_request: PetitionSignRequest,
    current_user: dict = Depends(get_current_user)
):
    """Sign a petition for an initiative"""
    user_id = current_user.get("sub", f"anonymous-{uuid.uuid4()}")
    
    # Check if initiative exists
    initiative_key = get_initiative_key(initiative_id)
    if not redis_client.exists(initiative_key):
        raise HTTPException(status_code=404, detail="Initiative not found")
    
    # Check if user already signed this initiative
    signatures_key = get_signatures_key(initiative_id)
    user_signatures_key = get_user_signatures_key(user_id)
    
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
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Store signature in multiple places
    redis_client.sadd(signatures_key, user_id)
    redis_client.sadd(user_signatures_key, initiative_id)
    
    # Store signature details
    signature_key = f"ballot:signature:{signature_id}"
    redis_client.hset(signature_key, mapping=signature_data)
    
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

@app.get("/api/ballot/user/signatures")
async def get_user_signatures(current_user: dict = Depends(get_current_user)):
    """Get all initiatives signed by the current user"""
    user_id = current_user.get("sub")
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
        "location": initiative.location or "[City, State]",
        "created_by": current_user.get("sub"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    initiative_key = get_initiative_key(initiative_id)
    redis_client.hset(initiative_key, mapping=new_initiative)
    redis_client.sadd(get_all_initiatives_key(), initiative_id)
    
    return Initiative(**new_initiative)

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
