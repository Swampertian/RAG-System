import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CHAT_TEMPLATE_PATH = join(process.cwd(), 'src', 'templates', 'web', 'base.html');

@Controller('chat')
export class ChatController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  render(): string {
    return readFileSync(CHAT_TEMPLATE_PATH, 'utf8');
  }
}
