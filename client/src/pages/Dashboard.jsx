import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, MailOpen, Star, Zap, Clock, Bot, UserRound, ShieldQuestion, CheckCircle2,
  Calendar, Sparkles, ArrowRight, RefreshCw, AlertTriangle, Send, Pencil, Wifi, Layers,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { ConversationRow } from '../components/conversation.jsx';
import { bump } from '../components/shell.jsx';
import {
  Stat, Empty, CardSkeleton, Spinner,
} from '../components/common.jsx';
import { relativeTime } from '../lib/format.js';

const ACTIVITY_ICONS = {
  classify: Sparkles,
  incoming: Mail,
  override: Pencil,
  draft: Send,
  sync: RefreshCw,
  client_action: CheckCircle2,
  reply: Send,
  system: AlertTriangle,
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { clientId, user } = useAuth();

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api.get(`/overview${clientId ? `?clientId=${clientId}` : ''}`, 320);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    window.addEventListener('mailpilot:refresh', load);
    return () => window.removeEventListener('mailpilot:refresh', load);
  }, [load]);

  const go = (segment) => navigate(`/app/inbox/${segment}`);

  if (error) {
    return (
      <div className="page">
        <Empty
          icon={AlertTriangle}
          title="Couldn't load the dashboard"
          text={error}
          action={
            <button className="btn btn--secondary" onClick={load}>
              <RefreshCw size={14} /> Retry
            </button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <div className="stats-grid stats-grid--dash">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="skeleton" key={i} style={{ height: 112, borderRadius: 14 }} />
          ))}
        </div>
        <div className="dash-grid">
          <div className="dash-col">
            <CardSkeleton height={320} />
          </div>
          <div className="dash-col">
            <CardSkeleton height={180} />
            <CardSkeleton height={220} />
          </div>
        </div>
      </div>
    );
  }

  const s = data.stats;
  const first = (user?.name || 'there').split(' ')[0];

  const insights = [
    s.client > 0 && {
      icon: UserRound,
      tone: 'client',
      title: `${s.client} conversation${s.client > 1 ? 's' : ''} waiting on ${data.client?.name?.split(' ')[0] || 'the client'}`,
      text: 'These need a personal decision — they’re front and centre in the client view.',
      to: '/app/inbox/client',
      color: 'var(--c-client-bg)',
      fg: 'var(--c-client)',
    },
    s.waiting > 0 && {
      icon: Clock,
      title: `You’re waiting on ${s.waiting} repl${s.waiting > 1 ? 'ies' : 'y'}`,
      text: 'Threads where we answered and the other side hasn’t come back yet.',
      to: '/app/inbox/waiting',
      color: 'var(--surface-3)',
      fg: 'var(--text-2)',
    },
    s.review > 0 && {
      icon: ShieldQuestion,
      title: `${s.review} conversation${s.review > 1 ? 's' : ''} flagged for review`,
      text: 'The AI wasn’t confident enough to decide — a quick human call needed.',
      to: '/app/inbox/review',
      color: 'var(--c-review-bg)',
      fg: 'var(--c-review)',
    },
    s.action > 0 && {
      icon: Zap,
      title: `${s.action} items need action`,
      text: 'Deadlines, questions and approvals across the inbox.',
      to: '/app/inbox/action',
      color: 'var(--warning-bg)',
      fg: 'var(--warning)',
    },
  ].filter(Boolean);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">
            {s.client > 0 || s.action > 0 ? 'Here’s what needs you' : 'Everything’s handled'}
          </h1>
          <p className="page-head__sub">
            {s.total} conversations across {data.accounts?.length || 0} connected mailbox{data.accounts?.length === 1 ? '' : 'es'} ·
            AI classified {s.assistant + s.client + s.none + s.review} of them
            {first ? ` · focused for ${first}` : ''}
          </p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => bump()}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => go('action')}>
            <Zap size={14} /> Work the queue
          </button>
        </div>
      </div>

      <div className="stats-grid stats-grid--dash">
        <Stat label="Total emails" value={s.total} hint={`${s.unread} unread`} icon={Mail} onClick={() => go('inbox')} />
        <Stat label="Unread" value={s.unread} hint="Needs a first look" icon={MailOpen} onClick={() => go('unread')} />
        <Stat label="Action required" value={s.action} hint="Questions & deadlines" icon={Zap} tone="warning" onClick={() => go('action')} />
        <Stat label="Client to reply" value={s.client} hint="Needs them personally" icon={UserRound} tone="client" onClick={() => go('client')} accent />
        <Stat label="Assistant to reply" value={s.assistant} hint="Yours to write" icon={Bot} tone="assistant" onClick={() => go('assistant')} />
        <Stat label="Waiting on others" value={s.waiting} hint="We replied last" icon={Clock} onClick={() => go('waiting')} />
        <Stat label="Needs review" value={s.review} hint="AI unsure" icon={ShieldQuestion} tone="review" onClick={() => go('review')} />
        <Stat label="Important" value={s.important} hint="Flagged high-signal" icon={Star} tone="brand" onClick={() => go('important')} />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <section className="card">
            <div className="card__head">
              <span className="card__title">
                <Zap size={15} /> Needs your attention
              </span>
              <button className="card__link" onClick={() => go('action')}>
                View all
              </button>
            </div>
            {data.needsAttention.length === 0 ? (
              <Empty
                icon={CheckCircle2}
                title="Nothing urgent"
                text="No client replies, reviews or pending actions right now."
                brand
              />
            ) : (
              data.needsAttention.map((c) => <ConversationRow key={c.id} conv={c} onOpen={(x) => navigate(`/app/inbox/${segmentFor(x)}/${x.id}`)} />)
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <span className="card__title">
                <Mail size={15} /> Recent conversations
              </span>
              <button className="card__link" onClick={() => go('inbox')}>
                Open inbox
              </button>
            </div>
            {data.recent.length === 0 ? (
              <Empty icon={Mail} title="No conversations yet" text="Connect an inbox to see messages here." />
            ) : (
              data.recent.map((c) => <ConversationRow key={c.id} conv={c} onOpen={(x) => navigate(`/app/inbox/${segmentFor(x)}/${x.id}`)} />)
            )}
          </section>
        </div>

        <div className="dash-col">
          <section className="card">
            <div className="card__head">
              <span className="card__title">
                <Sparkles size={15} /> AI insights
              </span>
              <span className="card__sub">{data.ai?.model}</span>
            </div>
            {insights.length === 0 ? (
              <Empty icon={CheckCircle2} title="Inbox zero-ish" text="No pending insights — the AI has processed everything." />
            ) : (
              insights.map((ins) => (
                <button className="insight" key={ins.title} onClick={() => navigate(ins.to)} style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }}>
                  <span className="insight__icon" style={{ background: ins.color, color: ins.fg }}>
                    <ins.icon size={15} strokeWidth={2.2} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span className="insight__title" style={{ display: 'block' }}>{ins.title}</span>
                    <span className="insight__text" style={{ display: 'block' }}>{ins.text}</span>
                  </span>
                  <ArrowRight size={15} className="muted" />
                </button>
              ))
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <span className="card__title">
                <Calendar size={15} /> Upcoming meetings
              </span>
              <button className="card__link" onClick={() => go('meetings')}>
                All
              </button>
            </div>
            {data.upcoming.length === 0 ? (
              <Empty icon={Calendar} title="No meetings found" text="Invitations and appointments detected in email appear here." />
            ) : (
              data.upcoming.map((m) => {
                const d = new Date(m.start);
                return (
                  <button className="meeting-item" key={m.id} onClick={() => navigate(`/app/inbox/meetings/${m.id}`)} style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }}>
                    <span className="meeting-item__date">
                      <span className="meeting-item__day">{d.getDate()}</span>
                      <span className="meeting-item__mon">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="meeting-item__title" style={{ display: 'block' }}>{m.title}</span>
                      <span className="meeting-item__meta">
                        {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {m.location && <> · {m.location}</>}
                        <span className={`badge ${m.status === 'confirmed' ? 'badge--success' : 'badge--neutral'}`} style={{ height: 19, fontSize: 10.5 }}>
                          {m.status}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <span className="card__title">
                <Wifi size={15} /> Accounts
              </span>
              <button className="card__link" onClick={() => navigate('/app/accounts')}>
                Manage
              </button>
            </div>
            {(data.accounts || []).map((a) => (
              <div className="activity__item" key={a.id} style={{ alignItems: 'center' }}>
                <span className={`provider-icon provider-icon--${a.provider}`} style={{ width: 30, height: 30, borderRadius: 9, fontSize: 12.5 }}>
                  {a.provider === 'gmail' ? 'G' : 'O'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }} className="truncate">{a.address}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                    {a.status === 'connected' && `Synced ${relativeTime(a.lastSyncAt)}`}
                    {a.status === 'syncing' && 'Syncing…'}
                    {a.status === 'error' && <span style={{ color: 'var(--danger)' }}>Needs reconnection</span>}
                  </span>
                </span>
                <span className={`badge ${a.status === 'connected' ? 'badge--success' : a.status === 'error' ? 'badge--danger' : 'badge--brand'}`}>
                  {a.status === 'syncing' ? <Spinner /> : null}
                  {a.status}
                </span>
              </div>
            ))}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn--soft btn--sm btn--block" onClick={() => navigate('/app/accounts')}>
                <Send size={13} /> Sync or connect an inbox
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <span className="card__title">
                <Layers size={15} /> AI activity
              </span>
            </div>
            <div className="activity">
              {data.activity.length === 0 ? (
                <Empty icon={Sparkles} title="No activity yet" text="Classification events show up here in real time." />
              ) : (
                data.activity.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] || Sparkles;
                  return (
                    <div className="activity__item" key={a.id}>
                      <span className={`activity__icon activity__icon--${a.type}`}>
                        <Icon size={14} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span className="activity__text">{a.text}</span>
                        <span className="activity__time" style={{ display: 'block' }}>{relativeTime(a.at)}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/app/ask')}>
          <Sparkles size={14} /> Ask MailPilot anything about this inbox <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function segmentFor(conv) {
  if (conv.classification.responsibility === 'client') return 'client';
  if (conv.classification.responsibility === 'assistant') return 'assistant';
  if (conv.classification.responsibility === 'review') return 'review';
  return 'none';
}
