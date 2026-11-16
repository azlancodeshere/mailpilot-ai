import { GoogleGenAI } from "@google/genai"
import { z } from "zod"
import env from "../config/env"
import { REPLY_CLASSIFICATIONS } from "../validators/email.validator"
import type {
  ReplyClassification,
  ClientAction,
  ConversationLabel,
} from "../models/conversation.model"

const MODEL = "gemini-2.5-flash"

let client: GoogleGenAI | null = null

const getClient = (): GoogleGenAI | null => {
  if (!env.GEMINI_API_KEY) return null

  if (!client) {
    client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: { timeout: 8000 },
    })
  }

  return client
}

/** Calls Gemini with a JSON response mime type; returns null when unavailable. */
export const runJsonPrompt = async (prompt: string): Promise<unknown | null> => {
  const ai = getClient()
  if (!ai) return null

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    })

    const text = response.text?.trim()
    if (!text) return null

    return JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[AI] Gemini call failed, using rule-based fallback: ${message}`)
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

export interface MessageContext {
  from: string
  direction: "inbound" | "outbound"
  body: string
}

export interface ClassificationContext {
  subject: string
  messages: MessageContext[]
  clientName?: string
}

const classificationSchema = z.object({
  classification: z.enum(REPLY_CLASSIFICATIONS),
  reason: z.string().min(3).max(600),
  confidence: z.number().min(0).max(1).optional(),
  labels: z
    .array(
      z.enum([
        "meeting",
        "important",
        "follow_up",
        "approval",
        "finance",
        "travel",
        "personal",
        "general",
      ])
    )
    .optional(),
})

export interface ClassificationResult {
  classification: ReplyClassification
  reason: string
  confidence: number
  labels: ConversationLabel[]
  source: "ai" | "rules"
}

const buildClassificationPrompt = (ctx: ClassificationContext): string => {
  const history = ctx.messages
    .map((m) => `[${m.direction.toUpperCase()}] ${m.from}:\n${m.body.slice(0, 1500)}`)
    .join("\n\n---\n\n")

  return `You are the AI brain of "MailPilot AI", a tool that helps a personal assistant manage a client's inbox.

Determine who must respond to this email conversation:
- "assistant_reply": the personal assistant should reply (scheduling, routine inquiries, follow-ups, administrative work).
- "client_reply": the client must reply personally (approvals, decisions, sensitive or personal matters, messages explicitly asking for the client's input).
- "no_reply": no response is needed (newsletters, notifications, FYI updates, resolved threads).
- "needs_review": you are not confident enough; a human should decide.

Rules:
- Consider the whole conversation history, not only the last message.
- Do NOT classify every email as needing a reply; prefer "no_reply" for informational mail.
- The client is: ${ctx.clientName || "the owner of this inbox"}.
- Also suggest labels: meeting, important, follow_up, approval, finance, travel, personal, general.
- Give a short, specific reason (max 25 words) explaining WHY responsibility was assigned.
- confidence is between 0 and 1.

Return strict JSON: { "classification": "...", "reason": "...", "confidence": 0.0, "labels": ["..."] }

Conversation:
Subject: ${ctx.subject}

${history}`
}

const KEYWORDS: Record<"assistant" | "client" | "noReply", RegExp> = {
  assistant:
    /\b(schedul\w+|reschedul\w+|appointment|calendar|availability|available slot|free (at|on|for)|book\w*|booking|arrange\w*|coordinate\w*|invoice|payment|billing|purchase order|form\w*|paperwork|admin\w*|follow[- ]?up|reminder|any update|shall i|can you please|kindly|logistics|itinerary|confirm (the|our) (time|slot|meeting)|move (the )?(meeting|call)|prepone|postpone)\b/i,
  client:
    /\b(your approval|approve\w*|approval|sign[- ]?off|authorization|your (thoughts|input|decision|view|call|feedback)|please (confirm|review) (personally|directly)|need your|requires? your|as per your|confidential|sensitive|contract|agreement|negotiat\w*|partnership|equity|shareholder|legal|lawsuit|termination|personal|family|dinner|birthday|anniversary|wedding|urgent matter|directly to you|speak (with|to) you|discuss with you)\b/i,
  noReply:
    /\b(newsletter|unsubscribe|no[- ]?reply|do not reply|automated (email|message|notification)|notification|receipt|invoice attached for your records|fyi|for your information|heads[- ]?up|announcement|digest|weekly update|your (order|booking) (has been|was) (confirmed|updated)|ticket (has been )?(created|closed)|security alert|password)\b/i,
}

const MEETING_RE =
  /\b(schedul\w+|reschedul\w+|meeting|appointment|calendar|call|sync|interview|booking|reservation|availability|slot|zoom|invite)\b/i
const IMPORTANT_RE = /\b(urgent|asap|deadline|immediately|critical|time[- ]?sensitive|priority)\b/i
const APPROVAL_RE = /\b(approv\w+|sign[- ]?off|authoriz\w+|go[- ]?ahead|confirmation needed)\b/i
const FOLLOW_UP_RE = /\b(follow[- ]?up|checking in|any update|still waiting|pending|outstanding|overdue)\b/i
const FINANCE_RE = /\b(invoice|payment|billing|quote|receipt|purchase order|expense|payroll)\b/i
const TRAVEL_RE = /\b(flight|itinerary|hotel|boarding|airport|travel|visa|trip)\b/i
const PERSONAL_RE = /\b(dinner|birthday|anniversary|family|personal|wedding|holiday)\b/i

const detectLabels = (subject: string, body: string): ConversationLabel[] => {
  const text = `${subject}\n${body}`
  const labels: ConversationLabel[] = []

  if (MEETING_RE.test(text)) labels.push("meeting")
  if (IMPORTANT_RE.test(text)) labels.push("important")
  if (APPROVAL_RE.test(text)) labels.push("approval")
  if (FOLLOW_UP_RE.test(text)) labels.push("follow_up")
  if (FINANCE_RE.test(text)) labels.push("finance")
  if (TRAVEL_RE.test(text)) labels.push("travel")
  if (PERSONAL_RE.test(text)) labels.push("personal")
  if (labels.length === 0) labels.push("general")

  return labels
}

/**
 * Deterministic fallback used when the LLM is unavailable, so the prototype
 * still demonstrates automatic classification end-to-end.
 */
export const classifyWithRules = (ctx: ClassificationContext): ClassificationResult => {
  const text = `${ctx.subject}\n${ctx.messages.map((m) => m.body).join("\n")}`
  const lower = text.toLowerCase()

  let assistantScore = (text.match(new RegExp(KEYWORDS.assistant.source, "gi")) || []).length
  let clientScore = (text.match(new RegExp(KEYWORDS.client.source, "gi")) || []).length
  let noReplyScore = (text.match(new RegExp(KEYWORDS.noReply.source, "gi")) || []).length

  // A direct request addressed to a named person usually needs the client.
  if (clientScore > 0 && /\b(dear|hi|hello|attention)\b/.test(lower)) {
    clientScore += 1
  }

  const scores: Array<{ classification: ReplyClassification; score: number }> = [
    { classification: "assistant_reply", score: assistantScore },
    { classification: "client_reply", score: clientScore },
    { classification: "no_reply", score: noReplyScore },
  ]
  scores.sort((a, b) => b.score - a.score)

  const [top, second] = scores
  const labels = detectLabels(ctx.subject, text)

  if (top.score === 0) {
    return {
      classification: "needs_review",
      reason: "No clear ownership signals found in this conversation.",
      confidence: 0.3,
      labels,
      source: "rules",
    }
  }

  const margin = top.score - second.score

  // Conflicting ownership signals are flagged for the assistant to review.
  if (second.score > 0 && margin <= 1) {
    return {
      classification: "needs_review",
      reason: `Mixed signals between "${top.classification}" and "${second.classification}".`,
      confidence: 0.45,
      labels,
      source: "rules",
    }
  }

  const confidence = Math.min(0.92, 0.5 + margin * 0.12 + top.score * 0.04)

  const reasonByClass: Record<ReplyClassification, string> = {
    assistant_reply:
      "Administrative/scheduling language indicates the assistant can handle the reply.",
    client_reply:
      "Contains an approval, decision or personal matter that requires the client's own response.",
    no_reply: "Informational message; no response is required from anyone.",
    needs_review: "Signals were mixed; needs a quick human decision.",
  }

  return {
    classification: top.classification,
    reason: reasonByClass[top.classification],
    confidence: Number(confidence.toFixed(2)),
    labels,
    source: "rules",
  }
}

/**
 * Classifies a conversation, preferring the Gemini LLM and falling back to
 * deterministic rules so the flow never breaks in the prototype.
 */
export const classifyConversation = async (
  ctx: ClassificationContext
): Promise<ClassificationResult> => {
  const parsed = classificationSchema.safeParse(
    await runJsonPrompt(buildClassificationPrompt(ctx))
  )

  if (parsed.success) {
    const data = parsed.data
    return {
      classification: data.classification,
      reason: data.reason,
      confidence: data.confidence ?? 0.8,
      labels: (data.labels?.length ? data.labels : detectLabels(ctx.subject, ctx.messages[0]?.body || "")) as ConversationLabel[],
      source: "ai",
    }
  }

  return classifyWithRules(ctx)
}

/* ------------------------------------------------------------------ */
/* Ask AI about the inbox                                              */
/* ------------------------------------------------------------------ */

export interface InboxSnapshotItem {
  id: string
  subject: string
  from: string
  classification: ReplyClassification
  status: string
  reason: string
  summary?: string
  labels: string[]
  clientAction: ClientAction
  isImportant: boolean
}

const buildAskPrompt = (
  question: string,
  snapshot: InboxSnapshotItem[],
  conversation?: { subject: string; summary?: string; messages: MessageContext[] }
): string => {
  const inbox = snapshot
    .map(
      (item) =>
        `- [${item.classification} | ${item.status}] "${item.subject}" from ${item.from} — ${item.reason}${
          item.summary ? ` | summary: ${item.summary}` : ""
        }${item.clientAction !== "pending" ? ` | client: ${item.clientAction}` : ""}`
    )
    .join("\n")

  const thread = conversation
    ? `\n\nSelected conversation: ${conversation.subject}\nSummary: ${
        conversation.summary || "n/a"
      }\nMessages:\n${conversation.messages
        .map((m) => `[${m.direction}] ${m.from}: ${m.body.slice(0, 800)}`)
        .join("\n")}`
    : ""

  return `You are the AI assistant inside "MailPilot AI", an email management dashboard for a personal assistant.

Answer the user's question using ONLY the data below. Be concise (max 80 words), concrete and use bullet points when listing emails. If the answer is not derivable, say so plainly.

Inbox:
${inbox || "(empty)"}
${thread}

Question: ${question}

Return strict JSON: { "answer": "your answer" }`
}

const fallbackAnswer = (
  question: string,
  snapshot: InboxSnapshotItem[]
): string => {
  const q = question.toLowerCase()
  const list = (items: InboxSnapshotItem[]): string =>
    items.length
      ? items.map((i) => `• "${i.subject}" — ${i.from}`).join("\n")
      : "• Nothing found."

  if (q.includes("client")) {
    return `Emails needing the client's attention:\n${list(
      snapshot.filter((i) => i.classification === "client_reply" && i.clientAction === "pending")
    )}`
  }

  if (q.includes("wait") || q.includes("pending") || q.includes("response")) {
    return `Conversations waiting for a response:\n${list(
      snapshot.filter((i) => i.status === "waiting_response")
    )}`
  }

  if (q.includes("meeting") || q.includes("appointment")) {
    return `Meetings and appointments found in email:\n${list(
      snapshot.filter((i) => i.labels.includes("meeting"))
    )}`
  }

  if (q.includes("attention") || q.includes("action") || q.includes("important") || q.includes("mine")) {
    return `Emails that need action:\n${list(
      snapshot.filter(
        (i) =>
          i.isImportant ||
          i.status === "open" &&
            (i.classification === "assistant_reply" || i.classification === "needs_review")
      )
    )}`
  }

  const counts = snapshot.reduce<Record<string, number>>((acc, item) => {
    acc[item.classification] = (acc[item.classification] || 0) + 1
    return acc
  }, {})

  return `Inbox overview (AI connection unavailable, showing rule-based summary):\n${Object.entries(
    counts
  )
    .map(([key, value]) => `• ${key}: ${value}`)
    .join("\n")}\nAsk about clients, waiting replies, meetings or actions for specifics.`
}

export const answerQuestion = async (
  question: string,
  snapshot: InboxSnapshotItem[],
  conversation?: { subject: string; summary?: string; messages: MessageContext[] }
): Promise<{ answer: string; source: "ai" | "rules" }> => {
  const answer = await runJsonPrompt(buildAskPrompt(question, snapshot, conversation))

  if (answer && typeof answer === "object" && answer !== null && "answer" in answer) {
    const value = (answer as { answer?: unknown }).answer
    if (typeof value === "string" && value.trim()) {
      return { answer: value.trim(), source: "ai" }
    }
  }

  return { answer: fallbackAnswer(question, snapshot), source: "rules" }
}
