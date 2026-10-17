import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MessageAttachment, AttachmentStrategy } from '../../shared/types';
import { extractPdfText } from './pdf-extractor';
import { extractDocxText } from './docx-extractor';
import { extractCodeOrText } from './text-extractor';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const CODE_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.json', '.xml', '.html', '.htm',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.sh', '.bash',
  '.sql', '.yaml', '.yml', '.css', '.scss', '.dockerfile', '.env', '.toml'
]);

export class DocumentProcessor {
  public static async processFile(
    filePath: string,
    strategy: AttachmentStrategy = 'local-extraction'
  ): Promise<MessageAttachment> {
    const stat = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);
    const id = crypto.randomUUID();

    // Check if image
    if (IMAGE_EXTENSIONS.has(ext)) {
      const mime = ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
        ? 'image/png'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
        ? 'image/gif'
        : 'image/png';

      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mime};base64,${base64}`;

      return {
        id,
        name: filename,
        path: filePath,
        size: stat.size,
        type: mime,
        strategy: 'provider-native',
        previewDataUrl: dataUrl,
        status: 'success',
      };
    }

    // Check if PDF
    if (ext === '.pdf') {
      const result = await extractPdfText(buffer);
      return {
        id,
        name: filename,
        path: filePath,
        size: stat.size,
        type: 'application/pdf',
        strategy,
        extractedText: result.text,
        pageCount: result.pageCount,
        tokenEstimate: result.tokenEstimate,
        isScanned: result.isScanned,
        status: result.status,
        errorMessage: result.errorMessage,
      };
    }

    // Check if DOCX
    if (ext === '.docx') {
      const result = await extractDocxText(buffer);
      return {
        id,
        name: filename,
        path: filePath,
        size: stat.size,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        strategy,
        extractedText: result.text,
        tokenEstimate: result.tokenEstimate,
        status: result.status,
        errorMessage: result.errorMessage,
      };
    }

    // Check if text/code/data
    if (CODE_EXTENSIONS.has(ext) || ext === '') {
      const result = extractCodeOrText(buffer, filename);
      return {
        id,
        name: filename,
        path: filePath,
        size: stat.size,
        type: 'text/plain',
        strategy: 'local-extraction',
        extractedText: result.text,
        tokenEstimate: result.tokenEstimate,
        status: result.status,
        errorMessage: result.errorMessage,
      };
    }

    // Fallback for other files: attempt utf8 text extraction
    const fallback = extractCodeOrText(buffer, filename);
    return {
      id,
      name: filename,
      path: filePath,
      size: stat.size,
      type: 'application/octet-stream',
      strategy: 'local-extraction',
      extractedText: fallback.text,
      tokenEstimate: fallback.tokenEstimate,
      status: fallback.status,
      errorMessage: fallback.errorMessage,
    };
  }

  public static async processBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<MessageAttachment> {
    const id = crypto.randomUUID();
    const ext = path.extname(filename).toLowerCase();

    if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType || 'image/png'};base64,${base64}`;
      return {
        id,
        name: filename,
        size: buffer.length,
        type: mimeType || 'image/png',
        strategy: 'provider-native',
        previewDataUrl: dataUrl,
        status: 'success',
      };
    }

    if (ext === '.pdf' || mimeType === 'application/pdf') {
      const result = await extractPdfText(buffer);
      return {
        id,
        name: filename,
        size: buffer.length,
        type: 'application/pdf',
        strategy: 'local-extraction',
        extractedText: result.text,
        pageCount: result.pageCount,
        tokenEstimate: result.tokenEstimate,
        isScanned: result.isScanned,
        status: result.status,
        errorMessage: result.errorMessage,
      };
    }

    if (ext === '.docx') {
      const result = await extractDocxText(buffer);
      return {
        id,
        name: filename,
        size: buffer.length,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        strategy: 'local-extraction',
        extractedText: result.text,
        tokenEstimate: result.tokenEstimate,
        status: result.status,
        errorMessage: result.errorMessage,
      };
    }

    const textRes = extractCodeOrText(buffer, filename);
    return {
      id,
      name: filename,
      size: buffer.length,
      type: mimeType || 'text/plain',
      strategy: 'local-extraction',
      extractedText: textRes.text,
      tokenEstimate: textRes.tokenEstimate,
      status: textRes.status,
      errorMessage: textRes.errorMessage,
    };
  }
}
