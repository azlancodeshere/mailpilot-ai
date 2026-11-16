import { z } from "zod"

export const REPLY_CLASSIFICATIONS = [
  "assistant_reply",
  "client_reply",
  "no_reply",
  "needs_review",
] as const

export const CONVERSATION_STATUSES = ["open", "waiting_response", "completed"] as const

export const CLIENT_ACTIONS = ["pending", "handled", "delegated"] as const

export const SEGMENTS = [
  "all",
  "assistant",
  "client",
  "no_reply",
  "review",
  "action_required",
  "waiting",
  "meetings",
  "important",
  "general",
  "unread",
] as const

export const listConversationsSchema = z.object({
  segment: z.enum(SEGMENTS).optional(),
  accountId: z.string().optional(),
  status: z.enum(CONVERSATION_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  includeArchived: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const updateConversationSchema = z
  .object({
    classification: z.enum(REPLY_CLASSIFICATIONS).optional(),
    reason: z.string().trim().min(3).max(500).optional(),
    isImportant: z.boolean().optional(),
    isRead: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    status: z.enum(CONVERSATION_STATUSES).optional(),
    clientAction: z.enum(CLIENT_ACTIONS).optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field is required" }
  )

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Reply body cannot be empty").max(10000),

  approved: z.boolean().optional(),
  source: z.enum(["ai", "manual"]).default("manual"),
})

export const ingestEmailSchema = z.object({
  accountId: z.string().min(1, "Account id is required"),
  from: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.email(),
  }),
  to: z
    .array(z.object({ name: z.string().optional(), email: z.email() }))
    .optional(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  receivedAt: z.iso.datetime().optional(),
})

export const connectAccountSchema = z.object({
  provider: z.enum(["gmail", "outlook"]),
  email: z.email(),
  displayName: z.string().trim().min(1).max(120).optional(),
})

export const askSchema = z.object({
  question: z.string().trim().min(3, "Ask a question about your inbox").max(500),
  conversationId: z.string().optional(),
})

export const draftReplySchema = z.object({
  tone: z.enum(["professional", "friendly", "formal"]).default("professional"),
  instructions: z.string().trim().max(500).optional(),
})

export type ListConversationsQuery = z.infer<typeof listConversationsSchema>
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type IngestEmailInput = z.infer<typeof ingestEmailSchema>
export type ConnectAccountInput = z.infer<typeof connectAccountSchema>
export type AskInput = z.infer<typeof askSchema>
export type DraftReplyInput = z.infer<typeof draftReplySchema>
