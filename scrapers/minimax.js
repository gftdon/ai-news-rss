/**
 * MiniMax blog scraper.
 *
 * Scrapes the latest blog/research posts from MiniMax's website.
 * Uses cheerio for HTML parsing (no browser needed — the site is
 * server-rendered Next.js so post cards are in the initial HTML).
 *
 * Target page: https://www.minimax.io/blog
 * Structure:   Blog posts are rendered as <a> card links whose href
 *              starts with "/blog/". Since the Oct 2026 redesign each
 *              card (a.BlogList_card__<hash>) contains:
 *                - <h2>                 → post title (was <h3>)
 *                - <time datetime=ISO>  → publication date
 *                - no excerpt, so the description falls back to the title
 *              Cards are recognised by having a heading plus a date, not by
 *              class names, which are hashed and change between redesigns.
 *              Header/menu links to the same posts have neither.
 *
 * Returns a feed descriptor compatible with rss-builder.
 */

'use strict';

const cheerio = require('cheerio');

const BASE_URL = 'https://www.minimax.io';
const BLOG_URL = `${BASE_URL}/blog`;

const FEED_META = {
  title: 'MiniMax Blog',
  link: BLOG_URL,
  description: 'Latest posts from MiniMax Blog',
  language: 'en',
};

/**
 * Fetch and parse blog posts from MiniMax's blog page.
 * @returns {Promise<Object>} Feed descriptor { title, link, description, items }
 */
async function scrape() {
  console.log('[minimax] Fetching', BLOG_URL);

  let html;
  try {
    const res = await fetch(BLOG_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ai-news-rss/1.0; +https://github.com)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    html = await res.text();
  } catch (err) {
    console.error('[minimax] Failed to fetch page:', err.message);
    return { ...FEED_META, items: [] };
  }

  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('a[href^="/blog/"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href');

    // Title — the card heading (<h2> now, <h3> before the redesign).
    // Menu links have no heading, so this also filters them out.
    const title = $el.find('h2, h3').first().text().trim();
    if (!title) return;

    // Date — <time datetime="ISO">, else a <time>/<span> reading YYYY-MM-DD
    let pubDate = null;
    const datetime = $el.find('time[datetime]').first().attr('datetime');
    if (datetime && !isNaN(new Date(datetime).getTime())) {
      pubDate = new Date(datetime);
    } else {
      $el.find('time, span').each((_j, node) => {
        const text = $(node).text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          pubDate = new Date(text + 'T00:00:00Z');
          return false; // break
        }
      });
    }
    if (!pubDate) return; // not a post card

    // Link — resolve relative to absolute
    const link = href.startsWith('http') ? href : new URL(href, BASE_URL).href;
    if (seen.has(link)) return;
    seen.add(link);

    // Description — cards currently carry no excerpt; use one if it returns
    const description = $el.find('p').first().text().trim() || title;

    items.push({
      title,
      link,
      description,
      pubDate,
    });
  });

  console.log(`[minimax] Found ${items.length} items`);
  return { ...FEED_META, items };
}

module.exports = { scrape };
