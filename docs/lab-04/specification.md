# Lab 4 Sprint Engineering Specification

**Project:** TokTickIT — IT Support Ticketing System
**Sprint:** Lab 4 — Actions Taken, Dashboards, and Final Regression
**Status:** Approved before implementation
**Related documents:** api-spec.md · ui-spec.md · tests.md

## 1. Sprint Goal

Complete the core TokTickIT service-desk workflow: let IT Staff record and update the actual work
performed against a Ticket as a list of Actions Taken, give Requesters and IT Staff a concise
role-appropriate Dashboard as their new home screen, and harden the complete Lab 1-3 application so
every earlier feature keeps working under one coherent Zen Green product.

## 2. Stakeholder Request Interpretation

The stakeholder asked for "a reliable way to plan and track the actual work" plus "useful dashboards...
kept concise and connected to the detailed screens." Read against the constraints, this is three
obligations:

1. **Actions Taken is a real operational record, not another comment thread.** It has structured
   fields (Result, Follow-Up Required, Follow-up Note, Attachment Notes), is created *and* edited by
   IT Staff, and must remain readable by the Requester who owns the Ticket — closer in spirit to a
   service log than to Public Comments or Internal Notes.
2. **Dashboards summarize, they never replace.** Every metric is a thin, backend-calculated count or
   short list with a drill-down link into the existing Ticket Queue / My Tickets / Ticket Detail
   screens — no new reporting surface, no data the detail screens don't already expose.
3. **The Ticket Owner still coordinates the whole Ticket; Actions Taken does not fragment
   ownership.** Any active IT Staff/Administrator may record an Action Taken on any Ticket they can
   already reach (same authorization boundary as Internal Notes in Lab 3), independent of who the
   current Ticket Owner is.

## 3. Scope

### Included

- `ActionTaken` child record under Ticket: create and edit by IT Staff/Administrator, read-only for
  the owning Requester and any IT Staff/Administrator.
- Confirmation that the existing Lab 3 status-transition matrix (BR-21) remains the sole authority for
  the complete Ticket lifecycle from New through Closed/Cancelled, with the resolution gate enforced
  server-side regardless of client behavior.
- IT Staff Dashboard and Requester Dashboard: backend-calculated metrics, a recent-Tickets list, and
  an attention-required callout, each with a drill-down link — replacing the unrelated Lab 1 "Check
  System" scaffold that has occupied the `/` route since Lab 1.
- Idempotent seed data covering realistic Tickets across every status/priority/ownership combination
  and Actions Taken counts of zero, one, and many — Lab 3's seed script never actually seeded any
  Tickets, so this is also the first real Ticket seed data in the project's history.
- Final hardening pass: full Lab 1-4 regression, accessibility and Zen Green visual consistency sweep,
  removal of leftover/inconsistent UI elements (the Lab 1 homepage scaffold, confirmed above).
- Automated tests at unit, API, UI component, UI style, responsive, authorization, workflow,
  migration/regression, and end-to-end level.

### Excluded

- Automatic SLA clocks, escalation engines, on-call scheduling, breach notifications.
- Email, SMS, LINE, push, or any external notification service.
- Inventory/spare-parts/purchasing/cost accounting; time-sheet billing, payroll, labor-cost
  calculation.
- Multi-level approval workflows, electronic signatures.
- Advanced business-intelligence tools, custom report builders, export warehouses — dashboards are
  fixed, backend-defined metrics only.
- Multi-tenant organizations, production-scale cloud operations.
- A real file-upload pipeline for Actions Taken: "Attachment Notes" is a plain text field describing
  what to look for, not a new upload mechanism (Lab 2's existing Attachment model/UI is unchanged and
  untouched by this sprint).
- Any feature not explicitly approved in this document.

## 4. Functional Requirements

**Actions Taken**

- FR-01 The system shall let an authenticated IT Staff/Administrator create an Action Taken on any
  Ticket they can already view, recording Description, Result, Follow-Up Required, an optional
  Follow-up Note, and optional Attachment Notes.
- FR-02 The system shall require a non-empty Follow-up Note whenever Follow-Up Required is set to
  true, and discard any Follow-up Note value when Follow-Up Required is false.
- FR-03 The system shall let an authenticated IT Staff/Administrator edit the Description, Result,
  Follow-Up Required, Follow-up Note, and Attachment Notes of an existing Action Taken.
- FR-04 The system shall record the authenticated creator of every Action Taken (Performed By) and its
  server-generated creation and last-updated timestamps; the client never supplies any of these.
- FR-05 The system shall let an authenticated Requester view every Action Taken on a Ticket they own,
  in read-only form, with no create or edit capability reachable by that role.
- FR-06 The system shall reject any Requester attempt to create or edit an Action Taken, and reject
  any IT Staff/Administrator attempt to edit an Action Taken using a stale copy of its prior state.

**Ticket workflow**

- FR-07 The system shall continue to enforce the Lab 3 status-transition matrix (BR-21) as the sole
  authority for every status change, independent of which screen or role initiates the request.
- FR-08 The system shall continue to prevent a Requester from directly setting a Ticket's formal
  status, including to Resolved or Closed, regardless of client-side bypass.

**Dashboards**

- FR-09 The system shall provide an IT Staff Dashboard showing New/Open/In Progress/Waiting-for-
  Requester Ticket counts across the whole system, a count of Tickets owned by the current user, and
  a list of recently updated Tickets, each linking to its Ticket Detail or a filtered Ticket Queue.
- FR-10 The system shall provide a Requester Dashboard showing only that Requester's own Open/In
  Progress/Resolved/Closed Ticket counts, a list of that Requester's Tickets currently Waiting for
  Requester (the attention-required callout), and a list of that Requester's recently updated Tickets,
  each linking to its own Ticket Detail.
- FR-11 The system shall let an Administrator view the same dashboard as IT Staff.
- FR-12 The system shall route the authenticated home screen (`/`) to the dashboard appropriate for
  the caller's role, and to Login for an unauthenticated visitor.

**Hardening**

- FR-13 The system shall continue to support every approved Lab 1-3 Requester, IT Staff, and
  Administrator function without regression after this sprint's data-model and routing changes.

## 5. Business Rules

**Actions Taken**

- BR-01 An Action Taken belongs to exactly one Ticket. (given)
- BR-02 The Ticket Owner coordinates the Ticket, but an Action Taken may be recorded by any active IT
  Staff/Administrator, not only the current Ticket Owner. (given)
- BR-03 Description and Result are each required, trimmed, and limited to 3-2000 characters (the same
  length rule already used for Public Comments/Internal Notes in Lab 3, applied here for consistency).
- BR-04 Follow-Up Required is a boolean. When true, Follow-up Note is required (trimmed, 3-2000
  characters); when false, any client-supplied Follow-up Note is ignored and the stored value is
  `null` — this conditional-required rule is enforced in route-handler validation, the same place
  every other Lab 1-3 business rule lives, not as a database constraint.
- BR-05 Attachment Notes is optional free text, trimmed, up to 500 characters — a description of what
  file to look for, never an actual upload.
- BR-06 Performed By, created-at, and updated-at are always server-derived from the authenticated
  session and the database clock; a client-supplied value for any of them is ignored.
- BR-07 A Requester may only read Actions Taken on a Ticket they own (404 otherwise, matching Lab 3's
  ownership-check convention); no route reachable by the Requester role can create or edit an Action
  Taken — true by construction (no such route exists for that role), the same technique already used
  to keep Internal Notes unreachable by Requesters.
- BR-08 Editing an Action Taken requires the caller to supply the `updatedAt` value they last read; if
  it no longer matches the stored row (another edit landed first), the request is rejected with 409
  and no change is persisted — this is the sprint's required stale-update protection.

**Ticket workflow**

- BR-09 The permitted Ticket statuses and transition matrix remain exactly as defined in Lab 3's BR-21
  (New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled); this sprint
  changes no transition, it only re-confirms and re-tests that the matrix is enforced from every call
  site, including Actions Taken creation (recording an Action Taken never itself changes status).
- BR-10 A Requester's "Problem Appears Resolved" indication remains advisory only (Lab 3's
  `requesterConfirmedResolved` flag) and never itself changes Current Status, regardless of how many
  Actions Taken exist on the Ticket.

**Dashboards**

- BR-11 Every dashboard metric is calculated by the backend from the authoritative Ticket table at
  request time; no metric is cached, pre-aggregated, or derived from client-side state.
- BR-12 The Requester Dashboard returns data scoped to the authenticated caller's own Tickets only,
  identically to how `GET /api/tickets` is already scoped in Lab 2/3 — never another Requester's data,
  regardless of any id supplied by the client.
- BR-13 The IT Staff Dashboard is not owner-scoped: its system-wide counts include every Ticket
  regardless of Ticket Owner, matching the existing Ticket Queue's own unscoped visibility (BR-13 from
  Lab 3).
- BR-14 A dashboard list or count with no matching Tickets renders an explicit empty state, never a
  blank section or a loading spinner left stuck.

## 6. UI Specification Summary

Full detail in `ui-spec.md`. Summary:

- **Application shell**: adds one `Dashboard` link to the existing role-conditional nav in
  `AppShell.tsx`, visible to every authenticated role, pointing at `/`.
- **Home (`/`)**: role-routed — Requester sees the Requester Dashboard, IT Staff/Administrator see the
  IT Staff Dashboard, an unauthenticated visitor is redirected to Login. Replaces the Lab 1 "Check
  System" scaffold that has sat at this route, unguarded and unrelated to any real user, since Lab 1.
- **IT Staff Dashboard**: metric tiles (New, Open, In Progress, Waiting for Requester, My Assigned),
  a "Recent Tickets" list, and quick-action links into the Ticket Queue — reusing the existing
  tinted-card and badge tokens already established on Ticket Detail.
- **Requester Dashboard**: metric tiles (My Open, In Progress, Resolved, Closed), a "Tickets Waiting
  for You" attention-required callout (Waiting-for-Requester status specifically), a "Recent Tickets"
  list, and quick-action links into Create Ticket / My Tickets.
- **Ticket Detail (both roles)**: a new Actions Taken section. On `StaffTicketDetail.tsx`, a
  full-width panel below the existing Public Comments/Internal Notes row, with create and inline-edit
  forms, Follow-up Note only shown (and required) when Follow-Up Required is checked. On
  `RequesterTicketDetail.tsx`, the same list rendered read-only, no form.

## 7. Data Changes

**`ActionTaken` (new)**: `id, ticketId (FK → Ticket, cascade), performedById (FK → User), description,
result, followUpRequired (Boolean, default false), followUpNote (String?, nullable), attachmentNotes
(String?, nullable), createdAt, updatedAt`.

**Relationships added**: one Ticket has many ActionTaken rows (cascade-delete with the Ticket, same as
Attachment/PublicComment/InternalNote); one User (IT Staff/Administrator) performs many ActionTaken
rows.

**Indexes**: `ActionTaken(ticketId)`, matching the existing index convention on every other
Ticket-child table.

**Migration**: `20260920090000_add_action_taken`, continuing the existing
`YYYYMMDDHHMMSS_snake_case_description` naming convention (latest prior migration:
`20260919160000_add_ticket_status_index`). Purely additive (one new table, no column changes to
existing tables) — lossless by construction, no backfill needed for existing Tickets (they simply
start with zero Actions Taken).

**Decision D-01 (justified below in §11): `followUpNote`'s conditional-required rule lives in route
validation, not a Postgres CHECK constraint.** Every other Lab 1-3 business rule of this shape (BR-08
password rules, BR-24 comment length, etc.) is enforced the same way; a DB-level constraint would be
the only one of its kind in the schema and would duplicate logic the API layer must enforce anyway to
return a proper `400 VALIDATION_FAILED` response.

**Decision D-02 (justified below in §11): stale-update detection uses `updatedAt`-based optimistic
concurrency, not a Postgres Serializable transaction.** The last-Administrator rule (Lab 3, `admin.ts`)
needed a transaction because it protects a cross-row invariant a single `WHERE` clause can't express;
editing one Action Taken row has no such invariant, so a plain conditional update is sufficient and
simpler.

**Seed data**: `server/prisma/seed.ts` is extended with a small local Ticket fixture (first Ticket
seed data in this project — Lab 3's seed script never created any) spanning every status, a mix of
priorities, and both assigned and unassigned ownership, plus Actions Taken counts of zero, one, and
several (including at least one with Follow-Up Required) — satisfying this sprint's own seed
requirement and closing a pre-existing Lab 3 gap in the same change.

## 8. API Contract

Full contract in `api-spec.md`. Capability summary:

| # | Capability | Method and path |
|---|---|---|
| 1 | List Actions Taken (staff) | GET /api/staff/tickets/:id/actions-taken |
| 2 | Create Action Taken (staff) | POST /api/staff/tickets/:id/actions-taken |
| 3 | Edit Action Taken (staff) | PATCH /api/staff/tickets/:id/actions-taken/:actionId |
| 4 | List Actions Taken (Requester, read-only) | GET /api/tickets/:id/actions-taken |
| 5 | IT Staff/Administrator dashboard | GET /api/dashboard/staff |
| 6 | Requester dashboard | GET /api/dashboard/requester |

Every endpoint follows the existing `{ "error": { "code", "message", "details"? } }` error shape and
the existing per-route middleware-tuple authorization convention (`requireStaffAuth`,
`requireRequesterAuth`) unchanged from Lab 3.

## 9. Acceptance Criteria

- AC-01 Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is
  saved under the correct Ticket with the authenticated creator recorded as Performed By.
- AC-02 Given Follow-Up Required is set to true with no Follow-up Note, when an Action Taken is
  created or edited, then the request is rejected with 400 and no row is written/changed.
- AC-03 Given Follow-Up Required is set to false with a Follow-up Note supplied, when an Action Taken
  is created, then the stored Follow-up Note is `null`, not the supplied text.
- AC-04 Given an authenticated Requester, when an Actions Taken create or edit endpoint is requested,
  then the operation is rejected without exposing any Action Taken content.
- AC-05 Given an authenticated Requester who owns the Ticket, when they view Ticket Detail, then every
  Action Taken on that Ticket is visible to them in read-only form.
- AC-06 Given two IT Staff editing the same Action Taken, when the second submits using a stale
  `updatedAt`, then the request is rejected with 409 and the first edit's data is preserved unchanged.
- AC-07 Given a Ticket in a non-terminal status, when a status PATCH names a pair not present in
  BR-21's matrix, then the server rejects it with 400 and no status change is persisted, regardless of
  how many Actions Taken exist on the Ticket.
- AC-08 Given an authenticated Requester, when dashboard data is retrieved, then only metrics and
  recent Tickets owned by that Requester are returned, and a client-supplied id for any other
  Requester has no effect.
- AC-09 Given an authenticated IT Staff user, when the Dashboard loads, then the New/Open/In
  Progress/Waiting-for-Requester counts and the "My Assigned" count each match a direct database
  query for the same criteria.
- AC-10 Given no Tickets match a dashboard metric or list, when that Dashboard loads, then an explicit
  empty state is shown for that metric/list, not a blank area.
- AC-11 Given an unauthenticated visitor, when they load `/`, then they are redirected to Login; given
  an authenticated user of any role, when they load `/`, then they see their role's Dashboard, not the
  prior Lab 1 scaffold page.
- AC-12 Given every Lab 1-3 acceptance criterion, when the complete Lab 4 regression suite runs
  against a fresh `prisma migrate deploy` + seed database, then all of them continue to pass
  unmodified.

Every acceptance criterion above is mapped to at least one planned test in `tests.md`.

## 10. Definition of Done

**Part 1 — Product completion**

- Every FR-01 to FR-13 is implemented; every AC-01 to AC-12 is satisfied and demonstrable.
- Every BR-01 to BR-14 is enforced where this specification says it must be enforced, verified by a
  direct API test, not only a hidden UI control.
- The complete Lab 1-4 test suite passes from the documented commands on the final `main` branch.
- No required test is skipped, disabled, or commented out.
- Migration is additive and lossless: existing Lab 1-3 data survives `prisma migrate deploy` on a
  database built from the pre-Lab-4 schema, verified directly (not assumed).
- Implemented endpoints match `api-spec.md`; implemented screens match `ui-spec.md` at all three
  breakpoints.
- README setup/seed/migration/test instructions are current for the Lab 4 increment.
- Known limitations are recorded rather than left implicit.

**Part 2 — Course delivery requirements**

- Every unit of work has a GitHub Issue; the board shows every Issue in Done.
- Each Issue is implemented on its own feature branch; nothing is developed directly on `main` or
  `lab4-staging`.
- Every feature branch reaches `lab4-staging` through a Pull Request linked to its Issue via the
  Development panel.
- Every PR receives a peer review, and every review comment receives a reply before merge.
- One release Pull Request merges `lab4-staging` into `main` after full regression.
- `docs/lab-04/` contains `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `reviewer.md`,
  and `ai-use.md`, all current.
- Screenshot evidence exists for every required submission part, including proof this specification
  predates the implementation PRs.

## 11. Assumptions and Decisions

| # | Decision | Rationale |
|---|---|---|
| D-01 | `followUpNote`'s conditional-required rule is enforced in route-handler validation, not a database CHECK constraint. | Matches the existing convention for every other business rule of this shape in this codebase (password rules, comment length); a route-level check is also required regardless, to return a proper `400 VALIDATION_FAILED` response, so a DB constraint would be pure duplication. |
| D-02 | Stale Actions Taken edits are detected via `updatedAt`-based optimistic concurrency (conditional `UPDATE ... WHERE updatedAt = $stale_value`), not a Postgres Serializable transaction. | The Serializable-transaction pattern already in this codebase (Lab 3's last-Administrator check) solves a cross-row invariant a single-row `WHERE` clause cannot express. Editing one Action Taken has no such invariant — two Staff editing the same row is exactly the case optimistic concurrency is designed for, and it is strictly less machinery. |
| D-03 | "Action Date/Time" in the labsheet's stakeholder quote is treated as the server-generated `createdAt` timestamp, not a separate user-entered field. | The UI section (8.3) calls it "Action **create** date/time," and no other field in the required list implies a distinct user-editable timestamp; inventing one would contradict FR-04/BR-06's "server-derived, client value ignored" convention applied to every other auto field here. |
| D-04 | The Requester Dashboard's four metric tiles are Open (New+Open statuses combined), In Progress, Resolved, Closed — matching the labsheet's own illustrative Figure (8.2) literally — with "Tickets waiting for the Requester" (named separately in the handout's §4.6 text) surfaced as its own "attention-required" callout rather than a fifth tile. | The Figure is the concrete required-UI reference; §4.6's bullet list is explicitly framed as "Examples." Giving Waiting-for-Requester Tickets a distinct, attention-grabbing callout (rather than folding them into "In Progress") also directly satisfies Part 8's grading language, which separately calls for "recent and **attention-required** Tickets." |
| D-05 | The IT Staff Dashboard's metric tiles are New, Open, In Progress, Waiting for Requester, and My Assigned — matching the Figure (8.1) exactly — without a separate "Unassigned" tile. | "Unassigned" is already a first-class filter on the existing Ticket Queue (`ticketOwnerId=unassigned`, built in Lab 3); duplicating it as a dashboard tile adds a metric the Figure doesn't show without adding real new capability — the Dashboard's own "quick actions" link into the Queue, where that filter already lives. |
| D-06 | Administrator reuses the IT Staff Dashboard verbatim — no separate Administrator dashboard route or screen. | Explicitly permitted ("Administrator dashboard: may reuse the IT Staff dashboard") and avoids a redundant third screen. |
| D-07 | Actions Taken uses a single-message `VALIDATION_FAILED` error (matching Internal Notes' validation style), not Administrator's per-field `fields` map. | The Actions Taken form is closer in shape and complexity to the Internal Note form than to the multi-field User Management form; matching its nearest sibling keeps the client-side error-handling code symmetric with the existing Public Comments/Internal Notes panels it sits beside. |
