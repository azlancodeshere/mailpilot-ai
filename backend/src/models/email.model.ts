import mongoose, { Schema, Document, Types } from "mongoose"

export type EmailDirection = "inbound" | "outbound"

export interface IEmailParticipant {
  name?: string
  email: string
}

export interface IEmail extends Document {
  _id: Types.ObjectId
  conversation: Types.ObjectId
  account: Types.ObjectId
  direction: EmailDirection
  from: IEmailParticipant
  to: IEmailParticipant[]
  subject: string
  body: string
  receivedAt: Date
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

const emailSchema = new Schema<IEmail>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    account: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    from: {
      name: { type: String, trim: true, maxlength: 120 },
      email: { type: String, required: true, lowercase: true, trim: true },
    },
    to: [
      {
        _id: false,
        name: { type: String, trim: true, maxlength: 120 },
        email: { type: String, required: true, lowercase: true, trim: true },
      },
    ],
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, required: true, trim: true },
    receivedAt: { type: Date, required: true, default: Date.now, index: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
)

emailSchema.index({ account: 1, isRead: 1, direction: 1 })

export default mongoose.model<IEmail>("Email", emailSchema)
