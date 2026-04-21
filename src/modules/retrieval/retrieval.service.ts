import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { ISearchResult } from '../../common/interfaces/search-result.interface';

interface RawSearchRow {
  id: string;
  content: string;
  sectionPath: string[] | string;
  sourceUrl: string;
  category: string;
  score: number;
}

type SearchRow = Omit<RawSearchRow, 'sectionPath'> & { sectionPath: string[] };

@Injectable()
export class RetrievalService {
  private readonly vectorWeight: number;
  private readonly keywordWeight: number;
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedder: EmbeddingService,
    private readonly config: ConfigService,

  ) {
    this.vectorWeight = parseFloat(this.config.get('VECTOR_WEIGHT', '0.7'));
    this.keywordWeight = parseFloat(this.config.get('KEYWORD_WEIGHT', '0.3'));
  }

  async search(query: string, topK: number): Promise<ISearchResult[]> {
    this.logger.debug(`Starting search for query="${query}" with topK=${topK}`);
    const limit = topK * 4;
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, limit),
      this.keywordSearch(query, limit),
    ]);
    return this.reciprocalRankFusion(vectorResults, keywordResults, topK);
  }

  private async vectorSearch(query: string, limit: number): Promise<SearchRow[]> {
    const embedding = await this.embedder.embedQuery(query);
    const embeddingStr = `[${embedding.join(',')}]`;
    const rows = await this.prisma.$queryRawUnsafe<RawSearchRow[]>(
      `SELECT dc.id, dc.content, dc."sectionPath", d."sourceUrl", d.category,
              1 - (dc.embedding <=> $1::vector) AS score
       FROM document_chunks dc
       JOIN documents d ON dc."documentId" = d.id
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $2`,
      embeddingStr,
      limit,
    );
    this.logger.debug(`Vector search returned ${rows.length} results for query="${query}"`);
    return rows.map(this.normalizeSectionPath);
  }

  private async keywordSearch(query: string, limit: number): Promise<SearchRow[]> {
    const rows = await this.prisma.$queryRaw<RawSearchRow[]>`
      SELECT dc.id, dc.content, dc."sectionPath", d."sourceUrl", d.category,
             similarity(dc.content, ${query}) AS score
      FROM document_chunks dc
      JOIN documents d ON dc."documentId" = d.id
      WHERE dc.content % ${query}
      LIMIT ${limit}
    `;
    return rows.map(this.normalizeSectionPath);
  }

  private normalizeSectionPath(row: RawSearchRow): SearchRow {
    const sectionPath = typeof row.sectionPath === 'string'
      ? (row.sectionPath as string).replace(/^\{|\}$/g, '').split(',').filter(Boolean)
      : row.sectionPath;
    return { ...row, sectionPath };
  }

  private reciprocalRankFusion(
    vectorResults: SearchRow[],
    keywordResults: SearchRow[],
    topK: number,
  ): ISearchResult[] {
    const K = 60;
    const scores = new Map<string, { row: SearchRow; score: number }>();

    vectorResults.forEach((row, rank) => {
      scores.set(row.id, { row, score: this.vectorWeight / (K + rank + 1) });
    });

    keywordResults.forEach((row, rank) => {
      const add = this.keywordWeight / (K + rank + 1);
      const existing = scores.get(row.id);
      if (existing) {
        existing.score += add;
      } else {
        scores.set(row.id, { row, score: add });
      }
    });

    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ row, score }) => ({ ...row, score }));
  }
}
