import mongoose, { Schema, Document, Types } from "mongoose"

export type AccountProvider = "gmail" | "outlook"
export type AccountStatus = "connected" | "syncing" | "error"

export interface IAccount extends Document {
  _id: Types.ObjectId
  owner: Types.ObjectId
  provider: AccountProvider
  email: string
  displayName?: string
  status: AccountStatus
  isConnected: boolean

  connectionMode: "simulated" | "live"
  lastSyncedAt?: Date
  lastSyncMessage?: string
  connectedAt: Date
  createdAt: Date
  updatedAt: Date
}

const accountSchema = new Schema<IAccount>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["gmail", "outlook"], required: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    displayName: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ["connected", "syncing", "error"], default: "connected" },
    isConnected: { type: Boolean, default: true },
    connectionMode: { type: String, enum: ["simulated", "live"], default: "simulated" },
    lastSyncedAt: { type: Date },
    lastSyncMessage: { type: String, maxlength: 300 },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

accountSchema.index({ owner: 1, provider: 1, email: 1 }, { unique: true })

export default mongoose.model<IAccount>("Account", accountSchema)
