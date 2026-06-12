/**
 * MiniMax blog scraper.
 *
 * Scrapes the latest blog/research posts from MiniMax's website.
 * Uses cheerio for HTML parsing (no browser needed — the site is
 * server-rendered Next.js so post cards are in the initial HTML).
 *
 * Target page: https://www.minimax.io/blog
 * Structure:   Blog posts are rendered as <a> card links whose href
 *              starts with "/blog/". Each card contains:
 *                - <h3>             → post title
 *                - <span> YYYY-MM-DD → publication date
 *                - <article><div>   → description excerpt
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

  // Blog post cards are <a> elements with href starting with "/blog/"
  // wrapped in the grid container. Each card has:
  //   - a <section> with the card body
  //   - a date <span> with text matching YYYY-MM-DD
  //   - an <h3> with the post title
  //   - an <article> containing a <div> with the description excerpt
  $('a[href^="/blog/"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href');

    // Skip if this is a nav link or not a card (cards have the
    // "no-underline overflow-hidden" classes)
    if (!$el.hasClass('no-underline') && !$el.hasClass('overflow-hidden')) {
      return;
    }

    // Title — the <h3> inside the card
    const titleEl = $el.find('h3').first();
    const title = titleEl.text().trim();
    if (!title) return;

    // Link — resolve relative to absolute
    const link = href.startsWith('http') ? href : new URL(href, BASE_URL).href;

    // Date — look for a <span> whose text matches YYYY-MM-DD
    let pubDate = null;
    $el.find('span').each((_j, span) => {
      const text = $(span).text().trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        pubDate = new Date(text + 'T00:00:00Z');
        return false; // break
      }
    });

    // Description — the first <article> contains a <div> with excerpt text
    const descEl = $el.find('article div').first();
    const description = descEl.text().trim() || title;

    items.push({
      title,
      link,
      description,
      pubDate: pubDate || new Date(),
    });
  });

  console.log(`[minimax] Found ${items.length} items`);
  return { ...FEED_META, items };
}

module.exports = { scrape };
