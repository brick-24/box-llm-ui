import React, { useRef, useEffect, useState } from 'react';
import {
  Cpu,
  Sliders,
  Download,
  ChevronDown,
  Search,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useProviderStore } from '../../store/useProviderStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { WelcomeScreen } from './WelcomeScreen';
import { AttachmentModal } from './AttachmentModal';

const formatTokensCompact = (tok: number): string => {
  if (tok >= 1000000) return `${(tok / 1000000).toFixed(tok % 1000000 === 0 ? 0 : 1)}M`;
  if (tok >= 1000) return `${(tok / 1000).toFixed(tok % 1000 === 0 ? 0 : 1)}K`;
  return `${tok}`;
};

export const ChatArea: React.FC = () => {
  const {
    messages,
    activeConversation,
    updateConversation,
    sendMessage,
    isStreaming,
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

  const handleSelectModel = (mId: string) => {
    if (activeConversation) {
      updateConversation({ id: activeConversation.id, modelId: mId });
    }
    setIsModelPickerOpen(false);
  };

  const handleApplyCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (customModelInput.trim() && activeConversation) {
      updateConversation({ id: activeConversation.id, modelId: customModelInput.trim() });
      setCustomModelInput('');
      setIsModelPickerOpen(false);
    }
  };

  const filteredModels = models.filter((m) =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
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
                  onChange={(e) => setActiveProvider(e.target.value)}
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
                {filteredModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectModel(m.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between ${
                      m.id === currentModel
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="truncate font-mono text-[11px]">{m.name || m.id}</span>
                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                      {m.contextLength ? (
                        <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                          {formatTokensCompact(m.contextLength)} ctx
                        </span>
                      ) : null}
                      {m.id === currentModel && (
                        <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                      )}
                    </div>
                  </button>
                ))}

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
                T: {activeConversation?.temperature ?? 0.7} • {formatTokensCompact(activeConversation?.maxTokens ?? 4096)} tok
              </span>
            </button>

            {showTempSlider && (
              <div className="absolute right-0 top-11 w-72 bg-popover text-popover-foreground border border-border rounded-xl p-3 shadow-xl z-40 animate-in fade-in duration-150 space-y-3">
                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between text-xs text-foreground mb-1.5">
                    <span className="font-medium">Temperature</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                      {activeConversation?.temperature ?? 0.7}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={activeConversation?.temperature ?? 0.7}
                    onChange={(e) => {
                      if (activeConversation) {
                        updateConversation({
                          id: activeConversation.id,
                          temperature: parseFloat(e.target.value),
                        });
                      }
                    }}
                    className="w-full accent-foreground cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 font-mono">
                    <span>0.0 (Precise)</span>
                    <span>1.5 (Creative)</span>
                  </div>
                </div>

                {/* Max Output Tokens */}
                <div className="pt-2.5 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-foreground mb-1.5">
                    <span className="font-medium">Max Output Tokens</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                      {formatTokensCompact(activeConversation?.maxTokens ?? 4096)} ({(activeConversation?.maxTokens ?? 4096).toLocaleString()})
                    </span>
                  </div>
                  <input
                    type="number"
                    min="128"
                    max="1048576"
                    step="512"
                    value={activeConversation?.maxTokens ?? 4096}
                    onChange={(e) => {
                      if (activeConversation) {
                        updateConversation({
                          id: activeConversation.id,
                          maxTokens: parseInt(e.target.value) || 4096,
                        });
                      }
                    }}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground font-mono outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[2048, 4096, 8192, 16384, 32768, 65536, 131072, 1048576].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => {
                          if (activeConversation) {
                            updateConversation({ id: activeConversation.id, maxTokens: tok });
                          }
                        }}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                          (activeConversation?.maxTokens ?? 4096) === tok
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
                onEditAndResend={(newContent) => sendMessage(newContent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer Area at Bottom */}
      <MessageComposer />

      {/* Modal for viewing full attachment text & chunks */}
      <AttachmentModal />
    </div>
  );
};
