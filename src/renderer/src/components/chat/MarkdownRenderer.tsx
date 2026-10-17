import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none text-xs sm:text-sm text-zinc-200 leading-relaxed break-words">
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
                className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-violet-300 font-mono text-[12px] border border-zinc-750"
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
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors cursor-pointer"
                target="_blank"
                rel="noreferrer noopener"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 rounded-xl border border-zinc-800 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-zinc-900 border-b border-zinc-800">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="px-3.5 py-2.5 font-semibold text-zinc-100 border-r border-zinc-800 last:border-r-0">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3.5 py-2 border-b border-zinc-800/60 border-r border-zinc-800/60 last:border-r-0 text-zinc-300">
                {children}
              </td>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-violet-500 pl-3.5 py-1.5 my-3 text-zinc-400 italic bg-zinc-900/30 rounded-r-lg">
                {children}
              </blockquote>
            );
          },
          h1({ children }) {
            return <h1 className="text-lg sm:text-xl font-bold text-zinc-100 mt-4 mb-2 tracking-tight">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base sm:text-lg font-semibold text-zinc-100 mt-3.5 mb-2 tracking-tight">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm sm:text-base font-semibold text-zinc-200 mt-3 mb-1.5">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 text-zinc-300">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 text-zinc-300">{children}</ol>;
          },
          p({ children }) {
            return <p className="my-2 leading-relaxed text-zinc-200">{children}</p>;
          },
          hr() {
            return <hr className="border-zinc-800 my-4" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
