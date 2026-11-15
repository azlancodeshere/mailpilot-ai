import { config } from '../config.js';
import { classify } from './classifier.js';
import { summarize, preview, cleanBody } from './summarizer.js';
import { draftReply } from './replier.js';
import { answerQuestion } from './qa.js';
import { extractDates } from './dates.js';

export { classify, summarize, preview, cleanBody, draftReply, answerQuestion, extractDates };

export const aiMeta = {
  provider: config.aiProvider === 'openai' && config.openaiKey ? 'openai' : 'builtin',
  model: config.aiProvider === 'openai' && config.openaiKey ? config.aiModel : 'mailpilot-signal-engine-v1',
};

export function analysingSteps() {
  return [
    'Reading the latest message',
    'Checking the conversation history',
    'Matching against responsibility signals',
    'Scoring confidence',
  ];
}

async function llm(messages, { json = false, temperature = 0.2 } = {}) {
  const res = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openaiKey}` },
    body: JSON.stringify({
      model: config.aiModel,
      messages,
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function classifyConversation(input) {
  if (aiMeta.provider === 'openai') {
    try {
      const inbound = [...input.messages].reverse().find((m) => m.direction === 'inbound');
      const raw = await llm(
        [
          {
            role: 'system',
            content:
              'You classify email conversations for a personal-assistant product. Reply ONLY with JSON: {"responsibility":"assistant|client|none|review","confidence":0-100,"reason":"one sentence","signals":["short label"]}. "assistant" = the assistant should reply (scheduling, routine admin, follow-ups). "client" = the client must reply personally (decisions, approvals, sensitive or personal matters). "none" = no reply needed (newsletters, updates, resolved). "review" = low confidence or conflicting signals.',
          },
          { role: 'user', content: `Subject: ${input.subject}\n\nLatest message:\n${(inbound?.body || '').slice(0, 4000)}` },
        ],
        { json: true }
      );
      const parsed = JSON.parse(raw);
      if (['assistant', 'client', 'none', 'review'].includes(parsed.responsibility)) {
        return {
          responsibility: parsed.responsibility,
          confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 60)),
          reason: parsed.reason || 'Classified by LLM',
          signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 4) : [],
          classifiedAt: new Date().toISOString(),
          model: config.aiModel,
        };
      }
    } catch (err) {
      console.warn('[ai] LLM classify failed, falling back to builtin engine:', err.message);
    }
  }
  return classify(input);
}
