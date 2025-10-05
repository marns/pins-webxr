import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Color3, InstancedMesh } from "@babylonjs/core";
import {
    LookingGlassWebXRPolyfill,
    LookingGlassConfig
  } from "@lookingglass/webxr";
  

class App {

    async init(scene: Scene) {
        // Configure Looking Glass settings BEFORE creating the polyfill
        // Use object assignment to ensure proper initialization
        Object.assign(LookingGlassConfig, {
            targetX: 0,        // X position of the target point (center of pin grid)
            targetY: -0.5,     // Y position of the target point (middle of pin heights)
            targetZ: 0,        // Z position of the target point (center of pin grid)
            targetDiam: 6,     // Diameter of the viewing volume (encompasses 5x5 grid)
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
        var camera: ArcRotateCamera = new ArcRotateCamera("Camera", 0, 0, 8, Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        // Set camera limits to ensure it stays in a good position
        camera.lowerRadiusLimit = 2;
        camera.upperRadiusLimit = 8;
        
        // Add better lighting
        var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
        light1.intensity = 0.7;
        
        // Create a sphere at the origin (where Looking Glass will focus)
        //var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);
        const pin = MeshBuilder.CreateCylinder("cylinder", { height: 1, diameter: .1 }, scene);
        pin.position = Vector3.Zero();
        
        // Silver pin material
        var sphereMaterial = new StandardMaterial("pinMat", scene);
        sphereMaterial.diffuseColor = new Color3(.8,.8,.8);
        sphereMaterial.specularColor = new Color3(1,1,1);
        pin.material = sphereMaterial;

        var pins: InstancedMesh[] = [];
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                var pinInstance = pin.createInstance(`pin_${x}_${y}`);
                pinInstance.position.x = x * 0.1 - 2.5;
                pinInstance.position.z = y * 0.1 - 2.5;
                pins.push(pinInstance);
            }
        }
        
        // Track mouse position in 3D space
        var mousePosition = new Vector3(0, 0, 0);
        var pickGround = MeshBuilder.CreateGround("pickGround", { width: 10, height: 10 }, scene);
        pickGround.position.y = -0.75;
        pickGround.isVisible = false; // Invisible ground for mouse picking
        
        scene.onPointerMove = () => {
            const pickResult = scene.pick(scene.pointerX, scene.pointerY, (mesh) => mesh === pickGround);
            if (pickResult && pickResult.hit && pickResult.pickedPoint) {
                mousePosition.copyFrom(pickResult.pickedPoint);
            }
        };
        
        // Add a ground plane for reference
        var ground = MeshBuilder.CreateGround("ground", { width: 4, height: 4 }, scene);
        ground.position.y = -0.75;
        var groundMaterial = new StandardMaterial("groundMat", scene);
        groundMaterial.diffuseColor = new Color3(0.2, 0.5, 0.3); // Green color
        ground.material = groundMaterial;
        
        // Add some smaller spheres at different depths for 3D effect
        // var smallSphere1 = MeshBuilder.CreateSphere("smallSphere1", { diameter: 0.3 }, scene);
        // smallSphere1.position = new Vector3(-0.8, 0.3, 0.5);
        // var mat1 = new StandardMaterial("mat1", scene);
        // mat1.diffuseColor = new Color3(0.3, 0.3, 1); // Blue
        // smallSphere1.material = mat1;
        
        // var smallSphere2 = MeshBuilder.CreateSphere("smallSphere2", { diameter: 0.3 }, scene);
        // smallSphere2.position = new Vector3(0.8, -0.3, -0.5);
        // var mat2 = new StandardMaterial("mat2", scene);
        // mat2.diffuseColor = new Color3(1, 1, 0.3); // Yellow
        // smallSphere2.material = mat2;

        // START RENDER LOOP BEFORE XR INITIALIZATION
        // This is critical - the scene must be rendering before entering XR
        engine.runRenderLoop(() => {
            // Update pin heights with reduced noise + crater effect
            pins.forEach(pinInstance => {
                // Reduced background noise (0 to 0.1 instead of 0 to 1)
                const randomNoise = 0;// Math.random() * 0.05;
                
                // Calculate distance from pin to mouse position (in XZ plane)
                const dx = pinInstance.position.x - mousePosition.x;
                const dz = pinInstance.position.z - mousePosition.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                // Crater effect: pins closer to mouse are pushed down
                // Using a falloff function: influence decreases with distance
                const craterRadius = 0.8; // Radius of effect
                const craterDepth = 0.6;  // Max depth of crater
                let craterEffect = 0;
                
                if (distance < craterRadius) {
                    // Smooth falloff using cosine curve
                    const normalizedDist = distance / craterRadius;
                    craterEffect = (Math.cos(normalizedDist * Math.PI) + 1) * 0.5 * craterDepth;
                }
                
                // Combine effects: base height + noise - crater
                const baseHeight = 0.25; // Base height for pins
                pinInstance.position.y = -0.75 + baseHeight + randomNoise - craterEffect;
            });
            
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