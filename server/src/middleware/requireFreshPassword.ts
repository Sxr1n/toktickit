import type { NextFunction, Request, Response } from 'express'

// AC-02/BR-02: a user flagged with a temporary password cannot use any normal application route
// until they save a new one. Must run after requireAuth. Not applied to the auth routes
// themselves (login is public; /me and /change-password must stay reachable while the flag is
// still set, or the user could never clear it).
export function requireFreshPassword(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } })
  }
  if (req.user.mustChangePassword) {
    return res.status(403).json({
      error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'You must change your password before continuing.' },
    })
  }
  next()
}
