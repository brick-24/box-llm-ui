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
  const { activeConversation } = useChatStore();
  const { openSettings } = useSettingsStore();

  const isConfigured = activeProvider?.isConfigured;
  const currentModel = activeConversation?.modelId || activeProvider?.defaultModel || 'Default Model';

  const getSuggestionIcon = (iconName: string) => {
    switch (iconName) {
      case 'code':
        return <Code2 className="w-5 h-5 text-violet-400" />;
      case 'file-text':
        return <FileSearch className="w-5 h-5 text-sky-400" />;
      case 'bug':
        return <Wrench className="w-5 h-5 text-amber-400" />;
      case 'pen-tool':
        return <FileSignature className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-violet-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full select-none animate-in fade-in duration-300">
      {/* Hero Badge */}
      <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6 shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span>Universal LLM Desktop Client</span>
      </div>

      {/* Hero Title */}
      <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 tracking-tight text-center mb-3">
        Connect Any LLM. Ask Anything.
      </h1>

      <p className="text-sm text-zinc-400 text-center max-w-lg mb-8 leading-relaxed">
        Upload documents, stream markdown responses, and talk to your favorite OpenAI-compatible or custom AI models locally and securely.
      </p>

      {/* Current Model Status Pill */}
      <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 mb-8 shadow-sm">
        <Cpu className="w-4 h-4 text-violet-400" />
        <span className="font-semibold text-zinc-200">{currentModel}</span>
        {activeProvider && (
          <span className="text-zinc-500 font-mono">({activeProvider.name})</span>
        )}
      </div>

      {/* Unconfigured Warning Card */}
      {!isConfigured && (
        <div className="w-full max-w-md p-4 mb-8 rounded-2xl bg-gradient-to-b from-amber-500/10 to-zinc-900 border border-amber-500/30 shadow-lg text-left">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-amber-200 mb-1">
                API Connection Required
              </h3>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Add an API key or connect to your local Ollama / LM Studio endpoint to begin chatting.
              </p>
              <button
                onClick={() => openSettings('providers')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors shadow-sm"
              >
                <span>Configure Providers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Prompt Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {WELCOME_SUGGESTIONS.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="group p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-violet-500/40 cursor-pointer transition-all shadow-sm flex flex-col justify-between text-left"
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-xl bg-zinc-800/80 group-hover:bg-zinc-800 transition-colors">
                {getSuggestionIcon(item.icon)}
              </div>
              <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-violet-300 transition-colors">
                {item.title}
              </h4>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
              {item.prompt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
