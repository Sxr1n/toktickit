import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('GET /api/categories (API-02)', () => {
  it('returns the four seeded categories in a predictable order', async () => {
    const res = await request(app).get('/api/categories')

    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 1, name: 'Account and Access' },
      { id: 2, name: 'Hardware' },
      { id: 3, name: 'Software' },
      { id: 4, name: 'Network' },
    ])
  })
})
