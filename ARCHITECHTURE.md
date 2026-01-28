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
  subgraph Client["Client"]
    Browser["Browser"]
  end

  subgraph Edge["Edge"]
    NGINX["nginx"]
  end

  subgraph Web["Web"]
    WEBAPP["webapp dev (Vite)"]
    WEB_BUILD["webapp_build"]
    ANDROID["webapp_android_build"]
  end

  subgraph Identity["Identity"]
    PIDP["PIdP"]
    PIDP_DB[("PIdP Postgres")]
  end

  subgraph Storage["Storage"]
    REDIS[("Redis")]
    MINIO[("MinIO")]
  end

  subgraph AuthZ["AuthZ"]
    SPICE_DB[("SpiceDB Postgres")]
    SPICE_MIGRATE["spicedb-migrate"]
    SPICE["SpiceDB"]
  end

  subgraph Backend["Backend"]
    BALLOT["ballot-backend"]
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

  classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000
  classDef edge fill:#fff3e0,stroke:#e65100,stroke-width:3px,color:#000
  classDef web fill:#f3e5f5,stroke:#4a148c,stroke-width:3px,color:#000
  classDef identity fill:#e8f5e8,stroke:#1b5e20,stroke-width:3px,color:#000
  classDef backend fill:#fff8e1,stroke:#ff6f00,stroke-width:3px,color:#000
  classDef storage fill:#e0f2f1,stroke:#004d40,stroke-width:3px,color:#000
  classDef authz fill:#fce4ec,stroke:#880e4f,stroke-width:3px,color:#000

  class Client client
  class Edge edge
  class Web web
  class Identity identity
  class Storage storage
  class AuthZ authz
  class Backend backend
```

