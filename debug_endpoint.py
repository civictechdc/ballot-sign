#!/usr/bin/env python3
import subprocess
import sys


def run(cmd, check=False):
    return subprocess.run(cmd, text=True, capture_output=True, check=check)


def print_filtered(output, patterns):
    import re
    regex = re.compile("|".join(patterns))
    for line in output.splitlines():
        if regex.search(line):
            print(line)


def main():
    print("=== Debugging /api/ballot/initiatives/editable-list ===\n")

    print("1. Testing with invalid token (should get 401 if auth works):")
    res = run(
        [
            "curl",
            "-v",
            "-H",
            "Authorization: Bearer invalid-token",
            "http://ballot-backend:8001/api/ballot/initiatives/editable-list",
        ]
    )
    print_filtered(
        res.stdout + res.stderr,
        ["< HTTP", "< Location", "> GET", "> Authorization", "> User-Agent"],
    )
    print()

    print("2. Testing without token:")
    res = run(
        [
            "curl",
            "-v",
            "http://ballot-backend:8001/api/ballot/initiatives/editable-list",
        ]
    )
    print_filtered(res.stdout + res.stderr, ["< HTTP", "< Location", "> GET", "> Authorization"])
    print()

    print("3. Checking Redis for initiatives:")
    res = run(["docker", "exec", "redis", "redis-cli", "SMEMBERS", "ballot:initiatives:all"])
    sys.stdout.write(res.stdout)
    if res.stderr:
        sys.stderr.write(res.stderr)
    print()

    print("4. Checking SpiceDB health:")
    res = run(
        [
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "SpiceDB HTTP Status: %{http_code}\n",
            "http://spicedb:8443/v1/schema/read",
        ]
    )
    if res.returncode == 0:
        sys.stdout.write(res.stdout)
    else:
        print("SpiceDB check failed")
    print()

    print("5. Testing the endpoint function directly in Python:")
    py = r"""
try:
    import requests

    # Test without auth against the running service inside the container network.
    print('Testing without auth:')
    resp = requests.get('http://localhost:8001/api/ballot/initiatives/editable-list', timeout=5)
    print(f'Status: {resp.status_code}')
    print(f'Response: {resp.text[:200]}')

except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
"""
    res = run(["docker", "exec", "ballot-backend", "python", "-c", py])
    sys.stdout.write(res.stdout)
    if res.stderr:
        sys.stderr.write(res.stderr)
    print()

    print("=== Debug complete ===")


if __name__ == "__main__":
    main()
