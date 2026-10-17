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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border w-full max-w-3xl rounded-xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <div className="flex items-center space-x-3 truncate mr-4">
            <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-foreground truncate">{att.name}</h3>
              <p className="text-xs text-muted-foreground font-mono">
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
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs text-secondary-foreground border border-border transition-colors font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-foreground" />
                    <span>Copied</span>
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
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Close Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Warning banner */}
        {att.status === 'warning' && (
          <div className="px-5 py-2.5 bg-secondary border-b border-border flex items-center space-x-2.5 text-xs text-foreground">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>{att.errorMessage || 'This document has limited selectable text and may be scanned.'}</span>
          </div>
        )}

        {/* Content body */}
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-foreground bg-background">
          {att.previewDataUrl && att.type.startsWith('image/') ? (
            <div className="flex flex-col items-center justify-center p-4">
              <img
                src={att.previewDataUrl}
                alt={att.name}
                className="max-h-[500px] rounded-lg shadow-sm border border-border object-contain"
              />
            </div>
          ) : att.extractedText ? (
            <pre className="whitespace-pre-wrap break-words">{att.extractedText}</pre>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No extracted text available for this attachment.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono text-[11px]">Extraction: {att.strategy}</span>
          <button
            onClick={() => setSelectedAttachmentForModal(null)}
            className="px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
