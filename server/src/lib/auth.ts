import jwt from 'jsonwebtoken'

export const SESSION_COOKIE_NAME = 'toktickit_session'
export const SESSION_TTL_SECONDS = 8 * 60 * 60 // BR-11: 8-hour session expiry

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }
  return secret
}

export interface SessionPayload {
  sub: number
  tv: number
}

export function signSessionToken(userId: number, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion }, jwtSecret(), { expiresIn: SESSION_TTL_SECONDS })
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret())
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'number' &&
      typeof decoded.tv === 'number'
    ) {
      return { sub: decoded.sub, tv: decoded.tv }
    }
    return null
  } catch {
    return null
  }
}

// BR-08: at least 8 characters, one uppercase, one lowercase, one digit, one special character.
export function passwordRuleFailures(password: string): string[] {
  const failures: string[] = []
  if (password.length < 8) failures.push('at least 8 characters')
  if (!/[A-Z]/.test(password)) failures.push('an uppercase letter')
  if (!/[a-z]/.test(password)) failures.push('a lowercase letter')
  if (!/[0-9]/.test(password)) failures.push('a digit')
  if (!/[^A-Za-z0-9]/.test(password)) failures.push('a special character')
  return failures
}
