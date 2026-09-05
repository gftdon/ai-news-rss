'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parse } = require('../scrapers/anthropic');

const fixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'anthropic-news.html'),
  'utf-8'
);

test('includes featured article whose URL has no /news/ prefix', () => {
  const { items } = parse(fixture);
  const links = items.map((i) => i.link);
  assert.ok(
    links.includes('https://www.anthropic.com/claude-fable-and-mythos-5-1'),
    `hero link missing from: ${links.join(', ')}`
  );
});

test('keeps every /news/ article from the publication list', () => {
  const { items } = parse(fixture);
  const links = items.map((i) => i.link);
  for (const slug of [
    'enterprise-frontier-safeguards',
    'improving-alignment-security-efforts',
    'model-hardware-standard-research-preview',
    'position-open-weights-models',
  ]) {
    assert.ok(links.includes(`https://www.anthropic.com/news/${slug}`), slug);
  }
});

test('skips navigation, mailto, external and anchor links', () => {
  const { items } = parse(fixture);
  for (const item of items) {
    assert.match(item.link, /^https:\/\/www\.anthropic\.com\/[^#]/);
    assert.notEqual(item.link, 'https://www.anthropic.com/news');
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
