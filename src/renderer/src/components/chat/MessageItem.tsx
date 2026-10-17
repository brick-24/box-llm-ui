import React, { useState } from 'react';
import {
  User,
  Sparkles,
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
      className={`group flex flex-col py-4 px-4 sm:px-6 transition-colors ${
        isUser ? 'bg-zinc-950/40' : 'bg-zinc-900/30 border-y border-zinc-900/50'
      }`}
    >
      <div className="max-w-4xl w-full mx-auto flex items-start space-x-3.5">
        {/* Role Avatar */}
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
            isUser
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
              : 'bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-violet-500/20'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0">
          {/* Header info */}
          <div className="flex items-center space-x-2 mb-1.5 select-none">
            <span className="text-xs font-semibold text-zinc-200">
              {isUser ? 'You' : 'Assistant'}
            </span>
            <span className="text-[10px] text-zinc-400">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.latencyMs && (
              <span className="text-[10px] text-zinc-400 flex items-center space-x-1 font-mono">
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
                className="w-full bg-zinc-900 border border-violet-500/80 rounded-xl p-3 text-xs sm:text-sm text-zinc-100 outline-none resize-y min-h-[90px]"
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
                >
                  Save & Resend
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-zinc-200">
              {isUser ? (
                <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>
              ) : (
                <>
                  <MarkdownRenderer content={message.content || ''} />
                  {isStreaming && <span className="animate-cursor" />}
                </>
              )}
            </div>
          )}

          {/* Error Alert Box */}
          {isError && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-200">Request Failed</p>
                <p className="mt-0.5 text-zinc-300 leading-relaxed">
                  {message.errorMessage || 'Failed to complete generation'}
                </p>
                <button
                  onClick={() => retryMessage(message.id)}
                  className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Request</span>
                </button>
              </div>
            </div>
          )}

          {/* Stopped Generation Indicator */}
          {isStopped && (
            <div className="mt-2 text-[11px] text-zinc-400 italic">
              — Generation stopped by user —
            </div>
          )}

          {/* Token Usage Badge */}
          {message.tokenUsage && (
            <div className="mt-2.5 flex items-center space-x-3 text-[10px] text-zinc-400 font-mono select-none">
              <span className="flex items-center space-x-1">
                <Layers className="w-3 h-3" />
                <span>
                  Tokens: {message.tokenUsage.promptTokens ?? '?'} in / {message.tokenUsage.completionTokens ?? '?'} out
                  {message.tokenUsage.totalTokens ? ` (${message.tokenUsage.totalTokens} total)` : ''}
                </span>
              </span>
            </div>
          )}

          {/* Actions Toolbar */}
          {!isStreaming && !isEditing && (
            <div className="flex items-center space-x-1 mt-2 select-none opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Copy message"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {isUser && onEditAndResend && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditedContent(message.content);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  title="Edit message"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {!isUser && (
                <button
                  onClick={() => retryMessage(message.id)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                  title="Regenerate response"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => deleteMessage(message.id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                title="Delete message"
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
