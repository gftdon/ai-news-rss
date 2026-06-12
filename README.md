# AI News RSS Feed Hub

Self-hosted RSS feed generator for AI company blogs and news that don't provide native RSS feeds.

## Sources (4 custom scrapers)

| Source | Method | Items |
|--------|--------|-------|
| [Kimi / Moonshot AI](https://www.kimi.com/blog/) | Cheerio (VitePress SSR) | ~17 |
| [MiniMax](https://www.minimax.io/blog) | Cheerio (Next.js SSR) | ~9 |
| [ByteDance Seed](https://seed.bytedance.com/en/blog) | JSON API | ~17 |
| [Kling AI](https://klingai.com/release-note/release-history) | Playwright (SPA) | ~9 |

## How it works

1. **Scrapers** (`scrapers/*.js`) fetch content from each source
2. **RSS Builder** (`lib/rss-builder.js`) converts scraped data to RSS 2.0 XML
3. **Orchestrator** (`generate-all.js`) runs all scrapers concurrently via `Promise.allSettled`
4. **GitHub Actions** (`.github/workflows/generate-feeds.yml`) runs every 6 hours and deploys to GitHub Pages

## Local Development

```bash
npm install
npx playwright install chromium --with-deps   # Only needed for Kling scraper
node generate-all.js
```

Generated feeds are written to `public/`:
- `public/kimi.xml`
- `public/minimax.xml`
- `public/seed.xml`
- `public/kling.xml`

## Landing Page

`public/index.html` provides a browsable catalog of all 18 AI news feeds (including official RSS and RSSHub sources), with OPML export and JSON catalog.

## License

MIT
