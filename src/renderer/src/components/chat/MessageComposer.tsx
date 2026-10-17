import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  AlertTriangle,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AttachmentChip } from './AttachmentChip';

export const MessageComposer: React.FC = () => {
  const {
    sendMessage,
    stopGeneration,
    isStreaming,
    attachments,
    addAttachment,
    removeAttachment,
  } = useChatStore();

  const { settings } = useSettingsStore();

  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 220)}px`;
    }
  }, [input]);

  // Focus textarea on mount or when streaming ends
  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;
    sendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.sendOnEnter) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleFileAttach = async () => {
    if (!window.electronAPI) return;
    try {
      setIsProcessingFile(true);
      const selected = await window.electronAPI.selectFileDialog();
      if (selected && Array.isArray(selected)) {
        for (const att of selected) {
          addAttachment(att);
        }
      }
    } catch (e) {
      console.error('File selection error:', e);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Clipboard paste handler (text or images)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setIsProcessingFile(true);
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            if (window.electronAPI) {
              const att = await window.electronAPI.processBuffer(
                base64,
                `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
                file.type
              );
              addAttachment(att);
            }
            setIsProcessingFile(false);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Electron File object exposes .path
      const filePath = (file as any).path;
      if (filePath && window.electronAPI) {
        try {
          const att = await window.electronAPI.processFile(filePath);
          addAttachment(att);
        } catch (err) {
          console.error('Failed to process dropped file:', err);
        }
      }
    }
    setIsProcessingFile(false);
  };

  // Calculate estimated tokens from attachments
  const totalAttachmentTokens = attachments.reduce(
    (sum, a) => sum + (a.tokenEstimate || 0),
    0
  );
  const isContextNearLimit = totalAttachmentTokens > (settings.contextWarningLimit || 32000);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="p-3 sm:p-4 bg-zinc-950/80 border-t border-zinc-800/80 relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-violet-950/80 border-2 border-dashed border-violet-500 rounded-2xl m-2 flex flex-col items-center justify-center z-40 backdrop-blur-sm animate-in fade-in duration-150">
          <UploadCloud className="w-10 h-10 text-violet-400 mb-2 animate-bounce" />
          <p className="text-sm font-semibold text-violet-200">Drop documents or images to attach</p>
          <p className="text-xs text-violet-400">PDF, DOCX, Code, Text, PNG, JPEG</p>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col space-y-2">
        {/* Context Limit Warning */}
        {isContextNearLimit && (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Attached documents contain ~{totalAttachmentTokens.toLocaleString()} tokens, which is approaching the context limit.
            </span>
          </div>
        )}

        {/* Attachment Chips Tray */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
          </div>
        )}

        {/* Composer Input Box */}
        <div className="relative rounded-2xl bg-zinc-900 border border-zinc-800 focus-within:border-violet-500/80 transition-all shadow-lg flex flex-col">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isStreaming
                ? 'Generation in progress...'
                : 'Send a message or drop files... (Shift+Enter for newline)'
            }
            disabled={isStreaming}
            className="w-full bg-transparent px-4 pt-3 pb-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-400 outline-none resize-none leading-relaxed min-h-[46px] max-h-[220px]"
          />

          {/* Bottom Composer Toolbar */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 select-none">
            {/* Attachment & Tool buttons */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleFileAttach}
                disabled={isProcessingFile || isStreaming}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-xs font-medium"
                title="Attach Document or Image"
              >
                {isProcessingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                ) : (
                  <Paperclip className="w-4 h-4 text-zinc-400" />
                )}
                <span className="hidden sm:inline">Attach</span>
              </button>

              {totalAttachmentTokens > 0 && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  ~{totalAttachmentTokens} tokens
                </span>
              )}
            </div>

            {/* Send / Stop Buttons */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-400 hidden md:inline">
                {settings.sendOnEnter ? 'Enter to send' : 'Ctrl+Enter to send'}
              </span>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 transition-all"
                  title="Stop generation"
                >
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 text-white shadow-md shadow-violet-600/30 transition-all"
                  title="Send message"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
