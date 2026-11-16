export type Classification = "assistant_reply" | "client_reply" | "no_reply" | "needs_review"
export type ConversationStatus = "open" | "waiting_response" | "completed"
export type ClientAction = "pending" | "handled" | "delegated"
export type ClassificationSource = "ai" | "rules" | "manual"
export type Provider = "gmail" | "outlook"
export type AccountStatus = "connected" | "syncing" | "error"
export type MessageDirection = "inbound" | "outbound"

export type SegmentKey =
  | "all"
  | "action_required"
  | "client"
  | "assistant"
  | "waiting"
  | "review"
  | "meetings"
  | "important"
  | "no_reply"
  | "general"
  | "unread"

export interface User {
  _id: string
  username: string
  email: string
  role: "assistant" | "client"
  createdAt?: string
  updatedAt?: string
}

export interface Account {
  _id: string
  owner: string
  provider: Provider
  email: string
  displayName?: string
  status: AccountStatus
  isConnected: boolean
  connectionMode: "simulated" | "live"
  lastSyncedAt?: string
  lastSyncMessage?: string
  connectedAt?: string
}

export interface Participant {
  name?: string
  email: string
}

export interface ImportantDate {
  label: string
  date?: string
}

export interface LastMessage {
  from: Participant
  preview: string
  receivedAt: string
  direction: MessageDirection
}

export interface Conversation {
  _id: string
  account: string | Partial<Account>
  owner: string
  subject: string
  participants: Participant[]
  messages?: string[] | Message[]
  classification: Classification
  classificationReason: string
  classificationConfidence: number
  classificationSource: ClassificationSource
  labels: string[]
  aiSummary?: string
  keyPoints: string[]
  importantDates: ImportantDate[]
  status: ConversationStatus
  clientAction: ClientAction
  isImportant: boolean
  isRead: boolean
  isArchived: boolean
  unreadCount: number
  lastMessage?: LastMessage
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  _id: string
  conversation: string
  account: string
  direction: MessageDirection
  from: Participant
  to: Participant[]
  subject: string
  body: string
  receivedAt: string
  isRead: boolean
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface SegmentMeta {
  key: SegmentKey
  label: string
  description: string
  count: number
}

export interface ClassificationBreakdown {
  key: Classification
  label: string
  count: number
}

export interface DashboardStats {
  totals: {
    emails: number
    unreadEmails: number
    conversations: number
    unreadConversations: number
    important: number
    actionRequired: number
    waitingResponse: number
    assistantToReply: number
    clientToReply: number
    noReplyNeeded: number
    needsReview: number
  }
  segments: Record<string, number>
  byClassification: ClassificationBreakdown[]
  accounts: Account[]
  sync: { anySyncing: boolean; lastSyncedAt: string | null }
  recentConversations: Conversation[]
  upcomingMeetings: Conversation[]
}

export interface ClassificationResult {
  classification: Classification
  reason: string
  confidence: number
  labels: string[]
  source: "ai" | "rules"
}

export interface ConversationSummary {
  summary: string
  keyPoints: string[]
  importantDates: ImportantDate[]
  source: "ai" | "rules"
}

export interface DraftResult {
  body: string
  source: "ai" | "rules"
}
