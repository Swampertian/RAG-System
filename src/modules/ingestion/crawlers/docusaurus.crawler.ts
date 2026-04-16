import { Injectable, Logger } from '@nestjs/common';
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
    const response = await fetch(`${baseUrl}/sitemap.xml`);
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

    return entries;
  }

  private async fetchPage(url: string, lastModified: Date): Promise<CrawledPage | null> {
    const response = await fetch(url);

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

  detectCategory(url: string): DocumentCategory {
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(url)) {
        return category;
      }
    }
    return 'Guide';
  }
}
