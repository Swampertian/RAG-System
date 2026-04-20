import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';

const EMBEDDING_BATCH_SIZE = 80;

@Injectable()
export class EmbeddingService {
  private readonly embeddings: OpenAIEmbeddings;

  constructor(private readonly config: ConfigService) {
    this.embeddings = new OpenAIEmbeddings({
      model: this.config.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
      openAIApiKey: this.config.getOrThrow('OPENAI_API_KEY'),
    });
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const allVectors: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const vectors = await this.embeddings.embedDocuments(batch);
      allVectors.push(...vectors);
    }

    return allVectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }
}
