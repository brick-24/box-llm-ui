import React, { useState } from 'react';
import { Globe, ExternalLink, BookOpen } from 'lucide-react';
import { WebCitation } from '@shared/types';
import { useChatStore } from '../../store/useChatStore';

interface CitationsListProps {
  citations: WebCitation[];
}

export const CitationsList: React.FC<CitationsListProps> = ({ citations }) => {
  const openBrowserDrawer = useChatStore((s) => s.openBrowserDrawer);
  const [faviconErrors, setFaviconErrors] = useState<Record<string, boolean>>({});

  if (!citations || citations.length === 0) return null;

  const getHostname = (urlStr: string): string => {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return urlStr;
    }
  };

  const handleFaviconError = (url: string) => {
    setFaviconErrors((prev) => ({ ...prev, [url]: true }));
  };

  return (
    <div className="mt-4 pt-3 border-t border-zinc-800/60">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mb-2.5 tracking-tight">
        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
        <span>Sources ({citations.length})</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {citations.map((citation, idx) => {
          const hostname = getHostname(citation.url);
          const faviconUrl =
            citation.favicon ||
            `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
          const hasFaviconError = faviconErrors[citation.url];

          return (
            <div
              key={`${citation.url}-${idx}`}
              className="group relative flex flex-col justify-between p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-850/70 hover:border-zinc-700/80 transition-all duration-200 cursor-pointer shadow-sm hover:shadow"
              onClick={() => {
                if (window.electronAPI) {
                  window.electronAPI.openExternal(citation.url);
                } else {
                  window.open(citation.url, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {!hasFaviconError ? (
                    <img
                      src={faviconUrl}
                      alt=""
                      onError={() => handleFaviconError(citation.url)}
                      className="w-4 h-4 rounded-sm object-contain flex-shrink-0"
                    />
                  ) : (
                    <Globe className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  )}
                  <span className="text-[11px] font-medium text-zinc-400 truncate flex-1">
                    {hostname}
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>

                <div
                  className="text-xs font-medium text-zinc-200 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug"
                  title={citation.title || citation.url}
                >
                  {citation.title || hostname}
                </div>
              </div>

              {/* Quick Reader preview button */}
              <div className="mt-2 pt-1.5 flex items-center justify-between border-t border-zinc-800/30">
                <span className="text-[10px] text-zinc-500 font-mono">
                  [{idx + 1}]
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBrowserDrawer(citation.url, citation.title, undefined, citation.snippet);
                  }}
                  className="text-[10px] text-zinc-400 hover:text-blue-400 font-medium px-1.5 py-0.5 rounded hover:bg-zinc-800/60 transition-colors"
                >
                  Reader Preview
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
