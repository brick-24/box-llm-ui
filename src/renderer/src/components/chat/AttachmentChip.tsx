import React from 'react';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  AlertTriangle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { MessageAttachment } from '@shared/types';
import { useChatStore } from '../../store/useChatStore';

interface AttachmentChipProps {
  attachment: MessageAttachment;
  onRemove?: () => void;
  showPreviewAction?: boolean;
}

export const AttachmentChip: React.FC<AttachmentChipProps> = ({
  attachment,
  onRemove,
  showPreviewAction = true,
}) => {
  const { setSelectedAttachmentForModal } = useChatStore();

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = () => {
    if (attachment.type.startsWith('image/')) {
      return <ImageIcon className="w-3.5 h-3.5 text-foreground shrink-0" />;
    }
    if (attachment.type === 'application/pdf') {
      return <FileText className="w-3.5 h-3.5 text-foreground shrink-0" />;
    }
    if (attachment.type.includes('word') || attachment.name.endsWith('.docx')) {
      return <FileText className="w-3.5 h-3.5 text-foreground shrink-0" />;
    }
    if (attachment.type.includes('csv') || attachment.type.includes('sheet') || attachment.name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-3.5 h-3.5 text-foreground shrink-0" />;
    }
    return <FileCode className="w-3.5 h-3.5 text-foreground shrink-0" />;
  };

  return (
    <div
      onClick={() => showPreviewAction && setSelectedAttachmentForModal(attachment)}
      className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-secondary/80 border border-border hover:bg-secondary text-xs text-secondary-foreground max-w-[240px] truncate shadow-sm transition-colors cursor-pointer group select-none"
    >
      {/* Thumbnail or Icon */}
      {attachment.previewDataUrl && attachment.type.startsWith('image/') ? (
        <img
          src={attachment.previewDataUrl}
          alt={attachment.name}
          className="w-4 h-4 rounded object-cover border border-border"
        />
      ) : (
        getIcon()
      )}

      {/* File Details */}
      <div className="flex flex-col truncate min-w-0 flex-1">
        <span className="truncate font-medium text-foreground text-xs">{attachment.name}</span>
        <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground font-mono">
          <span>{formatSize(attachment.size)}</span>
          {attachment.pageCount && <span>• {attachment.pageCount} pgs</span>}
          {attachment.tokenEstimate && <span>• ~{attachment.tokenEstimate} tok</span>}
        </div>
      </div>

      {/* Status indicator */}
      {attachment.status === 'warning' && (
        <span title={attachment.errorMessage || 'Scanned or low-text document'}>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        </span>
      )}
      {attachment.status === 'success' && (
        <span title="Ready">
          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 opacity-70 group-hover:opacity-100" />
        </span>
      )}

      {/* Remove button if passed */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-background transition-colors"
          title="Remove attachment"
          aria-label="Remove Attachment"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
