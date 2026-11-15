import { Router } from 'express';
import { store } from '../store/db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../util/password.js';
import { publicUser } from '../util/serialize.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const user = await store.users.findOne({ email: email.toLowerCase().trim() });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/signup', async (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  if (!name.trim() || !email.trim()) return res.status(400).json({ error: 'Name and email are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await store.users.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = await store.users.insert({
    id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashPassword(password),
    role: 'assistant',
    title: 'Personal Assistant',
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await store.users.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: publicUser(user) });
});

router.post('/demo', async (req, res) => {
  const { role = 'assistant' } = req.body || {};
  const user =
    role === 'client'
      ? await store.users.findOne({ role: 'client' })
      : await store.users.findOne({ role: 'assistant' });
  if (!user) return res.status(500).json({ error: 'Demo accounts unavailable' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

export default router;
