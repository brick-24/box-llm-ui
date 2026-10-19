import {
  ProviderConfig,
  ModelInfo,
  ChatMessage,
  TokenUsage,
  ConnectionTestResult,
} from '../../shared/types';

export interface ChatRequestParams {
  messages: ChatMessage[];
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface StreamCallbacks {
  onChunk: (delta: string, fullText: string, reasoningDelta?: string, reasoningFullText?: string) => void;
  onEnd: (fullText: string, usage?: TokenUsage, finishReason?: string, reasoningFullText?: string, thinkingDurationMs?: number) => void;
  onError: (err: Error) => void;
}

export interface IProviderAdapter {
  fetchModels(config: ProviderConfig): Promise<ModelInfo[]>;
  testConnection(config: ProviderConfig): Promise<ConnectionTestResult>;
  streamMessage(
    config: ProviderConfig,
    params: ChatRequestParams,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void>;
  sendMessage(
    config: ProviderConfig,
    params: ChatRequestParams,
    signal?: AbortSignal
  ): Promise<{ content: string; tokenUsage?: TokenUsage; reasoningContent?: string }>;
}

export function resolveEndpoint(baseUrl: string, endpoint: string): string {
  if (!endpoint) return baseUrl;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${cleanBase}/${cleanEndpoint}`;
}

export function buildAuthHeaders(
  config: ProviderConfig,
  forModelList = false
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };

  const authMethod = forModelList && config.modelListAuth && !config.modelListAuth.inherit
    ? config.modelListAuth.authMethod || config.authMethod
    : config.authMethod;

  const apiKey = forModelList && config.modelListAuth && !config.modelListAuth.inherit && config.modelListAuth.apiKey
    ? config.modelListAuth.apiKey
    : config.apiKey;

  if (apiKey) {
    if (authMethod === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    } else if (authMethod === 'api-key-header') {
      headers['api-key'] = apiKey.trim();
      headers['x-api-key'] = apiKey.trim();
    } else if (authMethod === 'basic') {
      headers['Authorization'] = `Basic ${Buffer.from(apiKey).toString('base64')}`;
    }
  }

  if (config.organizationId) {
    headers['OpenAI-Organization'] = config.organizationId.trim();
  }
  if (config.projectId) {
    headers['OpenAI-Project'] = config.projectId.trim();
  }
  if (config.tenantId) {
    headers['X-Tenant-ID'] = config.tenantId.trim();
  }
  if (config.apiVersion) {
    headers['api-version'] = config.apiVersion.trim();
  }

  // Merge custom headers
  if (config.customHeaders) {
    for (const [k, v] of Object.entries(config.customHeaders)) {
      if (k && v) headers[k] = v;
    }
  }

  if (forModelList && config.modelListAuth?.customHeaders) {
    for (const [k, v] of Object.entries(config.modelListAuth.customHeaders)) {
      if (k && v) headers[k] = v;
    }
  }

  return headers;
}

export function formatMessagesWithAttachments(
  messages: ChatMessage[],
  systemPrompt?: string,
  supportVision = true
): any[] {
  const formatted: any[] = [];

  if (systemPrompt && systemPrompt.trim()) {
    formatted.push({
      role: 'system',
      content: systemPrompt.trim(),
    });
  }

  for (const msg of messages) {
    let textContent = msg.content || '';
    const images: string[] = [];

    if (msg.attachments && msg.attachments.length > 0) {
      const docContextParts: string[] = [];

      for (const att of msg.attachments) {
        if (att.previewDataUrl && att.type.startsWith('image/')) {
          images.push(att.previewDataUrl);
        } else if (att.extractedText) {
          docContextParts.push(
            `\n\n[Attached Document: "${att.name}" (${att.type}, ${att.size} bytes${att.pageCount ? `, ${att.pageCount} pages` : ''})]\n--- Start Document Content ---\n${att.extractedText}\n--- End Document Content ---`
          );
        }
      }

      if (docContextParts.length > 0) {
        textContent = `${textContent}\n${docContextParts.join('\n')}`.trim();
      }
    }

    if (msg.role === 'user' && images.length > 0 && supportVision) {
      const parts: any[] = [{ type: 'text', text: textContent }];
      for (const imgUrl of images) {
        parts.push({
          type: 'image_url',
          image_url: { url: imgUrl },
        });
      }
      formatted.push({ role: msg.role, content: parts });
    } else {
      formatted.push({ role: msg.role, content: textContent });
    }
  }

  return formatted;
}
