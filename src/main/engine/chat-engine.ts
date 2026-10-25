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
  ToolCallItem,
  WebCitation,
} from '../../shared/types';
import { OPENROUTER_CONVERSATIONAL_FREE_MODELS } from '../../shared/model-limits';
import { WEB_TOOLS, executeWebTool } from '../browser/web-tools';
import { WorkspaceTools } from './tools/workspace-tools';
import { WorkspaceProcessManager } from './tools/process-manager';
import { CODING_TOOLS, buildCodingSystemPrompt, buildGeneralSystemPrompt } from './tools/coding-tool-definitions';

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
  parentId?: string | null;
  isRegeneration?: boolean;
  webBrowsing?: boolean;
  workspacePath?: string;
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

  public static resolveBranchHistory(
    allMessages: ChatMessage[],
    targetMessageId: string
  ): ChatMessage[] {
    const messageMap = new Map<string, ChatMessage>(allMessages.map((m) => [m.id, m]));
    let currId: string | null = targetMessageId;
    const branchChain: ChatMessage[] = [];
    const visited = new Set<string>();

    while (currId && messageMap.has(currId) && !visited.has(currId)) {
      visited.add(currId);
      const msg: ChatMessage = messageMap.get(currId)!;
      branchChain.push(msg);
      currId = msg.parentId || null;
    }

    if (branchChain.length > 0) {
      return branchChain.reverse();
    }
    return allMessages;
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

    // 1. Resolve Provider and Model
    const providerId = options.providerId || conv.providerId;
    const providers = this.db.getProviders();
    let rawConfig = providers.find((p) => p.id === providerId) || providers[0];
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

    let currentModel = options.modelId || conv.modelId || rawConfig.defaultModel;

    // Intelligent auto-recovery for provider/model mismatch (e.g. conversation stuck on Ollama while user chose a Gemini or OpenAI model)
    if (
      rawConfig &&
      currentModel &&
      (rawConfig.baseUrl.includes('localhost') || rawConfig.name.toLowerCase().includes('ollama'))
    ) {
      const lowerModel = currentModel.toLowerCase();
      if (lowerModel.startsWith('gemini-') || lowerModel.startsWith('google/')) {
        const geminiProv = providers.find(
          (p) => p.name.toLowerCase().includes('gemini') || p.baseUrl.includes('generativelanguage.googleapis.com')
        );
        if (geminiProv) {
          DiagnosticsService.log(
            'warn',
            'api',
            `Model '${currentModel}' is a Google Gemini model, but active provider was '${rawConfig.name}'. Auto-routing to '${geminiProv.name}'.`
          );
          rawConfig = geminiProv;
          this.db.updateConversation({ id: conversationId, providerId: geminiProv.id, modelId: currentModel });
        }
      } else if (lowerModel.startsWith('gpt-') || lowerModel.startsWith('o1') || lowerModel.startsWith('o3')) {
        const openaiProv = providers.find(
          (p) => p.name.toLowerCase().includes('openai') && !p.baseUrl.includes('localhost')
        );
        if (openaiProv) {
          DiagnosticsService.log(
            'warn',
            'api',
            `Model '${currentModel}' is an OpenAI model, but active provider was '${rawConfig.name}'. Auto-routing to '${openaiProv.name}'.`
          );
          rawConfig = openaiProv;
          this.db.updateConversation({ id: conversationId, providerId: openaiProv.id, modelId: currentModel });
        }
      }
    }

    // Decrypt API key
    const config: ProviderConfig = {
      ...rawConfig,
      apiKey: this.creds.decrypt(rawConfig.apiKey),
    };

    if (!currentModel) {
      currentModel = config.defaultModel;
    }

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

    // Guard against unconfigured API keys for remote cloud providers
    if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
      const errMsg = `API Key required for '${config.name}'. Please open Settings -> Providers and enter your API key.`;
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

    // 2. Persist User Message (if not regenerating existing assistant turn)
    const userMsgId = options.userMessageId || crypto.randomUUID();
    let effectiveUserMsgId = userMsgId;

    if (!options.isRegeneration) {
      const userMsg: ChatMessage = {
        id: userMsgId,
        conversationId,
        parentId: options.parentId !== undefined ? options.parentId : null,
        role: 'user',
        content,
        attachments,
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.db.saveMessage(userMsg);
    } else {
      effectiveUserMsgId = options.userMessageId || (options.parentId ?? '');
    }

    // 3. Prepare Assistant Message Placeholder
    const assistantMsgId = options.messageId || crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      conversationId,
      parentId: effectiveUserMsgId || (options.parentId ?? null),
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

    // Retrieve conversation history and resolve tree branch ancestor chain
    const allMessages = this.db.getMessages(conversationId);
    const history = ChatEngine.resolveBranchHistory(allMessages, effectiveUserMsgId);

    const isWebBrowsing = options.webBrowsing !== undefined
      ? options.webBrowsing
      : Boolean(conv.webBrowsingEnabled);

    const effectiveWorkspacePath = options.workspacePath || conv.workspacePath;
    const hasWorkspace = Boolean(effectiveWorkspacePath && effectiveWorkspacePath.trim());

    const activeTools = [
      ...(hasWorkspace ? CODING_TOOLS : []),
      ...(isWebBrowsing ? WEB_TOOLS : []),
    ];
    const hasActiveTools = activeTools.length > 0;

    const baseSystemPrompt = options.systemPrompt || conv.systemPrompt;
    const effectiveSystemPrompt = hasWorkspace
      ? buildCodingSystemPrompt(effectiveWorkspacePath!, baseSystemPrompt)
      : buildGeneralSystemPrompt(baseSystemPrompt);

    const executedToolCalls: ToolCallItem[] = [];
    const accumulatedCitations: WebCitation[] = [];
    const settings = this.db.getSettings();

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

      const trajectory: ChatMessage[] = [...history];
      const maxTurns = hasWorkspace
        ? (settings.maxAgentTurns || 20)
        : (isWebBrowsing ? 6 : 1);
      let turnIndex = 0;

      DiagnosticsService.log('info', 'api', `Initiating request to ${config.name} (${currentModel}) [attempt ${attempt + 1}/${maxRetries + 1}] (web: ${isWebBrowsing}, workspace: ${hasWorkspace})`, {
        endpoint: config.chatEndpoint,
        protocol: config.protocol,
        model: currentModel,
        messageCount: trajectory.length,
        streaming: config.streamingEnabled,
        webBrowsing: isWebBrowsing,
        workspace: effectiveWorkspacePath,
        messagesPreview: trajectory.slice(-3).map((m) => ({
          role: m.role,
          content: m.content.length > 300 ? `${m.content.slice(0, 300)}...` : m.content,
        })),
      });

      try {
        while (turnIndex < maxTurns && !controller.signal.aborted) {
          turnIndex++;
          let turnToolCalls: any[] | undefined;
          let turnFullText = '';
          let turnUsage: TokenUsage | undefined;
          let turnFinishReason: string | undefined;
          let turnReasoning: string | undefined;
          let turnThinkingDuration: number | undefined;

          if (config.streamingEnabled) {
            await adapter.streamMessage(
              config,
              {
                messages: trajectory,
                model: currentModel,
                systemPrompt: effectiveSystemPrompt,
                temperature: options.temperature ?? conv.temperature,
                maxTokens: options.maxTokens ?? conv.maxTokens,
                topP: options.topP ?? conv.topP,
                tools: hasActiveTools ? activeTools : undefined,
              },
              {
                onChunk: (delta, fullText, reasoningDelta, reasoningFullText) => {
                  if (win && !controller.signal.aborted) {
                    win.webContents.send('chat:stream-chunk', {
                      conversationId,
                      messageId: assistantMsgId,
                      delta,
                      fullText,
                      reasoningDelta,
                      reasoningFullText,
                    });
                  }
                },
                onEnd: (fullText, tokenUsage, finishReason, reasoningFullText, thinkingDurationMs, toolCalls) => {
                  turnFullText = fullText;
                  turnUsage = tokenUsage;
                  turnFinishReason = finishReason;
                  turnReasoning = reasoningFullText;
                  turnThinkingDuration = thinkingDurationMs;
                  turnToolCalls = toolCalls;
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
                messages: trajectory,
                model: currentModel,
                systemPrompt: effectiveSystemPrompt,
                temperature: options.temperature ?? conv.temperature,
                maxTokens: options.maxTokens ?? conv.maxTokens,
                topP: options.topP ?? conv.topP,
                tools: hasActiveTools ? activeTools : undefined,
              },
              controller.signal
            );

            turnFullText = resp.content;
            turnUsage = resp.tokenUsage;
            turnFinishReason = resp.finishReason || 'stop';
            turnReasoning = resp.reasoningContent;
            turnToolCalls = resp.toolCalls;

            if (win && !controller.signal.aborted) {
              win.webContents.send('chat:stream-chunk', {
                conversationId,
                messageId: assistantMsgId,
                delta: resp.content,
                fullText: resp.content,
                reasoningDelta: resp.reasoningContent,
                reasoningFullText: resp.reasoningContent,
              });
            }
          }

          if (controller.signal.aborted) break;

          // Check if tools were requested
          if (hasActiveTools && turnToolCalls && turnToolCalls.length > 0 && turnIndex < maxTurns) {
            const currentTurnItems: ToolCallItem[] = [];

            for (const tc of turnToolCalls) {
              let parsedInput: Record<string, any> = {};
              try {
                parsedInput = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments || {};
              } catch {
                parsedInput = { raw: tc.arguments };
              }

              const item: ToolCallItem = {
                id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                name: tc.name,
                input: parsedInput,
                status: 'running',
                thoughtSignature: tc.thoughtSignature,
                extraContent: tc.extraContent,
              };
              currentTurnItems.push(item);
              executedToolCalls.push(item);

              if (win) {
                win.webContents.send('chat:tool-call-update', {
                  conversationId,
                  messageId: assistantMsgId,
                  toolCall: item,
                });
              }

              // Normalize tool name (handles cases like default_api:list_dir or tools:run_command)
              const normalizedName = item.name.replace(/^(default_api|tools):/, '');

              // Execute tool
              const toolStart = Date.now();
              try {
                if (
                  [
                    'write_to_file',
                    'view_file',
                    'replace_file_content',
                    'list_dir',
                    'run_command',
                    'grep_search',
                  ].includes(normalizedName)
                ) {
                  if (!effectiveWorkspacePath) {
                    throw new Error(
                      `Workspace tool "${item.name}" invoked but no workspace folder is set for this conversation.`
                    );
                  }

                  switch (normalizedName) {
                    case 'write_to_file': {
                      const res = WorkspaceTools.writeToFile(
                        effectiveWorkspacePath,
                        item.input?.filePath || '',
                        item.input?.content || '',
                        item.input?.overwrite !== false
                      );
                      item.output = {
                        success: true,
                        filePath: res.filePath,
                        bytesWritten: res.bytesWritten,
                        isNew: res.isNew,
                      };
                      break;
                    }
                    case 'view_file': {
                      const res = WorkspaceTools.viewFile(
                        effectiveWorkspacePath,
                        item.input?.filePath || '',
                        item.input?.startLine,
                        item.input?.endLine
                      );
                      item.output = res;
                      break;
                    }
                    case 'replace_file_content': {
                      const res = WorkspaceTools.replaceFileContent(
                        effectiveWorkspacePath,
                        item.input?.filePath || '',
                        item.input?.targetContent || '',
                        item.input?.replacementContent || ''
                      );
                      item.output = res;
                      break;
                    }
                    case 'list_dir': {
                      const res = WorkspaceTools.listDir(
                        effectiveWorkspacePath,
                        item.input?.dirPath || '',
                        item.input?.maxDepth || 3
                      );
                      item.output = {
                        summary: res.summary,
                        totalFiles: res.totalFiles,
                        totalDirs: res.totalDirs,
                      };
                      break;
                    }
                    case 'run_command': {
                      if (item.input?.isDaemon) {
                        const procMgr = WorkspaceProcessManager.getInstance();
                        const procItem = await procMgr.startProcess({
                          workspacePath: effectiveWorkspacePath,
                          command: item.input?.command || '',
                          name: item.input?.command ? item.input.command.split(' ')[0] : 'background-process',
                          waitMsBeforeAsync: item.input?.waitMsBeforeAsync || 2000,
                        });
                        item.output = {
                          isDaemon: true,
                          processId: procItem.id,
                          pid: procItem.pid,
                          status: procItem.status,
                          message: `Process started in background (ID: ${procItem.id}, PID: ${procItem.pid}). Real-time logs are streaming to the workspace process manager. You can manage this process using manage_process.`,
                          initialLogs: procItem.logs.slice(-20),
                        };
                        break;
                      }

                      let streamingAcc = '';
                      const timeoutMs =
                        item.input?.timeoutMs ||
                        (settings.commandTimeoutSec ? settings.commandTimeoutSec * 1000 : 60000);
                      const res = await WorkspaceTools.runCommand(
                        effectiveWorkspacePath,
                        item.input?.command || '',
                        {
                          timeoutMs,
                          signal: controller.signal,
                          onChunk: (chunk) => {
                            streamingAcc += chunk;
                            item.streamingOutput = streamingAcc;
                            if (win) {
                              win.webContents.send('chat:tool-command-output', {
                                conversationId,
                                messageId: assistantMsgId,
                                toolCallId: item.id,
                                chunk,
                                totalOutput: streamingAcc,
                              });
                            }
                          },
                        }
                      );
                      item.output = res;
                      break;
                    }
                    case 'manage_process': {
                      const procMgr = WorkspaceProcessManager.getInstance();
                      const action = item.input?.action;
                      const procId = item.input?.processId;

                      if (action === 'list') {
                        const list = procMgr.listProcesses(effectiveWorkspacePath);
                        item.output = {
                          total: list.length,
                          processes: list.map((p) => ({
                            id: p.id,
                            name: p.name,
                            command: p.command,
                            status: p.status,
                            pid: p.pid,
                            startedAt: p.startedAt,
                            exitCode: p.exitCode,
                          })),
                        };
                      } else if (action === 'status') {
                        if (!procId) {
                          item.output = { error: 'processId is required for status action.' };
                        } else {
                          const p = procMgr.getProcess(procId);
                          if (!p) {
                            item.output = { error: `Process ${procId} not found.` };
                          } else {
                            item.output = {
                              id: p.id,
                              name: p.name,
                              command: p.command,
                              status: p.status,
                              pid: p.pid,
                              startedAt: p.startedAt,
                              exitCode: p.exitCode,
                              lastLogs: p.logs.slice(-10),
                            };
                          }
                        }
                      } else if (action === 'logs') {
                        if (!procId) {
                          item.output = { error: 'processId is required for logs action.' };
                        } else {
                          const linesCount = item.input?.lines || 50;
                          const logs = procMgr.getProcessLogs(procId, linesCount);
                          item.output = { processId: procId, logsCount: logs.length, logs };
                        }
                      } else if (action === 'send_input') {
                        if (!procId) {
                          item.output = { error: 'processId is required for send_input action.' };
                        } else {
                          const ok = procMgr.sendInput(procId, item.input?.input || '');
                          item.output = {
                            success: ok,
                            message: ok
                              ? `Sent input to process ${procId}`
                              : `Failed to write input to process ${procId}`,
                          };
                        }
                      } else if (action === 'kill') {
                        if (!procId) {
                          item.output = { error: 'processId is required for kill action.' };
                        } else {
                          const ok = await procMgr.killProcess(procId);
                          item.output = {
                            success: ok,
                            message: ok
                              ? `Terminated process tree for ${procId}`
                              : `Failed to terminate process ${procId}`,
                          };
                        }
                      } else {
                        item.output = { error: `Unknown action: ${action}` };
                      }
                      break;
                    }
                    case 'grep_search': {
                      const res = WorkspaceTools.grepSearch(
                        effectiveWorkspacePath,
                        item.input?.query || '',
                        Boolean(item.input?.isRegex),
                        item.input?.includesPattern
                      );
                      item.output = res;
                      break;
                    }
                  }
                } else {
                  // Web tools
                  const output = await executeWebTool(normalizedName, item.input, settings);
                  item.output = output.result;
                  if (output.citations) {
                    accumulatedCitations.push(...output.citations);
                  }
                }

                item.durationMs = Date.now() - toolStart;
                item.status = 'completed';
              } catch (err: any) {
                item.durationMs = Date.now() - toolStart;
                item.status = 'error';
                item.error = err.message || String(err);
                item.output = { error: err.message || String(err) };
              }

              if (win) {
                win.webContents.send('chat:tool-call-update', {
                  conversationId,
                  messageId: assistantMsgId,
                  toolCall: item,
                });
              }
            }

            // Append assistant tool_calls message and tool responses to trajectory
            const turnSignature = currentTurnItems.find((it) => it.thoughtSignature)?.thoughtSignature;
            const turnExtra = currentTurnItems.find((it) => it.extraContent)?.extraContent;

            trajectory.push({
              id: crypto.randomUUID(),
              conversationId,
              role: 'assistant',
              content: turnFullText,
              toolCalls: currentTurnItems,
              thoughtSignature: turnSignature,
              extraContent: turnExtra,
              status: 'completed',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });

            for (const item of currentTurnItems) {
              trajectory.push({
                id: crypto.randomUUID(),
                conversationId,
                role: 'tool',
                name: item.name,
                toolCallId: item.id,
                content: typeof item.output === 'string' ? item.output : JSON.stringify(item.output),
                status: 'completed',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            }

            // Loop to next turn so model synthesizes final answer
            continue;
          }

          // Final response
          finalFullText = turnFullText;
          finalStatus = turnFinishReason === 'cancelled' ? 'stopped' : 'completed';

          // Deduplicate citations by URL
          const uniqueCitations: WebCitation[] = [];
          const seenUrls = new Set<string>();
          for (const c of accumulatedCitations) {
            if (c.url && !seenUrls.has(c.url)) {
              seenUrls.add(c.url);
              uniqueCitations.push(c);
            }
          }

          const latencyMs = Date.now() - startTime;
          this.db.updateMessage(assistantMsgId, {
            content: finalFullText,
            reasoningContent: turnReasoning,
            thinkingDurationMs: turnThinkingDuration,
            status: finalStatus as any,
            tokenUsage: turnUsage,
            latencyMs,
            finishReason: turnFinishReason,
            toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
            citations: uniqueCitations.length > 0 ? uniqueCitations : undefined,
            updatedAt: Date.now(),
          });

          if (win) {
            win.webContents.send('chat:stream-end', {
              conversationId,
              messageId: assistantMsgId,
              fullText: finalFullText,
              reasoningFullText: turnReasoning,
              thinkingDurationMs: turnThinkingDuration,
              tokenUsage: turnUsage,
              latencyMs,
              finishReason: turnFinishReason,
              toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
              citations: uniqueCitations.length > 0 ? uniqueCitations : undefined,
            });
          }

          DiagnosticsService.log('info', 'api', `Response complete (${latencyMs}ms)`, {
            model: currentModel,
            finishReason: turnFinishReason,
            tokenUsage: turnUsage,
            textLength: finalFullText.length,
            reasoningLength: turnReasoning?.length || 0,
            thinkingDurationMs: turnThinkingDuration,
            toolCallCount: executedToolCalls.length,
            citationCount: uniqueCitations.length,
            responsePreview: finalFullText.length > 1000 ? `${finalFullText.slice(0, 1000)}...` : finalFullText,
          });

          break; // Exit webTurn loop
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
