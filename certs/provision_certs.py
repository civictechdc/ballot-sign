#!/usr/bin/env python3
"""
Request and renew TLS certificates for NGINX using Certbot.

The script imports `editme.py` to discover the deployment's `BACKEND_LOCATION`
and e-mail address, inspects `env.py` to learn which subdomains must be covered,
requests/renews certificates, and installs a cron job to keep them fresh.

If Let's Encrypt DNS challenges are not an option, the script now ensures the
Certbot nginx plugin is present (installing it through apt when possible) and
falls back to a Docker-driven standalone Certbot run when the plugin cannot be
provided automatically.
"""

from __future__ import annotations

import argparse
import importlib.util
import logging
import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from types import ModuleType
from collections import defaultdict
from typing import Any, Dict, List, Sequence, Set

from docker.errors import APIError, DockerException, NotFound

# Ensure we can import editme.py even though this script lives in certs/
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from editme import BACKEND_LOCATION, GPU_BACKEND_LOCATION, USER_EMAIL, USER_WEBSITE  # type: ignore  # noqa: E402
import utils_docker  # noqa: E402


LOG = logging.getLogger(__name__)
DEFAULT_ENV_PATH = REPO_ROOT / "env.py"

# Capture assignments such as `KEYCLOAK_BASE_URL = "keycloak." + BACKEND_LOCATION`
SUBDOMAIN_PATTERN = re.compile(
    r'=\s*"(?P<prefix>[\w-]+)\."\s*\+\s*(?P<base>BACKEND_LOCATION|GPU_BACKEND_LOCATION|USER_WEBSITE)',
    re.IGNORECASE,
)


def discover_subdomains(env_path: Path) -> Dict[str, Set[str]]:
    """Return the host prefixes discovered in env.py, grouped by base constant."""
    prefixes: Dict[str, Set[str]] = defaultdict(set)
    try:
        with env_path.open("r", encoding="utf-8") as env_file:
            for line in env_file:
                match = SUBDOMAIN_PATTERN.search(line)
                if match:
                    base = match.group("base").upper()
                    prefixes[base].add(match.group("prefix"))
    except FileNotFoundError:
        LOG.warning("env.py not found at %s; only the apex domain will be used", env_path)
    return {base: set(values) for base, values in prefixes.items()}


def build_domains(
    base_domains: Dict[str, str],
    prefixes: Dict[str, Set[str]],
    include_wildcard: bool,
    extra_domains: Sequence[str] | None = None,
) -> List[str]:
    """Compose the final list of FQDNs for Certbot."""
    domains: Set[str] = set()
    wildcard_entries: Set[str] = set()

    for base_name, base_value in base_domains.items():
        if not base_value:
            continue
        base_value = base_value.strip()
        if not base_value:
            continue

        domains.add(base_value)
        for prefix in prefixes.get(base_name, set()):
            domains.add(f"{prefix}.{base_value}")

        if include_wildcard:
            wildcard_entries.add(f"*.{base_value}")

    if extra_domains:
        domains.update(extra_domains)

    ordered = sorted(domains)
    if include_wildcard and wildcard_entries:
        ordered = sorted(wildcard_entries) + ordered
    return ordered


def supports_nginx_plugin(certbot_bin: str) -> bool:
    """Return True if the installed Certbot exposes the nginx authenticator."""
    try:
        result = subprocess.run(
            [certbot_bin, "plugins"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        LOG.warning("Certbot binary %s not found", certbot_bin)
        return False

    if result.returncode != 0:
        LOG.warning("Unable to inspect Certbot plugins (exit %s)", result.returncode)
        return False

    return "nginx" in result.stdout.lower()


def install_nginx_plugin() -> bool:
    """Attempt to install the Certbot nginx plugin using apt-get."""
    apt = shutil.which("apt-get")
    if not apt:
        LOG.info("apt-get not available; cannot auto-install python3-certbot-nginx")
        return False

    LOG.info("Installing python3-certbot-nginx via apt-get")
    try:
        subprocess.run([apt, "update"], check=True)
        subprocess.run([apt, "install", "-y", "python3-certbot-nginx"], check=True)
    except subprocess.CalledProcessError as exc:
        LOG.error("Failed to install python3-certbot-nginx (exit %s)", exc.returncode)
        return False

    return True


def ensure_nginx_ready(certbot_bin: str, skip_install: bool) -> bool:
    """Verify that the nginx plugin is ready (installing it if needed)."""
    if supports_nginx_plugin(certbot_bin):
        return True

    if skip_install:
        return False

    if install_nginx_plugin() and supports_nginx_plugin(certbot_bin):
        LOG.info("Certbot nginx plugin installed successfully")
        return True

    return False


def run_certbot_host(
    domains: Sequence[str],
    mode: str,
    certbot_bin: str,
    email: str,
    staging: bool,
    dry_run: bool,
    pre_hook: str | None,
    post_hook: str | None,
    cert_name: str | None,
    reuse_existing: bool,
) -> None:
    """Invoke the host Certbot binary in DNS, nginx, or standalone mode."""
    if not domains:
        raise ValueError("At least one domain is required for Certbot")

    cmd = [certbot_bin, "certonly", "--non-interactive", "--agree-tos", "--email", email]
    if staging:
        cmd.append("--staging")

    if dry_run:
        cmd.append("--dry-run")

    if mode == "dns":
        cmd.extend(["--manual", "--preferred-challenges", "dns"])
    elif mode == "nginx":
        cmd.append("--nginx")
    elif mode == "standalone":
        cmd.extend(["--standalone", "--preferred-challenges", "http"])
        if pre_hook:
            cmd.extend(["--pre-hook", pre_hook])
        if post_hook:
            cmd.extend(["--post-hook", post_hook])
    else:
        raise ValueError(f"Unsupported Certbot mode: {mode}")

    if cert_name:
        cmd.extend(["--cert-name", cert_name])
        if reuse_existing:
            cmd.append("--expand")

    for domain in domains:
        cmd.extend(["-d", domain])

    LOG.info("Requesting certificates for: %s", ", ".join(domains))
    LOG.debug("Running command: %s", " ".join(shlex.quote(part) for part in cmd))
    subprocess.run(cmd, check=True)


def run_hook_command(command: str | None, label: str, dry_run: bool) -> None:
    """Execute an external hook command, respecting dry-run mode."""
    if not command:
        return

    if dry_run:
        LOG.info("Dry-run: skipping %s hook: %s", label, command)
        return

    LOG.info("Running %s hook: %s", label, command)
    subprocess.run(command, shell=True, check=True)


def run_certbot_docker(
    domains: Sequence[str],
    email: str,
    staging: bool,
    dry_run: bool,
    docker_bin: str,
    docker_image: str,
    pre_hook: str | None,
    post_hook: str | None,
    letsencrypt_dir: str,
    work_dir: str,
    logs_dir: str,
    cert_name: str | None,
    reuse_existing: bool,
) -> None:
    """Run Certbot inside a Docker container using standalone HTTP challenges."""
    for path in (letsencrypt_dir, work_dir, logs_dir):
        Path(path).mkdir(parents=True, exist_ok=True)

    cmd = [
        docker_bin,
        "run",
        "--rm",
        "-p",
        "80:80",
        "-v",
        f"{letsencrypt_dir}:/etc/letsencrypt",
        "-v",
        f"{work_dir}:/var/lib/letsencrypt",
        "-v",
        f"{logs_dir}:/var/log/letsencrypt",
        docker_image,
        "certonly",
        "--standalone",
        "--preferred-challenges",
        "http",
        "--non-interactive",
        "--agree-tos",
        "--email",
        email,
    ]

    if staging:
        cmd.append("--staging")

    if dry_run:
        cmd.append("--dry-run")

    if cert_name:
        cmd.extend(["--cert-name", cert_name])
        if reuse_existing:
            cmd.append("--expand")

    for domain in domains:
        cmd.extend(["-d", domain])

    run_hook_command(pre_hook, "pre", dry_run)
    try:
        LOG.info("Requesting certificates via Docker for: %s", ", ".join(domains))
        LOG.debug("Running command: %s", shlex.join(cmd))
        subprocess.run(cmd, check=True)
    finally:
        run_hook_command(post_hook, "post", dry_run)


def chain_shell_commands(commands: Sequence[str]) -> str:
    """Join multiple shell commands into a single bash invocation."""
    steps = [cmd for cmd in commands if cmd]
    if not steps:
        return ""
    chained = " && ".join(steps)
    return f"bash -lc {shlex.quote(chained)}"


def build_host_renew_command(
    mode: str,
    certbot_bin: str,
    reload_command: str,
    pre_hook: str | None,
    post_hook: str | None,
) -> str:
    """Construct the renew command for cron when using the host Certbot binary."""
    cmd = [certbot_bin, "renew", "--quiet"]
    if mode == "standalone":
        if pre_hook:
            cmd.extend(["--pre-hook", pre_hook])
        if post_hook:
            cmd.extend(["--post-hook", post_hook])
    if reload_command:
        cmd.extend(["--deploy-hook", reload_command, "--post-hook", reload_command])
    return shlex.join(cmd)


def build_docker_renew_command(
    docker_bin: str,
    docker_image: str,
    reload_command: str,
    pre_hook: str | None,
    post_hook: str | None,
    letsencrypt_dir: str,
    work_dir: str,
    logs_dir: str,
) -> str:
    """Construct the renew command for cron when Certbot runs inside Docker."""
    docker_cmd = [
        docker_bin,
        "run",
        "--rm",
        "-p",
        "80:80",
        "-v",
        f"{letsencrypt_dir}:/etc/letsencrypt",
        "-v",
        f"{work_dir}:/var/lib/letsencrypt",
        "-v",
        f"{logs_dir}:/var/log/letsencrypt",
        docker_image,
        "renew",
        "--quiet",
        "--standalone",
        "--preferred-challenges",
        "http",
    ]

    steps: List[str] = []
    if pre_hook:
        steps.append(pre_hook)
    steps.append(shlex.join(docker_cmd))
    if post_hook:
        steps.append(post_hook)
    if reload_command:
        steps.append(reload_command)
    return chain_shell_commands(steps)


def ensure_renewal_cron(cron_spec: str, command: str, dry_run: bool) -> None:
    """Ensure a cron entry exists that runs the provided renewal command."""
    if not command:
        LOG.warning("No renewal command generated; skipping cron installation")
        return

    cron_line = f"{cron_spec} {command}"

    if dry_run:
        LOG.info("Dry-run: would add cron entry: %s", cron_line)
        return

    existing = ""
    result = subprocess.run(
        ["crontab", "-l"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        existing = result.stdout
    elif result.returncode != 1:
        LOG.warning("Could not inspect current crontab (exit %s)", result.returncode)

    if cron_line in existing:
        LOG.info("Renewal cron entry already present")
        return

    new_cron = existing.rstrip("\n") + ("\n" if existing and not existing.endswith("\n") else "")
    new_cron += cron_line + "\n"

    LOG.info("Installing renewal cron entry: %s", cron_line)
    subprocess.run(["crontab", "-"], input=new_cron, text=True, check=True)


def determine_mode(args: argparse.Namespace, certbot_bin: str) -> str:
    """Pick the best Certbot mode (dns, nginx, standalone, or docker)."""
    if args.dns_wildcard:
        return "dns"

    requested = args.mode

    if requested == "nginx":
        if ensure_nginx_ready(certbot_bin, args.skip_plugin_install):
            return "nginx"
        raise RuntimeError("Certbot nginx plugin is not available and automatic installation failed")

    if requested == "docker":
        if not shutil.which(args.docker_bin):
            raise RuntimeError("Docker executable not found; cannot use docker mode")
        return "docker"

    if requested == "standalone":
        return "standalone"

    # Auto mode: try nginx plugin, then docker, then standalone.
    if ensure_nginx_ready(certbot_bin, args.skip_plugin_install):
        return "nginx"

    if shutil.which(args.docker_bin):
        LOG.info("Using Docker fallback for Certbot HTTP challenges")
        return "docker"

    LOG.info("Falling back to standalone Certbot HTTP challenges")
    return "standalone"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        type=Path,
        default=DEFAULT_ENV_PATH,
        help="Path to env.py used to discover subdomains (default: %(default)s)",
    )
    parser.add_argument(
        "--certbot-bin",
        default=os.environ.get("CERTBOT_BIN", "certbot"),
        help="Certbot executable to invoke (default: %(default)s)",
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "nginx", "standalone", "docker"],
        default="auto",
        help="How to satisfy HTTP challenges when not using DNS (default: %(default)s)",
    )
    parser.add_argument(
        "--skip-plugin-install",
        action="store_true",
        help="Skip automatic installation of python3-certbot-nginx",
    )
    parser.add_argument(
        "--email",
        default=USER_EMAIL,
        help="Contact e-mail for Certbot (default: value from editme.py)",
    )
    parser.add_argument(
        "--staging",
        action="store_true",
        help="Use Let's Encrypt staging servers for testing",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show the commands without touching Certbot or cron",
    )
    parser.add_argument(
        "--dns-wildcard",
        action="store_true",
        help="Include *.domain and use manual DNS challenges",
    )
    parser.add_argument(
        "--pre-hook",
        default=os.environ.get("CERTBOT_PRE_HOOK"),
        help="Optional shell command run before standalone/Docker challenges",
    )
    parser.add_argument(
        "--post-hook",
        default=os.environ.get("CERTBOT_POST_HOOK"),
        help="Optional shell command run after standalone/Docker challenges",
    )
    parser.add_argument(
        "--extra-domain",
        action="append",
        default=[],
        help="Additional fully qualified domains to include (can be used multiple times)",
    )
    parser.add_argument(
        "--cert-name",
        default=None,
        help="Existing Certbot lineage name to reuse (default: base domain)",
    )
    parser.add_argument(
        "--docker-bin",
        default=os.environ.get("DOCKER_BIN", "docker"),
        help="Docker executable to invoke when using docker mode (default: %(default)s)",
    )
    parser.add_argument(
        "--docker-image",
        default="certbot/certbot:latest",
        help="Docker image to run for Certbot (default: %(default)s)",
    )
    parser.add_argument(
        "--letsencrypt-dir",
        default="/etc/letsencrypt",
        help="Directory where certificates are stored (default: %(default)s)",
    )
    parser.add_argument(
        "--letsencrypt-work-dir",
        default="/var/lib/letsencrypt",
        help="Certbot work directory (default: %(default)s)",
    )
    parser.add_argument(
        "--letsencrypt-logs-dir",
        default="/var/log/letsencrypt",
        help="Certbot logs directory (default: %(default)s)",
    )
    parser.add_argument(
        "--reload-command",
        default=os.environ.get("CERTBOT_RELOAD_COMMAND"),
        help="Optional command executed after successful renewals",
    )
    parser.add_argument(
        "--cron-spec",
        default="0 3,15 * * *",
        help="Cron schedule for renewals (default: %(default)s)",
    )
    parser.add_argument(
        "--skip-cron",
        action="store_true",
        help="Skip installing the cron job",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        help="Logging verbosity (default: %(default)s)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    prefixes = discover_subdomains(args.env_file)
    base_domains = {
        "BACKEND_LOCATION": BACKEND_LOCATION,
        "GPU_BACKEND_LOCATION": GPU_BACKEND_LOCATION,
        "USER_WEBSITE": USER_WEBSITE,
    }
    domains = build_domains(
        base_domains=base_domains,
        prefixes=prefixes,
        include_wildcard=args.dns_wildcard,
        extra_domains=args.extra_domain,
    )

    certbot_bin = shutil.which(args.certbot_bin) or args.certbot_bin
    resolved_docker_bin = shutil.which(args.docker_bin) or args.docker_bin
    args.docker_bin = resolved_docker_bin

    cert_name = args.cert_name or BACKEND_LOCATION
    lineage_dir = Path(args.letsencrypt_dir) / "live" / cert_name
    reuse_existing = lineage_dir.exists()
    if reuse_existing:
        LOG.info("Existing certificate lineage detected at %s; will reuse it", lineage_dir)

    env_module: ModuleType | None = None
    nginx_config: dict[str, Any] | None = None
    nginx_name: str | None = None
    try:
        env_module = load_env_module(args.env_file)
    except FileNotFoundError:
        LOG.warning("Environment file %s not found; nginx container will not be managed", args.env_file)
    except Exception as exc:
        LOG.warning("Unable to import environment config from %s: %s", args.env_file, exc)
    else:
        nginx_config, nginx_name = extract_nginx_config(env_module)

    try:
        use_mode = determine_mode(args, certbot_bin)
    except RuntimeError as exc:
        LOG.error("%s", exc)
        raise

    pre_hook = args.pre_hook if use_mode in {"standalone", "docker"} else None
    post_hook = args.post_hook if use_mode in {"standalone", "docker"} else None
    requires_nginx_pause = use_mode in {"standalone", "docker"}

    main_exc: BaseException | None = None
    cleanup_exc: BaseException | None = None

    try:
        try:
            if requires_nginx_pause:
                if args.dry_run:
                    if nginx_name:
                        LOG.info("Dry-run: would stop Docker container %s before Certbot runs", nginx_name)
                    LOG.info("Dry-run: would stop system nginx service before Certbot runs")
                else:
                    if nginx_config and nginx_name:
                        stop_nginx_container(nginx_name)
                    elif nginx_name:
                        LOG.warning("Cannot stop nginx container %s because no configuration was loaded", nginx_name)
                    stop_system_nginx_service()

            if use_mode == "docker":
                run_certbot_docker(
                    domains=domains,
                    email=args.email,
                    staging=args.staging,
                    dry_run=args.dry_run,
                    docker_bin=resolved_docker_bin,
                    docker_image=args.docker_image,
                    pre_hook=pre_hook,
                    post_hook=post_hook,
                    letsencrypt_dir=args.letsencrypt_dir,
                    work_dir=args.letsencrypt_work_dir,
                    logs_dir=args.letsencrypt_logs_dir,
                    cert_name=cert_name,
                    reuse_existing=reuse_existing,
                )
            else:
                run_certbot_host(
                    domains=domains,
                    mode=use_mode,
                    certbot_bin=certbot_bin,
                    email=args.email,
                    staging=args.staging,
                    dry_run=args.dry_run,
                    pre_hook=pre_hook,
                    post_hook=post_hook,
                    cert_name=cert_name,
                    reuse_existing=reuse_existing,
                )
        except subprocess.CalledProcessError as exc:
            LOG.error("Certbot failed with exit code %s", exc.returncode)
            main_exc = exc
        else:
            if not args.skip_cron:
                if use_mode == "docker":
                    renew_command = build_docker_renew_command(
                        docker_bin=resolved_docker_bin,
                        docker_image=args.docker_image,
                        reload_command=args.reload_command,
                        pre_hook=pre_hook,
                        post_hook=post_hook,
                        letsencrypt_dir=args.letsencrypt_dir,
                        work_dir=args.letsencrypt_work_dir,
                        logs_dir=args.letsencrypt_logs_dir,
                    )
                else:
                    renew_command = build_host_renew_command(
                        mode=use_mode,
                        certbot_bin=certbot_bin,
                        reload_command=args.reload_command,
                        pre_hook=pre_hook,
                        post_hook=post_hook,
                    )

                ensure_renewal_cron(
                    cron_spec=args.cron_spec,
                    command=renew_command,
                    dry_run=args.dry_run,
                )
    finally:
        try:
            if args.dry_run:
                if nginx_name:
                    LOG.info("Dry-run: would ensure Docker container %s is running after Certbot", nginx_name)
            else:
                if env_module and nginx_config:
                    # The start_nginx_container function will handle stopping the system service.
                    start_nginx_container(env_module, nginx_config)
        except BaseException as exc:
            cleanup_exc = exc

    if main_exc:
        if cleanup_exc:
            raise main_exc from cleanup_exc
        raise main_exc

    if cleanup_exc:
        raise cleanup_exc


def load_env_module(env_path: Path) -> ModuleType:
    """Load env.py (or alternative) so we can access the nginx container config."""
    if not env_path.exists():
        raise FileNotFoundError(f"Environment file not found at {env_path}")

    spec = importlib.util.spec_from_file_location("arkavo_env_runtime", env_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load env module from {env_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def extract_nginx_config(env_module: ModuleType) -> tuple[dict[str, Any], str] | tuple[None, None]:
    """Return the nginx container configuration and name if available."""
    nginx_config = getattr(env_module, "nginx", None)
    if isinstance(nginx_config, dict):
        container_name = str(nginx_config.get("name", "nginx"))
        return nginx_config, container_name

    LOG.warning("env.py does not define an nginx container configuration; skipping start/stop")
    return None, None


def stop_system_nginx_service() -> bool:
    """Stop the host nginx service if it exists and is currently active."""
    stopped = False
    systemctl = shutil.which("systemctl")
    if systemctl:
        result = subprocess.run(
            [systemctl, "is-active", "--quiet", "nginx"],
            check=False,
        )
        if result.returncode == 0:
            LOG.info("Stopping system nginx service via systemctl")
            try:
                subprocess.run([systemctl, "stop", "nginx"], check=True)
                stopped = True
            except subprocess.CalledProcessError:
                LOG.warning("Failed to stop nginx via systemctl, will try pkill.")
        elif result.returncode == 4:
            LOG.debug("nginx systemd unit not found; nothing to stop via systemctl")
        else:
            LOG.debug("system nginx service already inactive according to systemctl")
            stopped = True

    # Fallback for non-service processes or if systemctl fails
    pkill = shutil.which("pkill")
    if pkill:
        LOG.info("Attempting to stop any remaining nginx processes with pkill")
        # Use pkill to find and kill processes named 'nginx'. RC 1 means no process found.
        result = subprocess.run([pkill, "-f", "nginx"], check=False)
        if result.returncode == 0:
            LOG.info("Successfully terminated nginx process(es) with pkill.")
            stopped = True
    else:
        LOG.warning("pkill command not found, cannot forcefully stop nginx processes.")

    return stopped


def stop_nginx_container(container_name: str) -> bool:
    """Stop the running nginx container via the Python Docker client."""
    client = utils_docker.DOCKER_CLIENT
    try:
        container = client.containers.get(container_name)
    except NotFound:
        LOG.info("Docker container %s is not running; nothing to stop", container_name)
        return False
    except DockerException as exc:
        LOG.warning("Failed to inspect Docker container %s: %s", container_name, exc)
        return False

    try:
        container.reload()
        status = container.status or ""
    except DockerException as exc:
        LOG.warning("Unable to refresh Docker container %s status: %s", container_name, exc)
        status = ""

    if status not in {"running", "restarting", "created"}:
        LOG.info("Docker container %s is already %s", container_name, status or "stopped")
        return False

    LOG.info("Stopping Docker container %s", container_name)
    try:
        container.stop()
        container.wait()
    except APIError as exc:
        LOG.error("Failed to stop Docker container %s: %s", container_name, exc)
        raise

    return True


def start_nginx_container(env_module: ModuleType, nginx_config: dict[str, Any]) -> None:
    """Start/restart the nginx container using the same helper run.py relies on."""
    LOG.info("Attempting to stop system nginx service to avoid port conflicts.")
    stop_system_nginx_service()  # Ensure system nginx is stopped before starting the container.

    container_name = str(nginx_config.get("name", "nginx"))
    network_name = getattr(env_module, "NETWORK_NAME", None)
    if isinstance(network_name, str) and network_name:
        try:
            utils_docker.ensure_network(network_name)
        except APIError as exc:
            LOG.warning("Failed to ensure Docker network %s: %s", network_name, exc)

    LOG.info("Ensuring Docker container %s is running", container_name)
    utils_docker.run_container(nginx_config)


if __name__ == "__main__":
    main()
