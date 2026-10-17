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
        className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
          isActive
            ? 'bg-secondary text-secondary-foreground font-medium border border-border shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent'
        }`}
      >
        <div className="flex items-center space-x-2.5 truncate flex-1 min-w-0 mr-1">
          {conv.isPinned ? (
            <Pin className="w-3.5 h-3.5 text-foreground shrink-0 fill-foreground/20" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-foreground" />
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
                className="w-full bg-background border border-ring rounded px-2 py-0.5 text-xs text-foreground outline-none"
              />
              <button type="submit" className="p-0.5 text-foreground hover:opacity-80">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="p-0.5 text-muted-foreground hover:text-foreground"
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
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Options"
              aria-label="Conversation Options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                className="absolute right-0 top-7 w-36 bg-popover text-popover-foreground border border-border rounded-lg shadow-md py-1 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => handleTogglePin(conv, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent flex items-center space-x-2 transition-colors"
                >
                  <Pin className="w-3 h-3 text-muted-foreground" />
                  <span>{conv.isPinned ? 'Unpin' : 'Pin to top'}</span>
                </button>
                <button
                  onClick={(e) => handleStartRename(conv, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent flex items-center space-x-2 transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={(e) => handleExportMarkdown(conv.id, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent flex items-center space-x-2 transition-colors"
                >
                  <Download className="w-3 h-3 text-muted-foreground" />
                  <span>Export .md</span>
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 flex items-center space-x-2 transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
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
        <div className="px-3 pb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5">{items.map(renderConversationItem)}</div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-14 bg-background border-r border-border flex flex-col items-center py-3 justify-between select-none">
        <div className="flex flex-col items-center space-y-3">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Expand Sidebar"
            aria-label="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => createConversation()}
            className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all"
            title="New Chat (Ctrl+N)"
            aria-label="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center space-y-2">
          <button
            onClick={() => openSettings('providers')}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col h-full select-none shrink-0 transition-all">
      {/* Top action area: New Chat & Collapse */}
      <div className="p-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <button
            onClick={() => createConversation()}
            className="flex-1 flex items-center justify-between py-2 px-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex items-center space-x-2">
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </div>
            <kbd className="text-[10px] font-mono bg-primary-foreground/15 text-primary-foreground px-1.5 py-0.5 rounded">
              Ctrl+N
            </kbd>
          </button>

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-transparent hover:border-border"
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input styled like shadcn command input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchVal}
            onChange={handleSearchChange}
            className="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-8 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
          />
          {searchVal ? (
            <button
              onClick={() => {
                setSearchVal('');
                search('');
              }}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              aria-label="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="absolute right-2 text-[10px] font-mono text-muted-foreground bg-background border border-border px-1 py-0.2 rounded pointer-events-none">
              ⌘K
            </span>
          )}
        </div>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {grouped.pinned.length > 0 && renderSection('Pinned', grouped.pinned)}
        {grouped.today.length > 0 && renderSection('Today', grouped.today)}
        {grouped.yesterday.length > 0 && renderSection('Yesterday', grouped.yesterday)}
        {grouped.lastWeek.length > 0 && renderSection('Previous 7 Days', grouped.lastWeek)}
        {grouped.older.length > 0 && renderSection('Older', grouped.older)}

        {conversations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60 stroke-1" />
            <p>No conversations yet.</p>
          </div>
        )}
      </div>

      {/* Bottom status & settings area */}
      <div className="p-3 border-t border-border bg-background space-y-2">
        {/* Active Provider Badge */}
        <div
          onClick={() => openSettings('providers')}
          className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border hover:bg-secondary cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-2 truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${activeProvider?.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-xs text-foreground font-medium truncate">
              {activeProvider ? activeProvider.name : 'Configure Provider'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono bg-background border border-border px-1.5 py-0.5 rounded">
            {activeProvider?.protocol === 'custom-json' ? 'JSON' : 'OpenAI'}
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={() => openSettings()}
          className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-xs font-medium"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span>Settings & Diagnostics</span>
        </button>
      </div>
    </aside>
  );
};
