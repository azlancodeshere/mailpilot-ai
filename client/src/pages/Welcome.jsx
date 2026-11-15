import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles, ArrowRight, Check, Bot, UserRound, FileText, Calendar,
  ShieldCheck, Zap, Layers, Wand2, Inbox,
} from 'lucide-react';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import { Avatar, RespBadge, Spinner } from '../components/common.jsx';
import { useState } from 'react';

function Brand({ light = false }) {
  return (
    <div className="brand" style={{ padding: 0 }}>
      <span className="brand__mark">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      </span>
      <div>
        <div className="brand__name" style={light ? { color: '#fff' } : undefined}>
          MailPilot <span style={light ? { color: '#c7d2fe' } : undefined}>AI</span>
        </div>
        <div className="brand__tag" style={light ? { color: 'rgba(255,255,255,.65)' } : undefined}>
          For personal assistants
        </div>
      </div>
    </div>
  );
}

function HeroMock() {
  return (
    <div className="mock" aria-hidden>
      <div className="mock__window">
        <div className="mock__bar">
          <span className="mock__dot" style={{ background: '#f87171' }} />
          <span className="mock__dot" style={{ background: '#fbbf24' }} />
          <span className="mock__dot" style={{ background: '#34d399' }} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8, fontWeight: 600 }}>
            MailPilot — Reed Advisory Group
          </span>
        </div>
        <div className="mock__body">
          <div className="mock__side">
            <div className="mock__navitem mock__navitem--active">
              <Inbox size={12} /> Inbox <span className="n">21</span>
            </div>
            <div className="mock__navitem">
              <UserRound size={12} /> Client to reply <span className="n">5</span>
            </div>
            <div className="mock__navitem">
              <Bot size={12} /> Assistant <span className="n">4</span>
            </div>
            <div className="mock__navitem">
              <FileText size={12} /> Action required <span className="n">8</span>
            </div>
            <div className="mock__navitem">
              <Calendar size={12} /> Meetings <span className="n">4</span>
            </div>
            <div className="mock__navitem">
              <Sparkles size={12} /> Needs review <span className="n">2</span>
            </div>
          </div>
          <div className="mock__main">
            <div className="mock__stats">
              <div className="mock__stat">
                <b>21</b>
                <span>EMAILS</span>
              </div>
              <div className="mock__stat">
                <b>6</b>
                <span>UNREAD</span>
              </div>
              <div className="mock__stat">
                <b>8</b>
                <span>ACTIONS</span>
              </div>
              <div className="mock__stat">
                <b style={{ color: 'var(--c-client)' }}>5</b>
                <span>NEEDS MARCUS</span>
              </div>
            </div>

            <div className="mock__email mock__email--hi">
              <div className="mock__email-top">
                <span className="mock__email-from">Laura Chen · Northbridge</span>
                <RespBadge value="client" size="sm" />
              </div>
              <div className="mock__email-sub">Term sheet — revised terms for committee</div>
              <div className="mock__email-prev">
                “We'd love your thoughts before it goes to the investment committee. Could you confirm by Wednesday…”
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className="signal" style={{ fontSize: 10 }}>Decision requested</span>
                <span className="signal" style={{ fontSize: 10 }}>Deadline Wednesday</span>
              </div>
            </div>

            <div className="mock__email">
              <div className="mock__email-top">
                <span className="mock__email-from">Riverside Family Dental</span>
                <RespBadge value="assistant" size="sm" />
              </div>
              <div className="mock__email-sub">Isabella's check-up — reschedule?</div>
              <div className="mock__email-prev">“Are you free Thursday at 4:15 PM or Friday at 9:00 AM?”</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mock__float">
        <div className="mock__float-title">
          <Sparkles size={12} /> Why this needs the client
        </div>
        <div className="mock__float-why">
          Asks for a <b>decision before Wednesday</b> on revised investment terms — approvals stay with Marcus.
        </div>
        <div className="confidence" style={{ marginTop: 9 }}>
          <div className="confidence__track">
            <div className="confidence__fill confidence__fill--high" style={{ width: '96%' }} />
          </div>
          <span className="confidence__value">96%</span>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: 'AI decides who replies',
    text: 'Every conversation is classified the moment it lands: assistant to reply, client to reply, no reply needed — with the reasoning and a confidence score you can correct in one click.',
  },
  {
    icon: UserRound,
    title: 'A calm view for the client',
    text: 'Clients get a stripped-back screen showing only what needs them personally, with a plain-English summary and one-tap “handled” or “Ava, take this”.',
  },
  {
    icon: Wand2,
    title: 'Summaries, drafts & answers',
    text: 'Ask “what am I waiting on?”, summarise a 14-message thread, or generate a reply draft you review and approve — nothing ever sends without you.',
  },
];

const POINTS = [
  'Gmail & Microsoft 365 connection flow',
  'Segments, search and filters that never lose context',
  'Manual overrides the AI actually respects',
];

export default function Welcome() {
  const navigate = useNavigate();
  const { demoLogin } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState('');

  const enter = async (role) => {
    setBusy(role);
    try {
      await demoLogin(role);
      toast.success(role === 'assistant' ? 'Welcome back, Ava' : 'Opening the client view');
      navigate(role === 'assistant' ? '/app' : '/client', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="welcome">
      <nav className="welcome__nav">
        <Brand />
        <div className="welcome__nav-actions">
          <button className="btn btn--ghost" onClick={() => navigate('/login')}>
            Sign in
          </button>
          <button className="btn btn--primary" onClick={() => navigate('/signup')}>
            Create account
          </button>
        </div>
      </nav>

      <section className="welcome__hero">
        <div>
          <span className="welcome__eyebrow">
            <Sparkles size={13} strokeWidth={2.4} /> AI email management for personal assistants
          </span>
          <h1 className="welcome__h1">
            Every client email, answered by <em>the right person.</em>
          </h1>
          <p className="welcome__lede">
            MailPilot connects your clients' inboxes, works out who actually needs to reply — you or them — and turns a
            crowded inbox into a short, prioritised list. Your clients only ever see what needs them.
          </p>
          <div className="welcome__ctas">
            <button className="btn btn--primary btn--lg" onClick={() => enter('assistant')} disabled={!!busy}>
              {busy === 'assistant' ? <Spinner /> : <ArrowRight size={17} />} Explore the assistant demo
            </button>
            <button className="btn btn--secondary btn--lg" onClick={() => enter('client')} disabled={!!busy}>
              {busy === 'client' ? <Spinner /> : <UserRound size={16} />} Open client view
            </button>
          </div>
          <div className="welcome__proof">
            {POINTS.map((p) => (
              <span className="welcome__proof-item" key={p}>
                <Check size={14.5} strokeWidth={2.6} /> {p}
              </span>
            ))}
          </div>
        </div>

        <HeroMock />
      </section>

      <section className="welcome__features">
        <h2>Think beyond a traditional email dashboard</h2>
        <p>Three ideas that make everyday email management measurably faster.</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature" key={f.title}>
              <div className="feature__icon">
                <f.icon size={19} strokeWidth={2.1} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>

        <div className="card card--pad" style={{ marginTop: 26, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', background: 'linear-gradient(135deg,#fbfbff,#fff)' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="row gap-8">
              <ShieldCheck size={17} color="var(--brand)" />
              <strong style={{ fontSize: 15, letterSpacing: '-0.02em' }}>Prototype, honestly labelled</strong>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 7, lineHeight: 1.65 }}>
              Sample mailboxes, a simulated OAuth flow and a deterministic classification engine — everything is wired
              for a real Gmail/Outlook + LLM integration. Sample credentials: <code className="mono">ava@northstarassist.com</code> / <code className="mono">demo1234</code>.
            </p>
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <span className="badge badge--brand">
              <Avatar name="Ava Bennett" size="sm" /> Assistant demo
            </span>
            <span className="badge badge--client">
              <Avatar name="Marcus Reed" size="sm" /> Client demo
            </span>
          </div>
        </div>
      </section>

      <footer className="welcome__foot">
        MailPilot AI · Built as an internship assignment prototype · <Link to="/login" style={{ color: 'var(--brand-text)', fontWeight: 600 }}>Sign in</Link> ·{' '}
        <Layers size={12} style={{ verticalAlign: -2 }} /> Works on desktop & mobile
      </footer>
    </div>
  );
}
