#!/usr/bin/env bash
set -euo pipefail

BASHRC="${HOME}/.bashrc"
VENV_DIR="${HOME}/global"

BLOCK_START="# --- Auto-activate global Python venv at ~/global ---"
BLOCK_END="# --- End auto-activate global Python venv ---"

BLOCK_CONTENT="$(cat <<'EOF'
# --- Auto-activate global Python venv at ~/global ---
VENV_DIR="$HOME/global"
SYSTEM_PYTHON="$(command -v python3)"

# Only run this in interactive shells
if [[ $- == *i* ]]; then
  # Create venv once if it doesn't exist (skip pip; we'll seed it manually)
  if [[ ! -d "$VENV_DIR" ]] || [[ ! -f "$VENV_DIR/bin/activate" ]]; then
    python3 -m venv --without-pip "$VENV_DIR" >/dev/null 2>&1 || true
  fi

  # Auto-activate unless disabled, and don't re-activate if already in a venv
  if [[ -z "${VIRTUAL_ENV:-}" ]] && [[ -z "${VIRTUAL_ENV_DISABLE:-}" ]] && [[ -f "$VENV_DIR/bin/activate" ]]; then
    source "$VENV_DIR/bin/activate"

    # Critical: clear bash's command-path cache so `pip` resolves to the venv
    hash -r

    # Seed pip/wheel from system Python if ensurepip is unavailable
    if ! python -m pip -V >/dev/null 2>&1; then
      PURELIB="$("$VENV_DIR/bin/python" - <<'PY'
import sysconfig
print(sysconfig.get_paths()["purelib"])
PY
)"
      if [[ -n "$SYSTEM_PYTHON" ]]; then
        "$SYSTEM_PYTHON" - <<'PY' "$PURELIB"
import importlib.util, pathlib, shutil, sys
target = pathlib.Path(sys.argv[1])
for name in ["pip", "wheel"]:
    spec = importlib.util.find_spec(name)
    if not spec or not spec.origin:
        continue
    src = pathlib.Path(spec.origin).parent
    dist_infos = list(src.parent.glob(f"{name}-*.dist-info"))
    shutil.copytree(src, target / name, dirs_exist_ok=True)
    for dist in dist_infos:
        shutil.copytree(dist, target / dist.name, dirs_exist_ok=True)
PY
      fi
    fi

    python -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || true

    # Make `pip` always use this venv (prevents PEP 668 system pip errors)
    alias pip='python -m pip'
    alias pip3='python -m pip'
  fi
fi
# --- End auto-activate global Python venv ---
EOF
)"

# Ensure ~/.bashrc exists
touch "$BASHRC"

# Backup
BACKUP="${BASHRC}.bak.$(date +%Y%m%d_%H%M%S)"
cp -f "$BASHRC" "$BACKUP"

# Remove any existing copy of the block (idempotent)
tmp="$(mktemp)"
awk -v start="$BLOCK_START" -v end="$BLOCK_END" '
  $0 == start {inblock=1; next}
  $0 == end   {inblock=0; next}
  !inblock {print}
' "$BASHRC" > "$tmp"
cat "$tmp" > "$BASHRC"
rm -f "$tmp"

# Append the new block
printf "\n%s\n" "$BLOCK_CONTENT" >> "$BASHRC"

SYSTEM_PYTHON="$(command -v python3 || true)"

# Create/repair the venv now + seed pip (best effort)
if [[ ! -d "$VENV_DIR" ]] || [[ ! -f "$VENV_DIR/bin/activate" ]]; then
  python3 -m venv --without-pip "$VENV_DIR" || true
fi
if [[ -x "$VENV_DIR/bin/python" ]]; then
  # If pip is missing (common on Debian without python3-venv), copy it from the system site-packages
  if ! "$VENV_DIR/bin/python" -m pip -V >/dev/null 2>&1; then
    PURELIB="$("$VENV_DIR/bin/python" - <<'PY'
import sysconfig
print(sysconfig.get_paths()["purelib"])
PY
)"
    if [[ -n "$SYSTEM_PYTHON" ]]; then
      "$SYSTEM_PYTHON" - <<'PY' "$PURELIB"
import importlib.util, pathlib, shutil, sys
target = pathlib.Path(sys.argv[1])
for name in ["pip", "wheel"]:
    spec = importlib.util.find_spec(name)
    if not spec or not spec.origin:
        continue
    src = pathlib.Path(spec.origin).parent
    dist_infos = list(src.parent.glob(f"{name}-*.dist-info"))
    shutil.copytree(src, target / name, dirs_exist_ok=True)
    for dist in dist_infos:
        shutil.copytree(dist, target / dist.name, dirs_exist_ok=True)
PY
    fi
  fi

  "$VENV_DIR/bin/python" -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || true
fi

cat <<MSG

✅ Installed auto-venv block into: $BASHRC
✅ Venv location: $VENV_DIR
✅ Backup saved as: $BACKUP

Apply now:
  source "$BASHRC"
  hash -r

Verify you're using the venv pip:
  which python
  python -m pip -V
  which pip
  pip -V

Disable for one session:
  VIRTUAL_ENV_DISABLE=1 bash

MSG
