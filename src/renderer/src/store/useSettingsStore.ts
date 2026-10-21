import { create } from 'zustand';
import { AppSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';

interface SettingsState {
  settings: AppSettings;
  isSettingsOpen: boolean;
  activeTab: 'providers' | 'general' | 'generation' | 'web' | 'diagnostics' | 'backup';
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  openSettings: (tab?: 'providers' | 'general' | 'generation' | 'web' | 'diagnostics' | 'backup') => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isSettingsOpen: false,
  activeTab: 'providers',

  loadSettings: async () => {
    try {
      if (window.electronAPI) {
        const loaded = await window.electronAPI.getSettings();
        set({ settings: loaded });
        applyTheme(loaded.theme);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },

  updateSettings: async (newSettings) => {
    const current = get().settings;
    const merged: AppSettings = { ...current, ...newSettings };
    set({ settings: merged });
    applyTheme(merged.theme);
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(merged);
    }
  },

  openSettings: (tab = 'providers') => {
    set({ isSettingsOpen: true, activeTab: tab });
  },

  closeSettings: () => {
    set({ isSettingsOpen: false });
  },
}));

function applyTheme(theme: 'dark' | 'light' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  } else if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
