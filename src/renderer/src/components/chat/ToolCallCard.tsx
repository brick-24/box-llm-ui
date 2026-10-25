import React, { useState } from 'react';
import {
  Search,
  Globe,
  FileText,
  Camera,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye,
  Terminal,
  FileCode,
  Folder,
  Play,
} from 'lucide-react';
import { ToolCallItem } from '@shared/types';
import { useChatStore } from '../../store/useChatStore';

interface ToolCallCardProps {
  toolCalls: ToolCallItem[];
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCalls }) => {
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean>>({});
  const openBrowserDrawer = useChatStore((s) => s.openBrowserDrawer);
  const openFilePreview = useChatStore((s) => s.openFilePreview);
  const isWorkspaceDrawerOpen = useChatStore((s) => s.isWorkspaceDrawerOpen);
  const toggleWorkspaceDrawer = useChatStore((s) => s.toggleWorkspaceDrawer);
  const selectProcess = useChatStore((s) => s.selectProcess);

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedCalls((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getToolIcon = (name: string, status: string) => {
    if (status === 'running') {
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />;
    }
    switch (name) {
      // Browser tools
      case 'search_web':
        return <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
      case 'fetch_web_page':
        return <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'browse_page':
        return <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />;
      case 'take_page_screenshot':
        return <Camera className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;

      // Workspace coding tools
      case 'run_command':
        return <Terminal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'manage_process':
        return <Terminal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'write_to_file':
        return <FileCode className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />;
      case 'replace_file_content':
        return <FileCode className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />;
      case 'view_file':
        return <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
      case 'list_dir':
        return <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
      case 'grep_search':
        return <Search className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />;

      default:
        return <Play className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />;
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

      // Coding tools
      case 'run_command':
        return item.input?.isDaemon
          ? `⚡ Background: $ ${item.input?.command || 'command'}`
          : `$ ${item.input?.command || 'command'}`;
      case 'manage_process':
        return `Process: ${item.input?.action || 'status'} ${item.input?.processId ? `(${item.input.processId})` : ''}`;
      case 'write_to_file':
        return `Write: ${item.input?.filePath || item.input?.path || 'file'}`;
      case 'replace_file_content':
        return `Edit: ${item.input?.filePath || item.input?.path || 'file'}`;
      case 'view_file':
        return `View: ${item.input?.filePath || item.input?.path || 'file'}`;
      case 'list_dir':
        return `List: ${item.input?.dirPath || item.input?.path || '.'}`;
      case 'grep_search':
        return `Grep: "${item.input?.pattern || ''}"`;

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
      } else if (item.name === 'run_command') {
        if (item.output?.isDaemon) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Daemon PID {item.output.pid || ''}
            </span>
          );
        }
        const exitCode = item.output?.exitCode ?? 0;
        label = `exit ${exitCode}`;
        if (exitCode !== 0) {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              {label}
            </span>
          );
        }
      } else if (item.name === 'manage_process') {
        label = item.output?.error ? 'Error' : 'Managed';
      } else if (item.name === 'write_to_file') {
        label = item.output?.bytesWritten !== undefined ? `${item.output.bytesWritten} B` : 'Saved';
      } else if (item.name === 'replace_file_content') {
        label = 'Replaced';
      } else if (item.name === 'view_file') {
        label = item.output?.totalLines ? `${item.output.totalLines} lines` : 'Read';
      } else if (item.name === 'list_dir') {
        const count = item.output?.totalEntries ?? item.output?.entries?.length ?? 0;
        label = `${count} items`;
      } else if (item.name === 'grep_search') {
        const count = item.output?.matchCount ?? item.output?.matches?.length ?? 0;
        label = `${count} matches`;
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
        // Auto-expand terminal for running or outputting commands
        const isRunCommand = item.name === 'run_command';
        const hasStreamingOutput = Boolean(item.streamingOutput);
        const isExpanded = expandedCalls[item.id] !== undefined
          ? expandedCalls[item.id]
          : isRunCommand && (item.status === 'running' || hasStreamingOutput);

        const hasDetails =
          item.status === 'completed' ||
          Boolean(item.error) ||
          hasStreamingOutput ||
          isRunCommand;

        const urlToInspect = item.input?.url || item.output?.results?.[0]?.url;
        const filePath = item.input?.filePath || item.input?.path;

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
                <span className="font-medium font-mono text-zinc-200 truncate tracking-tight text-[11px]">
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

                {filePath && (
                  <button
                    type="button"
                    title="Preview File"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFilePreview(filePath);
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-sky-400 hover:bg-zinc-800/80 transition-colors opacity-70 group-hover:opacity-100"
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
                  <div className="text-rose-400 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30 font-mono text-[11px] mb-2 whitespace-pre-wrap select-text">
                    {item.error}
                  </div>
                )}

                {/* Live Terminal for run_command */}
                {isRunCommand && (
                  <div className="flex flex-col gap-2 mt-1">
                    {item.output?.isDaemon && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[11px] font-mono text-emerald-300">
                            Background process running (PID: {item.output.pid})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.output?.processId) {
                              selectProcess(item.output.processId);
                              if (!isWorkspaceDrawerOpen) toggleWorkspaceDrawer();
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View in Processes
                        </button>
                      </div>
                    )}

                    <div className="bg-zinc-950 rounded-lg border border-zinc-800/80 p-2.5 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-56 select-text whitespace-pre-wrap leading-relaxed shadow-inner">
                      {item.streamingOutput ||
                        (item.output?.initialLogs && item.output.initialLogs.join('\n')) ||
                        item.output?.stdout ||
                        item.output?.output ||
                        (item.status === 'running' ? (
                          <span className="text-zinc-500 italic flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                            Executing command in workspace...
                          </span>
                        ) : (
                          <span className="text-zinc-600 italic">No terminal output</span>
                        ))}
                    </div>
                    {item.output?.stderr && (
                      <div className="bg-rose-950/30 border border-rose-900/30 rounded-lg p-2 font-mono text-[11px] text-rose-300 overflow-x-auto max-h-32 select-text whitespace-pre-wrap">
                        {item.output.stderr}
                      </div>
                    )}
                  </div>
                )}

                {/* manage_process details */}
                {item.name === 'manage_process' && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="bg-zinc-950 rounded-lg border border-zinc-800/80 p-2.5 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-48 select-text whitespace-pre-wrap leading-relaxed shadow-inner">
                      {typeof item.output === 'string'
                        ? item.output
                        : JSON.stringify(item.output, null, 2)}
                    </div>
                  </div>
                )}

                {/* write_to_file view */}
                {item.name === 'write_to_file' && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400 truncate">
                        {filePath}
                      </span>
                      {filePath && (
                        <button
                          type="button"
                          onClick={() => openFilePreview(filePath)}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View File
                        </button>
                      )}
                    </div>
                    {item.input?.content && (
                      <div className="bg-zinc-950 rounded p-2 border border-zinc-800 font-mono text-[11px] text-zinc-400 max-h-36 overflow-auto whitespace-pre-wrap select-text">
                        {item.input.content.slice(0, 1000)}
                        {item.input.content.length > 1000 && '\n... (truncated preview)'}
                      </div>
                    )}
                  </div>
                )}

                {/* replace_file_content view */}
                {item.name === 'replace_file_content' && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400 truncate">
                        {filePath}
                      </span>
                      {filePath && (
                        <button
                          type="button"
                          onClick={() => openFilePreview(filePath)}
                          className="text-[10px] text-violet-400 hover:text-violet-300 font-mono flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View File
                        </button>
                      )}
                    </div>
                    {item.input?.targetContent && item.input?.replacementContent && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                        <div className="bg-rose-950/20 border border-rose-900/30 rounded p-2 font-mono text-[11px] text-rose-300 max-h-32 overflow-auto whitespace-pre-wrap select-text">
                          <span className="text-[10px] text-rose-500 block mb-1 font-semibold uppercase">Replaced:</span>
                          {item.input.targetContent.slice(0, 500)}
                        </div>
                        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded p-2 font-mono text-[11px] text-emerald-300 max-h-32 overflow-auto whitespace-pre-wrap select-text">
                          <span className="text-[10px] text-emerald-500 block mb-1 font-semibold uppercase">With:</span>
                          {item.input.replacementContent.slice(0, 500)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* view_file preview */}
                {item.name === 'view_file' && item.output?.content && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-zinc-400">
                        Lines {item.output.startLine ?? 1} - {item.output.endLine ?? item.output.totalLines} of {item.output.totalLines}
                      </span>
                      {filePath && (
                        <button
                          type="button"
                          onClick={() => openFilePreview(filePath)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Full File
                        </button>
                      )}
                    </div>
                    <div className="bg-zinc-950 rounded p-2 border border-zinc-800 font-mono text-[11px] text-zinc-300 max-h-40 overflow-auto whitespace-pre-wrap select-text">
                      {item.output.content}
                    </div>
                  </div>
                )}

                {/* list_dir preview */}
                {item.name === 'list_dir' && item.output?.entries && (
                  <div className="flex flex-col gap-1 mt-1 font-mono text-[11px]">
                    <div className="bg-zinc-950 rounded p-2 border border-zinc-800 max-h-36 overflow-auto flex flex-col gap-0.5">
                      {item.output.entries.map((entry: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-zinc-300">
                          {entry.type === 'directory' ? (
                            <Folder className="w-3 h-3 text-amber-400" />
                          ) : (
                            <File className="w-3 h-3 text-zinc-500" />
                          )}
                          <span>{entry.name}</span>
                          {entry.size !== undefined && (
                            <span className="text-[10px] text-zinc-500 ml-auto">
                              {entry.size} B
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* grep_search preview */}
                {item.name === 'grep_search' && item.output?.matches && (
                  <div className="flex flex-col gap-1 mt-1 font-mono text-[11px]">
                    <div className="bg-zinc-950 rounded p-2 border border-zinc-800 max-h-40 overflow-auto flex flex-col gap-1.5">
                      {item.output.matches.map((m: any, i: number) => (
                        <div key={i} className="flex flex-col text-zinc-300">
                          <div className="flex items-center justify-between text-teal-400">
                            <span>{m.filePath}:{m.lineNumber}</span>
                            <button
                              type="button"
                              onClick={() => openFilePreview(m.filePath)}
                              className="text-[10px] text-zinc-500 hover:text-white"
                            >
                              open
                            </button>
                          </div>
                          <span className="text-zinc-400 pl-2 text-[10px] truncate">{m.lineContent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Browser Search Results Details */}
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
