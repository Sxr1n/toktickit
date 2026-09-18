# Lab 3 Test Plan and Results

Related documents: specification.md · api-spec.md · ui-spec.md

This plan is written from the specification **before** implementation. Every planned test names its
real intended file path. Status is `Planned` until the corresponding Issue lands and the test actually
runs, at which point it becomes `Pass` — this file is updated per-Issue, not reconstructed afterward.

## 1. Test Strategy

Same levels as Lab 2, with one addition (authorization/security as its own explicit category, since Lab
3's entire point is server-enforced role/ownership boundaries):

| Level | Tool | Responsibility |
|---|---|---|
| Unit | Vitest | Password-rule validator, status-transition matrix lookup |
| API / integration | Vitest + Supertest | Full HTTP contract against real PostgreSQL: auth, ownership, role gates, status codes |
| UI component | Vitest + Testing Library | Screen behavior with the API layer stubbed |
| UI style | Vitest + RTL, Playwright screenshots | Required classes, badge consistency, field states |
| Responsive | Playwright, 3 viewports | Layout, no horizontal scroll |
| Authorization / security | Supertest, direct API calls bypassing the UI entirely | Every protected endpoint tested with no session, wrong role, and wrong owner |
| Migration / regression | Supertest against a rebuilt database | Lab 1 + Lab 2 suites still pass unmodified after the User migration |
| End-to-end | Playwright | Real login → role-specific journey across a real client, API, and database |

**Authorization is tested from the outside.** Every role/ownership rule is asserted by calling the API
directly with the "wrong" session (no session, a Requester session on a staff route, a different
Requester's Ticket id) — never by inspecting client state. A hidden button passing a UI test is not
accepted as authorization evidence, per the specification's own framing.

## 2. Planned Tests

### 2.1 Authentication — `server/tests/lab-03/auth.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-01 | AC-01 | Valid login | 200, session cookie set, correct role in body | Pass |
| API-02 | AC-05 | Wrong password | 401 `INVALID_CREDENTIALS`, no cookie | Pass |
| API-03 | AC-06 | Inactive account, correct password | 401 `INVALID_CREDENTIALS`, identical body/status to API-02 | Pass |
| API-04 | BR-07 | Unknown email | 401 `INVALID_CREDENTIALS`, identical body/status to API-02 | Pass |
| API-05 | AC-02, BR-02 | Login with `mustChangePassword=true` | `mustChangePassword: true` round-trips from login through `GET /api/auth/me` (the `requireFreshPassword` middleware that will actually gate business routes on this flag is built and unit-tested in this Issue, but not wired into any route until Issue 28 migrates the Requester routes onto real auth — there are no business routes to gate yet) | Pass |
| API-06 | AC-07 | Logout then reuse old cookie | Logout 200; subsequent request with the same cookie is 401 (required a real fix: a stateless JWT with only `res.clearCookie()` doesn't invalidate server-side — added a `tokenVersion` column, bumped on logout) | Pass |
| API-07 | BR-11 | Expired session token | A token issued with a past expiry is rejected 401 | Pass |
| API-08 | FR-04 | `GET /api/auth/me` | 200 with caller's own id/role only; 401 with no session | Pass |
| API-09 | BR-08, BR-09 | Change password: weak new password / wrong current password | 400 with rule-specific `details`; 401 `INVALID_CURRENT_PASSWORD` | Pass |
| API-10 | AC-02 | Change password success | 200, `mustChangePassword` cleared, subsequent login with the new password succeeds | Pass |

Unit-level (`server/tests/lab-03/auth-lib.unit.test.ts`): password-rule validator (BR-08) and the
`requireFreshPassword` middleware's three branches, tested directly against mock req/res/next. Pass.

### 2.2 Authorization matrix — `server/tests/lab-03/authorization.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-11 | AC-08 | Any protected route, no session | 401 across every route family (tickets, staff, admin) | Planned |
| API-12 | AC-21 | Requester calls `/api/staff/*` | 403 on every staff route | Planned |
| API-13 | AC-21 | Requester calls `/api/admin/*` | 403 on every admin route | Planned |
| API-14 | — | IT Staff calls `/api/admin/*` | 403 (Administrator-only, per the labsheet's explicit role separation) | Planned |
| API-15 | AC-04, BR-04 | Requester calls internal-notes GET/POST | 403, response body contains no note content | Planned |
| API-16 | AC-03, BR-03 | Requester supplies a foreign `requesterId`/`userId` in the request body on any Requester route | Server ignores it; the authenticated identity is used instead | Planned |
| API-17 | AC-12, BR-12 | Requester B requests Requester A's Ticket by id | 404 (unchanged Lab 2 convention) | Planned |

### 2.3 Staff Ticket Queue — `server/tests/lab-03/staff-queue.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-18 | AC-13, FR-12 | Queue returns Tickets across multiple Requesters | Every seeded Requester's Tickets appear, not just one | Pass |
| API-19 | FR-12 | Search by Ticket Number / Summary | Case-insensitive substring match | Pass |
| API-20 | FR-12 | Filter by status, itPriority, ticketOwnerId=unassigned | Each filter narrows correctly; combine conjunctively | Pass |
| API-21 | FR-12 | Sort by itPriority / currentStatus, both directions | Ordering matches request | Pass (itPriority direction verified; currentStatus sort uses the same code path) |
| API-22 | FR-12 | Pagination boundaries | Page 2 disjoint from page 1; invalid pageSize → 400 | Pass |

`GET /api/staff/users` (added in this Issue, see api-spec.md §4) is also covered: lists active IT
Staff/Administrator users, 403 for a Requester.

### 2.4 Staff Ticket Detail operations — `server/tests/lab-03/staff-ticket-detail.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-23 | AC-14, BR-17 | Claim an unassigned Ticket | 200, `ticketOwnerId` set to caller | Planned |
| API-24 | BR-17 | Reassign to an inactive user / a Requester id | 400 — target must be active IT Staff/Administrator | Planned |
| API-25 | BR-18, BR-19 | Set IT Priority; attempt to change Requested Priority | IT Priority updates; Requested Priority PATCH rejected/ignored | Planned |
| API-26 | AC-15, AC-16, BR-21 | Every permitted transition in the matrix; several invalid pairs (e.g. New→Closed, Cancelled→anything) | Permitted: 200. Invalid: 400 `INVALID_TRANSITION`, no state change | Planned |
| API-27 | AC-15 | Requester attempts a status PATCH on their own Ticket | 403 | Planned |
| API-28 | BR-22 | Requester confirms resolved, then IT Staff moves status back to In Progress | Flag resets to false | Planned |

### 2.5 Comments and Notes — `server/tests/lab-03/comments-notes.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-29 | AC-10, BR-24 | Post a valid Public Comment | 201, appears in a subsequent GET | Pass |
| API-30 | BR-24 | Post empty/whitespace-only, or >2000 chars | 400 in both cases | Pass |
| API-31 | BR-26 | Requester posts/reads Public Comments on another Requester's Ticket | 404 | Pass |
| API-32 | AC-17, BR-04 | IT Staff posts an Internal Note; Requester's Public Comments fetch | Note visible to staff GET; absent from the Requester-facing endpoint entirely | Planned (Internal Notes and IT Staff routes land in Issue 30) |
| API-33 | BR-25 | Comment/Note author and timestamp | Both are server-set; a client-supplied `authorId`/`createdAt` in the body is ignored | Pass (Public Comment half only; Internal Note half lands with API-32 in Issue 30) |

### 2.6 Administrator — `server/tests/lab-03/users-admin.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-34 | FR-19 | List users; search by name/email; role filter | Correct subset returned; no pagination metadata required | Planned |
| API-35 | AC-18, FR-20 | Create user with initial password | 201, `mustChangePassword: true`; that user can then log in and is forced through Change Password | Planned |
| API-36 | AC-19, BR-28 | Duplicate email (case-insensitive) on create and on edit | 409 `EMAIL_TAKEN` in both cases | Planned |
| API-37 | FR-21 | Edit name/email/role/isActive | 200, fields updated | Planned |
| API-38 | FR-22, BR-31 | Reset an existing user's password | 200, `mustChangePassword` set true for that user | Planned |
| API-39 | AC-20, BR-29 | Administrator deactivates their own account | 409 `SELF_DEACTIVATION` | Planned |
| API-40 | AC-20, BR-30 | Deactivate/reassign-role the last active Administrator | 409 `LAST_ADMINISTRATOR` | Planned |
| API-41 | BR-27 | Create user with an invalid/missing role | 400 | Planned |

### 2.7 Migration / regression — `server/tests/lab-03/migration.api.test.ts`

| Test ID | AC / Requirement | What It Tests | Expected Result | Status |
|---|---|---|---|---|
| API-42 | AC-09, BR-35 | Full Lab 1 + Lab 2 suites re-run unmodified after the `User` migration, on a database built via `prisma migrate deploy` + seed from empty | All pass | Planned |
| API-43 | AC-09 | A pre-migration seeded Requester's pre-existing Ticket | Still present, still owned by that Requester, under the new `User` table | Planned |

### 2.8 UI components

| Test ID | Type | AC | What It Tests | File | Status |
|---|---|---|---|---|---|
| UI-01 | UI | AC-01, AC-05 | Login form validation, busy state, safe error rendering | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI | AC-02 | Change Password rule checklist live-updates; Continue disabled until valid+matching | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-03 | UI | FR-06 | AppShell renders only the current role's nav links; unauthorized links absent from the DOM | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| UI-04 | UI | AC-13 | Staff Queue renders multi-Requester rows, loading/empty/no-results/failure states | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-05 | UI | AC-14, AC-15 | Staff Ticket Detail: claim action, status-select narrowed to permitted transitions, Comments vs. Notes visually distinct containers | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-06 | UI | AC-18, AC-20 | User Management: create/edit form validation, disabled self-deactivate/last-admin buttons with visible reason | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-07 | UI | AC-11 | Requester Ticket Detail: Problem Appears Resolved button becomes a confirmation chip, Current Status badge unchanged | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass |

### 2.9 End-to-end — `e2e/lab-03/`

| Test ID | AC | What It Tests | Expected Result | File | Status |
|---|---|---|---|---|---|
| E2E-01 | AC-08 | Direct navigation to a protected route with no session | Redirects to Login | `authentication.spec.ts` | Pass |
| E2E-02 | AC-01, AC-02 | Login with a temporary password → forced Change Password → normal app opens only after a valid change | Normal app unreachable until change completes | `authentication.spec.ts` | Pass |

Both landed in one file (`e2e/lab-03/authentication.spec.ts`) rather than the two originally
planned, since AppShell/nav are not yet auth-aware (Issue 28) — there is no Logout button to click
yet, so full "authenticated shell → logout" browser coverage is deferred to Issue 28; logout's
server-side invalidation is already covered directly by API-06.
| E2E-03 | AC-13, AC-14, AC-15, AC-17 | IT Staff logs in, claims a Ticket from the Queue, sets IT Priority, transitions status, posts a Public Comment and an Internal Note | All actions visible on reload | `staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | AC-18, AC-19 | Administrator creates a user, that user logs in and is forced through Change Password | Full loop succeeds | `user-administration.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-01, E2E-02 |
| AC-02 | API-05, API-10, UI-02, E2E-02 |
| AC-03 | API-16 |
| AC-04 | API-15 |
| AC-05 | API-02, UI-01 |
| AC-06 | API-03 |
| AC-07 | API-06 |
| AC-08 | E2E-01, plus server-side 401-with-no-session coverage for every Requester/Attachment/Public-Comment route (now cookie-based as of Issue 28); API-11's broader sweep across the new staff/admin route families lands as those route families ship in Issues 29-31 |
| AC-09 | API-42, API-43 |
| AC-10 | API-29 |
| AC-11 | UI-07 |
| AC-12 | API-17 |
| AC-13 | API-18, UI-04, E2E-03 |
| AC-14 | API-23, UI-05, E2E-03 |
| AC-15 | API-26, API-27, UI-05, E2E-03 |
| AC-16 | API-26 |
| AC-17 | API-32, E2E-03 |
| AC-18 | API-35, UI-06, E2E-04 |
| AC-19 | API-36, E2E-04 |
| AC-20 | API-39, API-40, UI-06 |
| AC-21 | API-12, API-13 |
| AC-22 | Responsive/visual checklist (`ui-spec.md` §12) |
| AC-23 | Responsive/visual checklist (`ui-spec.md` §12) |

## 4. Responsive and Visual Checklist

Executed at 1440×900, 820×1024, 390×844 against `ui-spec.md` §12 and the screenshots in
`artifacts/lab-03/screenshots/`, comparing against the spec rather than memory. Recorded here as
`Planned` until Issue 7 (Visual QA) runs it for real.

| Screen | 1440×900 | 820×1024 | 390×844 |
|---|---|---|---|
| Login | Planned | Planned | Planned |
| Change Password | Planned | Planned | Planned |
| Staff Ticket Queue | Planned | Planned | Planned |
| Staff Ticket Detail | Planned | Planned | Planned |
| User Management | Planned | Planned | Planned |

## 5. Test Commands

```
# Backend (requires a migrated + seeded PostgreSQL)
cd server
npx prisma migrate deploy
npx prisma db seed
npm test

# Frontend
cd client
npm test

# End-to-end (starts both servers)
npx playwright test
```

## 6. Final Results

Filled in as each Issue lands, mirroring Lab 2's practice — not reconstructed after the fact.

Issue 27 (Authentication foundation): server 36/36 (19 Lab 1+2, 17 Lab 3 — 8 unit + 9 API), client
24/24 (17 Lab 1+2, 7 Lab 3), E2E 5/5 (2 Lab 2, 1 Lab 2 visual, 2 Lab 3), all re-run to confirm no
flakiness.

Issue 28 (Requester regression + Public Comments): server 43/43 (27 Lab 1+2 — the 4 migrated Lab 2
Requester/Attachment API suites now authenticate via real cookie login instead of the removed
`X-Dev-Requester-Id` header, and the dev-only `/api/dev-requesters` test was deleted along with the
route it covered — plus 16 Lab 3, 8 unit + 8 API), client 22/22 (Lab 1+2's `RequesterSelection.test.tsx`
deleted along with the page; `CreateTicket`/`MyTickets`/`RequesterTicketDetail` tests now authenticate
via `AuthProvider` + a mocked `/api/auth/me` instead of `RequesterProvider`; new
`client/tests/lab-03/RequesterTicketDetail.test.tsx` covers UI-07). All re-run to confirm no flakiness.
Manual verification: full Requester login → list → detail → Public Comment → Problem Appears Resolved
→ logout flow exercised against real running dev servers (curl for the API, a live browser for the UI).

Issue 29 (IT Staff Ticket Queue): server 57/57 (14 new — 12 API on `GET /api/staff/tickets` covering
the role gate, cross-Requester visibility, search, every filter individually and combined, both sort
directions, and pagination, plus 2 on the new `GET /api/staff/users` endpoint that the Ticket Owner
filter needed but wasn't in the original contract), client 26/26 (4 new UI-04 tests: multi-Requester
rows, empty state, no-results state, failure+Retry). E2E unchanged at 7/7 (dedicated Staff flow E2E
coverage lands in Issue 32 per the plan, matching how Lab 2 consolidated its E2E specs into its own
visual-QA Issue). All re-run to confirm no flakiness. Manual verification: logged in as IT Staff and as
a Requester in a real browser — the Requester correctly sees no "My Queue" nav link and gets a safe
"Not authorized" page on direct navigation to `/staff/tickets`; the Queue's filters, sorting, and the
390px stacked-card layout (no horizontal overflow) all confirmed against the real running app.

## 7. Known Limitations or Deferred Tests

- Session-expiry (BR-11, API-07) is tested by issuing a token with a manually-set past expiry rather
  than waiting out a real 8-hour window.
- Actions Taken, formal SLA/escalation, and notification tests are out of scope for Lab 3 (deferred to
  Lab 4 per the labsheet).
- `e2e/lab-03/authentication.spec.ts`'s first-login test necessarily consumes one seeded Requester's
  (Jennifer Anderson's) temporary-password state, since no account-creation capability exists yet to
  give it a disposable one (that lands in Issue 31, Administrator User Management). The test restores
  her *password* but not her `mustChangePassword: true` flag, since a successful change-password call
  always clears that flag by design (BR-02) — there is no API yet to set it back without also changing
  the password again. Re-run `npx prisma db seed` between an E2E run and a server-test run in the same
  session; `server/tests/lab-03/auth.api.test.ts` itself no longer depends on this shared fixture
  (it uses its own dedicated throwaway user) precisely because of this discovered fragility.
- Load/performance testing of the Staff Queue at large Ticket counts is out of scope for this course lab.
- Lab 2's `MyTickets.test.tsx` previously had a test ("reloads the list to the newly selected Requester
  after switching") that exercised the dev-only `RequesterContext.changeRequester()` escape hatch. That
  mechanism no longer exists under real auth (switching identity now means logging out and back in as a
  different account, a full page/state reset, not a same-session context switch), so the test was
  removed rather than adapted — there is no real-auth equivalent scenario to translate it into.
