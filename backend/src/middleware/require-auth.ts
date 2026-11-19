import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/access-token.service';

export type AuthLocals = { userId: string };

export function requireAuth(req: Request, res: Response<unknown, AuthLocals>, next: NextFunction) {
  const token = /^Bearer +([^\s,]+)$/i.exec(req.get('Authorization') ?? '')?.[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    res.locals.userId = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
