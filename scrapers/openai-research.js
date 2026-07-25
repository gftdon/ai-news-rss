/**
 * OpenAI Research / Releases scraper.
 *
 * Strategy: Use OpenAI's official news RSS feed (https://openai.com/news/rss.xml),
 * which covers ~1000 /index/ pages (research, releases, announcements) with
 * REAL publication dates in <pubDate>.
 *
 * Why not the sitemap? The release sitemap (openai.com/sitemap.xml/release/)
 * has <lastmod> dates, but those reflect the last crawl/modification — e.g.
 * "Introducing deep research" (published Feb 2, 2025) shows lastmod of today
 * because OpenAI re-renders pages regularly. The news RSS feed has correct
 * original publish dates and matches what the website displays.
 *
 * Fallback: for /index/ URLs present in the sitemap but absent from the RSS
 * feed (a handful of legacy pages like /index/gpt-4/), well-known original
 * publish dates are hardcoded in KNOWN_DATES.
 *
 * Direct page scraping is not possible (OpenAI returns HTTP 403 to bots).
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'OpenAI Research & Releases',
  link: 'https://openai.com/research/index/release/',
  description: 'Latest research papers and model releases from OpenAI',
  language: 'en',
};

const RSS_URL = 'https://openai.com/news/rss.xml';
const SITEMAP_URL = 'https://openai.com/sitemap.xml/release/';
const MAX_ITEMS = 20;

/**
 * Original publish dates for /index/ pages missing from the news RSS feed.
 */
const KNOWN_DATES = {
  'dall-e-2': '2022-04-06',
  'dall-e-3': '2023-09-20',
  'gpt-4': '2023-03-14',
  'introducing-gpt-4-5': '2025-02-27',
};

/**
 * Turn a slug like "introducing-gpt-5-3-codex" into "Introducing GPT 5 3 Codex"
 */
function slugToTitle(slug) {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bO(\d)/g, 'o$1')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bOss\b/g, 'OSS')
    .replace(/\bDqn\b/g, 'DQN')
    .replace(/\bPpo\b/g, 'PPO');
}

async function fetchText(url, accept) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
      'Accept': accept,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

async function scrape() {
  console.log('[openai-research] Fetching news RSS', RSS_URL);

  const items = [];
  const seen = new Set();

  // 1. Primary source: official news RSS (real publish dates)
  try {
    const xml = await fetchText(RSS_URL, 'application/rss+xml, application/xml, text/xml');
    const $ = cheerio.load(xml, { xmlMode: true });

    $('item').each((_i, el) => {
      const $el = $(el);
      const link = $el.find('link').first().text().trim();

      // Only /index/ pages (research, releases, announcements)
      if (!link || !link.startsWith('https://openai.com/index/')) return;
      if (seen.has(link)) return;
      seen.add(link);

      const title = $el.find('title').first().text().trim() || slugToTitle(link.split('/').filter(Boolean).pop());
      const dateStr = $el.find('pubDate').first().text().trim();
      const description = $el.find('description').first().text().trim();

      let pubDate = null;
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) pubDate = parsed;
      }
      if (!pubDate) return; // skip items without a usable date

      items.push({
        title,
        link,
        description: description || `OpenAI research/release: ${title}`,
        pubDate,
      });
    });
    console.log(`[openai-research] ${items.length} /index/ items from news RSS`);
  } catch (err) {
    console.error('[openai-research] Failed to fetch/parse news RSS:', err.message);
  }

  // 2. Fallback: sitemap-only legacy pages with known publish dates
  try {
    const xml = await fetchText(SITEMAP_URL, 'application/xml, text/xml');
    const $ = cheerio.load(xml, { xmlMode: true });

    $('url').each((_i, el) => {
      const loc = $(el).find('loc').first().text().trim();
      if (!loc || !loc.startsWith('https://openai.com/index/')) return;

      const match = loc.match(/\/index\/([^/]+)\/?$/);
      if (!match) return;
      const slug = match[1];

      const known = KNOWN_DATES[slug];
      if (!known) return;

      const link = loc.replace(/\/$/, '');
      if (seen.has(link) || seen.has(loc)) return;
      seen.add(link);

      const title = slugToTitle(slug);
      items.push({
        title,
        link,
        description: `OpenAI research/release: ${title}`,
        pubDate: new Date(known),
      });
    });
  } catch (err) {
    console.error('[openai-research] Failed to fetch sitemap for fallback:', err.message);
  }

  // Sort by date descending, keep the most recent
  items.sort((a, b) => b.pubDate - a.pubDate);
  const recent = items.slice(0, MAX_ITEMS);
  console.log(`[openai-research] Returning ${recent.length} most recent (of ${items.length})`);
  if (recent.length) {
    console.log(`[openai-research] Newest: ${recent[0].pubDate.toISOString().slice(0, 10)} "${recent[0].title}"`);
    console.log(`[openai-research] Oldest: ${recent[recent.length - 1].pubDate.toISOString().slice(0, 10)} "${recent[recent.length - 1].title}"`);
  }
  return { ...FEED_META, items: recent };
}

module.exports = { scrape };
