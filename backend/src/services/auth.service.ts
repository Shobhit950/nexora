import { compare, hash } from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { users } from '../db/schema';
import type { LoginInput, SignupInput } from '../validators/auth.validator';

export class DuplicateEmailError extends Error {}

export async function signup({ name, email, password }: SignupInput) {
  const [existingUser] = await db.select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  if (existingUser) {
    throw new DuplicateEmailError();
  }

  const passwordHash = await hash(password, 12);

  try {
    const [user] = await db.insert(users)
      .values({ name, email, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email });

    if (!user) {
      throw new Error('User insert returned no row');
    }

    return user;
  } catch (error) {
    const cause = error instanceof Error ? error.cause ?? error : error;

    if (
      typeof cause === 'object' && cause !== null &&
      'code' in cause && cause.code === '23505' &&
      'constraint' in cause && cause.constraint === 'users_email_unique'
    ) {
      throw new DuplicateEmailError();
    }

    throw error;
  }
}

// Run bcrypt for unknown emails too, so both failure paths do comparable work.
const dummyPasswordHash = '$2b$12$vz4bNm9vR5qMe9aIVdniKutI8PEb.86zsT.PwCpF1NURS9pS.9uUa';

export async function login({ email, password }: LoginInput) {
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    passwordHash: users.passwordHash,
  })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  const passwordMatches = await compare(password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !passwordMatches) {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email };
}

export async function findUserById(userId: string) {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
}
