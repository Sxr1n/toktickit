# TokTickIT

CPE334 coursework project — an IT service desk ticketing application built incrementally across labs.
Lab 1 proved the stack (React + TypeScript + Vite + Bootstrap, Express + TypeScript, Prisma + PostgreSQL)
works end to end. Lab 2 built the Requester-facing ticketing MVP on top of it: a temporary Development
Requester selector, Create Ticket, My Tickets, Ticket Detail, and the Attachment lifecycle. Lab 3
replaced that temporary selector with real cookie-based authentication and role-based authorization
for three roles — Requester, IT Staff, Administrator — and added the IT Staff Ticket Queue/Detail
workflow (claim/reassign, IT Priority, status transitions, Internal Notes), a Public Comments thread
shared between Requesters and staff, and Administrator User Management. See `docs/lab-03/` for the
full sprint contract, test results, and peer review log.

**Seeded accounts (local development only, never a real secret):** every seeded account's password is
`DevPass123!`. Requesters (`jennifer.anderson@example.com` and 3 others) must change this password at
first login; seeded IT Staff (`priya.nakamura@example.com` and 2 others) and the Administrator
(`taylor.admin@example.com`) do not. See `server/prisma/seed.ts` for the full list.

## Tech stack

| Area       | Choice                                 |
|------------|------------------------------------------|
| Frontend   | React + TypeScript + Vite + Bootstrap     |
| Backend    | Node.js + Express + TypeScript            |
| Database   | PostgreSQL + Prisma                       |
| Testing    | Vitest (frontend) + Supertest (API) + Playwright (E2E) |

## Repository structure

```
toktickit/
├── client/                    React + TypeScript + Vite + Bootstrap frontend
│   ├── src/
│   │   ├── api/                 fetch helpers: http.ts (JSON/multipart/download, cookie-based),
│   │   │                        auth.ts, admin.ts (structured {error:{code,message}} parsing)
│   │   ├── components/          AppShell (role-conditional nav + Logout), AttachmentPicker,
│   │   │                        RequireAuth, RequireRole
│   │   ├── context/              AuthContext (signed-in user, login/logout/refreshUser)
│   │   └── pages/                Login, ChangePassword, CreateTicket, MyTickets,
│   │                             RequesterTicketDetail, StaffTicketQueue, StaffTicketDetail,
│   │                             UserManagement
│   └── tests/{lab-01,lab-02,lab-03}/  Vitest tests
├── server/
│   ├── prisma/                  Prisma schema, migrations (Category → User rename → Ticket
│   │                            owner/priority → PublicComment/InternalNote), seed
│   ├── src/
│   │   ├── routes/               health, categories, relatedSystems, tickets, attachments, auth,
│   │   │                         staff (Ticket Queue/Detail, Internal Notes), admin (User Management)
│   │   ├── middleware/           requireAuth (JWT cookie), requireRole, requireFreshPassword
│   │   ├── lib/auth.ts           session signing/verification, password rule validation
│   │   └── upload.ts             multer config (allowed types, size limit)
│   └── tests/{lab-01,lab-02,lab-03}/  Supertest tests
├── e2e/{lab-02,lab-03}/         Playwright end-to-end specs (repo root - covers client + server together)
├── artifacts/{lab-02,lab-03}/screenshots/  Desktop/tablet/mobile screenshots from the E2E visual checklist
├── docs/
│   ├── lab-01/                  README-level docs for Lab 1
│   ├── lab-02/
│   │   ├── specification.md      Sprint spec: FR/BR/AC, data model, DoD
│   │   ├── api-spec.md           Full REST contract
│   │   ├── ui-spec.md            Zen Green design system + per-screen layout + visual checklist
│   │   ├── tests.md              Test plan, AC traceability, results
│   │   ├── ai-use.md             AI-assistant usage log and reflection
│   │   └── reviewer.md           Peer review log
│   └── lab-03/                  Same five-document structure as lab-02, covering auth/RBAC/
│                                 IT Staff/Administrator screens
├── docker-compose.yml           Postgres in a container (host port 5433), persistent named volume
├── playwright.config.ts         E2E config (desktop/tablet/mobile projects, auto-starts client+server)
├── package.json                 Root project - Playwright only (client/server are separate npm projects)
├── .gitignore
└── README.md
```

## Branch model

```
main                  <- stable release (protected)
 lab1-staging         <- Lab 1 integration branch (merged)
 lab2-staging         <- Lab 2 integration branch (merged)
   feature/1-sprint-specification
   feature/2-dev-requester-context
   feature/3-create-ticket
   feature/4-my-tickets
   feature/5-ticket-detail-attachments
   feature/6-visual-qa-e2e
   feature/7-release-integration
 lab3-staging         <- Lab 3 integration branch
   feature/26-sprint3-engineering-contract
   feature/27-authentication-foundation
   feature/28-requester-regression-public-comments
   feature/29-it-staff-ticket-queue
   feature/30-it-staff-ticket-detail-operations
   feature/31-administrator-user-management
   chore/dockerize-postgres        <- dev-tooling, not a numbered Issue (see #43)
   feature/32-visual-qa-responsive-e2e
   feature/33-sprint3-release-integration
```

Never commit directly to `main` or a `*-staging` branch. Each Issue is built on its own `feature/*`
branch, opened as a Pull Request into that lab's staging branch. After every feature for a lab is merged,
one release PR is opened from `<lab>-staging` into `main`.

## Getting started

Prerequisites: Node.js 20+, and a PostgreSQL `toktickit` database reachable at the URL in
`server/.env`.

### Database (Docker)

The simplest way to get Postgres running locally is via the root `docker-compose.yml`, which starts
it on host port **5433** (not 5432, so it won't collide with a native/other local Postgres install):

```
docker compose up -d          # starts Postgres in the background, with a persistent named volume
docker compose down           # stops it (data persists in the volume)
docker compose down -v        # stops it AND wipes the volume, for a fully clean slate
```

`server/.env.example`'s `DATABASE_URL` already points at `localhost:5433` to match. If you'd rather
run your own Postgres instance instead of Docker, just point `DATABASE_URL` at it (any port works).

### Backend

```
cd server
npm install
cp .env.example .env    # edit DATABASE_URL if your Postgres isn't the Docker Compose one above
npx prisma migrate dev  # applies all migrations (Category, User, Ticket, Attachment, ...)
npm run seed             # idempotent: categories, related systems, seeded Users
npm run dev              # starts the API on http://localhost:4000
```

Other server scripts: `npm run build`, `npm run start`, `npm run test`.

### Frontend

```
cd client
npm install
cp .env.example .env
npm run dev             # starts the Vite dev server on http://localhost:5173
```

Other client scripts: `npm run build`, `npm run test`.

### End-to-end tests (Playwright)

Run from the **repository root** (not `client/` or `server/`). The config auto-starts both dev servers.

```
npm install
npx playwright install chromium   # one-time browser download
npm test                           # runs e2e/{lab-02,lab-03}/*.spec.ts across desktop/tablet/mobile
npm run test:report                # opens the HTML report from the last run
```

Every Requester-facing E2E spec creates its own dedicated throwaway account via the Administrator
API rather than reusing a shared seeded account, so the full suite can be re-run repeatedly with no
manual database intervention between runs.

## Docs

- [docs/lab-01/reviewer.md](docs/lab-01/reviewer.md) / [ai_use.md](docs/lab-01/ai_use.md) / [tests.md](docs/lab-01/tests.md) - Lab 1
- [docs/lab-02/specification.md](docs/lab-02/specification.md) - Sprint 2 engineering specification
- [docs/lab-02/api-spec.md](docs/lab-02/api-spec.md) - REST API contract
- [docs/lab-02/ui-spec.md](docs/lab-02/ui-spec.md) - Zen Green UI specification
- [docs/lab-02/tests.md](docs/lab-02/tests.md) - Test plan, traceability, and results
- [docs/lab-02/reviewer.md](docs/lab-02/reviewer.md) / [ai-use.md](docs/lab-02/ai-use.md) - Lab 2 peer review + AI use log
- [docs/lab-03/specification.md](docs/lab-03/specification.md) - Sprint 3 engineering specification
- [docs/lab-03/api-spec.md](docs/lab-03/api-spec.md) - REST API contract (auth, Staff, Admin)
- [docs/lab-03/ui-spec.md](docs/lab-03/ui-spec.md) - UI spec for the auth, RBAC, IT Staff, and Administrator screens
- [docs/lab-03/tests.md](docs/lab-03/tests.md) - Test plan, traceability, results, and the migration-safety evidence transcript
- [docs/lab-03/reviewer.md](docs/lab-03/reviewer.md) / [ai-use.md](docs/lab-03/ai-use.md) - Lab 3 peer review + AI use log
