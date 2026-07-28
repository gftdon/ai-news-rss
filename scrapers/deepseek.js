/**
 * DeepSeek news scraper.
 *
 * DeepSeek's main site (deepseek.com) is a SPA with no blog in the initial HTML.
 * Their news/research updates are typically announced on their GitHub and social media.
 *
 * Strategy: Scrape the DeepSeek GitHub repository's releases page,
 * which contains model release announcements with dates and descriptions.
 * Also check if there's an API or news page available.
 */

'use strict';

const cheerio = require('cheerio');

const FEED_META = {
  title: 'DeepSeek AI News',
  link: 'https://www.deepseek.com',
  description: 'Latest model releases and news from DeepSeek AI',
  language: 'en',
};

// GitHub API for releases
const GITHUB_API_URL = 'https://api.github.com/repos/deepseek-ai/DeepSeek-V3/releases';
// DeepSeek's GitHub org
const GITHUB_ORG_URL = 'https://api.github.com/orgs/deepseek-ai/repos?sort=updated&per_page=10';

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

async function scrape() {
  console.log('[deepseek] Fetching from GitHub');

  const items = [];
  const seen = new Set();

  // Strategy 1: Get recent repos with releases from deepseek-ai org
  try {
    const orgRes = await fetch(GITHUB_ORG_URL, {
      headers: githubHeaders(),
    });

    if (orgRes.ok) {
      const repos = await orgRes.json();

      for (const repo of repos.slice(0, 8)) {
        // Get latest release for each repo
        try {
          const relRes = await fetch(
            `https://api.github.com/repos/deepseek-ai/${repo.name}/releases?per_page=3`,
            {
              headers: githubHeaders(),
            }
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
    console.error('[deepseek] GitHub org fetch failed:', err.message);
  }

  // Strategy 2: If no releases found, fall back to repo descriptions
  if (items.length === 0) {
    try {
      const orgRes = await fetch(GITHUB_ORG_URL, {
        headers: {
          'User-Agent': 'AI-News-RSS/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (orgRes.ok) {
        const repos = await orgRes.json();
        for (const repo of repos) {
          if (!repo.description) continue;
          items.push({
            title: repo.name,
            link: repo.html_url,
            description: repo.description,
            pubDate: new Date(repo.pushed_at || repo.updated_at),
          });
        }
      }
    } catch (err) {
      console.error('[deepseek] GitHub fallback failed:', err.message);
    }
  }

  // Sort by date descending
  items.sort((a, b) => b.pubDate - a.pubDate);

  console.log(`[deepseek] Found ${items.length} items`);
  return { ...FEED_META, items: items.slice(0, 20) };
}

module.exports = { scrape };
