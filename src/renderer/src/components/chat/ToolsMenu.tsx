import React, { useState, useRef, useEffect } from 'react';
import {
  Wrench,
  Globe,
  FileCode,
  FileText,
  Sparkles,
  Check,
  X,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { AVAILABLE_TOOLS, ToolItem } from '@shared/tools';

interface ToolsMenuProps {
  disabled?: boolean;
}

export const ToolsMenu: React.FC<ToolsMenuProps> = ({ disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    enabledToolIds,
    toggleTool,
    enableAllTools,
    disableAllTools,
    isToolEnabled,
  } = useChatStore();

  const enabledCount = enabledToolIds.length;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const renderToolIcon = (iconName: string, isEnabled: boolean) => {
    const iconClass = 'w-4 h-4 shrink-0';
    switch (iconName) {
      case 'globe':
        return <Globe className={`${iconClass} ${isEnabled ? 'text-sky-400' : 'text-muted-foreground'}`} />;
      case 'file-code':
        return <FileCode className={`${iconClass} ${isEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />;
      case 'file-text':
        return <FileText className={`${iconClass} ${isEnabled ? 'text-rose-400' : 'text-muted-foreground'}`} />;
      case 'terminal':
        return <Terminal className={`${iconClass} ${isEnabled ? 'text-amber-400' : 'text-muted-foreground'}`} />;
      default:
        return <Wrench className={`${iconClass} ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />;
    }
  };

  const getToolIconBg = (category: string, isEnabled: boolean) => {
    if (!isEnabled) return 'bg-muted/40 border-border/40';
    switch (category) {
      case 'web':
        return 'bg-sky-500/10 border-sky-500/30 shadow-sky-500/10 shadow-sm';
      case 'filesystem':
        return 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10 shadow-sm';
      case 'export':
        return 'bg-rose-500/10 border-rose-500/30 shadow-rose-500/10 shadow-sm';
      default:
        return 'bg-primary/10 border-primary/30 shadow-sm';
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button in Composer Toolbar */}
      <button
        id="tools-menu-trigger-button"
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={
          enabledCount > 0
            ? `${enabledCount} tool${enabledCount === 1 ? '' : 's'} active (click to configure)`
            : 'Configure AI Tools & Functions'
        }
        className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all select-none ${
          enabledCount > 0
            ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm hover:bg-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
      >
        <Wrench className={`w-3.5 h-3.5 ${enabledCount > 0 ? 'text-primary' : ''}`} />
        <span>Tools</span>
        {enabledCount > 0 && (
          <span className="flex items-center justify-center min-w-[17px] h-4 px-1 rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold shadow-sm">
            {enabledCount}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-foreground' : ''
          }`}
        />
      </button>

      {/* Popover Menu Anchored Above Trigger */}
      {isOpen && (
        <div
          id="tools-menu-popover"
          role="dialog"
          aria-label="AI Tools & Capabilities"
          className="absolute bottom-full left-0 mb-2 w-80 sm:w-96 bg-popover/95 text-popover-foreground border border-border/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-border/60">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground tracking-tight">
                  AI Tools & Capabilities
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Allow model to invoke external tools
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={enableAllTools}
                className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Enable all tools"
              >
                All
              </button>
              <button
                type="button"
                onClick={disableAllTools}
                className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Disable all tools"
              >
                None
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
                aria-label="Close tools menu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tools List */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
            {AVAILABLE_TOOLS.map((tool: ToolItem) => {
              const isEnabled = isToolEnabled(tool.id);

              return (
                <div
                  key={tool.id}
                  id={`tool-item-${tool.id}`}
                  onClick={() => toggleTool(tool.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                    isEnabled
                      ? 'bg-secondary/40 border-primary/30 shadow-sm'
                      : 'bg-card/40 border-border/50 hover:bg-secondary/20 hover:border-border opacity-75 hover:opacity-100'
                  }`}
                >
                  {/* Tool Icon Box */}
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${getToolIconBg(
                      tool.category,
                      isEnabled
                    )}`}
                  >
                    {renderToolIcon(tool.icon, isEnabled)}
                  </div>

                  {/* Tool Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {tool.name}
                      </span>
                      {tool.badge && (
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold ${
                            tool.badge === 'Active'
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25'
                              : tool.badge === 'Ready'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-1.5">
                      {tool.description}
                    </p>

                    {/* Function Micro-Pills */}
                    <div className="flex flex-wrap gap-1">
                      {tool.functionNames.map((fn) => (
                        <span
                          key={fn}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40"
                        >
                          {fn}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`Toggle ${tool.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTool(tool.id);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-primary' : 'bg-muted/80'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {enabledCount} of {AVAILABLE_TOOLS.length} active
            </span>
            <span>
              {enabledCount === 0 ? 'Pure conversation mode' : 'Function calling enabled'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
