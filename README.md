Looking Glass WebXR Viewer (WebRTC)

A Vite + TypeScript app that renders a pin‑array visualization in a Looking Glass display and subscribes to a local WebRTC broadcast. It connects to a minimal, stateless signaling server that answers SDP offers at `POST /offer` and returns a one‑way video track.

Quick Start
- Install deps: `npm i`
- Start your WebRTC server on `localhost:8080` that exposes `POST /offer` and returns `{ sdp, type }`.
- Run the app: `npm run dev`
- Open the dev URL (e.g., `http://localhost:5173/`). The client will post an SDP offer and attach the returned stream to the scene.

If your signaling server is not on the same origin, either enable CORS on the server or proxy the endpoint.

Configure Signaling (Simplified)
- Set the full offer endpoint URL in `.env`:
  - `VITE_OFFER_URL=http://localhost:8080/offer`
- If not set, the client defaults to `http://localhost:8080/offer`.

ICE Servers (Optional, Simplified)
- Use a single env var with JSON array of RTCIceServer objects:
  - `VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]`
- If not set, no STUN/TURN is used (host candidates only).

Notes
- Media direction: receive‑only. The client does not send audio/video upstream.
- Codecs: The client prefers H.264 when the browser supports codec preferences (helps Safari).
- CORS: If your server is on a different origin, enable CORS for `POST /offer` or proxy it.
- Disconnect: refresh the page. There is a `disconnect()` method in code if you want to add UI later.

Environment File
A starter `.env.example` is included. Copy it to `.env` and tweak as needed:

```
cp .env.example .env
```

Then run `npm run dev` again to pick up changes.

Scripts
- `npm run dev`: Start Vite dev server
- `npm run build`: Production build
- `npm run preview`: Preview build output
 - `npm run launch`: Start Kinect2 WebRTC server + pins-webxr together
 - `npm run launch:bg`: Same as above, detached with logs in `logs/`

Launcher
- Script: `scripts/launch.sh` starts both services. It prefers `../kinect2-webrtc/.venv/bin/python` if present; else uses `python3` on PATH. It runs the Python module in-place via `PYTHONPATH` (no install required).
- Foreground: `npm run launch` (Vite logs in terminal; Kinect logs in `logs/kinect2-webrtc.log`). Automatically opens the WebXR app in your browser. Ctrl+C stops both.
- Background: `npm run launch:bg` (both detached). PIDs are printed; logs in `logs/`. Automatically opens the app when Vite is ready.
- Options: `scripts/launch.sh --kinect-source opencv|kinect --kinect-stream color|depth|ir --host 127.0.0.1 --port 8080 --background [--no-open] [--open-url http://localhost:5173]`.

Where Things Live
- `src/viewer.ts`: Minimal WebRTC client (creates offer, POSTs to `/offer`, sets remote answer, attaches the video track)
- `src/webrtcConfig.ts`: Small helpers for env‑driven endpoint and ICE configuration
- `src/app.ts`: App wiring; creates the Babylon scene and starts the WebRTC connection
 - `src/videoConfig.ts`: Env‑driven video crop settings applied before downsampling
 - `src/config.ts`: Central app configuration with `.env` overrides

Video Crop (Optional)
- Purpose: crop a sub‑region of the incoming video before downsampling to the pin grid. Useful to focus on the subject and improve detail.
- Env vars (fractions 0–1):
  - `VITE_CROP_CENTER_X_PCT` default `0.5` (center X of crop)
  - `VITE_CROP_CENTER_Y_PCT` default `0.5` (center Y of crop)
  - `VITE_CROP_WIDTH_PCT` default `1` (relative width of crop)
  - `VITE_CROP_HEIGHT_PCT` default `1` (relative height of crop)

Examples
- Middle 50% of the frame, centered:
  - `VITE_CROP_WIDTH_PCT=0.5`
  - `VITE_CROP_HEIGHT_PCT=0.5`
  - `VITE_CROP_CENTER_X_PCT=0.5`
  - `VITE_CROP_CENTER_Y_PCT=0.5`

**Depth Enhancement**
- Purpose: exaggerate subtle depth differences (e.g., facial relief) while keeping a stable appearance. All controls are available in an on‑screen panel.

**Signal Assumptions**
- Input is a single‑channel depth stream encoded as 8‑bit grayscale in the video; black (0) means invalid/missing depth.
- The app downsamples to a `36 × 64` grid and maps values to pin heights.

**Equations**
- Base normalization: `u = intensity / 255` in `[0, 1]` (per pixel). Zeros are treated as invalid holes.
- Disparity domain (optional): `d = 1 / max(u, eps)` if Inverse is enabled; else `d = u`.
- Robust center and scale (per frame on valid pixels):
  - `m = median(d)`
  - `s = 1.4826 * median(|d − m|)`  (MAD scaled to std under normality)
- Temporal smoothing (to reduce flicker), with `a = temporalLerp` in `[0,1]`:
  - `m_t = (1 − a) * m_{t−1} + a * m`
  - `s_t = (1 − a) * s_{t−1} + a * s`
- Robust normalization and clamp:
  - `x = clamp((d − m_t) / (k * s_t + eps), −1, 1)` where `k = robustK`.
- S‑curve contrast (mid‑tone boost):
  - `y = 0.5 + 0.5 * tanh(gamma * x)` where `gamma = gamma`.
- Edge‑preserving detail boost (optional bilateral unsharp mask):
  - `blur = bilateral3x3(d, sigmaS, sigmaR)`
  - `d' = d + alpha * (d − blur)` where `alpha = detailAlpha`
  - If enabled, `d'` replaces `d` before normalization.
- Final pin height:
  - Enhanced: `h = y − 0.5`
  - Raw mode (bypass): `h_raw = u − 0.5`
- Invalid pixels (zeros): treated as background (`h = −0.5`).

**Parameters**
- `Enable`: turn enhancement on/off without losing settings.
- `Raw`: bypass all processing and use original normalized intensity.
- `Inverse`: compute in disparity space (`1/u`) to emphasize nearby depth differences.
- `robustK` (≈ 1–5): width of the normalized range around the median; smaller boosts contrast more.
- `gamma` (≈ 0.6–3): strength of the S‑curve; higher increases mid‑tone contrast.
- `detail` (`detailAlpha`, 0–1.5): amount of detail added from the bilateral unsharp mask.
- `sigmaS` (0–3 px): bilateral spatial sigma; larger gathers a wider neighborhood.
- `sigmaR` (0.01–0.5): bilateral range sigma in value units; smaller preserves edges more aggressively.
- `temporal` (`temporalLerp`, 0–0.5): how fast robust stats update; higher responds faster but may flicker.

**Tips**
- If depth looks inverted or unstable, try toggling `Inverse` off and retuning `robustK` and `gamma`.
- Start with `robustK=2.5`, `gamma=1.4`, `detail=0.6`, `sigmaS=1.0`, `sigmaR=0.08`, `temporal=0.10`.
- The pipeline runs on CPU over a small grid (36×64) and is lightweight.

Configuration
- All config has sensible defaults and can be overridden via `.env`.
- Edit `src/config.ts` to change defaults in-code.

Env Vars
- Grid/pins:
  - `VITE_GRID_WIDTH` (default `36`)
  - `VITE_ASPECT_RATIO` (default `1.7777777778`)
  - `VITE_PIN_SPACING` (default `0.12`)
  - `VITE_PIN_LIFT` (default `0.01`) — small Y offset so a 0-depth pin rests just above the ground plane to avoid z-fighting
  - `VITE_PIN_HEIGHT_SCALE` (default `2`) — scales vertical displacement around the neutral 0.5 level
  - `VITE_PIN_LERP` (default `0.25`) — 0..1 smoothing per frame for pin length changes (0 = snap, 1 = instant to target)
  - `VITE_PIN_MAX_STEP` (default `0.03`) — caps maximum per-frame change in pin length (absolute units)
- Effects:
  - `VITE_EFFECT_HALLOWEEN` (default `true`)
- Visualization defaults:
  - `VITE_VIZ_ENABLED` (default `true`)
  - `VITE_VIZ_RAW` (default `false`)
  - `VITE_VIZ_INVERSE` (default `false`)
  - `VITE_VIZ_ROBUST_K` (default `5`)
  - `VITE_VIZ_GAMMA` (default `3.0`)
  - `VITE_VIZ_DETAIL` (default `0.6`)
  - `VITE_VIZ_SIGMA_S` (default `1.0`)
- `VITE_VIZ_SIGMA_R` (default `0.08`)
- `VITE_VIZ_TEMPORAL` (default `0.1`)
- Audio defaults (see “Audio Controls” below):
  - `VITE_AUDIO_ENABLED` (default `true`) — master on/off for the entire audio subsystem.
  - `VITE_AUDIO_REGION_THRESHOLD` (default `0.4`) — per-region motion energy floor before any sound is allowed.
  - `VITE_AUDIO_REGION_COOLDOWN_MS` (default `220`) — cooldown window in milliseconds for a region that just fired.
  - `VITE_AUDIO_REGION_GAIN` (default `0.45`) — gain multiplier applied to the computed region energy.
  - `VITE_AUDIO_PIN_ACTIVATION_THRESHOLD` (default `0.01`) — minimum per-pin movement that counts toward a region’s active fraction.
  - `VITE_AUDIO_REGION_ACTIVATION_FRACTION` (default `0.6`) — fraction of pins that must be active in a region for it to qualify.
  - `VITE_AUDIO_COLOR_JITTER_HZ` (default `350`) — maximum stereo filter frequency offset per burst for tonal variation.
  - `VITE_AUDIO_BULK_BUMP_SCALE` (default `0.7`) — how strongly neighboring regions feed the low rumble layer.
  - `VITE_AUDIO_BULK_DECAY_PER_SECOND` (default `2.0`) — decay rate for the bulk layer envelope.
  - `VITE_AUDIO_BULK_MAX_ENV` (default `1.5`) — ceiling for the bulk layer envelope to avoid clipping.
- Looking Glass view:
  - `VITE_LKG_TARGET_X` (default `0`)
  - `VITE_LKG_TARGET_Y` (default `-0.5`)
  - `VITE_LKG_TARGET_Z` (default `0`)
  - `VITE_LKG_TARGET_DIAM` (default `4`)
  - `VITE_LKG_FOVY_DEG` (default `40`)
  - `VITE_LKG_DEPTHINESS` (default `0.6`)
  - `VITE_LKG_TRACKBALL_X_DEG` (default `0`)
  - `VITE_LKG_TRACKBALL_Y_DEG` (default `90`)
  - `VITE_LKG_TRACKBALL_Z_DEG` (default `0`)

Effects
- Toggle the Halloween mood in the on‑screen panel under Effects.
- Implementation lives in `src/effects.ts` as `enableHalloweenMood(scene, engine)` which returns a disposer to turn it off and restore prior post‑processing settings.
- Use the same pattern to add more composable, toggleable effects.

Audio Controls
- `Sound`: master checkbox in the Audio panel (mirrors `VITE_AUDIO_ENABLED`). When off, the audio graph stays warm but outputs silence so you can re-enable instantly.
- `active pins` (`VITE_AUDIO_REGION_ACTIVATION_FRACTION`): raises/lowers how many pins in a region must exceed the per-pin threshold before sound can trigger.
- `pin movement` (`VITE_AUDIO_PIN_ACTIVATION_THRESHOLD`): per-pin motion needed before a pin is considered “active.”
- `region energy` (`VITE_AUDIO_REGION_THRESHOLD`): rejects noisy single pixels—only energetic regions pass this gate.
- `region cooldown` (`VITE_AUDIO_REGION_COOLDOWN_MS`): milliseconds to wait before the same region can fire again.
- `region gain` (`VITE_AUDIO_REGION_GAIN`): scales the burst amplitude feeding the stereo envelopes.
- Advanced env-only knobs:
  - `VITE_AUDIO_COLOR_JITTER_HZ` biases how far the stereo band-pass filters can wander per burst.
  - `VITE_AUDIO_BULK_BUMP_SCALE`, `VITE_AUDIO_BULK_DECAY_PER_SECOND`, and `VITE_AUDIO_BULK_MAX_ENV` shape the low “bulk” layer that rumbles when adjacent regions move together.
