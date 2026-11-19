import React from 'react';
import { BookOpen, Home, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface PauseModalProps {
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenInstructions: () => void;
  onToggleMute: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  muted,
  onResume,
  onRestart,
  onOpenInstructions,
  onToggleMute,
  onMainMenu,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#02050c]/82"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm bg-[#0a1120] border border-slate-700/90 rounded-lg p-7 shadow-2xl">
        <div className="pb-4 border-b border-slate-800">
          <h2
            id="pause-title"
            className="text-3xl font-bold tracking-wide text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Game Paused
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            ECHO-9 · SIMULATION SUSPENDED
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-100 bg-[#0d172a] hover:bg-[#15223b] border border-slate-700 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>Restart Mission</span>
          </button>

          <button
            type="button"
            onClick={onOpenInstructions}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-100 bg-[#0d172a] hover:bg-[#15223b] border border-slate-700 rounded-md transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Instructions</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-100 bg-[#0d172a] hover:bg-[#15223b] border border-slate-700 rounded-md transition-colors cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>{muted ? 'Audio: Off' : 'Audio: On'}</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-300 bg-[#070d19] hover:bg-[#101a2e] border border-slate-800 rounded-md transition-colors mt-1 cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
