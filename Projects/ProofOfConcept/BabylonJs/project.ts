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

    let camera = new BABYLON.FreeCamera('', new BABYLON.Vector3(0, 2, 430), scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.25;
    camera.attachControl(canvas, true);
    camera.setTarget(new BABYLON.Vector3(0, 120, 0));

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
                    groundBubbleSynth_ParticleAnimationY[i].push({ started: false, x: x, z: z })
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
                const animation = groundBubbleSynth_ParticleAnimationY[note.column][note.row]
                animation.started = true
                // console.debug('grid[' + note.column + '][' + note.row + '] = xyz(' + animation.x + ', y, ' + animation.z + ')')
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
        giGroundBubbleSynth_Duration = 80
        giGroundBubbleSynth_GridColumnCount = 30
        giGroundBubbleSynth_GridRowCount = giGroundBubbleSynth_GridColumnCount
        giGroundBubbleSynth_GridCellSize = 30
        giGroundBubbleSynth_StartY = 0
        giGroundBubbleSynth_FullVolumeY = 2
        giGroundBubbleSynth_SpeedY = 10
        giGroundBubbleSynth_MaxAudibleDistance = 100
        giGroundBubbleSynth_MaxReverbOnlyDistance = giGroundBubbleSynth_MaxAudibleDistance * 2
        giGroundBubbleSynth_MaxAudibleHeight = giGroundBubbleSynth_MaxAudibleDistance
        giGroundBubbleSynth_MaxAmpWhenVeryClose = 0.5
        giGroundBubbleSynth_ReferenceDistance = 0.1
        giGroundBubbleSynth_RolloffFactor = 0.1
        giGroundBubbleSynth_PlaybackVolumeAdjustment = 2
        giGroundBubbleSynth_PlaybackReverbAdjustment = 0.1
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
        iCellIndex = 0
        iCellIndexIsSet[] init giGroundBubbleSynth_GridCellCount
        while (iCellIndex < giGroundBubbleSynth_GridCellCount) do
            iRandomIndex = min(floor(random(0, giGroundBubbleSynth_GridCellCount)), giGroundBubbleSynth_GridCellCount)
            iSearchCount = 0
            while (iCellIndexIsSet[iRandomIndex] == 1 && iSearchCount < giGroundBubbleSynth_GridCellCount) do
                iRandomIndex += 1
                if (iRandomIndex >= giGroundBubbleSynth_GridCellCount) then
                    iRandomIndex = 0
                fi
                iSearchCount += 1
                if (iSearchCount >= giGroundBubbleSynth_GridCellCount) then
                fi
            od
            iCellIndexIsSet[iRandomIndex] = 1
            iColumnIndex = floor(iRandomIndex / giGroundBubbleSynth_GridColumnCount)
            iRowIndex = iRandomIndex % giGroundBubbleSynth_GridRowCount
            giGroundBubbleSynth_GridCellLaunchPattern[iCellIndex][0] = iColumnIndex
            giGroundBubbleSynth_GridCellLaunchPattern[iCellIndex][1] = iRowIndex
            iCellIndex += 1
        od
        gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset init 0
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
                fprints(SJsonFile, sprintf(",\\"fullVolumeY\\":%d", giGroundBubbleSynth_FullVolumeY))
                fprints(SJsonFile, sprintf(",\\"speedY\\":%d", giGroundBubbleSynth_SpeedY))
                fprints(SJsonFile, sprintf(",\\"maxDistance\\":%d", giGroundBubbleSynth_MaxAudibleDistance))
                fprints(SJsonFile, sprintf(",\\"maxHeight\\":%d", giGroundBubbleSynth_MaxAudibleHeight))
                fprints(SJsonFile, "}")
                turnoff
            endin
         #end
        instr 6
            if (gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset == 0) then
                gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset = AF_3D_Audio_DistanceAttenuation(
                    giGroundBubbleSynth_MaxAudibleHeight,
                    giGroundBubbleSynth_ReferenceDistance,
                    giGroundBubbleSynth_RolloffFactor)
                printsk("gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset = %f\\n", gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset)
            fi
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
                kIsReverbOnly = 0
                if (kDistance > giGroundBubbleSynth_MaxReverbOnlyDistance) then
                    kgoto end
                elseif (kDistance > giGroundBubbleSynth_MaxAudibleDistance) then
                    kIsReverbOnly = 1
                fi
                kCps = iCps + kY * 10
                kAmp = iAmp
                if (kY < giGroundBubbleSynth_FullVolumeY) then
                    kAmp *= kY / giGroundBubbleSynth_FullVolumeY
                else
                    kAmp *= (giGroundBubbleSynth_MaxAudibleHeight - kY) / giGroundBubbleSynth_MaxAudibleHeight
                fi
                    aOut = tone(
                        oscil(kAmp + jspline(kAmp, 0.08, 0.05), kCps * 0.918) + oscil(kAmp + jspline(kAmp, 0.07, 0.49), kCps * 2.234) + oscil(kAmp + jspline(kAmp, 0.09, 0.50), kCps * 3.83) + oscil(kAmp + jspline(kAmp, 0.10, 0.45), kCps * 4.11) + oscil(kAmp + jspline(kAmp, 0.09, 0.51), kCps * 5.25) + oscil(kAmp + jspline(kAmp, 0.08, 0.50), kCps * 6.093) + oscil(kAmp + jspline(kAmp, 0.08, 0.50), kCps * 7.77) + oscil(kAmp + jspline(kAmp, 0.10, 0.40), kCps * 8.328) + oscil(kAmp + jspline(kAmp, 0.07, 0.55), kCps * 9.129) + oscil(kAmp + jspline(kAmp, 0.08, 0.47), kCps * kCps / 100),
                        iCutoffFrequency)
                    a1 = gaInstrumentSignals[2][0]
                    if (kIsReverbOnly == 0) then
                        a2 = gaInstrumentSignals[2][1]
                        a3 = gaInstrumentSignals[2][2]
                        a4 = gaInstrumentSignals[2][3]
                    fi
                    a5 = gaInstrumentSignals[2][4]
                kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giGroundBubbleSynth_ReferenceDistance, giGroundBubbleSynth_RolloffFactor)
                if (kIsReverbOnly == 0) then
                    kDistanceAmp -= gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset
                fi
                kDistanceAmp = min(kDistanceAmp, giGroundBubbleSynth_MaxAmpWhenVeryClose)
                    kDistanceAmp *= giGroundBubbleSynth_PlaybackVolumeAdjustment
                aOutDistanced = aOut * kDistanceAmp
                AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
                iPlaybackReverbAdjustment init 1
                    iPlaybackReverbAdjustment = giGroundBubbleSynth_PlaybackReverbAdjustment
                a1 += gkAmbisonicChannelGains[0] * aOutDistanced
                if (kIsReverbOnly == 0) then
                    a2 += gkAmbisonicChannelGains[1] * aOutDistanced
                    a3 += gkAmbisonicChannelGains[2] * aOutDistanced
                    a4 += gkAmbisonicChannelGains[3] * aOutDistanced
                fi
                a5 += 0.1 * aOutDistanced * iPlaybackReverbAdjustment
                    gaInstrumentSignals[2][0] = a1
                    if (kIsReverbOnly == 0) then
                        gaInstrumentSignals[2][1] = a2
                        gaInstrumentSignals[2][2] = a3
                        gaInstrumentSignals[2][3] = a4
                    fi
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
        i 8 0.004 1 3 2 0 0.46
        i 8 0.004 1 3 2 1 0.46
        i 8 0.004 1 3 2 2 0.46
        i 8 0.004 1 3 2 3 0.46
        i 8 0.004 1 3 2 4 1.00
        i 8 0.004 1 3 2 5 1.00
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
        i 6.001 2.001 -1 3 26 14
        i 6.002 2.090 -1 3 8 22
        i 6.003 2.179 -1 3 27 23
        i 6.004 2.268 -1 3 3 13
        i 6.005 2.357 -1 3 0 4
        i 6.006 2.446 -1 3 15 3
        i 6.007 2.535 -1 3 18 13
        i 6.008 2.624 -1 3 26 0
        i 6.009 2.712 -1 3 26 27
        i 6.010 2.801 -1 3 16 25
        i 6.011 2.890 -1 3 21 0
        i 6.012 2.979 -1 3 13 19
        i 6.013 3.068 -1 3 21 11
        i 6.014 3.157 -1 3 0 11
        i 6.015 3.246 -1 3 22 22
        i 6.016 3.335 -1 3 22 23
        i 6.017 3.424 -1 3 7 29
        i 6.018 3.512 -1 3 9 2
        i 6.019 3.601 -1 3 0 25
        i 6.020 3.690 -1 3 16 24
        i 6.021 3.779 -1 3 27 24
        i 6.022 3.868 -1 3 12 1
        i 6.023 3.957 -1 3 18 7
        i 6.024 4.046 -1 3 24 1
        i 6.025 4.135 -1 3 13 1
        i 6.026 4.224 -1 3 20 13
        i 6.027 4.312 -1 3 26 6
        i 6.028 4.401 -1 3 3 17
        i 6.029 4.490 -1 3 24 20
        i 6.030 4.579 -1 3 13 11
        i 6.031 4.668 -1 3 28 29
        i 6.032 4.757 -1 3 6 5
        i 6.033 4.846 -1 3 27 16
        i 6.034 4.935 -1 3 22 1
        i 6.035 5.024 -1 3 12 16
        i 6.036 5.112 -1 3 22 3
        i 6.037 5.201 -1 3 3 22
        i 6.038 5.290 -1 3 9 17
        i 6.039 5.379 -1 3 7 18
        i 6.040 5.468 -1 3 26 22
        i 6.041 5.557 -1 3 12 12
        i 6.042 5.646 -1 3 0 2
        i 6.043 5.735 -1 3 3 27
        i 6.044 5.824 -1 3 21 23
        i 6.045 5.912 -1 3 22 29
        i 6.046 6.001 -1 3 19 6
        i 6.047 6.090 -1 3 10 26
        i 6.048 6.179 -1 3 27 25
        i 6.049 6.268 -1 3 14 15
        i 6.050 6.357 -1 3 14 23
        i 6.051 6.446 -1 3 26 28
        i 6.052 6.535 -1 3 20 23
        i 6.053 6.624 -1 3 2 26
        i 6.054 6.712 -1 3 25 4
        i 6.055 6.801 -1 3 17 5
        i 6.056 6.890 -1 3 23 10
        i 6.057 6.979 -1 3 24 2
        i 6.058 7.068 -1 3 28 8
        i 6.059 7.157 -1 3 6 27
        i 6.060 7.246 -1 3 28 15
        i 6.061 7.335 -1 3 19 22
        i 6.062 7.424 -1 3 24 21
        i 6.063 7.512 -1 3 15 25
        i 6.064 7.601 -1 3 11 13
        i 6.065 7.690 -1 3 28 25
        i 6.066 7.779 -1 3 12 2
        i 6.067 7.868 -1 3 15 11
        i 6.068 7.957 -1 3 22 8
        i 6.069 8.046 -1 3 15 26
        i 6.070 8.135 -1 3 29 7
        i 6.071 8.224 -1 3 8 14
        i 6.072 8.312 -1 3 0 12
        i 6.073 8.401 -1 3 25 5
        i 6.074 8.490 -1 3 3 18
        i 6.075 8.579 -1 3 9 29
        i 6.076 8.668 -1 3 8 3
        i 6.077 8.757 -1 3 6 11
        i 6.078 8.846 -1 3 13 5
        i 6.079 8.935 -1 3 11 26
        i 6.080 9.024 -1 3 29 11
        i 6.081 9.112 -1 3 15 24
        i 6.082 9.201 -1 3 22 27
        i 6.083 9.290 -1 3 25 26
        i 6.084 9.379 -1 3 16 6
        i 6.085 9.468 -1 3 3 10
        i 6.086 9.557 -1 3 22 7
        i 6.087 9.646 -1 3 3 8
        i 6.088 9.735 -1 3 3 19
        i 6.089 9.824 -1 3 25 1
        i 6.090 9.912 -1 3 27 17
        i 6.091 10.001 -1 3 9 7
        i 6.092 10.090 -1 3 0 22
        i 6.093 10.179 -1 3 16 11
        i 6.094 10.268 -1 3 21 9
        i 6.095 10.357 -1 3 16 27
        i 6.096 10.446 -1 3 3 25
        i 6.097 10.535 -1 3 10 5
        i 6.098 10.624 -1 3 27 26
        i 6.099 10.712 -1 3 12 17
        i 6.100 10.801 -1 3 3 28
        i 6.101 10.890 -1 3 10 11
        i 6.102 10.979 -1 3 21 12
        i 6.103 11.068 -1 3 2 29
        i 6.104 11.157 -1 3 19 26
        i 6.105 11.246 -1 3 0 3
        i 6.106 11.335 -1 3 1 7
        i 6.107 11.424 -1 3 1 17
        i 6.108 11.512 -1 3 14 14
        i 6.109 11.601 -1 3 29 28
        i 6.110 11.690 -1 3 6 1
        i 6.111 11.779 -1 3 18 4
        i 6.112 11.868 -1 3 9 4
        i 6.113 11.957 -1 3 10 21
        i 6.114 12.046 -1 3 25 18
        i 6.115 12.135 -1 3 24 24
        i 6.116 12.224 -1 3 0 16
        i 6.117 12.312 -1 3 10 23
        i 6.118 12.401 -1 3 17 14
        i 6.119 12.490 -1 3 28 1
        i 6.120 12.579 -1 3 8 29
        i 6.121 12.668 -1 3 7 14
        i 6.122 12.757 -1 3 2 17
        i 6.123 12.846 -1 3 23 28
        i 6.124 12.935 -1 3 26 29
        i 6.125 13.024 -1 3 28 3
        i 6.126 13.112 -1 3 11 11
        i 6.127 13.201 -1 3 11 17
        i 6.128 13.290 -1 3 3 20
        i 6.129 13.379 -1 3 4 12
        i 6.130 13.468 -1 3 19 24
        i 6.131 13.557 -1 3 6 29
        i 6.132 13.646 -1 3 6 25
        i 6.133 13.735 -1 3 21 17
        i 6.134 13.824 -1 3 21 26
        i 6.135 13.912 -1 3 7 8
        i 6.136 14.001 -1 3 25 15
        i 6.137 14.090 -1 3 0 5
        i 6.138 14.179 -1 3 2 27
        i 6.139 14.268 -1 3 12 22
        i 6.140 14.357 -1 3 17 16
        i 6.141 14.446 -1 3 17 12
        i 6.142 14.535 -1 3 5 8
        i 6.143 14.624 -1 3 11 7
        i 6.144 14.712 -1 3 11 3
        i 6.145 14.801 -1 3 21 1
        i 6.146 14.890 -1 3 6 6
        i 6.147 14.979 -1 3 17 15
        i 6.148 15.068 -1 3 11 1
        i 6.149 15.157 -1 3 7 7
        i 6.150 15.246 -1 3 23 12
        i 6.151 15.335 -1 3 27 7
        i 6.152 15.424 -1 3 10 24
        i 6.153 15.512 -1 3 0 24
        i 6.154 15.601 -1 3 3 26
        i 6.155 15.690 -1 3 23 9
        i 6.156 15.779 -1 3 28 23
        i 6.157 15.868 -1 3 23 29
        i 6.158 15.957 -1 3 16 16
        i 6.159 16.046 -1 3 28 18
        i 6.160 16.135 -1 3 3 11
        i 6.161 16.224 -1 3 7 10
        i 6.162 16.312 -1 3 19 7
        i 6.163 16.401 -1 3 28 11
        i 6.164 16.490 -1 3 20 21
        i 6.165 16.579 -1 3 24 6
        i 6.166 16.668 -1 3 5 5
        i 6.167 16.757 -1 3 11 22
        i 6.168 16.846 -1 3 4 25
        i 6.169 16.935 -1 3 6 10
        i 6.170 17.024 -1 3 24 15
        i 6.171 17.112 -1 3 29 6
        i 6.172 17.201 -1 3 18 23
        i 6.173 17.290 -1 3 28 2
        i 6.174 17.379 -1 3 1 23
        i 6.175 17.468 -1 3 21 29
        i 6.176 17.557 -1 3 21 18
        i 6.177 17.646 -1 3 1 18
        i 6.178 17.735 -1 3 29 3
        i 6.179 17.824 -1 3 24 16
        i 6.180 17.912 -1 3 4 22
        i 6.181 18.001 -1 3 5 6
        i 6.182 18.090 -1 3 21 13
        i 6.183 18.179 -1 3 0 28
        i 6.184 18.268 -1 3 27 28
        i 6.185 18.357 -1 3 12 11
        i 6.186 18.446 -1 3 27 27
        i 6.187 18.535 -1 3 21 16
        i 6.188 18.624 -1 3 12 18
        i 6.189 18.712 -1 3 18 12
        i 6.190 18.801 -1 3 12 3
        i 6.191 18.890 -1 3 25 27
        i 6.192 18.979 -1 3 28 7
        i 6.193 19.068 -1 3 7 22
        i 6.194 19.157 -1 3 18 16
        i 6.195 19.246 -1 3 13 6
        i 6.196 19.335 -1 3 15 1
        i 6.197 19.424 -1 3 23 16
        i 6.198 19.512 -1 3 4 10
        i 6.199 19.601 -1 3 10 29
        i 6.200 19.690 -1 3 22 26
        i 6.201 19.779 -1 3 7 15
        i 6.202 19.868 -1 3 28 6
        i 6.203 19.957 -1 3 18 14
        i 6.204 20.046 -1 3 14 16
        i 6.205 20.135 -1 3 16 18
        i 6.206 20.224 -1 3 0 6
        i 6.207 20.312 -1 3 10 12
        i 6.208 20.401 -1 3 29 5
        i 6.209 20.490 -1 3 20 2
        i 6.210 20.579 -1 3 29 23
        i 6.211 20.668 -1 3 3 7
        i 6.212 20.757 -1 3 8 17
        i 6.213 20.846 -1 3 17 18
        i 6.214 20.935 -1 3 21 6
        i 6.215 21.024 -1 3 13 7
        i 6.216 21.112 -1 3 6 15
        i 6.217 21.201 -1 3 27 18
        i 6.218 21.290 -1 3 17 13
        i 6.219 21.379 -1 3 14 11
        i 6.220 21.468 -1 3 9 20
        i 6.221 21.557 -1 3 11 12
        i 6.222 21.646 -1 3 16 26
        i 6.223 21.735 -1 3 10 16
        i 6.224 21.824 -1 3 15 13
        i 6.225 21.912 -1 3 17 10
        i 6.226 22.001 -1 3 1 9
        i 6.227 22.090 -1 3 14 17
        i 6.228 22.179 -1 3 29 8
        i 6.229 22.268 -1 3 25 7
        i 6.230 22.357 -1 3 20 29
        i 6.231 22.446 -1 3 3 24
        i 6.232 22.535 -1 3 11 27
        i 6.233 22.624 -1 3 0 13
        i 6.234 22.712 -1 3 12 6
        i 6.235 22.801 -1 3 19 18
        i 6.236 22.890 -1 3 25 29
        i 6.237 22.979 -1 3 13 8
        i 6.238 23.068 -1 3 18 15
        i 6.239 23.157 -1 3 15 21
        i 6.240 23.246 -1 3 24 29
        i 6.241 23.335 -1 3 17 8
        i 6.242 23.424 -1 3 24 25
        i 6.243 23.512 -1 3 27 19
        i 6.244 23.601 -1 3 29 10
        i 6.245 23.690 -1 3 27 29
        i 6.246 23.779 -1 3 1 10
        i 6.247 23.868 -1 3 12 20
        i 6.248 23.957 -1 3 29 27
        i 6.249 24.046 -1 3 9 24
        i 6.250 24.135 -1 3 11 2
        i 6.251 24.224 -1 3 9 13
        i 6.252 24.312 -1 3 16 3
        i 6.253 24.401 -1 3 18 17
        i 6.254 24.490 -1 3 3 12
        i 6.255 24.579 -1 3 9 0
        i 6.256 24.668 -1 3 24 22
        i 6.257 24.757 -1 3 10 25
        i 6.258 24.846 -1 3 2 4
        i 6.259 24.935 -1 3 22 9
        i 6.260 25.024 -1 3 22 10
        i 6.261 25.112 -1 3 5 14
        i 6.262 25.201 -1 3 25 11
        i 6.263 25.290 -1 3 23 7
        i 6.264 25.379 -1 3 11 14
        i 6.265 25.468 -1 3 20 1
        i 6.266 25.557 -1 3 10 27
        i 6.267 25.646 -1 3 23 20
        i 6.268 25.735 -1 3 9 5
        i 6.269 25.824 -1 3 3 21
        i 6.270 25.912 -1 3 28 21
        i 6.271 26.001 -1 3 6 13
        i 6.272 26.090 -1 3 2 8
        i 6.273 26.179 -1 3 16 28
        i 6.274 26.268 -1 3 21 28
        i 6.275 26.357 -1 3 18 5
        i 6.276 26.446 -1 3 23 19
        i 6.277 26.535 -1 3 20 3
        i 6.278 26.624 -1 3 28 22
        i 6.279 26.712 -1 3 11 23
        i 6.280 26.801 -1 3 19 1
        i 6.281 26.890 -1 3 20 9
        i 6.282 26.979 -1 3 23 21
        i 6.283 27.068 -1 3 26 1
        i 6.284 27.157 -1 3 22 25
        i 6.285 27.246 -1 3 10 10
        i 6.286 27.335 -1 3 17 19
        i 6.287 27.424 -1 3 6 22
        i 6.288 27.512 -1 3 28 4
        i 6.289 27.601 -1 3 15 28
        i 6.290 27.690 -1 3 16 23
        i 6.291 27.779 -1 3 23 0
        i 6.292 27.868 -1 3 23 13
        i 6.293 27.957 -1 3 0 27
        i 6.294 28.046 -1 3 16 10
        i 6.295 28.135 -1 3 16 19
        i 6.296 28.224 -1 3 18 21
        i 6.297 28.312 -1 3 19 2
        i 6.298 28.401 -1 3 4 8
        i 6.299 28.490 -1 3 3 9
        i 6.300 28.579 -1 3 5 0
        i 6.301 28.668 -1 3 18 28
        i 6.302 28.757 -1 3 16 1
        i 6.303 28.846 -1 3 0 7
        i 6.304 28.935 -1 3 16 29
        i 6.305 29.024 -1 3 5 12
        i 6.306 29.112 -1 3 19 27
        i 6.307 29.201 -1 3 12 19
        i 6.308 29.290 -1 3 17 28
        i 6.309 29.379 -1 3 8 12
        i 6.310 29.468 -1 3 19 4
        i 6.311 29.557 -1 3 27 15
        i 6.312 29.646 -1 3 2 1
        i 6.313 29.735 -1 3 8 11
        i 6.314 29.824 -1 3 16 7
        i 6.315 29.912 -1 3 4 28
        i 6.316 30.001 -1 3 15 22
        i 6.317 30.090 -1 3 3 14
        i 6.318 30.179 -1 3 29 12
        i 6.319 30.268 -1 3 8 18
        i 6.320 30.357 -1 3 29 25
        i 6.321 30.446 -1 3 23 8
        i 6.322 30.535 -1 3 2 2
        i 6.323 30.624 -1 3 29 29
        i 6.324 30.712 -1 3 11 15
        i 6.325 30.801 -1 3 18 20
        i 6.326 30.890 -1 3 21 8
        i 6.327 30.979 -1 3 25 8
        i 6.328 31.068 -1 3 17 26
        i 6.329 31.157 -1 3 18 8
        i 6.330 31.246 -1 3 9 6
        i 6.331 31.335 -1 3 2 18
        i 6.332 31.424 -1 3 19 5
        i 6.333 31.512 -1 3 15 23
        i 6.334 31.601 -1 3 9 14
        i 6.335 31.690 -1 3 4 0
        i 6.336 31.779 -1 3 6 18
        i 6.337 31.868 -1 3 22 19
        i 6.338 31.957 -1 3 8 15
        i 6.339 32.046 -1 3 14 27
        i 6.340 32.135 -1 3 18 18
        i 6.341 32.224 -1 3 7 23
        i 6.342 32.312 -1 3 6 23
        i 6.343 32.401 -1 3 20 27
        i 6.344 32.490 -1 3 24 11
        i 6.345 32.579 -1 3 21 7
        i 6.346 32.668 -1 3 15 20
        i 6.347 32.757 -1 3 19 3
        i 6.348 32.846 -1 3 5 10
        i 6.349 32.935 -1 3 29 22
        i 6.350 33.024 -1 3 21 22
        i 6.351 33.112 -1 3 8 19
        i 6.352 33.201 -1 3 6 24
        i 6.353 33.290 -1 3 16 12
        i 6.354 33.379 -1 3 25 25
        i 6.355 33.468 -1 3 23 5
        i 6.356 33.557 -1 3 5 7
        i 6.357 33.646 -1 3 6 8
        i 6.358 33.735 -1 3 6 7
        i 6.359 33.824 -1 3 5 1
        i 6.360 33.912 -1 3 10 19
        i 6.361 34.001 -1 3 16 13
        i 6.362 34.090 -1 3 18 1
        i 6.363 34.179 -1 3 17 27
        i 6.364 34.268 -1 3 22 5
        i 6.365 34.357 -1 3 26 3
        i 6.366 34.446 -1 3 21 19
        i 6.367 34.535 -1 3 13 26
        i 6.368 34.624 -1 3 2 3
        i 6.369 34.712 -1 3 11 4
        i 6.370 34.801 -1 3 28 24
        i 6.371 34.890 -1 3 26 2
        i 6.372 34.979 -1 3 11 16
        i 6.373 35.068 -1 3 3 15
        i 6.374 35.157 -1 3 24 9
        i 6.375 35.246 -1 3 17 9
        i 6.376 35.335 -1 3 28 27
        i 6.377 35.424 -1 3 24 4
        i 6.378 35.512 -1 3 25 6
        i 6.379 35.601 -1 3 2 24
        i 6.380 35.690 -1 3 27 6
        i 6.381 35.779 -1 3 16 14
        i 6.382 35.868 -1 3 21 20
        i 6.383 35.957 -1 3 19 29
        i 6.384 36.046 -1 3 28 0
        i 6.385 36.135 -1 3 1 28
        i 6.386 36.224 -1 3 27 5
        i 6.387 36.312 -1 3 9 10
        i 6.388 36.401 -1 3 3 3
        i 6.389 36.490 -1 3 1 24
        i 6.390 36.579 -1 3 25 28
        i 6.391 36.668 -1 3 5 21
        i 6.392 36.757 -1 3 16 2
        i 6.393 36.846 -1 3 20 5
        i 6.394 36.935 -1 3 29 16
        i 6.395 37.024 -1 3 27 0
        i 6.396 37.112 -1 3 9 15
        i 6.397 37.201 -1 3 7 16
        i 6.398 37.290 -1 3 18 19
        i 6.399 37.379 -1 3 15 5
        i 6.400 37.468 -1 3 5 25
        i 6.401 37.557 -1 3 26 15
        i 6.402 37.646 -1 3 22 24
        i 6.403 37.735 -1 3 13 13
        i 6.404 37.824 -1 3 23 1
        i 6.405 37.912 -1 3 11 8
        i 6.406 38.001 -1 3 13 9
        i 6.407 38.090 -1 3 16 4
        i 6.408 38.179 -1 3 5 26
        i 6.409 38.268 -1 3 20 7
        i 6.410 38.357 -1 3 23 27
        i 6.411 38.446 -1 3 22 11
        i 6.412 38.535 -1 3 21 21
        i 6.413 38.624 -1 3 26 7
        i 6.414 38.712 -1 3 9 16
        i 6.415 38.801 -1 3 15 6
        i 6.416 38.890 -1 3 14 22
        i 6.417 38.979 -1 3 9 18
        i 6.418 39.068 -1 3 26 5
        i 6.419 39.157 -1 3 22 0
        i 6.420 39.246 -1 3 13 20
        i 6.421 39.335 -1 3 13 23
        i 6.422 39.424 -1 3 13 10
        i 6.423 39.512 -1 3 21 14
        i 6.424 39.601 -1 3 10 14
        i 6.425 39.690 -1 3 14 7
        i 6.426 39.779 -1 3 18 22
        i 6.427 39.868 -1 3 19 8
        i 6.428 39.957 -1 3 1 11
        i 6.429 40.046 -1 3 23 3
        i 6.430 40.135 -1 3 9 25
        i 6.431 40.224 -1 3 12 14
        i 6.432 40.312 -1 3 23 4
        i 6.433 40.401 -1 3 27 4
        i 6.434 40.490 -1 3 13 21
        i 6.435 40.579 -1 3 1 19
        i 6.436 40.668 -1 3 28 26
        i 6.437 40.757 -1 3 17 17
        i 6.438 40.846 -1 3 3 23
        i 6.439 40.935 -1 3 21 10
        i 6.440 41.024 -1 3 22 20
        i 6.441 41.112 -1 3 20 22
        i 6.442 41.201 -1 3 27 8
        i 6.443 41.290 -1 3 5 9
        i 6.444 41.379 -1 3 13 22
        i 6.445 41.468 -1 3 17 20
        i 6.446 41.557 -1 3 9 8
        i 6.447 41.646 -1 3 15 27
        i 6.448 41.735 -1 3 10 28
        i 6.449 41.824 -1 3 1 14
        i 6.450 41.912 -1 3 4 1
        i 6.451 42.001 -1 3 1 5
        i 6.452 42.090 -1 3 25 2
        i 6.453 42.179 -1 3 21 5
        i 6.454 42.268 -1 3 20 10
        i 6.455 42.357 -1 3 20 24
        i 6.456 42.446 -1 3 17 21
        i 6.457 42.535 -1 3 21 15
        i 6.458 42.624 -1 3 25 14
        i 6.459 42.712 -1 3 25 19
        i 6.460 42.801 -1 3 12 25
        i 6.461 42.890 -1 3 1 8
        i 6.462 42.979 -1 3 19 0
        i 6.463 43.068 -1 3 29 17
        i 6.464 43.157 -1 3 1 12
        i 6.465 43.246 -1 3 24 23
        i 6.466 43.335 -1 3 15 17
        i 6.467 43.424 -1 3 11 18
        i 6.468 43.512 -1 3 14 12
        i 6.469 43.601 -1 3 8 23
        i 6.470 43.690 -1 3 24 3
        i 6.471 43.779 -1 3 10 15
        i 6.472 43.868 -1 3 14 10
        i 6.473 43.957 -1 3 14 19
        i 6.474 44.046 -1 3 26 11
        i 6.475 44.135 -1 3 11 19
        i 6.476 44.224 -1 3 23 22
        i 6.477 44.312 -1 3 23 24
        i 6.478 44.401 -1 3 28 19
        i 6.479 44.490 -1 3 2 28
        i 6.480 44.579 -1 3 2 14
        i 6.481 44.668 -1 3 23 14
        i 6.482 44.757 -1 3 23 2
        i 6.483 44.846 -1 3 3 29
        i 6.484 44.935 -1 3 5 13
        i 6.485 45.024 -1 3 3 16
        i 6.486 45.112 -1 3 7 12
        i 6.487 45.201 -1 3 5 27
        i 6.488 45.290 -1 3 18 11
        i 6.489 45.379 -1 3 11 21
        i 6.490 45.468 -1 3 7 21
        i 6.491 45.557 -1 3 29 15
        i 6.492 45.646 -1 3 24 0
        i 6.493 45.735 -1 3 5 28
        i 6.494 45.824 -1 3 22 28
        i 6.495 45.912 -1 3 19 12
        i 6.496 46.001 -1 3 10 0
        i 6.497 46.090 -1 3 23 17
        i 6.498 46.179 -1 3 4 2
        i 6.499 46.268 -1 3 0 19
        i 6.500 46.357 -1 3 5 15
        i 6.501 46.446 -1 3 2 9
        i 6.502 46.535 -1 3 11 20
        i 6.503 46.624 -1 3 26 4
        i 6.504 46.712 -1 3 23 6
        i 6.505 46.801 -1 3 29 9
        i 6.506 46.890 -1 3 18 29
        i 6.507 46.979 -1 3 22 2
        i 6.508 47.068 -1 3 6 4
        i 6.509 47.157 -1 3 4 13
        i 6.510 47.246 -1 3 28 28
        i 6.511 47.335 -1 3 6 12
        i 6.512 47.424 -1 3 8 0
        i 6.513 47.512 -1 3 23 26
        i 6.514 47.601 -1 3 16 15
        i 6.515 47.690 -1 3 23 23
        i 6.516 47.779 -1 3 22 21
        i 6.517 47.868 -1 3 0 14
        i 6.518 47.957 -1 3 23 15
        i 6.519 48.046 -1 3 13 27
        i 6.520 48.135 -1 3 11 10
        i 6.521 48.224 -1 3 24 10
        i 6.522 48.312 -1 3 18 6
        i 6.523 48.401 -1 3 25 13
        i 6.524 48.490 -1 3 9 9
        i 6.525 48.579 -1 3 26 16
        i 6.526 48.668 -1 3 12 4
        i 6.527 48.757 -1 3 14 8
        i 6.528 48.846 -1 3 1 13
        i 6.529 48.935 -1 3 21 24
        i 6.530 49.024 -1 3 5 11
        i 6.531 49.112 -1 3 13 24
        i 6.532 49.201 -1 3 7 17
        i 6.533 49.290 -1 3 15 29
        i 6.534 49.379 -1 3 22 6
        i 6.535 49.468 -1 3 24 17
        i 6.536 49.557 -1 3 18 9
        i 6.537 49.646 -1 3 9 11
        i 6.538 49.735 -1 3 8 16
        i 6.539 49.824 -1 3 0 8
        i 6.540 49.912 -1 3 0 29
        i 6.541 50.001 -1 3 24 5
        i 6.542 50.090 -1 3 14 20
        i 6.543 50.179 -1 3 16 0
        i 6.544 50.268 -1 3 18 3
        i 6.545 50.357 -1 3 4 4
        i 6.546 50.446 -1 3 29 0
        i 6.547 50.535 -1 3 20 25
        i 6.548 50.624 -1 3 4 21
        i 6.549 50.712 -1 3 23 11
        i 6.550 50.801 -1 3 26 8
        i 6.551 50.890 -1 3 25 21
        i 6.552 50.979 -1 3 12 7
        i 6.553 51.068 -1 3 15 16
        i 6.554 51.157 -1 3 26 9
        i 6.555 51.246 -1 3 19 21
        i 6.556 51.335 -1 3 28 20
        i 6.557 51.424 -1 3 7 28
        i 6.558 51.512 -1 3 20 26
        i 6.559 51.601 -1 3 5 16
        i 6.560 51.690 -1 3 20 4
        i 6.561 51.779 -1 3 8 1
        i 6.562 51.868 -1 3 6 26
        i 6.563 51.957 -1 3 2 5
        i 6.564 52.046 -1 3 5 17
        i 6.565 52.135 -1 3 7 9
        i 6.566 52.224 -1 3 20 6
        i 6.567 52.312 -1 3 26 12
        i 6.568 52.401 -1 3 17 1
        i 6.569 52.490 -1 3 28 5
        i 6.570 52.579 -1 3 4 24
        i 6.571 52.668 -1 3 10 13
        i 6.572 52.757 -1 3 12 21
        i 6.573 52.846 -1 3 12 23
        i 6.574 52.935 -1 3 4 14
        i 6.575 53.024 -1 3 9 12
        i 6.576 53.112 -1 3 26 10
        i 6.577 53.201 -1 3 18 24
        i 6.578 53.290 -1 3 5 29
        i 6.579 53.379 -1 3 12 13
        i 6.580 53.468 -1 3 9 1
        i 6.581 53.557 -1 3 21 2
        i 6.582 53.646 -1 3 1 20
        i 6.583 53.735 -1 3 26 17
        i 6.584 53.824 -1 3 24 7
        i 6.585 53.912 -1 3 9 28
        i 6.586 54.001 -1 3 6 3
        i 6.587 54.090 -1 3 0 15
        i 6.588 54.179 -1 3 16 17
        i 6.589 54.268 -1 3 0 17
        i 6.590 54.357 -1 3 6 14
        i 6.591 54.446 -1 3 4 3
        i 6.592 54.535 -1 3 23 18
        i 6.593 54.624 -1 3 27 10
        i 6.594 54.712 -1 3 17 22
        i 6.595 54.801 -1 3 4 5
        i 6.596 54.890 -1 3 24 18
        i 6.597 54.979 -1 3 25 16
        i 6.598 55.068 -1 3 28 12
        i 6.599 55.157 -1 3 26 13
        i 6.600 55.246 -1 3 23 25
        i 6.601 55.335 -1 3 16 20
        i 6.602 55.424 -1 3 24 8
        i 6.603 55.512 -1 3 9 19
        i 6.604 55.601 -1 3 10 17
        i 6.605 55.690 -1 3 6 0
        i 6.606 55.779 -1 3 0 9
        i 6.607 55.868 -1 3 15 4
        i 6.608 55.957 -1 3 27 9
        i 6.609 56.046 -1 3 24 26
        i 6.610 56.135 -1 3 4 6
        i 6.611 56.224 -1 3 12 8
        i 6.612 56.312 -1 3 13 4
        i 6.613 56.401 -1 3 6 19
        i 6.614 56.490 -1 3 24 27
        i 6.615 56.579 -1 3 5 23
        i 6.616 56.668 -1 3 7 5
        i 6.617 56.757 -1 3 10 1
        i 6.618 56.846 -1 3 0 10
        i 6.619 56.935 -1 3 27 14
        i 6.620 57.024 -1 3 22 4
        i 6.621 57.112 -1 3 10 4
        i 6.622 57.201 -1 3 0 18
        i 6.623 57.290 -1 3 9 3
        i 6.624 57.379 -1 3 28 13
        i 6.625 57.468 -1 3 25 20
        i 6.626 57.557 -1 3 6 28
        i 6.627 57.646 -1 3 22 12
        i 6.628 57.735 -1 3 9 21
        i 6.629 57.824 -1 3 29 13
        i 6.630 57.912 -1 3 8 20
        i 6.631 58.001 -1 3 24 12
        i 6.632 58.090 -1 3 29 14
        i 6.633 58.179 -1 3 4 7
        i 6.634 58.268 -1 3 26 18
        i 6.635 58.357 -1 3 25 9
        i 6.636 58.446 -1 3 18 25
        i 6.637 58.535 -1 3 25 0
        i 6.638 58.624 -1 3 17 23
        i 6.639 58.712 -1 3 20 0
        i 6.640 58.801 -1 3 19 10
        i 6.641 58.890 -1 3 2 25
        i 6.642 58.979 -1 3 11 24
        i 6.643 59.068 -1 3 0 21
        i 6.644 59.157 -1 3 4 15
        i 6.645 59.246 -1 3 21 25
        i 6.646 59.335 -1 3 18 26
        i 6.647 59.424 -1 3 17 4
        i 6.648 59.512 -1 3 29 18
        i 6.649 59.601 -1 3 26 19
        i 6.650 59.690 -1 3 25 17
        i 6.651 59.779 -1 3 22 13
        i 6.652 59.868 -1 3 29 19
        i 6.653 59.957 -1 3 28 9
        i 6.654 60.046 -1 3 17 24
        i 6.655 60.135 -1 3 10 18
        i 6.656 60.224 -1 3 29 1
        i 6.657 60.312 -1 3 2 6
        i 6.658 60.401 -1 3 25 22
        i 6.659 60.490 -1 3 29 26
        i 6.660 60.579 -1 3 5 18
        i 6.661 60.668 -1 3 8 13
        i 6.662 60.757 -1 3 11 0
        i 6.663 60.846 -1 3 21 27
        i 6.664 60.935 -1 3 13 14
        i 6.665 61.024 -1 3 26 20
        i 6.666 61.112 -1 3 11 25
        i 6.667 61.201 -1 3 7 20
        i 6.668 61.290 -1 3 26 21
        i 6.669 61.379 -1 3 16 8
        i 6.670 61.468 -1 3 26 23
        i 6.671 61.557 -1 3 0 20
        i 6.672 61.646 -1 3 2 21
        i 6.673 61.735 -1 3 16 5
        i 6.674 61.824 -1 3 6 16
        i 6.675 61.912 -1 3 15 2
        i 6.676 62.001 -1 3 10 2
        i 6.677 62.090 -1 3 17 25
        i 6.678 62.179 -1 3 25 12
        i 6.679 62.268 -1 3 28 16
        i 6.680 62.357 -1 3 26 24
        i 6.681 62.446 -1 3 16 21
        i 6.682 62.535 -1 3 15 19
        i 6.683 62.624 -1 3 8 7
        i 6.684 62.712 -1 3 17 29
        i 6.685 62.801 -1 3 1 0
        i 6.686 62.890 -1 3 26 25
        i 6.687 62.979 -1 3 16 9
        i 6.688 63.068 -1 3 17 11
        i 6.689 63.157 -1 3 9 22
        i 6.690 63.246 -1 3 26 26
        i 6.691 63.335 -1 3 24 19
        i 6.692 63.424 -1 3 6 17
        i 6.693 63.512 -1 3 12 24
        i 6.694 63.601 -1 3 24 13
        i 6.695 63.690 -1 3 27 11
        i 6.696 63.779 -1 3 2 7
        i 6.697 63.868 -1 3 9 23
        i 6.698 63.957 -1 3 13 2
        i 6.699 64.046 -1 3 8 21
        i 6.700 64.135 -1 3 18 0
        i 6.701 64.224 -1 3 1 21
        i 6.702 64.312 -1 3 7 24
        i 6.703 64.401 -1 3 11 5
        i 6.704 64.490 -1 3 9 26
        i 6.705 64.579 -1 3 1 1
        i 6.706 64.668 -1 3 19 9
        i 6.707 64.757 -1 3 29 20
        i 6.708 64.846 -1 3 7 0
        i 6.709 64.935 -1 3 8 2
        i 6.710 65.024 -1 3 25 23
        i 6.711 65.112 -1 3 12 0
        i 6.712 65.201 -1 3 9 27
        i 6.713 65.290 -1 3 8 4
        i 6.714 65.379 -1 3 0 23
        i 6.715 65.468 -1 3 20 8
        i 6.716 65.557 -1 3 20 28
        i 6.717 65.646 -1 3 11 6
        i 6.718 65.735 -1 3 10 3
        i 6.719 65.824 -1 3 24 14
        i 6.720 65.912 -1 3 20 17
        i 6.721 66.001 -1 3 1 25
        i 6.722 66.090 -1 3 10 20
        i 6.723 66.179 -1 3 1 3
        i 6.724 66.268 -1 3 18 2
        i 6.725 66.357 -1 3 2 23
        i 6.726 66.446 -1 3 5 2
        i 6.727 66.535 -1 3 24 28
        i 6.728 66.624 -1 3 10 6
        i 6.729 66.712 -1 3 5 19
        i 6.730 66.801 -1 3 11 9
        i 6.731 66.890 -1 3 1 2
        i 6.732 66.979 -1 3 1 16
        i 6.733 67.068 -1 3 18 27
        i 6.734 67.157 -1 3 19 15
        i 6.735 67.246 -1 3 7 6
        i 6.736 67.335 -1 3 15 12
        i 6.737 67.424 -1 3 6 20
        i 6.738 67.512 -1 3 11 28
        i 6.739 67.601 -1 3 13 25
        i 6.740 67.690 -1 3 11 29
        i 6.741 67.779 -1 3 5 22
        i 6.742 67.868 -1 3 28 10
        i 6.743 67.957 -1 3 4 9
        i 6.744 68.046 -1 3 10 7
        i 6.745 68.135 -1 3 4 26
        i 6.746 68.224 -1 3 14 18
        i 6.747 68.312 -1 3 14 25
        i 6.748 68.401 -1 3 7 13
        i 6.749 68.490 -1 3 6 9
        i 6.750 68.579 -1 3 22 14
        i 6.751 68.668 -1 3 19 23
        i 6.752 68.757 -1 3 7 1
        i 6.753 68.846 -1 3 19 11
        i 6.754 68.935 -1 3 4 11
        i 6.755 69.024 -1 3 12 5
        i 6.756 69.112 -1 3 22 15
        i 6.757 69.201 -1 3 29 21
        i 6.758 69.290 -1 3 0 26
        i 6.759 69.379 -1 3 25 3
        i 6.760 69.468 -1 3 5 3
        i 6.761 69.557 -1 3 16 22
        i 6.762 69.646 -1 3 22 16
        i 6.763 69.735 -1 3 1 4
        i 6.764 69.824 -1 3 12 9
        i 6.765 69.912 -1 3 1 6
        i 6.766 70.001 -1 3 12 10
        i 6.767 70.090 -1 3 22 18
        i 6.768 70.179 -1 3 27 1
        i 6.769 70.268 -1 3 14 29
        i 6.770 70.357 -1 3 25 10
        i 6.771 70.446 -1 3 27 2
        i 6.772 70.535 -1 3 22 17
        i 6.773 70.624 -1 3 25 24
        i 6.774 70.712 -1 3 12 15
        i 6.775 70.801 -1 3 14 24
        i 6.776 70.890 -1 3 12 26
        i 6.777 70.979 -1 3 19 13
        i 6.778 71.068 -1 3 12 27
        i 6.779 71.157 -1 3 20 19
        i 6.780 71.246 -1 3 1 15
        i 6.781 71.335 -1 3 10 8
        i 6.782 71.424 -1 3 12 28
        i 6.783 71.512 -1 3 10 22
        i 6.784 71.601 -1 3 7 3
        i 6.785 71.690 -1 3 1 22
        i 6.786 71.779 -1 3 20 20
        i 6.787 71.868 -1 3 12 29
        i 6.788 71.957 -1 3 15 7
        i 6.789 72.046 -1 3 27 3
        i 6.790 72.135 -1 3 27 12
        i 6.791 72.224 -1 3 21 3
        i 6.792 72.312 -1 3 8 24
        i 6.793 72.401 -1 3 19 14
        i 6.794 72.490 -1 3 7 2
        i 6.795 72.579 -1 3 3 0
        i 6.796 72.668 -1 3 14 21
        i 6.797 72.757 -1 3 15 8
        i 6.798 72.846 -1 3 6 21
        i 6.799 72.935 -1 3 20 11
        i 6.800 73.024 -1 3 27 13
        i 6.801 73.112 -1 3 1 26
        i 6.802 73.201 -1 3 1 27
        i 6.803 73.290 -1 3 1 29
        i 6.804 73.379 -1 3 13 0
        i 6.805 73.468 -1 3 19 16
        i 6.806 73.557 -1 3 13 3
        i 6.807 73.646 -1 3 29 24
        i 6.808 73.735 -1 3 27 20
        i 6.809 73.824 -1 3 13 12
        i 6.810 73.912 -1 3 7 4
        i 6.811 74.001 -1 3 18 10
        i 6.812 74.090 -1 3 19 25
        i 6.813 74.179 -1 3 0 0
        i 6.814 74.268 -1 3 5 4
        i 6.815 74.357 -1 3 21 4
        i 6.816 74.446 -1 3 27 21
        i 6.817 74.535 -1 3 2 0
        i 6.818 74.624 -1 3 7 19
        i 6.819 74.712 -1 3 19 28
        i 6.820 74.801 -1 3 2 10
        i 6.821 74.890 -1 3 8 25
        i 6.822 74.979 -1 3 0 1
        i 6.823 75.068 -1 3 8 5
        i 6.824 75.157 -1 3 27 22
        i 6.825 75.246 -1 3 2 19
        i 6.826 75.335 -1 3 28 14
        i 6.827 75.424 -1 3 19 17
        i 6.828 75.512 -1 3 6 2
        i 6.829 75.601 -1 3 28 17
        i 6.830 75.690 -1 3 13 15
        i 6.831 75.779 -1 3 13 16
        i 6.832 75.868 -1 3 17 0
        i 6.833 75.957 -1 3 29 2
        i 6.834 76.046 -1 3 29 4
        i 6.835 76.135 -1 3 17 2
        i 6.836 76.224 -1 3 2 11
        i 6.837 76.312 -1 3 2 12
        i 6.838 76.401 -1 3 2 13
        i 6.839 76.490 -1 3 7 11
        i 6.840 76.579 -1 3 5 20
        i 6.841 76.668 -1 3 10 9
        i 6.842 76.757 -1 3 2 15
        i 6.843 76.846 -1 3 2 16
        i 6.844 76.935 -1 3 17 3
        i 6.845 77.024 -1 3 2 20
        i 6.846 77.112 -1 3 5 24
        i 6.847 77.201 -1 3 7 25
        i 6.848 77.290 -1 3 4 16
        i 6.849 77.379 -1 3 13 17
        i 6.850 77.468 -1 3 2 22
        i 6.851 77.557 -1 3 15 14
        i 6.852 77.646 -1 3 3 1
        i 6.853 77.735 -1 3 7 26
        i 6.854 77.824 -1 3 3 2
        i 6.855 77.912 -1 3 14 0
        i 6.856 78.001 -1 3 19 19
        i 6.857 78.090 -1 3 20 12
        i 6.858 78.179 -1 3 3 4
        i 6.859 78.268 -1 3 4 17
        i 6.860 78.357 -1 3 3 5
        i 6.861 78.446 -1 3 14 26
        i 6.862 78.535 -1 3 19 20
        i 6.863 78.624 -1 3 3 6
        i 6.864 78.712 -1 3 4 18
        i 6.865 78.801 -1 3 14 28
        i 6.866 78.890 -1 3 4 19
        i 6.867 78.979 -1 3 4 20
        i 6.868 79.068 -1 3 15 0
        i 6.869 79.157 -1 3 4 23
        i 6.870 79.246 -1 3 20 14
        i 6.871 79.335 -1 3 4 27
        i 6.872 79.424 -1 3 4 29
        i 6.873 79.512 -1 3 20 15
        i 6.874 79.601 -1 3 13 18
        i 6.875 79.690 -1 3 7 27
        i 6.876 79.779 -1 3 8 6
        i 6.877 79.868 -1 3 8 8
        i 6.878 79.957 -1 3 8 9
        i 6.879 80.046 -1 3 8 10
        i 6.880 80.135 -1 3 15 9
        i 6.881 80.224 -1 3 8 26
        i 6.882 80.312 -1 3 8 27
        i 6.883 80.401 -1 3 8 28
        i 6.884 80.490 -1 3 13 28
        i 6.885 80.579 -1 3 13 29
        i 6.886 80.668 -1 3 14 1
        i 6.887 80.757 -1 3 14 2
        i 6.888 80.846 -1 3 14 3
        i 6.889 80.935 -1 3 15 10
        i 6.890 81.024 -1 3 14 4
        i 6.891 81.112 -1 3 14 5
        i 6.892 81.201 -1 3 20 16
        i 6.893 81.290 -1 3 14 6
        i 6.894 81.379 -1 3 14 9
        i 6.895 81.468 -1 3 14 13
        i 6.896 81.557 -1 3 15 15
        i 6.897 81.646 -1 3 17 6
        i 6.898 81.735 -1 3 15 18
        i 6.899 81.824 -1 3 17 7
        i 6.900 81.912 -1 3 20 18
        i 5.001 2.853 0.100 1 1098 76
        i 5.002 3.825 0.100 1 1095 79
        i 5.003 4.621 0.100 1 1103 52
        i 5.004 5.243 0.100 1 1103 78
        i 5.005 5.799 0.100 1 1095 71
        i 5.006 6.531 0.100 1 1097 58
        i 5.007 7.439 0.100 1 1097 78
        i 5.008 8.356 0.100 1 1095 72
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
{"6c9f37ab-392f-429b-8217-eac09f295362":[{"instanceName":"","startDistance":60,"delayDistance":100,"noteNumberToHeightScale":7.50,"delayTime":0.50,"duration":0.5,"delayCount":5},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}}],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","fadeInTime":0.05,"fadeOutTime":0.05,"soundDistanceMin":50,"soundDistanceMax":500},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-39.005,-154.000,486.514]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[191.920,-154.000,346.694]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-99.579,-154.000,-314.826]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[304.204,-154.000,215.101]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[17.346,-154.000,108.983]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[149.602,-154.000,44.919]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-87.346,-154.000,-201.261]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-275.253,-154.000,-15.456]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-185.718,-154.000,46.327]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[43.873,266.000,54.782]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-55.327,230.000,-365.918]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[429.944,326.000,209.088]}},{"noteOn":{"time":10.245,"note":103.000,"xyz":[180.612,326.000,-230.645]}},{"noteOn":{"time":10.800,"note":95.000,"xyz":[-66.788,230.000,-46.294]}},{"noteOn":{"time":11.530,"note":97.000,"xyz":[-119.515,254.000,64.845]}},{"noteOn":{"time":12.440,"note":97.000,"xyz":[136.325,254.000,-275.432]}},{"noteOn":{"time":13.355,"note":95.000,"xyz":[414.747,230.000,-2.534]}}],"9037b759-36e4-4600-b2cb-03383ebd65c1":[{"instanceName":"","duration":80,"gridColumnCount":30,"gridRowCount":30,"gridCellSize":30,"fullVolumeY":2,"speedY":10,"maxDistance":100,"maxHeight":100},{"noteOn":{"time":7.000,"column":26,"row":14}},{"noteOn":{"time":7.090,"column":8,"row":22}},{"noteOn":{"time":7.180,"column":27,"row":23}},{"noteOn":{"time":7.270,"column":3,"row":13}},{"noteOn":{"time":7.355,"column":0,"row":4}},{"noteOn":{"time":7.445,"column":15,"row":3}},{"noteOn":{"time":7.535,"column":18,"row":13}},{"noteOn":{"time":7.625,"column":26,"row":0}},{"noteOn":{"time":7.710,"column":26,"row":27}},{"noteOn":{"time":7.800,"column":16,"row":25}},{"noteOn":{"time":7.890,"column":21,"row":0}},{"noteOn":{"time":7.980,"column":13,"row":19}},{"noteOn":{"time":8.070,"column":21,"row":11}},{"noteOn":{"time":8.155,"column":0,"row":11}},{"noteOn":{"time":8.245,"column":22,"row":22}},{"noteOn":{"time":8.335,"column":22,"row":23}},{"noteOn":{"time":8.425,"column":7,"row":29}},{"noteOn":{"time":8.510,"column":9,"row":2}},{"noteOn":{"time":8.600,"column":0,"row":25}},{"noteOn":{"time":8.690,"column":16,"row":24}},{"noteOn":{"time":8.780,"column":27,"row":24}},{"noteOn":{"time":8.870,"column":12,"row":1}},{"noteOn":{"time":8.955,"column":18,"row":7}},{"noteOn":{"time":9.045,"column":24,"row":1}},{"noteOn":{"time":9.135,"column":13,"row":1}},{"noteOn":{"time":9.225,"column":20,"row":13}},{"noteOn":{"time":9.310,"column":26,"row":6}},{"noteOn":{"time":9.400,"column":3,"row":17}},{"noteOn":{"time":9.490,"column":24,"row":20}},{"noteOn":{"time":9.580,"column":13,"row":11}},{"noteOn":{"time":9.670,"column":28,"row":29}},{"noteOn":{"time":9.755,"column":6,"row":5}},{"noteOn":{"time":9.845,"column":27,"row":16}},{"noteOn":{"time":9.935,"column":22,"row":1}},{"noteOn":{"time":10.025,"column":12,"row":16}},{"noteOn":{"time":10.110,"column":22,"row":3}},{"noteOn":{"time":10.200,"column":3,"row":22}},{"noteOn":{"time":10.290,"column":9,"row":17}},{"noteOn":{"time":10.380,"column":7,"row":18}},{"noteOn":{"time":10.470,"column":26,"row":22}},{"noteOn":{"time":10.555,"column":12,"row":12}},{"noteOn":{"time":10.645,"column":0,"row":2}},{"noteOn":{"time":10.735,"column":3,"row":27}},{"noteOn":{"time":10.825,"column":21,"row":23}},{"noteOn":{"time":10.910,"column":22,"row":29}},{"noteOn":{"time":11.000,"column":19,"row":6}},{"noteOn":{"time":11.090,"column":10,"row":26}},{"noteOn":{"time":11.180,"column":27,"row":25}},{"noteOn":{"time":11.270,"column":14,"row":15}},{"noteOn":{"time":11.355,"column":14,"row":23}},{"noteOn":{"time":11.445,"column":26,"row":28}},{"noteOn":{"time":11.535,"column":20,"row":23}},{"noteOn":{"time":11.625,"column":2,"row":26}},{"noteOn":{"time":11.710,"column":25,"row":4}},{"noteOn":{"time":11.800,"column":17,"row":5}},{"noteOn":{"time":11.890,"column":23,"row":10}},{"noteOn":{"time":11.980,"column":24,"row":2}},{"noteOn":{"time":12.070,"column":28,"row":8}},{"noteOn":{"time":12.155,"column":6,"row":27}},{"noteOn":{"time":12.245,"column":28,"row":15}},{"noteOn":{"time":12.335,"column":19,"row":22}},{"noteOn":{"time":12.425,"column":24,"row":21}},{"noteOn":{"time":12.510,"column":15,"row":25}},{"noteOn":{"time":12.600,"column":11,"row":13}},{"noteOn":{"time":12.690,"column":28,"row":25}},{"noteOn":{"time":12.780,"column":12,"row":2}},{"noteOn":{"time":12.870,"column":15,"row":11}},{"noteOn":{"time":12.955,"column":22,"row":8}},{"noteOn":{"time":13.045,"column":15,"row":26}},{"noteOn":{"time":13.135,"column":29,"row":7}},{"noteOn":{"time":13.225,"column":8,"row":14}},{"noteOn":{"time":13.310,"column":0,"row":12}},{"noteOn":{"time":13.400,"column":25,"row":5}},{"noteOn":{"time":13.490,"column":3,"row":18}},{"noteOn":{"time":13.580,"column":9,"row":29}},{"noteOn":{"time":13.670,"column":8,"row":3}},{"noteOn":{"time":13.755,"column":6,"row":11}},{"noteOn":{"time":13.845,"column":13,"row":5}},{"noteOn":{"time":13.935,"column":11,"row":26}},{"noteOn":{"time":14.025,"column":29,"row":11}},{"noteOn":{"time":14.110,"column":15,"row":24}},{"noteOn":{"time":14.200,"column":22,"row":27}},{"noteOn":{"time":14.290,"column":25,"row":26}},{"noteOn":{"time":14.380,"column":16,"row":6}},{"noteOn":{"time":14.470,"column":3,"row":10}},{"noteOn":{"time":14.555,"column":22,"row":7}},{"noteOn":{"time":14.645,"column":3,"row":8}},{"noteOn":{"time":14.735,"column":3,"row":19}},{"noteOn":{"time":14.825,"column":25,"row":1}},{"noteOn":{"time":14.910,"column":27,"row":17}},{"noteOn":{"time":15.000,"column":9,"row":7}},{"noteOn":{"time":15.090,"column":0,"row":22}},{"noteOn":{"time":15.180,"column":16,"row":11}},{"noteOn":{"time":15.270,"column":21,"row":9}},{"noteOn":{"time":15.355,"column":16,"row":27}},{"noteOn":{"time":15.445,"column":3,"row":25}},{"noteOn":{"time":15.535,"column":10,"row":5}},{"noteOn":{"time":15.625,"column":27,"row":26}},{"noteOn":{"time":15.710,"column":12,"row":17}},{"noteOn":{"time":15.800,"column":3,"row":28}},{"noteOn":{"time":15.890,"column":10,"row":11}},{"noteOn":{"time":15.980,"column":21,"row":12}},{"noteOn":{"time":16.070,"column":2,"row":29}},{"noteOn":{"time":16.155,"column":19,"row":26}},{"noteOn":{"time":16.245,"column":0,"row":3}},{"noteOn":{"time":16.335,"column":1,"row":7}},{"noteOn":{"time":16.425,"column":1,"row":17}},{"noteOn":{"time":16.510,"column":14,"row":14}},{"noteOn":{"time":16.600,"column":29,"row":28}},{"noteOn":{"time":16.690,"column":6,"row":1}},{"noteOn":{"time":16.780,"column":18,"row":4}},{"noteOn":{"time":16.870,"column":9,"row":4}},{"noteOn":{"time":16.955,"column":10,"row":21}},{"noteOn":{"time":17.045,"column":25,"row":18}},{"noteOn":{"time":17.135,"column":24,"row":24}},{"noteOn":{"time":17.225,"column":0,"row":16}},{"noteOn":{"time":17.310,"column":10,"row":23}},{"noteOn":{"time":17.400,"column":17,"row":14}},{"noteOn":{"time":17.490,"column":28,"row":1}},{"noteOn":{"time":17.580,"column":8,"row":29}},{"noteOn":{"time":17.670,"column":7,"row":14}},{"noteOn":{"time":17.755,"column":2,"row":17}},{"noteOn":{"time":17.845,"column":23,"row":28}},{"noteOn":{"time":17.935,"column":26,"row":29}},{"noteOn":{"time":18.025,"column":28,"row":3}},{"noteOn":{"time":18.110,"column":11,"row":11}},{"noteOn":{"time":18.200,"column":11,"row":17}},{"noteOn":{"time":18.290,"column":3,"row":20}},{"noteOn":{"time":18.380,"column":4,"row":12}},{"noteOn":{"time":18.470,"column":19,"row":24}},{"noteOn":{"time":18.555,"column":6,"row":29}},{"noteOn":{"time":18.645,"column":6,"row":25}},{"noteOn":{"time":18.735,"column":21,"row":17}},{"noteOn":{"time":18.825,"column":21,"row":26}},{"noteOn":{"time":18.910,"column":7,"row":8}},{"noteOn":{"time":19.000,"column":25,"row":15}},{"noteOn":{"time":19.090,"column":0,"row":5}},{"noteOn":{"time":19.180,"column":2,"row":27}},{"noteOn":{"time":19.270,"column":12,"row":22}},{"noteOn":{"time":19.355,"column":17,"row":16}},{"noteOn":{"time":19.445,"column":17,"row":12}},{"noteOn":{"time":19.535,"column":5,"row":8}},{"noteOn":{"time":19.625,"column":11,"row":7}},{"noteOn":{"time":19.710,"column":11,"row":3}},{"noteOn":{"time":19.800,"column":21,"row":1}},{"noteOn":{"time":19.890,"column":6,"row":6}},{"noteOn":{"time":19.980,"column":17,"row":15}},{"noteOn":{"time":20.070,"column":11,"row":1}},{"noteOn":{"time":20.155,"column":7,"row":7}},{"noteOn":{"time":20.245,"column":23,"row":12}},{"noteOn":{"time":20.335,"column":27,"row":7}},{"noteOn":{"time":20.425,"column":10,"row":24}},{"noteOn":{"time":20.510,"column":0,"row":24}},{"noteOn":{"time":20.600,"column":3,"row":26}},{"noteOn":{"time":20.690,"column":23,"row":9}},{"noteOn":{"time":20.780,"column":28,"row":23}},{"noteOn":{"time":20.870,"column":23,"row":29}},{"noteOn":{"time":20.955,"column":16,"row":16}},{"noteOn":{"time":21.045,"column":28,"row":18}},{"noteOn":{"time":21.135,"column":3,"row":11}},{"noteOn":{"time":21.225,"column":7,"row":10}},{"noteOn":{"time":21.310,"column":19,"row":7}},{"noteOn":{"time":21.400,"column":28,"row":11}},{"noteOn":{"time":21.490,"column":20,"row":21}},{"noteOn":{"time":21.580,"column":24,"row":6}},{"noteOn":{"time":21.670,"column":5,"row":5}},{"noteOn":{"time":21.755,"column":11,"row":22}},{"noteOn":{"time":21.845,"column":4,"row":25}},{"noteOn":{"time":21.935,"column":6,"row":10}},{"noteOn":{"time":22.025,"column":24,"row":15}},{"noteOn":{"time":22.110,"column":29,"row":6}},{"noteOn":{"time":22.200,"column":18,"row":23}},{"noteOn":{"time":22.290,"column":28,"row":2}},{"noteOn":{"time":22.380,"column":1,"row":23}},{"noteOn":{"time":22.470,"column":21,"row":29}},{"noteOn":{"time":22.555,"column":21,"row":18}},{"noteOn":{"time":22.645,"column":1,"row":18}},{"noteOn":{"time":22.735,"column":29,"row":3}},{"noteOn":{"time":22.825,"column":24,"row":16}},{"noteOn":{"time":22.910,"column":4,"row":22}},{"noteOn":{"time":23.000,"column":5,"row":6}},{"noteOn":{"time":23.090,"column":21,"row":13}},{"noteOn":{"time":23.180,"column":0,"row":28}},{"noteOn":{"time":23.270,"column":27,"row":28}},{"noteOn":{"time":23.355,"column":12,"row":11}},{"noteOn":{"time":23.445,"column":27,"row":27}},{"noteOn":{"time":23.535,"column":21,"row":16}},{"noteOn":{"time":23.625,"column":12,"row":18}},{"noteOn":{"time":23.710,"column":18,"row":12}},{"noteOn":{"time":23.800,"column":12,"row":3}},{"noteOn":{"time":23.890,"column":25,"row":27}},{"noteOn":{"time":23.980,"column":28,"row":7}},{"noteOn":{"time":24.070,"column":7,"row":22}},{"noteOn":{"time":24.155,"column":18,"row":16}},{"noteOn":{"time":24.245,"column":13,"row":6}},{"noteOn":{"time":24.335,"column":15,"row":1}},{"noteOn":{"time":24.425,"column":23,"row":16}},{"noteOn":{"time":24.510,"column":4,"row":10}},{"noteOn":{"time":24.600,"column":10,"row":29}},{"noteOn":{"time":24.690,"column":22,"row":26}},{"noteOn":{"time":24.780,"column":7,"row":15}},{"noteOn":{"time":24.870,"column":28,"row":6}},{"noteOn":{"time":24.955,"column":18,"row":14}},{"noteOn":{"time":25.045,"column":14,"row":16}},{"noteOn":{"time":25.135,"column":16,"row":18}},{"noteOn":{"time":25.225,"column":0,"row":6}},{"noteOn":{"time":25.310,"column":10,"row":12}},{"noteOn":{"time":25.400,"column":29,"row":5}},{"noteOn":{"time":25.490,"column":20,"row":2}},{"noteOn":{"time":25.580,"column":29,"row":23}},{"noteOn":{"time":25.670,"column":3,"row":7}},{"noteOn":{"time":25.755,"column":8,"row":17}},{"noteOn":{"time":25.845,"column":17,"row":18}},{"noteOn":{"time":25.935,"column":21,"row":6}},{"noteOn":{"time":26.025,"column":13,"row":7}},{"noteOn":{"time":26.110,"column":6,"row":15}},{"noteOn":{"time":26.200,"column":27,"row":18}},{"noteOn":{"time":26.290,"column":17,"row":13}},{"noteOn":{"time":26.380,"column":14,"row":11}},{"noteOn":{"time":26.470,"column":9,"row":20}},{"noteOn":{"time":26.555,"column":11,"row":12}},{"noteOn":{"time":26.645,"column":16,"row":26}},{"noteOn":{"time":26.735,"column":10,"row":16}},{"noteOn":{"time":26.825,"column":15,"row":13}},{"noteOn":{"time":26.910,"column":17,"row":10}},{"noteOn":{"time":27.000,"column":1,"row":9}},{"noteOn":{"time":27.090,"column":14,"row":17}},{"noteOn":{"time":27.180,"column":29,"row":8}},{"noteOn":{"time":27.270,"column":25,"row":7}},{"noteOn":{"time":27.355,"column":20,"row":29}},{"noteOn":{"time":27.445,"column":3,"row":24}},{"noteOn":{"time":27.535,"column":11,"row":27}},{"noteOn":{"time":27.625,"column":0,"row":13}},{"noteOn":{"time":27.710,"column":12,"row":6}},{"noteOn":{"time":27.800,"column":19,"row":18}},{"noteOn":{"time":27.890,"column":25,"row":29}},{"noteOn":{"time":27.980,"column":13,"row":8}},{"noteOn":{"time":28.070,"column":18,"row":15}},{"noteOn":{"time":28.155,"column":15,"row":21}},{"noteOn":{"time":28.245,"column":24,"row":29}},{"noteOn":{"time":28.335,"column":17,"row":8}},{"noteOn":{"time":28.425,"column":24,"row":25}},{"noteOn":{"time":28.510,"column":27,"row":19}},{"noteOn":{"time":28.600,"column":29,"row":10}},{"noteOn":{"time":28.690,"column":27,"row":29}},{"noteOn":{"time":28.780,"column":1,"row":10}},{"noteOn":{"time":28.870,"column":12,"row":20}},{"noteOn":{"time":28.955,"column":29,"row":27}},{"noteOn":{"time":29.045,"column":9,"row":24}},{"noteOn":{"time":29.135,"column":11,"row":2}},{"noteOn":{"time":29.225,"column":9,"row":13}},{"noteOn":{"time":29.310,"column":16,"row":3}},{"noteOn":{"time":29.400,"column":18,"row":17}},{"noteOn":{"time":29.490,"column":3,"row":12}},{"noteOn":{"time":29.580,"column":9,"row":0}},{"noteOn":{"time":29.670,"column":24,"row":22}},{"noteOn":{"time":29.755,"column":10,"row":25}},{"noteOn":{"time":29.845,"column":2,"row":4}},{"noteOn":{"time":29.935,"column":22,"row":9}},{"noteOn":{"time":30.025,"column":22,"row":10}},{"noteOn":{"time":30.110,"column":5,"row":14}},{"noteOn":{"time":30.200,"column":25,"row":11}},{"noteOn":{"time":30.290,"column":23,"row":7}},{"noteOn":{"time":30.380,"column":11,"row":14}},{"noteOn":{"time":30.470,"column":20,"row":1}},{"noteOn":{"time":30.555,"column":10,"row":27}},{"noteOn":{"time":30.645,"column":23,"row":20}},{"noteOn":{"time":30.735,"column":9,"row":5}},{"noteOn":{"time":30.825,"column":3,"row":21}},{"noteOn":{"time":30.910,"column":28,"row":21}},{"noteOn":{"time":31.000,"column":6,"row":13}},{"noteOn":{"time":31.090,"column":2,"row":8}},{"noteOn":{"time":31.180,"column":16,"row":28}},{"noteOn":{"time":31.270,"column":21,"row":28}},{"noteOn":{"time":31.355,"column":18,"row":5}},{"noteOn":{"time":31.445,"column":23,"row":19}},{"noteOn":{"time":31.535,"column":20,"row":3}},{"noteOn":{"time":31.625,"column":28,"row":22}},{"noteOn":{"time":31.710,"column":11,"row":23}},{"noteOn":{"time":31.800,"column":19,"row":1}},{"noteOn":{"time":31.890,"column":20,"row":9}},{"noteOn":{"time":31.980,"column":23,"row":21}},{"noteOn":{"time":32.070,"column":26,"row":1}},{"noteOn":{"time":32.155,"column":22,"row":25}},{"noteOn":{"time":32.245,"column":10,"row":10}},{"noteOn":{"time":32.335,"column":17,"row":19}},{"noteOn":{"time":32.425,"column":6,"row":22}},{"noteOn":{"time":32.510,"column":28,"row":4}},{"noteOn":{"time":32.600,"column":15,"row":28}},{"noteOn":{"time":32.690,"column":16,"row":23}},{"noteOn":{"time":32.780,"column":23,"row":0}},{"noteOn":{"time":32.870,"column":23,"row":13}},{"noteOn":{"time":32.955,"column":0,"row":27}},{"noteOn":{"time":33.045,"column":16,"row":10}},{"noteOn":{"time":33.135,"column":16,"row":19}},{"noteOn":{"time":33.225,"column":18,"row":21}},{"noteOn":{"time":33.310,"column":19,"row":2}},{"noteOn":{"time":33.400,"column":4,"row":8}},{"noteOn":{"time":33.490,"column":3,"row":9}},{"noteOn":{"time":33.580,"column":5,"row":0}},{"noteOn":{"time":33.670,"column":18,"row":28}},{"noteOn":{"time":33.755,"column":16,"row":1}},{"noteOn":{"time":33.845,"column":0,"row":7}},{"noteOn":{"time":33.935,"column":16,"row":29}},{"noteOn":{"time":34.025,"column":5,"row":12}},{"noteOn":{"time":34.110,"column":19,"row":27}},{"noteOn":{"time":34.200,"column":12,"row":19}},{"noteOn":{"time":34.290,"column":17,"row":28}},{"noteOn":{"time":34.380,"column":8,"row":12}},{"noteOn":{"time":34.470,"column":19,"row":4}},{"noteOn":{"time":34.555,"column":27,"row":15}},{"noteOn":{"time":34.645,"column":2,"row":1}},{"noteOn":{"time":34.735,"column":8,"row":11}},{"noteOn":{"time":34.825,"column":16,"row":7}},{"noteOn":{"time":34.910,"column":4,"row":28}},{"noteOn":{"time":35.000,"column":15,"row":22}},{"noteOn":{"time":35.090,"column":3,"row":14}},{"noteOn":{"time":35.180,"column":29,"row":12}},{"noteOn":{"time":35.270,"column":8,"row":18}},{"noteOn":{"time":35.355,"column":29,"row":25}},{"noteOn":{"time":35.445,"column":23,"row":8}},{"noteOn":{"time":35.535,"column":2,"row":2}},{"noteOn":{"time":35.625,"column":29,"row":29}},{"noteOn":{"time":35.710,"column":11,"row":15}},{"noteOn":{"time":35.800,"column":18,"row":20}},{"noteOn":{"time":35.890,"column":21,"row":8}},{"noteOn":{"time":35.980,"column":25,"row":8}},{"noteOn":{"time":36.070,"column":17,"row":26}},{"noteOn":{"time":36.155,"column":18,"row":8}},{"noteOn":{"time":36.245,"column":9,"row":6}},{"noteOn":{"time":36.335,"column":2,"row":18}},{"noteOn":{"time":36.425,"column":19,"row":5}},{"noteOn":{"time":36.510,"column":15,"row":23}},{"noteOn":{"time":36.600,"column":9,"row":14}},{"noteOn":{"time":36.690,"column":4,"row":0}},{"noteOn":{"time":36.780,"column":6,"row":18}},{"noteOn":{"time":36.870,"column":22,"row":19}},{"noteOn":{"time":36.955,"column":8,"row":15}},{"noteOn":{"time":37.045,"column":14,"row":27}},{"noteOn":{"time":37.135,"column":18,"row":18}},{"noteOn":{"time":37.225,"column":7,"row":23}},{"noteOn":{"time":37.310,"column":6,"row":23}},{"noteOn":{"time":37.400,"column":20,"row":27}},{"noteOn":{"time":37.490,"column":24,"row":11}},{"noteOn":{"time":37.580,"column":21,"row":7}},{"noteOn":{"time":37.670,"column":15,"row":20}},{"noteOn":{"time":37.755,"column":19,"row":3}},{"noteOn":{"time":37.845,"column":5,"row":10}},{"noteOn":{"time":37.935,"column":29,"row":22}},{"noteOn":{"time":38.025,"column":21,"row":22}},{"noteOn":{"time":38.110,"column":8,"row":19}},{"noteOn":{"time":38.200,"column":6,"row":24}},{"noteOn":{"time":38.290,"column":16,"row":12}},{"noteOn":{"time":38.380,"column":25,"row":25}},{"noteOn":{"time":38.470,"column":23,"row":5}},{"noteOn":{"time":38.555,"column":5,"row":7}},{"noteOn":{"time":38.645,"column":6,"row":8}},{"noteOn":{"time":38.735,"column":6,"row":7}},{"noteOn":{"time":38.825,"column":5,"row":1}},{"noteOn":{"time":38.910,"column":10,"row":19}},{"noteOn":{"time":39.000,"column":16,"row":13}},{"noteOn":{"time":39.090,"column":18,"row":1}},{"noteOn":{"time":39.180,"column":17,"row":27}},{"noteOn":{"time":39.270,"column":22,"row":5}},{"noteOn":{"time":39.355,"column":26,"row":3}},{"noteOn":{"time":39.445,"column":21,"row":19}},{"noteOn":{"time":39.535,"column":13,"row":26}},{"noteOn":{"time":39.625,"column":2,"row":3}},{"noteOn":{"time":39.710,"column":11,"row":4}},{"noteOn":{"time":39.800,"column":28,"row":24}},{"noteOn":{"time":39.890,"column":26,"row":2}},{"noteOn":{"time":39.980,"column":11,"row":16}},{"noteOn":{"time":40.070,"column":3,"row":15}},{"noteOn":{"time":40.155,"column":24,"row":9}},{"noteOn":{"time":40.245,"column":17,"row":9}},{"noteOn":{"time":40.335,"column":28,"row":27}},{"noteOn":{"time":40.425,"column":24,"row":4}},{"noteOn":{"time":40.510,"column":25,"row":6}},{"noteOn":{"time":40.600,"column":2,"row":24}},{"noteOn":{"time":40.690,"column":27,"row":6}},{"noteOn":{"time":40.780,"column":16,"row":14}},{"noteOn":{"time":40.870,"column":21,"row":20}},{"noteOn":{"time":40.955,"column":19,"row":29}},{"noteOn":{"time":41.045,"column":28,"row":0}},{"noteOn":{"time":41.135,"column":1,"row":28}},{"noteOn":{"time":41.225,"column":27,"row":5}},{"noteOn":{"time":41.310,"column":9,"row":10}},{"noteOn":{"time":41.400,"column":3,"row":3}},{"noteOn":{"time":41.490,"column":1,"row":24}},{"noteOn":{"time":41.580,"column":25,"row":28}},{"noteOn":{"time":41.670,"column":5,"row":21}},{"noteOn":{"time":41.755,"column":16,"row":2}},{"noteOn":{"time":41.845,"column":20,"row":5}},{"noteOn":{"time":41.935,"column":29,"row":16}},{"noteOn":{"time":42.025,"column":27,"row":0}},{"noteOn":{"time":42.110,"column":9,"row":15}},{"noteOn":{"time":42.200,"column":7,"row":16}},{"noteOn":{"time":42.290,"column":18,"row":19}},{"noteOn":{"time":42.380,"column":15,"row":5}},{"noteOn":{"time":42.470,"column":5,"row":25}},{"noteOn":{"time":42.555,"column":26,"row":15}},{"noteOn":{"time":42.645,"column":22,"row":24}},{"noteOn":{"time":42.735,"column":13,"row":13}},{"noteOn":{"time":42.825,"column":23,"row":1}},{"noteOn":{"time":42.910,"column":11,"row":8}},{"noteOn":{"time":43.000,"column":13,"row":9}},{"noteOn":{"time":43.090,"column":16,"row":4}},{"noteOn":{"time":43.180,"column":5,"row":26}},{"noteOn":{"time":43.270,"column":20,"row":7}},{"noteOn":{"time":43.355,"column":23,"row":27}},{"noteOn":{"time":43.445,"column":22,"row":11}},{"noteOn":{"time":43.535,"column":21,"row":21}},{"noteOn":{"time":43.625,"column":26,"row":7}},{"noteOn":{"time":43.710,"column":9,"row":16}},{"noteOn":{"time":43.800,"column":15,"row":6}},{"noteOn":{"time":43.890,"column":14,"row":22}},{"noteOn":{"time":43.980,"column":9,"row":18}},{"noteOn":{"time":44.070,"column":26,"row":5}},{"noteOn":{"time":44.155,"column":22,"row":0}},{"noteOn":{"time":44.245,"column":13,"row":20}},{"noteOn":{"time":44.335,"column":13,"row":23}},{"noteOn":{"time":44.425,"column":13,"row":10}},{"noteOn":{"time":44.510,"column":21,"row":14}},{"noteOn":{"time":44.600,"column":10,"row":14}},{"noteOn":{"time":44.690,"column":14,"row":7}},{"noteOn":{"time":44.780,"column":18,"row":22}},{"noteOn":{"time":44.870,"column":19,"row":8}},{"noteOn":{"time":44.955,"column":1,"row":11}},{"noteOn":{"time":45.045,"column":23,"row":3}},{"noteOn":{"time":45.135,"column":9,"row":25}},{"noteOn":{"time":45.225,"column":12,"row":14}},{"noteOn":{"time":45.310,"column":23,"row":4}},{"noteOn":{"time":45.400,"column":27,"row":4}},{"noteOn":{"time":45.490,"column":13,"row":21}},{"noteOn":{"time":45.580,"column":1,"row":19}},{"noteOn":{"time":45.670,"column":28,"row":26}},{"noteOn":{"time":45.755,"column":17,"row":17}},{"noteOn":{"time":45.845,"column":3,"row":23}},{"noteOn":{"time":45.935,"column":21,"row":10}},{"noteOn":{"time":46.025,"column":22,"row":20}},{"noteOn":{"time":46.110,"column":20,"row":22}},{"noteOn":{"time":46.200,"column":27,"row":8}},{"noteOn":{"time":46.290,"column":5,"row":9}},{"noteOn":{"time":46.380,"column":13,"row":22}},{"noteOn":{"time":46.470,"column":17,"row":20}},{"noteOn":{"time":46.555,"column":9,"row":8}},{"noteOn":{"time":46.645,"column":15,"row":27}},{"noteOn":{"time":46.735,"column":10,"row":28}},{"noteOn":{"time":46.825,"column":1,"row":14}},{"noteOn":{"time":46.910,"column":4,"row":1}},{"noteOn":{"time":47.000,"column":1,"row":5}},{"noteOn":{"time":47.090,"column":25,"row":2}},{"noteOn":{"time":47.180,"column":21,"row":5}},{"noteOn":{"time":47.270,"column":20,"row":10}},{"noteOn":{"time":47.355,"column":20,"row":24}},{"noteOn":{"time":47.445,"column":17,"row":21}},{"noteOn":{"time":47.535,"column":21,"row":15}},{"noteOn":{"time":47.625,"column":25,"row":14}},{"noteOn":{"time":47.710,"column":25,"row":19}},{"noteOn":{"time":47.800,"column":12,"row":25}},{"noteOn":{"time":47.890,"column":1,"row":8}},{"noteOn":{"time":47.980,"column":19,"row":0}},{"noteOn":{"time":48.070,"column":29,"row":17}},{"noteOn":{"time":48.155,"column":1,"row":12}},{"noteOn":{"time":48.245,"column":24,"row":23}},{"noteOn":{"time":48.335,"column":15,"row":17}},{"noteOn":{"time":48.425,"column":11,"row":18}},{"noteOn":{"time":48.510,"column":14,"row":12}},{"noteOn":{"time":48.600,"column":8,"row":23}},{"noteOn":{"time":48.690,"column":24,"row":3}},{"noteOn":{"time":48.780,"column":10,"row":15}},{"noteOn":{"time":48.870,"column":14,"row":10}},{"noteOn":{"time":48.955,"column":14,"row":19}},{"noteOn":{"time":49.045,"column":26,"row":11}},{"noteOn":{"time":49.135,"column":11,"row":19}},{"noteOn":{"time":49.225,"column":23,"row":22}},{"noteOn":{"time":49.310,"column":23,"row":24}},{"noteOn":{"time":49.400,"column":28,"row":19}},{"noteOn":{"time":49.490,"column":2,"row":28}},{"noteOn":{"time":49.580,"column":2,"row":14}},{"noteOn":{"time":49.670,"column":23,"row":14}},{"noteOn":{"time":49.755,"column":23,"row":2}},{"noteOn":{"time":49.845,"column":3,"row":29}},{"noteOn":{"time":49.935,"column":5,"row":13}},{"noteOn":{"time":50.025,"column":3,"row":16}},{"noteOn":{"time":50.110,"column":7,"row":12}},{"noteOn":{"time":50.200,"column":5,"row":27}},{"noteOn":{"time":50.290,"column":18,"row":11}},{"noteOn":{"time":50.380,"column":11,"row":21}},{"noteOn":{"time":50.470,"column":7,"row":21}},{"noteOn":{"time":50.555,"column":29,"row":15}},{"noteOn":{"time":50.645,"column":24,"row":0}},{"noteOn":{"time":50.735,"column":5,"row":28}},{"noteOn":{"time":50.825,"column":22,"row":28}},{"noteOn":{"time":50.910,"column":19,"row":12}},{"noteOn":{"time":51.000,"column":10,"row":0}},{"noteOn":{"time":51.090,"column":23,"row":17}},{"noteOn":{"time":51.180,"column":4,"row":2}},{"noteOn":{"time":51.270,"column":0,"row":19}},{"noteOn":{"time":51.355,"column":5,"row":15}},{"noteOn":{"time":51.445,"column":2,"row":9}},{"noteOn":{"time":51.535,"column":11,"row":20}},{"noteOn":{"time":51.625,"column":26,"row":4}},{"noteOn":{"time":51.710,"column":23,"row":6}},{"noteOn":{"time":51.800,"column":29,"row":9}},{"noteOn":{"time":51.890,"column":18,"row":29}},{"noteOn":{"time":51.980,"column":22,"row":2}},{"noteOn":{"time":52.070,"column":6,"row":4}},{"noteOn":{"time":52.155,"column":4,"row":13}},{"noteOn":{"time":52.245,"column":28,"row":28}},{"noteOn":{"time":52.335,"column":6,"row":12}},{"noteOn":{"time":52.425,"column":8,"row":0}},{"noteOn":{"time":52.510,"column":23,"row":26}},{"noteOn":{"time":52.600,"column":16,"row":15}},{"noteOn":{"time":52.690,"column":23,"row":23}},{"noteOn":{"time":52.780,"column":22,"row":21}},{"noteOn":{"time":52.870,"column":0,"row":14}},{"noteOn":{"time":52.955,"column":23,"row":15}},{"noteOn":{"time":53.045,"column":13,"row":27}},{"noteOn":{"time":53.135,"column":11,"row":10}},{"noteOn":{"time":53.225,"column":24,"row":10}},{"noteOn":{"time":53.310,"column":18,"row":6}},{"noteOn":{"time":53.400,"column":25,"row":13}},{"noteOn":{"time":53.490,"column":9,"row":9}},{"noteOn":{"time":53.580,"column":26,"row":16}},{"noteOn":{"time":53.670,"column":12,"row":4}},{"noteOn":{"time":53.755,"column":14,"row":8}},{"noteOn":{"time":53.845,"column":1,"row":13}},{"noteOn":{"time":53.935,"column":21,"row":24}},{"noteOn":{"time":54.025,"column":5,"row":11}},{"noteOn":{"time":54.110,"column":13,"row":24}},{"noteOn":{"time":54.200,"column":7,"row":17}},{"noteOn":{"time":54.290,"column":15,"row":29}},{"noteOn":{"time":54.380,"column":22,"row":6}},{"noteOn":{"time":54.470,"column":24,"row":17}},{"noteOn":{"time":54.555,"column":18,"row":9}},{"noteOn":{"time":54.645,"column":9,"row":11}},{"noteOn":{"time":54.735,"column":8,"row":16}},{"noteOn":{"time":54.825,"column":0,"row":8}},{"noteOn":{"time":54.910,"column":0,"row":29}},{"noteOn":{"time":55.000,"column":24,"row":5}},{"noteOn":{"time":55.090,"column":14,"row":20}},{"noteOn":{"time":55.180,"column":16,"row":0}},{"noteOn":{"time":55.270,"column":18,"row":3}},{"noteOn":{"time":55.355,"column":4,"row":4}},{"noteOn":{"time":55.445,"column":29,"row":0}},{"noteOn":{"time":55.535,"column":20,"row":25}},{"noteOn":{"time":55.625,"column":4,"row":21}},{"noteOn":{"time":55.710,"column":23,"row":11}},{"noteOn":{"time":55.800,"column":26,"row":8}},{"noteOn":{"time":55.890,"column":25,"row":21}},{"noteOn":{"time":55.980,"column":12,"row":7}},{"noteOn":{"time":56.070,"column":15,"row":16}},{"noteOn":{"time":56.155,"column":26,"row":9}},{"noteOn":{"time":56.245,"column":19,"row":21}},{"noteOn":{"time":56.335,"column":28,"row":20}},{"noteOn":{"time":56.425,"column":7,"row":28}},{"noteOn":{"time":56.510,"column":20,"row":26}},{"noteOn":{"time":56.600,"column":5,"row":16}},{"noteOn":{"time":56.690,"column":20,"row":4}},{"noteOn":{"time":56.780,"column":8,"row":1}},{"noteOn":{"time":56.870,"column":6,"row":26}},{"noteOn":{"time":56.955,"column":2,"row":5}},{"noteOn":{"time":57.045,"column":5,"row":17}},{"noteOn":{"time":57.135,"column":7,"row":9}},{"noteOn":{"time":57.225,"column":20,"row":6}},{"noteOn":{"time":57.310,"column":26,"row":12}},{"noteOn":{"time":57.400,"column":17,"row":1}},{"noteOn":{"time":57.490,"column":28,"row":5}},{"noteOn":{"time":57.580,"column":4,"row":24}},{"noteOn":{"time":57.670,"column":10,"row":13}},{"noteOn":{"time":57.755,"column":12,"row":21}},{"noteOn":{"time":57.845,"column":12,"row":23}},{"noteOn":{"time":57.935,"column":4,"row":14}},{"noteOn":{"time":58.025,"column":9,"row":12}},{"noteOn":{"time":58.110,"column":26,"row":10}},{"noteOn":{"time":58.200,"column":18,"row":24}},{"noteOn":{"time":58.290,"column":5,"row":29}},{"noteOn":{"time":58.380,"column":12,"row":13}},{"noteOn":{"time":58.470,"column":9,"row":1}},{"noteOn":{"time":58.555,"column":21,"row":2}},{"noteOn":{"time":58.645,"column":1,"row":20}},{"noteOn":{"time":58.735,"column":26,"row":17}},{"noteOn":{"time":58.825,"column":24,"row":7}},{"noteOn":{"time":58.910,"column":9,"row":28}},{"noteOn":{"time":59.000,"column":6,"row":3}},{"noteOn":{"time":59.090,"column":0,"row":15}},{"noteOn":{"time":59.180,"column":16,"row":17}},{"noteOn":{"time":59.270,"column":0,"row":17}},{"noteOn":{"time":59.355,"column":6,"row":14}},{"noteOn":{"time":59.445,"column":4,"row":3}},{"noteOn":{"time":59.535,"column":23,"row":18}},{"noteOn":{"time":59.625,"column":27,"row":10}},{"noteOn":{"time":59.710,"column":17,"row":22}},{"noteOn":{"time":59.800,"column":4,"row":5}},{"noteOn":{"time":59.890,"column":24,"row":18}},{"noteOn":{"time":59.980,"column":25,"row":16}},{"noteOn":{"time":60.070,"column":28,"row":12}},{"noteOn":{"time":60.155,"column":26,"row":13}},{"noteOn":{"time":60.245,"column":23,"row":25}},{"noteOn":{"time":60.335,"column":16,"row":20}},{"noteOn":{"time":60.425,"column":24,"row":8}},{"noteOn":{"time":60.510,"column":9,"row":19}},{"noteOn":{"time":60.600,"column":10,"row":17}},{"noteOn":{"time":60.690,"column":6,"row":0}},{"noteOn":{"time":60.780,"column":0,"row":9}},{"noteOn":{"time":60.870,"column":15,"row":4}},{"noteOn":{"time":60.955,"column":27,"row":9}},{"noteOn":{"time":61.045,"column":24,"row":26}},{"noteOn":{"time":61.135,"column":4,"row":6}},{"noteOn":{"time":61.225,"column":12,"row":8}},{"noteOn":{"time":61.310,"column":13,"row":4}},{"noteOn":{"time":61.400,"column":6,"row":19}},{"noteOn":{"time":61.490,"column":24,"row":27}},{"noteOn":{"time":61.580,"column":5,"row":23}},{"noteOn":{"time":61.670,"column":7,"row":5}},{"noteOn":{"time":61.755,"column":10,"row":1}},{"noteOn":{"time":61.845,"column":0,"row":10}},{"noteOn":{"time":61.935,"column":27,"row":14}},{"noteOn":{"time":62.025,"column":22,"row":4}},{"noteOn":{"time":62.110,"column":10,"row":4}},{"noteOn":{"time":62.200,"column":0,"row":18}},{"noteOn":{"time":62.290,"column":9,"row":3}},{"noteOn":{"time":62.380,"column":28,"row":13}},{"noteOn":{"time":62.470,"column":25,"row":20}},{"noteOn":{"time":62.555,"column":6,"row":28}},{"noteOn":{"time":62.645,"column":22,"row":12}},{"noteOn":{"time":62.735,"column":9,"row":21}},{"noteOn":{"time":62.825,"column":29,"row":13}},{"noteOn":{"time":62.910,"column":8,"row":20}},{"noteOn":{"time":63.000,"column":24,"row":12}},{"noteOn":{"time":63.090,"column":29,"row":14}},{"noteOn":{"time":63.180,"column":4,"row":7}},{"noteOn":{"time":63.270,"column":26,"row":18}},{"noteOn":{"time":63.355,"column":25,"row":9}},{"noteOn":{"time":63.445,"column":18,"row":25}},{"noteOn":{"time":63.535,"column":25,"row":0}},{"noteOn":{"time":63.625,"column":17,"row":23}},{"noteOn":{"time":63.710,"column":20,"row":0}},{"noteOn":{"time":63.800,"column":19,"row":10}},{"noteOn":{"time":63.890,"column":2,"row":25}},{"noteOn":{"time":63.980,"column":11,"row":24}},{"noteOn":{"time":64.070,"column":0,"row":21}},{"noteOn":{"time":64.155,"column":4,"row":15}},{"noteOn":{"time":64.245,"column":21,"row":25}},{"noteOn":{"time":64.335,"column":18,"row":26}},{"noteOn":{"time":64.425,"column":17,"row":4}},{"noteOn":{"time":64.510,"column":29,"row":18}},{"noteOn":{"time":64.600,"column":26,"row":19}},{"noteOn":{"time":64.690,"column":25,"row":17}},{"noteOn":{"time":64.780,"column":22,"row":13}},{"noteOn":{"time":64.870,"column":29,"row":19}},{"noteOn":{"time":64.955,"column":28,"row":9}},{"noteOn":{"time":65.045,"column":17,"row":24}},{"noteOn":{"time":65.135,"column":10,"row":18}},{"noteOn":{"time":65.225,"column":29,"row":1}},{"noteOn":{"time":65.310,"column":2,"row":6}},{"noteOn":{"time":65.400,"column":25,"row":22}},{"noteOn":{"time":65.490,"column":29,"row":26}},{"noteOn":{"time":65.580,"column":5,"row":18}},{"noteOn":{"time":65.670,"column":8,"row":13}},{"noteOn":{"time":65.755,"column":11,"row":0}},{"noteOn":{"time":65.845,"column":21,"row":27}},{"noteOn":{"time":65.935,"column":13,"row":14}},{"noteOn":{"time":66.025,"column":26,"row":20}},{"noteOn":{"time":66.110,"column":11,"row":25}},{"noteOn":{"time":66.200,"column":7,"row":20}},{"noteOn":{"time":66.290,"column":26,"row":21}},{"noteOn":{"time":66.380,"column":16,"row":8}},{"noteOn":{"time":66.470,"column":26,"row":23}},{"noteOn":{"time":66.555,"column":0,"row":20}},{"noteOn":{"time":66.645,"column":2,"row":21}},{"noteOn":{"time":66.735,"column":16,"row":5}},{"noteOn":{"time":66.825,"column":6,"row":16}},{"noteOn":{"time":66.910,"column":15,"row":2}},{"noteOn":{"time":67.000,"column":10,"row":2}},{"noteOn":{"time":67.090,"column":17,"row":25}},{"noteOn":{"time":67.180,"column":25,"row":12}},{"noteOn":{"time":67.270,"column":28,"row":16}},{"noteOn":{"time":67.355,"column":26,"row":24}},{"noteOn":{"time":67.445,"column":16,"row":21}},{"noteOn":{"time":67.535,"column":15,"row":19}},{"noteOn":{"time":67.625,"column":8,"row":7}},{"noteOn":{"time":67.710,"column":17,"row":29}},{"noteOn":{"time":67.800,"column":1,"row":0}},{"noteOn":{"time":67.890,"column":26,"row":25}},{"noteOn":{"time":67.980,"column":16,"row":9}},{"noteOn":{"time":68.070,"column":17,"row":11}},{"noteOn":{"time":68.155,"column":9,"row":22}},{"noteOn":{"time":68.245,"column":26,"row":26}},{"noteOn":{"time":68.335,"column":24,"row":19}},{"noteOn":{"time":68.425,"column":6,"row":17}},{"noteOn":{"time":68.510,"column":12,"row":24}},{"noteOn":{"time":68.600,"column":24,"row":13}},{"noteOn":{"time":68.690,"column":27,"row":11}},{"noteOn":{"time":68.780,"column":2,"row":7}},{"noteOn":{"time":68.870,"column":9,"row":23}},{"noteOn":{"time":68.955,"column":13,"row":2}},{"noteOn":{"time":69.045,"column":8,"row":21}},{"noteOn":{"time":69.135,"column":18,"row":0}},{"noteOn":{"time":69.225,"column":1,"row":21}},{"noteOn":{"time":69.310,"column":7,"row":24}},{"noteOn":{"time":69.400,"column":11,"row":5}},{"noteOn":{"time":69.490,"column":9,"row":26}},{"noteOn":{"time":69.580,"column":1,"row":1}},{"noteOn":{"time":69.670,"column":19,"row":9}},{"noteOn":{"time":69.755,"column":29,"row":20}},{"noteOn":{"time":69.845,"column":7,"row":0}},{"noteOn":{"time":69.935,"column":8,"row":2}},{"noteOn":{"time":70.025,"column":25,"row":23}},{"noteOn":{"time":70.110,"column":12,"row":0}},{"noteOn":{"time":70.200,"column":9,"row":27}},{"noteOn":{"time":70.290,"column":8,"row":4}},{"noteOn":{"time":70.380,"column":0,"row":23}},{"noteOn":{"time":70.470,"column":20,"row":8}},{"noteOn":{"time":70.555,"column":20,"row":28}},{"noteOn":{"time":70.645,"column":11,"row":6}},{"noteOn":{"time":70.735,"column":10,"row":3}},{"noteOn":{"time":70.825,"column":24,"row":14}},{"noteOn":{"time":70.910,"column":20,"row":17}},{"noteOn":{"time":71.000,"column":1,"row":25}},{"noteOn":{"time":71.090,"column":10,"row":20}},{"noteOn":{"time":71.180,"column":1,"row":3}},{"noteOn":{"time":71.270,"column":18,"row":2}},{"noteOn":{"time":71.355,"column":2,"row":23}},{"noteOn":{"time":71.445,"column":5,"row":2}},{"noteOn":{"time":71.535,"column":24,"row":28}},{"noteOn":{"time":71.625,"column":10,"row":6}},{"noteOn":{"time":71.710,"column":5,"row":19}},{"noteOn":{"time":71.800,"column":11,"row":9}},{"noteOn":{"time":71.890,"column":1,"row":2}},{"noteOn":{"time":71.980,"column":1,"row":16}},{"noteOn":{"time":72.070,"column":18,"row":27}},{"noteOn":{"time":72.155,"column":19,"row":15}},{"noteOn":{"time":72.245,"column":7,"row":6}},{"noteOn":{"time":72.335,"column":15,"row":12}},{"noteOn":{"time":72.425,"column":6,"row":20}},{"noteOn":{"time":72.510,"column":11,"row":28}},{"noteOn":{"time":72.600,"column":13,"row":25}},{"noteOn":{"time":72.690,"column":11,"row":29}},{"noteOn":{"time":72.780,"column":5,"row":22}},{"noteOn":{"time":72.870,"column":28,"row":10}},{"noteOn":{"time":72.955,"column":4,"row":9}},{"noteOn":{"time":73.045,"column":10,"row":7}},{"noteOn":{"time":73.135,"column":4,"row":26}},{"noteOn":{"time":73.225,"column":14,"row":18}},{"noteOn":{"time":73.310,"column":14,"row":25}},{"noteOn":{"time":73.400,"column":7,"row":13}},{"noteOn":{"time":73.490,"column":6,"row":9}},{"noteOn":{"time":73.580,"column":22,"row":14}},{"noteOn":{"time":73.670,"column":19,"row":23}},{"noteOn":{"time":73.755,"column":7,"row":1}},{"noteOn":{"time":73.845,"column":19,"row":11}},{"noteOn":{"time":73.935,"column":4,"row":11}},{"noteOn":{"time":74.025,"column":12,"row":5}},{"noteOn":{"time":74.110,"column":22,"row":15}},{"noteOn":{"time":74.200,"column":29,"row":21}},{"noteOn":{"time":74.290,"column":0,"row":26}},{"noteOn":{"time":74.380,"column":25,"row":3}},{"noteOn":{"time":74.470,"column":5,"row":3}},{"noteOn":{"time":74.555,"column":16,"row":22}},{"noteOn":{"time":74.645,"column":22,"row":16}},{"noteOn":{"time":74.735,"column":1,"row":4}},{"noteOn":{"time":74.825,"column":12,"row":9}},{"noteOn":{"time":74.910,"column":1,"row":6}},{"noteOn":{"time":75.000,"column":12,"row":10}},{"noteOn":{"time":75.090,"column":22,"row":18}},{"noteOn":{"time":75.180,"column":27,"row":1}},{"noteOn":{"time":75.270,"column":14,"row":29}},{"noteOn":{"time":75.355,"column":25,"row":10}},{"noteOn":{"time":75.445,"column":27,"row":2}},{"noteOn":{"time":75.535,"column":22,"row":17}},{"noteOn":{"time":75.625,"column":25,"row":24}},{"noteOn":{"time":75.710,"column":12,"row":15}},{"noteOn":{"time":75.800,"column":14,"row":24}},{"noteOn":{"time":75.890,"column":12,"row":26}},{"noteOn":{"time":75.980,"column":19,"row":13}},{"noteOn":{"time":76.070,"column":12,"row":27}},{"noteOn":{"time":76.155,"column":20,"row":19}},{"noteOn":{"time":76.245,"column":1,"row":15}},{"noteOn":{"time":76.335,"column":10,"row":8}},{"noteOn":{"time":76.425,"column":12,"row":28}},{"noteOn":{"time":76.510,"column":10,"row":22}},{"noteOn":{"time":76.600,"column":7,"row":3}},{"noteOn":{"time":76.690,"column":1,"row":22}},{"noteOn":{"time":76.780,"column":20,"row":20}},{"noteOn":{"time":76.870,"column":12,"row":29}},{"noteOn":{"time":76.955,"column":15,"row":7}},{"noteOn":{"time":77.045,"column":27,"row":3}},{"noteOn":{"time":77.135,"column":27,"row":12}},{"noteOn":{"time":77.225,"column":21,"row":3}},{"noteOn":{"time":77.310,"column":8,"row":24}},{"noteOn":{"time":77.400,"column":19,"row":14}},{"noteOn":{"time":77.490,"column":7,"row":2}},{"noteOn":{"time":77.580,"column":3,"row":0}},{"noteOn":{"time":77.670,"column":14,"row":21}},{"noteOn":{"time":77.755,"column":15,"row":8}},{"noteOn":{"time":77.845,"column":6,"row":21}},{"noteOn":{"time":77.935,"column":20,"row":11}},{"noteOn":{"time":78.025,"column":27,"row":13}},{"noteOn":{"time":78.110,"column":1,"row":26}},{"noteOn":{"time":78.200,"column":1,"row":27}},{"noteOn":{"time":78.290,"column":1,"row":29}},{"noteOn":{"time":78.380,"column":13,"row":0}},{"noteOn":{"time":78.470,"column":19,"row":16}},{"noteOn":{"time":78.555,"column":13,"row":3}},{"noteOn":{"time":78.645,"column":29,"row":24}},{"noteOn":{"time":78.735,"column":27,"row":20}},{"noteOn":{"time":78.825,"column":13,"row":12}},{"noteOn":{"time":78.910,"column":7,"row":4}},{"noteOn":{"time":79.000,"column":18,"row":10}},{"noteOn":{"time":79.090,"column":19,"row":25}},{"noteOn":{"time":79.180,"column":0,"row":0}},{"noteOn":{"time":79.270,"column":5,"row":4}},{"noteOn":{"time":79.355,"column":21,"row":4}},{"noteOn":{"time":79.445,"column":27,"row":21}},{"noteOn":{"time":79.535,"column":2,"row":0}},{"noteOn":{"time":79.625,"column":7,"row":19}},{"noteOn":{"time":79.710,"column":19,"row":28}},{"noteOn":{"time":79.800,"column":2,"row":10}},{"noteOn":{"time":79.890,"column":8,"row":25}},{"noteOn":{"time":79.980,"column":0,"row":1}},{"noteOn":{"time":80.070,"column":8,"row":5}},{"noteOn":{"time":80.155,"column":27,"row":22}},{"noteOn":{"time":80.245,"column":2,"row":19}},{"noteOn":{"time":80.335,"column":28,"row":14}},{"noteOn":{"time":80.425,"column":19,"row":17}},{"noteOn":{"time":80.510,"column":6,"row":2}},{"noteOn":{"time":80.600,"column":28,"row":17}},{"noteOn":{"time":80.690,"column":13,"row":15}},{"noteOn":{"time":80.780,"column":13,"row":16}},{"noteOn":{"time":80.870,"column":17,"row":0}},{"noteOn":{"time":80.955,"column":29,"row":2}},{"noteOn":{"time":81.045,"column":29,"row":4}},{"noteOn":{"time":81.135,"column":17,"row":2}},{"noteOn":{"time":81.225,"column":2,"row":11}},{"noteOn":{"time":81.310,"column":2,"row":12}},{"noteOn":{"time":81.400,"column":2,"row":13}},{"noteOn":{"time":81.490,"column":7,"row":11}},{"noteOn":{"time":81.580,"column":5,"row":20}},{"noteOn":{"time":81.670,"column":10,"row":9}},{"noteOn":{"time":81.755,"column":2,"row":15}},{"noteOn":{"time":81.845,"column":2,"row":16}},{"noteOn":{"time":81.935,"column":17,"row":3}},{"noteOn":{"time":82.025,"column":2,"row":20}},{"noteOn":{"time":82.110,"column":5,"row":24}},{"noteOn":{"time":82.200,"column":7,"row":25}},{"noteOn":{"time":82.290,"column":4,"row":16}},{"noteOn":{"time":82.380,"column":13,"row":17}},{"noteOn":{"time":82.470,"column":2,"row":22}},{"noteOn":{"time":82.555,"column":15,"row":14}},{"noteOn":{"time":82.645,"column":3,"row":1}},{"noteOn":{"time":82.735,"column":7,"row":26}},{"noteOn":{"time":82.825,"column":3,"row":2}},{"noteOn":{"time":82.910,"column":14,"row":0}},{"noteOn":{"time":83.000,"column":19,"row":19}},{"noteOn":{"time":83.090,"column":20,"row":12}},{"noteOn":{"time":83.180,"column":3,"row":4}},{"noteOn":{"time":83.270,"column":4,"row":17}},{"noteOn":{"time":83.355,"column":3,"row":5}},{"noteOn":{"time":83.445,"column":14,"row":26}},{"noteOn":{"time":83.535,"column":19,"row":20}},{"noteOn":{"time":83.625,"column":3,"row":6}},{"noteOn":{"time":83.710,"column":4,"row":18}},{"noteOn":{"time":83.800,"column":14,"row":28}},{"noteOn":{"time":83.890,"column":4,"row":19}},{"noteOn":{"time":83.980,"column":4,"row":20}},{"noteOn":{"time":84.070,"column":15,"row":0}},{"noteOn":{"time":84.155,"column":4,"row":23}},{"noteOn":{"time":84.245,"column":20,"row":14}},{"noteOn":{"time":84.335,"column":4,"row":27}},{"noteOn":{"time":84.425,"column":4,"row":29}},{"noteOn":{"time":84.510,"column":20,"row":15}},{"noteOn":{"time":84.600,"column":13,"row":18}},{"noteOn":{"time":84.690,"column":7,"row":27}},{"noteOn":{"time":84.780,"column":8,"row":6}},{"noteOn":{"time":84.870,"column":8,"row":8}},{"noteOn":{"time":84.955,"column":8,"row":9}},{"noteOn":{"time":85.045,"column":8,"row":10}},{"noteOn":{"time":85.135,"column":15,"row":9}},{"noteOn":{"time":85.225,"column":8,"row":26}},{"noteOn":{"time":85.310,"column":8,"row":27}},{"noteOn":{"time":85.400,"column":8,"row":28}},{"noteOn":{"time":85.490,"column":13,"row":28}},{"noteOn":{"time":85.580,"column":13,"row":29}},{"noteOn":{"time":85.670,"column":14,"row":1}},{"noteOn":{"time":85.755,"column":14,"row":2}},{"noteOn":{"time":85.845,"column":14,"row":3}},{"noteOn":{"time":85.935,"column":15,"row":10}},{"noteOn":{"time":86.025,"column":14,"row":4}},{"noteOn":{"time":86.110,"column":14,"row":5}},{"noteOn":{"time":86.200,"column":20,"row":16}},{"noteOn":{"time":86.290,"column":14,"row":6}},{"noteOn":{"time":86.380,"column":14,"row":9}},{"noteOn":{"time":86.470,"column":14,"row":13}},{"noteOn":{"time":86.555,"column":15,"row":15}},{"noteOn":{"time":86.645,"column":17,"row":6}},{"noteOn":{"time":86.735,"column":15,"row":18}},{"noteOn":{"time":86.825,"column":17,"row":7}},{"noteOn":{"time":86.910,"column":20,"row":18}}]}        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
