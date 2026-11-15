import { buildSeed } from '../src/store/seed.js';

const seed = buildSeed();
const order = ['assistant', 'client', 'none', 'review'];
let mismatches = 0;

for (const group of order) {
  const rows = seed.conversations.filter((c) => c.classification.responsibility === group);
  console.log(`\n=== ${group.toUpperCase()} (${rows.length}) ===`);
  for (const c of rows) {
    console.log(
      `  ${String(c.classification.confidence).padStart(3)}%  ${c.subject}`
    );
    console.log(`        ${c.classification.reason}`);
    console.log(`        signals: ${c.classification.signals.join(' | ') || '—'}`);
  }
}

console.log('\n=== MEETINGS ===');
for (const c of seed.conversations.filter((c) => c.meeting)) {
  console.log(`  ${c.subject} → ${c.meeting.status} @ ${new Date(c.meeting.start).toLocaleString('en-GB')}`);
}

console.log('\n=== SEGMENTS ===');
const { segmentsFor } = await import('../src/util/segments.js');
const counts = {};
for (const c of seed.conversations) {
  for (const s of segmentsFor(c)) counts[s] = (counts[s] || 0) + 1;
}
console.log(counts);
console.log(`\ntotal conversations: ${seed.conversations.length}`);
void mismatches;
