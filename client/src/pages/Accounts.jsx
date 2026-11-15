import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw, Plus, ShieldCheck, AlertCircle, Check, Mail, ArrowRight, Inbox,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import { bump } from '../components/shell.jsx';
import { Modal, Spinner, CardSkeleton, Empty } from '../components/common.jsx';
import { relativeTime } from '../lib/format.js';

const PROVIDERS = [
  {
    id: 'gmail',
    name: 'Google Gmail',
    hint: 'Personal & Workspace mailboxes',
    email: 'ava.bennett@gmail.com',
    scopes: ['Read mail and threads', 'Labels & read state', 'Send only when you approve'],
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    hint: 'Outlook.com & Microsoft 365',
    email: 'ops@northstarassist.com',
    scopes: ['Mail.ReadWrite', 'offline_access', 'User.Read'],
  },
];

export default function Accounts() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState('');
  const [authError, setAuthError] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const toast = useToast();
  const { clientId } = useAuth();
  const prevSyncing = useRef(new Set());

  const load = useCallback(
    async (delay) => {
      try {
        const d = await api.get(`/accounts${clientId ? `?clientId=${clientId}` : ''}`, delay);
        setItems(d.items);
        setError('');

        const nowSyncing = new Set(d.items.filter((a) => a.status === 'syncing').map((a) => a.id));
        for (const a of d.items) {
          if (prevSyncing.current.has(a.id) && !nowSyncing.has(a.id) && a.status === 'connected') {
            toast.success(`${a.address} synced — ${a.messages.toLocaleString()} messages indexed`);
            bump();
          }
        }
        prevSyncing.current = nowSyncing;
      } catch (err) {
        setError(err.message);
      }
    },
    [toast, clientId]
  );

  useEffect(() => {
    load(320);
  }, [load]);

  useEffect(() => {
    if (!items?.some((a) => a.status === 'syncing')) return undefined;
    const t = setInterval(() => load(), 1100);
    return () => clearInterval(t);
  }, [items, load]);

  const act = async (id, action, msg) => {
    try {
      await api.post(`/accounts/${id}/${action}`);
      toast.info(msg);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startConnect = (p) => {
    setProvider(p);
    setAddress(p.email);
    setAuthError('');
  };

  const authorize = async () => {
    setAuthError('');
    setAuthorizing(true);
    try {
      await api.post('/accounts/connect', { provider: provider.id, address, label: provider.name }, 700);
      setOpen(false);
      setProvider(null);
      toast.success('Authorization granted — initial sync started');
      load();
      bump();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Mailbox connections</h1>
          <p className="page-head__sub">
            Gmail and Outlook mailboxes MailPilot reads, syncs and classifies for each client.
          </p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => load()}>
            <RefreshCw size={14} /> Sync all
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Connect account
          </button>
        </div>
      </div>

      {error ? (
        <div className="card card--pad">
          <Empty
            icon={AlertCircle}
            title="Couldn’t load accounts"
            text={error}
            action={
              <button className="btn btn--secondary" onClick={() => load()}>
                Retry
              </button>
            }
          />
        </div>
      ) : items === null ? (
        <div className="accounts-grid">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} height={190} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card card--pad">
          <Empty
            brand
            icon={Mail}
            title="No mailboxes yet"
            text="Connect a Gmail or Outlook mailbox to start classifying reply responsibility automatically."
            action={
              <button className="btn btn--primary" onClick={() => setOpen(true)}>
                <Plus size={15} /> Connect an account
              </button>
            }
          />
        </div>
      ) : (
        <div className="accounts-grid">
          {items.map((a) => (
            <AccountCard key={a.id} a={a} onSync={() => act(a.id, 'sync', `Syncing ${a.address}…`)} onReconnect={() => act(a.id, 'reconnect', `Reconnecting ${a.address}…`)} />
          ))}
        </div>
      )}

      <div className="oauth-note" style={{ marginTop: 18 }}>
        <ShieldCheck size={15} style={{ flex: 'none', marginTop: 1 }} />
        <span>
          <strong>OAuth and sync are simulated in this prototype.</strong> No real Google or Microsoft
          permissions are requested — provider URLs, scopes, progress states and error recovery mirror the
          production integration.
        </span>
      </div>

      <Modal
        open={open}
        onClose={() => !authorizing && (setOpen(false), setProvider(null))}
        title={provider ? `Authorize ${provider.name}` : 'Connect a mailbox'}
        desc={provider ? 'MailPilot will request these permissions:' : 'Choose where the mailbox lives.'}
        footer={
          provider ? (
            <>
              <button className="btn btn--secondary" onClick={() => setProvider(null)} disabled={authorizing}>
                Back
              </button>
              <button className="btn btn--primary" onClick={authorize} disabled={authorizing || !address.trim()}>
                {authorizing ? <Spinner /> : <ShieldCheck size={16} />} Continue with{' '}
                {provider.id === 'gmail' ? 'Google' : 'Microsoft'}
              </button>
            </>
          ) : null
        }
      >
        {!provider ? (
          <div className="stack" style={{ display: 'grid', gap: 10 }}>
            {PROVIDERS.map((p) => (
              <button className="provider-option" key={p.id} onClick={() => startConnect(p)}>
                <span className={`provider-icon provider-icon--${p.id}`}>{p.id === 'gmail' ? 'G' : 'O'}</span>
                <span style={{ flex: 1 }}>
                  <b>{p.name}</b>
                  <span>{p.hint}</span>
                </span>
                <ArrowRight size={17} className="muted" />
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div className="row gap-12" style={{ marginBottom: 14 }}>
              <span className={`provider-icon provider-icon--${provider.id}`}>
                {provider.id === 'gmail' ? 'G' : 'O'}
              </span>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                {provider.scopes.map((s) => (
                  <div key={s} className="row gap-6">
                    <Check size={13} strokeWidth={2.8} color="var(--success)" /> <span className="mono" style={{ fontSize: 12.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="field__label">Mailbox to connect</span>
              <input className="input" type="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="name@company.com" />
            </label>
            {authError && (
              <div className="form-error" style={{ marginTop: 10 }}>
                <AlertCircle size={15} /> {authError}
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.6 }}>
              Simulated consent screen — nothing leaves this machine. Duplicate addresses are rejected just
              like the real integration.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AccountCard({ a, onSync, onReconnect }) {
  const syncing = a.status === 'syncing';
  const failed = a.status === 'error';

  return (
    <div className={`account-card ${failed ? 'account-card--error' : ''} ${syncing ? 'account-card--syncing' : ''}`}>
      <div className="account-card__top">
        <span className={`provider-icon provider-icon--${a.provider}`}>{a.provider === 'gmail' ? 'G' : 'O'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="account-card__addr">{a.address}</div>
          <div className="account-card__label">{a.label}</div>
        </div>
        <span className={`badge badge--${failed ? 'danger' : syncing ? 'brand' : 'success'}`}>
          {failed ? <AlertCircle size={11} /> : syncing ? <RefreshCw size={11} className="spin" /> : <Check size={11} strokeWidth={3} />}
          {failed ? 'Needs attention' : syncing ? 'Syncing' : 'Connected'}
        </span>
      </div>

      {syncing && (
        <div>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${a.syncProgress ?? 10}%` }} />
          </div>
          <div className="account-card__label" style={{ marginTop: 6 }}>
            {a.syncProgress >= 90 ? 'Classifying with AI…' : a.syncProgress >= 70 ? 'Indexing messages…' : 'Fetching threads…'} · {a.syncProgress}%
          </div>
        </div>
      )}

      {failed && (
        <div className="error-note">
          <AlertCircle size={14} style={{ flex: 'none', marginTop: 1 }} />
          <span>{a.error || 'Connection failed'}</span>
        </div>
      )}

      <div className="account-card__stats">
        <div className="account-card__stat">
          <b className="tnum">{(a.messages || 0).toLocaleString()}</b> messages
        </div>
        <div className="account-card__stat">
          <b>{a.lastSyncAt ? relativeTime(a.lastSyncAt) : '—'}</b> last sync
        </div>
        <div className="account-card__stat">
          <b>{a.scopes?.length || 0}</b> scopes
        </div>
      </div>

      <div className="account-card__actions">
        {failed ? (
          <button className="btn btn--primary btn--sm" onClick={onReconnect}>
            <RefreshCw size={14} /> Reconnect
          </button>
        ) : (
          <button className="btn btn--secondary btn--sm" onClick={onSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        )}
        <span className="badge badge--neutral" style={{ marginLeft: 'auto' }}>
          <Inbox size={11} /> {a.provider === 'gmail' ? 'Gmail API' : 'Graph API'}
        </span>
      </div>
    </div>
  );
}
