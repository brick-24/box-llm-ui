import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

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
    <div className="relative my-3 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/90 shadow-md">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 text-xs text-zinc-400 select-none">
        <span className="font-mono text-[11px] uppercase tracking-wider text-violet-400 font-semibold">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-[11px]"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono text-zinc-200">
        <code>{value}</code>
      </pre>
    </div>
  );
};
