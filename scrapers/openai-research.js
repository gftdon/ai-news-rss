/**
 * OpenAI Research / Releases scraper.
 *
 * OpenAI blocks direct page scraping (HTTP 403), but their sitemap is publicly
 * accessible and contains all release/index pages with lastmod dates.
 *
 * Strategy: Parse the release sitemap XML to extract English-language URLs
 * and their lastmod dates. Derive titles from URL slugs (e.g. /index/gpt-5-4/ → "GPT 5 4").
 * Sort by date descending and return the 20 most recent entries.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'OpenAI Research & Releases',
  link: 'https://openai.com/research/index/release/',
  description: 'Latest research papers and model releases from OpenAI',
  language: 'en',
};

const SITEMAP_URL = 'https://openai.com/sitemap.xml/release/';

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

async function scrape() {
  console.log('[openai-research] Fetching sitemap', SITEMAP_URL);

  let xml;
  try {
    const res = await fetch(SITEMAP_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'application/xml, text/xml',
      },
    });
    if (!res.ok) {
      console.error(`[openai-research] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    xml = await res.text();
  } catch (err) {
    console.error('[openai-research] Failed to fetch sitemap:', err.message);
    return { ...FEED_META, items: [] };
  }

  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  const seen = new Set();

  // Each <url> block has <loc> and <lastmod>
  $('url').each((_i, el) => {
    const loc = $(el).find('loc').first().text().trim();
    const lastmod = $(el).find('lastmod').first().text().trim();

    // Only English URLs (no locale prefix like /th-TH/)
    if (!loc || !loc.startsWith('https://openai.com/index/')) return;
    if (seen.has(loc)) return;
    seen.add(loc);

    // Extract slug from URL
    const match = loc.match(/\/index\/([^/]+)\/?$/);
    if (!match) return;
    const slug = match[1];

    const title = slugToTitle(slug);
    const link = loc;

    let pubDate = new Date();
    if (lastmod) {
      const parsed = new Date(lastmod);
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }

    items.push({
      title,
      link,
      description: `OpenAI research/release: ${title}`,
      pubDate,
    });
  });

  // Sort by date descending
  items.sort((a, b) => b.pubDate - a.pubDate);

  // Return the 20 most recent
  const recent = items.slice(0, 20);
  console.log(`[openai-research] Found ${items.length} total, returning ${recent.length} most recent`);
  return { ...FEED_META, items: recent };
}

module.exports = { scrape };
