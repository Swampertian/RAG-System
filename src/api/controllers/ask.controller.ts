import { Body, Controller, Header, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { QueryService } from '../../modules/query/query.service';
import { AskDto } from '../dto/ask.dto';

@Controller('ask')
export class AskController {
  private readonly logger = new Logger(AskController.name);

  constructor(private readonly query: QueryService) {}

  @Post()
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async ask(@Body() body: AskDto, @Res() res: Response): Promise<void> {
    try {
      for await (const event of this.query.ask(body)) {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        (res as unknown as { flush?: () => void }).flush?.();
      }
    } catch (err) {
      this.logger.error(`/ask failed: ${(err as Error).message}`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Stream interrupted' })}\n\n`);
    } finally {
      res.end();
    }
  }
}
