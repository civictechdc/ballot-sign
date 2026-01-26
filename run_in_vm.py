#!/usr/bin/env python3
"""
run_vm.py

Creates/starts a KVM/libvirt Ubuntu VM from an Ubuntu host, with:
- virtiofs share of the *current directory*
- libvirt default NAT network port-forward: host:443 -> guest:443

Requirements:
- libvirt + virt-install installed (your setup.sh already does this)
- log out/in after adding user to libvirt,kvm groups (or run with sudo where needed)

Usage:
  chmod +x run_vm.py
  ./run_vm.py

Overrides via env vars:
  VM_NAME, ISO_PATH, RAM_MB, VCPUS, DISK_GB, OS_VARIANT, LIBVIRT_NET,
  SHARE_TAG, HOST_PORT, GUEST_PORT, RESTART_VM
"""

import os
import shutil
import subprocess
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
here = Path(os.path.abspath(os.path.dirname(__file__)))

def sh(cmd, *, check=True, capture=False, sudo=False):
    if sudo and os.geteuid() != 0:
        cmd = ["sudo"] + cmd
    if capture:
        return subprocess.run(cmd, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return subprocess.run(cmd, check=check)


def need(binary: str):
    if shutil.which(binary) is None:
        print(f"ERROR: Missing required command: {binary}", file=sys.stderr)
        sys.exit(1)

def libvirt_can_read(path: str) -> bool:
    # Check access as libvirt-qemu; requires sudo permission for this user.
    r = sh(["sudo", "-u", "libvirt-qemu", "test", "-r", path], check=False)
    return r.returncode == 0


def ensure_iso_accessible(iso_path: str) -> str:
    """
    Ensure the ISO is readable by libvirt-qemu.
    If not, copy it to /tmp and return the new path.
    """
    if libvirt_can_read(iso_path):
        return iso_path

    staged = Path("/tmp") / f"ballot-iso-{uuid.uuid4()}.iso"
    print(f"[*] Staging ISO for libvirt access: {staged}")
    shutil.copy2(iso_path, staged)
    os.chmod(staged, 0o644)
    return str(staged)


def ensure_share_accessible(share_dir: str) -> str:
    """
    Ensure the share directory is readable by libvirt-qemu.
    Uses ACLs when needed (requires setfacl).
    """
    if libvirt_can_read(share_dir):
        return share_dir

    if shutil.which("setfacl") is None:
        print(
            "ERROR: Share directory isn't accessible to libvirt-qemu, and 'setfacl' is missing.\n"
            "Install it or grant access manually, e.g.:\n"
            f"  sudo setfacl -m u:libvirt-qemu:rx {share_dir}\n"
            f"  sudo setfacl -R -m u:libvirt-qemu:rX {share_dir}",
            file=sys.stderr,
        )
        sys.exit(1)

    print("[*] Granting libvirt-qemu read access to the shared directory...")
    resolved = Path(share_dir).resolve()
    parts = list(resolved.parents)[::-1] + [resolved]
    for part in parts:
        if str(part) == "/":
            continue
        sh(["setfacl", "-m", "u:libvirt-qemu:rx", str(part)], sudo=True)
    sh(["setfacl", "-R", "-m", "u:libvirt-qemu:rX", str(resolved)], sudo=True)

    if not libvirt_can_read(share_dir):
        print(
            "ERROR: Failed to grant libvirt-qemu access to the shared directory.",
            file=sys.stderr,
        )
        sys.exit(1)

    return share_dir


def virsh_net_dumpxml(net: str) -> str:
    # Try without sudo first
    r = sh(["virsh", "net-dumpxml", net], capture=True, check=False)
    if r.returncode != 0 and os.geteuid() != 0:
        # Try with sudo
        r = sh(["virsh", "net-dumpxml", net], capture=True, check=False, sudo=True)
    if r.returncode != 0:
        # If still failing, raise the error
        r.check_returncode()
    return r.stdout


def virsh_net_define_from_xml(xml_text: str, *, check: bool = True):
    # net-define reads a file
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".xml") as f:
        f.write(xml_text)
        path = f.name
    try:
        return sh(["virsh", "net-define", path], sudo=True, check=check, capture=not check)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def ensure_libvirtd_running():
    # best-effort; if systemd isn't present, this will fail silently
    try:
        sh(["systemctl", "is-active", "--quiet", "libvirtd"], check=False)
        r = subprocess.run(["systemctl", "is-active", "--quiet", "libvirtd"])
        if r.returncode != 0:
            print("[*] Starting libvirtd...")
            sh(["systemctl", "enable", "--now", "libvirtd"], sudo=True)
    except FileNotFoundError:
        pass


def default_network_xml(name: str) -> str:
    return f"""<network>
  <name>{name}</name>
  <uuid>{uuid.uuid4()}</uuid>
  <forward mode='nat'/>
  <bridge name='virbr0' stp='on' delay='0'/>
  <ip address='192.168.122.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='192.168.122.2' end='192.168.122.254'/>
    </dhcp>
  </ip>
</network>
"""


def ensure_net_active(net: str):
    r = sh(["virsh", "net-info", net], capture=True, check=False)
    if r.returncode != 0 and os.geteuid() != 0:
        r = sh(["virsh", "net-info", net], capture=True, check=False, sudo=True)
    if r.returncode != 0:
        if net == "default":
            print("[*] libvirt network 'default' not found; defining it...")
            define = virsh_net_define_from_xml(default_network_xml(net), check=False)
            if define is not None and define.returncode != 0:
                if "already exists" not in define.stderr:
                    print(define.stderr.strip(), file=sys.stderr)
            r = sh(["virsh", "net-info", net], capture=True, check=False)
            if r.returncode != 0 and os.geteuid() != 0:
                r = sh(["virsh", "net-info", net], capture=True, check=False, sudo=True)
        if r.returncode != 0:
            print(f"ERROR: libvirt network '{net}' not found. Check: virsh net-list --all", file=sys.stderr)
            sys.exit(1)

    active = None
    for line in r.stdout.splitlines():
        if line.strip().startswith("Active:"):
            active = line.split(":", 1)[1].strip()
            break

    if active != "yes":
        print(f"[*] Starting libvirt network '{net}'...")
        sh(["virsh", "net-start", net], sudo=True)


def ensure_port_forward_rule(net: str, host_port: int, guest_port: int):
    """
    Tries to add a forwarding rule into the libvirt network XML.

    Note: libvirt network port redirection syntax differs a bit by version.
    This uses a common approach:
      <forward mode='nat'>
        <port redir='yes'>
          <range start='1024' end='65535'/>
        </port>
      </forward>
      <rule protocol='tcp' hostport='443' guestport='443'/>
    If your libvirt rejects this, tell me the error output and your `virsh --version`.
    """
    xml = virsh_net_dumpxml(net)
    root = ET.fromstring(xml)

    # Find or create <forward>
    forward = root.find("forward")
    if forward is None:
        forward = ET.SubElement(root, "forward", {"mode": "nat"})
    else:
        forward.set("mode", "nat")

    # Ensure <port redir='yes'><range .../></port> under forward
    port = None
    for child in list(forward):
        if child.tag == "port" and child.attrib.get("redir") == "yes":
            port = child
            break
    if port is None:
        port = ET.SubElement(forward, "port", {"redir": "yes"})
        ET.SubElement(port, "range", {"start": "1024", "end": "65535"})
    else:
        # ensure a range exists
        rng = port.find("range")
        if rng is None:
            ET.SubElement(port, "range", {"start": "1024", "end": "65535"})

    # Ensure <rule .../> exists (placed at root level in some setups; we'll add to root)
    rule_exists = False
    for rule in root.findall("rule"):
        if (
            rule.attrib.get("protocol") == "tcp"
            and rule.attrib.get("hostport") == str(host_port)
            and rule.attrib.get("guestport") == str(guest_port)
        ):
            rule_exists = True
            break

    if not rule_exists:
        ET.SubElement(
            root,
            "rule",
            {"protocol": "tcp", "hostport": str(host_port), "guestport": str(guest_port)},
        )

    new_xml = ET.tostring(root, encoding="unicode")
    print(f"[*] Updating network '{net}' for port forward {host_port}->{guest_port}...")
    virsh_net_define_from_xml(new_xml)

    print(f"[*] Restarting network '{net}' to apply changes...")
    sh(["virsh", "net-destroy", net], sudo=True, check=False)
    sh(["virsh", "net-start", net], sudo=True)


def dom_exists(name: str) -> bool:
    # Try without sudo first
    r = sh(["virsh", "dominfo", name], capture=True, check=False)
    if r.returncode != 0 and os.geteuid() != 0:
        # Try with sudo
        r = sh(["virsh", "dominfo", name], capture=True, check=False, sudo=True)
    return r.returncode == 0


def dom_state(name: str) -> str:
    # Try without sudo first
    r = sh(["virsh", "domstate", name], capture=True, check=False)
    if r.returncode != 0 and os.geteuid() != 0:
        # Try with sudo
        r = sh(["virsh", "domstate", name], capture=True, check=False, sudo=True)
    if r.returncode != 0:
        return "unknown"
    return r.stdout.strip().lower()


def create_vm(
    name: str,
    iso_path: str,
    ram_mb: int,
    vcpus: int,
    disk_gb: int,
    os_variant: str,
    net: str,
    share_dir: str,
    share_tag: str,
):
    print(f"[*] Creating VM '{name}'...")
    sh(
        [
            "virt-install",
            "--name",
            name,
            "--memory",
            str(ram_mb),
            "--vcpus",
            str(vcpus),
            "--disk",
            f"size={disk_gb}",
            "--os-variant",
            os_variant,
            "--cdrom",
            iso_path,
            "--network",
            f"network={net}",
            "--filesystem",
            f"{share_dir},{share_tag}",
            "--graphics",
            "none",
            "--console",
            "pty,target_type=serial",
            "--noautoconsole",
        ],
        sudo=True,
    )


def start_vm(name: str):
    state = dom_state(name)
    if state != "running":
        print(f"[*] Starting VM '{name}'...")
        # Try without sudo first, then with sudo if needed
        r = sh(["virsh", "start", name], capture=True, check=False)
        if r.returncode != 0 and os.geteuid() != 0:
            r = sh(["virsh", "start", name], capture=True, check=False, sudo=True)
        if r.returncode != 0:
            print(f"Warning: Failed to start VM '{name}': {r.stderr.strip()}")
    else:
        print(f"[*] VM '{name}' is already running.")

def restart_vm(name: str):
    state = dom_state(name)
    if state != "running":
        print(f"[*] VM '{name}' is not running; starting it...")
        start_vm(name)
        return

    print(f"[*] Restarting VM '{name}'...")
    r = sh(["virsh", "destroy", name], capture=True, check=False)
    if r.returncode != 0 and os.geteuid() != 0:
        r = sh(["virsh", "destroy", name], capture=True, check=False, sudo=True)
    if r.returncode != 0:
        print(f"Warning: Failed to stop VM '{name}': {r.stderr.strip()}")
    start_vm(name)


def main():
    # ---- Config via env ----
    vm_name = os.environ.get("VM_NAME", "ballot-vm")
    iso_path = os.environ.get("ISO_PATH", here / "ubuntu-24.04.3-desktop-amd64.iso")
    ram_mb = int(os.environ.get("RAM_MB", "4096"))
    vcpus = int(os.environ.get("VCPUS", "4"))
    disk_gb = int(os.environ.get("DISK_GB", "20"))
    os_variant = os.environ.get("OS_VARIANT", "ubuntu24.04")
    libvirt_net = os.environ.get("LIBVIRT_NET", "default")
    share_tag = os.environ.get("SHARE_TAG", "shared_dir")
    host_port = int(os.environ.get("HOST_PORT", "443"))
    guest_port = int(os.environ.get("GUEST_PORT", "443"))
    restart_flag = os.environ.get("RESTART_VM", "0").lower() in ("1", "true", "yes", "y")

    share_dir = os.getcwd()

    # ---- deps ----
    need("virsh")
    need("virt-install")

    if not os.path.isfile(iso_path):
        print(
            "ERROR: ISO not found at:\n"
            f"  {iso_path}\n\n"
            "Download an Ubuntu ISO and set ISO_PATH, e.g.\n"
            "  ISO_PATH=$HOME/Downloads/ubuntu-24.04-live-server-amd64.iso ./run_vm.py",
            file=sys.stderr,
        )
        sys.exit(1)

    iso_path = ensure_iso_accessible(str(iso_path))
    share_dir = ensure_share_accessible(share_dir)

    print(f"[*] Using share dir: {share_dir}")
    print(f"[*] VM_NAME={vm_name}")
    print(f"[*] Port forward: host:{host_port} -> guest:{guest_port}")

    ensure_libvirtd_running()
    ensure_net_active(libvirt_net)
    ensure_port_forward_rule(libvirt_net, host_port, guest_port)

    if not dom_exists(vm_name):
        create_vm(
            name=vm_name,
            iso_path=iso_path,
            ram_mb=ram_mb,
            vcpus=vcpus,
            disk_gb=disk_gb,
            os_variant=os_variant,
            net=libvirt_net,
            share_dir=share_dir,
            share_tag=share_tag,
        )
    else:
        print(f"[*] VM '{vm_name}' already exists.")

    if restart_flag:
        restart_vm(vm_name)
    else:
        start_vm(vm_name)

    print(
        "\nDone.\n\n"
        "Shared folder:\n"
        f"  Host:  {share_dir}\n"
        "  Guest (inside VM):\n"
        "    sudo mkdir -p /mnt/shared\n"
        f"    sudo mount -t virtiofs {share_tag} /mnt/shared\n\n"
        "Port forward:\n"
        f"  Host browser: https://localhost:{host_port}\n"
        f"  -> Guest: :{guest_port}\n"
    )


if __name__ == "__main__":
    main()
