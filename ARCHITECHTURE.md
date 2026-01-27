# Architecture

This document summarizes the services created by `run.py` and how they connect.

## Services (from `run.py`)

- **nginx** (`nginx:latest`)
  - Terminates TLS, routes `/dev`, `/pidp`, `/api/ballot`, `/s3`, `/minio`, `/spicedb`.
  - Serves static build from `webapp-build/`.
- **webapp** (`node:23`)
  - Vite dev server on `:5173` (proxied via nginx `/dev`).
- **webapp_build** (`node:23`)
  - Builds production bundle to `webapp-build/`.
- **webapp_android_build** (`ghcr.io/cirruslabs/android-sdk:34`)
  - Builds Android APKs via Capacitor/Gradle.
- **PIdP** (`pidp`)
  - Identity/auth service (FastAPI).
- **PIdP Postgres** (`postgres:15-alpine`)
  - Database for PIdP.
- **redis** (`redis:7-alpine`)
  - Ballot backend storage (initiatives, signatures, votes, comments).
- **minio** (`minio/minio:latest`)
  - Object storage (avatars, uploads).
- **spicedb-postgres** (`postgres:15-alpine`)
  - Datastore for SpiceDB.
- **spicedb-migrate** (`authzed/spicedb:latest`)
  - One-shot migration job for SpiceDB.
- **spicedb** (`authzed/spicedb:latest`)
  - Authorization service (relationships/permissions).
- **ballot-backend** (`ballot-backend`)
  - API for initiatives, signatures, votes, comments, admin actions.

## Mermaid Diagram

```mermaid
flowchart LR
  subgraph Client
    Browser[Browser]
  end

  subgraph Edge
    NGINX[nginx]
  end

  subgraph Web
    WEBAPP[webapp dev (Vite)]
    WEB_BUILD[webapp_build]
    ANDROID[webapp_android_build]
  end

  subgraph Identity
    PIDP[PIdP]
    PIDP_DB[(PIdP Postgres)]
  end

  subgraph Storage
    REDIS[(Redis)]
    MINIO[(MinIO)]
  end

  subgraph AuthZ
    SPICE_DB[(SpiceDB Postgres)]
    SPICE_MIGRATE[spicedb-migrate]
    SPICE[SpiceDB]
  end

  subgraph Backend
    BALLOT[ballot-backend]
  end

  Browser -->|HTTPS| NGINX
  NGINX -->|/dev| WEBAPP
  NGINX -->|/| WEB_BUILD
  NGINX -->|/pidp| PIDP
  NGINX -->|/api/ballot| BALLOT
  NGINX -->|/s3| MINIO
  NGINX -->|/spicedb| SPICE

  WEBAPP --> PIDP
  WEBAPP --> BALLOT

  PIDP --> PIDP_DB
  PIDP --> MINIO

  BALLOT --> REDIS
  BALLOT --> PIDP
  BALLOT --> SPICE

  SPICE --> SPICE_DB
  SPICE_MIGRATE --> SPICE_DB
```

