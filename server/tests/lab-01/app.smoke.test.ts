import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('app smoke test', () => {
  it('returns 404 for an undefined route', async () => {
    const res = await request(app).get('/does-not-exist')
    expect(res.status).toBe(404)
  })
})
