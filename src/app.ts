import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Color3, InstancedMesh, PBRMaterial, DirectionalLight } from "@babylonjs/core";
import {
    LookingGlassWebXRPolyfill,
    LookingGlassConfig
  } from "@lookingglass/webxr";
import { Viewer } from "./viewer";
  

class App {

    async init(scene: Scene) {
        // Configure Looking Glass settings BEFORE creating the polyfill
        // Use object assignment to ensure proper initialization
        Object.assign(LookingGlassConfig, {
            targetX: 0,        // X position of the target point (center of pin grid)
            targetY: -0.5,     // Y position of the target point (middle of pin heights)
            targetZ: 0,        // Z position of the target point (center of pin grid)
            targetDiam: 8,    // Diameter of the viewing volume (encompasses 10x5.6 grid)
            fovy: (40 * Math.PI) / 180,  // Field of view - 40 degrees
            trackballX: 0,
            trackballY: Math.PI / 2,  // Rotate to look down from above
            trackballZ: 0
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
        const gridWidth = 36;
        const gridDepth = Math.round(gridWidth * 1.7777777777777777);  // 64 pixels, maintains 16:9 ratio

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
        
        // Initialize WebRTC viewer
        const viewer = new Viewer();
        viewer.initialize((error) => {
            console.error("Viewer error:", error);
        });

        // Hardcoded broadcaster ID (you can change this)
        const BROADCASTER_ID = "8c0bda9f-a950-4773-a113-fc8d4171f49e";
        
        // Connect to broadcaster after a short delay to allow peer initialization
        setTimeout(() => {
            viewer.connectToBroadcaster(
                BROADCASTER_ID,
                videoElement,
                () => {
                    console.log("Connected to broadcaster, receiving video stream");
                    videoElement.play();
                },
                (error) => {
                    console.error("Connection error:", error);
                }
            );
        }, 1000);

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
        
        // Add better lighting
        // var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(0, -1, 0), scene);
        // light1.intensity = 0.7;

        var light2: DirectionalLight = new DirectionalLight("light2", new Vector3(0.5, -.5, 0.5), scene);
        light2.intensity = 0.7;
        light2.shadowEnabled = false;
        
        // Create a sphere at the origin (where Looking Glass will focus)
        //var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);
        const pin = MeshBuilder.CreateCylinder("cylinder", { height: 1, diameter: .1 });
        pin.position = Vector3.Zero();
        
        // Silver pin material
        var sphereMaterial = new PBRMaterial("pinMat", scene);
        sphereMaterial.roughness = .5;
        sphereMaterial.metallic = 1;
        sphereMaterial.albedoColor = new Color3(.8,.8,.8);
        sphereMaterial.metallicReflectanceColor = new Color3(1,1,1);
        pin.material = sphereMaterial;

        var pins: InstancedMesh[] = [];
        const pinSpacing = 0.1;
        const totalWidth = gridWidth * pinSpacing;
        const totalDepth = gridDepth * pinSpacing;
        
        for (let z = 0; z < gridDepth; z++) {
            for (let x = 0; x < gridWidth; x++) {
                var pinInstance = pin.createInstance(`pin_${x}_${z}`);
                pinInstance.position.x = x * pinSpacing - totalWidth / 2;
                pinInstance.position.z = z * pinSpacing - totalDepth / 2;
                pins.push(pinInstance);
            }
        }
        pin.setEnabled(false);
        
        // Add a ground plane for reference
        var ground = MeshBuilder.CreateGround("ground", { width: totalWidth, height: totalDepth }, scene);
        var groundMaterial = new StandardMaterial("groundMat", scene);
        groundMaterial.diffuseColor = new Color3(0.2, 0.5, 0.3); // Green color
        ground.material = groundMaterial;
        
        // START RENDER LOOP BEFORE XR INITIALIZATION
        // This is critical - the scene must be rendering before entering XR
        engine.runRenderLoop(() => {
            // Process video frame and update pin heights
            if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA && videoCtx) {
                // Draw video frame to canvas (downsampled to rotated resolution)
                // Canvas is 36w x 64h, which rotates the landscape video
                videoCtx.drawImage(videoElement, 0, 0, gridDepth, gridWidth);
                
                // Get pixel data
                const imageData = videoCtx.getImageData(0, 0, gridDepth, gridWidth);
                const pixels = imageData.data;
                
                // Update each pin height based on corresponding pixel intensity
                pins.forEach((pinInstance, index) => {
                    // Calculate grid position in 3D space
                    const x = index % gridWidth;  // 0-63 (X axis, left-right)
                    const z = Math.floor(index / gridWidth);  // 0-35 (Z axis, front-back)
                    
                    // Swap X and Z to rotate 90 degrees: video X -> pin Z, video Y -> pin X
                    const videoX = z;  // Use pin's Z as video's X (0-35)
                    const videoY = x;  // Use pin's X as video's Y (0-63)
                    const pixelIndex = (videoY * gridDepth + videoX) * 4;
                    
                    // Calculate grayscale intensity (0-255)
                    const r = pixels[pixelIndex];
                    const g = pixels[pixelIndex + 1];
                    const b = pixels[pixelIndex + 2];
                    const intensity = (r + g + b) / 3;
                    
                    // Map intensity (0-255) to pin height (0-1)
                    // Darker pixels = lower pins, brighter pixels = higher pins
                    const normalizedIntensity = intensity / 255;
                    
                    // Set pin Y position
                    pinInstance.position.y = normalizedIntensity - 0.5;
                });
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