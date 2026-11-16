import { z } from "zod"
import { runJsonPrompt } from "./ai.service"
import type { MessageContext } from "./ai.service"

interface ImportantDate {
  label: string
  date?: Date
}

interface ConversationSummary {
  summary: string
  keyPoints: string[]
  importantDates: ImportantDate[]
  source: "ai" | "rules"
}

const summarySchema = z.object({
  summary: z.string().min(5).max(1500),
  keyPoints: z.array(z.string().max(300)).max(8).default([]),
  importantDates: z
    .array(z.object({ label: z.string().max(200), date: z.string().optional() }))
    .max(8)
    .default([]),
})

const DATE_RE =
  /\b(\d{4}-\d{2}-\d{2}|(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|next week|end of (the )?week|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i

const KEY_POINT_RE =
  /\b(deadline|please|confirm|asap|required|need(ed)?|action item|next step|by (monday|tuesday|wednesday|thursday|friday|tomorrow)|approval|budget|sign)\b/i

const firstSentences = (text: string, count: number): string[] =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, count)

const extractDates = (text: string): ImportantDate[] => {
  const matches = text.match(new RegExp(DATE_RE.source, "gi")) || []
  const unique = [...new Set(matches.map((m) => m.toLowerCase()))]

  return unique.slice(0, 5).map((match) => {
    const parsed = Date.parse(match)
    return Number.isNaN(parsed) ? { label: match } : { label: match, date: new Date(parsed) }
  })
}

const summarizeWithRules = (subject: string, messages: MessageContext[]): ConversationSummary => {
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound")
  const focus = lastInbound || messages[messages.length - 1]
  const allText = messages.map((m) => m.body).join(" ")

  const lead = focus ? firstSentences(focus.body, 2).join(" ") : ""
  const summary = `${messages.length} message${messages.length === 1 ? "" : "s"} in "${subject}". ${
    focus ? `${focus.from} wrote: ${lead}` : "No messages yet."
  }`
    .replace(/\s+/g, " ")
    .slice(0, 400)

  const keyPoints =
    focus
      ? firstSentences(focus.body, 6)
          .filter((sentence) => KEY_POINT_RE.test(sentence))
          .slice(0, 4)
          .map((sentence) => sentence.slice(0, 250))
      : []

  return {
    summary,
    keyPoints: keyPoints.length ? keyPoints : firstSentences(focus?.body || "", 2).map((s) => s.slice(0, 250)),
    importantDates: extractDates(allText),
    source: "rules",
  }
}

export const summarizeConversation = async (
  subject: string,
  messages: MessageContext[]
): Promise<ConversationSummary> => {
  const history = messages
    .map((m) => `[${m.direction.toUpperCase()}] ${m.from}:\n${m.body.slice(0, 1500)}`)
    .join("\n\n---\n\n")

  const prompt = `Summarize this email conversation for a personal assistant.

Return strict JSON:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["max 4 short bullet points with the important facts, requests and deadlines"],
  "importantDates": [{ "label": "what happens", "date": "YYYY-MM-DD or omit" }]
}

Subject: ${subject}

${history}`

  const parsed = summarySchema.safeParse(await runJsonPrompt(prompt))

  if (parsed.success) {
    return {
      summary: parsed.data.summary,
      keyPoints: parsed.data.keyPoints,
      importantDates: parsed.data.importantDates.map((item) => ({
        label: item.label,
        date: item.date && !Number.isNaN(Date.parse(item.date)) ? new Date(item.date) : undefined,
      })),
      source: "ai",
    }
  }

  return summarizeWithRules(subject, messages)
}
