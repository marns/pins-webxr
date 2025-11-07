import { Engine, Scene } from "@babylonjs/core";
import { PointLight, HemisphericLight, Vector3, Color3, Color4 } from "@babylonjs/core";
import { ColorCurves } from "@babylonjs/core/Materials/colorCurves";

type DisposeFn = () => void;

export function enableHalloweenMood(scene: Scene, engine: Engine): DisposeFn {
  // Save prior image processing configuration to restore later
  const ip = scene.imageProcessingConfiguration;
  const prev = {
    vignetteEnabled: ip.vignetteEnabled,
    vignetteColor: ip.vignetteColor.clone(),
    vignetteWeight: ip.vignetteWeight,
    vignetteStretch: ip.vignetteStretch,
    toneMappingEnabled: ip.toneMappingEnabled,
    contrast: ip.contrast,
    colorCurvesEnabled: ip.colorCurvesEnabled,
    colorCurves: ip.colorCurves || null,
  };

  // Lights
  const redKey = new PointLight("redKey", new Vector3(0, 1.6, 2.0), scene);
  redKey.diffuse = new Color3(1.0, 0.0, 0.0);
  redKey.specular = new Color3(0.7, 0.08, 0.08);
  redKey.intensity = 1.4;

  const redFill = new HemisphericLight("redFill", new Vector3(0, 1, 0), scene);
  redFill.diffuse = new Color3(1.0, 0.08, 0.08);
  redFill.groundColor = new Color3(0.25, 0.0, 0.0);
  redFill.intensity = 0.12;

  // Post look: vignette + grading
  ip.vignetteEnabled = true;
  ip.vignetteColor = new Color4(0.9, 0.0, 0.0, 1.0);
  ip.vignetteWeight = 2.2;
  ip.vignetteStretch = 0.6;
  ip.toneMappingEnabled = true;
  ip.contrast = 1.18;

  const curves = new ColorCurves();
  curves.globalSaturation = 40;
  curves.highlightsSaturation = 36;
  curves.shadowsSaturation = -24;
  ip.colorCurvesEnabled = true;
  ip.colorCurves = curves;

  // Lightweight key flicker
  let flickerTarget = 1.0;
  let flickerValue = 1.0;
  const obs = scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000; // unused, but kept for clarity
    if (Math.random() < 0.06) {
      const deepDip = Math.random() < 0.35;
      const base = deepDip ? 0.35 : 0.8;
      flickerTarget = base + Math.random() * 0.5; // ~0.35..1.3
    }
    const lerp = 0.08 + Math.random() * 0.04;
    flickerValue += (flickerTarget - flickerValue) * lerp;
    const f = Math.max(0.4, Math.min(1.3, flickerValue));
    redKey.intensity = 1.4 * f;
  });

  return () => {
    // Remove flicker and dispose lights
    if (obs) scene.onBeforeRenderObservable.remove(obs);
    redKey.dispose();
    redFill.dispose();

    // Restore prior post settings
    ip.vignetteEnabled = prev.vignetteEnabled;
    ip.vignetteColor = prev.vignetteColor.clone();
    ip.vignetteWeight = prev.vignetteWeight;
    ip.vignetteStretch = prev.vignetteStretch;
    ip.toneMappingEnabled = prev.toneMappingEnabled;
    ip.contrast = prev.contrast;
    ip.colorCurvesEnabled = prev.colorCurvesEnabled;
    ip.colorCurves = prev.colorCurves;
  };
}

