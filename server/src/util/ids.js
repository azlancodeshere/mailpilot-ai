import crypto from 'node:crypto';

let counter = 0;

export function uid(prefix = 'id') {
  counter = (counter + 1) % 46656;
  const t = Date.now().toString(36).padStart(9, '0');
  const c = counter.toString(36).padStart(3, '0');
  const r = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${t}${c}${r}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function hoursAgo(h) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export function daysAgo(d) {
  return new Date(Date.now() - d * 86400_000).toISOString();
}
