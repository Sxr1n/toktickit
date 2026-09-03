# Lab 2 Test Plan and Results

## 1. Test Strategy

Tests are planned from `specification.md`'s FR/BR/AC before implementation (Test DD), then implemented
red-then-green per Issue (TDD). Coverage spans API (Supertest), UI component (Vitest + Testing Library),
and end-to-end (Playwright), plus a manual responsive/visual checklist. Every AC below maps to at least
one automated test; no test is written without a traceable requirement behind it.

## 2. Planned Tests

| Test ID | Type | AC / Requirement | What It Tests | Expected Result | Test File | Status |
|---|---|---|---|---|---|---|
| API-01 | API | AC-01 | Create a valid Ticket | 201; Ticket saved; unique Ticket Number returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-02 | API | AC-04 | Create Ticket missing Summary | 400 with field-level error; no Ticket saved | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-03 | API | AC-05 | Create Ticket with too-short Description | 400 with field-level error | `server/tests/lab-02/create-ticket.api.test.ts` | Pass |
| API-04 | API | AC-12, BR-05 | List Tickets scoped to requester | Only the calling Requester's Tickets returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-05 | API | BR-25 | Search by keyword | Only matching Ticket Number/Summary rows returned | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-06 | API | AC-16 | Paginate ticket list | Correct page slice + pagination metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-07 | API | BR-23, BR-24 | Invalid page/sort params | Falls back to defaults instead of erroring | `server/tests/lab-02/my-tickets.api.test.ts` | Pass |
| API-08 | API | AC-17 | Get owned Ticket detail | 200 with full Ticket + attachments | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-09 | API | AC-03, AC-18 | Get another Requester's Ticket | 404, no data exposed | `server/tests/lab-02/ticket-detail.api.test.ts` | Pass |
| API-10 | API | AC-08 | Upload valid attachment (JPG <5MB) | 201, Attachment recorded | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-11 | API | AC-09 | Upload 6MB file | 400 `FILE_TOO_LARGE`, nothing stored | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-12 | API | AC-10 | Upload unsupported type | 400 `UNSUPPORTED_TYPE`, nothing stored | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-13 | API | AC-11 | Upload 6th active attachment | 400 `ATTACHMENT_LIMIT_REACHED` | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-14 | API | AC-20 | Soft-remove an attachment with reason | 200, `isRemoved=true`, reason stored, file retained | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-15 | API | AC-21 | Download a removed attachment | 404, download blocked | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| UI-01 | UI | — | Create Ticket renders all required fields | Category, Related System, Summary, Description, Priority, Attachments present | `client/tests/lab-02/CreateTicket.test.tsx` | Covered incidentally by UI-02/04/05 (all query these fields) |
| UI-02 | UI | AC-04 | Submit without Summary | Field-level message shown; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-03 | UI | AC-06 | Submit valid form | Submit button shows busy state and is disabled | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-04 | UI | AC-07 | Backend unavailable on submit | Safe error shown; entered values preserved | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-05 | UI | AC-09, AC-10 | Select invalid attachment (size/type) | Client-side rejection message; no upload call | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-06 | UI | AC-14 | My Tickets with zero Tickets | Empty state shown, distinct CTA | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-07 | UI | AC-15 | Search/filter yields no matches | No-results state shown, distinct from empty | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-08 | UI | AC-13 | Change Requester while on My Tickets | List reloads to the new Requester's Tickets only | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-09 | UI | AC-17 | Ticket Detail header rendering | All header fields rendered read-only (non-editable) | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-10 | UI | AC-20 | Removed attachment rendering | Shown muted with reason; Download disabled | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-11 | UI | BR-21 | Remove-attachment confirm flow | Confirm stays disabled until a reason is entered | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pass |
| UI-12 | UI | AC-22, AC-23 | Requester Selection empty/error | Empty state disables Continue; failure shows safe error | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass |
| API-16 | API | BR-06 | List Development Requesters | Only active Requesters returned, inactive excluded | `server/tests/lab-02/dev-requesters.api.test.ts` | Pass |
| E2E-01 | E2E | AC-01, AC-19, AC-20 | Full flow: select Requester → create Ticket → find in My Tickets → open Detail → add + remove Attachment | Each step succeeds; final state matches | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-12, AC-13 | Switch Requester mid-session | Requester A's Ticket no longer visible after switching to B | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Covered by |
|---|---|
| AC-01 | API-01, E2E-01 |
| AC-02 | (Requester-selection guard — covered structurally by every UI test requiring a selected Requester; explicit case in UI-12) |
| AC-03 | API-09 |
| AC-04 | API-02, UI-02 |
| AC-05 | API-03 |
| AC-06 | UI-03 |
| AC-07 | UI-04 |
| AC-08 | API-10 |
| AC-09 | API-11, UI-05 |
| AC-10 | API-12, UI-05 |
| AC-11 | API-13 |
| AC-12 | API-04, E2E-02 |
| AC-13 | UI-08, E2E-02 |
| AC-14 | UI-06 |
| AC-15 | UI-07 |
| AC-16 | API-06 |
| AC-17 | API-08, UI-09 |
| AC-18 | API-09 |
| AC-19 | E2E-01 |
| AC-20 | API-14, UI-10, E2E-01 |
| AC-21 | API-15 |
| AC-22 | UI-12 |
| AC-23 | UI-12 |
| AC-24 | Responsive/visual checklist (§4) |

## 4. Responsive and Visual Checklist

See `ui-spec.md` §"Visual inspection checklist". Playwright captures screenshots at desktop (1280px),
tablet (834px), and mobile (390px) for Create Ticket, My Tickets, and Ticket Detail into
`artifacts/lab-02/screenshots/`, checked against that list before Lab 2 is marked done.

## 5. Test Commands

```
cd server && npm test      # API-* (Supertest)
cd client && npm test      # UI-* (Vitest + Testing Library)
npx playwright test        # E2E-* (from repo root, once configured)
```

## 6. Final Results

To be filled in once each Issue lands — not reconstructed after the fact. Update the Status column in
§2 to `Pass` with real terminal output captured per Issue's PR.

## 7. Known Limitations or Deferred Tests

- Unit-level tests (e.g. Ticket Number generator format) are folded into the relevant API test file
  rather than a separate unit suite, since the generator has no meaningful behavior outside ticket
  creation.
- Playwright/E2E setup itself is scoped to the "Visual QA, responsive & E2E" Issue, not the earlier
  feature Issues — those land with their own API/UI tests first.
- `server/vitest.config.ts` sets `fileParallelism: false`: the API tests are real integration tests
  against one shared PostgreSQL database rather than a mock, so test files must run one at a time or
  fixture setup/teardown in one file can race with another (this surfaced as a real flaky failure while
  building Issue #14 and was fixed at the config level, not by patching individual tests).
