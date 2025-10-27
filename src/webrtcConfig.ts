// Helper to configure PeerJS for local or default setups
// Reads Vite env vars when available.

export type LocalPeerConfig = {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  noIceServers?: boolean;
};

export function getPeerOptions(): any {
  // Env-driven configuration
  const envAny: any = (import.meta as any).env || {};
  const host = envAny.VITE_PEER_HOST as string | undefined;
  const portRaw = envAny.VITE_PEER_PORT as string | undefined;
  const pathEnv = envAny.VITE_PEER_PATH as string | undefined;
  const secureEnv = envAny.VITE_PEER_SECURE as string | undefined;
  const noIceEnv = envAny.VITE_PEER_NO_ICE as string | undefined;

  const port = portRaw ? Number(portRaw) : undefined;
  const secure = typeof secureEnv === 'string' ? secureEnv === 'true' : undefined;
  const noIceServers = noIceEnv === 'true';

  const base: any = {
    config: {
      // No STUN/TURN if requested; otherwise leave default empty and let browser defaults apply
      iceServers: noIceServers
        ? []
        : [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
    }
  };

  // If host/port provided, assume a local PeerServer (e.g., localhost:8080)
  if (host) base.host = host;
  if (typeof port === 'number' && !Number.isNaN(port)) base.port = port;
  if (typeof secure === 'boolean') base.secure = secure;
  if (pathEnv) base.path = pathEnv;

  return base;
}

// Convenience: a ready-made local config for localhost:8080 with no ICE
export function getLocalhostNoIcePeerOptions(): any {
  return {
    host: 'localhost',
    port: 8080,
    secure: false,
    path: '/peerjs',
    config: { iceServers: [] }
  };
}

// Offer endpoint configuration for minimal signaling servers (POST /offer)
export function getOfferEndpoint(): string {
  const full = (import.meta as any).env.VITE_OFFER_URL as string | undefined;
  // Default to localhost when not provided
  return full || 'http://localhost:8080/offer';
}

// RTCConfiguration helpers for ICE servers via env
// Single style: VITE_ICE_SERVERS as JSON (array of RTCIceServer objects)
export function getIceServers(): RTCIceServer[] {
  const json = (import.meta as any).env.VITE_ICE_SERVERS as string | undefined;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed as RTCIceServer[];
    } catch {}
  }
  return [];
}

export function getRTCConfiguration(): RTCConfiguration {
  return { iceServers: getIceServers() };
}
