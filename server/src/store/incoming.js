export const INCOMING_QUEUE = [
  {
    kind: 'append',
    clientId: 'cli_marcus',
    accountId: 'acc_marcus_outlook',
    appendToSubject: 'Re: Website migration — final sign-off before deploy',
    note: 'New message flips an existing thread back to the client',
    message: {
      from: { name: 'Tom Bianchi', email: 'tom@pixelworks.io' },
      to: [{ name: 'Marcus Reed', email: 'marcus.reed@gmail.com' }, { name: 'Ava Bennett', email: 'ava@northstarassist.com' }],
      body: `Hi both,

Sorry to chase — the deploy window closes tomorrow afternoon and we still need Marcus's sign-off on the pricing table before we can go live.

Marcus, could you give us a yes or no by tomorrow morning? Once we have it the launch takes twenty minutes.

Thanks,
Tom Bianchi
Pixelworks`,
    },
  },
  {
    kind: 'new',
    clientId: 'cli_marcus',
    accountId: 'acc_marcus_gmail',
    message: {
      from: { name: 'Dr. Alvarez', email: 'reception@alvarezclinic.com' },
      to: [{ name: 'Ava Bennett', email: 'ava@northstarassist.com' }, { name: 'Marcus Reed', email: 'marcus.reed@gmail.com' }],
      subject: 'Annual check-up — can we reschedule?',
      body: `Hello Ava,

Marcus's annual check-up needs moving. Are you free ${new Date(Date.now() + 6 * 86400_000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at 8:45 AM, or the following morning at 11:00?

Let me know which suits and I'll update the diary.

Kind regards,
Alvarez Clinic Reception`,
    },
  },
  {
    kind: 'new',
    clientId: 'cli_marcus',
    accountId: 'acc_marcus_gmail',
    message: {
      from: { name: 'Laura Chen', email: 'laura@northbridgecap.com' },
      to: [{ name: 'Marcus Reed', email: 'marcus.reed@gmail.com' }],
      subject: 'Re: Term sheet — Northbridge Capital (revised)',
      body: `Hi Marcus,

One more thing before committee: the board would like your view on the pro-rata rights — it's the last open point on the term sheet.

Could you send your decision by tomorrow evening so we can finalise?

Best regards,
Laura Chen
Partner, Northbridge Capital`,
    },
  },
  {
    kind: 'new',
    clientId: 'cli_marcus',
    accountId: 'acc_marcus_outlook',
    message: {
      from: { name: 'TechDaily', email: 'newsletter@techdaily.io' },
      to: [{ name: 'Marcus Reed', email: 'marcus.reed@gmail.com' }],
      subject: 'Black Friday: 40% off annual plans + this week in tech',
      body: `This week: chips, chips and more chips — plus our partner offer of 40% off annual plans.

Read the full edition: https://techdaily.io/edition

You're receiving this because you subscribed to TechDaily Weekly.

Unsubscribe | Manage preferences`,
    },
  },
  {
    kind: 'new',
    clientId: 'cli_marcus',
    accountId: 'acc_marcus_outlook',
    message: {
      from: { name: 'Greg Palmer', email: 'greg.palmer@gmail.com' },
      to: [{ name: 'Marcus Reed', email: 'marcus.reed@gmail.com' }],
      subject: 'Re: the thing we discussed',
      body: `Marcus — following our conversation at the club, I'd value your read on it when you have a moment. No rush, but I'd rather not sit on it too long.

G.`,
    },
  },
];
