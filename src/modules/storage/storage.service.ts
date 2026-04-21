import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { PrismaService } from '../../prisma/prisma.service';
import { IChunk } from '../../common/interfaces/chunk.interface';

export interface StorageInput {
  title: string;
  sourceUrl: string;
  category: string;
  rawContent: string;
}

const INSERT_CHUNK_SQL = `
  INSERT INTO document_chunks
    (id, "documentId", content, "sectionPath", embedding, "chunkIndex", "tokenCount", "createdAt")
  VALUES
    ($1, $2, $3, $4::text[], $5::vector, $6, $7, NOW())
`;

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async upsertDocument(
    doc: StorageInput,
    chunks: Array<IChunk & { embedding: number[] }>,
  ): Promise<string> {
    const document = await this.prisma.document.upsert({
      where: { sourceUrl: doc.sourceUrl },
      create: {
        id: randomUUID(),
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        category: doc.category,
        rawContent: doc.rawContent,
      },
      update: {
        title: doc.title,
        rawContent: doc.rawContent,
        category: doc.category,
      },
    });

    await this.prisma.documentChunk.deleteMany({ where: { documentId: document.id } });
    await this.insertChunks(document.id, chunks);

    return document.id;
  }

  private async insertChunks(
    documentId: string,
    chunks: Array<IChunk & { embedding: number[] }>,
  ): Promise<void> {
    for (const chunk of chunks) {
      const embeddingLiteral = `[${chunk.embedding.join(',')}]`;

      await this.pool.query(INSERT_CHUNK_SQL, [
        randomUUID(),
        documentId,
        chunk.content,
        chunk.sectionPath,
        embeddingLiteral,
        chunk.chunkIndex,
        chunk.tokenCount,
      ]);
    }
  }

  async listDocuments() {
    return this.prisma.document.findMany({
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        category: true,
        updatedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const [documentCount, chunkCount, latestDocument] = await Promise.all([
      this.prisma.document.count(),
      this.prisma.documentChunk.count(),
      this.prisma.document.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);

    return {
      documentCount,
      chunkCount,
      lastIngestionAt: latestDocument?.updatedAt ?? null,
    };
  }
}
