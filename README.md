# TokTickIT

CPE334 coursework project — an IT service desk ticketing application built incrementally across labs.
Lab 1 proved the stack (React + TypeScript + Vite + Bootstrap, Express + TypeScript, Prisma + PostgreSQL)
works end to end. Lab 2 builds the Requester-facing ticketing MVP on top of it: a temporary Development
Requester selector, Create Ticket, My Tickets, Ticket Detail, and the Attachment lifecycle.

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
│   │   ├── api/                fetch helpers (JSON + multipart + download)
│   │   ├── components/         AppShell, AttachmentPicker, RequireRequester
│   │   ├── context/            RequesterContext (selected Dev Requester)
│   │   └── pages/               RequesterSelection, CreateTicket, MyTickets, RequesterTicketDetail
│   └── tests/{lab-01,lab-02}/  Vitest tests
├── server/
│   ├── prisma/                 Prisma schema, migrations, seed
│   ├── src/
│   │   ├── routes/              health, categories, devRequesters, relatedSystems, tickets, attachments
│   │   ├── middleware/          requireRequester (X-Dev-Requester-Id validation)
│   │   └── upload.ts            multer config (allowed types, size limit)
│   └── tests/{lab-01,lab-02}/  Supertest tests
├── e2e/lab-02/                 Playwright end-to-end specs (repo root - covers client + server together)
├── artifacts/lab-02/screenshots/  Desktop/tablet/mobile screenshots from the E2E visual checklist
├── docs/
│   ├── lab-01/                 README-level docs for Lab 1
│   └── lab-02/
│       ├── specification.md     Sprint spec: FR/BR/AC, data model, DoD
│       ├── api-spec.md          Full REST contract
│       ├── ui-spec.md           Zen Green design system + per-screen layout + visual checklist
│       ├── tests.md             Test plan, AC traceability, results
│       ├── ai-use.md            AI-assistant usage log and reflection
│       └── reviewer.md          Peer review log
├── playwright.config.ts        E2E config (desktop/tablet/mobile projects, auto-starts client+server)
├── package.json                Root project - Playwright only (client/server are separate npm projects)
├── .gitignore
└── README.md
```

## Branch model

```
main                  <- stable release (protected)
 lab1-staging         <- Lab 1 integration branch (merged)
 lab2-staging         <- Lab 2 integration branch
   feature/1-sprint-specification
   feature/2-dev-requester-context
   feature/3-create-ticket
   feature/4-my-tickets
   feature/5-ticket-detail-attachments
   feature/6-visual-qa-e2e
   feature/7-release-integration
```

Never commit directly to `main` or a `*-staging` branch. Each Issue is built on its own `feature/*`
branch, opened as a Pull Request into that lab's staging branch. After every feature for a lab is merged,
one release PR is opened from `<lab>-staging` into `main`.

## Getting started

Prerequisites: Node.js 20+, PostgreSQL running locally with a `toktickit` database.

### Backend

```
cd server
npm install
cp .env.example .env    # edit DATABASE_URL if your local Postgres differs
npx prisma migrate dev  # applies all migrations (Category, RequesterUser, Ticket, Attachment, ...)
npm run seed             # idempotent: categories, related systems, Development Requesters
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
npm test                           # runs e2e/lab-02/*.spec.ts across desktop/tablet/mobile
npm run test:report                # opens the HTML report from the last run
```

## Docs

- [docs/lab-01/reviewer.md](docs/lab-01/reviewer.md) / [ai_use.md](docs/lab-01/ai_use.md) / [tests.md](docs/lab-01/tests.md) - Lab 1
- [docs/lab-02/specification.md](docs/lab-02/specification.md) - Sprint 2 engineering specification
- [docs/lab-02/api-spec.md](docs/lab-02/api-spec.md) - REST API contract
- [docs/lab-02/ui-spec.md](docs/lab-02/ui-spec.md) - Zen Green UI specification
- [docs/lab-02/tests.md](docs/lab-02/tests.md) - Test plan, traceability, and results
- [docs/lab-02/reviewer.md](docs/lab-02/reviewer.md) / [ai-use.md](docs/lab-02/ai-use.md) - Lab 2 peer review + AI use log
