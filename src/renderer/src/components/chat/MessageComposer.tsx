import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  AlertTriangle,
  UploadCloud,
  Loader2,
  Globe,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useProviderStore } from '../../store/useProviderStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { AttachmentChip } from './AttachmentChip';
import { resolveModelLimits, formatTokensCompact } from '@shared/model-limits';

export const MessageComposer: React.FC = () => {
  const {
    sendMessage,
    stopGeneration,
    isStreaming,
    attachments,
    addAttachment,
    removeAttachment,
    isWebBrowsing,
    toggleWebBrowsing,
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

  // Focus textarea on mount, when streaming ends, or on Ctrl+.
  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  useEffect(() => {
    const handleFocus = () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    };
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        handleFocus();
      }
    };
    window.addEventListener('focus-composer', handleFocus);
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      window.removeEventListener('focus-composer', handleFocus);
      window.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, []);

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

  const { activeConversation } = useChatStore();
  const { activeProvider, models } = useProviderStore();

  const currentModelId =
    activeConversation?.modelId || activeProvider?.defaultModel || '';
  const currentModelInfo = models.find((m) => m.id === currentModelId);
  const activeLimits = resolveModelLimits(currentModelId, {
    contextLength: currentModelInfo?.contextLength,
  });

  // Calculate estimated tokens from attachments
  const totalAttachmentTokens = attachments.reduce(
    (sum, a) => sum + (a.tokenEstimate || 0),
    0
  );

  // Model-aware context ceiling (approaching at 85% or exceeding)
  const effectiveContextLimit = activeLimits.contextLength || settings.contextWarningLimit || 128000;
  const isContextNearLimit = totalAttachmentTokens > effectiveContextLimit * 0.85;
  const isExceeded = totalAttachmentTokens > effectiveContextLimit;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="p-3 sm:p-4 bg-background border-t border-border relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-background/90 border-2 border-dashed border-primary rounded-xl m-2 flex flex-col items-center justify-center z-40 backdrop-blur-sm animate-in fade-in duration-150">
          <UploadCloud className="w-8 h-8 text-foreground mb-2 animate-bounce" />
          <p className="text-sm font-semibold text-foreground">Drop documents or images to attach</p>
          <p className="text-xs text-muted-foreground font-mono">PDF, DOCX, CSV, TXT, PNG, JPEG</p>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col space-y-2">
        {/* Context Limit Warning */}
        {isContextNearLimit && (
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
            isExceeded
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : 'bg-secondary border-border text-foreground'
          }`}>
            <AlertTriangle className={`w-4 h-4 shrink-0 ${isExceeded ? 'text-destructive' : 'text-amber-500'}`} />
            <span>
              Attached documents contain ~{totalAttachmentTokens.toLocaleString()} tokens,{' '}
              {isExceeded ? 'exceeding' : 'approaching'} {currentModelId ? `${currentModelId}'s` : 'the'} context limit ({formatTokensCompact(effectiveContextLimit)}).
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
        <div className="relative rounded-xl bg-card border border-border focus-within:border-ring focus-within:ring-1 focus-within:ring-ring transition-all shadow-sm flex flex-col">
          <textarea
            id="composer-textarea"
            aria-label="Chat message input"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isStreaming
                ? 'Model response streaming...'
                : 'Send a prompt or drag files... (Shift+Enter for newline, Ctrl+. to focus)'
            }
            disabled={isStreaming}
            className="w-full bg-transparent px-4 pt-3 pb-2 text-xs sm:text-sm text-foreground placeholder-muted-foreground outline-none resize-none leading-relaxed min-h-[46px] max-h-[220px]"
          />

          {/* Bottom Composer Toolbar */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1 select-none">
            {/* Attachment & Tool buttons */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleFileAttach}
                disabled={isProcessingFile || isStreaming}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-medium"
                title="Attach Document or Image"
                aria-label="Attach File"
              >
                {isProcessingFile ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Attach</span>
              </button>

              {/* Web Surfing Toggle */}
              <button
                type="button"
                onClick={toggleWebBrowsing}
                disabled={isStreaming}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isWebBrowsing
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
                }`}
                title={isWebBrowsing ? 'Web browsing active (Click to disable)' : 'Enable web browsing & search'}
                aria-label="Toggle Web Browsing"
              >
                <Globe className={`w-3.5 h-3.5 ${isWebBrowsing ? 'text-blue-400' : ''}`} />
                <span className="hidden sm:inline">Web</span>
                {isWebBrowsing && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
              </button>

              {totalAttachmentTokens > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded border border-border">
                  ~{totalAttachmentTokens >= 1000000
                    ? `${(totalAttachmentTokens / 1000000).toFixed(1)}M`
                    : totalAttachmentTokens >= 1000
                    ? `${(totalAttachmentTokens / 1000).toFixed(1)}k`
                    : totalAttachmentTokens} tokens
                </span>
              )}
            </div>

            {/* Send / Stop Buttons */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-muted-foreground hidden md:inline font-mono">
                <kbd className="bg-secondary border border-border px-1 py-0.5 rounded text-[9px] mr-1">Ctrl+.</kbd>
                to focus • {settings.sendOnEnter ? '↵ to send' : '⌘↵ to send'}
              </span>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="p-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm transition-all active:scale-95"
                  title="Stop generation"
                  aria-label="Stop Generation"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:hover:opacity-30 shadow-sm transition-all active:scale-95"
                  title="Send message"
                  aria-label="Send Message"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
