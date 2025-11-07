import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Engine, Scene, ArcRotateCamera, Vector3, MeshBuilder, StandardMaterial, Color3, Color4, InstancedMesh, PBRMaterial, DirectionalLight, CubeTexture, PointLight } from "@babylonjs/core";
import {
    LookingGlassWebXRPolyfill,
    LookingGlassConfig
  } from "@lookingglass/webxr";
import { Viewer } from "./viewer";
import { enableHalloweenMood } from "./effects";
import { getVideoCropConfig } from "./videoConfig";
import { AppConfig } from "./config";

// One-time Vite env snapshot to debug env injection
try {
    const envAny: any = (import.meta as any).env || {};
    if (typeof window !== 'undefined' && !(window as any).__loggedViteEnv) {
        console.log("Vite env snapshot:", {
            mode: envAny.MODE,
            base: envAny.BASE_URL,
            keys: Object.keys(envAny || {}),
            VITE_CROP_WIDTH_PCT: envAny?.VITE_CROP_WIDTH_PCT,
            VITE_CROP_HEIGHT_PCT: envAny?.VITE_CROP_HEIGHT_PCT,
            VITE_CROP_CENTER_X_PCT: envAny?.VITE_CROP_CENTER_X_PCT,
            VITE_CROP_CENTER_Y_PCT: envAny?.VITE_CROP_CENTER_Y_PCT
        });
        (window as any).__loggedViteEnv = true;
    }
} catch {}
  

class App {

    async init(scene: Scene) {
        // Configure Looking Glass settings BEFORE creating the polyfill
        // Use object assignment to ensure proper initialization
        Object.assign(LookingGlassConfig, {
            targetX: AppConfig.lookingGlass.targetX,
            targetY: AppConfig.lookingGlass.targetY,
            targetZ: AppConfig.lookingGlass.targetZ,
            targetDiam: AppConfig.lookingGlass.targetDiam,
            fovy: AppConfig.lookingGlass.fovy,
            depthiness: AppConfig.lookingGlass.depthiness,
            trackballX: AppConfig.lookingGlass.trackballX,
            trackballY: AppConfig.lookingGlass.trackballY,  // Rotate to look down from above
            trackballZ: AppConfig.lookingGlass.trackballZ
        });
        
        // Initialize Looking Glass WebXR Polyfill
        new LookingGlassWebXRPolyfill();
        
        // Log the Looking Glass configuration
        console.log("Looking Glass Config:", {
            targetX: LookingGlassConfig.targetX,
            targetY: LookingGlassConfig.targetY,
            targetZ: LookingGlassConfig.targetZ,
            targetDiam: LookingGlassConfig.targetDiam,
            trackballY: (LookingGlassConfig.trackballY * 180 / Math.PI).toFixed(1) + " degrees",
            fovy: (LookingGlassConfig.fovy * 180 / Math.PI).toFixed(1) + " degrees"
        });

        // Create XR experience with proper configuration for Looking Glass
        const xr = await scene.createDefaultXRExperienceAsync({
            // Don't use floor mesh for Looking Glass
            floorMeshes: [],
            // Disable features not supported by Looking Glass
            disableTeleportation: true,
            // Explicitly set which features to use (avoid hand-tracking)
            uiOptions: {
                sessionMode: 'immersive-vr'
            },
            // Don't load controller meshes
            inputOptions: {
                doNotLoadControllerMeshes: true
            }
        });

        // Log when XR session starts/ends for debugging
        if (xr.baseExperience) {
            xr.baseExperience.onStateChangedObservable.add((state) => {
                console.log("XR State changed:", state);
                
                // Log additional info when entering XR
                if (state === 2) { // IN_XR state
                    console.log("Entered XR session");
                    console.log("XR Camera:", xr.baseExperience.camera?.position);
                    console.log("Scene active cameras:", scene.activeCameras?.length || 0);
                    console.log("Scene meshes:", scene.meshes.length);
                }
            });
            
            // Log session initialization
            xr.baseExperience.sessionManager.onXRSessionInit.add((session) => {
                console.log("XR Session initialized:", session);
                console.log("Session renderState:", session.renderState);
            });
            
            // Log any session errors
            xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
                console.log("XR Session ended");
            });
        }
    }

    constructor() {
        // Define grid dimensions (used for both pin grid and video downsampling)
        // Swapped to create landscape orientation when viewed from above
        // gridWidth (X axis) = 36, gridDepth (Z axis) = 64 for proper landscape display
        const gridWidth = AppConfig.grid.width;
        const gridDepth = AppConfig.grid.depth;  // maintains configured aspect ratio

        // Create video element for WebRTC stream
        const videoElement = document.createElement("video");
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.style.display = "none"; // Hidden, only used for processing
        document.body.appendChild(videoElement);

        // Create canvas for downsampling video to pin grid resolution
        // Canvas dimensions swapped to rotate the video 90 degrees
        const videoCanvas = document.createElement("canvas");
        videoCanvas.width = gridDepth;   // 36 (will map to Z axis)
        videoCanvas.height = gridWidth;  // 64 (will map to X axis)
        const videoCtx = videoCanvas.getContext("2d", { willReadFrequently: true });
        
        // Load crop configuration from env (center/size in percentages)
        const cropCfg = getVideoCropConfig();
        console.log("Video crop config:", cropCfg);
        let loggedCropRect = false;
        
        // Initialize WebRTC connection to minimal signaling server (POST /offer)
        const viewer = new Viewer();

        // Connect after short delay to ensure page is ready
        setTimeout(() => {
            viewer.connect(
                videoElement,
                () => {
                    console.log("Connected to WebRTC server, receiving video stream");
                },
                (error) => {
                    console.error("Connection error:", error);
                }
            );
        }, 500);

        // create the canvas html element and attach it to the webpage
        var canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.id = "gameCanvas";
        document.body.appendChild(canvas);

        // initialize babylon scene and engine
        var engine = new Engine(canvas, true);
        var scene = new Scene(engine);

        // Setup camera looking down at the pin grid from above
        var camera: ArcRotateCamera = new ArcRotateCamera("Camera", 0, 0, 5, Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        // Set camera limits to ensure it stays in a good position
        camera.lowerRadiusLimit = 4;
        camera.upperRadiusLimit = 15;
        
        // Create bright skybox environment for reflections on metallic pins
        const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        const skyboxMaterial = new StandardMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.disableLighting = true;
        
        // Dim, slightly red-tinted sky to let red lighting dominate
        skyboxMaterial.emissiveColor = new Color3(0.12, 0.03, 0.03);
        skybox.material = skyboxMaterial;
        skybox.infiniteDistance = true;
        
        // Create environment texture for reflections
        const hdrTexture = CubeTexture.CreateFromPrefilteredData("environmentSpecular.env", scene);
        scene.environmentTexture = hdrTexture;
        scene.environmentIntensity = 0.15;
        
        scene.clearColor = new Color3(0.05, 0.0, 0.0).toColor4();
        // Keep fog off for performance
        
        // Moderate ambient lighting
        // const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), scene);
        // ambientLight.intensity = 0;
        // ambientLight.diffuse = new Color3(1, 1, 1);
        // ambientLight.specular = new Color3(0.8, 0.8, 0.8);
        // ambientLight.groundColor = new Color3(0.7, 0.7, 0.75);
        
        // Main directional light from slight angle for better cylinder definition
        const mainLight = new DirectionalLight("mainLight", new Vector3(0.2, -1, 0.15), scene);
        mainLight.intensity = 0.0;
        mainLight.diffuse = new Color3(1, 1, 1);
        mainLight.specular = new Color3(1.2, 1.2, 1.2);
        
        // Key light from front-left - creates main highlights
        const keyLight = new PointLight("keyLight", new Vector3(-3, 3, 3), scene);
        keyLight.intensity = 0;
        keyLight.diffuse = new Color3(1, 1, 1);
        keyLight.specular = new Color3(1.5, 1.5, 1.5);
        
        // Fill light from front-right for balance
        const fillLight = new PointLight("fillLight", new Vector3(3, 3, 3), scene);
        fillLight.intensity = 0;
        fillLight.diffuse = new Color3(1, 1, 1);
        fillLight.specular = new Color3(1.5, 1.5, 1.5);
        
        // Back light from behind for rim lighting
        const backLight = new PointLight("backLight", new Vector3(0, 2, -5), scene);
        backLight.intensity = 0;
        backLight.diffuse = new Color3(1, 1, 1);
        backLight.specular = new Color3(1.5, 1.5, 1.5);
        
        // Side lights at cylinder mid-height to create highlights on curved surfaces
        const leftLight = new PointLight("leftLight", new Vector3(-5, 1, 0), scene);
        leftLight.intensity = 0;
        leftLight.diffuse = new Color3(1, 1, 1);
        leftLight.specular = new Color3(1.8, 1.8, 1.8);
        
        const rightLight = new PointLight("rightLight", new Vector3(5, 1, 0), scene);
        rightLight.intensity = 0;
        rightLight.diffuse = new Color3(1, 1, 1);
        rightLight.specular = new Color3(1.8, 1.8, 1.8);
        
        // Low grazing lights to create vertical highlight streaks on cylinder sides
        const grazingLight1 = new PointLight("grazingLight1", new Vector3(0, 0, 6), scene);
        grazingLight1.intensity = 0;
        grazingLight1.diffuse = new Color3(0.9, 0.9, 0.9);
        grazingLight1.specular = new Color3(2.0, 2.0, 2.0);
        
        const grazingLight2 = new PointLight("grazingLight2", new Vector3(0, 0, -6), scene);
        grazingLight2.intensity = 0;
        grazingLight2.diffuse = new Color3(0.9, 0.9, 0.9);
        grazingLight2.specular = new Color3(2.0, 2.0, 2.0);

        // Halloween mood is now toggleable via UI; default enabled below
        
        // Create a sphere at the origin (where Looking Glass will focus)
        //var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);
        const pin = MeshBuilder.CreateCylinder("cylinder", { height: 1, diameter: .1 });
        pin.position = Vector3.Zero();
        
        // Shiny chrome/silver pin material - like real pin art toys
        var sphereMaterial = new PBRMaterial("pinMat", scene);
        
        // Low roughness for shiny metal with visible highlights
        sphereMaterial.roughness = 0.2;
        
        // Full metallic for true metal appearance
        sphereMaterial.metallic = 1.0;
        
        // Slightly red metal to push overall redness without heavy lighting
        sphereMaterial.albedoColor = new Color3(0.9, 0.28, 0.28);
        
        // High reflectance for chrome-like appearance
        sphereMaterial.metallicReflectanceColor = new Color3(1.0, 1.0, 1.0);
        sphereMaterial.metallicF0Factor = 0.85;
        
        // Enhanced environment reflections - key for bright sides!
        sphereMaterial.environmentIntensity = 2.0;
        sphereMaterial.reflectionTexture = scene.environmentTexture;
        
        // Moderate lighting response to show form
        //sphereMaterial.directIntensity = 1;
        //sphereMaterial.specularIntensity = 1.8;
        
        // A touch of emissive red helps keep the scene red with fewer lights
        sphereMaterial.emissiveColor = new Color3(0.06, 0.01, 0.01);
        
        // Good ambient response for visibility
        sphereMaterial.ambientColor = new Color3(0.8, 0.8, 0.8);
        
        // Physical rendering
        sphereMaterial.usePhysicalLightFalloff = true;
        
        pin.material = sphereMaterial;

        var pins: InstancedMesh[] = [];
        const pinSpacing = AppConfig.grid.pinSpacing;
        const pinLift = AppConfig.grid.pinLift; // small tip offset above plane
        let pinScale = AppConfig.grid.pinHeightScale; // live-adjustable via UI
        let pinLerp = AppConfig.grid.pinLerp; // 0..1 smoothing per frame
        let pinMaxStep = AppConfig.grid.pinMaxStep; // absolute max length change per frame
        const minPinLen = 1e-3; // avoid zero-length scaling artifacts
        const totalWidth = gridWidth * pinSpacing;
        const totalDepth = gridDepth * pinSpacing;
        
        for (let z = 0; z < gridDepth; z++) {
            for (let x = 0; x < gridWidth; x++) {
                var pinInstance = pin.createInstance(`pin_${x}_${z}`);
                pinInstance.position.x = x * pinSpacing - totalWidth / 2;
                pinInstance.position.z = z * pinSpacing - totalDepth / 2;
                // Initialize as a tiny pin whose base sits just above the plane
                pinInstance.scaling.y = minPinLen;
                pinInstance.position.y = pinLift + 0.5 * minPinLen;
                pins.push(pinInstance);
            }
        }
        pin.setEnabled(false);
        
        // Add a ground plane for reference
        var ground = MeshBuilder.CreateGround("ground", { width: totalWidth, height: totalDepth }, scene);
        var groundMaterial = new StandardMaterial("groundMat", scene);
        groundMaterial.diffuseColor = new Color3(0.15, 0.15, 0.18); // Dark neutral base
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1); // Minimal reflection
        ground.material = groundMaterial;
        
        // === Visualization controls (tweakable without reload) ===
        const vizParams = {
            enabled: AppConfig.viz.enabled,        // Master enable for enhancement pipeline
            rawMode: AppConfig.viz.rawMode,        // Bypass all processing and use raw intensity
            useInverse: AppConfig.viz.useInverse,  // Use inverse (disparity) domain
            robustK: AppConfig.viz.robustK,        // Scale of robust normalization window
            gamma: AppConfig.viz.gamma,            // S-curve strength
            detailAlpha: AppConfig.viz.detailAlpha,// Detail boost amount
            sigmaS: AppConfig.viz.sigmaS,          // Bilateral spatial sigma (pixels)
            sigmaR: AppConfig.viz.sigmaR,          // Bilateral range sigma (value units)
            temporalLerp: AppConfig.viz.temporalLerp // Smoothing for center/scale over time
        };

        // Simple on-screen UI to crank knobs
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '10px';
        panel.style.left = '10px';
        panel.style.padding = '10px';
        panel.style.background = 'rgba(0,0,0,0.55)';
        panel.style.color = '#fff';
        panel.style.font = '12px system-ui, sans-serif';
        panel.style.borderRadius = '6px';
        panel.style.zIndex = '9999';
        panel.style.backdropFilter = 'blur(4px)';
        panel.style.maxWidth = '240px';
        panel.style.userSelect = 'none';
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                <strong>Depth Enhance</strong>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input id="rawMode" type="checkbox"> Raw
                </label>
            </div>
            <label style="display:flex;justify-content:space-between;gap:8px;margin:4px 0;">
                <span>Enable</span>
                <input id="enabled" type="checkbox" checked>
            </label>
            <label style="display:flex;justify-content:space-between;gap:8px;margin:4px 0;">
                <span>Inverse</span>
                <input id="useInverse" type="checkbox" checked>
            </label>
            <label style="display:block;margin:6px 0;">
                <div>robustK: <span id="robustKVal"></span></div>
                <input id="robustK" type="range" min="1" max="5" step="0.1" value="5">
            </label>
            <label style="display:block;margin:6px 0;">
                <div>gamma: <span id="gammaVal"></span></div>
                <input id="gamma" type="range" min="0.6" max="3" step="0.05" value="3.0">
            </label>
            <label style="display:block;margin:6px 0;">
                <div>detail: <span id="detailVal"></span></div>
                <input id="detailAlpha" type="range" min="0" max="1.5" step="0.05" value="0.6">
            </label>
            <label style="display:block;margin:6px 0;">
                <div>sigmaS: <span id="sigmaSVal"></span> px</div>
                <input id="sigmaS" type="range" min="0.0" max="3.0" step="0.1" value="1.0">
            </label>
            <label style="display:block;margin:6px 0;">
                <div>sigmaR: <span id="sigmaRVal"></span></div>
                <input id="sigmaR" type="range" min="0.01" max="0.5" step="0.01" value="0.08">
            </label>
            <label style="display:block;margin:6px 0;">
                <div>temporal: <span id="temporalVal"></span></div>
                <input id="temporalLerp" type="range" min="0.0" max="0.5" step="0.01" value="0.1">
            </label>
            <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.2);padding-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                    <strong>Effects</strong>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                        <input id="halloweenMood" type="checkbox" checked> Halloween
                    </label>
                </div>
            </div>
            <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.2);padding-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                    <strong>Pins</strong>
                </div>
                <label style="display:block;margin:6px 0;">
                    <div>height scale: <span id="pinHeightScaleVal"></span>x</div>
                    <input id="pinHeightScale" type="range" min="0.25" max="4" step="0.05">
                </label>
                <label style="display:block;margin:6px 0;">
                    <div>height smoothing: <span id="pinLerpVal"></span></div>
                    <input id="pinLerp" type="range" min="0" max="1" step="0.01">
                </label>
                <label style="display:block;margin:6px 0;">
                    <div>max height diff: <span id="pinMaxStepVal"></span></div>
                    <input id="pinMaxStep" type="range" min="0.005" max="0.2" step="0.005">
                </label>
            </div>
        `;
        document.body.appendChild(panel);
        const byId = (id: string) => panel.querySelector(`#${id}`) as HTMLInputElement;
        const bindCheckbox = (id: keyof typeof vizParams) => {
            const el = byId(id as string);
            el.checked = (vizParams as any)[id];
            el.oninput = () => ((vizParams as any)[id] = el.checked);
        };
        const bindRange = (id: keyof typeof vizParams, valId: string, fmt = (v:number)=>v.toFixed(2)) => {
            const el = byId(id as string);
            const valEl = panel.querySelector(`#${valId}`) as HTMLElement;
            const update = () => { (vizParams as any)[id] = parseFloat(el.value); valEl.textContent = fmt(parseFloat(el.value)); };
            update();
            el.oninput = update;
        };
        bindCheckbox('enabled');
        bindCheckbox('rawMode');
        bindCheckbox('useInverse');
        bindRange('robustK', 'robustKVal');
        bindRange('gamma', 'gammaVal');
        bindRange('detailAlpha', 'detailVal');
        bindRange('sigmaS', 'sigmaSVal');
        bindRange('sigmaR', 'sigmaRVal');
        bindRange('temporalLerp', 'temporalVal');

        // Pin height scale slider
        const pinScaleEl = byId('pinHeightScale');
        const pinScaleValEl = panel.querySelector('#pinHeightScaleVal') as HTMLElement;
        const updatePinScale = () => { pinScale = parseFloat(pinScaleEl.value) || 1; pinScaleValEl.textContent = pinScale.toFixed(2); };
        pinScaleEl.value = String(pinScale);
        updatePinScale();
        pinScaleEl.oninput = updatePinScale;

        // Pin smoothing slider
        const pinLerpEl = byId('pinLerp');
        const pinLerpValEl = panel.querySelector('#pinLerpVal') as HTMLElement;
        const updatePinLerp = () => { pinLerp = Math.max(0, Math.min(1, parseFloat(pinLerpEl.value) || 0)); pinLerpValEl.textContent = pinLerp.toFixed(2); };
        pinLerpEl.value = String(pinLerp);
        updatePinLerp();
        pinLerpEl.oninput = updatePinLerp;

        // Pin max height diff (per-frame clamp)
        const pinMaxStepEl = byId('pinMaxStep');
        const pinMaxStepValEl = panel.querySelector('#pinMaxStepVal') as HTMLElement;
        const updatePinMaxStep = () => { pinMaxStep = Math.max(0, parseFloat(pinMaxStepEl.value) || 0); pinMaxStepValEl.textContent = pinMaxStep.toFixed(3); };
        pinMaxStepEl.value = String(pinMaxStep);
        updatePinMaxStep();
        pinMaxStepEl.oninput = updatePinMaxStep;

        // --- Effect toggles ---
        let disposeHalloween: null | (() => void) = null;
        const setupHalloween = (enabled: boolean) => {
            if (enabled) {
                if (!disposeHalloween) disposeHalloween = enableHalloweenMood(scene, engine);
            } else {
                if (disposeHalloween) { disposeHalloween(); disposeHalloween = null; }
            }
        };
        const halloweenEl = byId('halloweenMood');
        halloweenEl.checked = AppConfig.effects.halloweenDefault;
        setupHalloween(halloweenEl.checked);
        halloweenEl.oninput = () => setupHalloween(halloweenEl.checked);

        // --- Helpers: robust stats ---
        function medianInPlace(arr: number[]): number {
            if (arr.length === 0) return 0;
            arr.sort((a,b)=>a-b);
            const mid = Math.floor(arr.length/2);
            return arr.length % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) * 0.5;
        }
        function computeMedianAndMad(values: number[]): { m: number; s: number } {
            if (values.length === 0) return { m: 0, s: 1 };
            const m = medianInPlace(values.slice());
            const devs = values.map(v => Math.abs(v - m));
            const mad = medianInPlace(devs);
            const s = mad > 1e-8 ? 1.4826 * mad : 1; // scale to ~= std if normal
            return { m, s };
        }

        // --- Helpers: tiny bilateral blur on a small grid ---
        const W = gridWidth;
        const H = gridDepth;
        const N = W * H;
        const dBuf = new Float32Array(N);
        const blurBuf = new Float32Array(N);
        const validMask = new Uint8Array(N);

        function bilateral3x3(src: Float32Array, dst: Float32Array, sigmaS: number, sigmaR: number) {
            const r = 1; // 3x3
            const twoSigmaS2 = 2 * sigmaS * sigmaS + 1e-6;
            const twoSigmaR2 = 2 * sigmaR * sigmaR + 1e-6;
            for (let y=0; y<H; y++) {
                for (let x=0; x<W; x++) {
                    const idx = y*W + x;
                    if (!validMask[idx]) { dst[idx] = 0; continue; }
                    const center = src[idx];
                    let sum = 0, wsum = 0;
                    for (let dy=-r; dy<=r; dy++) {
                        const yy = Math.min(H-1, Math.max(0, y+dy));
                        for (let dx=-r; dx<=r; dx++) {
                            const xx = Math.min(W-1, Math.max(0, x+dx));
                            const j = yy*W + xx;
                            if (!validMask[j]) continue;
                            const gs = Math.exp(-(dx*dx + dy*dy)/twoSigmaS2);
                            const gr = Math.exp(-((src[j]-center)*(src[j]-center))/twoSigmaR2);
                            const w = gs * gr;
                            sum += w * src[j];
                            wsum += w;
                        }
                    }
                    dst[idx] = wsum > 1e-6 ? sum / wsum : center;
                }
            }
        }

        // Temporal state for robust params
        let m_t = 0, s_t = 1;

        // START RENDER LOOP BEFORE XR INITIALIZATION
        // This is critical - the scene must be rendering before entering XR
        engine.runRenderLoop(() => {
            // Process video frame and update pin heights
            if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA && videoCtx) {
                // Draw cropped video frame to canvas before downsampling
                // Compute source crop rect in the input video space
                const vw = videoElement.videoWidth || 0;
                const vh = videoElement.videoHeight || 0;
                if (vw > 0 && vh > 0) {
                    const srcW = Math.max(1, Math.floor(vw * cropCfg.widthPct));
                    const srcH = Math.max(1, Math.floor(vh * cropCfg.heightPct));
                    const centerX = cropCfg.centerX * vw;
                    const centerY = cropCfg.centerY * vh;
                    let sx = Math.round(centerX - srcW / 2);
                    let sy = Math.round(centerY - srcH / 2);
                    // Clamp to valid bounds
                    sx = Math.max(0, Math.min(sx, vw - srcW));
                    sy = Math.max(0, Math.min(sy, vh - srcH));

                    if (!loggedCropRect) {
                        console.log("Computed crop rect:", { vw, vh, sx, sy, srcW, srcH, destW: gridDepth, destH: gridWidth });
                        loggedCropRect = true;
                    }

                    // Canvas is 36w x 64h, which rotates the landscape video
                    // Use 9-arg drawImage to crop pre-downsample
                    videoCtx.drawImage(
                        videoElement,
                        sx,
                        sy,
                        srcW,
                        srcH,
                        0,
                        0,
                        gridDepth,
                        gridWidth
                    );
                }
                
                // Get pixel data
                const imageData = videoCtx.getImageData(0, 0, gridDepth, gridWidth);
                const pixels = imageData.data;
                
                // Build working buffers: normalized intensity in [0,1]; zero treated as invalid
                const validValues: number[] = [];
                for (let idx=0; idx<N; idx++) {
                    const x = idx % gridWidth;
                    const z = Math.floor(idx / gridWidth);
                    const videoX = z;
                    const videoY = x;
                    const p = (videoY * gridDepth + videoX) * 4;
                    const r = pixels[p];
                    const g = pixels[p + 1];
                    const b = pixels[p + 2];
                    const intensity = (r + g + b) / 3;
                    const u = intensity / 255;
                    // Treat exact zero as invalid hole
                    const isValid = u > 0.0;
                    validMask[idx] = isValid ? 1 : 0;
                    // Domain transform
                    const base = vizParams.useInverse ? (1.0 / Math.max(u, 1e-6)) : u;
                    dBuf[idx] = base;
                    if (isValid) validValues.push(base);
                }

                // If enhancement disabled or raw requested, skip processing
                if (!(vizParams.enabled) || vizParams.rawMode) {
                    pins.forEach((pinInstance, index) => {
                        const x = index % gridWidth;
                        const z = Math.floor(index / gridWidth);
                        const videoX = z;
                        const videoY = x;
                        const pixelIndex = (videoY * gridDepth + videoX) * 4;
                        const r = pixels[pixelIndex];
                        const g = pixels[pixelIndex + 1];
                        const b = pixels[pixelIndex + 2];
                        const intensity = (r + g + b) / 3;
                        const u = intensity / 255;
                        const target = Math.max(minPinLen, Math.max(0, u) * pinScale);
                        const h0 = pinInstance.scaling.y;
                        const blended = h0 + (target - h0) * pinLerp;
                        const delta = Math.max(-pinMaxStep, Math.min(pinMaxStep, blended - h0));
                        const height = h0 + delta;
                        pinInstance.scaling.y = height;
                        // Anchor base near plane: baseY ~= pinLift
                        pinInstance.position.y = pinLift + 0.5 * height;
                    });
                } else {
                    // Robust center/scale on disparity domain
                    const { m, s } = computeMedianAndMad(validValues);
                    // Temporal smoothing
                    const a = Math.max(0, Math.min(1, vizParams.temporalLerp));
                    m_t = (1 - a) * m_t + a * m;
                    s_t = (1 - a) * s_t + a * s;
                    const k = vizParams.robustK;

                    // Optional detail boost via bilateral unsharp mask
                    if (vizParams.detailAlpha > 1e-3 && (vizParams.sigmaS > 1e-3 || vizParams.sigmaR > 1e-3)) {
                        bilateral3x3(dBuf, blurBuf, vizParams.sigmaS, vizParams.sigmaR);
                        for (let i=0;i<N;i++) {
                            if (!validMask[i]) continue;
                            const detail = dBuf[i] - blurBuf[i];
                            dBuf[i] = dBuf[i] + vizParams.detailAlpha * detail;
                        }
                    }

                    // Map through robust normalization and S-curve
                    for (let idx=0; idx<N; idx++) {
                        const valid = !!validMask[idx];
                        let yNorm = 0; // default background
                        if (valid) {
                            const xNorm = Math.max(-1, Math.min(1, (dBuf[idx] - m_t) / (Math.max(1e-6, k * s_t))));
                            const y = 0.5 + 0.5 * Math.tanh(vizParams.gamma * xNorm);
                            yNorm = y;
                        }
                        // Apply to pin length (anchored at plane)
                        const pinInstance = pins[idx];
                        const target = Math.max(minPinLen, Math.max(0, yNorm) * pinScale);
                        const h0 = pinInstance.scaling.y;
                        const blended = h0 + (target - h0) * pinLerp;
                        const delta = Math.max(-pinMaxStep, Math.min(pinMaxStep, blended - h0));
                        const height = h0 + delta;
                        pinInstance.scaling.y = height;
                        pinInstance.position.y = pinLift + 0.5 * height;
                    }
                }
            }
            
            scene.render();
        });

        // hide/show the Inspector
        window.addEventListener("keydown", (ev) => {
            // Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (scene.debugLayer.isVisible()) {
                    scene.debugLayer.hide();
                } else {
                    scene.debugLayer.show();
                }
            }
        });

        // Initialize XR after render loop is running
        this.init(scene);
    }
}
new App();
