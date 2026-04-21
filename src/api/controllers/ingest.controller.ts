import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IngestionService } from '../../modules/ingestion/ingestion.service';

interface IngestBody {
  baseUrl?: string;
}

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  trigger(@Body() body: IngestBody = {}) {
    this.ingestion.ingestAsync(body.baseUrl);
    return { message: 'Ingestion started' };
  }
}
