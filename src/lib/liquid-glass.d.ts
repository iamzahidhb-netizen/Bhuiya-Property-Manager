export interface LiquidGlassOptions {
  /** Displacement strength (negative = magnifying bulge; range: -60 to -180). Default: -112 */
  scale?: number;
  /** Per-channel scale stagger for prism fringe. 0 disables. Default: 6 */
  chroma?: number;
  /** Neutral interior inset as fraction of smaller side. Default: 0.07 */
  border?: number;
  /** Edge-curvature softness (px) of the map's gray inset. Default: 12 */
  mapBlur?: number;
  /** Backdrop blur (px) behind the glass interior. Default: 3 */
  blur?: number;
  /** Backdrop saturation boost. Default: 1.5 */
  saturate?: number;
  /** Corner radius override (px); defaults to reading computed border-radius */
  radius?: number | null;
  /** Frosted blur fallback (px) on Safari/Firefox/unsupported. Default: 16 */
  fallbackBlur?: number;
}

export interface LiquidGlassInstance {
  /** Whether native SVG displacement refraction is supported in current browser */
  supported: boolean;
  /** Re-calculates and regenerates map after manual size changes */
  refresh: () => void;
  /** Cleans up SVG filter, observers, and styles */
  destroy: () => void;
}

export declare const isLiquidGlassSupported: boolean;

export declare function liquidGlass(
  el: HTMLElement | null,
  opts?: LiquidGlassOptions
): LiquidGlassInstance;

export default liquidGlass;

declare global {
  interface Window {
    liquidGlass?: typeof liquidGlass;
    isLiquidGlassSupported?: boolean;
  }
}
