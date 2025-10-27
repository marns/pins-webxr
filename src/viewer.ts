import { getOfferEndpoint, getRTCConfiguration } from './webrtcConfig';

export class Viewer {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;

  async connect(
    videoElement: HTMLVideoElement,
    onConnected: () => void,
    onError: (error: string) => void,
    offerUrl?: string
  ): Promise<void> {
    try {
      const url = offerUrl || getOfferEndpoint();
      console.log('Connecting to signaling endpoint:', url);

      // ICE servers optional via env; default is [] (host-only)
      const pc = new RTCPeerConnection(getRTCConfiguration());
      this.pc = pc;

      // Receive-only transceiver to ensure a video m-line exists
      const transceiver = pc.addTransceiver('video', { direction: 'recvonly' });

      // Prefer H.264 when available (helps Safari)
      try {
        if (
          (transceiver as any).setCodecPreferences &&
          (RTCRtpSender as any).getCapabilities
        ) {
          const caps = RTCRtpSender.getCapabilities('video');
          if (caps && caps.codecs) {
            const h264 = caps.codecs.filter((c) => c.mimeType === 'video/H264');
            const rest = caps.codecs.filter((c) => c.mimeType !== 'video/H264');
            if (h264.length) {
              (transceiver as any).setCodecPreferences(h264.concat(rest));
            }
          }
        }
      } catch (_) {
        // Non-fatal; continue with browser default codec order
      }

      pc.ontrack = async (e) => {
        console.log('Remote track received');
        this.stream = e.streams[0];
        videoElement.srcObject = this.stream;
        try {
          await videoElement.play();
        } catch (err) {
          console.warn('Video play error (may be recoverable):', err);
        }
      };

      // Create offer and wait for ICE gathering to finish (non-trickle)
      await pc.setLocalDescription(await pc.createOffer());

      const waitForIceComplete = new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        // Fallback timeout in case of edge cases
        setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }, 1500);
      });
      await waitForIceComplete;

      const localDesc = pc.localDescription;
      if (!localDesc) throw new Error('Local description missing');

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: localDesc.sdp, type: localDesc.type })
      });
      if (!res.ok) throw new Error(`Signaling failed: ${res.status}`);
      const answer = await res.json();
      await pc.setRemoteDescription(answer);

      const handleState = () => {
        console.log('PC state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          onConnected();
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'closed'
        ) {
          onError(`Peer connection ${pc.connectionState}`);
        }
      };
      pc.onconnectionstatechange = handleState;
      // Fire initial state in case we are already connected (rare)
      handleState();
    } catch (error: any) {
      console.error('Failed to connect to server:', error);
      onError(error?.message || 'Failed to connect');
    }
  }

  disconnect() {
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    console.log('Viewer disconnected');
  }
}
