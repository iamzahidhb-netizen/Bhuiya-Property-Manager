# Cloudflare R2 staging setup

This guide is for a **separate staging environment only**. The private R2 bucket, bucket-scoped credentials, and exact-origin CORS are configured, and the staging health check has succeeded. Do not copy staging values into production or enable public bucket access.

## Cloudflare Pages bindings

The R2 bucket is already created, the non-secret account/bucket identifiers are already stored as server-side bindings, and the current Worker build has been deployed to the **production environment of the `bhuiya-property-staging` Pages project only**. Do not put R2 credentials in a `VITE_*` variable, the frontend `.env` files, source control, or client code.

| Binding | Type | Value |
|---|---|---|
| `R2_ACCOUNT_ID` | Configured Pages secret | `dc2a7e851076e63d1c882a2670472d2a` |
| `R2_BUCKET_NAME` | Configured Pages secret | `bhuiya-property-manager-staging` |
| `R2_S3_ENDPOINT` | Optional variable | Leave unset to use `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`; otherwise use a credential-free HTTPS endpoint |
| `R2_ACCESS_KEY_ID` | Encrypted secret | Bucket-scoped R2 S3 access key |
| `R2_SECRET_ACCESS_KEY` | Encrypted secret | Matching R2 S3 secret |

The existing `EXECUTION_MODE`, `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_KEY` settings are already configured on the staging Pages project; do not replace them. The encrypted `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` values are bucket-scoped Object Read & Write S3 credentials for `bhuiya-property-manager-staging`. The authenticated staging health check now succeeds. Do not use an account-wide admin token, production Firebase service account, or production R2 key. Never paste either key into chat.

## Bucket privacy and browser CORS

Keep the staging bucket private; do not enable public development URLs. Configure the bucket's CORS policy to allow only the exact deployed staging application origin(s) that need direct browser uploads and downloads. Avoid `*` and broad preview-domain patterns. The Android Capacitor app uploads directly to R2, so the exact `https://localhost` WebView origin must remain in the allow-list.

The staging bucket created for this integration is `bhuiya-property-manager-staging`. Its CORS rule is in [r2-staging-cors.json](./r2-staging-cors.json) and allows the staging Pages origin plus `https://localhost`, the Android Capacitor WebView origin configured by `androidScheme: "https"`.

The browser uses `PUT` for uploads and `GET` for signed downloads. Permit these request headers:

- `Content-Type`
- `x-amz-checksum-sha256`
- `x-amz-meta-sha256`

The upload signature binds the content type, SHA-256 checksum, and metadata hash. Do not remove those headers from the CORS allow-list or client request. The Cloudflare Worker has a separate CORS allow-list; a successful Worker preflight does not replace the bucket CORS configuration.

## Staging verification checklist

The authenticated staging health check is confirmed. Before using real documents, finish these staging-only checks:

1. Confirm the deployment targets `bhuiya-property-staging` and the staging Firebase project.
2. Confirm the R2 bucket CORS allow-list includes both `https://bhuiya-property-staging.pages.dev` and `https://localhost`; missing the latter causes Android's direct PUT to appear as a network error.
3. Authenticate as a staging workspace member and call `/api/storage/health`; confirm the Worker can reach the private bucket.
4. Upload a harmless test PDF or image under a staging property. Confirm the browser or Android R2 `PUT` preflight succeeds, the upload completes, and Firestore metadata is marked active only after object verification.
5. Preview and download the file through the app; confirm the returned URL is short-lived and the bucket remains private.
6. Verify an unsupported MIME type, a file over 25 MiB, a viewer upload, a cross-workspace read, a mismatched object checksum, and a disallowed browser origin are rejected.
7. Delete the test record and object, and verify the corresponding audit event.
8. Test retrying completion and recovering an upload interrupted between object PUT and metadata completion.

Use staging-only sample data. Do not upload real tenant identity documents, payment records, or production backups during initial verification. The local test suite exercises mocked Worker routes and the AWS SDK signer; it does not substitute for a real R2 staging test.

## Current status

Created the private `bhuiya-property-manager-staging` bucket and exact-origin CORS rule in [r2-staging-cors.json](./r2-staging-cors.json). The staging Pages project has the correct encrypted bucket-scoped S3 credentials, and the authenticated `/api/storage/health` check reports R2 active after deployment `78d4663b`. `.env.staging` targets the staging API. No R2 test file has been uploaded yet; complete the upload/download/delete checks above using harmless staging-only data before real documents. The `iamzahid` production project and its live Worker were not changed. Existing files in external accounts were not modified.
