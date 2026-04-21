import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetrievalService } from '../retrieval/retrieval.service';
import { GenerationService, ConversationTurn } from '../generation/generation.service';
import { ISearchResult } from '../../common/interfaces/search-result.interface';

export interface QueryInput {
  question: string;
  history?: ConversationTurn[];
  topK?: number;
}

export interface QueryStreamEvent {
  type: 'token' | 'sources' | 'done';
  data: string | { urls: string[] } | Record<string, never>;
}

@Injectable()
export class QueryService {
  private readonly defaultTopK: number;
  private readonly minScore: number;
  private readonly logger = new Logger(QueryService.name);
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly generation: GenerationService,
    private readonly config: ConfigService,
  ) {
    this.defaultTopK = parseInt(this.config.get('RETRIEVAL_TOP_K', '5'), 10);
    this.minScore = parseFloat(this.config.get('MIN_SIMILARITY_SCORE', '0.3'));
  }

  async *ask(input: QueryInput): AsyncIterable<QueryStreamEvent> {
    const topK = input.topK ?? this.defaultTopK;
    const results = await this.retrieval.search(input.question, topK);
    const filtered = results.filter((r) => r.score >= this.minScore);
    this.logger.debug(`Filtered results to ${filtered.length} items for query="${input.question}"`);

    const chunks: ISearchResult[] = filtered.length > 0 ? filtered : results.slice(0, topK);

    for await (const token of this.generation.stream(input.question, chunks, input.history)) {
      yield { type: 'token', data: token };
    }
    this.logger.debug(`Generation completed for query="${input.question}"`); 
    const urls = [...new Set(chunks.map((c) => c.sourceUrl))];
    yield { type: 'sources', data: { urls } };
    yield { type: 'done', data: {} };
  }
}
