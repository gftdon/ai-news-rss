/**
 * Kimi (Moonshot AI) research blog scraper.
 *
 * Scrapes the latest research articles from Kimi's English blog page.
 * The site (rebuilt on Next.js in Jul 2026) renders article cards in the
 * initial HTML. /blog/ now serves the Chinese page; English lives at /en/blog/.
 *
 * CSS selectors derived from the actual SSR HTML structure:
 * - Article cards: `.menu-card` — a <div> since the rebuild (was an <a>)
 * - Link: the card's overlay `a[href]` (relative /en/blog/… or external)
 * - Title: `.card-title` (h4)
 * - Date: `.card-date` (p, e.g. "2026-10-24")
 * - Description: `.card-desc` (p, optional)
 * - `.menu-card-hero` duplicates the newest card and is skipped
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'Kimi AI Research',
  link: 'https://www.kimi.com/en/blog/',
  description: 'Latest research articles from Kimi / Moonshot AI',
  language: 'en',
};

const NEWS_URL = 'https://www.kimi.com/en/blog/';

/**
 * Fetch and parse research items from Kimi's blog page.
 * @returns {Promise<Object>} Feed descriptor { title, link, description, items }
 */
async function scrape() {
  console.log('[kimi] Fetching', NEWS_URL);

  let html;
  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) {
      console.error(`[kimi] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    html = await res.text();
  } catch (err) {
    console.error('[kimi] Failed to fetch page:', err.message);
    return { ...FEED_META, items: [] };
  }

  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  // Article cards are <div class="menu-card"> wrapping an overlay
  // <a href="/en/blog/...">. Accept the older <a class="menu-card"> too.
  $('.menu-card').each((_i, el) => {
    const $el = $(el);

    // Skip the hero card — it duplicates the newest article
    if ($el.hasClass('menu-card-hero')) return;

    const href = $el.is('a') ? $el.attr('href') : $el.find('a[href]').first().attr('href');
    if (!href) return;

    const title = $el.find('.card-title').text().trim();
    if (!title) return;

    // Resolve URL — some are relative (/blog/xxx), some are absolute (https://...)
    let link;
    if (href.startsWith('http')) {
      link = href;
    } else {
      link = new URL(href, 'https://www.kimi.com').href;
    }

    // Deduplicate
    if (seen.has(link)) return;
    seen.add(link);

    const description = $el.find('.card-desc').text().trim() || title;
    const dateStr = $el.find('.card-date').text().trim(); // "2026-10-24" (was "2026/04/20")

    let pubDate = new Date();
    if (dateStr) {
      // Convert "2026/04/20" to a valid Date
      const parsed = new Date(dateStr.replace(/\//g, '-'));
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }

    items.push({ title, link, description, pubDate });
  });

  console.log(`[kimi] Found ${items.length} items`);
  return { ...FEED_META, items };
}

module.exports = { scrape };
