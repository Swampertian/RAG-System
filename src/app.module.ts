import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiModule } from './api/api.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebModule } from './web/web.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ApiModule,
    WebModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
