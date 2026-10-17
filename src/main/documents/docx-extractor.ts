import mammoth from 'mammoth';
import { DocumentChunker } from './chunker';

export interface DocxExtractionResult {
  text: string;
  tokenEstimate: number;
  status: 'success' | 'warning' | 'error';
  errorMessage?: string;
}

export async function extractDocxText(buffer: Buffer): Promise<DocxExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();
    if (!text) {
      return {
        text: '',
        tokenEstimate: 0,
        status: 'warning',
        errorMessage: 'DOCX file contains no readable text or is empty.',
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
      errorMessage: `Failed to extract DOCX: ${err.message || String(err)}`,
    };
  }
}
