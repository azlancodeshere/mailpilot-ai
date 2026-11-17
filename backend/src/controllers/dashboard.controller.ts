import type { Request, Response } from "express"
import Account from "../models/account.model"
import Conversation from "../models/conversation.model"
import Email from "../models/email.model"
import { ApiResponse } from "../utils/ApiResponse"
import { countSegments } from "../services/email.service"

export const getStats = async (req: Request, res: Response): Promise<void> => {
  const ownerId = req.user!._id

  const accounts = await Account.find({ owner: ownerId }).sort({ connectedAt: -1 })
  const accountIds = accounts.map((account) => account._id)

  const attentionSelect =
    "subject classification classificationReason classificationConfidence status clientAction isImportant unreadCount participants lastMessage lastMessageAt labels aiSummary"

  const [segments, totalEmails, unreadEmails, conversations, unreadConversations, recent, meetings, attention] =
    await Promise.all([
      countSegments(ownerId),
      Email.countDocuments({ account: { $in: accountIds } }),
      Email.countDocuments({ account: { $in: accountIds }, direction: "inbound", isRead: false }),
      Conversation.countDocuments({ owner: ownerId, isArchived: false }),
      Conversation.countDocuments({ owner: ownerId, isArchived: false, unreadCount: { $gt: 0 } }),
      Conversation.find({ owner: ownerId, isArchived: false })
        .sort({ lastMessageAt: -1 })
        .limit(8)
        .select(
          "subject classification classificationReason classificationConfidence status clientAction isImportant unreadCount participants lastMessage lastMessageAt labels aiSummary"
        ),
      Conversation.find({ owner: ownerId, isArchived: false, labels: "meeting" })
        .sort({ lastMessageAt: -1 })
        .limit(5)
        .select("subject classification status participants importantDates lastMessage lastMessageAt"),
      Conversation.find({
        owner: ownerId,
        isArchived: false,
        status: "open",
        classification: { $in: ["assistant_reply", "needs_review"] },
      })
        .sort({ lastMessageAt: -1 })
        .limit(4)
        .select(attentionSelect),
    ])

  const lastSyncedAt = accounts
    .map((account) => account.lastSyncedAt)
    .filter(Boolean)
    .sort((a, b) => (b?.getTime?.() || 0) - (a?.getTime?.() || 0))[0]

  res.status(200).json(
    new ApiResponse(200, {
      totals: {
        emails: totalEmails,
        unreadEmails,
        conversations,
        unreadConversations,
        important: segments.important || 0,
        actionRequired: segments.action_required || 0,
        waitingResponse: segments.waiting || 0,
        assistantToReply: segments.assistant || 0,
        clientToReply: segments.client || 0,
        noReplyNeeded: segments.no_reply || 0,
        needsReview: segments.review || 0,
      },
      segments,
      byClassification: [
        { key: "assistant_reply", label: "Assistant to reply", count: segments.assistant || 0 },
        { key: "client_reply", label: "Client to reply", count: segments.client || 0 },
        { key: "no_reply", label: "No reply needed", count: segments.no_reply || 0 },
        { key: "needs_review", label: "Needs review", count: segments.review || 0 },
      ],
      accounts,
      sync: {
        anySyncing: accounts.some((account) => account.status === "syncing"),
        lastSyncedAt: lastSyncedAt || null,
      },
      recentConversations: recent,
      upcomingMeetings: meetings,
      attentionQueue: attention,
    })
  )
}
