import os
from pathlib import Path

import docker_utils
import shutil

here = Path(os.path.abspath(os.path.dirname(__file__)))
nginx_dir = here
webapp_dir = here / ".." / "web"
static_dir = here / ".." / "static"
certs_dir = here / ".." / "certs"

def run(network_name: str = "BALLOT", prefix: str = "ballot-") -> None:

    if not os.path.exists("nginx.conf"):
        shutil.copy(here / "nginx.conf.template", here / "nginx.conf")
    os.makedirs(here / "../web/dist", exist_ok=True)
    os.makedirs(certs_dir / "html", exist_ok=True)
    nginx = dict(
        image="nginx:latest",
        name=prefix + "nginx",
        detach=True,  # equivalent to -d
        network=network_name,
        restart_policy={"Name": "always"},
        volumes={
            os.path.join(nginx_dir, "nginx.conf"): {
                "bind": "/etc/nginx/nginx.conf",
                "mode": "rw",
            },
            os.path.join(webapp_dir, "dist"): {
                "bind": "/app",
                "mode": "rw",
            },
            static_dir: {
                "bind": "/static",
                "mode": "rw",
            },
            os.path.join(certs_dir, "html"): {
                "bind": "/usr/share/nginx/html",
                "mode": "rw",
            },
        },
        ports={
            "80/tcp": 80,  # equivalent to -p 80:80
            "443/tcp": 443,  # equivalent to -p 443:443
            "6667/tcp": 6667,
            "8443/tcp": 8443,
            "8448/tcp": 8448,
        },
    )
    docker_utils.run_container(nginx)
