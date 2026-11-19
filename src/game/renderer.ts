import { bossSpriteLoader, sentinelSpriteLoader } from './bossSprite';
import {
  MAP_COLS,
  MAP_ROWS,
  StationWorldData,
  TILE_SIZE,
} from './stationMap';
import {
  DoorEntity,
  EchoBeaconEntity,
  EnergyPipeEntity,
  LightSource,
  ListenerEntity,
  MonsterEntity,
  NearbyInteractable,
  Particle,
  PickupEntity,
  PlayerState,
  ProjectileEntity,
  PropEntity,
  TerminalEntity,
  TileType,
} from './types';

interface StarPoint {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkleSpeed: number;
}

export class StationRenderer {
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private stars: StarPoint[];

  constructor() {
    this.lightCanvas = document.createElement('canvas');
    const ctx = this.lightCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2D lighting context');
    }
    this.lightCtx = ctx;

    this.stars = Array.from({ length: 110 }, (_, i) => ({
      x: ((i * 197.3) % 1000) / 1000,
      y: ((i * 353.7) % 1000) / 1000,
      r: 0.7 + (i % 3) * 0.55,
      alpha: 0.35 + ((i * 29) % 60) / 100,
      twinkleSpeed: 1 + (i % 5) * 0.6,
    }));
  }

  public render(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    camX: number,
    camY: number,
    time: number,
    world: StationWorldData,
    player: PlayerState,
    particles: Particle[],
    projectiles: ProjectileEntity[],
    activeBeacons: EchoBeaconEntity[],
    powerRestored: boolean,
    nearby: NearbyInteractable | null,
    showPlayer: boolean
  ): void {
    // 1. Deep Space Background
    ctx.fillStyle = '#03060d';
    ctx.fillRect(0, 0, viewportW, viewportH);

    // Subtle deep space starfield visible behind void & windows
    this.drawStarfield(ctx, viewportW, viewportH, camX, camY, time);

    ctx.save();
    ctx.translate(-Math.round(camX), -Math.round(camY));

    // Exterior orbital station hull trusses, solar fins & planetary glow
    this.drawStationExterior(ctx, camX, camY, viewportW, viewportH, time);

    // Dangerous Orbital Asteroid & Debris Field outside station hull
    this.drawAsteroids(ctx, world, camX, camY, viewportW, viewportH, time);

    // Determine visible tile bounds
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol = Math.min(
      MAP_COLS - 1,
      Math.ceil((camX + viewportW) / TILE_SIZE) + 1
    );
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endRow = Math.min(
      MAP_ROWS - 1,
      Math.ceil((camY + viewportH) / TILE_SIZE) + 1
    );

    // 2. Floor Tiles & Space / Unexplored Planet Viewports
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = world.grid[r][c];
        if (tile === TileType.VOID || tile === TileType.WALL) continue;
        this.drawFloorTile(ctx, c, r, tile, time, world.grid);
      }
    }

    // 2b. Glowing Blue Energy Pipes along station floors
    this.drawEnergyPipes(ctx, world.energyPipes, time, powerRestored);

    // 3. Props (floor-level & machinery)
    for (const prop of world.props) {
      if (
        prop.x + prop.w < camX - 80 ||
        prop.x > camX + viewportW + 80 ||
        prop.y + prop.h < camY - 80 ||
        prop.y > camY + viewportH + 80
      ) {
        continue;
      }
      this.drawProp(ctx, prop, time, powerRestored);
    }

    // 4. Terminals
    for (const term of world.terminals) {
      const tx = term.tileX * TILE_SIZE;
      const ty = term.tileY * TILE_SIZE;
      if (
        tx < camX - 80 ||
        tx > camX + viewportW + 80 ||
        ty < camY - 80 ||
        ty > camY + viewportH + 80
      ) {
        continue;
      }
      this.drawTerminal(ctx, term, time, powerRestored);
    }

    // 5. Keycard, Echo Beacon & Battery Cell Pickups
    for (const pickup of world.pickups) {
      if (pickup.collected) continue;
      this.drawPickup(ctx, pickup, time);
    }

    // 5b. Suit Recharge Stations & Dangerous Floor Hazards
    for (const station of world.suitStations) {
      this.drawSuitStation(ctx, station, time);
    }
    for (const hazard of world.hazards) {
      this.drawHazard(ctx, hazard, time, powerRestored);
    }

    // 5c. Active Echo Beacon Sound Decoys
    this.drawEchoBeacons(ctx, activeBeacons, time);

    // 6. Doors
    for (const door of world.doors) {
      this.drawDoor(ctx, door, time, powerRestored);
    }

    // 6b. Hostile Monsters, THE LISTENER & Projectiles
    if (world.listener.active) {
      this.drawListener(ctx, world.listener, time);
    }
    for (const monster of world.monsters) {
      if (!monster.active || !monster.alive) continue;
      this.drawMonster(ctx, monster, time);
    }
    for (const proj of projectiles) {
      this.drawProjectile(ctx, proj);
    }

    // 7. Player Character
    if (showPlayer) {
      this.drawPlayer(ctx, player);
    }

    // 8. Wall Tiles (drawn over floor edges for crisp 2.5D bevel & shadow)
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (world.grid[r][c] === TileType.WALL) {
          this.drawWallTile(ctx, world.grid, c, r);
        }
      }
    }

    // 9. Atmospheric Particles (dust motes, cryo mist, reactor sparks, smoke)
    for (const p of particles) {
      if (
        p.x < camX - 30 ||
        p.x > camX + viewportW + 30 ||
        p.y < camY - 30 ||
        p.y > camY + viewportH + 30
      ) {
        continue;
      }
      const fade = 1 - p.life / p.maxLife;
      ctx.globalAlpha = p.alpha * fade;
      if (p.kind === 'SPARK') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.2, p.size * 0.8);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // 10. Dynamic Darkness + Raycast Flashlight + Colored Emergency Lights
    this.renderLighting(
      ctx,
      viewportW,
      viewportH,
      camX,
      camY,
      time,
      world,
      player,
      activeBeacons,
      powerRestored,
      showPlayer
    );

    // 11. World-space Interaction Tag & Echo Decoy Label (drawn above darkness)
    if (showPlayer) {
      ctx.save();
      ctx.translate(-Math.round(camX), -Math.round(camY));
      if (nearby) {
        this.drawWorldPrompt(ctx, world, nearby);
      }
      for (const beacon of activeBeacons) {
        this.drawBeaconWorldLabel(ctx, beacon, time);
      }
      ctx.restore();
    }
  }

  private drawStarfield(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camX: number,
    camY: number,
    time: number
  ): void {
    for (const s of this.stars) {
      const px = ((s.x * 1800 - camX * 0.08) % w + w) % w;
      const py = ((s.y * 1200 - camY * 0.08) % h + h) % h;
      const twinkle = 0.65 + 0.35 * Math.sin(time * s.twinkleSpeed + s.x * 12);
      ctx.fillStyle = `rgba(186, 230, 253, ${(s.alpha * twinkle).toFixed(2)})`;
      ctx.fillRect(px, py, s.r * 1.4, s.r * 1.4);
    }
  }

  private drawStationExterior(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    viewportW: number,
    viewportH: number,
    time: number
  ): void {
    const hullX = 4 * TILE_SIZE;
    const hullY = 3 * TILE_SIZE;
    const hullW = (MAP_COLS - 8) * TILE_SIZE;
    const hullH = (MAP_ROWS - 6) * TILE_SIZE;

    // Distant exoplanet horizon glow beyond north Command Deck
    const planetGlow = ctx.createRadialGradient(
      32 * TILE_SIZE,
      -4 * TILE_SIZE,
      80,
      32 * TILE_SIZE,
      -4 * TILE_SIZE,
      900
    );
    planetGlow.addColorStop(0, 'rgba(34, 211, 238, 0.20)');
    planetGlow.addColorStop(0.45, 'rgba(14, 116, 144, 0.10)');
    planetGlow.addColorStop(1, 'rgba(3, 6, 13, 0)');
    ctx.fillStyle = planetGlow;
    ctx.fillRect(camX, camY, viewportW, viewportH);

    // Outer orbital solar array wings (West & East flanks)
    const wingPulse = 0.7 + 0.3 * Math.sin(time * 1.8);
    const drawSolarWing = (wx: number, wy: number, w: number, h: number) => {
      ctx.fillStyle = '#071326';
      ctx.fillRect(wx, wy, w, h);
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, w, h);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.lineWidth = 1;
      for (let sx = wx + 24; sx < wx + w; sx += 24) {
        ctx.beginPath();
        ctx.moveTo(sx, wy);
        ctx.lineTo(sx, wy + h);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(34, 211, 238, ${(0.35 * wingPulse).toFixed(2)})`;
      ctx.fillRect(wx, wy + h * 0.5 - 2, w, 4);
    };

    drawSolarWing(hullX - 240, hullY + hullH * 0.25, 220, 120);
    drawSolarWing(hullX - 240, hullY + hullH * 0.62, 220, 120);
    drawSolarWing(hullX + hullW + 20, hullY + hullH * 0.25, 220, 120);
    drawSolarWing(hullX + hullW + 20, hullY + hullH * 0.62, 220, 120);

    // Armored exterior hull spine & structural docking trusses
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(hullX - 18, hullY - 18, hullW + 36, hullH + 36);

    // Exterior warning / docking navigation strobes on hull corners
    const strobe = 0.4 + 0.6 * Math.abs(Math.sin(time * 2.6));
    const beacons = [
      [hullX - 18, hullY - 18],
      [hullX + hullW + 18, hullY - 18],
      [hullX - 18, hullY + hullH + 18],
      [hullX + hullW + 18, hullY + hullH + 18],
    ];
    for (const [bx, by] of beacons) {
      ctx.fillStyle = `rgba(56, 189, 248, ${(0.75 * strobe).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFloorTile(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    tile: TileType,
    time: number,
    grid: TileType[][]
  ): void {
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    if (tile === TileType.WINDOW_SPACE) {
      // Armored viewport
      ctx.fillStyle = '#030712';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      if (row <= 3) {
        // Command Deck North Panoramic Observation Window: Unexplored Alien Planet
        const planetCx = 32 * TILE_SIZE;
        const planetCy = 1.65 * TILE_SIZE;
        const dx = x + TILE_SIZE * 0.5 - planetCx;
        const dy = y + TILE_SIZE * 0.5 - planetCy;
        const dist = Math.hypot(dx, dy);

        const atmo = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
        atmo.addColorStop(0, '#041226');
        atmo.addColorStop(1, '#082036');
        ctx.fillStyle = atmo;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        if (dist < 420) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.clip();

          // Unexplored exoplanet body + cyan-violet atmospheric rim
          const pGrad = ctx.createRadialGradient(
            planetCx - 90,
            planetCy - 40,
            40,
            planetCx,
            planetCy,
            390
          );
          pGrad.addColorStop(0, '#134e4a');
          pGrad.addColorStop(0.55, '#0f2942');
          pGrad.addColorStop(0.88, '#1e1b4b');
          pGrad.addColorStop(1, 'rgba(34, 211, 238, 0.45)');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(planetCx, planetCy, 380, 0, Math.PI * 2);
          ctx.fill();

          // Swirling cloud bands
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(planetCx, planetCy, 330, 0.15, 2.95);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(167, 139, 250, 0.14)';
          ctx.beginPath();
          ctx.arc(planetCx, planetCy, 285, 0.25, 2.85);
          ctx.stroke();

          ctx.restore();
        }
      } else if (col >= 28 && col <= 35) {
        // Arrival Bay South Observation Window: Deep space & nebula haze
        const grad = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
        grad.addColorStop(0, 'rgba(14, 165, 233, 0.18)');
        grad.addColorStop(1, 'rgba(3, 7, 18, 0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }

      // Subtle twinkling stars inside viewport
      const starPulse = 0.5 + 0.5 * Math.sin(time * 2 + col * 1.7 + row);
      ctx.fillStyle = `rgba(224, 242, 254, ${(0.5 * starPulse).toFixed(2)})`;
      ctx.fillRect(x + ((col * 17) % 36) + 6, y + ((col * 29) % 24) + 6, 2, 2);
      ctx.fillRect(x + ((col * 11) % 30) + 12, y + ((col * 7) % 28) + 10, 1.5, 1.5);

      // Viewport metallic mullions & glass reflection
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, 6);
      return;
    }

    if (tile === TileType.FLOOR_METAL) {
      const checker = (col + row) % 2 === 0;
      ctx.fillStyle = checker ? '#0e1729' : '#111c32';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      // Subtle polished overhead light panel reflection on alternating deck plates
      if (checker) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.045)';
        ctx.fillRect(x + 12, y + 8, TILE_SIZE - 24, TILE_SIZE - 16);
      }

      // Brushed plate seam
      ctx.strokeStyle = 'rgba(38, 60, 96, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      // Corner rivets
      ctx.fillStyle = 'rgba(100, 116, 139, 0.42)';
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + TILE_SIZE - 6, y + 4, 2, 2);
      ctx.fillRect(x + 4, y + TILE_SIZE - 6, 2, 2);
      ctx.fillRect(x + TILE_SIZE - 6, y + TILE_SIZE - 6, 2, 2);

      this.drawWallAdjacentNeonStrips(ctx, x, y, col, row, grid);
      return;
    }

    if (tile === TileType.FLOOR_GRATE) {
      ctx.fillStyle = '#060c18';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      // Sub-deck glowing blue plasma conduit glow beneath grate
      const underGlow = 0.2 + 0.1 * Math.sin(time * 2.5 + col + row);
      ctx.fillStyle = `rgba(34, 211, 238, ${underGlow.toFixed(2)})`;
      ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      // Industrial metallic grate slats
      ctx.fillStyle = '#16233b';
      for (let gx = 4; gx < TILE_SIZE - 4; gx += 8) {
        ctx.fillRect(x + gx, y + 3, 4, TILE_SIZE - 6);
      }
      ctx.strokeStyle = '#243657';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      this.drawWallAdjacentNeonStrips(ctx, x, y, col, row, grid);
      return;
    }

    if (tile === TileType.FLOOR_HAZARD) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.clip();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)';
      ctx.lineWidth = 6;
      for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 16) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + TILE_SIZE, y + TILE_SIZE);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      this.drawWallAdjacentNeonStrips(ctx, x, y, col, row, grid);
    }
  }

  private drawWallAdjacentNeonStrips(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    col: number,
    row: number,
    grid: TileType[][]
  ): void {
    const wallN = row > 0 && grid[row - 1][col] === TileType.WALL;
    const wallS = row + 1 < MAP_ROWS && grid[row + 1][col] === TileType.WALL;
    const wallW = col > 0 && grid[row][col - 1] === TileType.WALL;
    const wallE = col + 1 < MAP_COLS && grid[row][col + 1] === TileType.WALL;

    if (!wallN && !wallS && !wallW && !wallE) return;

    // Soft cyan reflection wash + crisp glowing guide strip along wall edges
    ctx.fillStyle = 'rgba(34, 211, 238, 0.10)';
    if (wallN) ctx.fillRect(x, y, TILE_SIZE, 9);
    if (wallS) ctx.fillRect(x, y + TILE_SIZE - 9, TILE_SIZE, 9);
    if (wallW) ctx.fillRect(x, y, 9, TILE_SIZE);
    if (wallE) ctx.fillRect(x + TILE_SIZE - 9, y, 9, TILE_SIZE);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.62)';
    if (wallN) ctx.fillRect(x, y + 2.5, TILE_SIZE, 2);
    if (wallS) ctx.fillRect(x, y + TILE_SIZE - 4.5, TILE_SIZE, 2);
    if (wallW) ctx.fillRect(x + 2.5, y, 2, TILE_SIZE);
    if (wallE) ctx.fillRect(x + TILE_SIZE - 4.5, y, 2, TILE_SIZE);
  }

  private drawWallTile(
    ctx: CanvasRenderingContext2D,
    grid: TileType[][],
    col: number,
    row: number
  ): void {
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    const southIsFloor =
      row + 1 < MAP_ROWS &&
      grid[row + 1][col] !== TileType.WALL &&
      grid[row + 1][col] !== TileType.VOID;

    // Drop shadow onto south floor
    if (southIsFloor) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x, y + TILE_SIZE, TILE_SIZE, 10);
    }

    // Wall bulkhead base
    ctx.fillStyle = '#172236';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Inner recessed armor panel
    ctx.fillStyle = '#0e1626';
    ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // Metallic bevel highlight on exposed edges
    ctx.fillStyle = '#293b5c';
    if (row > 0 && grid[row - 1][col] !== TileType.WALL) {
      ctx.fillRect(x, y, TILE_SIZE, 3);
    }
    if (col > 0 && grid[row][col - 1] !== TileType.WALL) {
      ctx.fillRect(x, y, 3, TILE_SIZE);
    }
    if (col + 1 < MAP_COLS && grid[row][col + 1] !== TileType.WALL) {
      ctx.fillStyle = '#1e2d47';
      ctx.fillRect(x + TILE_SIZE - 3, y, 3, TILE_SIZE);
    }
    if (southIsFloor) {
      ctx.fillStyle = '#243554';
      ctx.fillRect(x, y + TILE_SIZE - 5, TILE_SIZE, 5);
      // Subtle cyan/slate trim line
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(x + 6, y + TILE_SIZE - 3, TILE_SIZE - 12, 1.5);
    }
  }

  private drawProp(
    ctx: CanvasRenderingContext2D,
    prop: PropEntity,
    time: number,
    powerRestored: boolean
  ): void {
    const { x, y, w, h, kind } = prop;
    // Contact shadow + subtle cyan floor light reflection halo for high-tech units
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 4, y + 5, w, h);
    if (
      kind === 'BIO_TANK' ||
      kind === 'GLASS_CONTAINER' ||
      kind === 'HOLO_TABLE' ||
      kind === 'REACTOR_CORE' ||
      kind === 'LAB_WORKSTATION' ||
      kind === 'BRIDGE_CONSOLE'
    ) {
      const halo = ctx.createRadialGradient(
        x + w * 0.5,
        y + h * 0.5,
        4,
        x + w * 0.5,
        y + h * 0.5,
        Math.max(w, h) * 0.85
      );
      halo.addColorStop(
        0,
        kind === 'REACTOR_CORE' && !powerRestored
          ? 'rgba(239, 68, 68, 0.18)'
          : 'rgba(34, 211, 238, 0.16)'
      );
      halo.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    if (kind === 'RESCUE_POD') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 18);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Cockpit canopy
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(x + 24, y + 14, w - 48, 34, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(x + 30, y + 18, w - 60, 12);
      // Twin thruster vents
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(34, 211, 238, ${(0.45 + 0.35 * pulse).toFixed(2)})`;
      ctx.fillRect(x + 28, y + h - 10, 26, 6);
      ctx.fillRect(x + w - 54, y + h - 10, 26, 6);
      return;
    }

    if (kind === 'CRATE') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + w - 6, y + h - 6);
      ctx.moveTo(x + w - 6, y + 6);
      ctx.lineTo(x + 6, y + h - 6);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x + 6, y + 4, 10, 3);
      return;
    }

    if (kind === 'DESK' || kind === 'BRIDGE_CONSOLE') {
      ctx.fillStyle = '#192438';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Illuminated console screens
      const accent = prop.accentColor || '#22d3ee';
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(x + 10, y + 8, 32, h - 16);
      ctx.fillRect(x + w - 42, y + 8, 32, h - 16);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(x + 13, y + 11, 26, 4);
      ctx.fillRect(x + w - 39, y + 11, 26, 4);
      ctx.globalAlpha = 1;
      return;
    }

    if (kind === 'BIO_TANK') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.fillStyle = '#162033';
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.stroke();

      const pulse = 0.7 + 0.3 * Math.sin(time * 2.5 + x);
      ctx.fillStyle = `rgba(6, 182, 212, ${(0.35 * pulse).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2 - 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = prop.accentColor || '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2 - 7, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (kind === 'CRYO_POD') {
      ctx.fillStyle = '#1a263a';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Frosted glass chamber
      ctx.fillStyle = '#0c192c';
      ctx.beginPath();
      ctx.roundRect(x + 7, y + 10, w - 14, h - 20, 6);
      ctx.fill();
      const accent = prop.accentColor || '#38bdf8';
      ctx.fillStyle = accent;
      ctx.globalAlpha = accent === '#ef4444' ? 0.3 + 0.4 * Math.abs(Math.sin(time * 5)) : 0.35;
      ctx.beginPath();
      ctx.roundRect(x + 11, y + 14, w - 22, h - 28, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    if (kind === 'SERVER_RACK') {
      ctx.fillStyle = '#141d2e';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#2a3a58';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      for (let sy = y + 10; sy < y + h - 10; sy += 14) {
        ctx.fillStyle = '#090e18';
        ctx.fillRect(x + 6, sy, w - 12, 8);
        const blink = Math.sin(time * 4 + sy) > 0;
        ctx.fillStyle = blink ? '#22d3ee' : '#ef4444';
        ctx.fillRect(x + 9, sy + 2.5, 4, 3);
      }
      return;
    }

    if (kind === 'REACTOR_CORE') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const coreColor = powerRestored ? '#22d3ee' : '#ef4444';
      const pulse = 0.65 + 0.35 * Math.sin(time * (powerRestored ? 3.5 : 5));

      ctx.fillStyle = '#111a2b';
      ctx.beginPath();
      ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Rotating containment spokes
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * (powerRestored ? 0.8 : 0.25));
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(w / 2 - 8, 0);
        ctx.stroke();
      }
      ctx.restore();

      // Inner plasma ring
      ctx.fillStyle = coreColor;
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    if (kind === 'HOLO_TABLE') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.fillStyle = '#172338';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rotating wireframe holographic station ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.5);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (kind === 'DAMAGED_PANEL') {
      ctx.fillStyle = '#171f2e';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Exposed wiring & flickering fault diode
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h - 4);
      ctx.lineTo(x + 15, y + 6);
      ctx.lineTo(x + 22, y + h - 5);
      ctx.stroke();
      const fault = Math.sin(time * 14 + x) > 0;
      ctx.fillStyle = fault ? '#ef4444' : '#f59e0b';
      ctx.fillRect(x + w - 12, y + 6, 6, 4);
      return;
    }

    if (kind === 'EQUIPMENT_CASE') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = prop.accentColor || '#f59e0b';
      ctx.fillRect(x + 8, y + 4, 8, 3);
      ctx.fillRect(x + w - 16, y + 4, 8, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + 6, y + h * 0.42, w - 12, 4);
      return;
    }

    if (kind === 'LAB_WORKSTATION') {
      ctx.fillStyle = '#142033';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Twin holo screens & glassware
      ctx.fillStyle = '#09111f';
      ctx.fillRect(x + 8, y + 5, 30, 14);
      ctx.fillRect(x + w - 38, y + 5, 30, 14);
      const glow = 0.65 + 0.35 * Math.sin(time * 3 + x);
      ctx.fillStyle = `rgba(34, 211, 238, ${glow.toFixed(2)})`;
      ctx.fillRect(x + 11, y + 8, 22, 3);
      ctx.fillRect(x + 11, y + 13, 14, 2);
      ctx.fillRect(x + w - 35, y + 8, 20, 3);
      return;
    }

    if (kind === 'GLASS_CONTAINER') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.fillStyle = '#101d30';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      const pulse = 0.55 + 0.45 * Math.sin(time * 3.2 + y);
      ctx.fillStyle = `rgba(56, 189, 248, ${(0.35 * pulse).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a5f3fc';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (kind === 'DAMAGED_GENERATOR') {
      ctx.fillStyle = '#1a2234';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = prop.accentColor || '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      // Exposed turbine coils
      ctx.fillStyle = '#0b101b';
      ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
      const spark = Math.sin(time * 16 + x) > 0.2;
      ctx.fillStyle = spark ? '#f59e0b' : '#38bdf8';
      ctx.fillRect(x + 14, y + h * 0.42, w - 28, 5);
      return;
    }

    if (kind === 'CONTAINMENT_CHAMBER') {
      ctx.save();
      ctx.fillStyle = 'rgba(127, 29, 29, 0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      // Shattered glass shards near breached front edge
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.beginPath();
      ctx.moveTo(x + 16, y + h - 8);
      ctx.lineTo(x + 26, y + h - 2);
      ctx.lineTo(x + 20, y + h + 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w - 28, y + h - 6);
      ctx.lineTo(x + w - 16, y + h + 4);
      ctx.lineTo(x + w - 34, y + h + 5);
      ctx.fill();
      // Chamber corner caution beacons
      const strobe = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.fillStyle = `rgba(239, 68, 68, ${strobe.toFixed(2)})`;
      ctx.fillRect(x - 3, y - 3, 7, 7);
      ctx.fillRect(x + w - 4, y - 3, 7, 7);
      ctx.fillRect(x - 3, y + h - 4, 7, 7);
      ctx.fillRect(x + w - 4, y + h - 4, 7, 7);
      ctx.restore();
      return;
    }

    if (kind === 'WARNING_SIGN') {
      const flicker = Math.sin(time * 9 + x) > -0.6 ? 0.85 : 0.25;
      ctx.save();
      ctx.globalAlpha = flicker;
      ctx.fillStyle = 'rgba(127, 29, 29, 0.65)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#fecaca';
      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prop.label || 'DANGER', x + w / 2, y + h / 2);
      ctx.restore();
      return;
    }

    if (kind === 'BROKEN_CAMERA') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx + 2, cy + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      // Loose red cable
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 8, cy + 10);
      ctx.stroke();
      return;
    }

    if (kind === 'ALIEN_TRACE') {
      ctx.save();
      const pulse = 0.45 + 0.3 * Math.sin(time * 2.4 + x);
      ctx.strokeStyle = `rgba(192, 132, 252, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 2.2;
      // 3 jagged claw slash marks + glowing organic residue
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 8 + i * 9, y + 10);
        ctx.lineTo(x + w - 10 + i * 7, y + h - 10);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(168, 85, 247, ${(0.22 * pulse).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEnergyPipes(
    ctx: CanvasRenderingContext2D,
    pipes: EnergyPipeEntity[],
    time: number,
    powerRestored: boolean
  ): void {
    for (const pipe of pipes) {
      if (pipe.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Outer metallic pipe housing
      ctx.strokeStyle = '#182438';
      ctx.lineWidth = 10;
      ctx.beginPath();
      pipe.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Inner glowing energy plasma core
      const baseAlpha = powerRestored ? 0.78 : 0.36;
      const pulse = 0.75 + 0.25 * Math.sin(time * (powerRestored ? 5 : 2));
      ctx.strokeStyle = this.hexToRgba(pipe.color, baseAlpha * pulse);
      ctx.lineWidth = 4;
      ctx.stroke();

      // Flowing energy packet dashes
      ctx.strokeStyle = powerRestored ? '#a5f3fc' : '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([10, 18]);
      ctx.lineDashOffset = -time * (powerRestored ? 72 : 28);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  private drawTerminal(
    ctx: CanvasRenderingContext2D,
    term: TerminalEntity,
    time: number,
    powerRestored: boolean
  ): void {
    const cx = term.tileX * TILE_SIZE;
    const cy = term.tileY * TILE_SIZE;

    // Terminal pedestal
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(cx - 18, cy - 12, 36, 28);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 18, cy - 15, 36, 28);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 18, cy - 15, 36, 28);

    // Screen color
    let screenColor = '#22d3ee';
    if (term.actionType === 'RESTORE_POWER' && !powerRestored) {
      screenColor = '#f59e0b';
    } else if (term.actionType === 'SOLVE_FREQUENCY' && !term.activated) {
      screenColor = '#38bdf8';
    } else if (term.actionType === 'ACTIVATE_SIGNAL' && term.activated) {
      screenColor = '#34d399';
    } else if (term.kind === 'AUDIO_LOG') {
      screenColor = '#2dd4bf';
    }

    const flicker = 0.8 + 0.2 * Math.sin(time * 6 + cx);
    ctx.fillStyle = screenColor;
    ctx.globalAlpha = flicker;
    ctx.fillRect(cx - 12, cy - 10, 24, 14);
    ctx.globalAlpha = 1;

    // Mini scanlines on terminal
    ctx.fillStyle = '#09111f';
    ctx.fillRect(cx - 10, cy - 6, 18, 2);
    ctx.fillRect(cx - 10, cy - 2, 12, 2);
  }

  private drawPickup(
    ctx: CanvasRenderingContext2D,
    pickup: PickupEntity,
    time: number
  ): void {
    const cx = pickup.tileX * TILE_SIZE;
    const cy = pickup.tileY * TILE_SIZE + Math.sin(time * 3) * 2.5;

    // Outer rotating beacon ring
    const ringPulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.strokeStyle = pickup.color;
    ctx.globalAlpha = 0.28 + 0.35 * ringPulse;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, pickup.tileY * TILE_SIZE, 15 + ringPulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (pickup.kind === 'BEACON_PACK') {
      // Echo Beacon Cylinder Pack
      ctx.fillStyle = '#0b1829';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pickup.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = pickup.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (pickup.kind === 'BATTERY_CELL') {
      // Suit Battery Energy Cell
      ctx.fillStyle = '#0b1c22';
      ctx.beginPath();
      ctx.roundRect(cx - 8, cy - 10, 16, 20, 3);
      ctx.fill();
      ctx.strokeStyle = pickup.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = pickup.color;
      ctx.fillRect(cx - 3, cy - 13, 6, 3);
      ctx.fillRect(cx - 5, cy - 5, 10, 10);
      return;
    }

    // Keycard body
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(cx - 11, cy - 7, 22, 14, 3);
    ctx.fill();
    ctx.strokeStyle = pickup.color;
    ctx.lineWidth = 1.75;
    ctx.stroke();

    // Magnetic stripe & chip
    ctx.fillStyle = pickup.color;
    ctx.fillRect(cx - 7, cy - 3, 6, 6);
    ctx.fillRect(cx + 1, cy - 2, 6, 1.5);
    ctx.fillRect(cx + 1, cy + 1.5, 4, 1.5);
  }

  private drawEchoBeacons(
    ctx: CanvasRenderingContext2D,
    beacons: EchoBeaconEntity[],
    time: number
  ): void {
    for (const b of beacons) {
      const fade = Math.max(0.2, b.life / b.maxLife);
      // Expanding sonic rings
      for (let i = 0; i < 3; i++) {
        const phase = ((time * 1.4 + i * 0.33) % 1);
        const r = 10 + phase * 115;
        ctx.strokeStyle = `rgba(34, 211, 238, ${((1 - phase) * 0.65 * fade).toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Beacon core puck
      ctx.fillStyle = '#082f49';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#a5f3fc';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBeaconWorldLabel(
    ctx: CanvasRenderingContext2D,
    b: EchoBeaconEntity,
    time: number
  ): void {
    const pulse = 0.75 + 0.25 * Math.sin(time * 8);
    ctx.save();
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(103, 232, 249, ${pulse.toFixed(2)})`;
    ctx.fillText(`ECHO DECOY ${b.life.toFixed(1)}s`, b.x, b.y - 16);
    ctx.restore();
  }

  private drawListener(
    ctx: CanvasRenderingContext2D,
    l: ListenerEntity,
    time: number
  ): void {
    ctx.save();
    ctx.translate(l.x, l.y);

    const stateColor =
      l.state === 'HUNTING'
        ? '#ef4444'
        : l.state === 'INVESTIGATING' || l.state === 'SEARCHING'
          ? '#f59e0b'
          : l.state === 'STAGGERED'
            ? '#64748b'
            : '#c084fc';

    const pulse = 0.65 + 0.35 * Math.sin(time * (l.state === 'HUNTING' ? 9 : 4));

    // Acoustic perception aura ring
    ctx.strokeStyle = this.hexToRgba(stateColor, 0.65 * pulse);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, l.radius + 7 + (l.state === 'HUNTING' ? pulse * 5 : 0), 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(l.angle);

    // Bioluminescent acoustic tendrils
    ctx.strokeStyle = stateColor;
    ctx.lineWidth = 2.2;
    for (let i = -2; i <= 2; i++) {
      const sway = Math.sin(time * 6 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(-l.radius * 0.4, i * 4);
      ctx.quadraticCurveTo(-l.radius * 0.95, i * 6 + sway, -l.radius - 10, i * 7 + sway);
      ctx.stroke();
    }

    // Elongated acoustic chitin carapace
    ctx.fillStyle = l.state === 'STAGGERED' ? '#1e293b' : '#241438';
    ctx.beginPath();
    ctx.ellipse(2, 0, l.radius * 1.15, l.radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = stateColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing cranial acoustic crest (blind hunter sonar organ)
    ctx.fillStyle = stateColor;
    ctx.beginPath();
    ctx.arc(l.radius * 0.55, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();

    if (l.hitFlash > 0.05) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(l.hitFlash * 0.65).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, l.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // State indicator glyph above THE LISTENER
    if (l.state !== 'PATROL') {
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = stateColor;
      const badge =
        l.state === 'HUNTING'
          ? '!'
          : l.state === 'STAGGERED'
            ? 'STUN'
            : '?';
      ctx.fillText(badge, 0, -l.radius - 16);
    }

    // Overhead HP bar when damaged
    if (l.hp < l.maxHp || l.state === 'STAGGERED') {
      const bw = 34;
      const bh = 4;
      const ratio = Math.max(0, Math.min(1, l.hp / l.maxHp));
      ctx.fillStyle = 'rgba(2, 6, 16, 0.85)';
      ctx.fillRect(-bw / 2 - 1, -l.radius - 11, bw + 2, bh + 2);
      ctx.fillStyle = stateColor;
      ctx.fillRect(-bw / 2, -l.radius - 10, bw * ratio, bh);
    }

    ctx.restore();
  }

  private drawDoor(
    ctx: CanvasRenderingContext2D,
    door: DoorEntity,
    time: number,
    powerRestored: boolean
  ): void {
    const x = door.tileX * TILE_SIZE;
    const y = door.tileY * TILE_SIZE;
    const w = door.tilesW * TILE_SIZE;
    const h = door.tilesH * TILE_SIZE;

    // Door frame tracks
    ctx.fillStyle = '#090e1a';
    ctx.fillRect(x, y, w, h);

    const statusColor = door.locked
      ? '#ef4444'
      : door.isOpen
        ? '#22d3ee'
        : '#f59e0b';
    const pulse = 0.65 + 0.35 * Math.sin(time * 4);

    if (door.orientation === 'horizontal') {
      const leafW = (w / 2) * (1 - door.openProgress * 0.88);
      // Left sliding titanium & glass leaf
      ctx.fillStyle = '#1b2840';
      ctx.fillRect(x, y + 8, leafW, h - 16);
      if (leafW > 12) {
        ctx.fillStyle = door.locked
          ? 'rgba(153, 27, 27, 0.48)'
          : 'rgba(14, 116, 144, 0.46)';
        ctx.fillRect(x + 4, y + 13, leafW - 8, h - 26);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.25;
      ctx.strokeRect(x + 0.5, y + 8.5, Math.max(0, leafW - 1), h - 17);
      // Right sliding titanium & glass leaf
      ctx.fillStyle = '#1b2840';
      ctx.fillRect(x + w - leafW, y + 8, leafW, h - 16);
      if (leafW > 12) {
        ctx.fillStyle = door.locked
          ? 'rgba(153, 27, 27, 0.48)'
          : 'rgba(14, 116, 144, 0.46)';
        ctx.fillRect(x + w - leafW + 4, y + 13, leafW - 8, h - 26);
      }
      ctx.strokeRect(
        x + w - leafW + 0.5,
        y + 8.5,
        Math.max(0, leafW - 1),
        h - 17
      );
      // LED strip
      ctx.fillStyle = statusColor;
      ctx.globalAlpha = pulse;
      if (leafW > 6) {
        ctx.fillRect(x + 4, y + h / 2 - 1.5, leafW - 8, 3);
        ctx.fillRect(x + w - leafW + 4, y + h / 2 - 1.5, leafW - 8, 3);
      }
      ctx.globalAlpha = 1;
    } else {
      const leafH = (h / 2) * (1 - door.openProgress * 0.88);
      // Top sliding titanium & glass leaf
      ctx.fillStyle = '#1b2840';
      ctx.fillRect(x + 8, y, w - 16, leafH);
      if (leafH > 12) {
        ctx.fillStyle = door.locked
          ? 'rgba(153, 27, 27, 0.48)'
          : 'rgba(14, 116, 144, 0.46)';
        ctx.fillRect(x + 13, y + 4, w - 26, leafH - 8);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.25;
      ctx.strokeRect(x + 8.5, y + 0.5, w - 17, Math.max(0, leafH - 1));
      // Bottom sliding titanium & glass leaf
      ctx.fillStyle = '#1b2840';
      ctx.fillRect(x + 8, y + h - leafH, w - 16, leafH);
      if (leafH > 12) {
        ctx.fillStyle = door.locked
          ? 'rgba(153, 27, 27, 0.48)'
          : 'rgba(14, 116, 144, 0.46)';
        ctx.fillRect(x + 13, y + h - leafH + 4, w - 26, leafH - 8);
      }
      ctx.strokeRect(
        x + 8.5,
        y + h - leafH + 0.5,
        w - 17,
        Math.max(0, leafH - 1)
      );
      // LED strip
      ctx.fillStyle = statusColor;
      ctx.globalAlpha = pulse;
      if (leafH > 6) {
        ctx.fillRect(x + w / 2 - 1.5, y + 4, 3, leafH - 8);
        ctx.fillRect(x + w / 2 - 1.5, y + h - leafH + 4, 3, leafH - 8);
      }
      ctx.globalAlpha = 1;
    }

    // Extra visual lock beacon on Command Door if power offline
    if (door.requiresPower && !powerRestored) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + w / 2 - 3, y + h / 2 - 3, 6, 6);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState): void {
    const bob = Math.sin(player.walkCycle) * 1.6;
    const stride = Math.sin(player.walkCycle) * 3.5;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Subtle shadow under character
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-1, 2, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Boots / stride indicator
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-3 + stride, -9, 8, 5);
    ctx.fillRect(-3 - stride, 4, 8, 5);

    // Oxygen pack behind shoulders
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(-14, -8, 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-13, -3, 2, 6);

    // Rescue armor shoulders & torso
    ctx.fillStyle = '#25354d';
    ctx.beginPath();
    ctx.roundRect(-7, -12, 14, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Right arm extending MK-IV Mining Laser Cutter
    ctx.fillStyle = '#334155';
    ctx.fillRect(2, 6 + bob * 0.3, 10, 5);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(10, 6.2 + bob * 0.3, 6, 4.6);
    ctx.fillStyle = player.laserOverheated ? '#ef4444' : '#22d3ee';
    ctx.fillRect(15, 7 + bob * 0.3, 3, 3);

    // Helmet
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(1, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Glowing cyan rescue visor
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(3.5, 0, 6.2, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.fill();

    ctx.restore();
  }

  private renderLighting(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    camX: number,
    camY: number,
    time: number,
    world: StationWorldData,
    player: PlayerState,
    activeBeacons: EchoBeaconEntity[],
    powerRestored: boolean,
    showPlayer: boolean
  ): void {
    if (
      this.lightCanvas.width !== viewportW ||
      this.lightCanvas.height !== viewportH
    ) {
      this.lightCanvas.width = viewportW;
      this.lightCanvas.height = viewportH;
    }

    const lctx = this.lightCtx;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, viewportW, viewportH);

    // Deep dark navy ambient darkness calibrated so architectural details & neon strips read clearly
    lctx.fillStyle = showPlayer
      ? 'rgba(3, 7, 16, 0.72)'
      : 'rgba(3, 7, 16, 0.56)';
    lctx.fillRect(0, 0, viewportW, viewportH);

    lctx.globalCompositeOperation = 'destination-out';

    // Carve out atmospheric room lights
    for (const light of world.lights) {
      const sx = light.x - camX;
      const sy = light.y - camY;
      if (
        sx < -light.radius ||
        sx > viewportW + light.radius ||
        sy < -light.radius ||
        sy > viewportH + light.radius
      ) {
        continue;
      }
      const mod = this.computeLightModulation(light, time);
      const r = light.radius * (0.92 + 0.08 * mod);
      const grad = lctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(
        0,
        `rgba(255, 255, 255, ${(light.intensity * mod).toFixed(2)})`
      );
      grad.addColorStop(0.55, `rgba(255, 255, 255, ${(light.intensity * 0.35 * mod).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.arc(sx, sy, r, 0, Math.PI * 2);
      lctx.fill();
    }

    // Carve out active Echo Beacons
    for (const beacon of activeBeacons) {
      const bx = beacon.x - camX;
      const by = beacon.y - camY;
      const bGrad = lctx.createRadialGradient(bx, by, 8, bx, by, 140);
      bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      bGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lctx.fillStyle = bGrad;
      lctx.beginPath();
      lctx.arc(bx, by, 140, 0, Math.PI * 2);
      lctx.fill();
    }

    // Carve out Player suit proximity aura + Raycast Flashlight Cone (battery scaled)
    if (showPlayer) {
      const px = player.x - camX;
      const py = player.y - camY;
      const battFactor = 0.52 + 0.48 * (player.battery / 100);

      // 360 suit proximity circle
      const aura = lctx.createRadialGradient(px, py, 8, px, py, 130);
      aura.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      aura.addColorStop(0.45, 'rgba(255, 255, 255, 0.55)');
      aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lctx.fillStyle = aura;
      lctx.beginPath();
      lctx.arc(px, py, 130, 0, Math.PI * 2);
      lctx.fill();

      // Raycast flashlight cone (blocked by walls and closed doors)
      const maxDist = 270 + 165 * (player.battery / 100);
      const halfCone = 0.58; // ~66 degrees total
      const rayCount = 54;

      lctx.save();
      lctx.beginPath();
      lctx.moveTo(px, py);
      for (let i = 0; i <= rayCount; i++) {
        const rayAngle =
          player.angle - halfCone + (i / rayCount) * (halfCone * 2);
        const hit = this.castLightRay(
          world,
          player.x,
          player.y,
          rayAngle,
          maxDist
        );
        lctx.lineTo(hit.x - camX, hit.y - camY);
      }
      lctx.closePath();

      const coneGrad = lctx.createRadialGradient(px, py, 10, px, py, maxDist);
      coneGrad.addColorStop(0, `rgba(255, 255, 255, ${(0.98 * battFactor).toFixed(2)})`);
      coneGrad.addColorStop(0.55, `rgba(255, 255, 255, ${(0.72 * battFactor).toFixed(2)})`);
      coneGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lctx.fillStyle = coneGrad;
      lctx.fill();
      lctx.restore();
    }

    // Composite darkness mask onto main canvas
    ctx.drawImage(this.lightCanvas, 0, 0);

    // Additive colored atmospheric light bloom
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const light of world.lights) {
      const sx = light.x - camX;
      const sy = light.y - camY;
      if (
        sx < -light.radius ||
        sx > viewportW + light.radius ||
        sy < -light.radius ||
        sy > viewportH + light.radius
      ) {
        continue;
      }

      let color = light.color;
      if (powerRestored && light.powerGroup) {
        color = '#22d3ee';
      }

      const mod = this.computeLightModulation(light, time);
      const r = light.radius * (light.highRisk ? 0.95 + 0.1 * mod : 0.85);
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      const peakAlpha = light.highRisk ? 0.34 : 0.22;
      grad.addColorStop(
        0,
        this.hexToRgba(color, peakAlpha * light.intensity * mod)
      );
      if (light.highRisk) {
        grad.addColorStop(
          0.45,
          this.hexToRgba(color, 0.14 * light.intensity * mod)
        );
      }
      grad.addColorStop(1, this.hexToRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Rotating emergency strobe cone & crimson beacon core in active high-risk zones
      if (light.highRisk && !(powerRestored && light.powerGroup)) {
        const sweepAngle = time * (light.speed ?? 3) * 0.9 + (light.phase ?? 0);
        const sweepLen = light.radius * 0.65;
        ctx.fillStyle = this.hexToRgba(color, 0.18 * mod);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, sweepLen, sweepAngle - 0.32, sweepAngle + 0.32);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(254, 202, 202, ${(0.75 * mod).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2 + mod * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle cool-cyan tint in player's flashlight cone
    if (showPlayer) {
      const px = player.x - camX;
      const py = player.y - camY;
      const tint = ctx.createRadialGradient(px, py, 0, px, py, 240);
      tint.addColorStop(0, 'rgba(186, 230, 253, 0.11)');
      tint.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(px, py, 240, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private computeLightModulation(light: LightSource, time: number): number {
    if (light.mode === 'static') return 1;
    const speed = light.speed ?? 2;
    const phase = light.phase ?? 0;
    if (light.mode === 'pulse') {
      const wave = 0.5 + 0.5 * Math.sin(time * speed + phase);
      if (light.highRisk) {
        return 0.18 + 0.82 * Math.pow(wave, 1.8);
      }
      return 0.45 + 0.55 * wave;
    }
    // Flicker
    const wave =
      Math.sin(time * speed + phase) * Math.sin(time * speed * 2.7 + phase);
    return wave > 0.35 ? 0.35 : 0.95;
  }

  private castLightRay(
    world: StationWorldData,
    startX: number,
    startY: number,
    angle: number,
    maxDist: number
  ): { x: number; y: number } {
    const step = 10;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let x = startX;
    let y = startY;
    let dist = 0;

    while (dist < maxDist) {
      x += dx;
      y += dy;
      dist += step;

      const col = Math.floor(x / TILE_SIZE);
      const row = Math.floor(y / TILE_SIZE);
      if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) {
        return { x, y };
      }
      const tile = world.grid[row][col];
      if (
        tile === TileType.WALL ||
        tile === TileType.VOID ||
        tile === TileType.WINDOW_SPACE
      ) {
        return { x, y };
      }

      // Closed doors also block flashlight beams
      for (const d of world.doors) {
        if (d.openProgress > 0.65) continue;
        const dx0 = d.tileX * TILE_SIZE;
        const dy0 = d.tileY * TILE_SIZE;
        const dw = d.tilesW * TILE_SIZE;
        const dh = d.tilesH * TILE_SIZE;
        if (x >= dx0 && x <= dx0 + dw && y >= dy0 && y <= dy0 + dh) {
          return { x, y };
        }
      }
    }

    return { x, y };
  }

  private drawWorldPrompt(
    ctx: CanvasRenderingContext2D,
    world: StationWorldData,
    nearby: NearbyInteractable
  ): void {
    let wx = 0;
    let wy = 0;

    if (nearby.kind === 'DOOR') {
      const door = world.doors.find((d) => d.id === nearby.id);
      if (!door) return;
      wx = (door.tileX + door.tilesW / 2) * TILE_SIZE;
      wy = door.tileY * TILE_SIZE - 14;
    } else if (nearby.kind === 'PICKUP') {
      const pickup = world.pickups.find((p) => p.id === nearby.id);
      if (!pickup) return;
      wx = pickup.tileX * TILE_SIZE;
      wy = pickup.tileY * TILE_SIZE - 26;
    } else if (nearby.kind === 'TERMINAL') {
      const term = world.terminals.find((t) => t.id === nearby.id);
      if (!term) return;
      wx = term.tileX * TILE_SIZE;
      wy = term.tileY * TILE_SIZE - 28;
    } else if (nearby.kind === 'SUIT_STATION') {
      const station = world.suitStations.find((s) => s.id === nearby.id);
      if (!station) return;
      wx = station.tileX * TILE_SIZE;
      wy = station.tileY * TILE_SIZE - 28;
    }

    const label = '[E]';
    ctx.save();
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const boxW = 34;
    const boxH = 22;
    ctx.fillStyle = nearby.lockedReason
      ? 'rgba(127, 29, 29, 0.92)'
      : 'rgba(8, 22, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(wx - boxW / 2, wy - boxH / 2, boxW, boxH, 4);
    ctx.fill();

    ctx.strokeStyle = nearby.lockedReason ? '#ef4444' : '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, wx, wy + 0.5);
    ctx.restore();
  }

  private drawAsteroids(
    ctx: CanvasRenderingContext2D,
    world: StationWorldData,
    camX: number,
    camY: number,
    viewportW: number,
    viewportH: number,
    time: number
  ): void {
    for (const ast of world.asteroids) {
      if (
        ast.x + ast.radius < camX - 40 ||
        ast.x - ast.radius > camX + viewportW + 40 ||
        ast.y + ast.radius < camY - 40 ||
        ast.y - ast.radius > camY + viewportH + 40
      ) {
        continue;
      }

      ctx.save();
      ctx.translate(ast.x, ast.y);
      ctx.rotate(ast.rotation + time * ast.rotSpeed);
      ctx.fillStyle = ast.tint;
      ctx.strokeStyle = ast.hasBeacon ? '#ef4444' : '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ast.vertices.forEach((v, idx) => {
        const ang = (idx / ast.vertices.length) * Math.PI * 2;
        const px = Math.cos(ang) * ast.radius * v;
        const py = Math.sin(ang) * ast.radius * v;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (ast.hasBeacon && Math.sin(time * 4 + ast.x) > 0.15) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawSuitStation(
    ctx: CanvasRenderingContext2D,
    station: StationWorldData['suitStations'][number],
    time: number
  ): void {
    const cx = station.tileX * TILE_SIZE;
    const cy = station.tileY * TILE_SIZE;
    const pulse = 0.65 + 0.35 * Math.sin(time * 3);

    ctx.fillStyle = '#132033';
    ctx.fillRect(cx - 16, cy - 14, 32, 28);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - 16, cy - 14, 32, 28);

    ctx.fillStyle = `rgba(52, 211, 153, ${pulse.toFixed(2)})`;
    ctx.fillRect(cx - 7, cy - 2.5, 14, 5);
    ctx.fillRect(cx - 2.5, cy - 7, 5, 14);
  }

  private drawHazard(
    ctx: CanvasRenderingContext2D,
    hazard: StationWorldData['hazards'][number],
    time: number,
    powerRestored: boolean
  ): void {
    const cx = hazard.tileX * TILE_SIZE;
    const cy = hazard.tileY * TILE_SIZE;

    if (hazard.stabilizedByPower && powerRestored) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, hazard.radius * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    const pulse = 0.55 + 0.45 * Math.sin(time * 6 + cx);
    let color = '#ef4444';
    if (hazard.kind === 'ELECTRIC_ARC') color = '#38bdf8';
    else if (hazard.kind === 'CRYO_LEAK') color = '#7dd3fc';
    else if (hazard.kind === 'RADIATION_ZONE') color = '#10b981';

    ctx.fillStyle = this.hexToRgba(color, 0.16 * pulse);
    ctx.beginPath();
    ctx.arc(cx, cy, hazard.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.hexToRgba(color, 0.55 * pulse);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, hazard.radius * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (hazard.kind === 'ELECTRIC_ARC' && Math.sin(time * 18 + cx) > 0) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy - 10);
      ctx.lineTo(cx - 3, cy + 4);
      ctx.lineTo(cx + 6, cy - 6);
      ctx.lineTo(cx + 18, cy + 12);
      ctx.stroke();
    }
  }

  private drawMonster(
    ctx: CanvasRenderingContext2D,
    m: MonsterEntity,
    time: number
  ): void {
    ctx.save();
    ctx.translate(m.x, m.y);

    const isWindup = m.aiState === 'WINDUP';
    const isLunging = m.aiState === 'LUNGING';
    const pulse =
      0.65 +
      0.35 * Math.sin(time * (isWindup ? 16 : m.tier === 'BOSS' ? 6 : 4));

    const ringColor =
      isWindup || isLunging
        ? `rgba(239, 68, 68, ${(0.95 * pulse).toFixed(2)})`
        : m.archetype === 'ACID_SPITTER'
          ? 'rgba(74, 222, 128, 0.72)'
          : m.archetype === 'VOID_STALKER'
            ? 'rgba(192, 132, 252, 0.75)'
            : m.tier === 'BOSS'
              ? `rgba(239, 68, 68, ${(0.85 * pulse).toFixed(2)})`
              : 'rgba(245, 158, 11, 0.65)';

    // Threat / telegraph ring
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = isWindup || m.tier === 'BOSS' ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius + (isWindup ? 8 : 5), 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(m.angle);

    if (m.archetype === 'SKITTERER') {
      // 6 twitching chitin legs + mandibles
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const legSway = Math.sin(time * 14 + i) * 2.5;
        ctx.beginPath();
        ctx.moveTo(i * 5, 0);
        ctx.lineTo(i * 6 + legSway, -m.radius - 6);
        ctx.moveTo(i * 5, 0);
        ctx.lineTo(i * 6 - legSway, m.radius + 6);
        ctx.stroke();
      }
      ctx.fillStyle = '#291518';
      ctx.beginPath();
      ctx.ellipse(0, 0, m.radius * 1.05, m.radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isWindup ? '#ef4444' : '#f97316';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(m.radius * 0.55, -5, 6, 3);
      ctx.fillRect(m.radius * 0.55, 2, 6, 3);
    } else if (m.archetype === 'ACID_SPITTER') {
      // Pulsing green bio-acid sac thorax
      ctx.fillStyle = '#11291c';
      ctx.beginPath();
      ctx.arc(-2, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = `rgba(74, 222, 128, ${(0.5 + 0.4 * pulse).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(-3, 0, m.radius * 0.52, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#bbf7d0';
      ctx.beginPath();
      ctx.arc(m.radius * 0.65, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.archetype === 'VOID_STALKER') {
      // Long scythe blades + dark violet predatory frame
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(2, -m.radius * 0.6);
      ctx.lineTo(m.radius + 11, -m.radius * 0.35);
      ctx.moveTo(2, m.radius * 0.6);
      ctx.lineTo(m.radius + 11, m.radius * 0.35);
      ctx.stroke();

      ctx.fillStyle = '#221338';
      ctx.beginPath();
      ctx.ellipse(2, 0, m.radius * 1.1, m.radius * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isWindup ? '#ef4444' : '#c084fc';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = isWindup ? '#ef4444' : '#e879f9';
      ctx.fillRect(m.radius * 0.45, -5, 4, 3);
      ctx.fillRect(m.radius * 0.45, 2, 4, 3);
    } else {
      // Claws / bone blades pointing forward for Sentinels & Boss
      ctx.fillStyle = '#e7dcc8';
      ctx.beginPath();
      ctx.moveTo(m.radius - 2, -m.radius * 0.65);
      ctx.lineTo(m.radius + (m.tier === 'BOSS' ? 14 : 9), -m.radius * 0.35);
      ctx.lineTo(m.radius - 2, -m.radius * 0.25);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(m.radius - 2, m.radius * 0.65);
      ctx.lineTo(m.radius + (m.tier === 'BOSS' ? 14 : 9), m.radius * 0.35);
      ctx.lineTo(m.radius - 2, m.radius * 0.25);
      ctx.fill();

      const sprite =
        m.tier === 'BOSS'
          ? bossSpriteLoader.getSprite()
          : sentinelSpriteLoader.getSprite();

      if (sprite && sprite.width > 0) {
        ctx.save();
        ctx.rotate(-m.angle);
        ctx.beginPath();
        ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#140c10';
        ctx.fill();
        ctx.drawImage(
          sprite,
          -m.radius * 1.15,
          -m.radius * 1.15,
          m.radius * 2.3,
          m.radius * 2.3
        );
        ctx.restore();
      } else {
        ctx.fillStyle = m.tier === 'BOSS' ? '#5b2833' : '#3b2429';
        ctx.beginPath();
        ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = m.tier === 'BOSS' ? '#ef4444' : '#b45309';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(m.radius * 0.35, -5, 4, 3);
        ctx.fillRect(m.radius * 0.35, 2, 4, 3);
      }
    }

    if (m.hitFlash > 0.05) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(m.hitFlash * 0.6).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Overhead HP bar
    const bw = m.tier === 'BOSS' ? 44 : 30;
    const bh = 4;
    const ratio = Math.max(0, Math.min(1, m.hp / m.maxHp));
    ctx.fillStyle = 'rgba(2, 6, 16, 0.85)';
    ctx.fillRect(-bw / 2 - 1, -m.radius - 12, bw + 2, bh + 2);
    ctx.fillStyle =
      m.tier === 'BOSS'
        ? '#ef4444'
        : m.archetype === 'ACID_SPITTER'
          ? '#4ade80'
          : m.archetype === 'VOID_STALKER'
            ? '#c084fc'
            : '#f59e0b';
    ctx.fillRect(-bw / 2, -m.radius - 11, bw * ratio, bh);

    ctx.restore();
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    p: ProjectileEntity
  ): void {
    ctx.save();
    if (p.kind === 'MINING_LASER') {
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const tailLen = 22;
      const tx = p.x - (p.vx / speed) * tailLen;
      const ty = p.y - (p.vy / speed) * tailLen;

      // Outer cyan plasma bloom
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = p.radius * 1.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // Inner incandescent laser core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, p.radius * 0.65);
      ctx.beginPath();
      ctx.moveTo(tx + (p.vx / speed) * 6, ty + (p.vy / speed) * 6);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
}
