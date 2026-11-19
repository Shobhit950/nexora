import cookieParser from 'cookie-parser';
import { Router } from 'express';
import { loginController, logoutController, meController, refreshController, signupController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/require-auth';

export const authRouter = Router();

authRouter.post('/signup', signupController);
authRouter.post('/login', loginController);
authRouter.get('/me', requireAuth, meController);
authRouter.post('/refresh', cookieParser(), refreshController);
authRouter.post('/logout', cookieParser(), logoutController);
