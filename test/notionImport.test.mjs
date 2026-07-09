import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeImageUrl, blockText, normalizeOutcome, propertyValue, richTextPlain } from '../server/notion.js';

test('Notion rich text and property values normalize into plain journal fields', () => {
  assert.equal(richTextPlain([{ plain_text: 'MNQ ' }, { plain_text: 'Short' }]), 'MNQ Short');
  assert.equal(propertyValue({ type: 'select', select: { name: 'Win' } }), 'Win');
  assert.equal(propertyValue({ type: 'multi_select', multi_select: [{ name: 'SMT' }, { name: 'IFVG' }] }), 'SMT, IFVG');
  assert.equal(propertyValue({ type: 'date', date: { start: '2026-07-08' } }), '2026-07-08');
});

test('Notion outcome falls back to P&L when the outcome property is missing', () => {
  assert.equal(normalizeOutcome('', '+450'), 'Win');
  assert.equal(normalizeOutcome('', '-200'), 'Loss');
  assert.equal(normalizeOutcome('', '0'), 'BE');
  assert.equal(normalizeOutcome('break even', '-100'), 'BE');
});

test('Notion block text includes captions so screenshot context is not lost', () => {
  const block = {
    type: 'image',
    image: {
      caption: [{ plain_text: 'Execution screenshot' }],
    },
  };
  assert.equal(blockText(block), 'Execution screenshot');
});

test('Notion image imports reject local or non-HTTPS URLs', () => {
  assert.equal(assertSafeImageUrl('https://s3.us-west-2.amazonaws.com/example/chart.png'), 'https://s3.us-west-2.amazonaws.com/example/chart.png');
  assert.throws(() => assertSafeImageUrl('http://example.com/chart.png'), /HTTPS/u);
  assert.throws(() => assertSafeImageUrl('https://localhost/chart.png'), /local or private/u);
  assert.throws(() => assertSafeImageUrl('https://127.0.0.1/chart.png'), /local or private/u);
  assert.throws(() => assertSafeImageUrl('https://192.168.1.1/chart.png'), /local or private/u);
  assert.throws(() => assertSafeImageUrl('https://[fc00::1]/chart.png'), /local or private/u);
  assert.throws(() => assertSafeImageUrl('https://[fe80::1]/chart.png'), /local or private/u);
  assert.throws(() => assertSafeImageUrl('https://metadata.google.internal/chart.png'), /local or private/u);
  assert.throws(() => assertSafeImageUrl('file:///etc/passwd'), /HTTPS/u);
});
