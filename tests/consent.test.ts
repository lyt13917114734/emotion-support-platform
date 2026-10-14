import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONSENT_BRIEF, CONSENT_VERSION, CONSENT_STORAGE_KEY, resetReading, readReceipt, markDocumentEnd, confirmReading, canEnterRegistration, guardedEntry, entryFromHash } from '../lib/consent.ts';

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

void test('portfolio notice matches its version and excludes real contact details', () => {
  assert.ok(Array.from(CONSENT_BRIEF).length < 200);
  const source = JSON.parse(readFileSync(new URL('../lib/consent-document.json', import.meta.url), 'utf8'));
  assert.equal(source.version, CONSENT_VERSION);
  assert.ok(source.paragraphs.length > 0);
  assert.doesNotMatch(JSON.stringify(source), /13917114734|51273200130|45元/);
});

void test('registration is blocked until document end AND active checkbox confirmation', () => {
  const storage = memoryStorage();
  assert.equal(guardedEntry('register', readReceipt(storage)), 'consent-summary');
  resetReading(storage);
  assert.throws(() => confirmReading(storage, true, true));
  assert.throws(() => confirmReading(storage, false, false));
  markDocumentEnd(storage);
  assert.equal(canEnterRegistration(readReceipt(storage)), false);
  assert.throws(() => confirmReading(storage, false, true));
  assert.throws(() => confirmReading(storage, true, false));
  const time = new Date('2026-09-08T10:00:00.000Z');
  confirmReading(storage, true, true, time);
  assert.equal(guardedEntry('register', readReceipt(storage)), 'register');
  assert.deepEqual(readReceipt(storage), { viewedFull: true, confirmedAt: time.toISOString(), version: CONSENT_VERSION });
  assert.equal(storage.data.size, 1);
});

void test('first participation resets prior reading; viewing alone never creates confirmation', () => {
  const storage = memoryStorage();
  markDocumentEnd(storage); confirmReading(storage, true, true);
  resetReading(storage);
  assert.deepEqual(readReceipt(storage), { viewedFull: false, confirmedAt: null, version: CONSENT_VERSION });
  markDocumentEnd(storage);
  assert.equal(readReceipt(storage)?.confirmedAt, null);
  assert.equal(canEnterRegistration(readReceipt(storage)), false);
});

void test('outdated, malformed, extra-field and signature-only receipts fail closed', () => {
  const storage = memoryStorage();
  for (const value of [
    'broken JSON', 'null', '[]',
    JSON.stringify({ viewedFull: true, confirmedAt: '2026-09-08T10:00:00.000Z', version: 'old' }),
    JSON.stringify({ viewedFull: true, confirmedAt: 'invalid date', version: CONSENT_VERSION }),
    JSON.stringify({ viewedFull: false, confirmedAt: '2026-09-08T10:00:00.000Z', version: CONSENT_VERSION }),
    JSON.stringify({ viewedFull: true, confirmedAt: '2026-09-08T10:00:00.000Z', version: CONSENT_VERSION, signed: true }),
    JSON.stringify({ signed: true }),
  ]) {
    storage.setItem(CONSENT_STORAGE_KEY, value);
    assert.equal(readReceipt(storage), null);
    assert.equal(guardedEntry('register', readReceipt(storage)), 'consent-summary');
  }
});

void test('storage errors cannot bypass the reading gate', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readReceipt(storage), null);
  assert.throws(() => resetReading(storage));
  assert.throws(() => markDocumentEnd(storage));
  assert.throws(() => confirmReading(storage, true, true));
});

void test('static-compatible hash pages preserve direct registration protection', () => {
  assert.equal(entryFromHash('#register'), 'register');
  assert.equal(entryFromHash('#consent-summary'), 'consent-summary');
  assert.equal(entryFromHash('#consent-full'), 'consent-full');
  assert.equal(entryFromHash(''), 'entry');
  assert.equal(entryFromHash('#main-content'), null);
  assert.equal(guardedEntry('register', null), 'consent-summary');
  assert.equal(guardedEntry('consent-full', null), 'consent-summary');
  assert.equal(guardedEntry('consent-full', null, true), 'consent-full');
});
