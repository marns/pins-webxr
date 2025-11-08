// Central configuration with .env overrides (via Vite's import.meta.env)
// Edit defaults here or set VITE_* env vars to override without code changes.

const envAny: any = (import.meta as any).env || {};

const truthy = new Set(["1", "true", "yes", "on"]);

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function envNum(name: string, def: number): number {
  const v = envAny?.[name];
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envBool(name: string, def: boolean): boolean {
  const v = envAny?.[name];
  if (v === undefined || v === null || v === "") return def;
  if (typeof v === "boolean") return v;
  return truthy.has(String(v).toLowerCase());
}

function degToRad(d: number): number { return (d * Math.PI) / 180; }

// Defaults live here; .env can override
const DEFAULTS = {
  gridWidth: 36,
  aspect: 16 / 9, // width*aspect => depth
  pinSpacing: 0.12,
  pinLift: 0.01,
  pinHeightScale: 2,
  pinLerp: 0.35,
  pinMaxStep: 0.20,
  // Effects
  halloweenDefault: false,
  // Visualization defaults
  vizEnabled: true,
  vizRaw: false,
  vizInverse: false,
  vizRobustK: 5,
  vizGamma: 3.0,
  vizDetail: 0.6,
  vizSigmaS: 1.0,
  vizSigmaR: 0.08,
  vizTemporal: 0.1,
  // Audio
  audioEnabled: true,
  audioRegionThreshold: 0.4,
  audioRegionCooldownMs: 220,
  audioRegionGain: 0.45,
  audioPinActivationThreshold: 0.01,
  audioRegionActivationFraction: 0.6,
  audioColorJitterHz: 350,
  audioBulkBumpScale: 0.7,
  audioBulkDecayPerSecond: 2.0,
  audioBulkMaxEnv: 1.5,
  // Looking Glass
  lkgTargetX: 0,
  lkgTargetY: -0.5,
  lkgTargetZ: 0,
  lkgTargetDiam: 4,
  lkgFovyDeg: 40,
  lkgDepthiness: 0.75,
  lkgTrackballXDeg: 0,
  lkgTrackballYDeg: 90,
  lkgTrackballZDeg: 0,
  // Video crop (normalized percentages)
  cropCenterX: 0.5,
  cropCenterY: 0.5,
  cropWidthPct: 0.8,
  cropHeightPct: 0.8,
};

export const AppConfig = {
  grid: {
    width: envNum("VITE_GRID_WIDTH", DEFAULTS.gridWidth),
    aspect: envNum("VITE_ASPECT_RATIO", DEFAULTS.aspect),
    get depth() { return Math.round(this.width * this.aspect); },
    pinSpacing: envNum("VITE_PIN_SPACING", DEFAULTS.pinSpacing),
    pinLift: envNum("VITE_PIN_LIFT", DEFAULTS.pinLift),
    pinHeightScale: envNum("VITE_PIN_HEIGHT_SCALE", DEFAULTS.pinHeightScale),
    pinLerp: envNum("VITE_PIN_LERP", DEFAULTS.pinLerp),
    pinMaxStep: envNum("VITE_PIN_MAX_STEP", DEFAULTS.pinMaxStep),
  },
  effects: {
    halloweenDefault: envBool("VITE_EFFECT_HALLOWEEN", DEFAULTS.halloweenDefault),
  },
  viz: {
    enabled: envBool("VITE_VIZ_ENABLED", DEFAULTS.vizEnabled),
    rawMode: envBool("VITE_VIZ_RAW", DEFAULTS.vizRaw),
    useInverse: envBool("VITE_VIZ_INVERSE", DEFAULTS.vizInverse),
    robustK: envNum("VITE_VIZ_ROBUST_K", DEFAULTS.vizRobustK),
    gamma: envNum("VITE_VIZ_GAMMA", DEFAULTS.vizGamma),
    detailAlpha: envNum("VITE_VIZ_DETAIL", DEFAULTS.vizDetail),
    sigmaS: envNum("VITE_VIZ_SIGMA_S", DEFAULTS.vizSigmaS),
    sigmaR: envNum("VITE_VIZ_SIGMA_R", DEFAULTS.vizSigmaR),
    temporalLerp: envNum("VITE_VIZ_TEMPORAL", DEFAULTS.vizTemporal),
  },
  videoCrop: {
    centerX: clamp(envNum("VITE_CROP_CENTER_X_PCT", DEFAULTS.cropCenterX), 0, 1),
    centerY: clamp(envNum("VITE_CROP_CENTER_Y_PCT", DEFAULTS.cropCenterY), 0, 1),
    widthPct: clamp(envNum("VITE_CROP_WIDTH_PCT", DEFAULTS.cropWidthPct), 0.01, 1),
    heightPct: clamp(envNum("VITE_CROP_HEIGHT_PCT", DEFAULTS.cropHeightPct), 0.01, 1),
  },
  audio: {
    enabled: envBool("VITE_AUDIO_ENABLED", DEFAULTS.audioEnabled),
    regionThreshold: envNum("VITE_AUDIO_REGION_THRESHOLD", DEFAULTS.audioRegionThreshold),
    regionCooldownMs: envNum("VITE_AUDIO_REGION_COOLDOWN_MS", DEFAULTS.audioRegionCooldownMs),
    regionGain: envNum("VITE_AUDIO_REGION_GAIN", DEFAULTS.audioRegionGain),
    pinActivationThreshold: envNum("VITE_AUDIO_PIN_ACTIVATION_THRESHOLD", DEFAULTS.audioPinActivationThreshold),
    regionActivationFraction: envNum("VITE_AUDIO_REGION_ACTIVATION_FRACTION", DEFAULTS.audioRegionActivationFraction),
    colorJitterHz: envNum("VITE_AUDIO_COLOR_JITTER_HZ", DEFAULTS.audioColorJitterHz),
    bulkBumpScale: envNum("VITE_AUDIO_BULK_BUMP_SCALE", DEFAULTS.audioBulkBumpScale),
    bulkDecayPerSecond: envNum("VITE_AUDIO_BULK_DECAY_PER_SECOND", DEFAULTS.audioBulkDecayPerSecond),
    bulkMaxEnv: envNum("VITE_AUDIO_BULK_MAX_ENV", DEFAULTS.audioBulkMaxEnv),
  },
  lookingGlass: {
    targetX: envNum("VITE_LKG_TARGET_X", DEFAULTS.lkgTargetX),
    targetY: envNum("VITE_LKG_TARGET_Y", DEFAULTS.lkgTargetY),
    targetZ: envNum("VITE_LKG_TARGET_Z", DEFAULTS.lkgTargetZ),
    targetDiam: envNum("VITE_LKG_TARGET_DIAM", DEFAULTS.lkgTargetDiam),
    fovy: degToRad(envNum("VITE_LKG_FOVY_DEG", DEFAULTS.lkgFovyDeg)),
    depthiness: envNum("VITE_LKG_DEPTHINESS", DEFAULTS.lkgDepthiness),
    trackballX: degToRad(envNum("VITE_LKG_TRACKBALL_X_DEG", DEFAULTS.lkgTrackballXDeg)),
    trackballY: degToRad(envNum("VITE_LKG_TRACKBALL_Y_DEG", DEFAULTS.lkgTrackballYDeg)),
    trackballZ: degToRad(envNum("VITE_LKG_TRACKBALL_Z_DEG", DEFAULTS.lkgTrackballZDeg)),
  },
} as const;
