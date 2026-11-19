import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
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
      className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#02050c]/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-title"
    >
      <div className="w-full max-w-lg bg-[#0a1120] border border-slate-700/90 rounded-lg p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2
              id="credits-title"
              className="text-2xl font-bold tracking-wide text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Credits
            </h2>
            <p className="text-xs font-mono text-cyan-400 mt-1">
              ECHO-9: THE LAST SIGNAL · STAGE 1
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close credits"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mt-5 text-sm text-slate-300">
          <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
            <span className="text-slate-400">Project</span>
            <span className="font-medium text-white">
              ECHO-9: The Last Signal
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
            <span className="text-slate-400">Setting</span>
            <span className="font-medium text-white">
              Orbital Station ECHO-9 · 2189
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
            <span className="text-slate-400">Engine & Lighting</span>
            <span className="font-medium text-white">
              Three.js WebGL 3D &amp; Spatial Lighting
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
            <span className="text-slate-400">Audio Synthesis</span>
            <span className="font-medium text-white">
              Procedural Web Audio API
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400 pt-2">
            Built with original in-engine metallic station graphics, interactive
            bulkhead doors, computer log terminals, and smooth 60fps desktop
            controls.
          </p>
        </div>

        <div className="mt-7 pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
