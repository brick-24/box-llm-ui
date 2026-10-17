import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Download,
  Edit2,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProviderStore } from '../../store/useProviderStore';
import { Conversation } from '@shared/types';

interface GroupedConversations {
  pinned: Conversation[];
  today: Conversation[];
  yesterday: Conversation[];
  lastWeek: Conversation[];
  older: Conversation[];
}

export const Sidebar: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    search,
  } = useChatStore();

  const { openSettings } = useSettingsStore();
  const { activeProvider } = useProviderStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const grouped = useMemo<GroupedConversations>(() => {
    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const lastWeek: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    for (const c of conversations) {
      if (c.isPinned) {
        pinned.push(c);
      } else if (c.updatedAt >= todayStart) {
        today.push(c);
      } else if (c.updatedAt >= yesterdayStart) {
        yesterday.push(c);
      } else if (c.updatedAt >= weekStart) {
        lastWeek.push(c);
      } else {
        older.push(c);
      }
    }

    return { pinned, today, yesterday, lastWeek, older };
  }, [conversations]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchVal(val);
    search(val);
  };

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      updateConversation({ id, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const handleTogglePin = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    updateConversation({ id: conv.id, isPinned: !conv.isPinned });
    setMenuOpenId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this conversation? This cannot be undone.')) {
      deleteConversation(id);
    }
    setMenuOpenId(null);
  };

  const handleExportMarkdown = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (window.electronAPI) {
      await window.electronAPI.exportMarkdown(id);
    }
  };

  const renderConversationItem = (conv: Conversation) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = conv.id === editingId;
    const isMenuOpen = conv.id === menuOpenId;

    return (
      <div
        key={conv.id}
        onClick={() => selectConversation(conv.id)}
        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
          isActive
            ? 'bg-zinc-800/90 text-zinc-100 font-medium shadow-sm border border-zinc-700/60'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
        }`}
      >
        <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0 mr-1">
          {conv.isPinned ? (
            <Pin className="w-3.5 h-3.5 text-violet-400 shrink-0 fill-violet-400/20" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0 group-hover:text-zinc-400" />
          )}

          {isEditing ? (
            <form
              onSubmit={(e) => handleSaveRename(conv.id, e)}
              className="flex items-center space-x-1 flex-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="w-full bg-zinc-950 border border-violet-500 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none"
              />
              <button type="submit" className="p-0.5 text-emerald-400 hover:text-emerald-300">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="p-0.5 text-zinc-400 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <span className="truncate">{conv.title}</span>
          )}
        </div>

        {/* Action button overlay on hover */}
        {!isEditing && (
          <div className="relative shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : conv.id);
              }}
              className="p-1 rounded hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200"
              title="Options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                className="absolute right-0 top-7 w-36 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => handleTogglePin(conv, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center space-x-2"
                >
                  <Pin className="w-3 h-3 text-zinc-400" />
                  <span>{conv.isPinned ? 'Unpin' : 'Pin to top'}</span>
                </button>
                <button
                  onClick={(e) => handleStartRename(conv, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center space-x-2"
                >
                  <Edit2 className="w-3 h-3 text-zinc-400" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={(e) => handleExportMarkdown(conv.id, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center space-x-2"
                >
                  <Download className="w-3 h-3 text-zinc-400" />
                  <span>Export .md</span>
                </button>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center space-x-2"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="px-3 pb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5">{items.map(renderConversationItem)}</div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-14 bg-zinc-950 border-r border-zinc-850 flex flex-col items-center py-3 justify-between select-none">
        <div className="flex flex-col items-center space-y-3">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => createConversation()}
            className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-600/30 transition-all"
            title="New Chat (Ctrl+N)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center space-y-2">
          <button
            onClick={() => openSettings('providers')}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full select-none shrink-0 transition-all">
      {/* Top action area: New Chat & Collapse */}
      <div className="p-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => createConversation()}
            className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold border border-zinc-700/60 hover:border-violet-500/50 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 text-violet-400" />
            <span>New Chat</span>
            <kbd className="ml-auto text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
              Ctrl+N
            </kbd>
          </button>

          <button
            onClick={() => setIsCollapsed(true)}
            className="ml-2 p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchVal}
            onChange={handleSearchChange}
            className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-violet-500/70 transition-colors"
          />
          {searchVal && (
            <button
              onClick={() => {
                setSearchVal('');
                search('');
              }}
              className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scroll-smooth">
        {grouped.pinned.length > 0 && renderSection('Pinned', grouped.pinned)}
        {grouped.today.length > 0 && renderSection('Today', grouped.today)}
        {grouped.yesterday.length > 0 && renderSection('Yesterday', grouped.yesterday)}
        {grouped.lastWeek.length > 0 && renderSection('Previous 7 Days', grouped.lastWeek)}
        {grouped.older.length > 0 && renderSection('Older', grouped.older)}

        {conversations.length === 0 && (
          <div className="text-center py-8 text-zinc-400 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
            <p>No conversations yet.</p>
          </div>
        )}
      </div>

      {/* Bottom status & settings area */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 space-y-2">
        {/* Active Provider Badge */}
        <div
          onClick={() => openSettings('providers')}
          className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700 cursor-pointer transition-all"
        >
          <div className="flex items-center space-x-2 truncate">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-xs text-zinc-300 font-medium truncate">
              {activeProvider ? activeProvider.name : 'Configure Provider'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {activeProvider?.protocol === 'custom-json' ? 'JSON' : 'OpenAI'}
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={() => openSettings()}
          className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 transition-colors text-xs font-medium"
        >
          <Settings className="w-4 h-4 text-zinc-400" />
          <span>Settings & Diagnostics</span>
        </button>
      </div>
    </aside>
  );
};
