/**
 * ByteDance Seed research scraper.
 *
 * Fetches articles from ByteDance Seed's public JSON API.
 * No HTML parsing needed — the API returns structured data directly.
 *
 * API endpoint: https://seed.bytedance.com/api/get_article_list_v2?article_type=1
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
    // Construct article URL — Seed uses /en/tech/{slug} for article pages
    const link = slug
      ? `https://seed.bytedance.com/en/tech/${slug}`
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
