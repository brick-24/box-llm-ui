import React, { useRef, useEffect, useState } from 'react';
import {
  Cpu,
  Sliders,
  Download,
  ChevronDown,
  Search,
  Sparkles,
  FolderOpen,
  Folder,
  FolderTree,
  X,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useProviderStore } from '../../store/useProviderStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { WelcomeScreen } from './WelcomeScreen';
import { AttachmentModal } from './AttachmentModal';
import { WebBrowserDrawer } from './WebBrowserDrawer';
import { WorkspaceDrawer } from '../workspace/WorkspaceDrawer';
import { FilePreviewModal } from '../workspace/FilePreviewModal';
import {
  resolveModelLimits,
  getModelQuickTokenStops,
  clampOutputTokens,
  formatTokensCompact,
} from '@shared/model-limits';

export const ChatArea: React.FC = () => {
  const {
    messages,
    siblingsMap,
    switchBranch,
    editAndBranchMessage,
    regenerateMessage,
    activeConversation,
    updateConversation,
    sendMessage,
    isStreaming,
    workspacePath,
    isWorkspaceDrawerOpen,
    toggleWorkspaceDrawer,
    selectWorkspaceDialog,
    setWorkspacePath,
  } = useChatStore();

  const { providers, activeProvider, models, setActiveProvider } = useProviderStore();
  const { openSettings } = useSettingsStore();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [showTempSlider, setShowTempSlider] = useState(false);

  // Auto scroll to bottom during streaming or message addition
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const currentModel =
    activeConversation?.modelId || activeProvider?.defaultModel || 'No Model Selected';

  // Resolve capability and limit specs for current model
  const activeModelInfo = models.find((m) => m.id === currentModel);
  const activeLimits = resolveModelLimits(currentModel, {
    contextLength: activeModelInfo?.contextLength,
    maxOutputTokens: activeModelInfo?.maxOutputTokens,
    defaultOutputTokens: activeModelInfo?.defaultOutputTokens,
  });

  const currentMaxTokens = clampOutputTokens(
    activeConversation?.maxTokens ?? activeLimits.defaultOutputTokens,
    activeLimits.maxOutputTokens
  );

  const quickTokenStops = getModelQuickTokenStops(activeLimits.maxOutputTokens);

  const handleSelectModel = (mId: string) => {
    if (activeConversation) {
      const targetModelInfo = models.find((m) => m.id === mId);
      const targetLimits = resolveModelLimits(mId, {
        contextLength: targetModelInfo?.contextLength,
        maxOutputTokens: targetModelInfo?.maxOutputTokens,
        defaultOutputTokens: targetModelInfo?.defaultOutputTokens,
      });

      // Auto-clamp or adjust maxTokens if existing maxTokens exceeds new model's limit
      let adjustedMaxTokens = activeConversation.maxTokens;
      if (adjustedMaxTokens && adjustedMaxTokens > targetLimits.maxOutputTokens) {
        adjustedMaxTokens = targetLimits.maxOutputTokens;
      }

      updateConversation({
        id: activeConversation.id,
        providerId: activeProvider?.id || activeConversation.providerId,
        modelId: mId,
        maxTokens: adjustedMaxTokens,
      });
    }
    setIsModelPickerOpen(false);
  };

  const handleApplyCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelInput.trim() && activeConversation) {
      const customId = customModelInput.trim();
      const targetLimits = resolveModelLimits(customId);
      let adjustedMaxTokens = activeConversation.maxTokens;
      if (adjustedMaxTokens && adjustedMaxTokens > targetLimits.maxOutputTokens) {
        adjustedMaxTokens = targetLimits.maxOutputTokens;
      }
      updateConversation({
        id: activeConversation.id,
        providerId: activeProvider?.id || activeConversation.providerId,
        modelId: customId,
        maxTokens: adjustedMaxTokens,
      });
      setCustomModelInput('');
      setIsModelPickerOpen(false);
    }
  };

  const filteredModels = models.filter((m) =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.name?.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-border bg-background/80 backdrop-blur-md px-4 flex items-center justify-between select-none z-20 shrink-0">
        {/* Model Selector Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-xs text-foreground transition-all shadow-sm font-medium"
            aria-expanded={isModelPickerOpen}
            aria-label="Select Model"
          >
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium font-mono text-[11px] text-foreground max-w-[180px] sm:max-w-[280px] truncate">
              {currentModel}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {/* Model Selector Modal / Popover */}
          {isModelPickerOpen && (
            <div className="absolute left-0 top-11 w-72 sm:w-80 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-3 z-40 animate-in fade-in duration-150">
              {/* Provider Quick Switch */}
              <div className="mb-2">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Active Provider
                </label>
                <select
                  value={activeProvider?.id || ''}
                  onChange={(e) => {
                    const newProvId = e.target.value;
                    setActiveProvider(newProvId);
                    const targetProv = providers.find((p) => p.id === newProvId);
                    if (activeConversation && targetProv) {
                      updateConversation({
                        id: activeConversation.id,
                        providerId: newProvId,
                        modelId: targetProv.defaultModel || activeConversation.modelId,
                      });
                    }
                  }}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.protocol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Model Search Input */}
              <div className="relative my-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter discovered models..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Model list */}
              <div className="max-h-48 overflow-y-auto space-y-1 my-1">
                {filteredModels.map((m) => {
                  const mLimits = resolveModelLimits(m.id, {
                    contextLength: m.contextLength,
                    maxOutputTokens: m.maxOutputTokens,
                  });
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between ${
                        m.id === currentModel
                          ? 'bg-secondary text-secondary-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <span className="truncate font-mono text-[11px]" title={m.name || m.id}>
                        {m.name || m.id}
                      </span>
                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        <span
                          className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border"
                          title={`Context Window (Input Tokens): ${mLimits.contextLength.toLocaleString()}`}
                        >
                          {formatTokensCompact(mLimits.contextLength)} in
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border"
                          title={`Max Output Tokens: ${mLimits.maxOutputTokens.toLocaleString()}`}
                        >
                          {formatTokensCompact(mLimits.maxOutputTokens)} out
                        </span>
                        {m.id === currentModel && (
                          <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredModels.length === 0 && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    No models found. Enter a custom model ID below or click Fetch in Settings.
                  </div>
                )}
              </div>

              {/* Manual Model ID fallback */}
              <form onSubmit={handleApplyCustomModel} className="mt-2 pt-2 border-t border-border flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Custom model ID..."
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring font-mono text-[11px]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-md bg-secondary hover:bg-accent text-xs text-secondary-foreground font-medium border border-border"
                >
                  Set
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center space-x-2">
          {/* Parameters Quick Pill */}
          <div className="relative">
            <button
              onClick={() => setShowTempSlider(!showTempSlider)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs transition-colors"
              title="Adjust Generation Parameters"
              aria-label="Generation Parameters"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">
                T: {activeLimits.isReasoning ? '1.0' : (activeConversation?.temperature ?? 0.7)} • {formatTokensCompact(currentMaxTokens)} tok
              </span>
            </button>

            {showTempSlider && (
              <div className="absolute right-0 top-11 w-80 bg-popover text-popover-foreground border border-border rounded-xl p-3.5 shadow-xl z-40 animate-in fade-in duration-150 space-y-3">
                {/* Active Model Specs Card */}
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span className="truncate max-w-[190px]" title={currentModel}>
                      {activeModelInfo?.name || currentModel}
                    </span>
                    {activeLimits.isReasoning && (
                      <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-mono">
                        Reasoning
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <span className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground" title="Input Context Window">
                      {formatTokensCompact(activeLimits.contextLength)} context (in)
                    </span>
                    <span className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground" title="Hardware / API Max Output Ceiling">
                      {formatTokensCompact(activeLimits.maxOutputTokens)} max (out)
                    </span>
                  </div>
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between text-xs text-foreground mb-1.5">
                    <span className="font-medium">Temperature</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                      {activeLimits.isReasoning ? '1.0 (Fixed)' : (activeConversation?.temperature ?? 0.7)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    disabled={activeLimits.isReasoning}
                    value={activeLimits.isReasoning ? 1.0 : (activeConversation?.temperature ?? 0.7)}
                    onChange={(e) => {
                      if (activeConversation) {
                        updateConversation({
                          id: activeConversation.id,
                          temperature: parseFloat(e.target.value),
                        });
                      }
                    }}
                    className={`w-full accent-foreground ${activeLimits.isReasoning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 font-mono">
                    <span>0.0 (Precise)</span>
                    <span>1.5 (Creative)</span>
                  </div>
                </div>

                {/* Max Output Tokens - Sliders & Inputs Adapted to Model Ceiling */}
                <div className="pt-2.5 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-xs text-foreground">
                    <span className="font-medium">Max Output Tokens</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                      {formatTokensCompact(currentMaxTokens)} ({currentMaxTokens.toLocaleString()})
                    </span>
                  </div>

                  {/* Range Slider dynamically bounded by model max output limit */}
                  <input
                    type="range"
                    min="128"
                    max={activeLimits.maxOutputTokens}
                    step={activeLimits.maxOutputTokens <= 4096 ? 128 : (activeLimits.maxOutputTokens <= 16384 ? 256 : 512)}
                    value={currentMaxTokens}
                    onChange={(e) => {
                      if (activeConversation) {
                        updateConversation({
                          id: activeConversation.id,
                          maxTokens: parseInt(e.target.value) || activeLimits.defaultOutputTokens,
                        });
                      }
                    }}
                    className="w-full accent-foreground cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>128</span>
                    <span>Model Max: {formatTokensCompact(activeLimits.maxOutputTokens)}</span>
                  </div>

                  {/* Numeric Input */}
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      min="128"
                      max={activeLimits.maxOutputTokens}
                      step="256"
                      value={currentMaxTokens}
                      onChange={(e) => {
                        if (activeConversation) {
                          const val = parseInt(e.target.value);
                          updateConversation({
                            id: activeConversation.id,
                            maxTokens: isNaN(val) ? activeLimits.defaultOutputTokens : clampOutputTokens(val, activeLimits.maxOutputTokens),
                          });
                        }
                      }}
                      className="flex-1 bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-mono outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (activeConversation) {
                          updateConversation({
                            id: activeConversation.id,
                            maxTokens: activeLimits.defaultOutputTokens,
                          });
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-[10px] font-mono border border-border transition-colors"
                      title="Reset to recommended model default"
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeConversation) {
                          updateConversation({
                            id: activeConversation.id,
                            maxTokens: activeLimits.maxOutputTokens,
                          });
                        }
                      }}
                      className="px-2 py-1 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-[10px] font-mono border border-border transition-colors"
                      title="Set to model maximum output ceiling"
                    >
                      Max
                    </button>
                  </div>

                  {/* Adaptive Quick Stops */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {quickTokenStops.map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => {
                          if (activeConversation) {
                            updateConversation({ id: activeConversation.id, maxTokens: tok });
                          }
                        }}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                          currentMaxTokens === tok
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'bg-secondary text-muted-foreground hover:text-foreground border-border'
                        }`}
                      >
                        {formatTokensCompact(tok)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Workspace Button / Badge */}
          {workspacePath ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 border border-border text-xs text-foreground shadow-sm">
              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span
                className="font-mono text-[11px] font-medium max-w-[120px] sm:max-w-[160px] truncate"
                title={workspacePath}
              >
                {workspacePath.split(/[/\\]/).pop() || workspacePath}
              </span>
              <button
                type="button"
                onClick={toggleWorkspaceDrawer}
                className={`p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${
                  isWorkspaceDrawerOpen ? 'bg-secondary text-primary font-semibold' : ''
                }`}
                title="Toggle Workspace File Tree"
              >
                <FolderTree className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setWorkspacePath(null)}
                className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-secondary transition-colors"
                title="Disconnect Workspace"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={selectWorkspaceDialog}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/30 hover:bg-secondary border border-dashed border-border hover:border-border text-xs text-muted-foreground hover:text-foreground transition-all shadow-sm"
              title="Open a local folder to pair program with autonomous coding tools"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400/80" />
              <span className="text-[11px] font-medium hidden sm:inline">Workspace</span>
            </button>
          )}

          {/* Export Markdown */}
          {activeConversation && (
            <button
              onClick={() => window.electronAPI?.exportMarkdown(activeConversation.id)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-colors"
              title="Export Conversation as Markdown"
              aria-label="Export Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col scroll-smooth">
        {messages.length === 0 ? (
          <WelcomeScreen onSelectPrompt={(p) => sendMessage(p)} />
        ) : (
          <div className="py-2">
            {messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                siblingInfo={siblingsMap.get(msg.id)}
                onSwitchBranch={(dir) => switchBranch(msg.id, dir)}
                onEditAndBranch={(newContent) => editAndBranchMessage(msg.id, newContent)}
                onRegenerate={() => regenerateMessage(msg.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer Area at Bottom */}
      <MessageComposer />

      {/* Modal for viewing full attachment text & chunks */}
      <AttachmentModal />

      {/* Slide-over Web Browser Drawer */}
      <WebBrowserDrawer />

      {/* Slide-over Workspace File Tree Drawer */}
      <WorkspaceDrawer />

      {/* File Preview Modal */}
      <FilePreviewModal />
    </div>
  );
};
