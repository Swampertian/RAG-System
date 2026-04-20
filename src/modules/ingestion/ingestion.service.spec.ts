jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
import { DocusaurusCrawler, CrawledPage } from './crawlers/docusaurus.crawler';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { StorageService } from '../storage/storage.service';

const FAKE_PAGE: CrawledPage = {
  title: 'Intro',
  sourceUrl: 'https://docs.example.com/guides/intro',
  category: 'Guide',
  rawHtml: '<article><h1>Intro</h1><p>Hello world.</p></article>',
  lastModified: new Date('2024-01-01'),
};

describe('IngestionService', () => {
  let service: IngestionService;
  let crawler: jest.Mocked<DocusaurusCrawler>;
  let chunking: jest.Mocked<ChunkingService>;
  let embedding: jest.Mocked<EmbeddingService>;
  let storage: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('https://docs.example.com') },
        },
        {
          provide: DocusaurusCrawler,
          useValue: { crawl: jest.fn().mockResolvedValue([FAKE_PAGE]) },
        },
        {
          provide: ChunkingService,
          useValue: {
            chunk: jest.fn().mockReturnValue([
              {
                content: 'Hello world.',
                sectionPath: ['Intro'],
                sourceUrl: FAKE_PAGE.sourceUrl,
                category: FAKE_PAGE.category,
                tokenCount: 3,
                chunkIndex: 0,
              },
            ]),
          },
        },
        {
          provide: EmbeddingService,
          useValue: { embedTexts: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]) },
        },
        {
          provide: StorageService,
          useValue: { upsertDocument: jest.fn().mockResolvedValue('doc-id-1') },
        },
      ],
    }).compile();

    service = module.get(IngestionService);
    crawler = module.get(DocusaurusCrawler);
    chunking = module.get(ChunkingService);
    embedding = module.get(EmbeddingService);
    storage = module.get(StorageService);
  });

  it('uses config DOCS_BASE_URL when no baseUrl passed', async () => {
    await service.ingest();
    expect(crawler.crawl).toHaveBeenCalledWith('https://docs.example.com');
  });

  it('uses provided baseUrl over config', async () => {
    await service.ingest('https://other.example.com');
    expect(crawler.crawl).toHaveBeenCalledWith('https://other.example.com');
  });

  it('returns correct stats', async () => {
    const result = await service.ingest();
    expect(result).toMatchObject({
      baseUrl: 'https://docs.example.com',
      pagesProcessed: 1,
      chunksStored: 1,
      errors: 0,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('calls chunking, embedding and storage in order', async () => {
    await service.ingest();
    expect(chunking.chunk).toHaveBeenCalledWith(
      FAKE_PAGE.rawHtml,
      FAKE_PAGE.title,
      { sourceUrl: FAKE_PAGE.sourceUrl, category: FAKE_PAGE.category },
    );
    expect(embedding.embedTexts).toHaveBeenCalledWith(['Hello world.']);
    expect(storage.upsertDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: FAKE_PAGE.sourceUrl }),
      expect.arrayContaining([expect.objectContaining({ embedding: [0.1, 0.2, 0.3] })]),
    );
  });

  it('increments errors and continues on page failure', async () => {
    storage.upsertDocument.mockRejectedValueOnce(new Error('DB down'));
    const result = await service.ingest();
    expect(result.errors).toBe(1);
    expect(result.pagesProcessed).toBe(0);
  });

  it('skips page with no chunks', async () => {
    chunking.chunk.mockReturnValueOnce([]);
    const result = await service.ingest();
    expect(embedding.embedTexts).not.toHaveBeenCalled();
    expect(storage.upsertDocument).not.toHaveBeenCalled();
    expect(result.chunksStored).toBe(0);
  });
});
