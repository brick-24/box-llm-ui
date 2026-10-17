import React from 'react';
import { Minus, Square, X, Cpu } from 'lucide-react';
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
    <div className="h-10 bg-background/95 border-b border-border flex items-center justify-between px-3 select-none drag-region z-50 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/* Brand Lockup */}
      <div className="flex items-center space-x-2.5">
        <div className="w-5 h-5 rounded-md bg-foreground text-background flex items-center justify-center font-bold shadow-sm">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-semibold tracking-tight text-foreground">universal<span className="text-muted-foreground font-normal">/</span>llm</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">v1.0</span>
        </div>
      </div>

      {/* Center Model Indicator */}
      <div className="hidden sm:flex items-center space-x-2 text-xs text-muted-foreground bg-secondary/50 hover:bg-secondary px-3 py-1 rounded-full border border-border no-drag transition-colors">
        <span className={`w-1.5 h-1.5 rounded-full ${activeProvider?.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <Cpu className="w-3.5 h-3.5 text-foreground/70" />
        <span className="text-foreground font-medium font-mono text-[11px] truncate max-w-[220px]">{currentModel}</span>
        {activeProvider && (
          <span className="text-[10px] text-muted-foreground font-mono">({activeProvider.name})</span>
        )}
      </div>

      {/* Window Controls */}
      <div className="flex items-center space-x-1 no-drag">
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Minimize"
          aria-label="Minimize Window"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Maximize"
          aria-label="Maximize Window"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive-foreground hover:bg-destructive transition-colors"
          title="Close"
          aria-label="Close Window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
