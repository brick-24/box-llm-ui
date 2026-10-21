import React, { useState } from 'react';
import {
  User,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Layers,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ChatMessage } from '@shared/types';
import { isMaxTokensHit } from '@shared/model-limits';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AttachmentChip } from './AttachmentChip';
import { ThinkingAccordion } from './ThinkingAccordion';
import { ToolCallCard } from './ToolCallCard';
import { CitationsList } from './CitationsList';
import { parseThinkingContent } from '../../utils/thinking';
import { SiblingInfo } from '../../utils/branching';
import { useChatStore } from '../../store/useChatStore';

interface MessageItemProps {
  message: ChatMessage;
  siblingInfo?: SiblingInfo;
  onSwitchBranch?: (direction: 'prev' | 'next') => void;
  onEditAndBranch?: (content: string) => void;
  onRegenerate?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  siblingInfo,
  onSwitchBranch,
  onEditAndBranch,
  onRegenerate,
}) => {
  const { sendMessage, retryMessage, deleteMessage } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const isStopped = message.status === 'stopped';
  const hasHitMaxTokens = !isUser && !isStreaming && isMaxTokensHit(message.finishReason);

  // Parse chain-of-thought vs main response content for assistant messages
  const { reasoning, content: displayContent, isThinking } = !isUser
    ? parseThinkingContent(message.content, message.reasoningContent, isStreaming)
    : { reasoning: undefined, content: message.content, isThinking: false };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isUser ? message.content : (displayContent || message.content));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy message:', e);
    }
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() && onEditAndBranch) {
      onEditAndBranch(editedContent.trim());
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditedContent(message.content);
    }
  };

  return (
    <div
      className={`group flex flex-col py-4 px-4 sm:px-6 transition-colors border-b border-border/40 ${
        isUser ? 'bg-background' : 'bg-secondary/20'
      }`}
    >
      <div className="max-w-4xl w-full mx-auto flex items-start space-x-3.5">
        {/* Role Avatar */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-xs font-semibold ${
            isUser
              ? 'bg-secondary text-secondary-foreground border border-border'
              : 'bg-foreground text-background font-mono'
          }`}
        >
          {isUser ? <User className="w-3.5 h-3.5" /> : <span>AI</span>}
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0">
          {/* Header info */}
          <div className="flex items-center space-x-2 mb-1.5 select-none">
            <span className="text-xs font-semibold text-foreground">
              {isUser ? 'You' : 'Assistant'}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.latencyMs && (
              <span className="text-[10px] text-muted-foreground flex items-center space-x-1 font-mono">
                <Clock className="w-2.5 h-2.5" />
                <span>{message.latencyMs}ms</span>
              </span>
            )}

            {/* Sibling Branch Pagination (< 1 / 2 >) */}
            {siblingInfo && siblingInfo.total > 1 && (
              <div className="flex items-center space-x-0.5 select-none text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1 py-0.5 rounded border border-border shadow-xs ml-1">
                <button
                  type="button"
                  onClick={() => onSwitchBranch?.('prev')}
                  disabled={siblingInfo.index === 0}
                  className="p-0.5 rounded hover:text-foreground hover:bg-background/80 disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Previous branch version"
                  aria-label="Previous version"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="px-1 font-semibold text-foreground">
                  {siblingInfo.index + 1} / {siblingInfo.total}
                </span>
                <button
                  type="button"
                  onClick={() => onSwitchBranch?.('next')}
                  disabled={siblingInfo.index === siblingInfo.total - 1}
                  className="p-0.5 rounded hover:text-foreground hover:bg-background/80 disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed"
                  title="Next branch version"
                  aria-label="Next version"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Attachments (if user message) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att) => (
                <AttachmentChip key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Body Content */}
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full bg-card border border-ring rounded-lg p-3 text-xs sm:text-sm text-foreground outline-none resize-y min-h-[90px] shadow-xs"
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium shadow-sm transition-opacity"
                >
                  Save & Submit
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedContent(message.content);
                  }}
                  className="px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border transition-colors"
                >
                  Cancel
                </button>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono select-none">
                  Ctrl+Enter to submit • Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            <div className="text-foreground text-xs sm:text-sm">
              {isUser ? (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>
              ) : (
                <>
                  {/* Collapsible Thinking / Reasoning Accordion */}
                  {(reasoning || isThinking) && (
                    <ThinkingAccordion
                      reasoning={reasoning || ''}
                      isThinking={isThinking}
                      thinkingDurationMs={message.thinkingDurationMs}
                    />
                  )}

                  {/* Real-time Tool Execution Cards (Search, Read, Browse) */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <ToolCallCard toolCalls={message.toolCalls} />
                  )}

                  {isStreaming && !displayContent && !isThinking ? (
                    <div className="flex items-center space-x-2 py-1 text-xs text-muted-foreground select-none">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:150ms]" />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:300ms]" />
                      <span className="text-[11px] font-medium text-muted-foreground tracking-tight ml-1">
                        {message.toolCalls?.some((t) => t.status === 'running')
                          ? 'Searching & browsing the web...'
                          : 'Thinking...'}
                      </span>
                    </div>
                  ) : (
                    displayContent ? (
                      <MarkdownRenderer content={displayContent} />
                    ) : null
                  )}
                  {isStreaming && displayContent && <span className="animate-cursor text-foreground" />}

                  {/* Web Citations and Grounding Sources List */}
                  {message.citations && message.citations.length > 0 && (
                    <CitationsList citations={message.citations} />
                  )}
                </>
              )}
            </div>
          )}

          {/* Error Alert Box */}
          {isError && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Request Failed</p>
                <p className="mt-0.5 text-foreground leading-relaxed">
                  {message.errorMessage || 'Failed to complete generation'}
                </p>
                <button
                  onClick={() => (onRegenerate ? onRegenerate() : retryMessage(message.id))}
                  className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive font-medium transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Request</span>
                </button>
              </div>
            </div>
          )}

          {/* Stopped Generation Indicator */}
          {isStopped && (
            <div className="mt-2 text-[11px] text-muted-foreground italic font-mono">
              — Generation stopped by user —
            </div>
          )}

          {/* Maximum Tokens Hit Message */}
          {hasHitMaxTokens && (
            <div
              data-testid="max-tokens-warning"
              className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2.5 shadow-xs select-none"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-amber-950 dark:text-amber-100">
                    Maximum Tokens Reached
                  </span>
                  {message.tokenUsage?.completionTokens && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 font-medium">
                      {message.tokenUsage.completionTokens.toLocaleString()} tokens outputted
                    </span>
                  )}
                </div>
                <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed text-[11px]">
                  The maximum tokens outputted have been hit. The model reached its output token limit and stopped generating before completing the full response.
                </p>
                <div className="pt-0.5 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => sendMessage('Continue from where you left off.')}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 font-medium transition-colors cursor-pointer"
                  >
                    <span>Continue Generating</span>
                  </button>
                  {onRegenerate && (
                    <button
                      type="button"
                      onClick={() => onRegenerate()}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-secondary hover:bg-accent text-secondary-foreground font-medium border border-border transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Token Usage Badge */}
          {message.tokenUsage && (
            <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] text-muted-foreground font-mono select-none bg-secondary/40 border border-border px-2 py-0.5 rounded w-fit">
              <Layers className="w-3 h-3" />
              <span>
                Tokens: {message.tokenUsage.promptTokens ?? '?'} in / {message.tokenUsage.completionTokens ?? '?'} out
                {message.tokenUsage.totalTokens ? ` (${message.tokenUsage.totalTokens} total)` : ''}
              </span>
              {hasHitMaxTokens && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold">
                  (Max tokens hit)
                </span>
              )}
            </div>
          )}

          {/* Actions Toolbar */}
          {!isStreaming && !isEditing && (
            <div className="flex items-center space-x-1 mt-2 select-none opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Copy message"
                aria-label="Copy Message"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-foreground" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {isUser && onEditAndBranch && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditedContent(message.content);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Edit message (creates new branch)"
                  aria-label="Edit Message"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {!isUser && (
                <button
                  onClick={() => (onRegenerate ? onRegenerate() : retryMessage(message.id))}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Regenerate response (creates new branch)"
                  aria-label="Regenerate Response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => deleteMessage(message.id)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                title="Delete message"
                aria-label="Delete Message"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

