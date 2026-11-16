import { ChevronRight, Star } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { Conversation } from "../lib/types"
import { displayName, relativeTime, STATUS_META } from "../lib/format"
import { Avatar } from "./ui"
import { ClassificationBadge } from "./ClassificationBadge"

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const navigate = useNavigate()

  const sender = conversation.lastMessage?.from || conversation.participants[0]
  const senderName = displayName(sender?.name, sender?.email)
  const preview = conversation.lastMessage?.preview || "No messages yet"
  const unread = conversation.unreadCount > 0 || !conversation.isRead
  const status = STATUS_META[conversation.status]

  return (
    <button
      type="button"
      className={`conversation-row ${unread ? "is-unread" : ""} animate-fade-in`}
      onClick={() => navigate(`/app/conversations/${conversation._id}`)}
    >
      <span className="row-leading">
        <Avatar name={senderName} email={sender?.email} size={38} />
        {unread ? <span className="unread-dot" aria-label="Unread" /> : null}
      </span>

      <span className="row-body">
        <span className="row-top">
          <span className="row-sender">{senderName}</span>
          <span className="row-time">
            {conversation.isImportant ? (
              <Star size={12} className="star-filled" fill="currentColor" />
            ) : null}
            {relativeTime(conversation.lastMessageAt)}
          </span>
        </span>

        <span className="row-subject">
          {conversation.subject}
          {conversation.unreadCount > 1 ? (
            <span className="unread-count">{conversation.unreadCount}</span>
          ) : null}
        </span>

        <span className="row-preview">{preview}</span>

        <span className="row-meta">
          <ClassificationBadge classification={conversation.classification} size="sm" />
          {conversation.status !== "open" ? (
            <span className={`status-pill ${status.className}`}>{status.label}</span>
          ) : null}
          {conversation.clientAction === "delegated" ? (
            <span className="status-pill status-delegated">Delegated to assistant</span>
          ) : null}
          {conversation.clientAction === "handled" ? (
            <span className="status-pill status-done">Handled by client</span>
          ) : null}
        </span>
      </span>

      <span className="row-trailing" aria-hidden>
        <ChevronRight size={16} />
      </span>
    </button>
  )
}
