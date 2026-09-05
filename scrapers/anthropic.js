/**
 * Anthropic news scraper.
 *
 * Scrapes the latest news from Anthropic's newsroom.
 * The site is built with Next.js and server-renders news items in the initial HTML.
 *
 * CSS selectors derived from the actual SSR HTML structure:
 * - Publication list items: ul.PublicationList...list > li > a
 * - Title: span.PublicationList...title
 * - Date: time.PublicationList...date (format: "Jun 11, 2026")
 * - Category: span.PublicationList...subject
 * - Link: a.PublicationList...listItem[href="/news/xxx"]
 *
 * Also extracts featured items from the FeaturedGrid section. Featured
 * items may link outside /news/ (e.g. /claude-fable-and-mythos-5-1), so
 * links are selected by section, not by URL prefix.
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

  // Select by page section rather than URL prefix: the featured hero can
  // live at a top-level path (e.g. /claude-fable-and-mythos-5-1) and would
  // be dropped by an `a[href^="/news/"]` filter.
  $('[class*="FeaturedGrid"] a[href], [class*="PublicationList"] a[href]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || !href.startsWith('/') || href === '/news' || href === '/news/') return;

    // Find title — could be in h2, h4, or span with "title" in class
    let title = '';
    const titleEl = $el.find('h2, h4, [class*="title"]').first();
    if (titleEl.length) {
      title = titleEl.text().trim();
    }
    if (!title) {
      // Try span elements
      $el.find('span').each((_j, span) => {
        const text = $(span).text().trim();
        if (text.length > 15 && !title) {
          title = text;
        }
      });
    }
    if (!title) return;

    const link = new URL(href, 'https://www.anthropic.com').href;
    if (seen.has(link)) return;
    seen.add(link);

    // Find date from <time> element
    let pubDate = new Date();
    const timeEl = $el.find('time');
    if (timeEl.length) {
      const dateStr = timeEl.text().trim(); // "Jun 11, 2026"
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }

    // Find description from <p> with "body" in class
    const description = $el.find('p[class*="body"]').text().trim() || title;

    // Find category
    const category = $el.find('span[class*="subject"], span[class*="caption"]').first().text().trim();

    items.push({
      title,
      link,
      description: category ? `[${category}] ${description}` : description,
      pubDate,
    });
  });

  // Newest first. Array.prototype.sort is stable, so items sharing a date
  // keep their on-page order.
  items.sort((a, b) => b.pubDate - a.pubDate);

  return { ...FEED_META, items };
}

module.exports = { scrape, parse };
