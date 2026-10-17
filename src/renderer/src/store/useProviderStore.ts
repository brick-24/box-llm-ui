import { create } from 'zustand';
import { ProviderConfig, ModelInfo, ConnectionTestResult } from '@shared/types';

interface ProviderWithStatus extends ProviderConfig {
  isConfigured: boolean;
}

interface ProviderState {
  providers: ProviderWithStatus[];
  activeProviderId: string | null;
  activeProvider: ProviderWithStatus | null;
  models: ModelInfo[];
  isLoadingModels: boolean;
  modelsError: string | null;
  testResult: ConnectionTestResult | null;
  isTesting: boolean;

  loadProviders: () => Promise<void>;
  setActiveProvider: (id: string) => void;
  saveProvider: (config: ProviderConfig) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  testProvider: (config: ProviderConfig) => Promise<ConnectionTestResult>;
  fetchModelsForProvider: (config: ProviderConfig) => Promise<ModelInfo[]>;
  clearTestResult: () => void;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  activeProviderId: null,
  activeProvider: null,
  models: [],
  isLoadingModels: false,
  modelsError: null,
  testResult: null,
  isTesting: false,

  loadProviders: async () => {
    try {
      if (window.electronAPI) {
        const list = await window.electronAPI.getProviders();
        const activeId = get().activeProviderId || (list.length > 0 ? list[0].id : null);
        const active = list.find((p) => p.id === activeId) || list[0] || null;

        set({
          providers: list,
          activeProviderId: active ? active.id : null,
          activeProvider: active,
        });

        if (active) {
          get().fetchModelsForProvider(active);
        }
      }
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  },

  setActiveProvider: (id: string) => {
    const found = get().providers.find((p) => p.id === id) || null;
    set({ activeProviderId: id, activeProvider: found, models: [] });
    if (found) {
      get().fetchModelsForProvider(found);
    }
  },

  saveProvider: async (config: ProviderConfig) => {
    if (window.electronAPI) {
      await window.electronAPI.saveProvider(config);
      await get().loadProviders();
    }
  },

  deleteProvider: async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteProvider(id);
      await get().loadProviders();
    }
  },

  testProvider: async (config: ProviderConfig) => {
    set({ isTesting: true, testResult: null });
    try {
      if (window.electronAPI) {
        const res = await window.electronAPI.testProvider(config);
        set({ testResult: res, isTesting: false });
        return res;
      }
      throw new Error('Electron API unavailable');
    } catch (e: any) {
      const failRes: ConnectionTestResult = {
        success: false,
        message: e.message || 'Connection test failed',
        latencyMs: 0,
      };
      set({ testResult: failRes, isTesting: false });
      return failRes;
    }
  },

  fetchModelsForProvider: async (config: ProviderConfig) => {
    set({ isLoadingModels: true, modelsError: null });
    try {
      if (window.electronAPI) {
        const fetched: ModelInfo[] = await window.electronAPI.fetchModels(config);
        set({ models: fetched, isLoadingModels: false });
        return fetched;
      }
      return [];
    } catch (e: any) {
      set({ modelsError: e.message || 'Failed to fetch models', isLoadingModels: false });
      return [];
    }
  },

  clearTestResult: () => {
    set({ testResult: null });
  },
}));
