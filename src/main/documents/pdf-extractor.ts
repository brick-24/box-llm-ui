import pdf from 'pdf-parse';
import { DocumentChunker } from './chunker';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  tokenEstimate: number;
  isScanned: boolean;
  status: 'success' | 'warning' | 'error';
  errorMessage?: string;
}

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  try {
    const data = await pdf(buffer);
    const rawText = data.text || '';
    const cleanText = rawText.trim();
    const pageCount = data.numpages || 1;

    // Detect scanned or image-only PDF: very little or no extracted text
    if (cleanText.length < 50 && pageCount >= 1) {
      return {
        text: cleanText,
        pageCount,
        tokenEstimate: DocumentChunker.estimateTokens(cleanText),
        isScanned: true,
        status: 'warning',
        errorMessage: 'Document appears to be scanned or contains image-only pages with negligible selectable text. OCR or image-input is recommended.',
      };
    }

    return {
      text: cleanText,
      pageCount,
      tokenEstimate: DocumentChunker.estimateTokens(cleanText),
      isScanned: false,
      status: 'success',
    };
  } catch (err: any) {
    const msg = err.message || String(err);
    const isEncrypted = msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypted');
    return {
      text: '',
      pageCount: 0,
      tokenEstimate: 0,
      isScanned: false,
      status: 'error',
      errorMessage: isEncrypted
        ? 'Cannot read encrypted or password-protected PDF.'
        : `Failed to parse PDF document: ${msg}`,
    };
  }
}
