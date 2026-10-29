# Lab 4 Test Plan and Results

Related documents: specification.md · api-spec.md · ui-spec.md

This plan is written from the specification **before** implementation. Every planned test names its
real intended file path. Status is `Planned` until the corresponding Issue lands and the test actually
runs, at which point it becomes `Pass` — this file is updated per-Issue, not reconstructed afterward.

## 1. Test Strategy

Same levels as Lab 3, plus a dedicated workflow/concurrency category for the stale-update rule:

| Level | Tool | Responsibility |
|---|---|---|
| Unit | Vitest | Conditional-required Follow-up Note validator |
| API / integration | Vitest + Supertest | Full HTTP contract: Actions Taken CRUD, dashboards, ownership, role gates, status codes |
| UI component | Vitest + Testing Library | Screen behavior with the API layer stubbed |
| UI style | Vitest + RTL, Playwright screenshots | Required classes, badge/tile consistency |
| Responsive | Playwright, 3 viewports | Layout, no horizontal scroll |
| Authorization / security | Supertest, direct API calls bypassing the UI | Requester blocked from every Actions Taken write route; dashboard scoping |
| Workflow / concurrency | Supertest | Stale-`updatedAt` edit rejected with 409; status matrix still authoritative with Actions Taken present |
| Migration / regression | Supertest against a rebuilt database | Lab 1-3 suites still pass unmodified after the additive migration |
| End-to-end | Playwright | Real login → Actions Taken flow, ticket resolution flow, dashboard flow |

## 2. Planned Tests

### 2.1 Actions Taken — `server/tests/lab-04/actions-taken.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-01 | AC-01 | Staff creates a valid Action Taken | 201, correct Ticket, `performedById` = caller | Planned |
| API-02 | AC-02 | Create with `followUpRequired: true`, no note | 400 `VALIDATION_FAILED`, nothing persisted | Planned |
| API-03 | AC-03 | Create with `followUpRequired: false` + a note anyway | 201, stored `followUpNote` is `null` | Planned |
| API-04 | BR-03 | Description/Result outside 3-2000 chars | 400 `VALIDATION_FAILED` | Planned |
| API-05 | BR-05 | Attachment Notes over 500 chars | 400 `VALIDATION_FAILED` | Planned |
| API-06 | BR-06 | Client supplies `performedById`/`createdAt` in the body | Ignored; server-derived values used instead | Planned |
| API-07 | AC-01 | Staff edits an existing Action Taken with current `updatedAt` | 200, fields updated, `updatedAt` advances | Planned |
| API-08 | AC-06, BR-08 | Edit with a stale `updatedAt` | 409 `CONFLICT`, original row unchanged, `details.currentUpdatedAt` present | Planned |
| API-09 | — | Edit on an Action Taken belonging to a different Ticket id in the URL | 404 | Planned |
| API-10 | AC-04, BR-07 | Requester calls POST/PATCH Actions Taken | 403 on both, no content leaked | Planned |
| API-11 | AC-05, BR-07 | Requester GETs Actions Taken on their own Ticket | 200, full list, read-only shape | Planned |
| API-12 | BR-07 | Requester GETs Actions Taken on a Ticket they do not own | 404 | Planned |
| API-13 | — | GET Actions Taken (staff) on a nonexistent Ticket id | 404 | Planned |
| API-14 | — | IT Staff/Administrator can record an Action Taken on a Ticket they do not own (BR-02) | 201, succeeds regardless of Ticket Owner | Planned |

Unit-level (`server/tests/lab-04/actions-taken-lib.unit.test.ts`): the conditional-required Follow-up
Note validator, tested directly against representative input combinations.

### 2.2 Ticket workflow — `server/tests/lab-04/ticket-workflow.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-15 | AC-07, BR-09 | Every BR-21 transition pair, re-verified post-migration | All permitted pairs succeed, all others 400 | Planned |
| API-16 | FR-08 | Requester attempts a direct status PATCH | 403 (unchanged from Lab 3) | Planned |
| API-17 | BR-09 | Recording an Action Taken does not itself change Current Status | Status unchanged after POST actions-taken | Planned |
| API-18 | BR-10 | `requesterConfirmedResolved` stays advisory regardless of Actions Taken count | Flag never changes Current Status | Planned |

### 2.3 Staff Dashboard — `server/tests/lab-04/staff-dashboard.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-19 | AC-09 | Counts match direct `prisma.ticket.count` queries for the same criteria | Response counts equal independently-computed counts | Planned |
| API-20 | BR-13 | Counts are system-wide, not owner-scoped | A Ticket owned by another Staff member still counted | Planned |
| API-21 | — | `myAssigned` reflects only the caller's own `ticketOwnerId` | Correct count for caller vs. another Staff member | Planned |
| API-22 | AC-10 | No Tickets at all | Every count is `0`, `recentTickets` is `[]`, not omitted | Planned |
| API-23 | — | `recentTickets` ordering | 10 most recently updated, newest first | Planned |
| API-24 | AC-21-style | Requester calls `/api/dashboard/staff` | 403 | Planned |
| API-25 | — | Unauthenticated caller | 401 | Planned |

### 2.4 Requester Dashboard — `server/tests/lab-04/requester-dashboard.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-26 | AC-08, BR-12 | Counts/lists scoped to caller only | Another Requester's Tickets never appear, regardless of any id supplied | Planned |
| API-27 | — | `counts.open` combines NEW + OPEN | Matches a direct count of both statuses together | Planned |
| API-28 | — | `waitingForRequester` list | Only the caller's own `WAITING_FOR_REQUESTER` Tickets | Planned |
| API-29 | AC-10 | Caller with zero Tickets | All counts `0`, both lists `[]` | Planned |
| API-30 | — | IT Staff calls `/api/dashboard/requester` | 403 | Planned |

### 2.5 UI component — `client/tests/lab-04/{ActionsTaken,TicketWorkflow,StaffDashboard,RequesterDashboard}.test.tsx`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| UI-01 | FR-01 | `ActionsTaken.test.tsx`: create form submits and the new item appears in the list | List updates optimistically, form clears | Planned |
| UI-02 | FR-02 | Follow-up Note field appears only when Follow-Up Required is checked, and is marked required | Field hidden/shown correctly, red asterisk shown only when required | Planned |
| UI-03 | AC-01 | Edit mode pre-fills existing values and Save persists them | List item reflects the edit after save | Planned |
| UI-04 | AC-06 | A 409 conflict response shows the safe inline message and reloads that item | Error text shown, item re-fetched, no silent data loss | Planned |
| UI-05 | FR-05 | `RequesterTicketDetail`'s Actions Taken section renders read-only, no Edit button, no form | No interactive controls present | Planned |
| UI-06 | FR-07 | `TicketWorkflow.test.tsx`: Status select only ever offers BR-21-permitted next values | Matches the client-side `TRANSITIONS` mirror | Planned |
| UI-07 | AC-09 | `StaffDashboard.test.tsx`: metric tiles render counts from the API response and link to the correct filtered Queue URL | Tile text and `href`/`to` match | Planned |
| UI-08 | AC-10 | Staff Dashboard empty/failure states | Explicit empty message; safe failure + Retry | Planned |
| UI-09 | AC-08 | `RequesterDashboard.test.tsx`: tiles and Recent Tickets scoped to the mocked caller's own data | No foreign-Ticket data rendered | Planned |
| UI-10 | — | "Tickets Waiting for You" panel absent when the list is empty | Panel not in the DOM, not just visually hidden | Planned |
| UI-11 | AC-11 | `Home.tsx` routes by role | Requester→RequesterDashboard, Staff/Admin→StaffDashboard, no session→redirect to Login | Planned |

### 2.6 Regression — reuses Lab 1-3's existing suites unmodified

| Test ID | Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-31 | AC-12, BR-35-equivalent | Full Lab 1+2+3+4 flow end-to-end through the live API after the additive migration | Ticket→Attachment→Comment→Note→Action Taken chain all succeed in one sequence | Planned |

`server/tests/lab-04/migration.api.test.ts` — smoke test mirroring Lab 3's own `migration.api.test.ts`
pattern, proving the Lab 4 migration doesn't break the full FK chain spanning every prior lab's
schema.

## 3. End-to-end — `e2e/lab-04/{actions-taken-flow,ticket-resolution,dashboards}.spec.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| E2E-01 | AC-01, AC-05 | `actions-taken-flow.spec.ts`: Staff creates and edits an Action Taken; Requester sees it read-only on their own Ticket Detail | Full round trip through real browser + API + DB | Planned |
| E2E-02 | AC-02 | Follow-up Note validation enforced through the real form | Submit blocked / safe error shown until a note is supplied | Planned |
| E2E-03 | FR-07 | `ticket-resolution.spec.ts`: a full Ticket lifecycle walk (New→Open→In Progress→Resolved→Closed) with Actions Taken recorded along the way | Each transition succeeds only via a permitted path | Planned |
| E2E-04 | AC-11 | `dashboards.spec.ts`: logging in as each role lands on that role's Dashboard at `/`, with drill-down links working | Correct Dashboard per role; clicking a tile/list item opens the right filtered/detail screen | Planned |

## 4. Responsive and Visual

Playwright screenshots at 1440×900, 820×1024, 390×844 for Staff Dashboard, Requester Dashboard, and
Actions Taken (on both Ticket Detail pages), asserting no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`) the same way Lab 3's `visual-checklist.spec.ts` does, plus the same
manual-screenshot-inspection discipline that caught Lab 3's real overflow bugs — an automated overflow
assertion alone is necessary but not sufficient.

## 5. Authorization matrix (dedicated cross-cutting file, learned from Lab 3)

Lab 3's own retrospective found that a dedicated `authorization.api.test.ts` file had been *planned*
since early in that sprint but never actually created until report-preparation QA caught the gap. To
avoid repeating that, Lab 4's authorization coverage for the new routes (API-10, API-12, API-24,
API-25, API-30 above) is written inline in each feature's own Issue, not deferred to a "do it later"
file — if a dedicated `server/tests/lab-04/authorization.api.test.ts` still turns out to be useful for
cross-cutting coverage once all routes exist, it will be added in Issue #52's final hardening pass, but
the individual assertions above must already exist and pass well before that.

## 6. Final Results

Filled in as each Issue lands, mirroring Labs 2-3's practice — not reconstructed after the fact.

(Not yet started — this document is written before implementation, per Issue #47.)

## 7. Known Limitations or Deferred Tests

- (Carried over from Lab 3, still true) Session-expiry is tested by issuing a token with a manually-set
  past expiry rather than waiting out a real 8-hour window.
- Load/performance testing of the Dashboard queries at large Ticket counts is out of scope for this
  course lab (the labsheet's own exclusion list covers this implicitly via "production-scale cloud
  operations").
- Actions Taken has no delete capability by design (not requested anywhere in the Lab 4 contract) — no
  test plans for one.
