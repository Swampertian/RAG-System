import { Controller, Get } from '@nestjs/common';
import { StorageService } from '../../modules/storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  async check() {
    const stats = await this.storage.getStats();
    return { status: 'ok', ...stats };
  }
}
