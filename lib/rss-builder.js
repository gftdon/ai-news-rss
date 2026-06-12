/**
 * rss-builder.js
 *
 * Shared utility that takes a feed descriptor and outputs valid RSS 2.0 XML.
 *
 * Usage:
 *   const { buildRss } = require('./rss-builder');
 *   const xml = buildRss({
 *     title: 'My Feed',
 *     link: 'https://example.com',
 *     description: 'Latest news',
 *     items: [
 *       { title: '...', link: '...', description: '...', pubDate: new Date() }
 *     ]
 *   });
 */

'use strict';

/**
 * Escape special XML characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a Date (or date-like value) to RFC-822 format required by RSS 2.0.
 * @param {Date|string|number} date
 * @returns {string}
 */
function toRfc822(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toUTCString();
}

/**
 * Build a valid RSS 2.0 XML string from a feed descriptor.
 *
 * @param {Object} feed
 * @param {string}  feed.title       - Channel title
 * @param {string}  feed.link        - Channel link (website URL)
 * @param {string}  feed.description - Channel description
 * @param {string}  [feed.language]  - Language code (e.g. 'en' or 'zh-cn')
 * @param {Array}   feed.items       - Array of item objects
 * @param {string}  feed.items[].title
 * @param {string}  feed.items[].link
 * @param {string}  feed.items[].description
 * @param {Date|string|number} [feed.items[].pubDate]
 * @returns {string} RSS 2.0 XML string
 */
function buildRss(feed) {
  const { title, link, description, language, items = [] } = feed;

  const itemsXml = items
    .map((item) => {
      const parts = ['    <item>'];
      if (item.title) parts.push(`      <title>${escapeXml(item.title)}</title>`);
      if (item.link) parts.push(`      <link>${escapeXml(item.link)}</link>`);
      if (item.description) {
        parts.push(`      <description>${escapeXml(item.description)}</description>`);
      }
      if (item.pubDate) {
        parts.push(`      <pubDate>${toRfc822(item.pubDate)}</pubDate>`);
      }
      if (item.link) {
        parts.push(`      <guid isPermaLink="true">${escapeXml(item.link)}</guid>`);
      }
      parts.push('    </item>');
      return parts.join('\n');
    })
    .join('\n');

  const channelParts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(link)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
  ];

  if (language) {
    channelParts.push(`    <language>${escapeXml(language)}</language>`);
  }

  channelParts.push(`    <lastBuildDate>${toRfc822(new Date())}</lastBuildDate>`);

  if (itemsXml) {
    channelParts.push(itemsXml);
  }

  channelParts.push('  </channel>', '</rss>', '');

  return channelParts.join('\n');
}

module.exports = { buildRss, escapeXml, toRfc822 };
