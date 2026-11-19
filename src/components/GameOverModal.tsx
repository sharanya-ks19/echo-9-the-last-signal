import React, { useState } from 'react';
import { AlertTriangle, Home, RotateCcw, Skull } from 'lucide-react';
import { BOSS_IMAGE_URL } from '../game/bossSprite';
import { HudSnapshot } from '../game/types';

interface GameOverModalProps {
  hud: HudSnapshot;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  hud,
  onRestart,
  onMainMenu,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const monsterWon = hud.gameOverReason === 'MONSTER_WIN';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#02050c]/88"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-md bg-[#11080c] border border-red-500/50 rounded-lg p-7 shadow-2xl">
        <div className="flex items-center gap-3 pb-4 border-b border-red-900/60">
          <div className="p-2.5 bg-red-500/15 border border-red-500/40 rounded-md text-red-400">
            {monsterWon ? (
              <Skull className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2
              id="gameover-title"
              className="text-3xl font-bold tracking-wide text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {monsterWon ? 'Earth Signal Destroyed' : 'Suit Breach Detected'}
            </h2>
            <p className="text-xs font-mono text-red-400 mt-0.5">
              {monsterWon
                ? 'FINAL BOSS PREVAILED · EARTH CONNECTION DESTROYED'
                : `CRASH SITE INCAPACITATION · ${hud.sectorName}`}
            </p>
          </div>
        </div>

        {monsterWon && !imgErr && (
          <div className="mt-4 h-36 w-full rounded-md overflow-hidden bg-[#17181d] border border-red-900/50 relative">
            <img
              src={BOSS_IMAGE_URL}
              alt="Apex Warlord Final Boss"
              referrerPolicy="no-referrer"
              onError={() => setImgErr(true)}
              className="w-full h-full object-contain"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#11080c] via-transparent to-transparent" />
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-300 mt-4">
          {monsterWon
            ? 'The planetary monsters and Final Boss controlling the crashed ECHO-9 overwhelmed you. With the Final Boss victorious, he shattered the Earth communication signal forever.'
            : 'Crash-site hazards aboard ECHO-9 compromised your EVA suit integrity, leaving the ship defects unrepaired and severing Earth’s last signal.'}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Mission</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-300 bg-[#0a101d] hover:bg-[#131d32] border border-slate-800 rounded-md transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
