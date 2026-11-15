import { segmentsFor } from './segments.js';

export function senderOf(conv) {
  const inbound = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
  return inbound?.from || conv.participants?.[0] || null;
}

export function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

export function listItem(conv, drafts = []) {
  return {
    id: conv.id,
    clientId: conv.clientId,
    accountId: conv.accountId,
    subject: conv.subject,
    preview: conv.preview || '',
    sender: senderOf(conv),
    participants: conv.participants || [],
    messageCount: conv.messages?.length || 0,
    lastActivityAt: conv.lastActivityAt,
    createdAt: conv.createdAt,
    unread: !!conv.flags?.unread,
    important: !!conv.flags?.important,
    flags: conv.flags,
    classification: conv.classification,
    segments: segmentsFor(conv),
    meeting: conv.meeting || null,
    summaryText: conv.summary?.text || '',
    draftCount: drafts.filter((d) => d.conversationId === conv.id && d.status === 'draft').length,
    handledVia: conv.handledVia || null,
  };
}

export function detailItem(conv, drafts = []) {
  return {
    ...listItem(conv, drafts),
    messages: conv.messages,
    summary: conv.summary,
    history: conv.history || [],
    drafts: drafts.filter((d) => d.conversationId === conv.id),
  };
}

export async function logActivity(store, { clientId, type, text, at }) {
  const doc = {
    id: `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    clientId,
    type,
    text,
    at: at || new Date().toISOString(),
  };
  await store.activity.insert(doc);
  return doc;
}

export const ACTIVITY_ICONS = {
  classify: 'sparkles',
  incoming: 'mail',
  override: 'pencil',
  draft: 'wand',
  sync: 'refresh',
  client_action: 'userCheck',
  reply: 'send',
  system: 'info',
};
