#!/usr/bin/env node

/**
 * generate-all.js
 *
 * Main entry point: imports all scrapers, runs them concurrently,
 * and writes the resulting RSS XML files to the public/ directory.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildRss } = require('./lib/rss-builder');

// Import all scrapers
const scrapers = {
  kimi: require('./scrapers/kimi'),
  minimax: require('./scrapers/minimax'),
  seed: require('./scrapers/seed'),
  kling: require('./scrapers/kling'),
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
      const xml = buildRss(feed);
      const outputPath = path.join(OUTPUT_DIR, `${name}.xml`);
      fs.writeFileSync(outputPath, xml, 'utf-8');
      console.log(`[${name}] Wrote ${feed.items.length} items to ${outputPath}`);
      return { name, itemCount: feed.items.length };
    })
  );

  // Summary
  console.log('\n=== Summary ===');
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { name, itemCount } = result.value;
      console.log(`  ✓ ${name}: ${itemCount} items`);
    } else {
      console.error(`  ✗ Error: ${result.reason}`);
    }
  }

  console.log(`\nCompleted at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
