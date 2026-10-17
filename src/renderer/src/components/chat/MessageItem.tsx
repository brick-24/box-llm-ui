import React, { useState } from 'react';
import {
  User,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertCircle,
  Clock,
  Layers,
  Edit3,
} from 'lucide-react';
import { ChatMessage } from '@shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AttachmentChip } from './AttachmentChip';
import { useChatStore } from '../../store/useChatStore';

interface MessageItemProps {
  message: ChatMessage;
  onEditAndResend?: (content: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onEditAndResend }) => {
  const { retryMessage, deleteMessage } = useChatStore();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const isStopped = message.status === 'stopped';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy message:', e);
    }
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() && onEditAndResend) {
      onEditAndResend(editedContent.trim());
      setIsEditing(false);
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
                className="w-full bg-card border border-ring rounded-lg p-3 text-xs sm:text-sm text-foreground outline-none resize-y min-h-[90px]"
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium shadow-sm"
                >
                  Save & Resend
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border"
                >
                  Cancel
                </button>
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
                  {isStreaming && !message.content ? (
                    <div className="flex items-center space-x-2 py-1 text-xs text-muted-foreground select-none">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:150ms]" />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:300ms]" />
                      <span className="text-[11px] font-medium text-muted-foreground tracking-tight ml-1">Thinking...</span>
                    </div>
                  ) : (
                    <MarkdownRenderer content={message.content || ''} />
                  )}
                  {isStreaming && message.content && <span className="animate-cursor text-foreground" />}
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
                  onClick={() => retryMessage(message.id)}
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

          {/* Token Usage Badge */}
          {message.tokenUsage && (
            <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] text-muted-foreground font-mono select-none bg-secondary/40 border border-border px-2 py-0.5 rounded w-fit">
              <Layers className="w-3 h-3" />
              <span>
                Tokens: {message.tokenUsage.promptTokens ?? '?'} in / {message.tokenUsage.completionTokens ?? '?'} out
                {message.tokenUsage.totalTokens ? ` (${message.tokenUsage.totalTokens} total)` : ''}
              </span>
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

              {isUser && onEditAndResend && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditedContent(message.content);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Edit message"
                  aria-label="Edit Message"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {!isUser && (
                <button
                  onClick={() => retryMessage(message.id)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Regenerate response"
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
