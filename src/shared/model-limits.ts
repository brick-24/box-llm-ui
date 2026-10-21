import { ModelInfo } from './types';

export interface ModelLimitSpecs {
  contextLength: number;         // Total input / context window tokens
  maxOutputTokens: number;       // Maximum completion / output tokens supported
  defaultOutputTokens: number;   // Recommended default output tokens
  isReasoning?: boolean;         // Uses reasoning tokens (e.g., OpenAI o1/o3-mini)
}

/**
 * Well-curated catalog of known LLM context windows and output limits.
 * Sources: Official documentation for OpenAI, Anthropic, Google, DeepSeek, Meta Llama, Mistral, Qwen.
 */
interface ModelPatternRule {
  pattern: RegExp;
  specs: ModelLimitSpecs;
}

export const OPENROUTER_CONVERSATIONAL_FREE_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'cohere/north-mini-code:free',
  'liquid/lfm-2.5-2.6b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
];

const MODEL_RULES: ModelPatternRule[] = [
  // --- OpenRouter Free Router ---
  {
    pattern: /^openrouter\/free$/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },

  // --- OpenAI Reasoning Models ---
  {
    pattern: /^o3-mini/i,
    specs: { contextLength: 200000, maxOutputTokens: 100000, defaultOutputTokens: 8192, isReasoning: true },
  },
  {
    pattern: /^o1-mini/i,
    specs: { contextLength: 128000, maxOutputTokens: 65536, defaultOutputTokens: 8192, isReasoning: true },
  },
  {
    pattern: /^o1(-preview)?/i,
    specs: { contextLength: 200000, maxOutputTokens: 100000, defaultOutputTokens: 8192, isReasoning: true },
  },

  // --- OpenAI GPT-4o & GPT-4 Series ---
  {
    pattern: /gpt-4o(-mini)?/i,
    specs: { contextLength: 128000, maxOutputTokens: 16384, defaultOutputTokens: 4096 },
  },
  {
    pattern: /chatgpt-4o/i,
    specs: { contextLength: 128000, maxOutputTokens: 16384, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gpt-4-turbo/i,
    specs: { contextLength: 128000, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gpt-4-32k/i,
    specs: { contextLength: 32768, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gpt-4/i,
    specs: { contextLength: 8192, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gpt-3\.5-turbo/i,
    specs: { contextLength: 16385, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },

  // --- Anthropic Claude Models ---
  {
    pattern: /claude-3-7-sonnet/i,
    specs: { contextLength: 200000, maxOutputTokens: 64000, defaultOutputTokens: 8192 },
  },
  {
    pattern: /claude-3-5-sonnet/i,
    specs: { contextLength: 200000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /claude-3-5-haiku/i,
    specs: { contextLength: 200000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /claude-3-(opus|sonnet|haiku)/i,
    specs: { contextLength: 200000, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },
  {
    pattern: /claude-2/i,
    specs: { contextLength: 100000, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },

  // --- Google Gemini Models ---
  {
    pattern: /gemini-2\.5-(pro|flash)/i,
    specs: { contextLength: 1048576, maxOutputTokens: 65536, defaultOutputTokens: 8192 },
  },
  {
    pattern: /gemini-2\.0-pro/i,
    specs: { contextLength: 2097152, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gemini-2\.0-(flash|flash-thinking)/i,
    specs: { contextLength: 1048576, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gemini-1\.5-pro/i,
    specs: { contextLength: 2097152, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /gemini-1\.5-flash/i,
    specs: { contextLength: 1048576, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },

  // --- DeepSeek Models ---
  {
    pattern: /deepseek-(reasoner|r1)/i,
    specs: { contextLength: 64000, maxOutputTokens: 8192, defaultOutputTokens: 4096, isReasoning: true },
  },
  {
    pattern: /deepseek-(chat|v3|coder)/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },

  // --- Meta Llama Models ---
  {
    pattern: /llama-?3\.3/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /llama-?3\.2/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /llama-?3\.1/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /llama-?3/i,
    specs: { contextLength: 8192, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },
  {
    pattern: /llama-?2/i,
    specs: { contextLength: 4096, maxOutputTokens: 4096, defaultOutputTokens: 2048 },
  },
  {
    pattern: /codellama/i,
    specs: { contextLength: 16384, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },

  // --- Mistral / Mixtral ---
  {
    pattern: /mistral-(large|nemo)/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /mixtral-8x22b/i,
    specs: { contextLength: 65536, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /mixtral-8x7b/i,
    specs: { contextLength: 32768, maxOutputTokens: 4096, defaultOutputTokens: 4096 },
  },
  {
    pattern: /(mistral-small|codestral)/i,
    specs: { contextLength: 32768, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },

  // --- Qwen ---
  {
    pattern: /qwen-2\.5(-coder)?/i,
    specs: { contextLength: 128000, maxOutputTokens: 8192, defaultOutputTokens: 4096 },
  },
  {
    pattern: /qwq/i,
    specs: { contextLength: 32768, maxOutputTokens: 8192, defaultOutputTokens: 4096, isReasoning: true },
  },
];

const DEFAULT_FALLBACK_SPECS: ModelLimitSpecs = {
  contextLength: 128000,
  maxOutputTokens: 4096,
  defaultOutputTokens: 4096,
};

/**
 * Resolves context length and max output token capabilities for any model ID,
 * combining any API-reported metadata with built-in model intelligence.
 */
export function resolveModelLimits(
  modelId: string,
  apiMetadata?: {
    contextLength?: number;
    maxOutputTokens?: number;
    defaultOutputTokens?: number;
  }
): ModelLimitSpecs {
  if (!modelId) return { ...DEFAULT_FALLBACK_SPECS };

  // 1. Look for matching rule in catalog
  let matchedRuleSpecs: ModelLimitSpecs | undefined;
  for (const rule of MODEL_RULES) {
    if (rule.pattern.test(modelId)) {
      matchedRuleSpecs = rule.specs;
      break;
    }
  }

  const baseline = matchedRuleSpecs || DEFAULT_FALLBACK_SPECS;

  // 2. Override with API-provided metadata if available and valid (> 0)
  const contextLength =
    typeof apiMetadata?.contextLength === 'number' && apiMetadata.contextLength > 0
      ? apiMetadata.contextLength
      : baseline.contextLength;

  const maxOutputTokens =
    typeof apiMetadata?.maxOutputTokens === 'number' && apiMetadata.maxOutputTokens > 0
      ? apiMetadata.maxOutputTokens
      : baseline.maxOutputTokens;

  const defaultOutputTokens =
    typeof apiMetadata?.defaultOutputTokens === 'number' && apiMetadata.defaultOutputTokens > 0
      ? apiMetadata.defaultOutputTokens
      : Math.min(baseline.defaultOutputTokens, maxOutputTokens);

  return {
    contextLength,
    maxOutputTokens,
    defaultOutputTokens,
    isReasoning: baseline.isReasoning,
  };
}

/**
 * Computes dynamic quick-select token stops that adapt to the model's max output ceiling.
 * For example:
 * - 4,096 max -> [1024, 2048, 4096]
 * - 8,192 max -> [1024, 2048, 4096, 8192]
 * - 16,384 max -> [2048, 4096, 8192, 16384]
 * - 65,536 max -> [4096, 8192, 16384, 32768, 65536]
 */
export function getModelQuickTokenStops(maxOutputTokens: number): number[] {
  const candidateStops = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 100000, 131072];
  const max = Math.max(128, maxOutputTokens || 4096);

  // Filter stops that are <= max
  let stops = candidateStops.filter((s) => s <= max);

  // If list is too long (> 5), keep the most relevant 4 or 5
  if (stops.length > 5) {
    stops = stops.slice(stops.length - 5);
  }

  // Ensure the max itself is accessible if not already included
  if (max > 1024 && !stops.includes(max)) {
    stops.push(max);
  }

  if (stops.length === 0) {
    stops = [max];
  }

  return stops.sort((a, b) => a - b);
}

/**
 * Clamps requested tokens to valid boundaries for the given model limit.
 */
export function clampOutputTokens(requested: number | undefined, maxOutputTokens: number): number {
  const max = Math.max(128, maxOutputTokens || 4096);
  if (requested === undefined || requested === null || isNaN(requested) || requested <= 0) {
    return Math.min(4096, max);
  }
  return Math.min(Math.max(128, Math.round(requested)), max);
}

/**
 * Format a token number compactly for badges and button labels:
 * e.g., 128000 -> "128K", 1048576 -> "1M", 4096 -> "4K", 800 -> "800"
 */
export function formatTokensCompact(tokens?: number): string {
  if (!tokens || isNaN(tokens)) return '4K';
  if (tokens >= 1000000) {
    const val = tokens / 1000000;
    const rounded = Math.round(val * 10) / 10;
    return rounded % 1 === 0 ? `${rounded.toFixed(0)}M` : `${rounded.toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    const val = tokens / 1000;
    return `${Math.round(val)}K`;
  }
  return `${tokens}`;
}

/**
 * Detects whether a finish reason or completion status indicates that
 * the maximum output tokens limit was hit.
 */
export function isMaxTokensHit(finishReason?: string): boolean {
  if (!finishReason) return false;
  const normalized = finishReason.toLowerCase().replace(/[-_]/g, ' ').trim();
  return (
    normalized === 'length' ||
    normalized === 'max tokens' ||
    normalized === 'max output tokens' ||
    normalized === 'token limit' ||
    normalized === 'model length' ||
    normalized.includes('max token') ||
    normalized.includes('length')
  );
}
