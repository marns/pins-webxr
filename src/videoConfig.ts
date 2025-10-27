// Video processing configuration for pre-downsample cropping
// Reads Vite env vars and returns a normalized config

export type VideoCropConfig = {
  // Center of crop in normalized [0,1] space
  centerX: number;
  centerY: number;
  // Size of crop as fraction of full frame [0,1]
  widthPct: number;
  heightPct: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getVideoCropConfig(): VideoCropConfig {
  // Read from Vite env with a safe accessor. Some bundlers/plugins are picky
  // about the shape of the expression, so prefer bracket access.
  // IMPORTANT: use direct dot access so Vite can statically detect and expose
  // these keys in both dev and build. Avoid optional chaining before `env`.
  const envAny: any = (import.meta as any).env || {};

  // Allow quick runtime overrides via URL query params (no rebuild needed)
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

  const cxRaw = params.get('cropX') ?? (envAny.VITE_CROP_CENTER_X_PCT as string | undefined);
  const cyRaw = params.get('cropY') ?? (envAny.VITE_CROP_CENTER_Y_PCT as string | undefined);
  const wRaw = params.get('cropW') ?? (envAny.VITE_CROP_WIDTH_PCT as string | undefined);
  const hRaw = params.get('cropH') ?? (envAny.VITE_CROP_HEIGHT_PCT as string | undefined);

  // Log the raw inputs once to help diagnose env loading issues
  if (!(window as any).__loggedCropEnvRaw) {
    console.log('Video crop raw inputs:', { cxRaw, cyRaw, wRaw, hRaw, from: params.toString() ? 'query-params' : 'env' });
    (window as any).__loggedCropEnvRaw = true;
  }

  const centerX = clamp(parseNumber(cxRaw as any, 0.5), 0, 1);
  const centerY = clamp(parseNumber(cyRaw as any, 0.5), 0, 1);
  const widthPct = clamp(parseNumber(wRaw as any, 1), 0.01, 1);
  const heightPct = clamp(parseNumber(hRaw as any, 1), 0.01, 1);

  return { centerX, centerY, widthPct, heightPct };
}
