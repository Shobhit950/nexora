import type { CookieOptions, Request, Response } from 'express';
import { frontendOrigin, isProduction } from '../config/env';
import type { AuthLocals } from '../middleware/require-auth';
import { signAccessToken } from '../services/access-token.service';
import { DuplicateEmailError, findUserById, login, signup } from '../services/auth.service';
import { createSession, revokeSession, rotateSession } from '../services/session.service';
import { loginSchema, signupSchema } from '../validators/auth.validator';

const refreshCookieName = 'nexora_refresh';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/api/auth',
};

function clearLegacyRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName, { ...refreshCookieOptions, path: '/api/auth/refresh' });
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(refreshCookieName, token, { ...refreshCookieOptions, expires: expiresAt });
  clearLegacyRefreshCookie(res);
}

function isTrustedAuthOrigin(req: Request) {
  const origin = req.get('Origin');
  return origin === undefined || origin === frontendOrigin;
}

export async function signupController(req: Request, res: Response) {
  const input = signupSchema.safeParse(req.body);

  if (!input.success) {
    const fields = [...new Set(input.error.issues.map((issue) => issue.path[0] ?? 'body'))];
    res.status(400).json({ error: 'Invalid signup input', fields });
    return;
  }

  try {
    const user = await signup(input.data);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    console.error('Signup failed while creating a user');
    res.status(500).json({ error: 'Unable to create user' });
  }
}

export async function loginController(req: Request, res: Response) {
  const input = loginSchema.safeParse(req.body);

  if (!input.success) {
    res.status(400).json({ error: 'Invalid login input' });
    return;
  }

  try {
    const user = await login(input.data);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = signAccessToken(user.id);
    const { token, expiresAt } = await createSession(user.id);
    setRefreshCookie(res, token, expiresAt);
    res.set('Cache-Control', 'no-store').status(200).json({ ...user, accessToken });
  } catch {
    console.error('Login failed while authenticating a user');
    res.status(500).json({ error: 'Unable to log in' });
  }
}

export async function meController(_req: Request, res: Response<unknown, AuthLocals>) {
  try {
    const user = await findUserById(res.locals.userId);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(200).json(user);
  } catch {
    console.error('Failed to load the authenticated user');
    res.status(500).json({ error: 'Unable to load user' });
  }
}

export async function refreshController(req: Request, res: Response) {
  if (!isTrustedAuthOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const session = await rotateSession(req.cookies?.[refreshCookieName]);
    if (!session) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const accessToken = signAccessToken(session.userId);
    setRefreshCookie(res, session.token, session.expiresAt);
    res.set('Cache-Control', 'no-store').status(200).json({ accessToken });
  } catch {
    console.error('Failed to refresh session');
    res.status(500).json({ error: 'Unable to refresh session' });
  }
}

export async function logoutController(req: Request, res: Response) {
  if (!isTrustedAuthOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    await revokeSession(req.cookies?.[refreshCookieName]);
    res.clearCookie(refreshCookieName, refreshCookieOptions);
    clearLegacyRefreshCookie(res);
    res.set('Cache-Control', 'no-store').status(200).json({ message: 'Logged out' });
  } catch {
    console.error('Failed to revoke session');
    res.status(500).json({ error: 'Unable to log out' });
  }
}
