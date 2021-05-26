
import * as BABYLON from "babylonjs";
import { Project } from "./project";

const createScene = async () => {

    // This creates and styles a canvas element on the html page
    const canvas = <HTMLCanvasElement>document.createElement('CANVAS');
    canvas.id = 'BabylonCanvas';
    var css = "#BabylonCanvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }";
    var style = document.createElement('style');
    style.appendChild(document.createTextNode(css));
    document.getElementsByTagName('head')[0].appendChild(style);
    document.body.appendChild(canvas);

    // This creates a Babylon engine object
    const engine = new BABYLON.Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});

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
