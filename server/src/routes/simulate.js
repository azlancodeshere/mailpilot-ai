import { Router } from 'express';
import { store } from '../store/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { classifyConversation, summarize } from '../ai/index.js';
import { INCOMING_QUEUE } from '../store/incoming.js';
import { listItem, logActivity } from '../util/serialize.js';

const router = Router();
router.use(requireAuth, requireRole('assistant'));

let cursor = 0;

router.get('/queue', (req, res) => {
  res.json({ remaining: INCOMING_QUEUE.length, next: INCOMING_QUEUE[cursor % INCOMING_QUEUE.length].note });
});

router.post('/incoming', async (req, res) => {
  const clientId = req.user.clientId || req.body?.clientId || 'cli_marcus';
  const template = INCOMING_QUEUE[cursor % INCOMING_QUEUE.length];
  cursor = (cursor + 1) % INCOMING_QUEUE.length;

  const at = new Date().toISOString();
  const newMessage = { id: `msg_${Date.now().toString(36)}`, ...template.message, at, direction: 'inbound' };

  let conv;
  if (template.kind === 'append') {
    conv = (await store.conversations.find({ clientId })).find(
      (c) => c.subject.toLowerCase() === template.appendToSubject.toLowerCase()
    );
    if (!conv) return res.status(404).json({ error: 'Thread to append to was not found (try resetting data)' });
    conv.messages.push(newMessage);
    conv.lastActivityAt = at;
    conv.flags.unread = true;
  } else {
    conv = {
      id: `cnv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      clientId,
      accountId: template.accountId,
      subject: template.message.subject,
      participants: [template.message.from],
      messages: [newMessage],
      flags: {
        unread: true,
        important: false,
        archived: false,
        completed: false,
        awaitingResponse: false,
        requiresAction: false,
      },
      meeting: null,
      summary: null,
      preview: '',
      createdAt: at,
      lastActivityAt: at,
      history: [],
    };
  }

  await new Promise((r) => setTimeout(r, 450));
  const client = await store.clients.findById(clientId);
  const assistant = await store.users.findOne({ role: 'assistant' });
  const previous = conv.classification?.responsibility || null;
  const classification = await classifyConversation({ subject: conv.subject, messages: conv.messages, client, assistant });
  conv.classification = { ...classification, source: 'ai' };
  conv.summary = summarize(conv);
  conv.preview = firstLine(conv);
  conv.flags.requiresAction =
    ['assistant', 'client'].includes(classification.responsibility) &&
    (classification.deadline || /\?/.test(template.message.body));
  conv.flags.awaitingResponse = conv.messages[conv.messages.length - 1].direction === 'outbound';
  conv.history = [
    ...(conv.history || []),
    {
      at,
      type: previous && previous !== classification.responsibility ? 'reclassified' : 'classified',
      text:
        previous && previous !== classification.responsibility
          ? `New message arrived — AI re-classified from ${label(previous)} to ${label(classification.responsibility)} (${classification.confidence}%)`
          : `AI classified incoming message as ${label(classification.responsibility)} (${classification.confidence}%)`,
    },
  ];

  await store.conversations.update(conv.id, conv);
  await logActivity(store, {
    clientId,
    type: 'incoming',
    text:
      previous && previous !== classification.responsibility
        ? `New message in “${short(conv.subject)}” — re-classified ${label(previous)} → ${label(classification.responsibility)}`
        : `New email “${short(conv.subject)}” → classified ${label(classification.responsibility)}`,
  });

  res.json({
    conversation: listItem(conv),
    previous,
    reclassified: !!previous && previous !== classification.responsibility,
    queueNote: INCOMING_QUEUE[cursor].note,
  });
});

function firstLine(conv) {
  const last = conv.messages[conv.messages.length - 1];
  const body = (last?.body || '').replace(/\s+/g, ' ').trim();
  return body.length > 160 ? body.slice(0, 157) + '…' : body;
}

function label(r) {
  return { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed', review: 'Needs review' }[r] || r;
}

function short(s = '') {
  return s.length > 40 ? s.slice(0, 37) + '…' : s;
}

export default router;
