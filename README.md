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
