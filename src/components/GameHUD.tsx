import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Compass,
  Eye,
  KeyRound,
  Pause,
  Radio,
  Shield,
  Skull,
  Target,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';
import {
  MAP_COLS,
  MAP_ROWS,
  StationWorldData,
  TILE_SIZE,
} from '../game/stationMap';
import { HudSnapshot, TileType } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  world: StationWorldData | null;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleViewMode: () => void;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  world,
  onPause,
  onToggleMute,
  onToggleViewMode,
}) => {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 1.75;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = world.grid[r][c];
        if (tile === TileType.VOID) continue;
        if (tile === TileType.WALL || tile === TileType.WINDOW_SPACE) {
          ctx.fillStyle = '#24344d';
        } else {
          ctx.fillStyle = '#0f1b30';
        }
        ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }

    // Energy Pipes on Deck Map
    ctx.strokeStyle = hud.powerRestored
      ? 'rgba(34, 211, 238, 0.55)'
      : 'rgba(56, 189, 248, 0.24)';
    ctx.lineWidth = 1;
    for (const pipe of world.energyPipes) {
      if (pipe.points.length < 2) continue;
      ctx.beginPath();
      pipe.points.forEach((pt, idx) => {
        const px = (pt.x / TILE_SIZE) * scale;
        const py = (pt.y / TILE_SIZE) * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Hazards markers on minimap
    for (const haz of world.hazards) {
      if (haz.stabilizedByPower && hud.powerRestored) continue;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.beginPath();
      ctx.arc(haz.tileX * scale, haz.tileY * scale, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Doors
    for (const door of world.doors) {
      ctx.fillStyle = door.locked
        ? '#ef4444'
        : door.isOpen
          ? '#22d3ee'
          : '#f59e0b';
      ctx.fillRect(
        door.tileX * scale,
        door.tileY * scale,
        door.tilesW * scale,
        door.tilesH * scale
      );
    }

    // Active Monsters & Creatures on Deck Map
    for (const m of world.monsters) {
      if (!m.active || !m.alive) continue;
      const mx = (m.x / TILE_SIZE) * scale;
      const my = (m.y / TILE_SIZE) * scale;
      ctx.fillStyle =
        m.tier === 'BOSS'
          ? '#ef4444'
          : m.tier === 'MODERATE'
            ? '#f59e0b'
            : m.archetype === 'ACID_SPITTER'
              ? '#4ade80'
              : '#fb7185';
      ctx.beginPath();
      ctx.arc(
        mx,
        my,
        m.tier === 'BOSS' ? 2.6 : m.tier === 'MODERATE' ? 1.9 : 1.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // THE LISTENER marker on Deck Map
    if (world.listener.active) {
      const lx = (world.listener.x / TILE_SIZE) * scale;
      const ly = (world.listener.y / TILE_SIZE) * scale;
      ctx.fillStyle =
        world.listener.state === 'HUNTING'
          ? '#ef4444'
          : world.listener.state === 'STAGGERED'
            ? '#64748b'
            : '#c084fc';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player marker + facing cone
    const px = (hud.playerTileX + 0.5) * scale;
    const py = (hud.playerTileY + 0.5) * scale;

    ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 8.5, hud.playerAngle - 0.5, hud.playerAngle + 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px, py, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }, [
    world,
    hud.playerTileX,
    hud.playerTileY,
    hud.playerAngle,
    hud.cards.length,
    hud.powerRestored,
    hud.moderateDefeated,
    hud.bossSpawned,
    hud.bossDefeated,
    hud.bossHp,
    hud.listenerState,
    hud.listenerDistance,
  ]);

  const integrityState =
    hud.suitIntegrity <= 30
      ? 'CRITICAL'
      : hud.suitIntegrity <= 65
        ? 'CAUTION'
        : 'STABLE';

  const integrityBarColor =
    hud.suitIntegrity <= 30
      ? 'bg-red-500'
      : hud.suitIntegrity <= 65
        ? 'bg-amber-400'
        : 'bg-cyan-400';

  const batteryBarColor =
    hud.battery <= 25
      ? 'bg-red-500'
      : hud.battery <= 50
        ? 'bg-amber-400'
        : 'bg-emerald-400';

  const listenerTextClass =
    hud.listenerState === 'HUNTING'
      ? 'text-red-400 font-semibold'
      : hud.listenerState === 'INVESTIGATING' ||
          hud.listenerState === 'SEARCHING'
        ? 'text-amber-300'
        : hud.listenerState === 'STAGGERED'
          ? 'text-slate-400'
          : 'text-purple-300';

  const totalDefeated = hud.moderateDefeated + (hud.bossDefeated ? 1 : 0);

  const showDangerVignette =
    Boolean(hud.activeHazardLabel) || hud.suitIntegrity <= 30;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-5">
      {/* Subtle red radial vignette during low suit integrity or active hazard */}
      {showDangerVignette && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, transparent 58%, rgba(220, 38, 38, 0.34) 100%)',
          }}
        />
      )}

      {/* Fixed Central First-Person Mining Laser Crosshair */}
      {hud.viewMode === 'FRONT_POV' && hud.gameState === 'PLAYING' && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="relative flex flex-col items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              className="overflow-visible drop-shadow-[0_0_2px_rgba(2,6,14,0.95)]"
            >
              {/* Subtle outer tactical brackets */}
              <circle
                cx="24"
                cy="24"
                r="14"
                fill="none"
                stroke="rgba(15, 23, 42, 0.65)"
                strokeWidth="2.5"
              />
              {/* Live laser thermal ring around reticle */}
              <circle
                cx="24"
                cy="24"
                r="14"
                fill="none"
                stroke={
                  hud.laserOverheated
                    ? '#ef4444'
                    : hud.laserHeat >= 70
                      ? '#f59e0b'
                      : '#22d3ee'
                }
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeDasharray={`${Math.round((hud.laserHeat / 100) * 88)} 88`}
                transform="rotate(-90 24 24)"
                opacity={hud.laserHeat > 4 ? 0.9 : 0.28}
              />

              {/* Dark contrast backing strokes for crosshair ticks */}
              <g stroke="rgba(2, 6, 14, 0.9)" strokeWidth="3.2" strokeLinecap="round">
                <line x1="24" y1="6" x2="24" y2="15" />
                <line x1="24" y1="33" x2="24" y2="42" />
                <line x1="6" y1="24" x2="15" y2="24" />
                <line x1="33" y1="24" x2="42" y2="24" />
              </g>

              {/* Precision illuminated crosshair ticks */}
              <g
                stroke={
                  hud.laserOverheated
                    ? '#f87171'
                    : hud.laserHeat >= 70
                      ? '#fbbf24'
                      : '#67e8f9'
                }
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <line x1="24" y1="6" x2="24" y2="15" />
                <line x1="24" y1="33" x2="24" y2="42" />
                <line x1="6" y1="24" x2="15" y2="24" />
                <line x1="33" y1="24" x2="42" y2="24" />
              </g>

              {/* Fixed center aiming dot */}
              <circle cx="24" cy="24" r="2.6" fill="rgba(2, 6, 14, 0.9)" />
              <circle
                cx="24"
                cy="24"
                r="1.6"
                fill={
                  hud.laserOverheated
                    ? '#ef4444'
                    : hud.laserHeat >= 70
                      ? '#fbbf24'
                      : '#67e8f9'
                }
              />
            </svg>

            {hud.laserOverheated && (
              <span className="mt-1 px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider text-red-200 bg-[#26080c]/90 border border-red-500/60 rounded-xs">
                LASER VENTING
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Compact Sector, Suit, Battery, Mining Laser, Beacons, Sound-Wave & Inventory */}
        <div className="w-56 bg-[#050a14]/88 border border-cyan-500/35 rounded-md px-3 py-2 shadow-lg">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 tracking-wide truncate">
            <Compass className="w-3 h-3 shrink-0" />
            <span className="truncate">{hud.sectorName}</span>
          </div>

          {/* Suit Integrity */}
          <div className="mt-1.5 pt-1.5 border-t border-slate-800/90">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Shield
                  className={`w-3 h-3 ${
                    hud.suitIntegrity <= 30 ? 'text-red-400' : 'text-cyan-400'
                  }`}
                />
                <span>Suit</span>
              </span>
              <span className="font-mono tabular-nums text-slate-200">
                {hud.suitIntegrity}% · {integrityState}
              </span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${integrityBarColor}`}
                style={{ width: `${hud.suitIntegrity}%` }}
              />
            </div>
          </div>

          {/* Battery Level */}
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="inline-flex items-center gap-1 text-slate-300">
                <BatteryCharging
                  className={`w-3 h-3 ${
                    hud.battery <= 25 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                />
                <span>Battery</span>
              </span>
              <span className="font-mono tabular-nums text-slate-200">
                {hud.battery}%
              </span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${batteryBarColor}`}
                style={{ width: `${hud.battery}%` }}
              />
            </div>
          </div>

          {/* Mining Laser Thermal Load */}
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Zap
                  className={`w-3 h-3 ${
                    hud.laserOverheated
                      ? 'text-red-400'
                      : hud.laserHeat >= 70
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                  }`}
                />
                <span>Laser</span>
              </span>
              <span
                className={`font-mono tabular-nums ${
                  hud.laserOverheated ? 'text-red-400 font-semibold' : 'text-slate-200'
                }`}
              >
                {hud.laserOverheated ? 'VENTING' : `${hud.laserHeat}%`}
              </span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.laserOverheated
                    ? 'bg-red-500'
                    : hud.laserHeat >= 70
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                }`}
                style={{ width: `${hud.laserHeat}%` }}
              />
            </div>
          </div>

          {/* Echo Beacon Count & Monsters Cleared */}
          <div className="mt-1.5 pt-1 border-t border-slate-800/90 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Radio className="w-3 h-3 text-cyan-400" />
              <span>
                Beacons{' '}
                <span className="text-cyan-300 font-mono tabular-nums">
                  {hud.echoBeacons}
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Skull className="w-3 h-3 text-red-400" />
              <span className="text-slate-100 font-mono tabular-nums">
                {totalDefeated}/5
              </span>
            </span>
          </div>

          {/* Enemy Detection Indicator: THE LISTENER */}
          <div className="mt-1 pt-1 border-t border-slate-800/90 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Waves className="w-3 h-3 text-purple-400" />
              <span>Listener</span>
            </span>
            <span className={`font-mono text-[9.5px] tabular-nums ${listenerTextClass}`}>
              {hud.bossDefeated
                ? 'CLEAR'
                : `${hud.listenerState} · ${hud.listenerDistance}m`}
            </span>
          </div>

          {/* Sound-Wave Acoustic Indicator */}
          <div className="mt-1 pt-1 border-t border-slate-800/90 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Radio
                className={`w-3 h-3 ${
                  hud.beaconPulseActive
                    ? 'text-cyan-300 animate-pulse'
                    : hud.soundPulseLevel > 45
                      ? 'text-amber-300'
                      : 'text-cyan-400'
                }`}
              />
              <span>{hud.beaconPulseActive ? 'Echo Wave' : 'Sound'}</span>
            </span>
            <div className="flex items-end gap-0.5 h-3" aria-label={`Acoustic level ${hud.soundPulseLevel}%`}>
              {[0.25, 0.55, 0.85, 1.0, 0.8, 0.5, 0.3].map((weight, idx) => {
                const activeH = Math.max(
                  2,
                  Math.round((hud.soundPulseLevel / 100) * weight * 12)
                );
                const barColor = hud.beaconPulseActive
                  ? 'bg-cyan-300'
                  : hud.soundPulseLevel >= 60
                    ? 'bg-amber-400'
                    : 'bg-cyan-500/80';
                return (
                  <span
                    key={idx}
                    className={`w-1 rounded-xs transition-all duration-100 ${barColor}`}
                    style={{ height: `${activeH}px` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Keycards Inventory & Auxiliary Power */}
          <div className="mt-1 pt-1 border-t border-slate-800/90 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <KeyRound className="w-3 h-3 text-cyan-400" />
              <span>
                Cards{' '}
                <span className="text-slate-100 font-mono tabular-nums">
                  {hud.cards.length}/3
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Zap
                className={`w-3 h-3 ${
                  hud.powerRestored ? 'text-cyan-400' : 'text-amber-400'
                }`}
              />
              <span
                className={
                  hud.powerRestored ? 'text-cyan-300' : 'text-amber-300'
                }
              >
                {hud.powerRestored ? 'Power On' : 'Standby'}
              </span>
            </span>
          </div>
          {hud.cards.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hud.cards.map((card) => (
                <span
                  key={card.id}
                  className="px-1.5 py-0.5 text-[9.5px] font-mono rounded-xs border border-cyan-500/35 bg-cyan-950/40 text-cyan-200"
                >
                  {card.shortName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Top-Center: Objective Bar + Enemy Detection Warning + Boss Health Bar */}
        <div className="hidden sm:flex flex-col items-center gap-2 max-w-md w-full">
          <div className="flex items-center gap-2.5 w-full bg-[#050a14]/90 border border-cyan-500/35 rounded-md px-3.5 py-2 shadow-lg">
            <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 shrink-0">
                  Objective
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold text-white truncate">
                  {hud.objectiveTitle}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {hud.objectiveDetail}
              </p>
            </div>
          </div>

          {!hud.bossDefeated &&
            (hud.listenerState === 'HUNTING' ||
              hud.listenerState === 'INVESTIGATING') && (
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border text-[11px] font-mono shadow-lg ${
                  hud.listenerState === 'HUNTING'
                    ? 'bg-[#26080c]/95 border-red-500/80 text-red-200'
                    : 'bg-[#1f1606]/95 border-amber-500/65 text-amber-200'
                }`}
              >
                <AlertTriangle
                  className={`w-3.5 h-3.5 shrink-0 ${
                    hud.listenerState === 'HUNTING'
                      ? 'text-red-400 animate-pulse'
                      : 'text-amber-400'
                  }`}
                />
                <span>
                  {hud.listenerState === 'HUNTING'
                    ? `WARNING · THE LISTENER HUNTING (${hud.listenerDistance}m) — DROP ECHO BEACON [Q]`
                    : `ECHO DECOY ACTIVE · THE LISTENER INVESTIGATING (${hud.listenerDistance}m)`}
                </span>
              </div>
            )}

          {hud.bossSpawned && !hud.bossDefeated && (
            <div className="w-full max-w-sm bg-[#1c070a]/92 border border-red-500/70 rounded-md px-3.5 py-2 shadow-lg">
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className="text-red-300 font-semibold truncate">
                  {hud.bossName}
                </span>
                <span className="text-amber-300 text-[10px] shrink-0 ml-2">
                  {hud.bossPhase === 2 ? 'PHASE 2: ENRAGED' : 'PHASE 1: ASSAULT'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-red-950 rounded-sm overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.bossPhase === 2 ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-right text-[10px] font-mono text-red-200 tabular-nums">
                {hud.bossHp}/{hud.bossMaxHp} HP
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: View Toggle, Clock, Mute, Pause */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleViewMode();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-[#060b16]/90 border border-slate-700/80 hover:border-cyan-400/60 text-slate-100 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Switch Camera View (V)"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {hud.viewMode === 'FRONT_POV' ? '3D First-Person' : '3D Tactical'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">V</span>
          </button>

          <div className="px-3 py-2 bg-[#060b16]/90 border border-slate-700/80 rounded-md text-xs font-mono text-slate-300 tabular-nums">
            {formatTime(hud.elapsedSeconds)}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="p-2.5 bg-[#060b16]/90 border border-slate-700/80 hover:border-cyan-400/60 text-slate-200 rounded-md transition-colors cursor-pointer"
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            title={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {hud.muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#060b16]/90 border border-slate-700/80 hover:border-cyan-400/60 text-slate-100 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pause</span>
            <span className="font-mono text-[11px] text-slate-400">Esc</span>
          </button>
        </div>
      </div>

      {/* Bottom Perimeter Row */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Compact Deck Radar */}
        <div className="flex flex-col items-start">
          <div className="bg-[#050a14]/88 border border-cyan-500/35 rounded-md p-1.5 shadow-lg">
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-0.5 px-0.5">
              <span>RADAR</span>
              <span className="text-cyan-400">E-9</span>
            </div>
            <canvas
              ref={minimapRef}
              width={112}
              height={84}
              className="block rounded-xs border border-slate-800"
            />
          </div>
        </div>

        {/* Bottom-Center: Hazard Warning, Toast, Interact Prompt & Mission Guide Subtitles */}
        <div className="flex flex-col items-center gap-2 mx-auto max-w-2xl">
          {hud.activeHazardLabel && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-[#26090c]/95 border-red-500/80 text-red-200 text-xs font-mono shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>HAZARD: {hud.activeHazardLabel}</span>
            </div>
          )}

          {hud.toastMessage && (
            <div
              className={`px-4 py-2 rounded-md border text-xs font-medium shadow-lg ${
                hud.toastTone === 'success'
                  ? 'bg-[#071a24]/95 border-cyan-500/60 text-cyan-200'
                  : hud.toastTone === 'warning'
                    ? 'bg-[#210b0e]/95 border-red-500/60 text-red-200'
                    : 'bg-[#081020]/95 border-slate-700 text-slate-200'
              }`}
            >
              {hud.toastMessage}
            </div>
          )}

          {hud.nearbyPrompt && (
            <div
              className={`px-4 py-2 rounded-md border text-xs font-mono shadow-lg ${
                hud.nearbyPrompt.lockedReason
                  ? 'bg-[#1c090c]/95 border-red-500/60 text-red-200'
                  : 'bg-[#061222]/95 border-cyan-400/60 text-cyan-100'
              }`}
            >
              {hud.nearbyPrompt.promptText}
            </div>
          )}

          {hud.gameState === 'PLAYING' && hud.guideSubtitle && (
            <div
              className="px-4 py-2 rounded-md border border-cyan-500/35 bg-[#040914]/90 text-center shadow-lg"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs leading-snug">
                <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 shrink-0">
                  {hud.guideHintTag}
                </span>
                <span className="text-slate-100 font-normal">
                  {hud.guideSubtitle}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Right Spacer to keep Center Prompts centered */}
        <div className="hidden md:block w-28 shrink-0" />
      </div>
    </div>
  );
};

