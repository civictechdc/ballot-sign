import os
from pathlib import Path

import docker_utils
import shutil

here = Path(os.path.abspath(os.path.dirname(__file__)))
nginx_dir = here
webapp_dir = here / ".." / "web"
webapp_build_dir = here / ".." / "webapp-build"
static_dir = here / ".." / "static"
certs_dir = here / ".." / "certs"

def _is_path_on_shared_mount(path: Path) -> bool:
    path_str = str(path)
    if path_str.startswith("/mnt/shared"):
        return True
    try:
        return str(path.resolve()).startswith("/mnt/shared")
    except (FileNotFoundError, RuntimeError):
        return False


def _prepare_local_webapp_build_dir(src_dir: Path) -> Path:
    local_dir = Path.home() / ".ballot" / "webapp-build"
    os.makedirs(local_dir, exist_ok=True)
    if os.path.ismount("/mnt/shared") and src_dir.exists():
        try:
            shutil.copytree(src_dir, local_dir, dirs_exist_ok=True)
        except Exception as exc:
            print(f"[!] Warning: failed to sync webapp build from shared mount: {exc}")
    return local_dir


def run(network_name: str = "BALLOT", prefix: str = "ballot-") -> None:

    config_path = here / "nginx.conf"
    #if not config_path.exists() or config_path.stat().st_size == 0:
    #shutil.copy(here / "nginx.conf.template", config_path)
    if _is_path_on_shared_mount(webapp_build_dir):
        build_dir = _prepare_local_webapp_build_dir(webapp_build_dir)
    else:
        os.makedirs(webapp_build_dir, exist_ok=True)
        build_dir = webapp_build_dir
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
            os.path.join(build_dir): {
                "bind": "/app",
                "mode": "rw",
            },
            static_dir: {
                "bind": "/static",
                "mode": "rw",
            },
            certs_dir: {
                "bind": "/certs",
                "mode": "ro",
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
