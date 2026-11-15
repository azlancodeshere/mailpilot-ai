import { Router } from 'express';
import { store } from '../store/db.js';
import { requireAuth } from '../middleware/auth.js';
import { answerQuestion, aiMeta, analysingSteps } from '../ai/index.js';
import { resolveClientId } from './dashboard.js';

const router = Router();
router.use(requireAuth);

router.get('/meta', (req, res) => {
  res.json({ provider: aiMeta.provider, model: aiMeta.model, steps: analysingSteps() });
});

router.post('/ask', async (req, res) => {
  const question = String(req.body?.q || '').trim();
  if (!question) return res.status(400).json({ error: 'Ask a question first' });

  const clientId = await resolveClientId(req);
  const conversations = await store.conversations.find(clientId ? { clientId } : {});
  const client = clientId ? await store.clients.findById(clientId) : null;

  await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));

  const result = answerQuestion({
    question,
    conversations,
    conversationId: req.body?.conversationId || null,
    clientId,
    clientName: client?.name?.split(' ')[0] || 'the client',
  });

  res.json({ ...result, question, at: new Date().toISOString() });
});

export default router;
