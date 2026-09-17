import request from 'supertest'
import type { Express } from 'express'

export const DEV_PASSWORD = 'DevPass123!'
const SESSION_COOKIE_NAME = 'toktickit_session'

export async function loginAs(app: Express, email: string, password: string = DEV_PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  const setCookie = res.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  const sessionCookie = cookies.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
  if (!sessionCookie) {
    throw new Error(`Login failed for ${email}: no session cookie in response (status ${res.status})`)
  }
  return sessionCookie.split(';')[0]
}
