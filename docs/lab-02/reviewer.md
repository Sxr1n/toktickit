# Lab 2 - Peer Review Log

Reviews for this lab happened within the same review pool as Lab 1 — exchanged across each student's
individual `toktickit` repo, not a single fixed pair.

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

### [PR #17](https://github.com/Sxr1n/toktickit/pull/17) - docs: Lab 2 sprint specification
- Reviewer: **Beethoven190** — Approved
- Comment: line-by-line evaluation against the Lab 2 rubric (scope, BR-01–BR-14, AC traceability, Zen
  Green tokens, API contract, branch target) — "Outstanding work... Approved!"
- Response: "@Beethoven190 thak you!"

### [PR #18](https://github.com/Sxr1n/toktickit/pull/18) - feat: Development Requester context
- Reviewer: **Beethoven190** — Approved
- Comment: checked the `RequesterUser` model, idempotent seed (4 active + 1 inactive), inactive-Requester
  filtering, selection screen styling, and Change Requester behavior against Lab 2 criteria — "Approved
  for merge!"
- Response: "@Beethoven190 Thank you!"

### [PR #19](https://github.com/Sxr1n/toktickit/pull/19) - feat: Create Ticket
- Reviewer: **SANOP19** — Approved
- Comment: detailed pass over schema/migrations, the `requireRequester` middleware, backend validation
  ranges, the atomic ticket-number transaction, and `AttachmentPicker` UX; non-blocking suggestions to
  show an inline alert when no Requester is selected and to add a character counter. "Ready to merge."
- Response: "@SANOP19 Thank you!"

### [PR #20](https://github.com/Sxr1n/toktickit/pull/20) - feat: My Tickets
- Reviewer: **Leviathan-c137** — Approved
- Comment (Thai): confirmed ownership isolation via `requireRequester`, case-insensitive search with
  bounded pagination, correct empty-vs-no-results distinction, and Zen Green badge tokens; suggested
  resetting to page 1 on a new search and using Prisma `include` to avoid client-side
  category/related-system name lookups.
- Response: "@Leviathan-c137 Thank you. I will fix it!"

### [PR #21](https://github.com/Sxr1n/toktickit/pull/21) - feat: Ticket Detail and Attachments
- Reviewer: **narakosi-dev** — Approved
- Comment: verified ownership/access control on every attachment endpoint, the soft-removal pattern,
  UI-09/UI-10/UI-11 behavior, and the `fileParallelism: false` fix for the database test race. "Approved!
  🚀"
- Response: "@narakosi-dev Thank you!"

### [PR #22](https://github.com/Sxr1n/toktickit/pull/22) - feat: Visual QA, responsive checks, and E2E
- Reviewer: **FramePongrit** — Approved
- Comment: praised catching the mobile nav overflow via the visual QA pass; suggested adding an automated
  `scrollWidth <= clientWidth` assertion to `visual-checklist.spec.ts` instead of relying on someone
  noticing overflow in a screenshot.
- Response: initially just "thank you!" — **acted on afterward** during release integration: added the
  exact assertion suggested, at every screen/viewport combination (see `tests.md` §4).

## Reviews I gave on partners' repos

### [Leviathan-c137#27](https://github.com/Leviathan-c137/toktickit/pull/27) - Sprint 2 spec and test plan
- Approved, with feedback: unspecified behavior for a non-numeric `x-requester-id` header, missing
  explanation of how `itPriority` differs from `requestedPriority` post-creation, and a note that
  `reviewer.md`/`ai-use.md` still had placeholder rows (expected at that stage, flagged so it isn't
  forgotten). api-spec.md itself judged ready to merge.
- Response: "Danke!"

### [Leviathan-c137#31](https://github.com/Leviathan-c137/toktickit/pull/31) - Ticket Detail and Attachment Lifecycle
- Approved, with feedback: praised the `selectedTicketId` reset on tab/requester switch and the removed
  debug `console.log`; asked whether the removed-attachment-download case (spec says `410 Gone`) is
  distinguished from generic errors anywhere in the UI, and suggested optional client-side size/type
  pre-checks before upload.
- Response: "Danke!"

### [Davidice23#24](https://github.com/Davidice23/toktickit/pull/24) - Sprint engineering contract and test plan
- Approved, with feedback: flagged a possible check-then-insert race on the 5-attachment limit, asked for
  an explicit "not a security boundary" callout for the `X-Requester-Id` header, questioned
  idempotency-key retention semantics and whether search case-insensitivity is DB-collation-dependent,
  and spotted a gap (AC-28/AC-29) in the traceability table.
- Response: "Thank!!"

### [Davidice23#25](https://github.com/Davidice23/toktickit/pull/25) - Resolve Issue #15 contract review feedback
- Approved, after verifying all 5 points from #24 were resolved (row-lock transaction for the attachment
  race, README/spec security-boundary warnings, composite unique idempotency key + payload hash,
  explicit Prisma `insensitive` mode, and confirmation on the traceability table). Called out the new
  `reviewer.md` process and the honest `ai-use.md` reflection as good additions beyond what was asked.
- Response: "Thank you!"

### [FramePongrit#42](https://github.com/FramePongrit/toktickit/pull/42) - Fix pagination overflowing the viewport on mobile
- Approved, with feedback: asked how a user discovers the pagination row scrolls horizontally (no visible
  cue), suggested truncated pagination as a longer-term alternative, and pointed out the root cause of
  the growing page count — E2E tests not cleaning up the tickets they create.
- Response: "Ok got it, appreciate that"

### [FramePongrit#45](https://github.com/FramePongrit/toktickit/pull/45) - Lab2 Release fix
- Approved, as a release-process check rather than a code review: confirmed the merge-commit strategy
  carrying full branch history into `main` was intentional, confirmed the base branch target, and asked
  whether `main`'s required checks had actually run given the PR showed 0 checks.
- Response: "Big Thanks bro, really appreciate ur approval!!"
