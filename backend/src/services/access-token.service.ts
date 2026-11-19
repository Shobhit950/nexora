import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { jwtAccessSecret } from '../config/env';

if (!jwtAccessSecret || Buffer.byteLength(jwtAccessSecret.trim(), 'utf8') < 32) {
  throw new Error('Set JWT_ACCESS_SECRET to a random value of at least 32 bytes in backend/.env.');
}

const accessSecret = jwtAccessSecret;
const subjectSchema = z.uuid();

export function signAccessToken(userId: string) {
  return jwt.sign({}, accessSecret, {
    algorithm: 'HS256',
    subject: userId,
    jwtid: randomUUID(),
    expiresIn: '15m',
  });
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, accessSecret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || typeof payload.exp !== 'number') {
    throw new Error('Invalid access token claims');
  }

  return subjectSchema.parse(payload.sub);
}
