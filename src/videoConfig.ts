// Video processing configuration for pre-downsample cropping
// Reads AppConfig defaults (with env overrides) and allows URL-based tweaks

import { AppConfig } from "./config";

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
  // Allow quick runtime overrides via URL query params (no rebuild needed)
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

  const cxRaw = params.get('cropX');
  const cyRaw = params.get('cropY');
  const wRaw = params.get('cropW');
  const hRaw = params.get('cropH');

  // Log the raw inputs once to help diagnose env loading issues
  if (!(window as any).__loggedCropEnvRaw) {
    console.log('Video crop raw inputs:', {
      cxRaw,
      cyRaw,
      wRaw,
      hRaw,
      from: params.toString() ? 'query-params' : 'config',
      defaults: AppConfig.videoCrop
    });
    (window as any).__loggedCropEnvRaw = true;
  }

  const config: VideoCropConfig = { ...AppConfig.videoCrop };

  if (cxRaw !== null) config.centerX = clamp(parseNumber(cxRaw, config.centerX), 0, 1);
  if (cyRaw !== null) config.centerY = clamp(parseNumber(cyRaw, config.centerY), 0, 1);
  if (wRaw !== null) config.widthPct = clamp(parseNumber(wRaw, config.widthPct), 0.01, 1);
  if (hRaw !== null) config.heightPct = clamp(parseNumber(hRaw, config.heightPct), 0.01, 1);

  return config;
}
