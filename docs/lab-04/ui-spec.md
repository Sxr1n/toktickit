# Lab 4 Zen Green UI Specification

Related documents: specification.md · api-spec.md · tests.md

This document extends `docs/lab-03/ui-spec.md`. All color tokens, typography, spacing, component
states, and responsive/accessibility rules defined there are reused verbatim — Lab 4 introduces no new
tokens, only new screens and one new section on existing screens.

## 1. Reused foundation (from Lab 2/3, unchanged)

Same `--color-primary #006B3C` / `--color-secondary #0B7A46` / `--color-pale #EAF6EF` / `--color-bg
#F5F7F6` / `--color-surface #FFFFFF` / `--color-text #1B2B24` token set, now correctly implemented as a
real global stylesheet (`client/src/index.css`, fixed in Issue #46) rather than hardcoded per-component
— new Lab 4 UI should prefer the global `.btn-primary`/`.btn-outline-secondary` classes directly rather
than repeating inline color styles, now that they resolve correctly. Same Status/Priority/Role badge
geometry, same editable/read-only/disabled/error field states, same responsive breakpoints (desktop ≥
992px, tablet 768-991px, mobile < 768px), same accessibility rules.

## 2. Application shell (extended)

- Adds one `Dashboard` nav link, visible to every authenticated role (Requester, IT Staff,
  Administrator alike), placed first in the role-conditional nav block in `AppShell.tsx`, pointing at
  `/`.
- No other shell change.

## 3. Home (`/`)

Role-routed, not a screen of its own:

- No session → redirect to `/login`.
- `REQUESTER` → Requester Dashboard.
- `IT_STAFF` or `ADMINISTRATOR` → IT Staff Dashboard.

Replaces the Lab 1 "Check System" scaffold previously at this route (unguarded, unrelated to any real
user — removed in this sprint).

## 4. IT Staff Dashboard

Header: "Welcome back, {name}!" + one-line context, matching the labsheet's own illustrative screen.

**Metric tiles** (`row g-3`, `col-6 col-md` tiles reusing the existing tinted-card token
`backgroundColor: '#F8F9F6', borderRadius: 8`): New, Open, In Progress, Waiting for Requester, My
Assigned — each a large count + label, each tile a link to the Ticket Queue pre-filtered to that
status (My Assigned links to the Queue filtered to `ticketOwnerId=<self>`).

**Recent Tickets**: a `list-group` of the 10 most recently updated Tickets system-wide — Ticket
Number, Summary, Status badge, updated date — each row linking to its Ticket Detail. "View all" links
to the full Ticket Queue.

**Quick Actions**: plain `btn btn-primary`/`btn-outline-dark` links to Create Ticket and the Ticket
Queue, matching the labsheet Figure.

States: loading (skeleton tiles, same pattern as the Ticket Queue's own loading state), loaded, empty
(a tile legitimately at 0 renders "0" plus its label, never blank — only the Recent Tickets list gets a
dedicated "No tickets yet." empty-state message), forbidden (non-staff direct-navigating here never
happens, since `/` is role-routed, not role-gated-and-blocked — a Requester simply sees their own
Dashboard instead), failure (safe message + Retry, same pattern as the Ticket Queue).

## 5. Requester Dashboard

Header: "Welcome, {name}!" + one-line context, matching the labsheet's own illustrative screen.

**Metric tiles**: My Open Tickets, In Progress, Resolved, Closed — same tile styling as the Staff
Dashboard, each linking to My Tickets pre-filtered to that status grouping.

**Tickets Waiting for You** (attention-required callout): a visually distinct tinted panel (pale-green
`--color-pale` background, matching how Lab 3 already flags "needs your attention" states) listing
every one of the caller's own Tickets currently `WAITING_FOR_REQUESTER`, each linking to its Ticket
Detail. Absent entirely (not an empty shell) when the list is empty.

**Recent Tickets**: same `list-group` pattern as Staff, scoped to the caller's own Tickets.

**Quick Actions**: Create Ticket, View My Tickets.

States: loading, loaded, empty (zero Tickets ever created — "You haven't created any Tickets yet,"
with a Create Ticket call to action), forbidden (not reachable — role-routed, not gated), failure (safe
message + Retry).

## 6. Actions Taken on Ticket Detail

**`StaffTicketDetail.tsx`** (editable): a new full-width panel (`row g-3 mt-3`, own tinted background
distinct from both the Public Comments green-tint and Internal Notes tan-tint — a neutral
`--color-surface` card with a bordered header, since Actions Taken is visible to both roles and should
not borrow either role-specific tint) below the existing Public Comments/Internal Notes row:

- A `list-group` of existing Actions Taken, newest first, each showing Description, Result, Follow-Up
  Required (badge, only shown when true) with its Follow-up Note, Attachment Notes (if present),
  Performed By + timestamp, and an inline "Edit" button.
- Clicking Edit swaps that single item's display for its form fields pre-filled, with Save/Cancel —
  same inline-edit pattern already established for the User Management panel's edit mode.
- The create form sits below the list: Description, Result, a Follow-Up Required checkbox, and a
  Follow-up Note field that only appears (and is marked required with a red asterisk) once Follow-Up
  Required is checked — the client mirrors the server's conditional rule as a UX courtesy, the same
  spirit as the existing `TRANSITIONS` client-side mirror comment elsewhere in this file ("the server
  is the authority... this only narrows... as a UX courtesy").
- A stale-edit conflict (409) surfaces as a safe inline error — "This Action Taken was changed by
  someone else. Reloading the latest version." — immediately followed by an automatic re-fetch of that
  one row, not the whole page.

**`RequesterTicketDetail.tsx`** (read-only): the same list rendering (Description, Result, Follow-Up
Required/Follow-up Note, Attachment Notes, Performed By, timestamp), no edit button, no form, placed
between the existing Public Comments section and the "Problem Appears Resolved" action at the bottom
of the page.

Empty state (both roles): "No actions taken yet."

## 7. Responsive rules

Identical to Lab 3 §10: multi-column at desktop, two-column at tablet keeping long text fields full
width, stacked with ≥44px touch targets at mobile, no horizontal page scrolling at any size. Dashboard
metric tiles stack to 2-per-row at tablet and 1-per-row at mobile (same `col-6 col-md-3`-style pattern
already used on Ticket Detail's priority/owner/status row).

## 8. Accessibility

Identical to Lab 3 §11, plus: dashboard metric tiles are real `<a>`/`<Link>` elements (keyboard
focusable, not a `<div onClick>`), each with an `aria-label` naming both the metric and its value (e.g.
"Open: 23 Tickets, view filtered queue") so the count is announced together with its meaning; the
Actions Taken Follow-up Note field's conditional appearance is announced via `aria-live="polite"` on
the form region, mirroring the Change Password rule-checklist pattern from Lab 3.

## 9. Visual inspection checklist

Performed at 1440×900, 820×1024, 390×844 against the screenshots in `artifacts/lab-04/screenshots/`.

- Dashboard metric tiles use the same tokens/geometry as existing Ticket Detail info cards.
- Dashboard links are real keyboard-focusable elements with visible focus, not divs.
- Actions Taken section is visually distinct from both Public Comments and Internal Notes, not
  confusable with either.
- Follow-up Note field appears/disappears correctly with Follow-Up Required, with no layout jump that
  clips or overlaps adjacent content.
- No clipping, overlap, or horizontal scrolling on any new screen at any breakpoint.
- No leftover Lab 1 scaffold content reachable from any authenticated or unauthenticated navigation
  path.

## 10. Screenshot paths

```
artifacts/lab-04/screenshots/
├── staff-dashboard/     loaded, empty, failure, responsive
├── requester-dashboard/ loaded, empty, attention-required present/absent, responsive
└── actions-taken/       list, create, edit, validation, stale-conflict, responsive
```
