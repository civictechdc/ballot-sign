import os
from pathlib import Path
import sys

here = Path(os.path.abspath(os.path.dirname(__file__)))
root = here.parent
sys.path.append(str(root))

import docker_utils
import editme


def ensure_ballot_backend_image() -> None:
    images = docker_utils.DOCKER_CLIENT.images.list(name="ballot-backend")
    for image in images:
        if "ballot-backend" in image.tags:
            return
    print("Building ballot-backend image from ballot-backend/Dockerfile...")
    docker_utils.DOCKER_CLIENT.images.build(
        path=str(here),
        tag="ballot-backend",
    )


def run(network_name: str = "BALLOT", prefix: str = "") -> None:
    ensure_ballot_backend_image()
    backend = dict(
        image="ballot-backend",
        name=prefix + "ballot-backend",
        detach=True,
        network=network_name,
        restart_policy={"Name": "always"},
        volumes={
            str(here): {"bind": "/app", "mode": "rw"},
        },
        environment={
            "BALLOT_REDIS_HOST": f"{prefix}redis",
            "BALLOT_REDIS_PORT": "6379",
            "PIDP_BASE_URL": "http://pidp:8000",
            "PIDP_JWKS_URL": "http://pidp:8000/.well-known/jwks.json",
            "PIDP_JWT_ISSUER": os.getenv("PIDP_JWT_ISSUER"),
            "PIDP_JWT_AUDIENCE": os.getenv("PIDP_JWT_AUDIENCE"),
            "SPICEDB_HTTP_URL": "http://spicedb:8443",
            "SPICEDB_PRESHARED_KEY": editme.SPICEDB_PRESHARED_KEY,
            "WATCHFILES_FORCE_POLLING": "true",
            "MODERATOR_EMAILS": os.getenv("MODERATOR_EMAILS", "julian2@julian2.edu"),
        },
    )
    docker_utils.run_container(backend)
