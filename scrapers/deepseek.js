/**
 * DeepSeek news scraper.
 *
 * Scrapes DeepSeek's official news page (https://www.deepseek.com/en/news/).
 * The site is Next.js and renders article cards in the initial SSR HTML.
 *
 * CSS selectors derived from the actual SSR HTML structure:
 * - Article cards: `a.ds-news-hero-card` (featured) and `a.ds-news-list-item`
 * - Title: `h2` (hero card) / `h3` (list item)
 * - Date: `p.ds-text-caption span.text-ds-description` (e.g. "September 10, 2026")
 * - Description: `p.ds-text-body-sm` (hero) / `p.ds-text-caption.text-ds-description` (list)
 *
 * Falls back to GitHub releases only if the news page yields no items.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'DeepSeek AI News',
  link: 'https://www.deepseek.com/en/news/',
  description: 'Latest research, product updates, and announcements from DeepSeek AI',
  language: 'en',
};

const NEWS_URL = 'https://www.deepseek.com/en/news/';

/**
 * Fetch and parse news items from DeepSeek's official news page.
 * @returns {Promise<Object>} Feed descriptor { title, link, description, items }
 */
async function scrape() {
  console.log('[deepseek] Fetching', NEWS_URL);

  let html;
  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-News-RSS/1.0)',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) {
      console.error(`[deepseek] HTTP ${res.status}`);
      return scrapeGitHubFallback();
    }
    html = await res.text();
  } catch (err) {
    console.error('[deepseek] Failed to fetch page:', err.message);
    return scrapeGitHubFallback();
  }

  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  // Featured card + list items share the same inner structure
  $('a.ds-news-hero-card, a.ds-news-list-item').each((_i, el) => {
    const $el = $(el);

    const href = $el.attr('href');
    if (!href) return;

    const link = href.startsWith('http') ? href : new URL(href, 'https://www.deepseek.com').href;
    if (seen.has(link)) return;
    seen.add(link);

    const title = $el.find('h2, h3').first().text().trim();
    if (!title) return;

    // Description: hero uses .ds-text-body-sm, list items use p.text-ds-description
    const description =
      $el.find('p.ds-text-body-sm').first().text().trim() ||
      $el.find('p.text-ds-description').first().text().trim() ||
      title;

    // Date: the caption row holds a category span + a date span, e.g. "September 10, 2026"
    const dateStr = $el.find('p.ds-text-caption span.text-ds-description').first().text().trim();

    let pubDate = new Date();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }

    items.push({ title, link, description, pubDate });
  });

  if (items.length === 0) {
    console.log('[deepseek] No items on news page, falling back to GitHub');
    return scrapeGitHubFallback();
  }

  // Sort by date descending
  items.sort((a, b) => b.pubDate - a.pubDate);

  console.log(`[deepseek] Found ${items.length} items`);
  return { ...FEED_META, items: items.slice(0, 20) };
}

// Use a token when available (GitHub Actions provides GITHUB_TOKEN) to raise
// the API rate limit from 60 req/hr (unauthenticated) to 1,000 req/hr.
function githubHeaders() {
  const headers = {
    'User-Agent': 'AI-News-RSS/1.0',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Fallback: recent releases across the deepseek-ai GitHub org.
 * Used only when the official news page is unreachable or empty.
 */
async function scrapeGitHubFallback() {
  console.log('[deepseek] Fetching from GitHub (fallback)');

  const items = [];
  const seen = new Set();

  try {
    const orgRes = await fetch(
      'https://api.github.com/orgs/deepseek-ai/repos?sort=updated&per_page=10',
      { headers: githubHeaders() }
    );

    if (orgRes.ok) {
      const repos = await orgRes.json();

      for (const repo of repos.slice(0, 8)) {
        try {
          const relRes = await fetch(
            `https://api.github.com/repos/deepseek-ai/${repo.name}/releases?per_page=3`,
            { headers: githubHeaders() }
          );

          if (relRes.ok) {
            const releases = await relRes.json();
            for (const release of releases) {
              if (!release.name && !release.tag_name) continue;

              const title = release.name || release.tag_name;
              const link = release.html_url;
              if (seen.has(link)) continue;
              seen.add(link);

              let description = release.body || title;
              if (description.length > 500) {
                description = description.substring(0, 497) + '...';
              }
              // Strip markdown formatting
              description = description.replace(/[#*`\[\]]/g, '').trim();

              const pubDate = new Date(release.published_at || release.created_at);

              items.push({ title: `${repo.name}: ${title}`, link, description, pubDate });
            }
          }
        } catch {
          // Skip repos with no releases
        }
      }
    }
  } catch (err) {
    console.error('[deepseek] GitHub fallback failed:', err.message);
  }

  items.sort((a, b) => b.pubDate - a.pubDate);

  console.log(`[deepseek] Found ${items.length} items (GitHub fallback)`);
  return { ...FEED_META, items: items.slice(0, 20) };
}

module.exports = { scrape };
