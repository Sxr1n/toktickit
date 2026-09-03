import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('GET /api/dev-requesters', () => {
  it('returns only active Development Requesters', async () => {
    const res = await request(app).get('/api/dev-requesters')

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(4)
    for (const requester of res.body) {
      expect(requester).toHaveProperty('id')
      expect(requester).toHaveProperty('name')
      expect(requester).toHaveProperty('email')
    }
    expect(res.body.some((r: { name: string }) => r.name === 'Former Employee')).toBe(false)
  })
})
