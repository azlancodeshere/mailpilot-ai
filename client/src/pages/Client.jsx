import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Inbox, Lightbulb, Calendar, UserRound, Sparkles,
  MessageSquare, LogOut, LayoutDashboard, AlertCircle, Hand, Bot,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import { bump } from '../components/shell.jsx';
import { Avatar, Spinner, ListSkeleton, Empty, Stat } from '../components/common.jsx';
import { greeting, relativeTime, fullTime, initials, avatarColor } from '../lib/format.js';

function ClientBar({ client }) {
  const { logout, demoLogin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const toAssistant = async () => {
    try {
      const u = await demoLogin('assistant');
      toast.info(`Signed in as ${u.name} — assistant workspace`);
      navigate('/app', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="cview__bar">
      <div className="brand" style={{ padding: 0 }}>
        <span className="brand__mark" style={{ width: 30, height: 30, borderRadius: 9 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </span>
        <div className="brand__name" style={{ fontSize: 14.5 }}>
          MailPilot <span>AI</span>
        </div>
      </div>

      {client && (
        <div className="cview__who">
          <Avatar name={client.name} size="sm" />
          {client.name}
        </div>
      )}

      <div className="row gap-6">
        <button className="btn btn--ghost btn--sm" onClick={toAssistant} title="Demo: open the assistant workspace">
          <LayoutDashboard size={14} /> Assistant view
        </button>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          title="Log out"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

export function ClientHome() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api.get('/client/items', 320);
      setData(d);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action, msg) => {
    try {
      await api.post(`/client/items/${id}/${action}`);
      toast.success(msg);
      bump();
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const client = data?.client;
  const first = client?.name?.split(' ')[0] || 'there';

  return (
    <div className="cview">
      <ClientBar client={client} />

      <div className="cview__body">
        {error ? (
          <div className="card card--pad" style={{ marginTop: 30 }}>
            <Empty
              icon={AlertCircle}
              title="Couldn’t load your inbox"
              text={error}
              action={
                <button className="btn btn--secondary" onClick={load}>
                  Retry
                </button>
              }
            />
          </div>
        ) : !data ? (
          <>
            <div className="cview__hero">
              <div className="skeleton" style={{ height: 40, width: '60%', borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 20, width: '80%', marginTop: 12, borderRadius: 8 }} />
            </div>
            <ListSkeleton rows={3} />
          </>
        ) : (
          <>
            <div className="cview__hero">
              <h1 className="cview__greet">
                {greeting()}, <em>{first}</em>
              </h1>
              <p className="cview__lede">
                {data.counts.needsYou > 0 ? (
                  <>
                    <b>{data.counts.needsYou} conversation{data.counts.needsYou > 1 ? 's' : ''}</b> need
                    your personal reply. Everything else — scheduling, follow-ups, admin — is handled by{' '}
                    <b>{data.assistant.name}</b>.
                  </>
                ) : (
                  <>
                    Nothing needs your reply right now. <b>{data.assistant.name}</b> is handling the rest of
                    the inbox for you.
                  </>
                )}
              </p>

              <div className="stats-grid" style={{ marginTop: 22 }}>
                <Stat label="Waiting on you" value={data.counts.needsYou} hint="Needs your reply" icon={UserRound} tone="client" accent />
                <Stat label="Handled" value={data.counts.handled} hint="Closed by you or Ava" icon={CheckCircle2} tone="none" />
                <Stat label="Total threads" value={data.counts.total} hint="In your inbox" icon={Inbox} />
              </div>

              <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 16 }}>
                <span className="badge badge--neutral">
                  <MessageSquare size={11.5} /> {data.connectedAccounts} mailbox{data.connectedAccounts === 1 ? '' : 'es'} connected
                </span>
                <span className="badge badge--brand">
                  <Sparkles size={11.5} /> AI triage by {data.assistant.name}
                </span>
              </div>
            </div>

            {data.items.length === 0 ? (
              <div className="cempty">
                <span className="cempty__icon">
                  <CheckCircle2 size={30} strokeWidth={2.2} />
                </span>
                <h3>You’re all caught up</h3>
                <p>
                  No emails are waiting on your reply. When the AI spots something that needs a decision
                  from you, it will show up here — nothing else will.
                </p>
              </div>
            ) : (
              <>
                <div className="cview__section-label">
                  <Lightbulb size={13} /> Waiting on you · {data.items.length}
                </div>

                {data.items.map((it) => (
                  <article className="citem" key={it.id}>
                    <div className="citem__top">
                      <Avatar name={it.sender?.name} size="md" />
                      <div className="citem__meta">
                        <div className="citem__sender">{it.sender?.name || 'Sender'}</div>
                        <div className="citem__time">
                          {relativeTime(it.receivedAt)} · {it.messageCount} message{it.messageCount > 1 ? 's' : ''}
                          {it.important ? ' · flagged important' : ''}
                        </div>
                      </div>
                      {it.meeting && (
                        <span className="badge badge--neutral">
                          <Calendar size={11} /> {it.meeting.title}
                        </span>
                      )}
                    </div>

                    <h2 className="citem__subject">{it.subject}</h2>
                    <p className="citem__summary">{it.summary}</p>

                    {it.hasDeadline && (
                      <span className="citem__deadline">
                        <Calendar size={12} /> Reply recommended before the deadline
                      </span>
                    )}

                    <div className="citem__why">
                      <Lightbulb size={15} />
                      <span>
                        <b>Why you’re seeing this:</b> {it.why}
                      </span>
                    </div>

                    <div className="citem__actions">
                      <button className="btn btn--primary btn--sm" onClick={() => navigate(`/client/${it.id}`)}>
                        <MessageSquare size={14} /> Open thread
                      </button>
                      <button className="btn btn--success btn--sm" onClick={() => act(it.id, 'handle', 'Marked as handled — removed from your list')}>
                        <CheckCircle2 size={14} /> I’ve handled this
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => act(it.id, 'takeover', `${data.assistant.name} will take it from here`)}>
                        <Bot size={14} /> Ask {data.assistant.name.split(' ')[0]} to handle it
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="cview__foot">
        MailPilot AI prototype · Client view shows only threads that need <b>your</b> reply.
        <br />
        Your assistant: {data?.assistant?.name || 'Ava Bennett'} ·{' '}
        <Link to="/login">Switch account</Link>
      </div>
    </div>
  );
}

export function ClientThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [conv, setConv] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api.get(`/client/items/${id}`, 300);
      setConv(d.conversation);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action, msg) => {
    setBusy(action);
    try {
      await api.post(`/client/items/${id}/${action}`);
      toast.success(msg);
      bump();
      navigate('/client', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  if (error) {
    return (
      <div className="cview">
        <ClientBar />
        <div className="cview__body">
          <div className="card card--pad" style={{ marginTop: 30 }}>
            <Empty
              icon={AlertCircle}
              title="Couldn’t open this thread"
              text={error}
              action={
                <button className="btn btn--secondary" onClick={() => navigate('/client')}>
                  Back to your list
                </button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="cthread">
        <div className="cthread__bar">
          <button className="btn btn--ghost btn--icon btn--sm" onClick={() => navigate('/client')}>
            <ArrowLeft size={16} />
          </button>
          <div className="cthread__bar-title">Loading thread…</div>
        </div>
        <div className="cthread__body">
          <div className="skeleton" style={{ height: 34, width: '70%', borderRadius: 10, marginBottom: 18 }} />
          <ListSkeleton rows={3} />
        </div>
      </div>
    );
  }

  const last = conv.messages[conv.messages.length - 1];

  return (
    <div className="cthread">
      <div className="cthread__bar">
        <button className="btn btn--ghost btn--icon btn--sm" onClick={() => navigate('/client')} aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <div className="cthread__bar-title truncate">{conv.subject}</div>
        <span className="badge badge--client">
          <UserRound size={11} /> Your reply
        </span>
      </div>

      <div className="cthread__body">
        <div className="detail__subject" style={{ marginBottom: 8 }}>{conv.subject}</div>
        <div className="detail__meta" style={{ marginBottom: 18 }}>
          <span>
            {conv.messages.length} message{conv.messages.length > 1 ? 's' : ''} · last activity {relativeTime(conv.lastActivityAt)}
          </span>
        </div>

        <div className="citem__why" style={{ marginTop: 0, marginBottom: 18 }}>
          <Lightbulb size={15} />
          <span>
            <b>Why this is with you:</b> {conv.classification.reason}
            {' · '}<b>{conv.classification.confidence}%</b> AI confidence
          </span>
        </div>

        {conv.summary && (
          <div className="summary-card" style={{ marginBottom: 18 }}>
            <div className="summary-card__head">
              <Sparkles size={13} /> Plain-English summary
            </div>
            <p className="summary-card__text">{conv.summary.text}</p>
            {conv.summary.bullets?.length > 0 && (
              <ul className="summary-card__bullets">
                {conv.summary.bullets.map((b, i) => (
                  <li className="summary-card__bullet" key={`${b.label}-${i}`}>
                    <span className="summary-card__blabel">{b.label}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="cview__section-label">
          <MessageSquare size={13} /> The conversation
        </div>
        <div className="thread">
          {conv.messages.map((m) => (
            <article className={`message ${m.direction === 'outbound' ? 'message--outbound' : ''}`} key={m.id}>
              <div className="message__head" style={{ cursor: 'default' }}>
                <span className="avatar avatar--sm" style={{ background: avatarColor(m.from?.name || '') }}>
                  {initials(m.from?.name || '')}
                </span>
                <div className="message__meta">
                  <div className="message__from">{m.from?.name}</div>
                  <div className="message__to truncate">
                    to {(m.to || []).map((t) => t.name || t.email).join(', ') || 'recipient'}
                  </div>
                </div>
                <span className="message__time">{fullTime(m.at)}</span>
              </div>
              <div className="message__body">{m.body}</div>
            </article>
          ))}
        </div>

        {last && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 16, textAlign: 'center' }}>
            This is a read-only view — reply yourself in your mail client, or hand it to Ava below.
          </p>
        )}
      </div>

      <div className="cthread__actions">
        <button className="btn btn--secondary" onClick={() => navigate('/client')} disabled={!!busy}>
          <ArrowLeft size={15} /> Back
        </button>
        <button className="btn btn--success" onClick={() => act('handle', 'Marked as handled — it left your list')} disabled={!!busy}>
          {busy === 'handle' ? <Spinner /> : <Hand size={15} />} I’ve handled this
        </button>
        <button className="btn btn--primary" onClick={() => act('takeover', 'Ava will take it from here')} disabled={!!busy}>
          {busy === 'takeover' ? <Spinner /> : <Bot size={15} />} Ask Ava to handle it
        </button>
      </div>
    </div>
  );
}
