/**
 * Kling AI release history scraper.
 *
 * Scrapes release notes from Kling AI's release history page.
 * The site is a full SPA — content is NOT in the initial HTML and
 * requires JavaScript rendering to access.
 *
 * Strategy (dual approach):
 *   1. Launch Playwright, intercept network responses to capture any
 *      CMS/API JSON payload containing release data.
 *   2. In parallel, extract from the rendered DOM once the page loads.
 *   3. Merge results, preferring API data when available.
 *
 * URL: https://klingai.com/release-note/release-history
 */

'use strict';

const FEED_META = {
  title: 'Kling AI Release Notes',
  link: 'https://klingai.com/release-note/release-history',
  description: 'Latest release notes and updates from Kling AI',
  language: 'en',
};

const NEWS_URL = 'https://klingai.com/release-note/release-history';

// Fallback URL (alternate domain that may work)
const FALLBACK_URL = 'https://kling.ai/release-note/release-history';

const NAV_TIMEOUT = 45000;
const CONTENT_WAIT = 5000;

/**
 * Attempt to parse release items from an intercepted API/JSON response.
 * Kling's CMS may return data in various shapes — this handles known patterns.
 *
 * @param {Object|Array} data - Parsed JSON body
 * @returns {Array} Extracted items or empty array
 */
function parseApiResponse(data) {
  const items = [];

  try {
    // Handle wrapper: { code: 0, data: { list: [...] } }
    let list = null;
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        list = data;
      } else if (data.data) {
        if (Array.isArray(data.data)) {
          list = data.data;
        } else if (data.data.list && Array.isArray(data.data.list)) {
          list = data.data.list;
        } else if (data.data.items && Array.isArray(data.data.items)) {
          list = data.data.items;
        } else if (data.data.records && Array.isArray(data.data.records)) {
          list = data.data.records;
        }
      } else if (data.list && Array.isArray(data.list)) {
        list = data.list;
      } else if (data.items && Array.isArray(data.items)) {
        list = data.items;
      } else if (data.result && Array.isArray(data.result)) {
        list = data.result;
      }
    }

    if (!list || !list.length) return items;

    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;

      // Try common field names for title
      const title =
        entry.title ||
        entry.name ||
        entry.releaseTitle ||
        entry.release_title ||
        entry.version ||
        entry.versionName ||
        '';

      if (!title) continue;

      // Try common field names for date
      const dateVal =
        entry.date ||
        entry.releaseDate ||
        entry.release_date ||
        entry.publishDate ||
        entry.publish_date ||
        entry.created_at ||
        entry.createdAt ||
        entry.createTime ||
        entry.create_time ||
        entry.publishTime ||
        entry.publish_time ||
        entry.time ||
        entry.updateTime ||
        entry.update_time ||
        '';

      // Try common field names for description/content
      const description =
        entry.description ||
        entry.summary ||
        entry.content ||
        entry.desc ||
        entry.brief ||
        entry.abstract ||
        title;

      // Try common field names for link
      const link =
        entry.link ||
        entry.url ||
        entry.detailUrl ||
        entry.detail_url ||
        '';

      let pubDate;
      if (dateVal) {
        // Handle timestamps in milliseconds
        if (typeof dateVal === 'number' && dateVal > 1e12) {
          pubDate = new Date(dateVal);
        } else if (typeof dateVal === 'number') {
          pubDate = new Date(dateVal * 1000);
        } else {
          pubDate = new Date(String(dateVal).replace(/\//g, '-'));
        }
        if (isNaN(pubDate.getTime())) {
          pubDate = new Date();
        }
      } else {
        pubDate = new Date();
      }

      items.push({
        title: String(title).trim().substring(0, 300),
        link: link || `${NEWS_URL}#${encodeURIComponent(String(title).trim())}`,
        description: String(
          typeof description === 'string'
            ? description
            : JSON.stringify(description)
        )
          .replace(/<[^>]*>/g, ' ')  // Strip HTML tags
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 500),
        pubDate,
      });
    }
  } catch (err) {
    console.error('[kling] Error parsing API response:', err.message);
  }

  return items;
}

/**
 * Extract release items from the rendered DOM.
 *
 * @param {import('playwright-chromium').Page} page
 * @returns {Promise<Array>} Extracted items
 */
async function extractFromDom(page) {
  return page.evaluate((baseUrl) => {
    const results = [];
    const seen = new Set();
    const dateRegex = /^\d{4}[-/.]\d{2}[-/.]\d{2}$/;

    // ---- Strategy A: Look for date-headed sections ----
    // Kling's release page typically shows dates as section headers
    // with content below each date.
    const allElements = document.querySelectorAll('*');
    const dateElements = [];

    for (const el of allElements) {
      const text = el.textContent.trim();
      if (
        dateRegex.test(text) &&
        el.children.length === 0 &&
        el.offsetParent !== null // visible
      ) {
        dateElements.push(el);
      }
    }

    for (const dateEl of dateElements) {
      const dateStr = dateEl.textContent.trim();
      if (seen.has(dateStr)) continue;

      // Walk up to find the release section container
      let section = dateEl.parentElement;
      for (let i = 0; i < 8 && section; i++) {
        if (section.textContent.length > dateStr.length + 30) break;
        section = section.parentElement;
      }
      if (!section) continue;

      // Collect content lines (excluding the date itself)
      const textContent = section.innerText || section.textContent || '';
      const lines = textContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && l !== dateStr && l.length > 3);

      // First meaningful line becomes the title
      let title = lines[0] || `Kling AI Update — ${dateStr}`;
      if (title.length > 200) title = title.substring(0, 197) + '...';

      // Build a description from the content
      const descLines = lines.slice(0, 10).join(' • ');
      const description = descLines || title;

      seen.add(dateStr);

      results.push({
        title,
        link: `${baseUrl}#${dateStr}`,
        description: description.substring(0, 500),
        pubDate: dateStr,
      });
    }

    // ---- Strategy B: Generic card/section selectors ----
    if (results.length === 0) {
      const selectors = [
        '[class*="release"]',
        '[class*="note"]',
        '[class*="version"]',
        '[class*="update"]',
        '[class*="changelog"]',
        '[class*="history"]',
        '[class*="timeline"]',
        'article',
        '.card',
        '.item',
      ];

      for (const sel of selectors) {
        const cards = document.querySelectorAll(sel);
        for (const card of cards) {
          const titleEl = card.querySelector(
            'h1, h2, h3, h4, .title, strong, [class*="title"]'
          );
          const dateEl = card.querySelector(
            'time, [class*="date"], [class*="time"], [datetime]'
          );

          const title = titleEl?.textContent?.trim();
          if (!title || title.length < 3) continue;

          const cardKey = title.substring(0, 50);
          if (seen.has(cardKey)) continue;
          seen.add(cardKey);

          const dateText =
            dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim();

          results.push({
            title: title.substring(0, 200),
            link: `${baseUrl}#${dateText || encodeURIComponent(title)}`,
            description: card.textContent
              .trim()
              .replace(/\s+/g, ' ')
              .substring(0, 500),
            pubDate: dateText || new Date().toISOString(),
          });
        }
        if (results.length > 0) break;
      }
    }

    // ---- Strategy C: Any substantial text blocks with dates ----
    if (results.length === 0) {
      const body = document.body?.innerText || '';
      const dateMatches = body.match(/\d{4}[-/.]\d{2}[-/.]\d{2}/g);
      if (dateMatches) {
        const uniqueDates = [...new Set(dateMatches)].slice(0, 20);
        for (const d of uniqueDates) {
          results.push({
            title: `Kling AI Update — ${d}`,
            link: `${baseUrl}#${d}`,
            description: `Release update from Kling AI on ${d}`,
            pubDate: d,
          });
        }
      }
    }

    return results;
  }, NEWS_URL);
}

/**
 * Scrape using Playwright (headless browser) with network interception.
 *
 * @returns {Promise<Array>} Array of feed items
 */
async function scrapeWithPlaywright() {
  console.log('[kling] Launching Playwright for', NEWS_URL);

  let browser;
  try {
    const { chromium } = require('playwright-chromium');
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/125.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // ---- Network interception: capture API responses ----
    const apiItems = [];

    page.on('response', async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Only inspect JSON responses from the same domain or known API patterns
        if (!contentType.includes('json')) return;

        // Skip static assets and known non-data endpoints
        if (
          url.includes('/static/') ||
          url.includes('/assets/') ||
          url.includes('radar') ||
          url.includes('collect') ||
          url.includes('analytics') ||
          url.includes('log-sdk') ||
          url.includes('logsdk')
        ) {
          return;
        }

        // Look for responses that might contain release data
        if (
          url.includes('release') ||
          url.includes('note') ||
          url.includes('version') ||
          url.includes('update') ||
          url.includes('changelog') ||
          url.includes('history') ||
          url.includes('article') ||
          url.includes('content') ||
          url.includes('cms') ||
          url.includes('news') ||
          url.includes('blog') ||
          url.includes('list') ||
          url.includes('query')
        ) {
          const status = response.status();
          if (status >= 200 && status < 300) {
            const body = await response.json().catch(() => null);
            if (body) {
              const parsed = parseApiResponse(body);
              if (parsed.length > 0) {
                console.log(
                  `[kling] Intercepted ${parsed.length} items from API: ${url.substring(0, 100)}`
                );
                apiItems.push(...parsed);
              }
            }
          }
        }
      } catch {
        // Ignore response parsing errors
      }
    });

    // ---- Navigate ----
    let navigated = false;
    try {
      await page.goto(NEWS_URL, {
        waitUntil: 'networkidle',
        timeout: NAV_TIMEOUT,
      });
      navigated = true;
    } catch (err) {
      console.warn(
        `[kling] Primary URL failed (${err.message}), trying fallback...`
      );
      try {
        await page.goto(FALLBACK_URL, {
          waitUntil: 'networkidle',
          timeout: NAV_TIMEOUT,
        });
        navigated = true;
      } catch (err2) {
        console.error('[kling] Fallback URL also failed:', err2.message);
      }
    }

    if (!navigated) {
      return apiItems.length > 0 ? apiItems : [];
    }

    // Wait for dynamic content to render
    await page.waitForTimeout(CONTENT_WAIT);

    // If we got API data, that's our best source
    if (apiItems.length > 0) {
      console.log(`[kling] Using ${apiItems.length} items from API interception`);
      return apiItems;
    }

    // Fall back to DOM extraction
    console.log('[kling] No API data intercepted, extracting from DOM...');
    const domItems = await extractFromDom(page);

    console.log(`[kling] Extracted ${domItems.length} items from DOM`);

    // Convert date strings to Date objects
    return domItems.map((item) => ({
      ...item,
      pubDate:
        item.pubDate instanceof Date
          ? item.pubDate
          : new Date(String(item.pubDate).replace(/\//g, '-')),
    }));
  } catch (err) {
    console.error('[kling] Playwright scraping failed:', err.message);
    return [];
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Deduplicate items by link or title.
 *
 * @param {Array} items
 * @returns {Array} Deduplicated items
 */
function deduplicateItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.link || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Main scrape function.
 *
 * @returns {Promise<Object>} Feed descriptor { title, link, description, language, items }
 */
async function scrape() {
  console.log('[kling] Starting scraper');

  const items = await scrapeWithPlaywright();
  const unique = deduplicateItems(items);

  // Sort by date, newest first
  unique.sort((a, b) => {
    const da = a.pubDate instanceof Date ? a.pubDate : new Date(a.pubDate);
    const db = b.pubDate instanceof Date ? b.pubDate : new Date(b.pubDate);
    return db.getTime() - da.getTime();
  });

  console.log(`[kling] Returning ${unique.length} items`);
  return { ...FEED_META, items: unique };
}

module.exports = { scrape };
