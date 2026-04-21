jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RetrievalService } from './retrieval.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';

const row = (id: string, score: number) => ({
  id,
  content: `content ${id}`,
  sectionPath: ['Sec'],
  sourceUrl: `https://example.com/${id}`,
  category: 'API',
  score,
});

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $queryRaw: jest.fn(),
};
const mockEmbedder = { embedQuery: jest.fn().mockResolvedValue(Array(1536).fill(0.1)) };
const mockConfig = { get: jest.fn((_k: string, d: string) => d) };

describe('RetrievalService', () => {
  let service: RetrievalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$queryRawUnsafe.mockResolvedValue([row('a', 0.9), row('b', 0.8)]);
    mockPrisma.$queryRaw.mockResolvedValue([row('b', 0.7), row('c', 0.6)]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrievalService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmbeddingService, useValue: mockEmbedder },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<RetrievalService>(RetrievalService);
  });

  it('runs vector search and keyword search in parallel', async () => {
    await service.search('test query', 3);
    expect(mockEmbedder.embedQuery).toHaveBeenCalledWith('test query');
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns top-k results after RRF', async () => {
    const results = await service.search('test', 2);
    expect(results).toHaveLength(2);
  });

  it('deduplicates results appearing in both vector and keyword searches', async () => {
    const results = await service.search('test', 5);
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('sorts results by descending RRF score', async () => {
    const results = await service.search('test', 5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns empty array when both searches return no results', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const results = await service.search('unknown', 5);
    expect(results).toHaveLength(0);
  });
});
