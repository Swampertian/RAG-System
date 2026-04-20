import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocusaurusCrawler } from './docusaurus.crawler';

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://docs.example.com/guides/intro</loc>
    <lastmod>2024-01-15</lastmod>
  </url>
  <url>
    <loc>https://docs.example.com/api/charge</loc>
    <lastmod>2024-02-01</lastmod>
  </url>
  <url>
    <loc>https://docs.example.com/sdk/node</loc>
    <lastmod>2024-03-10</lastmod>
  </url>
</urlset>`;

const PAGE_HTML = `<!DOCTYPE html>
<html>
  <head><title>Criar cobrança</title></head>
  <body>
    <article>
      <h1>Criar cobrança</h1>
      <p>Use a API para criar cobranças.</p>
    </article>
  </body>
</html>`;

describe('DocusaurusCrawler', () => {
  let crawler: DocusaurusCrawler;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocusaurusCrawler,
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d: string) => d) } },
      ],
    }).compile();
    crawler = module.get<DocusaurusCrawler>(DocusaurusCrawler);

    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((url: string | URL | Request) => {
      const urlString = url.toString();
      if (urlString.includes('sitemap.xml')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(SITEMAP_XML) } as Response);
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(PAGE_HTML) } as Response);
    });
  });

  afterEach(() => fetchSpy.mockRestore());

  it('discovers URLs from sitemap', async () => {
    const pages = await crawler.crawl('https://docs.example.com');
    expect(pages).toHaveLength(3);
    expect(pages[0].sourceUrl).toBe('https://docs.example.com/guides/intro');
    expect(pages[1].sourceUrl).toBe('https://docs.example.com/api/charge');
  });

  it('extracts title from h1', async () => {
    const pages = await crawler.crawl('https://docs.example.com');
    expect(pages[0].title).toBe('Criar cobrança');
  });

  it('extracts rawHtml from article element', async () => {
    const pages = await crawler.crawl('https://docs.example.com');
    expect(pages[0].rawHtml).toContain('Use a API para criar cobranças.');
  });

  it('parses lastModified from sitemap', async () => {
    const pages = await crawler.crawl('https://docs.example.com');
    expect(pages[0].lastModified).toEqual(new Date('2024-01-15'));
  });

  describe('detectCategory', () => {
    it('detects API from URL', () => {
      expect(crawler.detectCategory('https://docs.example.com/api/charge')).toBe('API');
      expect(crawler.detectCategory('https://docs.example.com/apis/charge')).toBe('API');
    });

    it('detects SDK from URL', () => {
      expect(crawler.detectCategory('https://docs.example.com/sdk/node')).toBe('SDK');
    });

    it('detects FAQ from URL', () => {
      expect(crawler.detectCategory('https://docs.example.com/faq/limits')).toBe('FAQ');
    });

    it('defaults to Guide', () => {
      expect(crawler.detectCategory('https://docs.example.com/guides/intro')).toBe('Guide');
    });
  });
});
