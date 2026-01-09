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

Sanity checks:

- `index.html` must exist at the bucket root (object key exactly `index.html`, not `dist/index.html`).
- With OAC, the bucket policy must allow the specific CloudFront distribution to read objects (`s3:GetObject`).

## CloudFront distribution

Recommended configuration:

- Origin: the S3 bucket
- Use **Origin Access Control (OAC)** so the bucket stays private
- Default root object: `index.html` (this is what makes `/` serve the app)

### SPA routing

React Router requires “rewrite to index.html” behavior.

If this is not configured, you’ll commonly see:

- `/` returning an S3 XML error like `<Code>AccessDenied</Code>` (CloudFront requested the empty key `/` from the S3 REST origin)
- deep links like `/initiatives/some-slug` returning the same error (S3 doesn’t have a physical object at that key)

Two common approaches:

1) **CloudFront Function (recommended)**: rewrite any request that does not look like an asset to `/index.html`.

2) **Custom error responses (simplest)**:

#### Option A: Custom error responses (quickest to set up)

In the CloudFront distribution:

1. Go to **Error pages** → **Create custom error response**
2. Add **403**:
   - Customize error response: **Yes**
   - Response page path: `/index.html`
   - HTTP response code: **200**
   - Error caching minimum TTL: **0** (or a very small value while iterating)
3. Add **404** with the same settings.

Why 403 *and* 404?

- With a private bucket + OAC, S3 frequently returns **403** for missing keys.

#### Option B: CloudFront Function rewrite (best UX)

This keeps the original deep-link URL in the browser (no redirect), but serves `index.html` so React Router can take over.

1. CloudFront → **Functions** → **Create function**
2. Runtime: **cloudfront-js-1.0**
3. Use this function code:

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Default root object handling for directory paths.
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

  // If the URI has a file extension (e.g. .js, .css, .png), leave it alone.
  if (uri.includes('.')) {
    return request;
  }

  // Otherwise, it's a client-side route: serve the SPA entry.
  request.uri = '/index.html';
  return request;
}
```

4. **Publish** the function.
   - Note: CloudFront won’t let you associate a function to a behavior until it has been published.
5. Attach the function to the distribution’s **default (*) behavior** under **Function associations**:
   - Event type: **Viewer request**

Notes:

- If you use Option B, you typically do **not** need the custom error response for SPA routing (but keeping 403/404 → `/index.html` is still a safe fallback).
- The app also includes a route for `/index.html` that redirects to `/` (see [`createAppRouter()`](web/src/ui/router/createAppRouter.tsx:21)). This is normal; the key fix is making `/` serve `index.html`.

## Cache invalidation

After each deployment, invalidate:

- `/*`

If you change routing behavior (CloudFront Functions or error pages), invalidate:

- `/*` (and optionally `/index.html` explicitly)

## DNS + HTTPS

Optional but recommended:

- Use Route 53 + ACM certificate
- Attach the ACM cert to CloudFront

## Update log

- 2026-01-01: Initial AWS static deployment guide created.
- 2026-01-09: Documented CloudFront SPA routing fixes (403/404 → `/index.html` and CloudFront Function rewrite).
