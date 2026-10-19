import React, { useState } from 'react';
import { Check, Copy, Code2, Eye, Sparkles } from 'lucide-react';
import { isArtifactPreviewable, getArtifactType } from '../../utils/artifact-utils';
import { ArtifactPreview } from './ArtifactPreview';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);
  const previewable = isArtifactPreviewable(language, value);
  const artifactType = getArtifactType(language, value);

  // Default to live preview for previewable artifacts, otherwise code
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>(
    previewable ? 'preview' : 'code'
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-border bg-zinc-950 shadow-sm">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-border text-xs select-none">
        {/* Left: Language & Artifact Tabs */}
        <div className="flex items-center space-x-2.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
            {language || 'text'}
          </span>

          {previewable && artifactType && (
            <div className="flex items-center bg-zinc-800/80 p-0.5 rounded-md border border-zinc-700/60">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  activeTab === 'preview'
                    ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="View live interactive artifact preview"
              >
                <Eye className="w-3 h-3 text-emerald-400" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  activeTab === 'code'
                    ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="View raw code source"
              >
                <Code2 className="w-3 h-3" />
                <span>Code</span>
              </button>
            </div>
          )}

          {previewable && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Artifact</span>
            </span>
          )}
        </div>

        {/* Right: Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-[11px] font-mono"
          title="Copy code"
          aria-label="Copy Code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content: Either Sandboxed Preview or Code Highlighting */}
      {previewable && artifactType && activeTab === 'preview' ? (
        <ArtifactPreview
          code={value}
          artifactType={artifactType}
          title={`${(language || artifactType).toUpperCase()} Artifact`}
        />
      ) : (
        <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono text-zinc-200 selection:bg-zinc-800">
          <code>{value}</code>
        </pre>
      )}
    </div>
  );
};
