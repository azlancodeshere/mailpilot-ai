import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search, X, Inbox as InboxIcon, Sparkles, ArrowUpDown, CheckCircle2, Bot, UserRound,
  ShieldQuestion,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { ConversationRow, ConversationDetail } from '../components/conversation.jsx';
import { bump } from '../components/shell.jsx';
import {
  Empty, ListSkeleton, SEGMENT_ICONS, SEGMENT_LABELS,
} from '../components/common.jsx';

const CHIP_SEGMENTS = ['inbox', 'client', 'assistant', 'review', 'action', 'waiting', 'meetings', 'important', 'none'];

const SEGMENT_COPY = {
  inbox: { title: 'Your inbox, organised by AI', text: 'Every conversation, segmented by who actually needs to reply.' },
  client: { title: 'Waiting on the client', text: 'These need a personal decision — they also appear in the client’s minimal view.' },
  assistant: { title: 'Yours to answer', text: 'Scheduling, admin and follow-ups the AI believes you can close out.' },
  review: { title: 'The AI wasn’t sure', text: 'Conflicting or weak signals — a quick human decision keeps the queue honest.' },
  none: { title: 'No reply needed', text: 'Newsletters, notifications and threads already closed.' },
  action: { title: 'Action required', text: 'Conversations with deadlines, open questions or approvals.' },
  waiting: { title: 'Waiting for a response', text: 'We replied last — these are the follow-ups worth chasing.' },
  meetings: { title: 'Meetings & appointments', text: 'Invitations and scheduling detected in your email.' },
  important: { title: 'Important', text: 'Flagged as high-signal — by you or by the AI.' },
  unread: { title: 'Unread', text: 'Not opened yet.' },
  completed: { title: 'Completed', text: 'Handled and closed.' },
  archived: { title: 'Archived', text: 'Out of the way, still searchable.' },
  general: { title: 'General', text: 'Everything that doesn’t fit the other segments.' },
};

export default function Inbox() {
  const { segment = 'inbox', id } = useParams();
  const navigate = useNavigate();
  const { clientId } = useAuth();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 240);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ segment, sort });
      if (debouncedQ) params.set('q', debouncedQ);
      if (clientId) params.set('clientId', clientId);
      const d = await api.get(`/conversations?${params.toString()}`, 260);
      setItems(d.items);
      setCounts(d.counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [segment, debouncedQ, sort, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('mailpilot:refresh', handler);
    return () => window.removeEventListener('mailpilot:refresh', handler);
  }, [load]);

  const open = (conv) => navigate(`/app/inbox/${segment}/${conv.id}`);
  const back = () => navigate(`/app/inbox/${segment}`);

  const Icon = SEGMENT_ICONS[segment] || InboxIcon;
  const copy = SEGMENT_COPY[segment] || { title: SEGMENT_LABELS[segment] || 'Inbox', text: '' };
  const chips = useMemo(() => CHIP_SEGMENTS.filter((s) => s !== segment), [segment]);

  return (
    <div className={`page page--flush ${id ? 'inbox--detail' : ''}`} style={{ height: 'calc(100vh - var(--topbar-h))' }}>
      <div className="inbox">
        <div className="inbox__list">
          <div className="inbox__toolbar">
            <div className="inbox__toolbar-top">
              <span className="inbox__title">
                <Icon size={16} strokeWidth={2.2} />
                {SEGMENT_LABELS[segment] || 'Inbox'}
                <span className="inbox__count tnum">{loading ? '…' : items.length}</span>
              </span>
              <button
                className="btn btn--ghost btn--icon btn--sm"
                title={sort === 'recent' ? 'Oldest first' : sort === 'oldest' ? 'Sort A–Z' : 'Newest first'}
                onClick={() => setSort((s) => (s === 'recent' ? 'oldest' : s === 'oldest' ? 'subject' : 'recent'))}
              >
                <ArrowUpDown size={15} />
              </button>
            </div>
            <div className={`input-wrap input-wrap--clear`}>
              <Search size={15} />
              <input
                className="input"
                placeholder="Filter this segment…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ height: 34, fontSize: 13 }}
              />
              {q && (
                <button className="input-clear" onClick={() => setQ('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="inbox__chips">
              {chips.map((s) => {
                const CIcon = SEGMENT_ICONS[s];
                const n = counts[s] || 0;
                return (
                  <button key={s} className="chip" onClick={() => navigate(`/app/inbox/${s}${id ? `/${id}` : ''}`)}>
                    <CIcon size={13} strokeWidth={2.2} />
                    {SEGMENT_LABELS[s]}
                    {n > 0 && <span className="chip__count">{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="inbox__scroll">
            {loading ? (
              <ListSkeleton rows={7} />
            ) : error ? (
              <Empty
                icon={ShieldQuestion}
                title="Couldn’t load conversations"
                text={error}
                action={
                  <button className="btn btn--secondary" onClick={load}>
                    Retry
                  </button>
                }
              />
            ) : items.length === 0 ? (
              <Empty
                icon={q ? Search : segment === 'review' ? CheckCircle2 : Icon}
                title={q ? `No matches for “${q}”` : copy.title}
                text={q ? 'Try a different word, or clear the filter.' : copy.text}
                action={
                  q ? (
                    <button className="btn btn--secondary" onClick={() => setQ('')}>
                      Clear filter
                    </button>
                  ) : segment !== 'inbox' ? (
                    <button className="btn btn--secondary" onClick={() => navigate('/app/inbox/inbox')}>
                      <InboxIcon size={14} /> Back to all conversations
                    </button>
                  ) : (
                    <button className="btn btn--primary" onClick={() => bump()}>
                      <Sparkles size={14} /> Simulate incoming email
                    </button>
                  )
                }
              />
            ) : (
              items.map((c) => <ConversationRow key={c.id} conv={c} active={c.id === id} onOpen={open} />)
            )}
            {!loading && items.length > 0 && debouncedQ && (
              <div style={{ padding: 14, textAlign: 'center' }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setQ('')}>
                  <X size={13} /> Clear filter ({items.length} result{items.length > 1 ? 's' : ''})
                </button>
              </div>
            )}
          </div>
        </div>

        {id ? (
          <ConversationDetail id={id} onBack={back} onOpenAsk={(conv) => navigate('/app/ask', { state: { conversationId: conv.id, subject: conv.subject } })} />
        ) : (
          <div className="detail">
            <div className="detail__scroll">
              <div className="detail__inner">
                <Empty
                  brand
                  icon={Sparkles}
                  title="Pick a conversation"
                  text="Open any thread to see the AI’s reply-responsibility call, a summary of the exchange, and a composer with one-click drafts."
                />
                <div className="row gap-8" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span className="badge badge--assistant"><Bot size={11.5} /> Assistant replies</span>
                  <span className="badge badge--client"><UserRound size={11.5} /> Client replies</span>
                  <span className="badge badge--none"><CheckCircle2 size={11.5} /> No reply needed</span>
                  <span className="badge badge--review"><ShieldQuestion size={11.5} /> Needs review</span>
                </div>
                <div className="card card--pad" style={{ textAlign: 'left' }}>
                  <div className="ai-card__label" style={{ marginBottom: 10 }}>
                    <Sparkles size={12} /> What lives in a conversation
                  </div>
                  <div className="summary-card__bullets" style={{ margin: 0 }}>
                    {[
                      ['AI decision', 'Who must reply, with confidence and plain-English reasoning'],
                      ['Summary', 'The ask, the deadline and the people — without reading the thread'],
                      ['History', 'Every classification change, including manual overrides'],
                      ['Composer', 'Draft with AI, review, then approve — nothing sends on its own'],
                    ].map(([label, text]) => (
                      <li className="summary-card__bullet" key={label}>
                        <span className="summary-card__blabel">{label}</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
