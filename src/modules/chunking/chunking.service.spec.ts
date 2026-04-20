import { Test, TestingModule } from '@nestjs/testing';
import { ChunkingService } from './chunking.service';

const PAGE_META = { sourceUrl: 'https://example.com/docs/pix', category: 'API' as const };

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChunkingService],
    }).compile();
    service = module.get<ChunkingService>(ChunkingService);
  });

  it('splits HTML into chunks by h2 headings', () => {
    const html = `
      <article>
        <h1>Criar cobrança</h1>
        <h2>Autenticação</h2>
        <p>Use seu token API para autenticar.</p>
        <h2>Parâmetros</h2>
        <p>Envie o campo correlationID.</p>
      </article>
    `;
    const chunks = service.chunk(html, 'Criar cobrança', PAGE_META);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].sectionPath).toEqual(['Criar cobrança', 'Autenticação']);
    expect(chunks[1].sectionPath).toEqual(['Criar cobrança', 'Parâmetros']);
  });

  it('preserves code blocks intact', () => {
    const html = `
      <article>
        <h2>Exemplo</h2>
        <p>Faça a requisição:</p>
        <pre>curl -X POST https://api.woovi.com/api/v1/charge</pre>
      </article>
    `;
    const chunks = service.chunk(html, 'API', PAGE_META);
    expect(chunks[0].content).toContain('curl -X POST');
    expect(chunks[0].content).toContain('```');
  });

  it('tracks nested sectionPath with h3', () => {
    const html = `
      <article>
        <h2>Criar cobrança</h2>
        <h3>Request body</h3>
        <p>Campo correlationID.</p>
      </article>
    `;
    const chunks = service.chunk(html, 'API Pix', PAGE_META);
    expect(chunks[0].sectionPath).toEqual(['API Pix', 'Criar cobrança', 'Request body']);
  });

  it('resets h3 path when new h2 appears', () => {
    const html = `
      <article>
        <h2>Seção A</h2>
        <h3>Sub A</h3>
        <p>Texto.</p>
        <h2>Seção B</h2>
        <p>Texto B.</p>
      </article>
    `;
    const chunks = service.chunk(html, 'Doc', PAGE_META);
    expect(chunks[0].sectionPath).toEqual(['Doc', 'Seção A', 'Sub A']);
    expect(chunks[1].sectionPath).toEqual(['Doc', 'Seção B']);
  });

  it('splits large chunks by paragraph', () => {
    const longPara1 = 'A'.repeat(1000);
    const longPara2 = 'B'.repeat(1000);
    const longPara3 = 'C'.repeat(1000);
    const html = `
      <article>
        <h2>Long Section</h2>
        <p>${longPara1}</p>
        <p>${longPara2}</p>
        <p>${longPara3}</p>
      </article>
    `;
    const chunks = service.chunk(html, 'Doc', PAGE_META);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => expect(service.countTokens(c.content)).toBeLessThanOrEqual(512));
  });

  it('assigns sequential chunkIndex', () => {
    const html = `
      <article>
        <h2>A</h2><p>texto</p>
        <h2>B</h2><p>texto</p>
        <h2>C</h2><p>texto</p>
      </article>
    `;
    const chunks = service.chunk(html, 'Doc', PAGE_META);
    expect(chunks.map(c => c.chunkIndex)).toEqual([0, 1, 2]);
  });

  it('returns sourceUrl and category from meta', () => {
    const html = `<article><h2>Test</h2><p>content</p></article>`;
    const chunks = service.chunk(html, 'Doc', PAGE_META);
    expect(chunks[0].sourceUrl).toBe(PAGE_META.sourceUrl);
    expect(chunks[0].category).toBe(PAGE_META.category);
  });
});
