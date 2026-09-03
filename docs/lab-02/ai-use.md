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
| (to be extended) | | |

## Reflection

To be expanded as Issues 2-7 are implemented — this file should end up with 6-10 prompts total per the
labsheet's requirement, not just the specification-drafting step.
