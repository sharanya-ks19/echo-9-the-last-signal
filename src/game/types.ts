export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'TERMINAL'
  | 'PUZZLE_FREQUENCY'
  | 'PUZZLE_REACTOR'
  | 'VICTORY'
  | 'GAME_OVER';

export type ViewMode = 'TOP_DOWN' | 'FRONT_POV';

export type SectorId =
  | 'ARRIVAL_BAY'
  | 'RESEARCH_LAB'
  | 'ENGINEERING_CORE'
  | 'COMMAND_DECK';

export enum TileType {
  VOID = 0,
  FLOOR_METAL = 1,
  FLOOR_GRATE = 2,
  FLOOR_HAZARD = 3,
  WALL = 4,
  WINDOW_SPACE = 5,
}

export type KeycardId =
  | 'card_research'
  | 'card_engineering'
  | 'card_command';

export interface KeycardMeta {
  id: KeycardId;
  name: string;
  shortName: string;
  color: string;
}

export interface DoorEntity {
  id: string;
  label: string;
  tileX: number;
  tileY: number;
  tilesW: number;
  tilesH: number;
  orientation: 'horizontal' | 'vertical';
  locked: boolean;
  requiredCard?: KeycardId;
  requiresPower?: boolean;
  isOpen: boolean;
  openProgress: number;
  sectorHint: string;
}

export type TerminalKind =
  | 'LOG'
  | 'AUDIO_LOG'
  | 'RESEARCH_NOTE'
  | 'PUZZLE_FREQUENCY'
  | 'PUZZLE_REACTOR'
  | 'SIGNAL_RELAY';

export interface TerminalEntity {
  id: string;
  kind?: TerminalKind;
  title: string;
  subtitle: string;
  tileX: number;
  tileY: number;
  sector: SectorId;
  logs: string[];
  actionType?: 'RESTORE_POWER' | 'ACTIVATE_SIGNAL' | 'SOLVE_FREQUENCY';
  actionLabel?: string;
  activated: boolean;
}

export type PickupKind = 'KEYCARD' | 'BEACON_PACK' | 'BATTERY_CELL';

export interface PickupEntity {
  id: string;
  kind?: PickupKind;
  cardId?: KeycardId;
  name: string;
  shortName: string;
  tileX: number;
  tileY: number;
  sector: SectorId;
  color: string;
  collected: boolean;
}

export type HazardKind =
  | 'ELECTRIC_ARC'
  | 'CRYO_LEAK'
  | 'PLASMA_VENT'
  | 'RADIATION_ZONE';

export interface HazardEntity {
  id: string;
  kind: HazardKind;
  label: string;
  tileX: number;
  tileY: number;
  radius: number;
  damagePerSec: number;
  sector: SectorId;
  stabilizedByPower?: boolean;
}

export interface SuitStationEntity {
  id: string;
  label: string;
  tileX: number;
  tileY: number;
  sector: SectorId;
  cooldown: number;
}

export type MonsterTier = 'CREATURE' | 'MODERATE' | 'BOSS';

export type CreatureArchetype =
  | 'SKITTERER'
  | 'ACID_SPITTER'
  | 'VOID_STALKER'
  | 'SENTINEL'
  | 'APEX_BOSS';

export type CreatureAttackStyle =
  | 'LUNGE_CLAW'
  | 'RANGED_ACID'
  | 'PHANTOM_STRIKE'
  | 'BOSS_HYBRID';

export type CreatureAiState =
  | 'PATROL'
  | 'ALERT'
  | 'WINDUP'
  | 'LUNGING'
  | 'RECOVER';

export interface MonsterEntity {
  id: string;
  name: string;
  tier: MonsterTier;
  archetype: CreatureArchetype;
  attackStyle: CreatureAttackStyle;
  aiState: CreatureAiState;
  stateTimer: number;
  lungeVx: number;
  lungeVy: number;
  sector: SectorId;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackRange: number;
  detectRange: number;
  attackCooldown: number;
  hitFlash: number;
  patrolPhase: number;
  active: boolean;
  alive: boolean;
}

export type ListenerBehaviorState =
  | 'PATROL'
  | 'INVESTIGATING'
  | 'SEARCHING'
  | 'HUNTING'
  | 'STAGGERED';

export interface ListenerEntity {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  angle: number;
  radius: number;
  state: ListenerBehaviorState;
  targetX: number;
  targetY: number;
  stateTimer: number;
  stunTimer: number;
  hp: number;
  maxHp: number;
  speed: number;
  attackCooldown: number;
  hitFlash: number;
  patrolIndex: number;
  active: boolean;
}

export interface EchoBeaconEntity {
  id: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export interface EnergyPipeEntity {
  id: string;
  sector: SectorId;
  points: Array<{ x: number; y: number }>;
  color: string;
  poweredBoost?: boolean;
}

export type ProjectileKind = 'MINING_LASER' | 'ACID_BOLT' | 'ENEMY_PLASMA';

export interface ProjectileEntity {
  id: number;
  kind: ProjectileKind;
  fromPlayer: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  knockback: number;
  life: number;
  color: string;
}

export interface AsteroidDebris {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  vertices: number[];
  tint: string;
  hasBeacon?: boolean;
}

export type PropKind =
  | 'RESCUE_POD'
  | 'CRATE'
  | 'CRYO_POD'
  | 'BIO_TANK'
  | 'DESK'
  | 'REACTOR_CORE'
  | 'HOLO_TABLE'
  | 'SERVER_RACK'
  | 'BRIDGE_CONSOLE'
  | 'DAMAGED_PANEL'
  | 'EQUIPMENT_CASE'
  | 'LAB_WORKSTATION'
  | 'GLASS_CONTAINER'
  | 'DAMAGED_GENERATOR'
  | 'CONTAINMENT_CHAMBER'
  | 'WARNING_SIGN'
  | 'BROKEN_CAMERA'
  | 'ALIEN_TRACE';

export interface PropEntity {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
  accentColor?: string;
  label?: string;
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  mode: 'static' | 'pulse' | 'flicker';
  speed?: number;
  phase?: number;
  powerGroup?: 'command_corridor' | 'reactor';
  highRisk?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  kind?: 'MOTE' | 'SPARK' | 'SMOKE';
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  pitch: number;
  radius: number;
  walkCycle: number;
  stepTimer: number;
  suitIntegrity: number;
  battery: number;
  damageFlash: number;
  fireCooldown: number;
  muzzleFlash: number;
  laserHeat: number;
  laserOverheated: boolean;
}

export interface NearbyInteractable {
  kind: 'DOOR' | 'PICKUP' | 'TERMINAL' | 'SUIT_STATION';
  id: string;
  promptText: string;
  lockedReason?: string;
}

export type GameOverReason = 'MONSTER_WIN' | 'HAZARD';

export type EndingChoice = 'EVACUATE_EARTH' | 'PURGE_STATION';

export interface GameSettings {
  mouseSensitivity: number;
  masterVolume: number;
  highQualityLighting: boolean;
  muted: boolean;
}

export interface HudSnapshot {
  gameState: GameState;
  viewMode: ViewMode;
  isPointerLocked: boolean;
  sector: SectorId;
  sectorName: string;
  objectiveTitle: string;
  objectiveDetail: string;
  cards: KeycardMeta[];
  powerRestored: boolean;
  frequencySolved: boolean;
  signalActivated: boolean;
  suitIntegrity: number;
  battery: number;
  echoBeacons: number;
  activeHazardLabel: string | null;
  nearbyPrompt: NearbyInteractable | null;
  toastMessage: string | null;
  toastTone: 'info' | 'success' | 'warning';
  activeTerminal: TerminalEntity | null;
  elapsedSeconds: number;
  logsReadCount: number;
  totalLogsCount: number;
  muted: boolean;
  playerTileX: number;
  playerTileY: number;
  playerAngle: number;
  moderateDefeated: number;
  moderateTotal: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  bossPhase: 0 | 1 | 2;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  listenerState: ListenerBehaviorState;
  listenerDistance: number;
  gameOverReason: GameOverReason;
  laserHeat: number;
  laserOverheated: boolean;
  soundPulseLevel: number;
  beaconPulseActive: boolean;
  hasSavedCheckpoint: boolean;
  endingChoice: EndingChoice;
  guideHintTag: string;
  guideSubtitle: string;
}
