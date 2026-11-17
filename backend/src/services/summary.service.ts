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
  /\b(\d{4}-\d{2}-\d{2}|(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|next week|end of (the )?week|\d{1,2}(st|nd|rd|th)|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i

const KEY_POINT_RE =
  /\b(deadline|please|confirm|asap|required|need(ed)?|action item|next step|by (monday|tuesday|wednesday|thursday|friday|tomorrow)|approval|budget|sign)\b/i

const firstSentences = (text: string, count: number): string[] =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, count)

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

const atMidday = (date: Date): Date => {
  date.setHours(12, 0, 0, 0)
  return date
}

const resolveDate = (match: string): Date | undefined => {
  const parsed = Date.parse(match)
  if (!Number.isNaN(parsed)) return new Date(parsed)

  const value = match.toLowerCase()
  const now = new Date()
  const date = atMidday(new Date(now))

  const weekday = WEEKDAYS.findIndex((day) => value.includes(day))
  if (weekday >= 0) {
    const days = (weekday - now.getDay() + 7) % 7 || 7
    date.setDate(now.getDate() + days)
    return date
  }

  if (value.includes("tomorrow")) {
    date.setDate(now.getDate() + 1)
    return date
  }

  if (value.includes("next week")) {
    date.setDate(now.getDate() + 7)
    return date
  }

  if (value.includes("week")) {
    date.setDate(now.getDate() + (value.includes("end") ? 5 : 7))
    return date
  }

  const monthDay = value.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)
  if (monthDay) {
    const target = new Date(now.getFullYear(), MONTHS[monthDay[2]], Number(monthDay[1]), 12)
    if (target < atMidday(new Date(now))) target.setFullYear(now.getFullYear() + 1)
    return target
  }

  const dayMonth = value.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/)
  if (dayMonth) {
    const target = new Date(now.getFullYear(), MONTHS[dayMonth[1]], Number(dayMonth[2]), 12)
    if (target < atMidday(new Date(now))) target.setFullYear(now.getFullYear() + 1)
    return target
  }

  const ordinal = value.match(/^(\d{1,2})(?:st|nd|rd|th)$/)
  if (ordinal) {
    const target = atMidday(new Date(now.getFullYear(), now.getMonth(), Number(ordinal[1])))
    if (target < atMidday(new Date(now))) target.setMonth(target.getMonth() + 1)
    return target
  }

  return undefined
}

const extractDates = (text: string): ImportantDate[] => {
  const matches = text.match(new RegExp(DATE_RE.source, "gi")) || []
  const unique = [...new Set(matches.map((m) => m.toLowerCase()))]

  return unique.slice(0, 5).map((match) => ({
    label: match,
    date: resolveDate(match),
  }))
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
    const fallbackDates = extractDates(messages.map((message) => message.body).join(" "))
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const aiDates = parsed.data.importantDates

    const importantDates = aiDates.length
      ? aiDates.map((item, index) => {
          const explicit =
            item.date && !Number.isNaN(Date.parse(item.date)) ? new Date(item.date) : undefined
          const usable = explicit && explicit >= oneYearAgo ? explicit : undefined
          return { label: item.label, date: usable ?? fallbackDates[index]?.date }
        })
      : fallbackDates

    return {
      summary: parsed.data.summary,
      keyPoints: parsed.data.keyPoints,
      importantDates,
      source: "ai",
    }
  }

  return summarizeWithRules(subject, messages)
}
