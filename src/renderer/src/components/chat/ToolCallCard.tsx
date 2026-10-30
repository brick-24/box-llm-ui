import React, { useState } from 'react';
import {
  Search,
  Globe,
  FileText,
  FileCode,
  Printer,
  Camera,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  Wrench,
} from 'lucide-react';
import { ToolCallItem } from '@shared/types';
import { useChatStore } from '../../store/useChatStore';

interface ToolCallCardProps {
  toolCalls: ToolCallItem[];
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCalls }) => {
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean>>({});
  const openBrowserDrawer = useChatStore((s) => s.openBrowserDrawer);

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedCalls((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getToolIcon = (name: string, status: string) => {
    if (status === 'running') {
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />;
    }
    switch (name) {
      case 'search_web':
        return <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
      case 'fetch_web_page':
        return <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'browse_page':
        return <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />;
      case 'take_page_screenshot':
        return <Camera className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
      case 'create_file':
        return <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'read_file':
        return <FileText className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
      case 'generate_pdf':
        return <Printer className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
      default:
        return <Wrench className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />;
    }
  };

  const getToolTitle = (item: ToolCallItem): string => {
    switch (item.name) {
      case 'search_web':
        return `Search: "${item.input?.query || ''}"`;
      case 'fetch_web_page': {
        const u = item.input?.url || '';
        try {
          const parsed = new URL(u);
          return `Read: ${parsed.hostname}${parsed.pathname.slice(0, 24)}`;
        } catch {
          return `Read: ${u.slice(0, 32)}`;
        }
      }
      case 'browse_page': {
        const u = item.input?.url || '';
        try {
          const parsed = new URL(u);
          return `Browse: ${parsed.hostname}${parsed.pathname.slice(0, 24)}`;
        } catch {
          return `Browse: ${u.slice(0, 32)}`;
        }
      }
      case 'take_page_screenshot':
        return `Screenshot: ${item.input?.url ? new URL(item.input.url).hostname : 'Webpage'}`;
      case 'create_file':
        return `Create file: ${item.input?.path || 'file'}`;
      case 'read_file':
        return `Read file: ${item.input?.path || 'file'}`;
      case 'generate_pdf':
        return `PDF: "${item.input?.title || item.input?.filename || 'Document'}"`;
      default:
        return item.name;
    }
  };

  const getStatusBadge = (item: ToolCallItem) => {
    if (item.status === 'running') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400/90 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Running
        </span>
      );
    }
    if (item.status === 'completed') {
      let label = 'Done';
      if (item.name === 'search_web') {
        const count = item.output?.count ?? item.output?.results?.length ?? 0;
        label = `${count} source${count === 1 ? '' : 's'}`;
      } else if (item.name === 'fetch_web_page' || item.name === 'browse_page') {
        const chars = item.output?.characterCount || 0;
        label = chars > 0 ? `${(chars / 1000).toFixed(1)}k chars` : 'Read';
      } else if (item.name === 'take_page_screenshot') {
        label = 'Captured';
      } else if (item.name === 'create_file') {
        label = item.output?.bytesWritten ? `${item.output.bytesWritten} B written` : 'Created';
      } else if (item.name === 'read_file') {
        label = item.output?.characterCount ? `${item.output.characterCount} chars` : 'Read';
      } else if (item.name === 'generate_pdf') {
        label = item.output?.filename || 'Generated';
      }

      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
        <AlertCircle className="w-3 h-3 text-rose-400" />
        Failed
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 my-2.5 max-w-full">
      {toolCalls.map((item) => {
        const isExpanded = Boolean(expandedCalls[item.id]);
        const hasDetails = item.status === 'completed' || Boolean(item.error);
        const urlToInspect = item.input?.url || (item.output?.results?.[0]?.url);

        return (
          <div
            key={item.id}
            className="group rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-zinc-700/80"
          >
            {/* Header / Summary Bar */}
            <div
              className={`flex items-center justify-between px-3 py-2 text-xs select-none ${
                hasDetails ? 'cursor-pointer hover:bg-zinc-800/30' : ''
              }`}
              onClick={() => hasDetails && toggleExpand(item.id)}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {getToolIcon(item.name, item.status)}
                <span className="font-medium text-zinc-200 truncate tracking-tight">
                  {getToolTitle(item)}
                </span>
                {item.durationMs !== undefined && item.durationMs > 0 && (
                  <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                    {item.durationMs}ms
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {urlToInspect && (
                  <button
                    type="button"
                    title="Inspect in Browser Drawer"
                    onClick={(e) => {
                      e.stopPropagation();
                      openBrowserDrawer(
                        urlToInspect,
                        item.output?.title,
                        item.output?.screenshotDataUrl,
                        item.output?.content
                      );
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-blue-400 hover:bg-zinc-800/80 transition-colors opacity-70 group-hover:opacity-100"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}

                {getStatusBadge(item)}

                {hasDetails && (
                  <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Expandable Results View */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50 bg-black/20 text-xs text-zinc-300">
                {item.error && (
                  <div className="text-rose-400 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30 font-mono text-[11px] mb-2">
                    {item.error}
                  </div>
                )}

                {/* Search Results Details */}
                {item.name === 'search_web' && item.output?.results && (
                  <div className="flex flex-col gap-2 mt-1">
                    {item.output.results.map((res: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              if (window.electronAPI) {
                                window.electronAPI.openExternal(res.url);
                              }
                            }}
                            className="font-medium text-blue-400 hover:underline truncate inline-flex items-center gap-1.5"
                          >
                            <span>{res.title || res.url}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                          </a>
                          <button
                            type="button"
                            onClick={() => openBrowserDrawer(res.url, res.title)}
                            className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors flex-shrink-0"
                          >
                            Preview
                          </button>
                        </div>
                        {res.snippet && (
                          <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                            {res.snippet}
                          </p>
                        )}
                        <span className="text-[10px] text-zinc-500 truncate font-mono">
                          {res.url}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Page Fetch / Browse Details */}
                {(item.name === 'fetch_web_page' || item.name === 'browse_page') && item.output && (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-200 truncate">
                        {item.output.title || 'Extracted Page Content'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openBrowserDrawer(
                            item.output.url,
                            item.output.title,
                            item.output.screenshotDataUrl,
                            item.output.content
                          )
                        }
                        className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Open Reader Mode
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    {item.output.content && (
                      <div className="max-h-40 overflow-y-auto p-2 bg-zinc-950/60 rounded border border-zinc-800 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap select-text">
                        {item.output.content.slice(0, 800)}
                        {item.output.content.length > 800 && '...'}
                      </div>
                    )}
                  </div>
                )}

                {/* Screenshot Preview */}
                {item.name === 'take_page_screenshot' && item.output?.screenshotDataUrl && (
                  <div className="mt-2">
                    <img
                      src={item.output.screenshotDataUrl}
                      alt="Captured Screenshot"
                      className="rounded-lg border border-zinc-700 max-h-60 w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() =>
                        openBrowserDrawer(
                          item.input?.url || '',
                          'Screenshot',
                          item.output.screenshotDataUrl
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
