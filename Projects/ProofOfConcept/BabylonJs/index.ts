
import * as BABYLON from "babylonjs";

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
    
    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'sphere' shape. Params: name, subdivs, size, scene
    var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, scene);

    // Move the sphere upward 1/2 its height
    sphere.position.y = 1;

    // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
    BABYLON.Mesh.CreateGround("ground1", 6, 6, 2, scene);

    engine.runRenderLoop(() => {
        scene.render();
    })
}

createScene();
