import os
from pathlib import Path

import docker_utils
import shutil

here = Path(os.path.abspath(os.path.dirname(__file__)))
webapp_dir = here
webapp_android_dir = (here / ".." / "webapp-android").resolve()
webapp_build_dir = (here / ".." / "webapp-build").resolve()
uid = os.getuid()
gid = os.getgid()
VITE_KEYCLOAK_SERVER_URL = os.getenv("VITE_KEYCLOAK_SERVER_URL", "")
VITE_KEYCLOAK_CLIENT_ID = os.getenv("VITE_KEYCLOAK_CLIENT_ID", "")


def run(NETWORK_NAME):
    os.makedirs(webapp_build_dir, exist_ok=True)
    os.makedirs(webapp_android_dir, exist_ok=True)
    os.makedirs(os.path.join(webapp_build_dir, "node_modules"), exist_ok=True)
    os.makedirs(os.path.join(webapp_android_dir, "node_modules"), exist_ok=True)
    os.makedirs(os.path.join(webapp_dir, ".gradle"), exist_ok=True)

    webapp_build = dict(
        image="node:23",
        detach=True,  # Runs the container in detached mode
        name=f"webapp_build",
        network=NETWORK_NAME,
        restart_policy={"Name": "no"},
        volumes={
            webapp_dir: {"bind": "/usr/src/app", "mode": "rw"},
            webapp_build_dir: {"bind": "/usr/src/app/dist", "mode": "rw"},
            webapp_android_dir: {"bind": "/usr/src/app/android", "mode": "rw"},
            "webapp_build_node_modules": {"bind": "/usr/src/app/node_modules", "mode": "rw"},
            # "dist_volume": {"bind": "/usr/src/app/dist", "mode": "rw"},
        },
        working_dir="/usr/src/app",
        environment={
            "NODE_ENV": "development",
            "HOST_UID": str(uid),
            "HOST_GID": str(gid),
        },
        command=(
            "sh -c '"
            "cd /usr/src/app && "
            "npm install && "
            "npm run build --verbose && "
            "if [ ! -d android ]; then npx cap add android; fi && "
            "npx cap sync android && "
            "chown -R ${HOST_UID}:${HOST_GID} /usr/src/app/android'"
        ),
    )

    webapp_android_build = dict(
        image="ghcr.io/cirruslabs/android-sdk:34",
        detach=True,
        name="webapp_android_build",
        network=NETWORK_NAME,
        restart_policy={"Name": "no"},
        volumes={
            webapp_dir: {"bind": "/usr/src/app", "mode": "rw"},
            webapp_android_dir: {"bind": "/usr/src/app/android", "mode": "rw"},
            os.path.join(webapp_dir, ".gradle"): {"bind": "/root/.gradle", "mode": "rw"},
            os.path.join(webapp_android_dir, "node_modules"): {
                "bind": "/usr/src/app/node_modules",
                "mode": "rw",
            },
        },
        working_dir="/usr/src/app/android",
        command=(
            "sh -c '"
            "KEYSTORE_PROPS=/usr/src/app/android/keystore.properties && "
            "if [ ! -f \"$KEYSTORE_PROPS\" ]; then "
            "mkdir -p /usr/src/app/android/keystore && "
            "STORE_PASS=$(od -An -N16 -tx1 /dev/urandom | tr -d \" \\n\") && "
            "KEY_PASS=$STORE_PASS && "
            "KEY_ALIAS=arkavo-release && "
            "KEYSTORE_PATH=/usr/src/app/android/keystore/arkavo-release.jks && "
            "keytool -genkeypair -v "
            "-keystore \"$KEYSTORE_PATH\" "
            "-alias \"$KEY_ALIAS\" "
            "-keyalg RSA -keysize 2048 -validity 10000 "
            "-storepass \"$STORE_PASS\" -keypass \"$KEY_PASS\" "
            "-dname \"CN=Arkavo, OU=Arkavo, O=Arkavo, L=Unknown, S=Unknown, C=US\" && "
            "printf \"storeFile=%s\\nstorePassword=%s\\nkeyAlias=%s\\nkeyPassword=%s\\n\" "
            "\"$KEYSTORE_PATH\" \"$STORE_PASS\" \"$KEY_ALIAS\" \"$KEY_PASS\" > \"$KEYSTORE_PROPS\" && "
            "chmod 600 \"$KEYSTORE_PROPS\"; "
            "fi && "
            "./gradlew clean --no-daemon --no-parallel && "
            "./gradlew assembleRelease --no-daemon --no-parallel && "
            "./gradlew assembleDebug --no-daemon --no-parallel && "
            "APK_PATH=app/build/outputs/apk/release/app-release.apk && "
            "if [ ! -f \"$APK_PATH\" ]; then echo \"Missing APK at $APK_PATH\"; exit 1; fi && "
            "DEBUG_APK_PATH=app/build/outputs/apk/debug/app-debug.apk && "
            "if [ ! -f \"$DEBUG_APK_PATH\" ]; then echo \"Missing APK at $DEBUG_APK_PATH\"; exit 1; fi && "
            "APKSIGNER=\"$ANDROID_SDK_ROOT/build-tools/$(ls $ANDROID_SDK_ROOT/build-tools | sort -V | tail -n1)/apksigner\" && "
            "\"$APKSIGNER\" verify --verbose \"$APK_PATH\"'"
        ),
    )

    webapp = dict(
        image="node:23",
        detach=True,  # Runs the container in detached mode
        name=f"webapp",
        network=NETWORK_NAME,
        restart_policy={"Name": "always"},
        volumes={
            webapp_dir: {"bind": "/usr/src/app", "mode": "rw"},
            # Keep node_modules in a Docker volume to avoid EOVERFLOW on shared mounts.
            "webapp_node_modules": {"bind": "/usr/src/app/node_modules", "mode": "rw"},
        },
        working_dir="/usr/src/app",
        environment={
            "NODE_ENV": "development",
            "SPICE_SERVER_URL": VITE_KEYCLOAK_SERVER_URL,
            "PIDP_SERVER_URL": VITE_KEYCLOAK_CLIENT_ID,
            "CHOKIDAR_USEPOLLING": "1",
            "CHOKIDAR_INTERVAL": "200",
        },
        command=(
            'sh -c "'
            "cd /usr/src/app && "
            "npm install && "
            "npm install -g nodemon && "
            "nodemon -L --watch src --watch index.html --watch vite.config.ts --exec 'npm run dev -- --host 0.0.0.0 --port 5173'\""
        ),
        # user=uid,
        # group_add=[gid],
    )

    docker_utils.run_container(webapp)
    docker_utils.run_container(webapp_build)
    docker_utils.run_container(webapp_android_build)
