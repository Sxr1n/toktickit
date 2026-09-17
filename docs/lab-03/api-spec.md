# Lab 3 API Specification

Related documents: specification.md · ui-spec.md · tests.md

## 1. Conventions

- Identity travels in an httpOnly, `SameSite=Lax` session cookie (`toktickit_session`) set by
  `POST /api/auth/login` and cleared by `POST /api/auth/logout`. No route reads identity from a header,
  query string, or request body.
- Every client `fetch` call sends `credentials: 'include'`. The server's CORS config sets
  `credentials: true` and an explicit origin allowlist (the Vite dev origin), not a wildcard.
- Every non-2xx response body is `{ "error": { "code": string, "message": string, "details"?: object } }`.
- Status code convention: `400` invalid input, `401` unauthenticated, `403` authenticated but forbidden
  by role, `404` not found *or* forbidden by ownership (never distinguished, matching Lab 2), `409`
  conflict, `500` unexpected server error (message never exposes stack traces or internals).
- Pagination envelope (unchanged from Lab 2): `{ data, page, pageSize, total, totalPages }`.

## 2. Authentication

### POST /api/auth/login

Request: `{ "email": string, "password": string }`

- 200 `{ id, name, email, role, mustChangePassword }` + sets the session cookie.
- 400 `VALIDATION_FAILED` — missing/malformed email or password.
- 401 `INVALID_CREDENTIALS` — wrong email, wrong password, **or** inactive account (identical body and
  status in all three cases, per BR-07/AC-06).

### POST /api/auth/logout

- 200 `{ "ok": true }`, clears/invalidates the session cookie server-side.
- 401 if called with no valid session (idempotent no-op is also acceptable and preferred; either is a
  passing implementation as long as no session survives the call).

### GET /api/auth/me

- 200 `{ id, name, email, role, mustChangePassword }` for the caller only.
- 401 `UNAUTHENTICATED` if no valid session.

### POST /api/auth/change-password

Request: `{ "currentPassword": string, "newPassword": string }`

- 200 `{ "ok": true }`, clears `mustChangePassword`.
- 400 `VALIDATION_FAILED` — `newPassword` fails the BR-08 rule set; `details` names which rule(s) failed.
- 401 `UNAUTHENTICATED`, or `INVALID_CURRENT_PASSWORD` if `currentPassword` does not match.

## 3. Requester Ticket and Attachment APIs (continued from Lab 2)

All paths, methods, request/response shapes, and status codes are **unchanged from
`docs/lab-02/api-spec.md`**, with one substitution: every route drops `requireRequester`'s
`X-Dev-Requester-Id` header check in favor of `requireAuth` + `requireRole('REQUESTER')`, and the
`requesterId` used in every `where` clause comes from `req.user.id` (the verified session), never from
any part of the request. `POST /api/tickets` additionally sets `itPriority` to the submitted
`requestedPriority` at creation time (BR-18).

### POST /api/tickets/:id/public-comments

Request: `{ "body": string }`

- 201 `{ id, ticketId, authorId, authorName, body, createdAt }`.
- 400 `VALIDATION_FAILED` — empty/whitespace-only or outside 3–2000 chars (BR-24).
- 404 — Ticket not owned by the caller (Requester) and caller is not IT Staff/Administrator.

### GET /api/tickets/:id/public-comments

- 200 `[{ id, authorId, authorName, authorRole, body, createdAt }, ...]`, oldest first.
- 404 — same ownership rule as above.

### PATCH /api/tickets/:id/confirm-resolved

Requester-only. No body.

- 200 the updated Ticket with `requesterConfirmedResolved: true`.
- 404 — not owned by the caller.

## 4. IT Staff APIs

All staff routes require `requireAuth` + `requireRole('IT_STAFF', 'ADMINISTRATOR')`; a Requester gets
403.

### GET /api/staff/tickets

Query parameters: `search` (matches Ticket Number or Summary, case-insensitive substring), `status`,
`itPriority`, `ticketOwnerId` (including the literal value `unassigned`), `sortBy`
(`createdAt|itPriority|currentStatus`, default `createdAt`), `sortDir` (`asc|desc`, default `desc`),
`page` (default 1), `pageSize` (10/20/50, default 10).

- 200 paginated envelope of
  `{ id, ticketNumber, summary, categoryName, requestedPriority, itPriority, currentStatus, ticketOwnerId, ticketOwnerName, requesterName, createdAt }`.
- 400 `VALIDATION_FAILED` — invalid `status`/`itPriority`/`sortBy`/`pageSize` value.

### GET /api/staff/tickets/:id

- 200 full Ticket detail including Requester info, Category, Related System, both priorities, status,
  Ticket Owner, existing Attachments (same shape as Lab 2's owned-detail response), Public Comments, and
  Internal Notes.
- 404 — Ticket id does not exist.

### PATCH /api/staff/tickets/:id/owner

Request: `{ "ticketOwnerId": number | null }` (`null` unassigns).

- 200 the updated Ticket.
- 400 `VALIDATION_FAILED` — `ticketOwnerId` does not reference an active IT Staff/Administrator user.
- 404 — Ticket not found.

### PATCH /api/staff/tickets/:id/it-priority

Request: `{ "itPriority": "LOW" | "MEDIUM" | "HIGH" }`

- 200 the updated Ticket.
- 400 `VALIDATION_FAILED` — invalid value.

### PATCH /api/staff/tickets/:id/status

Request: `{ "status": string }`

- 200 the updated Ticket.
- 400 `INVALID_TRANSITION` — the from→to pair is not in BR-21's matrix; `details` names both values.

### POST /api/staff/tickets/:id/internal-notes

Request: `{ "body": string }`

- 201 `{ id, ticketId, authorId, authorName, body, createdAt }`.
- 400 `VALIDATION_FAILED` — same length rule as Public Comments.

### GET /api/staff/tickets/:id/internal-notes

- 200 `[{ id, authorId, authorName, body, createdAt }, ...]`, oldest first.
- 403 if the caller resolves to role Requester (defense in depth — the route is under `/api/staff/*` and
  already gated, but this response is asserted directly by a test per AC-04).

## 5. Administrator APIs

All admin routes require `requireAuth` + `requireRole('ADMINISTRATOR')`; any other role gets 403.

### GET /api/admin/users

Query parameters: `search` (name or email, case-insensitive substring), `role` (optional exact filter).
No pagination parameter — returns the full matching list, per the labsheet's explicit exclusion of
mandatory user-list pagination.

- 200 `[{ id, name, email, role, isActive }, ...]`.

### POST /api/admin/users

Request: `{ "name": string, "email": string, "role": "REQUESTER"|"IT_STAFF"|"ADMINISTRATOR", "isActive": boolean, "initialPassword": string }`

- 201 `{ id, name, email, role, isActive, mustChangePassword: true }`.
- 400 `VALIDATION_FAILED` — missing/malformed field, or `initialPassword` fails BR-08.
- 409 `EMAIL_TAKEN` — case-insensitive duplicate.

### PATCH /api/admin/users/:id

Request (all optional, at least one required): `{ "name"?, "email"?, "role"?, "isActive"? }`

- 200 the updated user.
- 400 `VALIDATION_FAILED`.
- 409 `EMAIL_TAKEN`, or `LAST_ADMINISTRATOR` — this edit would deactivate or change the role of the last
  active Administrator (BR-30), or `SELF_DEACTIVATION` — caller is deactivating their own account
  (BR-29).

### POST /api/admin/users/:id/reset-password

Request: `{ "newPassword": string }`

- 200 `{ "ok": true }`, sets `mustChangePassword = true` for that user.
- 400 `VALIDATION_FAILED` — fails BR-08.
- 404 — user id does not exist.
