import cors from 'cors';
import { sql } from 'drizzle-orm';
import express from 'express';
import { db } from './config/db';

const app = express();

app.use(cors({ origin: /^http:\/\/localhost:5173$/ }));
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

export default app;
