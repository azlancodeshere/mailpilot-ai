import { Router } from 'express';
import { store } from '../store/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../util/serialize.js';
import { resolveClientId } from './dashboard.js';

const router = Router();
router.use(requireAuth);

const PROVIDERS = {
  gmail: {
    name: 'Google Gmail',
    domain: 'google.com',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'],
    hint: 'Sign in with Google to let MailPilot read and organise this mailbox.',
  },
  outlook: {
    name: 'Microsoft Outlook',
    domain: 'microsoft.com',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: ['Mail.ReadWrite', 'offline_access', 'User.Read'],
    hint: 'Sign in with Microsoft to let MailPilot read and organise this mailbox.',
  },
};

router.get('/providers', (req, res) => {
  res.json(
    Object.entries(PROVIDERS).map(([id, p]) => ({
      id,
      name: p.name,
      hint: p.hint,
      scopes: p.scopes,
      authUrl: p.authUrl,
    }))
  );
});

router.get('/', async (req, res) => {
  const clientId = await resolveClientId(req);
  const accounts = await store.accounts.find(clientId ? { clientId } : {});
  res.json({
    items: accounts.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      provider: a.provider,
      address: a.address,
      label: a.label,
      status: a.status,
      lastSyncAt: a.lastSyncAt,
      messages: a.messages,
      scopes: a.scopes,
      error: a.error || null,
      syncProgress: a.syncProgress ?? null,
    })),
  });
});

router.post('/connect', requireRole('assistant'), async (req, res) => {
  const { provider, address, label } = req.body || {};
  if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Choose Gmail or Outlook' });
  if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  const clientId = await resolveClientId(req);

  const existing = await store.accounts.findOne({ address: address.toLowerCase().trim() });
  if (existing) return res.status(409).json({ error: 'That account is already connected' });

  const account = await store.accounts.insert({
    id: `acc_${Date.now().toString(36)}`,
    clientId,
    provider,
    address: address.toLowerCase().trim(),
    label: label || PROVIDERS[provider].name,
    status: 'syncing',
    syncProgress: 15,
    lastSyncAt: null,
    messages: 0,
    scopes: PROVIDERS[provider].scopes,
    error: null,
    createdAt: new Date().toISOString(),
  });

  await logActivity(store, { clientId, type: 'sync', text: `${PROVIDERS[provider].name} authorization granted for ${account.address}` });
  simulateSync(account.id, { initial: true });
  res.status(201).json({ account, auth: { provider, scopes: PROVIDERS[provider].scopes, simulated: true } });
});

router.post('/:id/reconnect', requireRole('assistant'), async (req, res) => {
  const account = await store.accounts.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  await store.accounts.update(account.id, { status: 'syncing', syncProgress: 20, error: null });
  await logActivity(store, { clientId: account.clientId, type: 'sync', text: `Reconnecting ${account.address}…` });
  simulateSync(account.id, {});
  res.json({ ok: true });
});

router.post('/:id/sync', requireRole('assistant'), async (req, res) => {
  const account = await store.accounts.findById(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.status === 'syncing') return res.json({ ok: true, alreadySyncing: true });
  await store.accounts.update(account.id, { status: 'syncing', syncProgress: 10, error: null });
  simulateSync(account.id, {});
  res.json({ ok: true });
});

function simulateSync(accountId, { initial = false } = {}) {
  const steps = [
    { delay: 700, progress: 45, note: 'Fetching threads' },
    { delay: 1500, progress: 78, note: 'Indexing messages' },
    { delay: 2400, progress: 100, note: 'Classifying with AI' },
  ];
  for (const step of steps) {
    setTimeout(async () => {
      try {
        const account = await store.accounts.findById(accountId);
        if (!account) return;
        if (step.progress === 100) {
          const bump = initial ? 128 + Math.floor(Math.random() * 40) : 3 + Math.floor(Math.random() * 9);
          await store.accounts.update(accountId, {
            status: 'connected',
            syncProgress: null,
            lastSyncAt: new Date().toISOString(),
            messages: (account.messages || 0) + (initial ? 0 : bump),
            error: null,
          });
          await logActivity(store, {
            clientId: account.clientId,
            type: 'sync',
            text: initial
              ? `Initial sync complete — ${bump} messages imported from ${account.address}`
              : `Synced ${bump} new messages from ${account.address}`,
          });
        } else {
          await store.accounts.update(accountId, { syncProgress: step.progress });
        }
      } catch (err) {
        console.warn('[sync] step failed:', err.message);
      }
    }, step.delay);
  }
}

export default router;
