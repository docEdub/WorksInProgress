import * as BABYLON from "babylonjs";

declare global {
    interface Document {
        csound: any
    }
}

class Playground { public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {

    let script = document.createElement('script');
    script.type = 'module'
    script.innerText =
        'import { Csound } from "https://unpkg.com/@doc.e.dub/csound-browser/dist/csound.esm.js";' +
        'document.csound = await Csound({ withWorker: true });'
    document.body.appendChild(script)

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'sphere' shape.
    var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 2, segments: 32}, scene);

    // Move the sphere upward 1/2 its height
    sphere.position.y = 1;

    scene.createDefaultEnvironment();

    // XR
    const xrHelper = scene.createDefaultXRExperienceAsync({});

    let csoundLoadedLogged = false
    let csoundNotLoadedYetLogged = false

    engine.runRenderLoop(() => {
        if (!document.csound) {
            if (!csoundNotLoadedYetLogged) {
                console.log('csound.esm.js loading ...')
                csoundNotLoadedYetLogged = true
            }
        }
        else {
            if (!csoundLoadedLogged) {
                console.log('csound.esm.js loading - done!')
                csoundLoadedLogged = true
            }
        }
    })

    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
