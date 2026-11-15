import { Router } from 'express';
import { store } from '../store/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { detailItem, logActivity } from '../util/serialize.js';

const router = Router();
router.use(requireAuth, requireRole('client'));

router.get('/items', async (req, res) => {
  const clientId = req.user.clientId;
  const [convs, drafts, client, accounts] = await Promise.all([
    store.conversations.find({ clientId }),
    store.drafts.find({ clientId }),
    store.clients.findById(clientId),
    store.accounts.find({ clientId }),
  ]);

  const items = convs
    .filter((c) => !c.flags.archived)
    .filter((c) => c.classification.responsibility === 'client' && !c.flags.completed)
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
    .map((c) => ({
      id: c.id,
      subject: c.subject,
      sender: c.messages[c.messages.length - 1]?.from || c.participants?.[0] || null,
      receivedAt: c.lastActivityAt,
      summary: c.summary?.text || '',
      bullets: c.summary?.bullets || [],
      why: c.classification.reason,
      confidence: c.classification.confidence,
      signals: c.classification.signals || [],
      important: !!c.flags.important,
      hasDeadline: !!c.classification.deadline,
      meeting: c.meeting || null,
      messageCount: c.messages.length,
    }));

  const handled = convs.filter((c) => c.flags.completed || (c.classification.responsibility !== 'client' && c.handledVia)).length;

  res.json({
    client,
    items,
    counts: {
      needsYou: items.length,
      handled,
      total: convs.filter((c) => !c.flags.archived).length,
    },
    connectedAccounts: accounts.filter((a) => a.status === 'connected').length,
    assistant: { name: 'Ava Bennett', email: 'ava@northstarassist.com' },
    hasDrafts: drafts.length > 0,
  });
});

router.get('/items/:id', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv || conv.clientId !== req.user.clientId) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  const drafts = await store.drafts.find({ conversationId: conv.id });
  res.json({ conversation: detailItem(conv, drafts) });
});

router.post('/items/:id/handle', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv || conv.clientId !== req.user.clientId) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const prev = conv.classification.responsibility;
  conv.classification = {
    ...conv.classification,
    responsibility: 'none',
    source: 'manual',
    manualBy: req.user.name,
    confidence: 100,
    reason: `${req.user.name} marked this as handled — no reply expected.`,
    updatedAt: new Date().toISOString(),
  };
  conv.flags.completed = true;
  conv.flags.requiresAction = false;
  conv.flags.unread = false;
  conv.handledVia = 'client';
  conv.history = [
    ...(conv.history || []),
    { at: new Date().toISOString(), type: 'client_action', text: `${req.user.name} marked this as handled` },
  ];

  await store.conversations.update(conv.id, {
    classification: conv.classification,
    flags: conv.flags,
    handledVia: conv.handledVia,
    history: conv.history,
  });
  await logActivity(store, {
    clientId: conv.clientId,
    type: 'client_action',
    text: `${req.user.name} marked “${short(conv.subject)}” as handled${prev === 'client' ? ' — it left the client queue' : ''}`,
  });

  res.json({ ok: true, removed: true });
});

router.post('/items/:id/takeover', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv || conv.clientId !== req.user.clientId) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const prev = conv.classification.responsibility;
  conv.classification = {
    ...conv.classification,
    responsibility: 'assistant',
    source: 'manual',
    manualBy: req.user.name,
    confidence: 100,
    reason: `${req.user.name} asked the assistant to take this over.`,
    updatedAt: new Date().toISOString(),
  };
  conv.flags.completed = false;
  conv.handledVia = 'assistant';
  conv.history = [
    ...(conv.history || []),
    { at: new Date().toISOString(), type: 'client_action', text: `${req.user.name} asked the assistant to take over` },
  ];

  await store.conversations.update(conv.id, {
    classification: conv.classification,
    flags: conv.flags,
    handledVia: conv.handledVia,
    history: conv.history,
  });
  await logActivity(store, {
    clientId: conv.clientId,
    type: 'client_action',
    text: `${req.user.name} asked Ava to take over “${short(conv.subject)}”${prev === 'client' ? '' : ` (was ${prev})`}`,
  });

  res.json({ ok: true, reassigned: true });
});

function short(s = '') {
  return s.length > 44 ? s.slice(0, 41) + '…' : s;
}

export default router;
