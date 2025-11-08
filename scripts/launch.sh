#!/usr/bin/env bash

set -euo pipefail

# Pins WebXR + Kinect2 WebRTC launcher
# - Starts the Python signaling/stream server
# - Starts the Vite dev server for pins-webxr
#
# Usage:
#   scripts/launch.sh [--background] [--kinect-source opencv|kinect] [--kinect-stream color|depth|ir] [--port 8080]
#
# Notes:
# - If ../kinect2-webrtc/.venv exists, its Python is used.
# - Otherwise falls back to python3 on PATH.
# - In background mode, processes are detached and logs are written to logs/.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBXR_DIR="$(cd "$HERE/.." && pwd)"
KINECT_DIR="$(cd "$WEBXR_DIR/../kinect2-webrtc" && pwd)"

# Defaults
BG_MODE=false
OPEN_BROWSER=true
OPEN_URL_OVERRIDE=""
KINECT_SOURCE="kinect"      # or opencv
KINECT_STREAM="depth"       # color|depth|ir (used when source=kinect)
HOST="127.0.0.1"
PORT=8080

while [[ $# -gt 0 ]]; do
  case "$1" in
    --background|--bg)
      BG_MODE=true
      shift
      ;;
    --no-open)
      OPEN_BROWSER=false
      shift
      ;;
    --open-url)
      OPEN_URL_OVERRIDE="$2"; shift 2
      ;;
    --kinect-source)
      KINECT_SOURCE="$2"; shift 2
      ;;
    --kinect-stream)
      KINECT_STREAM="$2"; shift 2
      ;;
    --host)
      HOST="$2"; shift 2
      ;;
    --port)
      PORT="$2"; shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--background] [--kinect-source opencv|kinect] [--kinect-stream color|depth|ir] [--host 127.0.0.1] [--port 8080]"
      echo "            [--no-open] [--open-url http://localhost:5173]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2; exit 1
      ;;
  esac
done

if [[ ! -d "$KINECT_DIR" ]]; then
  echo "Error: sibling repo ../kinect2-webrtc not found at: $KINECT_DIR" >&2
  exit 1
fi

# Choose Python (prefer project venv if present)
PY="$KINECT_DIR/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PY="python3"
  elif command -v python >/dev/null 2>&1; then
    PY="python"
  else
    echo "Error: python3 not found and no .venv in $KINECT_DIR" >&2
    exit 1
  fi
fi

LOG_DIR="$WEBXR_DIR/logs"
mkdir -p "$LOG_DIR"

# Start Kinect2 WebRTC server
KINECT_LOG="$LOG_DIR/kinect2-webrtc.log"

pushd "$KINECT_DIR" >/dev/null
KINECT_CMD=("$PY" -m kinect2_webrtc.server --host "$HOST" --port "$PORT" --source "$KINECT_SOURCE")
if [[ "$KINECT_SOURCE" == "kinect" ]]; then
  KINECT_CMD+=(--stream "$KINECT_STREAM")
fi

if $BG_MODE; then
  echo "[launcher] Starting kinect2-webrtc in background (logs: $KINECT_LOG)"
  # Ensure src/ on PYTHONPATH for editable run without install
  PYTHONPATH="$KINECT_DIR/src${PYTHONPATH:+:$PYTHONPATH}" nohup "${KINECT_CMD[@]}" \
    >"$KINECT_LOG" 2>&1 &
  KINECT_PID=$!
else
  echo "[launcher] Starting kinect2-webrtc (PID will be tracked)"
  PYTHONPATH="$KINECT_DIR/src${PYTHONPATH:+:$PYTHONPATH}" "${KINECT_CMD[@]}" \
    >"$KINECT_LOG" 2>&1 &
  KINECT_PID=$!
fi
popd >/dev/null

# In foreground mode, ensure cleanup
cleanup() {
  echo "[launcher] Shutting down..."
  if [[ -n "${KINECT_PID:-}" ]]; then
    kill "$KINECT_PID" >/dev/null 2>&1 || true
    wait "$KINECT_PID" 2>/dev/null || true
  fi
}

if ! $BG_MODE; then
  trap cleanup EXIT INT TERM
fi

# Start Vite dev server for pins-webxr
WEBXR_LOG="$LOG_DIR/pins-webxr.log"
pushd "$WEBXR_DIR" >/dev/null

DEV_CMD=(npm run dev)

open_url() {
  local url="$1"
  if [[ -n "$OPEN_URL_OVERRIDE" ]]; then
    url="$OPEN_URL_OVERRIDE"
  fi
  if ! $OPEN_BROWSER; then
    return 0
  fi
  if command -v open >/dev/null 2>&1; then
    (sleep 0.2; open "$url") &
  elif command -v xdg-open >/dev/null 2>&1; then
    (sleep 0.2; xdg-open "$url") &
  elif command -v powershell.exe >/dev/null 2>&1; then
    (sleep 0.2; powershell.exe Start-Process "$url") &
  else
    echo "[launcher] Could not find a tool to open the browser automatically. URL: $url"
  fi
}

wait_for_vite_and_open() {
  # Try to read the served URL from the Vite log, fall back to default.
  local url=""
  for _ in $(seq 1 60); do
    if [[ -f "$WEBXR_LOG" ]]; then
      url=$(grep -Eo 'http://(localhost|127\.0\.0\.1):[0-9]+' "$WEBXR_LOG" | tail -n1 || true)
      if [[ -n "$url" ]]; then
        break
      fi
    fi
    sleep 0.5
  done
  if [[ -z "$url" ]]; then
    url="http://localhost:5173"
  fi
  echo "[launcher] Opening $url"
  open_url "$url"
}

if $BG_MODE; then
  echo "[launcher] Starting pins-webxr (Vite) in background (logs: $WEBXR_LOG)"
  nohup "${DEV_CMD[@]}" >"$WEBXR_LOG" 2>&1 &
  WEBXR_PID=$!
  echo "[launcher] Background PIDs -> kinect2-webrtc: $KINECT_PID, pins-webxr: $WEBXR_PID"
  echo "[launcher] Visit Vite URL (usually http://localhost:5173) and signaling at http://$HOST:$PORT"
  if $OPEN_BROWSER; then
    wait_for_vite_and_open
  fi
  exit 0
else
  echo "[launcher] Starting pins-webxr (Vite) in foreground..."
  echo "[launcher] Signaling endpoint expected at http://$HOST:$PORT/offer"
  # Stream Vite logs to console; Kinect logs are in $KINECT_LOG
  if $OPEN_BROWSER && [[ -z "$OPEN_URL_OVERRIDE" ]]; then
    # Let Vite open the browser itself
    npm run dev -- --open
  else
    # Start Vite and open the URL ourselves
    open_url "${OPEN_URL_OVERRIDE:-http://localhost:5173}"
    npm run dev
  fi
fi
