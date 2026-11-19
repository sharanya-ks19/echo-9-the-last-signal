import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Info,
  Play,
  RotateCw,
  Sliders,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';

const MENU_MUSIC_SRC = '/assets/aistudio/chase_tension.mp3_7f8432f0.mpeg';

interface TitleScreenProps {
  onPlay: () => void;
  onContinue: () => void;
  hasSavedCheckpoint: boolean;
  onOpenSettings: () => void;
  onOpenInstructions: () => void;
  onOpenCredits: () => void;
  muted: boolean;
  masterVolume?: number;
  onToggleMute: () => void;
  onButtonHover?: (primary?: boolean) => void;
  onButtonClickSound?: (primary?: boolean) => void;
  onUnlockAudio?: () => void;
  modalOpen: boolean;
}

const DAMAGE_WARNINGS = [
  {
    label: 'Station Creatures',
    value: '8–15 DMG',
    detail: 'Skitterers, Spitters & Stalkers',
    tone: 'text-amber-300 border-amber-500/30 bg-amber-950/20',
  },
  {
    label: '4 Moderate Sentinels',
    value: '12–16 DMG',
    detail: 'Armored melee + plasma bolts',
    tone: 'text-orange-300 border-orange-500/35 bg-orange-950/20',
  },
  {
    label: 'Apex Warlord (Boss)',
    value: '22 DMG',
    detail: '3-bolt barrage in Phase 2',
    tone: 'text-red-300 border-red-500/40 bg-red-950/25',
  },
  {
    label: 'THE LISTENER',
    value: '16 DMG',
    detail: 'Hunts footsteps & laser noise',
    tone: 'text-purple-300 border-purple-500/35 bg-purple-950/20',
  },
  {
    label: 'Electrical & Plasma',
    value: '12–20 / sec',
    detail: 'Conduits, radiation & fissures',
    tone: 'text-rose-300 border-rose-500/35 bg-rose-950/25',
  },
  {
    label: 'Your Mining Laser',
    value: '32 DMG',
    detail: 'Overheats at 100% thermal load',
    tone: 'text-cyan-300 border-cyan-500/35 bg-cyan-950/20',
  },
];

const DO_ITEMS = [
  'Deploy Echo Beacons (Q) to distract THE LISTENER while repairing ship defects.',
  'Recharge 100% Suit & Battery at Nano-Med pods (E) across the crashed decks.',
  'Fix the Comms Frequency & Reactor Grid defects (100 MW) to restore Earth link power.',
  'Kill all 4 monsters and the Final Boss before triggering the Earth Signal Relay.',
];

const DONT_ITEMS = [
  'Do not step into crash-ruptured plasma fissures, coolant leaks, or exposed arcs (20 DMG/s).',
  'Do not fire continuously near THE LISTENER without a decoy — laser shots alert it.',
  'Do not try to transmit to Earth while any of the 4 monsters or Final Boss still lives.',
  'Do not let the Final Boss win — he knows Earth’s frequency and will destroy the signal.',
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onPlay,
  onContinue,
  hasSavedCheckpoint,
  onOpenSettings,
  onOpenInstructions,
  onOpenCredits,
  muted,
  masterVolume = 0.8,
  onToggleMute,
  onButtonHover,
  onButtonClickSound,
  onUnlockAudio,
  modalOpen,
}) => {
  const [showProtocol, setShowProtocol] = useState(false);
  const menuAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = menuAudioRef.current;
    if (!audio) return;

    audio.volume = Math.max(0, Math.min(1, masterVolume * 0.65));
    audio.muted = muted;

    if (muted) {
      audio.pause();
      return;
    }

    let cancelled = false;
    const unlockEvents = ['pointerdown', 'keydown'] as const;

    const removeUnlockListeners = () => {
      unlockEvents.forEach((evt) => {
        window.removeEventListener(evt, handleFirstInteraction);
      });
    };

    const tryPlay = () => {
      if (cancelled || muted) return;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            removeUnlockListeners();
          })
          .catch(() => {
            // Browser blocked autoplay prior to user interaction; listeners below will start playback on first input
          });
      }
    };

    const handleFirstInteraction = () => {
      onUnlockAudio?.();
      tryPlay();
    };

    unlockEvents.forEach((evt) => {
      window.addEventListener(evt, handleFirstInteraction, { passive: true });
    });
    tryPlay();

    return () => {
      cancelled = true;
      removeUnlockListeners();
    };
  }, [muted, masterVolume, onUnlockAudio]);

  useEffect(() => {
    const audio = menuAudioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (modalOpen) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onPlay, modalOpen]);

  const handleToggleAudioClick = () => {
    const audio = menuAudioRef.current;
    if (audio) {
      if (muted) {
        audio.muted = false;
        audio.volume = Math.max(0, Math.min(1, masterVolume * 0.65));
        void audio.play().catch(() => {});
      } else {
        audio.muted = true;
        audio.pause();
      }
    }
    onToggleMute();
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 md:p-8 lg:px-12 lg:py-7 bg-gradient-to-r from-[#03060e]/92 via-[#040914]/56 to-transparent overflow-y-auto">
      <audio
        ref={menuAudioRef}
        src={MENU_MUSIC_SRC}
        loop
        preload="auto"
        className="hidden"
      />
      {/* Top Row: Setting metadata + Instructions & Audio toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs font-mono tracking-wider text-slate-400">
          CRASH SITE SECTOR 09 · YEAR 2189 · ALIEN PLANET SURVIVAL
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onMouseEnter={() => onButtonHover?.(false)}
            onFocus={() => onButtonHover?.(false)}
            onClick={() => {
              onButtonClickSound?.(false);
              onOpenInstructions();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#0b1324]/90 border border-slate-700/80 rounded-md hover:border-cyan-400/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Field Manual</span>
          </button>
          <button
            type="button"
            onMouseEnter={() => onButtonHover?.(false)}
            onFocus={() => onButtonHover?.(false)}
            onClick={handleToggleAudioClick}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-[#0b1324]/90 border border-slate-700/80 rounded-md hover:border-cyan-400/60 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <span>{muted ? 'Audio Muted' : 'Audio On'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Split: Storyline + Guide on Left; Threat Profile, Damage Matrix & Do's/Don'ts Dashboard on Right */}
      <div className="my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl w-full mx-auto">
        <div className="lg:col-span-6 flex flex-col justify-between">
          {/* Bespoke SVG Title Lockup */}
          <svg
            viewBox="0 0 540 120"
            className="w-full max-w-[420px] h-auto mb-2.5"
            role="img"
            aria-label="ECHO-9: The Last Signal"
          >
            <defs>
              <linearGradient id="echoCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="65%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <path
              d="M 4 20 L 46 20 L 54 8 L 62 32 L 70 12 L 78 20 L 140 20"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
            <circle cx="4" cy="20" r="3" fill="#ef4444" />
            <text
              x="4"
              y="84"
              fill="url(#echoCyan)"
              fontFamily="Barlow Condensed, sans-serif"
              fontWeight="700"
              fontSize="70"
              letterSpacing="4"
            >
              ECHO-9
            </text>
            <text
              x="6"
              y="112"
              fill="#94a3b8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
              fontSize="17"
              letterSpacing="7"
            >
              THE LAST SIGNAL
            </text>
          </svg>

          {/* Storyline */}
          <p className="text-sm leading-relaxed text-slate-200 max-w-xl mb-3.5">
            In <span className="text-cyan-300 font-semibold">2189</span>, spaceship station <span className="text-white font-semibold">ECHO-9</span> approached an uncharted planet carrying an active communication link from Earth—until unforeseen catastrophic failures forced it to crash on the monster-infested world. The <span className="text-red-300 font-medium">Final Boss</span> now controls the wrecked ship and knows Earth&apos;s signal. Fix all ship defects, kill the 4 monsters and the Final Boss, and communicate with Earth.
          </p>

          {/* Step-by-Step Mission Completion Guide */}
          <div className="bg-[#070d1c]/92 border border-slate-800 rounded-lg p-3.5 max-w-xl mb-4">
            <h2 className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 mb-2">
              How to Repair the Ship, Kill the Threats &amp; Contact Earth
            </h2>
            <ol className="space-y-1.5 text-xs text-slate-300 leading-snug">
              <li>
                <span className="font-mono text-cyan-400 mr-2">01.</span>
                Find all spaceship defects (<span className="text-white font-mono">E</span>): repair the <span className="text-cyan-300">Comms Frequency</span> in Lab &amp; <span className="text-amber-300">Reactor Grid</span> in Engineering; distract <span className="text-purple-300">THE LISTENER</span> with (<span className="text-white font-mono">Q</span>).
              </li>
              <li>
                <span className="font-mono text-cyan-400 mr-2">02.</span>
                Hunt down and kill all <span className="text-amber-300 font-medium">4 planetary monsters</span> roaming the crashed ship with your Mining Laser (<span className="text-white font-mono">Click / Space</span>).
              </li>
              <li>
                <span className="font-mono text-cyan-400 mr-2">03.</span>
                Confront and kill the <span className="text-red-400 font-medium">Final Boss (Apex Warlord)</span> controlling the Command Deck before he severs Earth&apos;s channel.
              </li>
              <li>
                <span className="font-mono text-cyan-400 mr-2">04.</span>
                Transmit from the <span className="text-cyan-300 font-medium">Earth Signal Relay</span> to complete the mission. If the Final Boss wins, he destroys Earth&apos;s connection forever.
              </li>
            </ol>
          </div>

          {/* Primary Menu Buttons: PLAY, CONTINUE, SETTINGS, CREDITS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl">
            <button
              type="button"
              onMouseEnter={() => onButtonHover?.(true)}
              onFocus={() => onButtonHover?.(true)}
              onClick={() => {
                onButtonClickSound?.(true);
                onPlay();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 hover:-translate-y-0.5 active:translate-y-0 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play</span>
            </button>

            <div
              className="flex"
              onMouseEnter={() => onButtonHover?.(hasSavedCheckpoint)}
            >
              <button
                type="button"
                disabled={!hasSavedCheckpoint}
                onFocus={() => onButtonHover?.(hasSavedCheckpoint)}
                onClick={() => {
                  onButtonClickSound?.(true);
                  onContinue();
                }}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-md border transition-all whitespace-nowrap shrink-0 ${
                  hasSavedCheckpoint
                    ? 'text-cyan-100 bg-[#0d1b30] hover:bg-[#132642] hover:-translate-y-0.5 active:translate-y-0 border-cyan-500/50 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20 cursor-pointer'
                    : 'text-slate-500 bg-[#09101d] border-slate-800/80 cursor-not-allowed'
                }`}
                title={
                  hasSavedCheckpoint
                    ? 'Resume from last mission checkpoint'
                    : 'No saved checkpoint yet'
                }
              >
                <RotateCw className="w-4 h-4 text-cyan-400" />
                <span>Continue</span>
              </button>
            </div>

            <button
              type="button"
              onMouseEnter={() => onButtonHover?.(false)}
              onFocus={() => onButtonHover?.(false)}
              onClick={() => {
                onButtonClickSound?.(false);
                onOpenSettings();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-100 bg-[#0d1629] hover:bg-[#142038] hover:-translate-y-0.5 active:translate-y-0 border border-slate-700 hover:border-cyan-400/50 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onMouseEnter={() => onButtonHover?.(false)}
              onFocus={() => onButtonHover?.(false)}
              onClick={() => {
                onButtonClickSound?.(false);
                onOpenCredits();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-100 bg-[#0d1629] hover:bg-[#142038] hover:-translate-y-0.5 active:translate-y-0 border border-slate-700 hover:border-cyan-400/50 rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Info className="w-4 h-4 text-slate-400" />
              <span>Credits</span>
            </button>
          </div>
        </div>

        {/* Right Column: Open Stage over the Live 3D Spaceship Background + Final Boss */}
        <div className="lg:col-span-6 flex flex-col justify-between min-h-[380px] lg:min-h-[490px] pointer-events-none">
          {/* Top-right minimal live-cam indicator */}
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#050914]/75 border border-red-500/40 text-[11px] font-mono text-red-300 tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>COMMAND DECK · FINAL BOSS DETECTED</span>
            </div>
          </div>

          {/* Open transparent viewport window framing the 3D Final Boss inside the spaceship scene */}
          <div className="flex-1" />

          {/* Bottom-right compact Boss telemetry & collapsible Survival Protocol */}
          <div className="flex flex-col gap-2.5 pointer-events-auto">
            <div className="bg-[#050811]/82 border border-red-500/40 rounded-lg px-4 py-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-[10px] font-mono text-red-400 tracking-wider">
                    FINAL BOSS · CONTROLS CRASHED ECHO-9
                  </div>
                  <h2
                    className="text-xl font-bold text-white tracking-wider leading-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    APEX WARLORD
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="bg-[#090e1a]/90 border border-slate-800 rounded px-2.5 py-1">
                    <div className="text-[9px] font-mono text-slate-400">HP</div>
                    <div className="text-xs font-mono font-bold text-red-300 tabular-nums">
                      330
                    </div>
                  </div>
                  <div className="bg-[#090e1a]/90 border border-slate-800 rounded px-2.5 py-1">
                    <div className="text-[9px] font-mono text-slate-400">STRIKE</div>
                    <div className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                      22 DMG
                    </div>
                  </div>
                  <div className="bg-[#090e1a]/90 border border-slate-800 rounded px-2.5 py-1">
                    <div className="text-[9px] font-mono text-slate-400">GUARDS</div>
                    <div className="text-xs font-mono font-bold text-cyan-300 tabular-nums">
                      4 BEASTS
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Patrols the wrecked Command Deck above. Kill all <span className="text-amber-300 font-medium">4 monsters</span> and slay him before he destroys Earth&apos;s signal connection.
              </p>
            </div>

            <div className="bg-[#070c18]/88 border border-amber-500/35 rounded-lg p-3 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-300 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider truncate">
                    Threat Intel · Laser 32 DMG · Suit 100 HP · Hazards 20/s
                  </span>
                </div>
                <button
                  type="button"
                  onMouseEnter={() => onButtonHover?.(false)}
                  onClick={() => {
                    onButtonClickSound?.(false);
                    setShowProtocol((v) => !v);
                  }}
                  className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 px-2 py-1 bg-[#0b1528] border border-cyan-500/35 rounded transition-colors shrink-0 cursor-pointer"
                >
                  {showProtocol ? 'Hide Protocol' : 'Damage & Protocol'}
                </button>
              </div>

              {showProtocol && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {DAMAGE_WARNINGS.map((item) => (
                      <div
                        key={item.label}
                        className={`rounded border px-2 py-1.5 ${item.tone}`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                          <span className="text-slate-300 truncate">{item.label}</span>
                          <span className="font-bold tabular-nums shrink-0">
                            {item.value}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.detail}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-[#06141f]/90 border border-cyan-500/30 rounded p-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-cyan-300 uppercase mb-1">
                        <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>DO&apos;S · SURVIVE</span>
                      </div>
                      <ul className="space-y-0.5 text-[10px] text-slate-300 leading-snug">
                        {DO_ITEMS.map((text) => (
                          <li key={text} className="flex items-start gap-1">
                            <span className="text-cyan-400 font-mono">+</span>
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-[#19090d]/90 border border-red-500/35 rounded p-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-red-300 uppercase mb-1">
                        <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <span>DON&apos;TS · AVOID BREACH</span>
                      </div>
                      <ul className="space-y-0.5 text-[10px] text-slate-300 leading-snug">
                        {DONT_ITEMS.map((text) => (
                          <li key={text} className="flex items-start gap-1">
                            <span className="text-red-400 font-mono">!</span>
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Single flat control hint line */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-2.5">
        <div className="text-xs font-mono text-slate-400 tracking-wide">
          WASD Move · Mouse Turn &amp; Aim · Click / Space Fire · Q Echo Beacon · E Interact · V Toggle View · Esc Pause
        </div>
        <div className="text-xs font-mono text-slate-500">
          5 Hostile Monsters + THE LISTENER · 4 Sectors
        </div>
      </div>
    </div>
  );
};

