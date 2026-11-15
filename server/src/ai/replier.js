import { cleanBody, summarize } from './summarizer.js';
import { extractDates } from './dates.js';

const SIGNATURE = 'Ava Bennett\nPersonal Assistant to Marcus Reed\nReed Advisory Group';

const OPENINGS = [
  (first) => `Hi ${first},`,
  (first) => `Hello ${first},`,
  (first) => `Dear ${first},`,
];

const ACKS = [
  (subject) => `Thanks for your note about ${shortSubject(subject)}.`,
  (subject) => `Thank you for getting in touch regarding ${shortSubject(subject)}.`,
  (subject) => `I've received your message about ${shortSubject(subject)} — thanks for the detail.`,
];

const ASSISTANT_BODIES = [
  ({ propose }) => `Happy to take care of this. ${propose}\n\nI'll confirm once it's booked and send across the details.`,
  ({ propose }) => `Thanks for the details — I'll handle the coordination from here.\n\n${propose}\n\nLeave it with me and I'll keep you posted.`,
  ({ propose }) => `All noted, thanks. ${propose}\n\nI'll get this moving today and follow up if anything needs your input.`,
];

const CLIENT_BODIES = [
  ({ clientFirst, deadlineLine }) =>
    `I've shared this with ${clientFirst} and flagged it as a priority.${deadlineLine}\n\nHe'll come back to you directly with his thoughts — if anything needs clarifying before then, send it over and I'll make sure it reaches him.`,
  ({ clientFirst, deadlineLine }) =>
    `Thank you — this is now with ${clientFirst}.${deadlineLine}\n\nHe reviews items like this personally, so you'll hear from him rather than from me. I'll chase if it's still open by the end of the week.`,
  ({ clientFirst, deadlineLine }) =>
    `${clientFirst} has this in front of him.${deadlineLine}\n\nI'll make sure it doesn't sit unanswered, and I'll come back to you if his answer needs a follow-up meeting to unpack.`,
];

const NONE_BODIES = [
  () => `Thanks for the update — nothing needed from my side, I've noted it for the record.`,
  () => `Got it, thanks. No action required; I've filed this with the rest of the correspondence.`,
];

const CLOSINGS = [
  () => `Best regards,`,
  () => `Kind regards,`,
  () => `Thanks again,`,
];

function shortSubject(subject = '') {
  const s = subject.replace(/^(re|fw|fwd):\s*/i, '').replace(/[?.!—-]+$/, '').trim();
  if (!s) return 'your message';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function firstNameOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'there';
  const looksLikeOrg =
    parts.length >= 3 ||
    /(services|dental|clinic|travel|insurance|ltd|llc|co|group|studio|foundation|capital|systems|media|partners|associates|advisors)$/i.test(parts[parts.length - 1]);
  return looksLikeOrg ? `${parts[0]} team` : parts[0];
}

function fmtWhen(date) {
  const day = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (date.getHours() === 0 && date.getMinutes() === 0) return day;
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}

function proposeTimes(conv) {
  const inbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const dates = extractDates(`${conv.subject}\n${inbound?.body || ''}`);
  if (dates.length >= 1) {
    const d = new Date(dates[0].iso);
    const full = fmtWhen(d);
    if (dates[0].kind === 'datetime') {
      const alt = new Date(d.getTime() + 24 * 3600_000);
      return `Would ${full} work? If not, ${fmtWhen(alt)} is also open — or send me two windows that suit and I'll lock one in.`;
    }
    return `I can hold ${full} for you — let me know if you'd prefer a different slot and I'll work around it.`;
  }
  const slots = ['Thursday at 10:30 AM', 'Thursday at 3:00 PM', 'Friday at 11:00 AM'];
  return `I have ${slots[0]}, ${slots[1]} or ${slots[2]} free. Which suits best?`;
}

function deadlineLineFor(conv) {
  const inbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const dates = extractDates(`${conv.subject}\n${inbound?.body || ''}`);
  if (!dates.length) return '';
  const d = new Date(dates[0].iso);
  const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return ` He'll revert by ${label}.`;
}

export function draftReply(conv, opts = {}) {
  const tone = opts.tone || 'professional';
  const variant = Math.abs(opts.variant || 0);
  const inbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  const senderName = inbound?.from?.name || 'there';
  const first = firstNameOf(senderName);
  const responsibility = conv.classification?.responsibility;
  const summary = summarize(conv);

  let opening = OPENINGS[variant % OPENINGS.length](first);
  let ack = ACKS[variant % ACKS.length](conv.subject);
  let body;

  if (responsibility === 'client') {
    body = CLIENT_BODIES[variant % CLIENT_BODIES.length]({
      clientFirst: (conv.client?.name || 'Marcus').split(' ')[0],
      deadlineLine: deadlineLineFor(conv),
    });
  } else if (responsibility === 'none') {
    body = NONE_BODIES[variant % NONE_BODIES.length]();
  } else {
    body = ASSISTANT_BODIES[variant % ASSISTANT_BODIES.length]({ propose: proposeTimes(conv) });
  }

  if (tone === 'friendly') {
    opening = OPENINGS[1](first);
    ack = `Thanks for the note about ${shortSubject(conv.subject)} — always good to hear from you.`;
    body = body.replace(/I'll/g, 'I’ll');
  } else if (tone === 'concise') {
    opening = OPENINGS[0](first);
    ack = '';
    body = body.split('\n\n')[0];
  }

  const closing = CLOSINGS[variant % CLOSINGS.length]();
  const text = [opening, ack, body, `${closing}\n${SIGNATURE}`].filter(Boolean).join('\n\n');

  const notes = [];
  notes.push(responsibility === 'client' ? 'Holds the line while the client prepares a personal answer' : responsibility === 'none' ? 'Polite acknowledgement — no commitment made' : 'Proposes concrete slots so the thread closes in one exchange');
  if (tone !== 'professional') notes.push(`Tone: ${tone}`);

  return {
    text,
    notes,
    tone,
    variant: variant % 3,
    basedOn: summary.text,
    generatedAt: new Date().toISOString(),
    engine: 'mailpilot-drafter-v1',
    reviewRequired: true,
  };
}
