import * as BABYLON from "babylonjs";
import * as BABYLON_MATERIALS from "babylonjs-materials";
import * as CSOUND from "./@doc.e.dub/csound-browser";

declare global {
    interface Document {
        audioContext: AudioContext
        Csound: CSOUND.Csound
        csound: CSOUND.CsoundObj
        latency: number
    }
}

// var ConsoleLogHTML = require('console-log-html')
// ConsoleLogHTML.connect(document.getElementById('ConsoleOutput'), {}, false, false, false)

class Playground { public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {

    // The BabylonJS playground adds the materials extension to BABYLON.
    // Uncomment this when copy/pasting to the BabylonJS playground.
    // if (!BABYLON_MATERIALS)
    //     var BABYLON_MATERIALS = BABYLON;

    const showBabylonInspector = false;
    const logCsoundMessages = true;
    const logDebugMessages = true;
    const showGroundGrid = true;

    const csoundCameraUpdatesPerSecond = 10;
    const csoundIoBufferSize = 128;
    const groundSize = 1000;
    const groundRingDiameter = 100;

    const halfGroundSize = groundSize / 2;

    document.audioContext = BABYLON.Engine.audioEngine.audioContext
    BABYLON.Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => { onAudioEngineUnlocked() })
    BABYLON.Engine.audioEngine.lock()
    
    const originalConsoleDebug = console.debug
    console.debug = function() {
        if (logDebugMessages) {
            originalConsoleLog.apply(console, arguments)
        }
    }

    const originalConsoleLog = console.log
    console.log = function() {
        originalConsoleLog.apply(console, arguments)
    }

    let csoundImportScript = document.createElement('script');
    csoundImportScript.type = 'module'
    csoundImportScript.innerText = `
        console.debug("Csound importing ...");
        import { Csound } from "https://unpkg.com/@doc.e.dub/csound-browser/dist/csound.esm.js";
        document.Csound = Csound;
    `
    // csoundImportScript.innerText = `
    //     console.debug("Csound importing ...");
    //     import { Csound } from "./csound.esm.js";
    //     document.Csound = Csound;
    // `
    document.body.appendChild(csoundImportScript)

    function browser() {
        // Get the user-agent string
        const userAgent = navigator.userAgent;
        console.debug('userAgent =', userAgent);
        if (userAgent.indexOf('MSIE') > -1) {
            return 'Explorer';
        }
        if (userAgent.indexOf('Firefox') > -1) {
            return 'Firefox';
        }
        if (userAgent.indexOf('Chrome') > -1) {
            if (userAgent.indexOf('OP') > -1) {
                return 'Opera';
            }
            else {
                return 'Chrome';
            }
        }
        if (userAgent.indexOf('Safari') > -1) {
            return 'Safari';
        }
        return 'Unknown';
    }
    const detectedBrowser = browser();
    console.log('Browser detected =', detectedBrowser)

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);
    if (showBabylonInspector) {
        scene.debugLayer.show()
    }

    let camera = new BABYLON.FreeCamera('', new BABYLON.Vector3(99, 2, 99), scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.25;
    camera.attachControl(canvas, true);
    camera.setTarget(new BABYLON.Vector3(0, 2, 0));

    const ambientLightIntensity = 2
    // const ambientLight = new BABYLON.HemisphericLight('', new BABYLON.Vector3(0, -1, 0), scene);
    const ambientLight = new BABYLON.DirectionalLight('', new BABYLON.Vector3(0, -1, 0), scene);
    ambientLight.intensity = ambientLightIntensity
    
    // let sunLight = new BABYLON.DirectionalLight('', new BABYLON.Vector3(1, -1, 1), scene)
    // sunLight.direction.set(
    //     camera.target.x - camera.position.x,
    //     camera.target.y - camera.position.y,
    //     camera.target.z - camera.position.z,        
    //     )

    const glowLayer = new BABYLON.GlowLayer('', scene)
    glowLayer.blurKernelSize = 64
    glowLayer.intensity = 0.5

    // For options docs see https://doc.babylonjs.com/typedoc/interfaces/babylon.ienvironmenthelperoptions.
    const skyBrightness = 0.01
    const environment = scene.createDefaultEnvironment({
        groundOpacity: 0,
        groundSize: groundSize,
        skyboxColor: new BABYLON.Color3(skyBrightness, skyBrightness, skyBrightness),
        skyboxSize: groundSize * 2
    });
    environment.ground.checkCollisions = true;

    const whiteColor = BABYLON.Color3.White();
    const grayColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    const whiteMaterial = new BABYLON.StandardMaterial('', scene);
    whiteMaterial.emissiveColor = whiteColor;
    whiteMaterial.disableLighting = true;
    whiteMaterial.freeze();

    const grayMaterial = new BABYLON.StandardMaterial('', scene);
    grayMaterial.emissiveColor = grayColor;
    grayMaterial.disableLighting = true;
    grayMaterial.freeze();

    const blackMaterial = new BABYLON.StandardMaterial('', scene);
    grayMaterial.disableLighting = true;
    grayMaterial.freeze();

    const whiteSphere = BABYLON.Mesh.CreateIcoSphere('', { radius: 1, subdivisions: 1 }, scene);
    whiteSphere.isVisible = false;
    whiteSphere.material = whiteMaterial;

    const graySphere = whiteSphere.clone('');
    graySphere.isVisible = false;
    graySphere.material = grayMaterial;

    { // Walls

        const wall = BABYLON.MeshBuilder.CreatePlane('', {
            size: groundSize
        });
        wall.isVisible = false;
        wall.position.y = halfGroundSize;

        const northWall = wall.createInstance('');
        northWall.checkCollisions = true;
        northWall.isVisible = false;
        northWall.position.z = halfGroundSize + 0.1;

        const eastWall = wall.createInstance('');
        eastWall.checkCollisions = true;
        eastWall.isVisible = false;
        eastWall.position.x = halfGroundSize + 0.1;
        eastWall.rotation.y = Math.PI / 2;

        const southWall = wall.createInstance('');
        southWall.checkCollisions = true;
        southWall.isVisible = false;
        southWall.position.z = -halfGroundSize - 0.1;
        southWall.rotation.y = Math.PI;

        const westWall = wall.createInstance('');
        westWall.checkCollisions = true;
        westWall.isVisible = false;
        westWall.position.x = -halfGroundSize - 0.1;
        westWall.rotation.y = -Math.PI / 2;

    }

    // Add gray ring on ground.
    const groundRing = BABYLON.Mesh.CreateTorus('', groundRingDiameter, 0.25, 90, scene);
    groundRing.material = grayMaterial;
    glowLayer.addExcludedMesh(groundRing)

    const ground = BABYLON.MeshBuilder.CreatePlane('', {
        size: groundSize
    })
    ground.rotation.set(Math.PI / 2, 0, 0)

    if (showGroundGrid) {
        const gridMaterial = new BABYLON_MATERIALS.GridMaterial('', scene);
        // gridMaterial.gridRatio = .25;
        gridMaterial.lineColor.set(0.2, 0.2, 0.2);
        gridMaterial.minorUnitVisibility = 0;
        ground.material = gridMaterial;
    }
    else {
        ground.material = blackMaterial;
    }
    
    // This gets updated when switching between flat-screen camera and XR camera.
    let currentCamera = camera

    const startXr = async () => {
        try {
            const xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [ environment.ground ]});
            if (!!xr && !!xr.enterExitUI) {
                xr.enterExitUI.activeButtonChangedObservable.add((eventData) => {
                    if (eventData == null) {
                        if (currentCamera != camera) {
                            console.debug('Switched to flat-screen camera')
                            currentCamera = camera
                        }
                    }
                    else {
                        if (currentCamera != xr.baseExperience.camera) {
                            console.debug('Switched to XR camera')
                            currentCamera = xr.baseExperience.camera
                        }
                    }
                })
            }
        }
        catch(e) {
            console.debug(e)
        }
    }
    startXr();

    let startTime = 0;
    let distanceDelaySynthLowestNoteNumber = 0
    let distanceDelaySynthNoteNumbers = []

    const startAudioVisuals = () => {
        let csdData = JSON.parse(csdJson)
        // console.debug('csdData =', csdData)

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // DistanceDelaySynth
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const pillarWidth = 5
        const pillarHeight = 160

        const distanceDelaySynthLitBrightness = 0.75
        const distanceDelaySynthUnlitBrightness = 0.05

        const distanceDelaySynthLitBrightnessRGB = [ distanceDelaySynthLitBrightness, distanceDelaySynthLitBrightness, distanceDelaySynthLitBrightness ]
        const distanceDelaySynthUnlitBrightnessRGB = [ distanceDelaySynthUnlitBrightness, distanceDelaySynthUnlitBrightness, distanceDelaySynthUnlitBrightness ]

        const distanceDelaySynthData = csdData['6c9f37ab-392f-429b-8217-eac09f295362']
        const distanceDelaySynthHeader = distanceDelaySynthData[0]
        console.debug('distanceDelaySynthHeader =', distanceDelaySynthHeader)

        let distanceDelaySynthRadii = []
        for (let delayI = 0; delayI < distanceDelaySynthHeader.delayCount; delayI++) {
            distanceDelaySynthRadii.push(distanceDelaySynthHeader.startDistance + delayI * distanceDelaySynthHeader.delayDistance)
        }
        const distanceDelaySynthRotationAngle = 2 * Math.PI / 3

        let distanceDelaySynthNotes = []

        const distanceDelaySynthNote = (noteNumber) => {
            for (let i = 0; i < distanceDelaySynthNotes.length; i++) {
                if (distanceDelaySynthNotes[i].noteNumber === noteNumber) {
                    return distanceDelaySynthNotes[i]
                }
            }
            return undefined
        }

        const distanceDelaySynthPillarMesh = BABYLON.MeshBuilder.CreateCylinder('Pillars', {
            height: pillarHeight,
            diameter: pillarWidth,
            tessellation: 32
        })

        const torusDiameter = pillarWidth * 3
        const torusThickness = 1.5

        const distanceDelaySynthMesh = BABYLON.MeshBuilder.CreateTorus('Notes', {
            thickness: torusThickness,
            diameter: torusDiameter,
            tessellation: 32
        })

        const distanceDelaySynthGlowMesh = BABYLON.MeshBuilder.CreateTorus('', {
            thickness: torusThickness,
            diameter: torusDiameter,
            tessellation: 32
        })

        const distanceDelaySynthPillarMaterial = new BABYLON.StandardMaterial('', scene)
        distanceDelaySynthPillarMaterial.diffuseColor.set(1, 1, 1)
        distanceDelaySynthPillarMaterial.specularColor.set(0.25, 0.25, 0.25)
        distanceDelaySynthPillarMaterial.specularPower = 2
        // distanceDelaySynthPillarMaterial.emissiveColor.set(0.15, 0.15, 0.15)
        

        const distanceDelaySynthMaterial = new BABYLON.StandardMaterial('', scene)
        distanceDelaySynthMaterial.diffuseColor.set(1, 1, 1)
        distanceDelaySynthMaterial.specularColor.set(0.25, 0.25, 0.25)
        distanceDelaySynthMaterial.specularPower = 2
        // distanceDelaySynthMaterial.emissiveColor.set(0.15, 0.15, 0.15)

        const distanceDelaySynthGlowMaterial = new BABYLON.StandardMaterial('', scene)
        distanceDelaySynthGlowMaterial.emissiveColor.set(1, 1, 1)

        distanceDelaySynthPillarMesh.material = distanceDelaySynthPillarMaterial
        distanceDelaySynthPillarMesh.isVisible = true
        distanceDelaySynthPillarMesh.thinInstanceRegisterAttribute('color', 3)

        distanceDelaySynthMesh.material = distanceDelaySynthMaterial
        distanceDelaySynthMesh.isVisible = true
        distanceDelaySynthMesh.thinInstanceRegisterAttribute('color', 3)

        distanceDelaySynthGlowMesh.material = distanceDelaySynthGlowMaterial
        distanceDelaySynthGlowMesh.isVisible = true
        distanceDelaySynthGlowMesh.thinInstanceRegisterAttribute('color', 3)

        // Pillars
        for (let delayI = 0; delayI < distanceDelaySynthHeader.delayCount; delayI++) {
            let radius = distanceDelaySynthRadii[delayI]
            console.debug('radius =', radius)
            let angle = Math.PI
            let pillarIndex1 = distanceDelaySynthPillarMesh.thinInstanceAdd(BABYLON.Matrix.Translation(radius * Math.sin(angle), pillarHeight / 2, radius * Math.cos(angle)), false)
            angle += distanceDelaySynthRotationAngle
            let pillarIndex2 = distanceDelaySynthPillarMesh.thinInstanceAdd(BABYLON.Matrix.Translation(radius * Math.sin(angle), pillarHeight / 2, radius * Math.cos(angle)), false)
            angle += distanceDelaySynthRotationAngle
            let pillarIndex3 = distanceDelaySynthPillarMesh.thinInstanceAdd(BABYLON.Matrix.Translation(radius * Math.sin(angle), pillarHeight / 2, radius * Math.cos(angle)), true)
            distanceDelaySynthPillarMesh.thinInstanceSetAttributeAt('color', pillarIndex1, distanceDelaySynthUnlitBrightnessRGB, false)
            distanceDelaySynthPillarMesh.thinInstanceSetAttributeAt('color', pillarIndex2, distanceDelaySynthUnlitBrightnessRGB, false)
            distanceDelaySynthPillarMesh.thinInstanceSetAttributeAt('color', pillarIndex3, distanceDelaySynthUnlitBrightnessRGB, true)
        }

        const zeroScalingMatrix = BABYLON.Matrix.Scaling(0, 0, 0)
        // const distanceDelaySynthNoteScalingMatrix = BABYLON.Matrix.Scaling(pillarWidth + 3, 1, pillarWidth + 3)
        const distanceDelaySynthNoteScalingMatrix = BABYLON.Matrix.Scaling(1, 1, 1)

        const makeDistanceDelaySynthNote = (noteNumber) => {
            let foundNote = distanceDelaySynthNote(noteNumber)
            if (!!foundNote) {
                return foundNote
            }
            let delays = []
            let height = (noteNumber - distanceDelaySynthLowestNoteNumber) * distanceDelaySynthHeader.noteNumberToHeightScale
            for (let delayI = 0; delayI < distanceDelaySynthHeader.delayCount; delayI++) {
                const radius = distanceDelaySynthRadii[delayI]
                let angle = Math.PI
                const translationMatrix1 = BABYLON.Matrix.Translation(radius * Math.sin(angle), height, radius * Math.cos(angle))
                const instanceMatrix1 = distanceDelaySynthNoteScalingMatrix.multiply(translationMatrix1)
                let instanceIndex1 = distanceDelaySynthMesh.thinInstanceAdd(instanceMatrix1, false)
                let glowInstanceIndex1 = distanceDelaySynthGlowMesh.thinInstanceAdd(zeroScalingMatrix, false)
                angle += distanceDelaySynthRotationAngle
                const translationMatrix2 = BABYLON.Matrix.Translation(radius * Math.sin(angle), height, radius * Math.cos(angle))
                const instanceMatrix2 = distanceDelaySynthNoteScalingMatrix.multiply(translationMatrix2)
                let instanceIndex2 = distanceDelaySynthMesh.thinInstanceAdd(instanceMatrix2, false)
                let glowInstanceIndex2 = distanceDelaySynthGlowMesh.thinInstanceAdd(zeroScalingMatrix, false)
                angle += distanceDelaySynthRotationAngle
                const translationMatrix3 = BABYLON.Matrix.Translation(radius * Math.sin(angle), height, radius * Math.cos(angle))
                const instanceMatrix3 = distanceDelaySynthNoteScalingMatrix.multiply(translationMatrix3)
                let instanceIndex3 = distanceDelaySynthMesh.thinInstanceAdd(instanceMatrix3, true)
                let glowInstanceIndex3 = distanceDelaySynthGlowMesh.thinInstanceAdd(zeroScalingMatrix, true)
                // let glowInstanceIndex3 = distanceDelaySynthGlowMesh.thinInstanceAdd(glowInstanceMatrix3, true)
                distanceDelaySynthMesh.thinInstanceSetAttributeAt('color', instanceIndex1, distanceDelaySynthUnlitBrightnessRGB, false)
                distanceDelaySynthMesh.thinInstanceSetAttributeAt('color', instanceIndex2, distanceDelaySynthUnlitBrightnessRGB, false)
                distanceDelaySynthMesh.thinInstanceSetAttributeAt('color', instanceIndex3, distanceDelaySynthUnlitBrightnessRGB, true)
                distanceDelaySynthGlowMesh.thinInstanceSetAttributeAt('color', glowInstanceIndex1, [1, 1, 1], false)
                distanceDelaySynthGlowMesh.thinInstanceSetAttributeAt('color', glowInstanceIndex2, [1, 1, 1], false)
                distanceDelaySynthGlowMesh.thinInstanceSetAttributeAt('color', glowInstanceIndex3, [1, 1, 1], true)
                let delay = {
                    onTimes: [],
                    offTimes: [],
                    onIndex: 0,
                    offIndex: 0,
                    instanceIndexes: [ instanceIndex1, instanceIndex2, instanceIndex3 ],
                    glowInstanceIndexes: [ glowInstanceIndex1, glowInstanceIndex2, glowInstanceIndex3 ],
                    instanceMatrixes: [ instanceMatrix1, instanceMatrix2, instanceMatrix3 ]
                }
                delays.push(delay)
            }
            let note = {
                noteNumber: noteNumber,
                delays: delays
            }
            distanceDelaySynthNotes.push(note)
            return note
        }

        // Make note numbers array and find lowest note number before making note meshes.
        for (let noteI = 1; noteI < distanceDelaySynthData.length; noteI++) {
            let noteOn = distanceDelaySynthData[noteI].noteOn

            // Skip preallocation notes.
            if (noteOn.time == 0.005) {
                continue;
            }

            if (!distanceDelaySynthNoteNumbers.includes(noteOn.note)) {
                distanceDelaySynthNoteNumbers.push(noteOn.note)
                if (distanceDelaySynthLowestNoteNumber === 0) {
                    distanceDelaySynthLowestNoteNumber = noteOn.note
                }
                else {
                    distanceDelaySynthLowestNoteNumber = Math.min(noteOn.note, distanceDelaySynthLowestNoteNumber)
                }
            }
        }
        distanceDelaySynthLowestNoteNumber -= 5
        console.debug('distanceDelaySynthLowestNoteNumber =', distanceDelaySynthLowestNoteNumber)

        for (let noteI = 1; noteI < distanceDelaySynthData.length; noteI++) {
            let noteOn = distanceDelaySynthData[noteI].noteOn

            // Skip preallocation notes.
            if (noteOn.time == 0.005) {
                continue;
            }

            let note = makeDistanceDelaySynthNote(noteOn.note)
            let onTime = noteOn.time
            for (let delayI = 0; delayI < distanceDelaySynthHeader.delayCount; delayI++) {
                onTime += delayI * distanceDelaySynthHeader.delayTime
                let delay = note.delays[delayI]
                delay.onTimes.push(onTime)
                delay.offTimes.push(onTime + distanceDelaySynthHeader.duration)
            }
        }

        const resetDistanceDelaySynthIndexes = () => {
            distanceDelaySynthNotes.forEach((note) => {
                note.delays.forEach((delay) => {
                    delay.onIndex = delay.offIndex = 0
                })
            })
        }

        const distanceDelaySynthRender = (time) => {
            distanceDelaySynthNotes.forEach((note) => {
                for (let delayI = 0; delayI < distanceDelaySynthHeader.delayCount; delayI++) {
                    const delay = note.delays[delayI]

                    while (delay.onIndex < delay.onTimes.length && delay.onTimes[delay.onIndex] <= time) {
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[0], zeroScalingMatrix, false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[1], zeroScalingMatrix, false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[2], zeroScalingMatrix, true)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(delay.glowInstanceIndexes[0], delay.instanceMatrixes[0], false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(delay.glowInstanceIndexes[1], delay.instanceMatrixes[1], false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(delay.glowInstanceIndexes[2], delay.instanceMatrixes[2], true)
                        delay.onIndex++
                    }

                    while (delay.offIndex < delay.offTimes.length && delay.offTimes[delay.offIndex] <= time) {
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[0], delay.instanceMatrixes[0], false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[1], delay.instanceMatrixes[1], false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[2], delay.instanceMatrixes[2], true)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(delay.glowInstanceIndexes[0], zeroScalingMatrix, false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(delay.glowInstanceIndexes[1], zeroScalingMatrix, false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(delay.glowInstanceIndexes[2], zeroScalingMatrix, true)
                        delay.offIndex++
                    }
                }
            })
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // PointSynth
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const noteMeshInstanceCount = 40;
        let noteMeshInstanceIndex = 0;
        let noteMeshInstances = [];
        const noteMesh = BABYLON.Mesh.CreateIcoSphere('', { radius: 1, subdivisions: 1 }, scene);
        noteMesh.material = whiteMaterial.clone('')
        noteMesh.isVisible = false
        let noteMeshInstance = noteMesh.createInstance('');
        noteMeshInstance.isVisible = false;
        noteMeshInstance.scaling.setAll(1.01);
        for (let i = 0; i < noteMeshInstanceCount; i++) {
            noteMeshInstances.push(noteMeshInstance.clone(''));
        }

        const pointSynthPlaceholderMesh = graySphere.clone('');
        pointSynthPlaceholderMesh.scaling.setAll(1);
        pointSynthPlaceholderMesh.bakeCurrentTransformIntoVertices();
        pointSynthPlaceholderMesh.isVisible = true;

        // Initialize point synth notes.
        let pointSynthNoteStartIndex = 0;
        const pointSynthData = csdData['b4f7a35c-6198-422f-be6e-fa126f31b007']
        const pointSynthHeader = pointSynthData[0]
        console.debug('pointSynthHeader =', pointSynthHeader)
        for (let i = 1; i < pointSynthData.length; i++) {
            let noteOn = pointSynthData[i].noteOn

            // Skip preallocation notes.
            if (noteOn.time == 0.005) {
                continue;
            }
            else if (pointSynthNoteStartIndex == 0) {
                pointSynthNoteStartIndex = i;
            }

            noteOn.offTime = noteOn.time + 0.1 // pointSynthData[0].fadeOutTime

            const refreshInstances = i == pointSynthData.length - 1;
            pointSynthPlaceholderMesh.thinInstanceAdd(
                BABYLON.Matrix.Translation(noteOn.xyz[0], noteOn.xyz[1], noteOn.xyz[2]), refreshInstances);
        }

        // Initialized in render loop and incremented as elapsed time passes.
        let nextPointSynthNoteOnIndex = 0;
        let nextPointSynthNoteOffIndex = 0;

        const pointSynthNoteOn = (i) => {
            const note = pointSynthData[i].noteOn;
            note.instanceIndex = noteMeshInstanceIndex;
            let mesh = noteMeshInstances[note.instanceIndex];
            let mirrorMesh = noteMeshInstances[note.instanceIndex + 1];
            mesh.position.x = note.xyz[0];
            mesh.position.y = note.xyz[1];
            mesh.position.z = note.xyz[2];
            mesh.isVisible = true;

            noteMeshInstanceIndex++;
            if (noteMeshInstanceIndex == noteMeshInstanceCount) {
                noteMeshInstanceIndex = 0;
            }
        }

        const pointSynthNoteOff = (i) => {
            const note = pointSynthData[i].noteOn;
            noteMeshInstances[note.instanceIndex].isVisible = false;
        }

        const resetPointSynthIndexes = () => {
            nextPointSynthNoteOnIndex = pointSynthNoteStartIndex;
            nextPointSynthNoteOffIndex = pointSynthNoteStartIndex;
        }

        const pointSynthRender = (time) => {
            while (nextPointSynthNoteOnIndex < pointSynthData.length
                && pointSynthData[nextPointSynthNoteOnIndex].noteOn.time <= time) {
            pointSynthNoteOn(nextPointSynthNoteOnIndex);
            nextPointSynthNoteOnIndex++;
            }

            while (nextPointSynthNoteOffIndex < pointSynthData.length
                    && pointSynthData[nextPointSynthNoteOffIndex].noteOn.offTime <= time) {
                pointSynthNoteOff(nextPointSynthNoteOffIndex);
                nextPointSynthNoteOffIndex++;
            }
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Update note animations.
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const cameraRadiusMax = 400
        let cameraSpeed = 4000
        let cameraTargetY = pillarHeight / 3
        let cameraTarget = new BABYLON.Vector3(0, cameraTargetY, -50)
        let cameraRadius = 65
        let cameraRadiusX = -1
        let cameraAngle = Math.PI

        const updateCamera = (time) => {
            if (cameraRadius < 10 || cameraRadius > cameraRadiusMax) {
                cameraRadiusX *= -1
            }
            cameraRadius -= time / (cameraSpeed / 2) * cameraRadiusX
            cameraAngle += Math.PI * time / (360 * cameraSpeed)
            cameraAngle %= 2 * Math.PI

            camera.position.set(cameraRadius * Math.sin(cameraAngle), 2, cameraRadius * Math.cos(cameraAngle))
            // cameraTarget.set(0, Math.min(cameraTargetY + time / 10, 400), -50)
            camera.setTarget(cameraTarget)

            ambientLight.direction = camera.target.subtract(camera.position)
            ambientLight.direction.y = 0

            if (restartCount > 0) {
                cameraSpeed *= 1.0025
            }
        }

        engine.runRenderLoop(() => {
            if (!isCsoundStarted) {
                resetDistanceDelaySynthIndexes()
                resetPointSynthIndexes()
                updateCamera(0)
                return;
            }

            const time = document.audioContext.currentTime - startTime;
            distanceDelaySynthRender(time)
            pointSynthRender(time)
            updateCamera(time)
        })

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const previousCameraMatrix = new Float32Array(16)
        const currentCameraMatrix = new Float32Array(16)
        let currentCameraMatrixIsDirty = true
        
        // Send the camera matrix to Csound.
        setInterval(() => {
            if (!isCsoundStarted) {
                return;
            }    
            currentCamera.worldMatrixFromCache.copyToArray(currentCameraMatrix)
            if (!currentCameraMatrixIsDirty) {
                for (let i = 0; i < 16; i++) {
                    if (0.01 < Math.abs(currentCameraMatrix[i] - previousCameraMatrix[i])) {
                        currentCameraMatrixIsDirty = true
                        break
                    }
                }
            }
            if (currentCameraMatrixIsDirty) {
                // console.debug('BabylonJs listener position = [' + currentCameraMatrix[12] + ', ' + currentCameraMatrix[13] + ', ' + currentCameraMatrix[14] + ']')
                document.csound.tableCopyIn("1", currentCameraMatrix);
                currentCamera.worldMatrixFromCache.copyToArray(previousCameraMatrix);
                currentCameraMatrixIsDirty = false;
            }
        }, 1000 / csoundCameraUpdatesPerSecond);
    }

    const csoundLoadTimer = setInterval(() => {
        if (!!document.Csound) {
            console.debug('Csound imported successfully')
            clearInterval(csoundLoadTimer)
            onCsoundLoaded()
        }
        else {
            console.debug('Waiting for Csound import ...')
        }
    }, 1000)

    let isAudioEngineUnlocked = false
    let isCsoundLoaded = false
    let isCsoundStarted = false

    const onAudioEngineUnlocked = () => {
        document.audioContext.resume()
        isAudioEngineUnlocked = true
        console.debug('Audio engine unlocked')
        startCsound()
    }
    
    const onCsoundLoaded = () => {
        isCsoundLoaded = true
        startCsound()
    }

    let restartCount = 0

    const restartCsound = async () => {
        // console.debug('Restarting Csound ...')
        // isCsoundStarted = false;
        // await document.csound.rewindScore();
        // console.debug('Restarting Csound - done')
        restartCount++
        // console.debug('Restart count =', restartCount)
    }

    const startCsound = async () => {
        if (!isAudioEngineUnlocked) return
        if (!isCsoundLoaded) return
        console.debug('Csound initializing ...')
        const previousConsoleLog = console.log;
        const csoundConsoleLog = function() {
            if (arguments[0] === 'csd:started') {
                startTime = document.audioContext.currentTime - (4 - 3 * document.latency);
                isCsoundStarted = true
            }
            else if (arguments[0] === 'csd:ended') {
                restartCsound();
            }
            if (logCsoundMessages) {
                previousConsoleLog.apply(console, arguments)
            }
        }
        console.log = csoundConsoleLog;
        const csound = await document.Csound({
            audioContext:
                detectedBrowser === 'Safari'
                    ? document.audioContext
                    : new AudioContext({
                        latencyHint: 0.08533333333333333,
                        sampleRate: 48000
                    }),
            useSAB: false
        })
        console.log = previousConsoleLog;
        if (!csound) {
            console.error('Csound failed to initialize')
            return
        }
        document.csound = csound;
        console.log('Csound version =', await csound.getVersion())
        
        const audioContext = await csound.getAudioContext()
        console.debug('audioContext =', audioContext)
        console.debug('audioContext.audioWorklet =', audioContext.audioWorklet)
        console.debug('audioContext.baseLatency =', audioContext.baseLatency)
        console.debug('audioContext.outputLatency =', audioContext.outputLatency)
        console.debug('audioContext.sampleRate =', audioContext.sampleRate)
        console.debug('audioContext.state =', audioContext.state)
        document.audioContext = audioContext;

        if (audioContext.sampleRate != 48000) {
            console.log('Sample restricted to 48000');
            return;
        }

        console.debug('Csound initialized successfully');
        let distanceDelaySynthNoteCacheArrayMacro = "fillarray "
        for(let i = 0; i < distanceDelaySynthNoteNumbers.length; i++) {
            if(i != 0) {
                distanceDelaySynthNoteCacheArrayMacro += "\, "
            }
            distanceDelaySynthNoteCacheArrayMacro += distanceDelaySynthNoteNumbers[i]
        }
        await csound.setOption('--iobufsamps=' + csoundIoBufferSize)
        await csound.setOption('--omacro:DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER=' + distanceDelaySynthLowestNoteNumber)
        await csound.setOption('--omacro:DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY=' + distanceDelaySynthNoteCacheArrayMacro)
        console.debug('Csound csd compiling ...')
        let csoundErrorCode = await csound.compileCsdText(csdText)
        if (csoundErrorCode != 0) {
            console.error('Csound csd compile failed')
            return
        }
        document.latency = audioContext.baseLatency + csoundIoBufferSize / audioContext.sampleRate;
        console.debug('Latency =', document.latency);
        console.debug('Csound csd compile succeeded')
        console.debug('Csound starting ...')
        csound.start()
    }

    const csdText = `
        <CsoundSynthesizer>
        <CsOptions>
        --messagelevel=134
        --midi-device=0
        --nodisplays
        --nosound
        </CsOptions>
        <CsInstruments>
        giPresetUuidPreallocationCount[] = fillarray( 9, /* instr 4 -- DistanceDelaySynth */ 9, /* instr 5 -- PointSynth */ 0 /* instr 6 -- PowerLineSynth */ )
         #ifndef OUTPUT_CHANNEL_COUNT
         #define OUTPUT_CHANNEL_COUNT #2#
         #end
         #ifndef INTERNAL_CHANNEL_COUNT
         #define INTERNAL_CHANNEL_COUNT #6#
         #end
        sr = 48000
        kr = 200
        nchnls = $OUTPUT_CHANNEL_COUNT
        0dbfs = 1
         #define INSTANCE_NAME #"TestSynth playback"#
         #ifndef CSD_FILE_PATH
            #define CSD_FILE_PATH #"undefined"#
         #end
         #ifndef INSTANCE_NAME
            #define INSTANCE_NAME #"undefined"#
         #end
        gS_csdFileName = "undefined"
        gS_csdFilePath = $CSD_FILE_PATH
        gS_instanceName = $INSTANCE_NAME
        gk_i init -1
        opcode string_begins_with, k, SS
            S_string, S_string_beginning xin
            S_substring = strsubk(S_string, 0, strlenk(S_string_beginning))
            k_result = 0
            if (strcmpk(strsubk(S_string, 0, strlenk(S_string_beginning)), S_string_beginning) == 0) then
                k_result = 1
            endif
            xout k_result
        endop
        opcode filename_from_full_path_i, S, S
            S_fullPath xin
            i_fullPathLength = strlen(S_fullPath)
            ii = i_fullPathLength - 1
            i_found = 0
            while (i_found == 0 && 0 < ii) do
                i_char = strchar(S_fullPath, ii)
                if (i_char == 47 || i_char == 92) then
                    i_found = 1
                else
                    ii -= 1
                endif
            od
            S_filename = strsub(S_fullPath, ii + 1, i_fullPathLength)
            xout S_filename
        endop
        opcode filename_from_full_path_k, S, S
            S_fullPath xin
            k_fullPathLength = strlenk(S_fullPath)
            ki = k_fullPathLength - 1
            k_found = 0
            while (k_found == 0 && k(0) < ki) do
                k_char = strchark(S_fullPath, ki)
                if (k_char == 47 || k_char == 92) then
                    k_found = 1
                else
                    ki -= 1
                endif
            od
            S_filename = strsubk(S_fullPath, ki + 1, k_fullPathLength)
            xout S_filename
        endop
        /*
         * The resonance audio lookup tables were copied from https:
         * The original resonance audio file was authored by Andrew Allen <bitllama@google.com>.
         */
        gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_000_179[][] init 180, 6
        gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_180_359[][] init 180, 6
        gi_AF_3D_Audio_SphericalHarmonicsElevationLookupTable[][] init 180, 9
        gi_AF_3D_Audio_MaxReWeightsLookupTable[][] init 360, 4
        gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_000_179 fillarray \\
        0.000000, 0.000000, 0.000000, 1.000000, 1.000000, 1.000000,
        0.052336, 0.034899, 0.017452, 0.999848, 0.999391, 0.998630,
        0.104528, 0.069756, 0.034899, 0.999391, 0.997564, 0.994522,
        0.156434, 0.104528, 0.052336, 0.998630, 0.994522, 0.987688,
        0.207912, 0.139173, 0.069756, 0.997564, 0.990268, 0.978148,
        0.258819, 0.173648, 0.087156, 0.996195, 0.984808, 0.965926,
        0.309017, 0.207912, 0.104528, 0.994522, 0.978148, 0.951057,
        0.358368, 0.241922, 0.121869, 0.992546, 0.970296, 0.933580,
        0.406737, 0.275637, 0.139173, 0.990268, 0.961262, 0.913545,
        0.453990, 0.309017, 0.156434, 0.987688, 0.951057, 0.891007,
        0.500000, 0.342020, 0.173648, 0.984808, 0.939693, 0.866025,
        0.544639, 0.374607, 0.190809, 0.981627, 0.927184, 0.838671,
        0.587785, 0.406737, 0.207912, 0.978148, 0.913545, 0.809017,
        0.629320, 0.438371, 0.224951, 0.974370, 0.898794, 0.777146,
        0.669131, 0.469472, 0.241922, 0.970296, 0.882948, 0.743145,
        0.707107, 0.500000, 0.258819, 0.965926, 0.866025, 0.707107,
        0.743145, 0.529919, 0.275637, 0.961262, 0.848048, 0.669131,
        0.777146, 0.559193, 0.292372, 0.956305, 0.829038, 0.629320,
        0.809017, 0.587785, 0.309017, 0.951057, 0.809017, 0.587785,
        0.838671, 0.615661, 0.325568, 0.945519, 0.788011, 0.544639,
        0.866025, 0.642788, 0.342020, 0.939693, 0.766044, 0.500000,
        0.891007, 0.669131, 0.358368, 0.933580, 0.743145, 0.453990,
        0.913545, 0.694658, 0.374607, 0.927184, 0.719340, 0.406737,
        0.933580, 0.719340, 0.390731, 0.920505, 0.694658, 0.358368,
        0.951057, 0.743145, 0.406737, 0.913545, 0.669131, 0.309017,
        0.965926, 0.766044, 0.422618, 0.906308, 0.642788, 0.258819,
        0.978148, 0.788011, 0.438371, 0.898794, 0.615661, 0.207912,
        0.987688, 0.809017, 0.453990, 0.891007, 0.587785, 0.156434,
        0.994522, 0.829038, 0.469472, 0.882948, 0.559193, 0.104528,
        0.998630, 0.848048, 0.484810, 0.874620, 0.529919, 0.052336,
        1.000000, 0.866025, 0.500000, 0.866025, 0.500000, 0.000000,
        0.998630, 0.882948, 0.515038, 0.857167, 0.469472, -0.052336,
        0.994522, 0.898794, 0.529919, 0.848048, 0.438371, -0.104528,
        0.987688, 0.913545, 0.544639, 0.838671, 0.406737, -0.156434,
        0.978148, 0.927184, 0.559193, 0.829038, 0.374607, -0.207912,
        0.965926, 0.939693, 0.573576, 0.819152, 0.342020, -0.258819,
        0.951057, 0.951057, 0.587785, 0.809017, 0.309017, -0.309017,
        0.933580, 0.961262, 0.601815, 0.798636, 0.275637, -0.358368,
        0.913545, 0.970296, 0.615661, 0.788011, 0.241922, -0.406737,
        0.891007, 0.978148, 0.629320, 0.777146, 0.207912, -0.453990,
        0.866025, 0.984808, 0.642788, 0.766044, 0.173648, -0.500000,
        0.838671, 0.990268, 0.656059, 0.754710, 0.139173, -0.544639,
        0.809017, 0.994522, 0.669131, 0.743145, 0.104528, -0.587785,
        0.777146, 0.997564, 0.681998, 0.731354, 0.069756, -0.629320,
        0.743145, 0.999391, 0.694658, 0.719340, 0.034899, -0.669131,
        0.707107, 1.000000, 0.707107, 0.707107, 0.000000, -0.707107,
        0.669131, 0.999391, 0.719340, 0.694658, -0.034899, -0.743145,
        0.629320, 0.997564, 0.731354, 0.681998, -0.069756, -0.777146,
        0.587785, 0.994522, 0.743145, 0.669131, -0.104528, -0.809017,
        0.544639, 0.990268, 0.754710, 0.656059, -0.139173, -0.838671,
        0.500000, 0.984808, 0.766044, 0.642788, -0.173648, -0.866025,
        0.453990, 0.978148, 0.777146, 0.629320, -0.207912, -0.891007,
        0.406737, 0.970296, 0.788011, 0.615661, -0.241922, -0.913545,
        0.358368, 0.961262, 0.798636, 0.601815, -0.275637, -0.933580,
        0.309017, 0.951057, 0.809017, 0.587785, -0.309017, -0.951057,
        0.258819, 0.939693, 0.819152, 0.573576, -0.342020, -0.965926,
        0.207912, 0.927184, 0.829038, 0.559193, -0.374607, -0.978148,
        0.156434, 0.913545, 0.838671, 0.544639, -0.406737, -0.987688,
        0.104528, 0.898794, 0.848048, 0.529919, -0.438371, -0.994522,
        0.052336, 0.882948, 0.857167, 0.515038, -0.469472, -0.998630,
        0.000000, 0.866025, 0.866025, 0.500000, -0.500000, -1.000000,
        -0.052336, 0.848048, 0.874620, 0.484810, -0.529919, -0.998630,
        -0.104528, 0.829038, 0.882948, 0.469472, -0.559193, -0.994522,
        -0.156434, 0.809017, 0.891007, 0.453990, -0.587785, -0.987688,
        -0.207912, 0.788011, 0.898794, 0.438371, -0.615661, -0.978148,
        -0.258819, 0.766044, 0.906308, 0.422618, -0.642788, -0.965926,
        -0.309017, 0.743145, 0.913545, 0.406737, -0.669131, -0.951057,
        -0.358368, 0.719340, 0.920505, 0.390731, -0.694658, -0.933580,
        -0.406737, 0.694658, 0.927184, 0.374607, -0.719340, -0.913545,
        -0.453990, 0.669131, 0.933580, 0.358368, -0.743145, -0.891007,
        -0.500000, 0.642788, 0.939693, 0.342020, -0.766044, -0.866025,
        -0.544639, 0.615661, 0.945519, 0.325568, -0.788011, -0.838671,
        -0.587785, 0.587785, 0.951057, 0.309017, -0.809017, -0.809017,
        -0.629320, 0.559193, 0.956305, 0.292372, -0.829038, -0.777146,
        -0.669131, 0.529919, 0.961262, 0.275637, -0.848048, -0.743145,
        -0.707107, 0.500000, 0.965926, 0.258819, -0.866025, -0.707107,
        -0.743145, 0.469472, 0.970296, 0.241922, -0.882948, -0.669131,
        -0.777146, 0.438371, 0.974370, 0.224951, -0.898794, -0.629320,
        -0.809017, 0.406737, 0.978148, 0.207912, -0.913545, -0.587785,
        -0.838671, 0.374607, 0.981627, 0.190809, -0.927184, -0.544639,
        -0.866025, 0.342020, 0.984808, 0.173648, -0.939693, -0.500000,
        -0.891007, 0.309017, 0.987688, 0.156434, -0.951057, -0.453990,
        -0.913545, 0.275637, 0.990268, 0.139173, -0.961262, -0.406737,
        -0.933580, 0.241922, 0.992546, 0.121869, -0.970296, -0.358368,
        -0.951057, 0.207912, 0.994522, 0.104528, -0.978148, -0.309017,
        -0.965926, 0.173648, 0.996195, 0.087156, -0.984808, -0.258819,
        -0.978148, 0.139173, 0.997564, 0.069756, -0.990268, -0.207912,
        -0.987688, 0.104528, 0.998630, 0.052336, -0.994522, -0.156434,
        -0.994522, 0.069756, 0.999391, 0.034899, -0.997564, -0.104528,
        -0.998630, 0.034899, 0.999848, 0.017452, -0.999391, -0.052336,
        -1.000000, 0.000000, 1.000000, 0.000000, -1.000000, 0.000000,
        -0.998630, -0.034899, 0.999848, -0.017452, -0.999391, 0.052336,
        -0.994522, -0.069756, 0.999391, -0.034899, -0.997564, 0.104528,
        -0.987688, -0.104528, 0.998630, -0.052336, -0.994522, 0.156434,
        -0.978148, -0.139173, 0.997564, -0.069756, -0.990268, 0.207912,
        -0.965926, -0.173648, 0.996195, -0.087156, -0.984808, 0.258819,
        -0.951057, -0.207912, 0.994522, -0.104528, -0.978148, 0.309017,
        -0.933580, -0.241922, 0.992546, -0.121869, -0.970296, 0.358368,
        -0.913545, -0.275637, 0.990268, -0.139173, -0.961262, 0.406737,
        -0.891007, -0.309017, 0.987688, -0.156434, -0.951057, 0.453990,
        -0.866025, -0.342020, 0.984808, -0.173648, -0.939693, 0.500000,
        -0.838671, -0.374607, 0.981627, -0.190809, -0.927184, 0.544639,
        -0.809017, -0.406737, 0.978148, -0.207912, -0.913545, 0.587785,
        -0.777146, -0.438371, 0.974370, -0.224951, -0.898794, 0.629320,
        -0.743145, -0.469472, 0.970296, -0.241922, -0.882948, 0.669131,
        -0.707107, -0.500000, 0.965926, -0.258819, -0.866025, 0.707107,
        -0.669131, -0.529919, 0.961262, -0.275637, -0.848048, 0.743145,
        -0.629320, -0.559193, 0.956305, -0.292372, -0.829038, 0.777146,
        -0.587785, -0.587785, 0.951057, -0.309017, -0.809017, 0.809017,
        -0.544639, -0.615661, 0.945519, -0.325568, -0.788011, 0.838671,
        -0.500000, -0.642788, 0.939693, -0.342020, -0.766044, 0.866025,
        -0.453990, -0.669131, 0.933580, -0.358368, -0.743145, 0.891007,
        -0.406737, -0.694658, 0.927184, -0.374607, -0.719340, 0.913545,
        -0.358368, -0.719340, 0.920505, -0.390731, -0.694658, 0.933580,
        -0.309017, -0.743145, 0.913545, -0.406737, -0.669131, 0.951057,
        -0.258819, -0.766044, 0.906308, -0.422618, -0.642788, 0.965926,
        -0.207912, -0.788011, 0.898794, -0.438371, -0.615661, 0.978148,
        -0.156434, -0.809017, 0.891007, -0.453990, -0.587785, 0.987688,
        -0.104528, -0.829038, 0.882948, -0.469472, -0.559193, 0.994522,
        -0.052336, -0.848048, 0.874620, -0.484810, -0.529919, 0.998630,
        0.000000, -0.866025, 0.866025, -0.500000, -0.500000, 1.000000,
        0.052336, -0.882948, 0.857167, -0.515038, -0.469472, 0.998630,
        0.104528, -0.898794, 0.848048, -0.529919, -0.438371, 0.994522,
        0.156434, -0.913545, 0.838671, -0.544639, -0.406737, 0.987688,
        0.207912, -0.927184, 0.829038, -0.559193, -0.374607, 0.978148,
        0.258819, -0.939693, 0.819152, -0.573576, -0.342020, 0.965926,
        0.309017, -0.951057, 0.809017, -0.587785, -0.309017, 0.951057,
        0.358368, -0.961262, 0.798636, -0.601815, -0.275637, 0.933580,
        0.406737, -0.970296, 0.788011, -0.615661, -0.241922, 0.913545,
        0.453990, -0.978148, 0.777146, -0.629320, -0.207912, 0.891007,
        0.500000, -0.984808, 0.766044, -0.642788, -0.173648, 0.866025,
        0.544639, -0.990268, 0.754710, -0.656059, -0.139173, 0.838671,
        0.587785, -0.994522, 0.743145, -0.669131, -0.104528, 0.809017,
        0.629320, -0.997564, 0.731354, -0.681998, -0.069756, 0.777146,
        0.669131, -0.999391, 0.719340, -0.694658, -0.034899, 0.743145,
        0.707107, -1.000000, 0.707107, -0.707107, 0.000000, 0.707107,
        0.743145, -0.999391, 0.694658, -0.719340, 0.034899, 0.669131,
        0.777146, -0.997564, 0.681998, -0.731354, 0.069756, 0.629320,
        0.809017, -0.994522, 0.669131, -0.743145, 0.104528, 0.587785,
        0.838671, -0.990268, 0.656059, -0.754710, 0.139173, 0.544639,
        0.866025, -0.984808, 0.642788, -0.766044, 0.173648, 0.500000,
        0.891007, -0.978148, 0.629320, -0.777146, 0.207912, 0.453990,
        0.913545, -0.970296, 0.615661, -0.788011, 0.241922, 0.406737,
        0.933580, -0.961262, 0.601815, -0.798636, 0.275637, 0.358368,
        0.951057, -0.951057, 0.587785, -0.809017, 0.309017, 0.309017,
        0.965926, -0.939693, 0.573576, -0.819152, 0.342020, 0.258819,
        0.978148, -0.927184, 0.559193, -0.829038, 0.374607, 0.207912,
        0.987688, -0.913545, 0.544639, -0.838671, 0.406737, 0.156434,
        0.994522, -0.898794, 0.529919, -0.848048, 0.438371, 0.104528,
        0.998630, -0.882948, 0.515038, -0.857167, 0.469472, 0.052336,
        1.000000, -0.866025, 0.500000, -0.866025, 0.500000, 0.000000,
        0.998630, -0.848048, 0.484810, -0.874620, 0.529919, -0.052336,
        0.994522, -0.829038, 0.469472, -0.882948, 0.559193, -0.104528,
        0.987688, -0.809017, 0.453990, -0.891007, 0.587785, -0.156434,
        0.978148, -0.788011, 0.438371, -0.898794, 0.615661, -0.207912,
        0.965926, -0.766044, 0.422618, -0.906308, 0.642788, -0.258819,
        0.951057, -0.743145, 0.406737, -0.913545, 0.669131, -0.309017,
        0.933580, -0.719340, 0.390731, -0.920505, 0.694658, -0.358368,
        0.913545, -0.694658, 0.374607, -0.927184, 0.719340, -0.406737,
        0.891007, -0.669131, 0.358368, -0.933580, 0.743145, -0.453990,
        0.866025, -0.642788, 0.342020, -0.939693, 0.766044, -0.500000,
        0.838671, -0.615661, 0.325568, -0.945519, 0.788011, -0.544639,
        0.809017, -0.587785, 0.309017, -0.951057, 0.809017, -0.587785,
        0.777146, -0.559193, 0.292372, -0.956305, 0.829038, -0.629320,
        0.743145, -0.529919, 0.275637, -0.961262, 0.848048, -0.669131,
        0.707107, -0.500000, 0.258819, -0.965926, 0.866025, -0.707107,
        0.669131, -0.469472, 0.241922, -0.970296, 0.882948, -0.743145,
        0.629320, -0.438371, 0.224951, -0.974370, 0.898794, -0.777146,
        0.587785, -0.406737, 0.207912, -0.978148, 0.913545, -0.809017,
        0.544639, -0.374607, 0.190809, -0.981627, 0.927184, -0.838671,
        0.500000, -0.342020, 0.173648, -0.984808, 0.939693, -0.866025,
        0.453990, -0.309017, 0.156434, -0.987688, 0.951057, -0.891007,
        0.406737, -0.275637, 0.139173, -0.990268, 0.961262, -0.913545,
        0.358368, -0.241922, 0.121869, -0.992546, 0.970296, -0.933580,
        0.309017, -0.207912, 0.104528, -0.994522, 0.978148, -0.951057,
        0.258819, -0.173648, 0.087156, -0.996195, 0.984808, -0.965926,
        0.207912, -0.139173, 0.069756, -0.997564, 0.990268, -0.978148,
        0.156434, -0.104528, 0.052336, -0.998630, 0.994522, -0.987688,
        0.104528, -0.069756, 0.034899, -0.999391, 0.997564, -0.994522,
        0.052336, -0.034899, 0.017452, -0.999848, 0.999391, -0.998630
        gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_180_359 fillarray \\
        0.000000, 0.000000, 0.000000, -1.000000, 1.000000, -1.000000,
        -0.052336, 0.034899, -0.017452, -0.999848, 0.999391, -0.998630,
        -0.104528, 0.069756, -0.034899, -0.999391, 0.997564, -0.994522,
        -0.156434, 0.104528, -0.052336, -0.998630, 0.994522, -0.987688,
        -0.207912, 0.139173, -0.069756, -0.997564, 0.990268, -0.978148,
        -0.258819, 0.173648, -0.087156, -0.996195, 0.984808, -0.965926,
        -0.309017, 0.207912, -0.104528, -0.994522, 0.978148, -0.951057,
        -0.358368, 0.241922, -0.121869, -0.992546, 0.970296, -0.933580,
        -0.406737, 0.275637, -0.139173, -0.990268, 0.961262, -0.913545,
        -0.453990, 0.309017, -0.156434, -0.987688, 0.951057, -0.891007,
        -0.500000, 0.342020, -0.173648, -0.984808, 0.939693, -0.866025,
        -0.544639, 0.374607, -0.190809, -0.981627, 0.927184, -0.838671,
        -0.587785, 0.406737, -0.207912, -0.978148, 0.913545, -0.809017,
        -0.629320, 0.438371, -0.224951, -0.974370, 0.898794, -0.777146,
        -0.669131, 0.469472, -0.241922, -0.970296, 0.882948, -0.743145,
        -0.707107, 0.500000, -0.258819, -0.965926, 0.866025, -0.707107,
        -0.743145, 0.529919, -0.275637, -0.961262, 0.848048, -0.669131,
        -0.777146, 0.559193, -0.292372, -0.956305, 0.829038, -0.629320,
        -0.809017, 0.587785, -0.309017, -0.951057, 0.809017, -0.587785,
        -0.838671, 0.615661, -0.325568, -0.945519, 0.788011, -0.544639,
        -0.866025, 0.642788, -0.342020, -0.939693, 0.766044, -0.500000,
        -0.891007, 0.669131, -0.358368, -0.933580, 0.743145, -0.453990,
        -0.913545, 0.694658, -0.374607, -0.927184, 0.719340, -0.406737,
        -0.933580, 0.719340, -0.390731, -0.920505, 0.694658, -0.358368,
        -0.951057, 0.743145, -0.406737, -0.913545, 0.669131, -0.309017,
        -0.965926, 0.766044, -0.422618, -0.906308, 0.642788, -0.258819,
        -0.978148, 0.788011, -0.438371, -0.898794, 0.615661, -0.207912,
        -0.987688, 0.809017, -0.453990, -0.891007, 0.587785, -0.156434,
        -0.994522, 0.829038, -0.469472, -0.882948, 0.559193, -0.104528,
        -0.998630, 0.848048, -0.484810, -0.874620, 0.529919, -0.052336,
        -1.000000, 0.866025, -0.500000, -0.866025, 0.500000, 0.000000,
        -0.998630, 0.882948, -0.515038, -0.857167, 0.469472, 0.052336,
        -0.994522, 0.898794, -0.529919, -0.848048, 0.438371, 0.104528,
        -0.987688, 0.913545, -0.544639, -0.838671, 0.406737, 0.156434,
        -0.978148, 0.927184, -0.559193, -0.829038, 0.374607, 0.207912,
        -0.965926, 0.939693, -0.573576, -0.819152, 0.342020, 0.258819,
        -0.951057, 0.951057, -0.587785, -0.809017, 0.309017, 0.309017,
        -0.933580, 0.961262, -0.601815, -0.798636, 0.275637, 0.358368,
        -0.913545, 0.970296, -0.615661, -0.788011, 0.241922, 0.406737,
        -0.891007, 0.978148, -0.629320, -0.777146, 0.207912, 0.453990,
        -0.866025, 0.984808, -0.642788, -0.766044, 0.173648, 0.500000,
        -0.838671, 0.990268, -0.656059, -0.754710, 0.139173, 0.544639,
        -0.809017, 0.994522, -0.669131, -0.743145, 0.104528, 0.587785,
        -0.777146, 0.997564, -0.681998, -0.731354, 0.069756, 0.629320,
        -0.743145, 0.999391, -0.694658, -0.719340, 0.034899, 0.669131,
        -0.707107, 1.000000, -0.707107, -0.707107, 0.000000, 0.707107,
        -0.669131, 0.999391, -0.719340, -0.694658, -0.034899, 0.743145,
        -0.629320, 0.997564, -0.731354, -0.681998, -0.069756, 0.777146,
        -0.587785, 0.994522, -0.743145, -0.669131, -0.104528, 0.809017,
        -0.544639, 0.990268, -0.754710, -0.656059, -0.139173, 0.838671,
        -0.500000, 0.984808, -0.766044, -0.642788, -0.173648, 0.866025,
        -0.453990, 0.978148, -0.777146, -0.629320, -0.207912, 0.891007,
        -0.406737, 0.970296, -0.788011, -0.615661, -0.241922, 0.913545,
        -0.358368, 0.961262, -0.798636, -0.601815, -0.275637, 0.933580,
        -0.309017, 0.951057, -0.809017, -0.587785, -0.309017, 0.951057,
        -0.258819, 0.939693, -0.819152, -0.573576, -0.342020, 0.965926,
        -0.207912, 0.927184, -0.829038, -0.559193, -0.374607, 0.978148,
        -0.156434, 0.913545, -0.838671, -0.544639, -0.406737, 0.987688,
        -0.104528, 0.898794, -0.848048, -0.529919, -0.438371, 0.994522,
        -0.052336, 0.882948, -0.857167, -0.515038, -0.469472, 0.998630,
        0.000000, 0.866025, -0.866025, -0.500000, -0.500000, 1.000000,
        0.052336, 0.848048, -0.874620, -0.484810, -0.529919, 0.998630,
        0.104528, 0.829038, -0.882948, -0.469472, -0.559193, 0.994522,
        0.156434, 0.809017, -0.891007, -0.453990, -0.587785, 0.987688,
        0.207912, 0.788011, -0.898794, -0.438371, -0.615661, 0.978148,
        0.258819, 0.766044, -0.906308, -0.422618, -0.642788, 0.965926,
        0.309017, 0.743145, -0.913545, -0.406737, -0.669131, 0.951057,
        0.358368, 0.719340, -0.920505, -0.390731, -0.694658, 0.933580,
        0.406737, 0.694658, -0.927184, -0.374607, -0.719340, 0.913545,
        0.453990, 0.669131, -0.933580, -0.358368, -0.743145, 0.891007,
        0.500000, 0.642788, -0.939693, -0.342020, -0.766044, 0.866025,
        0.544639, 0.615661, -0.945519, -0.325568, -0.788011, 0.838671,
        0.587785, 0.587785, -0.951057, -0.309017, -0.809017, 0.809017,
        0.629320, 0.559193, -0.956305, -0.292372, -0.829038, 0.777146,
        0.669131, 0.529919, -0.961262, -0.275637, -0.848048, 0.743145,
        0.707107, 0.500000, -0.965926, -0.258819, -0.866025, 0.707107,
        0.743145, 0.469472, -0.970296, -0.241922, -0.882948, 0.669131,
        0.777146, 0.438371, -0.974370, -0.224951, -0.898794, 0.629320,
        0.809017, 0.406737, -0.978148, -0.207912, -0.913545, 0.587785,
        0.838671, 0.374607, -0.981627, -0.190809, -0.927184, 0.544639,
        0.866025, 0.342020, -0.984808, -0.173648, -0.939693, 0.500000,
        0.891007, 0.309017, -0.987688, -0.156434, -0.951057, 0.453990,
        0.913545, 0.275637, -0.990268, -0.139173, -0.961262, 0.406737,
        0.933580, 0.241922, -0.992546, -0.121869, -0.970296, 0.358368,
        0.951057, 0.207912, -0.994522, -0.104528, -0.978148, 0.309017,
        0.965926, 0.173648, -0.996195, -0.087156, -0.984808, 0.258819,
        0.978148, 0.139173, -0.997564, -0.069756, -0.990268, 0.207912,
        0.987688, 0.104528, -0.998630, -0.052336, -0.994522, 0.156434,
        0.994522, 0.069756, -0.999391, -0.034899, -0.997564, 0.104528,
        0.998630, 0.034899, -0.999848, -0.017452, -0.999391, 0.052336,
        1.000000, 0.000000, -1.000000, 0.000000, -1.000000, 0.000000,
        0.998630, -0.034899, -0.999848, 0.017452, -0.999391, -0.052336,
        0.994522, -0.069756, -0.999391, 0.034899, -0.997564, -0.104528,
        0.987688, -0.104528, -0.998630, 0.052336, -0.994522, -0.156434,
        0.978148, -0.139173, -0.997564, 0.069756, -0.990268, -0.207912,
        0.965926, -0.173648, -0.996195, 0.087156, -0.984808, -0.258819,
        0.951057, -0.207912, -0.994522, 0.104528, -0.978148, -0.309017,
        0.933580, -0.241922, -0.992546, 0.121869, -0.970296, -0.358368,
        0.913545, -0.275637, -0.990268, 0.139173, -0.961262, -0.406737,
        0.891007, -0.309017, -0.987688, 0.156434, -0.951057, -0.453990,
        0.866025, -0.342020, -0.984808, 0.173648, -0.939693, -0.500000,
        0.838671, -0.374607, -0.981627, 0.190809, -0.927184, -0.544639,
        0.809017, -0.406737, -0.978148, 0.207912, -0.913545, -0.587785,
        0.777146, -0.438371, -0.974370, 0.224951, -0.898794, -0.629320,
        0.743145, -0.469472, -0.970296, 0.241922, -0.882948, -0.669131,
        0.707107, -0.500000, -0.965926, 0.258819, -0.866025, -0.707107,
        0.669131, -0.529919, -0.961262, 0.275637, -0.848048, -0.743145,
        0.629320, -0.559193, -0.956305, 0.292372, -0.829038, -0.777146,
        0.587785, -0.587785, -0.951057, 0.309017, -0.809017, -0.809017,
        0.544639, -0.615661, -0.945519, 0.325568, -0.788011, -0.838671,
        0.500000, -0.642788, -0.939693, 0.342020, -0.766044, -0.866025,
        0.453990, -0.669131, -0.933580, 0.358368, -0.743145, -0.891007,
        0.406737, -0.694658, -0.927184, 0.374607, -0.719340, -0.913545,
        0.358368, -0.719340, -0.920505, 0.390731, -0.694658, -0.933580,
        0.309017, -0.743145, -0.913545, 0.406737, -0.669131, -0.951057,
        0.258819, -0.766044, -0.906308, 0.422618, -0.642788, -0.965926,
        0.207912, -0.788011, -0.898794, 0.438371, -0.615661, -0.978148,
        0.156434, -0.809017, -0.891007, 0.453990, -0.587785, -0.987688,
        0.104528, -0.829038, -0.882948, 0.469472, -0.559193, -0.994522,
        0.052336, -0.848048, -0.874620, 0.484810, -0.529919, -0.998630,
        0.000000, -0.866025, -0.866025, 0.500000, -0.500000, -1.000000,
        -0.052336, -0.882948, -0.857167, 0.515038, -0.469472, -0.998630,
        -0.104528, -0.898794, -0.848048, 0.529919, -0.438371, -0.994522,
        -0.156434, -0.913545, -0.838671, 0.544639, -0.406737, -0.987688,
        -0.207912, -0.927184, -0.829038, 0.559193, -0.374607, -0.978148,
        -0.258819, -0.939693, -0.819152, 0.573576, -0.342020, -0.965926,
        -0.309017, -0.951057, -0.809017, 0.587785, -0.309017, -0.951057,
        -0.358368, -0.961262, -0.798636, 0.601815, -0.275637, -0.933580,
        -0.406737, -0.970296, -0.788011, 0.615661, -0.241922, -0.913545,
        -0.453990, -0.978148, -0.777146, 0.629320, -0.207912, -0.891007,
        -0.500000, -0.984808, -0.766044, 0.642788, -0.173648, -0.866025,
        -0.544639, -0.990268, -0.754710, 0.656059, -0.139173, -0.838671,
        -0.587785, -0.994522, -0.743145, 0.669131, -0.104528, -0.809017,
        -0.629320, -0.997564, -0.731354, 0.681998, -0.069756, -0.777146,
        -0.669131, -0.999391, -0.719340, 0.694658, -0.034899, -0.743145,
        -0.707107, -1.000000, -0.707107, 0.707107, 0.000000, -0.707107,
        -0.743145, -0.999391, -0.694658, 0.719340, 0.034899, -0.669131,
        -0.777146, -0.997564, -0.681998, 0.731354, 0.069756, -0.629320,
        -0.809017, -0.994522, -0.669131, 0.743145, 0.104528, -0.587785,
        -0.838671, -0.990268, -0.656059, 0.754710, 0.139173, -0.544639,
        -0.866025, -0.984808, -0.642788, 0.766044, 0.173648, -0.500000,
        -0.891007, -0.978148, -0.629320, 0.777146, 0.207912, -0.453990,
        -0.913545, -0.970296, -0.615661, 0.788011, 0.241922, -0.406737,
        -0.933580, -0.961262, -0.601815, 0.798636, 0.275637, -0.358368,
        -0.951057, -0.951057, -0.587785, 0.809017, 0.309017, -0.309017,
        -0.965926, -0.939693, -0.573576, 0.819152, 0.342020, -0.258819,
        -0.978148, -0.927184, -0.559193, 0.829038, 0.374607, -0.207912,
        -0.987688, -0.913545, -0.544639, 0.838671, 0.406737, -0.156434,
        -0.994522, -0.898794, -0.529919, 0.848048, 0.438371, -0.104528,
        -0.998630, -0.882948, -0.515038, 0.857167, 0.469472, -0.052336,
        -1.000000, -0.866025, -0.500000, 0.866025, 0.500000, 0.000000,
        -0.998630, -0.848048, -0.484810, 0.874620, 0.529919, 0.052336,
        -0.994522, -0.829038, -0.469472, 0.882948, 0.559193, 0.104528,
        -0.987688, -0.809017, -0.453990, 0.891007, 0.587785, 0.156434,
        -0.978148, -0.788011, -0.438371, 0.898794, 0.615661, 0.207912,
        -0.965926, -0.766044, -0.422618, 0.906308, 0.642788, 0.258819,
        -0.951057, -0.743145, -0.406737, 0.913545, 0.669131, 0.309017,
        -0.933580, -0.719340, -0.390731, 0.920505, 0.694658, 0.358368,
        -0.913545, -0.694658, -0.374607, 0.927184, 0.719340, 0.406737,
        -0.891007, -0.669131, -0.358368, 0.933580, 0.743145, 0.453990,
        -0.866025, -0.642788, -0.342020, 0.939693, 0.766044, 0.500000,
        -0.838671, -0.615661, -0.325568, 0.945519, 0.788011, 0.544639,
        -0.809017, -0.587785, -0.309017, 0.951057, 0.809017, 0.587785,
        -0.777146, -0.559193, -0.292372, 0.956305, 0.829038, 0.629320,
        -0.743145, -0.529919, -0.275637, 0.961262, 0.848048, 0.669131,
        -0.707107, -0.500000, -0.258819, 0.965926, 0.866025, 0.707107,
        -0.669131, -0.469472, -0.241922, 0.970296, 0.882948, 0.743145,
        -0.629320, -0.438371, -0.224951, 0.974370, 0.898794, 0.777146,
        -0.587785, -0.406737, -0.207912, 0.978148, 0.913545, 0.809017,
        -0.544639, -0.374607, -0.190809, 0.981627, 0.927184, 0.838671,
        -0.500000, -0.342020, -0.173648, 0.984808, 0.939693, 0.866025,
        -0.453990, -0.309017, -0.156434, 0.987688, 0.951057, 0.891007,
        -0.406737, -0.275637, -0.139173, 0.990268, 0.961262, 0.913545,
        -0.358368, -0.241922, -0.121869, 0.992546, 0.970296, 0.933580,
        -0.309017, -0.207912, -0.104528, 0.994522, 0.978148, 0.951057,
        -0.258819, -0.173648, -0.087156, 0.996195, 0.984808, 0.965926,
        -0.207912, -0.139173, -0.069756, 0.997564, 0.990268, 0.978148,
        -0.156434, -0.104528, -0.052336, 0.998630, 0.994522, 0.987688,
        -0.104528, -0.069756, -0.034899, 0.999391, 0.997564, 0.994522,
        -0.052336, -0.034899, -0.017452, 0.999848, 0.999391, 0.998630
        gi_AF_3D_Audio_SphericalHarmonicsElevationLookupTable fillarray \\
        -1.000000, 0.000000, 1.000000, 0.000000, 0.000000, -1.000000, 0.000000, 0.000000, 0.000000,
        -0.999848, 0.017452, 0.999543, -0.030224, 0.000264, -0.999086, 0.042733, -0.000590, 0.000004,
        -0.999391, 0.034899, 0.998173, -0.060411, 0.001055, -0.996348, 0.085356, -0.002357, 0.000034,
        -0.998630, 0.052336, 0.995891, -0.090524, 0.002372, -0.991791, 0.127757, -0.005297, 0.000113,
        -0.997564, 0.069756, 0.992701, -0.120527, 0.004214, -0.985429, 0.169828, -0.009400, 0.000268,
        -0.996195, 0.087156, 0.988606, -0.150384, 0.006578, -0.977277, 0.211460, -0.014654, 0.000523,
        -0.994522, 0.104528, 0.983611, -0.180057, 0.009462, -0.967356, 0.252544, -0.021043, 0.000903,
        -0.992546, 0.121869, 0.977722, -0.209511, 0.012862, -0.955693, 0.292976, -0.028547, 0.001431,
        -0.990268, 0.139173, 0.970946, -0.238709, 0.016774, -0.942316, 0.332649, -0.037143, 0.002131,
        -0.987688, 0.156434, 0.963292, -0.267617, 0.021193, -0.927262, 0.371463, -0.046806, 0.003026,
        -0.984808, 0.173648, 0.954769, -0.296198, 0.026114, -0.910569, 0.409317, -0.057505, 0.004140,
        -0.981627, 0.190809, 0.945388, -0.324419, 0.031530, -0.892279, 0.446114, -0.069209, 0.005492,
        -0.978148, 0.207912, 0.935159, -0.352244, 0.037436, -0.872441, 0.481759, -0.081880, 0.007105,
        -0.974370, 0.224951, 0.924096, -0.379641, 0.043823, -0.851105, 0.516162, -0.095481, 0.008999,
        -0.970296, 0.241922, 0.912211, -0.406574, 0.050685, -0.828326, 0.549233, -0.109969, 0.011193,
        -0.965926, 0.258819, 0.899519, -0.433013, 0.058013, -0.804164, 0.580889, -0.125300, 0.013707,
        -0.961262, 0.275637, 0.886036, -0.458924, 0.065797, -0.778680, 0.611050, -0.141427, 0.016556,
        -0.956305, 0.292372, 0.871778, -0.484275, 0.074029, -0.751940, 0.639639, -0.158301, 0.019758,
        -0.951057, 0.309017, 0.856763, -0.509037, 0.082698, -0.724012, 0.666583, -0.175868, 0.023329,
        -0.945519, 0.325568, 0.841008, -0.533178, 0.091794, -0.694969, 0.691816, -0.194075, 0.027281,
        -0.939693, 0.342020, 0.824533, -0.556670, 0.101306, -0.664885, 0.715274, -0.212865, 0.031630,
        -0.933580, 0.358368, 0.807359, -0.579484, 0.111222, -0.633837, 0.736898, -0.232180, 0.036385,
        -0.927184, 0.374607, 0.789505, -0.601592, 0.121529, -0.601904, 0.756637, -0.251960, 0.041559,
        -0.920505, 0.390731, 0.770994, -0.622967, 0.132217, -0.569169, 0.774442, -0.272143, 0.047160,
        -0.913545, 0.406737, 0.751848, -0.643582, 0.143271, -0.535715, 0.790270, -0.292666, 0.053196,
        -0.906308, 0.422618, 0.732091, -0.663414, 0.154678, -0.501627, 0.804083, -0.313464, 0.059674,
        -0.898794, 0.438371, 0.711746, -0.682437, 0.166423, -0.466993, 0.815850, -0.334472, 0.066599,
        -0.891007, 0.453990, 0.690839, -0.700629, 0.178494, -0.431899, 0.825544, -0.355623, 0.073974,
        -0.882948, 0.469472, 0.669395, -0.717968, 0.190875, -0.396436, 0.833145, -0.376851, 0.081803,
        -0.874620, 0.484810, 0.647439, -0.734431, 0.203551, -0.360692, 0.838638, -0.398086, 0.090085,
        -0.866025, 0.500000, 0.625000, -0.750000, 0.216506, -0.324760, 0.842012, -0.419263, 0.098821,
        -0.857167, 0.515038, 0.602104, -0.764655, 0.229726, -0.288728, 0.843265, -0.440311, 0.108009,
        -0.848048, 0.529919, 0.578778, -0.778378, 0.243192, -0.252688, 0.842399, -0.461164, 0.117644,
        -0.838671, 0.544639, 0.555052, -0.791154, 0.256891, -0.216730, 0.839422, -0.481753, 0.127722,
        -0.829038, 0.559193, 0.530955, -0.802965, 0.270803, -0.180944, 0.834347, -0.502011, 0.138237,
        -0.819152, 0.573576, 0.506515, -0.813798, 0.284914, -0.145420, 0.827194, -0.521871, 0.149181,
        -0.809017, 0.587785, 0.481763, -0.823639, 0.299204, -0.110246, 0.817987, -0.541266, 0.160545,
        -0.798636, 0.601815, 0.456728, -0.832477, 0.313658, -0.075508, 0.806757, -0.560132, 0.172317,
        -0.788011, 0.615661, 0.431441, -0.840301, 0.328257, -0.041294, 0.793541, -0.578405, 0.184487,
        -0.777146, 0.629320, 0.405934, -0.847101, 0.342984, -0.007686, 0.778379, -0.596021, 0.197040,
        -0.766044, 0.642788, 0.380236, -0.852869, 0.357821, 0.025233, 0.761319, -0.612921, 0.209963,
        -0.754710, 0.656059, 0.354380, -0.857597, 0.372749, 0.057383, 0.742412, -0.629044, 0.223238,
        -0.743145, 0.669131, 0.328396, -0.861281, 0.387751, 0.088686, 0.721714, -0.644334, 0.236850,
        -0.731354, 0.681998, 0.302317, -0.863916, 0.402807, 0.119068, 0.699288, -0.658734, 0.250778,
        -0.719340, 0.694658, 0.276175, -0.865498, 0.417901, 0.148454, 0.675199, -0.672190, 0.265005,
        -0.707107, 0.707107, 0.250000, -0.866025, 0.433013, 0.176777, 0.649519, -0.684653, 0.279508,
        -0.694658, 0.719340, 0.223825, -0.865498, 0.448125, 0.203969, 0.622322, -0.696073, 0.294267,
        -0.681998, 0.731354, 0.197683, -0.863916, 0.463218, 0.229967, 0.593688, -0.706405, 0.309259,
        -0.669131, 0.743145, 0.171604, -0.861281, 0.478275, 0.254712, 0.563700, -0.715605, 0.324459,
        -0.656059, 0.754710, 0.145620, -0.857597, 0.493276, 0.278147, 0.532443, -0.723633, 0.339844,
        -0.642788, 0.766044, 0.119764, -0.852869, 0.508205, 0.300221, 0.500009, -0.730451, 0.355387,
        -0.629320, 0.777146, 0.094066, -0.847101, 0.523041, 0.320884, 0.466490, -0.736025, 0.371063,
        -0.615661, 0.788011, 0.068559, -0.840301, 0.537768, 0.340093, 0.431982, -0.740324, 0.386845,
        -0.601815, 0.798636, 0.043272, -0.832477, 0.552367, 0.357807, 0.396584, -0.743320, 0.402704,
        -0.587785, 0.809017, 0.018237, -0.823639, 0.566821, 0.373991, 0.360397, -0.744989, 0.418613,
        -0.573576, 0.819152, -0.006515, -0.813798, 0.581112, 0.388612, 0.323524, -0.745308, 0.434544,
        -0.559193, 0.829038, -0.030955, -0.802965, 0.595222, 0.401645, 0.286069, -0.744262, 0.450467,
        -0.544639, 0.838671, -0.055052, -0.791154, 0.609135, 0.413066, 0.248140, -0.741835, 0.466352,
        -0.529919, 0.848048, -0.078778, -0.778378, 0.622833, 0.422856, 0.209843, -0.738017, 0.482171,
        -0.515038, 0.857167, -0.102104, -0.764655, 0.636300, 0.431004, 0.171288, -0.732801, 0.497894,
        -0.500000, 0.866025, -0.125000, -0.750000, 0.649519, 0.437500, 0.132583, -0.726184, 0.513490,
        -0.484810, 0.874620, -0.147439, -0.734431, 0.662474, 0.442340, 0.093837, -0.718167, 0.528929,
        -0.469472, 0.882948, -0.169395, -0.717968, 0.675150, 0.445524, 0.055160, -0.708753, 0.544183,
        -0.453990, 0.891007, -0.190839, -0.700629, 0.687531, 0.447059, 0.016662, -0.697950, 0.559220,
        -0.438371, 0.898794, -0.211746, -0.682437, 0.699602, 0.446953, -0.021550, -0.685769, 0.574011,
        -0.422618, 0.906308, -0.232091, -0.663414, 0.711348, 0.445222, -0.059368, -0.672226, 0.588528,
        -0.406737, 0.913545, -0.251848, -0.643582, 0.722755, 0.441884, -0.096684, -0.657339, 0.602741,
        -0.390731, 0.920505, -0.270994, -0.622967, 0.733809, 0.436964, -0.133395, -0.641130, 0.616621,
        -0.374607, 0.927184, -0.289505, -0.601592, 0.744496, 0.430488, -0.169397, -0.623624, 0.630141,
        -0.358368, 0.933580, -0.307359, -0.579484, 0.754804, 0.422491, -0.204589, -0.604851, 0.643273,
        -0.342020, 0.939693, -0.324533, -0.556670, 0.764720, 0.413008, -0.238872, -0.584843, 0.655990,
        -0.325568, 0.945519, -0.341008, -0.533178, 0.774231, 0.402081, -0.272150, -0.563635, 0.668267,
        -0.309017, 0.951057, -0.356763, -0.509037, 0.783327, 0.389754, -0.304329, -0.541266, 0.680078,
        -0.292372, 0.956305, -0.371778, -0.484275, 0.791997, 0.376077, -0.335319, -0.517778, 0.691399,
        -0.275637, 0.961262, -0.386036, -0.458924, 0.800228, 0.361102, -0.365034, -0.493216, 0.702207,
        -0.258819, 0.965926, -0.399519, -0.433013, 0.808013, 0.344885, -0.393389, -0.467627, 0.712478,
        -0.241922, 0.970296, -0.412211, -0.406574, 0.815340, 0.327486, -0.420306, -0.441061, 0.722191,
        -0.224951, 0.974370, -0.424096, -0.379641, 0.822202, 0.308969, -0.445709, -0.413572, 0.731327,
        -0.207912, 0.978148, -0.435159, -0.352244, 0.828589, 0.289399, -0.469527, -0.385215, 0.739866,
        -0.190809, 0.981627, -0.445388, -0.324419, 0.834495, 0.268846, -0.491693, -0.356047, 0.747790,
        -0.173648, 0.984808, -0.454769, -0.296198, 0.839912, 0.247382, -0.512145, -0.326129, 0.755082,
        -0.156434, 0.987688, -0.463292, -0.267617, 0.844832, 0.225081, -0.530827, -0.295521, 0.761728,
        -0.139173, 0.990268, -0.470946, -0.238709, 0.849251, 0.202020, -0.547684, -0.264287, 0.767712,
        -0.121869, 0.992546, -0.477722, -0.209511, 0.853163, 0.178279, -0.562672, -0.232494, 0.773023,
        -0.104528, 0.994522, -0.483611, -0.180057, 0.856563, 0.153937, -0.575747, -0.200207, 0.777648,
        -0.087156, 0.996195, -0.488606, -0.150384, 0.859447, 0.129078, -0.586872, -0.167494, 0.781579,
        -0.069756, 0.997564, -0.492701, -0.120527, 0.861811, 0.103786, -0.596018, -0.134426, 0.784806,
        -0.052336, 0.998630, -0.495891, -0.090524, 0.863653, 0.078146, -0.603158, -0.101071, 0.787324,
        -0.034899, 0.999391, -0.498173, -0.060411, 0.864971, 0.052243, -0.608272, -0.067500, 0.789126,
        -0.017452, 0.999848, -0.499543, -0.030224, 0.865762, 0.026165, -0.611347, -0.033786, 0.790208,
        0.000000, 1.000000, -0.500000, 0.000000, 0.866025, 0.000000, -0.612372, 0.000000, 0.790569,
        0.017452, 0.999848, -0.499543, 0.030224, 0.865762, -0.026165, -0.611347, 0.033786, 0.790208,
        0.034899, 0.999391, -0.498173, 0.060411, 0.864971, -0.052243, -0.608272, 0.067500, 0.789126,
        0.052336, 0.998630, -0.495891, 0.090524, 0.863653, -0.078146, -0.603158, 0.101071, 0.787324,
        0.069756, 0.997564, -0.492701, 0.120527, 0.861811, -0.103786, -0.596018, 0.134426, 0.784806,
        0.087156, 0.996195, -0.488606, 0.150384, 0.859447, -0.129078, -0.586872, 0.167494, 0.781579,
        0.104528, 0.994522, -0.483611, 0.180057, 0.856563, -0.153937, -0.575747, 0.200207, 0.777648,
        0.121869, 0.992546, -0.477722, 0.209511, 0.853163, -0.178279, -0.562672, 0.232494, 0.773023,
        0.139173, 0.990268, -0.470946, 0.238709, 0.849251, -0.202020, -0.547684, 0.264287, 0.767712,
        0.156434, 0.987688, -0.463292, 0.267617, 0.844832, -0.225081, -0.530827, 0.295521, 0.761728,
        0.173648, 0.984808, -0.454769, 0.296198, 0.839912, -0.247382, -0.512145, 0.326129, 0.755082,
        0.190809, 0.981627, -0.445388, 0.324419, 0.834495, -0.268846, -0.491693, 0.356047, 0.747790,
        0.207912, 0.978148, -0.435159, 0.352244, 0.828589, -0.289399, -0.469527, 0.385215, 0.739866,
        0.224951, 0.974370, -0.424096, 0.379641, 0.822202, -0.308969, -0.445709, 0.413572, 0.731327,
        0.241922, 0.970296, -0.412211, 0.406574, 0.815340, -0.327486, -0.420306, 0.441061, 0.722191,
        0.258819, 0.965926, -0.399519, 0.433013, 0.808013, -0.344885, -0.393389, 0.467627, 0.712478,
        0.275637, 0.961262, -0.386036, 0.458924, 0.800228, -0.361102, -0.365034, 0.493216, 0.702207,
        0.292372, 0.956305, -0.371778, 0.484275, 0.791997, -0.376077, -0.335319, 0.517778, 0.691399,
        0.309017, 0.951057, -0.356763, 0.509037, 0.783327, -0.389754, -0.304329, 0.541266, 0.680078,
        0.325568, 0.945519, -0.341008, 0.533178, 0.774231, -0.402081, -0.272150, 0.563635, 0.668267,
        0.342020, 0.939693, -0.324533, 0.556670, 0.764720, -0.413008, -0.238872, 0.584843, 0.655990,
        0.358368, 0.933580, -0.307359, 0.579484, 0.754804, -0.422491, -0.204589, 0.604851, 0.643273,
        0.374607, 0.927184, -0.289505, 0.601592, 0.744496, -0.430488, -0.169397, 0.623624, 0.630141,
        0.390731, 0.920505, -0.270994, 0.622967, 0.733809, -0.436964, -0.133395, 0.641130, 0.616621,
        0.406737, 0.913545, -0.251848, 0.643582, 0.722755, -0.441884, -0.096684, 0.657339, 0.602741,
        0.422618, 0.906308, -0.232091, 0.663414, 0.711348, -0.445222, -0.059368, 0.672226, 0.588528,
        0.438371, 0.898794, -0.211746, 0.682437, 0.699602, -0.446953, -0.021550, 0.685769, 0.574011,
        0.453990, 0.891007, -0.190839, 0.700629, 0.687531, -0.447059, 0.016662, 0.697950, 0.559220,
        0.469472, 0.882948, -0.169395, 0.717968, 0.675150, -0.445524, 0.055160, 0.708753, 0.544183,
        0.484810, 0.874620, -0.147439, 0.734431, 0.662474, -0.442340, 0.093837, 0.718167, 0.528929,
        0.500000, 0.866025, -0.125000, 0.750000, 0.649519, -0.437500, 0.132583, 0.726184, 0.513490,
        0.515038, 0.857167, -0.102104, 0.764655, 0.636300, -0.431004, 0.171288, 0.732801, 0.497894,
        0.529919, 0.848048, -0.078778, 0.778378, 0.622833, -0.422856, 0.209843, 0.738017, 0.482171,
        0.544639, 0.838671, -0.055052, 0.791154, 0.609135, -0.413066, 0.248140, 0.741835, 0.466352,
        0.559193, 0.829038, -0.030955, 0.802965, 0.595222, -0.401645, 0.286069, 0.744262, 0.450467,
        0.573576, 0.819152, -0.006515, 0.813798, 0.581112, -0.388612, 0.323524, 0.745308, 0.434544,
        0.587785, 0.809017, 0.018237, 0.823639, 0.566821, -0.373991, 0.360397, 0.744989, 0.418613,
        0.601815, 0.798636, 0.043272, 0.832477, 0.552367, -0.357807, 0.396584, 0.743320, 0.402704,
        0.615661, 0.788011, 0.068559, 0.840301, 0.537768, -0.340093, 0.431982, 0.740324, 0.386845,
        0.629320, 0.777146, 0.094066, 0.847101, 0.523041, -0.320884, 0.466490, 0.736025, 0.371063,
        0.642788, 0.766044, 0.119764, 0.852869, 0.508205, -0.300221, 0.500009, 0.730451, 0.355387,
        0.656059, 0.754710, 0.145620, 0.857597, 0.493276, -0.278147, 0.532443, 0.723633, 0.339844,
        0.669131, 0.743145, 0.171604, 0.861281, 0.478275, -0.254712, 0.563700, 0.715605, 0.324459,
        0.681998, 0.731354, 0.197683, 0.863916, 0.463218, -0.229967, 0.593688, 0.706405, 0.309259,
        0.694658, 0.719340, 0.223825, 0.865498, 0.448125, -0.203969, 0.622322, 0.696073, 0.294267,
        0.707107, 0.707107, 0.250000, 0.866025, 0.433013, -0.176777, 0.649519, 0.684653, 0.279508,
        0.719340, 0.694658, 0.276175, 0.865498, 0.417901, -0.148454, 0.675199, 0.672190, 0.265005,
        0.731354, 0.681998, 0.302317, 0.863916, 0.402807, -0.119068, 0.699288, 0.658734, 0.250778,
        0.743145, 0.669131, 0.328396, 0.861281, 0.387751, -0.088686, 0.721714, 0.644334, 0.236850,
        0.754710, 0.656059, 0.354380, 0.857597, 0.372749, -0.057383, 0.742412, 0.629044, 0.223238,
        0.766044, 0.642788, 0.380236, 0.852869, 0.357821, -0.025233, 0.761319, 0.612921, 0.209963,
        0.777146, 0.629320, 0.405934, 0.847101, 0.342984, 0.007686, 0.778379, 0.596021, 0.197040,
        0.788011, 0.615661, 0.431441, 0.840301, 0.328257, 0.041294, 0.793541, 0.578405, 0.184487,
        0.798636, 0.601815, 0.456728, 0.832477, 0.313658, 0.075508, 0.806757, 0.560132, 0.172317,
        0.809017, 0.587785, 0.481763, 0.823639, 0.299204, 0.110246, 0.817987, 0.541266, 0.160545,
        0.819152, 0.573576, 0.506515, 0.813798, 0.284914, 0.145420, 0.827194, 0.521871, 0.149181,
        0.829038, 0.559193, 0.530955, 0.802965, 0.270803, 0.180944, 0.834347, 0.502011, 0.138237,
        0.838671, 0.544639, 0.555052, 0.791154, 0.256891, 0.216730, 0.839422, 0.481753, 0.127722,
        0.848048, 0.529919, 0.578778, 0.778378, 0.243192, 0.252688, 0.842399, 0.461164, 0.117644,
        0.857167, 0.515038, 0.602104, 0.764655, 0.229726, 0.288728, 0.843265, 0.440311, 0.108009,
        0.866025, 0.500000, 0.625000, 0.750000, 0.216506, 0.324760, 0.842012, 0.419263, 0.098821,
        0.874620, 0.484810, 0.647439, 0.734431, 0.203551, 0.360692, 0.838638, 0.398086, 0.090085,
        0.882948, 0.469472, 0.669395, 0.717968, 0.190875, 0.396436, 0.833145, 0.376851, 0.081803,
        0.891007, 0.453990, 0.690839, 0.700629, 0.178494, 0.431899, 0.825544, 0.355623, 0.073974,
        0.898794, 0.438371, 0.711746, 0.682437, 0.166423, 0.466993, 0.815850, 0.334472, 0.066599,
        0.906308, 0.422618, 0.732091, 0.663414, 0.154678, 0.501627, 0.804083, 0.313464, 0.059674,
        0.913545, 0.406737, 0.751848, 0.643582, 0.143271, 0.535715, 0.790270, 0.292666, 0.053196,
        0.920505, 0.390731, 0.770994, 0.622967, 0.132217, 0.569169, 0.774442, 0.272143, 0.047160,
        0.927184, 0.374607, 0.789505, 0.601592, 0.121529, 0.601904, 0.756637, 0.251960, 0.041559,
        0.933580, 0.358368, 0.807359, 0.579484, 0.111222, 0.633837, 0.736898, 0.232180, 0.036385,
        0.939693, 0.342020, 0.824533, 0.556670, 0.101306, 0.664885, 0.715274, 0.212865, 0.031630,
        0.945519, 0.325568, 0.841008, 0.533178, 0.091794, 0.694969, 0.691816, 0.194075, 0.027281,
        0.951057, 0.309017, 0.856763, 0.509037, 0.082698, 0.724012, 0.666583, 0.175868, 0.023329,
        0.956305, 0.292372, 0.871778, 0.484275, 0.074029, 0.751940, 0.639639, 0.158301, 0.019758,
        0.961262, 0.275637, 0.886036, 0.458924, 0.065797, 0.778680, 0.611050, 0.141427, 0.016556,
        0.965926, 0.258819, 0.899519, 0.433013, 0.058013, 0.804164, 0.580889, 0.125300, 0.013707,
        0.970296, 0.241922, 0.912211, 0.406574, 0.050685, 0.828326, 0.549233, 0.109969, 0.011193,
        0.974370, 0.224951, 0.924096, 0.379641, 0.043823, 0.851105, 0.516162, 0.095481, 0.008999,
        0.978148, 0.207912, 0.935159, 0.352244, 0.037436, 0.872441, 0.481759, 0.081880, 0.007105,
        0.981627, 0.190809, 0.945388, 0.324419, 0.031530, 0.892279, 0.446114, 0.069209, 0.005492,
        0.984808, 0.173648, 0.954769, 0.296198, 0.026114, 0.910569, 0.409317, 0.057505, 0.004140,
        0.987688, 0.156434, 0.963292, 0.267617, 0.021193, 0.927262, 0.371463, 0.046806, 0.003026,
        0.990268, 0.139173, 0.970946, 0.238709, 0.016774, 0.942316, 0.332649, 0.037143, 0.002131,
        0.992546, 0.121869, 0.977722, 0.209511, 0.012862, 0.955693, 0.292976, 0.028547, 0.001431,
        0.994522, 0.104528, 0.983611, 0.180057, 0.009462, 0.967356, 0.252544, 0.021043, 0.000903,
        0.996195, 0.087156, 0.988606, 0.150384, 0.006578, 0.977277, 0.211460, 0.014654, 0.000523,
        0.997564, 0.069756, 0.992701, 0.120527, 0.004214, 0.985429, 0.169828, 0.009400, 0.000268,
        0.998630, 0.052336, 0.995891, 0.090524, 0.002372, 0.991791, 0.127757, 0.005297, 0.000113,
        0.999391, 0.034899, 0.998173, 0.060411, 0.001055, 0.996348, 0.085356, 0.002357, 0.000034,
        0.999848, 0.017452, 0.999543, 0.030224, 0.000264, 0.999086, 0.042733, 0.000590, 0.000004,
        1.000000, 0.000000, 1.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000, 0.000000
        gi_AF_3D_Audio_MaxReWeightsLookupTable fillarray \\
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.000000, 1.000000, 1.000000, 1.000000,
        1.003236, 1.002156, 0.999152, 0.990038,
        1.032370, 1.021194, 0.990433, 0.898572,
        1.062694, 1.040231, 0.979161, 0.799806,
        1.093999, 1.058954, 0.964976, 0.693603,
        1.126003, 1.077006, 0.947526, 0.579890,
        1.158345, 1.093982, 0.926474, 0.458690,
        1.190590, 1.109437, 0.901512, 0.330158,
        1.222228, 1.122890, 0.872370, 0.194621,
        1.252684, 1.133837, 0.838839, 0.052614,
        1.281987, 1.142358, 0.801199, 0.000000,
        1.312073, 1.150207, 0.760839, 0.000000,
        1.343011, 1.157424, 0.717799, 0.000000,
        1.374649, 1.163859, 0.671999, 0.000000,
        1.406809, 1.169354, 0.623371, 0.000000,
        1.439286, 1.173739, 0.571868, 0.000000,
        1.471846, 1.176837, 0.517465, 0.000000,
        1.504226, 1.178465, 0.460174, 0.000000,
        1.536133, 1.178438, 0.400043, 0.000000,
        1.567253, 1.176573, 0.337165, 0.000000,
        1.597247, 1.172695, 0.271688, 0.000000,
        1.625766, 1.166645, 0.203815, 0.000000,
        1.652455, 1.158285, 0.133806, 0.000000,
        1.676966, 1.147506, 0.061983, 0.000000,
        1.699006, 1.134261, 0.000000, 0.000000,
        1.720224, 1.119789, 0.000000, 0.000000,
        1.741631, 1.104810, 0.000000, 0.000000,
        1.763183, 1.089330, 0.000000, 0.000000,
        1.784837, 1.073356, 0.000000, 0.000000,
        1.806548, 1.056898, 0.000000, 0.000000,
        1.828269, 1.039968, 0.000000, 0.000000,
        1.849952, 1.022580, 0.000000, 0.000000,
        1.871552, 1.004752, 0.000000, 0.000000,
        1.893018, 0.986504, 0.000000, 0.000000,
        1.914305, 0.967857, 0.000000, 0.000000,
        1.935366, 0.948837, 0.000000, 0.000000,
        1.956154, 0.929471, 0.000000, 0.000000,
        1.976625, 0.909790, 0.000000, 0.000000,
        1.996736, 0.889823, 0.000000, 0.000000,
        2.016448, 0.869607, 0.000000, 0.000000,
        2.035721, 0.849175, 0.000000, 0.000000,
        2.054522, 0.828565, 0.000000, 0.000000,
        2.072818, 0.807816, 0.000000, 0.000000,
        2.090581, 0.786964, 0.000000, 0.000000,
        2.107785, 0.766051, 0.000000, 0.000000,
        2.124411, 0.745115, 0.000000, 0.000000,
        2.140439, 0.724196, 0.000000, 0.000000,
        2.155856, 0.703332, 0.000000, 0.000000,
        2.170653, 0.682561, 0.000000, 0.000000,
        2.184823, 0.661921, 0.000000, 0.000000,
        2.198364, 0.641445, 0.000000, 0.000000,
        2.211275, 0.621169, 0.000000, 0.000000,
        2.223562, 0.601125, 0.000000, 0.000000,
        2.235230, 0.581341, 0.000000, 0.000000,
        2.246289, 0.561847, 0.000000, 0.000000,
        2.256751, 0.542667, 0.000000, 0.000000,
        2.266631, 0.523826, 0.000000, 0.000000,
        2.275943, 0.505344, 0.000000, 0.000000,
        2.284707, 0.487239, 0.000000, 0.000000,
        2.292939, 0.469528, 0.000000, 0.000000,
        2.300661, 0.452225, 0.000000, 0.000000,
        2.307892, 0.435342, 0.000000, 0.000000,
        2.314654, 0.418888, 0.000000, 0.000000,
        2.320969, 0.402870, 0.000000, 0.000000,
        2.326858, 0.387294, 0.000000, 0.000000,
        2.332343, 0.372164, 0.000000, 0.000000,
        2.337445, 0.357481, 0.000000, 0.000000,
        2.342186, 0.343246, 0.000000, 0.000000,
        2.346585, 0.329458, 0.000000, 0.000000,
        2.350664, 0.316113, 0.000000, 0.000000,
        2.354442, 0.303208, 0.000000, 0.000000,
        2.357937, 0.290738, 0.000000, 0.000000,
        2.361168, 0.278698, 0.000000, 0.000000,
        2.364152, 0.267080, 0.000000, 0.000000,
        2.366906, 0.255878, 0.000000, 0.000000,
        2.369446, 0.245082, 0.000000, 0.000000,
        2.371786, 0.234685, 0.000000, 0.000000,
        2.373940, 0.224677, 0.000000, 0.000000,
        2.375923, 0.215048, 0.000000, 0.000000,
        2.377745, 0.205790, 0.000000, 0.000000,
        2.379421, 0.196891, 0.000000, 0.000000,
        2.380959, 0.188342, 0.000000, 0.000000,
        2.382372, 0.180132, 0.000000, 0.000000,
        2.383667, 0.172251, 0.000000, 0.000000,
        2.384856, 0.164689, 0.000000, 0.000000,
        2.385945, 0.157435, 0.000000, 0.000000,
        2.386943, 0.150479, 0.000000, 0.000000,
        2.387857, 0.143811, 0.000000, 0.000000,
        2.388694, 0.137421, 0.000000, 0.000000,
        2.389460, 0.131299, 0.000000, 0.000000,
        2.390160, 0.125435, 0.000000, 0.000000,
        2.390801, 0.119820, 0.000000, 0.000000,
        2.391386, 0.114445, 0.000000, 0.000000,
        2.391921, 0.109300, 0.000000, 0.000000,
        2.392410, 0.104376, 0.000000, 0.000000,
        2.392857, 0.099666, 0.000000, 0.000000,
        2.393265, 0.095160, 0.000000, 0.000000,
        2.393637, 0.090851, 0.000000, 0.000000,
        2.393977, 0.086731, 0.000000, 0.000000,
        2.394288, 0.082791, 0.000000, 0.000000,
        2.394571, 0.079025, 0.000000, 0.000000,
        2.394829, 0.075426, 0.000000, 0.000000,
        2.395064, 0.071986, 0.000000, 0.000000,
        2.395279, 0.068699, 0.000000, 0.000000,
        2.395475, 0.065558, 0.000000, 0.000000,
        2.395653, 0.062558, 0.000000, 0.000000,
        2.395816, 0.059693, 0.000000, 0.000000,
        2.395964, 0.056955, 0.000000, 0.000000,
        2.396099, 0.054341, 0.000000, 0.000000,
        2.396222, 0.051845, 0.000000, 0.000000,
        2.396334, 0.049462, 0.000000, 0.000000,
        2.396436, 0.047186, 0.000000, 0.000000,
        2.396529, 0.045013, 0.000000, 0.000000,
        2.396613, 0.042939, 0.000000, 0.000000,
        2.396691, 0.040959, 0.000000, 0.000000,
        2.396761, 0.039069, 0.000000, 0.000000,
        2.396825, 0.037266, 0.000000, 0.000000,
        2.396883, 0.035544, 0.000000, 0.000000,
        2.396936, 0.033901, 0.000000, 0.000000,
        2.396984, 0.032334, 0.000000, 0.000000,
        2.397028, 0.030838, 0.000000, 0.000000,
        2.397068, 0.029410, 0.000000, 0.000000,
        2.397104, 0.028048, 0.000000, 0.000000,
        2.397137, 0.026749, 0.000000, 0.000000,
        2.397167, 0.025509, 0.000000, 0.000000,
        2.397194, 0.024326, 0.000000, 0.000000,
        2.397219, 0.023198, 0.000000, 0.000000,
        2.397242, 0.022122, 0.000000, 0.000000,
        2.397262, 0.021095, 0.000000, 0.000000,
        2.397281, 0.020116, 0.000000, 0.000000,
        2.397298, 0.019181, 0.000000, 0.000000,
        2.397314, 0.018290, 0.000000, 0.000000,
        2.397328, 0.017441, 0.000000, 0.000000,
        2.397341, 0.016630, 0.000000, 0.000000,
        2.397352, 0.015857, 0.000000, 0.000000,
        2.397363, 0.015119, 0.000000, 0.000000,
        2.397372, 0.014416, 0.000000, 0.000000,
        2.397381, 0.013745, 0.000000, 0.000000,
        2.397389, 0.013106, 0.000000, 0.000000,
        2.397396, 0.012496, 0.000000, 0.000000,
        2.397403, 0.011914, 0.000000, 0.000000,
        2.397409, 0.011360, 0.000000, 0.000000,
        2.397414, 0.010831, 0.000000, 0.000000,
        2.397419, 0.010326, 0.000000, 0.000000,
        2.397424, 0.009845, 0.000000, 0.000000,
        2.397428, 0.009387, 0.000000, 0.000000,
        2.397432, 0.008949, 0.000000, 0.000000,
        2.397435, 0.008532, 0.000000, 0.000000,
        2.397438, 0.008135, 0.000000, 0.000000,
        2.397441, 0.007755, 0.000000, 0.000000,
        2.397443, 0.007394, 0.000000, 0.000000,
        2.397446, 0.007049, 0.000000, 0.000000,
        2.397448, 0.006721, 0.000000, 0.000000,
        2.397450, 0.006407, 0.000000, 0.000000,
        2.397451, 0.006108, 0.000000, 0.000000,
        2.397453, 0.005824, 0.000000, 0.000000,
        2.397454, 0.005552, 0.000000, 0.000000,
        2.397456, 0.005293, 0.000000, 0.000000,
        2.397457, 0.005046, 0.000000, 0.000000,
        2.397458, 0.004811, 0.000000, 0.000000,
        2.397459, 0.004586, 0.000000, 0.000000,
        2.397460, 0.004372, 0.000000, 0.000000,
        2.397461, 0.004168, 0.000000, 0.000000,
        2.397461, 0.003974, 0.000000, 0.000000,
        2.397462, 0.003788, 0.000000, 0.000000,
        2.397463, 0.003611, 0.000000, 0.000000,
        2.397463, 0.003443, 0.000000, 0.000000,
        2.397464, 0.003282, 0.000000, 0.000000,
        2.397464, 0.003129, 0.000000, 0.000000,
        2.397465, 0.002983, 0.000000, 0.000000,
        2.397465, 0.002844, 0.000000, 0.000000,
        2.397465, 0.002711, 0.000000, 0.000000,
        2.397466, 0.002584, 0.000000, 0.000000,
        2.397466, 0.002464, 0.000000, 0.000000,
        2.397466, 0.002349, 0.000000, 0.000000,
        2.397466, 0.002239, 0.000000, 0.000000,
        2.397467, 0.002135, 0.000000, 0.000000,
        2.397467, 0.002035, 0.000000, 0.000000,
        2.397467, 0.001940, 0.000000, 0.000000,
        2.397467, 0.001849, 0.000000, 0.000000,
        2.397467, 0.001763, 0.000000, 0.000000,
        2.397467, 0.001681, 0.000000, 0.000000,
        2.397468, 0.001602, 0.000000, 0.000000,
        2.397468, 0.001527, 0.000000, 0.000000,
        2.397468, 0.001456, 0.000000, 0.000000,
        2.397468, 0.001388, 0.000000, 0.000000,
        2.397468, 0.001323, 0.000000, 0.000000,
        2.397468, 0.001261, 0.000000, 0.000000,
        2.397468, 0.001202, 0.000000, 0.000000,
        2.397468, 0.001146, 0.000000, 0.000000,
        2.397468, 0.001093, 0.000000, 0.000000,
        2.397468, 0.001042, 0.000000, 0.000000,
        2.397468, 0.000993, 0.000000, 0.000000,
        2.397468, 0.000947, 0.000000, 0.000000,
        2.397468, 0.000902, 0.000000, 0.000000,
        2.397468, 0.000860, 0.000000, 0.000000,
        2.397468, 0.000820, 0.000000, 0.000000,
        2.397469, 0.000782, 0.000000, 0.000000,
        2.397469, 0.000745, 0.000000, 0.000000,
        2.397469, 0.000710, 0.000000, 0.000000,
        2.397469, 0.000677, 0.000000, 0.000000,
        2.397469, 0.000646, 0.000000, 0.000000,
        2.397469, 0.000616, 0.000000, 0.000000,
        2.397469, 0.000587, 0.000000, 0.000000,
        2.397469, 0.000559, 0.000000, 0.000000,
        2.397469, 0.000533, 0.000000, 0.000000,
        2.397469, 0.000508, 0.000000, 0.000000,
        2.397469, 0.000485, 0.000000, 0.000000,
        2.397469, 0.000462, 0.000000, 0.000000,
        2.397469, 0.000440, 0.000000, 0.000000,
        2.397469, 0.000420, 0.000000, 0.000000,
        2.397469, 0.000400, 0.000000, 0.000000,
        2.397469, 0.000381, 0.000000, 0.000000,
        2.397469, 0.000364, 0.000000, 0.000000,
        2.397469, 0.000347, 0.000000, 0.000000,
        2.397469, 0.000330, 0.000000, 0.000000,
        2.397469, 0.000315, 0.000000, 0.000000,
        2.397469, 0.000300, 0.000000, 0.000000,
        2.397469, 0.000286, 0.000000, 0.000000,
        2.397469, 0.000273, 0.000000, 0.000000,
        2.397469, 0.000260, 0.000000, 0.000000,
        2.397469, 0.000248, 0.000000, 0.000000,
        2.397469, 0.000236, 0.000000, 0.000000,
        2.397469, 0.000225, 0.000000, 0.000000,
        2.397469, 0.000215, 0.000000, 0.000000,
        2.397469, 0.000205, 0.000000, 0.000000,
        2.397469, 0.000195, 0.000000, 0.000000,
        2.397469, 0.000186, 0.000000, 0.000000,
        2.397469, 0.000177, 0.000000, 0.000000,
        2.397469, 0.000169, 0.000000, 0.000000,
        2.397469, 0.000161, 0.000000, 0.000000,
        2.397469, 0.000154, 0.000000, 0.000000,
        2.397469, 0.000147, 0.000000, 0.000000,
        2.397469, 0.000140, 0.000000, 0.000000,
        2.397469, 0.000133, 0.000000, 0.000000,
        2.397469, 0.000127, 0.000000, 0.000000,
        2.397469, 0.000121, 0.000000, 0.000000,
        2.397469, 0.000115, 0.000000, 0.000000,
        2.397469, 0.000110, 0.000000, 0.000000,
        2.397469, 0.000105, 0.000000, 0.000000,
        2.397469, 0.000100, 0.000000, 0.000000,
        2.397469, 0.000095, 0.000000, 0.000000,
        2.397469, 0.000091, 0.000000, 0.000000,
        2.397469, 0.000087, 0.000000, 0.000000,
        2.397469, 0.000083, 0.000000, 0.000000,
        2.397469, 0.000079, 0.000000, 0.000000,
        2.397469, 0.000075, 0.000000, 0.000000,
        2.397469, 0.000071, 0.000000, 0.000000,
        2.397469, 0.000068, 0.000000, 0.000000,
        2.397469, 0.000065, 0.000000, 0.000000,
        2.397469, 0.000062, 0.000000, 0.000000,
        2.397469, 0.000059, 0.000000, 0.000000,
        2.397469, 0.000056, 0.000000, 0.000000,
        2.397469, 0.000054, 0.000000, 0.000000,
        2.397469, 0.000051, 0.000000, 0.000000,
        2.397469, 0.000049, 0.000000, 0.000000,
        2.397469, 0.000046, 0.000000, 0.000000,
        2.397469, 0.000044, 0.000000, 0.000000,
        2.397469, 0.000042, 0.000000, 0.000000,
        2.397469, 0.000040, 0.000000, 0.000000,
        2.397469, 0.000038, 0.000000, 0.000000,
        2.397469, 0.000037, 0.000000, 0.000000,
        2.397469, 0.000035, 0.000000, 0.000000,
        2.397469, 0.000033, 0.000000, 0.000000,
        2.397469, 0.000032, 0.000000, 0.000000,
        2.397469, 0.000030, 0.000000, 0.000000,
        2.397469, 0.000029, 0.000000, 0.000000,
        2.397469, 0.000027, 0.000000, 0.000000,
        2.397469, 0.000026, 0.000000, 0.000000,
        2.397469, 0.000025, 0.000000, 0.000000,
        2.397469, 0.000024, 0.000000, 0.000000,
        2.397469, 0.000023, 0.000000, 0.000000,
        2.397469, 0.000022, 0.000000, 0.000000,
        2.397469, 0.000021, 0.000000, 0.000000,
        2.397469, 0.000020, 0.000000, 0.000000,
        2.397469, 0.000019, 0.000000, 0.000000,
        2.397469, 0.000018, 0.000000, 0.000000,
        2.397469, 0.000017, 0.000000, 0.000000,
        2.397469, 0.000016, 0.000000, 0.000000,
        2.397469, 0.000015, 0.000000, 0.000000,
        2.397469, 0.000015, 0.000000, 0.000000,
        2.397469, 0.000014, 0.000000, 0.000000,
        2.397469, 0.000013, 0.000000, 0.000000,
        2.397469, 0.000013, 0.000000, 0.000000,
        2.397469, 0.000012, 0.000000, 0.000000,
        2.397469, 0.000012, 0.000000, 0.000000,
        2.397469, 0.000011, 0.000000, 0.000000,
        2.397469, 0.000011, 0.000000, 0.000000,
        2.397469, 0.000010, 0.000000, 0.000000,
        2.397469, 0.000010, 0.000000, 0.000000,
        2.397469, 0.000009, 0.000000, 0.000000,
        2.397469, 0.000009, 0.000000, 0.000000,
        2.397469, 0.000008, 0.000000, 0.000000,
        2.397469, 0.000008, 0.000000, 0.000000,
        2.397469, 0.000008, 0.000000, 0.000000,
        2.397469, 0.000007, 0.000000, 0.000000,
        2.397469, 0.000007, 0.000000, 0.000000,
        2.397469, 0.000007, 0.000000, 0.000000,
        2.397469, 0.000006, 0.000000, 0.000000,
        2.397469, 0.000006, 0.000000, 0.000000,
        2.397469, 0.000006, 0.000000, 0.000000,
        2.397469, 0.000005, 0.000000, 0.000000,
        2.397469, 0.000005, 0.000000, 0.000000,
        2.397469, 0.000005, 0.000000, 0.000000,
        2.397469, 0.000005, 0.000000, 0.000000,
        2.397469, 0.000004, 0.000000, 0.000000,
        2.397469, 0.000004, 0.000000, 0.000000,
        2.397469, 0.000004, 0.000000, 0.000000,
        2.397469, 0.000004, 0.000000, 0.000000,
        2.397469, 0.000004, 0.000000, 0.000000,
        2.397469, 0.000004, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000003, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000002, 0.000000, 0.000000,
        2.397469, 0.000001, 0.000000, 0.000000,
        2.397469, 0.000001, 0.000000, 0.000000,
        2.397469, 0.000001, 0.000000, 0.000000
        gi_AF_3D_HrirChannel1TableNumber = ftgen(0, 0, 256, -2, -0.00006103515625, -0.00030517578125, -0.000152587890625, -0.00006103515625, -0.00006103515625, -0.000030517578125, -0.000152587890625, 0.0002441480755805969, -0.000244140625, 0.0007324442267417908, -0.00054931640625, -0.000152587890625, -0.0015869140625, -0.015716552734375, -0.030364990234375, 0.015167699195444584, 0.10705892741680145, 0.009491256438195705, -0.083709716796875, -0.0228271484375, -0.080078125, -0.020263671875, -0.088134765625, -0.195709228515625, -0.0167236328125, 0.018860438838601112, 0.22006897628307343, 0.1908627599477768, -0.02325439453125, 0.0949125662446022, 0.028321176767349243, 0.04104739427566528, 0.040162358433008194, 0.028901029378175735, 0.07693716138601303, 0.0013733329251408577, 0.011474959552288055, -0.056976318359375, -0.051513671875, -0.040557861328125, -0.0338134765625, 0.03588976711034775, 0.04699850454926491, 0.04666280001401901, -0.003173828125, 0.03308206424117088, 0.011749626137316227, 0.0014954069629311562, 0.024384289979934692, -0.007965087890625, 0.013733329251408577, -0.006927490234375, 0.0009765923023223877, -0.015899658203125, -0.01373291015625, 0.005920590832829475, -0.00872802734375, 0.006012146361172199, -0.011199951171875, -0.011810302734375, -0.01763916015625, -0.0096435546875, -0.010955810546875, -0.00994873046875, 0.0029908139258623123, -0.01617431640625, -0.011810302734375, -0.01617431640625, -0.01251220703125, -0.00775146484375, -0.002777099609375, -0.0096435546875, -0.016326904296875, -0.011810302734375, -0.021270751953125, -0.006500244140625, -0.0087890625, -0.00970458984375, -0.0089111328125, -0.01385498046875, -0.0135498046875, -0.01348876953125, -0.00848388671875, -0.0126953125, -0.003448486328125, -0.0123291015625, -0.014404296875, -0.00885009765625, -0.014862060546875, -0.008941650390625, -0.009307861328125, -0.01025390625, -0.012664794921875, -0.00958251953125, -0.014739990234375, -0.011627197265625, -0.007904052734375, -0.014312744140625, -0.006256103515625, -0.010711669921875, -0.011688232421875, -0.008697509765625, -0.01055908203125, -0.011138916015625, -0.0087890625, -0.00982666015625, -0.012939453125, -0.00750732421875, -0.01220703125, -0.009368896484375, -0.0068359375, -0.01116943359375, -0.00750732421875, -0.00762939453125, -0.00946044921875, -0.007843017578125, -0.006805419921875, -0.0107421875, -0.0069580078125, -0.007232666015625, -0.009307861328125, -0.00482177734375, -0.007568359375, -0.00665283203125, -0.00482177734375, -0.006683349609375, -0.0067138671875, -0.00494384765625, -0.007293701171875, -0.006744384765625, -0.004547119140625, -0.0078125, -0.0048828125, -0.005096435546875, -0.006805419921875, -0.00421142578125, -0.0050048828125, -0.005950927734375, -0.00421142578125, -0.004913330078125, -0.005889892578125, -0.003265380859375, -0.005523681640625, -0.0052490234375, -0.00360107421875, -0.00543212890625, -0.003814697265625, -0.004150390625, -0.005126953125, -0.004241943359375, -0.0040283203125, -0.005157470703125, -0.004669189453125, -0.004852294921875, -0.005462646484375, -0.003326416015625, -0.003662109375, -0.003936767578125, -0.002838134765625, -0.003143310546875, -0.00360107421875, -0.002471923828125, -0.002593994140625, -0.003082275390625, -0.0015869140625, -0.00286865234375, -0.002655029296875, -0.0018310546875, -0.003173828125, -0.0023193359375, -0.001922607421875, -0.00250244140625, -0.001708984375, -0.001617431640625, -0.002349853515625, -0.001312255859375, -0.001678466796875, -0.0020751953125, -0.000885009765625, -0.001800537109375, -0.001678466796875, -0.000946044921875, -0.001922607421875, -0.00152587890625, -0.000946044921875, -0.001861572265625, -0.0013427734375, -0.0009765625, -0.001922607421875, -0.001129150390625, -0.0010986328125, -0.001861572265625, -0.000946044921875, -0.00115966796875, -0.001708984375, -0.0008544921875, -0.001312255859375, -0.001617431640625, -0.00079345703125, -0.00140380859375, -0.001434326171875, -0.000823974609375, -0.00152587890625, -0.0013427734375, -0.0008544921875, -0.00152587890625, -0.00115966796875, -0.00091552734375, -0.001556396484375, -0.001007080078125, -0.001007080078125, -0.00146484375, -0.00091552734375, -0.001068115234375, -0.001373291015625, -0.0008544921875, -0.001129150390625, -0.001312255859375, -0.000762939453125, -0.001190185546875, -0.00115966796875, -0.00079345703125, -0.001220703125, -0.00103759765625, -0.00079345703125, -0.001220703125, -0.000946044921875, -0.000823974609375, -0.001190185546875, -0.0008544921875, -0.000885009765625, -0.001129150390625, -0.000762939453125, -0.000946044921875, -0.001068115234375, -0.000762939453125, -0.0009765625, -0.001007080078125, -0.000732421875, -0.0009765625, -0.000946044921875, -0.000732421875, -0.00103759765625, -0.000946044921875, -0.00091552734375, -0.001129150390625, -0.001068115234375, -0.0010986328125, -0.001190185546875, -0.001129150390625, -0.001129150390625, -0.001129150390625, -0.001068115234375, -0.00103759765625, -0.000946044921875, -0.000885009765625)
        gi_AF_3D_HrirChannel2TableNumber = ftgen(0, 0, 256, -2, 0.00006103701889514923, 0.0004882961511611938, 0.00033570360392332077, 0.0002136295661330223, 0.0003662221133708954, 0.000030518509447574615, 0.000030518509447574615, 0.00012207403779029846, -0.00018310546875, 0.0004882961511611938, -0.000762939453125, -0.0003662109375, -0.001953125, -0.015869140625, -0.03070068359375, 0.015167699195444584, 0.10660115629434586, 0.008941923268139362, -0.08404541015625, -0.023345947265625, -0.080413818359375, -0.020172119140625, -0.08746337890625, -0.19354248046875, -0.013214111328125, 0.023163549602031708, 0.22647786140441895, 0.20023193955421448, -0.008697509765625, 0.10782189667224884, 0.03305154666304588, 0.04687643051147461, 0.03650013729929924, 0.012421033345162868, 0.09137241542339325, 0.036805324256420135, 0.05389568954706192, 0.023438215255737305, 0.009552293457090855, 0.0060731833800673485, 0.0316171757876873, 0.019592883065342903, -0.0401611328125, -0.01239013671875, -0.059326171875, -0.062896728515625, -0.04583740234375, -0.018524169921875, -0.020660400390625, -0.03265380859375, -0.02691650390625, -0.06201171875, -0.025054931640625, -0.03277587890625, -0.012786865234375, -0.004058837890625, -0.024017333984375, -0.021942138671875, -0.04296875, -0.0152587890625, -0.021881103515625, -0.0098876953125, -0.017486572265625, -0.022064208984375, -0.0140380859375, -0.03271484375, -0.013671875, -0.0201416015625, -0.008270263671875, -0.013092041015625, -0.016082763671875, -0.016265869140625, -0.0196533203125, -0.005706787109375, -0.014801025390625, -0.002593994140625, -0.013336181640625, -0.011810302734375, -0.010986328125, -0.016876220703125, -0.0081787109375, -0.0113525390625, -0.00390625, -0.008087158203125, -0.00164794921875, -0.00860595703125, -0.007476806640625, -0.001220703125, -0.00689697265625, 0.0007019257172942162, -0.0050048828125, -0.001800537109375, -0.00250244140625, -0.00152587890625, -0.00042724609375, 0.00158696249127388, 0.0023499252274632454, -0.00244140625, 0.004028443247079849, -0.001800537109375, 0.0017090365290641785, 0.0036011841148138046, 0.0011291848495602608, 0.0032349620014429092, 0.0019226660951972008, 0.0014954069629311562, 0.00006103701889514923, 0.003326517529785633, -0.000152587890625, 0.0029908139258623123, 0.0017700735479593277, -0.0009765625, 0.00317392498254776, 0.00030518509447574615, 0.0023194067180156708, 0.003326517529785633, 0.00238044373691082, 0.0009155552834272385, 0.0027466658502817154, 0.0010986663401126862, 0.0005188146606087685, 0.002929776906967163, -0.001068115234375, 0.0013122959062457085, 0.0009765923023223877, -0.000396728515625, 0.0013122959062457085, 0.0008239997550845146, -0.00006103515625, 0.0012207403779029846, 0.0012817773967981339, -0.000335693359375, 0.002624591812491417, 0.00027466658502817154, 0.00006103701889514923, 0.0018921475857496262, -0.00048828125, 0.0006714072078466415, 0.0012512588873505592, -0.000091552734375, 0.0005798516795039177, 0.0016174810007214546, -0.000762939453125, 0.0007324442267417908, 0.0009155552834272385, -0.0003662109375, 0.00198370311409235, -0.000152587890625, -0.00030517578125, 0.0008545182645320892, -0.000396728515625, -0.000274658203125, 0.000030518509447574615, -0.001129150390625, -0.000457763671875, 0.0010681478306651115, 0.00009155552834272385, 0.0010071108117699623, 0.0010986663401126862, 0.0006408886983990669, 0.00119022186845541, 0.0009155552834272385, 0.0010681478306651115, 0.0014038514345884323, 0.0017090365290641785, 0.0010986663401126862, 0.0018005920574069023, 0.0015564439818263054, 0.0011291848495602608, 0.0021057771518826485, 0.0012817773967981339, 0.00119022186845541, 0.001739555038511753, 0.0010681478306651115, 0.00079348124563694, 0.0012817773967981339, 0.0006714072078466415, 0.0006103701889514923, 0.00119022186845541, 0.00033570360392332077, 0.0006103701889514923, 0.0007629627361893654, 0.0001831110566854477, 0.0006103701889514923, 0.0006714072078466415, 0.0002136295661330223, 0.0006103701889514923, 0.0004882961511611938, 0.000030518509447574615, 0.0006103701889514923, 0.00027466658502817154, 0.00006103701889514923, 0.0005493331700563431, 0.00012207403779029846, 0.00006103701889514923, 0.00039674062281847, -0.00006103515625, 0.00009155552834272385, 0.0003662221133708954, -0.00006103515625, 0.0001831110566854477, 0.00027466658502817154, -0.0001220703125, 0.0002136295661330223, 0.0002136295661330223, -0.0001220703125, 0.00027466658502817154, 0.00012207403779029846, -0.0001220703125, 0.0002441480755805969, -0.000030517578125, -0.000091552734375, 0.0002136295661330223, -0.00006103515625, -0.000030517578125, 0.0001831110566854477, -0.0001220703125, 0, 0.00015259254723787308, -0.000152587890625, 0.00006103701889514923, 0.00009155552834272385, -0.000152587890625, 0.00012207403779029846, 0.00006103701889514923, -0.000091552734375, 0.00015259254723787308, 0.000030518509447574615, -0.00006103515625, 0.0001831110566854477, 0, 0, 0.0001831110566854477, -0.000030517578125, 0.00006103701889514923, 0.00015259254723787308, -0.000030517578125, 0.00009155552834272385, 0.00015259254723787308, -0.000030517578125, 0.00012207403779029846, 0.00012207403779029846, -0.000030517578125, 0.00015259254723787308, 0.00009155552834272385, 0.000030518509447574615, 0.00012207403779029846, 0.00006103701889514923, 0.00006103701889514923, 0.00009155552834272385, 0.00006103701889514923, 0.00006103701889514923, 0.00006103701889514923, 0.00006103701889514923, 0.000030518509447574615, 0.000030518509447574615)
        gi_AF_3D_HrirChannel3TableNumber = ftgen(0, 0, 256, -2, 0, -0.000091552734375, -0.000030517578125, -0.000030517578125, -0.000030517578125, -0.000091552734375, 0.00006103701889514923, -0.000213623046875, 0.00006103701889514923, 0.00015259254723787308, -0.000396728515625, 0.00079348124563694, -0.001312255859375, 0.0008850367739796638, 0.00079348124563694, -0.01324462890625, -0.02490234375, 0.06173894554376602, 0.07873775064945221, -0.1392822265625, -0.029449462890625, 0.10599078238010406, -0.098602294921875, 0.043214209377765656, 0.06701864302158356, -0.06231689453125, -0.0352783203125, -0.023162841796875, 0.1662953644990921, 0.008117923513054848, -0.161590576171875, -0.0062255859375, 0.036927394568920135, 0.04596087336540222, 0.027588732540607452, 0.0473952442407608, -0.049652099609375, -0.07379150390625, 0.0033570360392332077, -0.030792236328125, 0.04058961570262909, 0.016510512679815292, -0.02166748046875, 0.0002136295661330223, -0.00927734375, 0.025025177747011185, 0.011932737194001675, 0.013733329251408577, 0.004791405983269215, -0.007720947265625, -0.00054931640625, -0.006744384765625, 0.008880886249244213, 0.007721182890236378, 0.005310220643877983, 0.004577776417136192, 0.0003662221133708954, -0.009429931640625, -0.004058837890625, 0.01229895930737257, 0.006561479531228542, 0.0028992583975195885, 0.0024109622463583946, 0.00039674062281847, -0.010345458984375, -0.005950927734375, 0.00027466658502817154, 0.0009155552834272385, 0.007293923757970333, -0.005523681640625, -0.005828857421875, -0.0009765625, -0.003814697265625, 0.0023499252274632454, 0.006164738908410072, -0.000091552734375, 0.0005188146606087685, 0.005401776172220707, -0.00335693359375, -0.00213623046875, 0.0002441480755805969, -0.001251220703125, 0.002288888208568096, -0.000579833984375, -0.001922607421875, 0, -0.002288818359375, -0.0048828125, 0.00238044373691082, 0.0006714072078466415, -0.00262451171875, 0.0025635547935962677, -0.002593994140625, -0.001861572265625, 0.0013733329251408577, -0.0015869140625, -0.00054931640625, 0.0005493331700563431, -0.002716064453125, -0.00189208984375, 0.0012512588873505592, -0.002349853515625, 0.0009460737928748131, 0.0016479995101690292, -0.00299072265625, 0.0007629627361893654, -0.000244140625, -0.0015869140625, 0.00198370311409235, 0.0004272591322660446, -0.0008544921875, 0.00198370311409235, 0.00033570360392332077, -0.0001220703125, 0.0032349620014429092, 0.0001831110566854477, -0.0001220703125, 0.0018005920574069023, -0.001007080078125, 0.00015259254723787308, 0.0010986663401126862, -0.001617431640625, 0.0006103701889514923, 0.0016174810007214546, -0.00146484375, 0.0009155552834272385, 0.0006714072078466415, -0.00201416015625, 0.0007324442267417908, 0.00027466658502817154, -0.000946044921875, 0.001037629321217537, -0.00042724609375, -0.00103759765625, 0.0010986663401126862, -0.000762939453125, -0.0006103515625, 0.0013733329251408577, -0.0013427734375, -0.00030517578125, 0.0011291848495602608, -0.001495361328125, 0.00012207403779029846, 0.0006408886983990669, -0.001678466796875, 0.00033570360392332077, 0.0006408886983990669, -0.00079345703125, 0.00027466658502817154, -0.000579833984375, -0.00030517578125, 0.00030518509447574615, -0.000885009765625, 0.00030518509447574615, -0.000030517578125, -0.001220703125, 0.00033570360392332077, 0.0004272591322660446, -0.00054931640625, -0.000244140625, -0.00048828125, -0.000244140625, 0.00012207403779029846, -0.000335693359375, 0.00012207403779029846, -0.000244140625, -0.000762939453125, 0, -0.000335693359375, -0.000579833984375, 0.00015259254723787308, -0.000518798828125, -0.00067138671875, 0.0002136295661330223, -0.0006103515625, -0.0003662109375, 0.0001831110566854477, -0.000640869140625, 0.000030518509447574615, 0.0001831110566854477, -0.000518798828125, 0.00009155552834272385, 0.00006103701889514923, -0.000518798828125, 0.0001831110566854477, 0.000030518509447574615, -0.00054931640625, 0.0001831110566854477, -0.00018310546875, -0.000396728515625, 0.00027466658502817154, -0.000244140625, -0.000244140625, 0.0002136295661330223, -0.0003662109375, -0.000213623046875, 0.0002136295661330223, -0.0003662109375, -0.000091552734375, 0.00009155552834272385, -0.000457763671875, -0.000030517578125, -0.000030517578125, -0.000396728515625, 0.000030518509447574615, -0.000091552734375, -0.000335693359375, 0.00006103701889514923, -0.000152587890625, -0.00030517578125, 0.00009155552834272385, -0.000213623046875, -0.000213623046875, 0.00009155552834272385, -0.000244140625, -0.000152587890625, 0.000030518509447574615, -0.000244140625, -0.000091552734375, 0.000030518509447574615, -0.000274658203125, -0.000030517578125, -0.000030517578125, -0.000244140625, 0, -0.000091552734375, -0.000213623046875, 0, -0.0001220703125, -0.00018310546875, 0, -0.000152587890625, -0.0001220703125, 0, -0.00018310546875, -0.0001220703125, -0.000030517578125, -0.00018310546875, -0.00006103515625, -0.00006103515625, -0.000152587890625, -0.000030517578125, -0.00006103515625, -0.000152587890625, -0.000030517578125, -0.000091552734375, -0.000091552734375, -0.00006103515625, -0.000091552734375, -0.000091552734375, -0.00006103515625, -0.000091552734375, -0.000091552734375, -0.00006103515625, -0.00006103515625, -0.00006103515625)
        gi_AF_3D_HrirChannel4TableNumber = ftgen(0, 0, 256, -2, 0, 0.00006103701889514923, 0.000030518509447574615, 0.000030518509447574615, 0.000030518509447574615, 0, -0.00006103515625, 0, -0.0001220703125, 0.00012207403779029846, 0, -0.000213623046875, 0.00012207403779029846, -0.00152587890625, 0.00198370311409235, 0.004119998775422573, -0.012054443359375, -0.012847900390625, 0.05807672441005707, 0.02063051238656044, -0.117279052734375, 0.00634784996509552, 0.03814813494682312, -0.06744384765625, 0.05313272401690483, -0.01190185546875, -0.018157958984375, 0.12521743774414062, 0.049714650958776474, 0.010071108117699623, -0.02020263671875, -0.06134033203125, -0.04681396484375, 0.0024414807558059692, 0.0070192571729421616, -0.021942138671875, 0.009155552834272385, -0.02557373046875, -0.000030517578125, 0.02459791861474514, -0.01641845703125, 0.009033478796482086, 0.015350810252130032, 0.0013733329251408577, 0.004425183869898319, 0.027985472232103348, -0.0045166015625, -0.023895263671875, -0.005767822265625, -0.022003173828125, -0.003173828125, 0.010925626382231712, 0.01730399578809738, -0.00482177734375, -0.0244140625, -0.0068359375, -0.006805419921875, 0.003814813680946827, 0.006286812946200371, -0.0010986328125, -0.004913330078125, -0.0035400390625, -0.007598876953125, -0.005645751953125, 0.008880886249244213, 0.004577776417136192, 0.007751701399683952, 0.007110812701284885, -0.005340576171875, -0.00543212890625, 0.00030518509447574615, -0.001739501953125, 0.0037537766620516777, 0.003997924737632275, -0.009246826171875, -0.00091552734375, -0.000579833984375, -0.00262451171875, 0.0054322946816682816, -0.000732421875, -0.004302978515625, -0.000457763671875, -0.00274658203125, -0.004852294921875, 0.0012817773967981339, -0.001708984375, 0.00009155552834272385, 0.004425183869898319, -0.003204345703125, -0.0001220703125, 0.0023499252274632454, -0.003173828125, 0.00012207403779029846, 0.001831110566854477, -0.003509521484375, 0.0012512588873505592, 0.0012207403779029846, -0.003143310546875, 0.0025940733030438423, -0.0003662109375, -0.0025634765625, 0.0025025177747011185, -0.00054931640625, -0.0020751953125, 0.003265480510890484, -0.000396728515625, -0.001312255859375, 0.003326517529785633, -0.001983642578125, -0.0003662109375, 0.0023194067180156708, -0.0015869140625, 0.0014954069629311562, 0.002227851189672947, -0.002166748046875, 0.00033570360392332077, 0.0004882961511611938, -0.0035400390625, 0.001037629321217537, -0.000030517578125, -0.002227783203125, 0.0025940733030438423, -0.00018310546875, -0.000732421875, 0.0028077028691768646, -0.000213623046875, -0.00067138671875, 0.0016785180196166039, -0.001861572265625, -0.000732421875, 0.00119022186845541, -0.002410888671875, 0.0004272591322660446, 0.0009765923023223877, -0.0018310546875, 0.00119022186845541, 0.0006714072078466415, -0.001678466796875, 0.00119022186845541, -0.000152587890625, -0.00146484375, 0.0016174810007214546, -0.0010986328125, -0.0008544921875, 0.0016785180196166039, -0.00140380859375, -0.0003662109375, 0.0014648884534835815, -0.001251220703125, -0.00030517578125, 0.0010986663401126862, -0.001190185546875, 0.00009155552834272385, 0.0006714072078466415, -0.001129150390625, 0.0005188146606087685, 0.0007629627361893654, -0.00018310546875, 0.0008239997550845146, 0.0004272591322660446, -0.00048828125, 0.0005493331700563431, 0.00015259254723787308, -0.000335693359375, 0.00079348124563694, 0, -0.000030517578125, 0.0007629627361893654, -0.000030517578125, 0.00015259254723787308, 0.0006408886983990669, 0, 0.00033570360392332077, 0.0006408886983990669, 0.000030518509447574615, 0.0005493331700563431, 0.00033570360392332077, -0.00006103515625, 0.0005493331700563431, 0.00015259254723787308, 0.00006103701889514923, 0.0006714072078466415, 0.00006103701889514923, 0, 0.0005798516795039177, -0.000091552734375, 0.00012207403779029846, 0.0004882961511611938, -0.000244140625, 0.00015259254723787308, 0.00033570360392332077, -0.000274658203125, 0.0002441480755805969, 0.00030518509447574615, -0.000213623046875, 0.0004272591322660446, 0.0002441480755805969, -0.000152587890625, 0.0004272591322660446, 0.00009155552834272385, -0.000091552734375, 0.00045777764171361923, 0.000030518509447574615, -0.000030517578125, 0.00039674062281847, -0.00006103515625, 0.00006103701889514923, 0.00039674062281847, -0.0001220703125, 0.00012207403779029846, 0.00030518509447574615, -0.000152587890625, 0.0001831110566854477, 0.0002136295661330223, -0.000152587890625, 0.0002136295661330223, 0.00012207403779029846, -0.0001220703125, 0.00027466658502817154, 0.00006103701889514923, -0.000091552734375, 0.00027466658502817154, -0.000030517578125, -0.000030517578125, 0.0002441480755805969, -0.00006103515625, 0, 0.0002136295661330223, -0.000091552734375, 0.00006103701889514923, 0.0001831110566854477, -0.0001220703125, 0.00012207403779029846, 0.00012207403779029846, -0.000091552734375, 0.00015259254723787308, 0.00006103701889514923, -0.00006103515625, 0.00015259254723787308, 0.000030518509447574615, -0.000030517578125, 0.0001831110566854477, 0, 0.000030518509447574615, 0.00012207403779029846, 0, 0.000030518509447574615, 0.00009155552834272385, 0, 0.00006103701889514923, 0.00006103701889514923, 0.000030518509447574615, 0.00006103701889514923, 0.00006103701889514923, 0.000030518509447574615, 0.000030518509447574615)
         #define X #0#
         #define Y #1#
         #define Z #2#
         #define R #0#
         #define T #1#
         #define AF_FALSE #0#
         #define AF_TRUE #1#
         #define AF_EPSILON_FLOAT #0.00000001#
         #define AF_MATH__PI #3.1419527#
         #define AF_MATH__PI2 #6.2831853#
         #define AF_MATH__PI_OVER_180 #0.01745329#
         #define AF_MATH__180_OVER_PI #57.29577951#
         #define AF_MATH__DEGREES_TO_RADIANS #$AF_MATH__PI_OVER_180#
         #define AF_MATH__RADIANS_TO_DEGREES #$AF_MATH__180_OVER_PI#
         #define AF_3D_FRAME_DURATION #0.01666667#
         #define AF_3D_FRAME_DURATION_OVER_2 #0.05#
        opcode AF_FuzzyEqual, k, kk
            k_a, k_b xin
            k_equal = $AF_TRUE
            if ($AF_EPSILON_FLOAT < abs(k_b - k_a)) then
                k_equal = $AF_FALSE
            endif
            xout k_equal
        endop
        opcode AF_Math_RadiansFromDegrees, k, k
            k_degrees xin
            xout k_degrees * $AF_MATH__DEGREES_TO_RADIANS
        endop
        opcode AF_Math_DegreesFromRadians, k, k
            k_radians xin
            xout k_radians * $AF_MATH__DEGREES_TO_RADIANS
        endop
        opcode AF_Math_Sin, k, k
            k_degrees xin
            xout sin(AF_Math_RadiansFromDegrees(k_degrees))
        endop
        opcode AF_Math_Cos, k, k
            k_degrees xin
            xout cos(AF_Math_RadiansFromDegrees(k_degrees))
        endop
        opcode AF_GetInstrumentId, S, 0
            xout sprintf("[%.0f,%d]", p1, (p1 - floor(p1)) * 1000)
        endop
        opcode AF_SendInstrumentOnMessage, 0, Sij
            S_instrumentId, i_startTime, i_duration xin
            if (-1 == i_duration) then
                prints("{\\"csd\\":{\\"i\\":{\\"id\\":%s,\\"on\\":1,\\"startTime\\":%f}}}\\n", S_instrumentId, i_startTime)
            else
                prints("{\\"csd\\":{\\"i\\":{\\"id\\":%s,\\"on\\":1,\\"startTime\\":%f,\\"duration\\":%f}}}\\n", S_instrumentId,
                    i_startTime, i_duration)
            endif
        endop
        opcode AF_CreateKChannel, 0, So
            S_channelName, i_defaultValue xin
            chn_k S_channelName, 3, 0, i_defaultValue
        endop
        opcode AF_GetKChannel, k, S
            S_channelName xin
            k_channelValue chnget S_channelName
            xout k_channelValue
        endop
        opcode AF_SetKChannel, 0, Sk
            S_channelName, k_channelValue xin
            chnset k_channelValue, S_channelName
        endop
        opcode math_roundFloat_k, k, ki
            k_inputFloat, i_decimalPlaces xin
            k_outputFloat = k_inputFloat
            if (i_decimalPlaces == 0) then
                k_outputFloat = round(k_inputFloat)
            else
                i_10ToTheDecimalPlacesPower = pow(10, i_decimalPlaces)
                k_outputFloat = int(k_inputFloat)
                k_outputFloat += int(round(frac(k_inputFloat) * i_10ToTheDecimalPlacesPower)) / i_10ToTheDecimalPlacesPower
            endif
            xout k_outputFloat
        endop
        giFastSquareMaxI init 101
        giFastSquareTable ftgen 0, 0, giFastSquareMaxI, 2, 0
        instr math_InitFastSquareTable
            iI = 0
            while (iI < giFastSquareMaxI) do
                tablew(iI * iI, iI, giFastSquareTable)
                iI += 1
            od
            turnoff
        endin
        scoreline_i("i \\"math_InitFastSquareTable\\" 0 -1")
        opcode math_fastSquare, i, i
            ii xin
            xout tablei(ii, giFastSquareTable)
        endop
        opcode math_fastSquare, k, k
            ki xin
            xout tablei(ki, giFastSquareTable)
        endop
        giFastSqrtMaxI init 10001
        giFastSqrtTable ftgen 0, 0, giFastSqrtMaxI, 2, 0
        instr math_InitFastSqrtTables
            iI = 0
            while (iI < giFastSqrtMaxI) do
                tablew(sqrt(iI), iI, giFastSqrtTable)
                iI += 1
            od
            turnoff
        endin
        scoreline_i("i \\"math_InitFastSqrtTables\\" 0 -1")
        opcode math_fastSqrt, i, i
            ii xin
            xout tablei(ii, giFastSqrtTable)
        endop
        opcode math_fastSqrt, k, k
            ki xin
            xout tablei(ki, giFastSqrtTable)
        endop
        opcode math_rytToXyz, i[], iii
            iR, iY, iT xin
            iXyz[] init 3
            iXyz[$X] = iR * sin(iT)
            iXyz[$Y] = iY
            iXyz[$Z] = iR * cos(iT)
            xout iXyz
        endop
        opcode time_i, i, 0
            xout (i(gk_i) + 1) / kr
        endop
        opcode time_k, k, 0
            xout gk_i / kr
        endop
        opcode time_string_i, S, 0
            i_time = time_i()
            i_hours = floor(i_time / 3600)
            i_ = i_time - (3600 * i_hours)
            i_minutes = floor(i_ / 60)
            i_seconds = floor(i_ - (60 * i_minutes))
            i_nanoseconds = 10000 * frac(i_time)
            xout sprintf("%d:%02d:%02d.%04d", i_hours, i_minutes, i_seconds, i_nanoseconds)
        endop
        opcode time_string_k, S, 0
            k_time = time_k()
            k_hours = floor(k_time / 3600)
            k_ = k_time - (3600 * k_hours)
            k_minutes = floor(k_ / 60)
            k_seconds = floor(k_ - (60 * k_minutes))
            k_nanoseconds = 10000 * frac(k_time)
            xout sprintfk("%d:%02d:%02d.%04d", k_hours, k_minutes, k_seconds, k_nanoseconds)
        endop
        opcode time_metro, k, i
            i_cps xin
            k_returnValue init 0
            i_secondsPerTick = 1 / i_cps
            i_startTime = time_i()
            k_nextTickTime init i_startTime
            k_currentTime = time_k()
            if (k_nextTickTime < k_currentTime) then
                k_returnValue = 1
                k_nextTickTime += i_secondsPerTick
            else
                k_returnValue = 0
            endif
            xout k_returnValue
        endop
         #define AF_3D_AUDIO__AMBISONIC_ORDER_MAX #3#
         #define AF_3D_AUDIO__SPEED_OF_SOUND #343#
        gi_AF_3D_ListenerMatrixTableNumber ftgen 1, 0, 16, -2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
        gk_AF_3D_ListenerRotationMatrix[] init 9
        gk_AF_3D_ListenerPosition[] init 3
         opcode AF_3D_Audio_AzimuthLookupTableRow, k, k
            k_azimuth xin
            k_azimuth = round(k_azimuth % 360)
            if (k_azimuth < 0) then
                k_azimuth += 360
            elseif (360 <= k_azimuth) then
                k_azimuth -= 360
            endif
            xout k_azimuth
         endop
         opcode AF_3D_Audio_ElevationLookupTableRow, k, k
            k_elevation xin
            xout min(round(min(90, max(-90, k_elevation))) + 90, 179)
         endop
         opcode AF_3D_Audio_MaxReWeightsLookupTableRow, k, k
            k_sourceWidth xin
            xout min(max(0, round(k_sourceWidth)), 359)
         endop
         gkAmbisonicChannelGains[] init 4
        opcode AF_3D_Audio_ChannelGains, 0, kkkp
            kSourceAzimuth, k_elevation, k_sourceWidth, i_ambisonicOrder xin
            kListenerAzimuth = (cosinv(gk_AF_3D_ListenerRotationMatrix[2])) * $AF_MATH__RADIANS_TO_DEGREES
            if (gk_AF_3D_ListenerRotationMatrix[0] < 0) then
                kListenerAzimuth = 360 - kListenerAzimuth
            endif
            k_azimuth = (kSourceAzimuth + 180) % 360
            if (k_azimuth < 0) then
                k_azimuth += 360
            endif
            k_azimuthRow = AF_3D_Audio_AzimuthLookupTableRow(k_azimuth)
            k_elevationRow = AF_3D_Audio_ElevationLookupTableRow(k_elevation)
            k_spreadRow = AF_3D_Audio_MaxReWeightsLookupTableRow(k_sourceWidth)
            gkAmbisonicChannelGains[0] = gi_AF_3D_Audio_MaxReWeightsLookupTable[k_spreadRow][0]
            k_i = 1
            while (k_i <= i_ambisonicOrder) do
                k_degreeWeight = gi_AF_3D_Audio_MaxReWeightsLookupTable[k_spreadRow][k_i]
                k_j = -k_i
                while (k_j <= k_i) do
                    k_channel = (k_i * k_i) + k_i + k_j
                    k_elevationColumn = k_i * (k_i + 1) / 2 + abs(k_j) - 1
                    k_gain = gi_AF_3D_Audio_SphericalHarmonicsElevationLookupTable[k_elevationRow][k_elevationColumn]
                    if (k_j != 0) then
                        if (k_j < 0) then
                            k_azimuthColumn = $AF_3D_AUDIO__AMBISONIC_ORDER_MAX + k_j
                        else
                            k_azimuthColumn = $AF_3D_AUDIO__AMBISONIC_ORDER_MAX + k_j - 1
                        endif
                        if (k_azimuthRow < 180) then
                            k_gain *= gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_000_179 [k_azimuthRow][k_azimuthColumn]
                        else
                            k_gain *= gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_180_359 [k_azimuthRow - 180][k_azimuthColumn]
                        endif
                    endif
                    gkAmbisonicChannelGains[k_channel] = k_degreeWeight * k_gain
                    k_j += 1
                od
                k_i += 1
            od
        endop
        opcode AF_3D_Audio_ChannelGains, 0, i[]kp
            i_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
            k_direction[] = fillarray(i_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
                i_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
                i_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
            k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
            k_elevation = taninv2(k_direction[$Z],
                sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES
            AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
        endop
        opcode AF_3D_Audio_ChannelGains, 0, k[]kp
            k_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
            k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
                k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
                k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
            k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
            k_elevation = taninv2(k_direction[$Z],
                sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES
            AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
        endop
        opcode AF_3D_Audio_ChannelGains_XYZ, 0, kkkPp
            k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin
            k_direction[] init 3
            k_direction[$X] = k_sourcePositionX - gk_AF_3D_ListenerPosition[$X]
            k_direction[$Y] = k_sourcePositionY - gk_AF_3D_ListenerPosition[$Y]
            k_direction[$Z] = k_sourcePositionZ - gk_AF_3D_ListenerPosition[$Z]
            k_azimuth = taninv2(k_direction[$X], -k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
            k_elevation = taninv2(k_direction[$Z],
                sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES
            AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
        endop
        opcode AF_3D_Audio_ChannelGains_RTZ, 0, kkkPp
            k_sourcePositionR, k_sourcePositionT, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin
            k_sourcePositionX = k_sourcePositionR * cos(k_sourcePositionT)
            k_sourcePositionY = k_sourcePositionR * sin(k_sourcePositionT)
            k_elevation = taninv2(k_sourcePositionZ, k_sourcePositionR) * $AF_MATH__RADIANS_TO_DEGREES
            AF_3D_Audio_ChannelGains_XYZ(k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth,
                i_ambisonicOrder)
        endop
        giDistanceAttenuationTable = ftgen(0, 0, 251, 25, 0, 1, 5, 1, 250, 0.00001)
        opcode AF_3D_Audio_DistanceAttenuation, k, kpp
            kDistance, iReferenceDistance, iRolloffFactor xin
            kAttenuation = k(iReferenceDistance) / ((max(kDistance, iReferenceDistance) - iReferenceDistance) * iRolloffFactor + iReferenceDistance)
            xout kAttenuation
        endop
        opcode AF_3D_Audio_DistanceAttenuation, k, kk
            kDistance, kMaxDistance xin
            xout tablei(kDistance / kMaxDistance, giDistanceAttenuationTable, 1)
        endop
        opcode AF_3D_Audio_DistanceAttenuation_i, i, iii
            i_distance, i_minDistance, i_maxDistance xin
            i_linearFadeOutDistance = i_maxDistance - 1
            if (i_linearFadeOutDistance < i_distance) then
                i_fadeOutDistance = i_distance - i_linearFadeOutDistance
                if (i_fadeOutDistance < 1) then
                    i_linearFadeFrom = 1 / i_maxDistance
                    i_gain = i_linearFadeFrom * (1 - i_fadeOutDistance)
                else
                    i_gain = 0
                endif
            else
                i_gain = 1 / (max(i_minDistance, i_distance) + 1)
            endif
            xout i_gain
        endop
        opcode AF_3D_Audio_SourceDistance, k, iii
            iSourcePositionX, iSourcePositionY, iSourcePositionZ xin
            kVector[] init 3
            kVector[$X] = iSourcePositionX - gk_AF_3D_ListenerPosition[$X]
            kVector[$Y] = iSourcePositionY - gk_AF_3D_ListenerPosition[$Y]
            kVector[$Z] = iSourcePositionZ - gk_AF_3D_ListenerPosition[$Z]
            xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
        endop
        opcode AF_3D_Audio_SourceDistance, k, kkk
            kSourcePositionX, kSourcePositionY, kSourcePositionZ xin
            kVector[] init 3
            kVector[$X] = kSourcePositionX - gk_AF_3D_ListenerPosition[$X]
            kVector[$Y] = kSourcePositionY - gk_AF_3D_ListenerPosition[$Y]
            kVector[$Z] = kSourcePositionZ - gk_AF_3D_ListenerPosition[$Z]
            xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
        endop
        opcode AF_3D_Audio_SourceDistance, k, i[]
            iSourcePosition[] xin
            kVector[] init 3
            kVector[$X] = iSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X]
            kVector[$Y] = iSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y]
            kVector[$Z] = iSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z]
            xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
        endop
        opcode AF_3D_Audio_SourceDistance, k, k[]
            kSourcePosition[] xin
            kVector[] init 3
            kVector[$X] = kSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X]
            kVector[$Y] = kSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y]
            kVector[$Z] = kSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z]
            xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
        endop
        opcode AF_3D_Audio_SourceDirection, k[], k[]
            k_sourcePosition[] xin
            k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
                k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
                k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
            k_distance = sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y] + k_direction[$Z] * k_direction[$Z])
            if (0 < k_distance) then
                k_direction /= k_distance
            endif
            xout k_direction
        endop
        opcode AF_3D_Audio_DopplerShift, k, kkk
            k_previousDistance, k_currentDistance, k_deltaTime xin
            k_dopplerShift init 1
            if (0 < k_deltaTime) then
                k_deltaDistance = k_currentDistance - k_previousDistance
                k_velocity = k_deltaDistance / k_deltaTime
                k_dopplerShift = port($AF_3D_AUDIO__SPEED_OF_SOUND / ($AF_3D_AUDIO__SPEED_OF_SOUND + k_velocity),
                    $AF_3D_FRAME_DURATION_OVER_2, 1)
            endif
            xout k_dopplerShift
        endop
        opcode AF_3D_UpdateListenerRotationMatrix, 0, i
            i_portamento_halftime xin
            gk_AF_3D_ListenerRotationMatrix[0] = port(tab:k(0, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[1] = port(tab:k(1, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[2] = port(tab:k(2, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[3] = port(tab:k(4, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[4] = port(tab:k(5, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[5] = port(tab:k(6, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[6] = port(tab:k(8, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[7] = port(tab:k(9, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerRotationMatrix[8] = port(tab:k(10, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
        endop
        opcode AF_3D_UpdateListenerPosition, 0, i
            i_portamento_halftime xin
            kX = tab:k(12, gi_AF_3D_ListenerMatrixTableNumber)
            kY = tab:k(13, gi_AF_3D_ListenerMatrixTableNumber)
            kZ = tab:k(14, gi_AF_3D_ListenerMatrixTableNumber)
            gk_AF_3D_ListenerPosition[0] = port(kX, i_portamento_halftime)
            gk_AF_3D_ListenerPosition[1] = port(kY, i_portamento_halftime)
            gk_AF_3D_ListenerPosition[2] = port(kZ, i_portamento_halftime)
        endop
        ga_AF_3D_AmbisonicOutput[] init 4
        opcode AF_Ambisonics_Send, 0, ai[]P
            a_signal, i_position[], k_width xin
            AF_3D_Audio_ChannelGains(i_position, k_width)
            ga_AF_3D_AmbisonicOutput[0] = ga_AF_3D_AmbisonicOutput[0] + (gkAmbisonicChannelGains[0] * a_signal)
            ga_AF_3D_AmbisonicOutput[1] = ga_AF_3D_AmbisonicOutput[1] + (gkAmbisonicChannelGains[1] * a_signal)
            ga_AF_3D_AmbisonicOutput[2] = ga_AF_3D_AmbisonicOutput[2] + (gkAmbisonicChannelGains[2] * a_signal)
            ga_AF_3D_AmbisonicOutput[3] = ga_AF_3D_AmbisonicOutput[3] + (gkAmbisonicChannelGains[3] * a_signal)
        endop
        opcode AF_Ambisonics_Send, 0, ak[]P
            a_signal, k_position[], k_width xin
            AF_3D_Audio_ChannelGains(k_position, k_width)
            ga_AF_3D_AmbisonicOutput[0] = ga_AF_3D_AmbisonicOutput[0] + (gkAmbisonicChannelGains[0] * a_signal)
            ga_AF_3D_AmbisonicOutput[1] = ga_AF_3D_AmbisonicOutput[1] + (gkAmbisonicChannelGains[1] * a_signal)
            ga_AF_3D_AmbisonicOutput[2] = ga_AF_3D_AmbisonicOutput[2] + (gkAmbisonicChannelGains[2] * a_signal)
            ga_AF_3D_AmbisonicOutput[3] = ga_AF_3D_AmbisonicOutput[3] + (gkAmbisonicChannelGains[3] * a_signal)
        endop
        ga_AF_Reverb_Send init 0
        opcode AF_Reverb_Send, 0, a
            a_signal xin
            ga_AF_Reverb_Send += a_signal
        endop
        gi_instrumentCount = 1
        gi_instrumentIndexOffset = 0
        gaInstrumentSignals[][] init gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
        gi_auxCount = 1
        gi_auxIndexOffset = 0
        giAuxChannelIndexRanges[][][] init gi_auxCount, gi_instrumentCount, 2
        ga_auxVolumes[][][] init gi_auxCount, gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
        ga_auxSignals[][] init gi_auxCount, $INTERNAL_CHANNEL_COUNT
        gi_trackCount = gi_instrumentCount + gi_auxCount
        giMasterChannelIndexRanges[][] init gi_trackCount, 2
        ga_masterVolumes[][] init gi_trackCount, $INTERNAL_CHANNEL_COUNT
        ga_masterSignals[] init $INTERNAL_CHANNEL_COUNT
        instr 1
            AF_3D_UpdateListenerRotationMatrix(0.01)
            AF_3D_UpdateListenerPosition(0.01)
        endin
        instr 2
            gi_instrumentCount = p4
            gi_instrumentIndexOffset = p5
            gi_auxCount = p6
            gi_auxIndexOffset = p7
            gi_trackCount = gi_instrumentCount + gi_auxCount
            a_instrumentSignals[][] init gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
            gaInstrumentSignals = a_instrumentSignals
            iAuxChannelIndexRanges[][][] init gi_auxCount, gi_instrumentCount, 2
            iI = 0
            while (iI < gi_auxCount) do
                iJ = 0
                while (iJ < gi_instrumentCount) do
                    iAuxChannelIndexRanges[iI][iJ][0] = 0
                    iAuxChannelIndexRanges[iI][iJ][1] = $INTERNAL_CHANNEL_COUNT - 1
                    iJ += 1
                od
                iI += 1
            od
            giAuxChannelIndexRanges = iAuxChannelIndexRanges
            a_auxVolumes[][][] init gi_auxCount, gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
            ga_auxVolumes = a_auxVolumes
            a_auxSignals[][] init gi_auxCount, $INTERNAL_CHANNEL_COUNT
            ga_auxSignals = a_auxSignals
            iMasterChannelIndexRanges[][] init gi_trackCount, 2
            iI = 0
            while (iI < gi_trackCount) do
                iMasterChannelIndexRanges[iI][0] = 0
                iMasterChannelIndexRanges[iI][1] = $INTERNAL_CHANNEL_COUNT - 1
                iI += 1
            od
            giMasterChannelIndexRanges = iMasterChannelIndexRanges
            a_masterVolumes[][] init gi_trackCount, $INTERNAL_CHANNEL_COUNT
            ga_masterVolumes = a_masterVolumes
            a_masterSignals[] init $INTERNAL_CHANNEL_COUNT
            ga_masterSignals = a_masterSignals
            event_i("i", 3, 0, -1)
            event_i("i", 6, 1, -1)
            event_i("i", 10, 1, -1)
            turnoff
        endin
        instr 3
            gk_i += 1
            k_instrument = 0
            while (k_instrument < gi_instrumentCount) do
                k_channel = 0
                while (k_channel < $INTERNAL_CHANNEL_COUNT) do
                    gaInstrumentSignals[k_instrument][k_channel] = 0
                    k_channel += 1
                od
                k_instrument += 1
            od
            k_bus = 0
            while (k_bus < gi_auxCount) do
                k_channel = 0
                while (k_channel < $INTERNAL_CHANNEL_COUNT) do
                    ga_auxSignals[k_bus][k_channel] = 0
                    k_channel += 1
                od
                k_bus += 1
            od
            k_channel = 0
            while (k_channel < $INTERNAL_CHANNEL_COUNT) do
                ga_masterSignals[k_channel] = 0
                k_channel += 1
            od
        endin
         #ifdef IS_GENERATING_JSON
            giWriteComma init 0
            gSPluginUuids[][] init 1000, 100
            opcode setPluginUuid, 0, iiS
                iTrackIndex, iPluginIndex, SUuid xin
                gSPluginUuids[iTrackIndex][iPluginIndex] = SUuid
            endop
            instr StartJsonArray
                turnoff
                fprints("DawPlayback.json", "[")
            endin
            instr EndJsonArray
                turnoff
                fprints("DawPlayback.json", "]")
            endin
            instr StartJsonObject
                turnoff
                fprints("DawPlayback.json", "{")
            endin
            instr EndJsonObject
                turnoff
                fprints("DawPlayback.json", "}")
            endin
            instr GeneratePluginJson
                turnoff
                SPluginUuid = strget(p4)
                if (giWriteComma == 1) then
                    fprints("DawPlayback.json", ",")
                else
                    giWriteComma = 1
                endif
                fprints("DawPlayback.json", sprintf("\\"%s\\":[", SPluginUuid))
                iI = 0
                iWriteComma = 0
                while (1 == 1) do
                    SFileName = sprintf("json/%s.%d.json", SPluginUuid, iI)
                    iJ = 0
                    while (iJ != -1) do
                        SLine, iJ readfi SFileName
                        if (iJ == -1) then
                        else
                            if (iWriteComma == 1) then
                                fprints("DawPlayback.json", ",")
                            else
                                iWriteComma = 1
                            endif
                            if (strcmp(strsub(SLine, strlen(SLine) - 1, strlen(SLine)), "\\n") == 0) then
                                SLine = strsub(SLine, 0, strlen(SLine) - 1)
                            endif
                            fprints("DawPlayback.json", SLine)
                        endif
                    od
                    iI += 1
                od
            endin
            instr GenerateJson
                prints("instr GenerateJson ...\\n")
                scoreline_i("i \\"StartJsonObject\\" 0 0")
                iI = 0
                while (iI < 1000) do
                    if (strlen(gSPluginUuids[iI][0]) == 36) then
                        scoreline_i(sprintf("i \\"GeneratePluginJson\\" 0 0 \\"%s\\"", gSPluginUuids[iI][0]))
                        scoreline_i("i \\"EndJsonArray\\" 0 0")
                    endif
                    iI += 1
                od
                scoreline_i("i \\"EndJsonObject\\" 0 0")
                prints("instr GenerateJson - done\\n")
            endin
         #end
         #ifndef ADSR_LINSEGR_UDO_ORC
         #define ADSR_LINSEGR_UDO_ORC ##
        opcode adsr_linsegr, a, iiii
            iA, iD, iS, iR xin
            iA = max(0.000001, iA)
            iD = max(0.000001, iD)
            iR = max(0.000001, iR)
            aOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
            xout aOut
        endop
        opcode adsr_linsegr, k, kkkk
            iA, iD, iS, iR xin
            iA = max(0.000001, iA)
            iD = max(0.000001, iD)
            iR = max(0.000001, iR)
            kOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
            xout kOut
        endop
         #end
        gSCcInfo_DistanceDelaySynth[] = fillarray( \\
        \\
            "example", "bool", "false", "synced", \\
        \\
            "", "", "", "")
         #define gSCcInfo_DistanceDelaySynth_Count #8#
         #define CC_INFO_CHANNEL #0#
         #define CC_INFO_TYPE #1#
         #define CC_INFO_VALUE #2#
         #define CC_INFO_SYNC_TYPE #3#
         #define CC_NO_SYNC #0#
         #define CC_SYNC_TO_CHANNEL #1#
         #ifdef gSCcInfo_DistanceDelaySynth_Count
            if (lenarray(gSCcInfo_DistanceDelaySynth) == $gSCcInfo_DistanceDelaySynth_Count) then
                giCcCount_DistanceDelaySynth = (lenarray(gSCcInfo_DistanceDelaySynth) / 4) - 1
                reshapearray(gSCcInfo_DistanceDelaySynth, giCcCount_DistanceDelaySynth + 1, 4)
            endif
         #else
            giCcCount_DistanceDelaySynth = (lenarray(gSCcInfo_DistanceDelaySynth) / 4) - 1
            reshapearray(gSCcInfo_DistanceDelaySynth, giCcCount_DistanceDelaySynth + 1, 4)
         #end
        opcode ccIndex_DistanceDelaySynth, i, S
            SChannel xin
            kgoto end
            iI = 0
            while (iI < giCcCount_DistanceDelaySynth) do
                if (strcmp(gSCcInfo_DistanceDelaySynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
                iI += 1
            od
            iI = -1
        end:
            xout iI
        endop
        giCcValueDefaults_DistanceDelaySynth[] init giCcCount_DistanceDelaySynth
        giCcValues_DistanceDelaySynth[][] init 1, giCcCount_DistanceDelaySynth
        gkCcValues_DistanceDelaySynth[][] init 1, giCcCount_DistanceDelaySynth
        gkCcSyncTypes_DistanceDelaySynth[][] init 1, giCcCount_DistanceDelaySynth
        instr DistanceDelaySynth_InitializeCcValues
            iI = 0
            while (iI < giCcCount_DistanceDelaySynth) do
                SType = gSCcInfo_DistanceDelaySynth[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_DistanceDelaySynth[iI][$CC_INFO_VALUE]
                iJ = 0
                while (iJ < 1) do
                    iValue = -1
                    if (strcmp(SType, "bool") == 0) then
                        if (strcmp(SValue, "false") == 0) then
                            iValue = 0
                        else
                            iValue = 1
                        endif
                    elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
                        iValue = strtod(SValue)
                    endif
                    giCcValueDefaults_DistanceDelaySynth[iI] = iValue
                    giCcValues_DistanceDelaySynth[iJ][iI] = iValue
                    iJ += 1
                od
                iI += 1
            od
            igoto end
            kI = 0
            while (kI < giCcCount_DistanceDelaySynth) do
                SType = gSCcInfo_DistanceDelaySynth[kI][$CC_INFO_TYPE]
                SValue = gSCcInfo_DistanceDelaySynth[kI][$CC_INFO_VALUE]
                SSyncType = gSCcInfo_DistanceDelaySynth[kI][$CC_INFO_SYNC_TYPE]
                kJ = 0
                while (kJ < 1) do
                    kValue = -1
                    if (strcmpk(SType, "bool") == 0) then
                        if (strcmpk(SValue, "false") == 0) then
                            kValue = 0
                        else
                            kValue = 1
                        endif
                    elseif (strcmpk(SType, "number") == 0 && strcmpk(SValue, "") != 0) then
                        kValue = strtodk(SValue)
                    endif
                    gkCcValues_DistanceDelaySynth[kJ][kI] = kValue
                    gkCcSyncTypes_DistanceDelaySynth[kJ][kI] = $CC_NO_SYNC
                    if (strcmpk(SSyncType, "synced") == 0) then
                        gkCcSyncTypes_DistanceDelaySynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
                    endif
                    kJ += 1
                od
                kI += 1
            od
            turnoff
        end:
        endin
        event_i("i", "DistanceDelaySynth_InitializeCcValues", 0, -1)
        instr DistanceDelaySynth_CreateCcIndexes
            giCc_DistanceDelaySynth_example init ccIndex_DistanceDelaySynth("example")
            turnoff
        endin
        event_i("i", "DistanceDelaySynth_CreateCcIndexes", 0, -1)
        giDistanceDelaySynth_StartDistance = 60
        giDistanceDelaySynth_DelayDistance = 100
        giDistanceDelaySynth_NoteNumberToHeightScale = 5
        giDistanceDelaySynth_DelayTime = 0.5
        giDistanceDelaySynth_Duration = 0.49
        giDistanceDelaySynth_DelayCount = 5
        giDistanceDelaySynth_MaxAmpWhenVeryClose = 0.5
        giDistanceDelaySynth_ReferenceDistance = 2
        giDistanceDelaySynth_RolloffFactor = 0.125
        giDistanceDelaySynth_PlaybackVolumeAdjustment = 2.5
        giDistanceDelaySynth_PlaybackReverbAdjustment = 0.25
        giDistanceDelaySynth_NoteIndex[] init 1
        giDistanceDelaySynth_InstrumentNumberFraction[] init 1
         #ifndef DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY
            #define DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY #init 1#
         #end
         #ifndef DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER
            #define DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER #0#
         #end
        giDistanceDelaySynth_LowestNoteNumber = $DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER
        giDistanceDelaySynth_SampleCacheNoteNumbers[] $DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY
        giDistanceDelaySynth_SampleCacheTableNumbers[] init lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)
        giDistanceDelaySynth_SampleCacheLength init sr * giDistanceDelaySynth_Duration
        giDistanceDelaySynth_SampleCacheTableLength = 2
        while (giDistanceDelaySynth_SampleCacheTableLength < giDistanceDelaySynth_SampleCacheLength) do
            giDistanceDelaySynth_SampleCacheTableLength *= 2
        od
        iI = 0
        while (iI < lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) do
            giDistanceDelaySynth_SampleCacheTableNumbers[iI] = ftgen(0, 0, giDistanceDelaySynth_SampleCacheTableLength, 2, 0)
            iI += 1
        od
         #ifdef IS_GENERATING_JSON
            setPluginUuid(0, 0, "6c9f37ab-392f-429b-8217-eac09f295362")
            instr DistanceDelaySynth_Json
                SJsonFile = sprintf("json/%s.0.json", "6c9f37ab-392f-429b-8217-eac09f295362")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
                fprints(SJsonFile, sprintf(",\\"startDistance\\":%d", giDistanceDelaySynth_StartDistance))
                fprints(SJsonFile, sprintf(",\\"delayDistance\\":%d", giDistanceDelaySynth_DelayDistance))
                fprints(SJsonFile, sprintf(",\\"noteNumberToHeightScale\\":%.02f", giDistanceDelaySynth_NoteNumberToHeightScale))
                fprints(SJsonFile, sprintf(",\\"delayTime\\":%.02f", giDistanceDelaySynth_DelayTime))
                fprints(SJsonFile, sprintf(",\\"duration\\":%.01f", giDistanceDelaySynth_Duration))
                fprints(SJsonFile, sprintf(",\\"delayCount\\":%d", giDistanceDelaySynth_DelayCount))
                fprints(SJsonFile, "}")
                turnoff
            endin
         #end
        instr 4
            iEventType = p4
            if (iEventType == 4) then
                turnoff
            elseif (iEventType == 3 || iEventType == 5) then
                iNoteNumber = p5
                iVelocity = p6
                iDelayIndex = p7
                iSampleCacheI = -1
                iI = 0
                while (iI < lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) do
                    if (iNoteNumber == giDistanceDelaySynth_SampleCacheNoteNumbers[iI]) then
                        iSampleCacheI = iI
                        iI = lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)
                    endif
                    iI += 1
                od
                if (iSampleCacheI == -1 || iSampleCacheI == lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) then
                    turnoff
                endif
                    iIsPlayback = 1
                a1 init 0
                asig init 0
                if(iIsPlayback == 0 || iEventType == 5) then
                    iAmp init 0
                    if (iIsPlayback == 0) then
                        iAmp = (iVelocity / 127) * (1 - (iNoteNumber / 127))
                    else
                        iAmp = 1
                    endif
                    iCps = cpsmidinn(iNoteNumber)
                    iCpsRandomized = iCps * random:i(0.999, 1.001)
                    asig = foscili(iAmp, iCps, 1, 1, expseg(2, 1, 0.1, 1, 0.001))
                    asig += foscili(iAmp * ampdbfs(-18) * expon(1, 1, 0.001), iCps * 4, 1, 1, expseg(2, 1, 0.01, 1, 0.01))
                    asig += foscili(iAmp * ampdbfs(-30) * expon(1, .5, 0.001), iCps * 8, 1, 1, expseg(1, 1, 0.01, 1, 0.01))
                    asig *= expseg(0.01, 0.02, 1, .03, 0.5, p3 - .34, .4, 0.29, 0.001)
                    ioct = octcps(iCpsRandomized)
                    asig = K35_lpf(asig, cpsoct(expseg(min:i(14, ioct + 5), 1, ioct, 1, ioct)), 1, 1.5)
                    asig = K35_hpf(asig, iCpsRandomized, 0.5)
                    ain = asig * ampdbfs(-60)
                    a1 = mode(ain, 500, 20)
                    a1 += mode(ain, 900, 10)
                    a1 += mode(ain, 1700, 6)
                    asig *= linen:a(1, 0, p3, 0.001)
                    asig += a1
                    if (iEventType == 5) then
                        kPass init 0
                        kDummy = tablewa(giDistanceDelaySynth_SampleCacheTableNumbers[iSampleCacheI], asig, kPass * ksmps)
                        kPass += 1
                        goto end
                    endif
                endif
                if (iIsPlayback == 1 && iSampleCacheI >= 0) then
                    asig = oscil(1, 1, giDistanceDelaySynth_SampleCacheTableNumbers[iSampleCacheI])
                endif
                    a1 = gaInstrumentSignals[0][0]
                    a2 = gaInstrumentSignals[0][1]
                    a3 = gaInstrumentSignals[0][2]
                    a4 = gaInstrumentSignals[0][3]
                    a5 = gaInstrumentSignals[0][4]
                kY init (iNoteNumber - giDistanceDelaySynth_LowestNoteNumber) * giDistanceDelaySynth_NoteNumberToHeightScale
                iRadius = giDistanceDelaySynth_StartDistance + giDistanceDelaySynth_DelayDistance * iDelayIndex
                kRotationIndex = 0
                while (kRotationIndex < 3) do
                    kTheta = 3.141592653589793 + (2 * 3.141592653589793 / 3) * kRotationIndex
                    kX = sin(kTheta) * iRadius
                    kZ = cos(kTheta) * iRadius
                    kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
                    kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giDistanceDelaySynth_ReferenceDistance, giDistanceDelaySynth_RolloffFactor)
                    kDistanceAmp = min(kDistanceAmp, giDistanceDelaySynth_MaxAmpWhenVeryClose)
                        kDistanceAmp *= giDistanceDelaySynth_PlaybackVolumeAdjustment
                    aOutDistanced = asig * kDistanceAmp
                    AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
                    iPlaybackReverbAdjustment init 1
                        iPlaybackReverbAdjustment = giDistanceDelaySynth_PlaybackReverbAdjustment
                    a1 += gkAmbisonicChannelGains[0] * aOutDistanced
                    a2 += gkAmbisonicChannelGains[1] * aOutDistanced
                    a3 += gkAmbisonicChannelGains[2] * aOutDistanced
                    a4 += gkAmbisonicChannelGains[3] * aOutDistanced
                    a5 += asig * 2 * kDistanceAmp * iPlaybackReverbAdjustment
                    kRotationIndex += 1
                od
                    gaInstrumentSignals[0][0] = a1
                    gaInstrumentSignals[0][1] = a2
                    gaInstrumentSignals[0][2] = a3
                    gaInstrumentSignals[0][3] = a4
                    gaInstrumentSignals[0][4] = a5
                    gaInstrumentSignals[0][5] = a5
                #ifdef IS_GENERATING_JSON
                    if (iDelayIndex == 0) then
                        if (giDistanceDelaySynth_NoteIndex[0] == 0) then
                            scoreline_i("i \\"DistanceDelaySynth_Json\\" 0 0")
                        endif
                        giDistanceDelaySynth_NoteIndex[0] = giDistanceDelaySynth_NoteIndex[0] + 1
                        SJsonFile = sprintf("json/%s.%d.json", "6c9f37ab-392f-429b-8217-eac09f295362", giDistanceDelaySynth_NoteIndex[0])
                        fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%d,\\"velocity\\":%d}}",
                            times(), iNoteNumber, iVelocity)
                        ficlose(SJsonFile)
                    endif
                #end
            endif
        end:
        endin
            instr Preallocate_4
                ii = 0
                iCount = giPresetUuidPreallocationCount[0]
                while (ii < iCount) do
                    scoreline_i(sprintf("i %d.%.3d 0 1 %d 1 1 0",
                        4,
                        ii,
                        3))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 4))
            instr FillSampleCache_4
                iI = 0
                while (iI < lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) do
                    prints("Filling DistanceDelaySynth sample cache for note %d\\n", giDistanceDelaySynth_SampleCacheNoteNumbers[iI])
                    scoreline_i(sprintf(
                        "i %d 0 %f %d %d 127 0",
                        4,
                        giDistanceDelaySynth_Duration,
                        5,
                        giDistanceDelaySynth_SampleCacheNoteNumbers[iI]))
                    iI += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"FillSampleCache_%d\\" 0 -1", 4))
         #ifndef ADSR_LINSEGR_UDO_ORC
         #define ADSR_LINSEGR_UDO_ORC ##
        opcode adsr_linsegr, a, iiii
            iA, iD, iS, iR xin
            iA = max(0.000001, iA)
            iD = max(0.000001, iD)
            iR = max(0.000001, iR)
            aOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
            xout aOut
        endop
        opcode adsr_linsegr, k, kkkk
            iA, iD, iS, iR xin
            iA = max(0.000001, iA)
            iD = max(0.000001, iD)
            iR = max(0.000001, iR)
            kOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
            xout kOut
        endop
         #end
        gSCcInfo_PointSynth[] = fillarray( \\
        \\
            "example", "bool", "false", "synced", \\
        \\
            "", "", "", "")
         #define gSCcInfo_PointSynth_Count #8#
         #define CC_INFO_CHANNEL #0#
         #define CC_INFO_TYPE #1#
         #define CC_INFO_VALUE #2#
         #define CC_INFO_SYNC_TYPE #3#
         #define CC_NO_SYNC #0#
         #define CC_SYNC_TO_CHANNEL #1#
         #ifdef gSCcInfo_PointSynth_Count
            if (lenarray(gSCcInfo_PointSynth) == $gSCcInfo_PointSynth_Count) then
                giCcCount_PointSynth = (lenarray(gSCcInfo_PointSynth) / 4) - 1
                reshapearray(gSCcInfo_PointSynth, giCcCount_PointSynth + 1, 4)
            endif
         #else
            giCcCount_PointSynth = (lenarray(gSCcInfo_PointSynth) / 4) - 1
            reshapearray(gSCcInfo_PointSynth, giCcCount_PointSynth + 1, 4)
         #end
        opcode ccIndex_PointSynth, i, S
            SChannel xin
            kgoto end
            iI = 0
            while (iI < giCcCount_PointSynth) do
                if (strcmp(gSCcInfo_PointSynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
                iI += 1
            od
            iI = -1
        end:
            xout iI
        endop
        giCcValueDefaults_PointSynth[] init giCcCount_PointSynth
        giCcValues_PointSynth[][] init 1, giCcCount_PointSynth
        gkCcValues_PointSynth[][] init 1, giCcCount_PointSynth
        gkCcSyncTypes_PointSynth[][] init 1, giCcCount_PointSynth
        instr PointSynth_InitializeCcValues
            iI = 0
            while (iI < giCcCount_PointSynth) do
                SType = gSCcInfo_PointSynth[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_PointSynth[iI][$CC_INFO_VALUE]
                iJ = 0
                while (iJ < 1) do
                    iValue = -1
                    if (strcmp(SType, "bool") == 0) then
                        if (strcmp(SValue, "false") == 0) then
                            iValue = 0
                        else
                            iValue = 1
                        endif
                    elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
                        iValue = strtod(SValue)
                    endif
                    giCcValueDefaults_PointSynth[iI] = iValue
                    giCcValues_PointSynth[iJ][iI] = iValue
                    iJ += 1
                od
                iI += 1
            od
            igoto end
            kI = 0
            while (kI < giCcCount_PointSynth) do
                SType = gSCcInfo_PointSynth[kI][$CC_INFO_TYPE]
                SValue = gSCcInfo_PointSynth[kI][$CC_INFO_VALUE]
                SSyncType = gSCcInfo_PointSynth[kI][$CC_INFO_SYNC_TYPE]
                kJ = 0
                while (kJ < 1) do
                    kValue = -1
                    if (strcmpk(SType, "bool") == 0) then
                        if (strcmpk(SValue, "false") == 0) then
                            kValue = 0
                        else
                            kValue = 1
                        endif
                    elseif (strcmpk(SType, "number") == 0 && strcmpk(SValue, "") != 0) then
                        kValue = strtodk(SValue)
                    endif
                    gkCcValues_PointSynth[kJ][kI] = kValue
                    gkCcSyncTypes_PointSynth[kJ][kI] = $CC_NO_SYNC
                    if (strcmpk(SSyncType, "synced") == 0) then
                        gkCcSyncTypes_PointSynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
                    endif
                    kJ += 1
                od
                kI += 1
            od
            turnoff
        end:
        endin
        event_i("i", "PointSynth_InitializeCcValues", 0, -1)
        instr PointSynth_CreateCcIndexes
            giCc_PointSynth_example init ccIndex_PointSynth("example")
            turnoff
        endin
        event_i("i", "PointSynth_CreateCcIndexes", 0, -1)
        giPointSynth_DistanceMin = 50
        giPointSynth_DistanceMax = 500
        giPointSynth_ReferenceDistance = 5
        giPointSynth_RolloffFactor = 0.25
        giPointSynth_PlaybackVolumeAdjustment = 4
        giPointSynth_PlaybackReverbAdjustment = 0.5
         #define POINT_SYNTH_NEXT_XYZ_COUNT #16384#
        giPointSynthNextXYZ[][][] init 1, $POINT_SYNTH_NEXT_XYZ_COUNT, 3
        giPointSynthNextXYZ_i init 0
        instr PointSynth_ResetNextXYZ_i
            giPointSynthNextXYZ_i = 0
            turnoff
        endin
        iI = 0
        while (iI < 1) do
            seed(1 + iI * 1000)
            iJ = 0
            while (iJ < $POINT_SYNTH_NEXT_XYZ_COUNT) do
                iR = giPointSynth_DistanceMin + rnd(giPointSynth_DistanceMax - giPointSynth_DistanceMin)
                iT = rnd(359.999)
                iXYZ[] = math_rytToXyz(iR, 0, iT)
                giPointSynthNextXYZ[iI][iJ][$X] = iXYZ[$X]
                giPointSynthNextXYZ[iI][iJ][$Y] = 2
                giPointSynthNextXYZ[iI][iJ][$Z] = iXYZ[$Z]
                iJ += 1
            od
            iI += 1
        od
        giPointSynth_NoteIndex[] init 1
        gkPointSynth_InstrumentNumberFraction[] init 1
        gkPointSynth_LastNoteOnTime[] init 1
        giFadeInTime init 0.05
        giFadeOutTime init 0.05
        giTotalTime init giFadeInTime + giFadeOutTime
         #ifdef IS_GENERATING_JSON
            setPluginUuid(1, 0, "b4f7a35c-6198-422f-be6e-fa126f31b007")
            instr PointSynth_Json
                SJsonFile = sprintf("json/%s.0.json", "b4f7a35c-6198-422f-be6e-fa126f31b007")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
                fprints(SJsonFile, sprintf(",\\"fadeInTime\\":%.02f", giFadeInTime))
                fprints(SJsonFile, sprintf(",\\"fadeOutTime\\":%.02f", giFadeOutTime))
                fprints(SJsonFile, ",\\"soundDistanceMin\\":%d", giPointSynth_DistanceMin)
                fprints(SJsonFile, ",\\"soundDistanceMax\\":%d", giPointSynth_DistanceMax)
                fprints(SJsonFile, "}")
                ficlose(SJsonFile)
                turnoff
            endin
         #end
        instr 5
            iEventType = p4
            if (iEventType == 4) then
                turnoff
            elseif (iEventType == 1) then
                iNoteNumber = p5
                iVelocity = p6
                    iNoteNumber -= 1000
                    if (iNoteNumber > 127) then
                        igoto end
                        turnoff
                    endif
                    iCps = cpsmidinn(iNoteNumber)
                    iAmp = 0.05
                    kCps = linseg(iCps, giTotalTime, iCps + 100)
                    aOut = oscil(iAmp, kCps)
                    aEnvelope = adsr_linsegr(giFadeInTime, 0, 1, giFadeOutTime)
                    aOut *= aEnvelope
                    iX init giPointSynthNextXYZ[0][giPointSynthNextXYZ_i][$X]
                    iZ init giPointSynthNextXYZ[0][giPointSynthNextXYZ_i][$Z]
                    iY init 50 + ((iNoteNumber - 80) / 25) * 300
                    kDistance = AF_3D_Audio_SourceDistance(iX, iY, iZ)
                    kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giPointSynth_ReferenceDistance, giPointSynth_RolloffFactor)
                        kDistanceAmp *= giPointSynth_PlaybackVolumeAdjustment
                    aOutDistanced = aOut * kDistanceAmp
                    giPointSynthNextXYZ_i += 1
                    if (giPointSynthNextXYZ_i == $POINT_SYNTH_NEXT_XYZ_COUNT) then
                        giPointSynthNextXYZ_i = 0
                    endif
                    AF_3D_Audio_ChannelGains_XYZ(k(iX), k(iY), k(iZ))
                    iPlaybackReverbAdjustment init 1
                        iPlaybackReverbAdjustment = giPointSynth_PlaybackReverbAdjustment
                    a1 = gkAmbisonicChannelGains[0] * aOutDistanced
                    a2 = gkAmbisonicChannelGains[1] * aOutDistanced
                    a3 = gkAmbisonicChannelGains[2] * aOutDistanced
                    a4 = gkAmbisonicChannelGains[3] * aOutDistanced
                    aReverbOut = aOut * 2 * kDistanceAmp * iPlaybackReverbAdjustment
                        gaInstrumentSignals[1][0] = gaInstrumentSignals[1][0] + a1
                        gaInstrumentSignals[1][1] = gaInstrumentSignals[1][1] + a2
                        gaInstrumentSignals[1][2] = gaInstrumentSignals[1][2] + a3
                        gaInstrumentSignals[1][3] = gaInstrumentSignals[1][3] + a4
                        gaInstrumentSignals[1][4] = gaInstrumentSignals[1][4] + aReverbOut
                        gaInstrumentSignals[1][5] = gaInstrumentSignals[1][5] + aReverbOut
                    #ifdef IS_GENERATING_JSON
                        if (giPointSynth_NoteIndex[0] == 0) then
                            scoreline_i("i \\"PointSynth_Json\\" 0 0")
                        endif
                        giPointSynth_NoteIndex[0] = giPointSynth_NoteIndex[0] + 1
                        SJsonFile = sprintf("json/%s.%d.json", "b4f7a35c-6198-422f-be6e-fa126f31b007", giPointSynth_NoteIndex[0])
                        fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"xyz\\":[%.3f,%.3f,%.3f]}}", times(),
                            iNoteNumber, iX, iY, iZ)
                        ficlose(SJsonFile)
                    #end
            endif
        end:
        endin
            instr Preallocate_5
                ii = 0
                while (ii < giPresetUuidPreallocationCount[1]) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 1063 63", 5, ii, 1))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 5))
        gSCcInfo_Reverb[] = fillarray( \\
        \\
            "enabled", "bool", "false", "synced", \\
            "size", "number", "0.5", "synced", \\
            "cutoffFrequency", "number", "20000", "synced", \\
            "variationDepth", "number", "0.1", "synced", \\
            "dryWet", "number", "1", "synced", \\
            "volume", "number", "0.5", "synced", \\
        \\
            "", "", "", "")
         #define CC_INFO_CHANNEL #0#
         #define CC_INFO_TYPE #1#
         #define CC_INFO_VALUE #2#
         #define CC_INFO_SYNC_TYPE #3#
         #define CC_NO_SYNC #0#
         #define CC_SYNC_TO_CHANNEL #1#
         #ifdef gSCcInfo_Reverb_Count
            if (lenarray(gSCcInfo_Reverb) == $gSCcInfo_Reverb_Count) then
                giCcCount_Reverb = (lenarray(gSCcInfo_Reverb) / 4) - 1
                reshapearray(gSCcInfo_Reverb, giCcCount_Reverb + 1, 4)
            endif
         #else
            giCcCount_Reverb = (lenarray(gSCcInfo_Reverb) / 4) - 1
            reshapearray(gSCcInfo_Reverb, giCcCount_Reverb + 1, 4)
         #end
        opcode ccIndex_Reverb, i, S
            SChannel xin
            kgoto end
            iI = 0
            while (iI < giCcCount_Reverb) do
                if (strcmp(gSCcInfo_Reverb[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
                iI += 1
            od
            iI = -1
        end:
            xout iI
        endop
        giCcValueDefaults_Reverb[] init giCcCount_Reverb
        giCcValues_Reverb[][] init 1, giCcCount_Reverb
        gkCcValues_Reverb[][] init 1, giCcCount_Reverb
        gkCcSyncTypes_Reverb[][] init 1, giCcCount_Reverb
        instr Reverb_InitializeCcValues
            iI = 0
            while (iI < giCcCount_Reverb) do
                SType = gSCcInfo_Reverb[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_Reverb[iI][$CC_INFO_VALUE]
                iJ = 0
                while (iJ < 1) do
                    iValue = -1
                    if (strcmp(SType, "bool") == 0) then
                        if (strcmp(SValue, "false") == 0) then
                            iValue = 0
                        else
                            iValue = 1
                        endif
                    elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
                        iValue = strtod(SValue)
                    endif
                    giCcValueDefaults_Reverb[iI] = iValue
                    giCcValues_Reverb[iJ][iI] = iValue
                    iJ += 1
                od
                iI += 1
            od
            igoto end
            kI = 0
            while (kI < giCcCount_Reverb) do
                SType = gSCcInfo_Reverb[kI][$CC_INFO_TYPE]
                SValue = gSCcInfo_Reverb[kI][$CC_INFO_VALUE]
                SSyncType = gSCcInfo_Reverb[kI][$CC_INFO_SYNC_TYPE]
                kJ = 0
                while (kJ < 1) do
                    kValue = -1
                    if (strcmpk(SType, "bool") == 0) then
                        if (strcmpk(SValue, "false") == 0) then
                            kValue = 0
                        else
                            kValue = 1
                        endif
                    elseif (strcmpk(SType, "number") == 0 && strcmpk(SValue, "") != 0) then
                        kValue = strtodk(SValue)
                    endif
                    gkCcValues_Reverb[kJ][kI] = kValue
                    gkCcSyncTypes_Reverb[kJ][kI] = $CC_NO_SYNC
                    if (strcmpk(SSyncType, "synced") == 0) then
                        gkCcSyncTypes_Reverb[kJ][kI] = $CC_SYNC_TO_CHANNEL
                    endif
                    kJ += 1
                od
                kI += 1
            od
            turnoff
        end:
        endin
        event_i("i", "Reverb_InitializeCcValues", 0, -1)
        instr Reverb_CreateCcIndexes
            giCc_Reverb_enabled init ccIndex_Reverb("enabled")
            giCc_Reverb_size init ccIndex_Reverb("size")
            giCc_Reverb_cutoffFrequency init ccIndex_Reverb("cutoffFrequency")
            giCc_Reverb_variationDepth init ccIndex_Reverb("variationDepth")
            giCc_Reverb_dryWet init ccIndex_Reverb("dryWet")
            giCc_Reverb_volume init ccIndex_Reverb("volume")
        endin
        event_i("i", "Reverb_CreateCcIndexes", 0, -1)
        instr 8
            iOrcInstanceIndex = 0
            iEventType = p4
            if (iEventType == 4) then
                iCcType = p5
                iCcValue = p6
                giCcValues_Reverb[0][iCcType] = iCcValue
                gkCcValues_Reverb[0][iCcType] = iCcValue
                turnoff
            elseif (iEventType == 1) then
                aIn[] init 2
                aOut[] init 2
                kI = 0
                kJ = 4
                while (kI < 2) do
                        if (2 < gi_instrumentCount) then
                            aIn[kI] = gaInstrumentSignals[2][kJ]
                        else
                            iAuxTrackIndex = 2 - gi_instrumentCount
                            aIn[kI] = ga_auxSignals[iAuxTrackIndex][kJ]
                        endif
                        kJ += 1
                    kI += 1
                od
                if (gkCcValues_Reverb[iOrcInstanceIndex][giCc_Reverb_enabled] == 1) then
                    aOut[0], aOut[1] reverbsc aIn[0], aIn[1], gkCcValues_Reverb[iOrcInstanceIndex][giCc_Reverb_size], gkCcValues_Reverb[iOrcInstanceIndex][giCc_Reverb_cutoffFrequency], sr, 0.1
                    kDryWet = gkCcValues_Reverb[iOrcInstanceIndex][giCc_Reverb_dryWet]
                    aOut[0] = aOut[0] * kDryWet
                    aOut[1] = aOut[1] * kDryWet
                    kWetDry = 1 - kDryWet
                    aOut[0] = aOut[0] + aIn[0] * kWetDry
                    aOut[1] = aOut[1] + aIn[1] * kWetDry
                    kVolume = gkCcValues_Reverb[iOrcInstanceIndex][giCc_Reverb_volume]
                    aOut[0] = aOut[0] * kVolume
                    aOut[1] = aOut[1] * kVolume
                else
                    aOut[0] = aIn[0]
                    aOut[1] = aIn[1]
                endif
                kI = 0
                kJ = 4
                while (kI < 2) do
                        iAuxTrackIndex = 2
                        if (iAuxTrackIndex >= gi_instrumentCount) then
                            iAuxTrackIndex -= gi_instrumentCount
                        endif
                        ga_auxSignals[iAuxTrackIndex][kJ] = aOut[kI]
                        kJ += 1
                    kI += 1
                od
            endif
        endin
            instr Preallocate_8
                ii = 0
                while (ii < 10) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", 8, ii))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 8))
        instr 6
            kAux = 0
            while (kAux < gi_auxCount) do
                kInstrument = 0
                while (kInstrument < gi_instrumentCount) do
                    kChannel = giAuxChannelIndexRanges[kAux][kInstrument][0]
                    kMaxChannel = giAuxChannelIndexRanges[kAux][kInstrument][1]
                    while (kChannel <= kMaxChannel) do
                        ga_auxSignals[kAux][kChannel] = ga_auxSignals[kAux][kChannel] +
                            ga_auxVolumes[kAux][kInstrument][kChannel] * gaInstrumentSignals[kInstrument][kChannel]
                        kChannel += 1
                    od
                    kInstrument += 1
                od
                kAux += 1
            od
        endin
        instr 7
            k_aux = p4 - gi_auxIndexOffset
            k_track = p5 - gi_instrumentIndexOffset
            k_channel = p6
            k_volume = p7
            ga_auxVolumes[k_aux][k_track][k_channel] = k_volume
            turnoff
        endin
        instr 9
            k_track = p4 - gi_instrumentIndexOffset
            k_channel = p5
            k_volume = p6
            ga_masterVolumes[k_track][k_channel] = k_volume
            turnoff
        endin
        instr 10
            kChannel = 0
            while (kChannel < $INTERNAL_CHANNEL_COUNT) do
                ga_masterSignals[kChannel] = 0
                kChannel += 1
            od
            kTrack = 0
            while (kTrack < gi_instrumentCount) do
                kChannel = giMasterChannelIndexRanges[kTrack][0]
                kChannelHigh = giMasterChannelIndexRanges[kTrack][1]
                while (kChannel <= kChannelHigh) do
                    ga_masterSignals[kChannel] = ga_masterSignals[kChannel] + gaInstrumentSignals[kTrack][kChannel] *
                        ga_masterVolumes[kTrack][kChannel]
                    kChannel += 1
                od
                kTrack += 1
            od
            kAux = 0
            while (kAux < gi_auxCount) do
                kChannel = giMasterChannelIndexRanges[kTrack][0]
                kChannelHigh = giMasterChannelIndexRanges[kTrack][1]
                while (kChannel <= kChannelHigh) do
                    ga_masterSignals[kChannel] = ga_masterSignals[kChannel] + ga_auxSignals[kAux][kChannel] *
                        ga_masterVolumes[kTrack][kChannel]
                    kChannel += 1
                od
                kTrack += 1
                kAux += 1
            od
            aw = ga_masterSignals[0]
            ay = ga_masterSignals[1]
            az = ga_masterSignals[2]
            ax = ga_masterSignals[3]
            km0 = gk_AF_3D_ListenerRotationMatrix[0]
            km1 = gk_AF_3D_ListenerRotationMatrix[1]
            km2 = gk_AF_3D_ListenerRotationMatrix[2]
            km3 = gk_AF_3D_ListenerRotationMatrix[3]
            km4 = gk_AF_3D_ListenerRotationMatrix[4]
            km5 = gk_AF_3D_ListenerRotationMatrix[5]
            km6 = gk_AF_3D_ListenerRotationMatrix[6]
            km7 = gk_AF_3D_ListenerRotationMatrix[7]
            km8 = gk_AF_3D_ListenerRotationMatrix[8]
            ayr = -(ay * km0 + az * km3 + ax * km6)
            azr = ay * km1 + az * km4 + ax * km7
            axr = -(ay * km2 + az * km5 + ax * km8)
            aw dconv aw, 256, gi_AF_3D_HrirChannel1TableNumber
            ay dconv ayr, 256, gi_AF_3D_HrirChannel2TableNumber
            az dconv azr, 256, gi_AF_3D_HrirChannel3TableNumber
            ax dconv axr, 256, gi_AF_3D_HrirChannel4TableNumber
            aL = aw - ay + az + ax
            aR = aw + ay + az + ax
            aL += ga_masterSignals[4]
            aR += ga_masterSignals[5]
            outs(aL, aR)
        endin
        instr EndOfInstrumentAllocations
            prints("-------------------------------------------------------------------------------------------------------\\n")
            prints("Add preallocation score lines for all instruments allocated after this message.\\n")
            prints("-------------------------------------------------------------------------------------------------------\\n")
            turnoff
        endin
        instr SendStartupMessage
            if (p3 == -1) then
                prints("csd:started\\n")
            endif
            turnoff
        endin
        instr SendEndedMessage
            if (p3 == -1) then
                prints("csd:ended\\n")
            endif
            turnoff
        endin
        </CsInstruments>
        <CsScore>
         #ifndef SCORE_START_DELAY
            #define SCORE_START_DELAY #5#
         #end
        i 1 0 -1
        i "SendEndedMessage" 0 1
        i "PointSynth_ResetNextXYZ_i" 0 -1
        i 2 0 -1 2 0 1 2
        i 8.1 0 -1 1 0 0
        i 7 0.004 1 2 0 0 0.60
        i 7 0.004 1 2 0 1 0.60
        i 7 0.004 1 2 0 2 0.60
        i 7 0.004 1 2 0 3 0.60
        i 7 0.004 1 2 0 4 0.12
        i 7 0.004 1 2 0 5 0.12
        i 7 0.004 1 2 1 0 0.06
        i 7 0.004 1 2 1 1 0.06
        i 7 0.004 1 2 1 2 0.06
        i 7 0.004 1 2 1 3 0.06
        i 7 0.004 1 2 1 4 0.02
        i 7 0.004 1 2 1 5 0.02
        i 9 0.004 1 2 0 1.00
        i 9 0.004 1 2 1 1.00
        i 9 0.004 1 2 2 1.00
        i 9 0.004 1 2 3 1.00
        i 9 0.004 1 2 4 1.00
        i 9 0.004 1 2 5 1.00
        i "EndOfInstrumentAllocations" 3 -1
        i "SendStartupMessage" 0 1
        i "SendStartupMessage" 4 -1
        b $SCORE_START_DELAY
        i 8 0.01 1 4 0 1.00
        i 8 0.01 1 4 1 0.98
        i 8 0.01 1 4 5 1.00
        i 5.001 2.853 0.100 1 1098 76
        i 5.002 3.825 0.100 1 1095 79
        i 5.003 4.621 0.100 1 1103 52
        i 5.004 5.243 0.100 1 1103 78
        i 5.005 5.799 0.100 1 1095 71
        i 5.006 6.531 0.100 1 1097 58
        i 5.007 7.439 0.100 1 1097 78
        i 5.008 8.356 0.100 1 1095 72
        i 5.009 9.097 0.100 1 1103 52
        i 5.010 9.664 0.100 1 1102 79
        i 5.011 10.237 0.100 1 1096 74
        i 5.012 10.275 0.100 1 1096 77
        i 5.013 10.852 0.100 1 1094 69
        i 5.014 11.061 0.100 1 1098 74
        i 5.015 11.380 0.100 1 1102 57
        i 4.001 12.001 0.490 3 36 127 0
        i 4.002 12.501 0.490 3 36 127 1
        i 4.003 13.501 0.490 3 36 127 2
        i 4.004 15.001 0.490 3 36 127 3
        i 4.005 17.001 0.490 3 36 127 4
        i 5.016 12.024 0.100 1 1096 76
        i 5.017 12.321 0.100 1 1101 58
        i 4.007 12.751 0.490 3 36 127 0
        i 4.008 13.251 0.490 3 36 127 1
        i 4.009 14.251 0.490 3 36 127 2
        i 4.010 15.751 0.490 3 36 127 3
        i 4.011 17.751 0.490 3 36 127 4
        i 5.018 12.887 0.100 1 1094 55
        i 5.019 13.176 0.100 1 1095 82
        i 5.020 13.573 0.100 1 1104 76
        i 5.021 13.911 0.100 1 1097 60
        i 5.022 14.085 0.100 1 1102 59
        i 5.023 14.732 0.100 1 1095 62
        i 5.024 14.751 0.100 1 1096 73
        i 5.025 15.325 0.100 1 1093 64
        i 5.026 15.592 0.100 1 1099 61
        i 5.027 15.832 0.100 1 1103 75
        i 5.028 15.969 0.100 1 1099 76
        i 4.013 16.001 0.490 3 36 127 0
        i 4.014 16.501 0.490 3 36 127 1
        i 4.015 17.501 0.490 3 36 127 2
        i 4.016 19.001 0.490 3 36 127 3
        i 4.017 21.001 0.490 3 36 127 4
        i 5.029 16.576 0.100 1 1095 69
        i 5.030 16.641 0.100 1 1097 56
        i 5.031 16.752 0.100 1 1101 61
        i 4.019 16.751 0.490 3 36 127 0
        i 4.020 17.251 0.490 3 36 127 1
        i 4.021 18.251 0.490 3 36 127 2
        i 4.022 19.751 0.490 3 36 127 3
        i 4.023 21.751 0.490 3 36 127 4
        i 5.032 17.207 0.100 1 1103 79
        i 5.033 17.384 0.100 1 1093 72
        i 5.034 17.585 0.100 1 1096 74
        i 5.035 17.908 0.100 1 1105 65
        i 5.036 18.016 0.100 1 1103 69
        i 5.037 18.341 0.100 1 1098 78
        i 5.038 18.444 0.100 1 1095 59
        i 5.039 18.560 0.100 1 1101 75
        i 5.040 19.175 0.100 1 1097 55
        i 5.041 19.184 0.100 1 1094 79
        i 5.042 19.280 0.100 1 1097 83
        i 5.043 19.681 0.100 1 1099 60
        i 5.044 19.756 0.100 1 1092 81
        i 4.025 20.001 0.490 3 36 127 0
        i 4.026 20.501 0.490 3 36 127 1
        i 4.027 21.501 0.490 3 36 127 2
        i 4.028 23.001 0.490 3 36 127 3
        i 4.029 25.001 0.490 3 36 127 4
        i 5.045 20.176 0.100 1 1099 57
        i 5.046 20.272 0.100 1 1102 53
        i 5.047 20.441 0.100 1 1097 79
        i 4.031 20.751 0.490 3 38 127 0
        i 4.032 21.251 0.490 3 38 127 1
        i 4.033 22.251 0.490 3 38 127 2
        i 4.034 23.751 0.490 3 38 127 3
        i 4.035 25.751 0.490 3 38 127 4
        i 5.048 20.965 0.100 1 1104 60
        i 5.049 21.105 0.100 1 1094 59
        i 5.050 21.171 0.100 1 1100 75
        i 5.051 21.755 0.100 1 1104 64
        i 5.052 21.859 0.100 1 1092 74
        i 5.053 21.981 0.100 1 1096 56
        i 5.054 22.308 0.100 1 1096 79
        i 5.055 22.436 0.100 1 1102 78
        i 5.056 22.759 0.100 1 1098 67
        i 5.057 23.005 0.100 1 1094 73
        i 5.058 23.035 0.100 1 1100 56
        i 5.059 23.127 0.100 1 1098 69
        i 5.060 23.623 0.100 1 1093 58
        i 5.061 23.709 0.100 1 1098 72
        i 5.062 23.749 0.100 1 1092 59
        i 5.063 23.809 0.100 1 1098 67
        i 4.037 24.001 0.490 3 41 127 0
        i 4.038 24.501 0.490 3 41 127 1
        i 4.039 25.501 0.490 3 41 127 2
        i 4.040 27.001 0.490 3 41 127 3
        i 4.041 29.001 0.490 3 41 127 4
        i 5.064 24.173 0.100 1 1091 68
        i 5.065 24.509 0.100 1 1102 62
        i 5.066 24.556 0.100 1 1096 60
        i 5.067 24.711 0.100 1 1101 64
        i 4.043 24.751 0.490 3 40 127 0
        i 4.044 25.251 0.490 3 40 127 1
        i 4.045 26.251 0.490 3 40 127 2
        i 4.046 27.751 0.490 3 40 127 3
        i 4.047 29.751 0.490 3 40 127 4
        i 5.068 24.760 0.100 1 1100 68
        i 5.069 25.168 0.100 1 1104 66
        i 5.070 25.249 0.100 1 1100 69
        i 5.071 25.587 0.100 1 1099 61
        i 5.072 25.635 0.100 1 1094 82
        i 5.073 26.013 0.100 1 1095 61
        i 5.074 26.044 0.100 1 1103 75
        i 5.075 26.333 0.100 1 1092 80
        i 5.076 26.376 0.100 1 1097 84
        i 5.077 26.685 0.100 1 1097 57
        i 5.078 26.749 0.100 1 1097 62
        i 5.079 26.856 0.100 1 1101 56
        i 5.080 27.175 0.100 1 1099 65
        i 5.081 27.509 0.100 1 1099 68
        i 5.082 27.516 0.100 1 1093 79
        i 5.083 27.591 0.100 1 1099 54
        i 4.049 28.001 0.490 3 36 127 0
        i 4.050 28.501 0.490 3 36 127 1
        i 4.051 29.501 0.490 3 36 127 2
        i 4.052 31.001 0.490 3 36 127 3
        i 4.053 33.001 0.490 3 36 127 4
        i 5.084 28.060 0.100 1 1093 65
        i 5.085 28.248 0.100 1 1091 56
        i 5.086 28.261 0.100 1 1097 79
        i 5.087 28.339 0.100 1 1099 55
        i 5.088 28.589 0.100 1 1092 72
        i 4.055 28.751 0.490 3 38 127 0
        i 4.056 29.251 0.490 3 38 127 1
        i 4.057 30.251 0.490 3 38 127 2
        i 4.058 31.751 0.490 3 38 127 3
        i 4.059 33.751 0.490 3 38 127 4
        i 5.089 29.019 0.100 1 1101 66
        i 5.090 29.041 0.100 1 1101 78
        i 5.091 29.148 0.100 1 1100 59
        i 5.092 29.196 0.100 1 1095 75
        i 5.093 29.335 0.100 1 1101 75
        i 5.094 29.728 0.100 1 1099 67
        i 5.095 29.747 0.100 1 1099 75
        i 5.096 29.896 0.100 1 1105 74
        i 5.097 30.003 0.100 1 1098 76
        i 5.098 30.155 0.100 1 1093 52
        i 5.099 30.521 0.100 1 1095 71
        i 5.100 30.561 0.100 1 1103 75
        i 5.101 30.771 0.100 1 1098 54
        i 5.102 30.799 0.100 1 1093 52
        i 5.103 30.860 0.100 1 1103 56
        i 5.104 31.245 0.100 1 1098 81
        i 5.105 31.332 0.100 1 1101 57
        i 5.106 31.541 0.100 1 1105 54
        i 5.107 31.589 0.100 1 1097 81
        i 5.108 31.591 0.100 1 1100 78
        i 4.061 32.001 0.490 3 41 127 0
        i 4.062 32.501 0.490 3 41 127 1
        i 4.063 33.501 0.490 3 41 127 2
        i 4.064 35.001 0.490 3 41 127 3
        i 4.065 37.001 0.490 3 41 127 4
        i 5.109 32.024 0.100 1 1092 82
        i 5.110 32.040 0.100 1 1098 82
        i 5.111 32.416 0.100 1 1095 82
        i 5.112 32.497 0.100 1 1092 75
        i 5.113 32.583 0.100 1 1100 80
        i 5.114 32.744 0.100 1 1090 75
        i 4.067 32.751 0.490 3 43 127 0
        i 4.068 33.251 0.490 3 43 127 1
        i 4.069 34.251 0.490 3 43 127 2
        i 4.070 35.751 0.490 3 43 127 3
        i 4.071 37.751 0.490 3 43 127 4
        i 5.115 32.924 0.100 1 1100 82
        i 5.116 33.005 0.100 1 1092 80
        i 5.117 33.144 0.100 1 1097 55
        i 5.118 33.341 0.100 1 1096 83
        i 5.119 33.527 0.100 1 1100 62
        i 5.120 33.587 0.100 1 1100 55
        i 5.121 33.725 0.100 1 1101 76
        i 5.122 33.865 0.100 1 1102 61
        i 5.123 34.243 0.100 1 1098 59
        i 5.124 34.292 0.100 1 1098 57
        i 5.125 34.320 0.100 1 1094 75
        i 5.126 34.420 0.100 1 1097 58
        i 5.127 34.631 0.100 1 1092 81
        i 5.128 35.004 0.100 1 1104 71
        i 5.129 35.029 0.100 1 1096 71
        i 5.130 35.108 0.100 1 1104 64
        i 5.131 35.167 0.100 1 1099 60
        i 5.132 35.220 0.100 1 1094 80
        i 5.133 35.309 0.100 1 1092 68
        i 5.134 35.741 0.100 1 1098 73
        i 5.135 35.808 0.100 1 1100 74
        i 5.136 35.863 0.100 1 1106 83
        i 4.073 36.001 0.490 3 36 127 0
        i 4.074 36.501 0.490 3 36 127 1
        i 4.075 37.501 0.490 3 36 127 2
        i 4.076 39.001 0.490 3 36 127 3
        i 4.077 41.001 0.490 3 36 127 4
        i 5.137 36.008 0.100 1 1101 55
        i 5.138 36.057 0.100 1 1102 67
        i 5.139 36.209 0.100 1 1090 77
        i 5.140 36.532 0.100 1 1092 79
        i 5.141 36.572 0.100 1 1098 74
        i 5.142 36.720 0.100 1 1100 63
        i 4.079 36.751 0.490 3 38 127 0
        i 4.080 37.251 0.490 3 38 127 1
        i 4.081 38.251 0.490 3 38 127 2
        i 4.082 39.751 0.490 3 38 127 3
        i 4.083 41.751 0.490 3 38 127 4
        i 5.143 36.859 0.100 1 1096 83
        i 5.144 36.875 0.100 1 1098 79
        i 5.145 36.936 0.100 1 1091 63
        i 5.146 37.240 0.100 1 1091 64
        i 5.147 37.301 0.100 1 1098 77
        i 5.148 37.451 0.100 1 1093 54
        i 5.149 37.511 0.100 1 1100 56
        i 5.150 37.708 0.100 1 1098 66
        i 5.151 37.795 0.100 1 1100 57
        i 5.152 38.035 0.100 1 1099 59
        i 5.153 38.053 0.100 1 1099 74
        i 5.154 38.131 0.100 1 1094 68
        i 5.155 38.397 0.100 1 1103 78
        i 5.156 38.411 0.100 1 1100 70
        i 5.157 38.641 0.100 1 1095 56
        i 5.158 38.740 0.100 1 1097 78
        i 5.159 38.865 0.100 1 1097 74
        i 5.160 38.868 0.100 1 1097 60
        i 5.161 38.967 0.100 1 1098 68
        i 5.162 39.108 0.100 1 1093 56
        i 5.163 39.532 0.100 1 1093 80
        i 5.164 39.539 0.100 1 1097 52
        i 5.165 39.559 0.100 1 1105 58
        i 5.166 39.591 0.100 1 1100 73
        i 5.167 39.643 0.100 1 1095 68
        i 5.168 39.723 0.100 1 1091 60
        i 4.085 40.001 0.490 3 41 127 0
        i 4.086 40.501 0.490 3 41 127 1
        i 4.087 41.501 0.490 3 41 127 2
        i 4.088 43.001 0.490 3 41 127 3
        i 4.089 45.001 0.490 3 41 127 4
        i 5.169 40.240 0.100 1 1099 73
        i 5.170 40.285 0.100 1 1099 74
        i 5.171 40.296 0.100 1 1105 60
        i 5.172 40.408 0.100 1 1103 56
        i 5.173 40.453 0.100 1 1102 75
        i 5.174 40.668 0.100 1 1089 76
        i 4.091 40.751 0.490 3 40 127 0
        i 4.092 41.251 0.490 3 40 127 1
        i 4.093 42.251 0.490 3 40 127 2
        i 4.094 43.751 0.490 3 40 127 3
        i 4.095 45.751 0.490 3 40 127 4
        i 5.175 41.043 0.100 1 1091 72
        i 5.176 41.104 0.100 1 1097 55
        i 5.177 41.180 0.100 1 1097 76
        i 5.178 41.204 0.100 1 1099 53
        i 5.179 41.269 0.100 1 1101 77
        i 5.180 41.403 0.100 1 1092 77
        i 5.181 41.424 0.100 1 1103 75
        i 5.182 41.740 0.100 1 1091 69
        i 5.183 41.831 0.100 1 1097 53
        i 5.184 41.940 0.100 1 1094 84
        i 5.185 42.097 0.100 1 1101 52
        i 5.186 42.151 0.100 1 1099 81
        i 5.187 42.175 0.100 1 1099 81
        i 5.188 42.381 0.100 1 1101 74
        i 5.189 42.547 0.100 1 1098 72
        i 5.190 42.564 0.100 1 1098 77
        i 5.191 42.615 0.100 1 1095 63
        i 5.192 42.929 0.100 1 1103 54
        i 5.193 42.975 0.100 1 1099 60
        i 5.194 42.984 0.100 1 1103 66
        i 5.195 43.007 0.100 1 1101 62
        i 5.196 43.240 0.100 1 1096 64
        i 5.197 43.308 0.100 1 1097 49
        i 5.198 43.355 0.100 1 1096 68
        i 5.199 43.585 0.100 1 1094 64
        i 5.200 43.644 0.100 1 1105 70
        i 5.201 43.652 0.100 1 1097 80
        i 5.202 43.941 0.100 1 1095 73
        i 4.097 44.001 0.490 3 40 127 0
        i 4.098 44.501 0.490 3 40 127 1
        i 4.099 45.501 0.490 3 40 127 2
        i 4.100 47.001 0.490 3 40 127 3
        i 4.101 49.001 0.490 3 40 127 4
        i 5.203 44.051 0.100 1 1098 73
        i 5.204 44.059 0.100 1 1100 65
        i 5.205 44.107 0.100 1 1096 53
        i 5.206 44.183 0.100 1 1105 80
        i 5.207 44.207 0.100 1 1091 49
        i 5.208 44.428 0.100 1 1095 67
        i 5.209 44.740 0.100 1 1100 56
        i 5.210 44.744 0.100 1 1093 81
        i 4.103 44.751 0.490 3 38 127 0
        i 4.104 45.251 0.490 3 38 127 1
        i 4.105 46.251 0.490 3 38 127 2
        i 4.106 47.751 0.490 3 38 127 3
        i 4.107 49.751 0.490 3 38 127 4
        i 5.211 44.800 0.100 1 1105 71
        i 5.212 44.804 0.100 1 1098 58
        i 5.213 44.943 0.100 1 1102 62
        i 5.214 45.155 0.100 1 1098 49
        i 5.215 45.196 0.100 1 1090 65
        i 5.216 45.555 0.100 1 1090 67
        i 5.217 45.564 0.100 1 1098 81
        i 5.218 45.677 0.100 1 1096 74
        i 5.219 45.708 0.100 1 1102 71
        i 5.220 45.777 0.100 1 1098 67
        i 5.221 45.915 0.100 1 1093 71
        i 5.222 45.988 0.100 1 1102 55
        i 5.223 46.240 0.100 1 1092 80
        i 5.224 46.449 0.100 1 1096 71
        i 5.225 46.473 0.100 1 1095 74
        i 5.226 46.473 0.100 1 1100 73
        i 5.227 46.481 0.100 1 1100 57
        i 5.228 46.631 0.100 1 1102 84
        i 5.229 46.825 0.100 1 1090 62
        i 5.230 46.879 0.100 1 1100 61
        i 5.231 47.059 0.100 1 1098 54
        i 5.232 47.119 0.100 1 1097 63
        i 5.233 47.188 0.100 1 1096 50
        i 5.234 47.368 0.100 1 1088 62
        i 5.235 47.408 0.100 1 1104 81
        i 5.236 47.419 0.100 1 1098 77
        i 5.237 47.432 0.100 1 1104 76
        i 5.238 47.475 0.100 1 1100 58
        i 5.239 47.740 0.100 1 1096 80
        i 5.240 47.836 0.100 1 1098 75
        i 5.241 47.888 0.100 1 1095 83
        i 5.242 47.937 0.100 1 1106 65
        i 4.109 48.001 0.490 3 36 127 0
        i 4.110 48.501 0.490 3 36 127 1
        i 4.111 49.501 0.490 3 36 127 2
        i 4.112 51.001 0.490 3 36 127 3
        i 4.113 53.001 0.490 3 36 127 4
        i 5.243 48.009 0.100 1 1094 67
        i 5.244 48.091 0.100 1 1098 63
        i 5.245 48.217 0.100 1 1096 78
        i 5.246 48.219 0.100 1 1102 78
        i 5.247 48.561 0.100 1 1099 65
        i 5.248 48.571 0.100 1 1101 79
        i 5.249 48.585 0.100 1 1096 73
        i 4.115 48.751 0.490 3 36 127 0
        i 4.116 49.251 0.490 3 36 127 1
        i 4.117 50.251 0.490 3 36 127 2
        i 4.118 51.751 0.490 3 36 127 3
        i 4.119 53.751 0.490 3 36 127 4
        i 5.250 48.780 0.100 1 1090 64
        i 5.251 48.869 0.100 1 1106 52
        i 5.252 48.876 0.100 1 1096 50
        i 5.253 48.993 0.100 1 1096 52
        i 5.254 49.197 0.100 1 1094 83
        i 5.255 49.239 0.100 1 1101 67
        i 5.256 49.337 0.100 1 1097 64
        i 5.257 49.375 0.100 1 1104 81
        i 5.258 49.476 0.100 1 1103 72
        i 5.259 49.747 0.100 1 1090 56
        i 5.260 49.756 0.100 1 1098 58
        i 5.261 49.912 0.100 1 1094 75
        i 5.262 49.913 0.100 1 1094 74
        i 5.263 50.017 0.100 1 1098 61
        i 5.264 50.064 0.100 1 1091 74
        i 5.265 50.265 0.100 1 1095 53
        i 5.266 50.372 0.100 1 1097 50
        i 5.267 50.435 0.100 1 1102 64
        i 5.268 50.469 0.100 1 1093 65
        i 5.269 50.653 0.100 1 1096 57
        i 5.270 50.737 0.100 1 1093 56
        i 5.271 50.807 0.100 1 1101 80
        i 5.272 50.861 0.100 1 1102 70
        i 5.273 51.049 0.100 1 1096 61
        i 5.274 51.088 0.100 1 1095 60
        i 5.275 51.164 0.100 1 1103 73
        i 5.276 51.171 0.100 1 1099 70
        i 5.277 51.213 0.100 1 1089 72
        i 5.278 51.547 0.100 1 1099 79
        i 5.279 51.567 0.100 1 1097 59
        i 5.280 51.716 0.100 1 1096 65
        i 5.281 51.741 0.100 1 1097 64
        i 5.282 51.783 0.100 1 1097 49
        i 5.283 51.835 0.100 1 1089 63
        i 5.284 51.879 0.100 1 1105 77
        i 5.285 51.887 0.100 1 1103 62
        i 4.121 52.001 0.490 3 36 127 0
        i 4.122 52.501 0.490 3 36 127 1
        i 4.123 53.501 0.490 3 36 127 2
        i 4.124 55.001 0.490 3 36 127 3
        i 4.125 57.001 0.490 3 36 127 4
        i 5.286 52.236 0.100 1 1095 66
        i 5.287 52.385 0.100 1 1099 76
        i 5.288 52.433 0.100 1 1095 62
        i 5.289 52.464 0.100 1 1094 72
        i 5.290 52.467 0.100 1 1101 78
        i 5.291 52.529 0.100 1 1107 72
        i 5.292 52.635 0.100 1 1097 71
        i 5.293 52.661 0.100 1 1095 81
        i 4.127 52.751 0.490 3 38 127 0
        i 4.128 53.251 0.490 3 38 127 1
        i 4.129 54.251 0.490 3 38 127 2
        i 4.130 55.751 0.490 3 38 127 3
        i 4.131 57.751 0.490 3 38 127 4
        i 5.294 53.064 0.100 1 1097 77
        i 5.295 53.069 0.100 1 1099 64
        i 5.296 53.123 0.100 1 1103 62
        i 5.297 53.125 0.100 1 1102 65
        i 5.298 53.375 0.100 1 1089 75
        i 5.299 53.435 0.100 1 1105 58
        i 5.300 53.439 0.100 1 1097 57
        i 5.301 53.615 0.100 1 1095 62
        i 5.302 53.735 0.100 1 1102 57
        i 5.303 53.871 0.100 1 1097 70
        i 5.304 54.013 0.100 1 1093 72
        i 5.305 54.053 0.100 1 1102 69
        i 5.306 54.061 0.100 1 1103 57
        i 5.307 54.296 0.100 1 1091 63
        i 5.308 54.405 0.100 1 1099 72
        i 5.309 54.456 0.100 1 1095 55
        i 5.310 54.572 0.100 1 1092 74
        i 5.311 54.583 0.100 1 1099 77
        i 5.312 54.640 0.100 1 1095 62
        i 5.313 54.853 0.100 1 1094 82
        i 5.314 54.871 0.100 1 1105 76
        i 5.315 54.929 0.100 1 1101 67
        i 5.316 54.967 0.100 1 1097 49
        i 5.317 55.040 0.100 1 1094 54
        i 5.318 55.117 0.100 1 1097 48
        i 5.319 55.233 0.100 1 1094 56
        i 5.320 55.251 0.100 1 1101 83
        i 5.321 55.469 0.100 1 1103 52
        i 5.322 55.503 0.100 1 1101 52
        i 5.323 55.511 0.100 1 1099 48
        i 5.324 55.636 0.100 1 1089 47
        i 5.325 55.641 0.100 1 1096 83
        i 5.326 55.697 0.100 1 1104 72
        i 5.327 55.728 0.100 1 1095 80
        i 4.133 56.001 0.490 3 41 127 0
        i 4.134 56.501 0.490 3 41 127 1
        i 4.135 57.501 0.490 3 41 127 2
        i 4.136 59.001 0.490 3 41 127 3
        i 4.137 61.001 0.490 3 41 127 4
        i 5.328 56.065 0.100 1 1097 63
        i 5.329 56.075 0.100 1 1096 80
        i 5.330 56.100 0.100 1 1099 58
        i 5.331 56.329 0.100 1 1096 57
        i 5.332 56.335 0.100 1 1089 54
        i 5.333 56.340 0.100 1 1103 61
        i 5.334 56.365 0.100 1 1102 64
        i 5.335 56.372 0.100 1 1105 49
        i 5.336 56.377 0.100 1 1098 55
        i 5.337 56.732 0.100 1 1094 62
        i 4.139 56.751 0.490 3 40 127 0
        i 4.140 57.251 0.490 3 40 127 1
        i 4.141 58.251 0.490 3 40 127 2
        i 4.142 59.751 0.490 3 40 127 3
        i 4.143 61.751 0.490 3 40 127 4
        i 5.338 56.875 0.100 1 1096 83
        i 5.339 56.933 0.100 1 1101 57
        i 5.340 56.936 0.100 1 1100 62
        i 5.341 57.001 0.100 1 1105 58
        i 5.342 57.025 0.100 1 1094 80
        i 5.343 57.056 0.100 1 1093 53
        i 5.344 57.176 0.100 1 1106 49
        i 5.345 57.213 0.100 1 1096 71
        i 5.346 57.501 0.100 1 1104 67
        i 5.347 57.560 0.100 1 1098 79
        i 5.348 57.577 0.100 1 1100 74
        i 5.349 57.696 0.100 1 1103 72
        i 5.350 57.809 0.100 1 1096 56
        i 5.351 57.904 0.100 1 1090 56
        i 5.352 57.920 0.100 1 1104 55
        i 5.353 57.931 0.100 1 1098 76
        i 5.354 58.156 0.100 1 1094 50
        i 5.355 58.231 0.100 1 1102 78
        i 5.356 58.305 0.100 1 1094 62
        i 5.357 58.421 0.100 1 1096 56
        i 5.358 58.533 0.100 1 1098 79
        i 5.359 58.645 0.100 1 1101 83
        i 5.360 58.668 0.100 1 1102 67
        i 5.361 58.743 0.100 1 1100 61
        i 5.362 58.780 0.100 1 1092 76
        i 5.363 58.844 0.100 1 1096 76
        i 5.364 58.920 0.100 1 1096 60
        i 5.365 59.080 0.100 1 1092 54
        i 5.366 59.269 0.100 1 1100 68
        i 5.367 59.279 0.100 1 1104 70
        i 5.368 59.375 0.100 1 1100 66
        i 5.369 59.385 0.100 1 1094 59
        i 5.370 59.496 0.100 1 1096 49
        i 5.371 59.504 0.100 1 1098 44
        i 5.372 59.611 0.100 1 1095 67
        i 5.373 59.619 0.100 1 1100 82
        i 5.374 59.731 0.100 1 1095 80
        i 5.375 59.816 0.100 1 1102 66
        i 5.376 59.948 0.100 1 1098 76
        i 4.145 60.001 0.490 3 36 127 0
        i 4.146 60.501 0.490 3 36 127 1
        i 4.147 61.501 0.490 3 36 127 2
        i 4.148 63.001 0.490 3 36 127 3
        i 4.149 65.001 0.490 3 36 127 4
        i 5.377 60.065 0.100 1 1102 69
        i 5.378 60.101 0.100 1 1088 48
        i 5.379 60.128 0.100 1 1098 75
        i 5.380 60.175 0.100 1 1104 76
        i 5.381 60.233 0.100 1 1097 56
        i 5.382 60.303 0.100 1 1094 66
        i 5.383 60.509 0.100 1 1096 55
        i 5.384 60.584 0.100 1 1095 84
        i 5.385 60.748 0.100 1 1104 53
        i 4.151 60.751 0.490 3 38 127 0
        i 4.152 61.251 0.490 3 38 127 1
        i 4.153 62.251 0.490 3 38 127 2
        i 4.154 63.751 0.490 3 38 127 3
        i 4.155 65.751 0.490 3 38 127 4
        i 5.386 60.788 0.100 1 1101 65
        i 5.387 60.873 0.100 1 1102 70
        i 5.388 60.879 0.100 1 1090 46
        i 5.389 60.907 0.100 1 1098 66
        i 5.390 60.933 0.100 1 1106 68
        i 5.391 60.943 0.100 1 1095 80
        i 5.392 61.231 0.100 1 1093 79
        i 5.393 61.349 0.100 1 1094 72
        i 5.394 61.352 0.100 1 1097 73
        i 5.395 61.395 0.100 1 1104 60
        i 5.396 61.420 0.100 1 1101 75
        i 5.397 61.597 0.100 1 1106 52
        i 5.398 61.648 0.100 1 1093 84
        i 5.399 61.836 0.100 1 1096 72
        i 5.400 61.892 0.100 1 1106 57
        i 5.401 62.088 0.100 1 1101 74
        i 5.402 62.092 0.100 1 1099 69
        i 5.403 62.111 0.100 1 1094 79
        i 5.404 62.219 0.100 1 1096 53
        i 5.405 62.265 0.100 1 1102 57
        i 5.406 62.336 0.100 1 1103 69
        i 5.407 62.343 0.100 1 1091 49
        i 5.408 62.492 0.100 1 1099 70
        i 5.409 62.661 0.100 1 1097 62
        i 5.410 62.701 0.100 1 1093 73
        i 5.411 62.731 0.100 1 1101 58
        i 5.412 63.008 0.100 1 1095 74
        i 5.413 63.131 0.100 1 1098 54
        i 5.414 63.149 0.100 1 1101 67
        i 5.415 63.175 0.100 1 1093 54
        i 5.416 63.205 0.100 1 1101 54
        i 5.417 63.236 0.100 1 1100 56
        i 5.418 63.348 0.100 1 1099 70
        i 5.419 63.387 0.100 1 1097 45
        i 5.420 63.592 0.100 1 1093 66
        i 5.421 63.689 0.100 1 1103 61
        i 5.422 63.892 0.100 1 1099 47
        i 5.423 63.917 0.100 1 1093 80
        i 5.424 63.928 0.100 1 1097 53
        i 5.425 63.928 0.100 1 1101 71
        i 5.426 63.935 0.100 1 1095 72
        i 5.427 63.935 0.100 1 1099 67
        i 4.157 64.001 0.490 3 41 127 0
        i 4.158 64.501 0.490 3 41 127 1
        i 4.159 65.501 0.490 3 41 127 2
        i 4.160 67.001 0.490 3 41 127 3
        i 4.161 69.001 0.490 3 41 127 4
        i 5.428 64.180 0.100 1 1096 74
        i 5.429 64.231 0.100 1 1095 69
        i 5.430 64.504 0.100 1 1103 79
        i 5.431 64.568 0.100 1 1089 45
        i 5.432 64.585 0.100 1 1103 73
        i 5.433 64.652 0.100 1 1103 83
        i 5.434 64.663 0.100 1 1097 77
        i 5.435 64.664 0.100 1 1101 76
        i 4.163 64.751 0.490 3 43 127 0
        i 4.164 65.251 0.490 3 43 127 1
        i 4.165 66.251 0.490 3 43 127 2
        i 4.166 67.751 0.490 3 43 127 3
        i 4.167 69.751 0.490 3 43 127 4
        i 5.436 64.785 0.100 1 1093 54
        i 5.437 64.824 0.100 1 1098 61
        i 5.438 65.076 0.100 1 1095 58
        i 5.439 65.096 0.100 1 1095 72
        i 5.440 65.169 0.100 1 1105 69
        i 5.441 65.195 0.100 1 1105 71
        i 5.442 65.211 0.100 1 1101 75
        i 5.443 65.245 0.100 1 1107 77
        i 5.444 65.344 0.100 1 1099 50
        i 5.445 65.423 0.100 1 1091 56
        i 5.446 65.493 0.100 1 1107 55
        i 5.447 65.555 0.100 1 1094 53
        i 5.448 65.731 0.100 1 1092 70
        i 5.449 65.795 0.100 1 1095 57
        i 5.450 65.823 0.100 1 1095 56
        i 5.451 65.829 0.100 1 1098 72
        i 5.452 65.877 0.100 1 1101 67
        i 5.453 66.005 0.100 1 1105 62
        i 5.454 66.133 0.100 1 1107 56
        i 5.455 66.237 0.100 1 1092 62
        i 5.456 66.381 0.100 1 1105 63
        i 5.457 66.389 0.100 1 1095 57
        i 5.458 66.461 0.100 1 1097 64
        i 5.459 66.600 0.100 1 1102 78
        i 5.460 66.624 0.100 1 1100 70
        i 5.461 66.645 0.100 1 1103 56
        i 5.462 66.660 0.100 1 1103 64
        i 5.463 66.701 0.100 1 1097 74
        i 5.464 66.755 0.100 1 1091 67
        i 5.465 66.833 0.100 1 1102 79
        i 5.466 66.937 0.100 1 1099 69
        i 5.467 67.060 0.100 1 1098 58
        i 5.468 67.176 0.100 1 1093 63
        i 5.469 67.231 0.100 1 1100 57
        i 5.470 67.441 0.100 1 1101 67
        i 5.471 67.541 0.100 1 1094 56
        i 5.472 67.595 0.100 1 1094 81
        i 5.473 67.604 0.100 1 1099 66
        i 5.474 67.628 0.100 1 1106 78
        i 5.475 67.649 0.100 1 1101 64
        i 5.476 67.728 0.100 1 1096 79
        i 5.477 67.783 0.100 1 1097 69
        i 5.478 67.825 0.100 1 1100 59
        i 4.169 68.001 0.490 3 36 127 0
        i 4.170 68.501 0.490 3 36 127 1
        i 4.171 69.501 0.490 3 36 127 2
        i 4.172 71.001 0.490 3 36 127 3
        i 4.173 73.001 0.490 3 36 127 4
        i 5.479 68.104 0.100 1 1094 73
        i 5.480 68.235 0.100 1 1103 78
        i 5.481 68.297 0.100 1 1104 54
        i 5.482 68.347 0.100 1 1094 79
        i 5.483 68.356 0.100 1 1100 67
        i 5.484 68.381 0.100 1 1098 80
        i 5.485 68.449 0.100 1 1092 53
        i 5.486 68.493 0.100 1 1102 63
        i 5.487 68.527 0.100 1 1098 77
        i 5.488 68.731 0.100 1 1096 61
        i 5.489 68.748 0.100 1 1097 82
        i 4.175 68.751 0.490 3 38 127 0
        i 4.176 69.251 0.490 3 38 127 1
        i 4.177 70.251 0.490 3 38 127 2
        i 4.178 71.751 0.490 3 38 127 3
        i 4.179 73.751 0.490 3 38 127 4
        i 5.490 68.995 0.100 1 1104 71
        i 5.491 69.075 0.100 1 1100 52
        i 5.492 69.109 0.100 1 1090 44
        i 5.493 69.129 0.100 1 1102 62
        i 5.494 69.191 0.100 1 1104 83
        i 5.495 69.243 0.100 1 1092 52
        i 5.496 69.249 0.100 1 1098 77
        i 5.497 69.264 0.100 1 1096 74
        i 5.498 69.413 0.100 1 1099 53
        i 5.499 69.535 0.100 1 1096 60
        i 5.500 69.607 0.100 1 1094 82
        i 5.501 69.633 0.100 1 1100 78
        i 5.502 69.741 0.100 1 1094 62
        i 5.503 69.757 0.100 1 1100 79
        i 5.504 69.768 0.100 1 1106 54
        i 5.505 69.940 0.100 1 1106 66
        i 5.506 70.043 0.100 1 1092 71
        i 5.507 70.092 0.100 1 1106 53
        i 5.508 70.165 0.100 1 1093 57
        i 5.509 70.229 0.100 1 1092 53
        i 5.510 70.261 0.100 1 1098 65
        i 5.511 70.307 0.100 1 1098 62
        i 5.512 70.335 0.100 1 1100 58
        i 5.513 70.339 0.100 1 1096 69
        i 5.514 70.545 0.100 1 1108 63
        i 5.515 70.631 0.100 1 1104 77
        i 5.516 70.675 0.100 1 1104 71
        i 5.517 70.772 0.100 1 1098 59
        i 5.518 70.827 0.100 1 1091 54
        i 5.519 70.931 0.100 1 1094 75
        i 5.520 71.083 0.100 1 1102 76
        i 5.521 71.109 0.100 1 1101 70
        i 5.522 71.156 0.100 1 1100 77
        i 5.523 71.168 0.100 1 1092 64
        i 5.524 71.213 0.100 1 1104 62
        i 5.525 71.301 0.100 1 1098 75
        i 5.526 71.384 0.100 1 1100 73
        i 5.527 71.401 0.100 1 1101 72
        i 5.528 71.528 0.100 1 1096 54
        i 5.529 71.639 0.100 1 1092 51
        i 5.530 71.728 0.100 1 1099 73
        i 5.531 71.909 0.100 1 1094 50
        i 5.532 71.973 0.100 1 1100 78
        i 4.181 72.001 0.490 3 41 127 0
        i 4.182 72.501 0.490 3 41 127 1
        i 4.183 73.501 0.490 3 41 127 2
        i 4.184 75.001 0.490 3 41 127 3
        i 4.185 77.001 0.490 3 41 127 4
        i 5.533 72.012 0.100 1 1106 70
        i 5.534 72.016 0.100 1 1100 53
        i 5.535 72.036 0.100 1 1102 80
        i 5.536 72.048 0.100 1 1105 73
        i 5.537 72.132 0.100 1 1093 71
        i 5.538 72.168 0.100 1 1098 66
        i 5.539 72.389 0.100 1 1099 71
        i 5.540 72.612 0.100 1 1095 72
        i 5.541 72.691 0.100 1 1098 56
        i 4.187 72.751 0.490 3 40 127 0
        i 4.188 73.251 0.490 3 40 127 1
        i 4.189 74.251 0.490 3 40 127 2
        i 4.190 75.751 0.490 3 40 127 3
        i 4.191 77.751 0.490 3 40 127 4
        i 5.542 72.760 0.100 1 1093 69
        i 5.543 72.820 0.100 1 1100 50
        i 5.544 72.833 0.100 1 1103 70
        i 5.545 72.835 0.100 1 1102 59
        i 5.546 72.932 0.100 1 1093 82
        i 5.547 72.937 0.100 1 1102 58
        i 5.548 72.943 0.100 1 1098 54
        i 5.549 73.227 0.100 1 1097 68
        i 5.550 73.291 0.100 1 1097 66
        i 5.551 73.383 0.100 1 1097 63
        i 5.552 73.487 0.100 1 1100 78
        i 5.553 73.557 0.100 1 1101 82
        i 5.554 73.633 0.100 1 1099 50
        i 5.555 73.652 0.100 1 1091 55
        i 5.556 73.701 0.100 1 1091 71
        i 5.557 73.756 0.100 1 1105 73
        i 5.558 73.907 0.100 1 1095 64
        i 5.559 73.977 0.100 1 1100 56
        i 5.560 74.109 0.100 1 1099 62
        i 5.561 74.115 0.100 1 1093 59
        i 5.562 74.197 0.100 1 1099 53
        i 5.563 74.233 0.100 1 1101 65
        i 5.564 74.367 0.100 1 1106 55
        i 5.565 74.428 0.100 1 1095 61
        i 5.566 74.429 0.100 1 1105 62
        i 5.567 74.572 0.100 1 1105 58
        i 5.568 74.641 0.100 1 1093 51
        i 5.569 74.725 0.100 1 1091 53
        i 5.570 74.752 0.100 1 1092 82
        i 5.571 74.776 0.100 1 1097 59
        i 5.572 74.837 0.100 1 1099 61
        i 5.573 74.856 0.100 1 1099 72
        i 5.574 74.953 0.100 1 1097 53
        i 5.575 74.956 0.100 1 1107 69
        i 5.576 75.009 0.100 1 1103 56
        i 5.577 75.255 0.100 1 1103 50
        i 5.578 75.392 0.100 1 1092 61
        i 5.579 75.452 0.100 1 1093 51
        i 5.580 75.576 0.100 1 1101 78
        i 5.581 75.617 0.100 1 1101 74
        i 5.582 75.620 0.100 1 1095 73
        i 5.583 75.644 0.100 1 1093 63
        i 5.584 75.741 0.100 1 1101 59
        i 5.585 75.873 0.100 1 1101 58
        i 5.586 75.899 0.100 1 1099 51
        i 5.587 75.945 0.100 1 1100 69
        i 4.193 76.001 0.490 3 40 127 0
        i 4.194 76.501 0.490 3 40 127 1
        i 4.195 77.501 0.490 3 40 127 2
        i 4.196 79.001 0.490 3 40 127 3
        i 4.197 81.001 0.490 3 40 127 4
        i 5.588 76.059 0.100 1 1105 60
        i 5.589 76.083 0.100 1 1091 73
        i 5.590 76.224 0.100 1 1099 80
        i 5.591 76.228 0.100 1 1105 61
        i 5.592 76.341 0.100 1 1095 72
        i 5.593 76.345 0.100 1 1099 54
        i 5.594 76.425 0.100 1 1101 57
        i 5.595 76.633 0.100 1 1099 68
        i 5.596 76.636 0.100 1 1107 72
        i 5.597 76.663 0.100 1 1093 73
        i 5.598 76.680 0.100 1 1103 59
        i 5.599 76.737 0.100 1 1109 78
        i 4.199 76.751 0.490 3 38 127 0
        i 4.200 77.251 0.490 3 38 127 1
        i 4.201 78.251 0.490 3 38 127 2
        i 4.202 79.751 0.490 3 38 127 3
        i 4.203 81.751 0.490 3 38 127 4
        i 5.600 76.912 0.100 1 1098 76
        i 5.601 77.101 0.100 1 1102 78
        i 5.602 77.120 0.100 1 1096 65
        i 5.603 77.180 0.100 1 1097 59
        i 5.604 77.236 0.100 1 1093 75
        i 5.605 77.261 0.100 1 1103 75
        i 5.606 77.364 0.100 1 1099 44
        i 5.607 77.408 0.100 1 1094 82
        i 5.608 77.421 0.100 1 1101 74
        i 5.609 77.432 0.100 1 1097 71
        i 5.610 77.621 0.100 1 1107 72
        i 5.611 77.723 0.100 1 1098 75
        i 5.612 77.739 0.100 1 1098 76
        i 5.613 77.792 0.100 1 1098 75
        i 5.614 77.959 0.100 1 1099 77
        i 5.615 77.979 0.100 1 1100 59
        i 5.616 78.017 0.100 1 1099 60
        i 5.617 78.200 0.100 1 1105 82
        i 5.618 78.223 0.100 1 1091 63
        i 5.619 78.243 0.100 1 1095 79
        i 5.620 78.273 0.100 1 1091 59
        i 5.621 78.500 0.100 1 1100 65
        i 5.622 78.529 0.100 1 1104 51
        i 5.623 78.585 0.100 1 1098 83
        i 5.624 78.623 0.100 1 1092 82
        i 5.625 78.641 0.100 1 1100 51
        i 5.626 78.735 0.100 1 1104 57
        i 5.627 78.800 0.100 1 1100 55
        i 5.628 78.876 0.100 1 1105 72
        i 5.629 78.892 0.100 1 1107 57
        i 5.630 78.992 0.100 1 1095 52
        i 5.631 79.185 0.100 1 1093 55
        i 5.632 79.221 0.100 1 1090 66
        i 5.633 79.228 0.100 1 1106 66
        i 5.634 79.296 0.100 1 1092 58
        i 5.635 79.308 0.100 1 1096 79
        i 5.636 79.368 0.100 1 1100 60
        i 5.637 79.452 0.100 1 1102 64
        i 5.638 79.468 0.100 1 1098 72
        i 5.639 79.491 0.100 1 1107 73
        i 5.640 79.639 0.100 1 1098 53
        i 5.641 79.639 0.100 1 1102 57
        i 5.642 79.740 0.100 1 1100 66
        i 5.643 79.915 0.100 1 1093 59
        i 5.644 79.917 0.100 1 1092 45
        i 4.205 80.001 0.490 3 36 127 0
        i 4.206 80.501 0.490 3 36 127 1
        i 4.207 81.501 0.490 3 36 127 2
        i 4.208 83.001 0.490 3 36 127 3
        i 4.209 85.001 0.490 3 36 127 4
        i 5.645 80.125 0.100 1 1100 82
        i 5.646 80.140 0.100 1 1100 80
        i 5.647 80.211 0.100 1 1094 55
        i 5.648 80.239 0.100 1 1094 76
        i 5.649 80.327 0.100 1 1102 82
        i 5.650 80.361 0.100 1 1100 64
        i 5.651 80.435 0.100 1 1102 64
        i 5.652 80.447 0.100 1 1099 75
        i 5.653 80.460 0.100 1 1098 75
        i 5.654 80.469 0.100 1 1090 73
        i 5.655 80.616 0.100 1 1106 59
        i 5.656 80.721 0.100 1 1098 53
        i 4.211 80.751 0.490 3 36 127 0
        i 4.212 81.251 0.490 3 36 127 1
        i 4.213 82.251 0.490 3 36 127 2
        i 4.214 83.751 0.490 3 36 127 3
        i 4.215 85.751 0.490 3 36 127 4
        i 5.657 80.788 0.100 1 1098 78
        i 5.658 80.863 0.100 1 1096 67
        i 5.659 80.935 0.100 1 1104 54
        i 5.660 81.023 0.100 1 1102 56
        i 5.661 81.097 0.100 1 1100 51
        i 5.662 81.193 0.100 1 1092 57
        i 5.663 81.260 0.100 1 1108 77
        i 5.664 81.389 0.100 1 1108 68
        i 5.665 81.392 0.100 1 1097 62
        i 5.666 81.395 0.100 1 1104 61
        i 5.667 81.583 0.100 1 1104 70
        i 5.668 81.629 0.100 1 1096 58
        i 5.669 81.803 0.100 1 1092 71
        i 5.670 81.831 0.100 1 1100 69
        i 5.671 81.884 0.100 1 1094 70
        i 5.672 81.895 0.100 1 1102 79
        i 5.673 81.905 0.100 1 1098 69
        i 5.674 81.993 0.100 1 1096 57
        i 5.675 82.024 0.100 1 1098 74
        i 5.676 82.221 0.100 1 1099 69
        i 5.677 82.251 0.100 1 1099 60
        i 5.678 82.252 0.100 1 1106 53
        i 5.679 82.399 0.100 1 1100 68
        i 5.680 82.524 0.100 1 1106 81
        i 5.681 82.555 0.100 1 1098 73
        i 5.682 82.620 0.100 1 1098 80
        i 5.683 82.641 0.100 1 1100 77
        i 5.684 82.649 0.100 1 1096 57
        i 5.685 82.773 0.100 1 1090 49
        i 5.686 82.893 0.100 1 1092 74
        i 5.687 82.907 0.100 1 1104 71
        i 5.688 82.981 0.100 1 1101 81
        i 5.689 83.060 0.100 1 1097 73
        i 5.690 83.133 0.100 1 1091 72
        i 5.691 83.145 0.100 1 1104 52
        i 5.692 83.300 0.100 1 1108 49
        i 5.693 83.395 0.100 1 1100 65
        i 5.694 83.437 0.100 1 1096 70
        i 5.695 83.437 0.100 1 1104 66
        i 5.696 83.463 0.100 1 1107 56
        i 5.697 83.609 0.100 1 1101 56
        i 5.698 83.721 0.100 1 1091 59
        i 5.699 83.727 0.100 1 1094 51
        i 5.700 83.799 0.100 1 1091 78
        i 5.701 83.897 0.100 1 1101 82
        i 5.702 84.021 0.100 1 1102 48
        i 5.703 84.087 0.100 1 1106 79
        i 5.704 84.107 0.100 1 1097 59
        i 5.705 84.168 0.100 1 1102 76
        i 5.706 84.204 0.100 1 1098 84
        i 5.707 84.228 0.100 1 1099 60
        i 5.708 84.364 0.100 1 1095 51
        i 5.709 84.380 0.100 1 1092 53
        i 5.710 84.396 0.100 1 1093 62
        i 5.711 84.637 0.100 1 1099 61
        i 5.712 84.769 0.100 1 1100 50
        i 5.713 84.777 0.100 1 1107 74
        i 5.714 84.804 0.100 1 1095 73
        i 5.715 84.825 0.100 1 1099 63
        i 5.716 84.885 0.100 1 1103 59
        i 5.717 84.907 0.100 1 1099 69
        i 5.718 84.907 0.100 1 1089 62
        i 5.719 84.997 0.100 1 1103 73
        i 5.720 85.203 0.100 1 1099 78
        i 5.721 85.221 0.100 1 1097 67
        i 5.722 85.347 0.100 1 1093 71
        i 5.723 85.352 0.100 1 1097 83
        i 5.724 85.411 0.100 1 1097 76
        i 5.725 85.613 0.100 1 1099 55
        i 5.726 85.619 0.100 1 1102 66
        i 5.727 85.643 0.100 1 1109 49
        i 5.728 85.697 0.100 1 1093 61
        i 5.729 85.831 0.100 1 1096 53
        i 5.730 85.884 0.100 1 1105 49
        i 4.217 86.001 0.490 3 36 127 0
        i 4.218 86.501 0.490 3 36 127 1
        i 4.219 87.501 0.490 3 36 127 2
        i 4.220 89.001 0.490 3 36 127 3
        i 4.221 91.001 0.490 3 36 127 4
        i 5.731 86.021 0.100 1 1107 55
        i 5.732 86.025 0.100 1 1105 71
        i 5.733 86.131 0.100 1 1103 56
        i 5.734 86.141 0.100 1 1097 61
        i 5.735 86.240 0.100 1 1099 57
        i 5.736 86.333 0.100 1 1095 64
        i 5.737 86.396 0.100 1 1091 66
        i 5.738 86.441 0.100 1 1095 70
        i 5.739 86.500 0.100 1 1097 53
        i 5.740 86.628 0.100 1 1099 64
        i 5.741 86.631 0.100 1 1105 56
        i 5.742 86.667 0.100 1 1100 76
        i 5.743 86.721 0.100 1 1099 74
        i 4.223 86.751 0.490 3 36 127 0
        i 4.224 87.251 0.490 3 36 127 1
        i 4.225 88.251 0.490 3 36 127 2
        i 4.226 89.751 0.490 3 36 127 3
        i 4.227 91.751 0.490 3 36 127 4
        i 5.744 86.845 0.100 1 1105 77
        i 5.745 86.875 0.100 1 1099 65
        i 5.746 86.943 0.100 1 1097 71
        i 5.747 87.084 0.100 1 1101 61
        i 5.748 87.152 0.100 1 1097 61
        i 5.749 87.232 0.100 1 1105 51
        i 5.750 87.233 0.100 1 1101 79
        i 5.751 87.321 0.100 1 1089 51
        i 5.752 87.419 0.100 1 1102 74
        i 5.753 87.435 0.100 1 1093 59
        i 5.754 87.591 0.100 1 1097 63
        i 5.755 87.645 0.100 1 1091 83
        i 5.756 87.711 0.100 1 1107 59
        i 5.757 87.812 0.100 1 1097 55
        i 5.758 87.885 0.100 1 1103 49
        i 5.759 87.897 0.100 1 1099 61
        i 5.760 87.959 0.100 1 1103 49
        i 5.761 87.988 0.100 1 1099 55
        i 5.762 88.043 0.100 1 1107 56
        i 5.763 88.191 0.100 1 1095 43
        i 5.764 88.221 0.100 1 1092 68
        i 5.765 88.257 0.100 1 1092 80
        i 5.766 88.483 0.100 1 1102 64
        i 5.767 88.615 0.100 1 1101 77
        i 5.768 88.685 0.100 1 1105 63
        i 5.769 88.700 0.100 1 1099 70
        i 5.770 88.745 0.100 1 1097 68
        i 5.771 88.767 0.100 1 1091 45
        i 5.772 88.769 0.100 1 1101 50
        i 5.773 88.821 0.100 1 1101 68
        i 5.774 88.833 0.100 1 1094 84
        i 5.775 89.025 0.100 1 1099 76
        i 5.776 89.149 0.100 1 1098 75
        i 5.777 89.151 0.100 1 1107 58
        i 5.778 89.191 0.100 1 1101 49
        i 5.779 89.345 0.100 1 1098 65
        i 5.780 89.372 0.100 1 1089 56
        i 5.781 89.396 0.100 1 1111 79
        i 5.782 89.399 0.100 1 1095 52
        i 5.783 89.416 0.100 1 1104 66
        i 5.784 89.441 0.100 1 1099 77
        i 5.785 89.444 0.100 1 1103 72
        i 5.786 89.664 0.100 1 1094 67
        i 5.787 89.721 0.100 1 1096 74
        i 5.788 89.799 0.100 1 1100 54
        i 5.789 89.923 0.100 1 1108 50
        i 5.790 89.961 0.100 1 1098 53
        i 5.791 90.037 0.100 1 1097 68
        i 5.792 90.067 0.100 1 1108 51
        i 5.793 90.155 0.100 1 1103 75
        i 5.794 90.157 0.100 1 1099 62
        i 5.795 90.173 0.100 1 1094 63
        i 5.796 90.176 0.100 1 1105 56
        i 5.797 90.248 0.100 1 1096 77
        i 5.798 90.363 0.100 1 1106 68
        i 5.799 90.559 0.100 1 1094 69
        i 5.800 90.589 0.100 1 1106 73
        i 5.801 90.599 0.100 1 1104 78
        i 5.802 90.653 0.100 1 1098 56
        i 5.803 90.723 0.100 1 1099 56
        i 5.804 90.755 0.100 1 1096 58
        i 5.805 90.863 0.100 1 1100 59
        i 5.806 90.888 0.100 1 1096 75
        i 5.807 90.933 0.100 1 1090 75
        i 5.808 91.009 0.100 1 1104 61
        i 5.809 91.063 0.100 1 1101 53
        i 5.810 91.121 0.100 1 1096 55
        i 5.811 91.221 0.100 1 1100 53
        i 5.812 91.221 0.100 1 1106 55
        i 5.813 91.288 0.100 1 1104 83
        i 5.814 91.351 0.100 1 1098 71
        i 5.815 91.431 0.100 1 1102 79
        i 5.816 91.541 0.100 1 1098 69
        i 5.817 91.625 0.100 1 1096 73
        i 5.818 91.688 0.100 1 1102 76
        i 5.819 91.803 0.100 1 1102 55
        i 5.820 91.813 0.100 1 1090 66
        i 5.821 91.836 0.100 1 1103 53
        i 5.822 91.864 0.100 1 1106 64
        i 5.823 91.979 0.100 1 1094 69
        i 4.229 92.001 0.490 3 36 127 0
        i 4.230 92.501 0.490 3 36 127 1
        i 4.231 93.501 0.490 3 36 127 2
        i 4.232 95.001 0.490 3 36 127 3
        i 4.233 97.001 0.490 3 36 127 4
        i 5.824 92.121 0.100 1 1096 57
        i 5.825 92.133 0.100 1 1098 82
        i 5.826 92.156 0.100 1 1090 77
        i 5.827 92.256 0.100 1 1106 51
        i 5.828 92.296 0.100 1 1100 81
        i 5.829 92.447 0.100 1 1102 65
        i 5.830 92.521 0.100 1 1100 73
        i 5.831 92.525 0.100 1 1098 49
        i 5.832 92.633 0.100 1 1102 58
        i 5.833 92.656 0.100 1 1096 71
        i 5.834 92.696 0.100 1 1093 70
        i 5.835 92.720 0.100 1 1092 69
        i 4.235 92.751 0.490 3 36 127 0
        i 4.236 93.251 0.490 3 36 127 1
        i 4.237 94.251 0.490 3 36 127 2
        i 4.238 95.751 0.490 3 36 127 3
        i 4.239 97.751 0.490 3 36 127 4
        i 5.836 92.801 0.100 1 1108 59
        i 5.837 93.037 0.100 1 1110 51
        i 5.838 93.068 0.100 1 1102 69
        i 5.839 93.096 0.100 1 1104 68
        i 5.840 93.125 0.100 1 1100 66
        i 5.841 93.160 0.100 1 1090 59
        i 5.842 93.197 0.100 1 1100 74
        i 5.843 93.200 0.100 1 1100 71
        i 5.844 93.251 0.100 1 1095 80
        i 5.845 93.328 0.100 1 1096 74
        i 5.846 93.409 0.100 1 1100 72
        i 5.847 93.529 0.100 1 1098 73
        i 5.848 93.659 0.100 1 1097 68
        i 5.849 93.784 0.100 1 1097 80
        i 5.850 93.789 0.100 1 1102 69
        i 5.851 93.843 0.100 1 1088 44
        i 5.852 93.852 0.100 1 1108 61
        i 5.853 93.887 0.100 1 1108 65
        i 5.854 93.929 0.100 1 1104 50
        i 5.855 93.936 0.100 1 1096 63
        i 5.856 93.947 0.100 1 1104 54
        i 5.857 93.988 0.100 1 1098 80
        i 5.858 94.033 0.100 1 1102 57
        i 5.859 94.048 0.100 1 1100 70
        i 5.860 94.219 0.100 1 1095 62
        i 5.861 94.453 0.100 1 1098 49
        i 5.862 94.464 0.100 1 1105 48
        i 5.863 94.507 0.100 1 1106 53
        i 5.864 94.567 0.100 1 1104 75
        i 5.865 94.581 0.100 1 1108 55
        i 5.866 94.649 0.100 1 1095 76
        i 5.867 94.664 0.100 1 1095 69
        i 5.868 94.704 0.100 1 1096 69
        i 5.869 94.705 0.100 1 1098 59
        i 5.870 94.739 0.100 1 1106 77
        i 5.871 94.964 0.100 1 1094 65
        i 5.872 95.156 0.100 1 1100 59
        i 5.873 95.161 0.100 1 1099 59
        i 5.874 95.176 0.100 1 1097 78
        i 5.875 95.273 0.100 1 1106 80
        i 5.876 95.323 0.100 1 1098 57
        i 5.877 95.372 0.100 1 1096 75
        i 5.878 95.373 0.100 1 1107 74
        i 5.879 95.380 0.100 1 1089 51
        i 5.880 95.457 0.100 1 1101 53
        i 5.881 95.639 0.100 1 1103 50
        i 5.882 95.664 0.100 1 1096 44
        i 5.883 95.717 0.100 1 1101 70
        i 5.884 95.771 0.100 1 1094 55
        i 5.885 95.827 0.100 1 1097 79
        i 5.886 95.851 0.100 1 1103 82
        i 4.241 96.001 0.490 3 36 127 0
        i 4.242 96.501 0.490 3 36 127 1
        i 4.243 97.501 0.490 3 36 127 2
        i 4.244 99.001 0.490 3 36 127 3
        i 4.245 101.001 0.490 3 36 127 4
        i 5.887 96.037 0.100 1 1096 49
        i 5.888 96.081 0.100 1 1101 63
        i 5.889 96.111 0.100 1 1103 52
        i 5.890 96.180 0.100 1 1099 66
        i 5.891 96.216 0.100 1 1091 61
        i 5.892 96.252 0.100 1 1103 62
        i 5.893 96.443 0.100 1 1095 73
        i 5.894 96.531 0.100 1 1107 61
        i 5.895 96.575 0.100 1 1099 68
        i 5.896 96.652 0.100 1 1095 62
        i 5.897 96.664 0.100 1 1091 83
        i 5.898 96.731 0.100 1 1101 70
        i 4.247 96.751 0.490 3 36 127 0
        i 4.248 97.251 0.490 3 36 127 1
        i 4.249 98.251 0.490 3 36 127 2
        i 4.250 99.751 0.490 3 36 127 3
        i 4.251 101.751 0.490 3 36 127 4
        i 5.899 96.856 0.100 1 1106 59
        i 5.900 96.931 0.100 1 1101 62
        i 5.901 96.945 0.100 1 1101 60
        i 5.902 96.972 0.100 1 1097 78
        i 5.903 97.041 0.100 1 1097 51
        i 5.904 97.077 0.100 1 1099 75
        i 5.905 97.133 0.100 1 1094 58
        i 5.906 97.213 0.100 1 1109 61
        i 5.907 97.216 0.100 1 1093 74
        i 5.908 97.445 0.100 1 1101 70
        i 5.909 97.508 0.100 1 1099 68
        i 5.910 97.508 0.100 1 1103 78
        i 5.911 97.623 0.100 1 1089 72
        i 5.912 97.652 0.100 1 1103 73
        i 5.913 97.667 0.100 1 1096 76
        i 5.914 97.732 0.100 1 1099 57
        i 5.915 97.739 0.100 1 1099 75
        i 5.916 97.740 0.100 1 1099 78
        i 5.917 97.820 0.100 1 1095 58
        i 5.918 97.881 0.100 1 1109 52
        i 5.919 98.167 0.100 1 1097 80
        i 5.920 98.223 0.100 1 1096 72
        i 5.921 98.375 0.100 1 1105 64
        i 5.922 98.383 0.100 1 1097 52
        i 5.923 98.384 0.100 1 1089 48
        i 5.924 98.388 0.100 1 1103 60
        i 5.925 98.429 0.100 1 1097 65
        i 5.926 98.476 0.100 1 1103 75
        i 5.927 98.476 0.100 1 1101 69
        i 5.928 98.497 0.100 1 1101 79
        i 5.929 98.639 0.100 1 1109 56
        i 5.930 98.715 0.100 1 1095 55
        i 5.931 98.781 0.100 1 1107 62
        i 5.932 98.912 0.100 1 1099 56
        i 5.933 98.952 0.100 1 1107 79
        i 5.934 98.977 0.100 1 1105 61
        i 5.935 99.081 0.100 1 1094 65
        i 5.936 99.124 0.100 1 1095 54
        i 5.937 99.165 0.100 1 1107 69
        i 5.938 99.245 0.100 1 1103 65
        i 5.939 99.267 0.100 1 1095 62
        i 5.940 99.325 0.100 1 1097 67
        i 5.941 99.421 0.100 1 1105 56
        i 5.942 99.653 0.100 1 1098 60
        i 5.943 99.669 0.100 1 1100 61
        i 5.944 99.680 0.100 1 1105 74
        i 5.945 99.793 0.100 1 1089 80
        i 5.946 99.812 0.100 1 1101 72
        i 5.947 99.853 0.100 1 1102 76
        i 5.948 99.920 0.100 1 1097 51
        i 5.949 99.933 0.100 1 1097 74
        i 5.950 99.957 0.100 1 1105 65
        i 4.253 100.001 0.490 3 36 127 0
        i 4.254 100.501 0.490 3 36 127 1
        i 4.255 101.501 0.490 3 36 127 2
        i 4.256 103.001 0.490 3 36 127 3
        i 4.257 105.001 0.490 3 36 127 4
        i 5.951 100.205 0.100 1 1095 55
        i 5.952 100.213 0.100 1 1102 66
        i 5.953 100.228 0.100 1 1093 51
        i 5.954 100.269 0.100 1 1103 77
        i 5.955 100.359 0.100 1 1096 56
        i 5.956 100.447 0.100 1 1097 61
        i 5.957 100.484 0.100 1 1107 72
        i 5.958 100.501 0.100 1 1103 63
        i 5.959 100.547 0.100 1 1103 59
        i 5.960 100.584 0.100 1 1091 72
        i 5.961 100.669 0.100 1 1102 52
        i 4.259 100.751 0.490 3 36 127 0
        i 4.260 101.251 0.490 3 36 127 1
        i 4.261 102.251 0.490 3 36 127 2
        i 4.262 103.751 0.490 3 36 127 3
        i 4.263 105.751 0.490 3 36 127 4
        i 5.962 100.896 0.100 1 1099 50
        i 5.963 100.907 0.100 1 1095 70
        i 5.964 100.908 0.100 1 1108 59
        i 5.965 100.947 0.100 1 1095 79
        i 5.966 101.104 0.100 1 1099 63
        i 5.967 101.160 0.100 1 1100 73
        i 5.968 101.172 0.100 1 1092 71
        i 5.969 101.239 0.100 1 1094 59
        i 5.970 101.385 0.100 1 1096 78
        i 5.971 101.428 0.100 1 1097 62
        i 5.972 101.443 0.100 1 1105 57
        i 5.973 101.479 0.100 1 1100 61
        i 5.974 101.480 0.100 1 1110 61
        i 5.975 101.492 0.100 1 1101 58
        i 5.976 101.572 0.100 1 1094 57
        i 5.977 101.713 0.100 1 1094 65
        i 5.978 101.853 0.100 1 1102 79
        i 5.979 101.900 0.100 1 1101 81
        i 5.980 101.980 0.100 1 1103 50
        i 4.265 102.001 0.490 3 36 127 0
        i 4.266 102.501 0.490 3 36 127 1
        i 4.267 103.501 0.490 3 36 127 2
        i 4.268 105.001 0.490 3 36 127 3
        i 4.269 107.001 0.490 3 36 127 4
        i 5.981 102.031 0.100 1 1112 49
        i 5.982 102.084 0.100 1 1097 66
        i 5.983 102.088 0.100 1 1088 67
        i 5.984 102.147 0.100 1 1098 58
        i 5.985 102.153 0.100 1 1098 67
        i 5.986 102.184 0.100 1 1104 84
        i 5.987 102.188 0.100 1 1100 48
        i 5.988 102.261 0.100 1 1100 54
        i 5.989 102.277 0.100 1 1094 68
        i 5.990 102.589 0.100 1 1098 56
        i 5.991 102.661 0.100 1 1095 66
        i 5.992 102.676 0.100 1 1096 62
        i 4.271 102.751 0.490 3 36 127 0
        i 4.272 103.251 0.490 3 36 127 1
        i 4.273 104.251 0.490 3 36 127 2
        i 4.274 105.751 0.490 3 36 127 3
        i 5.993 102.749 0.100 1 1096 63
        i 4.275 107.751 0.490 3 36 127 4
        i 5.994 102.796 0.100 1 1098 64
        i 5.995 102.863 0.100 1 1110 60
        i 5.996 102.913 0.100 1 1103 73
        i 5.997 102.928 0.100 1 1090 65
        i 5.998 102.936 0.100 1 1106 48
        i 5.999 102.953 0.100 1 1102 57
        i 5.001 103.027 0.100 1 1108 62
        i 5.002 103.099 0.100 1 1108 79
        i 5.003 103.213 0.100 1 1094 81
        i 5.004 103.251 0.100 1 1102 64
        i 5.005 103.369 0.100 1 1100 69
        i 5.006 103.499 0.100 1 1093 72
        i 5.007 103.512 0.100 1 1106 66
        i 5.008 103.513 0.100 1 1102 74
        i 5.009 103.547 0.100 1 1096 83
        i 5.010 103.668 0.100 1 1106 51
        i 5.011 103.708 0.100 1 1094 58
        i 5.012 103.712 0.100 1 1106 65
        i 5.013 103.775 0.100 1 1106 72
        i 5.014 103.808 0.100 1 1104 73
        i 5.015 103.911 0.100 1 1096 47
        i 4.277 104.001 0.490 3 36 127 0
        i 4.278 104.501 0.490 3 36 127 1
        i 4.279 105.501 0.490 3 36 127 2
        i 4.280 107.001 0.490 3 36 127 3
        i 4.281 109.001 0.490 3 36 127 4
        i 5.016 104.053 0.100 1 1104 79
        i 4.283 104.125 0.490 3 43 127 0
        i 4.284 104.625 0.490 3 43 127 1
        i 4.285 105.625 0.490 3 43 127 2
        i 4.286 107.125 0.490 3 43 127 3
        i 4.287 109.125 0.490 3 43 127 4
        i 5.017 104.131 0.100 1 1098 72
        i 5.018 104.173 0.100 1 1104 69
        i 5.019 104.180 0.100 1 1100 56
        i 5.020 104.205 0.100 1 1090 60
        i 5.021 104.249 0.100 1 1103 66
        i 5.022 104.383 0.100 1 1096 71
        i 5.023 104.495 0.100 1 1098 51
        i 5.024 104.520 0.100 1 1104 69
        i 5.025 104.527 0.100 1 1106 69
        i 5.026 104.643 0.100 1 1102 74
        i 5.027 104.647 0.100 1 1102 69
        i 5.028 104.713 0.100 1 1101 79
        i 5.029 104.713 0.100 1 1094 63
        i 4.289 104.751 0.490 3 36 127 0
        i 4.290 105.251 0.490 3 36 127 1
        i 4.291 106.251 0.490 3 36 127 2
        i 4.292 107.751 0.490 3 36 127 3
        i 4.293 109.751 0.490 3 36 127 4
        i 5.030 104.751 0.100 1 1106 75
        i 4.295 104.876 0.490 3 43 127 0
        i 4.296 105.376 0.490 3 43 127 1
        i 4.297 106.376 0.490 3 43 127 2
        i 4.298 107.876 0.490 3 43 127 3
        i 4.299 109.876 0.490 3 43 127 4
        i 5.031 104.891 0.100 1 1096 67
        i 5.032 104.951 0.100 1 1092 75
        i 5.033 105.044 0.100 1 1098 57
        i 5.034 105.044 0.100 1 1108 74
        i 5.035 105.068 0.100 1 1094 67
        i 5.036 105.087 0.100 1 1101 75
        i 5.037 105.156 0.100 1 1104 57
        i 5.038 105.185 0.100 1 1102 80
        i 5.039 105.264 0.100 1 1108 80
        i 5.040 105.336 0.100 1 1096 67
        i 5.041 105.379 0.100 1 1100 76
        i 5.042 105.580 0.100 1 1104 76
        i 5.043 105.684 0.100 1 1093 79
        i 5.044 105.699 0.100 1 1096 71
        i 5.045 105.704 0.100 1 1100 58
        i 5.046 105.764 0.100 1 1100 56
        i 5.047 105.764 0.100 1 1100 73
        i 5.048 105.797 0.100 1 1096 57
        i 5.049 105.825 0.100 1 1093 64
        i 5.050 105.852 0.100 1 1104 54
        i 5.051 105.895 0.100 1 1098 60
        i 5.052 105.937 0.100 1 1100 75
        i 4.301 106.001 0.490 3 36 127 0
        i 4.302 106.501 0.490 3 36 127 1
        i 4.303 107.501 0.490 3 36 127 2
        i 4.304 109.001 0.490 3 36 127 3
        i 4.305 111.001 0.490 3 36 127 4
        i 5.053 106.011 0.100 1 1095 53
        i 5.054 106.089 0.100 1 1110 63
        i 4.307 106.125 0.490 3 43 127 0
        i 4.308 106.625 0.490 3 43 127 1
        i 4.309 107.625 0.490 3 43 127 2
        i 4.310 109.125 0.490 3 43 127 3
        i 4.311 111.125 0.490 3 43 127 4
        i 5.055 106.213 0.100 1 1095 64
        i 5.056 106.296 0.100 1 1102 71
        i 5.057 106.332 0.100 1 1102 66
        i 5.058 106.344 0.100 1 1101 62
        i 5.059 106.439 0.100 1 1098 57
        i 5.060 106.523 0.100 1 1097 82
        i 5.061 106.537 0.100 1 1098 73
        i 5.062 106.564 0.100 1 1100 69
        i 5.063 106.576 0.100 1 1102 70
        i 5.064 106.632 0.100 1 1088 61
        i 5.065 106.716 0.100 1 1103 52
        i 5.066 106.735 0.100 1 1093 58
        i 4.313 106.751 0.490 3 36 127 0
        i 4.314 107.251 0.490 3 36 127 1
        i 4.315 108.251 0.490 3 36 127 2
        i 4.316 109.751 0.490 3 36 127 3
        i 4.317 111.751 0.490 3 36 127 4
        i 4.319 106.876 0.490 3 43 127 0
        i 4.320 107.376 0.490 3 43 127 1
        i 4.321 108.376 0.490 3 43 127 2
        i 4.322 109.876 0.490 3 43 127 3
        i 4.323 111.876 0.490 3 43 127 4
        i 5.067 106.899 0.100 1 1112 67
        i 5.068 106.968 0.100 1 1107 70
        i 5.069 107.056 0.100 1 1101 69
        i 5.070 107.107 0.100 1 1096 75
        i 5.071 107.121 0.100 1 1095 61
        i 5.072 107.165 0.100 1 1098 80
        i 5.073 107.188 0.100 1 1095 63
        i 5.074 107.191 0.100 1 1107 52
        i 5.075 107.263 0.100 1 1099 54
        i 5.076 107.321 0.100 1 1104 65
        i 5.077 107.383 0.100 1 1107 69
        i 5.078 107.411 0.100 1 1109 69
        i 5.079 107.431 0.100 1 1101 59
        i 5.080 107.549 0.100 1 1091 62
        i 5.081 107.644 0.100 1 1105 53
        i 5.082 107.713 0.100 1 1093 75
        i 5.083 107.813 0.100 1 1103 70
        i 5.084 107.881 0.100 1 1101 56
        i 5.085 107.937 0.100 1 1092 71
        i 5.086 107.969 0.100 1 1097 61
        i 4.325 108.001 0.490 3 36 127 0
        i 4.326 108.501 0.490 3 36 127 1
        i 5.087 108.001 0.100 1 1102 61
        i 4.327 109.501 0.490 3 36 127 2
        i 4.328 111.001 0.490 3 36 127 3
        i 4.329 113.001 0.490 3 36 127 4
        i 5.088 108.028 0.100 1 1095 74
        i 5.089 108.036 0.100 1 1105 57
        i 5.090 108.108 0.100 1 1106 61
        i 4.331 108.125 0.490 3 43 127 0
        i 4.332 108.625 0.490 3 43 127 1
        i 4.333 109.625 0.490 3 43 127 2
        i 4.334 111.125 0.490 3 43 127 3
        i 4.335 113.125 0.490 3 43 127 4
        i 5.091 108.159 0.100 1 1105 48
        i 5.092 108.172 0.100 1 1107 48
        i 4.337 108.251 0.490 3 48 127 0
        i 4.338 108.751 0.490 3 48 127 1
        i 4.339 109.751 0.490 3 48 127 2
        i 4.340 111.251 0.490 3 48 127 3
        i 4.341 113.251 0.490 3 48 127 4
        i 5.093 108.269 0.100 1 1105 48
        i 5.094 108.361 0.100 1 1103 63
        i 5.095 108.453 0.100 1 1095 61
        i 5.096 108.573 0.100 1 1105 55
        i 5.097 108.608 0.100 1 1099 58
        i 5.098 108.667 0.100 1 1102 63
        i 5.099 108.673 0.100 1 1091 52
        i 5.100 108.692 0.100 1 1101 74
        i 4.343 108.751 0.490 3 36 127 0
        i 4.344 109.251 0.490 3 36 127 1
        i 4.345 110.251 0.490 3 36 127 2
        i 4.346 111.751 0.490 3 36 127 3
        i 4.347 113.751 0.490 3 36 127 4
        i 5.101 108.773 0.100 1 1107 60
        i 5.102 108.791 0.100 1 1097 52
        i 4.349 108.876 0.490 3 43 127 0
        i 4.350 109.376 0.490 3 43 127 1
        i 4.351 110.376 0.490 3 43 127 2
        i 4.352 111.876 0.490 3 43 127 3
        i 4.353 113.876 0.490 3 43 127 4
        i 5.103 108.941 0.100 1 1099 51
        i 5.104 108.943 0.100 1 1109 73
        i 5.105 108.961 0.100 1 1103 74
        i 4.355 109.001 0.490 3 48 127 0
        i 4.356 109.501 0.490 3 48 127 1
        i 4.357 110.501 0.490 3 48 127 2
        i 4.358 112.001 0.490 3 48 127 3
        i 4.359 114.001 0.490 3 48 127 4
        i 5.106 109.023 0.100 1 1101 53
        i 5.107 109.072 0.100 1 1103 80
        i 5.108 109.177 0.100 1 1093 49
        i 5.109 109.213 0.100 1 1101 58
        i 5.110 109.375 0.100 1 1093 50
        i 5.111 109.380 0.100 1 1095 62
        i 5.112 109.423 0.100 1 1095 53
        i 5.113 109.512 0.100 1 1099 59
        i 5.114 109.525 0.100 1 1100 59
        i 5.115 109.624 0.100 1 1103 66
        i 5.116 109.640 0.100 1 1099 52
        i 5.117 109.672 0.100 1 1101 78
        i 5.118 109.721 0.100 1 1097 74
        i 5.119 109.748 0.100 1 1101 65
        i 5.120 109.780 0.100 1 1105 73
        i 5.121 109.893 0.100 1 1109 53
        i 5.122 109.923 0.100 1 1097 57
        i 4.361 110.001 0.490 3 36 127 0
        i 4.362 110.501 0.490 3 36 127 1
        i 4.363 111.501 0.490 3 36 127 2
        i 4.364 113.001 0.490 3 36 127 3
        i 4.365 115.001 0.490 3 36 127 4
        i 4.367 110.125 0.490 3 43 127 0
        i 4.368 110.625 0.490 3 43 127 1
        i 4.369 111.625 0.490 3 43 127 2
        i 4.370 113.125 0.490 3 43 127 3
        i 4.371 115.125 0.490 3 43 127 4
        i 5.123 110.196 0.100 1 1093 52
        i 4.373 110.251 0.490 3 52 64 0
        i 4.374 110.751 0.490 3 52 64 1
        i 4.375 111.751 0.490 3 52 64 2
        i 4.376 113.251 0.490 3 52 64 3
        i 4.377 115.251 0.490 3 52 64 4
        i 5.124 110.261 0.100 1 1103 65
        i 5.125 110.265 0.100 1 1095 55
        i 5.126 110.357 0.100 1 1099 69
        i 5.127 110.379 0.100 1 1101 59
        i 5.128 110.385 0.100 1 1099 74
        i 5.129 110.388 0.100 1 1101 77
        i 5.130 110.412 0.100 1 1093 63
        i 5.131 110.471 0.100 1 1096 68
        i 5.132 110.588 0.100 1 1101 71
        i 5.133 110.609 0.100 1 1099 64
        i 5.134 110.701 0.100 1 1099 59
        i 5.135 110.713 0.100 1 1096 62
        i 4.379 110.751 0.490 3 36 127 0
        i 4.380 111.251 0.490 3 36 127 1
        i 4.381 112.251 0.490 3 36 127 2
        i 4.382 113.751 0.490 3 36 127 3
        i 4.383 115.751 0.490 3 36 127 4
        i 5.136 110.815 0.100 1 1109 75
        i 4.385 110.876 0.490 3 43 127 0
        i 4.386 111.376 0.490 3 43 127 1
        i 4.387 112.376 0.490 3 43 127 2
        i 4.388 113.876 0.490 3 43 127 3
        i 4.389 115.876 0.490 3 43 127 4
        i 5.137 110.896 0.100 1 1103 72
        i 4.391 111.001 0.490 3 52 64 0
        i 4.392 111.501 0.490 3 52 64 1
        i 4.393 112.501 0.490 3 52 64 2
        i 4.394 114.001 0.490 3 52 64 3
        i 4.395 116.001 0.490 3 52 64 4
        i 5.138 111.004 0.100 1 1098 64
        i 5.139 111.041 0.100 1 1097 80
        i 5.140 111.044 0.100 1 1107 64
        i 5.141 111.161 0.100 1 1097 52
        i 5.142 111.173 0.100 1 1089 44
        i 5.143 111.173 0.100 1 1101 71
        i 5.144 111.215 0.100 1 1097 51
        i 5.145 111.248 0.100 1 1103 60
        i 5.146 111.248 0.100 1 1093 53
        i 5.147 111.512 0.100 1 1111 49
        i 5.148 111.527 0.100 1 1101 63
        i 5.149 111.551 0.100 1 1095 75
        i 5.150 111.624 0.100 1 1094 57
        i 5.151 111.700 0.100 1 1094 72
        i 5.152 111.731 0.100 1 1107 64
        i 5.153 111.732 0.100 1 1105 61
        i 5.154 111.821 0.100 1 1099 74
        i 5.155 111.908 0.100 1 1100 82
        i 5.156 111.944 0.100 1 1107 68
        i 5.157 111.964 0.100 1 1103 79
        i 4.397 112.001 0.490 3 36 127 0
        i 4.398 112.501 0.490 3 36 127 1
        i 4.399 113.501 0.490 3 36 127 2
        i 4.400 115.001 0.490 3 36 127 3
        i 4.401 117.001 0.490 3 36 127 4
        i 5.158 112.007 0.100 1 1104 77
        i 5.159 112.031 0.100 1 1104 75
        i 5.160 112.169 0.100 1 1091 43
        i 5.161 112.213 0.100 1 1092 72
        i 5.162 112.323 0.100 1 1109 68
        i 5.163 112.351 0.100 1 1095 65
        i 5.164 112.419 0.100 1 1092 78
        i 5.165 112.425 0.100 1 1098 81
        i 5.166 112.481 0.100 1 1105 74
        i 5.167 112.485 0.100 1 1100 54
        i 5.168 112.543 0.100 1 1104 50
        i 5.169 112.707 0.100 1 1107 53
        i 5.170 112.737 0.100 1 1102 59
        i 4.403 112.751 0.490 3 38 127 0
        i 4.404 113.251 0.490 3 38 127 1
        i 4.405 114.251 0.490 3 38 127 2
        i 4.406 115.751 0.490 3 38 127 3
        i 4.407 117.751 0.490 3 38 127 4
        i 5.171 112.767 0.100 1 1108 60
        i 5.172 112.904 0.100 1 1105 59
        i 5.173 112.995 0.100 1 1095 48
        i 5.174 113.020 0.100 1 1105 65
        i 5.175 113.119 0.100 1 1100 62
        i 5.176 113.127 0.100 1 1101 81
        i 5.177 113.201 0.100 1 1096 54
        i 5.178 113.203 0.100 1 1102 83
        i 5.179 113.212 0.100 1 1097 65
        i 5.180 113.232 0.100 1 1092 58
        i 5.181 113.235 0.100 1 1104 74
        i 5.182 113.297 0.100 1 1102 67
        i 5.183 113.423 0.100 1 1100 61
        i 5.184 113.604 0.100 1 1108 56
        i 5.185 113.641 0.100 1 1092 61
        i 5.186 113.653 0.100 1 1100 61
        i 5.187 113.709 0.100 1 1110 71
        i 5.188 113.712 0.100 1 1100 82
        i 5.189 113.748 0.100 1 1098 69
        i 5.190 113.888 0.100 1 1094 75
        i 5.191 113.988 0.100 1 1094 58
        i 4.409 114.001 0.490 3 52 49 0
        i 4.410 114.501 0.490 3 52 49 1
        i 4.411 115.501 0.490 3 52 49 2
        i 4.412 117.001 0.490 3 52 49 3
        i 4.413 119.001 0.490 3 52 49 4
        i 5.192 113.999 0.100 1 1102 53
        i 5.193 114.007 0.100 1 1099 63
        i 5.194 114.135 0.100 1 1102 78
        i 5.195 114.164 0.100 1 1106 76
        i 5.196 114.176 0.100 1 1098 72
        i 5.197 114.176 0.100 1 1099 66
        i 5.198 114.205 0.100 1 1100 83
        i 5.199 114.439 0.100 1 1098 82
        i 5.200 114.523 0.100 1 1112 50
        i 5.201 114.529 0.100 1 1110 73
        i 5.202 114.565 0.100 1 1100 49
        i 5.203 114.705 0.100 1 1094 69
        i 5.204 114.744 0.100 1 1102 75
        i 4.415 114.751 0.490 3 53 49 0
        i 4.416 115.251 0.490 3 53 49 1
        i 4.417 116.251 0.490 3 53 49 2
        i 4.418 117.751 0.490 3 53 49 3
        i 4.419 119.751 0.490 3 53 49 4
        i 5.205 114.779 0.100 1 1100 74
        i 5.206 114.824 0.100 1 1094 55
        i 5.207 114.867 0.100 1 1098 54
        i 5.208 114.891 0.100 1 1100 52
        i 5.209 114.945 0.100 1 1092 81
        i 5.210 114.967 0.100 1 1102 54
        i 5.211 114.975 0.100 1 1097 63
        i 5.212 115.015 0.100 1 1096 79
        i 5.213 115.116 0.100 1 1098 66
        i 5.214 115.197 0.100 1 1108 76
        i 5.215 115.211 0.100 1 1096 53
        i 5.216 115.335 0.100 1 1112 70
        i 5.217 115.413 0.100 1 1102 52
        i 5.218 115.529 0.100 1 1099 52
        i 5.219 115.536 0.100 1 1110 58
        i 5.220 115.581 0.100 1 1104 74
        i 5.221 115.647 0.100 1 1100 52
        i 5.222 115.676 0.100 1 1104 72
        i 5.223 115.677 0.100 1 1096 74
        i 5.224 115.727 0.100 1 1102 64
        i 5.225 115.740 0.100 1 1102 79
        i 5.226 115.785 0.100 1 1090 73
        i 5.227 115.785 0.100 1 1098 77
        i 5.228 115.799 0.100 1 1092 49
        i 4.421 116.001 0.490 3 41 127 0
        i 4.422 116.501 0.490 3 41 127 1
        i 4.423 117.501 0.490 3 41 127 2
        i 4.424 119.001 0.490 3 41 127 3
        i 4.425 121.001 0.490 3 41 127 4
        i 5.229 116.048 0.100 1 1104 69
        i 5.230 116.115 0.100 1 1094 73
        i 5.231 116.171 0.100 1 1093 62
        i 5.232 116.208 0.100 1 1093 53
        i 5.233 116.277 0.100 1 1106 59
        i 5.234 116.281 0.100 1 1104 54
        i 5.235 116.332 0.100 1 1100 65
        i 5.236 116.365 0.100 1 1106 68
        i 5.237 116.407 0.100 1 1108 69
        i 5.238 116.416 0.100 1 1100 55
        i 5.239 116.427 0.100 1 1106 54
        i 5.240 116.492 0.100 1 1104 71
        i 5.241 116.575 0.100 1 1106 75
        i 5.242 116.709 0.100 1 1091 82
        i 5.243 116.713 0.100 1 1092 48
        i 4.427 116.751 0.490 3 40 127 0
        i 4.428 117.251 0.490 3 40 127 1
        i 4.429 118.251 0.490 3 40 127 2
        i 4.430 119.751 0.490 3 40 127 3
        i 4.431 121.751 0.490 3 40 127 4
        i 5.244 116.785 0.100 1 1106 63
        i 5.245 116.795 0.100 1 1096 54
        i 5.246 116.904 0.100 1 1099 81
        i 5.247 116.913 0.100 1 1096 65
        i 5.248 116.944 0.100 1 1091 79
        i 5.249 117.117 0.100 1 1108 55
        i 5.250 117.117 0.100 1 1104 67
        i 5.251 117.125 0.100 1 1100 69
        i 5.252 117.167 0.100 1 1104 68
        i 5.253 117.233 0.100 1 1104 74
        i 5.254 117.391 0.100 1 1106 74
        i 5.255 117.452 0.100 1 1102 55
        i 5.256 117.461 0.100 1 1094 45
        i 5.257 117.524 0.100 1 1106 65
        i 5.258 117.548 0.100 1 1098 79
        i 5.259 117.620 0.100 1 1102 69
        i 5.260 117.631 0.100 1 1101 74
        i 5.261 117.652 0.100 1 1101 66
        i 5.262 117.696 0.100 1 1104 80
        i 5.263 117.709 0.100 1 1101 58
        i 5.264 117.811 0.100 1 1098 56
        i 5.265 117.827 0.100 1 1093 52
        i 5.266 117.871 0.100 1 1100 69
        i 4.433 118.001 0.490 3 57 49 0
        i 4.434 118.501 0.490 3 57 49 1
        i 4.435 119.501 0.490 3 57 49 2
        i 4.436 121.001 0.490 3 57 49 3
        i 4.437 123.001 0.490 3 57 49 4
        i 5.267 118.029 0.100 1 1092 53
        i 5.268 118.071 0.100 1 1109 63
        i 5.269 118.151 0.100 1 1097 75
        i 5.270 118.213 0.100 1 1099 75
        i 5.271 118.239 0.100 1 1104 69
        i 5.272 118.284 0.100 1 1099 66
        i 5.273 118.295 0.100 1 1108 56
        i 5.274 118.437 0.100 1 1095 76
        i 5.275 118.451 0.100 1 1103 71
        i 5.276 118.533 0.100 1 1099 56
        i 5.277 118.547 0.100 1 1107 69
        i 5.278 118.576 0.100 1 1093 61
        i 5.279 118.588 0.100 1 1100 59
        i 5.280 118.592 0.100 1 1100 73
        i 5.281 118.643 0.100 1 1098 48
        i 5.282 118.727 0.100 1 1111 71
        i 4.439 118.751 0.490 3 55 49 0
        i 4.440 119.251 0.490 3 55 49 1
        i 4.441 120.251 0.490 3 55 49 2
        i 4.442 121.751 0.490 3 55 49 3
        i 4.443 123.751 0.490 3 55 49 4
        i 5.283 118.815 0.100 1 1095 81
        i 5.284 118.907 0.100 1 1109 77
        i 5.285 119.049 0.100 1 1113 50
        i 5.286 119.085 0.100 1 1101 72
        i 5.287 119.209 0.100 1 1095 84
        i 5.288 119.277 0.100 1 1097 61
        i 5.289 119.344 0.100 1 1102 74
        i 5.290 119.388 0.100 1 1105 54
        i 5.291 119.419 0.100 1 1093 74
        i 5.292 119.429 0.100 1 1097 48
        i 5.293 119.436 0.100 1 1099 73
        i 5.294 119.475 0.100 1 1103 56
        i 5.295 119.479 0.100 1 1093 82
        i 5.296 119.495 0.100 1 1107 51
        i 5.297 119.523 0.100 1 1098 70
        i 5.298 119.585 0.100 1 1101 78
        i 5.299 119.717 0.100 1 1097 72
        i 5.300 119.763 0.100 1 1101 54
        i 5.301 119.885 0.100 1 1111 77
        i 4.445 120.001 0.490 3 36 127 0
        i 4.446 120.501 0.490 3 36 127 1
        i 4.447 121.501 0.490 3 36 127 2
        i 4.448 123.001 0.490 3 36 127 3
        i 4.449 125.001 0.490 3 36 127 4
        i 5.302 120.059 0.100 1 1099 49
        i 5.303 120.081 0.100 1 1103 55
        i 5.304 120.099 0.100 1 1100 58
        i 5.305 120.145 0.100 1 1103 56
        i 5.306 120.168 0.100 1 1099 70
        i 5.307 120.205 0.100 1 1101 59
        i 5.308 120.211 0.100 1 1105 59
        i 5.309 120.291 0.100 1 1103 67
        i 5.310 120.327 0.100 1 1109 64
        i 5.311 120.348 0.100 1 1091 76
        i 5.312 120.393 0.100 1 1095 56
        i 5.313 120.408 0.100 1 1091 51
        i 5.314 120.527 0.100 1 1105 66
        i 5.315 120.625 0.100 1 1097 57
        i 5.316 120.709 0.100 1 1093 65
        i 4.451 120.751 0.490 3 38 127 0
        i 4.452 121.251 0.490 3 38 127 1
        i 4.453 122.251 0.490 3 38 127 2
        i 4.454 123.751 0.490 3 38 127 3
        i 4.455 125.751 0.490 3 38 127 4
        i 5.317 120.756 0.100 1 1099 79
        i 5.318 120.761 0.100 1 1092 53
        i 5.319 120.800 0.100 1 1095 82
        i 5.320 120.877 0.100 1 1107 62
        i 5.321 120.877 0.100 1 1107 55
        i 5.322 120.908 0.100 1 1105 66
        i 5.323 120.988 0.100 1 1105 74
        i 5.324 121.011 0.100 1 1101 58
        i 5.325 121.144 0.100 1 1107 78
        i 5.326 121.159 0.100 1 1105 68
        i 5.327 121.221 0.100 1 1091 83
        i 5.328 121.257 0.100 1 1093 57
        i 5.329 121.287 0.100 1 1105 54
        i 5.330 121.348 0.100 1 1099 63
        i 5.331 121.359 0.100 1 1097 70
        i 5.332 121.383 0.100 1 1099 67
        i 5.333 121.445 0.100 1 1103 49
        i 5.334 121.513 0.100 1 1092 67
        i 5.335 121.529 0.100 1 1107 51
        i 5.336 121.541 0.100 1 1107 67
        i 5.337 121.640 0.100 1 1103 57
        i 5.338 121.764 0.100 1 1099 50
        i 5.339 121.789 0.100 1 1103 67
        i 5.340 121.863 0.100 1 1097 75
        i 5.341 121.927 0.100 1 1093 61
        i 4.457 122.001 0.490 3 52 49 0
        i 4.458 122.501 0.490 3 52 49 1
        i 4.459 123.501 0.490 3 52 49 2
        i 4.460 125.001 0.490 3 52 49 3
        i 4.461 127.001 0.490 3 52 49 4
        i 5.342 122.053 0.100 1 1105 69
        i 5.343 122.064 0.100 1 1101 73
        i 5.344 122.073 0.100 1 1101 78
        i 5.345 122.112 0.100 1 1109 50
        i 5.346 122.179 0.100 1 1100 65
        i 5.347 122.185 0.100 1 1101 60
        i 5.348 122.209 0.100 1 1100 73
        i 5.349 122.319 0.100 1 1109 53
        i 5.350 122.409 0.100 1 1099 70
        i 5.351 122.421 0.100 1 1093 75
        i 5.352 122.432 0.100 1 1101 70
        i 5.353 122.439 0.100 1 1091 50
        i 5.354 122.540 0.100 1 1105 58
        i 5.355 122.615 0.100 1 1094 78
        i 5.356 122.651 0.100 1 1099 74
        i 5.357 122.724 0.100 1 1098 61
        i 5.358 122.744 0.100 1 1111 49
        i 4.463 122.751 0.490 3 53 49 0
        i 4.464 123.251 0.490 3 53 49 1
        i 4.465 124.251 0.490 3 53 49 2
        i 4.466 125.751 0.490 3 53 49 3
        i 4.467 127.751 0.490 3 53 49 4
        i 5.359 122.915 0.100 1 1099 75
        i 5.360 122.987 0.100 1 1103 67
        i 5.361 122.988 0.100 1 1095 75
        i 5.362 122.999 0.100 1 1101 58
        i 5.363 123.103 0.100 1 1098 73
        i 5.364 123.129 0.100 1 1099 54
        i 5.365 123.131 0.100 1 1104 76
        i 5.366 123.164 0.100 1 1092 82
        i 5.367 123.167 0.100 1 1103 74
        i 5.368 123.171 0.100 1 1107 59
        i 5.369 123.209 0.100 1 1101 72
        i 5.370 123.283 0.100 1 1108 71
        i 5.371 123.315 0.100 1 1102 54
        i 5.372 123.531 0.100 1 1113 78
        i 5.373 123.681 0.100 1 1098 56
        i 5.374 123.708 0.100 1 1096 53
        i 5.375 123.912 0.100 1 1102 75
        i 5.376 123.912 0.100 1 1103 55
        i 5.377 123.941 0.100 1 1101 55
        i 5.378 123.963 0.100 1 1092 69
        i 5.379 123.992 0.100 1 1097 62
        i 4.469 124.001 0.490 3 41 127 0
        i 4.470 124.501 0.490 3 41 127 1
        i 4.471 125.501 0.490 3 41 127 2
        i 4.472 127.001 0.490 3 41 127 3
        i 4.473 129.001 0.490 3 41 127 4
        i 5.380 124.000 0.100 1 1099 73
        i 5.381 124.012 0.100 1 1094 65
        i 5.382 124.043 0.100 1 1104 59
        i 5.383 124.049 0.100 1 1110 74
        i 5.384 124.093 0.100 1 1098 56
        i 5.385 124.124 0.100 1 1106 50
        i 5.386 124.207 0.100 1 1101 49
        i 5.387 124.227 0.100 1 1098 56
        i 5.388 124.457 0.100 1 1098 59
        i 5.389 124.468 0.100 1 1099 70
        i 5.390 124.569 0.100 1 1104 76
        i 5.391 124.572 0.100 1 1100 50
        i 5.392 124.684 0.100 1 1100 75
        i 5.393 124.691 0.100 1 1101 64
        i 4.475 124.751 0.490 3 43 127 0
        i 4.476 125.251 0.490 3 43 127 1
        i 4.477 126.251 0.490 3 43 127 2
        i 4.478 127.751 0.490 3 43 127 3
        i 4.479 129.751 0.490 3 43 127 4
        i 5.394 124.769 0.100 1 1106 76
        i 5.395 124.847 0.100 1 1090 76
        i 5.396 124.875 0.100 1 1096 77
        i 5.397 124.951 0.100 1 1092 44
        i 5.398 125.044 0.100 1 1106 56
        i 5.399 125.075 0.100 1 1104 75
        i 5.400 125.091 0.100 1 1108 71
        i 5.401 125.189 0.100 1 1098 73
        i 5.402 125.207 0.100 1 1092 80
        i 5.403 125.268 0.100 1 1100 65
        i 5.404 125.343 0.100 1 1104 60
        i 5.405 125.375 0.100 1 1091 74
        i 5.406 125.393 0.100 1 1102 55
        i 5.407 125.436 0.100 1 1104 48
        i 5.408 125.464 0.100 1 1107 75
        i 5.409 125.480 0.100 1 1096 56
        i 5.410 125.555 0.100 1 1100 54
        i 5.411 125.729 0.100 1 1090 60
        i 5.412 125.816 0.100 1 1106 54
        i 5.413 125.843 0.100 1 1096 62
        i 5.414 125.861 0.100 1 1106 77
        i 5.415 125.871 0.100 1 1100 81
        i 5.416 125.940 0.100 1 1102 73
        i 4.481 126.001 0.490 3 57 49 0
        i 4.482 126.501 0.490 3 57 49 1
        i 4.483 127.501 0.490 3 57 49 2
        i 4.484 129.001 0.490 3 57 49 3
        i 4.485 131.001 0.490 3 57 49 4
        i 5.417 126.001 0.100 1 1106 59
        i 5.418 126.015 0.100 1 1110 52
        i 5.419 126.015 0.100 1 1108 73
        i 5.420 126.044 0.100 1 1098 80
        i 5.421 126.105 0.100 1 1093 70
        i 5.422 126.193 0.100 1 1102 78
        i 5.423 126.349 0.100 1 1100 61
        i 5.424 126.353 0.100 1 1098 76
        i 5.425 126.515 0.100 1 1112 44
        i 5.426 126.519 0.100 1 1108 61
        i 5.427 126.571 0.100 1 1104 63
        i 5.428 126.628 0.100 1 1100 78
        i 5.429 126.683 0.100 1 1094 63
        i 5.430 126.705 0.100 1 1100 78
        i 5.431 126.728 0.100 1 1102 67
        i 5.432 126.748 0.100 1 1099 78
        i 4.487 126.751 0.490 3 59 49 0
        i 4.488 127.251 0.490 3 59 49 1
        i 4.489 128.251 0.490 3 59 49 2
        i 4.490 129.751 0.490 3 59 49 3
        i 4.491 131.751 0.490 3 59 49 4
        i 5.433 126.885 0.100 1 1102 61
        i 5.434 126.935 0.100 1 1100 62
        i 5.435 126.935 0.100 1 1110 48
        i 5.436 126.965 0.100 1 1094 78
        i 5.437 127.027 0.100 1 1098 65
        i 5.438 127.061 0.100 1 1114 41
        i 5.439 127.063 0.100 1 1110 49
        i 5.440 127.151 0.100 1 1102 68
        i 5.441 127.165 0.100 1 1106 71
        i 5.442 127.232 0.100 1 1097 67
        i 5.443 127.287 0.100 1 1104 62
        i 5.444 127.359 0.100 1 1098 68
        i 5.445 127.487 0.100 1 1096 69
        i 5.446 127.533 0.100 1 1102 63
        i 5.447 127.633 0.100 1 1100 76
        i 5.448 127.652 0.100 1 1102 52
        i 5.449 127.693 0.100 1 1097 57
        i 5.450 127.696 0.100 1 1092 78
        i 5.451 127.757 0.100 1 1108 59
        i 5.452 127.773 0.100 1 1104 75
        i 5.453 127.913 0.100 1 1108 64
        i 4.493 128.001 0.490 3 36 127 0
        i 4.494 128.501 0.490 3 36 127 1
        i 4.495 129.501 0.490 3 36 127 2
        i 4.496 131.001 0.490 3 36 127 3
        i 4.497 133.001 0.490 3 36 127 4
        i 5.454 128.044 0.100 1 1104 57
        i 5.455 128.048 0.100 1 1112 69
        i 5.456 128.156 0.100 1 1101 56
        i 5.457 128.204 0.100 1 1097 66
        i 5.458 128.235 0.100 1 1104 62
        i 5.459 128.316 0.100 1 1102 72
        i 5.460 128.404 0.100 1 1100 49
        i 5.461 128.417 0.100 1 1092 68
        i 5.462 128.444 0.100 1 1096 74
        i 5.463 128.469 0.100 1 1098 61
        i 5.464 128.489 0.100 1 1095 66
        i 5.465 128.628 0.100 1 1106 44
        i 5.466 128.639 0.100 1 1105 53
        i 5.467 128.663 0.100 1 1099 60
        i 5.468 128.735 0.100 1 1099 78
        i 4.499 128.751 0.490 3 38 127 0
        i 4.500 129.251 0.490 3 38 127 1
        i 4.501 130.251 0.490 3 38 127 2
        i 4.502 131.751 0.490 3 38 127 3
        i 4.503 133.751 0.490 3 38 127 4
        i 5.469 128.789 0.100 1 1099 73
        i 5.470 128.819 0.100 1 1106 66
        i 5.471 128.921 0.100 1 1110 73
        i 5.472 129.065 0.100 1 1098 63
        i 5.473 129.107 0.100 1 1099 80
        i 5.474 129.112 0.100 1 1108 57
        i 5.475 129.139 0.100 1 1100 73
        i 5.476 129.172 0.100 1 1096 64
        i 5.477 129.213 0.100 1 1106 53
        i 5.478 129.257 0.100 1 1089 56
        i 5.479 129.281 0.100 1 1101 60
        i 5.480 129.452 0.100 1 1103 54
        i 5.481 129.481 0.100 1 1108 48
        i 5.482 129.516 0.100 1 1105 63
        i 5.483 129.575 0.100 1 1106 80
        i 5.484 129.667 0.100 1 1097 62
        i 5.485 129.688 0.100 1 1101 68
        i 5.486 129.688 0.100 1 1103 73
        i 5.487 129.703 0.100 1 1091 71
        i 5.488 129.873 0.100 1 1108 75
        i 5.489 129.888 0.100 1 1103 64
        i 5.490 129.987 0.100 1 1091 81
        i 4.505 130.001 0.490 3 52 49 0
        i 4.506 130.501 0.490 3 52 49 1
        i 4.507 131.501 0.490 3 52 49 2
        i 4.508 133.001 0.490 3 52 49 3
        i 4.509 135.001 0.490 3 52 49 4
        i 5.491 130.009 0.100 1 1099 79
        i 5.492 130.021 0.100 1 1105 65
        i 5.493 130.029 0.100 1 1107 77
        i 5.494 130.045 0.100 1 1096 81
        i 5.495 130.193 0.100 1 1105 61
        i 5.496 130.237 0.100 1 1091 63
        i 5.497 130.252 0.100 1 1109 70
        i 5.498 130.343 0.100 1 1101 58
        i 5.499 130.351 0.100 1 1095 80
        i 5.500 130.403 0.100 1 1101 72
        i 5.501 130.545 0.100 1 1101 61
        i 5.502 130.597 0.100 1 1106 72
        i 5.503 130.617 0.100 1 1101 73
        i 5.504 130.696 0.100 1 1094 55
        i 5.505 130.731 0.100 1 1099 56
        i 4.511 130.751 0.490 3 53 49 0
        i 4.512 131.251 0.490 3 53 49 1
        i 4.513 132.251 0.490 3 53 49 2
        i 4.514 133.751 0.490 3 53 49 3
        i 4.515 135.751 0.490 3 53 49 4
        i 5.506 130.752 0.100 1 1099 70
        i 5.507 130.853 0.100 1 1097 71
        i 5.508 130.917 0.100 1 1113 58
        i 5.509 131.000 0.100 1 1109 78
        i 5.510 131.052 0.100 1 1103 71
        i 5.511 131.201 0.100 1 1099 57
        i 5.512 131.252 0.100 1 1111 70
        i 5.513 131.269 0.100 1 1099 53
        i 5.514 131.279 0.100 1 1093 61
        i 5.515 131.315 0.100 1 1103 82
        i 5.516 131.317 0.100 1 1098 79
        i 5.517 131.343 0.100 1 1101 52
        i 5.518 131.420 0.100 1 1095 78
        i 5.519 131.427 0.100 1 1107 55
        i 5.520 131.447 0.100 1 1103 77
        i 5.521 131.683 0.100 1 1099 56
        i 5.522 131.740 0.100 1 1097 62
        i 5.523 131.759 0.100 1 1113 47
        i 5.524 131.827 0.100 1 1101 78
        i 5.525 131.865 0.100 1 1111 79
        i 5.526 131.879 0.100 1 1097 68
        i 5.527 131.945 0.100 1 1097 58
        i 5.528 131.971 0.100 1 1103 71
        i 4.517 132.001 0.490 3 41 127 0
        i 4.518 132.501 0.490 3 41 127 1
        i 4.519 133.501 0.490 3 41 127 2
        i 4.520 135.001 0.490 3 41 127 3
        i 4.521 137.001 0.490 3 41 127 4
        i 5.529 132.047 0.100 1 1109 53
        i 5.530 132.129 0.100 1 1103 79
        i 5.531 132.228 0.100 1 1093 75
        i 5.532 132.239 0.100 1 1109 53
        i 5.533 132.284 0.100 1 1096 53
        i 5.534 132.355 0.100 1 1105 69
        i 5.535 132.405 0.100 1 1105 57
        i 5.536 132.544 0.100 1 1107 71
        i 5.537 132.577 0.100 1 1111 57
        i 5.538 132.617 0.100 1 1101 55
        i 5.539 132.635 0.100 1 1105 58
        i 5.540 132.700 0.100 1 1097 58
        i 4.523 132.751 0.490 3 40 127 0
        i 4.524 133.251 0.490 3 40 127 1
        i 4.525 134.251 0.490 3 40 127 2
        i 4.526 135.751 0.490 3 40 127 3
        i 4.527 137.751 0.490 3 40 127 4
        i 5.541 132.812 0.100 1 1099 58
        i 5.542 132.831 0.100 1 1091 66
        i 5.543 132.921 0.100 1 1095 65
        i 5.544 132.928 0.100 1 1101 68
        i 5.545 132.965 0.100 1 1095 61
        i 5.546 133.044 0.100 1 1103 54
        i 5.547 133.171 0.100 1 1099 57
        i 5.548 133.196 0.100 1 1105 63
        i 5.549 133.232 0.100 1 1100 60
        i 5.550 133.243 0.100 1 1100 53
        i 5.551 133.256 0.100 1 1103 74
        i 5.552 133.325 0.100 1 1107 57
        i 5.553 133.352 0.100 1 1109 57
        i 5.554 133.495 0.100 1 1097 78
        i 5.555 133.528 0.100 1 1099 82
        i 5.556 133.537 0.100 1 1105 84
        i 5.557 133.625 0.100 1 1089 59
        i 5.558 133.649 0.100 1 1100 73
        i 5.559 133.661 0.100 1 1097 74
        i 5.560 133.723 0.100 1 1101 70
        i 5.561 133.743 0.100 1 1105 66
        i 5.562 133.755 0.100 1 1105 55
        i 5.563 133.781 0.100 1 1107 70
        i 5.564 133.860 0.100 1 1107 65
        i 5.565 133.872 0.100 1 1102 69
        i 4.529 134.001 0.490 3 57 49 0
        i 4.530 134.501 0.490 3 57 49 1
        i 4.531 135.501 0.490 3 57 49 2
        i 4.532 137.001 0.490 3 57 49 3
        i 4.533 139.001 0.490 3 57 49 4
        i 5.566 134.053 0.100 1 1107 54
        i 5.567 134.143 0.100 1 1096 66
        i 5.568 134.200 0.100 1 1090 79
        i 5.569 134.283 0.100 1 1107 77
        i 5.570 134.364 0.100 1 1103 50
        i 5.571 134.371 0.100 1 1105 77
        i 5.572 134.395 0.100 1 1103 69
        i 5.573 134.423 0.100 1 1099 48
        i 5.574 134.491 0.100 1 1097 55
        i 5.575 134.521 0.100 1 1108 66
        i 5.576 134.599 0.100 1 1092 63
        i 5.577 134.636 0.100 1 1102 59
        i 5.578 134.644 0.100 1 1103 59
        i 5.579 134.731 0.100 1 1109 65
        i 5.580 134.747 0.100 1 1092 53
        i 4.535 134.751 0.490 3 55 49 0
        i 4.536 135.251 0.490 3 55 49 1
        i 4.537 136.251 0.490 3 55 49 2
        i 4.538 137.751 0.490 3 55 49 3
        i 4.539 139.751 0.490 3 55 49 4
        i 5.581 134.763 0.100 1 1105 56
        i 5.582 134.933 0.100 1 1102 58
        i 5.583 135.073 0.100 1 1109 79
        i 5.584 135.104 0.100 1 1100 60
        i 5.585 135.176 0.100 1 1101 61
        i 5.586 135.195 0.100 1 1105 53
        i 5.587 135.247 0.100 1 1100 64
        i 5.588 135.285 0.100 1 1094 58
        i 5.589 135.297 0.100 1 1099 70
        i 5.590 135.311 0.100 1 1096 59
        i 5.591 135.387 0.100 1 1094 83
        i 5.592 135.427 0.100 1 1114 68
        i 5.593 135.497 0.100 1 1098 79
        i 5.594 135.579 0.100 1 1103 53
        i 5.595 135.692 0.100 1 1108 50
        i 5.596 135.700 0.100 1 1098 66
        i 5.597 135.753 0.100 1 1101 67
        i 5.598 135.833 0.100 1 1096 65
        i 5.599 135.885 0.100 1 1097 71
        i 5.600 135.889 0.100 1 1112 55
        i 5.601 135.900 0.100 1 1104 73
        i 5.602 135.923 0.100 1 1104 58
        i 5.603 135.957 0.100 1 1098 68
        i 4.541 136.001 0.490 3 40 127 0
        i 4.542 136.501 0.490 3 40 127 1
        i 4.543 137.501 0.490 3 40 127 2
        i 4.544 139.001 0.490 3 40 127 3
        i 4.545 141.001 0.490 3 40 127 4
        i 5.604 136.052 0.100 1 1110 78
        i 5.605 136.200 0.100 1 1112 42
        i 5.606 136.251 0.100 1 1096 80
        i 5.607 136.313 0.100 1 1100 66
        i 5.608 136.373 0.100 1 1094 74
        i 5.609 136.404 0.100 1 1098 76
        i 5.610 136.452 0.100 1 1102 71
        i 5.611 136.471 0.100 1 1096 64
        i 5.612 136.560 0.100 1 1108 50
        i 5.613 136.660 0.100 1 1108 59
        i 5.614 136.727 0.100 1 1106 72
        i 5.615 136.728 0.100 1 1103 80
        i 4.547 136.751 0.490 3 38 127 0
        i 4.548 137.251 0.490 3 38 127 1
        i 4.549 138.251 0.490 3 38 127 2
        i 4.550 139.751 0.490 3 38 127 3
        i 4.551 141.751 0.490 3 38 127 4
        i 5.616 136.759 0.100 1 1094 69
        i 5.617 136.819 0.100 1 1102 77
        i 5.618 136.873 0.100 1 1095 76
        i 5.619 136.920 0.100 1 1106 77
        i 5.620 136.992 0.100 1 1106 72
        i 5.621 137.056 0.100 1 1110 78
        i 5.622 137.105 0.100 1 1106 62
        i 5.623 137.153 0.100 1 1102 69
        i 5.624 137.200 0.100 1 1098 63
        i 5.625 137.233 0.100 1 1098 53
        i 5.626 137.244 0.100 1 1090 67
        i 5.627 137.269 0.100 1 1104 77
        i 5.628 137.365 0.100 1 1096 53
        i 5.629 137.441 0.100 1 1096 61
        i 5.630 137.508 0.100 1 1100 63
        i 5.631 137.523 0.100 1 1104 72
        i 5.632 137.636 0.100 1 1108 78
        i 5.633 137.636 0.100 1 1108 50
        i 5.634 137.755 0.100 1 1100 62
        i 5.635 137.777 0.100 1 1104 75
        i 5.636 137.800 0.100 1 1101 69
        i 5.637 137.859 0.100 1 1106 64
        i 5.638 137.887 0.100 1 1104 70
        i 5.639 137.932 0.100 1 1112 42
        i 5.640 137.947 0.100 1 1098 54
        i 5.641 137.949 0.100 1 1098 57
        i 5.642 137.993 0.100 1 1090 69
        i 4.553 138.001 0.490 3 55 49 0
        i 4.554 138.501 0.490 3 55 49 1
        i 4.555 139.501 0.490 3 55 49 2
        i 4.556 141.001 0.490 3 55 49 3
        i 4.557 143.001 0.490 3 55 49 4
        i 5.643 138.111 0.100 1 1100 60
        i 5.644 138.197 0.100 1 1096 61
        i 5.645 138.281 0.100 1 1102 73
        i 5.646 138.335 0.100 1 1106 50
        i 5.647 138.461 0.100 1 1103 54
        i 5.648 138.472 0.100 1 1102 56
        i 5.649 138.557 0.100 1 1106 42
        i 5.650 138.581 0.100 1 1108 62
        i 5.651 138.619 0.100 1 1096 77
        i 5.652 138.623 0.100 1 1106 61
        i 5.653 138.700 0.100 1 1091 55
        i 4.559 138.751 0.490 3 53 49 0
        i 4.560 139.251 0.490 3 53 49 1
        i 4.561 140.251 0.490 3 53 49 2
        i 4.562 141.751 0.490 3 53 49 3
        i 4.563 143.751 0.490 3 53 49 4
        i 5.654 138.765 0.100 1 1106 66
        i 5.655 138.815 0.100 1 1098 71
        i 5.656 138.836 0.100 1 1098 71
        i 5.657 138.836 0.100 1 1114 49
        i 5.658 138.920 0.100 1 1100 69
        i 5.659 138.924 0.100 1 1102 69
        i 5.660 139.072 0.100 1 1104 55
        i 5.661 139.157 0.100 1 1100 53
        i 5.662 139.175 0.100 1 1102 77
        i 5.663 139.211 0.100 1 1093 78
        i 5.664 139.259 0.100 1 1093 58
        i 5.665 139.315 0.100 1 1108 64
        i 5.666 139.355 0.100 1 1104 49
        i 5.667 139.464 0.100 1 1103 61
        i 5.668 139.552 0.100 1 1110 59
        i 5.669 139.587 0.100 1 1104 49
        i 5.670 139.668 0.100 1 1104 67
        i 5.671 139.676 0.100 1 1110 53
        i 5.672 139.688 0.100 1 1100 51
        i 5.673 139.743 0.100 1 1100 70
        i 5.674 139.769 0.100 1 1096 67
        i 5.675 139.848 0.100 1 1102 64
        i 5.676 139.876 0.100 1 1095 55
        i 5.677 139.891 0.100 1 1100 52
        i 5.678 139.973 0.100 1 1110 63
        i 4.565 140.001 0.490 3 36 127 0
        i 4.566 140.501 0.490 3 36 127 1
        i 4.567 141.501 0.490 3 36 127 2
        i 4.568 143.001 0.490 3 36 127 3
        i 4.569 145.001 0.490 3 36 127 4
        i 5.679 140.023 0.100 1 1114 42
        i 5.680 140.059 0.100 1 1102 71
        i 5.681 140.085 0.100 1 1098 66
        i 5.682 140.200 0.100 1 1097 65
        i 5.683 140.293 0.100 1 1096 65
        i 5.684 140.299 0.100 1 1102 72
        i 5.685 140.321 0.100 1 1108 64
        i 5.686 140.444 0.100 1 1103 77
        i 5.687 140.455 0.100 1 1097 59
        i 5.688 140.457 0.100 1 1107 65
        i 5.689 140.479 0.100 1 1112 52
        i 5.690 140.483 0.100 1 1104 79
        i 5.691 140.491 0.100 1 1106 61
        i 5.692 140.524 0.100 1 1098 68
        i 5.693 140.577 0.100 1 1102 60
        i 5.694 140.637 0.100 1 1112 70
        i 5.695 140.648 0.100 1 1101 55
        i 5.696 140.687 0.100 1 1093 60
        i 4.571 140.751 0.490 3 36 127 0
        i 4.572 141.251 0.490 3 36 127 1
        i 4.573 142.251 0.490 3 36 127 2
        i 4.574 143.751 0.490 3 36 127 3
        i 4.575 145.751 0.490 3 36 127 4
        i 5.697 140.763 0.100 1 1095 67
        i 5.698 140.908 0.100 1 1099 68
        i 5.699 141.036 0.100 1 1105 78
        i 5.700 141.069 0.100 1 1107 70
        i 5.701 141.088 0.100 1 1103 57
        i 5.702 141.133 0.100 1 1107 79
        i 5.703 141.139 0.100 1 1104 79
        i 5.704 141.159 0.100 1 1096 78
        i 5.705 141.248 0.100 1 1095 64
        i 5.706 141.296 0.100 1 1105 72
        i 5.707 141.435 0.100 1 1109 66
        i 5.708 141.447 0.100 1 1095 82
        i 5.709 141.459 0.100 1 1107 46
        i 5.710 141.535 0.100 1 1109 79
        i 5.711 141.585 0.100 1 1095 73
        i 5.712 141.672 0.100 1 1105 62
        i 5.713 141.697 0.100 1 1101 67
        i 5.714 141.700 0.100 1 1099 53
        i 5.715 141.704 0.100 1 1089 76
        i 5.716 141.811 0.100 1 1105 67
        i 5.717 141.832 0.100 1 1098 79
        i 5.718 141.876 0.100 1 1097 83
        i 5.719 141.912 0.100 1 1107 53
        i 5.720 141.927 0.100 1 1097 60
        i 4.577 142.001 0.490 3 52 49 0
        i 4.578 142.501 0.490 3 52 49 1
        i 4.579 143.501 0.490 3 52 49 2
        i 4.580 145.001 0.490 3 52 49 3
        i 4.581 147.001 0.490 3 52 49 4
        i 5.721 142.145 0.100 1 1107 56
        i 5.722 142.153 0.100 1 1103 65
        i 5.723 142.203 0.100 1 1109 45
        i 5.724 142.267 0.100 1 1101 60
        i 5.725 142.332 0.100 1 1103 81
        i 5.726 142.352 0.100 1 1102 73
        i 5.727 142.409 0.100 1 1091 75
        i 5.728 142.424 0.100 1 1097 83
        i 5.729 142.453 0.100 1 1101 56
        i 5.730 142.468 0.100 1 1107 63
        i 5.731 142.587 0.100 1 1101 79
        i 5.732 142.609 0.100 1 1097 78
        i 5.733 142.647 0.100 1 1105 53
        i 5.734 142.663 0.100 1 1099 61
        i 5.735 142.691 0.100 1 1103 55
        i 4.583 142.751 0.490 3 52 49 0
        i 4.584 143.251 0.490 3 52 49 1
        i 4.585 144.251 0.490 3 52 49 2
        i 4.586 145.751 0.490 3 52 49 3
        i 4.587 147.751 0.490 3 52 49 4
        i 5.736 142.896 0.100 1 1105 63
        i 5.737 143.009 0.100 1 1113 70
        i 5.738 143.035 0.100 1 1102 79
        i 5.739 143.060 0.100 1 1109 61
        i 5.740 143.088 0.100 1 1107 48
        i 5.741 143.139 0.100 1 1099 67
        i 5.742 143.148 0.100 1 1095 59
        i 5.743 143.200 0.100 1 1091 80
        i 5.744 143.297 0.100 1 1097 68
        i 5.745 143.323 0.100 1 1099 79
        i 5.746 143.365 0.100 1 1105 63
        i 5.747 143.485 0.100 1 1101 58
        i 5.748 143.527 0.100 1 1115 52
        i 5.749 143.559 0.100 1 1099 74
        i 5.750 143.579 0.100 1 1101 67
        i 5.751 143.596 0.100 1 1103 50
        i 5.752 143.677 0.100 1 1111 55
        i 5.753 143.769 0.100 1 1103 63
        i 5.754 143.771 0.100 1 1093 77
        i 5.755 143.805 0.100 1 1094 58
        i 5.756 143.815 0.100 1 1109 55
        i 4.589 144.001 0.490 3 36 127 0
        i 4.590 144.501 0.490 3 36 127 1
        i 4.591 145.501 0.490 3 36 127 2
        i 4.592 147.001 0.490 3 36 127 3
        i 4.593 149.001 0.490 3 36 127 4
        i 4.595 144.001 0.490 3 48 56 0
        i 4.596 144.501 0.490 3 48 56 1
        i 4.597 145.501 0.490 3 48 56 2
        i 4.598 147.001 0.490 3 48 56 3
        i 4.599 149.001 0.490 3 48 56 4
        i 5.757 144.048 0.100 1 1103 75
        i 5.758 144.080 0.100 1 1103 53
        i 5.759 144.092 0.100 1 1101 71
        i 5.760 144.197 0.100 1 1105 43
        i 5.761 144.220 0.100 1 1101 74
        i 5.762 144.276 0.100 1 1095 64
        i 5.763 144.313 0.100 1 1099 60
        i 5.764 144.329 0.100 1 1109 74
        i 5.765 144.332 0.100 1 1099 77
        i 5.766 144.333 0.100 1 1113 43
        i 5.767 144.365 0.100 1 1099 50
        i 5.768 144.449 0.100 1 1096 57
        i 5.769 144.535 0.100 1 1111 63
        i 5.770 144.537 0.100 1 1101 64
        i 5.771 144.700 0.100 1 1096 52
        i 4.601 144.751 0.490 3 38 127 0
        i 4.602 145.251 0.490 3 38 127 1
        i 4.603 146.251 0.490 3 38 127 2
        i 4.604 147.751 0.490 3 38 127 3
        i 4.605 149.751 0.490 3 38 127 4
        i 4.607 144.751 0.490 3 50 56 0
        i 4.608 145.251 0.490 3 50 56 1
        i 4.609 146.251 0.490 3 50 56 2
        i 4.610 147.751 0.490 3 50 56 3
        i 4.611 149.751 0.490 3 50 56 4
        i 5.772 144.845 0.100 1 1097 75
        i 5.773 144.875 0.100 1 1107 40
        i 5.774 144.899 0.100 1 1103 70
        i 5.775 144.928 0.100 1 1105 57
        i 5.776 144.973 0.100 1 1103 68
        i 5.777 144.995 0.100 1 1097 68
        i 5.778 145.007 0.100 1 1096 84
        i 5.779 145.025 0.100 1 1101 50
        i 5.780 145.060 0.100 1 1103 77
        i 5.781 145.168 0.100 1 1109 80
        i 5.782 145.263 0.100 1 1107 59
        i 5.783 145.273 0.100 1 1094 65
        i 5.784 145.333 0.100 1 1111 52
        i 5.785 145.360 0.100 1 1111 55
        i 5.786 145.373 0.100 1 1103 60
        i 5.787 145.399 0.100 1 1109 65
        i 5.788 145.433 0.100 1 1107 76
        i 5.789 145.505 0.100 1 1099 77
        i 5.790 145.551 0.100 1 1105 59
        i 5.791 145.695 0.100 1 1107 50
        i 5.792 145.723 0.100 1 1096 65
        i 5.793 145.751 0.100 1 1095 74
        i 5.794 145.900 0.100 1 1107 66
        i 5.795 145.928 0.100 1 1104 50
        i 5.796 145.977 0.100 1 1094 63
        i 5.797 145.987 0.100 1 1093 71
        i 4.613 146.001 0.490 3 52 43 0
        i 4.614 146.501 0.490 3 52 43 1
        i 4.615 147.501 0.490 3 52 43 2
        i 4.616 149.001 0.490 3 52 43 3
        i 4.617 151.001 0.490 3 52 43 4
        i 4.619 146.001 0.490 3 40 43 0
        i 4.620 146.501 0.490 3 40 43 1
        i 4.621 147.501 0.490 3 40 43 2
        i 4.622 149.001 0.490 3 40 43 3
        i 4.623 151.001 0.490 3 40 43 4
        i 5.798 146.064 0.100 1 1109 73
        i 5.799 146.072 0.100 1 1103 73
        i 5.800 146.128 0.100 1 1106 52
        i 5.801 146.199 0.100 1 1100 70
        i 5.802 146.256 0.100 1 1090 70
        i 5.803 146.269 0.100 1 1106 49
        i 5.804 146.289 0.100 1 1101 64
        i 5.805 146.296 0.100 1 1098 81
        i 5.806 146.360 0.100 1 1105 53
        i 5.807 146.381 0.100 1 1097 80
        i 5.808 146.431 0.100 1 1097 52
        i 5.809 146.671 0.100 1 1105 78
        i 4.625 146.751 0.490 3 41 42 0
        i 4.626 147.251 0.490 3 41 42 1
        i 4.627 148.251 0.490 3 41 42 2
        i 4.628 149.751 0.490 3 41 42 3
        i 4.629 151.751 0.490 3 41 42 4
        i 4.631 146.751 0.490 3 53 43 0
        i 4.632 147.251 0.490 3 53 43 1
        i 4.633 148.251 0.490 3 53 43 2
        i 4.634 149.751 0.490 3 53 43 3
        i 4.635 151.751 0.490 3 53 43 4
        i 5.810 146.771 0.100 1 1110 71
        i 5.811 146.776 0.100 1 1102 71
        i 5.812 146.779 0.100 1 1107 73
        i 5.813 146.797 0.100 1 1096 66
        i 5.814 146.819 0.100 1 1102 50
        i 5.815 146.861 0.100 1 1102 62
        i 5.816 146.899 0.100 1 1096 83
        i 5.817 146.899 0.100 1 1102 59
        i 5.818 146.965 0.100 1 1108 72
        i 5.819 146.987 0.100 1 1114 63
        i 5.820 147.020 0.100 1 1097 58
        i 5.821 147.076 0.100 1 1104 54
        i 5.822 147.185 0.100 1 1104 72
        i 5.823 147.272 0.100 1 1100 73
        i 5.824 147.465 0.100 1 1104 59
        i 5.825 147.500 0.100 1 1108 57
        i 5.826 147.541 0.100 1 1110 76
        i 5.827 147.567 0.100 1 1101 52
        i 5.828 147.584 0.100 1 1100 81
        i 5.829 147.677 0.100 1 1094 74
        i 5.830 147.697 0.100 1 1092 80
        i 5.831 147.743 0.100 1 1100 77
        i 5.832 147.753 0.100 1 1100 72
        i 5.833 147.813 0.100 1 1102 54
        i 5.834 147.924 0.100 1 1114 45
        i 5.835 147.927 0.100 1 1100 71
        i 5.836 147.940 0.100 1 1100 55
        i 5.837 147.963 0.100 1 1105 64
        i 4.637 148.001 0.490 3 41 127 0
        i 4.638 148.501 0.490 3 41 127 1
        i 4.639 149.501 0.490 3 41 127 2
        i 4.640 151.001 0.490 3 41 127 3
        i 4.641 153.001 0.490 3 41 127 4
        i 4.643 148.001 0.490 3 53 56 0
        i 4.644 148.501 0.490 3 53 56 1
        i 4.645 149.501 0.490 3 53 56 2
        i 4.646 151.001 0.490 3 53 56 3
        i 4.647 153.001 0.490 3 53 56 4
        i 5.838 148.029 0.100 1 1110 59
        i 5.839 148.207 0.100 1 1102 54
        i 5.840 148.279 0.100 1 1094 82
        i 5.841 148.279 0.100 1 1112 61
        i 5.842 148.359 0.100 1 1095 71
        i 5.843 148.416 0.100 1 1102 61
        i 5.844 148.489 0.100 1 1102 51
        i 5.845 148.535 0.100 1 1098 81
        i 5.846 148.555 0.100 1 1112 53
        i 5.847 148.632 0.100 1 1104 65
        i 5.848 148.667 0.100 1 1098 76
        i 5.849 148.668 0.100 1 1100 50
        i 5.850 148.697 0.100 1 1098 77
        i 4.649 148.751 0.490 3 40 127 0
        i 4.650 149.251 0.490 3 40 127 1
        i 4.651 150.251 0.490 3 40 127 2
        i 4.652 151.751 0.490 3 40 127 3
        i 4.653 153.751 0.490 3 40 127 4
        i 4.655 148.751 0.490 3 52 56 0
        i 4.656 149.251 0.490 3 52 56 1
        i 4.657 150.251 0.490 3 52 56 2
        i 4.658 151.751 0.490 3 52 56 3
        i 4.659 153.751 0.490 3 52 56 4
        i 5.851 148.767 0.100 1 1100 64
        i 5.852 148.835 0.100 1 1106 60
        i 5.853 148.981 0.100 1 1097 81
        i 5.854 149.031 0.100 1 1112 46
        i 5.855 149.067 0.100 1 1102 68
        i 5.856 149.196 0.100 1 1096 62
        i 5.857 149.384 0.100 1 1106 75
        i 5.858 149.395 0.100 1 1096 53
        i 5.859 149.409 0.100 1 1110 50
        i 5.860 149.485 0.100 1 1104 65
        i 5.861 149.503 0.100 1 1102 58
        i 5.862 149.517 0.100 1 1095 64
        i 5.863 149.520 0.100 1 1102 74
        i 5.864 149.579 0.100 1 1108 63
        i 5.865 149.612 0.100 1 1108 62
        i 5.866 149.624 0.100 1 1108 51
        i 5.867 149.628 0.100 1 1112 35
        i 5.868 149.644 0.100 1 1110 71
        i 5.869 149.713 0.100 1 1102 51
        i 5.870 149.781 0.100 1 1093 58
        i 5.871 149.879 0.100 1 1104 60
        i 4.661 150.001 0.490 3 57 43 0
        i 4.662 150.501 0.490 3 57 43 1
        i 4.663 151.501 0.490 3 57 43 2
        i 4.664 153.001 0.490 3 57 43 3
        i 4.665 155.001 0.490 3 57 43 4
        i 4.667 150.001 0.490 3 45 43 0
        i 4.668 150.501 0.490 3 45 43 1
        i 4.669 151.501 0.490 3 45 43 2
        i 4.670 153.001 0.490 3 45 43 3
        i 4.671 155.001 0.490 3 45 43 4
        i 5.872 150.023 0.100 1 1106 72
        i 5.873 150.044 0.100 1 1106 60
        i 5.874 150.197 0.100 1 1096 82
        i 5.875 150.259 0.100 1 1106 67
        i 5.876 150.271 0.100 1 1094 53
        i 5.877 150.272 0.100 1 1104 66
        i 5.878 150.319 0.100 1 1106 61
        i 5.879 150.368 0.100 1 1114 51
        i 5.880 150.377 0.100 1 1104 78
        i 5.881 150.467 0.100 1 1093 79
        i 5.882 150.476 0.100 1 1108 56
        i 5.883 150.544 0.100 1 1108 78
        i 5.884 150.559 0.100 1 1104 72
        i 5.885 150.597 0.100 1 1108 56
        i 5.886 150.695 0.100 1 1101 66
        i 5.887 150.716 0.100 1 1099 81
        i 4.673 150.751 0.490 3 55 43 0
        i 4.674 151.251 0.490 3 55 43 1
        i 4.675 152.251 0.490 3 55 43 2
        i 4.676 153.751 0.490 3 55 43 3
        i 4.677 155.751 0.490 3 55 43 4
        i 4.679 150.751 0.490 3 43 43 0
        i 4.680 151.251 0.490 3 43 43 1
        i 4.681 152.251 0.490 3 43 43 2
        i 4.682 153.751 0.490 3 43 43 3
        i 4.683 155.751 0.490 3 43 43 4
        i 5.888 150.943 0.100 1 1098 78
        i 5.889 150.956 0.100 1 1096 54
        i 5.890 151.001 0.100 1 1104 65
        i 5.891 151.027 0.100 1 1106 47
        i 5.892 151.107 0.100 1 1106 61
        i 5.893 151.115 0.100 1 1110 63
        i 5.894 151.133 0.100 1 1102 51
        i 5.895 151.184 0.100 1 1106 76
        i 5.896 151.195 0.100 1 1102 71
        i 5.897 151.259 0.100 1 1094 80
        i 5.898 151.284 0.100 1 1101 58
        i 5.899 151.297 0.100 1 1106 75
        i 5.900 151.329 0.100 1 1103 62
        i 5.901 151.351 0.100 1 1105 36
        i 5.902 151.373 0.100 1 1095 78
        i 5.903 151.555 0.100 1 1098 64
        i 5.904 151.585 0.100 1 1102 81
        i 5.905 151.657 0.100 1 1108 68
        i 5.906 151.700 0.100 1 1104 51
        i 5.907 151.731 0.100 1 1114 50
        i 5.908 151.768 0.100 1 1109 53
        i 5.909 151.900 0.100 1 1100 70
        i 5.910 151.981 0.100 1 1096 64
        i 4.685 152.001 0.490 3 36 127 0
        i 4.686 152.501 0.490 3 36 127 1
        i 4.687 153.501 0.490 3 36 127 2
        i 4.688 155.001 0.490 3 36 127 3
        i 4.689 157.001 0.490 3 36 127 4
        i 4.691 152.001 0.490 3 48 56 0
        i 4.692 152.501 0.490 3 48 56 1
        i 4.693 153.501 0.490 3 48 56 2
        i 4.694 155.001 0.490 3 48 56 3
        i 4.695 157.001 0.490 3 48 56 4
        i 5.911 152.035 0.100 1 1104 59
        i 5.912 152.056 0.100 1 1101 78
        i 5.913 152.069 0.100 1 1110 74
        i 5.914 152.104 0.100 1 1104 51
        i 5.915 152.128 0.100 1 1107 41
        i 5.916 152.149 0.100 1 1100 59
        i 5.917 152.193 0.100 1 1093 80
        i 5.918 152.207 0.100 1 1093 64
        i 5.919 152.256 0.100 1 1099 52
        i 5.920 152.375 0.100 1 1113 39
        i 5.921 152.409 0.100 1 1099 71
        i 5.922 152.415 0.100 1 1100 69
        i 5.923 152.425 0.100 1 1104 64
        i 5.924 152.551 0.100 1 1109 68
        i 5.925 152.663 0.100 1 1111 47
        i 5.926 152.681 0.100 1 1103 41
        i 4.697 152.751 0.490 3 38 127 0
        i 4.698 153.251 0.490 3 38 127 1
        i 4.699 154.251 0.490 3 38 127 2
        i 4.700 155.751 0.490 3 38 127 3
        i 4.701 157.751 0.490 3 38 127 4
        i 4.703 152.751 0.490 3 50 56 0
        i 4.704 153.251 0.490 3 50 56 1
        i 4.705 154.251 0.490 3 50 56 2
        i 4.706 155.751 0.490 3 50 56 3
        i 4.707 157.751 0.490 3 50 56 4
        i 5.927 152.787 0.100 1 1095 81
        i 5.928 152.797 0.100 1 1101 74
        i 5.929 152.860 0.100 1 1103 63
        i 5.930 152.869 0.100 1 1095 58
        i 5.931 152.885 0.100 1 1107 48
        i 5.932 152.939 0.100 1 1100 61
        i 5.933 152.956 0.100 1 1101 69
        i 5.934 152.979 0.100 1 1113 56
        i 5.935 152.987 0.100 1 1097 56
        i 5.936 153.081 0.100 1 1097 60
        i 5.937 153.087 0.100 1 1102 72
        i 5.938 153.199 0.100 1 1103 66
        i 5.939 153.371 0.100 1 1109 46
        i 5.940 153.377 0.100 1 1111 75
        i 5.941 153.471 0.100 1 1098 81
        i 5.942 153.472 0.100 1 1111 61
        i 5.943 153.543 0.100 1 1101 50
        i 5.944 153.545 0.100 1 1103 63
        i 5.945 153.613 0.100 1 1107 71
        i 5.946 153.632 0.100 1 1097 58
        i 5.947 153.692 0.100 1 1095 67
        i 5.948 153.717 0.100 1 1095 76
        i 5.949 153.723 0.100 1 1109 56
        i 5.950 153.787 0.100 1 1107 62
        i 5.951 153.859 0.100 1 1107 57
        i 5.952 153.895 0.100 1 1105 68
        i 5.953 153.912 0.100 1 1109 63
        i 5.954 153.985 0.100 1 1094 82
        i 4.709 154.001 0.490 3 52 43 0
        i 4.710 154.501 0.490 3 52 43 1
        i 4.711 155.501 0.490 3 52 43 2
        i 4.712 157.001 0.490 3 52 43 3
        i 4.713 159.001 0.490 3 52 43 4
        i 4.715 154.001 0.490 3 40 43 0
        i 4.716 154.501 0.490 3 40 43 1
        i 4.717 155.501 0.490 3 40 43 2
        i 4.718 157.001 0.490 3 40 43 3
        i 4.719 159.001 0.490 3 40 43 4
        i 5.955 154.015 0.100 1 1101 64
        i 5.956 154.088 0.100 1 1105 49
        i 5.957 154.247 0.100 1 1109 54
        i 5.958 154.256 0.100 1 1105 58
        i 5.959 154.289 0.100 1 1093 66
        i 5.960 154.321 0.100 1 1113 45
        i 5.961 154.343 0.100 1 1103 63
        i 5.962 154.407 0.100 1 1107 59
        i 5.963 154.560 0.100 1 1103 59
        i 5.964 154.560 0.100 1 1105 61
        i 5.965 154.619 0.100 1 1107 78
        i 5.966 154.655 0.100 1 1097 64
        i 5.967 154.673 0.100 1 1105 69
        i 5.968 154.703 0.100 1 1105 77
        i 5.969 154.715 0.100 1 1095 82
        i 4.721 154.751 0.490 3 53 43 0
        i 4.722 155.251 0.490 3 53 43 1
        i 4.723 156.251 0.490 3 53 43 2
        i 4.724 157.751 0.490 3 53 43 3
        i 4.725 159.751 0.490 3 53 43 4
        i 4.727 154.751 0.490 3 41 43 0
        i 4.728 155.251 0.490 3 41 43 1
        i 4.729 156.251 0.490 3 41 43 2
        i 4.730 157.751 0.490 3 41 43 3
        i 4.731 159.751 0.490 3 41 43 4
        i 5.970 154.817 0.100 1 1107 74
        i 5.971 154.908 0.100 1 1109 69
        i 5.972 154.913 0.100 1 1092 64
        i 5.973 154.935 0.100 1 1103 76
        i 5.974 155.071 0.100 1 1107 52
        i 5.975 155.129 0.100 1 1115 52
        i 5.976 155.192 0.100 1 1099 76
        i 5.977 155.192 0.100 1 1101 56
        i 5.978 155.224 0.100 1 1105 68
        i 5.979 155.321 0.100 1 1107 61
        i 5.980 155.364 0.100 1 1097 75
        i 5.981 155.377 0.100 1 1105 52
        i 5.982 155.419 0.100 1 1099 56
        i 5.983 155.553 0.100 1 1101 78
        i 5.984 155.555 0.100 1 1109 57
        i 5.985 155.565 0.100 1 1103 66
        i 5.986 155.668 0.100 1 1103 63
        i 5.987 155.696 0.100 1 1105 44
        i 5.988 155.753 0.100 1 1102 70
        i 5.989 155.793 0.100 1 1100 53
        i 5.990 155.812 0.100 1 1111 57
        i 5.991 155.904 0.100 1 1095 61
        i 4.733 156.001 0.490 3 41 127 0
        i 4.734 156.501 0.490 3 41 127 1
        i 4.735 157.501 0.490 3 41 127 2
        i 4.736 159.001 0.490 3 41 127 3
        i 4.737 161.001 0.490 3 41 127 4
        i 4.739 156.001 0.490 3 53 56 0
        i 4.740 156.501 0.490 3 53 56 1
        i 4.741 157.501 0.490 3 53 56 2
        i 4.742 159.001 0.490 3 53 56 3
        i 4.743 161.001 0.490 3 53 56 4
        i 5.992 156.064 0.100 1 1105 74
        i 5.993 156.091 0.100 1 1099 64
        i 5.994 156.123 0.100 1 1095 57
        i 5.995 156.151 0.100 1 1099 69
        i 5.996 156.196 0.100 1 1103 56
        i 5.997 156.221 0.100 1 1101 69
        i 5.998 156.255 0.100 1 1115 65
        i 5.999 156.271 0.100 1 1101 66
        i 5.001 156.324 0.100 1 1105 61
        i 5.002 156.345 0.100 1 1103 66
        i 5.003 156.373 0.100 1 1107 51
        i 5.004 156.381 0.100 1 1109 51
        i 5.005 156.501 0.100 1 1100 70
        i 5.006 156.596 0.100 1 1111 56
        i 5.007 156.692 0.100 1 1094 79
        i 4.745 156.751 0.490 3 43 127 0
        i 4.746 157.251 0.490 3 43 127 1
        i 4.747 158.251 0.490 3 43 127 2
        i 4.748 159.751 0.490 3 43 127 3
        i 4.749 161.751 0.490 3 43 127 4
        i 4.751 156.751 0.490 3 55 56 0
        i 4.752 157.251 0.490 3 55 56 1
        i 4.753 158.251 0.490 3 55 56 2
        i 4.754 159.751 0.490 3 55 56 3
        i 4.755 161.751 0.490 3 55 56 4
        i 5.008 156.757 0.100 1 1097 52
        i 5.009 156.792 0.100 1 1092 68
        i 5.010 156.829 0.100 1 1101 78
        i 5.011 156.833 0.100 1 1103 67
        i 5.012 156.863 0.100 1 1099 51
        i 5.013 156.924 0.100 1 1102 62
        i 5.014 157.032 0.100 1 1113 51
        i 5.015 157.100 0.100 1 1099 71
        i 5.016 157.152 0.100 1 1113 57
        i 5.017 157.184 0.100 1 1101 60
        i 5.018 157.293 0.100 1 1110 60
        i 5.019 157.297 0.100 1 1096 53
        i 5.020 157.313 0.100 1 1103 72
        i 5.021 157.336 0.100 1 1096 61
        i 5.022 157.345 0.100 1 1108 78
        i 5.023 157.419 0.100 1 1103 74
        i 5.024 157.447 0.100 1 1097 51
        i 5.025 157.556 0.100 1 1106 63
        i 5.026 157.627 0.100 1 1099 69
        i 5.027 157.683 0.100 1 1101 68
        i 5.028 157.705 0.100 1 1097 70
        i 5.029 157.729 0.100 1 1102 82
        i 5.030 157.911 0.100 1 1110 69
        i 5.031 157.916 0.100 1 1098 82
        i 5.032 157.963 0.100 1 1108 51
        i 4.757 158.001 0.490 3 57 43 0
        i 4.758 158.501 0.490 3 57 43 1
        i 4.759 159.501 0.490 3 57 43 2
        i 4.760 161.001 0.490 3 57 43 3
        i 4.761 163.001 0.490 3 57 43 4
        i 4.763 158.001 0.490 3 45 43 0
        i 4.764 158.501 0.490 3 45 43 1
        i 4.765 159.501 0.490 3 45 43 2
        i 4.766 161.001 0.490 3 45 43 3
        i 4.767 163.001 0.490 3 45 43 4
        i 5.033 158.072 0.100 1 1103 60
        i 5.034 158.084 0.100 1 1111 77
        i 5.035 158.101 0.100 1 1102 61
        i 5.036 158.133 0.100 1 1108 37
        i 5.037 158.155 0.100 1 1094 69
        i 5.038 158.192 0.100 1 1094 79
        i 5.039 158.221 0.100 1 1106 77
        i 5.040 158.232 0.100 1 1097 70
        i 5.041 158.304 0.100 1 1105 61
        i 5.042 158.421 0.100 1 1106 62
        i 5.043 158.424 0.100 1 1093 62
        i 5.044 158.485 0.100 1 1104 72
        i 5.045 158.491 0.100 1 1100 73
        i 5.046 158.547 0.100 1 1110 48
        i 5.047 158.648 0.100 1 1104 60
        i 5.048 158.731 0.100 1 1114 52
        i 4.769 158.751 0.490 3 59 43 0
        i 4.770 159.251 0.490 3 59 43 1
        i 5.049 158.751 0.100 1 1108 62
        i 4.771 160.251 0.490 3 59 43 2
        i 4.772 161.751 0.490 3 59 43 3
        i 4.773 163.751 0.490 3 59 43 4
        i 4.775 158.751 0.490 3 47 43 0
        i 4.776 159.251 0.490 3 47 43 1
        i 4.777 160.251 0.490 3 47 43 2
        i 4.778 161.751 0.490 3 47 43 3
        i 4.779 163.751 0.490 3 47 43 4
        i 5.050 158.801 0.100 1 1092 81
        i 5.051 158.871 0.100 1 1108 56
        i 5.052 158.968 0.100 1 1106 58
        i 5.053 159.037 0.100 1 1096 73
        i 5.054 159.072 0.100 1 1103 55
        i 5.055 159.076 0.100 1 1098 61
        i 5.056 159.087 0.100 1 1104 73
        i 5.057 159.212 0.100 1 1108 64
        i 5.058 159.216 0.100 1 1107 72
        i 5.059 159.284 0.100 1 1106 69
        i 5.060 159.312 0.100 1 1102 68
        i 5.061 159.329 0.100 1 1091 56
        i 5.062 159.377 0.100 1 1116 43
        i 5.063 159.389 0.100 1 1104 77
        i 5.064 159.477 0.100 1 1110 67
        i 5.065 159.544 0.100 1 1106 49
        i 5.066 159.597 0.100 1 1106 53
        i 5.067 159.648 0.100 1 1104 57
        i 5.068 159.668 0.100 1 1100 68
        i 5.069 159.692 0.100 1 1102 63
        i 5.070 159.775 0.100 1 1098 77
        i 5.071 159.832 0.100 1 1104 72
        i 5.072 159.895 0.100 1 1104 42
        i 5.073 159.980 0.100 1 1100 52
        i 4.781 160.001 0.490 3 36 127 0
        i 4.782 160.501 0.490 3 36 127 1
        i 4.783 161.501 0.490 3 36 127 2
        i 4.784 163.001 0.490 3 36 127 3
        i 4.785 165.001 0.490 3 36 127 4
        i 4.787 160.001 0.490 3 48 56 0
        i 4.788 160.501 0.490 3 48 56 1
        i 4.789 161.501 0.490 3 48 56 2
        i 4.790 163.001 0.490 3 48 56 3
        i 4.791 165.001 0.490 3 48 56 4
        i 5.074 160.009 0.100 1 1102 64
        i 5.075 160.104 0.100 1 1108 78
        i 5.076 160.148 0.100 1 1101 57
        i 5.077 160.185 0.100 1 1100 61
        i 5.078 160.188 0.100 1 1110 59
        i 5.079 160.188 0.100 1 1112 60
        i 5.080 160.252 0.100 1 1104 76
        i 5.081 160.265 0.100 1 1106 44
        i 5.082 160.305 0.100 1 1100 60
        i 5.083 160.435 0.100 1 1094 62
        i 5.084 160.439 0.100 1 1114 50
        i 5.085 160.459 0.100 1 1096 71
        i 5.086 160.628 0.100 1 1102 57
        i 5.087 160.659 0.100 1 1102 62
        i 5.088 160.708 0.100 1 1106 72
        i 4.793 160.751 0.490 3 38 127 0
        i 4.794 161.251 0.490 3 38 127 1
        i 4.795 162.251 0.490 3 38 127 2
        i 4.796 163.751 0.490 3 38 127 3
        i 4.797 165.751 0.490 3 38 127 4
        i 5.089 160.749 0.100 1 1100 79
        i 4.799 160.751 0.490 3 50 56 0
        i 4.800 161.251 0.490 3 50 56 1
        i 4.801 162.251 0.490 3 50 56 2
        i 4.802 163.751 0.490 3 50 56 3
        i 4.803 165.751 0.490 3 50 56 4
        i 5.090 160.835 0.100 1 1100 66
        i 5.091 160.917 0.100 1 1099 78
        i 5.092 161.005 0.100 1 1098 80
        i 5.093 161.011 0.100 1 1100 65
        i 5.094 161.043 0.100 1 1102 53
        i 5.095 161.075 0.100 1 1112 60
        i 5.096 161.105 0.100 1 1110 68
        i 5.097 161.136 0.100 1 1108 39
        i 5.098 161.243 0.100 1 1112 68
        i 5.099 161.255 0.100 1 1102 78
        i 5.100 161.327 0.100 1 1100 66
        i 5.101 161.377 0.100 1 1092 65
        i 5.102 161.424 0.100 1 1098 50
        i 5.103 161.515 0.100 1 1102 60
        i 5.104 161.573 0.100 1 1112 27
        i 5.105 161.624 0.100 1 1104 69
        i 5.106 161.705 0.100 1 1098 55
        i 5.107 161.764 0.100 1 1110 33
        i 5.108 161.773 0.100 1 1097 61
        i 5.109 161.787 0.100 1 1098 51
        i 5.110 161.816 0.100 1 1108 56
        i 5.111 161.873 0.100 1 1112 51
        i 5.112 161.891 0.100 1 1102 62
        i 5.113 161.893 0.100 1 1108 54
        i 4.805 162.001 0.490 3 52 43 0
        i 4.806 162.501 0.490 3 52 43 1
        i 4.807 163.501 0.490 3 52 43 2
        i 4.808 165.001 0.490 3 52 43 3
        i 4.809 167.001 0.490 3 52 43 4
        i 4.811 162.001 0.490 3 40 43 0
        i 4.812 162.501 0.490 3 40 43 1
        i 4.813 163.501 0.490 3 40 43 2
        i 4.814 165.001 0.490 3 40 43 3
        i 4.815 167.001 0.490 3 40 43 4
        i 5.114 162.048 0.100 1 1104 61
        i 5.115 162.108 0.100 1 1110 79
        i 5.116 162.161 0.100 1 1096 60
        i 5.117 162.192 0.100 1 1115 52
        i 5.118 162.219 0.100 1 1100 60
        i 5.119 162.260 0.100 1 1101 60
        i 5.120 162.304 0.100 1 1096 51
        i 5.121 162.317 0.100 1 1102 63
        i 5.122 162.323 0.100 1 1098 75
        i 5.123 162.332 0.100 1 1099 80
        i 5.124 162.379 0.100 1 1107 33
        i 5.125 162.600 0.100 1 1104 79
        i 5.126 162.608 0.100 1 1110 56
        i 5.127 162.663 0.100 1 1094 60
        i 4.817 162.751 0.490 3 53 43 0
        i 4.818 163.251 0.490 3 53 43 1
        i 4.819 164.251 0.490 3 53 43 2
        i 4.820 165.751 0.490 3 53 43 3
        i 4.821 167.751 0.490 3 53 43 4
        i 4.823 162.751 0.490 3 41 43 0
        i 4.824 163.251 0.490 3 41 43 1
        i 4.825 164.251 0.490 3 41 43 2
        i 4.826 165.751 0.490 3 41 43 3
        i 4.827 167.751 0.490 3 41 43 4
        i 5.128 162.787 0.100 1 1106 60
        i 5.129 162.809 0.100 1 1106 67
        i 5.130 162.861 0.100 1 1093 64
        i 5.131 162.891 0.100 1 1110 70
        i 5.132 162.967 0.100 1 1099 77
        i 5.133 162.980 0.100 1 1105 22
        i 5.134 162.983 0.100 1 1106 56
        i 5.135 163.003 0.100 1 1108 61
        i 5.136 163.025 0.100 1 1105 55
        i 5.137 163.056 0.100 1 1104 60
        i 5.138 163.060 0.100 1 1106 59
        i 5.139 163.156 0.100 1 1108 63
        i 5.140 163.236 0.100 1 1115 53
        i 5.141 163.352 0.100 1 1106 53
        i 5.142 163.424 0.100 1 1096 69
        i 5.143 163.497 0.100 1 1099 63
        i 5.144 163.524 0.100 1 1107 52
        i 5.145 163.569 0.100 1 1104 77
        i 5.146 163.595 0.100 1 1103 59
        i 5.147 163.689 0.100 1 1108 55
        i 5.148 163.704 0.100 1 1103 60
        i 5.149 163.735 0.100 1 1105 52
        i 5.150 163.745 0.100 1 1091 61
        i 5.151 163.861 0.100 1 1104 65
        i 5.152 163.943 0.100 1 1101 57
        i 5.153 163.996 0.100 1 1107 72
        i 4.829 164.001 0.490 3 41 127 0
        i 4.830 164.501 0.490 3 41 127 1
        i 4.831 165.501 0.490 3 41 127 2
        i 4.832 167.001 0.490 3 41 127 3
        i 4.833 169.001 0.490 3 41 127 4
        i 4.835 164.001 0.490 3 53 56 0
        i 4.836 164.501 0.490 3 53 56 1
        i 4.837 165.501 0.490 3 53 56 2
        i 4.838 167.001 0.490 3 53 56 3
        i 4.839 169.001 0.490 3 53 56 4
        i 5.154 164.044 0.100 1 1111 46
        i 5.155 164.077 0.100 1 1105 78
        i 5.156 164.139 0.100 1 1115 35
        i 5.157 164.144 0.100 1 1101 61
        i 5.158 164.149 0.100 1 1113 27
        i 5.159 164.228 0.100 1 1105 57
        i 5.160 164.293 0.100 1 1097 70
        i 5.161 164.320 0.100 1 1098 57
        i 5.162 164.332 0.100 1 1101 67
        i 5.163 164.427 0.100 1 1101 76
        i 5.164 164.543 0.100 1 1100 59
        i 5.165 164.545 0.100 1 1103 58
        i 5.166 164.581 0.100 1 1109 74
        i 5.167 164.721 0.100 1 1113 54
        i 4.841 164.751 0.490 3 40 127 0
        i 4.842 165.251 0.490 3 40 127 1
        i 4.843 166.251 0.490 3 40 127 2
        i 4.844 167.751 0.490 3 40 127 3
        i 4.845 169.751 0.490 3 40 127 4
        i 4.847 164.751 0.490 3 52 56 0
        i 4.848 165.251 0.490 3 52 56 1
        i 4.849 166.251 0.490 3 52 56 2
        i 4.850 167.751 0.490 3 52 56 3
        i 4.851 169.751 0.490 3 52 56 4
        i 5.168 164.779 0.100 1 1103 62
        i 5.169 164.799 0.100 1 1107 45
        i 5.170 164.817 0.100 1 1099 75
        i 5.171 164.836 0.100 1 1099 78
        i 5.172 164.856 0.100 1 1111 35
        i 5.173 164.876 0.100 1 1109 72
        i 5.174 164.935 0.100 1 1103 57
        i 5.175 164.965 0.100 1 1093 52
        i 5.176 165.132 0.100 1 1107 76
        i 5.177 165.160 0.100 1 1101 74
        i 5.178 165.271 0.100 1 1111 66
        i 5.179 165.279 0.100 1 1099 73
        i 5.180 165.333 0.100 1 1098 57
        i 5.181 165.383 0.100 1 1109 30
        i 5.182 165.393 0.100 1 1113 51
        i 5.183 165.481 0.100 1 1103 61
        i 5.184 165.483 0.100 1 1109 61
        i 5.185 165.509 0.100 1 1113 47
        i 5.186 165.531 0.100 1 1097 60
        i 5.187 165.604 0.100 1 1113 64
        i 5.188 165.643 0.100 1 1101 77
        i 5.189 165.853 0.100 1 1101 74
        i 5.190 165.884 0.100 1 1097 56
        i 5.191 165.916 0.100 1 1097 58
        i 5.192 165.963 0.100 1 1093 71
        i 4.853 166.001 0.490 3 57 43 0
        i 4.854 166.501 0.490 3 57 43 1
        i 4.855 167.501 0.490 3 57 43 2
        i 4.856 169.001 0.490 3 57 43 3
        i 4.857 171.001 0.490 3 57 43 4
        i 4.859 166.001 0.490 3 45 43 0
        i 4.860 166.501 0.490 3 45 43 1
        i 4.861 167.501 0.490 3 45 43 2
        i 4.862 169.001 0.490 3 45 43 3
        i 4.863 171.001 0.490 3 45 43 4
        i 5.193 166.027 0.100 1 1107 69
        i 5.194 166.079 0.100 1 1103 60
        i 5.195 166.103 0.100 1 1095 71
        i 5.196 166.127 0.100 1 1111 49
        i 5.197 166.161 0.100 1 1101 65
        i 5.198 166.208 0.100 1 1109 50
        i 5.199 166.211 0.100 1 1098 76
        i 5.200 166.263 0.100 1 1115 51
        i 5.201 166.288 0.100 1 1105 57
        i 5.202 166.296 0.100 1 1101 51
        i 5.203 166.453 0.100 1 1111 61
        i 5.204 166.631 0.100 1 1099 70
        i 5.205 166.732 0.100 1 1105 61
        i 5.206 166.748 0.100 1 1100 74
        i 4.865 166.751 0.490 3 55 43 0
        i 4.866 167.251 0.490 3 55 43 1
        i 4.867 168.251 0.490 3 55 43 2
        i 4.868 169.751 0.490 3 55 43 3
        i 4.869 171.751 0.490 3 55 43 4
        i 4.871 166.751 0.490 3 43 43 0
        i 4.872 167.251 0.490 3 43 43 1
        i 4.873 168.251 0.490 3 43 43 2
        i 4.874 169.751 0.490 3 43 43 3
        i 4.875 171.751 0.490 3 43 43 4
        i 5.207 166.753 0.100 1 1099 77
        i 5.208 166.755 0.100 1 1103 71
        i 5.209 166.768 0.100 1 1105 74
        i 5.210 166.776 0.100 1 1095 55
        i 5.211 166.780 0.100 1 1103 56
        i 5.212 166.791 0.100 1 1101 77
        i 5.213 166.837 0.100 1 1109 70
        i 5.214 166.897 0.100 1 1109 49
        i 5.215 166.919 0.100 1 1109 44
        i 5.216 166.963 0.100 1 1105 44
        i 5.217 167.081 0.100 1 1105 76
        i 5.218 167.141 0.100 1 1107 36
        i 5.219 167.240 0.100 1 1095 83
        i 5.220 167.300 0.100 1 1092 83
        i 5.221 167.369 0.100 1 1103 81
        i 5.222 167.387 0.100 1 1107 57
        i 5.223 167.411 0.100 1 1107 50
        i 5.224 167.443 0.100 1 1099 71
        i 5.225 167.443 0.100 1 1105 72
        i 5.226 167.475 0.100 1 1111 62
        i 5.227 167.551 0.100 1 1105 53
        i 5.228 167.684 0.100 1 1107 69
        i 5.229 167.711 0.100 1 1105 76
        i 5.230 167.743 0.100 1 1105 63
        i 5.231 167.832 0.100 1 1115 50
        i 5.232 167.853 0.100 1 1107 59
        i 5.233 167.880 0.100 1 1097 55
        i 5.234 167.933 0.100 1 1108 28
        i 5.235 167.968 0.100 1 1100 63
        i 4.877 168.001 0.490 3 40 127 0
        i 4.878 168.501 0.490 3 40 127 1
        i 5.236 168.005 0.100 1 1097 66
        i 4.879 169.501 0.490 3 40 127 2
        i 4.880 171.001 0.490 3 40 127 3
        i 4.881 173.001 0.490 3 40 127 4
        i 4.883 168.001 0.490 3 52 56 0
        i 4.884 168.501 0.490 3 52 56 1
        i 4.885 169.501 0.490 3 52 56 2
        i 4.886 171.001 0.490 3 52 56 3
        i 4.887 173.001 0.490 3 52 56 4
        i 5.237 168.052 0.100 1 1105 40
        i 5.238 168.055 0.100 1 1103 65
        i 5.239 168.097 0.100 1 1107 67
        i 5.240 168.101 0.100 1 1107 61
        i 5.241 168.163 0.100 1 1092 60
        i 5.242 168.167 0.100 1 1103 48
        i 5.243 168.288 0.100 1 1103 54
        i 5.244 168.355 0.100 1 1111 42
        i 5.245 168.384 0.100 1 1114 45
        i 5.246 168.572 0.100 1 1100 58
        i 5.247 168.607 0.100 1 1105 66
        i 5.248 168.636 0.100 1 1099 71
        i 5.249 168.667 0.100 1 1101 58
        i 5.250 168.669 0.100 1 1102 60
        i 4.889 168.751 0.490 3 38 127 0
        i 4.890 169.251 0.490 3 38 127 1
        i 4.891 170.251 0.490 3 38 127 2
        i 4.892 171.751 0.490 3 38 127 3
        i 4.893 173.751 0.490 3 38 127 4
        i 4.895 168.751 0.490 3 50 56 0
        i 4.896 169.251 0.490 3 50 56 1
        i 4.897 170.251 0.490 3 50 56 2
        i 4.898 171.751 0.490 3 50 56 3
        i 4.899 173.751 0.490 3 50 56 4
        i 5.251 168.755 0.100 1 1110 54
        i 5.252 168.795 0.100 1 1112 22
        i 5.253 168.823 0.100 1 1104 55
        i 5.254 168.887 0.100 1 1101 77
        i 5.255 168.897 0.100 1 1109 59
        i 5.256 168.920 0.100 1 1099 49
        i 5.257 168.939 0.100 1 1100 55
        i 5.258 168.985 0.100 1 1105 64
        i 5.259 169.179 0.100 1 1108 62
        i 5.260 169.193 0.100 1 1098 50
        i 5.261 169.243 0.100 1 1096 57
        i 5.262 169.292 0.100 1 1114 52
        i 5.263 169.353 0.100 1 1110 74
        i 5.264 169.440 0.100 1 1112 69
        i 5.265 169.545 0.100 1 1092 68
        i 5.266 169.548 0.100 1 1104 66
        i 5.267 169.553 0.100 1 1103 79
        i 5.268 169.572 0.100 1 1101 71
        i 5.269 169.600 0.100 1 1098 83
        i 5.270 169.603 0.100 1 1110 24
        i 5.271 169.668 0.100 1 1108 68
        i 5.272 169.751 0.100 1 1097 63
        i 5.273 169.783 0.100 1 1108 58
        i 5.274 169.811 0.100 1 1100 51
        i 5.275 169.903 0.100 1 1094 73
        i 5.276 169.920 0.100 1 1104 72
        i 5.277 169.957 0.100 1 1102 58
        i 4.901 170.001 0.490 3 55 43 0
        i 4.902 170.501 0.490 3 55 43 1
        i 4.903 171.501 0.490 3 55 43 2
        i 4.904 173.001 0.490 3 55 43 3
        i 4.905 175.001 0.490 3 55 43 4
        i 4.907 170.001 0.490 3 43 43 0
        i 4.908 170.501 0.490 3 43 43 1
        i 4.909 171.501 0.490 3 43 43 2
        i 4.910 173.001 0.490 3 43 43 3
        i 4.911 175.001 0.490 3 43 43 4
        i 5.278 170.083 0.100 1 1112 49
        i 5.279 170.143 0.100 1 1110 52
        i 5.280 170.231 0.100 1 1098 74
        i 5.281 170.404 0.100 1 1110 55
        i 5.282 170.445 0.100 1 1096 62
        i 5.283 170.480 0.100 1 1104 72
        i 5.284 170.495 0.100 1 1094 74
        i 5.285 170.521 0.100 1 1104 69
        i 5.286 170.580 0.100 1 1114 40
        i 5.287 170.588 0.100 1 1110 52
        i 5.288 170.649 0.100 1 1099 64
        i 5.289 170.652 0.100 1 1104 66
        i 5.290 170.728 0.100 1 1106 63
        i 4.913 170.751 0.490 3 55 43 0
        i 4.914 171.251 0.490 3 55 43 1
        i 4.915 172.251 0.490 3 55 43 2
        i 4.916 173.751 0.490 3 55 43 3
        i 4.917 175.751 0.490 3 55 43 4
        i 4.919 170.751 0.490 3 43 43 0
        i 4.920 171.251 0.490 3 43 43 1
        i 4.921 172.251 0.490 3 43 43 2
        i 4.922 173.751 0.490 3 43 43 3
        i 4.923 175.751 0.490 3 43 43 4
        i 5.291 170.771 0.100 1 1113 6
        i 5.292 170.785 0.100 1 1102 74
        i 5.293 170.865 0.100 1 1108 42
        i 5.294 171.164 0.100 1 1101 68
        i 5.295 171.169 0.100 1 1102 56
        i 5.296 171.215 0.100 1 1110 61
        i 5.297 171.227 0.100 1 1116 40
        i 5.298 171.268 0.100 1 1100 56
        i 5.299 171.296 0.100 1 1106 80
        i 5.300 171.387 0.100 1 1106 56
        i 5.301 171.400 0.100 1 1096 75
        i 5.302 171.485 0.100 1 1108 59
        i 5.303 171.569 0.100 1 1106 79
        i 5.304 171.717 0.100 1 1098 77
        i 5.305 171.737 0.100 1 1091 59
        i 5.306 171.747 0.100 1 1115 8
        i 5.307 171.865 0.100 1 1098 56
        i 5.308 171.912 0.100 1 1104 51
        i 5.309 171.924 0.100 1 1096 80
        i 4.925 172.001 0.490 3 36 127 0
        i 4.926 172.501 0.490 3 36 127 1
        i 4.927 173.501 0.490 3 36 127 2
        i 4.928 175.001 0.490 3 36 127 3
        i 4.929 177.001 0.490 3 36 127 4
        i 4.931 172.001 0.490 3 48 56 0
        i 4.932 172.501 0.490 3 48 56 1
        i 4.933 173.501 0.490 3 48 56 2
        i 4.934 175.001 0.490 3 48 56 3
        i 4.935 177.001 0.490 3 48 56 4
        i 5.310 172.041 0.100 1 1106 26
        i 5.311 172.059 0.100 1 1112 63
        i 5.312 172.151 0.100 1 1116 49
        i 5.313 172.165 0.100 1 1106 59
        i 5.314 172.436 0.100 1 1100 62
        i 5.315 172.443 0.100 1 1098 81
        i 5.316 172.445 0.100 1 1100 60
        i 5.317 172.483 0.100 1 1102 79
        i 5.318 172.559 0.100 1 1108 46
        i 5.319 172.579 0.100 1 1093 69
        i 5.320 172.692 0.100 1 1107 27
        i 4.937 172.751 0.490 3 36 127 0
        i 4.938 173.251 0.490 3 36 127 1
        i 4.939 174.251 0.490 3 36 127 2
        i 4.940 175.751 0.490 3 36 127 3
        i 4.941 177.751 0.490 3 36 127 4
        i 4.943 172.751 0.490 3 48 56 0
        i 4.944 173.251 0.490 3 48 56 1
        i 4.945 174.251 0.490 3 48 56 2
        i 4.946 175.751 0.490 3 48 56 3
        i 4.947 177.751 0.490 3 48 56 4
        i 5.321 172.955 0.100 1 1096 72
        i 5.322 173.052 0.100 1 1112 60
        i 5.323 173.056 0.100 1 1104 41
        i 5.324 173.108 0.100 1 1100 53
        i 5.325 173.147 0.100 1 1114 60
        i 5.326 173.201 0.100 1 1103 80
        i 5.327 173.212 0.100 1 1111 41
        i 5.328 173.333 0.100 1 1099 58
        i 5.329 173.356 0.100 1 1102 74
        i 5.330 173.557 0.100 1 1107 18
        i 5.331 173.703 0.100 1 1093 68
        i 5.332 173.707 0.100 1 1104 50
        i 5.333 173.892 0.100 1 1109 50
        i 5.334 173.900 0.100 1 1108 48
        i 5.335 173.920 0.100 1 1098 63
        i 4.949 174.001 0.490 3 52 43 0
        i 4.950 174.501 0.490 3 52 43 1
        i 4.951 175.501 0.490 3 52 43 2
        i 4.952 177.001 0.490 3 52 43 3
        i 4.953 179.001 0.490 3 52 43 4
        i 4.955 174.001 0.490 3 40 43 0
        i 4.956 174.501 0.490 3 40 43 1
        i 4.957 175.501 0.490 3 40 43 2
        i 4.958 177.001 0.490 3 40 43 3
        i 4.959 179.001 0.490 3 40 43 4
        i 5.336 174.132 0.100 1 1093 55
        i 5.337 174.167 0.100 1 1097 59
        i 5.338 174.172 0.100 1 1104 52
        i 5.339 174.215 0.100 1 1103 64
        i 5.340 174.343 0.100 1 1115 26
        i 5.341 174.403 0.100 1 1115 23
        i 5.342 174.412 0.100 1 1111 40
        i 5.343 174.511 0.100 1 1112 38
        i 4.961 174.751 0.490 3 52 43 0
        i 4.962 175.251 0.490 3 52 43 1
        i 4.963 176.251 0.490 3 52 43 2
        i 4.964 177.751 0.490 3 52 43 3
        i 4.965 179.751 0.490 3 52 43 4
        i 4.967 174.751 0.490 3 40 43 0
        i 4.968 175.251 0.490 3 40 43 1
        i 4.969 176.251 0.490 3 40 43 2
        i 4.970 177.751 0.490 3 40 43 3
        i 4.971 179.751 0.490 3 40 43 4
        i 5.344 174.879 0.100 1 1104 56
        i 5.345 174.915 0.100 1 1096 67
        i 5.346 174.992 0.100 1 1101 58
        i 5.347 175.027 0.100 1 1095 66
        i 5.348 175.048 0.100 1 1113 11
        i 5.349 175.055 0.100 1 1109 54
        i 5.350 175.087 0.100 1 1099 82
        i 5.351 175.144 0.100 1 1107 39
        i 5.352 175.244 0.100 1 1117 31
        i 5.353 175.533 0.100 1 1099 61
        i 5.354 175.595 0.100 1 1102 70
        i 5.355 175.673 0.100 1 1113 12
        i 5.356 175.715 0.100 1 1097 70
        i 5.357 175.745 0.100 1 1099 81
        i 5.358 175.775 0.100 1 1105 67
        i 5.359 175.916 0.100 1 1107 41
        i 4.973 176.001 0.490 3 36 127 0
        i 4.974 176.501 0.490 3 36 127 1
        i 4.975 177.501 0.490 3 36 127 2
        i 4.976 179.001 0.490 3 36 127 3
        i 4.977 181.001 0.490 3 36 127 4
        i 4.979 176.001 0.490 3 48 56 0
        i 4.980 176.501 0.490 3 48 56 1
        i 4.981 177.501 0.490 3 48 56 2
        i 4.982 179.001 0.490 3 48 56 3
        i 4.983 181.001 0.490 3 48 56 4
        i 5.360 176.119 0.100 1 1105 39
        i 5.361 176.189 0.100 1 1092 61
        i 5.362 176.217 0.100 1 1115 5
        i 5.363 176.288 0.100 1 1097 66
        i 5.364 176.340 0.100 1 1101 52
        i 5.365 176.357 0.100 1 1103 68
        i 5.366 176.524 0.100 1 1097 60
        i 4.985 176.751 0.490 3 36 127 0
        i 4.986 177.251 0.490 3 36 127 1
        i 4.987 178.251 0.490 3 36 127 2
        i 4.988 179.751 0.490 3 36 127 3
        i 4.989 181.751 0.490 3 36 127 4
        i 4.991 176.751 0.490 3 48 56 0
        i 4.992 177.251 0.490 3 48 56 1
        i 4.993 178.251 0.490 3 48 56 2
        i 4.994 179.751 0.490 3 48 56 3
        i 4.995 181.751 0.490 3 48 56 4
        i 5.367 176.755 0.100 1 1106 -1
        i 5.368 176.904 0.100 1 1115 60
        i 5.369 176.911 0.100 1 1095 76
        i 5.370 176.913 0.100 1 1109 35
        i 5.371 176.923 0.100 1 1101 55
        i 5.372 176.943 0.100 1 1101 52
        i 5.373 177.009 0.100 1 1094 74
        i 5.374 177.127 0.100 1 1099 77
        i 5.375 177.372 0.100 1 1108 24
        i 5.376 177.447 0.100 1 1113 40
        i 5.377 177.671 0.100 1 1099 76
        i 5.378 177.733 0.100 1 1103 70
        i 5.379 177.743 0.100 1 1098 54
        i 5.380 177.747 0.100 1 1093 72
        i 5.381 177.748 0.100 1 1111 40
        i 5.382 177.916 0.100 1 1103 55
        i 5.383 178.069 0.100 1 1114 4
        i 5.384 178.148 0.100 1 1109 56
        i 5.385 178.347 0.100 1 1103 63
        i 5.386 178.361 0.100 1 1097 80
        i 5.387 178.584 0.100 1 1109 51
        i 5.388 178.847 0.100 1 1112 30
        i 5.389 178.887 0.100 1 1105 49
        i 5.390 179.199 0.100 1 1105 84
        i 5.391 179.212 0.100 1 1100 82
        i 5.392 179.475 0.100 1 1095 72
        i 5.393 179.581 0.100 1 1116 34
        i 5.394 179.704 0.100 1 1114 15
        i 4.997 180.001 0.490 3 36 127 0
        i 4.998 180.501 0.490 3 36 127 1
        i 4.999 181.501 0.490 3 36 127 2
        i 4.1000 183.001 0.490 3 36 127 3
        i 4.1001 185.001 0.490 3 36 127 4
        i 4.1003 180.001 0.490 3 48 56 0
        i 4.1004 180.501 0.490 3 48 56 1
        i 4.1005 181.501 0.490 3 48 56 2
        i 4.1006 183.001 0.490 3 48 56 3
        i 4.1007 185.001 0.490 3 48 56 4
        i 5.395 180.121 0.100 1 1097 53
        i 5.396 180.183 0.100 1 1105 69
        i 5.397 180.255 0.100 1 1116 38
        i 5.398 180.641 0.100 1 1116 24
        i 4.1009 180.751 0.490 3 36 127 0
        i 4.1010 181.251 0.490 3 36 127 1
        i 4.1011 182.251 0.490 3 36 127 2
        i 4.1012 183.751 0.490 3 36 127 3
        i 4.1013 185.751 0.490 3 36 127 4
        i 4.1015 180.751 0.490 3 48 56 0
        i 4.1016 181.251 0.490 3 48 56 1
        i 4.1017 182.251 0.490 3 48 56 2
        i 4.1018 183.751 0.490 3 48 56 3
        i 4.1019 185.751 0.490 3 48 56 4
        i 5.399 180.919 0.100 1 1102 73
        i 5.400 181.053 0.100 1 1098 70
        i 5.401 181.097 0.100 1 1108 40
        i 5.402 181.609 0.100 1 1110 23
        i 5.403 181.625 0.100 1 1106 27
        i 5.404 181.659 0.100 1 1100 59
        i 5.405 182.477 0.100 1 1104 79
        i 5.406 182.529 0.100 1 1109 8
        i 5.407 183.353 0.100 1 1106 66
        i 5.408 183.353 0.100 1 1113 4
        i 5.409 183.920 0.100 1 1096 51
        i 4.1021 184.001 0.490 3 36 127 0
        i 4.1022 184.501 0.490 3 36 127 1
        i 4.1023 185.501 0.490 3 36 127 2
        i 4.1024 187.001 0.490 3 36 127 3
        i 4.1025 189.001 0.490 3 36 127 4
        i 5.410 184.097 0.100 1 1111 22
        i 5.411 184.429 0.100 1 1098 78
        i 4.1027 184.751 0.490 3 36 127 0
        i 4.1028 185.251 0.490 3 36 127 1
        i 4.1029 186.251 0.490 3 36 127 2
        i 4.1030 187.751 0.490 3 36 127 3
        i 4.1031 189.751 0.490 3 36 127 4
        i 5.412 184.761 0.100 1 1115 12
        i 5.413 185.381 0.100 1 1102 50
        i 5.414 186.276 0.100 1 1100 69
        i 5.415 186.941 0.100 1 1105 79
        i 5.416 187.664 0.100 1 1107 51
        i 4.1033 188.001 0.490 3 36 127 0
        i 4.1034 188.501 0.490 3 36 127 1
        i 4.1035 189.501 0.490 3 36 127 2
        i 4.1036 191.001 0.490 3 36 127 3
        i 4.1037 193.001 0.490 3 36 127 4
        i 5.417 188.385 0.100 1 1097 77
        i 5.418 189.049 0.100 1 1099 71
        i 5.419 189.944 0.100 1 1101 55
        i 5.420 190.897 0.100 1 1099 52
        i 5.421 191.408 0.100 1 1105 57
        i 5.422 191.976 0.100 1 1106 51
        i 5.423 192.852 0.100 1 1098 69
        i 5.424 193.671 0.100 1 1100 61
        i 5.425 194.412 0.100 1 1100 48
        i 5.426 195.211 0.100 1 1098 50
        i 5.427 195.856 0.100 1 1106 51
        i 5.428 196.444 0.100 1 1106 54
        s
        i "SendEndedMessage" 10 -1
         #ifdef IS_GENERATING_JSON
            i "GenerateJson" 0 1
         #else
            e 60
         #end
        </CsScore>
        </CsoundSynthesizer>
        `
    const csdJson = `
{"6c9f37ab-392f-429b-8217-eac09f295362":[{"instanceName":"","startDistance":60,"delayDistance":100,"noteNumberToHeightScale":5.00,"delayTime":0.50,"duration":0.5,"delayCount":5},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":17.000,"note":36,"velocity":127}},{"noteOn":{"time":17.750,"note":36,"velocity":127}},{"noteOn":{"time":21.000,"note":36,"velocity":127}},{"noteOn":{"time":21.750,"note":36,"velocity":127}},{"noteOn":{"time":25.000,"note":36,"velocity":127}},{"noteOn":{"time":25.750,"note":38,"velocity":127}},{"noteOn":{"time":29.000,"note":41,"velocity":127}},{"noteOn":{"time":29.750,"note":40,"velocity":127}},{"noteOn":{"time":33.000,"note":36,"velocity":127}},{"noteOn":{"time":33.750,"note":38,"velocity":127}},{"noteOn":{"time":37.000,"note":41,"velocity":127}},{"noteOn":{"time":37.750,"note":43,"velocity":127}},{"noteOn":{"time":41.000,"note":36,"velocity":127}},{"noteOn":{"time":41.750,"note":38,"velocity":127}},{"noteOn":{"time":45.000,"note":41,"velocity":127}},{"noteOn":{"time":45.750,"note":40,"velocity":127}},{"noteOn":{"time":49.000,"note":40,"velocity":127}},{"noteOn":{"time":49.750,"note":38,"velocity":127}},{"noteOn":{"time":53.000,"note":36,"velocity":127}},{"noteOn":{"time":53.750,"note":36,"velocity":127}},{"noteOn":{"time":57.000,"note":36,"velocity":127}},{"noteOn":{"time":57.750,"note":38,"velocity":127}},{"noteOn":{"time":61.000,"note":41,"velocity":127}},{"noteOn":{"time":61.750,"note":40,"velocity":127}},{"noteOn":{"time":65.000,"note":36,"velocity":127}},{"noteOn":{"time":65.750,"note":38,"velocity":127}},{"noteOn":{"time":69.000,"note":41,"velocity":127}},{"noteOn":{"time":69.750,"note":43,"velocity":127}},{"noteOn":{"time":73.000,"note":36,"velocity":127}},{"noteOn":{"time":73.750,"note":38,"velocity":127}},{"noteOn":{"time":77.000,"note":41,"velocity":127}},{"noteOn":{"time":77.750,"note":40,"velocity":127}},{"noteOn":{"time":81.000,"note":40,"velocity":127}},{"noteOn":{"time":81.750,"note":38,"velocity":127}},{"noteOn":{"time":85.000,"note":36,"velocity":127}},{"noteOn":{"time":85.750,"note":36,"velocity":127}},{"noteOn":{"time":91.000,"note":36,"velocity":127}},{"noteOn":{"time":91.750,"note":36,"velocity":127}},{"noteOn":{"time":97.000,"note":36,"velocity":127}},{"noteOn":{"time":97.750,"note":36,"velocity":127}},{"noteOn":{"time":101.000,"note":36,"velocity":127}},{"noteOn":{"time":101.750,"note":36,"velocity":127}},{"noteOn":{"time":105.000,"note":36,"velocity":127}},{"noteOn":{"time":105.750,"note":36,"velocity":127}},{"noteOn":{"time":107.000,"note":36,"velocity":127}},{"noteOn":{"time":107.750,"note":36,"velocity":127}},{"noteOn":{"time":109.000,"note":36,"velocity":127}},{"noteOn":{"time":109.125,"note":43,"velocity":127}},{"noteOn":{"time":109.750,"note":36,"velocity":127}},{"noteOn":{"time":109.875,"note":43,"velocity":127}},{"noteOn":{"time":111.000,"note":36,"velocity":127}},{"noteOn":{"time":111.125,"note":43,"velocity":127}},{"noteOn":{"time":111.750,"note":36,"velocity":127}},{"noteOn":{"time":111.875,"note":43,"velocity":127}},{"noteOn":{"time":113.000,"note":36,"velocity":127}},{"noteOn":{"time":113.125,"note":43,"velocity":127}},{"noteOn":{"time":113.250,"note":48,"velocity":127}},{"noteOn":{"time":113.750,"note":36,"velocity":127}},{"noteOn":{"time":113.875,"note":43,"velocity":127}},{"noteOn":{"time":114.000,"note":48,"velocity":127}},{"noteOn":{"time":115.000,"note":36,"velocity":127}},{"noteOn":{"time":115.125,"note":43,"velocity":127}},{"noteOn":{"time":115.250,"note":52,"velocity":64}},{"noteOn":{"time":115.750,"note":36,"velocity":127}},{"noteOn":{"time":115.875,"note":43,"velocity":127}},{"noteOn":{"time":116.000,"note":52,"velocity":64}},{"noteOn":{"time":117.000,"note":36,"velocity":127}},{"noteOn":{"time":117.750,"note":38,"velocity":127}},{"noteOn":{"time":119.000,"note":52,"velocity":49}},{"noteOn":{"time":119.750,"note":53,"velocity":49}},{"noteOn":{"time":121.000,"note":41,"velocity":127}},{"noteOn":{"time":121.750,"note":40,"velocity":127}},{"noteOn":{"time":123.000,"note":57,"velocity":49}},{"noteOn":{"time":123.750,"note":55,"velocity":49}},{"noteOn":{"time":125.000,"note":36,"velocity":127}},{"noteOn":{"time":125.750,"note":38,"velocity":127}},{"noteOn":{"time":127.000,"note":52,"velocity":49}},{"noteOn":{"time":127.750,"note":53,"velocity":49}},{"noteOn":{"time":129.000,"note":41,"velocity":127}},{"noteOn":{"time":129.750,"note":43,"velocity":127}},{"noteOn":{"time":131.000,"note":57,"velocity":49}},{"noteOn":{"time":131.750,"note":59,"velocity":49}},{"noteOn":{"time":133.000,"note":36,"velocity":127}},{"noteOn":{"time":133.750,"note":38,"velocity":127}},{"noteOn":{"time":135.000,"note":52,"velocity":49}},{"noteOn":{"time":135.750,"note":53,"velocity":49}},{"noteOn":{"time":137.000,"note":41,"velocity":127}},{"noteOn":{"time":137.750,"note":40,"velocity":127}},{"noteOn":{"time":139.000,"note":57,"velocity":49}},{"noteOn":{"time":139.750,"note":55,"velocity":49}},{"noteOn":{"time":141.000,"note":40,"velocity":127}},{"noteOn":{"time":141.750,"note":38,"velocity":127}},{"noteOn":{"time":143.000,"note":55,"velocity":49}},{"noteOn":{"time":143.750,"note":53,"velocity":49}},{"noteOn":{"time":145.000,"note":36,"velocity":127}},{"noteOn":{"time":145.750,"note":36,"velocity":127}},{"noteOn":{"time":147.000,"note":52,"velocity":49}},{"noteOn":{"time":147.750,"note":52,"velocity":49}},{"noteOn":{"time":149.000,"note":36,"velocity":127}},{"noteOn":{"time":149.000,"note":48,"velocity":56}},{"noteOn":{"time":149.750,"note":38,"velocity":127}},{"noteOn":{"time":149.750,"note":50,"velocity":56}},{"noteOn":{"time":151.000,"note":52,"velocity":43}},{"noteOn":{"time":151.000,"note":40,"velocity":43}},{"noteOn":{"time":151.750,"note":41,"velocity":42}},{"noteOn":{"time":151.750,"note":53,"velocity":43}},{"noteOn":{"time":153.000,"note":41,"velocity":127}},{"noteOn":{"time":153.000,"note":53,"velocity":56}},{"noteOn":{"time":153.750,"note":40,"velocity":127}},{"noteOn":{"time":153.750,"note":52,"velocity":56}},{"noteOn":{"time":155.000,"note":57,"velocity":43}},{"noteOn":{"time":155.000,"note":45,"velocity":43}},{"noteOn":{"time":155.750,"note":55,"velocity":43}},{"noteOn":{"time":155.750,"note":43,"velocity":43}},{"noteOn":{"time":157.000,"note":36,"velocity":127}},{"noteOn":{"time":157.000,"note":48,"velocity":56}},{"noteOn":{"time":157.750,"note":38,"velocity":127}},{"noteOn":{"time":157.750,"note":50,"velocity":56}},{"noteOn":{"time":159.000,"note":52,"velocity":43}},{"noteOn":{"time":159.000,"note":40,"velocity":43}},{"noteOn":{"time":159.750,"note":53,"velocity":43}},{"noteOn":{"time":159.750,"note":41,"velocity":43}},{"noteOn":{"time":161.000,"note":41,"velocity":127}},{"noteOn":{"time":161.000,"note":53,"velocity":56}},{"noteOn":{"time":161.750,"note":43,"velocity":127}},{"noteOn":{"time":161.750,"note":55,"velocity":56}},{"noteOn":{"time":163.000,"note":57,"velocity":43}},{"noteOn":{"time":163.000,"note":45,"velocity":43}},{"noteOn":{"time":163.750,"note":59,"velocity":43}},{"noteOn":{"time":163.750,"note":47,"velocity":43}},{"noteOn":{"time":165.000,"note":36,"velocity":127}},{"noteOn":{"time":165.000,"note":48,"velocity":56}},{"noteOn":{"time":165.750,"note":38,"velocity":127}},{"noteOn":{"time":165.750,"note":50,"velocity":56}},{"noteOn":{"time":167.000,"note":52,"velocity":43}},{"noteOn":{"time":167.000,"note":40,"velocity":43}},{"noteOn":{"time":167.750,"note":53,"velocity":43}},{"noteOn":{"time":167.750,"note":41,"velocity":43}},{"noteOn":{"time":169.000,"note":41,"velocity":127}},{"noteOn":{"time":169.000,"note":53,"velocity":56}},{"noteOn":{"time":169.750,"note":40,"velocity":127}},{"noteOn":{"time":169.750,"note":52,"velocity":56}},{"noteOn":{"time":171.000,"note":57,"velocity":43}},{"noteOn":{"time":171.000,"note":45,"velocity":43}},{"noteOn":{"time":171.750,"note":55,"velocity":43}},{"noteOn":{"time":171.750,"note":43,"velocity":43}},{"noteOn":{"time":173.000,"note":40,"velocity":127}},{"noteOn":{"time":173.000,"note":52,"velocity":56}},{"noteOn":{"time":173.750,"note":38,"velocity":127}},{"noteOn":{"time":173.750,"note":50,"velocity":56}},{"noteOn":{"time":175.000,"note":55,"velocity":43}},{"noteOn":{"time":175.000,"note":43,"velocity":43}},{"noteOn":{"time":175.750,"note":55,"velocity":43}},{"noteOn":{"time":175.750,"note":43,"velocity":43}},{"noteOn":{"time":177.000,"note":36,"velocity":127}},{"noteOn":{"time":177.000,"note":48,"velocity":56}},{"noteOn":{"time":177.750,"note":36,"velocity":127}},{"noteOn":{"time":177.750,"note":48,"velocity":56}},{"noteOn":{"time":179.000,"note":52,"velocity":43}},{"noteOn":{"time":179.000,"note":40,"velocity":43}},{"noteOn":{"time":179.750,"note":52,"velocity":43}},{"noteOn":{"time":179.750,"note":40,"velocity":43}},{"noteOn":{"time":181.000,"note":36,"velocity":127}},{"noteOn":{"time":181.000,"note":48,"velocity":56}},{"noteOn":{"time":181.750,"note":36,"velocity":127}},{"noteOn":{"time":181.750,"note":48,"velocity":56}},{"noteOn":{"time":185.000,"note":36,"velocity":127}},{"noteOn":{"time":185.000,"note":48,"velocity":56}},{"noteOn":{"time":185.750,"note":36,"velocity":127}},{"noteOn":{"time":185.750,"note":48,"velocity":56}},{"noteOn":{"time":189.000,"note":36,"velocity":127}},{"noteOn":{"time":189.750,"note":36,"velocity":127}},{"noteOn":{"time":193.000,"note":36,"velocity":127}}],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","fadeInTime":0.05,"fadeOutTime":0.05,"soundDistanceMin":50,"soundDistanceMax":500},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-39.005,-154.000,486.514]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[191.920,-154.000,346.694]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-99.579,-154.000,-314.826]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[304.204,-154.000,215.101]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[17.346,-154.000,108.983]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[149.602,-154.000,44.919]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-87.346,-154.000,-201.261]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-275.253,-154.000,-15.456]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-185.718,-154.000,46.327]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[43.873,266.000,54.782]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-55.327,230.000,-365.918]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[429.944,326.000,209.088]}},{"noteOn":{"time":10.245,"note":103.000,"xyz":[180.612,326.000,-230.645]}},{"noteOn":{"time":10.800,"note":95.000,"xyz":[-66.788,230.000,-46.294]}},{"noteOn":{"time":11.530,"note":97.000,"xyz":[-119.515,254.000,64.845]}},{"noteOn":{"time":12.440,"note":97.000,"xyz":[136.325,254.000,-275.432]}},{"noteOn":{"time":13.355,"note":95.000,"xyz":[414.747,230.000,-2.534]}},{"noteOn":{"time":14.095,"note":103.000,"xyz":[463.714,326.000,-22.122]}},{"noteOn":{"time":14.665,"note":102.000,"xyz":[394.852,314.000,-268.659]}},{"noteOn":{"time":15.235,"note":96.000,"xyz":[-363.407,242.000,-277.526]}},{"noteOn":{"time":15.275,"note":96.000,"xyz":[-140.352,242.000,-313.094]}},{"noteOn":{"time":15.850,"note":94.000,"xyz":[17.638,218.000,-69.666]}},{"noteOn":{"time":16.060,"note":98.000,"xyz":[-119.126,266.000,318.533]}},{"noteOn":{"time":16.380,"note":102.000,"xyz":[142.814,314.000,-137.781]}},{"noteOn":{"time":17.025,"note":96.000,"xyz":[-183.886,242.000,228.757]}},{"noteOn":{"time":17.320,"note":101.000,"xyz":[-402.736,302.000,243.035]}},{"noteOn":{"time":17.885,"note":94.000,"xyz":[161.823,218.000,5.988]}},{"noteOn":{"time":18.175,"note":95.000,"xyz":[117.209,230.000,215.475]}},{"noteOn":{"time":18.575,"note":104.000,"xyz":[-136.783,338.000,-337.356]}},{"noteOn":{"time":18.910,"note":97.000,"xyz":[46.507,254.000,-50.697]}},{"noteOn":{"time":19.085,"note":102.000,"xyz":[-14.505,314.000,-87.141]}},{"noteOn":{"time":19.730,"note":95.000,"xyz":[20.380,230.000,-419.511]}},{"noteOn":{"time":19.750,"note":96.000,"xyz":[-46.465,242.000,-23.949]}},{"noteOn":{"time":20.325,"note":93.000,"xyz":[341.837,206.000,152.472]}},{"noteOn":{"time":20.590,"note":99.000,"xyz":[-125.971,278.000,148.360]}},{"noteOn":{"time":20.830,"note":103.000,"xyz":[-52.057,326.000,-196.310]}},{"noteOn":{"time":20.970,"note":99.000,"xyz":[-181.235,278.000,316.363]}},{"noteOn":{"time":21.575,"note":95.000,"xyz":[151.368,230.000,50.392]}},{"noteOn":{"time":21.640,"note":97.000,"xyz":[-304.114,254.000,-61.804]}},{"noteOn":{"time":21.750,"note":101.000,"xyz":[430.793,302.000,-164.852]}},{"noteOn":{"time":22.205,"note":103.000,"xyz":[215.583,326.000,-154.982]}},{"noteOn":{"time":22.385,"note":93.000,"xyz":[127.262,206.000,139.887]}},{"noteOn":{"time":22.585,"note":96.000,"xyz":[349.395,242.000,-145.312]}},{"noteOn":{"time":22.910,"note":105.000,"xyz":[376.354,350.000,-224.388]}},{"noteOn":{"time":23.015,"note":103.000,"xyz":[111.721,326.000,148.217]}},{"noteOn":{"time":23.340,"note":98.000,"xyz":[125.431,266.000,-55.767]}},{"noteOn":{"time":23.445,"note":95.000,"xyz":[-214.330,230.000,405.641]}},{"noteOn":{"time":23.560,"note":101.000,"xyz":[-354.009,302.000,151.689]}},{"noteOn":{"time":24.175,"note":97.000,"xyz":[341.278,254.000,-236.487]}},{"noteOn":{"time":24.185,"note":94.000,"xyz":[-121.479,218.000,-61.882]}},{"noteOn":{"time":24.280,"note":97.000,"xyz":[-63.246,254.000,282.642]}},{"noteOn":{"time":24.680,"note":99.000,"xyz":[185.892,278.000,45.755]}},{"noteOn":{"time":24.755,"note":92.000,"xyz":[220.323,194.000,359.805]}},{"noteOn":{"time":25.175,"note":99.000,"xyz":[130.462,278.000,151.886]}},{"noteOn":{"time":25.270,"note":102.000,"xyz":[22.939,314.000,64.284]}},{"noteOn":{"time":25.440,"note":97.000,"xyz":[-59.792,254.000,-285.026]}},{"noteOn":{"time":25.965,"note":104.000,"xyz":[138.094,338.000,-7.612]}},{"noteOn":{"time":26.105,"note":94.000,"xyz":[-319.210,218.000,-166.847]}},{"noteOn":{"time":26.170,"note":100.000,"xyz":[71.616,290.000,-58.393]}},{"noteOn":{"time":26.755,"note":104.000,"xyz":[-32.729,338.000,-142.972]}},{"noteOn":{"time":26.860,"note":92.000,"xyz":[-268.023,194.000,67.962]}},{"noteOn":{"time":26.980,"note":96.000,"xyz":[-371.705,242.000,99.972]}},{"noteOn":{"time":27.310,"note":96.000,"xyz":[37.789,242.000,145.230]}},{"noteOn":{"time":27.435,"note":102.000,"xyz":[-29.298,314.000,158.486]}},{"noteOn":{"time":27.760,"note":98.000,"xyz":[167.966,266.000,180.924]}},{"noteOn":{"time":28.005,"note":94.000,"xyz":[-120.553,218.000,73.628]}},{"noteOn":{"time":28.035,"note":100.000,"xyz":[-263.575,290.000,4.425]}},{"noteOn":{"time":28.125,"note":98.000,"xyz":[264.575,266.000,-412.472]}},{"noteOn":{"time":28.625,"note":93.000,"xyz":[323.664,206.000,74.812]}},{"noteOn":{"time":28.710,"note":98.000,"xyz":[320.531,266.000,-81.160]}},{"noteOn":{"time":28.750,"note":92.000,"xyz":[464.972,194.000,63.605]}},{"noteOn":{"time":28.810,"note":98.000,"xyz":[-119.386,266.000,-101.120]}},{"noteOn":{"time":29.175,"note":91.000,"xyz":[-270.951,182.000,262.619]}},{"noteOn":{"time":29.510,"note":102.000,"xyz":[-32.280,314.000,118.016]}},{"noteOn":{"time":29.555,"note":96.000,"xyz":[101.572,242.000,-312.779]}},{"noteOn":{"time":29.710,"note":101.000,"xyz":[17.214,302.000,-161.555]}},{"noteOn":{"time":29.760,"note":100.000,"xyz":[189.657,290.000,373.524]}},{"noteOn":{"time":30.170,"note":104.000,"xyz":[-153.208,338.000,353.768]}},{"noteOn":{"time":30.250,"note":100.000,"xyz":[-115.489,290.000,-132.859]}},{"noteOn":{"time":30.585,"note":99.000,"xyz":[226.601,278.000,44.492]}},{"noteOn":{"time":30.635,"note":94.000,"xyz":[17.520,218.000,-173.142]}},{"noteOn":{"time":31.015,"note":95.000,"xyz":[152.237,230.000,-33.540]}},{"noteOn":{"time":31.045,"note":103.000,"xyz":[222.780,326.000,-183.267]}},{"noteOn":{"time":31.335,"note":92.000,"xyz":[85.994,194.000,-241.186]}},{"noteOn":{"time":31.375,"note":97.000,"xyz":[-246.134,254.000,-53.265]}},{"noteOn":{"time":31.685,"note":97.000,"xyz":[355.308,254.000,-318.241]}},{"noteOn":{"time":31.750,"note":97.000,"xyz":[-67.517,254.000,-96.779]}},{"noteOn":{"time":31.855,"note":101.000,"xyz":[31.161,302.000,91.569]}},{"noteOn":{"time":32.175,"note":99.000,"xyz":[9.857,278.000,92.918]}},{"noteOn":{"time":32.510,"note":99.000,"xyz":[-13.446,278.000,-80.284]}},{"noteOn":{"time":32.515,"note":93.000,"xyz":[81.184,206.000,334.703]}},{"noteOn":{"time":32.590,"note":99.000,"xyz":[128.996,278.000,165.026]}},{"noteOn":{"time":33.060,"note":93.000,"xyz":[44.821,206.000,279.648]}},{"noteOn":{"time":33.250,"note":91.000,"xyz":[-104.434,182.000,94.240]}},{"noteOn":{"time":33.260,"note":97.000,"xyz":[-331.603,254.000,188.346]}},{"noteOn":{"time":33.340,"note":99.000,"xyz":[288.590,278.000,47.601]}},{"noteOn":{"time":33.590,"note":92.000,"xyz":[-206.657,194.000,278.649]}},{"noteOn":{"time":34.020,"note":101.000,"xyz":[458.520,302.000,-158.405]}},{"noteOn":{"time":34.040,"note":101.000,"xyz":[377.167,302.000,-146.946]}},{"noteOn":{"time":34.150,"note":100.000,"xyz":[-15.757,290.000,68.687]}},{"noteOn":{"time":34.195,"note":95.000,"xyz":[351.043,230.000,246.972]}},{"noteOn":{"time":34.335,"note":101.000,"xyz":[-264.399,302.000,-352.403]}},{"noteOn":{"time":34.730,"note":99.000,"xyz":[-383.142,278.000,-297.590]}},{"noteOn":{"time":34.745,"note":99.000,"xyz":[-98.745,278.000,218.007]}},{"noteOn":{"time":34.895,"note":105.000,"xyz":[-444.284,350.000,89.673]}},{"noteOn":{"time":35.005,"note":98.000,"xyz":[-15.423,266.000,-251.714]}},{"noteOn":{"time":35.155,"note":93.000,"xyz":[-40.555,206.000,-413.852]}},{"noteOn":{"time":35.520,"note":95.000,"xyz":[441.347,230.000,-105.354]}},{"noteOn":{"time":35.560,"note":103.000,"xyz":[-27.663,326.000,80.779]}},{"noteOn":{"time":35.770,"note":98.000,"xyz":[-63.904,266.000,17.884]}},{"noteOn":{"time":35.800,"note":93.000,"xyz":[120.075,206.000,92.229]}},{"noteOn":{"time":35.860,"note":103.000,"xyz":[139.555,326.000,-349.886]}},{"noteOn":{"time":36.245,"note":98.000,"xyz":[328.504,266.000,-357.367]}},{"noteOn":{"time":36.330,"note":101.000,"xyz":[168.269,302.000,105.760]}},{"noteOn":{"time":36.540,"note":105.000,"xyz":[6.381,350.000,-115.647]}},{"noteOn":{"time":36.590,"note":97.000,"xyz":[-108.768,254.000,-340.848]}},{"noteOn":{"time":36.590,"note":100.000,"xyz":[-77.392,290.000,49.324]}},{"noteOn":{"time":37.025,"note":92.000,"xyz":[18.531,194.000,-257.642]}},{"noteOn":{"time":37.040,"note":98.000,"xyz":[-288.975,266.000,139.216]}},{"noteOn":{"time":37.415,"note":95.000,"xyz":[-58.603,230.000,-118.365]}},{"noteOn":{"time":37.495,"note":92.000,"xyz":[-172.450,194.000,-110.626]}},{"noteOn":{"time":37.585,"note":100.000,"xyz":[-182.411,290.000,-18.583]}},{"noteOn":{"time":37.745,"note":90.000,"xyz":[58.259,170.000,-33.117]}},{"noteOn":{"time":37.925,"note":100.000,"xyz":[190.217,290.000,-265.345]}},{"noteOn":{"time":38.005,"note":92.000,"xyz":[-437.362,194.000,-230.162]}},{"noteOn":{"time":38.145,"note":97.000,"xyz":[-132.506,254.000,-105.690]}},{"noteOn":{"time":38.340,"note":96.000,"xyz":[-105.399,242.000,30.312]}},{"noteOn":{"time":38.525,"note":100.000,"xyz":[-96.049,290.000,80.595]}},{"noteOn":{"time":38.585,"note":100.000,"xyz":[121.483,290.000,-111.771]}},{"noteOn":{"time":38.725,"note":101.000,"xyz":[320.339,302.000,339.908]}},{"noteOn":{"time":38.865,"note":102.000,"xyz":[268.817,314.000,140.411]}},{"noteOn":{"time":39.245,"note":98.000,"xyz":[365.719,266.000,-262.496]}},{"noteOn":{"time":39.290,"note":98.000,"xyz":[-113.070,266.000,410.482]}},{"noteOn":{"time":39.320,"note":94.000,"xyz":[-131.629,218.000,-410.746]}},{"noteOn":{"time":39.420,"note":97.000,"xyz":[126.210,254.000,180.053]}},{"noteOn":{"time":39.630,"note":92.000,"xyz":[57.381,194.000,-305.791]}},{"noteOn":{"time":40.005,"note":104.000,"xyz":[-183.382,338.000,364.922]}},{"noteOn":{"time":40.030,"note":96.000,"xyz":[245.858,242.000,162.502]}},{"noteOn":{"time":40.110,"note":104.000,"xyz":[-27.201,338.000,47.185]}},{"noteOn":{"time":40.165,"note":99.000,"xyz":[47.085,278.000,-222.134]}},{"noteOn":{"time":40.220,"note":94.000,"xyz":[406.559,218.000,274.601]}},{"noteOn":{"time":40.310,"note":92.000,"xyz":[-179.084,194.000,-443.073]}},{"noteOn":{"time":40.740,"note":98.000,"xyz":[-191.591,266.000,-311.218]}},{"noteOn":{"time":40.810,"note":100.000,"xyz":[-269.304,290.000,-323.281]}},{"noteOn":{"time":40.865,"note":106.000,"xyz":[327.641,362.000,-175.677]}},{"noteOn":{"time":41.010,"note":101.000,"xyz":[-31.656,302.000,98.914]}},{"noteOn":{"time":41.055,"note":102.000,"xyz":[22.864,314.000,-56.764]}},{"noteOn":{"time":41.210,"note":90.000,"xyz":[98.030,170.000,198.332]}},{"noteOn":{"time":41.530,"note":92.000,"xyz":[24.793,194.000,237.450]}},{"noteOn":{"time":41.570,"note":98.000,"xyz":[161.073,266.000,-42.088]}},{"noteOn":{"time":41.720,"note":100.000,"xyz":[357.023,290.000,-293.961]}},{"noteOn":{"time":41.860,"note":96.000,"xyz":[176.177,242.000,-350.067]}},{"noteOn":{"time":41.875,"note":98.000,"xyz":[-175.031,266.000,247.739]}},{"noteOn":{"time":41.935,"note":91.000,"xyz":[-145.705,182.000,57.232]}},{"noteOn":{"time":42.240,"note":91.000,"xyz":[261.301,182.000,368.915]}},{"noteOn":{"time":42.300,"note":98.000,"xyz":[250.794,266.000,-21.610]}},{"noteOn":{"time":42.450,"note":93.000,"xyz":[-153.556,206.000,-69.222]}},{"noteOn":{"time":42.510,"note":100.000,"xyz":[92.616,290.000,361.731]}},{"noteOn":{"time":42.710,"note":98.000,"xyz":[-387.123,266.000,209.256]}},{"noteOn":{"time":42.795,"note":100.000,"xyz":[-18.197,290.000,248.123]}},{"noteOn":{"time":43.035,"note":99.000,"xyz":[-45.431,278.000,49.622]}},{"noteOn":{"time":43.055,"note":99.000,"xyz":[129.294,278.000,-15.787]}},{"noteOn":{"time":43.130,"note":94.000,"xyz":[266.811,218.000,313.451]}},{"noteOn":{"time":43.395,"note":103.000,"xyz":[12.409,326.000,-48.700]}},{"noteOn":{"time":43.410,"note":100.000,"xyz":[-229.282,290.000,-4.992]}},{"noteOn":{"time":43.640,"note":95.000,"xyz":[303.484,230.000,-42.860]}},{"noteOn":{"time":43.740,"note":97.000,"xyz":[-120.471,254.000,56.319]}},{"noteOn":{"time":43.865,"note":97.000,"xyz":[442.045,254.000,-223.288]}},{"noteOn":{"time":43.870,"note":97.000,"xyz":[225.790,254.000,163.980]}},{"noteOn":{"time":43.965,"note":98.000,"xyz":[-162.520,266.000,69.025]}},{"noteOn":{"time":44.110,"note":93.000,"xyz":[359.310,206.000,-96.856]}},{"noteOn":{"time":44.530,"note":93.000,"xyz":[-105.967,206.000,-150.528]}},{"noteOn":{"time":44.540,"note":97.000,"xyz":[166.726,254.000,52.335]}},{"noteOn":{"time":44.560,"note":105.000,"xyz":[45.041,350.000,134.685]}},{"noteOn":{"time":44.590,"note":100.000,"xyz":[-21.877,290.000,-211.721]}},{"noteOn":{"time":44.645,"note":95.000,"xyz":[20.113,230.000,-87.461]}},{"noteOn":{"time":44.725,"note":91.000,"xyz":[-82.192,182.000,-420.320]}},{"noteOn":{"time":45.240,"note":99.000,"xyz":[261.495,278.000,-120.569]}},{"noteOn":{"time":45.285,"note":99.000,"xyz":[-95.243,278.000,-228.278]}},{"noteOn":{"time":45.295,"note":105.000,"xyz":[103.211,350.000,-0.105]}},{"noteOn":{"time":45.410,"note":103.000,"xyz":[449.809,326.000,-141.049]}},{"noteOn":{"time":45.455,"note":102.000,"xyz":[-229.018,314.000,-307.691]}},{"noteOn":{"time":45.670,"note":89.000,"xyz":[198.723,158.000,-243.161]}},{"noteOn":{"time":46.045,"note":91.000,"xyz":[-97.151,182.000,190.999]}},{"noteOn":{"time":46.105,"note":97.000,"xyz":[-321.903,254.000,-369.298]}},{"noteOn":{"time":46.180,"note":97.000,"xyz":[175.990,254.000,-67.414]}},{"noteOn":{"time":46.205,"note":99.000,"xyz":[205.636,278.000,-138.895]}},{"noteOn":{"time":46.270,"note":101.000,"xyz":[-72.394,302.000,-18.415]}},{"noteOn":{"time":46.405,"note":92.000,"xyz":[-142.844,194.000,-164.768]}},{"noteOn":{"time":46.425,"note":103.000,"xyz":[-0.834,326.000,-188.102]}},{"noteOn":{"time":46.740,"note":91.000,"xyz":[297.365,182.000,15.645]}},{"noteOn":{"time":46.830,"note":97.000,"xyz":[242.140,254.000,-195.355]}},{"noteOn":{"time":46.940,"note":94.000,"xyz":[202.653,218.000,-240.962]}},{"noteOn":{"time":47.095,"note":101.000,"xyz":[-163.599,302.000,-326.966]}},{"noteOn":{"time":47.150,"note":99.000,"xyz":[268.606,278.000,-50.608]}},{"noteOn":{"time":47.175,"note":99.000,"xyz":[160.937,278.000,243.954]}},{"noteOn":{"time":47.380,"note":101.000,"xyz":[441.405,302.000,-6.129]}},{"noteOn":{"time":47.545,"note":98.000,"xyz":[-36.144,266.000,-91.993]}},{"noteOn":{"time":47.565,"note":98.000,"xyz":[-51.157,266.000,411.493]}},{"noteOn":{"time":47.615,"note":95.000,"xyz":[-80.748,230.000,296.104]}},{"noteOn":{"time":47.930,"note":103.000,"xyz":[67.504,326.000,357.451]}},{"noteOn":{"time":47.975,"note":99.000,"xyz":[262.611,278.000,-97.492]}},{"noteOn":{"time":47.985,"note":103.000,"xyz":[26.115,326.000,-71.569]}},{"noteOn":{"time":48.005,"note":101.000,"xyz":[-221.906,302.000,-132.962]}},{"noteOn":{"time":48.240,"note":96.000,"xyz":[48.953,242.000,117.563]}},{"noteOn":{"time":48.310,"note":97.000,"xyz":[51.190,254.000,180.430]}},{"noteOn":{"time":48.355,"note":96.000,"xyz":[274.593,242.000,281.140]}},{"noteOn":{"time":48.585,"note":94.000,"xyz":[328.364,218.000,-197.342]}},{"noteOn":{"time":48.645,"note":105.000,"xyz":[-35.027,350.000,36.083]}},{"noteOn":{"time":48.650,"note":97.000,"xyz":[90.103,254.000,-88.627]}},{"noteOn":{"time":48.940,"note":95.000,"xyz":[-19.265,230.000,157.829]}},{"noteOn":{"time":49.050,"note":98.000,"xyz":[102.070,266.000,115.345]}},{"noteOn":{"time":49.060,"note":100.000,"xyz":[-355.021,290.000,-344.891]}},{"noteOn":{"time":49.105,"note":96.000,"xyz":[221.820,242.000,-274.127]}},{"noteOn":{"time":49.185,"note":105.000,"xyz":[98.913,350.000,310.076]}},{"noteOn":{"time":49.205,"note":91.000,"xyz":[-360.367,182.000,-52.644]}},{"noteOn":{"time":49.430,"note":95.000,"xyz":[-47.663,230.000,-52.375]}},{"noteOn":{"time":49.740,"note":100.000,"xyz":[226.942,290.000,108.039]}},{"noteOn":{"time":49.745,"note":93.000,"xyz":[-257.712,206.000,-353.751]}},{"noteOn":{"time":49.800,"note":105.000,"xyz":[-55.636,350.000,427.451]}},{"noteOn":{"time":49.805,"note":98.000,"xyz":[-103.048,266.000,-385.765]}},{"noteOn":{"time":49.945,"note":102.000,"xyz":[8.995,314.000,67.432]}},{"noteOn":{"time":50.155,"note":98.000,"xyz":[450.494,266.000,123.351]}},{"noteOn":{"time":50.195,"note":90.000,"xyz":[-368.783,170.000,-72.393]}},{"noteOn":{"time":50.555,"note":90.000,"xyz":[137.614,170.000,-120.226]}},{"noteOn":{"time":50.565,"note":98.000,"xyz":[-21.226,266.000,-301.891]}},{"noteOn":{"time":50.675,"note":96.000,"xyz":[374.184,242.000,-235.772]}},{"noteOn":{"time":50.710,"note":102.000,"xyz":[-4.491,314.000,324.620]}},{"noteOn":{"time":50.775,"note":98.000,"xyz":[-6.665,266.000,-168.144]}},{"noteOn":{"time":50.915,"note":93.000,"xyz":[-359.939,206.000,42.926]}},{"noteOn":{"time":50.990,"note":102.000,"xyz":[-203.882,314.000,243.076]}},{"noteOn":{"time":51.240,"note":92.000,"xyz":[-99.887,194.000,396.924]}},{"noteOn":{"time":51.450,"note":96.000,"xyz":[405.639,242.000,-52.531]}},{"noteOn":{"time":51.475,"note":95.000,"xyz":[361.579,230.000,-328.211]}},{"noteOn":{"time":51.475,"note":100.000,"xyz":[0.465,290.000,-58.826]}},{"noteOn":{"time":51.480,"note":100.000,"xyz":[177.688,290.000,76.459]}},{"noteOn":{"time":51.630,"note":102.000,"xyz":[-233.759,314.000,282.883]}},{"noteOn":{"time":51.825,"note":90.000,"xyz":[-137.281,170.000,164.728]}},{"noteOn":{"time":51.880,"note":100.000,"xyz":[-189.058,290.000,263.641]}},{"noteOn":{"time":52.060,"note":98.000,"xyz":[-291.364,266.000,4.231]}},{"noteOn":{"time":52.120,"note":97.000,"xyz":[77.966,254.000,167.862]}},{"noteOn":{"time":52.190,"note":96.000,"xyz":[16.770,242.000,133.508]}},{"noteOn":{"time":52.370,"note":88.000,"xyz":[13.550,146.000,-135.494]}},{"noteOn":{"time":52.410,"note":104.000,"xyz":[-227.553,338.000,138.877]}},{"noteOn":{"time":52.420,"note":98.000,"xyz":[45.326,266.000,83.153]}},{"noteOn":{"time":52.430,"note":104.000,"xyz":[-189.539,338.000,269.327]}},{"noteOn":{"time":52.475,"note":100.000,"xyz":[101.229,290.000,-84.001]}},{"noteOn":{"time":52.740,"note":96.000,"xyz":[-52.765,242.000,4.399]}},{"noteOn":{"time":52.835,"note":98.000,"xyz":[-29.472,266.000,285.797]}},{"noteOn":{"time":52.890,"note":95.000,"xyz":[-80.564,230.000,227.980]}},{"noteOn":{"time":52.935,"note":106.000,"xyz":[126.609,362.000,-265.327]}},{"noteOn":{"time":53.010,"note":94.000,"xyz":[-6.820,218.000,-59.403]}},{"noteOn":{"time":53.090,"note":98.000,"xyz":[-71.514,266.000,215.474]}},{"noteOn":{"time":53.215,"note":96.000,"xyz":[56.931,242.000,-18.225]}},{"noteOn":{"time":53.220,"note":102.000,"xyz":[-441.225,314.000,-224.144]}},{"noteOn":{"time":53.560,"note":99.000,"xyz":[329.061,278.000,-321.966]}},{"noteOn":{"time":53.570,"note":101.000,"xyz":[-8.175,302.000,-234.238]}},{"noteOn":{"time":53.585,"note":96.000,"xyz":[0.947,242.000,259.159]}},{"noteOn":{"time":53.780,"note":90.000,"xyz":[-10.451,170.000,449.876]}},{"noteOn":{"time":53.870,"note":106.000,"xyz":[-260.965,362.000,-61.024]}},{"noteOn":{"time":53.875,"note":96.000,"xyz":[312.198,242.000,77.218]}},{"noteOn":{"time":53.995,"note":96.000,"xyz":[116.875,242.000,108.909]}},{"noteOn":{"time":54.195,"note":94.000,"xyz":[-136.142,218.000,-480.976]}},{"noteOn":{"time":54.240,"note":101.000,"xyz":[117.817,302.000,-32.457]}},{"noteOn":{"time":54.335,"note":97.000,"xyz":[81.797,254.000,-466.676]}},{"noteOn":{"time":54.375,"note":104.000,"xyz":[-25.317,338.000,-153.761]}},{"noteOn":{"time":54.475,"note":103.000,"xyz":[-43.274,326.000,98.173]}},{"noteOn":{"time":54.745,"note":90.000,"xyz":[230.488,170.000,255.423]}},{"noteOn":{"time":54.755,"note":98.000,"xyz":[-102.381,266.000,-128.922]}},{"noteOn":{"time":54.910,"note":94.000,"xyz":[349.141,218.000,51.991]}},{"noteOn":{"time":54.915,"note":94.000,"xyz":[110.467,218.000,277.311]}},{"noteOn":{"time":55.015,"note":98.000,"xyz":[-121.724,266.000,-361.390]}},{"noteOn":{"time":55.065,"note":91.000,"xyz":[-36.197,182.000,46.693]}},{"noteOn":{"time":55.265,"note":95.000,"xyz":[319.517,230.000,3.151]}},{"noteOn":{"time":55.370,"note":97.000,"xyz":[-175.391,254.000,-232.871]}},{"noteOn":{"time":55.435,"note":102.000,"xyz":[21.127,314.000,-374.245]}},{"noteOn":{"time":55.470,"note":93.000,"xyz":[298.043,206.000,-303.685]}},{"noteOn":{"time":55.655,"note":96.000,"xyz":[12.022,242.000,151.292]}},{"noteOn":{"time":55.735,"note":93.000,"xyz":[318.619,206.000,200.485]}},{"noteOn":{"time":55.805,"note":101.000,"xyz":[238.400,302.000,-389.825]}},{"noteOn":{"time":55.860,"note":102.000,"xyz":[-92.041,314.000,410.136]}},{"noteOn":{"time":56.050,"note":96.000,"xyz":[-0.417,242.000,-173.953]}},{"noteOn":{"time":56.090,"note":95.000,"xyz":[-188.871,230.000,-143.915]}},{"noteOn":{"time":56.165,"note":103.000,"xyz":[61.997,326.000,-94.004]}},{"noteOn":{"time":56.170,"note":99.000,"xyz":[-212.028,278.000,-106.741]}},{"noteOn":{"time":56.215,"note":89.000,"xyz":[-204.689,158.000,10.623]}},{"noteOn":{"time":56.545,"note":99.000,"xyz":[-125.258,278.000,-153.172]}},{"noteOn":{"time":56.565,"note":97.000,"xyz":[-72.777,254.000,112.285]}},{"noteOn":{"time":56.715,"note":96.000,"xyz":[64.318,242.000,-264.679]}},{"noteOn":{"time":56.740,"note":97.000,"xyz":[-422.607,254.000,58.565]}},{"noteOn":{"time":56.785,"note":97.000,"xyz":[-208.159,254.000,296.685]}},{"noteOn":{"time":56.835,"note":89.000,"xyz":[432.529,158.000,243.652]}},{"noteOn":{"time":56.880,"note":105.000,"xyz":[217.069,350.000,-83.946]}},{"noteOn":{"time":56.885,"note":103.000,"xyz":[-116.847,326.000,-208.495]}},{"noteOn":{"time":57.235,"note":95.000,"xyz":[431.955,230.000,-25.897]}},{"noteOn":{"time":57.385,"note":99.000,"xyz":[-308.029,278.000,-18.860]}},{"noteOn":{"time":57.435,"note":95.000,"xyz":[318.320,230.000,276.116]}},{"noteOn":{"time":57.465,"note":94.000,"xyz":[212.741,218.000,-159.850]}},{"noteOn":{"time":57.465,"note":101.000,"xyz":[-77.647,302.000,-61.046]}},{"noteOn":{"time":57.530,"note":107.000,"xyz":[98.227,374.000,30.194]}},{"noteOn":{"time":57.635,"note":97.000,"xyz":[357.471,254.000,-153.734]}},{"noteOn":{"time":57.660,"note":95.000,"xyz":[186.580,230.000,-79.990]}},{"noteOn":{"time":58.065,"note":97.000,"xyz":[-153.130,254.000,-189.674]}},{"noteOn":{"time":58.070,"note":99.000,"xyz":[-361.975,278.000,231.712]}},{"noteOn":{"time":58.125,"note":103.000,"xyz":[-42.558,326.000,76.998]}},{"noteOn":{"time":58.125,"note":102.000,"xyz":[-250.409,314.000,268.255]}},{"noteOn":{"time":58.375,"note":89.000,"xyz":[-90.048,158.000,-185.758]}},{"noteOn":{"time":58.435,"note":105.000,"xyz":[-351.400,350.000,-334.154]}},{"noteOn":{"time":58.440,"note":97.000,"xyz":[-414.704,254.000,-112.823]}},{"noteOn":{"time":58.615,"note":95.000,"xyz":[-407.070,230.000,130.214]}},{"noteOn":{"time":58.735,"note":102.000,"xyz":[131.972,314.000,83.690]}},{"noteOn":{"time":58.870,"note":97.000,"xyz":[110.787,254.000,-31.905]}},{"noteOn":{"time":59.015,"note":93.000,"xyz":[23.874,206.000,218.128]}},{"noteOn":{"time":59.055,"note":102.000,"xyz":[119.777,314.000,-162.596]}},{"noteOn":{"time":59.060,"note":103.000,"xyz":[54.703,326.000,-77.336]}},{"noteOn":{"time":59.295,"note":91.000,"xyz":[18.699,182.000,146.578]}},{"noteOn":{"time":59.405,"note":99.000,"xyz":[-370.489,278.000,-253.496]}},{"noteOn":{"time":59.455,"note":95.000,"xyz":[209.431,230.000,45.110]}},{"noteOn":{"time":59.570,"note":92.000,"xyz":[-329.685,194.000,-117.621]}},{"noteOn":{"time":59.585,"note":99.000,"xyz":[385.402,278.000,-200.829]}},{"noteOn":{"time":59.640,"note":95.000,"xyz":[332.710,230.000,327.703]}},{"noteOn":{"time":59.855,"note":94.000,"xyz":[99.063,218.000,-362.818]}},{"noteOn":{"time":59.870,"note":105.000,"xyz":[-64.122,350.000,128.390]}},{"noteOn":{"time":59.930,"note":101.000,"xyz":[-342.626,302.000,141.684]}},{"noteOn":{"time":59.965,"note":97.000,"xyz":[9.582,254.000,106.715]}},{"noteOn":{"time":60.040,"note":94.000,"xyz":[-57.919,218.000,-77.398]}},{"noteOn":{"time":60.115,"note":97.000,"xyz":[340.108,254.000,79.111]}},{"noteOn":{"time":60.235,"note":94.000,"xyz":[-309.016,218.000,117.111]}},{"noteOn":{"time":60.250,"note":101.000,"xyz":[-42.554,302.000,199.680]}},{"noteOn":{"time":60.470,"note":103.000,"xyz":[158.846,326.000,149.350]}},{"noteOn":{"time":60.505,"note":101.000,"xyz":[221.199,302.000,-80.968]}},{"noteOn":{"time":60.510,"note":99.000,"xyz":[273.869,278.000,228.560]}},{"noteOn":{"time":60.635,"note":89.000,"xyz":[12.053,158.000,-250.932]}},{"noteOn":{"time":60.640,"note":96.000,"xyz":[40.352,242.000,381.842]}},{"noteOn":{"time":60.695,"note":104.000,"xyz":[278.984,338.000,-156.406]}},{"noteOn":{"time":60.730,"note":95.000,"xyz":[-58.288,230.000,-67.177]}},{"noteOn":{"time":61.065,"note":97.000,"xyz":[-370.137,254.000,-150.788]}},{"noteOn":{"time":61.075,"note":96.000,"xyz":[-251.299,242.000,-165.305]}},{"noteOn":{"time":61.100,"note":99.000,"xyz":[249.249,278.000,388.097]}},{"noteOn":{"time":61.330,"note":96.000,"xyz":[-25.670,242.000,-80.703]}},{"noteOn":{"time":61.335,"note":89.000,"xyz":[-84.611,158.000,335.300]}},{"noteOn":{"time":61.340,"note":103.000,"xyz":[-193.803,326.000,67.631]}},{"noteOn":{"time":61.365,"note":102.000,"xyz":[-385.045,314.000,-151.828]}},{"noteOn":{"time":61.370,"note":105.000,"xyz":[-224.680,350.000,-190.311]}},{"noteOn":{"time":61.375,"note":98.000,"xyz":[-223.945,266.000,161.939]}},{"noteOn":{"time":61.730,"note":94.000,"xyz":[111.952,218.000,-45.180]}},{"noteOn":{"time":61.875,"note":96.000,"xyz":[209.924,242.000,-450.297]}},{"noteOn":{"time":61.935,"note":101.000,"xyz":[49.649,302.000,99.803]}},{"noteOn":{"time":61.935,"note":100.000,"xyz":[-63.108,290.000,-45.932]}},{"noteOn":{"time":62.000,"note":105.000,"xyz":[22.282,350.000,-79.366]}},{"noteOn":{"time":62.025,"note":94.000,"xyz":[234.605,218.000,-22.669]}},{"noteOn":{"time":62.055,"note":93.000,"xyz":[-26.943,206.000,-185.267]}},{"noteOn":{"time":62.175,"note":106.000,"xyz":[107.233,362.000,-204.621]}},{"noteOn":{"time":62.215,"note":96.000,"xyz":[-274.436,242.000,28.492]}},{"noteOn":{"time":62.500,"note":104.000,"xyz":[-17.761,338.000,458.519]}},{"noteOn":{"time":62.560,"note":98.000,"xyz":[-363.307,266.000,98.772]}},{"noteOn":{"time":62.575,"note":100.000,"xyz":[-79.900,290.000,20.682]}},{"noteOn":{"time":62.695,"note":103.000,"xyz":[419.997,326.000,-148.941]}},{"noteOn":{"time":62.810,"note":96.000,"xyz":[-203.820,242.000,-50.670]}},{"noteOn":{"time":62.905,"note":90.000,"xyz":[245.777,170.000,192.062]}},{"noteOn":{"time":62.920,"note":104.000,"xyz":[-260.517,338.000,128.054]}},{"noteOn":{"time":62.930,"note":98.000,"xyz":[-362.040,266.000,1.733]}},{"noteOn":{"time":63.155,"note":94.000,"xyz":[-123.216,218.000,228.410]}},{"noteOn":{"time":63.230,"note":102.000,"xyz":[-362.687,314.000,336.193]}},{"noteOn":{"time":63.305,"note":94.000,"xyz":[-54.803,218.000,26.963]}},{"noteOn":{"time":63.420,"note":96.000,"xyz":[219.555,242.000,54.875]}},{"noteOn":{"time":63.535,"note":98.000,"xyz":[20.857,266.000,-52.753]}},{"noteOn":{"time":63.645,"note":101.000,"xyz":[-403.559,302.000,135.685]}},{"noteOn":{"time":63.670,"note":102.000,"xyz":[-241.210,314.000,181.463]}},{"noteOn":{"time":63.745,"note":100.000,"xyz":[-121.324,290.000,21.576]}},{"noteOn":{"time":63.780,"note":92.000,"xyz":[-254.173,194.000,-74.246]}},{"noteOn":{"time":63.845,"note":96.000,"xyz":[-228.437,242.000,-132.141]}},{"noteOn":{"time":63.920,"note":96.000,"xyz":[125.781,242.000,75.675]}},{"noteOn":{"time":64.080,"note":92.000,"xyz":[262.773,194.000,-100.011]}},{"noteOn":{"time":64.270,"note":100.000,"xyz":[-182.230,290.000,-440.585]}},{"noteOn":{"time":64.280,"note":104.000,"xyz":[-302.378,338.000,-379.087]}},{"noteOn":{"time":64.375,"note":100.000,"xyz":[-397.257,290.000,-107.712]}},{"noteOn":{"time":64.385,"note":94.000,"xyz":[58.206,218.000,153.080]}},{"noteOn":{"time":64.495,"note":96.000,"xyz":[54.082,242.000,185.252]}},{"noteOn":{"time":64.505,"note":98.000,"xyz":[-199.739,266.000,-57.046]}},{"noteOn":{"time":64.610,"note":95.000,"xyz":[73.383,230.000,144.420]}},{"noteOn":{"time":64.620,"note":100.000,"xyz":[151.679,290.000,-462.283]}},{"noteOn":{"time":64.730,"note":95.000,"xyz":[130.074,230.000,-42.444]}},{"noteOn":{"time":64.815,"note":102.000,"xyz":[-344.936,314.000,207.427]}},{"noteOn":{"time":64.950,"note":98.000,"xyz":[67.080,266.000,-65.616]}},{"noteOn":{"time":65.065,"note":102.000,"xyz":[158.497,314.000,462.098]}},{"noteOn":{"time":65.100,"note":88.000,"xyz":[-467.020,146.000,158.777]}},{"noteOn":{"time":65.130,"note":98.000,"xyz":[-41.227,266.000,-256.351]}},{"noteOn":{"time":65.175,"note":104.000,"xyz":[-406.219,338.000,-254.454]}},{"noteOn":{"time":65.235,"note":97.000,"xyz":[298.857,254.000,-136.136]}},{"noteOn":{"time":65.305,"note":94.000,"xyz":[355.018,218.000,292.487]}},{"noteOn":{"time":65.510,"note":96.000,"xyz":[-265.790,242.000,271.589]}},{"noteOn":{"time":65.585,"note":95.000,"xyz":[-83.840,230.000,372.419]}},{"noteOn":{"time":65.750,"note":104.000,"xyz":[-52.651,338.000,35.182]}},{"noteOn":{"time":65.790,"note":101.000,"xyz":[65.519,302.000,-268.987]}},{"noteOn":{"time":65.875,"note":102.000,"xyz":[-5.892,314.000,-222.821]}},{"noteOn":{"time":65.880,"note":90.000,"xyz":[186.782,170.000,413.665]}},{"noteOn":{"time":65.905,"note":98.000,"xyz":[205.368,266.000,-69.185]}},{"noteOn":{"time":65.935,"note":106.000,"xyz":[-250.107,362.000,15.293]}},{"noteOn":{"time":65.945,"note":95.000,"xyz":[-277.252,230.000,-154.648]}},{"noteOn":{"time":66.230,"note":93.000,"xyz":[25.231,206.000,471.970]}},{"noteOn":{"time":66.350,"note":94.000,"xyz":[-21.439,218.000,337.528]}},{"noteOn":{"time":66.350,"note":97.000,"xyz":[14.186,254.000,314.577]}},{"noteOn":{"time":66.395,"note":104.000,"xyz":[-171.398,338.000,394.623]}},{"noteOn":{"time":66.420,"note":101.000,"xyz":[-131.427,302.000,-162.478]}},{"noteOn":{"time":66.595,"note":106.000,"xyz":[-269.035,362.000,-64.773]}},{"noteOn":{"time":66.650,"note":93.000,"xyz":[110.958,206.000,37.306]}},{"noteOn":{"time":66.835,"note":96.000,"xyz":[159.450,242.000,-265.777]}},{"noteOn":{"time":66.890,"note":106.000,"xyz":[-47.429,362.000,85.392]}},{"noteOn":{"time":67.090,"note":101.000,"xyz":[-150.338,302.000,-424.421]}},{"noteOn":{"time":67.090,"note":99.000,"xyz":[78.012,278.000,-9.124]}},{"noteOn":{"time":67.110,"note":94.000,"xyz":[86.561,218.000,-168.999]}},{"noteOn":{"time":67.220,"note":96.000,"xyz":[-74.027,242.000,-398.273]}},{"noteOn":{"time":67.265,"note":102.000,"xyz":[-270.401,314.000,-336.995]}},{"noteOn":{"time":67.335,"note":103.000,"xyz":[169.317,326.000,-459.224]}},{"noteOn":{"time":67.345,"note":91.000,"xyz":[-398.214,182.000,218.215]}},{"noteOn":{"time":67.490,"note":99.000,"xyz":[-41.884,278.000,-261.898]}},{"noteOn":{"time":67.660,"note":97.000,"xyz":[148.256,254.000,52.158]}},{"noteOn":{"time":67.700,"note":93.000,"xyz":[226.568,206.000,43.103]}},{"noteOn":{"time":67.730,"note":101.000,"xyz":[262.467,302.000,-361.054]}},{"noteOn":{"time":68.010,"note":95.000,"xyz":[8.801,230.000,-60.113]}},{"noteOn":{"time":68.130,"note":98.000,"xyz":[-3.641,266.000,210.013]}},{"noteOn":{"time":68.150,"note":101.000,"xyz":[80.186,302.000,59.617]}},{"noteOn":{"time":68.175,"note":93.000,"xyz":[-287.318,206.000,284.026]}},{"noteOn":{"time":68.205,"note":101.000,"xyz":[-346.330,302.000,173.560]}},{"noteOn":{"time":68.235,"note":100.000,"xyz":[350.920,290.000,-291.501]}},{"noteOn":{"time":68.350,"note":99.000,"xyz":[-7.114,278.000,155.555]}},{"noteOn":{"time":68.385,"note":97.000,"xyz":[28.684,254.000,-179.179]}},{"noteOn":{"time":68.590,"note":93.000,"xyz":[-84.338,206.000,-369.363]}},{"noteOn":{"time":68.690,"note":103.000,"xyz":[-186.623,326.000,109.505]}},{"noteOn":{"time":68.890,"note":99.000,"xyz":[44.027,278.000,-125.850]}},{"noteOn":{"time":68.915,"note":93.000,"xyz":[-292.370,206.000,-41.276]}},{"noteOn":{"time":68.930,"note":97.000,"xyz":[-32.065,254.000,-43.508]}},{"noteOn":{"time":68.930,"note":101.000,"xyz":[376.287,302.000,-304.413]}},{"noteOn":{"time":68.935,"note":95.000,"xyz":[-73.757,230.000,-93.627]}},{"noteOn":{"time":68.935,"note":99.000,"xyz":[-333.821,278.000,155.233]}},{"noteOn":{"time":69.180,"note":96.000,"xyz":[126.792,242.000,-399.607]}},{"noteOn":{"time":69.230,"note":95.000,"xyz":[-392.818,230.000,167.639]}},{"noteOn":{"time":69.505,"note":103.000,"xyz":[48.410,326.000,-437.587]}},{"noteOn":{"time":69.570,"note":89.000,"xyz":[88.417,158.000,-187.020]}},{"noteOn":{"time":69.585,"note":103.000,"xyz":[-175.323,326.000,369.846]}},{"noteOn":{"time":69.650,"note":103.000,"xyz":[-315.756,326.000,-216.856]}},{"noteOn":{"time":69.665,"note":97.000,"xyz":[354.092,254.000,145.627]}},{"noteOn":{"time":69.665,"note":101.000,"xyz":[130.506,302.000,-5.545]}},{"noteOn":{"time":69.785,"note":93.000,"xyz":[58.588,206.000,-19.363]}},{"noteOn":{"time":69.825,"note":98.000,"xyz":[47.355,266.000,-65.651]}},{"noteOn":{"time":70.075,"note":95.000,"xyz":[190.993,230.000,-48.392]}},{"noteOn":{"time":70.095,"note":95.000,"xyz":[160.406,230.000,37.250]}},{"noteOn":{"time":70.170,"note":105.000,"xyz":[66.427,350.000,402.526]}},{"noteOn":{"time":70.195,"note":105.000,"xyz":[-64.712,350.000,329.087]}},{"noteOn":{"time":70.210,"note":101.000,"xyz":[-173.364,302.000,-37.978]}},{"noteOn":{"time":70.245,"note":107.000,"xyz":[-57.248,374.000,186.951]}},{"noteOn":{"time":70.345,"note":99.000,"xyz":[65.779,278.000,-335.888]}},{"noteOn":{"time":70.425,"note":91.000,"xyz":[-458.481,182.000,90.954]}},{"noteOn":{"time":70.495,"note":107.000,"xyz":[-104.873,374.000,-79.563]}},{"noteOn":{"time":70.555,"note":94.000,"xyz":[-154.002,218.000,-161.873]}},{"noteOn":{"time":70.730,"note":92.000,"xyz":[-36.205,194.000,66.651]}},{"noteOn":{"time":70.795,"note":95.000,"xyz":[92.569,230.000,19.692]}},{"noteOn":{"time":70.825,"note":95.000,"xyz":[61.130,230.000,5.789]}},{"noteOn":{"time":70.830,"note":98.000,"xyz":[-297.312,266.000,-15.941]}},{"noteOn":{"time":70.875,"note":101.000,"xyz":[228.472,302.000,258.417]}},{"noteOn":{"time":71.005,"note":105.000,"xyz":[220.122,350.000,115.495]}},{"noteOn":{"time":71.135,"note":107.000,"xyz":[410.235,374.000,-109.832]}},{"noteOn":{"time":71.235,"note":92.000,"xyz":[250.646,194.000,-282.907]}},{"noteOn":{"time":71.380,"note":105.000,"xyz":[-442.251,350.000,-108.373]}},{"noteOn":{"time":71.390,"note":95.000,"xyz":[-258.817,230.000,-254.311]}},{"noteOn":{"time":71.460,"note":97.000,"xyz":[-227.265,254.000,209.699]}},{"noteOn":{"time":71.600,"note":102.000,"xyz":[-111.912,314.000,-228.999]}},{"noteOn":{"time":71.625,"note":100.000,"xyz":[-3.149,290.000,93.607]}},{"noteOn":{"time":71.645,"note":103.000,"xyz":[28.913,326.000,-307.922]}},{"noteOn":{"time":71.660,"note":103.000,"xyz":[-265.418,326.000,174.916]}},{"noteOn":{"time":71.700,"note":97.000,"xyz":[2.990,254.000,-97.528]}},{"noteOn":{"time":71.755,"note":91.000,"xyz":[-156.279,182.000,53.504]}},{"noteOn":{"time":71.835,"note":102.000,"xyz":[-275.907,314.000,142.238]}},{"noteOn":{"time":71.935,"note":99.000,"xyz":[-98.650,278.000,-472.774]}},{"noteOn":{"time":72.060,"note":98.000,"xyz":[109.313,266.000,-482.806]}},{"noteOn":{"time":72.175,"note":93.000,"xyz":[24.705,206.000,147.265]}},{"noteOn":{"time":72.230,"note":100.000,"xyz":[178.724,290.000,333.522]}},{"noteOn":{"time":72.440,"note":101.000,"xyz":[73.404,302.000,-231.747]}},{"noteOn":{"time":72.540,"note":94.000,"xyz":[-242.499,218.000,-391.173]}},{"noteOn":{"time":72.595,"note":94.000,"xyz":[96.434,218.000,-22.895]}},{"noteOn":{"time":72.605,"note":99.000,"xyz":[-287.240,278.000,-227.400]}},{"noteOn":{"time":72.630,"note":106.000,"xyz":[91.375,362.000,46.036]}},{"noteOn":{"time":72.650,"note":101.000,"xyz":[61.282,302.000,-318.322]}},{"noteOn":{"time":72.730,"note":96.000,"xyz":[97.908,242.000,94.707]}},{"noteOn":{"time":72.785,"note":97.000,"xyz":[-128.533,254.000,-327.750]}},{"noteOn":{"time":72.825,"note":100.000,"xyz":[106.697,290.000,17.962]}},{"noteOn":{"time":73.105,"note":94.000,"xyz":[-53.744,218.000,213.607]}},{"noteOn":{"time":73.235,"note":103.000,"xyz":[19.457,326.000,-126.408]}},{"noteOn":{"time":73.295,"note":104.000,"xyz":[19.500,338.000,52.370]}},{"noteOn":{"time":73.345,"note":94.000,"xyz":[336.844,218.000,222.298]}},{"noteOn":{"time":73.355,"note":100.000,"xyz":[-127.424,290.000,-27.164]}},{"noteOn":{"time":73.380,"note":98.000,"xyz":[-64.590,266.000,-327.469]}},{"noteOn":{"time":73.450,"note":92.000,"xyz":[-56.511,194.000,-39.273]}},{"noteOn":{"time":73.495,"note":102.000,"xyz":[294.324,314.000,110.101]}},{"noteOn":{"time":73.525,"note":98.000,"xyz":[59.869,266.000,-289.798]}},{"noteOn":{"time":73.730,"note":96.000,"xyz":[-118.067,242.000,45.656]}},{"noteOn":{"time":73.750,"note":97.000,"xyz":[-21.555,254.000,203.919]}},{"noteOn":{"time":73.995,"note":104.000,"xyz":[-150.690,338.000,279.107]}},{"noteOn":{"time":74.075,"note":100.000,"xyz":[-54.043,290.000,1.325]}},{"noteOn":{"time":74.110,"note":90.000,"xyz":[-103.807,170.000,123.282]}},{"noteOn":{"time":74.130,"note":102.000,"xyz":[148.414,314.000,98.990]}},{"noteOn":{"time":74.190,"note":104.000,"xyz":[92.340,338.000,174.619]}},{"noteOn":{"time":74.245,"note":92.000,"xyz":[108.787,194.000,398.374]}},{"noteOn":{"time":74.250,"note":98.000,"xyz":[61.947,266.000,102.908]}},{"noteOn":{"time":74.265,"note":96.000,"xyz":[-296.047,242.000,273.278]}},{"noteOn":{"time":74.415,"note":99.000,"xyz":[-39.004,278.000,-33.220]}},{"noteOn":{"time":74.535,"note":96.000,"xyz":[-237.928,242.000,-314.527]}},{"noteOn":{"time":74.605,"note":94.000,"xyz":[103.661,218.000,260.378]}},{"noteOn":{"time":74.635,"note":100.000,"xyz":[165.922,290.000,-82.889]}},{"noteOn":{"time":74.740,"note":94.000,"xyz":[-451.113,218.000,72.471]}},{"noteOn":{"time":74.755,"note":100.000,"xyz":[163.483,290.000,-298.163]}},{"noteOn":{"time":74.770,"note":106.000,"xyz":[49.758,362.000,-207.480]}},{"noteOn":{"time":74.940,"note":106.000,"xyz":[-9.636,362.000,-469.594]}},{"noteOn":{"time":75.045,"note":92.000,"xyz":[388.004,194.000,308.569]}},{"noteOn":{"time":75.090,"note":106.000,"xyz":[-62.410,362.000,81.799]}},{"noteOn":{"time":75.165,"note":93.000,"xyz":[130.274,206.000,429.159]}},{"noteOn":{"time":75.230,"note":92.000,"xyz":[-487.586,194.000,101.858]}},{"noteOn":{"time":75.260,"note":98.000,"xyz":[142.406,266.000,-48.324]}},{"noteOn":{"time":75.305,"note":98.000,"xyz":[85.099,266.000,-65.265]}},{"noteOn":{"time":75.335,"note":100.000,"xyz":[-301.268,290.000,-79.539]}},{"noteOn":{"time":75.340,"note":96.000,"xyz":[-158.736,242.000,120.784]}},{"noteOn":{"time":75.545,"note":108.000,"xyz":[77.510,386.000,24.544]}},{"noteOn":{"time":75.630,"note":104.000,"xyz":[-58.570,338.000,-129.011]}},{"noteOn":{"time":75.675,"note":104.000,"xyz":[39.588,338.000,-71.881]}},{"noteOn":{"time":75.770,"note":98.000,"xyz":[-9.081,266.000,-94.300]}},{"noteOn":{"time":75.825,"note":91.000,"xyz":[-195.080,182.000,143.225]}},{"noteOn":{"time":75.930,"note":94.000,"xyz":[-458.493,218.000,-49.351]}},{"noteOn":{"time":76.085,"note":102.000,"xyz":[-70.684,314.000,296.435]}},{"noteOn":{"time":76.110,"note":101.000,"xyz":[-177.068,302.000,199.912]}},{"noteOn":{"time":76.155,"note":100.000,"xyz":[358.015,290.000,267.063]}},{"noteOn":{"time":76.170,"note":92.000,"xyz":[473.905,194.000,-73.217]}},{"noteOn":{"time":76.215,"note":104.000,"xyz":[-171.996,338.000,-185.658]}},{"noteOn":{"time":76.300,"note":98.000,"xyz":[-91.490,266.000,-108.577]}},{"noteOn":{"time":76.385,"note":100.000,"xyz":[-221.695,290.000,197.313]}},{"noteOn":{"time":76.400,"note":101.000,"xyz":[325.898,302.000,-281.953]}},{"noteOn":{"time":76.530,"note":96.000,"xyz":[376.947,242.000,147.283]}},{"noteOn":{"time":76.640,"note":92.000,"xyz":[-456.844,194.000,-176.718]}},{"noteOn":{"time":76.730,"note":99.000,"xyz":[-14.471,278.000,320.225]}},{"noteOn":{"time":76.910,"note":94.000,"xyz":[-284.589,218.000,-384.476]}},{"noteOn":{"time":76.975,"note":100.000,"xyz":[-432.831,290.000,-87.717]}},{"noteOn":{"time":77.010,"note":106.000,"xyz":[-309.312,362.000,165.468]}},{"noteOn":{"time":77.015,"note":100.000,"xyz":[258.645,290.000,-181.733]}},{"noteOn":{"time":77.035,"note":102.000,"xyz":[61.021,314.000,-47.194]}},{"noteOn":{"time":77.050,"note":105.000,"xyz":[-14.011,350.000,-201.101]}},{"noteOn":{"time":77.130,"note":93.000,"xyz":[-24.292,206.000,73.576]}},{"noteOn":{"time":77.170,"note":98.000,"xyz":[358.079,266.000,-228.338]}},{"noteOn":{"time":77.390,"note":99.000,"xyz":[-14.677,278.000,-418.245]}},{"noteOn":{"time":77.610,"note":95.000,"xyz":[239.722,230.000,75.559]}},{"noteOn":{"time":77.690,"note":98.000,"xyz":[-438.939,266.000,-123.849]}},{"noteOn":{"time":77.760,"note":93.000,"xyz":[-83.017,206.000,99.176]}},{"noteOn":{"time":77.820,"note":100.000,"xyz":[454.992,290.000,67.131]}},{"noteOn":{"time":77.835,"note":103.000,"xyz":[41.183,326.000,-56.309]}},{"noteOn":{"time":77.835,"note":102.000,"xyz":[117.918,314.000,-24.450]}},{"noteOn":{"time":77.930,"note":93.000,"xyz":[-244.261,206.000,-164.827]}},{"noteOn":{"time":77.935,"note":102.000,"xyz":[-75.901,314.000,-42.812]}},{"noteOn":{"time":77.945,"note":98.000,"xyz":[-305.266,266.000,336.868]}},{"noteOn":{"time":78.225,"note":97.000,"xyz":[-137.679,254.000,248.533]}},{"noteOn":{"time":78.290,"note":97.000,"xyz":[386.993,254.000,128.473]}},{"noteOn":{"time":78.385,"note":97.000,"xyz":[-189.716,254.000,-135.236]}},{"noteOn":{"time":78.485,"note":100.000,"xyz":[314.237,290.000,-63.045]}},{"noteOn":{"time":78.555,"note":101.000,"xyz":[40.423,302.000,-334.028]}},{"noteOn":{"time":78.635,"note":99.000,"xyz":[-96.908,278.000,34.325]}},{"noteOn":{"time":78.650,"note":91.000,"xyz":[-437.610,182.000,43.421]}},{"noteOn":{"time":78.700,"note":91.000,"xyz":[409.902,182.000,-225.482]}},{"noteOn":{"time":78.755,"note":105.000,"xyz":[46.368,350.000,-244.543]}},{"noteOn":{"time":78.905,"note":95.000,"xyz":[237.954,230.000,-321.920]}},{"noteOn":{"time":78.975,"note":100.000,"xyz":[340.012,290.000,-77.234]}},{"noteOn":{"time":79.110,"note":99.000,"xyz":[-412.258,278.000,-52.228]}},{"noteOn":{"time":79.115,"note":93.000,"xyz":[-329.032,206.000,312.404]}},{"noteOn":{"time":79.195,"note":99.000,"xyz":[-60.131,278.000,179.051]}},{"noteOn":{"time":79.235,"note":101.000,"xyz":[-388.363,302.000,209.814]}},{"noteOn":{"time":79.365,"note":106.000,"xyz":[-195.589,362.000,19.352]}},{"noteOn":{"time":79.430,"note":95.000,"xyz":[28.262,230.000,-133.204]}},{"noteOn":{"time":79.430,"note":105.000,"xyz":[246.957,350.000,-50.638]}},{"noteOn":{"time":79.570,"note":105.000,"xyz":[-282.743,350.000,-81.945]}},{"noteOn":{"time":79.640,"note":93.000,"xyz":[-305.110,206.000,-258.613]}},{"noteOn":{"time":79.725,"note":91.000,"xyz":[418.759,182.000,126.140]}},{"noteOn":{"time":79.750,"note":92.000,"xyz":[-361.499,194.000,89.731]}},{"noteOn":{"time":79.775,"note":97.000,"xyz":[285.059,254.000,158.011]}},{"noteOn":{"time":79.835,"note":99.000,"xyz":[47.376,278.000,-31.589]}},{"noteOn":{"time":79.855,"note":99.000,"xyz":[113.393,278.000,85.144]}},{"noteOn":{"time":79.955,"note":97.000,"xyz":[496.515,254.000,0.175]}},{"noteOn":{"time":79.955,"note":107.000,"xyz":[204.040,374.000,-111.957]}},{"noteOn":{"time":80.010,"note":103.000,"xyz":[-248.105,326.000,-65.466]}},{"noteOn":{"time":80.255,"note":103.000,"xyz":[-443.798,326.000,42.275]}},{"noteOn":{"time":80.390,"note":92.000,"xyz":[350.275,194.000,294.674]}},{"noteOn":{"time":80.450,"note":93.000,"xyz":[-257.364,206.000,-230.605]}},{"noteOn":{"time":80.575,"note":101.000,"xyz":[129.383,302.000,44.709]}},{"noteOn":{"time":80.615,"note":101.000,"xyz":[-240.608,302.000,63.221]}},{"noteOn":{"time":80.620,"note":95.000,"xyz":[3.198,230.000,352.960]}},{"noteOn":{"time":80.645,"note":93.000,"xyz":[89.574,206.000,65.984]}},{"noteOn":{"time":80.740,"note":101.000,"xyz":[-321.224,302.000,124.590]}},{"noteOn":{"time":80.875,"note":101.000,"xyz":[-259.751,302.000,208.586]}},{"noteOn":{"time":80.900,"note":99.000,"xyz":[-49.926,278.000,-13.363]}},{"noteOn":{"time":80.945,"note":100.000,"xyz":[494.436,290.000,37.091]}},{"noteOn":{"time":81.060,"note":105.000,"xyz":[-96.640,350.000,-60.577]}},{"noteOn":{"time":81.085,"note":91.000,"xyz":[-327.860,182.000,18.145]}},{"noteOn":{"time":81.225,"note":99.000,"xyz":[256.704,278.000,-363.061]}},{"noteOn":{"time":81.230,"note":105.000,"xyz":[-49.712,350.000,451.441]}},{"noteOn":{"time":81.340,"note":95.000,"xyz":[323.869,230.000,-19.368]}},{"noteOn":{"time":81.345,"note":99.000,"xyz":[72.485,278.000,119.448]}},{"noteOn":{"time":81.425,"note":101.000,"xyz":[-67.180,302.000,-69.956]}},{"noteOn":{"time":81.635,"note":99.000,"xyz":[363.700,278.000,2.888]}},{"noteOn":{"time":81.635,"note":107.000,"xyz":[77.156,374.000,-22.152]}},{"noteOn":{"time":81.665,"note":93.000,"xyz":[105.910,206.000,248.154]}},{"noteOn":{"time":81.680,"note":103.000,"xyz":[52.635,326.000,-329.898]}},{"noteOn":{"time":81.735,"note":109.000,"xyz":[-103.588,398.000,171.675]}},{"noteOn":{"time":81.910,"note":98.000,"xyz":[30.690,266.000,-74.747]}},{"noteOn":{"time":82.100,"note":102.000,"xyz":[-363.951,314.000,-3.839]}},{"noteOn":{"time":82.120,"note":96.000,"xyz":[-292.061,242.000,-11.957]}},{"noteOn":{"time":82.180,"note":97.000,"xyz":[28.489,254.000,-77.828]}},{"noteOn":{"time":82.235,"note":93.000,"xyz":[250.001,206.000,-96.900]}},{"noteOn":{"time":82.260,"note":103.000,"xyz":[-179.384,326.000,239.411]}},{"noteOn":{"time":82.365,"note":99.000,"xyz":[35.429,278.000,77.207]}},{"noteOn":{"time":82.410,"note":94.000,"xyz":[104.985,218.000,-66.699]}},{"noteOn":{"time":82.420,"note":101.000,"xyz":[-157.221,302.000,-47.074]}},{"noteOn":{"time":82.430,"note":97.000,"xyz":[-389.260,254.000,242.943]}},{"noteOn":{"time":82.620,"note":107.000,"xyz":[115.351,374.000,-218.962]}},{"noteOn":{"time":82.725,"note":98.000,"xyz":[-255.951,266.000,-158.149]}},{"noteOn":{"time":82.740,"note":98.000,"xyz":[277.372,266.000,-284.181]}},{"noteOn":{"time":82.790,"note":98.000,"xyz":[-263.599,266.000,-94.656]}},{"noteOn":{"time":82.960,"note":99.000,"xyz":[-85.823,278.000,-459.450]}},{"noteOn":{"time":82.980,"note":100.000,"xyz":[371.667,290.000,18.588]}},{"noteOn":{"time":83.015,"note":99.000,"xyz":[-82.614,278.000,116.229]}},{"noteOn":{"time":83.200,"note":105.000,"xyz":[-444.625,350.000,-21.367]}},{"noteOn":{"time":83.225,"note":91.000,"xyz":[-115.837,182.000,95.031]}},{"noteOn":{"time":83.245,"note":95.000,"xyz":[167.257,230.000,-133.651]}},{"noteOn":{"time":83.275,"note":91.000,"xyz":[63.697,182.000,139.334]}},{"noteOn":{"time":83.500,"note":100.000,"xyz":[255.964,290.000,-161.442]}},{"noteOn":{"time":83.530,"note":104.000,"xyz":[91.303,338.000,285.209]}},{"noteOn":{"time":83.585,"note":98.000,"xyz":[368.103,266.000,-127.537]}},{"noteOn":{"time":83.625,"note":92.000,"xyz":[-215.898,194.000,95.396]}},{"noteOn":{"time":83.640,"note":100.000,"xyz":[-370.684,290.000,50.036]}},{"noteOn":{"time":83.735,"note":104.000,"xyz":[-9.176,338.000,54.817]}},{"noteOn":{"time":83.800,"note":100.000,"xyz":[-38.762,290.000,-151.088]}},{"noteOn":{"time":83.875,"note":105.000,"xyz":[-188.479,350.000,389.994]}},{"noteOn":{"time":83.890,"note":107.000,"xyz":[-44.234,374.000,-61.404]}},{"noteOn":{"time":83.990,"note":95.000,"xyz":[-356.976,230.000,207.585]}},{"noteOn":{"time":84.185,"note":93.000,"xyz":[-378.729,206.000,-117.504]}},{"noteOn":{"time":84.220,"note":90.000,"xyz":[145.958,170.000,127.504]}},{"noteOn":{"time":84.230,"note":106.000,"xyz":[-55.741,362.000,-432.658]}},{"noteOn":{"time":84.295,"note":92.000,"xyz":[130.939,194.000,-466.733]}},{"noteOn":{"time":84.310,"note":96.000,"xyz":[391.148,242.000,-158.372]}},{"noteOn":{"time":84.370,"note":100.000,"xyz":[-167.534,290.000,270.929]}},{"noteOn":{"time":84.450,"note":102.000,"xyz":[-37.393,314.000,-442.484]}},{"noteOn":{"time":84.470,"note":98.000,"xyz":[-189.973,266.000,-1.028]}},{"noteOn":{"time":84.490,"note":107.000,"xyz":[-153.257,374.000,-34.996]}},{"noteOn":{"time":84.640,"note":98.000,"xyz":[-210.373,266.000,24.154]}},{"noteOn":{"time":84.640,"note":102.000,"xyz":[112.183,314.000,402.304]}},{"noteOn":{"time":84.740,"note":100.000,"xyz":[26.133,290.000,161.372]}},{"noteOn":{"time":84.915,"note":93.000,"xyz":[-204.501,206.000,386.983]}},{"noteOn":{"time":84.915,"note":92.000,"xyz":[-4.911,194.000,-249.299]}},{"noteOn":{"time":85.125,"note":100.000,"xyz":[-203.441,290.000,424.123]}},{"noteOn":{"time":85.140,"note":100.000,"xyz":[158.583,290.000,178.571]}},{"noteOn":{"time":85.210,"note":94.000,"xyz":[24.026,218.000,179.380]}},{"noteOn":{"time":85.240,"note":94.000,"xyz":[-38.028,218.000,-407.049]}},{"noteOn":{"time":85.325,"note":102.000,"xyz":[151.630,314.000,418.699]}},{"noteOn":{"time":85.360,"note":100.000,"xyz":[247.173,290.000,-119.276]}},{"noteOn":{"time":85.435,"note":102.000,"xyz":[-161.021,314.000,-132.862]}},{"noteOn":{"time":85.445,"note":99.000,"xyz":[-8.611,278.000,56.334]}},{"noteOn":{"time":85.460,"note":98.000,"xyz":[-31.149,266.000,-215.674]}},{"noteOn":{"time":85.470,"note":90.000,"xyz":[244.156,170.000,-45.136]}},{"noteOn":{"time":85.615,"note":106.000,"xyz":[-230.437,362.000,-242.398]}},{"noteOn":{"time":85.720,"note":98.000,"xyz":[335.006,266.000,-273.805]}},{"noteOn":{"time":85.790,"note":98.000,"xyz":[182.100,266.000,421.672]}},{"noteOn":{"time":85.865,"note":96.000,"xyz":[146.481,242.000,-455.274]}},{"noteOn":{"time":85.935,"note":104.000,"xyz":[383.637,338.000,14.486]}},{"noteOn":{"time":86.025,"note":102.000,"xyz":[-106.520,314.000,68.810]}},{"noteOn":{"time":86.095,"note":100.000,"xyz":[448.967,290.000,-165.415]}},{"noteOn":{"time":86.195,"note":92.000,"xyz":[-60.138,194.000,2.306]}},{"noteOn":{"time":86.260,"note":108.000,"xyz":[-0.661,386.000,85.533]}},{"noteOn":{"time":86.390,"note":108.000,"xyz":[411.257,386.000,100.026]}},{"noteOn":{"time":86.390,"note":97.000,"xyz":[69.847,254.000,-426.149]}},{"noteOn":{"time":86.395,"note":104.000,"xyz":[131.246,338.000,14.575]}},{"noteOn":{"time":86.585,"note":104.000,"xyz":[258.018,338.000,-267.039]}},{"noteOn":{"time":86.630,"note":96.000,"xyz":[87.685,242.000,52.724]}},{"noteOn":{"time":86.805,"note":92.000,"xyz":[-251.949,194.000,-187.861]}},{"noteOn":{"time":86.830,"note":100.000,"xyz":[203.751,290.000,94.330]}},{"noteOn":{"time":86.885,"note":94.000,"xyz":[-301.417,218.000,-77.199]}},{"noteOn":{"time":86.895,"note":102.000,"xyz":[-153.001,314.000,-38.597]}},{"noteOn":{"time":86.905,"note":98.000,"xyz":[-101.490,266.000,55.399]}},{"noteOn":{"time":86.995,"note":96.000,"xyz":[-334.810,242.000,-205.708]}},{"noteOn":{"time":87.025,"note":98.000,"xyz":[215.813,266.000,-394.484]}},{"noteOn":{"time":87.220,"note":99.000,"xyz":[52.463,278.000,-29.725]}},{"noteOn":{"time":87.250,"note":99.000,"xyz":[460.161,278.000,-187.488]}},{"noteOn":{"time":87.250,"note":106.000,"xyz":[147.703,362.000,365.875]}},{"noteOn":{"time":87.400,"note":100.000,"xyz":[63.367,290.000,41.177]}},{"noteOn":{"time":87.525,"note":106.000,"xyz":[17.122,362.000,-112.525]}},{"noteOn":{"time":87.555,"note":98.000,"xyz":[72.461,266.000,371.157]}},{"noteOn":{"time":87.620,"note":98.000,"xyz":[95.044,266.000,395.907]}},{"noteOn":{"time":87.640,"note":100.000,"xyz":[183.644,290.000,-55.140]}},{"noteOn":{"time":87.650,"note":96.000,"xyz":[-121.638,242.000,184.426]}},{"noteOn":{"time":87.775,"note":90.000,"xyz":[75.125,170.000,-364.638]}},{"noteOn":{"time":87.895,"note":92.000,"xyz":[-137.500,194.000,137.636]}},{"noteOn":{"time":87.905,"note":104.000,"xyz":[-98.986,338.000,240.710]}},{"noteOn":{"time":87.980,"note":101.000,"xyz":[104.663,302.000,-259.128]}},{"noteOn":{"time":88.060,"note":97.000,"xyz":[175.576,254.000,299.679]}},{"noteOn":{"time":88.135,"note":91.000,"xyz":[41.815,182.000,112.678]}},{"noteOn":{"time":88.145,"note":104.000,"xyz":[255.454,338.000,-176.158]}},{"noteOn":{"time":88.300,"note":108.000,"xyz":[142.216,386.000,52.818]}},{"noteOn":{"time":88.395,"note":100.000,"xyz":[-82.346,290.000,119.069]}},{"noteOn":{"time":88.435,"note":96.000,"xyz":[-97.360,242.000,9.430]}},{"noteOn":{"time":88.435,"note":104.000,"xyz":[184.178,338.000,-28.577]}},{"noteOn":{"time":88.465,"note":107.000,"xyz":[-230.230,374.000,223.774]}},{"noteOn":{"time":88.610,"note":101.000,"xyz":[-309.525,302.000,170.099]}},{"noteOn":{"time":88.720,"note":91.000,"xyz":[194.216,182.000,91.987]}},{"noteOn":{"time":88.725,"note":94.000,"xyz":[-96.053,218.000,-126.115]}},{"noteOn":{"time":88.800,"note":91.000,"xyz":[52.244,182.000,242.033]}},{"noteOn":{"time":88.895,"note":101.000,"xyz":[-281.391,302.000,75.709]}},{"noteOn":{"time":89.020,"note":102.000,"xyz":[204.419,314.000,-75.655]}},{"noteOn":{"time":89.085,"note":106.000,"xyz":[317.648,362.000,-319.201]}},{"noteOn":{"time":89.105,"note":97.000,"xyz":[-131.268,254.000,-282.906]}},{"noteOn":{"time":89.170,"note":102.000,"xyz":[-260.647,314.000,-22.160]}},{"noteOn":{"time":89.205,"note":98.000,"xyz":[-140.824,266.000,-194.121]}},{"noteOn":{"time":89.230,"note":99.000,"xyz":[-121.869,278.000,89.809]}},{"noteOn":{"time":89.365,"note":95.000,"xyz":[-61.077,230.000,-116.438]}},{"noteOn":{"time":89.380,"note":92.000,"xyz":[-87.131,194.000,288.231]}},{"noteOn":{"time":89.395,"note":93.000,"xyz":[-433.041,206.000,-49.656]}},{"noteOn":{"time":89.635,"note":99.000,"xyz":[100.150,278.000,0.189]}},{"noteOn":{"time":89.770,"note":100.000,"xyz":[137.890,290.000,-249.137]}},{"noteOn":{"time":89.775,"note":107.000,"xyz":[45.951,374.000,-276.943]}},{"noteOn":{"time":89.805,"note":95.000,"xyz":[122.203,230.000,-2.278]}},{"noteOn":{"time":89.825,"note":99.000,"xyz":[-0.863,278.000,260.494]}},{"noteOn":{"time":89.885,"note":103.000,"xyz":[-103.417,326.000,-73.751]}},{"noteOn":{"time":89.905,"note":99.000,"xyz":[-78.743,278.000,-86.261]}},{"noteOn":{"time":89.905,"note":89.000,"xyz":[-30.572,158.000,479.496]}},{"noteOn":{"time":89.995,"note":103.000,"xyz":[-415.805,326.000,-247.185]}},{"noteOn":{"time":90.205,"note":99.000,"xyz":[146.078,278.000,-130.228]}},{"noteOn":{"time":90.220,"note":97.000,"xyz":[73.023,254.000,68.743]}},{"noteOn":{"time":90.345,"note":93.000,"xyz":[138.991,206.000,-479.459]}},{"noteOn":{"time":90.350,"note":97.000,"xyz":[96.155,254.000,-185.945]}},{"noteOn":{"time":90.410,"note":97.000,"xyz":[200.758,254.000,120.189]}},{"noteOn":{"time":90.615,"note":99.000,"xyz":[164.395,278.000,268.150]}},{"noteOn":{"time":90.620,"note":102.000,"xyz":[-386.031,314.000,20.309]}},{"noteOn":{"time":90.645,"note":109.000,"xyz":[185.858,398.000,-164.872]}},{"noteOn":{"time":90.695,"note":93.000,"xyz":[224.416,206.000,151.126]}},{"noteOn":{"time":90.830,"note":96.000,"xyz":[-129.771,242.000,126.560]}},{"noteOn":{"time":90.885,"note":105.000,"xyz":[429.838,350.000,-174.609]}},{"noteOn":{"time":91.020,"note":107.000,"xyz":[-326.305,374.000,-108.715]}},{"noteOn":{"time":91.025,"note":105.000,"xyz":[220.389,350.000,-251.870]}},{"noteOn":{"time":91.130,"note":103.000,"xyz":[-136.243,326.000,270.601]}},{"noteOn":{"time":91.140,"note":97.000,"xyz":[-65.578,254.000,-3.804]}},{"noteOn":{"time":91.240,"note":99.000,"xyz":[87.607,278.000,253.936]}},{"noteOn":{"time":91.335,"note":95.000,"xyz":[-47.564,230.000,-38.057]}},{"noteOn":{"time":91.395,"note":91.000,"xyz":[129.595,182.000,-167.995]}},{"noteOn":{"time":91.440,"note":95.000,"xyz":[-148.933,230.000,-18.814]}},{"noteOn":{"time":91.500,"note":97.000,"xyz":[131.283,254.000,-252.848]}},{"noteOn":{"time":91.630,"note":99.000,"xyz":[-1.434,278.000,-148.462]}},{"noteOn":{"time":91.630,"note":105.000,"xyz":[-154.043,350.000,-181.967]}},{"noteOn":{"time":91.665,"note":100.000,"xyz":[-99.358,290.000,19.478]}},{"noteOn":{"time":91.720,"note":99.000,"xyz":[-340.186,278.000,361.015]}},{"noteOn":{"time":91.845,"note":105.000,"xyz":[-176.867,350.000,280.999]}},{"noteOn":{"time":91.875,"note":99.000,"xyz":[214.056,278.000,3.735]}},{"noteOn":{"time":91.945,"note":97.000,"xyz":[0.727,254.000,61.604]}},{"noteOn":{"time":92.085,"note":101.000,"xyz":[-162.505,302.000,-310.105]}},{"noteOn":{"time":92.150,"note":97.000,"xyz":[215.374,254.000,-159.457]}},{"noteOn":{"time":92.230,"note":105.000,"xyz":[-442.312,350.000,-160.040]}},{"noteOn":{"time":92.235,"note":101.000,"xyz":[482.565,302.000,-105.904]}},{"noteOn":{"time":92.320,"note":89.000,"xyz":[-122.004,158.000,-414.402]}},{"noteOn":{"time":92.420,"note":102.000,"xyz":[-38.847,314.000,-39.921]}},{"noteOn":{"time":92.435,"note":93.000,"xyz":[57.529,206.000,168.781]}},{"noteOn":{"time":92.590,"note":97.000,"xyz":[-115.837,254.000,-136.205]}},{"noteOn":{"time":92.645,"note":91.000,"xyz":[71.659,182.000,226.258]}},{"noteOn":{"time":92.710,"note":107.000,"xyz":[-103.942,374.000,-83.406]}},{"noteOn":{"time":92.810,"note":97.000,"xyz":[-68.728,254.000,-32.911]}},{"noteOn":{"time":92.885,"note":103.000,"xyz":[43.910,326.000,-451.781]}},{"noteOn":{"time":92.895,"note":99.000,"xyz":[-108.396,278.000,-34.530]}},{"noteOn":{"time":92.960,"note":103.000,"xyz":[161.066,326.000,87.375]}},{"noteOn":{"time":92.990,"note":99.000,"xyz":[114.820,278.000,19.541]}},{"noteOn":{"time":93.045,"note":107.000,"xyz":[338.512,374.000,-254.819]}},{"noteOn":{"time":93.190,"note":95.000,"xyz":[-61.294,230.000,-127.576]}},{"noteOn":{"time":93.220,"note":92.000,"xyz":[151.797,194.000,160.235]}},{"noteOn":{"time":93.255,"note":92.000,"xyz":[-282.892,194.000,110.266]}},{"noteOn":{"time":93.485,"note":102.000,"xyz":[-152.451,314.000,-207.678]}},{"noteOn":{"time":93.615,"note":101.000,"xyz":[142.795,302.000,-269.871]}},{"noteOn":{"time":93.685,"note":105.000,"xyz":[184.280,350.000,404.227]}},{"noteOn":{"time":93.700,"note":99.000,"xyz":[65.177,278.000,-8.493]}},{"noteOn":{"time":93.745,"note":97.000,"xyz":[-257.949,254.000,-28.435]}},{"noteOn":{"time":93.765,"note":91.000,"xyz":[336.590,182.000,-24.587]}},{"noteOn":{"time":93.770,"note":101.000,"xyz":[308.384,302.000,85.059]}},{"noteOn":{"time":93.820,"note":101.000,"xyz":[367.461,302.000,14.234]}},{"noteOn":{"time":93.835,"note":94.000,"xyz":[-148.410,218.000,237.282]}},{"noteOn":{"time":94.025,"note":99.000,"xyz":[63.133,278.000,395.731]}},{"noteOn":{"time":94.150,"note":98.000,"xyz":[-53.768,266.000,-59.936]}},{"noteOn":{"time":94.150,"note":107.000,"xyz":[254.769,374.000,215.939]}},{"noteOn":{"time":94.190,"note":101.000,"xyz":[-286.755,302.000,331.361]}},{"noteOn":{"time":94.345,"note":98.000,"xyz":[-93.177,266.000,170.174]}},{"noteOn":{"time":94.370,"note":89.000,"xyz":[52.369,158.000,9.802]}},{"noteOn":{"time":94.395,"note":111.000,"xyz":[385.404,422.000,92.201]}},{"noteOn":{"time":94.400,"note":95.000,"xyz":[363.649,230.000,-248.014]}},{"noteOn":{"time":94.415,"note":104.000,"xyz":[138.388,338.000,81.479]}},{"noteOn":{"time":94.440,"note":99.000,"xyz":[-29.705,278.000,42.402]}},{"noteOn":{"time":94.445,"note":103.000,"xyz":[131.026,326.000,-48.352]}},{"noteOn":{"time":94.665,"note":94.000,"xyz":[256.782,218.000,-234.126]}},{"noteOn":{"time":94.720,"note":96.000,"xyz":[114.206,242.000,-188.209]}},{"noteOn":{"time":94.800,"note":100.000,"xyz":[81.768,290.000,171.669]}},{"noteOn":{"time":94.925,"note":108.000,"xyz":[-212.150,386.000,196.294]}},{"noteOn":{"time":94.960,"note":98.000,"xyz":[-54.632,266.000,-197.148]}},{"noteOn":{"time":95.035,"note":97.000,"xyz":[-275.933,254.000,-228.455]}},{"noteOn":{"time":95.065,"note":108.000,"xyz":[-200.007,386.000,63.865]}},{"noteOn":{"time":95.155,"note":103.000,"xyz":[-414.123,326.000,-183.640]}},{"noteOn":{"time":95.155,"note":99.000,"xyz":[-46.574,278.000,371.300]}},{"noteOn":{"time":95.175,"note":94.000,"xyz":[92.033,218.000,16.655]}},{"noteOn":{"time":95.175,"note":105.000,"xyz":[147.786,350.000,109.330]}},{"noteOn":{"time":95.250,"note":96.000,"xyz":[-329.703,242.000,-313.286]}},{"noteOn":{"time":95.365,"note":106.000,"xyz":[-149.713,362.000,282.010]}},{"noteOn":{"time":95.560,"note":94.000,"xyz":[160.420,218.000,-156.126]}},{"noteOn":{"time":95.590,"note":106.000,"xyz":[-340.258,362.000,123.488]}},{"noteOn":{"time":95.600,"note":104.000,"xyz":[326.161,338.000,180.737]}},{"noteOn":{"time":95.655,"note":98.000,"xyz":[97.365,266.000,-75.360]}},{"noteOn":{"time":95.725,"note":99.000,"xyz":[422.185,278.000,84.487]}},{"noteOn":{"time":95.755,"note":96.000,"xyz":[0.775,242.000,173.544]}},{"noteOn":{"time":95.865,"note":100.000,"xyz":[62.623,290.000,-148.465]}},{"noteOn":{"time":95.890,"note":96.000,"xyz":[244.787,242.000,60.550]}},{"noteOn":{"time":95.935,"note":90.000,"xyz":[166.389,170.000,20.013]}},{"noteOn":{"time":96.010,"note":104.000,"xyz":[-222.741,338.000,192.489]}},{"noteOn":{"time":96.065,"note":101.000,"xyz":[-61.554,302.000,-53.731]}},{"noteOn":{"time":96.120,"note":96.000,"xyz":[106.382,242.000,124.620]}},{"noteOn":{"time":96.220,"note":100.000,"xyz":[-87.777,290.000,146.230]}},{"noteOn":{"time":96.220,"note":106.000,"xyz":[-234.935,362.000,160.954]}},{"noteOn":{"time":96.290,"note":104.000,"xyz":[176.334,338.000,-56.779]}},{"noteOn":{"time":96.350,"note":98.000,"xyz":[142.152,266.000,126.775]}},{"noteOn":{"time":96.430,"note":102.000,"xyz":[17.284,314.000,339.571]}},{"noteOn":{"time":96.540,"note":98.000,"xyz":[-287.164,266.000,142.247]}},{"noteOn":{"time":96.625,"note":96.000,"xyz":[-192.567,242.000,-356.402]}},{"noteOn":{"time":96.690,"note":102.000,"xyz":[431.836,314.000,-193.811]}},{"noteOn":{"time":96.805,"note":102.000,"xyz":[173.095,314.000,-397.992]}},{"noteOn":{"time":96.815,"note":90.000,"xyz":[-95.028,170.000,176.221]}},{"noteOn":{"time":96.835,"note":103.000,"xyz":[-139.672,326.000,330.470]}},{"noteOn":{"time":96.865,"note":106.000,"xyz":[363.573,362.000,232.146]}},{"noteOn":{"time":96.980,"note":94.000,"xyz":[47.180,218.000,273.597]}},{"noteOn":{"time":97.120,"note":96.000,"xyz":[-220.160,242.000,408.773]}},{"noteOn":{"time":97.135,"note":98.000,"xyz":[-119.765,266.000,50.364]}},{"noteOn":{"time":97.155,"note":90.000,"xyz":[-260.752,170.000,155.840]}},{"noteOn":{"time":97.255,"note":106.000,"xyz":[9.992,362.000,143.616]}},{"noteOn":{"time":97.295,"note":100.000,"xyz":[-475.758,290.000,-88.699]}},{"noteOn":{"time":97.445,"note":102.000,"xyz":[-410.429,314.000,-265.181]}},{"noteOn":{"time":97.520,"note":100.000,"xyz":[182.603,290.000,443.622]}},{"noteOn":{"time":97.525,"note":98.000,"xyz":[-93.580,266.000,308.932]}},{"noteOn":{"time":97.635,"note":102.000,"xyz":[217.942,314.000,425.932]}},{"noteOn":{"time":97.655,"note":96.000,"xyz":[210.355,242.000,238.537]}},{"noteOn":{"time":97.695,"note":93.000,"xyz":[-72.001,206.000,174.054]}},{"noteOn":{"time":97.720,"note":92.000,"xyz":[-162.460,194.000,-427.814]}},{"noteOn":{"time":97.800,"note":108.000,"xyz":[-294.147,386.000,-240.678]}},{"noteOn":{"time":98.035,"note":110.000,"xyz":[112.578,410.000,-33.959]}},{"noteOn":{"time":98.070,"note":102.000,"xyz":[-281.557,314.000,234.541]}},{"noteOn":{"time":98.095,"note":104.000,"xyz":[-214.720,338.000,12.608]}},{"noteOn":{"time":98.125,"note":100.000,"xyz":[37.236,290.000,40.676]}},{"noteOn":{"time":98.160,"note":90.000,"xyz":[200.580,170.000,119.474]}},{"noteOn":{"time":98.195,"note":100.000,"xyz":[-297.763,290.000,164.273]}},{"noteOn":{"time":98.200,"note":100.000,"xyz":[-87.425,290.000,-57.385]}},{"noteOn":{"time":98.250,"note":95.000,"xyz":[-334.936,230.000,-355.385]}},{"noteOn":{"time":98.330,"note":96.000,"xyz":[-220.682,242.000,-154.404]}},{"noteOn":{"time":98.410,"note":100.000,"xyz":[399.121,290.000,0.192]}},{"noteOn":{"time":98.530,"note":98.000,"xyz":[-342.268,266.000,-227.813]}},{"noteOn":{"time":98.660,"note":97.000,"xyz":[-18.887,254.000,-76.107]}},{"noteOn":{"time":98.785,"note":97.000,"xyz":[-100.210,254.000,7.418]}},{"noteOn":{"time":98.790,"note":102.000,"xyz":[419.169,314.000,131.365]}},{"noteOn":{"time":98.845,"note":88.000,"xyz":[307.559,146.000,264.739]}},{"noteOn":{"time":98.850,"note":108.000,"xyz":[-302.282,386.000,123.825]}},{"noteOn":{"time":98.885,"note":108.000,"xyz":[126.722,386.000,-215.881]}},{"noteOn":{"time":98.930,"note":104.000,"xyz":[229.331,338.000,50.054]}},{"noteOn":{"time":98.935,"note":96.000,"xyz":[-82.122,242.000,98.958]}},{"noteOn":{"time":98.945,"note":104.000,"xyz":[-138.832,338.000,195.032]}},{"noteOn":{"time":98.990,"note":98.000,"xyz":[164.656,266.000,319.855]}},{"noteOn":{"time":99.035,"note":102.000,"xyz":[107.943,314.000,38.754]}},{"noteOn":{"time":99.050,"note":100.000,"xyz":[-222.534,290.000,57.265]}},{"noteOn":{"time":99.220,"note":95.000,"xyz":[233.993,230.000,306.214]}},{"noteOn":{"time":99.455,"note":98.000,"xyz":[-375.450,266.000,252.319]}},{"noteOn":{"time":99.465,"note":105.000,"xyz":[-59.035,350.000,-210.765]}},{"noteOn":{"time":99.505,"note":106.000,"xyz":[226.141,362.000,-169.929]}},{"noteOn":{"time":99.565,"note":104.000,"xyz":[11.529,338.000,302.231]}},{"noteOn":{"time":99.580,"note":108.000,"xyz":[120.882,386.000,101.357]}},{"noteOn":{"time":99.650,"note":95.000,"xyz":[38.328,230.000,-81.308]}},{"noteOn":{"time":99.665,"note":95.000,"xyz":[263.361,230.000,-19.678]}},{"noteOn":{"time":99.705,"note":96.000,"xyz":[-30.109,242.000,47.679]}},{"noteOn":{"time":99.705,"note":98.000,"xyz":[-76.458,266.000,244.882]}},{"noteOn":{"time":99.740,"note":106.000,"xyz":[98.232,362.000,-246.996]}},{"noteOn":{"time":99.965,"note":94.000,"xyz":[-417.197,218.000,148.676]}},{"noteOn":{"time":100.155,"note":100.000,"xyz":[-163.476,290.000,40.613]}},{"noteOn":{"time":100.160,"note":99.000,"xyz":[-458.436,278.000,-55.088]}},{"noteOn":{"time":100.175,"note":97.000,"xyz":[26.686,254.000,208.270]}},{"noteOn":{"time":100.275,"note":106.000,"xyz":[107.486,362.000,-153.003]}},{"noteOn":{"time":100.325,"note":98.000,"xyz":[-327.612,266.000,67.354]}},{"noteOn":{"time":100.370,"note":96.000,"xyz":[-116.822,242.000,-3.685]}},{"noteOn":{"time":100.375,"note":107.000,"xyz":[-53.460,374.000,-42.741]}},{"noteOn":{"time":100.380,"note":89.000,"xyz":[31.961,158.000,-192.178]}},{"noteOn":{"time":100.455,"note":101.000,"xyz":[104.434,302.000,-8.377]}},{"noteOn":{"time":100.640,"note":103.000,"xyz":[-319.933,326.000,-250.187]}},{"noteOn":{"time":100.665,"note":96.000,"xyz":[-216.658,242.000,-425.381]}},{"noteOn":{"time":100.715,"note":101.000,"xyz":[270.008,302.000,298.129]}},{"noteOn":{"time":100.770,"note":94.000,"xyz":[147.740,218.000,-20.772]}},{"noteOn":{"time":100.825,"note":97.000,"xyz":[-119.278,254.000,240.761]}},{"noteOn":{"time":100.850,"note":103.000,"xyz":[-296.298,326.000,-162.868]}},{"noteOn":{"time":101.035,"note":96.000,"xyz":[-10.040,242.000,116.168]}},{"noteOn":{"time":101.080,"note":101.000,"xyz":[-85.443,302.000,-30.722]}},{"noteOn":{"time":101.110,"note":103.000,"xyz":[98.529,326.000,68.578]}},{"noteOn":{"time":101.180,"note":99.000,"xyz":[34.755,278.000,68.181]}},{"noteOn":{"time":101.215,"note":91.000,"xyz":[-13.132,182.000,-60.537]}},{"noteOn":{"time":101.250,"note":103.000,"xyz":[29.546,326.000,64.908]}},{"noteOn":{"time":101.445,"note":95.000,"xyz":[409.244,230.000,267.074]}},{"noteOn":{"time":101.530,"note":107.000,"xyz":[362.301,374.000,-258.700]}},{"noteOn":{"time":101.575,"note":99.000,"xyz":[-175.852,278.000,-104.120]}},{"noteOn":{"time":101.650,"note":95.000,"xyz":[148.503,230.000,153.167]}},{"noteOn":{"time":101.665,"note":91.000,"xyz":[-110.514,182.000,-150.573]}},{"noteOn":{"time":101.730,"note":101.000,"xyz":[-253.013,302.000,6.392]}},{"noteOn":{"time":101.855,"note":106.000,"xyz":[96.978,362.000,235.189]}},{"noteOn":{"time":101.930,"note":101.000,"xyz":[46.424,302.000,-60.868]}},{"noteOn":{"time":101.945,"note":101.000,"xyz":[176.870,302.000,277.740]}},{"noteOn":{"time":101.970,"note":97.000,"xyz":[236.583,254.000,-265.675]}},{"noteOn":{"time":102.040,"note":97.000,"xyz":[-1.978,254.000,-167.745]}},{"noteOn":{"time":102.075,"note":99.000,"xyz":[212.981,278.000,319.580]}},{"noteOn":{"time":102.135,"note":94.000,"xyz":[-216.445,218.000,230.029]}},{"noteOn":{"time":102.215,"note":109.000,"xyz":[-292.636,398.000,-176.397]}},{"noteOn":{"time":102.215,"note":93.000,"xyz":[6.850,206.000,272.262]}},{"noteOn":{"time":102.445,"note":101.000,"xyz":[-493.832,302.000,40.539]}},{"noteOn":{"time":102.510,"note":99.000,"xyz":[-64.886,278.000,-435.527]}},{"noteOn":{"time":102.510,"note":103.000,"xyz":[10.642,326.000,172.826]}},{"noteOn":{"time":102.625,"note":89.000,"xyz":[205.362,158.000,120.899]}},{"noteOn":{"time":102.650,"note":103.000,"xyz":[199.714,326.000,146.383]}},{"noteOn":{"time":102.665,"note":96.000,"xyz":[165.674,242.000,-350.302]}},{"noteOn":{"time":102.730,"note":99.000,"xyz":[-140.832,278.000,-419.342]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[115.470,278.000,417.562]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[101.211,278.000,19.828]}},{"noteOn":{"time":102.820,"note":95.000,"xyz":[-62.675,230.000,10.455]}},{"noteOn":{"time":102.880,"note":109.000,"xyz":[-338.896,398.000,321.383]}},{"noteOn":{"time":103.165,"note":97.000,"xyz":[17.204,254.000,94.104]}},{"noteOn":{"time":103.225,"note":96.000,"xyz":[-130.839,242.000,275.062]}},{"noteOn":{"time":103.375,"note":105.000,"xyz":[294.618,350.000,232.063]}},{"noteOn":{"time":103.385,"note":97.000,"xyz":[-373.755,254.000,83.244]}},{"noteOn":{"time":103.385,"note":89.000,"xyz":[-137.472,158.000,-112.084]}},{"noteOn":{"time":103.390,"note":103.000,"xyz":[261.347,326.000,-277.987]}},{"noteOn":{"time":103.430,"note":97.000,"xyz":[157.221,254.000,40.883]}},{"noteOn":{"time":103.475,"note":103.000,"xyz":[-183.974,326.000,-52.267]}},{"noteOn":{"time":103.475,"note":101.000,"xyz":[-126.849,302.000,51.581]}},{"noteOn":{"time":103.495,"note":101.000,"xyz":[-304.585,302.000,57.896]}},{"noteOn":{"time":103.640,"note":109.000,"xyz":[-80.087,398.000,324.519]}},{"noteOn":{"time":103.715,"note":95.000,"xyz":[237.470,230.000,-405.233]}},{"noteOn":{"time":103.780,"note":107.000,"xyz":[-158.855,374.000,-391.853]}},{"noteOn":{"time":103.910,"note":99.000,"xyz":[229.310,278.000,15.256]}},{"noteOn":{"time":103.950,"note":107.000,"xyz":[-149.724,374.000,-270.626]}},{"noteOn":{"time":103.975,"note":105.000,"xyz":[-114.576,350.000,-380.310]}},{"noteOn":{"time":104.080,"note":94.000,"xyz":[75.563,218.000,345.173]}},{"noteOn":{"time":104.125,"note":95.000,"xyz":[-207.306,230.000,-138.178]}},{"noteOn":{"time":104.165,"note":107.000,"xyz":[-324.854,374.000,134.576]}},{"noteOn":{"time":104.245,"note":103.000,"xyz":[275.191,326.000,22.314]}},{"noteOn":{"time":104.265,"note":95.000,"xyz":[-223.532,230.000,-141.806]}},{"noteOn":{"time":104.325,"note":97.000,"xyz":[286.657,254.000,67.794]}},{"noteOn":{"time":104.420,"note":105.000,"xyz":[-201.554,350.000,-124.372]}},{"noteOn":{"time":104.655,"note":98.000,"xyz":[62.554,266.000,-393.980]}},{"noteOn":{"time":104.670,"note":100.000,"xyz":[-351.604,290.000,-18.019]}},{"noteOn":{"time":104.680,"note":105.000,"xyz":[-186.720,350.000,-180.856]}},{"noteOn":{"time":104.795,"note":89.000,"xyz":[118.963,158.000,267.515]}},{"noteOn":{"time":104.810,"note":101.000,"xyz":[-372.256,302.000,-130.259]}},{"noteOn":{"time":104.855,"note":102.000,"xyz":[-265.943,314.000,-239.567]}},{"noteOn":{"time":104.920,"note":97.000,"xyz":[-114.761,254.000,461.957]}},{"noteOn":{"time":104.935,"note":97.000,"xyz":[-43.598,254.000,-209.094]}},{"noteOn":{"time":104.955,"note":105.000,"xyz":[-314.760,350.000,78.547]}},{"noteOn":{"time":105.205,"note":95.000,"xyz":[167.006,230.000,-106.630]}},{"noteOn":{"time":105.215,"note":102.000,"xyz":[83.890,314.000,28.769]}},{"noteOn":{"time":105.230,"note":93.000,"xyz":[160.244,206.000,200.827]}},{"noteOn":{"time":105.270,"note":103.000,"xyz":[-18.850,326.000,-52.331]}},{"noteOn":{"time":105.360,"note":96.000,"xyz":[186.001,242.000,37.727]}},{"noteOn":{"time":105.445,"note":97.000,"xyz":[164.317,254.000,-252.367]}},{"noteOn":{"time":105.485,"note":107.000,"xyz":[-173.720,374.000,320.299]}},{"noteOn":{"time":105.500,"note":103.000,"xyz":[-361.182,326.000,60.978]}},{"noteOn":{"time":105.545,"note":103.000,"xyz":[-256.867,326.000,-114.033]}},{"noteOn":{"time":105.585,"note":91.000,"xyz":[471.506,182.000,58.558]}},{"noteOn":{"time":105.670,"note":102.000,"xyz":[-216.893,314.000,-277.497]}},{"noteOn":{"time":105.895,"note":99.000,"xyz":[-385.084,278.000,253.037]}},{"noteOn":{"time":105.905,"note":95.000,"xyz":[193.629,230.000,209.662]}},{"noteOn":{"time":105.910,"note":108.000,"xyz":[-317.070,386.000,-38.059]}},{"noteOn":{"time":105.945,"note":95.000,"xyz":[163.545,230.000,-415.735]}},{"noteOn":{"time":106.105,"note":99.000,"xyz":[-54.519,278.000,197.519]}},{"noteOn":{"time":106.160,"note":100.000,"xyz":[-293.882,290.000,-315.614]}},{"noteOn":{"time":106.170,"note":92.000,"xyz":[97.196,194.000,-332.063]}},{"noteOn":{"time":106.240,"note":94.000,"xyz":[457.133,218.000,148.213]}},{"noteOn":{"time":106.385,"note":96.000,"xyz":[130.698,242.000,-52.305]}},{"noteOn":{"time":106.430,"note":97.000,"xyz":[-10.455,254.000,232.477]}},{"noteOn":{"time":106.445,"note":105.000,"xyz":[367.215,350.000,216.245]}},{"noteOn":{"time":106.480,"note":100.000,"xyz":[-58.781,290.000,-258.403]}},{"noteOn":{"time":106.480,"note":110.000,"xyz":[348.568,410.000,122.478]}},{"noteOn":{"time":106.490,"note":101.000,"xyz":[31.703,302.000,296.887]}},{"noteOn":{"time":106.570,"note":94.000,"xyz":[-114.152,218.000,252.749]}},{"noteOn":{"time":106.715,"note":94.000,"xyz":[68.885,218.000,195.268]}},{"noteOn":{"time":106.855,"note":102.000,"xyz":[-200.813,314.000,278.031]}},{"noteOn":{"time":106.900,"note":101.000,"xyz":[89.130,302.000,-195.890]}},{"noteOn":{"time":106.980,"note":103.000,"xyz":[-6.869,326.000,96.774]}},{"noteOn":{"time":107.030,"note":112.000,"xyz":[-181.359,434.000,122.844]}},{"noteOn":{"time":107.085,"note":97.000,"xyz":[-267.827,254.000,-294.122]}},{"noteOn":{"time":107.090,"note":88.000,"xyz":[-261.435,146.000,183.280]}},{"noteOn":{"time":107.145,"note":98.000,"xyz":[-10.349,266.000,-161.102]}},{"noteOn":{"time":107.155,"note":98.000,"xyz":[115.746,266.000,478.145]}},{"noteOn":{"time":107.185,"note":104.000,"xyz":[-215.238,338.000,247.207]}},{"noteOn":{"time":107.190,"note":100.000,"xyz":[-32.886,290.000,-190.800]}},{"noteOn":{"time":107.260,"note":100.000,"xyz":[-14.409,290.000,64.030]}},{"noteOn":{"time":107.275,"note":94.000,"xyz":[14.988,218.000,-71.345]}},{"noteOn":{"time":107.590,"note":98.000,"xyz":[288.671,266.000,60.825]}},{"noteOn":{"time":107.660,"note":95.000,"xyz":[-166.238,230.000,-228.708]}},{"noteOn":{"time":107.675,"note":96.000,"xyz":[-154.203,242.000,117.976]}},{"noteOn":{"time":107.750,"note":96.000,"xyz":[306.050,242.000,-62.168]}},{"noteOn":{"time":107.795,"note":98.000,"xyz":[49.017,266.000,-43.017]}},{"noteOn":{"time":107.865,"note":110.000,"xyz":[69.000,410.000,-356.368]}},{"noteOn":{"time":107.915,"note":103.000,"xyz":[418.049,326.000,-261.201]}},{"noteOn":{"time":107.930,"note":90.000,"xyz":[-125.613,170.000,-73.855]}},{"noteOn":{"time":107.935,"note":106.000,"xyz":[182.969,362.000,-318.061]}},{"noteOn":{"time":107.955,"note":102.000,"xyz":[167.887,314.000,212.353]}},{"noteOn":{"time":108.025,"note":108.000,"xyz":[23.228,386.000,453.948]}},{"noteOn":{"time":108.100,"note":108.000,"xyz":[-15.105,386.000,-456.034]}},{"noteOn":{"time":108.215,"note":94.000,"xyz":[182.856,218.000,-100.052]}},{"noteOn":{"time":108.250,"note":102.000,"xyz":[-42.764,314.000,55.633]}},{"noteOn":{"time":108.370,"note":100.000,"xyz":[-173.910,290.000,85.652]}},{"noteOn":{"time":108.500,"note":93.000,"xyz":[89.219,206.000,-60.833]}},{"noteOn":{"time":108.510,"note":106.000,"xyz":[-17.543,362.000,-73.207]}},{"noteOn":{"time":108.515,"note":102.000,"xyz":[-430.086,314.000,28.676]}},{"noteOn":{"time":108.545,"note":96.000,"xyz":[214.198,242.000,36.121]}},{"noteOn":{"time":108.670,"note":106.000,"xyz":[-155.568,362.000,38.130]}},{"noteOn":{"time":108.710,"note":94.000,"xyz":[-235.679,218.000,104.093]}},{"noteOn":{"time":108.710,"note":106.000,"xyz":[-138.264,362.000,464.422]}},{"noteOn":{"time":108.775,"note":106.000,"xyz":[-133.474,362.000,40.988]}},{"noteOn":{"time":108.810,"note":104.000,"xyz":[366.952,338.000,72.675]}},{"noteOn":{"time":108.910,"note":96.000,"xyz":[-342.865,242.000,-256.131]}},{"noteOn":{"time":109.055,"note":104.000,"xyz":[-303.172,338.000,240.799]}},{"noteOn":{"time":109.130,"note":98.000,"xyz":[-189.927,266.000,142.174]}},{"noteOn":{"time":109.175,"note":104.000,"xyz":[-485.375,338.000,46.668]}},{"noteOn":{"time":109.180,"note":100.000,"xyz":[-162.109,290.000,-47.352]}},{"noteOn":{"time":109.205,"note":90.000,"xyz":[264.323,170.000,344.851]}},{"noteOn":{"time":109.250,"note":103.000,"xyz":[295.656,326.000,187.037]}},{"noteOn":{"time":109.385,"note":96.000,"xyz":[-122.487,242.000,-24.949]}},{"noteOn":{"time":109.495,"note":98.000,"xyz":[378.837,266.000,-71.200]}},{"noteOn":{"time":109.520,"note":104.000,"xyz":[-66.847,338.000,45.182]}},{"noteOn":{"time":109.525,"note":106.000,"xyz":[268.806,362.000,-279.928]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[-32.812,314.000,304.638]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[406.287,314.000,55.501]}},{"noteOn":{"time":109.715,"note":101.000,"xyz":[-286.869,302.000,-282.767]}},{"noteOn":{"time":109.715,"note":94.000,"xyz":[-57.548,218.000,362.810]}},{"noteOn":{"time":109.750,"note":106.000,"xyz":[92.662,362.000,384.594]}},{"noteOn":{"time":109.890,"note":96.000,"xyz":[74.411,242.000,449.463]}},{"noteOn":{"time":109.950,"note":92.000,"xyz":[-250.830,194.000,-337.815]}},{"noteOn":{"time":110.045,"note":98.000,"xyz":[-341.802,266.000,126.235]}},{"noteOn":{"time":110.045,"note":108.000,"xyz":[-117.086,386.000,244.328]}},{"noteOn":{"time":110.070,"note":94.000,"xyz":[-303.013,218.000,-217.386]}},{"noteOn":{"time":110.085,"note":101.000,"xyz":[71.259,302.000,19.093]}},{"noteOn":{"time":110.155,"note":104.000,"xyz":[-164.355,338.000,14.941]}},{"noteOn":{"time":110.185,"note":102.000,"xyz":[192.702,314.000,367.005]}},{"noteOn":{"time":110.265,"note":108.000,"xyz":[69.525,386.000,-22.620]}},{"noteOn":{"time":110.335,"note":96.000,"xyz":[377.515,242.000,-139.277]}},{"noteOn":{"time":110.380,"note":100.000,"xyz":[-8.720,290.000,170.557]}},{"noteOn":{"time":110.580,"note":104.000,"xyz":[-120.573,338.000,-82.219]}},{"noteOn":{"time":110.685,"note":93.000,"xyz":[75.224,206.000,134.825]}},{"noteOn":{"time":110.700,"note":96.000,"xyz":[-69.342,242.000,106.357]}},{"noteOn":{"time":110.705,"note":100.000,"xyz":[-351.024,290.000,-188.091]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-383.434,290.000,136.453]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-130.245,290.000,29.646]}},{"noteOn":{"time":110.795,"note":96.000,"xyz":[-326.255,242.000,182.498]}},{"noteOn":{"time":110.825,"note":93.000,"xyz":[91.700,206.000,-295.111]}},{"noteOn":{"time":110.850,"note":104.000,"xyz":[-148.627,338.000,167.868]}},{"noteOn":{"time":110.895,"note":98.000,"xyz":[75.665,266.000,327.509]}},{"noteOn":{"time":110.935,"note":100.000,"xyz":[449.834,290.000,-63.822]}},{"noteOn":{"time":111.010,"note":95.000,"xyz":[286.081,230.000,320.867]}},{"noteOn":{"time":111.090,"note":110.000,"xyz":[-185.848,410.000,-165.916]}},{"noteOn":{"time":111.215,"note":95.000,"xyz":[-215.553,230.000,-253.782]}},{"noteOn":{"time":111.295,"note":102.000,"xyz":[202.900,314.000,382.618]}},{"noteOn":{"time":111.330,"note":102.000,"xyz":[95.048,314.000,-250.325]}},{"noteOn":{"time":111.345,"note":101.000,"xyz":[143.183,302.000,263.190]}},{"noteOn":{"time":111.440,"note":98.000,"xyz":[-85.338,266.000,265.357]}},{"noteOn":{"time":111.525,"note":97.000,"xyz":[-248.348,254.000,133.784]}},{"noteOn":{"time":111.535,"note":98.000,"xyz":[-67.326,266.000,-67.606]}},{"noteOn":{"time":111.565,"note":100.000,"xyz":[-59.980,290.000,-161.212]}},{"noteOn":{"time":111.575,"note":102.000,"xyz":[260.172,314.000,341.930]}},{"noteOn":{"time":111.630,"note":88.000,"xyz":[-420.375,146.000,-138.230]}},{"noteOn":{"time":111.715,"note":103.000,"xyz":[228.124,326.000,353.235]}},{"noteOn":{"time":111.735,"note":93.000,"xyz":[-4.273,206.000,143.283]}},{"noteOn":{"time":111.900,"note":112.000,"xyz":[50.004,434.000,289.824]}},{"noteOn":{"time":111.970,"note":107.000,"xyz":[-443.015,374.000,208.308]}},{"noteOn":{"time":112.055,"note":101.000,"xyz":[-185.523,302.000,-166.391]}},{"noteOn":{"time":112.105,"note":96.000,"xyz":[125.664,242.000,-233.053]}},{"noteOn":{"time":112.120,"note":95.000,"xyz":[475.866,230.000,-45.354]}},{"noteOn":{"time":112.165,"note":98.000,"xyz":[-343.466,266.000,264.271]}},{"noteOn":{"time":112.190,"note":95.000,"xyz":[208.657,230.000,-155.869]}},{"noteOn":{"time":112.190,"note":107.000,"xyz":[-385.703,374.000,-299.524]}},{"noteOn":{"time":112.265,"note":99.000,"xyz":[-147.782,278.000,-249.318]}},{"noteOn":{"time":112.320,"note":104.000,"xyz":[-108.763,338.000,54.661]}},{"noteOn":{"time":112.385,"note":107.000,"xyz":[-319.727,374.000,-372.845]}},{"noteOn":{"time":112.410,"note":109.000,"xyz":[70.123,398.000,376.757]}},{"noteOn":{"time":112.430,"note":101.000,"xyz":[15.424,302.000,-108.086]}},{"noteOn":{"time":112.550,"note":91.000,"xyz":[-25.043,182.000,448.312]}},{"noteOn":{"time":112.645,"note":105.000,"xyz":[238.417,350.000,353.574]}},{"noteOn":{"time":112.715,"note":93.000,"xyz":[-341.452,206.000,-176.694]}},{"noteOn":{"time":112.815,"note":103.000,"xyz":[-79.694,326.000,452.414]}},{"noteOn":{"time":112.880,"note":101.000,"xyz":[-197.521,302.000,268.450]}},{"noteOn":{"time":112.935,"note":92.000,"xyz":[300.729,194.000,-264.225]}},{"noteOn":{"time":112.970,"note":97.000,"xyz":[251.588,254.000,198.416]}},{"noteOn":{"time":113.000,"note":102.000,"xyz":[-226.454,314.000,180.674]}},{"noteOn":{"time":113.030,"note":95.000,"xyz":[235.292,230.000,-422.798]}},{"noteOn":{"time":113.035,"note":105.000,"xyz":[131.526,350.000,275.920]}},{"noteOn":{"time":113.110,"note":106.000,"xyz":[-189.306,362.000,-181.270]}},{"noteOn":{"time":113.160,"note":105.000,"xyz":[122.776,350.000,21.641]}},{"noteOn":{"time":113.170,"note":107.000,"xyz":[244.024,374.000,-15.056]}},{"noteOn":{"time":113.270,"note":105.000,"xyz":[249.160,350.000,-261.301]}},{"noteOn":{"time":113.360,"note":103.000,"xyz":[1.888,326.000,-382.590]}},{"noteOn":{"time":113.455,"note":95.000,"xyz":[118.112,230.000,175.132]}},{"noteOn":{"time":113.575,"note":105.000,"xyz":[-438.288,350.000,74.205]}},{"noteOn":{"time":113.610,"note":99.000,"xyz":[-183.320,278.000,412.825]}},{"noteOn":{"time":113.665,"note":102.000,"xyz":[-429.083,314.000,-149.016]}},{"noteOn":{"time":113.675,"note":91.000,"xyz":[462.678,182.000,-75.433]}},{"noteOn":{"time":113.690,"note":101.000,"xyz":[203.803,302.000,-85.745]}},{"noteOn":{"time":113.775,"note":107.000,"xyz":[-64.319,374.000,106.596]}},{"noteOn":{"time":113.790,"note":97.000,"xyz":[-116.854,254.000,39.818]}},{"noteOn":{"time":113.940,"note":99.000,"xyz":[78.706,278.000,20.389]}},{"noteOn":{"time":113.945,"note":109.000,"xyz":[-7.198,398.000,148.553]}},{"noteOn":{"time":113.960,"note":103.000,"xyz":[-193.225,326.000,-398.752]}},{"noteOn":{"time":114.025,"note":101.000,"xyz":[123.543,302.000,183.440]}},{"noteOn":{"time":114.070,"note":103.000,"xyz":[-307.751,326.000,-102.374]}},{"noteOn":{"time":114.175,"note":93.000,"xyz":[-135.576,206.000,134.705]}},{"noteOn":{"time":114.215,"note":101.000,"xyz":[258.367,302.000,322.159]}},{"noteOn":{"time":114.375,"note":93.000,"xyz":[-81.751,206.000,-153.973]}},{"noteOn":{"time":114.380,"note":95.000,"xyz":[325.439,230.000,-253.168]}},{"noteOn":{"time":114.425,"note":95.000,"xyz":[54.534,230.000,73.376]}},{"noteOn":{"time":114.510,"note":99.000,"xyz":[356.464,278.000,-79.829]}},{"noteOn":{"time":114.525,"note":100.000,"xyz":[212.705,290.000,218.044]}},{"noteOn":{"time":114.625,"note":103.000,"xyz":[46.040,326.000,72.886]}},{"noteOn":{"time":114.640,"note":99.000,"xyz":[333.018,278.000,56.962]}},{"noteOn":{"time":114.670,"note":101.000,"xyz":[-360.692,302.000,169.064]}},{"noteOn":{"time":114.720,"note":97.000,"xyz":[228.014,254.000,-166.152]}},{"noteOn":{"time":114.750,"note":101.000,"xyz":[61.435,302.000,50.337]}},{"noteOn":{"time":114.780,"note":105.000,"xyz":[168.849,350.000,0.629]}},{"noteOn":{"time":114.895,"note":109.000,"xyz":[25.980,398.000,49.143]}},{"noteOn":{"time":114.925,"note":97.000,"xyz":[134.056,254.000,-201.897]}},{"noteOn":{"time":115.195,"note":93.000,"xyz":[192.456,206.000,61.875]}},{"noteOn":{"time":115.260,"note":103.000,"xyz":[-80.793,326.000,156.261]}},{"noteOn":{"time":115.265,"note":95.000,"xyz":[-25.777,230.000,172.893]}},{"noteOn":{"time":115.355,"note":99.000,"xyz":[-320.070,278.000,-104.759]}},{"noteOn":{"time":115.380,"note":101.000,"xyz":[-260.043,302.000,383.469]}},{"noteOn":{"time":115.385,"note":99.000,"xyz":[68.988,278.000,71.045]}},{"noteOn":{"time":115.390,"note":101.000,"xyz":[113.112,302.000,-275.072]}},{"noteOn":{"time":115.410,"note":93.000,"xyz":[-344.547,206.000,117.094]}},{"noteOn":{"time":115.470,"note":96.000,"xyz":[-36.791,242.000,403.305]}},{"noteOn":{"time":115.590,"note":101.000,"xyz":[-475.265,302.000,147.136]}},{"noteOn":{"time":115.610,"note":99.000,"xyz":[-247.767,278.000,-64.417]}},{"noteOn":{"time":115.700,"note":99.000,"xyz":[64.547,278.000,61.887]}},{"noteOn":{"time":115.715,"note":96.000,"xyz":[-109.318,242.000,-406.071]}},{"noteOn":{"time":115.815,"note":109.000,"xyz":[3.311,398.000,-68.206]}},{"noteOn":{"time":115.895,"note":103.000,"xyz":[-78.577,326.000,-189.850]}},{"noteOn":{"time":116.005,"note":98.000,"xyz":[446.888,266.000,-107.772]}},{"noteOn":{"time":116.040,"note":97.000,"xyz":[-207.681,254.000,-248.917]}},{"noteOn":{"time":116.045,"note":107.000,"xyz":[157.160,374.000,198.893]}},{"noteOn":{"time":116.160,"note":97.000,"xyz":[-148.169,254.000,146.239]}},{"noteOn":{"time":116.175,"note":89.000,"xyz":[118.499,158.000,323.619]}},{"noteOn":{"time":116.175,"note":101.000,"xyz":[-98.050,302.000,-460.431]}},{"noteOn":{"time":116.215,"note":97.000,"xyz":[253.345,254.000,141.464]}},{"noteOn":{"time":116.250,"note":103.000,"xyz":[291.251,326.000,-167.408]}},{"noteOn":{"time":116.250,"note":93.000,"xyz":[13.110,206.000,454.872]}},{"noteOn":{"time":116.510,"note":111.000,"xyz":[-247.124,422.000,349.553]}},{"noteOn":{"time":116.525,"note":101.000,"xyz":[216.791,302.000,-275.552]}},{"noteOn":{"time":116.550,"note":95.000,"xyz":[28.739,230.000,85.846]}},{"noteOn":{"time":116.625,"note":94.000,"xyz":[-206.655,218.000,118.328]}},{"noteOn":{"time":116.700,"note":94.000,"xyz":[-105.748,218.000,-14.065]}},{"noteOn":{"time":116.730,"note":107.000,"xyz":[125.341,374.000,235.325]}},{"noteOn":{"time":116.730,"note":105.000,"xyz":[-78.070,350.000,84.187]}},{"noteOn":{"time":116.820,"note":99.000,"xyz":[-263.228,278.000,-102.827]}},{"noteOn":{"time":116.910,"note":100.000,"xyz":[-397.042,290.000,81.944]}},{"noteOn":{"time":116.945,"note":107.000,"xyz":[-204.926,374.000,309.439]}},{"noteOn":{"time":116.965,"note":103.000,"xyz":[-217.157,326.000,201.611]}},{"noteOn":{"time":117.005,"note":104.000,"xyz":[112.183,338.000,45.963]}},{"noteOn":{"time":117.030,"note":104.000,"xyz":[-295.593,338.000,221.352]}},{"noteOn":{"time":117.170,"note":91.000,"xyz":[-61.616,182.000,-134.759]}},{"noteOn":{"time":117.215,"note":92.000,"xyz":[61.066,194.000,98.033]}},{"noteOn":{"time":117.325,"note":109.000,"xyz":[-223.331,398.000,-191.779]}},{"noteOn":{"time":117.350,"note":95.000,"xyz":[-259.091,230.000,225.314]}},{"noteOn":{"time":117.420,"note":92.000,"xyz":[52.690,194.000,102.443]}},{"noteOn":{"time":117.425,"note":98.000,"xyz":[66.531,266.000,-81.329]}},{"noteOn":{"time":117.480,"note":105.000,"xyz":[-191.886,350.000,146.135]}},{"noteOn":{"time":117.485,"note":100.000,"xyz":[3.989,290.000,310.252]}},{"noteOn":{"time":117.545,"note":104.000,"xyz":[313.958,338.000,30.461]}},{"noteOn":{"time":117.705,"note":107.000,"xyz":[-130.735,374.000,60.950]}},{"noteOn":{"time":117.735,"note":102.000,"xyz":[-34.990,314.000,-39.724]}},{"noteOn":{"time":117.765,"note":108.000,"xyz":[-135.875,386.000,91.667]}},{"noteOn":{"time":117.905,"note":105.000,"xyz":[308.334,350.000,116.627]}},{"noteOn":{"time":117.995,"note":95.000,"xyz":[-93.251,230.000,39.638]}},{"noteOn":{"time":118.020,"note":105.000,"xyz":[427.597,350.000,157.675]}},{"noteOn":{"time":118.120,"note":100.000,"xyz":[-270.423,290.000,-327.197]}},{"noteOn":{"time":118.125,"note":101.000,"xyz":[311.293,302.000,245.574]}},{"noteOn":{"time":118.200,"note":96.000,"xyz":[143.896,242.000,106.698]}},{"noteOn":{"time":118.205,"note":102.000,"xyz":[392.435,314.000,-125.504]}},{"noteOn":{"time":118.210,"note":97.000,"xyz":[-217.371,254.000,-229.944]}},{"noteOn":{"time":118.230,"note":92.000,"xyz":[353.376,194.000,328.938]}},{"noteOn":{"time":118.235,"note":104.000,"xyz":[278.834,338.000,100.132]}},{"noteOn":{"time":118.295,"note":102.000,"xyz":[81.675,314.000,453.120]}},{"noteOn":{"time":118.425,"note":100.000,"xyz":[329.216,290.000,13.899]}},{"noteOn":{"time":118.605,"note":108.000,"xyz":[-266.425,386.000,-84.194]}},{"noteOn":{"time":118.640,"note":92.000,"xyz":[174.474,194.000,-56.988]}},{"noteOn":{"time":118.655,"note":100.000,"xyz":[161.857,290.000,368.566]}},{"noteOn":{"time":118.710,"note":110.000,"xyz":[-97.888,410.000,-37.431]}},{"noteOn":{"time":118.710,"note":100.000,"xyz":[-312.891,290.000,14.464]}},{"noteOn":{"time":118.750,"note":98.000,"xyz":[-6.214,266.000,-95.943]}},{"noteOn":{"time":118.890,"note":94.000,"xyz":[224.882,218.000,195.403]}},{"noteOn":{"time":118.990,"note":94.000,"xyz":[86.779,218.000,-11.651]}},{"noteOn":{"time":119.000,"note":102.000,"xyz":[-150.803,314.000,71.492]}},{"noteOn":{"time":119.005,"note":99.000,"xyz":[-110.595,278.000,27.004]}},{"noteOn":{"time":119.135,"note":102.000,"xyz":[-171.248,314.000,77.346]}},{"noteOn":{"time":119.165,"note":106.000,"xyz":[166.105,362.000,-267.734]}},{"noteOn":{"time":119.175,"note":98.000,"xyz":[178.736,266.000,-28.541]}},{"noteOn":{"time":119.175,"note":99.000,"xyz":[-15.636,278.000,169.467]}},{"noteOn":{"time":119.205,"note":100.000,"xyz":[-215.337,290.000,-90.686]}},{"noteOn":{"time":119.440,"note":98.000,"xyz":[-33.681,266.000,-185.669]}},{"noteOn":{"time":119.525,"note":112.000,"xyz":[-114.148,434.000,-197.159]}},{"noteOn":{"time":119.530,"note":110.000,"xyz":[27.786,410.000,357.776]}},{"noteOn":{"time":119.565,"note":100.000,"xyz":[107.230,290.000,-413.004]}},{"noteOn":{"time":119.705,"note":94.000,"xyz":[-469.672,218.000,119.471]}},{"noteOn":{"time":119.745,"note":102.000,"xyz":[297.215,314.000,244.744]}},{"noteOn":{"time":119.780,"note":100.000,"xyz":[330.551,290.000,171.083]}},{"noteOn":{"time":119.825,"note":94.000,"xyz":[-375.633,218.000,-279.270]}},{"noteOn":{"time":119.865,"note":98.000,"xyz":[209.744,266.000,-228.284]}},{"noteOn":{"time":119.890,"note":100.000,"xyz":[-421.239,290.000,-166.469]}},{"noteOn":{"time":119.945,"note":92.000,"xyz":[247.479,194.000,372.885]}},{"noteOn":{"time":119.965,"note":102.000,"xyz":[-64.648,314.000,24.890]}},{"noteOn":{"time":119.975,"note":97.000,"xyz":[482.496,254.000,58.220]}},{"noteOn":{"time":120.015,"note":96.000,"xyz":[277.626,242.000,-328.527]}},{"noteOn":{"time":120.115,"note":98.000,"xyz":[-2.216,266.000,-272.154]}},{"noteOn":{"time":120.195,"note":108.000,"xyz":[182.251,386.000,110.185]}},{"noteOn":{"time":120.210,"note":96.000,"xyz":[27.931,242.000,106.687]}},{"noteOn":{"time":120.335,"note":112.000,"xyz":[-160.237,434.000,174.758]}},{"noteOn":{"time":120.415,"note":102.000,"xyz":[59.380,314.000,188.936]}},{"noteOn":{"time":120.530,"note":99.000,"xyz":[170.689,278.000,321.074]}},{"noteOn":{"time":120.535,"note":110.000,"xyz":[419.405,410.000,-178.726]}},{"noteOn":{"time":120.580,"note":104.000,"xyz":[248.056,338.000,-299.435]}},{"noteOn":{"time":120.645,"note":100.000,"xyz":[82.982,290.000,-26.756]}},{"noteOn":{"time":120.675,"note":104.000,"xyz":[57.705,338.000,-55.382]}},{"noteOn":{"time":120.675,"note":96.000,"xyz":[2.441,242.000,155.625]}},{"noteOn":{"time":120.725,"note":102.000,"xyz":[-205.847,314.000,-154.673]}},{"noteOn":{"time":120.740,"note":102.000,"xyz":[-465.180,314.000,-118.071]}},{"noteOn":{"time":120.785,"note":90.000,"xyz":[241.713,170.000,134.181]}},{"noteOn":{"time":120.785,"note":98.000,"xyz":[276.750,266.000,158.368]}},{"noteOn":{"time":120.800,"note":92.000,"xyz":[295.224,194.000,-247.167]}},{"noteOn":{"time":121.050,"note":104.000,"xyz":[59.760,338.000,87.236]}},{"noteOn":{"time":121.115,"note":94.000,"xyz":[-53.061,218.000,89.793]}},{"noteOn":{"time":121.170,"note":93.000,"xyz":[-72.993,206.000,-13.224]}},{"noteOn":{"time":121.210,"note":93.000,"xyz":[-99.725,206.000,-232.039]}},{"noteOn":{"time":121.275,"note":106.000,"xyz":[-84.702,362.000,87.841]}},{"noteOn":{"time":121.280,"note":104.000,"xyz":[-126.865,338.000,-231.908]}},{"noteOn":{"time":121.330,"note":100.000,"xyz":[4.382,290.000,-117.076]}},{"noteOn":{"time":121.365,"note":106.000,"xyz":[-143.632,362.000,466.460]}},{"noteOn":{"time":121.405,"note":108.000,"xyz":[137.200,386.000,-340.719]}},{"noteOn":{"time":121.415,"note":100.000,"xyz":[-382.673,290.000,115.351]}},{"noteOn":{"time":121.425,"note":106.000,"xyz":[-213.713,362.000,-327.187]}},{"noteOn":{"time":121.490,"note":104.000,"xyz":[60.456,338.000,-92.001]}},{"noteOn":{"time":121.575,"note":106.000,"xyz":[-161.241,362.000,-248.141]}},{"noteOn":{"time":121.710,"note":91.000,"xyz":[122.216,182.000,194.700]}},{"noteOn":{"time":121.715,"note":92.000,"xyz":[116.288,194.000,5.066]}},{"noteOn":{"time":121.785,"note":106.000,"xyz":[-52.410,362.000,-25.197]}},{"noteOn":{"time":121.795,"note":96.000,"xyz":[175.694,242.000,155.091]}},{"noteOn":{"time":121.905,"note":99.000,"xyz":[149.520,278.000,371.800]}},{"noteOn":{"time":121.915,"note":96.000,"xyz":[-1.042,242.000,110.200]}},{"noteOn":{"time":121.945,"note":91.000,"xyz":[247.198,182.000,-108.171]}},{"noteOn":{"time":122.115,"note":108.000,"xyz":[82.695,386.000,43.208]}},{"noteOn":{"time":122.115,"note":104.000,"xyz":[-335.950,338.000,88.658]}},{"noteOn":{"time":122.125,"note":100.000,"xyz":[-144.333,290.000,-124.116]}},{"noteOn":{"time":122.165,"note":104.000,"xyz":[-245.372,338.000,370.325]}},{"noteOn":{"time":122.235,"note":104.000,"xyz":[-286.891,338.000,251.595]}},{"noteOn":{"time":122.390,"note":106.000,"xyz":[-7.556,362.000,-115.504]}},{"noteOn":{"time":122.450,"note":102.000,"xyz":[-324.702,314.000,-299.332]}},{"noteOn":{"time":122.460,"note":94.000,"xyz":[-92.634,218.000,-262.789]}},{"noteOn":{"time":122.525,"note":106.000,"xyz":[-328.612,362.000,336.052]}},{"noteOn":{"time":122.550,"note":98.000,"xyz":[-14.591,266.000,-83.720]}},{"noteOn":{"time":122.620,"note":102.000,"xyz":[-50.106,314.000,25.695]}},{"noteOn":{"time":122.630,"note":101.000,"xyz":[-215.018,302.000,-134.753]}},{"noteOn":{"time":122.650,"note":101.000,"xyz":[140.397,302.000,-444.229]}},{"noteOn":{"time":122.695,"note":104.000,"xyz":[-192.159,338.000,456.327]}},{"noteOn":{"time":122.710,"note":101.000,"xyz":[-362.224,302.000,306.022]}},{"noteOn":{"time":122.810,"note":98.000,"xyz":[-99.546,266.000,-98.838]}},{"noteOn":{"time":122.825,"note":93.000,"xyz":[61.559,206.000,-33.436]}},{"noteOn":{"time":122.870,"note":100.000,"xyz":[-226.503,290.000,80.420]}},{"noteOn":{"time":123.030,"note":92.000,"xyz":[-295.592,194.000,19.523]}},{"noteOn":{"time":123.070,"note":109.000,"xyz":[-7.644,398.000,-98.465]}},{"noteOn":{"time":123.150,"note":97.000,"xyz":[375.651,254.000,-235.249]}},{"noteOn":{"time":123.215,"note":99.000,"xyz":[-299.728,278.000,-164.059]}},{"noteOn":{"time":123.240,"note":104.000,"xyz":[190.818,338.000,201.983]}},{"noteOn":{"time":123.285,"note":99.000,"xyz":[-125.574,278.000,-314.077]}},{"noteOn":{"time":123.295,"note":108.000,"xyz":[235.901,386.000,244.462]}},{"noteOn":{"time":123.435,"note":95.000,"xyz":[-168.953,230.000,166.133]}},{"noteOn":{"time":123.450,"note":103.000,"xyz":[227.578,326.000,234.786]}},{"noteOn":{"time":123.535,"note":99.000,"xyz":[-182.363,278.000,151.755]}},{"noteOn":{"time":123.545,"note":107.000,"xyz":[282.782,374.000,-405.579]}},{"noteOn":{"time":123.575,"note":93.000,"xyz":[35.684,206.000,-187.954]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[183.127,290.000,-265.862]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[200.854,290.000,350.048]}},{"noteOn":{"time":123.645,"note":98.000,"xyz":[41.664,266.000,-54.374]}},{"noteOn":{"time":123.725,"note":111.000,"xyz":[136.561,422.000,-345.627]}},{"noteOn":{"time":123.815,"note":95.000,"xyz":[258.726,230.000,-209.091]}},{"noteOn":{"time":123.905,"note":109.000,"xyz":[213.711,398.000,-444.707]}},{"noteOn":{"time":124.050,"note":113.000,"xyz":[-149.199,446.000,216.711]}},{"noteOn":{"time":124.085,"note":101.000,"xyz":[133.783,302.000,-136.643]}},{"noteOn":{"time":124.210,"note":95.000,"xyz":[195.846,230.000,244.100]}},{"noteOn":{"time":124.275,"note":97.000,"xyz":[172.254,254.000,118.657]}},{"noteOn":{"time":124.345,"note":102.000,"xyz":[-129.079,314.000,66.191]}},{"noteOn":{"time":124.390,"note":105.000,"xyz":[210.059,350.000,-20.961]}},{"noteOn":{"time":124.420,"note":93.000,"xyz":[-240.103,206.000,129.769]}},{"noteOn":{"time":124.430,"note":97.000,"xyz":[54.848,254.000,250.691]}},{"noteOn":{"time":124.435,"note":99.000,"xyz":[81.214,278.000,253.850]}},{"noteOn":{"time":124.475,"note":103.000,"xyz":[320.753,326.000,109.908]}},{"noteOn":{"time":124.480,"note":93.000,"xyz":[-340.774,206.000,309.927]}},{"noteOn":{"time":124.495,"note":107.000,"xyz":[-441.921,374.000,2.720]}},{"noteOn":{"time":124.525,"note":98.000,"xyz":[-36.029,266.000,-100.239]}},{"noteOn":{"time":124.585,"note":101.000,"xyz":[125.506,302.000,224.944]}},{"noteOn":{"time":124.715,"note":97.000,"xyz":[158.887,254.000,280.993]}},{"noteOn":{"time":124.765,"note":101.000,"xyz":[135.465,302.000,5.056]}},{"noteOn":{"time":124.885,"note":111.000,"xyz":[-150.258,422.000,54.835]}},{"noteOn":{"time":125.060,"note":99.000,"xyz":[-404.400,278.000,-250.743]}},{"noteOn":{"time":125.080,"note":103.000,"xyz":[31.724,326.000,-94.930]}},{"noteOn":{"time":125.100,"note":100.000,"xyz":[33.237,290.000,-59.561]}},{"noteOn":{"time":125.145,"note":103.000,"xyz":[177.098,326.000,117.219]}},{"noteOn":{"time":125.170,"note":99.000,"xyz":[116.625,278.000,-160.008]}},{"noteOn":{"time":125.205,"note":101.000,"xyz":[-0.295,302.000,273.830]}},{"noteOn":{"time":125.210,"note":105.000,"xyz":[-482.484,350.000,40.511]}},{"noteOn":{"time":125.290,"note":103.000,"xyz":[-152.666,326.000,281.772]}},{"noteOn":{"time":125.325,"note":109.000,"xyz":[84.187,398.000,-479.118]}},{"noteOn":{"time":125.350,"note":91.000,"xyz":[-162.682,182.000,153.498]}},{"noteOn":{"time":125.395,"note":95.000,"xyz":[79.573,230.000,3.588]}},{"noteOn":{"time":125.410,"note":91.000,"xyz":[-12.272,182.000,-48.588]}},{"noteOn":{"time":125.525,"note":105.000,"xyz":[424.142,350.000,76.167]}},{"noteOn":{"time":125.625,"note":97.000,"xyz":[-205.938,254.000,199.482]}},{"noteOn":{"time":125.710,"note":93.000,"xyz":[212.738,206.000,-116.228]}},{"noteOn":{"time":125.755,"note":99.000,"xyz":[-69.683,278.000,7.505]}},{"noteOn":{"time":125.760,"note":92.000,"xyz":[-56.398,194.000,-144.077]}},{"noteOn":{"time":125.800,"note":95.000,"xyz":[-251.023,230.000,35.106]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[-378.649,374.000,-31.973]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[186.933,374.000,-188.032]}},{"noteOn":{"time":125.910,"note":105.000,"xyz":[3.213,350.000,100.377]}},{"noteOn":{"time":125.990,"note":105.000,"xyz":[-18.029,350.000,-259.017]}},{"noteOn":{"time":126.010,"note":101.000,"xyz":[-411.071,302.000,222.489]}},{"noteOn":{"time":126.145,"note":107.000,"xyz":[111.721,374.000,-129.989]}},{"noteOn":{"time":126.160,"note":105.000,"xyz":[119.800,350.000,362.305]}},{"noteOn":{"time":126.220,"note":91.000,"xyz":[162.019,182.000,-216.890]}},{"noteOn":{"time":126.255,"note":93.000,"xyz":[244.094,206.000,-37.984]}},{"noteOn":{"time":126.285,"note":105.000,"xyz":[-30.379,350.000,131.383]}},{"noteOn":{"time":126.350,"note":99.000,"xyz":[179.248,278.000,199.181]}},{"noteOn":{"time":126.360,"note":97.000,"xyz":[-212.651,254.000,-174.353]}},{"noteOn":{"time":126.385,"note":99.000,"xyz":[-319.793,278.000,315.281]}},{"noteOn":{"time":126.445,"note":103.000,"xyz":[-244.517,326.000,-91.257]}},{"noteOn":{"time":126.515,"note":92.000,"xyz":[279.220,194.000,100.875]}},{"noteOn":{"time":126.530,"note":107.000,"xyz":[-136.140,374.000,128.010]}},{"noteOn":{"time":126.540,"note":107.000,"xyz":[383.223,374.000,143.806]}},{"noteOn":{"time":126.640,"note":103.000,"xyz":[-7.044,326.000,151.996]}},{"noteOn":{"time":126.765,"note":99.000,"xyz":[-36.478,278.000,-287.890]}},{"noteOn":{"time":126.790,"note":103.000,"xyz":[107.585,326.000,141.930]}},{"noteOn":{"time":126.865,"note":97.000,"xyz":[-369.021,254.000,210.569]}},{"noteOn":{"time":126.925,"note":93.000,"xyz":[237.601,206.000,-47.316]}},{"noteOn":{"time":127.055,"note":105.000,"xyz":[-2.982,350.000,-165.654]}},{"noteOn":{"time":127.065,"note":101.000,"xyz":[429.581,302.000,226.943]}},{"noteOn":{"time":127.075,"note":101.000,"xyz":[51.906,302.000,43.064]}},{"noteOn":{"time":127.110,"note":109.000,"xyz":[193.629,398.000,-78.553]}},{"noteOn":{"time":127.180,"note":100.000,"xyz":[238.404,290.000,416.219]}},{"noteOn":{"time":127.185,"note":101.000,"xyz":[-128.076,302.000,-387.230]}},{"noteOn":{"time":127.210,"note":100.000,"xyz":[-277.431,290.000,-364.248]}},{"noteOn":{"time":127.320,"note":109.000,"xyz":[484.364,398.000,1.325]}},{"noteOn":{"time":127.410,"note":99.000,"xyz":[137.579,278.000,21.739]}},{"noteOn":{"time":127.420,"note":93.000,"xyz":[110.073,206.000,128.739]}},{"noteOn":{"time":127.430,"note":101.000,"xyz":[-100.548,302.000,-156.874]}},{"noteOn":{"time":127.440,"note":91.000,"xyz":[155.262,182.000,129.344]}},{"noteOn":{"time":127.540,"note":105.000,"xyz":[75.431,350.000,-177.664]}},{"noteOn":{"time":127.615,"note":94.000,"xyz":[-34.834,218.000,75.324]}},{"noteOn":{"time":127.650,"note":99.000,"xyz":[-81.599,278.000,-132.242]}},{"noteOn":{"time":127.725,"note":98.000,"xyz":[101.809,266.000,56.103]}},{"noteOn":{"time":127.745,"note":111.000,"xyz":[25.746,422.000,130.485]}},{"noteOn":{"time":127.915,"note":99.000,"xyz":[-114.813,278.000,189.011]}},{"noteOn":{"time":127.985,"note":103.000,"xyz":[-0.431,326.000,173.545]}},{"noteOn":{"time":127.990,"note":95.000,"xyz":[147.623,230.000,-62.252]}},{"noteOn":{"time":128.000,"note":101.000,"xyz":[226.058,302.000,-93.718]}},{"noteOn":{"time":128.105,"note":98.000,"xyz":[150.144,266.000,134.029]}},{"noteOn":{"time":128.130,"note":99.000,"xyz":[-416.008,278.000,249.905]}},{"noteOn":{"time":128.130,"note":104.000,"xyz":[-203.593,338.000,-165.922]}},{"noteOn":{"time":128.165,"note":92.000,"xyz":[-374.227,194.000,-65.099]}},{"noteOn":{"time":128.165,"note":103.000,"xyz":[387.442,326.000,-37.690]}},{"noteOn":{"time":128.170,"note":107.000,"xyz":[-448.906,374.000,-159.125]}},{"noteOn":{"time":128.210,"note":101.000,"xyz":[-161.859,302.000,-55.558]}},{"noteOn":{"time":128.285,"note":108.000,"xyz":[-237.569,386.000,-395.570]}},{"noteOn":{"time":128.315,"note":102.000,"xyz":[275.892,314.000,-232.783]}},{"noteOn":{"time":128.530,"note":113.000,"xyz":[434.740,446.000,-34.932]}},{"noteOn":{"time":128.680,"note":98.000,"xyz":[-331.057,266.000,69.465]}},{"noteOn":{"time":128.710,"note":96.000,"xyz":[-60.175,242.000,-44.378]}},{"noteOn":{"time":128.910,"note":102.000,"xyz":[-86.734,314.000,47.745]}},{"noteOn":{"time":128.910,"note":103.000,"xyz":[-3.354,326.000,-53.862]}},{"noteOn":{"time":128.940,"note":101.000,"xyz":[476.017,302.000,-1.639]}},{"noteOn":{"time":128.965,"note":92.000,"xyz":[67.284,194.000,449.311]}},{"noteOn":{"time":128.990,"note":97.000,"xyz":[200.598,254.000,97.127]}},{"noteOn":{"time":129.000,"note":99.000,"xyz":[14.356,278.000,182.069]}},{"noteOn":{"time":129.010,"note":94.000,"xyz":[-39.866,218.000,-66.840]}},{"noteOn":{"time":129.045,"note":104.000,"xyz":[185.016,338.000,141.013]}},{"noteOn":{"time":129.050,"note":110.000,"xyz":[160.797,410.000,313.062]}},{"noteOn":{"time":129.095,"note":98.000,"xyz":[-27.242,266.000,221.712]}},{"noteOn":{"time":129.125,"note":106.000,"xyz":[-425.606,362.000,-122.516]}},{"noteOn":{"time":129.205,"note":101.000,"xyz":[52.929,302.000,67.768]}},{"noteOn":{"time":129.225,"note":98.000,"xyz":[-104.465,266.000,7.472]}},{"noteOn":{"time":129.455,"note":98.000,"xyz":[-438.114,266.000,26.955]}},{"noteOn":{"time":129.470,"note":99.000,"xyz":[-165.076,278.000,262.012]}},{"noteOn":{"time":129.570,"note":104.000,"xyz":[124.921,338.000,308.043]}},{"noteOn":{"time":129.570,"note":100.000,"xyz":[-423.247,290.000,-152.991]}},{"noteOn":{"time":129.685,"note":100.000,"xyz":[-346.647,290.000,-198.035]}},{"noteOn":{"time":129.690,"note":101.000,"xyz":[-183.390,302.000,-155.806]}},{"noteOn":{"time":129.770,"note":106.000,"xyz":[281.498,362.000,183.853]}},{"noteOn":{"time":129.845,"note":90.000,"xyz":[162.157,170.000,460.041]}},{"noteOn":{"time":129.875,"note":96.000,"xyz":[21.276,242.000,272.483]}},{"noteOn":{"time":129.950,"note":92.000,"xyz":[37.033,194.000,59.269]}},{"noteOn":{"time":130.045,"note":106.000,"xyz":[-18.249,362.000,-175.231]}},{"noteOn":{"time":130.075,"note":104.000,"xyz":[-329.374,338.000,-326.987]}},{"noteOn":{"time":130.090,"note":108.000,"xyz":[-213.766,386.000,418.098]}},{"noteOn":{"time":130.190,"note":98.000,"xyz":[81.817,266.000,-8.638]}},{"noteOn":{"time":130.205,"note":92.000,"xyz":[116.194,194.000,179.270]}},{"noteOn":{"time":130.270,"note":100.000,"xyz":[-312.698,290.000,131.963]}},{"noteOn":{"time":130.345,"note":104.000,"xyz":[249.519,338.000,-33.241]}},{"noteOn":{"time":130.375,"note":91.000,"xyz":[135.644,182.000,109.926]}},{"noteOn":{"time":130.395,"note":102.000,"xyz":[21.465,314.000,-226.873]}},{"noteOn":{"time":130.435,"note":104.000,"xyz":[67.349,338.000,-197.816]}},{"noteOn":{"time":130.465,"note":107.000,"xyz":[-96.742,374.000,105.567]}},{"noteOn":{"time":130.480,"note":96.000,"xyz":[-330.996,242.000,55.382]}},{"noteOn":{"time":130.555,"note":100.000,"xyz":[75.094,290.000,-252.512]}},{"noteOn":{"time":130.730,"note":90.000,"xyz":[345.783,170.000,150.926]}},{"noteOn":{"time":130.815,"note":106.000,"xyz":[-52.938,362.000,446.722]}},{"noteOn":{"time":130.845,"note":96.000,"xyz":[-185.841,242.000,-344.289]}},{"noteOn":{"time":130.860,"note":106.000,"xyz":[138.756,362.000,28.529]}},{"noteOn":{"time":130.870,"note":100.000,"xyz":[-23.733,290.000,239.567]}},{"noteOn":{"time":130.940,"note":102.000,"xyz":[-54.268,314.000,91.688]}},{"noteOn":{"time":131.000,"note":106.000,"xyz":[85.311,362.000,-64.864]}},{"noteOn":{"time":131.015,"note":110.000,"xyz":[302.969,410.000,-227.590]}},{"noteOn":{"time":131.015,"note":108.000,"xyz":[215.134,386.000,390.743]}},{"noteOn":{"time":131.045,"note":98.000,"xyz":[60.285,266.000,27.270]}},{"noteOn":{"time":131.105,"note":93.000,"xyz":[-218.636,206.000,-67.231]}},{"noteOn":{"time":131.195,"note":102.000,"xyz":[-355.808,314.000,-71.927]}},{"noteOn":{"time":131.350,"note":100.000,"xyz":[127.980,290.000,-214.620]}},{"noteOn":{"time":131.355,"note":98.000,"xyz":[-54.240,266.000,-183.312]}},{"noteOn":{"time":131.515,"note":112.000,"xyz":[62.380,434.000,-35.062]}},{"noteOn":{"time":131.520,"note":108.000,"xyz":[39.505,386.000,-37.217]}},{"noteOn":{"time":131.570,"note":104.000,"xyz":[-358.087,338.000,2.103]}},{"noteOn":{"time":131.630,"note":100.000,"xyz":[214.256,290.000,-382.136]}},{"noteOn":{"time":131.685,"note":94.000,"xyz":[2.862,218.000,322.637]}},{"noteOn":{"time":131.705,"note":100.000,"xyz":[-169.729,290.000,-113.827]}},{"noteOn":{"time":131.730,"note":102.000,"xyz":[142.692,314.000,-148.437]}},{"noteOn":{"time":131.750,"note":99.000,"xyz":[235.002,278.000,-257.991]}},{"noteOn":{"time":131.885,"note":102.000,"xyz":[29.421,314.000,222.655]}},{"noteOn":{"time":131.935,"note":100.000,"xyz":[-79.459,290.000,76.135]}},{"noteOn":{"time":131.935,"note":110.000,"xyz":[-87.760,410.000,-286.900]}},{"noteOn":{"time":131.965,"note":94.000,"xyz":[-274.870,218.000,180.185]}},{"noteOn":{"time":132.025,"note":98.000,"xyz":[-226.821,266.000,86.069]}},{"noteOn":{"time":132.060,"note":114.000,"xyz":[-327.095,458.000,57.819]}},{"noteOn":{"time":132.065,"note":110.000,"xyz":[-347.388,410.000,-232.201]}},{"noteOn":{"time":132.150,"note":102.000,"xyz":[-11.496,314.000,-86.968]}},{"noteOn":{"time":132.165,"note":106.000,"xyz":[-217.608,362.000,-98.502]}},{"noteOn":{"time":132.230,"note":97.000,"xyz":[160.229,254.000,123.988]}},{"noteOn":{"time":132.285,"note":104.000,"xyz":[-169.174,338.000,-33.909]}},{"noteOn":{"time":132.360,"note":98.000,"xyz":[46.844,266.000,-75.760]}},{"noteOn":{"time":132.485,"note":96.000,"xyz":[95.655,242.000,-6.897]}},{"noteOn":{"time":132.535,"note":102.000,"xyz":[-286.518,314.000,68.241]}},{"noteOn":{"time":132.635,"note":100.000,"xyz":[250.401,290.000,-218.768]}},{"noteOn":{"time":132.650,"note":102.000,"xyz":[-64.429,314.000,172.629]}},{"noteOn":{"time":132.695,"note":97.000,"xyz":[282.055,254.000,-164.414]}},{"noteOn":{"time":132.695,"note":92.000,"xyz":[435.569,194.000,-50.275]}},{"noteOn":{"time":132.755,"note":108.000,"xyz":[270.241,386.000,-147.880]}},{"noteOn":{"time":132.775,"note":104.000,"xyz":[96.048,338.000,42.388]}},{"noteOn":{"time":132.915,"note":108.000,"xyz":[133.057,386.000,-31.878]}},{"noteOn":{"time":133.045,"note":104.000,"xyz":[116.095,338.000,374.280]}},{"noteOn":{"time":133.050,"note":112.000,"xyz":[-331.543,434.000,-287.536]}},{"noteOn":{"time":133.155,"note":101.000,"xyz":[257.003,302.000,-97.332]}},{"noteOn":{"time":133.205,"note":97.000,"xyz":[-77.129,254.000,-297.878]}},{"noteOn":{"time":133.235,"note":104.000,"xyz":[-128.431,338.000,-110.946]}},{"noteOn":{"time":133.315,"note":102.000,"xyz":[77.500,314.000,342.138]}},{"noteOn":{"time":133.405,"note":100.000,"xyz":[-440.640,290.000,211.064]}},{"noteOn":{"time":133.415,"note":92.000,"xyz":[-67.444,194.000,-222.767]}},{"noteOn":{"time":133.445,"note":96.000,"xyz":[-360.282,242.000,247.486]}},{"noteOn":{"time":133.470,"note":98.000,"xyz":[216.177,266.000,-175.662]}},{"noteOn":{"time":133.490,"note":95.000,"xyz":[-241.132,230.000,-287.675]}},{"noteOn":{"time":133.630,"note":106.000,"xyz":[-23.325,362.000,-44.358]}},{"noteOn":{"time":133.640,"note":105.000,"xyz":[-445.049,350.000,-125.012]}},{"noteOn":{"time":133.665,"note":99.000,"xyz":[431.433,278.000,-48.401]}},{"noteOn":{"time":133.735,"note":99.000,"xyz":[-369.646,278.000,-66.189]}},{"noteOn":{"time":133.790,"note":99.000,"xyz":[-70.960,278.000,-450.959]}},{"noteOn":{"time":133.820,"note":106.000,"xyz":[67.025,362.000,-466.255]}},{"noteOn":{"time":133.920,"note":110.000,"xyz":[208.748,410.000,366.642]}},{"noteOn":{"time":134.065,"note":98.000,"xyz":[19.656,266.000,-195.016]}},{"noteOn":{"time":134.105,"note":99.000,"xyz":[-218.069,278.000,307.556]}},{"noteOn":{"time":134.110,"note":108.000,"xyz":[-128.864,386.000,-73.760]}},{"noteOn":{"time":134.140,"note":100.000,"xyz":[291.466,290.000,-238.032]}},{"noteOn":{"time":134.170,"note":96.000,"xyz":[-185.725,242.000,245.455]}},{"noteOn":{"time":134.215,"note":106.000,"xyz":[207.811,362.000,-340.072]}},{"noteOn":{"time":134.255,"note":89.000,"xyz":[-2.717,158.000,-189.715]}},{"noteOn":{"time":134.280,"note":101.000,"xyz":[-62.497,302.000,-142.349]}},{"noteOn":{"time":134.450,"note":103.000,"xyz":[-331.538,326.000,-347.000]}},{"noteOn":{"time":134.480,"note":108.000,"xyz":[-202.288,386.000,4.921]}},{"noteOn":{"time":134.515,"note":105.000,"xyz":[24.219,350.000,44.426]}},{"noteOn":{"time":134.575,"note":106.000,"xyz":[411.534,362.000,-233.098]}},{"noteOn":{"time":134.665,"note":97.000,"xyz":[224.110,254.000,250.133]}},{"noteOn":{"time":134.690,"note":101.000,"xyz":[-302.642,302.000,160.551]}},{"noteOn":{"time":134.690,"note":103.000,"xyz":[-473.167,326.000,-142.228]}},{"noteOn":{"time":134.705,"note":91.000,"xyz":[-273.975,182.000,185.313]}},{"noteOn":{"time":134.875,"note":108.000,"xyz":[-401.093,386.000,-100.038]}},{"noteOn":{"time":134.890,"note":103.000,"xyz":[-67.063,326.000,-330.323]}},{"noteOn":{"time":134.985,"note":91.000,"xyz":[-8.280,182.000,51.486]}},{"noteOn":{"time":135.010,"note":99.000,"xyz":[32.612,278.000,-308.297]}},{"noteOn":{"time":135.020,"note":105.000,"xyz":[35.951,350.000,79.657]}},{"noteOn":{"time":135.030,"note":107.000,"xyz":[-83.385,374.000,-103.766]}},{"noteOn":{"time":135.045,"note":96.000,"xyz":[120.972,242.000,137.527]}},{"noteOn":{"time":135.195,"note":105.000,"xyz":[131.736,350.000,40.108]}},{"noteOn":{"time":135.235,"note":91.000,"xyz":[202.135,182.000,-353.127]}},{"noteOn":{"time":135.250,"note":109.000,"xyz":[-131.025,398.000,-302.123]}},{"noteOn":{"time":135.345,"note":101.000,"xyz":[26.469,302.000,299.728]}},{"noteOn":{"time":135.350,"note":95.000,"xyz":[216.980,230.000,-102.792]}},{"noteOn":{"time":135.405,"note":101.000,"xyz":[75.172,302.000,-61.725]}},{"noteOn":{"time":135.545,"note":101.000,"xyz":[-141.156,302.000,291.447]}},{"noteOn":{"time":135.595,"note":106.000,"xyz":[105.000,362.000,-393.416]}},{"noteOn":{"time":135.615,"note":101.000,"xyz":[-65.576,302.000,-64.604]}},{"noteOn":{"time":135.695,"note":94.000,"xyz":[24.978,218.000,257.360]}},{"noteOn":{"time":135.730,"note":99.000,"xyz":[97.086,278.000,-41.188]}},{"noteOn":{"time":135.750,"note":99.000,"xyz":[-80.939,278.000,-70.727]}},{"noteOn":{"time":135.855,"note":97.000,"xyz":[-340.954,254.000,-29.341]}},{"noteOn":{"time":135.915,"note":113.000,"xyz":[-232.731,446.000,201.097]}},{"noteOn":{"time":136.000,"note":109.000,"xyz":[-89.206,398.000,86.628]}},{"noteOn":{"time":136.050,"note":103.000,"xyz":[-28.393,326.000,223.383]}},{"noteOn":{"time":136.200,"note":99.000,"xyz":[-418.539,278.000,110.069]}},{"noteOn":{"time":136.250,"note":111.000,"xyz":[-109.895,422.000,-279.992]}},{"noteOn":{"time":136.270,"note":99.000,"xyz":[284.209,278.000,251.944]}},{"noteOn":{"time":136.280,"note":93.000,"xyz":[-321.080,206.000,139.245]}},{"noteOn":{"time":136.315,"note":103.000,"xyz":[-90.806,326.000,-121.965]}},{"noteOn":{"time":136.315,"note":98.000,"xyz":[62.437,266.000,478.865]}},{"noteOn":{"time":136.345,"note":101.000,"xyz":[-68.182,302.000,9.921]}},{"noteOn":{"time":136.420,"note":95.000,"xyz":[144.208,230.000,-314.428]}},{"noteOn":{"time":136.425,"note":107.000,"xyz":[74.351,374.000,-27.326]}},{"noteOn":{"time":136.445,"note":103.000,"xyz":[54.961,326.000,-24.255]}},{"noteOn":{"time":136.685,"note":99.000,"xyz":[135.281,278.000,195.009]}},{"noteOn":{"time":136.740,"note":97.000,"xyz":[-25.564,254.000,-171.070]}},{"noteOn":{"time":136.760,"note":113.000,"xyz":[361.158,446.000,213.486]}},{"noteOn":{"time":136.825,"note":101.000,"xyz":[0.913,302.000,187.323]}},{"noteOn":{"time":136.865,"note":111.000,"xyz":[-97.281,422.000,-52.828]}},{"noteOn":{"time":136.880,"note":97.000,"xyz":[236.783,254.000,-349.222]}},{"noteOn":{"time":136.945,"note":97.000,"xyz":[398.066,254.000,239.585]}},{"noteOn":{"time":136.970,"note":103.000,"xyz":[33.101,326.000,50.113]}},{"noteOn":{"time":137.045,"note":109.000,"xyz":[51.360,398.000,-4.723]}},{"noteOn":{"time":137.130,"note":103.000,"xyz":[125.931,326.000,-148.151]}},{"noteOn":{"time":137.230,"note":93.000,"xyz":[-274.700,206.000,-251.962]}},{"noteOn":{"time":137.240,"note":109.000,"xyz":[-160.922,398.000,337.427]}},{"noteOn":{"time":137.285,"note":96.000,"xyz":[-261.383,242.000,-290.226]}},{"noteOn":{"time":137.355,"note":105.000,"xyz":[-240.585,350.000,-232.011]}},{"noteOn":{"time":137.405,"note":105.000,"xyz":[-7.513,350.000,191.944]}},{"noteOn":{"time":137.545,"note":107.000,"xyz":[-39.476,374.000,69.156]}},{"noteOn":{"time":137.575,"note":111.000,"xyz":[117.531,422.000,196.959]}},{"noteOn":{"time":137.615,"note":101.000,"xyz":[20.698,302.000,137.103]}},{"noteOn":{"time":137.635,"note":105.000,"xyz":[-241.498,350.000,132.062]}},{"noteOn":{"time":137.700,"note":97.000,"xyz":[-139.126,254.000,-173.589]}},{"noteOn":{"time":137.810,"note":99.000,"xyz":[-247.862,278.000,-431.021]}},{"noteOn":{"time":137.830,"note":91.000,"xyz":[326.465,182.000,-123.088]}},{"noteOn":{"time":137.920,"note":95.000,"xyz":[200.017,230.000,-113.643]}},{"noteOn":{"time":137.930,"note":101.000,"xyz":[-166.007,302.000,-76.611]}},{"noteOn":{"time":137.965,"note":95.000,"xyz":[497.446,230.000,31.484]}},{"noteOn":{"time":138.045,"note":103.000,"xyz":[-212.328,326.000,148.706]}},{"noteOn":{"time":138.170,"note":99.000,"xyz":[-39.968,278.000,-251.350]}},{"noteOn":{"time":138.195,"note":105.000,"xyz":[231.414,350.000,318.635]}},{"noteOn":{"time":138.230,"note":100.000,"xyz":[12.908,290.000,-65.770]}},{"noteOn":{"time":138.245,"note":100.000,"xyz":[436.349,290.000,-59.512]}},{"noteOn":{"time":138.255,"note":103.000,"xyz":[225.083,326.000,262.254]}},{"noteOn":{"time":138.325,"note":107.000,"xyz":[-19.906,374.000,83.261]}},{"noteOn":{"time":138.350,"note":109.000,"xyz":[-325.063,398.000,-12.402]}},{"noteOn":{"time":138.495,"note":97.000,"xyz":[142.844,254.000,-200.283]}},{"noteOn":{"time":138.530,"note":99.000,"xyz":[-271.073,278.000,-105.476]}},{"noteOn":{"time":138.535,"note":105.000,"xyz":[1.609,350.000,-159.253]}},{"noteOn":{"time":138.625,"note":89.000,"xyz":[376.219,158.000,-61.097]}},{"noteOn":{"time":138.650,"note":100.000,"xyz":[-34.525,290.000,141.132]}},{"noteOn":{"time":138.660,"note":97.000,"xyz":[50.451,254.000,109.902]}},{"noteOn":{"time":138.725,"note":101.000,"xyz":[-88.373,302.000,-23.007]}},{"noteOn":{"time":138.745,"note":105.000,"xyz":[88.600,350.000,59.606]}},{"noteOn":{"time":138.755,"note":105.000,"xyz":[70.190,350.000,76.564]}},{"noteOn":{"time":138.780,"note":107.000,"xyz":[-82.667,374.000,-182.643]}},{"noteOn":{"time":138.860,"note":107.000,"xyz":[217.173,374.000,-108.876]}},{"noteOn":{"time":138.870,"note":102.000,"xyz":[454.132,314.000,184.462]}},{"noteOn":{"time":139.055,"note":107.000,"xyz":[294.127,374.000,357.342]}},{"noteOn":{"time":139.145,"note":96.000,"xyz":[-189.044,242.000,225.674]}},{"noteOn":{"time":139.200,"note":90.000,"xyz":[24.109,170.000,-100.143]}},{"noteOn":{"time":139.285,"note":107.000,"xyz":[-347.389,374.000,201.673]}},{"noteOn":{"time":139.365,"note":103.000,"xyz":[385.382,326.000,-49.942]}},{"noteOn":{"time":139.370,"note":105.000,"xyz":[139.322,350.000,-131.422]}},{"noteOn":{"time":139.395,"note":103.000,"xyz":[-130.915,326.000,468.164]}},{"noteOn":{"time":139.425,"note":99.000,"xyz":[49.324,278.000,-44.011]}},{"noteOn":{"time":139.490,"note":97.000,"xyz":[-260.208,254.000,-366.373]}},{"noteOn":{"time":139.520,"note":108.000,"xyz":[-162.510,386.000,451.597]}},{"noteOn":{"time":139.600,"note":92.000,"xyz":[-465.185,194.000,-77.880]}},{"noteOn":{"time":139.635,"note":102.000,"xyz":[-3.369,314.000,83.667]}},{"noteOn":{"time":139.645,"note":103.000,"xyz":[-228.606,326.000,-362.433]}},{"noteOn":{"time":139.730,"note":109.000,"xyz":[61.366,398.000,118.252]}},{"noteOn":{"time":139.745,"note":92.000,"xyz":[31.797,194.000,44.963]}},{"noteOn":{"time":139.765,"note":105.000,"xyz":[-264.634,350.000,105.004]}},{"noteOn":{"time":139.935,"note":102.000,"xyz":[221.249,314.000,32.477]}},{"noteOn":{"time":140.075,"note":109.000,"xyz":[163.108,398.000,-413.095]}},{"noteOn":{"time":140.105,"note":100.000,"xyz":[46.217,290.000,-39.991]}},{"noteOn":{"time":140.175,"note":101.000,"xyz":[-225.250,302.000,21.521]}},{"noteOn":{"time":140.195,"note":105.000,"xyz":[44.763,350.000,-128.128]}},{"noteOn":{"time":140.245,"note":100.000,"xyz":[167.637,290.000,94.876]}},{"noteOn":{"time":140.285,"note":94.000,"xyz":[-167.245,218.000,108.558]}},{"noteOn":{"time":140.295,"note":99.000,"xyz":[59.626,278.000,-125.895]}},{"noteOn":{"time":140.310,"note":96.000,"xyz":[338.758,242.000,-23.671]}},{"noteOn":{"time":140.385,"note":94.000,"xyz":[-409.378,218.000,-266.256]}},{"noteOn":{"time":140.425,"note":114.000,"xyz":[199.250,458.000,225.481]}},{"noteOn":{"time":140.495,"note":98.000,"xyz":[-84.088,266.000,313.185]}},{"noteOn":{"time":140.580,"note":103.000,"xyz":[441.473,326.000,174.826]}},{"noteOn":{"time":140.690,"note":108.000,"xyz":[-39.219,386.000,-134.602]}},{"noteOn":{"time":140.700,"note":98.000,"xyz":[66.445,266.000,25.042]}},{"noteOn":{"time":140.755,"note":101.000,"xyz":[137.433,302.000,-43.432]}},{"noteOn":{"time":140.835,"note":96.000,"xyz":[-67.709,242.000,119.716]}},{"noteOn":{"time":140.885,"note":97.000,"xyz":[165.900,254.000,-256.668]}},{"noteOn":{"time":140.890,"note":112.000,"xyz":[-77.780,434.000,-141.128]}},{"noteOn":{"time":140.900,"note":104.000,"xyz":[-223.632,338.000,296.945]}},{"noteOn":{"time":140.925,"note":104.000,"xyz":[153.410,338.000,120.641]}},{"noteOn":{"time":140.955,"note":98.000,"xyz":[337.664,266.000,-196.853]}},{"noteOn":{"time":141.050,"note":110.000,"xyz":[148.157,410.000,-234.570]}},{"noteOn":{"time":141.200,"note":112.000,"xyz":[25.178,434.000,83.068]}},{"noteOn":{"time":141.250,"note":96.000,"xyz":[26.372,242.000,207.413]}},{"noteOn":{"time":141.315,"note":100.000,"xyz":[-23.746,290.000,98.744]}},{"noteOn":{"time":141.375,"note":94.000,"xyz":[-265.245,218.000,265.948]}},{"noteOn":{"time":141.405,"note":98.000,"xyz":[-32.895,266.000,-57.529]}},{"noteOn":{"time":141.450,"note":102.000,"xyz":[-310.912,314.000,-383.792]}},{"noteOn":{"time":141.470,"note":96.000,"xyz":[52.060,242.000,-383.845]}},{"noteOn":{"time":141.560,"note":108.000,"xyz":[-21.222,386.000,-167.456]}},{"noteOn":{"time":141.660,"note":108.000,"xyz":[-135.481,386.000,-321.298]}},{"noteOn":{"time":141.725,"note":106.000,"xyz":[-158.122,362.000,117.245]}},{"noteOn":{"time":141.730,"note":103.000,"xyz":[-297.178,326.000,-246.394]}},{"noteOn":{"time":141.760,"note":94.000,"xyz":[149.425,218.000,-91.191]}},{"noteOn":{"time":141.820,"note":102.000,"xyz":[-277.373,314.000,332.881]}},{"noteOn":{"time":141.875,"note":95.000,"xyz":[-158.699,230.000,320.360]}},{"noteOn":{"time":141.920,"note":106.000,"xyz":[223.922,362.000,-40.610]}},{"noteOn":{"time":141.990,"note":106.000,"xyz":[-282.997,362.000,123.473]}},{"noteOn":{"time":142.055,"note":110.000,"xyz":[-338.353,410.000,-82.165]}},{"noteOn":{"time":142.105,"note":106.000,"xyz":[-345.610,362.000,-8.772]}},{"noteOn":{"time":142.155,"note":102.000,"xyz":[62.926,314.000,-70.508]}},{"noteOn":{"time":142.200,"note":98.000,"xyz":[-248.887,266.000,-226.432]}},{"noteOn":{"time":142.235,"note":98.000,"xyz":[-15.558,266.000,-228.493]}},{"noteOn":{"time":142.245,"note":90.000,"xyz":[175.455,170.000,-339.235]}},{"noteOn":{"time":142.270,"note":104.000,"xyz":[303.810,338.000,-60.144]}},{"noteOn":{"time":142.365,"note":96.000,"xyz":[189.221,242.000,24.295]}},{"noteOn":{"time":142.440,"note":96.000,"xyz":[-74.342,242.000,127.951]}},{"noteOn":{"time":142.510,"note":100.000,"xyz":[155.390,290.000,-32.376]}},{"noteOn":{"time":142.525,"note":104.000,"xyz":[225.689,338.000,-23.475]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[1.308,386.000,459.751]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[392.812,386.000,253.108]}},{"noteOn":{"time":142.755,"note":100.000,"xyz":[-25.608,290.000,129.223]}},{"noteOn":{"time":142.775,"note":104.000,"xyz":[97.068,338.000,412.333]}},{"noteOn":{"time":142.800,"note":101.000,"xyz":[139.081,302.000,371.376]}},{"noteOn":{"time":142.860,"note":106.000,"xyz":[486.423,362.000,51.400]}},{"noteOn":{"time":142.885,"note":104.000,"xyz":[19.870,338.000,-98.478]}},{"noteOn":{"time":142.930,"note":112.000,"xyz":[176.919,434.000,82.223]}},{"noteOn":{"time":142.945,"note":98.000,"xyz":[-402.524,266.000,-278.338]}},{"noteOn":{"time":142.950,"note":98.000,"xyz":[236.644,266.000,-69.587]}},{"noteOn":{"time":142.995,"note":90.000,"xyz":[368.159,170.000,325.987]}},{"noteOn":{"time":143.110,"note":100.000,"xyz":[-150.322,290.000,60.525]}},{"noteOn":{"time":143.195,"note":96.000,"xyz":[181.982,242.000,80.628]}},{"noteOn":{"time":143.280,"note":102.000,"xyz":[310.051,314.000,45.237]}},{"noteOn":{"time":143.335,"note":106.000,"xyz":[418.999,362.000,1.510]}},{"noteOn":{"time":143.460,"note":103.000,"xyz":[-270.319,326.000,375.839]}},{"noteOn":{"time":143.470,"note":102.000,"xyz":[-190.735,314.000,-390.765]}},{"noteOn":{"time":143.555,"note":106.000,"xyz":[-364.070,362.000,293.857]}},{"noteOn":{"time":143.580,"note":108.000,"xyz":[-169.658,386.000,167.320]}},{"noteOn":{"time":143.620,"note":96.000,"xyz":[-407.116,242.000,203.451]}},{"noteOn":{"time":143.625,"note":106.000,"xyz":[-198.083,362.000,-68.908]}},{"noteOn":{"time":143.700,"note":91.000,"xyz":[-114.968,182.000,-39.055]}},{"noteOn":{"time":143.765,"note":106.000,"xyz":[181.750,362.000,100.500]}},{"noteOn":{"time":143.815,"note":98.000,"xyz":[148.440,266.000,-74.061]}},{"noteOn":{"time":143.835,"note":98.000,"xyz":[-102.364,266.000,-84.988]}},{"noteOn":{"time":143.835,"note":114.000,"xyz":[85.342,458.000,-264.226]}},{"noteOn":{"time":143.920,"note":100.000,"xyz":[-252.965,290.000,-265.000]}},{"noteOn":{"time":143.925,"note":102.000,"xyz":[65.086,314.000,-52.959]}},{"noteOn":{"time":144.070,"note":104.000,"xyz":[-144.273,338.000,-25.651]}},{"noteOn":{"time":144.155,"note":100.000,"xyz":[113.972,290.000,27.365]}},{"noteOn":{"time":144.175,"note":102.000,"xyz":[83.726,314.000,165.979]}},{"noteOn":{"time":144.210,"note":93.000,"xyz":[203.469,206.000,-209.486]}},{"noteOn":{"time":144.260,"note":93.000,"xyz":[37.860,206.000,-157.538]}},{"noteOn":{"time":144.315,"note":108.000,"xyz":[337.494,386.000,122.649]}},{"noteOn":{"time":144.355,"note":104.000,"xyz":[-47.767,338.000,-371.563]}},{"noteOn":{"time":144.465,"note":103.000,"xyz":[117.883,326.000,165.979]}},{"noteOn":{"time":144.550,"note":110.000,"xyz":[-339.614,410.000,-248.395]}},{"noteOn":{"time":144.585,"note":104.000,"xyz":[370.941,338.000,160.510]}},{"noteOn":{"time":144.670,"note":104.000,"xyz":[-46.720,338.000,-38.156]}},{"noteOn":{"time":144.675,"note":110.000,"xyz":[-215.119,410.000,-214.772]}},{"noteOn":{"time":144.690,"note":100.000,"xyz":[91.019,290.000,194.826]}},{"noteOn":{"time":144.745,"note":100.000,"xyz":[-337.548,290.000,-177.081]}},{"noteOn":{"time":144.770,"note":96.000,"xyz":[-178.532,242.000,-441.297]}},{"noteOn":{"time":144.850,"note":102.000,"xyz":[-212.881,314.000,154.102]}},{"noteOn":{"time":144.875,"note":95.000,"xyz":[317.645,230.000,-271.095]}},{"noteOn":{"time":144.890,"note":100.000,"xyz":[37.841,290.000,495.499]}},{"noteOn":{"time":144.975,"note":110.000,"xyz":[70.751,410.000,31.630]}},{"noteOn":{"time":145.025,"note":114.000,"xyz":[-107.069,458.000,-131.104]}},{"noteOn":{"time":145.060,"note":102.000,"xyz":[281.830,314.000,43.592]}},{"noteOn":{"time":145.085,"note":98.000,"xyz":[-155.699,266.000,44.647]}},{"noteOn":{"time":145.200,"note":97.000,"xyz":[-72.372,254.000,-242.665]}},{"noteOn":{"time":145.295,"note":96.000,"xyz":[190.035,242.000,-346.999]}},{"noteOn":{"time":145.300,"note":102.000,"xyz":[-302.230,314.000,116.676]}},{"noteOn":{"time":145.320,"note":108.000,"xyz":[97.460,386.000,141.602]}},{"noteOn":{"time":145.445,"note":103.000,"xyz":[8.632,326.000,113.830]}},{"noteOn":{"time":145.455,"note":97.000,"xyz":[-19.321,254.000,100.837]}},{"noteOn":{"time":145.455,"note":107.000,"xyz":[150.068,374.000,216.488]}},{"noteOn":{"time":145.480,"note":112.000,"xyz":[-79.781,434.000,1.011]}},{"noteOn":{"time":145.485,"note":104.000,"xyz":[-220.076,338.000,50.336]}},{"noteOn":{"time":145.490,"note":106.000,"xyz":[-43.350,362.000,-172.774]}},{"noteOn":{"time":145.525,"note":98.000,"xyz":[-140.270,266.000,-307.062]}},{"noteOn":{"time":145.575,"note":102.000,"xyz":[-46.968,314.000,32.520]}},{"noteOn":{"time":145.635,"note":112.000,"xyz":[331.367,434.000,-265.149]}},{"noteOn":{"time":145.650,"note":101.000,"xyz":[254.043,302.000,10.595]}},{"noteOn":{"time":145.685,"note":93.000,"xyz":[352.619,206.000,-86.389]}},{"noteOn":{"time":145.765,"note":95.000,"xyz":[-129.542,230.000,-241.636]}},{"noteOn":{"time":145.910,"note":99.000,"xyz":[87.576,278.000,-227.724]}},{"noteOn":{"time":146.035,"note":105.000,"xyz":[21.536,350.000,84.850]}},{"noteOn":{"time":146.070,"note":107.000,"xyz":[-43.494,374.000,-421.870]}},{"noteOn":{"time":146.090,"note":103.000,"xyz":[-172.549,326.000,-116.315]}},{"noteOn":{"time":146.135,"note":107.000,"xyz":[-167.403,374.000,158.927]}},{"noteOn":{"time":146.140,"note":104.000,"xyz":[-289.018,338.000,-279.579]}},{"noteOn":{"time":146.160,"note":96.000,"xyz":[219.242,242.000,-139.348]}},{"noteOn":{"time":146.250,"note":95.000,"xyz":[-178.779,230.000,62.493]}},{"noteOn":{"time":146.295,"note":105.000,"xyz":[52.588,350.000,290.873]}},{"noteOn":{"time":146.435,"note":109.000,"xyz":[-25.378,398.000,482.101]}},{"noteOn":{"time":146.445,"note":95.000,"xyz":[157.349,230.000,88.538]}},{"noteOn":{"time":146.460,"note":107.000,"xyz":[472.432,374.000,-125.005]}},{"noteOn":{"time":146.535,"note":109.000,"xyz":[-105.994,398.000,2.032]}},{"noteOn":{"time":146.585,"note":95.000,"xyz":[418.106,230.000,-160.072]}},{"noteOn":{"time":146.670,"note":105.000,"xyz":[-102.203,350.000,46.638]}},{"noteOn":{"time":146.695,"note":101.000,"xyz":[74.682,302.000,393.866]}},{"noteOn":{"time":146.700,"note":99.000,"xyz":[392.074,278.000,71.833]}},{"noteOn":{"time":146.705,"note":89.000,"xyz":[369.384,158.000,-183.522]}},{"noteOn":{"time":146.810,"note":105.000,"xyz":[366.396,350.000,-97.503]}},{"noteOn":{"time":146.830,"note":98.000,"xyz":[-11.065,266.000,191.178]}},{"noteOn":{"time":146.875,"note":97.000,"xyz":[119.503,254.000,-121.316]}},{"noteOn":{"time":146.910,"note":107.000,"xyz":[485.369,374.000,74.041]}},{"noteOn":{"time":146.925,"note":97.000,"xyz":[-194.608,254.000,-30.991]}},{"noteOn":{"time":147.145,"note":107.000,"xyz":[-75.669,374.000,13.989]}},{"noteOn":{"time":147.155,"note":103.000,"xyz":[299.648,326.000,72.712]}},{"noteOn":{"time":147.205,"note":109.000,"xyz":[-184.972,398.000,15.019]}},{"noteOn":{"time":147.265,"note":101.000,"xyz":[-302.485,302.000,-34.372]}},{"noteOn":{"time":147.330,"note":103.000,"xyz":[-345.602,326.000,-26.411]}},{"noteOn":{"time":147.350,"note":102.000,"xyz":[-172.859,314.000,8.365]}},{"noteOn":{"time":147.410,"note":91.000,"xyz":[70.764,182.000,-65.508]}},{"noteOn":{"time":147.425,"note":97.000,"xyz":[91.978,254.000,-346.670]}},{"noteOn":{"time":147.455,"note":101.000,"xyz":[44.225,302.000,-91.709]}},{"noteOn":{"time":147.470,"note":107.000,"xyz":[-97.237,374.000,-50.863]}},{"noteOn":{"time":147.585,"note":101.000,"xyz":[-154.595,302.000,-376.042]}},{"noteOn":{"time":147.610,"note":97.000,"xyz":[-254.973,254.000,372.671]}},{"noteOn":{"time":147.645,"note":105.000,"xyz":[92.484,350.000,-69.832]}},{"noteOn":{"time":147.665,"note":99.000,"xyz":[85.571,278.000,152.436]}},{"noteOn":{"time":147.690,"note":103.000,"xyz":[-412.554,326.000,-98.375]}},{"noteOn":{"time":147.895,"note":105.000,"xyz":[-229.854,350.000,291.872]}},{"noteOn":{"time":148.010,"note":113.000,"xyz":[342.160,446.000,199.316]}},{"noteOn":{"time":148.035,"note":102.000,"xyz":[-168.540,314.000,-145.999]}},{"noteOn":{"time":148.060,"note":109.000,"xyz":[495.969,398.000,2.313]}},{"noteOn":{"time":148.090,"note":107.000,"xyz":[435.953,374.000,-37.605]}},{"noteOn":{"time":148.140,"note":99.000,"xyz":[185.150,278.000,-116.843]}},{"noteOn":{"time":148.150,"note":95.000,"xyz":[-425.769,230.000,-253.141]}},{"noteOn":{"time":148.200,"note":91.000,"xyz":[-494.116,182.000,-10.692]}},{"noteOn":{"time":148.295,"note":97.000,"xyz":[229.157,254.000,-27.349]}},{"noteOn":{"time":148.325,"note":99.000,"xyz":[-201.377,278.000,-287.752]}},{"noteOn":{"time":148.365,"note":105.000,"xyz":[103.713,350.000,130.306]}},{"noteOn":{"time":148.485,"note":101.000,"xyz":[93.838,302.000,222.774]}},{"noteOn":{"time":148.525,"note":115.000,"xyz":[-449.324,470.000,96.940]}},{"noteOn":{"time":148.560,"note":99.000,"xyz":[332.016,278.000,-125.447]}},{"noteOn":{"time":148.580,"note":101.000,"xyz":[11.692,302.000,400.563]}},{"noteOn":{"time":148.595,"note":103.000,"xyz":[60.101,326.000,-20.284]}},{"noteOn":{"time":148.675,"note":111.000,"xyz":[135.199,422.000,-36.758]}},{"noteOn":{"time":148.770,"note":103.000,"xyz":[359.665,326.000,-117.853]}},{"noteOn":{"time":148.770,"note":93.000,"xyz":[-338.623,206.000,-122.255]}},{"noteOn":{"time":148.805,"note":94.000,"xyz":[174.690,218.000,-388.809]}},{"noteOn":{"time":148.815,"note":109.000,"xyz":[332.700,398.000,-255.847]}},{"noteOn":{"time":149.050,"note":103.000,"xyz":[-204.994,326.000,-41.034]}},{"noteOn":{"time":149.080,"note":103.000,"xyz":[278.332,326.000,-113.594]}},{"noteOn":{"time":149.090,"note":101.000,"xyz":[178.161,302.000,-252.888]}},{"noteOn":{"time":149.195,"note":105.000,"xyz":[-90.290,350.000,-156.985]}},{"noteOn":{"time":149.220,"note":101.000,"xyz":[-210.554,302.000,290.122]}},{"noteOn":{"time":149.275,"note":95.000,"xyz":[2.031,230.000,-222.741]}},{"noteOn":{"time":149.315,"note":99.000,"xyz":[69.142,278.000,115.897]}},{"noteOn":{"time":149.330,"note":109.000,"xyz":[120.081,398.000,16.705]}},{"noteOn":{"time":149.330,"note":99.000,"xyz":[-53.625,278.000,-398.889]}},{"noteOn":{"time":149.335,"note":113.000,"xyz":[-19.442,446.000,281.134]}},{"noteOn":{"time":149.365,"note":99.000,"xyz":[-49.122,278.000,-11.381]}},{"noteOn":{"time":149.450,"note":96.000,"xyz":[304.429,242.000,-5.015]}},{"noteOn":{"time":149.535,"note":111.000,"xyz":[-126.063,422.000,-304.788]}},{"noteOn":{"time":149.535,"note":101.000,"xyz":[233.613,302.000,142.025]}},{"noteOn":{"time":149.700,"note":96.000,"xyz":[127.305,242.000,3.774]}},{"noteOn":{"time":149.845,"note":97.000,"xyz":[-338.437,254.000,25.542]}},{"noteOn":{"time":149.875,"note":107.000,"xyz":[135.664,374.000,-158.740]}},{"noteOn":{"time":149.900,"note":103.000,"xyz":[225.413,326.000,39.093]}},{"noteOn":{"time":149.930,"note":105.000,"xyz":[291.152,350.000,186.617]}},{"noteOn":{"time":149.975,"note":103.000,"xyz":[-367.127,326.000,50.176]}},{"noteOn":{"time":149.995,"note":97.000,"xyz":[-229.364,254.000,155.096]}},{"noteOn":{"time":150.005,"note":96.000,"xyz":[-46.315,242.000,-78.691]}},{"noteOn":{"time":150.025,"note":101.000,"xyz":[-369.484,302.000,-261.980]}},{"noteOn":{"time":150.060,"note":103.000,"xyz":[-357.003,326.000,-212.962]}},{"noteOn":{"time":150.170,"note":109.000,"xyz":[-262.767,398.000,18.113]}},{"noteOn":{"time":150.265,"note":107.000,"xyz":[178.237,374.000,176.161]}},{"noteOn":{"time":150.275,"note":94.000,"xyz":[75.566,218.000,154.728]}},{"noteOn":{"time":150.335,"note":111.000,"xyz":[-272.922,422.000,0.562]}},{"noteOn":{"time":150.360,"note":111.000,"xyz":[-63.710,422.000,180.350]}},{"noteOn":{"time":150.375,"note":103.000,"xyz":[-35.112,326.000,334.815]}},{"noteOn":{"time":150.400,"note":109.000,"xyz":[19.527,398.000,-384.694]}},{"noteOn":{"time":150.435,"note":107.000,"xyz":[-57.302,374.000,54.323]}},{"noteOn":{"time":150.505,"note":99.000,"xyz":[-265.543,278.000,230.354]}},{"noteOn":{"time":150.550,"note":105.000,"xyz":[114.447,350.000,23.159]}},{"noteOn":{"time":150.695,"note":107.000,"xyz":[75.812,374.000,-127.129]}},{"noteOn":{"time":150.725,"note":96.000,"xyz":[71.806,242.000,-100.201]}},{"noteOn":{"time":150.750,"note":95.000,"xyz":[33.837,230.000,331.499]}},{"noteOn":{"time":150.900,"note":107.000,"xyz":[-95.964,374.000,-64.610]}},{"noteOn":{"time":150.930,"note":104.000,"xyz":[118.840,338.000,-135.746]}},{"noteOn":{"time":150.975,"note":94.000,"xyz":[336.169,218.000,-114.539]}},{"noteOn":{"time":150.985,"note":93.000,"xyz":[190.599,206.000,-28.415]}},{"noteOn":{"time":151.065,"note":109.000,"xyz":[215.452,398.000,-40.914]}},{"noteOn":{"time":151.070,"note":103.000,"xyz":[-22.308,326.000,103.808]}},{"noteOn":{"time":151.130,"note":106.000,"xyz":[48.459,362.000,-486.967]}},{"noteOn":{"time":151.200,"note":100.000,"xyz":[24.844,290.000,-102.658]}},{"noteOn":{"time":151.255,"note":90.000,"xyz":[44.369,170.000,84.170]}},{"noteOn":{"time":151.270,"note":106.000,"xyz":[308.738,362.000,-204.163]}},{"noteOn":{"time":151.290,"note":101.000,"xyz":[-123.123,302.000,228.629]}},{"noteOn":{"time":151.295,"note":98.000,"xyz":[-122.881,266.000,337.154]}},{"noteOn":{"time":151.360,"note":105.000,"xyz":[95.598,350.000,-357.588]}},{"noteOn":{"time":151.380,"note":97.000,"xyz":[282.744,254.000,215.866]}},{"noteOn":{"time":151.430,"note":97.000,"xyz":[-404.541,254.000,-111.873]}},{"noteOn":{"time":151.670,"note":105.000,"xyz":[-36.297,350.000,-38.024]}},{"noteOn":{"time":151.770,"note":110.000,"xyz":[54.203,410.000,-22.444]}},{"noteOn":{"time":151.775,"note":102.000,"xyz":[165.794,314.000,-53.575]}},{"noteOn":{"time":151.780,"note":107.000,"xyz":[-123.438,374.000,216.173]}},{"noteOn":{"time":151.795,"note":96.000,"xyz":[-289.999,242.000,-141.040]}},{"noteOn":{"time":151.820,"note":102.000,"xyz":[28.742,314.000,64.920]}},{"noteOn":{"time":151.860,"note":102.000,"xyz":[-177.825,314.000,455.559]}},{"noteOn":{"time":151.900,"note":96.000,"xyz":[177.642,242.000,-330.237]}},{"noteOn":{"time":151.900,"note":102.000,"xyz":[154.025,314.000,-173.266]}},{"noteOn":{"time":151.965,"note":108.000,"xyz":[222.852,386.000,328.298]}},{"noteOn":{"time":151.985,"note":114.000,"xyz":[175.242,458.000,264.132]}},{"noteOn":{"time":152.020,"note":97.000,"xyz":[-238.927,254.000,321.892]}},{"noteOn":{"time":152.075,"note":104.000,"xyz":[127.196,338.000,-259.750]}},{"noteOn":{"time":152.185,"note":104.000,"xyz":[24.548,338.000,-80.013]}},{"noteOn":{"time":152.270,"note":100.000,"xyz":[-266.278,290.000,-335.543]}},{"noteOn":{"time":152.465,"note":104.000,"xyz":[31.766,338.000,-281.538]}},{"noteOn":{"time":152.500,"note":108.000,"xyz":[436.740,386.000,119.917]}},{"noteOn":{"time":152.540,"note":110.000,"xyz":[332.225,410.000,-368.076]}},{"noteOn":{"time":152.565,"note":101.000,"xyz":[-158.380,302.000,-173.286]}},{"noteOn":{"time":152.585,"note":100.000,"xyz":[30.384,290.000,-462.149]}},{"noteOn":{"time":152.675,"note":94.000,"xyz":[239.676,218.000,239.716]}},{"noteOn":{"time":152.695,"note":92.000,"xyz":[-299.503,194.000,-359.898]}},{"noteOn":{"time":152.745,"note":100.000,"xyz":[97.003,290.000,-104.772]}},{"noteOn":{"time":152.755,"note":100.000,"xyz":[-257.453,290.000,-21.218]}},{"noteOn":{"time":152.815,"note":102.000,"xyz":[-28.501,314.000,71.970]}},{"noteOn":{"time":152.925,"note":114.000,"xyz":[324.780,458.000,360.030]}},{"noteOn":{"time":152.925,"note":100.000,"xyz":[122.206,290.000,436.808]}},{"noteOn":{"time":152.940,"note":100.000,"xyz":[-395.848,290.000,250.097]}},{"noteOn":{"time":152.965,"note":105.000,"xyz":[-41.670,350.000,330.902]}},{"noteOn":{"time":153.030,"note":110.000,"xyz":[-261.270,410.000,38.275]}},{"noteOn":{"time":153.205,"note":102.000,"xyz":[4.322,314.000,-99.630]}},{"noteOn":{"time":153.280,"note":94.000,"xyz":[440.457,218.000,-60.822]}},{"noteOn":{"time":153.280,"note":112.000,"xyz":[197.505,434.000,283.874]}},{"noteOn":{"time":153.360,"note":95.000,"xyz":[257.791,230.000,-187.050]}},{"noteOn":{"time":153.415,"note":102.000,"xyz":[358.281,314.000,231.292]}},{"noteOn":{"time":153.490,"note":102.000,"xyz":[166.192,314.000,405.247]}},{"noteOn":{"time":153.535,"note":98.000,"xyz":[-44.426,266.000,-82.502]}},{"noteOn":{"time":153.555,"note":112.000,"xyz":[-340.405,434.000,-57.338]}},{"noteOn":{"time":153.630,"note":104.000,"xyz":[-19.315,338.000,-99.144]}},{"noteOn":{"time":153.665,"note":98.000,"xyz":[-430.637,266.000,-236.979]}},{"noteOn":{"time":153.670,"note":100.000,"xyz":[58.837,290.000,-69.807]}},{"noteOn":{"time":153.695,"note":98.000,"xyz":[154.783,266.000,-244.930]}},{"noteOn":{"time":153.765,"note":100.000,"xyz":[490.075,290.000,63.088]}},{"noteOn":{"time":153.835,"note":106.000,"xyz":[-318.022,362.000,-18.009]}},{"noteOn":{"time":153.980,"note":97.000,"xyz":[178.117,254.000,-243.741]}},{"noteOn":{"time":154.030,"note":112.000,"xyz":[90.499,434.000,90.966]}},{"noteOn":{"time":154.065,"note":102.000,"xyz":[-252.715,314.000,-43.169]}},{"noteOn":{"time":154.195,"note":96.000,"xyz":[169.124,242.000,126.571]}},{"noteOn":{"time":154.385,"note":106.000,"xyz":[-160.597,362.000,461.757]}},{"noteOn":{"time":154.395,"note":96.000,"xyz":[65.452,242.000,-6.004]}},{"noteOn":{"time":154.410,"note":110.000,"xyz":[-44.120,410.000,250.613]}},{"noteOn":{"time":154.485,"note":104.000,"xyz":[-166.817,338.000,-345.636]}},{"noteOn":{"time":154.505,"note":102.000,"xyz":[46.803,314.000,71.160]}},{"noteOn":{"time":154.515,"note":95.000,"xyz":[387.331,230.000,-51.778]}},{"noteOn":{"time":154.520,"note":102.000,"xyz":[-68.016,314.000,-285.029]}},{"noteOn":{"time":154.580,"note":108.000,"xyz":[-53.811,386.000,-120.943]}},{"noteOn":{"time":154.610,"note":108.000,"xyz":[234.643,386.000,296.194]}},{"noteOn":{"time":154.625,"note":108.000,"xyz":[-289.302,386.000,38.975]}},{"noteOn":{"time":154.630,"note":112.000,"xyz":[68.464,434.000,-161.762]}},{"noteOn":{"time":154.645,"note":110.000,"xyz":[114.998,410.000,-406.650]}},{"noteOn":{"time":154.715,"note":102.000,"xyz":[283.538,314.000,-198.277]}},{"noteOn":{"time":154.780,"note":93.000,"xyz":[256.754,206.000,294.968]}},{"noteOn":{"time":154.880,"note":104.000,"xyz":[333.336,338.000,70.417]}},{"noteOn":{"time":155.025,"note":106.000,"xyz":[291.840,362.000,160.698]}},{"noteOn":{"time":155.045,"note":106.000,"xyz":[274.985,362.000,146.291]}},{"noteOn":{"time":155.195,"note":96.000,"xyz":[-112.394,242.000,-246.305]}},{"noteOn":{"time":155.260,"note":106.000,"xyz":[43.369,362.000,-386.267]}},{"noteOn":{"time":155.270,"note":94.000,"xyz":[220.670,218.000,-202.921]}},{"noteOn":{"time":155.270,"note":104.000,"xyz":[381.709,338.000,-36.675]}},{"noteOn":{"time":155.320,"note":106.000,"xyz":[-81.769,362.000,60.719]}},{"noteOn":{"time":155.370,"note":114.000,"xyz":[216.498,458.000,-407.974]}},{"noteOn":{"time":155.375,"note":104.000,"xyz":[170.527,338.000,-205.954]}},{"noteOn":{"time":155.465,"note":93.000,"xyz":[98.486,206.000,-107.165]}},{"noteOn":{"time":155.475,"note":108.000,"xyz":[35.726,386.000,-264.249]}},{"noteOn":{"time":155.545,"note":108.000,"xyz":[-408.666,386.000,184.192]}},{"noteOn":{"time":155.560,"note":104.000,"xyz":[59.123,338.000,14.217]}},{"noteOn":{"time":155.595,"note":108.000,"xyz":[331.941,386.000,168.206]}},{"noteOn":{"time":155.695,"note":101.000,"xyz":[59.017,302.000,64.060]}},{"noteOn":{"time":155.715,"note":99.000,"xyz":[-305.060,278.000,-326.901]}},{"noteOn":{"time":155.945,"note":98.000,"xyz":[11.981,266.000,464.365]}},{"noteOn":{"time":155.955,"note":96.000,"xyz":[298.136,242.000,330.487]}},{"noteOn":{"time":156.000,"note":104.000,"xyz":[-59.171,338.000,-52.814]}},{"noteOn":{"time":156.025,"note":106.000,"xyz":[-250.225,362.000,-87.524]}},{"noteOn":{"time":156.105,"note":106.000,"xyz":[211.553,362.000,-380.563]}},{"noteOn":{"time":156.115,"note":110.000,"xyz":[243.513,410.000,-43.698]}},{"noteOn":{"time":156.135,"note":102.000,"xyz":[-74.840,314.000,-236.921]}},{"noteOn":{"time":156.185,"note":106.000,"xyz":[-70.827,362.000,417.035]}},{"noteOn":{"time":156.195,"note":102.000,"xyz":[-301.067,314.000,316.471]}},{"noteOn":{"time":156.260,"note":94.000,"xyz":[81.419,218.000,98.407]}},{"noteOn":{"time":156.285,"note":101.000,"xyz":[-329.579,302.000,72.120]}},{"noteOn":{"time":156.295,"note":106.000,"xyz":[438.536,362.000,-42.711]}},{"noteOn":{"time":156.330,"note":103.000,"xyz":[85.006,326.000,-107.222]}},{"noteOn":{"time":156.350,"note":105.000,"xyz":[290.477,350.000,-382.106]}},{"noteOn":{"time":156.375,"note":95.000,"xyz":[57.398,230.000,393.210]}},{"noteOn":{"time":156.555,"note":98.000,"xyz":[-54.690,266.000,154.677]}},{"noteOn":{"time":156.585,"note":102.000,"xyz":[-236.829,314.000,146.139]}},{"noteOn":{"time":156.655,"note":108.000,"xyz":[121.726,386.000,-80.326]}},{"noteOn":{"time":156.700,"note":104.000,"xyz":[16.186,338.000,412.418]}},{"noteOn":{"time":156.730,"note":114.000,"xyz":[279.399,458.000,-90.470]}},{"noteOn":{"time":156.770,"note":109.000,"xyz":[223.026,398.000,18.220]}},{"noteOn":{"time":156.900,"note":100.000,"xyz":[185.830,290.000,-256.638]}},{"noteOn":{"time":156.980,"note":96.000,"xyz":[-315.814,242.000,-131.602]}},{"noteOn":{"time":157.035,"note":104.000,"xyz":[-139.086,338.000,304.267]}},{"noteOn":{"time":157.055,"note":101.000,"xyz":[-172.384,302.000,18.558]}},{"noteOn":{"time":157.070,"note":110.000,"xyz":[-82.931,410.000,-60.237]}},{"noteOn":{"time":157.105,"note":104.000,"xyz":[-118.454,338.000,-60.585]}},{"noteOn":{"time":157.130,"note":107.000,"xyz":[-260.737,374.000,-161.726]}},{"noteOn":{"time":157.150,"note":100.000,"xyz":[-141.765,290.000,119.429]}},{"noteOn":{"time":157.195,"note":93.000,"xyz":[96.396,206.000,101.657]}},{"noteOn":{"time":157.205,"note":93.000,"xyz":[-99.715,206.000,-213.672]}},{"noteOn":{"time":157.255,"note":99.000,"xyz":[251.855,278.000,274.345]}},{"noteOn":{"time":157.375,"note":113.000,"xyz":[105.184,446.000,-190.921]}},{"noteOn":{"time":157.410,"note":99.000,"xyz":[94.525,278.000,-6.029]}},{"noteOn":{"time":157.415,"note":100.000,"xyz":[-422.597,290.000,-226.999]}},{"noteOn":{"time":157.425,"note":104.000,"xyz":[426.570,338.000,-136.158]}},{"noteOn":{"time":157.550,"note":109.000,"xyz":[123.484,398.000,471.028]}},{"noteOn":{"time":157.665,"note":111.000,"xyz":[273.500,422.000,-94.483]}},{"noteOn":{"time":157.680,"note":103.000,"xyz":[-254.929,326.000,146.929]}},{"noteOn":{"time":157.785,"note":95.000,"xyz":[3.238,230.000,-192.324]}},{"noteOn":{"time":157.795,"note":101.000,"xyz":[-75.626,302.000,-285.099]}},{"noteOn":{"time":157.860,"note":103.000,"xyz":[168.967,326.000,22.818]}},{"noteOn":{"time":157.870,"note":95.000,"xyz":[130.925,230.000,99.628]}},{"noteOn":{"time":157.885,"note":107.000,"xyz":[-396.728,374.000,-283.871]}},{"noteOn":{"time":157.940,"note":100.000,"xyz":[172.793,290.000,269.649]}},{"noteOn":{"time":157.955,"note":101.000,"xyz":[-233.676,302.000,301.387]}},{"noteOn":{"time":157.980,"note":113.000,"xyz":[-277.026,446.000,205.231]}},{"noteOn":{"time":157.985,"note":97.000,"xyz":[-21.429,254.000,163.503]}},{"noteOn":{"time":158.080,"note":97.000,"xyz":[245.055,254.000,-133.513]}},{"noteOn":{"time":158.085,"note":102.000,"xyz":[-299.894,314.000,127.376]}},{"noteOn":{"time":158.200,"note":103.000,"xyz":[44.474,326.000,-275.435]}},{"noteOn":{"time":158.370,"note":109.000,"xyz":[47.728,398.000,-43.348]}},{"noteOn":{"time":158.375,"note":111.000,"xyz":[-141.428,422.000,-27.948]}},{"noteOn":{"time":158.470,"note":98.000,"xyz":[-458.921,266.000,-163.619]}},{"noteOn":{"time":158.470,"note":111.000,"xyz":[-102.307,422.000,148.651]}},{"noteOn":{"time":158.545,"note":101.000,"xyz":[288.823,302.000,-172.866]}},{"noteOn":{"time":158.545,"note":103.000,"xyz":[285.396,326.000,-79.908]}},{"noteOn":{"time":158.615,"note":107.000,"xyz":[92.248,374.000,279.344]}},{"noteOn":{"time":158.630,"note":97.000,"xyz":[-387.169,254.000,211.701]}},{"noteOn":{"time":158.690,"note":95.000,"xyz":[-22.056,230.000,332.266]}},{"noteOn":{"time":158.715,"note":95.000,"xyz":[280.315,230.000,-98.489]}},{"noteOn":{"time":158.725,"note":109.000,"xyz":[68.063,398.000,-28.670]}},{"noteOn":{"time":158.785,"note":107.000,"xyz":[-143.372,374.000,-116.296]}},{"noteOn":{"time":158.860,"note":107.000,"xyz":[-175.929,374.000,-60.506]}},{"noteOn":{"time":158.895,"note":105.000,"xyz":[-22.205,350.000,-110.103]}},{"noteOn":{"time":158.910,"note":109.000,"xyz":[106.615,398.000,122.658]}},{"noteOn":{"time":158.985,"note":94.000,"xyz":[-492.408,218.000,36.890]}},{"noteOn":{"time":159.015,"note":101.000,"xyz":[199.763,302.000,-21.373]}},{"noteOn":{"time":159.090,"note":105.000,"xyz":[33.253,350.000,484.246]}},{"noteOn":{"time":159.245,"note":109.000,"xyz":[-337.714,398.000,41.180]}},{"noteOn":{"time":159.255,"note":105.000,"xyz":[223.567,350.000,292.426]}},{"noteOn":{"time":159.290,"note":93.000,"xyz":[-266.375,206.000,-64.009]}},{"noteOn":{"time":159.320,"note":113.000,"xyz":[-91.548,446.000,59.678]}},{"noteOn":{"time":159.345,"note":103.000,"xyz":[146.496,326.000,183.015]}},{"noteOn":{"time":159.405,"note":107.000,"xyz":[209.412,374.000,228.561]}},{"noteOn":{"time":159.560,"note":103.000,"xyz":[-76.374,326.000,220.682]}},{"noteOn":{"time":159.560,"note":105.000,"xyz":[-91.095,350.000,-3.762]}},{"noteOn":{"time":159.620,"note":107.000,"xyz":[-229.729,374.000,143.438]}},{"noteOn":{"time":159.655,"note":97.000,"xyz":[94.038,254.000,-19.574]}},{"noteOn":{"time":159.675,"note":105.000,"xyz":[85.740,350.000,-154.154]}},{"noteOn":{"time":159.705,"note":105.000,"xyz":[-179.014,350.000,12.931]}},{"noteOn":{"time":159.715,"note":95.000,"xyz":[-2.600,230.000,-200.533]}},{"noteOn":{"time":159.815,"note":107.000,"xyz":[-55.608,374.000,106.872]}},{"noteOn":{"time":159.910,"note":109.000,"xyz":[-327.112,398.000,-189.699]}},{"noteOn":{"time":159.915,"note":92.000,"xyz":[-84.163,194.000,61.090]}},{"noteOn":{"time":159.935,"note":103.000,"xyz":[-133.930,326.000,258.974]}},{"noteOn":{"time":160.070,"note":107.000,"xyz":[90.675,374.000,-169.463]}},{"noteOn":{"time":160.130,"note":115.000,"xyz":[-96.863,470.000,-354.927]}},{"noteOn":{"time":160.190,"note":99.000,"xyz":[-270.850,278.000,284.108]}},{"noteOn":{"time":160.190,"note":101.000,"xyz":[-128.697,302.000,-47.404]}},{"noteOn":{"time":160.225,"note":105.000,"xyz":[-433.811,350.000,148.358]}},{"noteOn":{"time":160.320,"note":107.000,"xyz":[-47.359,374.000,95.607]}},{"noteOn":{"time":160.365,"note":97.000,"xyz":[-287.829,254.000,-321.144]}},{"noteOn":{"time":160.375,"note":105.000,"xyz":[14.596,350.000,-343.168]}},{"noteOn":{"time":160.420,"note":99.000,"xyz":[-44.905,278.000,-112.322]}},{"noteOn":{"time":160.555,"note":101.000,"xyz":[20.440,302.000,46.448]}},{"noteOn":{"time":160.555,"note":109.000,"xyz":[-90.844,398.000,313.068]}},{"noteOn":{"time":160.565,"note":103.000,"xyz":[175.976,326.000,192.281]}},{"noteOn":{"time":160.670,"note":103.000,"xyz":[-60.932,326.000,-66.005]}},{"noteOn":{"time":160.695,"note":105.000,"xyz":[300.341,350.000,385.957]}},{"noteOn":{"time":160.755,"note":102.000,"xyz":[61.042,314.000,9.945]}},{"noteOn":{"time":160.795,"note":100.000,"xyz":[-282.124,290.000,174.070]}},{"noteOn":{"time":160.810,"note":111.000,"xyz":[138.891,422.000,112.783]}},{"noteOn":{"time":160.905,"note":95.000,"xyz":[-122.505,230.000,-102.709]}},{"noteOn":{"time":161.065,"note":105.000,"xyz":[-184.233,350.000,360.643]}},{"noteOn":{"time":161.090,"note":99.000,"xyz":[339.177,278.000,291.181]}},{"noteOn":{"time":161.125,"note":95.000,"xyz":[-6.175,230.000,130.851]}},{"noteOn":{"time":161.150,"note":99.000,"xyz":[-126.079,278.000,182.952]}},{"noteOn":{"time":161.195,"note":103.000,"xyz":[101.212,326.000,-55.522]}},{"noteOn":{"time":161.220,"note":101.000,"xyz":[102.591,302.000,47.279]}},{"noteOn":{"time":161.255,"note":115.000,"xyz":[133.228,470.000,-88.452]}},{"noteOn":{"time":161.270,"note":101.000,"xyz":[51.815,302.000,74.869]}},{"noteOn":{"time":161.325,"note":105.000,"xyz":[-224.142,350.000,111.361]}},{"noteOn":{"time":161.345,"note":103.000,"xyz":[-78.554,326.000,175.209]}},{"noteOn":{"time":161.375,"note":107.000,"xyz":[92.754,374.000,27.988]}},{"noteOn":{"time":161.380,"note":109.000,"xyz":[-39.712,398.000,73.375]}},{"noteOn":{"time":161.500,"note":100.000,"xyz":[141.463,290.000,126.401]}},{"noteOn":{"time":161.595,"note":111.000,"xyz":[290.939,422.000,-68.811]}},{"noteOn":{"time":161.690,"note":94.000,"xyz":[-153.063,218.000,54.772]}},{"noteOn":{"time":161.755,"note":97.000,"xyz":[117.208,254.000,121.220]}},{"noteOn":{"time":161.790,"note":92.000,"xyz":[152.686,194.000,-15.930]}},{"noteOn":{"time":161.830,"note":101.000,"xyz":[188.770,302.000,-52.983]}},{"noteOn":{"time":161.835,"note":103.000,"xyz":[-128.608,326.000,78.444]}},{"noteOn":{"time":161.865,"note":99.000,"xyz":[178.209,278.000,-299.875]}},{"noteOn":{"time":161.925,"note":102.000,"xyz":[253.895,314.000,-292.343]}},{"noteOn":{"time":162.030,"note":113.000,"xyz":[210.599,446.000,-86.642]}},{"noteOn":{"time":162.100,"note":99.000,"xyz":[193.297,278.000,-54.763]}},{"noteOn":{"time":162.150,"note":113.000,"xyz":[45.117,446.000,-36.181]}},{"noteOn":{"time":162.185,"note":101.000,"xyz":[-158.774,302.000,178.279]}},{"noteOn":{"time":162.295,"note":110.000,"xyz":[54.782,410.000,-13.176]}},{"noteOn":{"time":162.295,"note":96.000,"xyz":[171.377,242.000,-78.048]}},{"noteOn":{"time":162.315,"note":103.000,"xyz":[-255.290,326.000,297.583]}},{"noteOn":{"time":162.335,"note":96.000,"xyz":[18.173,242.000,-99.808]}},{"noteOn":{"time":162.345,"note":108.000,"xyz":[-468.788,386.000,123.767]}},{"noteOn":{"time":162.420,"note":103.000,"xyz":[-166.633,326.000,-74.518]}},{"noteOn":{"time":162.445,"note":97.000,"xyz":[-255.085,254.000,195.819]}},{"noteOn":{"time":162.555,"note":106.000,"xyz":[294.462,362.000,104.683]}},{"noteOn":{"time":162.625,"note":99.000,"xyz":[-214.587,278.000,106.953]}},{"noteOn":{"time":162.685,"note":101.000,"xyz":[-78.867,302.000,397.679]}},{"noteOn":{"time":162.705,"note":97.000,"xyz":[-62.970,254.000,43.066]}},{"noteOn":{"time":162.730,"note":102.000,"xyz":[44.567,314.000,-59.827]}},{"noteOn":{"time":162.910,"note":110.000,"xyz":[-461.993,410.000,-115.153]}},{"noteOn":{"time":162.915,"note":98.000,"xyz":[298.487,266.000,114.450]}},{"noteOn":{"time":162.965,"note":108.000,"xyz":[91.720,386.000,58.082]}},{"noteOn":{"time":163.070,"note":103.000,"xyz":[-274.040,326.000,-47.531]}},{"noteOn":{"time":163.085,"note":111.000,"xyz":[-150.162,422.000,109.186]}},{"noteOn":{"time":163.100,"note":102.000,"xyz":[53.261,314.000,304.448]}},{"noteOn":{"time":163.135,"note":108.000,"xyz":[-235.935,386.000,91.616]}},{"noteOn":{"time":163.155,"note":94.000,"xyz":[-263.779,218.000,-143.123]}},{"noteOn":{"time":163.190,"note":94.000,"xyz":[214.091,218.000,-293.948]}},{"noteOn":{"time":163.220,"note":106.000,"xyz":[-205.579,362.000,-180.958]}},{"noteOn":{"time":163.230,"note":97.000,"xyz":[110.734,254.000,21.575]}},{"noteOn":{"time":163.305,"note":105.000,"xyz":[-201.227,350.000,258.270]}},{"noteOn":{"time":163.420,"note":106.000,"xyz":[-80.434,362.000,41.018]}},{"noteOn":{"time":163.425,"note":93.000,"xyz":[-158.291,206.000,-197.946]}},{"noteOn":{"time":163.485,"note":104.000,"xyz":[-219.623,338.000,103.758]}},{"noteOn":{"time":163.490,"note":100.000,"xyz":[59.704,290.000,-38.457]}},{"noteOn":{"time":163.545,"note":110.000,"xyz":[-160.846,410.000,213.925]}},{"noteOn":{"time":163.650,"note":104.000,"xyz":[-153.729,338.000,330.091]}},{"noteOn":{"time":163.730,"note":114.000,"xyz":[-174.684,458.000,-253.944]}},{"noteOn":{"time":163.750,"note":108.000,"xyz":[58.266,386.000,-181.598]}},{"noteOn":{"time":163.800,"note":92.000,"xyz":[-72.515,194.000,393.061]}},{"noteOn":{"time":163.870,"note":108.000,"xyz":[-78.670,386.000,34.477]}},{"noteOn":{"time":163.970,"note":106.000,"xyz":[-22.600,362.000,-380.814]}},{"noteOn":{"time":164.035,"note":96.000,"xyz":[-314.261,242.000,124.761]}},{"noteOn":{"time":164.070,"note":103.000,"xyz":[-229.475,326.000,-41.574]}},{"noteOn":{"time":164.075,"note":98.000,"xyz":[-3.412,266.000,175.069]}},{"noteOn":{"time":164.085,"note":104.000,"xyz":[-77.280,338.000,-28.099]}},{"noteOn":{"time":164.210,"note":108.000,"xyz":[-145.154,386.000,118.628]}},{"noteOn":{"time":164.215,"note":107.000,"xyz":[-237.994,374.000,193.902]}},{"noteOn":{"time":164.285,"note":106.000,"xyz":[201.605,362.000,-70.718]}},{"noteOn":{"time":164.310,"note":102.000,"xyz":[65.942,314.000,-0.920]}},{"noteOn":{"time":164.330,"note":91.000,"xyz":[-2.004,182.000,490.518]}},{"noteOn":{"time":164.375,"note":116.000,"xyz":[405.223,482.000,-93.596]}},{"noteOn":{"time":164.390,"note":104.000,"xyz":[183.285,338.000,-66.435]}},{"noteOn":{"time":164.475,"note":110.000,"xyz":[276.138,410.000,38.692]}},{"noteOn":{"time":164.545,"note":106.000,"xyz":[307.275,362.000,321.875]}},{"noteOn":{"time":164.595,"note":106.000,"xyz":[121.990,362.000,-307.811]}},{"noteOn":{"time":164.650,"note":104.000,"xyz":[-165.567,338.000,87.281]}},{"noteOn":{"time":164.670,"note":100.000,"xyz":[-100.170,290.000,-19.550]}},{"noteOn":{"time":164.690,"note":102.000,"xyz":[87.743,314.000,119.271]}},{"noteOn":{"time":164.775,"note":98.000,"xyz":[-105.846,266.000,220.444]}},{"noteOn":{"time":164.830,"note":104.000,"xyz":[55.454,338.000,-464.391]}},{"noteOn":{"time":164.895,"note":104.000,"xyz":[59.836,338.000,-8.000]}},{"noteOn":{"time":164.980,"note":100.000,"xyz":[372.660,290.000,-65.262]}},{"noteOn":{"time":165.010,"note":102.000,"xyz":[299.695,314.000,370.870]}},{"noteOn":{"time":165.105,"note":108.000,"xyz":[-149.191,386.000,465.724]}},{"noteOn":{"time":165.150,"note":101.000,"xyz":[-311.689,302.000,222.942]}},{"noteOn":{"time":165.185,"note":100.000,"xyz":[205.007,290.000,353.925]}},{"noteOn":{"time":165.190,"note":110.000,"xyz":[-62.107,410.000,326.926]}},{"noteOn":{"time":165.190,"note":112.000,"xyz":[-438.946,434.000,205.584]}},{"noteOn":{"time":165.250,"note":104.000,"xyz":[-335.831,338.000,65.421]}},{"noteOn":{"time":165.265,"note":106.000,"xyz":[305.633,362.000,-276.756]}},{"noteOn":{"time":165.305,"note":100.000,"xyz":[-95.860,290.000,-32.802]}},{"noteOn":{"time":165.435,"note":94.000,"xyz":[-52.724,218.000,354.957]}},{"noteOn":{"time":165.440,"note":114.000,"xyz":[-295.542,458.000,-264.929]}},{"noteOn":{"time":165.460,"note":96.000,"xyz":[246.389,242.000,-22.365]}},{"noteOn":{"time":165.630,"note":102.000,"xyz":[-190.005,314.000,-141.548]}},{"noteOn":{"time":165.660,"note":102.000,"xyz":[138.805,314.000,11.580]}},{"noteOn":{"time":165.710,"note":106.000,"xyz":[-169.545,362.000,57.756]}},{"noteOn":{"time":165.750,"note":100.000,"xyz":[73.811,290.000,-99.565]}},{"noteOn":{"time":165.835,"note":100.000,"xyz":[168.405,290.000,23.640]}},{"noteOn":{"time":165.915,"note":99.000,"xyz":[47.344,278.000,-111.547]}},{"noteOn":{"time":166.005,"note":98.000,"xyz":[-116.186,266.000,-154.792]}},{"noteOn":{"time":166.010,"note":100.000,"xyz":[-6.332,290.000,196.088]}},{"noteOn":{"time":166.045,"note":102.000,"xyz":[65.137,314.000,206.280]}},{"noteOn":{"time":166.075,"note":112.000,"xyz":[-377.786,434.000,35.804]}},{"noteOn":{"time":166.105,"note":110.000,"xyz":[-246.447,410.000,-194.664]}},{"noteOn":{"time":166.135,"note":108.000,"xyz":[117.269,386.000,407.998]}},{"noteOn":{"time":166.245,"note":112.000,"xyz":[-94.030,434.000,-293.450]}},{"noteOn":{"time":166.255,"note":102.000,"xyz":[58.798,314.000,211.870]}},{"noteOn":{"time":166.325,"note":100.000,"xyz":[200.874,290.000,174.392]}},{"noteOn":{"time":166.375,"note":92.000,"xyz":[-425.414,194.000,-98.377]}},{"noteOn":{"time":166.425,"note":98.000,"xyz":[51.715,266.000,-115.000]}},{"noteOn":{"time":166.515,"note":102.000,"xyz":[-467.701,314.000,-106.657]}},{"noteOn":{"time":166.575,"note":112.000,"xyz":[-449.905,434.000,-176.701]}},{"noteOn":{"time":166.625,"note":104.000,"xyz":[17.554,338.000,105.172]}},{"noteOn":{"time":166.705,"note":98.000,"xyz":[-48.796,266.000,122.603]}},{"noteOn":{"time":166.765,"note":110.000,"xyz":[32.674,410.000,192.927]}},{"noteOn":{"time":166.775,"note":97.000,"xyz":[161.755,254.000,-213.750]}},{"noteOn":{"time":166.785,"note":98.000,"xyz":[426.305,266.000,-110.194]}},{"noteOn":{"time":166.815,"note":108.000,"xyz":[-427.526,386.000,36.009]}},{"noteOn":{"time":166.875,"note":112.000,"xyz":[245.422,434.000,-59.852]}},{"noteOn":{"time":166.890,"note":102.000,"xyz":[-257.265,314.000,-94.379]}},{"noteOn":{"time":166.895,"note":108.000,"xyz":[-475.777,386.000,-16.300]}},{"noteOn":{"time":167.050,"note":104.000,"xyz":[162.312,338.000,-382.359]}},{"noteOn":{"time":167.110,"note":110.000,"xyz":[-54.636,410.000,340.643]}},{"noteOn":{"time":167.160,"note":96.000,"xyz":[-30.609,242.000,-55.920]}},{"noteOn":{"time":167.190,"note":115.000,"xyz":[86.632,470.000,-49.518]}},{"noteOn":{"time":167.220,"note":100.000,"xyz":[242.609,290.000,-17.346]}},{"noteOn":{"time":167.260,"note":101.000,"xyz":[-128.327,302.000,-106.098]}},{"noteOn":{"time":167.305,"note":96.000,"xyz":[-210.563,242.000,218.135]}},{"noteOn":{"time":167.315,"note":102.000,"xyz":[-266.165,314.000,56.567]}},{"noteOn":{"time":167.325,"note":98.000,"xyz":[-63.033,266.000,17.968]}},{"noteOn":{"time":167.330,"note":99.000,"xyz":[-227.778,278.000,386.769]}},{"noteOn":{"time":167.380,"note":107.000,"xyz":[-269.660,374.000,-420.023]}},{"noteOn":{"time":167.600,"note":104.000,"xyz":[385.322,338.000,61.379]}},{"noteOn":{"time":167.610,"note":110.000,"xyz":[130.558,410.000,-322.201]}},{"noteOn":{"time":167.665,"note":94.000,"xyz":[-140.547,218.000,28.965]}},{"noteOn":{"time":167.785,"note":106.000,"xyz":[51.233,362.000,-245.713]}},{"noteOn":{"time":167.810,"note":106.000,"xyz":[95.169,362.000,-67.673]}},{"noteOn":{"time":167.860,"note":93.000,"xyz":[-38.391,206.000,253.429]}},{"noteOn":{"time":167.890,"note":110.000,"xyz":[439.153,410.000,-216.584]}},{"noteOn":{"time":167.965,"note":99.000,"xyz":[9.719,278.000,149.525]}},{"noteOn":{"time":167.980,"note":105.000,"xyz":[339.363,350.000,15.821]}},{"noteOn":{"time":167.985,"note":106.000,"xyz":[-329.872,362.000,69.696]}},{"noteOn":{"time":168.005,"note":108.000,"xyz":[-191.921,386.000,-23.315]}},{"noteOn":{"time":168.025,"note":105.000,"xyz":[-35.969,350.000,43.716]}},{"noteOn":{"time":168.055,"note":104.000,"xyz":[217.601,338.000,434.878]}},{"noteOn":{"time":168.060,"note":106.000,"xyz":[472.490,362.000,-71.534]}},{"noteOn":{"time":168.155,"note":108.000,"xyz":[113.074,386.000,56.639]}},{"noteOn":{"time":168.235,"note":115.000,"xyz":[-67.650,470.000,-184.518]}},{"noteOn":{"time":168.350,"note":106.000,"xyz":[-87.149,362.000,402.289]}},{"noteOn":{"time":168.425,"note":96.000,"xyz":[149.551,242.000,347.824]}},{"noteOn":{"time":168.495,"note":99.000,"xyz":[-283.345,278.000,-385.025]}},{"noteOn":{"time":168.525,"note":107.000,"xyz":[250.245,374.000,80.357]}},{"noteOn":{"time":168.570,"note":104.000,"xyz":[-103.548,338.000,237.974]}},{"noteOn":{"time":168.595,"note":103.000,"xyz":[-35.643,326.000,-42.805]}},{"noteOn":{"time":168.690,"note":108.000,"xyz":[-135.771,386.000,-99.055]}},{"noteOn":{"time":168.705,"note":103.000,"xyz":[233.082,326.000,33.465]}},{"noteOn":{"time":168.735,"note":105.000,"xyz":[287.634,350.000,-215.236]}},{"noteOn":{"time":168.745,"note":91.000,"xyz":[-54.623,182.000,-366.024]}},{"noteOn":{"time":168.860,"note":104.000,"xyz":[-477.314,338.000,-22.301]}},{"noteOn":{"time":168.945,"note":101.000,"xyz":[-33.627,302.000,130.053]}},{"noteOn":{"time":168.995,"note":107.000,"xyz":[135.753,374.000,256.024]}},{"noteOn":{"time":169.045,"note":111.000,"xyz":[-148.814,422.000,12.967]}},{"noteOn":{"time":169.075,"note":105.000,"xyz":[5.016,350.000,-91.833]}},{"noteOn":{"time":169.140,"note":115.000,"xyz":[201.141,470.000,73.743]}},{"noteOn":{"time":169.145,"note":101.000,"xyz":[203.118,302.000,262.106]}},{"noteOn":{"time":169.150,"note":113.000,"xyz":[77.431,446.000,324.025]}},{"noteOn":{"time":169.230,"note":105.000,"xyz":[-115.460,350.000,164.740]}},{"noteOn":{"time":169.295,"note":97.000,"xyz":[-270.062,254.000,239.132]}},{"noteOn":{"time":169.320,"note":98.000,"xyz":[-23.188,266.000,-225.737]}},{"noteOn":{"time":169.330,"note":101.000,"xyz":[56.946,302.000,-210.027]}},{"noteOn":{"time":169.425,"note":101.000,"xyz":[457.356,302.000,-88.289]}},{"noteOn":{"time":169.545,"note":100.000,"xyz":[327.955,290.000,263.655]}},{"noteOn":{"time":169.545,"note":103.000,"xyz":[-334.060,326.000,-145.042]}},{"noteOn":{"time":169.580,"note":109.000,"xyz":[447.439,398.000,-189.154]}},{"noteOn":{"time":169.720,"note":113.000,"xyz":[77.603,446.000,240.459]}},{"noteOn":{"time":169.780,"note":103.000,"xyz":[414.201,326.000,-194.923]}},{"noteOn":{"time":169.800,"note":107.000,"xyz":[-255.991,374.000,-185.744]}},{"noteOn":{"time":169.815,"note":99.000,"xyz":[-38.306,278.000,-189.333]}},{"noteOn":{"time":169.835,"note":99.000,"xyz":[-27.170,278.000,476.041]}},{"noteOn":{"time":169.855,"note":111.000,"xyz":[-381.440,422.000,-88.077]}},{"noteOn":{"time":169.875,"note":109.000,"xyz":[6.809,398.000,-49.944]}},{"noteOn":{"time":169.935,"note":103.000,"xyz":[100.188,326.000,-42.036]}},{"noteOn":{"time":169.965,"note":93.000,"xyz":[-141.845,206.000,306.367]}},{"noteOn":{"time":170.130,"note":107.000,"xyz":[214.238,374.000,288.079]}},{"noteOn":{"time":170.160,"note":101.000,"xyz":[-331.878,302.000,152.725]}},{"noteOn":{"time":170.270,"note":111.000,"xyz":[157.464,422.000,-253.711]}},{"noteOn":{"time":170.280,"note":99.000,"xyz":[153.782,278.000,24.585]}},{"noteOn":{"time":170.335,"note":98.000,"xyz":[-33.486,266.000,-373.046]}},{"noteOn":{"time":170.385,"note":109.000,"xyz":[247.370,398.000,-98.869]}},{"noteOn":{"time":170.395,"note":113.000,"xyz":[-207.845,446.000,-124.384]}},{"noteOn":{"time":170.480,"note":103.000,"xyz":[100.046,326.000,-20.752]}},{"noteOn":{"time":170.485,"note":109.000,"xyz":[-63.733,398.000,-75.551]}},{"noteOn":{"time":170.510,"note":113.000,"xyz":[-425.560,446.000,168.989]}},{"noteOn":{"time":170.530,"note":97.000,"xyz":[116.777,254.000,170.006]}},{"noteOn":{"time":170.605,"note":113.000,"xyz":[-212.980,446.000,71.226]}},{"noteOn":{"time":170.645,"note":101.000,"xyz":[365.605,302.000,93.463]}},{"noteOn":{"time":170.855,"note":101.000,"xyz":[-21.678,302.000,-402.731]}},{"noteOn":{"time":170.885,"note":97.000,"xyz":[184.249,254.000,160.355]}},{"noteOn":{"time":170.915,"note":97.000,"xyz":[-173.167,254.000,-428.019]}},{"noteOn":{"time":170.965,"note":93.000,"xyz":[16.767,206.000,66.620]}},{"noteOn":{"time":171.025,"note":107.000,"xyz":[-161.674,374.000,277.474]}},{"noteOn":{"time":171.080,"note":103.000,"xyz":[245.263,326.000,-207.588]}},{"noteOn":{"time":171.105,"note":95.000,"xyz":[-97.519,230.000,-42.690]}},{"noteOn":{"time":171.125,"note":111.000,"xyz":[291.352,422.000,320.540]}},{"noteOn":{"time":171.160,"note":101.000,"xyz":[-187.770,302.000,137.951]}},{"noteOn":{"time":171.210,"note":109.000,"xyz":[144.892,398.000,464.346]}},{"noteOn":{"time":171.210,"note":98.000,"xyz":[120.029,266.000,297.396]}},{"noteOn":{"time":171.265,"note":115.000,"xyz":[398.466,470.000,26.446]}},{"noteOn":{"time":171.290,"note":105.000,"xyz":[104.078,350.000,-169.337]}},{"noteOn":{"time":171.295,"note":101.000,"xyz":[194.676,302.000,260.464]}},{"noteOn":{"time":171.455,"note":111.000,"xyz":[-121.253,422.000,195.286]}},{"noteOn":{"time":171.630,"note":99.000,"xyz":[10.312,278.000,-418.448]}},{"noteOn":{"time":171.730,"note":105.000,"xyz":[8.301,350.000,175.351]}},{"noteOn":{"time":171.750,"note":100.000,"xyz":[-130.708,290.000,28.239]}},{"noteOn":{"time":171.755,"note":99.000,"xyz":[232.816,278.000,42.057]}},{"noteOn":{"time":171.755,"note":103.000,"xyz":[-54.184,326.000,-229.786]}},{"noteOn":{"time":171.770,"note":105.000,"xyz":[61.382,350.000,40.783]}},{"noteOn":{"time":171.775,"note":95.000,"xyz":[131.104,230.000,137.422]}},{"noteOn":{"time":171.780,"note":103.000,"xyz":[80.678,326.000,25.906]}},{"noteOn":{"time":171.790,"note":101.000,"xyz":[-50.409,302.000,-435.050]}},{"noteOn":{"time":171.835,"note":109.000,"xyz":[-54.857,398.000,-73.088]}},{"noteOn":{"time":171.895,"note":109.000,"xyz":[397.876,398.000,-39.823]}},{"noteOn":{"time":171.920,"note":109.000,"xyz":[-188.255,398.000,52.759]}},{"noteOn":{"time":171.965,"note":105.000,"xyz":[77.500,350.000,-194.941]}},{"noteOn":{"time":172.080,"note":105.000,"xyz":[285.939,350.000,46.683]}},{"noteOn":{"time":172.140,"note":107.000,"xyz":[216.408,374.000,-261.324]}},{"noteOn":{"time":172.240,"note":95.000,"xyz":[-330.374,230.000,-254.614]}},{"noteOn":{"time":172.300,"note":92.000,"xyz":[-306.082,194.000,31.690]}},{"noteOn":{"time":172.370,"note":103.000,"xyz":[1.982,326.000,-357.846]}},{"noteOn":{"time":172.385,"note":107.000,"xyz":[-186.237,374.000,390.060]}},{"noteOn":{"time":172.410,"note":107.000,"xyz":[170.427,374.000,15.913]}},{"noteOn":{"time":172.445,"note":99.000,"xyz":[128.248,278.000,440.657]}},{"noteOn":{"time":172.445,"note":105.000,"xyz":[-272.581,350.000,221.511]}},{"noteOn":{"time":172.475,"note":111.000,"xyz":[59.092,422.000,-379.503]}},{"noteOn":{"time":172.550,"note":105.000,"xyz":[-2.846,350.000,183.575]}},{"noteOn":{"time":172.685,"note":107.000,"xyz":[-75.430,374.000,34.046]}},{"noteOn":{"time":172.710,"note":105.000,"xyz":[61.735,350.000,-257.250]}},{"noteOn":{"time":172.745,"note":105.000,"xyz":[-121.008,350.000,236.879]}},{"noteOn":{"time":172.830,"note":115.000,"xyz":[90.660,470.000,-244.482]}},{"noteOn":{"time":172.855,"note":107.000,"xyz":[-77.771,374.000,-282.293]}},{"noteOn":{"time":172.880,"note":97.000,"xyz":[266.862,254.000,-211.691]}},{"noteOn":{"time":172.935,"note":108.000,"xyz":[-1.363,386.000,67.420]}},{"noteOn":{"time":172.970,"note":100.000,"xyz":[-26.697,290.000,-85.920]}},{"noteOn":{"time":173.005,"note":97.000,"xyz":[-16.815,254.000,-293.957]}},{"noteOn":{"time":173.050,"note":105.000,"xyz":[-105.132,350.000,-132.283]}},{"noteOn":{"time":173.055,"note":103.000,"xyz":[102.295,326.000,23.627]}},{"noteOn":{"time":173.095,"note":107.000,"xyz":[9.780,374.000,-161.507]}},{"noteOn":{"time":173.100,"note":107.000,"xyz":[51.310,374.000,125.939]}},{"noteOn":{"time":173.165,"note":92.000,"xyz":[34.780,194.000,36.958]}},{"noteOn":{"time":173.165,"note":103.000,"xyz":[-9.730,326.000,370.948]}},{"noteOn":{"time":173.290,"note":103.000,"xyz":[-431.950,326.000,73.759]}},{"noteOn":{"time":173.355,"note":111.000,"xyz":[15.856,422.000,-101.628]}},{"noteOn":{"time":173.385,"note":114.000,"xyz":[-98.222,458.000,-2.694]}},{"noteOn":{"time":173.570,"note":100.000,"xyz":[192.528,290.000,-90.204]}},{"noteOn":{"time":173.605,"note":105.000,"xyz":[-67.932,350.000,110.584]}},{"noteOn":{"time":173.635,"note":99.000,"xyz":[39.397,278.000,60.159]}},{"noteOn":{"time":173.665,"note":101.000,"xyz":[28.576,302.000,-414.775]}},{"noteOn":{"time":173.670,"note":102.000,"xyz":[-496.563,314.000,54.937]}},{"noteOn":{"time":173.755,"note":110.000,"xyz":[-10.413,410.000,129.444]}},{"noteOn":{"time":173.795,"note":112.000,"xyz":[-22.579,434.000,-62.381]}},{"noteOn":{"time":173.825,"note":104.000,"xyz":[114.899,338.000,-386.519]}},{"noteOn":{"time":173.885,"note":101.000,"xyz":[-115.605,302.000,240.410]}},{"noteOn":{"time":173.895,"note":109.000,"xyz":[256.596,398.000,164.608]}},{"noteOn":{"time":173.920,"note":99.000,"xyz":[60.126,278.000,172.299]}},{"noteOn":{"time":173.940,"note":100.000,"xyz":[-212.798,290.000,-126.686]}},{"noteOn":{"time":173.985,"note":105.000,"xyz":[-297.246,350.000,-213.903]}},{"noteOn":{"time":174.180,"note":108.000,"xyz":[49.439,386.000,239.118]}},{"noteOn":{"time":174.195,"note":98.000,"xyz":[115.919,266.000,428.014]}},{"noteOn":{"time":174.245,"note":96.000,"xyz":[339.961,242.000,-25.533]}},{"noteOn":{"time":174.290,"note":114.000,"xyz":[52.509,458.000,158.511]}},{"noteOn":{"time":174.355,"note":110.000,"xyz":[220.909,410.000,87.793]}},{"noteOn":{"time":174.440,"note":112.000,"xyz":[354.727,434.000,-67.647]}},{"noteOn":{"time":174.545,"note":92.000,"xyz":[163.629,194.000,-165.167]}},{"noteOn":{"time":174.550,"note":104.000,"xyz":[-141.270,338.000,179.731]}},{"noteOn":{"time":174.555,"note":103.000,"xyz":[-194.713,326.000,73.443]}},{"noteOn":{"time":174.570,"note":101.000,"xyz":[-61.161,302.000,351.870]}},{"noteOn":{"time":174.600,"note":98.000,"xyz":[99.580,266.000,-118.982]}},{"noteOn":{"time":174.605,"note":110.000,"xyz":[77.789,410.000,-133.390]}},{"noteOn":{"time":174.670,"note":108.000,"xyz":[-401.512,386.000,-58.160]}},{"noteOn":{"time":174.750,"note":97.000,"xyz":[46.338,254.000,26.881]}},{"noteOn":{"time":174.785,"note":108.000,"xyz":[-2.952,386.000,-79.544]}},{"noteOn":{"time":174.810,"note":100.000,"xyz":[-23.354,290.000,-336.102]}},{"noteOn":{"time":174.905,"note":94.000,"xyz":[40.273,218.000,-165.771]}},{"noteOn":{"time":174.920,"note":104.000,"xyz":[-257.260,338.000,-135.730]}},{"noteOn":{"time":174.955,"note":102.000,"xyz":[8.765,314.000,143.844]}},{"noteOn":{"time":175.085,"note":112.000,"xyz":[133.879,434.000,-320.168]}},{"noteOn":{"time":175.145,"note":110.000,"xyz":[-414.946,410.000,-17.910]}},{"noteOn":{"time":175.230,"note":98.000,"xyz":[-201.049,266.000,-85.229]}},{"noteOn":{"time":175.405,"note":110.000,"xyz":[-375.950,410.000,202.193]}},{"noteOn":{"time":175.445,"note":96.000,"xyz":[-152.664,242.000,138.105]}},{"noteOn":{"time":175.480,"note":104.000,"xyz":[-213.702,338.000,306.549]}},{"noteOn":{"time":175.495,"note":94.000,"xyz":[-54.451,218.000,-4.919]}},{"noteOn":{"time":175.520,"note":104.000,"xyz":[-75.782,338.000,-313.665]}},{"noteOn":{"time":175.580,"note":114.000,"xyz":[-188.253,458.000,-69.400]}},{"noteOn":{"time":175.590,"note":110.000,"xyz":[-169.058,410.000,-128.112]}},{"noteOn":{"time":175.650,"note":99.000,"xyz":[-269.429,278.000,331.490]}},{"noteOn":{"time":175.650,"note":104.000,"xyz":[7.383,338.000,436.526]}},{"noteOn":{"time":175.730,"note":106.000,"xyz":[192.108,362.000,389.554]}},{"noteOn":{"time":175.770,"note":113.000,"xyz":[424.696,446.000,-175.951]}},{"noteOn":{"time":175.785,"note":102.000,"xyz":[106.755,314.000,327.914]}},{"noteOn":{"time":175.865,"note":108.000,"xyz":[41.499,386.000,258.972]}},{"noteOn":{"time":176.165,"note":101.000,"xyz":[228.172,302.000,-223.070]}},{"noteOn":{"time":176.170,"note":102.000,"xyz":[260.235,314.000,-238.072]}},{"noteOn":{"time":176.215,"note":110.000,"xyz":[4.803,410.000,237.727]}},{"noteOn":{"time":176.225,"note":116.000,"xyz":[-132.247,482.000,39.334]}},{"noteOn":{"time":176.270,"note":100.000,"xyz":[-222.957,290.000,-105.579]}},{"noteOn":{"time":176.295,"note":106.000,"xyz":[248.404,362.000,-262.428]}},{"noteOn":{"time":176.385,"note":106.000,"xyz":[-88.645,362.000,-67.655]}},{"noteOn":{"time":176.400,"note":96.000,"xyz":[-76.711,242.000,71.206]}},{"noteOn":{"time":176.485,"note":108.000,"xyz":[-145.799,386.000,13.951]}},{"noteOn":{"time":176.570,"note":106.000,"xyz":[118.260,362.000,-186.742]}},{"noteOn":{"time":176.715,"note":98.000,"xyz":[-182.858,266.000,-202.593]}},{"noteOn":{"time":176.735,"note":91.000,"xyz":[12.708,182.000,-79.199]}},{"noteOn":{"time":176.745,"note":115.000,"xyz":[71.337,470.000,482.387]}},{"noteOn":{"time":176.865,"note":98.000,"xyz":[-282.726,266.000,259.348]}},{"noteOn":{"time":176.910,"note":104.000,"xyz":[332.507,338.000,328.965]}},{"noteOn":{"time":176.925,"note":96.000,"xyz":[64.587,242.000,-131.923]}},{"noteOn":{"time":177.040,"note":106.000,"xyz":[422.511,362.000,-93.499]}},{"noteOn":{"time":177.060,"note":112.000,"xyz":[261.067,434.000,-201.062]}},{"noteOn":{"time":177.150,"note":116.000,"xyz":[356.837,482.000,-104.818]}},{"noteOn":{"time":177.165,"note":106.000,"xyz":[-282.520,362.000,-269.910]}},{"noteOn":{"time":177.435,"note":100.000,"xyz":[-159.230,290.000,-134.429]}},{"noteOn":{"time":177.445,"note":98.000,"xyz":[317.152,266.000,-235.382]}},{"noteOn":{"time":177.445,"note":100.000,"xyz":[213.214,290.000,-370.973]}},{"noteOn":{"time":177.485,"note":102.000,"xyz":[188.966,314.000,-182.804]}},{"noteOn":{"time":177.560,"note":108.000,"xyz":[266.474,386.000,-202.361]}},{"noteOn":{"time":177.580,"note":93.000,"xyz":[195.750,206.000,282.926]}},{"noteOn":{"time":177.690,"note":107.000,"xyz":[-52.537,374.000,-137.892]}},{"noteOn":{"time":177.955,"note":96.000,"xyz":[-222.365,242.000,-308.402]}},{"noteOn":{"time":178.050,"note":112.000,"xyz":[356.906,434.000,-174.601]}},{"noteOn":{"time":178.055,"note":104.000,"xyz":[-391.038,338.000,-280.155]}},{"noteOn":{"time":178.110,"note":100.000,"xyz":[-51.010,290.000,-95.953]}},{"noteOn":{"time":178.145,"note":114.000,"xyz":[-1.845,458.000,107.721]}},{"noteOn":{"time":178.200,"note":103.000,"xyz":[73.920,326.000,433.145]}},{"noteOn":{"time":178.210,"note":111.000,"xyz":[114.041,422.000,-50.202]}},{"noteOn":{"time":178.335,"note":99.000,"xyz":[390.389,278.000,-3.416]}},{"noteOn":{"time":178.355,"note":102.000,"xyz":[10.861,314.000,-165.695]}},{"noteOn":{"time":178.555,"note":107.000,"xyz":[120.066,374.000,62.440]}},{"noteOn":{"time":178.705,"note":93.000,"xyz":[-203.106,206.000,227.614]}},{"noteOn":{"time":178.705,"note":104.000,"xyz":[-113.235,338.000,164.661]}},{"noteOn":{"time":178.890,"note":109.000,"xyz":[-217.036,398.000,-87.339]}},{"noteOn":{"time":178.900,"note":108.000,"xyz":[244.990,386.000,-276.273]}},{"noteOn":{"time":178.920,"note":98.000,"xyz":[208.941,266.000,-2.137]}},{"noteOn":{"time":179.130,"note":93.000,"xyz":[263.403,206.000,-339.850]}},{"noteOn":{"time":179.165,"note":97.000,"xyz":[-170.794,254.000,376.628]}},{"noteOn":{"time":179.170,"note":104.000,"xyz":[-251.647,338.000,291.760]}},{"noteOn":{"time":179.215,"note":103.000,"xyz":[337.775,326.000,34.991]}},{"noteOn":{"time":179.345,"note":115.000,"xyz":[291.292,470.000,-363.017]}},{"noteOn":{"time":179.405,"note":115.000,"xyz":[-331.666,470.000,-229.757]}},{"noteOn":{"time":179.410,"note":111.000,"xyz":[203.156,422.000,105.995]}},{"noteOn":{"time":179.510,"note":112.000,"xyz":[-121.663,434.000,397.207]}},{"noteOn":{"time":179.880,"note":104.000,"xyz":[-323.672,338.000,-27.683]}},{"noteOn":{"time":179.915,"note":96.000,"xyz":[164.548,242.000,-108.511]}},{"noteOn":{"time":179.990,"note":101.000,"xyz":[40.042,302.000,135.327]}},{"noteOn":{"time":180.025,"note":95.000,"xyz":[8.160,230.000,-122.638]}},{"noteOn":{"time":180.050,"note":113.000,"xyz":[-250.669,446.000,-157.849]}},{"noteOn":{"time":180.055,"note":109.000,"xyz":[-282.374,398.000,-370.202]}},{"noteOn":{"time":180.085,"note":99.000,"xyz":[79.632,278.000,-436.332]}},{"noteOn":{"time":180.145,"note":107.000,"xyz":[-179.697,374.000,12.737]}},{"noteOn":{"time":180.245,"note":117.000,"xyz":[302.534,494.000,384.617]}},{"noteOn":{"time":180.535,"note":99.000,"xyz":[147.632,278.000,190.452]}},{"noteOn":{"time":180.595,"note":102.000,"xyz":[434.776,314.000,128.169]}},{"noteOn":{"time":180.675,"note":113.000,"xyz":[35.743,446.000,-149.691]}},{"noteOn":{"time":180.715,"note":97.000,"xyz":[468.563,254.000,-34.388]}},{"noteOn":{"time":180.745,"note":99.000,"xyz":[-119.587,278.000,104.661]}},{"noteOn":{"time":180.775,"note":105.000,"xyz":[113.162,350.000,53.531]}},{"noteOn":{"time":180.915,"note":107.000,"xyz":[176.466,374.000,51.527]}},{"noteOn":{"time":181.120,"note":105.000,"xyz":[-51.494,350.000,-2.126]}},{"noteOn":{"time":181.190,"note":92.000,"xyz":[-129.508,194.000,166.299]}},{"noteOn":{"time":181.215,"note":115.000,"xyz":[-131.149,470.000,195.808]}},{"noteOn":{"time":181.290,"note":97.000,"xyz":[-210.309,254.000,264.953]}},{"noteOn":{"time":181.340,"note":101.000,"xyz":[166.540,302.000,1.963]}},{"noteOn":{"time":181.355,"note":103.000,"xyz":[358.642,326.000,-19.431]}},{"noteOn":{"time":181.525,"note":97.000,"xyz":[352.518,254.000,-73.310]}},{"noteOn":{"time":181.755,"note":106.000,"xyz":[314.158,362.000,343.291]}},{"noteOn":{"time":181.905,"note":115.000,"xyz":[184.141,470.000,-158.580]}},{"noteOn":{"time":181.910,"note":95.000,"xyz":[-323.481,230.000,-319.812]}},{"noteOn":{"time":181.915,"note":109.000,"xyz":[-237.129,398.000,-75.203]}},{"noteOn":{"time":181.925,"note":101.000,"xyz":[-231.648,302.000,-154.195]}},{"noteOn":{"time":181.945,"note":101.000,"xyz":[177.178,302.000,408.037]}},{"noteOn":{"time":182.010,"note":94.000,"xyz":[214.045,218.000,361.595]}},{"noteOn":{"time":182.125,"note":99.000,"xyz":[266.540,278.000,311.218]}},{"noteOn":{"time":182.370,"note":108.000,"xyz":[46.718,386.000,-119.295]}},{"noteOn":{"time":182.445,"note":113.000,"xyz":[-256.868,446.000,92.455]}},{"noteOn":{"time":182.670,"note":99.000,"xyz":[70.171,278.000,-153.593]}},{"noteOn":{"time":182.735,"note":103.000,"xyz":[-192.563,326.000,-76.909]}},{"noteOn":{"time":182.745,"note":98.000,"xyz":[-341.646,266.000,-348.420]}},{"noteOn":{"time":182.745,"note":93.000,"xyz":[160.255,206.000,-19.326]}},{"noteOn":{"time":182.750,"note":111.000,"xyz":[-249.487,422.000,150.425]}},{"noteOn":{"time":182.915,"note":103.000,"xyz":[-18.387,326.000,-322.386]}},{"noteOn":{"time":183.070,"note":114.000,"xyz":[244.380,458.000,-345.402]}},{"noteOn":{"time":183.150,"note":109.000,"xyz":[-205.572,398.000,183.707]}},{"noteOn":{"time":183.345,"note":103.000,"xyz":[-294.303,326.000,25.672]}},{"noteOn":{"time":183.360,"note":97.000,"xyz":[-28.603,254.000,397.332]}},{"noteOn":{"time":183.585,"note":109.000,"xyz":[313.342,398.000,-283.548]}},{"noteOn":{"time":183.845,"note":112.000,"xyz":[-41.867,434.000,-268.625]}},{"noteOn":{"time":183.885,"note":105.000,"xyz":[28.928,350.000,45.521]}},{"noteOn":{"time":184.200,"note":105.000,"xyz":[103.824,350.000,-72.621]}},{"noteOn":{"time":184.210,"note":100.000,"xyz":[126.762,290.000,46.971]}},{"noteOn":{"time":184.475,"note":95.000,"xyz":[-83.202,230.000,449.725]}},{"noteOn":{"time":184.580,"note":116.000,"xyz":[61.334,482.000,-73.063]}},{"noteOn":{"time":184.705,"note":114.000,"xyz":[343.896,458.000,251.054]}},{"noteOn":{"time":185.120,"note":97.000,"xyz":[130.997,254.000,53.321]}},{"noteOn":{"time":185.185,"note":105.000,"xyz":[136.976,350.000,-397.117]}},{"noteOn":{"time":185.255,"note":116.000,"xyz":[-106.704,482.000,-382.208]}},{"noteOn":{"time":185.640,"note":116.000,"xyz":[41.070,482.000,-236.570]}},{"noteOn":{"time":185.920,"note":102.000,"xyz":[-25.348,314.000,-222.499]}},{"noteOn":{"time":186.055,"note":98.000,"xyz":[236.260,266.000,-341.079]}},{"noteOn":{"time":186.095,"note":108.000,"xyz":[444.781,386.000,97.990]}},{"noteOn":{"time":186.610,"note":110.000,"xyz":[-153.166,410.000,-215.173]}},{"noteOn":{"time":186.625,"note":106.000,"xyz":[-1.182,362.000,-336.465]}},{"noteOn":{"time":186.660,"note":100.000,"xyz":[31.310,290.000,115.037]}},{"noteOn":{"time":187.475,"note":104.000,"xyz":[-54.639,338.000,-275.667]}},{"noteOn":{"time":187.530,"note":109.000,"xyz":[-268.832,398.000,221.527]}},{"noteOn":{"time":188.355,"note":106.000,"xyz":[-276.411,362.000,185.280]}},{"noteOn":{"time":188.355,"note":113.000,"xyz":[303.860,446.000,-227.762]}},{"noteOn":{"time":188.920,"note":96.000,"xyz":[55.719,242.000,138.301]}},{"noteOn":{"time":189.095,"note":111.000,"xyz":[-102.291,422.000,-124.036]}},{"noteOn":{"time":189.430,"note":98.000,"xyz":[-281.249,266.000,50.886]}},{"noteOn":{"time":189.760,"note":115.000,"xyz":[61.969,470.000,-48.871]}},{"noteOn":{"time":190.380,"note":102.000,"xyz":[-106.381,314.000,-357.964]}},{"noteOn":{"time":191.275,"note":100.000,"xyz":[-90.924,290.000,400.996]}},{"noteOn":{"time":191.940,"note":105.000,"xyz":[18.573,350.000,-334.171]}},{"noteOn":{"time":192.665,"note":107.000,"xyz":[-380.873,374.000,-87.564]}},{"noteOn":{"time":193.385,"note":97.000,"xyz":[155.047,254.000,143.936]}},{"noteOn":{"time":194.050,"note":99.000,"xyz":[-420.853,278.000,216.224]}},{"noteOn":{"time":194.945,"note":101.000,"xyz":[-123.264,302.000,103.133]}},{"noteOn":{"time":195.895,"note":99.000,"xyz":[105.958,278.000,-38.320]}},{"noteOn":{"time":196.410,"note":105.000,"xyz":[-78.831,350.000,30.794]}},{"noteOn":{"time":196.975,"note":106.000,"xyz":[143.626,362.000,-108.937]}},{"noteOn":{"time":197.850,"note":98.000,"xyz":[-73.923,266.000,458.147]}},{"noteOn":{"time":198.670,"note":100.000,"xyz":[-325.332,290.000,-192.154]}},{"noteOn":{"time":199.410,"note":100.000,"xyz":[-20.392,290.000,373.952]}},{"noteOn":{"time":200.210,"note":98.000,"xyz":[-272.870,266.000,68.234]}},{"noteOn":{"time":200.855,"note":106.000,"xyz":[296.571,362.000,202.720]}},{"noteOn":{"time":201.445,"note":106.000,"xyz":[204.468,362.000,21.471]}}]}
        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
