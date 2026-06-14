// Filter definitions

export const FILTERS = {
  none: {
    label: "Original",
    desc: "No colour adjustment",
    apply: (r, g, b) => [r, g, b],
  },
  grayscale: {
    label: "Grayscale",
    desc: "Luminance-weighted grey",
    apply: (r, g, b) => {
      const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      return [v, v, v];
    },
  },
  gameboy: {
    label: "Game Boy",
    desc: "4-shade green LCD palette",
    apply: (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const palette = [
        [15, 56, 15],
        [48, 98, 48],
        [139, 172, 15],
        [155, 188, 15],
      ];
      const idx = Math.min(3, Math.floor((lum / 255) * 4));
      return palette[idx];
    },
  },
  cga: {
    label: "CGA Magenta",
    desc: "Classic CGA 4-colour mode",
    apply: (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const palette = [
        [0, 0, 0],
        [85, 255, 255],
        [255, 85, 255],
        [255, 255, 255],
      ];
      const idx = Math.min(3, Math.floor((lum / 255) * 4));
      return palette[idx];
    },
  },
  nes: {
    label: "NES",
    desc: "NES-inspired warm palette",
    apply: (r, g, b) => {
      const palette = [
        [0, 0, 0],
        [252, 188, 176],
        [248, 108, 48],
        [228, 92, 16],
        [120, 48, 0],
        [252, 228, 160],
        [252, 252, 0],
        [248, 216, 0],
        [0, 120, 0],
        [0, 184, 0],
        [0, 168, 0],
        [184, 248, 24],
        [0, 0, 188],
        [0, 88, 248],
        [0, 120, 248],
        [60, 188, 252],
        [68, 40, 188],
        [104, 68, 252],
        [188, 0, 188],
        [216, 0, 204],
        [148, 0, 132],
        [248, 120, 248],
        [252, 116, 180],
        [252, 116, 96],
      ];
      let best = 0,
        bestDist = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const [pr, pg, pb] = palette[i];
        const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return palette[best];
    },
  },
  sepia: {
    label: "Sepia",
    desc: "Warm vintage tones",
    apply: (r, g, b) =>
      [
        Math.min(255, r * 0.393 + g * 0.769 + b * 0.189),
        Math.min(255, r * 0.349 + g * 0.686 + b * 0.168),
        Math.min(255, r * 0.272 + g * 0.534 + b * 0.131),
      ].map(Math.round),
  },
  invert: {
    label: "Invert",
    desc: "Negative image",
    apply: (r, g, b) => [255 - r, 255 - g, 255 - b],
  },
  neon: {
    label: "Neon",
    desc: "Cyberpunk glow palette",
    apply: (r, g, b) => {
      const palette = [
        [10, 0, 20],
        [255, 0, 128],
        [0, 255, 200],
        [255, 255, 0],
        [128, 0, 255],
        [0, 200, 255],
        [255, 100, 0],
        [255, 255, 255],
      ];
      let best = 0,
        bestDist = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const [pr, pg, pb] = palette[i];
        const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return palette[best];
    },
  },
  solarize: {
    label: "Solarize",
    desc: "Darkroom accident effect",
    apply: (r, g, b) => [
      r < 128 ? r : 255 - r,
      g < 128 ? g : 255 - g,
      b < 128 ? b : 255 - b,
    ],
  },
  blueprint: {
    label: "Blueprint",
    desc: "Technical drawing blue",
    apply: (r, g, b) => {
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      return lum > 128 ? [200, 220, 255] : [0, 30, 90];
    },
  },
};

export const FILTER_KEYS = Object.keys(FILTERS);

// Core pixelation engine

export function pixelate({
  imageData,
  width,
  height,
  blockSize,
  filter,
  contrast,
  brightness,
  saturation,
  dither,
}) {
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  const filterFn = FILTERS[filter]?.apply ?? FILTERS.none.apply;

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        count = 0;

      for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4;
          rSum += src[i];
          gSum += src[i + 1];
          bSum += src[i + 2];
          count++;
        }
      }

      let r = rSum / count;
      let g = gSum / count;
      let b = bSum / count;

      // Brightness
      r = clamp(r + (brightness - 100) * 2.55);
      g = clamp(g + (brightness - 100) * 2.55);
      b = clamp(b + (brightness - 100) * 2.55);

      // Contrast
      const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
      r = clamp(cf * (r - 128) + 128);
      g = clamp(cf * (g - 128) + 128);
      b = clamp(cf * (b - 128) + 128);

      // Saturation
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const s = saturation / 100;
      r = clamp(lum + s * (r - lum));
      g = clamp(lum + s * (g - lum));
      b = clamp(lum + s * (b - lum));

      // Dither (ordered 2x2 Bayer)
      if (dither) {
        const bayer = [
          [0, 2],
          [3, 1],
        ];
        const threshold =
          (bayer[(y / blockSize) % 2][(x / blockSize) % 2] / 4 - 0.5) * 40;
        r = clamp(r + threshold);
        g = clamp(g + threshold);
        b = clamp(b + threshold);
      }

      const [fr, fg, fb] = filterFn(
        Math.round(r),
        Math.round(g),
        Math.round(b),
      );

      for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4;
          out[i] = fr;
          out[i + 1] = fg;
          out[i + 2] = fb;
          out[i + 3] = 255;
        }
      }
    }
  }

  return new ImageData(out, width, height);
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}
