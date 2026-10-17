import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Sparkles, ChevronDown } from 'lucide-react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [showThinking, setShowThinking] = useState(false);

  // Extract <think>...</think> if present
  let thought: string | null = null;
  let cleanContent = content;

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thought = thinkMatch[1].trim();
    cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } else if (content.includes('<think>')) {
    const parts = content.split('<think>');
    cleanContent = parts[0]?.trim() || '';
    thought = parts[1]?.trim() || null;
  }

  return (
    <div className="prose prose-invert max-w-none text-xs sm:text-sm text-foreground leading-relaxed break-words">
      {thought && (
        <div className="mb-3 rounded-lg border border-border/60 bg-secondary/30 overflow-hidden text-xs not-prose">
          <button
            type="button"
            onClick={() => setShowThinking(!showThinking)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors select-none"
          >
            <span className="flex items-center space-x-1.5">
              <Sparkles className="w-3 h-3 text-muted-foreground" />
              <span>Thought process</span>
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showThinking ? 'rotate-180' : ''}`} />
          </button>
          {showThinking && (
            <div className="px-3 pb-3 pt-1 text-muted-foreground/80 font-mono text-[11px] leading-relaxed border-t border-border/40 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {thought}
            </div>
          )}
        </div>
      )}
      {(cleanContent || !thought) && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const stringified = String(children).replace(/\n$/, '');

            if (!inline && (match || stringified.includes('\n'))) {
              return <CodeBlock language={match ? match[1] : ''} value={stringified} />;
            }
            return (
              <code
                className="relative rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground border border-border"
                {...props}
              >
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (href && window.electronAPI) {
                    window.electronAPI.openExternal(href);
                  }
                }}
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-80 transition-opacity cursor-pointer"
                target="_blank"
                rel="noreferrer noopener"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 rounded-lg border border-border shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-secondary/60 border-b border-border">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="px-3.5 py-2 font-semibold text-foreground border-r border-border last:border-r-0">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3.5 py-2 border-b border-border/60 border-r border-border/60 last:border-r-0 text-foreground/90">
                {children}
              </td>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-border pl-3.5 py-1 my-3 text-muted-foreground italic bg-secondary/20 rounded-r-md">
                {children}
              </blockquote>
            );
          },
          h1({ children }) {
            return <h1 className="text-base sm:text-lg font-bold text-foreground mt-4 mb-2 tracking-tight">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm sm:text-base font-semibold text-foreground mt-3.5 mb-2 tracking-tight">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs sm:text-sm font-semibold text-foreground mt-3 mb-1.5">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 text-foreground">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 text-foreground">{children}</ol>;
          },
          p({ children }) {
            return <p className="my-1.5 leading-relaxed text-foreground">{children}</p>;
          },
          hr() {
            return <hr className="border-border my-4" />;
          },
        }}
      >
        {cleanContent || content}
      </ReactMarkdown>
      )}
    </div>
  );
};
