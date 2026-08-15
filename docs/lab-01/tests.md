# Lab 1 - Test Tracking

Required automated tests per the Lab 1 labsheet (section 11). Status is updated as each
Issue lands.

| Test File (tests/lab-01/) | Tool      | Test Description                                    | Status  |
|----------------------------|-----------|------------------------------------------------------|---------|
| API-01                      | Supertest | Health endpoint returns 200 and expected JSON         | Planned - Issue 2 |
| API-02                      | Supertest | Categories endpoint returns the four seeded categories | Planned - Issue 4 |
| UI-01                       | Vitest    | TokTickIT heading renders                             | Planned - Issue 2 |
| UI-02                       | Vitest    | Loading state changes to category list                | Planned - Issue 4 |
| UI-03                       | Vitest    | API failure displays a useful error message            | Planned - Issue 2 |

## Foundation smoke tests (Issue 1)

Not part of the required IDs above - these only prove the test tooling itself is wired up
correctly before any real feature tests exist.

| File                                       | Tool      | Description                                    |
|---------------------------------------------|-----------|-------------------------------------------------|
| server/tests/lab-01/app.smoke.test.ts        | Supertest | Express app responds 404 to an undefined route  |
| client/tests/lab-01/App.smoke.test.tsx       | Vitest    | `<App />` renders without crashing               |
