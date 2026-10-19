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
  RefreshCw,
  Download,
  Upload,
  Shield,
  AlertTriangle,
  RotateCcw,
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
  const [isResetting, setIsResetting] = useState(false);

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

  const handleResetAllData = async () => {
    if (!window.electronAPI) return;
    const confirmed = confirm(
      '⚠️ FACTORY RESET WARNING\n\n' +
      'Are you sure you want to clear all data?\n\n' +
      'This will permanently delete:\n' +
      '• All conversations and message histories\n' +
      '• All configured API keys and custom providers\n' +
      '• All diagnostic logs\n\n' +
      'The application will be restored to clean factory defaults with fresh presets.\n\n' +
      'Do you wish to proceed?'
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const res = await window.electronAPI.resetAllData();
      if (res.success) {
        alert('All local database records and API keys have been cleared. The application will now reload.');
        window.location.reload();
      } else {
        alert(`Failed to reset data: ${res.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error during reset: ${e?.message || e}`);
    } finally {
      setIsResetting(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border w-full max-w-4xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Application Settings</h2>
              <p className="text-xs text-muted-foreground">Configure universal providers, defaults, and diagnostics</p>
            </div>
          </div>

          <button
            onClick={closeSettings}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted/10 px-6 select-none overflow-x-auto gap-2 py-1">
          <button
            onClick={() => {
              openSettings('providers');
              setIsCreatingNew(false);
              setEditingProvider(null);
            }}
            className={`flex items-center space-x-2 py-2 px-3 border-b-2 text-xs font-medium transition-colors shrink-0 ${
              activeTab === 'providers'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Providers</span>
          </button>

          <button
            onClick={() => openSettings('general')}
            className={`flex items-center space-x-2 py-2 px-3 border-b-2 text-xs font-medium transition-colors shrink-0 ${
              activeTab === 'general'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General</span>
          </button>

          <button
            onClick={() => openSettings('generation')}
            className={`flex items-center space-x-2 py-2 px-3 border-b-2 text-xs font-medium transition-colors shrink-0 ${
              activeTab === 'generation'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Defaults & Generation</span>
          </button>

          <button
            onClick={() => openSettings('diagnostics')}
            className={`flex items-center space-x-2 py-2 px-3 border-b-2 text-xs font-medium transition-colors shrink-0 ${
              activeTab === 'diagnostics'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics & Logs</span>
          </button>

          <button
            onClick={() => openSettings('backup')}
            className={`flex items-center space-x-2 py-2 px-3 border-b-2 text-xs font-medium transition-colors shrink-0 ${
              activeTab === 'backup'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Data & Backup</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
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
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Configured Universal Providers
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Connect any OpenAI-compatible, Responses, or Custom JSON endpoint
                      </p>
                    </div>

                    <button
                      onClick={() => setIsCreatingNew(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shadow-sm"
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
                          className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                            isActive
                              ? 'bg-secondary/40 border-foreground/40 shadow-sm'
                              : 'bg-card border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <div className="flex items-center space-x-3 truncate flex-1 min-w-0 mr-3">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                p.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              title={p.isConfigured ? 'Configured' : 'Missing API Key'}
                            />

                            <div className="truncate">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-foreground text-xs truncate">
                                  {p.name}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] bg-secondary text-foreground border border-border px-1.5 py-0.5 rounded font-mono">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate font-mono">
                                {p.baseUrl} • {p.protocol}
                              </p>
                            </div>
                          </div>

                          {/* Action controls */}
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {!isActive && (
                              <button
                                onClick={() => setActiveProvider(p.id)}
                                className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border transition-colors"
                              >
                                Activate
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingProvider(p);
                                setIsCreatingNew(false);
                              }}
                              className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border transition-colors"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDuplicate(p)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors"
                              title="Duplicate provider"
                              aria-label="Duplicate Provider"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary border border-transparent hover:border-border transition-colors"
                              title="Delete provider"
                              aria-label="Delete Provider"
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
                <label className="block mb-1.5 font-semibold text-foreground uppercase tracking-wider">
                  Interface Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['dark', 'light', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateSettings({ theme: t })}
                      className={`py-2 px-3 rounded-lg border text-center font-medium capitalize text-xs transition-all ${
                        settings.theme === t
                          ? 'bg-secondary border-ring text-foreground font-semibold shadow-sm'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-semibold text-foreground uppercase tracking-wider">
                  Font Size
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['sm', 'md', 'lg'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ fontSize: s })}
                      className={`py-2 px-3 rounded-lg border text-center font-medium capitalize text-xs transition-all ${
                        settings.fontSize === s
                          ? 'bg-secondary border-ring text-foreground font-semibold shadow-sm'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s === 'sm' ? 'Compact (13px)' : s === 'md' ? 'Default (14px)' : 'Comfort (15px)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-semibold text-foreground uppercase tracking-wider">
                  Message Sending Shortcut
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2.5 p-3 rounded-lg bg-card border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="sendKey"
                      checked={settings.sendOnEnter}
                      onChange={() => updateSettings({ sendOnEnter: true })}
                      className="accent-foreground"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">Enter to Send</span>
                      <span className="text-[11px] text-muted-foreground">Shift+Enter creates a new line</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 p-3 rounded-lg bg-card border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="sendKey"
                      checked={!settings.sendOnEnter}
                      onChange={() => updateSettings({ sendOnEnter: false })}
                      className="accent-foreground"
                    />
                    <div>
                      <span className="font-semibold text-foreground block">Ctrl+Enter / Cmd+Enter to Send</span>
                      <span className="text-[11px] text-muted-foreground">Enter creates a new line</span>
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
                <label className="block mb-1 font-semibold text-foreground uppercase tracking-wider">
                  Default System Instructions
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Applied to new conversations unless overridden per conversation
                </p>
                <textarea
                  rows={4}
                  value={settings.defaultSystemPrompt}
                  onChange={(e) => updateSettings({ defaultSystemPrompt: e.target.value })}
                  className="w-full bg-card border border-border rounded-lg p-3 text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-semibold text-foreground">
                    Default Temperature: <span className="font-mono text-muted-foreground">{settings.defaultTemperature}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={settings.defaultTemperature}
                    onChange={(e) => updateSettings({ defaultTemperature: parseFloat(e.target.value) })}
                    className="w-full accent-foreground cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Precise (0.0)</span>
                    <span>Balanced (0.7)</span>
                    <span>Creative (1.5)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-foreground">
                      Default Max Output Tokens
                    </label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {settings.defaultMaxTokens >= 1000000
                        ? `${(settings.defaultMaxTokens / 1000000).toFixed(0)}M`
                        : `${Math.round(settings.defaultMaxTokens / 1000)}K`} tokens
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Baseline generation ceiling. In chat, controls dynamically adapt to each model's maximum allowed output tokens (e.g. 8K for Claude, 16K for GPT-4o, 65K for Gemini).
                  </p>
                  <input
                    type="number"
                    min="128"
                    max="1048576"
                    step="512"
                    value={settings.defaultMaxTokens}
                    onChange={(e) => updateSettings({ defaultMaxTokens: parseInt(e.target.value) || 4096 })}
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[2048, 4096, 8192, 16384, 32768, 65536, 131072, 1048576].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => updateSettings({ defaultMaxTokens: tok })}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                          settings.defaultMaxTokens === tok
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'bg-secondary text-muted-foreground hover:text-foreground border-border'
                        }`}
                      >
                        {tok >= 1000000 ? `${tok / 1000000}M` : `${tok / 1000}K`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-foreground">
                    Context Warning Limit (Tokens)
                  </label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {settings.contextWarningLimit >= 1000000
                      ? `${(settings.contextWarningLimit / 1000000).toFixed(1)}M`
                      : `${Math.round(settings.contextWarningLimit / 1000)}K`} limit
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Warns in the composer when attached documents exceed this token estimate (supports up to 1M+ context models)
                </p>
                <input
                  type="number"
                  min="1000"
                  max="2000000"
                  step="10000"
                  value={settings.contextWarningLimit}
                  onChange={(e) => updateSettings({ contextWarningLimit: parseInt(e.target.value) || 200000 })}
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[32000, 128000, 200000, 500000, 1000000, 2000000].map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      onClick={() => updateSettings({ contextWarningLimit: limit })}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        settings.contextWarningLimit === limit
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-secondary text-muted-foreground hover:text-foreground border-border'
                      }`}
                    >
                      {limit >= 1000000 ? `${limit / 1000000}M` : `${limit / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTICS & LOGS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Diagnostic Event Logs
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Real-time inspection of API requests, streaming chunks, and security redactions
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={fetchDiagnostics}
                    disabled={isLoadingDiagnostics}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground border border-border transition-colors font-medium"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagnostics ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleClearDiagnostics}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-destructive/10 text-destructive border border-border transition-colors font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-card max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-secondary/50 border-b border-border text-muted-foreground font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Time</th>
                      <th className="py-2.5 px-2 font-medium">Level</th>
                      <th className="py-2.5 px-2 font-medium">Category</th>
                      <th className="py-2.5 px-3 font-medium">Message</th>
                      <th className="py-2.5 px-2 text-right font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                    {diagnostics.map((log) => (
                      <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                              log.level === 'error'
                                ? 'bg-destructive/15 text-destructive border border-destructive/30'
                                : log.level === 'warn'
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                : 'bg-secondary text-foreground border border-border'
                            }`}
                          >
                            {log.level}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground uppercase">{log.category}</td>
                        <td className="py-2 px-3 text-foreground font-sans">{log.message}</td>
                        <td className="py-2 px-2 text-right">
                          {log.details && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
                                setCopiedLogId(log.id);
                                setTimeout(() => setCopiedLogId(null), 1500);
                              }}
                              className="px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground border border-border text-[10px]"
                            >
                              {copiedLogId === log.id ? 'Copied' : 'JSON'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {diagnostics.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground font-sans">
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
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Local Conversation Backup & Restore
                </h3>
                <p className="text-muted-foreground mb-4">
                  Export complete chat history, provider configurations, and settings to a JSON archive, or restore from a previous backup.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => window.electronAPI?.exportJson()}
                    className="flex items-center space-x-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Conversations (JSON)</span>
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
                    className="flex items-center space-x-2 px-4 py-2 rounded-md bg-secondary hover:bg-accent text-secondary-foreground font-medium text-xs border border-border transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import JSON Backup</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                <div className="flex items-center space-x-2 text-foreground font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>Security & Local Storage</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Your chat history and providers are stored locally in SQLite (`universal-llm.sqlite`). All API credentials are encrypted with your operating system's native keychain (via Electron `safeStorage`).
                </p>
              </div>

              {/* DANGER ZONE: FACTORY RESET */}
              <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 space-y-3">
                <div className="flex items-center space-x-2 text-destructive font-semibold">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span>Danger Zone: Factory Reset</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Permanently erase all local SQLite databases, conversation histories, custom settings, and encrypted API credentials. Restores the application to fresh out-of-the-box defaults. Ideal for wiping test data before packaging or distributing an installer.
                </p>
                <button
                  onClick={handleResetAllData}
                  disabled={isResetting}
                  className="flex items-center space-x-2 px-4 py-2 rounded-md bg-destructive text-destructive-foreground font-medium text-xs hover:bg-destructive/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Resetting All Data...' : 'Reset to Factory Defaults'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
