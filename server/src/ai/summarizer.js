import { extractDates, hasDeadline } from './dates.js';

const GREETING_RE = /^(hi|hello|hey|dear|good (morning|afternoon|evening)|to whom it may concern|all)[,!\s]/i;
const SIGNOFF_RE = /^(best regards|kind regards|regards|thanks,?|thank you,?|cheers|best,?|sincerely|yours (truly|sincerely)|sent from my (iphone|ipad)|warm regards)[,!\s]*$/i;

export function cleanBody(body = '') {
  const lines = body.split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^(>|\s*>)/.test(t)) break;
    if (/^on .+ wrote:$/i.test(t)) break;
    if (/^-{3,}\s*(original message|forwarded message)/i.test(t)) break;
    if (/^_{5,}/.test(t)) break;
    if (/^(from|sent|to):/i.test(t) && out.length > 1) break;
    out.push(line);
  }
  let text = out.join('\n').trim();
  const firstLine = text.split('\n')[0] || '';
  if (GREETING_RE.test(firstLine)) text = text.slice(firstLine.length).trim();
  const lines2 = text.split('\n');
  while (lines2.length && (SIGNOFF_RE.test(lines2[lines2.length - 1].trim()) || /^[-–—]\s*$/.test(lines2[lines2.length - 1].trim()))) {
    lines2.pop();

    if (lines2.length && /^\s*[A-Z][a-z]+\s+[A-Z][a-z]+(\s+\|)?/.test(lines2[lines2.length - 1]) && lines2.length > 1 && SIGNOFF_RE.test(lines2[lines2.length - 2]?.trim() || '')) {
      lines2.pop();
    }
  }
  return lines2.join('\n').trim() || text.trim();
}

function sentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function clamp(text, max = 260) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return stop > 120 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…';
}

export function summarize(conv) {
  const inbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const outbound = [...conv.messages].reverse().find((m) => m.direction === 'outbound');
  const source = inbound || outbound || { body: '' };
  const senderName = (source.from?.name || '').split(' ')[0] || 'The sender';

  const cleaned = cleanBody(source.body);
  const all = sentences(cleaned);
  const text = clamp(all.slice(0, 2).join(' ') || cleaned || conv.subject);

  const bullets = [];
  const ask = all.find((s) => /\?|please|could you|kindly|we (need|would like|request)|need your|asking (for|you)|confirm|let us know|get back to/i.test(s));
  if (ask) bullets.push({ label: 'What they want', text: clamp(ask, 180) });

  const dates = extractDates(`${conv.subject}\n${source.body}`);
  const deadlineHit = dates.find((d) => hasDeadline(source.body));
  if (deadlineHit) {
    bullets.push({ label: 'Deadline', text: formatDeadline(deadlineHit) });
  } else if (dates.length) {
    bullets.push({ label: 'Key date', text: formatDeadline(dates[0]) });
  }

  if (conv.classification?.responsibility === 'client') {
    bullets.push({ label: 'Why the client', text: 'Needs Marcus’s personal decision or approval — the assistant can’t answer for him.' });
  } else if (conv.classification?.responsibility === 'assistant') {
    bullets.push({ label: 'Assistant action', text: 'Can be handled by the assistant without escalating.' });
  }

  const participants = [...new Set(conv.messages.map((m) => m.from?.name).filter(Boolean))];
  if (participants.length > 1) bullets.push({ label: 'People', text: participants.slice(0, 4).join(', ') });

  const important = [];
  const bodyAll = conv.messages.map((m) => m.body).join(' ');
  const amount = bodyAll.match(/\b(?:[$€£]\s?)\d[\d,]*(?:\.\d{2})?\b/);
  if (amount) important.push(`Mentions ${amount[0]}`);
  if (/attach/i.test(bodyAll)) important.push('Has attachments');
  if (deadlineHit) important.push('Time-sensitive');

  return {
    text,
    bullets: bullets.slice(0, 4),
    highlights: important.slice(0, 3),
    senderName,
    generatedAt: new Date().toISOString(),
    engine: 'mailpilot-summarizer-v1',
  };
}

function formatDeadline(d) {
  const date = new Date(d.iso);
  const opts =
    d.kind === 'datetime'
      ? { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
      : { weekday: 'short', day: 'numeric', month: 'short' };
  return date.toLocaleString('en-GB', opts).replace(',', ' ·');
}

export function preview(conv) {
  const inbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const cleaned = cleanBody((inbound || conv.messages[conv.messages.length - 1] || {}).body || '');
  return clamp(cleaned.replace(/\s+/g, ' '), 150);
}
