import type { Request, Response } from "express"
import Account from "../models/account.model"
import Conversation from "../models/conversation.model"
import Email from "../models/email.model"
import { ApiError } from "../utils/ApiError"
import { ApiResponse } from "../utils/ApiResponse"
import { seedSampleData, countSegments } from "../services/email.service"
import type { ConnectAccountInput } from "../validators/email.validator"

export const listAccounts = async (req: Request, res: Response): Promise<void> => {
  const accounts = await Account.find({ owner: req.user!._id }).sort({ connectedAt: -1 })

  res.status(200).json(new ApiResponse(200, { accounts }, "Connected accounts fetched"))
}

/**
 * Simulated OAuth connection: creates the account and seeds a realistic
 * sample inbox so the dashboard is usable immediately in the prototype.
 */
export const connectAccount = async (req: Request, res: Response): Promise<void> => {
  const { provider, email, displayName } = req.body as ConnectAccountInput
  const owner = req.user!._id

  const existing = await Account.findOne({ owner, email })
  if (existing) throw new ApiError(409, "This mailbox is already connected")

  const account = await Account.create({
    owner,
    provider,
    email,
    displayName: displayName || email.split("@")[0],
    status: "connected",
    isConnected: true,
    connectionMode: "simulated",
    lastSyncedAt: new Date(),
    lastSyncMessage: "Authorization complete (simulated OAuth)",
  })

  const { seeded } = await seedSampleData(owner, account._id.toString())

  res.status(201).json(
    new ApiResponse(
      201,
      {
        account,
        seeded,
        authorization: {
          mode: "simulated",
          message: `Simulated ${provider === "gmail" ? "Google" : "Microsoft"} authorization completed.`,
        },
      },
      "Mailbox connected successfully"
    )
  )
}

export const getAccount = async (req: Request, res: Response): Promise<void> => {
  const account = await Account.findOne({ _id: req.params.id, owner: req.user!._id })

  if (!account) throw new ApiError(404, "Connected account not found")

  const [conversations, unreadMessages, segments] = await Promise.all([
    Conversation.countDocuments({ account: account._id, isArchived: false }),
    Email.countDocuments({ account: account._id, direction: "inbound", isRead: false }),
    countSegments(req.user!._id, account._id.toString()),
  ])

  res.status(200).json(
    new ApiResponse(200, { account, stats: { conversations, unreadMessages, segments } })
  )
}

/** Simulated inbox synchronization with a visible syncing state. */
export const syncAccount = async (req: Request, res: Response): Promise<void> => {
  const account = await Account.findOne({ _id: req.params.id, owner: req.user!._id })

  if (!account) throw new ApiError(404, "Connected account not found")

  if (account.status === "syncing") {
    throw new ApiError(409, "A sync is already in progress for this mailbox")
  }

  account.status = "syncing"
  account.lastSyncMessage = "Fetching new messages…"
  await account.save()

  await new Promise((resolve) => setTimeout(resolve, 900))

  account.status = "connected"
  account.lastSyncedAt = new Date()
  account.lastSyncMessage = "Sync complete — no new messages"
  await account.save()

  res.status(200).json(new ApiResponse(200, { account }, "Inbox synchronized"))
}

export const disconnectAccount = async (req: Request, res: Response): Promise<void> => {
  const account = await Account.findOne({ _id: req.params.id, owner: req.user!._id })

  if (!account) throw new ApiError(404, "Connected account not found")

  const conversations = await Conversation.find({ account: account._id }).select("_id")
  const conversationIds = conversations.map((conversation) => conversation._id)

  await Promise.all([
    Email.deleteMany({ account: account._id }),
    Conversation.deleteMany({ account: account._id }),
    account.deleteOne(),
  ])

  res.status(200).json(
    new ApiResponse(
      200,
      { accountId: req.params.id, removedConversations: conversationIds.length },
      "Mailbox disconnected and its data removed"
    )
  )
}
