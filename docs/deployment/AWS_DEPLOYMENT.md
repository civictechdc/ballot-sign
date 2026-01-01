# AWS deployment (static demo)

This document describes the simplest production-like deployment for the **frontend demo**: Vite build deployed to **S3 + CloudFront**.

## Build

From the repository root:

1. `cd web`
2. `npm install`
3. `npm run build`

The output will be in `web/dist/`.

## S3 bucket

1. Create an S3 bucket (e.g., `ballot-sign-demo-web`).
2. Block public access ON.
3. Upload the contents of `web/dist/` to the bucket.

## CloudFront distribution

Recommended configuration:

- Origin: the S3 bucket
- Use **Origin Access Control (OAC)** so the bucket stays private
- Default root object: `index.html`

### SPA routing

React Router requires “rewrite to index.html” behavior.

Two common approaches:

1) CloudFront Function (recommended): rewrite any request that does not look like an asset to `/index.html`.

2) Custom error response:
- On 403/404, respond with `/index.html` and HTTP 200

## Cache invalidation

After each deployment, invalidate:

- `/*`

## DNS + HTTPS

Optional but recommended:

- Use Route 53 + ACM certificate
- Attach the ACM cert to CloudFront

## Update log

- 2026-01-01: Initial AWS static deployment guide created.
