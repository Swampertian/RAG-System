import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { ISearchResult } from '../../common/interfaces/search-result.interface';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Você é um assistente de documentação da Woovi.
Responda APENAS com base nos trechos abaixo.
Se a resposta não estiver nos trechos, diga "Não encontrei essa informação na documentação."
Inclua links para as fontes relevantes na sua resposta.`;

@Injectable()
export class GenerationService {
  private readonly llm: ChatOpenAI;
  private readonly logger = new Logger(GenerationService.name);
  constructor(private readonly config: ConfigService) {
    this.llm = new ChatOpenAI({
      model: this.config.get('OPENAI_MODEL', 'gpt-4o'),
      openAIApiKey: this.config.getOrThrow('OPENAI_API_KEY'),
      streaming: true,
    });
  }

  async *stream(
    question: string,
    chunks: ISearchResult[],
    history: ConversationTurn[] = [],
  ): AsyncIterable<string> {
    this.logger .debug(`Starting generation for question="${question}" with ${chunks.length} context chunks and history length=${history.length}`);
    const contextBlock = chunks
      .map((c, i) => `[${i + 1}] (${c.sourceUrl})\n${c.content}`)
      .join('\n\n---\n\n');

    const messages: BaseMessage[] = [
      new SystemMessage(`${SYSTEM_PROMPT}\n\n[TRECHOS DE DOCUMENTAÇÃO]\n${contextBlock}`),
      ...history.map((turn) =>
        turn.role === 'user'
          ? new HumanMessage(turn.content)
          : new AIMessage(turn.content),
      ),
      new HumanMessage(question),
    ];

    const stream = await this.llm.stream(messages);
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string' ? chunk.content : '';
      if (text) yield text;
    }
    this.logger.debug(`Generation completed for question="${question}"`);
  }
}
