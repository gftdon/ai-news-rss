/**
 * Qwen research blog scraper.
 *
 * Qwen's blog moved to https://qwen.ai/research — a client-rendered SPA with
 * no article data in the initial HTML. The page loads its list from a public
 * JSON API, which we call directly:
 *
 *   GET https://qwen.ai/api/v2/article/retrieval?type=qwen_ai&language=en-US
 *   → { data: { articles: [{ title, path, extra: { date, introduction, ... } }] } }
 *
 * Article pages live at https://qwen.ai/blog?id=<path>.
 *
 * Fallback: the old Hugo RSS at https://qwenlm.github.io/blog/index.xml
 * (stale since ~Sep 2025, only used if the API fails).
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'Qwen AI Research',
  link: 'https://qwen.ai/research',
  description: 'Latest research and model releases from Qwen (Alibaba Cloud)',
  language: 'en',
};

const API_URL = 'https://qwen.ai/api/v2/article/retrieval?type=qwen_ai&language=en-US';
// Fallback: old official RSS feed (no longer updated)
const RSS_URL = 'https://qwenlm.github.io/blog/index.xml';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
  'Accept': 'application/json',
};

/** Strip HTML tags and collapse whitespace for plain-text descriptions. */
function htmlToText(html) {
  if (!html) return '';
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}

async function scrape() {
  console.log('[qwen] Fetching API', API_URL);

  // Strategy 1: qwen.ai public JSON API (the same one the research page uses)
  try {
    const res = await fetch(API_URL, { headers: HEADERS });
    if (!res.ok) {
      console.error(`[qwen] API HTTP ${res.status}`);
    } else {
      const json = await res.json();
      const articles = json?.data?.articles || [];
      const items = [];

      for (const article of articles) {
        const title = (article.title || '').trim();
        const path = (article.path || '').trim();
        if (!title || !path) continue;

        const link = `https://qwen.ai/blog?id=${encodeURIComponent(path)}`;

        const extra = article.extra || {};
        let pubDate = new Date();
        if (extra.date) {
          const parsed = new Date(extra.date);
          if (!isNaN(parsed.getTime())) {
            pubDate = parsed;
          }
        }

        let description = htmlToText(extra.description) || htmlToText(extra.introduction) || title;
        if (description.length > 300) {
          description = description.substring(0, 297) + '...';
        }

        items.push({ title, link, description, pubDate });
      }

      if (items.length > 0) {
        // Sort by date descending
        items.sort((a, b) => b.pubDate - a.pubDate);
        console.log(`[qwen] Found ${items.length} items from API`);
        return { ...FEED_META, items: items.slice(0, 20) };
      }
    }
  } catch (err) {
    console.error('[qwen] API fetch failed:', err.message);
  }

  // Strategy 2: old Hugo RSS feed (stale, fallback only)
  console.log('[qwen] API empty/failed, falling back to old RSS', RSS_URL);
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

      console.log(`[qwen] Found ${items.length} items from old RSS (fallback)`);
      return { ...FEED_META, items };
    }
    console.error(`[qwen] RSS HTTP ${res.status}`);
  } catch (err) {
    console.error('[qwen] RSS fetch failed:', err.message);
  }

  return { ...FEED_META, items: [] };
}

module.exports = { scrape };
