import React, { useEffect } from 'react';
import { Monitor, Mouse, RotateCcw, Sliders, Volume2, VolumeX, X } from 'lucide-react';
import { GameSettings } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  hasSavedCheckpoint: boolean;
  onUpdateSettings: (next: Partial<GameSettings>) => void;
  onClearCheckpoint: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  hasSavedCheckpoint,
  onUpdateSettings,
  onClearCheckpoint,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#02050c]/88"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-lg bg-[#070f1e] border border-cyan-500/45 rounded-lg p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/15 border border-cyan-400/40 rounded-md text-cyan-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="settings-title"
                className="text-2xl font-bold tracking-wide text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                System Settings
              </h2>
              <p className="text-xs font-mono text-cyan-400 mt-0.5">
                AUDIO · MOUSE LOOK · 3D RENDERING
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Audio Mute & Volume */}
          <div className="bg-[#040914] border border-slate-800 rounded-md p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 uppercase tracking-wider">
                {settings.muted ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                )}
                <span>Master Audio</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ muted: !settings.muted })}
                className={`px-3 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                  settings.muted
                    ? 'bg-red-950/60 border-red-500/50 text-red-200'
                    : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200'
                }`}
              >
                {settings.muted ? 'MUTED' : 'ACTIVE'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.masterVolume * 100)}
                onChange={(e) =>
                  onUpdateSettings({ masterVolume: Number(e.target.value) / 100 })
                }
                className="w-full accent-cyan-400 cursor-pointer"
                aria-label="Master Volume"
              />
              <span className="text-xs font-mono text-slate-200 tabular-nums w-11 text-right">
                {Math.round(settings.masterVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Mouse Look Sensitivity */}
          <div className="bg-[#040914] border border-slate-800 rounded-md p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 uppercase tracking-wider">
                <Mouse className="w-4 h-4 text-cyan-400" />
                <span>Mouse Look Sensitivity</span>
              </div>
              <span className="text-xs font-mono text-slate-200 tabular-nums">
                {settings.mouseSensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={22}
              value={Math.round(settings.mouseSensitivity * 10)}
              onChange={(e) =>
                onUpdateSettings({ mouseSensitivity: Number(e.target.value) / 10 })
              }
              className="w-full accent-cyan-400 cursor-pointer"
              aria-label="Mouse Look Sensitivity"
            />
          </div>

          {/* 3D Lighting & Shadow Mode */}
          <div className="bg-[#040914] border border-slate-800 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 uppercase tracking-wider">
                <Monitor className="w-4 h-4 text-cyan-400" />
                <span>Station 3D Lighting &amp; Shadows</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                High adds dynamic shadows &amp; crisp detail; Balanced boosts FPS on laptops.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ highQualityLighting: !settings.highQualityLighting })
              }
              className={`px-3.5 py-2 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                settings.highQualityLighting
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-slate-800 border-slate-600 text-slate-200'
              }`}
            >
              {settings.highQualityLighting ? 'HIGH QUALITY' : 'LAPTOP BALANCED'}
            </button>
          </div>

          {/* Checkpoint Management */}
          {hasSavedCheckpoint && (
            <div className="bg-[#040914] border border-slate-800 rounded-md p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-amber-300 uppercase tracking-wider">
                  Saved Mission Checkpoint
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clear local progress if starting fresh.
                </p>
              </div>
              <button
                type="button"
                onClick={onClearCheckpoint}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-200 bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Save</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-7 pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
