import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, UserRound, Bot, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import { Spinner } from '../components/common.jsx';

function Aside({ quote, by, points }) {
  return (
    <aside className="auth__aside">
      <div className="brand" style={{ padding: 0 }}>
        <span className="brand__mark" style={{ background: 'rgba(255,255,255,.18)', boxShadow: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </span>
        <div>
          <div className="brand__name" style={{ color: '#fff' }}>
            MailPilot <span style={{ color: '#c7d2fe' }}>AI</span>
          </div>
        </div>
      </div>
      <div>
        <p className="auth__quote">{quote}</p>
        <div className="auth__by">
          <span className="avatar avatar--sm" style={{ background: 'rgba(255,255,255,.25)' }}>
            {by[0]}
          </span>
          {by}
        </div>
      </div>
      <div className="auth__points">
        {points.map((p) => (
          <div className="auth__point" key={p}>
            <Check size={16} strokeWidth={2.6} style={{ marginTop: 2, color: '#a5b4fc' }} />
            {p}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Shell({ title, sub, children, alt }) {
  return (
    <div className="auth">
      <Aside
        quote={
          <>
            “The inbox stopped being the job. <em>Deciding who answers</em> is the job — and now it takes seconds.”
          </>
        }
        by="Ava Bennett, personal assistant to Marcus Reed"
        points={[
          'AI classifies reply responsibility the moment mail arrives',
          'Clients see a minimal view of only what needs them',
          'Drafts, summaries and Q&A — always human-approved',
        ]}
      />
      <main className="auth__main">
        <div className="auth__card">
          <h1 className="auth__title">{title}</h1>
          <p className="auth__sub">{sub}</p>
          {children}
          <div className="auth__alt">{alt}</div>
        </div>
      </main>
    </div>
  );
}

function DemoButtons({ onDemo }) {
  const [busy, setBusy] = useState('');
  const run = async (role) => {
    setBusy(role);
    try {
      await onDemo(role);
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <div className="divider">or explore instantly</div>
      <div className="demo-row">
        <button className="demo-btn" onClick={() => run('assistant')} disabled={!!busy}>
          {busy === 'assistant' ? <Spinner /> : <span className="provider-icon provider-icon--gmail" style={{ width: 30, height: 30, borderRadius: 9, fontSize: 12 }}>A</span>}
          <span>
            <b>Assistant demo</b>
            <span>Ava's full workspace</span>
          </span>
        </button>
        <button className="demo-btn" onClick={() => run('client')} disabled={!!busy}>
          {busy === 'client' ? <Spinner /> : <span className="provider-icon provider-icon--outlook" style={{ width: 30, height: 30, borderRadius: 9, fontSize: 12 }}>M</span>}
          <span>
            <b>Client demo</b>
            <span>Marcus's minimal view</span>
          </span>
        </button>
      </div>
    </>
  );
}

export function Login() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('ava@northstarassist.com');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(user.role === 'client' ? '/client' : '/app', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = async (role) => {
    try {
      await demoLogin(role);
      navigate(role === 'client' ? '/client' : '/app', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Shell
      title="Welcome back"
      sub="Sign in to the assistant workspace, or jump straight into a demo."
      alt={
        <>
          New here? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={submit}>
        {error && (
          <div className="form-error">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        <label className="field">
          <span className="field__label">Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <Spinner /> : <ArrowRight size={16} />} Sign in
        </button>
        <DemoButtons onDemo={demo} />
      </form>
    </Shell>
  );
}

export function Signup() {
  const { signup, demoLogin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup(name, email, password);
      toast.success('Account created — let’s connect an inbox');
      navigate('/connect', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const demo = async (role) => {
    try {
      await demoLogin(role);
      navigate(role === 'client' ? '/client' : '/app', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Shell
      title="Create your workspace"
      sub="You’ll connect a client inbox next — it takes about a minute."
      alt={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={submit}>
        {error && (
          <div className="form-error">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        <label className="field">
          <span className="field__label">Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ava Bennett" autoComplete="name" required />
        </label>
        <label className="field">
          <span className="field__label">Work email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" autoComplete="email" required />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" minLength={6} required />
        </label>
        <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <Spinner /> : <Sparkles size={16} />} Create account
        </button>
        <DemoButtons onDemo={demo} />
      </form>
    </Shell>
  );
}
