'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeFeed } = require('../lib/write-feed');

const META = { title: 'T', link: 'https://example.com/', description: 'D' };
const ITEM = {
  title: 'Post',
  link: 'https://example.com/post',
  description: 'Body',
  pubDate: new Date('2026-11-09T00:00:00Z'),
};

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-feed-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function captureWarnings(t) {
  const warnings = [];
  t.mock.method(console, 'warn', (msg) => warnings.push(String(msg)));
  t.mock.method(console, 'log', () => {});
  return warnings;
}

test('writes the feed when it has items', (t) => {
  const dir = tmpDir(t);
  captureWarnings(t);
  const result = writeFeed('demo', { ...META, items: [ITEM] }, dir);
  assert.deepEqual(result, { name: 'demo', itemCount: 1, written: true });
  assert.match(fs.readFileSync(path.join(dir, 'demo.xml'), 'utf-8'), /<link>https:\/\/example\.com\/post<\/link>/);
});

test('keeps the previous file when the scrape returns 0 items', (t) => {
  const dir = tmpDir(t);
  const warnings = captureWarnings(t);
  const file = path.join(dir, 'demo.xml');
  fs.writeFileSync(file, 'PREVIOUS');

  const result = writeFeed('demo', { ...META, items: [] }, dir);

  assert.deepEqual(result, { name: 'demo', itemCount: 0, written: false });
  assert.equal(fs.readFileSync(file, 'utf-8'), 'PREVIOUS');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /demo.*0 items/);
});

test('does not create an empty feed when there is no previous file', (t) => {
  const dir = tmpDir(t);
  captureWarnings(t);
  writeFeed('demo', { ...META, items: [] }, dir);
  assert.equal(fs.existsSync(path.join(dir, 'demo.xml')), false);
});

test('emits a GitHub Actions warning annotation in CI', (t) => {
  const dir = tmpDir(t);
  const warnings = captureWarnings(t);
  const saved = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = 'true';
  t.after(() => {
    if (saved === undefined) delete process.env.GITHUB_ACTIONS;
    else process.env.GITHUB_ACTIONS = saved;
  });

  writeFeed('demo', { ...META, items: [] }, dir);

  assert.match(warnings[0], /^::warning title=Empty feed \(demo\)::demo returned 0 items/);
});
