import React, { useRef, useEffect, useState } from 'react';
import {
  Cpu,
  Sliders,
  Download,
  Trash2,
  ChevronDown,
  Sparkles,
  Search,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useProviderStore } from '../../store/useProviderStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { WelcomeScreen } from './WelcomeScreen';
import { AttachmentModal } from './AttachmentModal';

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
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden relative">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md px-4 flex items-center justify-between select-none z-20 shrink-0">
        {/* Model Selector Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-700 text-xs text-zinc-200 transition-all shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5 text-violet-400" />
            <span className="font-semibold text-zinc-100 max-w-[180px] sm:max-w-[280px] truncate">
              {currentModel}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Model Selector Modal / Popover */}
          {isModelPickerOpen && (
            <div className="absolute left-0 top-10 w-72 sm:w-80 bg-zinc-900 border border-zinc-750 rounded-2xl shadow-2xl p-3 z-40 animate-in fade-in duration-150">
              {/* Provider Quick Switch */}
              <div className="mb-2">
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                  Provider
                </label>
                <select
                  value={activeProvider?.id || ''}
                  onChange={(e) => setActiveProvider(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
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
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search discovered models..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 outline-none"
                />
              </div>

              {/* Model list */}
              <div className="max-h-48 overflow-y-auto space-y-1 my-1">
                {filteredModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectModel(m.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      m.id === currentModel
                        ? 'bg-violet-600/20 text-violet-300 font-semibold'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="truncate">{m.name || m.id}</span>
                    {m.id === currentModel && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    )}
                  </button>
                ))}

                {filteredModels.length === 0 && (
                  <div className="text-center py-4 text-xs text-zinc-500">
                    No models found. Enter a custom model ID below or click Fetch in Settings.
                  </div>
                )}
              </div>

              {/* Manual Model ID fallback */}
              <form onSubmit={handleApplyCustomModel} className="mt-2 pt-2 border-t border-zinc-800 flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Enter custom model ID..."
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-medium"
                >
                  Set
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center space-x-2">
          {/* Temperature Quick Pill */}
          <div className="relative">
            <button
              onClick={() => setShowTempSlider(!showTempSlider)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
              title="Adjust Generation Temperature"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Temp: {activeConversation?.temperature ?? 0.7}</span>
            </button>

            {showTempSlider && (
              <div className="absolute right-0 top-10 w-48 bg-zinc-900 border border-zinc-750 rounded-xl p-3 shadow-xl z-40">
                <div className="flex items-center justify-between text-xs text-zinc-300 mb-2">
                  <span>Temperature</span>
                  <span className="font-mono">{activeConversation?.temperature ?? 0.7}</span>
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
                  className="w-full accent-violet-500"
                />
              </div>
            )}
          </div>

          {/* Export Markdown */}
          {activeConversation && (
            <button
              onClick={() => window.electronAPI?.exportMarkdown(activeConversation.id)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Export Conversation as Markdown"
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
