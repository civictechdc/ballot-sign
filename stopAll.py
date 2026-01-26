#!/usr/bin/env python3
"""
stopAll.py

Stop all running Docker containers except database-ish ones
like redis/postgres/etc.

Overrides via env vars:
  KEEP_KEYWORDS: comma-separated keywords to keep (case-insensitive)
"""

import argparse
import os
import shutil
import subprocess
import sys


def sh(cmd, *, check=True, capture=False):
    if capture:
        return subprocess.run(cmd, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return subprocess.run(cmd, check=check)


def need(binary: str):
    if shutil.which(binary) is None:
        print(f"ERROR: Missing required command: {binary}", file=sys.stderr)
        sys.exit(1)


def get_keep_keywords() -> list[str]:
    env = os.getenv("KEEP_KEYWORDS")
    if env:
        return [k.strip().lower() for k in env.split(",") if k.strip()]
    return [
        "redis",
        "postgres",
        "postgis",
        "mysql",
        "mariadb",
        "mongo",
        "mssql",
        "oracle",
        "cockroach",
        "spicedb-postgres",
        "minio",
        "db",
        "database",
    ]


def should_keep(name: str, image: str, keep_keywords: list[str]) -> bool:
    haystack = f"{name} {image}".lower()
    return any(keyword in haystack for keyword in keep_keywords)


def list_running_containers() -> list[tuple[str, str, str]]:
    r = sh(["docker", "ps", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}"], capture=True)
    containers = []
    for line in r.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        containers.append((parts[0], parts[1], parts[2]))
    return containers


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stop Docker containers.")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Stop all running containers, including databases.",
    )
    return parser.parse_args()


def main():
    need("docker")
    args = parse_args()
    keep_keywords = get_keep_keywords()
    containers = list_running_containers()

    to_stop = []
    for cid, name, image in containers:
        if not args.all and should_keep(name, image, keep_keywords):
            continue
        to_stop.append((cid, name))

    if not to_stop:
        print("No containers to stop.")
        return

    print("Stopping containers:")
    for _, name in to_stop:
        print(f"  - {name}")

    sh(["docker", "stop"] + [cid for cid, _ in to_stop], check=False)


if __name__ == "__main__":
    main()
