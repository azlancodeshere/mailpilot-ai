import { classify } from '../ai/classifier.js';
import { summarize } from '../ai/summarizer.js';
import { extractDates } from '../ai/dates.js';
import { hashPassword } from '../util/password.js';
import { uid, hoursAgo, daysAgo } from '../util/ids.js';

const now = new Date();
const inDays = (n, h = 0) => new Date(now.getTime() + n * 86400_000 + h * 3600_000);
const long = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const med = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const short = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const WED = inDays(((3 - now.getDay() + 7) % 7) || 7);
const THU = inDays(((4 - now.getDay() + 7) % 7) || 7);
const FRI = inDays(((5 - now.getDay() + 7) % 7) || 7);
const TUE = inDays(((2 - now.getDay() + 7) % 7) || 7);

export const ASSISTANT = {
  id: 'usr_ava',
  name: 'Ava Bennett',
  email: 'ava@northstarassist.com',
};

const MARCUS = {
  id: 'cli_marcus',
  name: 'Marcus Reed',
  email: 'marcus.reed@gmail.com',
  title: 'Founder & CEO',
  company: 'Reed Advisory Group',
  color: '#4f46e5',
  assistantId: 'usr_ava',
  userId: 'usr_marcus',
};

const ELENA = {
  id: 'cli_elena',
  name: 'Elena Vasquez',
  email: 'elena@vasquezstudio.com',
  title: 'Creative Director',
  company: 'Vasquez Studio',
  color: '#0f766e',
  assistantId: 'usr_ava',
  userId: 'usr_elena',
};

export const CLIENTS = [MARCUS, ELENA];

function msg({ from, to, body, at, direction = 'inbound' }) {
  return { id: uid('msg'), from, to, body, at, direction };
}

function buildMeeting(conv) {
  const text = `${conv.subject}\n${conv.messages.map((m) => m.body).join('\n')}`;
  const isInvite = /\b(invitation|invite|calendar|you have been invited|confirmed for|we're confirmed|appointment|reschedule|are you free|recording on)\b/i.test(text);
  const dates = extractDates(text);
  if (!dates.length || !isInvite) return null;

  const explicit = dates.filter((d) => /\d/.test(d.label));
  const chosen = explicit[0] || dates[0];
  const d = new Date(chosen.iso);
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s?[–-]\s?([01]?\d|2[0-3]):([0-5]\d))?\b/);
  if (timeMatch) {
    d.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  const endMatch = timeMatch && timeMatch[3]
    ? (() => { const e = new Date(d); e.setHours(Number(timeMatch[3]), Number(timeMatch[4]), 0, 0); return e.toISOString(); })()
    : null;
  const loc = text.match(/where:\s*(.+)/i);
  const confirmed = /\b(invitation|confirmed for|we're confirmed|you have been invited)\b/i.test(text);
  return {
    title: conv.subject.replace(/^(re|fw|invitation):\s*/i, '').trim(),
    start: d.toISOString(),
    end: endMatch,
    location: loc ? loc[1].trim().slice(0, 80) : /teams|zoom|meet/i.test(text) ? 'Video call' : null,
    status: confirmed ? 'confirmed' : 'proposed',
    source: 'ai',
  };
}

function buildConv(spec) {
  const client = CLIENTS.find((c) => c.id === spec.clientId) || MARCUS;
  const messages = spec.messages.map(msg);
  const classification = classify({ subject: spec.subject, messages, client, assistant: ASSISTANT });

  const latest = messages[messages.length - 1];
  const latestInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
  const hasQuestion = /\?/.test((latestInbound || latest).body);

  const flags = {
    unread: spec.unread ?? false,
    important: spec.important ?? false,
    archived: spec.archived ?? false,
    completed: spec.completed ?? false,
    awaitingResponse: spec.awaitingResponse ?? latest.direction === 'outbound',
    requiresAction:
      !spec.completed &&
      ['assistant', 'client'].includes(classification.responsibility) &&
      (classification.deadline || hasQuestion || classification.rules?.includes('approval')),
  };

  const conv = {
    id: spec.id || uid('cnv'),
    clientId: client.id,
    accountId: spec.accountId,
    subject: spec.subject,
    participants: spec.participants,
    messages,
    classification,
    flags,
    meeting: null,
    summary: null,
    preview: '',
    createdAt: messages[0].at,
    lastActivityAt: latest.at,
    history: [],
    handledVia: spec.handledVia || null,
  };

  conv.summary = summarize(conv);
  conv.meeting = spec.meeting === false ? null : buildMeeting(conv);
  if (conv.meeting) conv.flags.requiresAction = conv.flags.requiresAction && conv.meeting.status !== 'confirmed';

  const fromName = (m) => m.from?.name;
  conv.preview = (conv.summary.text || '').slice(0, 160);

  conv.history = [
    {
      at: conv.classification.classifiedAt,
      type: 'classified',
      text: `AI classified this conversation as ${labelOf(conv.classification.responsibility)} (${conv.classification.confidence}% confidence)`,
    },
  ];
  if (spec.overrideNote) {
    conv.classification.source = 'manual';
    conv.history.push({ at: spec.overrideAt || hoursAgo(20), type: 'override', text: spec.overrideNote });
  }
  void fromName;
  return conv;
}

function labelOf(r) {
  return { assistant: 'Assistant to reply', client: 'Client to reply', none: 'No reply needed', review: 'Needs review' }[r];
}

const P = {
  laura: { name: 'Laura Chen', email: 'laura@northbridgecap.com' },
  priya: { name: 'Priya Nair', email: 'priya.nair@reedadvisory.com' },
  registrar: { name: 'Mrs. H. Cartwright', email: 'admissions@standrews.sch.uk' },
  tom: { name: 'Tom Bianchi', email: 'tom@pixelworks.io' },
  clara: { name: 'Clara Whitfield', email: 'events@meridianfoundation.org' },
  sarah: { name: 'Sarah Okafor', email: 's.okafor@brightlinelegal.com' },
  dental: { name: 'Riverside Family Dental', email: 'reception@riversidedental.co.uk' },
  hartwell: { name: 'James Whitmore', email: 'billing@hartwellco.com' },
  metro: { name: 'Metro Parking Services', email: 'permits@metroparking.co.uk' },
  travel: { name: 'Corporate Travel', email: 'bookings@corptravel.com' },
  saffron: { name: 'Priya Malhotra', email: 'events@saffronandsage.co' },
  hbr: { name: 'Harvard Business Review', email: 'hbr-daily@notifications.hbr.org' },
  github: { name: 'GitHub', email: 'noreply@github.com' },
  sterling: { name: 'Sterling Wealth', email: 'statements@sterlingwealth.com' },
  james: { name: 'James Okafor', email: 'james@reedadvisory.com' },
  linkedin: { name: 'LinkedIn', email: 'digest@linkedin.com' },
  nick: { name: 'Nick Kramer', email: 'n.kramer@gmail.com' },
  claire: { name: 'Claire Duval', email: 'claire@partnershipforum.org' },
  outlook: { name: 'Reed Advisory Calendar', email: 'calendar@reedadvisory.com' },
  producer: { name: 'Dan Fenton', email: 'dan@signalmedia.co' },
  marcus: { name: 'Marcus Reed', email: 'marcus.reed@gmail.com' },
  elena: { name: 'Elena Vasquez', email: 'elena@vasquezstudio.com' },
  ava: { name: 'Ava Bennett', email: 'ava@northstarassist.com' },
};

const TO_MARCUS = [P.marcus];
const TO_ELENA = [P.elena];

const marcusConvos = [
  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Term sheet — Northbridge Capital (revised)',
    participants: [P.laura],
    important: true,
    unread: true,
    messages: [
      msg({
        from: P.laura,
        to: TO_MARCUS,
        at: hoursAgo(31),
        body: `Hi Marcus,

Attached is the revised term sheet reflecting the 18-month runway extension and the protective provisions we discussed on the call.

We'd love your thoughts before it goes to the investment committee. Could you confirm by ${med(WED)} whether you're happy to proceed on these terms? Happy to jump on a call if it's easier to talk it through.

Best regards,
Laura Chen
Partner, Northbridge Capital`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'URGENT: regulator filing — response required by Wednesday',
    participants: [P.sarah],
    important: true,
    unread: true,
    messages: [
      msg({
        from: P.sarah,
        to: TO_MARCUS,
        at: hoursAgo(9),
        body: `Hi Marcus,

The regulator has come back on our annual filing and we need your confirmation on two points before ${med(WED)}.

Could you review section 4 and confirm you're happy with the wording as drafted? This one is time-sensitive — a late response triggers an automatic extension we'd rather avoid.

Best regards,
Sarah Okafor
Brightline Legal`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Q4 board pack — your review needed',
    participants: [P.priya],
    important: true,
    messages: [
      msg({
        from: P.priya,
        to: TO_MARCUS,
        at: daysAgo(1.1),
        body: `Hi Marcus,

The board pack for the Q4 review is ready — deck, financials and the strategy section are all attached.

We need your sign-off on the strategy section before it goes to the full board on ${long(inDays(9))}. Could you send your approval by ${med(FRI)}?

Thanks,
Priya Nair
Chair, Reed Advisory Group`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Invitation: Q4 Board Review — 24 November',
    participants: [P.outlook],
    messages: [
      msg({
        from: P.outlook,
        to: TO_MARCUS,
        at: daysAgo(1.7),
        body: `You have been invited to the following event:

Q4 Board Review
When: ${long(inDays(9))}, 10:00–12:00
Where: Boardroom, 4th floor / Microsoft Teams

Respond: Accept | Tentative | Decline

This is an automated calendar invitation — do not reply to this message.`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'School interview — Isabella Reed (Year 4)',
    participants: [P.registrar],
    unread: true,
    messages: [
      msg({
        from: P.registrar,
        to: TO_MARCUS,
        at: daysAgo(0.9),
        body: `Dear Mr. Reed,

Thank you for your application for Isabella. We would like to invite her for a short interview and would appreciate your preference on one of the following slots:

• ${med(inDays(9))} at 9:30 AM
• ${med(inDays(10))} at 2:00 PM

Please let us know which suits your family best.

Yours sincerely,
Mrs. H. Cartwright
Registrar, St. Andrew's Preparatory`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Re: Website migration — final sign-off before deploy',
    participants: [P.tom],
    unread: true,
    messages: [
      msg({
        from: P.tom,
        to: TO_MARCUS,
        at: daysAgo(1.4),
        body: `Hi Marcus,

The new homepage is staged and ready to go live. Before we deploy we need your sign-off on the final design — particularly the pricing table.

Can you give us the go-ahead by ${short(THU)}? After that we're locked until the next sprint.

Thanks,
Tom Bianchi
Pixelworks`,
      }),
      msg({
        from: P.ava,
        to: [P.tom],
        direction: 'outbound',
        at: daysAgo(1.2),
        body: `Hi Tom,

Thanks — I've put this in front of Marcus for a final look. He's traveling today, so expect his answer by tomorrow evening at the latest.

Best regards,
Ava Bennett
Personal Assistant to Marcus Reed`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Winter Gala — table of eight?',
    participants: [P.clara],
    messages: [
      msg({
        from: P.clara,
        to: TO_MARCUS,
        at: daysAgo(2.2),
        body: `Dear Marcus,

We'd be delighted to offer you a table of eight at this year's Winter Gala on ${long(inDays(20))}. We know your diary fills quickly, so your RSVP by ${med(inDays(6))} would let us print the place cards straight away.

Warm regards,
Clara Whitfield
Events Director, Meridian Foundation`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Re: Dental appointment for Isabella — reschedule?',
    participants: [P.dental],
    messages: [
      msg({
        from: P.dental,
        to: [P.ava, P.marcus],
        at: hoursAgo(5),
        body: `Hello Ava,

We need to move Isabella's check-up. Are you free ${med(THU)} at 4:15 PM or ${med(FRI)} at 9:00 AM?

Please let us know which slot works and we'll update the record.

Kind regards,
Riverside Family Dental`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Invoice #4821 — October retainers',
    participants: [P.hartwell],
    messages: [
      msg({
        from: P.hartwell,
        to: [P.ava],
        at: daysAgo(1.6),
        body: `Hi Ava,

Please find the invoice for October attached (ref 4821, £4,850.00). Could you confirm the PO number so we can add it to the batch run this week?

Many thanks,
James Whitmore
Accounts, Hartwell & Co.`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Parking permits for the new starters',
    participants: [P.metro],
    messages: [
      msg({
        from: P.metro,
        to: [P.ava, P.marcus],
        at: daysAgo(2.4),
        body: `Dear team,

We've received the applications for four new visitor permits. Could you confirm the vehicle registrations and which permits you'd like issued before ${med(FRI)}?

Regards,
Metro Parking Services`,
      }),
      msg({
        from: P.ava,
        to: [P.metro],
        direction: 'outbound',
        at: daysAgo(2.1),
        body: `Hi there,

Thanks — two of the four vehicles are confirmed, I'm waiting on registrations for the other two from our office manager and will send them over shortly.

Best regards,
Ava Bennett`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Flights to Berlin — confirm passenger details',
    participants: [P.travel],
    important: true,
    messages: [
      msg({
        from: P.travel,
        to: [P.ava],
        at: hoursAgo(20),
        body: `Hi Ava,

We're holding two seats on BA849 to Berlin, departing ${long(inDays(12))} at 07:40. Can you confirm the passenger names and passport details so we can issue the tickets today?

Fares hold until 6 PM GMT.

Best,
Corporate Travel`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Follow-up: catering quote for the leadership offsite',
    participants: [P.saffron],
    messages: [
      msg({
        from: P.saffron,
        to: [P.ava],
        at: daysAgo(3.1),
        body: `Hi Ava,

Just following up on the catering numbers for the leadership offsite — could you confirm the headcount by ${med(TUE)} so we can lock the menu?

Thanks,
Priya Malhotra
Saffron & Sage`,
      }),
      msg({
        from: P.ava,
        to: [P.saffron],
        direction: 'outbound',
        at: daysAgo(2.9),
        body: `Hi Priya,

We're at 14 confirmed with two more to follow. I'll send the final number by Monday morning so you have plenty of margin.

Best regards,
Ava Bennett`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Re: Lumen Robotics NDA — countersigned?',
    participants: [P.sarah],
    messages: [
      msg({
        from: P.sarah,
        to: [P.ava],
        at: daysAgo(1.8),
        body: `Hi Ava,

Just circling back on the Lumen Robotics NDA — could you confirm whether Marcus has signed the attached copy so we can close the file? No rush beyond this week.

Regards,
Sarah Okafor
Brightline Legal`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Harvard Business Review: This Week\'s Reads',
    participants: [P.hbr],
    messages: [
      msg({
        from: P.hbr,
        to: TO_MARCUS,
        at: hoursAgo(14),
        body: `This week: Why great teams argue — and five ways to run a better meeting.

Read the full issue: https://hbr.org/this-week

You're receiving this email because you subscribed to HBR Daily.

Unsubscribe | Email preferences`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: '[GitHub] Security alert: new sign-in to your account',
    participants: [P.github],
    messages: [
      msg({
        from: P.github,
        to: TO_MARCUS,
        at: hoursAgo(40),
        body: `A new sign-in to your account from Safari on macOS (London, UK).

If this was you, no action is needed.

This is an automated message — please do not reply.`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Your October statement is ready',
    participants: [P.sterling],
    messages: [
      msg({
        from: P.sterling,
        to: TO_MARCUS,
        at: daysAgo(4),
        body: `Your monthly statement for October is available to view in the client portal. Portfolio value is up 2.4% month on month.

This is an automated notification. Do not reply to this email.`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Meeting notes: ops sync, 12 November',
    participants: [P.james],
    messages: [
      msg({
        from: P.james,
        to: [P.marcus, P.ava],
        at: daysAgo(2.6),
        body: `Good morning,

Sharing the notes from Thursday's ops sync for visibility. The migration is complete, the hiring plan is on track, and the office relocation slips to next month.

No action needed from anyone.

Cheers,
James Okafor
COO, Reed Advisory Group`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Weekly digest: 12 new opportunities',
    participants: [P.linkedin],
    messages: [
      msg({
        from: P.linkedin,
        to: TO_MARCUS,
        at: daysAgo(3.4),
        body: `Your weekly digest is here: 12 new roles match your search, and 3 people viewed your profile this week.

View all recommendations

Unsubscribe from these emails`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Re: Podcast recording — running order',
    participants: [P.producer],
    messages: [
      msg({
        from: P.producer,
        to: [P.marcus, P.ava],
        at: daysAgo(1.9),
        body: `Hi both,

We're confirmed for the recording on ${med(inDays(4))} at 15:00 in Soho. Running order is attached — no action needed from you, we'll send the car details the day before.

Best,
Dan Fenton
Signal Media`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_gmail',
    subject: 'Quick touch base',
    participants: [P.nick],
    unread: true,
    messages: [
      msg({
        from: P.nick,
        to: TO_MARCUS,
        at: hoursAgo(7),
        body: `Hi Marcus, hope you're well.

Just wanted to touch base about a few things when you have a moment — nothing urgent, but I'd love to catch up properly soon.

N.`,
      }),
    ],
  }),

  buildConv({
    clientId: MARCUS.id,
    accountId: 'acc_marcus_outlook',
    subject: 'Partner dinner — date & guest list',
    participants: [P.claire],
    unread: true,
    messages: [
      msg({
        from: P.claire,
        to: [P.marcus, P.ava],
        at: hoursAgo(27),
        body: `Hi both,

Please confirm the date that works for the partner dinner — Marcus, we'd value your thoughts on the final guest list too, since the two are linked.

Best,
Claire Duval`,
      }),
    ],
  }),
];

const elenaConvos = [
  buildConv({
    clientId: ELENA.id,
    accountId: 'acc_elena_gmail',
    subject: 'Brand guidelines v3 — approval needed',
    participants: [{ name: 'Ravi Kapoor', email: 'ravi@formandfield.co' }],
    important: true,
    unread: true,
    messages: [
      msg({
        from: { name: 'Ravi Kapoor', email: 'ravi@formandfield.co' },
        to: TO_ELENA,
        at: hoursAgo(11),
        body: `Hi Elena,

Version 3 of the brand guidelines is ready for your review — we've reworked the type scale and simplified the colour ramp.

Could you give your approval by ${med(FRI)} so we can roll it out to the team?

Thanks,
Ravi Kapoor
Form & Field`,
      }),
    ],
  }),
  buildConv({
    clientId: ELENA.id,
    accountId: 'acc_elena_gmail',
    subject: 'Studio insurance renewal — invoice attached',
    participants: [{ name: 'Helen Boyd', email: 'helen@bayinsurance.co.uk' }],
    messages: [
      msg({
        from: { name: 'Helen Boyd', email: 'helen@bayinsurance.co.uk' },
        to: [P.ava, P.elena],
        at: daysAgo(2),
        body: `Hi Ava,

Please find the invoice for the studio insurance renewal (ref 8830). Could you confirm the PO number so we can process it before the cover date?

Kind regards,
Helen Boyd
Bay Insurance`,
      }),
    ],
  }),
  buildConv({
    clientId: ELENA.id,
    accountId: 'acc_elena_gmail',
    subject: 'Adobe Creative Cloud — your invoice is ready',
    participants: [{ name: 'Adobe', email: 'noreply@adobe.com' }],
    messages: [
      msg({
        from: { name: 'Adobe', email: 'noreply@adobe.com' },
        to: TO_ELENA,
        at: daysAgo(5),
        body: `Your invoice for Adobe Creative Cloud is ready to view in your account.

This is an automated message. Please do not reply to this email.

Unsubscribe`,
      }),
    ],
  }),
  buildConv({
    clientId: ELENA.id,
    accountId: 'acc_elena_outlook',
    subject: 'Re: Shoot dates — December availability',
    participants: [{ name: 'Noor Hassan', email: 'noor@lumenfilms.com' }],
    messages: [
      msg({
        from: { name: 'Noor Hassan', email: 'noor@lumenfilms.com' },
        to: [P.ava, P.elena],
        at: hoursAgo(30),
        body: `Hi Ava,

Could you let us know which of the first two weeks in December work for the studio shoot? We'd like to lock the crew by the end of next week.

Best,
Noor Hassan
Lumen Films`,
      }),
    ],
  }),
];

const drafts = [
  {
    id: uid('drf'),
    conversationId: marcusConvos[0].id,
    clientId: MARCUS.id,
    text: `Hi Laura,

Thanks for the revised term sheet — I've passed it straight to Marcus with a note that the committee deadline is ${med(WED)}.

You'll have his decision before then. If anything in the protective provisions needs a quick call to unpack, send me two windows that suit and I'll set it up.

Best regards,
Ava Bennett
Personal Assistant to Marcus Reed`,
    tone: 'professional',
    variant: 0,
    status: 'draft',
    createdAt: hoursAgo(2),
    notes: ['Holds the line while the client prepares a personal answer'],
  },
];

const activity = [
  {
    id: uid('act'),
    clientId: MARCUS.id,
    type: 'classify',
    text: 'AI classified “regulator filing — response required” as Client to reply',
    at: hoursAgo(8.8),
  },
  {
    id: uid('act'),
    clientId: MARCUS.id,
    type: 'incoming',
    text: 'Synced 18 new messages from Gmail',
    at: hoursAgo(9.2),
  },
  {
    id: uid('act'),
    clientId: MARCUS.id,
    type: 'draft',
    text: 'Draft reply prepared for “Term sheet — Northbridge Capital”',
    at: hoursAgo(2),
  },
  {
    id: uid('act'),
    clientId: MARCUS.id,
    type: 'override',
    text: 'Ava corrected “Parking permits” from Needs review to Assistant to reply',
    at: daysAgo(2.1),
  },
  {
    id: uid('act'),
    clientId: MARCUS.id,
    type: 'sync',
    text: 'Outlook account reconnected — 42 messages backfilled',
    at: daysAgo(1.5),
  },
  {
    id: uid('act'),
    clientId: ELENA.id,
    type: 'classify',
    text: 'AI classified “Brand guidelines v3” as Client to reply',
    at: hoursAgo(10.8),
  },
];

export function buildSeed() {
  const conversations = [...marcusConvos, ...elenaConvos];

  const users = [
    {
      id: 'usr_ava',
      name: 'Ava Bennett',
      email: ASSISTANT.email,
      password: hashPassword('demo1234'),
      role: 'assistant',
      title: 'Personal Assistant',
      createdAt: daysAgo(120),
    },
    {
      id: 'usr_marcus',
      name: 'Marcus Reed',
      email: 'marcus@reedadvisory.com',
      password: hashPassword('demo1234'),
      role: 'client',
      clientId: MARCUS.id,
      title: MARCUS.title,
      createdAt: daysAgo(120),
    },
    {
      id: 'usr_elena',
      name: 'Elena Vasquez',
      email: 'elena@vasquezstudio.com',
      password: hashPassword('demo1234'),
      role: 'client',
      clientId: ELENA.id,
      title: ELENA.title,
      createdAt: daysAgo(90),
    },
  ];

  const clients = CLIENTS.map((c) => ({
    ...c,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(1),
  }));

  const accounts = [
    {
      id: 'acc_marcus_gmail',
      clientId: MARCUS.id,
      provider: 'gmail',
      address: 'marcus.reed@gmail.com',
      label: 'Personal Gmail',
      status: 'connected',
      lastSyncAt: hoursAgo(0.15),
      messages: 1284,
      scopes: ['read', 'modify', 'labels'],
      createdAt: daysAgo(120),
    },
    {
      id: 'acc_marcus_outlook',
      clientId: MARCUS.id,
      provider: 'outlook',
      address: 'marcus@reedadvisory.com',
      label: 'Advisory (Microsoft 365)',
      status: 'connected',
      lastSyncAt: hoursAgo(0.6),
      messages: 863,
      scopes: ['Mail.ReadWrite', 'offline_access'],
      createdAt: daysAgo(120),
    },
    {
      id: 'acc_elena_gmail',
      clientId: ELENA.id,
      provider: 'gmail',
      address: 'elena@vasquezstudio.com',
      label: 'Studio Gmail',
      status: 'connected',
      lastSyncAt: hoursAgo(1.2),
      messages: 412,
      scopes: ['read', 'modify', 'labels'],
      createdAt: daysAgo(90),
    },
    {
      id: 'acc_elena_outlook',
      clientId: ELENA.id,
      provider: 'outlook',
      address: 'studio@vasquezstudio.com',
      label: 'Studio (Microsoft 365)',
      status: 'error',
      error: 'Authorization expired — reconnect to resume syncing',
      lastSyncAt: daysAgo(3),
      messages: 96,
      scopes: ['Mail.ReadWrite', 'offline_access'],
      createdAt: daysAgo(90),
    },
  ];

  return { users, clients, accounts, conversations, drafts, activity };
}
