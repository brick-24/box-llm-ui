import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  X,
  Code2,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import {
  ArtifactType,
  DeviceViewport,
  VIEWPORT_WIDTHS,
  generateSandboxedHtml,
  getArtifactExtension,
  getArtifactMimeType,
} from '../../utils/artifact-utils';

interface ArtifactPreviewProps {
  code: string;
  artifactType: ArtifactType;
  title?: string;
}

export const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({
  code,
  artifactType,
  title,
}) => {
  const [viewport, setViewport] = useState<DeviceViewport>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalViewport, setModalViewport] = useState<DeviceViewport>('desktop');
  const [modalViewMode, setModalViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Detect dark theme
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark') || true
    : true;

  const sandboxedHtml = React.useMemo(() => {
    return generateSandboxedHtml(code, artifactType, isDark);
  }, [code, artifactType, isDark]);

  const handleReload = () => {
    setIsRotating(true);
    setReloadKey((k) => k + 1);
    setTimeout(() => setIsRotating(false), 500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy artifact code:', e);
    }
  };

  const handleDownload = () => {
    try {
      const ext = getArtifactExtension(artifactType);
      const mime = getArtifactMimeType(artifactType);
      const blob = new Blob([code], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artifact-${Date.now()}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download artifact:', e);
    }
  };

  // Close modal on escape
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  return (
    <div className="flex flex-col w-full bg-card/60 backdrop-blur-sm rounded-b-lg overflow-hidden border-t border-border/50">
      {/* Top Preview Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 border-b border-border/60 text-xs">
        {/* Left: Device Switcher */}
        <div className="flex items-center space-x-1 bg-background/80 p-0.5 rounded-md border border-border/80">
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              viewport === 'desktop'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Desktop view (100%)"
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              viewport === 'tablet'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Tablet view (768px)"
          >
            <Tablet className="w-3 h-3" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              viewport === 'mobile'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Mobile view (375px)"
          >
            <Smartphone className="w-3 h-3" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-1.5">
          <div
            className="hidden md:flex items-center space-x-1 text-[10px] text-muted-foreground font-mono mr-1"
            title="Sandboxed with origin 'null' - host app and IPC completely isolated"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Sandboxed</span>
          </div>

          <button
            type="button"
            onClick={handleReload}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Reload artifact"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={`Download ${getArtifactExtension(artifactType)}`}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Fullscreen preview"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="relative w-full bg-zinc-950/80 p-2 sm:p-4 overflow-x-auto min-h-[360px] flex items-center justify-center">
        <div
          className={`transition-all duration-300 ease-out flex flex-col overflow-hidden bg-background ${
            viewport === 'desktop'
              ? 'w-full h-[400px] rounded-md border border-border/80'
              : viewport === 'tablet'
                ? 'w-[768px] max-w-full h-[480px] rounded-xl border-2 border-border shadow-2xl'
                : 'w-[375px] max-w-full h-[520px] rounded-2xl border-4 border-zinc-800 shadow-2xl'
          }`}
        >
          {/* Simulated device header notch for mobile */}
          {viewport === 'mobile' && (
            <div className="h-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-center shrink-0">
              <div className="w-12 h-1 bg-zinc-700 rounded-full" />
            </div>
          )}

          {/* Secure Sandboxed Iframe (No allow-same-origin) */}
          <iframe
            ref={iframeRef}
            key={reloadKey}
            srcDoc={sandboxedHtml}
            sandbox="allow-scripts"
            title={title || 'Artifact Live Preview'}
            className="w-full flex-1 border-0 bg-transparent"
          />
        </div>
      </div>

      {/* Fullscreen Expansion Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex flex-col p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border w-full h-full rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
              <div className="flex items-center space-x-3">
                <span className="font-semibold text-sm text-foreground flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{title || `${artifactType.toUpperCase()} Live Artifact`}</span>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                  Origin: Isolated (null)
                </span>
              </div>

              {/* View Switcher in Modal */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-secondary/70 p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setModalViewMode('preview')}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      modalViewMode === 'preview'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalViewMode('code')}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      modalViewMode === 'code'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Raw Code</span>
                  </button>
                </div>

                {modalViewMode === 'preview' && (
                  <div className="hidden sm:flex items-center space-x-1 bg-secondary/70 p-0.5 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setModalViewport('desktop')}
                      className={`p-1.5 rounded-md transition-colors ${
                        modalViewport === 'desktop'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Desktop view"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalViewport('tablet')}
                      className={`p-1.5 rounded-md transition-colors ${
                        modalViewport === 'tablet'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Tablet view (768px)"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalViewport('mobile')}
                      className={`p-1.5 rounded-md transition-colors ${
                        modalViewport === 'mobile'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Mobile view (375px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-secondary hover:bg-accent text-secondary-foreground text-xs font-medium border border-border transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-1.5 rounded-md bg-secondary hover:bg-accent text-secondary-foreground border border-border transition-colors"
                  title="Download artifact"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
                  title="Close modal (Esc)"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-zinc-950/80 p-4 overflow-auto flex items-center justify-center">
              {modalViewMode === 'preview' ? (
                <div
                  className={`transition-all duration-300 ease-out flex flex-col overflow-hidden bg-background ${
                    modalViewport === 'desktop'
                      ? 'w-full h-full rounded-md border border-border/80'
                      : modalViewport === 'tablet'
                        ? 'w-[768px] max-w-full h-[90%] rounded-xl border-2 border-border shadow-2xl'
                        : 'w-[375px] max-w-full h-[95%] rounded-2xl border-4 border-zinc-800 shadow-2xl'
                  }`}
                >
                  {modalViewport === 'mobile' && (
                    <div className="h-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-center shrink-0">
                      <div className="w-12 h-1 bg-zinc-700 rounded-full" />
                    </div>
                  )}
                  <iframe
                    key={`modal-${reloadKey}`}
                    srcDoc={sandboxedHtml}
                    sandbox="allow-scripts"
                    title={title || 'Artifact Modal Live Preview'}
                    className="w-full flex-1 border-0 bg-transparent"
                  />
                </div>
              ) : (
                <div className="w-full h-full overflow-auto bg-zinc-950 p-4 rounded-lg border border-border">
                  <pre className="font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    <code>{code}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
