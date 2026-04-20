import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { load } from 'cheerio';
import { DocumentCategory } from '../../../common/interfaces/chunk.interface';

export interface CrawledPage {
  title: string;
  sourceUrl: string;
  category: DocumentCategory;
  rawHtml: string;
  lastModified: Date;
}

interface SitemapEntry {
  url: string;
  lastModified: Date;
}

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: DocumentCategory }> = [
  { pattern: /\/apis?\//i, category: 'API' },
  { pattern: /\/sdks?\//i, category: 'SDK' },
  { pattern: /\/faqs?\//i, category: 'FAQ' },
];

@Injectable()
export class DocusaurusCrawler {
  private readonly logger = new Logger(DocusaurusCrawler.name);
  private readonly requestTimeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.requestTimeoutMs = parseInt(
      this.config.get('CRAWLER_REQUEST_TIMEOUT_MS', '15000'),
      10,
    );
  }

  async crawl(baseUrl: string): Promise<CrawledPage[]> {
    const entries = await this.discoverUrlsFromSitemap(baseUrl);
    const pages: CrawledPage[] = [];

    for (const entry of entries) {
      try {
        const page = await this.fetchPage(entry.url, entry.lastModified);
        if (page) {
          pages.push(page);
        }
      } catch (err) {
        this.logger.warn(`Skipping ${entry.url}: ${(err as Error).message}`);
      }
    }

    return pages;
  }

  private async discoverUrlsFromSitemap(baseUrl: string): Promise<SitemapEntry[]> {
    this.logger.debug(`[crawl] fetching sitemap url=${baseUrl}/sitemap.xml timeout=${this.requestTimeoutMs}ms`);

    const response = await this.fetchWithTimeout(`${baseUrl}/sitemap.xml`);
    const xmlText = await response.text();
    const $ = load(xmlText, { xmlMode: true });

    const entries: SitemapEntry[] = [];

    $('url').each((_, el) => {
      const url = $(el).find('loc').text().trim();
      const lastModText = $(el).find('lastmod').text().trim();

      if (url) {
        entries.push({
          url,
          lastModified: lastModText ? new Date(lastModText) : new Date(),
        });
      }
    });

    this.logger.debug(`[crawl] sitemap parsed entries=${entries.length}`);
    return entries;
  }

  private async fetchPage(url: string, lastModified: Date): Promise<CrawledPage | null> {
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    const title = $('h1').first().text().trim() || $('title').text().trim();
    if (!title) {
      return null;
    }

    const rawHtml = $('article, main, .markdown').first().html() ?? '';

    return {
      title,
      sourceUrl: url,
      category: this.detectCategory(url),
      rawHtml,
      lastModified,
    };
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(url, { signal: controller.signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error(`Request timed out after ${this.requestTimeoutMs}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  detectCategory(url: string): DocumentCategory {
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(url)) {
        return category;
      }
    }
    return 'Guide';
  }
}
