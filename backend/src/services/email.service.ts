import type { QueryFilter, Types } from "mongoose"
import Conversation, {
  type IConversation,
  type ReplyClassification,
} from "../models/conversation.model"
import Email, { type IEmail } from "../models/email.model"
import Account from "../models/account.model"
import { ApiError } from "../utils/ApiError"
import { classifyConversation, type MessageContext } from "./ai.service"

/* ------------------------------------------------------------------ */
/* Segments                                                            */
/* ------------------------------------------------------------------ */

export const SEGMENT_META = [
  { key: "all", label: "All conversations", description: "Everything across the connected inbox" },
  { key: "action_required", label: "Action required", description: "Open conversations the assistant must move forward" },
  { key: "client", label: "Client to reply", description: "Waiting on the client's personal response" },
  { key: "assistant", label: "Assistant to reply", description: "Owned by the assistant" },
  { key: "waiting", label: "Waiting for response", description: "We replied and are waiting on the other side" },
  { key: "review", label: "Needs review", description: "AI was not confident enough to decide" },
  { key: "meetings", label: "Meetings & appointments", description: "Scheduling and booking related mail" },
  { key: "important", label: "Important", description: "Flagged as high priority" },
  { key: "no_reply", label: "No reply needed", description: "Informational mail, no response required" },
  { key: "general", label: "General", description: "Everything else" },
  { key: "unread", label: "Unread", description: "Not opened yet" },
] as const

export type SegmentKey = (typeof SEGMENT_META)[number]["key"]

export const segmentFilter = (segment?: SegmentKey): QueryFilter<IConversation> => {
  switch (segment) {
    case "assistant":
      return { classification: "assistant_reply" }
    case "client":
      return { classification: "client_reply" }
    case "no_reply":
      return { classification: "no_reply" }
    case "review":
      return { classification: "needs_review" }
    case "action_required":
      return { status: "open", classification: { $in: ["assistant_reply", "needs_review"] } }
    case "waiting":
      return { status: "waiting_response" }
    case "meetings":
      return { labels: "meeting" }
    case "important":
      return { isImportant: true }
    case "general":
      return { classification: "no_reply", isImportant: false, labels: { $ne: "meeting" } }
    case "unread":
      return { unreadCount: { $gt: 0 } }
    default:
      return {}
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const normalizeSubject = (subject: string): string =>
  subject.replace(/^\s*(re|fwd|fw)\s*:\s*/gi, "").trim().toLowerCase()

export const loadMessages = async (conversation: IConversation): Promise<IEmail[]> => {
  const messages = await Email.find({ _id: { $in: conversation.messages } }).sort({
    receivedAt: 1,
  })
  return messages
}

export const toMessageContext = (messages: IEmail[]): MessageContext[] =>
  messages.map((message) => ({
    from: message.from.name || message.from.email,
    direction: message.direction,
    body: message.body,
  }))

export const applyClassification = (
  conversation: IConversation,
  result: Awaited<ReturnType<typeof classifyConversation>>
): void => {
  conversation.classification = result.classification
  conversation.classificationReason = result.reason
  conversation.classificationConfidence = result.confidence
  conversation.classificationSource = result.source

  const labels = new Set<string>(result.labels)
  if (conversation.isImportant) labels.add("important")
  conversation.labels = [...labels] as IConversation["labels"]

  // Important keywords in new mail raise the flag; it is never lowered automatically.
  if (result.labels.includes("important")) conversation.isImportant = true
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export interface ListConversationsParams {
  ownerId: Types.ObjectId | string
  segment?: SegmentKey
  accountId?: string
  status?: IConversation["status"]
  q?: string
  includeArchived?: boolean
  /** Client-facing view: only conversations waiting on the client. */
  clientView?: boolean
  page: number
  limit: number
}

export const listConversations = async (params: ListConversationsParams) => {
  const filter: QueryFilter<IConversation> = { owner: params.ownerId }

  if (!params.includeArchived) filter.isArchived = false
  if (params.segment) Object.assign(filter, segmentFilter(params.segment))
  if (params.status) filter.status = params.status
  if (params.accountId) filter.account = params.accountId

  if (params.clientView) {
    filter.classification = "client_reply"
    filter.clientAction = "pending"
  }

  if (params.q) {
    const regex = new RegExp(escapeRegex(params.q), "i")
    filter.$or = [
      { subject: regex },
      { "participants.name": regex },
      { "participants.email": regex },
      { "lastMessage.preview": regex },
      { aiSummary: regex },
    ]
  }

  const [items, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .populate("account", "provider email status"),
    Conversation.countDocuments(filter),
  ])

  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  }
}

export const getConversationDetail = async (
  conversationId: string,
  ownerId: Types.ObjectId | string
): Promise<{ conversation: IConversation; messages: IEmail[] }> => {
  const conversation = await Conversation.findOne({ _id: conversationId, owner: ownerId }).populate(
    "account",
    "provider email displayName status"
  )

  if (!conversation) throw new ApiError(404, "Conversation not found")

  const messages = await loadMessages(conversation)

  // Opening a conversation clears its unread state.
  if (conversation.unreadCount > 0 || !conversation.isRead) {
    conversation.unreadCount = 0
    conversation.isRead = true
    await conversation.save()
    await Email.updateMany(
      { _id: { $in: conversation.messages }, direction: "inbound" },
      { isRead: true }
    )
  }

  return { conversation, messages }
}

export const countSegments = async (
  ownerId: Types.ObjectId | string,
  accountId?: string
): Promise<Record<string, number>> => {
  const base: QueryFilter<IConversation> = { owner: ownerId, isArchived: false }
  if (accountId) base.account = accountId

  const entries = await Promise.all(
    SEGMENT_META.map(async (segment) => ({
      key: segment.key,
      count: await Conversation.countDocuments({
        ...base,
        ...segmentFilter(segment.key),
      }),
    }))
  )

  return Object.fromEntries(entries.map((entry) => [entry.key, entry.count]))
}

/* ------------------------------------------------------------------ */
/* Ingestion (simulated incoming email)                                */
/* ------------------------------------------------------------------ */

export interface IngestEmailInput {
  accountId: string
  from: { name?: string; email: string }
  to?: Array<{ name?: string; email: string }>
  subject: string
  body: string
  receivedAt?: Date | string
}

/**
 * Simulates a newly received email: stores it, updates/creates the
 * conversation and re-runs the AI reply-responsibility classification.
 */
export const ingestEmail = async (input: IngestEmailInput): Promise<IConversation> => {
  const account = await Account.findById(input.accountId)
  if (!account) throw new ApiError(404, "Connected email account not found")

  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date()
  const subjectKey = normalizeSubject(input.subject)

  let conversation = await Conversation.findOne({
    account: account._id,
    subjectKey,
    status: { $ne: "completed" },
  })

  if (!conversation) {
    conversation = await Conversation.create({
      account: account._id,
      owner: account.owner,
      subject: input.subject,
      subjectKey,
      participants: [
        ...(input.from.email ? [input.from] : []),
        ...(input.to || []),
      ],
      messages: [],
      classification: "needs_review",
      classificationReason: "Awaiting first AI analysis",
      lastMessageAt: receivedAt,
    })
  }

  const email = await Email.create({
    conversation: conversation._id,
    account: account._id,
    direction: "inbound",
    from: input.from,
    to: input.to || [{ email: account.email, name: account.displayName }],
    subject: input.subject,
    body: input.body,
    receivedAt,
    isRead: false,
  })

  conversation.messages.push(email._id)
  conversation.unreadCount = (conversation.unreadCount || 0) + 1
  conversation.isRead = false
  conversation.status = "open"
  conversation.lastMessage = {
    from: input.from,
    preview: input.body.replace(/\s+/g, " ").slice(0, 220),
    receivedAt,
    direction: "inbound",
  }
  conversation.lastMessageAt = receivedAt

  const alreadyParticipant = conversation.participants.some(
    (participant) => participant.email === input.from.email
  )
  if (!alreadyParticipant) conversation.participants.push(input.from)

  await conversation.save()

  // AI considers content + full history each time a new message arrives.
  const messages = await loadMessages(conversation)
  const classification = await classifyConversation({
    subject: conversation.subject,
    messages: toMessageContext(messages),
    clientName: account.displayName,
  })

  applyClassification(conversation, classification)
  await conversation.save()

  return conversation
}

/* ------------------------------------------------------------------ */
/* Outbound reply                                                      */
/* ------------------------------------------------------------------ */

export const sendReplyMessage = async (
  conversation: IConversation,
  params: { from: { name?: string; email: string }; to: Array<{ name?: string; email: string }>; body: string }
): Promise<IEmail> => {
  const sentAt = new Date()

  const email = await Email.create({
    conversation: conversation._id,
    account: conversation.account,
    direction: "outbound",
    from: params.from,
    to: params.to,
    subject: /^(re|fwd|fw)\s*:/i.test(conversation.subject)
      ? conversation.subject
      : `Re: ${conversation.subject}`,
    body: params.body,
    receivedAt: sentAt,
    isRead: true,
  })

  conversation.messages.push(email._id)
  conversation.status = "waiting_response"
  conversation.isRead = true
  conversation.unreadCount = 0
  conversation.lastMessage = {
    from: params.from,
    preview: params.body.replace(/\s+/g, " ").slice(0, 220),
    receivedAt: sentAt,
    direction: "outbound",
  }
  conversation.lastMessageAt = sentAt

  await conversation.save()

  return email
}

/* ------------------------------------------------------------------ */
/* Sample inbox (simulated Gmail/Outlook connection)                   */
/* ------------------------------------------------------------------ */

interface SampleThread {
  from: { name: string; email: string }
  subject: string
  bodies: string[]
  receivedAt?: string
}

const SAMPLE_THREADS: SampleThread[] = [
  {
    from: { name: "Priya Nair", email: "priya.nair@crestlinecapital.com" },
    subject: "Q4 board review — scheduling next week",
    bodies: [
      "Hi, I'm coordinating next week's Q4 board review for Daniel. Could we lock Tuesday 3:00 PM or Thursday 2:00 PM? Please confirm the time that works and I'll send the calendar invite along with the agenda.",
      "Just checking in on the below — any update on Tuesday vs Thursday? Happy to move things around if needed.",
    ],
  },
  {
    from: { name: "Marcus Feld", email: "marcus@feldroth.com" },
    subject: "Vendor agreement with Northwind — approval required",
    bodies: [
      "Hello, please find the revised vendor agreement with Northwind attached. We need your sign-off before Friday, and this approval is a decision only Daniel should make. This one is time-sensitive, so nothing else is needed from your side at this stage.",
    ],
  },
  {
    from: { name: "Tech Weekly Digest", email: "digest@techweekly.io" },
    subject: "Your Monday briefing: 10 stories worth your time",
    bodies: [
      "This is an automated email digest — please do not reply to this message. You're receiving this newsletter because you subscribed at Tech Weekly. Manage your preferences or unsubscribe at any time.",
    ],
  },
  {
    from: { name: "Elena Whitmore", email: "elena.w@gmail.com" },
    subject: "Dinner on Saturday?",
    bodies: [
      "Hi Daniel, dinner this Saturday at 8pm at Franco's — just the two of us to celebrate Mom's birthday. Let me know if that works for you!",
    ],
  },
  {
    from: { name: "Orion Supplies — Billing", email: "billing@orionsupplies.com" },
    subject: "Invoice #4471 overdue — payment reminder",
    bodies: [
      "Dear team, invoice #4471 for $2,480 remains outstanding. This is a friendly reminder to process the payment at your earliest convenience; our accounts department would appreciate an update on the expected date.",
    ],
  },
  {
    from: { name: "Delta Air Travel", email: "no-reply@deltatravel.example" },
    subject: "Itinerary update: LHR → JFK on 12 Dec",
    bodies: [
      "This is an automated email confirming changes to your trip. Your flight now departs at 14:35 from Terminal 3. You are receiving this notification because a trip is registered to this address. Do not reply to this message; manage your trip online or contact support.",
    ],
  },
  {
    from: { name: "Sarah Okonkwo", email: "sarah@brightpath.vc" },
    subject: "Partnership proposal — need your thoughts",
    bodies: [
      "Daniel, I'd value your input on the Brightpath partnership before we go further. This requires your decision this week since the deadline for the term sheet is approaching. Could you share your thoughts directly?",
    ],
  },
  {
    from: { name: "Halcyon Health", email: "reception@halcyonhealth.example" },
    subject: "Annual check-up — available appointments",
    bodies: [
      "Hello, Dr. Reeves has openings for Daniel's annual check-up next month. We can arrange a morning slot on the 14th or the 21st. Please confirm which appointment to book and we'll reserve the time.",
    ],
  },
  {
    from: { name: "GitHub", email: "notifications@github.com" },
    subject: "Security alert: new sign-in to your account",
    bodies: [
      "Notification: a new sign-in to your GitHub account was detected from Berlin. If this was you, no action is needed. This automated notification was sent to keep your account secure.",
    ],
  },
  {
    from: { name: "Tom Beckett", email: "tom.beckett@halcyonprocurement.example" },
    subject: "Budget approval for the office move",
    bodies: [
      "Following up on the office move costs — could you kindly confirm whether the budget approval has been signed off? The invoice is ready whenever you are.",
    ],
  },
]

/**
 * Seeds a realistic inbox when a (simulated) mailbox is connected for the
 * first time, so the dashboard is never empty during the demo.
 */
export const seedSampleData = async (
  ownerId: Types.ObjectId | string,
  accountId: string
): Promise<{ seeded: number }> => {
  const existing = await Conversation.countDocuments({ account: accountId })
  if (existing > 0) return { seeded: 0 }

  const account = await Account.findById(accountId)
  const mailbox = { email: account?.email || "client@mailpilot.ai", name: account?.displayName }

  for (const thread of SAMPLE_THREADS) {
    for (const body of thread.bodies) {
      await ingestEmail({
        accountId,
        from: thread.from,
        to: [mailbox],
        subject: thread.subject,
        body,
      })
    }
  }

  // Give the demo inbox some realistic variation.
  await Conversation.updateMany(
    { account: accountId, classification: "no_reply", labels: "travel" },
    { isRead: true, unreadCount: 0 }
  )

  const invoice = await Conversation.findOne({
    account: accountId,
    subject: /Invoice #4471/i,
  })

  if (invoice) {
    const reply = await Email.create({
      conversation: invoice._id,
      account: accountId,
      direction: "outbound",
      from: { name: account?.displayName || "Assistant", email: account?.email || "assistant@mailpilot.ai" },
      to: [{ name: "Orion Supplies — Billing", email: "billing@orionsupplies.com" }],
      subject: `Re: ${invoice.subject}`,
      body: "Hi, thanks for the reminder. The payment run is scheduled for this week — I'll confirm the exact date as soon as it's processed and send the remittance advice.",
      receivedAt: new Date(),
      isRead: true,
    })

    invoice.messages.push(reply._id)
    invoice.status = "waiting_response"
    invoice.lastMessage = {
      from: { name: account?.displayName || "Assistant", email: account?.email || "assistant@mailpilot.ai" },
      preview: "Hi, thanks for the reminder. The payment run is scheduled for this week…",
      receivedAt: new Date(),
      direction: "outbound",
    }
    await invoice.save()
  }

  return { seeded: SAMPLE_THREADS.length }
}
