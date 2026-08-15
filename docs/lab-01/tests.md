# Lab 1 - Test Tracking

Required automated tests per the Lab 1 labsheet (section 11). All required tests are now
implemented.

| Test File (tests/lab-01/) | Tool      | Test Description                                    | Status  |
|----------------------------|-----------|--------------------------------------------------------|---------|
| API-01                      | Supertest | Health endpoint returns 200 and expected JSON           | Implemented - server/tests/lab-01/health.test.ts |
| API-02                      | Supertest | Categories endpoint returns the four seeded categories  | Implemented - server/tests/lab-01/categories.test.ts |
| UI-01                       | Vitest    | TokTickIT heading renders                               | Implemented - client/tests/lab-01/App.test.tsx |
| UI-02                       | Vitest    | Loading state changes to category list                  | Implemented - client/tests/lab-01/App.test.tsx |
| UI-03                       | Vitest    | API failure displays a useful error message              | Implemented - client/tests/lab-01/App.test.tsx |

Note: `API-02` is an integration test against a real PostgreSQL database and expects it to
already be migrated (`npx prisma migrate dev`) and seeded (`npm run seed`) with the four
categories in insertion order (ids 1-4).

## Foundation smoke test (Issue 1)

Not part of the required IDs above - only proves the Supertest tooling itself is wired up
correctly, independent of any real endpoint.

| File                                       | Tool      | Description                                    |
|---------------------------------------------|-----------|---------------------------------------------------|
| server/tests/lab-01/app.smoke.test.ts        | Supertest | Express app responds 404 to an undefined route  |
