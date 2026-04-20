import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';
import { IChunk, DocumentCategory } from '../../common/interfaces/chunk.interface';

export interface ChunkMeta {
  sourceUrl: string;
  category: DocumentCategory;
}

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4'] as const;
const MAX_TOKENS_PER_CHUNK = 512;

// Approximation: 1 token ≈ 5 characters (GPT tokenizer heuristic)
const CHARS_PER_TOKEN = 5;

@Injectable()
export class ChunkingService {
  /**
   * Splits an HTML page into chunks by heading hierarchy.
   * Code blocks are preserved intact regardless of size.
   * Sections exceeding MAX_TOKENS_PER_CHUNK are split further by paragraph.
   */
  chunk(html: string, pageTitle: string, meta: ChunkMeta): IChunk[] {
    const $ = load(html);
    const container = $('article, main, .markdown').first();

    if (!container.length) {
      return [];
    }

    const rawSections = this.extractSections($, container, pageTitle);
    return this.buildChunks(rawSections, meta);
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  private extractSections(
    $: ReturnType<typeof load>,
    container: ReturnType<ReturnType<typeof load>>,
    pageTitle: string,
  ): Array<{ content: string; sectionPath: string[] }> {
    const sections: Array<{ content: string; sectionPath: string[] }> = [];

    // headingStack[0] = page title (h1 level), headingStack[1] = h2 text, etc.
    const headingStack: string[] = [pageTitle];
    let currentContent = '';

    container.children().each((_, el) => {
      const tag = (el as unknown as { tagName?: string }).tagName?.toLowerCase();
      if (!tag) return;

      if (HEADING_TAGS.includes(tag as (typeof HEADING_TAGS)[number])) {
        if (currentContent.trim()) {
          sections.push({ content: currentContent.trim(), sectionPath: [...headingStack] });
          currentContent = '';
        }

        const headingLevel = parseInt(tag[1], 10);
        const headingText = $(el).text().trim();

        // Set this heading at its level and drop any deeper headings
        headingStack[headingLevel - 1] = headingText;
        headingStack.length = headingLevel;
      } else if (tag === 'pre') {
        currentContent += `\n\`\`\`\n${$(el).text()}\n\`\`\`\n`;
      } else {
        const text = $(el).text().trim();
        if (text) {
          currentContent += text + '\n\n';
        }
      }
    });

    if (currentContent.trim()) {
      sections.push({ content: currentContent.trim(), sectionPath: [...headingStack] });
    }

    return sections;
  }

  private buildChunks(
    sections: Array<{ content: string; sectionPath: string[] }>,
    meta: ChunkMeta,
  ): IChunk[] {
    const chunks: IChunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const tokenCount = this.countTokens(section.content);

      if (tokenCount <= MAX_TOKENS_PER_CHUNK) {
        chunks.push({ ...section, ...meta, tokenCount, chunkIndex: chunkIndex++ });
      } else {
        const splitChunks = this.splitByParagraphs(section.content, section.sectionPath, meta);
        for (const split of splitChunks) {
          chunks.push({ ...split, chunkIndex: chunkIndex++ });
        }
      }
    }

    return chunks;
  }

  private splitByParagraphs(
    content: string,
    sectionPath: string[],
    meta: ChunkMeta,
  ): Omit<IChunk, 'chunkIndex'>[] {
    const paragraphs = content.split(/\n\n+/);
    const chunks: Omit<IChunk, 'chunkIndex'>[] = [];
    let buffer = '';

    for (const paragraph of paragraphs) {
      const proposed = buffer ? `${buffer}\n\n${paragraph}` : paragraph;

      if (this.countTokens(proposed) > MAX_TOKENS_PER_CHUNK && buffer.trim()) {
        chunks.push({ content: buffer.trim(), sectionPath, ...meta, tokenCount: this.countTokens(buffer) });
        buffer = paragraph;
      } else {
        buffer = proposed;
      }
    }

    if (buffer.trim()) {
      chunks.push({ content: buffer.trim(), sectionPath, ...meta, tokenCount: this.countTokens(buffer) });
    }

    return chunks;
  }
}
