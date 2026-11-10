/**
 * ByteDance Seed research scraper.
 *
 * Fetches articles from ByteDance Seed's public JSON API.
 * No HTML parsing needed — the API returns structured data directly.
 *
 * API endpoint: https://seed.bytedance.com/api/get_article_list_v2?article_type=1
 *
 * Since ~Jul 2026 the API only returns papers (article_type=1) when the
 * request carries `x-tt-locale: US`, as the site's own frontend sends.
 * Without it the response is still "success" with `total` set, but
 * `sub_article_list` is omitted — so the feed silently went empty.
 *
 * Response structure:
 * {
 *   sub_article_list: [
 *     {
 *       ArticleMeta: {
 *         PublishDate: 1776787200000,   // Unix timestamp in ms
 *         ResearchArea: [{ ResearchAreaName: "..." }],
 *         ExternalLinks: [{ Link: "https://arxiv.org/..." }],
 *         WorkingTeam: [{ Name: "..." }],
 *       },
 *       ArticleSubContentEn: {
 *         Title: "...",
 *         Abstract: "...",
 *         TitleKey: "slug-for-url",
 *       }
 *     },
 *     ...
 *   ],
 *   has_more: true,
 *   total: 199,
 * }
 */

'use strict';

const FEED_META = {
  title: 'ByteDance Seed AI Research',
  link: 'https://seed.bytedance.com/en',
  description: 'Latest AI research papers from ByteDance Seed',
  language: 'en',
};

const API_URL = 'https://seed.bytedance.com/api/get_article_list_v2?article_type=1';

/**
 * Fetch articles from Seed's public API.
 * @returns {Promise<Object>} Feed descriptor { title, link, description, items }
 */
async function scrape() {
  console.log('[seed] Fetching API', API_URL);

  let data;
  try {
    const res = await fetch(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'application/json',
        'x-tt-locale': 'US',
      },
    });
    if (!res.ok) {
      console.error(`[seed] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    data = await res.json();
  } catch (err) {
    console.error('[seed] Failed to fetch API:', err.message);
    return { ...FEED_META, items: [] };
  }

  const articles = data.sub_article_list || [];
  const items = [];

  for (const article of articles) {
    const meta = article.ArticleMeta || {};
    const content = article.ArticleSubContentEn || {};

    const title = content.Title;
    if (!title) continue;

    const slug = content.TitleKey;
    // Construct article URL — the site links papers as /en/public_papers/{slug}
    // (formerly /en/tech/{slug}; the SPA answers 200 for any path, so the
    // status code can't tell which is current)
    const link = slug
      ? `https://seed.bytedance.com/en/public_papers/${slug}`
      : FEED_META.link;

    // Abstract may be very long — truncate for RSS description
    let description = content.Abstract || title;
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }

    // PublishDate is Unix timestamp in milliseconds
    let pubDate = new Date();
    if (meta.PublishDate) {
      pubDate = new Date(meta.PublishDate);
    }

    items.push({ title, link, description, pubDate });
  }

  console.log(`[seed] Found ${items.length} items`);
  return { ...FEED_META, items };
}

module.exports = { scrape };
