import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  LayoutDashboard,
  Mail,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react"
import { aiApi, emailsApi, errorMessage } from "../lib/api"
import type { Conversation, Message } from "../lib/types"
import { displayName, fullTime } from "../lib/format"
import { Avatar, Button, EmptyState, ErrorState, Logo, Skeleton } from "../components/ui"
import { useToast } from "../components/useToast"

export default function ClientPortal() {
  const navigate = useNavigate()
  const { push } = useToast()

  const [items, setItems] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [thread, setThread] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const run = async () => {
      try {
        const result = await emailsApi.clientList()
        setItems(result.items)
        setError(null)
      } catch (caught) {
        setError(errorMessage(caught))
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [refreshKey])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    setRefreshKey((key) => key + 1)
  }, [])

  const openThread = async (conversation: Conversation) => {
    if (expandedId === conversation._id) {
      setExpandedId(null)
      setThread([])
      return
    }

    setExpandedId(conversation._id)
    setThread([])
    setThreadLoading(true)

    try {
      const result = await emailsApi.get(conversation._id)
      setThread(result.messages)

      if (!result.conversation.aiSummary) {
        setSummarizingId(conversation._id)
        try {
          const summary = await aiApi.summarize(conversation._id)
          setItems((current) =>
            current.map((item) =>
              item._id === conversation._id ? summary.conversation : item
            )
          )
        } catch (caught) {
          push("error", `Summary unavailable — ${errorMessage(caught)}`)
        } finally {
          setSummarizingId(null)
        }
      }
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setThreadLoading(false)
    }
  }

  const act = async (conversation: Conversation, action: "handled" | "delegated") => {
    setActingId(conversation._id)
    try {
      await emailsApi.update(conversation._id, { clientAction: action })
      push(
        "success",
        action === "handled"
          ? "Marked as handled — your assistant has been notified"
          : "Handed to your assistant — they'll take it from here"
      )
      load()
      setExpandedId(null)
      setThread([])
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setActingId(null)
    }
  }

  const needingAttention = items.length

  return (
    <div className="client-portal">
      <header className="client-head">
        <Link to="/app" aria-label="MailPilot AI home">
          <Logo size={28} />
        </Link>
        <div className="client-head-actions">
          <span className="client-badge">
            <UserRound size={12} />
            Client view
          </span>
          <Link to="/app" className="btn btn-ghost btn-sm">
            <LayoutDashboard size={13} />
            Assistant dashboard
          </Link>
        </div>
      </header>

      <main className="client-body">
        <section className="client-hero animate-fade-in">
          <span className="section-kicker">
            <Mail size={13} />
            Your attention inbox
          </span>
          <h1>
            {loading ? (
              "Checking your mail…"
            ) : needingAttention > 0 ? (
              <>
                {needingAttention} conversation{needingAttention === 1 ? "" : "s"}{" "}
                <span className="gradient-text">need{needingAttention === 1 ? "s" : ""} you</span>
              </>
            ) : (
              <span className="gradient-text">You're all caught up</span>
            )}
          </h1>
          <p>
            Only emails where the AI decided <strong>you personally</strong> must respond appear
            here. Everything else is handled by your assistant.
          </p>
        </section>

        {loading ? (
          <div className="client-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="client-card-skeleton" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Check size={22} />}
            title="Nothing needs your personal attention"
            description="When the AI decides an email requires your own response, it will appear here with a short summary and why it matters."
            action={
              <Link to="/app" className="btn btn-secondary">
                <LayoutDashboard size={14} />
                Open assistant dashboard
              </Link>
            }
          />
        ) : (
          <div className="client-list">
            {items.map((conversation) => {
              const sender = conversation.participants[0]
              const senderName = displayName(sender?.name, sender?.email)
              const expanded = expandedId === conversation._id

              return (
                <article
                  key={conversation._id}
                  className={`client-card card animate-fade-in ${expanded ? "is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="client-card-main"
                    onClick={() => void openThread(conversation)}
                    aria-expanded={expanded}
                  >
                    <Avatar name={senderName} email={sender?.email} size={44} />

                    <div className="client-card-body">
                      <div className="client-card-top">
                        <strong>{senderName}</strong>
                        <span>{fullTime(conversation.lastMessageAt)}</span>
                      </div>
                      <h3>{conversation.subject}</h3>

                      {conversation.aiSummary ? (
                        <p className="client-summary">{conversation.aiSummary}</p>
                      ) : (
                        <p className="client-summary client-summary-pending">
                          {summarizingId === conversation._id
                            ? "AI is writing a short summary…"
                            : "Open to see a short AI summary of this thread."}
                        </p>
                      )}

                      <div className="client-why">
                        <Sparkles size={13} />
                        <span>
                          <strong>Why it needs you:</strong> {conversation.classificationReason}
                        </span>
                      </div>
                    </div>

                    <span className={`client-chevron ${expanded ? "is-open" : ""}`}>
                      <ChevronDown size={18} />
                    </span>
                  </button>

                  <div className={`client-expand ${expanded ? "is-open" : ""}`}>
                    <div className="client-thread">
                      {threadLoading ? (
                        <div className="stack">
                          {Array.from({ length: 2 }).map((_, index) => (
                            <Skeleton key={index} className="message-skeleton" />
                          ))}
                        </div>
                      ) : (
                        thread.map((message) => (
                          <div
                            key={message._id}
                            className={`client-message ${
                              message.direction === "outbound" ? "is-outbound" : ""
                            }`}
                          >
                            <span className="client-message-from">
                              {displayName(message.from?.name, message.from?.email)} ·{" "}
                              {fullTime(message.receivedAt)}
                            </span>
                            <p>{message.body}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="client-actions">
                      <Button
                        variant="primary"
                        loading={actingId === conversation._id}
                        onClick={() => void act(conversation, "handled")}
                      >
                        <Check size={14} />
                        Mark as handled
                      </Button>
                      <Button
                        variant="secondary"
                        loading={actingId === conversation._id}
                        onClick={() => void act(conversation, "delegated")}
                      >
                        <Send size={14} />
                        Assistant should handle this
                      </Button>
                      <button
                        type="button"
                        className="link-btn client-open"
                        onClick={() => navigate(`/app/conversations/${conversation._id}`)}
                      >
                        Open full conversation
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <footer className="client-foot">
          <span>
            Powered by <strong>MailPilot AI</strong> — the minimal view for busy clients.
          </span>
          <span>
            Classifications update as mail arrives; actions here stay in sync with your assistant's
            dashboard.
          </span>
        </footer>
      </main>
    </div>
  )
}
