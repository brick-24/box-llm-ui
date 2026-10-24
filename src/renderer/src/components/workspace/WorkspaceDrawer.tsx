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
} from 'lucide-react';
import { WorkspaceTreeNode } from '@shared/types';
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
  const [isOpen, setIsOpen] = useState(depth < 2);

  const isDir = node.type === 'directory';
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

        {!isDir && node.size !== undefined && (
          <span className="text-[10px] text-zinc-500 font-mono hidden group-hover:inline flex-shrink-0">
            {formatFileSize(node.size)}
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
  } = useChatStore();

  const [filter, setFilter] = useState('');

  if (!isWorkspaceDrawerOpen) return null;

  const folderName = workspacePath ? workspacePath.split(/[/\\]/).pop() || workspacePath : 'No Workspace';

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm sm:max-w-md bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ease-out animate-in slide-in-from-right">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-950/70 flex flex-col gap-2">
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
              onClick={() => loadWorkspaceTree()}
              disabled={isLoadingTree || !workspacePath}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              title="Refresh File Tree"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
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
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => selectWorkspaceDialog()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white text-[11px] font-medium border border-zinc-700/60 transition-colors"
          >
            <FolderOpen className="w-3 h-3 text-amber-400" />
            <span>Change Workspace Folder</span>
          </button>
        </div>

        {/* Filter search */}
        {workspacePath && (
          <div className="relative mt-1">
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

      {/* Tree Content */}
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
        ) : isLoadingTree ? (
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
        )}
      </div>

      {/* Footer Summary */}
      {workspaceTree && (
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
    </div>
  );
};
