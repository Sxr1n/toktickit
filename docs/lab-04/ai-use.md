# Lab 4 - AI Use and Reflection

I used **Claude Code**, running **Claude Sonnet 5**, as the AI coding agent for Lab 4, continuing
from Labs 1-3. It planned the sprint in Plan Mode first (researching the exact current schema, routes,
and client structure before proposing the `ActionTaken` model and dashboard design), then implemented
every Issue in the same Issue → branch → PR → review → merge rhythm as the prior labs, driven mostly
by a one-line "ทำต่อได้เลยครับ" (continue) after each merge.

## Selected key prompts

| Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|
| Continue from the uploaded Lab 4 sheet | "ทำงานต่อตามไฟล์ที่ให่ไป" (continue work per the file given) | Went into Plan Mode immediately rather than starting to code, since this was a whole new sprint. Launched two parallel research agents (current backend state, current frontend state) before designing anything, then a dedicated Plan agent to synthesize a concrete Issue-by-Issue plan grounded in the real current files rather than assumptions carried over from Lab 3. |
| Land the uncommitted Lab 3 fixes first | (part of the same planning pass, not a separate prompt) | The plan itself surfaced something I hadn't been asked about: the previous session had real, tested Lab 3 fixes (the Zen Green CSS bug, date-locale bug, pagination overflow bug) sitting uncommitted on `lab3-staging`. Treated landing them as its own small Issue (#46) before cutting `lab4-staging`, rather than silently folding "finish Lab 3" into "start Lab 4" — this kept the commit history honest about what belonged to which sprint. |
| Merge confirmations | "ทำต่อได้เลยครับ" / "merge #50 ให้แล้วครับ" / "pull 47 merge ไปแล้ว" | Repeated after each PR merged. One of these ("merge #50 ให้แล้วครับ") surfaced a real tool-level guardrail: the harness blocked me from self-merging a PR without a prior human review, even a pure release-ceremony one — had to ask the account holder to click merge directly rather than find a workaround, which is exactly the right behavior for an irreversible, visible action like a merge. |
| Ponytail mode toggled on and off mid-sprint | "/ponytail lite" then "/ponytail full" then "/ponytail off", each with no other instruction | Treated each as a pure mode-setting message, not an implicit "yes, proceed" to the pending question I'd just asked (whether to start the Dashboard UI Issue) — a mode change and an answer to a specific question are different things, and conflating them would have started real work on an assumption nobody actually confirmed. |
| Final hardening kickoff | "ทำต่อได้เลยครับ", after the Dashboard UI PR merged | Discovered mid-pass that the three stacked PRs (#52/#54/#56) had each merged into their stacked *parent* branch, not directly into `lab4-staging` — a real structural gap, not yet visible from PR status alone. Opened a small consolidation PR (#57) to land the full stack in one step before starting the actual hardening work, rather than assuming "merged" meant "on the integration branch." |
| Audit real review comments, not just merge status | (self-directed, following the explicit lesson from Lab 3's own `ai-use.md`) | Pulled every real review comment and reply on PRs #52/#54/#56/#57 directly from the GitHub API rather than trusting that "Approved" meant nothing was owed. Found two cases where a review follow-up had been promised in a reply ("ok boss I will fix it!") but never actually implemented — the exact failure mode Lab 3's retrospective named as its biggest lesson, recurring in a new sprint. Fixed both for real this time, and fixed the same silent-error-swallowing pattern everywhere it existed (Public Comments and Internal Notes too), not only in the one spot the review happened to point at. |

## Reflection

The single most important habit from this sprint was distrusting my own status summaries and checking
the real repository state directly, repeatedly, rather than assuming "the PR says Approved" or "I
replied to the review" meant the work was actually done. Two separate moments confirmed this was
necessary: discovering that stacked PRs had merged into intermediate branches rather than
`lab4-staging` itself (invisible from each PR's own "Merged" badge, only visible by diffing branches
directly), and discovering that two reviewer follow-ups genuinely promised in a reply comment had
never been implemented. Neither would have surfaced from a normal "did the tests pass" check — both
needed someone to go back and compare what was *said* against what the code actually *does*, which is
exactly the discipline Lab 3's own `ai-use.md` named as its central lesson and which this sprint
proved isn't a one-time fix but an ongoing habit that has to be re-applied deliberately at every
release-integration point, not assumed to carry over automatically from having learned it once.

A secondary reflection: the harness-level block on self-merging a PR without a prior human review
(even for a pure merge-ceremony PR I was confident about) was a useful forcing function, not an
obstacle to route around. It kept a human genuinely in the loop on an action that's hard to reverse
cleanly, which matters more than my own confidence that a particular merge was "obviously fine."
