/**
 * Kimi (Moonshot AI) research blog scraper.
 *
 * Scrapes the latest research articles from Kimi's blog page.
 * The site is built with VitePress and renders article cards in the initial HTML.
 *
 * CSS selectors derived from the actual SSR HTML structure:
 * - Article cards: `.menu-card` (inside `.cards-list`)
 * - Title: `.card-title` (h4)
 * - Date: `.card-date` (p)
 * - Link: `a.menu-card[href]`
 * - Description: `.card-desc` (p, optional)
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'Kimi AI Research',
  link: 'https://www.kimi.com/blog/',
  description: 'Latest research articles from Kimi / Moonshot AI',
  language: 'en',
};

const NEWS_URL = 'https://www.kimi.com/blog/';

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

  // Article cards are <a class="menu-card" href="/blog/...">
  // Inside .cards-list (excludes hero duplicates in .hero-container-desktop)
  $('a.menu-card').each((_i, el) => {
    const $el = $(el);

    // Skip hero duplicates (they appear in .hero-container-desktop)
    if ($el.hasClass('menu-card-hero')) return;

    const href = $el.attr('href');
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
    const dateStr = $el.find('.card-date').text().trim(); // e.g. "2026/04/20"

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
