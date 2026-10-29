import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVektoriJournalMessages } from '../utils/vektori/payload.js';

test('buildVektoriJournalMessages includes lifecycle metadata', () => {
  const messages = buildVektoriJournalMessages({
    journalId: 'journal-123',
    title: 'A quiet morning',
    content: 'I felt calmer after writing.',
    mood: 'calm',
    entryDate: '2026-05-30',
    createdAt: '2026-05-30T09:00:00.000Z',
    updatedAt: '2026-05-30T10:00:00.000Z',
    eventType: 'update',
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, 'user');
  assert.ok(messages[0].content.includes('Journal ID: journal-123'));
  assert.ok(messages[0].content.includes('Event: update'));
  assert.ok(messages[0].content.includes('Mood: calm'));
  assert.ok(messages[0].content.includes('Entry Date: 2026-05-30'));
  assert.ok(messages[0].content.includes('Created At: 2026-05-30T09:00:00.000Z'));
});

test('buildVektoriJournalMessages skips empty plaintext journals', () => {
  const messages = buildVektoriJournalMessages({
    journalId: 'journal-empty',
    eventType: 'backfill',
  });

  assert.deepEqual(messages, []);
});
