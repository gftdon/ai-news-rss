/**
 * Anthropic news scraper.
 *
 * Scrapes the latest news from Anthropic's newsroom. The page is server-rendered,
 * so every listing row is present in the initial HTML.
 *
 * CSS-module class names on this site are hashed (e.g. `bxgyUW_row`) and the
 * hash changes when Anthropic redesigns or rebuilds the page — the Oct 2026
 * redesign replaced `PublicationList-module__…` and silently emptied the feed.
 * So rows are found by semantic hooks instead:
 * - Row:      li[data-listing-row]
 * - Title:    first <h3>; link = its enclosing <a> (may be absolute, and may
 *             live outside /news/, e.g. /claude-fable-and-mythos-5-2)
 * - Date:     <time> (format: "Nov 9, 2026")
 * - Summary:  first <p>
 * - Category: a[class*="category"] (the "_category-link" suffix survives hashing)
 *
 * The featured tiles above the list are not parsed: the hero duplicates the
 * first row, and the remaining tiles are undated evergreen /features pages.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'Anthropic News',
  link: 'https://www.anthropic.com/news',
  description: 'Latest news, announcements, and research from Anthropic',
  language: 'en',
};

const NEWS_URL = 'https://www.anthropic.com/news';

async function scrape() {
  console.log('[anthropic] Fetching', NEWS_URL);

  let html;
  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) {
      console.error(`[anthropic] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    html = await res.text();
  } catch (err) {
    console.error('[anthropic] Failed to fetch page:', err.message);
    return { ...FEED_META, items: [] };
  }

  const feed = parse(html);
  console.log(`[anthropic] Found ${feed.items.length} items`);
  return feed;
}

/**
 * Parse newsroom HTML into feed items. Pure function so it can be tested
 * against a saved fixture without hitting the network.
 */
function parse(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('li[data-listing-row]').each((_i, el) => {
    const $row = $(el);

    const $heading = $row.find('h3').first();
    const title = $heading.text().trim();
    const href = $heading.closest('a').attr('href');
    if (!title || !href) return;

    const link = new URL(href, 'https://www.anthropic.com').href;
    if (seen.has(link)) return;
    seen.add(link);

    // Leave pubDate unset rather than defaulting to "now": a scrape-time date
    // makes the item look brand new on every run.
    const parsed = new Date($row.find('time').first().text().trim());
    const pubDate = isNaN(parsed.getTime()) ? undefined : parsed;

    const description = $row.find('p').first().text().trim() || title;
    const category = $row.find('a[class*="category"]').first().text().trim();

    items.push({
      title,
      link,
      description: category ? `[${category}] ${description}` : description,
      pubDate,
    });
  });

  // Newest first; undated rows sink to the end. Array.prototype.sort is
  // stable, so items sharing a date keep their on-page order.
  const time = (item) => (item.pubDate ? item.pubDate.getTime() : 0);
  items.sort((a, b) => time(b) - time(a));

  return { ...FEED_META, items };
}

module.exports = { scrape, parse };
