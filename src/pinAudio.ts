type AudioContextCtor = typeof AudioContext;

type NoiseColor = "white" | "pink" | "brown";

type PinAudioOptions = {
    colorJitterHz?: number;
    bulkBumpScale?: number;
    bulkDecayPerSecond?: number;
    bulkMaxEnv?: number;
};

export class PinAudio {
    private ctx?: AudioContext;
    private masterGain?: GainNode;
    private masterCompressor?: DynamicsCompressorNode;
    private leftGain?: GainNode;
    private rightGain?: GainNode;
    private bulkGain?: GainNode;
    private leftFilter?: BiquadFilterNode;
    private rightFilter?: BiquadFilterNode;
    private bulkFilter?: BiquadFilterNode;
    private leftSource?: AudioBufferSourceNode;
    private rightSource?: AudioBufferSourceNode;
    private bulkSource?: AudioBufferSourceNode;
    private shimmerSource?: AudioBufferSourceNode;
    private leftEnv = 0;
    private rightEnv = 0;
    private bulkEnv = 0;
    private readonly bumpScale = 0.4;
    private readonly maxEnv = 1.2;
    private readonly decayPerSecond = 4.0;
    private readonly rampSeconds = 0.03;
    private readonly attackMix = 0.45;
    private readonly bulkAttackMix = 0.3;
    private readonly baseLeftFreq = 900;
    private readonly baseRightFreq = 1250;
    private readonly baseOutputGain = 0.24;
    private isMuted = false;
    private readonly colorJitterHz: number;
    private readonly bulkBumpScale: number;
    private readonly bulkDecayPerSecond: number;
    private readonly bulkMaxEnv: number;

    constructor(options: PinAudioOptions = {}) {
        if (typeof window === "undefined") return;
        const AudioCtor: AudioContextCtor | undefined = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtor) return;
        this.colorJitterHz = options.colorJitterHz ?? 320;
        this.bulkBumpScale = options.bulkBumpScale ?? 0.5;
        this.bulkDecayPerSecond = options.bulkDecayPerSecond ?? 2.5;
        this.bulkMaxEnv = options.bulkMaxEnv ?? 1.2;
        this.ctx = new AudioCtor();
        this.buildGraph();
        this.attachUnlockHandlers();
    }

    bumpRegion(pan: number, gain: number, bulkAmount: number, color: number) {
        if (!this.ctx) return;
        const safeGain = Math.max(0, gain);
        const panClamped = Math.min(1, Math.max(0, pan));
        const leftAmount = safeGain * (1 - panClamped);
        const rightAmount = safeGain * panClamped;
        const leftTarget = Math.min(this.maxEnv, this.leftEnv + leftAmount * this.bumpScale);
        const rightTarget = Math.min(this.maxEnv, this.rightEnv + rightAmount * this.bumpScale);
        this.leftEnv += (leftTarget - this.leftEnv) * this.attackMix;
        this.rightEnv += (rightTarget - this.rightEnv) * this.attackMix;
        if (bulkAmount > 1e-4) {
            const bulkTarget = Math.min(this.bulkMaxEnv, this.bulkEnv + bulkAmount * this.bulkBumpScale);
            this.bulkEnv += (bulkTarget - this.bulkEnv) * this.bulkAttackMix;
        }
        this.jitterFilters(color);
        this.applyGains();
    }

    update(deltaSeconds: number) {
        if (!this.ctx) return;
        const dt = Math.max(0, deltaSeconds);
        const decay = Math.exp(-this.decayPerSecond * dt);
        const bulkDecay = Math.exp(-this.bulkDecayPerSecond * dt);
        this.leftEnv *= decay;
        this.rightEnv *= decay;
        this.bulkEnv *= bulkDecay;
        this.applyGains();
    }

    private jitterFilters(color: number) {
        if (!this.ctx || !this.leftFilter || !this.rightFilter) return;
        const now = this.ctx.currentTime;
        const clampFreq = (freq: number) => Math.max(100, Math.min(5000, freq));
        const c = Math.max(-1, Math.min(1, color));
        const leftFreq = clampFreq(this.baseLeftFreq + this.colorJitterHz * c);
        this.leftFilter.frequency.cancelScheduledValues(now);
        this.leftFilter.frequency.setTargetAtTime(leftFreq, now, 0.015);
        this.leftFilter.Q.cancelScheduledValues(now);
        this.leftFilter.Q.setTargetAtTime(Math.max(0.4, Math.min(4.5, 1.1 + c * 0.35)), now, 0.02);
        const rightColor = Math.max(-1, Math.min(1, c + (Math.random() - 0.5) * 0.35));
        const rightFreq = clampFreq(this.baseRightFreq + this.colorJitterHz * rightColor);
        this.rightFilter.frequency.cancelScheduledValues(now);
        this.rightFilter.frequency.setTargetAtTime(rightFreq, now, 0.015);
        this.rightFilter.Q.cancelScheduledValues(now);
        this.rightFilter.Q.setTargetAtTime(Math.max(0.4, Math.min(4.5, 1.0 + rightColor * 0.3)), now, 0.02);
    }

    private applyGains() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.leftGain) {
            this.leftGain.gain.cancelScheduledValues(now);
            this.leftGain.gain.linearRampToValueAtTime(this.leftEnv, now + this.rampSeconds);
        }
        if (this.rightGain) {
            this.rightGain.gain.cancelScheduledValues(now);
            this.rightGain.gain.linearRampToValueAtTime(this.rightEnv, now + this.rampSeconds);
        }
        if (this.bulkGain) {
            this.bulkGain.gain.cancelScheduledValues(now);
            this.bulkGain.gain.linearRampToValueAtTime(this.bulkEnv, now + this.rampSeconds * 1.2);
        }
    }

    private buildGraph() {
        if (!this.ctx) return;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.baseOutputGain;
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.value = -32;
        this.masterCompressor.ratio.value = 2.5;
        this.masterCompressor.attack.value = 0.015;
        this.masterCompressor.release.value = 0.4;
        this.masterGain.connect(this.masterCompressor);
        this.masterCompressor.connect(this.ctx.destination);

        const merger = this.ctx.createChannelMerger(2);
        merger.connect(this.masterGain);

        this.leftGain = this.ctx.createGain();
        this.rightGain = this.ctx.createGain();
        this.leftGain.gain.value = 0;
        this.rightGain.gain.value = 0;
        this.leftGain.connect(merger, 0, 0);
        this.rightGain.connect(merger, 0, 1);

        this.leftSource = this.ctx.createBufferSource();
        this.leftSource.buffer = this.createNoiseBuffer("pink", 10);
        this.leftSource.loop = true;
        this.leftFilter = this.ctx.createBiquadFilter();
        this.leftFilter.type = "bandpass";
        this.leftFilter.frequency.value = this.baseLeftFreq;
        this.leftFilter.Q.value = 1.1;
        this.leftSource.connect(this.leftFilter);
        this.leftFilter.connect(this.leftGain);
        this.leftSource.start();

        this.rightSource = this.ctx.createBufferSource();
        this.rightSource.buffer = this.createNoiseBuffer("white", 9);
        this.rightSource.loop = true;
        this.rightFilter = this.ctx.createBiquadFilter();
        this.rightFilter.type = "bandpass";
        this.rightFilter.frequency.value = this.baseRightFreq;
        this.rightFilter.Q.value = 1.0;
        this.rightSource.connect(this.rightFilter);
        this.rightFilter.connect(this.rightGain);
        this.rightSource.start();

        this.bulkGain = this.ctx.createGain();
        this.bulkGain.gain.value = 0;
        this.bulkFilter = this.ctx.createBiquadFilter();
        this.bulkFilter.type = "bandpass";
        this.bulkFilter.frequency.value = 180;
        this.bulkFilter.Q.value = 0.55;
        this.bulkSource = this.ctx.createBufferSource();
        this.bulkSource.buffer = this.createNoiseBuffer("brown", 12);
        this.bulkSource.loop = true;
        this.bulkSource.connect(this.bulkFilter);
        this.bulkFilter.connect(this.bulkGain);
        this.bulkGain.connect(this.masterGain);
        this.bulkSource.start();

        this.setupShimmerLayer();
    }

    setMuted(muted: boolean) {
        if (this.isMuted === muted) return;
        this.isMuted = muted;
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        const target = muted ? 0 : this.baseOutputGain;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.linearRampToValueAtTime(target, now + 0.08);
    }

    private setupShimmerLayer() {
        if (!this.ctx || !this.leftGain || !this.rightGain) return;
        this.shimmerSource = this.ctx.createBufferSource();
        this.shimmerSource.buffer = this.createNoiseBuffer("white", 6);
        this.shimmerSource.loop = true;
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 3500;
        hp.Q.value = 0.9;
        const peaker = this.ctx.createBiquadFilter();
        peaker.type = "peaking";
        peaker.frequency.value = 6500;
        peaker.Q.value = 3.0;
        peaker.gain.value = 4;
        const shimmerGain = this.ctx.createGain();
        shimmerGain.gain.value = 0.03;
        const shimmerBias = this.ctx.createConstantSource();
        shimmerBias.offset.value = shimmerGain.gain.value;
        shimmerBias.connect(shimmerGain.gain);
        shimmerBias.start();
        const lfo = this.ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.17;
        const lfoDepth = this.ctx.createGain();
        lfoDepth.gain.value = 0.015;
        lfo.connect(lfoDepth);
        lfoDepth.connect(shimmerGain.gain);
        lfo.start();
        this.shimmerSource.connect(hp);
        hp.connect(peaker);
        peaker.connect(shimmerGain);
        shimmerGain.connect(this.leftGain);
        shimmerGain.connect(this.rightGain);
        this.shimmerSource.start();
    }

    private attachUnlockHandlers() {
        if (!this.ctx || typeof window === "undefined") return;
        if (this.ctx.state === "running") return;
        const events: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];
        const unlock = () => {
            if (!this.ctx) return;
            this.ctx.resume();
            if (this.ctx.state === "running") {
                events.forEach(evt => window.removeEventListener(evt, unlock));
            }
        };
        events.forEach(evt => window.addEventListener(evt, unlock));
    }

    private createNoiseBuffer(color: NoiseColor = "white", seconds = 6): AudioBuffer {
        if (!this.ctx) throw new Error("Audio context required");
        const duration = Math.max(1, seconds);
        const frameCount = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, frameCount, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let pink_b0 = 0, pink_b1 = 0, pink_b2 = 0;
        let brownLast = 0;
        for (let i = 0; i < frameCount; i++) {
            const white = Math.random() * 2 - 1;
            let sample = white * 0.35;
            if (color === "pink") {
                pink_b0 = 0.99765 * pink_b0 + white * 0.0990460;
                pink_b1 = 0.96300 * pink_b1 + white * 0.2965164;
                pink_b2 = 0.57000 * pink_b2 + white * 1.0526913;
                sample = (pink_b0 + pink_b1 + pink_b2 + white * 0.1848) * 0.07;
            } else if (color === "brown") {
                const brown = (brownLast + 0.02 * white) / 1.02;
                brownLast = brown;
                sample = brown * 0.18;
            }
            data[i] = sample;
        }
        return buffer;
    }
}
