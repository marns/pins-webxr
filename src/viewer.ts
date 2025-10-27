import Peer from 'peerjs';
import type { MediaConnection } from 'peerjs';

export class Viewer {
  private peer: Peer | null = null;
  private call: MediaConnection | null = null;

  async initialize(onError: (error: string) => void) {
    try {
      // Create a new Peer instance
      this.peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('Viewer Peer ID:', id);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        onError(`Peer error: ${err.message}`);
      });
    } catch (error) {
      console.error('Failed to initialize viewer:', error);
      onError('Failed to initialize viewer');
    }
  }

  async connectToBroadcaster(
    broadcasterId: string,
    videoElement: HTMLVideoElement,
    onConnected: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.peer) {
      onError('Viewer not initialized');
      return;
    }

    try {
      console.log('Connecting to broadcaster:', broadcasterId);

      // Create a dummy stream with both audio and video tracks
      // This ensures proper WebRTC negotiation for receiving video
      const dummyStream = new MediaStream();
      
      // Create a dummy video track (blank canvas)
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const canvasStream = canvas.captureStream();
      const videoTrack = canvasStream.getVideoTracks()[0];
      dummyStream.addTrack(videoTrack);
      
      // Create a dummy audio track (silent)
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const audioTrack = destination.stream.getAudioTracks()[0];
      dummyStream.addTrack(audioTrack);
      
      console.log('Dummy stream tracks:', dummyStream.getTracks().length);
      dummyStream.getTracks().forEach(track => {
        console.log('Sending track:', track.kind);
      });

      // Call the broadcaster with the dummy stream
      this.call = this.peer.call(broadcasterId, dummyStream);

      if (!this.call) {
        onError('Failed to initiate call');
        return;
      }

      // Listen for the remote stream
      this.call.on('stream', async (remoteStream) => {
        console.log('Received remote stream with tracks:', remoteStream.getTracks().length);
        remoteStream.getTracks().forEach(track => {
          console.log('Track:', track.kind, 'enabled:', track.enabled);
        });
        videoElement.srcObject = remoteStream;
        try {
          await videoElement.play();
          console.log('Video playback started');
        } catch (err) {
          console.warn('Video play error (may be recoverable):', err);
        }
        onConnected();
      });

      this.call.on('close', () => {
        console.log('Call closed');
        videoElement.srcObject = null;
        dummyStream.getTracks().forEach(track => track.stop());
        audioContext.close();
        onError('Connection closed by broadcaster');
      });

      this.call.on('error', (err) => {
        console.error('Call error:', err);
        onError(`Connection error: ${err.message}`);
        dummyStream.getTracks().forEach(track => track.stop());
        audioContext.close();
      });
      
      console.log('Call initiated, waiting for stream...');
    } catch (error) {
      console.error('Failed to connect to broadcaster:', error);
      onError('Failed to connect to broadcaster');
    }
  }

  disconnect() {
    if (this.call) {
      this.call.close();
      this.call = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    console.log('Viewer disconnected');
  }
}

