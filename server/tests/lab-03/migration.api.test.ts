import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { prisma } from '../../src/prisma'
import { loginAs } from '../helpers/testAuth'

// API-42 (AC-09, BR-35): "Full Lab 1 + Lab 2 suites re-run unmodified after the User migration, on
// a database built via `prisma migrate deploy` + seed from empty."
//
// The primary evidence for this is simply that `npm test` (every Lab 1/2/3 file under
// server/tests/) passes as a whole against a database built exactly that way -- there is no
// separate assertion to make here that the rest of the suite doesn't already make more directly.
// What this file adds is a smoke test that the full FK chain spanning every lab's schema additions
// (Category/RelatedSystem from Lab 1, User/Ticket/Attachment from Lab 2, PublicComment/
// ticketOwner/itPriority/InternalNote from Lab 3) still works end-to-end through the live API in
// one request sequence, which is a more direct regression signal than re-running already-covered
// individual-route tests again under a new name.
describe('API-42: full Lab 1+2+3 flow still works end-to-end after the User migration', () => {
  it('creates a Ticket, an Attachment, a Public Comment, and an Internal Note in one sequence', async () => {
    const requester = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'REQUESTER' } })
    const staff = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: 'IT_STAFF' } })
    const requesterCookie = await loginAs(app, requester.email)
    const staffCookie = await loginAs(app, staff.email)
    const category = await prisma.category.findFirstOrThrow()
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

    const ticketRes = await request(app).post('/api/tickets').set('Cookie', requesterCookie).send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: 'API-42 full-chain migration smoke test',
      description: 'Exercises Category/RelatedSystem (Lab 1), User/Ticket (Lab 2), and PublicComment/InternalNote (Lab 3) in one request sequence.',
      requestedPriority: 'LOW',
    })
    expect(ticketRes.status).toBe(201)
    const ticketId = ticketRes.body.id

    const attachmentRes = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set('Cookie', requesterCookie)
      .attach('file', Buffer.from('migration-smoke-test'), { filename: 'smoke.png', contentType: 'image/png' })
    expect(attachmentRes.status).toBe(201)

    const commentRes = await request(app)
      .post(`/api/tickets/${ticketId}/public-comments`)
      .set('Cookie', requesterCookie)
      .send({ body: 'Full-chain smoke test comment.' })
    expect(commentRes.status).toBe(201)

    const noteRes = await request(app)
      .post(`/api/staff/tickets/${ticketId}/internal-notes`)
      .set('Cookie', staffCookie)
      .send({ body: 'Full-chain smoke test internal note.' })
    expect(noteRes.status).toBe(201)

    const detailRes = await request(app).get(`/api/staff/tickets/${ticketId}`).set('Cookie', staffCookie)
    expect(detailRes.status).toBe(200)
    expect(detailRes.body.category.id).toBe(category.id)
    expect(detailRes.body.attachments).toHaveLength(1)
  })
})

// API-43 (AC-09): "A pre-migration seeded Requester's pre-existing Ticket: still present, still
// owned by that Requester, under the new User table."
//
// This is NOT automated here. Proving it requires reproducing the actual pre-Lab-3 schema (the
// RequesterUser/Ticket/Attachment tables as they existed before the User-rename migration),
// inserting data under it, then applying the Lab 3 migrations on top and checking the data
// survived -- which needs a second, isolated schema and raw migration SQL applied outside Prisma's
// normal single-schema lifecycle, not something that fits cleanly inside a standard Vitest run
// against the app's one shared `public` schema.
//
// This was verified manually instead, once, using an isolated `migration_check` Postgres schema on
// the same database: applied the 5 pre-Lab-3 migrations, inserted a RequesterUser + Ticket row,
// applied the 5 Lab 3 migrations (including `ALTER TABLE "RequesterUser" RENAME TO "User"`) on top,
// then queried the result. Full transcript, including the exact SQL and query output, is recorded
// in docs/lab-03/tests.md §7. Result: the Ticket survived with the same id, still correctly
// foreign-key-linked to the renamed User row (same id, name, and email preserved), with every new
// Lab 3 column present and correctly defaulted/backfilled (itPriority backfilled from
// requestedPriority, role defaulted to REQUESTER, requesterConfirmedResolved defaulted to false).
describe.skip('API-43: verified manually, see docs/lab-03/tests.md §7 for the full transcript', () => {})
