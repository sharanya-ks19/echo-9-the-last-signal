import * as THREE from 'three';
import {
  CreatureArchetype,
  DoorEntity,
  PickupEntity,
  PropEntity,
  TerminalEntity,
} from './types';
import { StationMaterialLibrary } from './threeMaterials';
import { bossSpriteLoader } from './bossSprite';

export const UNITS_PER_TILE = 2.4;
export const PX_TO_3D = UNITS_PER_TILE / 48; // 0.05 meters per 2D pixel
export const WALL_HEIGHT = 2.75;

export interface PlayerRig3D {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  laserTipMat: THREE.MeshStandardMaterial;
  muzzleFlash: THREE.Mesh;
}

export interface MonsterRig3D {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftLimb?: THREE.Object3D;
  rightLimb?: THREE.Object3D;
  headGroup?: THREE.Object3D;
  tailGroup?: THREE.Object3D;
  legs?: THREE.Object3D[];
  coreMat?: THREE.MeshStandardMaterial;
  ringMesh: THREE.Mesh;
  hpBarBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  flashMaterials: THREE.MeshStandardMaterial[];
  spriteStandee?: {
    sprite: THREE.Sprite;
    material: THREE.SpriteMaterial;
    baseW: number;
    baseH: number;
  };
}

export interface ListenerRig3D {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  tendrils: THREE.Mesh[];
  crestMat: THREE.MeshStandardMaterial;
  biolumMat: THREE.MeshStandardMaterial;
  sonarRing: THREE.Mesh;
  hpBarBg: THREE.Mesh;
  hpBarFill: THREE.Mesh;
}

export interface DoorRig3D {
  group: THREE.Group;
  leftLeaf: THREE.Group;
  rightLeaf: THREE.Group;
  statusMaterials: THREE.MeshStandardMaterial[];
  maxSlide: number;
  orientation: 'horizontal' | 'vertical';
}

export function buildPlayerModel(mats: StationMaterialLibrary): PlayerRig3D {
  const group = new THREE.Group();

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x26354d,
    roughness: 0.42,
    metalness: 0.65,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.72,
    metalness: 0.25,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0.85,
  });
  const cutterBodyMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.38,
    metalness: 0.55,
  });
  const laserTipMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 2.0,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    mats.contactShadowMat
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  group.add(shadow);

  // Legs (articulated along +/- Z since player faces +X)
  const legGeo = new THREE.BoxGeometry(0.28, 0.72, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, bootMat);
  leftLeg.position.set(0, 0.36, -0.18);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, bootMat);
  rightLeg.position.set(0, 0.36, 0.18);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Torso armor
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.72, 0.68),
    armorMat
  );
  torso.position.set(0, 1.02, 0);
  torso.castShadow = true;
  group.add(torso);

  // Dorsal life-support oxygen pack + telemetry strip
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.56, 0.48),
    mats.wallTrimMat
  );
  pack.position.set(-0.34, 1.04, 0);
  pack.castShadow = true;
  group.add(pack);

  const packLed = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.1), visorMat);
  packLed.position.set(-0.49, 1.04, 0);
  group.add(packLed);

  // Helmet + curved visor facing +X
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    mats.wallPillarMat
  );
  helmet.position.set(0.04, 1.56, 0);
  helmet.castShadow = true;
  group.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.34),
    visorMat
  );
  visor.position.set(0.22, 1.56, 0);
  group.add(visor);

  // Left stabilizer arm
  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.18),
    armorMat
  );
  leftArm.position.set(0.18, 1.12, -0.4);
  leftArm.castShadow = true;
  group.add(leftArm);

  // Right arm holding MK-IV Industrial Mining Laser Cutter
  const rightArm = new THREE.Group();
  rightArm.position.set(0.1, 1.1, 0.38);

  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.18, 0.18),
    armorMat
  );
  sleeve.position.set(0.16, 0, 0);
  rightArm.add(sleeve);

  const cutterHull = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.22, 0.2),
    cutterBodyMat
  );
  cutterHull.position.set(0.46, 0.02, 0);
  cutterHull.castShadow = true;
  rightArm.add(cutterHull);

  const emitterTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.075, 0.22, 8),
    laserTipMat
  );
  emitterTip.rotation.z = -Math.PI / 2;
  emitterTip.position.set(0.78, 0.02, 0);
  rightArm.add(emitterTip);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
    })
  );
  muzzleFlash.position.set(0.95, 0.02, 0);
  rightArm.add(muzzleFlash);

  group.add(rightArm);

  return {
    group,
    leftLeg,
    rightLeg,
    rightArm,
    laserTipMat,
    muzzleFlash,
  };
}

export function buildFirstPersonLaserRig(): {
  group: THREE.Group;
  heatBarFill: THREE.Mesh;
  heatMat: THREE.MeshStandardMaterial;
  muzzleBeam: THREE.Mesh;
} {
  const group = new THREE.Group();

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
    metalness: 0.8,
  });
  const yellowFrameMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.36,
    metalness: 0.45,
  });
  const heatMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });

  // Main chassis angled slightly forward-left toward crosshair
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.2, 0.65),
    housingMat
  );
  body.position.set(0, 0, -0.2);
  group.add(body);

  const cowl = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.09, 0.38),
    yellowFrameMat
  );
  cowl.position.set(0, 0.09, -0.15);
  group.add(cowl);

  // Twin industrial focusing prongs
  const prongGeo = new THREE.BoxGeometry(0.045, 0.055, 0.26);
  const leftProng = new THREE.Mesh(prongGeo, housingMat);
  leftProng.position.set(-0.07, 0.04, -0.58);
  group.add(leftProng);

  const rightProng = new THREE.Mesh(prongGeo, housingMat);
  rightProng.position.set(0.07, 0.04, -0.58);
  group.add(rightProng);

  // Emitter coils on prong tips
  const tipGeo = new THREE.BoxGeometry(0.03, 0.03, 0.08);
  const tipL = new THREE.Mesh(tipGeo, heatMat);
  tipL.position.set(-0.07, 0.04, -0.71);
  group.add(tipL);
  const tipR = new THREE.Mesh(tipGeo, heatMat);
  tipR.position.set(0.07, 0.04, -0.71);
  group.add(tipR);

  // Thermal gauge on top rear of weapon
  const gaugeBg = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.025, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x020617 })
  );
  gaugeBg.position.set(0, 0.14, 0.01);
  group.add(gaugeBg);

  const heatBarFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.025),
    heatMat
  );
  heatBarFill.position.set(0, 0.142, 0.01);
  group.add(heatBarFill);

  // Discharge beam flash extending from muzzle
  const muzzleBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.04, 1.4, 8),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
    })
  );
  muzzleBeam.rotation.x = Math.PI / 2;
  muzzleBeam.position.set(0, 0.04, -1.35);
  group.add(muzzleBeam);

  return { group, heatBarFill, heatMat, muzzleBeam };
}

export function buildDoorAssembly(
  door: DoorEntity,
  mats: StationMaterialLibrary
): DoorRig3D {
  const group = new THREE.Group();
  const spanW =
    door.orientation === 'horizontal'
      ? door.tilesW * UNITS_PER_TILE
      : door.tilesH * UNITS_PER_TILE;
  const spanDepth = UNITS_PER_TILE * 0.44;
  const cx = (door.tileX + door.tilesW * 0.5) * UNITS_PER_TILE;
  const cz = (door.tileY + door.tilesH * 0.5) * UNITS_PER_TILE;
  group.position.set(cx, 0, cz);
  if (door.orientation === 'vertical') {
    group.rotation.y = Math.PI / 2;
  }

  // Heavy bulkhead jambs and upper lintel beam
  const jambGeo = new THREE.BoxGeometry(0.32, WALL_HEIGHT, spanDepth + 0.18);
  const leftJamb = new THREE.Mesh(jambGeo, mats.wallPillarMat);
  leftJamb.position.set(-spanW * 0.5 + 0.1, WALL_HEIGHT * 0.5, 0);
  leftJamb.castShadow = true;
  leftJamb.receiveShadow = true;
  group.add(leftJamb);

  const rightJamb = new THREE.Mesh(jambGeo, mats.wallPillarMat);
  rightJamb.position.set(spanW * 0.5 - 0.1, WALL_HEIGHT * 0.5, 0);
  rightJamb.castShadow = true;
  rightJamb.receiveShadow = true;
  group.add(rightJamb);

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(spanW, 0.42, spanDepth + 0.22),
    mats.wallTrimMat
  );
  lintel.position.set(0, WALL_HEIGHT - 0.21, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const leafW = spanW * 0.5;
  const leafH = WALL_HEIGHT - 0.42;

  const statusColor = door.locked ? 0xef4444 : 0xf59e0b;
  const statusMat = new THREE.MeshStandardMaterial({
    color: statusColor,
    emissive: statusColor,
    emissiveIntensity: 1.6,
    roughness: 0.25,
  });

  const makeLeaf = (side: -1 | 1): THREE.Group => {
    const leaf = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(leafW, leafH, spanDepth * 0.72),
      mats.wallMainMat
    );
    plate.position.set(side * leafW * 0.5, leafH * 0.5, 0);
    plate.castShadow = true;
    plate.receiveShadow = true;
    leaf.add(plate);

    // Armored reinforced rib across door leaf
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(leafW * 0.88, 0.28, spanDepth * 0.86),
      mats.wallTrimMat
    );
    rib.position.set(side * leafW * 0.5, leafH * 0.48, 0);
    leaf.add(rib);

    // Dual-sided status LED strip
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(leafW * 0.75, 0.08, spanDepth * 0.92),
      statusMat
    );
    led.position.set(side * leafW * 0.5, leafH * 0.65, 0);
    leaf.add(led);

    group.add(leaf);
    return leaf;
  };

  const leftLeaf = makeLeaf(-1);
  const rightLeaf = makeLeaf(1);

  return {
    group,
    leftLeaf,
    rightLeaf,
    statusMaterials: [statusMat],
    maxSlide: leafW * 0.88,
    orientation: door.orientation,
  };
}

export function buildMonsterModel(
  archetype: CreatureArchetype,
  radiusPx: number,
  mats: StationMaterialLibrary
): MonsterRig3D {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const flashMaterials: THREE.MeshStandardMaterial[] = [];
  const trackMat = (m: THREE.MeshStandardMaterial) => {
    flashMaterials.push(m);
    return m;
  };

  const scale = (radiusPx / 16) * 0.95;
  bodyGroup.scale.setScalar(scale);

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85 * scale, 1.85 * scale),
    mats.contactShadowMat
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.016;
  group.add(shadow);

  // Ground tactical threat ring
  const ringColor =
    archetype === 'ACID_SPITTER'
      ? 0x4ade80
      : archetype === 'VOID_STALKER'
        ? 0xc084fc
        : archetype === 'APEX_BOSS'
          ? 0xef4444
          : 0xf59e0b;
  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.76 * scale, 0.92 * scale, 24),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.025;
  group.add(ringMesh);

  let leftLimb: THREE.Object3D | undefined;
  let rightLimb: THREE.Object3D | undefined;
  let headGroup: THREE.Object3D | undefined;
  let tailGroup: THREE.Object3D | undefined;
  const legs: THREE.Object3D[] = [];
  let coreMat: THREE.MeshStandardMaterial | undefined;
  let spriteStandee: MonsterRig3D['spriteStandee'];

  // Helper: 2-segment digitigrade creature leg (hip -> thigh -> hock -> shin -> 3 talons)
  const buildDigitigradeLeg = (
    parent: THREE.Object3D,
    hipPos: THREE.Vector3,
    skinMat: THREE.Material,
    clawMat: THREE.Material,
    legScale = 1.0
  ): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.copy(hipPos);

    const hipJoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 * legScale, 8, 6),
      skinMat
    );
    leg.add(hipJoint);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085 * legScale, 0.28 * legScale, 4, 8),
      skinMat
    );
    thigh.position.set(0.08 * legScale, -0.18 * legScale, 0);
    thigh.rotation.z = 0.42;
    thigh.castShadow = true;
    leg.add(thigh);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062 * legScale, 0.042 * legScale, 0.36 * legScale, 7),
      skinMat
    );
    shin.position.set(0.02 * legScale, -0.44 * legScale, 0);
    shin.rotation.z = -0.32;
    shin.castShadow = true;
    leg.add(shin);

    const footPad = new THREE.Mesh(
      new THREE.SphereGeometry(0.068 * legScale, 7, 6),
      skinMat
    );
    footPad.scale.set(1.3, 0.55, 1.15);
    footPad.position.set(0.1 * legScale, -hipPos.y + 0.045 * legScale, 0);
    leg.add(footPad);

    for (let t = -1; t <= 1; t++) {
      const talon = new THREE.Mesh(
        new THREE.ConeGeometry(0.024 * legScale, 0.16 * legScale, 5),
        clawMat
      );
      talon.rotation.z = -Math.PI / 2.15;
      talon.rotation.y = t * 0.28;
      talon.position.set(0.2 * legScale, -hipPos.y + 0.035 * legScale, t * 0.045 * legScale);
      leg.add(talon);
    }

    parent.add(leg);
    return leg;
  };

  // Helper: Articulated tapering organic tail
  const buildSegmentedTail = (
    parent: THREE.Object3D,
    rootPos: THREE.Vector3,
    segments: number,
    baseRadius: number,
    segLen: number,
    skinMat: THREE.Material,
    spineMat: THREE.Material,
    upCurve = 0.14,
    barbedTip = false
  ): THREE.Group => {
    const tailRoot = new THREE.Group();
    tailRoot.position.copy(rootPos);
    let cursorX = 0;
    let cursorY = 0;

    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      const r0 = baseRadius * (1 - t * 0.72);
      const r1 = baseRadius * (1 - ((s + 1) / segments) * 0.78);
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(r1, r0, segLen, 7),
        skinMat
      );
      seg.rotation.z = Math.PI / 2 + upCurve * (s - 0.5);
      seg.position.set(cursorX - segLen * 0.48, cursorY, 0);
      seg.castShadow = true;
      tailRoot.add(seg);

      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(r0 * 0.42, r0 * 1.45, 5),
        spineMat
      );
      spike.position.set(cursorX - segLen * 0.42, cursorY + r0 * 0.95, 0);
      spike.rotation.z = 0.35;
      tailRoot.add(spike);

      cursorX -= segLen * 0.88;
      cursorY += upCurve * s * segLen * 0.65;
    }

    if (barbedTip) {
      const stinger = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 0.42, segLen * 1.5, 6),
        spineMat
      );
      stinger.rotation.z = Math.PI / 2 - 0.35;
      stinger.position.set(cursorX - segLen * 0.45, cursorY + 0.08, 0);
      tailRoot.add(stinger);
    }

    parent.add(tailRoot);
    return tailRoot;
  };

  if (archetype === 'SKITTERER') {
    // Organic Arachnid Bio-Horror: segmented cephalothorax, bulbous abdomen, 6 jointed clawed legs, 6 eyes & pincer fangs
    const carapaceMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x6b1d28,
        map: mats.chitinShellTex,
        bumpMap: mats.creatureBumpTex,
        bumpScale: 0.045,
        roughness: 0.44,
        metalness: 0.08,
      })
    );
    const fleshMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b1219,
        roughness: 0.62,
        metalness: 0.05,
      })
    );
    const fangMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd6cbb8,
        roughness: 0.32,
        metalness: 0.08,
      })
    );
    const eyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xef4444,
        emissiveIntensity: 1.9,
        roughness: 0.15,
      })
    );
    coreMat = eyeMat;

    // Forward cephalothorax
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), carapaceMat);
    thorax.scale.set(1.25, 0.68, 0.95);
    thorax.position.set(0.22, 0.46, 0);
    thorax.castShadow = true;
    bodyGroup.add(thorax);

    // Bulbous veined posterior abdomen + dorsal chitin shell plates
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), carapaceMat);
    abdomen.scale.set(1.42, 0.88, 1.05);
    abdomen.position.set(-0.34, 0.56, 0);
    abdomen.rotation.z = 0.18;
    abdomen.castShadow = true;
    bodyGroup.add(abdomen);

    for (let p = 0; p < 3; p++) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.34 - p * 0.05, 0.045, 6, 12, Math.PI * 1.15),
        fleshMat
      );
      arch.position.set(-0.2 - p * 0.16, 0.56 + p * 0.03, 0);
      arch.rotation.y = Math.PI / 2;
      arch.rotation.z = -Math.PI * 0.08;
      bodyGroup.add(arch);
    }

    const spinneret = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), fangMat);
    spinneret.rotation.z = Math.PI / 2 + 0.2;
    spinneret.position.set(-0.92, 0.64, 0);
    bodyGroup.add(spinneret);

    // 6 Multi-jointed articulated spider legs (hip -> ascending femur -> knee -> descending spiked tibia)
    const legsGroupL = new THREE.Group();
    const legsGroupR = new THREE.Group();
    const xOffsets = [0.28, 0.04, -0.2];
    xOffsets.forEach((xo, idx) => {
      for (const side of [-1, 1] as const) {
        const legPivot = new THREE.Group();
        legPivot.position.set(xo, 0.42, side * 0.24);
        legPivot.rotation.y = side * (0.35 - idx * 0.35);

        const coxa = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 6), fleshMat);
        legPivot.add(coxa);

        const femur = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.34, 4, 7), carapaceMat);
        femur.position.set(0, 0.14, side * 0.22);
        femur.rotation.x = side * 0.95;
        femur.castShadow = true;
        legPivot.add(femur);

        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6), fleshMat);
        knee.position.set(0, 0.26, side * 0.42);
        legPivot.add(knee);

        const tibia = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.52, 6), fangMat);
        tibia.position.set(0, -0.08, side * 0.54);
        tibia.rotation.x = side * (Math.PI - 0.36);
        tibia.castShadow = true;
        legPivot.add(tibia);

        if (side === -1) legsGroupL.add(legPivot);
        else legsGroupR.add(legPivot);
        legs.push(legPivot);
      }
    });
    bodyGroup.add(legsGroupL, legsGroupR);
    leftLimb = legsGroupL;
    rightLimb = legsGroupR;

    // Spider Head Group: 6 glowing clustered sphere eyes + curved serrated pincer chelicerae
    const arachnidHead = new THREE.Group();
    arachnidHead.position.set(0.52, 0.45, 0);

    const eyeOffsets: [number, number, number, number][] = [
      [0.12, 0.08, -0.08, 0.052],
      [0.12, 0.08, 0.08, 0.052],
      [0.08, 0.14, -0.16, 0.036],
      [0.08, 0.14, 0.16, 0.036],
      [0.04, 0.04, -0.18, 0.03],
      [0.04, 0.04, 0.18, 0.03],
    ];
    for (const [ex, ey, ez, er] of eyeOffsets) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(er, 7, 7), eyeMat);
      eye.position.set(ex, ey, ez);
      arachnidHead.add(eye);
    }

    for (const side of [-1, 1] as const) {
      const chelicera = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 7), fleshMat);
      chelicera.rotation.z = -Math.PI / 2.2;
      chelicera.rotation.y = side * -0.25;
      chelicera.position.set(0.14, -0.04, side * 0.13);
      arachnidHead.add(chelicera);

      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 6), fangMat);
      fang.rotation.z = -Math.PI / 1.7;
      fang.rotation.y = side * 0.45;
      fang.position.set(0.24, -0.09, side * 0.08);
      arachnidHead.add(fang);
    }

    bodyGroup.add(arachnidHead);
    headGroup = arachnidHead;
  } else if (archetype === 'ACID_SPITTER') {
    // Hunched Amphibious Bio-Spitter: mottled green skin, pulsing dorsal venom sacs, fanged maw & whip tail
    const skinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x224c34,
        map: mats.acidSkinTex,
        bumpMap: mats.creatureBumpTex,
        bumpScale: 0.055,
        roughness: 0.46,
        metalness: 0.06,
      })
    );
    const bellyMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x163324,
        roughness: 0.58,
        metalness: 0.04,
      })
    );
    const fangMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe7e0cc,
        roughness: 0.34,
        metalness: 0.08,
      })
    );
    const sacMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4ade80,
        emissive: 0x22c55e,
        emissiveIntensity: 1.55,
        roughness: 0.18,
      })
    );
    coreMat = sacMat;

    // Hunched amphibious torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.52, 6, 10), skinMat);
    torso.position.set(0.02, 0.78, 0);
    torso.rotation.z = -0.68;
    torso.castShadow = true;
    bodyGroup.add(torso);

    // Swollen pulsating toxic bile sacs clustered along back & throat
    const sacSpecs: [number, number, number, number][] = [
      [-0.12, 1.06, 0, 0.24],
      [-0.28, 0.96, -0.16, 0.17],
      [-0.28, 0.96, 0.16, 0.17],
      [0.06, 1.12, 0.14, 0.14],
      [0.06, 1.12, -0.14, 0.14],
    ];
    for (const [sx, sy, sz, sr] of sacSpecs) {
      const sac = new THREE.Mesh(new THREE.SphereGeometry(sr, 10, 8), sacMat);
      sac.scale.set(1.15, 0.9, 0.95);
      sac.position.set(sx, sy, sz);
      sac.castShadow = true;
      bodyGroup.add(sac);
    }

    // Articulated hind legs + clawed front limbs
    legs.push(
      buildDigitigradeLeg(bodyGroup, new THREE.Vector3(-0.12, 0.58, -0.26), skinMat, fangMat, 0.95),
      buildDigitigradeLeg(bodyGroup, new THREE.Vector3(-0.12, 0.58, 0.26), skinMat, fangMat, 0.95)
    );

    const makeFrontClaw = (side: -1 | 1): THREE.Group => {
      const arm = new THREE.Group();
      arm.position.set(0.24, 0.74, side * 0.26);
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.34, 4, 7), bellyMat);
      limb.position.set(0.08, -0.2, 0);
      limb.rotation.z = 0.25;
      arm.add(limb);
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.14, 5), fangMat);
        claw.rotation.z = -Math.PI / 2.2;
        claw.position.set(0.2, -0.38, c * 0.04);
        arm.add(claw);
      }
      bodyGroup.add(arm);
      return arm;
    };
    leftLimb = makeFrontClaw(-1);
    rightLimb = makeFrontClaw(1);

    // Wide fanged viper-amphibian head with open venomous maw
    const spitterHead = new THREE.Group();
    spitterHead.position.set(0.36, 0.98, 0);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
    cranium.scale.set(1.38, 0.62, 1.12);
    cranium.castShadow = true;
    spitterHead.add(cranium);

    const lowerJaw = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.24, 4, 8), bellyMat);
    lowerJaw.rotation.z = Math.PI / 2.4;
    lowerJaw.position.set(0.16, -0.14, 0);
    spitterHead.add(lowerJaw);

    // Glowing acid maw core inside open jaws
    const mawGlow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), sacMat);
    mawGlow.position.set(0.22, -0.05, 0);
    spitterHead.add(mawGlow);

    for (const side of [-1, 1] as const) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 7), sacMat);
      eye.position.set(0.14, 0.08, side * 0.17);
      spitterHead.add(eye);

      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.13, 5), fangMat);
      fang.rotation.z = Math.PI - 0.18;
      fang.position.set(0.26, -0.04, side * 0.11);
      spitterHead.add(fang);
    }

    bodyGroup.add(spitterHead);
    headGroup = spitterHead;

    tailGroup = buildSegmentedTail(
      bodyGroup,
      new THREE.Vector3(-0.34, 0.56, 0),
      4,
      0.14,
      0.24,
      skinMat,
      sacMat,
      0.1
    );
  } else if (archetype === 'VOID_STALKER') {
    // Stealth Xenomorphic Bio-Predator: curved spine ribs, swept skull, barbed whip tail, mantis scythe claws
    const chitinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2e174d,
        map: mats.chitinShellTex,
        bumpMap: mats.creatureBumpTex,
        bumpScale: 0.05,
        roughness: 0.34,
        metalness: 0.14,
      })
    );
    const sinewMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a0d2e,
        roughness: 0.56,
        metalness: 0.08,
      })
    );
    const clawBladeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.26,
        metalness: 0.22,
      })
    );
    const eyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe879f9,
        emissive: 0xc026d3,
        emissiveIntensity: 1.9,
        roughness: 0.15,
      })
    );
    coreMat = eyeMat;

    // Digitigrade hunter legs
    legs.push(
      buildDigitigradeLeg(bodyGroup, new THREE.Vector3(-0.06, 0.72, -0.22), chitinMat, clawBladeMat, 1.05),
      buildDigitigradeLeg(bodyGroup, new THREE.Vector3(-0.06, 0.72, 0.22), chitinMat, clawBladeMat, 1.05)
    );

    // Lean arched predatory spine & ribcage
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.62, 6, 10), chitinMat);
    torso.position.set(0.08, 1.12, 0);
    torso.rotation.z = -0.42;
    torso.castShadow = true;
    bodyGroup.add(torso);

    for (let r = 0; r < 4; r++) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(0.22 - r * 0.015, 0.028, 6, 10, Math.PI * 1.25),
        sinewMat
      );
      rib.position.set(0.02 + r * 0.06, 0.96 + r * 0.11, 0);
      rib.rotation.x = Math.PI / 2;
      rib.rotation.z = -0.4;
      bodyGroup.add(rib);

      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.22, 5), clawBladeMat);
      spine.position.set(-0.14 + r * 0.06, 1.04 + r * 0.12, 0);
      spine.rotation.z = 0.75;
      bodyGroup.add(spine);
    }

    // Elongated swept-back xenomorphic skull with 4 predator eyes + fangs
    const stalkerHead = new THREE.Group();
    stalkerHead.position.set(0.26, 1.56, 0);

    const skullDome = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.56, 6, 10), chitinMat);
    skullDome.rotation.z = Math.PI / 2.65;
    skullDome.position.set(-0.04, 0.1, 0);
    skullDome.castShadow = true;
    stalkerHead.add(skullDome);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 7), sinewMat);
    snout.rotation.z = -Math.PI / 2.1;
    snout.position.set(0.26, -0.02, 0);
    stalkerHead.add(snout);

    for (const side of [-1, 1] as const) {
      const eyeMain = new THREE.Mesh(new THREE.SphereGeometry(0.042, 7, 7), eyeMat);
      eyeMain.position.set(0.22, 0.04, side * 0.11);
      stalkerHead.add(eyeMain);

      const eyeSub = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), eyeMat);
      eyeSub.position.set(0.14, 0.09, side * 0.14);
      stalkerHead.add(eyeSub);

      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.26, 5), clawBladeMat);
      horn.rotation.z = 0.95;
      horn.rotation.y = side * -0.2;
      horn.position.set(-0.12, 0.18, side * 0.11);
      stalkerHead.add(horn);
    }

    bodyGroup.add(stalkerHead);
    headGroup = stalkerHead;

    // Curved 2-part biological sickle mantis arms
    const makeMantisScythe = (side: -1 | 1): THREE.Group => {
      const arm = new THREE.Group();
      arm.position.set(0.14, 1.32, side * 0.28);

      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), sinewMat);
      arm.add(shoulder);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.34, 4, 7), chitinMat);
      upper.position.set(0.12, -0.18, side * 0.04);
      upper.rotation.z = 0.45;
      arm.add(upper);

      const scytheBase = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.48, 6), clawBladeMat);
      scytheBase.rotation.z = -Math.PI / 1.9;
      scytheBase.position.set(0.42, -0.28, side * 0.02);
      scytheBase.castShadow = true;
      arm.add(scytheBase);

      const scytheHook = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.36, 5), clawBladeMat);
      scytheHook.rotation.z = -Math.PI / 1.35;
      scytheHook.position.set(0.72, -0.38, side * 0.01);
      arm.add(scytheHook);

      bodyGroup.add(arm);
      return arm;
    };

    leftLimb = makeMantisScythe(-1);
    rightLimb = makeMantisScythe(1);

    tailGroup = buildSegmentedTail(
      bodyGroup,
      new THREE.Vector3(-0.16, 0.88, 0),
      5,
      0.11,
      0.24,
      chitinMat,
      clawBladeMat,
      0.22,
      true
    );
  } else {
    // SENTINEL (Reptilian Stalker Beast) & APEX_BOSS (Hive Leviathan Warlord)
    // Purely biological, organic predatory monsters — ZERO metal armor plates or boxes!
    const isBoss = archetype === 'APEX_BOSS';
    const scaleBody = isBoss ? 1.24 : 1.0;

    const hideMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBoss ? 0x611c27 : 0x4d2229,
        map: mats.reptileHideTex,
        bumpMap: mats.creatureBumpTex,
        bumpScale: 0.065,
        roughness: 0.56,
        metalness: 0.08,
      })
    );
    const bellyHideMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBoss ? 0x2e1118 : 0x2a1419,
        roughness: 0.68,
        metalness: 0.05,
      })
    );
    const boneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBoss ? 0xd9cbb4 : 0xe4dac6,
        roughness: 0.32,
        metalness: 0.08,
      })
    );
    const eyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBoss ? 0xff3b3b : 0xf87171,
        emissive: isBoss ? 0xef4444 : 0xdc2626,
        emissiveIntensity: isBoss ? 2.2 : 1.65,
        roughness: 0.15,
      })
    );
    coreMat = eyeMat;

    const beast = new THREE.Group();
    beast.scale.setScalar(scaleBody);

    // Powerful digitigrade raptor/reptile legs
    legs.push(
      buildDigitigradeLeg(beast, new THREE.Vector3(-0.08, 0.72, -0.26), hideMat, boneMat, 1.08),
      buildDigitigradeLeg(beast, new THREE.Vector3(-0.08, 0.72, 0.26), hideMat, boneMat, 1.08)
    );

    // Muscular crouched reptilian torso + bulging chest & shoulder muscles
    const spineTorso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.58, 6, 12),
      hideMat
    );
    spineTorso.position.set(0.05, 1.12, 0);
    spineTorso.rotation.z = -0.34;
    spineTorso.scale.set(1.02, 1.0, 1.18);
    spineTorso.castShadow = true;
    beast.add(spineTorso);

    // Muscular ribcage / glowing furnace core fissure on Boss
    for (const side of [-1, 1] as const) {
      const shoulderMuscle = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        hideMat
      );
      shoulderMuscle.scale.set(1.12, 0.92, 1.05);
      shoulderMuscle.position.set(0.14, 1.36, side * 0.34);
      shoulderMuscle.castShadow = true;
      beast.add(shoulderMuscle);

      // Shoulder bone spikes
      const shSpike = new THREE.Mesh(
        new THREE.ConeGeometry(0.065, isBoss ? 0.42 : 0.28, 6),
        boneMat
      );
      shSpike.position.set(0.08, 1.6, side * 0.4);
      shSpike.rotation.x = side * 0.48;
      shSpike.rotation.z = 0.25;
      beast.add(shSpike);
    }

    if (isBoss) {
      const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), eyeMat);
      chestCore.position.set(0.34, 1.18, 0);
      beast.add(chestCore);

      for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(0.33 - r * 0.03, 0.036, 6, 12, Math.PI * 1.1),
          boneMat
        );
        rib.position.set(0.06 + r * 0.05, 1.04 + r * 0.13, 0);
        rib.rotation.x = Math.PI / 2;
        rib.rotation.z = -0.32;
        beast.add(rib);
      }
    }

    // Serrated dorsal spine ridge down neck & back
    const numSpines = isBoss ? 6 : 4;
    for (let s = 0; s < numSpines; s++) {
      const sp = new THREE.Mesh(
        new THREE.ConeGeometry(isBoss ? 0.07 : 0.052, isBoss ? 0.36 - s * 0.03 : 0.25, 5),
        boneMat
      );
      sp.position.set(0.08 - s * 0.1, 1.56 - s * 0.12, 0);
      sp.rotation.z = 0.72 + s * 0.08;
      beast.add(sp);
    }

    // Elongated Snarling Reptilian Skull + Curved Horns + Fangs + Sunken Sphere Eyes
    const beastHead = new THREE.Group();
    beastHead.position.set(0.28, 1.56, 0);

    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.24, 5, 8), hideMat);
    neck.rotation.z = -0.65;
    neck.position.set(-0.08, -0.06, 0);
    beastHead.add(neck);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), hideMat);
    cranium.scale.set(1.22, 0.85, 0.96);
    cranium.castShadow = true;
    beastHead.add(cranium);

    // Tapered upper reptilian snout
    const upperSnout = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 5, 8), hideMat);
    upperSnout.rotation.z = -Math.PI / 2.05;
    upperSnout.position.set(0.24, 0.01, 0);
    upperSnout.castShadow = true;
    beastHead.add(upperSnout);

    // Open roaring lower jaw
    const lowerJaw = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.28, 5, 8), bellyHideMat);
    lowerJaw.rotation.z = -Math.PI / 2.55;
    lowerJaw.position.set(0.2, -0.14, 0);
    beastHead.add(lowerJaw);

    // Glowing mouth interior & sharp upper/lower ivory fangs
    const throatGlow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeMat);
    throatGlow.position.set(0.18, -0.06, 0);
    beastHead.add(throatGlow);

    for (const side of [-1, 1] as const) {
      // Sunken glowing predator eye under curved brow ridge
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), eyeMat);
      eye.position.set(0.18, 0.08, side * 0.14);
      beastHead.add(eye);

      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.14, 4, 6), boneMat);
      brow.rotation.z = Math.PI / 2.2;
      brow.rotation.y = side * 0.3;
      brow.position.set(0.14, 0.13, side * 0.15);
      beastHead.add(brow);

      // Swept-back curved horns (massive curved wyvern horns for Boss)
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(isBoss ? 0.068 : 0.046, isBoss ? 0.54 : 0.34, 6),
        boneMat
      );
      horn.rotation.z = 0.85;
      horn.rotation.x = side * -0.32;
      horn.position.set(-0.14, 0.22, side * 0.16);
      beastHead.add(horn);

      // Upper & lower fangs
      const fangTop = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.13, 5), boneMat);
      fangTop.rotation.z = Math.PI - 0.15;
      fangTop.position.set(0.32, -0.07, side * 0.085);
      beastHead.add(fangTop);

      const fangBot = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.11, 5), boneMat);
      fangBot.rotation.z = -0.15;
      fangBot.position.set(0.28, -0.14, side * 0.075);
      beastHead.add(fangBot);
    }

    beast.add(beastHead);
    headGroup = beastHead;

    // Articulated muscular arms with curved organic bone-talon claws
    const makeBeastArm = (side: -1 | 1): THREE.Group => {
      const arm = new THREE.Group();
      arm.position.set(0.14, 1.32, side * 0.4);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.32, 4, 8), hideMat);
      upper.position.set(0.08, -0.18, 0);
      upper.rotation.z = 0.25;
      upper.castShadow = true;
      arm.add(upper);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 4, 8), bellyHideMat);
      forearm.position.set(0.22, -0.4, 0);
      forearm.rotation.z = 0.78;
      forearm.castShadow = true;
      arm.add(forearm);

      // Curved bone spur / mutated talon blade fused along forearm + 3 hand claws
      const boneTalon = new THREE.Mesh(
        new THREE.ConeGeometry(isBoss ? 0.07 : 0.052, isBoss ? 0.68 : 0.48, 6),
        boneMat
      );
      boneTalon.rotation.z = -Math.PI / 1.85;
      boneTalon.position.set(isBoss ? 0.56 : 0.46, -0.46, side * 0.04);
      boneTalon.castShadow = true;
      arm.add(boneTalon);

      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.2, 5), boneMat);
        claw.rotation.z = -Math.PI / 2.2;
        claw.position.set(0.4, -0.52, c * 0.045);
        arm.add(claw);
      }

      beast.add(arm);
      return arm;
    };

    leftLimb = makeBeastArm(-1);
    rightLimb = makeBeastArm(1);

    // Heavy spiked reptilian tail
    tailGroup = buildSegmentedTail(
      beast,
      new THREE.Vector3(-0.22, 0.78, 0),
      isBoss ? 5 : 4,
      isBoss ? 0.19 : 0.15,
      isBoss ? 0.3 : 0.25,
      hideMat,
      boneMat,
      0.12,
      isBoss
    );

    bodyGroup.add(beast);

    if (isBoss) {
      const spriteMat = new THREE.SpriteMaterial({
        color: 0xffffff,
        transparent: true,
        alphaTest: 0.06,
        depthWrite: false,
        fog: true,
      });
      const bossSprite = new THREE.Sprite(spriteMat);
      bossSprite.center.set(0.5, 0);
      bossSprite.position.set(0, 0.02, 0);
      bossSprite.visible = false;
      group.add(bossSprite);

      const standee = {
        sprite: bossSprite,
        material: spriteMat,
        baseW: 2.65 * (674 / 440),
        baseH: 2.65,
      };
      spriteStandee = standee;

      bossSpriteLoader.onReady((canvas) => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        spriteMat.map = tex;
        spriteMat.needsUpdate = true;
        const aspect = canvas.width / Math.max(1, canvas.height);
        standee.baseH = 2.68;
        standee.baseW = 2.68 * aspect;
        bossSprite.scale.set(standee.baseW, standee.baseH, 1);
        bossSprite.visible = true;
        beast.visible = false;
      });
    }
  }

  // World-space overhead billboarded HP bar (hidden until damaged)
  const barY = archetype === 'APEX_BOSS' ? 2.95 : 2.28;
  const barW = archetype === 'APEX_BOSS' ? 1.85 : 1.15;
  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(barW, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x020617, side: THREE.DoubleSide })
  );
  hpBarBg.position.set(0, barY, 0);
  group.add(hpBarBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(barW - 0.06, 0.09),
    new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide })
  );
  hpBarFill.position.set(0, barY, 0.01);
  group.add(hpBarFill);

  return {
    group,
    bodyGroup,
    leftLimb,
    rightLimb,
    headGroup,
    tailGroup,
    legs,
    coreMat,
    ringMesh,
    hpBarBg,
    hpBarFill,
    flashMaterials,
    spriteStandee,
  };
}

export function buildListenerModel(mats: StationMaterialLibrary): ListenerRig3D {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 2.35),
    mats.contactShadowMat
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.016;
  group.add(shadow);

  // Dark organic skin + glowing cyan sensory organs + subtle bioluminescent rib patterns
  const skinMat = mats.listenerSkinMat;
  const clawMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.25,
    metalness: 0.55,
  });
  const crestMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 2.0,
    roughness: 0.18,
  });
  const biolumMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.35,
    roughness: 0.25,
  });

  // Tall, gaunt ribcage torso tilted slightly forward
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.34, 8), skinMat);
  pelvis.position.set(-0.04, 1.18, 0);
  bodyGroup.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.72, 6, 12), skinMat);
  torso.position.set(0.06, 1.66, 0);
  torso.rotation.z = -0.18;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Exposed spine vertebrae + bioluminescent cyan rib nodes
  for (let r = 0; r < 5; r++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.24 - r * 0.015, 0.032, 6, 12, Math.PI * 1.4), skinMat);
    rib.position.set(0.05 + r * 0.02, 1.42 + r * 0.12, 0);
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = -0.18;
    bodyGroup.add(rib);

    const bioNode = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), biolumMat);
    bioNode.position.set(-0.16 + r * 0.02, 1.44 + r * 0.12, 0);
    bodyGroup.add(bioNode);
  }

  // Long, thin articulated legs
  const buildSpindlyLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(-0.04, 1.12, side * 0.22);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.68, 7), skinMat);
    thigh.position.set(0.1, -0.3, 0);
    thigh.rotation.z = 0.28;
    thigh.castShadow = true;
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.032, 0.72, 7), skinMat);
    shin.position.set(0.06, -0.78, 0);
    shin.rotation.z = -0.22;
    shin.castShadow = true;
    leg.add(shin);

    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 5), clawMat);
    foot.rotation.z = -Math.PI / 2;
    foot.position.set(0.14, -1.08, 0);
    leg.add(foot);

    bodyGroup.add(leg);
    return leg;
  };
  const leftLeg = buildSpindlyLeg(-1);
  const rightLeg = buildSpindlyLeg(1);

  // Long, thin elongated clawed arms reaching forward
  const buildLongArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(0.14, 1.88, side * 0.32);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skinMat);
    arm.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.72, 7), skinMat);
    upper.position.set(0.12, -0.32, side * 0.04);
    upper.rotation.z = 0.34;
    upper.castShadow = true;
    arm.add(upper);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.026, 0.78, 7), skinMat);
    forearm.position.set(0.42, -0.68, side * 0.02);
    forearm.rotation.z = 0.72;
    forearm.castShadow = true;
    arm.add(forearm);

    for (let c = -1; c <= 1; c++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.28, 5), clawMat);
      talon.rotation.z = -Math.PI / 2.2;
      talon.position.set(0.72, -0.94, c * 0.045);
      arm.add(talon);
    }

    const wristSensor = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), biolumMat);
    wristSensor.position.set(0.56, -0.82, 0);
    arm.add(wristSensor);

    bodyGroup.add(arm);
    return arm;
  };
  const leftArm = buildLongArm(-1);
  const rightArm = buildLongArm(1);

  // Unusual elongated eyeless acoustic head with split flared crest & glowing cyan sensory organs
  const headGroup = new THREE.Group();
  headGroup.position.set(0.24, 2.18, 0);

  const cranium = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 7), skinMat);
  cranium.rotation.z = -Math.PI / 2.3;
  cranium.position.set(0.14, 0.1, 0);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Split acoustic echolocation crown plates
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.28, 0.06), skinMat);
    plate.position.set(0.08, 0.22, side * 0.14);
    plate.rotation.y = side * -0.35;
    plate.rotation.z = 0.32;
    headGroup.add(plate);

    const organ = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), crestMat);
    organ.position.set(0.24, 0.16, side * 0.11);
    headGroup.add(organ);
  }

  // Central glowing cyan acoustic resonance organ
  const centralOrgan = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 1), crestMat);
  centralOrgan.position.set(0.32, 0.08, 0);
  headGroup.add(centralOrgan);

  bodyGroup.add(headGroup);

  // 6 swaying dorsal tendrils
  const tendrils: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const tier = Math.floor(i / 2);
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.012, 1.05, 6),
      i % 3 === 0 ? biolumMat : skinMat
    );
    t.rotation.z = Math.PI / 2.4 + tier * 0.14;
    t.position.set(-0.26 - tier * 0.06, 1.72 + tier * 0.15, side * (0.14 + tier * 0.06));
    bodyGroup.add(t);
    tendrils.push(t);
  }

  const sonarRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.12, 28),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  sonarRing.rotation.x = -Math.PI / 2;
  sonarRing.position.y = 0.03;
  group.add(sonarRing);

  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x020617, side: THREE.DoubleSide })
  );
  hpBarBg.position.set(0, 2.75, 0);
  hpBarBg.visible = false;
  group.add(hpBarBg);

  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
  );
  hpBarFill.position.set(0, 2.75, 0.01);
  hpBarFill.visible = false;
  group.add(hpBarFill);

  return {
    group,
    bodyGroup,
    headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    tendrils,
    crestMat,
    biolumMat,
    sonarRing,
    hpBarBg,
    hpBarFill,
  };
}

export function buildPropModel(
  prop: PropEntity,
  mats: StationMaterialLibrary
): { group: THREE.Group; animRefs?: THREE.Object3D[]; emissiveMat?: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const pw = prop.w * PX_TO_3D;
  const pd = prop.h * PX_TO_3D;
  const cx = (prop.x + prop.w * 0.5) * PX_TO_3D;
  const cz = (prop.y + prop.h * 0.5) * PX_TO_3D;
  group.position.set(cx, 0, cz);

  const accentHex = prop.accentColor ? parseInt(prop.accentColor.replace('#', ''), 16) : 0x22d3ee;

  const contact = (wScale = 1.1, dScale = 1.1) => {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(pw * wScale, pd * dScale),
      mats.contactShadowMat
    );
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.014;
    group.add(s);
  };

  if (prop.kind === 'REACTOR_CORE') {
    contact(1.3, 1.3);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(pw * 0.48, pw * 0.54, 0.55, 8),
      mats.wallTrimMat
    );
    base.position.y = 0.275;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(pw * 0.44, pw * 0.4, 0.45, 8),
      mats.wallPillarMat
    );
    crown.position.y = 2.55;
    crown.castShadow = true;
    group.add(crown);

    const coreMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    });
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(pw * 0.18, pw * 0.18, 2.1, 16),
      coreMat
    );
    column.position.y = 1.48;
    group.add(column);

    // 4 heavy vertical cooling pylons around plasma column
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 2.3, 0.28),
        mats.wallMainMat
      );
      pylon.position.set(Math.cos(ang) * pw * 0.36, 1.4, Math.sin(ang) * pd * 0.36);
      pylon.castShadow = true;
      group.add(pylon);
    }

    // Counter-rotating magnetic containment torus rings
    const rings: THREE.Object3D[] = [];
    for (let r = 0; r < 2; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(pw * 0.34, 0.08, 10, 24),
        mats.pipeMetalMat
      );
      ring.position.y = 1.15 + r * 0.55;
      ring.rotation.x = r === 0 ? 0.35 : -0.35;
      group.add(ring);
      rings.push(ring);
    }

    return { group, animRefs: rings, emissiveMat: coreMat };
  }

  if (prop.kind === 'RESCUE_POD') {
    contact(1.25, 1.25);
    const shuttleGroup = new THREE.Group();
    // Slight impact tilt from emergency crash landing in Arrival Bay
    shuttleGroup.rotation.z = 0.045;

    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.88, 1.35, pd * 0.82),
      mats.wallPillarMat
    );
    hull.position.y = 0.85;
    hull.castShadow = true;
    hull.receiveShadow = true;
    shuttleGroup.add(hull);

    const nose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, pw * 0.4, pd * 0.45, 6),
      mats.wallMainMat
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.78, -pd * 0.42);
    nose.castShadow = true;
    shuttleGroup.add(nose);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.48, 0.46, pd * 0.35),
      mats.consoleScreenMat
    );
    canopy.position.set(0, 1.32, -pd * 0.14);
    shuttleGroup.add(canopy);

    // Scorched swept landing wings + twin thrusters
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.8,
    });
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(pw * 0.46, 0.14, pd * 0.48),
        mats.wallTrimMat
      );
      wing.position.set(sx * pw * 0.62, 0.56, 0.08);
      wing.rotation.z = sx * -0.18;
      shuttleGroup.add(wing);

      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, pd * 0.68, 10),
        mats.wallTrimMat
      );
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx * pw * 0.44, 0.72, 0.1);
      shuttleGroup.add(pod);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), thrusterMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(sx * pw * 0.44, 0.72, pd * 0.38);
      shuttleGroup.add(exhaust);
    }
    group.add(shuttleGroup);
    return { group };
  }

  if (prop.kind === 'HOLO_TABLE') {
    contact(1.15, 1.15);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(pw * 0.42, pw * 0.48, 0.92, 8),
      mats.wallTrimMat
    );
    base.position.y = 0.46;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.78,
    });
    const holoCrashMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
    });
    const holoPlanet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 1), holoMat);
    holoPlanet.position.y = 1.65;
    group.add(holoPlanet);

    const holoRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.025, 6, 28),
      holoMat
    );
    holoRing.rotation.x = Math.PI / 2.6;
    holoRing.position.y = 1.65;
    group.add(holoRing);

    // Red crash-site impact marker + cyan Earth signal uplink spire
    const impactPin = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), holoCrashMat);
    impactPin.position.set(0.28, 2.08, 0.18);
    group.add(impactPin);

    return { group, animRefs: [holoPlanet, holoRing] };
  }

  if (prop.kind === 'BIO_TANK' || prop.kind === 'GLASS_CONTAINER') {
    contact(1.15, 1.15);
    const radius = Math.min(pw, pd) * 0.44;
    const capGeo = new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, 0.32, 16);
    const bCap = new THREE.Mesh(capGeo, mats.wallTrimMat);
    bCap.position.y = 0.16;
    bCap.castShadow = true;
    const tCap = new THREE.Mesh(capGeo, mats.wallTrimMat);
    tCap.position.y = 2.05;
    tCap.castShadow = true;
    group.add(bCap, tCap);

    const fluidMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      roughness: 0.1,
    });
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 1.65, 16),
      fluidMat
    );
    glass.position.y = 1.1;
    group.add(glass);

    const specimen = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.28, 0.5, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x0891b2, emissiveIntensity: 0.9 })
    );
    specimen.position.y = 1.1;
    group.add(specimen);

    return { group, animRefs: [specimen] };
  }

  if (prop.kind === 'CRYO_POD') {
    contact();
    const podBase = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.9, 1.85, pd * 0.9),
      mats.wallPillarMat
    );
    podBase.position.y = 0.925;
    podBase.castShadow = true;
    podBase.receiveShadow = true;
    group.add(podBase);

    const cryoGlass = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.62, 1.35, 0.08),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 1.1,
        roughness: 0.15,
      })
    );
    cryoGlass.position.set(0, 1.05, pd * 0.46);
    group.add(cryoGlass);
    return { group };
  }

  if (
    prop.kind === 'LAB_WORKSTATION' ||
    prop.kind === 'BRIDGE_CONSOLE' ||
    prop.kind === 'DESK'
  ) {
    contact();
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.94, 0.84, pd * 0.88),
      mats.wallMainMat
    );
    desk.position.y = 0.42;
    desk.castShadow = true;
    desk.receiveShadow = true;
    group.add(desk);

    const screenCount = pw > 3 ? 3 : 2;
    for (let s = 0; s < screenCount; s++) {
      const offsetX = (s - (screenCount - 1) * 0.5) * (pw * 0.34);
      const mon = new THREE.Mesh(
        new THREE.BoxGeometry(pw * 0.28, 0.42, 0.06),
        mats.consoleScreenMat
      );
      mon.position.set(offsetX, 1.08, -pd * 0.2);
      mon.rotation.x = -0.18;
      group.add(mon);
    }
    return { group };
  }

  if (prop.kind === 'SERVER_RACK') {
    contact();
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.9, 2.25, pd * 0.9),
      mats.wallTrimMat
    );
    rack.position.y = 1.125;
    rack.castShadow = true;
    rack.receiveShadow = true;
    group.add(rack);

    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.6,
    });
    for (let r = 0; r < 5; r++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(pw * 0.72, 0.06, pd * 0.94),
        ledMat
      );
      strip.position.y = 0.45 + r * 0.36;
      group.add(strip);
    }
    return { group };
  }

  if (prop.kind === 'DAMAGED_GENERATOR') {
    contact();
    const genGroup = new THREE.Group();
    // Slightly tilted & cracked casing from crash impact
    genGroup.rotation.z = 0.06;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.92, 1.45, pd * 0.9),
      mats.wallMainMat
    );
    body.position.y = 0.725;
    body.castShadow = true;
    genGroup.add(body);

    const coilMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 1.65,
      roughness: 0.25,
    });
    const turbine = new THREE.Mesh(
      new THREE.CylinderGeometry(pd * 0.32, pd * 0.32, pw * 0.76, 12),
      coilMat
    );
    turbine.rotation.z = Math.PI / 2;
    turbine.position.y = 1.55;
    genGroup.add(turbine);

    // Torn open housing plate + exposed defect cooling pipes
    const tornPanel = new THREE.Mesh(
      new THREE.BoxGeometry(pw * 0.55, 0.45, 0.08),
      mats.wallTrimMat
    );
    tornPanel.position.set(0.18, 0.65, pd * 0.48);
    tornPanel.rotation.set(0.35, 0.2, -0.22);
    genGroup.add(tornPanel);

    group.add(genGroup);
    return { group };
  }

  if (prop.kind === 'CONTAINMENT_CHAMBER') {
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.72,
      roughness: 0.35,
    });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(sx * (pw * 0.45), 1.25, sz * (pd * 0.45));
        post.castShadow = true;
        group.add(post);
      }
    }

    const curbMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 1.35,
      roughness: 0.3,
    });
    for (const sz of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.86, 0.1, 0.14), curbMat);
      bar.position.set(0, 0.06, sz * (pd * 0.46));
      group.add(bar);
    }

    // Crash-shattered glass & bent rim debris at the breach perimeter
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.5,
      roughness: 0.12,
      transparent: true,
      opacity: 0.55,
    });
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.04), shardMat);
      shard.position.set((i - 1.5) * (pw * 0.22), 0.12, (i % 2 === 0 ? 1 : -1) * pd * 0.38);
      shard.rotation.set(0.7, i * 0.6, 0.35);
      group.add(shard);
    }
    return { group };
  }

  if (prop.kind === 'ALIEN_TRACE') {
    const bioMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.9,
      roughness: 0.32,
    });
    for (let i = 0; i < 4; i++) {
      const r = 0.32 + (i % 2) * 0.14;
      const blot = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.18, 0.03, 12),
        bioMat
      );
      blot.position.set(
        Math.cos(i * 1.65) * 0.42,
        0.015,
        Math.sin(i * 1.65) * 0.42
      );
      group.add(blot);
    }
    return { group };
  }

  if (prop.kind === 'DAMAGED_PANEL' || prop.kind === 'WARNING_SIGN' || prop.kind === 'BROKEN_CAMERA') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.5, pw * 0.8), 0.38, Math.max(0.3, pd * 0.5)),
      mats.wallTrimMat
    );
    box.position.y = prop.kind === 'BROKEN_CAMERA' ? 2.1 : 1.32;
    if (prop.kind === 'DAMAGED_PANEL') {
      box.rotation.z = -0.14;
    }
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.09, 0.14),
      new THREE.MeshStandardMaterial({
        color: prop.kind === 'WARNING_SIGN' ? 0xf59e0b : 0xef4444,
        emissive: prop.kind === 'WARNING_SIGN' ? 0xf59e0b : 0xef4444,
        emissiveIntensity: 1.85,
      })
    );
    led.position.y = box.position.y + 0.04;
    led.position.z = 0.18;
    group.add(box, led);

    if (prop.kind === 'DAMAGED_PANEL') {
      // Exposed severed defect wires protruding from open panel
      const wireMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.2,
      });
      for (const side of [-0.14, 0.12]) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.52, 6), wireMat);
        wire.position.set(side, 1.04, 0.22);
        wire.rotation.x = 0.48;
        wire.rotation.z = side * 1.4;
        group.add(wire);
      }
    }
    return { group };
  }

  // CRATE / EQUIPMENT_CASE
  contact();
  const crateMat = new THREE.MeshStandardMaterial({
    color: prop.kind === 'EQUIPMENT_CASE' ? 0x1e293b : 0x243044,
    roughness: 0.48,
    metalness: 0.6,
  });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.92, 1.15, pd * 0.9), crateMat);
  crate.position.y = 0.575;
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(pw * 0.96, 0.14, pd * 0.94),
    new THREE.MeshStandardMaterial({
      color: prop.kind === 'EQUIPMENT_CASE' ? 0xd97706 : 0x0ea5e9,
      emissive: prop.kind === 'EQUIPMENT_CASE' ? 0x92400e : 0x0369a1,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    })
  );
  stripe.position.y = 0.88;
  group.add(stripe);

  return { group };
}

export function buildTerminalModel(
  term: TerminalEntity,
  mats: StationMaterialLibrary
): { group: THREE.Group; screenMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.position.set(term.tileX * UNITS_PER_TILE, 0, term.tileY * UNITS_PER_TILE);

  const ped = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.72), mats.wallTrimMat);
  ped.position.y = 0.55;
  ped.castShadow = true;
  ped.receiveShadow = true;
  group.add(ped);

  const screenColor =
    term.kind === 'SIGNAL_RELAY'
      ? 0xef4444
      : term.kind === 'PUZZLE_FREQUENCY' || term.kind === 'PUZZLE_REACTOR'
        ? 0xf59e0b
        : 0x22d3ee;

  const screenMat = new THREE.MeshStandardMaterial({
    color: screenColor,
    emissive: screenColor,
    emissiveIntensity: 1.55,
    roughness: 0.18,
  });

  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.52, 0.08), screenMat);
  monitor.position.set(0, 1.32, -0.1);
  monitor.rotation.x = -0.25;
  group.add(monitor);

  if (term.kind === 'SIGNAL_RELAY') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 8), mats.pipeMetalMat);
    mast.position.set(0, 1.85, -0.22);
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.12, 0.18, 12),
      mats.wallPillarMat
    );
    dish.rotation.x = 0.65;
    dish.position.set(0, 2.52, -0.18);
    group.add(mast, dish);
  }

  return { group, screenMat };
}

export function buildPickupModel(pickup: PickupEntity): {
  group: THREE.Group;
  floatMesh: THREE.Object3D;
} {
  const group = new THREE.Group();
  group.position.set(pickup.tileX * UNITS_PER_TILE, 0, pickup.tileY * UNITS_PER_TILE);

  const colHex = parseInt(pickup.color.replace('#', ''), 16);
  const glowMat = new THREE.MeshStandardMaterial({
    color: colHex,
    emissive: colHex,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.44, 18),
    new THREE.MeshBasicMaterial({
      color: colHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.024;
  group.add(baseRing);

  const floatMesh = new THREE.Group();
  floatMesh.position.y = 0.72;

  if (pickup.kind === 'BEACON_PACK') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10), glowMat);
    floatMesh.add(body);
  } else if (pickup.kind === 'BATTERY_CELL') {
    const cell = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 4, 8), glowMat);
    floatMesh.add(cell);
  } else {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.05), glowMat);
    floatMesh.add(card);
  }

  group.add(floatMesh);
  return { group, floatMesh };
}
