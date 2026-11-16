import type { Classification } from "./types"

export function relativeTime(iso?: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

export function fullTime(iso?: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const yesterday = new Date(today.getTime() - 86400000)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isToday) return `Today · ${time}`
  if (isYesterday) return `Yesterday · ${time}`
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${time}`
}

export function initials(value?: string): string {
  if (!value) return "?"
  const cleaned = value.split("@")[0].replace(/[._-]+/g, " ").trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function displayName(name?: string, email?: string): string {
  if (name && name.trim()) return name.trim()
  if (!email) return "Unknown"
  return email.split("@")[0].replace(/[._-]+/g, " ")
}

export function avatarHue(value?: string): number {
  const source = value || "?"
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = source.charCodeAt(i) + ((hash << 5) - hash)
  return Math.abs(hash) % 360
}

export const CLASSIFICATION_META: Record<
  Classification,
  { label: string; badge: string; dot: string; hint: string }
> = {
  assistant_reply: {
    label: "Assistant to reply",
    badge: "badge badge-assistant",
    dot: "var(--color-assistant)",
    hint: "The assistant can handle this response",
  },
  client_reply: {
    label: "Client to reply",
    badge: "badge badge-client",
    dot: "var(--color-client)",
    hint: "Needs the client's personal response",
  },
  no_reply: {
    label: "No reply needed",
    badge: "badge badge-noreply",
    dot: "var(--color-noreply)",
    hint: "Informational — no response required",
  },
  needs_review: {
    label: "Needs review",
    badge: "badge badge-review",
    dot: "var(--color-review)",
    hint: "AI was not confident enough to decide",
  },
}

export const STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "status-open" },
  waiting_response: { label: "Waiting for response", className: "status-waiting" },
  completed: { label: "Completed", className: "status-done" },
}
