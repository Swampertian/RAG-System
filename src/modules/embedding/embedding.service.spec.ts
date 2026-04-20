import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

const mockEmbedDocuments = jest.fn();
const mockEmbedQuery = jest.fn();

jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: mockEmbedDocuments,
    embedQuery: mockEmbedQuery,
  })),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue: string) => defaultValue),
            getOrThrow: jest.fn().mockReturnValue('sk-test'),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('embeds a list of texts', async () => {
    const fakeVectors = [Array(1536).fill(0.1), Array(1536).fill(0.2)];
    mockEmbedDocuments.mockResolvedValue(fakeVectors);

    const result = await service.embedTexts(['text1', 'text2']);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1536);
    expect(mockEmbedDocuments).toHaveBeenCalledWith(['text1', 'text2']);
  });

  it('batches calls for more than 80 texts', async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `text${i}`);
    mockEmbedDocuments.mockResolvedValueOnce(Array(80).fill(Array(1536).fill(0)));
    mockEmbedDocuments.mockResolvedValueOnce(Array(20).fill(Array(1536).fill(0)));

    await service.embedTexts(texts);
    expect(mockEmbedDocuments).toHaveBeenCalledTimes(2);
    expect(mockEmbedDocuments).toHaveBeenNthCalledWith(1, texts.slice(0, 80));
    expect(mockEmbedDocuments).toHaveBeenNthCalledWith(2, texts.slice(80));
  });

  it('embeds a single query', async () => {
    mockEmbedQuery.mockResolvedValue(Array(1536).fill(0.5));

    const result = await service.embedQuery('test query');
    expect(result).toHaveLength(1536);
    expect(mockEmbedQuery).toHaveBeenCalledWith('test query');
  });
});
