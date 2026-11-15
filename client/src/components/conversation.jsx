import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star, Mail, MailOpen, Archive, CheckCircle2, ChevronLeft, Sparkles, Wand2,
  RefreshCw, Send, ShieldQuestion, Calendar, Paperclip, Zap, Clock, UserCheck,
  ArrowRight, Pencil, CircleCheck,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { useToast } from '../context/toast.jsx';
import {
  Avatar, RespBadge, Confidence, Empty, ListSkeleton, CardSkeleton, Menu, MenuItem,
  SEGMENT_LABELS, Spinner, RESP,
} from './common.jsx';
import { shortTime, fullTime, relativeTime } from '../lib/format.js';
import { bump } from './shell.jsx';

export function ConversationRow({ conv, active, onOpen }) {
  const flags = conv.flags || {};
  return (
    <button className={`conv-row ${active ? 'conv-row--active' : ''} ${conv.unread ? 'conv-row--unread' : ''}`} onClick={() => onOpen(conv)}>
      <Avatar name={conv.sender?.name} />
      <div className="conv-row__body">
        <div className="conv-row__top">
          <span className="conv-row__sender">{conv.sender?.name || 'Unknown sender'}</span>
          <span className="conv-row__time">{shortTime(conv.lastActivityAt)}</span>
        </div>
        <div className="conv-row__subject">
          {conv.unread && <span className="conv-row__unread-dot" />}
          <span className="truncate">{conv.subject}</span>
        </div>
        <div className="conv-row__preview clamp-2">{conv.preview}</div>
        <div className="conv-row__meta">
          <RespBadge value={conv.classification.responsibility} size="sm" title={`${conv.classification.confidence}% confident — ${conv.classification.reason}`} />
          {conv.draftCount > 0 && (
            <span className="conv-row__flag" style={{ color: 'var(--brand-text)' }}>
              <Wand2 size={11.5} /> Draft
            </span>
          )}
          {flags.awaitingResponse && (
            <span className="conv-row__flag">
              <Clock size={11.5} /> Waiting
            </span>
          )}
          {conv.meeting && (
            <span className="conv-row__flag">
              <Calendar size={11.5} />
              {new Date(conv.meeting.start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
            </span>
          )}
          {flags.important && (
            <span className="conv-row__flag" style={{ color: 'var(--warning)' }}>
              <Star size={11.5} fill="currentColor" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function AiCard({ conv, onChange, onOpenAsk }) {
  const toast = useToast();
  const [analysing, setAnalysing] = useState(false);
  const [local, setLocal] = useState(conv.classification);
  const c = local;

  useEffect(() => setLocal(conv.classification), [conv.classification]);

  const reanalyse = async () => {
    setAnalysing(true);
    try {
      const d = await api.post(`/conversations/${conv.id}/reclassify`, {}, 0);
      setLocal(d.conversation.classification);
      if (d.changed) toast.success(`AI changed its mind → ${RESP[d.conversation.classification.responsibility].label}`);
      else toast.info('Re-analysed — classification unchanged');
      bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAnalysing(false);
    }
  };

  const setResponsibility = async (value) => {
    const prev = c.responsibility;
    if (value === prev) return;
    setLocal({ ...c, responsibility: value, source: 'manual', confidence: 100 });
    try {
      await api.patch(`/conversations/${conv.id}`, { classification: { responsibility: value } });
      toast.success(`Changed to ${RESP[value].label} — the AI will learn from this`);
      bump();
    } catch (err) {
      setLocal(c);
      toast.error(err.message);
    }
  };

  const steps = ['Reading the latest message', 'Checking conversation history', 'Matching responsibility signals', 'Scoring confidence'];

  return (
    <div className={`ai-card ${analysing ? 'ai-card--reanalysing' : ''}`}>
      <div className="ai-card__main">
        <div className="ai-card__label">
          <Sparkles size={12} strokeWidth={2.4} /> AI reply responsibility
          {c.source === 'manual' && <span className="badge badge--neutral" style={{ marginLeft: 4 }}>Manual</span>}
        </div>

        {analysing ? (
          <div className="ai-steps">
            {steps.map((s) => (
              <div className="ai-step" key={s}>
                <span className="ai-step__dot" /> {s}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="ai-card__row">
              <RespBadge value={c.responsibility} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <Confidence value={c.confidence} />
              </div>
            </div>
            <p className="ai-card__reason">{c.reason}</p>
            {c.signals?.length > 0 && (
              <div className="ai-card__signals">
                {c.signals.map((s) => (
                  <span className="signal" key={s}>{s}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="ai-card__foot">
        <span className="ai-card__stamp">
          <ShieldQuestion size={12.5} />
          {c.model || 'mailpilot-engine'} · {c.source === 'manual' ? 'set by a human' : 'analysed automatically'}
        </span>
        <div className="row gap-6">
          <button className="btn btn--ghost btn--sm" onClick={reanalyse} disabled={analysing}>
            <RefreshCw size={13} /> Re-analyse
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onOpenAsk}>
            <Sparkles size={13} /> Ask why
          </button>
          <Menu
            label="Change responsibility"
            trigger={
              <button className="btn btn--secondary btn--sm">
                <Pencil size={13} /> Change
              </button>
            }
          >
            {Object.entries(RESP).map(([key, meta]) => (
              <MenuItem key={key} icon={meta.icon} active={c.responsibility === key} onClick={() => setResponsibility(key)}>
                {meta.label}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ conv }) {
  const toast = useToast();
  const [summary, setSummary] = useState(conv.summary);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/conversations/${conv.id}/summarize`, {});
      setSummary(d.summary);
      toast.success('Summary refreshed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!summary) return null;
  return (
    <div className="summary-card">
      <div className="summary-card__head">
        <span className="ai-card__label" style={{ margin: 0 }}>
          <Sparkles size={12} strokeWidth={2.4} /> AI summary
        </span>
        <button className="btn btn--ghost btn--sm" onClick={refresh} disabled={busy}>
          {busy ? <Spinner /> : <RefreshCw size={13} />} Refresh
        </button>
      </div>
      <p className="summary-card__text">{summary.text}</p>
      {summary.bullets?.length > 0 && (
        <ul className="summary-card__bullets">
          {summary.bullets.map((b, i) => (
            <li className="summary-card__bullet" key={`${b.label}-${i}`}>
              <span className="summary-card__blabel">{b.label}</span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ conv, onSent }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [tone, setTone] = useState('professional');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [variant, setVariant] = useState(0);
  const [draft, setDraft] = useState(() => conv.drafts?.find((d) => d.status === 'draft') || null);
  const taRef = useRef(null);

  useEffect(() => {
    setDraft(conv.drafts?.find((d) => d.status === 'draft') || null);
    setText('');
  }, [conv.id, conv.drafts]);

  const recipient = conv.participants?.[0];

  const makeDraft = async () => {
    setDrafting(true);
    try {
      const d = await api.post(`/conversations/${conv.id}/draft`, { tone, variant }, 0);
      setDraft(d.draft);
      setText(d.draft.text);
      setVariant((v) => v + 1);
      toast.success('Draft ready — review before sending');
      bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDrafting(false);
    }
  };

  const send = async (body) => {
    const value = (body ?? text).trim();
    if (!value) return;
    setSending(true);
    try {
      if (body && draft) {
        const d = await api.post(`/conversations/drafts/${draft.id}/send`, {});
        onSent(d.conversation);
        toast.success('Reply sent — AI re-analysed the thread');
      } else {
        const d = await api.post(`/conversations/${conv.id}/reply`, { text: value });
        onSent(d.conversation);
        toast.success(d.reclassified ? 'Reply sent — AI updated the classification' : 'Reply sent');
      }
      setText('');
      setDraft(null);
      bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="composer">
      {draft && (
        <div className="draft-banner">
          <Wand2 size={14} />
          AI draft ready — review it, then approve to send
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
            <button className="btn btn--soft btn--sm" onClick={() => makeDraft()} disabled={drafting}>
              {drafting ? <Spinner /> : <RefreshCw size={13} />} Regenerate
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => send(draft.text)} disabled={sending}>
              {sending ? <Spinner /> : <Send size={13} />} Approve & send
            </button>
          </div>
        </div>
      )}
      <div className="composer__head">
        <span className="composer__to truncate">
          <ArrowRight size={13} /> To: <strong>{recipient?.name || 'Sender'}</strong>
          <span className="muted truncate">({recipient?.email})</span>
        </span>
        <div className="row gap-6">
          <select className="select" style={{ height: 30, fontSize: 12.5, width: 132, paddingLeft: 9 }} value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone">
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="concise">Concise</option>
          </select>
        </div>
      </div>
      <textarea
        ref={taRef}
        className="composer__textarea"
        placeholder={`Reply to ${recipient?.name || 'the sender'}… or let AI draft it for you`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="composer__foot">
        <span className="composer__hint">
          <Sparkles size={12.5} /> AI drafts are never sent without your approval
        </span>
        <div className="row gap-8">
          <button className="btn btn--secondary btn--sm" onClick={makeDraft} disabled={drafting || sending}>
            {drafting ? <Spinner /> : <Wand2 size={14} />} {text ? 'Rewrite with AI' : 'Draft with AI'}
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => send()} disabled={!text.trim() || sending}>
            {sending ? <Spinner /> : <Send size={14} />} Send reply
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConversationDetail({ id, onBack, onOpenAsk }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { isAssistant } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await api.get(`/conversations/${id}`, 260);
      setConv(d.conversation);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    setConv(null);
    load();
  }, [load]);

  const patch = async (payload, successMsg) => {
    setBusy(true);
    try {
      const d = await api.patch(`/conversations/${id}`, payload);
      setConv(d.conversation);
      if (successMsg) toast.success(successMsg);
      bump();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="detail">
        <div className="detail__scroll">
          <div className="detail__inner">
            <Empty
              icon={ShieldQuestion}
              title="Couldn't load this conversation"
              text={error}
              action={
                <button className="btn btn--secondary" onClick={load}>
                  <RefreshCw size={14} /> Try again
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
      <div className="detail">
        <div className="detail__scroll">
          <div className="detail__inner">
            <CardSkeleton height={110} />
            <CardSkeleton height={90} />
            <CardSkeleton height={200} />
            <CardSkeleton height={150} />
          </div>
        </div>
      </div>
    );
  }

  const flags = conv.flags;

  return (
    <div className="detail">
      <div className="detail__head">
        <div className="detail__head-top">
          <div style={{ minWidth: 0 }}>
            <button className="btn btn--ghost btn--sm detail__back" onClick={onBack} style={{ marginBottom: 6 }}>
              <ChevronLeft size={15} /> Back
            </button>
            <div className="detail__subject">{conv.subject}</div>
            <div className="detail__meta">
              <RespBadge value={conv.classification.responsibility} size="sm" />
              <span>{conv.messageCount} message{conv.messageCount > 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{fullTime(conv.lastActivityAt)}</span>
              {conv.meeting && (
                <span className="badge badge--brand">
                  <Calendar size={11} /> {conv.meeting.status}
                </span>
              )}
              {flags.completed && (
                <span className="badge badge--success">
                  <CircleCheck size={11} /> Completed
                </span>
              )}
            </div>
          </div>
          <div className="detail__actions">
            <button
              className="btn btn--ghost btn--icon"
              title={flags.important ? 'Remove important' : 'Mark important'}
              onClick={() => patch({ flags: { important: !flags.important } }, flags.important ? 'Removed from important' : 'Marked important')}
            >
              <Star size={16} fill={flags.important ? 'currentColor' : 'none'} color={flags.important ? 'var(--warning)' : 'currentColor'} />
            </button>
            <button
              className="btn btn--ghost btn--icon"
              title={flags.unread ? 'Mark as read' : 'Mark as unread'}
              onClick={() => patch({ flags: { unread: !flags.unread } })}
            >
              {flags.unread ? <MailOpen size={16} /> : <Mail size={16} />}
            </button>
            <button
              className="btn btn--ghost btn--icon"
              title="Archive"
              onClick={() => {
                patch({ flags: { archived: true } }, 'Conversation archived');
                setTimeout(onBack, 350);
              }}
            >
              <Archive size={16} />
            </button>
            <Menu
              trigger={
                <button className="btn btn--secondary btn--sm" disabled={busy}>
                  <CheckCircle2 size={14} /> {flags.completed ? 'Reopen' : 'Complete'}
                </button>
              }
            >
              <MenuItem icon={CheckCircle2} onClick={() => patch({ action: 'complete' }, 'Marked as completed')}>
                Mark as completed
              </MenuItem>
              <MenuItem icon={Mail} onClick={() => patch({ flags: { unread: !flags.unread } })}>
                Toggle unread
              </MenuItem>
              <MenuItem icon={Archive} onClick={() => { patch({ flags: { archived: true } }, 'Archived'); setTimeout(onBack, 350); }}>
                Archive conversation
              </MenuItem>
            </Menu>
          </div>
        </div>
      </div>

      <div className="detail__scroll">
        <div className="detail__inner">
          <AiCard conv={conv} onOpenAsk={() => onOpenAsk?.(conv)} />
          <SummaryCard conv={conv} />

          {(flags.requiresAction || flags.awaitingResponse) && (
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {flags.requiresAction && (
                <span className="badge badge--warning">
                  <Zap size={11.5} /> Action required
                </span>
              )}
              {flags.awaitingResponse && (
                <span className="badge badge--neutral">
                  <Clock size={11.5} /> Waiting for their response
                </span>
              )}
              <span className="badge badge--neutral">
                <UserCheck size={11.5} /> {RESP[conv.classification.responsibility].short} owns the reply
              </span>
            </div>
          )}

          <div className="thread">
            {conv.messages.map((m) => (
              <article className={`message ${m.direction === 'outbound' ? 'message--outbound' : ''}`} key={m.id}>
                <div className="message__head">
                  <Avatar name={m.from?.name} size="sm" />
                  <div className="message__meta">
                    <div className="message__from">
                      {m.from?.name}
                      {m.direction === 'outbound' && <span className="message__tag">Sent by you</span>}
                    </div>
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

          {isAssistant ? (
            <Composer
              conv={conv}
              onSent={(updated) => {
                setConv(updated);
                navigate(`/app/inbox/inbox/${updated.id}`, { replace: true });
              }}
            />
          ) : (
            <div className="summary-card" style={{ textAlign: 'center' }}>
              <p className="summary-card__text">
                You're viewing this thread from the client view. Open the assistant workspace to reply.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ListSkeleton };
