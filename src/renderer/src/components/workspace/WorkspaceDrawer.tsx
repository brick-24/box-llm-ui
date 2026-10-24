import React, { useState, useMemo } from 'react';
import {
  X,
  RotateCw,
  FolderOpen,
  Folder,
  File,
  FileCode,
  FileText,
  FileJson,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Loader2,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  Plus,
  Bot,
  User,
  FileDiff,
  Sparkles,
} from 'lucide-react';
import { WorkspaceTreeNode, GitFileChange } from '@shared/types';
import { useChatStore } from '../../store/useChatStore';

interface TreeNodeProps {
  node: WorkspaceTreeNode;
  depth: number;
  filter: string;
  onSelectFile: (relativePath: string) => void;
}

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    case 'json':
      return <FileJson className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />;
    case 'md':
    case 'markdown':
      return <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
    case 'css':
    case 'scss':
      return <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
    case 'html':
      return <FileCode className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />;
    case 'py':
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    default:
      return <File className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />;
  }
};

const formatFileSize = (bytes?: number) => {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const TreeNodeView: React.FC<TreeNodeProps> = ({ node, depth, filter, onSelectFile }) => {
  const isDir = Boolean(node.isDir);
  const [isOpen, setIsOpen] = useState(depth < 2);

  const matchesFilter = filter
    ? node.name.toLowerCase().includes(filter.toLowerCase())
    : true;

  const visibleChildren = useMemo(() => {
    if (!node.children) return [];
    if (!filter) return node.children;
    const filterRec = (items: WorkspaceTreeNode[]): WorkspaceTreeNode[] => {
      return items.filter((child) => {
        if (child.name.toLowerCase().includes(filter.toLowerCase())) return true;
        if (child.children && filterRec(child.children).length > 0) return true;
        return false;
      });
    };
    return filterRec(node.children);
  }, [node.children, filter]);

  if (filter && !matchesFilter && visibleChildren.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col select-none">
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-zinc-800/60 cursor-pointer text-xs transition-colors group ${
          depth === 0 ? 'font-semibold text-zinc-200' : 'text-zinc-300'
        }`}
        style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        onClick={() => {
          if (isDir) {
            setIsOpen(!isOpen);
          } else {
            onSelectFile(node.path);
          }
        }}
      >
        {isDir ? (
          <>
            <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
              {isOpen || Boolean(filter) ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3.5" />
            {getFileIcon(node.name)}
          </>
        )}

        <span className="truncate flex-1 font-mono text-[11px] group-hover:text-white">
          {node.name}
        </span>

        {!isDir && node.sizeBytes !== undefined && (
          <span className="text-[10px] text-zinc-500 font-mono hidden group-hover:inline flex-shrink-0">
            {formatFileSize(node.sizeBytes)}
          </span>
        )}
      </div>

      {isDir && (isOpen || Boolean(filter)) && visibleChildren.length > 0 && (
        <div className="flex flex-col">
          {visibleChildren.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              filter={filter}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const getStatusBadge = (status: GitFileChange['status']) => {
  switch (status) {
    case 'added':
      return <span className="w-4 h-4 rounded text-[9px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">A</span>;
    case 'modified':
      return <span className="w-4 h-4 rounded text-[9px] font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">M</span>;
    case 'deleted':
      return <span className="w-4 h-4 rounded text-[9px] font-bold font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">D</span>;
    case 'untracked':
      return <span className="w-4 h-4 rounded text-[9px] font-bold font-mono bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">U</span>;
    case 'renamed':
      return <span className="w-4 h-4 rounded text-[9px] font-bold font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">R</span>;
    default:
      return <span className="w-4 h-4 rounded text-[9px] font-bold font-mono bg-zinc-800 text-zinc-400 flex items-center justify-center">?</span>;
  }
};

export const WorkspaceDrawer: React.FC = () => {
  const {
    workspacePath,
    isWorkspaceDrawerOpen,
    toggleWorkspaceDrawer,
    workspaceTree,
    isLoadingTree,
    loadWorkspaceTree,
    openWorkspaceInExplorer,
    selectWorkspaceDialog,
    openFilePreview,
    gitStatus,
    gitCommits,
    isLoadingGit,
    loadGitData,
    openGitDiff,
    closeGitDiff,
    activeGitDiff,
    initGitRepo,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<'files' | 'git'>('files');
  const [filter, setFilter] = useState('');

  if (!isWorkspaceDrawerOpen) return null;

  const folderName = workspacePath ? workspacePath.split(/[/\\]/).pop() || workspacePath : 'No Workspace';
  const changeCount = gitStatus?.changes?.length || 0;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm sm:max-w-md bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ease-out animate-in slide-in-from-right">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-950/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 text-amber-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-zinc-100 truncate font-mono">
                {folderName}
              </h3>
              <p
                className="text-[10px] text-zinc-400 truncate font-mono"
                title={workspacePath || undefined}
              >
                {workspacePath || 'No folder connected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                loadWorkspaceTree();
                loadGitData();
              }}
              disabled={isLoadingTree || isLoadingGit || !workspacePath}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              title="Refresh Workspace & Git"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingTree || isLoadingGit ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openWorkspaceInExplorer()}
              disabled={!workspacePath}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              title="Open Folder in OS File Explorer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleWorkspaceDrawer}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Close Workspace Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Change folder button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selectWorkspaceDialog()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white text-[11px] font-medium border border-zinc-700/60 transition-colors"
          >
            <FolderOpen className="w-3 h-3 text-amber-400" />
            <span>Change Workspace Folder</span>
          </button>
        </div>

        {/* Segmented Control (Apple HIG Desktop Design) */}
        {workspacePath && (
          <div className="grid grid-cols-2 p-0.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`flex items-center justify-center gap-1.5 py-1 rounded-md transition-all ${
                activeTab === 'files'
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('git')}
              className={`flex items-center justify-center gap-1.5 py-1 rounded-md transition-all ${
                activeTab === 'git'
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-amber-400" />
              <span>Changes</span>
              {changeCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {changeCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Filter search (Only on files tab) */}
        {workspacePath && activeTab === 'files' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter files & folders..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors font-mono"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="absolute right-2 top-1.5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        {!workspacePath ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-zinc-500">
            <FolderOpen className="w-8 h-8 mb-2 opacity-40 text-amber-400" />
            <p className="text-xs font-medium text-zinc-300 mb-1">No Workspace Connected</p>
            <p className="text-[11px] text-zinc-500 mb-4 max-w-xs">
              Select a project folder to allow the AI to read, edit, write files, and run commands.
            </p>
            <button
              type="button"
              onClick={() => selectWorkspaceDialog()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Select Folder</span>
            </button>
          </div>
        ) : activeTab === 'files' ? (
          isLoadingTree ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-xs">Scanning workspace files...</span>
            </div>
          ) : workspaceTree?.tree ? (
            <TreeNodeView
              node={workspaceTree.tree}
              depth={0}
              filter={filter}
              onSelectFile={(rp) => openFilePreview(rp)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-4 text-center">
              <Layers className="w-6 h-6 mb-2 opacity-40" />
              <p className="text-xs">No files found in workspace</p>
            </div>
          )
        ) : (
          /* Git Tab Content */
          <div className="space-y-4 p-1">
            {/* Git Branch & Status Header */}
            <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-mono font-semibold text-zinc-200 truncate">
                  {gitStatus?.branch || 'HEAD'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {gitStatus?.isRepo ? (
                  changeCount === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Clean
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <AlertCircle className="w-3 h-3" />
                      {changeCount} Changed
                    </span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => initGitRepo()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Init Git Repo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Working Tree Changes */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileDiff className="w-3.5 h-3.5 text-zinc-500" />
                  Working Changes ({changeCount})
                </span>
                {changeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => openGitDiff()}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-mono hover:underline"
                  >
                    View All Diffs
                  </button>
                )}
              </div>

              {changeCount === 0 ? (
                <div className="p-4 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-center text-zinc-500 text-xs">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500/60" />
                  <p>Working tree clean. No uncommitted changes.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {gitStatus?.changes.map((change) => (
                    <div
                      key={change.path}
                      onClick={() => openGitDiff(change.path)}
                      className="group flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        {getStatusBadge(change.status)}
                        <span className="text-xs font-mono text-zinc-300 group-hover:text-white truncate">
                          {change.path}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 group-hover:text-blue-400 font-mono transition-colors">
                        diff
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Commits */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5 pt-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-zinc-500" />
                  Recent Commits ({gitCommits.length})
                </span>
              </div>

              {gitCommits.length === 0 ? (
                <div className="p-4 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-center text-zinc-500 text-xs">
                  <GitCommit className="w-5 h-5 mx-auto mb-1 opacity-40" />
                  <p>No commits recorded in this workspace yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {gitCommits.map((c) => (
                    <div
                      key={c.hash}
                      className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex flex-col gap-1 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                            {c.hash}
                          </span>
                          {c.isAgent ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              <Bot className="w-3 h-3 text-purple-400" />
                              Agent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                              <User className="w-3 h-3 text-zinc-400" />
                              {c.author}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">{c.date}</span>
                      </div>
                      <p className="text-xs text-zinc-200 font-sans line-clamp-2 leading-relaxed">
                        {c.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {workspaceTree && activeTab === 'files' && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="font-mono">
            {workspaceTree.totalFiles} files, {workspaceTree.totalDirs} directories
          </span>
          <button
            type="button"
            onClick={toggleWorkspaceDrawer}
            className="text-[10px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Diff Preview Modal / Overlay */}
      {activeGitDiff && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileDiff className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-semibold text-zinc-200 truncate">
                  {activeGitDiff.path || 'Working Tree Git Diff'}
                </span>
              </div>
              <button
                type="button"
                onClick={closeGitDiff}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-zinc-950/90 font-mono text-xs">
              {activeGitDiff.diff ? (
                <pre className="space-y-0.5 whitespace-pre-wrap leading-5">
                  {activeGitDiff.diff.split('\n').map((line, idx) => {
                    let colorClass = 'text-zinc-400';
                    if (line.startsWith('+') && !line.startsWith('+++')) {
                      colorClass = 'text-emerald-400 bg-emerald-950/40 px-1 rounded-sm block';
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                      colorClass = 'text-rose-400 bg-rose-950/40 px-1 rounded-sm block';
                    } else if (line.startsWith('@@')) {
                      colorClass = 'text-cyan-400 bg-cyan-950/20 px-1 rounded-sm block font-bold';
                    } else if (line.startsWith('diff --git')) {
                      colorClass = 'text-yellow-400 font-bold block pt-2 border-t border-zinc-800 mt-2';
                    }
                    return (
                      <span key={idx} className={colorClass}>
                        {line}
                      </span>
                    );
                  })}
                </pre>
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  <p>No textual differences to display.</p>
                </div>
              )}
            </div>
            <div className="p-2 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                type="button"
                onClick={closeGitDiff}
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
