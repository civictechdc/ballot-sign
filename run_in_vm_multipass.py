#!/usr/bin/env python3
"""
run_in_vm_multipass.py

Creates/starts a Multipass Ubuntu VM from an Ubuntu host, with:
- host directory mounted at /mnt/shared

Notes:
- Multipass does not provide built-in port-forwarding. Use the VM IP instead.

Requirements:
- multipass installed

Usage:
  chmod +x run_in_vm_multipass.py
  ./run_in_vm_multipass.py

Overrides via env vars:
  VM_NAME, IMAGE, RAM, VCPUS, DISK_GB, SHARE_DIR, MOUNT_PATH, RESTART_VM
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

here = Path(os.path.abspath(os.path.dirname(__file__)))


def sh(cmd, *, check=True, capture=False):
    if capture:
        return subprocess.run(cmd, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return subprocess.run(cmd, check=check)


def need(binary: str):
    if shutil.which(binary) is None:
        print(f"ERROR: Missing required command: {binary}", file=sys.stderr)
        sys.exit(1)


def instance_exists(name: str) -> bool:
    r = sh(["multipass", "info", name], check=False, capture=True)
    return r.returncode == 0


def instance_state(name: str) -> str:
    r = sh(["multipass", "info", name, "--format", "json"], check=False, capture=True)
    if r.returncode == 0:
        try:
            info = json.loads(r.stdout)
            state = info["info"][name]["state"].lower()
            return state
        except (KeyError, ValueError, TypeError):
            pass
    # Fallback to text output
    r = sh(["multipass", "info", name], check=False, capture=True)
    if r.returncode != 0:
        return "unknown"
    for line in r.stdout.splitlines():
        if line.strip().startswith("State:"):
            return line.split(":", 1)[1].strip().lower()
    return "unknown"


def launch_instance(name: str, image: str, ram: str, vcpus: str, disk_gb: str):
    print(f"[*] Creating VM '{name}'...")
    sh(
        [
            "multipass",
            "launch",
            image,
            "--name",
            name,
            "--mem",
            ram,
            "--cpus",
            vcpus,
            "--disk",
            f"{disk_gb}G",
        ],
        check=True,
    )


def start_instance(name: str):
    state = instance_state(name)
    if state != "running":
        print(f"[*] Starting VM '{name}'...")
        sh(["multipass", "start", name], check=True)
    else:
        print(f"[*] VM '{name}' is already running.")


def stop_instance(name: str):
    print(f"[*] Stopping VM '{name}'...")
    sh(["multipass", "stop", name], check=False)


def restart_instance(name: str):
    state = instance_state(name)
    if state == "running":
        print(f"[*] Restarting VM '{name}'...")
        sh(["multipass", "restart", name], check=True)
    else:
        print(f"[*] VM '{name}' is not running; starting it...")
        sh(["multipass", "start", name], check=True)


def ensure_mount(name: str, host_dir: str, mount_path: str):
    print(f"[*] Mounting {host_dir} -> {name}:{mount_path}...")
    r = sh(["multipass", "mount", host_dir, f"{name}:{mount_path}"], check=False, capture=True)
    if r.returncode != 0:
        # Ignore "already mounted" errors.
        if "already mounted" not in (r.stderr or "").lower():
            print(r.stderr.strip(), file=sys.stderr)
            sys.exit(r.returncode)


def get_instance_ip(name: str) -> str:
    r = sh(["multipass", "info", name, "--format", "json"], check=False, capture=True)
    if r.returncode == 0:
        try:
            info = json.loads(r.stdout)
            ips = info["info"][name].get("ipv4", [])
            if ips:
                return ips[0]
        except (KeyError, ValueError, TypeError):
            pass
    return ""


def main():
    vm_name = os.environ.get("VM_NAME", "ballot-vm")
    image = os.environ.get("IMAGE", "24.04")
    ram = os.environ.get("RAM", "4G")
    vcpus = os.environ.get("VCPUS", "4")
    disk_gb = os.environ.get("DISK_GB", "20")
    share_dir = os.environ.get("SHARE_DIR", str(here))
    mount_path = os.environ.get("MOUNT_PATH", "/mnt/shared")
    restart_flag = os.environ.get("RESTART_VM", "0").lower() in ("1", "true", "yes", "y")

    need("multipass")

    if not os.path.isdir(share_dir):
        print(f"ERROR: Share directory not found: {share_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Using share dir: {share_dir}")
    print(f"[*] VM_NAME={vm_name}")
    print(f"[*] IMAGE={image}")

    if not instance_exists(vm_name):
        launch_instance(vm_name, image, ram, vcpus, disk_gb)
    else:
        print(f"[*] VM '{vm_name}' already exists.")

    if restart_flag:
        restart_instance(vm_name)
    else:
        start_instance(vm_name)

    ensure_mount(vm_name, share_dir, mount_path)

    ip = get_instance_ip(vm_name)
    if ip:
        print(f"[*] VM IP: {ip}")

    print(
        "\nDone.\n\n"
        "Shared folder:\n"
        f"  Host:  {share_dir}\n"
        "  Guest:\n"
        f"    {mount_path}\n\n"
        "Access:\n"
        f"  multipass shell {vm_name}\n"
    )


if __name__ == "__main__":
    main()
