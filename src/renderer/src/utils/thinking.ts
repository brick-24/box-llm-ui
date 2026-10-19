export interface ParsedThinkingResult {
  reasoning?: string;
  content: string;
  isThinking: boolean;
}

/**
 * Parses assistant message content and explicit reasoning tokens.
 * Handles both explicit SSE reasoning fields (e.g. DeepSeek R1, Gemini Flash Thinking, o1/o3-mini)
 * and embedded inline `<think>...</think>` tags (e.g. Ollama, LM Studio, or local models).
 */
export function parseThinkingContent(
  rawContent = '',
  explicitReasoning?: string,
  isStreaming = false
): ParsedThinkingResult {
  // Case 1: Explicit reasoning is provided via API field
  if (explicitReasoning && explicitReasoning.trim()) {
    // If rawContent also happens to contain inline think tags, remove them to prevent duplication
    const cleanedContent = rawContent.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '').trimStart();
    const isStillThinking = isStreaming && (!cleanedContent || !cleanedContent.trim());
    return {
      reasoning: explicitReasoning.trim(),
      content: cleanedContent,
      isThinking: isStillThinking,
    };
  }

  // Case 2: Inline <think>...</think> or <thought>...</thought> tags inside rawContent
  if (!rawContent) {
    return {
      reasoning: undefined,
      content: '',
      isThinking: false,
    };
  }

  const thinkTagRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/i;
  const match = rawContent.match(thinkTagRegex);

  if (match && match.index !== undefined) {
    const reasoning = match[1].trim();
    const before = rawContent.slice(0, match.index).trim();
    const after = rawContent.slice(match.index + match[0].length).trimStart();
    const content = before ? `${before}\n\n${after}`.trim() : after;
    const isStillThinking = isStreaming && !content.trim();

    return {
      reasoning: reasoning || undefined,
      content,
      isThinking: isStillThinking,
    };
  }

  // Case 3: Streaming unclosed <think> or <thought> tag (currently generating reasoning)
  const openTagMatch = rawContent.match(/<(?:think|thought)>([\s\S]*)$/i);
  if (openTagMatch && openTagMatch.index !== undefined) {
    const before = rawContent.slice(0, openTagMatch.index).trim();
    const reasoning = openTagMatch[1].trim();

    if (isStreaming) {
      return {
        reasoning: reasoning || '...',
        content: before,
        isThinking: true,
      };
    } else {
      // Stream ended without a closing tag
      return {
        reasoning: reasoning || undefined,
        content: before,
        isThinking: false,
      };
    }
  }

  // Case 4: No reasoning detected
  return {
    reasoning: undefined,
    content: rawContent,
    isThinking: false,
  };
}
