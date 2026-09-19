# Lab 3 - Peer Review Log

Reviews for this lab happened within the same review pool as Labs 1 and 2 — exchanged across each
student's individual `toktickit` repo, not a single fixed pair.

## Reviewers

| Name                        | Student ID  | GitHub handle    |
|------------------------------|-------------|--------------------|
| นายนรา โกสิยาภรณ์              | 67070505218 | `narakosi-dev`     |
| นายตันติยวัตร จันทร์ศิริ         | 67070505216 | `Leviathan-c137`   |
| นายพลกฤษณ์ เบ้าวรรณ            | 67070505204 | `FramePongrit`     |
| นายวชิรวิทย์ พจน์จำเนียร        | 67070505206 | `Davidice23`       |
| นายศุภณัฐ วัฒนะสิมากร           | 67070505226 | `Beethoven190`     |
| นายนิติธร เกตุแก้ว              | 67070505203 | `SANOP19`          |

## Reviews received on this repo (Sxr1n/toktickit)

**Davidice23** reviewed every Lab 3 PR (34–41) with detailed, substantive feedback — the most
thorough review coverage this repo received across all three labs. My replies at the time were
consistently underwhelming ("thank you!", "ok boss!") without actually engaging with the
substance, and several PRs with explicit "Request changes" reviews were merged without those
changes ever being made. Issue 33's final QA pass went back through every one of these threads to
check what had genuinely been resolved versus just acknowledged, and acted on what was still real.
Full account below, organized by what was found.

### [PR #34](https://github.com/Sxr1n/toktickit/pull/34) - docs: Lab 3 sprint specification
- Reviewer: **Davidice23**
- Six points raised: (1) `reviewer.md`/`ai-use.md` missing at that stage — expected for a spec-first
  PR, filled in here in Issue 33; (2) BR-07's wording on inactive-account feedback — the merged
  `specification.md` already states the identical-response behavior the review asked for; (3)
  session lifecycle (8-hour expiry + logout invalidation) — implemented as `tokenVersion` (D-09,
  Issue 27) and documented (BR-10/BR-11); (4) migration/seed safety — the actual
  `RequesterUser`-rename migration and idempotent seed were built exactly as asked, and this
  Issue's API-43 migration replay independently re-verified the migration is lossless; (5) test
  traceability and a direct "Requester can't read Internal Notes" authorization test — delivered
  progressively (`tests.md`'s own Planned→Pass history) and the specific test exists
  (`staff-ticket-detail.api.test.ts`, "rejects a Requester with 403 on both Internal Note routes");
  (6) bcrypt cost factor and rate limiting — cost factor (10) now documented in D-02; rate limiting
  confirmed out of scope for this course lab, noted rather than left silent.

### [PR #35](https://github.com/Sxr1n/toktickit/pull/35) - fix: scope E2E "My Tickets" nav locator
- Reviewer: **Davidice23** — approved, asked to actually run the affected Lab 2 E2E specs on this
  PR's own branch rather than citing the Lab 3 branch as equivalent evidence.
- Not retroactively possible (already merged, `main` has since moved on substantially), but the
  underlying concern is addressed going forward: every subsequent PR in this lab ran its own real
  test suite on its own branch before merging, and Issue 33's evidence is real command output, not
  inference by analogy.

### [PR #36](https://github.com/Sxr1n/toktickit/pull/36) - feat: Authentication foundation
- Reviewer: **Davidice23** — Request changes. Described an "approved Lab 3 Contract" requiring an
  opaque server-side Session table with a one-way hash, `X-CSRF-Token` on mutations, Argon2id
  (memory 65536 KiB, 3 iterations, parallelism 1), 12–128 character passwords, and flagged that the
  `updatedAt` column migration would fail against an existing Lab 2 database.
- Investigated in Issue 33: none of the Session/CSRF/Argon2id/password-length requirements appear
  anywhere in `docs/lab-03/specification.md` or `api-spec.md` as actually written and merged via PR
  #34 — this repo's real, approved contract explicitly documents and justifies JWT-in-httpOnly-cookie
  with `SameSite=Lax` (D-01) and `bcryptjs` (D-02), and BR-06/07/10/11 match exactly what was built.
  The migration claim was checked directly against Lab 2's actual `RequesterUser` migration
  (`20260903154626_add_requester_user`) and found factually incorrect for this repo — that table
  never had an `updatedAt` column before Lab 3 added it, independently reconfirmed by this Issue's
  API-43 migration replay applying that exact migration successfully to a reconstructed pre-Lab-3
  table. Recorded here transparently rather than silently ignored: this review appears to be
  checking against a contract that isn't the one this repo actually approved (plausibly cross-talk
  from reviewing multiple students' repos in the same pool, each with a genuinely different
  contract). If this reading is wrong, happy to revisit — but the evidence for what *this* repo's
  contract says is unambiguous.

### [PR #37](https://github.com/Sxr1n/toktickit/pull/37) - Requester regression + Public Comments (Issue #28)
- Reviewer: **Davidice23** — Request changes. Same Session/CSRF/Argon2id contract mismatch as PR
  #36 (see above), plus endpoint-naming differences (`/comments` vs `/public-comments`, etc.) that
  are also part of that mismatched contract — this repo's actual `api-spec.md` names the endpoints
  exactly as implemented. One point was independent and genuinely valid: **the E2E password-restore
  helper silently swallows failures** (`.catch(() => {})`). Fixed in Issue 33 by retrofitting both
  Lab 2 E2E specs to dedicated throwaway accounts (Issue 31's Admin API made this possible), which
  removes the restore step — and its failure-swallowing risk — entirely.

### [PR #38](https://github.com/Sxr1n/toktickit/pull/38) - IT Staff Ticket Queue (Issue #29)
- Reviewer: **Davidice23** — eight P2 suggestions, all independent of the contract-mismatch issue
  above and all genuinely useful. Addressed in Issue 33: added an index on `Ticket.currentStatus`;
  added an explicit `currentStatus` sort test (previously only `itPriority` was asserted); rewrote
  the pagination test with a real 11-ticket seed so it actually exercises a page boundary (the
  original 3-ticket seed made page 2 trivially empty regardless of correctness); wrapped
  `GET /api/staff/users` in the same error-handling pattern as its sibling routes; added "Req."/"IT"
  labels to the mobile priority badges. The `/staff/tickets/:id` dead-link concern was already
  resolved by the time Issue 30 shipped that route. Left as a conscious, documented deferral rather
  than fixed: the loading-skeleton UX polish and search debounce/`AbortController` guard — both real
  suggestions, but UX robustness rather than correctness, and out of proportion to fix in a
  retroactive QA pass versus the Issue that should have done it originally.

### [PR #39](https://github.com/Sxr1n/toktickit/pull/39) - IT Staff Ticket Detail operations (Issue #30)
- Reviewer: **Davidice23** — Request changes. [P1] the documented contract said
  `GET /api/staff/tickets/:id` should embed Public Comments and Internal Notes, but the
  implementation fetches them separately. [P2] several `NOT_FOUND` responses were missing the
  `error.message` field the contract requires.
- Both real and both addressed in Issue 33. For the P1: chose to fix the documentation rather than
  the design — the split-fetch approach reuses one Public Comments implementation for both the
  Requester and Staff views instead of duplicating it inline, and keeps the base Ticket response
  small regardless of thread length. `api-spec.md` now explicitly documents this as deliberate. For
  the P2: audited every structured `NOT_FOUND` response across `staff.ts`, `admin.ts`, and
  `tickets.ts` (22 occurrences) and added the missing `message` to all of them, not just the ones
  this review happened to point at.

### [PR #40](https://github.com/Sxr1n/toktickit/pull/40) - Administrator User Management (Issue #31)
- Reviewer: **Davidice23** — Request changes, and this was the most consequential review in this
  lab. [P1] the last-active-Administrator safety check was a count then a separate update — two
  concurrent requests could each observe "another active Administrator still exists" and both
  succeed, leaving zero. [P2] Admin mutation endpoints (`POST`, `PATCH`, reset-password) only had
  role-gate coverage through shared middleware, no direct per-endpoint authorization test. [P2] no
  reproducible verification evidence attached, and six unrelated Lab 2 screenshot diffs in the PR.
- The P1 was a genuine, correctly-reasoned bug, confirmed empirically in Issue 33: reverted to the
  old non-atomic shape with an injected delay and the race reproduced immediately (both concurrent
  requests succeeded, leaving zero active Administrators). Fixed by wrapping the check and the
  write in one Postgres Serializable transaction; re-confirmed the fix holds under 5 repeated runs,
  and added a permanent regression test (`users-admin.api.test.ts`) that exercises the race
  directly against the database. The P2 authorization gap was closed with 4 new tests covering
  unauthenticated/Requester/IT_STAFF on every mutation endpoint. The evidence/screenshot-diff
  concern is the same one raised on PR #41 below (this repo has no CI pipeline configured) — see
  that entry.

### [PR #41](https://github.com/Sxr1n/toktickit/pull/41) - Run Postgres in Docker for local development
- Reviewer: **Davidice23** — approved, with three real points: no Issue linkage (this dev-tooling
  work wasn't tied to a tracked Issue), no reproducible verification evidence (no CI pipeline in
  this repo), and six unrelated Lab 2 screenshot diffs.
- All three addressed directly on the PR thread, in order: created retroactive Issue #43 and linked
  it (closed manually since the PR had already merged before the link could auto-close it); posted
  the actual real command output (`docker compose down -v && up -d`, `prisma migrate deploy`,
  `prisma db seed`, `npm test`, `npx playwright test`) as a PR comment, then genuinely re-ran the
  whole sequence fresh before posting to make sure the claim was true rather than copied from an
  earlier run; acknowledged the screenshot diffs as an unintentional side effect of re-running the
  full E2E suite as pre-push verification (Playwright regenerates those files on every run even
  when nothing meaningfully changed), not deliberate scope creep — noted as a lesson for checking
  `git status` before staging on future PRs.

### [PR #42](https://github.com/Sxr1n/toktickit/pull/42) - Visual QA, responsive checks, and E2E for Lab 3 (Issue #32)
- Reviewer: **FramePongrit** — Approved, no blocking feedback. Highlighted the reload-to-verify-
  persistence pattern in the Staff Ticket flow E2E spec, the combination of automated overflow
  assertions with manual screenshot inspection, and the root-cause fix (throwaway accounts) over
  the state-leakage flakiness rather than a workaround.

## Reviews I gave on partners' repos

Not completed as part of this session — this session's scope was implementing and reviewing changes
within `Sxr1n/toktickit` itself. Giving reviews on the other five students' repos (mirroring the
Lab 2 cross-repo review pool) is a separate action the account holder would need to take directly on
GitHub against those repos.
