
import * as BABYLON from "babylonjs";
import { Project } from "./project";

const createScene = async () => {

    const canvas = <HTMLCanvasElement>document.getElementById('BabylonCanvas')
    
    // This creates a Babylon engine object
    const engine = new BABYLON.Engine(canvas, true, {
        // preserveDrawingBuffer: true,
        // stencil: true,
        audioEngine: true, audioEngineOptions: {
            audioContext: new AudioContext({
                latencyHint: 'playback'
            })
        }
    });

    // This resizes the BabylonJS window when the browser window is resized
    window.addEventListener('resize', function() {
        engine.resize();
    });
    
    // This creates the scene
    var scene = Project.CreateScene(engine, canvas);

    // This renders each frame of the scene
    engine.runRenderLoop(() => {
        scene.render();
    })
}

createScene();
