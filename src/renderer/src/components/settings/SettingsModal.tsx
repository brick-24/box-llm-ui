import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Sliders,
  SlidersHorizontal,
  Activity,
  Database,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Download,
  Upload,
  Shield,
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProviderStore } from '../../store/useProviderStore';
import { ProviderForm } from './ProviderForm';
import { ProviderConfig, DiagnosticLog } from '@shared/types';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings, activeTab, openSettings, settings, updateSettings } =
    useSettingsStore();

  const { providers, activeProviderId, setActiveProvider, deleteProvider, loadProviders } =
    useProviderStore();

  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticLog[]>([]);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (isSettingsOpen && activeTab === 'diagnostics') {
      fetchDiagnostics();
    }
  }, [isSettingsOpen, activeTab]);

  const fetchDiagnostics = async () => {
    if (!window.electronAPI) return;
    setIsLoadingDiagnostics(true);
    try {
      const logs = await window.electronAPI.getDiagnostics();
      setDiagnostics(logs);
    } catch (e) {
      console.error('Failed to load diagnostics:', e);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleClearDiagnostics = async () => {
    if (window.electronAPI) {
      await window.electronAPI.clearDiagnostics();
      setDiagnostics([]);
    }
  };

  const handleDuplicate = (p: ProviderConfig) => {
    const duplicated: ProviderConfig = {
      ...p,
      id: crypto.randomUUID(),
      name: `${p.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingProvider(duplicated);
    setIsCreatingNew(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete provider "${name}"?`)) {
      deleteProvider(id);
      if (editingProvider?.id === id) {
        setEditingProvider(null);
      }
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-750 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/70 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Application Settings</h2>
              <p className="text-xs text-zinc-400">Configure universal providers, defaults, and diagnostics</p>
            </div>
          </div>

          <button
            onClick={closeSettings}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-6 select-none overflow-x-auto">
          <button
            onClick={() => {
              openSettings('providers');
              setIsCreatingNew(false);
              setEditingProvider(null);
            }}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'providers'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Providers</span>
          </button>

          <button
            onClick={() => openSettings('general')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'general'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General</span>
          </button>

          <button
            onClick={() => openSettings('generation')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'generation'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Defaults & Generation</span>
          </button>

          <button
            onClick={() => openSettings('diagnostics')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'diagnostics'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics & Logs</span>
          </button>

          <button
            onClick={() => openSettings('backup')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors shrink-0 ${
              activeTab === 'backup'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Data & Backup</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/20">
          {/* TAB 1: PROVIDERS */}
          {activeTab === 'providers' && (
            <div>
              {isCreatingNew || editingProvider ? (
                <ProviderForm
                  initialConfig={editingProvider || undefined}
                  onSaved={() => {
                    setIsCreatingNew(false);
                    setEditingProvider(null);
                    loadProviders();
                  }}
                  onCancel={() => {
                    setIsCreatingNew(false);
                    setEditingProvider(null);
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Configured Universal Providers
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Connect any OpenAI-compatible, Responses, or Custom JSON endpoint
                      </p>
                    </div>

                    <button
                      onClick={() => setIsCreatingNew(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/30 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Provider</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {providers.map((p) => {
                      const isActive = p.id === activeProviderId;
                      return (
                        <div
                          key={p.id}
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            isActive
                              ? 'bg-zinc-900 border-violet-500/60 shadow-md shadow-violet-500/10'
                              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center space-x-3 truncate flex-1 min-w-0 mr-3">
                            <div
                              className={`w-3 h-3 rounded-full shrink-0 ${
                                p.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              title={p.isConfigured ? 'Configured' : 'Missing API Key'}
                            />

                            <div className="truncate">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-zinc-100 text-xs truncate">
                                  {p.name}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded font-medium">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate font-mono">
                                {p.baseUrl} • {p.protocol}
                              </p>
                            </div>
                          </div>

                          {/* Action controls */}
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {!isActive && (
                              <button
                                onClick={() => setActiveProvider(p.id)}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white text-xs transition-colors"
                              >
                                Activate
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingProvider(p);
                                setIsCreatingNew(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs transition-colors"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDuplicate(p)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                              title="Duplicate provider"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                              title="Delete provider"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GENERAL */}
          {activeTab === 'general' && (
            <div className="max-w-xl space-y-6 text-xs">
              <div>
                <label className="block mb-1.5 font-bold text-zinc-200 uppercase tracking-wider">
                  Interface Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['dark', 'light', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateSettings({ theme: t })}
                      className={`py-2 px-3 rounded-xl border text-center font-medium capitalize transition-all ${
                        settings.theme === t
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-semibold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-zinc-200 uppercase tracking-wider">
                  Font Size
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['sm', 'md', 'lg'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ fontSize: s })}
                      className={`py-2 px-3 rounded-xl border text-center font-medium capitalize transition-all ${
                        settings.fontSize === s
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-semibold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {s === 'sm' ? 'Compact (13px)' : s === 'md' ? 'Default (14px)' : 'Comfort (15px)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-zinc-200 uppercase tracking-wider">
                  Message Sending Shortcut
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="sendKey"
                      checked={settings.sendOnEnter}
                      onChange={() => updateSettings({ sendOnEnter: true })}
                      className="accent-violet-500"
                    />
                    <div>
                      <span className="font-semibold text-zinc-200 block">Enter to Send</span>
                      <span className="text-[11px] text-zinc-400">Shift+Enter creates a new line</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="sendKey"
                      checked={!settings.sendOnEnter}
                      onChange={() => updateSettings({ sendOnEnter: false })}
                      className="accent-violet-500"
                    />
                    <div>
                      <span className="font-semibold text-zinc-200 block">Ctrl+Enter / Cmd+Enter to Send</span>
                      <span className="text-[11px] text-zinc-400">Enter creates a new line</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEFAULTS & GENERATION */}
          {activeTab === 'generation' && (
            <div className="max-w-xl space-y-6 text-xs">
              <div>
                <label className="block mb-1 font-bold text-zinc-200 uppercase tracking-wider">
                  Default System Instructions
                </label>
                <p className="text-[11px] text-zinc-400 mb-2">
                  Applied to new conversations unless overridden per conversation
                </p>
                <textarea
                  rows={4}
                  value={settings.defaultSystemPrompt}
                  onChange={(e) => updateSettings({ defaultSystemPrompt: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-violet-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-semibold text-zinc-300">
                    Default Temperature: {settings.defaultTemperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={settings.defaultTemperature}
                    onChange={(e) => updateSettings({ defaultTemperature: parseFloat(e.target.value) })}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                    <span>Precise (0.0)</span>
                    <span>Balanced (0.7)</span>
                    <span>Creative (1.5)</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-zinc-300">
                    Default Max Output Tokens
                  </label>
                  <input
                    type="number"
                    value={settings.defaultMaxTokens}
                    onChange={(e) => updateSettings({ defaultMaxTokens: parseInt(e.target.value) || 4096 })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-zinc-300">
                  Context Warning Limit (Tokens)
                </label>
                <p className="text-[11px] text-zinc-400 mb-2">
                  Warns when attached documents exceed this token estimate
                </p>
                <input
                  type="number"
                  value={settings.contextWarningLimit}
                  onChange={(e) => updateSettings({ contextWarningLimit: parseInt(e.target.value) || 32000 })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & LOGS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Diagnostic Event Logs
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Inspecting real-time API requests, streaming chunks, and security redactions
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={fetchDiagnostics}
                    disabled={isLoadingDiagnostics}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagnostics ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleClearDiagnostics}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/60 max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-2">Level</th>
                      <th className="py-2.5 px-2">Category</th>
                      <th className="py-2.5 px-3">Message</th>
                      <th className="py-2.5 px-2 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                    {diagnostics.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-800/40">
                        <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                              log.level === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : log.level === 'warn'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-violet-500/20 text-violet-300'
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-zinc-400 uppercase">{log.category}</td>
                        <td className="py-2 px-3 text-zinc-200 font-sans">{log.message}</td>
                        <td className="py-2 px-2 text-right">
                          {log.details && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
                                setCopiedLogId(log.id);
                                setTimeout(() => setCopiedLogId(null), 1500);
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px]"
                            >
                              {copiedLogId === log.id ? 'Copied' : 'JSON'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {diagnostics.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500 font-sans">
                          No diagnostic logs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: DATA & BACKUP */}
          {activeTab === 'backup' && (
            <div className="max-w-xl space-y-6 text-xs">
              <div>
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-1">
                  Local Conversation Backup & Restore
                </h3>
                <p className="text-zinc-400 mb-4">
                  Export your complete chat history, provider configurations, and settings to a JSON archive, or restore from a previous backup.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => window.electronAPI?.exportJson()}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all shadow-md shadow-violet-600/30"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export All Conversations (JSON)</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (window.electronAPI) {
                        const res = await window.electronAPI.importJson();
                        if (res.success) {
                          alert(`Successfully imported ${res.importedConversations} conversations and ${res.importedMessages} messages!`);
                          window.location.reload();
                        }
                      }
                    }}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import JSON Backup</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex items-center space-x-2 text-violet-400 font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>Security & Local Storage</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  Your chat history and providers are stored locally in SQLite (`universal-llm.sqlite`). All API credentials are encrypted with your operating system's native keychain (via Electron `safeStorage`).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
