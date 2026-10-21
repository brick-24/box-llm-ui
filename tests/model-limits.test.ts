import { describe, it, expect } from 'vitest';
import {
  resolveModelLimits,
  getModelQuickTokenStops,
  clampOutputTokens,
  formatTokensCompact,
  isMaxTokensHit,
} from '../src/shared/model-limits';

describe('Model Token Limits & Resolution', () => {
  it('resolves correct context and max output limits for OpenAI models', () => {
    const gpt4o = resolveModelLimits('gpt-4o');
    expect(gpt4o.contextLength).toBe(128000);
    expect(gpt4o.maxOutputTokens).toBe(16384);
    expect(gpt4o.defaultOutputTokens).toBe(4096);
    expect(gpt4o.isReasoning).toBeFalsy();

    const gpt4oMini = resolveModelLimits('gpt-4o-mini-2024-07-18');
    expect(gpt4oMini.contextLength).toBe(128000);
    expect(gpt4oMini.maxOutputTokens).toBe(16384);

    const legacyGpt4 = resolveModelLimits('gpt-4-0613');
    expect(legacyGpt4.contextLength).toBe(8192);
    expect(legacyGpt4.maxOutputTokens).toBe(4096);
  });

  it('resolves reasoning models with reasoning flag and completion caps', () => {
    const o3Mini = resolveModelLimits('o3-mini');
    expect(o3Mini.isReasoning).toBe(true);
    expect(o3Mini.contextLength).toBe(200000);
    expect(o3Mini.maxOutputTokens).toBe(100000);

    const o1Mini = resolveModelLimits('o1-mini');
    expect(o1Mini.isReasoning).toBe(true);
    expect(o1Mini.maxOutputTokens).toBe(65536);
  });

  it('resolves correct limits for Anthropic Claude models', () => {
    const sonnet35 = resolveModelLimits('anthropic/claude-3-5-sonnet');
    expect(sonnet35.contextLength).toBe(200000);
    expect(sonnet35.maxOutputTokens).toBe(8192);

    const sonnet37 = resolveModelLimits('claude-3-7-sonnet-20250219');
    expect(sonnet37.contextLength).toBe(200000);
    expect(sonnet37.maxOutputTokens).toBe(64000);

    const opus3 = resolveModelLimits('claude-3-opus');
    expect(opus3.maxOutputTokens).toBe(4096);
  });

  it('resolves correct limits for Google Gemini and DeepSeek models', () => {
    const geminiFlash = resolveModelLimits('google/gemini-2.5-flash');
    expect(geminiFlash.contextLength).toBe(1048576);
    expect(geminiFlash.maxOutputTokens).toBe(65536);

    const deepseekChat = resolveModelLimits('deepseek-chat');
    expect(deepseekChat.contextLength).toBe(128000);
    expect(deepseekChat.maxOutputTokens).toBe(8192);

    const deepseekR1 = resolveModelLimits('deepseek-reasoner');
    expect(deepseekR1.isReasoning).toBe(true);
    expect(deepseekR1.maxOutputTokens).toBe(8192);
  });

  it('resolves correct limits for Meta Llama and local models', () => {
    const llama33 = resolveModelLimits('meta-llama/llama-3.3-70b-instruct');
    expect(llama33.contextLength).toBe(128000);
    expect(llama33.maxOutputTokens).toBe(8192);

    const llama3 = resolveModelLimits('llama3:latest');
    expect(llama3.contextLength).toBe(8192);
    expect(llama3.maxOutputTokens).toBe(4096);
  });

  it('prioritizes explicit API-provided metadata when present', () => {
    const customWithApiSpecs = resolveModelLimits('custom-proxy-model', {
      contextLength: 65536,
      maxOutputTokens: 12288,
      defaultOutputTokens: 2048,
    });
    expect(customWithApiSpecs.contextLength).toBe(65536);
    expect(customWithApiSpecs.maxOutputTokens).toBe(12288);
    expect(customWithApiSpecs.defaultOutputTokens).toBe(2048);
  });

  it('generates dynamic quick-select token stops bounded by model max', () => {
    const stops8k = getModelQuickTokenStops(8192);
    expect(stops8k[stops8k.length - 1]).toBe(8192);
    expect(stops8k.every((s) => s <= 8192)).toBe(true);
    expect(stops8k).toContain(4096);

    const stops16k = getModelQuickTokenStops(16384);
    expect(stops16k[stops16k.length - 1]).toBe(16384);
    expect(stops16k.every((s) => s <= 16384)).toBe(true);

    const stops4k = getModelQuickTokenStops(4096);
    expect(stops4k[stops4k.length - 1]).toBe(4096);
    expect(stops4k.every((s) => s <= 4096)).toBe(true);
  });

  it('clamps output tokens safely to prevent provider 400 Bad Request errors', () => {
    // Exceeding ceiling is clamped down to max
    expect(clampOutputTokens(32768, 8192)).toBe(8192);
    expect(clampOutputTokens(1048576, 16384)).toBe(16384);

    // Within bounds is preserved
    expect(clampOutputTokens(2048, 8192)).toBe(2048);

    // Below min is clamped up to 128
    expect(clampOutputTokens(50, 8192)).toBe(128);

    // Undefined falls back to safe default
    expect(clampOutputTokens(undefined, 8192)).toBe(4096);
    expect(clampOutputTokens(undefined, 2048)).toBe(2048);
  });

  it('formats compact token labels accurately', () => {
    expect(formatTokensCompact(128000)).toBe('128K');
    expect(formatTokensCompact(200000)).toBe('200K');
    expect(formatTokensCompact(1048576)).toBe('1M');
    expect(formatTokensCompact(2097152)).toBe('2.1M');
    expect(formatTokensCompact(4096)).toBe('4K');
    expect(formatTokensCompact(8192)).toBe('8K');
    expect(formatTokensCompact(500)).toBe('500');
  });

  it('accurately identifies when maximum tokens limit has been reached from provider finish reasons', () => {
    // OpenAI / OpenRouter / Mistral / DeepSeek style
    expect(isMaxTokensHit('length')).toBe(true);
    expect(isMaxTokensHit('LENGTH')).toBe(true);

    // Anthropic / Claude style
    expect(isMaxTokensHit('max_tokens')).toBe(true);
    expect(isMaxTokensHit('max-tokens')).toBe(true);

    // Google Gemini style
    expect(isMaxTokensHit('MAX_TOKENS')).toBe(true);

    // OpenAI Responses / alternative formats
    expect(isMaxTokensHit('max_output_tokens')).toBe(true);
    expect(isMaxTokensHit('token_limit')).toBe(true);
    expect(isMaxTokensHit('model_length')).toBe(true);

    // Natural stops or user actions should NOT be flagged as max tokens hit
    expect(isMaxTokensHit('stop')).toBe(false);
    expect(isMaxTokensHit('end_turn')).toBe(false);
    expect(isMaxTokensHit('cancelled')).toBe(false);
    expect(isMaxTokensHit('tool_calls')).toBe(false);
    expect(isMaxTokensHit('content_filter')).toBe(false);
    expect(isMaxTokensHit(undefined)).toBe(false);
    expect(isMaxTokensHit('')).toBe(false);
  });
});
