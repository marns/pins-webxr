import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import {
    LookingGlassWebXRPolyfill,
    LookingGlassConfig
  } from "@lookingglass/webxr";
  

class App {

    async init(scene: Scene) {
        // Configure Looking Glass settings BEFORE creating the polyfill
        // Use object assignment to ensure proper initialization
        Object.assign(LookingGlassConfig, {
            targetY: 0,        // Y position of the target point (center of scene)
            targetZ: 0,        // Z position of the target point
            targetDiam: 2.5,   // Diameter of the viewing volume (slightly larger than sphere)
            fovy: (40 * Math.PI) / 180,  // Field of view - 40 degrees (was 14, too narrow!)
            trackballX: 0,
            trackballY: 0,
            trackballZ: 0
        });
        
        // Initialize Looking Glass WebXR Polyfill
        new LookingGlassWebXRPolyfill();
        
        // Log the Looking Glass configuration
        console.log("Looking Glass Config:", {
            targetY: LookingGlassConfig.targetY,
            targetZ: LookingGlassConfig.targetZ,
            targetDiam: LookingGlassConfig.targetDiam,
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

        // Setup camera looking at the sphere from a good distance
        var camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        // Set camera limits to ensure it stays in a good position
        camera.lowerRadiusLimit = 1.5;
        camera.upperRadiusLimit = 5;
        
        // Add better lighting
        var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
        light1.intensity = 0.7;
        
        // Create a sphere at the origin (where Looking Glass will focus)
        var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);
        sphere.position = Vector3.Zero();
        
        // Add a colorful material to make the sphere easier to see
        var sphereMaterial = new StandardMaterial("sphereMat", scene);
        sphereMaterial.diffuseColor = new Color3(1, 0.2, 0.2); // Red color
        sphereMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
        sphere.material = sphereMaterial;
        
        // Add a ground plane for reference
        var ground = MeshBuilder.CreateGround("ground", { width: 4, height: 4 }, scene);
        ground.position.y = -0.75;
        var groundMaterial = new StandardMaterial("groundMat", scene);
        groundMaterial.diffuseColor = new Color3(0.2, 0.5, 0.3); // Green color
        ground.material = groundMaterial;
        
        // Add some smaller spheres at different depths for 3D effect
        var smallSphere1 = MeshBuilder.CreateSphere("smallSphere1", { diameter: 0.3 }, scene);
        smallSphere1.position = new Vector3(-0.8, 0.3, 0.5);
        var mat1 = new StandardMaterial("mat1", scene);
        mat1.diffuseColor = new Color3(0.3, 0.3, 1); // Blue
        smallSphere1.material = mat1;
        
        var smallSphere2 = MeshBuilder.CreateSphere("smallSphere2", { diameter: 0.3 }, scene);
        smallSphere2.position = new Vector3(0.8, -0.3, -0.5);
        var mat2 = new StandardMaterial("mat2", scene);
        mat2.diffuseColor = new Color3(1, 1, 0.3); // Yellow
        smallSphere2.material = mat2;

        // START RENDER LOOP BEFORE XR INITIALIZATION
        // This is critical - the scene must be rendering before entering XR
        engine.runRenderLoop(() => {
            // Rotate spheres for visual confirmation that rendering is working
            sphere.rotation.y += 0.01;
            sphere.rotation.x += 0.005;
            smallSphere1.rotation.y -= 0.02;
            smallSphere2.rotation.x += 0.015;
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