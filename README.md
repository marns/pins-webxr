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
