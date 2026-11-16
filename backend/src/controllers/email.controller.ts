import type { Request, Response } from "express"
import type { Types } from "mongoose"
import Conversation from "../models/conversation.model"
import Email from "../models/email.model"
import Account from "../models/account.model"
import { ApiError } from "../utils/ApiError"
import { ApiResponse } from "../utils/ApiResponse"
import {
  listConversations,
  getConversationDetail,
  countSegments,
  ingestEmail,
  sendReplyMessage,
  SEGMENT_META,
} from "../services/email.service"
import type {
  ListConversationsQuery,
  UpdateConversationInput,
  SendMessageInput,
  IngestEmailInput,
} from "../validators/email.validator"

const findOwnedConversation = async (
  id: string | string[],
  ownerId: Types.ObjectId | string
): Promise<import("../models/conversation.model").IConversation> => {
  const conversationId = Array.isArray(id) ? id[0] : id
  const conversation = await Conversation.findOne({ _id: conversationId, owner: ownerId })
  if (!conversation) throw new ApiError(404, "Conversation not found")
  return conversation
}

export const listConversationsHandler = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ListConversationsQuery

  const result = await listConversations({
    ownerId: req.user!._id,
    segment: query.segment,
    accountId: query.accountId,
    status: query.status,
    q: query.q,
    includeArchived: query.includeArchived,
    page: query.page,
    limit: query.limit,
  })

  res.status(200).json(new ApiResponse(200, result, "Conversations fetched"))
}

/** Minimal client-facing list: only conversations waiting on the client. */
export const listClientInbox = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ListConversationsQuery

  const result = await listConversations({
    ownerId: req.user!._id,
    clientView: true,
    page: query.page,
    limit: query.limit,
  })

  res.status(200).json(
    new ApiResponse(200, result, "Conversations requiring the client's attention fetched")
  )
}

export const listSegments = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as { accountId?: string }
  const counts = await countSegments(req.user!._id, query.accountId)

  res.status(200).json(
    new ApiResponse(200, {
      segments: SEGMENT_META.map((segment) => ({ ...segment, count: counts[segment.key] || 0 })),
    })
  )
}

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  const { conversation, messages } = await getConversationDetail(
    req.params.id as string,
    req.user!._id
  )

  res.status(200).json(new ApiResponse(200, { conversation, messages }, "Conversation fetched"))
}

/**
 * Updates flags, status, client actions and — importantly — lets the
 * assistant manually correct the AI classification.
 */
export const updateConversationHandler = async (req: Request, res: Response): Promise<void> => {
  const conversation = await findOwnedConversation(req.params.id, req.user!._id)

  const { classification, reason, isImportant, isRead, isArchived, status, clientAction } =
    req.body as UpdateConversationInput

  if (classification) {
    conversation.classification = classification
    conversation.classificationReason =
      reason || "Manually corrected by the assistant"
    conversation.classificationSource = "manual"
    conversation.classificationConfidence = 1
  }

  if (isImportant !== undefined) conversation.isImportant = isImportant

  if (isRead !== undefined) {
    conversation.isRead = isRead
    conversation.unreadCount = isRead ? 0 : Math.max(1, conversation.unreadCount)
    await Email.updateMany(
      { _id: { $in: conversation.messages } },
      { isRead }
    )
  }

  if (isArchived !== undefined) conversation.isArchived = isArchived
  if (status !== undefined) conversation.status = status

  if (clientAction !== undefined) {
    conversation.clientAction = clientAction

    if (clientAction === "handled") {
      conversation.status = "completed"
    } else if (clientAction === "delegated") {
      conversation.classification = "assistant_reply"
      conversation.classificationReason =
        "Client reviewed it and asked the assistant to take over"
      conversation.classificationSource = "manual"
      conversation.classificationConfidence = 1
      conversation.status = "open"
    } else {
      conversation.status = "open"
    }
  }

  await conversation.save()

  res.status(200).json(new ApiResponse(200, { conversation }, "Conversation updated"))
}

export const sendReply = async (req: Request, res: Response): Promise<void> => {
  const { body, approved, source } = req.body as SendMessageInput
  const conversation = await findOwnedConversation(req.params.id, req.user!._id)

  // AI drafts must always be reviewed before they can go out.
  if (source === "ai" && !approved) {
    throw new ApiError(400, "AI-generated replies must be reviewed and approved before sending")
  }

  const account = await Account.findById(conversation.account)
  const ownEmail = account?.email || ""

  const recipients = conversation.participants.filter(
    (participant) => participant.email !== ownEmail
  )

  const message = await sendReplyMessage(conversation, {
    from: { name: account?.displayName || req.user!.username, email: ownEmail || req.user!.email },
    to: recipients.length ? recipients : [{ email: ownEmail }],
    body,
  })

  res.status(201).json(
    new ApiResponse(201, { message, conversation }, "Reply sent and conversation is now waiting for a response")
  )
}

/** Simulates a newly received email arriving in the connected mailbox. */
export const ingestEmailHandler = async (req: Request, res: Response): Promise<void> => {
  const input = req.body as IngestEmailInput

  const account = await Account.findOne({ _id: input.accountId, owner: req.user!._id })
  if (!account) throw new ApiError(404, "Connected email account not found")

  const conversation = await ingestEmail(input)

  res.status(201).json(
    new ApiResponse(
      201,
      {
        conversation,
        classification: {
          classification: conversation.classification,
          reason: conversation.classificationReason,
          confidence: conversation.classificationConfidence,
          source: conversation.classificationSource,
        },
      },
      "New email received and classified automatically"
    )
  )
}
