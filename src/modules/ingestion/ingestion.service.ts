import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocusaurusCrawler } from './crawlers/docusaurus.crawler';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { StorageService } from '../storage/storage.service';

export interface IngestionResult {
  baseUrl: string;
  pagesProcessed: number;
  chunksStored: number;
  errors: number;
  durationMs: number;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly crawler: DocusaurusCrawler,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
    private readonly storage: StorageService,
  ) {}

  ingestAsync(baseUrl?: string): void {
    this.ingest(baseUrl).catch((err: Error) =>
      this.logger.error(`Ingestion pipeline crashed: ${err.message}`, err.stack),
    );
  }

  async ingest(baseUrl?: string): Promise<IngestionResult> {
    const url = baseUrl ?? this.config.getOrThrow<string>('DOCS_BASE_URL');
    const startedAt = Date.now();

    this.logger.log(`[ingestion] start url=${url}`);

    const crawlStart = Date.now();
    const pages = await this.crawler.crawl(url);
    this.logger.log(`[crawl] done pages=${pages.length} duration=${Date.now() - crawlStart}ms`);

    let chunksStored = 0;
    let errors = 0;

    for (const [i, page] of pages.entries()) {
      const pageStart = Date.now();
      this.logger.debug(`[page:${i + 1}/${pages.length}] processing url=${page.sourceUrl} category=${page.category}`);

      try {
        const chunkStart = Date.now();
        const chunks = this.chunking.chunk(page.rawHtml, page.title, {
          sourceUrl: page.sourceUrl,
          category: page.category,
        });
        this.logger.debug(`[page:${i + 1}/${pages.length}] chunked chunks=${chunks.length} duration=${Date.now() - chunkStart}ms`);

        if (chunks.length === 0) {
          this.logger.warn(`[page:${i + 1}/${pages.length}] no chunks url=${page.sourceUrl} skipping`);
          continue;
        }

        const embedStart = Date.now();
        const texts = chunks.map((c) => c.content);
        const vectors = await this.embedding.embedTexts(texts);
        this.logger.debug(`[page:${i + 1}/${pages.length}] embedded chunks=${vectors.length} duration=${Date.now() - embedStart}ms`);

        const storeStart = Date.now();
        const chunksWithEmbeddings = chunks.map((chunk, idx) => ({
          ...chunk,
          embedding: vectors[idx],
        }));
        await this.storage.upsertDocument(
          {
            title: page.title,
            sourceUrl: page.sourceUrl,
            category: page.category,
            rawContent: page.rawHtml,
          },
          chunksWithEmbeddings,
        );
        this.logger.debug(`[page:${i + 1}/${pages.length}] stored duration=${Date.now() - storeStart}ms`);

        chunksStored += chunks.length;
        this.logger.log(`[page:${i + 1}/${pages.length}] ok url=${page.sourceUrl} chunks=${chunks.length} total=${Date.now() - pageStart}ms`);
      } catch (err) {
        this.logger.error(
          `[page:${i + 1}/${pages.length}] failed url=${page.sourceUrl} error=${(err as Error).message}`,
          (err as Error).stack,
        );
        errors++;
      }
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `[ingestion] complete pages=${pages.length - errors} chunks=${chunksStored} errors=${errors} duration=${durationMs}ms`,
    );

    return {
      baseUrl: url,
      pagesProcessed: pages.length - errors,
      chunksStored,
      errors,
      durationMs,
    };
  }
}
