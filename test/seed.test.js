'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { scrape } = require('../scrapers/seed');
const { stubFetch } = require('./helpers');

// First 5 papers from get_article_list_v2?article_type=1 (fetched
// 2026-11-10 with x-tt-locale: US), trimmed to the fields the scraper reads.
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'seed-papers.json'), 'utf-8')
);

async function scrapeFixture() {
  const stub = stubFetch(fixture);
  try {
    return { feed: await scrape(), calls: stub.calls };
  } finally {
    stub.restore();
  }
}

test('sends x-tt-locale, without which the API returns an empty list', async () => {
  const { calls } = await scrapeFixture();
  assert.equal(calls[0].headers['x-tt-locale'], 'US');
});

test('builds items from the paper list', async () => {
  const { feed } = await scrapeFixture();
  assert.equal(feed.items.length, 5);
  const first = feed.items[0];
  assert.equal(first.title, 'Recycler: Cost-Free Latent Reasoning via Hidden State Recycling');
  assert.equal(first.pubDate.toISOString(), '2026-10-24T16:00:00.000Z');
  assert.ok(first.description.length <= 500);
});

test('links to /en/public_papers/, the path the site itself uses', async () => {
  const { feed } = await scrapeFixture();
  assert.equal(
    feed.items[0].link,
    'https://seed.bytedance.com/en/public_papers/recycler-cost-free-latent-reasoning-via-hidden-state-recycling'
  );
});
