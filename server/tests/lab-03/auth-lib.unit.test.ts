import { describe, expect, it, vi } from 'vitest'
import { passwordRuleFailures } from '../../src/lib/auth'
import { requireFreshPassword } from '../../src/middleware/requireFreshPassword'
import type { AuthenticatedUser } from '../../src/middleware/requireAuth'

describe('passwordRuleFailures (BR-08 unit)', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordRuleFailures('DevPass123!')).toEqual([])
  })

  it('reports every unmet rule for a too-short, all-lowercase password', () => {
    const failures = passwordRuleFailures('abc')
    expect(failures).toContain('at least 8 characters')
    expect(failures).toContain('an uppercase letter')
    expect(failures).toContain('a digit')
    expect(failures).toContain('a special character')
    expect(failures).not.toContain('a lowercase letter')
  })
})

function mockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'REQUESTER',
    mustChangePassword: false,
    ...overrides,
  }
}

describe('requireFreshPassword (unit)', () => {
  it('calls next() when mustChangePassword is false', () => {
    const req: any = { user: mockUser({ mustChangePassword: false }) }
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requireFreshPassword(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('responds 403 PASSWORD_CHANGE_REQUIRED when mustChangePassword is true', () => {
    const req: any = { user: mockUser({ mustChangePassword: true }) }
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requireFreshPassword(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'PASSWORD_CHANGE_REQUIRED' }) }),
    )
  })

  it('responds 401 when req.user is missing', () => {
    const req: any = {}
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requireFreshPassword(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
