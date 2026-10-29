# Lab 4 API Specification

Related documents: specification.md · ui-spec.md · tests.md

## 1. Conventions

Unchanged from Lab 3: httpOnly session cookie, `credentials: 'include'` on every client fetch,
`{ "error": { "code", "message", "details"? } }` on every non-2xx response, `400` invalid input, `401`
unauthenticated, `403` forbidden by role, `404` not found *or* forbidden by ownership (never
distinguished), `409` conflict, `500` unexpected server error.

## 2. Actions Taken APIs

### GET /api/staff/tickets/:id/actions-taken

Staff-only (`requireStaffAuth`: IT_STAFF or ADMINISTRATOR).

- 200 `[{ id, ticketId, performedById, performedByName, description, result, followUpRequired, followUpNote, attachmentNotes, createdAt, updatedAt }, ...]`, oldest first.
- 404 — Ticket id does not exist.

### POST /api/staff/tickets/:id/actions-taken

Staff-only. Request: `{ "description": string, "result": string, "followUpRequired": boolean, "followUpNote"?: string, "attachmentNotes"?: string }`

- 201 same item shape as above.
- 400 `VALIDATION_FAILED` — `description`/`result` outside 3-2000 chars after trim; `followUpRequired`
  not boolean; `followUpRequired: true` with `followUpNote` missing/outside 3-2000 chars; `attachmentNotes`
  over 500 chars.
- 404 — Ticket id does not exist.

### PATCH /api/staff/tickets/:id/actions-taken/:actionId

Staff-only. Request: `{ "description": string, "result": string, "followUpRequired": boolean, "followUpNote"?: string, "attachmentNotes"?: string, "updatedAt": string }`

`updatedAt` is the ISO timestamp the client last read for this row (optimistic-concurrency token).

- 200 updated item, same shape as GET.
- 400 `VALIDATION_FAILED` — same rules as POST.
- 404 — Ticket or Action Taken does not exist, or the Action Taken does not belong to this Ticket.
- 409 `CONFLICT` — the supplied `updatedAt` no longer matches the stored row (someone else edited it
  first); no change is persisted. `details.currentUpdatedAt` is included so the client can reload.

### GET /api/tickets/:id/actions-taken

Requester-only (`requireRequesterAuth`), ownership-checked.

- 200 same item shape as the staff GET, oldest first.
- 404 — Ticket not owned by the caller, or does not exist (indistinguishable, matching Lab 3's
  convention).

No create/edit route exists for the Requester role on Actions Taken — true by construction, the same
technique already used to keep Internal Notes unreachable by Requesters.

## 3. Dashboard APIs

### GET /api/dashboard/staff

`requireStaffAuth` (IT_STAFF or ADMINISTRATOR — Administrator reuses this route verbatim).

- 200
  ```json
  {
    "counts": { "new": 0, "open": 0, "inProgress": 0, "waitingForRequester": 0, "myAssigned": 0 },
    "recentTickets": [
      { "id": 1, "ticketNumber": "TKT-2026-000001", "summary": "...", "currentStatus": "OPEN", "itPriority": "MEDIUM", "ticketOwnerName": null, "updatedAt": "..." }
    ]
  }
  ```
- `counts.new`/`open`/`inProgress`/`waitingForRequester` are system-wide (every Ticket, not owner-scoped,
  matching the Ticket Queue's own visibility). `counts.myAssigned` is the count of Tickets where
  `ticketOwnerId` equals the caller's id, independent of status.
- `recentTickets` is the 10 most recently updated Tickets system-wide, newest first — a drill-down
  preview, not a replacement for the Ticket Queue.
- Each count is independently 0 when nothing matches (never omitted from the response).

### GET /api/dashboard/requester

`requireRequesterAuth`, scoped to the caller's own Tickets.

- 200
  ```json
  {
    "counts": { "open": 0, "inProgress": 0, "resolved": 0, "closed": 0 },
    "waitingForRequester": [
      { "id": 1, "ticketNumber": "TKT-2026-000001", "summary": "...", "currentStatus": "WAITING_FOR_REQUESTER", "updatedAt": "..." }
    ],
    "recentTickets": [ "... same shape as waitingForRequester ..." ]
  }
  ```
- `counts.open` = NEW + OPEN statuses combined; `inProgress` = IN_PROGRESS; `resolved` = RESOLVED;
  `closed` = CLOSED — all scoped to `requesterId = caller`, never another Requester's Tickets regardless
  of any id in the request.
- `waitingForRequester` is the attention-required callout: every one of the caller's own Tickets
  currently in `WAITING_FOR_REQUESTER` status (not a count — a short list, since this is the one status
  that specifically needs the Requester's action).
- `recentTickets` is the caller's 10 most recently updated Tickets, newest first.

## 4. Unchanged from Lab 3

Every Lab 1-3 endpoint (`/api/auth/*`, `/api/tickets*`, `/api/staff/tickets*` except the new
`actions-taken` sub-routes above, `/api/admin/*`) is unchanged — same paths, same shapes, same
authorization.
