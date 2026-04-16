import { DocumentCategory, IChunk } from './chunk.interface';

export interface IDocument {
  title: string;
  sourceUrl: string;
  category: DocumentCategory;
  rawContent: string;
  chunks: IChunk[];
}
