/**
 * GitHub Trending (Weekly) scraper.
 *
 * Scrapes the weekly trending repositories from GitHub's trending page.
 * Same structure as the daily scraper but with ?since=weekly.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'GitHub Trending (Weekly)',
  link: 'https://github.com/trending?since=weekly',
  description: 'Weekly trending repositories on GitHub',
  language: 'en',
};

const TRENDING_URL = 'https://github.com/trending?since=weekly';

async function scrape() {
  console.log('[github-trending-weekly] Fetching', TRENDING_URL);

  let html;
  try {
    const res = await fetch(TRENDING_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      console.error(`[github-trending-weekly] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    html = await res.text();
  } catch (err) {
    console.error('[github-trending-weekly] Failed to fetch page:', err.message);
    return { ...FEED_META, items: [] };
  }

  const $ = cheerio.load(html);
  const items = [];

  $('article.Box-row').each((_i, el) => {
    const $el = $(el);
    const repoPath = $el.find('h2 a').attr('href');
    if (!repoPath) return;

    const repoName = repoPath.replace(/^\//, '').replace(/\s+/g, '');
    const link = `https://github.com${repoPath.trim()}`;
    const description = $el.find('p').text().trim() || 'No description';
    const lang = $el.find('[itemprop="programmingLanguage"]').text().trim();

    let todayStars = '';
    $el.find('span.d-inline-block.float-sm-right').each((_j, span) => {
      const text = $(span).text().trim();
      if (text.includes('stars')) {
        todayStars = text;
      }
    });

    let title = repoName;
    if (lang) title += ` [${lang}]`;
    if (todayStars) title += ` — ${todayStars}`;

    let desc = description;
    if (lang && !desc.includes(lang)) desc = `[${lang}] ${desc}`;
    if (todayStars) desc += ` (${todayStars})`;

    items.push({ title, link, description: desc, pubDate: new Date() });
  });

  console.log(`[github-trending-weekly] Found ${items.length} items`);
  return { ...FEED_META, items };
}

module.exports = { scrape };
