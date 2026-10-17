import React, { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { SettingsModal } from './components/settings/SettingsModal';
import { useSettingsStore } from './store/useSettingsStore';
import { useProviderStore } from './store/useProviderStore';
import { useChatStore } from './store/useChatStore';

export const App: React.FC = () => {
  const { loadSettings, openSettings } = useSettingsStore();
  const { loadProviders } = useProviderStore();
  const { init, createConversation } = useChatStore();

  useEffect(() => {
    // Initialize application stores
    loadSettings();
    loadProviders();
    init();

    // Global keyboard shortcuts
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        createConversation();
      }
      // Ctrl+, or Cmd+,: Open Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }
      // Ctrl+. or Cmd+.: Focus message composer typing box
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-composer'));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans">
      {/* Sleek Custom TitleBar */}
      <TitleBar />

      {/* Main App Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <ChatArea />
      </div>

      {/* Global Modals */}
      <SettingsModal />
    </div>
  );
};
