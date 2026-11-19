import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditsModal } from './components/CreditsModal';
import { FrequencyPuzzleModal } from './components/FrequencyPuzzleModal';
import { GameHUD } from './components/GameHUD';
import { GameOverModal } from './components/GameOverModal';
import { InstructionsModal } from './components/InstructionsModal';
import { PauseModal } from './components/PauseModal';
import { ReactorPuzzleModal } from './components/ReactorPuzzleModal';
import { SettingsModal } from './components/SettingsModal';
import { TerminalModal } from './components/TerminalModal';
import { TitleScreen } from './components/TitleScreen';
import { VictoryModal } from './components/VictoryModal';
import { GameEngine } from './game/engine';
import { SECTOR_NAMES, StationWorldData } from './game/stationMap';
import { EndingChoice, GameSettings, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'TITLE_MENU',
  viewMode: 'FRONT_POV',
  isPointerLocked: false,
  sector: 'ARRIVAL_BAY',
  sectorName: SECTOR_NAMES.ARRIVAL_BAY,
  objectiveTitle: 'Inspect Crash Wreck · Find Research Card',
  objectiveDetail:
    'Search the crashed Arrival Bay, kill Monster #1, and collect the Research Keycard in West Security.',
  cards: [],
  powerRestored: false,
  frequencySolved: false,
  signalActivated: false,
  suitIntegrity: 100,
  battery: 100,
  echoBeacons: 3,
  activeHazardLabel: null,
  nearbyPrompt: null,
  toastMessage: null,
  toastTone: 'info',
  activeTerminal: null,
  elapsedSeconds: 0,
  logsReadCount: 0,
  totalLogsCount: 7,
  muted: false,
  playerTileX: 31,
  playerTileY: 38,
  playerAngle: -Math.PI / 2,
  moderateDefeated: 0,
  moderateTotal: 4,
  bossSpawned: false,
  bossDefeated: false,
  bossPhase: 0,
  bossName: 'Apex Warlord · Final Boss',
  bossHp: 330,
  bossMaxHp: 330,
  listenerState: 'PATROL',
  listenerDistance: 18,
  gameOverReason: 'MONSTER_WIN',
  laserHeat: 0,
  laserOverheated: false,
  soundPulseLevel: 0,
  beaconPulseActive: false,
  hasSavedCheckpoint: false,
  endingChoice: 'EVACUATE_EARTH',
  guideHintTag: 'CRASH SITE · GUIDE',
  guideSubtitle:
    'ECHO-9 crashed on this monster world in 2189. Find the Research Keycard in Arrival Bay West Security and press [E].',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [worldData, setWorldData] = useState<StationWorldData | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settings, setSettings] = useState<GameSettings>({
    mouseSensitivity: 1.0,
    masterVolume: 0.8,
    highQualityLighting: true,
    muted: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showCredits, setShowCredits] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    setWorldData(engine.getWorldData());
    setSettings(engine.getSettings());
    engine.startLoop();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handlePlay = useCallback(() => {
    setShowSettings(false);
    setShowInstructions(false);
    setShowCredits(false);
    engineRef.current?.startGame();
  }, []);

  const handleContinue = useCallback(() => {
    setShowSettings(false);
    setShowInstructions(false);
    setShowCredits(false);
    engineRef.current?.continueGame();
  }, []);

  const handleUpdateSettings = useCallback((next: Partial<GameSettings>) => {
    engineRef.current?.updateSettings(next);
    if (engineRef.current) {
      setSettings(engineRef.current.getSettings());
    }
  }, []);

  const handleClearCheckpoint = useCallback(() => {
    engineRef.current?.clearSavedCheckpoint();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleResume = useCallback(() => {
    setShowSettings(false);
    setShowInstructions(false);
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    setShowSettings(false);
    setShowInstructions(false);
    engineRef.current?.restartGame();
  }, []);

  const handleMainMenu = useCallback(() => {
    setShowSettings(false);
    setShowInstructions(false);
    setShowCredits(false);
    engineRef.current?.returnToMainMenu();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
    if (engineRef.current) {
      setSettings(engineRef.current.getSettings());
    }
  }, []);

  const handleToggleViewMode = useCallback(() => {
    engineRef.current?.toggleViewMode();
  }, []);

  const handleCloseTerminal = useCallback(() => {
    engineRef.current?.closeTerminal();
  }, []);

  const handleTriggerTerminalAction = useCallback(() => {
    engineRef.current?.triggerTerminalAction();
  }, []);

  const handleCompleteEnding = useCallback((choice: EndingChoice) => {
    engineRef.current?.completeSignalEnding(choice);
  }, []);

  const handlePuzzleClick = useCallback(() => {
    engineRef.current?.playPuzzleClick();
  }, []);

  const handleMenuHover = useCallback((primary = false) => {
    engineRef.current?.playMenuHover(primary);
  }, []);

  const handleMenuConfirm = useCallback((primary = false) => {
    engineRef.current?.playMenuConfirm(primary);
  }, []);

  const handleUnlockAudio = useCallback(() => {
    engineRef.current?.unlockAudio();
  }, []);

  const handleSolveFrequency = useCallback(() => {
    engineRef.current?.completeFrequencyPuzzle();
  }, []);

  const handleSolveReactor = useCallback(() => {
    engineRef.current?.completeReactorPuzzle();
  }, []);

  const isPlayingOrOverlay = hud.gameState !== 'TITLE_MENU';

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#03060d]">
      {/* Isolated 60fps Canvas Viewport */}
      <div className="fixed inset-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Title Screen */}
      {hud.gameState === 'TITLE_MENU' && (
        <TitleScreen
          onPlay={handlePlay}
          onContinue={handleContinue}
          hasSavedCheckpoint={hud.hasSavedCheckpoint}
          onOpenSettings={() => setShowSettings(true)}
          onOpenInstructions={() => setShowInstructions(true)}
          onOpenCredits={() => setShowCredits(true)}
          muted={hud.muted}
          masterVolume={settings.masterVolume}
          onToggleMute={handleToggleMute}
          onButtonHover={handleMenuHover}
          onButtonClickSound={handleMenuConfirm}
          onUnlockAudio={handleUnlockAudio}
          modalOpen={showSettings || showInstructions || showCredits}
        />
      )}

      {/* In-Game HUD */}
      {isPlayingOrOverlay && (
        <GameHUD
          hud={hud}
          world={worldData}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onToggleViewMode={handleToggleViewMode}
        />
      )}

      {/* Interactive Computer Terminal */}
      {hud.gameState === 'TERMINAL' && hud.activeTerminal && (
        <TerminalModal
          terminal={hud.activeTerminal}
          powerRestored={hud.powerRestored}
          frequencySolved={hud.frequencySolved}
          threatsCleared={hud.moderateDefeated >= hud.moderateTotal && hud.bossDefeated}
          moderateDefeated={hud.moderateDefeated}
          moderateTotal={hud.moderateTotal}
          bossDefeated={hud.bossDefeated}
          onTriggerAction={handleTriggerTerminalAction}
          onCompleteEnding={handleCompleteEnding}
          onClose={handleCloseTerminal}
        />
      )}

      {/* Signal Frequency Calibration Puzzle */}
      {hud.gameState === 'PUZZLE_FREQUENCY' && (
        <FrequencyPuzzleModal
          onClickSound={handlePuzzleClick}
          onSolve={handleSolveFrequency}
          onClose={handleCloseTerminal}
        />
      )}

      {/* Reactor Power Balancing Puzzle */}
      {hud.gameState === 'PUZZLE_REACTOR' && (
        <ReactorPuzzleModal
          onClickSound={handlePuzzleClick}
          onSolve={handleSolveReactor}
          onClose={handleCloseTerminal}
        />
      )}

      {/* Pause Menu */}
      {hud.gameState === 'PAUSED' && !showInstructions && (
        <PauseModal
          muted={hud.muted}
          onResume={handleResume}
          onRestart={handleRestart}
          onOpenInstructions={() => setShowInstructions(true)}
          onToggleMute={handleToggleMute}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* Stage 1 Victory Modal */}
      {hud.gameState === 'VICTORY' && (
        <VictoryModal
          hud={hud}
          onPlayAgain={handleRestart}
          onContinueExploring={handleResume}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* Suit Breach Game Over Modal */}
      {hud.gameState === 'GAME_OVER' && (
        <GameOverModal
          hud={hud}
          onRestart={handleRestart}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* Settings, Instructions & Credits Modals */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          hasSavedCheckpoint={hud.hasSavedCheckpoint}
          onUpdateSettings={handleUpdateSettings}
          onClearCheckpoint={handleClearCheckpoint}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showInstructions && (
        <InstructionsModal onClose={() => setShowInstructions(false)} />
      )}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </main>
  );
}
