import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  FileText,
  Camera,
  Globe,
  Loader2,
  Lock,
} from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';

export const WebBrowserDrawer: React.FC = () => {
  const {
    activeBrowserDrawerUrl,
    activeBrowserDrawerTitle,
    activeBrowserDrawerScreenshot,
    activeBrowserDrawerMarkdown,
    closeBrowserDrawer,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<'reader' | 'screenshot'>('reader');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<string | null>(activeBrowserDrawerMarkdown);
  const [screenshot, setScreenshot] = useState<string | null>(activeBrowserDrawerScreenshot);
  const [pageTitle, setPageTitle] = useState<string | null>(activeBrowserDrawerTitle);

  useEffect(() => {
    setContent(activeBrowserDrawerMarkdown);
    setScreenshot(activeBrowserDrawerScreenshot);
    setPageTitle(activeBrowserDrawerTitle);

    if (activeBrowserDrawerScreenshot && !activeBrowserDrawerMarkdown) {
      setActiveTab('screenshot');
    } else {
      setActiveTab('reader');
    }

    // If we have a URL but no content yet, automatically fetch reader content
    if (activeBrowserDrawerUrl && !activeBrowserDrawerMarkdown && window.electronAPI) {
      handleRefresh();
    }
  }, [activeBrowserDrawerUrl, activeBrowserDrawerMarkdown, activeBrowserDrawerScreenshot, activeBrowserDrawerTitle]);

  if (!activeBrowserDrawerUrl) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeBrowserDrawerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenExternal = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(activeBrowserDrawerUrl);
    } else {
      window.open(activeBrowserDrawerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRefresh = async () => {
    if (!window.electronAPI || !activeBrowserDrawerUrl) return;
    setIsLoading(true);
    try {
      const res = await window.electronAPI.browsePage(activeBrowserDrawerUrl, true);
      if (res) {
        setContent(res.content || '');
        if (res.title) setPageTitle(res.title);
        if (res.screenshotDataUrl) setScreenshot(res.screenshotDataUrl);
      }
    } catch (err) {
      console.error('[WebBrowserDrawer] Refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ease-out animate-in slide-in-from-right">
      {/* Drawer Header & URL Navigation Bar */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-950/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <h3 className="text-xs font-semibold text-zinc-200 truncate">
              {pageTitle || 'Web Browser Inspector'}
            </h3>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh Page"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleCopyUrl}
              title="Copy URL"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              title="Open in default browser"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
            <button
              type="button"
              onClick={closeBrowserDrawer}
              title="Close Drawer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* URL Address Bar */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-850 text-xs text-zinc-300">
          <Lock className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <span className="truncate select-all font-mono text-[11px] text-zinc-400 flex-1">
            {activeBrowserDrawerUrl}
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('reader')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'reader'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reader Text</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('screenshot')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === 'screenshot'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Screenshot</span>
            {screenshot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-500 py-20">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <span className="text-xs font-medium text-zinc-400">Loading web page content...</span>
          </div>
        ) : activeTab === 'reader' ? (
          content ? (
            <div className="prose prose-invert prose-sm max-w-none font-sans leading-relaxed text-zinc-300 whitespace-pre-wrap select-text">
              {content}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 py-20">
              <FileText className="w-8 h-8 stroke-[1.5]" />
              <span className="text-xs">No extracted reader text available.</span>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-2 text-xs font-medium text-blue-400 hover:underline"
              >
                Fetch Reader Content
              </button>
            </div>
          )
        ) : screenshot ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={screenshot}
              alt="Page Screenshot"
              className="rounded-lg border border-zinc-800 shadow-lg max-w-full h-auto object-contain"
            />
            <span className="text-[11px] text-zinc-500">
              Chromium Offscreen Capture (1280 x 800)
            </span>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-500 py-20">
            <Camera className="w-8 h-8 stroke-[1.5]" />
            <span className="text-xs">No screenshot captured for this page yet.</span>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-2 text-xs font-medium text-blue-400 hover:underline"
            >
              Take High-Res Screenshot
            </button>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-400">
        <span className="text-[11px] text-zinc-500 font-mono">
          Universal LLM Web Inspector
        </span>
        <button
          type="button"
          onClick={handleOpenExternal}
          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          <span>Open Full Site</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
