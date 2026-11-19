import { SoundEngine } from './audio';
import { ThreeStationRenderer } from './threeRenderer';
import {
  createStationWorld,
  getSectorAtWorldPos,
  KEYCARD_CATALOG,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_SPAWN,
  SECTOR_NAMES,
  StationWorldData,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './stationMap';
import {
  DoorEntity,
  EchoBeaconEntity,
  EndingChoice,
  GameOverReason,
  GameSettings,
  GameState,
  HudSnapshot,
  KeycardId,
  KeycardMeta,
  MonsterEntity,
  NearbyInteractable,
  Particle,
  PickupEntity,
  PlayerState,
  ProjectileEntity,
  SectorId,
  SuitStationEntity,
  TerminalEntity,
  TileType,
  ViewMode,
} from './types';

const SETTINGS_STORAGE_KEY = 'echo9_settings_v1';
const CHECKPOINT_STORAGE_KEY = 'echo9_checkpoint_v1';

interface SavedCheckpoint {
  sectorVisitedResearch: boolean;
  frequencySolved: boolean;
  powerRestored: boolean;
  cards: KeycardId[];
  logsRead: string[];
  echoBeaconsRemaining: number;
  elapsedSeconds: number;
  player: Pick<PlayerState, 'x' | 'y' | 'angle' | 'pitch' | 'suitIntegrity' | 'battery'>;
  doors: Array<{ id: string; locked: boolean; isOpen: boolean }>;
  pickupsCollected: string[];
  activatedTerminals: string[];
  monsters: Array<{ id: string; alive: boolean; active: boolean; hp: number; x: number; y: number }>;
  listener: { x: number; y: number; active: boolean; hp: number };
}

const LISTENER_PATROL_WAYPOINTS = [
  { x: 19.5 * TILE_SIZE, y: 23.5 * TILE_SIZE },
  { x: 15.5 * TILE_SIZE, y: 25.5 * TILE_SIZE },
  { x: 30.5 * TILE_SIZE, y: 22.5 * TILE_SIZE },
  { x: 20.5 * TILE_SIZE, y: 19.5 * TILE_SIZE },
  { x: 38.5 * TILE_SIZE, y: 8.5 * TILE_SIZE },
  { x: 28.5 * TILE_SIZE, y: 9.5 * TILE_SIZE },
];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private threeRenderer: ThreeStationRenderer;
  private sound: SoundEngine;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private world: StationWorldData;
  private player: PlayerState;
  private gameState: GameState = 'TITLE_MENU';
  private viewMode: ViewMode = 'FRONT_POV';
  private isPointerLocked = false;
  private settings: GameSettings = {
    mouseSensitivity: 1.0,
    masterVolume: 0.8,
    highQualityLighting: true,
    muted: false,
  };
  private endingChoice: EndingChoice = 'EVACUATE_EARTH';
  private soundPulseLevel = 0;
  private beaconParticleTimer = 0;

  private heldKeys = new Set<string>();
  private rafId: number | null = null;
  private timerId: number | null = null;
  private destroyed = false;
  private lastFrameTime = 0;
  private simTime = 0;
  private elapsedSeconds = 0;

  private camX = 0;
  private camY = 0;
  private shakeTimer = 0;
  private shakeMagnitude = 0;

  private viewportW = 1280;
  private viewportH = 720;
  private dpr = 1;

  // Progression flags
  private collectedCards = new Set<KeycardId>();
  private enteredResearch = false;
  private frequencySolved = false;
  private powerRestored = false;
  private signalActivated = false;
  private logsRead = new Set<string>();
  private activeTerminal: TerminalEntity | null = null;

  // Echo Beacon & Combat
  private echoBeaconsRemaining = 3;
  private activeBeacons: EchoBeaconEntity[] = [];
  private nextBeaconId = 1;

  // Hazard, combat & audio throttle
  private activeHazardLabel: string | null = null;
  private hazardShockCooldown = 0;
  private gameOverReason: GameOverReason = 'MONSTER_WIN';
  private projectiles: ProjectileEntity[] = [];
  private nextProjectileId = 1;
  private mouseClientX = 0;
  private mouseClientY = 0;
  private lastMouseClientX: number | null = null;
  private lastMouseClientY: number | null = null;
  private hasMousePos = false;
  private isMouseDown = false;
  private envFxTimer = 0;

  // UI feedback
  private nearbyPrompt: NearbyInteractable | null = null;
  private toastMessage: string | null = null;
  private toastTone: 'info' | 'success' | 'warning' = 'info';
  private toastTimer = 0;
  private lastHudSignature = '';
  private particles: Particle[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    onHudUpdate: (snapshot: HudSnapshot) => void
  ) {
    this.canvas = canvas;
    this.onHudUpdate = onHudUpdate;
    this.threeRenderer = new ThreeStationRenderer(canvas);
    this.sound = new SoundEngine();

    this.loadSettings();
    this.world = createStationWorld();
    this.threeRenderer.initWorld(this.world);
    this.player = this.createInitialPlayer();

    this.centerCameraImmediate();
    this.seedInitialParticles();
    this.bindEvents();
    this.handleResize();
    this.emitHud(true);
  }

  private createInitialPlayer(): PlayerState {
    return {
      x: PLAYER_SPAWN.x,
      y: PLAYER_SPAWN.y,
      vx: 0,
      vy: 0,
      angle: PLAYER_SPAWN.angle,
      targetAngle: PLAYER_SPAWN.angle,
      pitch: 0,
      radius: 14,
      walkCycle: 0,
      stepTimer: 0,
      suitIntegrity: 100,
      battery: 100,
      damageFlash: 0,
      fireCooldown: 0,
      muzzleFlash: 0,
      laserHeat: 0,
      laserOverheated: false,
    };
  }

  public getWorldData(): StationWorldData {
    return this.world;
  }

  public startLoop(): void {
    if (this.rafId !== null || this.timerId !== null) return;
    this.lastFrameTime = performance.now();

    const afterDraw = (done: () => void) => {
      if (this.threeRenderer.isSoftwareWebGL()) {
        const gl = this.threeRenderer.getWebGLContext();
        const isWebGL2 =
          typeof WebGL2RenderingContext !== 'undefined' &&
          gl instanceof WebGL2RenderingContext;
        const sync = isWebGL2
          ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
          : null;
        if (sync) gl.flush();
        const check = () => {
          if (this.destroyed) return;
          if (
            !sync ||
            !isWebGL2 ||
            gl.clientWaitSync(sync, 0, 0) !== gl.TIMEOUT_EXPIRED
          ) {
            if (sync && isWebGL2) gl.deleteSync(sync);
            this.timerId = window.setTimeout(done, 80);
          } else {
            this.rafId = requestAnimationFrame(check);
          }
        };
        this.rafId = requestAnimationFrame(check);
      } else {
        this.rafId = requestAnimationFrame(() => done());
      }
    };

    const tick = () => {
      if (this.destroyed) return;
      const now = performance.now();
      const rawDt = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();
      afterDraw(tick);
    };

    if (this.threeRenderer.isSoftwareWebGL()) {
      tick();
    } else {
      this.rafId = requestAnimationFrame(tick);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.sound.destroy();
    this.releasePointerLock();
    this.unbindEvents();
    this.threeRenderer.dispose();
  }

  private ensureGameFocus(): void {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        this.settings = {
          mouseSensitivity:
            typeof parsed.mouseSensitivity === 'number'
              ? Math.max(0.4, Math.min(2.2, parsed.mouseSensitivity))
              : 1.0,
          masterVolume:
            typeof parsed.masterVolume === 'number'
              ? Math.max(0, Math.min(1, parsed.masterVolume))
              : 0.8,
          highQualityLighting:
            typeof parsed.highQualityLighting === 'boolean'
              ? parsed.highQualityLighting
              : true,
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
        };
      }
    } catch {
      // Ignore storage errors
    }
    this.applyAudioAndGraphicsSettings();
  }

  private applyAudioAndGraphicsSettings(): void {
    this.sound.setVolume(this.settings.masterVolume);
    if (this.sound.isMuted() !== this.settings.muted) {
      this.sound.toggleMute();
    }
    this.threeRenderer.applySettings(this.settings.highQualityLighting);
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public updateSettings(next: Partial<GameSettings>): void {
    this.settings = {
      ...this.settings,
      ...next,
      mouseSensitivity:
        next.mouseSensitivity !== undefined
          ? Math.max(0.4, Math.min(2.2, next.mouseSensitivity))
          : this.settings.mouseSensitivity,
      masterVolume:
        next.masterVolume !== undefined
          ? Math.max(0, Math.min(1, next.masterVolume))
          : this.settings.masterVolume,
    };
    this.applyAudioAndGraphicsSettings();
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
    this.emitHud(true);
  }

  public hasSavedCheckpoint(): boolean {
    try {
      return Boolean(localStorage.getItem(CHECKPOINT_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  public clearSavedCheckpoint(): void {
    try {
      localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    this.emitHud(true);
  }

  private saveCheckpoint(): void {
    if (this.gameState === 'TITLE_MENU' || this.signalActivated) return;
    try {
      const payload: SavedCheckpoint = {
        sectorVisitedResearch: this.enteredResearch,
        frequencySolved: this.frequencySolved,
        powerRestored: this.powerRestored,
        cards: Array.from(this.collectedCards),
        logsRead: Array.from(this.logsRead),
        echoBeaconsRemaining: this.echoBeaconsRemaining,
        elapsedSeconds: Math.floor(this.elapsedSeconds),
        player: {
          x: this.player.x,
          y: this.player.y,
          angle: this.player.angle,
          pitch: this.player.pitch,
          suitIntegrity: Math.max(30, Math.round(this.player.suitIntegrity)),
          battery: Math.max(25, Math.round(this.player.battery)),
        },
        doors: this.world.doors.map((d) => ({
          id: d.id,
          locked: d.locked,
          isOpen: d.isOpen,
        })),
        pickupsCollected: this.world.pickups
          .filter((p) => p.collected)
          .map((p) => p.id),
        activatedTerminals: this.world.terminals
          .filter((t) => t.activated)
          .map((t) => t.id),
        monsters: this.world.monsters.map((m) => ({
          id: m.id,
          alive: m.alive,
          active: m.active,
          hp: m.hp,
          x: m.x,
          y: m.y,
        })),
        listener: {
          x: this.world.listener.x,
          y: this.world.listener.y,
          active: this.world.listener.active,
          hp: this.world.listener.hp,
        },
      };
      localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }

  public continueGame(): boolean {
    try {
      const raw = localStorage.getItem(CHECKPOINT_STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as SavedCheckpoint;

      this.resetWorldState();
      this.enteredResearch = saved.sectorVisitedResearch;
      this.frequencySolved = saved.frequencySolved;
      this.powerRestored = saved.powerRestored;
      this.collectedCards = new Set(saved.cards || []);
      this.logsRead = new Set(saved.logsRead || []);
      this.echoBeaconsRemaining = saved.echoBeaconsRemaining ?? 3;
      this.elapsedSeconds = saved.elapsedSeconds ?? 0;

      if (saved.player) {
        this.player.x = saved.player.x;
        this.player.y = saved.player.y;
        this.player.angle = saved.player.angle;
        this.player.targetAngle = saved.player.angle;
        this.player.pitch = saved.player.pitch || 0;
        this.player.suitIntegrity = saved.player.suitIntegrity ?? 100;
        this.player.battery = saved.player.battery ?? 100;
      }

      for (const sd of saved.doors || []) {
        const door = this.world.doors.find((d) => d.id === sd.id);
        if (door) {
          door.locked = sd.locked;
          door.isOpen = sd.isOpen;
          door.openProgress = sd.isOpen ? 1 : 0;
        }
      }
      for (const pid of saved.pickupsCollected || []) {
        const p = this.world.pickups.find((x) => x.id === pid);
        if (p) p.collected = true;
      }
      for (const tid of saved.activatedTerminals || []) {
        const t = this.world.terminals.find((x) => x.id === tid);
        if (t) t.activated = true;
      }
      for (const sm of saved.monsters || []) {
        const m = this.world.monsters.find((x) => x.id === sm.id);
        if (m) {
          m.alive = sm.alive;
          m.active = sm.active;
          m.hp = sm.hp;
          m.x = sm.x;
          m.y = sm.y;
        }
      }
      if (saved.listener) {
        this.world.listener.x = saved.listener.x;
        this.world.listener.y = saved.listener.y;
        this.world.listener.active = saved.listener.active;
        this.world.listener.hp = saved.listener.hp;
      }

      this.viewMode = 'FRONT_POV';
      this.gameState = 'PLAYING';
      this.lastMouseClientX = null;
      this.lastMouseClientY = null;
      this.ensureGameFocus();
      this.sound.startAmbient();
      this.sound.setAmbientLevel(true);
      this.centerCameraImmediate();
      this.showToast(
        `Checkpoint Restored · ${SECTOR_NAMES[getSectorAtWorldPos(this.player.x, this.player.y)]}`,
        'success',
        3.5
      );
      this.emitHud(true);
      return true;
    } catch {
      return false;
    }
  }

  public startGame(): void {
    this.resetWorldState();
    this.viewMode = 'FRONT_POV';
    this.gameState = 'PLAYING';
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
    this.ensureGameFocus();
    this.sound.startAmbient();
    this.sound.setAmbientLevel(true);
    this.centerCameraImmediate();
    this.saveCheckpoint();
    this.showToast(
      'First-Person Survival Mode · Move Mouse to Look · Q Echo Beacon · Click/Space Mining Laser',
      'info',
      4.5
    );
    this.emitHud(true);
  }

  public restartGame(): void {
    this.resetWorldState();
    this.viewMode = 'FRONT_POV';
    this.gameState = 'PLAYING';
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
    this.ensureGameFocus();
    this.sound.startAmbient();
    this.sound.setAmbientLevel(true);
    this.centerCameraImmediate();
    this.saveCheckpoint();
    this.showToast('Mission restarted · Arrival Bay', 'info', 2.8);
    this.emitHud(true);
  }

  public pauseGame(): void {
    if (this.gameState === 'PLAYING') {
      this.saveCheckpoint();
      this.heldKeys.clear();
      this.isMouseDown = false;
      this.releasePointerLock();
      this.gameState = 'PAUSED';
      this.sound.setAmbientLevel(false);
      this.emitHud(true);
    }
  }

  public resumeGame(): void {
    if (this.gameState === 'PAUSED' || this.gameState === 'VICTORY') {
      this.heldKeys.clear();
      this.isMouseDown = false;
      this.lastMouseClientX = null;
      this.lastMouseClientY = null;
      this.ensureGameFocus();
      this.gameState = 'PLAYING';
      this.sound.setAmbientLevel(true);
      this.emitHud(true);
    }
  }

  public returnToMainMenu(): void {
    this.heldKeys.clear();
    this.isMouseDown = false;
    this.releasePointerLock();
    this.resetWorldState();
    this.gameState = 'TITLE_MENU';
    this.sound.setAmbientLevel(false);
    this.emitHud(true);
  }

  public toggleViewMode(): void {
    this.viewMode =
      this.viewMode === 'TOP_DOWN' ? 'FRONT_POV' : 'TOP_DOWN';
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
    this.player.pitch = 0;
    this.ensureGameFocus();
    if (this.viewMode === 'TOP_DOWN') {
      this.releasePointerLock();
    }
    this.showToast(
      this.viewMode === 'FRONT_POV'
        ? 'Switched to 3D First-Person POV (Move Mouse to Look & Turn)'
        : 'Switched to 3D Tactical View (Move Mouse to Turn & Aim)',
      'info',
      2.4
    );
    this.emitHud(true);
  }

  public closeTerminal(): void {
    if (
      this.gameState === 'TERMINAL' ||
      this.gameState === 'PUZZLE_FREQUENCY' ||
      this.gameState === 'PUZZLE_REACTOR'
    ) {
      this.activeTerminal = null;
      this.gameState = 'PLAYING';
      this.heldKeys.clear();
      this.emitHud(true);
    }
  }

  public playPuzzleClick(): void {
    this.sound.playPuzzleClick();
  }

  public unlockAudio(): void {
    this.sound.unlockAudio();
  }

  public playMenuHover(primary = false): void {
    this.sound.playMenuHover(primary);
  }

  public playMenuConfirm(primary = false): void {
    this.sound.playMenuConfirm(primary);
  }

  public completeFrequencyPuzzle(): void {
    if (this.frequencySolved) return;
    this.frequencySolved = true;
    const freqTerm = this.world.terminals.find(
      (t) => t.id === 'term_frequency'
    );
    if (freqTerm) {
      freqTerm.activated = true;
      this.logsRead.add(freqTerm.id);
    }
    this.echoBeaconsRemaining += 1;
    this.activeTerminal = null;
    this.gameState = 'PLAYING';
    this.sound.playPuzzleSolved();
    this.saveCheckpoint();
    this.showToast(
      'Signal Frequency Locked (448.92 MHz) · +1 Echo Beacon Awarded',
      'success',
      4.2
    );
    this.emitHud(true);
  }

  public completeReactorPuzzle(): void {
    if (this.powerRestored) return;
    this.powerRestored = true;
    const powTerm = this.world.terminals.find((t) => t.id === 'term_power');
    if (powTerm) {
      powTerm.activated = true;
      this.logsRead.add(powTerm.id);
    }
    this.activeTerminal = null;
    this.gameState = 'PLAYING';
    this.sound.playPowerSurge();
    this.triggerShake(0.45, 5);
    this.saveCheckpoint();
    this.showToast(
      'Reactor Balanced & Auxiliary Power Restored · Pipes Energized!',
      'success',
      4.2
    );
    this.emitHud(true);
  }

  public triggerTerminalAction(): void {
    this.completeSignalEnding('EVACUATE_EARTH');
  }

  public completeSignalEnding(choice: EndingChoice): void {
    const term = this.activeTerminal;
    if (!term || term.activated) return;

    if (term.actionType === 'SOLVE_FREQUENCY') {
      this.gameState = 'PUZZLE_FREQUENCY';
      this.emitHud(true);
      return;
    }

    if (term.actionType === 'RESTORE_POWER') {
      this.gameState = 'PUZZLE_REACTOR';
      this.emitHud(true);
      return;
    }

    if (term.actionType === 'ACTIVATE_SIGNAL') {
      const moderateDefeated = this.world.monsters.filter(
        (m) => m.tier === 'MODERATE' && !m.alive
      ).length;
      const boss = this.world.monsters.find((m) => m.tier === 'BOSS');
      if (moderateDefeated < 4 || (boss && boss.alive)) {
        this.sound.playLocked();
        this.showToast(
          'Earth Signal Blocked — Fix ship defects and kill all 4 monsters & the Final Boss first!',
          'warning',
          3.4
        );
        return;
      }
      term.activated = true;
      this.signalActivated = true;
      this.endingChoice = choice;
      this.world.listener.active = false;
      this.sound.playPowerSurge();
      this.triggerShake(0.55, 6);
      this.activeTerminal = null;
      this.releasePointerLock();
      this.gameState = 'VICTORY';
      this.sound.setAmbientLevel(false);
      this.clearSavedCheckpoint();
      this.emitHud(true);
    }
  }

  public toggleMute(): void {
    this.sound.toggleMute();
    this.settings.muted = this.sound.isMuted();
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
    this.emitHud(true);
  }

  private resetWorldState(): void {
    this.world = createStationWorld();
    this.threeRenderer.initWorld(this.world);
    this.player = this.createInitialPlayer();
    this.collectedCards.clear();
    this.enteredResearch = false;
    this.frequencySolved = false;
    this.powerRestored = false;
    this.signalActivated = false;
    this.endingChoice = 'EVACUATE_EARTH';
    this.soundPulseLevel = 0;
    this.beaconParticleTimer = 0;
    this.logsRead.clear();
    this.activeTerminal = null;
    this.echoBeaconsRemaining = 3;
    this.activeBeacons = [];
    this.activeHazardLabel = null;
    this.hazardShockCooldown = 0;
    this.gameOverReason = 'MONSTER_WIN';
    this.projectiles = [];
    this.nearbyPrompt = null;
    this.toastMessage = null;
    this.toastTimer = 0;
    this.elapsedSeconds = 0;
    this.heldKeys.clear();
    this.particles = [];
    this.seedInitialParticles();
  }

  private centerCameraImmediate(): void {
    this.camX = Math.max(
      0,
      Math.min(WORLD_WIDTH - this.viewportW, this.player.x - this.viewportW / 2)
    );
    this.camY = Math.max(
      0,
      Math.min(WORLD_HEIGHT - this.viewportH, this.player.y - this.viewportH / 2)
    );
  }

  private seedInitialParticles(): void {
    for (let i = 0; i < 90; i++) {
      this.spawnAmbientParticle();
    }
  }

  private spawnAmbientParticle(): void {
    const x = 4 * TILE_SIZE + Math.random() * (WORLD_WIDTH - 8 * TILE_SIZE);
    const y = 3 * TILE_SIZE + Math.random() * (WORLD_HEIGHT - 6 * TILE_SIZE);
    const maxLife = 3 + Math.random() * 5;
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 12,
      size: 1 + Math.random() * 1.6,
      alpha: 0.25 + Math.random() * 0.35,
      life: Math.random() * maxLife * 0.5,
      maxLife,
      color: Math.random() > 0.25 ? '#7dd3fc' : '#f87171',
      kind: 'MOTE',
    });
  }

  private spawnEnvSparksAndSmoke(): void {
    for (const prop of this.world.props) {
      if (prop.kind === 'DAMAGED_PANEL' && Math.random() < 0.38) {
        this.spawnBurst(
          prop.x + prop.w * 0.5,
          prop.y + prop.h * 0.5,
          Math.random() > 0.4 ? '#38bdf8' : '#f59e0b',
          4
        );
      } else if (prop.kind === 'DAMAGED_GENERATOR') {
        const gx = prop.x + prop.w * 0.5;
        const gy = prop.y + prop.h * 0.45;
        if (Math.random() < 0.55) {
          this.particles.push({
            x: gx + (Math.random() - 0.5) * 18,
            y: gy,
            vx: (Math.random() - 0.5) * 10,
            vy: -16 - Math.random() * 14,
            size: 5 + Math.random() * 6,
            alpha: 0.24,
            life: 0,
            maxLife: 1.4 + Math.random() * 0.8,
            color: '#94a3b8',
            kind: 'SMOKE',
          });
        }
        if (Math.random() < 0.35) {
          this.spawnBurst(gx, gy, '#f59e0b', 4);
        }
      }
    }
  }

  private spawnBurst(x: number, y: number, color: string, count = 14): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 95;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        alpha: 0.9,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        color,
        kind: 'SPARK',
      });
    }
  }

  private triggerShake(duration: number, magnitude: number): void {
    this.shakeTimer = duration;
    this.shakeMagnitude = magnitude;
  }

  private showToast(
    message: string,
    tone: 'info' | 'success' | 'warning' = 'info',
    duration = 3
  ): void {
    this.toastMessage = message;
    this.toastTone = tone;
    this.toastTimer = duration;
    this.emitHud(true);
  }

  private update(dt: number): void {
    this.simTime += dt;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'SMOKE') {
        p.size += dt * 4;
      }
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
    while (this.particles.length < 95) {
      this.spawnAmbientParticle();
    }

    this.envFxTimer += dt;
    if (this.envFxTimer >= 0.45) {
      this.envFxTimer = 0;
      this.spawnEnvSparksAndSmoke();
    }

    if (this.gameState === 'TITLE_MENU') {
      // Smooth atmospheric glide across Command Deck, Planet Observation Window & Reactor
      const targetX = (31.5 + Math.sin(this.simTime * 0.14) * 14) * TILE_SIZE;
      const targetY = (17 + Math.cos(this.simTime * 0.11) * 11) * TILE_SIZE;
      this.player.x = (31.5 + Math.sin(this.simTime * 0.22) * 3.8) * TILE_SIZE;
      this.player.y = (7.2 + Math.cos(this.simTime * 0.16) * 1.4) * TILE_SIZE;
      this.player.angle = -Math.PI / 2 + Math.sin(this.simTime * 0.25) * 0.55;
      this.camX = Math.max(
        0,
        Math.min(WORLD_WIDTH - this.viewportW, targetX - this.viewportW / 2)
      );
      this.camY = Math.max(
        0,
        Math.min(WORLD_HEIGHT - this.viewportH, targetY - this.viewportH / 2)
      );
      return;
    }

    if (this.gameState !== 'PLAYING') {
      return;
    }

    this.elapsedSeconds += dt;

    // Toast timer
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastMessage = null;
        this.toastTimer = 0;
      }
    }

    // Screen shake, combat timers & battery drain
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
    if (this.player.damageFlash > 0) {
      this.player.damageFlash = Math.max(0, this.player.damageFlash - dt * 2.2);
    }
    if (this.player.fireCooldown > 0) {
      this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);
    }
    if (this.player.muzzleFlash > 0) {
      this.player.muzzleFlash = Math.max(0, this.player.muzzleFlash - dt * 9);
    }
    if (this.hazardShockCooldown > 0) {
      this.hazardShockCooldown = Math.max(0, this.hazardShockCooldown - dt);
    }

    // Mining Laser thermal dissipation & overheat recovery
    if (this.player.laserHeat > 0) {
      const coolRate = this.player.laserOverheated ? 34 : 26;
      this.player.laserHeat = Math.max(0, this.player.laserHeat - coolRate * dt);
      if (this.player.laserOverheated && this.player.laserHeat <= 25) {
        this.player.laserOverheated = false;
        this.showToast('Mining Laser cooled — Ready', 'info', 1.8);
      }
    }

    // Hold-to-fire Mining Laser (Mouse Hold, Space, or F)
    if (
      this.isMouseDown ||
      this.heldKeys.has('Space') ||
      this.heldKeys.has('KeyF')
    ) {
      this.triggerLaserWithAim();
    }

    // Suit battery slowly drains above emergency 15% reserve
    if (this.player.battery > 15) {
      this.player.battery = Math.max(15, this.player.battery - dt * 0.45);
    }

    // Active Echo Beacons update + cyan sound-wave particles
    for (let i = this.activeBeacons.length - 1; i >= 0; i--) {
      this.activeBeacons[i].life -= dt;
      if (this.activeBeacons[i].life <= 0) {
        this.activeBeacons.splice(i, 1);
      }
    }

    if (this.activeBeacons.length > 0) {
      this.soundPulseLevel = Math.max(this.soundPulseLevel, 48);
      this.beaconParticleTimer += dt;
      if (this.beaconParticleTimer >= 0.14) {
        this.beaconParticleTimer = 0;
        for (const b of this.activeBeacons) {
          for (let k = 0; k < 4; k++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 45 + Math.random() * 65;
            this.particles.push({
              x: b.x + Math.cos(ang) * 10,
              y: b.y + Math.sin(ang) * 10,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              size: 1.8,
              alpha: 0.9,
              life: 0,
              maxLife: 0.45,
              color: k % 2 === 0 ? '#22d3ee' : '#67e8f9',
              kind: 'SPARK',
            });
          }
        }
      }
    } else if (this.soundPulseLevel > 0) {
      this.soundPulseLevel = Math.max(0, this.soundPulseLevel - dt * 45);
    }

    // Suit station cooldowns
    for (const s of this.world.suitStations) {
      if (s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
    }

    // Animate door slides
    for (const door of this.world.doors) {
      const target = door.isOpen ? 1 : 0;
      const diff = target - door.openProgress;
      if (Math.abs(diff) > 0.005) {
        door.openProgress += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.4);
      } else {
        door.openProgress = target;
      }
    }

    // Update player movement & collision
    if (this.viewMode === 'FRONT_POV') {
      this.updatePlayerFrontPov(dt);
    } else {
      this.updatePlayerTopDown(dt);
    }

    // Update monsters, THE LISTENER, projectiles, and environmental hazards
    this.updateMonsters(dt);
    this.updateListener(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);

    // Check sector progression
    const sector = getSectorAtWorldPos(this.player.x, this.player.y);
    if (sector === 'RESEARCH_LAB' && !this.enteredResearch) {
      this.enteredResearch = true;
      this.saveCheckpoint();
      this.showToast('Entered Sector 02: Research Lab', 'info', 3);
    }

    // Update nearby interactable
    this.nearbyPrompt = this.findNearbyInteractable();

    // Smooth camera follow in Top-Down mode
    const lookAheadX = this.player.vx * 0.14;
    const lookAheadY = this.player.vy * 0.14;
    const targetCamX = Math.max(
      0,
      Math.min(
        WORLD_WIDTH - this.viewportW,
        this.player.x + lookAheadX - this.viewportW / 2
      )
    );
    const targetCamY = Math.max(
      0,
      Math.min(
        WORLD_HEIGHT - this.viewportH,
        this.player.y + lookAheadY - this.viewportH / 2
      )
    );
    const camLerp = 1 - Math.exp(-8.5 * dt);
    this.camX += (targetCamX - this.camX) * camLerp;
    this.camY += (targetCamY - this.camY) * camLerp;

    this.emitHud(false);
  }

  private updatePlayerFrontPov(dt: number): void {
    let forward = 0;
    let strafe = 0;
    let turn = 0;

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) forward += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) forward -= 1;

    if (this.heldKeys.has('KeyA')) strafe -= 1;
    if (this.heldKeys.has('KeyD')) strafe += 1;

    // Keyboard backup turn with Left/Right arrows while external mouse handles primary turning
    if (this.heldKeys.has('ArrowLeft')) turn -= 1;
    if (this.heldKeys.has('ArrowRight')) turn += 1;

    // Gentle edge-turning with external mouse when pointer lock is inactive (e.g. iframe preview)
    if (!this.isPointerLocked && this.hasMousePos) {
      const inHudBand =
        this.mouseClientY < 96 || this.mouseClientY > this.viewportH - 96;
      if (!inHudBand) {
        const edgeBand = this.viewportW * 0.08;
        if (this.mouseClientX < edgeBand) {
          const factor = 1 - Math.max(0, this.mouseClientX) / edgeBand;
          turn -= 0.85 * factor;
        } else if (this.mouseClientX > this.viewportW - edgeBand) {
          const factor =
            1 - Math.max(0, this.viewportW - this.mouseClientX) / edgeBand;
          turn += 0.85 * factor;
        }
      }
    }

    const turnSpeed = 2.45;
    if (turn !== 0) {
      this.player.angle += turn * turnSpeed * dt;
      this.player.targetAngle = this.player.angle;
    }

    const cosA = Math.cos(this.player.angle);
    const sinA = Math.sin(this.player.angle);
    let moveX = cosA * forward - sinA * strafe;
    let moveY = sinA * forward + cosA * strafe;

    const mag = Math.hypot(moveX, moveY);
    if (mag > 0) {
      moveX /= mag;
      moveY /= mag;
    }

    const maxSpeed = 205;
    const targetVx = moveX * maxSpeed;
    const targetVy = moveY * maxSpeed;
    const accelRate = mag > 0 ? 15 : 18;
    const blend = 1 - Math.exp(-accelRate * dt);

    this.player.vx += (targetVx - this.player.vx) * blend;
    this.player.vy += (targetVy - this.player.vy) * blend;

    if (Math.abs(this.player.vx) < 1) this.player.vx = 0;
    if (Math.abs(this.player.vy) < 1) this.player.vy = 0;

    this.applyMovementAndSteps(dt);
  }

  private updatePlayerTopDown(dt: number): void {
    let moveX = 0;
    let moveY = 0;

    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveY -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveY += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight'))
      moveX += 1;

    const mag = Math.hypot(moveX, moveY);
    if (mag > 0) {
      moveX /= mag;
      moveY /= mag;
    }

    // Turn character continuously toward external mouse cursor on the 3D floor plane
    let aimedByMouse = false;
    if (this.hasMousePos) {
      const worldPt = this.threeRenderer.screenToFloorWorld(
        this.mouseClientX,
        this.mouseClientY
      );
      if (worldPt) {
        const dx = worldPt.x - this.player.x;
        const dy = worldPt.y - this.player.y;
        if (dx * dx + dy * dy > 16) {
          this.player.targetAngle = Math.atan2(dy, dx);
          aimedByMouse = true;
        }
      }
    }
    if (!aimedByMouse && mag > 0) {
      this.player.targetAngle = Math.atan2(moveY, moveX);
    }

    const maxSpeed = 218;
    const targetVx = moveX * maxSpeed;
    const targetVy = moveY * maxSpeed;
    const accelRate = mag > 0 ? 15 : 18;
    const blend = 1 - Math.exp(-accelRate * dt);

    this.player.vx += (targetVx - this.player.vx) * blend;
    this.player.vy += (targetVy - this.player.vy) * blend;

    if (Math.abs(this.player.vx) < 1) this.player.vx = 0;
    if (Math.abs(this.player.vy) < 1) this.player.vy = 0;

    let angleDiff = this.player.targetAngle - this.player.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.player.angle += angleDiff * Math.min(1, dt * 18);

    this.applyMovementAndSteps(dt);
  }

  private applyMovementAndSteps(dt: number): void {
    const dx = this.player.vx * dt;
    const dy = this.player.vy * dt;

    if (dx !== 0) {
      this.player.x += dx;
      this.resolveCollisions();
    }
    if (dy !== 0) {
      this.player.y += dy;
      this.resolveCollisions();
    }

    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (speed > 25) {
      this.player.walkCycle += dt * (speed / 22);
      this.player.stepTimer += dt;
      if (this.player.stepTimer >= 0.34) {
        this.player.stepTimer = 0;
        const col = Math.floor(this.player.x / TILE_SIZE);
        const row = Math.floor(this.player.y / TILE_SIZE);
        const tile = this.world.grid[row]?.[col];
        this.sound.playFootstep(tile === TileType.FLOOR_GRATE);
        this.soundPulseLevel = Math.max(this.soundPulseLevel, 28);
        this.notifyListenerSound(this.player.x, this.player.y, 180, false);
      }
    } else {
      this.player.stepTimer = 0.22;
    }
  }

  private deployEchoBeacon(): void {
    if (this.gameState !== 'PLAYING') return;
    if (this.echoBeaconsRemaining <= 0) {
      this.sound.playLocked();
      this.showToast(
        'No Echo Beacons left — Find Beacon Packs in Cargo or Cryo Ward',
        'warning',
        2.6
      );
      return;
    }

    this.echoBeaconsRemaining -= 1;
    let bx = this.player.x + Math.cos(this.player.angle) * 34;
    let by = this.player.y + Math.sin(this.player.angle) * 34;
    if (this.isPointBlocked(bx, by)) {
      bx = this.player.x;
      by = this.player.y;
    }

    this.activeBeacons.push({
      id: this.nextBeaconId++,
      x: bx,
      y: by,
      life: 6.5,
      maxLife: 6.5,
    });

    this.soundPulseLevel = 100;
    this.sound.playEchoBeaconPing();
    this.spawnBurst(bx, by, '#22d3ee', 18);
    this.notifyListenerSound(bx, by, 760, true);
    this.showToast(
      `Echo Beacon Deployed (${this.echoBeaconsRemaining} left) — Luring THE LISTENER`,
      'info',
      2.6
    );
    this.emitHud(true);
  }

  private notifyListenerSound(
    sx: number,
    sy: number,
    hearRadius: number,
    isBeacon: boolean
  ): void {
    const l = this.world.listener;
    if (!l.active || l.state === 'STAGGERED') return;

    const dist = Math.hypot(sx - l.x, sy - l.y);
    if (dist <= hearRadius) {
      // Echo Beacon overrides hunting or patrol to distract THE LISTENER!
      if (isBeacon || l.state !== 'HUNTING') {
        const prevState = l.state;
        l.state = 'INVESTIGATING';
        l.targetX = sx;
        l.targetY = sy;
        l.stateTimer = isBeacon ? 6.5 : 4.2;
        if (prevState === 'PATROL' || isBeacon) {
          this.sound.playListenerAlert(false);
        }
      }
    }
  }

  private updateListener(dt: number): void {
    const l = this.world.listener;
    if (!l.active) return;

    if (l.attackCooldown > 0) {
      l.attackCooldown = Math.max(0, l.attackCooldown - dt);
    }
    if (l.hitFlash > 0) {
      l.hitFlash = Math.max(0, l.hitFlash - dt * 5);
    }

    if (l.state === 'STAGGERED') {
      l.stunTimer -= dt;
      if (l.stunTimer <= 0) {
        l.hp = l.maxHp;
        l.state = 'PATROL';
        this.showToast('THE LISTENER has recovered and resumed stalking!', 'warning', 3);
      }
      return;
    }

    // Escalate Listener danger as player progresses
    const progressionLevel =
      (this.collectedCards.size >= 1 ? 1 : 0) +
      (this.frequencySolved ? 1 : 0) +
      (this.powerRestored ? 1 : 0);
    const speedScale = 1 + progressionLevel * 0.14;

    const dxToPlayer = this.player.x - l.x;
    const dyToPlayer = this.player.y - l.y;
    const distToPlayer = Math.hypot(dxToPlayer, dyToPlayer);
    const hasBeaconActive = this.activeBeacons.length > 0;

    // Detect player directly if close & visible, unless distracted by an Echo Beacon!
    if (
      !hasBeaconActive &&
      distToPlayer < 245 &&
      this.hasLineOfSight(l.x, l.y, this.player.x, this.player.y)
    ) {
      if (l.state !== 'HUNTING') {
        l.state = 'HUNTING';
        this.sound.playListenerAlert(true);
      }
      l.targetX = this.player.x;
      l.targetY = this.player.y;
      l.stateTimer = 4.5;
    }

    if (l.state === 'HUNTING') {
      l.stateTimer -= dt;
      if (
        distToPlayer < 280 &&
        this.hasLineOfSight(l.x, l.y, this.player.x, this.player.y)
      ) {
        l.targetX = this.player.x;
        l.targetY = this.player.y;
        l.stateTimer = 3.5;
      }

      if (distToPlayer <= l.radius + this.player.radius + 14) {
        if (l.attackCooldown <= 0) {
          l.attackCooldown = 1.2;
          this.sound.playMonsterSlash();
          this.triggerShake(0.22, 5);
          this.damagePlayer(16, 'MONSTER_WIN');
          this.spawnBurst(this.player.x, this.player.y, '#ef4444', 10);
        }
      } else {
        this.moveListenerToward(l.targetX, l.targetY, 128 * speedScale, dt);
      }

      if (l.stateTimer <= 0) {
        l.state = 'SEARCHING';
        l.stateTimer = 3.5;
      }
    } else if (l.state === 'INVESTIGATING') {
      l.stateTimer -= dt;
      const distTarget = Math.hypot(l.targetX - l.x, l.targetY - l.y);
      if (distTarget > 24) {
        this.moveListenerToward(l.targetX, l.targetY, 108 * speedScale, dt);
      } else {
        l.state = 'SEARCHING';
        l.stateTimer = 3.8;
      }
      if (l.stateTimer <= 0) {
        l.state = 'SEARCHING';
        l.stateTimer = 3.0;
      }
    } else if (l.state === 'SEARCHING') {
      l.stateTimer -= dt;
      l.angle += dt * 1.9;
      if (l.stateTimer <= 0) {
        l.state = 'PATROL';
      }
    } else {
      // PATROL
      const wp = LISTENER_PATROL_WAYPOINTS[l.patrolIndex];
      const distWp = Math.hypot(wp.x - l.x, wp.y - l.y);
      if (distWp < 28) {
        l.patrolIndex = (l.patrolIndex + 1) % LISTENER_PATROL_WAYPOINTS.length;
      } else {
        this.moveListenerToward(wp.x, wp.y, l.speed * speedScale, dt);
      }
    }
  }

  private moveListenerToward(
    tx: number,
    ty: number,
    speed: number,
    dt: number
  ): void {
    const l = this.world.listener;
    const dx = tx - l.x;
    const dy = ty - l.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    l.angle = Math.atan2(dy, dx);
    const step = Math.min(dist, speed * dt);
    const mx = (dx / dist) * step;
    const my = (dy / dist) * step;

    if (mx !== 0) {
      l.x += mx;
      this.resolveCircleCollisions(l);
    }
    if (my !== 0) {
      l.y += my;
      this.resolveCircleCollisions(l);
    }
  }

  private updateHazards(dt: number): void {
    let currentHazard: string | null = null;
    let totalDamagePerSec = 0;

    for (const hazard of this.world.hazards) {
      if (hazard.stabilizedByPower && this.powerRestored) continue;
      const hx = hazard.tileX * TILE_SIZE;
      const hy = hazard.tileY * TILE_SIZE;
      const dist = Math.hypot(this.player.x - hx, this.player.y - hy);
      if (dist <= hazard.radius + this.player.radius * 0.4) {
        currentHazard = hazard.label;
        totalDamagePerSec += hazard.damagePerSec;
      }
    }

    this.activeHazardLabel = currentHazard;

    if (totalDamagePerSec > 0) {
      this.damagePlayer(totalDamagePerSec * dt, 'HAZARD');
      if (this.hazardShockCooldown <= 0) {
        this.sound.playHazardShock();
        this.triggerShake(0.14, 3);
        this.hazardShockCooldown = 0.55;
      }
    }
  }

  private damagePlayer(amount: number, reason: GameOverReason): void {
    if (this.gameState !== 'PLAYING') return;
    this.player.suitIntegrity = Math.max(0, this.player.suitIntegrity - amount);
    this.player.damageFlash = 0.9;

    if (this.player.suitIntegrity <= 0) {
      this.player.suitIntegrity = 0;
      this.gameOverReason = reason;
      this.heldKeys.clear();
      this.isMouseDown = false;
      this.releasePointerLock();
      this.gameState = 'GAME_OVER';
      this.sound.setAmbientLevel(false);
      this.sound.playGameOver();
      this.emitHud(true);
    }
  }

  private triggerLaserWithAim(): void {
    if (this.viewMode === 'TOP_DOWN' && this.hasMousePos) {
      const worldPt = this.threeRenderer.screenToFloorWorld(
        this.mouseClientX,
        this.mouseClientY
      );
      if (worldPt) {
        const aimAngle = Math.atan2(
          worldPt.y - this.player.y,
          worldPt.x - this.player.x
        );
        this.fireMiningLaser(aimAngle);
        return;
      }
    }
    this.fireMiningLaser();
  }

  private fireMiningLaser(aimOverrideAngle?: number): void {
    if (this.gameState !== 'PLAYING') return;
    if (this.player.laserOverheated || this.player.fireCooldown > 0) return;

    this.player.fireCooldown = 0.16;
    this.player.muzzleFlash = 1;
    this.player.battery = Math.max(15, this.player.battery - 0.8);
    this.player.laserHeat = Math.min(100, this.player.laserHeat + 15);

    const angle = aimOverrideAngle ?? this.player.angle;
    if (aimOverrideAngle !== undefined) {
      this.player.angle = aimOverrideAngle;
      this.player.targetAngle = aimOverrideAngle;
    }

    const spawnDist = this.player.radius + 12;
    const bx = this.player.x + Math.cos(angle) * spawnDist;
    const by = this.player.y + Math.sin(angle) * spawnDist;
    const speed = 820;

    this.projectiles.push({
      id: this.nextProjectileId++,
      fromPlayer: true,
      kind: 'MINING_LASER',
      x: bx,
      y: by,
      prevX: bx,
      prevY: by,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 5,
      damage: 32,
      knockback: 135,
      life: 1.35,
      color: '#22d3ee',
    });

    this.sound.playMiningLaserFire();
    this.soundPulseLevel = Math.max(this.soundPulseLevel, 64);
    this.spawnBurst(bx, by, '#67e8f9', 5);
    this.notifyListenerSound(this.player.x, this.player.y, 460, false);

    if (this.player.laserHeat >= 100) {
      this.player.laserOverheated = true;
      this.sound.playLaserOverheat();
      this.spawnBurst(bx, by, '#f59e0b', 10);
      this.showToast(
        'Mining Laser Overheated — Venting Thermal Coils',
        'warning',
        2.2
      );
    }

    // Alert nearby station creatures to laser discharge
    for (const m of this.world.monsters) {
      if (!m.active || !m.alive) continue;
      if (
        m.aiState === 'PATROL' &&
        Math.hypot(this.player.x - m.x, this.player.y - m.y) <= 400
      ) {
        m.aiState = 'ALERT';
        m.stateTimer = 3.8;
      }
    }
  }

  private updateMonsters(dt: number): void {
    const playerSector = getSectorAtWorldPos(this.player.x, this.player.y);

    for (const m of this.world.monsters) {
      if (!m.active || !m.alive) continue;

      if (m.attackCooldown > 0) {
        m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      }
      if (m.hitFlash > 0) {
        m.hitFlash = Math.max(0, m.hitFlash - dt * 5);
      }

      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const dist = Math.hypot(dx, dy);

      const isBossPhase2 = m.tier === 'BOSS' && m.hp <= m.maxHp * 0.5;
      const effSpeed = isBossPhase2 ? m.speed * 1.24 : m.speed;

      const hasLos =
        dist <= m.detectRange &&
        this.hasLineOfSight(m.x, m.y, this.player.x, this.player.y);
      const engaged =
        hasLos ||
        m.aiState === 'WINDUP' ||
        m.aiState === 'LUNGING' ||
        m.aiState === 'ALERT' ||
        (m.tier === 'BOSS' && playerSector === m.sector) ||
        dist < 175;

      // Drop ALERT if player escapes far out of range and LoS
      if (m.aiState === 'ALERT' && !hasLos && dist > m.detectRange * 1.15) {
        m.stateTimer -= dt;
        if (m.stateTimer <= 0) {
          m.aiState = 'PATROL';
        }
      }

      // 1. Handle telegraphed WINDUP state
      if (m.aiState === 'WINDUP') {
        m.angle = Math.atan2(dy, dx);
        m.stateTimer -= dt;
        if (m.stateTimer <= 0) {
          if (m.attackStyle === 'RANGED_ACID') {
            this.fireCreatureProjectile(m, m.angle, 330, m.attackDamage, '#4ade80');
            m.attackCooldown = 1.65;
            m.aiState = 'RECOVER';
            m.stateTimer = 0.3;
          } else {
            // Leap / lunge toward player!
            const lungeMult =
              m.archetype === 'SKITTERER'
                ? 2.85
                : m.archetype === 'VOID_STALKER'
                  ? 2.95
                  : 2.55;
            m.lungeVx = Math.cos(m.angle) * effSpeed * lungeMult;
            m.lungeVy = Math.sin(m.angle) * effSpeed * lungeMult;
            m.aiState = 'LUNGING';
            m.stateTimer = 0.24;
            this.sound.playMonsterSlash();
            this.spawnBurst(
              m.x,
              m.y,
              m.archetype === 'VOID_STALKER' ? '#c084fc' : '#f87171',
              5
            );
          }
        }
      } else if (m.aiState === 'LUNGING') {
        m.stateTimer -= dt;
        const mx = m.lungeVx * dt;
        const my = m.lungeVy * dt;
        if (mx !== 0) {
          m.x += mx;
          this.resolveCircleCollisions(m);
        }
        if (my !== 0) {
          m.y += my;
          this.resolveCircleCollisions(m);
        }

        const hitDist = Math.hypot(this.player.x - m.x, this.player.y - m.y);
        if (hitDist <= m.radius + this.player.radius + 14 && m.attackCooldown <= 0) {
          m.attackCooldown = isBossPhase2 ? 0.9 : 1.15;
          this.sound.playMonsterSlash();
          this.triggerShake(0.22, m.tier === 'BOSS' ? 6 : 4);
          this.damagePlayer(m.attackDamage, 'MONSTER_WIN');
          this.spawnBurst(this.player.x, this.player.y, '#ef4444', 11);
          m.aiState = 'RECOVER';
          m.stateTimer = 0.36;
        } else if (m.stateTimer <= 0) {
          m.attackCooldown = Math.max(m.attackCooldown, 0.75);
          m.aiState = 'RECOVER';
          m.stateTimer = 0.32;
        }
      } else if (m.aiState === 'RECOVER') {
        m.angle = Math.atan2(dy, dx);
        m.stateTimer -= dt;
        if (m.stateTimer <= 0) {
          m.aiState = engaged ? 'ALERT' : 'PATROL';
        }
      } else if (engaged) {
        m.angle = Math.atan2(dy, dx);
        if (m.aiState === 'PATROL') {
          m.aiState = 'ALERT';
          m.stateTimer = 4.0;
        }

        // Boss ranged barrage (Phase 1: single plasma bolt; Phase 2: 3-bolt spread)
        if (
          m.tier === 'BOSS' &&
          dist > m.attackRange + 35 &&
          dist < 480 &&
          hasLos &&
          m.attackCooldown <= 0
        ) {
          m.attackCooldown = isBossPhase2 ? 1.15 : 1.65;
          const pSpeed = isBossPhase2 ? 385 : 335;
          if (isBossPhase2) {
            for (const spread of [-0.18, 0, 0.18]) {
              this.fireCreatureProjectile(m, m.angle + spread, pSpeed, 15, '#ef4444');
            }
          } else {
            this.fireCreatureProjectile(m, m.angle, pSpeed, 14, '#ef4444');
          }
          this.sound.playMonsterSlash();
        } else if (
          m.attackStyle === 'RANGED_ACID' &&
          dist <= m.attackRange &&
          hasLos
        ) {
          // Acid Spitter: wind up & spit corrosive plasma, or kite back if player is too close
          if (m.attackCooldown <= 0) {
            m.aiState = 'WINDUP';
            m.stateTimer = 0.28;
            this.spawnBurst(m.x, m.y, '#4ade80', 4);
          } else if (dist < 115) {
            const awayStep = effSpeed * 0.75 * dt;
            m.x -= Math.cos(m.angle) * awayStep;
            this.resolveCircleCollisions(m);
            m.y -= Math.sin(m.angle) * awayStep;
            this.resolveCircleCollisions(m);
          } else {
            // Lateral bio-strafe while waiting to spit
            const strafeDir = m.patrolPhase % 2 < 1 ? 1 : -1;
            const strafeAngle = m.angle + strafeDir * (Math.PI * 0.5);
            const sStep = effSpeed * 0.65 * dt;
            m.x += Math.cos(strafeAngle) * sStep;
            this.resolveCircleCollisions(m);
            m.y += Math.sin(strafeAngle) * sStep;
            this.resolveCircleCollisions(m);
          }
        } else if (
          m.tier === 'MODERATE' &&
          dist > 150 &&
          dist < 340 &&
          hasLos &&
          m.attackCooldown <= 0
        ) {
          // Moderate Sentinels fire an occasional bio-plasma spit if kited at medium-long range
          m.attackCooldown = 1.9;
          this.fireCreatureProjectile(m, m.angle, 300, 10, '#f59e0b');
          this.sound.playMonsterSlash();
        } else if (
          m.attackStyle !== 'RANGED_ACID' &&
          dist <= m.attackRange * 2.4 &&
          dist > m.attackRange * 0.85 &&
          hasLos &&
          m.attackCooldown <= 0
        ) {
          // Telegraphed pounce wind-up before lunging at player
          m.aiState = 'WINDUP';
          m.stateTimer = m.archetype === 'SKITTERER' ? 0.25 : 0.32;
          this.spawnBurst(
            m.x,
            m.y,
            m.archetype === 'VOID_STALKER' ? '#c084fc' : '#f59e0b',
            4
          );
        } else if (dist <= m.attackRange) {
          if (m.attackCooldown <= 0) {
            m.attackCooldown = isBossPhase2 ? 0.85 : 1.1;
            this.sound.playMonsterSlash();
            this.triggerShake(0.2, m.tier === 'BOSS' ? 6 : 4);
            this.damagePlayer(m.attackDamage, 'MONSTER_WIN');
            this.spawnBurst(this.player.x, this.player.y, '#ef4444', 8);
          }
        } else {
          const step = effSpeed * dt;
          const mx = Math.cos(m.angle) * step;
          const my = Math.sin(m.angle) * step;
          if (mx !== 0) {
            m.x += mx;
            this.resolveCircleCollisions(m);
          }
          if (my !== 0) {
            m.y += my;
            this.resolveCircleCollisions(m);
          }
        }
      } else {
        m.patrolPhase += dt * 0.9;
        const targetX = m.homeX + Math.cos(m.patrolPhase) * 44;
        const targetY = m.homeY + Math.sin(m.patrolPhase * 0.8) * 32;
        const pdx = targetX - m.x;
        const pdy = targetY - m.y;
        const pDist = Math.hypot(pdx, pdy);
        if (pDist > 4) {
          m.angle = Math.atan2(pdy, pdx);
          const step = Math.min(pDist, effSpeed * 0.48 * dt);
          m.x += (pdx / pDist) * step;
          this.resolveCircleCollisions(m);
          m.y += (pdy / pDist) * step;
          this.resolveCircleCollisions(m);
        }
      }

      const sepDx = this.player.x - m.x;
      const sepDy = this.player.y - m.y;
      const sepDist = Math.hypot(sepDx, sepDy);
      const minSep = this.player.radius + m.radius;
      if (sepDist > 0.001 && sepDist < minSep) {
        const push = (minSep - sepDist) * 0.5;
        this.player.x += (sepDx / sepDist) * push;
        this.player.y += (sepDy / sepDist) * push;
        this.resolveCollisions();
      }
    }

    // Prevent active monsters/creatures from stacking cleanly on top of each other
    const activeList = this.world.monsters;
    for (let i = 0; i < activeList.length; i++) {
      const a = activeList[i];
      if (!a.active || !a.alive) continue;
      for (let j = i + 1; j < activeList.length; j++) {
        const b = activeList[j];
        if (!b.active || !b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius + 4;
        if (dist > 0.01 && dist < minDist) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          this.resolveCircleCollisions(a);
          this.resolveCircleCollisions(b);
        }
      }
    }
  }

  private fireCreatureProjectile(
    m: MonsterEntity,
    angle: number,
    speed: number,
    damage: number,
    color: string
  ): void {
    const sx = m.x + Math.cos(angle) * (m.radius + 8);
    const sy = m.y + Math.sin(angle) * (m.radius + 8);
    this.projectiles.push({
      id: this.nextProjectileId++,
      fromPlayer: false,
      kind: color === '#4ade80' ? 'ACID_BOLT' : 'ENEMY_PLASMA',
      x: sx,
      y: sy,
      prevX: sx,
      prevY: sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 6,
      damage,
      knockback: 36,
      life: 2.1,
      color,
    });
  }

  private segmentToPointDistSq(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    px: number,
    py: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0.00001) {
      return (px - x1) * (px - x1) + (py - y1) * (py - y1);
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return (px - projX) * (px - projX) + (py - projY) * (py - projY);
  }

  private getLaserArchetypeMultiplier(m: MonsterEntity): number {
    switch (m.archetype) {
      case 'SKITTERER':
        return 1.15;
      case 'ACID_SPITTER':
        return 1.1;
      case 'VOID_STALKER':
        return 1.0;
      case 'SENTINEL':
        return 0.95;
      case 'APEX_BOSS':
        return 0.9;
      default:
        return 1.0;
    }
  }

  private getLaserKnockbackScale(m: MonsterEntity): number {
    switch (m.archetype) {
      case 'SKITTERER':
        return 1.2;
      case 'ACID_SPITTER':
        return 0.9;
      case 'VOID_STALKER':
        return 0.78;
      case 'SENTINEL':
        return 0.42;
      case 'APEX_BOSS':
        return 0.18;
      default:
        return 0.6;
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;
      p.life -= dt;

      // Sub-step wall & closed-door sweep to prevent high-speed projectile tunneling
      const travelDist = Math.hypot(nextX - p.prevX, nextY - p.prevY);
      const subSteps = Math.max(1, Math.ceil(travelDist / 10));
      let wallHitX = nextX;
      let wallHitY = nextY;
      let hitWall = false;

      for (let s = 1; s <= subSteps; s++) {
        const t = s / subSteps;
        const sx = p.prevX + (nextX - p.prevX) * t;
        const sy = p.prevY + (nextY - p.prevY) * t;
        if (this.isPointBlocked(sx, sy)) {
          wallHitX = sx;
          wallHitY = sy;
          hitWall = true;
          break;
        }
      }

      p.x = wallHitX;
      p.y = wallHitY;

      if (p.fromPlayer) {
        // Swept collision against THE LISTENER
        const l = this.world.listener;
        let hitSomething = false;
        if (l.active && l.state !== 'STAGGERED') {
          const hitR = l.radius + p.radius + 4;
          const distSq = this.segmentToPointDistSq(
            p.prevX,
            p.prevY,
            p.x,
            p.y,
            l.x,
            l.y
          );
          if (distSq <= hitR * hitR) {
            l.hp = Math.max(0, l.hp - p.damage);
            l.hitFlash = 1;
            const pSpeed = Math.hypot(p.vx, p.vy) || 1;
            l.x += (p.vx / pSpeed) * (p.knockback * 0.12);
            l.y += (p.vy / pSpeed) * (p.knockback * 0.12);
            this.resolveCircleCollisions(l);
            this.spawnBurst(l.x, l.y, '#c084fc', 10);
            this.projectiles.splice(i, 1);
            hitSomething = true;
            if (l.hp <= 0) {
              l.state = 'STAGGERED';
              l.stunTimer = 7.0;
              this.sound.playMonsterDefeat();
              this.showToast(
                'THE LISTENER Staggered (7s) — Move quickly or drop an Echo Beacon!',
                'info',
                3.2
              );
            } else {
              this.sound.playMonsterHit();
            }
          }
        }
        if (hitSomething) continue;

        // Swept collision against all 5 monster archetypes
        let hitMonster: MonsterEntity | null = null;
        let bestDistSq = Number.POSITIVE_INFINITY;
        for (const m of this.world.monsters) {
          if (!m.active || !m.alive) continue;
          const hitR = m.radius + p.radius + 4;
          const dSq = this.segmentToPointDistSq(
            p.prevX,
            p.prevY,
            p.x,
            p.y,
            m.x,
            m.y
          );
          if (dSq <= hitR * hitR && dSq < bestDistSq) {
            bestDistSq = dSq;
            hitMonster = m;
          }
        }

        if (hitMonster) {
          const dmgMult = this.getLaserArchetypeMultiplier(hitMonster);
          const actualDmg = Math.round(p.damage * dmgMult);
          hitMonster.hp = Math.max(0, hitMonster.hp - actualDmg);
          hitMonster.hitFlash = 1;

          // Physical mining laser knockback
          const pSpeed = Math.hypot(p.vx, p.vy) || 1;
          const kbDist = p.knockback * this.getLaserKnockbackScale(hitMonster) * 0.11;
          hitMonster.x += (p.vx / pSpeed) * kbDist;
          hitMonster.y += (p.vy / pSpeed) * kbDist;
          this.resolveCircleCollisions(hitMonster);

          // Interrupt wind-up attacks on lighter creatures
          if (
            hitMonster.aiState === 'WINDUP' &&
            (hitMonster.archetype === 'SKITTERER' ||
              hitMonster.archetype === 'ACID_SPITTER')
          ) {
            hitMonster.aiState = 'RECOVER';
            hitMonster.stateTimer = 0.25;
            hitMonster.attackCooldown = Math.max(hitMonster.attackCooldown, 0.55);
          } else if (hitMonster.aiState === 'PATROL') {
            hitMonster.aiState = 'ALERT';
            hitMonster.stateTimer = 4.5;
          }

          const impactColor =
            hitMonster.archetype === 'ACID_SPITTER'
              ? '#4ade80'
              : hitMonster.archetype === 'VOID_STALKER'
                ? '#c084fc'
                : '#f87171';
          this.spawnBurst(hitMonster.x, hitMonster.y, impactColor, 10);
          this.projectiles.splice(i, 1);

          if (hitMonster.hp <= 0) {
            this.handleMonsterDefeated(hitMonster);
          } else {
            this.sound.playMonsterHit();
          }
          continue;
        }
      } else {
        // Enemy projectile swept collision against player
        const hitR = this.player.radius + p.radius;
        const dSq = this.segmentToPointDistSq(
          p.prevX,
          p.prevY,
          p.x,
          p.y,
          this.player.x,
          this.player.y
        );
        if (dSq <= hitR * hitR) {
          this.spawnBurst(this.player.x, this.player.y, p.color, 10);
          this.projectiles.splice(i, 1);
          this.sound.playMonsterSlash();
          this.triggerShake(0.18, 4);
          this.damagePlayer(p.damage, 'MONSTER_WIN');
          continue;
        }
      }

      if (hitWall || p.life <= 0) {
        this.spawnBurst(p.x, p.y, hitWall ? '#67e8f9' : p.color, hitWall ? 7 : 4);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private handleMonsterDefeated(monster: MonsterEntity): void {
    monster.alive = false;
    monster.active = false;
    this.sound.playMonsterDefeat();
    this.spawnBurst(
      monster.x,
      monster.y,
      monster.archetype === 'ACID_SPITTER' ? '#4ade80' : '#f87171',
      26
    );
    this.triggerShake(0.28, 5);

    if (monster.tier === 'CREATURE') {
      this.player.battery = Math.min(100, this.player.battery + 5);
      this.showToast(
        `${monster.name} eliminated (+5% Suit Battery)`,
        'info',
        2.5
      );
    } else if (monster.tier === 'MODERATE') {
      const defeated = this.world.monsters.filter(
        (m) => m.tier === 'MODERATE' && !m.alive
      ).length;
      if (defeated < 4) {
        this.saveCheckpoint();
        this.showToast(
          `${monster.name} Defeated (${defeated}/4 Moderate Monsters Cleared)`,
          'success',
          3.4
        );
      } else {
        this.saveCheckpoint();
        const boss = this.world.monsters.find((m) => m.tier === 'BOSS');
        if (boss) {
          const distToDefault = Math.hypot(
            this.player.x - boss.homeX,
            this.player.y - boss.homeY
          );
          if (distToDefault < 130) {
            boss.x = 31.5 * TILE_SIZE;
            boss.y = 10.6 * TILE_SIZE;
          } else {
            boss.x = boss.homeX;
            boss.y = boss.homeY;
          }
          boss.active = true;
          boss.alive = true;
          this.sound.playBossRoar();
          this.triggerShake(0.55, 7);
          this.spawnBurst(boss.x, boss.y, '#ef4444', 32);
          this.showToast(
            'ALL 4 MONSTERS KILLED! The Final Boss controlling ECHO-9 emerged on Command Deck!',
            'warning',
            5.0
          );
        }
      }
    } else {
      this.world.listener.active = false;
      this.showToast(
        'FINAL BOSS DEFEATED! Interact with the Command Deck relay to communicate with Earth!',
        'success',
        5.5
      );
    }

    this.emitHud(true);
  }

  private isPointBlocked(wx: number, wy: number): boolean {
    const col = Math.floor(wx / TILE_SIZE);
    const row = Math.floor(wy / TILE_SIZE);
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return true;
    const tile = this.world.grid[row][col];
    if (
      tile === TileType.WALL ||
      tile === TileType.VOID ||
      tile === TileType.WINDOW_SPACE
    ) {
      return true;
    }
    for (const door of this.world.doors) {
      if (door.openProgress >= 0.72) continue;
      const dx0 = door.tileX * TILE_SIZE;
      const dy0 = door.tileY * TILE_SIZE;
      if (
        wx >= dx0 &&
        wx <= dx0 + door.tilesW * TILE_SIZE &&
        wy >= dy0 &&
        wy <= dy0 + door.tilesH * TILE_SIZE
      ) {
        return true;
      }
    }
    return false;
  }

  private hasLineOfSight(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): boolean {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / 18);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isPointBlocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) {
        return false;
      }
    }
    return true;
  }

  private resolveCollisions(): void {
    this.resolveCircleCollisions(this.player);
  }

  private resolveCircleCollisions(entity: {
    x: number;
    y: number;
    radius: number;
  }): void {
    const r = entity.radius;
    const minCol = Math.max(0, Math.floor((entity.x - r) / TILE_SIZE) - 1);
    const maxCol = Math.min(
      MAP_COLS - 1,
      Math.floor((entity.x + r) / TILE_SIZE) + 1
    );
    const minRow = Math.max(0, Math.floor((entity.y - r) / TILE_SIZE) - 1);
    const maxRow = Math.min(
      MAP_ROWS - 1,
      Math.floor((entity.y + r) / TILE_SIZE) + 1
    );

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const tile = this.world.grid[row][col];
        if (
          tile === TileType.WALL ||
          tile === TileType.VOID ||
          tile === TileType.WINDOW_SPACE
        ) {
          this.pushEntityOutOfRect(
            entity,
            col * TILE_SIZE,
            row * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE
          );
        }
      }
    }

    for (const door of this.world.doors) {
      if (door.openProgress >= 0.72) continue;
      this.pushEntityOutOfRect(
        entity,
        door.tileX * TILE_SIZE,
        door.tileY * TILE_SIZE,
        door.tilesW * TILE_SIZE,
        door.tilesH * TILE_SIZE
      );
    }

    for (const prop of this.world.props) {
      if (!prop.solid) continue;
      this.pushEntityOutOfRect(entity, prop.x, prop.y, prop.w, prop.h);
    }
  }

  private pushEntityOutOfRect(
    entity: { x: number; y: number; radius: number },
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): void {
    const closestX = Math.max(rx, Math.min(entity.x, rx + rw));
    const closestY = Math.max(ry, Math.min(entity.y, ry + rh));
    const dx = entity.x - closestX;
    const dy = entity.y - closestY;
    const distSq = dx * dx + dy * dy;
    const r = entity.radius;

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = r - dist;
        entity.x += (dx / dist) * overlap;
        entity.y += (dy / dist) * overlap;
      } else {
        const leftPen = entity.x - rx;
        const rightPen = rx + rw - entity.x;
        const topPen = entity.y - ry;
        const bottomPen = ry + rh - entity.y;
        const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
        if (minPen === leftPen) entity.x = rx - r;
        else if (minPen === rightPen) entity.x = rx + rw + r;
        else if (minPen === topPen) entity.y = ry - r;
        else entity.y = ry + rh + r;
      }
    }
  }

  private findNearbyInteractable(): NearbyInteractable | null {
    const px = this.player.x;
    const py = this.player.y;

    let bestDist = Infinity;
    let best: NearbyInteractable | null = null;

    for (const pickup of this.world.pickups) {
      if (pickup.collected) continue;
      const dist = Math.hypot(
        pickup.tileX * TILE_SIZE - px,
        pickup.tileY * TILE_SIZE - py
      );
      if (dist < 64 && dist < bestDist) {
        bestDist = dist;
        best = {
          kind: 'PICKUP',
          id: pickup.id,
          promptText: `Press E · Take ${pickup.name}`,
        };
      }
    }

    for (const station of this.world.suitStations) {
      const dist = Math.hypot(
        station.tileX * TILE_SIZE - px,
        station.tileY * TILE_SIZE - py
      );
      if (dist < 66 && dist < bestDist) {
        bestDist = dist;
        best = {
          kind: 'SUIT_STATION',
          id: station.id,
          promptText: `Press E · ${station.label} (Restore Health & Battery)`,
        };
      }
    }

    for (const term of this.world.terminals) {
      const dist = Math.hypot(
        term.tileX * TILE_SIZE - px,
        term.tileY * TILE_SIZE - py
      );
      if (dist < 68 && dist < bestDist) {
        bestDist = dist;
        best = {
          kind: 'TERMINAL',
          id: term.id,
          promptText: `Press E · ${term.title}`,
        };
      }
    }

    for (const door of this.world.doors) {
      const rx = door.tileX * TILE_SIZE;
      const ry = door.tileY * TILE_SIZE;
      const rw = door.tilesW * TILE_SIZE;
      const rh = door.tilesH * TILE_SIZE;
      const cx = Math.max(rx, Math.min(px, rx + rw));
      const cy = Math.max(ry, Math.min(py, ry + rh));
      const dist = Math.hypot(px - cx, py - cy);

      if (dist < 58 && dist < bestDist) {
        bestDist = dist;
        const lockInfo = this.getDoorLockReason(door);
        if (lockInfo) {
          best = {
            kind: 'DOOR',
            id: door.id,
            promptText: `Press E · ${door.label} (${lockInfo})`,
            lockedReason: lockInfo,
          };
        } else {
          best = {
            kind: 'DOOR',
            id: door.id,
            promptText: door.isOpen
              ? `Press E · Close ${door.label}`
              : door.locked
                ? `Press E · Unlock & Open ${door.label}`
                : `Press E · Open ${door.label}`,
          };
        }
      }
    }

    return best;
  }

  private getDoorLockReason(door: DoorEntity): string | null {
    if (!door.locked) return null;
    if (door.requiresPower && !this.powerRestored) {
      return 'Requires Reactor Power';
    }
    if (door.requiredCard && !this.collectedCards.has(door.requiredCard)) {
      return `Requires ${KEYCARD_CATALOG[door.requiredCard].shortName}`;
    }
    return null;
  }

  private handleInteract(): void {
    if (
      this.gameState === 'TERMINAL' ||
      this.gameState === 'PUZZLE_FREQUENCY' ||
      this.gameState === 'PUZZLE_REACTOR'
    ) {
      this.closeTerminal();
      return;
    }
    if (this.gameState !== 'PLAYING') return;

    const nearby = this.findNearbyInteractable();
    if (!nearby) return;

    if (nearby.kind === 'PICKUP') {
      const pickup = this.world.pickups.find((p) => p.id === nearby.id);
      if (pickup && !pickup.collected) {
        this.collectPickup(pickup);
      }
      return;
    }

    if (nearby.kind === 'SUIT_STATION') {
      const station = this.world.suitStations.find((s) => s.id === nearby.id);
      if (station) {
        this.useSuitStation(station);
      }
      return;
    }

    if (nearby.kind === 'TERMINAL') {
      const term = this.world.terminals.find((t) => t.id === nearby.id);
      if (term) {
        this.openTerminal(term);
      }
      return;
    }

    if (nearby.kind === 'DOOR') {
      const door = this.world.doors.find((d) => d.id === nearby.id);
      if (door) {
        this.interactDoor(door);
      }
    }
  }

  private collectPickup(pickup: PickupEntity): void {
    pickup.collected = true;
    const kind = pickup.kind ?? 'KEYCARD';

    if (kind === 'BEACON_PACK') {
      this.echoBeaconsRemaining += 2;
      this.sound.playPickup();
      this.showToast('Acquired: +2 Echo Beacons (Press Q to deploy)', 'success', 3.2);
    } else if (kind === 'BATTERY_CELL') {
      this.player.battery = Math.min(100, this.player.battery + 50);
      this.sound.playSuitRecharge();
      this.showToast('Acquired: Battery Cell (+50% Charge)', 'success', 3.0);
    } else if (pickup.cardId) {
      this.collectedCards.add(pickup.cardId);
      this.sound.playPickup();
      this.showToast(`Acquired: ${pickup.name}`, 'success', 3.5);
    }

    this.spawnBurst(
      pickup.tileX * TILE_SIZE,
      pickup.tileY * TILE_SIZE,
      pickup.color,
      18
    );
    this.saveCheckpoint();
    this.emitHud(true);
  }

  private useSuitStation(station: SuitStationEntity): void {
    if (this.player.suitIntegrity >= 100 && this.player.battery >= 100) {
      this.showToast('Suit Health & Battery already at 100%', 'info', 2.0);
      return;
    }
    this.player.suitIntegrity = 100;
    this.player.battery = 100;
    this.player.damageFlash = 0;
    this.sound.playSuitRecharge();
    this.spawnBurst(
      station.tileX * TILE_SIZE,
      station.tileY * TILE_SIZE,
      '#34d399',
      16
    );
    this.showToast('Suit Health & Battery Restored to 100%', 'success', 2.8);
    this.emitHud(true);
  }

  private openTerminal(term: TerminalEntity): void {
    this.heldKeys.clear();
    this.releasePointerLock();
    this.logsRead.add(term.id);
    this.activeTerminal = term;

    if (term.kind === 'PUZZLE_FREQUENCY' && !this.frequencySolved) {
      this.gameState = 'PUZZLE_FREQUENCY';
    } else if (term.kind === 'PUZZLE_REACTOR' && !this.powerRestored) {
      this.gameState = 'PUZZLE_REACTOR';
    } else {
      this.gameState = 'TERMINAL';
    }

    this.sound.playTerminalOpen();
    this.emitHud(true);
  }

  private interactDoor(door: DoorEntity): void {
    if (door.locked) {
      const reason = this.getDoorLockReason(door);
      if (reason) {
        this.sound.playLocked();
        this.showToast(`Access Denied — ${reason}`, 'warning', 2.8);
        return;
      }
      door.locked = false;
      door.isOpen = true;
      this.sound.playDoorSlide(true);
      this.triggerShake(0.18, 2.5);
      this.spawnBurst(
        (door.tileX + door.tilesW / 2) * TILE_SIZE,
        (door.tileY + door.tilesH / 2) * TILE_SIZE,
        '#22d3ee',
        12
      );
      this.showToast(`Unlocked: ${door.label}`, 'success', 2.6);
      this.emitHud(true);
      return;
    }

    if (door.isOpen) {
      const rx = door.tileX * TILE_SIZE - this.player.radius;
      const ry = door.tileY * TILE_SIZE - this.player.radius;
      const rw = door.tilesW * TILE_SIZE + this.player.radius * 2;
      const rh = door.tilesH * TILE_SIZE + this.player.radius * 2;
      if (
        this.player.x >= rx &&
        this.player.x <= rx + rw &&
        this.player.y >= ry &&
        this.player.y <= ry + rh
      ) {
        this.showToast('Step clear of bulkhead before closing', 'info', 1.8);
        return;
      }
    }

    door.isOpen = !door.isOpen;
    this.sound.playDoorSlide(door.isOpen);
    this.emitHud(true);
  }

  private computeCurrentObjective(): { title: string; detail: string } {
    const moderateDefeated = this.world.monsters.filter(
      (m) => m.tier === 'MODERATE' && !m.alive
    ).length;
    const boss = this.world.monsters.find((m) => m.tier === 'BOSS');

    if (boss && boss.active && boss.alive) {
      return {
        title: 'Defeat the Final Boss Controlling ECHO-9',
        detail:
          'All 4 monsters are down! Kill the Final Boss on the Command Deck before he destroys the Earth signal connection.',
      };
    }

    if (moderateDefeated === 4 && boss && !boss.alive && !this.signalActivated) {
      return {
        title: 'Communicate with Earth · Signal Relay',
        detail:
          'All defects repaired & 4 monsters + Final Boss defeated! Interact [E] with the Command Deck Relay to contact Earth.',
      };
    }

    if (!this.collectedCards.has('card_research')) {
      return {
        title: 'Inspect Crash Wreck · Find Research Card',
        detail:
          'Search the crashed Arrival Bay, kill Monster #1, and collect the Research Keycard in West Security.',
      };
    }
    if (!this.enteredResearch) {
      return {
        title: 'Unlock Lab · Repair Crash Defects',
        detail:
          'Open the North-West bulkhead [E] to reach the Research Lab and use [Q] Echo Beacons near THE LISTENER.',
      };
    }
    if (!this.frequencySolved) {
      return {
        title: 'Fix Ship Defect #1 · Comms Frequency',
        detail:
          'Repair the crash-damaged Comms Frequency Analyzer in Research Lab (448.92 MHz) to restore Earth band lock.',
      };
    }
    if (!this.collectedCards.has('card_engineering')) {
      return {
        title: 'Locate Engineering Keycard',
        detail:
          'Defeat the Bio-Lab monster and search the North-West Specimen Vault for Reactor access.',
      };
    }
    if (!this.powerRestored) {
      return {
        title: 'Fix Ship Defect #2 · Reactor Grid',
        detail:
          'Enter Engineering Core east of the lab and balance the Reactor Distribution Console to 100 MW.',
      };
    }
    if (!this.collectedCards.has('card_command')) {
      return {
        title: 'Acquire Command Clearance Card',
        detail:
          "Retrieve Command Clearance from Chief Engineer's Bay south of the crashed reactor core.",
      };
    }
    if (moderateDefeated < 4) {
      return {
        title: `Kill 4 Planetary Monsters (${moderateDefeated}/4)`,
        detail:
          'Eliminate all 4 planetary monsters inside the crashed station to confront the Final Boss on Command Deck.',
      };
    }
    return {
      title: 'Mission Complete · Earth Contact Restored',
      detail: 'Ship defects fixed, all 4 monsters & Final Boss defeated, Earth signal saved.',
    };
  }

  private computeGuideSubtitle(
    sector: SectorId,
    moderateDefeated: number,
    boss: MonsterEntity | undefined,
    listenerDistance: number
  ): { tag: string; text: string } {
    const l = this.world.listener;

    if (this.nearbyPrompt) {
      if (this.nearbyPrompt.kind === 'PICKUP') {
        return {
          tag: 'INTERACT [E]',
          text: 'Press [E] to pick this up. Keycards unlock crashed ship sectors; Beacon Packs refill your sonic decoys.',
        };
      }
      if (this.nearbyPrompt.kind === 'SUIT_STATION') {
        return {
          tag: 'NANO-MED POD [E]',
          text: 'Press [E] at the glowing pod to restore your Suit Health and Battery back to 100%.',
        };
      }
      if (this.nearbyPrompt.kind === 'TERMINAL') {
        return {
          tag: 'TERMINAL [E]',
          text: 'Press [E] to inspect crash logs, repair ship defects, or transmit the Earth communication signal.',
        };
      }
      if (this.nearbyPrompt.kind === 'DOOR') {
        return this.nearbyPrompt.lockedReason
          ? {
              tag: 'LOCKED BULKHEAD',
              text: `Door locked (${this.nearbyPrompt.lockedReason}). Search glowing pickups in earlier sectors or fix the Reactor Defect.`,
            }
          : {
              tag: 'BULKHEAD [E]',
              text: 'Press [E] to slide the bulkhead door open and move into the next ship sector.',
            };
      }
    }

    if (l.active && (l.state === 'HUNTING' || listenerDistance <= 6)) {
      return {
        tag: 'ECHO BEACON [Q]',
        text: 'THE LISTENER is close! Press [Q] to drop an Echo Beacon — a sonic decoy that lures it away with sound waves.',
      };
    }

    if (this.player.suitIntegrity <= 45) {
      return {
        tag: 'SURVIVAL TIP',
        text: 'Suit Integrity is low! Find a green glowing Nano-Med Pod and press [E] to repair health & recharge.',
      };
    }

    if (this.player.laserOverheated) {
      return {
        tag: 'MINING LASER',
        text: 'Weapon overheated! Pause firing briefly to vent heat before engaging planetary monsters again.',
      };
    }

    const cycle = Math.floor(this.elapsedSeconds / 7);
    const messages: Array<{ tag: string; text: string }> = [];

    if (!this.collectedCards.has('card_research')) {
      messages.push(
        {
          tag: 'CRASH SITE · GUIDE',
          text: 'ECHO-9 crashed on this monster world in 2189. Find the Research Keycard in Arrival Bay West Security and press [E].',
        },
        {
          tag: 'ECHO BEACON [Q]',
          text: 'What is an Echo Beacon? Press [Q] to drop a sonic decoy that emits pulsing waves and distracts THE LISTENER.',
        },
        {
          tag: 'CONTROLS · [E]',
          text: 'Move with [WASD], turn with Mouse, press [E] to fix ship defects/pick up items, and Click or [Space] to fire Laser.',
        }
      );
    } else if (!this.enteredResearch) {
      messages.push(
        {
          tag: 'NEXT SECTOR',
          text: 'Head to the North-West bulkhead door of Arrival Bay and press [E] to enter Research Lab (Defect #1).',
        },
        {
          tag: 'ECHO BEACON [Q]',
          text: 'Echo Beacons [Q] create loud cyan sound rings that pull THE LISTENER away from corridors so you can pass safely.',
        }
      );
    } else if (!this.frequencySolved) {
      messages.push(
        {
          tag: 'SHIP DEFECT #1',
          text: 'Locate the crash-damaged Comms Frequency Analyzer in Research Lab and press [E] to tune Earth’s 448.92 MHz signal.',
        },
        {
          tag: 'ECHO BEACON [Q]',
          text: 'Repairing the Comms Defect awards +1 Echo Beacon! Press [Q] anytime to deploy a decoy and distract THE LISTENER.',
        }
      );
    } else if (!this.collectedCards.has('card_engineering')) {
      messages.push(
        {
          tag: 'FIND KEYCARD',
          text: 'Search the North-West Specimen Vault in the Research Lab and press [E] to take the Engineering Keycard.',
        },
        {
          tag: 'COMBAT GUIDE',
          text: 'Hold Click or [Space] to fire your Mining Laser at planetary monsters. Watch your Deck Radar for nearby threats.',
        }
      );
    } else if (!this.powerRestored) {
      messages.push(
        {
          tag: 'SHIP DEFECT #2',
          text: 'Unlock the eastern door into Engineering Core [E] and balance the Reactor Console to 100 MW to fix the power defect.',
        },
        {
          tag: 'REACTOR TIP',
          text: 'Fixing the Reactor Defect stops electrical floor hazards across the wreck and powers the Command Deck seal.',
        }
      );
    } else if (!this.collectedCards.has('card_command')) {
      messages.push(
        {
          tag: 'CLEARANCE CARD',
          text: "Search south of the Engineering Core Reactor for the Chief Engineer's Bay and press [E] for Command Clearance.",
        },
        {
          tag: 'ECHO BEACON [Q]',
          text: 'Remember: Press [Q] to drop an Echo Beacon decoy whenever footsteps or gunfire attract THE LISTENER.',
        }
      );
    } else if (moderateDefeated < 4) {
      messages.push(
        {
          tag: 'MONSTER HUNT',
          text: `Kill all 4 planetary monsters (${moderateDefeated}/4 killed) shown on your Radar before facing the Final Boss.`,
        },
        {
          tag: 'DECK RADAR',
          text: `Current sector: ${SECTOR_NAMES[sector]}. Use [E] on doors & consoles, and [Q] Echo Beacons to stay safe.`,
        }
      );
    } else if (boss && boss.alive) {
      messages.push(
        {
          tag: 'FINAL BOSS · BRIDGE',
          text: 'The Final Boss controls Command Deck and knows Earth’s signal! Kill him before he destroys the Earth connection.',
        },
        {
          tag: 'BOSS TACTICS',
          text: 'Keep firing bursts with your Mining Laser, recharge at Nano-Med Pods [E], and dodge red plasma bursts.',
        }
      );
    } else if (!this.signalActivated) {
      messages.push(
        {
          tag: 'EARTH SIGNAL',
          text: 'All 4 monsters & the Final Boss are dead! Press [E] at the Command Deck Relay to communicate with Earth.',
        }
      );
    } else {
      messages.push({
        tag: 'SIGNAL COMPLETE',
        text: 'Earth communication restored across the 2189 deep-space link. Mission accomplished!',
      });
    }

    return messages[cycle % messages.length];
  }

  private emitHud(force: boolean): void {
    const sector = getSectorAtWorldPos(this.player.x, this.player.y);
    const obj = this.computeCurrentObjective();
    const cards: KeycardMeta[] = Array.from(this.collectedCards).map(
      (id) => KEYCARD_CATALOG[id]
    );
    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);
    const roundedIntegrity = Math.ceil(this.player.suitIntegrity);
    const roundedBattery = Math.ceil(this.player.battery);

    const moderateDefeated = this.world.monsters.filter(
      (m) => m.tier === 'MODERATE' && !m.alive
    ).length;
    const boss = this.world.monsters.find((m) => m.tier === 'BOSS');
    const bossSpawned = Boolean(boss && (boss.active || !boss.alive));
    const bossDefeated = Boolean(boss && !boss.alive);
    const bossHp = boss ? Math.ceil(boss.hp) : 0;
    const bossMaxHp = boss ? boss.maxHp : 330;
    const bossPhase: 0 | 1 | 2 = !bossSpawned || bossDefeated
      ? 0
      : bossHp <= bossMaxHp * 0.5
        ? 2
        : 1;

    const l = this.world.listener;
    const listenerDistance = Math.round(
      Math.hypot(l.x - this.player.x, l.y - this.player.y) / TILE_SIZE
    );
    const guide = this.computeGuideSubtitle(
      sector,
      moderateDefeated,
      boss,
      listenerDistance
    );

    const signature = [
      this.gameState,
      this.viewMode,
      this.isPointerLocked,
      sector,
      obj.title,
      cards.map((c) => c.id).join(','),
      this.frequencySolved,
      this.powerRestored,
      this.signalActivated,
      roundedIntegrity,
      roundedBattery,
      this.echoBeaconsRemaining,
      this.activeHazardLabel ?? '',
      this.nearbyPrompt?.id ?? '',
      this.nearbyPrompt?.lockedReason ?? '',
      this.toastMessage ?? '',
      this.activeTerminal?.id ?? '',
      this.activeTerminal?.activated ?? '',
      this.logsRead.size,
      this.sound.isMuted(),
      Math.floor(this.elapsedSeconds),
      playerTileX,
      playerTileY,
      Math.round(this.player.angle * 10),
      Math.round(this.player.laserHeat),
      this.player.laserOverheated,
      moderateDefeated,
      bossSpawned,
      bossDefeated,
      bossPhase,
      bossHp,
      l.state,
      listenerDistance,
      this.gameOverReason,
      Math.round(this.soundPulseLevel / 5),
      this.activeBeacons.length > 0,
      this.hasSavedCheckpoint(),
      this.endingChoice,
      guide.tag,
      guide.text,
    ].join('|');

    if (!force && signature === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = signature;

    this.onHudUpdate({
      gameState: this.gameState,
      viewMode: this.viewMode,
      isPointerLocked: this.isPointerLocked,
      sector,
      sectorName: SECTOR_NAMES[sector],
      objectiveTitle: obj.title,
      objectiveDetail: obj.detail,
      cards,
      powerRestored: this.powerRestored,
      frequencySolved: this.frequencySolved,
      signalActivated: this.signalActivated,
      suitIntegrity: roundedIntegrity,
      battery: roundedBattery,
      laserHeat: Math.round(this.player.laserHeat),
      laserOverheated: this.player.laserOverheated,
      echoBeacons: this.echoBeaconsRemaining,
      activeHazardLabel: this.activeHazardLabel,
      nearbyPrompt: this.nearbyPrompt,
      toastMessage: this.toastMessage,
      toastTone: this.toastTone,
      activeTerminal: this.activeTerminal ? { ...this.activeTerminal } : null,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      logsReadCount: this.logsRead.size,
      totalLogsCount: this.world.terminals.length,
      muted: this.sound.isMuted(),
      playerTileX,
      playerTileY,
      playerAngle: this.player.angle,
      moderateDefeated,
      moderateTotal: 4,
      bossSpawned,
      bossDefeated,
      bossPhase,
      bossName: boss ? boss.name : 'Apex Warlord · Final Boss',
      bossHp,
      bossMaxHp,
      listenerState: l.state,
      listenerDistance,
      gameOverReason: this.gameOverReason,
      soundPulseLevel: Math.round(this.soundPulseLevel),
      beaconPulseActive: this.activeBeacons.length > 0,
      hasSavedCheckpoint: this.hasSavedCheckpoint(),
      endingChoice: this.endingChoice,
      guideHintTag: guide.tag,
      guideSubtitle: guide.text,
    });
  }

  private render(): void {
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      const decay = this.shakeTimer / 0.5;
      shakeX = (Math.random() * 2 - 1) * this.shakeMagnitude * decay;
      shakeY = (Math.random() * 2 - 1) * this.shakeMagnitude * decay;
    }

    this.threeRenderer.render(
      this.world,
      this.player,
      this.particles,
      this.projectiles,
      this.activeBeacons,
      this.powerRestored,
      this.viewMode,
      this.simTime,
      this.gameState === 'TITLE_MENU',
      { x: shakeX, y: shakeY }
    );
  }

  private releasePointerLock(): void {
    if (document.pointerLockElement === this.canvas) {
      try {
        document.exitPointerLock();
      } catch {
        // Ignore browser exit errors
      }
    }
  }

  private onCanvasMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0 || this.gameState !== 'PLAYING') return;
    this.isMouseDown = true;

    if (this.viewMode === 'FRONT_POV') {
      this.fireMiningLaser();
      if (document.pointerLockElement !== this.canvas) {
        try {
          const res = this.canvas.requestPointerLock?.() as
            | Promise<void>
            | undefined;
          if (res && typeof res.catch === 'function') {
            res.catch(() => {
              // Pointer lock may be restricted in embedded preview; keyboard look remains active
            });
          }
        } catch {
          // Ignore if pointer lock unavailable
        }
      }
    } else {
      const worldPt = this.threeRenderer.screenToFloorWorld(
        e.clientX,
        e.clientY
      );
      if (worldPt) {
        const aimAngle = Math.atan2(
          worldPt.y - this.player.y,
          worldPt.x - this.player.x
        );
        this.fireMiningLaser(aimAngle);
      } else {
        this.fireMiningLaser();
      }
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.isMouseDown = false;
    }
  };

  private onPointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
    this.emitHud(true);
  };

  private onMouseMove = (e: MouseEvent): void => {
    const prevX = this.lastMouseClientX;
    const prevY = this.lastMouseClientY;
    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;
    this.lastMouseClientX = e.clientX;
    this.lastMouseClientY = e.clientY;
    this.hasMousePos = true;

    if (this.gameState !== 'PLAYING') return;

    if (this.viewMode === 'FRONT_POV') {
      const sens = this.settings.mouseSensitivity;
      if (this.isPointerLocked) {
        this.player.angle += e.movementX * 0.0028 * sens;
        this.player.targetAngle = this.player.angle;
        this.player.pitch = Math.max(
          -0.68,
          Math.min(0.68, this.player.pitch - e.movementY * 0.0024 * sens)
        );
      } else {
        if (prevX !== null) {
          const rawDx = e.clientX - prevX;
          const clampedDx = Math.max(-80, Math.min(80, rawDx));
          this.player.angle += clampedDx * 0.0052 * sens;
          this.player.targetAngle = this.player.angle;
        }
        if (prevY !== null) {
          const rawDy = e.clientY - prevY;
          const clampedDy = Math.max(-80, Math.min(80, rawDy));
          this.player.pitch = Math.max(
            -0.68,
            Math.min(0.68, this.player.pitch - clampedDy * 0.0042 * sens)
          );
        }
      }
    }
  };

  private normalizeKeyCode(e: KeyboardEvent): string {
    const key = e.key ? e.key.toLowerCase() : '';
    if (key === 'arrowup' || e.code === 'ArrowUp') return 'ArrowUp';
    if (key === 'arrowdown' || e.code === 'ArrowDown') return 'ArrowDown';
    if (key === 'arrowleft' || e.code === 'ArrowLeft') return 'ArrowLeft';
    if (key === 'arrowright' || e.code === 'ArrowRight') return 'ArrowRight';
    if (key === 'w' || e.code === 'KeyW') return 'KeyW';
    if (key === 's' || e.code === 'KeyS') return 'KeyS';
    if (key === 'a' || e.code === 'KeyA') return 'KeyA';
    if (key === 'd' || e.code === 'KeyD') return 'KeyD';
    return e.code;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = this.normalizeKeyCode(e);

    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
        code
      ) &&
      this.gameState !== 'TITLE_MENU'
    ) {
      e.preventDefault();
    }

    if (code === 'Space' || code === 'KeyF') {
      if (this.gameState === 'PLAYING') {
        this.heldKeys.add(code);
        this.triggerLaserWithAim();
      }
      return;
    }

    if (e.repeat) return;

    if (code === 'Escape' || code === 'KeyP') {
      if (
        this.gameState === 'TERMINAL' ||
        this.gameState === 'PUZZLE_FREQUENCY' ||
        this.gameState === 'PUZZLE_REACTOR'
      ) {
        this.closeTerminal();
      } else if (this.gameState === 'PLAYING') {
        this.pauseGame();
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
      }
      return;
    }

    if (code === 'KeyQ' && this.gameState === 'PLAYING') {
      this.deployEchoBeacon();
      return;
    }

    if (code === 'KeyV' && this.gameState === 'PLAYING') {
      this.toggleViewMode();
      return;
    }

    if (code === 'KeyE') {
      this.handleInteract();
      return;
    }

    if (this.gameState === 'PLAYING') {
      this.heldKeys.add(code);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const code = this.normalizeKeyCode(e);
    this.heldKeys.delete(code);
    this.heldKeys.delete(e.code);
  };

  private onBlur = (): void => {
    this.heldKeys.clear();
    this.isMouseDown = false;
    this.lastMouseClientX = null;
    this.lastMouseClientY = null;
  };

  private handleResize = (): void => {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewportW = Math.max(320, w);
    this.viewportH = Math.max(240, h);
    this.threeRenderer.resize(this.viewportW, this.viewportH);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('mousedown', this.onCanvasMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('mousedown', this.onCanvasMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
