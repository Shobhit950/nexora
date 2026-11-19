import { z } from 'zod';

const authEmail = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: authEmail,
  password: z.string().min(8).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
  ),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: authEmail,
  password: z.string().min(1).refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
  ),
});

export type LoginInput = z.infer<typeof loginSchema>;
