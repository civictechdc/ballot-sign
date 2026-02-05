# Access Plan

## Goals
- Store initiatives in the ballot backend (Redis-backed API).
- Enforce collaborator access via SpiceDB using PIdP user IDs.
- Keep PIdP as the source of identity (user id from `/auth/me`).

## Identity
- **Source:** PIdP `/auth/me` using the bearer token from the web app.
- **User ID:** PIdP `id` (UUID string) becomes the SpiceDB subject id and the `created_by` field.

## SpiceDB Schema (proposed)
```
definition user {}

definition initiative {
  relation owner: user
  relation collaborator: user

  permission manage = owner
  permission edit = owner + collaborator
  permission view = owner + collaborator
}

definition comment {
  relation author: user
  relation initiative: initiative

  permission manage = initiative->manage
  permission edit = author + initiative->manage
  permission delete = author + initiative->manage
  permission view = initiative->view
}
```

## Access Rules
- **Create initiative**
  - Requires a valid PIdP token.
  - Creator becomes `owner` in SpiceDB.
  - Optional collaborators become `collaborator` relations.
- **Edit initiative (future)**
  - Allowed if SpiceDB `edit` is true.
- **Manage collaborators**
  - Allowed if SpiceDB `manage` is true (owner only).
- **Delete initiative**
  - Allowed if SpiceDB `manage` is true or the user email is listed in `MODERATOR_EMAILS`.

## Storage (ballot backend / Redis)
- Initiatives stored at `ballot:initiative:{id}`.
- `collaborators` stored as a JSON list of PIdP user IDs.
- `created_by` stored as the PIdP user ID.
- Comments stored at `ballot:comment:{id}`.
- Comment IDs stored at `ballot:initiative:{id}:comments`.

## API Flow
1. Web app sends `Authorization: Bearer <pidp_token>` to `POST /api/ballot/initiatives`.
2. Backend calls `PIdP /auth/me` to resolve user id/email.
3. Backend resolves collaborator emails to PIdP user IDs (if provided).
4. Backend writes initiative data to Redis.
5. Backend writes SpiceDB relationships:
   - `initiative:{id}#owner@user:{creator_id}`
   - `initiative:{id}#collaborator@user:{collaborator_id}`
6. Backend returns the initiative payload.

## Comments Flow
1. Web app sends `Authorization: Bearer <pidp_token>` to
   `POST /api/ballot/initiatives/{id}/comments`.
2. Backend writes comment data to Redis.
3. Backend writes SpiceDB relationships:
   - `comment:{id}#author@user:{author_id}`
   - `comment:{id}#initiative@initiative:{initiative_id}`
4. Edit/delete requires `comment#edit` / `comment#delete` permissions.

## Manage Collaborators Flow
1. Web app sends `Authorization: Bearer <pidp_token>` to
   `PUT /api/ballot/initiatives/{id}/collaborators`.
2. Backend checks `manage` permission in SpiceDB.
3. Backend replaces collaborator list in Redis and touches SpiceDB relations.

## Configuration
- `PIDP_BASE_URL` (default `http://pidp:8000`)
- `SPICEDB_HTTP_URL` (default `http://spicedb:8443`)
- `SPICEDB_PRESHARED_KEY` (default `dev-spicedb-key`)

## Additional Endpoints
- `GET /auth/users?email=` (PIdP) for collaborator email lookup.

## Schema Loading
- Ballot backend loads the SpiceDB schema on startup via `/v1/schema/write`.

## Follow-ups
- Add collaborator removal with `OPERATION_DELETE` (currently only `TOUCH`).
- Add audit logging for collaborator changes.
