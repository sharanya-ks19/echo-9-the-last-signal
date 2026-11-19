import {
  AsteroidDebris,
  DoorEntity,
  EnergyPipeEntity,
  HazardEntity,
  KeycardId,
  KeycardMeta,
  LightSource,
  ListenerEntity,
  MonsterEntity,
  PickupEntity,
  PropEntity,
  SectorId,
  SuitStationEntity,
  TerminalEntity,
  TileType,
} from './types';

export const TILE_SIZE = 48;
export const MAP_COLS = 64;
export const MAP_ROWS = 48;
export const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;

export const PLAYER_SPAWN = {
  x: 31.5 * TILE_SIZE,
  y: 38.5 * TILE_SIZE,
  angle: -Math.PI / 2,
};

export const SECTOR_NAMES: Record<SectorId, string> = {
  ARRIVAL_BAY: 'Arrival Bay · Crash Impact Deck',
  RESEARCH_LAB: 'Research Lab · Comms Defect Wing',
  ENGINEERING_CORE: 'Engineering Core · Reactor Defect',
  COMMAND_DECK: 'Command Deck · Earth Signal Bridge',
};

export const KEYCARD_CATALOG: Record<KeycardId, KeycardMeta> = {
  card_research: {
    id: 'card_research',
    name: 'Research Lab Access Card',
    shortName: 'Research Keycard',
    color: '#22d3ee',
  },
  card_engineering: {
    id: 'card_engineering',
    name: 'Engineering Core Keycard',
    shortName: 'Engineering Keycard',
    color: '#f59e0b',
  },
  card_command: {
    id: 'card_command',
    name: 'Command Clearance Card',
    shortName: 'Command Keycard',
    color: '#38bdf8',
  },
};

export function getSectorAtWorldPos(wx: number, wy: number): SectorId {
  const col = Math.floor(wx / TILE_SIZE);
  const row = Math.floor(wy / TILE_SIZE);
  if (row <= 13) return 'COMMAND_DECK';
  if (row >= 32 && col <= 45) return 'ARRIVAL_BAY';
  if (col >= 33) return 'ENGINEERING_CORE';
  return 'RESEARCH_LAB';
}

export interface StationWorldData {
  grid: TileType[][];
  doors: DoorEntity[];
  terminals: TerminalEntity[];
  pickups: PickupEntity[];
  props: PropEntity[];
  energyPipes: EnergyPipeEntity[];
  lights: LightSource[];
  hazards: HazardEntity[];
  suitStations: SuitStationEntity[];
  asteroids: AsteroidDebris[];
  monsters: MonsterEntity[];
  listener: ListenerEntity;
}

function createEmptyGrid(): TileType[][] {
  return Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => TileType.VOID)
  );
}

function carveRoom(
  grid: TileType[][],
  c1: number,
  r1: number,
  c2: number,
  r2: number,
  floorType: TileType = TileType.FLOOR_METAL
): void {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) continue;
      if (r === r1 || r === r2 || c === c1 || c === c2) {
        if (grid[r][c] === TileType.VOID) {
          grid[r][c] = TileType.WALL;
        }
      } else {
        grid[r][c] = floorType;
      }
    }
  }
}

function fillFloorRect(
  grid: TileType[][],
  c1: number,
  r1: number,
  c2: number,
  r2: number,
  floorType: TileType
): void {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
        grid[r][c] = floorType;
      }
    }
  }
}

function setWallRect(
  grid: TileType[][],
  c1: number,
  r1: number,
  c2: number,
  r2: number
): void {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
        grid[r][c] = TileType.WALL;
      }
    }
  }
}

export function createStationWorld(): StationWorldData {
  const grid = createEmptyGrid();

  // ---------------------------------------------------------------------------
  // 1. ARRIVAL BAY (South)
  // ---------------------------------------------------------------------------
  carveRoom(grid, 26, 39, 37, 46, TileType.FLOOR_METAL);
  carveRoom(grid, 23, 32, 40, 40, TileType.FLOOR_METAL);
  fillFloorRect(grid, 28, 39, 35, 40, TileType.FLOOR_HAZARD);
  carveRoom(grid, 17, 32, 24, 39, TileType.FLOOR_METAL);
  fillFloorRect(grid, 23, 35, 24, 37, TileType.FLOOR_METAL);
  carveRoom(grid, 39, 32, 45, 40, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 39, 35, 40, 37, TileType.FLOOR_METAL);
  fillFloorRect(grid, 29, 34, 34, 38, TileType.FLOOR_GRATE);

  // Large Arrival Bay South Space Observation Windows
  for (let c = 28; c <= 35; c++) {
    grid[46][c] = TileType.WINDOW_SPACE;
  }

  // Corridor from Arrival Bay West -> Research Lab
  carveRoom(grid, 19, 27, 22, 33, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 20, 32, 21, 32, TileType.FLOOR_HAZARD);

  // Shortcut Corridor from Arrival Bay East -> Engineering South
  carveRoom(grid, 40, 27, 43, 33, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 41, 32, 42, 32, TileType.FLOOR_HAZARD);

  // ---------------------------------------------------------------------------
  // 2. RESEARCH LAB (West / North-West)
  // ---------------------------------------------------------------------------
  carveRoom(grid, 13, 17, 27, 28, TileType.FLOOR_METAL);
  fillFloorRect(grid, 20, 27, 21, 29, TileType.FLOOR_METAL);
  carveRoom(grid, 4, 20, 14, 29, TileType.FLOOR_METAL);
  fillFloorRect(grid, 13, 23, 14, 25, TileType.FLOOR_METAL);
  fillFloorRect(grid, 6, 22, 11, 27, TileType.FLOOR_GRATE);
  carveRoom(grid, 4, 13, 14, 20, TileType.FLOOR_METAL);
  setWallRect(grid, 13, 14, 13, 20);
  fillFloorRect(grid, 13, 16, 13, 17, TileType.FLOOR_HAZARD);
  setWallRect(grid, 4, 20, 13, 20);

  // Bridge Corridor connecting Research Lab -> Engineering Core
  carveRoom(grid, 26, 21, 39, 24, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 27, 22, 27, 23, TileType.FLOOR_METAL);
  fillFloorRect(grid, 32, 22, 32, 23, TileType.FLOOR_HAZARD);

  // ---------------------------------------------------------------------------
  // 3. ENGINEERING CORE (East)
  // ---------------------------------------------------------------------------
  carveRoom(grid, 38, 18, 59, 35, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 38, 22, 39, 23, TileType.FLOOR_METAL);
  fillFloorRect(grid, 41, 27, 42, 31, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 46, 23, 52, 29, TileType.FLOOR_HAZARD);
  fillFloorRect(grid, 47, 24, 51, 28, TileType.FLOOR_METAL);

  carveRoom(grid, 45, 13, 59, 19, TileType.FLOOR_METAL);
  fillFloorRect(grid, 49, 18, 53, 19, TileType.FLOOR_HAZARD);

  carveRoom(grid, 46, 35, 59, 43, TileType.FLOOR_METAL);
  setWallRect(grid, 46, 35, 59, 35);
  fillFloorRect(grid, 50, 35, 51, 35, TileType.FLOOR_HAZARD);

  carveRoom(grid, 37, 14, 46, 19, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 40, 18, 43, 19, TileType.FLOOR_GRATE);
  carveRoom(grid, 29, 13, 38, 17, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 37, 15, 38, 16, TileType.FLOOR_GRATE);

  // ---------------------------------------------------------------------------
  // 4. COMMAND DECK (North)
  // ---------------------------------------------------------------------------
  carveRoom(grid, 18, 2, 45, 13, TileType.FLOOR_METAL);
  fillFloorRect(grid, 31, 13, 32, 13, TileType.FLOOR_HAZARD);
  fillFloorRect(grid, 25, 4, 38, 11, TileType.FLOOR_GRATE);
  fillFloorRect(grid, 28, 6, 35, 10, TileType.FLOOR_METAL);

  // Large Panoramic Observation Window overlooking the unexplored planet
  for (let c = 20; c <= 43; c++) {
    grid[2][c] = TileType.WINDOW_SPACE;
  }

  // Airtight hull pass: ensure every walkable floor tile is completely enclosed by WALL or WINDOW_SPACE
  const isFloor = (t: TileType) =>
    t === TileType.FLOOR_METAL ||
    t === TileType.FLOOR_GRATE ||
    t === TileType.FLOOR_HAZARD;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      if (!isFloor(grid[r][c])) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
          if (grid[nr][nc] === TileType.VOID) {
            grid[nr][nc] = TileType.WALL;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // DOORS
  // ---------------------------------------------------------------------------
  const doors: DoorEntity[] = [
    {
      id: 'door_research',
      label: 'Research Lab Bulkhead',
      tileX: 20,
      tileY: 32,
      tilesW: 2,
      tilesH: 1,
      orientation: 'horizontal',
      locked: true,
      requiredCard: 'card_research',
      isOpen: false,
      openProgress: 0,
      sectorHint: 'Research Lab',
    },
    {
      id: 'door_lab_vault',
      label: 'Specimen Vault Door',
      tileX: 13,
      tileY: 16,
      tilesW: 1,
      tilesH: 2,
      orientation: 'vertical',
      locked: false,
      isOpen: false,
      openProgress: 0,
      sectorHint: 'Specimen Vault',
    },
    {
      id: 'door_engineering',
      label: 'Engineering Airlock',
      tileX: 32,
      tileY: 22,
      tilesW: 1,
      tilesH: 2,
      orientation: 'vertical',
      locked: true,
      requiredCard: 'card_engineering',
      isOpen: false,
      openProgress: 0,
      sectorHint: 'Engineering Core',
    },
    {
      id: 'door_eng_office',
      label: 'Chief Engineer Bay',
      tileX: 50,
      tileY: 35,
      tilesW: 2,
      tilesH: 1,
      orientation: 'horizontal',
      locked: false,
      isOpen: false,
      openProgress: 0,
      sectorHint: 'Engineer Office',
    },
    {
      id: 'door_arrival_shortcut',
      label: 'Cargo Maintenance Airlock',
      tileX: 41,
      tileY: 32,
      tilesW: 2,
      tilesH: 1,
      orientation: 'horizontal',
      locked: true,
      requiredCard: 'card_engineering',
      isOpen: false,
      openProgress: 0,
      sectorHint: 'Arrival / Engineering Link',
    },
    {
      id: 'door_command',
      label: 'Command Deck Seal',
      tileX: 31,
      tileY: 13,
      tilesW: 2,
      tilesH: 1,
      orientation: 'horizontal',
      locked: true,
      requiredCard: 'card_command',
      requiresPower: true,
      isOpen: false,
      openProgress: 0,
      sectorHint: 'Command Deck',
    },
  ];

  // ---------------------------------------------------------------------------
  // KEYCARDS, ECHO BEACON PACKS & BATTERY CELLS
  // ---------------------------------------------------------------------------
  const pickups: PickupEntity[] = [
    {
      id: 'card_research',
      kind: 'KEYCARD',
      cardId: 'card_research',
      name: KEYCARD_CATALOG.card_research.name,
      shortName: KEYCARD_CATALOG.card_research.shortName,
      tileX: 19.5,
      tileY: 35.5,
      sector: 'ARRIVAL_BAY',
      color: KEYCARD_CATALOG.card_research.color,
      collected: false,
    },
    {
      id: 'card_engineering',
      kind: 'KEYCARD',
      cardId: 'card_engineering',
      name: KEYCARD_CATALOG.card_engineering.name,
      shortName: KEYCARD_CATALOG.card_engineering.shortName,
      tileX: 7.5,
      tileY: 16.5,
      sector: 'RESEARCH_LAB',
      color: KEYCARD_CATALOG.card_engineering.color,
      collected: false,
    },
    {
      id: 'card_command',
      kind: 'KEYCARD',
      cardId: 'card_command',
      name: KEYCARD_CATALOG.card_command.name,
      shortName: KEYCARD_CATALOG.card_command.shortName,
      tileX: 55.5,
      tileY: 39.5,
      sector: 'ENGINEERING_CORE',
      color: KEYCARD_CATALOG.card_command.color,
      collected: false,
    },
    // Tactical Echo Beacon Packs & Battery Cells
    {
      id: 'pack_beacon_arr',
      kind: 'BEACON_PACK',
      name: 'Echo Beacon Pack (+2 Decoys)',
      shortName: 'Echo Beacons',
      tileX: 43.2,
      tileY: 38.2,
      sector: 'ARRIVAL_BAY',
      color: '#22d3ee',
      collected: false,
    },
    {
      id: 'pack_beacon_lab',
      kind: 'BEACON_PACK',
      name: 'Echo Beacon Pack (+2 Decoys)',
      shortName: 'Echo Beacons',
      tileX: 11.2,
      tileY: 25.5,
      sector: 'RESEARCH_LAB',
      color: '#22d3ee',
      collected: false,
    },
    {
      id: 'cell_battery_eng',
      kind: 'BATTERY_CELL',
      name: 'High-Capacity Battery Cell (+50%)',
      shortName: 'Battery Cell',
      tileX: 56.5,
      tileY: 28.2,
      sector: 'ENGINEERING_CORE',
      color: '#38bdf8',
      collected: false,
    },
  ];

  // ---------------------------------------------------------------------------
  // INTERACTIVE TERMINALS, AUDIO LOGS, RESEARCH NOTES & PUZZLES
  // ---------------------------------------------------------------------------
  const terminals: TerminalEntity[] = [
    {
      id: 'term_arrival',
      kind: 'AUDIO_LOG',
      title: 'Crash Recorder & Mission Log',
      subtitle: 'Spaceship Station ECHO-9 · Crash Date 2189.11.04',
      tileX: 35.5,
      tileY: 34.5,
      sector: 'ARRIVAL_BAY',
      logs: [
        '[BLACK-BOX — LT. MARCUS CHEN]: In 2189, while approaching this uncharted planet carrying Earth’s active signal relay, hull propulsion failed and ECHO-9 crashed onto the surface.',
        'Native planetary monsters swarmed the wreckage. Their Final Boss seized the Command Deck and knows our last communication channel with Earth.',
        'Mission: Locate all ship defects (Comms & Reactor), kill the 4 planetary monsters and the Final Boss, then communicate with Earth.',
      ],
      activated: false,
    },
    {
      id: 'term_research',
      kind: 'RESEARCH_NOTE',
      title: 'Bio-Lab Mainframe · Planetary Notes',
      subtitle: 'Dr. Elena Rostova · Surface Impact Report 44-B',
      tileX: 20.5,
      tileY: 19.5,
      sector: 'RESEARCH_LAB',
      logs: [
        '[PLANETARY SCAN]: Native hunters track footsteps and gunfire across the wreck—drop [Q] Echo Beacons to lure THE LISTENER away.',
        'DEFECT #1 DETECTED: The planetary crash knocked our Sub-Space Earth Transmitter out of alignment.',
        'Use the Comms Frequency Analyzer nearby to repair Defect #1 before heading east into the Engineering Core.',
      ],
      activated: false,
    },
    {
      id: 'term_frequency',
      kind: 'PUZZLE_FREQUENCY',
      title: 'Defect #1 · Comms Frequency Analyzer',
      subtitle: 'Research Lab · Earth Communication Carrier Repair',
      tileX: 24.2,
      tileY: 19.2,
      sector: 'RESEARCH_LAB',
      logs: [
        'CRASH DEFECT #1: Earth emergency carrier misaligned by atmospheric impact.',
        'Recalibrate Carrier Frequency, Harmonic Phase, and Signal Gain to restore Earth link readiness.',
      ],
      actionType: 'SOLVE_FREQUENCY',
      actionLabel: 'Repair Comms Defect',
      activated: false,
    },
    {
      id: 'term_power',
      kind: 'PUZZLE_REACTOR',
      title: 'Defect #2 · Reactor Power Console',
      subtitle: 'Engineering Core · Crash-Damaged Power Grid',
      tileX: 52.5,
      tileY: 15.5,
      sector: 'ENGINEERING_CORE',
      logs: [
        'CRASH DEFECT #2: Impact fractured reactor bus distribution; Command Deck seals are offline.',
        'Balance the three power buses to 100 MW total to repair the grid and power the Earth relay bridge.',
      ],
      actionType: 'RESTORE_POWER',
      actionLabel: 'Repair Reactor Defect',
      activated: false,
    },
    {
      id: 'term_eng_audio',
      kind: 'AUDIO_LOG',
      title: "Chief Engineer's Crash Report",
      subtitle: 'Engineering Bay · Automated Recording',
      tileX: 48.2,
      tileY: 38.5,
      sector: 'ENGINEERING_CORE',
      logs: [
        '[AUDIO LOG — CHIEF ENG. SATO]: Four planetary beasts hold the corridors while the Final Boss controls our crashed bridge above.',
        'I locked my Command Clearance Card on the east desk before sealing this compartment.',
        'Fix every ship defect and clear the 4 monsters—if the Final Boss wins, he will destroy our Earth signal connection forever.',
      ],
      activated: false,
    },
    {
      id: 'term_captain',
      kind: 'AUDIO_LOG',
      title: "Captain Vance's Bridge Black-Box",
      subtitle: 'Command Deck · Final Entry',
      tileX: 22.5,
      tileY: 7.5,
      sector: 'COMMAND_DECK',
      logs: [
        '[AUDIO LOG — CAPT. VANCE]: The crash ripped open the hull and the Apex Warlord took command of the bridge.',
        'He knows the Earth Signal Relay sits right behind these consoles and intends to shatter our link with Earth.',
        'Eliminate all 4 planetary monsters and the Final Boss, then transmit our signal to Earth.',
      ],
      activated: false,
    },
    {
      id: 'term_signal',
      kind: 'SIGNAL_RELAY',
      title: 'Earth Communication Signal Relay',
      subtitle: 'Command Deck · Long-Range Earth Link',
      tileX: 31.5,
      tileY: 4.5,
      sector: 'COMMAND_DECK',
      logs: [
        'Earth Orbital Link: Carrier locked on frequency 448.92 MHz.',
        'CRITICAL ALERT: Four planetary monsters and the Final Boss controlling ECHO-9 are blocking Earth transmission.',
        'Repair all ship defects, kill the 4 monsters + Final Boss, and transmit to Earth before the Boss destroys the connection.',
      ],
      actionType: 'ACTIVATE_SIGNAL',
      actionLabel: 'Communicate with Earth & Complete Mission',
      activated: false,
    },
  ];

  // ---------------------------------------------------------------------------
  // GLOWING BLUE ENERGY PIPES
  // ---------------------------------------------------------------------------
  const energyPipes: EnergyPipeEntity[] = [
    {
      id: 'pipe_eng_north',
      sector: 'ENGINEERING_CORE',
      points: [
        { x: 49.5 * TILE_SIZE, y: 25 * TILE_SIZE },
        { x: 49.5 * TILE_SIZE, y: 19.5 * TILE_SIZE },
        { x: 52.5 * TILE_SIZE, y: 19.5 * TILE_SIZE },
        { x: 52.5 * TILE_SIZE, y: 16.5 * TILE_SIZE },
      ],
      color: '#22d3ee',
      poweredBoost: true,
    },
    {
      id: 'pipe_eng_west',
      sector: 'ENGINEERING_CORE',
      points: [
        { x: 48 * TILE_SIZE, y: 26.5 * TILE_SIZE },
        { x: 44 * TILE_SIZE, y: 26.5 * TILE_SIZE },
        { x: 44 * TILE_SIZE, y: 22.5 * TILE_SIZE },
        { x: 27.5 * TILE_SIZE, y: 22.5 * TILE_SIZE },
      ],
      color: '#38bdf8',
      poweredBoost: true,
    },
    {
      id: 'pipe_eng_south',
      sector: 'ENGINEERING_CORE',
      points: [
        { x: 50.5 * TILE_SIZE, y: 28 * TILE_SIZE },
        { x: 50.5 * TILE_SIZE, y: 34.5 * TILE_SIZE },
        { x: 55.5 * TILE_SIZE, y: 34.5 * TILE_SIZE },
      ],
      color: '#38bdf8',
      poweredBoost: true,
    },
    {
      id: 'pipe_cmd_link',
      sector: 'COMMAND_DECK',
      points: [
        { x: 31.5 * TILE_SIZE, y: 15.5 * TILE_SIZE },
        { x: 31.5 * TILE_SIZE, y: 11 * TILE_SIZE },
        { x: 31.5 * TILE_SIZE, y: 5.5 * TILE_SIZE },
      ],
      color: '#22d3ee',
      poweredBoost: true,
    },
  ];

  // ---------------------------------------------------------------------------
  // PROPS & ENVIRONMENTAL STORYTELLING DETAILS
  // ---------------------------------------------------------------------------
  const props: PropEntity[] = [
    // Arrival Bay Rescue Pod + Storytelling Props
    {
      id: 'prop_rescue_pod',
      kind: 'RESCUE_POD',
      x: 30 * TILE_SIZE,
      y: 42.6 * TILE_SIZE,
      w: 3 * TILE_SIZE,
      h: 2.1 * TILE_SIZE,
      solid: true,
      accentColor: '#38bdf8',
    },
    {
      id: 'crate_arr_1',
      kind: 'CRATE',
      x: 25 * TILE_SIZE + 8,
      y: 34 * TILE_SIZE + 8,
      w: 54,
      h: 40,
      solid: true,
    },
    {
      id: 'crate_arr_2',
      kind: 'CRATE',
      x: 41 * TILE_SIZE + 6,
      y: 37 * TILE_SIZE + 6,
      w: 58,
      h: 42,
      solid: true,
    },
    {
      id: 'crate_arr_3',
      kind: 'CRATE',
      x: 43 * TILE_SIZE + 4,
      y: 34 * TILE_SIZE + 10,
      w: 44,
      h: 42,
      solid: true,
    },
    {
      id: 'equip_arr_1',
      kind: 'EQUIPMENT_CASE',
      x: 37.2 * TILE_SIZE,
      y: 37.8 * TILE_SIZE,
      w: 48,
      h: 34,
      solid: true,
      accentColor: '#f59e0b',
    },
    {
      id: 'panel_arr_dmg',
      kind: 'DAMAGED_PANEL',
      x: 24.2 * TILE_SIZE,
      y: 32.8 * TILE_SIZE,
      w: 44,
      h: 24,
      solid: false,
      accentColor: '#ef4444',
    },
    {
      id: 'sign_arr_warn',
      kind: 'WARNING_SIGN',
      x: 28.2 * TILE_SIZE,
      y: 33.1 * TILE_SIZE,
      w: 52,
      h: 20,
      solid: false,
      label: 'LOCKDOWN',
    },
    {
      id: 'cam_arr_broken',
      kind: 'BROKEN_CAMERA',
      x: 22.8 * TILE_SIZE,
      y: 33.2 * TILE_SIZE,
      w: 24,
      h: 24,
      solid: false,
    },
    {
      id: 'trace_arr_alien',
      kind: 'ALIEN_TRACE',
      x: 20.2 * TILE_SIZE,
      y: 33.2 * TILE_SIZE,
      w: 48,
      h: 48,
      solid: false,
    },
    {
      id: 'desk_security',
      kind: 'DESK',
      x: 18.4 * TILE_SIZE,
      y: 34.1 * TILE_SIZE,
      w: 94,
      h: 40,
      solid: true,
      accentColor: '#22d3ee',
    },

    // Research Lab Workstations, Glass Containers, Bio-Tanks & Cryo Pods
    {
      id: 'biotank_1',
      kind: 'BIO_TANK',
      x: 16 * TILE_SIZE,
      y: 22 * TILE_SIZE,
      w: 50,
      h: 50,
      solid: true,
      accentColor: '#22d3ee',
    },
    {
      id: 'biotank_2',
      kind: 'BIO_TANK',
      x: 23 * TILE_SIZE,
      y: 22 * TILE_SIZE,
      w: 50,
      h: 50,
      solid: true,
      accentColor: '#22d3ee',
    },
    {
      id: 'biotank_3',
      kind: 'BIO_TANK',
      x: 16 * TILE_SIZE,
      y: 25 * TILE_SIZE,
      w: 50,
      h: 50,
      solid: true,
      accentColor: '#38bdf8',
    },
    {
      id: 'lab_station_1',
      kind: 'LAB_WORKSTATION',
      x: 15.2 * TILE_SIZE,
      y: 18.2 * TILE_SIZE,
      w: 88,
      h: 36,
      solid: true,
      accentColor: '#22d3ee',
    },
    {
      id: 'glass_lab_1',
      kind: 'GLASS_CONTAINER',
      x: 25.2 * TILE_SIZE,
      y: 18.2 * TILE_SIZE,
      w: 36,
      h: 36,
      solid: true,
      accentColor: '#38bdf8',
    },
    {
      id: 'panel_lab_dmg',
      kind: 'DAMAGED_PANEL',
      x: 14.2 * TILE_SIZE,
      y: 26.8 * TILE_SIZE,
      w: 44,
      h: 24,
      solid: false,
      accentColor: '#ef4444',
    },
    {
      id: 'trace_lab_1',
      kind: 'ALIEN_TRACE',
      x: 19 * TILE_SIZE,
      y: 24.5 * TILE_SIZE,
      w: 56,
      h: 56,
      solid: false,
    },
    {
      id: 'cam_lab_broken',
      kind: 'BROKEN_CAMERA',
      x: 14.3 * TILE_SIZE,
      y: 18.1 * TILE_SIZE,
      w: 24,
      h: 24,
      solid: false,
    },
    {
      id: 'cryo_1',
      kind: 'CRYO_POD',
      x: 5.5 * TILE_SIZE,
      y: 22 * TILE_SIZE,
      w: 50,
      h: 80,
      solid: true,
      accentColor: '#38bdf8',
    },
    {
      id: 'cryo_2',
      kind: 'CRYO_POD',
      x: 8.5 * TILE_SIZE,
      y: 22 * TILE_SIZE,
      w: 50,
      h: 80,
      solid: true,
      accentColor: '#38bdf8',
    },
    {
      id: 'cryo_3',
      kind: 'CRYO_POD',
      x: 5.5 * TILE_SIZE,
      y: 26 * TILE_SIZE,
      w: 50,
      h: 80,
      solid: true,
      accentColor: '#ef4444',
    },
    {
      id: 'desk_vault',
      kind: 'DESK',
      x: 6.5 * TILE_SIZE,
      y: 14.2 * TILE_SIZE,
      w: 94,
      h: 40,
      solid: true,
      accentColor: '#f59e0b',
    },

    // Engineering Core Reactor, Generators & Storytelling
    {
      id: 'reactor_core',
      kind: 'REACTOR_CORE',
      x: 48 * TILE_SIZE,
      y: 25 * TILE_SIZE,
      w: 3 * TILE_SIZE,
      h: 3 * TILE_SIZE,
      solid: true,
      accentColor: '#ef4444',
    },
    {
      id: 'gen_eng_1',
      kind: 'DAMAGED_GENERATOR',
      x: 42 * TILE_SIZE,
      y: 31.5 * TILE_SIZE,
      w: 68,
      h: 46,
      solid: true,
      accentColor: '#f59e0b',
    },
    {
      id: 'gen_eng_2',
      kind: 'DAMAGED_GENERATOR',
      x: 55.2 * TILE_SIZE,
      y: 30.8 * TILE_SIZE,
      w: 68,
      h: 46,
      solid: true,
      accentColor: '#ef4444',
    },
    {
      id: 'server_eng_1',
      kind: 'SERVER_RACK',
      x: 42 * TILE_SIZE,
      y: 20 * TILE_SIZE,
      w: 44,
      h: 90,
      solid: true,
    },
    {
      id: 'server_eng_2',
      kind: 'SERVER_RACK',
      x: 56 * TILE_SIZE,
      y: 24 * TILE_SIZE,
      w: 44,
      h: 90,
      solid: true,
    },
    {
      id: 'sign_eng_warn',
      kind: 'WARNING_SIGN',
      x: 48.2 * TILE_SIZE,
      y: 19.1 * TILE_SIZE,
      w: 64,
      h: 20,
      solid: false,
      label: 'HIGH VOLTAGE',
    },
    {
      id: 'desk_engineer',
      kind: 'DESK',
      x: 54.5 * TILE_SIZE,
      y: 37.8 * TILE_SIZE,
      w: 94,
      h: 40,
      solid: true,
      accentColor: '#38bdf8',
    },

    // Command Deck Consoles, Holo Table & Listener Containment Chamber
    {
      id: 'holo_bridge',
      kind: 'HOLO_TABLE',
      x: 30 * TILE_SIZE,
      y: 7.5 * TILE_SIZE,
      w: 3 * TILE_SIZE,
      h: 2 * TILE_SIZE,
      solid: true,
      accentColor: '#22d3ee',
    },
    {
      id: 'console_cmd_left',
      kind: 'BRIDGE_CONSOLE',
      x: 21 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      w: 108,
      h: 36,
      solid: true,
    },
    {
      id: 'console_cmd_right',
      kind: 'BRIDGE_CONSOLE',
      x: 39 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      w: 108,
      h: 36,
      solid: true,
    },
    {
      id: 'containment_cmd',
      kind: 'CONTAINMENT_CHAMBER',
      x: 36.2 * TILE_SIZE,
      y: 6.2 * TILE_SIZE,
      w: 5.2 * TILE_SIZE,
      h: 4.2 * TILE_SIZE,
      solid: false,
      accentColor: '#ef4444',
      label: 'CONTAINMENT BREACH · SPECIMEN 09',
    },
    {
      id: 'trace_cmd_1',
      kind: 'ALIEN_TRACE',
      x: 37.8 * TILE_SIZE,
      y: 7.4 * TILE_SIZE,
      w: 64,
      h: 64,
      solid: false,
    },
    {
      id: 'cam_cmd_broken',
      kind: 'BROKEN_CAMERA',
      x: 30.2 * TILE_SIZE,
      y: 12.1 * TILE_SIZE,
      w: 24,
      h: 24,
      solid: false,
    },
  ];

  // ---------------------------------------------------------------------------
  // DYNAMIC ATMOSPHERIC LIGHT SOURCES
  // ---------------------------------------------------------------------------
  const lights: LightSource[] = [
    {
      x: 31.5 * TILE_SIZE,
      y: 42.5 * TILE_SIZE,
      radius: 220,
      color: '#38bdf8',
      intensity: 0.6,
      mode: 'static',
    },
    {
      x: 26.5 * TILE_SIZE,
      y: 34.5 * TILE_SIZE,
      radius: 195,
      color: '#ef4444',
      intensity: 0.85,
      mode: 'pulse',
      speed: 2.8,
      phase: 0,
      highRisk: true,
    },
    {
      x: 19.5 * TILE_SIZE,
      y: 36 * TILE_SIZE,
      radius: 155,
      color: '#22d3ee',
      intensity: 0.55,
      mode: 'flicker',
      speed: 8,
      phase: 1.2,
    },
    {
      x: 42 * TILE_SIZE,
      y: 36 * TILE_SIZE,
      radius: 195,
      color: '#ef4444',
      intensity: 0.85,
      mode: 'pulse',
      speed: 2.6,
      phase: 2.1,
      highRisk: true,
    },
    {
      x: 19.5 * TILE_SIZE,
      y: 23 * TILE_SIZE,
      radius: 250,
      color: '#06b6d4',
      intensity: 0.65,
      mode: 'pulse',
      speed: 1.1,
      phase: 0.5,
    },
    {
      x: 8.5 * TILE_SIZE,
      y: 24.5 * TILE_SIZE,
      radius: 185,
      color: '#38bdf8',
      intensity: 0.48,
      mode: 'static',
    },
    {
      x: 7.5 * TILE_SIZE,
      y: 16.5 * TILE_SIZE,
      radius: 160,
      color: '#f59e0b',
      intensity: 0.58,
      mode: 'pulse',
      speed: 2.0,
      phase: 1.4,
    },
    {
      x: 49.5 * TILE_SIZE,
      y: 26.5 * TILE_SIZE,
      radius: 330,
      color: '#ef4444',
      intensity: 0.9,
      mode: 'pulse',
      speed: 3.1,
      phase: 0,
      powerGroup: 'reactor',
      highRisk: true,
    },
    {
      x: 52.5 * TILE_SIZE,
      y: 16 * TILE_SIZE,
      radius: 165,
      color: '#38bdf8',
      intensity: 0.58,
      mode: 'static',
    },
    {
      x: 55 * TILE_SIZE,
      y: 39.5 * TILE_SIZE,
      radius: 170,
      color: '#38bdf8',
      intensity: 0.52,
      mode: 'static',
    },
    {
      x: 34 * TILE_SIZE,
      y: 15.5 * TILE_SIZE,
      radius: 185,
      color: '#ef4444',
      intensity: 0.85,
      mode: 'pulse',
      speed: 3.2,
      phase: 0.8,
      powerGroup: 'command_corridor',
      highRisk: true,
    },
    {
      x: 31.5 * TILE_SIZE,
      y: 8.5 * TILE_SIZE,
      radius: 270,
      color: '#22d3ee',
      intensity: 0.68,
      mode: 'static',
    },
    {
      x: 31.5 * TILE_SIZE,
      y: 4.5 * TILE_SIZE,
      radius: 230,
      color: '#38bdf8',
      intensity: 0.62,
      mode: 'pulse',
      speed: 1.4,
      phase: 0.2,
    },
    {
      x: 38.8 * TILE_SIZE,
      y: 8.2 * TILE_SIZE,
      radius: 215,
      color: '#ef4444',
      intensity: 0.88,
      mode: 'pulse',
      speed: 3.3,
      phase: 0.4,
      highRisk: true,
    },
    {
      x: 42.5 * TILE_SIZE,
      y: 38.2 * TILE_SIZE,
      radius: 205,
      color: '#ef4444',
      intensity: 0.9,
      mode: 'pulse',
      speed: 3.4,
      phase: 0.3,
      highRisk: true,
    },
    {
      x: 25.5 * TILE_SIZE,
      y: 33.8 * TILE_SIZE,
      radius: 185,
      color: '#ef4444',
      intensity: 0.8,
      mode: 'pulse',
      speed: 2.9,
      phase: 1.1,
      highRisk: true,
    },
    {
      x: 9.8 * TILE_SIZE,
      y: 27.2 * TILE_SIZE,
      radius: 210,
      color: '#ef4444',
      intensity: 0.88,
      mode: 'pulse',
      speed: 3.1,
      phase: 1.7,
      highRisk: true,
    },
    {
      x: 24.8 * TILE_SIZE,
      y: 25.5 * TILE_SIZE,
      radius: 205,
      color: '#ef4444',
      intensity: 0.85,
      mode: 'pulse',
      speed: 2.7,
      phase: 2.4,
      highRisk: true,
    },
    {
      x: 46.2 * TILE_SIZE,
      y: 26.5 * TILE_SIZE,
      radius: 195,
      color: '#ef4444',
      intensity: 0.92,
      mode: 'pulse',
      speed: 3.6,
      phase: 0.5,
      powerGroup: 'reactor',
      highRisk: true,
    },
    {
      x: 52.8 * TILE_SIZE,
      y: 26.5 * TILE_SIZE,
      radius: 195,
      color: '#ef4444',
      intensity: 0.92,
      mode: 'pulse',
      speed: 3.6,
      phase: 2.0,
      powerGroup: 'reactor',
      highRisk: true,
    },
    {
      x: 41.2 * TILE_SIZE,
      y: 29.8 * TILE_SIZE,
      radius: 195,
      color: '#ef4444',
      intensity: 0.88,
      mode: 'pulse',
      speed: 3.3,
      phase: 1.5,
      highRisk: true,
    },
    {
      x: 39.2 * TILE_SIZE,
      y: 6.8 * TILE_SIZE,
      radius: 195,
      color: '#ef4444',
      intensity: 0.88,
      mode: 'pulse',
      speed: 3.5,
      phase: 0.9,
      highRisk: true,
    },
  ];

  // ---------------------------------------------------------------------------
  // DANGEROUS INTERIOR HAZARDS
  // ---------------------------------------------------------------------------
  const hazards: HazardEntity[] = [
    {
      id: 'haz_arr_arc',
      kind: 'ELECTRIC_ARC',
      label: 'Exposed High-Voltage Conduit',
      tileX: 42.5,
      tileY: 38.2,
      radius: 44,
      damagePerSec: 16,
      sector: 'ARRIVAL_BAY',
    },
    {
      id: 'haz_arr_cryo',
      kind: 'CRYO_LEAK',
      label: 'Ruptured Coolant Pipe',
      tileX: 25.5,
      tileY: 33.8,
      radius: 40,
      damagePerSec: 12,
      sector: 'ARRIVAL_BAY',
    },
    {
      id: 'haz_lab_cryo',
      kind: 'CRYO_LEAK',
      label: 'Sub-Zero Cryo Breach',
      tileX: 9.8,
      tileY: 27.2,
      radius: 44,
      damagePerSec: 14,
      sector: 'RESEARCH_LAB',
    },
    {
      id: 'haz_lab_rad',
      kind: 'RADIATION_ZONE',
      label: 'Bio-Containment Radiation Leak',
      tileX: 24.8,
      tileY: 25.5,
      radius: 46,
      damagePerSec: 15,
      sector: 'RESEARCH_LAB',
    },
    {
      id: 'haz_eng_plasma_w',
      kind: 'PLASMA_VENT',
      label: 'Unstable Plasma Fissure',
      tileX: 46.2,
      tileY: 26.5,
      radius: 46,
      damagePerSec: 20,
      sector: 'ENGINEERING_CORE',
      stabilizedByPower: true,
    },
    {
      id: 'haz_eng_plasma_e',
      kind: 'PLASMA_VENT',
      label: 'Unstable Plasma Fissure',
      tileX: 52.8,
      tileY: 26.5,
      radius: 46,
      damagePerSec: 20,
      sector: 'ENGINEERING_CORE',
      stabilizedByPower: true,
    },
    {
      id: 'haz_eng_arc',
      kind: 'ELECTRIC_ARC',
      label: 'Shorted Power Junction',
      tileX: 41.2,
      tileY: 29.8,
      radius: 42,
      damagePerSec: 16,
      sector: 'ENGINEERING_CORE',
    },
    {
      id: 'haz_cmd_arc',
      kind: 'ELECTRIC_ARC',
      label: 'Overloaded Bridge Relay',
      tileX: 39.2,
      tileY: 6.8,
      radius: 42,
      damagePerSec: 16,
      sector: 'COMMAND_DECK',
    },
  ];

  // ---------------------------------------------------------------------------
  // SUIT & BATTERY RECHARGE STATIONS
  // ---------------------------------------------------------------------------
  const suitStations: SuitStationEntity[] = [
    {
      id: 'suit_arr',
      label: 'Nano-Med & Battery Station',
      tileX: 28.5,
      tileY: 34.2,
      sector: 'ARRIVAL_BAY',
      cooldown: 0,
    },
    {
      id: 'suit_eng',
      label: 'Engineering Med & Power Node',
      tileX: 47.5,
      tileY: 20.5,
      sector: 'ENGINEERING_CORE',
      cooldown: 0,
    },
    {
      id: 'suit_cmd',
      label: 'Bridge Emergency Med-Pod',
      tileX: 22.5,
      tileY: 10.5,
      sector: 'COMMAND_DECK',
      cooldown: 0,
    },
  ];

  // ---------------------------------------------------------------------------
  // DANGEROUS SURROUNDING TERRITORY (Orbital Asteroid & Debris Field)
  // ---------------------------------------------------------------------------
  const asteroids: AsteroidDebris[] = Array.from({ length: 46 }, (_, i) => {
    const angle = (i / 46) * Math.PI * 2 + (i % 3) * 0.21;
    const dist = 1080 + (i % 5) * 260;
    const cx = WORLD_WIDTH * 0.5 + Math.cos(angle) * dist * 1.15;
    const cy = WORLD_HEIGHT * 0.5 + Math.sin(angle) * dist * 0.85;
    const radius = 28 + (i % 4) * 22;
    const vertices = Array.from({ length: 8 }, (__, v) => {
      const jitter = 0.68 + (((i * 19 + v * 37) % 100) / 100) * 0.48;
      return jitter;
    });
    return {
      x: cx,
      y: cy,
      radius,
      rotation: (i * 0.7) % (Math.PI * 2),
      rotSpeed: (i % 2 === 0 ? 1 : -1) * (0.08 + (i % 4) * 0.04),
      vertices,
      tint: i % 5 === 0 ? '#7f1d1d' : i % 3 === 0 ? '#1e293b' : '#334155',
      hasBeacon: i % 6 === 0,
    };
  });

  // ---------------------------------------------------------------------------
  // HOSTILE BIO-THREATS & ATTACKING ALIEN CREATURES
  // ---------------------------------------------------------------------------
  const monsters: MonsterEntity[] = [
    // --- ARRIVAL BAY ---
    {
      id: 'cre_arr_skitter',
      name: 'Vent Skitterer',
      tier: 'CREATURE',
      archetype: 'SKITTERER',
      attackStyle: 'LUNGE_CLAW',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'ARRIVAL_BAY',
      x: 41.2 * TILE_SIZE,
      y: 34.5 * TILE_SIZE,
      homeX: 41.2 * TILE_SIZE,
      homeY: 34.5 * TILE_SIZE,
      angle: Math.PI,
      radius: 13,
      hp: 55,
      maxHp: 55,
      speed: 128,
      attackDamage: 8,
      attackRange: 38,
      detectRange: 320,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 0.4,
      active: true,
      alive: true,
    },
    {
      id: 'cre_arr_west',
      name: 'Security Hive Crawler',
      tier: 'CREATURE',
      archetype: 'SKITTERER',
      attackStyle: 'LUNGE_CLAW',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'ARRIVAL_BAY',
      x: 21.5 * TILE_SIZE,
      y: 37.2 * TILE_SIZE,
      homeX: 21.5 * TILE_SIZE,
      homeY: 37.2 * TILE_SIZE,
      angle: 0,
      radius: 13,
      hp: 60,
      maxHp: 60,
      speed: 132,
      attackDamage: 9,
      attackRange: 38,
      detectRange: 330,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 2.1,
      active: true,
      alive: true,
    },
    {
      id: 'mon_arrival',
      name: 'Arrival Bay Stalker',
      tier: 'MODERATE',
      archetype: 'SENTINEL',
      attackStyle: 'LUNGE_CLAW',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'ARRIVAL_BAY',
      x: 36.5 * TILE_SIZE,
      y: 35.8 * TILE_SIZE,
      homeX: 36.5 * TILE_SIZE,
      homeY: 35.8 * TILE_SIZE,
      angle: Math.PI,
      radius: 16,
      hp: 90,
      maxHp: 90,
      speed: 102,
      attackDamage: 12,
      attackRange: 44,
      detectRange: 350,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 0,
      active: true,
      alive: true,
    },

    // --- RESEARCH LAB ---
    {
      id: 'cre_lab_spitter',
      name: 'Bio-Acid Spitter',
      tier: 'CREATURE',
      archetype: 'ACID_SPITTER',
      attackStyle: 'RANGED_ACID',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'RESEARCH_LAB',
      x: 21.2 * TILE_SIZE,
      y: 25.8 * TILE_SIZE,
      homeX: 21.2 * TILE_SIZE,
      homeY: 25.8 * TILE_SIZE,
      angle: Math.PI * 0.5,
      radius: 14,
      hp: 70,
      maxHp: 70,
      speed: 88,
      attackDamage: 11,
      attackRange: 250,
      detectRange: 390,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 1.1,
      active: true,
      alive: true,
    },
    {
      id: 'cre_lab_stalker',
      name: 'Cryo Void Stalker',
      tier: 'CREATURE',
      archetype: 'VOID_STALKER',
      attackStyle: 'PHANTOM_STRIKE',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'RESEARCH_LAB',
      x: 11.5 * TILE_SIZE,
      y: 22.8 * TILE_SIZE,
      homeX: 11.5 * TILE_SIZE,
      homeY: 22.8 * TILE_SIZE,
      angle: 0,
      radius: 15,
      hp: 80,
      maxHp: 80,
      speed: 126,
      attackDamage: 13,
      attackRange: 44,
      detectRange: 360,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 3.3,
      active: true,
      alive: true,
    },
    {
      id: 'mon_lab',
      name: 'Bio-Lab Ravager',
      tier: 'MODERATE',
      archetype: 'SENTINEL',
      attackStyle: 'LUNGE_CLAW',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'RESEARCH_LAB',
      x: 19.5 * TILE_SIZE,
      y: 20.5 * TILE_SIZE,
      homeX: 19.5 * TILE_SIZE,
      homeY: 20.5 * TILE_SIZE,
      angle: Math.PI * 0.5,
      radius: 16,
      hp: 105,
      maxHp: 105,
      speed: 108,
      attackDamage: 14,
      attackRange: 45,
      detectRange: 370,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 1.5,
      active: true,
      alive: true,
    },

    // --- ENGINEERING CORE ---
    {
      id: 'cre_eng_spitter',
      name: 'Plasma Bio-Spitter',
      tier: 'CREATURE',
      archetype: 'ACID_SPITTER',
      attackStyle: 'RANGED_ACID',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'ENGINEERING_CORE',
      x: 44.2 * TILE_SIZE,
      y: 22.8 * TILE_SIZE,
      homeX: 44.2 * TILE_SIZE,
      homeY: 22.8 * TILE_SIZE,
      angle: Math.PI,
      radius: 15,
      hp: 85,
      maxHp: 85,
      speed: 92,
      attackDamage: 13,
      attackRange: 270,
      detectRange: 410,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 0.7,
      active: true,
      alive: true,
    },
    {
      id: 'cre_eng_stalker',
      name: 'Conduit Ravager',
      tier: 'CREATURE',
      archetype: 'VOID_STALKER',
      attackStyle: 'PHANTOM_STRIKE',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'ENGINEERING_CORE',
      x: 52.5 * TILE_SIZE,
      y: 32.5 * TILE_SIZE,
      homeX: 52.5 * TILE_SIZE,
      homeY: 32.5 * TILE_SIZE,
      angle: -Math.PI * 0.5,
      radius: 15,
      hp: 90,
      maxHp: 90,
      speed: 130,
      attackDamage: 14,
      attackRange: 44,
      detectRange: 370,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 2.5,
      active: true,
      alive: true,
    },
    {
      id: 'mon_eng',
      name: 'Reactor Sentinel',
      tier: 'MODERATE',
      archetype: 'SENTINEL',
      attackStyle: 'LUNGE_CLAW',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'ENGINEERING_CORE',
      x: 54.5 * TILE_SIZE,
      y: 23.5 * TILE_SIZE,
      homeX: 54.5 * TILE_SIZE,
      homeY: 23.5 * TILE_SIZE,
      angle: Math.PI,
      radius: 17,
      hp: 120,
      maxHp: 120,
      speed: 112,
      attackDamage: 15,
      attackRange: 46,
      detectRange: 390,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 2.9,
      active: true,
      alive: true,
    },

    // --- COMMAND DECK ---
    {
      id: 'cre_cmd_stalker',
      name: 'Command Shadow Stalker',
      tier: 'CREATURE',
      archetype: 'VOID_STALKER',
      attackStyle: 'PHANTOM_STRIKE',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'COMMAND_DECK',
      x: 36.5 * TILE_SIZE,
      y: 11.2 * TILE_SIZE,
      homeX: 36.5 * TILE_SIZE,
      homeY: 11.2 * TILE_SIZE,
      angle: Math.PI,
      radius: 15,
      hp: 95,
      maxHp: 95,
      speed: 134,
      attackDamage: 15,
      attackRange: 44,
      detectRange: 400,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 4.5,
      active: true,
      alive: true,
    },
    {
      id: 'mon_bridge',
      name: 'Bridge Vanguard',
      tier: 'MODERATE',
      archetype: 'SENTINEL',
      attackStyle: 'LUNGE_CLAW',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'COMMAND_DECK',
      x: 24.5 * TILE_SIZE,
      y: 9.5 * TILE_SIZE,
      homeX: 24.5 * TILE_SIZE,
      homeY: 9.5 * TILE_SIZE,
      angle: 0,
      radius: 17,
      hp: 135,
      maxHp: 135,
      speed: 116,
      attackDamage: 16,
      attackRange: 46,
      detectRange: 410,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 4.1,
      active: true,
      alive: true,
    },
    {
      id: 'mon_boss',
      name: 'Apex Warlord · Final Boss',
      tier: 'BOSS',
      archetype: 'APEX_BOSS',
      attackStyle: 'BOSS_HYBRID',
      aiState: 'PATROL',
      stateTimer: 0,
      lungeVx: 0,
      lungeVy: 0,
      sector: 'COMMAND_DECK',
      x: 38.8 * TILE_SIZE,
      y: 8.2 * TILE_SIZE,
      homeX: 38.8 * TILE_SIZE,
      homeY: 8.2 * TILE_SIZE,
      angle: Math.PI,
      radius: 22,
      hp: 330,
      maxHp: 330,
      speed: 122,
      attackDamage: 22,
      attackRange: 54,
      detectRange: 960,
      attackCooldown: 0,
      hitFlash: 0,
      patrolPhase: 0,
      active: false,
      alive: true,
    },
  ];

  // ---------------------------------------------------------------------------
  // THE LISTENER (State-Based Acoustic Stalker Organism)
  // ---------------------------------------------------------------------------
  const listener: ListenerEntity = {
    x: 19.5 * TILE_SIZE,
    y: 23.5 * TILE_SIZE,
    homeX: 19.5 * TILE_SIZE,
    homeY: 23.5 * TILE_SIZE,
    angle: 0,
    radius: 18,
    state: 'PATROL',
    targetX: 19.5 * TILE_SIZE,
    targetY: 23.5 * TILE_SIZE,
    stateTimer: 0,
    stunTimer: 0,
    hp: 140,
    maxHp: 140,
    speed: 88,
    attackCooldown: 0,
    hitFlash: 0,
    patrolIndex: 0,
    active: true,
  };

  return {
    grid,
    doors,
    terminals,
    pickups,
    props,
    energyPipes,
    lights,
    hazards,
    suitStations,
    asteroids,
    monsters,
    listener,
  };
}
