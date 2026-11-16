import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowUp, Bot, Sparkles, User, UserRound } from "lucide-react"
import { aiApi, emailsApi, errorMessage } from "../lib/api"
import type { Conversation } from "../lib/types"
import { Avatar, Button, SelectField, Spinner } from "../components/ui"
import { useToast } from "../components/useToast"

interface ChatMessage {
  id: number
  role: "user" | "assistant"
  text: string
  source?: "ai" | "rules"
}

const SUGGESTIONS = [
  "Show me emails that need my attention",
  "Which emails require the client's attention?",
  "What am I waiting for a response on?",
  "Why has this email been assigned to the client?",
  "Summarize this conversation",
  "Which emails are meetings or appointments?",
]

const GREETING: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Hi! I've read every conversation in your connected inbox. Ask me anything — who must reply, what's waiting on someone else, or what a thread is about.",
}

export default function AskAI() {
  const [params] = useSearchParams()
  const { push } = useToast()

  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [contextId, setContextId] = useState<string>(params.get("conv") || "")

  const listRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    emailsApi
      .list({ limit: 30 })
      .then((result) => setConversations(result.items))
      .catch(() => setConversations([]))
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, busy])

  const contextConversation = conversations.find((item) => item._id === contextId)

  const ask = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || busy) return

    setInput("")
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: trimmed },
    ])
    setBusy(true)

    try {
      const result = await aiApi.ask({
        question: trimmed,
        conversationId: contextId || undefined,
      })
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: result.answer,
          source: result.source,
        },
      ])
    } catch (caught) {
      push("error", errorMessage(caught))
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: `I couldn't answer that right now — ${errorMessage(caught)}`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask(input)
  }

  return (
    <div className="page page-ask">
      <header className="ask-head animate-fade-in">
        <div>
          <span className="section-kicker">
            <Sparkles size={13} />
            AI inbox assistant
          </span>
          <h1>Ask anything about the inbox</h1>
          <p>
            Grounded in your live conversations — classifications, summaries, pending responses
            and more.
          </p>
        </div>

        <div className="ask-context">
          <SelectField
            aria-label="Conversation context"
            value={contextId}
            onChange={(event) => setContextId(event.target.value)}
          >
            <option value="">Whole inbox</option>
            {conversations.map((conversation) => (
              <option key={conversation._id} value={conversation._id}>
                {conversation.subject.slice(0, 48)}
              </option>
            ))}
          </SelectField>
          {contextConversation ? (
            <Link
              to={`/app/conversations/${contextConversation._id}`}
              className="context-link"
            >
              Open this conversation →
            </Link>
          ) : null}
        </div>
      </header>

      <div className="ask-chat card animate-fade-in">
        <div className="ask-messages" ref={listRef}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble chat-${message.role} animate-fade-in`}
            >
              <span className="chat-avatar">
                {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </span>
              <div className="chat-content">
                <p>{message.text}</p>
                {message.role === "assistant" && message.id !== 0 ? (
                  <span className="chat-source">
                    {message.source === "ai" ? "Gemini" : "Rule-based AI"} ·{" "}
                    {contextId ? "conversation context" : "whole inbox"}
                  </span>
                ) : null}
              </div>
            </div>
          ))}

          {busy ? (
            <div className="chat-bubble chat-assistant animate-fade-in">
              <span className="chat-avatar">
                <Bot size={14} />
              </span>
              <div className="chat-content chat-typing">
                <Spinner />
                <span>Reading your conversations…</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="ask-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestion-chip"
              disabled={busy}
              onClick={() => void ask(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form className="ask-input" onSubmit={submit}>
          <Avatar name="You" email="you" size={30} />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. What am I waiting for a response on?"
            aria-label="Your question"
            disabled={busy}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!input.trim() || busy}
            aria-label="Send question"
          >
            {busy ? <Spinner /> : <ArrowUp size={15} />}
          </Button>
        </form>
      </div>

      <div className="ask-footnote">
        <UserRound size={13} />
        Answers come from Gemini when available, with a deterministic rule-based fallback so the
        demo never breaks.
      </div>
    </div>
  )
}
