import { hasDeadline } from './dates.js';

function buildContext({ subject, messages, client, assistant }) {
  const latestInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
  const latest = messages[messages.length - 1];
  const clientFirst = (client?.name || '').split(' ')[0];
  const assistantFirst = (assistant?.name || 'Ava').split(' ')[0];
  return {
    subject: subject || '',
    body: latestInbound?.body || latest?.body || '',
    thread: messages.map((m) => m.body).join('\n---\n'),
    latestDirection: latest?.direction,
    clientFirst,
    clientName: client?.name || 'the client',
    assistantFirst,
    hasQuestion: /\?/.test(latestInbound?.body || latest?.body || ''),
    latest: latestInbound || latest,
  };
}

const RULES = [

  {
    key: 'approval',
    label: 'Decision or approval requested',
    bucket: 'client',
    weight: 4,
    test: (c) =>
      /\b(your|marcus['’]?s)\s+(thoughts?|decision|approval|input|views?|sign[- ]?off|endorsement|feedback|rsvp)\b/i.test(
        c.body
      ) ||
      /\b(approve|approval|sign[- ]?off|give (us|me) the go[- ]ahead|final (say|decision)|weigh in|ok from you|your (nod|blessing))\b/i.test(
        c.body
      ) ||
      /\b(needs?|awaiting|requires?)\s+(your|marcus['’]?s)\b[^.\n]{0,50}\b(approval|decision|input|response)/i.test(c.body) ||
      /\bwhat do you think\b|\bwould you like (us|me) to (proceed|move forward|go ahead)\b|\bconfirm if you'?d like to\b/i.test(
        c.body
      ),
  },
  {
    key: 'sensitive',
    label: 'Sensitive commercial or legal matter',
    bucket: 'client',
    weight: 3,
    test: (c) =>
      /\b(term sheet|contract (terms?|clause)|legal (advice|review|counsel)|lawsuit|litigation|termination|resignation|compliance|regulator|filing|equity|shares?|salary|acquisition|merger|non[- ]?disclosure|nda|indemnif|liability|audit finding|confidential)\b/i.test(
        c.body
      ),
  },
  {
    key: 'personal',
    label: 'Personal matter tied to the client',
    bucket: 'client',
    weight: 3,
    test: (c) =>
      /\b(my|our|his)\s+(son|daughter|wife|husband|family|school|doctor|dentist|home|house|property|will|estate|children|child)\b/i.test(
        c.body
      ) ||
      /\b(school|interview|admission|enrolment|enrollment|tuition|birthday|anniversary|gala|charity|private)\b[^.\n]{0,40}\b(interview|invitation|place|slot|attendance|donation|rsvp)/i.test(
        c.body
      ) ||
      /\b(isabella|bella)\b/i.test(c.body) ||
      /\byour (personal|family|private)\b/i.test(c.body),
  },
  {
    key: 'direct_address',
    label: 'Addressed to the client personally',
    bucket: 'client',
    weight: 2,
    test: (c) => {
      const greeting = c.body.slice(0, 220);
      const re = new RegExp(`\\b(hi|hello|dear|hey|good (morning|afternoon|evening))\\s+${c.clientFirst}\\b`, 'i');
      return re.test(greeting) || new RegExp(`\\b(mr\\.?\\s+${(c.clientName.split(' ').pop() || '')})\\b`, 'i').test(greeting);
    },
  },

  {
    key: 'scheduling',
    label: 'Scheduling or coordination',
    bucket: 'assistant',
    weight: 4,
    test: (c) =>
      /\b(reschedul|postpone|availability|free (slot|slot|time)|calendar|appointment|book (a|the|an)|which (day|time|date|slot)|time zone|zoom (link|details)|join(ing)? (link|details)|move the (meeting|call)|hold (the )?(slot|place)|confirm (the )?(time|slot|date|appointment))\b/i.test(
        c.body
      ) ||
      (/\b(slot|appointment|meeting|call)\b/i.test(c.body) && /\b(thu|fri|mon|tue|wed|am|pm)\b/i.test(c.body)),
  },
  {
    key: 'routine_admin',
    label: 'Routine administrative request',
    bucket: 'assistant',
    weight: 3,
    test: (c) =>
      /\b(invoice|receipt|purchase order|po number|procurement|vendor|supplier|delivery|shipment|parking|permit|expense|reimburse|petty cash|hotel|flight|itinerary|booking reference|password|subscription|it support|office (supplies|move|keys)|courier|stationery)\b/i.test(
        c.body
      ),
  },
  {
    key: 'addressed_assistant',
    label: 'Directed to the assistant / team',
    bucket: 'assistant',
    weight: 3,
    test: (c) => {
      const greeting = c.body.slice(0, 240);
      const re = new RegExp(`\\b(hi|hello|dear|hey)\\s+(${c.assistantFirst}|the team|team|assistant|everyone|all)\\b`, 'i');
      return (
        re.test(greeting) ||
        /\b(could|can|would)\s+you\s+(arrange|coordinate|handle|organise|organize|process|chase|book|update|share|forward|circulate)\b/i.test(
          c.body
        ) ||
        /\bplease\s+(coordinate|arrange|organise|organize|handle|process|chase|update|circulate|share)\b/i.test(c.body) ||
        /\byou['’]?re (here )?to (help|handle|coordinate)\b/i.test(c.body)
      );
    },
  },
  {
    key: 'followup',
    label: 'Follow-up on a pending request',
    bucket: 'assistant',
    weight: 3,
    test: (c) =>
      /\b(just following up|following up|gentle reminder|circling back|bump(ing)? this|checking in|any (update|news|chance|progress)|status (of|on|update)|still (pending|waiting|open)|remind(er|ing)? that|chase)\b/i.test(
        c.body
      ),
  },

  {
    key: 'newsletter',
    label: 'Newsletter or marketing email',
    bucket: 'none',
    weight: 5,
    test: (c) =>
      /\b(unsubscribe|view in browser|email preferences|digest|newsletter|weekly roundup|this week'?s reads|marketing (email|message)|special offer|discount code|black friday|read more)\b/i.test(
        c.body
      ),
  },
  {
    key: 'automated',
    label: 'Automated notification',
    bucket: 'none',
    weight: 5,
    test: (c) =>
      /\b(do[- ]?not[- ]?reply|no[- ]?reply|this is an automated (message|notification|email)|automatically generated|system notification|you are receiving this because)\b/i.test(
        c.body
      ) ||
      /\b(security alert|new sign[- ]?in|password (expires|reset)|your (monthly )?(invoice|statement) is available|payment received|order (confirmed|shipped)|receipt for|report (is )?ready|comment(ed)? on|mentioned you|invited you|job alert)\b/i.test(
        c.body
      ),
  },
  {
    key: 'informational',
    label: 'Informational update, no question asked',
    bucket: 'none',
    weight: 3,
    test: (c) =>
      !c.hasQuestion &&
      /\b(just to (let you know|inform you|share)|for your (information|reference)|f\.?y\.?i|update (on|about)|completed|has been (processed|delivered|scheduled|updated)|no action (is )?(needed|required)|below is|shared (for|with) (visibility|the team|records))\b/i.test(
        c.body
      ),
  },
  {
    key: 'closed',
    label: 'Thread already closed',
    bucket: 'none',
    weight: 4,
    test: (c) =>
      c.body.length < 140 &&
      /^(thanks|thank you|perfect|great|awesome|noted|appreciated|cheers|lovely|brilliant|sorted)[.!]?\s/im.test(
        c.body.trim()
      ) &&
      !c.hasQuestion,
  },
];

const TENANT_LABEL = {
  assistant: 'Assistant to reply',
  client: 'Client to reply',
  none: 'No reply needed',
  review: 'Needs review',
};

const BUCKET_REASON = {
  assistant: 'Routine coordination the assistant can close out without the client.',
  client: 'Requires the client’s personal judgement or approval.',
  none: 'No response is expected from our side.',
  review: 'Signals are mixed or too thin — a quick human check is safer than a guess.',
};

const RULE_REASON = {
  approval: 'asks for a decision or approval',
  sensitive: 'touches a sensitive commercial or legal matter',
  personal: 'is a personal matter involving the client’s family',
  direct_address: 'is addressed to the client personally',
  scheduling: 'is about scheduling, which the assistant owns',
  routine_admin: 'is a routine administrative request',
  addressed_assistant: 'is addressed to the assistant team',
  followup: 'is a follow-up on something already in motion',
  newsletter: 'is a newsletter / marketing email',
  automated: 'is an automated notification',
  informational: 'is a pure information update with no question',
  closed: 'is already closed with thanks',
};

export function classify(input) {
  const now = input.now || new Date();
  const ctx = buildContext(input);
  const scores = { assistant: 0, client: 0, none: 0 };
  const matched = [];

  for (const rule of RULES) {
    let hit = false;
    try {
      hit = rule.test(ctx);
    } catch {
      hit = false;
    }
    if (hit) {
      scores[rule.bucket] += rule.weight;
      matched.push(rule);
    }
  }

  const deadline = hasDeadline(ctx.body);
  if (deadline) {

    if (scores.assistant === 0 && scores.client === 0 && scores.none === 0) {
      scores.assistant += 1;
      matched.push({ key: 'deadline', bucket: 'assistant', weight: 1, label: 'Contains a deadline' });
    }
  }

  let responsibility;
  const ranked = ['assistant', 'client', 'none'].sort((a, b) => scores[b] - scores[a]);
  const [top, second] = ranked;
  const margin = scores[top] - scores[second];
  const total = scores.assistant + scores.client + scores.none;

  if (total === 0) {
    responsibility = 'review';
  } else if (top === 'none' && scores.none >= 3 && margin >= 1) {
    responsibility = 'none';
  } else if (top !== 'none' && scores[top] >= 3 && margin >= 1) {
    responsibility = top;
  } else {
    responsibility = 'review';
  }

  let repliedLast = false;
  if (ctx.latestDirection === 'outbound' && responsibility !== 'none') {
    responsibility = 'none';
    repliedLast = true;
    matched.push({
      key: 'replied',
      bucket: 'none',
      weight: 0,
      label: 'We replied last — awaiting the other party',
    });
  }

  let confidence;
  if (responsibility === 'review') {
    confidence = total === 0 ? 30 : Math.min(52, 34 + Math.round(total * 1.5));
  } else if (repliedLast) {
    confidence = 84;
  } else {
    const base = 55 + Math.min(40, Math.round(scores[top] * 6));
    const clearWinner = margin >= Math.max(2, scores[top] * 0.6);
    confidence = Math.min(96, Math.max(56, base + (clearWinner ? 5 : 0)));
  }

  const topRules = matched
    .filter((r) => r.bucket === responsibility || (responsibility === 'review' && r.weight > 0))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const reasonParts = [];
  if (responsibility === 'review') {
    const positives = matched.filter((r) => r.weight > 0);
    const buckets = new Set(positives.map((r) => r.bucket));
    if (total === 0) {
      reasonParts.push('No strong signals found in the conversation');
    } else if (buckets.size > 1) {
      const conflict = positives.slice(0, 2).map((r) => RULE_REASON[r.key] || r.label.toLowerCase());
      reasonParts.push(`Conflicting signals: ${conflict.join(' vs ')}`);
    } else {
      const only = positives.map((r) => RULE_REASON[r.key] || r.label.toLowerCase()).join(', ');
      reasonParts.push(`Only a weak signal detected (${only})`);
    }
    reasonParts.push(BUCKET_REASON.review);
  } else {
    if (topRules.length) reasonParts.push(`The message ${topRules.map((r) => RULE_REASON[r.key] || r.label.toLowerCase()).join(', and ')}`);
    else if (repliedLast) reasonParts.push('We replied last in this thread');
    else reasonParts.push(`Mostly reads as ${TENANT_LABEL[responsibility].toLowerCase()}`);
    reasonParts.push(BUCKET_REASON[responsibility]);
  }

  let reason = reasonParts.join('. ').replace(/\.\./g, '.');
  if (reason && !/[.!?]$/.test(reason)) reason += '.';

  const signals = [...new Set(matched.map((r) => r.label))].slice(0, 4);
  if (deadline && !signals.includes('Contains a deadline')) signals.push('Contains a deadline');

  return {
    responsibility,
    confidence,
    reason,
    signals,
    scores,
    rules: matched.map((r) => r.key),
    deadline,
    classifiedAt: now.toISOString(),
    model: 'mailpilot-responsibility-v1',
  };
}

export function responsibilityLabel(key) {
  return TENANT_LABEL[key] || key;
}
