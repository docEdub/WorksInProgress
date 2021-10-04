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

    let camera = new BABYLON.FreeCamera('', new BABYLON.Vector3(-460, 2, -460), scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.25;
    camera.attachControl(canvas, true);
    camera.setTarget(new BABYLON.Vector3(0, 0, 0));

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
            event_i("i", 8, 1, -1)
            event_i("i", 12, 1, -1)
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
        giCcValues_Reverb[][] init 2, giCcCount_Reverb
        gkCcValues_Reverb[][] init 2, giCcCount_Reverb
        gkCcSyncTypes_Reverb[][] init 2, giCcCount_Reverb
        instr Reverb_InitializeCcValues
            iI = 0
            while (iI < giCcCount_Reverb) do
                SType = gSCcInfo_Reverb[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_Reverb[iI][$CC_INFO_VALUE]
                iJ = 0
                while (iJ < 2) do
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
                while (kJ < 2) do
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
        instr 5
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
                        if (0 < gi_instrumentCount) then
                            aIn[kI] = gaInstrumentSignals[0][kJ]
                        else
                            iAuxTrackIndex = 0 - gi_instrumentCount
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
                        iAuxTrackIndex = 0
                        if (iAuxTrackIndex >= gi_instrumentCount) then
                            iAuxTrackIndex -= gi_instrumentCount
                        endif
                        ga_auxSignals[iAuxTrackIndex][kJ] = aOut[kI]
                        kJ += 1
                    kI += 1
                od
            endif
        endin
            instr Preallocate_5
                ii = 0
                while (ii < 10) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", 5, ii))
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
        instr 6
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
            instr Preallocate_6
                ii = 0
                while (ii < giPresetUuidPreallocationCount[1]) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 1063 63", 6, ii, 1))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 6))
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
        giGroundBubbleSynth_PlaybackVolumeAdjustment = 1
        giGroundBubbleSynth_PlaybackReverbAdjustment = 1
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
        iColumnIndex = 0
        while (iColumnIndex < giGroundBubbleSynth_GridColumnCount) do
            iRowIndex = 0
            while (iRowIndex < giGroundBubbleSynth_GridRowCount) do
                giGroundBubbleSynth_GridCellLaunchPattern[iCellIndex][0] = iColumnIndex
                giGroundBubbleSynth_GridCellLaunchPattern[iCellIndex][1] = iRowIndex
                iRowIndex += 1
                iCellIndex += 1
            od
            iColumnIndex += 1
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
        instr 7
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
                kDistanceAmp -= gkGroundBubbleSynth_MaxAudibleHeightVolumeOffset
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
                a5 += 0.01 * aOutDistanced * iPlaybackReverbAdjustment
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
        instr 10
            iOrcInstanceIndex = 1
            iEventType = p4
            if (iEventType == 4) then
                iCcType = p5
                iCcValue = p6
                giCcValues_Reverb[1][iCcType] = iCcValue
                gkCcValues_Reverb[1][iCcType] = iCcValue
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
            instr Preallocate_10
                ii = 0
                while (ii < 10) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", 10, ii))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 10))
        instr 8
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
        instr 9
            k_aux = p4 - gi_auxIndexOffset
            k_track = p5 - gi_instrumentIndexOffset
            k_channel = p6
            k_volume = p7
            ga_auxVolumes[k_aux][k_track][k_channel] = k_volume
            turnoff
        endin
        instr 11
            k_track = p4 - gi_instrumentIndexOffset
            k_channel = p5
            k_volume = p6
            ga_masterVolumes[k_track][k_channel] = k_volume
            turnoff
        endin
        instr 12
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
        i 5.1 0 -1 1 0 0
        i 10.1 0 -1 1 0 0
        i 9 0.004 1 3 0 0 0.60
        i 9 0.004 1 3 0 1 0.60
        i 9 0.004 1 3 0 2 0.60
        i 9 0.004 1 3 0 3 0.60
        i 9 0.004 1 3 0 4 0.12
        i 9 0.004 1 3 0 5 0.12
        i 9 0.004 1 3 1 0 0.06
        i 9 0.004 1 3 1 1 0.06
        i 9 0.004 1 3 1 2 0.06
        i 9 0.004 1 3 1 3 0.06
        i 9 0.004 1 3 1 4 0.02
        i 9 0.004 1 3 1 5 0.02
        i 9 0.004 1 3 2 0 0.02
        i 9 0.004 1 3 2 1 0.02
        i 9 0.004 1 3 2 2 0.02
        i 9 0.004 1 3 2 3 0.02
        i 9 0.004 1 3 2 4 0.05
        i 9 0.004 1 3 2 5 0.05
        i 11 0.004 1 3 0 1.00
        i 11 0.004 1 3 1 1.00
        i 11 0.004 1 3 2 1.00
        i 11 0.004 1 3 3 1.00
        i 11 0.004 1 3 4 1.00
        i 11 0.004 1 3 5 1.00
        i "EndOfInstrumentAllocations" 3 -1
        i "SendStartupMessage" 0 1
        i "SendStartupMessage" 4 -1
        b $SCORE_START_DELAY
        i 10 0.01 1 4 0 1.00
        i 10 0.01 1 4 1 0.98
        i 10 0.01 1 4 5 1.00
        i 7.001 2.001 -1 3 0 0
        i 7.002 2.068 -1 3 0 1
        i 7.003 2.135 -1 3 0 2
        i 7.004 2.201 -1 3 0 3
        i 7.005 2.268 -1 3 0 4
        i 7.006 2.335 -1 3 0 5
        i 7.007 2.401 -1 3 0 6
        i 7.008 2.468 -1 3 0 7
        i 7.009 2.535 -1 3 0 8
        i 7.010 2.601 -1 3 0 9
        i 7.011 2.668 -1 3 0 10
        i 7.012 2.735 -1 3 0 11
        i 7.013 2.801 -1 3 0 12
        i 7.014 2.868 -1 3 0 13
        i 7.015 2.935 -1 3 0 14
        i 7.016 3.001 -1 3 0 15
        i 7.017 3.068 -1 3 0 16
        i 7.018 3.135 -1 3 0 17
        i 7.019 3.201 -1 3 0 18
        i 7.020 3.268 -1 3 0 19
        i 7.021 3.335 -1 3 0 20
        i 7.022 3.401 -1 3 0 21
        i 7.023 3.468 -1 3 0 22
        i 7.024 3.535 -1 3 0 23
        i 7.025 3.601 -1 3 0 24
        i 7.026 3.668 -1 3 0 25
        i 7.027 3.735 -1 3 0 26
        i 7.028 3.801 -1 3 0 27
        i 7.029 3.868 -1 3 0 28
        i 7.030 3.935 -1 3 0 29
        i 7.031 4.001 -1 3 1 0
        i 7.032 4.068 -1 3 1 1
        i 7.033 4.135 -1 3 1 2
        i 7.034 4.201 -1 3 1 3
        i 7.035 4.268 -1 3 1 4
        i 7.036 4.335 -1 3 1 5
        i 7.037 4.401 -1 3 1 6
        i 7.038 4.468 -1 3 1 7
        i 7.039 4.535 -1 3 1 8
        i 7.040 4.601 -1 3 1 9
        i 7.041 4.668 -1 3 1 10
        i 7.042 4.735 -1 3 1 11
        i 7.043 4.801 -1 3 1 12
        i 7.044 4.868 -1 3 1 13
        i 7.045 4.935 -1 3 1 14
        i 7.046 5.001 -1 3 1 15
        i 7.047 5.068 -1 3 1 16
        i 7.048 5.135 -1 3 1 17
        i 7.049 5.201 -1 3 1 18
        i 7.050 5.268 -1 3 1 19
        i 7.051 5.335 -1 3 1 20
        i 7.052 5.401 -1 3 1 21
        i 7.053 5.468 -1 3 1 22
        i 7.054 5.535 -1 3 1 23
        i 7.055 5.601 -1 3 1 24
        i 7.056 5.668 -1 3 1 25
        i 7.057 5.735 -1 3 1 26
        i 7.058 5.801 -1 3 1 27
        i 7.059 5.868 -1 3 1 28
        i 7.060 5.935 -1 3 1 29
        i 7.061 6.001 -1 3 2 0
        i 7.062 6.068 -1 3 2 1
        i 7.063 6.135 -1 3 2 2
        i 7.064 6.201 -1 3 2 3
        i 7.065 6.268 -1 3 2 4
        i 7.066 6.335 -1 3 2 5
        i 7.067 6.401 -1 3 2 6
        i 7.068 6.468 -1 3 2 7
        i 7.069 6.535 -1 3 2 8
        i 7.070 6.601 -1 3 2 9
        i 7.071 6.668 -1 3 2 10
        i 7.072 6.735 -1 3 2 11
        i 7.073 6.801 -1 3 2 12
        i 7.074 6.868 -1 3 2 13
        i 7.075 6.935 -1 3 2 14
        i 7.076 7.001 -1 3 2 15
        i 7.077 7.068 -1 3 2 16
        i 7.078 7.135 -1 3 2 17
        i 7.079 7.201 -1 3 2 18
        i 7.080 7.268 -1 3 2 19
        i 7.081 7.335 -1 3 2 20
        i 7.082 7.401 -1 3 2 21
        i 7.083 7.468 -1 3 2 22
        i 7.084 7.535 -1 3 2 23
        i 7.085 7.601 -1 3 2 24
        i 7.086 7.668 -1 3 2 25
        i 7.087 7.735 -1 3 2 26
        i 7.088 7.801 -1 3 2 27
        i 7.089 7.868 -1 3 2 28
        i 7.090 7.935 -1 3 2 29
        i 7.091 8.001 -1 3 3 0
        i 7.092 8.068 -1 3 3 1
        i 7.093 8.135 -1 3 3 2
        i 7.094 8.201 -1 3 3 3
        i 7.095 8.268 -1 3 3 4
        i 7.096 8.335 -1 3 3 5
        i 7.097 8.401 -1 3 3 6
        i 7.098 8.468 -1 3 3 7
        i 7.099 8.535 -1 3 3 8
        i 7.100 8.601 -1 3 3 9
        i 7.101 8.668 -1 3 3 10
        i 7.102 8.735 -1 3 3 11
        i 7.103 8.801 -1 3 3 12
        i 7.104 8.868 -1 3 3 13
        i 7.105 8.935 -1 3 3 14
        i 7.106 9.001 -1 3 3 15
        i 7.107 9.068 -1 3 3 16
        i 7.108 9.135 -1 3 3 17
        i 7.109 9.201 -1 3 3 18
        i 7.110 9.268 -1 3 3 19
        i 7.111 9.335 -1 3 3 20
        i 7.112 9.401 -1 3 3 21
        i 7.113 9.468 -1 3 3 22
        i 7.114 9.535 -1 3 3 23
        i 7.115 9.601 -1 3 3 24
        i 7.116 9.668 -1 3 3 25
        i 7.117 9.735 -1 3 3 26
        i 7.118 9.801 -1 3 3 27
        i 7.119 9.868 -1 3 3 28
        i 7.120 9.935 -1 3 3 29
        i 7.121 10.001 -1 3 4 0
        i 7.122 10.068 -1 3 4 1
        i 7.123 10.135 -1 3 4 2
        i 7.124 10.201 -1 3 4 3
        i 7.125 10.268 -1 3 4 4
        i 7.126 10.335 -1 3 4 5
        i 7.127 10.401 -1 3 4 6
        i 7.128 10.468 -1 3 4 7
        i 7.129 10.535 -1 3 4 8
        i 7.130 10.601 -1 3 4 9
        i 7.131 10.668 -1 3 4 10
        i 7.132 10.735 -1 3 4 11
        i 7.133 10.801 -1 3 4 12
        i 7.134 10.868 -1 3 4 13
        i 7.135 10.935 -1 3 4 14
        i 7.136 11.001 -1 3 4 15
        i 7.137 11.068 -1 3 4 16
        i 7.138 11.135 -1 3 4 17
        i 7.139 11.201 -1 3 4 18
        i 7.140 11.268 -1 3 4 19
        i 7.141 11.335 -1 3 4 20
        i 7.142 11.401 -1 3 4 21
        i 7.143 11.468 -1 3 4 22
        i 7.144 11.535 -1 3 4 23
        i 7.145 11.601 -1 3 4 24
        i 7.146 11.668 -1 3 4 25
        i 7.147 11.735 -1 3 4 26
        i 7.148 11.801 -1 3 4 27
        i 7.149 11.868 -1 3 4 28
        i 7.150 11.935 -1 3 4 29
        i 7.151 12.001 -1 3 5 0
        i 7.152 12.068 -1 3 5 1
        i 7.153 12.135 -1 3 5 2
        i 7.154 12.201 -1 3 5 3
        i 7.155 12.268 -1 3 5 4
        i 7.156 12.335 -1 3 5 5
        i 7.157 12.401 -1 3 5 6
        i 7.158 12.468 -1 3 5 7
        i 7.159 12.535 -1 3 5 8
        i 7.160 12.601 -1 3 5 9
        i 7.161 12.668 -1 3 5 10
        i 7.162 12.735 -1 3 5 11
        i 7.163 12.801 -1 3 5 12
        i 7.164 12.868 -1 3 5 13
        i 7.165 12.935 -1 3 5 14
        i 7.166 13.001 -1 3 5 15
        i 7.167 13.068 -1 3 5 16
        i 7.168 13.135 -1 3 5 17
        i 7.169 13.201 -1 3 5 18
        i 7.170 13.268 -1 3 5 19
        i 7.171 13.335 -1 3 5 20
        i 7.172 13.401 -1 3 5 21
        i 7.173 13.468 -1 3 5 22
        i 7.174 13.535 -1 3 5 23
        i 7.175 13.601 -1 3 5 24
        i 7.176 13.668 -1 3 5 25
        i 7.177 13.735 -1 3 5 26
        i 7.178 13.801 -1 3 5 27
        i 7.179 13.868 -1 3 5 28
        i 7.180 13.935 -1 3 5 29
        i 7.181 14.001 -1 3 6 0
        i 7.182 14.068 -1 3 6 1
        i 7.183 14.135 -1 3 6 2
        i 7.184 14.201 -1 3 6 3
        i 7.185 14.268 -1 3 6 4
        i 7.186 14.335 -1 3 6 5
        i 7.187 14.401 -1 3 6 6
        i 7.188 14.468 -1 3 6 7
        i 7.189 14.535 -1 3 6 8
        i 7.190 14.601 -1 3 6 9
        i 7.191 14.668 -1 3 6 10
        i 7.192 14.735 -1 3 6 11
        i 7.193 14.801 -1 3 6 12
        i 7.194 14.868 -1 3 6 13
        i 7.195 14.935 -1 3 6 14
        i 7.196 15.001 -1 3 6 15
        i 7.197 15.068 -1 3 6 16
        i 7.198 15.135 -1 3 6 17
        i 7.199 15.201 -1 3 6 18
        i 7.200 15.268 -1 3 6 19
        i 7.201 15.335 -1 3 6 20
        i 7.202 15.401 -1 3 6 21
        i 7.203 15.468 -1 3 6 22
        i 7.204 15.535 -1 3 6 23
        i 7.205 15.601 -1 3 6 24
        i 7.206 15.668 -1 3 6 25
        i 7.207 15.735 -1 3 6 26
        i 7.208 15.801 -1 3 6 27
        i 7.209 15.868 -1 3 6 28
        i 7.210 15.935 -1 3 6 29
        i 7.211 16.001 -1 3 7 0
        i 7.212 16.068 -1 3 7 1
        i 7.213 16.135 -1 3 7 2
        i 7.214 16.201 -1 3 7 3
        i 7.215 16.268 -1 3 7 4
        i 7.216 16.335 -1 3 7 5
        i 7.217 16.401 -1 3 7 6
        i 7.218 16.468 -1 3 7 7
        i 7.219 16.535 -1 3 7 8
        i 7.220 16.601 -1 3 7 9
        i 7.221 16.668 -1 3 7 10
        i 7.222 16.735 -1 3 7 11
        i 7.223 16.801 -1 3 7 12
        i 7.224 16.868 -1 3 7 13
        i 7.225 16.935 -1 3 7 14
        i 7.226 17.001 -1 3 7 15
        i 7.227 17.068 -1 3 7 16
        i 7.228 17.135 -1 3 7 17
        i 7.229 17.201 -1 3 7 18
        i 7.230 17.268 -1 3 7 19
        i 7.231 17.335 -1 3 7 20
        i 7.232 17.401 -1 3 7 21
        i 7.233 17.468 -1 3 7 22
        i 7.234 17.535 -1 3 7 23
        i 7.235 17.601 -1 3 7 24
        i 7.236 17.668 -1 3 7 25
        i 7.237 17.735 -1 3 7 26
        i 7.238 17.801 -1 3 7 27
        i 7.239 17.868 -1 3 7 28
        i 7.240 17.935 -1 3 7 29
        i 7.241 18.001 -1 3 8 0
        i 7.242 18.068 -1 3 8 1
        i 7.243 18.135 -1 3 8 2
        i 7.244 18.201 -1 3 8 3
        i 7.245 18.268 -1 3 8 4
        i 7.246 18.335 -1 3 8 5
        i 7.247 18.401 -1 3 8 6
        i 7.248 18.468 -1 3 8 7
        i 7.249 18.535 -1 3 8 8
        i 7.250 18.601 -1 3 8 9
        i 7.251 18.668 -1 3 8 10
        i 7.252 18.735 -1 3 8 11
        i 7.253 18.801 -1 3 8 12
        i 7.254 18.868 -1 3 8 13
        i 7.255 18.935 -1 3 8 14
        i 7.256 19.001 -1 3 8 15
        i 7.257 19.068 -1 3 8 16
        i 7.258 19.135 -1 3 8 17
        i 7.259 19.201 -1 3 8 18
        i 7.260 19.268 -1 3 8 19
        i 7.261 19.335 -1 3 8 20
        i 7.262 19.401 -1 3 8 21
        i 7.263 19.468 -1 3 8 22
        i 7.264 19.535 -1 3 8 23
        i 7.265 19.601 -1 3 8 24
        i 7.266 19.668 -1 3 8 25
        i 7.267 19.735 -1 3 8 26
        i 7.268 19.801 -1 3 8 27
        i 7.269 19.868 -1 3 8 28
        i 7.270 19.935 -1 3 8 29
        i 7.271 20.001 -1 3 9 0
        i 7.272 20.068 -1 3 9 1
        i 7.273 20.135 -1 3 9 2
        i 7.274 20.201 -1 3 9 3
        i 7.275 20.268 -1 3 9 4
        i 7.276 20.335 -1 3 9 5
        i 7.277 20.401 -1 3 9 6
        i 7.278 20.468 -1 3 9 7
        i 7.279 20.535 -1 3 9 8
        i 7.280 20.601 -1 3 9 9
        i 7.281 20.668 -1 3 9 10
        i 7.282 20.735 -1 3 9 11
        i 7.283 20.801 -1 3 9 12
        i 7.284 20.868 -1 3 9 13
        i 7.285 20.935 -1 3 9 14
        i 7.286 21.001 -1 3 9 15
        i 7.287 21.068 -1 3 9 16
        i 7.288 21.135 -1 3 9 17
        i 7.289 21.201 -1 3 9 18
        i 7.290 21.268 -1 3 9 19
        i 7.291 21.335 -1 3 9 20
        i 7.292 21.401 -1 3 9 21
        i 7.293 21.468 -1 3 9 22
        i 7.294 21.535 -1 3 9 23
        i 7.295 21.601 -1 3 9 24
        i 7.296 21.668 -1 3 9 25
        i 7.297 21.735 -1 3 9 26
        i 7.298 21.801 -1 3 9 27
        i 7.299 21.868 -1 3 9 28
        i 7.300 21.935 -1 3 9 29
        i 7.301 22.001 -1 3 10 0
        i 7.302 22.068 -1 3 10 1
        i 7.303 22.135 -1 3 10 2
        i 7.304 22.201 -1 3 10 3
        i 7.305 22.268 -1 3 10 4
        i 7.306 22.335 -1 3 10 5
        i 7.307 22.401 -1 3 10 6
        i 7.308 22.468 -1 3 10 7
        i 7.309 22.535 -1 3 10 8
        i 7.310 22.601 -1 3 10 9
        i 7.311 22.668 -1 3 10 10
        i 7.312 22.735 -1 3 10 11
        i 7.313 22.801 -1 3 10 12
        i 7.314 22.868 -1 3 10 13
        i 7.315 22.935 -1 3 10 14
        i 7.316 23.001 -1 3 10 15
        i 7.317 23.068 -1 3 10 16
        i 7.318 23.135 -1 3 10 17
        i 7.319 23.201 -1 3 10 18
        i 7.320 23.268 -1 3 10 19
        i 7.321 23.335 -1 3 10 20
        i 7.322 23.401 -1 3 10 21
        i 7.323 23.468 -1 3 10 22
        i 7.324 23.535 -1 3 10 23
        i 7.325 23.601 -1 3 10 24
        i 7.326 23.668 -1 3 10 25
        i 7.327 23.735 -1 3 10 26
        i 7.328 23.801 -1 3 10 27
        i 7.329 23.868 -1 3 10 28
        i 7.330 23.935 -1 3 10 29
        i 7.331 24.001 -1 3 11 0
        i 7.332 24.068 -1 3 11 1
        i 7.333 24.135 -1 3 11 2
        i 7.334 24.201 -1 3 11 3
        i 7.335 24.268 -1 3 11 4
        i 7.336 24.335 -1 3 11 5
        i 7.337 24.401 -1 3 11 6
        i 7.338 24.468 -1 3 11 7
        i 7.339 24.535 -1 3 11 8
        i 7.340 24.601 -1 3 11 9
        i 7.341 24.668 -1 3 11 10
        i 7.342 24.735 -1 3 11 11
        i 7.343 24.801 -1 3 11 12
        i 7.344 24.868 -1 3 11 13
        i 7.345 24.935 -1 3 11 14
        i 7.346 25.001 -1 3 11 15
        i 7.347 25.068 -1 3 11 16
        i 7.348 25.135 -1 3 11 17
        i 7.349 25.201 -1 3 11 18
        i 7.350 25.268 -1 3 11 19
        i 7.351 25.335 -1 3 11 20
        i 7.352 25.401 -1 3 11 21
        i 7.353 25.468 -1 3 11 22
        i 7.354 25.535 -1 3 11 23
        i 7.355 25.601 -1 3 11 24
        i 7.356 25.668 -1 3 11 25
        i 7.357 25.735 -1 3 11 26
        i 7.358 25.801 -1 3 11 27
        i 7.359 25.868 -1 3 11 28
        i 7.360 25.935 -1 3 11 29
        i 7.361 26.001 -1 3 12 0
        i 7.362 26.068 -1 3 12 1
        i 7.363 26.135 -1 3 12 2
        i 7.364 26.201 -1 3 12 3
        i 7.365 26.268 -1 3 12 4
        i 7.366 26.335 -1 3 12 5
        i 7.367 26.401 -1 3 12 6
        i 7.368 26.468 -1 3 12 7
        i 7.369 26.535 -1 3 12 8
        i 7.370 26.601 -1 3 12 9
        i 7.371 26.668 -1 3 12 10
        i 7.372 26.735 -1 3 12 11
        i 7.373 26.801 -1 3 12 12
        i 7.374 26.868 -1 3 12 13
        i 7.375 26.935 -1 3 12 14
        i 7.376 27.001 -1 3 12 15
        i 7.377 27.068 -1 3 12 16
        i 7.378 27.135 -1 3 12 17
        i 7.379 27.201 -1 3 12 18
        i 7.380 27.268 -1 3 12 19
        i 7.381 27.335 -1 3 12 20
        i 7.382 27.401 -1 3 12 21
        i 7.383 27.468 -1 3 12 22
        i 7.384 27.535 -1 3 12 23
        i 7.385 27.601 -1 3 12 24
        i 7.386 27.668 -1 3 12 25
        i 7.387 27.735 -1 3 12 26
        i 7.388 27.801 -1 3 12 27
        i 7.389 27.868 -1 3 12 28
        i 7.390 27.935 -1 3 12 29
        i 7.391 28.001 -1 3 13 0
        i 7.392 28.068 -1 3 13 1
        i 7.393 28.135 -1 3 13 2
        i 7.394 28.201 -1 3 13 3
        i 7.395 28.268 -1 3 13 4
        i 7.396 28.335 -1 3 13 5
        i 7.397 28.401 -1 3 13 6
        i 7.398 28.468 -1 3 13 7
        i 7.399 28.535 -1 3 13 8
        i 7.400 28.601 -1 3 13 9
        i 7.401 28.668 -1 3 13 10
        i 7.402 28.735 -1 3 13 11
        i 7.403 28.801 -1 3 13 12
        i 7.404 28.868 -1 3 13 13
        i 7.405 28.935 -1 3 13 14
        i 7.406 29.001 -1 3 13 15
        i 7.407 29.068 -1 3 13 16
        i 7.408 29.135 -1 3 13 17
        i 7.409 29.201 -1 3 13 18
        i 7.410 29.268 -1 3 13 19
        i 7.411 29.335 -1 3 13 20
        i 7.412 29.401 -1 3 13 21
        i 7.413 29.468 -1 3 13 22
        i 7.414 29.535 -1 3 13 23
        i 7.415 29.601 -1 3 13 24
        i 7.416 29.668 -1 3 13 25
        i 7.417 29.735 -1 3 13 26
        i 7.418 29.801 -1 3 13 27
        i 7.419 29.868 -1 3 13 28
        i 7.420 29.935 -1 3 13 29
        i 7.421 30.001 -1 3 14 0
        i 7.422 30.068 -1 3 14 1
        i 7.423 30.135 -1 3 14 2
        i 7.424 30.201 -1 3 14 3
        i 7.425 30.268 -1 3 14 4
        i 7.426 30.335 -1 3 14 5
        i 7.427 30.401 -1 3 14 6
        i 7.428 30.468 -1 3 14 7
        i 7.429 30.535 -1 3 14 8
        i 7.430 30.601 -1 3 14 9
        i 7.431 30.668 -1 3 14 10
        i 7.432 30.735 -1 3 14 11
        i 7.433 30.801 -1 3 14 12
        i 7.434 30.868 -1 3 14 13
        i 7.435 30.935 -1 3 14 14
        i 7.436 31.001 -1 3 14 15
        i 7.437 31.068 -1 3 14 16
        i 7.438 31.135 -1 3 14 17
        i 7.439 31.201 -1 3 14 18
        i 7.440 31.268 -1 3 14 19
        i 7.441 31.335 -1 3 14 20
        i 7.442 31.401 -1 3 14 21
        i 7.443 31.468 -1 3 14 22
        i 7.444 31.535 -1 3 14 23
        i 7.445 31.601 -1 3 14 24
        i 7.446 31.668 -1 3 14 25
        i 7.447 31.735 -1 3 14 26
        i 7.448 31.801 -1 3 14 27
        i 7.449 31.868 -1 3 14 28
        i 7.450 31.935 -1 3 14 29
        i 7.451 32.001 -1 3 15 0
        i 7.452 32.068 -1 3 15 1
        i 7.453 32.135 -1 3 15 2
        i 7.454 32.201 -1 3 15 3
        i 7.455 32.268 -1 3 15 4
        i 7.456 32.335 -1 3 15 5
        i 7.457 32.401 -1 3 15 6
        i 7.458 32.468 -1 3 15 7
        i 7.459 32.535 -1 3 15 8
        i 7.460 32.601 -1 3 15 9
        i 7.461 32.668 -1 3 15 10
        i 7.462 32.735 -1 3 15 11
        i 7.463 32.801 -1 3 15 12
        i 7.464 32.868 -1 3 15 13
        i 7.465 32.935 -1 3 15 14
        i 7.466 33.001 -1 3 15 15
        i 7.467 33.068 -1 3 15 16
        i 7.468 33.135 -1 3 15 17
        i 7.469 33.201 -1 3 15 18
        i 7.470 33.268 -1 3 15 19
        i 7.471 33.335 -1 3 15 20
        i 7.472 33.401 -1 3 15 21
        i 7.473 33.468 -1 3 15 22
        i 7.474 33.535 -1 3 15 23
        i 7.475 33.601 -1 3 15 24
        i 7.476 33.668 -1 3 15 25
        i 7.477 33.735 -1 3 15 26
        i 7.478 33.801 -1 3 15 27
        i 7.479 33.868 -1 3 15 28
        i 7.480 33.935 -1 3 15 29
        i 7.481 34.001 -1 3 16 0
        i 7.482 34.068 -1 3 16 1
        i 7.483 34.135 -1 3 16 2
        i 7.484 34.201 -1 3 16 3
        i 7.485 34.268 -1 3 16 4
        i 7.486 34.335 -1 3 16 5
        i 7.487 34.401 -1 3 16 6
        i 7.488 34.468 -1 3 16 7
        i 7.489 34.535 -1 3 16 8
        i 7.490 34.601 -1 3 16 9
        i 7.491 34.668 -1 3 16 10
        i 7.492 34.735 -1 3 16 11
        i 7.493 34.801 -1 3 16 12
        i 7.494 34.868 -1 3 16 13
        i 7.495 34.935 -1 3 16 14
        i 7.496 35.001 -1 3 16 15
        i 7.497 35.068 -1 3 16 16
        i 7.498 35.135 -1 3 16 17
        i 7.499 35.201 -1 3 16 18
        i 7.500 35.268 -1 3 16 19
        i 7.501 35.335 -1 3 16 20
        i 7.502 35.401 -1 3 16 21
        i 7.503 35.468 -1 3 16 22
        i 7.504 35.535 -1 3 16 23
        i 7.505 35.601 -1 3 16 24
        i 7.506 35.668 -1 3 16 25
        i 7.507 35.735 -1 3 16 26
        i 7.508 35.801 -1 3 16 27
        i 7.509 35.868 -1 3 16 28
        i 7.510 35.935 -1 3 16 29
        i 7.511 36.001 -1 3 17 0
        i 7.512 36.068 -1 3 17 1
        i 7.513 36.135 -1 3 17 2
        i 7.514 36.201 -1 3 17 3
        i 7.515 36.268 -1 3 17 4
        i 7.516 36.335 -1 3 17 5
        i 7.517 36.401 -1 3 17 6
        i 7.518 36.468 -1 3 17 7
        i 7.519 36.535 -1 3 17 8
        i 7.520 36.601 -1 3 17 9
        i 7.521 36.668 -1 3 17 10
        i 7.522 36.735 -1 3 17 11
        i 7.523 36.801 -1 3 17 12
        i 7.524 36.868 -1 3 17 13
        i 7.525 36.935 -1 3 17 14
        i 7.526 37.001 -1 3 17 15
        i 7.527 37.068 -1 3 17 16
        i 7.528 37.135 -1 3 17 17
        i 7.529 37.201 -1 3 17 18
        i 7.530 37.268 -1 3 17 19
        i 7.531 37.335 -1 3 17 20
        i 7.532 37.401 -1 3 17 21
        i 7.533 37.468 -1 3 17 22
        i 7.534 37.535 -1 3 17 23
        i 7.535 37.601 -1 3 17 24
        i 7.536 37.668 -1 3 17 25
        i 7.537 37.735 -1 3 17 26
        i 7.538 37.801 -1 3 17 27
        i 7.539 37.868 -1 3 17 28
        i 7.540 37.935 -1 3 17 29
        i 7.541 38.001 -1 3 18 0
        i 7.542 38.068 -1 3 18 1
        i 7.543 38.135 -1 3 18 2
        i 7.544 38.201 -1 3 18 3
        i 7.545 38.268 -1 3 18 4
        i 7.546 38.335 -1 3 18 5
        i 7.547 38.401 -1 3 18 6
        i 7.548 38.468 -1 3 18 7
        i 7.549 38.535 -1 3 18 8
        i 7.550 38.601 -1 3 18 9
        i 7.551 38.668 -1 3 18 10
        i 7.552 38.735 -1 3 18 11
        i 7.553 38.801 -1 3 18 12
        i 7.554 38.868 -1 3 18 13
        i 7.555 38.935 -1 3 18 14
        i 7.556 39.001 -1 3 18 15
        i 7.557 39.068 -1 3 18 16
        i 7.558 39.135 -1 3 18 17
        i 7.559 39.201 -1 3 18 18
        i 7.560 39.268 -1 3 18 19
        i 7.561 39.335 -1 3 18 20
        i 7.562 39.401 -1 3 18 21
        i 7.563 39.468 -1 3 18 22
        i 7.564 39.535 -1 3 18 23
        i 7.565 39.601 -1 3 18 24
        i 7.566 39.668 -1 3 18 25
        i 7.567 39.735 -1 3 18 26
        i 7.568 39.801 -1 3 18 27
        i 7.569 39.868 -1 3 18 28
        i 7.570 39.935 -1 3 18 29
        i 7.571 40.001 -1 3 19 0
        i 7.572 40.068 -1 3 19 1
        i 7.573 40.135 -1 3 19 2
        i 7.574 40.201 -1 3 19 3
        i 7.575 40.268 -1 3 19 4
        i 7.576 40.335 -1 3 19 5
        i 7.577 40.401 -1 3 19 6
        i 7.578 40.468 -1 3 19 7
        i 7.579 40.535 -1 3 19 8
        i 7.580 40.601 -1 3 19 9
        i 7.581 40.668 -1 3 19 10
        i 7.582 40.735 -1 3 19 11
        i 7.583 40.801 -1 3 19 12
        i 7.584 40.868 -1 3 19 13
        i 7.585 40.935 -1 3 19 14
        i 7.586 41.001 -1 3 19 15
        i 7.587 41.068 -1 3 19 16
        i 7.588 41.135 -1 3 19 17
        i 7.589 41.201 -1 3 19 18
        i 7.590 41.268 -1 3 19 19
        i 7.591 41.335 -1 3 19 20
        i 7.592 41.401 -1 3 19 21
        i 7.593 41.468 -1 3 19 22
        i 7.594 41.535 -1 3 19 23
        i 7.595 41.601 -1 3 19 24
        i 7.596 41.668 -1 3 19 25
        i 7.597 41.735 -1 3 19 26
        i 7.598 41.801 -1 3 19 27
        i 7.599 41.868 -1 3 19 28
        i 7.600 41.935 -1 3 19 29
        i 7.601 42.001 -1 3 20 0
        i 7.602 42.068 -1 3 20 1
        i 7.603 42.135 -1 3 20 2
        i 7.604 42.201 -1 3 20 3
        i 7.605 42.268 -1 3 20 4
        i 7.606 42.335 -1 3 20 5
        i 7.607 42.401 -1 3 20 6
        i 7.608 42.468 -1 3 20 7
        i 7.609 42.535 -1 3 20 8
        i 7.610 42.601 -1 3 20 9
        i 7.611 42.668 -1 3 20 10
        i 7.612 42.735 -1 3 20 11
        i 7.613 42.801 -1 3 20 12
        i 7.614 42.868 -1 3 20 13
        i 7.615 42.935 -1 3 20 14
        i 7.616 43.001 -1 3 20 15
        i 7.617 43.068 -1 3 20 16
        i 7.618 43.135 -1 3 20 17
        i 7.619 43.201 -1 3 20 18
        i 7.620 43.268 -1 3 20 19
        i 7.621 43.335 -1 3 20 20
        i 7.622 43.401 -1 3 20 21
        i 7.623 43.468 -1 3 20 22
        i 7.624 43.535 -1 3 20 23
        i 7.625 43.601 -1 3 20 24
        i 7.626 43.668 -1 3 20 25
        i 7.627 43.735 -1 3 20 26
        i 7.628 43.801 -1 3 20 27
        i 7.629 43.868 -1 3 20 28
        i 7.630 43.935 -1 3 20 29
        i 7.631 44.001 -1 3 21 0
        i 7.632 44.068 -1 3 21 1
        i 7.633 44.135 -1 3 21 2
        i 7.634 44.201 -1 3 21 3
        i 7.635 44.268 -1 3 21 4
        i 7.636 44.335 -1 3 21 5
        i 7.637 44.401 -1 3 21 6
        i 7.638 44.468 -1 3 21 7
        i 7.639 44.535 -1 3 21 8
        i 7.640 44.601 -1 3 21 9
        i 7.641 44.668 -1 3 21 10
        i 7.642 44.735 -1 3 21 11
        i 7.643 44.801 -1 3 21 12
        i 7.644 44.868 -1 3 21 13
        i 7.645 44.935 -1 3 21 14
        i 7.646 45.001 -1 3 21 15
        i 7.647 45.068 -1 3 21 16
        i 7.648 45.135 -1 3 21 17
        i 7.649 45.201 -1 3 21 18
        i 7.650 45.268 -1 3 21 19
        i 7.651 45.335 -1 3 21 20
        i 7.652 45.401 -1 3 21 21
        i 7.653 45.468 -1 3 21 22
        i 7.654 45.535 -1 3 21 23
        i 7.655 45.601 -1 3 21 24
        i 7.656 45.668 -1 3 21 25
        i 7.657 45.735 -1 3 21 26
        i 7.658 45.801 -1 3 21 27
        i 7.659 45.868 -1 3 21 28
        i 7.660 45.935 -1 3 21 29
        i 7.661 46.001 -1 3 22 0
        i 7.662 46.068 -1 3 22 1
        i 7.663 46.135 -1 3 22 2
        i 7.664 46.201 -1 3 22 3
        i 7.665 46.268 -1 3 22 4
        i 7.666 46.335 -1 3 22 5
        i 7.667 46.401 -1 3 22 6
        i 7.668 46.468 -1 3 22 7
        i 7.669 46.535 -1 3 22 8
        i 7.670 46.601 -1 3 22 9
        i 7.671 46.668 -1 3 22 10
        i 7.672 46.735 -1 3 22 11
        i 7.673 46.801 -1 3 22 12
        i 7.674 46.868 -1 3 22 13
        i 7.675 46.935 -1 3 22 14
        i 7.676 47.001 -1 3 22 15
        i 7.677 47.068 -1 3 22 16
        i 7.678 47.135 -1 3 22 17
        i 7.679 47.201 -1 3 22 18
        i 7.680 47.268 -1 3 22 19
        i 7.681 47.335 -1 3 22 20
        i 7.682 47.401 -1 3 22 21
        i 7.683 47.468 -1 3 22 22
        i 7.684 47.535 -1 3 22 23
        i 7.685 47.601 -1 3 22 24
        i 7.686 47.668 -1 3 22 25
        i 7.687 47.735 -1 3 22 26
        i 7.688 47.801 -1 3 22 27
        i 7.689 47.868 -1 3 22 28
        i 7.690 47.935 -1 3 22 29
        i 7.691 48.001 -1 3 23 0
        i 7.692 48.068 -1 3 23 1
        i 7.693 48.135 -1 3 23 2
        i 7.694 48.201 -1 3 23 3
        i 7.695 48.268 -1 3 23 4
        i 7.696 48.335 -1 3 23 5
        i 7.697 48.401 -1 3 23 6
        i 7.698 48.468 -1 3 23 7
        i 7.699 48.535 -1 3 23 8
        i 7.700 48.601 -1 3 23 9
        i 7.701 48.668 -1 3 23 10
        i 7.702 48.735 -1 3 23 11
        i 7.703 48.801 -1 3 23 12
        i 7.704 48.868 -1 3 23 13
        i 7.705 48.935 -1 3 23 14
        i 7.706 49.001 -1 3 23 15
        i 7.707 49.068 -1 3 23 16
        i 7.708 49.135 -1 3 23 17
        i 7.709 49.201 -1 3 23 18
        i 7.710 49.268 -1 3 23 19
        i 7.711 49.335 -1 3 23 20
        i 7.712 49.401 -1 3 23 21
        i 7.713 49.468 -1 3 23 22
        i 7.714 49.535 -1 3 23 23
        i 7.715 49.601 -1 3 23 24
        i 7.716 49.668 -1 3 23 25
        i 7.717 49.735 -1 3 23 26
        i 7.718 49.801 -1 3 23 27
        i 7.719 49.868 -1 3 23 28
        i 7.720 49.935 -1 3 23 29
        i 7.721 50.001 -1 3 24 0
        i 7.722 50.068 -1 3 24 1
        i 7.723 50.135 -1 3 24 2
        i 7.724 50.201 -1 3 24 3
        i 7.725 50.268 -1 3 24 4
        i 7.726 50.335 -1 3 24 5
        i 7.727 50.401 -1 3 24 6
        i 7.728 50.468 -1 3 24 7
        i 7.729 50.535 -1 3 24 8
        i 7.730 50.601 -1 3 24 9
        i 7.731 50.668 -1 3 24 10
        i 7.732 50.735 -1 3 24 11
        i 7.733 50.801 -1 3 24 12
        i 7.734 50.868 -1 3 24 13
        i 7.735 50.935 -1 3 24 14
        i 7.736 51.001 -1 3 24 15
        i 7.737 51.068 -1 3 24 16
        i 7.738 51.135 -1 3 24 17
        i 7.739 51.201 -1 3 24 18
        i 7.740 51.268 -1 3 24 19
        i 7.741 51.335 -1 3 24 20
        i 7.742 51.401 -1 3 24 21
        i 7.743 51.468 -1 3 24 22
        i 7.744 51.535 -1 3 24 23
        i 7.745 51.601 -1 3 24 24
        i 7.746 51.668 -1 3 24 25
        i 7.747 51.735 -1 3 24 26
        i 7.748 51.801 -1 3 24 27
        i 7.749 51.868 -1 3 24 28
        i 7.750 51.935 -1 3 24 29
        i 7.751 52.001 -1 3 25 0
        i 7.752 52.068 -1 3 25 1
        i 7.753 52.135 -1 3 25 2
        i 7.754 52.201 -1 3 25 3
        i 7.755 52.268 -1 3 25 4
        i 7.756 52.335 -1 3 25 5
        i 7.757 52.401 -1 3 25 6
        i 7.758 52.468 -1 3 25 7
        i 7.759 52.535 -1 3 25 8
        i 7.760 52.601 -1 3 25 9
        i 7.761 52.668 -1 3 25 10
        i 7.762 52.735 -1 3 25 11
        i 7.763 52.801 -1 3 25 12
        i 7.764 52.868 -1 3 25 13
        i 7.765 52.935 -1 3 25 14
        i 7.766 53.001 -1 3 25 15
        i 7.767 53.068 -1 3 25 16
        i 7.768 53.135 -1 3 25 17
        i 7.769 53.201 -1 3 25 18
        i 7.770 53.268 -1 3 25 19
        i 7.771 53.335 -1 3 25 20
        i 7.772 53.401 -1 3 25 21
        i 7.773 53.468 -1 3 25 22
        i 7.774 53.535 -1 3 25 23
        i 7.775 53.601 -1 3 25 24
        i 7.776 53.668 -1 3 25 25
        i 7.777 53.735 -1 3 25 26
        i 7.778 53.801 -1 3 25 27
        i 7.779 53.868 -1 3 25 28
        i 7.780 53.935 -1 3 25 29
        i 7.781 54.001 -1 3 26 0
        i 7.782 54.068 -1 3 26 1
        i 7.783 54.135 -1 3 26 2
        i 7.784 54.201 -1 3 26 3
        i 7.785 54.268 -1 3 26 4
        i 7.786 54.335 -1 3 26 5
        i 7.787 54.401 -1 3 26 6
        i 7.788 54.468 -1 3 26 7
        i 7.789 54.535 -1 3 26 8
        i 7.790 54.601 -1 3 26 9
        i 7.791 54.668 -1 3 26 10
        i 7.792 54.735 -1 3 26 11
        i 7.793 54.801 -1 3 26 12
        i 7.794 54.868 -1 3 26 13
        i 7.795 54.935 -1 3 26 14
        i 7.796 55.001 -1 3 26 15
        i 7.797 55.068 -1 3 26 16
        i 7.798 55.135 -1 3 26 17
        i 7.799 55.201 -1 3 26 18
        i 7.800 55.268 -1 3 26 19
        i 7.801 55.335 -1 3 26 20
        i 7.802 55.401 -1 3 26 21
        i 7.803 55.468 -1 3 26 22
        i 7.804 55.535 -1 3 26 23
        i 7.805 55.601 -1 3 26 24
        i 7.806 55.668 -1 3 26 25
        i 7.807 55.735 -1 3 26 26
        i 7.808 55.801 -1 3 26 27
        i 7.809 55.868 -1 3 26 28
        i 7.810 55.935 -1 3 26 29
        i 7.811 56.001 -1 3 27 0
        i 7.812 56.068 -1 3 27 1
        i 7.813 56.135 -1 3 27 2
        i 7.814 56.201 -1 3 27 3
        i 7.815 56.268 -1 3 27 4
        i 7.816 56.335 -1 3 27 5
        i 7.817 56.401 -1 3 27 6
        i 7.818 56.468 -1 3 27 7
        i 7.819 56.535 -1 3 27 8
        i 7.820 56.601 -1 3 27 9
        i 7.821 56.668 -1 3 27 10
        i 7.822 56.735 -1 3 27 11
        i 7.823 56.801 -1 3 27 12
        i 7.824 56.868 -1 3 27 13
        i 7.825 56.935 -1 3 27 14
        i 7.826 57.001 -1 3 27 15
        i 7.827 57.068 -1 3 27 16
        i 7.828 57.135 -1 3 27 17
        i 7.829 57.201 -1 3 27 18
        i 7.830 57.268 -1 3 27 19
        i 7.831 57.335 -1 3 27 20
        i 7.832 57.401 -1 3 27 21
        i 7.833 57.468 -1 3 27 22
        i 7.834 57.535 -1 3 27 23
        i 7.835 57.601 -1 3 27 24
        i 7.836 57.668 -1 3 27 25
        i 7.837 57.735 -1 3 27 26
        i 7.838 57.801 -1 3 27 27
        i 7.839 57.868 -1 3 27 28
        i 7.840 57.935 -1 3 27 29
        i 7.841 58.001 -1 3 28 0
        i 7.842 58.068 -1 3 28 1
        i 7.843 58.135 -1 3 28 2
        i 7.844 58.201 -1 3 28 3
        i 7.845 58.268 -1 3 28 4
        i 7.846 58.335 -1 3 28 5
        i 7.847 58.401 -1 3 28 6
        i 7.848 58.468 -1 3 28 7
        i 7.849 58.535 -1 3 28 8
        i 7.850 58.601 -1 3 28 9
        i 7.851 58.668 -1 3 28 10
        i 7.852 58.735 -1 3 28 11
        i 7.853 58.801 -1 3 28 12
        i 7.854 58.868 -1 3 28 13
        i 7.855 58.935 -1 3 28 14
        i 7.856 59.001 -1 3 28 15
        i 7.857 59.068 -1 3 28 16
        i 7.858 59.135 -1 3 28 17
        i 7.859 59.201 -1 3 28 18
        i 7.860 59.268 -1 3 28 19
        i 7.861 59.335 -1 3 28 20
        i 7.862 59.401 -1 3 28 21
        i 7.863 59.468 -1 3 28 22
        i 7.864 59.535 -1 3 28 23
        i 7.865 59.601 -1 3 28 24
        i 7.866 59.668 -1 3 28 25
        i 7.867 59.735 -1 3 28 26
        i 7.868 59.801 -1 3 28 27
        i 7.869 59.868 -1 3 28 28
        i 7.870 59.935 -1 3 28 29
        i 7.871 60.001 -1 3 29 0
        i 7.872 60.068 -1 3 29 1
        i 7.873 60.135 -1 3 29 2
        i 7.874 60.201 -1 3 29 3
        i 7.875 60.268 -1 3 29 4
        i 7.876 60.335 -1 3 29 5
        i 7.877 60.401 -1 3 29 6
        i 7.878 60.468 -1 3 29 7
        i 7.879 60.535 -1 3 29 8
        i 7.880 60.601 -1 3 29 9
        i 7.881 60.668 -1 3 29 10
        i 7.882 60.735 -1 3 29 11
        i 7.883 60.801 -1 3 29 12
        i 7.884 60.868 -1 3 29 13
        i 7.885 60.935 -1 3 29 14
        i 7.886 61.001 -1 3 29 15
        i 7.887 61.068 -1 3 29 16
        i 7.888 61.135 -1 3 29 17
        i 7.889 61.201 -1 3 29 18
        i 7.890 61.268 -1 3 29 19
        i 7.891 61.335 -1 3 29 20
        i 7.892 61.401 -1 3 29 21
        i 7.893 61.468 -1 3 29 22
        i 7.894 61.535 -1 3 29 23
        i 7.895 61.601 -1 3 29 24
        i 7.896 61.668 -1 3 29 25
        i 7.897 61.735 -1 3 29 26
        i 7.898 61.801 -1 3 29 27
        i 7.899 61.868 -1 3 29 28
        i 7.900 61.935 -1 3 29 29
        i 6.001 2.853 0.100 1 1098 76
        i 6.002 3.825 0.100 1 1095 79
        i 6.003 4.621 0.100 1 1103 52
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
{"6c9f37ab-392f-429b-8217-eac09f295362":[{"instanceName":"","startDistance":60,"delayDistance":100,"noteNumberToHeightScale":7.50,"delayTime":0.50,"duration":0.5,"delayCount":5},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}}],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","fadeInTime":0.05,"fadeOutTime":0.05,"soundDistanceMin":50,"soundDistanceMax":500},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-39.005,-154.000,486.514]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[191.920,-154.000,346.694]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-99.579,-154.000,-314.826]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[304.204,-154.000,215.101]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[17.346,-154.000,108.983]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[149.602,-154.000,44.919]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-87.346,-154.000,-201.261]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-275.253,-154.000,-15.456]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-185.718,-154.000,46.327]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[43.873,266.000,54.782]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-55.327,230.000,-365.918]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[429.944,326.000,209.088]}}],"9037b759-36e4-4600-b2cb-03383ebd65c1":[{"instanceName":"","duration":60,"gridColumnCount":30,"gridRowCount":30,"gridCellSize":30,"fullVolumeY":2,"speedY":10,"maxDistance":100,"maxHeight":100},{"noteOn":{"time":7.000,"column":0,"row":0}},{"noteOn":{"time":7.070,"column":0,"row":1}},{"noteOn":{"time":7.135,"column":0,"row":2}},{"noteOn":{"time":7.200,"column":0,"row":3}},{"noteOn":{"time":7.270,"column":0,"row":4}},{"noteOn":{"time":7.335,"column":0,"row":5}},{"noteOn":{"time":7.400,"column":0,"row":6}},{"noteOn":{"time":7.470,"column":0,"row":7}},{"noteOn":{"time":7.535,"column":0,"row":8}},{"noteOn":{"time":7.600,"column":0,"row":9}},{"noteOn":{"time":7.670,"column":0,"row":10}},{"noteOn":{"time":7.735,"column":0,"row":11}},{"noteOn":{"time":7.800,"column":0,"row":12}},{"noteOn":{"time":7.870,"column":0,"row":13}},{"noteOn":{"time":7.935,"column":0,"row":14}},{"noteOn":{"time":8.000,"column":0,"row":15}},{"noteOn":{"time":8.070,"column":0,"row":16}},{"noteOn":{"time":8.135,"column":0,"row":17}},{"noteOn":{"time":8.200,"column":0,"row":18}},{"noteOn":{"time":8.270,"column":0,"row":19}},{"noteOn":{"time":8.335,"column":0,"row":20}},{"noteOn":{"time":8.400,"column":0,"row":21}},{"noteOn":{"time":8.470,"column":0,"row":22}},{"noteOn":{"time":8.535,"column":0,"row":23}},{"noteOn":{"time":8.600,"column":0,"row":24}},{"noteOn":{"time":8.670,"column":0,"row":25}},{"noteOn":{"time":8.735,"column":0,"row":26}},{"noteOn":{"time":8.800,"column":0,"row":27}},{"noteOn":{"time":8.870,"column":0,"row":28}},{"noteOn":{"time":8.935,"column":0,"row":29}},{"noteOn":{"time":9.000,"column":1,"row":0}},{"noteOn":{"time":9.070,"column":1,"row":1}},{"noteOn":{"time":9.135,"column":1,"row":2}},{"noteOn":{"time":9.200,"column":1,"row":3}},{"noteOn":{"time":9.270,"column":1,"row":4}},{"noteOn":{"time":9.335,"column":1,"row":5}},{"noteOn":{"time":9.400,"column":1,"row":6}},{"noteOn":{"time":9.470,"column":1,"row":7}},{"noteOn":{"time":9.535,"column":1,"row":8}},{"noteOn":{"time":9.600,"column":1,"row":9}},{"noteOn":{"time":9.670,"column":1,"row":10}},{"noteOn":{"time":9.735,"column":1,"row":11}},{"noteOn":{"time":9.800,"column":1,"row":12}},{"noteOn":{"time":9.870,"column":1,"row":13}},{"noteOn":{"time":9.935,"column":1,"row":14}},{"noteOn":{"time":10.000,"column":1,"row":15}},{"noteOn":{"time":10.070,"column":1,"row":16}},{"noteOn":{"time":10.135,"column":1,"row":17}},{"noteOn":{"time":10.200,"column":1,"row":18}},{"noteOn":{"time":10.270,"column":1,"row":19}},{"noteOn":{"time":10.335,"column":1,"row":20}},{"noteOn":{"time":10.400,"column":1,"row":21}},{"noteOn":{"time":10.470,"column":1,"row":22}},{"noteOn":{"time":10.535,"column":1,"row":23}},{"noteOn":{"time":10.600,"column":1,"row":24}},{"noteOn":{"time":10.670,"column":1,"row":25}},{"noteOn":{"time":10.735,"column":1,"row":26}},{"noteOn":{"time":10.800,"column":1,"row":27}},{"noteOn":{"time":10.870,"column":1,"row":28}},{"noteOn":{"time":10.935,"column":1,"row":29}},{"noteOn":{"time":11.000,"column":2,"row":0}},{"noteOn":{"time":11.070,"column":2,"row":1}},{"noteOn":{"time":11.135,"column":2,"row":2}},{"noteOn":{"time":11.200,"column":2,"row":3}},{"noteOn":{"time":11.270,"column":2,"row":4}},{"noteOn":{"time":11.335,"column":2,"row":5}},{"noteOn":{"time":11.400,"column":2,"row":6}},{"noteOn":{"time":11.470,"column":2,"row":7}},{"noteOn":{"time":11.535,"column":2,"row":8}},{"noteOn":{"time":11.600,"column":2,"row":9}},{"noteOn":{"time":11.670,"column":2,"row":10}},{"noteOn":{"time":11.735,"column":2,"row":11}},{"noteOn":{"time":11.800,"column":2,"row":12}},{"noteOn":{"time":11.870,"column":2,"row":13}},{"noteOn":{"time":11.935,"column":2,"row":14}},{"noteOn":{"time":12.000,"column":2,"row":15}},{"noteOn":{"time":12.070,"column":2,"row":16}},{"noteOn":{"time":12.135,"column":2,"row":17}},{"noteOn":{"time":12.200,"column":2,"row":18}},{"noteOn":{"time":12.270,"column":2,"row":19}},{"noteOn":{"time":12.335,"column":2,"row":20}},{"noteOn":{"time":12.400,"column":2,"row":21}},{"noteOn":{"time":12.470,"column":2,"row":22}},{"noteOn":{"time":12.535,"column":2,"row":23}},{"noteOn":{"time":12.600,"column":2,"row":24}},{"noteOn":{"time":12.670,"column":2,"row":25}},{"noteOn":{"time":12.735,"column":2,"row":26}},{"noteOn":{"time":12.800,"column":2,"row":27}},{"noteOn":{"time":12.870,"column":2,"row":28}},{"noteOn":{"time":12.935,"column":2,"row":29}},{"noteOn":{"time":13.000,"column":3,"row":0}},{"noteOn":{"time":13.070,"column":3,"row":1}},{"noteOn":{"time":13.135,"column":3,"row":2}},{"noteOn":{"time":13.200,"column":3,"row":3}},{"noteOn":{"time":13.270,"column":3,"row":4}},{"noteOn":{"time":13.335,"column":3,"row":5}},{"noteOn":{"time":13.400,"column":3,"row":6}},{"noteOn":{"time":13.470,"column":3,"row":7}},{"noteOn":{"time":13.535,"column":3,"row":8}},{"noteOn":{"time":13.600,"column":3,"row":9}},{"noteOn":{"time":13.670,"column":3,"row":10}},{"noteOn":{"time":13.735,"column":3,"row":11}},{"noteOn":{"time":13.800,"column":3,"row":12}},{"noteOn":{"time":13.870,"column":3,"row":13}},{"noteOn":{"time":13.935,"column":3,"row":14}},{"noteOn":{"time":14.000,"column":3,"row":15}},{"noteOn":{"time":14.070,"column":3,"row":16}},{"noteOn":{"time":14.135,"column":3,"row":17}},{"noteOn":{"time":14.200,"column":3,"row":18}},{"noteOn":{"time":14.270,"column":3,"row":19}},{"noteOn":{"time":14.335,"column":3,"row":20}},{"noteOn":{"time":14.400,"column":3,"row":21}},{"noteOn":{"time":14.470,"column":3,"row":22}},{"noteOn":{"time":14.535,"column":3,"row":23}},{"noteOn":{"time":14.600,"column":3,"row":24}},{"noteOn":{"time":14.670,"column":3,"row":25}},{"noteOn":{"time":14.735,"column":3,"row":26}},{"noteOn":{"time":14.800,"column":3,"row":27}},{"noteOn":{"time":14.870,"column":3,"row":28}},{"noteOn":{"time":14.935,"column":3,"row":29}},{"noteOn":{"time":15.000,"column":4,"row":0}},{"noteOn":{"time":15.070,"column":4,"row":1}},{"noteOn":{"time":15.135,"column":4,"row":2}},{"noteOn":{"time":15.200,"column":4,"row":3}},{"noteOn":{"time":15.270,"column":4,"row":4}},{"noteOn":{"time":15.335,"column":4,"row":5}},{"noteOn":{"time":15.400,"column":4,"row":6}},{"noteOn":{"time":15.470,"column":4,"row":7}},{"noteOn":{"time":15.535,"column":4,"row":8}},{"noteOn":{"time":15.600,"column":4,"row":9}},{"noteOn":{"time":15.670,"column":4,"row":10}},{"noteOn":{"time":15.735,"column":4,"row":11}},{"noteOn":{"time":15.800,"column":4,"row":12}},{"noteOn":{"time":15.870,"column":4,"row":13}},{"noteOn":{"time":15.935,"column":4,"row":14}},{"noteOn":{"time":16.000,"column":4,"row":15}},{"noteOn":{"time":16.070,"column":4,"row":16}},{"noteOn":{"time":16.135,"column":4,"row":17}},{"noteOn":{"time":16.200,"column":4,"row":18}},{"noteOn":{"time":16.270,"column":4,"row":19}},{"noteOn":{"time":16.335,"column":4,"row":20}},{"noteOn":{"time":16.400,"column":4,"row":21}},{"noteOn":{"time":16.470,"column":4,"row":22}},{"noteOn":{"time":16.535,"column":4,"row":23}},{"noteOn":{"time":16.600,"column":4,"row":24}},{"noteOn":{"time":16.670,"column":4,"row":25}},{"noteOn":{"time":16.735,"column":4,"row":26}},{"noteOn":{"time":16.800,"column":4,"row":27}},{"noteOn":{"time":16.870,"column":4,"row":28}},{"noteOn":{"time":16.935,"column":4,"row":29}},{"noteOn":{"time":17.000,"column":5,"row":0}},{"noteOn":{"time":17.070,"column":5,"row":1}},{"noteOn":{"time":17.135,"column":5,"row":2}},{"noteOn":{"time":17.200,"column":5,"row":3}},{"noteOn":{"time":17.270,"column":5,"row":4}},{"noteOn":{"time":17.335,"column":5,"row":5}},{"noteOn":{"time":17.400,"column":5,"row":6}},{"noteOn":{"time":17.470,"column":5,"row":7}},{"noteOn":{"time":17.535,"column":5,"row":8}},{"noteOn":{"time":17.600,"column":5,"row":9}},{"noteOn":{"time":17.670,"column":5,"row":10}},{"noteOn":{"time":17.735,"column":5,"row":11}},{"noteOn":{"time":17.800,"column":5,"row":12}},{"noteOn":{"time":17.870,"column":5,"row":13}},{"noteOn":{"time":17.935,"column":5,"row":14}},{"noteOn":{"time":18.000,"column":5,"row":15}},{"noteOn":{"time":18.070,"column":5,"row":16}},{"noteOn":{"time":18.135,"column":5,"row":17}},{"noteOn":{"time":18.200,"column":5,"row":18}},{"noteOn":{"time":18.270,"column":5,"row":19}},{"noteOn":{"time":18.335,"column":5,"row":20}},{"noteOn":{"time":18.400,"column":5,"row":21}},{"noteOn":{"time":18.470,"column":5,"row":22}},{"noteOn":{"time":18.535,"column":5,"row":23}},{"noteOn":{"time":18.600,"column":5,"row":24}},{"noteOn":{"time":18.670,"column":5,"row":25}},{"noteOn":{"time":18.735,"column":5,"row":26}},{"noteOn":{"time":18.800,"column":5,"row":27}},{"noteOn":{"time":18.870,"column":5,"row":28}},{"noteOn":{"time":18.935,"column":5,"row":29}},{"noteOn":{"time":19.000,"column":6,"row":0}},{"noteOn":{"time":19.070,"column":6,"row":1}},{"noteOn":{"time":19.135,"column":6,"row":2}},{"noteOn":{"time":19.200,"column":6,"row":3}},{"noteOn":{"time":19.270,"column":6,"row":4}},{"noteOn":{"time":19.335,"column":6,"row":5}},{"noteOn":{"time":19.400,"column":6,"row":6}},{"noteOn":{"time":19.470,"column":6,"row":7}},{"noteOn":{"time":19.535,"column":6,"row":8}},{"noteOn":{"time":19.600,"column":6,"row":9}},{"noteOn":{"time":19.670,"column":6,"row":10}},{"noteOn":{"time":19.735,"column":6,"row":11}},{"noteOn":{"time":19.800,"column":6,"row":12}},{"noteOn":{"time":19.870,"column":6,"row":13}},{"noteOn":{"time":19.935,"column":6,"row":14}},{"noteOn":{"time":20.000,"column":6,"row":15}},{"noteOn":{"time":20.070,"column":6,"row":16}},{"noteOn":{"time":20.135,"column":6,"row":17}},{"noteOn":{"time":20.200,"column":6,"row":18}},{"noteOn":{"time":20.270,"column":6,"row":19}},{"noteOn":{"time":20.335,"column":6,"row":20}},{"noteOn":{"time":20.400,"column":6,"row":21}},{"noteOn":{"time":20.470,"column":6,"row":22}},{"noteOn":{"time":20.535,"column":6,"row":23}},{"noteOn":{"time":20.600,"column":6,"row":24}},{"noteOn":{"time":20.670,"column":6,"row":25}},{"noteOn":{"time":20.735,"column":6,"row":26}},{"noteOn":{"time":20.800,"column":6,"row":27}},{"noteOn":{"time":20.870,"column":6,"row":28}},{"noteOn":{"time":20.935,"column":6,"row":29}},{"noteOn":{"time":21.000,"column":7,"row":0}},{"noteOn":{"time":21.070,"column":7,"row":1}},{"noteOn":{"time":21.135,"column":7,"row":2}},{"noteOn":{"time":21.200,"column":7,"row":3}},{"noteOn":{"time":21.270,"column":7,"row":4}},{"noteOn":{"time":21.335,"column":7,"row":5}},{"noteOn":{"time":21.400,"column":7,"row":6}},{"noteOn":{"time":21.470,"column":7,"row":7}},{"noteOn":{"time":21.535,"column":7,"row":8}},{"noteOn":{"time":21.600,"column":7,"row":9}},{"noteOn":{"time":21.670,"column":7,"row":10}},{"noteOn":{"time":21.735,"column":7,"row":11}},{"noteOn":{"time":21.800,"column":7,"row":12}},{"noteOn":{"time":21.870,"column":7,"row":13}},{"noteOn":{"time":21.935,"column":7,"row":14}},{"noteOn":{"time":22.000,"column":7,"row":15}},{"noteOn":{"time":22.070,"column":7,"row":16}},{"noteOn":{"time":22.135,"column":7,"row":17}},{"noteOn":{"time":22.200,"column":7,"row":18}},{"noteOn":{"time":22.270,"column":7,"row":19}},{"noteOn":{"time":22.335,"column":7,"row":20}},{"noteOn":{"time":22.400,"column":7,"row":21}},{"noteOn":{"time":22.470,"column":7,"row":22}},{"noteOn":{"time":22.535,"column":7,"row":23}},{"noteOn":{"time":22.600,"column":7,"row":24}},{"noteOn":{"time":22.670,"column":7,"row":25}},{"noteOn":{"time":22.735,"column":7,"row":26}},{"noteOn":{"time":22.800,"column":7,"row":27}},{"noteOn":{"time":22.870,"column":7,"row":28}},{"noteOn":{"time":22.935,"column":7,"row":29}},{"noteOn":{"time":23.000,"column":8,"row":0}},{"noteOn":{"time":23.070,"column":8,"row":1}},{"noteOn":{"time":23.135,"column":8,"row":2}},{"noteOn":{"time":23.200,"column":8,"row":3}},{"noteOn":{"time":23.270,"column":8,"row":4}},{"noteOn":{"time":23.335,"column":8,"row":5}},{"noteOn":{"time":23.400,"column":8,"row":6}},{"noteOn":{"time":23.470,"column":8,"row":7}},{"noteOn":{"time":23.535,"column":8,"row":8}},{"noteOn":{"time":23.600,"column":8,"row":9}},{"noteOn":{"time":23.670,"column":8,"row":10}},{"noteOn":{"time":23.735,"column":8,"row":11}},{"noteOn":{"time":23.800,"column":8,"row":12}},{"noteOn":{"time":23.870,"column":8,"row":13}},{"noteOn":{"time":23.935,"column":8,"row":14}},{"noteOn":{"time":24.000,"column":8,"row":15}},{"noteOn":{"time":24.070,"column":8,"row":16}},{"noteOn":{"time":24.135,"column":8,"row":17}},{"noteOn":{"time":24.200,"column":8,"row":18}},{"noteOn":{"time":24.270,"column":8,"row":19}},{"noteOn":{"time":24.335,"column":8,"row":20}},{"noteOn":{"time":24.400,"column":8,"row":21}},{"noteOn":{"time":24.470,"column":8,"row":22}},{"noteOn":{"time":24.535,"column":8,"row":23}},{"noteOn":{"time":24.600,"column":8,"row":24}},{"noteOn":{"time":24.670,"column":8,"row":25}},{"noteOn":{"time":24.735,"column":8,"row":26}},{"noteOn":{"time":24.800,"column":8,"row":27}},{"noteOn":{"time":24.870,"column":8,"row":28}},{"noteOn":{"time":24.935,"column":8,"row":29}},{"noteOn":{"time":25.000,"column":9,"row":0}},{"noteOn":{"time":25.070,"column":9,"row":1}},{"noteOn":{"time":25.135,"column":9,"row":2}},{"noteOn":{"time":25.200,"column":9,"row":3}},{"noteOn":{"time":25.270,"column":9,"row":4}},{"noteOn":{"time":25.335,"column":9,"row":5}},{"noteOn":{"time":25.400,"column":9,"row":6}},{"noteOn":{"time":25.470,"column":9,"row":7}},{"noteOn":{"time":25.535,"column":9,"row":8}},{"noteOn":{"time":25.600,"column":9,"row":9}},{"noteOn":{"time":25.670,"column":9,"row":10}},{"noteOn":{"time":25.735,"column":9,"row":11}},{"noteOn":{"time":25.800,"column":9,"row":12}},{"noteOn":{"time":25.870,"column":9,"row":13}},{"noteOn":{"time":25.935,"column":9,"row":14}},{"noteOn":{"time":26.000,"column":9,"row":15}},{"noteOn":{"time":26.070,"column":9,"row":16}},{"noteOn":{"time":26.135,"column":9,"row":17}},{"noteOn":{"time":26.200,"column":9,"row":18}},{"noteOn":{"time":26.270,"column":9,"row":19}},{"noteOn":{"time":26.335,"column":9,"row":20}},{"noteOn":{"time":26.400,"column":9,"row":21}},{"noteOn":{"time":26.470,"column":9,"row":22}},{"noteOn":{"time":26.535,"column":9,"row":23}},{"noteOn":{"time":26.600,"column":9,"row":24}},{"noteOn":{"time":26.670,"column":9,"row":25}},{"noteOn":{"time":26.735,"column":9,"row":26}},{"noteOn":{"time":26.800,"column":9,"row":27}},{"noteOn":{"time":26.870,"column":9,"row":28}},{"noteOn":{"time":26.935,"column":9,"row":29}},{"noteOn":{"time":27.000,"column":10,"row":0}},{"noteOn":{"time":27.070,"column":10,"row":1}},{"noteOn":{"time":27.135,"column":10,"row":2}},{"noteOn":{"time":27.200,"column":10,"row":3}},{"noteOn":{"time":27.270,"column":10,"row":4}},{"noteOn":{"time":27.335,"column":10,"row":5}},{"noteOn":{"time":27.400,"column":10,"row":6}},{"noteOn":{"time":27.470,"column":10,"row":7}},{"noteOn":{"time":27.535,"column":10,"row":8}},{"noteOn":{"time":27.600,"column":10,"row":9}},{"noteOn":{"time":27.670,"column":10,"row":10}},{"noteOn":{"time":27.735,"column":10,"row":11}},{"noteOn":{"time":27.800,"column":10,"row":12}},{"noteOn":{"time":27.870,"column":10,"row":13}},{"noteOn":{"time":27.935,"column":10,"row":14}},{"noteOn":{"time":28.000,"column":10,"row":15}},{"noteOn":{"time":28.070,"column":10,"row":16}},{"noteOn":{"time":28.135,"column":10,"row":17}},{"noteOn":{"time":28.200,"column":10,"row":18}},{"noteOn":{"time":28.270,"column":10,"row":19}},{"noteOn":{"time":28.335,"column":10,"row":20}},{"noteOn":{"time":28.400,"column":10,"row":21}},{"noteOn":{"time":28.470,"column":10,"row":22}},{"noteOn":{"time":28.535,"column":10,"row":23}},{"noteOn":{"time":28.600,"column":10,"row":24}},{"noteOn":{"time":28.670,"column":10,"row":25}},{"noteOn":{"time":28.735,"column":10,"row":26}},{"noteOn":{"time":28.800,"column":10,"row":27}},{"noteOn":{"time":28.870,"column":10,"row":28}},{"noteOn":{"time":28.935,"column":10,"row":29}},{"noteOn":{"time":29.000,"column":11,"row":0}},{"noteOn":{"time":29.070,"column":11,"row":1}},{"noteOn":{"time":29.135,"column":11,"row":2}},{"noteOn":{"time":29.200,"column":11,"row":3}},{"noteOn":{"time":29.270,"column":11,"row":4}},{"noteOn":{"time":29.335,"column":11,"row":5}},{"noteOn":{"time":29.400,"column":11,"row":6}},{"noteOn":{"time":29.470,"column":11,"row":7}},{"noteOn":{"time":29.535,"column":11,"row":8}},{"noteOn":{"time":29.600,"column":11,"row":9}},{"noteOn":{"time":29.670,"column":11,"row":10}},{"noteOn":{"time":29.735,"column":11,"row":11}},{"noteOn":{"time":29.800,"column":11,"row":12}},{"noteOn":{"time":29.870,"column":11,"row":13}},{"noteOn":{"time":29.935,"column":11,"row":14}},{"noteOn":{"time":30.000,"column":11,"row":15}},{"noteOn":{"time":30.070,"column":11,"row":16}},{"noteOn":{"time":30.135,"column":11,"row":17}},{"noteOn":{"time":30.200,"column":11,"row":18}},{"noteOn":{"time":30.270,"column":11,"row":19}},{"noteOn":{"time":30.335,"column":11,"row":20}},{"noteOn":{"time":30.400,"column":11,"row":21}},{"noteOn":{"time":30.470,"column":11,"row":22}},{"noteOn":{"time":30.535,"column":11,"row":23}},{"noteOn":{"time":30.600,"column":11,"row":24}},{"noteOn":{"time":30.670,"column":11,"row":25}},{"noteOn":{"time":30.735,"column":11,"row":26}},{"noteOn":{"time":30.800,"column":11,"row":27}},{"noteOn":{"time":30.870,"column":11,"row":28}},{"noteOn":{"time":30.935,"column":11,"row":29}},{"noteOn":{"time":31.000,"column":12,"row":0}},{"noteOn":{"time":31.070,"column":12,"row":1}},{"noteOn":{"time":31.135,"column":12,"row":2}},{"noteOn":{"time":31.200,"column":12,"row":3}},{"noteOn":{"time":31.270,"column":12,"row":4}},{"noteOn":{"time":31.335,"column":12,"row":5}},{"noteOn":{"time":31.400,"column":12,"row":6}},{"noteOn":{"time":31.470,"column":12,"row":7}},{"noteOn":{"time":31.535,"column":12,"row":8}},{"noteOn":{"time":31.600,"column":12,"row":9}},{"noteOn":{"time":31.670,"column":12,"row":10}},{"noteOn":{"time":31.735,"column":12,"row":11}},{"noteOn":{"time":31.800,"column":12,"row":12}},{"noteOn":{"time":31.870,"column":12,"row":13}},{"noteOn":{"time":31.935,"column":12,"row":14}},{"noteOn":{"time":32.000,"column":12,"row":15}},{"noteOn":{"time":32.070,"column":12,"row":16}},{"noteOn":{"time":32.135,"column":12,"row":17}},{"noteOn":{"time":32.200,"column":12,"row":18}},{"noteOn":{"time":32.270,"column":12,"row":19}},{"noteOn":{"time":32.335,"column":12,"row":20}},{"noteOn":{"time":32.400,"column":12,"row":21}},{"noteOn":{"time":32.470,"column":12,"row":22}},{"noteOn":{"time":32.535,"column":12,"row":23}},{"noteOn":{"time":32.600,"column":12,"row":24}},{"noteOn":{"time":32.670,"column":12,"row":25}},{"noteOn":{"time":32.735,"column":12,"row":26}},{"noteOn":{"time":32.800,"column":12,"row":27}},{"noteOn":{"time":32.870,"column":12,"row":28}},{"noteOn":{"time":32.935,"column":12,"row":29}},{"noteOn":{"time":33.000,"column":13,"row":0}},{"noteOn":{"time":33.070,"column":13,"row":1}},{"noteOn":{"time":33.135,"column":13,"row":2}},{"noteOn":{"time":33.200,"column":13,"row":3}},{"noteOn":{"time":33.270,"column":13,"row":4}},{"noteOn":{"time":33.335,"column":13,"row":5}},{"noteOn":{"time":33.400,"column":13,"row":6}},{"noteOn":{"time":33.470,"column":13,"row":7}},{"noteOn":{"time":33.535,"column":13,"row":8}},{"noteOn":{"time":33.600,"column":13,"row":9}},{"noteOn":{"time":33.670,"column":13,"row":10}},{"noteOn":{"time":33.735,"column":13,"row":11}},{"noteOn":{"time":33.800,"column":13,"row":12}},{"noteOn":{"time":33.870,"column":13,"row":13}},{"noteOn":{"time":33.935,"column":13,"row":14}},{"noteOn":{"time":34.000,"column":13,"row":15}},{"noteOn":{"time":34.070,"column":13,"row":16}},{"noteOn":{"time":34.135,"column":13,"row":17}},{"noteOn":{"time":34.200,"column":13,"row":18}},{"noteOn":{"time":34.270,"column":13,"row":19}},{"noteOn":{"time":34.335,"column":13,"row":20}},{"noteOn":{"time":34.400,"column":13,"row":21}},{"noteOn":{"time":34.470,"column":13,"row":22}},{"noteOn":{"time":34.535,"column":13,"row":23}},{"noteOn":{"time":34.600,"column":13,"row":24}},{"noteOn":{"time":34.670,"column":13,"row":25}},{"noteOn":{"time":34.735,"column":13,"row":26}},{"noteOn":{"time":34.800,"column":13,"row":27}},{"noteOn":{"time":34.870,"column":13,"row":28}},{"noteOn":{"time":34.935,"column":13,"row":29}},{"noteOn":{"time":35.000,"column":14,"row":0}},{"noteOn":{"time":35.070,"column":14,"row":1}},{"noteOn":{"time":35.135,"column":14,"row":2}},{"noteOn":{"time":35.200,"column":14,"row":3}},{"noteOn":{"time":35.270,"column":14,"row":4}},{"noteOn":{"time":35.335,"column":14,"row":5}},{"noteOn":{"time":35.400,"column":14,"row":6}},{"noteOn":{"time":35.470,"column":14,"row":7}},{"noteOn":{"time":35.535,"column":14,"row":8}},{"noteOn":{"time":35.600,"column":14,"row":9}},{"noteOn":{"time":35.670,"column":14,"row":10}},{"noteOn":{"time":35.735,"column":14,"row":11}},{"noteOn":{"time":35.800,"column":14,"row":12}},{"noteOn":{"time":35.870,"column":14,"row":13}},{"noteOn":{"time":35.935,"column":14,"row":14}},{"noteOn":{"time":36.000,"column":14,"row":15}},{"noteOn":{"time":36.070,"column":14,"row":16}},{"noteOn":{"time":36.135,"column":14,"row":17}},{"noteOn":{"time":36.200,"column":14,"row":18}},{"noteOn":{"time":36.270,"column":14,"row":19}},{"noteOn":{"time":36.335,"column":14,"row":20}},{"noteOn":{"time":36.400,"column":14,"row":21}},{"noteOn":{"time":36.470,"column":14,"row":22}},{"noteOn":{"time":36.535,"column":14,"row":23}},{"noteOn":{"time":36.600,"column":14,"row":24}},{"noteOn":{"time":36.670,"column":14,"row":25}},{"noteOn":{"time":36.735,"column":14,"row":26}},{"noteOn":{"time":36.800,"column":14,"row":27}},{"noteOn":{"time":36.870,"column":14,"row":28}},{"noteOn":{"time":36.935,"column":14,"row":29}},{"noteOn":{"time":37.000,"column":15,"row":0}},{"noteOn":{"time":37.070,"column":15,"row":1}},{"noteOn":{"time":37.135,"column":15,"row":2}},{"noteOn":{"time":37.200,"column":15,"row":3}},{"noteOn":{"time":37.270,"column":15,"row":4}},{"noteOn":{"time":37.335,"column":15,"row":5}},{"noteOn":{"time":37.400,"column":15,"row":6}},{"noteOn":{"time":37.470,"column":15,"row":7}},{"noteOn":{"time":37.535,"column":15,"row":8}},{"noteOn":{"time":37.600,"column":15,"row":9}},{"noteOn":{"time":37.670,"column":15,"row":10}},{"noteOn":{"time":37.735,"column":15,"row":11}},{"noteOn":{"time":37.800,"column":15,"row":12}},{"noteOn":{"time":37.870,"column":15,"row":13}},{"noteOn":{"time":37.935,"column":15,"row":14}},{"noteOn":{"time":38.000,"column":15,"row":15}},{"noteOn":{"time":38.070,"column":15,"row":16}},{"noteOn":{"time":38.135,"column":15,"row":17}},{"noteOn":{"time":38.200,"column":15,"row":18}},{"noteOn":{"time":38.270,"column":15,"row":19}},{"noteOn":{"time":38.335,"column":15,"row":20}},{"noteOn":{"time":38.400,"column":15,"row":21}},{"noteOn":{"time":38.470,"column":15,"row":22}},{"noteOn":{"time":38.535,"column":15,"row":23}},{"noteOn":{"time":38.600,"column":15,"row":24}},{"noteOn":{"time":38.670,"column":15,"row":25}},{"noteOn":{"time":38.735,"column":15,"row":26}},{"noteOn":{"time":38.800,"column":15,"row":27}},{"noteOn":{"time":38.870,"column":15,"row":28}},{"noteOn":{"time":38.935,"column":15,"row":29}},{"noteOn":{"time":39.000,"column":16,"row":0}},{"noteOn":{"time":39.070,"column":16,"row":1}},{"noteOn":{"time":39.135,"column":16,"row":2}},{"noteOn":{"time":39.200,"column":16,"row":3}},{"noteOn":{"time":39.270,"column":16,"row":4}},{"noteOn":{"time":39.335,"column":16,"row":5}},{"noteOn":{"time":39.400,"column":16,"row":6}},{"noteOn":{"time":39.470,"column":16,"row":7}},{"noteOn":{"time":39.535,"column":16,"row":8}},{"noteOn":{"time":39.600,"column":16,"row":9}},{"noteOn":{"time":39.670,"column":16,"row":10}},{"noteOn":{"time":39.735,"column":16,"row":11}},{"noteOn":{"time":39.800,"column":16,"row":12}},{"noteOn":{"time":39.870,"column":16,"row":13}},{"noteOn":{"time":39.935,"column":16,"row":14}},{"noteOn":{"time":40.000,"column":16,"row":15}},{"noteOn":{"time":40.070,"column":16,"row":16}},{"noteOn":{"time":40.135,"column":16,"row":17}},{"noteOn":{"time":40.200,"column":16,"row":18}},{"noteOn":{"time":40.270,"column":16,"row":19}},{"noteOn":{"time":40.335,"column":16,"row":20}},{"noteOn":{"time":40.400,"column":16,"row":21}},{"noteOn":{"time":40.470,"column":16,"row":22}},{"noteOn":{"time":40.535,"column":16,"row":23}},{"noteOn":{"time":40.600,"column":16,"row":24}},{"noteOn":{"time":40.670,"column":16,"row":25}},{"noteOn":{"time":40.735,"column":16,"row":26}},{"noteOn":{"time":40.800,"column":16,"row":27}},{"noteOn":{"time":40.870,"column":16,"row":28}},{"noteOn":{"time":40.935,"column":16,"row":29}},{"noteOn":{"time":41.000,"column":17,"row":0}},{"noteOn":{"time":41.070,"column":17,"row":1}},{"noteOn":{"time":41.135,"column":17,"row":2}},{"noteOn":{"time":41.200,"column":17,"row":3}},{"noteOn":{"time":41.270,"column":17,"row":4}},{"noteOn":{"time":41.335,"column":17,"row":5}},{"noteOn":{"time":41.400,"column":17,"row":6}},{"noteOn":{"time":41.470,"column":17,"row":7}},{"noteOn":{"time":41.535,"column":17,"row":8}},{"noteOn":{"time":41.600,"column":17,"row":9}},{"noteOn":{"time":41.670,"column":17,"row":10}},{"noteOn":{"time":41.735,"column":17,"row":11}},{"noteOn":{"time":41.800,"column":17,"row":12}},{"noteOn":{"time":41.870,"column":17,"row":13}},{"noteOn":{"time":41.935,"column":17,"row":14}},{"noteOn":{"time":42.000,"column":17,"row":15}},{"noteOn":{"time":42.070,"column":17,"row":16}},{"noteOn":{"time":42.135,"column":17,"row":17}},{"noteOn":{"time":42.200,"column":17,"row":18}},{"noteOn":{"time":42.270,"column":17,"row":19}},{"noteOn":{"time":42.335,"column":17,"row":20}},{"noteOn":{"time":42.400,"column":17,"row":21}},{"noteOn":{"time":42.470,"column":17,"row":22}},{"noteOn":{"time":42.535,"column":17,"row":23}},{"noteOn":{"time":42.600,"column":17,"row":24}},{"noteOn":{"time":42.670,"column":17,"row":25}},{"noteOn":{"time":42.735,"column":17,"row":26}},{"noteOn":{"time":42.800,"column":17,"row":27}},{"noteOn":{"time":42.870,"column":17,"row":28}},{"noteOn":{"time":42.935,"column":17,"row":29}},{"noteOn":{"time":43.000,"column":18,"row":0}},{"noteOn":{"time":43.070,"column":18,"row":1}},{"noteOn":{"time":43.135,"column":18,"row":2}},{"noteOn":{"time":43.200,"column":18,"row":3}},{"noteOn":{"time":43.270,"column":18,"row":4}},{"noteOn":{"time":43.335,"column":18,"row":5}},{"noteOn":{"time":43.400,"column":18,"row":6}},{"noteOn":{"time":43.470,"column":18,"row":7}},{"noteOn":{"time":43.535,"column":18,"row":8}},{"noteOn":{"time":43.600,"column":18,"row":9}},{"noteOn":{"time":43.670,"column":18,"row":10}},{"noteOn":{"time":43.735,"column":18,"row":11}},{"noteOn":{"time":43.800,"column":18,"row":12}},{"noteOn":{"time":43.870,"column":18,"row":13}},{"noteOn":{"time":43.935,"column":18,"row":14}},{"noteOn":{"time":44.000,"column":18,"row":15}},{"noteOn":{"time":44.070,"column":18,"row":16}},{"noteOn":{"time":44.135,"column":18,"row":17}},{"noteOn":{"time":44.200,"column":18,"row":18}},{"noteOn":{"time":44.270,"column":18,"row":19}},{"noteOn":{"time":44.335,"column":18,"row":20}},{"noteOn":{"time":44.400,"column":18,"row":21}},{"noteOn":{"time":44.470,"column":18,"row":22}},{"noteOn":{"time":44.535,"column":18,"row":23}},{"noteOn":{"time":44.600,"column":18,"row":24}},{"noteOn":{"time":44.670,"column":18,"row":25}},{"noteOn":{"time":44.735,"column":18,"row":26}},{"noteOn":{"time":44.800,"column":18,"row":27}},{"noteOn":{"time":44.870,"column":18,"row":28}},{"noteOn":{"time":44.935,"column":18,"row":29}},{"noteOn":{"time":45.000,"column":19,"row":0}},{"noteOn":{"time":45.070,"column":19,"row":1}},{"noteOn":{"time":45.135,"column":19,"row":2}},{"noteOn":{"time":45.200,"column":19,"row":3}},{"noteOn":{"time":45.270,"column":19,"row":4}},{"noteOn":{"time":45.335,"column":19,"row":5}},{"noteOn":{"time":45.400,"column":19,"row":6}},{"noteOn":{"time":45.470,"column":19,"row":7}},{"noteOn":{"time":45.535,"column":19,"row":8}},{"noteOn":{"time":45.600,"column":19,"row":9}},{"noteOn":{"time":45.670,"column":19,"row":10}},{"noteOn":{"time":45.735,"column":19,"row":11}},{"noteOn":{"time":45.800,"column":19,"row":12}},{"noteOn":{"time":45.870,"column":19,"row":13}},{"noteOn":{"time":45.935,"column":19,"row":14}},{"noteOn":{"time":46.000,"column":19,"row":15}},{"noteOn":{"time":46.070,"column":19,"row":16}},{"noteOn":{"time":46.135,"column":19,"row":17}},{"noteOn":{"time":46.200,"column":19,"row":18}},{"noteOn":{"time":46.270,"column":19,"row":19}},{"noteOn":{"time":46.335,"column":19,"row":20}},{"noteOn":{"time":46.400,"column":19,"row":21}},{"noteOn":{"time":46.470,"column":19,"row":22}},{"noteOn":{"time":46.535,"column":19,"row":23}},{"noteOn":{"time":46.600,"column":19,"row":24}},{"noteOn":{"time":46.670,"column":19,"row":25}},{"noteOn":{"time":46.735,"column":19,"row":26}},{"noteOn":{"time":46.800,"column":19,"row":27}},{"noteOn":{"time":46.870,"column":19,"row":28}},{"noteOn":{"time":46.935,"column":19,"row":29}},{"noteOn":{"time":47.000,"column":20,"row":0}},{"noteOn":{"time":47.070,"column":20,"row":1}},{"noteOn":{"time":47.135,"column":20,"row":2}},{"noteOn":{"time":47.200,"column":20,"row":3}},{"noteOn":{"time":47.270,"column":20,"row":4}},{"noteOn":{"time":47.335,"column":20,"row":5}},{"noteOn":{"time":47.400,"column":20,"row":6}},{"noteOn":{"time":47.470,"column":20,"row":7}},{"noteOn":{"time":47.535,"column":20,"row":8}},{"noteOn":{"time":47.600,"column":20,"row":9}},{"noteOn":{"time":47.670,"column":20,"row":10}},{"noteOn":{"time":47.735,"column":20,"row":11}},{"noteOn":{"time":47.800,"column":20,"row":12}},{"noteOn":{"time":47.870,"column":20,"row":13}},{"noteOn":{"time":47.935,"column":20,"row":14}},{"noteOn":{"time":48.000,"column":20,"row":15}},{"noteOn":{"time":48.070,"column":20,"row":16}},{"noteOn":{"time":48.135,"column":20,"row":17}},{"noteOn":{"time":48.200,"column":20,"row":18}},{"noteOn":{"time":48.270,"column":20,"row":19}},{"noteOn":{"time":48.335,"column":20,"row":20}},{"noteOn":{"time":48.400,"column":20,"row":21}},{"noteOn":{"time":48.470,"column":20,"row":22}},{"noteOn":{"time":48.535,"column":20,"row":23}},{"noteOn":{"time":48.600,"column":20,"row":24}},{"noteOn":{"time":48.670,"column":20,"row":25}},{"noteOn":{"time":48.735,"column":20,"row":26}},{"noteOn":{"time":48.800,"column":20,"row":27}},{"noteOn":{"time":48.870,"column":20,"row":28}},{"noteOn":{"time":48.935,"column":20,"row":29}},{"noteOn":{"time":49.000,"column":21,"row":0}},{"noteOn":{"time":49.070,"column":21,"row":1}},{"noteOn":{"time":49.135,"column":21,"row":2}},{"noteOn":{"time":49.200,"column":21,"row":3}},{"noteOn":{"time":49.270,"column":21,"row":4}},{"noteOn":{"time":49.335,"column":21,"row":5}},{"noteOn":{"time":49.400,"column":21,"row":6}},{"noteOn":{"time":49.470,"column":21,"row":7}},{"noteOn":{"time":49.535,"column":21,"row":8}},{"noteOn":{"time":49.600,"column":21,"row":9}},{"noteOn":{"time":49.670,"column":21,"row":10}},{"noteOn":{"time":49.735,"column":21,"row":11}},{"noteOn":{"time":49.800,"column":21,"row":12}},{"noteOn":{"time":49.870,"column":21,"row":13}},{"noteOn":{"time":49.935,"column":21,"row":14}},{"noteOn":{"time":50.000,"column":21,"row":15}},{"noteOn":{"time":50.070,"column":21,"row":16}},{"noteOn":{"time":50.135,"column":21,"row":17}},{"noteOn":{"time":50.200,"column":21,"row":18}},{"noteOn":{"time":50.270,"column":21,"row":19}},{"noteOn":{"time":50.335,"column":21,"row":20}},{"noteOn":{"time":50.400,"column":21,"row":21}},{"noteOn":{"time":50.470,"column":21,"row":22}},{"noteOn":{"time":50.535,"column":21,"row":23}},{"noteOn":{"time":50.600,"column":21,"row":24}},{"noteOn":{"time":50.670,"column":21,"row":25}},{"noteOn":{"time":50.735,"column":21,"row":26}},{"noteOn":{"time":50.800,"column":21,"row":27}},{"noteOn":{"time":50.870,"column":21,"row":28}},{"noteOn":{"time":50.935,"column":21,"row":29}},{"noteOn":{"time":51.000,"column":22,"row":0}},{"noteOn":{"time":51.070,"column":22,"row":1}},{"noteOn":{"time":51.135,"column":22,"row":2}},{"noteOn":{"time":51.200,"column":22,"row":3}},{"noteOn":{"time":51.270,"column":22,"row":4}},{"noteOn":{"time":51.335,"column":22,"row":5}},{"noteOn":{"time":51.400,"column":22,"row":6}},{"noteOn":{"time":51.470,"column":22,"row":7}},{"noteOn":{"time":51.535,"column":22,"row":8}},{"noteOn":{"time":51.600,"column":22,"row":9}},{"noteOn":{"time":51.670,"column":22,"row":10}},{"noteOn":{"time":51.735,"column":22,"row":11}},{"noteOn":{"time":51.800,"column":22,"row":12}},{"noteOn":{"time":51.870,"column":22,"row":13}},{"noteOn":{"time":51.935,"column":22,"row":14}},{"noteOn":{"time":52.000,"column":22,"row":15}},{"noteOn":{"time":52.070,"column":22,"row":16}},{"noteOn":{"time":52.135,"column":22,"row":17}},{"noteOn":{"time":52.200,"column":22,"row":18}},{"noteOn":{"time":52.270,"column":22,"row":19}},{"noteOn":{"time":52.335,"column":22,"row":20}},{"noteOn":{"time":52.400,"column":22,"row":21}},{"noteOn":{"time":52.470,"column":22,"row":22}},{"noteOn":{"time":52.535,"column":22,"row":23}},{"noteOn":{"time":52.600,"column":22,"row":24}},{"noteOn":{"time":52.670,"column":22,"row":25}},{"noteOn":{"time":52.735,"column":22,"row":26}},{"noteOn":{"time":52.800,"column":22,"row":27}},{"noteOn":{"time":52.870,"column":22,"row":28}},{"noteOn":{"time":52.935,"column":22,"row":29}},{"noteOn":{"time":53.000,"column":23,"row":0}},{"noteOn":{"time":53.070,"column":23,"row":1}},{"noteOn":{"time":53.135,"column":23,"row":2}},{"noteOn":{"time":53.200,"column":23,"row":3}},{"noteOn":{"time":53.270,"column":23,"row":4}},{"noteOn":{"time":53.335,"column":23,"row":5}},{"noteOn":{"time":53.400,"column":23,"row":6}},{"noteOn":{"time":53.470,"column":23,"row":7}},{"noteOn":{"time":53.535,"column":23,"row":8}},{"noteOn":{"time":53.600,"column":23,"row":9}},{"noteOn":{"time":53.670,"column":23,"row":10}},{"noteOn":{"time":53.735,"column":23,"row":11}},{"noteOn":{"time":53.800,"column":23,"row":12}},{"noteOn":{"time":53.870,"column":23,"row":13}},{"noteOn":{"time":53.935,"column":23,"row":14}},{"noteOn":{"time":54.000,"column":23,"row":15}},{"noteOn":{"time":54.070,"column":23,"row":16}},{"noteOn":{"time":54.135,"column":23,"row":17}},{"noteOn":{"time":54.200,"column":23,"row":18}},{"noteOn":{"time":54.270,"column":23,"row":19}},{"noteOn":{"time":54.335,"column":23,"row":20}},{"noteOn":{"time":54.400,"column":23,"row":21}},{"noteOn":{"time":54.470,"column":23,"row":22}},{"noteOn":{"time":54.535,"column":23,"row":23}},{"noteOn":{"time":54.600,"column":23,"row":24}},{"noteOn":{"time":54.670,"column":23,"row":25}},{"noteOn":{"time":54.735,"column":23,"row":26}},{"noteOn":{"time":54.800,"column":23,"row":27}},{"noteOn":{"time":54.870,"column":23,"row":28}},{"noteOn":{"time":54.935,"column":23,"row":29}},{"noteOn":{"time":55.000,"column":24,"row":0}},{"noteOn":{"time":55.070,"column":24,"row":1}},{"noteOn":{"time":55.135,"column":24,"row":2}},{"noteOn":{"time":55.200,"column":24,"row":3}},{"noteOn":{"time":55.270,"column":24,"row":4}},{"noteOn":{"time":55.335,"column":24,"row":5}},{"noteOn":{"time":55.400,"column":24,"row":6}},{"noteOn":{"time":55.470,"column":24,"row":7}},{"noteOn":{"time":55.535,"column":24,"row":8}},{"noteOn":{"time":55.600,"column":24,"row":9}},{"noteOn":{"time":55.670,"column":24,"row":10}},{"noteOn":{"time":55.735,"column":24,"row":11}},{"noteOn":{"time":55.800,"column":24,"row":12}},{"noteOn":{"time":55.870,"column":24,"row":13}},{"noteOn":{"time":55.935,"column":24,"row":14}},{"noteOn":{"time":56.000,"column":24,"row":15}},{"noteOn":{"time":56.070,"column":24,"row":16}},{"noteOn":{"time":56.135,"column":24,"row":17}},{"noteOn":{"time":56.200,"column":24,"row":18}},{"noteOn":{"time":56.270,"column":24,"row":19}},{"noteOn":{"time":56.335,"column":24,"row":20}},{"noteOn":{"time":56.400,"column":24,"row":21}},{"noteOn":{"time":56.470,"column":24,"row":22}},{"noteOn":{"time":56.535,"column":24,"row":23}},{"noteOn":{"time":56.600,"column":24,"row":24}},{"noteOn":{"time":56.670,"column":24,"row":25}},{"noteOn":{"time":56.735,"column":24,"row":26}},{"noteOn":{"time":56.800,"column":24,"row":27}},{"noteOn":{"time":56.870,"column":24,"row":28}},{"noteOn":{"time":56.935,"column":24,"row":29}},{"noteOn":{"time":57.000,"column":25,"row":0}},{"noteOn":{"time":57.070,"column":25,"row":1}},{"noteOn":{"time":57.135,"column":25,"row":2}},{"noteOn":{"time":57.200,"column":25,"row":3}},{"noteOn":{"time":57.270,"column":25,"row":4}},{"noteOn":{"time":57.335,"column":25,"row":5}},{"noteOn":{"time":57.400,"column":25,"row":6}},{"noteOn":{"time":57.470,"column":25,"row":7}},{"noteOn":{"time":57.535,"column":25,"row":8}},{"noteOn":{"time":57.600,"column":25,"row":9}},{"noteOn":{"time":57.670,"column":25,"row":10}},{"noteOn":{"time":57.735,"column":25,"row":11}},{"noteOn":{"time":57.800,"column":25,"row":12}},{"noteOn":{"time":57.870,"column":25,"row":13}},{"noteOn":{"time":57.935,"column":25,"row":14}},{"noteOn":{"time":58.000,"column":25,"row":15}},{"noteOn":{"time":58.070,"column":25,"row":16}},{"noteOn":{"time":58.135,"column":25,"row":17}},{"noteOn":{"time":58.200,"column":25,"row":18}},{"noteOn":{"time":58.270,"column":25,"row":19}},{"noteOn":{"time":58.335,"column":25,"row":20}},{"noteOn":{"time":58.400,"column":25,"row":21}},{"noteOn":{"time":58.470,"column":25,"row":22}},{"noteOn":{"time":58.535,"column":25,"row":23}},{"noteOn":{"time":58.600,"column":25,"row":24}},{"noteOn":{"time":58.670,"column":25,"row":25}},{"noteOn":{"time":58.735,"column":25,"row":26}},{"noteOn":{"time":58.800,"column":25,"row":27}},{"noteOn":{"time":58.870,"column":25,"row":28}},{"noteOn":{"time":58.935,"column":25,"row":29}},{"noteOn":{"time":59.000,"column":26,"row":0}},{"noteOn":{"time":59.070,"column":26,"row":1}},{"noteOn":{"time":59.135,"column":26,"row":2}},{"noteOn":{"time":59.200,"column":26,"row":3}},{"noteOn":{"time":59.270,"column":26,"row":4}},{"noteOn":{"time":59.335,"column":26,"row":5}},{"noteOn":{"time":59.400,"column":26,"row":6}},{"noteOn":{"time":59.470,"column":26,"row":7}},{"noteOn":{"time":59.535,"column":26,"row":8}},{"noteOn":{"time":59.600,"column":26,"row":9}},{"noteOn":{"time":59.670,"column":26,"row":10}},{"noteOn":{"time":59.735,"column":26,"row":11}},{"noteOn":{"time":59.800,"column":26,"row":12}},{"noteOn":{"time":59.870,"column":26,"row":13}},{"noteOn":{"time":59.935,"column":26,"row":14}},{"noteOn":{"time":60.000,"column":26,"row":15}},{"noteOn":{"time":60.070,"column":26,"row":16}},{"noteOn":{"time":60.135,"column":26,"row":17}},{"noteOn":{"time":60.200,"column":26,"row":18}},{"noteOn":{"time":60.270,"column":26,"row":19}},{"noteOn":{"time":60.335,"column":26,"row":20}},{"noteOn":{"time":60.400,"column":26,"row":21}},{"noteOn":{"time":60.470,"column":26,"row":22}},{"noteOn":{"time":60.535,"column":26,"row":23}},{"noteOn":{"time":60.600,"column":26,"row":24}},{"noteOn":{"time":60.670,"column":26,"row":25}},{"noteOn":{"time":60.735,"column":26,"row":26}},{"noteOn":{"time":60.800,"column":26,"row":27}},{"noteOn":{"time":60.870,"column":26,"row":28}},{"noteOn":{"time":60.935,"column":26,"row":29}},{"noteOn":{"time":61.000,"column":27,"row":0}},{"noteOn":{"time":61.070,"column":27,"row":1}},{"noteOn":{"time":61.135,"column":27,"row":2}},{"noteOn":{"time":61.200,"column":27,"row":3}},{"noteOn":{"time":61.270,"column":27,"row":4}},{"noteOn":{"time":61.335,"column":27,"row":5}},{"noteOn":{"time":61.400,"column":27,"row":6}},{"noteOn":{"time":61.470,"column":27,"row":7}},{"noteOn":{"time":61.535,"column":27,"row":8}},{"noteOn":{"time":61.600,"column":27,"row":9}},{"noteOn":{"time":61.670,"column":27,"row":10}},{"noteOn":{"time":61.735,"column":27,"row":11}},{"noteOn":{"time":61.800,"column":27,"row":12}},{"noteOn":{"time":61.870,"column":27,"row":13}},{"noteOn":{"time":61.935,"column":27,"row":14}},{"noteOn":{"time":62.000,"column":27,"row":15}},{"noteOn":{"time":62.070,"column":27,"row":16}},{"noteOn":{"time":62.135,"column":27,"row":17}},{"noteOn":{"time":62.200,"column":27,"row":18}},{"noteOn":{"time":62.270,"column":27,"row":19}},{"noteOn":{"time":62.335,"column":27,"row":20}},{"noteOn":{"time":62.400,"column":27,"row":21}},{"noteOn":{"time":62.470,"column":27,"row":22}},{"noteOn":{"time":62.535,"column":27,"row":23}},{"noteOn":{"time":62.600,"column":27,"row":24}},{"noteOn":{"time":62.670,"column":27,"row":25}},{"noteOn":{"time":62.735,"column":27,"row":26}},{"noteOn":{"time":62.800,"column":27,"row":27}},{"noteOn":{"time":62.870,"column":27,"row":28}},{"noteOn":{"time":62.935,"column":27,"row":29}},{"noteOn":{"time":63.000,"column":28,"row":0}},{"noteOn":{"time":63.070,"column":28,"row":1}},{"noteOn":{"time":63.135,"column":28,"row":2}},{"noteOn":{"time":63.200,"column":28,"row":3}},{"noteOn":{"time":63.270,"column":28,"row":4}},{"noteOn":{"time":63.335,"column":28,"row":5}},{"noteOn":{"time":63.400,"column":28,"row":6}},{"noteOn":{"time":63.470,"column":28,"row":7}},{"noteOn":{"time":63.535,"column":28,"row":8}},{"noteOn":{"time":63.600,"column":28,"row":9}},{"noteOn":{"time":63.670,"column":28,"row":10}},{"noteOn":{"time":63.735,"column":28,"row":11}},{"noteOn":{"time":63.800,"column":28,"row":12}},{"noteOn":{"time":63.870,"column":28,"row":13}},{"noteOn":{"time":63.935,"column":28,"row":14}},{"noteOn":{"time":64.000,"column":28,"row":15}},{"noteOn":{"time":64.070,"column":28,"row":16}},{"noteOn":{"time":64.135,"column":28,"row":17}},{"noteOn":{"time":64.200,"column":28,"row":18}},{"noteOn":{"time":64.270,"column":28,"row":19}},{"noteOn":{"time":64.335,"column":28,"row":20}},{"noteOn":{"time":64.400,"column":28,"row":21}},{"noteOn":{"time":64.470,"column":28,"row":22}},{"noteOn":{"time":64.535,"column":28,"row":23}},{"noteOn":{"time":64.600,"column":28,"row":24}},{"noteOn":{"time":64.670,"column":28,"row":25}},{"noteOn":{"time":64.735,"column":28,"row":26}},{"noteOn":{"time":64.800,"column":28,"row":27}},{"noteOn":{"time":64.870,"column":28,"row":28}},{"noteOn":{"time":64.935,"column":28,"row":29}},{"noteOn":{"time":65.000,"column":29,"row":0}},{"noteOn":{"time":65.070,"column":29,"row":1}},{"noteOn":{"time":65.135,"column":29,"row":2}},{"noteOn":{"time":65.200,"column":29,"row":3}},{"noteOn":{"time":65.270,"column":29,"row":4}},{"noteOn":{"time":65.335,"column":29,"row":5}},{"noteOn":{"time":65.400,"column":29,"row":6}},{"noteOn":{"time":65.470,"column":29,"row":7}},{"noteOn":{"time":65.535,"column":29,"row":8}},{"noteOn":{"time":65.600,"column":29,"row":9}},{"noteOn":{"time":65.670,"column":29,"row":10}},{"noteOn":{"time":65.735,"column":29,"row":11}},{"noteOn":{"time":65.800,"column":29,"row":12}},{"noteOn":{"time":65.870,"column":29,"row":13}},{"noteOn":{"time":65.935,"column":29,"row":14}},{"noteOn":{"time":66.000,"column":29,"row":15}},{"noteOn":{"time":66.070,"column":29,"row":16}},{"noteOn":{"time":66.135,"column":29,"row":17}},{"noteOn":{"time":66.200,"column":29,"row":18}},{"noteOn":{"time":66.270,"column":29,"row":19}},{"noteOn":{"time":66.335,"column":29,"row":20}},{"noteOn":{"time":66.400,"column":29,"row":21}},{"noteOn":{"time":66.470,"column":29,"row":22}},{"noteOn":{"time":66.535,"column":29,"row":23}},{"noteOn":{"time":66.600,"column":29,"row":24}},{"noteOn":{"time":66.670,"column":29,"row":25}},{"noteOn":{"time":66.735,"column":29,"row":26}},{"noteOn":{"time":66.800,"column":29,"row":27}},{"noteOn":{"time":66.870,"column":29,"row":28}},{"noteOn":{"time":66.935,"column":29,"row":29}}]}
        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
