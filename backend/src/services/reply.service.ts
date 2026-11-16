import { z } from "zod"
import { runJsonPrompt } from "./ai.service"
import type { MessageContext } from "./ai.service"
import type { ConversationLabel, ReplyClassification } from "../models/conversation.model"

type ReplyTone = "professional" | "friendly" | "formal"

interface DraftReplyResult {
  body: string
  source: "ai" | "rules"
}

const draftSchema = z.object({ body: z.string().min(10).max(8000) })

const firstName = (nameOrEmail: string): string => {
  const cleaned = nameOrEmail.split("@")[0].replace(/[._-]+/g, " ").trim()
  return cleaned.split(" ")[0] || "there"
}

const draftWithRules = (params: {
  labels: ConversationLabel[]
  tone?: ReplyTone
  instructions?: string
  senderName?: string
  clientName?: string
  classification?: ReplyClassification
}): DraftReplyResult => {
  const { labels, tone = "professional", instructions, senderName, clientName, classification } = params
  const greeting =
    tone === "formal"
      ? `Dear ${senderName || "Sir/Madam"},`
      : `Hi ${firstName(senderName || "there")},`

  let body: string

  if (classification === "client_reply") {

    body = `Thanks for reaching out. I've passed this straight to ${firstName(
      clientName || "the principal"
    )}, who will come back to you personally with a response.`
  } else if (labels.includes("meeting")) {
    body = `I'd be happy to arrange this. I have availability and will coordinate a suitable time, then send over a calendar invitation to confirm.`
  } else if (labels.includes("approval")) {
    body = `I'm following up to confirm the next step once the review is complete. Please let me know your decision and I'll take it from there.`
  } else if (labels.includes("follow_up") || labels.includes("finance")) {
    body = `I wanted to follow up on this and make sure nothing is outstanding on our side. I'll keep this on my radar until it's resolved.`
  } else {
    body = `I wanted to get back to you with a quick update and confirm the next steps. Nothing further is needed from you at this moment unless I hear otherwise.`
  }

  if (instructions) body += `\n\n${instructions}`

  const signOff =
    tone === "formal" ? "Yours sincerely," : tone === "friendly" ? "Best," : "Best regards,"

  return {
    body: [greeting, "", body, "", signOff, "The Office of the Assistant"]
      .join("\n")
      .trim(),
    source: "rules",
  }
}

export const draftReply = async (params: {
  subject: string
  messages: MessageContext[]
  labels: ConversationLabel[]
  tone?: ReplyTone
  instructions?: string
  senderName?: string
  assistantName?: string
  clientName?: string
  classification?: ReplyClassification
}): Promise<DraftReplyResult> => {
  const {
    subject,
    messages,
    labels,
    tone = "professional",
    instructions,
    assistantName,
    clientName,
    classification,
  } = params

  const history = messages
    .slice(-6)
    .map((m) => `[${m.direction.toUpperCase()}] ${m.from}:\n${m.body.slice(0, 1000)}`)
    .join("\n\n---\n\n")

  const prompt = `You are an email assistant working for a personal assistant who manages a client's inbox.

Draft a reply to the email conversation below.
- Tone: ${tone}
- Send as: ${assistantName || "the assistant"}
- Reply responsibility: ${classification || "assistant_reply"}${
    classification === "client_reply"
      ? ` — acknowledge the message and make clear that ${clientName || "the client"} will respond personally; do NOT answer the substantive question.`
      : ""
  }
- ${instructions ? `Extra instruction: ${instructions}` : "No extra instructions."}
- Keep it under 130 words, professional and ready to send.
- Do not invent commitments, dates or prices.

Return strict JSON: { "body": "the draft reply" }

Conversation:
Subject: ${subject}
Labels: ${labels.join(", ") || "general"}

${history}`

  const parsed = draftSchema.safeParse(await runJsonPrompt(prompt))

  if (parsed.success) {
    return { body: parsed.data.body.trim(), source: "ai" }
  }

  return draftWithRules({
    labels,
    tone,
    instructions,
    senderName: params.senderName,
    clientName,
    classification,
  })
}
