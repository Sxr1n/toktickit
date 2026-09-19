# Lab 3 - AI Use and Reflection

I used **Claude Code**, running **Claude Sonnet 5**, as the AI coding agent for Lab 3, continuing
from Labs 1 and 2. It drafted the sprint specification directly from the labsheet PDF and my own
architectural preferences (JWT-in-cookie, `bcryptjs`, the `User` rename-in-place migration), then
implemented all nine Issues plus one unplanned dev-tooling addition (Dockerized Postgres) in the
same Issue → branch → PR → review → merge rhythm as Labs 1 and 2, mostly driven by a one-line
"continue" after each merge.

## Selected key prompts

| Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|
| Plan the sprint | Uploaded the Lab 3 labsheet, asked: "วางแผนเพื่อทำงานในไฟล์ที่ส่งไปให้ต่อ" (plan to continue working on the file sent) | Went through Plan Mode first this time rather than drafting the spec directly — the agent researched the actual Lab 2 codebase (found the two exact choke points for the fake "Dev Requester" mechanism) before proposing the migration approach, which made the eventual `RequesterUser → User` rename a well-reasoned decision rather than a guess. |
| Implement Requester regression + Public Comments | "ทำต่อได้เลยครับ" (continue), after PR #27 merged | Found and fixed a real git mishap on its own: a `git stash` reported success but silently failed to actually clean untracked files on this Windows filesystem, and the agent nearly lost an Issue's worth of uncommitted work before recovering it via `git stash apply <sha>` from the exact commit hash git had printed. Hardened its own practice afterward (switched to `git worktree` for the next isolated fix). |
| Implement IT Staff Ticket Detail | "ทำต่อได้เลยครับ", after PR #30 (Issue 29) merged | Manual verification (driving a real browser via a subagent, not just trusting the passing tests) caught a real bug the tests didn't: the Staff "Download" button silently 403'd because the Lab 2 attachment routes were still Requester-ownership-only with no staff path, despite the spec explicitly requiring staff view/download access. Fixed and covered with new tests in the same pass, rather than filing it as a follow-up. |
| Move Postgres into Docker | "ทำใน docker เลยก็ได้ครับ" (let's just do it in Docker), after I raised it as an unprompted suggestion to fix a recurring database-state-drift problem | This wasn't planned — I noticed the same class of bug (seeded account passwords/flags drifting between test runs, requiring manual fixes) recurring several times and offered Docker as a fix rather than just working around it again. Asked a clarifying question first (containerize just Postgres vs. the whole stack) instead of guessing scope, which mattered: the minimal option (just the database) was the right call and avoided restructuring the whole dev workflow for a Compose file the labsheet never asked for. |
| Visual QA, responsive checks, and E2E | "ทำต่อได้เลยครับ", after PR #40 (Issue 31) merged | This Issue is the clearest example in this lab of *actually looking* mattering more than the assertions passing. The User Management table's `scrollWidth <= clientWidth` check passed cleanly, and the table still had a real bug — Role/Status/Edit silently scrolled out of view inside a nested container, invisible without a page-level scrollbar to notice. Only caught because the agent opened and looked at the screenshot rather than trusting the automated check. Also found the exact same password-drift bug biting a brand-new spec mid-Issue (one spec's cleanup collided with another's setup in the same full-suite run) and fixed it at the source with throwaway accounts, rather than adding another special-case workaround. |
| Sprint 3 release integration and final QA | "ทำต่อได้เลยครับ", after PR #42 (Issue 32) merged | The most consequential correction of the whole lab. Auditing every real PR review comment (not just the merge status) surfaced that a reviewer (Davidice23) had left detailed, substantive feedback — including at least one genuine P1 concurrency bug — on nearly every Lab 3 PR, and the agent's own replies at the time were dismissive one-liners ("thank you!", "ok boss!") that never actually engaged with the content, with several "Request changes" reviews merged anyway without the requested changes. Went back through all of it: fixed the real bug (an atomic last-Administrator check, verified by first reproducing the race with the old code, then confirming the fix under 5 repeated runs), added the missing tests, fixed the missing `message` fields, and fairly investigated the reviews that turned out to reference a contract that doesn't actually exist in this repo's own approved specification — rather than either blindly implementing changes that would have made the app *worse* (swapping a deliberately-justified JWT/bcryptjs design for one nobody in this repo ever approved) or dismissively ignoring a "Request changes" review a second time. |

## Reflection

The single biggest lesson from this lab isn't technical — it's that a quiet "thank you!" to a
substantive code review is a failure mode, not politeness. Every other habit held up well across
the sprint (manual verification against real running servers catching bugs the automated tests
missed, root-causing failures instead of loosening assertions, hardening practice immediately after
a near-miss like the git stash incident), but real reviewer feedback sitting unaddressed across six
PRs went unnoticed for the entire sprint because nothing in the normal "continue" rhythm ever
prompted a look back at what reviewers had actually asked for versus what got merged. It took an
explicit "final QA" Issue — and being asked to audit review comments specifically, not just check
whether PRs were merged — to catch it. The fix going forward isn't a new tool, it's a discipline:
treat "Request changes" as a real state to resolve, not a notification to acknowledge, and audit for
that discipline itself as part of any release-integration pass, not just the code.

A secondary lesson, specific to working with an AI-assisted review pool: not every "Request changes"
is correct just because it's detailed and confident. Two reviews described an entire alternate
authentication architecture — opaque server-side sessions, CSRF headers, Argon2id, a completely
different API surface — with no basis in this repo's own actual specification. The instinct to
immediately implement whatever a reviewer demands is as much a failure mode as ignoring them
outright; the right response was to check the claim against the repo's own source of truth first,
found it didn't hold, and said so plainly and specifically rather than either silently complying or
silently dismissing.
