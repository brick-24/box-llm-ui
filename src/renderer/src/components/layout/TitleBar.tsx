import React from 'react';
import { Minus, Square, X, Sparkles, Cpu } from 'lucide-react';
import { useProviderStore } from '../../store/useProviderStore';
import { useChatStore } from '../../store/useChatStore';

export const TitleBar: React.FC = () => {
  const { activeProvider } = useProviderStore();
  const { activeConversation } = useChatStore();

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  const currentModel = activeConversation?.modelId || activeProvider?.defaultModel || 'No Model Selected';

  return (
    <div className="h-10 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between px-3 select-none drag-region z-50 backdrop-blur-md">
      {/* Brand & Title */}
      <div className="flex items-center space-x-2.5">
        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-sm shadow-violet-500/20">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-semibold tracking-wide text-zinc-200">Universal LLM</span>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">v1.0</span>
      </div>

      {/* Center Model Indicator */}
      <div className="hidden sm:flex items-center space-x-1.5 text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded-full border border-zinc-800/60 no-drag">
        <Cpu className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-zinc-300 font-medium truncate max-w-[220px]">{currentModel}</span>
        {activeProvider && (
          <span className="text-[10px] text-zinc-500 font-mono">({activeProvider.name})</span>
        )}
      </div>

      {/* Window Controls */}
      <div className="flex items-center space-x-1 no-drag">
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-red-600/90 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
