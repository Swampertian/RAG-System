jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { StorageService, StorageInput } from './storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IChunk } from '../../common/interfaces/chunk.interface';

const mockDocument = {
  id: 'doc-1',
  title: 'Test',
  sourceUrl: 'https://example.com',
  category: 'API',
  rawContent: '',
  updatedAt: new Date(),
  createdAt: new Date(),
};

const mockPrisma = {
  document: {
    upsert: jest.fn().mockResolvedValue(mockDocument),
    findMany: jest.fn().mockResolvedValue([mockDocument]),
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn().mockResolvedValue({ updatedAt: new Date() }),
  },
  documentChunk: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(5),
  },
};

const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
};

const docInput: StorageInput = {
  title: 'Test',
  sourceUrl: 'https://example.com',
  category: 'API',
  rawContent: '<article>test</article>',
};

const chunk: IChunk & { embedding: number[] } = {
  content: 'Test content',
  sectionPath: ['Test', 'Section'],
  sourceUrl: 'https://example.com',
  category: 'API',
  tokenCount: 10,
  chunkIndex: 0,
  embedding: Array(1536).fill(0.1),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'PG_POOL', useValue: mockPool },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('upserts document and returns its id', async () => {
    const id = await service.upsertDocument(docInput, [chunk]);
    expect(id).toBe('doc-1');
    expect(mockPrisma.document.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sourceUrl: 'https://example.com' } }),
    );
  });

  it('deletes old chunks before inserting new ones', async () => {
    await service.upsertDocument(docInput, [chunk]);
    expect(mockPrisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
  });

  it('inserts each chunk via pg pool with vector literal', async () => {
    await service.upsertDocument(docInput, [chunk]);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('::vector');
    expect(sql).toContain('document_chunks');
    expect(params).toContain('doc-1');
  });

  it('lists documents', async () => {
    const docs = await service.listDocuments();
    expect(docs).toHaveLength(1);
    expect(mockPrisma.document.findMany).toHaveBeenCalled();
  });

  it('returns stats with document count, chunk count, and last ingestion date', async () => {
    const stats = await service.getStats();
    expect(stats.documentCount).toBe(1);
    expect(stats.chunkCount).toBe(5);
    expect(stats.lastIngestionAt).toBeInstanceOf(Date);
  });
});
