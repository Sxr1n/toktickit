# Lab 4 - Peer Review Log

Reviews for this lab happened within the same review pool as Labs 1-3 — exchanged across each
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

### [PR #47](https://github.com/Sxr1n/toktickit/pull/47) - Lab 3 finishing touches (Issue #46)

Not a Lab 4 PR, but the immediate predecessor to this sprint's branch. Merged into `lab3-staging`,
released to `main` via PR #50, before `lab4-staging` was cut.

### [PR #49](https://github.com/Sxr1n/toktickit/pull/49) - docs: Lab 4 sprint specification (Issue #48)

Spec-first PR, merged into `lab4-staging` — the Sprint 4 contract existed before any implementation
PR, same proof-of-ordering discipline as every prior lab.

### [PR #52](https://github.com/Sxr1n/toktickit/pull/52) - Actions Taken, Ticket workflow re-confirmation, and Dashboard foundation (Issue #51)

- Reviewer: **FramePongrit** — Approved. Praised the reusable Actions Taken validation, the
  `updatedAt`-based optimistic concurrency, role-based dashboard scoping, and the exhaustive 64-case
  BR-21 transition-matrix test. No blocking or non-blocking follow-ups.

### [PR #54](https://github.com/Sxr1n/toktickit/pull/54) - Actions Taken UI (Issue #53)

- Reviewer: **FramePongrit** — Approved. One real, specific follow-up: `loadActions()` on
  `StaffTicketDetail.tsx` silently swallowed fetch errors, so a failed load would show a false "No
  actions taken yet" instead of telling the user anything failed. Replied "ok boss I will fix it!" at
  the time — **the fix was not actually made until Issue #58's final hardening pass**. Fixed there:
  added an explicit load-failed flag and a safe "Unable to load X" + Retry message to all five
  comment/note/action loaders across both Ticket Detail pages (not only the one case flagged — Public
  Comments and Internal Notes had the identical silent-failure shape already, predating this sprint),
  covered by a new regression test. See `tests.md` §6 for the full account.

### [PR #56](https://github.com/Sxr1n/toktickit/pull/56) - Role dashboards (Issue #55)

- Reviewer: **Davidice23** — No blocking concerns. Confirmed the Home guard correctly routes
  unauthenticated and temporary-password users, the Staff tiles carry the intended queue filters
  (including the caller's own "My Assigned" scoping), and the Requester empty/waiting/populated states
  are clear. One non-blocking follow-up: add an explicit client test for the Dashboard API
  error/retry state in a later hardening pass. Replied "ok boss i will fix it!" — **also not actually
  done until Issue #58**. Staff Dashboard already had this test from Issue #55 itself; Requester
  Dashboard did not. Added the missing test in Issue #58.

### [PR #57](https://github.com/Sxr1n/toktickit/pull/57) - Consolidate Actions Taken UI + Dashboard UI into lab4-staging

Pure merge-ceremony PR (stacked PRs #54/#56 had merged into their parent feature branches, not
directly into `lab4-staging`; this PR landed the full stack in one step with no new code).

- Reviewer: **Davidice23** — No blocking concerns. Explicitly asked for a full Lab 1-4 regression and
  End-to-End run once this landed on `lab4-staging`, to confirm the stacked branches integrate
  cleanly. **This request directly caught a real regression**: `e2e/lab-03/authentication.spec.ts`
  still asserted the old Lab 1 "TokTickIT IT Service Desk" heading at `/`, which Issue #55 had already
  replaced with the role-routed Dashboard. Fixed in Issue #58.

## Pattern across this sprint

Every substantive review this sprint was genuinely engaged with at reply time ("ok boss I will fix
it!"), but in two cases the promised fix did not actually happen until Issue #58's dedicated final
hardening pass went back and checked PR comments against real repository state rather than trusting
that a reply implied the work was done — the same discipline Lab 3's retrospective called out as its
single biggest lesson. Both follow-ups this time were genuine and non-blocking (neither reviewer
treated them as merge-blocking), and both are now actually fixed, not just acknowledged.

## Reviews I gave on partners' repos

Not completed as part of this session — this session's scope was implementing and reviewing changes
within `Sxr1n/toktickit` itself. Giving reviews on the other five students' repos (mirroring the
cross-repo review pool) is a separate action the account holder would need to take directly on GitHub
against those repos.
