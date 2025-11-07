// Central configuration with .env overrides (via Vite's import.meta.env)
// Edit defaults here or set VITE_* env vars to override without code changes.

const envAny: any = (import.meta as any).env || {};

const truthy = new Set(["1", "true", "yes", "on"]);

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
  pinSpacing: 0.1,
  // Effects
  halloweenDefault: true,
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
  // Looking Glass
  lkgTargetX: 0,
  lkgTargetY: -0.5,
  lkgTargetZ: 0,
  lkgTargetDiam: 4,
  lkgFovyDeg: 40,
  lkgDepthiness: 0.6,
  lkgTrackballXDeg: 0,
  lkgTrackballYDeg: 90,
  lkgTrackballZDeg: 0,
};

export const AppConfig = {
  grid: {
    width: envNum("VITE_GRID_WIDTH", DEFAULTS.gridWidth),
    aspect: envNum("VITE_ASPECT_RATIO", DEFAULTS.aspect),
    get depth() { return Math.round(this.width * this.aspect); },
    pinSpacing: envNum("VITE_PIN_SPACING", DEFAULTS.pinSpacing),
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

