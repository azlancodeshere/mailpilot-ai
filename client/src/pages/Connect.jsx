import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, ArrowRight, Check, ShieldCheck, Sparkles, RefreshCw, Inbox, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import { Spinner } from '../components/common.jsx';

const PROVIDERS = [
  {
    id: 'gmail',
    name: 'Google Gmail',
    hint: 'Personal & Workspace mailboxes',
    cta: 'Continue with Google',
    email: 'marcus.reed@gmail.com',
    scopes: [
      'Read mail and conversation threads',
      'Mark messages as read, unread or important',
      'Apply labels and keep the inbox organised',
      'Send mail only when you approve a draft',
    ],
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    hint: 'Outlook.com & Microsoft 365',
    cta: 'Continue with Microsoft',
    email: 'marcus@reedadvisory.com',
    scopes: [
      'Read mail (Mail.ReadWrite)',
      'Keep access when the user is away (offline_access)',
      'Basic profile to identify the mailbox owner',
      'Send mail only when you approve a draft',
    ],
  },
];

const STEPS = ['Choose provider', 'Authorize', 'Sync & classify'];

export default function Connect() {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle');
  const [log, setLog] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useAuth();

  const chosen = useMemo(() => PROVIDERS.find((p) => p.id === provider), [provider]);

  const pick = (p) => {
    setProvider(p.id);
    setAddress(p.email);
    setError('');
    setStep(1);
  };

  const authorize = async () => {
    setError('');
    setPhase('authorizing');
    setLog([{ text: `Redirecting to ${chosen.name}…`, done: true }]);
    try {
      const d = await api.post('/accounts/connect', { provider, address, label: chosen.name }, 700);
      setAccountId(d.account.id);
      setLog((l) => [...l, { text: 'Authorization granted — scopes accepted', done: true }]);
      setPhase('syncing');
      setStep(2);
    } catch (err) {
      setError(err.message);
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (phase !== 'syncing' || !accountId) return undefined;
    const timer = setInterval(async () => {
      try {
        const d = await api.get('/accounts');
        const acc = d.items.find((a) => a.id === accountId);
        if (!acc) return;
        setLog((l) => {
          const next = [...l];
          if (acc.syncProgress >= 45 && !next.some((x) => x.text.startsWith('Fetching'))) {
            next.push({ text: 'Fetching threads and attachments…', done: true });
          }
          if (acc.syncProgress >= 78 && !next.some((x) => x.text.startsWith('Indexing'))) {
            next.push({ text: 'Indexing messages…', done: true });
          }
          return next;
        });
        if (acc.status === 'connected') {
          clearInterval(timer);
          setLog((l) => [
            ...l,
            { text: 'Imported 128 messages', done: true },
            { text: 'AI classified every conversation', done: true },
          ]);
          setPhase('done');
          await refresh();
          toast.success('Inbox connected — AI classification is live');
        }
      } catch {

      }
    }, 850);
    return () => clearInterval(timer);
  }, [phase, accountId, refresh, toast]);

  return (
    <div className="connect">
      <div className="connect__bar">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand__mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </span>
          <div className="brand__name">
            MailPilot <span>AI</span>
          </div>
        </div>
        <div className="connect__steps">
          {STEPS.map((s, i) => (
            <span key={s} className={`connect__step ${i === step ? 'connect__step--active' : ''} ${i < step ? 'connect__step--done' : ''}`}>
              <i>{i < step ? <Check size={11} strokeWidth={3} /> : i + 1}</i>
              {s}
              {i < STEPS.length - 1 && <span style={{ margin: '0 4px', color: 'var(--border-strong)' }}>→</span>}
            </span>
          ))}
        </div>
        <Link to="/app" className="btn btn--ghost btn--sm">
          Skip for now
        </Link>
      </div>

      <div className="connect__body">
        <div className="connect__card">
          {step === 0 && (
            <>
              <div className="feature__icon" style={{ margin: '0 auto 14px' }}>
                <Mail size={19} />
              </div>
              <h1 className="connect__title">Connect a client inbox</h1>
              <p className="connect__sub">
                Choose where the client's email lives. MailPilot reads the mailbox, organises it into segments and
                classifies reply responsibility automatically.
              </p>
              {PROVIDERS.map((p) => (
                <button className="provider-option" key={p.id} onClick={() => pick(p)}>
                  <span className={`provider-icon provider-icon--${p.id}`}>{p.id === 'gmail' ? 'G' : 'O'}</span>
                  <span style={{ flex: 1 }}>
                    <b>{p.name}</b>
                    <span>{p.hint}</span>
                  </span>
                  <ArrowRight size={17} className="muted" />
                </button>
              ))}
              <div className="oauth-note">
                <ShieldCheck size={15} style={{ flex: 'none', marginTop: 1 }} />
                <span>
                  <strong>Simulated OAuth for this prototype.</strong> No real credentials are requested — the flow,
                  scopes and sync states mirror the production integration exactly.
                </span>
              </div>
            </>
          )}

          {step === 1 && chosen && (
            <>
              <div className="row gap-12" style={{ justifyContent: 'center', marginBottom: 12 }}>
                <span className={`provider-icon provider-icon--${chosen.id}`}>{chosen.id === 'gmail' ? 'G' : 'O'}</span>
                <div>
                  <h1 className="connect__title" style={{ textAlign: 'left' }}>Authorize {chosen.name}</h1>
                  <p className="connect__sub" style={{ textAlign: 'left', marginTop: 4 }}>
                    MailPilot will request:
                  </p>
                </div>
              </div>
              <ul className="scope-list">
                {chosen.scopes.map((s) => (
                  <li key={s}>
                    <Check size={15} strokeWidth={2.6} /> {s}
                  </li>
                ))}
              </ul>
              <label className="field" style={{ marginTop: 16 }}>
                <span className="field__label">Mailbox to connect</span>
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} type="email" />
              </label>
              {error && (
                <div className="form-error" style={{ marginTop: 12 }}>
                  <AlertCircle size={15} /> {error}
                  {error.includes('already connected') && (
                    <button className="btn btn--soft btn--sm" style={{ marginLeft: 'auto' }} onClick={() => navigate('/app/accounts')}>
                      Manage accounts
                    </button>
                  )}
                </div>
              )}
              <div className="row gap-8" style={{ marginTop: 18 }}>
                <button className="btn btn--secondary" onClick={() => setStep(0)}>
                  Back
                </button>
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={authorize} disabled={phase !== 'idle'}>
                  {phase === 'idle' ? <ShieldCheck size={16} /> : <Spinner />} {chosen.cta}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {phase !== 'done' ? (
                <div className="connect__progress">
                  <div className="connect__ring" />
                  <div className="connect__status">{phase === 'authorizing' ? 'Contacting provider…' : 'Syncing the mailbox'}</div>
                  <div className="connect__status" style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>
                    {address}
                  </div>
                  <div className="connect__log">
                    {log.map((l) => (
                      <div className={`connect__logitem ${l.done ? 'connect__logitem--done' : ''}`} key={l.text}>
                        <Check size={14} strokeWidth={2.6} /> {l.text}
                      </div>
                    ))}
                    <div className="connect__logitem">
                      <Spinner /> Classifying conversations…
                    </div>
                  </div>
                </div>
              ) : (
                <div className="connect__progress">
                  <div
                    className="connect__ring"
                    style={{ animation: 'none', borderColor: 'var(--success)', borderTopColor: 'var(--success)', display: 'grid', placeItems: 'center', background: 'var(--success-bg)' }}
                  >
                    <Check size={26} color="var(--success)" strokeWidth={3} />
                  </div>
                  <div className="connect__status">Inbox connected</div>
                  <div className="connect__substatus">128 messages imported · every conversation classified</div>
                  <div className="connect__log" style={{ maxWidth: 340 }}>
                    {log
                      .filter((l) => l.done)
                      .map((l) => (
                        <div className="connect__logitem connect__logitem--done" key={l.text}>
                          <Check size={14} strokeWidth={2.6} /> {l.text}
                        </div>
                      ))}
                  </div>
                  <button className="btn btn--primary btn--lg" style={{ marginTop: 10 }} onClick={() => navigate('/app', { replace: true })}>
                    <Inbox size={17} /> Open the workspace
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {step === 0 && (
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-3)' }}>
            Already connected something?{' '}
            <Link to="/app" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>
              Go to the dashboard
            </Link>{' '}
            · demo mailbox: <code className="mono">ava@northstarassist.com / demo1234</code>
          </p>
        )}
        {step === 0 && (
          <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 6 }}>
            <span className="badge badge--neutral">
              <RefreshCw size={11} /> Re-sync every 5 minutes
            </span>
            <span className="badge badge--neutral">
              <Sparkles size={11} /> AI classifies on arrival
            </span>
            <span className="badge badge--neutral">
              <Inbox size={11} /> Gmail & Outlook
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
