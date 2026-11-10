#!/usr/bin/env node

/**
 * generate-all.js
 *
 * Main entry point: imports all scrapers, runs them concurrently,
 * and writes the resulting RSS XML files to the public/ directory.
 * A scraper that returns 0 items or throws leaves its previous file in
 * place and logs a warning (see lib/write-feed.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { writeFeed, warn } = require('./lib/write-feed');

// Import all scrapers
const scrapers = {
  kimi: require('./scrapers/kimi'),
  minimax: require('./scrapers/minimax'),
  seed: require('./scrapers/seed'),
  kling: require('./scrapers/kling'),
  anthropic: require('./scrapers/anthropic'),
  'meta-ai': require('./scrapers/meta-ai'),
  qwen: require('./scrapers/qwen'),
  deepseek: require('./scrapers/deepseek'),
  'openai-research': require('./scrapers/openai-research'),
  'github-trending': require('./scrapers/github-trending'),
  'github-trending-weekly': require('./scrapers/github-trending-weekly'),
};

const OUTPUT_DIR = path.join(__dirname, 'public');

async function main() {
  console.log('=== AI News RSS Feed Generator ===');
  console.log(`Started at ${new Date().toISOString()}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Run all scrapers concurrently
  const entries = Object.entries(scrapers);
  const results = await Promise.allSettled(
    entries.map(async ([name, scraper]) => {
      console.log(`\n--- Running ${name} scraper ---`);
      const feed = await scraper.scrape();
      return writeFeed(name, feed, OUTPUT_DIR);
    })
  );

  // Summary
  console.log('\n=== Summary ===');
  results.forEach((result, i) => {
    const name = entries[i][0];
    if (result.status === 'rejected') {
      console.error(`  ✗ ${name}: ${result.reason}`);
      warn(`Scraper failed (${name})`, `${name} threw; kept previous ${name}.xml. ${result.reason}`);
    } else if (!result.value.written) {
      console.log(`  ⚠ ${name}: 0 items — previous feed kept`);
    } else {
      console.log(`  ✓ ${name}: ${result.value.itemCount} items`);
    }
  });

  console.log(`\nCompleted at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
