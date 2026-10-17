import { describe, it, expect } from 'vitest';
import { DocumentChunker } from '../src/main/documents/chunker';
import { extractCodeOrText } from '../src/main/documents/text-extractor';

describe('Document Processing & Chunker', () => {
  it('estimates token count accurately with ~4 characters per token heuristic', () => {
    expect(DocumentChunker.estimateTokens('')).toBe(0);
    expect(DocumentChunker.estimateTokens('1234')).toBe(1);
    expect(DocumentChunker.estimateTokens('Hello, this is a test string containing approximately 60 characters')).toBe(17);
  });

  it('chunks large text documents along paragraph boundaries', () => {
    const paragraph = 'This is a test paragraph for chunking. '.repeat(20);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;

    const { chunks, totalTokens } = DocumentChunker.chunkText(text, {
      maxTokensPerChunk: 100,
      overlapTokens: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(totalTokens).toBeGreaterThan(100);
  });

  it('extracts text and code files with correct metadata and token counts', () => {
    const code = 'function add(a: number, b: number): number {\n  return a + b;\n}';
    const buffer = Buffer.from(code, 'utf8');

    const result = extractCodeOrText(buffer, 'math.ts');
    expect(result.status).toBe('success');
    expect(result.text).toBe(code);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('flags empty files with a warning status', () => {
    const buffer = Buffer.from('   \n\t  ', 'utf8');
    const result = extractCodeOrText(buffer, 'empty.txt');
    expect(result.status).toBe('warning');
    expect(result.errorMessage).toBe('File is empty.');
  });
});
