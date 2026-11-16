import mongoose, { Schema, Document, Types } from "mongoose"
import {
  REPLY_CLASSIFICATIONS,
  CONVERSATION_STATUSES,
  CLIENT_ACTIONS,
} from "../validators/email.validator"
import type { IEmailParticipant, EmailDirection } from "./email.model"

export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number]
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]
export type ClientAction = (typeof CLIENT_ACTIONS)[number]
export type ClassificationSource = "ai" | "rules" | "manual"

export const CONVERSATION_LABELS = [
  "meeting",
  "important",
  "follow_up",
  "approval",
  "finance",
  "travel",
  "personal",
  "general",
] as const

export type ConversationLabel = (typeof CONVERSATION_LABELS)[number]

export interface IImportantDate {
  label: string
  date?: Date
}

export interface IConversation extends Document {
  _id: Types.ObjectId
  account: Types.ObjectId
  owner: Types.ObjectId
  subject: string
  subjectKey: string
  participants: IEmailParticipant[]
  messages: Types.ObjectId[]
  /** AI reply-responsibility classification. */
  classification: ReplyClassification
  classificationReason: string
  classificationConfidence: number
  classificationSource: ClassificationSource
  labels: ConversationLabel[]
  aiSummary?: string
  keyPoints: string[]
  importantDates: IImportantDate[]
  status: ConversationStatus
  /** Client-facing decision: handled personally or handed back to the assistant. */
  clientAction: ClientAction
  isImportant: boolean
  isRead: boolean
  isArchived: boolean
  unreadCount: number
  lastMessage?: {
    from: IEmailParticipant
    preview: string
    receivedAt: Date
    direction: EmailDirection
  }
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const conversationSchema = new Schema<IConversation>(
  {
    account: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    subjectKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    participants: [
      {
        _id: false,
        name: { type: String, trim: true, maxlength: 120 },
        email: { type: String, required: true, lowercase: true, trim: true },
      },
    ],
    messages: [{ type: Schema.Types.ObjectId, ref: "Email" }],

    classification: {
      type: String,
      enum: REPLY_CLASSIFICATIONS,
      default: "needs_review",
      index: true,
    },
    classificationReason: { type: String, default: "", maxlength: 600 },
    classificationConfidence: { type: Number, default: 0, min: 0, max: 1 },
    classificationSource: {
      type: String,
      enum: ["ai", "rules", "manual"],
      default: "rules",
    },

    labels: [{ type: String, enum: CONVERSATION_LABELS }],
    aiSummary: { type: String, maxlength: 2000 },
    keyPoints: [{ type: String, maxlength: 400 }],
    importantDates: [
      {
        _id: false,
        label: { type: String, required: true, maxlength: 200 },
        date: { type: Date },
      },
    ],

    status: { type: String, enum: CONVERSATION_STATUSES, default: "open", index: true },
    clientAction: { type: String, enum: CLIENT_ACTIONS, default: "pending" },

    isImportant: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    unreadCount: { type: Number, default: 0, min: 0 },

    lastMessage: {
      from: {
        name: { type: String, trim: true, maxlength: 120 },
        email: { type: String, lowercase: true, trim: true },
      },
      preview: { type: String, maxlength: 400 },
      receivedAt: { type: Date },
      direction: { type: String, enum: ["inbound", "outbound"] },
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

conversationSchema.index({ owner: 1, isArchived: 1, lastMessageAt: -1 })
conversationSchema.index({ owner: 1, classification: 1, clientAction: 1 })

export default mongoose.model<IConversation>("Conversation", conversationSchema)
