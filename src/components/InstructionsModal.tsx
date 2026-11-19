import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface InstructionsModalProps {
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
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
      className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#02050c]/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructions-title"
    >
      <div className="w-full max-w-xl bg-[#0a1120] border border-slate-700/90 rounded-lg p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2
              id="instructions-title"
              className="text-2xl font-bold tracking-wide text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Mission Briefing &amp; Controls
            </h2>
            <p className="text-xs font-mono text-cyan-400 mt-1">
              RESCUE SPECIALIST FIELD GUIDE
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close instructions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5 mt-5 text-sm text-slate-300">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Combat, Movement &amp; View Controls
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-[#060b16] border border-slate-800 rounded-md">
                <span>Move &amp; Strafe</span>
                <span className="font-mono text-xs text-cyan-300">
                  WASD / Arrows
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#060b16] border border-slate-800 rounded-md">
                <span>Turn &amp; Aim</span>
                <span className="font-mono text-xs text-cyan-300">
                  External Mouse
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#060b16] border border-slate-800 rounded-md">
                <span>Fire Mining Laser</span>
                <span className="font-mono text-xs text-cyan-300">
                  Click / Space / F
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#060b16] border border-slate-800 rounded-md">
                <span>Deploy Echo Beacon</span>
                <span className="font-mono text-xs text-cyan-300">Q</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#060b16] border border-slate-800 rounded-md">
                <span>Interact / Puzzles / Logs</span>
                <span className="font-mono text-xs text-cyan-300">E</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#060b16] border border-slate-800 rounded-md">
                <span>Switch Camera (3D Tactical / POV)</span>
                <span className="font-mono text-xs text-cyan-300">V</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Use your external mouse to turn and aim in both 3D Tactical and 3D
              First-Person POV modes. Press V anytime to switch views, and
              recharge at Nano-Med nodes or Battery Cells.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              How to Fix the Ship, Kill the Monsters &amp; Contact Earth
            </h3>
            <p className="leading-relaxed text-slate-300">
              In 2189, <span className="text-white font-medium">ECHO-9</span> crashed on this monster-inhabited planet while carrying Earth&apos;s signal link. Search all four decks (<span className="text-white font-medium">Arrival Bay</span>, <span className="text-white font-medium">Research Lab</span>, <span className="text-white font-medium">Engineering Core</span>, and <span className="text-white font-medium">Command Deck</span>) to repair the Comms Frequency and Reactor Grid defects.
            </p>
            <p className="leading-relaxed text-slate-400 mt-2">
              Distract <span className="text-purple-300">THE LISTENER</span> using <span className="text-cyan-300 font-mono">Q</span> Echo Beacons—it hunts by sound. Kill all <span className="text-amber-300">4 planetary monsters</span> and the <span className="text-red-400">Apex Warlord (Final Boss)</span> controlling the Command Deck, then communicate with Earth before he destroys the signal connection.
            </p>
          </div>
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
