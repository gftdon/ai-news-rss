/**
 * Write one scraped feed to `<outputDir>/<name>.xml`.
 *
 * A scrape that returns 0 items almost always means the source site changed
 * (redesign, API contract) rather than that it has no posts — overwriting
 * would publish an empty feed and hide the breakage. So an empty result is
 * not written: the previous file stays as is, and a warning is logged
 * (as a GitHub Actions annotation when running in CI, so it shows on the
 * run summary). The deploy step keeps the previous file on gh-pages via
 * `keep_files: true`, since public/*.xml is gitignored and absent in CI.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildRss } = require('./rss-builder');

function warn(title, message) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    // Workflow-command data must escape %, CR and LF to stay on one line
    const data = String(message).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.warn(`::warning title=${title}::${data}`);
  } else {
    console.warn(`WARNING: ${message}`);
  }
}

/**
 * @param {string} name     Feed name, used as the file name
 * @param {Object} feed     Feed descriptor from a scraper ({ items, ... })
 * @param {string} outputDir
 * @returns {{ name: string, itemCount: number, written: boolean }}
 */
function writeFeed(name, feed, outputDir) {
  const itemCount = feed.items.length;
  const outputPath = path.join(outputDir, `${name}.xml`);

  if (itemCount === 0) {
    const kept = fs.existsSync(outputPath)
      ? `kept previous ${name}.xml unchanged`
      : `no previous ${name}.xml to keep`;
    warn(
      `Empty feed (${name})`,
      `${name} returned 0 items; ${kept}. The source page or API has probably changed.`
    );
    return { name, itemCount, written: false };
  }

  fs.writeFileSync(outputPath, buildRss(feed), 'utf-8');
  console.log(`[${name}] Wrote ${itemCount} items to ${outputPath}`);
  return { name, itemCount, written: true };
}

module.exports = { writeFeed, warn };
