# Connector API (Phase 4)

This document describes the SaaS backend endpoints that the WordPress connector
plugin talks to, plus the API-key model and the connection lifecycle. It covers
**Phase 4 — WordPress Connector Plugin Foundation** only.

All routes are mounted under the API prefix (default `/api/v1`).

## Authentication models

Two distinct mechanisms are used:

| Mechanism      | Header                                   | Used by                          |
| -------------- | ---------------------------------------- | -------------------------------- |
| **JWT** (user) | `Authorization: Bearer <access_token>`   | Dashboard endpoints              |
| **Connector**  | `Authorization: Bearer <connector_key>`  | `/wp/connect`, `/wp/verify`, `/wp/disconnect` |

The connector key may alternatively be sent as `X-Connector-Key: <connector_key>`.

### Connector API key format

```
wpc_<keyId>_<secret>
  wpc      scheme (WordPress connector)
  keyId    16 lowercase hex chars — PUBLIC lookup id, stored in plaintext
  secret   base64url(32 random bytes) — only its SHA-256 hash is stored
```

- The **raw key is shown once** at generation and is never stored or returned again.
- The backend stores only: `apiKeyId` (lookup), `apiKeyHash` (SHA-256 of the
  secret), and `apiKeyPrefix` (non-secret display string).
- Verification: parse the key → look up the connection by `apiKeyId` →
  constant-time compare `sha256(secret)` against the stored hash.
- A high-entropy random secret is hashed with a single SHA-256 (not bcrypt):
  bcrypt is for low-entropy passwords; a 256-bit random token does not benefit
  from a slow KDF, and SHA-256 keeps per-request verification cheap.

## Connection lifecycle

```
disconnected ──(POST /stores/current/api-key)──▶ pending ──(POST /wp/connect)──▶ connected
      ▲                                                                              │
      └──────────────────────(POST /wp/disconnect, revokes key)─────────────────────┘
```

Regenerating a key returns the connection to `pending` and invalidates the old
key. Disconnecting clears all key material and site metadata.

---

## Dashboard endpoints (JWT)

### POST `/stores/current/api-key`

Generate (or regenerate) the connector API key for the **current** store
(resolved from the token). Requires permission `settings.edit`.

**Response `201`** — the plaintext key is returned exactly once:

```json
{
  "success": true,
  "data": {
    "apiKey": "wpc_3f9a1c7b2d4e5f60_QmFzZTY0dXJsU2VjcmV0...",
    "apiKeyPrefix": "wpc_3f9a1c7b2d4e5f60",
    "status": "pending",
    "generatedAt": "2026-06-21T12:00:00.000Z"
  },
  "message": "API key generated. Copy it now — it will not be shown again."
}
```

### GET `/wp/connection-status`

Return the current store's connection status (no secret material). Requires
permission `settings.view`.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "storeId": "…",
    "status": "connected",
    "hasApiKey": true,
    "apiKeyPrefix": "wpc_3f9a1c7b2d4e5f60",
    "apiKeyGeneratedAt": "2026-06-21T12:00:00.000Z",
    "siteUrl": "https://store.example.com",
    "wpVersion": "6.5.2",
    "wcVersion": "8.9.1",
    "connectorVersion": "0.1.0",
    "lastConnectedAt": "2026-06-21T12:01:00.000Z",
    "lastHealthCheckAt": "2026-06-21T12:05:00.000Z",
    "lastHealthStatus": "ok",
    "updatedAt": "2026-06-21T12:05:00.000Z"
  },
  "message": ""
}
```

---

## Connector endpoints (connector API key)

### POST `/wp/connect`

Called by the plugin after the user pastes a key and clicks **Connect**.
Confirms the key and records non-secret site metadata.

**Request body** (validated with Zod):

```json
{
  "siteUrl": "https://store.example.com",
  "wpVersion": "6.5.2",
  "wcVersion": "8.9.1",
  "connectorVersion": "0.1.0"
}
```

`siteUrl` is required (must be a valid URL); the version fields are optional.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "storeId": "…",
    "storeName": "My Store",
    "status": "connected",
    "connectedAt": "2026-06-21T12:01:00.000Z"
  },
  "message": "Store connected"
}
```

### POST `/wp/verify`

Lightweight credential/health check used by the plugin's **Run Health Check**
button. Records the check and echoes status.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "storeId": "…",
    "storeName": "My Store",
    "status": "connected",
    "checkedAt": "2026-06-21T12:05:00.000Z"
  },
  "message": "Connector credentials are valid"
}
```

### POST `/wp/disconnect`

Revokes the API key (clears all key material so it can never be reused) and
resets the connection to `disconnected`.

**Response `200`:**

```json
{
  "success": true,
  "data": { "status": "disconnected" },
  "message": "Store disconnected"
}
```

---

## Errors

All errors use the standard envelope. Connector auth failures return `401` with
no detail (to avoid leaking which part of the key was wrong):

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid connector API key" }
}
```

| Status | Code               | When                                            |
| ------ | ------------------ | ----------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Invalid `/wp/connect` body                      |
| 401    | `UNAUTHORIZED`     | Missing/invalid JWT or connector key            |
| 403    | `FORBIDDEN`        | JWT lacks `settings.view` / `settings.edit`     |

---

## WordPress side

The plugin exposes one REST endpoint for the SaaS to probe reachability:

### GET `/wp-json/saas/v1/health`

Public, non-sensitive. Returns plugin/connection status — never the API key.
See [`plugins/wordpress-connector/README.md`](../plugins/wordpress-connector/README.md).

## Tenant isolation

Every connector request resolves its `storeId` from the API key (not from any
client-supplied id), and every dashboard request resolves `storeId` from the
JWT. All connection rows are keyed by `storeId`, so a key or token for one store
can never read or mutate another store's connection.
