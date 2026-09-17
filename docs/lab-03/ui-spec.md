# Lab 3 Zen Green UI Specification

Related documents: specification.md · api-spec.md · tests.md

This document extends `docs/lab-02/ui-spec.md`. All color tokens, typography, spacing, and component
states defined there are reused verbatim — Lab 3 introduces no new tokens, only new screens and one new
badge family (role).

## 1. Reused foundation (from Lab 2, unchanged)

`--color-primary #006B3C`, `--color-secondary #0B7A46`, `--color-pale #EAF6EF`, `--color-bg #F5F7F6`,
`--color-surface #FFFFFF`, `--color-text` dark charcoal-green, `--color-field-editable-bg`,
`--color-field-readonly-bg`, `--color-error`, `--color-warning`, `--color-success`. Same 8px spacing
scale, same editable/read-only/disabled/error field states, same button hierarchy, same responsive
breakpoints (desktop ≥ 992px, tablet 768–991px, mobile < 768px), same accessibility rules (labelled
inputs, visible focus, `aria-invalid`/`aria-describedby`, no color-only meaning).

## 2. New badge family — Role

| Role | Badge |
|---|---|
| Requester | neutral gray-green pill |
| IT Staff | `--color-secondary` pill |
| Administrator | `--color-primary` filled pill |

Role badges use the exact same geometry (padding, radius, font-size) as Lab 2's Priority/Status badges,
so all badge families read as one system.

## 3. Application shell (extended)

- Replaces the Lab 2 "Development Requester" name + Change Requester button with: authenticated user's
  name, a role badge, and a Logout button.
- Navigation is role-conditional, computed once from `user.role`:
  - **Requester**: My Tickets, Create Ticket.
  - **IT Staff**: My Queue, Create Ticket.
  - **Administrator**: Admin.
- No destination outside a role's list is ever rendered in the DOM (not just hidden via CSS) — verified
  by a UI test asserting `queryByRole('link', { name: ... })` returns null for unauthorized links.
- Mobile hamburger collapse behavior is unchanged from Lab 2's fix (the real toggle, not
  `navbar-expand`).

## 4. Login screen

Single centered card, max-width 420px, on `--color-bg`.

1. TokTickIT title.
2. Email field (type `email`, required).
3. Password field (masked, with a show/hide toggle for usability — optional nice-to-have, not required).
4. Sign In button — primary, shows a busy state and is disabled while the request is in flight.
5. A single safe error banner below the form on failure: "Invalid email or password." — identical text
   for wrong password and inactive account (BR-07).

States: initial, validation (empty field → inline message, no request sent), submitting, failure (safe
banner, fields retain entered values except password), success (redirects to `/` or `/change-password`
depending on `mustChangePassword`).

## 5. Change Password screen (mandatory first-login gate)

Rendered instead of any other authenticated screen whenever `mustChangePassword` is true — a route
guard, not a dismissible modal.

1. Heading: "Change Your Password" + explanatory line ("You must set a new password to continue.").
2. Current (temporary) password field.
3. New password field.
4. Confirm new password field.
5. Live rule checklist (≥8 chars, upper, lower, digit, special char) — each rule shows a check/cross as
   the user types, mirroring the labsheet's own illustrative screen.
6. Continue button — disabled until all rules pass and confirmation matches; busy state on submit.
7. Safe error banner if the current password is wrong, or if the new password fails a rule server-side
   despite passing client-side (defense in depth).

On success, the app proceeds into the normal shell for the user's role.

## 6. Requester Ticket Detail (extended)

Unchanged Lab 2 layout (read-only header, Attachments section) plus, below Attachments:

- **Public Comments** thread: chronological list (author name + role badge + timestamp + body), a
  textarea + Post Comment button beneath. Empty state: "No comments yet."
- **Problem Appears Resolved** action: a single button, becomes a muted confirmation chip once clicked
  ("You indicated this looks resolved on <date>") rather than disappearing, so the Requester sees their
  own prior signal. Does not change the Current Status badge.

## 7. IT Staff Ticket Queue

Header row: title + one-line description, no "Create Ticket" primary action here (Create Ticket lives in
its own nav destination, matching the labsheet's Figure).

Filter bar: search input (placeholder "Search by ticket number or summary…"), Status select, IT Priority
select, Ticket Owner select (`All`, `Unassigned`, or a named IT Staff member), each defaulting to "All".

**Desktop (≥768px): table.** Columns: Ticket No., Created Date, Summary, Category, Req. Priority, IT
Priority, Status, Ticket Owner. Sortable columns carry `aria-sort`. The whole row links to Ticket Detail.

**Mobile (<768px): stacked cards.** Ticket No. + Created Date on line 1, Summary prominent, then
Category, both priority badges, Status badge, and Ticket Owner (or "Unassigned" in muted text) on the
last line.

Footer: pagination, same style as Lab 2's My Tickets.

States: loading (skeleton rows, filter bar stays interactive), loaded, empty (no Tickets exist at all —
unlikely post-seed but still designed: "No tickets in the system yet."), no-results (filters matched
nothing, with Clear Filters), failure (safe message + Retry).

## 8. IT Staff Ticket Detail

Extends the Lab 2 Ticket Detail layout. Ticket information card gains two editable controls inline with
the otherwise-read-only fields, visually marked editable (white bg, bordered, per the editable-field
token) against the surrounding read-only fields:

- **Ticket Owner**: a select of active IT Staff/Administrator users, plus "Unassigned"; changing it
  calls the claim/reassign endpoint immediately (optimistic update with rollback on failure).
- **IT Priority**: a select of LOW/MEDIUM/HIGH, editable; Requested Priority stays read-only beside it
  for comparison.
- **Current Status**: a select constrained client-side to the permitted next statuses from BR-21 (the
  server is the authority; the client narrows the choices as a UX courtesy, not a security control).

Below the ticket information card, two visually distinct tabbed or side-by-side sections:

- **Public Comments** — `--color-pale` background tint, visible to everyone; same thread UI as the
  Requester's view, IT Staff can also post here.
- **Internal Notes** — a warm, clearly different tint (e.g. a soft amber-gray, never green, so it cannot
  be mistaken for a Public Comment section at a glance) with a small "Internal — not visible to
  Requester" label repeated above the input box, not just once at the top of the page.

Existing Attachments list is unchanged from Lab 2 (IT Staff can view/download, per FR-13; upload/remove
remain Requester-only per Lab 2's ownership model unless a later lab changes this).

## 9. Administrator User Management

Single screen, two-pane layout at desktop (list left, create/edit panel right, opening on demand),
stacked at mobile — closely matching the labsheet's own illustrative screen.

**List pane**: search input, role filter select, table/cards of Name/Email/Role/Status/Edit action. No
pagination control (explicitly excluded).

**Create/Edit panel**: Name, Email, Role select, Active toggle, and — create mode only — Initial
Password field; edit mode instead shows a "Set New Password" button that opens a small confirm-only
sub-form (new password + confirm) separate from the main Save action, so resetting a password is a
deliberate, distinguishable step from editing profile fields.

Save button disabled while a required field is invalid or while a duplicate-email check is pending.
Deactivate button (edit mode only) is disabled with an explanatory tooltip when the target is the
caller's own account or the last active Administrator (BR-29/BR-30) — the disabled state is a UX
courtesy; the same rule is enforced again server-side.

States: loading, loaded, empty (no users — effectively impossible post-seed, still designed),
no-results (search/filter matched nothing), validation (inline field messages), success (toast + list
refresh), forbidden (a non-Administrator hitting this route via direct URL sees a safe "not authorized"
screen, not a blank page), failure (safe error, retry).

## 10. Responsive rules

Identical to Lab 2 §8: multi-column at desktop, two-column at tablet keeping Summary/Description full
width, stacked with ≥44px touch targets at mobile, no horizontal page scrolling at any size, no clipped
labels/overlapping messages/unreadable truncated names.

## 11. Accessibility

Identical to Lab 2 §9, plus: the Change Password rule checklist announces newly-satisfied rules via
`aria-live="polite"`; the Internal Notes section's "not visible to Requester" label is real text (not a
tooltip-only affordance) so it is read by assistive technology without a hover.

## 12. Visual inspection checklist

Performed at 1440×900, 820×1024, 390×844 against the screenshots in `artifacts/lab-03/screenshots/`.

- Header/nav uses the same tokens as Lab 2; role-specific nav renders correctly per role.
- Role badges are geometrically identical to Priority/Status badges.
- Login and Change Password are usable and unclipped at all three widths.
- Editable vs. read-only fields remain visually distinguishable on IT Staff Ticket Detail.
- Public Comments vs. Internal Notes are unmistakably different at a glance, not just by a header label.
- Administrator panel's disabled-button states (self-deactivation, last-Administrator) are visible, not
  just functionally blocked.
- No clipping, overlap, or horizontal scrolling on any new screen at any breakpoint.

## 13. Screenshot paths

```
artifacts/lab-03/screenshots/
├── authentication/    login states, change-password states, logout, direct-access-blocked
├── staff-queue/       loaded, filtered, sorted, paginated, empty, no-results, failure, responsive
├── staff-ticket-detail/  claim, reassign, IT Priority, status transition, comments, notes, responsive
└── user-management/   list, create, edit, validation, safety-rule blocks, responsive
```
