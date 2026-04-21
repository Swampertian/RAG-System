import { Module } from '@nestjs/common';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { QueryModule } from '../modules/query/query.module';
import { StorageModule } from '../modules/storage/storage.module';
import { AskController } from './controllers/ask.controller';
import { HealthController } from './controllers/health.controller';
import { IngestController } from './controllers/ingest.controller';
import { SourcesController } from './controllers/sources.controller';

@Module({
  imports: [IngestionModule, QueryModule, StorageModule],
  controllers: [AskController, IngestController, SourcesController, HealthController],
  providers: [],
})
export class ApiModule {}
