import * as THREE from 'three';

export interface StationMaterialLibrary {
  floorMetalMat: THREE.MeshStandardMaterial;
  floorGrateMat: THREE.MeshStandardMaterial;
  floorHazardMat: THREE.MeshStandardMaterial;
  landingPadMat: THREE.MeshStandardMaterial;
  wallMainMat: THREE.MeshStandardMaterial;
  wallTrimMat: THREE.MeshStandardMaterial;
  wallPillarMat: THREE.MeshStandardMaterial;
  windowGlassMat: THREE.MeshPhysicalMaterial;
  ceilingPanelMat: THREE.MeshStandardMaterial;
  ceilingBeamMat: THREE.MeshStandardMaterial;
  pipeMetalMat: THREE.MeshStandardMaterial;
  consoleScreenMat: THREE.MeshStandardMaterial;
  planetMat: THREE.MeshStandardMaterial;
  planetTerrainMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  listenerSkinMat: THREE.MeshStandardMaterial;
  reptileHideTex: THREE.CanvasTexture;
  chitinShellTex: THREE.CanvasTexture;
  acidSkinTex: THREE.CanvasTexture;
  creatureBumpTex: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for procedural texture');
  }
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

function generateFloorMetalMaps(anisotropy: number) {
  const size = 512;
  const [albedoC, aCtx] = makeCanvas(size, size);
  const [bumpC, bCtx] = makeCanvas(size, size);

  // Dark metallic navy-charcoal base
  aCtx.fillStyle = '#121b2b';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);

  // Subtle brushed metal streaks
  for (let i = 0; i < 420; i++) {
    const x = ((i * 73) % size);
    const y = ((i * 137) % size);
    const len = 18 + (i % 45);
    aCtx.fillStyle = i % 2 === 0 ? 'rgba(148,163,184,0.035)' : 'rgba(2,6,23,0.14)';
    aCtx.fillRect(x, y, len, 2);
  }

  // Modular quad plate bevel divisions
  const cells = 2;
  const cell = size / cells;
  for (let gx = 0; gx < cells; gx++) {
    for (let gy = 0; gy < cells; gy++) {
      const px = gx * cell;
      const py = gy * cell;

      aCtx.fillStyle = (gx + gy) % 2 === 0 ? '#162033' : '#131c2d';
      aCtx.fillRect(px + 8, py + 8, cell - 16, cell - 16);

      // Deep dark panel seams
      aCtx.strokeStyle = '#070b14';
      aCtx.lineWidth = 6;
      aCtx.strokeRect(px + 3, py + 3, cell - 6, cell - 6);

      bCtx.strokeStyle = '#181818';
      bCtx.lineWidth = 8;
      bCtx.strokeRect(px + 4, py + 4, cell - 8, cell - 8);

      // Highlight edge chamfer
      aCtx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
      aCtx.lineWidth = 2;
      aCtx.strokeRect(px + 10, py + 10, cell - 20, cell - 20);

      bCtx.strokeStyle = '#b4b4b4';
      bCtx.lineWidth = 2;
      bCtx.strokeRect(px + 10, py + 10, cell - 20, cell - 20);

      // Corner hex bolts
      const boltOffsets = [
        [20, 20],
        [cell - 20, 20],
        [20, cell - 20],
        [cell - 20, cell - 20],
      ];
      for (const [bx, by] of boltOffsets) {
        aCtx.fillStyle = '#334155';
        aCtx.beginPath();
        aCtx.arc(px + bx, py + by, 5, 0, Math.PI * 2);
        aCtx.fill();
        aCtx.fillStyle = '#0a0f1c';
        aCtx.beginPath();
        aCtx.arc(px + bx, py + by, 2, 0, Math.PI * 2);
        aCtx.fill();

        bCtx.fillStyle = '#dcdcdc';
        bCtx.beginPath();
        bCtx.arc(px + bx, py + by, 5, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  }

  // Central maintenance access cover & cable channel
  aCtx.strokeStyle = '#0b1220';
  aCtx.lineWidth = 4;
  aCtx.strokeRect(size * 0.34, size * 0.34, size * 0.32, size * 0.32);
  aCtx.fillStyle = 'rgba(34, 211, 238, 0.14)';
  aCtx.fillRect(size * 0.45, 16, size * 0.1, 6);
  aCtx.fillRect(size * 0.45, size - 22, size * 0.1, 6);

  // Diagonal surface scratches & claw scuff marks for horror realism
  for (let s = 0; s < 55; s++) {
    const sx = (s * 97) % size;
    const sy = (s * 179) % size;
    const dx = ((s % 5) - 2) * 14 + 10;
    const dy = ((s % 3) - 1) * 10 + 6;
    aCtx.strokeStyle = s % 3 === 0 ? 'rgba(203, 213, 225, 0.14)' : 'rgba(2, 6, 23, 0.32)';
    aCtx.lineWidth = s % 4 === 0 ? 2 : 1;
    aCtx.beginPath();
    aCtx.moveTo(sx, sy);
    aCtx.lineTo(sx + dx, sy + dy);
    aCtx.stroke();

    bCtx.strokeStyle = '#383838';
    bCtx.lineWidth = 1.5;
    bCtx.beginPath();
    bCtx.moveTo(sx, sy);
    bCtx.lineTo(sx + dx, sy + dy);
    bCtx.stroke();
  }

  return {
    map: configureTexture(albedoC, true, anisotropy),
    bumpMap: configureTexture(bumpC, false, anisotropy),
  };
}

function generateFloorGrateMaps(anisotropy: number) {
  const size = 512;
  const [albedoC, aCtx] = makeCanvas(size, size);
  const [bumpC, bCtx] = makeCanvas(size, size);

  // Dark sub-floor cavity with hidden conduits
  aCtx.fillStyle = '#070b13';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#202020';
  bCtx.fillRect(0, 0, size, size);

  // Sub-floor industrial conduits visible underneath slots
  aCtx.fillStyle = '#0e293d';
  aCtx.fillRect(72, 0, 26, size);
  aCtx.fillRect(390, 0, 32, size);
  aCtx.fillStyle = '#2c1b12';
  aCtx.fillRect(210, 0, 18, size);

  // Heavy perforated steel grating ribs
  const step = 32;
  aCtx.fillStyle = '#1b2638';
  bCtx.fillStyle = '#c8c8c8';
  for (let x = 0; x < size; x += step) {
    aCtx.fillRect(x, 0, 12, size);
    bCtx.fillRect(x, 0, 12, size);
  }
  for (let y = 0; y < size; y += step) {
    aCtx.fillRect(0, y, size, 12);
    bCtx.fillRect(0, y, size, 12);
  }

  // Outer deck frame & rivets
  aCtx.strokeStyle = '#26344a';
  aCtx.lineWidth = 22;
  aCtx.strokeRect(11, 11, size - 22, size - 22);
  bCtx.strokeStyle = '#ebebeb';
  bCtx.lineWidth = 22;
  bCtx.strokeRect(11, 11, size - 22, size - 22);

  return {
    map: configureTexture(albedoC, true, anisotropy),
    bumpMap: configureTexture(bumpC, false, anisotropy),
  };
}

function generateFloorHazardMaps(anisotropy: number) {
  const size = 512;
  const [albedoC, aCtx] = makeCanvas(size, size);
  const [bumpC, bCtx] = makeCanvas(size, size);

  aCtx.fillStyle = '#141a24';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#828282';
  bCtx.fillRect(0, 0, size, size);

  // Weathered caution chevron border
  aCtx.save();
  aCtx.beginPath();
  aCtx.rect(0, 0, size, size);
  aCtx.rect(52, 52, size - 104, size - 104);
  aCtx.clip('evenodd');

  aCtx.fillStyle = '#1c1917';
  aCtx.fillRect(0, 0, size, size);
  aCtx.fillStyle = '#b45309';
  for (let i = -size; i < size * 2; i += 64) {
    aCtx.beginPath();
    aCtx.moveTo(i, 0);
    aCtx.lineTo(i + 32, 0);
    aCtx.lineTo(i - size + 32, size);
    aCtx.lineTo(i - size, size);
    aCtx.closePath();
    aCtx.fill();
  }
  aCtx.restore();

  // Inner worn steel center with vents
  aCtx.fillStyle = '#172133';
  aCtx.fillRect(54, 54, size - 108, size - 108);
  aCtx.strokeStyle = '#090d16';
  aCtx.lineWidth = 6;
  aCtx.strokeRect(54, 54, size - 108, size - 108);

  bCtx.strokeStyle = '#222222';
  bCtx.lineWidth = 8;
  bCtx.strokeRect(54, 54, size - 108, size - 108);

  return {
    map: configureTexture(albedoC, true, anisotropy),
    bumpMap: configureTexture(bumpC, false, anisotropy),
  };
}

function generateWallPanelMaps(anisotropy: number) {
  const size = 512;
  const [albedoC, aCtx] = makeCanvas(size, size);
  const [bumpC, bCtx] = makeCanvas(size, size);

  // Dark charcoal titanium hull wall
  aCtx.fillStyle = '#1a2333';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Recessed armored bulkhead sections
  for (let i = 0; i < 2; i++) {
    const x = i * 256 + 18;
    aCtx.fillStyle = '#212d40';
    aCtx.fillRect(x, 34, 220, 320);
    aCtx.strokeStyle = '#0b101b';
    aCtx.lineWidth = 8;
    aCtx.strokeRect(x, 34, 220, 320);

    bCtx.fillStyle = '#b0b0b0';
    bCtx.fillRect(x, 34, 220, 320);
    bCtx.strokeStyle = '#1e1e1e';
    bCtx.lineWidth = 8;
    bCtx.strokeRect(x, 34, 220, 320);

    // Horizontal reinforcement rib
    aCtx.fillStyle = '#141c2b';
    aCtx.fillRect(x + 12, 184, 196, 26);
    bCtx.fillStyle = '#484848';
    bCtx.fillRect(x + 12, 184, 196, 26);

    // Wall rivets
    for (let r = 0; r < 4; r++) {
      const rx = x + 22 + r * 58;
      aCtx.fillStyle = '#475569';
      aCtx.fillRect(rx, 50, 7, 7);
      aCtx.fillRect(rx, 330, 7, 7);
      bCtx.fillStyle = '#ededed';
      bCtx.fillRect(rx, 50, 7, 7);
      bCtx.fillRect(rx, 330, 7, 7);
    }
  }

  // Lower skirting conduit channel & subtle blue/steel technical line
  aCtx.fillStyle = '#101724';
  aCtx.fillRect(0, 372, size, 140);
  aCtx.fillStyle = '#1e293b';
  aCtx.fillRect(0, 372, size, 12);
  aCtx.fillStyle = 'rgba(34, 211, 238, 0.42)';
  aCtx.fillRect(0, 388, size, 4);

  // Vent louvers in lower panel
  for (let v = 0; v < 6; v++) {
    aCtx.fillStyle = '#070a12';
    aCtx.fillRect(34 + v * 28, 415, 16, 60);
    bCtx.fillStyle = '#1a1a1a';
    bCtx.fillRect(34 + v * 28, 415, 16, 60);
  }

  return {
    map: configureTexture(albedoC, true, anisotropy),
    bumpMap: configureTexture(bumpC, false, anisotropy),
  };
}

function generateCeilingTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.fillStyle = '#0d1320';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#1c2638';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  ctx.fillStyle = '#070a12';
  for (let y = 38; y < size - 38; y += 22) {
    ctx.fillRect(36, y, size - 72, 8);
  }
  return configureTexture(canvas, true, anisotropy);
}

function generateLandingPadTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#101827';
  ctx.fillRect(0, 0, 512, 512);

  // Outer warning chevron ring
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 14;
  ctx.setLineDash([28, 16]);
  ctx.strokeRect(20, 20, 472, 472);
  ctx.setLineDash([]);

  // Inner cyan docking circle
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(256, 256, 170, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.font = '700 48px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAD-04', 256, 108);

  return configureTexture(canvas, true, anisotropy);
}

function generateConsoleScreenTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#041220';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, 244, 116);

  // Signal wave trace
  ctx.beginPath();
  for (let x = 16; x < 170; x += 4) {
    const y = 42 + Math.sin(x * 0.12) * 16;
    if (x === 16) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Telemetry bars
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(16, 82, 110, 8);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(16, 98, 72, 8);
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(184, 24, 52, 80);

  return configureTexture(canvas, true, anisotropy);
}

function generatePlanetTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#091936');
  grad.addColorStop(0.28, '#0f3460');
  grad.addColorStop(0.5, '#134e6f');
  grad.addColorStop(0.75, '#0b2948');
  grad.addColorStop(1, '#061224');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Swirling atmospheric bands & continental shelves
  for (let i = 0; i < 42; i++) {
    const y = (i * 29) % 256;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(34, 211, 238, 0.14)'
        : i % 2 === 0
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(148, 163, 184, 0.1)';
    ctx.beginPath();
    ctx.ellipse((i * 83) % 512, y, 70 + (i % 5) * 24, 12 + (i % 4) * 5, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureTexture(canvas, true, anisotropy);
}

function generateContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function generateListenerSkinMaps(anisotropy: number) {
  const size = 256;
  const [albedoC, aCtx] = makeCanvas(size, size);
  const [bumpC, bCtx] = makeCanvas(size, size);

  aCtx.fillStyle = '#0c111d';
  aCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#606060';
  bCtx.fillRect(0, 0, size, size);

  // Dark biological mottled chitin & dermal folds
  for (let i = 0; i < 160; i++) {
    const x = (i * 67) % size;
    const y = (i * 113) % size;
    const r = 6 + (i % 14);
    aCtx.fillStyle = i % 3 === 0 ? 'rgba(15, 23, 42, 0.7)' : 'rgba(30, 41, 59, 0.45)';
    aCtx.beginPath();
    aCtx.ellipse(x, y, r * 1.4, r * 0.7, (i % 7) * 0.4, 0, Math.PI * 2);
    aCtx.fill();

    bCtx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#353535';
    bCtx.beginPath();
    bCtx.ellipse(x, y, r * 1.2, r * 0.6, (i % 7) * 0.4, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Subtle cyan bioluminescent capillary veins
  for (let v = 0; v < 24; v++) {
    const x0 = (v * 43) % size;
    const y0 = (v * 89) % size;
    aCtx.strokeStyle = v % 3 === 0 ? 'rgba(34, 211, 238, 0.28)' : 'rgba(8, 145, 178, 0.16)';
    aCtx.lineWidth = 1.6;
    aCtx.beginPath();
    aCtx.moveTo(x0, y0);
    aCtx.quadraticCurveTo((x0 + 28) % size, (y0 + 18) % size, (x0 + 52) % size, (y0 + 42) % size);
    aCtx.stroke();
  }

  return {
    map: configureTexture(albedoC, true, anisotropy),
    bumpMap: configureTexture(bumpC, false, anisotropy),
  };
}

function generateOrganicCreatureTextures(anisotropy: number) {
  const size = 256;
  const makeOrganicCanvas = (baseHex: string, scaleHex: string, veinHex: string) => {
    const [canvas, ctx] = makeCanvas(size, size);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    // Organic hexagonal/oval scales & dermal folds
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 14; col++) {
        const cx = ((col + (row % 2) * 0.5) / 14) * size;
        const cy = (row / 14) * size;
        const rx = 10 + ((row * 3 + col) % 5);
        const ry = 8 + ((row + col * 2) % 4);
        ctx.fillStyle = scaleHex;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, ((row + col) % 3) * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // Sinew / capillary striations
    for (let v = 0; v < 26; v++) {
      const x0 = (v * 53) % size;
      const y0 = (v * 97) % size;
      ctx.strokeStyle = veinHex;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        (x0 + 30) % size,
        (y0 + 18) % size,
        (x0 + 55) % size,
        (y0 + 36) % size
      );
      ctx.stroke();
    }
    return canvas;
  };

  const reptileC = makeOrganicCanvas('#2d161b', 'rgba(82, 32, 38, 0.72)', 'rgba(185, 28, 28, 0.25)');
  const chitinC = makeOrganicCanvas('#160d24', 'rgba(49, 28, 82, 0.7)', 'rgba(192, 132, 252, 0.24)');
  const acidC = makeOrganicCanvas('#10261a', 'rgba(22, 78, 45, 0.72)', 'rgba(74, 222, 128, 0.28)');

  const [bumpC, bCtx] = makeCanvas(size, size);
  bCtx.fillStyle = '#5a5a5a';
  bCtx.fillRect(0, 0, size, size);
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const cx = ((col + (row % 2) * 0.5) / 14) * size;
      const cy = (row / 14) * size;
      bCtx.fillStyle = (row + col) % 2 === 0 ? '#bcbcbc' : '#969696';
      bCtx.beginPath();
      bCtx.ellipse(cx, cy, 9, 7, 0, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  return {
    reptileHideTex: configureTexture(reptileC, true, anisotropy),
    chitinShellTex: configureTexture(chitinC, true, anisotropy),
    acidSkinTex: configureTexture(acidC, true, anisotropy),
    creatureBumpTex: configureTexture(bumpC, false, anisotropy),
  };
}

function generatePlanetTerrainMaps(anisotropy: number) {
  const size = 512;
  const [albedoC, aCtx] = makeCanvas(size, size);
  const [bumpC, bCtx] = makeCanvas(size, size);

  // Dark basalt / iron-oxide alien planetary soil
  const bg = aCtx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#14111a');
  bg.addColorStop(0.5, '#1d161e');
  bg.addColorStop(1, '#111521');
  aCtx.fillStyle = bg;
  aCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#747474';
  bCtx.fillRect(0, 0, size, size);

  // Regolith gravel, impact craters & rocky fissures
  for (let i = 0; i < 160; i++) {
    const x = (i * 97 + (i % 7) * 31) % size;
    const y = (i * 151 + (i % 5) * 47) % size;
    const r = 6 + (i % 24);
    aCtx.fillStyle =
      i % 5 === 0
        ? 'rgba(120, 53, 15, 0.22)'
        : i % 3 === 0
          ? 'rgba(15, 23, 42, 0.45)'
          : 'rgba(51, 65, 85, 0.28)';
    aCtx.beginPath();
    aCtx.ellipse(x, y, r * 1.25, r * 0.85, (i % 6) * 0.5, 0, Math.PI * 2);
    aCtx.fill();

    bCtx.fillStyle = i % 4 === 0 ? '#2c2c2c' : '#9c9c9c';
    bCtx.beginPath();
    bCtx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Glowing alien fungal/mineral vein cracks across the planet crust
  for (let v = 0; v < 22; v++) {
    const x0 = (v * 67) % size;
    const y0 = (v * 113) % size;
    aCtx.strokeStyle = v % 3 === 0 ? 'rgba(239, 68, 68, 0.24)' : 'rgba(34, 211, 238, 0.22)';
    aCtx.lineWidth = 2;
    aCtx.beginPath();
    aCtx.moveTo(x0, y0);
    aCtx.lineTo((x0 + 48) % size, (y0 + 36) % size);
    aCtx.lineTo((x0 + 96) % size, (y0 + 18) % size);
    aCtx.stroke();
  }

  return {
    map: configureTexture(albedoC, true, anisotropy, 16, 16),
    bumpMap: configureTexture(bumpC, false, anisotropy, 16, 16),
  };
}

export function createStationMaterials(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): StationMaterialLibrary {
  const textures: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const metalMaps = generateFloorMetalMaps(maxAnisotropy);
  const grateMaps = generateFloorGrateMaps(maxAnisotropy);
  const hazardMaps = generateFloorHazardMaps(maxAnisotropy);
  const wallMaps = generateWallPanelMaps(maxAnisotropy);

  const floorMetalMat = new THREE.MeshStandardMaterial({
    map: track(metalMaps.map),
    bumpMap: track(metalMaps.bumpMap),
    bumpScale: 0.035,
    roughness: 0.42,
    metalness: 0.72,
    envMapIntensity: 0.9,
  });

  const floorGrateMat = new THREE.MeshStandardMaterial({
    map: track(grateMaps.map),
    bumpMap: track(grateMaps.bumpMap),
    bumpScale: 0.05,
    roughness: 0.48,
    metalness: 0.78,
    envMapIntensity: 0.85,
  });

  const floorHazardMat = new THREE.MeshStandardMaterial({
    map: track(hazardMaps.map),
    bumpMap: track(hazardMaps.bumpMap),
    bumpScale: 0.04,
    roughness: 0.46,
    metalness: 0.68,
    envMapIntensity: 0.8,
  });

  const landingPadMat = new THREE.MeshStandardMaterial({
    map: track(generateLandingPadTexture(maxAnisotropy)),
    roughness: 0.38,
    metalness: 0.68,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const wallMainMat = new THREE.MeshStandardMaterial({
    map: track(wallMaps.map),
    bumpMap: track(wallMaps.bumpMap),
    bumpScale: 0.05,
    roughness: 0.44,
    metalness: 0.76,
    envMapIntensity: 0.9,
  });

  const wallTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f1726,
    roughness: 0.34,
    metalness: 0.85,
    envMapIntensity: 1.0,
  });

  const wallPillarMat = new THREE.MeshStandardMaterial({
    color: 0x223047,
    roughness: 0.28,
    metalness: 0.88,
    envMapIntensity: 1.05,
  });

  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x164e63,
    roughness: 0.08,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.92,
    ior: 1.5,
    thickness: 0.25,
    depthWrite: false,
    envMapIntensity: 1.25,
  });

  const ceilingPanelMat = new THREE.MeshStandardMaterial({
    map: track(generateCeilingTexture(maxAnisotropy)),
    roughness: 0.58,
    metalness: 0.66,
  });

  const ceilingBeamMat = new THREE.MeshStandardMaterial({
    color: 0x162030,
    roughness: 0.38,
    metalness: 0.84,
  });

  const pipeMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.88,
  });

  const consoleTex = track(generateConsoleScreenTexture(maxAnisotropy));
  const consoleScreenMat = new THREE.MeshStandardMaterial({
    map: consoleTex,
    emissiveMap: consoleTex,
    emissive: new THREE.Color(0x22d3ee),
    emissiveIntensity: 1.35,
    roughness: 0.2,
    metalness: 0.1,
  });

  const planetMat = new THREE.MeshStandardMaterial({
    map: track(generatePlanetTexture(maxAnisotropy)),
    emissive: new THREE.Color(0x0c4a6e),
    emissiveIntensity: 0.48,
    roughness: 0.72,
    metalness: 0.05,
  });

  const planetTerrainMaps = generatePlanetTerrainMaps(maxAnisotropy);
  const planetTerrainMat = new THREE.MeshStandardMaterial({
    map: track(planetTerrainMaps.map),
    bumpMap: track(planetTerrainMaps.bumpMap),
    bumpScale: 0.14,
    roughness: 0.9,
    metalness: 0.08,
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: track(generateContactShadowTexture()),
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });

  const listenerMaps = generateListenerSkinMaps(maxAnisotropy);
  const listenerSkinMat = new THREE.MeshStandardMaterial({
    map: track(listenerMaps.map),
    bumpMap: track(listenerMaps.bumpMap),
    bumpScale: 0.06,
    roughness: 0.36,
    metalness: 0.18,
    envMapIntensity: 0.85,
  });

  const creatureMaps = generateOrganicCreatureTextures(maxAnisotropy);
  const reptileHideTex = track(creatureMaps.reptileHideTex);
  const chitinShellTex = track(creatureMaps.chitinShellTex);
  const acidSkinTex = track(creatureMaps.acidSkinTex);
  const creatureBumpTex = track(creatureMaps.creatureBumpTex);

  const allMaterials: THREE.Material[] = [
    floorMetalMat,
    floorGrateMat,
    floorHazardMat,
    landingPadMat,
    wallMainMat,
    wallTrimMat,
    wallPillarMat,
    windowGlassMat,
    ceilingPanelMat,
    ceilingBeamMat,
    pipeMetalMat,
    consoleScreenMat,
    planetMat,
    planetTerrainMat,
    contactShadowMat,
    listenerSkinMat,
  ];

  return {
    floorMetalMat,
    floorGrateMat,
    floorHazardMat,
    landingPadMat,
    wallMainMat,
    wallTrimMat,
    wallPillarMat,
    windowGlassMat,
    ceilingPanelMat,
    ceilingBeamMat,
    pipeMetalMat,
    consoleScreenMat,
    planetMat,
    planetTerrainMat,
    contactShadowMat,
    listenerSkinMat,
    reptileHideTex,
    chitinShellTex,
    acidSkinTex,
    creatureBumpTex,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
