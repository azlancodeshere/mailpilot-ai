import type { Request, Response } from "express"
import type { Types } from "mongoose"
import Conversation from "../models/conversation.model"
import Account from "../models/account.model"
import { ApiError } from "../utils/ApiError"
import { ApiResponse } from "../utils/ApiResponse"
import {
  classifyConversation,
  answerQuestion,
  type InboxSnapshotItem,
  type MessageContext,
} from "../services/ai.service"
import { summarizeConversation } from "../services/summary.service"
import { draftReply } from "../services/reply.service"
import {
  loadMessages,
  toMessageContext,
  applyClassification,
} from "../services/email.service"
import type { AskInput, DraftReplyInput } from "../validators/email.validator"

const findOwnedConversation = async (
  id: string | string[],
  ownerId: Types.ObjectId | string
): Promise<import("../models/conversation.model").IConversation> => {
  const conversationId = Array.isArray(id) ? id[0] : id
  const conversation = await Conversation.findOne({ _id: conversationId, owner: ownerId })
  if (!conversation) throw new ApiError(404, "Conversation not found")
  return conversation
}

export const summarize = async (req: Request, res: Response): Promise<void> => {
  const conversation = await findOwnedConversation(req.params.id, req.user!._id)

  const messages = await loadMessages(conversation)
  const summary = await summarizeConversation(conversation.subject, toMessageContext(messages))

  conversation.aiSummary = summary.summary
  conversation.keyPoints = summary.keyPoints
  conversation.importantDates = summary.importantDates
  await conversation.save()

  res.status(200).json(
    new ApiResponse(200, { summary, conversation }, "Conversation summarized")
  )
}

export const reclassify = async (req: Request, res: Response): Promise<void> => {
  const conversation = await findOwnedConversation(req.params.id, req.user!._id)

  const [messages, account] = await Promise.all([
    loadMessages(conversation),
    Account.findById(conversation.account),
  ])

  const result = await classifyConversation({
    subject: conversation.subject,
    messages: toMessageContext(messages),
    clientName: account?.displayName,
  })

  applyClassification(conversation, result)
  await conversation.save()

  res.status(200).json(
    new ApiResponse(200, { classification: result, conversation }, "Conversation reclassified")
  )
}

export const draft = async (req: Request, res: Response): Promise<void> => {
  const { tone, instructions } = req.body as DraftReplyInput
  const conversation = await findOwnedConversation(req.params.id, req.user!._id)

  const [messages, account] = await Promise.all([
    loadMessages(conversation),
    Account.findById(conversation.account),
  ])

  const context: MessageContext[] = toMessageContext(messages)
  const lastInbound = [...context].reverse().find((message) => message.direction === "inbound")

  const result = await draftReply({
    subject: conversation.subject,
    messages: context,
    labels: conversation.labels,
    tone,
    instructions,
    senderName: lastInbound?.from,
    assistantName: req.user!.username,
    clientName: account?.displayName,
    classification: conversation.classification,
  })

  res.status(200).json(
    new ApiResponse(200, result, "Draft prepared — review it before sending")
  )
}

export const ask = async (req: Request, res: Response): Promise<void> => {
  const { question, conversationId } = req.body as AskInput

  const conversations = await Conversation.find({ owner: req.user!._id, isArchived: false })
    .sort({ lastMessageAt: -1 })
    .limit(40)

  const snapshot: InboxSnapshotItem[] = conversations.map((conversation) => ({
    id: conversation._id.toString(),
    subject: conversation.subject,
    from: conversation.lastMessage?.from?.email || conversation.participants[0]?.email || "unknown",
    classification: conversation.classification,
    status: conversation.status,
    reason: conversation.classificationReason,
    summary: conversation.aiSummary,
    labels: conversation.labels,
    clientAction: conversation.clientAction,
    isImportant: conversation.isImportant,
  }))

  let conversationContext: { subject: string; summary?: string; messages: MessageContext[] } | undefined

  if (conversationId) {
    const conversation = await findOwnedConversation(conversationId, req.user!._id)
    const messages = await loadMessages(conversation)

    conversationContext = {
      subject: conversation.subject,
      summary: conversation.aiSummary,
      messages: toMessageContext(messages),
    }
  }

  const { answer, source } = await answerQuestion(question, snapshot, conversationContext)

  res.status(200).json(new ApiResponse(200, { answer, source }, "Answer ready"))
}
