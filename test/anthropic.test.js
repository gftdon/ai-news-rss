'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parse } = require('../scrapers/anthropic');

// Snapshot of https://www.anthropic.com/news taken 2026-11-10 (after the
// Oct 2026 redesign), with <script>/<style>/<svg> bodies stripped.
const fixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'anthropic-news.html'),
  'utf-8'
);

const byLink = (items, link) => items.find((i) => i.link === link);

test('includes top-level announcement with title, date and category', () => {
  const { items } = parse(fixture);
  const item = byLink(items, 'https://www.anthropic.com/claude-fable-and-mythos-5-2');
  assert.ok(item, `5.2 launch missing from: ${items.map((i) => i.link).join(', ')}`);
  assert.equal(item.title, 'Introducing Claude Fable 5.2 and Claude Mythos 5.2');
  assert.equal(item.pubDate.getTime(), new Date('Nov 9, 2026').getTime());
  assert.match(item.description, /^\[Announcements\] Our most capable models/);
});

test('parses every row of the publication list', () => {
  const { items } = parse(fixture);
  assert.equal(items.length, 24);
  for (const link of [
    'https://www.anthropic.com/news/ai-for-science-expands-foundations-research-institutions',
    'https://www.anthropic.com/news/s1-sec',
    'https://www.anthropic.com/claude-haiku-5-5',
    'https://www.anthropic.com/features/ebola-response',
    'https://www.anthropic.com/news/life-sciences-verification-program',
  ]) {
    assert.ok(byLink(items, link), link);
  }
});

test('takes each date from the page, never the scrape time', () => {
  const { items } = parse(fixture);
  for (const item of items) {
    assert.ok(item.pubDate instanceof Date, item.link);
    assert.ok(item.pubDate.getTime() < new Date('Nov 10, 2026').getTime(), item.link);
  }
  const s1 = byLink(items, 'https://www.anthropic.com/news/s1-sec');
  assert.equal(s1.pubDate.getTime(), new Date('Oct 26, 2026').getTime());
  assert.match(s1.description, /^\[Announcements\] /);
});

test('skips navigation, category, mailto, external and anchor links', () => {
  const { items } = parse(fixture);
  for (const item of items) {
    assert.match(item.link, /^https:\/\/www\.anthropic\.com\/[^#]/);
    assert.notEqual(item.link, 'https://www.anthropic.com/news');
    assert.doesNotMatch(item.link, /\/news\/(announcements|partnerships|product|policy|societal-impacts)$/);
  }
});

test('orders items newest first', () => {
  const { items } = parse(fixture);
  for (let i = 1; i < items.length; i++) {
    assert.ok(
      items[i - 1].pubDate.getTime() >= items[i].pubDate.getTime(),
      `${items[i - 1].title} should not come before ${items[i].title}`
    );
  }
});
