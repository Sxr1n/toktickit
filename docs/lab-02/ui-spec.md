# Lab 2 Zen Green UI Specification

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active tabs, focus accents, links, hover |
| `--color-pale` | `#EAF6EF` | Selected/success/subtle section emphasis |
| `--color-bg` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, with subtle border + restrained shadow |
| `--color-text` | dark charcoal-green (`#1B2B24`) | Body text, not pure black |
| `--color-field-editable-bg` | `#FFFFFF` | Editable field background, clear neutral border |
| `--color-field-readonly-bg` | soft gray-green / warm ivory | Read-only field background |
| `--color-error` | dark red | Error text/border, message directly below the field |
| `--color-warning` | amber | Warning callouts/badges only, never decoration |
| `--color-success` | green | Success confirmation, paired with readable text, never color alone |

## Typography and spacing

- Base font: system sans stack, 14-16px body, 20-24px screen titles.
- 8px spacing scale (8/16/24/32) for field gaps, card padding, section spacing.
- Labels sit above their control, consistent weight (medium) and spacing (4px gap to control).

## Component states

- **Editable field**: white bg, neutral border; focus ring in secondary green; error state = red border +
  message directly beneath.
- **Read-only field**: gray-green/ivory bg, no border emphasis, not focusable as an input.
- **Disabled control**: reduced opacity, `cursor: not-allowed`, cannot be activated by mouse or keyboard.
- **Required field**: red asterisk after the label; the asterisk never replaces the validation message.
- **Button hierarchy**: Primary (solid primary green, one per view for the main action), Secondary
  (outlined secondary green), Tertiary (text-only link style), Destructive (dark red, for Remove
  Attachment), Disabled (grayed, non-interactive), Busy (spinner + disabled, used on Submit while a
  request is in flight).

## Screens

### App shell
- TokTickIT wordmark/logo (left), My Tickets + Create Ticket nav, current Requester name + Change
  Requester action (right), active nav item underlined/colored in secondary green.
- Mobile: nav collapses to a hamburger/menu; current Requester and Change Requester remain reachable.

### Development Requester Selection
- Centered card: TokTickIT title, one-line explanation ("Select a Development Requester to test
  requester-specific ticket behavior. This is not a login screen..."), dropdown of active Requesters,
  Continue button (disabled until a Requester is chosen or the list is empty).
- Loading: skeleton/spinner in place of the dropdown.
- Empty: "No active Development Requesters are available" message, Continue disabled.
- Error: safe failure message with a Retry action.

### Create Ticket
- Section 1 (top): system-generated/read-only context — none shown pre-submit; after success, Ticket
  Number + Ticket Date appear in a pale-green confirmation panel.
- Section 2: classification fields grouped — Category, Related System, Requested Priority (selects).
- Section 3: Summary (single-line, full width) and Description (multiline, resizable vertically only,
  generous min-height).
- Section 4: Attachments — file picker, list of selected files with type/size, remove-before-submit
  action, inline rejection messages for bad type/size/count.
- Section 5 (bottom): primary "Submit Ticket" button (busy state while submitting) + secondary "Cancel".
- Validation messages render directly under their field the moment a field is invalid on blur or submit.

### My Tickets
- Top bar: search input, filter selects (Category, Related System, Requested Priority), sort control,
  Create Ticket primary button.
- Desktop: table — Ticket Number, Summary, Category, Requested Priority (badge), Current Status (badge),
  Ticket Date, row click opens Ticket Detail.
- Mobile (<768px): one card per Ticket with the same fields stacked, tap opens Ticket Detail.
- Pagination control at the bottom (page numbers + prev/next), hidden when only one page exists.
- Loading: skeleton rows/cards. Empty: "You haven't created any tickets yet" + Create Ticket CTA.
- No-results (search/filter with zero matches): "No tickets match your search/filters" + Clear filters
  action — visually distinct from the empty state's copy and CTA.
- Failure: safe error message + Retry.

### Requester Ticket Detail
- Header block: Ticket Number, Ticket Date, Requester, Category, Related System, Summary, Requested
  Priority (badge), Current Status (badge) — all read-only styling (§ field states above).
- Description block below the header, full width.
- Attachments section, visually separated (card/divider) from the read-only header:
  - Active attachment row: filename, size, uploaded date, Download action.
  - Removed attachment row: same metadata, muted/struck styling, "Removed — <reason>" note, Download
    disabled.
  - "Add attachment" action opens the same picker/validation used on Create Ticket.
  - Removing requires a confirm step with a required reason field (BR-21).

## Badges

- Requested Priority: LOW (gray-green), MEDIUM (amber), HIGH (dark red) — background + text, not color
  alone (include the text label always).
- Current Status: NEW (pale green background, primary green text) — only status value in Lab 2.

## Responsive rules

| Viewport | Behavior |
|---|---|
| Desktop ≥992px | Multi-column layout, content centered with a max width (~1100px) |
| Tablet 768-991px | Two-column where practical; Summary/Description keep generous width |
| Mobile <768px | Single column, fields stack, buttons full-width and touch-sized (≥44px), no horizontal scroll |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, no unreadable attachment names (truncate with ellipsis + title attr instead) |

## Accessibility

- Every control has a programmatic label (native `<label for>` or `aria-label`).
- Icon-only controls (e.g. remove-attachment icon) carry both an accessible label and a visible tooltip.
- Focus outlines remain visible (no `outline: none` without a replacement focus style) for all
  interactive elements, including the Requester dropdown and pagination controls.
- Errors are never conveyed by color alone — always paired with text and, where relevant, an icon.

## Visual inspection checklist (per screenshot batch)

- [ ] No clipped labels or truncated buttons at any of the three viewport widths
- [ ] No overlapping validation messages or badges
- [ ] No unintended horizontal scrolling on any screen
- [ ] Editable vs read-only fields are visually distinguishable at a glance
- [ ] Badge colors match the table above and are never the sole indicator of meaning
- [ ] Screenshots match `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/`

## Screenshot paths

- `artifacts/lab-02/screenshots/create-ticket/{desktop,tablet,mobile}.png`
- `artifacts/lab-02/screenshots/my-tickets/{desktop,tablet,mobile}.png`
- `artifacts/lab-02/screenshots/ticket-detail/{desktop,tablet,mobile}.png`
