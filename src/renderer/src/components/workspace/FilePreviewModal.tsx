import React, { useState } from 'react';
import { X, Copy, Check, FileCode, HardDrive, ListOrdered } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';

export const FilePreviewModal: React.FC = () => {
  const { selectedPreviewFile, closeFilePreview } = useChatStore();
  const [copied, setCopied] = useState(false);

  if (!selectedPreviewFile) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedPreviewFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const lines = selectedPreviewFile.content.split('\n');
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeFilePreview}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 text-blue-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-zinc-100 truncate font-mono">
                {selectedPreviewFile.relativePath}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-zinc-500" />
                  {formatSize(selectedPreviewFile.size)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <ListOrdered className="w-3 h-3 text-zinc-500" />
                  {selectedPreviewFile.lines} lines
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={closeFilePreview}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              title="Close Preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer with Line Numbers */}
        <div className="flex-1 overflow-auto bg-zinc-950 p-4 font-mono text-xs text-zinc-200 leading-relaxed select-text">
          <div className="flex min-w-full">
            {/* Gutter */}
            <div className="select-none text-right pr-4 text-zinc-600 font-mono select-none flex flex-col flex-shrink-0 border-r border-zinc-800/80 mr-4">
              {lines.map((_, i) => (
                <span key={i} className="leading-relaxed">
                  {i + 1}
                </span>
              ))}
            </div>
            {/* Code lines */}
            <div className="flex-1 overflow-x-auto whitespace-pre font-mono">
              {lines.map((line, i) => (
                <div key={i} className="leading-relaxed hover:bg-zinc-900/50 px-1 rounded">
                  {line || ' '}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
