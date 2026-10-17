export interface ChunkOptions {
  maxTokensPerChunk?: number;
  overlapTokens?: number;
}

export class DocumentChunker {
  /**
   * Fast, reliable heuristic: ~4 characters per token for English and code
   */
  public static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Chunks large documents while respecting paragraph boundaries where possible
   */
  public static chunkText(
    text: string,
    options: ChunkOptions = {}
  ): { chunks: string[]; totalTokens: number } {
    const maxTokens = options.maxTokensPerChunk || 4000;
    const maxChars = maxTokens * 4;
    const overlapChars = (options.overlapTokens || 200) * 4;

    const totalTokens = this.estimateTokens(text);
    if (totalTokens <= maxTokens) {
      return { chunks: [text], totalTokens };
    }

    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk.length + para.length) > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // keep tail of previous chunk for overlap
        const overlap = currentChunk.slice(Math.max(0, currentChunk.length - overlapChars));
        currentChunk = overlap + '\n\n' + para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return { chunks, totalTokens };
  }
}
