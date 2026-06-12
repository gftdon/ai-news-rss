/**
 * Meta AI blog scraper.
 *
 * Scrapes the latest blog posts from Meta's AI blog.
 * The site is Facebook's internal SSR framework. Blog entries are
 * available in the initial HTML inside <noscript> fallback blocks,
 * and also in the main content as card links.
 *
 * Strategy: Parse links matching ai.meta.com/blog/xxx with their titles and dates.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'Meta AI Blog',
  link: 'https://ai.meta.com/blog/',
  description: 'Latest AI research and news from Meta',
  language: 'en',
};

const NEWS_URL = 'https://ai.meta.com/blog/';

async function scrape() {
  console.log('[meta-ai] Fetching', NEWS_URL);

  let html;
  try {
    const res = await fetch(NEWS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
      },
    });
    if (!res.ok) {
      console.error(`[meta-ai] HTTP ${res.status}`);
      return { ...FEED_META, items: [] };
    }
    html = await res.text();
  } catch (err) {
    console.error('[meta-ai] Failed to fetch page:', err.message);
    return { ...FEED_META, items: [] };
  }

  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  // Strategy 1: Featured cards in the main content
  // Cards link to ai.meta.com/blog/xxx with titles and dates
  $('a[href*="ai.meta.com/blog/"]').each((_i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;

    // Skip generic links (main blog page, subscribe, etc.)
    const slug = href.replace(/^https?:\/\/ai\.meta\.com\/blog\/?/, '').replace(/\/$/, '');
    if (!slug || slug.includes('?') || slug === '#') return;

    // Resolve full URL
    const link = href.startsWith('http') ? href : `https://ai.meta.com${href}`;
    if (seen.has(link)) return;

    // Find title — look for the text content of this link or nearby headings
    const titleEl = $el.find('h4, h3, h2, [class*="amdf"]').first();
    let title = titleEl.length ? titleEl.text().trim() : '';
    if (!title) {
      // aria-label often has "Read TITLE"
      const ariaLabel = $el.attr('aria-label');
      if (ariaLabel && ariaLabel.startsWith('Read ')) {
        title = ariaLabel.replace(/^Read\s+/, '').trim();
      }
    }
    if (!title || title.length < 5) return;

    seen.add(link);

    items.push({ title, link, description: title, pubDate: new Date() });
  });

  // Strategy 2: <noscript> fallback blog list
  $('noscript').each((_i, el) => {
    const noscriptHtml = $(el).html();
    if (!noscriptHtml || !noscriptHtml.includes('ai.meta.com/blog/')) return;

    const $ns = cheerio.load(noscriptHtml);

    // Each blog post card has h4 title and date
    $ns('a[href*="ai.meta.com/blog/"]').each((_j, linkEl) => {
      const href = $ns(linkEl).attr('href');
      if (!href) return;

      const slug = href.replace(/^https?:\/\/ai\.meta\.com\/blog\/?/, '').replace(/\/$/, '');
      if (!slug || slug.includes('?')) return;

      const link = href.startsWith('http') ? href : `https://ai.meta.com${href}`;
      if (seen.has(link)) return;

      // Walk up to find the card container
      const $card = $ns(linkEl).closest('div[class*="_8xm7"], div[class*="_8034"]');
      if (!$card.length) return;

      const title = $card.find('h4').first().text().trim();
      if (!title || title.length < 5) return;

      // Parse date like "April 08, 2026" or "March 27, 2026"
      let pubDate = new Date();
      $card.find('p').each((_k, p) => {
        const text = $ns(p).text().trim();
        // Match "Month DD, YYYY"
        if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/.test(text)) {
          const parsed = new Date(text);
          if (!isNaN(parsed.getTime())) {
            pubDate = parsed;
          }
        }
      });

      // Find description
      const descEl = $card.find('[class*="_8xkk"] p, [class*="_8_w6"] p').first();
      const description = descEl.length ? descEl.text().trim() : title;

      seen.add(link);
      items.push({ title, link, description, pubDate });
    });
  });

  // Strategy 3: Featured section links with dates
  $('[class*="_amda"]').each((_i, el) => {
    const $card = $(el);
    const linkEl = $card.find('a[href*="ai.meta.com/blog/"]').first();
    if (!linkEl.length) return;

    const href = linkEl.attr('href');
    const link = href.startsWith('http') ? href : `https://ai.meta.com${href}`;
    if (seen.has(link)) return;

    const title = $card.find('[class*="amdf"], [class*="amde"]').text().trim();
    if (!title || title.length < 5) return;

    // Date in format "Apr 8, 2026"
    let pubDate = new Date();
    const dateText = $card.find('[class*="amdj"]').last().text().trim();
    if (dateText) {
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime())) {
        pubDate = parsed;
      }
    }

    seen.add(link);
    items.push({ title, link, description: title, pubDate });
  });

  console.log(`[meta-ai] Found ${items.length} items`);
  return { ...FEED_META, items };
}

module.exports = { scrape };
