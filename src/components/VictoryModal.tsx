import React from 'react';
import { Home, Play, Radio, RotateCcw } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface VictoryModalProps {
  hud: HudSnapshot;
  onPlayAgain: () => void;
  onContinueExploring: () => void;
  onMainMenu: () => void;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  hud,
  onPlayAgain,
  onContinueExploring,
  onMainMenu,
}) => {
  const monstersDefeated = hud.moderateDefeated + (hud.bossDefeated ? 1 : 0);
  const isPurge = hud.endingChoice === 'PURGE_STATION';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#02050c]/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      <div
        className={`w-full max-w-md bg-[#0a1120] border rounded-lg p-7 shadow-2xl ${
          isPurge ? 'border-amber-500/60' : 'border-cyan-500/50'
        }`}
      >
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div
            className={`p-2.5 border rounded-md ${
              isPurge
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300'
            }`}
          >
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="victory-title"
              className="text-3xl font-bold tracking-wide text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isPurge
                ? 'Earth Warned · Wreck Purged'
                : 'Mission Complete · Earth Connected'}
            </h2>
            <p
              className={`text-xs font-mono mt-0.5 ${
                isPurge ? 'text-amber-300' : 'text-cyan-400'
              }`}
            >
              {isPurge
                ? 'EARTH SIGNAL SENT · PLANETARY THREAT QUARANTINED'
                : 'DEFECTS REPAIRED · EARTH COMMUNICATION RESTORED'}
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-300 mt-4">
          {isPurge
            ? 'You repaired the crashed ship’s defects, killed all 4 planetary monsters and the Final Boss controlling ECHO-9, transmitted the planetary warning to Earth, and purged the wreckage.'
            : 'You repaired the crashed spaceship’s defects, defeated all 4 planetary monsters and the Final Boss controlling the Command Deck, and restored full communication with Earth!'}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-[#060b16] border border-slate-800 rounded-md">
            <div className="text-[11px] font-mono text-slate-400">TIME</div>
            <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
              {formatTime(hud.elapsedSeconds)}
            </div>
          </div>
          <div className="p-3 bg-[#060b16] border border-slate-800 rounded-md">
            <div className="text-[11px] font-mono text-slate-400">MONSTERS</div>
            <div className="text-lg font-mono font-semibold text-cyan-300 tabular-nums mt-0.5">
              {monstersDefeated}/5
            </div>
          </div>
          <div className="p-3 bg-[#060b16] border border-slate-800 rounded-md">
            <div className="text-[11px] font-mono text-slate-400">SUIT</div>
            <div className="text-lg font-mono font-semibold text-white tabular-nums mt-0.5">
              {hud.suitIntegrity}%
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            type="button"
            onClick={onContinueExploring}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-100 bg-[#0d172a] hover:bg-[#15223b] border border-slate-700 rounded-md transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 text-cyan-400" />
            <span>Continue Exploring</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-300 bg-[#070d19] hover:bg-[#101a2e] border border-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
