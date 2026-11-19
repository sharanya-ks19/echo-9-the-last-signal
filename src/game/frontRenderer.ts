import { bossSpriteLoader, sentinelSpriteLoader } from './bossSprite';
import {
  getSectorAtWorldPos,
  MAP_COLS,
  MAP_ROWS,
  StationWorldData,
  TILE_SIZE,
} from './stationMap';
import {
  DoorEntity,
  EchoBeaconEntity,
  HazardEntity,
  LightSource,
  ListenerEntity,
  MonsterEntity,
  NearbyInteractable,
  Particle,
  PickupEntity,
  PlayerState,
  ProjectileEntity,
  PropEntity,
  SectorId,
  SuitStationEntity,
  TerminalEntity,
  TileType,
} from './types';

interface DoorRayHit {
  dist: number;
  u: number;
  door: DoorEntity;
}

interface WallRayResult {
  wallDist: number;
  u: number;
  side: number;
  tileX: number;
  tileY: number;
  isViewportPanel: boolean;
  doorHit: DoorRayHit | null;
}

interface ProjectedSprite {
  x: number;
  y: number;
  dist: number;
  kind:
    | 'PROP'
    | 'TERMINAL'
    | 'PICKUP'
    | 'HAZARD'
    | 'SUIT_STATION'
    | 'LIGHT_BEACON'
    | 'ECHO_BEACON'
    | 'LISTENER'
    | 'MONSTER'
    | 'PROJECTILE'
    | 'PARTICLE';
  prop?: PropEntity;
  terminal?: TerminalEntity;
  pickup?: PickupEntity;
  hazard?: HazardEntity;
  suitStation?: SuitStationEntity;
  light?: LightSource;
  echoBeacon?: EchoBeaconEntity;
  listener?: ListenerEntity;
  monster?: MonsterEntity;
  projectile?: ProjectileEntity;
  particle?: Particle;
}

const TEX_SIZE = 128;

export class FrontPovRenderer {
  private zBuffer: Float32Array = new Float32Array(0);
  private doorHits: Array<DoorRayHit | null> = [];

  private envCanvas: HTMLCanvasElement;
  private envCtx: CanvasRenderingContext2D;
  private envImageData: ImageData;
  private readonly envResW = 320;
  private readonly envResH = 200;

  // Pre-baked procedural 128x128 sci-fi wall textures per sector
  private wallTextures: Record<SectorId, HTMLCanvasElement>;

  constructor() {
    this.envCanvas = document.createElement('canvas');
    this.envCanvas.width = this.envResW;
    this.envCanvas.height = this.envResH;
    const ectx = this.envCanvas.getContext('2d');
    if (!ectx) {
      throw new Error('Failed to create 3D environment raycast context');
    }
    this.envCtx = ectx;
    this.envImageData = ectx.createImageData(this.envResW, this.envResH);

    this.wallTextures = {
      ARRIVAL_BAY: this.bakeWallTexture('ARRIVAL_BAY'),
      RESEARCH_LAB: this.bakeWallTexture('RESEARCH_LAB'),
      ENGINEERING_CORE: this.bakeWallTexture('ENGINEERING_CORE'),
      COMMAND_DECK: this.bakeWallTexture('COMMAND_DECK'),
    };
  }

  private bakeWallTexture(sector: SectorId): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const c = canvas.getContext('2d');
    if (!c) return canvas;

    // Base dark titanium bulkhead gradient
    const bg = c.createLinearGradient(0, 0, 0, TEX_SIZE);
    if (sector === 'RESEARCH_LAB') {
      bg.addColorStop(0, '#132036');
      bg.addColorStop(0.5, '#1e304d');
      bg.addColorStop(1, '#101b2e');
    } else if (sector === 'ENGINEERING_CORE') {
      bg.addColorStop(0, '#141b29');
      bg.addColorStop(0.5, '#1c2638');
      bg.addColorStop(1, '#0e131e');
    } else if (sector === 'COMMAND_DECK') {
      bg.addColorStop(0, '#0e1729');
      bg.addColorStop(0.5, '#16243d');
      bg.addColorStop(1, '#0a1220');
    } else {
      bg.addColorStop(0, '#121d30');
      bg.addColorStop(0.5, '#1a2942');
      bg.addColorStop(1, '#0e1626');
    }
    c.fillStyle = bg;
    c.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Subtle brushed steel horizontal grain
    for (let y = 0; y < TEX_SIZE; y += 2) {
      c.fillStyle =
        y % 4 === 0 ? 'rgba(255, 255, 255, 0.018)' : 'rgba(0, 0, 0, 0.045)';
      c.fillRect(0, y, TEX_SIZE, 1);
    }

    // Armored vertical structural pillars at tile edges
    c.fillStyle = '#0c1322';
    c.fillRect(0, 0, 12, TEX_SIZE);
    c.fillRect(TEX_SIZE - 12, 0, 12, TEX_SIZE);
    c.fillStyle = '#2b3f61';
    c.fillRect(11, 0, 2, TEX_SIZE);
    c.fillRect(TEX_SIZE - 13, 0, 2, TEX_SIZE);

    // Top cornice & lower reinforced baseboard
    c.fillStyle = '#090f1c';
    c.fillRect(0, 0, TEX_SIZE, 14);
    c.fillRect(0, TEX_SIZE - 16, TEX_SIZE, 16);

    // Glowing cyan architectural trim strips (top & bottom)
    c.fillStyle = '#22d3ee';
    c.fillRect(14, 13, TEX_SIZE - 28, 2.5);
    c.fillRect(14, TEX_SIZE - 18, TEX_SIZE - 28, 2.5);

    // Corner rivets on pillars
    c.fillStyle = '#475569';
    for (let ry = 18; ry < TEX_SIZE - 18; ry += 22) {
      c.fillRect(4, ry, 3, 3);
      c.fillRect(TEX_SIZE - 7, ry, 3, 3);
    }

    // Center recessed panel bevel
    c.strokeStyle = '#0a101d';
    c.lineWidth = 2;
    c.strokeRect(18, 22, TEX_SIZE - 36, TEX_SIZE - 46);
    c.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    c.lineWidth = 1;
    c.strokeRect(19, 23, TEX_SIZE - 38, TEX_SIZE - 48);

    if (sector === 'RESEARCH_LAB') {
      // Illuminated cleanroom bio-display glass recess
      c.fillStyle = '#071526';
      c.fillRect(24, 34, TEX_SIZE - 48, 52);
      c.strokeStyle = '#38bdf8';
      c.lineWidth = 1.5;
      c.strokeRect(24, 34, TEX_SIZE - 48, 52);
      // Faint cyan waveform / readout bars inside lab wall screen
      c.fillStyle = 'rgba(34, 211, 238, 0.25)';
      c.fillRect(28, 40, TEX_SIZE - 56, 10);
      c.fillStyle = 'rgba(56, 189, 248, 0.45)';
      c.fillRect(28, 56, 44, 3);
      c.fillRect(28, 63, 62, 3);
      c.fillRect(28, 70, 34, 3);
      // Glowing vertical cyan side light tubes
      c.fillStyle = 'rgba(34, 211, 238, 0.75)';
      c.fillRect(14, 28, 2, 64);
      c.fillRect(TEX_SIZE - 16, 28, 2, 64);
    } else if (sector === 'ENGINEERING_CORE') {
      // Heavy blue energy conduit pipes across bulkhead
      c.fillStyle = '#090e17';
      c.fillRect(14, 42, TEX_SIZE - 28, 32);
      c.fillStyle = '#1e3a5f';
      c.fillRect(14, 46, TEX_SIZE - 28, 8);
      c.fillRect(14, 60, TEX_SIZE - 28, 8);
      c.fillStyle = '#38bdf8';
      c.fillRect(14, 49, TEX_SIZE - 28, 2.5);
      c.fillRect(14, 63, TEX_SIZE - 28, 2.5);
      // Pipe clamp collars
      c.fillStyle = '#334155';
      for (let cx = 28; cx < TEX_SIZE - 24; cx += 34) {
        c.fillRect(cx, 44, 6, 26);
      }
      // Subtle industrial hazard stripe at baseboard
      c.fillStyle = '#d97706';
      for (let hx = 14; hx < TEX_SIZE - 18; hx += 12) {
        c.fillRect(hx, TEX_SIZE - 11, 6, 4);
      }
    } else if (sector === 'COMMAND_DECK') {
      // Sleek orbital telemetry data screen inset
      c.fillStyle = '#06101f';
      c.fillRect(22, 30, TEX_SIZE - 44, 56);
      c.strokeStyle = '#22d3ee';
      c.lineWidth = 1.5;
      c.strokeRect(22, 30, TEX_SIZE - 44, 56);
      // Orbital wireframe rings inside wall monitor
      c.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(64, 58, 18, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.ellipse(64, 58, 28, 9, -0.25, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#38bdf8';
      c.fillRect(62, 56, 4, 4);
    } else {
      // ARRIVAL_BAY: Armored structural ribs & diagnostic status window
      c.fillStyle = '#101929';
      c.fillRect(24, 30, TEX_SIZE - 48, 58);
      c.strokeStyle = '#263854';
      c.lineWidth = 1.5;
      c.strokeRect(24, 30, TEX_SIZE - 48, 58);
      // Diagonal structural truss lines
      c.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      c.beginPath();
      c.moveTo(26, 32);
      c.lineTo(TEX_SIZE - 26, 86);
      c.moveTo(TEX_SIZE - 26, 32);
      c.lineTo(26, 86);
      c.stroke();
      // Small glowing status indicator bar
      c.fillStyle = '#22d3ee';
      c.fillRect(30, 36, 22, 3);
      c.fillStyle = '#38bdf8';
      c.fillRect(30, 43, 14, 2);
    }

    return canvas;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
    time: number,
    world: StationWorldData,
    player: PlayerState,
    particles: Particle[],
    projectiles: ProjectileEntity[],
    activeBeacons: EchoBeaconEntity[],
    powerRestored: boolean,
    nearby: NearbyInteractable | null,
    activeHazardLabel: string | null,
    showVisorCrosshair: boolean
  ): void {
    const speed = Math.hypot(player.vx, player.vy);
    const bobOffset =
      showVisorCrosshair && speed > 15
        ? Math.sin(player.walkCycle) * Math.min(5.5, speed / 36)
        : 0;
    const horizon = viewportH * 0.5 + bobOffset;

    const fov = 1.15; // ~66 degrees
    const halfFov = fov / 2;
    const projDist = viewportW / 2 / Math.tan(halfFov);

    // 1. Full Perspective Raycasted Sci-Fi Ceiling + Reflective Metallic Floor with Neon Strips
    this.drawPerspectiveCeilingAndFloor(
      ctx,
      viewportW,
      viewportH,
      horizon,
      projDist,
      halfFov,
      player,
      time,
      world,
      powerRestored
    );

    // 2. Raycast Textured Bulkhead Walls & Deep-Space Observation Windows (Recording Glass Doors)
    const stripW = 2;
    const numRays = Math.ceil(viewportW / stripW);
    if (this.zBuffer.length !== numRays) {
      this.zBuffer = new Float32Array(numRays);
    }
    this.doorHits.length = numRays;

    for (let i = 0; i < numRays; i++) {
      const screenX = i * stripW;
      const cameraX = (2 * (screenX + stripW * 0.5)) / viewportW - 1;
      const rayAngle = player.angle + Math.atan(cameraX * Math.tan(halfFov));
      const cosDiff = Math.cos(rayAngle - player.angle);

      const hit = this.castRay(world, player.x, player.y, rayAngle);
      if (!hit) {
        this.zBuffer[i] = 99999;
        this.doorHits[i] = null;
        continue;
      }

      const perpDist = Math.max(8, hit.wallDist * cosDiff);
      this.zBuffer[i] = perpDist;

      if (hit.doorHit) {
        this.doorHits[i] = {
          dist: Math.max(8, hit.doorHit.dist * cosDiff),
          u: hit.doorHit.u,
          door: hit.doorHit.door,
        };
      } else {
        this.doorHits[i] = null;
      }

      const sliceH = (TILE_SIZE / perpDist) * projDist;
      const topY = horizon - sliceH * 0.5;

      const battBoost = 0.72 + 0.28 * (player.battery / 100);
      const centerFocus = Math.max(0, 1 - Math.abs(cameraX) * 1.1);
      const flashlight =
        Math.max(0.18, 1 - perpDist / 680) *
        (0.58 + 0.65 * centerFocus * battBoost);
      const fogFactor = Math.exp(-perpDist * 0.0018);
      const shade = Math.min(1, flashlight * (0.35 + 0.65 * fogFactor));

      const hitX = player.x + Math.cos(rayAngle) * hit.wallDist;
      const hitY = player.y + Math.sin(rayAngle) * hit.wallDist;
      const redGlow = this.computeRedLightAtPoint(
        world,
        hitX,
        hitY,
        time,
        powerRestored
      );

      if (hit.isViewportPanel) {
        this.drawViewportWindowSlice(
          ctx,
          screenX,
          stripW,
          topY,
          sliceH,
          hit.u,
          rayAngle,
          hit.tileY,
          shade,
          fogFactor,
          time
        );
      } else {
        this.drawTexturedWallSlice(
          ctx,
          screenX,
          stripW,
          topY,
          sliceH,
          hit.u,
          hit.side,
          shade,
          fogFactor,
          redGlow,
          hitX,
          hitY,
          hit.tileX,
          hit.tileY,
          time,
          powerRestored
        );
      }
    }

    // 3. Atmospheric Horizon Fog Seam (adds deep corridor perspective)
    const fogBand = ctx.createLinearGradient(0, horizon - 22, 0, horizon + 22);
    fogBand.addColorStop(0, 'rgba(3, 8, 20, 0)');
    fogBand.addColorStop(0.5, 'rgba(5, 16, 36, 0.24)');
    fogBand.addColorStop(1, 'rgba(3, 8, 20, 0)');
    ctx.fillStyle = fogBand;
    ctx.fillRect(0, horizon - 22, viewportW, 44);

    // 4. Far 3D Sprites (visible THROUGH closed/opening glass doors)
    this.drawSpritesPass(
      ctx,
      viewportW,
      viewportH,
      horizon,
      projDist,
      halfFov,
      stripW,
      numRays,
      time,
      world,
      player,
      particles,
      projectiles,
      activeBeacons,
      powerRestored,
      'FAR'
    );

    // 5. Futuristic Sliding Glass Doors (Opaque titanium frame + translucent cyber-glass pane)
    for (let i = 0; i < numRays; i++) {
      const dh = this.doorHits[i];
      if (!dh) continue;
      const screenX = i * stripW;
      const sliceH = (TILE_SIZE / dh.dist) * projDist;
      const topY = horizon - sliceH * 0.5;
      const fogFactor = Math.exp(-dh.dist * 0.0018);
      const shade = Math.min(1, Math.max(0.28, 1 - dh.dist / 640));

      const doorWx = (dh.door.tileX + dh.door.tilesW * 0.5) * TILE_SIZE;
      const doorWy = (dh.door.tileY + dh.door.tilesH * 0.5) * TILE_SIZE;
      const redGlow = this.computeRedLightAtPoint(
        world,
        doorWx,
        doorWy,
        time,
        powerRestored
      );

      this.drawGlassDoorSlice(
        ctx,
        screenX,
        stripW,
        topY,
        sliceH,
        dh.u,
        dh.door,
        shade,
        fogFactor,
        redGlow,
        time,
        powerRestored
      );
    }

    // 6. Near 3D Sprites (in front of glass doors)
    this.drawSpritesPass(
      ctx,
      viewportW,
      viewportH,
      horizon,
      projDist,
      halfFov,
      stripW,
      numRays,
      time,
      world,
      player,
      particles,
      projectiles,
      activeBeacons,
      powerRestored,
      'NEAR'
    );

    // 7. Volumetric Light Shafts & Subtle Atmospheric Glow
    this.drawVolumetricShafts(
      ctx,
      viewportW,
      viewportH,
      horizon,
      projDist,
      halfFov,
      stripW,
      numRays,
      time,
      world,
      player,
      powerRestored
    );

    // 8. Helmet Visor Vignette, Crosshair & Hazard Danger Feedback
    this.drawVisorOverlay(
      ctx,
      viewportW,
      viewportH,
      time,
      player,
      nearby,
      activeHazardLabel,
      showVisorCrosshair
    );
  }

  private drawPerspectiveCeilingAndFloor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizon: number,
    projDist: number,
    halfFov: number,
    player: PlayerState,
    time: number,
    world: StationWorldData,
    powerRestored: boolean
  ): void {
    const img = this.envImageData;
    const data = img.data;
    const ew = this.envResW;
    const eh = this.envResH;

    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const planeScale = Math.tan(halfFov);
    const planeX = -dirY * planeScale;
    const planeY = dirX * planeScale;

    const rayDirX0 = dirX - planeX;
    const rayDirY0 = dirY - planeY;
    const rayDirX1 = dirX + planeX;
    const rayDirY1 = dirY + planeY;
    const stepSpanX = rayDirX1 - rayDirX0;
    const stepSpanY = rayDirY1 - rayDirY0;

    const camZ = TILE_SIZE * 0.5 * projDist;
    const battFactor = 0.65 + 0.35 * (player.battery / 100);

    // Pre-collect nearby active red emergency lights & cyan tech lights
    const nearbyLights: Array<{
      x: number;
      y: number;
      rSq: number;
      rInv: number;
      isRed: boolean;
      rC: number;
      gC: number;
      bC: number;
    }> = [];

    for (const light of world.lights) {
      if (
        Math.abs(light.x - player.x) > 680 ||
        Math.abs(light.y - player.y) > 680
      ) {
        continue;
      }
      const isPowerConverted = Boolean(powerRestored && light.powerGroup);
      const isRed = Boolean(light.highRisk && !isPowerConverted);
      const speed = light.speed ?? 3;
      const phase = light.phase ?? 0;
      const pulse =
        light.mode === 'static'
          ? 1
          : light.mode === 'pulse'
            ? 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(time * speed + phase), 1.6)
            : 0.55 + 0.45 * Math.sin(time * speed + phase);

      const power = light.intensity * pulse;
      nearbyLights.push({
        x: light.x,
        y: light.y,
        rSq: light.radius * light.radius,
        rInv: 1 / light.radius,
        isRed,
        rC: isRed ? 195 * power : isPowerConverted ? 30 * power : 20 * power,
        gC: isRed ? 24 * power : isPowerConverted ? 155 * power : 115 * power,
        bC: isRed ? 28 * power : isPowerConverted ? 205 * power : 165 * power,
      });
    }

    const horizonPx = Math.floor((horizon / h) * eh);

    for (let py = 0; py < eh; py++) {
      const screenY = ((py + 0.5) / eh) * h;
      const isCeiling = py < horizonPx;
      const dy = isCeiling
        ? Math.max(1.2, horizon - screenY)
        : Math.max(1.2, screenY - horizon);
      const rowDist = camZ / dy;

      let wx = player.x + rowDist * rayDirX0;
      let wy = player.y + rowDist * rayDirY0;
      const stepX = (rowDist * stepSpanX) / ew;
      const stepY = (rowDist * stepSpanY) / ew;

      const fog = Math.exp(-rowDist * 0.00195);
      const distShade = Math.max(0.14, 1 - rowDist / 680) * fog;

      for (let px = 0; px < ew; px++) {
        const col = Math.floor(wx / TILE_SIZE);
        const row = Math.floor(wy / TILE_SIZE);

        let baseR = 9;
        let baseG = 16;
        let baseB = 28;
        let emissiveR = 0;
        let emissiveG = 0;
        let emissiveB = 0;

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
          const tile = world.grid[row][col];
          const tx = ((wx % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
          const ty = ((wy % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
          const u = tx / TILE_SIZE;
          const v = ty / TILE_SIZE;

          if (isCeiling) {
            // Futuristic Architectural Ceiling Coffers + Glowing Overhead Light Strips
            const isBeam = u < 0.07 || u > 0.93 || v < 0.07 || v > 0.93;
            const isLightStrip =
              (col + row) % 2 === 0 &&
              u > 0.36 &&
              u < 0.64 &&
              v > 0.14 &&
              v < 0.86;
            const isConduit = v > 0.44 && v < 0.56 && !isBeam;

            if (isLightStrip) {
              baseR = 32;
              baseG = 90;
              baseB = 120;
              emissiveR = 55;
              emissiveG = 215;
              emissiveB = 248;
            } else if (isBeam) {
              baseR = 12;
              baseG = 19;
              baseB = 34;
            } else if (isConduit) {
              baseR = 20;
              baseG = 34;
              baseB = 56;
            } else {
              baseR = 14;
              baseG = 24;
              baseB = 42;
            }
          } else {
            // Futuristic Modular Floor + Glowing Cyan Wall-Edge Strips + Reflections
            const wallN = row > 0 && world.grid[row - 1][col] === TileType.WALL;
            const wallS =
              row + 1 < MAP_ROWS && world.grid[row + 1][col] === TileType.WALL;
            const wallW = col > 0 && world.grid[row][col - 1] === TileType.WALL;
            const wallE =
              col + 1 < MAP_COLS && world.grid[row][col + 1] === TileType.WALL;

            const onNeonStrip =
              (wallN && v > 0.05 && v < 0.11) ||
              (wallS && v < 0.95 && v > 0.89) ||
              (wallW && u > 0.05 && u < 0.11) ||
              (wallE && u < 0.95 && u > 0.89);

            const nearNeonGlow =
              (wallN && v < 0.24) ||
              (wallS && v > 0.76) ||
              (wallW && u < 0.24) ||
              (wallE && u > 0.76);

            if (onNeonStrip) {
              baseR = 20;
              baseG = 160;
              baseB = 210;
              emissiveR = 34;
              emissiveG = 215;
              emissiveB = 250;
            } else if (tile === TileType.FLOOR_HAZARD) {
              const stripe = ((u + v) * 4) % 1 < 0.5;
              if (u < 0.05 || u > 0.95 || v < 0.05 || v > 0.95) {
                baseR = 22;
                baseG = 32;
                baseB = 48;
              } else if (stripe) {
                baseR = 185;
                baseG = 122;
                baseB = 18;
              } else {
                baseR = 15;
                baseG = 22;
                baseB = 34;
              }
            } else if (tile === TileType.FLOOR_GRATE) {
              const isFrame = u < 0.07 || u > 0.93 || v < 0.07 || v > 0.93;
              const isSlat = Math.floor(u * 6) % 2 === 0;
              if (isFrame) {
                baseR = 32;
                baseG = 48;
                baseB = 74;
              } else if (isSlat) {
                baseR = 22;
                baseG = 36;
                baseB = 58;
              } else {
                // Sub-deck glowing blue under-floor conduit glow
                baseR = 8;
                baseG = 26;
                baseB = 46;
                emissiveG = 18;
                emissiveB = 38;
              }
            } else {
              // Brushed reflective titanium deck tiles
              const isSeam = u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96;
              const isInnerLine =
                Math.abs(u - 0.5) < 0.018 || Math.abs(v - 0.5) < 0.018;
              const isRivet =
                (u < 0.13 || u > 0.87) && (v < 0.13 || v > 0.87);
              const checker = (col + row) % 2 === 0;
              if (isSeam) {
                baseR = 9;
                baseG = 15;
                baseB = 28;
              } else if (isRivet) {
                baseR = 54;
                baseG = 78;
                baseB = 112;
              } else if (isInnerLine) {
                baseR = 16;
                baseG = 28;
                baseB = 48;
              } else if (checker) {
                baseR = 22;
                baseG = 34;
                baseB = 56;
              } else {
                baseR = 26;
                baseG = 40;
                baseB = 64;
              }

              // Specular reflection of overhead ceiling light panels on polished deck
              if (
                (col + row) % 2 === 0 &&
                u > 0.34 &&
                u < 0.66 &&
                v > 0.18 &&
                v < 0.82
              ) {
                emissiveG += 24;
                emissiveB += 42;
              }
            }

            if (nearNeonGlow && !onNeonStrip) {
              emissiveG += 18;
              emissiveB += 32;
            }
          }
        }

        // Flashlight beam cone emphasis
        const normX = (px / ew) * 2 - 1;
        const beam =
          0.55 + 0.68 * Math.max(0, 1 - Math.abs(normX) * 1.1) * battFactor;
        const lit = Math.min(1.2, distShade * beam);

        let outR = baseR * lit + emissiveR * fog;
        let outG = baseG * lit + emissiveG * fog;
        let outB = baseB * lit + emissiveB * fog;

        // Subtle cyan flashlight highlight close to player
        if (rowDist < 230) {
          const flashTint =
            (1 - rowDist / 230) *
            Math.max(0, 1 - Math.abs(normX) * 1.15) *
            20 *
            battFactor;
          outG += flashTint * 0.78;
          outB += flashTint * 1.15;
        }

        // Point lights (red emergency beacons + cyan room lights) reflected on floor & ceiling
        for (let l = 0; l < nearbyLights.length; l++) {
          const nl = nearbyLights[l];
          const ldx = wx - nl.x;
          const ldy = wy - nl.y;
          const dSq = ldx * ldx + ldy * ldy;
          if (dSq < nl.rSq) {
            const f = 1 - Math.sqrt(dSq) * nl.rInv;
            const ff = f * f * (isCeiling ? 0.65 : 0.9) * fog;
            outR += nl.rC * ff;
            outG += nl.gC * ff;
            outB += nl.bC * ff;
          }
        }

        // Distance exponential fog blend toward deep sci-fi navy (#030816)
        const invFog = 1 - fog;
        outR += 3 * invFog;
        outG += 8 * invFog;
        outB += 22 * invFog;

        const idx = (py * ew + px) * 4;
        data[idx] = outR > 255 ? 255 : outR;
        data[idx + 1] = outG > 255 ? 255 : outG;
        data[idx + 2] = outB > 255 ? 255 : outB;
        data[idx + 3] = 255;

        wx += stepX;
        wy += stepY;
      }
    }

    this.envCtx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.envCanvas, 0, 0, w, h);
    ctx.restore();
  }

  private castRay(
    world: StationWorldData,
    startX: number,
    startY: number,
    angle: number
  ): WallRayResult | null {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let mapX = Math.floor(startX / TILE_SIZE);
    let mapY = Math.floor(startY / TILE_SIZE);

    const deltaDistX =
      Math.abs(dirX) < 1e-6 ? 1e30 : Math.abs(TILE_SIZE / dirX);
    const deltaDistY =
      Math.abs(dirY) < 1e-6 ? 1e30 : Math.abs(TILE_SIZE / dirY);

    let stepX = 0;
    let stepY = 0;
    let sideDistX = 0;
    let sideDistY = 0;

    if (dirX < 0) {
      stepX = -1;
      sideDistX = ((startX - mapX * TILE_SIZE) / TILE_SIZE) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (((mapX + 1) * TILE_SIZE - startX) / TILE_SIZE) * deltaDistX;
    }

    if (dirY < 0) {
      stepY = -1;
      sideDistY = ((startY - mapY * TILE_SIZE) / TILE_SIZE) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (((mapY + 1) * TILE_SIZE - startY) / TILE_SIZE) * deltaDistY;
    }

    let bestDoorDist = Infinity;
    let bestDoorHit: DoorRayHit | null = null;

    for (const door of world.doors) {
      if (door.openProgress > 0.96) continue;
      if (door.orientation === 'horizontal') {
        if (Math.abs(dirY) < 1e-6) continue;
        const planeY = (door.tileY + 0.5) * TILE_SIZE;
        const t = (planeY - startY) / dirY;
        if (t <= 4 || t >= bestDoorDist) continue;
        const hx = startX + dirX * t;
        const x0 = door.tileX * TILE_SIZE;
        const w = door.tilesW * TILE_SIZE;
        if (hx < x0 || hx > x0 + w) continue;
        const u = (hx - x0) / w;
        const closedHalf = 0.5 * (1 - door.openProgress * 0.92);
        if (u <= closedHalf || u >= 1 - closedHalf) {
          bestDoorDist = t;
          bestDoorHit = { dist: t, u, door };
        }
      } else {
        if (Math.abs(dirX) < 1e-6) continue;
        const planeX = (door.tileX + 0.5) * TILE_SIZE;
        const t = (planeX - startX) / dirX;
        if (t <= 4 || t >= bestDoorDist) continue;
        const hy = startY + dirY * t;
        const y0 = door.tileY * TILE_SIZE;
        const h = door.tilesH * TILE_SIZE;
        if (hy < y0 || hy > y0 + h) continue;
        const u = (hy - y0) / h;
        const closedHalf = 0.5 * (1 - door.openProgress * 0.92);
        if (u <= closedHalf || u >= 1 - closedHalf) {
          bestDoorDist = t;
          bestDoorHit = { dist: t, u, door };
        }
      }
    }

    let side = 0;
    for (let step = 0; step < 64; step++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      if (mapX < 0 || mapX >= MAP_COLS || mapY < 0 || mapY >= MAP_ROWS) {
        return null;
      }

      const tile = world.grid[mapY][mapX];
      if (
        tile === TileType.WALL ||
        tile === TileType.VOID ||
        tile === TileType.WINDOW_SPACE
      ) {
        const wallDist =
          side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
        const hitPos =
          side === 0
            ? startY + wallDist * dirY
            : startX + wallDist * dirX;
        const u = (((hitPos % TILE_SIZE) + TILE_SIZE) % TILE_SIZE) / TILE_SIZE;

        return {
          wallDist,
          u,
          side,
          tileX: mapX,
          tileY: mapY,
          isViewportPanel: tile === TileType.WINDOW_SPACE,
          doorHit:
            bestDoorHit && bestDoorHit.dist < wallDist ? bestDoorHit : null,
        };
      }
    }

    return null;
  }

  private drawTexturedWallSlice(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    topY: number,
    sliceH: number,
    u: number,
    side: number,
    shade: number,
    fogFactor: number,
    redGlow: number,
    hitX: number,
    hitY: number,
    tileX: number,
    tileY: number,
    time: number,
    powerRestored: boolean
  ): void {
    const sector = getSectorAtWorldPos(hitX, hitY);
    const tex = this.wallTextures[sector];
    const texX = Math.max(0, Math.min(TEX_SIZE - 1, Math.floor(u * TEX_SIZE)));

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tex, texX, 0, 1, TEX_SIZE, x, topY, w, sliceH);

    // Distance fog + directional side shadow overlay
    const sideDark = side === 1 ? 0.16 : 0;
    const darkAlpha = Math.min(0.84, Math.max(0, 1 - shade + sideDark));
    if (darkAlpha > 0.02) {
      ctx.fillStyle = `rgba(3, 8, 22, ${darkAlpha.toFixed(3)})`;
      ctx.fillRect(x, topY, w, sliceH);
    }

    // Dynamic red emergency light wash onto wall panel
    if (redGlow > 0.04) {
      ctx.fillStyle = `rgba(239, 68, 68, ${(redGlow * 0.42).toFixed(3)})`;
      ctx.fillRect(x, topY, w, sliceH);
    }

    // Emissive cyan / emergency LED strips that cut cleanly through shadow
    const isPillar = u < 0.1 || u > 0.9;
    if (!isPillar && sliceH > 22) {
      const isEmergencyTile =
        redGlow > 0.14 || ((tileX + tileY) % 6 === 0 && !powerRestored);
      if (isEmergencyTile) {
        const pulse =
          redGlow > 0.14
            ? 0.55 + redGlow * 0.45
            : 0.4 + 0.6 * Math.sin(time * 4 + tileX);
        ctx.fillStyle = `rgba(248, 113, 113, ${(0.88 * pulse * fogFactor).toFixed(2)})`;
      } else {
        ctx.fillStyle = `rgba(34, 211, 238, ${(0.72 * fogFactor).toFixed(2)})`;
      }
      // Upper cornice & lower floor baseboard neon strip
      const stripH = Math.max(2, sliceH * 0.022);
      ctx.fillRect(x, topY + sliceH * 0.1, w, stripH);
      ctx.fillRect(x, topY + sliceH * 0.86, w, stripH);
    }
    ctx.restore();
  }

  private drawViewportWindowSlice(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    topY: number,
    sliceH: number,
    u: number,
    rayAngle: number,
    tileY: number,
    shade: number,
    fogFactor: number,
    time: number
  ): void {
    const isPillar = u < 0.09 || u > 0.91;

    ctx.save();
    ctx.globalAlpha = 1;

    if (isPillar) {
      // Solid brushed titanium viewport mullion
      const lit = Math.round(42 * shade);
      ctx.fillStyle = `rgb(${lit}, ${Math.round(lit * 1.4)}, ${Math.round(lit * 2.1)})`;
      ctx.fillRect(x, topY, w, sliceH);
      ctx.restore();
      return;
    }

    // 1. Exterior Deep Space & Exoplanet Panorama inside armored window
    const glassTop = topY + sliceH * 0.16;
    const glassH = sliceH * 0.68;

    const spaceGrad = ctx.createLinearGradient(0, glassTop, 0, glassTop + glassH);
    if (tileY <= 4) {
      // Command Deck North Window overlooking Unexplored Exoplanet
      spaceGrad.addColorStop(0, '#020612');
      spaceGrad.addColorStop(0.55, '#071d36');
      spaceGrad.addColorStop(0.85, '#134e4a');
      spaceGrad.addColorStop(1, '#22d3ee');
    } else {
      spaceGrad.addColorStop(0, '#02050d');
      spaceGrad.addColorStop(0.6, '#050d1e');
      spaceGrad.addColorStop(1, '#0b1e36');
    }
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(x, glassTop, w, glassH);

    // Distant exoplanet curvature & orbital truss in North observation deck
    if (tileY <= 4) {
      const pArc = Math.sin(rayAngle * 1.6);
      if (pArc < 0.45) {
        const limbY = glassTop + glassH * (0.58 + pArc * 0.25);
        ctx.fillStyle = '#0f2f42';
        ctx.fillRect(x, limbY, w, glassTop + glassH - limbY);
        ctx.fillStyle = 'rgba(34, 211, 238, 0.72)';
        ctx.fillRect(x, limbY, w, Math.max(2, sliceH * 0.02));
      }
    }

    // Crisp parallax starfield through the window
    const starSeed = Math.floor(rayAngle * 110);
    if ((starSeed * 17) % 13 === 0) {
      const sy = glassTop + (((starSeed * 37) % 80) / 100) * glassH;
      const tw = 0.55 + 0.45 * Math.sin(time * 2.5 + starSeed);
      ctx.fillStyle = `rgba(224, 242, 254, ${tw.toFixed(2)})`;
      ctx.fillRect(x, sy, w, Math.max(1.5, sliceH * 0.015));
    }

    // Subtle glass reflection streak across window pane
    const reflY = glassTop + ((u * 0.65 + 0.15) % 0.8) * glassH;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.12)';
    ctx.fillRect(x, reflY, w, Math.max(2, sliceH * 0.04));

    // 2. Solid Hull Header & Armored Sill with Neon Cyan Trim
    const s = Math.max(0.25, shade);
    ctx.fillStyle = `rgb(${Math.round(18 * s)}, ${Math.round(28 * s)}, ${Math.round(46 * s)})`;
    ctx.fillRect(x, topY, w, sliceH * 0.16);
    ctx.fillRect(x, topY + sliceH * 0.84, w, sliceH * 0.16);

    ctx.fillStyle = `rgba(34, 211, 238, ${(0.85 * fogFactor).toFixed(2)})`;
    ctx.fillRect(x, glassTop, w, Math.max(2, sliceH * 0.018));
    ctx.fillRect(x, glassTop + glassH - 2, w, Math.max(2, sliceH * 0.018));

    ctx.restore();
  }

  private drawGlassDoorSlice(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    topY: number,
    sliceH: number,
    u: number,
    door: DoorEntity,
    shade: number,
    fogFactor: number,
    redGlow: number,
    time: number,
    powerRestored: boolean
  ): void {
    const lit = Math.max(0.32, shade);
    const isFrame =
      u < 0.11 || u > 0.89 || Math.abs(u - 0.5) < 0.03;

    const needsPower = Boolean(door.requiresPower && !powerRestored);
    const statusPulse = 0.65 + 0.35 * Math.sin(time * 4.5);
    const isDanger = door.locked || needsPower;

    const r = Math.min(
      255,
      Math.round((isFrame ? 24 : 36) * lit + redGlow * 95)
    );
    const g = Math.round((isFrame ? 36 : 52) * lit * (1 - redGlow * 0.25));
    const b = Math.round((isFrame ? 58 : 82) * lit * (1 - redGlow * 0.35));

    ctx.save();
    if (isFrame) {
      // Solid armored titanium door pillar & center seam
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, topY, w, sliceH);
    } else {
      // Solid top lintel & bottom armored threshold
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, topY, w, sliceH * 0.15);
      ctx.fillRect(x, topY + sliceH * 0.84, w, sliceH * 0.16);

      // Translucent Futuristic Cyber-Glass Center Pane
      const paneTop = topY + sliceH * 0.15;
      const paneH = sliceH * 0.69;
      ctx.fillStyle = isDanger
        ? 'rgba(127, 29, 29, 0.34)'
        : door.isOpen
          ? 'rgba(8, 145, 178, 0.22)'
          : 'rgba(14, 116, 144, 0.34)';
      ctx.fillRect(x, paneTop, w, paneH);

      // Etched laser security bars & diagonal glass glare
      if (sliceH > 28) {
        ctx.fillStyle = isDanger
          ? 'rgba(248, 113, 113, 0.32)'
          : 'rgba(103, 232, 249, 0.25)';
        ctx.fillRect(x, topY + sliceH * 0.34, w, Math.max(1.5, sliceH * 0.015));
        ctx.fillRect(x, topY + sliceH * 0.64, w, Math.max(1.5, sliceH * 0.015));

        const glareY = paneTop + (((u * 1.4) % 1) * 0.72 + 0.1) * paneH;
        ctx.fillStyle = 'rgba(224, 242, 254, 0.16)';
        ctx.fillRect(x, glareY, w, Math.max(2, sliceH * 0.035));
      }
    }

    // Glowing LED status rail along door header & center lock bar
    const ledColor = isDanger
      ? `rgba(239, 68, 68, ${(0.95 * statusPulse * fogFactor).toFixed(2)})`
      : door.isOpen
        ? `rgba(34, 211, 238, ${(0.92 * fogFactor).toFixed(2)})`
        : `rgba(56, 189, 248, ${(0.9 * fogFactor).toFixed(2)})`;

    ctx.fillStyle = ledColor;
    ctx.fillRect(x, topY + sliceH * 0.14, w, Math.max(2, sliceH * 0.025));
    if (isFrame || Math.abs(u - 0.5) < 0.08) {
      ctx.fillRect(x, topY + sliceH * 0.46, w, Math.max(3, sliceH * 0.05));
    }
    ctx.restore();
  }

  private drawSpritesPass(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizon: number,
    projDist: number,
    halfFov: number,
    stripW: number,
    numRays: number,
    time: number,
    world: StationWorldData,
    player: PlayerState,
    particles: Particle[],
    projectiles: ProjectileEntity[],
    activeBeacons: EchoBeaconEntity[],
    powerRestored: boolean,
    pass: 'FAR' | 'NEAR'
  ): void {
    const sprites: ProjectedSprite[] = [];

    for (const prop of world.props) {
      if (
        prop.kind === 'ALIEN_TRACE' ||
        prop.kind === 'WARNING_SIGN' ||
        prop.kind === 'BROKEN_CAMERA' ||
        prop.kind === 'CONTAINMENT_CHAMBER'
      ) {
        continue;
      }
      const cx = prop.x + prop.w / 2;
      const cy = prop.y + prop.h / 2;
      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < 14 || dist > 860) continue;
      sprites.push({ x: cx, y: cy, dist, kind: 'PROP', prop });
    }

    for (const terminal of world.terminals) {
      const cx = terminal.tileX * TILE_SIZE;
      const cy = terminal.tileY * TILE_SIZE;
      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < 14 || dist > 860) continue;
      sprites.push({ x: cx, y: cy, dist, kind: 'TERMINAL', terminal });
    }

    for (const pickup of world.pickups) {
      if (pickup.collected) continue;
      const cx = pickup.tileX * TILE_SIZE;
      const cy = pickup.tileY * TILE_SIZE;
      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < 12 || dist > 780) continue;
      sprites.push({ x: cx, y: cy, dist, kind: 'PICKUP', pickup });
    }

    for (const suitStation of world.suitStations) {
      const cx = suitStation.tileX * TILE_SIZE;
      const cy = suitStation.tileY * TILE_SIZE;
      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < 14 || dist > 820) continue;
      sprites.push({
        x: cx,
        y: cy,
        dist,
        kind: 'SUIT_STATION',
        suitStation,
      });
    }

    for (const hazard of world.hazards) {
      const cx = hazard.tileX * TILE_SIZE;
      const cy = hazard.tileY * TILE_SIZE;
      const dist = Math.hypot(cx - player.x, cy - player.y);
      if (dist < 10 || dist > 760) continue;
      sprites.push({ x: cx, y: cy, dist, kind: 'HAZARD', hazard });
    }

    for (const beacon of activeBeacons) {
      const dist = Math.hypot(beacon.x - player.x, beacon.y - player.y);
      if (dist < 10 || dist > 840) continue;
      sprites.push({
        x: beacon.x,
        y: beacon.y,
        dist,
        kind: 'ECHO_BEACON',
        echoBeacon: beacon,
      });
    }

    if (world.listener.active) {
      const l = world.listener;
      const dist = Math.hypot(l.x - player.x, l.y - player.y);
      if (dist >= 14 && dist <= 940) {
        sprites.push({
          x: l.x,
          y: l.y,
          dist,
          kind: 'LISTENER',
          listener: l,
        });
      }
    }

    for (const monster of world.monsters) {
      if (!monster.active || !monster.alive) continue;
      const dist = Math.hypot(monster.x - player.x, monster.y - player.y);
      if (dist < 14 || dist > 940) continue;
      sprites.push({
        x: monster.x,
        y: monster.y,
        dist,
        kind: 'MONSTER',
        monster,
      });
    }

    for (const projectile of projectiles) {
      const dist = Math.hypot(projectile.x - player.x, projectile.y - player.y);
      if (dist < 8 || dist > 860) continue;
      sprites.push({
        x: projectile.x,
        y: projectile.y,
        dist,
        kind: 'PROJECTILE',
        projectile,
      });
    }

    for (const p of particles) {
      const dist = Math.hypot(p.x - player.x, p.y - player.y);
      if (dist < 12 || dist > 560) continue;
      sprites.push({
        x: p.x,
        y: p.y,
        dist,
        kind: 'PARTICLE',
        particle: p,
      });
    }

    for (const light of world.lights) {
      if (!light.highRisk) continue;
      if (powerRestored && light.powerGroup) continue;
      const dist = Math.hypot(light.x - player.x, light.y - player.y);
      if (dist < 16 || dist > 860) continue;
      sprites.push({
        x: light.x,
        y: light.y,
        dist,
        kind: 'LIGHT_BEACON',
        light,
      });
    }

    sprites.sort((a, b) => b.dist - a.dist);

    for (const sp of sprites) {
      const ang = Math.atan2(sp.y - player.y, sp.x - player.x);
      const diff = this.normalizeAngle(ang - player.angle);
      if (Math.abs(diff) > halfFov + 0.35) continue;

      const perpDist = Math.max(12, sp.dist * Math.cos(diff));
      const screenX = w * 0.5 + Math.tan(diff) * projDist;

      let worldH = 38;
      let worldW = 34;
      let verticalAnchor = 0.5;

      if (sp.kind === 'PROP' && sp.prop) {
        if (sp.prop.kind === 'REACTOR_CORE') {
          worldH = 68;
          worldW = 86;
          verticalAnchor = 0.5;
        } else if (
          sp.prop.kind === 'BIO_TANK' ||
          sp.prop.kind === 'CRYO_POD' ||
          sp.prop.kind === 'GLASS_CONTAINER'
        ) {
          worldH = 46;
          worldW = 34;
          verticalAnchor = 0.54;
        } else if (sp.prop.kind === 'RESCUE_POD') {
          worldH = 46;
          worldW = 92;
          verticalAnchor = 0.58;
        } else if (
          sp.prop.kind === 'SERVER_RACK' ||
          sp.prop.kind === 'DAMAGED_GENERATOR'
        ) {
          worldH = 44;
          worldW = 38;
          verticalAnchor = 0.56;
        } else if (sp.prop.kind === 'HOLO_TABLE') {
          worldH = 42;
          worldW = 54;
          verticalAnchor = 0.56;
        } else if (
          sp.prop.kind === 'LAB_WORKSTATION' ||
          sp.prop.kind === 'BRIDGE_CONSOLE' ||
          sp.prop.kind === 'DESK'
        ) {
          worldH = 34;
          worldW = 52;
          verticalAnchor = 0.64;
        } else {
          worldH = 26;
          worldW = 42;
          verticalAnchor = 0.72;
        }
      } else if (sp.kind === 'TERMINAL') {
        worldH = 36;
        worldW = 28;
        verticalAnchor = 0.62;
      } else if (sp.kind === 'PICKUP') {
        worldH = 16;
        worldW = 20;
        verticalAnchor = 0.66 + Math.sin(time * 3.5) * 0.04;
      } else if (sp.kind === 'SUIT_STATION') {
        worldH = 38;
        worldW = 28;
        verticalAnchor = 0.58;
      } else if (sp.kind === 'HAZARD') {
        worldH = 34;
        worldW = 54;
        verticalAnchor = 0.74;
      } else if (sp.kind === 'ECHO_BEACON') {
        worldH = 24;
        worldW = 34;
        verticalAnchor = 0.7;
      } else if (sp.kind === 'LISTENER') {
        worldH = 48;
        worldW = 40;
        verticalAnchor = 0.52;
      } else if (sp.kind === 'MONSTER' && sp.monster) {
        if (sp.monster.tier === 'BOSS') {
          worldH = 56;
          worldW = 50;
          verticalAnchor = 0.52;
        } else if (sp.monster.archetype === 'SKITTERER') {
          worldH = 26;
          worldW = 36;
          verticalAnchor = 0.72;
        } else if (sp.monster.archetype === 'ACID_SPITTER') {
          worldH = 38;
          worldW = 34;
          verticalAnchor = 0.58;
        } else if (sp.monster.archetype === 'VOID_STALKER') {
          worldH = 48;
          worldW = 38;
          verticalAnchor = 0.52;
        } else {
          worldH = 44;
          worldW = 38;
          verticalAnchor = 0.54;
        }
      } else if (sp.kind === 'PROJECTILE') {
        worldH = 10;
        worldW = 10;
        verticalAnchor = 0.45;
      } else if (sp.kind === 'PARTICLE' && sp.particle) {
        const s = sp.particle.kind === 'SMOKE' ? 14 : 4;
        worldH = s;
        worldW = s;
        verticalAnchor =
          sp.particle.kind === 'SMOKE'
            ? 0.48 - (sp.particle.life / sp.particle.maxLife) * 0.25
            : 0.35 + ((Math.round(sp.particle.maxLife * 17) % 10) / 10) * 0.35;
      } else if (sp.kind === 'LIGHT_BEACON') {
        worldH = 28;
        worldW = 28;
        verticalAnchor = 0.04;
      }

      const spriteH = (worldH / perpDist) * projDist;
      const spriteW = (worldW / perpDist) * projDist;
      const startX = screenX - spriteW / 2;
      const endX = screenX + spriteW / 2;
      const topY = horizon - spriteH * (1 - verticalAnchor) + spriteH * 0.25;

      const colStart = Math.max(0, Math.floor(startX / stripW));
      const colEnd = Math.min(numRays - 1, Math.floor(endX / stripW));

      let visibleCols = 0;
      for (let c = colStart; c <= colEnd; c++) {
        if (perpDist > this.zBuffer[c] + 1) continue;
        const dh = this.doorHits[c];
        const isBehindDoor = dh ? perpDist > dh.dist + 1 : false;
        if (pass === 'FAR' && !isBehindDoor) continue;
        if (pass === 'NEAR' && isBehindDoor) continue;
        visibleCols++;
      }
      if (visibleCols === 0) continue;

      const fogFactor = Math.exp(-perpDist * 0.0017);
      const alphaVis =
        sp.kind === 'MONSTER' ||
        sp.kind === 'LISTENER' ||
        sp.kind === 'PROJECTILE' ||
        sp.kind === 'ECHO_BEACON'
          ? Math.max(0.55, fogFactor)
          : Math.max(0.28, fogFactor);

      ctx.save();
      ctx.beginPath();
      for (let c = colStart; c <= colEnd; c++) {
        if (perpDist > this.zBuffer[c] + 1) continue;
        const dh = this.doorHits[c];
        const isBehindDoor = dh ? perpDist > dh.dist + 1 : false;
        if (pass === 'FAR' && !isBehindDoor) continue;
        if (pass === 'NEAR' && isBehindDoor) continue;
        ctx.rect(c * stripW, 0, stripW + 0.5, h);
      }
      ctx.clip();
      ctx.globalAlpha = alphaVis;

      this.drawSpriteGraphic(
        ctx,
        sp,
        screenX,
        topY,
        spriteW,
        spriteH,
        time,
        powerRestored
      );
      ctx.restore();
    }
  }

  private drawVolumetricShafts(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizon: number,
    projDist: number,
    halfFov: number,
    stripW: number,
    numRays: number,
    time: number,
    world: StationWorldData,
    player: PlayerState,
    powerRestored: boolean
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const light of world.lights) {
      const dist = Math.hypot(light.x - player.x, light.y - player.y);
      if (dist < 40 || dist > 620) continue;

      const ang = Math.atan2(light.y - player.y, light.x - player.x);
      const diff = this.normalizeAngle(ang - player.angle);
      if (Math.abs(diff) > halfFov + 0.25) continue;

      const perpDist = Math.max(24, dist * Math.cos(diff));
      const col = Math.floor((w * 0.5 + Math.tan(diff) * projDist) / stripW);
      if (col >= 0 && col < numRays && perpDist > this.zBuffer[col] + 4) {
        continue;
      }

      const screenX = w * 0.5 + Math.tan(diff) * projDist;
      const topH = (TILE_SIZE / perpDist) * projDist;
      const shaftTop = horizon - topH * 0.5;
      const shaftBottom = horizon + topH * 0.5;
      const shaftW = (44 / perpDist) * projDist;

      const isPowerConverted = Boolean(powerRestored && light.powerGroup);
      const isRed = Boolean(light.highRisk && !isPowerConverted);
      const pulse =
        light.mode === 'static'
          ? 0.9
          : 0.4 + 0.6 * Math.sin(time * (light.speed ?? 2.5) + (light.phase ?? 0));

      const grad = ctx.createLinearGradient(0, shaftTop, 0, shaftBottom);
      if (isRed) {
        grad.addColorStop(0, `rgba(239, 68, 68, ${(0.18 * pulse).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else {
        grad.addColorStop(0, `rgba(34, 211, 238, ${(0.12 * pulse).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(screenX - shaftW * 0.35, shaftTop);
      ctx.lineTo(screenX + shaftW * 0.35, shaftTop);
      ctx.lineTo(screenX + shaftW * 1.15, shaftBottom);
      ctx.lineTo(screenX - shaftW * 1.15, shaftBottom);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSpriteGraphic(
    ctx: CanvasRenderingContext2D,
    sp: ProjectedSprite,
    cx: number,
    topY: number,
    w: number,
    h: number,
    time: number,
    powerRestored: boolean
  ): void {
    const x = cx - w / 2;

    if (sp.kind === 'PARTICLE' && sp.particle) {
      const p = sp.particle;
      const fade = 1 - p.life / p.maxLife;
      ctx.globalAlpha *= p.alpha * fade;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx, topY + h * 0.5, Math.max(1.2, w * 0.5), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (sp.kind === 'PICKUP' && sp.pickup) {
      const glow = 0.65 + 0.35 * Math.sin(time * 4);
      const pGrad = ctx.createRadialGradient(
        cx,
        topY + h * 0.5,
        0,
        cx,
        topY + h * 0.5,
        w
      );
      pGrad.addColorStop(0, sp.pickup.color);
      pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGrad;
      ctx.globalAlpha *= 0.45 * glow;
      ctx.beginPath();
      ctx.arc(cx, topY + h * 0.5, w, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, ctx.globalAlpha / (0.45 * glow));

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, topY, w, h);
      ctx.strokeStyle = sp.pickup.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, topY, w, h);
      ctx.fillStyle = sp.pickup.color;
      ctx.fillRect(x + w * 0.16, topY + h * 0.25, w * 0.28, h * 0.5);
      return;
    }

    if (sp.kind === 'TERMINAL' && sp.terminal) {
      const color =
        sp.terminal.actionType === 'RESTORE_POWER' && !powerRestored
          ? '#f59e0b'
          : sp.terminal.activated
            ? '#34d399'
            : '#22d3ee';

      // Floor reflection pool
      ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.beginPath();
      ctx.ellipse(cx, topY + h * 0.96, w * 0.65, h * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pedestal
      ctx.fillStyle = '#182438';
      ctx.fillRect(x + w * 0.18, topY + h * 0.44, w * 0.64, h * 0.54);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + w * 0.18, topY + h * 0.44, w * 0.64, h * 0.54);

      // Angled holographic kiosk bezel
      ctx.fillStyle = '#09111f';
      ctx.fillRect(x, topY, w, h * 0.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x, topY, w, h * 0.5);

      // Illuminated readout display
      ctx.fillStyle = color;
      ctx.fillRect(x + w * 0.12, topY + h * 0.08, w * 0.76, h * 0.34);
      ctx.fillStyle = '#07111e';
      ctx.fillRect(x + w * 0.18, topY + h * 0.16, w * 0.64, h * 0.04);
      ctx.fillRect(x + w * 0.18, topY + h * 0.26, w * 0.44, h * 0.04);
      return;
    }

    if (sp.kind === 'SUIT_STATION') {
      ctx.fillStyle = '#132238';
      ctx.fillRect(x, topY, w, h);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, topY, w, h);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.fillRect(x + w * 0.14, topY + h * 0.12, w * 0.72, h * 0.76);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(cx - w * 0.22, topY + h * 0.38, w * 0.44, h * 0.1);
      ctx.fillRect(cx - w * 0.07, topY + h * 0.24, w * 0.14, h * 0.38);
      return;
    }

    if (sp.kind === 'LIGHT_BEACON' && sp.light) {
      const speed = sp.light.speed ?? 3;
      const phase = sp.light.phase ?? 0;
      const pulse =
        0.2 +
        0.8 * Math.pow(0.5 + 0.5 * Math.sin(time * speed + phase), 1.8);
      const cy = topY + h * 0.35;

      const haloR = w * (1.25 + pulse * 0.95);
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      halo.addColorStop(0, `rgba(239, 68, 68, ${(0.9 * pulse).toFixed(2)})`);
      halo.addColorStop(
        0.45,
        `rgba(239, 68, 68, ${(0.34 * pulse).toFixed(2)})`
      );
      halo.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cx - w * 0.18, cy - h * 0.25, w * 0.36, h * 0.2);
      ctx.fillStyle = `rgba(254, 202, 202, ${pulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, w * 0.16), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (sp.kind === 'HAZARD' && sp.hazard) {
      const haz = sp.hazard;
      if (haz.stabilizedByPower && powerRestored) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
        ctx.beginPath();
        ctx.ellipse(cx, topY + h * 0.8, w * 0.45, h * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (haz.kind === 'ELECTRIC_ARC') {
        const spark = Math.sin(time * 18 + cx) > -0.2;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.beginPath();
        ctx.ellipse(
          cx,
          topY + h * 0.85,
          w * 0.5,
          h * 0.16,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (spark) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + w * 0.2, topY + h * 0.85);
          ctx.lineTo(cx - w * 0.1, topY + h * 0.35);
          ctx.lineTo(cx + w * 0.12, topY + h * 0.55);
          ctx.lineTo(x + w * 0.8, topY + h * 0.18);
          ctx.stroke();
        }
      } else if (haz.kind === 'CRYO_LEAK') {
        const puff = 0.6 + 0.4 * Math.sin(time * 3 + cx);
        ctx.fillStyle = `rgba(125, 211, 252, ${(0.35 * puff).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(cx - w * 0.15, topY + h * 0.65, w * 0.28, 0, Math.PI * 2);
        ctx.arc(cx + w * 0.15, topY + h * 0.52, w * 0.24, 0, Math.PI * 2);
        ctx.fill();
      } else if (haz.kind === 'PLASMA_VENT') {
        const flare = 0.6 + 0.4 * Math.sin(time * 7 + cx);
        ctx.fillStyle = `rgba(239, 68, 68, ${(0.45 * flare).toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.15, topY + h * 0.9);
        ctx.lineTo(cx, topY + h * (0.1 + 0.2 * (1 - flare)));
        ctx.lineTo(x + w * 0.85, topY + h * 0.9);
        ctx.closePath();
        ctx.fill();
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(time * 3.5);
        ctx.fillStyle = `rgba(16, 185, 129, ${(0.28 * pulse).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(cx, topY + h * 0.6, w * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (sp.kind === 'ECHO_BEACON') {
      const pulse = 0.55 + 0.45 * Math.sin(time * 8);
      ctx.strokeStyle = `rgba(34, 211, 238, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, topY + h * 0.72, w * 0.65, h * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(cx, topY + h * 0.62, Math.max(3, w * 0.18), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (sp.kind === 'LISTENER' && sp.listener) {
      const l = sp.listener;
      const stateColor =
        l.state === 'HUNTING'
          ? '#ef4444'
          : l.state === 'INVESTIGATING' || l.state === 'SEARCHING'
            ? '#f59e0b'
            : l.state === 'STAGGERED'
              ? '#64748b'
              : '#c084fc';
      const bob = Math.sin(time * 6) * h * 0.03;
      const dy = topY + bob;

      ctx.fillStyle = 'rgba(168, 85, 247, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, topY + h * 0.94, w * 0.44, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#231338';
      ctx.fillRect(x + w * 0.26, dy + h * 0.22, w * 0.48, h * 0.62);
      ctx.strokeStyle = stateColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + w * 0.26, dy + h * 0.22, w * 0.48, h * 0.62);

      ctx.fillStyle = stateColor;
      ctx.beginPath();
      ctx.arc(cx, dy + h * 0.16, w * 0.2, 0, Math.PI * 2);
      ctx.fill();

      if (l.hitFlash > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(l.hitFlash * 0.5).toFixed(2)})`;
        ctx.fillRect(x + w * 0.2, dy + h * 0.1, w * 0.6, h * 0.78);
      }

      if (l.hp < l.maxHp || l.state === 'STAGGERED') {
        const barW = Math.max(26, w * 0.72);
        const barH = Math.max(4, h * 0.04);
        const barX = cx - barW * 0.5;
        const barY = Math.max(6, dy - barH - 6);
        ctx.fillStyle = 'rgba(2, 6, 16, 0.85)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = stateColor;
        ctx.fillRect(barX, barY, barW * Math.max(0, l.hp / l.maxHp), barH);
      }
      return;
    }

    if (sp.kind === 'PROJECTILE' && sp.projectile) {
      const p = sp.projectile;
      const py = topY + h * 0.5;
      const r = Math.max(3, w * 0.5);
      if (p.kind === 'MINING_LASER') {
        const glow = ctx.createRadialGradient(cx, py, 0, cx, py, r * 2.4);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.28, '#67e8f9');
        glow.addColorStop(0.65, 'rgba(34, 211, 238, 0.55)');
        glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, py, r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Focused plasma beam flare cross
        ctx.strokeStyle = 'rgba(165, 243, 252, 0.9)';
        ctx.lineWidth = Math.max(1.5, r * 0.45);
        ctx.beginPath();
        ctx.moveTo(cx - r * 2.2, py);
        ctx.lineTo(cx + r * 2.2, py);
        ctx.stroke();
      } else {
        const glow = ctx.createRadialGradient(cx, py, 0, cx, py, r * 1.9);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.4, p.color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, py, r * 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (sp.kind === 'MONSTER' && sp.monster) {
      const m = sp.monster;
      const isWindup = m.aiState === 'WINDUP';
      const isLunging = m.aiState === 'LUNGING';
      const bobSpeed = isLunging ? 16 : isWindup ? 14 : m.tier === 'BOSS' ? 6 : 8;
      const bob = Math.sin(time * bobSpeed + m.patrolPhase) * h * (isWindup ? 0.04 : 0.028);
      const scaleBoost = isLunging ? 1.12 : isWindup ? 1.05 : 1.0;
      const dw = w * scaleBoost;
      const dh = h * scaleBoost;
      const dx = cx - dw * 0.5;
      const drawY = topY + bob - (dh - h) * 0.5;

      // Grounded threat aura / telegraph glow
      const auraColor =
        isWindup || isLunging
          ? 'rgba(239, 68, 68, 0.55)'
          : m.archetype === 'ACID_SPITTER'
            ? 'rgba(74, 222, 128, 0.32)'
            : m.archetype === 'VOID_STALKER'
              ? 'rgba(192, 132, 252, 0.34)'
              : m.tier === 'BOSS'
                ? 'rgba(239, 68, 68, 0.38)'
                : 'rgba(245, 158, 11, 0.28)';
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.ellipse(cx, topY + h * 0.94, dw * 0.46, dh * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();

      if (m.tier === 'BOSS') {
        const sprite = bossSpriteLoader.getSprite();
        if (sprite && sprite.width > 0) {
          const aspect = sprite.width / sprite.height;
          const sprH = dh;
          const sprW = sprH * aspect;
          ctx.drawImage(sprite, cx - sprW * 0.5, drawY, sprW, sprH);
        } else {
          this.drawFallbackCreature(ctx, cx, drawY, dw, dh, true, time);
        }
      } else if (m.archetype === 'SENTINEL') {
        const sprite = sentinelSpriteLoader.getSprite();
        if (sprite && sprite.width > 0) {
          const aspect = sprite.width / sprite.height;
          const sprH = dh;
          const sprW = sprH * aspect;
          ctx.drawImage(sprite, cx - sprW * 0.5, drawY, sprW, sprH);
        } else {
          this.drawFallbackCreature(ctx, cx, drawY, dw, dh, false, time);
        }
      } else if (m.archetype === 'SKITTERER') {
        this.drawSkitterer3D(ctx, cx, drawY, dw, dh, time, isWindup || isLunging);
      } else if (m.archetype === 'ACID_SPITTER') {
        this.drawAcidSpitter3D(ctx, cx, drawY, dw, dh, time, isWindup);
      } else if (m.archetype === 'VOID_STALKER') {
        this.drawVoidStalker3D(ctx, cx, drawY, dw, dh, time, isWindup || isLunging);
      } else {
        this.drawFallbackCreature(ctx, cx, drawY, dw, dh, false, time);
      }

      // Telegraph flash during attack windup or lunge
      if (isWindup) {
        const flash = 0.45 + 0.45 * Math.sin(time * 24);
        ctx.strokeStyle =
          m.archetype === 'ACID_SPITTER'
            ? `rgba(74, 222, 128, ${flash.toFixed(2)})`
            : `rgba(239, 68, 68, ${flash.toFixed(2)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cx, drawY + dh * 0.45, dw * 0.48, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (m.hitFlash > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(m.hitFlash * 0.45).toFixed(2)})`;
        ctx.fillRect(dx + dw * 0.15, drawY + dh * 0.08, dw * 0.7, dh * 0.8);
      }

      const barW = Math.max(26, dw * 0.78);
      const barH = Math.max(3.5, dh * 0.055);
      const barX = cx - barW * 0.5;
      const barY = Math.max(6, drawY - barH - 6);
      const hpRatio = Math.max(0, Math.min(1, m.hp / m.maxHp));

      ctx.fillStyle = 'rgba(2, 6, 16, 0.85)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle =
        m.tier === 'BOSS'
          ? '#ef4444'
          : m.archetype === 'ACID_SPITTER'
            ? '#4ade80'
            : m.archetype === 'VOID_STALKER'
              ? '#c084fc'
              : '#f59e0b';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      return;
    }

    if (sp.kind === 'PROP' && sp.prop) {
      const k = sp.prop.kind;

      // Grounded contact shadow under all 3D machinery
      ctx.fillStyle = 'rgba(2, 6, 18, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, topY + h * 0.97, w * 0.52, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      if (k === 'BIO_TANK' || k === 'GLASS_CONTAINER') {
        // Pressurized Cylindrical Stasis Vat + Metallic Caps + Bioluminescent Fluid
        const gGrad = ctx.createLinearGradient(x, topY, x + w, topY);
        gGrad.addColorStop(0, '#072438');
        gGrad.addColorStop(0.35, 'rgba(34, 211, 238, 0.45)');
        gGrad.addColorStop(0.75, 'rgba(14, 165, 233, 0.35)');
        gGrad.addColorStop(1, '#072438');
        ctx.fillStyle = gGrad;
        ctx.fillRect(x + w * 0.08, topY + h * 0.14, w * 0.84, h * 0.72);

        // Suspended floating specimen silhouette + bubbles
        const floatY = topY + h * (0.48 + Math.sin(time * 2 + cx) * 0.04);
        ctx.fillStyle = 'rgba(165, 243, 252, 0.55)';
        ctx.beginPath();
        ctx.ellipse(cx, floatY, w * 0.14, h * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Top & bottom titanium end-caps
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, topY, w, h * 0.15);
        ctx.fillRect(x, topY + h * 0.85, w, h * 0.15);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x + w * 0.08, topY + h * 0.14, w * 0.84, h * 0.72);

        // Specular glass highlight streak
        ctx.fillStyle = 'rgba(224, 242, 254, 0.25)';
        ctx.fillRect(x + w * 0.18, topY + h * 0.18, w * 0.1, h * 0.64);
      } else if (k === 'REACTOR_CORE') {
        const coreColor = powerRestored ? '#22d3ee' : '#ef4444';
        const pulse = 0.65 + 0.35 * Math.sin(time * (powerRestored ? 4 : 6));

        // Plinth & upper crown
        ctx.fillStyle = '#141e30';
        ctx.fillRect(x + w * 0.1, topY, w * 0.8, h * 0.18);
        ctx.fillRect(x + w * 0.05, topY + h * 0.82, w * 0.9, h * 0.18);

        // Glowing central plasma column
        const beamGrad = ctx.createLinearGradient(x + w * 0.2, 0, x + w * 0.8, 0);
        beamGrad.addColorStop(0, 'rgba(0,0,0,0)');
        beamGrad.addColorStop(0.5, coreColor);
        beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(x + w * 0.18, topY + h * 0.16, w * 0.64, h * 0.68);

        // Rotating magnetic containment rings
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2.5;
        for (let r = 0; r < 3; r++) {
          const ry = topY + h * (0.3 + r * 0.2) + Math.sin(time * 3 + r) * h * 0.02;
          ctx.beginPath();
          ctx.ellipse(cx, ry, w * 0.44, h * 0.07, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = coreColor;
        ctx.globalAlpha *= pulse;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + w * 0.12, topY + h * 0.15, w * 0.76, h * 0.7);
      } else if (k === 'CRYO_POD') {
        ctx.fillStyle = '#162236';
        ctx.fillRect(x, topY, w, h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, topY, w, h);
        const accent = sp.prop.accentColor || '#38bdf8';
        ctx.fillStyle = accent;
        ctx.globalAlpha *= 0.42;
        ctx.fillRect(x + w * 0.16, topY + h * 0.12, w * 0.68, h * 0.7);
        ctx.globalAlpha /= 0.42;
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(x + w * 0.24, topY + h * 0.16, w * 0.08, h * 0.56);
      } else if (k === 'HOLO_TABLE') {
        // Metallic holo pedestal
        ctx.fillStyle = '#152236';
        ctx.fillRect(x + w * 0.1, topY + h * 0.55, w * 0.8, h * 0.42);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x + w * 0.1, topY + h * 0.55, w * 0.8, h * 0.42);

        // Projected rotating 3D cyan holographic station model above table
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.88)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          topY + h * 0.3,
          w * 0.42,
          h * 0.16,
          Math.sin(time * 0.8) * 0.25,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.beginPath();
        ctx.arc(cx, topY + h * 0.28, w * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (
        k === 'LAB_WORKSTATION' ||
        k === 'BRIDGE_CONSOLE' ||
        k === 'DESK'
      ) {
        // Futuristic Dual-Screen Console / Workstation
        ctx.fillStyle = '#152033';
        ctx.fillRect(x, topY + h * 0.46, w, h * 0.52);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, topY + h * 0.46, w, h * 0.52);

        // Glowing twin holographic displays mounted on desk
        const accent = sp.prop.accentColor || '#22d3ee';
        ctx.fillStyle = '#07101f';
        ctx.fillRect(x + w * 0.08, topY + h * 0.08, w * 0.38, h * 0.34);
        ctx.fillRect(x + w * 0.54, topY + h * 0.08, w * 0.38, h * 0.34);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x + w * 0.08, topY + h * 0.08, w * 0.38, h * 0.34);
        ctx.strokeRect(x + w * 0.54, topY + h * 0.08, w * 0.38, h * 0.34);

        ctx.fillStyle = accent;
        ctx.fillRect(x + w * 0.13, topY + h * 0.16, w * 0.24, h * 0.05);
        ctx.fillRect(x + w * 0.59, topY + h * 0.16, w * 0.24, h * 0.05);
        ctx.fillRect(x + w * 0.1, topY + h * 0.54, w * 0.8, h * 0.04);
      } else if (k === 'SERVER_RACK') {
        ctx.fillStyle = '#111a2b';
        ctx.fillRect(x, topY, w, h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x, topY, w, h);
        // Server blades + animated LED telemetry matrix
        for (let row = 0; row < 5; row++) {
          const sy = topY + h * (0.1 + row * 0.17);
          ctx.fillStyle = '#090e18';
          ctx.fillRect(x + w * 0.12, sy, w * 0.76, h * 0.11);
          const on = Math.sin(time * 5 + row * 1.9 + cx) > 0;
          ctx.fillStyle = on ? '#22d3ee' : '#ef4444';
          ctx.fillRect(x + w * 0.16, sy + h * 0.03, w * 0.14, h * 0.04);
        }
      } else if (k === 'RESCUE_POD') {
        // Docked Spacecraft Shuttle Hull + Cyan Cockpit Canopy
        ctx.fillStyle = '#1c283d';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.08, topY + h * 0.9);
        ctx.lineTo(x + w * 0.2, topY + h * 0.18);
        ctx.lineTo(x + w * 0.8, topY + h * 0.18);
        ctx.lineTo(x + w * 0.92, topY + h * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.52)';
        ctx.fillRect(x + w * 0.28, topY + h * 0.28, w * 0.44, h * 0.26);
      } else if (k === 'DAMAGED_GENERATOR') {
        ctx.fillStyle = '#182133';
        ctx.fillRect(x, topY, w, h);
        ctx.strokeStyle = sp.prop.accentColor || '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, topY, w, h);
        const arc = Math.sin(time * 14 + cx) > 0;
        ctx.fillStyle = arc ? '#f59e0b' : '#38bdf8';
        ctx.fillRect(x + w * 0.18, topY + h * 0.36, w * 0.64, h * 0.14);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + w * 0.18, topY + h * 0.62, w * 0.64, h * 0.08);
      } else {
        // Cargo Crates, Equipment Cases & Panels with recessed bevels
        ctx.fillStyle = '#1a2538';
        ctx.fillRect(x, topY, w, h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, topY, w, h);
        ctx.fillStyle = sp.prop.accentColor || '#22d3ee';
        ctx.fillRect(x + w * 0.14, topY + h * 0.18, w * 0.72, h * 0.1);
      }
    }
  }

  private drawSkitterer3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number,
    w: number,
    h: number,
    time: number,
    attacking: boolean
  ): void {
    const x = cx - w * 0.5;
    const scuttle = Math.sin(time * (attacking ? 22 : 12)) * h * 0.08;

    // Six jointed chitinous spider legs
    ctx.strokeStyle = attacking ? '#ef4444' : '#9a3412';
    ctx.lineWidth = Math.max(1.8, w * 0.055);
    for (let i = 0; i < 3; i++) {
      const sideLift = (i % 2 === 0 ? 1 : -1) * scuttle;
      const ly = topY + h * (0.42 + i * 0.14);
      // Left leg
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.18, ly);
      ctx.lineTo(x + w * 0.05, ly - h * 0.18 + sideLift);
      ctx.lineTo(x, topY + h * 0.94);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.18, ly);
      ctx.lineTo(x + w * 0.95, ly - h * 0.18 - sideLift);
      ctx.lineTo(x + w, topY + h * 0.94);
      ctx.stroke();
    }

    // Armored carapace thorax
    ctx.fillStyle = '#291518';
    ctx.beginPath();
    ctx.ellipse(cx, topY + h * 0.54, w * 0.28, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = attacking ? '#f87171' : '#ea580c';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Glowing mandibles + 4 predatory eyes
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.14, topY + h * 0.65);
    ctx.lineTo(cx - w * 0.06, topY + h * 0.9);
    ctx.lineTo(cx - w * 0.02, topY + h * 0.68);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.14, topY + h * 0.65);
    ctx.lineTo(cx + w * 0.06, topY + h * 0.9);
    ctx.lineTo(cx + w * 0.02, topY + h * 0.68);
    ctx.fill();

    ctx.fillStyle = attacking ? '#ef4444' : '#f59e0b';
    ctx.fillRect(cx - w * 0.12, topY + h * 0.44, w * 0.06, h * 0.07);
    ctx.fillRect(cx + w * 0.06, topY + h * 0.44, w * 0.06, h * 0.07);
    ctx.fillRect(cx - w * 0.06, topY + h * 0.36, w * 0.04, h * 0.05);
    ctx.fillRect(cx + w * 0.02, topY + h * 0.36, w * 0.04, h * 0.05);
  }

  private drawAcidSpitter3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number,
    w: number,
    h: number,
    time: number,
    windup: boolean
  ): void {
    const x = cx - w * 0.5;
    const pulse = 0.65 + 0.35 * Math.sin(time * (windup ? 16 : 5));

    // Hind legs
    ctx.fillStyle = '#14291d';
    ctx.fillRect(x + w * 0.24, topY + h * 0.68, w * 0.14, h * 0.28);
    ctx.fillRect(x + w * 0.62, topY + h * 0.68, w * 0.14, h * 0.28);

    // Pulsing toxic bioluminescent acid sac thorax
    ctx.fillStyle = `rgba(74, 222, 128, ${(0.35 + 0.4 * pulse).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(cx, topY + h * 0.5, w * 0.32, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hunched cranial jaw & splayed bio-spines
    ctx.fillStyle = '#0f291e';
    ctx.beginPath();
    ctx.arc(cx, topY + h * 0.28, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Glowing acid maw & compound eyes
    ctx.fillStyle = windup ? '#bbf7d0' : '#4ade80';
    ctx.beginPath();
    ctx.arc(cx, topY + h * 0.34, w * (windup ? 0.11 : 0.07), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - w * 0.13, topY + h * 0.22, w * 0.07, h * 0.04);
    ctx.fillRect(cx + w * 0.06, topY + h * 0.22, w * 0.07, h * 0.04);
  }

  private drawVoidStalker3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number,
    w: number,
    h: number,
    time: number,
    attacking: boolean
  ): void {
    const x = cx - w * 0.5;
    const clawSwing = Math.sin(time * (attacking ? 18 : 6)) * h * 0.05;

    // Slender dark-violet legs
    ctx.fillStyle = '#181026';
    ctx.fillRect(x + w * 0.28, topY + h * 0.62, w * 0.14, h * 0.34);
    ctx.fillRect(x + w * 0.58, topY + h * 0.62, w * 0.14, h * 0.34);

    // Ribbed xenomorph-style torso
    ctx.fillStyle = '#221338';
    ctx.beginPath();
    ctx.ellipse(cx, topY + h * 0.44, w * 0.24, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = attacking ? '#f43f5e' : '#a855f7';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Twin scythe claw forearms
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, topY + h * 0.36);
    ctx.lineTo(x + w * 0.04, topY + h * 0.58 + clawSwing);
    ctx.lineTo(x + w * 0.14, topY + h * 0.8 + clawSwing);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.22, topY + h * 0.36);
    ctx.lineTo(x + w * 0.96, topY + h * 0.58 - clawSwing);
    ctx.lineTo(x + w * 0.86, topY + h * 0.8 - clawSwing);
    ctx.stroke();

    // Horned crest head + glowing crimson-violet eyes
    ctx.fillStyle = '#140b24';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, topY + h * 0.12);
    ctx.lineTo(cx, topY + h * 0.02);
    ctx.lineTo(cx + w * 0.2, topY + h * 0.12);
    ctx.lineTo(cx + w * 0.14, topY + h * 0.28);
    ctx.lineTo(cx - w * 0.14, topY + h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = attacking ? '#ef4444' : '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = attacking ? '#ef4444' : '#e879f9';
    ctx.fillRect(cx - w * 0.09, topY + h * 0.17, w * 0.06, h * 0.035);
    ctx.fillRect(cx + w * 0.03, topY + h * 0.17, w * 0.06, h * 0.035);
  }

  private drawFallbackCreature(
    ctx: CanvasRenderingContext2D,
    cx: number,
    topY: number,
    w: number,
    h: number,
    isBoss: boolean,
    time: number
  ): void {
    const x = cx - w * 0.5;
    ctx.fillStyle = '#291f24';
    ctx.fillRect(x + w * 0.24, topY + h * 0.64, w * 0.18, h * 0.32);
    ctx.fillRect(x + w * 0.58, topY + h * 0.64, w * 0.18, h * 0.32);

    ctx.fillStyle = isBoss ? '#3b2429' : '#2a222b';
    ctx.fillRect(x + w * 0.22, topY + h * 0.24, w * 0.56, h * 0.44);
    ctx.strokeStyle = isBoss ? '#ef4444' : '#b45309';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + w * 0.22, topY + h * 0.24, w * 0.56, h * 0.44);

    ctx.fillStyle = '#161b26';
    ctx.fillRect(x + w * 0.08, topY + h * 0.22, w * 0.18, h * 0.18);
    ctx.fillRect(x + w * 0.74, topY + h * 0.22, w * 0.18, h * 0.18);

    ctx.fillStyle = '#33282e';
    ctx.fillRect(x + w * 0.06, topY + h * 0.38, w * 0.14, h * 0.26);
    ctx.fillRect(x + w * 0.8, topY + h * 0.38, w * 0.14, h * 0.26);
    ctx.fillStyle = '#e7dcc8';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, topY + h * 0.62);
    ctx.lineTo(x + w * 0.05, topY + h * 0.86);
    ctx.lineTo(x + w * 0.16, topY + h * 0.66);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.9, topY + h * 0.62);
    ctx.lineTo(x + w * 0.95, topY + h * 0.86);
    ctx.lineTo(x + w * 0.84, topY + h * 0.66);
    ctx.fill();

    ctx.fillStyle = isBoss ? '#5b2833' : '#3d2830';
    ctx.beginPath();
    ctx.arc(cx, topY + h * 0.16, w * 0.16, 0, Math.PI * 2);
    ctx.fill();

    const eyeGlow = 0.7 + 0.3 * Math.sin(time * 8);
    ctx.fillStyle = `rgba(248, 113, 113, ${eyeGlow.toFixed(2)})`;
    ctx.fillRect(cx - w * 0.08, topY + h * 0.14, w * 0.05, h * 0.03);
    ctx.fillRect(cx + w * 0.03, topY + h * 0.14, w * 0.05, h * 0.03);
  }

  private drawVisorOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number,
    player: PlayerState,
    nearby: NearbyInteractable | null,
    activeHazardLabel: string | null,
    showVisorCrosshair: boolean
  ): void {
    const vig = ctx.createRadialGradient(
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.35,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.74
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(2, 6, 16, 0.56)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    const dangerIntensity = Math.max(
      player.damageFlash,
      activeHazardLabel ? 0.35 + 0.15 * Math.sin(time * 8) : 0,
      player.suitIntegrity < 30 ? 0.28 : 0
    );
    if (dangerIntensity > 0.02) {
      const dmgVig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.25,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.65
      );
      dmgVig.addColorStop(0, 'rgba(220, 38, 38, 0)');
      dmgVig.addColorStop(
        1,
        `rgba(220, 38, 38, ${Math.min(0.65, dangerIntensity * 0.6).toFixed(2)})`
      );
      ctx.fillStyle = dmgVig;
      ctx.fillRect(0, 0, w, h);
    }

    if (!showVisorCrosshair) return;

    // Bottom-right MK-IV Industrial Mining Laser Cutter viewmodel
    const cx = w * 0.5;
    const cy = h * 0.5;
    const recoil = player.muzzleFlash * 9;
    const bob = Math.sin(player.walkCycle * 0.9) * 2.5;
    const gx = w * 0.7 + recoil * 0.45;
    const gy = h - 88 + recoil + bob;
    const heatRatio = Math.max(0, Math.min(1, player.laserHeat / 100));
    const heatColor = player.laserOverheated
      ? '#ef4444'
      : heatRatio > 0.7
        ? '#f59e0b'
        : '#22d3ee';

    ctx.save();
    // Focused beam flash toward center reticle on discharge
    if (player.muzzleFlash > 0.15) {
      ctx.strokeStyle = `rgba(34, 211, 238, ${(player.muzzleFlash * 0.55).toFixed(2)})`;
      ctx.lineWidth = 6 * player.muzzleFlash;
      ctx.beginPath();
      ctx.moveTo(gx + 34, gy - 6);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${(player.muzzleFlash * 0.85).toFixed(2)})`;
      ctx.lineWidth = 2 * player.muzzleFlash;
      ctx.beginPath();
      ctx.moveTo(gx + 34, gy - 6);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }

    // Main titanium cutter housing
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx - 6, gy + 94);
    ctx.lineTo(gx + 18, gy + 6);
    ctx.lineTo(gx + 70, gy + 12);
    ctx.lineTo(gx + 96, gy + 94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Industrial yellow mining frame trim
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(gx + 14, gy + 18);
    ctx.lineTo(gx + 68, gy + 24);
    ctx.lineTo(gx + 72, gy + 38);
    ctx.lineTo(gx + 10, gy + 32);
    ctx.closePath();
    ctx.fill();

    // Twin focusing prongs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(gx + 20, gy - 8, 9, 18);
    ctx.fillRect(gx + 44, gy - 5, 9, 18);
    ctx.fillStyle = heatColor;
    ctx.fillRect(gx + 22, gy - 10, 5, 5);
    ctx.fillRect(gx + 46, gy - 7, 5, 5);

    // Live thermal heat gauge on weapon chassis
    ctx.fillStyle = '#020617';
    ctx.fillRect(gx + 24, gy + 44, 42, 8);
    ctx.fillStyle = heatColor;
    ctx.fillRect(gx + 25, gy + 45, 40 * heatRatio, 6);

    if (player.muzzleFlash > 0.05) {
      const mf = ctx.createRadialGradient(
        gx + 36,
        gy - 10,
        2,
        gx + 36,
        gy - 10,
        42 * player.muzzleFlash
      );
      mf.addColorStop(0, 'rgba(255,255,255,0.95)');
      mf.addColorStop(0.4, 'rgba(34,211,238,0.75)');
      mf.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = mf;
      ctx.beginPath();
      ctx.arc(gx + 36, gy - 10, 42 * player.muzzleFlash, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const reticleColor = nearby?.lockedReason
      ? '#ef4444'
      : player.laserOverheated
        ? '#f59e0b'
        : nearby
          ? '#22d3ee'
          : 'rgba(148, 163, 184, 0.72)';

    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 1.5;
    const gap = nearby ? 7 : 5;
    const len = 6;
    ctx.beginPath();
    ctx.moveTo(cx - gap - len, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + gap + len, cy);
    ctx.moveTo(cx, cy - gap - len);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + gap + len);
    ctx.stroke();

    ctx.fillStyle = reticleColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private computeRedLightAtPoint(
    world: StationWorldData,
    wx: number,
    wy: number,
    time: number,
    powerRestored: boolean
  ): number {
    let maxRed = 0;
    for (const light of world.lights) {
      if (!light.highRisk) continue;
      if (powerRestored && light.powerGroup) continue;
      const dx = wx - light.x;
      const dy = wy - light.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= light.radius * light.radius) continue;

      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / light.radius;
      const speed = light.speed ?? 3;
      const phase = light.phase ?? 0;
      const pulse =
        0.22 +
        0.78 * Math.pow(0.5 + 0.5 * Math.sin(time * speed + phase), 1.8);
      const contrib = falloff * falloff * light.intensity * pulse;
      if (contrib > maxRed) {
        maxRed = contrib;
      }
    }
    return Math.min(1, maxRed);
  }

  private normalizeAngle(a: number): number {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
}
