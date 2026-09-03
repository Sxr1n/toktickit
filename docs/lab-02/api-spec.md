# Lab 2 API Contract

All Requester-scoped endpoints require the header `X-Dev-Requester-Id: <id>`. If it is missing, refers to
an unknown id, or refers to an inactive Requester, the endpoint returns `401` with a safe message — this
substitutes for real authentication in Lab 2 only (see specification.md §11, BR-28).

Reference data endpoints (`/api/categories`, `/api/related-systems`, `/api/dev-requesters`) do not
require the header.

## GET /api/related-systems

Returns active Related Systems.

**200 OK**
```json
[
  { "id": 1, "name": "Email" },
  { "id": 2, "name": "Campus Wi-Fi" }
]
```

## GET /api/dev-requesters

Returns active Development Requesters, for the Requester Selection screen.

**200 OK**
```json
[
  { "id": 1, "name": "Jennifer Anderson", "email": "jennifer.anderson@example.com" }
]
```

## POST /api/tickets

Creates a Ticket for the Requester identified by `X-Dev-Requester-Id`.

**Request body**
```json
{
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains fast even when idle, started after last update.",
  "requestedPriority": "MEDIUM"
}
```

**201 Created**
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "Battery drains fast even when idle, started after last update.",
  "requestedPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-09-03T09:14:00.000Z"
}
```

**400 Bad Request** — validation failure (BR-09 to BR-12), field-level detail:
```json
{ "error": "VALIDATION_ERROR", "fields": { "summary": "Summary is required" } }
```

**401 Unauthorized** — missing/invalid/inactive `X-Dev-Requester-Id`.
**500 Internal Server Error** — safe generic message, no internal detail leaked.

## GET /api/tickets

Paginated, searchable/filterable/sortable list of the selected Requester's own Tickets (BR-05, BR-22 to
BR-25).

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | matches Ticket Number or Summary, case-insensitive, partial (BR-25) |
| `categoryId` | int | — | filter |
| `relatedSystemId` | int | — | filter |
| `requestedPriority` | `LOW\|MEDIUM\|HIGH` | — | filter |
| `sortBy` | `createdAt\|currentStatus` | `createdAt` | invalid value falls back to default (BR-24) |
| `sortDir` | `asc\|desc` | `desc` | |
| `page` | int ≥1 | 1 | out-of-range falls back to 1 (BR-23) |
| `pageSize` | int 1-50 | 10 | out-of-range falls back to 10 (BR-23) |

**200 OK**
```json
{
  "items": [
    { "id": 42, "ticketNumber": "TKT-2026-000042", "summary": "Laptop battery drains quickly",
      "categoryId": 2, "requestedPriority": "MEDIUM", "currentStatus": "NEW",
      "createdAt": "2026-09-03T09:14:00.000Z" }
  ],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

## GET /api/tickets/:id

One Ticket, only if owned by the selected Requester.

**200 OK** — full Ticket object (same shape as POST response) plus `attachments: []` (id, originalName,
mimeType, sizeBytes, uploadedAt, isRemoved, removedReason for each).
**404 Not Found** — Ticket does not exist, or exists but is owned by a different Requester (BR-05: same
response either way, so ownership is never revealed by the error).

## POST /api/tickets/:id/attachments

Multipart upload. Rejects per BR-15 to BR-17 before storing anything.

**201 Created**
```json
{ "id": 9, "originalName": "screenshot.png", "mimeType": "image/png", "sizeBytes": 204800,
  "uploadedAt": "2026-09-03T09:20:00.000Z", "isRemoved": false }
```

**400 Bad Request** — `UNSUPPORTED_TYPE`, `FILE_TOO_LARGE`, or `ATTACHMENT_LIMIT_REACHED`, each with a
human-readable `message`.
**404 Not Found** — Ticket not owned by the selected Requester.

## GET /api/tickets/:id/attachments/:attachmentId

Attachment metadata (including removed ones — BR-19). 404 if the Ticket isn't owned by the selected
Requester, or the Attachment doesn't belong to that Ticket.

## GET /api/tickets/:id/attachments/:attachmentId/download

Streams the file. **404** if not owned, or if `isRemoved = true` (BR-14, BR-21 — a removed Attachment's
download is blocked even with a valid direct link).

## PATCH /api/tickets/:id/attachments/:attachmentId/remove

**Request body**
```json
{ "reason": "Wrong screenshot, replaced by the correct one" }
```

**200 OK** — updated Attachment with `isRemoved: true`, `removedAt`, `removedReason`.
**400 Bad Request** — missing/too-short `reason` (BR-21).
**404 Not Found** — not owned, already removed, or doesn't exist.

## Status code summary

| Status | Meaning |
|---|---|
| 200 | Successful retrieval or update |
| 201 | Ticket or Attachment created |
| 400 | Validation failure, unsupported file type, oversized file, attachment limit, missing removal reason |
| 401 | Missing/invalid/inactive `X-Dev-Requester-Id` |
| 404 | Resource missing or not owned by the selected Requester (ownership never distinguished from "missing") |
| 500 | Unexpected server error — safe generic message only |
