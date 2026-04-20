import { Module } from '@nestjs/common';
import { ChunkingModule } from '../chunking/chunking.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { StorageModule } from '../storage/storage.module';
import { DocusaurusCrawler } from './crawlers/docusaurus.crawler';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ChunkingModule, EmbeddingModule, StorageModule],
  providers: [DocusaurusCrawler, IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
