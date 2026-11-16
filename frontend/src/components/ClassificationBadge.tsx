import { AlertTriangle, Bot, BellOff, User } from "lucide-react"
import type { Classification } from "../lib/types"
import { CLASSIFICATION_META } from "../lib/format"

const ICONS: Record<Classification, typeof Bot> = {
  assistant_reply: Bot,
  client_reply: User,
  no_reply: BellOff,
  needs_review: AlertTriangle,
}

export function ClassificationBadge({
  classification,
  size = "md",
}: {
  classification: Classification
  size?: "sm" | "md"
}) {
  const meta = CLASSIFICATION_META[classification]
  const Icon = ICONS[classification]

  return (
    <span
      className={`${meta.badge} ${size === "sm" ? "badge-sm" : ""}`}
      title={`${meta.label} — ${meta.hint}`}
    >
      <Icon size={size === "sm" ? 10 : 11} />
      {meta.label}
    </span>
  )
}
