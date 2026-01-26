import os
import subprocess
import sys
from pathlib import Path
here = Path(os.path.abspath(os.path.dirname(__file__)))
nginx_dir = here / "nginx"
webapp_dir = here / "web"
static_dir = here / "static"
NETWORK_NAME = "BALLOT"
import docker_utils
from nginx.run import run as nginx_run
from PIdP.run import run as pidp_run

docker_utils.initializeFiles()
import editme 

prefix = editme.prefix

def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def ensure_certs(debug: bool) -> None:
    certs_dir = here / "certs"
    html_dir = certs_dir / "html"
    html_dir.mkdir(parents=True, exist_ok=True)

    if not debug:
        return

    init_script = certs_dir / "init-temp-keys.py"
    required = [
        certs_dir / "kas-private.pem",
        certs_dir / "kas-cert.pem",
        certs_dir / "kas-ec-private.pem",
        certs_dir / "kas-ec-cert.pem",
        certs_dir / "keys" / "localhost.crt",
        certs_dir / "keys" / "localhost.key",
    ]

    if all(path.exists() for path in required):
        print("Temporary certs already exist; skipping init-temp-keys.")
        return

    if not init_script.exists():
        raise FileNotFoundError(f"Missing cert bootstrap script: {init_script}")

    print("Initializing temporary certs for debug mode...")
    subprocess.run(
        [sys.executable, str(init_script), "--output", "."],
        cwd=str(certs_dir),
        check=True,
    )


debug_mode = bool(getattr(editme, "DEBUG", False)) or _env_flag("DEBUG")
ensure_certs(debug_mode)

def ensure_pidp_image() -> None:
    images = docker_utils.DOCKER_CLIENT.images.list(name="pidp")
    for image in images:
        if "pidp" in image.tags:
            return
    print("Building pidp image from PIdP/Dockerfile...")
    docker_utils.DOCKER_CLIENT.images.build(
        path=str(here / "PIdP"),
        tag="pidp",
    )

ensure_pidp_image()
docker_utils.ensure_network(NETWORK_NAME)
pidp_run(prefix, NETWORK_NAME)
#wait for PIdP to initialize
# ----------------------------
# Redis (cache/ratelimit/queue)
# ----------------------------
REDIS = dict(
    image="redis:7-alpine",
    detach=True,
    name=prefix + "redis",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    # Optional: expose to host for local dev tooling
    # ports={"6379/tcp": 6379},
    command=[
        "redis-server",
        "--appendonly", "yes",
        "--save", "60", "1",
        "--loglevel", "warning",
        # If you want auth, set editme.REDIS_PASSWORD and uncomment:
        # "--requirepass", editme.REDIS_PASSWORD,
    ],
    volumes={
        prefix + "REDIS_DATA": {
            "bind": "/data",
            "mode": "rw",
        }
    },
    healthcheck={
        "test": ["CMD-SHELL", "redis-cli ping | grep -q PONG"],
        "interval": 5000000000,  # 5s
        "timeout": 5000000000,   # 5s
        "retries": 10,
    },
)
docker_utils.run_container(REDIS)

# ----------------------------
# Object Storage (MinIO, S3-compatible)
# ----------------------------
MINIO = dict(
    image="minio/minio:latest",
    detach=True,
    name=prefix + "minio",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    ports={
        "9000/tcp": 9000,  # S3 API
        "9001/tcp": 9001,  # Console UI
    },
    environment={
        # Put these in editme.py
        "MINIO_ROOT_USER": editme.MINIO_ROOT_USER,
        "MINIO_ROOT_PASSWORD": editme.MINIO_ROOT_PASSWORD,
        # Optional but helpful when going through nginx / external URL:
        # "MINIO_SERVER_URL": editme.MINIO_SERVER_URL,  # e.g. https://s3.example.com
        # "MINIO_BROWSER_REDIRECT_URL": editme.MINIO_BROWSER_REDIRECT_URL,  # e.g. https://s3-console.example.com
    },
    command=[
        "server",
        "/data",
        "--address", ":9000",
        "--console-address", ":9001",
    ],
    volumes={
        "MINIO_DATA": {
            "bind": "/data",
            "mode": "rw",
        }
    },
    healthcheck={
        "test": ["CMD-SHELL", "curl -fsS http://127.0.0.1:9000/minio/health/ready >/dev/null"],
        "interval": 5000000000,  # 5s
        "timeout": 5000000000,   # 5s
        "retries": 10,
    },
)
docker_utils.run_container(MINIO)

# Handy internal endpoints (for your backend config)
REDIS_URL = f"redis://{prefix}redis:6379/0"
MINIO_S3_ENDPOINT = f"http://{prefix}minio:9000"
MINIO_CONSOLE = f"http://{prefix}minio:9001"


# 1) Postgres datastore for SpiceDB
SPICEDB_DB = dict(
    image="postgres:15-alpine",
    detach=True,
    name=prefix + "spicedb-postgres",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    user="postgres",
    environment={
        "POSTGRES_PASSWORD": editme.SPICEDB_POSTGRES_PASSWORD,
        "POSTGRES_USER": editme.SPICEDB_POSTGRES_USER,
        "POSTGRES_DB": editme.SPICEDB_POSTGRES_DB,
    },
    volumes={
        prefix + "SPICEDB_POSTGRES": {
            "bind": "/var/lib/postgresql/data",
            "mode": "rw",
        }
    },
    healthcheck={
        "test": ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"],
        "interval": 5000000000,  # 5s
        "timeout": 5000000000,   # 5s
        "retries": 10,
    },
)
docker_utils.run_container(SPICEDB_DB)

# Common DSN used by migrate + spicedb
dsn = (
    f"postgres://{editme.SPICEDB_POSTGRES_USER}:"
    f"{editme.SPICEDB_POSTGRES_PASSWORD}"
    f"@{prefix}spicedb-postgres:5432/"
    f"{editme.SPICEDB_POSTGRES_DB}?sslmode=disable"
)

# 2) Run migrations (one-shot container)
# NOTE: you may want docker_utils.run_container to support `remove=True` or similar.
SPICEDB_MIGRATE = dict(
    image="authzed/spicedb:latest",
    detach=False,  # usually you want to wait for this to finish
    name=prefix + "spicedb-migrate",
    network=NETWORK_NAME,
    restart_policy={"Name": "no"},
    command=[
        "migrate",
        "head",
        "--datastore-engine=postgres",
        f"--datastore-conn-uri={dsn}",
    ],
)
# Dont run this? We're not migrating anything
#docker_utils.run_container(SPICEDB_MIGRATE)

# 3) SpiceDB API service
SPICEDB = dict(
    image="authzed/spicedb:latest",
    detach=True,
    name=prefix + "spicedb",
    network=NETWORK_NAME,
    restart_policy={"Name": "always"},
    ports={
        "50051/tcp": 50051,  # gRPC API
        #"8443/tcp": 8443,    # HTTP gateway (if enabled; harmless to expose)
    },
    command=[
        "serve",
        "--grpc-preshared-key",
        editme.SPICEDB_PRESHARED_KEY,

        "--datastore-engine=postgres",
        f"--datastore-conn-uri={dsn}",

        # Nice defaults for dev; adjust as you like:
        "--log-level=info",
        "--http-enabled=true",
        "--http-addr=0.0.0.0:8443",
        "--grpc-addr=0.0.0.0:50051",
    ],
    healthcheck={
        # Keeps it lightweight: confirm the process is up
        # (If you prefer, swap this for a real gRPC health probe.)
        "test": ["CMD-SHELL", "ps aux | grep -q '[s]picedb serve'"],
        "interval": 5000000000,
        "timeout": 5000000000,
        "retries": 10,
    },
)
docker_utils.run_container(SPICEDB)

nginx_run(NETWORK_NAME, prefix)
