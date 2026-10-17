import React from 'react';
import { X, FileText, AlertTriangle, Copy, Check } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';

export const AttachmentModal: React.FC = () => {
  const { selectedAttachmentForModal, setSelectedAttachmentForModal } = useChatStore();
  const [copied, setCopied] = React.useState(false);

  if (!selectedAttachmentForModal) return null;
  const att = selectedAttachmentForModal;

  const handleCopy = async () => {
    if (att.extractedText) {
      await navigator.clipboard.writeText(att.extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-750 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center space-x-3 truncate mr-4">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{att.name}</h3>
              <p className="text-xs text-zinc-400">
                {att.type} • {(att.size / 1024).toFixed(1)} KB
                {att.pageCount ? ` • ${att.pageCount} Pages` : ''}
                {att.tokenEstimate ? ` • ~${att.tokenEstimate} Estimated Tokens` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {att.extractedText && (
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setSelectedAttachmentForModal(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scanned/Warning banner */}
        {att.status === 'warning' && (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center space-x-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{att.errorMessage || 'This document has limited selectable text and may be scanned.'}</span>
          </div>
        )}

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-zinc-300 bg-zinc-950/40">
          {att.previewDataUrl && att.type.startsWith('image/') ? (
            <div className="flex flex-col items-center justify-center p-4">
              <img
                src={att.previewDataUrl}
                alt={att.name}
                className="max-h-[500px] rounded-xl shadow-lg border border-zinc-800 object-contain"
              />
            </div>
          ) : att.extractedText ? (
            <pre className="whitespace-pre-wrap break-words">{att.extractedText}</pre>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <p>No extracted text available for this attachment.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Strategy: {att.strategy}</span>
          <button
            onClick={() => setSelectedAttachmentForModal(null)}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
