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
