import { DocumentChunker } from './chunker';

export interface TextExtractionResult {
  text: string;
  tokenEstimate: number;
  status: 'success' | 'warning' | 'error';
  errorMessage?: string;
}

export function extractCodeOrText(buffer: Buffer, filename: string): TextExtractionResult {
  try {
    const raw = buffer.toString('utf8');
    const text = raw.trim();
    if (!text) {
      return {
        text: '',
        tokenEstimate: 0,
        status: 'warning',
        errorMessage: 'File is empty.',
      };
    }

    return {
      text,
      tokenEstimate: DocumentChunker.estimateTokens(text),
      status: 'success',
    };
  } catch (err: any) {
    return {
      text: '',
      tokenEstimate: 0,
      status: 'error',
      errorMessage: `Failed to decode text: ${err.message || String(err)}`,
    };
  }
}
