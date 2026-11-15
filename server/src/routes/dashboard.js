import { Router } from 'express';
import { store } from '../store/db.js';
import { requireAuth } from '../middleware/auth.js';
import { segmentsFor } from '../util/segments.js';
import { listItem } from '../util/serialize.js';
import { aiMeta } from '../ai/index.js';

const router = Router();
router.use(requireAuth);

export async function resolveClientId(req) {
  if (req.user.role === 'client') return req.user.clientId;

  const { clientId } = req.query || req.body;
  if (clientId) return clientId;
  const clients = await store.clients.find();
  return clients[0]?.id || null;
}

router.get('/clients', async (req, res) => {
  if (req.user.role !== 'assistant') {
    const own = await store.clients.findById(req.user.clientId);
    return res.json({ items: own ? [own] : [] });
  }
  const clients = await store.clients.find();
  const withCounts = await Promise.all(
    clients.map(async (c) => {
      const convs = await store.conversations.find({ clientId: c.id });
      const active = convs.filter((x) => !x.flags.archived);
      return {
        id: c.id,
        name: c.name,
        title: c.title,
        company: c.company,
        color: c.color,
        email: c.email,
        open: active.filter((x) => !x.flags.completed).length,
        needsYou: active.filter((x) => x.classification.responsibility === 'client' && !x.flags.completed).length,
      };
    })
  );
  res.json({ items: withCounts });
});

router.get('/overview', async (req, res) => {
  const clientId = await resolveClientId(req);
  if (!clientId) return res.json({ empty: true });

  const [allConvs, accounts, activity, drafts, client] = await Promise.all([
    store.conversations.find({ clientId }),
    store.accounts.find({ clientId }),
    store.activity.find({ clientId }),
    store.drafts.find({ clientId }),
    store.clients.findById(clientId),
  ]);

  const active = allConvs.filter((c) => !c.flags.archived);
  const counts = {};
  for (const c of active) for (const s of segmentsFor(c)) counts[s] = (counts[s] || 0) + 1;

  const stats = {
    total: active.length,
    unread: counts.unread || 0,
    important: counts.important || 0,
    action: counts.action || 0,
    waiting: counts.waiting || 0,
    assistant: counts.assistant || 0,
    client: counts.client || 0,
    none: counts.none || 0,
    review: counts.review || 0,
    meetings: counts.meetings || 0,
    completed: counts.completed || 0,
    archived: allConvs.filter((c) => c.flags.archived).length,
  };

  const recent = active
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
    .slice(0, 6)
    .map((c) => listItem(c, drafts));

  const upcoming = active
    .filter((c) => c.meeting && new Date(c.meeting.start) > new Date())
    .sort((a, b) => new Date(a.meeting.start) - new Date(b.meeting.start))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      subject: c.subject,
      title: c.meeting.title,
      start: c.meeting.start,
      end: c.meeting.end,
      status: c.meeting.status,
      location: c.meeting.location,
    }));

  const needsAttention = active
    .filter((c) => ['client', 'review'].includes(c.classification.responsibility) || (c.flags.requiresAction && c.classification.responsibility === 'assistant'))
    .sort((a, b) => {
      const urgency = (c) => (c.classification.responsibility === 'client' ? 2 : c.classification.responsibility === 'review' ? 1 : 0);
      return urgency(b) - urgency(a) || new Date(b.lastActivityAt) - new Date(a.lastActivityAt);
    })
    .slice(0, 5)
    .map((c) => listItem(c, drafts));

  res.json({
    client,
    stats,
    segments: counts,
    recent,
    upcoming,
    needsAttention,
    activity: activity.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8),
    accounts: accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      address: a.address,
      label: a.label,
      status: a.status,
      lastSyncAt: a.lastSyncAt,
      error: a.error || null,
    })),
    ai: aiMeta,
    openDrafts: drafts.filter((d) => d.status === 'draft').length,
  });
});

export default router;
