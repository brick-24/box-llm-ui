import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import { AppDatabase } from '../storage/database';
import { CredentialManager } from '../storage/credentials';
import { AdapterFactory } from '../providers/adapter-factory';
import { DiagnosticsService } from './diagnostics';
import {
  ChatMessage,
  ProviderConfig,
  MessageAttachment,
  TokenUsage,
} from '../../shared/types';
import { OPENROUTER_CONVERSATIONAL_FREE_MODELS } from '../../shared/model-limits';

export function isSafetyClassifierVerdict(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length > 250) return false;
  return /^User Safety:\s*(safe|unsafe)[\s\S]*Response Safety:\s*(safe|unsafe)/i.test(trimmed);
}

export interface SendMessageOptions {
  conversationId: string;
  content: string;
  attachments?: MessageAttachment[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  providerId?: string;
  modelId?: string;
  messageId?: string;
  userMessageId?: string;
}

export class ChatEngine {
  private activeControllers = new Map<string, AbortController>();

  constructor(
    private db: AppDatabase,
    private creds: CredentialManager,
    private getMainWindow: () => BrowserWindow | null
  ) {}

  public static generateTitleHeuristic(userText: string): string {
    if (!userText || !userText.trim()) return 'New Conversation';
    const firstLine = userText.trim().split('\n')[0].trim();
    // Remove special prompt symbols
    const cleaned = firstLine.replace(/^[#>*`\s-]+/, '');
    if (cleaned.length <= 40) return cleaned;
    const truncated = cleaned.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 20 ? `${truncated.slice(0, lastSpace)}...` : `${truncated}...`;
  }

  public stopGeneration(conversationId: string): boolean {
    const controller = this.activeControllers.get(conversationId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(conversationId);
      DiagnosticsService.log('info', 'stream', `Generation stopped by user for conversation ${conversationId}`);
      return true;
    }
    return false;
  }

  public async executeChat(options: SendMessageOptions): Promise<{
    assistantMsgId: string;
    fullText: string;
    status: string;
    errorMessage?: string;
  }> {
    const { conversationId, content, attachments } = options;
    const win = this.getMainWindow();

    const conv = this.db.getConversation(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Auto-update conversation title if it is default
    if (conv.title === 'New Conversation' || !conv.title) {
      const newTitle = ChatEngine.generateTitleHeuristic(content);
      this.db.updateConversation({ id: conversationId, title: newTitle });
    }

    // 1. Resolve Provider
    const providerId = options.providerId || conv.providerId;
    const providers = this.db.getProviders();
    const rawConfig = providers.find((p) => p.id === providerId) || providers[0];
    if (!rawConfig) {
      const errMsg = 'No AI provider configured. Please open Settings -> Providers and configure an API endpoint.';
      DiagnosticsService.log('error', 'api', errMsg);
      if (win) {
        win.webContents.send('chat:stream-error', {
          conversationId,
          messageId: 'err',
          error: errMsg,
        });
      }
      throw new Error(errMsg);
    }

    // Decrypt API key
    const config: ProviderConfig = {
      ...rawConfig,
      apiKey: this.creds.decrypt(rawConfig.apiKey),
    };

    let currentModel = options.modelId || conv.modelId || config.defaultModel;
    if (!currentModel) {
      const errMsg = 'No model selected. Please select a model or enter a model ID.';
      DiagnosticsService.log('error', 'api', errMsg);
      if (win) {
        win.webContents.send('chat:stream-error', {
          conversationId,
          messageId: 'err',
          error: errMsg,
        });
      }
      throw new Error(errMsg);
    }

    // 2. Persist User Message
    const userMsgId = options.userMessageId || crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: userMsgId,
      conversationId,
      role: 'user',
      content,
      attachments,
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.db.saveMessage(userMsg);

    // 3. Prepare Assistant Message Placeholder
    const assistantMsgId = options.messageId || crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.db.saveMessage(assistantMsg);

    // 4. Setup AbortController
    const controller = new AbortController();
    this.activeControllers.set(conversationId, controller);

    // Retrieve conversation history
    const allMessages = this.db.getMessages(conversationId);
    // Exclude the currently streaming assistant message
    const history = allMessages.filter((m) => m.id !== assistantMsgId);

    const adapter = AdapterFactory.getAdapter(config.protocol);
    const startTime = Date.now();

    const maxRetries = config.maxRetries ?? 2;
    let attempt = 0;
    let success = false;
    let lastError: any = null;
    let finalFullText = '';
    let finalStatus = 'completed';

    while (attempt <= maxRetries && !success) {
      if (controller.signal.aborted) break;

      DiagnosticsService.log('info', 'api', `Initiating request to ${config.name} (${currentModel}) [attempt ${attempt + 1}/${maxRetries + 1}]`, {
        endpoint: config.chatEndpoint,
        protocol: config.protocol,
        model: currentModel,
        messageCount: history.length,
        streaming: config.streamingEnabled,
        messagesPreview: history.slice(-3).map((m) => ({
          role: m.role,
          content: m.content.length > 300 ? `${m.content.slice(0, 300)}...` : m.content,
        })),
      });

      try {
        if (config.streamingEnabled) {
          await adapter.streamMessage(
            config,
            {
              messages: history,
              model: currentModel,
              systemPrompt: options.systemPrompt || conv.systemPrompt,
              temperature: options.temperature ?? conv.temperature,
              maxTokens: options.maxTokens ?? conv.maxTokens,
              topP: options.topP ?? conv.topP,
            },
            {
              onChunk: (delta, fullText) => {
                if (win && !controller.signal.aborted) {
                  win.webContents.send('chat:stream-chunk', {
                    conversationId,
                    messageId: assistantMsgId,
                    delta,
                    fullText,
                  });
                }
              },
              onEnd: (fullText, tokenUsage, finishReason) => {
                const latencyMs = Date.now() - startTime;
                const status = finishReason === 'cancelled' ? 'stopped' : 'completed';
                finalFullText = fullText;
                finalStatus = status;

                this.db.updateMessage(assistantMsgId, {
                  content: fullText,
                  status,
                  tokenUsage,
                  latencyMs,
                  updatedAt: Date.now(),
                });

                if (win) {
                  win.webContents.send('chat:stream-end', {
                    conversationId,
                    messageId: assistantMsgId,
                    fullText,
                    tokenUsage,
                    latencyMs,
                    finishReason,
                  });
                }

                DiagnosticsService.log('info', 'api', `Response complete (${latencyMs}ms)`, {
                  model: currentModel,
                  finishReason,
                  tokenUsage,
                  textLength: fullText.length,
                  responsePreview: fullText.length > 1000 ? `${fullText.slice(0, 1000)}...` : fullText,
                });
              },
              onError: (err) => {
                throw err;
              },
            },
            controller.signal
          );
        } else {
          // Non-streaming fallback
          const resp = await adapter.sendMessage(
            config,
            {
              messages: history,
              model: currentModel,
              systemPrompt: options.systemPrompt || conv.systemPrompt,
              temperature: options.temperature ?? conv.temperature,
              maxTokens: options.maxTokens ?? conv.maxTokens,
              topP: options.topP ?? conv.topP,
            },
            controller.signal
          );

          const latencyMs = Date.now() - startTime;
          finalFullText = resp.content;
          finalStatus = 'completed';

          this.db.updateMessage(assistantMsgId, {
            content: resp.content,
            status: 'completed',
            tokenUsage: resp.tokenUsage,
            latencyMs,
            updatedAt: Date.now(),
          });

          if (win) {
            win.webContents.send('chat:stream-chunk', {
              conversationId,
              messageId: assistantMsgId,
              delta: resp.content,
              fullText: resp.content,
            });
            win.webContents.send('chat:stream-end', {
              conversationId,
              messageId: assistantMsgId,
              fullText: resp.content,
              tokenUsage: resp.tokenUsage,
              latencyMs,
              finishReason: 'stop',
            });
          }

          DiagnosticsService.log('info', 'api', `Response complete (${latencyMs}ms)`, {
            model: currentModel,
            finishReason: 'stop',
            tokenUsage: resp.tokenUsage,
            textLength: resp.content.length,
            responsePreview: resp.content.length > 1000 ? `${resp.content.slice(0, 1000)}...` : resp.content,
          });
        }

        // Check if the upstream provider misrouted to a safety evaluation classifier
        if (isSafetyClassifierVerdict(finalFullText)) {
          DiagnosticsService.log(
            'warn',
            'api',
            `Detected upstream content-safety classifier verdict ("${finalFullText.trim()}") instead of assistant response. Re-routing request to fallback conversational model...`,
            {
              verdict: finalFullText.trim(),
              previousModel: currentModel,
              attempt: attempt + 1,
            }
          );

          if (attempt < maxRetries) {
            attempt++;
            const freeModels = OPENROUTER_CONVERSATIONAL_FREE_MODELS.filter((m) => m !== currentModel);
            currentModel = freeModels[(attempt - 1) % freeModels.length] || 'google/gemma-4-31b-it:free';

            if (win && !controller.signal.aborted) {
              win.webContents.send('chat:stream-chunk', {
                conversationId,
                messageId: assistantMsgId,
                delta: '',
                fullText: '',
              });
            }
            continue;
          }
        }

        success = true;
      } catch (err: any) {
        lastError = err;
        const isAbort = controller.signal.aborted || err.name === 'AbortError';
        if (isAbort) {
          break;
        }

        const errMsg = err.message || String(err);
        const isNonRetryable =
          errMsg.includes('401') ||
          errMsg.includes('403') ||
          errMsg.includes('404') ||
          errMsg.includes('Invalid API Key');

        if (isNonRetryable || attempt >= maxRetries) {
          break;
        }

        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        DiagnosticsService.log('warn', 'api', `Transient failure (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms: ${errMsg}`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    this.activeControllers.delete(conversationId);

    if (!success && !controller.signal.aborted) {
      const errorMsg = lastError?.message || 'Unknown network or API error occurred';
      this.db.updateMessage(assistantMsgId, {
        status: 'error',
        errorMessage: errorMsg,
        updatedAt: Date.now(),
      });

      DiagnosticsService.log('error', 'api', `Chat execution failed: ${errorMsg}`, {
        error: errorMsg,
        attempts: attempt,
      });

      if (win) {
        win.webContents.send('chat:stream-error', {
          conversationId,
          messageId: assistantMsgId,
          error: errorMsg,
        });
      }
    }

    return {
      assistantMsgId,
      fullText: finalFullText,
      status: success ? finalStatus : 'error',
      errorMessage: success ? undefined : (lastError?.message || 'Chat execution failed'),
    };
  }
}
