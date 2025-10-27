import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Color3, InstancedMesh, PBRMaterial, DirectionalLight, CubeTexture, PointLight, Texture } from "@babylonjs/core";
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
            targetDiam: 4,    // Diameter of the viewing volume (encompasses 10x5.6 grid)
            fovy: (40 * Math.PI) / 180,  // Field of view - 40 degrees
            depthiness: 0.6,
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
        const BROADCASTER_ID = "e9d1e011-3af0-4df9-8edd-a408db46ccf7";
        
        // Connect to broadcaster after a short delay to allow peer initialization
        setTimeout(() => {
            viewer.connectToBroadcaster(
                BROADCASTER_ID,
                videoElement,
                () => {
                    console.log("Connected to broadcaster, receiving video stream");
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
        
        // Create bright skybox environment for reflections on metallic pins
        const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        const skyboxMaterial = new StandardMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.disableLighting = true;
        
        // Create a bright gradient from light blue/white at top to light gray at bottom
        skyboxMaterial.emissiveColor = new Color3(0.9, 0.9, 0.95);
        skybox.material = skyboxMaterial;
        skybox.infiniteDistance = true;
        
        // Create environment texture for reflections
        const hdrTexture = CubeTexture.CreateFromPrefilteredData("environmentSpecular.env", scene);
        scene.environmentTexture = hdrTexture;
        scene.environmentIntensity = .5;
        
        scene.clearColor = new Color3(0.8, 0.8, 0.85).toColor4();
        
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
        
        // Bright silver/chrome base color
        sphereMaterial.albedoColor = new Color3(0.9, 0.9, 0.92);
        
        // High reflectance for chrome-like appearance
        sphereMaterial.metallicReflectanceColor = new Color3(1.0, 1.0, 1.0);
        sphereMaterial.metallicF0Factor = 0.85;
        
        // Enhanced environment reflections - key for bright sides!
        sphereMaterial.environmentIntensity = 2.0;
        sphereMaterial.reflectionTexture = scene.environmentTexture;
        
        // Moderate lighting response to show form
        //sphereMaterial.directIntensity = 1;
        //sphereMaterial.specularIntensity = 1.8;
        
        // NO emissive - we want reflective metal, not glowing material
        sphereMaterial.emissiveColor = new Color3(0, 0, 0);
        
        // Good ambient response for visibility
        sphereMaterial.ambientColor = new Color3(0.8, 0.8, 0.8);
        
        // Physical rendering
        sphereMaterial.usePhysicalLightFalloff = true;
        
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
        groundMaterial.diffuseColor = new Color3(0.15, 0.15, 0.18); // Dark neutral base
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1); // Minimal reflection
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