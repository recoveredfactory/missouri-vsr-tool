// Tiny colormap helpers. Linear interpolation through anchor stops in RGB.
// Not perceptually uniform, but good enough to communicate magnitude.

type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const interpolate = (stops: RGB[], t: number): RGB => {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(stops.length - 1, lo + 1);
  const frac = idx - lo;
  return [
    Math.round(lerp(stops[lo][0], stops[hi][0], frac)),
    Math.round(lerp(stops[lo][1], stops[hi][1], frac)),
    Math.round(lerp(stops[lo][2], stops[hi][2], frac)),
  ];
};

const rgbToHex = ([r, g, b]: RGB): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

// Viridis-ish: purple → teal → yellow. Good for "more is more" metrics.
const SEQUENTIAL_STOPS: RGB[] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

// Diverging blue → grey → red. Symmetric around midpoint. Good for
// "above/below a baseline" metrics like trend slopes or disparity ratios.
const DIVERGING_STOPS: RGB[] = [
  [5, 48, 97],
  [33, 102, 172],
  [146, 197, 222],
  [247, 247, 247],
  [244, 165, 130],
  [178, 24, 43],
  [103, 0, 31],
];

export type Palette = "sequential" | "diverging";

export interface ColorScale {
  domain: [number, number];
  palette: Palette;
  /** Returns a hex color for `value`, or `null` if value is null/NaN. */
  colorFor: (value: number | null | undefined) => string | null;
}

export const buildColorScale = (
  values: number[],
  palette: Palette,
): ColorScale => {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) {
    return {
      domain: [0, 1],
      palette,
      colorFor: () => null,
    };
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);

  if (palette === "diverging") {
    // Center on 0 if the data straddles it; otherwise center on the midpoint.
    const span = Math.max(Math.abs(min), Math.abs(max));
    const lo = -span;
    const hi = span;
    const domain: [number, number] = [lo, hi];
    return {
      domain,
      palette,
      colorFor: (v) => {
        if (v === null || v === undefined || !Number.isFinite(v)) return null;
        const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
        return rgbToHex(interpolate(DIVERGING_STOPS, t));
      },
    };
  }

  const domain: [number, number] = [min, max];
  return {
    domain,
    palette,
    colorFor: (v) => {
      if (v === null || v === undefined || !Number.isFinite(v)) return null;
      const t = max === min ? 0.5 : (v - min) / (max - min);
      return rgbToHex(interpolate(SEQUENTIAL_STOPS, t));
    },
  };
};

export const colorScaleSwatches = (
  scale: ColorScale,
  count = 5,
): Array<{ value: number; color: string }> => {
  const [lo, hi] = scale.domain;
  return Array.from({ length: count }, (_, i) => {
    const v = lo + ((hi - lo) * i) / (count - 1);
    return { value: v, color: scale.colorFor(v) ?? "#ffffff" };
  });
};
