export const BOSS_IMAGE_URL = '/assets/aistudio/image_b3a846ec.png';
export const SENTINEL_IMAGE_URL = '/assets/aistudio/image_daa6c51c.png';

/**
 * Loads an uploaded 2D/3D creature image and removes its studio background
 * via edge flood-fill so the sprite renders cleanly inside both 3D WebGL and UI layers.
 */
class CreatureSpriteLoader {
  private processedCanvas: HTMLCanvasElement | null = null;
  private loadingStarted = false;
  private url: string;
  private listeners = new Set<(canvas: HTMLCanvasElement) => void>();

  constructor(url: string) {
    this.url = url;
  }

  public getSprite(): HTMLCanvasElement | null {
    if (!this.loadingStarted && typeof window !== 'undefined') {
      this.loadingStarted = true;
      const img = new Image();
      img.onload = () => {
        const extracted = this.extractTransparentSprite(img);
        this.processedCanvas = extracted;
        this.listeners.forEach((cb) => cb(extracted));
        this.listeners.clear();
      };
      img.src = this.url;
    }
    return this.processedCanvas;
  }

  public onReady(cb: (canvas: HTMLCanvasElement) => void): () => void {
    const existing = this.getSprite();
    if (existing) {
      cb(existing);
      return () => {};
    }
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private extractTransparentSprite(img: HTMLImageElement): HTMLCanvasElement {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Clear top-right "Vertices" overlay only on the legacy screenshot asset if present
    if (this.url.includes('45d358df')) {
      const cornerStartX = Math.floor(w * 0.72);
      const cornerEndY = Math.floor(h * 0.09);
      for (let y = 0; y < cornerEndY; y++) {
        for (let x = cornerStartX; x < w; x++) {
          const idx = (y * w + x) * 4;
          data[idx + 3] = 0;
        }
      }
    }

    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const isNeutralBg = (pIdx: number): boolean => {
      const i = pIdx * 4;
      if (data[i + 3] === 0) return true;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC - minC;
      const lum = (r + g + b) / 3;
      const isDarkStudioBackdrop = lum <= 46 && sat <= 24;
      const isMidGrayStudioBackdrop = sat <= 18 && lum >= 26 && lum <= 88;
      return isDarkStudioBackdrop || isMidGrayStudioBackdrop;
    };

    const enqueue = (x: number, y: number) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const pIdx = y * w + x;
      if (visited[pIdx]) return;
      if (isNeutralBg(pIdx)) {
        visited[pIdx] = 1;
        queue[tail++] = pIdx;
      }
    };

    for (let x = 0; x < w; x++) {
      enqueue(x, 0);
      enqueue(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      enqueue(0, y);
      enqueue(w - 1, y);
    }

    while (head < tail) {
      const pIdx = queue[head++];
      data[pIdx * 4 + 3] = 0;
      const x = pIdx % w;
      const y = (pIdx - x) / w;
      enqueue(x - 1, y);
      enqueue(x + 1, y);
      enqueue(x, y - 1);
      enqueue(x, y + 1);
    }

    // Soften 1px fringe around sprite silhouette
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const pIdx = y * w + x;
        const i = pIdx * 4;
        if (data[i + 3] === 0) continue;
        if (
          data[((y - 1) * w + x) * 4 + 3] === 0 ||
          data[((y + 1) * w + x) * 4 + 3] === 0 ||
          data[(y * w + x - 1) * 4 + 3] === 0 ||
          data[(y * w + x + 1) * 4 + 3] === 0
        ) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (Math.max(r, g, b) - Math.min(r, g, b) < 20 && (r + g + b) / 3 < 95) {
            data[i + 3] = 110;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Tight crop around non-transparent pixels for crisp scaling
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 20) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) return canvas;

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropped = document.createElement('canvas');
    cropped.width = cropW;
    cropped.height = cropH;
    const cctx = cropped.getContext('2d');
    if (cctx) {
      cctx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      return cropped;
    }
    return canvas;
  }
}

export const bossSpriteLoader = new CreatureSpriteLoader(BOSS_IMAGE_URL);
export const sentinelSpriteLoader = new CreatureSpriteLoader(SENTINEL_IMAGE_URL);
