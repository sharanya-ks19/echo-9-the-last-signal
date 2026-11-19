import React, { useEffect, useState } from 'react';
import { CheckCircle2, X, Zap } from 'lucide-react';

interface ReactorPuzzleModalProps {
  onClickSound: () => void;
  onSolve: () => void;
  onClose: () => void;
}

const TARGETS = {
  cooling: 40,
  bridge: 35,
  relay: 25,
};

export const ReactorPuzzleModal: React.FC<ReactorPuzzleModalProps> = ({
  onClickSound,
  onSolve,
  onClose,
}) => {
  const [cooling, setCooling] = useState(15);
  const [bridge, setBridge] = useState(55);
  const [relay, setRelay] = useState(45);

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

  const totalMw = cooling + bridge + relay;
  const coolingOk = Math.abs(cooling - TARGETS.cooling) <= 5;
  const bridgeOk = Math.abs(bridge - TARGETS.bridge) <= 5;
  const relayOk = Math.abs(relay - TARGETS.relay) <= 5;
  const totalOk = totalMw === 100;
  const isBalanced = coolingOk && bridgeOk && relayOk && totalOk;

  const adjustBus = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number
  ) => {
    onClickSound();
    setter((prev) => Math.max(0, Math.min(70, prev + delta)));
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#02050c]/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reactor-puzzle-title"
    >
      <div className="w-full max-w-xl bg-[#070e1c] border border-cyan-500/45 rounded-lg p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/35 rounded-md text-amber-400 mt-0.5">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="reactor-puzzle-title"
                className="text-xl font-bold tracking-wide text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Ship Defect #2 · Reactor Grid Repair
              </h2>
              <p className="text-xs font-mono text-cyan-400 mt-0.5">
                ENGINEERING CORE · BALANCE TOTAL LOAD TO 100 MW EXACT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close reactor balancer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid Output Summary */}
        <div className="mt-4 flex items-center justify-between bg-[#040812] border border-slate-800 rounded-md px-4 py-3">
          <div>
            <div className="text-[11px] font-mono text-slate-400">
              TOTAL REACTOR OUTPUT
            </div>
            <div
              className={`text-lg font-mono font-bold tabular-nums ${
                totalOk
                  ? 'text-emerald-400'
                  : totalMw > 100
                    ? 'text-red-400'
                    : 'text-amber-300'
              }`}
            >
              {totalMw} / 100 MW
            </div>
          </div>
          <div className="text-right text-xs font-mono">
            <div
              className={
                isBalanced
                  ? 'text-emerald-400 font-semibold'
                  : totalMw > 100
                    ? 'text-red-400'
                    : 'text-amber-300'
              }
            >
              {isBalanced
                ? 'GRID BALANCED'
                : totalMw > 100
                  ? 'OVERLOAD DETECTED'
                  : totalMw < 100
                    ? 'UNDERPOWERED'
                    : 'ADJUST INDIVIDUAL BUSES'}
            </div>
            <div className="text-[11px] text-slate-400">
              Balance all 3 buses to stabilize Command Seals
            </div>
          </div>
        </div>

        {/* 3 Distribution Buses */}
        <div className="mt-4 space-y-4 bg-[#040812] border border-slate-800 rounded-md p-4">
          {[
            {
              label: 'Bus A · Reactor Cooling',
              target: TARGETS.cooling,
              value: cooling,
              ok: coolingOk,
              setter: setCooling,
            },
            {
              label: 'Bus B · Command Bridge Seal',
              target: TARGETS.bridge,
              value: bridge,
              ok: bridgeOk,
              setter: setBridge,
            },
            {
              label: 'Bus C · Earth Signal Array',
              target: TARGETS.relay,
              value: relay,
              ok: relayOk,
              setter: setRelay,
            },
          ].map((bus) => (
            <div key={bus.label}>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-200">
                  {bus.label}{' '}
                  <span className="text-slate-400">(Target {bus.target} MW)</span>
                </span>
                <span
                  className={`tabular-nums font-semibold ${
                    bus.ok
                      ? 'text-emerald-400'
                      : bus.value > bus.target
                        ? 'text-red-400'
                        : 'text-amber-300'
                  }`}
                >
                  {bus.value} MW ·{' '}
                  {bus.ok
                    ? 'STABLE'
                    : bus.value > bus.target
                      ? 'HIGH'
                      : 'LOW'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => adjustBus(bus.setter, -5)}
                  className="px-2.5 py-1 text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded cursor-pointer"
                >
                  -5
                </button>
                <div className="flex-1 h-2.5 bg-slate-800 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      bus.ok
                        ? 'bg-emerald-400'
                        : bus.value > bus.target + 5
                          ? 'bg-red-500'
                          : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, (bus.value / 70) * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => adjustBus(bus.setter, 5)}
                  className="px-2.5 py-1 text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded cursor-pointer"
                >
                  +5
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-slate-400">
            Energizes blue power conduits &amp; unlocks Command Deck
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!isBalanced}
              onClick={onSolve}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isBalanced
                  ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isBalanced ? 'Engage Reactor Grid' : 'Balance Load to 100 MW'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
