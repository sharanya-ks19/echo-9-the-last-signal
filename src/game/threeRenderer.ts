import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  MAP_COLS,
  MAP_ROWS,
  StationWorldData,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './stationMap';
import {
  DoorEntity,
  EchoBeaconEntity,
  Particle,
  PlayerState,
  ProjectileEntity,
  TileType,
  ViewMode,
} from './types';
import { createStationMaterials, StationMaterialLibrary } from './threeMaterials';
import {
  buildDoorAssembly,
  buildFirstPersonLaserRig,
  buildListenerModel,
  buildMonsterModel,
  buildPickupModel,
  buildPlayerModel,
  buildPropModel,
  buildTerminalModel,
  DoorRig3D,
  ListenerRig3D,
  MonsterRig3D,
  PlayerRig3D,
  PX_TO_3D,
  UNITS_PER_TILE,
  WALL_HEIGHT,
} from './threeModels';

const MAX_PARTICLES = 280;
const MAX_ACTIVE_LIGHTS = 12;

// Reusable module-scope math objects (zero GC inside render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

export function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class ThreeStationRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private mats: StationMaterialLibrary;

  private stationGroup = new THREE.Group();
  private ceilingGroup = new THREE.Group();
  private spaceGroup = new THREE.Group();
  private dynamicGroup = new THREE.Group();

  private playerRig: PlayerRig3D;
  private fpLaserRig: {
    group: THREE.Group;
    heatBarFill: THREE.Mesh;
    heatMat: THREE.MeshStandardMaterial;
    muzzleBeam: THREE.Mesh;
  };

  private doorRigs = new Map<string, DoorRig3D>();
  private monsterRigs = new Map<string, MonsterRig3D>();
  private listenerRig: ListenerRig3D | null = null;
  private pickupRigs = new Map<string, { group: THREE.Group; floatMesh: THREE.Object3D }>();
  private terminalRigs = new Map<string, { group: THREE.Group; screenMat: THREE.MeshStandardMaterial }>();
  private propAnims: Array<{
    kind: string;
    refs?: THREE.Object3D[];
    emissiveMat?: THREE.MeshStandardMaterial;
  }> = [];
  private pipeMaterials: Array<{ mat: THREE.MeshStandardMaterial; boost: boolean }> = [];
  private hazardRings: Array<{ mesh: THREE.Mesh; stabilizedByPower: boolean; baseColor: number }> = [];
  private asteroidMeshes: Array<{ mesh: THREE.Mesh; rotSpeed: number }> = [];
  private volumetricBeams: Array<{
    mat: THREE.MeshBasicMaterial;
    baseOpacity: number;
    speed: number;
    phase: number;
    highRisk: boolean;
  }> = [];
  private planetMesh: THREE.Mesh | null = null;

  // Lighting
  private keyDirLight: THREE.DirectionalLight;
  private suitFlashlight: THREE.SpotLight;
  private suitAuraLight: THREE.PointLight;
  private pooledLights: THREE.PointLight[] = [];

  // Instanced particles
  private particleMesh: THREE.InstancedMesh;

  // Dynamic per-frame meshes (projectiles & beacons)
  private laserBoltPool: THREE.Mesh[] = [];
  private orbBoltPool: THREE.Mesh[] = [];
  private beaconRingPool: Array<{
    group: THREE.Group;
    rings: THREE.Mesh[];
    dome: THREE.Mesh;
    light: THREE.PointLight;
  }> = [];

  // Camera smoothing state
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camInitialized = false;
  private fpRoll = 0;
  private currentBackZ = 5.4;
  private currentHeight = 13.8;
  private viewportW = 1280;
  private viewportH = 720;
  private lastDt = 0.016;
  private lastRenderTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040710);
    this.scene.fog = new THREE.FogExp2(0x050914, 0.01);

    // Studio metal reflection environment map (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.mats = createStationMaterials(maxAniso, this.isSoftwareGl);

    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.08, 260);
    this.scene.add(this.camera);

    // Balanced cool/warm planetary twilight + emergency horror lighting rig
    const hemi = new THREE.HemisphereLight(0x4b74a8, 0x1c1218, 0.56);
    this.scene.add(hemi);

    this.keyDirLight = new THREE.DirectionalLight(0x93c5fd, 0.72);
    this.keyDirLight.castShadow = !this.isSoftwareGl;
    if (this.keyDirLight.castShadow) {
      this.keyDirLight.shadow.mapSize.set(1024, 1024);
      this.keyDirLight.shadow.camera.near = 1;
      this.keyDirLight.shadow.camera.far = 42;
      const d = 18;
      this.keyDirLight.shadow.camera.left = -d;
      this.keyDirLight.shadow.camera.right = d;
      this.keyDirLight.shadow.camera.top = d;
      this.keyDirLight.shadow.camera.bottom = -d;
      this.keyDirLight.shadow.bias = -0.0005;
      this.keyDirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.keyDirLight);
    this.scene.add(this.keyDirLight.target);

    // Player tactical flashlight + suit aura
    this.suitFlashlight = new THREE.SpotLight(
      0xe0f2fe,
      14,
      24,
      Math.PI * 0.24,
      0.45,
      1.35
    );
    this.suitFlashlight.castShadow = false;
    this.scene.add(this.suitFlashlight);
    this.scene.add(this.suitFlashlight.target);

    this.suitAuraLight = new THREE.PointLight(0x38bdf8, 4.5, 9, 1.5);
    this.scene.add(this.suitAuraLight);

    for (let i = 0; i < MAX_ACTIVE_LIGHTS; i++) {
      const pl = new THREE.PointLight(0x22d3ee, 0, 14, 1.6);
      this.scene.add(pl);
      this.pooledLights.push(pl);
    }

    // Scene hierarchy
    this.scene.add(this.spaceGroup);
    this.scene.add(this.stationGroup);
    this.scene.add(this.ceilingGroup);
    this.scene.add(this.dynamicGroup);

    // Build Player & First-Person Laser Viewmodel
    this.playerRig = buildPlayerModel(this.mats);
    this.dynamicGroup.add(this.playerRig.group);

    this.fpLaserRig = buildFirstPersonLaserRig();
    this.fpLaserRig.group.position.set(0.32, -0.26, -0.34);
    this.fpLaserRig.group.rotation.y = 0.08;
    this.fpLaserRig.group.visible = false;
    this.camera.add(this.fpLaserRig.group);

    // Instanced particle buffer
    const partGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.count = 0;
    this.scene.add(this.particleMesh);
  }

  public isSoftwareWebGL(): boolean {
    return this.isSoftwareGl;
  }

  public getWebGLContext(): WebGLRenderingContext | WebGL2RenderingContext {
    return this.renderer.getContext();
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public applySettings(highQualityLighting: boolean): void {
    const allowShadows = !this.isSoftwareGl && highQualityLighting;
    this.renderer.shadowMap.enabled = allowShadows;
    this.keyDirLight.castShadow = allowShadows;
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : highQualityLighting
          ? Math.min(window.devicePixelRatio || 1, 1.5)
          : 1
    );
    this.renderer.setSize(this.viewportW, this.viewportH, false);
  }

  public resize(width: number, height: number): void {
    this.viewportW = Math.max(320, width);
    this.viewportH = Math.max(240, height);
    this.camera.aspect = this.viewportW / this.viewportH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewportW, this.viewportH, false);
  }

  public screenToFloorWorld(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, this.camera);
    if (_raycaster.ray.intersectPlane(_aimPlane, _v1)) {
      return {
        x: _v1.x / PX_TO_3D,
        y: _v1.z / PX_TO_3D,
      };
    }
    return null;
  }

  public initWorld(world: StationWorldData): void {
    this.clearWorldGroups();
    this.buildStaticArchitecture(world);
    this.buildOuterSpaceBackdrop(world);
    this.buildEntities(world);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.camInitialized = false;
  }

  private clearWorldGroups(): void {
    const disposeChildren = (grp: THREE.Group) => {
      while (grp.children.length > 0) {
        const child = grp.children[0];
        grp.remove(child);
        child.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry && !this.isSharedGeometry(mesh.geometry)) {
            mesh.geometry.dispose();
          }
        });
      }
    };

    disposeChildren(this.stationGroup);
    disposeChildren(this.ceilingGroup);
    disposeChildren(this.spaceGroup);
    disposeChildren(this.dynamicGroup);

    this.doorRigs.clear();
    this.monsterRigs.clear();
    this.pickupRigs.clear();
    this.terminalRigs.clear();
    this.propAnims = [];
    this.pipeMaterials = [];
    this.hazardRings = [];
    this.asteroidMeshes = [];
    this.volumetricBeams = [];
    this.laserBoltPool = [];
    this.orbBoltPool = [];
    this.beaconRingPool = [];
    this.planetMesh = null;
    this.listenerRig = null;

    // Re-attach persistent player rig
    this.dynamicGroup.add(this.playerRig.group);
  }

  private isSharedGeometry(_geo: THREE.BufferGeometry): boolean {
    return false;
  }

  private buildStaticArchitecture(world: StationWorldData): void {
    const floorMetalPositions: Array<{ c: number; r: number }> = [];
    const floorGratePositions: Array<{ c: number; r: number }> = [];
    const floorHazardPositions: Array<{ c: number; r: number }> = [];
    const wallPositions: Array<{ c: number; r: number }> = [];
    const windowPositions: Array<{ c: number; r: number; isHorizontal: boolean }> = [];
    const allWalkable: Array<{ c: number; r: number }> = [];

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const t = world.grid[r][c];
        if (t === TileType.FLOOR_METAL) {
          floorMetalPositions.push({ c, r });
          allWalkable.push({ c, r });
        } else if (t === TileType.FLOOR_GRATE) {
          floorGratePositions.push({ c, r });
          allWalkable.push({ c, r });
        } else if (t === TileType.FLOOR_HAZARD) {
          floorHazardPositions.push({ c, r });
          allWalkable.push({ c, r });
        } else if (t === TileType.WALL) {
          wallPositions.push({ c, r });
        } else if (t === TileType.WINDOW_SPACE) {
          const leftIsWinOrWall =
            c > 0 &&
            (world.grid[r][c - 1] === TileType.WINDOW_SPACE ||
              world.grid[r][c - 1] === TileType.WALL);
          windowPositions.push({ c, r, isHorizontal: leftIsWinOrWall });
        }
      }
    }

    const dummy = new THREE.Object3D();

    // 1. Floor tiles (thick slab y = -0.25..0 so floor has solid depth)
    const addFloorBatch = (
      coords: Array<{ c: number; r: number }>,
      mat: THREE.Material
    ) => {
      if (coords.length === 0) return;
      const geo = new THREE.BoxGeometry(UNITS_PER_TILE, 0.28, UNITS_PER_TILE);
      const im = new THREE.InstancedMesh(geo, mat, coords.length);
      im.receiveShadow = true;
      coords.forEach(({ c, r }, idx) => {
        dummy.position.set(
          (c + 0.5) * UNITS_PER_TILE,
          -0.14,
          (r + 0.5) * UNITS_PER_TILE
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        im.setMatrixAt(idx, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.stationGroup.add(im);
    };

    addFloorBatch(floorMetalPositions, this.mats.floorMetalMat);
    addFloorBatch(floorGratePositions, this.mats.floorGrateMat);
    addFloorBatch(floorHazardPositions, this.mats.floorHazardMat);

    // Arrival Bay PAD-04 Landing Platform marking overlay
    const padPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8 * UNITS_PER_TILE, 5.2 * UNITS_PER_TILE),
      this.mats.landingPadMat
    );
    padPlane.rotation.x = -Math.PI / 2;
    padPlane.position.set(31.5 * UNITS_PER_TILE, 0.014, 42.5 * UNITS_PER_TILE);
    padPlane.receiveShadow = true;
    this.stationGroup.add(padPlane);

    // 2. Solid Thick Opaque Metallic Walls + Base Plinths + Upper Cornice + Corner Pillars
    if (wallPositions.length > 0) {
      const wallGeo = new THREE.BoxGeometry(
        UNITS_PER_TILE,
        WALL_HEIGHT,
        UNITS_PER_TILE
      );
      const wallIm = new THREE.InstancedMesh(
        wallGeo,
        this.mats.wallMainMat,
        wallPositions.length
      );
      wallIm.castShadow = true;
      wallIm.receiveShadow = true;

      const plinthGeo = new THREE.BoxGeometry(
        UNITS_PER_TILE + 0.08,
        0.34,
        UNITS_PER_TILE + 0.08
      );
      const plinthIm = new THREE.InstancedMesh(
        plinthGeo,
        this.mats.wallTrimMat,
        wallPositions.length
      );
      plinthIm.receiveShadow = true;

      const crownGeo = new THREE.BoxGeometry(
        UNITS_PER_TILE + 0.08,
        0.26,
        UNITS_PER_TILE + 0.08
      );
      const crownIm = new THREE.InstancedMesh(
        crownGeo,
        this.mats.wallTrimMat,
        wallPositions.length
      );

      // Structural steel vertical rib columns on alternating wall sections
      const pillarGeo = new THREE.BoxGeometry(0.32, WALL_HEIGHT + 0.04, 0.32);
      const pillarSpots: Array<{ x: number; z: number }> = [];

      wallPositions.forEach(({ c, r }, idx) => {
        const wx = (c + 0.5) * UNITS_PER_TILE;
        const wz = (r + 0.5) * UNITS_PER_TILE;

        dummy.position.set(wx, WALL_HEIGHT * 0.5, wz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        wallIm.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, 0.17, wz);
        dummy.updateMatrix();
        plinthIm.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, WALL_HEIGHT - 0.13, wz);
        dummy.updateMatrix();
        crownIm.setMatrixAt(idx, dummy.matrix);

        if ((c + r) % 2 === 0) {
          pillarSpots.push({ x: wx - UNITS_PER_TILE * 0.45, z: wz - UNITS_PER_TILE * 0.45 });
        }
      });

      wallIm.instanceMatrix.needsUpdate = true;
      wallIm.computeBoundingSphere();
      plinthIm.instanceMatrix.needsUpdate = true;
      plinthIm.computeBoundingSphere();
      crownIm.instanceMatrix.needsUpdate = true;
      crownIm.computeBoundingSphere();

      this.stationGroup.add(wallIm, plinthIm, crownIm);

      if (pillarSpots.length > 0) {
        const pillarIm = new THREE.InstancedMesh(
          pillarGeo,
          this.mats.wallPillarMat,
          pillarSpots.length
        );
        pillarIm.castShadow = true;
        pillarSpots.forEach((pt, idx) => {
          dummy.position.set(pt.x, WALL_HEIGHT * 0.5, pt.z);
          dummy.updateMatrix();
          pillarIm.setMatrixAt(idx, dummy.matrix);
        });
        pillarIm.instanceMatrix.needsUpdate = true;
        pillarIm.computeBoundingSphere();
        this.stationGroup.add(pillarIm);
      }
    }

    // 3. Solid Observation Windows (Opaque knee-wall + header + steel mullions + sealed glass)
    if (windowPositions.length > 0) {
      const sillGeo = new THREE.BoxGeometry(UNITS_PER_TILE, 0.92, UNITS_PER_TILE * 0.85);
      const sillIm = new THREE.InstancedMesh(sillGeo, this.mats.wallMainMat, windowPositions.length);
      sillIm.castShadow = true;
      sillIm.receiveShadow = true;

      const headGeo = new THREE.BoxGeometry(UNITS_PER_TILE, 0.48, UNITS_PER_TILE * 0.85);
      const headIm = new THREE.InstancedMesh(headGeo, this.mats.wallTrimMat, windowPositions.length);

      const mullionGeo = new THREE.BoxGeometry(0.24, 1.4, 0.56);
      const mullionIm = new THREE.InstancedMesh(
        mullionGeo,
        this.mats.wallPillarMat,
        windowPositions.length
      );

      const paneGeo = new THREE.BoxGeometry(UNITS_PER_TILE, 1.38, 0.12);
      const paneIm = new THREE.InstancedMesh(
        paneGeo,
        this.mats.windowGlassMat,
        windowPositions.length
      );

      windowPositions.forEach(({ c, r, isHorizontal }, idx) => {
        const wx = (c + 0.5) * UNITS_PER_TILE;
        const wz = (r + 0.5) * UNITS_PER_TILE;
        const rotY = isHorizontal ? 0 : Math.PI / 2;

        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, 1, 1);

        dummy.position.set(wx, 0.46, wz);
        dummy.updateMatrix();
        sillIm.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, WALL_HEIGHT - 0.24, wz);
        dummy.updateMatrix();
        headIm.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx - UNITS_PER_TILE * 0.48, 1.62, wz);
        dummy.updateMatrix();
        mullionIm.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, 1.62, wz);
        dummy.updateMatrix();
        paneIm.setMatrixAt(idx, dummy.matrix);
      });

      [sillIm, headIm, mullionIm, paneIm].forEach((im) => {
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        this.stationGroup.add(im);
      });
    }

    // 4. Ceiling Architecture (Full roof slabs, overhead support beams, ceiling vents & light strips)
    if (allWalkable.length > 0) {
      const ceilGeo = new THREE.BoxGeometry(UNITS_PER_TILE, 0.22, UNITS_PER_TILE);
      const ceilIm = new THREE.InstancedMesh(
        ceilGeo,
        this.mats.ceilingPanelMat,
        allWalkable.length
      );

      const beamTiles = allWalkable.filter(({ r }) => r % 2 === 0);
      const beamGeo = new THREE.BoxGeometry(UNITS_PER_TILE, 0.24, 0.28);
      const beamIm = new THREE.InstancedMesh(
        beamGeo,
        this.mats.ceilingBeamMat,
        beamTiles.length
      );

      const stripTiles = allWalkable.filter(({ c, r }) => c % 3 === 1 && r % 3 === 1);
      const stripGeo = new THREE.BoxGeometry(1.1, 0.07, 0.22);
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.4,
      });
      const stripIm = new THREE.InstancedMesh(stripGeo, stripMat, stripTiles.length);

      allWalkable.forEach(({ c, r }, idx) => {
        dummy.position.set(
          (c + 0.5) * UNITS_PER_TILE,
          WALL_HEIGHT + 0.11,
          (r + 0.5) * UNITS_PER_TILE
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        ceilIm.setMatrixAt(idx, dummy.matrix);
      });

      beamTiles.forEach(({ c, r }, idx) => {
        dummy.position.set(
          (c + 0.5) * UNITS_PER_TILE,
          WALL_HEIGHT - 0.1,
          (r + 0.5) * UNITS_PER_TILE
        );
        dummy.updateMatrix();
        beamIm.setMatrixAt(idx, dummy.matrix);
      });

      stripTiles.forEach(({ c, r }, idx) => {
        dummy.position.set(
          (c + 0.5) * UNITS_PER_TILE,
          WALL_HEIGHT - 0.04,
          (r + 0.5) * UNITS_PER_TILE
        );
        dummy.updateMatrix();
        stripIm.setMatrixAt(idx, dummy.matrix);
      });

      ceilIm.instanceMatrix.needsUpdate = true;
      ceilIm.computeBoundingSphere();
      beamIm.instanceMatrix.needsUpdate = true;
      beamIm.computeBoundingSphere();
      stripIm.instanceMatrix.needsUpdate = true;
      stripIm.computeBoundingSphere();

      this.ceilingGroup.add(ceilIm, beamIm, stripIm);

      // Overhead ventilation ducts & industrial ceiling pipes
      const ventTiles = allWalkable.filter(({ c, r }) => c % 5 === 2 && r % 4 === 2);
      if (ventTiles.length > 0) {
        const ventGeo = new THREE.BoxGeometry(0.95, 0.16, 0.95);
        const ventIm = new THREE.InstancedMesh(
          ventGeo,
          this.mats.wallPillarMat,
          ventTiles.length
        );
        ventTiles.forEach(({ c, r }, idx) => {
          dummy.position.set(
            (c + 0.5) * UNITS_PER_TILE,
            WALL_HEIGHT - 0.08,
            (r + 0.5) * UNITS_PER_TILE
          );
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          ventIm.setMatrixAt(idx, dummy.matrix);
        });
        ventIm.instanceMatrix.needsUpdate = true;
        ventIm.computeBoundingSphere();
        this.ceilingGroup.add(ventIm);
      }

      const pipeTiles = allWalkable.filter(({ c, r }) => r % 3 === 0 && c % 2 === 0);
      if (pipeTiles.length > 0) {
        const cPipeGeo = new THREE.CylinderGeometry(0.085, 0.085, UNITS_PER_TILE, 8);
        cPipeGeo.rotateZ(Math.PI / 2);
        const cPipeIm = new THREE.InstancedMesh(
          cPipeGeo,
          this.mats.wallTrimMat,
          pipeTiles.length
        );
        pipeTiles.forEach(({ c, r }, idx) => {
          dummy.position.set(
            (c + 0.5) * UNITS_PER_TILE,
            WALL_HEIGHT - 0.24,
            (r + 0.28) * UNITS_PER_TILE
          );
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          cPipeIm.setMatrixAt(idx, dummy.matrix);
        });
        cPipeIm.instanceMatrix.needsUpdate = true;
        cPipeIm.computeBoundingSphere();
        this.ceilingGroup.add(cPipeIm);
      }

      // Lightweight volumetric-looking light cones under key corridor/emergency lights
      const beamConeGeo = new THREE.ConeGeometry(1.55, WALL_HEIGHT - 0.2, 14, 1, true);
      const selectedLights = world.lights.filter((_, idx) => idx % 2 === 0).slice(0, 16);
      for (const l of selectedLights) {
        const lx = l.x * PX_TO_3D;
        const lz = l.y * PX_TO_3D;
        const baseOpacity = l.highRisk ? 0.075 : 0.048;
        const beamMat = new THREE.MeshBasicMaterial({
          color: l.color,
          transparent: true,
          opacity: baseOpacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(beamConeGeo, beamMat);
        cone.position.set(lx, (WALL_HEIGHT - 0.2) * 0.5, lz);
        this.stationGroup.add(cone);
        this.volumetricBeams.push({
          mat: beamMat,
          baseOpacity,
          speed: l.speed ?? 2,
          phase: l.phase ?? 0,
          highRisk: Boolean(l.highRisk),
        });
      }

      // Crash-impact ceiling dangling cables & buckled hull struts near hazard zones
      const cableMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.7,
        metalness: 0.45,
      });
      const cableGeo = new THREE.CylinderGeometry(0.035, 0.028, 0.95, 6);
      world.hazards.forEach((haz, hIdx) => {
        const hx = haz.tileX * UNITS_PER_TILE;
        const hz = haz.tileY * UNITS_PER_TILE;
        for (let k = 0; k < 2; k++) {
          const cable = new THREE.Mesh(cableGeo, cableMat);
          cable.position.set(
            hx + (k === 0 ? -0.42 : 0.48),
            WALL_HEIGHT - 0.42,
            hz + (hIdx % 2 === 0 ? 0.35 : -0.35)
          );
          cable.rotation.z = (k === 0 ? 0.28 : -0.32) + (hIdx % 3) * 0.08;
          cable.rotation.x = 0.22;
          this.ceilingGroup.add(cable);
        }
      });
    }
  }

  private buildOuterSpaceBackdrop(world: StationWorldData): void {
    const cx = WORLD_WIDTH * 0.5 * PX_TO_3D;
    const cz = WORLD_HEIGHT * 0.5 * PX_TO_3D;

    // 1. Alien Planet Regolith Surface underneath & surrounding the crashed spaceship
    const planetGround = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360, 1, 1),
      this.mats.planetTerrainMat
    );
    planetGround.rotation.x = -Math.PI / 2;
    planetGround.position.set(cx, -0.52, cz);
    planetGround.receiveShadow = true;
    this.spaceGroup.add(planetGround);

    // 2. Impact Crater Rim Ridges & Scorched Earth Trenches surrounding the crashed hull
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x201926,
      roughness: 0.92,
      metalness: 0.06,
    });
    const scorchedMat = new THREE.MeshStandardMaterial({
      color: 0x2d1a16,
      roughness: 0.94,
      metalness: 0.05,
    });
    const hullWreckMat = new THREE.MeshStandardMaterial({
      color: 0x1b2638,
      roughness: 0.48,
      metalness: 0.78,
    });
    const crystalTealMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 1.45,
      roughness: 0.2,
    });
    const crystalRedMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 1.35,
      roughness: 0.22,
    });

    // Impact crater rim & rocky ridges framing the Command Deck window (z < 0) and flanks
    const spireGeo = new THREE.ConeGeometry(2.6, 8.5, 6);
    const moundGeo = new THREE.DodecahedronGeometry(3.4, 1);
    const crystalGeo = new THREE.OctahedronGeometry(0.9, 0);

    for (let i = 0; i < 42; i++) {
      const ang = (i / 42) * Math.PI * 2;
      const dist = 84 + (i % 5) * 14;
      const rx = cx + Math.cos(ang) * dist;
      const rz = cz + Math.sin(ang) * (dist * 0.85);
      // Keep north & south sightlines wide and dramatic
      const spire = new THREE.Mesh(spireGeo, i % 3 === 0 ? scorchedMat : rockMat);
      const hScale = 0.8 + (i % 4) * 0.55;
      spire.scale.set(1.1 + (i % 3) * 0.35, hScale, 1.0 + (i % 2) * 0.4);
      spire.position.set(rx, hScale * 2.1 - 0.8, rz);
      spire.rotation.y = i * 0.7;
      spire.rotation.z = ((i % 5) - 2) * 0.07;
      this.spaceGroup.add(spire);
    }

    // Close-range crash terrain features right outside Command Deck panoramic window (North z < 2)
    for (let i = 0; i < 16; i++) {
      const nx = 34 + i * 5.8;
      const nz = -7 - (i % 4) * 5.5;
      const mound = new THREE.Mesh(moundGeo, i % 2 === 0 ? scorchedMat : rockMat);
      mound.scale.set(1.8 + (i % 3) * 0.5, 0.42 + (i % 3) * 0.25, 1.3);
      mound.position.set(nx, -0.15, nz);
      mound.rotation.y = i * 0.9;
      this.spaceGroup.add(mound);

      if (i % 2 === 0) {
        const crystal = new THREE.Mesh(
          crystalGeo,
          i % 4 === 0 ? crystalRedMat : crystalTealMat
        );
        crystal.scale.set(0.75, 2.2 + (i % 3) * 0.9, 0.75);
        crystal.position.set(nx + 1.4, 1.0, nz + 1.5);
        crystal.rotation.z = ((i % 3) - 1) * 0.28;
        crystal.rotation.x = 0.2;
        this.spaceGroup.add(crystal);
      }
    }

    // Close-range planetary rocks & crystals outside Arrival Bay South windows (z > 116)
    for (let i = 0; i < 10; i++) {
      const sx = 54 + i * 5.2;
      const sz = 121 + (i % 3) * 4.5;
      const rock = new THREE.Mesh(moundGeo, rockMat);
      rock.scale.set(1.4, 0.45, 1.2);
      rock.position.set(sx, -0.2, sz);
      this.spaceGroup.add(rock);

      const crystal = new THREE.Mesh(crystalGeo, i % 2 === 0 ? crystalTealMat : crystalRedMat);
      crystal.scale.set(0.65, 1.85, 0.65);
      crystal.position.set(sx - 1.1, 0.75, sz - 1.0);
      crystal.rotation.z = 0.25;
      this.spaceGroup.add(crystal);
    }

    // 3. Crashed Starship Exterior Wreckage: Sheared Prow Fins, Torn Wings & Scorched Thruster Pods
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.75,
      roughness: 0.4,
    });

    // Sheared starship bow wreckage half-buried outside North Command Deck window
    for (const side of [-1, 1] as const) {
      const bowFin = new THREE.Mesh(new THREE.BoxGeometry(11, 1.6, 5.2), hullWreckMat);
      bowFin.position.set(cx + side * 21, 0.35, -4.5);
      bowFin.rotation.y = side * -0.38;
      bowFin.rotation.z = side * 0.14;
      this.spaceGroup.add(bowFin);

      const girder = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 9, 8), hullWreckMat);
      girder.rotation.z = Math.PI / 2 - side * 0.18;
      girder.position.set(cx + side * 14, 0.85, -3.5);
      this.spaceGroup.add(girder);
    }

    // Smoldering crash wreckage debris chunk directly outside Command Bridge window
    const wreckCore = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.3, 3.2), hullWreckMat);
    wreckCore.position.set(cx - 5, 0.15, -7.2);
    wreckCore.rotation.set(0.18, 0.42, -0.14);
    this.spaceGroup.add(wreckCore);

    const wreckEmber = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 8), emberMat);
    wreckEmber.scale.set(1.6, 0.4, 1.2);
    wreckEmber.position.set(cx - 5, 0.32, -6.4);
    this.spaceGroup.add(wreckEmber);

    // Massive Crashed Port & Starboard Wings + Aft Thruster Nacelles framing the ship exterior
    for (const side of [-1, 1] as const) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 2.2, 16), hullWreckMat);
      wing.position.set(cx + side * 78, 0.9, cz + 6);
      wing.rotation.z = side * -0.09;
      wing.rotation.y = side * 0.22;
      this.spaceGroup.add(wing);

      const thruster = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.8, 12, 12),
        hullWreckMat
      );
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(cx + side * 28, 1.5, 118);
      this.spaceGroup.add(thruster);

      const thrusterGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.3, 0.6, 12),
        emberMat
      );
      thrusterGlow.rotation.x = Math.PI / 2;
      thrusterGlow.position.set(cx + side * 28, 1.5, 124);
      this.spaceGroup.add(thrusterGlow);
    }

    // 4. Alien Planet Night Sky Starfield + Ringed Parent World + Distant Earth Signal Star
    const starCount = 1400;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const ang = ((i * 137.5) % 360) * (Math.PI / 180);
      const rad = 82 + (i % 19) * 5;
      positions[i * 3] = cx + Math.cos(ang) * rad;
      positions[i * 3 + 1] = 6 + ((i * 53) % 62);
      positions[i * 3 + 2] = cz + Math.sin(ang) * rad - 20;

      const tint = i % 5 === 0 ? 0.85 : i % 3 === 0 ? 0.95 : 1.0;
      colors[i * 3] = 0.72 * tint;
      colors[i * 3 + 1] = 0.88 * tint;
      colors[i * 3 + 2] = 1.0;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.45,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false,
    });
    this.spaceGroup.add(new THREE.Points(starGeo, starMat));

    // Ringed Alien Sky World visible above the northern crash crater horizon
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(22, 36, 28),
      this.mats.planetMat
    );
    planet.position.set(31.5 * UNITS_PER_TILE, 14, -46);
    this.spaceGroup.add(planet);
    this.planetMesh = planet;

    const atmoRing = new THREE.Mesh(
      new THREE.TorusGeometry(27, 0.38, 8, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
        fog: false,
      })
    );
    atmoRing.position.copy(planet.position);
    atmoRing.rotation.x = Math.PI * 0.42;
    atmoRing.rotation.y = 0.28;
    this.spaceGroup.add(atmoRing);

    // Bright cyan Earth-Link Signal Beacon Star in upper North sky
    const earthStar = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, fog: false })
    );
    earthStar.position.set(cx + 18, 28, -56);
    this.spaceGroup.add(earthStar);

    // Scattered alien boulders & meteor fragments on outer planetary terrain
    const astMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88,
      metalness: 0.12,
    });
    world.asteroids.slice(0, 28).forEach((ast, idx) => {
      const m = new THREE.Mesh(
        new THREE.DodecahedronGeometry(ast.radius * PX_TO_3D * 0.85, 0),
        astMat
      );
      m.position.set(
        ast.x * PX_TO_3D,
        ((idx % 4) * 0.35) + 0.15,
        ast.y * PX_TO_3D
      );
      this.spaceGroup.add(m);
      this.asteroidMeshes.push({ mesh: m, rotSpeed: ast.rotSpeed * 0.15 });
    });
  }

  private buildEntities(world: StationWorldData): void {
    // 1. Sliding Bulkhead Doors
    for (const door of world.doors) {
      const rig = buildDoorAssembly(door, this.mats);
      this.dynamicGroup.add(rig.group);
      this.doorRigs.set(door.id, rig);
    }

    // 2. Energy Pipes (3D cylindrical industrial conduits + elbows)
    for (const pipe of world.energyPipes) {
      const baseHex = parseInt(pipe.color.replace('#', ''), 16);
      const pMat = new THREE.MeshStandardMaterial({
        color: baseHex,
        emissive: baseHex,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.65,
      });
      this.pipeMaterials.push({ mat: pMat, boost: Boolean(pipe.poweredBoost) });

      for (let i = 0; i < pipe.points.length - 1; i++) {
        const a = pipe.points[i];
        const b = pipe.points[i + 1];
        const ax = a.x * PX_TO_3D;
        const az = a.y * PX_TO_3D;
        const bx = b.x * PX_TO_3D;
        const bz = b.y * PX_TO_3D;
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.05) continue;

        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, len, 10),
          pMat
        );
        seg.position.set((ax + bx) * 0.5, 0.16, (az + bz) * 0.5);
        seg.rotation.z = Math.PI / 2;
        seg.rotation.y = -Math.atan2(bz - az, bx - ax);
        seg.castShadow = true;
        this.stationGroup.add(seg);

        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), this.mats.wallTrimMat);
        joint.position.set(ax, 0.16, az);
        this.stationGroup.add(joint);
      }
    }

    // 3. Props & Machinery
    for (const prop of world.props) {
      const built = buildPropModel(prop, this.mats);
      this.stationGroup.add(built.group);
      if (built.animRefs || built.emissiveMat) {
        this.propAnims.push({
          kind: prop.kind,
          refs: built.animRefs,
          emissiveMat: built.emissiveMat,
        });
      }
    }

    // 4. Terminals & Relays
    for (const term of world.terminals) {
      const built = buildTerminalModel(term, this.mats);
      this.stationGroup.add(built.group);
      this.terminalRigs.set(term.id, built);
    }

    // 5. Suit Recharge Stations
    const medMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.6,
    });
    for (const st of world.suitStations) {
      const grp = new THREE.Group();
      grp.position.set(st.tileX * UNITS_PER_TILE, 0, st.tileY * UNITS_PER_TILE);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.8, 0.65), this.mats.wallPillarMat);
      body.position.y = 0.9;
      body.castShadow = true;
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.7), medMat);
      crossH.position.y = 1.25;
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.7), medMat);
      crossV.position.y = 1.25;
      grp.add(body, crossH, crossV);
      this.stationGroup.add(grp);
    }

    // 6. Keycard & Item Pickups
    for (const pickup of world.pickups) {
      const built = buildPickupModel(pickup);
      this.dynamicGroup.add(built.group);
      this.pickupRigs.set(pickup.id, built);
    }

    // 7. Hazard Ground Fields
    for (const haz of world.hazards) {
      const baseColor =
        haz.kind === 'ELECTRIC_ARC'
          ? 0x38bdf8
          : haz.kind === 'CRYO_LEAK'
            ? 0x7dd3fc
            : haz.kind === 'RADIATION_ZONE'
              ? 0x10b981
              : 0xef4444;
      const r3d = haz.radius * PX_TO_3D;
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(r3d * 0.55, r3d, 28),
        new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(haz.tileX * UNITS_PER_TILE, 0.024, haz.tileY * UNITS_PER_TILE);
      this.stationGroup.add(mesh);
      this.hazardRings.push({
        mesh,
        stabilizedByPower: Boolean(haz.stabilizedByPower),
        baseColor,
      });
    }

    // 8. Monsters & Creatures
    for (const m of world.monsters) {
      const rig = buildMonsterModel(m.archetype, m.radius, this.mats);
      this.dynamicGroup.add(rig.group);
      this.monsterRigs.set(m.id, rig);
    }

    // 9. THE LISTENER
    this.listenerRig = buildListenerModel(this.mats);
    this.dynamicGroup.add(this.listenerRig.group);
  }

  public render(
    world: StationWorldData,
    player: PlayerState,
    particles: Particle[],
    projectiles: ProjectileEntity[],
    activeBeacons: EchoBeaconEntity[],
    powerRestored: boolean,
    viewMode: ViewMode,
    time: number,
    isTitleMenu: boolean,
    shakeOffset: { x: number; y: number }
  ): void {
    const now = performance.now();
    this.lastDt = Math.min(0.05, Math.max(0.001, (now - this.lastRenderTime) / 1000));
    this.lastRenderTime = now;

    // 1. Sync ViewMode Ceiling & First-Person Laser Visibility
    const isFirstPerson = viewMode === 'FRONT_POV' && !isTitleMenu;
    this.ceilingGroup.visible = isFirstPerson || isTitleMenu;
    this.playerRig.group.visible = !isFirstPerson && !isTitleMenu;
    this.fpLaserRig.group.visible = isFirstPerson;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = isFirstPerson ? 0.022 : 0.0085;
    }

    // 2. Sync Doors
    for (const door of world.doors) {
      const rig = this.doorRigs.get(door.id);
      if (!rig) continue;
      const slide = door.openProgress * rig.maxSlide;
      rig.leftLeaf.position.x = -slide;
      rig.rightLeaf.position.x = slide;
      const statusColor = door.locked ? 0xef4444 : door.isOpen ? 0x22d3ee : 0xf59e0b;
      rig.statusMaterials.forEach((m) => {
        m.color.setHex(statusColor);
        m.emissive.setHex(statusColor);
      });
    }

    // 3. Sync Terminals, Pickups, Hazards & Reactor animations
    for (const term of world.terminals) {
      const rig = this.terminalRigs.get(term.id);
      if (!rig) continue;
      if (term.activated) {
        rig.screenMat.color.setHex(0x22d3ee);
        rig.screenMat.emissive.setHex(0x22d3ee);
        rig.screenMat.emissiveIntensity = 1.9;
      }
    }

    for (const pickup of world.pickups) {
      const rig = this.pickupRigs.get(pickup.id);
      if (!rig) continue;
      rig.group.visible = !pickup.collected;
      if (!pickup.collected) {
        rig.floatMesh.rotation.y = time * 2.2;
        rig.floatMesh.position.y = 0.72 + Math.sin(time * 3 + pickup.tileX) * 0.12;
      }
    }

    for (const anim of this.propAnims) {
      if (anim.kind === 'REACTOR_CORE') {
        if (anim.refs && anim.refs.length >= 2) {
          anim.refs[0].rotation.z = time * (powerRestored ? 1.4 : 0.7);
          anim.refs[1].rotation.z = -time * (powerRestored ? 1.8 : 0.9);
        }
        if (anim.emissiveMat) {
          const hex = powerRestored ? 0x22d3ee : 0xef4444;
          anim.emissiveMat.color.setHex(hex);
          anim.emissiveMat.emissive.setHex(hex);
          anim.emissiveMat.emissiveIntensity =
            1.6 + Math.sin(time * (powerRestored ? 4 : 7)) * 0.6;
        }
      } else if (anim.kind === 'HOLO_TABLE' && anim.refs) {
        anim.refs.forEach((r, idx) => {
          r.rotation.y = time * (idx === 0 ? 0.8 : -0.5);
        });
      } else if (anim.refs) {
        anim.refs.forEach((r, idx) => {
          r.position.y = 1.1 + Math.sin(time * 2.1 + idx) * 0.14;
        });
      }
    }

    for (const pipe of this.pipeMaterials) {
      if (pipe.boost && powerRestored) {
        pipe.mat.color.setHex(0x22d3ee);
        pipe.mat.emissive.setHex(0x22d3ee);
        pipe.mat.emissiveIntensity = 1.45 + 0.4 * Math.sin(time * 5);
      } else {
        pipe.mat.emissiveIntensity = 0.45 + 0.15 * Math.sin(time * 2.5);
      }
    }

    for (const haz of this.hazardRings) {
      haz.mesh.visible = !(haz.stabilizedByPower && powerRestored);
      if (haz.mesh.visible) {
        const mat = haz.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(time * 6 + haz.mesh.position.x));
      }
    }

    if (this.planetMesh) {
      this.planetMesh.rotation.y = time * 0.025;
    }
    for (const ast of this.asteroidMeshes) {
      ast.mesh.rotation.y += ast.rotSpeed * this.lastDt;
      ast.mesh.rotation.x += ast.rotSpeed * 0.5 * this.lastDt;
    }

    // 4. Sync Player Model & Weapon State
    const p3x = player.x * PX_TO_3D;
    const p3z = player.y * PX_TO_3D;
    const speed = Math.hypot(player.vx, player.vy);
    const legSwing = speed > 10 ? Math.sin(player.walkCycle) * 0.45 : 0;

    this.playerRig.group.position.set(p3x, 0, p3z);
    this.playerRig.group.rotation.y = -player.angle;
    this.playerRig.leftLeg.rotation.z = legSwing;
    this.playerRig.rightLeg.rotation.z = -legSwing;
    this.playerRig.rightArm.rotation.z = player.muzzleFlash * 0.16;

    const laserHex = player.laserOverheated
      ? 0xef4444
      : player.laserHeat >= 70
        ? 0xf59e0b
        : 0x22d3ee;
    this.playerRig.laserTipMat.color.setHex(laserHex);
    this.playerRig.laserTipMat.emissive.setHex(laserHex);
    (this.playerRig.muzzleFlash.material as THREE.MeshBasicMaterial).opacity =
      player.muzzleFlash * 0.9;
    this.playerRig.muzzleFlash.scale.setScalar(0.6 + player.muzzleFlash * 0.8);

    // First-person laser viewmodel animation
    if (isFirstPerson) {
      const bobX = speed > 10 ? Math.cos(player.walkCycle * 0.5) * 0.012 : 0;
      const bobY = speed > 10 ? Math.abs(Math.sin(player.walkCycle)) * 0.014 : 0;
      this.fpLaserRig.group.position.set(
        0.32 + bobX,
        -0.25 + bobY,
        -0.34 + player.muzzleFlash * 0.045
      );
      this.fpLaserRig.heatMat.color.setHex(laserHex);
      this.fpLaserRig.heatMat.emissive.setHex(laserHex);
      const ratio = Math.max(0.05, Math.min(1, player.laserHeat / 100));
      this.fpLaserRig.heatBarFill.scale.x = ratio;
      (this.fpLaserRig.muzzleBeam.material as THREE.MeshBasicMaterial).opacity =
        player.muzzleFlash * 0.78;
    }

    // 5. Sync Monsters & THE LISTENER
    for (const m of world.monsters) {
      const rig = this.monsterRigs.get(m.id);
      if (!rig) continue;
      const isTitleBoss = isTitleMenu && m.tier === 'BOSS';
      rig.group.visible = (m.active || isTitleBoss) && m.alive;
      if (!rig.group.visible) continue;

      if (isTitleBoss) {
        const titleBossX = 33.0 * UNITS_PER_TILE;
        const titleBossZ = 5.2 * UNITS_PER_TILE;
        rig.group.position.set(titleBossX, 0, titleBossZ);
        rig.bodyGroup.rotation.y = -(2.14 + Math.sin(time * 0.52) * 0.16);
      } else {
        rig.group.position.set(m.x * PX_TO_3D, 0, m.y * PX_TO_3D);
        rig.bodyGroup.rotation.y = -m.angle;
      }

      const isAttacking = m.aiState === 'WINDUP' || m.aiState === 'LUNGING';
      const isMoving =
        m.aiState === 'ALERT' || m.aiState === 'PATROL' || m.aiState === 'LUNGING';
      const animRate = isTitleBoss ? 3.2 : isAttacking ? 15 : isMoving ? 7.5 : 2.6;
      const phase = time * animRate + m.patrolPhase;
      const swing = Math.sin(phase) * (isTitleBoss ? 0.22 : isAttacking ? 0.52 : isMoving ? 0.36 : 0.1);

      rig.bodyGroup.position.y = isTitleBoss
        ? Math.sin(time * 2.4) * 0.045
        : isMoving || isAttacking
          ? Math.abs(Math.sin(phase)) * (m.archetype === 'SKITTERER' ? 0.045 : 0.07)
          : Math.sin(time * 2.2 + m.patrolPhase) * 0.025;

      if (rig.spriteStandee) {
        const { sprite, material, baseW, baseH } = rig.spriteStandee;
        const titleBoost = isTitleBoss ? 1.15 : 1.0;
        const breath = 1 + Math.sin(time * (isTitleBoss ? 2.1 : 3.2)) * 0.022;
        const lungePop = isAttacking ? 1.07 : 1.0;
        sprite.scale.set(
          baseW * titleBoost * lungePop * (1 / Math.sqrt(breath)),
          baseH * titleBoost * lungePop * breath,
          1
        );
        material.rotation = isTitleBoss
          ? Math.sin(time * 1.25) * 0.018
          : isMoving || isAttacking
            ? Math.sin(phase) * 0.035
            : 0;
        if (material.fog !== !isTitleBoss) {
          material.fog = !isTitleBoss;
          material.needsUpdate = true;
        }
        if (m.hitFlash > 0.05) {
          material.color.setHex(0xffb4b4);
        } else if (m.tier === 'BOSS' && m.hp <= m.maxHp * 0.5 && !isTitleBoss) {
          material.color.setHex(0xffd4d4);
        } else {
          material.color.setHex(0xffffff);
        }
      }

      if (m.archetype === 'SKITTERER') {
        if (rig.legs && rig.legs.length > 0) {
          rig.legs.forEach((leg, idx) => {
            const alt = idx % 2 === 0 ? 1 : -1;
            leg.rotation.z = Math.sin(phase + idx * 0.9) * 0.24 * alt;
            leg.rotation.x = Math.cos(phase + idx * 0.7) * 0.14;
          });
        }
      } else {
        if (rig.leftLimb) rig.leftLimb.rotation.z = isTitleBoss ? -0.18 + swing : swing;
        if (rig.rightLimb) rig.rightLimb.rotation.z = isTitleBoss ? 0.18 - swing : -swing;
        if (rig.legs && rig.legs.length >= 2) {
          const stride = !isTitleBoss && (isMoving || isAttacking) ? Math.sin(phase) * 0.38 : 0;
          rig.legs[0].rotation.z = stride;
          rig.legs[1].rotation.z = -stride;
        }
      }

      if (rig.headGroup) {
        rig.headGroup.rotation.y = Math.sin(time * (isAttacking ? 8 : 2.2) + m.patrolPhase) * (isAttacking ? 0.22 : 0.18);
        rig.headGroup.rotation.z = isAttacking
          ? -0.22 + Math.sin(phase * 1.4) * 0.12
          : Math.sin(time * 2.1 + m.patrolPhase) * 0.08;
      }

      if (rig.tailGroup) {
        rig.tailGroup.rotation.y = Math.sin(time * (isAttacking ? 10 : 3.4) + m.patrolPhase) * (isAttacking ? 0.38 : 0.28);
        rig.tailGroup.rotation.z = Math.cos(time * 3.0 + m.patrolPhase) * 0.09;
      }

      rig.flashMaterials.forEach((mat) => {
        if (m.hitFlash > 0.05) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = m.hitFlash * 2.2;
        } else if (mat === rig.coreMat) {
          const isBossP2 = m.tier === 'BOSS' && m.hp <= m.maxHp * 0.5;
          mat.emissive.setHex(
            m.archetype === 'ACID_SPITTER'
              ? 0x22c55e
              : m.archetype === 'VOID_STALKER'
                ? 0xc026d3
                : m.archetype === 'SKITTERER'
                  ? 0xef4444
                  : isBossP2
                    ? 0xff2222
                    : 0xef4444
          );
          mat.emissiveIntensity = isTitleBoss
            ? 1.9 + Math.sin(time * 3.4) * 0.45
            : isAttacking || isBossP2
              ? 2.4
              : 1.5;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      });

      const showHp = !isTitleMenu && (m.hp < m.maxHp || m.tier === 'BOSS' || isAttacking);
      rig.hpBarBg.visible = showHp;
      rig.hpBarFill.visible = showHp;
      if (showHp) {
        const hpRatio = Math.max(0.01, Math.min(1, m.hp / m.maxHp));
        rig.hpBarFill.scale.x = hpRatio;
        rig.hpBarBg.quaternion.copy(this.camera.quaternion);
        rig.hpBarFill.quaternion.copy(this.camera.quaternion);
      }
    }

    for (const beam of this.volumetricBeams) {
      const pulse = 0.72 + 0.28 * Math.sin(time * beam.speed + beam.phase);
      beam.mat.opacity = beam.baseOpacity * pulse * (beam.highRisk ? 1.15 : 1);
    }

    if (this.listenerRig) {
      const l = world.listener;
      this.listenerRig.group.visible = l.active;
      if (l.active) {
        this.listenerRig.group.position.set(l.x * PX_TO_3D, 0, l.y * PX_TO_3D);
        this.listenerRig.bodyGroup.rotation.y = -l.angle;

        const isMoving =
          l.state === 'PATROL' || l.state === 'INVESTIGATING' || l.state === 'HUNTING';
        const strideSpeed =
          l.state === 'HUNTING' ? 9.5 : l.state === 'INVESTIGATING' ? 7.2 : 4.6;
        const stride = isMoving ? Math.sin(time * strideSpeed) * 0.42 : 0;

        this.listenerRig.bodyGroup.position.y =
          l.state === 'STAGGERED'
            ? -0.25 + Math.sin(time * 2.2) * 0.04
            : Math.abs(Math.sin(time * strideSpeed)) * (isMoving ? 0.09 : 0.02);

        this.listenerRig.leftLeg.rotation.z = stride;
        this.listenerRig.rightLeg.rotation.z = -stride;
        this.listenerRig.leftArm.rotation.z = -stride * 0.65 + Math.sin(time * 2.4) * 0.12;
        this.listenerRig.rightArm.rotation.z = stride * 0.65 - Math.sin(time * 2.4) * 0.12;

        if (l.state === 'SEARCHING' || l.state === 'INVESTIGATING') {
          this.listenerRig.headGroup.rotation.y = Math.sin(time * 3.8) * 0.38;
          this.listenerRig.headGroup.rotation.x = Math.sin(time * 2.1) * 0.14;
        } else {
          this.listenerRig.headGroup.rotation.y = Math.sin(time * 1.4) * 0.12;
          this.listenerRig.headGroup.rotation.x = l.state === 'HUNTING' ? 0.18 : 0.04;
        }

        this.listenerRig.tendrils.forEach((t, idx) => {
          t.rotation.x = Math.sin(time * 5.2 + idx * 0.9) * 0.28;
          t.rotation.z = Math.cos(time * 3.8 + idx * 1.1) * 0.18;
        });

        const stateColor =
          l.state === 'HUNTING'
            ? 0xef4444
            : l.state === 'INVESTIGATING' || l.state === 'SEARCHING'
              ? 0xf59e0b
              : l.state === 'STAGGERED'
                ? 0x64748b
                : 0x22d3ee;
        this.listenerRig.crestMat.color.setHex(stateColor);
        this.listenerRig.crestMat.emissive.setHex(stateColor);
        this.listenerRig.biolumMat.color.setHex(
          l.hitFlash > 0.05 ? 0xffffff : stateColor
        );
        this.listenerRig.biolumMat.emissive.setHex(
          l.hitFlash > 0.05 ? 0xffffff : stateColor
        );
        this.listenerRig.biolumMat.emissiveIntensity =
          l.hitFlash > 0.05 ? 2.8 : l.state === 'HUNTING' ? 2.2 : 1.35;

        (this.listenerRig.sonarRing.material as THREE.MeshBasicMaterial).color.setHex(
          stateColor
        );
        const pulse = 1 + 0.18 * Math.sin(time * (l.state === 'HUNTING' ? 9 : 4));
        this.listenerRig.sonarRing.scale.setScalar(pulse);

        const showHp = l.hp < l.maxHp || l.state === 'STAGGERED';
        this.listenerRig.hpBarBg.visible = showHp;
        this.listenerRig.hpBarFill.visible = showHp;
        if (showHp) {
          this.listenerRig.hpBarFill.scale.x = Math.max(0.01, l.hp / l.maxHp);
          this.listenerRig.hpBarBg.quaternion.copy(this.camera.quaternion);
          this.listenerRig.hpBarFill.quaternion.copy(this.camera.quaternion);
        }
      }
    }

    // 6. Sync Camera (3D Tactical Top-Down OR 3D First-Person POV OR Title Flythrough)
    this.updateCamera(world, player, viewMode, time, isTitleMenu, shakeOffset);

    // 7. Sync Lighting (Suit Flashlight + Nearest Active Dynamic Lights)
    this.updateLighting(world, player, powerRestored, time, isTitleMenu);

    // 8. Sync Projectiles, Echo Beacons & Particles
    this.syncProjectiles(projectiles);
    this.syncBeacons(activeBeacons);
    this.syncParticles(particles);

    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(
    world: StationWorldData,
    player: PlayerState,
    viewMode: ViewMode,
    time: number,
    isTitleMenu: boolean,
    shakeOffset: { x: number; y: number }
  ): void {
    const p3x = player.x * PX_TO_3D;
    const p3z = player.y * PX_TO_3D;

    if (isTitleMenu) {
      const targetFov = 52;
      if (Math.abs(this.camera.fov - targetFov) > 0.2) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
      const cx = 31.1 * UNITS_PER_TILE + Math.sin(time * 0.22) * 0.65;
      const cz = 7.35 * UNITS_PER_TILE + Math.cos(time * 0.17) * 0.38;
      this.camera.position.set(cx, 1.54 + Math.sin(time * 0.42) * 0.05, cz);
      this.camera.lookAt(31.95 * UNITS_PER_TILE, 1.34, 4.35 * UNITS_PER_TILE);
      return;
    }

    if (viewMode === 'FRONT_POV') {
      const targetFov = 70;
      if (Math.abs(this.camera.fov - targetFov) > 0.2) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
      const walkSpeed = Math.hypot(player.vx, player.vy);
      const breath = Math.sin(time * 1.65) * 0.014;
      const walkBob = walkSpeed > 15 ? Math.sin(player.walkCycle * 2) * 0.045 : 0;
      const eyeY = 1.58 + breath + walkBob + shakeOffset.y * 0.015;

      // Clamp camera position cleanly inside corridors so wall geometry never clips near-plane
      let camX = p3x + shakeOffset.x * 0.012;
      let camZ = p3z;
      const wallMargin = 0.42;
      const pCol = Math.floor(player.x / TILE_SIZE);
      const pRow = Math.floor(player.y / TILE_SIZE);
      const isSolid = (r: number, c: number) => {
        const t = world.grid[r]?.[c];
        return t === undefined || t === TileType.WALL || t === TileType.VOID || t === TileType.WINDOW_SPACE;
      };
      if (isSolid(pRow, pCol - 1)) {
        camX = Math.max(camX, pCol * UNITS_PER_TILE + wallMargin);
      }
      if (isSolid(pRow, pCol + 1)) {
        camX = Math.min(camX, (pCol + 1) * UNITS_PER_TILE - wallMargin);
      }
      if (isSolid(pRow - 1, pCol)) {
        camZ = Math.max(camZ, pRow * UNITS_PER_TILE + wallMargin);
      }
      if (isSolid(pRow + 1, pCol)) {
        camZ = Math.min(camZ, (pRow + 1) * UNITS_PER_TILE - wallMargin);
      }

      this.camera.position.set(camX, eyeY, camZ);
      const pitch = player.pitch || 0;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      this.camera.lookAt(
        camX + Math.cos(player.angle) * cosP * 10,
        eyeY + sinP * 10,
        camZ + Math.sin(player.angle) * cosP * 10
      );

      // Subtle strafe bank roll
      const rightX = -Math.sin(player.angle);
      const rightZ = Math.cos(player.angle);
      const latVel = player.vx * PX_TO_3D * rightX + player.vy * PX_TO_3D * rightZ;
      const targetRoll = -latVel * 0.0045;
      this.fpRoll += (targetRoll - this.fpRoll) * Math.min(1, this.lastDt * 10);
      this.camera.rotateZ(this.fpRoll);

      this.camInitialized = false;
      return;
    }

    // 3D Tactical / Third-Person Elevated Camera with Wall-Occlusion Avoidance
    const targetFov = 44;
    if (Math.abs(this.camera.fov - targetFov) > 0.2) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Check if solid walls lie immediately south of the player; steepen angle so walls never hide player/items
    let southWallClose = false;
    const pCol = Math.floor(player.x / TILE_SIZE);
    const pRow = Math.floor(player.y / TILE_SIZE);
    for (let dr = 1; dr <= 2; dr++) {
      const nr = pRow + dr;
      if (nr >= MAP_ROWS) {
        southWallClose = true;
        break;
      }
      const tile = world.grid[nr]?.[pCol];
      if (tile === TileType.WALL || tile === TileType.WINDOW_SPACE) {
        southWallClose = true;
        break;
      }
    }

    const desiredBackZ = southWallClose ? 2.25 : 5.4;
    const desiredHeight = southWallClose ? 14.8 : 13.4;

    const dampFactor = 1 - Math.exp(-7.5 * this.lastDt);
    this.currentBackZ += (desiredBackZ - this.currentBackZ) * dampFactor;
    this.currentHeight += (desiredHeight - this.currentHeight) * dampFactor;

    const lookAheadX = player.vx * PX_TO_3D * 0.16;
    const lookAheadZ = player.vy * PX_TO_3D * 0.16;

    const targetLookX = p3x + lookAheadX;
    const targetLookZ = p3z + lookAheadZ;
    const targetCamX = targetLookX + shakeOffset.x * 0.03;
    const targetCamY = this.currentHeight;
    const targetCamZ = targetLookZ + this.currentBackZ + shakeOffset.y * 0.03;

    if (!this.camInitialized) {
      this.camPos.set(targetCamX, targetCamY, targetCamZ);
      this.camLook.set(targetLookX, 0.75, targetLookZ);
      this.camInitialized = true;
    } else {
      const camBlend = 1 - Math.exp(-9.0 * this.lastDt);
      this.camPos.x += (targetCamX - this.camPos.x) * camBlend;
      this.camPos.y += (targetCamY - this.camPos.y) * camBlend;
      this.camPos.z += (targetCamZ - this.camPos.z) * camBlend;
      this.camLook.x += (targetLookX - this.camLook.x) * camBlend;
      this.camLook.z += (targetLookZ - this.camLook.z) * camBlend;
      this.camLook.y = 0.75;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private updateLighting(
    world: StationWorldData,
    player: PlayerState,
    powerRestored: boolean,
    time: number,
    isTitleMenu: boolean
  ): void {
    const p3x = player.x * PX_TO_3D;
    const p3z = player.y * PX_TO_3D;

    // Follow player neighborhood cleanly with directional shadow camera
    this.keyDirLight.position.set(p3x + 8, 18, p3z + 6);
    this.keyDirLight.target.position.set(p3x, 0, p3z);

    const battNorm = 0.45 + 0.55 * (player.battery / 100);
    if (isTitleMenu) {
      // Dramatic rim + key spotlight illuminating the Final Boss inside the crashed Command Deck
      this.suitAuraLight.color.setHex(0xef4444);
      this.suitAuraLight.position.set(33.9 * UNITS_PER_TILE, 2.0, 4.3 * UNITS_PER_TILE);
      this.suitAuraLight.intensity = 7.5 + Math.sin(time * 3.2) * 1.2;

      this.suitFlashlight.color.setHex(0xffedd5);
      this.suitFlashlight.position.set(30.8 * UNITS_PER_TILE, 2.3, 7.2 * UNITS_PER_TILE);
      this.suitFlashlight.target.position.set(
        33.0 * UNITS_PER_TILE,
        1.2,
        5.2 * UNITS_PER_TILE
      );
      this.suitFlashlight.intensity = 20;
    } else {
      this.suitAuraLight.color.setHex(0x38bdf8);
      this.suitAuraLight.position.set(p3x, 1.85, p3z);
      this.suitAuraLight.intensity = 4.2 * battNorm;

      this.suitFlashlight.color.setHex(0xe0f2fe);
      this.suitFlashlight.position.set(p3x, 1.48, p3z);
      const flashlightPitch = Math.sin(player.pitch || 0);
      this.suitFlashlight.target.position.set(
        p3x + Math.cos(player.angle) * 8,
        1.1 + flashlightPitch * 8,
        p3z + Math.sin(player.angle) * 8
      );
      this.suitFlashlight.intensity = 18 * battNorm;
    }

    const focusX = isTitleMenu ? 31.5 * UNITS_PER_TILE : p3x;
    const focusZ = isTitleMenu ? 7.5 * UNITS_PER_TILE : p3z;

    // Select nearest MAX_ACTIVE_LIGHTS dynamic point lights for peak FPS on laptops
    const scored = world.lights
      .map((light) => {
        const lx = light.x * PX_TO_3D;
        const lz = light.y * PX_TO_3D;
        const dSq = (lx - focusX) * (lx - focusX) + (lz - focusZ) * (lz - focusZ);
        return { light, lx, lz, dSq };
      })
      .sort((a, b) => a.dSq - b.dSq);

    for (let i = 0; i < MAX_ACTIVE_LIGHTS; i++) {
      const pl = this.pooledLights[i];
      const entry = scored[i];
      if (!entry || entry.dSq > 1100) {
        pl.intensity = 0;
        continue;
      }

      const { light, lx, lz } = entry;
      const speed = light.speed ?? 2;
      const phase = light.phase ?? 0;
      let mod = 1;
      if (light.mode === 'pulse') {
        const w = 0.5 + 0.5 * Math.sin(time * speed + phase);
        mod = light.highRisk ? 0.16 + 0.84 * Math.pow(w, 1.8) : 0.45 + 0.55 * w;
      } else if (light.mode === 'flicker') {
        const w = Math.sin(time * speed + phase) * Math.sin(time * speed * 2.7 + phase);
        mod = w > 0.35 ? 0.28 : 1.0;
      }

      const colorStr =
        powerRestored && light.powerGroup ? '#22d3ee' : light.color;
      pl.color.set(colorStr);
      pl.position.set(lx, light.highRisk ? 2.45 : 2.25, lz);
      pl.distance = Math.max(8, light.radius * PX_TO_3D * 1.35);
      pl.intensity = (light.highRisk ? 11.5 : 7.5) * light.intensity * mod;
    }
  }

  private syncProjectiles(projectiles: ProjectileEntity[]): void {
    let laserIdx = 0;
    let orbIdx = 0;

    for (const p of projectiles) {
      if (p.kind === 'MINING_LASER') {
        let mesh = this.laserBoltPool[laserIdx];
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.065, 0.065, 1.05, 8),
            new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
          );
          mesh.rotation.z = Math.PI / 2;
          this.dynamicGroup.add(mesh);
          this.laserBoltPool.push(mesh);
        }
        mesh.visible = true;
        mesh.position.set(p.x * PX_TO_3D, 1.02, p.y * PX_TO_3D);
        const ang = Math.atan2(p.vy, p.vx);
        mesh.rotation.set(0, -ang, Math.PI / 2);
        laserIdx++;
      } else {
        let mesh = this.orbBoltPool[orbIdx];
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0x4ade80 })
          );
          this.dynamicGroup.add(mesh);
          this.orbBoltPool.push(mesh);
        }
        mesh.visible = true;
        mesh.position.set(p.x * PX_TO_3D, 1.02, p.y * PX_TO_3D);
        (mesh.material as THREE.MeshBasicMaterial).color.set(p.color);
        orbIdx++;
      }
    }

    for (let i = laserIdx; i < this.laserBoltPool.length; i++) {
      this.laserBoltPool[i].visible = false;
    }
    for (let i = orbIdx; i < this.orbBoltPool.length; i++) {
      this.orbBoltPool[i].visible = false;
    }
  }

  private syncBeacons(beacons: EchoBeaconEntity[]): void {
    let idx = 0;
    for (const b of beacons) {
      let item = this.beaconRingPool[idx];
      if (!item) {
        const group = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.24, 0.34, 12),
          new THREE.MeshStandardMaterial({
            color: 0x67e8f9,
            emissive: 0x22d3ee,
            emissiveIntensity: 2.4,
          })
        );
        core.position.y = 0.17;
        group.add(core);

        const rings: THREE.Mesh[] = [];
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.84, 1.04, 36),
            new THREE.MeshBasicMaterial({
              color: rIdx === 1 ? 0x67e8f9 : 0x22d3ee,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.04 + rIdx * 0.025;
          group.add(ring);
          rings.push(ring);
        }

        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.14,
            wireframe: false,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        group.add(dome);

        const light = new THREE.PointLight(0x22d3ee, 10, 14, 1.4);
        light.position.y = 0.75;
        group.add(light);

        this.dynamicGroup.add(group);
        item = { group, rings, dome, light };
        this.beaconRingPool.push(item);
      }

      item.group.visible = true;
      item.group.position.set(b.x * PX_TO_3D, 0, b.y * PX_TO_3D);
      const progress = 1 - b.life / b.maxLife;
      const baseCycle = progress * 4.2;

      item.rings.forEach((ring, rIdx) => {
        const wavePhase = (baseCycle + rIdx * 0.33) % 1;
        ring.scale.setScalar(0.35 + wavePhase * 3.6);
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          (1 - wavePhase) * 0.85
        );
      });

      const domePhase = baseCycle % 1;
      item.dome.scale.setScalar(0.4 + domePhase * 3.1);
      (item.dome.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        (1 - domePhase) * 0.2
      );
      item.light.intensity = 6.5 + (1 - domePhase) * 8.5;
      idx++;
    }

    for (let i = idx; i < this.beaconRingPool.length; i++) {
      this.beaconRingPool[i].group.visible = false;
      this.beaconRingPool[i].light.intensity = 0;
    }
  }

  private syncParticles(particles: Particle[]): void {
    const count = Math.min(MAX_PARTICLES, particles.length);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const lifeFade = 1 - p.life / p.maxLife;
      const py =
        p.kind === 'SMOKE'
          ? 0.65 + (p.life / p.maxLife) * 1.9
          : p.kind === 'SPARK'
            ? 0.95 + Math.sin((p.life / p.maxLife) * Math.PI) * 0.65
            : 0.45 + (i % 5) * 0.38;
      const s =
        p.kind === 'SMOKE'
          ? 0.8 + p.size * 0.14
          : Math.max(0.25, p.size * 0.45 * lifeFade);

      _v1.set(p.x * PX_TO_3D, py, p.y * PX_TO_3D);
      _scale.set(s, s, s);
      _quat.identity();
      _mat4.compose(_v1, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
      _color.set(p.color);
      this.particleMesh.setColorAt(i, _color);
    }

    this.particleMesh.count = count;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.clearWorldGroups();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.mats.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
    }
    this.renderer.dispose();
  }
}

// Unused vector reference keeper to avoid lint noise on module-scope helpers
void _v2;
void _up;
