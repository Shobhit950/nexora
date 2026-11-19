import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

export const databaseUrl = process.env.DATABASE_URL;
export const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;

export const isProduction = process.env.NODE_ENV === 'production';
export const frontendOrigin = process.env.FRONTEND_ORIGIN ?? (
  isProduction ? undefined : 'http://localhost:5173'
);

const refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS ?? '7');
if (!Number.isSafeInteger(refreshTokenDays) || refreshTokenDays < 1 || refreshTokenDays > 365) {
  throw new Error('REFRESH_TOKEN_DAYS must be a whole number between 1 and 365.');
}

export const refreshTokenLifetimeMs = refreshTokenDays * 24 * 60 * 60 * 1000;
