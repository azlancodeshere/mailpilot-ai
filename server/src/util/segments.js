export const SEGMENT_META = [
  { id: 'inbox', label: 'All conversations', group: 'mailbox', icon: 'inbox' },
  { id: 'unread', label: 'Unread', group: 'mailbox', icon: 'mail' },

  { id: 'assistant', label: 'Assistant to reply', group: 'responsibility', icon: 'bot' },
  { id: 'client', label: 'Client to reply', group: 'responsibility', icon: 'user' },
  { id: 'none', label: 'No reply needed', group: 'responsibility', icon: 'check' },
  { id: 'review', label: 'Needs review', group: 'responsibility', icon: 'alert' },

  { id: 'action', label: 'Action required', group: 'workflow', icon: 'zap' },
  { id: 'waiting', label: 'Waiting for response', group: 'workflow', icon: 'clock' },
  { id: 'meetings', label: 'Meetings & appointments', group: 'workflow', icon: 'calendar' },
  { id: 'important', label: 'Important', group: 'workflow', icon: 'star' },

  { id: 'general', label: 'General', group: 'workflow', icon: 'layers' },
  { id: 'completed', label: 'Completed', group: 'mailbox', icon: 'circleCheck' },
  { id: 'archived', label: 'Archived', group: 'mailbox', icon: 'archive' },
];

export function segmentsFor(conv) {
  const s = new Set();
  const r = conv.classification?.responsibility;
  const f = conv.flags || {};

  if (f.archived) return ['archived'];

  s.add('inbox');
  if (f.unread) s.add('unread');
  if (r === 'assistant') s.add('assistant');
  if (r === 'client') s.add('client');
  if (r === 'none') s.add('none');
  if (r === 'review') s.add('review');
  if (f.requiresAction && !f.completed) s.add('action');
  if (f.awaitingResponse && !f.completed) s.add('waiting');
  if (conv.meeting) s.add('meetings');
  if (f.important) s.add('important');
  if (f.completed) s.add('completed');

  const workflowHits = ['action', 'waiting', 'meetings', 'important'].some((k) => s.has(k));
  if (!workflowHits && r !== 'review') s.add('general');

  return [...s];
}

export function inSegment(conv, segment) {
  if (!segment || segment === 'all') return true;
  return segmentsFor(conv).includes(segment);
}
