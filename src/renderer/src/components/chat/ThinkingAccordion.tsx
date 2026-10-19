import React, { useState, useEffect, useRef } from 'react';
import { Brain, ChevronRight, Copy, Check, Sparkles } from 'lucide-react';

interface ThinkingAccordionProps {
  reasoning: string;
  isThinking: boolean;
  thinkingDurationMs?: number;
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({
  reasoning,
  isThinking,
  thinkingDurationMs,
}) => {
  const [isOpen, setIsOpen] = useState(isThinking);
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const prevIsThinkingRef = useRef<boolean>(isThinking);

  // Live stopwatch while thinking is active
  useEffect(() => {
    if (isThinking) {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      const timer = setInterval(() => {
        setElapsedSeconds((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      return () => clearInterval(timer);
    } else {
      // Stopped thinking
      if (thinkingDurationMs) {
        setElapsedSeconds(thinkingDurationMs / 1000);
      }
    }
  }, [isThinking, thinkingDurationMs]);

  // Auto-expand while thinking starts, auto-collapse when thinking completes
  useEffect(() => {
    if (prevIsThinkingRef.current !== isThinking) {
      if (isThinking) {
        // Just started thinking: auto-expand unless user explicitly collapsed it
        if (userToggled === null) {
          setIsOpen(true);
        }
      } else {
        // Just finished thinking: auto-collapse unless user explicitly expanded it
        if (userToggled === null) {
          setIsOpen(false);
        }
      }
      prevIsThinkingRef.current = isThinking;
    }
  }, [isThinking, userToggled]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setUserToggled(nextState);
    setIsOpen(nextState);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(reasoning);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy reasoning thoughts:', err);
    }
  };

  // Determine formatted duration
  const displayDuration = thinkingDurationMs
    ? (thinkingDurationMs / 1000).toFixed(1)
    : elapsedSeconds > 0
    ? elapsedSeconds.toFixed(1)
    : '0.0';

  if (!reasoning && !isThinking) return null;

  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden mb-3 select-none ${
        isThinking
          ? 'border-violet-500/30 bg-violet-500/[0.04] dark:bg-violet-500/[0.08] shadow-[0_0_15px_-3px_rgba(139,92,246,0.15)]'
          : 'border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/35'
      }`}
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-transform ${
              isThinking
                ? 'bg-violet-500/20 text-violet-500 dark:text-violet-400 animate-pulse'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isThinking ? (
              <Brain className="w-3.5 h-3.5 animate-spin-slow" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-violet-400/80" />
            )}
          </div>

          <div className="flex items-center space-x-2 truncate">
            {isThinking ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-violet-600 dark:text-violet-300 tracking-tight">
                  Thinking ({displayDuration}s)
                </span>
                <span className="inline-flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                  <span className="text-[10px] text-muted-foreground font-mono">streaming thoughts</span>
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors font-mono">
                Thought for {displayDuration}s
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 text-muted-foreground ml-2 shrink-0">
          {reasoning && (
            <div
              role="button"
              tabIndex={0}
              onClick={handleCopy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  handleCopy(e as any);
                }
              }}
              title="Copy reasoning"
              className="p-1 rounded-md hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </div>
          )}

          <div className="p-1">
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-90 text-foreground' : 'text-muted-foreground'
              }`}
            />
          </div>
        </div>
      </button>

      {/* Accordion content */}
      {isOpen && (
        <div className="border-t border-border/40 px-3.5 py-2.5 bg-background/50 dark:bg-zinc-950/40">
          <div className="max-h-[360px] overflow-y-auto text-xs text-muted-foreground/90 font-mono leading-relaxed whitespace-pre-wrap select-text pl-2 border-l-2 border-violet-500/30">
            {reasoning || (isThinking ? 'Analyzing query and exploring solutions...' : '')}
            {isThinking && (
              <span className="inline-block w-1.5 h-3 ml-1 bg-violet-500/70 animate-pulse align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
