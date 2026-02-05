#!/usr/bin/env python3
"""
Initialize temporary keys for local development with all necessary subdomains.

This script replaces init-temp-keys.sh and generates certificates that include
all subdomains discovered from env.py (e.g., keycloak.localhost, opentdf.localhost, etc.)
"""

import os
import sys
import subprocess
import re
from pathlib import Path
from typing import Dict, Set
import argparse

# Ensure we can import editme.py and env.py
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Pattern to capture assignments like `KEYCLOAK_BASE_URL = "keycloak." + BACKEND_LOCATION`
SUBDOMAIN_PATTERN = re.compile(
    r'=\s*"(?P<prefix>[\w-]+)\."\s*\+\s*(?P<base>BACKEND_LOCATION|GPU_BACKEND_LOCATION|USER_WEBSITE)',
    re.IGNORECASE,
)


def discover_subdomains(env_path: Path) -> Dict[str, Set[str]]:
    """Return the host prefixes discovered in env.py, grouped by base constant."""
    prefixes: Dict[str, Set[str]] = {}
    
    try:
        with env_path.open("r", encoding="utf-8") as env_file:
            for line in env_file:
                match = SUBDOMAIN_PATTERN.search(line)
                if match:
                    base = match.group("base").upper()
                    prefix = match.group("prefix")
                    if base not in prefixes:
                        prefixes[base] = set()
                    prefixes[base].add(prefix)
    except FileNotFoundError:
        print(f"Warning: env.py not found at {env_path}; only localhost will be used")
    
    return prefixes


def build_domain_list(backend_location: str, user_website: str, prefixes: Dict[str, Set[str]]) -> list:
    """Build list of domains to include in certificates."""
    domains = set()
    
    # Always include localhost and 127.0.0.1
    domains.add("localhost")
    domains.add("127.0.0.1")
    
    # Add the main backend location
    if backend_location:
        domains.add(backend_location)
    
    # Add the user website
    if user_website:
        domains.add(user_website)
    
    # Add all discovered subdomains
    for base, prefix_set in prefixes.items():
        base_value = backend_location if base == "BACKEND_LOCATION" else user_website
        if base_value:
            for prefix in prefix_set:
                domains.add(f"{prefix}.{base_value}")
    
    return sorted(domains)


def run_openssl_command(cmd: list, description: str = ""):
    """Run an openssl command with error handling."""
    if description:
        print(f"{description}...")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {' '.join(cmd)}")
        print(f"stderr: {e.stderr}")
        raise


def generate_kas_certificates(output_dir: Path):
    """Generate KAS RSA and EC certificates."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate KAS RSA certificate
    run_openssl_command([
        "openssl", "req", "-x509", "-nodes", "-newkey", "RSA:2048", "-subj", "/CN=kas",
        "-keyout", str(output_dir / "kas-private.pem"),
        "-out", str(output_dir / "kas-cert.pem"),
        "-days", "365"
    ], "Generating KAS RSA certificate")
    
    # Generate EC parameters
    with open("ecparams.tmp", "w") as f:
        subprocess.run(["openssl", "ecparam", "-name", "prime256v1"], stdout=f, check=True)
    
    # Generate KAS EC certificate
    run_openssl_command([
        "openssl", "req", "-x509", "-nodes", "-newkey", "ec:ecparams.tmp", "-subj", "/CN=kas",
        "-keyout", str(output_dir / "kas-ec-private.pem"),
        "-out", str(output_dir / "kas-ec-cert.pem"),
        "-days", "365"
    ], "Generating KAS EC certificate")

    # Ensure files are readable by containers running as non-root.
    for filename in ("kas-private.pem", "kas-ec-private.pem", "kas-cert.pem", "kas-ec-cert.pem"):
        path = output_dir / filename
        if path.exists():
            path.chmod(0o644)

    # Clean up temporary file
    if os.path.exists("ecparams.tmp"):
        os.remove("ecparams.tmp")


def generate_keycloak_ca_and_certs(keys_dir: Path, domains: list):
    """Generate Keycloak CA and signed certificates for all domains."""
    keys_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate Keycloak CA certificate
    run_openssl_command([
        "openssl", "req", "-x509", "-nodes", "-newkey", "RSA:2048", "-subj", "/CN=ca",
        "-addext", "basicConstraints=CA:TRUE",
        "-addext", "keyUsage=keyCertSign,cRLSign",
        "-keyout", str(keys_dir / "keycloak-ca-private.pem"),
        "-out", str(keys_dir / "keycloak-ca.pem"),
        "-days", "365"
    ], "Generating Keycloak CA certificate")
    
    # Create SAN configuration
    san_entries = []
    for domain in domains:
        if domain.replace('.', '').isdigit():  # IP address
            san_entries.append(f"IP:{domain}")
        else:  # DNS name
            san_entries.append(f"DNS:{domain}")
    
    san_conf = f"subjectAltName={','.join(san_entries)}"
    
    # Create OpenSSL configuration file
    req_conf_content = """[req]
distinguished_name=req_distinguished_name
[req_distinguished_name]
[alt_names]
"""
    for i, domain in enumerate(domains, 1):
        if domain.replace('.', '').isdigit():  # IP address
            req_conf_content += f"IP.{i}={domain}\n"
        else:  # DNS name
            req_conf_content += f"DNS.{i}={domain}\n"
    
    req_conf_path = keys_dir / "req.conf"
    with open(req_conf_path, "w") as f:
        f.write(req_conf_content)
    
    # Generate localhost certificate request
    run_openssl_command([
        "openssl", "req", "-new", "-nodes", "-newkey", "rsa:2048",
        "-keyout", str(keys_dir / "localhost.key"),
        "-out", str(keys_dir / "localhost.req"),
        "-batch", "-subj", "/CN=localhost",
        "-config", str(req_conf_path)
    ], "Generating localhost certificate request")
    
    # Write SAN configuration to file
    san_conf_path = keys_dir / "sanX509.conf"
    with open(san_conf_path, "w") as f:
        f.write(san_conf)
    
    # Sign localhost certificate (using the SAN config file)
    run_openssl_command([
        "openssl", "x509", "-req", "-in", str(keys_dir / "localhost.req"),
        "-CA", str(keys_dir / "keycloak-ca.pem"),
        "-CAkey", str(keys_dir / "keycloak-ca-private.pem"),
        "-CAcreateserial",
        "-out", str(keys_dir / "localhost.crt"),
        "-days", "3650", "-sha256",
        "-extfile", str(san_conf_path)
    ], "Signing localhost certificate")
    
    # Generate sample user certificate request
    run_openssl_command([
        "openssl", "req", "-new", "-nodes", "-newkey", "rsa:2048",
        "-keyout", str(keys_dir / "sampleuser.key"),
        "-out", str(keys_dir / "sampleuser.req"),
        "-batch", "-subj", "/CN=sampleuser"
    ], "Generating sample user certificate request")
    
    # Sign sample user certificate
    run_openssl_command([
        "openssl", "x509", "-req", "-in", str(keys_dir / "sampleuser.req"),
        "-CA", str(keys_dir / "keycloak-ca.pem"),
        "-CAkey", str(keys_dir / "keycloak-ca-private.pem"),
        "-CAcreateserial",
        "-out", str(keys_dir / "sampleuser.crt"),
        "-days", "3650"
    ], "Signing sample user certificate")

    # Ensure files are readable by containers running as non-root.
    for filename in (
        "keycloak-ca-private.pem",
        "keycloak-ca.pem",
        "localhost.crt",
        "localhost.key",
        "sampleuser.crt",
        "sampleuser.key",
    ):
        path = keys_dir / filename
        if path.exists():
            path.chmod(0o644)
    
    # Create PKCS12 keystore
    run_openssl_command([
        "openssl", "pkcs12", "-export",
        "-in", str(keys_dir / "keycloak-ca.pem"),
        "-inkey", str(keys_dir / "keycloak-ca-private.pem"),
        "-out", str(keys_dir / "ca.p12"),
        "-nodes", "-passout", "pass:password"
    ], "Creating PKCS12 keystore")
    
    # Convert to JKS keystore using Docker
    print("Converting to JKS keystore using Docker...")
    try:
        uid = os.getuid()
        gid = os.getgid()
        
        docker_cmd = [
            "docker", "run",
            "-v", f"{keys_dir.absolute()}:/keys",
            "--entrypoint", "keytool",
            "--user", f"{uid}:{gid}",
            "keycloak/keycloak:25.0",
            "-importkeystore",
            "-srckeystore", "/keys/ca.p12",
            "-srcstoretype", "PKCS12",
            "-destkeystore", "/keys/ca.jks",
            "-deststoretype", "JKS",
            "-srcstorepass", "password",
            "-deststorepass", "password",
            "-noprompt"
        ]
        
        subprocess.run(docker_cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Warning: Failed to convert to JKS keystore: {e}")
        print("The CA certificate is still available in PKCS12 format.")
    
    # Clean up temporary files
    for temp_file in ["localhost.req", "sampleuser.req", "req.conf", "sanX509.conf"]:
        temp_path = keys_dir / temp_file
        if temp_path.exists():
            temp_path.unlink()


def main():
    parser = argparse.ArgumentParser(description="Initialize temporary keys for local development")
    parser.add_argument("--output", "-o", default=".", help="Output directory for KAS certificates")
    parser.add_argument("--env-file", default=REPO_ROOT / "env.py", help="Path to env.py file")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose output")
    args = parser.parse_args()
    
    # Import configuration from editme.py
    try:
        from editme import BACKEND_LOCATION, USER_WEBSITE
    except ImportError:
        print("Warning: Could not import editme.py, using defaults")
        BACKEND_LOCATION = "localhost"
        USER_WEBSITE = "localhost"
    
    # Discover subdomains from env.py
    env_path = Path(args.env_file)
    prefixes = discover_subdomains(env_path)
    
    # Build domain list
    domains = build_domain_list(BACKEND_LOCATION, USER_WEBSITE, prefixes)
    
    if args.verbose:
        print(f"Discovered subdomains: {prefixes}")
        print(f"Domains to include in certificates: {domains}")
    
    # Set environment variables for entropy
    os.environ["RANDFILE"] = "/dev/urandom"
    os.environ["OPENSSL_CONF"] = "/dev/null"
    
    # Generate certificates
    output_dir = Path(args.output)
    keys_dir = Path("keys")
    
    try:
        generate_kas_certificates(output_dir)
        generate_keycloak_ca_and_certs(keys_dir, domains)
        
        print("\nCertificate generation completed successfully!")
        print(f"KAS certificates saved to: {output_dir.absolute()}")
        print(f"Keycloak certificates saved to: {keys_dir.absolute()}")
        print(f"\nCertificates include the following domains:")
        for domain in domains:
            print(f"  - {domain}")
            
    except Exception as e:
        print(f"\nError generating certificates: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
