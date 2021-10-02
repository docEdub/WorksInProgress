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

    let animateCamera = false;
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

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Utility functions.
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const createSvgTexture = (name, svg) => {
        // Setting a unique name is required otherwise the first texture created gets used all the time.
        // See https://forum.babylonjs.com/t/why-does-2nd-texture-use-first-svg/23975.
        return BABYLON.Texture.LoadFromDataString(name, 'data:image/svg+xml;base64,' + window.btoa(svg), scene)
    }

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);
    if (showBabylonInspector) {
        scene.debugLayer.show()
    }

    let camera = new BABYLON.FreeCamera('', new BABYLON.Vector3(0, 2, 400), scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.25;
    camera.attachControl(canvas, true);
    camera.setTarget(new BABYLON.Vector3(0, 2, 0));

    const lightIntensity = 1
    const ambientLightParent = new BABYLON.TransformNode('', scene)
    // const pointLight = new BABYLON.PointLight('', new BABYLON.Vector3(0, 0, 0), scene)
    // pointLight.intensity = lightIntensity
    // pointLight.parent = ambientLightParent
    // const directionalLight = new BABYLON.DirectionalLight('', new BABYLON.Vector3(0, 0, 1), scene)
    const directionalLight = new BABYLON.DirectionalLight('', new BABYLON.Vector3(0, -1, 0), scene)
    directionalLight.intensity = lightIntensity
    directionalLight.parent = ambientLightParent

    const setAmbientLightPosition = (position) => {
        // ambientLightParent.position = position
    }

    const setAmbientLightDirection = (direction) => {
        // direction.y = 0
        // ambientLightParent.setDirection(direction)
    }

    const ambientLightExcludeMesh = (mesh) => {
        directionalLight.excludedMeshes.push(mesh)
    }

    const glowLayer = new BABYLON.GlowLayer('', scene)
    glowLayer.isEnabled = false
    glowLayer.blurKernelSize = 64
    glowLayer.intensity = 0.5

    // For options docs see https://doc.babylonjs.com/typedoc/interfaces/babylon.ienvironmenthelperoptions.
    const skyBrightness = 0.002
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
        gridMaterial.gridRatio = 3;
        gridMaterial.lineColor.set(0.333, 0.333, 0.333);
        gridMaterial.minorUnitVisibility = 0;
        gridMaterial.opacity = 0.999
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

        const pillarWidth = 7.5
        const pillarHeight = 240

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
            tessellation: 12
        })

        const torusDiameter = pillarWidth * 3
        const torusThickness = 3

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
        distanceDelaySynthPillarMaterial.ambientColor.set(1, 1, 1)
        distanceDelaySynthPillarMaterial.diffuseColor.set(1, 1, 1)
        distanceDelaySynthPillarMaterial.specularColor.set(0.25, 0.25, 0.25)
        distanceDelaySynthPillarMaterial.specularPower = 2
        // distanceDelaySynthPillarMaterial.emissiveColor.set(0.15, 0.15, 0.15)
        

        const distanceDelaySynthMaterial = new BABYLON.StandardMaterial('', scene)
        distanceDelaySynthMaterial.ambientColor.set(1, 1, 1)
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
            // console.debug('radius =', radius)
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
        const distanceDelaySynthNoteScalingMatrix = BABYLON.Matrix.Scaling(1, 1.5, 1)

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
                angle += distanceDelaySynthRotationAngle
                const translationMatrix2 = BABYLON.Matrix.Translation(radius * Math.sin(angle), height, radius * Math.cos(angle))
                const instanceMatrix2 = distanceDelaySynthNoteScalingMatrix.multiply(translationMatrix2)
                let instanceIndex2 = distanceDelaySynthMesh.thinInstanceAdd(instanceMatrix2, false)
                angle += distanceDelaySynthRotationAngle
                const translationMatrix3 = BABYLON.Matrix.Translation(radius * Math.sin(angle), height, radius * Math.cos(angle))
                const instanceMatrix3 = distanceDelaySynthNoteScalingMatrix.multiply(translationMatrix3)
                let instanceIndex3 = distanceDelaySynthMesh.thinInstanceAdd(instanceMatrix3, true)
                distanceDelaySynthMesh.thinInstanceSetAttributeAt('color', instanceIndex1, distanceDelaySynthUnlitBrightnessRGB, false)
                distanceDelaySynthMesh.thinInstanceSetAttributeAt('color', instanceIndex2, distanceDelaySynthUnlitBrightnessRGB, false)
                distanceDelaySynthMesh.thinInstanceSetAttributeAt('color', instanceIndex3, distanceDelaySynthUnlitBrightnessRGB, true)
                let delay = {
                    onTimes: [],
                    offTimes: [],
                    onIndex: 0,
                    offIndex: 0,
                    instanceIndexes: [ instanceIndex1, instanceIndex2, instanceIndex3 ],
                    glowInstanceIndex: -1,
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
        // Move all the notes up 5 positions.
        distanceDelaySynthLowestNoteNumber -= 5
        console.debug('distanceDelaySynthLowestNoteNumber =', distanceDelaySynthLowestNoteNumber)

        // Make DistanceDelaySynth note objects.
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

        // Calculate the max number of DistanceDelaySynth notes playing at any one time.
        let distanceDelaySynth_MaxGlowNotes_NoteMap = null
        const calculateMaxNumberOfDistanceDelaySynthNotes = () => {
            let noteMap = []
            //  {
            //      onTime,
            //      offTime,
            //      tally
            //  }

            const insertNewNoteMapItem = (i, onTime, offTime) => {
                noteMap.splice(i, 0, {
                    onTime: onTime,
                    offTime: offTime,
                    tally: 1
                })
            }

            const splitNoteMapItem = (i, splitTime) => {
                let noteMapItem = noteMap[i]
                let newNoteMapItem = {
                    onTime: splitTime,
                    offTime: noteMapItem.offTime,
                    tally: noteMapItem.tally
                }
                noteMap.splice(i + 1, 0, newNoteMapItem)
                noteMapItem.offTime = splitTime
            }

            const addNoteMapItem = (onTime, offTime) => {
                // Find the note map item matching the given on time.
                for (let i = 0; i < noteMap.length; i++) {
                    let noteMapItem = noteMap[i]
                    if (onTime < noteMapItem.onTime) {
                        if (offTime <= noteMapItem.onTime) {
                            insertNewNoteMapItem(i, onTime, offTime)
                            return
                        }
                        insertNewNoteMapItem(i, onTime, noteMapItem.onTime)
                        addNoteMapItem(noteMapItem.onTime, offTime)
                        return
                    }
                    if (onTime == noteMapItem.onTime) {
                        if (offTime < noteMapItem.offTime) {
                            splitNoteMapItem(i, offTime)
                            addNoteMapItem(onTime, offTime)
                            return
                        }
                        if (offTime == noteMapItem.offTime) {
                            noteMapItem.tally++
                            return
                        }
                        if (offTime > noteMapItem.offTime) {
                            addNoteMapItem(onTime, noteMapItem.offTime)
                            addNoteMapItem(noteMapItem.offTime, offTime)
                            return
                        }
                    }
                    if (onTime > noteMapItem.onTime) {
                        if (onTime < noteMapItem.offTime || offTime <= noteMapItem.offTime) {
                            splitNoteMapItem(i, onTime)
                            addNoteMapItem(onTime, offTime)
                            return
                        }
                    }
                }
                noteMap.push({
                    onTime: onTime,
                    offTime: offTime,
                    tally: 1
                })
            }

            distanceDelaySynthNotes.forEach((note) => {
                for (let delayI = 0; delayI < distanceDelaySynthHeader.delayCount; delayI++) {
                    const delay = note.delays[delayI]
                    for (let i = 0; i < delay.onTimes.length; i++) {
                        addNoteMapItem(delay.onTimes[i], delay.offTimes[i])
                    }
                }
            })

            let maxNotes = 0
            noteMap.forEach((noteMapItem) => {
                maxNotes = Math.max(maxNotes, noteMapItem.tally)
            })
            distanceDelaySynth_MaxGlowNotes_NoteMap = noteMap
            return maxNotes + 1
        }

        const distanceDelaySynth_MaxGlowNotes = calculateMaxNumberOfDistanceDelaySynthNotes()
        console.debug('distanceDelaySynth_MaxGlowNotes =', distanceDelaySynth_MaxGlowNotes)

        let distanceDelaySynth_GlowNoteInstanceIndex = 0
        let distanceDelaySynth_GlowNoteInstances = []
        for (let i = 0; i < distanceDelaySynth_MaxGlowNotes; i++) {
            const index1 = distanceDelaySynthGlowMesh.thinInstanceAdd(zeroScalingMatrix, false)
            const index2 = distanceDelaySynthGlowMesh.thinInstanceAdd(zeroScalingMatrix, false)
            const index3 = distanceDelaySynthGlowMesh.thinInstanceAdd(zeroScalingMatrix, false)
            distanceDelaySynthGlowMesh.thinInstanceSetAttributeAt('color', index1, [1, 1, 1], false)
            distanceDelaySynthGlowMesh.thinInstanceSetAttributeAt('color', index2, [1, 1, 1], false)
            distanceDelaySynthGlowMesh.thinInstanceSetAttributeAt('color', index3, [1, 1, 1], true)
            distanceDelaySynth_GlowNoteInstances.push({
                index1: index1,
                index2: index2,
                index3: index3
            })
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

                    while (delay.offIndex < delay.offTimes.length && delay.offTimes[delay.offIndex] <= time) {
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[0], delay.instanceMatrixes[0], false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[1], delay.instanceMatrixes[1], false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[2], delay.instanceMatrixes[2], true)
                        const glowInstances = distanceDelaySynth_GlowNoteInstances[delay.glowInstanceIndex]
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index1, zeroScalingMatrix, false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index2, zeroScalingMatrix, false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index3, zeroScalingMatrix, true)
                        delay.offIndex++
                    }

                    while (delay.onIndex < delay.onTimes.length && delay.onTimes[delay.onIndex] <= time) {
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[0], zeroScalingMatrix, false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[1], zeroScalingMatrix, false)
                        distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[2], zeroScalingMatrix, true)
                        delay.glowInstanceIndex = distanceDelaySynth_GlowNoteInstanceIndex
                        const glowInstances = distanceDelaySynth_GlowNoteInstances[delay.glowInstanceIndex]
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index1, delay.instanceMatrixes[0], false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index2, delay.instanceMatrixes[1], false)
                        distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index3, delay.instanceMatrixes[2], true)
                        distanceDelaySynth_GlowNoteInstanceIndex++
                        if (distanceDelaySynth_GlowNoteInstanceIndex == distanceDelaySynth_MaxGlowNotes) {
                            distanceDelaySynth_GlowNoteInstanceIndex = 0
                        }
                        delay.onIndex++
                    }
                }
            })
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // PointSynth
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        
        const pointSynthData = csdData['b4f7a35c-6198-422f-be6e-fa126f31b007']
        const pointSynthHeader = pointSynthData[0]
        console.debug('pointSynthHeader =', pointSynthHeader)

        let pointSynthNoteStartIndex = 0;
        let pointSynth_NoteCount = 0
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
            pointSynth_NoteCount++
        }

        const pointSynth_Texture = createSvgTexture('pointSynth', `
            <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
                <circle cx="64" cy="64" r="64" fill="white" />
            </svg>
        `)

        const noteMeshInstanceCount = 40;
        let noteMeshInstanceIndex = 0;
        let noteMeshInstances = [];
        const noteMesh = BABYLON.Mesh.CreateIcoSphere('', { radius: 1, subdivisions: 1 }, scene);
        const noteMaterial = new BABYLON.StandardMaterial('', scene)
        noteMesh.material = noteMaterial
        noteMesh.isVisible = false
        let noteMeshInstance = noteMesh.createInstance('');
        noteMeshInstance.isVisible = false;
        noteMeshInstance.scaling.setAll(1.01);
        for (let i = 0; i < noteMeshInstanceCount; i++) {
            noteMeshInstances.push(noteMeshInstance.clone(''));
        }

        const pointSynth_Placeholder_Mesh = BABYLON.MeshBuilder.CreatePlane('', { size: 2 })
        pointSynth_Placeholder_Mesh.rotation.x = -Math.PI / 2
        pointSynth_Placeholder_Mesh.bakeCurrentTransformIntoVertices();
        const pointSynth_Placeholder_Material = new BABYLON.StandardMaterial('', scene)
        pointSynth_Placeholder_Material.emissiveColor.set(1, 1, 1)
        pointSynth_Placeholder_Material.ambientTexture = pointSynth_Texture
        pointSynth_Placeholder_Material.opacityTexture = pointSynth_Texture
        pointSynth_Placeholder_Material.disableLighting = true
        pointSynth_Placeholder_Mesh.material = pointSynth_Placeholder_Material

        const pointSynth_Placeholder_SolidParticleSystem = new BABYLON.SolidParticleSystem('', scene)
        pointSynth_Placeholder_SolidParticleSystem.addShape(pointSynth_Placeholder_Mesh, pointSynth_NoteCount)
        const pointSynth_Placeholder_SolidParticleSystem_Mesh = pointSynth_Placeholder_SolidParticleSystem.buildMesh()
        pointSynth_Placeholder_SolidParticleSystem_Mesh.name = 'pointSynth_Placeholder_SolidParticleSystem_Mesh'
        pointSynth_Placeholder_SolidParticleSystem_Mesh.visibility = 0.2
        pointSynth_Placeholder_SolidParticleSystem_Mesh.setBoundingInfo(new BABYLON.BoundingInfo(
            new BABYLON.Vector3(-1000, -1000, -1000),
            new BABYLON.Vector3(1000, 1000, 1000)
        ))
        pointSynth_Placeholder_SolidParticleSystem_Mesh.material = pointSynth_Placeholder_Material
        pointSynth_Placeholder_SolidParticleSystem.initParticles = () => {
            for (let i = 0; i < pointSynth_Placeholder_SolidParticleSystem.particles.length; i++) {
                const particle = pointSynth_Placeholder_SolidParticleSystem.particles[i]
                const noteOn = pointSynthData[pointSynthNoteStartIndex + i].noteOn
                particle.position.set(noteOn.xyz[0], noteOn.xyz[1], noteOn.xyz[2])
            }
        }
        pointSynth_Placeholder_SolidParticleSystem.initParticles()
        pointSynth_Placeholder_SolidParticleSystem.setParticles()
        pointSynth_Placeholder_Mesh.dispose()

        // These variables are initialized in render loop and incremented as elapsed time passes.
        let nextPointSynthNoteOnIndex = 0;
        let nextPointSynthNoteOffIndex = 0;

        const pointSynthNoteOn = (i) => {
            const note = pointSynthData[i].noteOn;
            note.instanceIndex = noteMeshInstanceIndex;
            let mesh = noteMeshInstances[note.instanceIndex];
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
        // GroundBubbleSynth
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const groundBubbleSynth_Texture = createSvgTexture('groundBubbleSynth', `
            <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
                <radialGradient id="gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stop-color="#000" stop-opacity="0" />
                    <stop offset="50%" stop-color="#000" stop-opacity="0" />
                    <stop offset="75%" stop-color="#fff" stop-opacity="1" />
                    <stop offset="100%" stop-color="#000" stop-opacity="0" />
                </radialGradient>
                <circle cx="50%" cy="50%" r="50%" fill="url('#gradient')" />
            </svg>
        `)

        const groundBubbleSynth_Material = new BABYLON.StandardMaterial('', scene)
        groundBubbleSynth_Material.emissiveColor.set(.333, .333, .333)
        groundBubbleSynth_Material.ambientTexture = groundBubbleSynth_Texture
        groundBubbleSynth_Material.opacityTexture = groundBubbleSynth_Texture
        groundBubbleSynth_Material.disableLighting = true

        const groundBubbleSynth_Data = csdData['9037b759-36e4-4600-b2cb-03383ebd65c1']
        const groundBubbleSynth_DataHeader = groundBubbleSynth_Data[0]

        const groundBubbleSynth_Diameter = 2
        const groundBubbleSynth_GridCountX = groundBubbleSynth_DataHeader.gridColumnCount
        const groundBubbleSynth_GridCountZ = groundBubbleSynth_DataHeader.gridRowCount
        const groundBubbleSynth_GridCellCount = groundBubbleSynth_GridCountX * groundBubbleSynth_GridCountZ
        const groundBubbleSynth_GridCellSize = groundBubbleSynth_DataHeader.gridCellSize
        const groundBubbleSynth_SpanX = groundBubbleSynth_GridCountX * groundBubbleSynth_GridCellSize
        const groundBubbleSynth_SpanZ = groundBubbleSynth_GridCountZ * groundBubbleSynth_GridCellSize
        const groundBubbleSynth_HalfSpanX = groundBubbleSynth_SpanX / 2
        const groundBubbleSynth_HalfSpanZ = groundBubbleSynth_SpanZ / 2
        const groundBubbleSynth_ParticleAnimationY = []

        const groundBubbleSynth_Mesh = BABYLON.MeshBuilder.CreatePlane('', {
            size: groundBubbleSynth_Diameter
        })
        groundBubbleSynth_Mesh.rotation.x = Math.PI / 2
        const groundBubbleSynth_SolidParticleSystem = new BABYLON.SolidParticleSystem('', scene)
        groundBubbleSynth_SolidParticleSystem.addShape(groundBubbleSynth_Mesh, groundBubbleSynth_GridCellCount)
        const groundBubbleSynth_SolidParticleSystem_Mesh = groundBubbleSynth_SolidParticleSystem.buildMesh()
        groundBubbleSynth_SolidParticleSystem_Mesh.setBoundingInfo(new BABYLON.BoundingInfo(new BABYLON.Vector3(-1000, 0, -1000), new BABYLON.Vector3(1000, 1000, 1000)))
        groundBubbleSynth_SolidParticleSystem_Mesh.material = groundBubbleSynth_Material
        groundBubbleSynth_SolidParticleSystem.initParticles = () => {
            let particleIndex = 0
            let x = -groundBubbleSynth_HalfSpanX
            for (let i = 0; i < groundBubbleSynth_GridCountX; i++) {
                groundBubbleSynth_ParticleAnimationY.push([])
                let z = -groundBubbleSynth_HalfSpanZ
                for (let j = 0; j < groundBubbleSynth_GridCountZ; j++) {
                    const particle = groundBubbleSynth_SolidParticleSystem.particles[particleIndex]
                    particle.position.set(x, 0, z)
                    particle.rotation.x = Math.PI / 2
                    groundBubbleSynth_ParticleAnimationY[i].push({ started: false })
                    // groundBubbleSynth_ParticleAnimationY[i].push({ started: true })
                    z += groundBubbleSynth_GridCellSize
                    particleIndex++
                }
                x += groundBubbleSynth_GridCellSize
            }
        }

        groundBubbleSynth_SolidParticleSystem.initParticles()
        groundBubbleSynth_SolidParticleSystem.setParticles()
        groundBubbleSynth_Mesh.dispose()

        // Solid particle system billboard doesn't work in WebXR so we implement it here manually.
        // See https://forum.babylonjs.com/t/solid-particle-system-with-billboard-not-working-in-webxr/11891/3
        // groundBubbleSynth_SolidParticleSystem.billboard = true
        const billboardNode = new BABYLON.TransformNode('', scene)
        billboardNode.parent = groundBubbleSynth_SolidParticleSystem_Mesh

        const groundBubbleSynth_SpeedY = groundBubbleSynth_DataHeader.speedY
        const fullBillboardHeight = groundBubbleSynth_DataHeader.fullVolumeY
        let groundBubbleSynth_DeltaTime = 0
        groundBubbleSynth_SolidParticleSystem.updateParticle = (particle) => {
            const animation = groundBubbleSynth_ParticleAnimationY[Math.floor(particle.idx / groundBubbleSynth_GridCountX)][particle.idx % groundBubbleSynth_GridCountZ]
            if (animation.started) {
                particle.position.y = particle.position.y + groundBubbleSynth_SpeedY * groundBubbleSynth_DeltaTime
                billboardNode.position = particle.position
                billboardNode.lookAt(currentCamera.position, 0, Math.PI, Math.PI, BABYLON.Space.WORLD)
                let rotationX = billboardNode.rotation.x
                let rotationZ = billboardNode.rotation.z
                if (particle.position.y < fullBillboardHeight) {
                    const rotationAmount = 1 - particle.position.y / fullBillboardHeight
                    rotationX = billboardNode.rotation.x + rotationAmount * (Math.PI / 2)
                    rotationZ = billboardNode.rotation.z
                }
                particle.rotation.set(rotationX, billboardNode.rotation.y, rotationZ)
            }
            return particle
        }

        let groundBubbleSynth_NoteOnIndex = 1
        const groundBubbleSynth_Render = (time, deltaTime) => {
            groundBubbleSynth_DeltaTime = deltaTime

            while (groundBubbleSynth_NoteOnIndex < groundBubbleSynth_Data.length
                    && groundBubbleSynth_Data[groundBubbleSynth_NoteOnIndex].noteOn.time <= time) {
                const note = groundBubbleSynth_Data[groundBubbleSynth_NoteOnIndex].noteOn
                groundBubbleSynth_ParticleAnimationY[note.column][note.row].started = true
                groundBubbleSynth_NoteOnIndex++
            }

            groundBubbleSynth_SolidParticleSystem.setParticles()
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Update note animations.
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const cameraRadiusMax = 400
        let cameraSpeed = 4000
        let cameraTargetY = pillarHeight / 3
        let cameraTarget = new BABYLON.Vector3(0, cameraTargetY, -50)
        let cameraTargetIsUserDefined = false
        let cameraRadius = 65
        let cameraRadiusX = -1
        let cameraAngle = Math.PI

        const updateCamera = (time) => {
            setAmbientLightPosition(currentCamera.position)
            setAmbientLightDirection(currentCamera.target.subtract(currentCamera.position))

            if (!animateCamera) {
                return
            }

            // NB: The camera radius only comes inside 50 when the music is ending for the first time.
            if (cameraRadius < 50) {
                cameraSpeed *= 1.0025
                // console.debug('cameraSpeed =', cameraSpeed)
                if (cameraSpeed > 50000) {
                    animateCamera = false
                    console.log('Camera animation lock released: restart count > 0')
                }
            }
            else if (cameraRadius > cameraRadiusMax) {
                cameraRadiusX *= -1
            }
            cameraRadius -= time / (cameraSpeed / 2) * cameraRadiusX
            cameraAngle += Math.PI * time / (360 * cameraSpeed)
            cameraAngle %= 2 * Math.PI

            camera.position.set(cameraRadius * Math.sin(cameraAngle), 2, cameraRadius * Math.cos(cameraAngle))

            if (!cameraTargetIsUserDefined) {
                camera.setTarget(cameraTarget)
            }
        }

        let pointerIsDown = false

        const onPointerDown = (e) => {
            if (e.button !== 0) {
                return;
            }
            pointerIsDown = true
        }
    
        const onPointerUp = () => {
            pointerIsDown = false
        }
    
        const onPointerMove = (e) => {
            if (animateCamera && !cameraTargetIsUserDefined && pointerIsDown) {
                unlockCameraTarget()
            }
        }

        const cameraUsesInputKey = (key) => {
            for (let i = 0; i < camera.keysDown.length; i++) {
                if (key == camera.keysDown[i]) {
                    return true;
                }
            }
            for (let i = 0; i < camera.keysDownward.length; i++) {
                if (key == camera.keysDown[i]) {
                    return true;
                }
            }
            for (let i = 0; i < camera.keysLeft.length; i++) {
                if (key == camera.keysLeft[i]) {
                    return true;
                }
            }
            for (let i = 0; i < camera.keysRight.length; i++) {
                if (key == camera.keysRight[i]) {
                    return true;
                }
            }
            for (let i = 0; i < camera.keysUp.length; i++) {
                if (key == camera.keysUp[i]) {
                    return true;
                }
            }
            for (let i = 0; i < camera.keysUpward.length; i++) {
                if (key == camera.keysUpward[i]) {
                    return true;
                }
            }
            return false
        }

        const onKeyDown = (e) => {
            if (animateCamera && cameraUsesInputKey(e.keyCode)) {
                unlockCameraPosition()
            }
        }
    
        if (animateCamera) {
            canvas.addEventListener("pointerdown", onPointerDown, false)
            canvas.addEventListener("pointerup", onPointerUp, false)
            document.addEventListener("pointermove", onPointerMove, false)
            document.addEventListener("keydown", onKeyDown, false)
        }

        const unlockCameraPosition = () => {
            animateCamera = false
            canvas.removeEventListener("pointerdown", onPointerDown)
            canvas.removeEventListener("pointerup", onPointerUp)
            document.removeEventListener("onkeydown", onKeyDown)
            console.log('Camera animation lock released: key press detected')
        }
    
        const unlockCameraTarget = () => {
            cameraTargetIsUserDefined = true
            document.removeEventListener("pointermove", onPointerMove)
            console.log('Camera target lock released: mouse drag detected')
        }
    
        scene.onDispose = () => {
            unlockCameraTarget()
            unlockCameraPosition()
        }
        
        scene.registerBeforeRender(() => {
            if (!isCsoundStarted) {
                resetDistanceDelaySynthIndexes()
                resetPointSynthIndexes()
                updateCamera(0)
                return;
            }

            const time = document.audioContext.currentTime - startTime;
            distanceDelaySynthRender(time)
            pointSynthRender(time)
            groundBubbleSynth_Render(time, engine.getDeltaTime() / 1000)
            // groundBubbleSynth_Render(time + 115, engine.getDeltaTime() / 1000)
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
        console.debug('Restarting Csound ...')
        isCsoundStarted = false;
        await document.csound.rewindScore();
        console.debug('Restarting Csound - done')
        restartCount++
        console.debug('Restart count =', restartCount)
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
            event_i("i", 7, 1, -1)
            event_i("i", 11, 1, -1)
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
        giDistanceDelaySynth_NoteNumberToHeightScale = 7.5
        giDistanceDelaySynth_DelayTime = 0.5
        giDistanceDelaySynth_Duration = 0.49
        giDistanceDelaySynth_DelayCount = 5
        giDistanceDelaySynth_MaxAmpWhenVeryClose = 0.5
        giDistanceDelaySynth_ReferenceDistance = 0.1
        giDistanceDelaySynth_RolloffFactor = 0.0025
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
        gSCcInfo_GroundBubbleSynth[] = fillarray( \\
        \\
            "example", "bool", "false", "synced", \\
        \\
            "", "", "", "")
         #define gSCcInfo_GroundBubbleSynth_Count #8#
         #define CC_INFO_CHANNEL #0#
         #define CC_INFO_TYPE #1#
         #define CC_INFO_VALUE #2#
         #define CC_INFO_SYNC_TYPE #3#
         #define CC_NO_SYNC #0#
         #define CC_SYNC_TO_CHANNEL #1#
         #ifdef gSCcInfo_GroundBubbleSynth_Count
            if (lenarray(gSCcInfo_GroundBubbleSynth) == $gSCcInfo_GroundBubbleSynth_Count) then
                giCcCount_GroundBubbleSynth = (lenarray(gSCcInfo_GroundBubbleSynth) / 4) - 1
                reshapearray(gSCcInfo_GroundBubbleSynth, giCcCount_GroundBubbleSynth + 1, 4)
            endif
         #else
            giCcCount_GroundBubbleSynth = (lenarray(gSCcInfo_GroundBubbleSynth) / 4) - 1
            reshapearray(gSCcInfo_GroundBubbleSynth, giCcCount_GroundBubbleSynth + 1, 4)
         #end
        opcode ccIndex_GroundBubbleSynth, i, S
            SChannel xin
            kgoto end
            iI = 0
            while (iI < giCcCount_GroundBubbleSynth) do
                if (strcmp(gSCcInfo_GroundBubbleSynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
                iI += 1
            od
            iI = -1
        end:
            xout iI
        endop
        giCcValueDefaults_GroundBubbleSynth[] init giCcCount_GroundBubbleSynth
        giCcValues_GroundBubbleSynth[][] init 1, giCcCount_GroundBubbleSynth
        gkCcValues_GroundBubbleSynth[][] init 1, giCcCount_GroundBubbleSynth
        gkCcSyncTypes_GroundBubbleSynth[][] init 1, giCcCount_GroundBubbleSynth
        instr GroundBubbleSynth_InitializeCcValues
            iI = 0
            while (iI < giCcCount_GroundBubbleSynth) do
                SType = gSCcInfo_GroundBubbleSynth[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_GroundBubbleSynth[iI][$CC_INFO_VALUE]
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
                    giCcValueDefaults_GroundBubbleSynth[iI] = iValue
                    giCcValues_GroundBubbleSynth[iJ][iI] = iValue
                    iJ += 1
                od
                iI += 1
            od
            igoto end
            kI = 0
            while (kI < giCcCount_GroundBubbleSynth) do
                SType = gSCcInfo_GroundBubbleSynth[kI][$CC_INFO_TYPE]
                SValue = gSCcInfo_GroundBubbleSynth[kI][$CC_INFO_VALUE]
                SSyncType = gSCcInfo_GroundBubbleSynth[kI][$CC_INFO_SYNC_TYPE]
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
                    gkCcValues_GroundBubbleSynth[kJ][kI] = kValue
                    gkCcSyncTypes_GroundBubbleSynth[kJ][kI] = $CC_NO_SYNC
                    if (strcmpk(SSyncType, "synced") == 0) then
                        gkCcSyncTypes_GroundBubbleSynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
                    endif
                    kJ += 1
                od
                kI += 1
            od
            turnoff
        end:
        endin
        event_i("i", "GroundBubbleSynth_InitializeCcValues", 0, -1)
        instr GroundBubbleSynth_CreateCcIndexes
            giCc_GroundBubbleSynth_example init ccIndex_GroundBubbleSynth("example")
            turnoff
        endin
        event_i("i", "GroundBubbleSynth_CreateCcIndexes", 0, -1)
        giGroundBubbleSynth_Duration = 60
        giGroundBubbleSynth_GridColumnCount = 30
        giGroundBubbleSynth_GridRowCount = giGroundBubbleSynth_GridColumnCount
        giGroundBubbleSynth_GridCellSize = 30
        giGroundBubbleSynth_StartY = 0
        giGroundBubbleSynth_FullVolumeY = 2
        giGroundBubbleSynth_SpeedY = 10
        giGroundBubbleSynth_MaxAudibleDistance = 100
        giGroundBubbleSynth_MaxAudibleHeight = giGroundBubbleSynth_MaxAudibleDistance
        giGroundBubbleSynth_MaxAmpWhenVeryClose = 0.5
        giGroundBubbleSynth_ReferenceDistance = 0.1
        giGroundBubbleSynth_RolloffFactor = 0.0025
        giGroundBubbleSynth_PlaybackVolumeAdjustment = 2.5
        giGroundBubbleSynth_PlaybackReverbAdjustment = 0.25
        giGroundBubbleSynth_NoteIndex[] init 1
        giGroundBubbleSynth_GridCellCount = giGroundBubbleSynth_GridColumnCount * giGroundBubbleSynth_GridRowCount
        giGroundBubbleSynth_GridCellLaunchPattern[][] init giGroundBubbleSynth_GridCellCount, 2
        giGroundBubbleSynth_GridCenterX = (giGroundBubbleSynth_GridColumnCount * giGroundBubbleSynth_GridCellSize) / 2
        giGroundBubbleSynth_GridCenterZ = (giGroundBubbleSynth_GridRowCount * giGroundBubbleSynth_GridCellSize) / 2
        giGroundBubbleSynth_GridCellIndex = 0
        giGroundBubbleSynth_GridCellIndexIncrementAmount = 30
        giGroundBubbleSynth_GridCellIndexBase = 0
        opcode incrementGridCellIndex, 0, 0
            giGroundBubbleSynth_GridCellIndex += giGroundBubbleSynth_GridCellIndexIncrementAmount
            if (giGroundBubbleSynth_GridCellIndex >= giGroundBubbleSynth_GridCellCount) then
                giGroundBubbleSynth_GridCellIndexBase += 1
                giGroundBubbleSynth_GridCellIndex = giGroundBubbleSynth_GridCellIndexBase
            fi
        endop
        iSpiralIndex = 0
        while (iSpiralIndex < giGroundBubbleSynth_GridColumnCount / 2) do
            iSpiralColumnIndex = iSpiralIndex
            iSpiralRowIndex = iSpiralIndex
            while (iSpiralColumnIndex < giGroundBubbleSynth_GridColumnCount - iSpiralIndex) do
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex
                iSpiralColumnIndex += 1
                incrementGridCellIndex()
            od
            iSpiralColumnIndex -= 1
            iSpiralRowIndex += 1
            while (iSpiralRowIndex < giGroundBubbleSynth_GridRowCount - iSpiralIndex) do
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex
                iSpiralRowIndex += 1
                incrementGridCellIndex()
            od
            iSpiralRowIndex -= 1
            iSpiralColumnIndex -= 1
            while (iSpiralColumnIndex >= iSpiralIndex) do
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex
                iSpiralColumnIndex -= 1
                incrementGridCellIndex()
            od
            iSpiralColumnIndex += 1
            iSpiralRowIndex -= 1
            while (iSpiralRowIndex > iSpiralIndex) do
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
                giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex
                iSpiralRowIndex -= 1
                incrementGridCellIndex()
            od
            iSpiralIndex += 1
        od
         #ifdef IS_GENERATING_JSON
            setPluginUuid(2, 0, "9037b759-36e4-4600-b2cb-03383ebd65c1")
            instr GroundBubbleSynth_Json
                SJsonFile = sprintf("json/%s.0.json", "9037b759-36e4-4600-b2cb-03383ebd65c1")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
                fprints(SJsonFile, sprintf(",\\"duration\\":%d", giGroundBubbleSynth_Duration))
                fprints(SJsonFile, sprintf(",\\"gridColumnCount\\":%d", giGroundBubbleSynth_GridColumnCount))
                fprints(SJsonFile, sprintf(",\\"gridRowCount\\":%d", giGroundBubbleSynth_GridRowCount))
                fprints(SJsonFile, sprintf(",\\"gridCellSize\\":%d", giGroundBubbleSynth_GridCellSize))
                fprints(SJsonFile, sprintf(",\\"maxDistance\\":%d", giGroundBubbleSynth_MaxAudibleDistance))
                fprints(SJsonFile, sprintf(",\\"maxHeight\\":%d", giGroundBubbleSynth_MaxAudibleHeight))
                fprints(SJsonFile, "}")
                turnoff
            endin
         #end
        instr 6
            iEventType = p4
            if (iEventType == 4) then
                turnoff
            elseif (iEventType == 3) then
                iGridColumn = p5
                iGridRow = p6
                iCps = 220
                iAmp = 0.05
                iCutoffFrequency = 1000
                kY init giGroundBubbleSynth_StartY
                kY += giGroundBubbleSynth_SpeedY * (1 / kr)
                if (kY > giGroundBubbleSynth_MaxAudibleHeight) then
                    turnoff
                fi
                kX init iGridColumn * giGroundBubbleSynth_GridCellSize - giGroundBubbleSynth_GridCenterX
                kZ init iGridRow * giGroundBubbleSynth_GridCellSize - giGroundBubbleSynth_GridCenterZ
                kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
                if (kDistance > giGroundBubbleSynth_MaxAudibleDistance) then
                    kgoto end
                fi
                kCps = iCps + kY * 10
                kAmp = iAmp
                if (kY < giGroundBubbleSynth_FullVolumeY) then
                    kAmp *= kY / giGroundBubbleSynth_FullVolumeY
                fi
                kAmp *= kDistance / giGroundBubbleSynth_MaxAudibleDistance
                aOut = tone(
                    oscil(kAmp + jspline(kAmp, 0.08, 0.05), kCps * 0.918) + oscil(kAmp + jspline(kAmp, 0.07, 0.49), kCps * 2.234) + oscil(kAmp + jspline(kAmp, 0.09, 0.50), kCps * 3.83) + oscil(kAmp + jspline(kAmp, 0.10, 0.45), kCps * 4.11) + oscil(kAmp + jspline(kAmp, 0.09, 0.51), kCps * 5.25) + oscil(kAmp + jspline(kAmp, 0.08, 0.50), kCps * 6.093) + oscil(kAmp + jspline(kAmp, 0.08, 0.50), kCps * 7.77) + oscil(kAmp + jspline(kAmp, 0.10, 0.40), kCps * 8.328) + oscil(kAmp + jspline(kAmp, 0.07, 0.55), kCps * 9.129) + oscil(kAmp + jspline(kAmp, 0.08, 0.47), kCps * kCps / 100),
                    iCutoffFrequency)
                    a1 = gaInstrumentSignals[2][0]
                    a2 = gaInstrumentSignals[2][1]
                    a3 = gaInstrumentSignals[2][2]
                    a4 = gaInstrumentSignals[2][3]
                    a5 = gaInstrumentSignals[2][4]
                kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giGroundBubbleSynth_ReferenceDistance, giGroundBubbleSynth_RolloffFactor)
                kDistanceAmp = min(kDistanceAmp, giGroundBubbleSynth_MaxAmpWhenVeryClose)
                    kDistanceAmp *= giGroundBubbleSynth_PlaybackVolumeAdjustment
                aOutDistanced = aOut * kDistanceAmp
                AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
                iPlaybackReverbAdjustment init 1
                    iPlaybackReverbAdjustment = giGroundBubbleSynth_PlaybackReverbAdjustment
                a1 += gkAmbisonicChannelGains[0] * aOutDistanced
                a2 += gkAmbisonicChannelGains[1] * aOutDistanced
                a3 += gkAmbisonicChannelGains[2] * aOutDistanced
                a4 += gkAmbisonicChannelGains[3] * aOutDistanced
                a5 += 0.25 * aOutDistanced * iPlaybackReverbAdjustment
                    gaInstrumentSignals[2][0] = a1
                    gaInstrumentSignals[2][1] = a2
                    gaInstrumentSignals[2][2] = a3
                    gaInstrumentSignals[2][3] = a4
                    gaInstrumentSignals[2][4] = a5
                    gaInstrumentSignals[2][5] = a5
                #ifdef IS_GENERATING_JSON
                    if (giGroundBubbleSynth_NoteIndex[0] == 0) then
                        scoreline_i("i \\"GroundBubbleSynth_Json\\" 0 0")
                    endif
                    giGroundBubbleSynth_NoteIndex[0] = giGroundBubbleSynth_NoteIndex[0] + 1
                    SJsonFile = sprintf("json/%s.%d.json", "9037b759-36e4-4600-b2cb-03383ebd65c1", giGroundBubbleSynth_NoteIndex[0])
                    fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"column\\":%d,\\"row\\":%d}}",
                        times(), iGridColumn, iGridRow)
                    ficlose(SJsonFile)
                #end
            endif
        end:
        endin
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
        instr 9
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
                        if (3 < gi_instrumentCount) then
                            aIn[kI] = gaInstrumentSignals[3][kJ]
                        else
                            iAuxTrackIndex = 3 - gi_instrumentCount
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
                        iAuxTrackIndex = 3
                        if (iAuxTrackIndex >= gi_instrumentCount) then
                            iAuxTrackIndex -= gi_instrumentCount
                        endif
                        ga_auxSignals[iAuxTrackIndex][kJ] = aOut[kI]
                        kJ += 1
                    kI += 1
                od
            endif
        endin
            instr Preallocate_9
                ii = 0
                while (ii < 10) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", 9, ii))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 9))
        instr 7
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
        instr 8
            k_aux = p4 - gi_auxIndexOffset
            k_track = p5 - gi_instrumentIndexOffset
            k_channel = p6
            k_volume = p7
            ga_auxVolumes[k_aux][k_track][k_channel] = k_volume
            turnoff
        endin
        instr 10
            k_track = p4 - gi_instrumentIndexOffset
            k_channel = p5
            k_volume = p6
            ga_masterVolumes[k_track][k_channel] = k_volume
            turnoff
        endin
        instr 11
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
        i 2 0 -1 3 0 1 3
        i 9.1 0 -1 1 0 0
        i 8 0.004 1 3 0 0 0.60
        i 8 0.004 1 3 0 1 0.60
        i 8 0.004 1 3 0 2 0.60
        i 8 0.004 1 3 0 3 0.60
        i 8 0.004 1 3 0 4 0.12
        i 8 0.004 1 3 0 5 0.12
        i 8 0.004 1 3 1 0 0.06
        i 8 0.004 1 3 1 1 0.06
        i 8 0.004 1 3 1 2 0.06
        i 8 0.004 1 3 1 3 0.06
        i 8 0.004 1 3 1 4 0.02
        i 8 0.004 1 3 1 5 0.02
        i 8 0.004 1 3 2 0 0.02
        i 8 0.004 1 3 2 1 0.02
        i 8 0.004 1 3 2 2 0.02
        i 8 0.004 1 3 2 3 0.02
        i 8 0.004 1 3 2 4 0.05
        i 8 0.004 1 3 2 5 0.05
        i 10 0.004 1 3 0 1.00
        i 10 0.004 1 3 1 1.00
        i 10 0.004 1 3 2 1.00
        i 10 0.004 1 3 3 1.00
        i 10 0.004 1 3 4 1.00
        i 10 0.004 1 3 5 1.00
        i "EndOfInstrumentAllocations" 3 -1
        i "SendStartupMessage" 0 1
        i "SendStartupMessage" 4 -1
        b $SCORE_START_DELAY
        i 9 0.01 1 4 0 1.00
        i 9 0.01 1 4 1 0.98
        i 9 0.01 1 4 5 1.00
        i 5.029 2.853 0.100 1 1098 76
        i 5.030 3.825 0.100 1 1095 79
        i 5.031 4.621 0.100 1 1103 52
        i 5.032 5.243 0.100 1 1103 78
        i 5.033 5.799 0.100 1 1095 71
        i 5.034 6.531 0.100 1 1097 58
        i 5.035 7.439 0.100 1 1097 78
        i 5.036 8.356 0.100 1 1095 72
        i 5.037 9.097 0.100 1 1103 52
        i 5.038 9.664 0.100 1 1102 79
        i 5.039 10.237 0.100 1 1096 74
        i 5.040 10.275 0.100 1 1096 77
        i 5.041 10.852 0.100 1 1094 69
        i 5.042 11.061 0.100 1 1098 74
        i 5.043 11.380 0.100 1 1102 57
        i 4.019 12.001 0.490 3 36 127 0
        i 4.020 12.501 0.490 3 36 127 1
        i 4.021 13.501 0.490 3 36 127 2
        i 4.022 15.001 0.490 3 36 127 3
        i 4.023 17.001 0.490 3 36 127 4
        i 5.044 12.024 0.100 1 1096 76
        i 5.045 12.321 0.100 1 1101 58
        i 4.025 12.751 0.490 3 36 127 0
        i 4.026 13.251 0.490 3 36 127 1
        i 4.027 14.251 0.490 3 36 127 2
        i 4.028 15.751 0.490 3 36 127 3
        i 4.029 17.751 0.490 3 36 127 4
        i 5.046 12.887 0.100 1 1094 55
        i 5.047 13.176 0.100 1 1095 82
        i 5.048 13.573 0.100 1 1104 76
        i 5.049 13.911 0.100 1 1097 60
        i 5.050 14.085 0.100 1 1102 59
        i 5.051 14.732 0.100 1 1095 62
        i 5.052 14.751 0.100 1 1096 73
        i 5.053 15.325 0.100 1 1093 64
        i 5.054 15.592 0.100 1 1099 61
        i 5.055 15.832 0.100 1 1103 75
        i 5.056 15.969 0.100 1 1099 76
        i 4.031 16.001 0.490 3 36 127 0
        i 4.032 16.501 0.490 3 36 127 1
        i 4.033 17.501 0.490 3 36 127 2
        i 4.034 19.001 0.490 3 36 127 3
        i 4.035 21.001 0.490 3 36 127 4
        i 5.057 16.576 0.100 1 1095 69
        i 5.058 16.641 0.100 1 1097 56
        i 5.059 16.752 0.100 1 1101 61
        i 4.037 16.751 0.490 3 36 127 0
        i 4.038 17.251 0.490 3 36 127 1
        i 4.039 18.251 0.490 3 36 127 2
        i 4.040 19.751 0.490 3 36 127 3
        i 4.041 21.751 0.490 3 36 127 4
        i 5.060 17.207 0.100 1 1103 79
        i 5.061 17.384 0.100 1 1093 72
        i 5.062 17.585 0.100 1 1096 74
        i 5.063 17.908 0.100 1 1105 65
        i 5.064 18.016 0.100 1 1103 69
        i 5.065 18.341 0.100 1 1098 78
        i 5.066 18.444 0.100 1 1095 59
        i 5.067 18.560 0.100 1 1101 75
        i 5.068 19.175 0.100 1 1097 55
        i 5.069 19.184 0.100 1 1094 79
        i 5.070 19.280 0.100 1 1097 83
        i 5.071 19.681 0.100 1 1099 60
        i 5.072 19.756 0.100 1 1092 81
        i 4.043 20.001 0.490 3 36 127 0
        i 4.044 20.501 0.490 3 36 127 1
        i 4.045 21.501 0.490 3 36 127 2
        i 4.046 23.001 0.490 3 36 127 3
        i 4.047 25.001 0.490 3 36 127 4
        i 5.073 20.176 0.100 1 1099 57
        i 5.074 20.272 0.100 1 1102 53
        i 5.075 20.441 0.100 1 1097 79
        i 4.049 20.751 0.490 3 38 127 0
        i 4.050 21.251 0.490 3 38 127 1
        i 4.051 22.251 0.490 3 38 127 2
        i 4.052 23.751 0.490 3 38 127 3
        i 4.053 25.751 0.490 3 38 127 4
        i 5.076 20.965 0.100 1 1104 60
        i 5.077 21.105 0.100 1 1094 59
        i 5.078 21.171 0.100 1 1100 75
        i 5.079 21.755 0.100 1 1104 64
        i 5.080 21.859 0.100 1 1092 74
        i 5.081 21.981 0.100 1 1096 56
        i 5.082 22.308 0.100 1 1096 79
        i 5.083 22.436 0.100 1 1102 78
        i 5.084 22.759 0.100 1 1098 67
        i 5.085 23.005 0.100 1 1094 73
        i 5.086 23.035 0.100 1 1100 56
        i 5.087 23.127 0.100 1 1098 69
        i 5.088 23.623 0.100 1 1093 58
        i 5.089 23.709 0.100 1 1098 72
        i 5.090 23.749 0.100 1 1092 59
        i 5.091 23.809 0.100 1 1098 67
        i 4.055 24.001 0.490 3 41 127 0
        i 4.056 24.501 0.490 3 41 127 1
        i 4.057 25.501 0.490 3 41 127 2
        i 4.058 27.001 0.490 3 41 127 3
        i 4.059 29.001 0.490 3 41 127 4
        i 5.092 24.173 0.100 1 1091 68
        i 5.093 24.509 0.100 1 1102 62
        i 5.094 24.556 0.100 1 1096 60
        i 5.095 24.711 0.100 1 1101 64
        i 4.061 24.751 0.490 3 40 127 0
        i 4.062 25.251 0.490 3 40 127 1
        i 4.063 26.251 0.490 3 40 127 2
        i 4.064 27.751 0.490 3 40 127 3
        i 4.065 29.751 0.490 3 40 127 4
        i 5.096 24.760 0.100 1 1100 68
        i 5.097 25.168 0.100 1 1104 66
        i 5.098 25.249 0.100 1 1100 69
        i 5.099 25.587 0.100 1 1099 61
        i 5.100 25.635 0.100 1 1094 82
        i 5.101 26.013 0.100 1 1095 61
        i 5.102 26.044 0.100 1 1103 75
        i 5.103 26.333 0.100 1 1092 80
        i 5.104 26.376 0.100 1 1097 84
        i 5.105 26.685 0.100 1 1097 57
        i 5.106 26.749 0.100 1 1097 62
        i 5.107 26.856 0.100 1 1101 56
        i 5.108 27.175 0.100 1 1099 65
        i 5.109 27.509 0.100 1 1099 68
        i 5.110 27.516 0.100 1 1093 79
        i 5.111 27.591 0.100 1 1099 54
        i 4.067 28.001 0.490 3 36 127 0
        i 4.068 28.501 0.490 3 36 127 1
        i 4.069 29.501 0.490 3 36 127 2
        i 4.070 31.001 0.490 3 36 127 3
        i 4.071 33.001 0.490 3 36 127 4
        i 5.112 28.060 0.100 1 1093 65
        i 5.113 28.248 0.100 1 1091 56
        i 5.114 28.261 0.100 1 1097 79
        i 5.115 28.339 0.100 1 1099 55
        i 5.116 28.589 0.100 1 1092 72
        i 4.073 28.751 0.490 3 38 127 0
        i 4.074 29.251 0.490 3 38 127 1
        i 4.075 30.251 0.490 3 38 127 2
        i 4.076 31.751 0.490 3 38 127 3
        i 4.077 33.751 0.490 3 38 127 4
        i 5.117 29.019 0.100 1 1101 66
        i 5.118 29.041 0.100 1 1101 78
        i 5.119 29.148 0.100 1 1100 59
        i 5.120 29.196 0.100 1 1095 75
        i 5.121 29.335 0.100 1 1101 75
        i 5.122 29.728 0.100 1 1099 67
        i 5.123 29.747 0.100 1 1099 75
        i 5.124 29.896 0.100 1 1105 74
        i 5.125 30.003 0.100 1 1098 76
        i 5.126 30.155 0.100 1 1093 52
        i 5.127 30.521 0.100 1 1095 71
        i 5.128 30.561 0.100 1 1103 75
        i 5.129 30.771 0.100 1 1098 54
        i 5.130 30.799 0.100 1 1093 52
        i 5.131 30.860 0.100 1 1103 56
        i 5.132 31.245 0.100 1 1098 81
        i 5.133 31.332 0.100 1 1101 57
        i 5.134 31.541 0.100 1 1105 54
        i 5.135 31.589 0.100 1 1097 81
        i 5.136 31.591 0.100 1 1100 78
        i 4.079 32.001 0.490 3 41 127 0
        i 4.080 32.501 0.490 3 41 127 1
        i 4.081 33.501 0.490 3 41 127 2
        i 4.082 35.001 0.490 3 41 127 3
        i 4.083 37.001 0.490 3 41 127 4
        i 5.137 32.024 0.100 1 1092 82
        i 5.138 32.040 0.100 1 1098 82
        i 5.139 32.416 0.100 1 1095 82
        i 5.140 32.497 0.100 1 1092 75
        i 5.141 32.583 0.100 1 1100 80
        i 5.142 32.744 0.100 1 1090 75
        i 4.085 32.751 0.490 3 43 127 0
        i 4.086 33.251 0.490 3 43 127 1
        i 4.087 34.251 0.490 3 43 127 2
        i 4.088 35.751 0.490 3 43 127 3
        i 4.089 37.751 0.490 3 43 127 4
        i 5.143 32.924 0.100 1 1100 82
        i 5.144 33.005 0.100 1 1092 80
        i 5.145 33.144 0.100 1 1097 55
        i 5.146 33.341 0.100 1 1096 83
        i 5.147 33.527 0.100 1 1100 62
        i 5.148 33.587 0.100 1 1100 55
        i 5.149 33.725 0.100 1 1101 76
        i 5.150 33.865 0.100 1 1102 61
        i 5.151 34.243 0.100 1 1098 59
        i 5.152 34.292 0.100 1 1098 57
        i 5.153 34.320 0.100 1 1094 75
        i 5.154 34.420 0.100 1 1097 58
        i 5.155 34.631 0.100 1 1092 81
        i 5.156 35.004 0.100 1 1104 71
        i 5.157 35.029 0.100 1 1096 71
        i 5.158 35.108 0.100 1 1104 64
        i 5.159 35.167 0.100 1 1099 60
        i 5.160 35.220 0.100 1 1094 80
        i 5.161 35.309 0.100 1 1092 68
        i 5.162 35.741 0.100 1 1098 73
        i 5.163 35.808 0.100 1 1100 74
        i 5.164 35.863 0.100 1 1106 83
        i 4.091 36.001 0.490 3 36 127 0
        i 4.092 36.501 0.490 3 36 127 1
        i 4.093 37.501 0.490 3 36 127 2
        i 4.094 39.001 0.490 3 36 127 3
        i 4.095 41.001 0.490 3 36 127 4
        i 5.165 36.008 0.100 1 1101 55
        i 5.166 36.057 0.100 1 1102 67
        i 5.167 36.209 0.100 1 1090 77
        i 5.168 36.532 0.100 1 1092 79
        i 5.169 36.572 0.100 1 1098 74
        i 5.170 36.720 0.100 1 1100 63
        i 4.097 36.751 0.490 3 38 127 0
        i 4.098 37.251 0.490 3 38 127 1
        i 4.099 38.251 0.490 3 38 127 2
        i 4.100 39.751 0.490 3 38 127 3
        i 4.101 41.751 0.490 3 38 127 4
        i 5.171 36.859 0.100 1 1096 83
        i 5.172 36.875 0.100 1 1098 79
        i 5.173 36.936 0.100 1 1091 63
        i 5.174 37.240 0.100 1 1091 64
        i 5.175 37.301 0.100 1 1098 77
        i 5.176 37.451 0.100 1 1093 54
        i 5.177 37.511 0.100 1 1100 56
        i 5.178 37.708 0.100 1 1098 66
        i 5.179 37.795 0.100 1 1100 57
        i 5.180 38.035 0.100 1 1099 59
        i 5.181 38.053 0.100 1 1099 74
        i 5.182 38.131 0.100 1 1094 68
        i 5.183 38.397 0.100 1 1103 78
        i 5.184 38.411 0.100 1 1100 70
        i 5.185 38.641 0.100 1 1095 56
        i 5.186 38.740 0.100 1 1097 78
        i 5.187 38.865 0.100 1 1097 74
        i 5.188 38.868 0.100 1 1097 60
        i 5.189 38.967 0.100 1 1098 68
        i 5.190 39.108 0.100 1 1093 56
        i 5.191 39.532 0.100 1 1093 80
        i 5.192 39.539 0.100 1 1097 52
        i 5.193 39.559 0.100 1 1105 58
        i 5.194 39.591 0.100 1 1100 73
        i 5.195 39.643 0.100 1 1095 68
        i 5.196 39.723 0.100 1 1091 60
        i 4.103 40.001 0.490 3 41 127 0
        i 4.104 40.501 0.490 3 41 127 1
        i 4.105 41.501 0.490 3 41 127 2
        i 4.106 43.001 0.490 3 41 127 3
        i 4.107 45.001 0.490 3 41 127 4
        i 5.197 40.240 0.100 1 1099 73
        i 5.198 40.285 0.100 1 1099 74
        i 5.199 40.296 0.100 1 1105 60
        i 5.200 40.408 0.100 1 1103 56
        i 5.201 40.453 0.100 1 1102 75
        i 5.202 40.668 0.100 1 1089 76
        i 4.109 40.751 0.490 3 40 127 0
        i 4.110 41.251 0.490 3 40 127 1
        i 4.111 42.251 0.490 3 40 127 2
        i 4.112 43.751 0.490 3 40 127 3
        i 4.113 45.751 0.490 3 40 127 4
        i 5.203 41.043 0.100 1 1091 72
        i 5.204 41.104 0.100 1 1097 55
        i 5.205 41.180 0.100 1 1097 76
        i 5.206 41.204 0.100 1 1099 53
        i 5.207 41.269 0.100 1 1101 77
        i 5.208 41.403 0.100 1 1092 77
        i 5.209 41.424 0.100 1 1103 75
        i 5.210 41.740 0.100 1 1091 69
        i 5.211 41.831 0.100 1 1097 53
        i 5.212 41.940 0.100 1 1094 84
        i 5.213 42.097 0.100 1 1101 52
        i 5.214 42.151 0.100 1 1099 81
        i 5.215 42.175 0.100 1 1099 81
        i 5.216 42.381 0.100 1 1101 74
        i 5.217 42.547 0.100 1 1098 72
        i 5.218 42.564 0.100 1 1098 77
        i 5.219 42.615 0.100 1 1095 63
        i 5.220 42.929 0.100 1 1103 54
        i 5.221 42.975 0.100 1 1099 60
        i 5.222 42.984 0.100 1 1103 66
        i 5.223 43.007 0.100 1 1101 62
        i 5.224 43.240 0.100 1 1096 64
        i 5.225 43.308 0.100 1 1097 49
        i 5.226 43.355 0.100 1 1096 68
        i 5.227 43.585 0.100 1 1094 64
        i 5.228 43.644 0.100 1 1105 70
        i 5.229 43.652 0.100 1 1097 80
        i 5.230 43.941 0.100 1 1095 73
        i 4.115 44.001 0.490 3 40 127 0
        i 4.116 44.501 0.490 3 40 127 1
        i 4.117 45.501 0.490 3 40 127 2
        i 4.118 47.001 0.490 3 40 127 3
        i 4.119 49.001 0.490 3 40 127 4
        i 5.231 44.051 0.100 1 1098 73
        i 5.232 44.059 0.100 1 1100 65
        i 5.233 44.107 0.100 1 1096 53
        i 5.234 44.183 0.100 1 1105 80
        i 5.235 44.207 0.100 1 1091 49
        i 5.236 44.428 0.100 1 1095 67
        i 5.237 44.740 0.100 1 1100 56
        i 5.238 44.744 0.100 1 1093 81
        i 4.121 44.751 0.490 3 38 127 0
        i 4.122 45.251 0.490 3 38 127 1
        i 4.123 46.251 0.490 3 38 127 2
        i 4.124 47.751 0.490 3 38 127 3
        i 4.125 49.751 0.490 3 38 127 4
        i 5.239 44.800 0.100 1 1105 71
        i 5.240 44.804 0.100 1 1098 58
        i 5.241 44.943 0.100 1 1102 62
        i 5.242 45.155 0.100 1 1098 49
        i 5.243 45.196 0.100 1 1090 65
        i 5.244 45.555 0.100 1 1090 67
        i 5.245 45.564 0.100 1 1098 81
        i 5.246 45.677 0.100 1 1096 74
        i 5.247 45.708 0.100 1 1102 71
        i 5.248 45.777 0.100 1 1098 67
        i 5.249 45.915 0.100 1 1093 71
        i 5.250 45.988 0.100 1 1102 55
        i 5.251 46.240 0.100 1 1092 80
        i 5.252 46.449 0.100 1 1096 71
        i 5.253 46.473 0.100 1 1095 74
        i 5.254 46.473 0.100 1 1100 73
        i 5.255 46.481 0.100 1 1100 57
        i 5.256 46.631 0.100 1 1102 84
        i 5.257 46.825 0.100 1 1090 62
        i 5.258 46.879 0.100 1 1100 61
        i 5.259 47.059 0.100 1 1098 54
        i 5.260 47.119 0.100 1 1097 63
        i 5.261 47.188 0.100 1 1096 50
        i 5.262 47.368 0.100 1 1088 62
        i 5.263 47.408 0.100 1 1104 81
        i 5.264 47.419 0.100 1 1098 77
        i 5.265 47.432 0.100 1 1104 76
        i 5.266 47.475 0.100 1 1100 58
        i 5.267 47.740 0.100 1 1096 80
        i 5.268 47.836 0.100 1 1098 75
        i 5.269 47.888 0.100 1 1095 83
        i 5.270 47.937 0.100 1 1106 65
        i 4.127 48.001 0.490 3 36 127 0
        i 4.128 48.501 0.490 3 36 127 1
        i 4.129 49.501 0.490 3 36 127 2
        i 4.130 51.001 0.490 3 36 127 3
        i 4.131 53.001 0.490 3 36 127 4
        i 5.271 48.009 0.100 1 1094 67
        i 5.272 48.091 0.100 1 1098 63
        i 5.273 48.217 0.100 1 1096 78
        i 5.274 48.219 0.100 1 1102 78
        i 5.275 48.561 0.100 1 1099 65
        i 5.276 48.571 0.100 1 1101 79
        i 5.277 48.585 0.100 1 1096 73
        i 4.133 48.751 0.490 3 36 127 0
        i 4.134 49.251 0.490 3 36 127 1
        i 4.135 50.251 0.490 3 36 127 2
        i 4.136 51.751 0.490 3 36 127 3
        i 4.137 53.751 0.490 3 36 127 4
        i 5.278 48.780 0.100 1 1090 64
        i 5.279 48.869 0.100 1 1106 52
        i 5.280 48.876 0.100 1 1096 50
        i 5.281 48.993 0.100 1 1096 52
        i 5.282 49.197 0.100 1 1094 83
        i 5.283 49.239 0.100 1 1101 67
        i 5.284 49.337 0.100 1 1097 64
        i 5.285 49.375 0.100 1 1104 81
        i 5.286 49.476 0.100 1 1103 72
        i 5.287 49.747 0.100 1 1090 56
        i 5.288 49.756 0.100 1 1098 58
        i 5.289 49.912 0.100 1 1094 75
        i 5.290 49.913 0.100 1 1094 74
        i 5.291 50.017 0.100 1 1098 61
        i 5.292 50.064 0.100 1 1091 74
        i 5.293 50.265 0.100 1 1095 53
        i 5.294 50.372 0.100 1 1097 50
        i 5.295 50.435 0.100 1 1102 64
        i 5.296 50.469 0.100 1 1093 65
        i 5.297 50.653 0.100 1 1096 57
        i 5.298 50.737 0.100 1 1093 56
        i 5.299 50.807 0.100 1 1101 80
        i 5.300 50.861 0.100 1 1102 70
        i 5.301 51.049 0.100 1 1096 61
        i 5.302 51.088 0.100 1 1095 60
        i 5.303 51.164 0.100 1 1103 73
        i 5.304 51.171 0.100 1 1099 70
        i 5.305 51.213 0.100 1 1089 72
        i 5.306 51.547 0.100 1 1099 79
        i 5.307 51.567 0.100 1 1097 59
        i 5.308 51.716 0.100 1 1096 65
        i 5.309 51.741 0.100 1 1097 64
        i 5.310 51.783 0.100 1 1097 49
        i 5.311 51.835 0.100 1 1089 63
        i 5.312 51.879 0.100 1 1105 77
        i 5.313 51.887 0.100 1 1103 62
        i 4.139 52.001 0.490 3 36 127 0
        i 4.140 52.501 0.490 3 36 127 1
        i 4.141 53.501 0.490 3 36 127 2
        i 4.142 55.001 0.490 3 36 127 3
        i 4.143 57.001 0.490 3 36 127 4
        i 5.314 52.236 0.100 1 1095 66
        i 5.315 52.385 0.100 1 1099 76
        i 5.316 52.433 0.100 1 1095 62
        i 5.317 52.464 0.100 1 1094 72
        i 5.318 52.467 0.100 1 1101 78
        i 5.319 52.529 0.100 1 1107 72
        i 5.320 52.635 0.100 1 1097 71
        i 5.321 52.661 0.100 1 1095 81
        i 4.145 52.751 0.490 3 38 127 0
        i 4.146 53.251 0.490 3 38 127 1
        i 4.147 54.251 0.490 3 38 127 2
        i 4.148 55.751 0.490 3 38 127 3
        i 4.149 57.751 0.490 3 38 127 4
        i 5.322 53.064 0.100 1 1097 77
        i 5.323 53.069 0.100 1 1099 64
        i 5.324 53.123 0.100 1 1103 62
        i 5.325 53.125 0.100 1 1102 65
        i 5.326 53.375 0.100 1 1089 75
        i 5.327 53.435 0.100 1 1105 58
        i 5.328 53.439 0.100 1 1097 57
        i 5.329 53.615 0.100 1 1095 62
        i 5.330 53.735 0.100 1 1102 57
        i 5.331 53.871 0.100 1 1097 70
        i 5.332 54.013 0.100 1 1093 72
        i 5.333 54.053 0.100 1 1102 69
        i 5.334 54.061 0.100 1 1103 57
        i 5.335 54.296 0.100 1 1091 63
        i 5.336 54.405 0.100 1 1099 72
        i 5.337 54.456 0.100 1 1095 55
        i 5.338 54.572 0.100 1 1092 74
        i 5.339 54.583 0.100 1 1099 77
        i 5.340 54.640 0.100 1 1095 62
        i 5.341 54.853 0.100 1 1094 82
        i 5.342 54.871 0.100 1 1105 76
        i 5.343 54.929 0.100 1 1101 67
        i 5.344 54.967 0.100 1 1097 49
        i 5.345 55.040 0.100 1 1094 54
        i 5.346 55.117 0.100 1 1097 48
        i 5.347 55.233 0.100 1 1094 56
        i 5.348 55.251 0.100 1 1101 83
        i 5.349 55.469 0.100 1 1103 52
        i 5.350 55.503 0.100 1 1101 52
        i 5.351 55.511 0.100 1 1099 48
        i 5.352 55.636 0.100 1 1089 47
        i 5.353 55.641 0.100 1 1096 83
        i 5.354 55.697 0.100 1 1104 72
        i 5.355 55.728 0.100 1 1095 80
        i 4.151 56.001 0.490 3 41 127 0
        i 4.152 56.501 0.490 3 41 127 1
        i 4.153 57.501 0.490 3 41 127 2
        i 4.154 59.001 0.490 3 41 127 3
        i 4.155 61.001 0.490 3 41 127 4
        i 5.356 56.065 0.100 1 1097 63
        i 5.357 56.075 0.100 1 1096 80
        i 5.358 56.100 0.100 1 1099 58
        i 5.359 56.329 0.100 1 1096 57
        i 5.360 56.335 0.100 1 1089 54
        i 5.361 56.340 0.100 1 1103 61
        i 5.362 56.365 0.100 1 1102 64
        i 5.363 56.372 0.100 1 1105 49
        i 5.364 56.377 0.100 1 1098 55
        i 5.365 56.732 0.100 1 1094 62
        i 4.157 56.751 0.490 3 40 127 0
        i 4.158 57.251 0.490 3 40 127 1
        i 4.159 58.251 0.490 3 40 127 2
        i 4.160 59.751 0.490 3 40 127 3
        i 4.161 61.751 0.490 3 40 127 4
        i 5.366 56.875 0.100 1 1096 83
        i 5.367 56.933 0.100 1 1101 57
        i 5.368 56.936 0.100 1 1100 62
        i 5.369 57.001 0.100 1 1105 58
        i 5.370 57.025 0.100 1 1094 80
        i 5.371 57.056 0.100 1 1093 53
        i 5.372 57.176 0.100 1 1106 49
        i 5.373 57.213 0.100 1 1096 71
        i 5.374 57.501 0.100 1 1104 67
        i 5.375 57.560 0.100 1 1098 79
        i 5.376 57.577 0.100 1 1100 74
        i 5.377 57.696 0.100 1 1103 72
        i 5.378 57.809 0.100 1 1096 56
        i 5.379 57.904 0.100 1 1090 56
        i 5.380 57.920 0.100 1 1104 55
        i 5.381 57.931 0.100 1 1098 76
        i 5.382 58.156 0.100 1 1094 50
        i 5.383 58.231 0.100 1 1102 78
        i 5.384 58.305 0.100 1 1094 62
        i 5.385 58.421 0.100 1 1096 56
        i 5.386 58.533 0.100 1 1098 79
        i 5.387 58.645 0.100 1 1101 83
        i 5.388 58.668 0.100 1 1102 67
        i 5.389 58.743 0.100 1 1100 61
        i 5.390 58.780 0.100 1 1092 76
        i 5.391 58.844 0.100 1 1096 76
        i 5.392 58.920 0.100 1 1096 60
        i 5.393 59.080 0.100 1 1092 54
        i 5.394 59.269 0.100 1 1100 68
        i 5.395 59.279 0.100 1 1104 70
        i 5.396 59.375 0.100 1 1100 66
        i 5.397 59.385 0.100 1 1094 59
        i 5.398 59.496 0.100 1 1096 49
        i 5.399 59.504 0.100 1 1098 44
        i 5.400 59.611 0.100 1 1095 67
        i 5.401 59.619 0.100 1 1100 82
        i 5.402 59.731 0.100 1 1095 80
        i 5.403 59.816 0.100 1 1102 66
        i 5.404 59.948 0.100 1 1098 76
        i 4.163 60.001 0.490 3 36 127 0
        i 4.164 60.501 0.490 3 36 127 1
        i 4.165 61.501 0.490 3 36 127 2
        i 4.166 63.001 0.490 3 36 127 3
        i 4.167 65.001 0.490 3 36 127 4
        i 5.405 60.065 0.100 1 1102 69
        i 5.406 60.101 0.100 1 1088 48
        i 5.407 60.128 0.100 1 1098 75
        i 5.408 60.175 0.100 1 1104 76
        i 5.409 60.233 0.100 1 1097 56
        i 5.410 60.303 0.100 1 1094 66
        i 5.411 60.509 0.100 1 1096 55
        i 5.412 60.584 0.100 1 1095 84
        i 5.413 60.748 0.100 1 1104 53
        i 4.169 60.751 0.490 3 38 127 0
        i 4.170 61.251 0.490 3 38 127 1
        i 4.171 62.251 0.490 3 38 127 2
        i 4.172 63.751 0.490 3 38 127 3
        i 4.173 65.751 0.490 3 38 127 4
        i 5.414 60.788 0.100 1 1101 65
        i 5.415 60.873 0.100 1 1102 70
        i 5.416 60.879 0.100 1 1090 46
        i 5.417 60.907 0.100 1 1098 66
        i 5.418 60.933 0.100 1 1106 68
        i 5.419 60.943 0.100 1 1095 80
        i 5.420 61.231 0.100 1 1093 79
        i 5.421 61.349 0.100 1 1094 72
        i 5.422 61.352 0.100 1 1097 73
        i 5.423 61.395 0.100 1 1104 60
        i 5.424 61.420 0.100 1 1101 75
        i 5.425 61.597 0.100 1 1106 52
        i 5.426 61.648 0.100 1 1093 84
        i 5.427 61.836 0.100 1 1096 72
        i 5.428 61.892 0.100 1 1106 57
        i 5.429 62.088 0.100 1 1101 74
        i 5.430 62.092 0.100 1 1099 69
        i 5.431 62.111 0.100 1 1094 79
        i 5.432 62.219 0.100 1 1096 53
        i 5.433 62.265 0.100 1 1102 57
        i 5.434 62.336 0.100 1 1103 69
        i 5.435 62.343 0.100 1 1091 49
        i 5.436 62.492 0.100 1 1099 70
        i 5.437 62.661 0.100 1 1097 62
        i 5.438 62.701 0.100 1 1093 73
        i 5.439 62.731 0.100 1 1101 58
        i 5.440 63.008 0.100 1 1095 74
        i 5.441 63.131 0.100 1 1098 54
        i 5.442 63.149 0.100 1 1101 67
        i 5.443 63.175 0.100 1 1093 54
        i 5.444 63.205 0.100 1 1101 54
        i 5.445 63.236 0.100 1 1100 56
        i 5.446 63.348 0.100 1 1099 70
        i 5.447 63.387 0.100 1 1097 45
        i 5.448 63.592 0.100 1 1093 66
        i 5.449 63.689 0.100 1 1103 61
        i 5.450 63.892 0.100 1 1099 47
        i 5.451 63.917 0.100 1 1093 80
        i 5.452 63.928 0.100 1 1097 53
        i 5.453 63.928 0.100 1 1101 71
        i 5.454 63.935 0.100 1 1095 72
        i 5.455 63.935 0.100 1 1099 67
        i 4.175 64.001 0.490 3 41 127 0
        i 4.176 64.501 0.490 3 41 127 1
        i 4.177 65.501 0.490 3 41 127 2
        i 4.178 67.001 0.490 3 41 127 3
        i 4.179 69.001 0.490 3 41 127 4
        i 5.456 64.180 0.100 1 1096 74
        i 5.457 64.231 0.100 1 1095 69
        i 5.458 64.504 0.100 1 1103 79
        i 5.459 64.568 0.100 1 1089 45
        i 5.460 64.585 0.100 1 1103 73
        i 5.461 64.652 0.100 1 1103 83
        i 5.462 64.663 0.100 1 1097 77
        i 5.463 64.664 0.100 1 1101 76
        i 4.181 64.751 0.490 3 43 127 0
        i 4.182 65.251 0.490 3 43 127 1
        i 4.183 66.251 0.490 3 43 127 2
        i 4.184 67.751 0.490 3 43 127 3
        i 4.185 69.751 0.490 3 43 127 4
        i 5.464 64.785 0.100 1 1093 54
        i 5.465 64.824 0.100 1 1098 61
        i 5.466 65.076 0.100 1 1095 58
        i 5.467 65.096 0.100 1 1095 72
        i 5.468 65.169 0.100 1 1105 69
        i 5.469 65.195 0.100 1 1105 71
        i 5.470 65.211 0.100 1 1101 75
        i 5.471 65.245 0.100 1 1107 77
        i 5.472 65.344 0.100 1 1099 50
        i 5.473 65.423 0.100 1 1091 56
        i 5.474 65.493 0.100 1 1107 55
        i 5.475 65.555 0.100 1 1094 53
        i 5.476 65.731 0.100 1 1092 70
        i 5.477 65.795 0.100 1 1095 57
        i 5.478 65.823 0.100 1 1095 56
        i 5.479 65.829 0.100 1 1098 72
        i 5.480 65.877 0.100 1 1101 67
        i 5.481 66.005 0.100 1 1105 62
        i 5.482 66.133 0.100 1 1107 56
        i 5.483 66.237 0.100 1 1092 62
        i 5.484 66.381 0.100 1 1105 63
        i 5.485 66.389 0.100 1 1095 57
        i 5.486 66.461 0.100 1 1097 64
        i 5.487 66.600 0.100 1 1102 78
        i 5.488 66.624 0.100 1 1100 70
        i 5.489 66.645 0.100 1 1103 56
        i 5.490 66.660 0.100 1 1103 64
        i 5.491 66.701 0.100 1 1097 74
        i 5.492 66.755 0.100 1 1091 67
        i 5.493 66.833 0.100 1 1102 79
        i 5.494 66.937 0.100 1 1099 69
        i 5.495 67.060 0.100 1 1098 58
        i 5.496 67.176 0.100 1 1093 63
        i 5.497 67.231 0.100 1 1100 57
        i 5.498 67.441 0.100 1 1101 67
        i 5.499 67.541 0.100 1 1094 56
        i 5.500 67.595 0.100 1 1094 81
        i 5.501 67.604 0.100 1 1099 66
        i 5.502 67.628 0.100 1 1106 78
        i 5.503 67.649 0.100 1 1101 64
        i 5.504 67.728 0.100 1 1096 79
        i 5.505 67.783 0.100 1 1097 69
        i 5.506 67.825 0.100 1 1100 59
        i 4.187 68.001 0.490 3 36 127 0
        i 4.188 68.501 0.490 3 36 127 1
        i 4.189 69.501 0.490 3 36 127 2
        i 4.190 71.001 0.490 3 36 127 3
        i 4.191 73.001 0.490 3 36 127 4
        i 5.507 68.104 0.100 1 1094 73
        i 5.508 68.235 0.100 1 1103 78
        i 5.509 68.297 0.100 1 1104 54
        i 5.510 68.347 0.100 1 1094 79
        i 5.511 68.356 0.100 1 1100 67
        i 5.512 68.381 0.100 1 1098 80
        i 5.513 68.449 0.100 1 1092 53
        i 5.514 68.493 0.100 1 1102 63
        i 5.515 68.527 0.100 1 1098 77
        i 5.516 68.731 0.100 1 1096 61
        i 5.517 68.748 0.100 1 1097 82
        i 4.193 68.751 0.490 3 38 127 0
        i 4.194 69.251 0.490 3 38 127 1
        i 4.195 70.251 0.490 3 38 127 2
        i 4.196 71.751 0.490 3 38 127 3
        i 4.197 73.751 0.490 3 38 127 4
        i 5.518 68.995 0.100 1 1104 71
        i 5.519 69.075 0.100 1 1100 52
        i 5.520 69.109 0.100 1 1090 44
        i 5.521 69.129 0.100 1 1102 62
        i 5.522 69.191 0.100 1 1104 83
        i 5.523 69.243 0.100 1 1092 52
        i 5.524 69.249 0.100 1 1098 77
        i 5.525 69.264 0.100 1 1096 74
        i 5.526 69.413 0.100 1 1099 53
        i 5.527 69.535 0.100 1 1096 60
        i 5.528 69.607 0.100 1 1094 82
        i 5.529 69.633 0.100 1 1100 78
        i 5.530 69.741 0.100 1 1094 62
        i 5.531 69.757 0.100 1 1100 79
        i 5.532 69.768 0.100 1 1106 54
        i 5.533 69.940 0.100 1 1106 66
        i 5.534 70.043 0.100 1 1092 71
        i 5.535 70.092 0.100 1 1106 53
        i 5.536 70.165 0.100 1 1093 57
        i 5.537 70.229 0.100 1 1092 53
        i 5.538 70.261 0.100 1 1098 65
        i 5.539 70.307 0.100 1 1098 62
        i 5.540 70.335 0.100 1 1100 58
        i 5.541 70.339 0.100 1 1096 69
        i 5.542 70.545 0.100 1 1108 63
        i 5.543 70.631 0.100 1 1104 77
        i 5.544 70.675 0.100 1 1104 71
        i 5.545 70.772 0.100 1 1098 59
        i 5.546 70.827 0.100 1 1091 54
        i 5.547 70.931 0.100 1 1094 75
        i 5.548 71.083 0.100 1 1102 76
        i 5.549 71.109 0.100 1 1101 70
        i 5.550 71.156 0.100 1 1100 77
        i 5.551 71.168 0.100 1 1092 64
        i 5.552 71.213 0.100 1 1104 62
        i 5.553 71.301 0.100 1 1098 75
        i 5.554 71.384 0.100 1 1100 73
        i 5.555 71.401 0.100 1 1101 72
        i 5.556 71.528 0.100 1 1096 54
        i 5.557 71.639 0.100 1 1092 51
        i 5.558 71.728 0.100 1 1099 73
        i 5.559 71.909 0.100 1 1094 50
        i 5.560 71.973 0.100 1 1100 78
        i 4.199 72.001 0.490 3 41 127 0
        i 4.200 72.501 0.490 3 41 127 1
        i 4.201 73.501 0.490 3 41 127 2
        i 4.202 75.001 0.490 3 41 127 3
        i 4.203 77.001 0.490 3 41 127 4
        i 5.561 72.012 0.100 1 1106 70
        i 5.562 72.016 0.100 1 1100 53
        i 5.563 72.036 0.100 1 1102 80
        i 5.564 72.048 0.100 1 1105 73
        i 5.565 72.132 0.100 1 1093 71
        i 5.566 72.168 0.100 1 1098 66
        i 5.567 72.389 0.100 1 1099 71
        i 5.568 72.612 0.100 1 1095 72
        i 5.569 72.691 0.100 1 1098 56
        i 4.205 72.751 0.490 3 40 127 0
        i 4.206 73.251 0.490 3 40 127 1
        i 4.207 74.251 0.490 3 40 127 2
        i 4.208 75.751 0.490 3 40 127 3
        i 4.209 77.751 0.490 3 40 127 4
        i 5.570 72.760 0.100 1 1093 69
        i 5.571 72.820 0.100 1 1100 50
        i 5.572 72.833 0.100 1 1103 70
        i 5.573 72.835 0.100 1 1102 59
        i 5.574 72.932 0.100 1 1093 82
        i 5.575 72.937 0.100 1 1102 58
        i 5.576 72.943 0.100 1 1098 54
        i 5.577 73.227 0.100 1 1097 68
        i 5.578 73.291 0.100 1 1097 66
        i 5.579 73.383 0.100 1 1097 63
        i 5.580 73.487 0.100 1 1100 78
        i 5.581 73.557 0.100 1 1101 82
        i 5.582 73.633 0.100 1 1099 50
        i 5.583 73.652 0.100 1 1091 55
        i 5.584 73.701 0.100 1 1091 71
        i 5.585 73.756 0.100 1 1105 73
        i 5.586 73.907 0.100 1 1095 64
        i 5.587 73.977 0.100 1 1100 56
        i 5.588 74.109 0.100 1 1099 62
        i 5.589 74.115 0.100 1 1093 59
        i 5.590 74.197 0.100 1 1099 53
        i 5.591 74.233 0.100 1 1101 65
        i 5.592 74.367 0.100 1 1106 55
        i 5.593 74.428 0.100 1 1095 61
        i 5.594 74.429 0.100 1 1105 62
        i 5.595 74.572 0.100 1 1105 58
        i 5.596 74.641 0.100 1 1093 51
        i 5.597 74.725 0.100 1 1091 53
        i 5.598 74.752 0.100 1 1092 82
        i 5.599 74.776 0.100 1 1097 59
        i 5.600 74.837 0.100 1 1099 61
        i 5.601 74.856 0.100 1 1099 72
        i 5.602 74.953 0.100 1 1097 53
        i 5.603 74.956 0.100 1 1107 69
        i 5.604 75.009 0.100 1 1103 56
        i 5.605 75.255 0.100 1 1103 50
        i 5.606 75.392 0.100 1 1092 61
        i 5.607 75.452 0.100 1 1093 51
        i 5.608 75.576 0.100 1 1101 78
        i 5.609 75.617 0.100 1 1101 74
        i 5.610 75.620 0.100 1 1095 73
        i 5.611 75.644 0.100 1 1093 63
        i 5.612 75.741 0.100 1 1101 59
        i 5.613 75.873 0.100 1 1101 58
        i 5.614 75.899 0.100 1 1099 51
        i 5.615 75.945 0.100 1 1100 69
        i 4.211 76.001 0.490 3 40 127 0
        i 4.212 76.501 0.490 3 40 127 1
        i 4.213 77.501 0.490 3 40 127 2
        i 4.214 79.001 0.490 3 40 127 3
        i 4.215 81.001 0.490 3 40 127 4
        i 5.616 76.059 0.100 1 1105 60
        i 5.617 76.083 0.100 1 1091 73
        i 5.618 76.224 0.100 1 1099 80
        i 5.619 76.228 0.100 1 1105 61
        i 5.620 76.341 0.100 1 1095 72
        i 5.621 76.345 0.100 1 1099 54
        i 5.622 76.425 0.100 1 1101 57
        i 5.623 76.633 0.100 1 1099 68
        i 5.624 76.636 0.100 1 1107 72
        i 5.625 76.663 0.100 1 1093 73
        i 5.626 76.680 0.100 1 1103 59
        i 5.627 76.737 0.100 1 1109 78
        i 4.217 76.751 0.490 3 38 127 0
        i 4.218 77.251 0.490 3 38 127 1
        i 4.219 78.251 0.490 3 38 127 2
        i 4.220 79.751 0.490 3 38 127 3
        i 4.221 81.751 0.490 3 38 127 4
        i 5.628 76.912 0.100 1 1098 76
        i 5.629 77.101 0.100 1 1102 78
        i 5.630 77.120 0.100 1 1096 65
        i 5.631 77.180 0.100 1 1097 59
        i 5.632 77.236 0.100 1 1093 75
        i 5.633 77.261 0.100 1 1103 75
        i 5.634 77.364 0.100 1 1099 44
        i 5.635 77.408 0.100 1 1094 82
        i 5.636 77.421 0.100 1 1101 74
        i 5.637 77.432 0.100 1 1097 71
        i 5.638 77.621 0.100 1 1107 72
        i 5.639 77.723 0.100 1 1098 75
        i 5.640 77.739 0.100 1 1098 76
        i 5.641 77.792 0.100 1 1098 75
        i 5.642 77.959 0.100 1 1099 77
        i 5.643 77.979 0.100 1 1100 59
        i 5.644 78.017 0.100 1 1099 60
        i 5.645 78.200 0.100 1 1105 82
        i 5.646 78.223 0.100 1 1091 63
        i 5.647 78.243 0.100 1 1095 79
        i 5.648 78.273 0.100 1 1091 59
        i 5.649 78.500 0.100 1 1100 65
        i 5.650 78.529 0.100 1 1104 51
        i 5.651 78.585 0.100 1 1098 83
        i 5.652 78.623 0.100 1 1092 82
        i 5.653 78.641 0.100 1 1100 51
        i 5.654 78.735 0.100 1 1104 57
        i 5.655 78.800 0.100 1 1100 55
        i 5.656 78.876 0.100 1 1105 72
        i 5.657 78.892 0.100 1 1107 57
        i 5.658 78.992 0.100 1 1095 52
        i 5.659 79.185 0.100 1 1093 55
        i 5.660 79.221 0.100 1 1090 66
        i 5.661 79.228 0.100 1 1106 66
        i 5.662 79.296 0.100 1 1092 58
        i 5.663 79.308 0.100 1 1096 79
        i 5.664 79.368 0.100 1 1100 60
        i 5.665 79.452 0.100 1 1102 64
        i 5.666 79.468 0.100 1 1098 72
        i 5.667 79.491 0.100 1 1107 73
        i 5.668 79.639 0.100 1 1098 53
        i 5.669 79.639 0.100 1 1102 57
        i 5.670 79.740 0.100 1 1100 66
        i 5.671 79.915 0.100 1 1093 59
        i 5.672 79.917 0.100 1 1092 45
        i 4.223 80.001 0.490 3 36 127 0
        i 4.224 80.501 0.490 3 36 127 1
        i 4.225 81.501 0.490 3 36 127 2
        i 4.226 83.001 0.490 3 36 127 3
        i 4.227 85.001 0.490 3 36 127 4
        i 5.673 80.125 0.100 1 1100 82
        i 5.674 80.140 0.100 1 1100 80
        i 5.675 80.211 0.100 1 1094 55
        i 5.676 80.239 0.100 1 1094 76
        i 5.677 80.327 0.100 1 1102 82
        i 5.678 80.361 0.100 1 1100 64
        i 5.679 80.435 0.100 1 1102 64
        i 5.680 80.447 0.100 1 1099 75
        i 5.681 80.460 0.100 1 1098 75
        i 5.682 80.469 0.100 1 1090 73
        i 5.683 80.616 0.100 1 1106 59
        i 5.684 80.721 0.100 1 1098 53
        i 4.229 80.751 0.490 3 36 127 0
        i 4.230 81.251 0.490 3 36 127 1
        i 4.231 82.251 0.490 3 36 127 2
        i 4.232 83.751 0.490 3 36 127 3
        i 4.233 85.751 0.490 3 36 127 4
        i 5.685 80.788 0.100 1 1098 78
        i 5.686 80.863 0.100 1 1096 67
        i 5.687 80.935 0.100 1 1104 54
        i 5.688 81.023 0.100 1 1102 56
        i 5.689 81.097 0.100 1 1100 51
        i 5.690 81.193 0.100 1 1092 57
        i 5.691 81.260 0.100 1 1108 77
        i 5.692 81.389 0.100 1 1108 68
        i 5.693 81.392 0.100 1 1097 62
        i 5.694 81.395 0.100 1 1104 61
        i 5.695 81.583 0.100 1 1104 70
        i 5.696 81.629 0.100 1 1096 58
        i 5.697 81.803 0.100 1 1092 71
        i 5.698 81.831 0.100 1 1100 69
        i 5.699 81.884 0.100 1 1094 70
        i 5.700 81.895 0.100 1 1102 79
        i 5.701 81.905 0.100 1 1098 69
        i 5.702 81.993 0.100 1 1096 57
        i 5.703 82.024 0.100 1 1098 74
        i 5.704 82.221 0.100 1 1099 69
        i 5.705 82.251 0.100 1 1099 60
        i 5.706 82.252 0.100 1 1106 53
        i 5.707 82.399 0.100 1 1100 68
        i 5.708 82.524 0.100 1 1106 81
        i 5.709 82.555 0.100 1 1098 73
        i 5.710 82.620 0.100 1 1098 80
        i 5.711 82.641 0.100 1 1100 77
        i 5.712 82.649 0.100 1 1096 57
        i 5.713 82.773 0.100 1 1090 49
        i 5.714 82.893 0.100 1 1092 74
        i 5.715 82.907 0.100 1 1104 71
        i 5.716 82.981 0.100 1 1101 81
        i 5.717 83.060 0.100 1 1097 73
        i 5.718 83.133 0.100 1 1091 72
        i 5.719 83.145 0.100 1 1104 52
        i 5.720 83.300 0.100 1 1108 49
        i 5.721 83.395 0.100 1 1100 65
        i 5.722 83.437 0.100 1 1096 70
        i 5.723 83.437 0.100 1 1104 66
        i 5.724 83.463 0.100 1 1107 56
        i 5.725 83.609 0.100 1 1101 56
        i 5.726 83.721 0.100 1 1091 59
        i 5.727 83.727 0.100 1 1094 51
        i 5.728 83.799 0.100 1 1091 78
        i 5.729 83.897 0.100 1 1101 82
        i 5.730 84.021 0.100 1 1102 48
        i 5.731 84.087 0.100 1 1106 79
        i 5.732 84.107 0.100 1 1097 59
        i 5.733 84.168 0.100 1 1102 76
        i 5.734 84.204 0.100 1 1098 84
        i 5.735 84.228 0.100 1 1099 60
        i 5.736 84.364 0.100 1 1095 51
        i 5.737 84.380 0.100 1 1092 53
        i 5.738 84.396 0.100 1 1093 62
        i 5.739 84.637 0.100 1 1099 61
        i 5.740 84.769 0.100 1 1100 50
        i 5.741 84.777 0.100 1 1107 74
        i 5.742 84.804 0.100 1 1095 73
        i 5.743 84.825 0.100 1 1099 63
        i 5.744 84.885 0.100 1 1103 59
        i 5.745 84.907 0.100 1 1099 69
        i 5.746 84.907 0.100 1 1089 62
        i 5.747 84.997 0.100 1 1103 73
        i 5.748 85.203 0.100 1 1099 78
        i 5.749 85.221 0.100 1 1097 67
        i 5.750 85.347 0.100 1 1093 71
        i 5.751 85.352 0.100 1 1097 83
        i 5.752 85.411 0.100 1 1097 76
        i 5.753 85.613 0.100 1 1099 55
        i 5.754 85.619 0.100 1 1102 66
        i 5.755 85.643 0.100 1 1109 49
        i 5.756 85.697 0.100 1 1093 61
        i 5.757 85.831 0.100 1 1096 53
        i 5.758 85.884 0.100 1 1105 49
        i 4.235 86.001 0.490 3 36 127 0
        i 4.236 86.501 0.490 3 36 127 1
        i 4.237 87.501 0.490 3 36 127 2
        i 4.238 89.001 0.490 3 36 127 3
        i 4.239 91.001 0.490 3 36 127 4
        i 5.759 86.021 0.100 1 1107 55
        i 5.760 86.025 0.100 1 1105 71
        i 5.761 86.131 0.100 1 1103 56
        i 5.762 86.141 0.100 1 1097 61
        i 5.763 86.240 0.100 1 1099 57
        i 5.764 86.333 0.100 1 1095 64
        i 5.765 86.396 0.100 1 1091 66
        i 5.766 86.441 0.100 1 1095 70
        i 5.767 86.500 0.100 1 1097 53
        i 5.768 86.628 0.100 1 1099 64
        i 5.769 86.631 0.100 1 1105 56
        i 5.770 86.667 0.100 1 1100 76
        i 5.771 86.721 0.100 1 1099 74
        i 4.241 86.751 0.490 3 36 127 0
        i 4.242 87.251 0.490 3 36 127 1
        i 4.243 88.251 0.490 3 36 127 2
        i 4.244 89.751 0.490 3 36 127 3
        i 4.245 91.751 0.490 3 36 127 4
        i 5.772 86.845 0.100 1 1105 77
        i 5.773 86.875 0.100 1 1099 65
        i 5.774 86.943 0.100 1 1097 71
        i 5.775 87.084 0.100 1 1101 61
        i 5.776 87.152 0.100 1 1097 61
        i 5.777 87.232 0.100 1 1105 51
        i 5.778 87.233 0.100 1 1101 79
        i 5.779 87.321 0.100 1 1089 51
        i 5.780 87.419 0.100 1 1102 74
        i 5.781 87.435 0.100 1 1093 59
        i 5.782 87.591 0.100 1 1097 63
        i 5.783 87.645 0.100 1 1091 83
        i 5.784 87.711 0.100 1 1107 59
        i 5.785 87.812 0.100 1 1097 55
        i 5.786 87.885 0.100 1 1103 49
        i 5.787 87.897 0.100 1 1099 61
        i 5.788 87.959 0.100 1 1103 49
        i 5.789 87.988 0.100 1 1099 55
        i 5.790 88.043 0.100 1 1107 56
        i 5.791 88.191 0.100 1 1095 43
        i 5.792 88.221 0.100 1 1092 68
        i 5.793 88.257 0.100 1 1092 80
        i 5.794 88.483 0.100 1 1102 64
        i 5.795 88.615 0.100 1 1101 77
        i 5.796 88.685 0.100 1 1105 63
        i 5.797 88.700 0.100 1 1099 70
        i 5.798 88.745 0.100 1 1097 68
        i 5.799 88.767 0.100 1 1091 45
        i 5.800 88.769 0.100 1 1101 50
        i 5.801 88.821 0.100 1 1101 68
        i 5.802 88.833 0.100 1 1094 84
        i 5.803 89.025 0.100 1 1099 76
        i 5.804 89.149 0.100 1 1098 75
        i 5.805 89.151 0.100 1 1107 58
        i 5.806 89.191 0.100 1 1101 49
        i 5.807 89.345 0.100 1 1098 65
        i 5.808 89.372 0.100 1 1089 56
        i 5.809 89.396 0.100 1 1111 79
        i 5.810 89.399 0.100 1 1095 52
        i 5.811 89.416 0.100 1 1104 66
        i 5.812 89.441 0.100 1 1099 77
        i 5.813 89.444 0.100 1 1103 72
        i 5.814 89.664 0.100 1 1094 67
        i 5.815 89.721 0.100 1 1096 74
        i 5.816 89.799 0.100 1 1100 54
        i 5.817 89.923 0.100 1 1108 50
        i 5.818 89.961 0.100 1 1098 53
        i 5.819 90.037 0.100 1 1097 68
        i 5.820 90.067 0.100 1 1108 51
        i 5.821 90.155 0.100 1 1103 75
        i 5.822 90.157 0.100 1 1099 62
        i 5.823 90.173 0.100 1 1094 63
        i 5.824 90.176 0.100 1 1105 56
        i 5.825 90.248 0.100 1 1096 77
        i 5.826 90.363 0.100 1 1106 68
        i 5.827 90.559 0.100 1 1094 69
        i 5.828 90.589 0.100 1 1106 73
        i 5.829 90.599 0.100 1 1104 78
        i 5.830 90.653 0.100 1 1098 56
        i 5.831 90.723 0.100 1 1099 56
        i 5.832 90.755 0.100 1 1096 58
        i 5.833 90.863 0.100 1 1100 59
        i 5.834 90.888 0.100 1 1096 75
        i 5.835 90.933 0.100 1 1090 75
        i 5.836 91.009 0.100 1 1104 61
        i 5.837 91.063 0.100 1 1101 53
        i 5.838 91.121 0.100 1 1096 55
        i 5.839 91.221 0.100 1 1100 53
        i 5.840 91.221 0.100 1 1106 55
        i 5.841 91.288 0.100 1 1104 83
        i 5.842 91.351 0.100 1 1098 71
        i 5.843 91.431 0.100 1 1102 79
        i 5.844 91.541 0.100 1 1098 69
        i 5.845 91.625 0.100 1 1096 73
        i 5.846 91.688 0.100 1 1102 76
        i 5.847 91.803 0.100 1 1102 55
        i 5.848 91.813 0.100 1 1090 66
        i 5.849 91.836 0.100 1 1103 53
        i 5.850 91.864 0.100 1 1106 64
        i 5.851 91.979 0.100 1 1094 69
        i 4.247 92.001 0.490 3 36 127 0
        i 4.248 92.501 0.490 3 36 127 1
        i 4.249 93.501 0.490 3 36 127 2
        i 4.250 95.001 0.490 3 36 127 3
        i 4.251 97.001 0.490 3 36 127 4
        i 5.852 92.121 0.100 1 1096 57
        i 5.853 92.133 0.100 1 1098 82
        i 5.854 92.156 0.100 1 1090 77
        i 5.855 92.256 0.100 1 1106 51
        i 5.856 92.296 0.100 1 1100 81
        i 5.857 92.447 0.100 1 1102 65
        i 5.858 92.521 0.100 1 1100 73
        i 5.859 92.525 0.100 1 1098 49
        i 5.860 92.633 0.100 1 1102 58
        i 5.861 92.656 0.100 1 1096 71
        i 5.862 92.696 0.100 1 1093 70
        i 5.863 92.720 0.100 1 1092 69
        i 4.253 92.751 0.490 3 36 127 0
        i 4.254 93.251 0.490 3 36 127 1
        i 4.255 94.251 0.490 3 36 127 2
        i 4.256 95.751 0.490 3 36 127 3
        i 4.257 97.751 0.490 3 36 127 4
        i 5.864 92.801 0.100 1 1108 59
        i 5.865 93.037 0.100 1 1110 51
        i 5.866 93.068 0.100 1 1102 69
        i 5.867 93.096 0.100 1 1104 68
        i 5.868 93.125 0.100 1 1100 66
        i 5.869 93.160 0.100 1 1090 59
        i 5.870 93.197 0.100 1 1100 74
        i 5.871 93.200 0.100 1 1100 71
        i 5.872 93.251 0.100 1 1095 80
        i 5.873 93.328 0.100 1 1096 74
        i 5.874 93.409 0.100 1 1100 72
        i 5.875 93.529 0.100 1 1098 73
        i 5.876 93.659 0.100 1 1097 68
        i 5.877 93.784 0.100 1 1097 80
        i 5.878 93.789 0.100 1 1102 69
        i 5.879 93.843 0.100 1 1088 44
        i 5.880 93.852 0.100 1 1108 61
        i 5.881 93.887 0.100 1 1108 65
        i 5.882 93.929 0.100 1 1104 50
        i 5.883 93.936 0.100 1 1096 63
        i 5.884 93.947 0.100 1 1104 54
        i 5.885 93.988 0.100 1 1098 80
        i 5.886 94.033 0.100 1 1102 57
        i 5.887 94.048 0.100 1 1100 70
        i 5.888 94.219 0.100 1 1095 62
        i 5.889 94.453 0.100 1 1098 49
        i 5.890 94.464 0.100 1 1105 48
        i 5.891 94.507 0.100 1 1106 53
        i 5.892 94.567 0.100 1 1104 75
        i 5.893 94.581 0.100 1 1108 55
        i 5.894 94.649 0.100 1 1095 76
        i 5.895 94.664 0.100 1 1095 69
        i 5.896 94.704 0.100 1 1096 69
        i 5.897 94.705 0.100 1 1098 59
        i 5.898 94.739 0.100 1 1106 77
        i 5.899 94.964 0.100 1 1094 65
        i 5.900 95.156 0.100 1 1100 59
        i 5.901 95.161 0.100 1 1099 59
        i 5.902 95.176 0.100 1 1097 78
        i 5.903 95.273 0.100 1 1106 80
        i 5.904 95.323 0.100 1 1098 57
        i 5.905 95.372 0.100 1 1096 75
        i 5.906 95.373 0.100 1 1107 74
        i 5.907 95.380 0.100 1 1089 51
        i 5.908 95.457 0.100 1 1101 53
        i 5.909 95.639 0.100 1 1103 50
        i 5.910 95.664 0.100 1 1096 44
        i 5.911 95.717 0.100 1 1101 70
        i 5.912 95.771 0.100 1 1094 55
        i 5.913 95.827 0.100 1 1097 79
        i 5.914 95.851 0.100 1 1103 82
        i 4.259 96.001 0.490 3 36 127 0
        i 4.260 96.501 0.490 3 36 127 1
        i 4.261 97.501 0.490 3 36 127 2
        i 4.262 99.001 0.490 3 36 127 3
        i 4.263 101.001 0.490 3 36 127 4
        i 5.915 96.037 0.100 1 1096 49
        i 5.916 96.081 0.100 1 1101 63
        i 5.917 96.111 0.100 1 1103 52
        i 5.918 96.180 0.100 1 1099 66
        i 5.919 96.216 0.100 1 1091 61
        i 5.920 96.252 0.100 1 1103 62
        i 5.921 96.443 0.100 1 1095 73
        i 5.922 96.531 0.100 1 1107 61
        i 5.923 96.575 0.100 1 1099 68
        i 5.924 96.652 0.100 1 1095 62
        i 5.925 96.664 0.100 1 1091 83
        i 5.926 96.731 0.100 1 1101 70
        i 4.265 96.751 0.490 3 36 127 0
        i 4.266 97.251 0.490 3 36 127 1
        i 4.267 98.251 0.490 3 36 127 2
        i 4.268 99.751 0.490 3 36 127 3
        i 4.269 101.751 0.490 3 36 127 4
        i 5.927 96.856 0.100 1 1106 59
        i 5.928 96.931 0.100 1 1101 62
        i 5.929 96.945 0.100 1 1101 60
        i 5.930 96.972 0.100 1 1097 78
        i 5.931 97.041 0.100 1 1097 51
        i 5.932 97.077 0.100 1 1099 75
        i 5.933 97.133 0.100 1 1094 58
        i 5.934 97.213 0.100 1 1109 61
        i 5.935 97.216 0.100 1 1093 74
        i 5.936 97.445 0.100 1 1101 70
        i 5.937 97.508 0.100 1 1099 68
        i 5.938 97.508 0.100 1 1103 78
        i 5.939 97.623 0.100 1 1089 72
        i 5.940 97.652 0.100 1 1103 73
        i 5.941 97.667 0.100 1 1096 76
        i 5.942 97.732 0.100 1 1099 57
        i 5.943 97.739 0.100 1 1099 75
        i 5.944 97.740 0.100 1 1099 78
        i 5.945 97.820 0.100 1 1095 58
        i 5.946 97.881 0.100 1 1109 52
        i 5.947 98.167 0.100 1 1097 80
        i 5.948 98.223 0.100 1 1096 72
        i 5.949 98.375 0.100 1 1105 64
        i 5.950 98.383 0.100 1 1097 52
        i 5.951 98.384 0.100 1 1089 48
        i 5.952 98.388 0.100 1 1103 60
        i 5.953 98.429 0.100 1 1097 65
        i 5.954 98.476 0.100 1 1103 75
        i 5.955 98.476 0.100 1 1101 69
        i 5.956 98.497 0.100 1 1101 79
        i 5.957 98.639 0.100 1 1109 56
        i 5.958 98.715 0.100 1 1095 55
        i 5.959 98.781 0.100 1 1107 62
        i 5.960 98.912 0.100 1 1099 56
        i 5.961 98.952 0.100 1 1107 79
        i 5.962 98.977 0.100 1 1105 61
        i 5.963 99.081 0.100 1 1094 65
        i 5.964 99.124 0.100 1 1095 54
        i 5.965 99.165 0.100 1 1107 69
        i 5.966 99.245 0.100 1 1103 65
        i 5.967 99.267 0.100 1 1095 62
        i 5.968 99.325 0.100 1 1097 67
        i 5.969 99.421 0.100 1 1105 56
        i 5.970 99.653 0.100 1 1098 60
        i 5.971 99.669 0.100 1 1100 61
        i 5.972 99.680 0.100 1 1105 74
        i 5.973 99.793 0.100 1 1089 80
        i 5.974 99.812 0.100 1 1101 72
        i 5.975 99.853 0.100 1 1102 76
        i 5.976 99.920 0.100 1 1097 51
        i 5.977 99.933 0.100 1 1097 74
        i 5.978 99.957 0.100 1 1105 65
        i 4.271 100.001 0.490 3 36 127 0
        i 4.272 100.501 0.490 3 36 127 1
        i 4.273 101.501 0.490 3 36 127 2
        i 4.274 103.001 0.490 3 36 127 3
        i 4.275 105.001 0.490 3 36 127 4
        i 5.979 100.205 0.100 1 1095 55
        i 5.980 100.213 0.100 1 1102 66
        i 5.981 100.228 0.100 1 1093 51
        i 5.982 100.269 0.100 1 1103 77
        i 5.983 100.359 0.100 1 1096 56
        i 5.984 100.447 0.100 1 1097 61
        i 5.985 100.484 0.100 1 1107 72
        i 5.986 100.501 0.100 1 1103 63
        i 5.987 100.547 0.100 1 1103 59
        i 5.988 100.584 0.100 1 1091 72
        i 5.989 100.669 0.100 1 1102 52
        i 4.277 100.751 0.490 3 36 127 0
        i 4.278 101.251 0.490 3 36 127 1
        i 4.279 102.251 0.490 3 36 127 2
        i 4.280 103.751 0.490 3 36 127 3
        i 4.281 105.751 0.490 3 36 127 4
        i 5.990 100.896 0.100 1 1099 50
        i 5.991 100.907 0.100 1 1095 70
        i 5.992 100.908 0.100 1 1108 59
        i 5.993 100.947 0.100 1 1095 79
        i 5.994 101.104 0.100 1 1099 63
        i 5.995 101.160 0.100 1 1100 73
        i 5.996 101.172 0.100 1 1092 71
        i 5.997 101.239 0.100 1 1094 59
        i 5.998 101.385 0.100 1 1096 78
        i 5.999 101.428 0.100 1 1097 62
        i 5.001 101.443 0.100 1 1105 57
        i 5.002 101.479 0.100 1 1100 61
        i 5.003 101.480 0.100 1 1110 61
        i 5.004 101.492 0.100 1 1101 58
        i 5.005 101.572 0.100 1 1094 57
        i 5.006 101.713 0.100 1 1094 65
        i 5.007 101.853 0.100 1 1102 79
        i 5.008 101.900 0.100 1 1101 81
        i 5.009 101.980 0.100 1 1103 50
        i 4.283 102.001 0.490 3 36 127 0
        i 4.284 102.501 0.490 3 36 127 1
        i 4.285 103.501 0.490 3 36 127 2
        i 4.286 105.001 0.490 3 36 127 3
        i 4.287 107.001 0.490 3 36 127 4
        i 5.010 102.031 0.100 1 1112 49
        i 5.011 102.084 0.100 1 1097 66
        i 5.012 102.088 0.100 1 1088 67
        i 5.013 102.147 0.100 1 1098 58
        i 5.014 102.153 0.100 1 1098 67
        i 5.015 102.184 0.100 1 1104 84
        i 5.016 102.188 0.100 1 1100 48
        i 5.017 102.261 0.100 1 1100 54
        i 5.018 102.277 0.100 1 1094 68
        i 5.019 102.589 0.100 1 1098 56
        i 5.020 102.661 0.100 1 1095 66
        i 5.021 102.676 0.100 1 1096 62
        i 5.022 102.749 0.100 1 1096 63
        i 4.289 102.751 0.490 3 36 127 0
        i 4.290 103.251 0.490 3 36 127 1
        i 4.291 104.251 0.490 3 36 127 2
        i 4.292 105.751 0.490 3 36 127 3
        i 4.293 107.751 0.490 3 36 127 4
        i 5.023 102.796 0.100 1 1098 64
        i 5.024 102.863 0.100 1 1110 60
        i 5.025 102.913 0.100 1 1103 73
        i 5.026 102.928 0.100 1 1090 65
        i 5.027 102.936 0.100 1 1106 48
        i 5.028 102.953 0.100 1 1102 57
        i 5.029 103.027 0.100 1 1108 62
        i 5.030 103.099 0.100 1 1108 79
        i 5.031 103.213 0.100 1 1094 81
        i 5.032 103.251 0.100 1 1102 64
        i 5.033 103.369 0.100 1 1100 69
        i 5.034 103.499 0.100 1 1093 72
        i 5.035 103.512 0.100 1 1106 66
        i 5.036 103.513 0.100 1 1102 74
        i 5.037 103.547 0.100 1 1096 83
        i 5.038 103.668 0.100 1 1106 51
        i 5.039 103.708 0.100 1 1094 58
        i 5.040 103.712 0.100 1 1106 65
        i 5.041 103.775 0.100 1 1106 72
        i 5.042 103.808 0.100 1 1104 73
        i 5.043 103.911 0.100 1 1096 47
        i 4.295 104.001 0.490 3 36 127 0
        i 4.296 104.501 0.490 3 36 127 1
        i 4.297 105.501 0.490 3 36 127 2
        i 4.298 107.001 0.490 3 36 127 3
        i 4.299 109.001 0.490 3 36 127 4
        i 5.044 104.053 0.100 1 1104 79
        i 4.301 104.125 0.490 3 43 127 0
        i 4.302 104.625 0.490 3 43 127 1
        i 4.303 105.625 0.490 3 43 127 2
        i 4.304 107.125 0.490 3 43 127 3
        i 4.305 109.125 0.490 3 43 127 4
        i 5.045 104.131 0.100 1 1098 72
        i 5.046 104.173 0.100 1 1104 69
        i 5.047 104.180 0.100 1 1100 56
        i 5.048 104.205 0.100 1 1090 60
        i 5.049 104.249 0.100 1 1103 66
        i 5.050 104.383 0.100 1 1096 71
        i 5.051 104.495 0.100 1 1098 51
        i 5.052 104.520 0.100 1 1104 69
        i 5.053 104.527 0.100 1 1106 69
        i 5.054 104.643 0.100 1 1102 74
        i 5.055 104.647 0.100 1 1102 69
        i 5.056 104.713 0.100 1 1101 79
        i 5.057 104.713 0.100 1 1094 63
        i 4.307 104.751 0.490 3 36 127 0
        i 4.308 105.251 0.490 3 36 127 1
        i 4.309 106.251 0.490 3 36 127 2
        i 4.310 107.751 0.490 3 36 127 3
        i 4.311 109.751 0.490 3 36 127 4
        i 5.058 104.751 0.100 1 1106 75
        i 4.313 104.876 0.490 3 43 127 0
        i 4.314 105.376 0.490 3 43 127 1
        i 4.315 106.376 0.490 3 43 127 2
        i 4.316 107.876 0.490 3 43 127 3
        i 4.317 109.876 0.490 3 43 127 4
        i 5.059 104.891 0.100 1 1096 67
        i 5.060 104.951 0.100 1 1092 75
        i 5.061 105.044 0.100 1 1098 57
        i 5.062 105.044 0.100 1 1108 74
        i 5.063 105.068 0.100 1 1094 67
        i 5.064 105.087 0.100 1 1101 75
        i 5.065 105.156 0.100 1 1104 57
        i 5.066 105.185 0.100 1 1102 80
        i 5.067 105.264 0.100 1 1108 80
        i 5.068 105.336 0.100 1 1096 67
        i 5.069 105.379 0.100 1 1100 76
        i 5.070 105.580 0.100 1 1104 76
        i 5.071 105.684 0.100 1 1093 79
        i 5.072 105.699 0.100 1 1096 71
        i 5.073 105.704 0.100 1 1100 58
        i 5.074 105.764 0.100 1 1100 56
        i 5.075 105.764 0.100 1 1100 73
        i 5.076 105.797 0.100 1 1096 57
        i 5.077 105.825 0.100 1 1093 64
        i 5.078 105.852 0.100 1 1104 54
        i 5.079 105.895 0.100 1 1098 60
        i 5.080 105.937 0.100 1 1100 75
        i 4.319 106.001 0.490 3 36 127 0
        i 4.320 106.501 0.490 3 36 127 1
        i 4.321 107.501 0.490 3 36 127 2
        i 4.322 109.001 0.490 3 36 127 3
        i 4.323 111.001 0.490 3 36 127 4
        i 5.081 106.011 0.100 1 1095 53
        i 5.082 106.089 0.100 1 1110 63
        i 4.325 106.125 0.490 3 43 127 0
        i 4.326 106.625 0.490 3 43 127 1
        i 4.327 107.625 0.490 3 43 127 2
        i 4.328 109.125 0.490 3 43 127 3
        i 4.329 111.125 0.490 3 43 127 4
        i 5.083 106.213 0.100 1 1095 64
        i 5.084 106.296 0.100 1 1102 71
        i 5.085 106.332 0.100 1 1102 66
        i 5.086 106.344 0.100 1 1101 62
        i 5.087 106.439 0.100 1 1098 57
        i 5.088 106.523 0.100 1 1097 82
        i 5.089 106.537 0.100 1 1098 73
        i 5.090 106.564 0.100 1 1100 69
        i 5.091 106.576 0.100 1 1102 70
        i 5.092 106.632 0.100 1 1088 61
        i 5.093 106.716 0.100 1 1103 52
        i 5.094 106.735 0.100 1 1093 58
        i 4.331 106.751 0.490 3 36 127 0
        i 4.332 107.251 0.490 3 36 127 1
        i 4.333 108.251 0.490 3 36 127 2
        i 4.334 109.751 0.490 3 36 127 3
        i 4.335 111.751 0.490 3 36 127 4
        i 4.337 106.876 0.490 3 43 127 0
        i 4.338 107.376 0.490 3 43 127 1
        i 4.339 108.376 0.490 3 43 127 2
        i 4.340 109.876 0.490 3 43 127 3
        i 4.341 111.876 0.490 3 43 127 4
        i 5.095 106.899 0.100 1 1112 67
        i 5.096 106.968 0.100 1 1107 70
        i 5.097 107.056 0.100 1 1101 69
        i 5.098 107.107 0.100 1 1096 75
        i 5.099 107.121 0.100 1 1095 61
        i 5.100 107.165 0.100 1 1098 80
        i 5.101 107.188 0.100 1 1095 63
        i 5.102 107.191 0.100 1 1107 52
        i 5.103 107.263 0.100 1 1099 54
        i 5.104 107.321 0.100 1 1104 65
        i 5.105 107.383 0.100 1 1107 69
        i 5.106 107.411 0.100 1 1109 69
        i 5.107 107.431 0.100 1 1101 59
        i 5.108 107.549 0.100 1 1091 62
        i 5.109 107.644 0.100 1 1105 53
        i 5.110 107.713 0.100 1 1093 75
        i 5.111 107.813 0.100 1 1103 70
        i 5.112 107.881 0.100 1 1101 56
        i 5.113 107.937 0.100 1 1092 71
        i 5.114 107.969 0.100 1 1097 61
        i 4.343 108.001 0.490 3 36 127 0
        i 4.344 108.501 0.490 3 36 127 1
        i 4.345 109.501 0.490 3 36 127 2
        i 4.346 111.001 0.490 3 36 127 3
        i 4.347 113.001 0.490 3 36 127 4
        i 5.115 108.001 0.100 1 1102 61
        i 5.116 108.028 0.100 1 1095 74
        i 5.117 108.036 0.100 1 1105 57
        i 5.118 108.108 0.100 1 1106 61
        i 4.349 108.125 0.490 3 43 127 0
        i 4.350 108.625 0.490 3 43 127 1
        i 4.351 109.625 0.490 3 43 127 2
        i 4.352 111.125 0.490 3 43 127 3
        i 4.353 113.125 0.490 3 43 127 4
        i 5.119 108.159 0.100 1 1105 48
        i 5.120 108.172 0.100 1 1107 48
        i 4.355 108.251 0.490 3 48 127 0
        i 4.356 108.751 0.490 3 48 127 1
        i 4.357 109.751 0.490 3 48 127 2
        i 4.358 111.251 0.490 3 48 127 3
        i 4.359 113.251 0.490 3 48 127 4
        i 5.121 108.269 0.100 1 1105 48
        i 5.122 108.361 0.100 1 1103 63
        i 5.123 108.453 0.100 1 1095 61
        i 5.124 108.573 0.100 1 1105 55
        i 5.125 108.608 0.100 1 1099 58
        i 5.126 108.667 0.100 1 1102 63
        i 5.127 108.673 0.100 1 1091 52
        i 5.128 108.692 0.100 1 1101 74
        i 4.361 108.751 0.490 3 36 127 0
        i 4.362 109.251 0.490 3 36 127 1
        i 4.363 110.251 0.490 3 36 127 2
        i 4.364 111.751 0.490 3 36 127 3
        i 4.365 113.751 0.490 3 36 127 4
        i 5.129 108.773 0.100 1 1107 60
        i 5.130 108.791 0.100 1 1097 52
        i 4.367 108.876 0.490 3 43 127 0
        i 4.368 109.376 0.490 3 43 127 1
        i 4.369 110.376 0.490 3 43 127 2
        i 4.370 111.876 0.490 3 43 127 3
        i 4.371 113.876 0.490 3 43 127 4
        i 5.131 108.941 0.100 1 1099 51
        i 5.132 108.943 0.100 1 1109 73
        i 5.133 108.961 0.100 1 1103 74
        i 4.373 109.001 0.490 3 48 127 0
        i 4.374 109.501 0.490 3 48 127 1
        i 4.375 110.501 0.490 3 48 127 2
        i 4.376 112.001 0.490 3 48 127 3
        i 4.377 114.001 0.490 3 48 127 4
        i 5.134 109.023 0.100 1 1101 53
        i 5.135 109.072 0.100 1 1103 80
        i 5.136 109.177 0.100 1 1093 49
        i 5.137 109.213 0.100 1 1101 58
        i 5.138 109.375 0.100 1 1093 50
        i 5.139 109.380 0.100 1 1095 62
        i 5.140 109.423 0.100 1 1095 53
        i 5.141 109.512 0.100 1 1099 59
        i 5.142 109.525 0.100 1 1100 59
        i 5.143 109.624 0.100 1 1103 66
        i 5.144 109.640 0.100 1 1099 52
        i 5.145 109.672 0.100 1 1101 78
        i 5.146 109.721 0.100 1 1097 74
        i 5.147 109.748 0.100 1 1101 65
        i 5.148 109.780 0.100 1 1105 73
        i 5.149 109.893 0.100 1 1109 53
        i 5.150 109.923 0.100 1 1097 57
        i 4.379 110.001 0.490 3 36 127 0
        i 4.380 110.501 0.490 3 36 127 1
        i 4.381 111.501 0.490 3 36 127 2
        i 4.382 113.001 0.490 3 36 127 3
        i 4.383 115.001 0.490 3 36 127 4
        i 4.385 110.125 0.490 3 43 127 0
        i 4.386 110.625 0.490 3 43 127 1
        i 4.387 111.625 0.490 3 43 127 2
        i 4.388 113.125 0.490 3 43 127 3
        i 4.389 115.125 0.490 3 43 127 4
        i 5.151 110.196 0.100 1 1093 52
        i 4.391 110.251 0.490 3 52 64 0
        i 4.392 110.751 0.490 3 52 64 1
        i 4.393 111.751 0.490 3 52 64 2
        i 4.394 113.251 0.490 3 52 64 3
        i 4.395 115.251 0.490 3 52 64 4
        i 5.152 110.261 0.100 1 1103 65
        i 5.153 110.265 0.100 1 1095 55
        i 5.154 110.357 0.100 1 1099 69
        i 5.155 110.379 0.100 1 1101 59
        i 5.156 110.385 0.100 1 1099 74
        i 5.157 110.388 0.100 1 1101 77
        i 5.158 110.412 0.100 1 1093 63
        i 5.159 110.471 0.100 1 1096 68
        i 5.160 110.588 0.100 1 1101 71
        i 5.161 110.609 0.100 1 1099 64
        i 5.162 110.701 0.100 1 1099 59
        i 5.163 110.713 0.100 1 1096 62
        i 4.397 110.751 0.490 3 36 127 0
        i 4.398 111.251 0.490 3 36 127 1
        i 4.399 112.251 0.490 3 36 127 2
        i 4.400 113.751 0.490 3 36 127 3
        i 4.401 115.751 0.490 3 36 127 4
        i 5.164 110.815 0.100 1 1109 75
        i 4.403 110.876 0.490 3 43 127 0
        i 4.404 111.376 0.490 3 43 127 1
        i 4.405 112.376 0.490 3 43 127 2
        i 4.406 113.876 0.490 3 43 127 3
        i 4.407 115.876 0.490 3 43 127 4
        i 5.165 110.896 0.100 1 1103 72
        i 4.409 111.001 0.490 3 52 64 0
        i 4.410 111.501 0.490 3 52 64 1
        i 4.411 112.501 0.490 3 52 64 2
        i 4.412 114.001 0.490 3 52 64 3
        i 4.413 116.001 0.490 3 52 64 4
        i 5.166 111.004 0.100 1 1098 64
        i 5.167 111.041 0.100 1 1097 80
        i 5.168 111.044 0.100 1 1107 64
        i 5.169 111.161 0.100 1 1097 52
        i 5.170 111.173 0.100 1 1089 44
        i 5.171 111.173 0.100 1 1101 71
        i 5.172 111.215 0.100 1 1097 51
        i 5.173 111.248 0.100 1 1103 60
        i 5.174 111.248 0.100 1 1093 53
        i 5.175 111.512 0.100 1 1111 49
        i 5.176 111.527 0.100 1 1101 63
        i 5.177 111.551 0.100 1 1095 75
        i 5.178 111.624 0.100 1 1094 57
        i 5.179 111.700 0.100 1 1094 72
        i 5.180 111.731 0.100 1 1107 64
        i 5.181 111.732 0.100 1 1105 61
        i 5.182 111.821 0.100 1 1099 74
        i 5.183 111.908 0.100 1 1100 82
        i 5.184 111.944 0.100 1 1107 68
        i 5.185 111.964 0.100 1 1103 79
        i 4.415 112.001 0.490 3 36 127 0
        i 4.416 112.501 0.490 3 36 127 1
        i 4.417 113.501 0.490 3 36 127 2
        i 4.418 115.001 0.490 3 36 127 3
        i 4.419 117.001 0.490 3 36 127 4
        i 5.186 112.007 0.100 1 1104 77
        i 6.001 112.001 -1 3 0 0
        i 6.002 112.068 -1 3 29 1
        i 6.003 112.135 -1 3 27 29
        i 6.004 112.201 -1 3 0 26
        i 6.005 112.268 -1 3 5 1
        i 6.006 112.335 -1 3 28 8
        i 6.007 112.401 -1 3 18 28
        i 6.008 112.468 -1 3 1 15
        i 6.009 112.535 -1 3 18 2
        i 6.010 112.601 -1 3 27 23
        i 6.011 112.668 -1 3 2 26
        i 6.012 112.735 -1 3 9 3
        i 6.013 112.801 -1 3 26 16
        i 6.014 112.868 -1 3 6 26
        i 6.015 112.935 -1 3 8 4
        i 6.016 113.001 -1 3 25 17
        i 6.017 113.068 -1 3 4 24
        i 6.018 113.135 -1 3 15 5
        i 6.019 113.201 -1 3 22 24
        i 6.020 113.268 -1 3 5 11
        i 6.021 113.335 -1 3 23 13
        i 6.022 113.401 -1 3 6 20
        i 6.023 113.468 -1 3 22 8
        i 6.024 113.535 -1 3 7 21
        i 6.025 113.601 -1 3 21 11
        i 6.026 113.668 -1 3 8 14
        i 6.027 113.735 -1 3 18 20
        i 6.028 113.801 -1 3 19 11
        i 6.029 113.868 -1 3 15 11
        i 6.030 113.935 -1 3 17 13
        i 6.031 114.001 -1 3 1 0
        i 6.032 114.068 -1 3 29 2
        i 6.033 114.135 -1 3 26 29
        i 6.034 114.201 -1 3 0 25
        i 6.035 114.268 -1 3 6 1
        i 6.036 114.335 -1 3 28 9
        i 6.037 114.401 -1 3 17 28
        i 6.038 114.468 -1 3 1 14
        i 6.039 114.535 -1 3 19 2
        i 6.040 114.601 -1 3 27 24
        i 6.041 114.668 -1 3 2 25
        i 6.042 114.735 -1 3 10 3
        i 6.043 114.801 -1 3 26 17
        i 6.044 114.868 -1 3 5 26
        i 6.045 114.935 -1 3 9 4
        i 6.046 115.001 -1 3 25 18
        i 6.047 115.068 -1 3 4 23
        i 6.048 115.135 -1 3 16 5
        i 6.049 115.201 -1 3 21 24
        i 6.050 115.268 -1 3 5 10
        i 6.051 115.335 -1 3 23 14
        i 6.052 115.401 -1 3 6 19
        i 6.053 115.468 -1 3 22 9
        i 6.054 115.535 -1 3 7 20
        i 6.055 115.601 -1 3 21 12
        i 6.056 115.668 -1 3 8 13
        i 6.057 115.735 -1 3 17 20
        i 6.058 115.801 -1 3 19 12
        i 6.059 115.868 -1 3 16 11
        i 6.060 115.935 -1 3 17 14
        i 6.061 116.001 -1 3 2 0
        i 6.062 116.068 -1 3 29 3
        i 6.063 116.135 -1 3 25 29
        i 6.064 116.201 -1 3 0 24
        i 6.065 116.268 -1 3 7 1
        i 6.066 116.335 -1 3 28 10
        i 6.067 116.401 -1 3 16 28
        i 6.068 116.468 -1 3 1 13
        i 6.069 116.535 -1 3 20 2
        i 6.070 116.601 -1 3 27 25
        i 6.071 116.668 -1 3 2 24
        i 6.072 116.735 -1 3 11 3
        i 6.073 116.801 -1 3 26 18
        i 6.074 116.868 -1 3 4 26
        i 6.075 116.935 -1 3 10 4
        i 6.076 117.001 -1 3 25 19
        i 6.077 117.068 -1 3 4 22
        i 6.078 117.135 -1 3 17 5
        i 6.079 117.201 -1 3 20 24
        i 6.080 117.268 -1 3 5 9
        i 6.081 117.335 -1 3 23 15
        i 6.082 117.401 -1 3 6 18
        i 6.083 117.468 -1 3 22 10
        i 6.084 117.535 -1 3 7 19
        i 6.085 117.601 -1 3 21 13
        i 6.086 117.668 -1 3 8 12
        i 6.087 117.735 -1 3 16 20
        i 6.088 117.801 -1 3 19 13
        i 6.089 117.868 -1 3 17 11
        i 6.090 117.935 -1 3 17 15
        i 6.091 118.001 -1 3 3 0
        i 6.092 118.068 -1 3 29 4
        i 6.093 118.135 -1 3 24 29
        i 6.094 118.201 -1 3 0 23
        i 6.095 118.268 -1 3 8 1
        i 6.096 118.335 -1 3 28 11
        i 6.097 118.401 -1 3 15 28
        i 6.098 118.468 -1 3 1 12
        i 6.099 118.535 -1 3 21 2
        i 6.100 118.601 -1 3 27 26
        i 6.101 118.668 -1 3 2 23
        i 6.102 118.735 -1 3 12 3
        i 6.103 118.801 -1 3 26 19
        i 6.104 118.868 -1 3 3 26
        i 6.105 118.935 -1 3 11 4
        i 6.106 119.001 -1 3 25 20
        i 6.107 119.068 -1 3 4 21
        i 6.108 119.135 -1 3 18 5
        i 6.109 119.201 -1 3 19 24
        i 6.110 119.268 -1 3 5 8
        i 6.111 119.335 -1 3 23 16
        i 6.112 119.401 -1 3 6 17
        i 6.113 119.468 -1 3 22 11
        i 6.114 119.535 -1 3 7 18
        i 6.115 119.601 -1 3 21 14
        i 6.116 119.668 -1 3 8 11
        i 6.117 119.735 -1 3 15 20
        i 6.118 119.801 -1 3 19 14
        i 6.119 119.868 -1 3 18 11
        i 6.120 119.935 -1 3 17 16
        i 6.121 120.001 -1 3 4 0
        i 6.122 120.068 -1 3 29 5
        i 6.123 120.135 -1 3 23 29
        i 6.124 120.201 -1 3 0 22
        i 6.125 120.268 -1 3 9 1
        i 6.126 120.335 -1 3 28 12
        i 6.127 120.401 -1 3 14 28
        i 6.128 120.468 -1 3 1 11
        i 6.129 120.535 -1 3 22 2
        i 6.130 120.601 -1 3 27 27
        i 6.131 120.668 -1 3 2 22
        i 6.132 120.735 -1 3 13 3
        i 6.133 120.801 -1 3 26 20
        i 6.134 120.868 -1 3 3 25
        i 6.135 120.935 -1 3 12 4
        i 6.136 121.001 -1 3 25 21
        i 6.137 121.068 -1 3 4 20
        i 6.138 121.135 -1 3 19 5
        i 6.139 121.201 -1 3 18 24
        i 6.140 121.268 -1 3 5 7
        i 6.141 121.335 -1 3 23 17
        i 6.142 121.401 -1 3 6 16
        i 6.143 121.468 -1 3 22 12
        i 6.144 121.535 -1 3 7 17
        i 6.145 121.601 -1 3 21 15
        i 6.146 121.668 -1 3 8 10
        i 6.147 121.735 -1 3 14 20
        i 6.148 121.801 -1 3 19 15
        i 6.149 121.868 -1 3 18 12
        i 6.150 121.935 -1 3 17 17
        i 6.151 122.001 -1 3 5 0
        i 6.152 122.068 -1 3 29 6
        i 6.153 122.135 -1 3 22 29
        i 6.154 122.201 -1 3 0 21
        i 6.155 122.268 -1 3 10 1
        i 6.156 122.335 -1 3 28 13
        i 6.157 122.401 -1 3 13 28
        i 6.158 122.468 -1 3 1 10
        i 6.159 122.535 -1 3 23 2
        i 6.160 122.601 -1 3 26 27
        i 6.161 122.668 -1 3 2 21
        i 6.162 122.735 -1 3 14 3
        i 6.163 122.801 -1 3 26 21
        i 6.164 122.868 -1 3 3 24
        i 6.165 122.935 -1 3 13 4
        i 6.166 123.001 -1 3 25 22
        i 6.167 123.068 -1 3 4 19
        i 6.168 123.135 -1 3 20 5
        i 6.169 123.201 -1 3 17 24
        i 6.170 123.268 -1 3 5 6
        i 6.171 123.335 -1 3 23 18
        i 6.172 123.401 -1 3 6 15
        i 6.173 123.468 -1 3 22 13
        i 6.174 123.535 -1 3 7 16
        i 6.175 123.601 -1 3 21 16
        i 6.176 123.668 -1 3 8 9
        i 6.177 123.735 -1 3 13 20
        i 6.178 123.801 -1 3 19 16
        i 6.179 123.868 -1 3 18 13
        i 6.180 123.935 -1 3 16 17
        i 6.181 124.001 -1 3 6 0
        i 6.182 124.068 -1 3 29 7
        i 6.183 124.135 -1 3 21 29
        i 6.184 124.201 -1 3 0 20
        i 6.185 124.268 -1 3 11 1
        i 6.186 124.335 -1 3 28 14
        i 6.187 124.401 -1 3 12 28
        i 6.188 124.468 -1 3 1 9
        i 6.189 124.535 -1 3 24 2
        i 6.190 124.601 -1 3 25 27
        i 6.191 124.668 -1 3 2 20
        i 6.192 124.735 -1 3 15 3
        i 6.193 124.801 -1 3 26 22
        i 6.194 124.868 -1 3 3 23
        i 6.195 124.935 -1 3 14 4
        i 6.196 125.001 -1 3 25 23
        i 6.197 125.068 -1 3 4 18
        i 6.198 125.135 -1 3 21 5
        i 6.199 125.201 -1 3 16 24
        i 6.200 125.268 -1 3 6 6
        i 6.201 125.335 -1 3 23 19
        i 6.202 125.401 -1 3 6 14
        i 6.203 125.468 -1 3 22 14
        i 6.204 125.535 -1 3 7 15
        i 6.205 125.601 -1 3 21 17
        i 6.206 125.668 -1 3 9 9
        i 6.207 125.735 -1 3 12 20
        i 6.208 125.801 -1 3 19 17
        i 6.209 125.868 -1 3 18 14
        i 6.210 125.935 -1 3 15 17
        i 6.211 126.001 -1 3 7 0
        i 6.212 126.068 -1 3 29 8
        i 6.213 126.135 -1 3 20 29
        i 6.214 126.201 -1 3 0 19
        i 6.215 126.268 -1 3 12 1
        i 6.216 126.335 -1 3 28 15
        i 6.217 126.401 -1 3 11 28
        i 6.218 126.468 -1 3 1 8
        i 6.219 126.535 -1 3 25 2
        i 6.220 126.601 -1 3 24 27
        i 6.221 126.668 -1 3 2 19
        i 6.222 126.735 -1 3 16 3
        i 6.223 126.801 -1 3 26 23
        i 6.224 126.868 -1 3 3 22
        i 6.225 126.935 -1 3 15 4
        i 6.226 127.001 -1 3 25 24
        i 6.227 127.068 -1 3 4 17
        i 6.228 127.135 -1 3 22 5
        i 6.229 127.201 -1 3 15 24
        i 6.230 127.268 -1 3 7 6
        i 6.231 127.335 -1 3 23 20
        i 6.232 127.401 -1 3 6 13
        i 6.233 127.468 -1 3 22 15
        i 6.234 127.535 -1 3 7 14
        i 6.235 127.601 -1 3 21 18
        i 6.236 127.668 -1 3 10 9
        i 6.237 127.735 -1 3 11 20
        i 6.238 127.801 -1 3 19 18
        i 6.239 127.868 -1 3 18 15
        i 6.240 127.935 -1 3 14 17
        i 6.241 128.001 -1 3 8 0
        i 6.242 128.068 -1 3 29 9
        i 6.243 128.135 -1 3 19 29
        i 6.244 128.201 -1 3 0 18
        i 6.245 128.268 -1 3 13 1
        i 6.246 128.335 -1 3 28 16
        i 6.247 128.401 -1 3 10 28
        i 6.248 128.468 -1 3 1 7
        i 6.249 128.535 -1 3 26 2
        i 6.250 128.601 -1 3 23 27
        i 6.251 128.668 -1 3 2 18
        i 6.252 128.735 -1 3 17 3
        i 6.253 128.801 -1 3 26 24
        i 6.254 128.868 -1 3 3 21
        i 6.255 128.935 -1 3 16 4
        i 6.256 129.001 -1 3 25 25
        i 6.257 129.068 -1 3 4 16
        i 6.258 129.135 -1 3 23 5
        i 6.259 129.201 -1 3 14 24
        i 6.260 129.268 -1 3 8 6
        i 6.261 129.335 -1 3 23 21
        i 6.262 129.401 -1 3 6 12
        i 6.263 129.468 -1 3 22 16
        i 6.264 129.535 -1 3 7 13
        i 6.265 129.601 -1 3 21 19
        i 6.266 129.668 -1 3 11 9
        i 6.267 129.735 -1 3 10 20
        i 6.268 129.801 -1 3 19 19
        i 6.269 129.868 -1 3 18 16
        i 6.270 129.935 -1 3 13 17
        i 6.271 130.001 -1 3 9 0
        i 6.272 130.068 -1 3 29 10
        i 6.273 130.135 -1 3 18 29
        i 6.274 130.201 -1 3 0 17
        i 6.275 130.268 -1 3 14 1
        i 6.276 130.335 -1 3 28 17
        i 6.277 130.401 -1 3 9 28
        i 6.278 130.468 -1 3 1 6
        i 6.279 130.535 -1 3 27 2
        i 6.280 130.601 -1 3 22 27
        i 6.281 130.668 -1 3 2 17
        i 6.282 130.735 -1 3 18 3
        i 6.283 130.801 -1 3 26 25
        i 6.284 130.868 -1 3 3 20
        i 6.285 130.935 -1 3 17 4
        i 6.286 131.001 -1 3 24 25
        i 6.287 131.068 -1 3 4 15
        i 6.288 131.135 -1 3 24 5
        i 6.289 131.201 -1 3 13 24
        i 6.290 131.268 -1 3 9 6
        i 6.291 131.335 -1 3 23 22
        i 6.292 131.401 -1 3 6 11
        i 6.293 131.468 -1 3 22 17
        i 6.294 131.535 -1 3 7 12
        i 6.295 131.601 -1 3 21 20
        i 6.296 131.668 -1 3 12 9
        i 6.297 131.735 -1 3 9 20
        i 6.298 131.801 -1 3 18 19
        i 6.299 131.868 -1 3 18 17
        i 6.300 131.935 -1 3 12 17
        i 6.301 132.001 -1 3 10 0
        i 6.302 132.068 -1 3 29 11
        i 6.303 132.135 -1 3 17 29
        i 6.304 132.201 -1 3 0 16
        i 6.305 132.268 -1 3 15 1
        i 6.306 132.335 -1 3 28 18
        i 6.307 132.401 -1 3 8 28
        i 6.308 132.468 -1 3 1 5
        i 6.309 132.535 -1 3 27 3
        i 6.310 132.601 -1 3 21 27
        i 6.311 132.668 -1 3 2 16
        i 6.312 132.735 -1 3 19 3
        i 6.313 132.801 -1 3 26 26
        i 6.314 132.868 -1 3 3 19
        i 6.315 132.935 -1 3 18 4
        i 6.316 133.001 -1 3 23 25
        i 6.317 133.068 -1 3 4 14
        i 6.318 133.135 -1 3 24 6
        i 6.319 133.201 -1 3 12 24
        i 6.320 133.268 -1 3 10 6
        i 6.321 133.335 -1 3 23 23
        i 6.322 133.401 -1 3 6 10
        i 6.323 133.468 -1 3 22 18
        i 6.324 133.535 -1 3 7 11
        i 6.325 133.601 -1 3 21 21
        i 6.326 133.668 -1 3 13 9
        i 6.327 133.735 -1 3 9 19
        i 6.328 133.801 -1 3 17 19
        i 6.329 133.868 -1 3 18 18
        i 6.330 133.935 -1 3 12 16
        i 6.331 134.001 -1 3 11 0
        i 6.332 134.068 -1 3 29 12
        i 6.333 134.135 -1 3 16 29
        i 6.334 134.201 -1 3 0 15
        i 6.335 134.268 -1 3 16 1
        i 6.336 134.335 -1 3 28 19
        i 6.337 134.401 -1 3 7 28
        i 6.338 134.468 -1 3 1 4
        i 6.339 134.535 -1 3 27 4
        i 6.340 134.601 -1 3 20 27
        i 6.341 134.668 -1 3 2 15
        i 6.342 134.735 -1 3 20 3
        i 6.343 134.801 -1 3 25 26
        i 5.187 112.031 0.100 1 1104 75
        i 6.344 134.868 -1 3 3 18
        i 6.345 134.935 -1 3 19 4
        i 6.346 135.001 -1 3 22 25
        i 6.347 135.068 -1 3 4 13
        i 6.348 135.135 -1 3 24 7
        i 6.349 135.201 -1 3 11 24
        i 6.350 135.268 -1 3 11 6
        i 6.351 135.335 -1 3 22 23
        i 6.352 135.401 -1 3 6 9
        i 6.353 135.468 -1 3 22 19
        i 6.354 135.535 -1 3 7 10
        i 6.355 135.601 -1 3 20 21
        i 6.356 135.668 -1 3 14 9
        i 6.357 135.735 -1 3 9 18
        i 6.358 135.801 -1 3 16 19
        i 6.359 135.868 -1 3 17 18
        i 6.360 135.935 -1 3 12 15
        i 6.361 136.001 -1 3 12 0
        i 6.362 136.068 -1 3 29 13
        i 6.363 136.135 -1 3 15 29
        i 6.364 136.201 -1 3 0 14
        i 6.365 136.268 -1 3 17 1
        i 6.366 136.335 -1 3 28 20
        i 6.367 136.401 -1 3 6 28
        i 6.368 136.468 -1 3 1 3
        i 6.369 136.535 -1 3 27 5
        i 6.370 136.601 -1 3 19 27
        i 6.371 136.668 -1 3 2 14
        i 6.372 136.735 -1 3 21 3
        i 6.373 136.801 -1 3 24 26
        i 6.374 136.868 -1 3 3 17
        i 6.375 136.935 -1 3 20 4
        i 6.376 137.001 -1 3 21 25
        i 6.377 137.068 -1 3 4 12
        i 6.378 137.135 -1 3 24 8
        i 6.379 137.201 -1 3 10 24
        i 6.380 137.268 -1 3 12 6
        i 6.381 137.335 -1 3 21 23
        i 6.382 137.401 -1 3 6 8
        i 6.383 137.468 -1 3 22 20
        i 6.384 137.535 -1 3 7 9
        i 6.385 137.601 -1 3 19 21
        i 6.386 137.668 -1 3 15 9
        i 6.387 137.735 -1 3 9 17
        i 6.388 137.801 -1 3 15 19
        i 6.389 137.868 -1 3 16 18
        i 6.390 137.935 -1 3 12 14
        i 6.391 138.001 -1 3 13 0
        i 6.392 138.068 -1 3 29 14
        i 6.393 138.135 -1 3 14 29
        i 6.394 138.201 -1 3 0 13
        i 6.395 138.268 -1 3 18 1
        i 6.396 138.335 -1 3 28 21
        i 6.397 138.401 -1 3 5 28
        i 6.398 138.468 -1 3 1 2
        i 6.399 138.535 -1 3 27 6
        i 6.400 138.601 -1 3 18 27
        i 6.401 138.668 -1 3 2 13
        i 6.402 138.735 -1 3 22 3
        i 6.403 138.801 -1 3 23 26
        i 6.404 138.868 -1 3 3 16
        i 6.405 138.935 -1 3 21 4
        i 6.406 139.001 -1 3 20 25
        i 6.407 139.068 -1 3 4 11
        i 6.408 139.135 -1 3 24 9
        i 6.409 139.201 -1 3 9 24
        i 6.410 139.268 -1 3 13 6
        i 6.411 139.335 -1 3 20 23
        i 6.412 139.401 -1 3 6 7
        i 6.413 139.468 -1 3 22 21
        i 6.414 139.535 -1 3 7 8
        i 6.415 139.601 -1 3 18 21
        i 6.416 139.668 -1 3 16 9
        i 6.417 139.735 -1 3 9 16
        i 6.418 139.801 -1 3 14 19
        i 6.419 139.868 -1 3 15 18
        i 6.420 139.935 -1 3 12 13
        i 6.421 140.001 -1 3 14 0
        i 6.422 140.068 -1 3 29 15
        i 6.423 140.135 -1 3 13 29
        i 6.424 140.201 -1 3 0 12
        i 6.425 140.268 -1 3 19 1
        i 6.426 140.335 -1 3 28 22
        i 6.427 140.401 -1 3 4 28
        i 6.428 140.468 -1 3 2 2
        i 6.429 140.535 -1 3 27 7
        i 6.430 140.601 -1 3 17 27
        i 6.431 140.668 -1 3 2 12
        i 6.432 140.735 -1 3 23 3
        i 6.433 140.801 -1 3 22 26
        i 6.434 140.868 -1 3 3 15
        i 6.435 140.935 -1 3 22 4
        i 6.436 141.001 -1 3 19 25
        i 6.437 141.068 -1 3 4 10
        i 6.438 141.135 -1 3 24 10
        i 6.439 141.201 -1 3 8 24
        i 6.440 141.268 -1 3 14 6
        i 6.441 141.335 -1 3 19 23
        i 6.442 141.401 -1 3 7 7
        i 6.443 141.468 -1 3 22 22
        i 6.444 141.535 -1 3 8 8
        i 6.445 141.601 -1 3 17 21
        i 6.446 141.668 -1 3 17 9
        i 6.447 141.735 -1 3 9 15
        i 6.448 141.801 -1 3 13 19
        i 6.449 141.868 -1 3 14 18
        i 6.450 141.935 -1 3 13 13
        i 6.451 142.001 -1 3 15 0
        i 6.452 142.068 -1 3 29 16
        i 6.453 142.135 -1 3 12 29
        i 6.454 142.201 -1 3 0 11
        i 6.455 142.268 -1 3 20 1
        i 6.456 142.335 -1 3 28 23
        i 6.457 142.401 -1 3 3 28
        i 6.458 142.468 -1 3 3 2
        i 6.459 142.535 -1 3 27 8
        i 6.460 142.601 -1 3 16 27
        i 6.461 142.668 -1 3 2 11
        i 6.462 142.735 -1 3 24 3
        i 6.463 142.801 -1 3 21 26
        i 6.464 142.868 -1 3 3 14
        i 6.465 142.935 -1 3 23 4
        i 6.466 143.001 -1 3 18 25
        i 6.467 143.068 -1 3 4 9
        i 6.468 143.135 -1 3 24 11
        i 6.469 143.201 -1 3 7 24
        i 6.470 143.268 -1 3 15 6
        i 6.471 143.335 -1 3 18 23
        i 6.472 143.401 -1 3 8 7
        i 6.473 143.468 -1 3 21 22
        i 6.474 143.535 -1 3 9 8
        i 6.475 143.601 -1 3 16 21
        i 6.476 143.668 -1 3 18 9
        i 6.477 143.735 -1 3 9 14
        i 6.478 143.801 -1 3 12 19
        i 6.479 143.868 -1 3 13 18
        i 6.480 143.935 -1 3 14 13
        i 6.481 144.001 -1 3 16 0
        i 6.482 144.068 -1 3 29 17
        i 6.483 144.135 -1 3 11 29
        i 6.484 144.201 -1 3 0 10
        i 6.485 144.268 -1 3 21 1
        i 6.486 144.335 -1 3 28 24
        i 6.487 144.401 -1 3 2 28
        i 6.488 144.468 -1 3 4 2
        i 6.489 144.535 -1 3 27 9
        i 6.490 144.601 -1 3 15 27
        i 6.491 144.668 -1 3 2 10
        i 6.492 144.735 -1 3 25 3
        i 6.493 144.801 -1 3 20 26
        i 6.494 144.868 -1 3 3 13
        i 6.495 144.935 -1 3 24 4
        i 6.496 145.001 -1 3 17 25
        i 6.497 145.068 -1 3 4 8
        i 6.498 145.135 -1 3 24 12
        i 6.499 145.201 -1 3 6 24
        i 6.500 145.268 -1 3 16 6
        i 6.501 145.335 -1 3 17 23
        i 6.502 145.401 -1 3 9 7
        i 6.503 145.468 -1 3 20 22
        i 6.504 145.535 -1 3 10 8
        i 6.505 145.601 -1 3 15 21
        i 6.506 145.668 -1 3 19 9
        i 6.507 145.735 -1 3 9 13
        i 6.508 145.801 -1 3 11 19
        i 6.509 145.868 -1 3 12 18
        i 6.510 145.935 -1 3 15 13
        i 6.511 146.001 -1 3 17 0
        i 6.512 146.068 -1 3 29 18
        i 6.513 146.135 -1 3 10 29
        i 6.514 146.201 -1 3 0 9
        i 6.515 146.268 -1 3 22 1
        i 6.516 146.335 -1 3 28 25
        i 6.517 146.401 -1 3 1 28
        i 6.518 146.468 -1 3 5 2
        i 6.519 146.535 -1 3 27 10
        i 6.520 146.601 -1 3 14 27
        i 6.521 146.668 -1 3 2 9
        i 6.522 146.735 -1 3 26 3
        i 6.523 146.801 -1 3 19 26
        i 6.524 146.868 -1 3 3 12
        i 6.525 146.935 -1 3 25 4
        i 6.526 147.001 -1 3 16 25
        i 6.527 147.068 -1 3 4 7
        i 6.528 147.135 -1 3 24 13
        i 6.529 147.201 -1 3 5 24
        i 6.530 147.268 -1 3 17 6
        i 6.531 147.335 -1 3 16 23
        i 6.532 147.401 -1 3 10 7
        i 6.533 147.468 -1 3 19 22
        i 6.534 147.535 -1 3 11 8
        i 6.535 147.601 -1 3 14 21
        i 6.536 147.668 -1 3 20 9
        i 6.537 147.735 -1 3 9 12
        i 6.538 147.801 -1 3 10 19
        i 6.539 147.868 -1 3 11 18
        i 6.540 147.935 -1 3 16 13
        i 6.541 148.001 -1 3 18 0
        i 6.542 148.068 -1 3 29 19
        i 6.543 148.135 -1 3 9 29
        i 6.544 148.201 -1 3 0 8
        i 6.545 148.268 -1 3 23 1
        i 6.546 148.335 -1 3 28 26
        i 6.547 148.401 -1 3 1 27
        i 6.548 148.468 -1 3 6 2
        i 6.549 148.535 -1 3 27 11
        i 6.550 148.601 -1 3 13 27
        i 6.551 148.668 -1 3 2 8
        i 6.552 148.735 -1 3 26 4
        i 6.553 148.801 -1 3 18 26
        i 6.554 148.868 -1 3 3 11
        i 6.555 148.935 -1 3 25 5
        i 6.556 149.001 -1 3 15 25
        i 6.557 149.068 -1 3 4 6
        i 6.558 149.135 -1 3 24 14
        i 6.559 149.201 -1 3 5 23
        i 6.560 149.268 -1 3 18 6
        i 6.561 149.335 -1 3 15 23
        i 6.562 149.401 -1 3 11 7
        i 6.563 149.468 -1 3 18 22
        i 6.564 149.535 -1 3 12 8
        i 6.565 149.601 -1 3 13 21
        i 6.566 149.668 -1 3 20 10
        i 6.567 149.735 -1 3 9 11
        i 6.568 149.801 -1 3 10 18
        i 6.569 149.868 -1 3 11 17
        i 6.570 149.935 -1 3 16 14
        i 6.571 150.001 -1 3 19 0
        i 6.572 150.068 -1 3 29 20
        i 6.573 150.135 -1 3 8 29
        i 6.574 150.201 -1 3 0 7
        i 6.575 150.268 -1 3 24 1
        i 6.576 150.335 -1 3 28 27
        i 6.577 150.401 -1 3 1 26
        i 6.578 150.468 -1 3 7 2
        i 6.579 150.535 -1 3 27 12
        i 6.580 150.601 -1 3 12 27
        i 6.581 150.668 -1 3 2 7
        i 6.582 150.735 -1 3 26 5
        i 6.583 150.801 -1 3 17 26
        i 6.584 150.868 -1 3 3 10
        i 6.585 150.935 -1 3 25 6
        i 6.586 151.001 -1 3 14 25
        i 6.587 151.068 -1 3 4 5
        i 6.588 151.135 -1 3 24 15
        i 6.589 151.201 -1 3 5 22
        i 6.590 151.268 -1 3 19 6
        i 6.591 151.335 -1 3 14 23
        i 6.592 151.401 -1 3 12 7
        i 6.593 151.468 -1 3 17 22
        i 6.594 151.535 -1 3 13 8
        i 6.595 151.601 -1 3 12 21
        i 6.596 151.668 -1 3 20 11
        i 6.597 151.735 -1 3 9 10
        i 6.598 151.801 -1 3 10 17
        i 6.599 151.868 -1 3 11 16
        i 6.600 151.935 -1 3 16 15
        i 6.601 152.001 -1 3 20 0
        i 6.602 152.068 -1 3 29 21
        i 6.603 152.135 -1 3 7 29
        i 6.604 152.201 -1 3 0 6
        i 6.605 152.268 -1 3 25 1
        i 6.606 152.335 -1 3 28 28
        i 6.607 152.401 -1 3 1 25
        i 6.608 152.468 -1 3 8 2
        i 6.609 152.535 -1 3 27 13
        i 6.610 152.601 -1 3 11 27
        i 6.611 152.668 -1 3 2 6
        i 6.612 152.735 -1 3 26 6
        i 6.613 152.801 -1 3 16 26
        i 6.614 152.868 -1 3 3 9
        i 6.615 152.935 -1 3 25 7
        i 6.616 153.001 -1 3 13 25
        i 6.617 153.068 -1 3 5 5
        i 6.618 153.135 -1 3 24 16
        i 6.619 153.201 -1 3 5 21
        i 6.620 153.268 -1 3 20 6
        i 6.621 153.335 -1 3 13 23
        i 6.622 153.401 -1 3 13 7
        i 6.623 153.468 -1 3 16 22
        i 6.624 153.535 -1 3 14 8
        i 6.625 153.601 -1 3 11 21
        i 6.626 153.668 -1 3 20 12
        i 6.627 153.735 -1 3 10 10
        i 6.628 153.801 -1 3 10 16
        i 6.629 153.868 -1 3 11 15
        i 6.630 153.935 -1 3 16 16
        i 6.631 154.001 -1 3 21 0
        i 6.632 154.068 -1 3 29 22
        i 6.633 154.135 -1 3 6 29
        i 6.634 154.201 -1 3 0 5
        i 6.635 154.268 -1 3 26 1
        i 6.636 154.335 -1 3 27 28
        i 6.637 154.401 -1 3 1 24
        i 6.638 154.468 -1 3 9 2
        i 6.639 154.535 -1 3 27 14
        i 6.640 154.601 -1 3 10 27
        i 6.641 154.668 -1 3 2 5
        i 6.642 154.735 -1 3 26 7
        i 6.643 154.801 -1 3 15 26
        i 6.644 154.868 -1 3 3 8
        i 6.645 154.935 -1 3 25 8
        i 6.646 155.001 -1 3 12 25
        i 6.647 155.068 -1 3 6 5
        i 6.648 155.135 -1 3 24 17
        i 6.649 155.201 -1 3 5 20
        i 6.650 155.268 -1 3 21 6
        i 6.651 155.335 -1 3 12 23
        i 6.652 155.401 -1 3 14 7
        i 6.653 155.468 -1 3 15 22
        i 6.654 155.535 -1 3 15 8
        i 6.655 155.601 -1 3 10 21
        i 6.656 155.668 -1 3 20 13
        i 6.657 155.735 -1 3 11 10
        i 6.658 155.801 -1 3 10 15
        i 6.659 155.868 -1 3 11 14
        i 6.660 155.935 -1 3 15 16
        i 6.661 156.001 -1 3 22 0
        i 6.662 156.068 -1 3 29 23
        i 6.663 156.135 -1 3 5 29
        i 6.664 156.201 -1 3 0 4
        i 6.665 156.268 -1 3 27 1
        i 6.666 156.335 -1 3 26 28
        i 6.667 156.401 -1 3 1 23
        i 6.668 156.468 -1 3 10 2
        i 6.669 156.535 -1 3 27 15
        i 6.670 156.601 -1 3 9 27
        i 6.671 156.668 -1 3 2 4
        i 6.672 156.735 -1 3 26 8
        i 6.673 156.801 -1 3 14 26
        i 6.674 156.868 -1 3 3 7
        i 6.675 156.935 -1 3 25 9
        i 6.676 157.001 -1 3 11 25
        i 6.677 157.068 -1 3 7 5
        i 6.678 157.135 -1 3 24 18
        i 6.679 157.201 -1 3 5 19
        i 6.680 157.268 -1 3 22 6
        i 6.681 157.335 -1 3 11 23
        i 6.682 157.401 -1 3 15 7
        i 6.683 157.468 -1 3 14 22
        i 6.684 157.535 -1 3 16 8
        i 6.685 157.601 -1 3 9 21
        i 6.686 157.668 -1 3 20 14
        i 6.687 157.735 -1 3 12 10
        i 6.688 157.801 -1 3 10 14
        i 6.689 157.868 -1 3 11 13
        i 6.690 157.935 -1 3 14 16
        i 6.691 158.001 -1 3 23 0
        i 6.692 158.068 -1 3 29 24
        i 6.693 158.135 -1 3 4 29
        i 6.694 158.201 -1 3 0 3
        i 6.695 158.268 -1 3 28 1
        i 6.696 158.335 -1 3 25 28
        i 6.697 158.401 -1 3 1 22
        i 6.698 158.468 -1 3 11 2
        i 6.699 158.535 -1 3 27 16
        i 6.700 158.601 -1 3 8 27
        i 6.701 158.668 -1 3 2 3
        i 6.702 158.735 -1 3 26 9
        i 6.703 158.801 -1 3 13 26
        i 6.704 158.868 -1 3 3 6
        i 6.705 158.935 -1 3 25 10
        i 6.706 159.001 -1 3 10 25
        i 6.707 159.068 -1 3 8 5
        i 6.708 159.135 -1 3 24 19
        i 6.709 159.201 -1 3 5 18
        i 6.710 159.268 -1 3 23 6
        i 6.711 159.335 -1 3 10 23
        i 6.712 159.401 -1 3 16 7
        i 6.713 159.468 -1 3 13 22
        i 6.714 159.535 -1 3 17 8
        i 6.715 159.601 -1 3 8 21
        i 6.716 159.668 -1 3 20 15
        i 6.717 159.735 -1 3 13 10
        i 6.718 159.801 -1 3 10 13
        i 6.719 159.868 -1 3 11 12
        i 6.720 159.935 -1 3 13 16
        i 6.721 160.001 -1 3 24 0
        i 6.722 160.068 -1 3 29 25
        i 6.723 160.135 -1 3 3 29
        i 6.724 160.201 -1 3 0 2
        i 6.725 160.268 -1 3 28 2
        i 6.726 160.335 -1 3 24 28
        i 6.727 160.401 -1 3 1 21
        i 6.728 160.468 -1 3 12 2
        i 6.729 160.535 -1 3 27 17
        i 6.730 160.601 -1 3 7 27
        i 6.731 160.668 -1 3 3 3
        i 6.732 160.735 -1 3 26 10
        i 6.733 160.801 -1 3 12 26
        i 6.734 160.868 -1 3 3 5
        i 6.735 160.935 -1 3 25 11
        i 6.736 161.001 -1 3 9 25
        i 6.737 161.068 -1 3 9 5
        i 6.738 161.135 -1 3 24 20
        i 6.739 161.201 -1 3 5 17
        i 6.740 161.268 -1 3 23 7
        i 6.741 161.335 -1 3 9 23
        i 6.742 161.401 -1 3 17 7
        i 6.743 161.468 -1 3 12 22
        i 6.744 161.535 -1 3 18 8
        i 6.745 161.601 -1 3 8 20
        i 6.746 161.668 -1 3 20 16
        i 6.747 161.735 -1 3 14 10
        i 6.748 161.801 -1 3 10 12
        i 6.749 161.868 -1 3 12 12
        i 6.750 161.935 -1 3 13 15
        i 6.751 162.001 -1 3 25 0
        i 6.752 162.068 -1 3 29 26
        i 6.753 162.135 -1 3 2 29
        i 6.754 162.201 -1 3 0 1
        i 6.755 162.268 -1 3 28 3
        i 6.756 162.335 -1 3 23 28
        i 6.757 162.401 -1 3 1 20
        i 6.758 162.468 -1 3 13 2
        i 6.759 162.535 -1 3 27 18
        i 6.760 162.601 -1 3 6 27
        i 6.761 162.668 -1 3 4 3
        i 6.762 162.735 -1 3 26 11
        i 6.763 162.801 -1 3 11 26
        i 6.764 162.868 -1 3 3 4
        i 6.765 162.935 -1 3 25 12
        i 6.766 163.001 -1 3 8 25
        i 6.767 163.068 -1 3 10 5
        i 6.768 163.135 -1 3 24 21
        i 6.769 163.201 -1 3 5 16
        i 6.770 163.268 -1 3 23 8
        i 6.771 163.335 -1 3 8 23
        i 6.772 163.401 -1 3 18 7
        i 6.773 163.468 -1 3 11 22
        i 6.774 163.535 -1 3 19 8
        i 6.775 163.601 -1 3 8 19
        i 6.776 163.668 -1 3 20 17
        i 6.777 163.735 -1 3 15 10
        i 6.778 163.801 -1 3 10 11
        i 6.779 163.868 -1 3 13 12
        i 6.780 163.935 -1 3 13 14
        i 6.781 164.001 -1 3 26 0
        i 6.782 164.068 -1 3 29 27
        i 6.783 164.135 -1 3 1 29
        i 6.784 164.201 -1 3 1 1
        i 6.785 164.268 -1 3 28 4
        i 6.786 164.335 -1 3 22 28
        i 6.787 164.401 -1 3 1 19
        i 6.788 164.468 -1 3 14 2
        i 6.789 164.535 -1 3 27 19
        i 6.790 164.601 -1 3 5 27
        i 6.791 164.668 -1 3 5 3
        i 6.792 164.735 -1 3 26 12
        i 6.793 164.801 -1 3 10 26
        i 6.794 164.868 -1 3 4 4
        i 6.795 164.935 -1 3 25 13
        i 6.796 165.001 -1 3 7 25
        i 6.797 165.068 -1 3 11 5
        i 6.798 165.135 -1 3 24 22
        i 6.799 165.201 -1 3 5 15
        i 6.800 165.268 -1 3 23 9
        i 6.801 165.335 -1 3 7 23
        i 6.802 165.401 -1 3 19 7
        i 6.803 165.468 -1 3 10 22
        i 6.804 165.535 -1 3 20 8
        i 6.805 165.601 -1 3 8 18
        i 6.806 165.668 -1 3 20 18
        i 6.807 165.735 -1 3 16 10
        i 6.808 165.801 -1 3 11 11
        i 6.809 165.868 -1 3 14 12
        i 6.810 165.935 -1 3 14 14
        i 6.811 166.001 -1 3 27 0
        i 6.812 166.068 -1 3 29 28
        i 6.813 166.135 -1 3 0 29
        i 6.814 166.201 -1 3 2 1
        i 6.815 166.268 -1 3 28 5
        i 6.816 166.335 -1 3 21 28
        i 6.817 166.401 -1 3 1 18
        i 6.818 166.468 -1 3 15 2
        i 6.819 166.535 -1 3 27 20
        i 6.820 166.601 -1 3 4 27
        i 6.821 166.668 -1 3 6 3
        i 6.822 166.735 -1 3 26 13
        i 6.823 166.801 -1 3 9 26
        i 6.824 166.868 -1 3 5 4
        i 6.825 166.935 -1 3 25 14
        i 6.826 167.001 -1 3 6 25
        i 6.827 167.068 -1 3 12 5
        i 6.828 167.135 -1 3 24 23
        i 6.829 167.201 -1 3 5 14
        i 6.830 167.268 -1 3 23 10
        i 6.831 167.335 -1 3 6 23
        i 6.832 167.401 -1 3 20 7
        i 6.833 167.468 -1 3 9 22
        i 6.834 167.535 -1 3 21 8
        i 6.835 167.601 -1 3 8 17
        i 6.836 167.668 -1 3 20 19
        i 6.837 167.735 -1 3 17 10
        i 6.838 167.801 -1 3 12 11
        i 6.839 167.868 -1 3 15 12
        i 6.840 167.935 -1 3 15 14
        i 6.841 168.001 -1 3 28 0
        i 6.842 168.068 -1 3 29 29
        i 6.843 168.135 -1 3 0 28
        i 6.844 168.201 -1 3 3 1
        i 6.845 168.268 -1 3 28 6
        i 6.846 168.335 -1 3 20 28
        i 6.847 168.401 -1 3 1 17
        i 6.848 168.468 -1 3 16 2
        i 6.849 168.535 -1 3 27 21
        i 6.850 168.601 -1 3 3 27
        i 6.851 168.668 -1 3 7 3
        i 6.852 168.735 -1 3 26 14
        i 6.853 168.801 -1 3 8 26
        i 6.854 168.868 -1 3 6 4
        i 6.855 168.935 -1 3 25 15
        i 6.856 169.001 -1 3 5 25
        i 6.857 169.068 -1 3 13 5
        i 6.858 169.135 -1 3 24 24
        i 6.859 169.201 -1 3 5 13
        i 6.860 169.268 -1 3 23 11
        i 6.861 169.335 -1 3 6 22
        i 6.862 169.401 -1 3 21 7
        i 6.863 169.468 -1 3 8 22
        i 6.864 169.535 -1 3 21 9
        i 6.865 169.601 -1 3 8 16
        i 6.866 169.668 -1 3 20 20
        i 6.867 169.735 -1 3 18 10
        i 6.868 169.801 -1 3 13 11
        i 6.869 169.868 -1 3 16 12
        i 6.870 169.935 -1 3 15 15
        i 6.871 170.001 -1 3 29 0
        i 6.872 170.068 -1 3 28 29
        i 6.873 170.135 -1 3 0 27
        i 6.874 170.201 -1 3 4 1
        i 6.875 170.268 -1 3 28 7
        i 6.876 170.335 -1 3 19 28
        i 6.877 170.401 -1 3 1 16
        i 6.878 170.468 -1 3 17 2
        i 6.879 170.535 -1 3 27 22
        i 6.880 170.601 -1 3 2 27
        i 6.881 170.668 -1 3 8 3
        i 6.882 170.735 -1 3 26 15
        i 6.883 170.801 -1 3 7 26
        i 6.884 170.868 -1 3 7 4
        i 6.885 170.935 -1 3 25 16
        i 6.886 171.001 -1 3 4 25
        i 6.887 171.068 -1 3 14 5
        i 6.888 171.135 -1 3 23 24
        i 6.889 171.201 -1 3 5 12
        i 6.890 171.268 -1 3 23 12
        i 6.891 171.335 -1 3 6 21
        i 6.892 171.401 -1 3 22 7
        i 6.893 171.468 -1 3 7 22
        i 6.894 171.535 -1 3 21 10
        i 6.895 171.601 -1 3 8 15
        i 6.896 171.668 -1 3 19 20
        i 6.897 171.735 -1 3 19 10
        i 6.898 171.801 -1 3 14 11
        i 6.899 171.868 -1 3 17 12
        i 6.900 171.935 -1 3 14 15
        i 5.188 112.169 0.100 1 1091 43
        i 5.189 112.213 0.100 1 1092 72
        i 5.190 112.323 0.100 1 1109 68
        i 5.191 112.351 0.100 1 1095 65
        i 5.192 112.419 0.100 1 1092 78
        i 5.193 112.425 0.100 1 1098 81
        i 5.194 112.481 0.100 1 1105 74
        i 5.195 112.485 0.100 1 1100 54
        i 5.196 112.543 0.100 1 1104 50
        i 5.197 112.707 0.100 1 1107 53
        i 5.198 112.737 0.100 1 1102 59
        i 4.421 112.751 0.490 3 38 127 0
        i 4.422 113.251 0.490 3 38 127 1
        i 4.423 114.251 0.490 3 38 127 2
        i 4.424 115.751 0.490 3 38 127 3
        i 4.425 117.751 0.490 3 38 127 4
        i 5.199 112.767 0.100 1 1108 60
        i 5.200 112.904 0.100 1 1105 59
        i 5.201 112.995 0.100 1 1095 48
        i 5.202 113.020 0.100 1 1105 65
        i 5.203 113.119 0.100 1 1100 62
        i 5.204 113.127 0.100 1 1101 81
        i 5.205 113.201 0.100 1 1096 54
        i 5.206 113.203 0.100 1 1102 83
        i 5.207 113.212 0.100 1 1097 65
        i 5.208 113.232 0.100 1 1092 58
        i 5.209 113.235 0.100 1 1104 74
        i 5.210 113.297 0.100 1 1102 67
        i 5.211 113.423 0.100 1 1100 61
        i 5.212 113.604 0.100 1 1108 56
        i 5.213 113.641 0.100 1 1092 61
        i 5.214 113.653 0.100 1 1100 61
        i 5.215 113.709 0.100 1 1110 71
        i 5.216 113.712 0.100 1 1100 82
        i 5.217 113.748 0.100 1 1098 69
        i 5.218 113.888 0.100 1 1094 75
        i 5.219 113.988 0.100 1 1094 58
        i 4.427 114.001 0.490 3 52 49 0
        i 4.428 114.501 0.490 3 52 49 1
        i 4.429 115.501 0.490 3 52 49 2
        i 4.430 117.001 0.490 3 52 49 3
        i 4.431 119.001 0.490 3 52 49 4
        i 5.220 113.999 0.100 1 1102 53
        i 5.221 114.007 0.100 1 1099 63
        i 5.222 114.135 0.100 1 1102 78
        i 5.223 114.164 0.100 1 1106 76
        i 5.224 114.176 0.100 1 1098 72
        i 5.225 114.176 0.100 1 1099 66
        i 5.226 114.205 0.100 1 1100 83
        i 5.227 114.439 0.100 1 1098 82
        i 5.228 114.523 0.100 1 1112 50
        i 5.229 114.529 0.100 1 1110 73
        i 5.230 114.565 0.100 1 1100 49
        i 5.231 114.705 0.100 1 1094 69
        i 5.232 114.744 0.100 1 1102 75
        i 4.433 114.751 0.490 3 53 49 0
        i 4.434 115.251 0.490 3 53 49 1
        i 4.435 116.251 0.490 3 53 49 2
        i 4.436 117.751 0.490 3 53 49 3
        i 4.437 119.751 0.490 3 53 49 4
        i 5.233 114.779 0.100 1 1100 74
        i 5.234 114.824 0.100 1 1094 55
        i 5.235 114.867 0.100 1 1098 54
        i 5.236 114.891 0.100 1 1100 52
        i 5.237 114.945 0.100 1 1092 81
        i 5.238 114.967 0.100 1 1102 54
        i 5.239 114.975 0.100 1 1097 63
        i 5.240 115.015 0.100 1 1096 79
        i 5.241 115.116 0.100 1 1098 66
        i 5.242 115.197 0.100 1 1108 76
        i 5.243 115.211 0.100 1 1096 53
        i 5.244 115.335 0.100 1 1112 70
        i 5.245 115.413 0.100 1 1102 52
        i 5.246 115.529 0.100 1 1099 52
        i 5.247 115.536 0.100 1 1110 58
        i 5.248 115.581 0.100 1 1104 74
        i 5.249 115.647 0.100 1 1100 52
        i 5.250 115.676 0.100 1 1104 72
        i 5.251 115.677 0.100 1 1096 74
        i 5.252 115.727 0.100 1 1102 64
        i 5.253 115.740 0.100 1 1102 79
        i 5.254 115.785 0.100 1 1090 73
        i 5.255 115.785 0.100 1 1098 77
        i 5.256 115.799 0.100 1 1092 49
        i 4.439 116.001 0.490 3 41 127 0
        i 4.440 116.501 0.490 3 41 127 1
        i 4.441 117.501 0.490 3 41 127 2
        i 4.442 119.001 0.490 3 41 127 3
        i 4.443 121.001 0.490 3 41 127 4
        i 5.257 116.048 0.100 1 1104 69
        i 5.258 116.115 0.100 1 1094 73
        i 5.259 116.171 0.100 1 1093 62
        i 5.260 116.208 0.100 1 1093 53
        i 5.261 116.277 0.100 1 1106 59
        i 5.262 116.281 0.100 1 1104 54
        i 5.263 116.332 0.100 1 1100 65
        i 5.264 116.365 0.100 1 1106 68
        i 5.265 116.407 0.100 1 1108 69
        i 5.266 116.416 0.100 1 1100 55
        i 5.267 116.427 0.100 1 1106 54
        i 5.268 116.492 0.100 1 1104 71
        i 5.269 116.575 0.100 1 1106 75
        i 5.270 116.709 0.100 1 1091 82
        i 5.271 116.713 0.100 1 1092 48
        i 4.445 116.751 0.490 3 40 127 0
        i 4.446 117.251 0.490 3 40 127 1
        i 4.447 118.251 0.490 3 40 127 2
        i 4.448 119.751 0.490 3 40 127 3
        i 4.449 121.751 0.490 3 40 127 4
        i 5.272 116.785 0.100 1 1106 63
        i 5.273 116.795 0.100 1 1096 54
        i 5.274 116.904 0.100 1 1099 81
        i 5.275 116.913 0.100 1 1096 65
        i 5.276 116.944 0.100 1 1091 79
        i 5.277 117.117 0.100 1 1108 55
        i 5.278 117.117 0.100 1 1104 67
        i 5.279 117.125 0.100 1 1100 69
        i 5.280 117.167 0.100 1 1104 68
        i 5.281 117.233 0.100 1 1104 74
        i 5.282 117.391 0.100 1 1106 74
        i 5.283 117.452 0.100 1 1102 55
        i 5.284 117.461 0.100 1 1094 45
        i 5.285 117.524 0.100 1 1106 65
        i 5.286 117.548 0.100 1 1098 79
        i 5.287 117.620 0.100 1 1102 69
        i 5.288 117.631 0.100 1 1101 74
        i 5.289 117.652 0.100 1 1101 66
        i 5.290 117.696 0.100 1 1104 80
        i 5.291 117.709 0.100 1 1101 58
        i 5.292 117.811 0.100 1 1098 56
        i 5.293 117.827 0.100 1 1093 52
        i 5.294 117.871 0.100 1 1100 69
        i 4.451 118.001 0.490 3 57 49 0
        i 4.452 118.501 0.490 3 57 49 1
        i 4.453 119.501 0.490 3 57 49 2
        i 4.454 121.001 0.490 3 57 49 3
        i 4.455 123.001 0.490 3 57 49 4
        i 5.295 118.029 0.100 1 1092 53
        i 5.296 118.071 0.100 1 1109 63
        i 5.297 118.151 0.100 1 1097 75
        i 5.298 118.213 0.100 1 1099 75
        i 5.299 118.239 0.100 1 1104 69
        i 5.300 118.284 0.100 1 1099 66
        i 5.301 118.295 0.100 1 1108 56
        i 5.302 118.437 0.100 1 1095 76
        i 5.303 118.451 0.100 1 1103 71
        i 5.304 118.533 0.100 1 1099 56
        i 5.305 118.547 0.100 1 1107 69
        i 5.306 118.576 0.100 1 1093 61
        i 5.307 118.588 0.100 1 1100 59
        i 5.308 118.592 0.100 1 1100 73
        i 5.309 118.643 0.100 1 1098 48
        i 5.310 118.727 0.100 1 1111 71
        i 4.457 118.751 0.490 3 55 49 0
        i 4.458 119.251 0.490 3 55 49 1
        i 4.459 120.251 0.490 3 55 49 2
        i 4.460 121.751 0.490 3 55 49 3
        i 4.461 123.751 0.490 3 55 49 4
        i 5.311 118.815 0.100 1 1095 81
        i 5.312 118.907 0.100 1 1109 77
        i 5.313 119.049 0.100 1 1113 50
        i 5.314 119.085 0.100 1 1101 72
        i 5.315 119.209 0.100 1 1095 84
        i 5.316 119.277 0.100 1 1097 61
        i 5.317 119.344 0.100 1 1102 74
        i 5.318 119.388 0.100 1 1105 54
        i 5.319 119.419 0.100 1 1093 74
        i 5.320 119.429 0.100 1 1097 48
        i 5.321 119.436 0.100 1 1099 73
        i 5.322 119.475 0.100 1 1103 56
        i 5.323 119.479 0.100 1 1093 82
        i 5.324 119.495 0.100 1 1107 51
        i 5.325 119.523 0.100 1 1098 70
        i 5.326 119.585 0.100 1 1101 78
        i 5.327 119.717 0.100 1 1097 72
        i 5.328 119.763 0.100 1 1101 54
        i 5.329 119.885 0.100 1 1111 77
        i 4.463 120.001 0.490 3 36 127 0
        i 4.464 120.501 0.490 3 36 127 1
        i 4.465 121.501 0.490 3 36 127 2
        i 4.466 123.001 0.490 3 36 127 3
        i 4.467 125.001 0.490 3 36 127 4
        i 5.330 120.059 0.100 1 1099 49
        i 5.331 120.081 0.100 1 1103 55
        i 5.332 120.099 0.100 1 1100 58
        i 5.333 120.145 0.100 1 1103 56
        i 5.334 120.168 0.100 1 1099 70
        i 5.335 120.205 0.100 1 1101 59
        i 5.336 120.211 0.100 1 1105 59
        i 5.337 120.291 0.100 1 1103 67
        i 5.338 120.327 0.100 1 1109 64
        i 5.339 120.348 0.100 1 1091 76
        i 5.340 120.393 0.100 1 1095 56
        i 5.341 120.408 0.100 1 1091 51
        i 5.342 120.527 0.100 1 1105 66
        i 5.343 120.625 0.100 1 1097 57
        i 5.344 120.709 0.100 1 1093 65
        i 4.469 120.751 0.490 3 38 127 0
        i 4.470 121.251 0.490 3 38 127 1
        i 4.471 122.251 0.490 3 38 127 2
        i 4.472 123.751 0.490 3 38 127 3
        i 4.473 125.751 0.490 3 38 127 4
        i 5.345 120.756 0.100 1 1099 79
        i 5.346 120.761 0.100 1 1092 53
        i 5.347 120.800 0.100 1 1095 82
        i 5.348 120.877 0.100 1 1107 62
        i 5.349 120.877 0.100 1 1107 55
        i 5.350 120.908 0.100 1 1105 66
        i 5.351 120.988 0.100 1 1105 74
        i 5.352 121.011 0.100 1 1101 58
        i 5.353 121.144 0.100 1 1107 78
        i 5.354 121.159 0.100 1 1105 68
        i 5.355 121.221 0.100 1 1091 83
        i 5.356 121.257 0.100 1 1093 57
        i 5.357 121.287 0.100 1 1105 54
        i 5.358 121.348 0.100 1 1099 63
        i 5.359 121.359 0.100 1 1097 70
        i 5.360 121.383 0.100 1 1099 67
        i 5.361 121.445 0.100 1 1103 49
        i 5.362 121.513 0.100 1 1092 67
        i 5.363 121.529 0.100 1 1107 51
        i 5.364 121.541 0.100 1 1107 67
        i 5.365 121.640 0.100 1 1103 57
        i 5.366 121.764 0.100 1 1099 50
        i 5.367 121.789 0.100 1 1103 67
        i 5.368 121.863 0.100 1 1097 75
        i 5.369 121.927 0.100 1 1093 61
        i 4.475 122.001 0.490 3 52 49 0
        i 4.476 122.501 0.490 3 52 49 1
        i 4.477 123.501 0.490 3 52 49 2
        i 4.478 125.001 0.490 3 52 49 3
        i 4.479 127.001 0.490 3 52 49 4
        i 5.370 122.053 0.100 1 1105 69
        i 5.371 122.064 0.100 1 1101 73
        i 5.372 122.073 0.100 1 1101 78
        i 5.373 122.112 0.100 1 1109 50
        i 5.374 122.179 0.100 1 1100 65
        i 5.375 122.185 0.100 1 1101 60
        i 5.376 122.209 0.100 1 1100 73
        i 5.377 122.319 0.100 1 1109 53
        i 5.378 122.409 0.100 1 1099 70
        i 5.379 122.421 0.100 1 1093 75
        i 5.380 122.432 0.100 1 1101 70
        i 5.381 122.439 0.100 1 1091 50
        i 5.382 122.540 0.100 1 1105 58
        i 5.383 122.615 0.100 1 1094 78
        i 5.384 122.651 0.100 1 1099 74
        i 5.385 122.724 0.100 1 1098 61
        i 5.386 122.744 0.100 1 1111 49
        i 4.481 122.751 0.490 3 53 49 0
        i 4.482 123.251 0.490 3 53 49 1
        i 4.483 124.251 0.490 3 53 49 2
        i 4.484 125.751 0.490 3 53 49 3
        i 4.485 127.751 0.490 3 53 49 4
        i 5.387 122.915 0.100 1 1099 75
        i 5.388 122.987 0.100 1 1103 67
        i 5.389 122.988 0.100 1 1095 75
        i 5.390 122.999 0.100 1 1101 58
        i 5.391 123.103 0.100 1 1098 73
        i 5.392 123.129 0.100 1 1099 54
        i 5.393 123.131 0.100 1 1104 76
        i 5.394 123.164 0.100 1 1092 82
        i 5.395 123.167 0.100 1 1103 74
        i 5.396 123.171 0.100 1 1107 59
        i 5.397 123.209 0.100 1 1101 72
        i 5.398 123.283 0.100 1 1108 71
        i 5.399 123.315 0.100 1 1102 54
        i 5.400 123.531 0.100 1 1113 78
        i 5.401 123.681 0.100 1 1098 56
        i 5.402 123.708 0.100 1 1096 53
        i 5.403 123.912 0.100 1 1102 75
        i 5.404 123.912 0.100 1 1103 55
        i 5.405 123.941 0.100 1 1101 55
        i 5.406 123.963 0.100 1 1092 69
        i 5.407 123.992 0.100 1 1097 62
        i 4.487 124.001 0.490 3 41 127 0
        i 4.488 124.501 0.490 3 41 127 1
        i 4.489 125.501 0.490 3 41 127 2
        i 4.490 127.001 0.490 3 41 127 3
        i 4.491 129.001 0.490 3 41 127 4
        i 5.408 124.000 0.100 1 1099 73
        i 5.409 124.012 0.100 1 1094 65
        i 5.410 124.043 0.100 1 1104 59
        i 5.411 124.049 0.100 1 1110 74
        i 5.412 124.093 0.100 1 1098 56
        i 5.413 124.124 0.100 1 1106 50
        i 5.414 124.207 0.100 1 1101 49
        i 5.415 124.227 0.100 1 1098 56
        i 5.416 124.457 0.100 1 1098 59
        i 5.417 124.468 0.100 1 1099 70
        i 5.418 124.569 0.100 1 1104 76
        i 5.419 124.572 0.100 1 1100 50
        i 5.420 124.684 0.100 1 1100 75
        i 5.421 124.691 0.100 1 1101 64
        i 4.493 124.751 0.490 3 43 127 0
        i 4.494 125.251 0.490 3 43 127 1
        i 4.495 126.251 0.490 3 43 127 2
        i 4.496 127.751 0.490 3 43 127 3
        i 4.497 129.751 0.490 3 43 127 4
        i 5.422 124.769 0.100 1 1106 76
        i 5.423 124.847 0.100 1 1090 76
        i 5.424 124.875 0.100 1 1096 77
        i 5.425 124.951 0.100 1 1092 44
        i 5.426 125.044 0.100 1 1106 56
        i 5.427 125.075 0.100 1 1104 75
        i 5.428 125.091 0.100 1 1108 71
        i 5.429 125.189 0.100 1 1098 73
        i 5.430 125.207 0.100 1 1092 80
        i 5.431 125.268 0.100 1 1100 65
        i 5.432 125.343 0.100 1 1104 60
        i 5.433 125.375 0.100 1 1091 74
        i 5.434 125.393 0.100 1 1102 55
        i 5.435 125.436 0.100 1 1104 48
        i 5.436 125.464 0.100 1 1107 75
        i 5.437 125.480 0.100 1 1096 56
        i 5.438 125.555 0.100 1 1100 54
        i 5.439 125.729 0.100 1 1090 60
        i 5.440 125.816 0.100 1 1106 54
        i 5.441 125.843 0.100 1 1096 62
        i 5.442 125.861 0.100 1 1106 77
        i 5.443 125.871 0.100 1 1100 81
        i 5.444 125.940 0.100 1 1102 73
        i 4.499 126.001 0.490 3 57 49 0
        i 4.500 126.501 0.490 3 57 49 1
        i 4.501 127.501 0.490 3 57 49 2
        i 4.502 129.001 0.490 3 57 49 3
        i 4.503 131.001 0.490 3 57 49 4
        i 5.445 126.001 0.100 1 1106 59
        i 5.446 126.015 0.100 1 1110 52
        i 5.447 126.015 0.100 1 1108 73
        i 5.448 126.044 0.100 1 1098 80
        i 5.449 126.105 0.100 1 1093 70
        i 5.450 126.193 0.100 1 1102 78
        i 5.451 126.349 0.100 1 1100 61
        i 5.452 126.353 0.100 1 1098 76
        i 5.453 126.515 0.100 1 1112 44
        i 5.454 126.519 0.100 1 1108 61
        i 5.455 126.571 0.100 1 1104 63
        i 5.456 126.628 0.100 1 1100 78
        i 5.457 126.683 0.100 1 1094 63
        i 5.458 126.705 0.100 1 1100 78
        i 5.459 126.728 0.100 1 1102 67
        i 5.460 126.748 0.100 1 1099 78
        i 4.505 126.751 0.490 3 59 49 0
        i 4.506 127.251 0.490 3 59 49 1
        i 4.507 128.251 0.490 3 59 49 2
        i 4.508 129.751 0.490 3 59 49 3
        i 4.509 131.751 0.490 3 59 49 4
        i 5.461 126.885 0.100 1 1102 61
        i 5.462 126.935 0.100 1 1100 62
        i 5.463 126.935 0.100 1 1110 48
        i 5.464 126.965 0.100 1 1094 78
        i 5.465 127.027 0.100 1 1098 65
        i 5.466 127.061 0.100 1 1114 41
        i 5.467 127.063 0.100 1 1110 49
        i 5.468 127.151 0.100 1 1102 68
        i 5.469 127.165 0.100 1 1106 71
        i 5.470 127.232 0.100 1 1097 67
        i 5.471 127.287 0.100 1 1104 62
        i 5.472 127.359 0.100 1 1098 68
        i 5.473 127.487 0.100 1 1096 69
        i 5.474 127.533 0.100 1 1102 63
        i 5.475 127.633 0.100 1 1100 76
        i 5.476 127.652 0.100 1 1102 52
        i 5.477 127.693 0.100 1 1097 57
        i 5.478 127.696 0.100 1 1092 78
        i 5.479 127.757 0.100 1 1108 59
        i 5.480 127.773 0.100 1 1104 75
        i 5.481 127.913 0.100 1 1108 64
        i 4.511 128.001 0.490 3 36 127 0
        i 4.512 128.501 0.490 3 36 127 1
        i 4.513 129.501 0.490 3 36 127 2
        i 4.514 131.001 0.490 3 36 127 3
        i 4.515 133.001 0.490 3 36 127 4
        i 5.482 128.044 0.100 1 1104 57
        i 5.483 128.048 0.100 1 1112 69
        i 5.484 128.156 0.100 1 1101 56
        i 5.485 128.204 0.100 1 1097 66
        i 5.486 128.235 0.100 1 1104 62
        i 5.487 128.316 0.100 1 1102 72
        i 5.488 128.404 0.100 1 1100 49
        i 5.489 128.417 0.100 1 1092 68
        i 5.490 128.444 0.100 1 1096 74
        i 5.491 128.469 0.100 1 1098 61
        i 5.492 128.489 0.100 1 1095 66
        i 5.493 128.628 0.100 1 1106 44
        i 5.494 128.639 0.100 1 1105 53
        i 5.495 128.663 0.100 1 1099 60
        i 5.496 128.735 0.100 1 1099 78
        i 4.517 128.751 0.490 3 38 127 0
        i 4.518 129.251 0.490 3 38 127 1
        i 4.519 130.251 0.490 3 38 127 2
        i 4.520 131.751 0.490 3 38 127 3
        i 4.521 133.751 0.490 3 38 127 4
        i 5.497 128.789 0.100 1 1099 73
        i 5.498 128.819 0.100 1 1106 66
        i 5.499 128.921 0.100 1 1110 73
        i 5.500 129.065 0.100 1 1098 63
        i 5.501 129.107 0.100 1 1099 80
        i 5.502 129.112 0.100 1 1108 57
        i 5.503 129.139 0.100 1 1100 73
        i 5.504 129.172 0.100 1 1096 64
        i 5.505 129.213 0.100 1 1106 53
        i 5.506 129.257 0.100 1 1089 56
        i 5.507 129.281 0.100 1 1101 60
        i 5.508 129.452 0.100 1 1103 54
        i 5.509 129.481 0.100 1 1108 48
        i 5.510 129.516 0.100 1 1105 63
        i 5.511 129.575 0.100 1 1106 80
        i 5.512 129.667 0.100 1 1097 62
        i 5.513 129.688 0.100 1 1101 68
        i 5.514 129.688 0.100 1 1103 73
        i 5.515 129.703 0.100 1 1091 71
        i 5.516 129.873 0.100 1 1108 75
        i 5.517 129.888 0.100 1 1103 64
        i 5.518 129.987 0.100 1 1091 81
        i 4.523 130.001 0.490 3 52 49 0
        i 4.524 130.501 0.490 3 52 49 1
        i 4.525 131.501 0.490 3 52 49 2
        i 4.526 133.001 0.490 3 52 49 3
        i 4.527 135.001 0.490 3 52 49 4
        i 5.519 130.009 0.100 1 1099 79
        i 5.520 130.021 0.100 1 1105 65
        i 5.521 130.029 0.100 1 1107 77
        i 5.522 130.045 0.100 1 1096 81
        i 5.523 130.193 0.100 1 1105 61
        i 5.524 130.237 0.100 1 1091 63
        i 5.525 130.252 0.100 1 1109 70
        i 5.526 130.343 0.100 1 1101 58
        i 5.527 130.351 0.100 1 1095 80
        i 5.528 130.403 0.100 1 1101 72
        i 5.529 130.545 0.100 1 1101 61
        i 5.530 130.597 0.100 1 1106 72
        i 5.531 130.617 0.100 1 1101 73
        i 5.532 130.696 0.100 1 1094 55
        i 5.533 130.731 0.100 1 1099 56
        i 4.529 130.751 0.490 3 53 49 0
        i 4.530 131.251 0.490 3 53 49 1
        i 5.534 130.752 0.100 1 1099 70
        i 4.531 132.251 0.490 3 53 49 2
        i 4.532 133.751 0.490 3 53 49 3
        i 4.533 135.751 0.490 3 53 49 4
        i 5.535 130.853 0.100 1 1097 71
        i 5.536 130.917 0.100 1 1113 58
        i 5.537 131.000 0.100 1 1109 78
        i 5.538 131.052 0.100 1 1103 71
        i 5.539 131.201 0.100 1 1099 57
        i 5.540 131.252 0.100 1 1111 70
        i 5.541 131.269 0.100 1 1099 53
        i 5.542 131.279 0.100 1 1093 61
        i 5.543 131.315 0.100 1 1103 82
        i 5.544 131.317 0.100 1 1098 79
        i 5.545 131.343 0.100 1 1101 52
        i 5.546 131.420 0.100 1 1095 78
        i 5.547 131.427 0.100 1 1107 55
        i 5.548 131.447 0.100 1 1103 77
        i 5.549 131.683 0.100 1 1099 56
        i 5.550 131.740 0.100 1 1097 62
        i 5.551 131.759 0.100 1 1113 47
        i 5.552 131.827 0.100 1 1101 78
        i 5.553 131.865 0.100 1 1111 79
        i 5.554 131.879 0.100 1 1097 68
        i 5.555 131.945 0.100 1 1097 58
        i 5.556 131.971 0.100 1 1103 71
        i 4.535 132.001 0.490 3 41 127 0
        i 4.536 132.501 0.490 3 41 127 1
        i 4.537 133.501 0.490 3 41 127 2
        i 4.538 135.001 0.490 3 41 127 3
        i 4.539 137.001 0.490 3 41 127 4
        i 5.557 132.047 0.100 1 1109 53
        i 5.558 132.129 0.100 1 1103 79
        i 5.559 132.228 0.100 1 1093 75
        i 5.560 132.239 0.100 1 1109 53
        i 5.561 132.284 0.100 1 1096 53
        i 5.562 132.355 0.100 1 1105 69
        i 5.563 132.405 0.100 1 1105 57
        i 5.564 132.544 0.100 1 1107 71
        i 5.565 132.577 0.100 1 1111 57
        i 5.566 132.617 0.100 1 1101 55
        i 5.567 132.635 0.100 1 1105 58
        i 5.568 132.700 0.100 1 1097 58
        i 4.541 132.751 0.490 3 40 127 0
        i 4.542 133.251 0.490 3 40 127 1
        i 4.543 134.251 0.490 3 40 127 2
        i 4.544 135.751 0.490 3 40 127 3
        i 4.545 137.751 0.490 3 40 127 4
        i 5.569 132.812 0.100 1 1099 58
        i 5.570 132.831 0.100 1 1091 66
        i 5.571 132.921 0.100 1 1095 65
        i 5.572 132.928 0.100 1 1101 68
        i 5.573 132.965 0.100 1 1095 61
        i 5.574 133.044 0.100 1 1103 54
        i 5.575 133.171 0.100 1 1099 57
        i 5.576 133.196 0.100 1 1105 63
        i 5.577 133.232 0.100 1 1100 60
        i 5.578 133.243 0.100 1 1100 53
        i 5.579 133.256 0.100 1 1103 74
        i 5.580 133.325 0.100 1 1107 57
        i 5.581 133.352 0.100 1 1109 57
        i 5.582 133.495 0.100 1 1097 78
        i 5.583 133.528 0.100 1 1099 82
        i 5.584 133.537 0.100 1 1105 84
        i 5.585 133.625 0.100 1 1089 59
        i 5.586 133.649 0.100 1 1100 73
        i 5.587 133.661 0.100 1 1097 74
        i 5.588 133.723 0.100 1 1101 70
        i 5.589 133.743 0.100 1 1105 66
        i 5.590 133.755 0.100 1 1105 55
        i 5.591 133.781 0.100 1 1107 70
        i 5.592 133.860 0.100 1 1107 65
        i 5.593 133.872 0.100 1 1102 69
        i 4.547 134.001 0.490 3 57 49 0
        i 4.548 134.501 0.490 3 57 49 1
        i 4.549 135.501 0.490 3 57 49 2
        i 4.550 137.001 0.490 3 57 49 3
        i 4.551 139.001 0.490 3 57 49 4
        i 5.594 134.053 0.100 1 1107 54
        i 5.595 134.143 0.100 1 1096 66
        i 5.596 134.200 0.100 1 1090 79
        i 5.597 134.283 0.100 1 1107 77
        i 5.598 134.364 0.100 1 1103 50
        i 5.599 134.371 0.100 1 1105 77
        i 5.600 134.395 0.100 1 1103 69
        i 5.601 134.423 0.100 1 1099 48
        i 5.602 134.491 0.100 1 1097 55
        i 5.603 134.521 0.100 1 1108 66
        i 5.604 134.599 0.100 1 1092 63
        i 5.605 134.636 0.100 1 1102 59
        i 5.606 134.644 0.100 1 1103 59
        i 5.607 134.731 0.100 1 1109 65
        i 5.608 134.747 0.100 1 1092 53
        i 4.553 134.751 0.490 3 55 49 0
        i 4.554 135.251 0.490 3 55 49 1
        i 4.555 136.251 0.490 3 55 49 2
        i 4.556 137.751 0.490 3 55 49 3
        i 4.557 139.751 0.490 3 55 49 4
        i 5.609 134.763 0.100 1 1105 56
        i 5.610 134.933 0.100 1 1102 58
        i 5.611 135.073 0.100 1 1109 79
        i 5.612 135.104 0.100 1 1100 60
        i 5.613 135.176 0.100 1 1101 61
        i 5.614 135.195 0.100 1 1105 53
        i 5.615 135.247 0.100 1 1100 64
        i 5.616 135.285 0.100 1 1094 58
        i 5.617 135.297 0.100 1 1099 70
        i 5.618 135.311 0.100 1 1096 59
        i 5.619 135.387 0.100 1 1094 83
        i 5.620 135.427 0.100 1 1114 68
        i 5.621 135.497 0.100 1 1098 79
        i 5.622 135.579 0.100 1 1103 53
        i 5.623 135.692 0.100 1 1108 50
        i 5.624 135.700 0.100 1 1098 66
        i 5.625 135.753 0.100 1 1101 67
        i 5.626 135.833 0.100 1 1096 65
        i 5.627 135.885 0.100 1 1097 71
        i 5.628 135.889 0.100 1 1112 55
        i 5.629 135.900 0.100 1 1104 73
        i 5.630 135.923 0.100 1 1104 58
        i 5.631 135.957 0.100 1 1098 68
        i 4.559 136.001 0.490 3 40 127 0
        i 4.560 136.501 0.490 3 40 127 1
        i 4.561 137.501 0.490 3 40 127 2
        i 4.562 139.001 0.490 3 40 127 3
        i 4.563 141.001 0.490 3 40 127 4
        i 5.632 136.052 0.100 1 1110 78
        i 5.633 136.200 0.100 1 1112 42
        i 5.634 136.251 0.100 1 1096 80
        i 5.635 136.313 0.100 1 1100 66
        i 5.636 136.373 0.100 1 1094 74
        i 5.637 136.404 0.100 1 1098 76
        i 5.638 136.452 0.100 1 1102 71
        i 5.639 136.471 0.100 1 1096 64
        i 5.640 136.560 0.100 1 1108 50
        i 5.641 136.660 0.100 1 1108 59
        i 5.642 136.727 0.100 1 1106 72
        i 5.643 136.728 0.100 1 1103 80
        i 4.565 136.751 0.490 3 38 127 0
        i 4.566 137.251 0.490 3 38 127 1
        i 4.567 138.251 0.490 3 38 127 2
        i 4.568 139.751 0.490 3 38 127 3
        i 4.569 141.751 0.490 3 38 127 4
        i 5.644 136.759 0.100 1 1094 69
        i 5.645 136.819 0.100 1 1102 77
        i 5.646 136.873 0.100 1 1095 76
        i 5.647 136.920 0.100 1 1106 77
        i 5.648 136.992 0.100 1 1106 72
        i 5.649 137.056 0.100 1 1110 78
        i 5.650 137.105 0.100 1 1106 62
        i 5.651 137.153 0.100 1 1102 69
        i 5.652 137.200 0.100 1 1098 63
        i 5.653 137.233 0.100 1 1098 53
        i 5.654 137.244 0.100 1 1090 67
        i 5.655 137.269 0.100 1 1104 77
        i 5.656 137.365 0.100 1 1096 53
        i 5.657 137.441 0.100 1 1096 61
        i 5.658 137.508 0.100 1 1100 63
        i 5.659 137.523 0.100 1 1104 72
        i 5.660 137.636 0.100 1 1108 78
        i 5.661 137.636 0.100 1 1108 50
        i 5.662 137.755 0.100 1 1100 62
        i 5.663 137.777 0.100 1 1104 75
        i 5.664 137.800 0.100 1 1101 69
        i 5.665 137.859 0.100 1 1106 64
        i 5.666 137.887 0.100 1 1104 70
        i 5.667 137.932 0.100 1 1112 42
        i 5.668 137.947 0.100 1 1098 54
        i 5.669 137.949 0.100 1 1098 57
        i 5.670 137.993 0.100 1 1090 69
        i 4.571 138.001 0.490 3 55 49 0
        i 4.572 138.501 0.490 3 55 49 1
        i 4.573 139.501 0.490 3 55 49 2
        i 4.574 141.001 0.490 3 55 49 3
        i 4.575 143.001 0.490 3 55 49 4
        i 5.671 138.111 0.100 1 1100 60
        i 5.672 138.197 0.100 1 1096 61
        i 5.673 138.281 0.100 1 1102 73
        i 5.674 138.335 0.100 1 1106 50
        i 5.675 138.461 0.100 1 1103 54
        i 5.676 138.472 0.100 1 1102 56
        i 5.677 138.557 0.100 1 1106 42
        i 5.678 138.581 0.100 1 1108 62
        i 5.679 138.619 0.100 1 1096 77
        i 5.680 138.623 0.100 1 1106 61
        i 5.681 138.700 0.100 1 1091 55
        i 4.577 138.751 0.490 3 53 49 0
        i 4.578 139.251 0.490 3 53 49 1
        i 4.579 140.251 0.490 3 53 49 2
        i 4.580 141.751 0.490 3 53 49 3
        i 4.581 143.751 0.490 3 53 49 4
        i 5.682 138.765 0.100 1 1106 66
        i 5.683 138.815 0.100 1 1098 71
        i 5.684 138.836 0.100 1 1098 71
        i 5.685 138.836 0.100 1 1114 49
        i 5.686 138.920 0.100 1 1100 69
        i 5.687 138.924 0.100 1 1102 69
        i 5.688 139.072 0.100 1 1104 55
        i 5.689 139.157 0.100 1 1100 53
        i 5.690 139.175 0.100 1 1102 77
        i 5.691 139.211 0.100 1 1093 78
        i 5.692 139.259 0.100 1 1093 58
        i 5.693 139.315 0.100 1 1108 64
        i 5.694 139.355 0.100 1 1104 49
        i 5.695 139.464 0.100 1 1103 61
        i 5.696 139.552 0.100 1 1110 59
        i 5.697 139.587 0.100 1 1104 49
        i 5.698 139.668 0.100 1 1104 67
        i 5.699 139.676 0.100 1 1110 53
        i 5.700 139.688 0.100 1 1100 51
        i 5.701 139.743 0.100 1 1100 70
        i 5.702 139.769 0.100 1 1096 67
        i 5.703 139.848 0.100 1 1102 64
        i 5.704 139.876 0.100 1 1095 55
        i 5.705 139.891 0.100 1 1100 52
        i 5.706 139.973 0.100 1 1110 63
        i 4.583 140.001 0.490 3 36 127 0
        i 4.584 140.501 0.490 3 36 127 1
        i 4.585 141.501 0.490 3 36 127 2
        i 4.586 143.001 0.490 3 36 127 3
        i 4.587 145.001 0.490 3 36 127 4
        i 5.707 140.023 0.100 1 1114 42
        i 5.708 140.059 0.100 1 1102 71
        i 5.709 140.085 0.100 1 1098 66
        i 5.710 140.200 0.100 1 1097 65
        i 5.711 140.293 0.100 1 1096 65
        i 5.712 140.299 0.100 1 1102 72
        i 5.713 140.321 0.100 1 1108 64
        i 5.714 140.444 0.100 1 1103 77
        i 5.715 140.455 0.100 1 1097 59
        i 5.716 140.457 0.100 1 1107 65
        i 5.717 140.479 0.100 1 1112 52
        i 5.718 140.483 0.100 1 1104 79
        i 5.719 140.491 0.100 1 1106 61
        i 5.720 140.524 0.100 1 1098 68
        i 5.721 140.577 0.100 1 1102 60
        i 5.722 140.637 0.100 1 1112 70
        i 5.723 140.648 0.100 1 1101 55
        i 5.724 140.687 0.100 1 1093 60
        i 4.589 140.751 0.490 3 36 127 0
        i 4.590 141.251 0.490 3 36 127 1
        i 4.591 142.251 0.490 3 36 127 2
        i 4.592 143.751 0.490 3 36 127 3
        i 4.593 145.751 0.490 3 36 127 4
        i 5.725 140.763 0.100 1 1095 67
        i 5.726 140.908 0.100 1 1099 68
        i 5.727 141.036 0.100 1 1105 78
        i 5.728 141.069 0.100 1 1107 70
        i 5.729 141.088 0.100 1 1103 57
        i 5.730 141.133 0.100 1 1107 79
        i 5.731 141.139 0.100 1 1104 79
        i 5.732 141.159 0.100 1 1096 78
        i 5.733 141.248 0.100 1 1095 64
        i 5.734 141.296 0.100 1 1105 72
        i 5.735 141.435 0.100 1 1109 66
        i 5.736 141.447 0.100 1 1095 82
        i 5.737 141.459 0.100 1 1107 46
        i 5.738 141.535 0.100 1 1109 79
        i 5.739 141.585 0.100 1 1095 73
        i 5.740 141.672 0.100 1 1105 62
        i 5.741 141.697 0.100 1 1101 67
        i 5.742 141.700 0.100 1 1099 53
        i 5.743 141.704 0.100 1 1089 76
        i 5.744 141.811 0.100 1 1105 67
        i 5.745 141.832 0.100 1 1098 79
        i 5.746 141.876 0.100 1 1097 83
        i 5.747 141.912 0.100 1 1107 53
        i 5.748 141.927 0.100 1 1097 60
        i 4.595 142.001 0.490 3 52 49 0
        i 4.596 142.501 0.490 3 52 49 1
        i 4.597 143.501 0.490 3 52 49 2
        i 4.598 145.001 0.490 3 52 49 3
        i 4.599 147.001 0.490 3 52 49 4
        i 5.749 142.145 0.100 1 1107 56
        i 5.750 142.153 0.100 1 1103 65
        i 5.751 142.203 0.100 1 1109 45
        i 5.752 142.267 0.100 1 1101 60
        i 5.753 142.332 0.100 1 1103 81
        i 5.754 142.352 0.100 1 1102 73
        i 5.755 142.409 0.100 1 1091 75
        i 5.756 142.424 0.100 1 1097 83
        i 5.757 142.453 0.100 1 1101 56
        i 5.758 142.468 0.100 1 1107 63
        i 5.759 142.587 0.100 1 1101 79
        i 5.760 142.609 0.100 1 1097 78
        i 5.761 142.647 0.100 1 1105 53
        i 5.762 142.663 0.100 1 1099 61
        i 5.763 142.691 0.100 1 1103 55
        i 4.601 142.751 0.490 3 52 49 0
        i 4.602 143.251 0.490 3 52 49 1
        i 4.603 144.251 0.490 3 52 49 2
        i 4.604 145.751 0.490 3 52 49 3
        i 4.605 147.751 0.490 3 52 49 4
        i 5.764 142.896 0.100 1 1105 63
        i 5.765 143.009 0.100 1 1113 70
        i 5.766 143.035 0.100 1 1102 79
        i 5.767 143.060 0.100 1 1109 61
        i 5.768 143.088 0.100 1 1107 48
        i 5.769 143.139 0.100 1 1099 67
        i 5.770 143.148 0.100 1 1095 59
        i 5.771 143.200 0.100 1 1091 80
        i 5.772 143.297 0.100 1 1097 68
        i 5.773 143.323 0.100 1 1099 79
        i 5.774 143.365 0.100 1 1105 63
        i 5.775 143.485 0.100 1 1101 58
        i 5.776 143.527 0.100 1 1115 52
        i 5.777 143.559 0.100 1 1099 74
        i 5.778 143.579 0.100 1 1101 67
        i 5.779 143.596 0.100 1 1103 50
        i 5.780 143.677 0.100 1 1111 55
        i 5.781 143.769 0.100 1 1103 63
        i 5.782 143.771 0.100 1 1093 77
        i 5.783 143.805 0.100 1 1094 58
        i 5.784 143.815 0.100 1 1109 55
        i 4.607 144.001 0.490 3 36 127 0
        i 4.608 144.501 0.490 3 36 127 1
        i 4.609 145.501 0.490 3 36 127 2
        i 4.610 147.001 0.490 3 36 127 3
        i 4.611 149.001 0.490 3 36 127 4
        i 4.613 144.001 0.490 3 48 56 0
        i 4.614 144.501 0.490 3 48 56 1
        i 4.615 145.501 0.490 3 48 56 2
        i 4.616 147.001 0.490 3 48 56 3
        i 4.617 149.001 0.490 3 48 56 4
        i 5.785 144.048 0.100 1 1103 75
        i 5.786 144.080 0.100 1 1103 53
        i 5.787 144.092 0.100 1 1101 71
        i 5.788 144.197 0.100 1 1105 43
        i 5.789 144.220 0.100 1 1101 74
        i 5.790 144.276 0.100 1 1095 64
        i 5.791 144.313 0.100 1 1099 60
        i 5.792 144.329 0.100 1 1109 74
        i 5.793 144.332 0.100 1 1099 77
        i 5.794 144.333 0.100 1 1113 43
        i 5.795 144.365 0.100 1 1099 50
        i 5.796 144.449 0.100 1 1096 57
        i 5.797 144.535 0.100 1 1111 63
        i 5.798 144.537 0.100 1 1101 64
        i 5.799 144.700 0.100 1 1096 52
        i 4.619 144.751 0.490 3 38 127 0
        i 4.620 145.251 0.490 3 38 127 1
        i 4.621 146.251 0.490 3 38 127 2
        i 4.622 147.751 0.490 3 38 127 3
        i 4.623 149.751 0.490 3 38 127 4
        i 4.625 144.751 0.490 3 50 56 0
        i 4.626 145.251 0.490 3 50 56 1
        i 4.627 146.251 0.490 3 50 56 2
        i 4.628 147.751 0.490 3 50 56 3
        i 4.629 149.751 0.490 3 50 56 4
        i 5.800 144.845 0.100 1 1097 75
        i 5.801 144.875 0.100 1 1107 40
        i 5.802 144.899 0.100 1 1103 70
        i 5.803 144.928 0.100 1 1105 57
        i 5.804 144.973 0.100 1 1103 68
        i 5.805 144.995 0.100 1 1097 68
        i 5.806 145.007 0.100 1 1096 84
        i 5.807 145.025 0.100 1 1101 50
        i 5.808 145.060 0.100 1 1103 77
        i 5.809 145.168 0.100 1 1109 80
        i 5.810 145.263 0.100 1 1107 59
        i 5.811 145.273 0.100 1 1094 65
        i 5.812 145.333 0.100 1 1111 52
        i 5.813 145.360 0.100 1 1111 55
        i 5.814 145.373 0.100 1 1103 60
        i 5.815 145.399 0.100 1 1109 65
        i 5.816 145.433 0.100 1 1107 76
        i 5.817 145.505 0.100 1 1099 77
        i 5.818 145.551 0.100 1 1105 59
        i 5.819 145.695 0.100 1 1107 50
        i 5.820 145.723 0.100 1 1096 65
        i 5.821 145.751 0.100 1 1095 74
        i 5.822 145.900 0.100 1 1107 66
        i 5.823 145.928 0.100 1 1104 50
        i 5.824 145.977 0.100 1 1094 63
        i 5.825 145.987 0.100 1 1093 71
        i 4.631 146.001 0.490 3 52 43 0
        i 4.632 146.501 0.490 3 52 43 1
        i 4.633 147.501 0.490 3 52 43 2
        i 4.634 149.001 0.490 3 52 43 3
        i 4.635 151.001 0.490 3 52 43 4
        i 4.637 146.001 0.490 3 40 43 0
        i 4.638 146.501 0.490 3 40 43 1
        i 4.639 147.501 0.490 3 40 43 2
        i 4.640 149.001 0.490 3 40 43 3
        i 4.641 151.001 0.490 3 40 43 4
        i 5.826 146.064 0.100 1 1109 73
        i 5.827 146.072 0.100 1 1103 73
        i 5.828 146.128 0.100 1 1106 52
        i 5.829 146.199 0.100 1 1100 70
        i 5.830 146.256 0.100 1 1090 70
        i 5.831 146.269 0.100 1 1106 49
        i 5.832 146.289 0.100 1 1101 64
        i 5.833 146.296 0.100 1 1098 81
        i 5.834 146.360 0.100 1 1105 53
        i 5.835 146.381 0.100 1 1097 80
        i 5.836 146.431 0.100 1 1097 52
        i 5.837 146.671 0.100 1 1105 78
        i 4.643 146.751 0.490 3 41 42 0
        i 4.644 147.251 0.490 3 41 42 1
        i 4.645 148.251 0.490 3 41 42 2
        i 4.646 149.751 0.490 3 41 42 3
        i 4.647 151.751 0.490 3 41 42 4
        i 4.649 146.751 0.490 3 53 43 0
        i 4.650 147.251 0.490 3 53 43 1
        i 4.651 148.251 0.490 3 53 43 2
        i 4.652 149.751 0.490 3 53 43 3
        i 4.653 151.751 0.490 3 53 43 4
        i 5.838 146.771 0.100 1 1110 71
        i 5.839 146.776 0.100 1 1102 71
        i 5.840 146.779 0.100 1 1107 73
        i 5.841 146.797 0.100 1 1096 66
        i 5.842 146.819 0.100 1 1102 50
        i 5.843 146.861 0.100 1 1102 62
        i 5.844 146.899 0.100 1 1096 83
        i 5.845 146.899 0.100 1 1102 59
        i 5.846 146.965 0.100 1 1108 72
        i 5.847 146.987 0.100 1 1114 63
        i 5.848 147.020 0.100 1 1097 58
        i 5.849 147.076 0.100 1 1104 54
        i 5.850 147.185 0.100 1 1104 72
        i 5.851 147.272 0.100 1 1100 73
        i 5.852 147.465 0.100 1 1104 59
        i 5.853 147.500 0.100 1 1108 57
        i 5.854 147.541 0.100 1 1110 76
        i 5.855 147.567 0.100 1 1101 52
        i 5.856 147.584 0.100 1 1100 81
        i 5.857 147.677 0.100 1 1094 74
        i 5.858 147.697 0.100 1 1092 80
        i 5.859 147.743 0.100 1 1100 77
        i 5.860 147.753 0.100 1 1100 72
        i 5.861 147.813 0.100 1 1102 54
        i 5.862 147.924 0.100 1 1114 45
        i 5.863 147.927 0.100 1 1100 71
        i 5.864 147.940 0.100 1 1100 55
        i 5.865 147.963 0.100 1 1105 64
        i 4.655 148.001 0.490 3 41 127 0
        i 4.656 148.501 0.490 3 41 127 1
        i 4.657 149.501 0.490 3 41 127 2
        i 4.658 151.001 0.490 3 41 127 3
        i 4.659 153.001 0.490 3 41 127 4
        i 4.661 148.001 0.490 3 53 56 0
        i 4.662 148.501 0.490 3 53 56 1
        i 4.663 149.501 0.490 3 53 56 2
        i 4.664 151.001 0.490 3 53 56 3
        i 4.665 153.001 0.490 3 53 56 4
        i 5.866 148.029 0.100 1 1110 59
        i 5.867 148.207 0.100 1 1102 54
        i 5.868 148.279 0.100 1 1094 82
        i 5.869 148.279 0.100 1 1112 61
        i 5.870 148.359 0.100 1 1095 71
        i 5.871 148.416 0.100 1 1102 61
        i 5.872 148.489 0.100 1 1102 51
        i 5.873 148.535 0.100 1 1098 81
        i 5.874 148.555 0.100 1 1112 53
        i 5.875 148.632 0.100 1 1104 65
        i 5.876 148.667 0.100 1 1098 76
        i 5.877 148.668 0.100 1 1100 50
        i 5.878 148.697 0.100 1 1098 77
        i 4.667 148.751 0.490 3 40 127 0
        i 4.668 149.251 0.490 3 40 127 1
        i 4.669 150.251 0.490 3 40 127 2
        i 4.670 151.751 0.490 3 40 127 3
        i 4.671 153.751 0.490 3 40 127 4
        i 4.673 148.751 0.490 3 52 56 0
        i 4.674 149.251 0.490 3 52 56 1
        i 4.675 150.251 0.490 3 52 56 2
        i 4.676 151.751 0.490 3 52 56 3
        i 4.677 153.751 0.490 3 52 56 4
        i 5.879 148.767 0.100 1 1100 64
        i 5.880 148.835 0.100 1 1106 60
        i 5.881 148.981 0.100 1 1097 81
        i 5.882 149.031 0.100 1 1112 46
        i 5.883 149.067 0.100 1 1102 68
        i 5.884 149.196 0.100 1 1096 62
        i 5.885 149.384 0.100 1 1106 75
        i 5.886 149.395 0.100 1 1096 53
        i 5.887 149.409 0.100 1 1110 50
        i 5.888 149.485 0.100 1 1104 65
        i 5.889 149.503 0.100 1 1102 58
        i 5.890 149.517 0.100 1 1095 64
        i 5.891 149.520 0.100 1 1102 74
        i 5.892 149.579 0.100 1 1108 63
        i 5.893 149.612 0.100 1 1108 62
        i 5.894 149.624 0.100 1 1108 51
        i 5.895 149.628 0.100 1 1112 35
        i 5.896 149.644 0.100 1 1110 71
        i 5.897 149.713 0.100 1 1102 51
        i 5.898 149.781 0.100 1 1093 58
        i 5.899 149.879 0.100 1 1104 60
        i 4.679 150.001 0.490 3 57 43 0
        i 4.680 150.501 0.490 3 57 43 1
        i 4.681 151.501 0.490 3 57 43 2
        i 4.682 153.001 0.490 3 57 43 3
        i 4.683 155.001 0.490 3 57 43 4
        i 4.685 150.001 0.490 3 45 43 0
        i 4.686 150.501 0.490 3 45 43 1
        i 4.687 151.501 0.490 3 45 43 2
        i 4.688 153.001 0.490 3 45 43 3
        i 4.689 155.001 0.490 3 45 43 4
        i 5.900 150.023 0.100 1 1106 72
        i 5.901 150.044 0.100 1 1106 60
        i 5.902 150.197 0.100 1 1096 82
        i 5.903 150.259 0.100 1 1106 67
        i 5.904 150.271 0.100 1 1094 53
        i 5.905 150.272 0.100 1 1104 66
        i 5.906 150.319 0.100 1 1106 61
        i 5.907 150.368 0.100 1 1114 51
        i 5.908 150.377 0.100 1 1104 78
        i 5.909 150.467 0.100 1 1093 79
        i 5.910 150.476 0.100 1 1108 56
        i 5.911 150.544 0.100 1 1108 78
        i 5.912 150.559 0.100 1 1104 72
        i 5.913 150.597 0.100 1 1108 56
        i 5.914 150.695 0.100 1 1101 66
        i 5.915 150.716 0.100 1 1099 81
        i 4.691 150.751 0.490 3 55 43 0
        i 4.692 151.251 0.490 3 55 43 1
        i 4.693 152.251 0.490 3 55 43 2
        i 4.694 153.751 0.490 3 55 43 3
        i 4.695 155.751 0.490 3 55 43 4
        i 4.697 150.751 0.490 3 43 43 0
        i 4.698 151.251 0.490 3 43 43 1
        i 4.699 152.251 0.490 3 43 43 2
        i 4.700 153.751 0.490 3 43 43 3
        i 4.701 155.751 0.490 3 43 43 4
        i 5.916 150.943 0.100 1 1098 78
        i 5.917 150.956 0.100 1 1096 54
        i 5.918 151.001 0.100 1 1104 65
        i 5.919 151.027 0.100 1 1106 47
        i 5.920 151.107 0.100 1 1106 61
        i 5.921 151.115 0.100 1 1110 63
        i 5.922 151.133 0.100 1 1102 51
        i 5.923 151.184 0.100 1 1106 76
        i 5.924 151.195 0.100 1 1102 71
        i 5.925 151.259 0.100 1 1094 80
        i 5.926 151.284 0.100 1 1101 58
        i 5.927 151.297 0.100 1 1106 75
        i 5.928 151.329 0.100 1 1103 62
        i 5.929 151.351 0.100 1 1105 36
        i 5.930 151.373 0.100 1 1095 78
        i 5.931 151.555 0.100 1 1098 64
        i 5.932 151.585 0.100 1 1102 81
        i 5.933 151.657 0.100 1 1108 68
        i 5.934 151.700 0.100 1 1104 51
        i 5.935 151.731 0.100 1 1114 50
        i 5.936 151.768 0.100 1 1109 53
        i 5.937 151.900 0.100 1 1100 70
        i 5.938 151.981 0.100 1 1096 64
        i 4.703 152.001 0.490 3 36 127 0
        i 4.704 152.501 0.490 3 36 127 1
        i 4.705 153.501 0.490 3 36 127 2
        i 4.706 155.001 0.490 3 36 127 3
        i 4.707 157.001 0.490 3 36 127 4
        i 4.709 152.001 0.490 3 48 56 0
        i 4.710 152.501 0.490 3 48 56 1
        i 4.711 153.501 0.490 3 48 56 2
        i 4.712 155.001 0.490 3 48 56 3
        i 4.713 157.001 0.490 3 48 56 4
        i 5.939 152.035 0.100 1 1104 59
        i 5.940 152.056 0.100 1 1101 78
        i 5.941 152.069 0.100 1 1110 74
        i 5.942 152.104 0.100 1 1104 51
        i 5.943 152.128 0.100 1 1107 41
        i 5.944 152.149 0.100 1 1100 59
        i 5.945 152.193 0.100 1 1093 80
        i 5.946 152.207 0.100 1 1093 64
        i 5.947 152.256 0.100 1 1099 52
        i 5.948 152.375 0.100 1 1113 39
        i 5.949 152.409 0.100 1 1099 71
        i 5.950 152.415 0.100 1 1100 69
        i 5.951 152.425 0.100 1 1104 64
        i 5.952 152.551 0.100 1 1109 68
        i 5.953 152.663 0.100 1 1111 47
        i 5.954 152.681 0.100 1 1103 41
        i 4.715 152.751 0.490 3 38 127 0
        i 4.716 153.251 0.490 3 38 127 1
        i 4.717 154.251 0.490 3 38 127 2
        i 4.718 155.751 0.490 3 38 127 3
        i 4.719 157.751 0.490 3 38 127 4
        i 4.721 152.751 0.490 3 50 56 0
        i 4.722 153.251 0.490 3 50 56 1
        i 4.723 154.251 0.490 3 50 56 2
        i 4.724 155.751 0.490 3 50 56 3
        i 4.725 157.751 0.490 3 50 56 4
        i 5.955 152.787 0.100 1 1095 81
        i 5.956 152.797 0.100 1 1101 74
        i 5.957 152.860 0.100 1 1103 63
        i 5.958 152.869 0.100 1 1095 58
        i 5.959 152.885 0.100 1 1107 48
        i 5.960 152.939 0.100 1 1100 61
        i 5.961 152.956 0.100 1 1101 69
        i 5.962 152.979 0.100 1 1113 56
        i 5.963 152.987 0.100 1 1097 56
        i 5.964 153.081 0.100 1 1097 60
        i 5.965 153.087 0.100 1 1102 72
        i 5.966 153.199 0.100 1 1103 66
        i 5.967 153.371 0.100 1 1109 46
        i 5.968 153.377 0.100 1 1111 75
        i 5.969 153.471 0.100 1 1098 81
        i 5.970 153.472 0.100 1 1111 61
        i 5.971 153.543 0.100 1 1101 50
        i 5.972 153.545 0.100 1 1103 63
        i 5.973 153.613 0.100 1 1107 71
        i 5.974 153.632 0.100 1 1097 58
        i 5.975 153.692 0.100 1 1095 67
        i 5.976 153.717 0.100 1 1095 76
        i 5.977 153.723 0.100 1 1109 56
        i 5.978 153.787 0.100 1 1107 62
        i 5.979 153.859 0.100 1 1107 57
        i 5.980 153.895 0.100 1 1105 68
        i 5.981 153.912 0.100 1 1109 63
        i 5.982 153.985 0.100 1 1094 82
        i 4.727 154.001 0.490 3 52 43 0
        i 4.728 154.501 0.490 3 52 43 1
        i 4.729 155.501 0.490 3 52 43 2
        i 4.730 157.001 0.490 3 52 43 3
        i 4.731 159.001 0.490 3 52 43 4
        i 4.733 154.001 0.490 3 40 43 0
        i 4.734 154.501 0.490 3 40 43 1
        i 4.735 155.501 0.490 3 40 43 2
        i 4.736 157.001 0.490 3 40 43 3
        i 4.737 159.001 0.490 3 40 43 4
        i 5.983 154.015 0.100 1 1101 64
        i 5.984 154.088 0.100 1 1105 49
        i 5.985 154.247 0.100 1 1109 54
        i 5.986 154.256 0.100 1 1105 58
        i 5.987 154.289 0.100 1 1093 66
        i 5.988 154.321 0.100 1 1113 45
        i 5.989 154.343 0.100 1 1103 63
        i 5.990 154.407 0.100 1 1107 59
        i 5.991 154.560 0.100 1 1103 59
        i 5.992 154.560 0.100 1 1105 61
        i 5.993 154.619 0.100 1 1107 78
        i 5.994 154.655 0.100 1 1097 64
        i 5.995 154.673 0.100 1 1105 69
        i 5.996 154.703 0.100 1 1105 77
        i 5.997 154.715 0.100 1 1095 82
        i 4.739 154.751 0.490 3 53 43 0
        i 4.740 155.251 0.490 3 53 43 1
        i 4.741 156.251 0.490 3 53 43 2
        i 4.742 157.751 0.490 3 53 43 3
        i 4.743 159.751 0.490 3 53 43 4
        i 4.745 154.751 0.490 3 41 43 0
        i 4.746 155.251 0.490 3 41 43 1
        i 4.747 156.251 0.490 3 41 43 2
        i 4.748 157.751 0.490 3 41 43 3
        i 4.749 159.751 0.490 3 41 43 4
        i 5.998 154.817 0.100 1 1107 74
        i 5.999 154.908 0.100 1 1109 69
        i 5.001 154.913 0.100 1 1092 64
        i 5.002 154.935 0.100 1 1103 76
        i 5.003 155.071 0.100 1 1107 52
        i 5.004 155.129 0.100 1 1115 52
        i 5.005 155.192 0.100 1 1099 76
        i 5.006 155.192 0.100 1 1101 56
        i 5.007 155.224 0.100 1 1105 68
        i 5.008 155.321 0.100 1 1107 61
        i 5.009 155.364 0.100 1 1097 75
        i 5.010 155.377 0.100 1 1105 52
        i 5.011 155.419 0.100 1 1099 56
        i 5.012 155.553 0.100 1 1101 78
        i 5.013 155.555 0.100 1 1109 57
        i 5.014 155.565 0.100 1 1103 66
        i 5.015 155.668 0.100 1 1103 63
        i 5.016 155.696 0.100 1 1105 44
        i 5.017 155.753 0.100 1 1102 70
        i 5.018 155.793 0.100 1 1100 53
        i 5.019 155.812 0.100 1 1111 57
        i 5.020 155.904 0.100 1 1095 61
        i 4.751 156.001 0.490 3 41 127 0
        i 4.752 156.501 0.490 3 41 127 1
        i 4.753 157.501 0.490 3 41 127 2
        i 4.754 159.001 0.490 3 41 127 3
        i 4.755 161.001 0.490 3 41 127 4
        i 4.757 156.001 0.490 3 53 56 0
        i 4.758 156.501 0.490 3 53 56 1
        i 4.759 157.501 0.490 3 53 56 2
        i 4.760 159.001 0.490 3 53 56 3
        i 4.761 161.001 0.490 3 53 56 4
        i 5.021 156.064 0.100 1 1105 74
        i 5.022 156.091 0.100 1 1099 64
        i 5.023 156.123 0.100 1 1095 57
        i 5.024 156.151 0.100 1 1099 69
        i 5.025 156.196 0.100 1 1103 56
        i 5.026 156.221 0.100 1 1101 69
        i 5.027 156.255 0.100 1 1115 65
        i 5.028 156.271 0.100 1 1101 66
        i 5.029 156.324 0.100 1 1105 61
        i 5.030 156.345 0.100 1 1103 66
        i 5.031 156.373 0.100 1 1107 51
        i 5.032 156.381 0.100 1 1109 51
        i 5.033 156.501 0.100 1 1100 70
        i 5.034 156.596 0.100 1 1111 56
        i 5.035 156.692 0.100 1 1094 79
        i 4.763 156.751 0.490 3 43 127 0
        i 4.764 157.251 0.490 3 43 127 1
        i 4.765 158.251 0.490 3 43 127 2
        i 4.766 159.751 0.490 3 43 127 3
        i 4.767 161.751 0.490 3 43 127 4
        i 4.769 156.751 0.490 3 55 56 0
        i 4.770 157.251 0.490 3 55 56 1
        i 4.771 158.251 0.490 3 55 56 2
        i 4.772 159.751 0.490 3 55 56 3
        i 4.773 161.751 0.490 3 55 56 4
        i 5.036 156.757 0.100 1 1097 52
        i 5.037 156.792 0.100 1 1092 68
        i 5.038 156.829 0.100 1 1101 78
        i 5.039 156.833 0.100 1 1103 67
        i 5.040 156.863 0.100 1 1099 51
        i 5.041 156.924 0.100 1 1102 62
        i 5.042 157.032 0.100 1 1113 51
        i 5.043 157.100 0.100 1 1099 71
        i 5.044 157.152 0.100 1 1113 57
        i 5.045 157.184 0.100 1 1101 60
        i 5.046 157.293 0.100 1 1110 60
        i 5.047 157.297 0.100 1 1096 53
        i 5.048 157.313 0.100 1 1103 72
        i 5.049 157.336 0.100 1 1096 61
        i 5.050 157.345 0.100 1 1108 78
        i 5.051 157.419 0.100 1 1103 74
        i 5.052 157.447 0.100 1 1097 51
        i 5.053 157.556 0.100 1 1106 63
        i 5.054 157.627 0.100 1 1099 69
        i 5.055 157.683 0.100 1 1101 68
        i 5.056 157.705 0.100 1 1097 70
        i 5.057 157.729 0.100 1 1102 82
        i 5.058 157.911 0.100 1 1110 69
        i 5.059 157.916 0.100 1 1098 82
        i 5.060 157.963 0.100 1 1108 51
        i 4.775 158.001 0.490 3 57 43 0
        i 4.776 158.501 0.490 3 57 43 1
        i 4.777 159.501 0.490 3 57 43 2
        i 4.778 161.001 0.490 3 57 43 3
        i 4.779 163.001 0.490 3 57 43 4
        i 4.781 158.001 0.490 3 45 43 0
        i 4.782 158.501 0.490 3 45 43 1
        i 4.783 159.501 0.490 3 45 43 2
        i 4.784 161.001 0.490 3 45 43 3
        i 4.785 163.001 0.490 3 45 43 4
        i 5.061 158.072 0.100 1 1103 60
        i 5.062 158.084 0.100 1 1111 77
        i 5.063 158.101 0.100 1 1102 61
        i 5.064 158.133 0.100 1 1108 37
        i 5.065 158.155 0.100 1 1094 69
        i 5.066 158.192 0.100 1 1094 79
        i 5.067 158.221 0.100 1 1106 77
        i 5.068 158.232 0.100 1 1097 70
        i 5.069 158.304 0.100 1 1105 61
        i 5.070 158.421 0.100 1 1106 62
        i 5.071 158.424 0.100 1 1093 62
        i 5.072 158.485 0.100 1 1104 72
        i 5.073 158.491 0.100 1 1100 73
        i 5.074 158.547 0.100 1 1110 48
        i 5.075 158.648 0.100 1 1104 60
        i 5.076 158.731 0.100 1 1114 52
        i 5.077 158.751 0.100 1 1108 62
        i 4.787 158.751 0.490 3 59 43 0
        i 4.788 159.251 0.490 3 59 43 1
        i 4.789 160.251 0.490 3 59 43 2
        i 4.790 161.751 0.490 3 59 43 3
        i 4.791 163.751 0.490 3 59 43 4
        i 4.793 158.751 0.490 3 47 43 0
        i 4.794 159.251 0.490 3 47 43 1
        i 4.795 160.251 0.490 3 47 43 2
        i 4.796 161.751 0.490 3 47 43 3
        i 4.797 163.751 0.490 3 47 43 4
        i 5.078 158.801 0.100 1 1092 81
        i 5.079 158.871 0.100 1 1108 56
        i 5.080 158.968 0.100 1 1106 58
        i 5.081 159.037 0.100 1 1096 73
        i 5.082 159.072 0.100 1 1103 55
        i 5.083 159.076 0.100 1 1098 61
        i 5.084 159.087 0.100 1 1104 73
        i 5.085 159.212 0.100 1 1108 64
        i 5.086 159.216 0.100 1 1107 72
        i 5.087 159.284 0.100 1 1106 69
        i 5.088 159.312 0.100 1 1102 68
        i 5.089 159.329 0.100 1 1091 56
        i 5.090 159.377 0.100 1 1116 43
        i 5.091 159.389 0.100 1 1104 77
        i 5.092 159.477 0.100 1 1110 67
        i 5.093 159.544 0.100 1 1106 49
        i 5.094 159.597 0.100 1 1106 53
        i 5.095 159.648 0.100 1 1104 57
        i 5.096 159.668 0.100 1 1100 68
        i 5.097 159.692 0.100 1 1102 63
        i 5.098 159.775 0.100 1 1098 77
        i 5.099 159.832 0.100 1 1104 72
        i 5.100 159.895 0.100 1 1104 42
        i 5.101 159.980 0.100 1 1100 52
        i 4.799 160.001 0.490 3 36 127 0
        i 4.800 160.501 0.490 3 36 127 1
        i 4.801 161.501 0.490 3 36 127 2
        i 4.802 163.001 0.490 3 36 127 3
        i 4.803 165.001 0.490 3 36 127 4
        i 4.805 160.001 0.490 3 48 56 0
        i 4.806 160.501 0.490 3 48 56 1
        i 4.807 161.501 0.490 3 48 56 2
        i 4.808 163.001 0.490 3 48 56 3
        i 4.809 165.001 0.490 3 48 56 4
        i 5.102 160.009 0.100 1 1102 64
        i 5.103 160.104 0.100 1 1108 78
        i 5.104 160.148 0.100 1 1101 57
        i 5.105 160.185 0.100 1 1100 61
        i 5.106 160.188 0.100 1 1110 59
        i 5.107 160.188 0.100 1 1112 60
        i 5.108 160.252 0.100 1 1104 76
        i 5.109 160.265 0.100 1 1106 44
        i 5.110 160.305 0.100 1 1100 60
        i 5.111 160.435 0.100 1 1094 62
        i 5.112 160.439 0.100 1 1114 50
        i 5.113 160.459 0.100 1 1096 71
        i 5.114 160.628 0.100 1 1102 57
        i 5.115 160.659 0.100 1 1102 62
        i 5.116 160.708 0.100 1 1106 72
        i 4.811 160.751 0.490 3 38 127 0
        i 4.812 161.251 0.490 3 38 127 1
        i 4.813 162.251 0.490 3 38 127 2
        i 4.814 163.751 0.490 3 38 127 3
        i 4.815 165.751 0.490 3 38 127 4
        i 5.117 160.749 0.100 1 1100 79
        i 4.817 160.751 0.490 3 50 56 0
        i 4.818 161.251 0.490 3 50 56 1
        i 4.819 162.251 0.490 3 50 56 2
        i 4.820 163.751 0.490 3 50 56 3
        i 4.821 165.751 0.490 3 50 56 4
        i 5.118 160.835 0.100 1 1100 66
        i 5.119 160.917 0.100 1 1099 78
        i 5.120 161.005 0.100 1 1098 80
        i 5.121 161.011 0.100 1 1100 65
        i 5.122 161.043 0.100 1 1102 53
        i 5.123 161.075 0.100 1 1112 60
        i 5.124 161.105 0.100 1 1110 68
        i 5.125 161.136 0.100 1 1108 39
        i 5.126 161.243 0.100 1 1112 68
        i 5.127 161.255 0.100 1 1102 78
        i 5.128 161.327 0.100 1 1100 66
        i 5.129 161.377 0.100 1 1092 65
        i 5.130 161.424 0.100 1 1098 50
        i 5.131 161.515 0.100 1 1102 60
        i 5.132 161.573 0.100 1 1112 27
        i 5.133 161.624 0.100 1 1104 69
        i 5.134 161.705 0.100 1 1098 55
        i 5.135 161.764 0.100 1 1110 33
        i 5.136 161.773 0.100 1 1097 61
        i 5.137 161.787 0.100 1 1098 51
        i 5.138 161.816 0.100 1 1108 56
        i 5.139 161.873 0.100 1 1112 51
        i 5.140 161.891 0.100 1 1102 62
        i 5.141 161.893 0.100 1 1108 54
        i 4.823 162.001 0.490 3 52 43 0
        i 4.824 162.501 0.490 3 52 43 1
        i 4.825 163.501 0.490 3 52 43 2
        i 4.826 165.001 0.490 3 52 43 3
        i 4.827 167.001 0.490 3 52 43 4
        i 4.829 162.001 0.490 3 40 43 0
        i 4.830 162.501 0.490 3 40 43 1
        i 4.831 163.501 0.490 3 40 43 2
        i 4.832 165.001 0.490 3 40 43 3
        i 4.833 167.001 0.490 3 40 43 4
        i 5.142 162.048 0.100 1 1104 61
        i 5.143 162.108 0.100 1 1110 79
        i 5.144 162.161 0.100 1 1096 60
        i 5.145 162.192 0.100 1 1115 52
        i 5.146 162.219 0.100 1 1100 60
        i 5.147 162.260 0.100 1 1101 60
        i 5.148 162.304 0.100 1 1096 51
        i 5.149 162.317 0.100 1 1102 63
        i 5.150 162.323 0.100 1 1098 75
        i 5.151 162.332 0.100 1 1099 80
        i 5.152 162.379 0.100 1 1107 33
        i 5.153 162.600 0.100 1 1104 79
        i 5.154 162.608 0.100 1 1110 56
        i 5.155 162.663 0.100 1 1094 60
        i 4.835 162.751 0.490 3 53 43 0
        i 4.836 163.251 0.490 3 53 43 1
        i 4.837 164.251 0.490 3 53 43 2
        i 4.838 165.751 0.490 3 53 43 3
        i 4.839 167.751 0.490 3 53 43 4
        i 4.841 162.751 0.490 3 41 43 0
        i 4.842 163.251 0.490 3 41 43 1
        i 4.843 164.251 0.490 3 41 43 2
        i 4.844 165.751 0.490 3 41 43 3
        i 4.845 167.751 0.490 3 41 43 4
        i 5.156 162.787 0.100 1 1106 60
        i 5.157 162.809 0.100 1 1106 67
        i 5.158 162.861 0.100 1 1093 64
        i 5.159 162.891 0.100 1 1110 70
        i 5.160 162.967 0.100 1 1099 77
        i 5.161 162.980 0.100 1 1105 22
        i 5.162 162.983 0.100 1 1106 56
        i 5.163 163.003 0.100 1 1108 61
        i 5.164 163.025 0.100 1 1105 55
        i 5.165 163.056 0.100 1 1104 60
        i 5.166 163.060 0.100 1 1106 59
        i 5.167 163.156 0.100 1 1108 63
        i 5.168 163.236 0.100 1 1115 53
        i 5.169 163.352 0.100 1 1106 53
        i 5.170 163.424 0.100 1 1096 69
        i 5.171 163.497 0.100 1 1099 63
        i 5.172 163.524 0.100 1 1107 52
        i 5.173 163.569 0.100 1 1104 77
        i 5.174 163.595 0.100 1 1103 59
        i 5.175 163.689 0.100 1 1108 55
        i 5.176 163.704 0.100 1 1103 60
        i 5.177 163.735 0.100 1 1105 52
        i 5.178 163.745 0.100 1 1091 61
        i 5.179 163.861 0.100 1 1104 65
        i 5.180 163.943 0.100 1 1101 57
        i 5.181 163.996 0.100 1 1107 72
        i 4.847 164.001 0.490 3 41 127 0
        i 4.848 164.501 0.490 3 41 127 1
        i 4.849 165.501 0.490 3 41 127 2
        i 4.850 167.001 0.490 3 41 127 3
        i 4.851 169.001 0.490 3 41 127 4
        i 4.853 164.001 0.490 3 53 56 0
        i 4.854 164.501 0.490 3 53 56 1
        i 4.855 165.501 0.490 3 53 56 2
        i 4.856 167.001 0.490 3 53 56 3
        i 4.857 169.001 0.490 3 53 56 4
        i 5.182 164.044 0.100 1 1111 46
        i 5.183 164.077 0.100 1 1105 78
        i 5.184 164.139 0.100 1 1115 35
        i 5.185 164.144 0.100 1 1101 61
        i 5.186 164.149 0.100 1 1113 27
        i 5.187 164.228 0.100 1 1105 57
        i 5.188 164.293 0.100 1 1097 70
        i 5.189 164.320 0.100 1 1098 57
        i 5.190 164.332 0.100 1 1101 67
        i 5.191 164.427 0.100 1 1101 76
        i 5.192 164.543 0.100 1 1100 59
        i 5.193 164.545 0.100 1 1103 58
        i 5.194 164.581 0.100 1 1109 74
        i 5.195 164.721 0.100 1 1113 54
        i 4.859 164.751 0.490 3 40 127 0
        i 4.860 165.251 0.490 3 40 127 1
        i 4.861 166.251 0.490 3 40 127 2
        i 4.862 167.751 0.490 3 40 127 3
        i 4.863 169.751 0.490 3 40 127 4
        i 4.865 164.751 0.490 3 52 56 0
        i 4.866 165.251 0.490 3 52 56 1
        i 4.867 166.251 0.490 3 52 56 2
        i 4.868 167.751 0.490 3 52 56 3
        i 4.869 169.751 0.490 3 52 56 4
        i 5.196 164.779 0.100 1 1103 62
        i 5.197 164.799 0.100 1 1107 45
        i 5.198 164.817 0.100 1 1099 75
        i 5.199 164.836 0.100 1 1099 78
        i 5.200 164.856 0.100 1 1111 35
        i 5.201 164.876 0.100 1 1109 72
        i 5.202 164.935 0.100 1 1103 57
        i 5.203 164.965 0.100 1 1093 52
        i 5.204 165.132 0.100 1 1107 76
        i 5.205 165.160 0.100 1 1101 74
        i 5.206 165.271 0.100 1 1111 66
        i 5.207 165.279 0.100 1 1099 73
        i 5.208 165.333 0.100 1 1098 57
        i 5.209 165.383 0.100 1 1109 30
        i 5.210 165.393 0.100 1 1113 51
        i 5.211 165.481 0.100 1 1103 61
        i 5.212 165.483 0.100 1 1109 61
        i 5.213 165.509 0.100 1 1113 47
        i 5.214 165.531 0.100 1 1097 60
        i 5.215 165.604 0.100 1 1113 64
        i 5.216 165.643 0.100 1 1101 77
        i 5.217 165.853 0.100 1 1101 74
        i 5.218 165.884 0.100 1 1097 56
        i 5.219 165.916 0.100 1 1097 58
        i 5.220 165.963 0.100 1 1093 71
        i 4.871 166.001 0.490 3 57 43 0
        i 4.872 166.501 0.490 3 57 43 1
        i 4.873 167.501 0.490 3 57 43 2
        i 4.874 169.001 0.490 3 57 43 3
        i 4.875 171.001 0.490 3 57 43 4
        i 4.877 166.001 0.490 3 45 43 0
        i 4.878 166.501 0.490 3 45 43 1
        i 4.879 167.501 0.490 3 45 43 2
        i 4.880 169.001 0.490 3 45 43 3
        i 4.881 171.001 0.490 3 45 43 4
        i 5.221 166.027 0.100 1 1107 69
        i 5.222 166.079 0.100 1 1103 60
        i 5.223 166.103 0.100 1 1095 71
        i 5.224 166.127 0.100 1 1111 49
        i 5.225 166.161 0.100 1 1101 65
        i 5.226 166.208 0.100 1 1109 50
        i 5.227 166.211 0.100 1 1098 76
        i 5.228 166.263 0.100 1 1115 51
        i 5.229 166.288 0.100 1 1105 57
        i 5.230 166.296 0.100 1 1101 51
        i 5.231 166.453 0.100 1 1111 61
        i 5.232 166.631 0.100 1 1099 70
        i 5.233 166.732 0.100 1 1105 61
        i 5.234 166.748 0.100 1 1100 74
        i 4.883 166.751 0.490 3 55 43 0
        i 4.884 167.251 0.490 3 55 43 1
        i 4.885 168.251 0.490 3 55 43 2
        i 4.886 169.751 0.490 3 55 43 3
        i 4.887 171.751 0.490 3 55 43 4
        i 4.889 166.751 0.490 3 43 43 0
        i 4.890 167.251 0.490 3 43 43 1
        i 4.891 168.251 0.490 3 43 43 2
        i 4.892 169.751 0.490 3 43 43 3
        i 4.893 171.751 0.490 3 43 43 4
        i 5.235 166.753 0.100 1 1099 77
        i 5.236 166.755 0.100 1 1103 71
        i 5.237 166.768 0.100 1 1105 74
        i 5.238 166.776 0.100 1 1095 55
        i 5.239 166.780 0.100 1 1103 56
        i 5.240 166.791 0.100 1 1101 77
        i 5.241 166.837 0.100 1 1109 70
        i 5.242 166.897 0.100 1 1109 49
        i 5.243 166.919 0.100 1 1109 44
        i 5.244 166.963 0.100 1 1105 44
        i 5.245 167.081 0.100 1 1105 76
        i 5.246 167.141 0.100 1 1107 36
        i 5.247 167.240 0.100 1 1095 83
        i 5.248 167.300 0.100 1 1092 83
        i 5.249 167.369 0.100 1 1103 81
        i 5.250 167.387 0.100 1 1107 57
        i 5.251 167.411 0.100 1 1107 50
        i 5.252 167.443 0.100 1 1099 71
        i 5.253 167.443 0.100 1 1105 72
        i 5.254 167.475 0.100 1 1111 62
        i 5.255 167.551 0.100 1 1105 53
        i 5.256 167.684 0.100 1 1107 69
        i 5.257 167.711 0.100 1 1105 76
        i 5.258 167.743 0.100 1 1105 63
        i 5.259 167.832 0.100 1 1115 50
        i 5.260 167.853 0.100 1 1107 59
        i 5.261 167.880 0.100 1 1097 55
        i 5.262 167.933 0.100 1 1108 28
        i 5.263 167.968 0.100 1 1100 63
        i 4.895 168.001 0.490 3 40 127 0
        i 4.896 168.501 0.490 3 40 127 1
        i 4.897 169.501 0.490 3 40 127 2
        i 4.898 171.001 0.490 3 40 127 3
        i 4.899 173.001 0.490 3 40 127 4
        i 4.901 168.001 0.490 3 52 56 0
        i 5.264 168.005 0.100 1 1097 66
        i 4.902 168.501 0.490 3 52 56 1
        i 4.903 169.501 0.490 3 52 56 2
        i 4.904 171.001 0.490 3 52 56 3
        i 4.905 173.001 0.490 3 52 56 4
        i 5.265 168.052 0.100 1 1105 40
        i 5.266 168.055 0.100 1 1103 65
        i 5.267 168.097 0.100 1 1107 67
        i 5.268 168.101 0.100 1 1107 61
        i 5.269 168.163 0.100 1 1092 60
        i 5.270 168.167 0.100 1 1103 48
        i 5.271 168.288 0.100 1 1103 54
        i 5.272 168.355 0.100 1 1111 42
        i 5.273 168.384 0.100 1 1114 45
        i 5.274 168.572 0.100 1 1100 58
        i 5.275 168.607 0.100 1 1105 66
        i 5.276 168.636 0.100 1 1099 71
        i 5.277 168.667 0.100 1 1101 58
        i 5.278 168.669 0.100 1 1102 60
        i 4.907 168.751 0.490 3 38 127 0
        i 4.908 169.251 0.490 3 38 127 1
        i 4.909 170.251 0.490 3 38 127 2
        i 4.910 171.751 0.490 3 38 127 3
        i 4.911 173.751 0.490 3 38 127 4
        i 4.913 168.751 0.490 3 50 56 0
        i 4.914 169.251 0.490 3 50 56 1
        i 4.915 170.251 0.490 3 50 56 2
        i 4.916 171.751 0.490 3 50 56 3
        i 4.917 173.751 0.490 3 50 56 4
        i 5.279 168.755 0.100 1 1110 54
        i 5.280 168.795 0.100 1 1112 22
        i 5.281 168.823 0.100 1 1104 55
        i 5.282 168.887 0.100 1 1101 77
        i 5.283 168.897 0.100 1 1109 59
        i 5.284 168.920 0.100 1 1099 49
        i 5.285 168.939 0.100 1 1100 55
        i 5.286 168.985 0.100 1 1105 64
        i 5.287 169.179 0.100 1 1108 62
        i 5.288 169.193 0.100 1 1098 50
        i 5.289 169.243 0.100 1 1096 57
        i 5.290 169.292 0.100 1 1114 52
        i 5.291 169.353 0.100 1 1110 74
        i 5.292 169.440 0.100 1 1112 69
        i 5.293 169.545 0.100 1 1092 68
        i 5.294 169.548 0.100 1 1104 66
        i 5.295 169.553 0.100 1 1103 79
        i 5.296 169.572 0.100 1 1101 71
        i 5.297 169.600 0.100 1 1098 83
        i 5.298 169.603 0.100 1 1110 24
        i 5.299 169.668 0.100 1 1108 68
        i 5.300 169.751 0.100 1 1097 63
        i 5.301 169.783 0.100 1 1108 58
        i 5.302 169.811 0.100 1 1100 51
        i 5.303 169.903 0.100 1 1094 73
        i 5.304 169.920 0.100 1 1104 72
        i 5.305 169.957 0.100 1 1102 58
        i 4.919 170.001 0.490 3 55 43 0
        i 4.920 170.501 0.490 3 55 43 1
        i 4.921 171.501 0.490 3 55 43 2
        i 4.922 173.001 0.490 3 55 43 3
        i 4.923 175.001 0.490 3 55 43 4
        i 4.925 170.001 0.490 3 43 43 0
        i 4.926 170.501 0.490 3 43 43 1
        i 4.927 171.501 0.490 3 43 43 2
        i 4.928 173.001 0.490 3 43 43 3
        i 4.929 175.001 0.490 3 43 43 4
        i 5.306 170.083 0.100 1 1112 49
        i 5.307 170.143 0.100 1 1110 52
        i 5.308 170.231 0.100 1 1098 74
        i 5.309 170.404 0.100 1 1110 55
        i 5.310 170.445 0.100 1 1096 62
        i 5.311 170.480 0.100 1 1104 72
        i 5.312 170.495 0.100 1 1094 74
        i 5.313 170.521 0.100 1 1104 69
        i 5.314 170.580 0.100 1 1114 40
        i 5.315 170.588 0.100 1 1110 52
        i 5.316 170.649 0.100 1 1099 64
        i 5.317 170.652 0.100 1 1104 66
        i 5.318 170.728 0.100 1 1106 63
        i 4.931 170.751 0.490 3 55 43 0
        i 4.932 171.251 0.490 3 55 43 1
        i 4.933 172.251 0.490 3 55 43 2
        i 4.934 173.751 0.490 3 55 43 3
        i 4.935 175.751 0.490 3 55 43 4
        i 4.937 170.751 0.490 3 43 43 0
        i 4.938 171.251 0.490 3 43 43 1
        i 4.939 172.251 0.490 3 43 43 2
        i 4.940 173.751 0.490 3 43 43 3
        i 4.941 175.751 0.490 3 43 43 4
        i 5.319 170.771 0.100 1 1113 6
        i 5.320 170.785 0.100 1 1102 74
        i 5.321 170.865 0.100 1 1108 42
        i 5.322 171.164 0.100 1 1101 68
        i 5.323 171.169 0.100 1 1102 56
        i 5.324 171.215 0.100 1 1110 61
        i 5.325 171.227 0.100 1 1116 40
        i 5.326 171.268 0.100 1 1100 56
        i 5.327 171.296 0.100 1 1106 80
        i 5.328 171.387 0.100 1 1106 56
        i 5.329 171.400 0.100 1 1096 75
        i 5.330 171.485 0.100 1 1108 59
        i 5.331 171.569 0.100 1 1106 79
        i 5.332 171.717 0.100 1 1098 77
        i 5.333 171.737 0.100 1 1091 59
        i 5.334 171.747 0.100 1 1115 8
        i 5.335 171.865 0.100 1 1098 56
        i 5.336 171.912 0.100 1 1104 51
        i 5.337 171.924 0.100 1 1096 80
        i 4.943 172.001 0.490 3 36 127 0
        i 4.944 172.501 0.490 3 36 127 1
        i 4.945 173.501 0.490 3 36 127 2
        i 4.946 175.001 0.490 3 36 127 3
        i 4.947 177.001 0.490 3 36 127 4
        i 4.949 172.001 0.490 3 48 56 0
        i 4.950 172.501 0.490 3 48 56 1
        i 4.951 173.501 0.490 3 48 56 2
        i 4.952 175.001 0.490 3 48 56 3
        i 4.953 177.001 0.490 3 48 56 4
        i 5.338 172.041 0.100 1 1106 26
        i 5.339 172.059 0.100 1 1112 63
        i 5.340 172.151 0.100 1 1116 49
        i 5.341 172.165 0.100 1 1106 59
        i 5.342 172.436 0.100 1 1100 62
        i 5.343 172.443 0.100 1 1098 81
        i 5.344 172.445 0.100 1 1100 60
        i 5.345 172.483 0.100 1 1102 79
        i 5.346 172.559 0.100 1 1108 46
        i 5.347 172.579 0.100 1 1093 69
        i 5.348 172.692 0.100 1 1107 27
        i 4.955 172.751 0.490 3 36 127 0
        i 4.956 173.251 0.490 3 36 127 1
        i 4.957 174.251 0.490 3 36 127 2
        i 4.958 175.751 0.490 3 36 127 3
        i 4.959 177.751 0.490 3 36 127 4
        i 4.961 172.751 0.490 3 48 56 0
        i 4.962 173.251 0.490 3 48 56 1
        i 4.963 174.251 0.490 3 48 56 2
        i 4.964 175.751 0.490 3 48 56 3
        i 4.965 177.751 0.490 3 48 56 4
        i 5.349 172.955 0.100 1 1096 72
        i 5.350 173.052 0.100 1 1112 60
        i 5.351 173.056 0.100 1 1104 41
        i 5.352 173.108 0.100 1 1100 53
        i 5.353 173.147 0.100 1 1114 60
        i 5.354 173.201 0.100 1 1103 80
        i 5.355 173.212 0.100 1 1111 41
        i 5.356 173.333 0.100 1 1099 58
        i 5.357 173.356 0.100 1 1102 74
        i 5.358 173.557 0.100 1 1107 18
        i 5.359 173.703 0.100 1 1093 68
        i 5.360 173.707 0.100 1 1104 50
        i 5.361 173.892 0.100 1 1109 50
        i 5.362 173.900 0.100 1 1108 48
        i 5.363 173.920 0.100 1 1098 63
        i 4.967 174.001 0.490 3 52 43 0
        i 4.968 174.501 0.490 3 52 43 1
        i 4.969 175.501 0.490 3 52 43 2
        i 4.970 177.001 0.490 3 52 43 3
        i 4.971 179.001 0.490 3 52 43 4
        i 4.973 174.001 0.490 3 40 43 0
        i 4.974 174.501 0.490 3 40 43 1
        i 4.975 175.501 0.490 3 40 43 2
        i 4.976 177.001 0.490 3 40 43 3
        i 4.977 179.001 0.490 3 40 43 4
        i 5.364 174.132 0.100 1 1093 55
        i 5.365 174.167 0.100 1 1097 59
        i 5.366 174.172 0.100 1 1104 52
        i 5.367 174.215 0.100 1 1103 64
        i 5.368 174.343 0.100 1 1115 26
        i 5.369 174.403 0.100 1 1115 23
        i 5.370 174.412 0.100 1 1111 40
        i 5.371 174.511 0.100 1 1112 38
        i 4.979 174.751 0.490 3 52 43 0
        i 4.980 175.251 0.490 3 52 43 1
        i 4.981 176.251 0.490 3 52 43 2
        i 4.982 177.751 0.490 3 52 43 3
        i 4.983 179.751 0.490 3 52 43 4
        i 4.985 174.751 0.490 3 40 43 0
        i 4.986 175.251 0.490 3 40 43 1
        i 4.987 176.251 0.490 3 40 43 2
        i 4.988 177.751 0.490 3 40 43 3
        i 4.989 179.751 0.490 3 40 43 4
        i 5.372 174.879 0.100 1 1104 56
        i 5.373 174.915 0.100 1 1096 67
        i 5.374 174.992 0.100 1 1101 58
        i 5.375 175.027 0.100 1 1095 66
        i 5.376 175.048 0.100 1 1113 11
        i 5.377 175.055 0.100 1 1109 54
        i 5.378 175.087 0.100 1 1099 82
        i 5.379 175.144 0.100 1 1107 39
        i 5.380 175.244 0.100 1 1117 31
        i 5.381 175.533 0.100 1 1099 61
        i 5.382 175.595 0.100 1 1102 70
        i 5.383 175.673 0.100 1 1113 12
        i 5.384 175.715 0.100 1 1097 70
        i 5.385 175.745 0.100 1 1099 81
        i 5.386 175.775 0.100 1 1105 67
        i 5.387 175.916 0.100 1 1107 41
        i 4.991 176.001 0.490 3 36 127 0
        i 4.992 176.501 0.490 3 36 127 1
        i 4.993 177.501 0.490 3 36 127 2
        i 4.994 179.001 0.490 3 36 127 3
        i 4.995 181.001 0.490 3 36 127 4
        i 4.997 176.001 0.490 3 48 56 0
        i 4.998 176.501 0.490 3 48 56 1
        i 4.999 177.501 0.490 3 48 56 2
        i 4.1000 179.001 0.490 3 48 56 3
        i 4.1001 181.001 0.490 3 48 56 4
        i 5.388 176.119 0.100 1 1105 39
        i 5.389 176.189 0.100 1 1092 61
        i 5.390 176.217 0.100 1 1115 5
        i 5.391 176.288 0.100 1 1097 66
        i 5.392 176.340 0.100 1 1101 52
        i 5.393 176.357 0.100 1 1103 68
        i 5.394 176.524 0.100 1 1097 60
        i 4.1003 176.751 0.490 3 36 127 0
        i 4.1004 177.251 0.490 3 36 127 1
        i 4.1005 178.251 0.490 3 36 127 2
        i 4.1006 179.751 0.490 3 36 127 3
        i 4.1007 181.751 0.490 3 36 127 4
        i 4.1009 176.751 0.490 3 48 56 0
        i 4.1010 177.251 0.490 3 48 56 1
        i 4.1011 178.251 0.490 3 48 56 2
        i 4.1012 179.751 0.490 3 48 56 3
        i 4.1013 181.751 0.490 3 48 56 4
        i 5.395 176.755 0.100 1 1106 -1
        i 5.396 176.904 0.100 1 1115 60
        i 5.397 176.911 0.100 1 1095 76
        i 5.398 176.913 0.100 1 1109 35
        i 5.399 176.923 0.100 1 1101 55
        i 5.400 176.943 0.100 1 1101 52
        i 5.401 177.009 0.100 1 1094 74
        i 5.402 177.127 0.100 1 1099 77
        i 5.403 177.372 0.100 1 1108 24
        i 5.404 177.447 0.100 1 1113 40
        i 5.405 177.671 0.100 1 1099 76
        i 5.406 177.733 0.100 1 1103 70
        i 5.407 177.743 0.100 1 1098 54
        i 5.408 177.747 0.100 1 1093 72
        i 5.409 177.748 0.100 1 1111 40
        i 5.410 177.916 0.100 1 1103 55
        i 5.411 178.069 0.100 1 1114 4
        i 5.412 178.148 0.100 1 1109 56
        i 5.413 178.347 0.100 1 1103 63
        i 5.414 178.361 0.100 1 1097 80
        i 5.415 178.584 0.100 1 1109 51
        i 5.416 178.847 0.100 1 1112 30
        i 5.417 178.887 0.100 1 1105 49
        i 5.418 179.199 0.100 1 1105 84
        i 5.419 179.212 0.100 1 1100 82
        i 5.420 179.475 0.100 1 1095 72
        i 5.421 179.581 0.100 1 1116 34
        i 5.422 179.704 0.100 1 1114 15
        i 4.1015 180.001 0.490 3 36 127 0
        i 4.1016 180.501 0.490 3 36 127 1
        i 4.1017 181.501 0.490 3 36 127 2
        i 4.1018 183.001 0.490 3 36 127 3
        i 4.1019 185.001 0.490 3 36 127 4
        i 4.1021 180.001 0.490 3 48 56 0
        i 4.1022 180.501 0.490 3 48 56 1
        i 4.1023 181.501 0.490 3 48 56 2
        i 4.1024 183.001 0.490 3 48 56 3
        i 4.1025 185.001 0.490 3 48 56 4
        i 5.423 180.121 0.100 1 1097 53
        i 5.424 180.183 0.100 1 1105 69
        i 5.425 180.255 0.100 1 1116 38
        i 5.426 180.641 0.100 1 1116 24
        i 4.1027 180.751 0.490 3 36 127 0
        i 4.1028 181.251 0.490 3 36 127 1
        i 4.1029 182.251 0.490 3 36 127 2
        i 4.1030 183.751 0.490 3 36 127 3
        i 4.1031 185.751 0.490 3 36 127 4
        i 4.1033 180.751 0.490 3 48 56 0
        i 4.1034 181.251 0.490 3 48 56 1
        i 4.1035 182.251 0.490 3 48 56 2
        i 4.1036 183.751 0.490 3 48 56 3
        i 4.1037 185.751 0.490 3 48 56 4
        i 5.427 180.919 0.100 1 1102 73
        i 5.428 181.053 0.100 1 1098 70
        i 5.429 181.097 0.100 1 1108 40
        i 5.430 181.609 0.100 1 1110 23
        i 5.431 181.625 0.100 1 1106 27
        i 5.432 181.659 0.100 1 1100 59
        i 5.433 182.477 0.100 1 1104 79
        i 5.434 182.529 0.100 1 1109 8
        i 5.435 183.353 0.100 1 1106 66
        i 5.436 183.353 0.100 1 1113 4
        i 5.437 183.920 0.100 1 1096 51
        i 4.1039 184.001 0.490 3 36 127 0
        i 4.1040 184.501 0.490 3 36 127 1
        i 4.1041 185.501 0.490 3 36 127 2
        i 4.1042 187.001 0.490 3 36 127 3
        i 4.1043 189.001 0.490 3 36 127 4
        i 5.438 184.097 0.100 1 1111 22
        i 5.439 184.429 0.100 1 1098 78
        i 4.1045 184.751 0.490 3 36 127 0
        i 4.1046 185.251 0.490 3 36 127 1
        i 4.1047 186.251 0.490 3 36 127 2
        i 4.1048 187.751 0.490 3 36 127 3
        i 4.1049 189.751 0.490 3 36 127 4
        i 5.440 184.761 0.100 1 1115 12
        i 5.441 185.381 0.100 1 1102 50
        i 5.442 186.276 0.100 1 1100 69
        i 5.443 186.941 0.100 1 1105 79
        i 5.444 187.664 0.100 1 1107 51
        i 4.1051 188.001 0.490 3 36 127 0
        i 4.1052 188.501 0.490 3 36 127 1
        i 4.1053 189.501 0.490 3 36 127 2
        i 4.1054 191.001 0.490 3 36 127 3
        i 4.1055 193.001 0.490 3 36 127 4
        i 5.445 188.385 0.100 1 1097 77
        i 5.446 189.049 0.100 1 1099 71
        i 5.447 189.944 0.100 1 1101 55
        i 5.448 190.897 0.100 1 1099 52
        i 5.449 191.408 0.100 1 1105 57
        i 5.450 191.976 0.100 1 1106 51
        i 5.451 192.852 0.100 1 1098 69
        i 5.452 193.671 0.100 1 1100 61
        i 5.453 194.412 0.100 1 1100 48
        i 5.454 195.211 0.100 1 1098 50
        i 5.455 195.856 0.100 1 1106 51
        i 5.456 196.444 0.100 1 1106 54
        s
        i "SendEndedMessage" 30 -1
         #ifdef IS_GENERATING_JSON
            i "GenerateJson" 0 1
         #else
            e 60
         #end
        </CsScore>
        </CsoundSynthesizer>
        `
    const csdJson = `
{"6c9f37ab-392f-429b-8217-eac09f295362":[{"instanceName":"","startDistance":60,"delayDistance":100,"noteNumberToHeightScale":7.50,"delayTime":0.50,"duration":0.5,"delayCount":5},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":17.000,"note":36,"velocity":127}},{"noteOn":{"time":17.750,"note":36,"velocity":127}},{"noteOn":{"time":21.000,"note":36,"velocity":127}},{"noteOn":{"time":21.750,"note":36,"velocity":127}},{"noteOn":{"time":25.000,"note":36,"velocity":127}},{"noteOn":{"time":25.750,"note":38,"velocity":127}},{"noteOn":{"time":29.000,"note":41,"velocity":127}},{"noteOn":{"time":29.750,"note":40,"velocity":127}},{"noteOn":{"time":33.000,"note":36,"velocity":127}},{"noteOn":{"time":33.750,"note":38,"velocity":127}},{"noteOn":{"time":37.000,"note":41,"velocity":127}},{"noteOn":{"time":37.750,"note":43,"velocity":127}},{"noteOn":{"time":41.000,"note":36,"velocity":127}},{"noteOn":{"time":41.750,"note":38,"velocity":127}},{"noteOn":{"time":45.000,"note":41,"velocity":127}},{"noteOn":{"time":45.750,"note":40,"velocity":127}},{"noteOn":{"time":49.000,"note":40,"velocity":127}},{"noteOn":{"time":49.750,"note":38,"velocity":127}},{"noteOn":{"time":53.000,"note":36,"velocity":127}},{"noteOn":{"time":53.750,"note":36,"velocity":127}},{"noteOn":{"time":57.000,"note":36,"velocity":127}},{"noteOn":{"time":57.750,"note":38,"velocity":127}},{"noteOn":{"time":61.000,"note":41,"velocity":127}},{"noteOn":{"time":61.750,"note":40,"velocity":127}},{"noteOn":{"time":65.000,"note":36,"velocity":127}},{"noteOn":{"time":65.750,"note":38,"velocity":127}},{"noteOn":{"time":69.000,"note":41,"velocity":127}},{"noteOn":{"time":69.750,"note":43,"velocity":127}},{"noteOn":{"time":73.000,"note":36,"velocity":127}},{"noteOn":{"time":73.750,"note":38,"velocity":127}},{"noteOn":{"time":77.000,"note":41,"velocity":127}},{"noteOn":{"time":77.750,"note":40,"velocity":127}},{"noteOn":{"time":81.000,"note":40,"velocity":127}},{"noteOn":{"time":81.750,"note":38,"velocity":127}},{"noteOn":{"time":85.000,"note":36,"velocity":127}},{"noteOn":{"time":85.750,"note":36,"velocity":127}},{"noteOn":{"time":91.000,"note":36,"velocity":127}},{"noteOn":{"time":91.750,"note":36,"velocity":127}},{"noteOn":{"time":97.000,"note":36,"velocity":127}},{"noteOn":{"time":97.750,"note":36,"velocity":127}},{"noteOn":{"time":101.000,"note":36,"velocity":127}},{"noteOn":{"time":101.750,"note":36,"velocity":127}},{"noteOn":{"time":105.000,"note":36,"velocity":127}},{"noteOn":{"time":105.750,"note":36,"velocity":127}},{"noteOn":{"time":107.000,"note":36,"velocity":127}},{"noteOn":{"time":107.750,"note":36,"velocity":127}},{"noteOn":{"time":109.000,"note":36,"velocity":127}},{"noteOn":{"time":109.125,"note":43,"velocity":127}},{"noteOn":{"time":109.750,"note":36,"velocity":127}},{"noteOn":{"time":109.875,"note":43,"velocity":127}},{"noteOn":{"time":111.000,"note":36,"velocity":127}},{"noteOn":{"time":111.125,"note":43,"velocity":127}},{"noteOn":{"time":111.750,"note":36,"velocity":127}},{"noteOn":{"time":111.875,"note":43,"velocity":127}},{"noteOn":{"time":113.000,"note":36,"velocity":127}},{"noteOn":{"time":113.125,"note":43,"velocity":127}},{"noteOn":{"time":113.250,"note":48,"velocity":127}},{"noteOn":{"time":113.750,"note":36,"velocity":127}},{"noteOn":{"time":113.875,"note":43,"velocity":127}},{"noteOn":{"time":114.000,"note":48,"velocity":127}},{"noteOn":{"time":115.000,"note":36,"velocity":127}},{"noteOn":{"time":115.125,"note":43,"velocity":127}},{"noteOn":{"time":115.250,"note":52,"velocity":64}},{"noteOn":{"time":115.750,"note":36,"velocity":127}},{"noteOn":{"time":115.875,"note":43,"velocity":127}},{"noteOn":{"time":116.000,"note":52,"velocity":64}},{"noteOn":{"time":117.000,"note":36,"velocity":127}},{"noteOn":{"time":117.750,"note":38,"velocity":127}},{"noteOn":{"time":119.000,"note":52,"velocity":49}},{"noteOn":{"time":119.750,"note":53,"velocity":49}},{"noteOn":{"time":121.000,"note":41,"velocity":127}},{"noteOn":{"time":121.750,"note":40,"velocity":127}},{"noteOn":{"time":123.000,"note":57,"velocity":49}},{"noteOn":{"time":123.750,"note":55,"velocity":49}},{"noteOn":{"time":125.000,"note":36,"velocity":127}},{"noteOn":{"time":125.750,"note":38,"velocity":127}},{"noteOn":{"time":127.000,"note":52,"velocity":49}},{"noteOn":{"time":127.750,"note":53,"velocity":49}},{"noteOn":{"time":129.000,"note":41,"velocity":127}},{"noteOn":{"time":129.750,"note":43,"velocity":127}},{"noteOn":{"time":131.000,"note":57,"velocity":49}},{"noteOn":{"time":131.750,"note":59,"velocity":49}},{"noteOn":{"time":133.000,"note":36,"velocity":127}},{"noteOn":{"time":133.750,"note":38,"velocity":127}},{"noteOn":{"time":135.000,"note":52,"velocity":49}},{"noteOn":{"time":135.750,"note":53,"velocity":49}},{"noteOn":{"time":137.000,"note":41,"velocity":127}},{"noteOn":{"time":137.750,"note":40,"velocity":127}},{"noteOn":{"time":139.000,"note":57,"velocity":49}},{"noteOn":{"time":139.750,"note":55,"velocity":49}},{"noteOn":{"time":141.000,"note":40,"velocity":127}},{"noteOn":{"time":141.750,"note":38,"velocity":127}},{"noteOn":{"time":143.000,"note":55,"velocity":49}},{"noteOn":{"time":143.750,"note":53,"velocity":49}},{"noteOn":{"time":145.000,"note":36,"velocity":127}},{"noteOn":{"time":145.750,"note":36,"velocity":127}},{"noteOn":{"time":147.000,"note":52,"velocity":49}},{"noteOn":{"time":147.750,"note":52,"velocity":49}},{"noteOn":{"time":149.000,"note":36,"velocity":127}},{"noteOn":{"time":149.000,"note":48,"velocity":56}},{"noteOn":{"time":149.750,"note":38,"velocity":127}},{"noteOn":{"time":149.750,"note":50,"velocity":56}},{"noteOn":{"time":151.000,"note":52,"velocity":43}},{"noteOn":{"time":151.000,"note":40,"velocity":43}},{"noteOn":{"time":151.750,"note":41,"velocity":42}},{"noteOn":{"time":151.750,"note":53,"velocity":43}},{"noteOn":{"time":153.000,"note":41,"velocity":127}},{"noteOn":{"time":153.000,"note":53,"velocity":56}},{"noteOn":{"time":153.750,"note":40,"velocity":127}},{"noteOn":{"time":153.750,"note":52,"velocity":56}},{"noteOn":{"time":155.000,"note":57,"velocity":43}},{"noteOn":{"time":155.000,"note":45,"velocity":43}},{"noteOn":{"time":155.750,"note":55,"velocity":43}},{"noteOn":{"time":155.750,"note":43,"velocity":43}},{"noteOn":{"time":157.000,"note":36,"velocity":127}},{"noteOn":{"time":157.000,"note":48,"velocity":56}},{"noteOn":{"time":157.750,"note":38,"velocity":127}},{"noteOn":{"time":157.750,"note":50,"velocity":56}},{"noteOn":{"time":159.000,"note":52,"velocity":43}},{"noteOn":{"time":159.000,"note":40,"velocity":43}},{"noteOn":{"time":159.750,"note":53,"velocity":43}},{"noteOn":{"time":159.750,"note":41,"velocity":43}},{"noteOn":{"time":161.000,"note":41,"velocity":127}},{"noteOn":{"time":161.000,"note":53,"velocity":56}},{"noteOn":{"time":161.750,"note":43,"velocity":127}},{"noteOn":{"time":161.750,"note":55,"velocity":56}},{"noteOn":{"time":163.000,"note":57,"velocity":43}},{"noteOn":{"time":163.000,"note":45,"velocity":43}},{"noteOn":{"time":163.750,"note":59,"velocity":43}},{"noteOn":{"time":163.750,"note":47,"velocity":43}},{"noteOn":{"time":165.000,"note":36,"velocity":127}},{"noteOn":{"time":165.000,"note":48,"velocity":56}},{"noteOn":{"time":165.750,"note":38,"velocity":127}},{"noteOn":{"time":165.750,"note":50,"velocity":56}},{"noteOn":{"time":167.000,"note":52,"velocity":43}},{"noteOn":{"time":167.000,"note":40,"velocity":43}},{"noteOn":{"time":167.750,"note":53,"velocity":43}},{"noteOn":{"time":167.750,"note":41,"velocity":43}},{"noteOn":{"time":169.000,"note":41,"velocity":127}},{"noteOn":{"time":169.000,"note":53,"velocity":56}},{"noteOn":{"time":169.750,"note":40,"velocity":127}},{"noteOn":{"time":169.750,"note":52,"velocity":56}},{"noteOn":{"time":171.000,"note":57,"velocity":43}},{"noteOn":{"time":171.000,"note":45,"velocity":43}},{"noteOn":{"time":171.750,"note":55,"velocity":43}},{"noteOn":{"time":171.750,"note":43,"velocity":43}},{"noteOn":{"time":173.000,"note":40,"velocity":127}},{"noteOn":{"time":173.000,"note":52,"velocity":56}},{"noteOn":{"time":173.750,"note":38,"velocity":127}},{"noteOn":{"time":173.750,"note":50,"velocity":56}},{"noteOn":{"time":175.000,"note":55,"velocity":43}},{"noteOn":{"time":175.000,"note":43,"velocity":43}},{"noteOn":{"time":175.750,"note":55,"velocity":43}},{"noteOn":{"time":175.750,"note":43,"velocity":43}},{"noteOn":{"time":177.000,"note":36,"velocity":127}},{"noteOn":{"time":177.000,"note":48,"velocity":56}},{"noteOn":{"time":177.750,"note":36,"velocity":127}},{"noteOn":{"time":177.750,"note":48,"velocity":56}},{"noteOn":{"time":179.000,"note":52,"velocity":43}},{"noteOn":{"time":179.000,"note":40,"velocity":43}},{"noteOn":{"time":179.750,"note":52,"velocity":43}},{"noteOn":{"time":179.750,"note":40,"velocity":43}},{"noteOn":{"time":181.000,"note":36,"velocity":127}},{"noteOn":{"time":181.000,"note":48,"velocity":56}},{"noteOn":{"time":181.750,"note":36,"velocity":127}},{"noteOn":{"time":181.750,"note":48,"velocity":56}},{"noteOn":{"time":185.000,"note":36,"velocity":127}},{"noteOn":{"time":185.000,"note":48,"velocity":56}},{"noteOn":{"time":185.750,"note":36,"velocity":127}},{"noteOn":{"time":185.750,"note":48,"velocity":56}},{"noteOn":{"time":189.000,"note":36,"velocity":127}},{"noteOn":{"time":189.750,"note":36,"velocity":127}},{"noteOn":{"time":193.000,"note":36,"velocity":127}}],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","fadeInTime":0.05,"fadeOutTime":0.05,"soundDistanceMin":50,"soundDistanceMax":500},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-39.005,-154.000,486.514]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[191.920,-154.000,346.694]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-99.579,-154.000,-314.826]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[304.204,-154.000,215.101]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[17.346,-154.000,108.983]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[149.602,-154.000,44.919]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-87.346,-154.000,-201.261]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-275.253,-154.000,-15.456]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-185.718,-154.000,46.327]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[43.873,266.000,54.782]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-55.327,230.000,-365.918]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[429.944,326.000,209.088]}},{"noteOn":{"time":10.245,"note":103.000,"xyz":[180.612,326.000,-230.645]}},{"noteOn":{"time":10.800,"note":95.000,"xyz":[-66.788,230.000,-46.294]}},{"noteOn":{"time":11.530,"note":97.000,"xyz":[-119.515,254.000,64.845]}},{"noteOn":{"time":12.440,"note":97.000,"xyz":[136.325,254.000,-275.432]}},{"noteOn":{"time":13.355,"note":95.000,"xyz":[414.747,230.000,-2.534]}},{"noteOn":{"time":14.095,"note":103.000,"xyz":[463.714,326.000,-22.122]}},{"noteOn":{"time":14.665,"note":102.000,"xyz":[394.852,314.000,-268.659]}},{"noteOn":{"time":15.235,"note":96.000,"xyz":[-363.407,242.000,-277.526]}},{"noteOn":{"time":15.275,"note":96.000,"xyz":[-140.352,242.000,-313.094]}},{"noteOn":{"time":15.850,"note":94.000,"xyz":[17.638,218.000,-69.666]}},{"noteOn":{"time":16.060,"note":98.000,"xyz":[-119.126,266.000,318.533]}},{"noteOn":{"time":16.380,"note":102.000,"xyz":[142.814,314.000,-137.781]}},{"noteOn":{"time":17.025,"note":96.000,"xyz":[-183.886,242.000,228.757]}},{"noteOn":{"time":17.320,"note":101.000,"xyz":[-402.736,302.000,243.035]}},{"noteOn":{"time":17.885,"note":94.000,"xyz":[161.823,218.000,5.988]}},{"noteOn":{"time":18.175,"note":95.000,"xyz":[117.209,230.000,215.475]}},{"noteOn":{"time":18.575,"note":104.000,"xyz":[-136.783,338.000,-337.356]}},{"noteOn":{"time":18.910,"note":97.000,"xyz":[46.507,254.000,-50.697]}},{"noteOn":{"time":19.085,"note":102.000,"xyz":[-14.505,314.000,-87.141]}},{"noteOn":{"time":19.730,"note":95.000,"xyz":[20.380,230.000,-419.511]}},{"noteOn":{"time":19.750,"note":96.000,"xyz":[-46.465,242.000,-23.949]}},{"noteOn":{"time":20.325,"note":93.000,"xyz":[341.837,206.000,152.472]}},{"noteOn":{"time":20.590,"note":99.000,"xyz":[-125.971,278.000,148.360]}},{"noteOn":{"time":20.830,"note":103.000,"xyz":[-52.057,326.000,-196.310]}},{"noteOn":{"time":20.970,"note":99.000,"xyz":[-181.235,278.000,316.363]}},{"noteOn":{"time":21.575,"note":95.000,"xyz":[151.368,230.000,50.392]}},{"noteOn":{"time":21.640,"note":97.000,"xyz":[-304.114,254.000,-61.804]}},{"noteOn":{"time":21.750,"note":101.000,"xyz":[430.793,302.000,-164.852]}},{"noteOn":{"time":22.205,"note":103.000,"xyz":[215.583,326.000,-154.982]}},{"noteOn":{"time":22.385,"note":93.000,"xyz":[127.262,206.000,139.887]}},{"noteOn":{"time":22.585,"note":96.000,"xyz":[349.395,242.000,-145.312]}},{"noteOn":{"time":22.910,"note":105.000,"xyz":[376.354,350.000,-224.388]}},{"noteOn":{"time":23.015,"note":103.000,"xyz":[111.721,326.000,148.217]}},{"noteOn":{"time":23.340,"note":98.000,"xyz":[125.431,266.000,-55.767]}},{"noteOn":{"time":23.445,"note":95.000,"xyz":[-214.330,230.000,405.641]}},{"noteOn":{"time":23.560,"note":101.000,"xyz":[-354.009,302.000,151.689]}},{"noteOn":{"time":24.175,"note":97.000,"xyz":[341.278,254.000,-236.487]}},{"noteOn":{"time":24.185,"note":94.000,"xyz":[-121.479,218.000,-61.882]}},{"noteOn":{"time":24.280,"note":97.000,"xyz":[-63.246,254.000,282.642]}},{"noteOn":{"time":24.680,"note":99.000,"xyz":[185.892,278.000,45.755]}},{"noteOn":{"time":24.755,"note":92.000,"xyz":[220.323,194.000,359.805]}},{"noteOn":{"time":25.175,"note":99.000,"xyz":[130.462,278.000,151.886]}},{"noteOn":{"time":25.270,"note":102.000,"xyz":[22.939,314.000,64.284]}},{"noteOn":{"time":25.440,"note":97.000,"xyz":[-59.792,254.000,-285.026]}},{"noteOn":{"time":25.965,"note":104.000,"xyz":[138.094,338.000,-7.612]}},{"noteOn":{"time":26.105,"note":94.000,"xyz":[-319.210,218.000,-166.847]}},{"noteOn":{"time":26.170,"note":100.000,"xyz":[71.616,290.000,-58.393]}},{"noteOn":{"time":26.755,"note":104.000,"xyz":[-32.729,338.000,-142.972]}},{"noteOn":{"time":26.860,"note":92.000,"xyz":[-268.023,194.000,67.962]}},{"noteOn":{"time":26.980,"note":96.000,"xyz":[-371.705,242.000,99.972]}},{"noteOn":{"time":27.310,"note":96.000,"xyz":[37.789,242.000,145.230]}},{"noteOn":{"time":27.435,"note":102.000,"xyz":[-29.298,314.000,158.486]}},{"noteOn":{"time":27.760,"note":98.000,"xyz":[167.966,266.000,180.924]}},{"noteOn":{"time":28.005,"note":94.000,"xyz":[-120.553,218.000,73.628]}},{"noteOn":{"time":28.035,"note":100.000,"xyz":[-263.575,290.000,4.425]}},{"noteOn":{"time":28.125,"note":98.000,"xyz":[264.575,266.000,-412.472]}},{"noteOn":{"time":28.625,"note":93.000,"xyz":[323.664,206.000,74.812]}},{"noteOn":{"time":28.710,"note":98.000,"xyz":[320.531,266.000,-81.160]}},{"noteOn":{"time":28.750,"note":92.000,"xyz":[464.972,194.000,63.605]}},{"noteOn":{"time":28.810,"note":98.000,"xyz":[-119.386,266.000,-101.120]}},{"noteOn":{"time":29.175,"note":91.000,"xyz":[-270.951,182.000,262.619]}},{"noteOn":{"time":29.510,"note":102.000,"xyz":[-32.280,314.000,118.016]}},{"noteOn":{"time":29.555,"note":96.000,"xyz":[101.572,242.000,-312.779]}},{"noteOn":{"time":29.710,"note":101.000,"xyz":[17.214,302.000,-161.555]}},{"noteOn":{"time":29.760,"note":100.000,"xyz":[189.657,290.000,373.524]}},{"noteOn":{"time":30.170,"note":104.000,"xyz":[-153.208,338.000,353.768]}},{"noteOn":{"time":30.250,"note":100.000,"xyz":[-115.489,290.000,-132.859]}},{"noteOn":{"time":30.585,"note":99.000,"xyz":[226.601,278.000,44.492]}},{"noteOn":{"time":30.635,"note":94.000,"xyz":[17.520,218.000,-173.142]}},{"noteOn":{"time":31.015,"note":95.000,"xyz":[152.237,230.000,-33.540]}},{"noteOn":{"time":31.045,"note":103.000,"xyz":[222.780,326.000,-183.267]}},{"noteOn":{"time":31.335,"note":92.000,"xyz":[85.994,194.000,-241.186]}},{"noteOn":{"time":31.375,"note":97.000,"xyz":[-246.134,254.000,-53.265]}},{"noteOn":{"time":31.685,"note":97.000,"xyz":[355.308,254.000,-318.241]}},{"noteOn":{"time":31.750,"note":97.000,"xyz":[-67.517,254.000,-96.779]}},{"noteOn":{"time":31.855,"note":101.000,"xyz":[31.161,302.000,91.569]}},{"noteOn":{"time":32.175,"note":99.000,"xyz":[9.857,278.000,92.918]}},{"noteOn":{"time":32.510,"note":99.000,"xyz":[-13.446,278.000,-80.284]}},{"noteOn":{"time":32.515,"note":93.000,"xyz":[81.184,206.000,334.703]}},{"noteOn":{"time":32.590,"note":99.000,"xyz":[128.996,278.000,165.026]}},{"noteOn":{"time":33.060,"note":93.000,"xyz":[44.821,206.000,279.648]}},{"noteOn":{"time":33.250,"note":91.000,"xyz":[-104.434,182.000,94.240]}},{"noteOn":{"time":33.260,"note":97.000,"xyz":[-331.603,254.000,188.346]}},{"noteOn":{"time":33.340,"note":99.000,"xyz":[288.590,278.000,47.601]}},{"noteOn":{"time":33.590,"note":92.000,"xyz":[-206.657,194.000,278.649]}},{"noteOn":{"time":34.020,"note":101.000,"xyz":[458.520,302.000,-158.405]}},{"noteOn":{"time":34.040,"note":101.000,"xyz":[377.167,302.000,-146.946]}},{"noteOn":{"time":34.150,"note":100.000,"xyz":[-15.757,290.000,68.687]}},{"noteOn":{"time":34.195,"note":95.000,"xyz":[351.043,230.000,246.972]}},{"noteOn":{"time":34.335,"note":101.000,"xyz":[-264.399,302.000,-352.403]}},{"noteOn":{"time":34.730,"note":99.000,"xyz":[-383.142,278.000,-297.590]}},{"noteOn":{"time":34.745,"note":99.000,"xyz":[-98.745,278.000,218.007]}},{"noteOn":{"time":34.895,"note":105.000,"xyz":[-444.284,350.000,89.673]}},{"noteOn":{"time":35.005,"note":98.000,"xyz":[-15.423,266.000,-251.714]}},{"noteOn":{"time":35.155,"note":93.000,"xyz":[-40.555,206.000,-413.852]}},{"noteOn":{"time":35.520,"note":95.000,"xyz":[441.347,230.000,-105.354]}},{"noteOn":{"time":35.560,"note":103.000,"xyz":[-27.663,326.000,80.779]}},{"noteOn":{"time":35.770,"note":98.000,"xyz":[-63.904,266.000,17.884]}},{"noteOn":{"time":35.800,"note":93.000,"xyz":[120.075,206.000,92.229]}},{"noteOn":{"time":35.860,"note":103.000,"xyz":[139.555,326.000,-349.886]}},{"noteOn":{"time":36.245,"note":98.000,"xyz":[328.504,266.000,-357.367]}},{"noteOn":{"time":36.330,"note":101.000,"xyz":[168.269,302.000,105.760]}},{"noteOn":{"time":36.540,"note":105.000,"xyz":[6.381,350.000,-115.647]}},{"noteOn":{"time":36.590,"note":97.000,"xyz":[-108.768,254.000,-340.848]}},{"noteOn":{"time":36.590,"note":100.000,"xyz":[-77.392,290.000,49.324]}},{"noteOn":{"time":37.025,"note":92.000,"xyz":[18.531,194.000,-257.642]}},{"noteOn":{"time":37.040,"note":98.000,"xyz":[-288.975,266.000,139.216]}},{"noteOn":{"time":37.415,"note":95.000,"xyz":[-58.603,230.000,-118.365]}},{"noteOn":{"time":37.495,"note":92.000,"xyz":[-172.450,194.000,-110.626]}},{"noteOn":{"time":37.585,"note":100.000,"xyz":[-182.411,290.000,-18.583]}},{"noteOn":{"time":37.745,"note":90.000,"xyz":[58.259,170.000,-33.117]}},{"noteOn":{"time":37.925,"note":100.000,"xyz":[190.217,290.000,-265.345]}},{"noteOn":{"time":38.005,"note":92.000,"xyz":[-437.362,194.000,-230.162]}},{"noteOn":{"time":38.145,"note":97.000,"xyz":[-132.506,254.000,-105.690]}},{"noteOn":{"time":38.340,"note":96.000,"xyz":[-105.399,242.000,30.312]}},{"noteOn":{"time":38.525,"note":100.000,"xyz":[-96.049,290.000,80.595]}},{"noteOn":{"time":38.585,"note":100.000,"xyz":[121.483,290.000,-111.771]}},{"noteOn":{"time":38.725,"note":101.000,"xyz":[320.339,302.000,339.908]}},{"noteOn":{"time":38.865,"note":102.000,"xyz":[268.817,314.000,140.411]}},{"noteOn":{"time":39.245,"note":98.000,"xyz":[365.719,266.000,-262.496]}},{"noteOn":{"time":39.290,"note":98.000,"xyz":[-113.070,266.000,410.482]}},{"noteOn":{"time":39.320,"note":94.000,"xyz":[-131.629,218.000,-410.746]}},{"noteOn":{"time":39.420,"note":97.000,"xyz":[126.210,254.000,180.053]}},{"noteOn":{"time":39.630,"note":92.000,"xyz":[57.381,194.000,-305.791]}},{"noteOn":{"time":40.005,"note":104.000,"xyz":[-183.382,338.000,364.922]}},{"noteOn":{"time":40.030,"note":96.000,"xyz":[245.858,242.000,162.502]}},{"noteOn":{"time":40.110,"note":104.000,"xyz":[-27.201,338.000,47.185]}},{"noteOn":{"time":40.165,"note":99.000,"xyz":[47.085,278.000,-222.134]}},{"noteOn":{"time":40.220,"note":94.000,"xyz":[406.559,218.000,274.601]}},{"noteOn":{"time":40.310,"note":92.000,"xyz":[-179.084,194.000,-443.073]}},{"noteOn":{"time":40.740,"note":98.000,"xyz":[-191.591,266.000,-311.218]}},{"noteOn":{"time":40.810,"note":100.000,"xyz":[-269.304,290.000,-323.281]}},{"noteOn":{"time":40.865,"note":106.000,"xyz":[327.641,362.000,-175.677]}},{"noteOn":{"time":41.010,"note":101.000,"xyz":[-31.656,302.000,98.914]}},{"noteOn":{"time":41.055,"note":102.000,"xyz":[22.864,314.000,-56.764]}},{"noteOn":{"time":41.210,"note":90.000,"xyz":[98.030,170.000,198.332]}},{"noteOn":{"time":41.530,"note":92.000,"xyz":[24.793,194.000,237.450]}},{"noteOn":{"time":41.570,"note":98.000,"xyz":[161.073,266.000,-42.088]}},{"noteOn":{"time":41.720,"note":100.000,"xyz":[357.023,290.000,-293.961]}},{"noteOn":{"time":41.860,"note":96.000,"xyz":[176.177,242.000,-350.067]}},{"noteOn":{"time":41.875,"note":98.000,"xyz":[-175.031,266.000,247.739]}},{"noteOn":{"time":41.935,"note":91.000,"xyz":[-145.705,182.000,57.232]}},{"noteOn":{"time":42.240,"note":91.000,"xyz":[261.301,182.000,368.915]}},{"noteOn":{"time":42.300,"note":98.000,"xyz":[250.794,266.000,-21.610]}},{"noteOn":{"time":42.450,"note":93.000,"xyz":[-153.556,206.000,-69.222]}},{"noteOn":{"time":42.510,"note":100.000,"xyz":[92.616,290.000,361.731]}},{"noteOn":{"time":42.710,"note":98.000,"xyz":[-387.123,266.000,209.256]}},{"noteOn":{"time":42.795,"note":100.000,"xyz":[-18.197,290.000,248.123]}},{"noteOn":{"time":43.035,"note":99.000,"xyz":[-45.431,278.000,49.622]}},{"noteOn":{"time":43.055,"note":99.000,"xyz":[129.294,278.000,-15.787]}},{"noteOn":{"time":43.130,"note":94.000,"xyz":[266.811,218.000,313.451]}},{"noteOn":{"time":43.395,"note":103.000,"xyz":[12.409,326.000,-48.700]}},{"noteOn":{"time":43.410,"note":100.000,"xyz":[-229.282,290.000,-4.992]}},{"noteOn":{"time":43.640,"note":95.000,"xyz":[303.484,230.000,-42.860]}},{"noteOn":{"time":43.740,"note":97.000,"xyz":[-120.471,254.000,56.319]}},{"noteOn":{"time":43.865,"note":97.000,"xyz":[442.045,254.000,-223.288]}},{"noteOn":{"time":43.870,"note":97.000,"xyz":[225.790,254.000,163.980]}},{"noteOn":{"time":43.965,"note":98.000,"xyz":[-162.520,266.000,69.025]}},{"noteOn":{"time":44.110,"note":93.000,"xyz":[359.310,206.000,-96.856]}},{"noteOn":{"time":44.530,"note":93.000,"xyz":[-105.967,206.000,-150.528]}},{"noteOn":{"time":44.540,"note":97.000,"xyz":[166.726,254.000,52.335]}},{"noteOn":{"time":44.560,"note":105.000,"xyz":[45.041,350.000,134.685]}},{"noteOn":{"time":44.590,"note":100.000,"xyz":[-21.877,290.000,-211.721]}},{"noteOn":{"time":44.645,"note":95.000,"xyz":[20.113,230.000,-87.461]}},{"noteOn":{"time":44.725,"note":91.000,"xyz":[-82.192,182.000,-420.320]}},{"noteOn":{"time":45.240,"note":99.000,"xyz":[261.495,278.000,-120.569]}},{"noteOn":{"time":45.285,"note":99.000,"xyz":[-95.243,278.000,-228.278]}},{"noteOn":{"time":45.295,"note":105.000,"xyz":[103.211,350.000,-0.105]}},{"noteOn":{"time":45.410,"note":103.000,"xyz":[449.809,326.000,-141.049]}},{"noteOn":{"time":45.455,"note":102.000,"xyz":[-229.018,314.000,-307.691]}},{"noteOn":{"time":45.670,"note":89.000,"xyz":[198.723,158.000,-243.161]}},{"noteOn":{"time":46.045,"note":91.000,"xyz":[-97.151,182.000,190.999]}},{"noteOn":{"time":46.105,"note":97.000,"xyz":[-321.903,254.000,-369.298]}},{"noteOn":{"time":46.180,"note":97.000,"xyz":[175.990,254.000,-67.414]}},{"noteOn":{"time":46.205,"note":99.000,"xyz":[205.636,278.000,-138.895]}},{"noteOn":{"time":46.270,"note":101.000,"xyz":[-72.394,302.000,-18.415]}},{"noteOn":{"time":46.405,"note":92.000,"xyz":[-142.844,194.000,-164.768]}},{"noteOn":{"time":46.425,"note":103.000,"xyz":[-0.834,326.000,-188.102]}},{"noteOn":{"time":46.740,"note":91.000,"xyz":[297.365,182.000,15.645]}},{"noteOn":{"time":46.830,"note":97.000,"xyz":[242.140,254.000,-195.355]}},{"noteOn":{"time":46.940,"note":94.000,"xyz":[202.653,218.000,-240.962]}},{"noteOn":{"time":47.095,"note":101.000,"xyz":[-163.599,302.000,-326.966]}},{"noteOn":{"time":47.150,"note":99.000,"xyz":[268.606,278.000,-50.608]}},{"noteOn":{"time":47.175,"note":99.000,"xyz":[160.937,278.000,243.954]}},{"noteOn":{"time":47.380,"note":101.000,"xyz":[441.405,302.000,-6.129]}},{"noteOn":{"time":47.545,"note":98.000,"xyz":[-36.144,266.000,-91.993]}},{"noteOn":{"time":47.565,"note":98.000,"xyz":[-51.157,266.000,411.493]}},{"noteOn":{"time":47.615,"note":95.000,"xyz":[-80.748,230.000,296.104]}},{"noteOn":{"time":47.930,"note":103.000,"xyz":[67.504,326.000,357.451]}},{"noteOn":{"time":47.975,"note":99.000,"xyz":[262.611,278.000,-97.492]}},{"noteOn":{"time":47.985,"note":103.000,"xyz":[26.115,326.000,-71.569]}},{"noteOn":{"time":48.005,"note":101.000,"xyz":[-221.906,302.000,-132.962]}},{"noteOn":{"time":48.240,"note":96.000,"xyz":[48.953,242.000,117.563]}},{"noteOn":{"time":48.310,"note":97.000,"xyz":[51.190,254.000,180.430]}},{"noteOn":{"time":48.355,"note":96.000,"xyz":[274.593,242.000,281.140]}},{"noteOn":{"time":48.585,"note":94.000,"xyz":[328.364,218.000,-197.342]}},{"noteOn":{"time":48.645,"note":105.000,"xyz":[-35.027,350.000,36.083]}},{"noteOn":{"time":48.650,"note":97.000,"xyz":[90.103,254.000,-88.627]}},{"noteOn":{"time":48.940,"note":95.000,"xyz":[-19.265,230.000,157.829]}},{"noteOn":{"time":49.050,"note":98.000,"xyz":[102.070,266.000,115.345]}},{"noteOn":{"time":49.060,"note":100.000,"xyz":[-355.021,290.000,-344.891]}},{"noteOn":{"time":49.105,"note":96.000,"xyz":[221.820,242.000,-274.127]}},{"noteOn":{"time":49.185,"note":105.000,"xyz":[98.913,350.000,310.076]}},{"noteOn":{"time":49.205,"note":91.000,"xyz":[-360.367,182.000,-52.644]}},{"noteOn":{"time":49.430,"note":95.000,"xyz":[-47.663,230.000,-52.375]}},{"noteOn":{"time":49.740,"note":100.000,"xyz":[226.942,290.000,108.039]}},{"noteOn":{"time":49.745,"note":93.000,"xyz":[-257.712,206.000,-353.751]}},{"noteOn":{"time":49.800,"note":105.000,"xyz":[-55.636,350.000,427.451]}},{"noteOn":{"time":49.805,"note":98.000,"xyz":[-103.048,266.000,-385.765]}},{"noteOn":{"time":49.945,"note":102.000,"xyz":[8.995,314.000,67.432]}},{"noteOn":{"time":50.155,"note":98.000,"xyz":[450.494,266.000,123.351]}},{"noteOn":{"time":50.195,"note":90.000,"xyz":[-368.783,170.000,-72.393]}},{"noteOn":{"time":50.555,"note":90.000,"xyz":[137.614,170.000,-120.226]}},{"noteOn":{"time":50.565,"note":98.000,"xyz":[-21.226,266.000,-301.891]}},{"noteOn":{"time":50.675,"note":96.000,"xyz":[374.184,242.000,-235.772]}},{"noteOn":{"time":50.710,"note":102.000,"xyz":[-4.491,314.000,324.620]}},{"noteOn":{"time":50.775,"note":98.000,"xyz":[-6.665,266.000,-168.144]}},{"noteOn":{"time":50.915,"note":93.000,"xyz":[-359.939,206.000,42.926]}},{"noteOn":{"time":50.990,"note":102.000,"xyz":[-203.882,314.000,243.076]}},{"noteOn":{"time":51.240,"note":92.000,"xyz":[-99.887,194.000,396.924]}},{"noteOn":{"time":51.450,"note":96.000,"xyz":[405.639,242.000,-52.531]}},{"noteOn":{"time":51.475,"note":95.000,"xyz":[361.579,230.000,-328.211]}},{"noteOn":{"time":51.475,"note":100.000,"xyz":[0.465,290.000,-58.826]}},{"noteOn":{"time":51.480,"note":100.000,"xyz":[177.688,290.000,76.459]}},{"noteOn":{"time":51.630,"note":102.000,"xyz":[-233.759,314.000,282.883]}},{"noteOn":{"time":51.825,"note":90.000,"xyz":[-137.281,170.000,164.728]}},{"noteOn":{"time":51.880,"note":100.000,"xyz":[-189.058,290.000,263.641]}},{"noteOn":{"time":52.060,"note":98.000,"xyz":[-291.364,266.000,4.231]}},{"noteOn":{"time":52.120,"note":97.000,"xyz":[77.966,254.000,167.862]}},{"noteOn":{"time":52.190,"note":96.000,"xyz":[16.770,242.000,133.508]}},{"noteOn":{"time":52.370,"note":88.000,"xyz":[13.550,146.000,-135.494]}},{"noteOn":{"time":52.410,"note":104.000,"xyz":[-227.553,338.000,138.877]}},{"noteOn":{"time":52.420,"note":98.000,"xyz":[45.326,266.000,83.153]}},{"noteOn":{"time":52.430,"note":104.000,"xyz":[-189.539,338.000,269.327]}},{"noteOn":{"time":52.475,"note":100.000,"xyz":[101.229,290.000,-84.001]}},{"noteOn":{"time":52.740,"note":96.000,"xyz":[-52.765,242.000,4.399]}},{"noteOn":{"time":52.835,"note":98.000,"xyz":[-29.472,266.000,285.797]}},{"noteOn":{"time":52.890,"note":95.000,"xyz":[-80.564,230.000,227.980]}},{"noteOn":{"time":52.935,"note":106.000,"xyz":[126.609,362.000,-265.327]}},{"noteOn":{"time":53.010,"note":94.000,"xyz":[-6.820,218.000,-59.403]}},{"noteOn":{"time":53.090,"note":98.000,"xyz":[-71.514,266.000,215.474]}},{"noteOn":{"time":53.215,"note":96.000,"xyz":[56.931,242.000,-18.225]}},{"noteOn":{"time":53.220,"note":102.000,"xyz":[-441.225,314.000,-224.144]}},{"noteOn":{"time":53.560,"note":99.000,"xyz":[329.061,278.000,-321.966]}},{"noteOn":{"time":53.570,"note":101.000,"xyz":[-8.175,302.000,-234.238]}},{"noteOn":{"time":53.585,"note":96.000,"xyz":[0.947,242.000,259.159]}},{"noteOn":{"time":53.780,"note":90.000,"xyz":[-10.451,170.000,449.876]}},{"noteOn":{"time":53.870,"note":106.000,"xyz":[-260.965,362.000,-61.024]}},{"noteOn":{"time":53.875,"note":96.000,"xyz":[312.198,242.000,77.218]}},{"noteOn":{"time":53.995,"note":96.000,"xyz":[116.875,242.000,108.909]}},{"noteOn":{"time":54.195,"note":94.000,"xyz":[-136.142,218.000,-480.976]}},{"noteOn":{"time":54.240,"note":101.000,"xyz":[117.817,302.000,-32.457]}},{"noteOn":{"time":54.335,"note":97.000,"xyz":[81.797,254.000,-466.676]}},{"noteOn":{"time":54.375,"note":104.000,"xyz":[-25.317,338.000,-153.761]}},{"noteOn":{"time":54.475,"note":103.000,"xyz":[-43.274,326.000,98.173]}},{"noteOn":{"time":54.745,"note":90.000,"xyz":[230.488,170.000,255.423]}},{"noteOn":{"time":54.755,"note":98.000,"xyz":[-102.381,266.000,-128.922]}},{"noteOn":{"time":54.910,"note":94.000,"xyz":[349.141,218.000,51.991]}},{"noteOn":{"time":54.915,"note":94.000,"xyz":[110.467,218.000,277.311]}},{"noteOn":{"time":55.015,"note":98.000,"xyz":[-121.724,266.000,-361.390]}},{"noteOn":{"time":55.065,"note":91.000,"xyz":[-36.197,182.000,46.693]}},{"noteOn":{"time":55.265,"note":95.000,"xyz":[319.517,230.000,3.151]}},{"noteOn":{"time":55.370,"note":97.000,"xyz":[-175.391,254.000,-232.871]}},{"noteOn":{"time":55.435,"note":102.000,"xyz":[21.127,314.000,-374.245]}},{"noteOn":{"time":55.470,"note":93.000,"xyz":[298.043,206.000,-303.685]}},{"noteOn":{"time":55.655,"note":96.000,"xyz":[12.022,242.000,151.292]}},{"noteOn":{"time":55.735,"note":93.000,"xyz":[318.619,206.000,200.485]}},{"noteOn":{"time":55.805,"note":101.000,"xyz":[238.400,302.000,-389.825]}},{"noteOn":{"time":55.860,"note":102.000,"xyz":[-92.041,314.000,410.136]}},{"noteOn":{"time":56.050,"note":96.000,"xyz":[-0.417,242.000,-173.953]}},{"noteOn":{"time":56.090,"note":95.000,"xyz":[-188.871,230.000,-143.915]}},{"noteOn":{"time":56.165,"note":103.000,"xyz":[61.997,326.000,-94.004]}},{"noteOn":{"time":56.170,"note":99.000,"xyz":[-212.028,278.000,-106.741]}},{"noteOn":{"time":56.215,"note":89.000,"xyz":[-204.689,158.000,10.623]}},{"noteOn":{"time":56.545,"note":99.000,"xyz":[-125.258,278.000,-153.172]}},{"noteOn":{"time":56.565,"note":97.000,"xyz":[-72.777,254.000,112.285]}},{"noteOn":{"time":56.715,"note":96.000,"xyz":[64.318,242.000,-264.679]}},{"noteOn":{"time":56.740,"note":97.000,"xyz":[-422.607,254.000,58.565]}},{"noteOn":{"time":56.785,"note":97.000,"xyz":[-208.159,254.000,296.685]}},{"noteOn":{"time":56.835,"note":89.000,"xyz":[432.529,158.000,243.652]}},{"noteOn":{"time":56.880,"note":105.000,"xyz":[217.069,350.000,-83.946]}},{"noteOn":{"time":56.885,"note":103.000,"xyz":[-116.847,326.000,-208.495]}},{"noteOn":{"time":57.235,"note":95.000,"xyz":[431.955,230.000,-25.897]}},{"noteOn":{"time":57.385,"note":99.000,"xyz":[-308.029,278.000,-18.860]}},{"noteOn":{"time":57.435,"note":95.000,"xyz":[318.320,230.000,276.116]}},{"noteOn":{"time":57.465,"note":94.000,"xyz":[212.741,218.000,-159.850]}},{"noteOn":{"time":57.465,"note":101.000,"xyz":[-77.647,302.000,-61.046]}},{"noteOn":{"time":57.530,"note":107.000,"xyz":[98.227,374.000,30.194]}},{"noteOn":{"time":57.635,"note":97.000,"xyz":[357.471,254.000,-153.734]}},{"noteOn":{"time":57.660,"note":95.000,"xyz":[186.580,230.000,-79.990]}},{"noteOn":{"time":58.065,"note":97.000,"xyz":[-153.130,254.000,-189.674]}},{"noteOn":{"time":58.070,"note":99.000,"xyz":[-361.975,278.000,231.712]}},{"noteOn":{"time":58.125,"note":103.000,"xyz":[-42.558,326.000,76.998]}},{"noteOn":{"time":58.125,"note":102.000,"xyz":[-250.409,314.000,268.255]}},{"noteOn":{"time":58.375,"note":89.000,"xyz":[-90.048,158.000,-185.758]}},{"noteOn":{"time":58.435,"note":105.000,"xyz":[-351.400,350.000,-334.154]}},{"noteOn":{"time":58.440,"note":97.000,"xyz":[-414.704,254.000,-112.823]}},{"noteOn":{"time":58.615,"note":95.000,"xyz":[-407.070,230.000,130.214]}},{"noteOn":{"time":58.735,"note":102.000,"xyz":[131.972,314.000,83.690]}},{"noteOn":{"time":58.870,"note":97.000,"xyz":[110.787,254.000,-31.905]}},{"noteOn":{"time":59.015,"note":93.000,"xyz":[23.874,206.000,218.128]}},{"noteOn":{"time":59.055,"note":102.000,"xyz":[119.777,314.000,-162.596]}},{"noteOn":{"time":59.060,"note":103.000,"xyz":[54.703,326.000,-77.336]}},{"noteOn":{"time":59.295,"note":91.000,"xyz":[18.699,182.000,146.578]}},{"noteOn":{"time":59.405,"note":99.000,"xyz":[-370.489,278.000,-253.496]}},{"noteOn":{"time":59.455,"note":95.000,"xyz":[209.431,230.000,45.110]}},{"noteOn":{"time":59.570,"note":92.000,"xyz":[-329.685,194.000,-117.621]}},{"noteOn":{"time":59.585,"note":99.000,"xyz":[385.402,278.000,-200.829]}},{"noteOn":{"time":59.640,"note":95.000,"xyz":[332.710,230.000,327.703]}},{"noteOn":{"time":59.855,"note":94.000,"xyz":[99.063,218.000,-362.818]}},{"noteOn":{"time":59.870,"note":105.000,"xyz":[-64.122,350.000,128.390]}},{"noteOn":{"time":59.930,"note":101.000,"xyz":[-342.626,302.000,141.684]}},{"noteOn":{"time":59.965,"note":97.000,"xyz":[9.582,254.000,106.715]}},{"noteOn":{"time":60.040,"note":94.000,"xyz":[-57.919,218.000,-77.398]}},{"noteOn":{"time":60.115,"note":97.000,"xyz":[340.108,254.000,79.111]}},{"noteOn":{"time":60.235,"note":94.000,"xyz":[-309.016,218.000,117.111]}},{"noteOn":{"time":60.250,"note":101.000,"xyz":[-42.554,302.000,199.680]}},{"noteOn":{"time":60.470,"note":103.000,"xyz":[158.846,326.000,149.350]}},{"noteOn":{"time":60.505,"note":101.000,"xyz":[221.199,302.000,-80.968]}},{"noteOn":{"time":60.510,"note":99.000,"xyz":[273.869,278.000,228.560]}},{"noteOn":{"time":60.635,"note":89.000,"xyz":[12.053,158.000,-250.932]}},{"noteOn":{"time":60.640,"note":96.000,"xyz":[40.352,242.000,381.842]}},{"noteOn":{"time":60.695,"note":104.000,"xyz":[278.984,338.000,-156.406]}},{"noteOn":{"time":60.730,"note":95.000,"xyz":[-58.288,230.000,-67.177]}},{"noteOn":{"time":61.065,"note":97.000,"xyz":[-370.137,254.000,-150.788]}},{"noteOn":{"time":61.075,"note":96.000,"xyz":[-251.299,242.000,-165.305]}},{"noteOn":{"time":61.100,"note":99.000,"xyz":[249.249,278.000,388.097]}},{"noteOn":{"time":61.330,"note":96.000,"xyz":[-25.670,242.000,-80.703]}},{"noteOn":{"time":61.335,"note":89.000,"xyz":[-84.611,158.000,335.300]}},{"noteOn":{"time":61.340,"note":103.000,"xyz":[-193.803,326.000,67.631]}},{"noteOn":{"time":61.365,"note":102.000,"xyz":[-385.045,314.000,-151.828]}},{"noteOn":{"time":61.370,"note":105.000,"xyz":[-224.680,350.000,-190.311]}},{"noteOn":{"time":61.375,"note":98.000,"xyz":[-223.945,266.000,161.939]}},{"noteOn":{"time":61.730,"note":94.000,"xyz":[111.952,218.000,-45.180]}},{"noteOn":{"time":61.875,"note":96.000,"xyz":[209.924,242.000,-450.297]}},{"noteOn":{"time":61.935,"note":101.000,"xyz":[49.649,302.000,99.803]}},{"noteOn":{"time":61.935,"note":100.000,"xyz":[-63.108,290.000,-45.932]}},{"noteOn":{"time":62.000,"note":105.000,"xyz":[22.282,350.000,-79.366]}},{"noteOn":{"time":62.025,"note":94.000,"xyz":[234.605,218.000,-22.669]}},{"noteOn":{"time":62.055,"note":93.000,"xyz":[-26.943,206.000,-185.267]}},{"noteOn":{"time":62.175,"note":106.000,"xyz":[107.233,362.000,-204.621]}},{"noteOn":{"time":62.215,"note":96.000,"xyz":[-274.436,242.000,28.492]}},{"noteOn":{"time":62.500,"note":104.000,"xyz":[-17.761,338.000,458.519]}},{"noteOn":{"time":62.560,"note":98.000,"xyz":[-363.307,266.000,98.772]}},{"noteOn":{"time":62.575,"note":100.000,"xyz":[-79.900,290.000,20.682]}},{"noteOn":{"time":62.695,"note":103.000,"xyz":[419.997,326.000,-148.941]}},{"noteOn":{"time":62.810,"note":96.000,"xyz":[-203.820,242.000,-50.670]}},{"noteOn":{"time":62.905,"note":90.000,"xyz":[245.777,170.000,192.062]}},{"noteOn":{"time":62.920,"note":104.000,"xyz":[-260.517,338.000,128.054]}},{"noteOn":{"time":62.930,"note":98.000,"xyz":[-362.040,266.000,1.733]}},{"noteOn":{"time":63.155,"note":94.000,"xyz":[-123.216,218.000,228.410]}},{"noteOn":{"time":63.230,"note":102.000,"xyz":[-362.687,314.000,336.193]}},{"noteOn":{"time":63.305,"note":94.000,"xyz":[-54.803,218.000,26.963]}},{"noteOn":{"time":63.420,"note":96.000,"xyz":[219.555,242.000,54.875]}},{"noteOn":{"time":63.535,"note":98.000,"xyz":[20.857,266.000,-52.753]}},{"noteOn":{"time":63.645,"note":101.000,"xyz":[-403.559,302.000,135.685]}},{"noteOn":{"time":63.670,"note":102.000,"xyz":[-241.210,314.000,181.463]}},{"noteOn":{"time":63.745,"note":100.000,"xyz":[-121.324,290.000,21.576]}},{"noteOn":{"time":63.780,"note":92.000,"xyz":[-254.173,194.000,-74.246]}},{"noteOn":{"time":63.845,"note":96.000,"xyz":[-228.437,242.000,-132.141]}},{"noteOn":{"time":63.920,"note":96.000,"xyz":[125.781,242.000,75.675]}},{"noteOn":{"time":64.080,"note":92.000,"xyz":[262.773,194.000,-100.011]}},{"noteOn":{"time":64.270,"note":100.000,"xyz":[-182.230,290.000,-440.585]}},{"noteOn":{"time":64.280,"note":104.000,"xyz":[-302.378,338.000,-379.087]}},{"noteOn":{"time":64.375,"note":100.000,"xyz":[-397.257,290.000,-107.712]}},{"noteOn":{"time":64.385,"note":94.000,"xyz":[58.206,218.000,153.080]}},{"noteOn":{"time":64.495,"note":96.000,"xyz":[54.082,242.000,185.252]}},{"noteOn":{"time":64.505,"note":98.000,"xyz":[-199.739,266.000,-57.046]}},{"noteOn":{"time":64.610,"note":95.000,"xyz":[73.383,230.000,144.420]}},{"noteOn":{"time":64.620,"note":100.000,"xyz":[151.679,290.000,-462.283]}},{"noteOn":{"time":64.730,"note":95.000,"xyz":[130.074,230.000,-42.444]}},{"noteOn":{"time":64.815,"note":102.000,"xyz":[-344.936,314.000,207.427]}},{"noteOn":{"time":64.950,"note":98.000,"xyz":[67.080,266.000,-65.616]}},{"noteOn":{"time":65.065,"note":102.000,"xyz":[158.497,314.000,462.098]}},{"noteOn":{"time":65.100,"note":88.000,"xyz":[-467.020,146.000,158.777]}},{"noteOn":{"time":65.130,"note":98.000,"xyz":[-41.227,266.000,-256.351]}},{"noteOn":{"time":65.175,"note":104.000,"xyz":[-406.219,338.000,-254.454]}},{"noteOn":{"time":65.235,"note":97.000,"xyz":[298.857,254.000,-136.136]}},{"noteOn":{"time":65.305,"note":94.000,"xyz":[355.018,218.000,292.487]}},{"noteOn":{"time":65.510,"note":96.000,"xyz":[-265.790,242.000,271.589]}},{"noteOn":{"time":65.585,"note":95.000,"xyz":[-83.840,230.000,372.419]}},{"noteOn":{"time":65.750,"note":104.000,"xyz":[-52.651,338.000,35.182]}},{"noteOn":{"time":65.790,"note":101.000,"xyz":[65.519,302.000,-268.987]}},{"noteOn":{"time":65.875,"note":102.000,"xyz":[-5.892,314.000,-222.821]}},{"noteOn":{"time":65.880,"note":90.000,"xyz":[186.782,170.000,413.665]}},{"noteOn":{"time":65.905,"note":98.000,"xyz":[205.368,266.000,-69.185]}},{"noteOn":{"time":65.935,"note":106.000,"xyz":[-250.107,362.000,15.293]}},{"noteOn":{"time":65.945,"note":95.000,"xyz":[-277.252,230.000,-154.648]}},{"noteOn":{"time":66.230,"note":93.000,"xyz":[25.231,206.000,471.970]}},{"noteOn":{"time":66.350,"note":94.000,"xyz":[-21.439,218.000,337.528]}},{"noteOn":{"time":66.350,"note":97.000,"xyz":[14.186,254.000,314.577]}},{"noteOn":{"time":66.395,"note":104.000,"xyz":[-171.398,338.000,394.623]}},{"noteOn":{"time":66.420,"note":101.000,"xyz":[-131.427,302.000,-162.478]}},{"noteOn":{"time":66.595,"note":106.000,"xyz":[-269.035,362.000,-64.773]}},{"noteOn":{"time":66.650,"note":93.000,"xyz":[110.958,206.000,37.306]}},{"noteOn":{"time":66.835,"note":96.000,"xyz":[159.450,242.000,-265.777]}},{"noteOn":{"time":66.890,"note":106.000,"xyz":[-47.429,362.000,85.392]}},{"noteOn":{"time":67.090,"note":101.000,"xyz":[-150.338,302.000,-424.421]}},{"noteOn":{"time":67.090,"note":99.000,"xyz":[78.012,278.000,-9.124]}},{"noteOn":{"time":67.110,"note":94.000,"xyz":[86.561,218.000,-168.999]}},{"noteOn":{"time":67.220,"note":96.000,"xyz":[-74.027,242.000,-398.273]}},{"noteOn":{"time":67.265,"note":102.000,"xyz":[-270.401,314.000,-336.995]}},{"noteOn":{"time":67.335,"note":103.000,"xyz":[169.317,326.000,-459.224]}},{"noteOn":{"time":67.345,"note":91.000,"xyz":[-398.214,182.000,218.215]}},{"noteOn":{"time":67.490,"note":99.000,"xyz":[-41.884,278.000,-261.898]}},{"noteOn":{"time":67.660,"note":97.000,"xyz":[148.256,254.000,52.158]}},{"noteOn":{"time":67.700,"note":93.000,"xyz":[226.568,206.000,43.103]}},{"noteOn":{"time":67.730,"note":101.000,"xyz":[262.467,302.000,-361.054]}},{"noteOn":{"time":68.010,"note":95.000,"xyz":[8.801,230.000,-60.113]}},{"noteOn":{"time":68.130,"note":98.000,"xyz":[-3.641,266.000,210.013]}},{"noteOn":{"time":68.150,"note":101.000,"xyz":[80.186,302.000,59.617]}},{"noteOn":{"time":68.175,"note":93.000,"xyz":[-287.318,206.000,284.026]}},{"noteOn":{"time":68.205,"note":101.000,"xyz":[-346.330,302.000,173.560]}},{"noteOn":{"time":68.235,"note":100.000,"xyz":[350.920,290.000,-291.501]}},{"noteOn":{"time":68.350,"note":99.000,"xyz":[-7.114,278.000,155.555]}},{"noteOn":{"time":68.385,"note":97.000,"xyz":[28.684,254.000,-179.179]}},{"noteOn":{"time":68.590,"note":93.000,"xyz":[-84.338,206.000,-369.363]}},{"noteOn":{"time":68.690,"note":103.000,"xyz":[-186.623,326.000,109.505]}},{"noteOn":{"time":68.890,"note":99.000,"xyz":[44.027,278.000,-125.850]}},{"noteOn":{"time":68.915,"note":93.000,"xyz":[-292.370,206.000,-41.276]}},{"noteOn":{"time":68.930,"note":97.000,"xyz":[-32.065,254.000,-43.508]}},{"noteOn":{"time":68.930,"note":101.000,"xyz":[376.287,302.000,-304.413]}},{"noteOn":{"time":68.935,"note":95.000,"xyz":[-73.757,230.000,-93.627]}},{"noteOn":{"time":68.935,"note":99.000,"xyz":[-333.821,278.000,155.233]}},{"noteOn":{"time":69.180,"note":96.000,"xyz":[126.792,242.000,-399.607]}},{"noteOn":{"time":69.230,"note":95.000,"xyz":[-392.818,230.000,167.639]}},{"noteOn":{"time":69.505,"note":103.000,"xyz":[48.410,326.000,-437.587]}},{"noteOn":{"time":69.570,"note":89.000,"xyz":[88.417,158.000,-187.020]}},{"noteOn":{"time":69.585,"note":103.000,"xyz":[-175.323,326.000,369.846]}},{"noteOn":{"time":69.650,"note":103.000,"xyz":[-315.756,326.000,-216.856]}},{"noteOn":{"time":69.665,"note":97.000,"xyz":[354.092,254.000,145.627]}},{"noteOn":{"time":69.665,"note":101.000,"xyz":[130.506,302.000,-5.545]}},{"noteOn":{"time":69.785,"note":93.000,"xyz":[58.588,206.000,-19.363]}},{"noteOn":{"time":69.825,"note":98.000,"xyz":[47.355,266.000,-65.651]}},{"noteOn":{"time":70.075,"note":95.000,"xyz":[190.993,230.000,-48.392]}},{"noteOn":{"time":70.095,"note":95.000,"xyz":[160.406,230.000,37.250]}},{"noteOn":{"time":70.170,"note":105.000,"xyz":[66.427,350.000,402.526]}},{"noteOn":{"time":70.195,"note":105.000,"xyz":[-64.712,350.000,329.087]}},{"noteOn":{"time":70.210,"note":101.000,"xyz":[-173.364,302.000,-37.978]}},{"noteOn":{"time":70.245,"note":107.000,"xyz":[-57.248,374.000,186.951]}},{"noteOn":{"time":70.345,"note":99.000,"xyz":[65.779,278.000,-335.888]}},{"noteOn":{"time":70.425,"note":91.000,"xyz":[-458.481,182.000,90.954]}},{"noteOn":{"time":70.495,"note":107.000,"xyz":[-104.873,374.000,-79.563]}},{"noteOn":{"time":70.555,"note":94.000,"xyz":[-154.002,218.000,-161.873]}},{"noteOn":{"time":70.730,"note":92.000,"xyz":[-36.205,194.000,66.651]}},{"noteOn":{"time":70.795,"note":95.000,"xyz":[92.569,230.000,19.692]}},{"noteOn":{"time":70.825,"note":95.000,"xyz":[61.130,230.000,5.789]}},{"noteOn":{"time":70.830,"note":98.000,"xyz":[-297.312,266.000,-15.941]}},{"noteOn":{"time":70.875,"note":101.000,"xyz":[228.472,302.000,258.417]}},{"noteOn":{"time":71.005,"note":105.000,"xyz":[220.122,350.000,115.495]}},{"noteOn":{"time":71.135,"note":107.000,"xyz":[410.235,374.000,-109.832]}},{"noteOn":{"time":71.235,"note":92.000,"xyz":[250.646,194.000,-282.907]}},{"noteOn":{"time":71.380,"note":105.000,"xyz":[-442.251,350.000,-108.373]}},{"noteOn":{"time":71.390,"note":95.000,"xyz":[-258.817,230.000,-254.311]}},{"noteOn":{"time":71.460,"note":97.000,"xyz":[-227.265,254.000,209.699]}},{"noteOn":{"time":71.600,"note":102.000,"xyz":[-111.912,314.000,-228.999]}},{"noteOn":{"time":71.625,"note":100.000,"xyz":[-3.149,290.000,93.607]}},{"noteOn":{"time":71.645,"note":103.000,"xyz":[28.913,326.000,-307.922]}},{"noteOn":{"time":71.660,"note":103.000,"xyz":[-265.418,326.000,174.916]}},{"noteOn":{"time":71.700,"note":97.000,"xyz":[2.990,254.000,-97.528]}},{"noteOn":{"time":71.755,"note":91.000,"xyz":[-156.279,182.000,53.504]}},{"noteOn":{"time":71.835,"note":102.000,"xyz":[-275.907,314.000,142.238]}},{"noteOn":{"time":71.935,"note":99.000,"xyz":[-98.650,278.000,-472.774]}},{"noteOn":{"time":72.060,"note":98.000,"xyz":[109.313,266.000,-482.806]}},{"noteOn":{"time":72.175,"note":93.000,"xyz":[24.705,206.000,147.265]}},{"noteOn":{"time":72.230,"note":100.000,"xyz":[178.724,290.000,333.522]}},{"noteOn":{"time":72.440,"note":101.000,"xyz":[73.404,302.000,-231.747]}},{"noteOn":{"time":72.540,"note":94.000,"xyz":[-242.499,218.000,-391.173]}},{"noteOn":{"time":72.595,"note":94.000,"xyz":[96.434,218.000,-22.895]}},{"noteOn":{"time":72.605,"note":99.000,"xyz":[-287.240,278.000,-227.400]}},{"noteOn":{"time":72.630,"note":106.000,"xyz":[91.375,362.000,46.036]}},{"noteOn":{"time":72.650,"note":101.000,"xyz":[61.282,302.000,-318.322]}},{"noteOn":{"time":72.730,"note":96.000,"xyz":[97.908,242.000,94.707]}},{"noteOn":{"time":72.785,"note":97.000,"xyz":[-128.533,254.000,-327.750]}},{"noteOn":{"time":72.825,"note":100.000,"xyz":[106.697,290.000,17.962]}},{"noteOn":{"time":73.105,"note":94.000,"xyz":[-53.744,218.000,213.607]}},{"noteOn":{"time":73.235,"note":103.000,"xyz":[19.457,326.000,-126.408]}},{"noteOn":{"time":73.295,"note":104.000,"xyz":[19.500,338.000,52.370]}},{"noteOn":{"time":73.345,"note":94.000,"xyz":[336.844,218.000,222.298]}},{"noteOn":{"time":73.355,"note":100.000,"xyz":[-127.424,290.000,-27.164]}},{"noteOn":{"time":73.380,"note":98.000,"xyz":[-64.590,266.000,-327.469]}},{"noteOn":{"time":73.450,"note":92.000,"xyz":[-56.511,194.000,-39.273]}},{"noteOn":{"time":73.495,"note":102.000,"xyz":[294.324,314.000,110.101]}},{"noteOn":{"time":73.525,"note":98.000,"xyz":[59.869,266.000,-289.798]}},{"noteOn":{"time":73.730,"note":96.000,"xyz":[-118.067,242.000,45.656]}},{"noteOn":{"time":73.750,"note":97.000,"xyz":[-21.555,254.000,203.919]}},{"noteOn":{"time":73.995,"note":104.000,"xyz":[-150.690,338.000,279.107]}},{"noteOn":{"time":74.075,"note":100.000,"xyz":[-54.043,290.000,1.325]}},{"noteOn":{"time":74.110,"note":90.000,"xyz":[-103.807,170.000,123.282]}},{"noteOn":{"time":74.130,"note":102.000,"xyz":[148.414,314.000,98.990]}},{"noteOn":{"time":74.190,"note":104.000,"xyz":[92.340,338.000,174.619]}},{"noteOn":{"time":74.245,"note":92.000,"xyz":[108.787,194.000,398.374]}},{"noteOn":{"time":74.250,"note":98.000,"xyz":[61.947,266.000,102.908]}},{"noteOn":{"time":74.265,"note":96.000,"xyz":[-296.047,242.000,273.278]}},{"noteOn":{"time":74.415,"note":99.000,"xyz":[-39.004,278.000,-33.220]}},{"noteOn":{"time":74.535,"note":96.000,"xyz":[-237.928,242.000,-314.527]}},{"noteOn":{"time":74.605,"note":94.000,"xyz":[103.661,218.000,260.378]}},{"noteOn":{"time":74.635,"note":100.000,"xyz":[165.922,290.000,-82.889]}},{"noteOn":{"time":74.740,"note":94.000,"xyz":[-451.113,218.000,72.471]}},{"noteOn":{"time":74.755,"note":100.000,"xyz":[163.483,290.000,-298.163]}},{"noteOn":{"time":74.770,"note":106.000,"xyz":[49.758,362.000,-207.480]}},{"noteOn":{"time":74.940,"note":106.000,"xyz":[-9.636,362.000,-469.594]}},{"noteOn":{"time":75.045,"note":92.000,"xyz":[388.004,194.000,308.569]}},{"noteOn":{"time":75.090,"note":106.000,"xyz":[-62.410,362.000,81.799]}},{"noteOn":{"time":75.165,"note":93.000,"xyz":[130.274,206.000,429.159]}},{"noteOn":{"time":75.230,"note":92.000,"xyz":[-487.586,194.000,101.858]}},{"noteOn":{"time":75.260,"note":98.000,"xyz":[142.406,266.000,-48.324]}},{"noteOn":{"time":75.305,"note":98.000,"xyz":[85.099,266.000,-65.265]}},{"noteOn":{"time":75.335,"note":100.000,"xyz":[-301.268,290.000,-79.539]}},{"noteOn":{"time":75.340,"note":96.000,"xyz":[-158.736,242.000,120.784]}},{"noteOn":{"time":75.545,"note":108.000,"xyz":[77.510,386.000,24.544]}},{"noteOn":{"time":75.630,"note":104.000,"xyz":[-58.570,338.000,-129.011]}},{"noteOn":{"time":75.675,"note":104.000,"xyz":[39.588,338.000,-71.881]}},{"noteOn":{"time":75.770,"note":98.000,"xyz":[-9.081,266.000,-94.300]}},{"noteOn":{"time":75.825,"note":91.000,"xyz":[-195.080,182.000,143.225]}},{"noteOn":{"time":75.930,"note":94.000,"xyz":[-458.493,218.000,-49.351]}},{"noteOn":{"time":76.085,"note":102.000,"xyz":[-70.684,314.000,296.435]}},{"noteOn":{"time":76.110,"note":101.000,"xyz":[-177.068,302.000,199.912]}},{"noteOn":{"time":76.155,"note":100.000,"xyz":[358.015,290.000,267.063]}},{"noteOn":{"time":76.170,"note":92.000,"xyz":[473.905,194.000,-73.217]}},{"noteOn":{"time":76.215,"note":104.000,"xyz":[-171.996,338.000,-185.658]}},{"noteOn":{"time":76.300,"note":98.000,"xyz":[-91.490,266.000,-108.577]}},{"noteOn":{"time":76.385,"note":100.000,"xyz":[-221.695,290.000,197.313]}},{"noteOn":{"time":76.400,"note":101.000,"xyz":[325.898,302.000,-281.953]}},{"noteOn":{"time":76.530,"note":96.000,"xyz":[376.947,242.000,147.283]}},{"noteOn":{"time":76.640,"note":92.000,"xyz":[-456.844,194.000,-176.718]}},{"noteOn":{"time":76.730,"note":99.000,"xyz":[-14.471,278.000,320.225]}},{"noteOn":{"time":76.910,"note":94.000,"xyz":[-284.589,218.000,-384.476]}},{"noteOn":{"time":76.975,"note":100.000,"xyz":[-432.831,290.000,-87.717]}},{"noteOn":{"time":77.010,"note":106.000,"xyz":[-309.312,362.000,165.468]}},{"noteOn":{"time":77.015,"note":100.000,"xyz":[258.645,290.000,-181.733]}},{"noteOn":{"time":77.035,"note":102.000,"xyz":[61.021,314.000,-47.194]}},{"noteOn":{"time":77.050,"note":105.000,"xyz":[-14.011,350.000,-201.101]}},{"noteOn":{"time":77.130,"note":93.000,"xyz":[-24.292,206.000,73.576]}},{"noteOn":{"time":77.170,"note":98.000,"xyz":[358.079,266.000,-228.338]}},{"noteOn":{"time":77.390,"note":99.000,"xyz":[-14.677,278.000,-418.245]}},{"noteOn":{"time":77.610,"note":95.000,"xyz":[239.722,230.000,75.559]}},{"noteOn":{"time":77.690,"note":98.000,"xyz":[-438.939,266.000,-123.849]}},{"noteOn":{"time":77.760,"note":93.000,"xyz":[-83.017,206.000,99.176]}},{"noteOn":{"time":77.820,"note":100.000,"xyz":[454.992,290.000,67.131]}},{"noteOn":{"time":77.835,"note":103.000,"xyz":[41.183,326.000,-56.309]}},{"noteOn":{"time":77.835,"note":102.000,"xyz":[117.918,314.000,-24.450]}},{"noteOn":{"time":77.930,"note":93.000,"xyz":[-244.261,206.000,-164.827]}},{"noteOn":{"time":77.935,"note":102.000,"xyz":[-75.901,314.000,-42.812]}},{"noteOn":{"time":77.945,"note":98.000,"xyz":[-305.266,266.000,336.868]}},{"noteOn":{"time":78.225,"note":97.000,"xyz":[-137.679,254.000,248.533]}},{"noteOn":{"time":78.290,"note":97.000,"xyz":[386.993,254.000,128.473]}},{"noteOn":{"time":78.385,"note":97.000,"xyz":[-189.716,254.000,-135.236]}},{"noteOn":{"time":78.485,"note":100.000,"xyz":[314.237,290.000,-63.045]}},{"noteOn":{"time":78.555,"note":101.000,"xyz":[40.423,302.000,-334.028]}},{"noteOn":{"time":78.635,"note":99.000,"xyz":[-96.908,278.000,34.325]}},{"noteOn":{"time":78.650,"note":91.000,"xyz":[-437.610,182.000,43.421]}},{"noteOn":{"time":78.700,"note":91.000,"xyz":[409.902,182.000,-225.482]}},{"noteOn":{"time":78.755,"note":105.000,"xyz":[46.368,350.000,-244.543]}},{"noteOn":{"time":78.905,"note":95.000,"xyz":[237.954,230.000,-321.920]}},{"noteOn":{"time":78.975,"note":100.000,"xyz":[340.012,290.000,-77.234]}},{"noteOn":{"time":79.110,"note":99.000,"xyz":[-412.258,278.000,-52.228]}},{"noteOn":{"time":79.115,"note":93.000,"xyz":[-329.032,206.000,312.404]}},{"noteOn":{"time":79.195,"note":99.000,"xyz":[-60.131,278.000,179.051]}},{"noteOn":{"time":79.235,"note":101.000,"xyz":[-388.363,302.000,209.814]}},{"noteOn":{"time":79.365,"note":106.000,"xyz":[-195.589,362.000,19.352]}},{"noteOn":{"time":79.430,"note":95.000,"xyz":[28.262,230.000,-133.204]}},{"noteOn":{"time":79.430,"note":105.000,"xyz":[246.957,350.000,-50.638]}},{"noteOn":{"time":79.570,"note":105.000,"xyz":[-282.743,350.000,-81.945]}},{"noteOn":{"time":79.640,"note":93.000,"xyz":[-305.110,206.000,-258.613]}},{"noteOn":{"time":79.725,"note":91.000,"xyz":[418.759,182.000,126.140]}},{"noteOn":{"time":79.750,"note":92.000,"xyz":[-361.499,194.000,89.731]}},{"noteOn":{"time":79.775,"note":97.000,"xyz":[285.059,254.000,158.011]}},{"noteOn":{"time":79.835,"note":99.000,"xyz":[47.376,278.000,-31.589]}},{"noteOn":{"time":79.855,"note":99.000,"xyz":[113.393,278.000,85.144]}},{"noteOn":{"time":79.955,"note":97.000,"xyz":[496.515,254.000,0.175]}},{"noteOn":{"time":79.955,"note":107.000,"xyz":[204.040,374.000,-111.957]}},{"noteOn":{"time":80.010,"note":103.000,"xyz":[-248.105,326.000,-65.466]}},{"noteOn":{"time":80.255,"note":103.000,"xyz":[-443.798,326.000,42.275]}},{"noteOn":{"time":80.390,"note":92.000,"xyz":[350.275,194.000,294.674]}},{"noteOn":{"time":80.450,"note":93.000,"xyz":[-257.364,206.000,-230.605]}},{"noteOn":{"time":80.575,"note":101.000,"xyz":[129.383,302.000,44.709]}},{"noteOn":{"time":80.615,"note":101.000,"xyz":[-240.608,302.000,63.221]}},{"noteOn":{"time":80.620,"note":95.000,"xyz":[3.198,230.000,352.960]}},{"noteOn":{"time":80.645,"note":93.000,"xyz":[89.574,206.000,65.984]}},{"noteOn":{"time":80.740,"note":101.000,"xyz":[-321.224,302.000,124.590]}},{"noteOn":{"time":80.875,"note":101.000,"xyz":[-259.751,302.000,208.586]}},{"noteOn":{"time":80.900,"note":99.000,"xyz":[-49.926,278.000,-13.363]}},{"noteOn":{"time":80.945,"note":100.000,"xyz":[494.436,290.000,37.091]}},{"noteOn":{"time":81.060,"note":105.000,"xyz":[-96.640,350.000,-60.577]}},{"noteOn":{"time":81.085,"note":91.000,"xyz":[-327.860,182.000,18.145]}},{"noteOn":{"time":81.225,"note":99.000,"xyz":[256.704,278.000,-363.061]}},{"noteOn":{"time":81.230,"note":105.000,"xyz":[-49.712,350.000,451.441]}},{"noteOn":{"time":81.340,"note":95.000,"xyz":[323.869,230.000,-19.368]}},{"noteOn":{"time":81.345,"note":99.000,"xyz":[72.485,278.000,119.448]}},{"noteOn":{"time":81.425,"note":101.000,"xyz":[-67.180,302.000,-69.956]}},{"noteOn":{"time":81.635,"note":99.000,"xyz":[363.700,278.000,2.888]}},{"noteOn":{"time":81.635,"note":107.000,"xyz":[77.156,374.000,-22.152]}},{"noteOn":{"time":81.665,"note":93.000,"xyz":[105.910,206.000,248.154]}},{"noteOn":{"time":81.680,"note":103.000,"xyz":[52.635,326.000,-329.898]}},{"noteOn":{"time":81.735,"note":109.000,"xyz":[-103.588,398.000,171.675]}},{"noteOn":{"time":81.910,"note":98.000,"xyz":[30.690,266.000,-74.747]}},{"noteOn":{"time":82.100,"note":102.000,"xyz":[-363.951,314.000,-3.839]}},{"noteOn":{"time":82.120,"note":96.000,"xyz":[-292.061,242.000,-11.957]}},{"noteOn":{"time":82.180,"note":97.000,"xyz":[28.489,254.000,-77.828]}},{"noteOn":{"time":82.235,"note":93.000,"xyz":[250.001,206.000,-96.900]}},{"noteOn":{"time":82.260,"note":103.000,"xyz":[-179.384,326.000,239.411]}},{"noteOn":{"time":82.365,"note":99.000,"xyz":[35.429,278.000,77.207]}},{"noteOn":{"time":82.410,"note":94.000,"xyz":[104.985,218.000,-66.699]}},{"noteOn":{"time":82.420,"note":101.000,"xyz":[-157.221,302.000,-47.074]}},{"noteOn":{"time":82.430,"note":97.000,"xyz":[-389.260,254.000,242.943]}},{"noteOn":{"time":82.620,"note":107.000,"xyz":[115.351,374.000,-218.962]}},{"noteOn":{"time":82.725,"note":98.000,"xyz":[-255.951,266.000,-158.149]}},{"noteOn":{"time":82.740,"note":98.000,"xyz":[277.372,266.000,-284.181]}},{"noteOn":{"time":82.790,"note":98.000,"xyz":[-263.599,266.000,-94.656]}},{"noteOn":{"time":82.960,"note":99.000,"xyz":[-85.823,278.000,-459.450]}},{"noteOn":{"time":82.980,"note":100.000,"xyz":[371.667,290.000,18.588]}},{"noteOn":{"time":83.015,"note":99.000,"xyz":[-82.614,278.000,116.229]}},{"noteOn":{"time":83.200,"note":105.000,"xyz":[-444.625,350.000,-21.367]}},{"noteOn":{"time":83.225,"note":91.000,"xyz":[-115.837,182.000,95.031]}},{"noteOn":{"time":83.245,"note":95.000,"xyz":[167.257,230.000,-133.651]}},{"noteOn":{"time":83.275,"note":91.000,"xyz":[63.697,182.000,139.334]}},{"noteOn":{"time":83.500,"note":100.000,"xyz":[255.964,290.000,-161.442]}},{"noteOn":{"time":83.530,"note":104.000,"xyz":[91.303,338.000,285.209]}},{"noteOn":{"time":83.585,"note":98.000,"xyz":[368.103,266.000,-127.537]}},{"noteOn":{"time":83.625,"note":92.000,"xyz":[-215.898,194.000,95.396]}},{"noteOn":{"time":83.640,"note":100.000,"xyz":[-370.684,290.000,50.036]}},{"noteOn":{"time":83.735,"note":104.000,"xyz":[-9.176,338.000,54.817]}},{"noteOn":{"time":83.800,"note":100.000,"xyz":[-38.762,290.000,-151.088]}},{"noteOn":{"time":83.875,"note":105.000,"xyz":[-188.479,350.000,389.994]}},{"noteOn":{"time":83.890,"note":107.000,"xyz":[-44.234,374.000,-61.404]}},{"noteOn":{"time":83.990,"note":95.000,"xyz":[-356.976,230.000,207.585]}},{"noteOn":{"time":84.185,"note":93.000,"xyz":[-378.729,206.000,-117.504]}},{"noteOn":{"time":84.220,"note":90.000,"xyz":[145.958,170.000,127.504]}},{"noteOn":{"time":84.230,"note":106.000,"xyz":[-55.741,362.000,-432.658]}},{"noteOn":{"time":84.295,"note":92.000,"xyz":[130.939,194.000,-466.733]}},{"noteOn":{"time":84.310,"note":96.000,"xyz":[391.148,242.000,-158.372]}},{"noteOn":{"time":84.370,"note":100.000,"xyz":[-167.534,290.000,270.929]}},{"noteOn":{"time":84.450,"note":102.000,"xyz":[-37.393,314.000,-442.484]}},{"noteOn":{"time":84.470,"note":98.000,"xyz":[-189.973,266.000,-1.028]}},{"noteOn":{"time":84.490,"note":107.000,"xyz":[-153.257,374.000,-34.996]}},{"noteOn":{"time":84.640,"note":98.000,"xyz":[-210.373,266.000,24.154]}},{"noteOn":{"time":84.640,"note":102.000,"xyz":[112.183,314.000,402.304]}},{"noteOn":{"time":84.740,"note":100.000,"xyz":[26.133,290.000,161.372]}},{"noteOn":{"time":84.915,"note":93.000,"xyz":[-204.501,206.000,386.983]}},{"noteOn":{"time":84.915,"note":92.000,"xyz":[-4.911,194.000,-249.299]}},{"noteOn":{"time":85.125,"note":100.000,"xyz":[-203.441,290.000,424.123]}},{"noteOn":{"time":85.140,"note":100.000,"xyz":[158.583,290.000,178.571]}},{"noteOn":{"time":85.210,"note":94.000,"xyz":[24.026,218.000,179.380]}},{"noteOn":{"time":85.240,"note":94.000,"xyz":[-38.028,218.000,-407.049]}},{"noteOn":{"time":85.325,"note":102.000,"xyz":[151.630,314.000,418.699]}},{"noteOn":{"time":85.360,"note":100.000,"xyz":[247.173,290.000,-119.276]}},{"noteOn":{"time":85.435,"note":102.000,"xyz":[-161.021,314.000,-132.862]}},{"noteOn":{"time":85.445,"note":99.000,"xyz":[-8.611,278.000,56.334]}},{"noteOn":{"time":85.460,"note":98.000,"xyz":[-31.149,266.000,-215.674]}},{"noteOn":{"time":85.470,"note":90.000,"xyz":[244.156,170.000,-45.136]}},{"noteOn":{"time":85.615,"note":106.000,"xyz":[-230.437,362.000,-242.398]}},{"noteOn":{"time":85.720,"note":98.000,"xyz":[335.006,266.000,-273.805]}},{"noteOn":{"time":85.790,"note":98.000,"xyz":[182.100,266.000,421.672]}},{"noteOn":{"time":85.865,"note":96.000,"xyz":[146.481,242.000,-455.274]}},{"noteOn":{"time":85.935,"note":104.000,"xyz":[383.637,338.000,14.486]}},{"noteOn":{"time":86.025,"note":102.000,"xyz":[-106.520,314.000,68.810]}},{"noteOn":{"time":86.095,"note":100.000,"xyz":[448.967,290.000,-165.415]}},{"noteOn":{"time":86.195,"note":92.000,"xyz":[-60.138,194.000,2.306]}},{"noteOn":{"time":86.260,"note":108.000,"xyz":[-0.661,386.000,85.533]}},{"noteOn":{"time":86.390,"note":108.000,"xyz":[411.257,386.000,100.026]}},{"noteOn":{"time":86.390,"note":97.000,"xyz":[69.847,254.000,-426.149]}},{"noteOn":{"time":86.395,"note":104.000,"xyz":[131.246,338.000,14.575]}},{"noteOn":{"time":86.585,"note":104.000,"xyz":[258.018,338.000,-267.039]}},{"noteOn":{"time":86.630,"note":96.000,"xyz":[87.685,242.000,52.724]}},{"noteOn":{"time":86.805,"note":92.000,"xyz":[-251.949,194.000,-187.861]}},{"noteOn":{"time":86.830,"note":100.000,"xyz":[203.751,290.000,94.330]}},{"noteOn":{"time":86.885,"note":94.000,"xyz":[-301.417,218.000,-77.199]}},{"noteOn":{"time":86.895,"note":102.000,"xyz":[-153.001,314.000,-38.597]}},{"noteOn":{"time":86.905,"note":98.000,"xyz":[-101.490,266.000,55.399]}},{"noteOn":{"time":86.995,"note":96.000,"xyz":[-334.810,242.000,-205.708]}},{"noteOn":{"time":87.025,"note":98.000,"xyz":[215.813,266.000,-394.484]}},{"noteOn":{"time":87.220,"note":99.000,"xyz":[52.463,278.000,-29.725]}},{"noteOn":{"time":87.250,"note":99.000,"xyz":[460.161,278.000,-187.488]}},{"noteOn":{"time":87.250,"note":106.000,"xyz":[147.703,362.000,365.875]}},{"noteOn":{"time":87.400,"note":100.000,"xyz":[63.367,290.000,41.177]}},{"noteOn":{"time":87.525,"note":106.000,"xyz":[17.122,362.000,-112.525]}},{"noteOn":{"time":87.555,"note":98.000,"xyz":[72.461,266.000,371.157]}},{"noteOn":{"time":87.620,"note":98.000,"xyz":[95.044,266.000,395.907]}},{"noteOn":{"time":87.640,"note":100.000,"xyz":[183.644,290.000,-55.140]}},{"noteOn":{"time":87.650,"note":96.000,"xyz":[-121.638,242.000,184.426]}},{"noteOn":{"time":87.775,"note":90.000,"xyz":[75.125,170.000,-364.638]}},{"noteOn":{"time":87.895,"note":92.000,"xyz":[-137.500,194.000,137.636]}},{"noteOn":{"time":87.905,"note":104.000,"xyz":[-98.986,338.000,240.710]}},{"noteOn":{"time":87.980,"note":101.000,"xyz":[104.663,302.000,-259.128]}},{"noteOn":{"time":88.060,"note":97.000,"xyz":[175.576,254.000,299.679]}},{"noteOn":{"time":88.135,"note":91.000,"xyz":[41.815,182.000,112.678]}},{"noteOn":{"time":88.145,"note":104.000,"xyz":[255.454,338.000,-176.158]}},{"noteOn":{"time":88.300,"note":108.000,"xyz":[142.216,386.000,52.818]}},{"noteOn":{"time":88.395,"note":100.000,"xyz":[-82.346,290.000,119.069]}},{"noteOn":{"time":88.435,"note":96.000,"xyz":[-97.360,242.000,9.430]}},{"noteOn":{"time":88.435,"note":104.000,"xyz":[184.178,338.000,-28.577]}},{"noteOn":{"time":88.465,"note":107.000,"xyz":[-230.230,374.000,223.774]}},{"noteOn":{"time":88.610,"note":101.000,"xyz":[-309.525,302.000,170.099]}},{"noteOn":{"time":88.720,"note":91.000,"xyz":[194.216,182.000,91.987]}},{"noteOn":{"time":88.725,"note":94.000,"xyz":[-96.053,218.000,-126.115]}},{"noteOn":{"time":88.800,"note":91.000,"xyz":[52.244,182.000,242.033]}},{"noteOn":{"time":88.895,"note":101.000,"xyz":[-281.391,302.000,75.709]}},{"noteOn":{"time":89.020,"note":102.000,"xyz":[204.419,314.000,-75.655]}},{"noteOn":{"time":89.085,"note":106.000,"xyz":[317.648,362.000,-319.201]}},{"noteOn":{"time":89.105,"note":97.000,"xyz":[-131.268,254.000,-282.906]}},{"noteOn":{"time":89.170,"note":102.000,"xyz":[-260.647,314.000,-22.160]}},{"noteOn":{"time":89.205,"note":98.000,"xyz":[-140.824,266.000,-194.121]}},{"noteOn":{"time":89.230,"note":99.000,"xyz":[-121.869,278.000,89.809]}},{"noteOn":{"time":89.365,"note":95.000,"xyz":[-61.077,230.000,-116.438]}},{"noteOn":{"time":89.380,"note":92.000,"xyz":[-87.131,194.000,288.231]}},{"noteOn":{"time":89.395,"note":93.000,"xyz":[-433.041,206.000,-49.656]}},{"noteOn":{"time":89.635,"note":99.000,"xyz":[100.150,278.000,0.189]}},{"noteOn":{"time":89.770,"note":100.000,"xyz":[137.890,290.000,-249.137]}},{"noteOn":{"time":89.775,"note":107.000,"xyz":[45.951,374.000,-276.943]}},{"noteOn":{"time":89.805,"note":95.000,"xyz":[122.203,230.000,-2.278]}},{"noteOn":{"time":89.825,"note":99.000,"xyz":[-0.863,278.000,260.494]}},{"noteOn":{"time":89.885,"note":103.000,"xyz":[-103.417,326.000,-73.751]}},{"noteOn":{"time":89.905,"note":99.000,"xyz":[-78.743,278.000,-86.261]}},{"noteOn":{"time":89.905,"note":89.000,"xyz":[-30.572,158.000,479.496]}},{"noteOn":{"time":89.995,"note":103.000,"xyz":[-415.805,326.000,-247.185]}},{"noteOn":{"time":90.205,"note":99.000,"xyz":[146.078,278.000,-130.228]}},{"noteOn":{"time":90.220,"note":97.000,"xyz":[73.023,254.000,68.743]}},{"noteOn":{"time":90.345,"note":93.000,"xyz":[138.991,206.000,-479.459]}},{"noteOn":{"time":90.350,"note":97.000,"xyz":[96.155,254.000,-185.945]}},{"noteOn":{"time":90.410,"note":97.000,"xyz":[200.758,254.000,120.189]}},{"noteOn":{"time":90.615,"note":99.000,"xyz":[164.395,278.000,268.150]}},{"noteOn":{"time":90.620,"note":102.000,"xyz":[-386.031,314.000,20.309]}},{"noteOn":{"time":90.645,"note":109.000,"xyz":[185.858,398.000,-164.872]}},{"noteOn":{"time":90.695,"note":93.000,"xyz":[224.416,206.000,151.126]}},{"noteOn":{"time":90.830,"note":96.000,"xyz":[-129.771,242.000,126.560]}},{"noteOn":{"time":90.885,"note":105.000,"xyz":[429.838,350.000,-174.609]}},{"noteOn":{"time":91.020,"note":107.000,"xyz":[-326.305,374.000,-108.715]}},{"noteOn":{"time":91.025,"note":105.000,"xyz":[220.389,350.000,-251.870]}},{"noteOn":{"time":91.130,"note":103.000,"xyz":[-136.243,326.000,270.601]}},{"noteOn":{"time":91.140,"note":97.000,"xyz":[-65.578,254.000,-3.804]}},{"noteOn":{"time":91.240,"note":99.000,"xyz":[87.607,278.000,253.936]}},{"noteOn":{"time":91.335,"note":95.000,"xyz":[-47.564,230.000,-38.057]}},{"noteOn":{"time":91.395,"note":91.000,"xyz":[129.595,182.000,-167.995]}},{"noteOn":{"time":91.440,"note":95.000,"xyz":[-148.933,230.000,-18.814]}},{"noteOn":{"time":91.500,"note":97.000,"xyz":[131.283,254.000,-252.848]}},{"noteOn":{"time":91.630,"note":99.000,"xyz":[-1.434,278.000,-148.462]}},{"noteOn":{"time":91.630,"note":105.000,"xyz":[-154.043,350.000,-181.967]}},{"noteOn":{"time":91.665,"note":100.000,"xyz":[-99.358,290.000,19.478]}},{"noteOn":{"time":91.720,"note":99.000,"xyz":[-340.186,278.000,361.015]}},{"noteOn":{"time":91.845,"note":105.000,"xyz":[-176.867,350.000,280.999]}},{"noteOn":{"time":91.875,"note":99.000,"xyz":[214.056,278.000,3.735]}},{"noteOn":{"time":91.945,"note":97.000,"xyz":[0.727,254.000,61.604]}},{"noteOn":{"time":92.085,"note":101.000,"xyz":[-162.505,302.000,-310.105]}},{"noteOn":{"time":92.150,"note":97.000,"xyz":[215.374,254.000,-159.457]}},{"noteOn":{"time":92.230,"note":105.000,"xyz":[-442.312,350.000,-160.040]}},{"noteOn":{"time":92.235,"note":101.000,"xyz":[482.565,302.000,-105.904]}},{"noteOn":{"time":92.320,"note":89.000,"xyz":[-122.004,158.000,-414.402]}},{"noteOn":{"time":92.420,"note":102.000,"xyz":[-38.847,314.000,-39.921]}},{"noteOn":{"time":92.435,"note":93.000,"xyz":[57.529,206.000,168.781]}},{"noteOn":{"time":92.590,"note":97.000,"xyz":[-115.837,254.000,-136.205]}},{"noteOn":{"time":92.645,"note":91.000,"xyz":[71.659,182.000,226.258]}},{"noteOn":{"time":92.710,"note":107.000,"xyz":[-103.942,374.000,-83.406]}},{"noteOn":{"time":92.810,"note":97.000,"xyz":[-68.728,254.000,-32.911]}},{"noteOn":{"time":92.885,"note":103.000,"xyz":[43.910,326.000,-451.781]}},{"noteOn":{"time":92.895,"note":99.000,"xyz":[-108.396,278.000,-34.530]}},{"noteOn":{"time":92.960,"note":103.000,"xyz":[161.066,326.000,87.375]}},{"noteOn":{"time":92.990,"note":99.000,"xyz":[114.820,278.000,19.541]}},{"noteOn":{"time":93.045,"note":107.000,"xyz":[338.512,374.000,-254.819]}},{"noteOn":{"time":93.190,"note":95.000,"xyz":[-61.294,230.000,-127.576]}},{"noteOn":{"time":93.220,"note":92.000,"xyz":[151.797,194.000,160.235]}},{"noteOn":{"time":93.255,"note":92.000,"xyz":[-282.892,194.000,110.266]}},{"noteOn":{"time":93.485,"note":102.000,"xyz":[-152.451,314.000,-207.678]}},{"noteOn":{"time":93.615,"note":101.000,"xyz":[142.795,302.000,-269.871]}},{"noteOn":{"time":93.685,"note":105.000,"xyz":[184.280,350.000,404.227]}},{"noteOn":{"time":93.700,"note":99.000,"xyz":[65.177,278.000,-8.493]}},{"noteOn":{"time":93.745,"note":97.000,"xyz":[-257.949,254.000,-28.435]}},{"noteOn":{"time":93.765,"note":91.000,"xyz":[336.590,182.000,-24.587]}},{"noteOn":{"time":93.770,"note":101.000,"xyz":[308.384,302.000,85.059]}},{"noteOn":{"time":93.820,"note":101.000,"xyz":[367.461,302.000,14.234]}},{"noteOn":{"time":93.835,"note":94.000,"xyz":[-148.410,218.000,237.282]}},{"noteOn":{"time":94.025,"note":99.000,"xyz":[63.133,278.000,395.731]}},{"noteOn":{"time":94.150,"note":98.000,"xyz":[-53.768,266.000,-59.936]}},{"noteOn":{"time":94.150,"note":107.000,"xyz":[254.769,374.000,215.939]}},{"noteOn":{"time":94.190,"note":101.000,"xyz":[-286.755,302.000,331.361]}},{"noteOn":{"time":94.345,"note":98.000,"xyz":[-93.177,266.000,170.174]}},{"noteOn":{"time":94.370,"note":89.000,"xyz":[52.369,158.000,9.802]}},{"noteOn":{"time":94.395,"note":111.000,"xyz":[385.404,422.000,92.201]}},{"noteOn":{"time":94.400,"note":95.000,"xyz":[363.649,230.000,-248.014]}},{"noteOn":{"time":94.415,"note":104.000,"xyz":[138.388,338.000,81.479]}},{"noteOn":{"time":94.440,"note":99.000,"xyz":[-29.705,278.000,42.402]}},{"noteOn":{"time":94.445,"note":103.000,"xyz":[131.026,326.000,-48.352]}},{"noteOn":{"time":94.665,"note":94.000,"xyz":[256.782,218.000,-234.126]}},{"noteOn":{"time":94.720,"note":96.000,"xyz":[114.206,242.000,-188.209]}},{"noteOn":{"time":94.800,"note":100.000,"xyz":[81.768,290.000,171.669]}},{"noteOn":{"time":94.925,"note":108.000,"xyz":[-212.150,386.000,196.294]}},{"noteOn":{"time":94.960,"note":98.000,"xyz":[-54.632,266.000,-197.148]}},{"noteOn":{"time":95.035,"note":97.000,"xyz":[-275.933,254.000,-228.455]}},{"noteOn":{"time":95.065,"note":108.000,"xyz":[-200.007,386.000,63.865]}},{"noteOn":{"time":95.155,"note":103.000,"xyz":[-414.123,326.000,-183.640]}},{"noteOn":{"time":95.155,"note":99.000,"xyz":[-46.574,278.000,371.300]}},{"noteOn":{"time":95.175,"note":94.000,"xyz":[92.033,218.000,16.655]}},{"noteOn":{"time":95.175,"note":105.000,"xyz":[147.786,350.000,109.330]}},{"noteOn":{"time":95.250,"note":96.000,"xyz":[-329.703,242.000,-313.286]}},{"noteOn":{"time":95.365,"note":106.000,"xyz":[-149.713,362.000,282.010]}},{"noteOn":{"time":95.560,"note":94.000,"xyz":[160.420,218.000,-156.126]}},{"noteOn":{"time":95.590,"note":106.000,"xyz":[-340.258,362.000,123.488]}},{"noteOn":{"time":95.600,"note":104.000,"xyz":[326.161,338.000,180.737]}},{"noteOn":{"time":95.655,"note":98.000,"xyz":[97.365,266.000,-75.360]}},{"noteOn":{"time":95.725,"note":99.000,"xyz":[422.185,278.000,84.487]}},{"noteOn":{"time":95.755,"note":96.000,"xyz":[0.775,242.000,173.544]}},{"noteOn":{"time":95.865,"note":100.000,"xyz":[62.623,290.000,-148.465]}},{"noteOn":{"time":95.890,"note":96.000,"xyz":[244.787,242.000,60.550]}},{"noteOn":{"time":95.935,"note":90.000,"xyz":[166.389,170.000,20.013]}},{"noteOn":{"time":96.010,"note":104.000,"xyz":[-222.741,338.000,192.489]}},{"noteOn":{"time":96.065,"note":101.000,"xyz":[-61.554,302.000,-53.731]}},{"noteOn":{"time":96.120,"note":96.000,"xyz":[106.382,242.000,124.620]}},{"noteOn":{"time":96.220,"note":100.000,"xyz":[-87.777,290.000,146.230]}},{"noteOn":{"time":96.220,"note":106.000,"xyz":[-234.935,362.000,160.954]}},{"noteOn":{"time":96.290,"note":104.000,"xyz":[176.334,338.000,-56.779]}},{"noteOn":{"time":96.350,"note":98.000,"xyz":[142.152,266.000,126.775]}},{"noteOn":{"time":96.430,"note":102.000,"xyz":[17.284,314.000,339.571]}},{"noteOn":{"time":96.540,"note":98.000,"xyz":[-287.164,266.000,142.247]}},{"noteOn":{"time":96.625,"note":96.000,"xyz":[-192.567,242.000,-356.402]}},{"noteOn":{"time":96.690,"note":102.000,"xyz":[431.836,314.000,-193.811]}},{"noteOn":{"time":96.805,"note":102.000,"xyz":[173.095,314.000,-397.992]}},{"noteOn":{"time":96.815,"note":90.000,"xyz":[-95.028,170.000,176.221]}},{"noteOn":{"time":96.835,"note":103.000,"xyz":[-139.672,326.000,330.470]}},{"noteOn":{"time":96.865,"note":106.000,"xyz":[363.573,362.000,232.146]}},{"noteOn":{"time":96.980,"note":94.000,"xyz":[47.180,218.000,273.597]}},{"noteOn":{"time":97.120,"note":96.000,"xyz":[-220.160,242.000,408.773]}},{"noteOn":{"time":97.135,"note":98.000,"xyz":[-119.765,266.000,50.364]}},{"noteOn":{"time":97.155,"note":90.000,"xyz":[-260.752,170.000,155.840]}},{"noteOn":{"time":97.255,"note":106.000,"xyz":[9.992,362.000,143.616]}},{"noteOn":{"time":97.295,"note":100.000,"xyz":[-475.758,290.000,-88.699]}},{"noteOn":{"time":97.445,"note":102.000,"xyz":[-410.429,314.000,-265.181]}},{"noteOn":{"time":97.520,"note":100.000,"xyz":[182.603,290.000,443.622]}},{"noteOn":{"time":97.525,"note":98.000,"xyz":[-93.580,266.000,308.932]}},{"noteOn":{"time":97.635,"note":102.000,"xyz":[217.942,314.000,425.932]}},{"noteOn":{"time":97.655,"note":96.000,"xyz":[210.355,242.000,238.537]}},{"noteOn":{"time":97.695,"note":93.000,"xyz":[-72.001,206.000,174.054]}},{"noteOn":{"time":97.720,"note":92.000,"xyz":[-162.460,194.000,-427.814]}},{"noteOn":{"time":97.800,"note":108.000,"xyz":[-294.147,386.000,-240.678]}},{"noteOn":{"time":98.035,"note":110.000,"xyz":[112.578,410.000,-33.959]}},{"noteOn":{"time":98.070,"note":102.000,"xyz":[-281.557,314.000,234.541]}},{"noteOn":{"time":98.095,"note":104.000,"xyz":[-214.720,338.000,12.608]}},{"noteOn":{"time":98.125,"note":100.000,"xyz":[37.236,290.000,40.676]}},{"noteOn":{"time":98.160,"note":90.000,"xyz":[200.580,170.000,119.474]}},{"noteOn":{"time":98.195,"note":100.000,"xyz":[-297.763,290.000,164.273]}},{"noteOn":{"time":98.200,"note":100.000,"xyz":[-87.425,290.000,-57.385]}},{"noteOn":{"time":98.250,"note":95.000,"xyz":[-334.936,230.000,-355.385]}},{"noteOn":{"time":98.330,"note":96.000,"xyz":[-220.682,242.000,-154.404]}},{"noteOn":{"time":98.410,"note":100.000,"xyz":[399.121,290.000,0.192]}},{"noteOn":{"time":98.530,"note":98.000,"xyz":[-342.268,266.000,-227.813]}},{"noteOn":{"time":98.660,"note":97.000,"xyz":[-18.887,254.000,-76.107]}},{"noteOn":{"time":98.785,"note":97.000,"xyz":[-100.210,254.000,7.418]}},{"noteOn":{"time":98.790,"note":102.000,"xyz":[419.169,314.000,131.365]}},{"noteOn":{"time":98.845,"note":88.000,"xyz":[307.559,146.000,264.739]}},{"noteOn":{"time":98.850,"note":108.000,"xyz":[-302.282,386.000,123.825]}},{"noteOn":{"time":98.885,"note":108.000,"xyz":[126.722,386.000,-215.881]}},{"noteOn":{"time":98.930,"note":104.000,"xyz":[229.331,338.000,50.054]}},{"noteOn":{"time":98.935,"note":96.000,"xyz":[-82.122,242.000,98.958]}},{"noteOn":{"time":98.945,"note":104.000,"xyz":[-138.832,338.000,195.032]}},{"noteOn":{"time":98.990,"note":98.000,"xyz":[164.656,266.000,319.855]}},{"noteOn":{"time":99.035,"note":102.000,"xyz":[107.943,314.000,38.754]}},{"noteOn":{"time":99.050,"note":100.000,"xyz":[-222.534,290.000,57.265]}},{"noteOn":{"time":99.220,"note":95.000,"xyz":[233.993,230.000,306.214]}},{"noteOn":{"time":99.455,"note":98.000,"xyz":[-375.450,266.000,252.319]}},{"noteOn":{"time":99.465,"note":105.000,"xyz":[-59.035,350.000,-210.765]}},{"noteOn":{"time":99.505,"note":106.000,"xyz":[226.141,362.000,-169.929]}},{"noteOn":{"time":99.565,"note":104.000,"xyz":[11.529,338.000,302.231]}},{"noteOn":{"time":99.580,"note":108.000,"xyz":[120.882,386.000,101.357]}},{"noteOn":{"time":99.650,"note":95.000,"xyz":[38.328,230.000,-81.308]}},{"noteOn":{"time":99.665,"note":95.000,"xyz":[263.361,230.000,-19.678]}},{"noteOn":{"time":99.705,"note":96.000,"xyz":[-30.109,242.000,47.679]}},{"noteOn":{"time":99.705,"note":98.000,"xyz":[-76.458,266.000,244.882]}},{"noteOn":{"time":99.740,"note":106.000,"xyz":[98.232,362.000,-246.996]}},{"noteOn":{"time":99.965,"note":94.000,"xyz":[-417.197,218.000,148.676]}},{"noteOn":{"time":100.155,"note":100.000,"xyz":[-163.476,290.000,40.613]}},{"noteOn":{"time":100.160,"note":99.000,"xyz":[-458.436,278.000,-55.088]}},{"noteOn":{"time":100.175,"note":97.000,"xyz":[26.686,254.000,208.270]}},{"noteOn":{"time":100.275,"note":106.000,"xyz":[107.486,362.000,-153.003]}},{"noteOn":{"time":100.325,"note":98.000,"xyz":[-327.612,266.000,67.354]}},{"noteOn":{"time":100.370,"note":96.000,"xyz":[-116.822,242.000,-3.685]}},{"noteOn":{"time":100.375,"note":107.000,"xyz":[-53.460,374.000,-42.741]}},{"noteOn":{"time":100.380,"note":89.000,"xyz":[31.961,158.000,-192.178]}},{"noteOn":{"time":100.455,"note":101.000,"xyz":[104.434,302.000,-8.377]}},{"noteOn":{"time":100.640,"note":103.000,"xyz":[-319.933,326.000,-250.187]}},{"noteOn":{"time":100.665,"note":96.000,"xyz":[-216.658,242.000,-425.381]}},{"noteOn":{"time":100.715,"note":101.000,"xyz":[270.008,302.000,298.129]}},{"noteOn":{"time":100.770,"note":94.000,"xyz":[147.740,218.000,-20.772]}},{"noteOn":{"time":100.825,"note":97.000,"xyz":[-119.278,254.000,240.761]}},{"noteOn":{"time":100.850,"note":103.000,"xyz":[-296.298,326.000,-162.868]}},{"noteOn":{"time":101.035,"note":96.000,"xyz":[-10.040,242.000,116.168]}},{"noteOn":{"time":101.080,"note":101.000,"xyz":[-85.443,302.000,-30.722]}},{"noteOn":{"time":101.110,"note":103.000,"xyz":[98.529,326.000,68.578]}},{"noteOn":{"time":101.180,"note":99.000,"xyz":[34.755,278.000,68.181]}},{"noteOn":{"time":101.215,"note":91.000,"xyz":[-13.132,182.000,-60.537]}},{"noteOn":{"time":101.250,"note":103.000,"xyz":[29.546,326.000,64.908]}},{"noteOn":{"time":101.445,"note":95.000,"xyz":[409.244,230.000,267.074]}},{"noteOn":{"time":101.530,"note":107.000,"xyz":[362.301,374.000,-258.700]}},{"noteOn":{"time":101.575,"note":99.000,"xyz":[-175.852,278.000,-104.120]}},{"noteOn":{"time":101.650,"note":95.000,"xyz":[148.503,230.000,153.167]}},{"noteOn":{"time":101.665,"note":91.000,"xyz":[-110.514,182.000,-150.573]}},{"noteOn":{"time":101.730,"note":101.000,"xyz":[-253.013,302.000,6.392]}},{"noteOn":{"time":101.855,"note":106.000,"xyz":[96.978,362.000,235.189]}},{"noteOn":{"time":101.930,"note":101.000,"xyz":[46.424,302.000,-60.868]}},{"noteOn":{"time":101.945,"note":101.000,"xyz":[176.870,302.000,277.740]}},{"noteOn":{"time":101.970,"note":97.000,"xyz":[236.583,254.000,-265.675]}},{"noteOn":{"time":102.040,"note":97.000,"xyz":[-1.978,254.000,-167.745]}},{"noteOn":{"time":102.075,"note":99.000,"xyz":[212.981,278.000,319.580]}},{"noteOn":{"time":102.135,"note":94.000,"xyz":[-216.445,218.000,230.029]}},{"noteOn":{"time":102.215,"note":109.000,"xyz":[-292.636,398.000,-176.397]}},{"noteOn":{"time":102.215,"note":93.000,"xyz":[6.850,206.000,272.262]}},{"noteOn":{"time":102.445,"note":101.000,"xyz":[-493.832,302.000,40.539]}},{"noteOn":{"time":102.510,"note":99.000,"xyz":[-64.886,278.000,-435.527]}},{"noteOn":{"time":102.510,"note":103.000,"xyz":[10.642,326.000,172.826]}},{"noteOn":{"time":102.625,"note":89.000,"xyz":[205.362,158.000,120.899]}},{"noteOn":{"time":102.650,"note":103.000,"xyz":[199.714,326.000,146.383]}},{"noteOn":{"time":102.665,"note":96.000,"xyz":[165.674,242.000,-350.302]}},{"noteOn":{"time":102.730,"note":99.000,"xyz":[-140.832,278.000,-419.342]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[115.470,278.000,417.562]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[101.211,278.000,19.828]}},{"noteOn":{"time":102.820,"note":95.000,"xyz":[-62.675,230.000,10.455]}},{"noteOn":{"time":102.880,"note":109.000,"xyz":[-338.896,398.000,321.383]}},{"noteOn":{"time":103.165,"note":97.000,"xyz":[17.204,254.000,94.104]}},{"noteOn":{"time":103.225,"note":96.000,"xyz":[-130.839,242.000,275.062]}},{"noteOn":{"time":103.375,"note":105.000,"xyz":[294.618,350.000,232.063]}},{"noteOn":{"time":103.385,"note":97.000,"xyz":[-373.755,254.000,83.244]}},{"noteOn":{"time":103.385,"note":89.000,"xyz":[-137.472,158.000,-112.084]}},{"noteOn":{"time":103.390,"note":103.000,"xyz":[261.347,326.000,-277.987]}},{"noteOn":{"time":103.430,"note":97.000,"xyz":[157.221,254.000,40.883]}},{"noteOn":{"time":103.475,"note":103.000,"xyz":[-183.974,326.000,-52.267]}},{"noteOn":{"time":103.475,"note":101.000,"xyz":[-126.849,302.000,51.581]}},{"noteOn":{"time":103.495,"note":101.000,"xyz":[-304.585,302.000,57.896]}},{"noteOn":{"time":103.640,"note":109.000,"xyz":[-80.087,398.000,324.519]}},{"noteOn":{"time":103.715,"note":95.000,"xyz":[237.470,230.000,-405.233]}},{"noteOn":{"time":103.780,"note":107.000,"xyz":[-158.855,374.000,-391.853]}},{"noteOn":{"time":103.910,"note":99.000,"xyz":[229.310,278.000,15.256]}},{"noteOn":{"time":103.950,"note":107.000,"xyz":[-149.724,374.000,-270.626]}},{"noteOn":{"time":103.975,"note":105.000,"xyz":[-114.576,350.000,-380.310]}},{"noteOn":{"time":104.080,"note":94.000,"xyz":[75.563,218.000,345.173]}},{"noteOn":{"time":104.125,"note":95.000,"xyz":[-207.306,230.000,-138.178]}},{"noteOn":{"time":104.165,"note":107.000,"xyz":[-324.854,374.000,134.576]}},{"noteOn":{"time":104.245,"note":103.000,"xyz":[275.191,326.000,22.314]}},{"noteOn":{"time":104.265,"note":95.000,"xyz":[-223.532,230.000,-141.806]}},{"noteOn":{"time":104.325,"note":97.000,"xyz":[286.657,254.000,67.794]}},{"noteOn":{"time":104.420,"note":105.000,"xyz":[-201.554,350.000,-124.372]}},{"noteOn":{"time":104.655,"note":98.000,"xyz":[62.554,266.000,-393.980]}},{"noteOn":{"time":104.670,"note":100.000,"xyz":[-351.604,290.000,-18.019]}},{"noteOn":{"time":104.680,"note":105.000,"xyz":[-186.720,350.000,-180.856]}},{"noteOn":{"time":104.795,"note":89.000,"xyz":[118.963,158.000,267.515]}},{"noteOn":{"time":104.810,"note":101.000,"xyz":[-372.256,302.000,-130.259]}},{"noteOn":{"time":104.855,"note":102.000,"xyz":[-265.943,314.000,-239.567]}},{"noteOn":{"time":104.920,"note":97.000,"xyz":[-114.761,254.000,461.957]}},{"noteOn":{"time":104.935,"note":97.000,"xyz":[-43.598,254.000,-209.094]}},{"noteOn":{"time":104.955,"note":105.000,"xyz":[-314.760,350.000,78.547]}},{"noteOn":{"time":105.205,"note":95.000,"xyz":[167.006,230.000,-106.630]}},{"noteOn":{"time":105.215,"note":102.000,"xyz":[83.890,314.000,28.769]}},{"noteOn":{"time":105.230,"note":93.000,"xyz":[160.244,206.000,200.827]}},{"noteOn":{"time":105.270,"note":103.000,"xyz":[-18.850,326.000,-52.331]}},{"noteOn":{"time":105.360,"note":96.000,"xyz":[186.001,242.000,37.727]}},{"noteOn":{"time":105.445,"note":97.000,"xyz":[164.317,254.000,-252.367]}},{"noteOn":{"time":105.485,"note":107.000,"xyz":[-173.720,374.000,320.299]}},{"noteOn":{"time":105.500,"note":103.000,"xyz":[-361.182,326.000,60.978]}},{"noteOn":{"time":105.545,"note":103.000,"xyz":[-256.867,326.000,-114.033]}},{"noteOn":{"time":105.585,"note":91.000,"xyz":[471.506,182.000,58.558]}},{"noteOn":{"time":105.670,"note":102.000,"xyz":[-216.893,314.000,-277.497]}},{"noteOn":{"time":105.895,"note":99.000,"xyz":[-385.084,278.000,253.037]}},{"noteOn":{"time":105.905,"note":95.000,"xyz":[193.629,230.000,209.662]}},{"noteOn":{"time":105.910,"note":108.000,"xyz":[-317.070,386.000,-38.059]}},{"noteOn":{"time":105.945,"note":95.000,"xyz":[163.545,230.000,-415.735]}},{"noteOn":{"time":106.105,"note":99.000,"xyz":[-54.519,278.000,197.519]}},{"noteOn":{"time":106.160,"note":100.000,"xyz":[-293.882,290.000,-315.614]}},{"noteOn":{"time":106.170,"note":92.000,"xyz":[97.196,194.000,-332.063]}},{"noteOn":{"time":106.240,"note":94.000,"xyz":[457.133,218.000,148.213]}},{"noteOn":{"time":106.385,"note":96.000,"xyz":[130.698,242.000,-52.305]}},{"noteOn":{"time":106.430,"note":97.000,"xyz":[-10.455,254.000,232.477]}},{"noteOn":{"time":106.445,"note":105.000,"xyz":[367.215,350.000,216.245]}},{"noteOn":{"time":106.480,"note":100.000,"xyz":[-58.781,290.000,-258.403]}},{"noteOn":{"time":106.480,"note":110.000,"xyz":[348.568,410.000,122.478]}},{"noteOn":{"time":106.490,"note":101.000,"xyz":[31.703,302.000,296.887]}},{"noteOn":{"time":106.570,"note":94.000,"xyz":[-114.152,218.000,252.749]}},{"noteOn":{"time":106.715,"note":94.000,"xyz":[68.885,218.000,195.268]}},{"noteOn":{"time":106.855,"note":102.000,"xyz":[-200.813,314.000,278.031]}},{"noteOn":{"time":106.900,"note":101.000,"xyz":[89.130,302.000,-195.890]}},{"noteOn":{"time":106.980,"note":103.000,"xyz":[-6.869,326.000,96.774]}},{"noteOn":{"time":107.030,"note":112.000,"xyz":[-181.359,434.000,122.844]}},{"noteOn":{"time":107.085,"note":97.000,"xyz":[-267.827,254.000,-294.122]}},{"noteOn":{"time":107.090,"note":88.000,"xyz":[-261.435,146.000,183.280]}},{"noteOn":{"time":107.145,"note":98.000,"xyz":[-10.349,266.000,-161.102]}},{"noteOn":{"time":107.155,"note":98.000,"xyz":[115.746,266.000,478.145]}},{"noteOn":{"time":107.185,"note":104.000,"xyz":[-215.238,338.000,247.207]}},{"noteOn":{"time":107.190,"note":100.000,"xyz":[-32.886,290.000,-190.800]}},{"noteOn":{"time":107.260,"note":100.000,"xyz":[-14.409,290.000,64.030]}},{"noteOn":{"time":107.275,"note":94.000,"xyz":[14.988,218.000,-71.345]}},{"noteOn":{"time":107.590,"note":98.000,"xyz":[288.671,266.000,60.825]}},{"noteOn":{"time":107.660,"note":95.000,"xyz":[-166.238,230.000,-228.708]}},{"noteOn":{"time":107.675,"note":96.000,"xyz":[-154.203,242.000,117.976]}},{"noteOn":{"time":107.750,"note":96.000,"xyz":[306.050,242.000,-62.168]}},{"noteOn":{"time":107.795,"note":98.000,"xyz":[49.017,266.000,-43.017]}},{"noteOn":{"time":107.865,"note":110.000,"xyz":[69.000,410.000,-356.368]}},{"noteOn":{"time":107.915,"note":103.000,"xyz":[418.049,326.000,-261.201]}},{"noteOn":{"time":107.930,"note":90.000,"xyz":[-125.613,170.000,-73.855]}},{"noteOn":{"time":107.935,"note":106.000,"xyz":[182.969,362.000,-318.061]}},{"noteOn":{"time":107.955,"note":102.000,"xyz":[167.887,314.000,212.353]}},{"noteOn":{"time":108.025,"note":108.000,"xyz":[23.228,386.000,453.948]}},{"noteOn":{"time":108.100,"note":108.000,"xyz":[-15.105,386.000,-456.034]}},{"noteOn":{"time":108.215,"note":94.000,"xyz":[182.856,218.000,-100.052]}},{"noteOn":{"time":108.250,"note":102.000,"xyz":[-42.764,314.000,55.633]}},{"noteOn":{"time":108.370,"note":100.000,"xyz":[-173.910,290.000,85.652]}},{"noteOn":{"time":108.500,"note":93.000,"xyz":[89.219,206.000,-60.833]}},{"noteOn":{"time":108.510,"note":106.000,"xyz":[-17.543,362.000,-73.207]}},{"noteOn":{"time":108.515,"note":102.000,"xyz":[-430.086,314.000,28.676]}},{"noteOn":{"time":108.545,"note":96.000,"xyz":[214.198,242.000,36.121]}},{"noteOn":{"time":108.670,"note":106.000,"xyz":[-155.568,362.000,38.130]}},{"noteOn":{"time":108.710,"note":94.000,"xyz":[-235.679,218.000,104.093]}},{"noteOn":{"time":108.710,"note":106.000,"xyz":[-138.264,362.000,464.422]}},{"noteOn":{"time":108.775,"note":106.000,"xyz":[-133.474,362.000,40.988]}},{"noteOn":{"time":108.810,"note":104.000,"xyz":[366.952,338.000,72.675]}},{"noteOn":{"time":108.910,"note":96.000,"xyz":[-342.865,242.000,-256.131]}},{"noteOn":{"time":109.055,"note":104.000,"xyz":[-303.172,338.000,240.799]}},{"noteOn":{"time":109.130,"note":98.000,"xyz":[-189.927,266.000,142.174]}},{"noteOn":{"time":109.175,"note":104.000,"xyz":[-485.375,338.000,46.668]}},{"noteOn":{"time":109.180,"note":100.000,"xyz":[-162.109,290.000,-47.352]}},{"noteOn":{"time":109.205,"note":90.000,"xyz":[264.323,170.000,344.851]}},{"noteOn":{"time":109.250,"note":103.000,"xyz":[295.656,326.000,187.037]}},{"noteOn":{"time":109.385,"note":96.000,"xyz":[-122.487,242.000,-24.949]}},{"noteOn":{"time":109.495,"note":98.000,"xyz":[378.837,266.000,-71.200]}},{"noteOn":{"time":109.520,"note":104.000,"xyz":[-66.847,338.000,45.182]}},{"noteOn":{"time":109.525,"note":106.000,"xyz":[268.806,362.000,-279.928]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[-32.812,314.000,304.638]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[406.287,314.000,55.501]}},{"noteOn":{"time":109.715,"note":101.000,"xyz":[-286.869,302.000,-282.767]}},{"noteOn":{"time":109.715,"note":94.000,"xyz":[-57.548,218.000,362.810]}},{"noteOn":{"time":109.750,"note":106.000,"xyz":[92.662,362.000,384.594]}},{"noteOn":{"time":109.890,"note":96.000,"xyz":[74.411,242.000,449.463]}},{"noteOn":{"time":109.950,"note":92.000,"xyz":[-250.830,194.000,-337.815]}},{"noteOn":{"time":110.045,"note":98.000,"xyz":[-341.802,266.000,126.235]}},{"noteOn":{"time":110.045,"note":108.000,"xyz":[-117.086,386.000,244.328]}},{"noteOn":{"time":110.070,"note":94.000,"xyz":[-303.013,218.000,-217.386]}},{"noteOn":{"time":110.085,"note":101.000,"xyz":[71.259,302.000,19.093]}},{"noteOn":{"time":110.155,"note":104.000,"xyz":[-164.355,338.000,14.941]}},{"noteOn":{"time":110.185,"note":102.000,"xyz":[192.702,314.000,367.005]}},{"noteOn":{"time":110.265,"note":108.000,"xyz":[69.525,386.000,-22.620]}},{"noteOn":{"time":110.335,"note":96.000,"xyz":[377.515,242.000,-139.277]}},{"noteOn":{"time":110.380,"note":100.000,"xyz":[-8.720,290.000,170.557]}},{"noteOn":{"time":110.580,"note":104.000,"xyz":[-120.573,338.000,-82.219]}},{"noteOn":{"time":110.685,"note":93.000,"xyz":[75.224,206.000,134.825]}},{"noteOn":{"time":110.700,"note":96.000,"xyz":[-69.342,242.000,106.357]}},{"noteOn":{"time":110.705,"note":100.000,"xyz":[-351.024,290.000,-188.091]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-383.434,290.000,136.453]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-130.245,290.000,29.646]}},{"noteOn":{"time":110.795,"note":96.000,"xyz":[-326.255,242.000,182.498]}},{"noteOn":{"time":110.825,"note":93.000,"xyz":[91.700,206.000,-295.111]}},{"noteOn":{"time":110.850,"note":104.000,"xyz":[-148.627,338.000,167.868]}},{"noteOn":{"time":110.895,"note":98.000,"xyz":[75.665,266.000,327.509]}},{"noteOn":{"time":110.935,"note":100.000,"xyz":[449.834,290.000,-63.822]}},{"noteOn":{"time":111.010,"note":95.000,"xyz":[286.081,230.000,320.867]}},{"noteOn":{"time":111.090,"note":110.000,"xyz":[-185.848,410.000,-165.916]}},{"noteOn":{"time":111.215,"note":95.000,"xyz":[-215.553,230.000,-253.782]}},{"noteOn":{"time":111.295,"note":102.000,"xyz":[202.900,314.000,382.618]}},{"noteOn":{"time":111.330,"note":102.000,"xyz":[95.048,314.000,-250.325]}},{"noteOn":{"time":111.345,"note":101.000,"xyz":[143.183,302.000,263.190]}},{"noteOn":{"time":111.440,"note":98.000,"xyz":[-85.338,266.000,265.357]}},{"noteOn":{"time":111.525,"note":97.000,"xyz":[-248.348,254.000,133.784]}},{"noteOn":{"time":111.535,"note":98.000,"xyz":[-67.326,266.000,-67.606]}},{"noteOn":{"time":111.565,"note":100.000,"xyz":[-59.980,290.000,-161.212]}},{"noteOn":{"time":111.575,"note":102.000,"xyz":[260.172,314.000,341.930]}},{"noteOn":{"time":111.630,"note":88.000,"xyz":[-420.375,146.000,-138.230]}},{"noteOn":{"time":111.715,"note":103.000,"xyz":[228.124,326.000,353.235]}},{"noteOn":{"time":111.735,"note":93.000,"xyz":[-4.273,206.000,143.283]}},{"noteOn":{"time":111.900,"note":112.000,"xyz":[50.004,434.000,289.824]}},{"noteOn":{"time":111.970,"note":107.000,"xyz":[-443.015,374.000,208.308]}},{"noteOn":{"time":112.055,"note":101.000,"xyz":[-185.523,302.000,-166.391]}},{"noteOn":{"time":112.105,"note":96.000,"xyz":[125.664,242.000,-233.053]}},{"noteOn":{"time":112.120,"note":95.000,"xyz":[475.866,230.000,-45.354]}},{"noteOn":{"time":112.165,"note":98.000,"xyz":[-343.466,266.000,264.271]}},{"noteOn":{"time":112.190,"note":95.000,"xyz":[208.657,230.000,-155.869]}},{"noteOn":{"time":112.190,"note":107.000,"xyz":[-385.703,374.000,-299.524]}},{"noteOn":{"time":112.265,"note":99.000,"xyz":[-147.782,278.000,-249.318]}},{"noteOn":{"time":112.320,"note":104.000,"xyz":[-108.763,338.000,54.661]}},{"noteOn":{"time":112.385,"note":107.000,"xyz":[-319.727,374.000,-372.845]}},{"noteOn":{"time":112.410,"note":109.000,"xyz":[70.123,398.000,376.757]}},{"noteOn":{"time":112.430,"note":101.000,"xyz":[15.424,302.000,-108.086]}},{"noteOn":{"time":112.550,"note":91.000,"xyz":[-25.043,182.000,448.312]}},{"noteOn":{"time":112.645,"note":105.000,"xyz":[238.417,350.000,353.574]}},{"noteOn":{"time":112.715,"note":93.000,"xyz":[-341.452,206.000,-176.694]}},{"noteOn":{"time":112.815,"note":103.000,"xyz":[-79.694,326.000,452.414]}},{"noteOn":{"time":112.880,"note":101.000,"xyz":[-197.521,302.000,268.450]}},{"noteOn":{"time":112.935,"note":92.000,"xyz":[300.729,194.000,-264.225]}},{"noteOn":{"time":112.970,"note":97.000,"xyz":[251.588,254.000,198.416]}},{"noteOn":{"time":113.000,"note":102.000,"xyz":[-226.454,314.000,180.674]}},{"noteOn":{"time":113.030,"note":95.000,"xyz":[235.292,230.000,-422.798]}},{"noteOn":{"time":113.035,"note":105.000,"xyz":[131.526,350.000,275.920]}},{"noteOn":{"time":113.110,"note":106.000,"xyz":[-189.306,362.000,-181.270]}},{"noteOn":{"time":113.160,"note":105.000,"xyz":[122.776,350.000,21.641]}},{"noteOn":{"time":113.170,"note":107.000,"xyz":[244.024,374.000,-15.056]}},{"noteOn":{"time":113.270,"note":105.000,"xyz":[249.160,350.000,-261.301]}},{"noteOn":{"time":113.360,"note":103.000,"xyz":[1.888,326.000,-382.590]}},{"noteOn":{"time":113.455,"note":95.000,"xyz":[118.112,230.000,175.132]}},{"noteOn":{"time":113.575,"note":105.000,"xyz":[-438.288,350.000,74.205]}},{"noteOn":{"time":113.610,"note":99.000,"xyz":[-183.320,278.000,412.825]}},{"noteOn":{"time":113.665,"note":102.000,"xyz":[-429.083,314.000,-149.016]}},{"noteOn":{"time":113.675,"note":91.000,"xyz":[462.678,182.000,-75.433]}},{"noteOn":{"time":113.690,"note":101.000,"xyz":[203.803,302.000,-85.745]}},{"noteOn":{"time":113.775,"note":107.000,"xyz":[-64.319,374.000,106.596]}},{"noteOn":{"time":113.790,"note":97.000,"xyz":[-116.854,254.000,39.818]}},{"noteOn":{"time":113.940,"note":99.000,"xyz":[78.706,278.000,20.389]}},{"noteOn":{"time":113.945,"note":109.000,"xyz":[-7.198,398.000,148.553]}},{"noteOn":{"time":113.960,"note":103.000,"xyz":[-193.225,326.000,-398.752]}},{"noteOn":{"time":114.025,"note":101.000,"xyz":[123.543,302.000,183.440]}},{"noteOn":{"time":114.070,"note":103.000,"xyz":[-307.751,326.000,-102.374]}},{"noteOn":{"time":114.175,"note":93.000,"xyz":[-135.576,206.000,134.705]}},{"noteOn":{"time":114.215,"note":101.000,"xyz":[258.367,302.000,322.159]}},{"noteOn":{"time":114.375,"note":93.000,"xyz":[-81.751,206.000,-153.973]}},{"noteOn":{"time":114.380,"note":95.000,"xyz":[325.439,230.000,-253.168]}},{"noteOn":{"time":114.425,"note":95.000,"xyz":[54.534,230.000,73.376]}},{"noteOn":{"time":114.510,"note":99.000,"xyz":[356.464,278.000,-79.829]}},{"noteOn":{"time":114.525,"note":100.000,"xyz":[212.705,290.000,218.044]}},{"noteOn":{"time":114.625,"note":103.000,"xyz":[46.040,326.000,72.886]}},{"noteOn":{"time":114.640,"note":99.000,"xyz":[333.018,278.000,56.962]}},{"noteOn":{"time":114.670,"note":101.000,"xyz":[-360.692,302.000,169.064]}},{"noteOn":{"time":114.720,"note":97.000,"xyz":[228.014,254.000,-166.152]}},{"noteOn":{"time":114.750,"note":101.000,"xyz":[61.435,302.000,50.337]}},{"noteOn":{"time":114.780,"note":105.000,"xyz":[168.849,350.000,0.629]}},{"noteOn":{"time":114.895,"note":109.000,"xyz":[25.980,398.000,49.143]}},{"noteOn":{"time":114.925,"note":97.000,"xyz":[134.056,254.000,-201.897]}},{"noteOn":{"time":115.195,"note":93.000,"xyz":[192.456,206.000,61.875]}},{"noteOn":{"time":115.260,"note":103.000,"xyz":[-80.793,326.000,156.261]}},{"noteOn":{"time":115.265,"note":95.000,"xyz":[-25.777,230.000,172.893]}},{"noteOn":{"time":115.355,"note":99.000,"xyz":[-320.070,278.000,-104.759]}},{"noteOn":{"time":115.380,"note":101.000,"xyz":[-260.043,302.000,383.469]}},{"noteOn":{"time":115.385,"note":99.000,"xyz":[68.988,278.000,71.045]}},{"noteOn":{"time":115.390,"note":101.000,"xyz":[113.112,302.000,-275.072]}},{"noteOn":{"time":115.410,"note":93.000,"xyz":[-344.547,206.000,117.094]}},{"noteOn":{"time":115.470,"note":96.000,"xyz":[-36.791,242.000,403.305]}},{"noteOn":{"time":115.590,"note":101.000,"xyz":[-475.265,302.000,147.136]}},{"noteOn":{"time":115.610,"note":99.000,"xyz":[-247.767,278.000,-64.417]}},{"noteOn":{"time":115.700,"note":99.000,"xyz":[64.547,278.000,61.887]}},{"noteOn":{"time":115.715,"note":96.000,"xyz":[-109.318,242.000,-406.071]}},{"noteOn":{"time":115.815,"note":109.000,"xyz":[3.311,398.000,-68.206]}},{"noteOn":{"time":115.895,"note":103.000,"xyz":[-78.577,326.000,-189.850]}},{"noteOn":{"time":116.005,"note":98.000,"xyz":[446.888,266.000,-107.772]}},{"noteOn":{"time":116.040,"note":97.000,"xyz":[-207.681,254.000,-248.917]}},{"noteOn":{"time":116.045,"note":107.000,"xyz":[157.160,374.000,198.893]}},{"noteOn":{"time":116.160,"note":97.000,"xyz":[-148.169,254.000,146.239]}},{"noteOn":{"time":116.175,"note":89.000,"xyz":[118.499,158.000,323.619]}},{"noteOn":{"time":116.175,"note":101.000,"xyz":[-98.050,302.000,-460.431]}},{"noteOn":{"time":116.215,"note":97.000,"xyz":[253.345,254.000,141.464]}},{"noteOn":{"time":116.250,"note":103.000,"xyz":[291.251,326.000,-167.408]}},{"noteOn":{"time":116.250,"note":93.000,"xyz":[13.110,206.000,454.872]}},{"noteOn":{"time":116.510,"note":111.000,"xyz":[-247.124,422.000,349.553]}},{"noteOn":{"time":116.525,"note":101.000,"xyz":[216.791,302.000,-275.552]}},{"noteOn":{"time":116.550,"note":95.000,"xyz":[28.739,230.000,85.846]}},{"noteOn":{"time":116.625,"note":94.000,"xyz":[-206.655,218.000,118.328]}},{"noteOn":{"time":116.700,"note":94.000,"xyz":[-105.748,218.000,-14.065]}},{"noteOn":{"time":116.730,"note":107.000,"xyz":[125.341,374.000,235.325]}},{"noteOn":{"time":116.730,"note":105.000,"xyz":[-78.070,350.000,84.187]}},{"noteOn":{"time":116.820,"note":99.000,"xyz":[-263.228,278.000,-102.827]}},{"noteOn":{"time":116.910,"note":100.000,"xyz":[-397.042,290.000,81.944]}},{"noteOn":{"time":116.945,"note":107.000,"xyz":[-204.926,374.000,309.439]}},{"noteOn":{"time":116.965,"note":103.000,"xyz":[-217.157,326.000,201.611]}},{"noteOn":{"time":117.005,"note":104.000,"xyz":[112.183,338.000,45.963]}},{"noteOn":{"time":117.030,"note":104.000,"xyz":[-295.593,338.000,221.352]}},{"noteOn":{"time":117.170,"note":91.000,"xyz":[-61.616,182.000,-134.759]}},{"noteOn":{"time":117.215,"note":92.000,"xyz":[61.066,194.000,98.033]}},{"noteOn":{"time":117.325,"note":109.000,"xyz":[-223.331,398.000,-191.779]}},{"noteOn":{"time":117.350,"note":95.000,"xyz":[-259.091,230.000,225.314]}},{"noteOn":{"time":117.420,"note":92.000,"xyz":[52.690,194.000,102.443]}},{"noteOn":{"time":117.425,"note":98.000,"xyz":[66.531,266.000,-81.329]}},{"noteOn":{"time":117.480,"note":105.000,"xyz":[-191.886,350.000,146.135]}},{"noteOn":{"time":117.485,"note":100.000,"xyz":[3.989,290.000,310.252]}},{"noteOn":{"time":117.545,"note":104.000,"xyz":[313.958,338.000,30.461]}},{"noteOn":{"time":117.705,"note":107.000,"xyz":[-130.735,374.000,60.950]}},{"noteOn":{"time":117.735,"note":102.000,"xyz":[-34.990,314.000,-39.724]}},{"noteOn":{"time":117.765,"note":108.000,"xyz":[-135.875,386.000,91.667]}},{"noteOn":{"time":117.905,"note":105.000,"xyz":[308.334,350.000,116.627]}},{"noteOn":{"time":117.995,"note":95.000,"xyz":[-93.251,230.000,39.638]}},{"noteOn":{"time":118.020,"note":105.000,"xyz":[427.597,350.000,157.675]}},{"noteOn":{"time":118.120,"note":100.000,"xyz":[-270.423,290.000,-327.197]}},{"noteOn":{"time":118.125,"note":101.000,"xyz":[311.293,302.000,245.574]}},{"noteOn":{"time":118.200,"note":96.000,"xyz":[143.896,242.000,106.698]}},{"noteOn":{"time":118.205,"note":102.000,"xyz":[392.435,314.000,-125.504]}},{"noteOn":{"time":118.210,"note":97.000,"xyz":[-217.371,254.000,-229.944]}},{"noteOn":{"time":118.230,"note":92.000,"xyz":[353.376,194.000,328.938]}},{"noteOn":{"time":118.235,"note":104.000,"xyz":[278.834,338.000,100.132]}},{"noteOn":{"time":118.295,"note":102.000,"xyz":[81.675,314.000,453.120]}},{"noteOn":{"time":118.425,"note":100.000,"xyz":[329.216,290.000,13.899]}},{"noteOn":{"time":118.605,"note":108.000,"xyz":[-266.425,386.000,-84.194]}},{"noteOn":{"time":118.640,"note":92.000,"xyz":[174.474,194.000,-56.988]}},{"noteOn":{"time":118.655,"note":100.000,"xyz":[161.857,290.000,368.566]}},{"noteOn":{"time":118.710,"note":110.000,"xyz":[-97.888,410.000,-37.431]}},{"noteOn":{"time":118.710,"note":100.000,"xyz":[-312.891,290.000,14.464]}},{"noteOn":{"time":118.750,"note":98.000,"xyz":[-6.214,266.000,-95.943]}},{"noteOn":{"time":118.890,"note":94.000,"xyz":[224.882,218.000,195.403]}},{"noteOn":{"time":118.990,"note":94.000,"xyz":[86.779,218.000,-11.651]}},{"noteOn":{"time":119.000,"note":102.000,"xyz":[-150.803,314.000,71.492]}},{"noteOn":{"time":119.005,"note":99.000,"xyz":[-110.595,278.000,27.004]}},{"noteOn":{"time":119.135,"note":102.000,"xyz":[-171.248,314.000,77.346]}},{"noteOn":{"time":119.165,"note":106.000,"xyz":[166.105,362.000,-267.734]}},{"noteOn":{"time":119.175,"note":98.000,"xyz":[178.736,266.000,-28.541]}},{"noteOn":{"time":119.175,"note":99.000,"xyz":[-15.636,278.000,169.467]}},{"noteOn":{"time":119.205,"note":100.000,"xyz":[-215.337,290.000,-90.686]}},{"noteOn":{"time":119.440,"note":98.000,"xyz":[-33.681,266.000,-185.669]}},{"noteOn":{"time":119.525,"note":112.000,"xyz":[-114.148,434.000,-197.159]}},{"noteOn":{"time":119.530,"note":110.000,"xyz":[27.786,410.000,357.776]}},{"noteOn":{"time":119.565,"note":100.000,"xyz":[107.230,290.000,-413.004]}},{"noteOn":{"time":119.705,"note":94.000,"xyz":[-469.672,218.000,119.471]}},{"noteOn":{"time":119.745,"note":102.000,"xyz":[297.215,314.000,244.744]}},{"noteOn":{"time":119.780,"note":100.000,"xyz":[330.551,290.000,171.083]}},{"noteOn":{"time":119.825,"note":94.000,"xyz":[-375.633,218.000,-279.270]}},{"noteOn":{"time":119.865,"note":98.000,"xyz":[209.744,266.000,-228.284]}},{"noteOn":{"time":119.890,"note":100.000,"xyz":[-421.239,290.000,-166.469]}},{"noteOn":{"time":119.945,"note":92.000,"xyz":[247.479,194.000,372.885]}},{"noteOn":{"time":119.965,"note":102.000,"xyz":[-64.648,314.000,24.890]}},{"noteOn":{"time":119.975,"note":97.000,"xyz":[482.496,254.000,58.220]}},{"noteOn":{"time":120.015,"note":96.000,"xyz":[277.626,242.000,-328.527]}},{"noteOn":{"time":120.115,"note":98.000,"xyz":[-2.216,266.000,-272.154]}},{"noteOn":{"time":120.195,"note":108.000,"xyz":[182.251,386.000,110.185]}},{"noteOn":{"time":120.210,"note":96.000,"xyz":[27.931,242.000,106.687]}},{"noteOn":{"time":120.335,"note":112.000,"xyz":[-160.237,434.000,174.758]}},{"noteOn":{"time":120.415,"note":102.000,"xyz":[59.380,314.000,188.936]}},{"noteOn":{"time":120.530,"note":99.000,"xyz":[170.689,278.000,321.074]}},{"noteOn":{"time":120.535,"note":110.000,"xyz":[419.405,410.000,-178.726]}},{"noteOn":{"time":120.580,"note":104.000,"xyz":[248.056,338.000,-299.435]}},{"noteOn":{"time":120.645,"note":100.000,"xyz":[82.982,290.000,-26.756]}},{"noteOn":{"time":120.675,"note":104.000,"xyz":[57.705,338.000,-55.382]}},{"noteOn":{"time":120.675,"note":96.000,"xyz":[2.441,242.000,155.625]}},{"noteOn":{"time":120.725,"note":102.000,"xyz":[-205.847,314.000,-154.673]}},{"noteOn":{"time":120.740,"note":102.000,"xyz":[-465.180,314.000,-118.071]}},{"noteOn":{"time":120.785,"note":90.000,"xyz":[241.713,170.000,134.181]}},{"noteOn":{"time":120.785,"note":98.000,"xyz":[276.750,266.000,158.368]}},{"noteOn":{"time":120.800,"note":92.000,"xyz":[295.224,194.000,-247.167]}},{"noteOn":{"time":121.050,"note":104.000,"xyz":[59.760,338.000,87.236]}},{"noteOn":{"time":121.115,"note":94.000,"xyz":[-53.061,218.000,89.793]}},{"noteOn":{"time":121.170,"note":93.000,"xyz":[-72.993,206.000,-13.224]}},{"noteOn":{"time":121.210,"note":93.000,"xyz":[-99.725,206.000,-232.039]}},{"noteOn":{"time":121.275,"note":106.000,"xyz":[-84.702,362.000,87.841]}},{"noteOn":{"time":121.280,"note":104.000,"xyz":[-126.865,338.000,-231.908]}},{"noteOn":{"time":121.330,"note":100.000,"xyz":[4.382,290.000,-117.076]}},{"noteOn":{"time":121.365,"note":106.000,"xyz":[-143.632,362.000,466.460]}},{"noteOn":{"time":121.405,"note":108.000,"xyz":[137.200,386.000,-340.719]}},{"noteOn":{"time":121.415,"note":100.000,"xyz":[-382.673,290.000,115.351]}},{"noteOn":{"time":121.425,"note":106.000,"xyz":[-213.713,362.000,-327.187]}},{"noteOn":{"time":121.490,"note":104.000,"xyz":[60.456,338.000,-92.001]}},{"noteOn":{"time":121.575,"note":106.000,"xyz":[-161.241,362.000,-248.141]}},{"noteOn":{"time":121.710,"note":91.000,"xyz":[122.216,182.000,194.700]}},{"noteOn":{"time":121.715,"note":92.000,"xyz":[116.288,194.000,5.066]}},{"noteOn":{"time":121.785,"note":106.000,"xyz":[-52.410,362.000,-25.197]}},{"noteOn":{"time":121.795,"note":96.000,"xyz":[175.694,242.000,155.091]}},{"noteOn":{"time":121.905,"note":99.000,"xyz":[149.520,278.000,371.800]}},{"noteOn":{"time":121.915,"note":96.000,"xyz":[-1.042,242.000,110.200]}},{"noteOn":{"time":121.945,"note":91.000,"xyz":[247.198,182.000,-108.171]}},{"noteOn":{"time":122.115,"note":108.000,"xyz":[82.695,386.000,43.208]}},{"noteOn":{"time":122.115,"note":104.000,"xyz":[-335.950,338.000,88.658]}},{"noteOn":{"time":122.125,"note":100.000,"xyz":[-144.333,290.000,-124.116]}},{"noteOn":{"time":122.165,"note":104.000,"xyz":[-245.372,338.000,370.325]}},{"noteOn":{"time":122.235,"note":104.000,"xyz":[-286.891,338.000,251.595]}},{"noteOn":{"time":122.390,"note":106.000,"xyz":[-7.556,362.000,-115.504]}},{"noteOn":{"time":122.450,"note":102.000,"xyz":[-324.702,314.000,-299.332]}},{"noteOn":{"time":122.460,"note":94.000,"xyz":[-92.634,218.000,-262.789]}},{"noteOn":{"time":122.525,"note":106.000,"xyz":[-328.612,362.000,336.052]}},{"noteOn":{"time":122.550,"note":98.000,"xyz":[-14.591,266.000,-83.720]}},{"noteOn":{"time":122.620,"note":102.000,"xyz":[-50.106,314.000,25.695]}},{"noteOn":{"time":122.630,"note":101.000,"xyz":[-215.018,302.000,-134.753]}},{"noteOn":{"time":122.650,"note":101.000,"xyz":[140.397,302.000,-444.229]}},{"noteOn":{"time":122.695,"note":104.000,"xyz":[-192.159,338.000,456.327]}},{"noteOn":{"time":122.710,"note":101.000,"xyz":[-362.224,302.000,306.022]}},{"noteOn":{"time":122.810,"note":98.000,"xyz":[-99.546,266.000,-98.838]}},{"noteOn":{"time":122.825,"note":93.000,"xyz":[61.559,206.000,-33.436]}},{"noteOn":{"time":122.870,"note":100.000,"xyz":[-226.503,290.000,80.420]}},{"noteOn":{"time":123.030,"note":92.000,"xyz":[-295.592,194.000,19.523]}},{"noteOn":{"time":123.070,"note":109.000,"xyz":[-7.644,398.000,-98.465]}},{"noteOn":{"time":123.150,"note":97.000,"xyz":[375.651,254.000,-235.249]}},{"noteOn":{"time":123.215,"note":99.000,"xyz":[-299.728,278.000,-164.059]}},{"noteOn":{"time":123.240,"note":104.000,"xyz":[190.818,338.000,201.983]}},{"noteOn":{"time":123.285,"note":99.000,"xyz":[-125.574,278.000,-314.077]}},{"noteOn":{"time":123.295,"note":108.000,"xyz":[235.901,386.000,244.462]}},{"noteOn":{"time":123.435,"note":95.000,"xyz":[-168.953,230.000,166.133]}},{"noteOn":{"time":123.450,"note":103.000,"xyz":[227.578,326.000,234.786]}},{"noteOn":{"time":123.535,"note":99.000,"xyz":[-182.363,278.000,151.755]}},{"noteOn":{"time":123.545,"note":107.000,"xyz":[282.782,374.000,-405.579]}},{"noteOn":{"time":123.575,"note":93.000,"xyz":[35.684,206.000,-187.954]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[183.127,290.000,-265.862]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[200.854,290.000,350.048]}},{"noteOn":{"time":123.645,"note":98.000,"xyz":[41.664,266.000,-54.374]}},{"noteOn":{"time":123.725,"note":111.000,"xyz":[136.561,422.000,-345.627]}},{"noteOn":{"time":123.815,"note":95.000,"xyz":[258.726,230.000,-209.091]}},{"noteOn":{"time":123.905,"note":109.000,"xyz":[213.711,398.000,-444.707]}},{"noteOn":{"time":124.050,"note":113.000,"xyz":[-149.199,446.000,216.711]}},{"noteOn":{"time":124.085,"note":101.000,"xyz":[133.783,302.000,-136.643]}},{"noteOn":{"time":124.210,"note":95.000,"xyz":[195.846,230.000,244.100]}},{"noteOn":{"time":124.275,"note":97.000,"xyz":[172.254,254.000,118.657]}},{"noteOn":{"time":124.345,"note":102.000,"xyz":[-129.079,314.000,66.191]}},{"noteOn":{"time":124.390,"note":105.000,"xyz":[210.059,350.000,-20.961]}},{"noteOn":{"time":124.420,"note":93.000,"xyz":[-240.103,206.000,129.769]}},{"noteOn":{"time":124.430,"note":97.000,"xyz":[54.848,254.000,250.691]}},{"noteOn":{"time":124.435,"note":99.000,"xyz":[81.214,278.000,253.850]}},{"noteOn":{"time":124.475,"note":103.000,"xyz":[320.753,326.000,109.908]}},{"noteOn":{"time":124.480,"note":93.000,"xyz":[-340.774,206.000,309.927]}},{"noteOn":{"time":124.495,"note":107.000,"xyz":[-441.921,374.000,2.720]}},{"noteOn":{"time":124.525,"note":98.000,"xyz":[-36.029,266.000,-100.239]}},{"noteOn":{"time":124.585,"note":101.000,"xyz":[125.506,302.000,224.944]}},{"noteOn":{"time":124.715,"note":97.000,"xyz":[158.887,254.000,280.993]}},{"noteOn":{"time":124.765,"note":101.000,"xyz":[135.465,302.000,5.056]}},{"noteOn":{"time":124.885,"note":111.000,"xyz":[-150.258,422.000,54.835]}},{"noteOn":{"time":125.060,"note":99.000,"xyz":[-404.400,278.000,-250.743]}},{"noteOn":{"time":125.080,"note":103.000,"xyz":[31.724,326.000,-94.930]}},{"noteOn":{"time":125.100,"note":100.000,"xyz":[33.237,290.000,-59.561]}},{"noteOn":{"time":125.145,"note":103.000,"xyz":[177.098,326.000,117.219]}},{"noteOn":{"time":125.170,"note":99.000,"xyz":[116.625,278.000,-160.008]}},{"noteOn":{"time":125.205,"note":101.000,"xyz":[-0.295,302.000,273.830]}},{"noteOn":{"time":125.210,"note":105.000,"xyz":[-482.484,350.000,40.511]}},{"noteOn":{"time":125.290,"note":103.000,"xyz":[-152.666,326.000,281.772]}},{"noteOn":{"time":125.325,"note":109.000,"xyz":[84.187,398.000,-479.118]}},{"noteOn":{"time":125.350,"note":91.000,"xyz":[-162.682,182.000,153.498]}},{"noteOn":{"time":125.395,"note":95.000,"xyz":[79.573,230.000,3.588]}},{"noteOn":{"time":125.410,"note":91.000,"xyz":[-12.272,182.000,-48.588]}},{"noteOn":{"time":125.525,"note":105.000,"xyz":[424.142,350.000,76.167]}},{"noteOn":{"time":125.625,"note":97.000,"xyz":[-205.938,254.000,199.482]}},{"noteOn":{"time":125.710,"note":93.000,"xyz":[212.738,206.000,-116.228]}},{"noteOn":{"time":125.755,"note":99.000,"xyz":[-69.683,278.000,7.505]}},{"noteOn":{"time":125.760,"note":92.000,"xyz":[-56.398,194.000,-144.077]}},{"noteOn":{"time":125.800,"note":95.000,"xyz":[-251.023,230.000,35.106]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[-378.649,374.000,-31.973]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[186.933,374.000,-188.032]}},{"noteOn":{"time":125.910,"note":105.000,"xyz":[3.213,350.000,100.377]}},{"noteOn":{"time":125.990,"note":105.000,"xyz":[-18.029,350.000,-259.017]}},{"noteOn":{"time":126.010,"note":101.000,"xyz":[-411.071,302.000,222.489]}},{"noteOn":{"time":126.145,"note":107.000,"xyz":[111.721,374.000,-129.989]}},{"noteOn":{"time":126.160,"note":105.000,"xyz":[119.800,350.000,362.305]}},{"noteOn":{"time":126.220,"note":91.000,"xyz":[162.019,182.000,-216.890]}},{"noteOn":{"time":126.255,"note":93.000,"xyz":[244.094,206.000,-37.984]}},{"noteOn":{"time":126.285,"note":105.000,"xyz":[-30.379,350.000,131.383]}},{"noteOn":{"time":126.350,"note":99.000,"xyz":[179.248,278.000,199.181]}},{"noteOn":{"time":126.360,"note":97.000,"xyz":[-212.651,254.000,-174.353]}},{"noteOn":{"time":126.385,"note":99.000,"xyz":[-319.793,278.000,315.281]}},{"noteOn":{"time":126.445,"note":103.000,"xyz":[-244.517,326.000,-91.257]}},{"noteOn":{"time":126.515,"note":92.000,"xyz":[279.220,194.000,100.875]}},{"noteOn":{"time":126.530,"note":107.000,"xyz":[-136.140,374.000,128.010]}},{"noteOn":{"time":126.540,"note":107.000,"xyz":[383.223,374.000,143.806]}},{"noteOn":{"time":126.640,"note":103.000,"xyz":[-7.044,326.000,151.996]}},{"noteOn":{"time":126.765,"note":99.000,"xyz":[-36.478,278.000,-287.890]}},{"noteOn":{"time":126.790,"note":103.000,"xyz":[107.585,326.000,141.930]}},{"noteOn":{"time":126.865,"note":97.000,"xyz":[-369.021,254.000,210.569]}},{"noteOn":{"time":126.925,"note":93.000,"xyz":[237.601,206.000,-47.316]}},{"noteOn":{"time":127.055,"note":105.000,"xyz":[-2.982,350.000,-165.654]}},{"noteOn":{"time":127.065,"note":101.000,"xyz":[429.581,302.000,226.943]}},{"noteOn":{"time":127.075,"note":101.000,"xyz":[51.906,302.000,43.064]}},{"noteOn":{"time":127.110,"note":109.000,"xyz":[193.629,398.000,-78.553]}},{"noteOn":{"time":127.180,"note":100.000,"xyz":[238.404,290.000,416.219]}},{"noteOn":{"time":127.185,"note":101.000,"xyz":[-128.076,302.000,-387.230]}},{"noteOn":{"time":127.210,"note":100.000,"xyz":[-277.431,290.000,-364.248]}},{"noteOn":{"time":127.320,"note":109.000,"xyz":[484.364,398.000,1.325]}},{"noteOn":{"time":127.410,"note":99.000,"xyz":[137.579,278.000,21.739]}},{"noteOn":{"time":127.420,"note":93.000,"xyz":[110.073,206.000,128.739]}},{"noteOn":{"time":127.430,"note":101.000,"xyz":[-100.548,302.000,-156.874]}},{"noteOn":{"time":127.440,"note":91.000,"xyz":[155.262,182.000,129.344]}},{"noteOn":{"time":127.540,"note":105.000,"xyz":[75.431,350.000,-177.664]}},{"noteOn":{"time":127.615,"note":94.000,"xyz":[-34.834,218.000,75.324]}},{"noteOn":{"time":127.650,"note":99.000,"xyz":[-81.599,278.000,-132.242]}},{"noteOn":{"time":127.725,"note":98.000,"xyz":[101.809,266.000,56.103]}},{"noteOn":{"time":127.745,"note":111.000,"xyz":[25.746,422.000,130.485]}},{"noteOn":{"time":127.915,"note":99.000,"xyz":[-114.813,278.000,189.011]}},{"noteOn":{"time":127.985,"note":103.000,"xyz":[-0.431,326.000,173.545]}},{"noteOn":{"time":127.990,"note":95.000,"xyz":[147.623,230.000,-62.252]}},{"noteOn":{"time":128.000,"note":101.000,"xyz":[226.058,302.000,-93.718]}},{"noteOn":{"time":128.105,"note":98.000,"xyz":[150.144,266.000,134.029]}},{"noteOn":{"time":128.130,"note":99.000,"xyz":[-416.008,278.000,249.905]}},{"noteOn":{"time":128.130,"note":104.000,"xyz":[-203.593,338.000,-165.922]}},{"noteOn":{"time":128.165,"note":92.000,"xyz":[-374.227,194.000,-65.099]}},{"noteOn":{"time":128.165,"note":103.000,"xyz":[387.442,326.000,-37.690]}},{"noteOn":{"time":128.170,"note":107.000,"xyz":[-448.906,374.000,-159.125]}},{"noteOn":{"time":128.210,"note":101.000,"xyz":[-161.859,302.000,-55.558]}},{"noteOn":{"time":128.285,"note":108.000,"xyz":[-237.569,386.000,-395.570]}},{"noteOn":{"time":128.315,"note":102.000,"xyz":[275.892,314.000,-232.783]}},{"noteOn":{"time":128.530,"note":113.000,"xyz":[434.740,446.000,-34.932]}},{"noteOn":{"time":128.680,"note":98.000,"xyz":[-331.057,266.000,69.465]}},{"noteOn":{"time":128.710,"note":96.000,"xyz":[-60.175,242.000,-44.378]}},{"noteOn":{"time":128.910,"note":102.000,"xyz":[-86.734,314.000,47.745]}},{"noteOn":{"time":128.910,"note":103.000,"xyz":[-3.354,326.000,-53.862]}},{"noteOn":{"time":128.940,"note":101.000,"xyz":[476.017,302.000,-1.639]}},{"noteOn":{"time":128.965,"note":92.000,"xyz":[67.284,194.000,449.311]}},{"noteOn":{"time":128.990,"note":97.000,"xyz":[200.598,254.000,97.127]}},{"noteOn":{"time":129.000,"note":99.000,"xyz":[14.356,278.000,182.069]}},{"noteOn":{"time":129.010,"note":94.000,"xyz":[-39.866,218.000,-66.840]}},{"noteOn":{"time":129.045,"note":104.000,"xyz":[185.016,338.000,141.013]}},{"noteOn":{"time":129.050,"note":110.000,"xyz":[160.797,410.000,313.062]}},{"noteOn":{"time":129.095,"note":98.000,"xyz":[-27.242,266.000,221.712]}},{"noteOn":{"time":129.125,"note":106.000,"xyz":[-425.606,362.000,-122.516]}},{"noteOn":{"time":129.205,"note":101.000,"xyz":[52.929,302.000,67.768]}},{"noteOn":{"time":129.225,"note":98.000,"xyz":[-104.465,266.000,7.472]}},{"noteOn":{"time":129.455,"note":98.000,"xyz":[-438.114,266.000,26.955]}},{"noteOn":{"time":129.470,"note":99.000,"xyz":[-165.076,278.000,262.012]}},{"noteOn":{"time":129.570,"note":104.000,"xyz":[124.921,338.000,308.043]}},{"noteOn":{"time":129.570,"note":100.000,"xyz":[-423.247,290.000,-152.991]}},{"noteOn":{"time":129.685,"note":100.000,"xyz":[-346.647,290.000,-198.035]}},{"noteOn":{"time":129.690,"note":101.000,"xyz":[-183.390,302.000,-155.806]}},{"noteOn":{"time":129.770,"note":106.000,"xyz":[281.498,362.000,183.853]}},{"noteOn":{"time":129.845,"note":90.000,"xyz":[162.157,170.000,460.041]}},{"noteOn":{"time":129.875,"note":96.000,"xyz":[21.276,242.000,272.483]}},{"noteOn":{"time":129.950,"note":92.000,"xyz":[37.033,194.000,59.269]}},{"noteOn":{"time":130.045,"note":106.000,"xyz":[-18.249,362.000,-175.231]}},{"noteOn":{"time":130.075,"note":104.000,"xyz":[-329.374,338.000,-326.987]}},{"noteOn":{"time":130.090,"note":108.000,"xyz":[-213.766,386.000,418.098]}},{"noteOn":{"time":130.190,"note":98.000,"xyz":[81.817,266.000,-8.638]}},{"noteOn":{"time":130.205,"note":92.000,"xyz":[116.194,194.000,179.270]}},{"noteOn":{"time":130.270,"note":100.000,"xyz":[-312.698,290.000,131.963]}},{"noteOn":{"time":130.345,"note":104.000,"xyz":[249.519,338.000,-33.241]}},{"noteOn":{"time":130.375,"note":91.000,"xyz":[135.644,182.000,109.926]}},{"noteOn":{"time":130.395,"note":102.000,"xyz":[21.465,314.000,-226.873]}},{"noteOn":{"time":130.435,"note":104.000,"xyz":[67.349,338.000,-197.816]}},{"noteOn":{"time":130.465,"note":107.000,"xyz":[-96.742,374.000,105.567]}},{"noteOn":{"time":130.480,"note":96.000,"xyz":[-330.996,242.000,55.382]}},{"noteOn":{"time":130.555,"note":100.000,"xyz":[75.094,290.000,-252.512]}},{"noteOn":{"time":130.730,"note":90.000,"xyz":[345.783,170.000,150.926]}},{"noteOn":{"time":130.815,"note":106.000,"xyz":[-52.938,362.000,446.722]}},{"noteOn":{"time":130.845,"note":96.000,"xyz":[-185.841,242.000,-344.289]}},{"noteOn":{"time":130.860,"note":106.000,"xyz":[138.756,362.000,28.529]}},{"noteOn":{"time":130.870,"note":100.000,"xyz":[-23.733,290.000,239.567]}},{"noteOn":{"time":130.940,"note":102.000,"xyz":[-54.268,314.000,91.688]}},{"noteOn":{"time":131.000,"note":106.000,"xyz":[85.311,362.000,-64.864]}},{"noteOn":{"time":131.015,"note":110.000,"xyz":[302.969,410.000,-227.590]}},{"noteOn":{"time":131.015,"note":108.000,"xyz":[215.134,386.000,390.743]}},{"noteOn":{"time":131.045,"note":98.000,"xyz":[60.285,266.000,27.270]}},{"noteOn":{"time":131.105,"note":93.000,"xyz":[-218.636,206.000,-67.231]}},{"noteOn":{"time":131.195,"note":102.000,"xyz":[-355.808,314.000,-71.927]}},{"noteOn":{"time":131.350,"note":100.000,"xyz":[127.980,290.000,-214.620]}},{"noteOn":{"time":131.355,"note":98.000,"xyz":[-54.240,266.000,-183.312]}},{"noteOn":{"time":131.515,"note":112.000,"xyz":[62.380,434.000,-35.062]}},{"noteOn":{"time":131.520,"note":108.000,"xyz":[39.505,386.000,-37.217]}},{"noteOn":{"time":131.570,"note":104.000,"xyz":[-358.087,338.000,2.103]}},{"noteOn":{"time":131.630,"note":100.000,"xyz":[214.256,290.000,-382.136]}},{"noteOn":{"time":131.685,"note":94.000,"xyz":[2.862,218.000,322.637]}},{"noteOn":{"time":131.705,"note":100.000,"xyz":[-169.729,290.000,-113.827]}},{"noteOn":{"time":131.730,"note":102.000,"xyz":[142.692,314.000,-148.437]}},{"noteOn":{"time":131.750,"note":99.000,"xyz":[235.002,278.000,-257.991]}},{"noteOn":{"time":131.885,"note":102.000,"xyz":[29.421,314.000,222.655]}},{"noteOn":{"time":131.935,"note":100.000,"xyz":[-79.459,290.000,76.135]}},{"noteOn":{"time":131.935,"note":110.000,"xyz":[-87.760,410.000,-286.900]}},{"noteOn":{"time":131.965,"note":94.000,"xyz":[-274.870,218.000,180.185]}},{"noteOn":{"time":132.025,"note":98.000,"xyz":[-226.821,266.000,86.069]}},{"noteOn":{"time":132.060,"note":114.000,"xyz":[-327.095,458.000,57.819]}},{"noteOn":{"time":132.065,"note":110.000,"xyz":[-347.388,410.000,-232.201]}},{"noteOn":{"time":132.150,"note":102.000,"xyz":[-11.496,314.000,-86.968]}},{"noteOn":{"time":132.165,"note":106.000,"xyz":[-217.608,362.000,-98.502]}},{"noteOn":{"time":132.230,"note":97.000,"xyz":[160.229,254.000,123.988]}},{"noteOn":{"time":132.285,"note":104.000,"xyz":[-169.174,338.000,-33.909]}},{"noteOn":{"time":132.360,"note":98.000,"xyz":[46.844,266.000,-75.760]}},{"noteOn":{"time":132.485,"note":96.000,"xyz":[95.655,242.000,-6.897]}},{"noteOn":{"time":132.535,"note":102.000,"xyz":[-286.518,314.000,68.241]}},{"noteOn":{"time":132.635,"note":100.000,"xyz":[250.401,290.000,-218.768]}},{"noteOn":{"time":132.650,"note":102.000,"xyz":[-64.429,314.000,172.629]}},{"noteOn":{"time":132.695,"note":97.000,"xyz":[282.055,254.000,-164.414]}},{"noteOn":{"time":132.695,"note":92.000,"xyz":[435.569,194.000,-50.275]}},{"noteOn":{"time":132.755,"note":108.000,"xyz":[270.241,386.000,-147.880]}},{"noteOn":{"time":132.775,"note":104.000,"xyz":[96.048,338.000,42.388]}},{"noteOn":{"time":132.915,"note":108.000,"xyz":[133.057,386.000,-31.878]}},{"noteOn":{"time":133.045,"note":104.000,"xyz":[116.095,338.000,374.280]}},{"noteOn":{"time":133.050,"note":112.000,"xyz":[-331.543,434.000,-287.536]}},{"noteOn":{"time":133.155,"note":101.000,"xyz":[257.003,302.000,-97.332]}},{"noteOn":{"time":133.205,"note":97.000,"xyz":[-77.129,254.000,-297.878]}},{"noteOn":{"time":133.235,"note":104.000,"xyz":[-128.431,338.000,-110.946]}},{"noteOn":{"time":133.315,"note":102.000,"xyz":[77.500,314.000,342.138]}},{"noteOn":{"time":133.405,"note":100.000,"xyz":[-440.640,290.000,211.064]}},{"noteOn":{"time":133.415,"note":92.000,"xyz":[-67.444,194.000,-222.767]}},{"noteOn":{"time":133.445,"note":96.000,"xyz":[-360.282,242.000,247.486]}},{"noteOn":{"time":133.470,"note":98.000,"xyz":[216.177,266.000,-175.662]}},{"noteOn":{"time":133.490,"note":95.000,"xyz":[-241.132,230.000,-287.675]}},{"noteOn":{"time":133.630,"note":106.000,"xyz":[-23.325,362.000,-44.358]}},{"noteOn":{"time":133.640,"note":105.000,"xyz":[-445.049,350.000,-125.012]}},{"noteOn":{"time":133.665,"note":99.000,"xyz":[431.433,278.000,-48.401]}},{"noteOn":{"time":133.735,"note":99.000,"xyz":[-369.646,278.000,-66.189]}},{"noteOn":{"time":133.790,"note":99.000,"xyz":[-70.960,278.000,-450.959]}},{"noteOn":{"time":133.820,"note":106.000,"xyz":[67.025,362.000,-466.255]}},{"noteOn":{"time":133.920,"note":110.000,"xyz":[208.748,410.000,366.642]}},{"noteOn":{"time":134.065,"note":98.000,"xyz":[19.656,266.000,-195.016]}},{"noteOn":{"time":134.105,"note":99.000,"xyz":[-218.069,278.000,307.556]}},{"noteOn":{"time":134.110,"note":108.000,"xyz":[-128.864,386.000,-73.760]}},{"noteOn":{"time":134.140,"note":100.000,"xyz":[291.466,290.000,-238.032]}},{"noteOn":{"time":134.170,"note":96.000,"xyz":[-185.725,242.000,245.455]}},{"noteOn":{"time":134.215,"note":106.000,"xyz":[207.811,362.000,-340.072]}},{"noteOn":{"time":134.255,"note":89.000,"xyz":[-2.717,158.000,-189.715]}},{"noteOn":{"time":134.280,"note":101.000,"xyz":[-62.497,302.000,-142.349]}},{"noteOn":{"time":134.450,"note":103.000,"xyz":[-331.538,326.000,-347.000]}},{"noteOn":{"time":134.480,"note":108.000,"xyz":[-202.288,386.000,4.921]}},{"noteOn":{"time":134.515,"note":105.000,"xyz":[24.219,350.000,44.426]}},{"noteOn":{"time":134.575,"note":106.000,"xyz":[411.534,362.000,-233.098]}},{"noteOn":{"time":134.665,"note":97.000,"xyz":[224.110,254.000,250.133]}},{"noteOn":{"time":134.690,"note":101.000,"xyz":[-302.642,302.000,160.551]}},{"noteOn":{"time":134.690,"note":103.000,"xyz":[-473.167,326.000,-142.228]}},{"noteOn":{"time":134.705,"note":91.000,"xyz":[-273.975,182.000,185.313]}},{"noteOn":{"time":134.875,"note":108.000,"xyz":[-401.093,386.000,-100.038]}},{"noteOn":{"time":134.890,"note":103.000,"xyz":[-67.063,326.000,-330.323]}},{"noteOn":{"time":134.985,"note":91.000,"xyz":[-8.280,182.000,51.486]}},{"noteOn":{"time":135.010,"note":99.000,"xyz":[32.612,278.000,-308.297]}},{"noteOn":{"time":135.020,"note":105.000,"xyz":[35.951,350.000,79.657]}},{"noteOn":{"time":135.030,"note":107.000,"xyz":[-83.385,374.000,-103.766]}},{"noteOn":{"time":135.045,"note":96.000,"xyz":[120.972,242.000,137.527]}},{"noteOn":{"time":135.195,"note":105.000,"xyz":[131.736,350.000,40.108]}},{"noteOn":{"time":135.235,"note":91.000,"xyz":[202.135,182.000,-353.127]}},{"noteOn":{"time":135.250,"note":109.000,"xyz":[-131.025,398.000,-302.123]}},{"noteOn":{"time":135.345,"note":101.000,"xyz":[26.469,302.000,299.728]}},{"noteOn":{"time":135.350,"note":95.000,"xyz":[216.980,230.000,-102.792]}},{"noteOn":{"time":135.405,"note":101.000,"xyz":[75.172,302.000,-61.725]}},{"noteOn":{"time":135.545,"note":101.000,"xyz":[-141.156,302.000,291.447]}},{"noteOn":{"time":135.595,"note":106.000,"xyz":[105.000,362.000,-393.416]}},{"noteOn":{"time":135.615,"note":101.000,"xyz":[-65.576,302.000,-64.604]}},{"noteOn":{"time":135.695,"note":94.000,"xyz":[24.978,218.000,257.360]}},{"noteOn":{"time":135.730,"note":99.000,"xyz":[97.086,278.000,-41.188]}},{"noteOn":{"time":135.750,"note":99.000,"xyz":[-80.939,278.000,-70.727]}},{"noteOn":{"time":135.855,"note":97.000,"xyz":[-340.954,254.000,-29.341]}},{"noteOn":{"time":135.915,"note":113.000,"xyz":[-232.731,446.000,201.097]}},{"noteOn":{"time":136.000,"note":109.000,"xyz":[-89.206,398.000,86.628]}},{"noteOn":{"time":136.050,"note":103.000,"xyz":[-28.393,326.000,223.383]}},{"noteOn":{"time":136.200,"note":99.000,"xyz":[-418.539,278.000,110.069]}},{"noteOn":{"time":136.250,"note":111.000,"xyz":[-109.895,422.000,-279.992]}},{"noteOn":{"time":136.270,"note":99.000,"xyz":[284.209,278.000,251.944]}},{"noteOn":{"time":136.280,"note":93.000,"xyz":[-321.080,206.000,139.245]}},{"noteOn":{"time":136.315,"note":103.000,"xyz":[-90.806,326.000,-121.965]}},{"noteOn":{"time":136.315,"note":98.000,"xyz":[62.437,266.000,478.865]}},{"noteOn":{"time":136.345,"note":101.000,"xyz":[-68.182,302.000,9.921]}},{"noteOn":{"time":136.420,"note":95.000,"xyz":[144.208,230.000,-314.428]}},{"noteOn":{"time":136.425,"note":107.000,"xyz":[74.351,374.000,-27.326]}},{"noteOn":{"time":136.445,"note":103.000,"xyz":[54.961,326.000,-24.255]}},{"noteOn":{"time":136.685,"note":99.000,"xyz":[135.281,278.000,195.009]}},{"noteOn":{"time":136.740,"note":97.000,"xyz":[-25.564,254.000,-171.070]}},{"noteOn":{"time":136.760,"note":113.000,"xyz":[361.158,446.000,213.486]}},{"noteOn":{"time":136.825,"note":101.000,"xyz":[0.913,302.000,187.323]}},{"noteOn":{"time":136.865,"note":111.000,"xyz":[-97.281,422.000,-52.828]}},{"noteOn":{"time":136.880,"note":97.000,"xyz":[236.783,254.000,-349.222]}},{"noteOn":{"time":136.945,"note":97.000,"xyz":[398.066,254.000,239.585]}},{"noteOn":{"time":136.970,"note":103.000,"xyz":[33.101,326.000,50.113]}},{"noteOn":{"time":137.045,"note":109.000,"xyz":[51.360,398.000,-4.723]}},{"noteOn":{"time":137.130,"note":103.000,"xyz":[125.931,326.000,-148.151]}},{"noteOn":{"time":137.230,"note":93.000,"xyz":[-274.700,206.000,-251.962]}},{"noteOn":{"time":137.240,"note":109.000,"xyz":[-160.922,398.000,337.427]}},{"noteOn":{"time":137.285,"note":96.000,"xyz":[-261.383,242.000,-290.226]}},{"noteOn":{"time":137.355,"note":105.000,"xyz":[-240.585,350.000,-232.011]}},{"noteOn":{"time":137.405,"note":105.000,"xyz":[-7.513,350.000,191.944]}},{"noteOn":{"time":137.545,"note":107.000,"xyz":[-39.476,374.000,69.156]}},{"noteOn":{"time":137.575,"note":111.000,"xyz":[117.531,422.000,196.959]}},{"noteOn":{"time":137.615,"note":101.000,"xyz":[20.698,302.000,137.103]}},{"noteOn":{"time":137.635,"note":105.000,"xyz":[-241.498,350.000,132.062]}},{"noteOn":{"time":137.700,"note":97.000,"xyz":[-139.126,254.000,-173.589]}},{"noteOn":{"time":137.810,"note":99.000,"xyz":[-247.862,278.000,-431.021]}},{"noteOn":{"time":137.830,"note":91.000,"xyz":[326.465,182.000,-123.088]}},{"noteOn":{"time":137.920,"note":95.000,"xyz":[200.017,230.000,-113.643]}},{"noteOn":{"time":137.930,"note":101.000,"xyz":[-166.007,302.000,-76.611]}},{"noteOn":{"time":137.965,"note":95.000,"xyz":[497.446,230.000,31.484]}},{"noteOn":{"time":138.045,"note":103.000,"xyz":[-212.328,326.000,148.706]}},{"noteOn":{"time":138.170,"note":99.000,"xyz":[-39.968,278.000,-251.350]}},{"noteOn":{"time":138.195,"note":105.000,"xyz":[231.414,350.000,318.635]}},{"noteOn":{"time":138.230,"note":100.000,"xyz":[12.908,290.000,-65.770]}},{"noteOn":{"time":138.245,"note":100.000,"xyz":[436.349,290.000,-59.512]}},{"noteOn":{"time":138.255,"note":103.000,"xyz":[225.083,326.000,262.254]}},{"noteOn":{"time":138.325,"note":107.000,"xyz":[-19.906,374.000,83.261]}},{"noteOn":{"time":138.350,"note":109.000,"xyz":[-325.063,398.000,-12.402]}},{"noteOn":{"time":138.495,"note":97.000,"xyz":[142.844,254.000,-200.283]}},{"noteOn":{"time":138.530,"note":99.000,"xyz":[-271.073,278.000,-105.476]}},{"noteOn":{"time":138.535,"note":105.000,"xyz":[1.609,350.000,-159.253]}},{"noteOn":{"time":138.625,"note":89.000,"xyz":[376.219,158.000,-61.097]}},{"noteOn":{"time":138.650,"note":100.000,"xyz":[-34.525,290.000,141.132]}},{"noteOn":{"time":138.660,"note":97.000,"xyz":[50.451,254.000,109.902]}},{"noteOn":{"time":138.725,"note":101.000,"xyz":[-88.373,302.000,-23.007]}},{"noteOn":{"time":138.745,"note":105.000,"xyz":[88.600,350.000,59.606]}},{"noteOn":{"time":138.755,"note":105.000,"xyz":[70.190,350.000,76.564]}},{"noteOn":{"time":138.780,"note":107.000,"xyz":[-82.667,374.000,-182.643]}},{"noteOn":{"time":138.860,"note":107.000,"xyz":[217.173,374.000,-108.876]}},{"noteOn":{"time":138.870,"note":102.000,"xyz":[454.132,314.000,184.462]}},{"noteOn":{"time":139.055,"note":107.000,"xyz":[294.127,374.000,357.342]}},{"noteOn":{"time":139.145,"note":96.000,"xyz":[-189.044,242.000,225.674]}},{"noteOn":{"time":139.200,"note":90.000,"xyz":[24.109,170.000,-100.143]}},{"noteOn":{"time":139.285,"note":107.000,"xyz":[-347.389,374.000,201.673]}},{"noteOn":{"time":139.365,"note":103.000,"xyz":[385.382,326.000,-49.942]}},{"noteOn":{"time":139.370,"note":105.000,"xyz":[139.322,350.000,-131.422]}},{"noteOn":{"time":139.395,"note":103.000,"xyz":[-130.915,326.000,468.164]}},{"noteOn":{"time":139.425,"note":99.000,"xyz":[49.324,278.000,-44.011]}},{"noteOn":{"time":139.490,"note":97.000,"xyz":[-260.208,254.000,-366.373]}},{"noteOn":{"time":139.520,"note":108.000,"xyz":[-162.510,386.000,451.597]}},{"noteOn":{"time":139.600,"note":92.000,"xyz":[-465.185,194.000,-77.880]}},{"noteOn":{"time":139.635,"note":102.000,"xyz":[-3.369,314.000,83.667]}},{"noteOn":{"time":139.645,"note":103.000,"xyz":[-228.606,326.000,-362.433]}},{"noteOn":{"time":139.730,"note":109.000,"xyz":[61.366,398.000,118.252]}},{"noteOn":{"time":139.745,"note":92.000,"xyz":[31.797,194.000,44.963]}},{"noteOn":{"time":139.765,"note":105.000,"xyz":[-264.634,350.000,105.004]}},{"noteOn":{"time":139.935,"note":102.000,"xyz":[221.249,314.000,32.477]}},{"noteOn":{"time":140.075,"note":109.000,"xyz":[163.108,398.000,-413.095]}},{"noteOn":{"time":140.105,"note":100.000,"xyz":[46.217,290.000,-39.991]}},{"noteOn":{"time":140.175,"note":101.000,"xyz":[-225.250,302.000,21.521]}},{"noteOn":{"time":140.195,"note":105.000,"xyz":[44.763,350.000,-128.128]}},{"noteOn":{"time":140.245,"note":100.000,"xyz":[167.637,290.000,94.876]}},{"noteOn":{"time":140.285,"note":94.000,"xyz":[-167.245,218.000,108.558]}},{"noteOn":{"time":140.295,"note":99.000,"xyz":[59.626,278.000,-125.895]}},{"noteOn":{"time":140.310,"note":96.000,"xyz":[338.758,242.000,-23.671]}},{"noteOn":{"time":140.385,"note":94.000,"xyz":[-409.378,218.000,-266.256]}},{"noteOn":{"time":140.425,"note":114.000,"xyz":[199.250,458.000,225.481]}},{"noteOn":{"time":140.495,"note":98.000,"xyz":[-84.088,266.000,313.185]}},{"noteOn":{"time":140.580,"note":103.000,"xyz":[441.473,326.000,174.826]}},{"noteOn":{"time":140.690,"note":108.000,"xyz":[-39.219,386.000,-134.602]}},{"noteOn":{"time":140.700,"note":98.000,"xyz":[66.445,266.000,25.042]}},{"noteOn":{"time":140.755,"note":101.000,"xyz":[137.433,302.000,-43.432]}},{"noteOn":{"time":140.835,"note":96.000,"xyz":[-67.709,242.000,119.716]}},{"noteOn":{"time":140.885,"note":97.000,"xyz":[165.900,254.000,-256.668]}},{"noteOn":{"time":140.890,"note":112.000,"xyz":[-77.780,434.000,-141.128]}},{"noteOn":{"time":140.900,"note":104.000,"xyz":[-223.632,338.000,296.945]}},{"noteOn":{"time":140.925,"note":104.000,"xyz":[153.410,338.000,120.641]}},{"noteOn":{"time":140.955,"note":98.000,"xyz":[337.664,266.000,-196.853]}},{"noteOn":{"time":141.050,"note":110.000,"xyz":[148.157,410.000,-234.570]}},{"noteOn":{"time":141.200,"note":112.000,"xyz":[25.178,434.000,83.068]}},{"noteOn":{"time":141.250,"note":96.000,"xyz":[26.372,242.000,207.413]}},{"noteOn":{"time":141.315,"note":100.000,"xyz":[-23.746,290.000,98.744]}},{"noteOn":{"time":141.375,"note":94.000,"xyz":[-265.245,218.000,265.948]}},{"noteOn":{"time":141.405,"note":98.000,"xyz":[-32.895,266.000,-57.529]}},{"noteOn":{"time":141.450,"note":102.000,"xyz":[-310.912,314.000,-383.792]}},{"noteOn":{"time":141.470,"note":96.000,"xyz":[52.060,242.000,-383.845]}},{"noteOn":{"time":141.560,"note":108.000,"xyz":[-21.222,386.000,-167.456]}},{"noteOn":{"time":141.660,"note":108.000,"xyz":[-135.481,386.000,-321.298]}},{"noteOn":{"time":141.725,"note":106.000,"xyz":[-158.122,362.000,117.245]}},{"noteOn":{"time":141.730,"note":103.000,"xyz":[-297.178,326.000,-246.394]}},{"noteOn":{"time":141.760,"note":94.000,"xyz":[149.425,218.000,-91.191]}},{"noteOn":{"time":141.820,"note":102.000,"xyz":[-277.373,314.000,332.881]}},{"noteOn":{"time":141.875,"note":95.000,"xyz":[-158.699,230.000,320.360]}},{"noteOn":{"time":141.920,"note":106.000,"xyz":[223.922,362.000,-40.610]}},{"noteOn":{"time":141.990,"note":106.000,"xyz":[-282.997,362.000,123.473]}},{"noteOn":{"time":142.055,"note":110.000,"xyz":[-338.353,410.000,-82.165]}},{"noteOn":{"time":142.105,"note":106.000,"xyz":[-345.610,362.000,-8.772]}},{"noteOn":{"time":142.155,"note":102.000,"xyz":[62.926,314.000,-70.508]}},{"noteOn":{"time":142.200,"note":98.000,"xyz":[-248.887,266.000,-226.432]}},{"noteOn":{"time":142.235,"note":98.000,"xyz":[-15.558,266.000,-228.493]}},{"noteOn":{"time":142.245,"note":90.000,"xyz":[175.455,170.000,-339.235]}},{"noteOn":{"time":142.270,"note":104.000,"xyz":[303.810,338.000,-60.144]}},{"noteOn":{"time":142.365,"note":96.000,"xyz":[189.221,242.000,24.295]}},{"noteOn":{"time":142.440,"note":96.000,"xyz":[-74.342,242.000,127.951]}},{"noteOn":{"time":142.510,"note":100.000,"xyz":[155.390,290.000,-32.376]}},{"noteOn":{"time":142.525,"note":104.000,"xyz":[225.689,338.000,-23.475]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[1.308,386.000,459.751]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[392.812,386.000,253.108]}},{"noteOn":{"time":142.755,"note":100.000,"xyz":[-25.608,290.000,129.223]}},{"noteOn":{"time":142.775,"note":104.000,"xyz":[97.068,338.000,412.333]}},{"noteOn":{"time":142.800,"note":101.000,"xyz":[139.081,302.000,371.376]}},{"noteOn":{"time":142.860,"note":106.000,"xyz":[486.423,362.000,51.400]}},{"noteOn":{"time":142.885,"note":104.000,"xyz":[19.870,338.000,-98.478]}},{"noteOn":{"time":142.930,"note":112.000,"xyz":[176.919,434.000,82.223]}},{"noteOn":{"time":142.945,"note":98.000,"xyz":[-402.524,266.000,-278.338]}},{"noteOn":{"time":142.950,"note":98.000,"xyz":[236.644,266.000,-69.587]}},{"noteOn":{"time":142.995,"note":90.000,"xyz":[368.159,170.000,325.987]}},{"noteOn":{"time":143.110,"note":100.000,"xyz":[-150.322,290.000,60.525]}},{"noteOn":{"time":143.195,"note":96.000,"xyz":[181.982,242.000,80.628]}},{"noteOn":{"time":143.280,"note":102.000,"xyz":[310.051,314.000,45.237]}},{"noteOn":{"time":143.335,"note":106.000,"xyz":[418.999,362.000,1.510]}},{"noteOn":{"time":143.460,"note":103.000,"xyz":[-270.319,326.000,375.839]}},{"noteOn":{"time":143.470,"note":102.000,"xyz":[-190.735,314.000,-390.765]}},{"noteOn":{"time":143.555,"note":106.000,"xyz":[-364.070,362.000,293.857]}},{"noteOn":{"time":143.580,"note":108.000,"xyz":[-169.658,386.000,167.320]}},{"noteOn":{"time":143.620,"note":96.000,"xyz":[-407.116,242.000,203.451]}},{"noteOn":{"time":143.625,"note":106.000,"xyz":[-198.083,362.000,-68.908]}},{"noteOn":{"time":143.700,"note":91.000,"xyz":[-114.968,182.000,-39.055]}},{"noteOn":{"time":143.765,"note":106.000,"xyz":[181.750,362.000,100.500]}},{"noteOn":{"time":143.815,"note":98.000,"xyz":[148.440,266.000,-74.061]}},{"noteOn":{"time":143.835,"note":98.000,"xyz":[-102.364,266.000,-84.988]}},{"noteOn":{"time":143.835,"note":114.000,"xyz":[85.342,458.000,-264.226]}},{"noteOn":{"time":143.920,"note":100.000,"xyz":[-252.965,290.000,-265.000]}},{"noteOn":{"time":143.925,"note":102.000,"xyz":[65.086,314.000,-52.959]}},{"noteOn":{"time":144.070,"note":104.000,"xyz":[-144.273,338.000,-25.651]}},{"noteOn":{"time":144.155,"note":100.000,"xyz":[113.972,290.000,27.365]}},{"noteOn":{"time":144.175,"note":102.000,"xyz":[83.726,314.000,165.979]}},{"noteOn":{"time":144.210,"note":93.000,"xyz":[203.469,206.000,-209.486]}},{"noteOn":{"time":144.260,"note":93.000,"xyz":[37.860,206.000,-157.538]}},{"noteOn":{"time":144.315,"note":108.000,"xyz":[337.494,386.000,122.649]}},{"noteOn":{"time":144.355,"note":104.000,"xyz":[-47.767,338.000,-371.563]}},{"noteOn":{"time":144.465,"note":103.000,"xyz":[117.883,326.000,165.979]}},{"noteOn":{"time":144.550,"note":110.000,"xyz":[-339.614,410.000,-248.395]}},{"noteOn":{"time":144.585,"note":104.000,"xyz":[370.941,338.000,160.510]}},{"noteOn":{"time":144.670,"note":104.000,"xyz":[-46.720,338.000,-38.156]}},{"noteOn":{"time":144.675,"note":110.000,"xyz":[-215.119,410.000,-214.772]}},{"noteOn":{"time":144.690,"note":100.000,"xyz":[91.019,290.000,194.826]}},{"noteOn":{"time":144.745,"note":100.000,"xyz":[-337.548,290.000,-177.081]}},{"noteOn":{"time":144.770,"note":96.000,"xyz":[-178.532,242.000,-441.297]}},{"noteOn":{"time":144.850,"note":102.000,"xyz":[-212.881,314.000,154.102]}},{"noteOn":{"time":144.875,"note":95.000,"xyz":[317.645,230.000,-271.095]}},{"noteOn":{"time":144.890,"note":100.000,"xyz":[37.841,290.000,495.499]}},{"noteOn":{"time":144.975,"note":110.000,"xyz":[70.751,410.000,31.630]}},{"noteOn":{"time":145.025,"note":114.000,"xyz":[-107.069,458.000,-131.104]}},{"noteOn":{"time":145.060,"note":102.000,"xyz":[281.830,314.000,43.592]}},{"noteOn":{"time":145.085,"note":98.000,"xyz":[-155.699,266.000,44.647]}},{"noteOn":{"time":145.200,"note":97.000,"xyz":[-72.372,254.000,-242.665]}},{"noteOn":{"time":145.295,"note":96.000,"xyz":[190.035,242.000,-346.999]}},{"noteOn":{"time":145.300,"note":102.000,"xyz":[-302.230,314.000,116.676]}},{"noteOn":{"time":145.320,"note":108.000,"xyz":[97.460,386.000,141.602]}},{"noteOn":{"time":145.445,"note":103.000,"xyz":[8.632,326.000,113.830]}},{"noteOn":{"time":145.455,"note":97.000,"xyz":[-19.321,254.000,100.837]}},{"noteOn":{"time":145.455,"note":107.000,"xyz":[150.068,374.000,216.488]}},{"noteOn":{"time":145.480,"note":112.000,"xyz":[-79.781,434.000,1.011]}},{"noteOn":{"time":145.485,"note":104.000,"xyz":[-220.076,338.000,50.336]}},{"noteOn":{"time":145.490,"note":106.000,"xyz":[-43.350,362.000,-172.774]}},{"noteOn":{"time":145.525,"note":98.000,"xyz":[-140.270,266.000,-307.062]}},{"noteOn":{"time":145.575,"note":102.000,"xyz":[-46.968,314.000,32.520]}},{"noteOn":{"time":145.635,"note":112.000,"xyz":[331.367,434.000,-265.149]}},{"noteOn":{"time":145.650,"note":101.000,"xyz":[254.043,302.000,10.595]}},{"noteOn":{"time":145.685,"note":93.000,"xyz":[352.619,206.000,-86.389]}},{"noteOn":{"time":145.765,"note":95.000,"xyz":[-129.542,230.000,-241.636]}},{"noteOn":{"time":145.910,"note":99.000,"xyz":[87.576,278.000,-227.724]}},{"noteOn":{"time":146.035,"note":105.000,"xyz":[21.536,350.000,84.850]}},{"noteOn":{"time":146.070,"note":107.000,"xyz":[-43.494,374.000,-421.870]}},{"noteOn":{"time":146.090,"note":103.000,"xyz":[-172.549,326.000,-116.315]}},{"noteOn":{"time":146.135,"note":107.000,"xyz":[-167.403,374.000,158.927]}},{"noteOn":{"time":146.140,"note":104.000,"xyz":[-289.018,338.000,-279.579]}},{"noteOn":{"time":146.160,"note":96.000,"xyz":[219.242,242.000,-139.348]}},{"noteOn":{"time":146.250,"note":95.000,"xyz":[-178.779,230.000,62.493]}},{"noteOn":{"time":146.295,"note":105.000,"xyz":[52.588,350.000,290.873]}},{"noteOn":{"time":146.435,"note":109.000,"xyz":[-25.378,398.000,482.101]}},{"noteOn":{"time":146.445,"note":95.000,"xyz":[157.349,230.000,88.538]}},{"noteOn":{"time":146.460,"note":107.000,"xyz":[472.432,374.000,-125.005]}},{"noteOn":{"time":146.535,"note":109.000,"xyz":[-105.994,398.000,2.032]}},{"noteOn":{"time":146.585,"note":95.000,"xyz":[418.106,230.000,-160.072]}},{"noteOn":{"time":146.670,"note":105.000,"xyz":[-102.203,350.000,46.638]}},{"noteOn":{"time":146.695,"note":101.000,"xyz":[74.682,302.000,393.866]}},{"noteOn":{"time":146.700,"note":99.000,"xyz":[392.074,278.000,71.833]}},{"noteOn":{"time":146.705,"note":89.000,"xyz":[369.384,158.000,-183.522]}},{"noteOn":{"time":146.810,"note":105.000,"xyz":[366.396,350.000,-97.503]}},{"noteOn":{"time":146.830,"note":98.000,"xyz":[-11.065,266.000,191.178]}},{"noteOn":{"time":146.875,"note":97.000,"xyz":[119.503,254.000,-121.316]}},{"noteOn":{"time":146.910,"note":107.000,"xyz":[485.369,374.000,74.041]}},{"noteOn":{"time":146.925,"note":97.000,"xyz":[-194.608,254.000,-30.991]}},{"noteOn":{"time":147.145,"note":107.000,"xyz":[-75.669,374.000,13.989]}},{"noteOn":{"time":147.155,"note":103.000,"xyz":[299.648,326.000,72.712]}},{"noteOn":{"time":147.205,"note":109.000,"xyz":[-184.972,398.000,15.019]}},{"noteOn":{"time":147.265,"note":101.000,"xyz":[-302.485,302.000,-34.372]}},{"noteOn":{"time":147.330,"note":103.000,"xyz":[-345.602,326.000,-26.411]}},{"noteOn":{"time":147.350,"note":102.000,"xyz":[-172.859,314.000,8.365]}},{"noteOn":{"time":147.410,"note":91.000,"xyz":[70.764,182.000,-65.508]}},{"noteOn":{"time":147.425,"note":97.000,"xyz":[91.978,254.000,-346.670]}},{"noteOn":{"time":147.455,"note":101.000,"xyz":[44.225,302.000,-91.709]}},{"noteOn":{"time":147.470,"note":107.000,"xyz":[-97.237,374.000,-50.863]}},{"noteOn":{"time":147.585,"note":101.000,"xyz":[-154.595,302.000,-376.042]}},{"noteOn":{"time":147.610,"note":97.000,"xyz":[-254.973,254.000,372.671]}},{"noteOn":{"time":147.645,"note":105.000,"xyz":[92.484,350.000,-69.832]}},{"noteOn":{"time":147.665,"note":99.000,"xyz":[85.571,278.000,152.436]}},{"noteOn":{"time":147.690,"note":103.000,"xyz":[-412.554,326.000,-98.375]}},{"noteOn":{"time":147.895,"note":105.000,"xyz":[-229.854,350.000,291.872]}},{"noteOn":{"time":148.010,"note":113.000,"xyz":[342.160,446.000,199.316]}},{"noteOn":{"time":148.035,"note":102.000,"xyz":[-168.540,314.000,-145.999]}},{"noteOn":{"time":148.060,"note":109.000,"xyz":[495.969,398.000,2.313]}},{"noteOn":{"time":148.090,"note":107.000,"xyz":[435.953,374.000,-37.605]}},{"noteOn":{"time":148.140,"note":99.000,"xyz":[185.150,278.000,-116.843]}},{"noteOn":{"time":148.150,"note":95.000,"xyz":[-425.769,230.000,-253.141]}},{"noteOn":{"time":148.200,"note":91.000,"xyz":[-494.116,182.000,-10.692]}},{"noteOn":{"time":148.295,"note":97.000,"xyz":[229.157,254.000,-27.349]}},{"noteOn":{"time":148.325,"note":99.000,"xyz":[-201.377,278.000,-287.752]}},{"noteOn":{"time":148.365,"note":105.000,"xyz":[103.713,350.000,130.306]}},{"noteOn":{"time":148.485,"note":101.000,"xyz":[93.838,302.000,222.774]}},{"noteOn":{"time":148.525,"note":115.000,"xyz":[-449.324,470.000,96.940]}},{"noteOn":{"time":148.560,"note":99.000,"xyz":[332.016,278.000,-125.447]}},{"noteOn":{"time":148.580,"note":101.000,"xyz":[11.692,302.000,400.563]}},{"noteOn":{"time":148.595,"note":103.000,"xyz":[60.101,326.000,-20.284]}},{"noteOn":{"time":148.675,"note":111.000,"xyz":[135.199,422.000,-36.758]}},{"noteOn":{"time":148.770,"note":103.000,"xyz":[359.665,326.000,-117.853]}},{"noteOn":{"time":148.770,"note":93.000,"xyz":[-338.623,206.000,-122.255]}},{"noteOn":{"time":148.805,"note":94.000,"xyz":[174.690,218.000,-388.809]}},{"noteOn":{"time":148.815,"note":109.000,"xyz":[332.700,398.000,-255.847]}},{"noteOn":{"time":149.050,"note":103.000,"xyz":[-204.994,326.000,-41.034]}},{"noteOn":{"time":149.080,"note":103.000,"xyz":[278.332,326.000,-113.594]}},{"noteOn":{"time":149.090,"note":101.000,"xyz":[178.161,302.000,-252.888]}},{"noteOn":{"time":149.195,"note":105.000,"xyz":[-90.290,350.000,-156.985]}},{"noteOn":{"time":149.220,"note":101.000,"xyz":[-210.554,302.000,290.122]}},{"noteOn":{"time":149.275,"note":95.000,"xyz":[2.031,230.000,-222.741]}},{"noteOn":{"time":149.315,"note":99.000,"xyz":[69.142,278.000,115.897]}},{"noteOn":{"time":149.330,"note":109.000,"xyz":[120.081,398.000,16.705]}},{"noteOn":{"time":149.330,"note":99.000,"xyz":[-53.625,278.000,-398.889]}},{"noteOn":{"time":149.335,"note":113.000,"xyz":[-19.442,446.000,281.134]}},{"noteOn":{"time":149.365,"note":99.000,"xyz":[-49.122,278.000,-11.381]}},{"noteOn":{"time":149.450,"note":96.000,"xyz":[304.429,242.000,-5.015]}},{"noteOn":{"time":149.535,"note":111.000,"xyz":[-126.063,422.000,-304.788]}},{"noteOn":{"time":149.535,"note":101.000,"xyz":[233.613,302.000,142.025]}},{"noteOn":{"time":149.700,"note":96.000,"xyz":[127.305,242.000,3.774]}},{"noteOn":{"time":149.845,"note":97.000,"xyz":[-338.437,254.000,25.542]}},{"noteOn":{"time":149.875,"note":107.000,"xyz":[135.664,374.000,-158.740]}},{"noteOn":{"time":149.900,"note":103.000,"xyz":[225.413,326.000,39.093]}},{"noteOn":{"time":149.930,"note":105.000,"xyz":[291.152,350.000,186.617]}},{"noteOn":{"time":149.975,"note":103.000,"xyz":[-367.127,326.000,50.176]}},{"noteOn":{"time":149.995,"note":97.000,"xyz":[-229.364,254.000,155.096]}},{"noteOn":{"time":150.005,"note":96.000,"xyz":[-46.315,242.000,-78.691]}},{"noteOn":{"time":150.025,"note":101.000,"xyz":[-369.484,302.000,-261.980]}},{"noteOn":{"time":150.060,"note":103.000,"xyz":[-357.003,326.000,-212.962]}},{"noteOn":{"time":150.170,"note":109.000,"xyz":[-262.767,398.000,18.113]}},{"noteOn":{"time":150.265,"note":107.000,"xyz":[178.237,374.000,176.161]}},{"noteOn":{"time":150.275,"note":94.000,"xyz":[75.566,218.000,154.728]}},{"noteOn":{"time":150.335,"note":111.000,"xyz":[-272.922,422.000,0.562]}},{"noteOn":{"time":150.360,"note":111.000,"xyz":[-63.710,422.000,180.350]}},{"noteOn":{"time":150.375,"note":103.000,"xyz":[-35.112,326.000,334.815]}},{"noteOn":{"time":150.400,"note":109.000,"xyz":[19.527,398.000,-384.694]}},{"noteOn":{"time":150.435,"note":107.000,"xyz":[-57.302,374.000,54.323]}},{"noteOn":{"time":150.505,"note":99.000,"xyz":[-265.543,278.000,230.354]}},{"noteOn":{"time":150.550,"note":105.000,"xyz":[114.447,350.000,23.159]}},{"noteOn":{"time":150.695,"note":107.000,"xyz":[75.812,374.000,-127.129]}},{"noteOn":{"time":150.725,"note":96.000,"xyz":[71.806,242.000,-100.201]}},{"noteOn":{"time":150.750,"note":95.000,"xyz":[33.837,230.000,331.499]}},{"noteOn":{"time":150.900,"note":107.000,"xyz":[-95.964,374.000,-64.610]}},{"noteOn":{"time":150.930,"note":104.000,"xyz":[118.840,338.000,-135.746]}},{"noteOn":{"time":150.975,"note":94.000,"xyz":[336.169,218.000,-114.539]}},{"noteOn":{"time":150.985,"note":93.000,"xyz":[190.599,206.000,-28.415]}},{"noteOn":{"time":151.065,"note":109.000,"xyz":[215.452,398.000,-40.914]}},{"noteOn":{"time":151.070,"note":103.000,"xyz":[-22.308,326.000,103.808]}},{"noteOn":{"time":151.130,"note":106.000,"xyz":[48.459,362.000,-486.967]}},{"noteOn":{"time":151.200,"note":100.000,"xyz":[24.844,290.000,-102.658]}},{"noteOn":{"time":151.255,"note":90.000,"xyz":[44.369,170.000,84.170]}},{"noteOn":{"time":151.270,"note":106.000,"xyz":[308.738,362.000,-204.163]}},{"noteOn":{"time":151.290,"note":101.000,"xyz":[-123.123,302.000,228.629]}},{"noteOn":{"time":151.295,"note":98.000,"xyz":[-122.881,266.000,337.154]}},{"noteOn":{"time":151.360,"note":105.000,"xyz":[95.598,350.000,-357.588]}},{"noteOn":{"time":151.380,"note":97.000,"xyz":[282.744,254.000,215.866]}},{"noteOn":{"time":151.430,"note":97.000,"xyz":[-404.541,254.000,-111.873]}},{"noteOn":{"time":151.670,"note":105.000,"xyz":[-36.297,350.000,-38.024]}},{"noteOn":{"time":151.770,"note":110.000,"xyz":[54.203,410.000,-22.444]}},{"noteOn":{"time":151.775,"note":102.000,"xyz":[165.794,314.000,-53.575]}},{"noteOn":{"time":151.780,"note":107.000,"xyz":[-123.438,374.000,216.173]}},{"noteOn":{"time":151.795,"note":96.000,"xyz":[-289.999,242.000,-141.040]}},{"noteOn":{"time":151.820,"note":102.000,"xyz":[28.742,314.000,64.920]}},{"noteOn":{"time":151.860,"note":102.000,"xyz":[-177.825,314.000,455.559]}},{"noteOn":{"time":151.900,"note":96.000,"xyz":[177.642,242.000,-330.237]}},{"noteOn":{"time":151.900,"note":102.000,"xyz":[154.025,314.000,-173.266]}},{"noteOn":{"time":151.965,"note":108.000,"xyz":[222.852,386.000,328.298]}},{"noteOn":{"time":151.985,"note":114.000,"xyz":[175.242,458.000,264.132]}},{"noteOn":{"time":152.020,"note":97.000,"xyz":[-238.927,254.000,321.892]}},{"noteOn":{"time":152.075,"note":104.000,"xyz":[127.196,338.000,-259.750]}},{"noteOn":{"time":152.185,"note":104.000,"xyz":[24.548,338.000,-80.013]}},{"noteOn":{"time":152.270,"note":100.000,"xyz":[-266.278,290.000,-335.543]}},{"noteOn":{"time":152.465,"note":104.000,"xyz":[31.766,338.000,-281.538]}},{"noteOn":{"time":152.500,"note":108.000,"xyz":[436.740,386.000,119.917]}},{"noteOn":{"time":152.540,"note":110.000,"xyz":[332.225,410.000,-368.076]}},{"noteOn":{"time":152.565,"note":101.000,"xyz":[-158.380,302.000,-173.286]}},{"noteOn":{"time":152.585,"note":100.000,"xyz":[30.384,290.000,-462.149]}},{"noteOn":{"time":152.675,"note":94.000,"xyz":[239.676,218.000,239.716]}},{"noteOn":{"time":152.695,"note":92.000,"xyz":[-299.503,194.000,-359.898]}},{"noteOn":{"time":152.745,"note":100.000,"xyz":[97.003,290.000,-104.772]}},{"noteOn":{"time":152.755,"note":100.000,"xyz":[-257.453,290.000,-21.218]}},{"noteOn":{"time":152.815,"note":102.000,"xyz":[-28.501,314.000,71.970]}},{"noteOn":{"time":152.925,"note":114.000,"xyz":[324.780,458.000,360.030]}},{"noteOn":{"time":152.925,"note":100.000,"xyz":[122.206,290.000,436.808]}},{"noteOn":{"time":152.940,"note":100.000,"xyz":[-395.848,290.000,250.097]}},{"noteOn":{"time":152.965,"note":105.000,"xyz":[-41.670,350.000,330.902]}},{"noteOn":{"time":153.030,"note":110.000,"xyz":[-261.270,410.000,38.275]}},{"noteOn":{"time":153.205,"note":102.000,"xyz":[4.322,314.000,-99.630]}},{"noteOn":{"time":153.280,"note":94.000,"xyz":[440.457,218.000,-60.822]}},{"noteOn":{"time":153.280,"note":112.000,"xyz":[197.505,434.000,283.874]}},{"noteOn":{"time":153.360,"note":95.000,"xyz":[257.791,230.000,-187.050]}},{"noteOn":{"time":153.415,"note":102.000,"xyz":[358.281,314.000,231.292]}},{"noteOn":{"time":153.490,"note":102.000,"xyz":[166.192,314.000,405.247]}},{"noteOn":{"time":153.535,"note":98.000,"xyz":[-44.426,266.000,-82.502]}},{"noteOn":{"time":153.555,"note":112.000,"xyz":[-340.405,434.000,-57.338]}},{"noteOn":{"time":153.630,"note":104.000,"xyz":[-19.315,338.000,-99.144]}},{"noteOn":{"time":153.665,"note":98.000,"xyz":[-430.637,266.000,-236.979]}},{"noteOn":{"time":153.670,"note":100.000,"xyz":[58.837,290.000,-69.807]}},{"noteOn":{"time":153.695,"note":98.000,"xyz":[154.783,266.000,-244.930]}},{"noteOn":{"time":153.765,"note":100.000,"xyz":[490.075,290.000,63.088]}},{"noteOn":{"time":153.835,"note":106.000,"xyz":[-318.022,362.000,-18.009]}},{"noteOn":{"time":153.980,"note":97.000,"xyz":[178.117,254.000,-243.741]}},{"noteOn":{"time":154.030,"note":112.000,"xyz":[90.499,434.000,90.966]}},{"noteOn":{"time":154.065,"note":102.000,"xyz":[-252.715,314.000,-43.169]}},{"noteOn":{"time":154.195,"note":96.000,"xyz":[169.124,242.000,126.571]}},{"noteOn":{"time":154.385,"note":106.000,"xyz":[-160.597,362.000,461.757]}},{"noteOn":{"time":154.395,"note":96.000,"xyz":[65.452,242.000,-6.004]}},{"noteOn":{"time":154.410,"note":110.000,"xyz":[-44.120,410.000,250.613]}},{"noteOn":{"time":154.485,"note":104.000,"xyz":[-166.817,338.000,-345.636]}},{"noteOn":{"time":154.505,"note":102.000,"xyz":[46.803,314.000,71.160]}},{"noteOn":{"time":154.515,"note":95.000,"xyz":[387.331,230.000,-51.778]}},{"noteOn":{"time":154.520,"note":102.000,"xyz":[-68.016,314.000,-285.029]}},{"noteOn":{"time":154.580,"note":108.000,"xyz":[-53.811,386.000,-120.943]}},{"noteOn":{"time":154.610,"note":108.000,"xyz":[234.643,386.000,296.194]}},{"noteOn":{"time":154.625,"note":108.000,"xyz":[-289.302,386.000,38.975]}},{"noteOn":{"time":154.630,"note":112.000,"xyz":[68.464,434.000,-161.762]}},{"noteOn":{"time":154.645,"note":110.000,"xyz":[114.998,410.000,-406.650]}},{"noteOn":{"time":154.715,"note":102.000,"xyz":[283.538,314.000,-198.277]}},{"noteOn":{"time":154.780,"note":93.000,"xyz":[256.754,206.000,294.968]}},{"noteOn":{"time":154.880,"note":104.000,"xyz":[333.336,338.000,70.417]}},{"noteOn":{"time":155.025,"note":106.000,"xyz":[291.840,362.000,160.698]}},{"noteOn":{"time":155.045,"note":106.000,"xyz":[274.985,362.000,146.291]}},{"noteOn":{"time":155.195,"note":96.000,"xyz":[-112.394,242.000,-246.305]}},{"noteOn":{"time":155.260,"note":106.000,"xyz":[43.369,362.000,-386.267]}},{"noteOn":{"time":155.270,"note":94.000,"xyz":[220.670,218.000,-202.921]}},{"noteOn":{"time":155.270,"note":104.000,"xyz":[381.709,338.000,-36.675]}},{"noteOn":{"time":155.320,"note":106.000,"xyz":[-81.769,362.000,60.719]}},{"noteOn":{"time":155.370,"note":114.000,"xyz":[216.498,458.000,-407.974]}},{"noteOn":{"time":155.375,"note":104.000,"xyz":[170.527,338.000,-205.954]}},{"noteOn":{"time":155.465,"note":93.000,"xyz":[98.486,206.000,-107.165]}},{"noteOn":{"time":155.475,"note":108.000,"xyz":[35.726,386.000,-264.249]}},{"noteOn":{"time":155.545,"note":108.000,"xyz":[-408.666,386.000,184.192]}},{"noteOn":{"time":155.560,"note":104.000,"xyz":[59.123,338.000,14.217]}},{"noteOn":{"time":155.595,"note":108.000,"xyz":[331.941,386.000,168.206]}},{"noteOn":{"time":155.695,"note":101.000,"xyz":[59.017,302.000,64.060]}},{"noteOn":{"time":155.715,"note":99.000,"xyz":[-305.060,278.000,-326.901]}},{"noteOn":{"time":155.945,"note":98.000,"xyz":[11.981,266.000,464.365]}},{"noteOn":{"time":155.955,"note":96.000,"xyz":[298.136,242.000,330.487]}},{"noteOn":{"time":156.000,"note":104.000,"xyz":[-59.171,338.000,-52.814]}},{"noteOn":{"time":156.025,"note":106.000,"xyz":[-250.225,362.000,-87.524]}},{"noteOn":{"time":156.105,"note":106.000,"xyz":[211.553,362.000,-380.563]}},{"noteOn":{"time":156.115,"note":110.000,"xyz":[243.513,410.000,-43.698]}},{"noteOn":{"time":156.135,"note":102.000,"xyz":[-74.840,314.000,-236.921]}},{"noteOn":{"time":156.185,"note":106.000,"xyz":[-70.827,362.000,417.035]}},{"noteOn":{"time":156.195,"note":102.000,"xyz":[-301.067,314.000,316.471]}},{"noteOn":{"time":156.260,"note":94.000,"xyz":[81.419,218.000,98.407]}},{"noteOn":{"time":156.285,"note":101.000,"xyz":[-329.579,302.000,72.120]}},{"noteOn":{"time":156.295,"note":106.000,"xyz":[438.536,362.000,-42.711]}},{"noteOn":{"time":156.330,"note":103.000,"xyz":[85.006,326.000,-107.222]}},{"noteOn":{"time":156.350,"note":105.000,"xyz":[290.477,350.000,-382.106]}},{"noteOn":{"time":156.375,"note":95.000,"xyz":[57.398,230.000,393.210]}},{"noteOn":{"time":156.555,"note":98.000,"xyz":[-54.690,266.000,154.677]}},{"noteOn":{"time":156.585,"note":102.000,"xyz":[-236.829,314.000,146.139]}},{"noteOn":{"time":156.655,"note":108.000,"xyz":[121.726,386.000,-80.326]}},{"noteOn":{"time":156.700,"note":104.000,"xyz":[16.186,338.000,412.418]}},{"noteOn":{"time":156.730,"note":114.000,"xyz":[279.399,458.000,-90.470]}},{"noteOn":{"time":156.770,"note":109.000,"xyz":[223.026,398.000,18.220]}},{"noteOn":{"time":156.900,"note":100.000,"xyz":[185.830,290.000,-256.638]}},{"noteOn":{"time":156.980,"note":96.000,"xyz":[-315.814,242.000,-131.602]}},{"noteOn":{"time":157.035,"note":104.000,"xyz":[-139.086,338.000,304.267]}},{"noteOn":{"time":157.055,"note":101.000,"xyz":[-172.384,302.000,18.558]}},{"noteOn":{"time":157.070,"note":110.000,"xyz":[-82.931,410.000,-60.237]}},{"noteOn":{"time":157.105,"note":104.000,"xyz":[-118.454,338.000,-60.585]}},{"noteOn":{"time":157.130,"note":107.000,"xyz":[-260.737,374.000,-161.726]}},{"noteOn":{"time":157.150,"note":100.000,"xyz":[-141.765,290.000,119.429]}},{"noteOn":{"time":157.195,"note":93.000,"xyz":[96.396,206.000,101.657]}},{"noteOn":{"time":157.205,"note":93.000,"xyz":[-99.715,206.000,-213.672]}},{"noteOn":{"time":157.255,"note":99.000,"xyz":[251.855,278.000,274.345]}},{"noteOn":{"time":157.375,"note":113.000,"xyz":[105.184,446.000,-190.921]}},{"noteOn":{"time":157.410,"note":99.000,"xyz":[94.525,278.000,-6.029]}},{"noteOn":{"time":157.415,"note":100.000,"xyz":[-422.597,290.000,-226.999]}},{"noteOn":{"time":157.425,"note":104.000,"xyz":[426.570,338.000,-136.158]}},{"noteOn":{"time":157.550,"note":109.000,"xyz":[123.484,398.000,471.028]}},{"noteOn":{"time":157.665,"note":111.000,"xyz":[273.500,422.000,-94.483]}},{"noteOn":{"time":157.680,"note":103.000,"xyz":[-254.929,326.000,146.929]}},{"noteOn":{"time":157.785,"note":95.000,"xyz":[3.238,230.000,-192.324]}},{"noteOn":{"time":157.795,"note":101.000,"xyz":[-75.626,302.000,-285.099]}},{"noteOn":{"time":157.860,"note":103.000,"xyz":[168.967,326.000,22.818]}},{"noteOn":{"time":157.870,"note":95.000,"xyz":[130.925,230.000,99.628]}},{"noteOn":{"time":157.885,"note":107.000,"xyz":[-396.728,374.000,-283.871]}},{"noteOn":{"time":157.940,"note":100.000,"xyz":[172.793,290.000,269.649]}},{"noteOn":{"time":157.955,"note":101.000,"xyz":[-233.676,302.000,301.387]}},{"noteOn":{"time":157.980,"note":113.000,"xyz":[-277.026,446.000,205.231]}},{"noteOn":{"time":157.985,"note":97.000,"xyz":[-21.429,254.000,163.503]}},{"noteOn":{"time":158.080,"note":97.000,"xyz":[245.055,254.000,-133.513]}},{"noteOn":{"time":158.085,"note":102.000,"xyz":[-299.894,314.000,127.376]}},{"noteOn":{"time":158.200,"note":103.000,"xyz":[44.474,326.000,-275.435]}},{"noteOn":{"time":158.370,"note":109.000,"xyz":[47.728,398.000,-43.348]}},{"noteOn":{"time":158.375,"note":111.000,"xyz":[-141.428,422.000,-27.948]}},{"noteOn":{"time":158.470,"note":98.000,"xyz":[-458.921,266.000,-163.619]}},{"noteOn":{"time":158.470,"note":111.000,"xyz":[-102.307,422.000,148.651]}},{"noteOn":{"time":158.545,"note":101.000,"xyz":[288.823,302.000,-172.866]}},{"noteOn":{"time":158.545,"note":103.000,"xyz":[285.396,326.000,-79.908]}},{"noteOn":{"time":158.615,"note":107.000,"xyz":[92.248,374.000,279.344]}},{"noteOn":{"time":158.630,"note":97.000,"xyz":[-387.169,254.000,211.701]}},{"noteOn":{"time":158.690,"note":95.000,"xyz":[-22.056,230.000,332.266]}},{"noteOn":{"time":158.715,"note":95.000,"xyz":[280.315,230.000,-98.489]}},{"noteOn":{"time":158.725,"note":109.000,"xyz":[68.063,398.000,-28.670]}},{"noteOn":{"time":158.785,"note":107.000,"xyz":[-143.372,374.000,-116.296]}},{"noteOn":{"time":158.860,"note":107.000,"xyz":[-175.929,374.000,-60.506]}},{"noteOn":{"time":158.895,"note":105.000,"xyz":[-22.205,350.000,-110.103]}},{"noteOn":{"time":158.910,"note":109.000,"xyz":[106.615,398.000,122.658]}},{"noteOn":{"time":158.985,"note":94.000,"xyz":[-492.408,218.000,36.890]}},{"noteOn":{"time":159.015,"note":101.000,"xyz":[199.763,302.000,-21.373]}},{"noteOn":{"time":159.090,"note":105.000,"xyz":[33.253,350.000,484.246]}},{"noteOn":{"time":159.245,"note":109.000,"xyz":[-337.714,398.000,41.180]}},{"noteOn":{"time":159.255,"note":105.000,"xyz":[223.567,350.000,292.426]}},{"noteOn":{"time":159.290,"note":93.000,"xyz":[-266.375,206.000,-64.009]}},{"noteOn":{"time":159.320,"note":113.000,"xyz":[-91.548,446.000,59.678]}},{"noteOn":{"time":159.345,"note":103.000,"xyz":[146.496,326.000,183.015]}},{"noteOn":{"time":159.405,"note":107.000,"xyz":[209.412,374.000,228.561]}},{"noteOn":{"time":159.560,"note":103.000,"xyz":[-76.374,326.000,220.682]}},{"noteOn":{"time":159.560,"note":105.000,"xyz":[-91.095,350.000,-3.762]}},{"noteOn":{"time":159.620,"note":107.000,"xyz":[-229.729,374.000,143.438]}},{"noteOn":{"time":159.655,"note":97.000,"xyz":[94.038,254.000,-19.574]}},{"noteOn":{"time":159.675,"note":105.000,"xyz":[85.740,350.000,-154.154]}},{"noteOn":{"time":159.705,"note":105.000,"xyz":[-179.014,350.000,12.931]}},{"noteOn":{"time":159.715,"note":95.000,"xyz":[-2.600,230.000,-200.533]}},{"noteOn":{"time":159.815,"note":107.000,"xyz":[-55.608,374.000,106.872]}},{"noteOn":{"time":159.910,"note":109.000,"xyz":[-327.112,398.000,-189.699]}},{"noteOn":{"time":159.915,"note":92.000,"xyz":[-84.163,194.000,61.090]}},{"noteOn":{"time":159.935,"note":103.000,"xyz":[-133.930,326.000,258.974]}},{"noteOn":{"time":160.070,"note":107.000,"xyz":[90.675,374.000,-169.463]}},{"noteOn":{"time":160.130,"note":115.000,"xyz":[-96.863,470.000,-354.927]}},{"noteOn":{"time":160.190,"note":99.000,"xyz":[-270.850,278.000,284.108]}},{"noteOn":{"time":160.190,"note":101.000,"xyz":[-128.697,302.000,-47.404]}},{"noteOn":{"time":160.225,"note":105.000,"xyz":[-433.811,350.000,148.358]}},{"noteOn":{"time":160.320,"note":107.000,"xyz":[-47.359,374.000,95.607]}},{"noteOn":{"time":160.365,"note":97.000,"xyz":[-287.829,254.000,-321.144]}},{"noteOn":{"time":160.375,"note":105.000,"xyz":[14.596,350.000,-343.168]}},{"noteOn":{"time":160.420,"note":99.000,"xyz":[-44.905,278.000,-112.322]}},{"noteOn":{"time":160.555,"note":101.000,"xyz":[20.440,302.000,46.448]}},{"noteOn":{"time":160.555,"note":109.000,"xyz":[-90.844,398.000,313.068]}},{"noteOn":{"time":160.565,"note":103.000,"xyz":[175.976,326.000,192.281]}},{"noteOn":{"time":160.670,"note":103.000,"xyz":[-60.932,326.000,-66.005]}},{"noteOn":{"time":160.695,"note":105.000,"xyz":[300.341,350.000,385.957]}},{"noteOn":{"time":160.755,"note":102.000,"xyz":[61.042,314.000,9.945]}},{"noteOn":{"time":160.795,"note":100.000,"xyz":[-282.124,290.000,174.070]}},{"noteOn":{"time":160.810,"note":111.000,"xyz":[138.891,422.000,112.783]}},{"noteOn":{"time":160.905,"note":95.000,"xyz":[-122.505,230.000,-102.709]}},{"noteOn":{"time":161.065,"note":105.000,"xyz":[-184.233,350.000,360.643]}},{"noteOn":{"time":161.090,"note":99.000,"xyz":[339.177,278.000,291.181]}},{"noteOn":{"time":161.125,"note":95.000,"xyz":[-6.175,230.000,130.851]}},{"noteOn":{"time":161.150,"note":99.000,"xyz":[-126.079,278.000,182.952]}},{"noteOn":{"time":161.195,"note":103.000,"xyz":[101.212,326.000,-55.522]}},{"noteOn":{"time":161.220,"note":101.000,"xyz":[102.591,302.000,47.279]}},{"noteOn":{"time":161.255,"note":115.000,"xyz":[133.228,470.000,-88.452]}},{"noteOn":{"time":161.270,"note":101.000,"xyz":[51.815,302.000,74.869]}},{"noteOn":{"time":161.325,"note":105.000,"xyz":[-224.142,350.000,111.361]}},{"noteOn":{"time":161.345,"note":103.000,"xyz":[-78.554,326.000,175.209]}},{"noteOn":{"time":161.375,"note":107.000,"xyz":[92.754,374.000,27.988]}},{"noteOn":{"time":161.380,"note":109.000,"xyz":[-39.712,398.000,73.375]}},{"noteOn":{"time":161.500,"note":100.000,"xyz":[141.463,290.000,126.401]}},{"noteOn":{"time":161.595,"note":111.000,"xyz":[290.939,422.000,-68.811]}},{"noteOn":{"time":161.690,"note":94.000,"xyz":[-153.063,218.000,54.772]}},{"noteOn":{"time":161.755,"note":97.000,"xyz":[117.208,254.000,121.220]}},{"noteOn":{"time":161.790,"note":92.000,"xyz":[152.686,194.000,-15.930]}},{"noteOn":{"time":161.830,"note":101.000,"xyz":[188.770,302.000,-52.983]}},{"noteOn":{"time":161.835,"note":103.000,"xyz":[-128.608,326.000,78.444]}},{"noteOn":{"time":161.865,"note":99.000,"xyz":[178.209,278.000,-299.875]}},{"noteOn":{"time":161.925,"note":102.000,"xyz":[253.895,314.000,-292.343]}},{"noteOn":{"time":162.030,"note":113.000,"xyz":[210.599,446.000,-86.642]}},{"noteOn":{"time":162.100,"note":99.000,"xyz":[193.297,278.000,-54.763]}},{"noteOn":{"time":162.150,"note":113.000,"xyz":[45.117,446.000,-36.181]}},{"noteOn":{"time":162.185,"note":101.000,"xyz":[-158.774,302.000,178.279]}},{"noteOn":{"time":162.295,"note":110.000,"xyz":[54.782,410.000,-13.176]}},{"noteOn":{"time":162.295,"note":96.000,"xyz":[171.377,242.000,-78.048]}},{"noteOn":{"time":162.315,"note":103.000,"xyz":[-255.290,326.000,297.583]}},{"noteOn":{"time":162.335,"note":96.000,"xyz":[18.173,242.000,-99.808]}},{"noteOn":{"time":162.345,"note":108.000,"xyz":[-468.788,386.000,123.767]}},{"noteOn":{"time":162.420,"note":103.000,"xyz":[-166.633,326.000,-74.518]}},{"noteOn":{"time":162.445,"note":97.000,"xyz":[-255.085,254.000,195.819]}},{"noteOn":{"time":162.555,"note":106.000,"xyz":[294.462,362.000,104.683]}},{"noteOn":{"time":162.625,"note":99.000,"xyz":[-214.587,278.000,106.953]}},{"noteOn":{"time":162.685,"note":101.000,"xyz":[-78.867,302.000,397.679]}},{"noteOn":{"time":162.705,"note":97.000,"xyz":[-62.970,254.000,43.066]}},{"noteOn":{"time":162.730,"note":102.000,"xyz":[44.567,314.000,-59.827]}},{"noteOn":{"time":162.910,"note":110.000,"xyz":[-461.993,410.000,-115.153]}},{"noteOn":{"time":162.915,"note":98.000,"xyz":[298.487,266.000,114.450]}},{"noteOn":{"time":162.965,"note":108.000,"xyz":[91.720,386.000,58.082]}},{"noteOn":{"time":163.070,"note":103.000,"xyz":[-274.040,326.000,-47.531]}},{"noteOn":{"time":163.085,"note":111.000,"xyz":[-150.162,422.000,109.186]}},{"noteOn":{"time":163.100,"note":102.000,"xyz":[53.261,314.000,304.448]}},{"noteOn":{"time":163.135,"note":108.000,"xyz":[-235.935,386.000,91.616]}},{"noteOn":{"time":163.155,"note":94.000,"xyz":[-263.779,218.000,-143.123]}},{"noteOn":{"time":163.190,"note":94.000,"xyz":[214.091,218.000,-293.948]}},{"noteOn":{"time":163.220,"note":106.000,"xyz":[-205.579,362.000,-180.958]}},{"noteOn":{"time":163.230,"note":97.000,"xyz":[110.734,254.000,21.575]}},{"noteOn":{"time":163.305,"note":105.000,"xyz":[-201.227,350.000,258.270]}},{"noteOn":{"time":163.420,"note":106.000,"xyz":[-80.434,362.000,41.018]}},{"noteOn":{"time":163.425,"note":93.000,"xyz":[-158.291,206.000,-197.946]}},{"noteOn":{"time":163.485,"note":104.000,"xyz":[-219.623,338.000,103.758]}},{"noteOn":{"time":163.490,"note":100.000,"xyz":[59.704,290.000,-38.457]}},{"noteOn":{"time":163.545,"note":110.000,"xyz":[-160.846,410.000,213.925]}},{"noteOn":{"time":163.650,"note":104.000,"xyz":[-153.729,338.000,330.091]}},{"noteOn":{"time":163.730,"note":114.000,"xyz":[-174.684,458.000,-253.944]}},{"noteOn":{"time":163.750,"note":108.000,"xyz":[58.266,386.000,-181.598]}},{"noteOn":{"time":163.800,"note":92.000,"xyz":[-72.515,194.000,393.061]}},{"noteOn":{"time":163.870,"note":108.000,"xyz":[-78.670,386.000,34.477]}},{"noteOn":{"time":163.970,"note":106.000,"xyz":[-22.600,362.000,-380.814]}},{"noteOn":{"time":164.035,"note":96.000,"xyz":[-314.261,242.000,124.761]}},{"noteOn":{"time":164.070,"note":103.000,"xyz":[-229.475,326.000,-41.574]}},{"noteOn":{"time":164.075,"note":98.000,"xyz":[-3.412,266.000,175.069]}},{"noteOn":{"time":164.085,"note":104.000,"xyz":[-77.280,338.000,-28.099]}},{"noteOn":{"time":164.210,"note":108.000,"xyz":[-145.154,386.000,118.628]}},{"noteOn":{"time":164.215,"note":107.000,"xyz":[-237.994,374.000,193.902]}},{"noteOn":{"time":164.285,"note":106.000,"xyz":[201.605,362.000,-70.718]}},{"noteOn":{"time":164.310,"note":102.000,"xyz":[65.942,314.000,-0.920]}},{"noteOn":{"time":164.330,"note":91.000,"xyz":[-2.004,182.000,490.518]}},{"noteOn":{"time":164.375,"note":116.000,"xyz":[405.223,482.000,-93.596]}},{"noteOn":{"time":164.390,"note":104.000,"xyz":[183.285,338.000,-66.435]}},{"noteOn":{"time":164.475,"note":110.000,"xyz":[276.138,410.000,38.692]}},{"noteOn":{"time":164.545,"note":106.000,"xyz":[307.275,362.000,321.875]}},{"noteOn":{"time":164.595,"note":106.000,"xyz":[121.990,362.000,-307.811]}},{"noteOn":{"time":164.650,"note":104.000,"xyz":[-165.567,338.000,87.281]}},{"noteOn":{"time":164.670,"note":100.000,"xyz":[-100.170,290.000,-19.550]}},{"noteOn":{"time":164.690,"note":102.000,"xyz":[87.743,314.000,119.271]}},{"noteOn":{"time":164.775,"note":98.000,"xyz":[-105.846,266.000,220.444]}},{"noteOn":{"time":164.830,"note":104.000,"xyz":[55.454,338.000,-464.391]}},{"noteOn":{"time":164.895,"note":104.000,"xyz":[59.836,338.000,-8.000]}},{"noteOn":{"time":164.980,"note":100.000,"xyz":[372.660,290.000,-65.262]}},{"noteOn":{"time":165.010,"note":102.000,"xyz":[299.695,314.000,370.870]}},{"noteOn":{"time":165.105,"note":108.000,"xyz":[-149.191,386.000,465.724]}},{"noteOn":{"time":165.150,"note":101.000,"xyz":[-311.689,302.000,222.942]}},{"noteOn":{"time":165.185,"note":100.000,"xyz":[205.007,290.000,353.925]}},{"noteOn":{"time":165.190,"note":110.000,"xyz":[-62.107,410.000,326.926]}},{"noteOn":{"time":165.190,"note":112.000,"xyz":[-438.946,434.000,205.584]}},{"noteOn":{"time":165.250,"note":104.000,"xyz":[-335.831,338.000,65.421]}},{"noteOn":{"time":165.265,"note":106.000,"xyz":[305.633,362.000,-276.756]}},{"noteOn":{"time":165.305,"note":100.000,"xyz":[-95.860,290.000,-32.802]}},{"noteOn":{"time":165.435,"note":94.000,"xyz":[-52.724,218.000,354.957]}},{"noteOn":{"time":165.440,"note":114.000,"xyz":[-295.542,458.000,-264.929]}},{"noteOn":{"time":165.460,"note":96.000,"xyz":[246.389,242.000,-22.365]}},{"noteOn":{"time":165.630,"note":102.000,"xyz":[-190.005,314.000,-141.548]}},{"noteOn":{"time":165.660,"note":102.000,"xyz":[138.805,314.000,11.580]}},{"noteOn":{"time":165.710,"note":106.000,"xyz":[-169.545,362.000,57.756]}},{"noteOn":{"time":165.750,"note":100.000,"xyz":[73.811,290.000,-99.565]}},{"noteOn":{"time":165.835,"note":100.000,"xyz":[168.405,290.000,23.640]}},{"noteOn":{"time":165.915,"note":99.000,"xyz":[47.344,278.000,-111.547]}},{"noteOn":{"time":166.005,"note":98.000,"xyz":[-116.186,266.000,-154.792]}},{"noteOn":{"time":166.010,"note":100.000,"xyz":[-6.332,290.000,196.088]}},{"noteOn":{"time":166.045,"note":102.000,"xyz":[65.137,314.000,206.280]}},{"noteOn":{"time":166.075,"note":112.000,"xyz":[-377.786,434.000,35.804]}},{"noteOn":{"time":166.105,"note":110.000,"xyz":[-246.447,410.000,-194.664]}},{"noteOn":{"time":166.135,"note":108.000,"xyz":[117.269,386.000,407.998]}},{"noteOn":{"time":166.245,"note":112.000,"xyz":[-94.030,434.000,-293.450]}},{"noteOn":{"time":166.255,"note":102.000,"xyz":[58.798,314.000,211.870]}},{"noteOn":{"time":166.325,"note":100.000,"xyz":[200.874,290.000,174.392]}},{"noteOn":{"time":166.375,"note":92.000,"xyz":[-425.414,194.000,-98.377]}},{"noteOn":{"time":166.425,"note":98.000,"xyz":[51.715,266.000,-115.000]}},{"noteOn":{"time":166.515,"note":102.000,"xyz":[-467.701,314.000,-106.657]}},{"noteOn":{"time":166.575,"note":112.000,"xyz":[-449.905,434.000,-176.701]}},{"noteOn":{"time":166.625,"note":104.000,"xyz":[17.554,338.000,105.172]}},{"noteOn":{"time":166.705,"note":98.000,"xyz":[-48.796,266.000,122.603]}},{"noteOn":{"time":166.765,"note":110.000,"xyz":[32.674,410.000,192.927]}},{"noteOn":{"time":166.775,"note":97.000,"xyz":[161.755,254.000,-213.750]}},{"noteOn":{"time":166.785,"note":98.000,"xyz":[426.305,266.000,-110.194]}},{"noteOn":{"time":166.815,"note":108.000,"xyz":[-427.526,386.000,36.009]}},{"noteOn":{"time":166.875,"note":112.000,"xyz":[245.422,434.000,-59.852]}},{"noteOn":{"time":166.890,"note":102.000,"xyz":[-257.265,314.000,-94.379]}},{"noteOn":{"time":166.895,"note":108.000,"xyz":[-475.777,386.000,-16.300]}},{"noteOn":{"time":167.050,"note":104.000,"xyz":[162.312,338.000,-382.359]}},{"noteOn":{"time":167.110,"note":110.000,"xyz":[-54.636,410.000,340.643]}},{"noteOn":{"time":167.160,"note":96.000,"xyz":[-30.609,242.000,-55.920]}},{"noteOn":{"time":167.190,"note":115.000,"xyz":[86.632,470.000,-49.518]}},{"noteOn":{"time":167.220,"note":100.000,"xyz":[242.609,290.000,-17.346]}},{"noteOn":{"time":167.260,"note":101.000,"xyz":[-128.327,302.000,-106.098]}},{"noteOn":{"time":167.305,"note":96.000,"xyz":[-210.563,242.000,218.135]}},{"noteOn":{"time":167.315,"note":102.000,"xyz":[-266.165,314.000,56.567]}},{"noteOn":{"time":167.325,"note":98.000,"xyz":[-63.033,266.000,17.968]}},{"noteOn":{"time":167.330,"note":99.000,"xyz":[-227.778,278.000,386.769]}},{"noteOn":{"time":167.380,"note":107.000,"xyz":[-269.660,374.000,-420.023]}},{"noteOn":{"time":167.600,"note":104.000,"xyz":[385.322,338.000,61.379]}},{"noteOn":{"time":167.610,"note":110.000,"xyz":[130.558,410.000,-322.201]}},{"noteOn":{"time":167.665,"note":94.000,"xyz":[-140.547,218.000,28.965]}},{"noteOn":{"time":167.785,"note":106.000,"xyz":[51.233,362.000,-245.713]}},{"noteOn":{"time":167.810,"note":106.000,"xyz":[95.169,362.000,-67.673]}},{"noteOn":{"time":167.860,"note":93.000,"xyz":[-38.391,206.000,253.429]}},{"noteOn":{"time":167.890,"note":110.000,"xyz":[439.153,410.000,-216.584]}},{"noteOn":{"time":167.965,"note":99.000,"xyz":[9.719,278.000,149.525]}},{"noteOn":{"time":167.980,"note":105.000,"xyz":[339.363,350.000,15.821]}},{"noteOn":{"time":167.985,"note":106.000,"xyz":[-329.872,362.000,69.696]}},{"noteOn":{"time":168.005,"note":108.000,"xyz":[-191.921,386.000,-23.315]}},{"noteOn":{"time":168.025,"note":105.000,"xyz":[-35.969,350.000,43.716]}},{"noteOn":{"time":168.055,"note":104.000,"xyz":[217.601,338.000,434.878]}},{"noteOn":{"time":168.060,"note":106.000,"xyz":[472.490,362.000,-71.534]}},{"noteOn":{"time":168.155,"note":108.000,"xyz":[113.074,386.000,56.639]}},{"noteOn":{"time":168.235,"note":115.000,"xyz":[-67.650,470.000,-184.518]}},{"noteOn":{"time":168.350,"note":106.000,"xyz":[-87.149,362.000,402.289]}},{"noteOn":{"time":168.425,"note":96.000,"xyz":[149.551,242.000,347.824]}},{"noteOn":{"time":168.495,"note":99.000,"xyz":[-283.345,278.000,-385.025]}},{"noteOn":{"time":168.525,"note":107.000,"xyz":[250.245,374.000,80.357]}},{"noteOn":{"time":168.570,"note":104.000,"xyz":[-103.548,338.000,237.974]}},{"noteOn":{"time":168.595,"note":103.000,"xyz":[-35.643,326.000,-42.805]}},{"noteOn":{"time":168.690,"note":108.000,"xyz":[-135.771,386.000,-99.055]}},{"noteOn":{"time":168.705,"note":103.000,"xyz":[233.082,326.000,33.465]}},{"noteOn":{"time":168.735,"note":105.000,"xyz":[287.634,350.000,-215.236]}},{"noteOn":{"time":168.745,"note":91.000,"xyz":[-54.623,182.000,-366.024]}},{"noteOn":{"time":168.860,"note":104.000,"xyz":[-477.314,338.000,-22.301]}},{"noteOn":{"time":168.945,"note":101.000,"xyz":[-33.627,302.000,130.053]}},{"noteOn":{"time":168.995,"note":107.000,"xyz":[135.753,374.000,256.024]}},{"noteOn":{"time":169.045,"note":111.000,"xyz":[-148.814,422.000,12.967]}},{"noteOn":{"time":169.075,"note":105.000,"xyz":[5.016,350.000,-91.833]}},{"noteOn":{"time":169.140,"note":115.000,"xyz":[201.141,470.000,73.743]}},{"noteOn":{"time":169.145,"note":101.000,"xyz":[203.118,302.000,262.106]}},{"noteOn":{"time":169.150,"note":113.000,"xyz":[77.431,446.000,324.025]}},{"noteOn":{"time":169.230,"note":105.000,"xyz":[-115.460,350.000,164.740]}},{"noteOn":{"time":169.295,"note":97.000,"xyz":[-270.062,254.000,239.132]}},{"noteOn":{"time":169.320,"note":98.000,"xyz":[-23.188,266.000,-225.737]}},{"noteOn":{"time":169.330,"note":101.000,"xyz":[56.946,302.000,-210.027]}},{"noteOn":{"time":169.425,"note":101.000,"xyz":[457.356,302.000,-88.289]}},{"noteOn":{"time":169.545,"note":100.000,"xyz":[327.955,290.000,263.655]}},{"noteOn":{"time":169.545,"note":103.000,"xyz":[-334.060,326.000,-145.042]}},{"noteOn":{"time":169.580,"note":109.000,"xyz":[447.439,398.000,-189.154]}},{"noteOn":{"time":169.720,"note":113.000,"xyz":[77.603,446.000,240.459]}},{"noteOn":{"time":169.780,"note":103.000,"xyz":[414.201,326.000,-194.923]}},{"noteOn":{"time":169.800,"note":107.000,"xyz":[-255.991,374.000,-185.744]}},{"noteOn":{"time":169.815,"note":99.000,"xyz":[-38.306,278.000,-189.333]}},{"noteOn":{"time":169.835,"note":99.000,"xyz":[-27.170,278.000,476.041]}},{"noteOn":{"time":169.855,"note":111.000,"xyz":[-381.440,422.000,-88.077]}},{"noteOn":{"time":169.875,"note":109.000,"xyz":[6.809,398.000,-49.944]}},{"noteOn":{"time":169.935,"note":103.000,"xyz":[100.188,326.000,-42.036]}},{"noteOn":{"time":169.965,"note":93.000,"xyz":[-141.845,206.000,306.367]}},{"noteOn":{"time":170.130,"note":107.000,"xyz":[214.238,374.000,288.079]}},{"noteOn":{"time":170.160,"note":101.000,"xyz":[-331.878,302.000,152.725]}},{"noteOn":{"time":170.270,"note":111.000,"xyz":[157.464,422.000,-253.711]}},{"noteOn":{"time":170.280,"note":99.000,"xyz":[153.782,278.000,24.585]}},{"noteOn":{"time":170.335,"note":98.000,"xyz":[-33.486,266.000,-373.046]}},{"noteOn":{"time":170.385,"note":109.000,"xyz":[247.370,398.000,-98.869]}},{"noteOn":{"time":170.395,"note":113.000,"xyz":[-207.845,446.000,-124.384]}},{"noteOn":{"time":170.480,"note":103.000,"xyz":[100.046,326.000,-20.752]}},{"noteOn":{"time":170.485,"note":109.000,"xyz":[-63.733,398.000,-75.551]}},{"noteOn":{"time":170.510,"note":113.000,"xyz":[-425.560,446.000,168.989]}},{"noteOn":{"time":170.530,"note":97.000,"xyz":[116.777,254.000,170.006]}},{"noteOn":{"time":170.605,"note":113.000,"xyz":[-212.980,446.000,71.226]}},{"noteOn":{"time":170.645,"note":101.000,"xyz":[365.605,302.000,93.463]}},{"noteOn":{"time":170.855,"note":101.000,"xyz":[-21.678,302.000,-402.731]}},{"noteOn":{"time":170.885,"note":97.000,"xyz":[184.249,254.000,160.355]}},{"noteOn":{"time":170.915,"note":97.000,"xyz":[-173.167,254.000,-428.019]}},{"noteOn":{"time":170.965,"note":93.000,"xyz":[16.767,206.000,66.620]}},{"noteOn":{"time":171.025,"note":107.000,"xyz":[-161.674,374.000,277.474]}},{"noteOn":{"time":171.080,"note":103.000,"xyz":[245.263,326.000,-207.588]}},{"noteOn":{"time":171.105,"note":95.000,"xyz":[-97.519,230.000,-42.690]}},{"noteOn":{"time":171.125,"note":111.000,"xyz":[291.352,422.000,320.540]}},{"noteOn":{"time":171.160,"note":101.000,"xyz":[-187.770,302.000,137.951]}},{"noteOn":{"time":171.210,"note":109.000,"xyz":[144.892,398.000,464.346]}},{"noteOn":{"time":171.210,"note":98.000,"xyz":[120.029,266.000,297.396]}},{"noteOn":{"time":171.265,"note":115.000,"xyz":[398.466,470.000,26.446]}},{"noteOn":{"time":171.290,"note":105.000,"xyz":[104.078,350.000,-169.337]}},{"noteOn":{"time":171.295,"note":101.000,"xyz":[194.676,302.000,260.464]}},{"noteOn":{"time":171.455,"note":111.000,"xyz":[-121.253,422.000,195.286]}},{"noteOn":{"time":171.630,"note":99.000,"xyz":[10.312,278.000,-418.448]}},{"noteOn":{"time":171.730,"note":105.000,"xyz":[8.301,350.000,175.351]}},{"noteOn":{"time":171.750,"note":100.000,"xyz":[-130.708,290.000,28.239]}},{"noteOn":{"time":171.755,"note":99.000,"xyz":[232.816,278.000,42.057]}},{"noteOn":{"time":171.755,"note":103.000,"xyz":[-54.184,326.000,-229.786]}},{"noteOn":{"time":171.770,"note":105.000,"xyz":[61.382,350.000,40.783]}},{"noteOn":{"time":171.775,"note":95.000,"xyz":[131.104,230.000,137.422]}},{"noteOn":{"time":171.780,"note":103.000,"xyz":[80.678,326.000,25.906]}},{"noteOn":{"time":171.790,"note":101.000,"xyz":[-50.409,302.000,-435.050]}},{"noteOn":{"time":171.835,"note":109.000,"xyz":[-54.857,398.000,-73.088]}},{"noteOn":{"time":171.895,"note":109.000,"xyz":[397.876,398.000,-39.823]}},{"noteOn":{"time":171.920,"note":109.000,"xyz":[-188.255,398.000,52.759]}},{"noteOn":{"time":171.965,"note":105.000,"xyz":[77.500,350.000,-194.941]}},{"noteOn":{"time":172.080,"note":105.000,"xyz":[285.939,350.000,46.683]}},{"noteOn":{"time":172.140,"note":107.000,"xyz":[216.408,374.000,-261.324]}},{"noteOn":{"time":172.240,"note":95.000,"xyz":[-330.374,230.000,-254.614]}},{"noteOn":{"time":172.300,"note":92.000,"xyz":[-306.082,194.000,31.690]}},{"noteOn":{"time":172.370,"note":103.000,"xyz":[1.982,326.000,-357.846]}},{"noteOn":{"time":172.385,"note":107.000,"xyz":[-186.237,374.000,390.060]}},{"noteOn":{"time":172.410,"note":107.000,"xyz":[170.427,374.000,15.913]}},{"noteOn":{"time":172.445,"note":99.000,"xyz":[128.248,278.000,440.657]}},{"noteOn":{"time":172.445,"note":105.000,"xyz":[-272.581,350.000,221.511]}},{"noteOn":{"time":172.475,"note":111.000,"xyz":[59.092,422.000,-379.503]}},{"noteOn":{"time":172.550,"note":105.000,"xyz":[-2.846,350.000,183.575]}},{"noteOn":{"time":172.685,"note":107.000,"xyz":[-75.430,374.000,34.046]}},{"noteOn":{"time":172.710,"note":105.000,"xyz":[61.735,350.000,-257.250]}},{"noteOn":{"time":172.745,"note":105.000,"xyz":[-121.008,350.000,236.879]}},{"noteOn":{"time":172.830,"note":115.000,"xyz":[90.660,470.000,-244.482]}},{"noteOn":{"time":172.855,"note":107.000,"xyz":[-77.771,374.000,-282.293]}},{"noteOn":{"time":172.880,"note":97.000,"xyz":[266.862,254.000,-211.691]}},{"noteOn":{"time":172.935,"note":108.000,"xyz":[-1.363,386.000,67.420]}},{"noteOn":{"time":172.970,"note":100.000,"xyz":[-26.697,290.000,-85.920]}},{"noteOn":{"time":173.005,"note":97.000,"xyz":[-16.815,254.000,-293.957]}},{"noteOn":{"time":173.050,"note":105.000,"xyz":[-105.132,350.000,-132.283]}},{"noteOn":{"time":173.055,"note":103.000,"xyz":[102.295,326.000,23.627]}},{"noteOn":{"time":173.095,"note":107.000,"xyz":[9.780,374.000,-161.507]}},{"noteOn":{"time":173.100,"note":107.000,"xyz":[51.310,374.000,125.939]}},{"noteOn":{"time":173.165,"note":92.000,"xyz":[34.780,194.000,36.958]}},{"noteOn":{"time":173.165,"note":103.000,"xyz":[-9.730,326.000,370.948]}},{"noteOn":{"time":173.290,"note":103.000,"xyz":[-431.950,326.000,73.759]}},{"noteOn":{"time":173.355,"note":111.000,"xyz":[15.856,422.000,-101.628]}},{"noteOn":{"time":173.385,"note":114.000,"xyz":[-98.222,458.000,-2.694]}},{"noteOn":{"time":173.570,"note":100.000,"xyz":[192.528,290.000,-90.204]}},{"noteOn":{"time":173.605,"note":105.000,"xyz":[-67.932,350.000,110.584]}},{"noteOn":{"time":173.635,"note":99.000,"xyz":[39.397,278.000,60.159]}},{"noteOn":{"time":173.665,"note":101.000,"xyz":[28.576,302.000,-414.775]}},{"noteOn":{"time":173.670,"note":102.000,"xyz":[-496.563,314.000,54.937]}},{"noteOn":{"time":173.755,"note":110.000,"xyz":[-10.413,410.000,129.444]}},{"noteOn":{"time":173.795,"note":112.000,"xyz":[-22.579,434.000,-62.381]}},{"noteOn":{"time":173.825,"note":104.000,"xyz":[114.899,338.000,-386.519]}},{"noteOn":{"time":173.885,"note":101.000,"xyz":[-115.605,302.000,240.410]}},{"noteOn":{"time":173.895,"note":109.000,"xyz":[256.596,398.000,164.608]}},{"noteOn":{"time":173.920,"note":99.000,"xyz":[60.126,278.000,172.299]}},{"noteOn":{"time":173.940,"note":100.000,"xyz":[-212.798,290.000,-126.686]}},{"noteOn":{"time":173.985,"note":105.000,"xyz":[-297.246,350.000,-213.903]}},{"noteOn":{"time":174.180,"note":108.000,"xyz":[49.439,386.000,239.118]}},{"noteOn":{"time":174.195,"note":98.000,"xyz":[115.919,266.000,428.014]}},{"noteOn":{"time":174.245,"note":96.000,"xyz":[339.961,242.000,-25.533]}},{"noteOn":{"time":174.290,"note":114.000,"xyz":[52.509,458.000,158.511]}},{"noteOn":{"time":174.355,"note":110.000,"xyz":[220.909,410.000,87.793]}},{"noteOn":{"time":174.440,"note":112.000,"xyz":[354.727,434.000,-67.647]}},{"noteOn":{"time":174.545,"note":92.000,"xyz":[163.629,194.000,-165.167]}},{"noteOn":{"time":174.550,"note":104.000,"xyz":[-141.270,338.000,179.731]}},{"noteOn":{"time":174.555,"note":103.000,"xyz":[-194.713,326.000,73.443]}},{"noteOn":{"time":174.570,"note":101.000,"xyz":[-61.161,302.000,351.870]}},{"noteOn":{"time":174.600,"note":98.000,"xyz":[99.580,266.000,-118.982]}},{"noteOn":{"time":174.605,"note":110.000,"xyz":[77.789,410.000,-133.390]}},{"noteOn":{"time":174.670,"note":108.000,"xyz":[-401.512,386.000,-58.160]}},{"noteOn":{"time":174.750,"note":97.000,"xyz":[46.338,254.000,26.881]}},{"noteOn":{"time":174.785,"note":108.000,"xyz":[-2.952,386.000,-79.544]}},{"noteOn":{"time":174.810,"note":100.000,"xyz":[-23.354,290.000,-336.102]}},{"noteOn":{"time":174.905,"note":94.000,"xyz":[40.273,218.000,-165.771]}},{"noteOn":{"time":174.920,"note":104.000,"xyz":[-257.260,338.000,-135.730]}},{"noteOn":{"time":174.955,"note":102.000,"xyz":[8.765,314.000,143.844]}},{"noteOn":{"time":175.085,"note":112.000,"xyz":[133.879,434.000,-320.168]}},{"noteOn":{"time":175.145,"note":110.000,"xyz":[-414.946,410.000,-17.910]}},{"noteOn":{"time":175.230,"note":98.000,"xyz":[-201.049,266.000,-85.229]}},{"noteOn":{"time":175.405,"note":110.000,"xyz":[-375.950,410.000,202.193]}},{"noteOn":{"time":175.445,"note":96.000,"xyz":[-152.664,242.000,138.105]}},{"noteOn":{"time":175.480,"note":104.000,"xyz":[-213.702,338.000,306.549]}},{"noteOn":{"time":175.495,"note":94.000,"xyz":[-54.451,218.000,-4.919]}},{"noteOn":{"time":175.520,"note":104.000,"xyz":[-75.782,338.000,-313.665]}},{"noteOn":{"time":175.580,"note":114.000,"xyz":[-188.253,458.000,-69.400]}},{"noteOn":{"time":175.590,"note":110.000,"xyz":[-169.058,410.000,-128.112]}},{"noteOn":{"time":175.650,"note":99.000,"xyz":[-269.429,278.000,331.490]}},{"noteOn":{"time":175.650,"note":104.000,"xyz":[7.383,338.000,436.526]}},{"noteOn":{"time":175.730,"note":106.000,"xyz":[192.108,362.000,389.554]}},{"noteOn":{"time":175.770,"note":113.000,"xyz":[424.696,446.000,-175.951]}},{"noteOn":{"time":175.785,"note":102.000,"xyz":[106.755,314.000,327.914]}},{"noteOn":{"time":175.865,"note":108.000,"xyz":[41.499,386.000,258.972]}},{"noteOn":{"time":176.165,"note":101.000,"xyz":[228.172,302.000,-223.070]}},{"noteOn":{"time":176.170,"note":102.000,"xyz":[260.235,314.000,-238.072]}},{"noteOn":{"time":176.215,"note":110.000,"xyz":[4.803,410.000,237.727]}},{"noteOn":{"time":176.225,"note":116.000,"xyz":[-132.247,482.000,39.334]}},{"noteOn":{"time":176.270,"note":100.000,"xyz":[-222.957,290.000,-105.579]}},{"noteOn":{"time":176.295,"note":106.000,"xyz":[248.404,362.000,-262.428]}},{"noteOn":{"time":176.385,"note":106.000,"xyz":[-88.645,362.000,-67.655]}},{"noteOn":{"time":176.400,"note":96.000,"xyz":[-76.711,242.000,71.206]}},{"noteOn":{"time":176.485,"note":108.000,"xyz":[-145.799,386.000,13.951]}},{"noteOn":{"time":176.570,"note":106.000,"xyz":[118.260,362.000,-186.742]}},{"noteOn":{"time":176.715,"note":98.000,"xyz":[-182.858,266.000,-202.593]}},{"noteOn":{"time":176.735,"note":91.000,"xyz":[12.708,182.000,-79.199]}},{"noteOn":{"time":176.745,"note":115.000,"xyz":[71.337,470.000,482.387]}},{"noteOn":{"time":176.865,"note":98.000,"xyz":[-282.726,266.000,259.348]}},{"noteOn":{"time":176.910,"note":104.000,"xyz":[332.507,338.000,328.965]}},{"noteOn":{"time":176.925,"note":96.000,"xyz":[64.587,242.000,-131.923]}},{"noteOn":{"time":177.040,"note":106.000,"xyz":[422.511,362.000,-93.499]}},{"noteOn":{"time":177.060,"note":112.000,"xyz":[261.067,434.000,-201.062]}},{"noteOn":{"time":177.150,"note":116.000,"xyz":[356.837,482.000,-104.818]}},{"noteOn":{"time":177.165,"note":106.000,"xyz":[-282.520,362.000,-269.910]}},{"noteOn":{"time":177.435,"note":100.000,"xyz":[-159.230,290.000,-134.429]}},{"noteOn":{"time":177.445,"note":98.000,"xyz":[317.152,266.000,-235.382]}},{"noteOn":{"time":177.445,"note":100.000,"xyz":[213.214,290.000,-370.973]}},{"noteOn":{"time":177.485,"note":102.000,"xyz":[188.966,314.000,-182.804]}},{"noteOn":{"time":177.560,"note":108.000,"xyz":[266.474,386.000,-202.361]}},{"noteOn":{"time":177.580,"note":93.000,"xyz":[195.750,206.000,282.926]}},{"noteOn":{"time":177.690,"note":107.000,"xyz":[-52.537,374.000,-137.892]}},{"noteOn":{"time":177.955,"note":96.000,"xyz":[-222.365,242.000,-308.402]}},{"noteOn":{"time":178.050,"note":112.000,"xyz":[356.906,434.000,-174.601]}},{"noteOn":{"time":178.055,"note":104.000,"xyz":[-391.038,338.000,-280.155]}},{"noteOn":{"time":178.110,"note":100.000,"xyz":[-51.010,290.000,-95.953]}},{"noteOn":{"time":178.145,"note":114.000,"xyz":[-1.845,458.000,107.721]}},{"noteOn":{"time":178.200,"note":103.000,"xyz":[73.920,326.000,433.145]}},{"noteOn":{"time":178.210,"note":111.000,"xyz":[114.041,422.000,-50.202]}},{"noteOn":{"time":178.335,"note":99.000,"xyz":[390.389,278.000,-3.416]}},{"noteOn":{"time":178.355,"note":102.000,"xyz":[10.861,314.000,-165.695]}},{"noteOn":{"time":178.555,"note":107.000,"xyz":[120.066,374.000,62.440]}},{"noteOn":{"time":178.705,"note":93.000,"xyz":[-203.106,206.000,227.614]}},{"noteOn":{"time":178.705,"note":104.000,"xyz":[-113.235,338.000,164.661]}},{"noteOn":{"time":178.890,"note":109.000,"xyz":[-217.036,398.000,-87.339]}},{"noteOn":{"time":178.900,"note":108.000,"xyz":[244.990,386.000,-276.273]}},{"noteOn":{"time":178.920,"note":98.000,"xyz":[208.941,266.000,-2.137]}},{"noteOn":{"time":179.130,"note":93.000,"xyz":[263.403,206.000,-339.850]}},{"noteOn":{"time":179.165,"note":97.000,"xyz":[-170.794,254.000,376.628]}},{"noteOn":{"time":179.170,"note":104.000,"xyz":[-251.647,338.000,291.760]}},{"noteOn":{"time":179.215,"note":103.000,"xyz":[337.775,326.000,34.991]}},{"noteOn":{"time":179.345,"note":115.000,"xyz":[291.292,470.000,-363.017]}},{"noteOn":{"time":179.405,"note":115.000,"xyz":[-331.666,470.000,-229.757]}},{"noteOn":{"time":179.410,"note":111.000,"xyz":[203.156,422.000,105.995]}},{"noteOn":{"time":179.510,"note":112.000,"xyz":[-121.663,434.000,397.207]}},{"noteOn":{"time":179.880,"note":104.000,"xyz":[-323.672,338.000,-27.683]}},{"noteOn":{"time":179.915,"note":96.000,"xyz":[164.548,242.000,-108.511]}},{"noteOn":{"time":179.990,"note":101.000,"xyz":[40.042,302.000,135.327]}},{"noteOn":{"time":180.025,"note":95.000,"xyz":[8.160,230.000,-122.638]}},{"noteOn":{"time":180.050,"note":113.000,"xyz":[-250.669,446.000,-157.849]}},{"noteOn":{"time":180.055,"note":109.000,"xyz":[-282.374,398.000,-370.202]}},{"noteOn":{"time":180.085,"note":99.000,"xyz":[79.632,278.000,-436.332]}},{"noteOn":{"time":180.145,"note":107.000,"xyz":[-179.697,374.000,12.737]}},{"noteOn":{"time":180.245,"note":117.000,"xyz":[302.534,494.000,384.617]}},{"noteOn":{"time":180.535,"note":99.000,"xyz":[147.632,278.000,190.452]}},{"noteOn":{"time":180.595,"note":102.000,"xyz":[434.776,314.000,128.169]}},{"noteOn":{"time":180.675,"note":113.000,"xyz":[35.743,446.000,-149.691]}},{"noteOn":{"time":180.715,"note":97.000,"xyz":[468.563,254.000,-34.388]}},{"noteOn":{"time":180.745,"note":99.000,"xyz":[-119.587,278.000,104.661]}},{"noteOn":{"time":180.775,"note":105.000,"xyz":[113.162,350.000,53.531]}},{"noteOn":{"time":180.915,"note":107.000,"xyz":[176.466,374.000,51.527]}},{"noteOn":{"time":181.120,"note":105.000,"xyz":[-51.494,350.000,-2.126]}},{"noteOn":{"time":181.190,"note":92.000,"xyz":[-129.508,194.000,166.299]}},{"noteOn":{"time":181.215,"note":115.000,"xyz":[-131.149,470.000,195.808]}},{"noteOn":{"time":181.290,"note":97.000,"xyz":[-210.309,254.000,264.953]}},{"noteOn":{"time":181.340,"note":101.000,"xyz":[166.540,302.000,1.963]}},{"noteOn":{"time":181.355,"note":103.000,"xyz":[358.642,326.000,-19.431]}},{"noteOn":{"time":181.525,"note":97.000,"xyz":[352.518,254.000,-73.310]}},{"noteOn":{"time":181.755,"note":106.000,"xyz":[314.158,362.000,343.291]}},{"noteOn":{"time":181.905,"note":115.000,"xyz":[184.141,470.000,-158.580]}},{"noteOn":{"time":181.910,"note":95.000,"xyz":[-323.481,230.000,-319.812]}},{"noteOn":{"time":181.915,"note":109.000,"xyz":[-237.129,398.000,-75.203]}},{"noteOn":{"time":181.925,"note":101.000,"xyz":[-231.648,302.000,-154.195]}},{"noteOn":{"time":181.945,"note":101.000,"xyz":[177.178,302.000,408.037]}},{"noteOn":{"time":182.010,"note":94.000,"xyz":[214.045,218.000,361.595]}},{"noteOn":{"time":182.125,"note":99.000,"xyz":[266.540,278.000,311.218]}},{"noteOn":{"time":182.370,"note":108.000,"xyz":[46.718,386.000,-119.295]}},{"noteOn":{"time":182.445,"note":113.000,"xyz":[-256.868,446.000,92.455]}},{"noteOn":{"time":182.670,"note":99.000,"xyz":[70.171,278.000,-153.593]}},{"noteOn":{"time":182.735,"note":103.000,"xyz":[-192.563,326.000,-76.909]}},{"noteOn":{"time":182.745,"note":98.000,"xyz":[-341.646,266.000,-348.420]}},{"noteOn":{"time":182.745,"note":93.000,"xyz":[160.255,206.000,-19.326]}},{"noteOn":{"time":182.750,"note":111.000,"xyz":[-249.487,422.000,150.425]}},{"noteOn":{"time":182.915,"note":103.000,"xyz":[-18.387,326.000,-322.386]}},{"noteOn":{"time":183.070,"note":114.000,"xyz":[244.380,458.000,-345.402]}},{"noteOn":{"time":183.150,"note":109.000,"xyz":[-205.572,398.000,183.707]}},{"noteOn":{"time":183.345,"note":103.000,"xyz":[-294.303,326.000,25.672]}},{"noteOn":{"time":183.360,"note":97.000,"xyz":[-28.603,254.000,397.332]}},{"noteOn":{"time":183.585,"note":109.000,"xyz":[313.342,398.000,-283.548]}},{"noteOn":{"time":183.845,"note":112.000,"xyz":[-41.867,434.000,-268.625]}},{"noteOn":{"time":183.885,"note":105.000,"xyz":[28.928,350.000,45.521]}},{"noteOn":{"time":184.200,"note":105.000,"xyz":[103.824,350.000,-72.621]}},{"noteOn":{"time":184.210,"note":100.000,"xyz":[126.762,290.000,46.971]}},{"noteOn":{"time":184.475,"note":95.000,"xyz":[-83.202,230.000,449.725]}},{"noteOn":{"time":184.580,"note":116.000,"xyz":[61.334,482.000,-73.063]}},{"noteOn":{"time":184.705,"note":114.000,"xyz":[343.896,458.000,251.054]}},{"noteOn":{"time":185.120,"note":97.000,"xyz":[130.997,254.000,53.321]}},{"noteOn":{"time":185.185,"note":105.000,"xyz":[136.976,350.000,-397.117]}},{"noteOn":{"time":185.255,"note":116.000,"xyz":[-106.704,482.000,-382.208]}},{"noteOn":{"time":185.640,"note":116.000,"xyz":[41.070,482.000,-236.570]}},{"noteOn":{"time":185.920,"note":102.000,"xyz":[-25.348,314.000,-222.499]}},{"noteOn":{"time":186.055,"note":98.000,"xyz":[236.260,266.000,-341.079]}},{"noteOn":{"time":186.095,"note":108.000,"xyz":[444.781,386.000,97.990]}},{"noteOn":{"time":186.610,"note":110.000,"xyz":[-153.166,410.000,-215.173]}},{"noteOn":{"time":186.625,"note":106.000,"xyz":[-1.182,362.000,-336.465]}},{"noteOn":{"time":186.660,"note":100.000,"xyz":[31.310,290.000,115.037]}},{"noteOn":{"time":187.475,"note":104.000,"xyz":[-54.639,338.000,-275.667]}},{"noteOn":{"time":187.530,"note":109.000,"xyz":[-268.832,398.000,221.527]}},{"noteOn":{"time":188.355,"note":106.000,"xyz":[-276.411,362.000,185.280]}},{"noteOn":{"time":188.355,"note":113.000,"xyz":[303.860,446.000,-227.762]}},{"noteOn":{"time":188.920,"note":96.000,"xyz":[55.719,242.000,138.301]}},{"noteOn":{"time":189.095,"note":111.000,"xyz":[-102.291,422.000,-124.036]}},{"noteOn":{"time":189.430,"note":98.000,"xyz":[-281.249,266.000,50.886]}},{"noteOn":{"time":189.760,"note":115.000,"xyz":[61.969,470.000,-48.871]}},{"noteOn":{"time":190.380,"note":102.000,"xyz":[-106.381,314.000,-357.964]}},{"noteOn":{"time":191.275,"note":100.000,"xyz":[-90.924,290.000,400.996]}},{"noteOn":{"time":191.940,"note":105.000,"xyz":[18.573,350.000,-334.171]}},{"noteOn":{"time":192.665,"note":107.000,"xyz":[-380.873,374.000,-87.564]}},{"noteOn":{"time":193.385,"note":97.000,"xyz":[155.047,254.000,143.936]}},{"noteOn":{"time":194.050,"note":99.000,"xyz":[-420.853,278.000,216.224]}},{"noteOn":{"time":194.945,"note":101.000,"xyz":[-123.264,302.000,103.133]}},{"noteOn":{"time":195.895,"note":99.000,"xyz":[105.958,278.000,-38.320]}},{"noteOn":{"time":196.410,"note":105.000,"xyz":[-78.831,350.000,30.794]}},{"noteOn":{"time":196.975,"note":106.000,"xyz":[143.626,362.000,-108.937]}},{"noteOn":{"time":197.850,"note":98.000,"xyz":[-73.923,266.000,458.147]}},{"noteOn":{"time":198.670,"note":100.000,"xyz":[-325.332,290.000,-192.154]}},{"noteOn":{"time":199.410,"note":100.000,"xyz":[-20.392,290.000,373.952]}},{"noteOn":{"time":200.210,"note":98.000,"xyz":[-272.870,266.000,68.234]}},{"noteOn":{"time":200.855,"note":106.000,"xyz":[296.571,362.000,202.720]}},{"noteOn":{"time":201.445,"note":106.000,"xyz":[204.468,362.000,21.471]}}],"9037b759-36e4-4600-b2cb-03383ebd65c1":[{"instanceName":"","duration":60,"gridColumnCount":30,"gridRowCount":30,"gridCellSize":30,"fullVolumeY":2,"speedY":10,"maxDistance":100,"maxHeight":100},{"noteOn":{"time":117.000,"column":0,"row":0}},{"noteOn":{"time":117.070,"column":29,"row":1}},{"noteOn":{"time":117.135,"column":27,"row":29}},{"noteOn":{"time":117.200,"column":0,"row":26}},{"noteOn":{"time":117.270,"column":5,"row":1}},{"noteOn":{"time":117.335,"column":28,"row":8}},{"noteOn":{"time":117.400,"column":18,"row":28}},{"noteOn":{"time":117.470,"column":1,"row":15}},{"noteOn":{"time":117.535,"column":18,"row":2}},{"noteOn":{"time":117.600,"column":27,"row":23}},{"noteOn":{"time":117.670,"column":2,"row":26}},{"noteOn":{"time":117.735,"column":9,"row":3}},{"noteOn":{"time":117.800,"column":26,"row":16}},{"noteOn":{"time":117.870,"column":6,"row":26}},{"noteOn":{"time":117.935,"column":8,"row":4}},{"noteOn":{"time":118.000,"column":25,"row":17}},{"noteOn":{"time":118.070,"column":4,"row":24}},{"noteOn":{"time":118.135,"column":15,"row":5}},{"noteOn":{"time":118.200,"column":22,"row":24}},{"noteOn":{"time":118.270,"column":5,"row":11}},{"noteOn":{"time":118.335,"column":23,"row":13}},{"noteOn":{"time":118.400,"column":6,"row":20}},{"noteOn":{"time":118.470,"column":22,"row":8}},{"noteOn":{"time":118.535,"column":7,"row":21}},{"noteOn":{"time":118.600,"column":21,"row":11}},{"noteOn":{"time":118.670,"column":8,"row":14}},{"noteOn":{"time":118.735,"column":18,"row":20}},{"noteOn":{"time":118.800,"column":19,"row":11}},{"noteOn":{"time":118.870,"column":15,"row":11}},{"noteOn":{"time":118.935,"column":17,"row":13}},{"noteOn":{"time":119.000,"column":1,"row":0}},{"noteOn":{"time":119.070,"column":29,"row":2}},{"noteOn":{"time":119.135,"column":26,"row":29}},{"noteOn":{"time":119.200,"column":0,"row":25}},{"noteOn":{"time":119.270,"column":6,"row":1}},{"noteOn":{"time":119.335,"column":28,"row":9}},{"noteOn":{"time":119.400,"column":17,"row":28}},{"noteOn":{"time":119.470,"column":1,"row":14}},{"noteOn":{"time":119.535,"column":19,"row":2}},{"noteOn":{"time":119.600,"column":27,"row":24}},{"noteOn":{"time":119.670,"column":2,"row":25}},{"noteOn":{"time":119.735,"column":10,"row":3}},{"noteOn":{"time":119.800,"column":26,"row":17}},{"noteOn":{"time":119.870,"column":5,"row":26}},{"noteOn":{"time":119.935,"column":9,"row":4}},{"noteOn":{"time":120.000,"column":25,"row":18}},{"noteOn":{"time":120.070,"column":4,"row":23}},{"noteOn":{"time":120.135,"column":16,"row":5}},{"noteOn":{"time":120.200,"column":21,"row":24}},{"noteOn":{"time":120.270,"column":5,"row":10}},{"noteOn":{"time":120.335,"column":23,"row":14}},{"noteOn":{"time":120.400,"column":6,"row":19}},{"noteOn":{"time":120.470,"column":22,"row":9}},{"noteOn":{"time":120.535,"column":7,"row":20}},{"noteOn":{"time":120.600,"column":21,"row":12}},{"noteOn":{"time":120.670,"column":8,"row":13}},{"noteOn":{"time":120.735,"column":17,"row":20}},{"noteOn":{"time":120.800,"column":19,"row":12}},{"noteOn":{"time":120.870,"column":16,"row":11}},{"noteOn":{"time":120.935,"column":17,"row":14}},{"noteOn":{"time":121.000,"column":2,"row":0}},{"noteOn":{"time":121.070,"column":29,"row":3}},{"noteOn":{"time":121.135,"column":25,"row":29}},{"noteOn":{"time":121.200,"column":0,"row":24}},{"noteOn":{"time":121.270,"column":7,"row":1}},{"noteOn":{"time":121.335,"column":28,"row":10}},{"noteOn":{"time":121.400,"column":16,"row":28}},{"noteOn":{"time":121.470,"column":1,"row":13}},{"noteOn":{"time":121.535,"column":20,"row":2}},{"noteOn":{"time":121.600,"column":27,"row":25}},{"noteOn":{"time":121.670,"column":2,"row":24}},{"noteOn":{"time":121.735,"column":11,"row":3}},{"noteOn":{"time":121.800,"column":26,"row":18}},{"noteOn":{"time":121.870,"column":4,"row":26}},{"noteOn":{"time":121.935,"column":10,"row":4}},{"noteOn":{"time":122.000,"column":25,"row":19}},{"noteOn":{"time":122.070,"column":4,"row":22}},{"noteOn":{"time":122.135,"column":17,"row":5}},{"noteOn":{"time":122.200,"column":20,"row":24}},{"noteOn":{"time":122.270,"column":5,"row":9}},{"noteOn":{"time":122.335,"column":23,"row":15}},{"noteOn":{"time":122.400,"column":6,"row":18}},{"noteOn":{"time":122.470,"column":22,"row":10}},{"noteOn":{"time":122.535,"column":7,"row":19}},{"noteOn":{"time":122.600,"column":21,"row":13}},{"noteOn":{"time":122.670,"column":8,"row":12}},{"noteOn":{"time":122.735,"column":16,"row":20}},{"noteOn":{"time":122.800,"column":19,"row":13}},{"noteOn":{"time":122.870,"column":17,"row":11}},{"noteOn":{"time":122.935,"column":17,"row":15}},{"noteOn":{"time":123.000,"column":3,"row":0}},{"noteOn":{"time":123.070,"column":29,"row":4}},{"noteOn":{"time":123.135,"column":24,"row":29}},{"noteOn":{"time":123.200,"column":0,"row":23}},{"noteOn":{"time":123.270,"column":8,"row":1}},{"noteOn":{"time":123.335,"column":28,"row":11}},{"noteOn":{"time":123.400,"column":15,"row":28}},{"noteOn":{"time":123.470,"column":1,"row":12}},{"noteOn":{"time":123.535,"column":21,"row":2}},{"noteOn":{"time":123.600,"column":27,"row":26}},{"noteOn":{"time":123.670,"column":2,"row":23}},{"noteOn":{"time":123.735,"column":12,"row":3}},{"noteOn":{"time":123.800,"column":26,"row":19}},{"noteOn":{"time":123.870,"column":3,"row":26}},{"noteOn":{"time":123.935,"column":11,"row":4}},{"noteOn":{"time":124.000,"column":25,"row":20}},{"noteOn":{"time":124.070,"column":4,"row":21}},{"noteOn":{"time":124.135,"column":18,"row":5}},{"noteOn":{"time":124.200,"column":19,"row":24}},{"noteOn":{"time":124.270,"column":5,"row":8}},{"noteOn":{"time":124.335,"column":23,"row":16}},{"noteOn":{"time":124.400,"column":6,"row":17}},{"noteOn":{"time":124.470,"column":22,"row":11}},{"noteOn":{"time":124.535,"column":7,"row":18}},{"noteOn":{"time":124.600,"column":21,"row":14}},{"noteOn":{"time":124.670,"column":8,"row":11}},{"noteOn":{"time":124.735,"column":15,"row":20}},{"noteOn":{"time":124.800,"column":19,"row":14}},{"noteOn":{"time":124.870,"column":18,"row":11}},{"noteOn":{"time":124.935,"column":17,"row":16}},{"noteOn":{"time":125.000,"column":4,"row":0}},{"noteOn":{"time":125.070,"column":29,"row":5}},{"noteOn":{"time":125.135,"column":23,"row":29}},{"noteOn":{"time":125.200,"column":0,"row":22}},{"noteOn":{"time":125.270,"column":9,"row":1}},{"noteOn":{"time":125.335,"column":28,"row":12}},{"noteOn":{"time":125.400,"column":14,"row":28}},{"noteOn":{"time":125.470,"column":1,"row":11}},{"noteOn":{"time":125.535,"column":22,"row":2}},{"noteOn":{"time":125.600,"column":27,"row":27}},{"noteOn":{"time":125.670,"column":2,"row":22}},{"noteOn":{"time":125.735,"column":13,"row":3}},{"noteOn":{"time":125.800,"column":26,"row":20}},{"noteOn":{"time":125.870,"column":3,"row":25}},{"noteOn":{"time":125.935,"column":12,"row":4}},{"noteOn":{"time":126.000,"column":25,"row":21}},{"noteOn":{"time":126.070,"column":4,"row":20}},{"noteOn":{"time":126.135,"column":19,"row":5}},{"noteOn":{"time":126.200,"column":18,"row":24}},{"noteOn":{"time":126.270,"column":5,"row":7}},{"noteOn":{"time":126.335,"column":23,"row":17}},{"noteOn":{"time":126.400,"column":6,"row":16}},{"noteOn":{"time":126.470,"column":22,"row":12}},{"noteOn":{"time":126.535,"column":7,"row":17}},{"noteOn":{"time":126.600,"column":21,"row":15}},{"noteOn":{"time":126.670,"column":8,"row":10}},{"noteOn":{"time":126.735,"column":14,"row":20}},{"noteOn":{"time":126.800,"column":19,"row":15}},{"noteOn":{"time":126.870,"column":18,"row":12}},{"noteOn":{"time":126.935,"column":17,"row":17}},{"noteOn":{"time":127.000,"column":5,"row":0}},{"noteOn":{"time":127.070,"column":29,"row":6}},{"noteOn":{"time":127.135,"column":22,"row":29}},{"noteOn":{"time":127.200,"column":0,"row":21}},{"noteOn":{"time":127.270,"column":10,"row":1}},{"noteOn":{"time":127.335,"column":28,"row":13}},{"noteOn":{"time":127.400,"column":13,"row":28}},{"noteOn":{"time":127.470,"column":1,"row":10}},{"noteOn":{"time":127.535,"column":23,"row":2}},{"noteOn":{"time":127.600,"column":26,"row":27}},{"noteOn":{"time":127.670,"column":2,"row":21}},{"noteOn":{"time":127.735,"column":14,"row":3}},{"noteOn":{"time":127.800,"column":26,"row":21}},{"noteOn":{"time":127.870,"column":3,"row":24}},{"noteOn":{"time":127.935,"column":13,"row":4}},{"noteOn":{"time":128.000,"column":25,"row":22}},{"noteOn":{"time":128.070,"column":4,"row":19}},{"noteOn":{"time":128.135,"column":20,"row":5}},{"noteOn":{"time":128.200,"column":17,"row":24}},{"noteOn":{"time":128.270,"column":5,"row":6}},{"noteOn":{"time":128.335,"column":23,"row":18}},{"noteOn":{"time":128.400,"column":6,"row":15}},{"noteOn":{"time":128.470,"column":22,"row":13}},{"noteOn":{"time":128.535,"column":7,"row":16}},{"noteOn":{"time":128.600,"column":21,"row":16}},{"noteOn":{"time":128.670,"column":8,"row":9}},{"noteOn":{"time":128.735,"column":13,"row":20}},{"noteOn":{"time":128.800,"column":19,"row":16}},{"noteOn":{"time":128.870,"column":18,"row":13}},{"noteOn":{"time":128.935,"column":16,"row":17}},{"noteOn":{"time":129.000,"column":6,"row":0}},{"noteOn":{"time":129.070,"column":29,"row":7}},{"noteOn":{"time":129.135,"column":21,"row":29}},{"noteOn":{"time":129.200,"column":0,"row":20}},{"noteOn":{"time":129.270,"column":11,"row":1}},{"noteOn":{"time":129.335,"column":28,"row":14}},{"noteOn":{"time":129.400,"column":12,"row":28}},{"noteOn":{"time":129.470,"column":1,"row":9}},{"noteOn":{"time":129.535,"column":24,"row":2}},{"noteOn":{"time":129.600,"column":25,"row":27}},{"noteOn":{"time":129.670,"column":2,"row":20}},{"noteOn":{"time":129.735,"column":15,"row":3}},{"noteOn":{"time":129.800,"column":26,"row":22}},{"noteOn":{"time":129.870,"column":3,"row":23}},{"noteOn":{"time":129.935,"column":14,"row":4}},{"noteOn":{"time":130.000,"column":25,"row":23}},{"noteOn":{"time":130.070,"column":4,"row":18}},{"noteOn":{"time":130.135,"column":21,"row":5}},{"noteOn":{"time":130.200,"column":16,"row":24}},{"noteOn":{"time":130.270,"column":6,"row":6}},{"noteOn":{"time":130.335,"column":23,"row":19}},{"noteOn":{"time":130.400,"column":6,"row":14}},{"noteOn":{"time":130.470,"column":22,"row":14}},{"noteOn":{"time":130.535,"column":7,"row":15}},{"noteOn":{"time":130.600,"column":21,"row":17}},{"noteOn":{"time":130.670,"column":9,"row":9}},{"noteOn":{"time":130.735,"column":12,"row":20}},{"noteOn":{"time":130.800,"column":19,"row":17}},{"noteOn":{"time":130.870,"column":18,"row":14}},{"noteOn":{"time":130.935,"column":15,"row":17}},{"noteOn":{"time":131.000,"column":7,"row":0}},{"noteOn":{"time":131.070,"column":29,"row":8}},{"noteOn":{"time":131.135,"column":20,"row":29}},{"noteOn":{"time":131.200,"column":0,"row":19}},{"noteOn":{"time":131.270,"column":12,"row":1}},{"noteOn":{"time":131.335,"column":28,"row":15}},{"noteOn":{"time":131.400,"column":11,"row":28}},{"noteOn":{"time":131.470,"column":1,"row":8}},{"noteOn":{"time":131.535,"column":25,"row":2}},{"noteOn":{"time":131.600,"column":24,"row":27}},{"noteOn":{"time":131.670,"column":2,"row":19}},{"noteOn":{"time":131.735,"column":16,"row":3}},{"noteOn":{"time":131.800,"column":26,"row":23}},{"noteOn":{"time":131.870,"column":3,"row":22}},{"noteOn":{"time":131.935,"column":15,"row":4}},{"noteOn":{"time":132.000,"column":25,"row":24}},{"noteOn":{"time":132.070,"column":4,"row":17}},{"noteOn":{"time":132.135,"column":22,"row":5}},{"noteOn":{"time":132.200,"column":15,"row":24}},{"noteOn":{"time":132.270,"column":7,"row":6}},{"noteOn":{"time":132.335,"column":23,"row":20}},{"noteOn":{"time":132.400,"column":6,"row":13}},{"noteOn":{"time":132.470,"column":22,"row":15}},{"noteOn":{"time":132.535,"column":7,"row":14}},{"noteOn":{"time":132.600,"column":21,"row":18}},{"noteOn":{"time":132.670,"column":10,"row":9}},{"noteOn":{"time":132.735,"column":11,"row":20}},{"noteOn":{"time":132.800,"column":19,"row":18}},{"noteOn":{"time":132.870,"column":18,"row":15}},{"noteOn":{"time":132.935,"column":14,"row":17}},{"noteOn":{"time":133.000,"column":8,"row":0}},{"noteOn":{"time":133.070,"column":29,"row":9}},{"noteOn":{"time":133.135,"column":19,"row":29}},{"noteOn":{"time":133.200,"column":0,"row":18}},{"noteOn":{"time":133.270,"column":13,"row":1}},{"noteOn":{"time":133.335,"column":28,"row":16}},{"noteOn":{"time":133.400,"column":10,"row":28}},{"noteOn":{"time":133.470,"column":1,"row":7}},{"noteOn":{"time":133.535,"column":26,"row":2}},{"noteOn":{"time":133.600,"column":23,"row":27}},{"noteOn":{"time":133.670,"column":2,"row":18}},{"noteOn":{"time":133.735,"column":17,"row":3}},{"noteOn":{"time":133.800,"column":26,"row":24}},{"noteOn":{"time":133.870,"column":3,"row":21}},{"noteOn":{"time":133.935,"column":16,"row":4}},{"noteOn":{"time":134.000,"column":25,"row":25}},{"noteOn":{"time":134.070,"column":4,"row":16}},{"noteOn":{"time":134.135,"column":23,"row":5}},{"noteOn":{"time":134.200,"column":14,"row":24}},{"noteOn":{"time":134.270,"column":8,"row":6}},{"noteOn":{"time":134.335,"column":23,"row":21}},{"noteOn":{"time":134.400,"column":6,"row":12}},{"noteOn":{"time":134.470,"column":22,"row":16}},{"noteOn":{"time":134.535,"column":7,"row":13}},{"noteOn":{"time":134.600,"column":21,"row":19}},{"noteOn":{"time":134.670,"column":11,"row":9}},{"noteOn":{"time":134.735,"column":10,"row":20}},{"noteOn":{"time":134.800,"column":19,"row":19}},{"noteOn":{"time":134.870,"column":18,"row":16}},{"noteOn":{"time":134.935,"column":13,"row":17}},{"noteOn":{"time":135.000,"column":9,"row":0}},{"noteOn":{"time":135.070,"column":29,"row":10}},{"noteOn":{"time":135.135,"column":18,"row":29}},{"noteOn":{"time":135.200,"column":0,"row":17}},{"noteOn":{"time":135.270,"column":14,"row":1}},{"noteOn":{"time":135.335,"column":28,"row":17}},{"noteOn":{"time":135.400,"column":9,"row":28}},{"noteOn":{"time":135.470,"column":1,"row":6}},{"noteOn":{"time":135.535,"column":27,"row":2}},{"noteOn":{"time":135.600,"column":22,"row":27}},{"noteOn":{"time":135.670,"column":2,"row":17}},{"noteOn":{"time":135.735,"column":18,"row":3}},{"noteOn":{"time":135.800,"column":26,"row":25}},{"noteOn":{"time":135.870,"column":3,"row":20}},{"noteOn":{"time":135.935,"column":17,"row":4}},{"noteOn":{"time":136.000,"column":24,"row":25}},{"noteOn":{"time":136.070,"column":4,"row":15}},{"noteOn":{"time":136.135,"column":24,"row":5}},{"noteOn":{"time":136.200,"column":13,"row":24}},{"noteOn":{"time":136.270,"column":9,"row":6}},{"noteOn":{"time":136.335,"column":23,"row":22}},{"noteOn":{"time":136.400,"column":6,"row":11}},{"noteOn":{"time":136.470,"column":22,"row":17}},{"noteOn":{"time":136.535,"column":7,"row":12}},{"noteOn":{"time":136.600,"column":21,"row":20}},{"noteOn":{"time":136.670,"column":12,"row":9}},{"noteOn":{"time":136.735,"column":9,"row":20}},{"noteOn":{"time":136.800,"column":18,"row":19}},{"noteOn":{"time":136.870,"column":18,"row":17}},{"noteOn":{"time":136.935,"column":12,"row":17}},{"noteOn":{"time":137.000,"column":10,"row":0}},{"noteOn":{"time":137.070,"column":29,"row":11}},{"noteOn":{"time":137.135,"column":17,"row":29}},{"noteOn":{"time":137.200,"column":0,"row":16}},{"noteOn":{"time":137.270,"column":15,"row":1}},{"noteOn":{"time":137.335,"column":28,"row":18}},{"noteOn":{"time":137.400,"column":8,"row":28}},{"noteOn":{"time":137.470,"column":1,"row":5}},{"noteOn":{"time":137.535,"column":27,"row":3}},{"noteOn":{"time":137.600,"column":21,"row":27}},{"noteOn":{"time":137.670,"column":2,"row":16}},{"noteOn":{"time":137.735,"column":19,"row":3}},{"noteOn":{"time":137.800,"column":26,"row":26}},{"noteOn":{"time":137.870,"column":3,"row":19}},{"noteOn":{"time":137.935,"column":18,"row":4}},{"noteOn":{"time":138.000,"column":23,"row":25}},{"noteOn":{"time":138.070,"column":4,"row":14}},{"noteOn":{"time":138.135,"column":24,"row":6}},{"noteOn":{"time":138.200,"column":12,"row":24}},{"noteOn":{"time":138.270,"column":10,"row":6}},{"noteOn":{"time":138.335,"column":23,"row":23}},{"noteOn":{"time":138.400,"column":6,"row":10}},{"noteOn":{"time":138.470,"column":22,"row":18}},{"noteOn":{"time":138.535,"column":7,"row":11}},{"noteOn":{"time":138.600,"column":21,"row":21}},{"noteOn":{"time":138.670,"column":13,"row":9}},{"noteOn":{"time":138.735,"column":9,"row":19}},{"noteOn":{"time":138.800,"column":17,"row":19}},{"noteOn":{"time":138.870,"column":18,"row":18}},{"noteOn":{"time":138.935,"column":12,"row":16}},{"noteOn":{"time":139.000,"column":11,"row":0}},{"noteOn":{"time":139.070,"column":29,"row":12}},{"noteOn":{"time":139.135,"column":16,"row":29}},{"noteOn":{"time":139.200,"column":0,"row":15}},{"noteOn":{"time":139.270,"column":16,"row":1}},{"noteOn":{"time":139.335,"column":28,"row":19}},{"noteOn":{"time":139.400,"column":7,"row":28}},{"noteOn":{"time":139.470,"column":1,"row":4}},{"noteOn":{"time":139.535,"column":27,"row":4}},{"noteOn":{"time":139.600,"column":20,"row":27}},{"noteOn":{"time":139.670,"column":2,"row":15}},{"noteOn":{"time":139.735,"column":20,"row":3}},{"noteOn":{"time":139.800,"column":25,"row":26}},{"noteOn":{"time":139.870,"column":3,"row":18}},{"noteOn":{"time":139.935,"column":19,"row":4}},{"noteOn":{"time":140.000,"column":22,"row":25}},{"noteOn":{"time":140.070,"column":4,"row":13}},{"noteOn":{"time":140.135,"column":24,"row":7}},{"noteOn":{"time":140.200,"column":11,"row":24}},{"noteOn":{"time":140.270,"column":11,"row":6}},{"noteOn":{"time":140.335,"column":22,"row":23}},{"noteOn":{"time":140.400,"column":6,"row":9}},{"noteOn":{"time":140.470,"column":22,"row":19}},{"noteOn":{"time":140.535,"column":7,"row":10}},{"noteOn":{"time":140.600,"column":20,"row":21}},{"noteOn":{"time":140.670,"column":14,"row":9}},{"noteOn":{"time":140.735,"column":9,"row":18}},{"noteOn":{"time":140.800,"column":16,"row":19}},{"noteOn":{"time":140.870,"column":17,"row":18}},{"noteOn":{"time":140.935,"column":12,"row":15}},{"noteOn":{"time":141.000,"column":12,"row":0}},{"noteOn":{"time":141.070,"column":29,"row":13}},{"noteOn":{"time":141.135,"column":15,"row":29}},{"noteOn":{"time":141.200,"column":0,"row":14}},{"noteOn":{"time":141.270,"column":17,"row":1}},{"noteOn":{"time":141.335,"column":28,"row":20}},{"noteOn":{"time":141.400,"column":6,"row":28}},{"noteOn":{"time":141.470,"column":1,"row":3}},{"noteOn":{"time":141.535,"column":27,"row":5}},{"noteOn":{"time":141.600,"column":19,"row":27}},{"noteOn":{"time":141.670,"column":2,"row":14}},{"noteOn":{"time":141.735,"column":21,"row":3}},{"noteOn":{"time":141.800,"column":24,"row":26}},{"noteOn":{"time":141.870,"column":3,"row":17}},{"noteOn":{"time":141.935,"column":20,"row":4}},{"noteOn":{"time":142.000,"column":21,"row":25}},{"noteOn":{"time":142.070,"column":4,"row":12}},{"noteOn":{"time":142.135,"column":24,"row":8}},{"noteOn":{"time":142.200,"column":10,"row":24}},{"noteOn":{"time":142.270,"column":12,"row":6}},{"noteOn":{"time":142.335,"column":21,"row":23}},{"noteOn":{"time":142.400,"column":6,"row":8}},{"noteOn":{"time":142.470,"column":22,"row":20}},{"noteOn":{"time":142.535,"column":7,"row":9}},{"noteOn":{"time":142.600,"column":19,"row":21}},{"noteOn":{"time":142.670,"column":15,"row":9}},{"noteOn":{"time":142.735,"column":9,"row":17}},{"noteOn":{"time":142.800,"column":15,"row":19}},{"noteOn":{"time":142.870,"column":16,"row":18}},{"noteOn":{"time":142.935,"column":12,"row":14}},{"noteOn":{"time":143.000,"column":13,"row":0}},{"noteOn":{"time":143.070,"column":29,"row":14}},{"noteOn":{"time":143.135,"column":14,"row":29}},{"noteOn":{"time":143.200,"column":0,"row":13}},{"noteOn":{"time":143.270,"column":18,"row":1}},{"noteOn":{"time":143.335,"column":28,"row":21}},{"noteOn":{"time":143.400,"column":5,"row":28}},{"noteOn":{"time":143.470,"column":1,"row":2}},{"noteOn":{"time":143.535,"column":27,"row":6}},{"noteOn":{"time":143.600,"column":18,"row":27}},{"noteOn":{"time":143.670,"column":2,"row":13}},{"noteOn":{"time":143.735,"column":22,"row":3}},{"noteOn":{"time":143.800,"column":23,"row":26}},{"noteOn":{"time":143.870,"column":3,"row":16}},{"noteOn":{"time":143.935,"column":21,"row":4}},{"noteOn":{"time":144.000,"column":20,"row":25}},{"noteOn":{"time":144.070,"column":4,"row":11}},{"noteOn":{"time":144.135,"column":24,"row":9}},{"noteOn":{"time":144.200,"column":9,"row":24}},{"noteOn":{"time":144.270,"column":13,"row":6}},{"noteOn":{"time":144.335,"column":20,"row":23}},{"noteOn":{"time":144.400,"column":6,"row":7}},{"noteOn":{"time":144.470,"column":22,"row":21}},{"noteOn":{"time":144.535,"column":7,"row":8}},{"noteOn":{"time":144.600,"column":18,"row":21}},{"noteOn":{"time":144.670,"column":16,"row":9}},{"noteOn":{"time":144.735,"column":9,"row":16}},{"noteOn":{"time":144.800,"column":14,"row":19}},{"noteOn":{"time":144.870,"column":15,"row":18}},{"noteOn":{"time":144.935,"column":12,"row":13}},{"noteOn":{"time":145.000,"column":14,"row":0}},{"noteOn":{"time":145.070,"column":29,"row":15}},{"noteOn":{"time":145.135,"column":13,"row":29}},{"noteOn":{"time":145.200,"column":0,"row":12}},{"noteOn":{"time":145.270,"column":19,"row":1}},{"noteOn":{"time":145.335,"column":28,"row":22}},{"noteOn":{"time":145.400,"column":4,"row":28}},{"noteOn":{"time":145.470,"column":2,"row":2}},{"noteOn":{"time":145.535,"column":27,"row":7}},{"noteOn":{"time":145.600,"column":17,"row":27}},{"noteOn":{"time":145.670,"column":2,"row":12}},{"noteOn":{"time":145.735,"column":23,"row":3}},{"noteOn":{"time":145.800,"column":22,"row":26}},{"noteOn":{"time":145.870,"column":3,"row":15}},{"noteOn":{"time":145.935,"column":22,"row":4}},{"noteOn":{"time":146.000,"column":19,"row":25}},{"noteOn":{"time":146.070,"column":4,"row":10}},{"noteOn":{"time":146.135,"column":24,"row":10}},{"noteOn":{"time":146.200,"column":8,"row":24}},{"noteOn":{"time":146.270,"column":14,"row":6}},{"noteOn":{"time":146.335,"column":19,"row":23}},{"noteOn":{"time":146.400,"column":7,"row":7}},{"noteOn":{"time":146.470,"column":22,"row":22}},{"noteOn":{"time":146.535,"column":8,"row":8}},{"noteOn":{"time":146.600,"column":17,"row":21}},{"noteOn":{"time":146.670,"column":17,"row":9}},{"noteOn":{"time":146.735,"column":9,"row":15}},{"noteOn":{"time":146.800,"column":13,"row":19}},{"noteOn":{"time":146.870,"column":14,"row":18}},{"noteOn":{"time":146.935,"column":13,"row":13}},{"noteOn":{"time":147.000,"column":15,"row":0}},{"noteOn":{"time":147.070,"column":29,"row":16}},{"noteOn":{"time":147.135,"column":12,"row":29}},{"noteOn":{"time":147.200,"column":0,"row":11}},{"noteOn":{"time":147.270,"column":20,"row":1}},{"noteOn":{"time":147.335,"column":28,"row":23}},{"noteOn":{"time":147.400,"column":3,"row":28}},{"noteOn":{"time":147.470,"column":3,"row":2}},{"noteOn":{"time":147.535,"column":27,"row":8}},{"noteOn":{"time":147.600,"column":16,"row":27}},{"noteOn":{"time":147.670,"column":2,"row":11}},{"noteOn":{"time":147.735,"column":24,"row":3}},{"noteOn":{"time":147.800,"column":21,"row":26}},{"noteOn":{"time":147.870,"column":3,"row":14}},{"noteOn":{"time":147.935,"column":23,"row":4}},{"noteOn":{"time":148.000,"column":18,"row":25}},{"noteOn":{"time":148.070,"column":4,"row":9}},{"noteOn":{"time":148.135,"column":24,"row":11}},{"noteOn":{"time":148.200,"column":7,"row":24}},{"noteOn":{"time":148.270,"column":15,"row":6}},{"noteOn":{"time":148.335,"column":18,"row":23}},{"noteOn":{"time":148.400,"column":8,"row":7}},{"noteOn":{"time":148.470,"column":21,"row":22}},{"noteOn":{"time":148.535,"column":9,"row":8}},{"noteOn":{"time":148.600,"column":16,"row":21}},{"noteOn":{"time":148.670,"column":18,"row":9}},{"noteOn":{"time":148.735,"column":9,"row":14}},{"noteOn":{"time":148.800,"column":12,"row":19}},{"noteOn":{"time":148.870,"column":13,"row":18}},{"noteOn":{"time":148.935,"column":14,"row":13}},{"noteOn":{"time":149.000,"column":16,"row":0}},{"noteOn":{"time":149.070,"column":29,"row":17}},{"noteOn":{"time":149.135,"column":11,"row":29}},{"noteOn":{"time":149.200,"column":0,"row":10}},{"noteOn":{"time":149.270,"column":21,"row":1}},{"noteOn":{"time":149.335,"column":28,"row":24}},{"noteOn":{"time":149.400,"column":2,"row":28}},{"noteOn":{"time":149.470,"column":4,"row":2}},{"noteOn":{"time":149.535,"column":27,"row":9}},{"noteOn":{"time":149.600,"column":15,"row":27}},{"noteOn":{"time":149.670,"column":2,"row":10}},{"noteOn":{"time":149.735,"column":25,"row":3}},{"noteOn":{"time":149.800,"column":20,"row":26}},{"noteOn":{"time":149.870,"column":3,"row":13}},{"noteOn":{"time":149.935,"column":24,"row":4}},{"noteOn":{"time":150.000,"column":17,"row":25}},{"noteOn":{"time":150.070,"column":4,"row":8}},{"noteOn":{"time":150.135,"column":24,"row":12}},{"noteOn":{"time":150.200,"column":6,"row":24}},{"noteOn":{"time":150.270,"column":16,"row":6}},{"noteOn":{"time":150.335,"column":17,"row":23}},{"noteOn":{"time":150.400,"column":9,"row":7}},{"noteOn":{"time":150.470,"column":20,"row":22}},{"noteOn":{"time":150.535,"column":10,"row":8}},{"noteOn":{"time":150.600,"column":15,"row":21}},{"noteOn":{"time":150.670,"column":19,"row":9}},{"noteOn":{"time":150.735,"column":9,"row":13}},{"noteOn":{"time":150.800,"column":11,"row":19}},{"noteOn":{"time":150.870,"column":12,"row":18}},{"noteOn":{"time":150.935,"column":15,"row":13}},{"noteOn":{"time":151.000,"column":17,"row":0}},{"noteOn":{"time":151.070,"column":29,"row":18}},{"noteOn":{"time":151.135,"column":10,"row":29}},{"noteOn":{"time":151.200,"column":0,"row":9}},{"noteOn":{"time":151.270,"column":22,"row":1}},{"noteOn":{"time":151.335,"column":28,"row":25}},{"noteOn":{"time":151.400,"column":1,"row":28}},{"noteOn":{"time":151.470,"column":5,"row":2}},{"noteOn":{"time":151.535,"column":27,"row":10}},{"noteOn":{"time":151.600,"column":14,"row":27}},{"noteOn":{"time":151.670,"column":2,"row":9}},{"noteOn":{"time":151.735,"column":26,"row":3}},{"noteOn":{"time":151.800,"column":19,"row":26}},{"noteOn":{"time":151.870,"column":3,"row":12}},{"noteOn":{"time":151.935,"column":25,"row":4}},{"noteOn":{"time":152.000,"column":16,"row":25}},{"noteOn":{"time":152.070,"column":4,"row":7}},{"noteOn":{"time":152.135,"column":24,"row":13}},{"noteOn":{"time":152.200,"column":5,"row":24}},{"noteOn":{"time":152.270,"column":17,"row":6}},{"noteOn":{"time":152.335,"column":16,"row":23}},{"noteOn":{"time":152.400,"column":10,"row":7}},{"noteOn":{"time":152.470,"column":19,"row":22}},{"noteOn":{"time":152.535,"column":11,"row":8}},{"noteOn":{"time":152.600,"column":14,"row":21}},{"noteOn":{"time":152.670,"column":20,"row":9}},{"noteOn":{"time":152.735,"column":9,"row":12}},{"noteOn":{"time":152.800,"column":10,"row":19}},{"noteOn":{"time":152.870,"column":11,"row":18}},{"noteOn":{"time":152.935,"column":16,"row":13}},{"noteOn":{"time":153.000,"column":18,"row":0}},{"noteOn":{"time":153.070,"column":29,"row":19}},{"noteOn":{"time":153.135,"column":9,"row":29}},{"noteOn":{"time":153.200,"column":0,"row":8}},{"noteOn":{"time":153.270,"column":23,"row":1}},{"noteOn":{"time":153.335,"column":28,"row":26}},{"noteOn":{"time":153.400,"column":1,"row":27}},{"noteOn":{"time":153.470,"column":6,"row":2}},{"noteOn":{"time":153.535,"column":27,"row":11}},{"noteOn":{"time":153.600,"column":13,"row":27}},{"noteOn":{"time":153.670,"column":2,"row":8}},{"noteOn":{"time":153.735,"column":26,"row":4}},{"noteOn":{"time":153.800,"column":18,"row":26}},{"noteOn":{"time":153.870,"column":3,"row":11}},{"noteOn":{"time":153.935,"column":25,"row":5}},{"noteOn":{"time":154.000,"column":15,"row":25}},{"noteOn":{"time":154.070,"column":4,"row":6}},{"noteOn":{"time":154.135,"column":24,"row":14}},{"noteOn":{"time":154.200,"column":5,"row":23}},{"noteOn":{"time":154.270,"column":18,"row":6}},{"noteOn":{"time":154.335,"column":15,"row":23}},{"noteOn":{"time":154.400,"column":11,"row":7}},{"noteOn":{"time":154.470,"column":18,"row":22}},{"noteOn":{"time":154.535,"column":12,"row":8}},{"noteOn":{"time":154.600,"column":13,"row":21}},{"noteOn":{"time":154.670,"column":20,"row":10}},{"noteOn":{"time":154.735,"column":9,"row":11}},{"noteOn":{"time":154.800,"column":10,"row":18}},{"noteOn":{"time":154.870,"column":11,"row":17}},{"noteOn":{"time":154.935,"column":16,"row":14}},{"noteOn":{"time":155.000,"column":19,"row":0}},{"noteOn":{"time":155.070,"column":29,"row":20}},{"noteOn":{"time":155.135,"column":8,"row":29}},{"noteOn":{"time":155.200,"column":0,"row":7}},{"noteOn":{"time":155.270,"column":24,"row":1}},{"noteOn":{"time":155.335,"column":28,"row":27}},{"noteOn":{"time":155.400,"column":1,"row":26}},{"noteOn":{"time":155.470,"column":7,"row":2}},{"noteOn":{"time":155.535,"column":27,"row":12}},{"noteOn":{"time":155.600,"column":12,"row":27}},{"noteOn":{"time":155.670,"column":2,"row":7}},{"noteOn":{"time":155.735,"column":26,"row":5}},{"noteOn":{"time":155.800,"column":17,"row":26}},{"noteOn":{"time":155.870,"column":3,"row":10}},{"noteOn":{"time":155.935,"column":25,"row":6}},{"noteOn":{"time":156.000,"column":14,"row":25}},{"noteOn":{"time":156.070,"column":4,"row":5}},{"noteOn":{"time":156.135,"column":24,"row":15}},{"noteOn":{"time":156.200,"column":5,"row":22}},{"noteOn":{"time":156.270,"column":19,"row":6}},{"noteOn":{"time":156.335,"column":14,"row":23}},{"noteOn":{"time":156.400,"column":12,"row":7}},{"noteOn":{"time":156.470,"column":17,"row":22}},{"noteOn":{"time":156.535,"column":13,"row":8}},{"noteOn":{"time":156.600,"column":12,"row":21}},{"noteOn":{"time":156.670,"column":20,"row":11}},{"noteOn":{"time":156.735,"column":9,"row":10}},{"noteOn":{"time":156.800,"column":10,"row":17}},{"noteOn":{"time":156.870,"column":11,"row":16}},{"noteOn":{"time":156.935,"column":16,"row":15}},{"noteOn":{"time":157.000,"column":20,"row":0}},{"noteOn":{"time":157.070,"column":29,"row":21}},{"noteOn":{"time":157.135,"column":7,"row":29}},{"noteOn":{"time":157.200,"column":0,"row":6}},{"noteOn":{"time":157.270,"column":25,"row":1}},{"noteOn":{"time":157.335,"column":28,"row":28}},{"noteOn":{"time":157.400,"column":1,"row":25}},{"noteOn":{"time":157.470,"column":8,"row":2}},{"noteOn":{"time":157.535,"column":27,"row":13}},{"noteOn":{"time":157.600,"column":11,"row":27}},{"noteOn":{"time":157.670,"column":2,"row":6}},{"noteOn":{"time":157.735,"column":26,"row":6}},{"noteOn":{"time":157.800,"column":16,"row":26}},{"noteOn":{"time":157.870,"column":3,"row":9}},{"noteOn":{"time":157.935,"column":25,"row":7}},{"noteOn":{"time":158.000,"column":13,"row":25}},{"noteOn":{"time":158.070,"column":5,"row":5}},{"noteOn":{"time":158.135,"column":24,"row":16}},{"noteOn":{"time":158.200,"column":5,"row":21}},{"noteOn":{"time":158.270,"column":20,"row":6}},{"noteOn":{"time":158.335,"column":13,"row":23}},{"noteOn":{"time":158.400,"column":13,"row":7}},{"noteOn":{"time":158.470,"column":16,"row":22}},{"noteOn":{"time":158.535,"column":14,"row":8}},{"noteOn":{"time":158.600,"column":11,"row":21}},{"noteOn":{"time":158.670,"column":20,"row":12}},{"noteOn":{"time":158.735,"column":10,"row":10}},{"noteOn":{"time":158.800,"column":10,"row":16}},{"noteOn":{"time":158.870,"column":11,"row":15}},{"noteOn":{"time":158.935,"column":16,"row":16}},{"noteOn":{"time":159.000,"column":21,"row":0}},{"noteOn":{"time":159.070,"column":29,"row":22}},{"noteOn":{"time":159.135,"column":6,"row":29}},{"noteOn":{"time":159.200,"column":0,"row":5}},{"noteOn":{"time":159.270,"column":26,"row":1}},{"noteOn":{"time":159.335,"column":27,"row":28}},{"noteOn":{"time":159.400,"column":1,"row":24}},{"noteOn":{"time":159.470,"column":9,"row":2}},{"noteOn":{"time":159.535,"column":27,"row":14}},{"noteOn":{"time":159.600,"column":10,"row":27}},{"noteOn":{"time":159.670,"column":2,"row":5}},{"noteOn":{"time":159.735,"column":26,"row":7}},{"noteOn":{"time":159.800,"column":15,"row":26}},{"noteOn":{"time":159.870,"column":3,"row":8}},{"noteOn":{"time":159.935,"column":25,"row":8}},{"noteOn":{"time":160.000,"column":12,"row":25}},{"noteOn":{"time":160.070,"column":6,"row":5}},{"noteOn":{"time":160.135,"column":24,"row":17}},{"noteOn":{"time":160.200,"column":5,"row":20}},{"noteOn":{"time":160.270,"column":21,"row":6}},{"noteOn":{"time":160.335,"column":12,"row":23}},{"noteOn":{"time":160.400,"column":14,"row":7}},{"noteOn":{"time":160.470,"column":15,"row":22}},{"noteOn":{"time":160.535,"column":15,"row":8}},{"noteOn":{"time":160.600,"column":10,"row":21}},{"noteOn":{"time":160.670,"column":20,"row":13}},{"noteOn":{"time":160.735,"column":11,"row":10}},{"noteOn":{"time":160.800,"column":10,"row":15}},{"noteOn":{"time":160.870,"column":11,"row":14}},{"noteOn":{"time":160.935,"column":15,"row":16}},{"noteOn":{"time":161.000,"column":22,"row":0}},{"noteOn":{"time":161.070,"column":29,"row":23}},{"noteOn":{"time":161.135,"column":5,"row":29}},{"noteOn":{"time":161.200,"column":0,"row":4}},{"noteOn":{"time":161.270,"column":27,"row":1}},{"noteOn":{"time":161.335,"column":26,"row":28}},{"noteOn":{"time":161.400,"column":1,"row":23}},{"noteOn":{"time":161.470,"column":10,"row":2}},{"noteOn":{"time":161.535,"column":27,"row":15}},{"noteOn":{"time":161.600,"column":9,"row":27}},{"noteOn":{"time":161.670,"column":2,"row":4}},{"noteOn":{"time":161.735,"column":26,"row":8}},{"noteOn":{"time":161.800,"column":14,"row":26}},{"noteOn":{"time":161.870,"column":3,"row":7}},{"noteOn":{"time":161.935,"column":25,"row":9}},{"noteOn":{"time":162.000,"column":11,"row":25}},{"noteOn":{"time":162.070,"column":7,"row":5}},{"noteOn":{"time":162.135,"column":24,"row":18}},{"noteOn":{"time":162.200,"column":5,"row":19}},{"noteOn":{"time":162.270,"column":22,"row":6}},{"noteOn":{"time":162.335,"column":11,"row":23}},{"noteOn":{"time":162.400,"column":15,"row":7}},{"noteOn":{"time":162.470,"column":14,"row":22}},{"noteOn":{"time":162.535,"column":16,"row":8}},{"noteOn":{"time":162.600,"column":9,"row":21}},{"noteOn":{"time":162.670,"column":20,"row":14}},{"noteOn":{"time":162.735,"column":12,"row":10}},{"noteOn":{"time":162.800,"column":10,"row":14}},{"noteOn":{"time":162.870,"column":11,"row":13}},{"noteOn":{"time":162.935,"column":14,"row":16}},{"noteOn":{"time":163.000,"column":23,"row":0}},{"noteOn":{"time":163.070,"column":29,"row":24}},{"noteOn":{"time":163.135,"column":4,"row":29}},{"noteOn":{"time":163.200,"column":0,"row":3}},{"noteOn":{"time":163.270,"column":28,"row":1}},{"noteOn":{"time":163.335,"column":25,"row":28}},{"noteOn":{"time":163.400,"column":1,"row":22}},{"noteOn":{"time":163.470,"column":11,"row":2}},{"noteOn":{"time":163.535,"column":27,"row":16}},{"noteOn":{"time":163.600,"column":8,"row":27}},{"noteOn":{"time":163.670,"column":2,"row":3}},{"noteOn":{"time":163.735,"column":26,"row":9}},{"noteOn":{"time":163.800,"column":13,"row":26}},{"noteOn":{"time":163.870,"column":3,"row":6}},{"noteOn":{"time":163.935,"column":25,"row":10}},{"noteOn":{"time":164.000,"column":10,"row":25}},{"noteOn":{"time":164.070,"column":8,"row":5}},{"noteOn":{"time":164.135,"column":24,"row":19}},{"noteOn":{"time":164.200,"column":5,"row":18}},{"noteOn":{"time":164.270,"column":23,"row":6}},{"noteOn":{"time":164.335,"column":10,"row":23}},{"noteOn":{"time":164.400,"column":16,"row":7}},{"noteOn":{"time":164.470,"column":13,"row":22}},{"noteOn":{"time":164.535,"column":17,"row":8}},{"noteOn":{"time":164.600,"column":8,"row":21}},{"noteOn":{"time":164.670,"column":20,"row":15}},{"noteOn":{"time":164.735,"column":13,"row":10}},{"noteOn":{"time":164.800,"column":10,"row":13}},{"noteOn":{"time":164.870,"column":11,"row":12}},{"noteOn":{"time":164.935,"column":13,"row":16}},{"noteOn":{"time":165.000,"column":24,"row":0}},{"noteOn":{"time":165.070,"column":29,"row":25}},{"noteOn":{"time":165.135,"column":3,"row":29}},{"noteOn":{"time":165.200,"column":0,"row":2}},{"noteOn":{"time":165.270,"column":28,"row":2}},{"noteOn":{"time":165.335,"column":24,"row":28}},{"noteOn":{"time":165.400,"column":1,"row":21}},{"noteOn":{"time":165.470,"column":12,"row":2}},{"noteOn":{"time":165.535,"column":27,"row":17}},{"noteOn":{"time":165.600,"column":7,"row":27}},{"noteOn":{"time":165.670,"column":3,"row":3}},{"noteOn":{"time":165.735,"column":26,"row":10}},{"noteOn":{"time":165.800,"column":12,"row":26}},{"noteOn":{"time":165.870,"column":3,"row":5}},{"noteOn":{"time":165.935,"column":25,"row":11}},{"noteOn":{"time":166.000,"column":9,"row":25}},{"noteOn":{"time":166.070,"column":9,"row":5}},{"noteOn":{"time":166.135,"column":24,"row":20}},{"noteOn":{"time":166.200,"column":5,"row":17}},{"noteOn":{"time":166.270,"column":23,"row":7}},{"noteOn":{"time":166.335,"column":9,"row":23}},{"noteOn":{"time":166.400,"column":17,"row":7}},{"noteOn":{"time":166.470,"column":12,"row":22}},{"noteOn":{"time":166.535,"column":18,"row":8}},{"noteOn":{"time":166.600,"column":8,"row":20}},{"noteOn":{"time":166.670,"column":20,"row":16}},{"noteOn":{"time":166.735,"column":14,"row":10}},{"noteOn":{"time":166.800,"column":10,"row":12}},{"noteOn":{"time":166.870,"column":12,"row":12}},{"noteOn":{"time":166.935,"column":13,"row":15}},{"noteOn":{"time":167.000,"column":25,"row":0}},{"noteOn":{"time":167.070,"column":29,"row":26}},{"noteOn":{"time":167.135,"column":2,"row":29}},{"noteOn":{"time":167.200,"column":0,"row":1}},{"noteOn":{"time":167.270,"column":28,"row":3}},{"noteOn":{"time":167.335,"column":23,"row":28}},{"noteOn":{"time":167.400,"column":1,"row":20}},{"noteOn":{"time":167.470,"column":13,"row":2}},{"noteOn":{"time":167.535,"column":27,"row":18}},{"noteOn":{"time":167.600,"column":6,"row":27}},{"noteOn":{"time":167.670,"column":4,"row":3}},{"noteOn":{"time":167.735,"column":26,"row":11}},{"noteOn":{"time":167.800,"column":11,"row":26}},{"noteOn":{"time":167.870,"column":3,"row":4}},{"noteOn":{"time":167.935,"column":25,"row":12}},{"noteOn":{"time":168.000,"column":8,"row":25}},{"noteOn":{"time":168.070,"column":10,"row":5}},{"noteOn":{"time":168.135,"column":24,"row":21}},{"noteOn":{"time":168.200,"column":5,"row":16}},{"noteOn":{"time":168.270,"column":23,"row":8}},{"noteOn":{"time":168.335,"column":8,"row":23}},{"noteOn":{"time":168.400,"column":18,"row":7}},{"noteOn":{"time":168.470,"column":11,"row":22}},{"noteOn":{"time":168.535,"column":19,"row":8}},{"noteOn":{"time":168.600,"column":8,"row":19}},{"noteOn":{"time":168.670,"column":20,"row":17}},{"noteOn":{"time":168.735,"column":15,"row":10}},{"noteOn":{"time":168.800,"column":10,"row":11}},{"noteOn":{"time":168.870,"column":13,"row":12}},{"noteOn":{"time":168.935,"column":13,"row":14}},{"noteOn":{"time":169.000,"column":26,"row":0}},{"noteOn":{"time":169.070,"column":29,"row":27}},{"noteOn":{"time":169.135,"column":1,"row":29}},{"noteOn":{"time":169.200,"column":1,"row":1}},{"noteOn":{"time":169.270,"column":28,"row":4}},{"noteOn":{"time":169.335,"column":22,"row":28}},{"noteOn":{"time":169.400,"column":1,"row":19}},{"noteOn":{"time":169.470,"column":14,"row":2}},{"noteOn":{"time":169.535,"column":27,"row":19}},{"noteOn":{"time":169.600,"column":5,"row":27}},{"noteOn":{"time":169.670,"column":5,"row":3}},{"noteOn":{"time":169.735,"column":26,"row":12}},{"noteOn":{"time":169.800,"column":10,"row":26}},{"noteOn":{"time":169.870,"column":4,"row":4}},{"noteOn":{"time":169.935,"column":25,"row":13}},{"noteOn":{"time":170.000,"column":7,"row":25}},{"noteOn":{"time":170.070,"column":11,"row":5}},{"noteOn":{"time":170.135,"column":24,"row":22}},{"noteOn":{"time":170.200,"column":5,"row":15}},{"noteOn":{"time":170.270,"column":23,"row":9}},{"noteOn":{"time":170.335,"column":7,"row":23}},{"noteOn":{"time":170.400,"column":19,"row":7}},{"noteOn":{"time":170.470,"column":10,"row":22}},{"noteOn":{"time":170.535,"column":20,"row":8}},{"noteOn":{"time":170.600,"column":8,"row":18}},{"noteOn":{"time":170.670,"column":20,"row":18}},{"noteOn":{"time":170.735,"column":16,"row":10}},{"noteOn":{"time":170.800,"column":11,"row":11}},{"noteOn":{"time":170.870,"column":14,"row":12}},{"noteOn":{"time":170.935,"column":14,"row":14}},{"noteOn":{"time":171.000,"column":27,"row":0}},{"noteOn":{"time":171.070,"column":29,"row":28}},{"noteOn":{"time":171.135,"column":0,"row":29}},{"noteOn":{"time":171.200,"column":2,"row":1}},{"noteOn":{"time":171.270,"column":28,"row":5}},{"noteOn":{"time":171.335,"column":21,"row":28}},{"noteOn":{"time":171.400,"column":1,"row":18}},{"noteOn":{"time":171.470,"column":15,"row":2}},{"noteOn":{"time":171.535,"column":27,"row":20}},{"noteOn":{"time":171.600,"column":4,"row":27}},{"noteOn":{"time":171.670,"column":6,"row":3}},{"noteOn":{"time":171.735,"column":26,"row":13}},{"noteOn":{"time":171.800,"column":9,"row":26}},{"noteOn":{"time":171.870,"column":5,"row":4}},{"noteOn":{"time":171.935,"column":25,"row":14}},{"noteOn":{"time":172.000,"column":6,"row":25}},{"noteOn":{"time":172.070,"column":12,"row":5}},{"noteOn":{"time":172.135,"column":24,"row":23}},{"noteOn":{"time":172.200,"column":5,"row":14}},{"noteOn":{"time":172.270,"column":23,"row":10}},{"noteOn":{"time":172.335,"column":6,"row":23}},{"noteOn":{"time":172.400,"column":20,"row":7}},{"noteOn":{"time":172.470,"column":9,"row":22}},{"noteOn":{"time":172.535,"column":21,"row":8}},{"noteOn":{"time":172.600,"column":8,"row":17}},{"noteOn":{"time":172.670,"column":20,"row":19}},{"noteOn":{"time":172.735,"column":17,"row":10}},{"noteOn":{"time":172.800,"column":12,"row":11}},{"noteOn":{"time":172.870,"column":15,"row":12}},{"noteOn":{"time":172.935,"column":15,"row":14}},{"noteOn":{"time":173.000,"column":28,"row":0}},{"noteOn":{"time":173.070,"column":29,"row":29}},{"noteOn":{"time":173.135,"column":0,"row":28}},{"noteOn":{"time":173.200,"column":3,"row":1}},{"noteOn":{"time":173.270,"column":28,"row":6}},{"noteOn":{"time":173.335,"column":20,"row":28}},{"noteOn":{"time":173.400,"column":1,"row":17}},{"noteOn":{"time":173.470,"column":16,"row":2}},{"noteOn":{"time":173.535,"column":27,"row":21}},{"noteOn":{"time":173.600,"column":3,"row":27}},{"noteOn":{"time":173.670,"column":7,"row":3}},{"noteOn":{"time":173.735,"column":26,"row":14}},{"noteOn":{"time":173.800,"column":8,"row":26}},{"noteOn":{"time":173.870,"column":6,"row":4}},{"noteOn":{"time":173.935,"column":25,"row":15}},{"noteOn":{"time":174.000,"column":5,"row":25}},{"noteOn":{"time":174.070,"column":13,"row":5}},{"noteOn":{"time":174.135,"column":24,"row":24}},{"noteOn":{"time":174.200,"column":5,"row":13}},{"noteOn":{"time":174.270,"column":23,"row":11}},{"noteOn":{"time":174.335,"column":6,"row":22}},{"noteOn":{"time":174.400,"column":21,"row":7}},{"noteOn":{"time":174.470,"column":8,"row":22}},{"noteOn":{"time":174.535,"column":21,"row":9}},{"noteOn":{"time":174.600,"column":8,"row":16}},{"noteOn":{"time":174.670,"column":20,"row":20}},{"noteOn":{"time":174.735,"column":18,"row":10}},{"noteOn":{"time":174.800,"column":13,"row":11}},{"noteOn":{"time":174.870,"column":16,"row":12}},{"noteOn":{"time":174.935,"column":15,"row":15}},{"noteOn":{"time":175.000,"column":29,"row":0}},{"noteOn":{"time":175.070,"column":28,"row":29}},{"noteOn":{"time":175.135,"column":0,"row":27}},{"noteOn":{"time":175.200,"column":4,"row":1}},{"noteOn":{"time":175.270,"column":28,"row":7}},{"noteOn":{"time":175.335,"column":19,"row":28}},{"noteOn":{"time":175.400,"column":1,"row":16}},{"noteOn":{"time":175.470,"column":17,"row":2}},{"noteOn":{"time":175.535,"column":27,"row":22}},{"noteOn":{"time":175.600,"column":2,"row":27}},{"noteOn":{"time":175.670,"column":8,"row":3}},{"noteOn":{"time":175.735,"column":26,"row":15}},{"noteOn":{"time":175.800,"column":7,"row":26}},{"noteOn":{"time":175.870,"column":7,"row":4}},{"noteOn":{"time":175.935,"column":25,"row":16}},{"noteOn":{"time":176.000,"column":4,"row":25}},{"noteOn":{"time":176.070,"column":14,"row":5}},{"noteOn":{"time":176.135,"column":23,"row":24}},{"noteOn":{"time":176.200,"column":5,"row":12}},{"noteOn":{"time":176.270,"column":23,"row":12}},{"noteOn":{"time":176.335,"column":6,"row":21}},{"noteOn":{"time":176.400,"column":22,"row":7}},{"noteOn":{"time":176.470,"column":7,"row":22}},{"noteOn":{"time":176.535,"column":21,"row":10}},{"noteOn":{"time":176.600,"column":8,"row":15}},{"noteOn":{"time":176.670,"column":19,"row":20}},{"noteOn":{"time":176.735,"column":19,"row":10}},{"noteOn":{"time":176.800,"column":14,"row":11}},{"noteOn":{"time":176.870,"column":17,"row":12}},{"noteOn":{"time":176.935,"column":14,"row":15}}]}
        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
