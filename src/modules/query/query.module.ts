import { Module } from '@nestjs/common';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { GenerationModule } from '../generation/generation.module';
import { QueryService } from './query.service';

@Module({
  imports: [RetrievalModule, GenerationModule],
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}
