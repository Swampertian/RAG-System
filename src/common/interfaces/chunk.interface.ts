export type DocumentCategory = 'API' | 'SDK' | 'Guide' | 'FAQ';

export interface IChunk {
  content: string;
  sectionPath: string[];
  sourceUrl: string;
  category: DocumentCategory;
  tokenCount: number;
  chunkIndex: number;
}
