/**
 * Qwen research blog scraper.
 *
 * Qwen has an official RSS feed at https://qwenlm.github.io/blog/index.xml
 * However, Qwen moved their blog to https://qwen.ai/research and the old
 * RSS may be stale. This scraper fetches the old RSS (which is still valid
 * RSS 2.0) and re-formats it as our standard feed descriptor.
 *
 * If the old RSS becomes too stale, we can switch to scraping qwen.ai/research.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'Qwen AI Research',
  link: 'https://qwen.ai/research',
  description: 'Latest research and model releases from Qwen (Alibaba Cloud)',
  language: 'en',
};

// Qwen's official RSS feed (Hugo-generated)
const RSS_URL = 'https://qwenlm.github.io/blog/index.xml';
// Fallback: scrape the new research page
const RESEARCH_URL = 'https://qwen.ai/research';

async function scrape() {
  console.log('[qwen] Fetching RSS', RSS_URL);

  // Strategy 1: Use existing RSS feed
  try {
    const res = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'application/xml, text/xml',
      },
    });
    if (res.ok) {
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const items = [];

      $('item').each((_i, el) => {
        const $item = $(el);
        const title = $item.find('title').text().trim();
        const link = $item.find('link').text().trim();
        const pubDateStr = $item.find('pubDate').text().trim();
        const descRaw = $item.find('description').text().trim();

        if (!title) return;

        // Truncate description (RSS descriptions can be very long)
        let description = descRaw;
        if (description.length > 300) {
          description = description.substring(0, 297) + '...';
        }

        let pubDate = new Date();
        if (pubDateStr) {
          const parsed = new Date(pubDateStr);
          if (!isNaN(parsed.getTime())) {
            pubDate = parsed;
          }
        }

        items.push({ title, link, description: description || title, pubDate });
      });

      if (items.length > 0) {
        console.log(`[qwen] Found ${items.length} items from RSS`);
        return { ...FEED_META, items };
      }
    }
  } catch (err) {
    console.error('[qwen] RSS fetch failed:', err.message);
  }

  // Strategy 2: Scrape the new research page
  console.log('[qwen] RSS empty/failed, trying research page', RESEARCH_URL);
  try {
    const res = await fetch(RESEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) {
      console.error(`[qwen] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const items = [];

    // Look for blog post links
    $('a[href*="/blog/"]').each((_i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const title = $el.find('h2, h3, h4, [class*="title"]').text().trim() || $el.text().trim();
      if (!title || title.length < 5) return;

      const link = href.startsWith('http') ? href : new URL(href, 'https://qwen.ai').href;
      items.push({ title, link, description: title, pubDate: new Date() });
    });

    console.log(`[qwen] Found ${items.length} items from research page`);
    return { ...FEED_META, items };
  } catch (err) {
    console.error('[qwen] Research page scrape failed:', err.message);
    return { ...FEED_META, items: [] };
  }
}

module.exports = { scrape };
