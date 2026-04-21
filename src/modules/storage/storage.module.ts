import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { StorageService } from './storage.service';

@Module({
  providers: [
    StorageService,
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow('DATABASE_URL') }),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
