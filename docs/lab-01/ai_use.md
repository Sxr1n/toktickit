# Lab 1 - AI Use and Reflection

I used **Claude Code**, running **Claude Sonnet 5**, as the AI coding agent for this lab. It had
direct terminal, filesystem, and `gh` CLI access in my environment, so I could delegate execution
of git/GitHub setup and project scaffolding while reviewing every command and file before it ran.

## Selected key prompts

| Prompt Name | Actual Prompt Text | My Reflection |
|---|---|---|
| Initial Git/GitHub setup | "ช่วยผม set up หน่อย" (help me set it up), after sharing the Lab 1 Git & GitHub cheat sheet PDF | Vague on purpose to see what it would ask. It came back with clarifying questions (git identity, whether to install `gh` CLI) instead of guessing - I preferred that over it picking defaults silently. |
| Approve gh CLI install | "ทำเลย" (just do it) | One-word approval after it explained what it needed (browser OAuth device-code flow) and why it couldn't complete that step itself. It correctly stopped and gave me a one-time code to authorize in my own browser rather than trying to fake or skip authentication. |
| Full Lab 1 requirements | Uploaded the official Lab 1 labsheet PDF, asked: "วางแผนว่าผมต้องทำอะไรบ้าง" (plan what I need to do) | This triggered plan mode. It read the whole labsheet, cross-checked it against the repo state from the earlier session, and surfaced two mismatches I hadn't noticed myself: the Project board title didn't match the required exact name, and the Kanban card for the foundation issue was still sitting in Backlog even though a PR was already open for it. |
| Scope decision for this pass | Answered the agent's clarifying questions: install PostgreSQL natively via winget, skip peer-reviewer setup for now, implement only Issue 1 in this pass | Rather than assuming an approach, it asked a multiple-choice question with a recommended default for each open decision (DB setup method, whether to wait on a partner, how much code to write). Kept me in control without slowing things down. |
| Review the plan file | (implicit - reviewed the written plan before approving via ExitPlanMode) | The written plan named exact commands, file paths, and package choices instead of vague steps, so I could actually verify it before saying go. |

## Reflection

The most useful pattern was the agent stopping at anything requiring my own credentials or
judgment - GitHub OAuth login, and the plan-mode gate before touching the filesystem for the
big scaffolding pass - instead of trying to route around them. When a tool it tried failed
(e.g. `ts-node-dev` crashing against the installed TypeScript version), it diagnosed the actual
error, swapped to a maintained alternative (`tsx`), and re-verified the fix by actually running
the dev server again rather than assuming the swap worked. I still reviewed every diff and command
myself before trusting the result — the agent executed, but I stayed responsible for the outcome.

This file will be extended with more prompts as Issues 2-4 are implemented.
