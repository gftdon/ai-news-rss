'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { scrape } = require('../scrapers/minimax');
const { stubFetch } = require('./helpers');

// Snapshot of https://www.minimax.io/blog taken 2026-11-10 (Oct 2026
// redesign: a.BlogList_card with <h2> title and <time datetime>), with
// <script>/<style>/<svg> bodies stripped.
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'minimax-blog.html'), 'utf-8');

async function scrapeFixture() {
  const stub = stubFetch(fixture);
  try {
    return await scrape();
  } finally {
    stub.restore();
  }
}

test('parses every blog card, including the featured one', async () => {
  const { items } = await scrapeFixture();
  assert.equal(items.length, 14);
  const featured = items.find((i) => i.link === 'https://www.minimax.io/blog/minimax-m31f');
  assert.ok(featured, 'featured card missing');
  assert.equal(featured.title, 'MiniMax M3.1 Flash: Redefining Agent Performance and Cost');
});

test('takes dates from <time datetime>', async () => {
  const { items } = await scrapeFixture();
  const item = items.find((i) => i.link === 'https://www.minimax.io/blog/minimax-code-mini-app-1792650729');
  assert.equal(item.title, 'Introducing MiniMax Code Mini App');
  assert.equal(item.pubDate.toISOString(), '2026-10-22T06:32:09.000Z');
});

test('skips header/menu links and card chrome text', async () => {
  const { items } = await scrapeFixture();
  const links = items.map((i) => i.link);
  assert.equal(new Set(links).size, links.length);
  for (const item of items) {
    assert.doesNotMatch(item.title, /NEW$|Learn More/);
    assert.doesNotMatch(item.description, /Learn More/);
  }
});
