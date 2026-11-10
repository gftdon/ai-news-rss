'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { scrape } = require('../scrapers/kimi');
const { stubFetch } = require('./helpers');

// Snapshot of https://www.kimi.com/en/blog/ taken 2026-11-10 (Next.js
// rebuild: cards are <div class="menu-card"> with an overlay <a>),
// with <script>/<style>/<svg> bodies stripped.
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'kimi-blog.html'), 'utf-8');

async function scrapeFixture() {
  const stub = stubFetch(fixture);
  try {
    return { feed: await scrape(), calls: stub.calls };
  } finally {
    stub.restore();
  }
}

test('fetches the English blog (/blog/ now serves Chinese)', async () => {
  const { calls } = await scrapeFixture();
  assert.equal(calls[0].url, 'https://www.kimi.com/en/blog/');
});

test('parses div-based cards with title, link and date', async () => {
  const { feed } = await scrapeFixture();
  const first = feed.items[0];
  assert.equal(first.title, 'Kimi K3.1 Pro');
  assert.equal(first.link, 'https://www.kimi.com/en/blog/kimi-k3-1-pro');
  assert.equal(first.pubDate.toISOString(), '2026-10-24T00:00:00.000Z');
});

test('skips the hero duplicate and keeps external card links', async () => {
  const { feed } = await scrapeFixture();
  const links = feed.items.map((i) => i.link);
  assert.equal(feed.items.length, 20);
  assert.equal(new Set(links).size, links.length);
  assert.ok(links.includes('https://www.kimi.com/en/blog/kimi-k3'));
  assert.ok(links.includes('https://huggingface.co/moonshotai/Kimi-K2-Instruct-0905'));
});
