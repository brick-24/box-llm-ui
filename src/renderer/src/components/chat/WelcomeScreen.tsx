import React from 'react';
import {
  Sparkles,
  Cpu,
  Key,
  ArrowRight,
  Code2,
  FileSearch,
  Wrench,
  FileSignature,
  FolderOpen,
  Folder,
} from 'lucide-react';
import { useProviderStore } from '../../store/useProviderStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useChatStore } from '../../store/useChatStore';
import { WELCOME_SUGGESTIONS } from '@shared/constants';

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectPrompt }) => {
  const { activeProvider } = useProviderStore();
  const {
    activeConversation,
    workspacePath,
    toggleWorkspaceDrawer,
    selectWorkspaceDialog,
  } = useChatStore();
  const { openSettings } = useSettingsStore();

  const isConfigured = activeProvider?.isConfigured;
  const currentModel = activeConversation?.modelId || activeProvider?.defaultModel || 'Default Model';

  const getSuggestionIcon = (iconName: string) => {
    switch (iconName) {
      case 'code':
        return <Code2 className="w-4 h-4 text-foreground" />;
      case 'file-text':
        return <FileSearch className="w-4 h-4 text-foreground" />;
      case 'bug':
        return <Wrench className="w-4 h-4 text-foreground" />;
      case 'pen-tool':
        return <FileSignature className="w-4 h-4 text-foreground" />;
      default:
        return <Sparkles className="w-4 h-4 text-foreground" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full select-none animate-in fade-in duration-200">
      {/* Hero Pill Badge */}
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-secondary border border-border text-foreground text-xs font-medium mb-5 shadow-sm hover:border-muted-foreground/30 transition-colors">
        <Sparkles className="w-3.5 h-3.5 text-foreground" />
        <span>Universal LLM Desktop Client</span>
        <span className="text-muted-foreground">→</span>
      </div>

      {/* Hero Title with Geist -0.035em tracking */}
      <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.035em] text-center mb-3">
        Connect Any LLM. Ask Anything.
      </h1>

      <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-lg mb-6 leading-relaxed">
        Upload documents, stream markdown with LaTeX, and query OpenAI-compatible or custom AI models with complete privacy and local storage.
      </p>

      {/* Status Pills: Model + Workspace */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-secondary/50 border border-border text-xs text-foreground shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold font-mono text-[11px]">{currentModel}</span>
          {activeProvider && (
            <span className="text-muted-foreground font-mono text-[11px]">({activeProvider.name})</span>
          )}
        </div>

        {workspacePath ? (
          <button
            type="button"
            onClick={toggleWorkspaceDrawer}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary border border-border text-xs text-foreground shadow-sm transition-colors cursor-pointer"
            title="Inspect Workspace File Tree"
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px] font-medium max-w-[140px] truncate">
              {workspacePath.split(/[/\\]/).pop() || workspacePath}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={selectWorkspaceDialog}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-secondary/30 hover:bg-secondary border border-dashed border-border hover:border-border text-xs text-muted-foreground hover:text-foreground shadow-sm transition-all cursor-pointer"
            title="Open a project directory to enable agentic coding tools"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400/80" />
            <span className="text-[11px]">Open Workspace</span>
          </button>
        )}
      </div>

      {/* Connection Notice Card if unconfigured */}
      {!isConfigured && (
        <div className="w-full max-w-md p-4 mb-8 rounded-xl bg-card border border-border shadow-sm text-left">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-secondary text-foreground shrink-0 border border-border">
              <Key className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-foreground mb-1">
                API Connection Required
              </h3>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Connect your OpenAI / OpenRouter API key or point to local Ollama to begin chatting.
              </p>
              <button
                onClick={() => openSettings('providers')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                <span>Configure Providers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bento Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {WELCOME_SUGGESTIONS.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="group p-4 rounded-xl bg-card hover:bg-secondary/40 border border-border hover:border-muted-foreground/30 cursor-pointer transition-all shadow-sm flex flex-col justify-between text-left"
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-lg bg-secondary border border-border/80 group-hover:bg-background transition-colors">
                {getSuggestionIcon(item.icon)}
              </div>
              <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.prompt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
