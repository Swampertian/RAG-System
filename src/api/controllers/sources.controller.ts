import { Controller, Get } from '@nestjs/common';
import { StorageService } from '../../modules/storage/storage.service';

@Controller('sources')
export class SourcesController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  list() {
    return this.storage.listDocuments();
  }
}
