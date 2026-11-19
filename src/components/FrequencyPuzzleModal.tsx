import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Radio, Sliders, X } from 'lucide-react';

interface FrequencyPuzzleModalProps {
  onClickSound: () => void;
  onSolve: () => void;
  onClose: () => void;
}

const TARGET_FREQ = 448.92;
const TARGET_PHASE = 75;
const TARGET_GAIN = 80;

export const FrequencyPuzzleModal: React.FC<FrequencyPuzzleModalProps> = ({
  onClickSound,
  onSolve,
  onClose,
}) => {
  const [freq, setFreq] = useState(444.2);
  const [phase, setPhase] = useState(30);
  const [gain, setGain] = useState(50);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  const freqDiff = Math.abs(freq - TARGET_FREQ);
  const phaseDiff = Math.abs(phase - TARGET_PHASE);
  const gainDiff = Math.abs(gain - TARGET_GAIN);

  const freqLocked = freqDiff <= 0.35;
  const phaseLocked = phaseDiff <= 5;
  const gainLocked = gainDiff <= 5;

  const matchPercent = useMemo(() => {
    const fScore = Math.max(0, 1 - freqDiff / 7.5);
    const pScore = Math.max(0, 1 - phaseDiff / 90);
    const gScore = Math.max(0, 1 - gainDiff / 50);
    return Math.round(((fScore * 0.45 + pScore * 0.3 + gScore * 0.25) * 100));
  }, [freqDiff, phaseDiff, gainDiff]);

  const isSolved = freqLocked && phaseLocked && gainLocked;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const draw = (now: number) => {
      const t = now * 0.0025;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#040812';
      ctx.fillRect(0, 0, w, h);

      // Oscilloscope grid
      ctx.strokeStyle = 'rgba(30, 58, 138, 0.28)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Target Earth Distress Carrier Wave (dashed amber/emerald)
      ctx.strokeStyle = isSolved
        ? 'rgba(52, 211, 153, 0.7)'
        : 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const tFreqRad = (TARGET_FREQ - 440) * 0.55 + 2.2;
      const tPhaseRad = (TARGET_PHASE * Math.PI) / 180;
      const tAmp = (TARGET_GAIN / 100) * (h * 0.34);
      for (let x = 0; x <= w; x += 3) {
        const nx = (x / w) * Math.PI * 2;
        const y = h * 0.5 + Math.sin(nx * tFreqRad + tPhaseRad + t) * tAmp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Player Tuned Signal Wave (bright cyan)
      ctx.strokeStyle = isSolved ? '#34d399' : '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const pFreqRad = (freq - 440) * 0.55 + 2.2;
      const pPhaseRad = (phase * Math.PI) / 180;
      const pAmp = (gain / 100) * (h * 0.34);
      for (let x = 0; x <= w; x += 3) {
        const nx = (x / w) * Math.PI * 2;
        const y = h * 0.5 + Math.sin(nx * pFreqRad + pPhaseRad + t) * pAmp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [freq, phase, gain, isSolved]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#02050c]/85"
      role="dialog"
      aria-modal="true"
      aria-labelledby="freq-puzzle-title"
    >
      <div className="w-full max-w-xl bg-[#070e1c] border border-cyan-500/45 rounded-lg p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-md text-cyan-400 mt-0.5">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="freq-puzzle-title"
                className="text-xl font-bold tracking-wide text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Ship Defect #1 · Comms Frequency Repair
              </h2>
              <p className="text-xs font-mono text-cyan-400 mt-0.5">
                RESEARCH LAB · EARTH CARRIER TARGET: {TARGET_FREQ.toFixed(2)} MHz · {TARGET_PHASE}° · {TARGET_GAIN}%
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            aria-label="Close frequency tuner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Dual-Waveform Oscilloscope */}
        <div className="mt-4 bg-[#040812] border border-slate-800 rounded-md p-3">
          <div className="flex items-center justify-between text-[11px] font-mono mb-2">
            <span className="text-slate-400">
              AMBER: EARTH REFERENCE · CYAN: STATION TUNER
            </span>
            <span
              className={`tabular-nums font-semibold ${
                isSolved ? 'text-emerald-400' : 'text-cyan-300'
              }`}
            >
              SIGNAL MATCH {matchPercent}%
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={520}
            height={130}
            className="w-full h-[130px] rounded-sm border border-slate-800/80 block"
          />
        </div>

        {/* 3 Calibration Sliders */}
        <div className="mt-4 space-y-4 bg-[#040812] border border-slate-800 rounded-md p-4">
          {/* Carrier Frequency */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-300 inline-flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Carrier Frequency (Target 448.92 MHz)
              </span>
              <span
                className={`tabular-nums ${
                  freqLocked ? 'text-emerald-400' : 'text-cyan-300'
                }`}
              >
                {freq.toFixed(2)} MHz ·{' '}
                {freqLocked
                  ? 'LOCKED'
                  : freq < TARGET_FREQ
                    ? 'LOW'
                    : 'HIGH'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClickSound();
                  setFreq((v) => Math.max(442, Number((v - 0.1).toFixed(2))));
                }}
                className="px-2 py-1 text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded cursor-pointer"
              >
                -0.1
              </button>
              <input
                type="range"
                min={442}
                max={454}
                step={0.04}
                value={freq}
                onChange={(e) => setFreq(parseFloat(e.target.value))}
                className="flex-1 accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  onClickSound();
                  setFreq((v) => Math.min(454, Number((v + 0.1).toFixed(2))));
                }}
                className="px-2 py-1 text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded cursor-pointer"
              >
                +0.1
              </button>
            </div>
          </div>

          {/* Harmonic Phase */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-300">
                Harmonic Phase (Target 75°)
              </span>
              <span
                className={`tabular-nums ${
                  phaseLocked ? 'text-emerald-400' : 'text-cyan-300'
                }`}
              >
                {phase}° ·{' '}
                {phaseLocked
                  ? 'LOCKED'
                  : phase < TARGET_PHASE
                    ? 'LOW'
                    : 'HIGH'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={180}
              step={5}
              value={phase}
              onChange={(e) => {
                onClickSound();
                setPhase(parseInt(e.target.value, 10));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Signal Gain */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-300">Signal Gain (Target 80%)</span>
              <span
                className={`tabular-nums ${
                  gainLocked ? 'text-emerald-400' : 'text-cyan-300'
                }`}
              >
                {gain}% ·{' '}
                {gainLocked ? 'LOCKED' : gain < TARGET_GAIN ? 'LOW' : 'HIGH'}
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={gain}
              onChange={(e) => {
                onClickSound();
                setGain(parseInt(e.target.value, 10));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-slate-400">
            Align all 3 channels to unlock +1 Echo Beacon
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!isSolved}
              onClick={onSolve}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isSolved
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSolved ? 'Lock Carrier Signal' : 'Calibrating Signal...'}
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
