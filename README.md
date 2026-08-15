# TokTickIT

CPE334 Lab 1 project — a full-stack "hello world" vertical slice proving that
React + TypeScript + Vite + Bootstrap, Express + TypeScript, and Prisma + PostgreSQL
all work together as one integrated system.

## Tech stack

| Area       | Choice                              |
|------------|--------------------------------------|
| Frontend   | React + TypeScript + Vite + Bootstrap |
| Backend    | Node.js + Express + TypeScript        |
| Database   | PostgreSQL + Prisma                   |
| Testing    | Vitest (frontend) + Supertest (API)   |

## Repository structure

```
toktickit/
├── client/               React + TypeScript + Vite + Bootstrap frontend
│   └── tests/lab-01/     Vitest tests for Lab 1
├── server/
│   ├── prisma/           Prisma schema and migrations
│   ├── src/               Express + TypeScript source
│   └── tests/lab-01/     Supertest tests for Lab 1
├── docs/
│   └── lab-01/
│       ├── ai_use.md     AI-assistant usage log and reflection
│       ├── reviewer.md   Peer review log
│       └── tests.md      Test tracking table
├── .gitignore
└── README.md
```

## Branch model

```
main               <- stable release (protected)
 lab1-staging      <- integration branch
   feature/1-project-foundation
   feature/2-health-check
   feature/3-category-seed
   feature/4-category-list
```

Never commit directly to `main` or `lab1-staging`. Each Issue is built on its own
`feature/*` branch, opened as a Pull Request into `lab1-staging`. After all four
features are merged, one release PR is opened from `lab1-staging` into `main`.

## Getting started

Prerequisites: Node.js 20+, PostgreSQL running locally with a `toktickit` database.

### Backend

```
cd server
npm install
cp .env.example .env   # edit DATABASE_URL if your local Postgres differs
npx prisma migrate dev  # creates the Category table
npm run seed             # inserts the four IT request categories (safe to re-run)
npm run dev             # starts the API on http://localhost:4000
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

## Docs

- [docs/lab-01/reviewer.md](docs/lab-01/reviewer.md) - peer review log for Lab 1
- [docs/lab-01/ai_use.md](docs/lab-01/ai_use.md) - AI coding assistant usage log
- [docs/lab-01/tests.md](docs/lab-01/tests.md) - Lab 1 test tracking table
