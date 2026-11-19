import React from 'react';
import {
  FileText,
  Radio,
  ShieldAlert,
  Sliders,
  Terminal,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { EndingChoice, TerminalEntity } from '../game/types';

interface TerminalModalProps {
  terminal: TerminalEntity;
  powerRestored: boolean;
  frequencySolved: boolean;
  threatsCleared: boolean;
  moderateDefeated: number;
  moderateTotal: number;
  bossDefeated: boolean;
  onTriggerAction: () => void;
  onCompleteEnding: (choice: EndingChoice) => void;
  onClose: () => void;
}

export const TerminalModal: React.FC<TerminalModalProps> = ({
  terminal,
  powerRestored,
  frequencySolved,
  threatsCleared,
  moderateDefeated,
  moderateTotal,
  bossDefeated,
  onTriggerAction,
  onCompleteEnding,
  onClose,
}) => {
  const isSignalBlocked =
    terminal.actionType === 'ACTIVATE_SIGNAL' && !threatsCleared;

  const isActionable =
    Boolean(terminal.actionType) &&
    !(terminal.actionType === 'RESTORE_POWER' && powerRestored) &&
    !(terminal.actionType === 'SOLVE_FREQUENCY' && frequencySolved) &&
    !terminal.activated &&
    !isSignalBlocked;

  const HeaderIcon =
    terminal.kind === 'AUDIO_LOG'
      ? Volume2
      : terminal.kind === 'RESEARCH_NOTE'
        ? FileText
        : Terminal;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#02050c]/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminal-title"
    >
      <div className="w-full max-w-xl bg-[#070e1c] border border-cyan-500/45 rounded-lg p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-md text-cyan-400 mt-0.5">
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="terminal-title"
                className="text-xl font-bold tracking-wide text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {terminal.title}
              </h2>
              <p className="text-xs font-mono text-cyan-400 mt-0.5">
                {terminal.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3 bg-[#040812] border border-slate-800/90 rounded-md p-4 font-mono text-xs leading-relaxed text-slate-200">
          {terminal.logs.map((line, index) => (
            <p key={index} className="text-slate-300">
              <span className="text-cyan-500 mr-2">&gt;</span>
              {line}
            </p>
          ))}
        </div>

        {isSignalBlocked && (
          <div className="mt-4 flex items-center gap-2.5 p-3 rounded-md bg-[#20090c] border border-red-500/50 text-xs text-red-200">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Earth Relay Blocked: Monsters Killed ({moderateDefeated}/
              {moderateTotal}) · Final Boss ({bossDefeated ? 'Defeated' : 'Controlling Bridge'}
              ). Kill all 4 monsters &amp; the Final Boss before communicating with Earth.
            </span>
          </div>
        )}

        {terminal.actionType === 'ACTIVATE_SIGNAL' &&
          !isSignalBlocked &&
          !terminal.activated && (
            <div className="mt-4 bg-[#051122] border border-cyan-500/45 rounded-md p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 mb-2">
                Earth Signal Restored · Select Final Transmission
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onCompleteEnding('EVACUATE_EARTH')}
                  className="flex flex-col items-start gap-1 p-3 text-left bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-md transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <Radio className="w-3.5 h-3.5" />
                    Communicate with Earth &amp; Evacuate
                  </span>
                  <span className="text-[11px] text-slate-800 leading-snug">
                    Broadcast salvaged 2189 signal to Earth &amp; extract from the wreck.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onCompleteEnding('PURGE_STATION')}
                  className="flex flex-col items-start gap-1 p-3 text-left bg-[#1d0c11] hover:bg-[#2c121a] border border-red-500/55 text-red-100 rounded-md transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-300">
                    <Zap className="w-3.5 h-3.5" />
                    Transmit Warning &amp; Purge Wreck
                  </span>
                  <span className="text-[11px] text-red-200/80 leading-snug">
                    Warn Earth to quarantine the planet forever &amp; overload core.
                  </span>
                </button>
              </div>
            </div>
          )}

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-slate-400">
            Press E or Esc to disconnect
          </span>

          <div className="flex items-center gap-3">
            {terminal.actionType &&
              !(
                terminal.actionType === 'ACTIVATE_SIGNAL' &&
                !isSignalBlocked &&
                !terminal.activated
              ) && (
                <button
                  type="button"
                  disabled={!isActionable}
                  onClick={onTriggerAction}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isActionable
                      ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {terminal.actionType === 'RESTORE_POWER' ? (
                    <Zap className="w-4 h-4" />
                  ) : terminal.actionType === 'SOLVE_FREQUENCY' ? (
                    <Sliders className="w-4 h-4" />
                  ) : (
                    <Radio className="w-4 h-4" />
                  )}
                  <span>
                    {terminal.actionType === 'RESTORE_POWER'
                      ? isActionable
                        ? terminal.actionLabel
                        : 'Reactor Defect Repaired'
                      : terminal.actionType === 'SOLVE_FREQUENCY'
                        ? isActionable
                          ? terminal.actionLabel
                          : 'Comms Defect Repaired'
                        : terminal.activated
                          ? 'Earth Contact Sent'
                          : isSignalBlocked
                            ? 'Kill 4 Monsters & Boss First'
                            : terminal.actionLabel}
                  </span>
                </button>
              )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Close Terminal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
