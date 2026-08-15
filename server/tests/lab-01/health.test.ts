import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('GET /api/health (API-01)', () => {
  it('returns 200 with status ok and the service name', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', service: 'TokTickIT API' })
  })
})
