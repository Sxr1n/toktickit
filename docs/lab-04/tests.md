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
| API-01 | AC-01 | Staff creates a valid Action Taken | 201, correct Ticket, `performedById` = caller | Pass |
| API-02 | AC-02 | Create with `followUpRequired: true`, no note | 400 `VALIDATION_FAILED`, nothing persisted | Pass |
| API-03 | AC-03 | Create with `followUpRequired: false` + a note anyway | 201, stored `followUpNote` is `null` | Pass |
| API-04 | BR-03 | Description/Result outside 3-2000 chars | 400 `VALIDATION_FAILED` | Pass |
| API-05 | BR-05 | Attachment Notes over 500 chars | 400 `VALIDATION_FAILED` | Pass |
| API-06 | BR-06 | Client supplies `performedById`/`createdAt` in the body | Ignored; server-derived values used instead | Pass |
| API-07 | AC-01 | Staff edits an existing Action Taken with current `updatedAt` | 200, fields updated, `updatedAt` advances | Pass |
| API-08 | AC-06, BR-08 | Edit with a stale `updatedAt` | 409 `CONFLICT`, original row unchanged, `details.currentUpdatedAt` present | Pass |
| API-09 | — | Edit on an Action Taken belonging to a different Ticket id in the URL | 404 | Pass |
| API-10 | AC-04, BR-07 | Requester calls POST/PATCH Actions Taken | 403 on both, no content leaked | Pass |
| API-11 | AC-05, BR-07 | Requester GETs Actions Taken on their own Ticket | 200, full list, read-only shape | Pass |
| API-12 | BR-07 | Requester GETs Actions Taken on a Ticket they do not own | 404 | Pass |
| API-13 | — | GET Actions Taken (staff) on a nonexistent Ticket id | 404 | Pass |
| API-14 | — | IT Staff/Administrator can record an Action Taken on a Ticket they do not own (BR-02) | 201, succeeds regardless of Ticket Owner | Pass |

Unit-level (`server/tests/lab-04/actions-taken-lib.unit.test.ts`): the conditional-required Follow-up
Note validator, tested directly against representative input combinations.

### 2.2 Ticket workflow — `server/tests/lab-04/ticket-workflow.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-15 | AC-07, BR-09 | Every BR-21 transition pair, re-verified post-migration | All permitted pairs succeed, all others 400 | Pass |
| API-16 | FR-08 | Requester attempts a direct status PATCH | 403 (unchanged from Lab 3) | Pass |
| API-17 | BR-09 | Recording an Action Taken does not itself change Current Status | Status unchanged after POST actions-taken | Pass |
| API-18 | BR-10 | `requesterConfirmedResolved` stays advisory regardless of Actions Taken count | Flag never changes Current Status | Pass |

### 2.3 Staff Dashboard — `server/tests/lab-04/staff-dashboard.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-19 | AC-09 | Counts match direct `prisma.ticket.count` queries for the same criteria | Response counts equal independently-computed counts | Pass |
| API-20 | BR-13 | Counts are system-wide, not owner-scoped | A Ticket owned by another Staff member still counted | Pass |
| API-21 | — | `myAssigned` reflects only the caller's own `ticketOwnerId` | Correct count for caller vs. another Staff member | Pass |
| API-22 | AC-10 | No Tickets at all | Every count is `0`, `recentTickets` is `[]`, not omitted | Pass |
| API-23 | — | `recentTickets` ordering | 10 most recently updated, newest first | Pass |
| API-24 | AC-21-style | Requester calls `/api/dashboard/staff` | 403 | Pass |
| API-25 | — | Unauthenticated caller | 401 | Pass |

### 2.4 Requester Dashboard — `server/tests/lab-04/requester-dashboard.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-26 | AC-08, BR-12 | Counts/lists scoped to caller only | Another Requester's Tickets never appear, regardless of any id supplied | Pass |
| API-27 | — | `counts.open` combines NEW + OPEN | Matches a direct count of both statuses together | Pass |
| API-28 | — | `waitingForRequester` list | Only the caller's own `WAITING_FOR_REQUESTER` Tickets | Pass |
| API-29 | AC-10 | Caller with zero Tickets | All counts `0`, both lists `[]` | Pass |
| API-30 | — | IT Staff calls `/api/dashboard/requester` | 403 | Pass |

### 2.5 UI component — `client/tests/lab-04/{ActionsTaken,TicketWorkflow,StaffDashboard,RequesterDashboard}.test.tsx`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| UI-01 | FR-01 | `ActionsTaken.test.tsx`: create form submits and the new item appears in the list | List updates optimistically, form clears | Pass |
| UI-02 | FR-02 | Follow-up Note field appears only when Follow-Up Required is checked, and is marked required | Field hidden/shown correctly, red asterisk shown only when required | Pass |
| UI-03 | AC-01 | Edit mode pre-fills existing values and Save persists them | List item reflects the edit after save | Pass |
| UI-04 | AC-06 | A 409 conflict response shows the safe inline message and reloads that item | Error text shown, item re-fetched, no silent data loss | Pass |
| UI-05 | FR-05 | `RequesterTicketDetail`'s Actions Taken section renders read-only, no Edit button, no form | No interactive controls present | Pass |
| UI-06 | FR-07 | `TicketWorkflow.test.tsx`: Status select only ever offers BR-21-permitted next values | Matches the client-side `TRANSITIONS` mirror | Pass |
| UI-07 | AC-09 | `StaffDashboard.test.tsx`: metric tiles render counts from the API response and link to the correct filtered Queue URL | Tile text and `href`/`to` match | Pass |
| UI-08 | AC-10 | Staff Dashboard empty/failure states | Explicit empty message; safe failure + Retry | Pass |
| UI-09 | AC-08 | `RequesterDashboard.test.tsx`: tiles and Recent Tickets scoped to the mocked caller's own data | No foreign-Ticket data rendered | Pass |
| UI-10 | — | "Tickets Waiting for You" panel absent when the list is empty | Panel not in the DOM, not just visually hidden | Pass |
| UI-11 | AC-11 | `Home.tsx` routes by role | Requester→RequesterDashboard, Staff/Admin→StaffDashboard, no session→redirect to Login | Pass |

### 2.6 Regression — reuses Lab 1-3's existing suites unmodified

| Test ID | Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-31 | AC-12, BR-35-equivalent | Full Lab 1+2+3+4 flow end-to-end through the live API after the additive migration | Ticket→Attachment→Comment→Note→Action Taken chain all succeed in one sequence | Pass |

`server/tests/lab-04/migration.api.test.ts` — smoke test mirroring Lab 3's own `migration.api.test.ts`
pattern, proving the Lab 4 migration doesn't break the full FK chain spanning every prior lab's
schema.

## 3. End-to-end — `e2e/lab-04/{actions-taken-flow,ticket-resolution,dashboards}.spec.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| E2E-01 | AC-01, AC-05 | `actions-taken-flow.spec.ts`: Staff creates and edits an Action Taken; Requester sees it read-only on their own Ticket Detail | Full round trip through real browser + API + DB | Pass |
| E2E-02 | AC-02 | Follow-up Note validation enforced through the real form | Submit blocked / safe error shown until a note is supplied | Pass |
| E2E-03 | FR-07 | `ticket-resolution.spec.ts`: a full Ticket lifecycle walk (New→Open→In Progress→Resolved→Closed) with Actions Taken recorded along the way | Each transition succeeds only via a permitted path | Pass |
| E2E-04 | AC-11 | `dashboards.spec.ts`: logging in as each role lands on that role's Dashboard at `/`, with drill-down links working | Correct Dashboard per role; clicking a tile/list item opens the right filtered/detail screen | Pass |

## 4. Responsive and Visual

Playwright screenshots at 1440×900, 820×1024, 390×844 for Staff Dashboard, Requester Dashboard, and
Actions Taken (on both Ticket Detail pages), asserting no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`) the same way Lab 3's `visual-checklist.spec.ts` does, plus the same
manual-screenshot-inspection discipline that caught Lab 3's real overflow bugs — an automated overflow
assertion alone is necessary but not sufficient.

## 5. Authorization matrix (dedicated cross-cutting file, learned from Lab 3)

Lab 3's own retrospective found that a dedicated `authorization.api.test.ts` file had been *planned*
since early in that sprint but never actually created until report-preparation QA caught the gap. To
avoid repeating that, Lab 4's authorization coverage for the new routes (API-10, API-12, API-24,
API-25, API-30 above) is written inline in each feature's own file (`actions-taken.api.test.ts`,
`staff-dashboard.api.test.ts`, `requester-dashboard.api.test.ts`), not deferred to a "do it later"
file. **Checked during the final hardening pass (Issue #58) rather than assumed**: every one of
API-10/12/24/25/30 was confirmed to actually exist and pass (not just planned) by re-reading each test
file directly — no dedicated `authorization.api.test.ts` was added, since a second file re-asserting
the same calls already covered inline would be pure duplication, not new coverage. The one genuine gap
this same check found was different: `actions-taken-lib.unit.test.ts` (the conditional-required
Follow-up Note validator) had been *planned* in this document since Issue #51 but never actually
created, exactly the same failure mode as Lab 3's `authorization.api.test.ts` gap. Fixed in Issue #58:
exported `validateActionBody` from `staff.ts` and wrote the real unit test file (6 tests).

## 6. Final Results

Filled in as each Issue lands, mirroring Labs 2-3's practice — not reconstructed after the fact.

**Issue #48 (Sprint 4 engineering contract)**: `specification.md`, `api-spec.md`, `ui-spec.md`,
`tests.md` written and merged before any implementation PR (PR #49, merged before PR #52).

**Issue #51 (Actions Taken, Ticket workflow re-confirmation, and Dashboard foundation)**: server
108/108 existing + 96 new = 204/204 (`actions-taken.api.test.ts` 15, `ticket-workflow.api.test.ts` 67
— the full 8×8 BR-21 transition matrix exhaustively re-verified, `staff-dashboard.api.test.ts` 7,
`requester-dashboard.api.test.ts` 7). First real Ticket seed data in this project's history (Lab 3's
`seed.ts` never created any).

**Issue #53 (Actions Taken UI)**: client 45/45 existing + 6 new = 51/51
(`ActionsTaken.test.tsx`), server unchanged at 216/216 (204 + the 12 Lab 3 `authorization.api.test.ts`
tests that landed via the `lab4-staging` ← `main` merge in between). Manually verified against real
running dev servers: created and edited an Action Taken with Follow-Up Required as Staff, confirmed the
Requester sees the edited version read-only with zero Edit controls. Found and fixed one real gap along
the way: `.btn-outline-primary` (the Requester's "Problem Appears Resolved" button) was missed by Issue
#46's Zen Green color pass and still rendered Bootstrap blue.

**Issue #55 (Role dashboards)**: client 48 (51 − 3 for the deleted Lab 1 `App.test.tsx`) + 8 new = 56/56,
server unchanged at 216/216. Manually verified the Staff Dashboard's "New" tile drill-down actually
pre-filters the Ticket Queue (confirmed real filtered rows via a fresh `StaffTicketQueue.tsx` URL-param
read, not just a URL change), and both Requester Dashboard states (empty/populated). Found and fixed a
real bug: Recent Tickets list items showed browser bullet points because the Bootstrap `list-group-item`
class was on the nested `<Link>` instead of the `<li>` itself.

**Issue #58 (Final hardening and release integration)**: Reviewed every real comment on PRs #52/#54/#56/
#57 (not just merge status) and found two genuine, non-blocking follow-ups the account holder had
already replied "I will fix it" to without yet doing so — acted on both rather than letting the promise
go unfulfilled a second time (see "Reviewer feedback audit" below). Added the missing
`actions-taken-lib.unit.test.ts` (§5 above). Found and fixed one real regression while running the full
Lab 1-4 E2E suite together for the first time: `e2e/lab-03/authentication.spec.ts` still asserted the
Lab 1 "TokTickIT IT Service Desk" heading at `/`, which Issue #55 replaced with the role-routed
Dashboard — fixed to assert the new Requester Dashboard heading instead. Added
`e2e/lab-04/{actions-taken-flow,ticket-resolution,dashboards,visual-checklist}.spec.ts` (8 tests, all
desktop; `visual-checklist.spec.ts` also runs on tablet/mobile for the 3-screen × 3-viewport screenshot
set). Two of the new E2E tests initially failed on first run — both the test's own Playwright-locator
ambiguity (matching two elements with the same text, or asserting before a page transition settled), not
application bugs; fixed and re-confirmed passing.

**Final regression on `lab4-staging`, run fresh for this pass**: server 222/222, client 58/58, E2E
20/20 (Labs 1-4 together, across desktop/tablet/mobile where applicable).

### Reviewer feedback audit (Issue #58)

Mirroring Lab 3's Issue 33 discipline — audit what reviewers actually said, not just whether a PR
merged:

- **PR #52** (FramePongrit, Approved): no actionable follow-up, straightforwardly positive.
- **PR #54** (FramePongrit, Approved): flagged that `loadActions()` on `StaffTicketDetail.tsx` silently
  swallowed fetch errors, showing a false "No actions taken yet" instead of an error state. Replied "ok
  boss I will fix it!" at the time, but the fix was never actually made before this hardening pass.
  **Fixed now**: added a `*LoadFailed` flag to all five comment/note/action loaders across both
  `StaffTicketDetail.tsx` and `RequesterTicketDetail.tsx` (not just the one Actions Taken case the
  review happened to point at — Public Comments and Internal Notes had the exact same silent-failure
  shape already, predating this sprint), each with a safe "Unable to load X" message and a Retry button.
  Covered by a new regression test.
- **PR #56** (Davidice23, non-blocking): suggested an explicit client test for the Dashboard API
  error/retry state "in a later hardening pass." Replied "ok boss i will fix it!" Staff Dashboard already
  had this test from Issue #55; Requester Dashboard did not. **Fixed now**: added the missing
  `RequesterDashboard` failure-state test.
- **PR #57** (Davidice23, non-blocking): asked for a full Lab 1-4 regression and E2E run once the stack
  landed on `lab4-staging`, to confirm clean integration. **Done**: this is exactly what caught the
  `authentication.spec.ts` regression above — the suggestion found a real bug.

## 7. Known Limitations or Deferred Tests

- (Carried over from Lab 3, still true) Session-expiry is tested by issuing a token with a manually-set
  past expiry rather than waiting out a real 8-hour window.
- Load/performance testing of the Dashboard queries at large Ticket counts is out of scope for this
  course lab (the labsheet's own exclusion list covers this implicitly via "production-scale cloud
  operations").
- Actions Taken has no delete capability by design (not requested anywhere in the Lab 4 contract) — no
  test plans for one.
