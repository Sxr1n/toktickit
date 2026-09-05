# Lab 2 - AI Use and Reflection

I used **Claude Code**, running **Claude Sonnet 5**, as the AI coding agent for Lab 2, continuing from
Lab 1. It drafted the sprint specification, API contract, and UI spec directly from the labsheet PDF, then
I reviewed and adjusted the assumptions before any Issue work began.

## Selected key prompts

| Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|
| Draft the sprint contract | Uploaded the Lab 2 labsheet and the GitHub Workflow Guide, asked: "ช่วยเพิ่มเนื้อหาภายใน file และแบ่งเป็นแต่ละ issue ตามความเหมาะสม" (add content to the spec files and split the sprint into Issues appropriately) | Needed the labsheet's own required sections (FR/BR/AC/data model/API) as scaffolding — without that structure the draft would have been much vaguer. |
| Implement Development Requester Context | "ทำต่อเลย" (just continue), after confirming PR #17 merged | Straightforward once specification.md/api-spec.md already had the RequesterUser model and endpoint contract decided — the agent mostly executed a plan that was already written down, rather than inventing one on the spot. |
| Implement Create Ticket | "มีคน review/merge แล้วครับ" (someone reviewed/merged), after PR #18 merged | Caught its own test bug: a jsdom `userEvent.upload` quirk where the `accept` attribute silently filtered out the "wrong file type" test case before it ever reached the component. Diagnosed it, removed the (non-security-relevant) `accept` attribute, and re-verified rather than leaving a flaky/skipped test. |
| Implement My Tickets | "มี review/merge แล้วครับ" (there's a review/merge), after PR #19 merged | Hit and fixed another test-environment gap on its own: jsdom doesn't apply the CSS that hides the desktop table vs. mobile card layout, so both render at once and duplicate-match test queries. Switched the affected assertions to `findAllByText`/`queryAllByText` instead of relaxing the actual responsive markup. |
| Implement Ticket Detail and Attachments | "มี review/merge แล้ว" (there's a review/merge), after PR #20 merged | Diagnosed a real intermittent test failure caused by Vitest running server test files in parallel against one shared Postgres database — a destructive `deleteMany` in one file's setup was racing another file's fixtures. Fixed it at the config level (`fileParallelism: false`) rather than papering over the symptom, then verified by re-running the suite twice to confirm it wasn't still flaky. Also ran a full real upload → download → soft-remove → blocked-download cycle against the live server via curl, not just the mocked unit tests. |
| Implement Visual QA, responsive checks, and E2E | "ตรวจสอบว่ามีคน comment หรือยัง ถ้ามีแล้วทำต่อได้เลย" (check if anyone commented, if so continue), after PR #21 merged | Set up Playwright, then found three real bugs on the *first actual run* rather than trusting the code on paper: an invalid `test.skip()` call signature, a test selecting the placeholder `<option>` instead of a real one, and the mobile viewport project defaulting to WebKit (not installed). Fixed all three, then a fourth: running the finished spec caught a genuine responsive bug — the nav bar's `navbar-expand` (no breakpoint) never collapsed, clipping the "Change Requester" button off-screen on mobile. Fixed the component itself (not the test) and re-ran to confirm the screenshot was clean. |
| Release integration and final QA | (same continuation pattern), after PR #22 merged | Acted on a partner's actual review suggestion instead of just replying "thank you" to it: FramePongrit's review on PR #22 pointed out that screenshots alone can't fail a test on horizontal overflow, so added a real `scrollWidth <= clientWidth` assertion per viewport. Running the full regression suite 3x in a row then surfaced a genuinely reproducible (not flaky) strict-mode locator bug in the earlier E2E-01 spec — `getByText('Jennifer Anderson')` ambiguously matched a still-transitioning page's leftover `<option>` text. Fixed the race at its source (`waitForURL` before proceeding) instead of just loosening the assertion. |

## Reflection

The pattern that held across every Issue: run the thing for real before calling it done. Every Issue in
this sprint surfaced at least one bug that only showed up when tests actually executed — a `userEvent.upload`
accept-attribute quirk, duplicate-DOM query matches, a database test race, and finally a real
visual clipping bug that only Playwright driving an actual browser could have caught. Static review of the
code would have missed all of them. The main lesson for prompting: asking the agent to "continue" after
each merge worked well *because* the specification, API contract, and UI spec were written in full before
any Issue started — there was rarely a need to stop and ask what to build next, only how to fix what broke
when it was actually exercised.
