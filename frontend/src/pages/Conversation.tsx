import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Archive,
  Bot,
  CalendarClock,
  Check,
  CheckCheck,
  CircleAlert,
  Eye,
  KeyRound,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Tag,
  Undo2,
  UserRound,
} from "lucide-react"
import { aiApi, emailsApi, errorMessage } from "../lib/api"
import type {
  Classification,
  Conversation as ConversationType,
  Message,
} from "../lib/types"
import {
  CLASSIFICATION_META,
  displayName,
  fullTime,
  STATUS_META,
} from "../lib/format"
import {
  AiPill,
  Avatar,
  Button,
  ErrorState,
  SelectField,
  Skeleton,
  TextArea,
} from "../components/ui"
import { useToast } from "../components/useToast"
import { ClassificationBadge } from "../components/ClassificationBadge"

const CLASSIFICATIONS: Classification[] = [
  "assistant_reply",
  "client_reply",
  "no_reply",
  "needs_review",
]

export default function Conversation() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()

  const [conversation, setConversation] = useState<ConversationType | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [summarizing, setSummarizing] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideValue, setOverrideValue] = useState<Classification>("assistant_reply")

  const [draft, setDraft] = useState("")
  const [draftSource, setDraftSource] = useState<"ai" | "rules" | "manual" | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [tone, setTone] = useState<"professional" | "friendly" | "formal">("professional")
  const [instructions, setInstructions] = useState("")
  const [approved, setApproved] = useState(false)
  const [sending, setSending] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!id) return
    const run = async () => {
      try {
        const result = await emailsApi.get(id)
        setConversation(result.conversation)
        setMessages(result.messages)
        setOverrideValue(result.conversation.classification)
        setError(null)
      } catch (caught) {
        setError(errorMessage(caught))
      } finally {
        setLoadedId(id)
      }
    }
    void run()
  }, [id, refreshKey])

  const loading = Boolean(id) && loadedId !== id

  const load = useCallback(() => {
    setLoadedId(null)
    setError(null)
    setRefreshKey((key) => key + 1)
  }, [])

  const patchConversation = (next: ConversationType) => {
    setConversation(next)
    setOverrideValue(next.classification)
  }

  const toggleImportant = async () => {
    if (!conversation) return
    try {
      const result = await emailsApi.update(conversation._id, {
        isImportant: !conversation.isImportant,
      })
      patchConversation(result.conversation)
      push("success", conversation.isImportant ? "Removed from important" : "Marked as important")
    } catch (caught) {
      push("error", errorMessage(caught))
    }
  }

  const toggleRead = async () => {
    if (!conversation) return
    try {
      const result = await emailsApi.update(conversation._id, {
        isRead: !conversation.isRead,
      })
      patchConversation(result.conversation)
    } catch (caught) {
      push("error", errorMessage(caught))
    }
  }

  const archive = async () => {
    if (!conversation) return
    try {
      const result = await emailsApi.update(conversation._id, {
        isArchived: !conversation.isArchived,
      })
      patchConversation(result.conversation)
      push(
        "success",
        result.conversation.isArchived ? "Conversation archived" : "Conversation restored"
      )
    } catch (caught) {
      push("error", errorMessage(caught))
    }
  }

  const complete = async () => {
    if (!conversation) return
    const nextStatus = conversation.status === "completed" ? "open" : "completed"
    try {
      const result = await emailsApi.update(conversation._id, { status: nextStatus })
      patchConversation(result.conversation)
      push("success", nextStatus === "completed" ? "Marked as completed" : "Reopened")
    } catch (caught) {
      push("error", errorMessage(caught))
    }
  }

  const summarize = async () => {
    if (!conversation) return
    setSummarizing(true)
    try {
      const result = await aiApi.summarize(conversation._id)
      patchConversation(result.conversation)
      push("success", result.summary.source === "ai" ? "Summarised with Gemini" : "Summary generated")
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setSummarizing(false)
    }
  }

  const reclassify = async () => {
    if (!conversation) return
    setClassifying(true)
    try {
      const result = await aiApi.classify(conversation._id)
      patchConversation(result.conversation)
      push(
        "success",
        `AI says “${CLASSIFICATION_META[result.conversation.classification].label}”`
      )
      setOverrideOpen(false)
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setClassifying(false)
    }
  }

  const applyOverride = async () => {
    if (!conversation) return
    if (overrideValue === conversation.classification) {
      setOverrideOpen(false)
      return
    }
    try {
      const result = await emailsApi.update(conversation._id, {
        classification: overrideValue,
        reason: `Manually set by assistant (was ${conversation.classification})`,
      })
      patchConversation(result.conversation)
      setOverrideOpen(false)
      push("success", `Classification changed to “${CLASSIFICATION_META[overrideValue].label}”`)
    } catch (caught) {
      push("error", errorMessage(caught))
    }
  }

  const createDraft = async () => {
    if (!conversation) return
    setDrafting(true)
    try {
      const result = await aiApi.draft(conversation._id, {
        tone,
        instructions: instructions.trim() || undefined,
      })
      setDraft(result.body)
      setDraftSource(result.source)
      setApproved(false)
      push("success", result.source === "ai" ? "Gemini drafted a reply" : "Rule-based draft ready")
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setDrafting(false)
    }
  }

  const sendReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!conversation) return

    const machineDraft = draftSource === "ai" || draftSource === "rules"

    if (!draft.trim()) {
      push("error", "Write or generate a reply first")
      return
    }
    if (machineDraft && !approved) {
      push("error", "Review the AI draft and confirm before sending")
      return
    }

    setSending(true)
    try {
      const result = await emailsApi.reply(conversation._id, {
        body: draft.trim(),
        source: machineDraft ? "ai" : "manual",
        approved: machineDraft ? true : undefined,
      })
      setMessages((current) => [...current, result.message])
      patchConversation(result.conversation)
      setDraft("")
      setDraftSource(null)
      setApproved(false)
      push("success", "Reply sent and conversation updated")
    } catch (caught) {
      push("error", errorMessage(caught))
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="page page-conversation">
        <div className="conversation-layout">
          <div className="thread-panel card">
            <Skeleton className="detail-head-skeleton" />
            <div className="stack">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="message-skeleton" />
              ))}
            </div>
          </div>
          <Skeleton className="ai-panel-skeleton" />
        </div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="page page-conversation">
        <ErrorState
          message={error || "Conversation not found"}
          onRetry={load}
        />
        <div className="state-actions">
          <Button variant="secondary" onClick={() => navigate("/app/inbox")}>
            <ArrowLeft size={14} />
            Back to inbox
          </Button>
        </div>
      </div>
    )
  }

  const meta = CLASSIFICATION_META[conversation.classification]
  const status = STATUS_META[conversation.status]
  const participant = conversation.participants[0]
  const senderName = displayName(participant?.name, participant?.email)
  const account =
    typeof conversation.account === "object" ? conversation.account : null

  return (
    <div className="page page-conversation">
      <div className="conversation-topbar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          Back
        </button>
        <span className="conversation-topbar-hint">
          <Link to={`/app/ask?conv=${conversation._id}`}>
            <Sparkles size={13} />
            Ask AI about this conversation
          </Link>
        </span>
      </div>

      <div className="conversation-layout">
        <section className="thread-panel card animate-fade-in">
          <header className="thread-head">
            <div className="thread-head-main">
              <Avatar name={senderName} email={participant?.email} size={44} />
              <div>
                <h1>{conversation.subject}</h1>
                <p>
                  {senderName}
                  {participant?.email ? <span className="muted"> &lt;{participant.email}&gt;</span> : null}
                  {account?.email ? (
                    <span className="muted"> · to {account.email}</span>
                  ) : null}
                </p>
                <p className="thread-time">{fullTime(conversation.lastMessageAt)}</p>
              </div>
            </div>

            <div className="thread-head-actions">
              <ClassificationBadge classification={conversation.classification} />
              <span className={`status-pill ${status.className}`}>{status.label}</span>
              <button
                type="button"
                className={`icon-btn ${conversation.isImportant ? "is-on" : ""}`}
                aria-label="Toggle important"
                title="Mark important"
                onClick={toggleImportant}
              >
                <Star size={16} fill={conversation.isImportant ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Toggle unread"
                title={conversation.isRead ? "Mark unread" : "Mark read"}
                onClick={toggleRead}
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Archive"
                title={conversation.isArchived ? "Restore" : "Archive"}
                onClick={archive}
              >
                {conversation.isArchived ? <Undo2 size={16} /> : <Archive size={16} />}
              </button>
              <Button
                variant={conversation.status === "completed" ? "ghost" : "secondary"}
                size="sm"
                onClick={complete}
              >
                <CheckCheck size={14} />
                {conversation.status === "completed" ? "Reopen" : "Complete"}
              </Button>
            </div>
          </header>

          <div className="thread-messages">
            {messages.length === 0 ? (
              <p className="panel-empty">No messages loaded for this conversation.</p>
            ) : (
              messages.map((message) => (
                <article
                  key={message._id}
                  className={`message-card ${message.direction === "outbound" ? "is-outbound" : ""} animate-fade-in`}
                >
                  <div className="message-meta">
                    <Avatar
                      name={displayName(message.from?.name, message.from?.email)}
                      email={message.from?.email}
                      size={30}
                    />
                    <div>
                      <strong>{displayName(message.from?.name, message.from?.email)}</strong>
                      <span>
                        {message.direction === "outbound" ? "Sent by you" : "Received"} ·{" "}
                        {fullTime(message.receivedAt)}
                      </span>
                    </div>
                    {message.direction === "outbound" ? (
                      <span className="dir-tag dir-out">You</span>
                    ) : (
                      <span className="dir-tag">Inbound</span>
                    )}
                  </div>
                  <div className="message-body">{message.body}</div>
                </article>
              ))
            )}
          </div>

          <form className="reply-composer" onSubmit={sendReply}>
            <div className="composer-head">
              <span className="composer-title">
                <Send size={14} />
                Reply
              </span>
              <div className="composer-tools">
                <SelectField
                  aria-label="Tone"
                  value={tone}
                  onChange={(event) => setTone(event.target.value as typeof tone)}
                >
                  <option value="professional">Professional tone</option>
                  <option value="friendly">Friendly tone</option>
                  <option value="formal">Formal tone</option>
                </SelectField>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={drafting}
                  onClick={createDraft}
                >
                  <Sparkles size={13} />
                  Draft with AI
                </Button>
              </div>
            </div>

            <input
              className="input composer-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Optional instructions for the AI draft (e.g. mention the 14th, keep it brief)…"
              aria-label="Instructions for AI draft"
            />

            {draftSource === "ai" || draftSource === "rules" ? (
              <div className="ai-draft-banner animate-fade-in">
                <Bot size={14} />
                <span>
                  <strong>AI-generated draft.</strong> Read it carefully — you must approve before
                  sending.
                </span>
                <label className="approve-check">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(event) => setApproved(event.target.checked)}
                  />
                  <span>I've reviewed this draft</span>
                </label>
              </div>
            ) : null}

            <TextArea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                if (draftSource === "ai" || draftSource === "rules") setApproved(false)
              }}
              rows={4}
              placeholder="Write your reply, or let AI draft it for you…"
              aria-label="Reply message"
            />

            <div className="composer-foot">
              <span className="composer-hint">
                {(draftSource === "ai" || draftSource === "rules") && !approved
                  ? "Approval required before sending"
                  : "Replies update the conversation and re-run classification"}
              </span>
              <Button
                type="submit"
                variant="primary"
                loading={sending}
                disabled={!draft.trim()}
              >
                <Send size={14} />
                Send reply
              </Button>
            </div>
          </form>
        </section>

        <aside className="ai-panel">
          <section className="ai-card card animate-fade-in">
            <div className="ai-card-head">
              <h2>
                <Bot size={15} />
                Reply responsibility
              </h2>
              <AiPill source={conversation.classificationSource} />
            </div>

            <div className="ai-classification">
              <ClassificationBadge classification={conversation.classification} />
              <div className="confidence">
                <div className="confidence-track">
                  <span
                    className="confidence-fill"
                    style={{
                      width: `${Math.round(conversation.classificationConfidence * 100)}%`,
                      background: meta.dot,
                    }}
                  />
                </div>
                <span>{Math.round(conversation.classificationConfidence * 100)}% confidence</span>
              </div>
            </div>

            <p className="ai-reason">{conversation.classificationReason}</p>

            <div className="ai-actions">
              <Button
                variant="secondary"
                size="sm"
                loading={classifying}
                onClick={reclassify}
              >
                <RefreshCw size={13} />
                Re-run AI
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOverrideOpen((current) => !current)}
              >
                <KeyRound size={13} />
                Override
              </Button>
            </div>

            {overrideOpen ? (
              <div className="override-box animate-fade-in">
                <SelectField
                  label="Set classification manually"
                  value={overrideValue}
                  onChange={(event) => setOverrideValue(event.target.value as Classification)}
                >
                  {CLASSIFICATIONS.map((option) => (
                    <option key={option} value={option}>
                      {CLASSIFICATION_META[option].label}
                    </option>
                  ))}
                </SelectField>
                <div className="override-actions">
                  <Button variant="ghost" size="sm" onClick={() => setOverrideOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={applyOverride}>
                    <Check size={13} />
                    Save override
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="ai-card card animate-fade-in">
            <div className="ai-card-head">
              <h2>
                <Sparkles size={15} />
                AI summary
              </h2>
              {conversation.aiSummary ? (
                <button
                  type="button"
                  className="link-btn"
                  onClick={summarize}
                  disabled={summarizing}
                >
                  {summarizing ? "Updating…" : "Refresh"}
                </button>
              ) : null}
            </div>

            {conversation.aiSummary ? (
              <div className="summary-body">
                <p>{conversation.aiSummary}</p>

                {conversation.keyPoints.length > 0 ? (
                  <ul className="key-points">
                    {conversation.keyPoints.map((point) => (
                      <li key={point}>
                        <Check size={12} />
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {conversation.importantDates.length > 0 ? (
                  <div className="important-dates">
                    <span className="mini-label">
                      <CalendarClock size={12} />
                      Key dates
                    </span>
                    {conversation.importantDates.map((item) => (
                      <div key={item.label} className="date-row">
                        <span>{item.label}</span>
                        <strong>
                          {item.date
                            ? fullTime(item.date).split(" · ")[0]
                            : "date to confirm"}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="summary-empty">
                <p>No summary yet — generate one to skim this thread in seconds.</p>
                <Button variant="secondary" size="sm" loading={summarizing} onClick={summarize}>
                  <Sparkles size={13} />
                  Summarise conversation
                </Button>
              </div>
            )}
          </section>

          <section className="ai-card card animate-fade-in">
            <div className="ai-card-head">
              <h2>
                <Tag size={15} />
                Labels
              </h2>
            </div>
            <div className="label-chips">
              {conversation.labels.length > 0 ? (
                conversation.labels.map((label) => (
                  <span key={label} className="label-chip">
                    {label}
                  </span>
                ))
              ) : (
                <span className="muted">No labels suggested</span>
              )}
            </div>

            {conversation.clientAction !== "pending" ? (
              <div className={`client-action-note ${conversation.clientAction}`}>
                {conversation.clientAction === "handled" ? (
                  <>
                    <Check size={13} />
                    Client marked this as handled
                  </>
                ) : (
                  <>
                    <UserRound size={13} />
                    Client asked the assistant to take over
                  </>
                )}
              </div>
            ) : null}

            {conversation.classification === "needs_review" ? (
              <div className="client-action-note needs-review">
                <CircleAlert size={13} />
                AI was not confident — please review manually
              </div>
            ) : null}

            <div className="ai-card-foot">
              <span className="mini-label">
                <Mail size={12} />
                {messages.length} message{messages.length === 1 ? "" : "s"} in thread
              </span>
              <span className="mini-label">
                <UserRound size={12} />
                {conversation.participants.length} participant
                {conversation.participants.length === 1 ? "" : "s"}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
