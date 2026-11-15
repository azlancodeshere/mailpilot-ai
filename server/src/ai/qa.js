import { summarize } from './summarizer.js';
import { draftReply } from './replier.js';
import { segmentsFor } from '../util/segments.js';

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'my', 'me', 'i', 'that', 'this', 'with', 'what', 'which', 'who', 'whom', 'do', 'does', 'did', 'have', 'has', 'been', 'be', 'at', 'by', 'from', 'it', 'its', 'as', 'if', 'we', 'you', 'your']);

function keywords(q) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function item(conv, reason) {
  return {
    id: conv.id,
    subject: conv.subject,
    sender: conv.messages[conv.messages.length - 1]?.from?.name || '',
    responsibility: conv.classification?.responsibility,
    confidence: conv.classification?.confidence,
    reason,
    at: conv.lastActivityAt,
    unread: !!conv.flags?.unread,
    important: !!conv.flags?.important,
  };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function answerQuestion(input) {
  const { question = '', conversations, conversationId, clientName = 'Marcus' } = input;
  const q = question.toLowerCase().trim();
  const scope = conversations.filter((c) => !c.flags?.archived);
  const active = scope.filter((c) => !c.flags?.completed);
  const focus = conversationId ? active.find((c) => c.id === conversationId) || active[0] : null;

  const has = (...re) => re.some((r) => r.test(q));

  if (has(/\bwhy\b/) && (focus || has(/assign|classif|responsib|client|marcus/))) {
    const target = focus || active.find((c) => c.classification?.responsibility === 'client');
    if (target) {
      const c = target.classification;
      return {
        reply: `“${target.subject}” is marked **${label(c.responsibility)}** at ${c.confidence}% confidence. ${c.reason}${
          c.signals?.length ? ` The signals I picked up: ${c.signals.join('; ').toLowerCase()}.` : ''
        }${c.source === 'manual' ? ' (This classification was set manually.)' : ''}`,
        items: [item(target, c.reason)],
        suggestions: ['Draft a reply to this conversation', 'Show me everything waiting for a response'],
      };
    }
  }

  if (has(/\bsummar/)) {
    const target = focus || active[0];
    if (target) {
      const s = summarize(target);
      return {
        reply: `Here's the short version of **${target.subject}**: ${s.text}`,
        items: [item(target, s.text)],
        suggestions: ['Draft a reply to this conversation', 'Why was this assigned to the client?'],
      };
    }
  }

  if (has(/\bdraft\b/, /\bwrite (a|the) reply/, /\breply to this\b/, /\brespond to this\b/)) {
    const target = focus || active.find((c) => c.classification?.responsibility !== 'none') || active[0];
    if (target) {
      const d = draftReply(target, { tone: 'professional', variant: 0 });
      return {
        reply: `I've prepared a draft for **${target.subject}**. Review it in the composer before sending — nothing goes out without your approval.`,
        items: [item(target, 'Draft ready for review')],
        draft: { conversationId: target.id, text: d.text },
        suggestions: ['Show me emails that need the client’s attention', 'What am I waiting for a response on?'],
      };
    }
  }

  if (has(/waiting (for|on)/, /pending (response|reply)/, /am i waiting/, /what.*waiting/, /follow[- ]?ups?/, /chasing/)) {
    const items = active.filter((c) => segmentsFor(c).includes('waiting')).map((c) => item(c, 'We replied — waiting on their answer'));
    return {
      reply: items.length
        ? `You're waiting on **${items.length} conversation${items.length > 1 ? 's' : ''}**. ${items[0]?.subject} is the oldest open one.`
        : `Nothing is waiting on a reply right now — every thread is either answered or still with us.`,
      items,
      suggestions: ['Which emails require the client’s attention?', 'Show me action required emails'],
    };
  }

  if (has(/client/, /marcus/, /his attention/, /need (his|the client)/) && has(/attention/, /reply/, /respond/, /needs?/, /waiting/)) {
    const items = active
      .filter((c) => c.classification?.responsibility === 'client')
      .map((c) => item(c, c.classification?.reason));
    return {
      reply: items.length
        ? `**${items.length} conversation${items.length > 1 ? 's are' : ' is'} waiting on ${clientName} personally.** ${items[0].subject} has the tightest deadline.`
        : `${clientName} has nothing personal to answer right now — his side of the inbox is clear.`,
      items,
      suggestions: ['Why has this email been assigned to the client?', 'Show me emails that need my attention'],
    };
  }

  if (has(/my attention/, /for me/, /i need to/, /assistant to reply/, /should i reply/, /mine\b/)) {
    const items = active
      .filter((c) => ['assistant', 'review'].includes(c.classification?.responsibility) || segmentsFor(c).includes('action'))
      .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
      .map((c) => item(c, c.classification?.reason));
    return {
      reply: `**${items.length} item${items.length > 1 ? 's' : ''} need${items.length > 1 ? '' : 's'} you.** These are the ones where the reply is yours to write${items.length ? ` — start with “${items[0].subject}”` : ''}.`,
      items,
      suggestions: ['Summarize this conversation', 'What am I waiting for a response on?'],
    };
  }

  if (has(/meetings?/, /appointments?/, /calendar/, /when am i/, /upcoming/, /deadlines?/, /dates?/)) {
    const items = active
      .filter((c) => segmentsFor(c).includes('meetings') || c.meeting)
      .map((c) => item(c, c.meeting ? `${c.meeting.title} · ${fmtDate(c.meeting.start)}` : 'Date found in thread'));
    return {
      reply: items.length
        ? `I found **${items.length} scheduled item${items.length > 1 ? 's' : ''}** in the inbox: ${items[0].reason}.`
        : `No upcoming meetings or deadlines detected in the current inbox.`,
      items,
      suggestions: ['Which emails require the client’s attention?', 'Show me unread emails'],
    };
  }

  if (has(/\bunread\b/)) {
    const items = active.filter((c) => c.flags?.unread).map((c) => item(c, 'Unread'));
    return { reply: `**${items.length} unread conversation${items.length === 1 ? '' : 's'}** in ${clientName}'s inbox.`, items, suggestions: ['Show me action required emails'] };
  }
  if (has(/\bimportant\b/, /\burgent\b/)) {
    const items = active.filter((c) => c.flags?.important).map((c) => item(c, 'Flagged important'));
    return { reply: `**${items.length} conversation${items.length === 1 ? '' : 's'} flagged important.**`, items, suggestions: ['Show me emails that need my attention'] };
  }

  if (has(/no reply/, /newsletters?/, /junk/, /ignore/)) {
    const items = active.filter((c) => c.classification?.responsibility === 'none').map((c) => item(c, 'No reply expected'));
    return { reply: `**${items.length} conversation${items.length === 1 ? '' : 's'} need no reply** — newsletters, notifications and closed threads.`, items, suggestions: ['Show me action required emails'] };
  }

  const kws = keywords(question);
  if (kws.length) {
    const scored = scope
      .map((c) => {
        const hay = `${c.subject} ${c.summary?.text || ''} ${c.messages.map((m) => m.body).join(' ')}`.toLowerCase();
        const score = kws.reduce((n, k) => n + (hay.includes(k) ? 1 : 0), 0);
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    if (scored.length) {
      return {
        reply: `I found **${scored.length} conversation${scored.length > 1 ? 's' : ''}** matching “${question.trim()}”.`,
        items: scored.map(({ c, score }) => item(c, `Matched ${score} keyword${score > 1 ? 's' : ''} in this thread`)),
        suggestions: ['Summarize this conversation', 'Draft a reply to this conversation'],
      };
    }
  }

  return {
    reply:
      'I couldn’t find anything matching that in the connected inbox. Try asking me things like:',
    items: [],
    suggestions: [
      'Show me emails that need my attention',
      'Which emails require the client’s attention?',
      'What am I waiting for a response on?',
      'Why has this email been assigned to the client?',
      'Show me upcoming meetings and deadlines',
      'Draft a reply to this conversation',
    ],
  };
}

function label(r) {
  return { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed', review: 'Needs review' }[r] || r;
}
