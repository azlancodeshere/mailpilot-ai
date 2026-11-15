const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, weds: 3, wed: 3, thursday: 4, thurs: 4, thu: 4, thur: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const WEEK_RE = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

function resolveYear(month, day, now) {
  let year = now.getFullYear();
  let date = new Date(year, month, day);

  if (date.getTime() < now.getTime() - 36 * 3600_000) {
    date = new Date(year + 1, month, day);
  }
  return date;
}

function nextWeekday(target, now) {
  const diff = (target - now.getDay() + 7) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() + (diff === 0 ? 0 : diff));
  return d;
}

export function extractDates(text, now = new Date()) {
  if (!text) return [];
  const found = [];
  const seen = new Set();
  let m;

  const push = (label, date, kind = 'date', precision = 'day') => {
    if (!date || Number.isNaN(date.getTime())) return;
    const key = `${date.toDateString()}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ label: label.trim().replace(/\s+/g, ' '), iso: date.toISOString(), kind, precision });
  };

  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})[a-z]*\\.?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
  while ((m = dayFirst.exec(text))) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = Number(m[1]);
    let date = m[3] ? new Date(Number(m[3]), month, day) : resolveYear(month, day, now);
    push(m[0], date);
  }

  const monthFirst = new RegExp(`\\b(${MONTH_RE})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi');
  while ((m = monthFirst.exec(text))) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    const date = m[3] ? new Date(Number(m[3]), month, day) : resolveYear(month, day, now);
    push(m[0], date);
  }

  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = isoRe.exec(text))) {
    push(m[0], new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  const wdRe = new RegExp(`\\b(${WEEK_RE})\\b`, 'gi');
  while ((m = wdRe.exec(text))) {
    const target = WEEKDAYS[m[1].toLowerCase()];
    push(m[0], nextWeekday(target, now));
  }

  if (/\btomorrow\b/i.test(text)) {
    const t = new Date(now);
    t.setDate(now.getDate() + 1);
    push('tomorrow', t);
  }
  if (/\btoday\b|\bby eod\b|\bend of day\b/i.test(text)) {
    push('today', new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const timeRe = new RegExp(`\\b(\\d{1,2})(?::(\\d{2}))?\\s?(am|pm)\\b`, 'gi');
  let timeMatch;
  const times = [];
  while ((timeMatch = timeRe.exec(text))) {
    let hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3].toLowerCase() === 'pm') hour += 12;
    times.push({ label: timeMatch[0], hour, minute: Number(timeMatch[2] || 0) });
  }

  found.sort((a, b) => new Date(a.iso) - new Date(b.iso));

  if (found.length && times.length) {
    for (const line of text.split('\n')) {
      const t = times.find((x) => line.includes(x.label));
      const d = found.find((x) => line.includes(x.label.replace(/\s+/g, ' ')) || line.toLowerCase().includes(x.label.toLowerCase()));
      if (t && d) {
        const date = new Date(d.iso);
        date.setHours(t.hour, t.minute, 0, 0);
        d.iso = date.toISOString();
        d.kind = 'datetime';
        d.precision = 'minute';
        d.timeLabel = t.label;
        break;
      }
    }
  }

  return found;
}

export function hasDeadline(text) {
  if (!text) return false;
  return (
    /\b(by|before|until|due|deadline|no later than|respond by|get back to)\b[^.\n]{0,60}\b(today|tomorrow|eod|end of (day|week|month)|monday|tuesday|wednesday|thursday|friday|weekend|\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{4}-\d{2}-\d{2})/i.test(
      text
    ) || /\burgently?\b|\basap\b|\bpriority\b/i.test(text)
  );
}
