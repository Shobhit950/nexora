import cors from 'cors';
import { sql } from 'drizzle-orm';
import express from 'express';
import { db } from './config/db';
import { frontendOrigin } from './config/env';
import { authRouter } from './routes/auth.routes';
import { workflowRouter } from './routes/workflow.routes';

const app = express();

app.use(cors({ origin: frontendOrigin || false, credentials: true }));
app.use('/api/workflows', workflowRouter);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/db-health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', authRouter);

export default app;
