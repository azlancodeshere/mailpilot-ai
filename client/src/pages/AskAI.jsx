import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, Send, RotateCcw, FileText, ChevronRight, ShieldQuestion, X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/auth.jsx';
import { RespBadge, Spinner } from '../components/common.jsx';

const STARTERS = [
  'Show me emails that need my attention',
  'Which emails require the client’s attention?',
  'What am I waiting for a response on?',
  'Why has this email been assigned to the client?',
  'Show me upcoming meetings and deadlines',
  'Draft a reply to this conversation',
];

export default function AskAI() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clientId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  const scrollRef = useRef(null);
  const autoAsked = useRef(false);

  const context = location.state || null;

  useEffect(() => {
    api.get('/ai/meta').then(setMeta).catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const ask = async (text, convId) => {
    const q = String(text || '').trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);

    const userMsg = { role: 'user', text: q };
    const pending = { role: 'ai', thinking: true };
    setMessages((m) => [...m, userMsg, pending]);

    try {
      const body = { q };
      const conversationId = convId || context?.conversationId;
      if (conversationId) body.conversationId = conversationId;
      if (clientId) body.clientId = clientId;
      const res = await api.post('/ai/ask', body, 400);
      setMessages((m) => [...m.slice(0, -1), { role: 'ai', ...res }]);
    } catch (err) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'ai', error: err.message, text: q, suggestions: ['Try again'] },
      ]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (context?.conversationId && !autoAsked.current && messages.length === 0) {
      autoAsked.current = true;
      ask('Summarize this conversation', context.conversationId);
    }

  }, [context?.conversationId]);

  const last = messages[messages.length - 1];
  const showHero = messages.length === 0;

  const chips = useMemo(() => {
    if (!showHero) return [];
    if (context?.subject) return ['Summarize this conversation', 'Why has this email been assigned to the client?', 'Draft a reply to this conversation'];
    return STARTERS.slice(0, 4);
  }, [showHero, context]);

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="page page--flush">
      <div className="ask">
        <div className="ask__scroll" ref={scrollRef}>
          {showHero ? (
            <div className="ask__hero">
              <span className="ask__hero-icon">
                <Sparkles size={24} strokeWidth={2.1} />
              </span>
              <h2>Ask MailPilot anything</h2>
              <p>
                Questions are answered from the connected inbox — who owes a reply, what’s stuck, what
                the thread actually says. Structured results, not vibes.
              </p>

              {context?.subject && (
                <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 16 }}>
                  <span className="badge badge--brand">
                    <FileText size={11.5} /> About: {context.subject}
                  </span>
                </div>
              )}

              <div className="ask__suggestions">
                {chips.map((s) => (
                  <button key={s} className="chip" onClick={() => ask(s)}>
                    <Sparkles size={12.5} strokeWidth={2.2} /> {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {context?.subject && (
                <div className="row gap-8" style={{ justifyContent: 'center' }}>
                  <span className="badge badge--brand">
                    <FileText size={11.5} /> About: {context.subject}
                  </span>
                </div>
              )}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div className="ask__bubble ask__bubble--user" key={i}>
                    <div className="ask__text">{m.text}</div>
                    <span className="ask__avatar" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
                      <Send size={14} />
                    </span>
                  </div>
                ) : (
                  <div className="ask__bubble" key={i}>
                    <span className="ask__avatar">
                      <Sparkles size={15} />
                    </span>
                    <div className="ask__text">
                      {m.thinking ? (
                        <span className="ask__typing" aria-label="Thinking">
                          <span /><span /><span />
                        </span>
                      ) : m.error ? (
                        <>
                          <strong>Something went wrong: </strong>{m.error}
                          <div className="ask__followups">
                            <button className="chip" onClick={() => { setMessages((x) => x.slice(0, -1)); ask(m.text); }}>
                              <RotateCcw size={12.5} /> Try again
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <AIReply text={m.reply} />

                          {m.items?.length > 0 && (
                            <div className="ask__results">
                              {m.items.map((it) => (
                                <button
                                  key={it.id}
                                  className="ask__result"
                                  onClick={() => navigate(`/app/inbox/inbox/${it.id}`)}
                                >
                                  <div className="ask__result-main">
                                    <div className="ask__result-subject">{it.subject}</div>
                                    <div className="ask__result-reason">{it.reason}</div>
                                  </div>
                                  {it.responsibility && <RespBadge value={it.responsibility} size="sm" showLabel={false} />}
                                  <ChevronRight size={15} color="var(--text-3)" />
                                </button>
                              ))}
                            </div>
                          )}

                          {m.draft && (
                            <div className="card card--pad" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
                              <div className="ai-card__label" style={{ marginBottom: 8 }}>
                                <FileText size={12} /> Draft ready — needs your approval
                              </div>
                              <p style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text-2)' }}>
                                {m.draft.text}
                              </p>
                              <button
                                className="btn btn--primary btn--sm"
                                style={{ marginTop: 12 }}
                                onClick={() => navigate(`/app/inbox/inbox/${m.draft.conversationId}`)}
                              >
                                Review &amp; approve in composer <ChevronRight size={14} />
                              </button>
                            </div>
                          )}

                          {m.suggestions?.length > 0 && (
                            <div className="ask__followups">
                              {m.suggestions.map((s) => (
                                <button
                                  key={s}
                                  className="chip"
                                  disabled={busy}
                                  onClick={() => ask(s, m.items?.[0]?.id)}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </div>

        <form className="ask__composer" onSubmit={onSubmit}>
          <div className="ask__input-wrap">
            <textarea
              className="ask__input"
              rows={1}
              placeholder="Ask about deadlines, ownership, waiting threads…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
            <button className="btn btn--ghost btn--icon btn--sm" type="button" title="Start a new chat" onClick={() => setMessages([])} disabled={!messages.length}>
              <RotateCcw size={15} />
            </button>
            <button className="ask__send" type="submit" disabled={!input.trim() || busy} aria-label="Send question">
              {busy ? <Spinner /> : <Send size={16} />}
            </button>
          </div>
          <div className="ask__disclaimer">
            {meta ? `${meta.provider === 'openai' ? 'OpenAI' : 'Built-in rule-signal engine'} · answers cite the connected inbox` : ''}
            {' · '}Drafts are never sent without your approval.
          </div>
        </form>
      </div>
    </div>
  );
}

function AIReply({ text = '' }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
