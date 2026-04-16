import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiModule } from './api/api.module';
import { PrismaModule } from './prisma/prisma.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ApiModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
