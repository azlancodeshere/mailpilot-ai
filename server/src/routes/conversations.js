import { Router } from 'express';
import { store } from '../store/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { SEGMENT_META, segmentsFor, inSegment } from '../util/segments.js';
import { listItem, detailItem, logActivity } from '../util/serialize.js';
import { classifyConversation, summarize, draftReply } from '../ai/index.js';
import { resolveClientId } from './dashboard.js';

const router = Router();
router.use(requireAuth);

async function scope(req) {
  const clientId = await resolveClientId(req);
  const { segment = 'inbox', q = '', accountId = '', sort = 'recent' } = req.query;
  return { clientId, segment, q: String(q).trim().toLowerCase(), accountId, sort };
}

router.get('/', async (req, res) => {
  const { clientId, segment, q, accountId, sort } = await scope(req);
  const [all, drafts] = await Promise.all([
    store.conversations.find(clientId ? { clientId } : {}),
    store.drafts.find(clientId ? { clientId } : {}),
  ]);

  let items = all.filter((c) => inSegment(c, segment));
  if (accountId) items = items.filter((c) => c.accountId === accountId);
  if (q) {
    items = items.filter((c) => {
      const hay = `${c.subject} ${c.preview} ${c.summary?.text || ''} ${c.participants.map((p) => `${p.name} ${p.email}`).join(' ')} ${c.messages.map((m) => m.body).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }

  items.sort((a, b) => {
    if (sort === 'oldest') return new Date(a.lastActivityAt) - new Date(b.lastActivityAt);
    if (sort === 'subject') return a.subject.localeCompare(b.subject);
    return new Date(b.lastActivityAt) - new Date(a.lastActivityAt);
  });

  const counts = {};
  for (const c of all) {
    if (accountId && c.accountId !== accountId) continue;
    for (const s of segmentsFor(c)) counts[s] = (counts[s] || 0) + 1;
  }

  res.json({
    items: items.map((c) => listItem(c, drafts)),
    total: items.length,
    counts,
    segments: SEGMENT_META,
    filtered: !!(q || accountId || segment !== 'inbox'),
  });
});

router.get('/:id', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (req.user.role === 'client' && conv.clientId !== req.user.clientId) {
    return res.status(403).json({ error: 'You do not have access to this conversation' });
  }
  const drafts = await store.drafts.find({ conversationId: conv.id });
  res.json({ conversation: detailItem(conv, drafts) });
});

router.patch('/:id', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const body = req.body || {};
  const patch = {};

  if (body.classification?.responsibility) {
    const next = body.classification.responsibility;
    const prev = conv.classification.responsibility;
    if (next !== prev || conv.classification.source !== 'manual') {
      conv.classification = {
        ...conv.classification,
        responsibility: next,
        source: 'manual',
        manualBy: req.user.name,
        confidence: 100,
        reason: body.classification.note?.trim() || `Manually set to ${next} by ${req.user.name} (AI suggested ${prev}).`,
        updatedAt: new Date().toISOString(),
      };
      conv.history = [
        ...(conv.history || []),
        {
          at: new Date().toISOString(),
          type: 'override',
          text:
            next === prev
              ? `Confirmed as ${label(next)} by ${req.user.name}`
              : `Changed from ${label(prev)} to ${label(next)} by ${req.user.name}`,
        },
      ];
      if (next !== prev) {
        await logActivity(store, {
          clientId: conv.clientId,
          type: 'override',
          text: `${req.user.name} reclassified “${trim(conv.subject)}” from ${label(prev)} to ${label(next)}`,
        });
      }
      patch.classification = conv.classification;
      patch.history = conv.history;
      patch.flags = recomputeFlags(conv);
    }
  }

  if (body.flags && typeof body.flags === 'object') {
    for (const key of ['unread', 'important', 'archived', 'completed']) {
      if (typeof body.flags[key] === 'boolean') conv.flags[key] = body.flags[key];
    }
    if (body.flags.completed === true) conv.handledVia = 'assistant';
    conv.flags = recomputeFlags(conv, { keepCompleted: true });
    patch.flags = conv.flags;
    patch.handledVia = conv.handledVia;
    conv.history = [
      ...(conv.history || []),
      { at: new Date().toISOString(), type: 'flag', text: `${req.user.name} updated conversation status` },
    ];
    patch.history = conv.history;
  }

  if (body.action === 'complete') {
    conv.flags.completed = true;
    conv.flags.requiresAction = false;
    conv.handledVia = 'assistant';
    patch.flags = conv.flags;
    patch.handledVia = conv.handledVia;
    await logActivity(store, { clientId: conv.clientId, type: 'client_action', text: `${req.user.name} marked “${trim(conv.subject)}” as completed` });
  }

  if (body.action === 'archive') {
    conv.flags.archived = true;
    patch.flags = conv.flags;
  }

  patch.lastActivityAt = conv.lastActivityAt;
  await store.conversations.update(conv.id, patch);
  const drafts = await store.drafts.find({ conversationId: conv.id });
  res.json({ conversation: detailItem(conv, drafts) });
});

router.post('/:id/reply', requireRole('assistant'), async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Reply text is required' });

  const me = await store.users.findById(req.user.id);
  const outbound = {
    id: `msg_${Date.now().toString(36)}`,
    from: { name: me.name, email: me.email },
    to: conv.participants?.slice(0, 1) || [],
    body: text,
    at: new Date().toISOString(),
    direction: 'outbound',
  };
  conv.messages.push(outbound);
  conv.lastActivityAt = outbound.at;
  conv.flags.unread = false;
  conv.flags.awaitingResponse = true;

  const client = await store.clients.findById(conv.clientId);
  const assistant = me;
  const classification = await classifyConversation({ subject: conv.subject, messages: conv.messages, client, assistant });
  const changed = classification.responsibility !== conv.classification.responsibility;
  conv.classification = { ...classification, source: 'ai' };
  conv.summary = summarize(conv);
  conv.flags = recomputeFlags(conv);
  conv.history = [
    ...(conv.history || []),
    { at: outbound.at, type: 'reply', text: `${me.name} replied` },
    { at: outbound.at, type: 'classified', text: `AI re-classified after your reply → ${label(conv.classification.responsibility)}` },
  ];

  await store.conversations.update(conv.id, {
    messages: conv.messages,
    lastActivityAt: conv.lastActivityAt,
    flags: conv.flags,
    classification: conv.classification,
    summary: conv.summary,
    history: conv.history,
    preview: makePreview(conv),
  });
  await logActivity(store, {
    clientId: conv.clientId,
    type: 'reply',
    text: `Reply sent for “${trim(conv.subject)}”${changed ? ` — re-classified as ${label(conv.classification.responsibility)}` : ''}`,
  });

  const drafts = await store.drafts.find({ conversationId: conv.id });
  res.json({ conversation: detailItem({ ...conv, preview: makePreview(conv) }, drafts), reclassified: changed });
});

router.post('/:id/reclassify', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const client = await store.clients.findById(conv.clientId);
  const assistant = (await store.users.findOne({ role: 'assistant' })) || null;

  await new Promise((r) => setTimeout(r, 650));

  const classification = await classifyConversation({ subject: conv.subject, messages: conv.messages, client, assistant });
  const changed = classification.responsibility !== conv.classification.responsibility;
  const wasManual = conv.classification.source === 'manual';

  conv.classification = { ...classification, source: 'ai' };
  conv.flags = recomputeFlags(conv);
  conv.summary = summarize(conv);
  conv.history = [
    ...(conv.history || []),
    {
      at: new Date().toISOString(),
      type: 'classified',
      text: `AI re-analysis → ${label(classification.responsibility)} (${classification.confidence}%)${wasManual ? ', replacing the manual override' : ''}`,
    },
  ];

  await store.conversations.update(conv.id, {
    classification: conv.classification,
    flags: conv.flags,
    summary: conv.summary,
    history: conv.history,
  });
  await logActivity(store, {
    clientId: conv.clientId,
    type: 'classify',
    text: `AI re-analysed “${trim(conv.subject)}” → ${label(classification.responsibility)}`,
  });

  const drafts = await store.drafts.find({ conversationId: conv.id });
  res.json({ conversation: detailItem(conv, drafts), changed });
});

router.post('/:id/summarize', async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  await new Promise((r) => setTimeout(r, 500));
  conv.summary = summarize(conv);
  await store.conversations.update(conv.id, { summary: conv.summary });
  res.json({ summary: conv.summary });
});

router.post('/:id/draft', requireRole('assistant'), async (req, res) => {
  const conv = await store.conversations.findById(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const tone = ['professional', 'friendly', 'concise'].includes(req.body?.tone) ? req.body.tone : 'professional';
  const variant = Number(req.body?.variant || 0);
  await new Promise((r) => setTimeout(r, 550));

  const client = await store.clients.findById(conv.clientId);
  const draft = draftReply({ ...conv, client }, { tone, variant });

  const doc = {
    id: `drf_${Date.now().toString(36)}`,
    conversationId: conv.id,
    clientId: conv.clientId,
    text: draft.text,
    tone: draft.tone,
    variant: draft.variant,
    notes: draft.notes,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  await store.drafts.insert(doc);
  await logActivity(store, { clientId: conv.clientId, type: 'draft', text: `Draft reply prepared for “${trim(conv.subject)}”` });
  res.json({ draft: doc, reviewRequired: true });
});

router.post('/drafts/:draftId/send', requireRole('assistant'), async (req, res) => {
  const draft = await store.drafts.findById(req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  const conv = await store.conversations.findById(draft.conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const me = await store.users.findById(req.user.id);
  const outbound = {
    id: `msg_${Date.now().toString(36)}`,
    from: { name: me.name, email: me.email },
    to: conv.participants?.slice(0, 1) || [],
    body: draft.text,
    at: new Date().toISOString(),
    direction: 'outbound',
  };
  conv.messages.push(outbound);
  conv.lastActivityAt = outbound.at;
  conv.flags.unread = false;
  conv.flags.awaitingResponse = true;
  const classification = await classifyConversation({ subject: conv.subject, messages: conv.messages, client: await store.clients.findById(conv.clientId), assistant: me });
  conv.classification = { ...classification, source: 'ai' };
  conv.summary = summarize(conv);
  conv.flags = recomputeFlags(conv);
  conv.history = [...(conv.history || []), { at: outbound.at, type: 'reply', text: 'Approved draft sent by ' + me.name }];

  await store.drafts.update(draft.id, { status: 'sent', sentAt: outbound.at });
  await store.conversations.update(conv.id, {
    messages: conv.messages,
    lastActivityAt: conv.lastActivityAt,
    flags: conv.flags,
    classification: conv.classification,
    summary: conv.summary,
    history: conv.history,
    preview: makePreview(conv),
  });
  await logActivity(store, { clientId: conv.clientId, type: 'reply', text: `Approved draft sent for “${trim(conv.subject)}”` });

  const drafts = await store.drafts.find({ conversationId: conv.id });
  res.json({ conversation: detailItem({ ...conv, preview: makePreview(conv) }, drafts) });
});

function label(r) {
  return { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed', review: 'Needs review' }[r] || r;
}

function trim(s = '') {
  return s.length > 48 ? s.slice(0, 45) + '…' : s;
}

function recomputeFlags(conv, { keepCompleted = false } = {}) {
  const f = conv.flags;
  const latestInbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const hasQuestion = /\?/.test((latestInbound || conv.messages[conv.messages.length - 1])?.body || '');
  f.requiresAction =
    !f.completed &&
    ['assistant', 'client'].includes(conv.classification.responsibility) &&
    (conv.classification.deadline || hasQuestion || conv.classification.rules?.includes('approval'));
  f.awaitingResponse = conv.messages[conv.messages.length - 1]?.direction === 'outbound' && !f.completed;
  if (keepCompleted && f.completed) f.requiresAction = false;
  return f;
}

function makePreview(conv) {
  const last = conv.messages[conv.messages.length - 1];
  const body = (last?.body || '').replace(/\s+/g, ' ').trim();
  return body.length > 160 ? body.slice(0, 157) + '…' : body;
}

export default router;
