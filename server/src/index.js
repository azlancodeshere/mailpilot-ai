import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { initDb, store, backend } from './store/db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import conversationRoutes from './routes/conversations.js';
import aiRoutes from './routes/ai.js';
import accountRoutes from './routes/accounts.js';
import clientRoutes from './routes/client.js';
import simulateRoutes from './routes/simulate.js';
import { reseed } from './store/db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'MailPilot AI', backend: backend(), time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);

app.post('/api/dev/reset', async (req, res) => {
  if (backend() !== 'memory') return res.status(400).json({ error: 'Reset only supported on the in-memory backend' });
  await reseed();
  res.json({ ok: true });
});

app.use('/api', dashboardRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/simulate', simulateRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: `Unknown endpoint: ${req.method} ${req.path}` }));

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'MailPilot AI API is running. Start the client with: npm run dev (root).',
      health: '/api/health',
    });
  });
}

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side — please try again' });
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const db = await initDb();

if (backend() === 'memory') {
  for (const a of await store.accounts.find({ status: 'syncing' })) {
    await store.accounts.update(a.id, { status: 'connected', syncProgress: null, lastSyncAt: new Date().toISOString() });
  }
}

app.listen(config.port, () => {
  console.log(`\n  ✈  MailPilot AI API  →  http://localhost:${config.port}  (${db.backend} backend)`);
  console.log(`     AI engine: ${config.aiProvider === 'openai' && config.openaiKey ? 'openai' : 'builtin signal engine'}\n`);
});
