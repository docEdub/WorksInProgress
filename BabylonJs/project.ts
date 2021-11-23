import * as BABYLON from "babylonjs";
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
    const slowCameraSpeed = 0.25
    const fastCameraSpeed = 1.5
    const csoundCameraUpdatesPerSecond = 10;
    const csoundIoBufferSize = 128;
    const groundSize = 9000;
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

    if (document.getElementById('csound-script') === null) {
        let csoundImportScript = document.createElement('script');
        csoundImportScript.type = 'module'
        csoundImportScript.innerText = `
            console.debug("Csound importing ...");
            import { Csound } from "https://unpkg.com/@doc.e.dub/csound-browser@6.17.0-beta5/dist/csound.esm.js";
            document.Csound = Csound;
        `
        // csoundImportScript.innerText = `
        //     console.debug("Csound importing ...");
        //     import { Csound } from "./csound.esm.js";
        //     document.Csound = Csound;
        // `
        document.body.appendChild(csoundImportScript)
    }

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

    let svgTextureCount = 0

    const createSvgTexture = (svg) => {
        // Setting a unique name is required otherwise the first texture created gets used all the time.
        // See https://forum.babylonjs.com/t/why-does-2nd-texture-use-first-svg/23975.
        svgTextureCount++
        const name = svgTextureCount.toString()
        const texture = BABYLON.Texture.LoadFromDataString(name, 'data:image/svg+xml;base64,' + window.btoa(svg), scene)
        texture.onLoadObservable.addOnce(() => {
            texture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE)
        })
        return texture
    }

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);
    if (showBabylonInspector) {
        scene.debugLayer.show()
    }

    const skyBrightness = 0.05
    scene.clearColor.set(skyBrightness, skyBrightness, skyBrightness, 1)

    const cameraSettings = [
        // 0
        { position: new BABYLON.Vector3(0, 2, -10), target: new BABYLON.Vector3(0, 2, 0) },
        // 1
        { position: new BABYLON.Vector3(500, 2, 500), target: new BABYLON.Vector3(-50, 300, 0) },
        // 2
        { position: new BABYLON.Vector3(halfGroundSize, 2, halfGroundSize), target: new BABYLON.Vector3(-50, 300, 0) },
        // 3
        { position: new BABYLON.Vector3(-halfGroundSize, 2, -halfGroundSize), target: new BABYLON.Vector3(-50, 300, 0) },
        // 4
        { position: new BABYLON.Vector3(-80, 2, 800), target: new BABYLON.Vector3(0, 200, 0) },
        // 5
        { position: new BABYLON.Vector3(-40, 2, 400), target: new BABYLON.Vector3(225, 180, 0) },
        // 6
        { position: new BABYLON.Vector3(0, 2, -100), target: new BABYLON.Vector3(0, 180, 0) },
        // 7: Safari mixdown location.
        { position: new BABYLON.Vector3(0, 2, 335), target: new BABYLON.Vector3(0, 135, 0) }
    ]
    const cameraSetting = cameraSettings[7]

    let camera = new BABYLON.FreeCamera('', cameraSetting.position, scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = slowCameraSpeed;
    camera.attachControl(canvas, true);
    camera.setTarget(cameraSetting.target);

    // For full list see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode.
    const KeyCode = {
        W: 87,
        A: 65,
        S: 83,
        D: 68,
        CapsLock: 20,
        Shift: 16,
        Space: 32
    }
    camera.keysUp.push(KeyCode.W)
    camera.keysLeft.push(KeyCode.A)
    camera.keysDown.push(KeyCode.S)
    camera.keysRight.push(KeyCode.D)

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
    ground.checkCollisions = true

    if (showGroundGrid) {
        const grid_Texture = createSvgTexture(`
            <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
                <rect width="100%" height="100%" style="fill: none; stroke: white; stroke-width: 4;" />
            </svg>
        `)
        grid_Texture.uScale = grid_Texture.vScale = groundSize / 10
        const gridMaterial = new BABYLON.StandardMaterial('', scene)
        gridMaterial.emissiveColor.set(0.333, 0.333, 0.333)
        gridMaterial.ambientTexture = grid_Texture
        // gridMaterial.opacityTexture = grid_Texture
        gridMaterial.disableLighting = true
        ground.material = gridMaterial;
    }
    else {
        ground.material = blackMaterial;
    }
    
    // This gets updated when switching between flat-screen camera and XR camera.
    let currentCamera = camera

    const startXr = async () => {
        try {
            const xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [ ground ]});
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
                    BABYLON.Engine.audioEngine.unlock()
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

    let groundBubbleSynth_NoteOnIndex = 1
    let groundBubbleSynth_IsResetting = false
    const groundBubbleSynth_Reset = () => {
        console.debug('groundBubbleSynth_Reset called')
        groundBubbleSynth_NoteOnIndex = 1
        groundBubbleSynth_IsResetting = true
    }

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
                    instanceMatrixes: [ instanceMatrix1, instanceMatrix2, instanceMatrix3 ],
                    isOn: false
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
                        if (delay.isOn) {
                            distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[0], delay.instanceMatrixes[0], false)
                            distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[1], delay.instanceMatrixes[1], false)
                            distanceDelaySynthMesh.thinInstanceSetMatrixAt(delay.instanceIndexes[2], delay.instanceMatrixes[2], true)
                            const glowInstances = distanceDelaySynth_GlowNoteInstances[delay.glowInstanceIndex]
                            distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index1, zeroScalingMatrix, false)
                            distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index2, zeroScalingMatrix, false)
                            distanceDelaySynthGlowMesh.thinInstanceSetMatrixAt(glowInstances.index3, zeroScalingMatrix, true)
                            delay.isOn = false
                        }
                        delay.offIndex++
                    }

                    while (delay.onIndex < delay.onTimes.length && delay.onTimes[delay.onIndex] <= time) {
                        if (time < delay.offTimes[delay.onIndex]) {
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
                            delay.isOn = true
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
            noteOn.isOn = false

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

        const pointSynth_Texture = createSvgTexture(`
            <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
                <circle cx="64" cy="64" r="64" fill="white" />
            </svg>
        `)

        const noteMeshInstanceCount = 40;
        let noteMeshInstanceIndex = 0;
        let noteMeshInstances = [];
        const noteMesh = BABYLON.Mesh.CreateIcoSphere('', { radius: 1, subdivisions: 1 }, scene);
        const noteMaterial = new BABYLON.StandardMaterial('', scene)
        noteMaterial.emissiveColor.set(1, 1, 1)
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

            note.isOn = true
        }

        const pointSynthNoteOff = (i) => {
            const note = pointSynthData[i].noteOn;
            if (note.isOn) {
                noteMeshInstances[note.instanceIndex].isVisible = false;
                note.isOn = false
            }
        }

        const resetPointSynthIndexes = () => {
            nextPointSynthNoteOnIndex = pointSynthNoteStartIndex;
            nextPointSynthNoteOffIndex = pointSynthNoteStartIndex;
        }

        const pointSynthRender = (time) => {
            while (nextPointSynthNoteOnIndex < pointSynthData.length
                    && pointSynthData[nextPointSynthNoteOnIndex].noteOn.time <= time) {
                if (time < pointSynthData[nextPointSynthNoteOffIndex].noteOn.offTime) {
                    pointSynthNoteOn(nextPointSynthNoteOnIndex);
                }
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

        const groundBubbleSynth_Texture = createSvgTexture(`
            <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
                <radialGradient id="gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stop-color="#000" stop-opacity="0" />
                    <stop offset="50%" stop-color="#000" stop-opacity="0" />
                    <stop offset="75%" stop-color="#fff" stop-opacity="1" />
                    <stop offset="100%" stop-color="#000" stop-opacity="0" />
                </radialGradient>
                <circle cx="50%" cy="50%" r="50%" fill="url('#gradient')" />
                <circle cx="50%" cy="50%" r="10%" fill="#fff" />
            </svg>
        `)

        const groundBubbleSynth_Material = new BABYLON.StandardMaterial('', scene)
        groundBubbleSynth_Material.emissiveColor.set(1, 1, 1)
        groundBubbleSynth_Material.ambientTexture = groundBubbleSynth_Texture
        groundBubbleSynth_Material.opacityTexture = groundBubbleSynth_Texture
        groundBubbleSynth_Material.disableLighting = true

        const groundBubbleSynth_Data = csdData['9037b759-36e4-4600-b2cb-03383ebd65c1']
        const groundBubbleSynth_DataHeader = groundBubbleSynth_Data[0]

        const groundBubbleSynth_StartColor = .333
        const groundBubbleSynth_Diameter = 2
        const groundBubbleSynth_GridCountX = groundBubbleSynth_DataHeader.gridColumnCount
        const groundBubbleSynth_GridCountZ = groundBubbleSynth_DataHeader.gridRowCount
        const groundBubbleSynth_GridCellCount = groundBubbleSynth_GridCountX * groundBubbleSynth_GridCountZ
        const groundBubbleSynth_GridCellSize = groundBubbleSynth_DataHeader.gridCellSize
        const groundBubbleSynth_SpanX = groundBubbleSynth_GridCountX * groundBubbleSynth_GridCellSize
        const groundBubbleSynth_SpanZ = groundBubbleSynth_GridCountZ * groundBubbleSynth_GridCellSize
        const groundBubbleSynth_HalfSpanX = groundBubbleSynth_SpanX / 2
        const groundBubbleSynth_HalfSpanZ = groundBubbleSynth_SpanZ / 2
        const groundBubbleSynth_StartY = 0.01
        const groundBubbleSynth_FadeStartY = groundBubbleSynth_DataHeader.maxHeight * 2
        const groundBubbleSynth_FadeRangeY = 50
        const groundBubbleSynth_RotationStartX = Math.PI / 2

        const groundBubbleSynth_ParticleAnimationY = []

        const groundBubbleSynth_Mesh = BABYLON.MeshBuilder.CreatePlane('', {
            size: groundBubbleSynth_Diameter
        })
        groundBubbleSynth_Mesh.rotation.x = groundBubbleSynth_RotationStartX
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
                    particle.color.set(groundBubbleSynth_StartColor, groundBubbleSynth_StartColor, groundBubbleSynth_StartColor, 1)
                    particle.position.set(x, groundBubbleSynth_StartY, z)
                    particle.rotation.x = groundBubbleSynth_RotationStartX
                    groundBubbleSynth_ParticleAnimationY[i].push({ started: false, x: x, z: z })
                    // groundBubbleSynth_ParticleAnimationY[i].push({ started: true, x: x, z: z })
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
            if (groundBubbleSynth_IsResetting) {
                particle.position.y = groundBubbleSynth_StartY
                particle.rotation.x = groundBubbleSynth_RotationStartX
                animation.started = false
            }
            else if (animation.started) {
                particle.position.y = particle.position.y + groundBubbleSynth_SpeedY * groundBubbleSynth_DeltaTime
                billboardNode.position = particle.position
                billboardNode.lookAt(currentCamera.position, 0, Math.PI, Math.PI, BABYLON.Space.WORLD)
                let rotationX = billboardNode.rotation.x
                let rotationZ = billboardNode.rotation.z
                if (particle.position.y < fullBillboardHeight) {
                    const rotationAmount = 1 - particle.position.y / fullBillboardHeight
                    rotationX = billboardNode.rotation.x + rotationAmount * groundBubbleSynth_RotationStartX
                    rotationZ = billboardNode.rotation.z
                }
                particle.rotation.set(rotationX, billboardNode.rotation.y, rotationZ)
                const fadeInMultiplier = (fullBillboardHeight - particle.position.y) / fullBillboardHeight
                if (fadeInMultiplier >= 0 && fadeInMultiplier < 1) {
                    const color = groundBubbleSynth_StartColor + (1 - fadeInMultiplier) * (1 - groundBubbleSynth_StartColor)
                    particle.color.set(color, color, color, 1)
                    if (particle.position.x == 0 && particle.position.z == 0) {
                        console.debug('particle: y =', particle.position.y, ', color =', color)
                    }
                }
                else {
                    const fadeOutOffset = particle.position.y - groundBubbleSynth_FadeStartY
                    if (fadeOutOffset > 0) {
                        particle.scale.setAll(1 - fadeOutOffset / groundBubbleSynth_FadeRangeY);
                        if (fadeOutOffset > groundBubbleSynth_FadeRangeY) {
                            animation.started = false
                        }
                    }
                }
            }
            else if (particle.position.y == groundBubbleSynth_StartY && particle.scale.x < 1) {
                // Reset color.
                particle.color.set(groundBubbleSynth_StartColor, groundBubbleSynth_StartColor, groundBubbleSynth_StartColor, 1)
                // Increase scale until it reaches 1.
                particle.scale.setAll(Math.min(particle.scale.x + 0.1 * groundBubbleSynth_DeltaTime, 1));
            }
            return particle
        }

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
            groundBubbleSynth_IsResetting = false
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

        let keyIsDown = {}

        const updateCameraSpeed = () => {
            if (keyIsDown[KeyCode.CapsLock] || keyIsDown[KeyCode.Shift] || keyIsDown[KeyCode.Space]) {
                camera.speed = fastCameraSpeed
            }
            else {
                camera.speed = slowCameraSpeed
            }
        }

        const onInputEvent = (e) => {
            keyIsDown[KeyCode.CapsLock] = e.getModifierState("CapsLock")
            keyIsDown[KeyCode.Shift] = e.getModifierState("Shift")
        }

        const onKeyDown = (e) => {
            // console.log('key', e.keyCode, 'down')
            if (animateCamera && cameraUsesInputKey(e.keyCode)) {
                unlockCameraPosition()
            }
            keyIsDown[e.keyCode] = true
            onInputEvent(e)
            updateCameraSpeed()
        }

        const onKeyUp = (e) => {
            // console.log('key', e.keyCode, 'up')
            keyIsDown[e.keyCode] = false
            onInputEvent(e)
            updateCameraSpeed()
        }

        let pointerIsDown = false

        const onPointerDown = (e) => {
            onInputEvent(e)
            if (e.button !== 0) {
                return;
            }
            pointerIsDown = true
        }
    
        const onPointerUp = (e) => {
            onInputEvent(e)
            pointerIsDown = false
        }
    
        const onPointerMove = (e) => {
            onInputEvent(e)
            if (animateCamera && !cameraTargetIsUserDefined && pointerIsDown) {
                unlockCameraTarget()
            }
        }


        document.addEventListener("keydown", onKeyDown, false)
        document.addEventListener("keyup", onKeyUp, false)
    
        if (animateCamera) {
            canvas.addEventListener("pointerdown", onPointerDown, false)
            canvas.addEventListener("pointerup", onPointerUp, false)
            document.addEventListener("pointermove", onPointerMove, false)
        }

        const unlockCameraPosition = () => {
            animateCamera = false
            canvas.removeEventListener("pointerdown", onPointerDown)
            canvas.removeEventListener("pointerup", onPointerUp)
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
        groundBubbleSynth_Reset()
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
                // isCsoundStarted = true
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
        await csound.setOption('--omacro:IS_ANIMATIONS_ONLY=1')
        await csound.setOption('--omacro:IS_GENERATING_JSON=1')
        await csound.setOption('--smacro:IS_GENERATING_JSON=1')
        if (!csound.fs.existsSync('sandbox')) {
            csound.fs.mkdirSync('sandbox')
        }
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
        await csound.start()
        await csound.pause()
        console.time('csound.perform()')
        await csound.perform()
        console.timeEnd('csound.perform()')
        // console.log(csound.fs.readdirSync('/sandbox'))
    }

    const csdText = `
    <CsoundSynthesizer>
    <CsOptions>
    --messagelevel=0
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
    #ifndef IS_ANIMATIONS_ONLY
    sr = 48000
    kr = 200
    #else
    sr = 30
    kr = 30
    #end
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
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Y],
    sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Z] * k_direction[$Z])) * $AF_MATH__RADIANS_TO_DEGREES
    AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
    endop
    opcode AF_3D_Audio_ChannelGains, 0, k[]kp
    k_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
    k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
    k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
    k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Y],
    sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Z] * k_direction[$Z])) * $AF_MATH__RADIANS_TO_DEGREES
    AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
    endop
    opcode AF_3D_Audio_ChannelGains_XYZ, 0, kkkPp
    k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin
    k_direction[] init 3
    k_direction[$X] = k_sourcePositionX - gk_AF_3D_ListenerPosition[$X]
    k_direction[$Y] = k_sourcePositionY - gk_AF_3D_ListenerPosition[$Y]
    k_direction[$Z] = k_sourcePositionZ - gk_AF_3D_ListenerPosition[$Z]
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Y],
    sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Z] * k_direction[$Z])) * $AF_MATH__RADIANS_TO_DEGREES
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
    #ifndef IS_ANIMATIONS_ONLY
    event_i("i", 3, 0, -1)
    event_i("i", 7, 1, -1)
    event_i("i", 11, 1, -1)
    #end
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
    ; fprints("DawPlayback.json", "[")
    endin
    instr EndJsonArray
    turnoff
    ; fprints("DawPlayback.json", "]")
    endin
    instr StartJsonObject
    turnoff
    ; fprints("DawPlayback.json", "{")
    endin
    instr EndJsonObject
    turnoff
    ; fprints("DawPlayback.json", "}")
    endin
    instr GeneratePluginJson
    turnoff
    ; SPluginUuid = strget(p4)
    ; if (giWriteComma == 1) then
    ; ; fprints("DawPlayback.json", ",")
    ; else
    ; giWriteComma = 1
    ; endif
    ; ; fprints("DawPlayback.json", sprintf("\\"%s\\":[", SPluginUuid))
    ; iI = 0
    ; iWriteComma = 0
    ; while (1 == 1) do
    ; SFileName = sprintf("/sandbox/%s.%d.json", SPluginUuid, iI)
    ; iJ = 0
    ; while (iJ != -1) do
    ; ; prints("Reading %s\\n", SFileName)
    ; SLine, iJ readfi SFileName
    ; if (iJ > 0) then
    ; prints("%s:%d = %s\\n", SFileName, iJ, SLine)
    ; endif
    ; ficlose(SFileName)
    ; if (iJ == -1) then
    ; else
    ; if (iWriteComma == 1) then
    ; ; fprints("DawPlayback.json", ",")
    ; else
    ; iWriteComma = 1
    ; endif
    ; if (strcmp(strsub(SLine, strlen(SLine) - 1, strlen(SLine)), "\\n") == 0) then
    ; SLine = strsub(SLine, 0, strlen(SLine) - 1)
    ; endif
    ; ; fprints("DawPlayback.json", SLine)
    ; endif
    ; od
    ; iI += 1
    ; od
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
    giDistanceDelaySynth_RolloffFactor = 0.00075
    giDistanceDelaySynth_PlaybackVolumeAdjustment = 1
    giDistanceDelaySynth_PlaybackReverbAdjustment = 0.29
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
    ; SJsonFile = sprintf("%s.0.json", "6c9f37ab-392f-429b-8217-eac09f295362")
    ; fprints(SJsonFile, "{")
    ; fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
    ; fprints(SJsonFile, sprintf(",\\"startDistance\\":%d", giDistanceDelaySynth_StartDistance))
    ; fprints(SJsonFile, sprintf(",\\"delayDistance\\":%d", giDistanceDelaySynth_DelayDistance))
    ; fprints(SJsonFile, sprintf(",\\"noteNumberToHeightScale\\":%.02f", giDistanceDelaySynth_NoteNumberToHeightScale))
    ; fprints(SJsonFile, sprintf(",\\"delayTime\\":%.02f", giDistanceDelaySynth_DelayTime))
    ; fprints(SJsonFile, sprintf(",\\"duration\\":%.01f", giDistanceDelaySynth_Duration))
    ; fprints(SJsonFile, sprintf(",\\"delayCount\\":%d", giDistanceDelaySynth_DelayCount))
    ; fprints(SJsonFile, "}")
    SJson init ""
    SJson = strcat(SJson, "{")
    SJson = strcat(SJson, sprintf("\\"instanceName\\":\\"%s\\"", ""))
    SJson = strcat(SJson, sprintf(",\\"startDistance\\":%d", giDistanceDelaySynth_StartDistance))
    SJson = strcat(SJson, sprintf(",\\"delayDistance\\":%d", giDistanceDelaySynth_DelayDistance))
    SJson = strcat(SJson, sprintf(",\\"noteNumberToHeightScale\\":%.02f", giDistanceDelaySynth_NoteNumberToHeightScale))
    SJson = strcat(SJson, sprintf(",\\"delayTime\\":%.02f", giDistanceDelaySynth_DelayTime))
    SJson = strcat(SJson, sprintf(",\\"duration\\":%.01f", giDistanceDelaySynth_Duration))
    SJson = strcat(SJson, sprintf(",\\"delayCount\\":%d", giDistanceDelaySynth_DelayCount))
    SJson = strcat(SJson, "}\\n")
    prints(SJson)
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
    #ifndef IS_ANIMATIONS_ONLY
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
    iCps = cpsmidinn(iNoteNumber + 3)
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
    asig *= linen:a(1, 0.025, p3, 0.001)
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
    #end
    kY init (iNoteNumber - giDistanceDelaySynth_LowestNoteNumber) * giDistanceDelaySynth_NoteNumberToHeightScale
    iRadius = giDistanceDelaySynth_StartDistance + giDistanceDelaySynth_DelayDistance * iDelayIndex
    kRotationIndex = 0
    while (kRotationIndex < 3) do
    kTheta = 3.141592653589793 + (2 * 3.141592653589793 / 3) * kRotationIndex
    kX = sin(kTheta) * iRadius
    kZ = cos(kTheta) * iRadius
    #ifndef IS_ANIMATIONS_ONLY
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
    #end
    kRotationIndex += 1
    od
    #ifndef IS_ANIMATIONS_ONLY
    gaInstrumentSignals[0][0] = a1
    gaInstrumentSignals[0][1] = a2
    gaInstrumentSignals[0][2] = a3
    gaInstrumentSignals[0][3] = a4
    gaInstrumentSignals[0][4] = a5
    gaInstrumentSignals[0][5] = a5
    #end
    #ifdef IS_GENERATING_JSON
    if (iDelayIndex == 0) then
    if (giDistanceDelaySynth_NoteIndex[0] == 0) then
    scoreline_i("i \\"DistanceDelaySynth_Json\\" 0 0")
    endif
    giDistanceDelaySynth_NoteIndex[0] = giDistanceDelaySynth_NoteIndex[0] + 1
    ; SJsonFile = sprintf("%s.%d.json", "6c9f37ab-392f-429b-8217-eac09f295362", giDistanceDelaySynth_NoteIndex[0])
    ; fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%d,\\"velocity\\":%d}}",
    ; times(), iNoteNumber, iVelocity)
    ; ficlose(SJsonFile)
    prints("{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%d,\\"velocity\\":%d}}",
    times(), iNoteNumber, iVelocity)
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
    giPointSynth_DistanceMin = 1
    giPointSynth_DistanceMax = 500
    giPointSynth_ReferenceDistance = 5
    giPointSynth_RolloffFactor = 0.25
    giPointSynth_PlaybackVolumeAdjustment = 7.5
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
    iR = random(giPointSynth_DistanceMin, giPointSynth_DistanceMax)
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
    ; SJsonFile = sprintf("%s.0.json", "b4f7a35c-6198-422f-be6e-fa126f31b007")
    ; fprints(SJsonFile, "{")
    ; fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
    ; fprints(SJsonFile, sprintf(",\\"fadeInTime\\":%.02f", giFadeInTime))
    ; fprints(SJsonFile, sprintf(",\\"fadeOutTime\\":%.02f", giFadeOutTime))
    ; fprints(SJsonFile, ",\\"soundDistanceMin\\":%d", giPointSynth_DistanceMin)
    ; fprints(SJsonFile, ",\\"soundDistanceMax\\":%d", giPointSynth_DistanceMax)
    ; fprints(SJsonFile, "}")
    ; ficlose(SJsonFile)
    SJson init ""
    SJson = strcat(SJson, "{")
    SJson = strcat(SJson, sprintf("\\"instanceName\\":\\"%s\\"", ""))
    SJson = strcat(SJson, sprintf(",\\"fadeInTime\\":%.02f", giFadeInTime))
    SJson = strcat(SJson, sprintf(",\\"fadeOutTime\\":%.02f", giFadeOutTime))
    SJson = strcat(SJson, sprintf(",\\"soundDistanceMin\\":%d", giPointSynth_DistanceMin))
    SJson = strcat(SJson, sprintf(",\\"soundDistanceMax\\":%d", giPointSynth_DistanceMax))
    SJson = strcat(SJson, "}\\n")
    prints(SJson)
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
    iX init giPointSynthNextXYZ[0][giPointSynthNextXYZ_i][$X]
    iZ init giPointSynthNextXYZ[0][giPointSynthNextXYZ_i][$Z]
    iY init 50 + ((iNoteNumber - 80) / 25) * 300
    #ifndef IS_ANIMATIONS_ONLY
    iCps = cpsmidinn(iNoteNumber)
    iAmp = 0.05
    kCps = linseg(iCps, giTotalTime, iCps + 100)
    aOut = oscil(iAmp, kCps)
    aEnvelope = adsr_linsegr(giFadeInTime, 0, 1, giFadeOutTime)
    aOut *= aEnvelope
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
    #end
    #ifdef IS_GENERATING_JSON
    if (giPointSynth_NoteIndex[0] == 0) then
    scoreline_i("i \\"PointSynth_Json\\" 0 0")
    endif
    giPointSynth_NoteIndex[0] = giPointSynth_NoteIndex[0] + 1
    ; SJsonFile = sprintf("%s.%d.json", "b4f7a35c-6198-422f-be6e-fa126f31b007", giPointSynth_NoteIndex[0])
    ; fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"xyz\\":[%.3f,%.3f,%.3f]}}", times(),
    ; iNoteNumber, iX, iY, iZ)
    ; ficlose(SJsonFile)
    prints("{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"xyz\\":[%.3f,%.3f,%.3f]}}", times(),
    iNoteNumber, iX, iY, iZ)
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
    giGroundBubbleSynth_SpeedY = 15
    giGroundBubbleSynth_MaxAudibleDistance = 100
    giGroundBubbleSynth_MaxReverbOnlyDistance = giGroundBubbleSynth_MaxAudibleDistance * 2
    giGroundBubbleSynth_MaxAudibleHeight = giGroundBubbleSynth_MaxAudibleDistance
    giGroundBubbleSynth_MaxAmpWhenVeryClose = 1
    giGroundBubbleSynth_ReferenceDistance = 0.1
    giGroundBubbleSynth_RolloffFactor = 0.005
    giGroundBubbleSynth_PlaybackVolumeAdjustment = 0.9
    giGroundBubbleSynth_PlaybackReverbAdjustment = 1.5
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
    iAvailableCellIndexes[] init giGroundBubbleSynth_GridCellCount
    iAvailableCellIndexesCount init giGroundBubbleSynth_GridCellCount
    while (iCellIndex < iAvailableCellIndexesCount) do
    iAvailableCellIndexes[iCellIndex] = iCellIndex
    iCellIndex += 1
    od
    iCellIndex = 0
    while (iCellIndex < giGroundBubbleSynth_GridCellCount) do
    iRandomCellIndex = min(floor(random(0, iAvailableCellIndexesCount)), iAvailableCellIndexesCount)
    iRandomIndex = iAvailableCellIndexes[iRandomCellIndex]
    iColumnIndex = floor(iRandomIndex / giGroundBubbleSynth_GridColumnCount)
    iRowIndex = iRandomIndex % giGroundBubbleSynth_GridRowCount
    giGroundBubbleSynth_GridCellLaunchPattern[iCellIndex][0] = iColumnIndex
    giGroundBubbleSynth_GridCellLaunchPattern[iCellIndex][1] = iRowIndex
    iCellIndex += 1
    iI = iRandomCellIndex + 1
    while (iI < iAvailableCellIndexesCount) do
    iAvailableCellIndexes[iI - 1] = iAvailableCellIndexes[iI]
    iI += 1
    od
    iAvailableCellIndexesCount -= 1
    od
    #ifdef IS_GENERATING_JSON
    setPluginUuid(2, 0, "9037b759-36e4-4600-b2cb-03383ebd65c1")
    instr GroundBubbleSynth_Json
    ; SJsonFile = sprintf("%s.0.json", "9037b759-36e4-4600-b2cb-03383ebd65c1")
    ; fprints(SJsonFile, "{")
    ; fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
    ; fprints(SJsonFile, sprintf(",\\"duration\\":%d", giGroundBubbleSynth_Duration))
    ; fprints(SJsonFile, sprintf(",\\"gridColumnCount\\":%d", giGroundBubbleSynth_GridColumnCount))
    ; fprints(SJsonFile, sprintf(",\\"gridRowCount\\":%d", giGroundBubbleSynth_GridRowCount))
    ; fprints(SJsonFile, sprintf(",\\"gridCellSize\\":%d", giGroundBubbleSynth_GridCellSize))
    ; fprints(SJsonFile, sprintf(",\\"fullVolumeY\\":%d", giGroundBubbleSynth_FullVolumeY))
    ; fprints(SJsonFile, sprintf(",\\"speedY\\":%d", giGroundBubbleSynth_SpeedY))
    ; fprints(SJsonFile, sprintf(",\\"maxDistance\\":%d", giGroundBubbleSynth_MaxAudibleDistance))
    ; fprints(SJsonFile, sprintf(",\\"maxHeight\\":%d", giGroundBubbleSynth_MaxAudibleHeight))
    ; fprints(SJsonFile, "}")
    SJson init ""
    SJson = strcat(SJson, "{")
    SJson = strcat(SJson, sprintf("\\"instanceName\\":\\"%s\\"", ""))
    SJson = strcat(SJson, sprintf(",\\"duration\\":%d", giGroundBubbleSynth_Duration))
    SJson = strcat(SJson, sprintf(",\\"gridColumnCount\\":%d", giGroundBubbleSynth_GridColumnCount))
    SJson = strcat(SJson, sprintf(",\\"gridRowCount\\":%d", giGroundBubbleSynth_GridRowCount))
    SJson = strcat(SJson, sprintf(",\\"gridCellSize\\":%d", giGroundBubbleSynth_GridCellSize))
    SJson = strcat(SJson, sprintf(",\\"fullVolumeY\\":%d", giGroundBubbleSynth_FullVolumeY))
    SJson = strcat(SJson, sprintf(",\\"speedY\\":%d", giGroundBubbleSynth_SpeedY))
    SJson = strcat(SJson, sprintf(",\\"maxDistance\\":%d", giGroundBubbleSynth_MaxAudibleDistance))
    SJson = strcat(SJson, sprintf(",\\"maxHeight\\":%d", giGroundBubbleSynth_MaxAudibleHeight))
    SJson = strcat(SJson, "}\\n")
    prints(SJson)
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
    iCps = cpsmidinn(random(56, 60))
    iAmp = 0.05
    iCutoffFrequency = 1000
    kY init giGroundBubbleSynth_StartY
    kY += giGroundBubbleSynth_SpeedY * (1 / kr)
    if (kY > giGroundBubbleSynth_MaxAudibleHeight) then
    turnoff
    fi
    kX init iGridColumn * giGroundBubbleSynth_GridCellSize - giGroundBubbleSynth_GridCenterX
    kZ init iGridRow * giGroundBubbleSynth_GridCellSize - giGroundBubbleSynth_GridCenterZ
    #ifndef IS_ANIMATIONS_ONLY
    kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
    kIsReverbOnly = 0
    if (kDistance > giGroundBubbleSynth_MaxReverbOnlyDistance) then
    kgoto end
    elseif (kDistance > giGroundBubbleSynth_MaxAudibleDistance) then
    kIsReverbOnly = 1
    fi
    kCps = iCps + kY * 5
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
    a5 += 0.1 * aOut * min(kDistanceAmp * iPlaybackReverbAdjustment, 0.175)
    gaInstrumentSignals[2][0] = a1
    if (kIsReverbOnly == 0) then
    gaInstrumentSignals[2][1] = a2
    gaInstrumentSignals[2][2] = a3
    gaInstrumentSignals[2][3] = a4
    fi
    gaInstrumentSignals[2][4] = a5
    gaInstrumentSignals[2][5] = a5
    #end
    #ifdef IS_GENERATING_JSON
    if (giGroundBubbleSynth_NoteIndex[0] == 0) then
    scoreline_i("i \\"GroundBubbleSynth_Json\\" 0 0")
    endif
    giGroundBubbleSynth_NoteIndex[0] = giGroundBubbleSynth_NoteIndex[0] + 1
    ; SJsonFile = sprintf("%s.%d.json", "9037b759-36e4-4600-b2cb-03383ebd65c1", giGroundBubbleSynth_NoteIndex[0])
    ; fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"column\\":%d,\\"row\\":%d}}",
    ; times(), iGridColumn, iGridRow)
    ; ficlose(SJsonFile)
    prints("{\\"noteOn\\":{\\"time\\":%.3f,\\"column\\":%d,\\"row\\":%d}}",
    times(), iGridColumn, iGridRow)
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
    #ifdef IS_ANIMATIONS_ONLY
    turnoff
    #end
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
    #ifndef IS_ANIMATIONS_ONLY
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
    #end
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
    instr SetMixdownListenerPosition
    iTableNumber init 1
    tablew( -1, 0, iTableNumber)
    tablew( 0, 1, iTableNumber)
    tablew( 0, 2, iTableNumber)
    tablew( 0, 3, iTableNumber)
    tablew( 0, 4, iTableNumber)
    tablew( 0.8972800970077515, 5, iTableNumber)
    tablew( 0.4414618015289306, 6, iTableNumber)
    tablew( 0, 7, iTableNumber)
    tablew( 0, 8, iTableNumber)
    tablew( 0.4414618015289306, 9, iTableNumber)
    tablew( -0.8972800970077515, 10, iTableNumber)
    tablew( 0, 11, iTableNumber)
    tablew( 0, 12, iTableNumber)
    tablew( 2, 13, iTableNumber)
    tablew( 250, 14, iTableNumber)
    tablew( 1, 15, iTableNumber)
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
    #ifdef IS_MIXDOWN
    i "SetMixdownListenerPosition" 1 -1
    #end
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
    i 5.084 2.853 0.100 1 1098 76
    i 5.085 3.825 0.100 1 1095 79
    i 5.086 4.621 0.100 1 1103 52
    i 5.087 5.243 0.100 1 1103 78
    i 5.088 5.799 0.100 1 1095 71
    i 5.089 6.531 0.100 1 1097 58
    i 5.090 7.439 0.100 1 1097 78
    i 5.091 8.356 0.100 1 1095 72
    i 5.092 9.097 0.100 1 1103 52
    i 5.093 9.664 0.100 1 1102 79
    i 5.094 10.237 0.100 1 1096 74
    i 5.095 10.275 0.100 1 1096 77
    i 5.096 10.852 0.100 1 1094 69
    i 5.097 11.061 0.100 1 1098 74
    i 5.098 11.380 0.100 1 1102 57
    i 4.049 12.001 0.490 3 36 127 0
    i 4.050 12.501 0.490 3 36 127 1
    i 4.051 13.501 0.490 3 36 127 2
    i 4.052 15.001 0.490 3 36 127 3
    i 4.053 17.001 0.490 3 36 127 4
    i 5.099 12.024 0.100 1 1096 76
    i 5.100 12.321 0.100 1 1101 58
    i 4.055 12.751 0.490 3 36 127 0
    i 4.056 13.251 0.490 3 36 127 1
    i 4.057 14.251 0.490 3 36 127 2
    i 4.058 15.751 0.490 3 36 127 3
    i 4.059 17.751 0.490 3 36 127 4
    i 5.101 12.887 0.100 1 1094 55
    i 5.102 13.176 0.100 1 1095 82
    i 5.103 13.573 0.100 1 1104 76
    i 5.104 13.911 0.100 1 1097 60
    i 5.105 14.085 0.100 1 1102 59
    i 5.106 14.732 0.100 1 1095 62
    i 5.107 14.751 0.100 1 1096 73
    i 5.108 15.325 0.100 1 1093 64
    i 5.109 15.592 0.100 1 1099 61
    i 5.110 15.832 0.100 1 1103 75
    i 5.111 15.969 0.100 1 1099 76
    i 4.061 16.001 0.490 3 36 127 0
    i 4.062 16.501 0.490 3 36 127 1
    i 4.063 17.501 0.490 3 36 127 2
    i 4.064 19.001 0.490 3 36 127 3
    i 4.065 21.001 0.490 3 36 127 4
    i 5.112 16.576 0.100 1 1095 69
    i 5.113 16.641 0.100 1 1097 56
    i 5.114 16.752 0.100 1 1101 61
    i 4.067 16.751 0.490 3 36 127 0
    i 4.068 17.251 0.490 3 36 127 1
    i 4.069 18.251 0.490 3 36 127 2
    i 4.070 19.751 0.490 3 36 127 3
    i 4.071 21.751 0.490 3 36 127 4
    i 5.115 17.207 0.100 1 1103 79
    i 5.116 17.384 0.100 1 1093 72
    i 5.117 17.585 0.100 1 1096 74
    i 5.118 17.908 0.100 1 1105 65
    i 5.119 18.016 0.100 1 1103 69
    i 5.120 18.341 0.100 1 1098 78
    i 5.121 18.444 0.100 1 1095 59
    i 5.122 18.560 0.100 1 1101 75
    i 5.123 19.175 0.100 1 1097 55
    i 5.124 19.184 0.100 1 1094 79
    i 5.125 19.280 0.100 1 1097 83
    i 5.126 19.681 0.100 1 1099 60
    i 5.127 19.756 0.100 1 1092 81
    i 4.073 20.001 0.490 3 36 127 0
    i 4.074 20.501 0.490 3 36 127 1
    i 4.075 21.501 0.490 3 36 127 2
    i 4.076 23.001 0.490 3 36 127 3
    i 4.077 25.001 0.490 3 36 127 4
    i 5.128 20.176 0.100 1 1099 57
    i 5.129 20.272 0.100 1 1102 53
    i 5.130 20.441 0.100 1 1097 79
    i 4.079 20.751 0.490 3 38 127 0
    i 4.080 21.251 0.490 3 38 127 1
    i 4.081 22.251 0.490 3 38 127 2
    i 4.082 23.751 0.490 3 38 127 3
    i 4.083 25.751 0.490 3 38 127 4
    i 5.131 20.965 0.100 1 1104 60
    i 5.132 21.105 0.100 1 1094 59
    i 5.133 21.171 0.100 1 1100 75
    i 5.134 21.755 0.100 1 1104 64
    i 5.135 21.859 0.100 1 1092 74
    i 5.136 21.981 0.100 1 1096 56
    i 5.137 22.308 0.100 1 1096 79
    i 5.138 22.436 0.100 1 1102 78
    i 5.139 22.759 0.100 1 1098 67
    i 5.140 23.005 0.100 1 1094 73
    i 5.141 23.035 0.100 1 1100 56
    i 5.142 23.127 0.100 1 1098 69
    i 5.143 23.623 0.100 1 1093 58
    i 5.144 23.709 0.100 1 1098 72
    i 5.145 23.749 0.100 1 1092 59
    i 5.146 23.809 0.100 1 1098 67
    i 4.085 24.001 0.490 3 41 127 0
    i 4.086 24.501 0.490 3 41 127 1
    i 4.087 25.501 0.490 3 41 127 2
    i 4.088 27.001 0.490 3 41 127 3
    i 4.089 29.001 0.490 3 41 127 4
    i 5.147 24.173 0.100 1 1091 68
    i 5.148 24.509 0.100 1 1102 62
    i 5.149 24.556 0.100 1 1096 60
    i 5.150 24.711 0.100 1 1101 64
    i 4.091 24.751 0.490 3 40 127 0
    i 4.092 25.251 0.490 3 40 127 1
    i 4.093 26.251 0.490 3 40 127 2
    i 4.094 27.751 0.490 3 40 127 3
    i 4.095 29.751 0.490 3 40 127 4
    i 5.151 24.760 0.100 1 1100 68
    i 5.152 25.168 0.100 1 1104 66
    i 5.153 25.249 0.100 1 1100 69
    i 5.154 25.587 0.100 1 1099 61
    i 5.155 25.635 0.100 1 1094 82
    i 5.156 26.013 0.100 1 1095 61
    i 5.157 26.044 0.100 1 1103 75
    i 5.158 26.333 0.100 1 1092 80
    i 5.159 26.376 0.100 1 1097 84
    i 5.160 26.685 0.100 1 1097 57
    i 5.161 26.749 0.100 1 1097 62
    i 5.162 26.856 0.100 1 1101 56
    i 5.163 27.175 0.100 1 1099 65
    i 5.164 27.509 0.100 1 1099 68
    i 5.165 27.516 0.100 1 1093 79
    i 5.166 27.591 0.100 1 1099 54
    i 4.097 28.001 0.490 3 36 127 0
    i 4.098 28.501 0.490 3 36 127 1
    i 4.099 29.501 0.490 3 36 127 2
    i 4.100 31.001 0.490 3 36 127 3
    i 4.101 33.001 0.490 3 36 127 4
    i 5.167 28.060 0.100 1 1093 65
    i 5.168 28.248 0.100 1 1091 56
    i 5.169 28.261 0.100 1 1097 79
    i 5.170 28.339 0.100 1 1099 55
    i 5.171 28.589 0.100 1 1092 72
    i 4.103 28.751 0.490 3 38 127 0
    i 4.104 29.251 0.490 3 38 127 1
    i 4.105 30.251 0.490 3 38 127 2
    i 4.106 31.751 0.490 3 38 127 3
    i 4.107 33.751 0.490 3 38 127 4
    i 5.172 29.019 0.100 1 1101 66
    i 5.173 29.041 0.100 1 1101 78
    i 5.174 29.148 0.100 1 1100 59
    i 5.175 29.196 0.100 1 1095 75
    i 5.176 29.335 0.100 1 1101 75
    i 5.177 29.728 0.100 1 1099 67
    i 5.178 29.747 0.100 1 1099 75
    i 5.179 29.896 0.100 1 1105 74
    i 5.180 30.003 0.100 1 1098 76
    i 5.181 30.155 0.100 1 1093 52
    i 5.182 30.521 0.100 1 1095 71
    i 5.183 30.561 0.100 1 1103 75
    i 5.184 30.771 0.100 1 1098 54
    i 5.185 30.799 0.100 1 1093 52
    i 5.186 30.860 0.100 1 1103 56
    i 5.187 31.245 0.100 1 1098 81
    i 5.188 31.332 0.100 1 1101 57
    i 5.189 31.541 0.100 1 1105 54
    i 5.190 31.589 0.100 1 1097 81
    i 5.191 31.591 0.100 1 1100 78
    i 4.109 32.001 0.490 3 41 127 0
    i 4.110 32.501 0.490 3 41 127 1
    i 4.111 33.501 0.490 3 41 127 2
    i 4.112 35.001 0.490 3 41 127 3
    i 4.113 37.001 0.490 3 41 127 4
    i 5.192 32.024 0.100 1 1092 82
    i 5.193 32.040 0.100 1 1098 82
    i 5.194 32.416 0.100 1 1095 82
    i 5.195 32.497 0.100 1 1092 75
    i 5.196 32.583 0.100 1 1100 80
    i 4.115 32.751 0.490 3 43 127 0
    i 5.197 32.744 0.100 1 1090 75
    i 4.116 33.251 0.490 3 43 127 1
    i 4.117 34.251 0.490 3 43 127 2
    i 4.118 35.751 0.490 3 43 127 3
    i 4.119 37.751 0.490 3 43 127 4
    i 5.198 32.924 0.100 1 1100 82
    i 5.199 33.005 0.100 1 1092 80
    i 5.200 33.144 0.100 1 1097 55
    i 5.201 33.341 0.100 1 1096 83
    i 5.202 33.527 0.100 1 1100 62
    i 5.203 33.587 0.100 1 1100 55
    i 5.204 33.725 0.100 1 1101 76
    i 5.205 33.865 0.100 1 1102 61
    i 5.206 34.243 0.100 1 1098 59
    i 5.207 34.292 0.100 1 1098 57
    i 5.208 34.320 0.100 1 1094 75
    i 5.209 34.420 0.100 1 1097 58
    i 5.210 34.631 0.100 1 1092 81
    i 5.211 35.004 0.100 1 1104 71
    i 5.212 35.029 0.100 1 1096 71
    i 5.213 35.108 0.100 1 1104 64
    i 5.214 35.167 0.100 1 1099 60
    i 5.215 35.220 0.100 1 1094 80
    i 5.216 35.309 0.100 1 1092 68
    i 5.217 35.741 0.100 1 1098 73
    i 5.218 35.808 0.100 1 1100 74
    i 5.219 35.863 0.100 1 1106 83
    i 4.121 36.001 0.490 3 36 127 0
    i 4.122 36.501 0.490 3 36 127 1
    i 4.123 37.501 0.490 3 36 127 2
    i 4.124 39.001 0.490 3 36 127 3
    i 4.125 41.001 0.490 3 36 127 4
    i 5.220 36.008 0.100 1 1101 55
    i 5.221 36.057 0.100 1 1102 67
    i 5.222 36.209 0.100 1 1090 77
    i 5.223 36.532 0.100 1 1092 79
    i 5.224 36.572 0.100 1 1098 74
    i 5.225 36.720 0.100 1 1100 63
    i 4.127 36.751 0.490 3 38 127 0
    i 4.128 37.251 0.490 3 38 127 1
    i 4.129 38.251 0.490 3 38 127 2
    i 4.130 39.751 0.490 3 38 127 3
    i 4.131 41.751 0.490 3 38 127 4
    i 5.226 36.859 0.100 1 1096 83
    i 5.227 36.875 0.100 1 1098 79
    i 5.228 36.936 0.100 1 1091 63
    i 5.229 37.240 0.100 1 1091 64
    i 5.230 37.301 0.100 1 1098 77
    i 5.231 37.451 0.100 1 1093 54
    i 5.232 37.511 0.100 1 1100 56
    i 5.233 37.708 0.100 1 1098 66
    i 5.234 37.795 0.100 1 1100 57
    i 5.235 38.035 0.100 1 1099 59
    i 5.236 38.053 0.100 1 1099 74
    i 5.237 38.131 0.100 1 1094 68
    i 5.238 38.397 0.100 1 1103 78
    i 5.239 38.411 0.100 1 1100 70
    i 5.240 38.641 0.100 1 1095 56
    i 5.241 38.740 0.100 1 1097 78
    i 5.242 38.865 0.100 1 1097 74
    i 5.243 38.868 0.100 1 1097 60
    i 5.244 38.967 0.100 1 1098 68
    i 5.245 39.108 0.100 1 1093 56
    i 5.246 39.532 0.100 1 1093 80
    i 5.247 39.539 0.100 1 1097 52
    i 5.248 39.559 0.100 1 1105 58
    i 5.249 39.591 0.100 1 1100 73
    i 5.250 39.643 0.100 1 1095 68
    i 5.251 39.723 0.100 1 1091 60
    i 4.133 40.001 0.490 3 41 127 0
    i 4.134 40.501 0.490 3 41 127 1
    i 4.135 41.501 0.490 3 41 127 2
    i 4.136 43.001 0.490 3 41 127 3
    i 4.137 45.001 0.490 3 41 127 4
    i 5.252 40.240 0.100 1 1099 73
    i 5.253 40.285 0.100 1 1099 74
    i 5.254 40.296 0.100 1 1105 60
    i 5.255 40.408 0.100 1 1103 56
    i 5.256 40.453 0.100 1 1102 75
    i 5.257 40.668 0.100 1 1089 76
    i 4.139 40.751 0.490 3 40 127 0
    i 4.140 41.251 0.490 3 40 127 1
    i 4.141 42.251 0.490 3 40 127 2
    i 4.142 43.751 0.490 3 40 127 3
    i 4.143 45.751 0.490 3 40 127 4
    i 5.258 41.043 0.100 1 1091 72
    i 5.259 41.104 0.100 1 1097 55
    i 5.260 41.180 0.100 1 1097 76
    i 5.261 41.204 0.100 1 1099 53
    i 5.262 41.269 0.100 1 1101 77
    i 5.263 41.403 0.100 1 1092 77
    i 5.264 41.424 0.100 1 1103 75
    i 5.265 41.740 0.100 1 1091 69
    i 5.266 41.831 0.100 1 1097 53
    i 5.267 41.940 0.100 1 1094 84
    i 5.268 42.097 0.100 1 1101 52
    i 5.269 42.151 0.100 1 1099 81
    i 5.270 42.175 0.100 1 1099 81
    i 5.271 42.381 0.100 1 1101 74
    i 5.272 42.547 0.100 1 1098 72
    i 5.273 42.564 0.100 1 1098 77
    i 5.274 42.615 0.100 1 1095 63
    i 5.275 42.929 0.100 1 1103 54
    i 5.276 42.975 0.100 1 1099 60
    i 5.277 42.984 0.100 1 1103 66
    i 5.278 43.007 0.100 1 1101 62
    i 5.279 43.240 0.100 1 1096 64
    i 5.280 43.308 0.100 1 1097 49
    i 5.281 43.355 0.100 1 1096 68
    i 5.282 43.585 0.100 1 1094 64
    i 5.283 43.644 0.100 1 1105 70
    i 5.284 43.652 0.100 1 1097 80
    i 5.285 43.941 0.100 1 1095 73
    i 4.145 44.001 0.490 3 40 127 0
    i 4.146 44.501 0.490 3 40 127 1
    i 4.147 45.501 0.490 3 40 127 2
    i 4.148 47.001 0.490 3 40 127 3
    i 4.149 49.001 0.490 3 40 127 4
    i 5.286 44.051 0.100 1 1098 73
    i 5.287 44.059 0.100 1 1100 65
    i 5.288 44.107 0.100 1 1096 53
    i 5.289 44.183 0.100 1 1105 80
    i 5.290 44.207 0.100 1 1091 49
    i 5.291 44.428 0.100 1 1095 67
    i 5.292 44.740 0.100 1 1100 56
    i 5.293 44.744 0.100 1 1093 81
    i 4.151 44.751 0.490 3 38 127 0
    i 4.152 45.251 0.490 3 38 127 1
    i 4.153 46.251 0.490 3 38 127 2
    i 4.154 47.751 0.490 3 38 127 3
    i 4.155 49.751 0.490 3 38 127 4
    i 5.294 44.800 0.100 1 1105 71
    i 5.295 44.804 0.100 1 1098 58
    i 5.296 44.943 0.100 1 1102 62
    i 5.297 45.155 0.100 1 1098 49
    i 5.298 45.196 0.100 1 1090 65
    i 5.299 45.555 0.100 1 1090 67
    i 5.300 45.564 0.100 1 1098 81
    i 5.301 45.677 0.100 1 1096 74
    i 5.302 45.708 0.100 1 1102 71
    i 5.303 45.777 0.100 1 1098 67
    i 5.304 45.915 0.100 1 1093 71
    i 5.305 45.988 0.100 1 1102 55
    i 5.306 46.240 0.100 1 1092 80
    i 5.307 46.449 0.100 1 1096 71
    i 5.308 46.473 0.100 1 1095 74
    i 5.309 46.473 0.100 1 1100 73
    i 5.310 46.481 0.100 1 1100 57
    i 5.311 46.631 0.100 1 1102 84
    i 5.312 46.825 0.100 1 1090 62
    i 5.313 46.879 0.100 1 1100 61
    i 5.314 47.059 0.100 1 1098 54
    i 5.315 47.119 0.100 1 1097 63
    i 5.316 47.188 0.100 1 1096 50
    i 5.317 47.368 0.100 1 1088 62
    i 5.318 47.408 0.100 1 1104 81
    i 5.319 47.419 0.100 1 1098 77
    i 5.320 47.432 0.100 1 1104 76
    i 5.321 47.475 0.100 1 1100 58
    i 5.322 47.740 0.100 1 1096 80
    i 5.323 47.836 0.100 1 1098 75
    i 5.324 47.888 0.100 1 1095 83
    i 5.325 47.937 0.100 1 1106 65
    i 4.157 48.001 0.490 3 36 127 0
    i 4.158 48.501 0.490 3 36 127 1
    i 4.159 49.501 0.490 3 36 127 2
    i 4.160 51.001 0.490 3 36 127 3
    i 4.161 53.001 0.490 3 36 127 4
    i 5.326 48.009 0.100 1 1094 67
    i 5.327 48.091 0.100 1 1098 63
    i 5.328 48.217 0.100 1 1096 78
    i 5.329 48.219 0.100 1 1102 78
    i 5.330 48.561 0.100 1 1099 65
    i 5.331 48.571 0.100 1 1101 79
    i 5.332 48.585 0.100 1 1096 73
    i 4.163 48.751 0.490 3 36 127 0
    i 4.164 49.251 0.490 3 36 127 1
    i 4.165 50.251 0.490 3 36 127 2
    i 4.166 51.751 0.490 3 36 127 3
    i 4.167 53.751 0.490 3 36 127 4
    i 5.333 48.780 0.100 1 1090 64
    i 5.334 48.869 0.100 1 1106 52
    i 5.335 48.876 0.100 1 1096 50
    i 5.336 48.993 0.100 1 1096 52
    i 5.337 49.197 0.100 1 1094 83
    i 5.338 49.239 0.100 1 1101 67
    i 5.339 49.337 0.100 1 1097 64
    i 5.340 49.375 0.100 1 1104 81
    i 5.341 49.476 0.100 1 1103 72
    i 5.342 49.747 0.100 1 1090 56
    i 5.343 49.756 0.100 1 1098 58
    i 5.344 49.912 0.100 1 1094 75
    i 5.345 49.913 0.100 1 1094 74
    i 5.346 50.017 0.100 1 1098 61
    i 5.347 50.064 0.100 1 1091 74
    i 5.348 50.265 0.100 1 1095 53
    i 5.349 50.372 0.100 1 1097 50
    i 5.350 50.435 0.100 1 1102 64
    i 5.351 50.469 0.100 1 1093 65
    i 5.352 50.653 0.100 1 1096 57
    i 5.353 50.737 0.100 1 1093 56
    i 5.354 50.807 0.100 1 1101 80
    i 5.355 50.861 0.100 1 1102 70
    i 5.356 51.049 0.100 1 1096 61
    i 5.357 51.088 0.100 1 1095 60
    i 5.358 51.164 0.100 1 1103 73
    i 5.359 51.171 0.100 1 1099 70
    i 5.360 51.213 0.100 1 1089 72
    i 5.361 51.547 0.100 1 1099 79
    i 5.362 51.567 0.100 1 1097 59
    i 5.363 51.716 0.100 1 1096 65
    i 5.364 51.741 0.100 1 1097 64
    i 5.365 51.783 0.100 1 1097 49
    i 5.366 51.835 0.100 1 1089 63
    i 5.367 51.879 0.100 1 1105 77
    i 5.368 51.887 0.100 1 1103 62
    i 4.169 52.001 0.490 3 36 127 0
    i 4.170 52.501 0.490 3 36 127 1
    i 4.171 53.501 0.490 3 36 127 2
    i 4.172 55.001 0.490 3 36 127 3
    i 4.173 57.001 0.490 3 36 127 4
    i 5.369 52.236 0.100 1 1095 66
    i 5.370 52.385 0.100 1 1099 76
    i 5.371 52.433 0.100 1 1095 62
    i 5.372 52.464 0.100 1 1094 72
    i 5.373 52.467 0.100 1 1101 78
    i 5.374 52.529 0.100 1 1107 72
    i 5.375 52.635 0.100 1 1097 71
    i 5.376 52.661 0.100 1 1095 81
    i 4.175 52.751 0.490 3 38 127 0
    i 4.176 53.251 0.490 3 38 127 1
    i 4.177 54.251 0.490 3 38 127 2
    i 4.178 55.751 0.490 3 38 127 3
    i 4.179 57.751 0.490 3 38 127 4
    i 5.377 53.064 0.100 1 1097 77
    i 5.378 53.069 0.100 1 1099 64
    i 5.379 53.123 0.100 1 1103 62
    i 5.380 53.125 0.100 1 1102 65
    i 5.381 53.375 0.100 1 1089 75
    i 5.382 53.435 0.100 1 1105 58
    i 5.383 53.439 0.100 1 1097 57
    i 5.384 53.615 0.100 1 1095 62
    i 5.385 53.735 0.100 1 1102 57
    i 5.386 53.871 0.100 1 1097 70
    i 5.387 54.013 0.100 1 1093 72
    i 5.388 54.053 0.100 1 1102 69
    i 5.389 54.061 0.100 1 1103 57
    i 5.390 54.296 0.100 1 1091 63
    i 5.391 54.405 0.100 1 1099 72
    i 5.392 54.456 0.100 1 1095 55
    i 5.393 54.572 0.100 1 1092 74
    i 5.394 54.583 0.100 1 1099 77
    i 5.395 54.640 0.100 1 1095 62
    i 5.396 54.853 0.100 1 1094 82
    i 5.397 54.871 0.100 1 1105 76
    i 5.398 54.929 0.100 1 1101 67
    i 5.399 54.967 0.100 1 1097 49
    i 5.400 55.040 0.100 1 1094 54
    i 5.401 55.117 0.100 1 1097 48
    i 5.402 55.233 0.100 1 1094 56
    i 5.403 55.251 0.100 1 1101 83
    i 5.404 55.469 0.100 1 1103 52
    i 5.405 55.503 0.100 1 1101 52
    i 5.406 55.511 0.100 1 1099 48
    i 5.407 55.636 0.100 1 1089 47
    i 5.408 55.641 0.100 1 1096 83
    i 5.409 55.697 0.100 1 1104 72
    i 5.410 55.728 0.100 1 1095 80
    i 4.181 56.001 0.490 3 41 127 0
    i 4.182 56.501 0.490 3 41 127 1
    i 4.183 57.501 0.490 3 41 127 2
    i 4.184 59.001 0.490 3 41 127 3
    i 4.185 61.001 0.490 3 41 127 4
    i 5.411 56.065 0.100 1 1097 63
    i 5.412 56.075 0.100 1 1096 80
    i 5.413 56.100 0.100 1 1099 58
    i 5.414 56.329 0.100 1 1096 57
    i 5.415 56.335 0.100 1 1089 54
    i 5.416 56.340 0.100 1 1103 61
    i 5.417 56.365 0.100 1 1102 64
    i 5.418 56.372 0.100 1 1105 49
    i 5.419 56.377 0.100 1 1098 55
    i 5.420 56.732 0.100 1 1094 62
    i 4.187 56.751 0.490 3 40 127 0
    i 4.188 57.251 0.490 3 40 127 1
    i 4.189 58.251 0.490 3 40 127 2
    i 4.190 59.751 0.490 3 40 127 3
    i 4.191 61.751 0.490 3 40 127 4
    i 5.421 56.875 0.100 1 1096 83
    i 5.422 56.933 0.100 1 1101 57
    i 5.423 56.936 0.100 1 1100 62
    i 5.424 57.001 0.100 1 1105 58
    i 5.425 57.025 0.100 1 1094 80
    i 5.426 57.056 0.100 1 1093 53
    i 5.427 57.176 0.100 1 1106 49
    i 5.428 57.213 0.100 1 1096 71
    i 5.429 57.501 0.100 1 1104 67
    i 5.430 57.560 0.100 1 1098 79
    i 5.431 57.577 0.100 1 1100 74
    i 5.432 57.696 0.100 1 1103 72
    i 5.433 57.809 0.100 1 1096 56
    i 5.434 57.904 0.100 1 1090 56
    i 5.435 57.920 0.100 1 1104 55
    i 5.436 57.931 0.100 1 1098 76
    i 5.437 58.156 0.100 1 1094 50
    i 5.438 58.231 0.100 1 1102 78
    i 5.439 58.305 0.100 1 1094 62
    i 5.440 58.421 0.100 1 1096 56
    i 5.441 58.533 0.100 1 1098 79
    i 5.442 58.645 0.100 1 1101 83
    i 5.443 58.668 0.100 1 1102 67
    i 5.444 58.743 0.100 1 1100 61
    i 5.445 58.780 0.100 1 1092 76
    i 5.446 58.844 0.100 1 1096 76
    i 5.447 58.920 0.100 1 1096 60
    i 5.448 59.080 0.100 1 1092 54
    i 5.449 59.269 0.100 1 1100 68
    i 5.450 59.279 0.100 1 1104 70
    i 5.451 59.375 0.100 1 1100 66
    i 5.452 59.385 0.100 1 1094 59
    i 5.453 59.496 0.100 1 1096 49
    i 5.454 59.504 0.100 1 1098 44
    i 5.455 59.611 0.100 1 1095 67
    i 5.456 59.619 0.100 1 1100 82
    i 5.457 59.731 0.100 1 1095 80
    i 5.458 59.816 0.100 1 1102 66
    i 5.459 59.948 0.100 1 1098 76
    i 4.193 60.001 0.490 3 36 127 0
    i 4.194 60.501 0.490 3 36 127 1
    i 4.195 61.501 0.490 3 36 127 2
    i 4.196 63.001 0.490 3 36 127 3
    i 4.197 65.001 0.490 3 36 127 4
    i 5.460 60.065 0.100 1 1102 69
    i 5.461 60.101 0.100 1 1088 48
    i 5.462 60.128 0.100 1 1098 75
    i 5.463 60.175 0.100 1 1104 76
    i 5.464 60.233 0.100 1 1097 56
    i 5.465 60.303 0.100 1 1094 66
    i 5.466 60.509 0.100 1 1096 55
    i 5.467 60.584 0.100 1 1095 84
    i 5.468 60.748 0.100 1 1104 53
    i 4.199 60.751 0.490 3 38 127 0
    i 4.200 61.251 0.490 3 38 127 1
    i 4.201 62.251 0.490 3 38 127 2
    i 4.202 63.751 0.490 3 38 127 3
    i 4.203 65.751 0.490 3 38 127 4
    i 5.469 60.788 0.100 1 1101 65
    i 5.470 60.873 0.100 1 1102 70
    i 5.471 60.879 0.100 1 1090 46
    i 5.472 60.907 0.100 1 1098 66
    i 5.473 60.933 0.100 1 1106 68
    i 5.474 60.943 0.100 1 1095 80
    i 5.475 61.231 0.100 1 1093 79
    i 5.476 61.349 0.100 1 1094 72
    i 5.477 61.352 0.100 1 1097 73
    i 5.478 61.395 0.100 1 1104 60
    i 5.479 61.420 0.100 1 1101 75
    i 5.480 61.597 0.100 1 1106 52
    i 5.481 61.648 0.100 1 1093 84
    i 5.482 61.836 0.100 1 1096 72
    i 5.483 61.892 0.100 1 1106 57
    i 5.484 62.088 0.100 1 1101 74
    i 5.485 62.092 0.100 1 1099 69
    i 5.486 62.111 0.100 1 1094 79
    i 5.487 62.219 0.100 1 1096 53
    i 5.488 62.265 0.100 1 1102 57
    i 5.489 62.336 0.100 1 1103 69
    i 5.490 62.343 0.100 1 1091 49
    i 5.491 62.492 0.100 1 1099 70
    i 5.492 62.661 0.100 1 1097 62
    i 5.493 62.701 0.100 1 1093 73
    i 5.494 62.731 0.100 1 1101 58
    i 5.495 63.008 0.100 1 1095 74
    i 5.496 63.131 0.100 1 1098 54
    i 5.497 63.149 0.100 1 1101 67
    i 5.498 63.175 0.100 1 1093 54
    i 5.499 63.205 0.100 1 1101 54
    i 5.500 63.236 0.100 1 1100 56
    i 5.501 63.348 0.100 1 1099 70
    i 5.502 63.387 0.100 1 1097 45
    i 5.503 63.592 0.100 1 1093 66
    i 5.504 63.689 0.100 1 1103 61
    i 5.505 63.892 0.100 1 1099 47
    i 5.506 63.917 0.100 1 1093 80
    i 5.507 63.928 0.100 1 1097 53
    i 5.508 63.928 0.100 1 1101 71
    i 5.509 63.935 0.100 1 1095 72
    i 5.510 63.935 0.100 1 1099 67
    i 4.205 64.001 0.490 3 41 127 0
    i 4.206 64.501 0.490 3 41 127 1
    i 4.207 65.501 0.490 3 41 127 2
    i 4.208 67.001 0.490 3 41 127 3
    i 4.209 69.001 0.490 3 41 127 4
    i 5.511 64.180 0.100 1 1096 74
    i 5.512 64.231 0.100 1 1095 69
    i 5.513 64.504 0.100 1 1103 79
    i 5.514 64.568 0.100 1 1089 45
    i 5.515 64.585 0.100 1 1103 73
    i 5.516 64.652 0.100 1 1103 83
    i 5.517 64.663 0.100 1 1097 77
    i 5.518 64.664 0.100 1 1101 76
    i 4.211 64.751 0.490 3 43 127 0
    i 4.212 65.251 0.490 3 43 127 1
    i 4.213 66.251 0.490 3 43 127 2
    i 4.214 67.751 0.490 3 43 127 3
    i 4.215 69.751 0.490 3 43 127 4
    i 5.519 64.785 0.100 1 1093 54
    i 5.520 64.824 0.100 1 1098 61
    i 5.521 65.076 0.100 1 1095 58
    i 5.522 65.096 0.100 1 1095 72
    i 5.523 65.169 0.100 1 1105 69
    i 5.524 65.195 0.100 1 1105 71
    i 5.525 65.211 0.100 1 1101 75
    i 5.526 65.245 0.100 1 1107 77
    i 5.527 65.344 0.100 1 1099 50
    i 5.528 65.423 0.100 1 1091 56
    i 5.529 65.493 0.100 1 1107 55
    i 5.530 65.555 0.100 1 1094 53
    i 5.531 65.731 0.100 1 1092 70
    i 5.532 65.795 0.100 1 1095 57
    i 5.533 65.823 0.100 1 1095 56
    i 5.534 65.829 0.100 1 1098 72
    i 5.535 65.877 0.100 1 1101 67
    i 5.536 66.005 0.100 1 1105 62
    i 5.537 66.133 0.100 1 1107 56
    i 5.538 66.237 0.100 1 1092 62
    i 5.539 66.381 0.100 1 1105 63
    i 5.540 66.389 0.100 1 1095 57
    i 5.541 66.461 0.100 1 1097 64
    i 5.542 66.600 0.100 1 1102 78
    i 5.543 66.624 0.100 1 1100 70
    i 5.544 66.645 0.100 1 1103 56
    i 5.545 66.660 0.100 1 1103 64
    i 5.546 66.701 0.100 1 1097 74
    i 5.547 66.755 0.100 1 1091 67
    i 5.548 66.833 0.100 1 1102 79
    i 5.549 66.937 0.100 1 1099 69
    i 5.550 67.060 0.100 1 1098 58
    i 5.551 67.176 0.100 1 1093 63
    i 5.552 67.231 0.100 1 1100 57
    i 5.553 67.441 0.100 1 1101 67
    i 5.554 67.541 0.100 1 1094 56
    i 5.555 67.595 0.100 1 1094 81
    i 5.556 67.604 0.100 1 1099 66
    i 5.557 67.628 0.100 1 1106 78
    i 5.558 67.649 0.100 1 1101 64
    i 5.559 67.728 0.100 1 1096 79
    i 5.560 67.783 0.100 1 1097 69
    i 5.561 67.825 0.100 1 1100 59
    i 4.217 68.001 0.490 3 36 127 0
    i 4.218 68.501 0.490 3 36 127 1
    i 4.219 69.501 0.490 3 36 127 2
    i 4.220 71.001 0.490 3 36 127 3
    i 4.221 73.001 0.490 3 36 127 4
    i 5.562 68.104 0.100 1 1094 73
    i 5.563 68.235 0.100 1 1103 78
    i 5.564 68.297 0.100 1 1104 54
    i 5.565 68.347 0.100 1 1094 79
    i 5.566 68.356 0.100 1 1100 67
    i 5.567 68.381 0.100 1 1098 80
    i 5.568 68.449 0.100 1 1092 53
    i 5.569 68.493 0.100 1 1102 63
    i 5.570 68.527 0.100 1 1098 77
    i 5.571 68.731 0.100 1 1096 61
    i 5.572 68.748 0.100 1 1097 82
    i 4.223 68.751 0.490 3 38 127 0
    i 4.224 69.251 0.490 3 38 127 1
    i 4.225 70.251 0.490 3 38 127 2
    i 4.226 71.751 0.490 3 38 127 3
    i 4.227 73.751 0.490 3 38 127 4
    i 5.573 68.995 0.100 1 1104 71
    i 5.574 69.075 0.100 1 1100 52
    i 5.575 69.109 0.100 1 1090 44
    i 5.576 69.129 0.100 1 1102 62
    i 5.577 69.191 0.100 1 1104 83
    i 5.578 69.243 0.100 1 1092 52
    i 5.579 69.249 0.100 1 1098 77
    i 5.580 69.264 0.100 1 1096 74
    i 5.581 69.413 0.100 1 1099 53
    i 5.582 69.535 0.100 1 1096 60
    i 5.583 69.607 0.100 1 1094 82
    i 5.584 69.633 0.100 1 1100 78
    i 5.585 69.741 0.100 1 1094 62
    i 5.586 69.757 0.100 1 1100 79
    i 5.587 69.768 0.100 1 1106 54
    i 5.588 69.940 0.100 1 1106 66
    i 5.589 70.043 0.100 1 1092 71
    i 5.590 70.092 0.100 1 1106 53
    i 5.591 70.165 0.100 1 1093 57
    i 5.592 70.229 0.100 1 1092 53
    i 5.593 70.261 0.100 1 1098 65
    i 5.594 70.307 0.100 1 1098 62
    i 5.595 70.335 0.100 1 1100 58
    i 5.596 70.339 0.100 1 1096 69
    i 5.597 70.545 0.100 1 1108 63
    i 5.598 70.631 0.100 1 1104 77
    i 5.599 70.675 0.100 1 1104 71
    i 5.600 70.772 0.100 1 1098 59
    i 5.601 70.827 0.100 1 1091 54
    i 5.602 70.931 0.100 1 1094 75
    i 5.603 71.083 0.100 1 1102 76
    i 5.604 71.109 0.100 1 1101 70
    i 5.605 71.156 0.100 1 1100 77
    i 5.606 71.168 0.100 1 1092 64
    i 5.607 71.213 0.100 1 1104 62
    i 5.608 71.301 0.100 1 1098 75
    i 5.609 71.384 0.100 1 1100 73
    i 5.610 71.401 0.100 1 1101 72
    i 5.611 71.528 0.100 1 1096 54
    i 5.612 71.639 0.100 1 1092 51
    i 5.613 71.728 0.100 1 1099 73
    i 5.614 71.909 0.100 1 1094 50
    i 5.615 71.973 0.100 1 1100 78
    i 4.229 72.001 0.490 3 41 127 0
    i 4.230 72.501 0.490 3 41 127 1
    i 4.231 73.501 0.490 3 41 127 2
    i 4.232 75.001 0.490 3 41 127 3
    i 4.233 77.001 0.490 3 41 127 4
    i 5.616 72.012 0.100 1 1106 70
    i 5.617 72.016 0.100 1 1100 53
    i 5.618 72.036 0.100 1 1102 80
    i 5.619 72.048 0.100 1 1105 73
    i 5.620 72.132 0.100 1 1093 71
    i 5.621 72.168 0.100 1 1098 66
    i 5.622 72.389 0.100 1 1099 71
    i 5.623 72.612 0.100 1 1095 72
    i 5.624 72.691 0.100 1 1098 56
    i 4.235 72.751 0.490 3 40 127 0
    i 4.236 73.251 0.490 3 40 127 1
    i 4.237 74.251 0.490 3 40 127 2
    i 4.238 75.751 0.490 3 40 127 3
    i 4.239 77.751 0.490 3 40 127 4
    i 5.625 72.760 0.100 1 1093 69
    i 5.626 72.820 0.100 1 1100 50
    i 5.627 72.833 0.100 1 1103 70
    i 5.628 72.835 0.100 1 1102 59
    i 5.629 72.932 0.100 1 1093 82
    i 5.630 72.937 0.100 1 1102 58
    i 5.631 72.943 0.100 1 1098 54
    i 5.632 73.227 0.100 1 1097 68
    i 5.633 73.291 0.100 1 1097 66
    i 5.634 73.383 0.100 1 1097 63
    i 5.635 73.487 0.100 1 1100 78
    i 5.636 73.557 0.100 1 1101 82
    i 5.637 73.633 0.100 1 1099 50
    i 5.638 73.652 0.100 1 1091 55
    i 5.639 73.701 0.100 1 1091 71
    i 5.640 73.756 0.100 1 1105 73
    i 5.641 73.907 0.100 1 1095 64
    i 5.642 73.977 0.100 1 1100 56
    i 5.643 74.109 0.100 1 1099 62
    i 5.644 74.115 0.100 1 1093 59
    i 5.645 74.197 0.100 1 1099 53
    i 5.646 74.233 0.100 1 1101 65
    i 5.647 74.367 0.100 1 1106 55
    i 5.648 74.428 0.100 1 1095 61
    i 5.649 74.429 0.100 1 1105 62
    i 5.650 74.572 0.100 1 1105 58
    i 5.651 74.641 0.100 1 1093 51
    i 5.652 74.725 0.100 1 1091 53
    i 5.653 74.752 0.100 1 1092 82
    i 5.654 74.776 0.100 1 1097 59
    i 5.655 74.837 0.100 1 1099 61
    i 5.656 74.856 0.100 1 1099 72
    i 5.657 74.953 0.100 1 1097 53
    i 5.658 74.956 0.100 1 1107 69
    i 5.659 75.009 0.100 1 1103 56
    i 5.660 75.255 0.100 1 1103 50
    i 5.661 75.392 0.100 1 1092 61
    i 5.662 75.452 0.100 1 1093 51
    i 5.663 75.576 0.100 1 1101 78
    i 5.664 75.617 0.100 1 1101 74
    i 5.665 75.620 0.100 1 1095 73
    i 5.666 75.644 0.100 1 1093 63
    i 5.667 75.741 0.100 1 1101 59
    i 5.668 75.873 0.100 1 1101 58
    i 5.669 75.899 0.100 1 1099 51
    i 5.670 75.945 0.100 1 1100 69
    i 4.241 76.001 0.490 3 40 127 0
    i 4.242 76.501 0.490 3 40 127 1
    i 4.243 77.501 0.490 3 40 127 2
    i 4.244 79.001 0.490 3 40 127 3
    i 4.245 81.001 0.490 3 40 127 4
    i 5.671 76.059 0.100 1 1105 60
    i 5.672 76.083 0.100 1 1091 73
    i 5.673 76.224 0.100 1 1099 80
    i 5.674 76.228 0.100 1 1105 61
    i 5.675 76.341 0.100 1 1095 72
    i 5.676 76.345 0.100 1 1099 54
    i 5.677 76.425 0.100 1 1101 57
    i 5.678 76.633 0.100 1 1099 68
    i 5.679 76.636 0.100 1 1107 72
    i 5.680 76.663 0.100 1 1093 73
    i 5.681 76.680 0.100 1 1103 59
    i 5.682 76.737 0.100 1 1109 78
    i 4.247 76.751 0.490 3 38 127 0
    i 4.248 77.251 0.490 3 38 127 1
    i 4.249 78.251 0.490 3 38 127 2
    i 4.250 79.751 0.490 3 38 127 3
    i 4.251 81.751 0.490 3 38 127 4
    i 5.683 76.912 0.100 1 1098 76
    i 5.684 77.101 0.100 1 1102 78
    i 5.685 77.120 0.100 1 1096 65
    i 5.686 77.180 0.100 1 1097 59
    i 5.687 77.236 0.100 1 1093 75
    i 5.688 77.261 0.100 1 1103 75
    i 5.689 77.364 0.100 1 1099 44
    i 5.690 77.408 0.100 1 1094 82
    i 5.691 77.421 0.100 1 1101 74
    i 5.692 77.432 0.100 1 1097 71
    i 5.693 77.621 0.100 1 1107 72
    i 5.694 77.723 0.100 1 1098 75
    i 5.695 77.739 0.100 1 1098 76
    i 5.696 77.792 0.100 1 1098 75
    i 5.697 77.959 0.100 1 1099 77
    i 5.698 77.979 0.100 1 1100 59
    i 5.699 78.017 0.100 1 1099 60
    i 5.700 78.200 0.100 1 1105 82
    i 5.701 78.223 0.100 1 1091 63
    i 5.702 78.243 0.100 1 1095 79
    i 5.703 78.273 0.100 1 1091 59
    i 5.704 78.500 0.100 1 1100 65
    i 5.705 78.529 0.100 1 1104 51
    i 5.706 78.585 0.100 1 1098 83
    i 5.707 78.623 0.100 1 1092 82
    i 5.708 78.641 0.100 1 1100 51
    i 5.709 78.735 0.100 1 1104 57
    i 5.710 78.800 0.100 1 1100 55
    i 5.711 78.876 0.100 1 1105 72
    i 5.712 78.892 0.100 1 1107 57
    i 5.713 78.992 0.100 1 1095 52
    i 5.714 79.185 0.100 1 1093 55
    i 5.715 79.221 0.100 1 1090 66
    i 5.716 79.228 0.100 1 1106 66
    i 5.717 79.296 0.100 1 1092 58
    i 5.718 79.308 0.100 1 1096 79
    i 5.719 79.368 0.100 1 1100 60
    i 5.720 79.452 0.100 1 1102 64
    i 5.721 79.468 0.100 1 1098 72
    i 5.722 79.491 0.100 1 1107 73
    i 5.723 79.639 0.100 1 1098 53
    i 5.724 79.639 0.100 1 1102 57
    i 5.725 79.740 0.100 1 1100 66
    i 5.726 79.915 0.100 1 1093 59
    i 5.727 79.917 0.100 1 1092 45
    i 4.253 80.001 0.490 3 36 127 0
    i 4.254 80.501 0.490 3 36 127 1
    i 4.255 81.501 0.490 3 36 127 2
    i 4.256 83.001 0.490 3 36 127 3
    i 4.257 85.001 0.490 3 36 127 4
    i 5.728 80.125 0.100 1 1100 82
    i 5.729 80.140 0.100 1 1100 80
    i 5.730 80.211 0.100 1 1094 55
    i 5.731 80.239 0.100 1 1094 76
    i 5.732 80.327 0.100 1 1102 82
    i 5.733 80.361 0.100 1 1100 64
    i 5.734 80.435 0.100 1 1102 64
    i 5.735 80.447 0.100 1 1099 75
    i 5.736 80.460 0.100 1 1098 75
    i 5.737 80.469 0.100 1 1090 73
    i 5.738 80.616 0.100 1 1106 59
    i 5.739 80.721 0.100 1 1098 53
    i 4.259 80.751 0.490 3 36 127 0
    i 4.260 81.251 0.490 3 36 127 1
    i 4.261 82.251 0.490 3 36 127 2
    i 4.262 83.751 0.490 3 36 127 3
    i 4.263 85.751 0.490 3 36 127 4
    i 5.740 80.788 0.100 1 1098 78
    i 5.741 80.863 0.100 1 1096 67
    i 5.742 80.935 0.100 1 1104 54
    i 5.743 81.023 0.100 1 1102 56
    i 5.744 81.097 0.100 1 1100 51
    i 5.745 81.193 0.100 1 1092 57
    i 5.746 81.260 0.100 1 1108 77
    i 5.747 81.389 0.100 1 1108 68
    i 5.748 81.392 0.100 1 1097 62
    i 5.749 81.395 0.100 1 1104 61
    i 5.750 81.583 0.100 1 1104 70
    i 5.751 81.629 0.100 1 1096 58
    i 5.752 81.803 0.100 1 1092 71
    i 5.753 81.831 0.100 1 1100 69
    i 5.754 81.884 0.100 1 1094 70
    i 5.755 81.895 0.100 1 1102 79
    i 5.756 81.905 0.100 1 1098 69
    i 5.757 81.993 0.100 1 1096 57
    i 5.758 82.024 0.100 1 1098 74
    i 5.759 82.221 0.100 1 1099 69
    i 5.760 82.251 0.100 1 1099 60
    i 5.761 82.252 0.100 1 1106 53
    i 5.762 82.399 0.100 1 1100 68
    i 5.763 82.524 0.100 1 1106 81
    i 5.764 82.555 0.100 1 1098 73
    i 5.765 82.620 0.100 1 1098 80
    i 5.766 82.641 0.100 1 1100 77
    i 5.767 82.649 0.100 1 1096 57
    i 5.768 82.773 0.100 1 1090 49
    i 5.769 82.893 0.100 1 1092 74
    i 5.770 82.907 0.100 1 1104 71
    i 5.771 82.981 0.100 1 1101 81
    i 5.772 83.060 0.100 1 1097 73
    i 5.773 83.133 0.100 1 1091 72
    i 5.774 83.145 0.100 1 1104 52
    i 5.775 83.300 0.100 1 1108 49
    i 5.776 83.395 0.100 1 1100 65
    i 5.777 83.437 0.100 1 1096 70
    i 5.778 83.437 0.100 1 1104 66
    i 5.779 83.463 0.100 1 1107 56
    i 5.780 83.609 0.100 1 1101 56
    i 5.781 83.721 0.100 1 1091 59
    i 5.782 83.727 0.100 1 1094 51
    i 5.783 83.799 0.100 1 1091 78
    i 5.784 83.897 0.100 1 1101 82
    i 5.785 84.021 0.100 1 1102 48
    i 5.786 84.087 0.100 1 1106 79
    i 5.787 84.107 0.100 1 1097 59
    i 5.788 84.168 0.100 1 1102 76
    i 5.789 84.204 0.100 1 1098 84
    i 5.790 84.228 0.100 1 1099 60
    i 5.791 84.364 0.100 1 1095 51
    i 5.792 84.380 0.100 1 1092 53
    i 5.793 84.396 0.100 1 1093 62
    i 5.794 84.637 0.100 1 1099 61
    i 5.795 84.769 0.100 1 1100 50
    i 5.796 84.777 0.100 1 1107 74
    i 5.797 84.804 0.100 1 1095 73
    i 5.798 84.825 0.100 1 1099 63
    i 5.799 84.885 0.100 1 1103 59
    i 5.800 84.907 0.100 1 1099 69
    i 5.801 84.907 0.100 1 1089 62
    i 5.802 84.997 0.100 1 1103 73
    i 5.803 85.203 0.100 1 1099 78
    i 5.804 85.221 0.100 1 1097 67
    i 5.805 85.347 0.100 1 1093 71
    i 5.806 85.352 0.100 1 1097 83
    i 5.807 85.411 0.100 1 1097 76
    i 5.808 85.613 0.100 1 1099 55
    i 5.809 85.619 0.100 1 1102 66
    i 5.810 85.643 0.100 1 1109 49
    i 5.811 85.697 0.100 1 1093 61
    i 5.812 85.831 0.100 1 1096 53
    i 5.813 85.884 0.100 1 1105 49
    i 4.265 86.001 0.490 3 36 127 0
    i 4.266 86.501 0.490 3 36 127 1
    i 4.267 87.501 0.490 3 36 127 2
    i 4.268 89.001 0.490 3 36 127 3
    i 4.269 91.001 0.490 3 36 127 4
    i 5.814 86.021 0.100 1 1107 55
    i 5.815 86.025 0.100 1 1105 71
    i 5.816 86.131 0.100 1 1103 56
    i 5.817 86.141 0.100 1 1097 61
    i 5.818 86.240 0.100 1 1099 57
    i 5.819 86.333 0.100 1 1095 64
    i 5.820 86.396 0.100 1 1091 66
    i 5.821 86.441 0.100 1 1095 70
    i 5.822 86.500 0.100 1 1097 53
    i 5.823 86.628 0.100 1 1099 64
    i 5.824 86.631 0.100 1 1105 56
    i 5.825 86.667 0.100 1 1100 76
    i 5.826 86.721 0.100 1 1099 74
    i 4.271 86.751 0.490 3 36 127 0
    i 4.272 87.251 0.490 3 36 127 1
    i 4.273 88.251 0.490 3 36 127 2
    i 4.274 89.751 0.490 3 36 127 3
    i 4.275 91.751 0.490 3 36 127 4
    i 5.827 86.845 0.100 1 1105 77
    i 5.828 86.875 0.100 1 1099 65
    i 5.829 86.943 0.100 1 1097 71
    i 5.830 87.084 0.100 1 1101 61
    i 5.831 87.152 0.100 1 1097 61
    i 5.832 87.232 0.100 1 1105 51
    i 5.833 87.233 0.100 1 1101 79
    i 5.834 87.321 0.100 1 1089 51
    i 5.835 87.419 0.100 1 1102 74
    i 5.836 87.435 0.100 1 1093 59
    i 5.837 87.591 0.100 1 1097 63
    i 5.838 87.645 0.100 1 1091 83
    i 5.839 87.711 0.100 1 1107 59
    i 5.840 87.812 0.100 1 1097 55
    i 5.841 87.885 0.100 1 1103 49
    i 5.842 87.897 0.100 1 1099 61
    i 5.843 87.959 0.100 1 1103 49
    i 5.844 87.988 0.100 1 1099 55
    i 5.845 88.043 0.100 1 1107 56
    i 5.846 88.191 0.100 1 1095 43
    i 5.847 88.221 0.100 1 1092 68
    i 5.848 88.257 0.100 1 1092 80
    i 5.849 88.483 0.100 1 1102 64
    i 5.850 88.615 0.100 1 1101 77
    i 5.851 88.685 0.100 1 1105 63
    i 5.852 88.700 0.100 1 1099 70
    i 5.853 88.745 0.100 1 1097 68
    i 5.854 88.767 0.100 1 1091 45
    i 5.855 88.769 0.100 1 1101 50
    i 5.856 88.821 0.100 1 1101 68
    i 5.857 88.833 0.100 1 1094 84
    i 5.858 89.025 0.100 1 1099 76
    i 5.859 89.149 0.100 1 1098 75
    i 5.860 89.151 0.100 1 1107 58
    i 5.861 89.191 0.100 1 1101 49
    i 5.862 89.345 0.100 1 1098 65
    i 5.863 89.372 0.100 1 1089 56
    i 5.864 89.396 0.100 1 1111 79
    i 5.865 89.399 0.100 1 1095 52
    i 5.866 89.416 0.100 1 1104 66
    i 5.867 89.441 0.100 1 1099 77
    i 5.868 89.444 0.100 1 1103 72
    i 5.869 89.664 0.100 1 1094 67
    i 5.870 89.721 0.100 1 1096 74
    i 5.871 89.799 0.100 1 1100 54
    i 5.872 89.923 0.100 1 1108 50
    i 5.873 89.961 0.100 1 1098 53
    i 5.874 90.037 0.100 1 1097 68
    i 5.875 90.067 0.100 1 1108 51
    i 5.876 90.155 0.100 1 1103 75
    i 5.877 90.157 0.100 1 1099 62
    i 5.878 90.173 0.100 1 1094 63
    i 5.879 90.176 0.100 1 1105 56
    i 5.880 90.248 0.100 1 1096 77
    i 5.881 90.363 0.100 1 1106 68
    i 5.882 90.559 0.100 1 1094 69
    i 5.883 90.589 0.100 1 1106 73
    i 5.884 90.599 0.100 1 1104 78
    i 5.885 90.653 0.100 1 1098 56
    i 5.886 90.723 0.100 1 1099 56
    i 5.887 90.755 0.100 1 1096 58
    i 5.888 90.863 0.100 1 1100 59
    i 5.889 90.888 0.100 1 1096 75
    i 5.890 90.933 0.100 1 1090 75
    i 5.891 91.009 0.100 1 1104 61
    i 5.892 91.063 0.100 1 1101 53
    i 5.893 91.121 0.100 1 1096 55
    i 5.894 91.221 0.100 1 1100 53
    i 5.895 91.221 0.100 1 1106 55
    i 5.896 91.288 0.100 1 1104 83
    i 5.897 91.351 0.100 1 1098 71
    i 5.898 91.431 0.100 1 1102 79
    i 5.899 91.541 0.100 1 1098 69
    i 5.900 91.625 0.100 1 1096 73
    i 5.901 91.688 0.100 1 1102 76
    i 5.902 91.803 0.100 1 1102 55
    i 5.903 91.813 0.100 1 1090 66
    i 5.904 91.836 0.100 1 1103 53
    i 5.905 91.864 0.100 1 1106 64
    i 5.906 91.979 0.100 1 1094 69
    i 4.277 92.001 0.490 3 36 127 0
    i 4.278 92.501 0.490 3 36 127 1
    i 4.279 93.501 0.490 3 36 127 2
    i 4.280 95.001 0.490 3 36 127 3
    i 4.281 97.001 0.490 3 36 127 4
    i 5.907 92.121 0.100 1 1096 57
    i 5.908 92.133 0.100 1 1098 82
    i 5.909 92.156 0.100 1 1090 77
    i 5.910 92.256 0.100 1 1106 51
    i 5.911 92.296 0.100 1 1100 81
    i 5.912 92.447 0.100 1 1102 65
    i 5.913 92.521 0.100 1 1100 73
    i 5.914 92.525 0.100 1 1098 49
    i 5.915 92.633 0.100 1 1102 58
    i 5.916 92.656 0.100 1 1096 71
    i 5.917 92.696 0.100 1 1093 70
    i 5.918 92.720 0.100 1 1092 69
    i 4.283 92.751 0.490 3 36 127 0
    i 4.284 93.251 0.490 3 36 127 1
    i 4.285 94.251 0.490 3 36 127 2
    i 4.286 95.751 0.490 3 36 127 3
    i 4.287 97.751 0.490 3 36 127 4
    i 5.919 92.801 0.100 1 1108 59
    i 5.920 93.037 0.100 1 1110 51
    i 5.921 93.068 0.100 1 1102 69
    i 5.922 93.096 0.100 1 1104 68
    i 5.923 93.125 0.100 1 1100 66
    i 5.924 93.160 0.100 1 1090 59
    i 5.925 93.197 0.100 1 1100 74
    i 5.926 93.200 0.100 1 1100 71
    i 5.927 93.251 0.100 1 1095 80
    i 5.928 93.328 0.100 1 1096 74
    i 5.929 93.409 0.100 1 1100 72
    i 5.930 93.529 0.100 1 1098 73
    i 5.931 93.659 0.100 1 1097 68
    i 5.932 93.784 0.100 1 1097 80
    i 5.933 93.789 0.100 1 1102 69
    i 5.934 93.843 0.100 1 1088 44
    i 5.935 93.852 0.100 1 1108 61
    i 5.936 93.887 0.100 1 1108 65
    i 5.937 93.929 0.100 1 1104 50
    i 5.938 93.936 0.100 1 1096 63
    i 5.939 93.947 0.100 1 1104 54
    i 5.940 93.988 0.100 1 1098 80
    i 5.941 94.033 0.100 1 1102 57
    i 5.942 94.048 0.100 1 1100 70
    i 5.943 94.219 0.100 1 1095 62
    i 5.944 94.453 0.100 1 1098 49
    i 5.945 94.464 0.100 1 1105 48
    i 5.946 94.507 0.100 1 1106 53
    i 5.947 94.567 0.100 1 1104 75
    i 5.948 94.581 0.100 1 1108 55
    i 5.949 94.649 0.100 1 1095 76
    i 5.950 94.664 0.100 1 1095 69
    i 5.951 94.704 0.100 1 1096 69
    i 5.952 94.705 0.100 1 1098 59
    i 5.953 94.739 0.100 1 1106 77
    i 5.954 94.964 0.100 1 1094 65
    i 5.955 95.156 0.100 1 1100 59
    i 5.956 95.161 0.100 1 1099 59
    i 5.957 95.176 0.100 1 1097 78
    i 5.958 95.273 0.100 1 1106 80
    i 5.959 95.323 0.100 1 1098 57
    i 5.960 95.372 0.100 1 1096 75
    i 5.961 95.373 0.100 1 1107 74
    i 5.962 95.380 0.100 1 1089 51
    i 5.963 95.457 0.100 1 1101 53
    i 5.964 95.639 0.100 1 1103 50
    i 5.965 95.664 0.100 1 1096 44
    i 5.966 95.717 0.100 1 1101 70
    i 5.967 95.771 0.100 1 1094 55
    i 5.968 95.827 0.100 1 1097 79
    i 5.969 95.851 0.100 1 1103 82
    i 4.289 96.001 0.490 3 36 127 0
    i 4.290 96.501 0.490 3 36 127 1
    i 4.291 97.501 0.490 3 36 127 2
    i 4.292 99.001 0.490 3 36 127 3
    i 4.293 101.001 0.490 3 36 127 4
    i 5.970 96.037 0.100 1 1096 49
    i 5.971 96.081 0.100 1 1101 63
    i 5.972 96.111 0.100 1 1103 52
    i 5.973 96.180 0.100 1 1099 66
    i 5.974 96.216 0.100 1 1091 61
    i 5.975 96.252 0.100 1 1103 62
    i 5.976 96.443 0.100 1 1095 73
    i 5.977 96.531 0.100 1 1107 61
    i 5.978 96.575 0.100 1 1099 68
    i 5.979 96.652 0.100 1 1095 62
    i 5.980 96.664 0.100 1 1091 83
    i 5.981 96.731 0.100 1 1101 70
    i 4.295 96.751 0.490 3 36 127 0
    i 4.296 97.251 0.490 3 36 127 1
    i 4.297 98.251 0.490 3 36 127 2
    i 4.298 99.751 0.490 3 36 127 3
    i 4.299 101.751 0.490 3 36 127 4
    i 5.982 96.856 0.100 1 1106 59
    i 5.983 96.931 0.100 1 1101 62
    i 5.984 96.945 0.100 1 1101 60
    i 5.985 96.972 0.100 1 1097 78
    i 5.986 97.041 0.100 1 1097 51
    i 5.987 97.077 0.100 1 1099 75
    i 5.988 97.133 0.100 1 1094 58
    i 5.989 97.213 0.100 1 1109 61
    i 5.990 97.216 0.100 1 1093 74
    i 5.991 97.445 0.100 1 1101 70
    i 5.992 97.508 0.100 1 1099 68
    i 5.993 97.508 0.100 1 1103 78
    i 5.994 97.623 0.100 1 1089 72
    i 5.995 97.652 0.100 1 1103 73
    i 5.996 97.667 0.100 1 1096 76
    i 5.997 97.732 0.100 1 1099 57
    i 5.998 97.739 0.100 1 1099 75
    i 5.999 97.740 0.100 1 1099 78
    i 5.001 97.820 0.100 1 1095 58
    i 5.002 97.881 0.100 1 1109 52
    i 5.003 98.167 0.100 1 1097 80
    i 5.004 98.223 0.100 1 1096 72
    i 5.005 98.375 0.100 1 1105 64
    i 5.006 98.383 0.100 1 1097 52
    i 5.007 98.384 0.100 1 1089 48
    i 5.008 98.388 0.100 1 1103 60
    i 5.009 98.429 0.100 1 1097 65
    i 5.010 98.476 0.100 1 1103 75
    i 5.011 98.476 0.100 1 1101 69
    i 5.012 98.497 0.100 1 1101 79
    i 5.013 98.639 0.100 1 1109 56
    i 5.014 98.715 0.100 1 1095 55
    i 5.015 98.781 0.100 1 1107 62
    i 5.016 98.912 0.100 1 1099 56
    i 5.017 98.952 0.100 1 1107 79
    i 5.018 98.977 0.100 1 1105 61
    i 5.019 99.081 0.100 1 1094 65
    i 5.020 99.124 0.100 1 1095 54
    i 5.021 99.165 0.100 1 1107 69
    i 5.022 99.245 0.100 1 1103 65
    i 5.023 99.267 0.100 1 1095 62
    i 5.024 99.325 0.100 1 1097 67
    i 5.025 99.421 0.100 1 1105 56
    i 5.026 99.653 0.100 1 1098 60
    i 5.027 99.669 0.100 1 1100 61
    i 5.028 99.680 0.100 1 1105 74
    i 5.029 99.793 0.100 1 1089 80
    i 5.030 99.812 0.100 1 1101 72
    i 5.031 99.853 0.100 1 1102 76
    i 5.032 99.920 0.100 1 1097 51
    i 5.033 99.933 0.100 1 1097 74
    i 5.034 99.957 0.100 1 1105 65
    i 4.301 100.001 0.490 3 36 127 0
    i 4.302 100.501 0.490 3 36 127 1
    i 4.303 101.501 0.490 3 36 127 2
    i 4.304 103.001 0.490 3 36 127 3
    i 4.305 105.001 0.490 3 36 127 4
    i 5.035 100.205 0.100 1 1095 55
    i 5.036 100.213 0.100 1 1102 66
    i 5.037 100.228 0.100 1 1093 51
    i 5.038 100.269 0.100 1 1103 77
    i 5.039 100.359 0.100 1 1096 56
    i 5.040 100.447 0.100 1 1097 61
    i 5.041 100.484 0.100 1 1107 72
    i 5.042 100.501 0.100 1 1103 63
    i 5.043 100.547 0.100 1 1103 59
    i 5.044 100.584 0.100 1 1091 72
    i 5.045 100.669 0.100 1 1102 52
    i 4.307 100.751 0.490 3 36 127 0
    i 4.308 101.251 0.490 3 36 127 1
    i 4.309 102.251 0.490 3 36 127 2
    i 4.310 103.751 0.490 3 36 127 3
    i 4.311 105.751 0.490 3 36 127 4
    i 5.046 100.896 0.100 1 1099 50
    i 5.047 100.907 0.100 1 1095 70
    i 5.048 100.908 0.100 1 1108 59
    i 5.049 100.947 0.100 1 1095 79
    i 5.050 101.104 0.100 1 1099 63
    i 5.051 101.160 0.100 1 1100 73
    i 5.052 101.172 0.100 1 1092 71
    i 5.053 101.239 0.100 1 1094 59
    i 5.054 101.385 0.100 1 1096 78
    i 5.055 101.428 0.100 1 1097 62
    i 5.056 101.443 0.100 1 1105 57
    i 5.057 101.479 0.100 1 1100 61
    i 5.058 101.480 0.100 1 1110 61
    i 5.059 101.492 0.100 1 1101 58
    i 5.060 101.572 0.100 1 1094 57
    i 5.061 101.713 0.100 1 1094 65
    i 5.062 101.853 0.100 1 1102 79
    i 5.063 101.900 0.100 1 1101 81
    i 5.064 101.980 0.100 1 1103 50
    i 4.313 102.001 0.490 3 36 127 0
    i 4.314 102.501 0.490 3 36 127 1
    i 4.315 103.501 0.490 3 36 127 2
    i 4.316 105.001 0.490 3 36 127 3
    i 4.317 107.001 0.490 3 36 127 4
    i 5.065 102.031 0.100 1 1112 49
    i 5.066 102.084 0.100 1 1097 66
    i 5.067 102.088 0.100 1 1088 67
    i 5.068 102.147 0.100 1 1098 58
    i 5.069 102.153 0.100 1 1098 67
    i 5.070 102.184 0.100 1 1104 84
    i 5.071 102.188 0.100 1 1100 48
    i 5.072 102.261 0.100 1 1100 54
    i 5.073 102.277 0.100 1 1094 68
    i 5.074 102.589 0.100 1 1098 56
    i 5.075 102.661 0.100 1 1095 66
    i 5.076 102.676 0.100 1 1096 62
    i 5.077 102.749 0.100 1 1096 63
    i 4.319 102.751 0.490 3 36 127 0
    i 4.320 103.251 0.490 3 36 127 1
    i 4.321 104.251 0.490 3 36 127 2
    i 4.322 105.751 0.490 3 36 127 3
    i 4.323 107.751 0.490 3 36 127 4
    i 5.078 102.796 0.100 1 1098 64
    i 5.079 102.863 0.100 1 1110 60
    i 5.080 102.913 0.100 1 1103 73
    i 5.081 102.928 0.100 1 1090 65
    i 5.082 102.936 0.100 1 1106 48
    i 5.083 102.953 0.100 1 1102 57
    i 5.084 103.027 0.100 1 1108 62
    i 5.085 103.099 0.100 1 1108 79
    i 5.086 103.213 0.100 1 1094 81
    i 5.087 103.251 0.100 1 1102 64
    i 5.088 103.369 0.100 1 1100 69
    i 5.089 103.499 0.100 1 1093 72
    i 5.090 103.512 0.100 1 1106 66
    i 5.091 103.513 0.100 1 1102 74
    i 5.092 103.547 0.100 1 1096 83
    i 5.093 103.668 0.100 1 1106 51
    i 5.094 103.708 0.100 1 1094 58
    i 5.095 103.712 0.100 1 1106 65
    i 5.096 103.775 0.100 1 1106 72
    i 5.097 103.808 0.100 1 1104 73
    i 5.098 103.911 0.100 1 1096 47
    i 4.325 104.001 0.490 3 36 127 0
    i 4.326 104.501 0.490 3 36 127 1
    i 4.327 105.501 0.490 3 36 127 2
    i 4.328 107.001 0.490 3 36 127 3
    i 4.329 109.001 0.490 3 36 127 4
    i 5.099 104.053 0.100 1 1104 79
    i 4.331 104.125 0.490 3 43 127 0
    i 4.332 104.625 0.490 3 43 127 1
    i 4.333 105.625 0.490 3 43 127 2
    i 5.100 104.131 0.100 1 1098 72
    i 4.334 107.125 0.490 3 43 127 3
    i 4.335 109.125 0.490 3 43 127 4
    i 5.101 104.173 0.100 1 1104 69
    i 5.102 104.180 0.100 1 1100 56
    i 5.103 104.205 0.100 1 1090 60
    i 5.104 104.249 0.100 1 1103 66
    i 5.105 104.383 0.100 1 1096 71
    i 5.106 104.495 0.100 1 1098 51
    i 5.107 104.520 0.100 1 1104 69
    i 5.108 104.527 0.100 1 1106 69
    i 5.109 104.643 0.100 1 1102 74
    i 5.110 104.647 0.100 1 1102 69
    i 5.111 104.713 0.100 1 1101 79
    i 5.112 104.713 0.100 1 1094 63
    i 5.113 104.751 0.100 1 1106 75
    i 4.337 104.751 0.490 3 36 127 0
    i 4.338 105.251 0.490 3 36 127 1
    i 4.339 106.251 0.490 3 36 127 2
    i 4.340 107.751 0.490 3 36 127 3
    i 4.341 109.751 0.490 3 36 127 4
    i 4.343 104.876 0.490 3 43 127 0
    i 4.344 105.376 0.490 3 43 127 1
    i 4.345 106.376 0.490 3 43 127 2
    i 4.346 107.876 0.490 3 43 127 3
    i 4.347 109.876 0.490 3 43 127 4
    i 5.114 104.891 0.100 1 1096 67
    i 5.115 104.951 0.100 1 1092 75
    i 5.116 105.044 0.100 1 1098 57
    i 5.117 105.044 0.100 1 1108 74
    i 5.118 105.068 0.100 1 1094 67
    i 5.119 105.087 0.100 1 1101 75
    i 5.120 105.156 0.100 1 1104 57
    i 5.121 105.185 0.100 1 1102 80
    i 5.122 105.264 0.100 1 1108 80
    i 5.123 105.336 0.100 1 1096 67
    i 5.124 105.379 0.100 1 1100 76
    i 5.125 105.580 0.100 1 1104 76
    i 5.126 105.684 0.100 1 1093 79
    i 5.127 105.699 0.100 1 1096 71
    i 5.128 105.704 0.100 1 1100 58
    i 5.129 105.764 0.100 1 1100 56
    i 5.130 105.764 0.100 1 1100 73
    i 5.131 105.797 0.100 1 1096 57
    i 5.132 105.825 0.100 1 1093 64
    i 5.133 105.852 0.100 1 1104 54
    i 5.134 105.895 0.100 1 1098 60
    i 5.135 105.937 0.100 1 1100 75
    i 4.349 106.001 0.490 3 36 127 0
    i 4.350 106.501 0.490 3 36 127 1
    i 4.351 107.501 0.490 3 36 127 2
    i 4.352 109.001 0.490 3 36 127 3
    i 4.353 111.001 0.490 3 36 127 4
    i 5.136 106.011 0.100 1 1095 53
    i 5.137 106.089 0.100 1 1110 63
    i 4.355 106.125 0.490 3 43 127 0
    i 4.356 106.625 0.490 3 43 127 1
    i 4.357 107.625 0.490 3 43 127 2
    i 4.358 109.125 0.490 3 43 127 3
    i 4.359 111.125 0.490 3 43 127 4
    i 5.138 106.213 0.100 1 1095 64
    i 5.139 106.296 0.100 1 1102 71
    i 5.140 106.332 0.100 1 1102 66
    i 5.141 106.344 0.100 1 1101 62
    i 5.142 106.439 0.100 1 1098 57
    i 5.143 106.523 0.100 1 1097 82
    i 5.144 106.537 0.100 1 1098 73
    i 5.145 106.564 0.100 1 1100 69
    i 5.146 106.576 0.100 1 1102 70
    i 5.147 106.632 0.100 1 1088 61
    i 5.148 106.716 0.100 1 1103 52
    i 5.149 106.735 0.100 1 1093 58
    i 4.361 106.751 0.490 3 36 127 0
    i 4.362 107.251 0.490 3 36 127 1
    i 4.363 108.251 0.490 3 36 127 2
    i 4.364 109.751 0.490 3 36 127 3
    i 4.365 111.751 0.490 3 36 127 4
    i 4.367 106.876 0.490 3 43 127 0
    i 4.368 107.376 0.490 3 43 127 1
    i 4.369 108.376 0.490 3 43 127 2
    i 4.370 109.876 0.490 3 43 127 3
    i 4.371 111.876 0.490 3 43 127 4
    i 5.150 106.899 0.100 1 1112 67
    i 5.151 106.968 0.100 1 1107 70
    i 5.152 107.056 0.100 1 1101 69
    i 5.153 107.107 0.100 1 1096 75
    i 5.154 107.121 0.100 1 1095 61
    i 5.155 107.165 0.100 1 1098 80
    i 5.156 107.188 0.100 1 1095 63
    i 5.157 107.191 0.100 1 1107 52
    i 5.158 107.263 0.100 1 1099 54
    i 5.159 107.321 0.100 1 1104 65
    i 5.160 107.383 0.100 1 1107 69
    i 5.161 107.411 0.100 1 1109 69
    i 5.162 107.431 0.100 1 1101 59
    i 5.163 107.549 0.100 1 1091 62
    i 5.164 107.644 0.100 1 1105 53
    i 5.165 107.713 0.100 1 1093 75
    i 5.166 107.813 0.100 1 1103 70
    i 5.167 107.881 0.100 1 1101 56
    i 5.168 107.937 0.100 1 1092 71
    i 5.169 107.969 0.100 1 1097 61
    i 5.170 108.001 0.100 1 1102 61
    i 4.373 108.001 0.490 3 36 127 0
    i 4.374 108.501 0.490 3 36 127 1
    i 4.375 109.501 0.490 3 36 127 2
    i 4.376 111.001 0.490 3 36 127 3
    i 4.377 113.001 0.490 3 36 127 4
    i 5.171 108.028 0.100 1 1095 74
    i 5.172 108.036 0.100 1 1105 57
    i 5.173 108.108 0.100 1 1106 61
    i 4.379 108.125 0.490 3 43 127 0
    i 4.380 108.625 0.490 3 43 127 1
    i 4.381 109.625 0.490 3 43 127 2
    i 4.382 111.125 0.490 3 43 127 3
    i 4.383 113.125 0.490 3 43 127 4
    i 5.174 108.159 0.100 1 1105 48
    i 5.175 108.172 0.100 1 1107 48
    i 4.385 108.251 0.490 3 48 127 0
    i 4.386 108.751 0.490 3 48 127 1
    i 4.387 109.751 0.490 3 48 127 2
    i 4.388 111.251 0.490 3 48 127 3
    i 4.389 113.251 0.490 3 48 127 4
    i 5.176 108.269 0.100 1 1105 48
    i 5.177 108.361 0.100 1 1103 63
    i 5.178 108.453 0.100 1 1095 61
    i 5.179 108.573 0.100 1 1105 55
    i 5.180 108.608 0.100 1 1099 58
    i 5.181 108.667 0.100 1 1102 63
    i 5.182 108.673 0.100 1 1091 52
    i 5.183 108.692 0.100 1 1101 74
    i 4.391 108.751 0.490 3 36 127 0
    i 4.392 109.251 0.490 3 36 127 1
    i 4.393 110.251 0.490 3 36 127 2
    i 4.394 111.751 0.490 3 36 127 3
    i 4.395 113.751 0.490 3 36 127 4
    i 5.184 108.773 0.100 1 1107 60
    i 5.185 108.791 0.100 1 1097 52
    i 4.397 108.876 0.490 3 43 127 0
    i 4.398 109.376 0.490 3 43 127 1
    i 4.399 110.376 0.490 3 43 127 2
    i 4.400 111.876 0.490 3 43 127 3
    i 4.401 113.876 0.490 3 43 127 4
    i 5.186 108.941 0.100 1 1099 51
    i 5.187 108.943 0.100 1 1109 73
    i 5.188 108.961 0.100 1 1103 74
    i 4.403 109.001 0.490 3 48 127 0
    i 4.404 109.501 0.490 3 48 127 1
    i 4.405 110.501 0.490 3 48 127 2
    i 4.406 112.001 0.490 3 48 127 3
    i 4.407 114.001 0.490 3 48 127 4
    i 5.189 109.023 0.100 1 1101 53
    i 5.190 109.072 0.100 1 1103 80
    i 5.191 109.177 0.100 1 1093 49
    i 5.192 109.213 0.100 1 1101 58
    i 5.193 109.375 0.100 1 1093 50
    i 5.194 109.380 0.100 1 1095 62
    i 5.195 109.423 0.100 1 1095 53
    i 5.196 109.512 0.100 1 1099 59
    i 5.197 109.525 0.100 1 1100 59
    i 5.198 109.624 0.100 1 1103 66
    i 5.199 109.640 0.100 1 1099 52
    i 5.200 109.672 0.100 1 1101 78
    i 5.201 109.721 0.100 1 1097 74
    i 5.202 109.748 0.100 1 1101 65
    i 5.203 109.780 0.100 1 1105 73
    i 5.204 109.893 0.100 1 1109 53
    i 5.205 109.923 0.100 1 1097 57
    i 4.409 110.001 0.490 3 36 127 0
    i 4.410 110.501 0.490 3 36 127 1
    i 4.411 111.501 0.490 3 36 127 2
    i 4.412 113.001 0.490 3 36 127 3
    i 4.413 115.001 0.490 3 36 127 4
    i 4.415 110.125 0.490 3 43 127 0
    i 4.416 110.625 0.490 3 43 127 1
    i 4.417 111.625 0.490 3 43 127 2
    i 4.418 113.125 0.490 3 43 127 3
    i 4.419 115.125 0.490 3 43 127 4
    i 5.206 110.196 0.100 1 1093 52
    i 4.421 110.251 0.490 3 52 64 0
    i 4.422 110.751 0.490 3 52 64 1
    i 4.423 111.751 0.490 3 52 64 2
    i 4.424 113.251 0.490 3 52 64 3
    i 4.425 115.251 0.490 3 52 64 4
    i 5.207 110.261 0.100 1 1103 65
    i 5.208 110.265 0.100 1 1095 55
    i 5.209 110.357 0.100 1 1099 69
    i 5.210 110.379 0.100 1 1101 59
    i 5.211 110.385 0.100 1 1099 74
    i 5.212 110.388 0.100 1 1101 77
    i 5.213 110.412 0.100 1 1093 63
    i 5.214 110.471 0.100 1 1096 68
    i 5.215 110.588 0.100 1 1101 71
    i 5.216 110.609 0.100 1 1099 64
    i 5.217 110.701 0.100 1 1099 59
    i 5.218 110.713 0.100 1 1096 62
    i 4.427 110.751 0.490 3 36 127 0
    i 4.428 111.251 0.490 3 36 127 1
    i 4.429 112.251 0.490 3 36 127 2
    i 4.430 113.751 0.490 3 36 127 3
    i 4.431 115.751 0.490 3 36 127 4
    i 5.219 110.815 0.100 1 1109 75
    i 4.433 110.876 0.490 3 43 127 0
    i 4.434 111.376 0.490 3 43 127 1
    i 4.435 112.376 0.490 3 43 127 2
    i 4.436 113.876 0.490 3 43 127 3
    i 4.437 115.876 0.490 3 43 127 4
    i 5.220 110.896 0.100 1 1103 72
    i 5.221 111.004 0.100 1 1098 64
    i 4.439 111.001 0.490 3 52 64 0
    i 4.440 111.501 0.490 3 52 64 1
    i 4.441 112.501 0.490 3 52 64 2
    i 4.442 114.001 0.490 3 52 64 3
    i 4.443 116.001 0.490 3 52 64 4
    i 5.222 111.041 0.100 1 1097 80
    i 5.223 111.044 0.100 1 1107 64
    i 5.224 111.161 0.100 1 1097 52
    i 5.225 111.173 0.100 1 1089 44
    i 5.226 111.173 0.100 1 1101 71
    i 5.227 111.215 0.100 1 1097 51
    i 5.228 111.248 0.100 1 1103 60
    i 5.229 111.248 0.100 1 1093 53
    i 5.230 111.512 0.100 1 1111 49
    i 5.231 111.527 0.100 1 1101 63
    i 5.232 111.551 0.100 1 1095 75
    i 5.233 111.624 0.100 1 1094 57
    i 5.234 111.700 0.100 1 1094 72
    i 5.235 111.731 0.100 1 1107 64
    i 5.236 111.732 0.100 1 1105 61
    i 5.237 111.821 0.100 1 1099 74
    i 5.238 111.908 0.100 1 1100 82
    i 5.239 111.944 0.100 1 1107 68
    i 5.240 111.964 0.100 1 1103 79
    i 5.241 112.007 0.100 1 1104 77
    i 4.445 112.001 0.490 3 36 127 0
    i 4.446 112.501 0.490 3 36 127 1
    i 4.447 113.501 0.490 3 36 127 2
    i 4.448 115.001 0.490 3 36 127 3
    i 4.449 117.001 0.490 3 36 127 4
    i 5.242 112.031 0.100 1 1104 75
    i 6.001 112.001 -1 3 26 14
    i 6.002 112.090 -1 3 8 21
    i 6.003 112.179 -1 3 27 23
    i 6.004 112.268 -1 3 3 13
    i 6.005 112.357 -1 3 0 4
    i 6.006 112.446 -1 3 15 3
    i 6.007 112.535 -1 3 18 13
    i 6.008 112.624 -1 3 25 29
    i 6.009 112.712 -1 3 26 27
    i 6.010 112.801 -1 3 16 24
    i 6.011 112.890 -1 3 20 29
    i 6.012 112.979 -1 3 13 17
    i 6.013 113.068 -1 3 21 10
    i 6.014 113.157 -1 3 0 11
    i 6.015 113.246 -1 3 22 21
    i 6.016 113.335 -1 3 22 22
    i 6.017 113.424 -1 3 7 27
    i 6.018 113.512 -1 3 9 1
    i 6.019 113.601 -1 3 0 26
    i 6.020 113.690 -1 3 16 23
    i 6.021 113.779 -1 3 27 26
    i 6.022 113.868 -1 3 11 29
    i 6.023 113.957 -1 3 18 5
    i 6.024 114.046 -1 3 24 0
    i 6.025 114.135 -1 3 12 29
    i 6.026 114.224 -1 3 20 11
    i 6.027 114.312 -1 3 26 5
    i 6.028 114.401 -1 3 3 17
    i 6.029 114.490 -1 3 24 19
    i 6.030 114.579 -1 3 13 8
    i 6.031 114.668 -1 3 29 0
    i 6.032 114.757 -1 3 6 4
    i 6.033 114.846 -1 3 27 16
    i 6.034 114.935 -1 3 21 28
    i 6.035 115.024 -1 3 12 12
    i 6.036 115.112 -1 3 22 0
    i 6.037 115.201 -1 3 3 22
    i 6.038 115.290 -1 3 9 15
    i 6.039 115.379 -1 3 7 15
    i 6.040 115.468 -1 3 26 21
    i 6.041 115.557 -1 3 12 8
    i 6.042 115.646 -1 3 0 2
    i 6.043 115.735 -1 3 3 28
    i 6.044 115.824 -1 3 21 20
    i 6.045 115.912 -1 3 22 28
    i 6.046 116.001 -1 3 19 2
    i 6.047 116.090 -1 3 10 23
    i 6.048 116.179 -1 3 27 25
    i 6.049 116.268 -1 3 14 12
    i 6.050 116.357 -1 3 14 21
    i 6.051 116.446 -1 3 26 28
    i 6.052 116.535 -1 3 20 17
    i 6.053 116.624 -1 3 2 25
    i 6.054 116.712 -1 3 25 1
    i 6.055 116.801 -1 3 17 1
    i 6.056 116.890 -1 3 23 8
    i 6.057 116.979 -1 3 23 29
    i 6.058 117.068 -1 3 28 10
    i 6.059 117.157 -1 3 6 24
    i 6.060 117.246 -1 3 28 17
    i 6.061 117.335 -1 3 19 15
    i 6.062 117.424 -1 3 24 16
    i 6.063 117.512 -1 3 15 19
    i 6.064 117.601 -1 3 11 6
    i 6.065 117.690 -1 3 28 26
    i 6.066 117.779 -1 3 11 23
    i 6.067 117.868 -1 3 15 5
    i 6.068 117.957 -1 3 22 3
    i 6.069 118.046 -1 3 15 20
    i 6.070 118.135 -1 3 29 8
    i 6.071 118.224 -1 3 8 7
    i 6.072 118.312 -1 3 0 14
    i 6.073 118.401 -1 3 24 29
    i 6.074 118.490 -1 3 3 16
    i 6.075 118.579 -1 3 9 24
    i 6.076 118.668 -1 3 7 28
    i 6.077 118.757 -1 3 6 7
    i 6.078 118.846 -1 3 13 0
    i 6.079 118.935 -1 3 11 19
    i 6.080 119.024 -1 3 29 12
    i 6.081 119.112 -1 3 15 18
    i 6.082 119.201 -1 3 22 20
    i 6.083 119.290 -1 3 25 22
    i 6.084 119.379 -1 3 16 1
    i 6.085 119.468 -1 3 3 7
    i 6.086 119.557 -1 3 21 29
    i 6.087 119.646 -1 3 3 4
    i 6.088 119.735 -1 3 3 19
    i 6.089 119.824 -1 3 24 27
    i 6.090 119.912 -1 3 27 13
    i 6.091 120.001 -1 3 9 3
    i 6.092 120.090 -1 3 0 24
    i 6.093 120.179 -1 3 16 7
    i 6.094 120.268 -1 3 21 0
    i 6.095 120.357 -1 3 16 21
    i 6.096 120.446 -1 3 3 26
    i 6.097 120.535 -1 3 10 0
    i 6.098 120.624 -1 3 27 27
    i 6.099 120.712 -1 3 12 10
    i 6.100 120.801 -1 3 4 1
    i 6.101 120.890 -1 3 10 6
    i 6.102 120.979 -1 3 21 3
    i 6.103 121.068 -1 3 2 26
    i 6.104 121.157 -1 3 19 19
    i 6.105 121.246 -1 3 0 1
    i 6.106 121.335 -1 3 1 10
    i 6.107 121.424 -1 3 1 20
    i 6.108 121.512 -1 3 14 9
    i 6.109 121.601 -1 3 29 28
    i 6.110 121.690 -1 3 6 0
    i 6.111 121.779 -1 3 17 29
    i 6.112 121.868 -1 3 9 2
    i 6.113 121.957 -1 3 10 18
    i 6.114 122.046 -1 3 25 14
    i 6.115 122.135 -1 3 24 18
    i 6.116 122.224 -1 3 0 19
    i 6.117 122.312 -1 3 10 21
    i 6.118 122.401 -1 3 17 11
    i 6.119 122.490 -1 3 28 1
    i 6.120 122.579 -1 3 8 24
    i 6.121 122.668 -1 3 7 10
    i 6.122 122.757 -1 3 2 16
    i 6.123 122.846 -1 3 23 22
    i 6.124 122.935 -1 3 26 26
    i 6.125 123.024 -1 3 28 4
    i 6.126 123.112 -1 3 11 9
    i 6.127 123.201 -1 3 11 14
    i 6.128 123.290 -1 3 3 21
    i 6.129 123.379 -1 3 4 17
    i 6.130 123.468 -1 3 19 18
    i 6.131 123.557 -1 3 6 27
    i 6.132 123.646 -1 3 6 23
    i 6.133 123.735 -1 3 21 11
    i 6.134 123.824 -1 3 21 19
    i 6.135 123.912 -1 3 7 6
    i 6.136 124.001 -1 3 25 11
    i 6.137 124.090 -1 3 0 7
    i 6.138 124.179 -1 3 2 27
    i 6.139 124.268 -1 3 12 23
    i 6.140 124.357 -1 3 17 14
    i 6.141 124.446 -1 3 17 9
    i 6.142 124.535 -1 3 5 10
    i 6.143 124.624 -1 3 11 7
    i 6.144 124.712 -1 3 11 2
    i 6.145 124.801 -1 3 20 24
    i 6.146 124.890 -1 3 6 6
    i 6.147 124.979 -1 3 17 15
    i 6.148 125.068 -1 3 11 0
    i 6.149 125.157 -1 3 7 7
    i 6.150 125.246 -1 3 23 11
    i 6.151 125.335 -1 3 27 6
    i 6.152 125.424 -1 3 10 24
    i 6.153 125.512 -1 3 0 29
    i 6.154 125.601 -1 3 4 3
    i 6.155 125.690 -1 3 23 6
    i 6.156 125.779 -1 3 28 25
    i 6.157 125.868 -1 3 23 25
    i 6.158 125.957 -1 3 16 13
    i 6.159 126.046 -1 3 28 19
    i 6.160 126.135 -1 3 3 11
    i 6.161 126.224 -1 3 7 12
    i 6.162 126.312 -1 3 19 1
    i 6.163 126.401 -1 3 28 12
    i 6.164 126.490 -1 3 20 13
    i 6.165 126.579 -1 3 24 3
    i 6.166 126.668 -1 3 5 7
    i 6.167 126.757 -1 3 11 25
    i 6.168 126.846 -1 3 4 28
    i 6.169 126.935 -1 3 6 11
    i 6.170 127.024 -1 3 24 10
    i 6.171 127.112 -1 3 29 7
    i 6.172 127.201 -1 3 18 18
    i 6.173 127.290 -1 3 27 29
    i 6.174 127.379 -1 3 1 24
    i 6.175 127.468 -1 3 21 21
    i 6.176 127.557 -1 3 21 7
    i 6.177 127.646 -1 3 1 19
    i 6.178 127.735 -1 3 29 4
    i 6.179 127.824 -1 3 24 11
    i 6.180 127.912 -1 3 4 26
    i 6.181 128.001 -1 3 5 9
    i 6.182 128.090 -1 3 20 28
    i 6.183 128.179 -1 3 1 2
    i 6.184 128.268 -1 3 27 22
    i 6.185 128.357 -1 3 12 15
    i 6.186 128.446 -1 3 27 20
    i 6.187 128.535 -1 3 21 4
    i 6.188 128.624 -1 3 12 20
    i 6.189 128.712 -1 3 18 3
    i 6.190 128.801 -1 3 12 3
    i 6.191 128.890 -1 3 25 20
    i 6.192 128.979 -1 3 28 6
    i 6.193 129.068 -1 3 7 24
    i 6.194 129.157 -1 3 18 8
    i 6.195 129.246 -1 3 13 9
    i 6.196 129.335 -1 3 14 26
    i 6.197 129.424 -1 3 23 7
    i 6.198 129.512 -1 3 4 13
    i 6.199 129.601 -1 3 10 25
    i 6.200 129.690 -1 3 22 16
    i 6.201 129.779 -1 3 7 16
    i 6.202 129.868 -1 3 28 5
    i 6.203 129.957 -1 3 18 2
    i 6.204 130.046 -1 3 14 11
    i 6.205 130.135 -1 3 16 10
    i 6.206 130.224 -1 3 0 6
    i 6.207 130.312 -1 3 10 7
    i 6.208 130.401 -1 3 29 9
    i 6.209 130.490 -1 3 19 22
    i 6.210 130.579 -1 3 29 24
    i 6.211 130.668 -1 3 3 5
    i 6.212 130.757 -1 3 8 16
    i 6.213 130.846 -1 3 17 10
    i 6.214 130.935 -1 3 20 21
    i 6.215 131.024 -1 3 13 7
    i 6.216 131.112 -1 3 6 14
    i 6.217 131.201 -1 3 27 8
    i 6.218 131.290 -1 3 17 3
    i 6.219 131.379 -1 3 14 6
    i 6.220 131.468 -1 3 9 16
    i 6.221 131.557 -1 3 11 10
    i 6.222 131.646 -1 3 16 17
    i 6.223 131.735 -1 3 10 10
    i 6.224 131.824 -1 3 15 8
    i 6.225 131.912 -1 3 17 5
    i 6.226 132.001 -1 3 1 12
    i 6.227 132.090 -1 3 14 14
    i 6.228 132.179 -1 3 29 5
    i 6.229 132.268 -1 3 25 2
    i 6.230 132.357 -1 3 20 16
    i 6.231 132.446 -1 3 3 27
    i 6.232 132.535 -1 3 11 22
    i 6.233 132.624 -1 3 0 16
    i 6.234 132.712 -1 3 12 5
    i 6.235 132.801 -1 3 19 10
    i 6.236 132.890 -1 3 25 24
    i 6.237 132.979 -1 3 13 6
    i 6.238 133.068 -1 3 18 11
    i 6.239 133.157 -1 3 15 15
    i 6.240 133.246 -1 3 24 23
    i 6.241 133.335 -1 3 16 29
    i 6.242 133.424 -1 3 24 17
    i 6.243 133.512 -1 3 27 7
    i 6.244 133.601 -1 3 29 13
    i 6.245 133.690 -1 3 27 18
    i 6.246 133.779 -1 3 1 13
    i 6.247 133.868 -1 3 12 16
    i 6.248 133.957 -1 3 29 27
    i 6.249 134.046 -1 3 9 13
    i 6.250 134.135 -1 3 10 17
    i 6.251 134.224 -1 3 9 4
    i 6.252 134.312 -1 3 15 25
    i 6.253 134.401 -1 3 18 7
    i 6.254 134.490 -1 3 3 8
    i 6.255 134.579 -1 3 8 19
    i 6.256 134.668 -1 3 24 9
    i 6.257 134.757 -1 3 10 14
    i 6.258 134.846 -1 3 2 5
    i 6.259 134.935 -1 3 22 2
    i 6.260 135.024 -1 3 22 1
    i 6.261 135.112 -1 3 5 14
    i 6.262 135.201 -1 3 25 5
    i 6.263 135.290 -1 3 22 27
    i 6.264 135.379 -1 3 11 5
    i 6.265 135.468 -1 3 19 20
    i 6.266 135.557 -1 3 10 11
    i 6.267 135.646 -1 3 23 12
    i 6.268 135.735 -1 3 8 25
    i 6.269 135.824 -1 3 3 20
    i 6.270 135.912 -1 3 28 18
    i 6.271 136.001 -1 3 6 8
    i 6.272 136.090 -1 3 2 8
    i 6.273 136.179 -1 3 16 15
    i 6.274 136.268 -1 3 21 16
    i 6.275 136.357 -1 3 17 26
    i 6.276 136.446 -1 3 23 10
    i 6.277 136.535 -1 3 19 23
    i 6.278 136.624 -1 3 28 21
    i 6.279 136.712 -1 3 11 17
    i 6.280 136.801 -1 3 18 22
    i 6.281 136.890 -1 3 19 27
    i 6.282 136.979 -1 3 23 13
    i 6.283 137.068 -1 3 25 23
    i 6.284 137.157 -1 3 22 13
    i 6.285 137.246 -1 3 9 25
    i 6.286 137.335 -1 3 17 4
    i 6.287 137.424 -1 3 6 13
    i 6.288 137.512 -1 3 27 21
    i 6.289 137.601 -1 3 15 12
    i 6.290 137.690 -1 3 16 6
    i 6.291 137.779 -1 3 22 18
    i 6.292 137.868 -1 3 23 2
    i 6.293 137.957 -1 3 1 0
    i 6.294 138.046 -1 3 15 23
    i 6.295 138.135 -1 3 16 0
    i 6.296 138.224 -1 3 18 10
    i 6.297 138.312 -1 3 18 20
    i 6.298 138.401 -1 3 4 8
    i 6.299 138.490 -1 3 3 1
    i 6.300 138.579 -1 3 4 29
    i 6.301 138.668 -1 3 18 19
    i 6.302 138.757 -1 3 15 11
    i 6.303 138.846 -1 3 0 9
    i 6.304 138.935 -1 3 16 8
    i 6.305 139.024 -1 3 5 11
    i 6.306 139.112 -1 3 19 14
    i 6.307 139.201 -1 3 12 9
    i 6.308 139.290 -1 3 17 18
    i 6.309 139.379 -1 3 8 2
    i 6.310 139.468 -1 3 18 27
    i 6.311 139.557 -1 3 27 4
    i 6.312 139.646 -1 3 2 0
    i 6.313 139.735 -1 3 8 1
    i 6.314 139.824 -1 3 15 17
    i 6.315 139.912 -1 3 4 25
    i 6.316 140.001 -1 3 15 1
    i 6.317 140.090 -1 3 3 12
    i 6.318 140.179 -1 3 29 14
    i 6.319 140.268 -1 3 8 9
    i 6.320 140.357 -1 3 29 23
    i 6.321 140.446 -1 3 23 0
    i 6.322 140.535 -1 3 2 1
    i 6.323 140.624 -1 3 29 29
    i 6.324 140.712 -1 3 11 3
    i 6.325 140.801 -1 3 18 12
    i 6.326 140.890 -1 3 20 26
    i 6.327 140.979 -1 3 25 4
    i 6.328 141.068 -1 3 17 13
    i 6.329 141.157 -1 3 17 24
    i 6.330 141.246 -1 3 8 20
    i 6.331 141.335 -1 3 2 15
    i 6.332 141.424 -1 3 18 28
    i 6.333 141.512 -1 3 14 29
    i 6.334 141.601 -1 3 9 0
    i 6.335 141.690 -1 3 4 4
    i 6.336 141.779 -1 3 6 12
    i 6.337 141.868 -1 3 22 11
    i 6.338 141.957 -1 3 8 4
    i 6.339 142.046 -1 3 14 8
    i 6.340 142.135 -1 3 18 6
    i 6.341 142.224 -1 3 7 13
    i 6.342 142.312 -1 3 6 16
    i 6.343 142.401 -1 3 20 18
    i 6.344 142.490 -1 3 24 7
    i 6.345 142.579 -1 3 20 27
    i 6.346 142.668 -1 3 14 28
    i 6.347 142.757 -1 3 18 26
    i 6.348 142.846 -1 3 5 5
    i 6.349 142.935 -1 3 29 20
    i 6.350 143.024 -1 3 21 15
    i 6.351 143.112 -1 3 8 6
    i 6.352 143.201 -1 3 6 17
    i 6.353 143.290 -1 3 15 24
    i 6.354 143.379 -1 3 25 25
    i 6.355 143.468 -1 3 23 1
    i 6.356 143.557 -1 3 5 1
    i 6.357 143.646 -1 3 5 27
    i 6.358 143.735 -1 3 5 28
    i 6.359 143.824 -1 3 4 23
    i 6.360 143.912 -1 3 10 8
    i 6.361 144.001 -1 3 15 27
    i 6.362 144.090 -1 3 17 21
    i 6.363 144.179 -1 3 17 17
    i 6.364 144.268 -1 3 22 5
    i 6.365 144.357 -1 3 26 2
    i 6.366 144.446 -1 3 21 9
    i 6.367 144.535 -1 3 13 14
    i 6.368 144.624 -1 3 1 27
    i 6.369 144.712 -1 3 10 20
    i 6.370 144.801 -1 3 28 20
    i 6.371 144.890 -1 3 25 28
    i 6.372 144.979 -1 3 11 4
    i 6.373 145.068 -1 3 3 3
    i 6.374 145.157 -1 3 24 5
    i 6.375 145.246 -1 3 16 19
    i 6.376 145.335 -1 3 28 23
    i 6.377 145.424 -1 3 23 28
    i 6.378 145.512 -1 3 25 6
    i 6.379 145.601 -1 3 2 14
    i 6.380 145.690 -1 3 26 24
    i 6.381 145.779 -1 3 15 14
    i 6.382 145.868 -1 3 21 6
    i 6.383 145.957 -1 3 19 17
    i 6.384 146.046 -1 3 27 15
    i 6.385 146.135 -1 3 1 23
    i 6.386 146.224 -1 3 26 22
    i 6.387 146.312 -1 3 8 27
    i 6.388 146.401 -1 3 2 23
    i 6.389 146.490 -1 3 1 21
    i 6.390 146.579 -1 3 25 18
    i 6.391 146.668 -1 3 5 18
    i 6.392 146.757 -1 3 15 2
    i 6.393 146.846 -1 3 19 26
    i 6.394 146.935 -1 3 29 16
    i 6.395 147.024 -1 3 26 15
    i 6.396 147.112 -1 3 9 6
    i 6.397 147.201 -1 3 7 5
    i 6.398 147.290 -1 3 17 25
    i 6.399 147.379 -1 3 14 5
    i 6.400 147.468 -1 3 5 19
    i 6.401 147.557 -1 3 26 7
    i 6.402 147.646 -1 3 22 12
    i 6.403 147.735 -1 3 12 27
    i 6.404 147.824 -1 3 22 19
    i 6.405 147.912 -1 3 10 19
    i 6.406 148.001 -1 3 12 24
    i 6.407 148.090 -1 3 15 4
    i 6.408 148.179 -1 3 5 16
    i 6.409 148.268 -1 3 19 28
    i 6.410 148.357 -1 3 23 20
    i 6.411 148.446 -1 3 21 24
    i 6.412 148.535 -1 3 21 1
    i 6.413 148.624 -1 3 26 1
    i 6.414 148.712 -1 3 8 26
    i 6.415 148.801 -1 3 14 2
    i 6.416 148.890 -1 3 13 25
    i 6.417 148.979 -1 3 8 28
    i 6.418 149.068 -1 3 26 0
    i 6.419 149.157 -1 3 21 14
    i 6.420 149.246 -1 3 12 28
    i 6.421 149.335 -1 3 13 3
    i 6.422 149.424 -1 3 12 17
    i 6.423 149.512 -1 3 20 22
    i 6.424 149.601 -1 3 9 21
    i 6.425 149.690 -1 3 13 18
    i 6.426 149.779 -1 3 17 22
    i 6.427 149.868 -1 3 18 17
    i 6.428 149.957 -1 3 1 6
    i 6.429 150.046 -1 3 22 26
    i 6.430 150.135 -1 3 9 5
    i 6.431 150.224 -1 3 11 24
    i 6.432 150.312 -1 3 22 29
    i 6.433 150.401 -1 3 26 29
    i 6.434 150.490 -1 3 12 26
    i 6.435 150.579 -1 3 1 11
    i 6.436 150.668 -1 3 28 16
    i 6.437 150.757 -1 3 16 18
    i 6.438 150.846 -1 3 3 9
    i 6.439 150.935 -1 3 20 12
    i 6.440 151.024 -1 3 22 9
    i 6.441 151.112 -1 3 20 2
    i 6.442 151.201 -1 3 27 0
    i 6.443 151.290 -1 3 4 22
    i 6.444 151.379 -1 3 13 1
    i 6.445 151.468 -1 3 16 14
    i 6.446 151.557 -1 3 8 11
    i 6.447 151.646 -1 3 14 20
    i 6.448 151.735 -1 3 9 28
    i 6.449 151.824 -1 3 1 8
    i 6.450 151.912 -1 3 3 24
    i 6.451 152.001 -1 3 1 1
    i 6.452 152.090 -1 3 24 28
    i 6.453 152.179 -1 3 20 14
    i 6.454 152.268 -1 3 19 21
    i 6.455 152.357 -1 3 20 3
    i 6.456 152.446 -1 3 16 20
    i 6.457 152.535 -1 3 20 19
    i 6.458 152.624 -1 3 25 12
    i 6.459 152.712 -1 3 25 15
    i 6.460 152.801 -1 3 11 28
    i 6.461 152.890 -1 3 1 4
    i 6.462 152.979 -1 3 18 9
    i 6.463 153.068 -1 3 29 17
    i 6.464 153.157 -1 3 1 5
    i 6.465 153.246 -1 3 24 14
    i 6.466 153.335 -1 3 14 10
    i 6.467 153.424 -1 3 10 5
    i 6.468 153.512 -1 3 13 15
    i 6.469 153.601 -1 3 7 22
    i 6.470 153.690 -1 3 23 26
    i 6.471 153.779 -1 3 9 17
    i 6.472 153.868 -1 3 13 16
    i 6.473 153.957 -1 3 13 23
    i 6.474 154.046 -1 3 26 10
    i 6.475 154.135 -1 3 10 9
    i 6.476 154.224 -1 3 23 17
    i 6.477 154.312 -1 3 23 19
    i 6.478 154.401 -1 3 28 14
    i 6.479 154.490 -1 3 2 17
    i 6.480 154.579 -1 3 2 7
    i 6.481 154.668 -1 3 23 5
    i 6.482 154.757 -1 3 22 14
    i 6.483 154.846 -1 3 3 18
    i 6.484 154.935 -1 3 5 2
    i 6.485 155.024 -1 3 3 0
    i 6.486 155.112 -1 3 6 25
    i 6.487 155.201 -1 3 5 17
    i 6.488 155.290 -1 3 17 16
    i 6.489 155.379 -1 3 10 26
    i 6.490 155.468 -1 3 7 1
    i 6.491 155.557 -1 3 29 15
    i 6.492 155.646 -1 3 23 24
    i 6.493 155.735 -1 3 5 15
    i 6.494 155.824 -1 3 22 15
    i 6.495 155.912 -1 3 18 23
    i 6.496 156.001 -1 3 9 7
    i 6.497 156.090 -1 3 23 15
    i 6.498 156.179 -1 3 3 25
    i 6.499 156.268 -1 3 0 17
    i 6.500 156.357 -1 3 5 4
    i 6.501 156.446 -1 3 2 3
    i 6.502 156.535 -1 3 10 28
    i 6.503 156.624 -1 3 26 8
    i 6.504 156.712 -1 3 22 17
    i 6.505 156.801 -1 3 29 2
    i 6.506 156.890 -1 3 18 0
    i 6.507 156.979 -1 3 21 12
    i 6.508 157.068 -1 3 5 24
    i 6.509 157.157 -1 3 4 10
    i 6.510 157.246 -1 3 28 22
    i 6.511 157.335 -1 3 6 2
    i 6.512 157.424 -1 3 7 14
    i 6.513 157.512 -1 3 23 27
    i 6.514 157.601 -1 3 15 9
    i 6.515 157.690 -1 3 23 16
    i 6.516 157.779 -1 3 21 27
    i 6.517 157.868 -1 3 0 13
    i 6.518 157.957 -1 3 23 9
    i 6.519 158.046 -1 3 13 4
    i 6.520 158.135 -1 3 10 13
    i 6.521 158.224 -1 3 24 12
    i 6.522 158.312 -1 3 16 28
    i 6.523 158.401 -1 3 25 13
    i 6.524 158.490 -1 3 8 13
    i 6.525 158.579 -1 3 26 16
    i 6.526 158.668 -1 3 11 13
    i 6.527 158.757 -1 3 13 12
    i 6.528 158.846 -1 3 1 14
    i 6.529 158.935 -1 3 20 4
    i 6.530 159.024 -1 3 4 21
    i 6.531 159.112 -1 3 12 25
    i 6.532 159.201 -1 3 6 29
    i 6.533 159.290 -1 3 14 19
    i 6.534 159.379 -1 3 21 13
    i 6.535 159.468 -1 3 24 21
    i 6.536 159.557 -1 3 17 2
    i 6.537 159.646 -1 3 8 10
    i 6.538 159.735 -1 3 7 21
    i 6.539 159.824 -1 3 0 3
    i 6.540 159.912 -1 3 0 25
    i 6.541 160.001 -1 3 24 4
    i 6.542 160.090 -1 3 13 26
    i 6.543 160.179 -1 3 14 18
    i 6.544 160.268 -1 3 17 0
    i 6.545 160.357 -1 3 4 2
    i 6.546 160.446 -1 3 28 27
    i 6.547 160.535 -1 3 19 25
    i 6.548 160.624 -1 3 4 14
    i 6.549 160.712 -1 3 22 4
    i 6.550 160.801 -1 3 26 11
    i 6.551 160.890 -1 3 25 21
    i 6.552 160.979 -1 3 11 12
    i 6.553 161.068 -1 3 14 13
    i 6.554 161.157 -1 3 26 3
    i 6.555 161.246 -1 3 18 25
    i 6.556 161.335 -1 3 28 15
    i 6.557 161.424 -1 3 7 4
    i 6.558 161.512 -1 3 19 13
    i 6.559 161.601 -1 3 5 0
    i 6.560 161.690 -1 3 19 4
    i 6.561 161.779 -1 3 7 8
    i 6.562 161.868 -1 3 6 9
    i 6.563 161.957 -1 3 1 28
    i 6.564 162.046 -1 3 5 3
    i 6.565 162.135 -1 3 6 22
    i 6.566 162.224 -1 3 19 6
    i 6.567 162.312 -1 3 26 17
    i 6.568 162.401 -1 3 15 26
    i 6.569 162.490 -1 3 28 0
    i 6.570 162.579 -1 3 4 12
    i 6.571 162.668 -1 3 9 19
    i 6.572 162.757 -1 3 11 21
    i 6.573 162.846 -1 3 11 27
    i 6.574 162.935 -1 3 4 5
    i 6.575 163.024 -1 3 8 17
    i 6.576 163.112 -1 3 26 4
    i 6.577 163.201 -1 3 17 19
    i 6.578 163.290 -1 3 5 20
    i 6.579 163.379 -1 3 11 20
    i 6.580 163.468 -1 3 8 8
    i 6.581 163.557 -1 3 20 5
    i 6.582 163.646 -1 3 1 16
    i 6.583 163.735 -1 3 26 20
    i 6.584 163.824 -1 3 24 1
    i 6.585 163.912 -1 3 9 10
    i 6.586 164.001 -1 3 5 23
    i 6.587 164.090 -1 3 0 12
    i 6.588 164.179 -1 3 15 13
    i 6.589 164.268 -1 3 0 18
    i 6.590 164.357 -1 3 6 3
    i 6.591 164.446 -1 3 3 10
    i 6.592 164.535 -1 3 22 6
    i 6.593 164.624 -1 3 27 11
    i 6.594 164.712 -1 3 16 9
    i 6.595 164.801 -1 3 2 22
    i 6.596 164.890 -1 3 24 22
    i 6.597 164.979 -1 3 25 10
    i 6.598 165.068 -1 3 28 9
    i 6.599 165.157 -1 3 26 13
    i 6.600 165.246 -1 3 22 25
    i 6.601 165.335 -1 3 15 6
    i 6.602 165.424 -1 3 22 23
    i 6.603 165.512 -1 3 8 22
    i 6.604 165.601 -1 3 9 23
    i 6.605 165.690 -1 3 5 22
    i 6.606 165.779 -1 3 0 10
    i 6.607 165.868 -1 3 14 1
    i 6.608 165.957 -1 3 27 9
    i 6.609 166.046 -1 3 24 24
    i 6.610 166.135 -1 3 3 29
    i 6.611 166.224 -1 3 11 18
    i 6.612 166.312 -1 3 12 13
    i 6.613 166.401 -1 3 6 15
    i 6.614 166.490 -1 3 24 20
    i 6.615 166.579 -1 3 5 13
    i 6.616 166.668 -1 3 7 0
    i 6.617 166.757 -1 3 9 18
    i 6.618 166.846 -1 3 0 8
    i 6.619 166.935 -1 3 27 17
    i 6.620 167.024 -1 3 20 23
    i 6.621 167.112 -1 3 9 22
    i 6.622 167.201 -1 3 0 20
    i 6.623 167.290 -1 3 8 18
    i 6.624 167.379 -1 3 28 13
    i 6.625 167.468 -1 3 25 16
    i 6.626 167.557 -1 3 6 20
    i 6.627 167.646 -1 3 20 25
    i 6.628 167.735 -1 3 9 11
    i 6.629 167.824 -1 3 29 11
    i 6.630 167.912 -1 3 8 0
    i 6.631 168.001 -1 3 22 24
    i 6.632 168.090 -1 3 29 18
    i 6.633 168.179 -1 3 2 28
    i 6.634 168.268 -1 3 26 12
    i 6.635 168.357 -1 3 24 26
    i 6.636 168.446 -1 3 17 8
    i 6.637 168.535 -1 3 24 15
    i 6.638 168.624 -1 3 16 5
    i 6.639 168.712 -1 3 18 21
    i 6.640 168.801 -1 3 17 28
    i 6.641 168.890 -1 3 2 12
    i 6.642 168.979 -1 3 10 27
    i 6.643 169.068 -1 3 0 27
    i 6.644 169.157 -1 3 4 7
    i 6.645 169.246 -1 3 20 0
    i 6.646 169.335 -1 3 17 6
    i 6.647 169.424 -1 3 15 22
    i 6.648 169.512 -1 3 29 19
    i 6.649 169.601 -1 3 25 26
    i 6.650 169.690 -1 3 25 7
    i 6.651 169.779 -1 3 20 15
    i 6.652 169.868 -1 3 29 10
    i 6.653 169.957 -1 3 27 24
    i 6.654 170.046 -1 3 15 28
    i 6.655 170.135 -1 3 9 26
    i 6.656 170.224 -1 3 28 11
    i 6.657 170.312 -1 3 2 2
    i 6.658 170.401 -1 3 25 0
    i 6.659 170.490 -1 3 29 25
    i 6.660 170.579 -1 3 4 24
    i 6.661 170.668 -1 3 7 23
    i 6.662 170.757 -1 3 10 2
    i 6.663 170.846 -1 3 19 11
    i 6.664 170.935 -1 3 12 18
    i 6.665 171.024 -1 3 25 17
    i 6.666 171.112 -1 3 10 22
    i 6.667 171.201 -1 3 7 3
    i 6.668 171.290 -1 3 26 9
    i 6.669 171.379 -1 3 14 16
    i 6.670 171.468 -1 3 25 8
    i 6.671 171.557 -1 3 0 5
    i 6.672 171.646 -1 3 2 11
    i 6.673 171.735 -1 3 14 15
    i 6.674 171.824 -1 3 5 29
    i 6.675 171.912 -1 3 13 24
    i 6.676 172.001 -1 3 9 9
    i 6.677 172.090 -1 3 16 2
    i 6.678 172.179 -1 3 24 6
    i 6.679 172.268 -1 3 28 7
    i 6.680 172.357 -1 3 25 3
    i 6.681 172.446 -1 3 14 24
    i 6.682 172.535 -1 3 13 29
    i 6.683 172.624 -1 3 7 17
    i 6.684 172.712 -1 3 16 4
    i 6.685 172.801 -1 3 1 3
    i 6.686 172.890 -1 3 26 18
    i 6.687 172.979 -1 3 14 4
    i 6.688 173.068 -1 3 15 16
    i 6.689 173.157 -1 3 8 3
    i 6.690 173.246 -1 3 24 25
    i 6.691 173.335 -1 3 22 10
    i 6.692 173.424 -1 3 5 25
    i 6.693 173.512 -1 3 12 0
    i 6.694 173.601 -1 3 21 22
    i 6.695 173.690 -1 3 27 2
    i 6.696 173.779 -1 3 1 29
    i 6.697 173.868 -1 3 8 5
    i 6.698 173.957 -1 3 12 4
    i 6.699 174.046 -1 3 7 19
    i 6.700 174.135 -1 3 16 12
    i 6.701 174.224 -1 3 1 22
    i 6.702 174.312 -1 3 6 28
    i 6.703 174.401 -1 3 10 4
    i 6.704 174.490 -1 3 9 8
    i 6.705 174.579 -1 3 1 7
    i 6.706 174.668 -1 3 18 1
    i 6.707 174.757 -1 3 29 1
    i 6.708 174.846 -1 3 6 1
    i 6.709 174.935 -1 3 7 11
    i 6.710 175.024 -1 3 24 2
    i 6.711 175.112 -1 3 11 16
    i 6.712 175.201 -1 3 8 15
    i 6.713 175.290 -1 3 7 9
    i 6.714 175.379 -1 3 0 0
    i 6.715 175.468 -1 3 19 0
    i 6.716 175.557 -1 3 19 9
    i 6.717 175.646 -1 3 10 16
    i 6.718 175.735 -1 3 8 29
    i 6.719 175.824 -1 3 21 23
    i 6.720 175.912 -1 3 19 5
    i 6.721 176.001 -1 3 2 4
    i 6.722 176.090 -1 3 10 12
    i 6.723 176.179 -1 3 1 15
    i 6.724 176.268 -1 3 16 3
    i 6.725 176.357 -1 3 2 20
    i 6.726 176.446 -1 3 4 16
    i 6.727 176.535 -1 3 21 5
    i 6.728 176.624 -1 3 8 23
    i 6.729 176.712 -1 3 4 20
    i 6.730 176.801 -1 3 11 11
    i 6.731 176.890 -1 3 1 17
    i 6.732 176.979 -1 3 1 26
    i 6.733 177.068 -1 3 17 27
    i 6.734 177.157 -1 3 18 16
    i 6.735 177.246 -1 3 6 21
    i 6.736 177.335 -1 3 14 17
    i 6.737 177.424 -1 3 6 5
    i 6.738 177.512 -1 3 11 26
    i 6.739 177.601 -1 3 13 20
    i 6.740 177.690 -1 3 12 11
    i 6.741 177.779 -1 3 5 6
    i 6.742 177.868 -1 3 28 8
    i 6.743 177.957 -1 3 3 15
    i 6.744 178.046 -1 3 9 20
    i 6.745 178.135 -1 3 4 15
    i 6.746 178.224 -1 3 14 7
    i 6.747 178.312 -1 3 14 23
    i 6.748 178.401 -1 3 7 20
    i 6.749 178.490 -1 3 5 26
    i 6.750 178.579 -1 3 20 10
    i 6.751 178.668 -1 3 19 8
    i 6.752 178.757 -1 3 6 26
    i 6.753 178.846 -1 3 18 14
    i 6.754 178.935 -1 3 3 6
    i 6.755 179.024 -1 3 12 6
    i 6.756 179.112 -1 3 21 18
    i 6.757 179.201 -1 3 29 21
    i 6.758 179.290 -1 3 0 21
    i 6.759 179.379 -1 3 23 18
    i 6.760 179.468 -1 3 4 18
    i 6.761 179.557 -1 3 15 21
    i 6.762 179.646 -1 3 20 9
    i 6.763 179.735 -1 3 0 22
    i 6.764 179.824 -1 3 12 7
    i 6.765 179.912 -1 3 0 28
    i 6.766 180.001 -1 3 12 19
    i 6.767 180.090 -1 3 22 7
    i 6.768 180.179 -1 3 27 5
    i 6.769 180.268 -1 3 14 25
    i 6.770 180.357 -1 3 23 4
    i 6.771 180.446 -1 3 26 25
    i 6.772 180.535 -1 3 20 7
    i 6.773 180.624 -1 3 24 8
    i 6.774 180.712 -1 3 12 2
    i 6.775 180.801 -1 3 14 3
    i 6.776 180.890 -1 3 13 5
    i 6.777 180.979 -1 3 18 15
    i 6.778 181.068 -1 3 11 1
    i 6.779 181.157 -1 3 19 24
    i 6.780 181.246 -1 3 1 18
    i 6.781 181.335 -1 3 9 27
    i 6.782 181.424 -1 3 13 10
    i 6.783 181.512 -1 3 10 29
    i 6.784 181.601 -1 3 6 19
    i 6.785 181.690 -1 3 0 23
    i 6.786 181.779 -1 3 20 6
    i 6.787 181.868 -1 3 13 11
    i 6.788 181.957 -1 3 15 10
    i 6.789 182.046 -1 3 25 9
    i 6.790 182.135 -1 3 24 13
    i 6.791 182.224 -1 3 20 1
    i 6.792 182.312 -1 3 8 12
    i 6.793 182.401 -1 3 18 29
    i 6.794 182.490 -1 3 6 10
    i 6.795 182.579 -1 3 2 24
    i 6.796 182.668 -1 3 14 27
    i 6.797 182.757 -1 3 15 7
    i 6.798 182.846 -1 3 5 12
    i 6.799 182.935 -1 3 20 8
    i 6.800 183.024 -1 3 23 21
    i 6.801 183.112 -1 3 2 10
    i 6.802 183.201 -1 3 0 15
    i 6.803 183.290 -1 3 1 9
    i 6.804 183.379 -1 3 13 21
    i 6.805 183.468 -1 3 18 24
    i 6.806 183.557 -1 3 12 1
    i 6.807 183.646 -1 3 29 6
    i 6.808 183.735 -1 3 25 27
    i 6.809 183.824 -1 3 12 14
    i 6.810 183.912 -1 3 7 2
    i 6.811 184.001 -1 3 17 20
    i 6.812 184.090 -1 3 19 16
    i 6.813 184.179 -1 3 29 22
    i 6.814 184.268 -1 3 4 11
    i 6.815 184.357 -1 3 21 8
    i 6.816 184.446 -1 3 26 19
    i 6.817 184.535 -1 3 2 18
    i 6.818 184.624 -1 3 7 26
    i 6.819 184.712 -1 3 19 12
    i 6.820 184.801 -1 3 1 25
    i 6.821 184.890 -1 3 9 29
    i 6.822 184.979 -1 3 29 26
    i 6.823 185.068 -1 3 9 12
    i 6.824 185.157 -1 3 27 1
    i 6.825 185.246 -1 3 3 2
    i 6.826 185.335 -1 3 27 10
    i 6.827 185.424 -1 3 16 27
    i 6.828 185.512 -1 3 5 21
    i 6.829 185.601 -1 3 27 19
    i 6.830 185.690 -1 3 13 13
    i 6.831 185.779 -1 3 13 22
    i 6.832 185.868 -1 3 16 25
    i 6.833 185.957 -1 3 25 19
    i 6.834 186.046 -1 3 26 23
    i 6.835 186.135 -1 3 16 22
    i 6.836 186.224 -1 3 2 19
    i 6.837 186.312 -1 3 2 29
    i 6.838 186.401 -1 3 3 14
    i 6.839 186.490 -1 3 7 25
    i 6.840 186.579 -1 3 6 18
    i 6.841 186.668 -1 3 11 8
    i 6.842 186.757 -1 3 27 14
    i 6.843 186.846 -1 3 28 3
    i 6.844 186.935 -1 3 17 7
    i 6.845 187.024 -1 3 2 6
    i 6.846 187.112 -1 3 7 18
    i 6.847 187.201 -1 3 7 29
    i 6.848 187.290 -1 3 4 19
    i 6.849 187.379 -1 3 12 22
    i 6.850 187.468 -1 3 21 25
    i 6.851 187.557 -1 3 16 16
    i 6.852 187.646 -1 3 21 17
    i 6.853 187.735 -1 3 8 14
    i 6.854 187.824 -1 3 28 29
    i 6.855 187.912 -1 3 15 0
    i 6.856 188.001 -1 3 19 3
    i 6.857 188.090 -1 3 20 20
    i 6.858 188.179 -1 3 23 3
    i 6.859 188.268 -1 3 4 9
    i 6.860 188.357 -1 3 3 23
    i 6.861 188.446 -1 3 15 29
    i 6.862 188.535 -1 3 19 7
    i 6.863 188.624 -1 3 2 13
    i 6.864 188.712 -1 3 22 8
    i 6.865 188.801 -1 3 14 22
    i 6.866 188.890 -1 3 27 3
    i 6.867 188.979 -1 3 4 27
    i 6.868 189.068 -1 3 16 11
    i 6.869 189.157 -1 3 21 26
    i 6.870 189.246 -1 3 18 4
    i 6.871 189.335 -1 3 29 3
    i 6.872 189.424 -1 3 27 28
    i 6.873 189.512 -1 3 17 23
    i 6.874 189.601 -1 3 10 15
    i 6.875 189.690 -1 3 26 6
    i 6.876 189.779 -1 3 2 9
    i 6.877 189.868 -1 3 21 2
    i 6.878 189.957 -1 3 5 8
    i 6.879 190.046 -1 3 28 24
    i 6.880 190.135 -1 3 13 27
    i 6.881 190.224 -1 3 4 6
    i 6.882 190.312 -1 3 19 29
    i 6.883 190.401 -1 3 10 3
    i 6.884 190.490 -1 3 13 2
    i 6.885 190.579 -1 3 11 15
    i 6.886 190.668 -1 3 4 0
    i 6.887 190.757 -1 3 13 28
    i 6.888 190.846 -1 3 28 2
    i 6.889 190.935 -1 3 16 26
    i 6.890 191.024 -1 3 10 1
    i 6.891 191.112 -1 3 27 12
    i 6.892 191.201 -1 3 17 12
    i 6.893 191.290 -1 3 2 21
    i 6.894 191.379 -1 3 9 14
    i 6.895 191.468 -1 3 13 19
    i 6.896 191.557 -1 3 28 28
    i 6.897 191.646 -1 3 23 14
    i 6.898 191.735 -1 3 12 21
    i 6.899 191.824 -1 3 14 0
    i 6.900 191.912 -1 3 23 23
    i 5.243 112.169 0.100 1 1091 43
    i 5.244 112.213 0.100 1 1092 72
    i 5.245 112.323 0.100 1 1109 68
    i 5.246 112.351 0.100 1 1095 65
    i 5.247 112.419 0.100 1 1092 78
    i 5.248 112.425 0.100 1 1098 81
    i 5.249 112.481 0.100 1 1105 74
    i 5.250 112.485 0.100 1 1100 54
    i 5.251 112.543 0.100 1 1104 50
    i 5.252 112.707 0.100 1 1107 53
    i 5.253 112.737 0.100 1 1102 59
    i 4.451 112.751 0.490 3 38 127 0
    i 4.452 113.251 0.490 3 38 127 1
    i 4.453 114.251 0.490 3 38 127 2
    i 4.454 115.751 0.490 3 38 127 3
    i 4.455 117.751 0.490 3 38 127 4
    i 5.254 112.767 0.100 1 1108 60
    i 5.255 112.904 0.100 1 1105 59
    i 5.256 112.995 0.100 1 1095 48
    i 5.257 113.020 0.100 1 1105 65
    i 5.258 113.119 0.100 1 1100 62
    i 5.259 113.127 0.100 1 1101 81
    i 5.260 113.201 0.100 1 1096 54
    i 5.261 113.203 0.100 1 1102 83
    i 5.262 113.212 0.100 1 1097 65
    i 5.263 113.232 0.100 1 1092 58
    i 5.264 113.235 0.100 1 1104 74
    i 5.265 113.297 0.100 1 1102 67
    i 5.266 113.423 0.100 1 1100 61
    i 5.267 113.604 0.100 1 1108 56
    i 5.268 113.641 0.100 1 1092 61
    i 5.269 113.653 0.100 1 1100 61
    i 5.270 113.709 0.100 1 1110 71
    i 5.271 113.712 0.100 1 1100 82
    i 5.272 113.748 0.100 1 1098 69
    i 5.273 113.888 0.100 1 1094 75
    i 5.274 113.988 0.100 1 1094 58
    i 5.275 113.999 0.100 1 1102 53
    i 4.457 114.001 0.490 3 52 49 0
    i 4.458 114.501 0.490 3 52 49 1
    i 4.459 115.501 0.490 3 52 49 2
    i 4.460 117.001 0.490 3 52 49 3
    i 4.461 119.001 0.490 3 52 49 4
    i 5.276 114.007 0.100 1 1099 63
    i 5.277 114.135 0.100 1 1102 78
    i 5.278 114.164 0.100 1 1106 76
    i 5.279 114.176 0.100 1 1098 72
    i 5.280 114.176 0.100 1 1099 66
    i 5.281 114.205 0.100 1 1100 83
    i 5.282 114.439 0.100 1 1098 82
    i 5.283 114.523 0.100 1 1112 50
    i 5.284 114.529 0.100 1 1110 73
    i 5.285 114.565 0.100 1 1100 49
    i 5.286 114.705 0.100 1 1094 69
    i 5.287 114.744 0.100 1 1102 75
    i 4.463 114.751 0.490 3 53 49 0
    i 4.464 115.251 0.490 3 53 49 1
    i 4.465 116.251 0.490 3 53 49 2
    i 4.466 117.751 0.490 3 53 49 3
    i 4.467 119.751 0.490 3 53 49 4
    i 5.288 114.779 0.100 1 1100 74
    i 5.289 114.824 0.100 1 1094 55
    i 5.290 114.867 0.100 1 1098 54
    i 5.291 114.891 0.100 1 1100 52
    i 5.292 114.945 0.100 1 1092 81
    i 5.293 114.967 0.100 1 1102 54
    i 5.294 114.975 0.100 1 1097 63
    i 5.295 115.015 0.100 1 1096 79
    i 5.296 115.116 0.100 1 1098 66
    i 5.297 115.197 0.100 1 1108 76
    i 5.298 115.211 0.100 1 1096 53
    i 5.299 115.335 0.100 1 1112 70
    i 5.300 115.413 0.100 1 1102 52
    i 5.301 115.529 0.100 1 1099 52
    i 5.302 115.536 0.100 1 1110 58
    i 5.303 115.581 0.100 1 1104 74
    i 5.304 115.647 0.100 1 1100 52
    i 5.305 115.676 0.100 1 1104 72
    i 5.306 115.677 0.100 1 1096 74
    i 5.307 115.727 0.100 1 1102 64
    i 5.308 115.740 0.100 1 1102 79
    i 5.309 115.785 0.100 1 1090 73
    i 5.310 115.785 0.100 1 1098 77
    i 5.311 115.799 0.100 1 1092 49
    i 4.469 116.001 0.490 3 41 127 0
    i 4.470 116.501 0.490 3 41 127 1
    i 4.471 117.501 0.490 3 41 127 2
    i 4.472 119.001 0.490 3 41 127 3
    i 4.473 121.001 0.490 3 41 127 4
    i 5.312 116.048 0.100 1 1104 69
    i 5.313 116.115 0.100 1 1094 73
    i 5.314 116.171 0.100 1 1093 62
    i 5.315 116.208 0.100 1 1093 53
    i 5.316 116.277 0.100 1 1106 59
    i 5.317 116.281 0.100 1 1104 54
    i 5.318 116.332 0.100 1 1100 65
    i 5.319 116.365 0.100 1 1106 68
    i 5.320 116.407 0.100 1 1108 69
    i 5.321 116.416 0.100 1 1100 55
    i 5.322 116.427 0.100 1 1106 54
    i 5.323 116.492 0.100 1 1104 71
    i 5.324 116.575 0.100 1 1106 75
    i 5.325 116.709 0.100 1 1091 82
    i 5.326 116.713 0.100 1 1092 48
    i 4.475 116.751 0.490 3 40 127 0
    i 4.476 117.251 0.490 3 40 127 1
    i 4.477 118.251 0.490 3 40 127 2
    i 4.478 119.751 0.490 3 40 127 3
    i 4.479 121.751 0.490 3 40 127 4
    i 5.327 116.785 0.100 1 1106 63
    i 5.328 116.795 0.100 1 1096 54
    i 5.329 116.904 0.100 1 1099 81
    i 5.330 116.913 0.100 1 1096 65
    i 5.331 116.944 0.100 1 1091 79
    i 5.332 117.117 0.100 1 1108 55
    i 5.333 117.117 0.100 1 1104 67
    i 5.334 117.125 0.100 1 1100 69
    i 5.335 117.167 0.100 1 1104 68
    i 5.336 117.233 0.100 1 1104 74
    i 5.337 117.391 0.100 1 1106 74
    i 5.338 117.452 0.100 1 1102 55
    i 5.339 117.461 0.100 1 1094 45
    i 5.340 117.524 0.100 1 1106 65
    i 5.341 117.548 0.100 1 1098 79
    i 5.342 117.620 0.100 1 1102 69
    i 5.343 117.631 0.100 1 1101 74
    i 5.344 117.652 0.100 1 1101 66
    i 5.345 117.696 0.100 1 1104 80
    i 5.346 117.709 0.100 1 1101 58
    i 5.347 117.811 0.100 1 1098 56
    i 5.348 117.827 0.100 1 1093 52
    i 5.349 117.871 0.100 1 1100 69
    i 4.481 118.001 0.490 3 57 49 0
    i 4.482 118.501 0.490 3 57 49 1
    i 4.483 119.501 0.490 3 57 49 2
    i 4.484 121.001 0.490 3 57 49 3
    i 4.485 123.001 0.490 3 57 49 4
    i 5.350 118.029 0.100 1 1092 53
    i 5.351 118.071 0.100 1 1109 63
    i 5.352 118.151 0.100 1 1097 75
    i 5.353 118.213 0.100 1 1099 75
    i 5.354 118.239 0.100 1 1104 69
    i 5.355 118.284 0.100 1 1099 66
    i 5.356 118.295 0.100 1 1108 56
    i 5.357 118.437 0.100 1 1095 76
    i 5.358 118.451 0.100 1 1103 71
    i 5.359 118.533 0.100 1 1099 56
    i 5.360 118.547 0.100 1 1107 69
    i 5.361 118.576 0.100 1 1093 61
    i 5.362 118.588 0.100 1 1100 59
    i 5.363 118.592 0.100 1 1100 73
    i 5.364 118.643 0.100 1 1098 48
    i 5.365 118.727 0.100 1 1111 71
    i 4.487 118.751 0.490 3 55 49 0
    i 4.488 119.251 0.490 3 55 49 1
    i 4.489 120.251 0.490 3 55 49 2
    i 4.490 121.751 0.490 3 55 49 3
    i 4.491 123.751 0.490 3 55 49 4
    i 5.366 118.815 0.100 1 1095 81
    i 5.367 118.907 0.100 1 1109 77
    i 5.368 119.049 0.100 1 1113 50
    i 5.369 119.085 0.100 1 1101 72
    i 5.370 119.209 0.100 1 1095 84
    i 5.371 119.277 0.100 1 1097 61
    i 5.372 119.344 0.100 1 1102 74
    i 5.373 119.388 0.100 1 1105 54
    i 5.374 119.419 0.100 1 1093 74
    i 5.375 119.429 0.100 1 1097 48
    i 5.376 119.436 0.100 1 1099 73
    i 5.377 119.475 0.100 1 1103 56
    i 5.378 119.479 0.100 1 1093 82
    i 5.379 119.495 0.100 1 1107 51
    i 5.380 119.523 0.100 1 1098 70
    i 5.381 119.585 0.100 1 1101 78
    i 5.382 119.717 0.100 1 1097 72
    i 5.383 119.763 0.100 1 1101 54
    i 5.384 119.885 0.100 1 1111 77
    i 4.493 120.001 0.490 3 36 127 0
    i 4.494 120.501 0.490 3 36 127 1
    i 4.495 121.501 0.490 3 36 127 2
    i 4.496 123.001 0.490 3 36 127 3
    i 4.497 125.001 0.490 3 36 127 4
    i 5.385 120.059 0.100 1 1099 49
    i 5.386 120.081 0.100 1 1103 55
    i 5.387 120.099 0.100 1 1100 58
    i 5.388 120.145 0.100 1 1103 56
    i 5.389 120.168 0.100 1 1099 70
    i 5.390 120.205 0.100 1 1101 59
    i 5.391 120.211 0.100 1 1105 59
    i 5.392 120.291 0.100 1 1103 67
    i 5.393 120.327 0.100 1 1109 64
    i 5.394 120.348 0.100 1 1091 76
    i 5.395 120.393 0.100 1 1095 56
    i 5.396 120.408 0.100 1 1091 51
    i 5.397 120.527 0.100 1 1105 66
    i 5.398 120.625 0.100 1 1097 57
    i 5.399 120.709 0.100 1 1093 65
    i 4.499 120.751 0.490 3 38 127 0
    i 4.500 121.251 0.490 3 38 127 1
    i 4.501 122.251 0.490 3 38 127 2
    i 4.502 123.751 0.490 3 38 127 3
    i 4.503 125.751 0.490 3 38 127 4
    i 5.400 120.756 0.100 1 1099 79
    i 5.401 120.761 0.100 1 1092 53
    i 5.402 120.800 0.100 1 1095 82
    i 5.403 120.877 0.100 1 1107 62
    i 5.404 120.877 0.100 1 1107 55
    i 5.405 120.908 0.100 1 1105 66
    i 5.406 120.988 0.100 1 1105 74
    i 5.407 121.011 0.100 1 1101 58
    i 5.408 121.144 0.100 1 1107 78
    i 5.409 121.159 0.100 1 1105 68
    i 5.410 121.221 0.100 1 1091 83
    i 5.411 121.257 0.100 1 1093 57
    i 5.412 121.287 0.100 1 1105 54
    i 5.413 121.348 0.100 1 1099 63
    i 5.414 121.359 0.100 1 1097 70
    i 5.415 121.383 0.100 1 1099 67
    i 5.416 121.445 0.100 1 1103 49
    i 5.417 121.513 0.100 1 1092 67
    i 5.418 121.529 0.100 1 1107 51
    i 5.419 121.541 0.100 1 1107 67
    i 5.420 121.640 0.100 1 1103 57
    i 5.421 121.764 0.100 1 1099 50
    i 5.422 121.789 0.100 1 1103 67
    i 5.423 121.863 0.100 1 1097 75
    i 5.424 121.927 0.100 1 1093 61
    i 4.505 122.001 0.490 3 52 49 0
    i 4.506 122.501 0.490 3 52 49 1
    i 4.507 123.501 0.490 3 52 49 2
    i 4.508 125.001 0.490 3 52 49 3
    i 4.509 127.001 0.490 3 52 49 4
    i 5.425 122.053 0.100 1 1105 69
    i 5.426 122.064 0.100 1 1101 73
    i 5.427 122.073 0.100 1 1101 78
    i 5.428 122.112 0.100 1 1109 50
    i 5.429 122.179 0.100 1 1100 65
    i 5.430 122.185 0.100 1 1101 60
    i 5.431 122.209 0.100 1 1100 73
    i 5.432 122.319 0.100 1 1109 53
    i 5.433 122.409 0.100 1 1099 70
    i 5.434 122.421 0.100 1 1093 75
    i 5.435 122.432 0.100 1 1101 70
    i 5.436 122.439 0.100 1 1091 50
    i 5.437 122.540 0.100 1 1105 58
    i 5.438 122.615 0.100 1 1094 78
    i 5.439 122.651 0.100 1 1099 74
    i 5.440 122.724 0.100 1 1098 61
    i 5.441 122.744 0.100 1 1111 49
    i 4.511 122.751 0.490 3 53 49 0
    i 4.512 123.251 0.490 3 53 49 1
    i 4.513 124.251 0.490 3 53 49 2
    i 4.514 125.751 0.490 3 53 49 3
    i 4.515 127.751 0.490 3 53 49 4
    i 5.442 122.915 0.100 1 1099 75
    i 5.443 122.987 0.100 1 1103 67
    i 5.444 122.988 0.100 1 1095 75
    i 5.445 122.999 0.100 1 1101 58
    i 5.446 123.103 0.100 1 1098 73
    i 5.447 123.129 0.100 1 1099 54
    i 5.448 123.131 0.100 1 1104 76
    i 5.449 123.164 0.100 1 1092 82
    i 5.450 123.167 0.100 1 1103 74
    i 5.451 123.171 0.100 1 1107 59
    i 5.452 123.209 0.100 1 1101 72
    i 5.453 123.283 0.100 1 1108 71
    i 5.454 123.315 0.100 1 1102 54
    i 5.455 123.531 0.100 1 1113 78
    i 5.456 123.681 0.100 1 1098 56
    i 5.457 123.708 0.100 1 1096 53
    i 5.458 123.912 0.100 1 1102 75
    i 5.459 123.912 0.100 1 1103 55
    i 5.460 123.941 0.100 1 1101 55
    i 5.461 123.963 0.100 1 1092 69
    i 5.462 123.992 0.100 1 1097 62
    i 5.463 124.000 0.100 1 1099 73
    i 4.517 124.001 0.490 3 41 127 0
    i 4.518 124.501 0.490 3 41 127 1
    i 4.519 125.501 0.490 3 41 127 2
    i 4.520 127.001 0.490 3 41 127 3
    i 4.521 129.001 0.490 3 41 127 4
    i 5.464 124.012 0.100 1 1094 65
    i 5.465 124.043 0.100 1 1104 59
    i 5.466 124.049 0.100 1 1110 74
    i 5.467 124.093 0.100 1 1098 56
    i 5.468 124.124 0.100 1 1106 50
    i 5.469 124.207 0.100 1 1101 49
    i 5.470 124.227 0.100 1 1098 56
    i 5.471 124.457 0.100 1 1098 59
    i 5.472 124.468 0.100 1 1099 70
    i 5.473 124.569 0.100 1 1104 76
    i 5.474 124.572 0.100 1 1100 50
    i 5.475 124.684 0.100 1 1100 75
    i 5.476 124.691 0.100 1 1101 64
    i 4.523 124.751 0.490 3 43 127 0
    i 4.524 125.251 0.490 3 43 127 1
    i 4.525 126.251 0.490 3 43 127 2
    i 4.526 127.751 0.490 3 43 127 3
    i 4.527 129.751 0.490 3 43 127 4
    i 5.477 124.769 0.100 1 1106 76
    i 5.478 124.847 0.100 1 1090 76
    i 5.479 124.875 0.100 1 1096 77
    i 5.480 124.951 0.100 1 1092 44
    i 5.481 125.044 0.100 1 1106 56
    i 5.482 125.075 0.100 1 1104 75
    i 5.483 125.091 0.100 1 1108 71
    i 5.484 125.189 0.100 1 1098 73
    i 5.485 125.207 0.100 1 1092 80
    i 5.486 125.268 0.100 1 1100 65
    i 5.487 125.343 0.100 1 1104 60
    i 5.488 125.375 0.100 1 1091 74
    i 5.489 125.393 0.100 1 1102 55
    i 5.490 125.436 0.100 1 1104 48
    i 5.491 125.464 0.100 1 1107 75
    i 5.492 125.480 0.100 1 1096 56
    i 5.493 125.555 0.100 1 1100 54
    i 5.494 125.729 0.100 1 1090 60
    i 5.495 125.816 0.100 1 1106 54
    i 5.496 125.843 0.100 1 1096 62
    i 5.497 125.861 0.100 1 1106 77
    i 5.498 125.871 0.100 1 1100 81
    i 5.499 125.940 0.100 1 1102 73
    i 5.500 126.001 0.100 1 1106 59
    i 4.529 126.001 0.490 3 57 49 0
    i 4.530 126.501 0.490 3 57 49 1
    i 4.531 127.501 0.490 3 57 49 2
    i 4.532 129.001 0.490 3 57 49 3
    i 4.533 131.001 0.490 3 57 49 4
    i 5.501 126.015 0.100 1 1110 52
    i 5.502 126.015 0.100 1 1108 73
    i 5.503 126.044 0.100 1 1098 80
    i 5.504 126.105 0.100 1 1093 70
    i 5.505 126.193 0.100 1 1102 78
    i 5.506 126.349 0.100 1 1100 61
    i 5.507 126.353 0.100 1 1098 76
    i 5.508 126.515 0.100 1 1112 44
    i 5.509 126.519 0.100 1 1108 61
    i 5.510 126.571 0.100 1 1104 63
    i 5.511 126.628 0.100 1 1100 78
    i 5.512 126.683 0.100 1 1094 63
    i 5.513 126.705 0.100 1 1100 78
    i 5.514 126.728 0.100 1 1102 67
    i 5.515 126.748 0.100 1 1099 78
    i 4.535 126.751 0.490 3 59 49 0
    i 4.536 127.251 0.490 3 59 49 1
    i 4.537 128.251 0.490 3 59 49 2
    i 4.538 129.751 0.490 3 59 49 3
    i 4.539 131.751 0.490 3 59 49 4
    i 5.516 126.885 0.100 1 1102 61
    i 5.517 126.935 0.100 1 1100 62
    i 5.518 126.935 0.100 1 1110 48
    i 5.519 126.965 0.100 1 1094 78
    i 5.520 127.027 0.100 1 1098 65
    i 5.521 127.061 0.100 1 1114 41
    i 5.522 127.063 0.100 1 1110 49
    i 5.523 127.151 0.100 1 1102 68
    i 5.524 127.165 0.100 1 1106 71
    i 5.525 127.232 0.100 1 1097 67
    i 5.526 127.287 0.100 1 1104 62
    i 5.527 127.359 0.100 1 1098 68
    i 5.528 127.487 0.100 1 1096 69
    i 5.529 127.533 0.100 1 1102 63
    i 5.530 127.633 0.100 1 1100 76
    i 5.531 127.652 0.100 1 1102 52
    i 5.532 127.693 0.100 1 1097 57
    i 5.533 127.696 0.100 1 1092 78
    i 5.534 127.757 0.100 1 1108 59
    i 5.535 127.773 0.100 1 1104 75
    i 5.536 127.913 0.100 1 1108 64
    i 4.541 128.001 0.490 3 36 127 0
    i 4.542 128.501 0.490 3 36 127 1
    i 4.543 129.501 0.490 3 36 127 2
    i 4.544 131.001 0.490 3 36 127 3
    i 4.545 133.001 0.490 3 36 127 4
    i 5.537 128.044 0.100 1 1104 57
    i 5.538 128.048 0.100 1 1112 69
    i 5.539 128.156 0.100 1 1101 56
    i 5.540 128.204 0.100 1 1097 66
    i 5.541 128.235 0.100 1 1104 62
    i 5.542 128.316 0.100 1 1102 72
    i 5.543 128.404 0.100 1 1100 49
    i 5.544 128.417 0.100 1 1092 68
    i 5.545 128.444 0.100 1 1096 74
    i 5.546 128.469 0.100 1 1098 61
    i 5.547 128.489 0.100 1 1095 66
    i 5.548 128.628 0.100 1 1106 44
    i 5.549 128.639 0.100 1 1105 53
    i 5.550 128.663 0.100 1 1099 60
    i 5.551 128.735 0.100 1 1099 78
    i 4.547 128.751 0.490 3 38 127 0
    i 4.548 129.251 0.490 3 38 127 1
    i 4.549 130.251 0.490 3 38 127 2
    i 4.550 131.751 0.490 3 38 127 3
    i 4.551 133.751 0.490 3 38 127 4
    i 5.552 128.789 0.100 1 1099 73
    i 5.553 128.819 0.100 1 1106 66
    i 5.554 128.921 0.100 1 1110 73
    i 5.555 129.065 0.100 1 1098 63
    i 5.556 129.107 0.100 1 1099 80
    i 5.557 129.112 0.100 1 1108 57
    i 5.558 129.139 0.100 1 1100 73
    i 5.559 129.172 0.100 1 1096 64
    i 5.560 129.213 0.100 1 1106 53
    i 5.561 129.257 0.100 1 1089 56
    i 5.562 129.281 0.100 1 1101 60
    i 5.563 129.452 0.100 1 1103 54
    i 5.564 129.481 0.100 1 1108 48
    i 5.565 129.516 0.100 1 1105 63
    i 5.566 129.575 0.100 1 1106 80
    i 5.567 129.667 0.100 1 1097 62
    i 5.568 129.688 0.100 1 1101 68
    i 5.569 129.688 0.100 1 1103 73
    i 5.570 129.703 0.100 1 1091 71
    i 5.571 129.873 0.100 1 1108 75
    i 5.572 129.888 0.100 1 1103 64
    i 5.573 129.987 0.100 1 1091 81
    i 4.553 130.001 0.490 3 52 49 0
    i 4.554 130.501 0.490 3 52 49 1
    i 4.555 131.501 0.490 3 52 49 2
    i 4.556 133.001 0.490 3 52 49 3
    i 4.557 135.001 0.490 3 52 49 4
    i 5.574 130.009 0.100 1 1099 79
    i 5.575 130.021 0.100 1 1105 65
    i 5.576 130.029 0.100 1 1107 77
    i 5.577 130.045 0.100 1 1096 81
    i 5.578 130.193 0.100 1 1105 61
    i 5.579 130.237 0.100 1 1091 63
    i 5.580 130.252 0.100 1 1109 70
    i 5.581 130.343 0.100 1 1101 58
    i 5.582 130.351 0.100 1 1095 80
    i 5.583 130.403 0.100 1 1101 72
    i 5.584 130.545 0.100 1 1101 61
    i 5.585 130.597 0.100 1 1106 72
    i 5.586 130.617 0.100 1 1101 73
    i 5.587 130.696 0.100 1 1094 55
    i 5.588 130.731 0.100 1 1099 56
    i 5.589 130.752 0.100 1 1099 70
    i 4.559 130.751 0.490 3 53 49 0
    i 4.560 131.251 0.490 3 53 49 1
    i 4.561 132.251 0.490 3 53 49 2
    i 4.562 133.751 0.490 3 53 49 3
    i 4.563 135.751 0.490 3 53 49 4
    i 5.590 130.853 0.100 1 1097 71
    i 5.591 130.917 0.100 1 1113 58
    i 5.592 131.000 0.100 1 1109 78
    i 5.593 131.052 0.100 1 1103 71
    i 5.594 131.201 0.100 1 1099 57
    i 5.595 131.252 0.100 1 1111 70
    i 5.596 131.269 0.100 1 1099 53
    i 5.597 131.279 0.100 1 1093 61
    i 5.598 131.315 0.100 1 1103 82
    i 5.599 131.317 0.100 1 1098 79
    i 5.600 131.343 0.100 1 1101 52
    i 5.601 131.420 0.100 1 1095 78
    i 5.602 131.427 0.100 1 1107 55
    i 5.603 131.447 0.100 1 1103 77
    i 5.604 131.683 0.100 1 1099 56
    i 5.605 131.740 0.100 1 1097 62
    i 5.606 131.759 0.100 1 1113 47
    i 5.607 131.827 0.100 1 1101 78
    i 5.608 131.865 0.100 1 1111 79
    i 5.609 131.879 0.100 1 1097 68
    i 5.610 131.945 0.100 1 1097 58
    i 5.611 131.971 0.100 1 1103 71
    i 4.565 132.001 0.490 3 41 127 0
    i 4.566 132.501 0.490 3 41 127 1
    i 4.567 133.501 0.490 3 41 127 2
    i 4.568 135.001 0.490 3 41 127 3
    i 4.569 137.001 0.490 3 41 127 4
    i 5.612 132.047 0.100 1 1109 53
    i 5.613 132.129 0.100 1 1103 79
    i 5.614 132.228 0.100 1 1093 75
    i 5.615 132.239 0.100 1 1109 53
    i 5.616 132.284 0.100 1 1096 53
    i 5.617 132.355 0.100 1 1105 69
    i 5.618 132.405 0.100 1 1105 57
    i 5.619 132.544 0.100 1 1107 71
    i 5.620 132.577 0.100 1 1111 57
    i 5.621 132.617 0.100 1 1101 55
    i 5.622 132.635 0.100 1 1105 58
    i 5.623 132.700 0.100 1 1097 58
    i 4.571 132.751 0.490 3 40 127 0
    i 4.572 133.251 0.490 3 40 127 1
    i 4.573 134.251 0.490 3 40 127 2
    i 4.574 135.751 0.490 3 40 127 3
    i 4.575 137.751 0.490 3 40 127 4
    i 5.624 132.812 0.100 1 1099 58
    i 5.625 132.831 0.100 1 1091 66
    i 5.626 132.921 0.100 1 1095 65
    i 5.627 132.928 0.100 1 1101 68
    i 5.628 132.965 0.100 1 1095 61
    i 5.629 133.044 0.100 1 1103 54
    i 5.630 133.171 0.100 1 1099 57
    i 5.631 133.196 0.100 1 1105 63
    i 5.632 133.232 0.100 1 1100 60
    i 5.633 133.243 0.100 1 1100 53
    i 5.634 133.256 0.100 1 1103 74
    i 5.635 133.325 0.100 1 1107 57
    i 5.636 133.352 0.100 1 1109 57
    i 5.637 133.495 0.100 1 1097 78
    i 5.638 133.528 0.100 1 1099 82
    i 5.639 133.537 0.100 1 1105 84
    i 5.640 133.625 0.100 1 1089 59
    i 5.641 133.649 0.100 1 1100 73
    i 5.642 133.661 0.100 1 1097 74
    i 5.643 133.723 0.100 1 1101 70
    i 5.644 133.743 0.100 1 1105 66
    i 5.645 133.755 0.100 1 1105 55
    i 5.646 133.781 0.100 1 1107 70
    i 5.647 133.860 0.100 1 1107 65
    i 5.648 133.872 0.100 1 1102 69
    i 4.577 134.001 0.490 3 57 49 0
    i 4.578 134.501 0.490 3 57 49 1
    i 4.579 135.501 0.490 3 57 49 2
    i 4.580 137.001 0.490 3 57 49 3
    i 4.581 139.001 0.490 3 57 49 4
    i 5.649 134.053 0.100 1 1107 54
    i 5.650 134.143 0.100 1 1096 66
    i 5.651 134.200 0.100 1 1090 79
    i 5.652 134.283 0.100 1 1107 77
    i 5.653 134.364 0.100 1 1103 50
    i 5.654 134.371 0.100 1 1105 77
    i 5.655 134.395 0.100 1 1103 69
    i 5.656 134.423 0.100 1 1099 48
    i 5.657 134.491 0.100 1 1097 55
    i 5.658 134.521 0.100 1 1108 66
    i 5.659 134.599 0.100 1 1092 63
    i 5.660 134.636 0.100 1 1102 59
    i 5.661 134.644 0.100 1 1103 59
    i 5.662 134.731 0.100 1 1109 65
    i 5.663 134.747 0.100 1 1092 53
    i 4.583 134.751 0.490 3 55 49 0
    i 4.584 135.251 0.490 3 55 49 1
    i 4.585 136.251 0.490 3 55 49 2
    i 4.586 137.751 0.490 3 55 49 3
    i 4.587 139.751 0.490 3 55 49 4
    i 5.664 134.763 0.100 1 1105 56
    i 5.665 134.933 0.100 1 1102 58
    i 5.666 135.073 0.100 1 1109 79
    i 5.667 135.104 0.100 1 1100 60
    i 5.668 135.176 0.100 1 1101 61
    i 5.669 135.195 0.100 1 1105 53
    i 5.670 135.247 0.100 1 1100 64
    i 5.671 135.285 0.100 1 1094 58
    i 5.672 135.297 0.100 1 1099 70
    i 5.673 135.311 0.100 1 1096 59
    i 5.674 135.387 0.100 1 1094 83
    i 5.675 135.427 0.100 1 1114 68
    i 5.676 135.497 0.100 1 1098 79
    i 5.677 135.579 0.100 1 1103 53
    i 5.678 135.692 0.100 1 1108 50
    i 5.679 135.700 0.100 1 1098 66
    i 5.680 135.753 0.100 1 1101 67
    i 5.681 135.833 0.100 1 1096 65
    i 5.682 135.885 0.100 1 1097 71
    i 5.683 135.889 0.100 1 1112 55
    i 5.684 135.900 0.100 1 1104 73
    i 5.685 135.923 0.100 1 1104 58
    i 5.686 135.957 0.100 1 1098 68
    i 4.589 136.001 0.490 3 40 127 0
    i 4.590 136.501 0.490 3 40 127 1
    i 4.591 137.501 0.490 3 40 127 2
    i 4.592 139.001 0.490 3 40 127 3
    i 4.593 141.001 0.490 3 40 127 4
    i 5.687 136.052 0.100 1 1110 78
    i 5.688 136.200 0.100 1 1112 42
    i 5.689 136.251 0.100 1 1096 80
    i 5.690 136.313 0.100 1 1100 66
    i 5.691 136.373 0.100 1 1094 74
    i 5.692 136.404 0.100 1 1098 76
    i 5.693 136.452 0.100 1 1102 71
    i 5.694 136.471 0.100 1 1096 64
    i 5.695 136.560 0.100 1 1108 50
    i 5.696 136.660 0.100 1 1108 59
    i 5.697 136.727 0.100 1 1106 72
    i 5.698 136.728 0.100 1 1103 80
    i 4.595 136.751 0.490 3 38 127 0
    i 4.596 137.251 0.490 3 38 127 1
    i 4.597 138.251 0.490 3 38 127 2
    i 4.598 139.751 0.490 3 38 127 3
    i 4.599 141.751 0.490 3 38 127 4
    i 5.699 136.759 0.100 1 1094 69
    i 5.700 136.819 0.100 1 1102 77
    i 5.701 136.873 0.100 1 1095 76
    i 5.702 136.920 0.100 1 1106 77
    i 5.703 136.992 0.100 1 1106 72
    i 5.704 137.056 0.100 1 1110 78
    i 5.705 137.105 0.100 1 1106 62
    i 5.706 137.153 0.100 1 1102 69
    i 5.707 137.200 0.100 1 1098 63
    i 5.708 137.233 0.100 1 1098 53
    i 5.709 137.244 0.100 1 1090 67
    i 5.710 137.269 0.100 1 1104 77
    i 5.711 137.365 0.100 1 1096 53
    i 5.712 137.441 0.100 1 1096 61
    i 5.713 137.508 0.100 1 1100 63
    i 5.714 137.523 0.100 1 1104 72
    i 5.715 137.636 0.100 1 1108 78
    i 5.716 137.636 0.100 1 1108 50
    i 5.717 137.755 0.100 1 1100 62
    i 5.718 137.777 0.100 1 1104 75
    i 5.719 137.800 0.100 1 1101 69
    i 5.720 137.859 0.100 1 1106 64
    i 5.721 137.887 0.100 1 1104 70
    i 5.722 137.932 0.100 1 1112 42
    i 5.723 137.947 0.100 1 1098 54
    i 5.724 137.949 0.100 1 1098 57
    i 5.725 137.993 0.100 1 1090 69
    i 4.601 138.001 0.490 3 55 49 0
    i 4.602 138.501 0.490 3 55 49 1
    i 4.603 139.501 0.490 3 55 49 2
    i 4.604 141.001 0.490 3 55 49 3
    i 4.605 143.001 0.490 3 55 49 4
    i 5.726 138.111 0.100 1 1100 60
    i 5.727 138.197 0.100 1 1096 61
    i 5.728 138.281 0.100 1 1102 73
    i 5.729 138.335 0.100 1 1106 50
    i 5.730 138.461 0.100 1 1103 54
    i 5.731 138.472 0.100 1 1102 56
    i 5.732 138.557 0.100 1 1106 42
    i 5.733 138.581 0.100 1 1108 62
    i 5.734 138.619 0.100 1 1096 77
    i 5.735 138.623 0.100 1 1106 61
    i 5.736 138.700 0.100 1 1091 55
    i 4.607 138.751 0.490 3 53 49 0
    i 4.608 139.251 0.490 3 53 49 1
    i 4.609 140.251 0.490 3 53 49 2
    i 4.610 141.751 0.490 3 53 49 3
    i 4.611 143.751 0.490 3 53 49 4
    i 5.737 138.765 0.100 1 1106 66
    i 5.738 138.815 0.100 1 1098 71
    i 5.739 138.836 0.100 1 1098 71
    i 5.740 138.836 0.100 1 1114 49
    i 5.741 138.920 0.100 1 1100 69
    i 5.742 138.924 0.100 1 1102 69
    i 5.743 139.072 0.100 1 1104 55
    i 5.744 139.157 0.100 1 1100 53
    i 5.745 139.175 0.100 1 1102 77
    i 5.746 139.211 0.100 1 1093 78
    i 5.747 139.259 0.100 1 1093 58
    i 5.748 139.315 0.100 1 1108 64
    i 5.749 139.355 0.100 1 1104 49
    i 5.750 139.464 0.100 1 1103 61
    i 5.751 139.552 0.100 1 1110 59
    i 5.752 139.587 0.100 1 1104 49
    i 5.753 139.668 0.100 1 1104 67
    i 5.754 139.676 0.100 1 1110 53
    i 5.755 139.688 0.100 1 1100 51
    i 5.756 139.743 0.100 1 1100 70
    i 5.757 139.769 0.100 1 1096 67
    i 5.758 139.848 0.100 1 1102 64
    i 5.759 139.876 0.100 1 1095 55
    i 5.760 139.891 0.100 1 1100 52
    i 5.761 139.973 0.100 1 1110 63
    i 4.613 140.001 0.490 3 36 127 0
    i 4.614 140.501 0.490 3 36 127 1
    i 4.615 141.501 0.490 3 36 127 2
    i 4.616 143.001 0.490 3 36 127 3
    i 4.617 145.001 0.490 3 36 127 4
    i 5.762 140.023 0.100 1 1114 42
    i 5.763 140.059 0.100 1 1102 71
    i 5.764 140.085 0.100 1 1098 66
    i 5.765 140.200 0.100 1 1097 65
    i 5.766 140.293 0.100 1 1096 65
    i 5.767 140.299 0.100 1 1102 72
    i 5.768 140.321 0.100 1 1108 64
    i 5.769 140.444 0.100 1 1103 77
    i 5.770 140.455 0.100 1 1097 59
    i 5.771 140.457 0.100 1 1107 65
    i 5.772 140.479 0.100 1 1112 52
    i 5.773 140.483 0.100 1 1104 79
    i 5.774 140.491 0.100 1 1106 61
    i 5.775 140.524 0.100 1 1098 68
    i 5.776 140.577 0.100 1 1102 60
    i 5.777 140.637 0.100 1 1112 70
    i 5.778 140.648 0.100 1 1101 55
    i 5.779 140.687 0.100 1 1093 60
    i 4.619 140.751 0.490 3 36 127 0
    i 4.620 141.251 0.490 3 36 127 1
    i 4.621 142.251 0.490 3 36 127 2
    i 4.622 143.751 0.490 3 36 127 3
    i 4.623 145.751 0.490 3 36 127 4
    i 5.780 140.763 0.100 1 1095 67
    i 5.781 140.908 0.100 1 1099 68
    i 5.782 141.036 0.100 1 1105 78
    i 5.783 141.069 0.100 1 1107 70
    i 5.784 141.088 0.100 1 1103 57
    i 5.785 141.133 0.100 1 1107 79
    i 5.786 141.139 0.100 1 1104 79
    i 5.787 141.159 0.100 1 1096 78
    i 5.788 141.248 0.100 1 1095 64
    i 5.789 141.296 0.100 1 1105 72
    i 5.790 141.435 0.100 1 1109 66
    i 5.791 141.447 0.100 1 1095 82
    i 5.792 141.459 0.100 1 1107 46
    i 5.793 141.535 0.100 1 1109 79
    i 5.794 141.585 0.100 1 1095 73
    i 5.795 141.672 0.100 1 1105 62
    i 5.796 141.697 0.100 1 1101 67
    i 5.797 141.700 0.100 1 1099 53
    i 5.798 141.704 0.100 1 1089 76
    i 5.799 141.811 0.100 1 1105 67
    i 5.800 141.832 0.100 1 1098 79
    i 5.801 141.876 0.100 1 1097 83
    i 5.802 141.912 0.100 1 1107 53
    i 5.803 141.927 0.100 1 1097 60
    i 4.625 142.001 0.490 3 52 49 0
    i 4.626 142.501 0.490 3 52 49 1
    i 4.627 143.501 0.490 3 52 49 2
    i 4.628 145.001 0.490 3 52 49 3
    i 4.629 147.001 0.490 3 52 49 4
    i 5.804 142.145 0.100 1 1107 56
    i 5.805 142.153 0.100 1 1103 65
    i 5.806 142.203 0.100 1 1109 45
    i 5.807 142.267 0.100 1 1101 60
    i 5.808 142.332 0.100 1 1103 81
    i 5.809 142.352 0.100 1 1102 73
    i 5.810 142.409 0.100 1 1091 75
    i 5.811 142.424 0.100 1 1097 83
    i 5.812 142.453 0.100 1 1101 56
    i 5.813 142.468 0.100 1 1107 63
    i 5.814 142.587 0.100 1 1101 79
    i 5.815 142.609 0.100 1 1097 78
    i 5.816 142.647 0.100 1 1105 53
    i 5.817 142.663 0.100 1 1099 61
    i 5.818 142.691 0.100 1 1103 55
    i 4.631 142.751 0.490 3 52 49 0
    i 4.632 143.251 0.490 3 52 49 1
    i 4.633 144.251 0.490 3 52 49 2
    i 4.634 145.751 0.490 3 52 49 3
    i 4.635 147.751 0.490 3 52 49 4
    i 5.819 142.896 0.100 1 1105 63
    i 5.820 143.009 0.100 1 1113 70
    i 5.821 143.035 0.100 1 1102 79
    i 5.822 143.060 0.100 1 1109 61
    i 5.823 143.088 0.100 1 1107 48
    i 5.824 143.139 0.100 1 1099 67
    i 5.825 143.148 0.100 1 1095 59
    i 5.826 143.200 0.100 1 1091 80
    i 5.827 143.297 0.100 1 1097 68
    i 5.828 143.323 0.100 1 1099 79
    i 5.829 143.365 0.100 1 1105 63
    i 5.830 143.485 0.100 1 1101 58
    i 5.831 143.527 0.100 1 1115 52
    i 5.832 143.559 0.100 1 1099 74
    i 5.833 143.579 0.100 1 1101 67
    i 5.834 143.596 0.100 1 1103 50
    i 5.835 143.677 0.100 1 1111 55
    i 5.836 143.769 0.100 1 1103 63
    i 5.837 143.771 0.100 1 1093 77
    i 5.838 143.805 0.100 1 1094 58
    i 5.839 143.815 0.100 1 1109 55
    i 4.637 144.001 0.490 3 36 127 0
    i 4.638 144.501 0.490 3 36 127 1
    i 4.639 145.501 0.490 3 36 127 2
    i 4.640 147.001 0.490 3 36 127 3
    i 4.641 149.001 0.490 3 36 127 4
    i 4.643 144.001 0.490 3 48 56 0
    i 4.644 144.501 0.490 3 48 56 1
    i 4.645 145.501 0.490 3 48 56 2
    i 4.646 147.001 0.490 3 48 56 3
    i 4.647 149.001 0.490 3 48 56 4
    i 5.840 144.048 0.100 1 1103 75
    i 5.841 144.080 0.100 1 1103 53
    i 5.842 144.092 0.100 1 1101 71
    i 5.843 144.197 0.100 1 1105 43
    i 5.844 144.220 0.100 1 1101 74
    i 5.845 144.276 0.100 1 1095 64
    i 5.846 144.313 0.100 1 1099 60
    i 5.847 144.329 0.100 1 1109 74
    i 5.848 144.332 0.100 1 1099 77
    i 5.849 144.333 0.100 1 1113 43
    i 5.850 144.365 0.100 1 1099 50
    i 5.851 144.449 0.100 1 1096 57
    i 5.852 144.535 0.100 1 1111 63
    i 5.853 144.537 0.100 1 1101 64
    i 5.854 144.700 0.100 1 1096 52
    i 4.649 144.751 0.490 3 38 127 0
    i 4.650 145.251 0.490 3 38 127 1
    i 4.651 146.251 0.490 3 38 127 2
    i 4.652 147.751 0.490 3 38 127 3
    i 4.653 149.751 0.490 3 38 127 4
    i 4.655 144.751 0.490 3 50 56 0
    i 4.656 145.251 0.490 3 50 56 1
    i 4.657 146.251 0.490 3 50 56 2
    i 4.658 147.751 0.490 3 50 56 3
    i 4.659 149.751 0.490 3 50 56 4
    i 5.855 144.845 0.100 1 1097 75
    i 5.856 144.875 0.100 1 1107 40
    i 5.857 144.899 0.100 1 1103 70
    i 5.858 144.928 0.100 1 1105 57
    i 5.859 144.973 0.100 1 1103 68
    i 5.860 144.995 0.100 1 1097 68
    i 5.861 145.007 0.100 1 1096 84
    i 5.862 145.025 0.100 1 1101 50
    i 5.863 145.060 0.100 1 1103 77
    i 5.864 145.168 0.100 1 1109 80
    i 5.865 145.263 0.100 1 1107 59
    i 5.866 145.273 0.100 1 1094 65
    i 5.867 145.333 0.100 1 1111 52
    i 5.868 145.360 0.100 1 1111 55
    i 5.869 145.373 0.100 1 1103 60
    i 5.870 145.399 0.100 1 1109 65
    i 5.871 145.433 0.100 1 1107 76
    i 5.872 145.505 0.100 1 1099 77
    i 5.873 145.551 0.100 1 1105 59
    i 5.874 145.695 0.100 1 1107 50
    i 5.875 145.723 0.100 1 1096 65
    i 5.876 145.751 0.100 1 1095 74
    i 5.877 145.900 0.100 1 1107 66
    i 5.878 145.928 0.100 1 1104 50
    i 5.879 145.977 0.100 1 1094 63
    i 5.880 145.987 0.100 1 1093 71
    i 4.661 146.001 0.490 3 52 43 0
    i 4.662 146.501 0.490 3 52 43 1
    i 4.663 147.501 0.490 3 52 43 2
    i 4.664 149.001 0.490 3 52 43 3
    i 4.665 151.001 0.490 3 52 43 4
    i 4.667 146.001 0.490 3 40 43 0
    i 4.668 146.501 0.490 3 40 43 1
    i 4.669 147.501 0.490 3 40 43 2
    i 4.670 149.001 0.490 3 40 43 3
    i 4.671 151.001 0.490 3 40 43 4
    i 5.881 146.064 0.100 1 1109 73
    i 5.882 146.072 0.100 1 1103 73
    i 5.883 146.128 0.100 1 1106 52
    i 5.884 146.199 0.100 1 1100 70
    i 5.885 146.256 0.100 1 1090 70
    i 5.886 146.269 0.100 1 1106 49
    i 5.887 146.289 0.100 1 1101 64
    i 5.888 146.296 0.100 1 1098 81
    i 5.889 146.360 0.100 1 1105 53
    i 5.890 146.381 0.100 1 1097 80
    i 5.891 146.431 0.100 1 1097 52
    i 5.892 146.671 0.100 1 1105 78
    i 4.673 146.751 0.490 3 41 42 0
    i 4.674 147.251 0.490 3 41 42 1
    i 4.675 148.251 0.490 3 41 42 2
    i 4.676 149.751 0.490 3 41 42 3
    i 4.677 151.751 0.490 3 41 42 4
    i 4.679 146.751 0.490 3 53 43 0
    i 4.680 147.251 0.490 3 53 43 1
    i 4.681 148.251 0.490 3 53 43 2
    i 4.682 149.751 0.490 3 53 43 3
    i 4.683 151.751 0.490 3 53 43 4
    i 5.893 146.771 0.100 1 1110 71
    i 5.894 146.776 0.100 1 1102 71
    i 5.895 146.779 0.100 1 1107 73
    i 5.896 146.797 0.100 1 1096 66
    i 5.897 146.819 0.100 1 1102 50
    i 5.898 146.861 0.100 1 1102 62
    i 5.899 146.899 0.100 1 1096 83
    i 5.900 146.899 0.100 1 1102 59
    i 5.901 146.965 0.100 1 1108 72
    i 5.902 146.987 0.100 1 1114 63
    i 5.903 147.020 0.100 1 1097 58
    i 5.904 147.076 0.100 1 1104 54
    i 5.905 147.185 0.100 1 1104 72
    i 5.906 147.272 0.100 1 1100 73
    i 5.907 147.465 0.100 1 1104 59
    i 5.908 147.500 0.100 1 1108 57
    i 5.909 147.541 0.100 1 1110 76
    i 5.910 147.567 0.100 1 1101 52
    i 5.911 147.584 0.100 1 1100 81
    i 5.912 147.677 0.100 1 1094 74
    i 5.913 147.697 0.100 1 1092 80
    i 5.914 147.743 0.100 1 1100 77
    i 5.915 147.753 0.100 1 1100 72
    i 5.916 147.813 0.100 1 1102 54
    i 5.917 147.924 0.100 1 1114 45
    i 5.918 147.927 0.100 1 1100 71
    i 5.919 147.940 0.100 1 1100 55
    i 5.920 147.963 0.100 1 1105 64
    i 4.685 148.001 0.490 3 41 127 0
    i 4.686 148.501 0.490 3 41 127 1
    i 4.687 149.501 0.490 3 41 127 2
    i 4.688 151.001 0.490 3 41 127 3
    i 4.689 153.001 0.490 3 41 127 4
    i 4.691 148.001 0.490 3 53 56 0
    i 4.692 148.501 0.490 3 53 56 1
    i 4.693 149.501 0.490 3 53 56 2
    i 4.694 151.001 0.490 3 53 56 3
    i 4.695 153.001 0.490 3 53 56 4
    i 5.921 148.029 0.100 1 1110 59
    i 5.922 148.207 0.100 1 1102 54
    i 5.923 148.279 0.100 1 1094 82
    i 5.924 148.279 0.100 1 1112 61
    i 5.925 148.359 0.100 1 1095 71
    i 5.926 148.416 0.100 1 1102 61
    i 5.927 148.489 0.100 1 1102 51
    i 5.928 148.535 0.100 1 1098 81
    i 5.929 148.555 0.100 1 1112 53
    i 5.930 148.632 0.100 1 1104 65
    i 5.931 148.667 0.100 1 1098 76
    i 5.932 148.668 0.100 1 1100 50
    i 5.933 148.697 0.100 1 1098 77
    i 4.697 148.751 0.490 3 40 127 0
    i 4.698 149.251 0.490 3 40 127 1
    i 4.699 150.251 0.490 3 40 127 2
    i 4.700 151.751 0.490 3 40 127 3
    i 4.701 153.751 0.490 3 40 127 4
    i 4.703 148.751 0.490 3 52 56 0
    i 4.704 149.251 0.490 3 52 56 1
    i 4.705 150.251 0.490 3 52 56 2
    i 4.706 151.751 0.490 3 52 56 3
    i 4.707 153.751 0.490 3 52 56 4
    i 5.934 148.767 0.100 1 1100 64
    i 5.935 148.835 0.100 1 1106 60
    i 5.936 148.981 0.100 1 1097 81
    i 5.937 149.031 0.100 1 1112 46
    i 5.938 149.067 0.100 1 1102 68
    i 5.939 149.196 0.100 1 1096 62
    i 5.940 149.384 0.100 1 1106 75
    i 5.941 149.395 0.100 1 1096 53
    i 5.942 149.409 0.100 1 1110 50
    i 5.943 149.485 0.100 1 1104 65
    i 5.944 149.503 0.100 1 1102 58
    i 5.945 149.517 0.100 1 1095 64
    i 5.946 149.520 0.100 1 1102 74
    i 5.947 149.579 0.100 1 1108 63
    i 5.948 149.612 0.100 1 1108 62
    i 5.949 149.624 0.100 1 1108 51
    i 5.950 149.628 0.100 1 1112 35
    i 5.951 149.644 0.100 1 1110 71
    i 5.952 149.713 0.100 1 1102 51
    i 5.953 149.781 0.100 1 1093 58
    i 5.954 149.879 0.100 1 1104 60
    i 4.709 150.001 0.490 3 57 43 0
    i 4.710 150.501 0.490 3 57 43 1
    i 4.711 151.501 0.490 3 57 43 2
    i 4.712 153.001 0.490 3 57 43 3
    i 4.713 155.001 0.490 3 57 43 4
    i 4.715 150.001 0.490 3 45 43 0
    i 4.716 150.501 0.490 3 45 43 1
    i 4.717 151.501 0.490 3 45 43 2
    i 4.718 153.001 0.490 3 45 43 3
    i 4.719 155.001 0.490 3 45 43 4
    i 5.955 150.023 0.100 1 1106 72
    i 5.956 150.044 0.100 1 1106 60
    i 5.957 150.197 0.100 1 1096 82
    i 5.958 150.259 0.100 1 1106 67
    i 5.959 150.271 0.100 1 1094 53
    i 5.960 150.272 0.100 1 1104 66
    i 5.961 150.319 0.100 1 1106 61
    i 5.962 150.368 0.100 1 1114 51
    i 5.963 150.377 0.100 1 1104 78
    i 5.964 150.467 0.100 1 1093 79
    i 5.965 150.476 0.100 1 1108 56
    i 5.966 150.544 0.100 1 1108 78
    i 5.967 150.559 0.100 1 1104 72
    i 5.968 150.597 0.100 1 1108 56
    i 5.969 150.695 0.100 1 1101 66
    i 5.970 150.716 0.100 1 1099 81
    i 4.721 150.751 0.490 3 55 43 0
    i 4.722 151.251 0.490 3 55 43 1
    i 4.723 152.251 0.490 3 55 43 2
    i 4.724 153.751 0.490 3 55 43 3
    i 4.725 155.751 0.490 3 55 43 4
    i 4.727 150.751 0.490 3 43 43 0
    i 4.728 151.251 0.490 3 43 43 1
    i 4.729 152.251 0.490 3 43 43 2
    i 4.730 153.751 0.490 3 43 43 3
    i 4.731 155.751 0.490 3 43 43 4
    i 5.971 150.943 0.100 1 1098 78
    i 5.972 150.956 0.100 1 1096 54
    i 5.973 151.001 0.100 1 1104 65
    i 5.974 151.027 0.100 1 1106 47
    i 5.975 151.107 0.100 1 1106 61
    i 5.976 151.115 0.100 1 1110 63
    i 5.977 151.133 0.100 1 1102 51
    i 5.978 151.184 0.100 1 1106 76
    i 5.979 151.195 0.100 1 1102 71
    i 5.980 151.259 0.100 1 1094 80
    i 5.981 151.284 0.100 1 1101 58
    i 5.982 151.297 0.100 1 1106 75
    i 5.983 151.329 0.100 1 1103 62
    i 5.984 151.351 0.100 1 1105 36
    i 5.985 151.373 0.100 1 1095 78
    i 5.986 151.555 0.100 1 1098 64
    i 5.987 151.585 0.100 1 1102 81
    i 5.988 151.657 0.100 1 1108 68
    i 5.989 151.700 0.100 1 1104 51
    i 5.990 151.731 0.100 1 1114 50
    i 5.991 151.768 0.100 1 1109 53
    i 5.992 151.900 0.100 1 1100 70
    i 5.993 151.981 0.100 1 1096 64
    i 4.733 152.001 0.490 3 36 127 0
    i 4.734 152.501 0.490 3 36 127 1
    i 4.735 153.501 0.490 3 36 127 2
    i 4.736 155.001 0.490 3 36 127 3
    i 4.737 157.001 0.490 3 36 127 4
    i 4.739 152.001 0.490 3 48 56 0
    i 4.740 152.501 0.490 3 48 56 1
    i 4.741 153.501 0.490 3 48 56 2
    i 4.742 155.001 0.490 3 48 56 3
    i 4.743 157.001 0.490 3 48 56 4
    i 5.994 152.035 0.100 1 1104 59
    i 5.995 152.056 0.100 1 1101 78
    i 5.996 152.069 0.100 1 1110 74
    i 5.997 152.104 0.100 1 1104 51
    i 5.998 152.128 0.100 1 1107 41
    i 5.999 152.149 0.100 1 1100 59
    i 5.001 152.193 0.100 1 1093 80
    i 5.002 152.207 0.100 1 1093 64
    i 5.003 152.256 0.100 1 1099 52
    i 5.004 152.375 0.100 1 1113 39
    i 5.005 152.409 0.100 1 1099 71
    i 5.006 152.415 0.100 1 1100 69
    i 5.007 152.425 0.100 1 1104 64
    i 5.008 152.551 0.100 1 1109 68
    i 5.009 152.663 0.100 1 1111 47
    i 5.010 152.681 0.100 1 1103 41
    i 4.745 152.751 0.490 3 38 127 0
    i 4.746 153.251 0.490 3 38 127 1
    i 4.747 154.251 0.490 3 38 127 2
    i 4.748 155.751 0.490 3 38 127 3
    i 4.749 157.751 0.490 3 38 127 4
    i 4.751 152.751 0.490 3 50 56 0
    i 4.752 153.251 0.490 3 50 56 1
    i 4.753 154.251 0.490 3 50 56 2
    i 4.754 155.751 0.490 3 50 56 3
    i 4.755 157.751 0.490 3 50 56 4
    i 5.011 152.787 0.100 1 1095 81
    i 5.012 152.797 0.100 1 1101 74
    i 5.013 152.860 0.100 1 1103 63
    i 5.014 152.869 0.100 1 1095 58
    i 5.015 152.885 0.100 1 1107 48
    i 5.016 152.939 0.100 1 1100 61
    i 5.017 152.956 0.100 1 1101 69
    i 5.018 152.979 0.100 1 1113 56
    i 5.019 152.987 0.100 1 1097 56
    i 5.020 153.081 0.100 1 1097 60
    i 5.021 153.087 0.100 1 1102 72
    i 5.022 153.199 0.100 1 1103 66
    i 5.023 153.371 0.100 1 1109 46
    i 5.024 153.377 0.100 1 1111 75
    i 5.025 153.471 0.100 1 1098 81
    i 5.026 153.472 0.100 1 1111 61
    i 5.027 153.543 0.100 1 1101 50
    i 5.028 153.545 0.100 1 1103 63
    i 5.029 153.613 0.100 1 1107 71
    i 5.030 153.632 0.100 1 1097 58
    i 5.031 153.692 0.100 1 1095 67
    i 5.032 153.717 0.100 1 1095 76
    i 5.033 153.723 0.100 1 1109 56
    i 5.034 153.787 0.100 1 1107 62
    i 5.035 153.859 0.100 1 1107 57
    i 5.036 153.895 0.100 1 1105 68
    i 5.037 153.912 0.100 1 1109 63
    i 5.038 153.985 0.100 1 1094 82
    i 4.757 154.001 0.490 3 52 43 0
    i 4.758 154.501 0.490 3 52 43 1
    i 4.759 155.501 0.490 3 52 43 2
    i 4.760 157.001 0.490 3 52 43 3
    i 4.761 159.001 0.490 3 52 43 4
    i 4.763 154.001 0.490 3 40 43 0
    i 4.764 154.501 0.490 3 40 43 1
    i 4.765 155.501 0.490 3 40 43 2
    i 4.766 157.001 0.490 3 40 43 3
    i 4.767 159.001 0.490 3 40 43 4
    i 5.039 154.015 0.100 1 1101 64
    i 5.040 154.088 0.100 1 1105 49
    i 5.041 154.247 0.100 1 1109 54
    i 5.042 154.256 0.100 1 1105 58
    i 5.043 154.289 0.100 1 1093 66
    i 5.044 154.321 0.100 1 1113 45
    i 5.045 154.343 0.100 1 1103 63
    i 5.046 154.407 0.100 1 1107 59
    i 5.047 154.560 0.100 1 1103 59
    i 5.048 154.560 0.100 1 1105 61
    i 5.049 154.619 0.100 1 1107 78
    i 5.050 154.655 0.100 1 1097 64
    i 5.051 154.673 0.100 1 1105 69
    i 5.052 154.703 0.100 1 1105 77
    i 5.053 154.715 0.100 1 1095 82
    i 4.769 154.751 0.490 3 53 43 0
    i 4.770 155.251 0.490 3 53 43 1
    i 4.771 156.251 0.490 3 53 43 2
    i 4.772 157.751 0.490 3 53 43 3
    i 4.773 159.751 0.490 3 53 43 4
    i 4.775 154.751 0.490 3 41 43 0
    i 4.776 155.251 0.490 3 41 43 1
    i 4.777 156.251 0.490 3 41 43 2
    i 4.778 157.751 0.490 3 41 43 3
    i 4.779 159.751 0.490 3 41 43 4
    i 5.054 154.817 0.100 1 1107 74
    i 5.055 154.908 0.100 1 1109 69
    i 5.056 154.913 0.100 1 1092 64
    i 5.057 154.935 0.100 1 1103 76
    i 5.058 155.071 0.100 1 1107 52
    i 5.059 155.129 0.100 1 1115 52
    i 5.060 155.192 0.100 1 1099 76
    i 5.061 155.192 0.100 1 1101 56
    i 5.062 155.224 0.100 1 1105 68
    i 5.063 155.321 0.100 1 1107 61
    i 5.064 155.364 0.100 1 1097 75
    i 5.065 155.377 0.100 1 1105 52
    i 5.066 155.419 0.100 1 1099 56
    i 5.067 155.553 0.100 1 1101 78
    i 5.068 155.555 0.100 1 1109 57
    i 5.069 155.565 0.100 1 1103 66
    i 5.070 155.668 0.100 1 1103 63
    i 5.071 155.696 0.100 1 1105 44
    i 5.072 155.753 0.100 1 1102 70
    i 5.073 155.793 0.100 1 1100 53
    i 5.074 155.812 0.100 1 1111 57
    i 5.075 155.904 0.100 1 1095 61
    i 4.781 156.001 0.490 3 41 127 0
    i 4.782 156.501 0.490 3 41 127 1
    i 4.783 157.501 0.490 3 41 127 2
    i 4.784 159.001 0.490 3 41 127 3
    i 4.785 161.001 0.490 3 41 127 4
    i 4.787 156.001 0.490 3 53 56 0
    i 4.788 156.501 0.490 3 53 56 1
    i 4.789 157.501 0.490 3 53 56 2
    i 4.790 159.001 0.490 3 53 56 3
    i 4.791 161.001 0.490 3 53 56 4
    i 5.076 156.064 0.100 1 1105 74
    i 5.077 156.091 0.100 1 1099 64
    i 5.078 156.123 0.100 1 1095 57
    i 5.079 156.151 0.100 1 1099 69
    i 5.080 156.196 0.100 1 1103 56
    i 5.081 156.221 0.100 1 1101 69
    i 5.082 156.255 0.100 1 1115 65
    i 5.083 156.271 0.100 1 1101 66
    i 5.084 156.324 0.100 1 1105 61
    i 5.085 156.345 0.100 1 1103 66
    i 5.086 156.373 0.100 1 1107 51
    i 5.087 156.381 0.100 1 1109 51
    i 5.088 156.501 0.100 1 1100 70
    i 5.089 156.596 0.100 1 1111 56
    i 5.090 156.692 0.100 1 1094 79
    i 4.793 156.751 0.490 3 43 127 0
    i 4.794 157.251 0.490 3 43 127 1
    i 4.795 158.251 0.490 3 43 127 2
    i 4.796 159.751 0.490 3 43 127 3
    i 4.797 161.751 0.490 3 43 127 4
    i 4.799 156.751 0.490 3 55 56 0
    i 4.800 157.251 0.490 3 55 56 1
    i 4.801 158.251 0.490 3 55 56 2
    i 4.802 159.751 0.490 3 55 56 3
    i 4.803 161.751 0.490 3 55 56 4
    i 5.091 156.757 0.100 1 1097 52
    i 5.092 156.792 0.100 1 1092 68
    i 5.093 156.829 0.100 1 1101 78
    i 5.094 156.833 0.100 1 1103 67
    i 5.095 156.863 0.100 1 1099 51
    i 5.096 156.924 0.100 1 1102 62
    i 5.097 157.032 0.100 1 1113 51
    i 5.098 157.100 0.100 1 1099 71
    i 5.099 157.152 0.100 1 1113 57
    i 5.100 157.184 0.100 1 1101 60
    i 5.101 157.293 0.100 1 1110 60
    i 5.102 157.297 0.100 1 1096 53
    i 5.103 157.313 0.100 1 1103 72
    i 5.104 157.336 0.100 1 1096 61
    i 5.105 157.345 0.100 1 1108 78
    i 5.106 157.419 0.100 1 1103 74
    i 5.107 157.447 0.100 1 1097 51
    i 5.108 157.556 0.100 1 1106 63
    i 5.109 157.627 0.100 1 1099 69
    i 5.110 157.683 0.100 1 1101 68
    i 5.111 157.705 0.100 1 1097 70
    i 5.112 157.729 0.100 1 1102 82
    i 5.113 157.911 0.100 1 1110 69
    i 5.114 157.916 0.100 1 1098 82
    i 5.115 157.963 0.100 1 1108 51
    i 4.805 158.001 0.490 3 57 43 0
    i 4.806 158.501 0.490 3 57 43 1
    i 4.807 159.501 0.490 3 57 43 2
    i 4.808 161.001 0.490 3 57 43 3
    i 4.809 163.001 0.490 3 57 43 4
    i 4.811 158.001 0.490 3 45 43 0
    i 4.812 158.501 0.490 3 45 43 1
    i 4.813 159.501 0.490 3 45 43 2
    i 4.814 161.001 0.490 3 45 43 3
    i 4.815 163.001 0.490 3 45 43 4
    i 5.116 158.072 0.100 1 1103 60
    i 5.117 158.084 0.100 1 1111 77
    i 5.118 158.101 0.100 1 1102 61
    i 5.119 158.133 0.100 1 1108 37
    i 5.120 158.155 0.100 1 1094 69
    i 5.121 158.192 0.100 1 1094 79
    i 5.122 158.221 0.100 1 1106 77
    i 5.123 158.232 0.100 1 1097 70
    i 5.124 158.304 0.100 1 1105 61
    i 5.125 158.421 0.100 1 1106 62
    i 5.126 158.424 0.100 1 1093 62
    i 5.127 158.485 0.100 1 1104 72
    i 5.128 158.491 0.100 1 1100 73
    i 5.129 158.547 0.100 1 1110 48
    i 5.130 158.648 0.100 1 1104 60
    i 5.131 158.731 0.100 1 1114 52
    i 5.132 158.751 0.100 1 1108 62
    i 4.817 158.751 0.490 3 59 43 0
    i 4.818 159.251 0.490 3 59 43 1
    i 4.819 160.251 0.490 3 59 43 2
    i 4.820 161.751 0.490 3 59 43 3
    i 4.821 163.751 0.490 3 59 43 4
    i 4.823 158.751 0.490 3 47 43 0
    i 4.824 159.251 0.490 3 47 43 1
    i 4.825 160.251 0.490 3 47 43 2
    i 4.826 161.751 0.490 3 47 43 3
    i 4.827 163.751 0.490 3 47 43 4
    i 5.133 158.801 0.100 1 1092 81
    i 5.134 158.871 0.100 1 1108 56
    i 5.135 158.968 0.100 1 1106 58
    i 5.136 159.037 0.100 1 1096 73
    i 5.137 159.072 0.100 1 1103 55
    i 5.138 159.076 0.100 1 1098 61
    i 5.139 159.087 0.100 1 1104 73
    i 5.140 159.212 0.100 1 1108 64
    i 5.141 159.216 0.100 1 1107 72
    i 5.142 159.284 0.100 1 1106 69
    i 5.143 159.312 0.100 1 1102 68
    i 5.144 159.329 0.100 1 1091 56
    i 5.145 159.377 0.100 1 1116 43
    i 5.146 159.389 0.100 1 1104 77
    i 5.147 159.477 0.100 1 1110 67
    i 5.148 159.544 0.100 1 1106 49
    i 5.149 159.597 0.100 1 1106 53
    i 5.150 159.648 0.100 1 1104 57
    i 5.151 159.668 0.100 1 1100 68
    i 5.152 159.692 0.100 1 1102 63
    i 5.153 159.775 0.100 1 1098 77
    i 5.154 159.832 0.100 1 1104 72
    i 5.155 159.895 0.100 1 1104 42
    i 5.156 159.980 0.100 1 1100 52
    i 4.829 160.001 0.490 3 36 127 0
    i 4.830 160.501 0.490 3 36 127 1
    i 4.831 161.501 0.490 3 36 127 2
    i 4.832 163.001 0.490 3 36 127 3
    i 4.833 165.001 0.490 3 36 127 4
    i 4.835 160.001 0.490 3 48 56 0
    i 4.836 160.501 0.490 3 48 56 1
    i 4.837 161.501 0.490 3 48 56 2
    i 4.838 163.001 0.490 3 48 56 3
    i 4.839 165.001 0.490 3 48 56 4
    i 5.157 160.009 0.100 1 1102 64
    i 5.158 160.104 0.100 1 1108 78
    i 5.159 160.148 0.100 1 1101 57
    i 5.160 160.185 0.100 1 1100 61
    i 5.161 160.188 0.100 1 1110 59
    i 5.162 160.188 0.100 1 1112 60
    i 5.163 160.252 0.100 1 1104 76
    i 5.164 160.265 0.100 1 1106 44
    i 5.165 160.305 0.100 1 1100 60
    i 5.166 160.435 0.100 1 1094 62
    i 5.167 160.439 0.100 1 1114 50
    i 5.168 160.459 0.100 1 1096 71
    i 5.169 160.628 0.100 1 1102 57
    i 5.170 160.659 0.100 1 1102 62
    i 5.171 160.708 0.100 1 1106 72
    i 5.172 160.749 0.100 1 1100 79
    i 4.841 160.751 0.490 3 38 127 0
    i 4.842 161.251 0.490 3 38 127 1
    i 4.843 162.251 0.490 3 38 127 2
    i 4.844 163.751 0.490 3 38 127 3
    i 4.845 165.751 0.490 3 38 127 4
    i 4.847 160.751 0.490 3 50 56 0
    i 4.848 161.251 0.490 3 50 56 1
    i 4.849 162.251 0.490 3 50 56 2
    i 4.850 163.751 0.490 3 50 56 3
    i 4.851 165.751 0.490 3 50 56 4
    i 5.173 160.835 0.100 1 1100 66
    i 5.174 160.917 0.100 1 1099 78
    i 5.175 161.005 0.100 1 1098 80
    i 5.176 161.011 0.100 1 1100 65
    i 5.177 161.043 0.100 1 1102 53
    i 5.178 161.075 0.100 1 1112 60
    i 5.179 161.105 0.100 1 1110 68
    i 5.180 161.136 0.100 1 1108 39
    i 5.181 161.243 0.100 1 1112 68
    i 5.182 161.255 0.100 1 1102 78
    i 5.183 161.327 0.100 1 1100 66
    i 5.184 161.377 0.100 1 1092 65
    i 5.185 161.424 0.100 1 1098 50
    i 5.186 161.515 0.100 1 1102 60
    i 5.187 161.573 0.100 1 1112 27
    i 5.188 161.624 0.100 1 1104 69
    i 5.189 161.705 0.100 1 1098 55
    i 5.190 161.764 0.100 1 1110 33
    i 5.191 161.773 0.100 1 1097 61
    i 5.192 161.787 0.100 1 1098 51
    i 5.193 161.816 0.100 1 1108 56
    i 5.194 161.873 0.100 1 1112 51
    i 5.195 161.891 0.100 1 1102 62
    i 5.196 161.893 0.100 1 1108 54
    i 4.853 162.001 0.490 3 52 43 0
    i 4.854 162.501 0.490 3 52 43 1
    i 4.855 163.501 0.490 3 52 43 2
    i 4.856 165.001 0.490 3 52 43 3
    i 4.857 167.001 0.490 3 52 43 4
    i 4.859 162.001 0.490 3 40 43 0
    i 4.860 162.501 0.490 3 40 43 1
    i 4.861 163.501 0.490 3 40 43 2
    i 4.862 165.001 0.490 3 40 43 3
    i 4.863 167.001 0.490 3 40 43 4
    i 5.197 162.048 0.100 1 1104 61
    i 5.198 162.108 0.100 1 1110 79
    i 5.199 162.161 0.100 1 1096 60
    i 5.200 162.192 0.100 1 1115 52
    i 5.201 162.219 0.100 1 1100 60
    i 5.202 162.260 0.100 1 1101 60
    i 5.203 162.304 0.100 1 1096 51
    i 5.204 162.317 0.100 1 1102 63
    i 5.205 162.323 0.100 1 1098 75
    i 5.206 162.332 0.100 1 1099 80
    i 5.207 162.379 0.100 1 1107 33
    i 5.208 162.600 0.100 1 1104 79
    i 5.209 162.608 0.100 1 1110 56
    i 5.210 162.663 0.100 1 1094 60
    i 4.865 162.751 0.490 3 53 43 0
    i 4.866 163.251 0.490 3 53 43 1
    i 4.867 164.251 0.490 3 53 43 2
    i 4.868 165.751 0.490 3 53 43 3
    i 4.869 167.751 0.490 3 53 43 4
    i 4.871 162.751 0.490 3 41 43 0
    i 4.872 163.251 0.490 3 41 43 1
    i 4.873 164.251 0.490 3 41 43 2
    i 4.874 165.751 0.490 3 41 43 3
    i 4.875 167.751 0.490 3 41 43 4
    i 5.211 162.787 0.100 1 1106 60
    i 5.212 162.809 0.100 1 1106 67
    i 5.213 162.861 0.100 1 1093 64
    i 5.214 162.891 0.100 1 1110 70
    i 5.215 162.967 0.100 1 1099 77
    i 5.216 162.980 0.100 1 1105 22
    i 5.217 162.983 0.100 1 1106 56
    i 5.218 163.003 0.100 1 1108 61
    i 5.219 163.025 0.100 1 1105 55
    i 5.220 163.056 0.100 1 1104 60
    i 5.221 163.060 0.100 1 1106 59
    i 5.222 163.156 0.100 1 1108 63
    i 5.223 163.236 0.100 1 1115 53
    i 5.224 163.352 0.100 1 1106 53
    i 5.225 163.424 0.100 1 1096 69
    i 5.226 163.497 0.100 1 1099 63
    i 5.227 163.524 0.100 1 1107 52
    i 5.228 163.569 0.100 1 1104 77
    i 5.229 163.595 0.100 1 1103 59
    i 5.230 163.689 0.100 1 1108 55
    i 5.231 163.704 0.100 1 1103 60
    i 5.232 163.735 0.100 1 1105 52
    i 5.233 163.745 0.100 1 1091 61
    i 5.234 163.861 0.100 1 1104 65
    i 5.235 163.943 0.100 1 1101 57
    i 5.236 163.996 0.100 1 1107 72
    i 4.877 164.001 0.490 3 41 127 0
    i 4.878 164.501 0.490 3 41 127 1
    i 4.879 165.501 0.490 3 41 127 2
    i 4.880 167.001 0.490 3 41 127 3
    i 4.881 169.001 0.490 3 41 127 4
    i 4.883 164.001 0.490 3 53 56 0
    i 4.884 164.501 0.490 3 53 56 1
    i 4.885 165.501 0.490 3 53 56 2
    i 4.886 167.001 0.490 3 53 56 3
    i 4.887 169.001 0.490 3 53 56 4
    i 5.237 164.044 0.100 1 1111 46
    i 5.238 164.077 0.100 1 1105 78
    i 5.239 164.139 0.100 1 1115 35
    i 5.240 164.144 0.100 1 1101 61
    i 5.241 164.149 0.100 1 1113 27
    i 5.242 164.228 0.100 1 1105 57
    i 5.243 164.293 0.100 1 1097 70
    i 5.244 164.320 0.100 1 1098 57
    i 5.245 164.332 0.100 1 1101 67
    i 5.246 164.427 0.100 1 1101 76
    i 5.247 164.543 0.100 1 1100 59
    i 5.248 164.545 0.100 1 1103 58
    i 5.249 164.581 0.100 1 1109 74
    i 5.250 164.721 0.100 1 1113 54
    i 4.889 164.751 0.490 3 40 127 0
    i 4.890 165.251 0.490 3 40 127 1
    i 4.891 166.251 0.490 3 40 127 2
    i 4.892 167.751 0.490 3 40 127 3
    i 4.893 169.751 0.490 3 40 127 4
    i 4.895 164.751 0.490 3 52 56 0
    i 4.896 165.251 0.490 3 52 56 1
    i 4.897 166.251 0.490 3 52 56 2
    i 4.898 167.751 0.490 3 52 56 3
    i 4.899 169.751 0.490 3 52 56 4
    i 5.251 164.779 0.100 1 1103 62
    i 5.252 164.799 0.100 1 1107 45
    i 5.253 164.817 0.100 1 1099 75
    i 5.254 164.836 0.100 1 1099 78
    i 5.255 164.856 0.100 1 1111 35
    i 5.256 164.876 0.100 1 1109 72
    i 5.257 164.935 0.100 1 1103 57
    i 5.258 164.965 0.100 1 1093 52
    i 5.259 165.132 0.100 1 1107 76
    i 5.260 165.160 0.100 1 1101 74
    i 5.261 165.271 0.100 1 1111 66
    i 5.262 165.279 0.100 1 1099 73
    i 5.263 165.333 0.100 1 1098 57
    i 5.264 165.383 0.100 1 1109 30
    i 5.265 165.393 0.100 1 1113 51
    i 5.266 165.481 0.100 1 1103 61
    i 5.267 165.483 0.100 1 1109 61
    i 5.268 165.509 0.100 1 1113 47
    i 5.269 165.531 0.100 1 1097 60
    i 5.270 165.604 0.100 1 1113 64
    i 5.271 165.643 0.100 1 1101 77
    i 5.272 165.853 0.100 1 1101 74
    i 5.273 165.884 0.100 1 1097 56
    i 5.274 165.916 0.100 1 1097 58
    i 5.275 165.963 0.100 1 1093 71
    i 4.901 166.001 0.490 3 57 43 0
    i 4.902 166.501 0.490 3 57 43 1
    i 4.903 167.501 0.490 3 57 43 2
    i 4.904 169.001 0.490 3 57 43 3
    i 4.905 171.001 0.490 3 57 43 4
    i 4.907 166.001 0.490 3 45 43 0
    i 4.908 166.501 0.490 3 45 43 1
    i 4.909 167.501 0.490 3 45 43 2
    i 4.910 169.001 0.490 3 45 43 3
    i 4.911 171.001 0.490 3 45 43 4
    i 5.276 166.027 0.100 1 1107 69
    i 5.277 166.079 0.100 1 1103 60
    i 5.278 166.103 0.100 1 1095 71
    i 5.279 166.127 0.100 1 1111 49
    i 5.280 166.161 0.100 1 1101 65
    i 5.281 166.208 0.100 1 1109 50
    i 5.282 166.211 0.100 1 1098 76
    i 5.283 166.263 0.100 1 1115 51
    i 5.284 166.288 0.100 1 1105 57
    i 5.285 166.296 0.100 1 1101 51
    i 5.286 166.453 0.100 1 1111 61
    i 5.287 166.631 0.100 1 1099 70
    i 5.288 166.732 0.100 1 1105 61
    i 5.289 166.748 0.100 1 1100 74
    i 5.290 166.753 0.100 1 1099 77
    i 4.913 166.751 0.490 3 55 43 0
    i 5.291 166.755 0.100 1 1103 71
    i 4.914 167.251 0.490 3 55 43 1
    i 4.915 168.251 0.490 3 55 43 2
    i 4.916 169.751 0.490 3 55 43 3
    i 4.917 171.751 0.490 3 55 43 4
    i 4.919 166.751 0.490 3 43 43 0
    i 4.920 167.251 0.490 3 43 43 1
    i 4.921 168.251 0.490 3 43 43 2
    i 4.922 169.751 0.490 3 43 43 3
    i 4.923 171.751 0.490 3 43 43 4
    i 5.292 166.768 0.100 1 1105 74
    i 5.293 166.776 0.100 1 1095 55
    i 5.294 166.780 0.100 1 1103 56
    i 5.295 166.791 0.100 1 1101 77
    i 5.296 166.837 0.100 1 1109 70
    i 5.297 166.897 0.100 1 1109 49
    i 5.298 166.919 0.100 1 1109 44
    i 5.299 166.963 0.100 1 1105 44
    i 5.300 167.081 0.100 1 1105 76
    i 5.301 167.141 0.100 1 1107 36
    i 5.302 167.240 0.100 1 1095 83
    i 5.303 167.300 0.100 1 1092 83
    i 5.304 167.369 0.100 1 1103 81
    i 5.305 167.387 0.100 1 1107 57
    i 5.306 167.411 0.100 1 1107 50
    i 5.307 167.443 0.100 1 1099 71
    i 5.308 167.443 0.100 1 1105 72
    i 5.309 167.475 0.100 1 1111 62
    i 5.310 167.551 0.100 1 1105 53
    i 5.311 167.684 0.100 1 1107 69
    i 5.312 167.711 0.100 1 1105 76
    i 5.313 167.743 0.100 1 1105 63
    i 5.314 167.832 0.100 1 1115 50
    i 5.315 167.853 0.100 1 1107 59
    i 5.316 167.880 0.100 1 1097 55
    i 5.317 167.933 0.100 1 1108 28
    i 5.318 167.968 0.100 1 1100 63
    i 5.319 168.005 0.100 1 1097 66
    i 4.925 168.001 0.490 3 40 127 0
    i 4.926 168.501 0.490 3 40 127 1
    i 4.927 169.501 0.490 3 40 127 2
    i 4.928 171.001 0.490 3 40 127 3
    i 4.929 173.001 0.490 3 40 127 4
    i 4.931 168.001 0.490 3 52 56 0
    i 4.932 168.501 0.490 3 52 56 1
    i 4.933 169.501 0.490 3 52 56 2
    i 4.934 171.001 0.490 3 52 56 3
    i 4.935 173.001 0.490 3 52 56 4
    i 5.320 168.052 0.100 1 1105 40
    i 5.321 168.055 0.100 1 1103 65
    i 5.322 168.097 0.100 1 1107 67
    i 5.323 168.101 0.100 1 1107 61
    i 5.324 168.163 0.100 1 1092 60
    i 5.325 168.167 0.100 1 1103 48
    i 5.326 168.288 0.100 1 1103 54
    i 5.327 168.355 0.100 1 1111 42
    i 5.328 168.384 0.100 1 1114 45
    i 5.329 168.572 0.100 1 1100 58
    i 5.330 168.607 0.100 1 1105 66
    i 5.331 168.636 0.100 1 1099 71
    i 5.332 168.667 0.100 1 1101 58
    i 5.333 168.669 0.100 1 1102 60
    i 4.937 168.751 0.490 3 38 127 0
    i 4.938 169.251 0.490 3 38 127 1
    i 4.939 170.251 0.490 3 38 127 2
    i 4.940 171.751 0.490 3 38 127 3
    i 4.941 173.751 0.490 3 38 127 4
    i 4.943 168.751 0.490 3 50 56 0
    i 4.944 169.251 0.490 3 50 56 1
    i 4.945 170.251 0.490 3 50 56 2
    i 4.946 171.751 0.490 3 50 56 3
    i 4.947 173.751 0.490 3 50 56 4
    i 5.334 168.755 0.100 1 1110 54
    i 5.335 168.795 0.100 1 1112 22
    i 5.336 168.823 0.100 1 1104 55
    i 5.337 168.887 0.100 1 1101 77
    i 5.338 168.897 0.100 1 1109 59
    i 5.339 168.920 0.100 1 1099 49
    i 5.340 168.939 0.100 1 1100 55
    i 5.341 168.985 0.100 1 1105 64
    i 5.342 169.179 0.100 1 1108 62
    i 5.343 169.193 0.100 1 1098 50
    i 5.344 169.243 0.100 1 1096 57
    i 5.345 169.292 0.100 1 1114 52
    i 5.346 169.353 0.100 1 1110 74
    i 5.347 169.440 0.100 1 1112 69
    i 5.348 169.545 0.100 1 1092 68
    i 5.349 169.548 0.100 1 1104 66
    i 5.350 169.553 0.100 1 1103 79
    i 5.351 169.572 0.100 1 1101 71
    i 5.352 169.600 0.100 1 1098 83
    i 5.353 169.603 0.100 1 1110 24
    i 5.354 169.668 0.100 1 1108 68
    i 5.355 169.751 0.100 1 1097 63
    i 5.356 169.783 0.100 1 1108 58
    i 5.357 169.811 0.100 1 1100 51
    i 5.358 169.903 0.100 1 1094 73
    i 5.359 169.920 0.100 1 1104 72
    i 5.360 169.957 0.100 1 1102 58
    i 4.949 170.001 0.490 3 55 43 0
    i 4.950 170.501 0.490 3 55 43 1
    i 4.951 171.501 0.490 3 55 43 2
    i 4.952 173.001 0.490 3 55 43 3
    i 4.953 175.001 0.490 3 55 43 4
    i 4.955 170.001 0.490 3 43 43 0
    i 4.956 170.501 0.490 3 43 43 1
    i 4.957 171.501 0.490 3 43 43 2
    i 4.958 173.001 0.490 3 43 43 3
    i 4.959 175.001 0.490 3 43 43 4
    i 5.361 170.083 0.100 1 1112 49
    i 5.362 170.143 0.100 1 1110 52
    i 5.363 170.231 0.100 1 1098 74
    i 5.364 170.404 0.100 1 1110 55
    i 5.365 170.445 0.100 1 1096 62
    i 5.366 170.480 0.100 1 1104 72
    i 5.367 170.495 0.100 1 1094 74
    i 5.368 170.521 0.100 1 1104 69
    i 5.369 170.580 0.100 1 1114 40
    i 5.370 170.588 0.100 1 1110 52
    i 5.371 170.649 0.100 1 1099 64
    i 5.372 170.652 0.100 1 1104 66
    i 5.373 170.728 0.100 1 1106 63
    i 4.961 170.751 0.490 3 55 43 0
    i 4.962 171.251 0.490 3 55 43 1
    i 4.963 172.251 0.490 3 55 43 2
    i 4.964 173.751 0.490 3 55 43 3
    i 4.965 175.751 0.490 3 55 43 4
    i 4.967 170.751 0.490 3 43 43 0
    i 4.968 171.251 0.490 3 43 43 1
    i 4.969 172.251 0.490 3 43 43 2
    i 4.970 173.751 0.490 3 43 43 3
    i 4.971 175.751 0.490 3 43 43 4
    i 5.374 170.771 0.100 1 1113 6
    i 5.375 170.785 0.100 1 1102 74
    i 5.376 170.865 0.100 1 1108 42
    i 5.377 171.164 0.100 1 1101 68
    i 5.378 171.169 0.100 1 1102 56
    i 5.379 171.215 0.100 1 1110 61
    i 5.380 171.227 0.100 1 1116 40
    i 5.381 171.268 0.100 1 1100 56
    i 5.382 171.296 0.100 1 1106 80
    i 5.383 171.387 0.100 1 1106 56
    i 5.384 171.400 0.100 1 1096 75
    i 5.385 171.485 0.100 1 1108 59
    i 5.386 171.569 0.100 1 1106 79
    i 5.387 171.717 0.100 1 1098 77
    i 5.388 171.737 0.100 1 1091 59
    i 5.389 171.747 0.100 1 1115 8
    i 5.390 171.865 0.100 1 1098 56
    i 5.391 171.912 0.100 1 1104 51
    i 5.392 171.924 0.100 1 1096 80
    i 4.973 172.001 0.490 3 36 127 0
    i 4.974 172.501 0.490 3 36 127 1
    i 4.975 173.501 0.490 3 36 127 2
    i 4.976 175.001 0.490 3 36 127 3
    i 4.977 177.001 0.490 3 36 127 4
    i 4.979 172.001 0.490 3 48 56 0
    i 4.980 172.501 0.490 3 48 56 1
    i 4.981 173.501 0.490 3 48 56 2
    i 4.982 175.001 0.490 3 48 56 3
    i 4.983 177.001 0.490 3 48 56 4
    i 5.393 172.041 0.100 1 1106 26
    i 5.394 172.059 0.100 1 1112 63
    i 5.395 172.151 0.100 1 1116 49
    i 5.396 172.165 0.100 1 1106 59
    i 5.397 172.436 0.100 1 1100 62
    i 5.398 172.443 0.100 1 1098 81
    i 5.399 172.445 0.100 1 1100 60
    i 5.400 172.483 0.100 1 1102 79
    i 5.401 172.559 0.100 1 1108 46
    i 5.402 172.579 0.100 1 1093 69
    i 5.403 172.692 0.100 1 1107 27
    i 4.985 172.751 0.490 3 36 127 0
    i 4.986 173.251 0.490 3 36 127 1
    i 4.987 174.251 0.490 3 36 127 2
    i 4.988 175.751 0.490 3 36 127 3
    i 4.989 177.751 0.490 3 36 127 4
    i 4.991 172.751 0.490 3 48 56 0
    i 4.992 173.251 0.490 3 48 56 1
    i 4.993 174.251 0.490 3 48 56 2
    i 4.994 175.751 0.490 3 48 56 3
    i 4.995 177.751 0.490 3 48 56 4
    i 5.404 172.955 0.100 1 1096 72
    i 5.405 173.052 0.100 1 1112 60
    i 5.406 173.056 0.100 1 1104 41
    i 5.407 173.108 0.100 1 1100 53
    i 5.408 173.147 0.100 1 1114 60
    i 5.409 173.201 0.100 1 1103 80
    i 5.410 173.212 0.100 1 1111 41
    i 5.411 173.333 0.100 1 1099 58
    i 5.412 173.356 0.100 1 1102 74
    i 5.413 173.557 0.100 1 1107 18
    i 5.414 173.703 0.100 1 1093 68
    i 5.415 173.707 0.100 1 1104 50
    i 5.416 173.892 0.100 1 1109 50
    i 5.417 173.900 0.100 1 1108 48
    i 5.418 173.920 0.100 1 1098 63
    i 4.997 174.001 0.490 3 52 43 0
    i 4.998 174.501 0.490 3 52 43 1
    i 4.999 175.501 0.490 3 52 43 2
    i 4.1000 177.001 0.490 3 52 43 3
    i 4.1001 179.001 0.490 3 52 43 4
    i 4.1003 174.001 0.490 3 40 43 0
    i 4.1004 174.501 0.490 3 40 43 1
    i 4.1005 175.501 0.490 3 40 43 2
    i 4.1006 177.001 0.490 3 40 43 3
    i 4.1007 179.001 0.490 3 40 43 4
    i 5.419 174.132 0.100 1 1093 55
    i 5.420 174.167 0.100 1 1097 59
    i 5.421 174.172 0.100 1 1104 52
    i 5.422 174.215 0.100 1 1103 64
    i 5.423 174.343 0.100 1 1115 26
    i 5.424 174.403 0.100 1 1115 23
    i 5.425 174.412 0.100 1 1111 40
    i 5.426 174.511 0.100 1 1112 38
    i 4.1009 174.751 0.490 3 52 43 0
    i 4.1010 175.251 0.490 3 52 43 1
    i 4.1011 176.251 0.490 3 52 43 2
    i 4.1012 177.751 0.490 3 52 43 3
    i 4.1013 179.751 0.490 3 52 43 4
    i 4.1015 174.751 0.490 3 40 43 0
    i 4.1016 175.251 0.490 3 40 43 1
    i 4.1017 176.251 0.490 3 40 43 2
    i 4.1018 177.751 0.490 3 40 43 3
    i 4.1019 179.751 0.490 3 40 43 4
    i 5.427 174.879 0.100 1 1104 56
    i 5.428 174.915 0.100 1 1096 67
    i 5.429 174.992 0.100 1 1101 58
    i 5.430 175.027 0.100 1 1095 66
    i 5.431 175.048 0.100 1 1113 11
    i 5.432 175.055 0.100 1 1109 54
    i 5.433 175.087 0.100 1 1099 82
    i 5.434 175.144 0.100 1 1107 39
    i 5.435 175.244 0.100 1 1117 31
    i 5.436 175.533 0.100 1 1099 61
    i 5.437 175.595 0.100 1 1102 70
    i 5.438 175.673 0.100 1 1113 12
    i 5.439 175.715 0.100 1 1097 70
    i 5.440 175.745 0.100 1 1099 81
    i 5.441 175.775 0.100 1 1105 67
    i 5.442 175.916 0.100 1 1107 41
    i 4.1021 176.001 0.490 3 36 127 0
    i 4.1022 176.501 0.490 3 36 127 1
    i 4.1023 177.501 0.490 3 36 127 2
    i 4.1024 179.001 0.490 3 36 127 3
    i 4.1025 181.001 0.490 3 36 127 4
    i 4.1027 176.001 0.490 3 48 56 0
    i 4.1028 176.501 0.490 3 48 56 1
    i 4.1029 177.501 0.490 3 48 56 2
    i 4.1030 179.001 0.490 3 48 56 3
    i 4.1031 181.001 0.490 3 48 56 4
    i 5.443 176.119 0.100 1 1105 39
    i 5.444 176.189 0.100 1 1092 61
    i 5.445 176.217 0.100 1 1115 5
    i 5.446 176.288 0.100 1 1097 66
    i 5.447 176.340 0.100 1 1101 52
    i 5.448 176.357 0.100 1 1103 68
    i 5.449 176.524 0.100 1 1097 60
    i 4.1033 176.751 0.490 3 36 127 0
    i 4.1034 177.251 0.490 3 36 127 1
    i 4.1035 178.251 0.490 3 36 127 2
    i 4.1036 179.751 0.490 3 36 127 3
    i 4.1037 181.751 0.490 3 36 127 4
    i 4.1039 176.751 0.490 3 48 56 0
    i 4.1040 177.251 0.490 3 48 56 1
    i 4.1041 178.251 0.490 3 48 56 2
    i 4.1042 179.751 0.490 3 48 56 3
    i 4.1043 181.751 0.490 3 48 56 4
    i 5.450 176.755 0.100 1 1106 -1
    i 5.451 176.904 0.100 1 1115 60
    i 5.452 176.911 0.100 1 1095 76
    i 5.453 176.913 0.100 1 1109 35
    i 5.454 176.923 0.100 1 1101 55
    i 5.455 176.943 0.100 1 1101 52
    i 5.456 177.009 0.100 1 1094 74
    i 5.457 177.127 0.100 1 1099 77
    i 5.458 177.372 0.100 1 1108 24
    i 5.459 177.447 0.100 1 1113 40
    i 5.460 177.671 0.100 1 1099 76
    i 5.461 177.733 0.100 1 1103 70
    i 5.462 177.743 0.100 1 1098 54
    i 5.463 177.747 0.100 1 1093 72
    i 5.464 177.748 0.100 1 1111 40
    i 5.465 177.916 0.100 1 1103 55
    i 5.466 178.069 0.100 1 1114 4
    i 5.467 178.148 0.100 1 1109 56
    i 5.468 178.347 0.100 1 1103 63
    i 5.469 178.361 0.100 1 1097 80
    i 5.470 178.584 0.100 1 1109 51
    i 5.471 178.847 0.100 1 1112 30
    i 5.472 178.887 0.100 1 1105 49
    i 5.473 179.199 0.100 1 1105 84
    i 5.474 179.212 0.100 1 1100 82
    i 5.475 179.475 0.100 1 1095 72
    i 5.476 179.581 0.100 1 1116 34
    i 5.477 179.704 0.100 1 1114 15
    i 4.1045 180.001 0.490 3 36 127 0
    i 4.1046 180.501 0.490 3 36 127 1
    i 4.1047 181.501 0.490 3 36 127 2
    i 4.1048 183.001 0.490 3 36 127 3
    i 4.1049 185.001 0.490 3 36 127 4
    i 4.1051 180.001 0.490 3 48 56 0
    i 4.1052 180.501 0.490 3 48 56 1
    i 4.1053 181.501 0.490 3 48 56 2
    i 4.1054 183.001 0.490 3 48 56 3
    i 4.1055 185.001 0.490 3 48 56 4
    i 5.478 180.121 0.100 1 1097 53
    i 5.479 180.183 0.100 1 1105 69
    i 5.480 180.255 0.100 1 1116 38
    i 5.481 180.641 0.100 1 1116 24
    i 4.1057 180.751 0.490 3 36 127 0
    i 4.1058 181.251 0.490 3 36 127 1
    i 4.1059 182.251 0.490 3 36 127 2
    i 4.1060 183.751 0.490 3 36 127 3
    i 4.1061 185.751 0.490 3 36 127 4
    i 4.1063 180.751 0.490 3 48 56 0
    i 4.1064 181.251 0.490 3 48 56 1
    i 4.1065 182.251 0.490 3 48 56 2
    i 4.1066 183.751 0.490 3 48 56 3
    i 4.1067 185.751 0.490 3 48 56 4
    i 5.482 180.919 0.100 1 1102 73
    i 5.483 181.053 0.100 1 1098 70
    i 5.484 181.097 0.100 1 1108 40
    i 5.485 181.609 0.100 1 1110 23
    i 5.486 181.625 0.100 1 1106 27
    i 5.487 181.659 0.100 1 1100 59
    i 5.488 182.477 0.100 1 1104 79
    i 5.489 182.529 0.100 1 1109 8
    i 5.490 183.353 0.100 1 1106 66
    i 5.491 183.353 0.100 1 1113 4
    i 5.492 183.920 0.100 1 1096 51
    i 4.1069 184.001 0.490 3 36 127 0
    i 4.1070 184.501 0.490 3 36 127 1
    i 4.1071 185.501 0.490 3 36 127 2
    i 4.1072 187.001 0.490 3 36 127 3
    i 4.1073 189.001 0.490 3 36 127 4
    i 5.493 184.097 0.100 1 1111 22
    i 5.494 184.429 0.100 1 1098 78
    i 4.1075 184.751 0.490 3 36 127 0
    i 4.1076 185.251 0.490 3 36 127 1
    i 4.1077 186.251 0.490 3 36 127 2
    i 4.1078 187.751 0.490 3 36 127 3
    i 4.1079 189.751 0.490 3 36 127 4
    i 5.495 184.761 0.100 1 1115 12
    i 5.496 185.381 0.100 1 1102 50
    i 5.497 186.276 0.100 1 1100 69
    i 5.498 186.941 0.100 1 1105 79
    i 5.499 187.664 0.100 1 1107 51
    i 4.1081 188.001 0.490 3 36 127 0
    i 4.1082 188.501 0.490 3 36 127 1
    i 4.1083 189.501 0.490 3 36 127 2
    i 4.1084 191.001 0.490 3 36 127 3
    i 4.1085 193.001 0.490 3 36 127 4
    i 5.500 188.385 0.100 1 1097 77
    i 5.501 189.049 0.100 1 1099 71
    i 5.502 189.944 0.100 1 1101 55
    i 5.503 190.897 0.100 1 1099 52
    i 5.504 191.408 0.100 1 1105 57
    i 5.505 191.976 0.100 1 1106 51
    i 5.506 192.852 0.100 1 1098 69
    i 5.507 193.671 0.100 1 1100 61
    i 5.508 194.412 0.100 1 1100 48
    i 5.509 195.211 0.100 1 1098 50
    i 5.510 195.856 0.100 1 1106 51
    i 5.511 196.444 0.100 1 1106 54
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
{"6c9f37ab-392f-429b-8217-eac09f295362":[{"instanceName":"","startDistance":60,"delayDistance":100,"noteNumberToHeightScale":7.50,"delayTime":0.50,"duration":0.5,"delayCount":5},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":0.005,"note":1,"velocity":1}},{"noteOn":{"time":17.000,"note":36,"velocity":127}},{"noteOn":{"time":17.750,"note":36,"velocity":127}},{"noteOn":{"time":21.000,"note":36,"velocity":127}},{"noteOn":{"time":21.750,"note":36,"velocity":127}},{"noteOn":{"time":25.000,"note":36,"velocity":127}},{"noteOn":{"time":25.750,"note":38,"velocity":127}},{"noteOn":{"time":29.000,"note":41,"velocity":127}},{"noteOn":{"time":29.750,"note":40,"velocity":127}},{"noteOn":{"time":33.000,"note":36,"velocity":127}},{"noteOn":{"time":33.750,"note":38,"velocity":127}},{"noteOn":{"time":37.000,"note":41,"velocity":127}},{"noteOn":{"time":37.750,"note":43,"velocity":127}},{"noteOn":{"time":41.000,"note":36,"velocity":127}},{"noteOn":{"time":41.750,"note":38,"velocity":127}},{"noteOn":{"time":45.000,"note":41,"velocity":127}},{"noteOn":{"time":45.750,"note":40,"velocity":127}},{"noteOn":{"time":49.000,"note":40,"velocity":127}},{"noteOn":{"time":49.750,"note":38,"velocity":127}},{"noteOn":{"time":53.000,"note":36,"velocity":127}},{"noteOn":{"time":53.750,"note":36,"velocity":127}},{"noteOn":{"time":57.000,"note":36,"velocity":127}},{"noteOn":{"time":57.750,"note":38,"velocity":127}},{"noteOn":{"time":61.000,"note":41,"velocity":127}},{"noteOn":{"time":61.750,"note":40,"velocity":127}},{"noteOn":{"time":65.000,"note":36,"velocity":127}},{"noteOn":{"time":65.750,"note":38,"velocity":127}},{"noteOn":{"time":69.000,"note":41,"velocity":127}},{"noteOn":{"time":69.750,"note":43,"velocity":127}},{"noteOn":{"time":73.000,"note":36,"velocity":127}},{"noteOn":{"time":73.750,"note":38,"velocity":127}},{"noteOn":{"time":77.000,"note":41,"velocity":127}},{"noteOn":{"time":77.750,"note":40,"velocity":127}},{"noteOn":{"time":81.000,"note":40,"velocity":127}},{"noteOn":{"time":81.750,"note":38,"velocity":127}},{"noteOn":{"time":85.000,"note":36,"velocity":127}},{"noteOn":{"time":85.750,"note":36,"velocity":127}},{"noteOn":{"time":91.000,"note":36,"velocity":127}},{"noteOn":{"time":91.750,"note":36,"velocity":127}},{"noteOn":{"time":97.000,"note":36,"velocity":127}},{"noteOn":{"time":97.750,"note":36,"velocity":127}},{"noteOn":{"time":101.000,"note":36,"velocity":127}},{"noteOn":{"time":101.750,"note":36,"velocity":127}},{"noteOn":{"time":105.000,"note":36,"velocity":127}},{"noteOn":{"time":105.750,"note":36,"velocity":127}},{"noteOn":{"time":107.000,"note":36,"velocity":127}},{"noteOn":{"time":107.750,"note":36,"velocity":127}},{"noteOn":{"time":109.000,"note":36,"velocity":127}},{"noteOn":{"time":109.125,"note":43,"velocity":127}},{"noteOn":{"time":109.750,"note":36,"velocity":127}},{"noteOn":{"time":109.875,"note":43,"velocity":127}},{"noteOn":{"time":111.000,"note":36,"velocity":127}},{"noteOn":{"time":111.125,"note":43,"velocity":127}},{"noteOn":{"time":111.750,"note":36,"velocity":127}},{"noteOn":{"time":111.875,"note":43,"velocity":127}},{"noteOn":{"time":113.000,"note":36,"velocity":127}},{"noteOn":{"time":113.125,"note":43,"velocity":127}},{"noteOn":{"time":113.250,"note":48,"velocity":127}},{"noteOn":{"time":113.750,"note":36,"velocity":127}},{"noteOn":{"time":113.875,"note":43,"velocity":127}},{"noteOn":{"time":114.000,"note":48,"velocity":127}},{"noteOn":{"time":115.000,"note":36,"velocity":127}},{"noteOn":{"time":115.125,"note":43,"velocity":127}},{"noteOn":{"time":115.250,"note":52,"velocity":64}},{"noteOn":{"time":115.750,"note":36,"velocity":127}},{"noteOn":{"time":115.875,"note":43,"velocity":127}},{"noteOn":{"time":116.000,"note":52,"velocity":64}},{"noteOn":{"time":117.000,"note":36,"velocity":127}},{"noteOn":{"time":117.750,"note":38,"velocity":127}},{"noteOn":{"time":119.000,"note":52,"velocity":49}},{"noteOn":{"time":119.750,"note":53,"velocity":49}},{"noteOn":{"time":121.000,"note":41,"velocity":127}},{"noteOn":{"time":121.750,"note":40,"velocity":127}},{"noteOn":{"time":123.000,"note":57,"velocity":49}},{"noteOn":{"time":123.750,"note":55,"velocity":49}},{"noteOn":{"time":125.000,"note":36,"velocity":127}},{"noteOn":{"time":125.750,"note":38,"velocity":127}},{"noteOn":{"time":127.000,"note":52,"velocity":49}},{"noteOn":{"time":127.750,"note":53,"velocity":49}},{"noteOn":{"time":129.000,"note":41,"velocity":127}},{"noteOn":{"time":129.750,"note":43,"velocity":127}},{"noteOn":{"time":131.000,"note":57,"velocity":49}},{"noteOn":{"time":131.750,"note":59,"velocity":49}},{"noteOn":{"time":133.000,"note":36,"velocity":127}},{"noteOn":{"time":133.750,"note":38,"velocity":127}},{"noteOn":{"time":135.000,"note":52,"velocity":49}},{"noteOn":{"time":135.750,"note":53,"velocity":49}},{"noteOn":{"time":137.000,"note":41,"velocity":127}},{"noteOn":{"time":137.750,"note":40,"velocity":127}},{"noteOn":{"time":139.000,"note":57,"velocity":49}},{"noteOn":{"time":139.750,"note":55,"velocity":49}},{"noteOn":{"time":141.000,"note":40,"velocity":127}},{"noteOn":{"time":141.750,"note":38,"velocity":127}},{"noteOn":{"time":143.000,"note":55,"velocity":49}},{"noteOn":{"time":143.750,"note":53,"velocity":49}},{"noteOn":{"time":145.000,"note":36,"velocity":127}},{"noteOn":{"time":145.750,"note":36,"velocity":127}},{"noteOn":{"time":147.000,"note":52,"velocity":49}},{"noteOn":{"time":147.750,"note":52,"velocity":49}},{"noteOn":{"time":149.000,"note":36,"velocity":127}},{"noteOn":{"time":149.000,"note":48,"velocity":56}},{"noteOn":{"time":149.750,"note":38,"velocity":127}},{"noteOn":{"time":149.750,"note":50,"velocity":56}},{"noteOn":{"time":151.000,"note":52,"velocity":43}},{"noteOn":{"time":151.000,"note":40,"velocity":43}},{"noteOn":{"time":151.750,"note":41,"velocity":42}},{"noteOn":{"time":151.750,"note":53,"velocity":43}},{"noteOn":{"time":153.000,"note":41,"velocity":127}},{"noteOn":{"time":153.000,"note":53,"velocity":56}},{"noteOn":{"time":153.750,"note":40,"velocity":127}},{"noteOn":{"time":153.750,"note":52,"velocity":56}},{"noteOn":{"time":155.000,"note":57,"velocity":43}},{"noteOn":{"time":155.000,"note":45,"velocity":43}},{"noteOn":{"time":155.750,"note":55,"velocity":43}},{"noteOn":{"time":155.750,"note":43,"velocity":43}},{"noteOn":{"time":157.000,"note":36,"velocity":127}},{"noteOn":{"time":157.000,"note":48,"velocity":56}},{"noteOn":{"time":157.750,"note":38,"velocity":127}},{"noteOn":{"time":157.750,"note":50,"velocity":56}},{"noteOn":{"time":159.000,"note":52,"velocity":43}},{"noteOn":{"time":159.000,"note":40,"velocity":43}},{"noteOn":{"time":159.750,"note":53,"velocity":43}},{"noteOn":{"time":159.750,"note":41,"velocity":43}},{"noteOn":{"time":161.000,"note":41,"velocity":127}},{"noteOn":{"time":161.000,"note":53,"velocity":56}},{"noteOn":{"time":161.750,"note":43,"velocity":127}},{"noteOn":{"time":161.750,"note":55,"velocity":56}},{"noteOn":{"time":163.000,"note":57,"velocity":43}},{"noteOn":{"time":163.000,"note":45,"velocity":43}},{"noteOn":{"time":163.750,"note":59,"velocity":43}},{"noteOn":{"time":163.750,"note":47,"velocity":43}},{"noteOn":{"time":165.000,"note":36,"velocity":127}},{"noteOn":{"time":165.000,"note":48,"velocity":56}},{"noteOn":{"time":165.750,"note":38,"velocity":127}},{"noteOn":{"time":165.750,"note":50,"velocity":56}},{"noteOn":{"time":167.000,"note":52,"velocity":43}},{"noteOn":{"time":167.000,"note":40,"velocity":43}},{"noteOn":{"time":167.750,"note":53,"velocity":43}},{"noteOn":{"time":167.750,"note":41,"velocity":43}},{"noteOn":{"time":169.000,"note":41,"velocity":127}},{"noteOn":{"time":169.000,"note":53,"velocity":56}},{"noteOn":{"time":169.750,"note":40,"velocity":127}},{"noteOn":{"time":169.750,"note":52,"velocity":56}},{"noteOn":{"time":171.000,"note":57,"velocity":43}},{"noteOn":{"time":171.000,"note":45,"velocity":43}},{"noteOn":{"time":171.750,"note":55,"velocity":43}},{"noteOn":{"time":171.750,"note":43,"velocity":43}},{"noteOn":{"time":173.000,"note":40,"velocity":127}},{"noteOn":{"time":173.000,"note":52,"velocity":56}},{"noteOn":{"time":173.750,"note":38,"velocity":127}},{"noteOn":{"time":173.750,"note":50,"velocity":56}},{"noteOn":{"time":175.000,"note":55,"velocity":43}},{"noteOn":{"time":175.000,"note":43,"velocity":43}},{"noteOn":{"time":175.750,"note":55,"velocity":43}},{"noteOn":{"time":175.750,"note":43,"velocity":43}},{"noteOn":{"time":177.000,"note":36,"velocity":127}},{"noteOn":{"time":177.000,"note":48,"velocity":56}},{"noteOn":{"time":177.750,"note":36,"velocity":127}},{"noteOn":{"time":177.750,"note":48,"velocity":56}},{"noteOn":{"time":179.000,"note":52,"velocity":43}},{"noteOn":{"time":179.000,"note":40,"velocity":43}},{"noteOn":{"time":179.750,"note":52,"velocity":43}},{"noteOn":{"time":179.750,"note":40,"velocity":43}},{"noteOn":{"time":181.000,"note":36,"velocity":127}},{"noteOn":{"time":181.000,"note":48,"velocity":56}},{"noteOn":{"time":181.750,"note":36,"velocity":127}},{"noteOn":{"time":181.750,"note":48,"velocity":56}},{"noteOn":{"time":185.000,"note":36,"velocity":127}},{"noteOn":{"time":185.000,"note":48,"velocity":56}},{"noteOn":{"time":185.750,"note":36,"velocity":127}},{"noteOn":{"time":185.750,"note":48,"velocity":56}},{"noteOn":{"time":189.000,"note":36,"velocity":127}},{"noteOn":{"time":189.750,"note":36,"velocity":127}},{"noteOn":{"time":193.000,"note":36,"velocity":127}}],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","fadeInTime":0.05,"fadeOutTime":0.05,"soundDistanceMin":1,"soundDistanceMax":500},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-1.300,-154.000,0.225]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-31.257,-154.000,389.867]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[25.941,-154.000,41.843]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[219.046,-154.000,395.695]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-354.363,-154.000,-177.790]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-36.407,-154.000,-115.105]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[38.017,-154.000,79.802]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[183.337,-154.000,129.636]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-189.137,-154.000,-82.365]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[68.654,266.000,431.346]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-6.068,230.000,-44.028]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[206.206,326.000,61.914]}},{"noteOn":{"time":10.245,"note":103.000,"xyz":[-177.938,326.000,-389.006]}},{"noteOn":{"time":10.800,"note":95.000,"xyz":[-150.739,230.000,-347.329]}},{"noteOn":{"time":11.530,"note":97.000,"xyz":[-324.942,254.000,-30.290]}},{"noteOn":{"time":12.440,"note":97.000,"xyz":[-253.841,254.000,-14.254]}},{"noteOn":{"time":13.355,"note":95.000,"xyz":[0.703,230.000,23.795]}},{"noteOn":{"time":14.095,"note":103.000,"xyz":[-331.282,326.000,82.637]}},{"noteOn":{"time":14.665,"note":102.000,"xyz":[-16.090,314.000,-34.160]}},{"noteOn":{"time":15.235,"note":96.000,"xyz":[182.467,242.000,227.837]}},{"noteOn":{"time":15.275,"note":96.000,"xyz":[-497.026,242.000,10.470]}},{"noteOn":{"time":15.850,"note":94.000,"xyz":[-54.075,218.000,-357.634]}},{"noteOn":{"time":16.060,"note":98.000,"xyz":[-1.145,266.000,-30.693]}},{"noteOn":{"time":16.380,"note":102.000,"xyz":[1.949,314.000,0.948]}},{"noteOn":{"time":17.025,"note":96.000,"xyz":[-103.469,242.000,230.580]}},{"noteOn":{"time":17.320,"note":101.000,"xyz":[58.743,302.000,-75.016]}},{"noteOn":{"time":17.885,"note":94.000,"xyz":[-46.808,218.000,380.283]}},{"noteOn":{"time":18.175,"note":95.000,"xyz":[-117.947,230.000,-81.754]}},{"noteOn":{"time":18.575,"note":104.000,"xyz":[-49.916,338.000,142.659]}},{"noteOn":{"time":18.910,"note":97.000,"xyz":[-134.030,254.000,72.721]}},{"noteOn":{"time":19.085,"note":102.000,"xyz":[-290.972,314.000,24.211]}},{"noteOn":{"time":19.730,"note":95.000,"xyz":[73.827,230.000,-149.161]}},{"noteOn":{"time":19.750,"note":96.000,"xyz":[129.607,242.000,-339.047]}},{"noteOn":{"time":20.325,"note":93.000,"xyz":[88.854,206.000,-0.543]}},{"noteOn":{"time":20.590,"note":99.000,"xyz":[-15.217,278.000,-0.697]}},{"noteOn":{"time":20.830,"note":103.000,"xyz":[152.444,326.000,-7.273]}},{"noteOn":{"time":20.970,"note":99.000,"xyz":[70.659,278.000,-183.289]}},{"noteOn":{"time":21.575,"note":95.000,"xyz":[372.663,230.000,-253.561]}},{"noteOn":{"time":21.640,"note":97.000,"xyz":[-103.997,254.000,79.182]}},{"noteOn":{"time":21.750,"note":101.000,"xyz":[-258.962,302.000,-197.763]}},{"noteOn":{"time":22.205,"note":103.000,"xyz":[198.533,326.000,-93.751]}},{"noteOn":{"time":22.385,"note":93.000,"xyz":[-176.632,206.000,-394.026]}},{"noteOn":{"time":22.585,"note":96.000,"xyz":[-477.990,242.000,103.166]}},{"noteOn":{"time":22.910,"note":105.000,"xyz":[118.168,350.000,-466.740]}},{"noteOn":{"time":23.015,"note":103.000,"xyz":[-54.631,326.000,124.074]}},{"noteOn":{"time":23.340,"note":98.000,"xyz":[-100.188,266.000,267.895]}},{"noteOn":{"time":23.445,"note":95.000,"xyz":[-214.570,230.000,296.250]}},{"noteOn":{"time":23.560,"note":101.000,"xyz":[222.535,302.000,-214.692]}},{"noteOn":{"time":24.175,"note":97.000,"xyz":[10.647,254.000,465.502]}},{"noteOn":{"time":24.185,"note":94.000,"xyz":[-189.711,218.000,236.003]}},{"noteOn":{"time":24.280,"note":97.000,"xyz":[-69.462,254.000,-439.571]}},{"noteOn":{"time":24.680,"note":99.000,"xyz":[-181.076,278.000,109.272]}},{"noteOn":{"time":24.755,"note":92.000,"xyz":[249.680,194.000,-2.747]}},{"noteOn":{"time":25.175,"note":99.000,"xyz":[250.248,278.000,9.261]}},{"noteOn":{"time":25.270,"note":102.000,"xyz":[-302.189,314.000,266.736]}},{"noteOn":{"time":25.440,"note":97.000,"xyz":[166.486,254.000,306.066]}},{"noteOn":{"time":25.965,"note":104.000,"xyz":[-6.939,338.000,67.067]}},{"noteOn":{"time":26.105,"note":94.000,"xyz":[-121.995,218.000,-300.884]}},{"noteOn":{"time":26.170,"note":100.000,"xyz":[285.845,290.000,-360.552]}},{"noteOn":{"time":26.755,"note":104.000,"xyz":[173.344,338.000,-188.960]}},{"noteOn":{"time":26.860,"note":92.000,"xyz":[-233.199,194.000,253.267]}},{"noteOn":{"time":26.980,"note":96.000,"xyz":[-44.925,242.000,-269.899]}},{"noteOn":{"time":27.310,"note":96.000,"xyz":[268.295,242.000,322.436]}},{"noteOn":{"time":27.435,"note":102.000,"xyz":[0.729,314.000,-15.009]}},{"noteOn":{"time":27.760,"note":98.000,"xyz":[3.096,266.000,-0.785]}},{"noteOn":{"time":28.005,"note":94.000,"xyz":[-426.426,218.000,-219.783]}},{"noteOn":{"time":28.035,"note":100.000,"xyz":[308.835,290.000,-81.226]}},{"noteOn":{"time":28.125,"note":98.000,"xyz":[63.097,266.000,28.144]}},{"noteOn":{"time":28.625,"note":93.000,"xyz":[75.742,206.000,-126.783]}},{"noteOn":{"time":28.710,"note":98.000,"xyz":[-273.751,266.000,322.404]}},{"noteOn":{"time":28.750,"note":92.000,"xyz":[21.326,194.000,-458.988]}},{"noteOn":{"time":28.810,"note":98.000,"xyz":[-110.667,266.000,-417.334]}},{"noteOn":{"time":29.175,"note":91.000,"xyz":[41.907,182.000,114.565]}},{"noteOn":{"time":29.510,"note":102.000,"xyz":[-25.968,314.000,45.330]}},{"noteOn":{"time":29.555,"note":96.000,"xyz":[-61.544,242.000,176.120]}},{"noteOn":{"time":29.710,"note":101.000,"xyz":[111.844,302.000,37.234]}},{"noteOn":{"time":29.760,"note":100.000,"xyz":[290.035,290.000,221.207]}},{"noteOn":{"time":30.170,"note":104.000,"xyz":[-233.046,338.000,-47.361]}},{"noteOn":{"time":30.250,"note":100.000,"xyz":[331.080,290.000,-284.060]}},{"noteOn":{"time":30.585,"note":99.000,"xyz":[259.187,278.000,-99.183]}},{"noteOn":{"time":30.635,"note":94.000,"xyz":[55.849,218.000,-139.714]}},{"noteOn":{"time":31.015,"note":95.000,"xyz":[78.857,230.000,-56.691]}},{"noteOn":{"time":31.045,"note":103.000,"xyz":[-179.269,326.000,-43.139]}},{"noteOn":{"time":31.335,"note":92.000,"xyz":[102.916,194.000,113.126]}},{"noteOn":{"time":31.375,"note":97.000,"xyz":[-361.868,254.000,154.096]}},{"noteOn":{"time":31.685,"note":97.000,"xyz":[84.166,254.000,-35.004]}},{"noteOn":{"time":31.750,"note":97.000,"xyz":[18.019,254.000,-34.384]}},{"noteOn":{"time":31.855,"note":101.000,"xyz":[49.103,302.000,-29.276]}},{"noteOn":{"time":32.175,"note":99.000,"xyz":[354.803,278.000,-35.495]}},{"noteOn":{"time":32.510,"note":99.000,"xyz":[271.357,278.000,360.001]}},{"noteOn":{"time":32.515,"note":93.000,"xyz":[244.638,206.000,290.144]}},{"noteOn":{"time":32.590,"note":99.000,"xyz":[226.610,278.000,-100.752]}},{"noteOn":{"time":33.060,"note":93.000,"xyz":[55.705,206.000,180.094]}},{"noteOn":{"time":33.250,"note":91.000,"xyz":[-40.745,182.000,77.114]}},{"noteOn":{"time":33.260,"note":97.000,"xyz":[-37.963,254.000,-20.536]}},{"noteOn":{"time":33.340,"note":99.000,"xyz":[-151.659,278.000,64.984]}},{"noteOn":{"time":33.590,"note":92.000,"xyz":[1.357,194.000,-373.228]}},{"noteOn":{"time":34.020,"note":101.000,"xyz":[218.933,302.000,-151.709]}},{"noteOn":{"time":34.040,"note":101.000,"xyz":[-8.635,302.000,175.374]}},{"noteOn":{"time":34.150,"note":100.000,"xyz":[-113.120,290.000,-57.624]}},{"noteOn":{"time":34.195,"note":95.000,"xyz":[-19.344,230.000,-286.649]}},{"noteOn":{"time":34.335,"note":101.000,"xyz":[-106.436,302.000,475.653]}},{"noteOn":{"time":34.730,"note":99.000,"xyz":[1.983,278.000,36.273]}},{"noteOn":{"time":34.745,"note":99.000,"xyz":[220.253,278.000,54.213]}},{"noteOn":{"time":34.895,"note":105.000,"xyz":[139.347,350.000,-103.994]}},{"noteOn":{"time":35.005,"note":98.000,"xyz":[40.010,266.000,65.339]}},{"noteOn":{"time":35.155,"note":93.000,"xyz":[76.963,206.000,74.951]}},{"noteOn":{"time":35.520,"note":95.000,"xyz":[174.663,230.000,203.346]}},{"noteOn":{"time":35.560,"note":103.000,"xyz":[439.259,326.000,-220.877]}},{"noteOn":{"time":35.770,"note":98.000,"xyz":[57.622,266.000,161.479]}},{"noteOn":{"time":35.800,"note":93.000,"xyz":[-38.252,206.000,-8.728]}},{"noteOn":{"time":35.860,"note":103.000,"xyz":[-45.141,326.000,-215.188]}},{"noteOn":{"time":36.245,"note":98.000,"xyz":[205.812,266.000,8.947]}},{"noteOn":{"time":36.330,"note":101.000,"xyz":[395.118,302.000,-21.781]}},{"noteOn":{"time":36.540,"note":105.000,"xyz":[1.887,350.000,-48.710]}},{"noteOn":{"time":36.590,"note":97.000,"xyz":[-261.341,254.000,-136.600]}},{"noteOn":{"time":36.590,"note":100.000,"xyz":[121.354,290.000,-165.080]}},{"noteOn":{"time":37.025,"note":92.000,"xyz":[92.678,194.000,-75.566]}},{"noteOn":{"time":37.040,"note":98.000,"xyz":[37.165,266.000,-14.288]}},{"noteOn":{"time":37.415,"note":95.000,"xyz":[-83.954,230.000,-366.742]}},{"noteOn":{"time":37.495,"note":92.000,"xyz":[-155.366,194.000,97.901]}},{"noteOn":{"time":37.585,"note":100.000,"xyz":[-340.905,290.000,86.442]}},{"noteOn":{"time":37.745,"note":90.000,"xyz":[-249.999,170.000,-200.159]}},{"noteOn":{"time":37.925,"note":100.000,"xyz":[-137.994,290.000,37.114]}},{"noteOn":{"time":38.005,"note":92.000,"xyz":[-419.998,194.000,-24.549]}},{"noteOn":{"time":38.145,"note":97.000,"xyz":[110.569,254.000,424.931]}},{"noteOn":{"time":38.340,"note":96.000,"xyz":[355.830,242.000,242.524]}},{"noteOn":{"time":38.525,"note":100.000,"xyz":[-67.094,290.000,362.939]}},{"noteOn":{"time":38.585,"note":100.000,"xyz":[12.857,290.000,28.973]}},{"noteOn":{"time":38.725,"note":101.000,"xyz":[232.872,302.000,250.838]}},{"noteOn":{"time":38.865,"note":102.000,"xyz":[-142.708,314.000,-153.036]}},{"noteOn":{"time":39.245,"note":98.000,"xyz":[-8.331,266.000,5.088]}},{"noteOn":{"time":39.290,"note":98.000,"xyz":[359.323,266.000,122.069]}},{"noteOn":{"time":39.320,"note":94.000,"xyz":[-415.855,218.000,6.981]}},{"noteOn":{"time":39.420,"note":97.000,"xyz":[59.529,254.000,351.843]}},{"noteOn":{"time":39.630,"note":92.000,"xyz":[149.352,194.000,-232.839]}},{"noteOn":{"time":40.005,"note":104.000,"xyz":[-206.221,338.000,441.573]}},{"noteOn":{"time":40.030,"note":96.000,"xyz":[224.949,242.000,51.995]}},{"noteOn":{"time":40.110,"note":104.000,"xyz":[-385.393,338.000,-41.409]}},{"noteOn":{"time":40.165,"note":99.000,"xyz":[84.657,278.000,-21.435]}},{"noteOn":{"time":40.220,"note":94.000,"xyz":[239.890,218.000,-279.319]}},{"noteOn":{"time":40.310,"note":92.000,"xyz":[93.684,194.000,12.815]}},{"noteOn":{"time":40.740,"note":98.000,"xyz":[-154.296,266.000,-435.278]}},{"noteOn":{"time":40.810,"note":100.000,"xyz":[-251.476,290.000,-213.000]}},{"noteOn":{"time":40.865,"note":106.000,"xyz":[-327.426,362.000,-159.702]}},{"noteOn":{"time":41.010,"note":101.000,"xyz":[-49.430,302.000,47.910]}},{"noteOn":{"time":41.055,"note":102.000,"xyz":[239.258,314.000,58.247]}},{"noteOn":{"time":41.210,"note":90.000,"xyz":[-19.867,170.000,72.633]}},{"noteOn":{"time":41.530,"note":92.000,"xyz":[-6.013,194.000,-185.330]}},{"noteOn":{"time":41.570,"note":98.000,"xyz":[121.086,266.000,-372.870]}},{"noteOn":{"time":41.720,"note":100.000,"xyz":[45.144,290.000,-21.270]}},{"noteOn":{"time":41.860,"note":96.000,"xyz":[46.666,242.000,-437.968]}},{"noteOn":{"time":41.875,"note":98.000,"xyz":[-81.691,266.000,452.627]}},{"noteOn":{"time":41.935,"note":91.000,"xyz":[158.330,182.000,311.826]}},{"noteOn":{"time":42.240,"note":91.000,"xyz":[-123.653,182.000,-24.063]}},{"noteOn":{"time":42.300,"note":98.000,"xyz":[-187.812,266.000,433.671]}},{"noteOn":{"time":42.450,"note":93.000,"xyz":[75.708,206.000,245.970]}},{"noteOn":{"time":42.510,"note":100.000,"xyz":[-163.457,290.000,-188.042]}},{"noteOn":{"time":42.710,"note":98.000,"xyz":[32.597,266.000,140.118]}},{"noteOn":{"time":42.795,"note":100.000,"xyz":[13.353,290.000,2.622]}},{"noteOn":{"time":43.035,"note":99.000,"xyz":[-129.064,278.000,34.396]}},{"noteOn":{"time":43.055,"note":99.000,"xyz":[30.094,278.000,-297.403]}},{"noteOn":{"time":43.130,"note":94.000,"xyz":[51.955,218.000,-457.898]}},{"noteOn":{"time":43.395,"note":103.000,"xyz":[153.687,326.000,-33.859]}},{"noteOn":{"time":43.410,"note":100.000,"xyz":[313.663,290.000,-271.079]}},{"noteOn":{"time":43.640,"note":95.000,"xyz":[231.579,230.000,-190.505]}},{"noteOn":{"time":43.740,"note":97.000,"xyz":[458.857,254.000,40.200]}},{"noteOn":{"time":43.865,"note":97.000,"xyz":[10.670,254.000,-29.925]}},{"noteOn":{"time":43.870,"note":97.000,"xyz":[-26.915,254.000,-9.149]}},{"noteOn":{"time":43.965,"note":98.000,"xyz":[-182.191,266.000,-39.427]}},{"noteOn":{"time":44.110,"note":93.000,"xyz":[245.135,206.000,-219.226]}},{"noteOn":{"time":44.530,"note":93.000,"xyz":[175.644,206.000,-157.320]}},{"noteOn":{"time":44.540,"note":97.000,"xyz":[-269.975,254.000,-175.268]}},{"noteOn":{"time":44.560,"note":105.000,"xyz":[-48.582,350.000,-69.638]}},{"noteOn":{"time":44.590,"note":100.000,"xyz":[-89.521,290.000,271.100]}},{"noteOn":{"time":44.645,"note":95.000,"xyz":[139.623,230.000,410.298]}},{"noteOn":{"time":44.725,"note":91.000,"xyz":[-88.259,182.000,-450.168]}},{"noteOn":{"time":45.240,"note":99.000,"xyz":[18.740,278.000,176.655]}},{"noteOn":{"time":45.285,"note":99.000,"xyz":[-4.563,278.000,400.235]}},{"noteOn":{"time":45.295,"note":105.000,"xyz":[-30.959,350.000,-184.854]}},{"noteOn":{"time":45.410,"note":103.000,"xyz":[5.981,326.000,-63.776]}},{"noteOn":{"time":45.455,"note":102.000,"xyz":[67.545,314.000,278.472]}},{"noteOn":{"time":45.670,"note":89.000,"xyz":[237.114,158.000,-82.041]}},{"noteOn":{"time":46.045,"note":91.000,"xyz":[163.646,182.000,209.354]}},{"noteOn":{"time":46.105,"note":97.000,"xyz":[-423.972,254.000,-155.696]}},{"noteOn":{"time":46.180,"note":97.000,"xyz":[33.824,254.000,211.037]}},{"noteOn":{"time":46.205,"note":99.000,"xyz":[-83.107,278.000,-291.420]}},{"noteOn":{"time":46.270,"note":101.000,"xyz":[-207.389,302.000,187.146]}},{"noteOn":{"time":46.405,"note":92.000,"xyz":[361.128,194.000,143.311]}},{"noteOn":{"time":46.425,"note":103.000,"xyz":[-3.963,326.000,2.251]}},{"noteOn":{"time":46.740,"note":91.000,"xyz":[-20.831,182.000,20.734]}},{"noteOn":{"time":46.830,"note":97.000,"xyz":[112.876,254.000,18.618]}},{"noteOn":{"time":46.940,"note":94.000,"xyz":[-412.536,218.000,147.691]}},{"noteOn":{"time":47.095,"note":101.000,"xyz":[-251.199,302.000,338.707]}},{"noteOn":{"time":47.150,"note":99.000,"xyz":[227.077,278.000,-312.249]}},{"noteOn":{"time":47.175,"note":99.000,"xyz":[254.194,278.000,-87.816]}},{"noteOn":{"time":47.380,"note":101.000,"xyz":[97.042,302.000,51.715]}},{"noteOn":{"time":47.545,"note":98.000,"xyz":[47.878,266.000,-18.654]}},{"noteOn":{"time":47.565,"note":98.000,"xyz":[-263.063,266.000,-332.791]}},{"noteOn":{"time":47.615,"note":95.000,"xyz":[-72.209,230.000,314.767]}},{"noteOn":{"time":47.930,"note":103.000,"xyz":[107.568,326.000,-22.786]}},{"noteOn":{"time":47.975,"note":99.000,"xyz":[48.252,278.000,33.947]}},{"noteOn":{"time":47.985,"note":103.000,"xyz":[-390.818,326.000,-55.043]}},{"noteOn":{"time":48.005,"note":101.000,"xyz":[-230.082,302.000,-306.663]}},{"noteOn":{"time":48.240,"note":96.000,"xyz":[90.236,242.000,-129.524]}},{"noteOn":{"time":48.310,"note":97.000,"xyz":[-229.401,254.000,-178.178]}},{"noteOn":{"time":48.355,"note":96.000,"xyz":[232.161,242.000,296.126]}},{"noteOn":{"time":48.585,"note":94.000,"xyz":[-202.491,218.000,447.055]}},{"noteOn":{"time":48.645,"note":105.000,"xyz":[354.650,350.000,-232.545]}},{"noteOn":{"time":48.650,"note":97.000,"xyz":[-471.720,254.000,95.211]}},{"noteOn":{"time":48.940,"note":95.000,"xyz":[-48.352,230.000,-2.098]}},{"noteOn":{"time":49.050,"note":98.000,"xyz":[-5.187,266.000,-84.660]}},{"noteOn":{"time":49.060,"note":100.000,"xyz":[-141.007,290.000,-259.118]}},{"noteOn":{"time":49.105,"note":96.000,"xyz":[-48.646,242.000,-496.416]}},{"noteOn":{"time":49.185,"note":105.000,"xyz":[201.981,350.000,-303.581]}},{"noteOn":{"time":49.205,"note":91.000,"xyz":[243.171,182.000,-58.047]}},{"noteOn":{"time":49.430,"note":95.000,"xyz":[-8.978,230.000,-274.683]}},{"noteOn":{"time":49.740,"note":100.000,"xyz":[-50.859,290.000,148.515]}},{"noteOn":{"time":49.745,"note":93.000,"xyz":[12.225,206.000,21.298]}},{"noteOn":{"time":49.800,"note":105.000,"xyz":[-106.138,350.000,29.703]}},{"noteOn":{"time":49.805,"note":98.000,"xyz":[-254.651,266.000,410.311]}},{"noteOn":{"time":49.945,"note":102.000,"xyz":[208.247,314.000,159.953]}},{"noteOn":{"time":50.155,"note":98.000,"xyz":[-126.476,266.000,-185.128]}},{"noteOn":{"time":50.195,"note":90.000,"xyz":[119.613,170.000,-299.888]}},{"noteOn":{"time":50.555,"note":90.000,"xyz":[115.911,170.000,-284.506]}},{"noteOn":{"time":50.565,"note":98.000,"xyz":[130.531,266.000,-142.000]}},{"noteOn":{"time":50.675,"note":96.000,"xyz":[-132.442,242.000,327.189]}},{"noteOn":{"time":50.710,"note":102.000,"xyz":[254.756,314.000,160.119]}},{"noteOn":{"time":50.775,"note":98.000,"xyz":[277.165,266.000,-298.315]}},{"noteOn":{"time":50.915,"note":93.000,"xyz":[22.104,206.000,-400.624]}},{"noteOn":{"time":50.990,"note":102.000,"xyz":[335.823,314.000,138.269]}},{"noteOn":{"time":51.240,"note":92.000,"xyz":[-111.528,194.000,-349.495]}},{"noteOn":{"time":51.450,"note":96.000,"xyz":[362.991,242.000,-167.218]}},{"noteOn":{"time":51.475,"note":95.000,"xyz":[-344.790,230.000,219.745]}},{"noteOn":{"time":51.475,"note":100.000,"xyz":[-30.123,290.000,-212.138]}},{"noteOn":{"time":51.480,"note":100.000,"xyz":[14.907,290.000,-207.249]}},{"noteOn":{"time":51.630,"note":102.000,"xyz":[25.252,314.000,-154.835]}},{"noteOn":{"time":51.825,"note":90.000,"xyz":[-387.718,170.000,186.787]}},{"noteOn":{"time":51.880,"note":100.000,"xyz":[120.060,290.000,-372.801]}},{"noteOn":{"time":52.060,"note":98.000,"xyz":[-41.971,266.000,-84.772]}},{"noteOn":{"time":52.120,"note":97.000,"xyz":[-291.315,254.000,-55.093]}},{"noteOn":{"time":52.190,"note":96.000,"xyz":[-365.809,242.000,-234.665]}},{"noteOn":{"time":52.370,"note":88.000,"xyz":[-18.157,146.000,138.315]}},{"noteOn":{"time":52.410,"note":104.000,"xyz":[-473.865,338.000,-48.274]}},{"noteOn":{"time":52.420,"note":98.000,"xyz":[53.279,266.000,30.917]}},{"noteOn":{"time":52.430,"note":104.000,"xyz":[41.850,338.000,-23.790]}},{"noteOn":{"time":52.475,"note":100.000,"xyz":[145.212,290.000,44.512]}},{"noteOn":{"time":52.740,"note":96.000,"xyz":[102.121,242.000,-142.455]}},{"noteOn":{"time":52.835,"note":98.000,"xyz":[-147.113,266.000,-368.046]}},{"noteOn":{"time":52.890,"note":95.000,"xyz":[-299.246,230.000,-157.478]}},{"noteOn":{"time":52.935,"note":106.000,"xyz":[121.269,362.000,27.586]}},{"noteOn":{"time":53.010,"note":94.000,"xyz":[-16.466,218.000,-13.134]}},{"noteOn":{"time":53.090,"note":98.000,"xyz":[-106.854,266.000,-152.021]}},{"noteOn":{"time":53.215,"note":96.000,"xyz":[-147.719,242.000,42.483]}},{"noteOn":{"time":53.220,"note":102.000,"xyz":[-90.033,314.000,-127.134]}},{"noteOn":{"time":53.560,"note":99.000,"xyz":[-323.986,278.000,271.857]}},{"noteOn":{"time":53.570,"note":101.000,"xyz":[-164.779,302.000,-116.369]}},{"noteOn":{"time":53.585,"note":96.000,"xyz":[211.725,242.000,-194.799]}},{"noteOn":{"time":53.780,"note":90.000,"xyz":[87.170,170.000,115.521]}},{"noteOn":{"time":53.870,"note":106.000,"xyz":[320.291,362.000,339.857]}},{"noteOn":{"time":53.875,"note":96.000,"xyz":[477.902,242.000,4.982]}},{"noteOn":{"time":53.995,"note":96.000,"xyz":[357.973,242.000,186.979]}},{"noteOn":{"time":54.195,"note":94.000,"xyz":[-130.151,218.000,411.983]}},{"noteOn":{"time":54.240,"note":101.000,"xyz":[212.265,302.000,-152.354]}},{"noteOn":{"time":54.335,"note":97.000,"xyz":[-345.846,254.000,233.171]}},{"noteOn":{"time":54.375,"note":104.000,"xyz":[-64.969,338.000,235.860]}},{"noteOn":{"time":54.475,"note":103.000,"xyz":[-25.191,326.000,-75.503]}},{"noteOn":{"time":54.745,"note":90.000,"xyz":[-119.787,170.000,-373.792]}},{"noteOn":{"time":54.755,"note":98.000,"xyz":[-56.332,266.000,-52.944]}},{"noteOn":{"time":54.910,"note":94.000,"xyz":[168.695,218.000,240.663]}},{"noteOn":{"time":54.915,"note":94.000,"xyz":[277.561,218.000,3.859]}},{"noteOn":{"time":55.015,"note":98.000,"xyz":[86.187,266.000,-459.304]}},{"noteOn":{"time":55.065,"note":91.000,"xyz":[-158.938,182.000,-142.372]}},{"noteOn":{"time":55.265,"note":95.000,"xyz":[-83.833,230.000,166.824]}},{"noteOn":{"time":55.370,"note":97.000,"xyz":[33.092,254.000,21.839]}},{"noteOn":{"time":55.435,"note":102.000,"xyz":[277.024,314.000,183.102]}},{"noteOn":{"time":55.470,"note":93.000,"xyz":[-112.509,206.000,-245.772]}},{"noteOn":{"time":55.655,"note":96.000,"xyz":[-134.654,242.000,233.583]}},{"noteOn":{"time":55.735,"note":93.000,"xyz":[-114.788,206.000,-394.048]}},{"noteOn":{"time":55.805,"note":101.000,"xyz":[42.630,302.000,-201.117]}},{"noteOn":{"time":55.860,"note":102.000,"xyz":[80.379,314.000,110.941]}},{"noteOn":{"time":56.050,"note":96.000,"xyz":[300.268,242.000,202.809]}},{"noteOn":{"time":56.090,"note":95.000,"xyz":[12.122,230.000,-102.326]}},{"noteOn":{"time":56.165,"note":103.000,"xyz":[-28.307,326.000,-70.034]}},{"noteOn":{"time":56.170,"note":99.000,"xyz":[101.204,278.000,59.025]}},{"noteOn":{"time":56.215,"note":89.000,"xyz":[-196.880,158.000,-319.811]}},{"noteOn":{"time":56.545,"note":99.000,"xyz":[37.602,278.000,10.680]}},{"noteOn":{"time":56.565,"note":97.000,"xyz":[-211.922,254.000,-254.397]}},{"noteOn":{"time":56.715,"note":96.000,"xyz":[-36.293,242.000,181.540]}},{"noteOn":{"time":56.740,"note":97.000,"xyz":[69.901,254.000,-37.480]}},{"noteOn":{"time":56.785,"note":97.000,"xyz":[-357.032,254.000,284.877]}},{"noteOn":{"time":56.835,"note":89.000,"xyz":[-73.242,158.000,228.853]}},{"noteOn":{"time":56.880,"note":105.000,"xyz":[98.731,350.000,-195.367]}},{"noteOn":{"time":56.885,"note":103.000,"xyz":[161.176,326.000,-400.153]}},{"noteOn":{"time":57.235,"note":95.000,"xyz":[-307.893,230.000,105.179]}},{"noteOn":{"time":57.385,"note":99.000,"xyz":[215.359,278.000,435.709]}},{"noteOn":{"time":57.435,"note":95.000,"xyz":[6.360,230.000,32.124]}},{"noteOn":{"time":57.465,"note":94.000,"xyz":[1.808,218.000,17.311]}},{"noteOn":{"time":57.465,"note":101.000,"xyz":[-390.135,302.000,216.847]}},{"noteOn":{"time":57.530,"note":107.000,"xyz":[127.596,374.000,-33.341]}},{"noteOn":{"time":57.635,"note":97.000,"xyz":[-16.469,254.000,-152.212]}},{"noteOn":{"time":57.660,"note":95.000,"xyz":[184.926,230.000,-152.262]}},{"noteOn":{"time":58.065,"note":97.000,"xyz":[-53.482,254.000,-263.152]}},{"noteOn":{"time":58.070,"note":99.000,"xyz":[210.824,278.000,-418.911]}},{"noteOn":{"time":58.125,"note":103.000,"xyz":[413.414,326.000,-13.562]}},{"noteOn":{"time":58.125,"note":102.000,"xyz":[-46.955,314.000,66.460]}},{"noteOn":{"time":58.375,"note":89.000,"xyz":[-10.826,158.000,-24.899]}},{"noteOn":{"time":58.435,"note":105.000,"xyz":[-350.443,350.000,137.651]}},{"noteOn":{"time":58.440,"note":97.000,"xyz":[54.170,254.000,19.758]}},{"noteOn":{"time":58.615,"note":95.000,"xyz":[186.650,230.000,263.520]}},{"noteOn":{"time":58.735,"note":102.000,"xyz":[-439.519,314.000,-193.015]}},{"noteOn":{"time":58.870,"note":97.000,"xyz":[386.580,254.000,-33.310]}},{"noteOn":{"time":59.015,"note":93.000,"xyz":[80.007,206.000,145.869]}},{"noteOn":{"time":59.055,"note":102.000,"xyz":[-254.420,314.000,-114.690]}},{"noteOn":{"time":59.060,"note":103.000,"xyz":[110.848,326.000,55.331]}},{"noteOn":{"time":59.295,"note":91.000,"xyz":[85.596,182.000,334.311]}},{"noteOn":{"time":59.405,"note":99.000,"xyz":[-320.861,278.000,-193.044]}},{"noteOn":{"time":59.455,"note":95.000,"xyz":[-175.008,230.000,94.599]}},{"noteOn":{"time":59.570,"note":92.000,"xyz":[350.484,194.000,-140.412]}},{"noteOn":{"time":59.585,"note":99.000,"xyz":[-7.051,278.000,96.145]}},{"noteOn":{"time":59.640,"note":95.000,"xyz":[401.386,230.000,130.916]}},{"noteOn":{"time":59.855,"note":94.000,"xyz":[-90.333,218.000,98.666]}},{"noteOn":{"time":59.870,"note":105.000,"xyz":[393.788,350.000,79.675]}},{"noteOn":{"time":59.930,"note":101.000,"xyz":[346.522,302.000,-42.311]}},{"noteOn":{"time":59.965,"note":97.000,"xyz":[69.010,254.000,242.336]}},{"noteOn":{"time":60.040,"note":94.000,"xyz":[115.124,218.000,135.248]}},{"noteOn":{"time":60.115,"note":97.000,"xyz":[56.163,254.000,269.827]}},{"noteOn":{"time":60.235,"note":94.000,"xyz":[100.237,218.000,-393.381]}},{"noteOn":{"time":60.250,"note":101.000,"xyz":[-402.914,302.000,233.880]}},{"noteOn":{"time":60.470,"note":103.000,"xyz":[-123.598,326.000,-2.691]}},{"noteOn":{"time":60.505,"note":101.000,"xyz":[-365.857,302.000,-238.916]}},{"noteOn":{"time":60.510,"note":99.000,"xyz":[123.745,278.000,-17.476]}},{"noteOn":{"time":60.635,"note":89.000,"xyz":[-38.617,158.000,-87.716]}},{"noteOn":{"time":60.640,"note":96.000,"xyz":[-178.412,242.000,83.407]}},{"noteOn":{"time":60.695,"note":104.000,"xyz":[-360.584,338.000,-144.412]}},{"noteOn":{"time":60.730,"note":95.000,"xyz":[80.422,230.000,-40.623]}},{"noteOn":{"time":61.065,"note":97.000,"xyz":[205.184,254.000,123.430]}},{"noteOn":{"time":61.075,"note":96.000,"xyz":[128.163,242.000,93.078]}},{"noteOn":{"time":61.100,"note":99.000,"xyz":[195.461,278.000,220.359]}},{"noteOn":{"time":61.330,"note":96.000,"xyz":[-86.864,242.000,36.893]}},{"noteOn":{"time":61.335,"note":89.000,"xyz":[27.455,158.000,282.012]}},{"noteOn":{"time":61.340,"note":103.000,"xyz":[180.022,326.000,-48.527]}},{"noteOn":{"time":61.365,"note":102.000,"xyz":[104.671,314.000,214.248]}},{"noteOn":{"time":61.370,"note":105.000,"xyz":[-88.471,350.000,-125.674]}},{"noteOn":{"time":61.375,"note":98.000,"xyz":[-5.325,266.000,5.902]}},{"noteOn":{"time":61.730,"note":94.000,"xyz":[79.472,218.000,24.946]}},{"noteOn":{"time":61.875,"note":96.000,"xyz":[-14.612,242.000,-3.184]}},{"noteOn":{"time":61.935,"note":101.000,"xyz":[130.028,302.000,388.815]}},{"noteOn":{"time":61.935,"note":100.000,"xyz":[-33.679,290.000,-3.307]}},{"noteOn":{"time":62.000,"note":105.000,"xyz":[-47.468,350.000,-459.397]}},{"noteOn":{"time":62.025,"note":94.000,"xyz":[172.441,218.000,433.073]}},{"noteOn":{"time":62.055,"note":93.000,"xyz":[89.517,206.000,-389.258]}},{"noteOn":{"time":62.175,"note":106.000,"xyz":[155.308,362.000,93.050]}},{"noteOn":{"time":62.215,"note":96.000,"xyz":[-41.081,242.000,-210.086]}},{"noteOn":{"time":62.500,"note":104.000,"xyz":[4.465,338.000,-1.357]}},{"noteOn":{"time":62.560,"note":98.000,"xyz":[256.144,266.000,-118.101]}},{"noteOn":{"time":62.575,"note":100.000,"xyz":[306.341,290.000,297.633]}},{"noteOn":{"time":62.695,"note":103.000,"xyz":[-59.675,326.000,-143.029]}},{"noteOn":{"time":62.810,"note":96.000,"xyz":[-54.600,242.000,8.670]}},{"noteOn":{"time":62.905,"note":90.000,"xyz":[266.961,170.000,-0.272]}},{"noteOn":{"time":62.920,"note":104.000,"xyz":[-241.831,338.000,-164.799]}},{"noteOn":{"time":62.930,"note":98.000,"xyz":[387.606,266.000,-121.544]}},{"noteOn":{"time":63.155,"note":94.000,"xyz":[61.099,218.000,-329.969]}},{"noteOn":{"time":63.230,"note":102.000,"xyz":[-48.180,314.000,-64.731]}},{"noteOn":{"time":63.305,"note":94.000,"xyz":[-62.583,218.000,-68.401]}},{"noteOn":{"time":63.420,"note":96.000,"xyz":[104.996,242.000,-128.474]}},{"noteOn":{"time":63.535,"note":98.000,"xyz":[-223.016,266.000,391.653]}},{"noteOn":{"time":63.645,"note":101.000,"xyz":[-204.838,302.000,402.714]}},{"noteOn":{"time":63.670,"note":102.000,"xyz":[8.089,314.000,132.125]}},{"noteOn":{"time":63.745,"note":100.000,"xyz":[-100.840,290.000,-115.687]}},{"noteOn":{"time":63.780,"note":92.000,"xyz":[-326.356,194.000,-309.305]}},{"noteOn":{"time":63.845,"note":96.000,"xyz":[210.766,242.000,-80.735]}},{"noteOn":{"time":63.920,"note":96.000,"xyz":[36.811,242.000,4.872]}},{"noteOn":{"time":64.080,"note":92.000,"xyz":[131.120,194.000,-88.564]}},{"noteOn":{"time":64.270,"note":100.000,"xyz":[80.072,290.000,62.223]}},{"noteOn":{"time":64.280,"note":104.000,"xyz":[-304.118,338.000,-77.358]}},{"noteOn":{"time":64.375,"note":100.000,"xyz":[20.820,290.000,-28.222]}},{"noteOn":{"time":64.385,"note":94.000,"xyz":[-140.421,218.000,-161.973]}},{"noteOn":{"time":64.495,"note":96.000,"xyz":[-134.316,242.000,-230.768]}},{"noteOn":{"time":64.505,"note":98.000,"xyz":[-1.583,266.000,-357.236]}},{"noteOn":{"time":64.610,"note":95.000,"xyz":[-42.559,230.000,-137.623]}},{"noteOn":{"time":64.620,"note":100.000,"xyz":[76.313,290.000,4.015]}},{"noteOn":{"time":64.730,"note":95.000,"xyz":[387.156,230.000,7.965]}},{"noteOn":{"time":64.815,"note":102.000,"xyz":[44.579,314.000,-35.965]}},{"noteOn":{"time":64.950,"note":98.000,"xyz":[-323.021,266.000,-57.967]}},{"noteOn":{"time":65.065,"note":102.000,"xyz":[179.000,314.000,-212.837]}},{"noteOn":{"time":65.100,"note":88.000,"xyz":[185.793,146.000,80.798]}},{"noteOn":{"time":65.130,"note":98.000,"xyz":[-127.130,266.000,-254.080]}},{"noteOn":{"time":65.175,"note":104.000,"xyz":[126.795,338.000,-295.355]}},{"noteOn":{"time":65.235,"note":97.000,"xyz":[194.214,254.000,-36.592]}},{"noteOn":{"time":65.305,"note":94.000,"xyz":[-391.794,218.000,266.533]}},{"noteOn":{"time":65.510,"note":96.000,"xyz":[109.039,242.000,165.285]}},{"noteOn":{"time":65.585,"note":95.000,"xyz":[-367.484,230.000,234.769]}},{"noteOn":{"time":65.750,"note":104.000,"xyz":[154.484,338.000,-2.145]}},{"noteOn":{"time":65.790,"note":101.000,"xyz":[89.305,302.000,18.020]}},{"noteOn":{"time":65.875,"note":102.000,"xyz":[-78.525,314.000,-199.860]}},{"noteOn":{"time":65.880,"note":90.000,"xyz":[131.115,170.000,-278.155]}},{"noteOn":{"time":65.905,"note":98.000,"xyz":[-26.705,266.000,214.806]}},{"noteOn":{"time":65.935,"note":106.000,"xyz":[-56.562,362.000,-13.922]}},{"noteOn":{"time":65.945,"note":95.000,"xyz":[-82.287,230.000,301.749]}},{"noteOn":{"time":66.230,"note":93.000,"xyz":[-41.917,206.000,129.724]}},{"noteOn":{"time":66.350,"note":94.000,"xyz":[92.081,218.000,487.590]}},{"noteOn":{"time":66.350,"note":97.000,"xyz":[13.715,254.000,-4.477]}},{"noteOn":{"time":66.395,"note":104.000,"xyz":[253.884,338.000,-94.252]}},{"noteOn":{"time":66.420,"note":101.000,"xyz":[113.992,302.000,-66.367]}},{"noteOn":{"time":66.595,"note":106.000,"xyz":[122.369,362.000,-335.356]}},{"noteOn":{"time":66.650,"note":93.000,"xyz":[-10.664,206.000,-22.190]}},{"noteOn":{"time":66.835,"note":96.000,"xyz":[-56.248,242.000,-33.703]}},{"noteOn":{"time":66.890,"note":106.000,"xyz":[-385.783,362.000,273.563]}},{"noteOn":{"time":67.090,"note":101.000,"xyz":[22.710,302.000,54.539]}},{"noteOn":{"time":67.090,"note":99.000,"xyz":[-3.185,278.000,-37.435]}},{"noteOn":{"time":67.110,"note":94.000,"xyz":[76.891,218.000,271.017]}},{"noteOn":{"time":67.220,"note":96.000,"xyz":[-205.015,242.000,-111.645]}},{"noteOn":{"time":67.265,"note":102.000,"xyz":[14.667,314.000,15.017]}},{"noteOn":{"time":67.335,"note":103.000,"xyz":[6.716,326.000,-10.840]}},{"noteOn":{"time":67.345,"note":91.000,"xyz":[13.419,182.000,-8.065]}},{"noteOn":{"time":67.490,"note":99.000,"xyz":[76.227,278.000,325.635]}},{"noteOn":{"time":67.660,"note":97.000,"xyz":[-333.439,254.000,343.490]}},{"noteOn":{"time":67.700,"note":93.000,"xyz":[-345.853,206.000,-53.419]}},{"noteOn":{"time":67.730,"note":101.000,"xyz":[255.567,302.000,-251.380]}},{"noteOn":{"time":68.010,"note":95.000,"xyz":[-164.051,230.000,171.140]}},{"noteOn":{"time":68.130,"note":98.000,"xyz":[-55.660,266.000,455.989]}},{"noteOn":{"time":68.150,"note":101.000,"xyz":[383.559,302.000,13.371]}},{"noteOn":{"time":68.175,"note":93.000,"xyz":[139.896,206.000,158.090]}},{"noteOn":{"time":68.205,"note":101.000,"xyz":[-143.621,302.000,-98.297]}},{"noteOn":{"time":68.235,"note":100.000,"xyz":[-71.887,290.000,-69.836]}},{"noteOn":{"time":68.350,"note":99.000,"xyz":[-63.509,278.000,-308.700]}},{"noteOn":{"time":68.385,"note":97.000,"xyz":[158.256,254.000,-195.573]}},{"noteOn":{"time":68.590,"note":93.000,"xyz":[170.791,206.000,341.287]}},{"noteOn":{"time":68.690,"note":103.000,"xyz":[148.527,326.000,465.606]}},{"noteOn":{"time":68.890,"note":99.000,"xyz":[2.545,278.000,100.445]}},{"noteOn":{"time":68.915,"note":93.000,"xyz":[-60.516,206.000,-8.840]}},{"noteOn":{"time":68.930,"note":97.000,"xyz":[-321.409,254.000,-232.342]}},{"noteOn":{"time":68.930,"note":101.000,"xyz":[-211.446,302.000,-232.353]}},{"noteOn":{"time":68.935,"note":95.000,"xyz":[-317.924,230.000,-276.222]}},{"noteOn":{"time":68.935,"note":99.000,"xyz":[439.124,278.000,209.052]}},{"noteOn":{"time":69.180,"note":96.000,"xyz":[84.667,242.000,-69.686]}},{"noteOn":{"time":69.230,"note":95.000,"xyz":[-131.374,230.000,-180.332]}},{"noteOn":{"time":69.505,"note":103.000,"xyz":[-0.307,326.000,-2.774]}},{"noteOn":{"time":69.570,"note":89.000,"xyz":[-62.634,158.000,481.214]}},{"noteOn":{"time":69.585,"note":103.000,"xyz":[67.598,326.000,-394.844]}},{"noteOn":{"time":69.650,"note":103.000,"xyz":[-115.268,326.000,-431.511]}},{"noteOn":{"time":69.665,"note":97.000,"xyz":[138.994,254.000,-40.876]}},{"noteOn":{"time":69.665,"note":101.000,"xyz":[37.823,302.000,283.530]}},{"noteOn":{"time":69.785,"note":93.000,"xyz":[185.558,206.000,243.281]}},{"noteOn":{"time":69.825,"note":98.000,"xyz":[333.773,266.000,91.391]}},{"noteOn":{"time":70.075,"note":95.000,"xyz":[0.198,230.000,-2.058]}},{"noteOn":{"time":70.095,"note":95.000,"xyz":[-348.131,230.000,-68.339]}},{"noteOn":{"time":70.170,"note":105.000,"xyz":[-158.991,350.000,219.494]}},{"noteOn":{"time":70.195,"note":105.000,"xyz":[124.751,350.000,-108.988]}},{"noteOn":{"time":70.210,"note":101.000,"xyz":[185.567,302.000,107.270]}},{"noteOn":{"time":70.245,"note":107.000,"xyz":[-18.705,374.000,-266.029]}},{"noteOn":{"time":70.345,"note":99.000,"xyz":[-68.731,278.000,191.393]}},{"noteOn":{"time":70.425,"note":91.000,"xyz":[351.690,182.000,-221.598]}},{"noteOn":{"time":70.495,"note":107.000,"xyz":[-33.012,374.000,170.359]}},{"noteOn":{"time":70.555,"note":94.000,"xyz":[-2.784,218.000,201.255]}},{"noteOn":{"time":70.730,"note":92.000,"xyz":[48.518,194.000,124.126]}},{"noteOn":{"time":70.795,"note":95.000,"xyz":[-16.697,230.000,-421.232]}},{"noteOn":{"time":70.825,"note":95.000,"xyz":[-278.285,230.000,66.512]}},{"noteOn":{"time":70.830,"note":98.000,"xyz":[-419.556,266.000,50.035]}},{"noteOn":{"time":70.875,"note":101.000,"xyz":[76.963,302.000,425.202]}},{"noteOn":{"time":71.005,"note":105.000,"xyz":[-125.341,350.000,149.436]}},{"noteOn":{"time":71.135,"note":107.000,"xyz":[-258.219,374.000,-4.325]}},{"noteOn":{"time":71.235,"note":92.000,"xyz":[-53.136,194.000,211.148]}},{"noteOn":{"time":71.380,"note":105.000,"xyz":[-157.336,350.000,-37.769]}},{"noteOn":{"time":71.390,"note":95.000,"xyz":[423.255,230.000,-54.812]}},{"noteOn":{"time":71.460,"note":97.000,"xyz":[-20.794,254.000,8.111]}},{"noteOn":{"time":71.600,"note":102.000,"xyz":[287.455,314.000,-260.927]}},{"noteOn":{"time":71.625,"note":100.000,"xyz":[166.932,290.000,168.931]}},{"noteOn":{"time":71.645,"note":103.000,"xyz":[0.124,326.000,-15.670]}},{"noteOn":{"time":71.660,"note":103.000,"xyz":[69.361,326.000,-5.805]}},{"noteOn":{"time":71.700,"note":97.000,"xyz":[34.194,254.000,14.714]}},{"noteOn":{"time":71.755,"note":91.000,"xyz":[191.858,182.000,-153.893]}},{"noteOn":{"time":71.835,"note":102.000,"xyz":[-99.172,314.000,120.012]}},{"noteOn":{"time":71.935,"note":99.000,"xyz":[-28.862,278.000,68.049]}},{"noteOn":{"time":72.060,"note":98.000,"xyz":[-307.721,266.000,369.243]}},{"noteOn":{"time":72.175,"note":93.000,"xyz":[-125.360,206.000,318.414]}},{"noteOn":{"time":72.230,"note":100.000,"xyz":[-101.567,290.000,141.635]}},{"noteOn":{"time":72.440,"note":101.000,"xyz":[-303.743,302.000,-28.240]}},{"noteOn":{"time":72.540,"note":94.000,"xyz":[-289.375,218.000,4.202]}},{"noteOn":{"time":72.595,"note":94.000,"xyz":[295.005,218.000,96.917]}},{"noteOn":{"time":72.605,"note":99.000,"xyz":[160.323,278.000,345.182]}},{"noteOn":{"time":72.630,"note":106.000,"xyz":[-473.180,362.000,48.050]}},{"noteOn":{"time":72.650,"note":101.000,"xyz":[3.435,302.000,27.342]}},{"noteOn":{"time":72.730,"note":96.000,"xyz":[-84.757,242.000,468.092]}},{"noteOn":{"time":72.785,"note":97.000,"xyz":[35.893,254.000,-358.917]}},{"noteOn":{"time":72.825,"note":100.000,"xyz":[-124.651,290.000,-240.059]}},{"noteOn":{"time":73.105,"note":94.000,"xyz":[-380.382,218.000,232.150]}},{"noteOn":{"time":73.235,"note":103.000,"xyz":[-274.010,326.000,-104.798]}},{"noteOn":{"time":73.295,"note":104.000,"xyz":[116.830,338.000,214.334]}},{"noteOn":{"time":73.345,"note":94.000,"xyz":[-179.083,218.000,-406.365]}},{"noteOn":{"time":73.355,"note":100.000,"xyz":[-269.145,290.000,382.444]}},{"noteOn":{"time":73.380,"note":98.000,"xyz":[36.084,266.000,-39.572]}},{"noteOn":{"time":73.450,"note":92.000,"xyz":[88.440,194.000,-73.388]}},{"noteOn":{"time":73.495,"note":102.000,"xyz":[1.372,314.000,-1.377]}},{"noteOn":{"time":73.525,"note":98.000,"xyz":[-436.266,266.000,36.372]}},{"noteOn":{"time":73.730,"note":96.000,"xyz":[272.436,242.000,59.979]}},{"noteOn":{"time":73.750,"note":97.000,"xyz":[-36.054,254.000,349.624]}},{"noteOn":{"time":73.995,"note":104.000,"xyz":[37.786,338.000,-68.956]}},{"noteOn":{"time":74.075,"note":100.000,"xyz":[-82.847,290.000,234.442]}},{"noteOn":{"time":74.110,"note":90.000,"xyz":[4.243,170.000,9.748]}},{"noteOn":{"time":74.130,"note":102.000,"xyz":[134.969,314.000,-282.846]}},{"noteOn":{"time":74.190,"note":104.000,"xyz":[297.674,338.000,5.726]}},{"noteOn":{"time":74.245,"note":92.000,"xyz":[-7.163,194.000,-62.387]}},{"noteOn":{"time":74.250,"note":98.000,"xyz":[-72.221,266.000,-279.624]}},{"noteOn":{"time":74.265,"note":96.000,"xyz":[-127.657,242.000,384.635]}},{"noteOn":{"time":74.415,"note":99.000,"xyz":[471.153,278.000,15.183]}},{"noteOn":{"time":74.535,"note":96.000,"xyz":[461.717,242.000,-147.803]}},{"noteOn":{"time":74.605,"note":94.000,"xyz":[-237.072,218.000,-182.726]}},{"noteOn":{"time":74.635,"note":100.000,"xyz":[-174.318,290.000,-88.555]}},{"noteOn":{"time":74.740,"note":94.000,"xyz":[162.063,218.000,-0.212]}},{"noteOn":{"time":74.755,"note":100.000,"xyz":[117.840,290.000,-115.299]}},{"noteOn":{"time":74.770,"note":106.000,"xyz":[34.153,362.000,-225.258]}},{"noteOn":{"time":74.940,"note":106.000,"xyz":[-12.702,362.000,-363.917]}},{"noteOn":{"time":75.045,"note":92.000,"xyz":[-169.383,194.000,-156.857]}},{"noteOn":{"time":75.090,"note":106.000,"xyz":[1.521,362.000,416.208]}},{"noteOn":{"time":75.165,"note":93.000,"xyz":[-16.642,206.000,34.848]}},{"noteOn":{"time":75.230,"note":92.000,"xyz":[-9.505,194.000,409.159]}},{"noteOn":{"time":75.260,"note":98.000,"xyz":[-142.952,266.000,6.454]}},{"noteOn":{"time":75.305,"note":98.000,"xyz":[-103.509,266.000,-24.204]}},{"noteOn":{"time":75.335,"note":100.000,"xyz":[-238.764,290.000,-423.053]}},{"noteOn":{"time":75.340,"note":96.000,"xyz":[131.898,242.000,32.623]}},{"noteOn":{"time":75.545,"note":108.000,"xyz":[-63.808,386.000,389.664]}},{"noteOn":{"time":75.630,"note":104.000,"xyz":[98.652,338.000,91.928]}},{"noteOn":{"time":75.675,"note":104.000,"xyz":[308.840,338.000,-57.774]}},{"noteOn":{"time":75.770,"note":98.000,"xyz":[-27.247,266.000,-96.262]}},{"noteOn":{"time":75.825,"note":91.000,"xyz":[82.876,182.000,30.728]}},{"noteOn":{"time":75.930,"note":94.000,"xyz":[9.779,218.000,-2.694]}},{"noteOn":{"time":76.085,"note":102.000,"xyz":[-51.438,314.000,192.666]}},{"noteOn":{"time":76.110,"note":101.000,"xyz":[51.713,302.000,-295.037]}},{"noteOn":{"time":76.155,"note":100.000,"xyz":[42.166,290.000,-264.705]}},{"noteOn":{"time":76.170,"note":92.000,"xyz":[-15.947,194.000,-96.856]}},{"noteOn":{"time":76.215,"note":104.000,"xyz":[142.754,338.000,-40.499]}},{"noteOn":{"time":76.300,"note":98.000,"xyz":[-7.543,266.000,17.112]}},{"noteOn":{"time":76.385,"note":100.000,"xyz":[112.698,290.000,-277.832]}},{"noteOn":{"time":76.400,"note":101.000,"xyz":[193.881,302.000,214.855]}},{"noteOn":{"time":76.530,"note":96.000,"xyz":[-90.896,242.000,-133.810]}},{"noteOn":{"time":76.640,"note":92.000,"xyz":[-226.278,194.000,-284.938]}},{"noteOn":{"time":76.730,"note":99.000,"xyz":[-71.376,278.000,-133.939]}},{"noteOn":{"time":76.910,"note":94.000,"xyz":[419.856,218.000,62.521]}},{"noteOn":{"time":76.975,"note":100.000,"xyz":[-85.791,290.000,-70.603]}},{"noteOn":{"time":77.010,"note":106.000,"xyz":[63.567,362.000,159.577]}},{"noteOn":{"time":77.015,"note":100.000,"xyz":[92.261,290.000,38.401]}},{"noteOn":{"time":77.035,"note":102.000,"xyz":[-146.517,314.000,-434.999]}},{"noteOn":{"time":77.050,"note":105.000,"xyz":[330.945,350.000,221.554]}},{"noteOn":{"time":77.130,"note":93.000,"xyz":[-31.123,206.000,40.148]}},{"noteOn":{"time":77.170,"note":98.000,"xyz":[443.776,266.000,-201.525]}},{"noteOn":{"time":77.390,"note":99.000,"xyz":[469.039,278.000,4.625]}},{"noteOn":{"time":77.610,"note":95.000,"xyz":[-98.716,230.000,1.682]}},{"noteOn":{"time":77.690,"note":98.000,"xyz":[-298.922,266.000,-396.886]}},{"noteOn":{"time":77.760,"note":93.000,"xyz":[228.750,206.000,-189.016]}},{"noteOn":{"time":77.820,"note":100.000,"xyz":[12.652,290.000,-224.125]}},{"noteOn":{"time":77.835,"note":103.000,"xyz":[-365.605,326.000,146.386]}},{"noteOn":{"time":77.835,"note":102.000,"xyz":[77.956,314.000,-79.432]}},{"noteOn":{"time":77.930,"note":93.000,"xyz":[-107.318,206.000,392.619]}},{"noteOn":{"time":77.935,"note":102.000,"xyz":[14.082,314.000,177.213]}},{"noteOn":{"time":77.945,"note":98.000,"xyz":[-103.555,266.000,-241.629]}},{"noteOn":{"time":78.225,"note":97.000,"xyz":[61.152,254.000,38.479]}},{"noteOn":{"time":78.290,"note":97.000,"xyz":[-60.726,254.000,25.651]}},{"noteOn":{"time":78.385,"note":97.000,"xyz":[183.757,254.000,-300.474]}},{"noteOn":{"time":78.485,"note":100.000,"xyz":[387.996,290.000,272.072]}},{"noteOn":{"time":78.555,"note":101.000,"xyz":[-39.018,302.000,173.864]}},{"noteOn":{"time":78.635,"note":99.000,"xyz":[-179.023,278.000,36.685]}},{"noteOn":{"time":78.650,"note":91.000,"xyz":[-0.539,182.000,-224.562]}},{"noteOn":{"time":78.700,"note":91.000,"xyz":[-73.512,182.000,66.602]}},{"noteOn":{"time":78.755,"note":105.000,"xyz":[-278.119,350.000,-211.919]}},{"noteOn":{"time":78.905,"note":95.000,"xyz":[-40.486,230.000,222.865]}},{"noteOn":{"time":78.975,"note":100.000,"xyz":[180.307,290.000,-273.394]}},{"noteOn":{"time":79.110,"note":99.000,"xyz":[-270.393,278.000,218.012]}},{"noteOn":{"time":79.115,"note":93.000,"xyz":[-128.046,206.000,-64.462]}},{"noteOn":{"time":79.195,"note":99.000,"xyz":[-88.557,278.000,-10.834]}},{"noteOn":{"time":79.235,"note":101.000,"xyz":[-432.969,302.000,22.471]}},{"noteOn":{"time":79.365,"note":106.000,"xyz":[-165.527,362.000,86.927]}},{"noteOn":{"time":79.430,"note":95.000,"xyz":[-274.881,230.000,-336.138]}},{"noteOn":{"time":79.430,"note":105.000,"xyz":[-382.057,350.000,-207.954]}},{"noteOn":{"time":79.570,"note":105.000,"xyz":[-155.150,350.000,239.378]}},{"noteOn":{"time":79.640,"note":93.000,"xyz":[276.120,206.000,-118.420]}},{"noteOn":{"time":79.725,"note":91.000,"xyz":[16.297,182.000,-67.065]}},{"noteOn":{"time":79.750,"note":92.000,"xyz":[-46.688,194.000,164.262]}},{"noteOn":{"time":79.775,"note":97.000,"xyz":[-473.301,254.000,65.590]}},{"noteOn":{"time":79.835,"note":99.000,"xyz":[-91.224,278.000,16.905]}},{"noteOn":{"time":79.855,"note":99.000,"xyz":[-218.053,278.000,310.787]}},{"noteOn":{"time":79.955,"note":97.000,"xyz":[-232.940,254.000,151.360]}},{"noteOn":{"time":79.955,"note":107.000,"xyz":[198.131,374.000,111.611]}},{"noteOn":{"time":80.010,"note":103.000,"xyz":[51.388,326.000,-5.361]}},{"noteOn":{"time":80.255,"note":103.000,"xyz":[121.466,326.000,-46.974]}},{"noteOn":{"time":80.390,"note":92.000,"xyz":[163.788,194.000,380.095]}},{"noteOn":{"time":80.450,"note":93.000,"xyz":[-175.958,206.000,-313.968]}},{"noteOn":{"time":80.575,"note":101.000,"xyz":[-418.950,302.000,-51.209]}},{"noteOn":{"time":80.615,"note":101.000,"xyz":[23.522,302.000,-1.410]}},{"noteOn":{"time":80.620,"note":95.000,"xyz":[-120.267,230.000,242.129]}},{"noteOn":{"time":80.645,"note":93.000,"xyz":[-19.874,206.000,-1.217]}},{"noteOn":{"time":80.740,"note":101.000,"xyz":[250.724,302.000,-58.411]}},{"noteOn":{"time":80.875,"note":101.000,"xyz":[67.679,302.000,58.705]}},{"noteOn":{"time":80.900,"note":99.000,"xyz":[-30.824,278.000,-325.697]}},{"noteOn":{"time":80.945,"note":100.000,"xyz":[139.882,290.000,-105.105]}},{"noteOn":{"time":81.060,"note":105.000,"xyz":[35.430,350.000,9.175]}},{"noteOn":{"time":81.085,"note":91.000,"xyz":[-274.375,182.000,-215.714]}},{"noteOn":{"time":81.225,"note":99.000,"xyz":[-262.038,278.000,-53.439]}},{"noteOn":{"time":81.230,"note":105.000,"xyz":[162.111,350.000,49.831]}},{"noteOn":{"time":81.340,"note":95.000,"xyz":[163.989,230.000,78.631]}},{"noteOn":{"time":81.345,"note":99.000,"xyz":[275.671,278.000,-118.555]}},{"noteOn":{"time":81.425,"note":101.000,"xyz":[50.374,302.000,-420.651]}},{"noteOn":{"time":81.635,"note":99.000,"xyz":[142.108,278.000,-60.924]}},{"noteOn":{"time":81.635,"note":107.000,"xyz":[-365.021,374.000,-195.111]}},{"noteOn":{"time":81.665,"note":93.000,"xyz":[-242.617,206.000,-300.516]}},{"noteOn":{"time":81.680,"note":103.000,"xyz":[216.475,326.000,-169.642]}},{"noteOn":{"time":81.735,"note":109.000,"xyz":[-325.574,398.000,208.410]}},{"noteOn":{"time":81.910,"note":98.000,"xyz":[-11.510,266.000,6.835]}},{"noteOn":{"time":82.100,"note":102.000,"xyz":[-118.109,314.000,213.687]}},{"noteOn":{"time":82.120,"note":96.000,"xyz":[91.137,242.000,-73.017]}},{"noteOn":{"time":82.180,"note":97.000,"xyz":[-336.073,254.000,360.025]}},{"noteOn":{"time":82.235,"note":93.000,"xyz":[-90.334,206.000,158.695]}},{"noteOn":{"time":82.260,"note":103.000,"xyz":[-58.222,326.000,-120.105]}},{"noteOn":{"time":82.365,"note":99.000,"xyz":[120.892,278.000,-120.422]}},{"noteOn":{"time":82.410,"note":94.000,"xyz":[-306.787,218.000,-291.730]}},{"noteOn":{"time":82.420,"note":101.000,"xyz":[271.909,302.000,-209.645]}},{"noteOn":{"time":82.430,"note":97.000,"xyz":[-94.530,254.000,-25.717]}},{"noteOn":{"time":82.620,"note":107.000,"xyz":[4.208,374.000,12.795]}},{"noteOn":{"time":82.725,"note":98.000,"xyz":[-431.023,266.000,137.877]}},{"noteOn":{"time":82.740,"note":98.000,"xyz":[-56.361,266.000,-287.331]}},{"noteOn":{"time":82.790,"note":98.000,"xyz":[13.663,266.000,8.664]}},{"noteOn":{"time":82.960,"note":99.000,"xyz":[302.684,278.000,-126.313]}},{"noteOn":{"time":82.980,"note":100.000,"xyz":[189.045,290.000,-54.441]}},{"noteOn":{"time":83.015,"note":99.000,"xyz":[-133.608,278.000,-272.528]}},{"noteOn":{"time":83.200,"note":105.000,"xyz":[35.993,350.000,328.853]}},{"noteOn":{"time":83.225,"note":91.000,"xyz":[100.019,182.000,-69.730]}},{"noteOn":{"time":83.245,"note":95.000,"xyz":[149.927,230.000,-203.525]}},{"noteOn":{"time":83.275,"note":91.000,"xyz":[-338.876,182.000,-122.229]}},{"noteOn":{"time":83.500,"note":100.000,"xyz":[217.829,290.000,-307.955]}},{"noteOn":{"time":83.530,"note":104.000,"xyz":[48.918,338.000,-144.108]}},{"noteOn":{"time":83.585,"note":98.000,"xyz":[24.076,266.000,188.722]}},{"noteOn":{"time":83.625,"note":92.000,"xyz":[-339.038,194.000,89.176]}},{"noteOn":{"time":83.640,"note":100.000,"xyz":[-278.770,290.000,-190.740]}},{"noteOn":{"time":83.735,"note":104.000,"xyz":[-244.610,338.000,390.443]}},{"noteOn":{"time":83.800,"note":100.000,"xyz":[230.808,290.000,49.715]}},{"noteOn":{"time":83.875,"note":105.000,"xyz":[149.455,350.000,46.477]}},{"noteOn":{"time":83.890,"note":107.000,"xyz":[-470.288,374.000,-167.783]}},{"noteOn":{"time":83.990,"note":95.000,"xyz":[-2.932,230.000,14.044]}},{"noteOn":{"time":84.185,"note":93.000,"xyz":[125.426,206.000,-65.358]}},{"noteOn":{"time":84.220,"note":90.000,"xyz":[119.973,170.000,180.165]}},{"noteOn":{"time":84.230,"note":106.000,"xyz":[69.462,362.000,68.416]}},{"noteOn":{"time":84.295,"note":92.000,"xyz":[-9.731,194.000,-76.833]}},{"noteOn":{"time":84.310,"note":96.000,"xyz":[84.660,242.000,-310.067]}},{"noteOn":{"time":84.370,"note":100.000,"xyz":[-142.894,290.000,213.814]}},{"noteOn":{"time":84.450,"note":102.000,"xyz":[-68.734,314.000,137.625]}},{"noteOn":{"time":84.470,"note":98.000,"xyz":[-82.913,266.000,53.369]}},{"noteOn":{"time":84.490,"note":107.000,"xyz":[-5.216,374.000,2.157]}},{"noteOn":{"time":84.640,"note":98.000,"xyz":[8.632,266.000,-1.416]}},{"noteOn":{"time":84.640,"note":102.000,"xyz":[32.570,314.000,362.737]}},{"noteOn":{"time":84.740,"note":100.000,"xyz":[-165.021,290.000,434.253]}},{"noteOn":{"time":84.915,"note":93.000,"xyz":[-140.630,206.000,-187.925]}},{"noteOn":{"time":84.915,"note":92.000,"xyz":[194.680,194.000,291.789]}},{"noteOn":{"time":85.125,"note":100.000,"xyz":[177.711,290.000,41.337]}},{"noteOn":{"time":85.140,"note":100.000,"xyz":[-148.656,290.000,-38.627]}},{"noteOn":{"time":85.210,"note":94.000,"xyz":[-189.534,218.000,71.830]}},{"noteOn":{"time":85.240,"note":94.000,"xyz":[-339.324,218.000,-323.632]}},{"noteOn":{"time":85.325,"note":102.000,"xyz":[-82.509,314.000,387.165]}},{"noteOn":{"time":85.360,"note":100.000,"xyz":[245.960,290.000,-314.118]}},{"noteOn":{"time":85.435,"note":102.000,"xyz":[15.095,314.000,14.193]}},{"noteOn":{"time":85.445,"note":99.000,"xyz":[-140.806,278.000,-140.478]}},{"noteOn":{"time":85.460,"note":98.000,"xyz":[109.231,266.000,-39.983]}},{"noteOn":{"time":85.470,"note":90.000,"xyz":[47.463,170.000,140.563]}},{"noteOn":{"time":85.615,"note":106.000,"xyz":[113.676,362.000,94.870]}},{"noteOn":{"time":85.720,"note":98.000,"xyz":[-269.108,266.000,-285.742]}},{"noteOn":{"time":85.790,"note":98.000,"xyz":[9.817,266.000,-204.370]}},{"noteOn":{"time":85.865,"note":96.000,"xyz":[-23.234,242.000,-167.245]}},{"noteOn":{"time":85.935,"note":104.000,"xyz":[35.334,338.000,334.361]}},{"noteOn":{"time":86.025,"note":102.000,"xyz":[198.597,314.000,-156.825]}},{"noteOn":{"time":86.095,"note":100.000,"xyz":[276.684,290.000,-155.116]}},{"noteOn":{"time":86.195,"note":92.000,"xyz":[-87.779,194.000,324.042]}},{"noteOn":{"time":86.260,"note":108.000,"xyz":[-38.609,386.000,-44.497]}},{"noteOn":{"time":86.390,"note":108.000,"xyz":[-26.156,386.000,-191.594]}},{"noteOn":{"time":86.390,"note":97.000,"xyz":[-317.884,254.000,-129.501]}},{"noteOn":{"time":86.395,"note":104.000,"xyz":[-90.352,338.000,198.424]}},{"noteOn":{"time":86.585,"note":104.000,"xyz":[-25.195,338.000,-16.573]}},{"noteOn":{"time":86.630,"note":96.000,"xyz":[331.102,242.000,-276.751]}},{"noteOn":{"time":86.805,"note":92.000,"xyz":[85.337,194.000,132.875]}},{"noteOn":{"time":86.830,"note":100.000,"xyz":[112.233,290.000,-193.898]}},{"noteOn":{"time":86.885,"note":94.000,"xyz":[-14.145,218.000,-44.470]}},{"noteOn":{"time":86.895,"note":102.000,"xyz":[-115.324,314.000,-69.457]}},{"noteOn":{"time":86.905,"note":98.000,"xyz":[-55.308,266.000,219.177]}},{"noteOn":{"time":86.995,"note":96.000,"xyz":[-194.267,242.000,23.063]}},{"noteOn":{"time":87.025,"note":98.000,"xyz":[-463.881,266.000,161.880]}},{"noteOn":{"time":87.220,"note":99.000,"xyz":[43.600,278.000,-24.967]}},{"noteOn":{"time":87.250,"note":99.000,"xyz":[-210.183,278.000,-82.878]}},{"noteOn":{"time":87.250,"note":106.000,"xyz":[315.694,362.000,319.911]}},{"noteOn":{"time":87.400,"note":100.000,"xyz":[-372.650,290.000,-315.647]}},{"noteOn":{"time":87.525,"note":106.000,"xyz":[-191.848,362.000,92.020]}},{"noteOn":{"time":87.555,"note":98.000,"xyz":[-382.992,266.000,276.950]}},{"noteOn":{"time":87.620,"note":98.000,"xyz":[12.512,266.000,407.173]}},{"noteOn":{"time":87.640,"note":100.000,"xyz":[275.207,290.000,-111.063]}},{"noteOn":{"time":87.650,"note":96.000,"xyz":[-255.084,242.000,313.833]}},{"noteOn":{"time":87.775,"note":90.000,"xyz":[28.360,170.000,-60.833]}},{"noteOn":{"time":87.895,"note":92.000,"xyz":[-56.305,194.000,29.437]}},{"noteOn":{"time":87.905,"note":104.000,"xyz":[81.811,338.000,164.454]}},{"noteOn":{"time":87.980,"note":101.000,"xyz":[-86.187,302.000,-177.850]}},{"noteOn":{"time":88.060,"note":97.000,"xyz":[-237.018,254.000,-172.509]}},{"noteOn":{"time":88.135,"note":91.000,"xyz":[130.311,182.000,122.885]}},{"noteOn":{"time":88.145,"note":104.000,"xyz":[32.705,338.000,-116.489]}},{"noteOn":{"time":88.300,"note":108.000,"xyz":[-16.750,386.000,-13.216]}},{"noteOn":{"time":88.395,"note":100.000,"xyz":[449.640,290.000,-43.446]}},{"noteOn":{"time":88.435,"note":96.000,"xyz":[39.067,242.000,-210.817]}},{"noteOn":{"time":88.435,"note":104.000,"xyz":[-40.526,338.000,-278.668]}},{"noteOn":{"time":88.465,"note":107.000,"xyz":[96.692,374.000,312.604]}},{"noteOn":{"time":88.610,"note":101.000,"xyz":[182.673,302.000,-348.575]}},{"noteOn":{"time":88.720,"note":91.000,"xyz":[-118.566,182.000,10.278]}},{"noteOn":{"time":88.725,"note":94.000,"xyz":[-438.272,218.000,45.502]}},{"noteOn":{"time":88.800,"note":91.000,"xyz":[17.376,182.000,45.678]}},{"noteOn":{"time":88.895,"note":101.000,"xyz":[-7.067,302.000,182.438]}},{"noteOn":{"time":89.020,"note":102.000,"xyz":[-106.696,314.000,-225.261]}},{"noteOn":{"time":89.085,"note":106.000,"xyz":[-4.665,362.000,1.268]}},{"noteOn":{"time":89.105,"note":97.000,"xyz":[126.732,254.000,101.850]}},{"noteOn":{"time":89.170,"note":102.000,"xyz":[-409.569,314.000,106.014]}},{"noteOn":{"time":89.205,"note":98.000,"xyz":[211.313,266.000,-204.332]}},{"noteOn":{"time":89.230,"note":99.000,"xyz":[17.900,278.000,-6.348]}},{"noteOn":{"time":89.365,"note":95.000,"xyz":[225.924,230.000,-225.364]}},{"noteOn":{"time":89.380,"note":92.000,"xyz":[-406.931,194.000,-101.165]}},{"noteOn":{"time":89.395,"note":93.000,"xyz":[171.272,206.000,-122.044]}},{"noteOn":{"time":89.635,"note":99.000,"xyz":[110.220,278.000,86.131]}},{"noteOn":{"time":89.770,"note":100.000,"xyz":[-52.295,290.000,-77.652]}},{"noteOn":{"time":89.775,"note":107.000,"xyz":[-399.348,374.000,196.295]}},{"noteOn":{"time":89.805,"note":95.000,"xyz":[-306.209,230.000,-37.637]}},{"noteOn":{"time":89.825,"note":99.000,"xyz":[-160.240,278.000,0.767]}},{"noteOn":{"time":89.885,"note":103.000,"xyz":[-52.816,326.000,-25.853]}},{"noteOn":{"time":89.905,"note":99.000,"xyz":[-24.710,278.000,45.805]}},{"noteOn":{"time":89.905,"note":89.000,"xyz":[-143.146,158.000,-196.697]}},{"noteOn":{"time":89.995,"note":103.000,"xyz":[-235.269,326.000,218.082]}},{"noteOn":{"time":90.205,"note":99.000,"xyz":[3.587,278.000,-5.673]}},{"noteOn":{"time":90.220,"note":97.000,"xyz":[-396.972,254.000,195.310]}},{"noteOn":{"time":90.345,"note":93.000,"xyz":[92.016,206.000,-273.308]}},{"noteOn":{"time":90.350,"note":97.000,"xyz":[254.398,254.000,63.583]}},{"noteOn":{"time":90.410,"note":97.000,"xyz":[-198.367,254.000,156.735]}},{"noteOn":{"time":90.615,"note":99.000,"xyz":[32.344,278.000,-81.808]}},{"noteOn":{"time":90.620,"note":102.000,"xyz":[-343.013,314.000,226.684]}},{"noteOn":{"time":90.645,"note":109.000,"xyz":[-82.124,398.000,27.612]}},{"noteOn":{"time":90.695,"note":93.000,"xyz":[42.064,206.000,95.587]}},{"noteOn":{"time":90.830,"note":96.000,"xyz":[-283.221,242.000,213.069]}},{"noteOn":{"time":90.885,"note":105.000,"xyz":[244.466,350.000,-121.795]}},{"noteOn":{"time":91.020,"note":107.000,"xyz":[-134.909,374.000,23.992]}},{"noteOn":{"time":91.025,"note":105.000,"xyz":[142.958,350.000,-101.747]}},{"noteOn":{"time":91.130,"note":103.000,"xyz":[-81.907,326.000,-23.926]}},{"noteOn":{"time":91.140,"note":97.000,"xyz":[412.665,254.000,39.477]}},{"noteOn":{"time":91.240,"note":99.000,"xyz":[-190.104,278.000,-109.967]}},{"noteOn":{"time":91.335,"note":95.000,"xyz":[343.565,230.000,-171.749]}},{"noteOn":{"time":91.395,"note":91.000,"xyz":[122.722,182.000,73.834]}},{"noteOn":{"time":91.440,"note":95.000,"xyz":[5.965,230.000,-13.184]}},{"noteOn":{"time":91.500,"note":97.000,"xyz":[109.543,254.000,-41.692]}},{"noteOn":{"time":91.630,"note":99.000,"xyz":[55.689,278.000,-35.177]}},{"noteOn":{"time":91.630,"note":105.000,"xyz":[-41.083,350.000,-99.328]}},{"noteOn":{"time":91.665,"note":100.000,"xyz":[153.512,290.000,-152.519]}},{"noteOn":{"time":91.720,"note":99.000,"xyz":[-231.909,278.000,-290.741]}},{"noteOn":{"time":91.845,"note":105.000,"xyz":[68.281,350.000,263.616]}},{"noteOn":{"time":91.875,"note":99.000,"xyz":[-378.017,278.000,-102.495]}},{"noteOn":{"time":91.945,"note":97.000,"xyz":[15.682,254.000,-177.300]}},{"noteOn":{"time":92.085,"note":101.000,"xyz":[158.059,302.000,415.688]}},{"noteOn":{"time":92.150,"note":97.000,"xyz":[447.890,254.000,129.101]}},{"noteOn":{"time":92.230,"note":105.000,"xyz":[59.750,350.000,204.666]}},{"noteOn":{"time":92.235,"note":101.000,"xyz":[36.576,302.000,64.453]}},{"noteOn":{"time":92.320,"note":89.000,"xyz":[-448.235,158.000,-128.018]}},{"noteOn":{"time":92.420,"note":102.000,"xyz":[410.655,314.000,-24.778]}},{"noteOn":{"time":92.435,"note":93.000,"xyz":[197.885,206.000,389.444]}},{"noteOn":{"time":92.590,"note":97.000,"xyz":[-221.907,254.000,-399.788]}},{"noteOn":{"time":92.645,"note":91.000,"xyz":[137.647,182.000,-419.517]}},{"noteOn":{"time":92.710,"note":107.000,"xyz":[73.643,374.000,205.757]}},{"noteOn":{"time":92.810,"note":97.000,"xyz":[453.585,254.000,-148.006]}},{"noteOn":{"time":92.885,"note":103.000,"xyz":[-323.684,326.000,351.966]}},{"noteOn":{"time":92.895,"note":99.000,"xyz":[-326.277,278.000,196.206]}},{"noteOn":{"time":92.960,"note":103.000,"xyz":[-54.223,326.000,-96.651]}},{"noteOn":{"time":92.990,"note":99.000,"xyz":[19.913,278.000,-19.479]}},{"noteOn":{"time":93.045,"note":107.000,"xyz":[-77.024,374.000,45.249]}},{"noteOn":{"time":93.190,"note":95.000,"xyz":[147.895,230.000,431.188]}},{"noteOn":{"time":93.220,"note":92.000,"xyz":[40.259,194.000,-99.913]}},{"noteOn":{"time":93.255,"note":92.000,"xyz":[-41.071,194.000,13.963]}},{"noteOn":{"time":93.485,"note":102.000,"xyz":[-1.138,314.000,-0.429]}},{"noteOn":{"time":93.615,"note":101.000,"xyz":[-65.820,302.000,-409.275]}},{"noteOn":{"time":93.685,"note":105.000,"xyz":[-380.742,350.000,-227.437]}},{"noteOn":{"time":93.700,"note":99.000,"xyz":[-14.321,278.000,-8.970]}},{"noteOn":{"time":93.745,"note":97.000,"xyz":[88.751,254.000,-258.074]}},{"noteOn":{"time":93.765,"note":91.000,"xyz":[88.474,182.000,-40.302]}},{"noteOn":{"time":93.770,"note":101.000,"xyz":[163.500,302.000,52.199]}},{"noteOn":{"time":93.820,"note":101.000,"xyz":[156.290,302.000,128.762]}},{"noteOn":{"time":93.835,"note":94.000,"xyz":[4.355,218.000,39.203]}},{"noteOn":{"time":94.025,"note":99.000,"xyz":[-25.632,278.000,26.191]}},{"noteOn":{"time":94.150,"note":98.000,"xyz":[13.059,266.000,0.960]}},{"noteOn":{"time":94.150,"note":107.000,"xyz":[-19.187,374.000,85.231]}},{"noteOn":{"time":94.190,"note":101.000,"xyz":[-5.313,302.000,-1.860]}},{"noteOn":{"time":94.345,"note":98.000,"xyz":[-203.799,266.000,136.182]}},{"noteOn":{"time":94.370,"note":89.000,"xyz":[-108.594,158.000,121.000]}},{"noteOn":{"time":94.395,"note":111.000,"xyz":[3.406,422.000,-13.984]}},{"noteOn":{"time":94.400,"note":95.000,"xyz":[42.376,230.000,476.699]}},{"noteOn":{"time":94.415,"note":104.000,"xyz":[-10.826,338.000,-409.407]}},{"noteOn":{"time":94.440,"note":99.000,"xyz":[165.891,278.000,-317.483]}},{"noteOn":{"time":94.445,"note":103.000,"xyz":[2.575,326.000,5.703]}},{"noteOn":{"time":94.665,"note":94.000,"xyz":[307.495,218.000,46.726]}},{"noteOn":{"time":94.720,"note":96.000,"xyz":[330.064,242.000,-111.193]}},{"noteOn":{"time":94.800,"note":100.000,"xyz":[-38.632,290.000,-159.562]}},{"noteOn":{"time":94.925,"note":108.000,"xyz":[-444.748,386.000,27.194]}},{"noteOn":{"time":94.960,"note":98.000,"xyz":[86.389,266.000,241.194]}},{"noteOn":{"time":95.035,"note":97.000,"xyz":[-180.864,254.000,-100.884]}},{"noteOn":{"time":95.065,"note":108.000,"xyz":[-32.838,386.000,13.606]}},{"noteOn":{"time":95.155,"note":103.000,"xyz":[21.820,326.000,408.164]}},{"noteOn":{"time":95.155,"note":99.000,"xyz":[-365.447,278.000,-129.826]}},{"noteOn":{"time":95.175,"note":94.000,"xyz":[-31.434,218.000,494.882]}},{"noteOn":{"time":95.175,"note":105.000,"xyz":[-362.495,350.000,-51.411]}},{"noteOn":{"time":95.250,"note":96.000,"xyz":[2.459,242.000,54.536]}},{"noteOn":{"time":95.365,"note":106.000,"xyz":[168.671,362.000,-278.418]}},{"noteOn":{"time":95.560,"note":94.000,"xyz":[-78.139,218.000,179.906]}},{"noteOn":{"time":95.590,"note":106.000,"xyz":[335.510,362.000,17.537]}},{"noteOn":{"time":95.600,"note":104.000,"xyz":[-76.042,338.000,-94.007]}},{"noteOn":{"time":95.655,"note":98.000,"xyz":[-113.216,266.000,102.470]}},{"noteOn":{"time":95.725,"note":99.000,"xyz":[-268.409,278.000,-64.623]}},{"noteOn":{"time":95.755,"note":96.000,"xyz":[-118.964,242.000,-481.635]}},{"noteOn":{"time":95.865,"note":100.000,"xyz":[179.689,290.000,60.414]}},{"noteOn":{"time":95.890,"note":96.000,"xyz":[21.972,242.000,31.797]}},{"noteOn":{"time":95.935,"note":90.000,"xyz":[59.096,170.000,-98.504]}},{"noteOn":{"time":96.010,"note":104.000,"xyz":[76.719,338.000,161.224]}},{"noteOn":{"time":96.065,"note":101.000,"xyz":[-242.624,302.000,436.824]}},{"noteOn":{"time":96.120,"note":96.000,"xyz":[-45.195,242.000,189.164]}},{"noteOn":{"time":96.220,"note":100.000,"xyz":[-137.093,290.000,-387.030]}},{"noteOn":{"time":96.220,"note":106.000,"xyz":[-302.966,362.000,-269.508]}},{"noteOn":{"time":96.290,"note":104.000,"xyz":[235.445,338.000,-27.535]}},{"noteOn":{"time":96.350,"note":98.000,"xyz":[-392.837,266.000,154.685]}},{"noteOn":{"time":96.430,"note":102.000,"xyz":[147.163,314.000,-287.315]}},{"noteOn":{"time":96.540,"note":98.000,"xyz":[138.443,266.000,33.785]}},{"noteOn":{"time":96.625,"note":96.000,"xyz":[-59.016,242.000,-317.515]}},{"noteOn":{"time":96.690,"note":102.000,"xyz":[-109.497,314.000,-83.631]}},{"noteOn":{"time":96.805,"note":102.000,"xyz":[-111.856,314.000,-139.404]}},{"noteOn":{"time":96.815,"note":90.000,"xyz":[-93.624,170.000,297.607]}},{"noteOn":{"time":96.835,"note":103.000,"xyz":[133.843,326.000,-363.011]}},{"noteOn":{"time":96.865,"note":106.000,"xyz":[116.642,362.000,-354.729]}},{"noteOn":{"time":96.980,"note":94.000,"xyz":[-209.187,218.000,114.631]}},{"noteOn":{"time":97.120,"note":96.000,"xyz":[95.905,242.000,-138.082]}},{"noteOn":{"time":97.135,"note":98.000,"xyz":[-30.305,266.000,-189.497]}},{"noteOn":{"time":97.155,"note":90.000,"xyz":[-319.936,170.000,-250.001]}},{"noteOn":{"time":97.255,"note":106.000,"xyz":[105.853,362.000,37.241]}},{"noteOn":{"time":97.295,"note":100.000,"xyz":[-1.721,290.000,200.284]}},{"noteOn":{"time":97.445,"note":102.000,"xyz":[428.815,314.000,81.580]}},{"noteOn":{"time":97.520,"note":100.000,"xyz":[50.057,290.000,-242.619]}},{"noteOn":{"time":97.525,"note":98.000,"xyz":[30.608,266.000,-42.106]}},{"noteOn":{"time":97.635,"note":102.000,"xyz":[298.402,314.000,-277.589]}},{"noteOn":{"time":97.655,"note":96.000,"xyz":[69.170,242.000,-472.458]}},{"noteOn":{"time":97.695,"note":93.000,"xyz":[276.988,206.000,-285.836]}},{"noteOn":{"time":97.720,"note":92.000,"xyz":[-8.315,194.000,479.563]}},{"noteOn":{"time":97.800,"note":108.000,"xyz":[296.130,386.000,-232.723]}},{"noteOn":{"time":98.035,"note":110.000,"xyz":[98.792,410.000,73.450]}},{"noteOn":{"time":98.070,"note":102.000,"xyz":[161.774,314.000,324.627]}},{"noteOn":{"time":98.095,"note":104.000,"xyz":[-158.510,338.000,156.694]}},{"noteOn":{"time":98.125,"note":100.000,"xyz":[-62.717,290.000,227.122]}},{"noteOn":{"time":98.160,"note":90.000,"xyz":[-264.760,170.000,132.682]}},{"noteOn":{"time":98.195,"note":100.000,"xyz":[-62.635,290.000,-12.467]}},{"noteOn":{"time":98.200,"note":100.000,"xyz":[39.735,290.000,-33.007]}},{"noteOn":{"time":98.250,"note":95.000,"xyz":[45.143,230.000,-177.612]}},{"noteOn":{"time":98.330,"note":96.000,"xyz":[-22.173,242.000,484.799]}},{"noteOn":{"time":98.410,"note":100.000,"xyz":[-405.303,290.000,-30.558]}},{"noteOn":{"time":98.530,"note":98.000,"xyz":[41.229,266.000,-257.541]}},{"noteOn":{"time":98.660,"note":97.000,"xyz":[-294.246,254.000,286.254]}},{"noteOn":{"time":98.785,"note":97.000,"xyz":[-2.141,254.000,-9.376]}},{"noteOn":{"time":98.790,"note":102.000,"xyz":[356.145,314.000,157.226]}},{"noteOn":{"time":98.845,"note":88.000,"xyz":[-118.027,146.000,69.255]}},{"noteOn":{"time":98.850,"note":108.000,"xyz":[-230.089,386.000,-279.289]}},{"noteOn":{"time":98.885,"note":108.000,"xyz":[87.775,386.000,-250.904]}},{"noteOn":{"time":98.930,"note":104.000,"xyz":[247.256,338.000,33.425]}},{"noteOn":{"time":98.935,"note":96.000,"xyz":[-279.602,242.000,-39.473]}},{"noteOn":{"time":98.945,"note":104.000,"xyz":[-38.591,338.000,-398.565]}},{"noteOn":{"time":98.990,"note":98.000,"xyz":[-156.072,266.000,-211.769]}},{"noteOn":{"time":99.035,"note":102.000,"xyz":[293.157,314.000,-16.356]}},{"noteOn":{"time":99.050,"note":100.000,"xyz":[322.821,290.000,-261.159]}},{"noteOn":{"time":99.220,"note":95.000,"xyz":[-78.156,230.000,30.639]}},{"noteOn":{"time":99.455,"note":98.000,"xyz":[-203.800,266.000,-258.702]}},{"noteOn":{"time":99.465,"note":105.000,"xyz":[-8.186,350.000,-163.865]}},{"noteOn":{"time":99.505,"note":106.000,"xyz":[-320.018,362.000,148.814]}},{"noteOn":{"time":99.565,"note":104.000,"xyz":[28.891,338.000,355.992]}},{"noteOn":{"time":99.580,"note":108.000,"xyz":[17.027,386.000,-53.665]}},{"noteOn":{"time":99.650,"note":95.000,"xyz":[34.139,230.000,418.399]}},{"noteOn":{"time":99.665,"note":95.000,"xyz":[-39.121,230.000,16.695]}},{"noteOn":{"time":99.705,"note":96.000,"xyz":[-116.014,242.000,-46.911]}},{"noteOn":{"time":99.705,"note":98.000,"xyz":[14.037,266.000,-126.887]}},{"noteOn":{"time":99.740,"note":106.000,"xyz":[-76.301,362.000,444.273]}},{"noteOn":{"time":99.965,"note":94.000,"xyz":[46.822,218.000,-99.038]}},{"noteOn":{"time":100.155,"note":100.000,"xyz":[-251.585,290.000,-4.679]}},{"noteOn":{"time":100.160,"note":99.000,"xyz":[-143.585,278.000,302.894]}},{"noteOn":{"time":100.175,"note":97.000,"xyz":[193.010,254.000,-285.097]}},{"noteOn":{"time":100.275,"note":106.000,"xyz":[-27.270,362.000,-18.729]}},{"noteOn":{"time":100.325,"note":98.000,"xyz":[140.070,266.000,-152.976]}},{"noteOn":{"time":100.370,"note":96.000,"xyz":[170.132,242.000,69.970]}},{"noteOn":{"time":100.375,"note":107.000,"xyz":[470.654,374.000,-45.390]}},{"noteOn":{"time":100.380,"note":89.000,"xyz":[161.365,158.000,-6.857]}},{"noteOn":{"time":100.455,"note":101.000,"xyz":[9.955,302.000,-163.018]}},{"noteOn":{"time":100.640,"note":103.000,"xyz":[122.832,326.000,-40.595]}},{"noteOn":{"time":100.665,"note":96.000,"xyz":[-67.388,242.000,171.351]}},{"noteOn":{"time":100.715,"note":101.000,"xyz":[254.138,302.000,-352.331]}},{"noteOn":{"time":100.770,"note":94.000,"xyz":[-480.692,218.000,-91.320]}},{"noteOn":{"time":100.825,"note":97.000,"xyz":[113.637,254.000,-28.792]}},{"noteOn":{"time":100.850,"note":103.000,"xyz":[-54.184,326.000,-73.898]}},{"noteOn":{"time":101.035,"note":96.000,"xyz":[271.273,242.000,62.996]}},{"noteOn":{"time":101.080,"note":101.000,"xyz":[-106.781,302.000,-199.986]}},{"noteOn":{"time":101.110,"note":103.000,"xyz":[33.524,326.000,203.148]}},{"noteOn":{"time":101.180,"note":99.000,"xyz":[97.864,278.000,-59.386]}},{"noteOn":{"time":101.215,"note":91.000,"xyz":[-53.565,182.000,272.400]}},{"noteOn":{"time":101.250,"note":103.000,"xyz":[216.304,326.000,26.486]}},{"noteOn":{"time":101.445,"note":95.000,"xyz":[-186.537,230.000,-40.864]}},{"noteOn":{"time":101.530,"note":107.000,"xyz":[-1.896,374.000,-10.601]}},{"noteOn":{"time":101.575,"note":99.000,"xyz":[-103.785,278.000,338.926]}},{"noteOn":{"time":101.650,"note":95.000,"xyz":[228.141,230.000,54.505]}},{"noteOn":{"time":101.665,"note":91.000,"xyz":[51.392,182.000,-262.424]}},{"noteOn":{"time":101.730,"note":101.000,"xyz":[232.528,302.000,176.019]}},{"noteOn":{"time":101.855,"note":106.000,"xyz":[-297.423,362.000,59.003]}},{"noteOn":{"time":101.930,"note":101.000,"xyz":[18.570,302.000,-23.778]}},{"noteOn":{"time":101.945,"note":101.000,"xyz":[-317.064,302.000,-240.541]}},{"noteOn":{"time":101.970,"note":97.000,"xyz":[14.924,254.000,26.635]}},{"noteOn":{"time":102.040,"note":97.000,"xyz":[-107.015,254.000,-112.485]}},{"noteOn":{"time":102.075,"note":99.000,"xyz":[382.056,278.000,-101.215]}},{"noteOn":{"time":102.135,"note":94.000,"xyz":[-82.686,218.000,152.219]}},{"noteOn":{"time":102.215,"note":109.000,"xyz":[-167.836,398.000,-74.240]}},{"noteOn":{"time":102.215,"note":93.000,"xyz":[468.469,206.000,99.657]}},{"noteOn":{"time":102.445,"note":101.000,"xyz":[124.252,302.000,-398.682]}},{"noteOn":{"time":102.510,"note":99.000,"xyz":[75.142,278.000,7.116]}},{"noteOn":{"time":102.510,"note":103.000,"xyz":[-54.145,326.000,-195.450]}},{"noteOn":{"time":102.625,"note":89.000,"xyz":[-344.362,158.000,-18.464]}},{"noteOn":{"time":102.650,"note":103.000,"xyz":[-80.073,326.000,-236.697]}},{"noteOn":{"time":102.665,"note":96.000,"xyz":[128.326,242.000,145.145]}},{"noteOn":{"time":102.730,"note":99.000,"xyz":[294.619,278.000,-64.055]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[259.506,278.000,136.160]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[-334.171,278.000,-94.842]}},{"noteOn":{"time":102.820,"note":95.000,"xyz":[44.642,230.000,-11.952]}},{"noteOn":{"time":102.880,"note":109.000,"xyz":[-394.939,398.000,20.163]}},{"noteOn":{"time":103.165,"note":97.000,"xyz":[198.487,254.000,-224.034]}},{"noteOn":{"time":103.225,"note":96.000,"xyz":[-151.914,242.000,-186.519]}},{"noteOn":{"time":103.375,"note":105.000,"xyz":[-289.405,350.000,-70.918]}},{"noteOn":{"time":103.385,"note":97.000,"xyz":[-299.579,254.000,172.595]}},{"noteOn":{"time":103.385,"note":89.000,"xyz":[-232.780,158.000,-228.727]}},{"noteOn":{"time":103.390,"note":103.000,"xyz":[1.201,326.000,31.126]}},{"noteOn":{"time":103.430,"note":97.000,"xyz":[-220.438,254.000,203.399]}},{"noteOn":{"time":103.475,"note":103.000,"xyz":[135.184,326.000,224.474]}},{"noteOn":{"time":103.475,"note":101.000,"xyz":[-84.920,302.000,-173.766]}},{"noteOn":{"time":103.495,"note":101.000,"xyz":[-159.330,302.000,-410.542]}},{"noteOn":{"time":103.640,"note":109.000,"xyz":[-15.813,398.000,470.051]}},{"noteOn":{"time":103.715,"note":95.000,"xyz":[18.837,230.000,250.239]}},{"noteOn":{"time":103.780,"note":107.000,"xyz":[10.557,374.000,-112.437]}},{"noteOn":{"time":103.910,"note":99.000,"xyz":[221.143,278.000,280.110]}},{"noteOn":{"time":103.950,"note":107.000,"xyz":[-167.813,374.000,110.593]}},{"noteOn":{"time":103.975,"note":105.000,"xyz":[40.866,350.000,108.675]}},{"noteOn":{"time":104.080,"note":94.000,"xyz":[11.460,218.000,-373.790]}},{"noteOn":{"time":104.125,"note":95.000,"xyz":[-377.490,230.000,-221.092]}},{"noteOn":{"time":104.165,"note":107.000,"xyz":[-57.244,374.000,19.598]}},{"noteOn":{"time":104.245,"note":103.000,"xyz":[117.127,326.000,77.726]}},{"noteOn":{"time":104.265,"note":95.000,"xyz":[-243.224,230.000,125.389]}},{"noteOn":{"time":104.325,"note":97.000,"xyz":[341.043,254.000,338.543]}},{"noteOn":{"time":104.420,"note":105.000,"xyz":[-45.756,350.000,-219.283]}},{"noteOn":{"time":104.655,"note":98.000,"xyz":[-183.085,266.000,-112.386]}},{"noteOn":{"time":104.670,"note":100.000,"xyz":[3.507,290.000,-15.490]}},{"noteOn":{"time":104.680,"note":105.000,"xyz":[-296.409,350.000,-226.394]}},{"noteOn":{"time":104.795,"note":89.000,"xyz":[26.256,158.000,156.507]}},{"noteOn":{"time":104.810,"note":101.000,"xyz":[-173.450,302.000,71.029]}},{"noteOn":{"time":104.855,"note":102.000,"xyz":[207.417,314.000,387.066]}},{"noteOn":{"time":104.920,"note":97.000,"xyz":[-33.147,254.000,-55.693]}},{"noteOn":{"time":104.935,"note":97.000,"xyz":[68.853,254.000,-217.378]}},{"noteOn":{"time":104.955,"note":105.000,"xyz":[445.649,350.000,46.762]}},{"noteOn":{"time":105.205,"note":95.000,"xyz":[-26.772,230.000,-43.186]}},{"noteOn":{"time":105.215,"note":102.000,"xyz":[138.897,314.000,-3.050]}},{"noteOn":{"time":105.230,"note":93.000,"xyz":[13.416,206.000,-3.185]}},{"noteOn":{"time":105.270,"note":103.000,"xyz":[374.147,326.000,-70.779]}},{"noteOn":{"time":105.360,"note":96.000,"xyz":[-351.014,242.000,-277.889]}},{"noteOn":{"time":105.445,"note":97.000,"xyz":[-149.829,254.000,-93.643]}},{"noteOn":{"time":105.485,"note":107.000,"xyz":[229.070,374.000,115.408]}},{"noteOn":{"time":105.500,"note":103.000,"xyz":[-236.806,326.000,362.586]}},{"noteOn":{"time":105.545,"note":103.000,"xyz":[73.455,326.000,-381.554]}},{"noteOn":{"time":105.585,"note":91.000,"xyz":[-32.187,182.000,226.817]}},{"noteOn":{"time":105.670,"note":102.000,"xyz":[337.059,314.000,326.039]}},{"noteOn":{"time":105.895,"note":99.000,"xyz":[51.680,278.000,-193.033]}},{"noteOn":{"time":105.905,"note":95.000,"xyz":[-119.280,230.000,-304.155]}},{"noteOn":{"time":105.910,"note":108.000,"xyz":[187.038,386.000,-294.696]}},{"noteOn":{"time":105.945,"note":95.000,"xyz":[365.588,230.000,61.544]}},{"noteOn":{"time":106.105,"note":99.000,"xyz":[-12.730,278.000,-6.125]}},{"noteOn":{"time":106.160,"note":100.000,"xyz":[-100.813,290.000,400.679]}},{"noteOn":{"time":106.170,"note":92.000,"xyz":[-123.349,194.000,218.279]}},{"noteOn":{"time":106.240,"note":94.000,"xyz":[67.280,218.000,-437.108]}},{"noteOn":{"time":106.385,"note":96.000,"xyz":[-189.661,242.000,-1.214]}},{"noteOn":{"time":106.430,"note":97.000,"xyz":[19.481,254.000,52.318]}},{"noteOn":{"time":106.445,"note":105.000,"xyz":[35.550,350.000,286.919]}},{"noteOn":{"time":106.480,"note":100.000,"xyz":[12.815,290.000,8.457]}},{"noteOn":{"time":106.480,"note":110.000,"xyz":[165.803,410.000,28.993]}},{"noteOn":{"time":106.490,"note":101.000,"xyz":[-252.973,302.000,-53.929]}},{"noteOn":{"time":106.570,"note":94.000,"xyz":[64.259,218.000,59.087]}},{"noteOn":{"time":106.715,"note":94.000,"xyz":[-82.168,218.000,-416.587]}},{"noteOn":{"time":106.855,"note":102.000,"xyz":[273.629,314.000,-356.796]}},{"noteOn":{"time":106.900,"note":101.000,"xyz":[-90.204,302.000,-62.689]}},{"noteOn":{"time":106.980,"note":103.000,"xyz":[-193.740,326.000,-151.486]}},{"noteOn":{"time":107.030,"note":112.000,"xyz":[383.138,434.000,143.324]}},{"noteOn":{"time":107.085,"note":97.000,"xyz":[300.577,254.000,-121.434]}},{"noteOn":{"time":107.090,"note":88.000,"xyz":[74.757,146.000,-361.865]}},{"noteOn":{"time":107.145,"note":98.000,"xyz":[-219.139,266.000,1.906]}},{"noteOn":{"time":107.155,"note":98.000,"xyz":[-19.383,266.000,7.495]}},{"noteOn":{"time":107.185,"note":104.000,"xyz":[-26.170,338.000,-1.286]}},{"noteOn":{"time":107.190,"note":100.000,"xyz":[-30.089,290.000,284.655]}},{"noteOn":{"time":107.260,"note":100.000,"xyz":[4.453,290.000,36.414]}},{"noteOn":{"time":107.275,"note":94.000,"xyz":[-227.821,218.000,421.968]}},{"noteOn":{"time":107.590,"note":98.000,"xyz":[-8.224,266.000,-77.597]}},{"noteOn":{"time":107.660,"note":95.000,"xyz":[-343.664,230.000,8.427]}},{"noteOn":{"time":107.675,"note":96.000,"xyz":[168.046,242.000,115.741]}},{"noteOn":{"time":107.750,"note":96.000,"xyz":[-8.140,242.000,9.667]}},{"noteOn":{"time":107.795,"note":98.000,"xyz":[166.622,266.000,-117.939]}},{"noteOn":{"time":107.865,"note":110.000,"xyz":[258.214,410.000,172.226]}},{"noteOn":{"time":107.915,"note":103.000,"xyz":[-219.844,326.000,47.966]}},{"noteOn":{"time":107.930,"note":90.000,"xyz":[147.019,170.000,278.020]}},{"noteOn":{"time":107.935,"note":106.000,"xyz":[309.338,362.000,72.436]}},{"noteOn":{"time":107.955,"note":102.000,"xyz":[13.936,314.000,51.035]}},{"noteOn":{"time":108.025,"note":108.000,"xyz":[-135.804,386.000,276.144]}},{"noteOn":{"time":108.100,"note":108.000,"xyz":[238.066,386.000,395.485]}},{"noteOn":{"time":108.215,"note":94.000,"xyz":[-90.926,218.000,199.532]}},{"noteOn":{"time":108.250,"note":102.000,"xyz":[-163.476,314.000,150.903]}},{"noteOn":{"time":108.370,"note":100.000,"xyz":[384.794,290.000,254.364]}},{"noteOn":{"time":108.500,"note":93.000,"xyz":[-116.486,206.000,-99.211]}},{"noteOn":{"time":108.510,"note":106.000,"xyz":[-212.966,362.000,150.379]}},{"noteOn":{"time":108.515,"note":102.000,"xyz":[-26.726,314.000,-35.330]}},{"noteOn":{"time":108.545,"note":96.000,"xyz":[270.653,242.000,-120.712]}},{"noteOn":{"time":108.670,"note":106.000,"xyz":[125.502,362.000,315.237]}},{"noteOn":{"time":108.710,"note":94.000,"xyz":[362.589,218.000,2.103]}},{"noteOn":{"time":108.710,"note":106.000,"xyz":[42.200,362.000,-21.082]}},{"noteOn":{"time":108.775,"note":106.000,"xyz":[-442.986,362.000,167.693]}},{"noteOn":{"time":108.810,"note":104.000,"xyz":[-400.805,338.000,64.389]}},{"noteOn":{"time":108.910,"note":96.000,"xyz":[-166.775,242.000,349.009]}},{"noteOn":{"time":109.055,"note":104.000,"xyz":[109.840,338.000,-200.328]}},{"noteOn":{"time":109.130,"note":98.000,"xyz":[-362.253,266.000,117.668]}},{"noteOn":{"time":109.175,"note":104.000,"xyz":[42.745,338.000,-178.240]}},{"noteOn":{"time":109.180,"note":100.000,"xyz":[193.158,290.000,-461.000]}},{"noteOn":{"time":109.205,"note":90.000,"xyz":[-4.982,170.000,-242.794]}},{"noteOn":{"time":109.250,"note":103.000,"xyz":[-217.359,326.000,5.097]}},{"noteOn":{"time":109.385,"note":96.000,"xyz":[164.855,242.000,131.105]}},{"noteOn":{"time":109.495,"note":98.000,"xyz":[-285.642,266.000,-28.871]}},{"noteOn":{"time":109.520,"note":104.000,"xyz":[-208.613,338.000,273.422]}},{"noteOn":{"time":109.525,"note":106.000,"xyz":[-320.542,362.000,-24.201]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[85.153,314.000,280.519]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[167.613,314.000,464.108]}},{"noteOn":{"time":109.715,"note":101.000,"xyz":[-426.378,302.000,89.071]}},{"noteOn":{"time":109.715,"note":94.000,"xyz":[-176.407,218.000,34.723]}},{"noteOn":{"time":109.750,"note":106.000,"xyz":[8.244,362.000,-2.797]}},{"noteOn":{"time":109.890,"note":96.000,"xyz":[399.445,242.000,-98.619]}},{"noteOn":{"time":109.950,"note":92.000,"xyz":[161.690,194.000,-124.005]}},{"noteOn":{"time":110.045,"note":98.000,"xyz":[173.029,266.000,-64.353]}},{"noteOn":{"time":110.045,"note":108.000,"xyz":[-439.567,386.000,-116.053]}},{"noteOn":{"time":110.070,"note":94.000,"xyz":[6.068,218.000,31.518]}},{"noteOn":{"time":110.085,"note":101.000,"xyz":[-342.087,302.000,260.298]}},{"noteOn":{"time":110.155,"note":104.000,"xyz":[-30.923,338.000,342.687]}},{"noteOn":{"time":110.185,"note":102.000,"xyz":[155.518,314.000,49.246]}},{"noteOn":{"time":110.265,"note":108.000,"xyz":[-203.423,386.000,-106.022]}},{"noteOn":{"time":110.335,"note":96.000,"xyz":[-92.174,242.000,-203.029]}},{"noteOn":{"time":110.380,"note":100.000,"xyz":[127.566,290.000,224.866]}},{"noteOn":{"time":110.580,"note":104.000,"xyz":[93.580,338.000,-169.917]}},{"noteOn":{"time":110.685,"note":93.000,"xyz":[-341.810,206.000,-120.698]}},{"noteOn":{"time":110.700,"note":96.000,"xyz":[-0.277,242.000,-2.877]}},{"noteOn":{"time":110.705,"note":100.000,"xyz":[99.369,290.000,-291.045]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-84.970,290.000,62.384]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[236.399,290.000,-167.233]}},{"noteOn":{"time":110.795,"note":96.000,"xyz":[-228.976,242.000,-24.646]}},{"noteOn":{"time":110.825,"note":93.000,"xyz":[50.019,206.000,-115.839]}},{"noteOn":{"time":110.850,"note":104.000,"xyz":[-14.287,338.000,59.914]}},{"noteOn":{"time":110.895,"note":98.000,"xyz":[-331.091,266.000,-287.875]}},{"noteOn":{"time":110.935,"note":100.000,"xyz":[-316.056,290.000,356.832]}},{"noteOn":{"time":111.010,"note":95.000,"xyz":[-1.021,230.000,-54.252]}},{"noteOn":{"time":111.090,"note":110.000,"xyz":[7.228,410.000,5.392]}},{"noteOn":{"time":111.215,"note":95.000,"xyz":[-179.362,230.000,-72.364]}},{"noteOn":{"time":111.295,"note":102.000,"xyz":[57.268,314.000,-8.848]}},{"noteOn":{"time":111.330,"note":102.000,"xyz":[-304.042,314.000,243.244]}},{"noteOn":{"time":111.345,"note":101.000,"xyz":[-306.970,302.000,-331.355]}},{"noteOn":{"time":111.440,"note":98.000,"xyz":[-449.733,266.000,-110.365]}},{"noteOn":{"time":111.525,"note":97.000,"xyz":[-53.960,254.000,-64.037]}},{"noteOn":{"time":111.535,"note":98.000,"xyz":[182.308,266.000,-339.057]}},{"noteOn":{"time":111.565,"note":100.000,"xyz":[-371.964,290.000,331.055]}},{"noteOn":{"time":111.575,"note":102.000,"xyz":[-6.770,314.000,-467.354]}},{"noteOn":{"time":111.630,"note":88.000,"xyz":[311.495,146.000,-269.492]}},{"noteOn":{"time":111.715,"note":103.000,"xyz":[49.112,326.000,30.515]}},{"noteOn":{"time":111.735,"note":93.000,"xyz":[422.206,206.000,164.967]}},{"noteOn":{"time":111.900,"note":112.000,"xyz":[2.200,434.000,343.067]}},{"noteOn":{"time":111.970,"note":107.000,"xyz":[-86.306,374.000,-33.385]}},{"noteOn":{"time":112.055,"note":101.000,"xyz":[3.148,302.000,-9.208]}},{"noteOn":{"time":112.105,"note":96.000,"xyz":[-17.630,242.000,390.143]}},{"noteOn":{"time":112.120,"note":95.000,"xyz":[-83.243,230.000,-339.718]}},{"noteOn":{"time":112.165,"note":98.000,"xyz":[-18.376,266.000,-24.826]}},{"noteOn":{"time":112.190,"note":95.000,"xyz":[-61.986,230.000,53.792]}},{"noteOn":{"time":112.190,"note":107.000,"xyz":[-220.815,374.000,-44.750]}},{"noteOn":{"time":112.265,"note":99.000,"xyz":[48.990,278.000,-15.123]}},{"noteOn":{"time":112.320,"note":104.000,"xyz":[-207.721,338.000,111.121]}},{"noteOn":{"time":112.385,"note":107.000,"xyz":[-190.498,374.000,207.535]}},{"noteOn":{"time":112.410,"note":109.000,"xyz":[378.350,398.000,-265.841]}},{"noteOn":{"time":112.430,"note":101.000,"xyz":[129.910,302.000,-455.368]}},{"noteOn":{"time":112.550,"note":91.000,"xyz":[88.728,182.000,-68.622]}},{"noteOn":{"time":112.645,"note":105.000,"xyz":[53.573,350.000,-17.691]}},{"noteOn":{"time":112.715,"note":93.000,"xyz":[-28.418,206.000,-407.883]}},{"noteOn":{"time":112.815,"note":103.000,"xyz":[2.118,326.000,-390.230]}},{"noteOn":{"time":112.880,"note":101.000,"xyz":[-127.349,302.000,385.720]}},{"noteOn":{"time":112.935,"note":92.000,"xyz":[-102.731,194.000,-28.836]}},{"noteOn":{"time":112.970,"note":97.000,"xyz":[214.678,254.000,-136.895]}},{"noteOn":{"time":113.000,"note":102.000,"xyz":[-227.066,314.000,407.046]}},{"noteOn":{"time":113.030,"note":95.000,"xyz":[-1.257,230.000,-35.820]}},{"noteOn":{"time":113.035,"note":105.000,"xyz":[-51.179,350.000,-44.348]}},{"noteOn":{"time":113.110,"note":106.000,"xyz":[70.434,362.000,22.200]}},{"noteOn":{"time":113.160,"note":105.000,"xyz":[-163.706,350.000,-49.668]}},{"noteOn":{"time":113.170,"note":107.000,"xyz":[-135.776,374.000,-38.310]}},{"noteOn":{"time":113.270,"note":105.000,"xyz":[291.263,350.000,393.698]}},{"noteOn":{"time":113.360,"note":103.000,"xyz":[-258.035,326.000,308.261]}},{"noteOn":{"time":113.455,"note":95.000,"xyz":[417.991,230.000,158.869]}},{"noteOn":{"time":113.575,"note":105.000,"xyz":[352.152,350.000,51.958]}},{"noteOn":{"time":113.610,"note":99.000,"xyz":[-20.827,278.000,-204.127]}},{"noteOn":{"time":113.665,"note":102.000,"xyz":[109.503,314.000,-149.724]}},{"noteOn":{"time":113.675,"note":91.000,"xyz":[-58.778,182.000,278.236]}},{"noteOn":{"time":113.690,"note":101.000,"xyz":[371.472,302.000,-77.026]}},{"noteOn":{"time":113.775,"note":107.000,"xyz":[208.979,374.000,147.022]}},{"noteOn":{"time":113.790,"note":97.000,"xyz":[-2.276,254.000,-1.536]}},{"noteOn":{"time":113.940,"note":99.000,"xyz":[-433.436,278.000,-57.267]}},{"noteOn":{"time":113.945,"note":109.000,"xyz":[-73.426,398.000,-41.416]}},{"noteOn":{"time":113.960,"note":103.000,"xyz":[-22.705,326.000,-224.937]}},{"noteOn":{"time":114.025,"note":101.000,"xyz":[-78.118,302.000,86.205]}},{"noteOn":{"time":114.070,"note":103.000,"xyz":[-179.492,326.000,69.819]}},{"noteOn":{"time":114.175,"note":93.000,"xyz":[-6.591,206.000,11.898]}},{"noteOn":{"time":114.215,"note":101.000,"xyz":[-129.394,302.000,-386.863]}},{"noteOn":{"time":114.375,"note":93.000,"xyz":[6.677,206.000,2.217]}},{"noteOn":{"time":114.380,"note":95.000,"xyz":[163.502,230.000,-50.968]}},{"noteOn":{"time":114.425,"note":95.000,"xyz":[-197.694,230.000,-140.923]}},{"noteOn":{"time":114.510,"note":99.000,"xyz":[136.297,278.000,-349.744]}},{"noteOn":{"time":114.525,"note":100.000,"xyz":[173.777,290.000,-34.865]}},{"noteOn":{"time":114.625,"note":103.000,"xyz":[51.967,326.000,-312.563]}},{"noteOn":{"time":114.640,"note":99.000,"xyz":[24.769,278.000,-204.677]}},{"noteOn":{"time":114.670,"note":101.000,"xyz":[-160.115,302.000,-26.743]}},{"noteOn":{"time":114.720,"note":97.000,"xyz":[-141.394,254.000,50.083]}},{"noteOn":{"time":114.750,"note":101.000,"xyz":[-224.265,302.000,-223.010]}},{"noteOn":{"time":114.780,"note":105.000,"xyz":[-210.598,350.000,20.896]}},{"noteOn":{"time":114.895,"note":109.000,"xyz":[346.869,398.000,114.517]}},{"noteOn":{"time":114.925,"note":97.000,"xyz":[164.425,254.000,-90.448]}},{"noteOn":{"time":115.195,"note":93.000,"xyz":[301.717,206.000,-152.853]}},{"noteOn":{"time":115.260,"note":103.000,"xyz":[0.860,326.000,-4.536]}},{"noteOn":{"time":115.265,"note":95.000,"xyz":[-72.773,230.000,-95.285]}},{"noteOn":{"time":115.355,"note":99.000,"xyz":[241.811,278.000,-327.139]}},{"noteOn":{"time":115.380,"note":101.000,"xyz":[17.969,302.000,100.171]}},{"noteOn":{"time":115.385,"note":99.000,"xyz":[337.612,278.000,-76.689]}},{"noteOn":{"time":115.390,"note":101.000,"xyz":[-2.135,302.000,-7.601]}},{"noteOn":{"time":115.410,"note":93.000,"xyz":[-72.486,206.000,-9.183]}},{"noteOn":{"time":115.470,"note":96.000,"xyz":[229.389,242.000,-326.969]}},{"noteOn":{"time":115.590,"note":101.000,"xyz":[-160.650,302.000,152.531]}},{"noteOn":{"time":115.610,"note":99.000,"xyz":[-99.188,278.000,-44.782]}},{"noteOn":{"time":115.700,"note":99.000,"xyz":[-153.741,278.000,457.792]}},{"noteOn":{"time":115.715,"note":96.000,"xyz":[-296.208,242.000,178.924]}},{"noteOn":{"time":115.815,"note":109.000,"xyz":[-337.425,398.000,182.294]}},{"noteOn":{"time":115.895,"note":103.000,"xyz":[-2.951,326.000,-1.911]}},{"noteOn":{"time":116.005,"note":98.000,"xyz":[-491.170,266.000,48.598]}},{"noteOn":{"time":116.040,"note":97.000,"xyz":[-38.859,254.000,213.351]}},{"noteOn":{"time":116.045,"note":107.000,"xyz":[22.860,374.000,-107.742]}},{"noteOn":{"time":116.160,"note":97.000,"xyz":[-174.378,254.000,-20.350]}},{"noteOn":{"time":116.175,"note":89.000,"xyz":[326.776,158.000,-67.004]}},{"noteOn":{"time":116.175,"note":101.000,"xyz":[265.305,302.000,300.406]}},{"noteOn":{"time":116.215,"note":97.000,"xyz":[-120.434,254.000,-34.904]}},{"noteOn":{"time":116.250,"note":103.000,"xyz":[-141.044,326.000,-363.738]}},{"noteOn":{"time":116.250,"note":93.000,"xyz":[-8.187,206.000,-6.940]}},{"noteOn":{"time":116.510,"note":111.000,"xyz":[86.769,422.000,-39.573]}},{"noteOn":{"time":116.525,"note":101.000,"xyz":[295.532,302.000,89.021]}},{"noteOn":{"time":116.550,"note":95.000,"xyz":[83.556,230.000,219.498]}},{"noteOn":{"time":116.625,"note":94.000,"xyz":[-209.102,218.000,51.903]}},{"noteOn":{"time":116.700,"note":94.000,"xyz":[361.343,218.000,332.491]}},{"noteOn":{"time":116.730,"note":107.000,"xyz":[351.943,374.000,195.086]}},{"noteOn":{"time":116.730,"note":105.000,"xyz":[-97.822,350.000,109.328]}},{"noteOn":{"time":116.820,"note":99.000,"xyz":[224.288,278.000,-149.552]}},{"noteOn":{"time":116.910,"note":100.000,"xyz":[-326.046,290.000,-132.794]}},{"noteOn":{"time":116.945,"note":107.000,"xyz":[61.715,374.000,46.340]}},{"noteOn":{"time":116.965,"note":103.000,"xyz":[-300.618,326.000,223.994]}},{"noteOn":{"time":117.005,"note":104.000,"xyz":[270.476,338.000,0.095]}},{"noteOn":{"time":117.030,"note":104.000,"xyz":[466.162,338.000,-49.220]}},{"noteOn":{"time":117.170,"note":91.000,"xyz":[286.166,182.000,-157.020]}},{"noteOn":{"time":117.215,"note":92.000,"xyz":[419.482,194.000,-149.980]}},{"noteOn":{"time":117.325,"note":109.000,"xyz":[-226.013,398.000,-59.637]}},{"noteOn":{"time":117.350,"note":95.000,"xyz":[90.188,230.000,-117.110]}},{"noteOn":{"time":117.420,"note":92.000,"xyz":[-303.078,194.000,28.870]}},{"noteOn":{"time":117.425,"note":98.000,"xyz":[-163.247,266.000,275.443]}},{"noteOn":{"time":117.480,"note":105.000,"xyz":[107.821,350.000,90.706]}},{"noteOn":{"time":117.485,"note":100.000,"xyz":[-346.282,290.000,-315.805]}},{"noteOn":{"time":117.545,"note":104.000,"xyz":[-233.030,338.000,-208.801]}},{"noteOn":{"time":117.705,"note":107.000,"xyz":[29.455,374.000,70.276]}},{"noteOn":{"time":117.735,"note":102.000,"xyz":[408.229,314.000,141.067]}},{"noteOn":{"time":117.765,"note":108.000,"xyz":[202.565,386.000,-78.412]}},{"noteOn":{"time":117.905,"note":105.000,"xyz":[-298.039,350.000,78.312]}},{"noteOn":{"time":117.995,"note":95.000,"xyz":[-22.275,230.000,-43.177]}},{"noteOn":{"time":118.020,"note":105.000,"xyz":[1.019,350.000,112.471]}},{"noteOn":{"time":118.120,"note":100.000,"xyz":[-450.355,290.000,143.412]}},{"noteOn":{"time":118.125,"note":101.000,"xyz":[317.058,302.000,233.558]}},{"noteOn":{"time":118.200,"note":96.000,"xyz":[-0.094,242.000,-8.180]}},{"noteOn":{"time":118.205,"note":102.000,"xyz":[-232.434,314.000,90.152]}},{"noteOn":{"time":118.210,"note":97.000,"xyz":[4.859,254.000,15.018]}},{"noteOn":{"time":118.230,"note":92.000,"xyz":[-315.775,194.000,253.575]}},{"noteOn":{"time":118.235,"note":104.000,"xyz":[63.480,338.000,14.467]}},{"noteOn":{"time":118.295,"note":102.000,"xyz":[-282.919,314.000,-75.723]}},{"noteOn":{"time":118.425,"note":100.000,"xyz":[-278.387,290.000,24.670]}},{"noteOn":{"time":118.605,"note":108.000,"xyz":[307.395,386.000,23.060]}},{"noteOn":{"time":118.640,"note":92.000,"xyz":[103.355,194.000,69.371]}},{"noteOn":{"time":118.655,"note":100.000,"xyz":[-203.750,290.000,-127.717]}},{"noteOn":{"time":118.710,"note":110.000,"xyz":[93.658,410.000,-245.546]}},{"noteOn":{"time":118.710,"note":100.000,"xyz":[-269.957,290.000,14.940]}},{"noteOn":{"time":118.750,"note":98.000,"xyz":[334.711,266.000,4.717]}},{"noteOn":{"time":118.890,"note":94.000,"xyz":[184.914,218.000,-261.527]}},{"noteOn":{"time":118.990,"note":94.000,"xyz":[93.548,218.000,-367.407]}},{"noteOn":{"time":119.000,"note":102.000,"xyz":[-40.816,314.000,370.653]}},{"noteOn":{"time":119.005,"note":99.000,"xyz":[-35.986,278.000,97.434]}},{"noteOn":{"time":119.135,"note":102.000,"xyz":[480.353,314.000,-28.725]}},{"noteOn":{"time":119.165,"note":106.000,"xyz":[184.965,362.000,-355.186]}},{"noteOn":{"time":119.175,"note":98.000,"xyz":[38.336,266.000,63.174]}},{"noteOn":{"time":119.175,"note":99.000,"xyz":[-39.520,278.000,367.082]}},{"noteOn":{"time":119.205,"note":100.000,"xyz":[-70.103,290.000,-73.000]}},{"noteOn":{"time":119.440,"note":98.000,"xyz":[-83.710,266.000,223.171]}},{"noteOn":{"time":119.525,"note":112.000,"xyz":[137.813,434.000,1.094]}},{"noteOn":{"time":119.530,"note":110.000,"xyz":[-363.561,410.000,279.877]}},{"noteOn":{"time":119.565,"note":100.000,"xyz":[431.288,290.000,-123.824]}},{"noteOn":{"time":119.705,"note":94.000,"xyz":[-36.701,218.000,449.018]}},{"noteOn":{"time":119.745,"note":102.000,"xyz":[156.391,314.000,366.435]}},{"noteOn":{"time":119.780,"note":100.000,"xyz":[408.169,290.000,228.102]}},{"noteOn":{"time":119.825,"note":94.000,"xyz":[12.661,218.000,-79.356]}},{"noteOn":{"time":119.865,"note":98.000,"xyz":[414.142,266.000,252.070]}},{"noteOn":{"time":119.890,"note":100.000,"xyz":[-163.953,290.000,271.715]}},{"noteOn":{"time":119.945,"note":92.000,"xyz":[-111.462,194.000,208.425]}},{"noteOn":{"time":119.965,"note":102.000,"xyz":[163.260,314.000,-397.624]}},{"noteOn":{"time":119.975,"note":97.000,"xyz":[-42.559,254.000,279.120]}},{"noteOn":{"time":120.015,"note":96.000,"xyz":[-443.809,242.000,-4.681]}},{"noteOn":{"time":120.115,"note":98.000,"xyz":[-95.726,266.000,70.673]}},{"noteOn":{"time":120.195,"note":108.000,"xyz":[-44.858,386.000,-1.837]}},{"noteOn":{"time":120.210,"note":96.000,"xyz":[7.050,242.000,2.989]}},{"noteOn":{"time":120.335,"note":112.000,"xyz":[3.916,434.000,-10.697]}},{"noteOn":{"time":120.415,"note":102.000,"xyz":[-360.420,314.000,50.694]}},{"noteOn":{"time":120.530,"note":99.000,"xyz":[434.166,278.000,-168.281]}},{"noteOn":{"time":120.535,"note":110.000,"xyz":[-280.626,410.000,-46.581]}},{"noteOn":{"time":120.580,"note":104.000,"xyz":[-2.765,338.000,3.691]}},{"noteOn":{"time":120.645,"note":100.000,"xyz":[16.809,290.000,-51.413]}},{"noteOn":{"time":120.675,"note":104.000,"xyz":[189.651,338.000,413.287]}},{"noteOn":{"time":120.675,"note":96.000,"xyz":[82.965,242.000,-441.678]}},{"noteOn":{"time":120.725,"note":102.000,"xyz":[165.033,314.000,-104.847]}},{"noteOn":{"time":120.740,"note":102.000,"xyz":[-30.780,314.000,-162.404]}},{"noteOn":{"time":120.785,"note":90.000,"xyz":[-311.383,170.000,-93.231]}},{"noteOn":{"time":120.785,"note":98.000,"xyz":[154.550,266.000,417.793]}},{"noteOn":{"time":120.800,"note":92.000,"xyz":[-195.892,194.000,122.259]}},{"noteOn":{"time":121.050,"note":104.000,"xyz":[363.687,338.000,282.656]}},{"noteOn":{"time":121.115,"note":94.000,"xyz":[144.970,218.000,-275.185]}},{"noteOn":{"time":121.170,"note":93.000,"xyz":[-45.094,206.000,117.054]}},{"noteOn":{"time":121.210,"note":93.000,"xyz":[-5.736,206.000,-3.544]}},{"noteOn":{"time":121.275,"note":106.000,"xyz":[18.713,362.000,6.744]}},{"noteOn":{"time":121.280,"note":104.000,"xyz":[6.085,338.000,-6.235]}},{"noteOn":{"time":121.330,"note":100.000,"xyz":[326.229,290.000,-93.547]}},{"noteOn":{"time":121.365,"note":106.000,"xyz":[-168.912,362.000,-60.655]}},{"noteOn":{"time":121.405,"note":108.000,"xyz":[278.041,386.000,217.078]}},{"noteOn":{"time":121.415,"note":100.000,"xyz":[-8.450,290.000,-45.238]}},{"noteOn":{"time":121.425,"note":106.000,"xyz":[30.519,362.000,323.398]}},{"noteOn":{"time":121.490,"note":104.000,"xyz":[295.569,338.000,14.782]}},{"noteOn":{"time":121.575,"note":106.000,"xyz":[-180.994,362.000,46.409]}},{"noteOn":{"time":121.710,"note":91.000,"xyz":[-164.606,182.000,231.583]}},{"noteOn":{"time":121.715,"note":92.000,"xyz":[14.424,194.000,-5.752]}},{"noteOn":{"time":121.785,"note":106.000,"xyz":[-131.986,362.000,-6.343]}},{"noteOn":{"time":121.795,"note":96.000,"xyz":[-87.790,242.000,-22.140]}},{"noteOn":{"time":121.905,"note":99.000,"xyz":[-349.277,278.000,286.542]}},{"noteOn":{"time":121.915,"note":96.000,"xyz":[-25.227,242.000,31.847]}},{"noteOn":{"time":121.945,"note":91.000,"xyz":[371.090,182.000,-296.530]}},{"noteOn":{"time":122.115,"note":108.000,"xyz":[218.567,386.000,180.388]}},{"noteOn":{"time":122.115,"note":104.000,"xyz":[107.184,338.000,234.460]}},{"noteOn":{"time":122.125,"note":100.000,"xyz":[254.542,290.000,150.619]}},{"noteOn":{"time":122.165,"note":104.000,"xyz":[173.485,338.000,-109.420]}},{"noteOn":{"time":122.235,"note":104.000,"xyz":[-62.970,338.000,5.158]}},{"noteOn":{"time":122.390,"note":106.000,"xyz":[43.718,362.000,136.564]}},{"noteOn":{"time":122.450,"note":102.000,"xyz":[87.186,314.000,8.040]}},{"noteOn":{"time":122.460,"note":94.000,"xyz":[128.238,218.000,-44.431]}},{"noteOn":{"time":122.525,"note":106.000,"xyz":[-383.826,362.000,-161.436]}},{"noteOn":{"time":122.550,"note":98.000,"xyz":[-427.844,266.000,189.045]}},{"noteOn":{"time":122.620,"note":102.000,"xyz":[482.433,314.000,-26.484]}},{"noteOn":{"time":122.630,"note":101.000,"xyz":[-234.719,302.000,31.683]}},{"noteOn":{"time":122.650,"note":101.000,"xyz":[-26.410,302.000,-6.703]}},{"noteOn":{"time":122.695,"note":104.000,"xyz":[-6.478,338.000,38.699]}},{"noteOn":{"time":122.710,"note":101.000,"xyz":[5.401,302.000,-140.108]}},{"noteOn":{"time":122.810,"note":98.000,"xyz":[-111.867,266.000,-436.038]}},{"noteOn":{"time":122.825,"note":93.000,"xyz":[-462.972,206.000,100.889]}},{"noteOn":{"time":122.870,"note":100.000,"xyz":[-8.310,290.000,17.195]}},{"noteOn":{"time":123.030,"note":92.000,"xyz":[464.696,194.000,-56.645]}},{"noteOn":{"time":123.070,"note":109.000,"xyz":[-266.353,398.000,-369.743]}},{"noteOn":{"time":123.150,"note":97.000,"xyz":[95.020,254.000,23.494]}},{"noteOn":{"time":123.215,"note":99.000,"xyz":[-334.915,278.000,194.756]}},{"noteOn":{"time":123.240,"note":104.000,"xyz":[117.374,338.000,121.108]}},{"noteOn":{"time":123.285,"note":99.000,"xyz":[-346.706,278.000,-107.568]}},{"noteOn":{"time":123.295,"note":108.000,"xyz":[66.204,386.000,-26.219]}},{"noteOn":{"time":123.435,"note":95.000,"xyz":[179.158,230.000,156.506]}},{"noteOn":{"time":123.450,"note":103.000,"xyz":[220.422,326.000,109.322]}},{"noteOn":{"time":123.535,"note":99.000,"xyz":[-55.218,278.000,-428.602]}},{"noteOn":{"time":123.545,"note":107.000,"xyz":[316.445,374.000,-242.872]}},{"noteOn":{"time":123.575,"note":93.000,"xyz":[86.021,206.000,-306.625]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[214.256,290.000,-185.543]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[46.706,290.000,-18.911]}},{"noteOn":{"time":123.645,"note":98.000,"xyz":[140.913,266.000,53.790]}},{"noteOn":{"time":123.725,"note":111.000,"xyz":[-195.696,422.000,316.472]}},{"noteOn":{"time":123.815,"note":95.000,"xyz":[300.529,230.000,157.196]}},{"noteOn":{"time":123.905,"note":109.000,"xyz":[-25.925,398.000,-306.775]}},{"noteOn":{"time":124.050,"note":113.000,"xyz":[-332.457,446.000,162.102]}},{"noteOn":{"time":124.085,"note":101.000,"xyz":[-423.092,302.000,-2.290]}},{"noteOn":{"time":124.210,"note":95.000,"xyz":[-392.818,230.000,-287.961]}},{"noteOn":{"time":124.275,"note":97.000,"xyz":[-164.216,254.000,-37.499]}},{"noteOn":{"time":124.345,"note":102.000,"xyz":[-138.635,314.000,-203.390]}},{"noteOn":{"time":124.390,"note":105.000,"xyz":[-307.746,350.000,35.333]}},{"noteOn":{"time":124.420,"note":93.000,"xyz":[-119.815,206.000,48.159]}},{"noteOn":{"time":124.430,"note":97.000,"xyz":[83.090,254.000,297.973]}},{"noteOn":{"time":124.435,"note":99.000,"xyz":[72.365,278.000,-213.109]}},{"noteOn":{"time":124.475,"note":103.000,"xyz":[59.363,326.000,366.571]}},{"noteOn":{"time":124.480,"note":93.000,"xyz":[252.222,206.000,-215.814]}},{"noteOn":{"time":124.495,"note":107.000,"xyz":[-179.697,374.000,340.044]}},{"noteOn":{"time":124.525,"note":98.000,"xyz":[266.117,266.000,-289.064]}},{"noteOn":{"time":124.585,"note":101.000,"xyz":[-6.587,302.000,-334.404]}},{"noteOn":{"time":124.715,"note":97.000,"xyz":[-14.190,254.000,-86.712]}},{"noteOn":{"time":124.765,"note":101.000,"xyz":[-18.693,302.000,38.970]}},{"noteOn":{"time":124.885,"note":111.000,"xyz":[18.915,422.000,70.921]}},{"noteOn":{"time":125.060,"note":99.000,"xyz":[36.992,278.000,41.655]}},{"noteOn":{"time":125.080,"note":103.000,"xyz":[-431.198,326.000,-212.553]}},{"noteOn":{"time":125.100,"note":100.000,"xyz":[24.632,290.000,183.908]}},{"noteOn":{"time":125.145,"note":103.000,"xyz":[-186.445,326.000,-78.613]}},{"noteOn":{"time":125.170,"note":99.000,"xyz":[-38.396,278.000,-410.991]}},{"noteOn":{"time":125.205,"note":101.000,"xyz":[366.780,302.000,-208.362]}},{"noteOn":{"time":125.210,"note":105.000,"xyz":[23.288,350.000,64.305]}},{"noteOn":{"time":125.290,"note":103.000,"xyz":[-89.933,326.000,-170.014]}},{"noteOn":{"time":125.325,"note":109.000,"xyz":[240.084,398.000,-115.855]}},{"noteOn":{"time":125.350,"note":91.000,"xyz":[176.383,182.000,40.972]}},{"noteOn":{"time":125.395,"note":95.000,"xyz":[-358.538,230.000,-295.838]}},{"noteOn":{"time":125.410,"note":91.000,"xyz":[-55.042,182.000,66.363]}},{"noteOn":{"time":125.525,"note":105.000,"xyz":[-1.825,350.000,11.937]}},{"noteOn":{"time":125.625,"note":97.000,"xyz":[83.899,254.000,-88.342]}},{"noteOn":{"time":125.710,"note":93.000,"xyz":[-36.549,206.000,-253.066]}},{"noteOn":{"time":125.755,"note":99.000,"xyz":[459.564,278.000,7.744]}},{"noteOn":{"time":125.760,"note":92.000,"xyz":[398.074,194.000,-73.590]}},{"noteOn":{"time":125.800,"note":95.000,"xyz":[133.042,230.000,27.581]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[-276.434,374.000,-290.783]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[-140.704,374.000,-24.882]}},{"noteOn":{"time":125.910,"note":105.000,"xyz":[344.132,350.000,-281.264]}},{"noteOn":{"time":125.990,"note":105.000,"xyz":[271.565,350.000,307.422]}},{"noteOn":{"time":126.010,"note":101.000,"xyz":[168.232,302.000,389.560]}},{"noteOn":{"time":126.145,"note":107.000,"xyz":[-75.344,374.000,-433.609]}},{"noteOn":{"time":126.160,"note":105.000,"xyz":[66.637,350.000,-207.112]}},{"noteOn":{"time":126.220,"note":91.000,"xyz":[-26.696,182.000,-288.689]}},{"noteOn":{"time":126.255,"note":93.000,"xyz":[106.590,206.000,4.025]}},{"noteOn":{"time":126.285,"note":105.000,"xyz":[-193.725,350.000,36.964]}},{"noteOn":{"time":126.350,"note":99.000,"xyz":[-214.907,278.000,138.825]}},{"noteOn":{"time":126.360,"note":97.000,"xyz":[-36.954,254.000,-104.003]}},{"noteOn":{"time":126.385,"note":99.000,"xyz":[244.923,278.000,-90.238]}},{"noteOn":{"time":126.445,"note":103.000,"xyz":[121.956,326.000,-36.579]}},{"noteOn":{"time":126.515,"note":92.000,"xyz":[-68.134,194.000,2.613]}},{"noteOn":{"time":126.530,"note":107.000,"xyz":[-2.773,374.000,-17.825]}},{"noteOn":{"time":126.540,"note":107.000,"xyz":[-0.480,374.000,62.092]}},{"noteOn":{"time":126.640,"note":103.000,"xyz":[-71.701,326.000,-490.307]}},{"noteOn":{"time":126.765,"note":99.000,"xyz":[123.750,278.000,30.099]}},{"noteOn":{"time":126.790,"note":103.000,"xyz":[-270.280,326.000,-300.378]}},{"noteOn":{"time":126.865,"note":97.000,"xyz":[3.028,254.000,-18.473]}},{"noteOn":{"time":126.925,"note":93.000,"xyz":[111.459,206.000,-323.533]}},{"noteOn":{"time":127.055,"note":105.000,"xyz":[237.943,350.000,26.423]}},{"noteOn":{"time":127.065,"note":101.000,"xyz":[-112.723,302.000,183.766]}},{"noteOn":{"time":127.075,"note":101.000,"xyz":[232.569,302.000,-240.700]}},{"noteOn":{"time":127.110,"note":109.000,"xyz":[-52.007,398.000,-32.555]}},{"noteOn":{"time":127.180,"note":100.000,"xyz":[276.587,290.000,166.311]}},{"noteOn":{"time":127.185,"note":101.000,"xyz":[-11.030,302.000,-8.154]}},{"noteOn":{"time":127.210,"note":100.000,"xyz":[-399.378,290.000,-297.789]}},{"noteOn":{"time":127.320,"note":109.000,"xyz":[288.840,398.000,52.280]}},{"noteOn":{"time":127.410,"note":99.000,"xyz":[242.927,278.000,112.467]}},{"noteOn":{"time":127.420,"note":93.000,"xyz":[305.425,206.000,-0.094]}},{"noteOn":{"time":127.430,"note":101.000,"xyz":[-73.703,302.000,-18.877]}},{"noteOn":{"time":127.440,"note":91.000,"xyz":[-194.851,182.000,-31.115]}},{"noteOn":{"time":127.540,"note":105.000,"xyz":[-158.122,350.000,-39.888]}},{"noteOn":{"time":127.615,"note":94.000,"xyz":[213.674,218.000,-167.304]}},{"noteOn":{"time":127.650,"note":99.000,"xyz":[-277.422,278.000,151.432]}},{"noteOn":{"time":127.725,"note":98.000,"xyz":[-246.087,266.000,-142.866]}},{"noteOn":{"time":127.745,"note":111.000,"xyz":[-259.680,422.000,-159.548]}},{"noteOn":{"time":127.915,"note":99.000,"xyz":[-92.884,278.000,106.568]}},{"noteOn":{"time":127.985,"note":103.000,"xyz":[141.573,326.000,-258.781]}},{"noteOn":{"time":127.990,"note":95.000,"xyz":[147.139,230.000,-59.600]}},{"noteOn":{"time":128.000,"note":101.000,"xyz":[24.078,302.000,-13.642]}},{"noteOn":{"time":128.105,"note":98.000,"xyz":[-67.305,266.000,92.262]}},{"noteOn":{"time":128.130,"note":99.000,"xyz":[407.315,278.000,-165.956]}},{"noteOn":{"time":128.130,"note":104.000,"xyz":[-61.058,338.000,58.101]}},{"noteOn":{"time":128.165,"note":92.000,"xyz":[5.738,194.000,14.215]}},{"noteOn":{"time":128.165,"note":103.000,"xyz":[320.780,326.000,-11.500]}},{"noteOn":{"time":128.170,"note":107.000,"xyz":[355.298,374.000,230.878]}},{"noteOn":{"time":128.210,"note":101.000,"xyz":[332.974,302.000,329.403]}},{"noteOn":{"time":128.285,"note":108.000,"xyz":[58.984,386.000,-387.649]}},{"noteOn":{"time":128.315,"note":102.000,"xyz":[-457.126,314.000,96.447]}},{"noteOn":{"time":128.530,"note":113.000,"xyz":[4.074,446.000,20.868]}},{"noteOn":{"time":128.680,"note":98.000,"xyz":[72.077,266.000,-443.128]}},{"noteOn":{"time":128.710,"note":96.000,"xyz":[116.697,242.000,486.102]}},{"noteOn":{"time":128.910,"note":102.000,"xyz":[119.627,314.000,391.045]}},{"noteOn":{"time":128.910,"note":103.000,"xyz":[148.838,326.000,-44.690]}},{"noteOn":{"time":128.940,"note":101.000,"xyz":[-397.553,302.000,32.722]}},{"noteOn":{"time":128.965,"note":92.000,"xyz":[-219.395,194.000,332.645]}},{"noteOn":{"time":128.990,"note":97.000,"xyz":[11.089,254.000,48.209]}},{"noteOn":{"time":129.000,"note":99.000,"xyz":[99.830,278.000,-484.548]}},{"noteOn":{"time":129.010,"note":94.000,"xyz":[173.700,218.000,-254.669]}},{"noteOn":{"time":129.045,"note":104.000,"xyz":[-184.502,338.000,184.685]}},{"noteOn":{"time":129.050,"note":110.000,"xyz":[-60.065,410.000,8.393]}},{"noteOn":{"time":129.095,"note":98.000,"xyz":[-24.591,266.000,59.800]}},{"noteOn":{"time":129.125,"note":106.000,"xyz":[100.243,362.000,21.405]}},{"noteOn":{"time":129.205,"note":101.000,"xyz":[168.095,302.000,-416.174]}},{"noteOn":{"time":129.225,"note":98.000,"xyz":[-54.119,266.000,42.777]}},{"noteOn":{"time":129.455,"note":98.000,"xyz":[240.146,266.000,409.888]}},{"noteOn":{"time":129.470,"note":99.000,"xyz":[-37.213,278.000,88.138]}},{"noteOn":{"time":129.570,"note":104.000,"xyz":[63.503,338.000,171.119]}},{"noteOn":{"time":129.570,"note":100.000,"xyz":[41.047,290.000,32.764]}},{"noteOn":{"time":129.685,"note":100.000,"xyz":[11.701,290.000,-8.069]}},{"noteOn":{"time":129.690,"note":101.000,"xyz":[-124.495,302.000,381.541]}},{"noteOn":{"time":129.770,"note":106.000,"xyz":[317.622,362.000,117.963]}},{"noteOn":{"time":129.845,"note":90.000,"xyz":[138.182,170.000,311.343]}},{"noteOn":{"time":129.875,"note":96.000,"xyz":[-237.301,242.000,343.127]}},{"noteOn":{"time":129.950,"note":92.000,"xyz":[128.562,194.000,207.995]}},{"noteOn":{"time":130.045,"note":106.000,"xyz":[-56.535,362.000,5.476]}},{"noteOn":{"time":130.075,"note":104.000,"xyz":[168.705,338.000,-148.107]}},{"noteOn":{"time":130.090,"note":108.000,"xyz":[333.081,386.000,-51.680]}},{"noteOn":{"time":130.190,"note":98.000,"xyz":[-18.758,266.000,-238.161]}},{"noteOn":{"time":130.205,"note":92.000,"xyz":[-298.630,194.000,290.256]}},{"noteOn":{"time":130.270,"note":100.000,"xyz":[-180.617,290.000,-240.560]}},{"noteOn":{"time":130.345,"note":104.000,"xyz":[-62.617,338.000,34.411]}},{"noteOn":{"time":130.375,"note":91.000,"xyz":[-9.530,182.000,339.054]}},{"noteOn":{"time":130.395,"note":102.000,"xyz":[120.861,314.000,57.244]}},{"noteOn":{"time":130.435,"note":104.000,"xyz":[-293.911,338.000,134.208]}},{"noteOn":{"time":130.465,"note":107.000,"xyz":[-185.037,374.000,-242.948]}},{"noteOn":{"time":130.480,"note":96.000,"xyz":[232.545,242.000,147.465]}},{"noteOn":{"time":130.555,"note":100.000,"xyz":[58.474,290.000,270.894]}},{"noteOn":{"time":130.730,"note":90.000,"xyz":[-425.736,170.000,-38.575]}},{"noteOn":{"time":130.815,"note":106.000,"xyz":[-204.261,362.000,54.957]}},{"noteOn":{"time":130.845,"note":96.000,"xyz":[273.541,242.000,-316.234]}},{"noteOn":{"time":130.860,"note":106.000,"xyz":[192.608,362.000,-71.284]}},{"noteOn":{"time":130.870,"note":100.000,"xyz":[-46.548,290.000,247.609]}},{"noteOn":{"time":130.940,"note":102.000,"xyz":[263.174,314.000,-264.460]}},{"noteOn":{"time":131.000,"note":106.000,"xyz":[126.603,362.000,-83.854]}},{"noteOn":{"time":131.015,"note":110.000,"xyz":[-203.656,410.000,-438.917]}},{"noteOn":{"time":131.015,"note":108.000,"xyz":[-27.023,386.000,68.368]}},{"noteOn":{"time":131.045,"note":98.000,"xyz":[-151.603,266.000,-12.889]}},{"noteOn":{"time":131.105,"note":93.000,"xyz":[381.161,206.000,213.442]}},{"noteOn":{"time":131.195,"note":102.000,"xyz":[-128.611,314.000,-177.286]}},{"noteOn":{"time":131.350,"note":100.000,"xyz":[-123.922,290.000,192.096]}},{"noteOn":{"time":131.355,"note":98.000,"xyz":[-167.529,266.000,123.457]}},{"noteOn":{"time":131.515,"note":112.000,"xyz":[284.137,434.000,-283.919]}},{"noteOn":{"time":131.520,"note":108.000,"xyz":[-151.698,386.000,-289.200]}},{"noteOn":{"time":131.570,"note":104.000,"xyz":[-33.762,338.000,193.747]}},{"noteOn":{"time":131.630,"note":100.000,"xyz":[-11.127,290.000,36.810]}},{"noteOn":{"time":131.685,"note":94.000,"xyz":[283.816,218.000,261.449]}},{"noteOn":{"time":131.705,"note":100.000,"xyz":[-419.669,290.000,-48.123]}},{"noteOn":{"time":131.730,"note":102.000,"xyz":[230.307,314.000,-262.169]}},{"noteOn":{"time":131.750,"note":99.000,"xyz":[498.299,278.000,0.938]}},{"noteOn":{"time":131.885,"note":102.000,"xyz":[-16.941,314.000,20.289]}},{"noteOn":{"time":131.935,"note":100.000,"xyz":[50.216,290.000,-90.730]}},{"noteOn":{"time":131.935,"note":110.000,"xyz":[5.467,410.000,-5.627]}},{"noteOn":{"time":131.965,"note":94.000,"xyz":[69.076,218.000,-416.320]}},{"noteOn":{"time":132.025,"note":98.000,"xyz":[61.841,266.000,21.868]}},{"noteOn":{"time":132.060,"note":114.000,"xyz":[43.160,458.000,-0.804]}},{"noteOn":{"time":132.065,"note":110.000,"xyz":[-55.094,410.000,18.282]}},{"noteOn":{"time":132.150,"note":102.000,"xyz":[-0.160,314.000,48.160]}},{"noteOn":{"time":132.165,"note":106.000,"xyz":[-202.628,362.000,75.161]}},{"noteOn":{"time":132.230,"note":97.000,"xyz":[-359.004,254.000,-256.020]}},{"noteOn":{"time":132.285,"note":104.000,"xyz":[-0.384,338.000,-12.877]}},{"noteOn":{"time":132.360,"note":98.000,"xyz":[-81.960,266.000,-89.786]}},{"noteOn":{"time":132.485,"note":96.000,"xyz":[-13.996,242.000,5.438]}},{"noteOn":{"time":132.535,"note":102.000,"xyz":[-31.199,314.000,489.330]}},{"noteOn":{"time":132.635,"note":100.000,"xyz":[21.916,290.000,3.611]}},{"noteOn":{"time":132.650,"note":102.000,"xyz":[-122.136,314.000,-72.607]}},{"noteOn":{"time":132.695,"note":97.000,"xyz":[-75.881,254.000,-228.903]}},{"noteOn":{"time":132.695,"note":92.000,"xyz":[107.628,194.000,-95.950]}},{"noteOn":{"time":132.755,"note":108.000,"xyz":[268.816,386.000,-385.198]}},{"noteOn":{"time":132.775,"note":104.000,"xyz":[256.640,338.000,241.599]}},{"noteOn":{"time":132.915,"note":108.000,"xyz":[95.287,386.000,35.224]}},{"noteOn":{"time":133.045,"note":104.000,"xyz":[29.004,338.000,-100.051]}},{"noteOn":{"time":133.050,"note":112.000,"xyz":[403.558,434.000,-95.930]}},{"noteOn":{"time":133.155,"note":101.000,"xyz":[94.818,302.000,-183.358]}},{"noteOn":{"time":133.205,"note":97.000,"xyz":[219.053,254.000,-434.193]}},{"noteOn":{"time":133.235,"note":104.000,"xyz":[61.465,338.000,36.798]}},{"noteOn":{"time":133.315,"note":102.000,"xyz":[-227.924,314.000,-105.262]}},{"noteOn":{"time":133.405,"note":100.000,"xyz":[80.886,290.000,131.935]}},{"noteOn":{"time":133.415,"note":92.000,"xyz":[-210.011,194.000,158.043]}},{"noteOn":{"time":133.445,"note":96.000,"xyz":[-413.613,242.000,21.760]}},{"noteOn":{"time":133.470,"note":98.000,"xyz":[105.668,266.000,-11.337]}},{"noteOn":{"time":133.490,"note":95.000,"xyz":[178.900,230.000,-158.701]}},{"noteOn":{"time":133.630,"note":106.000,"xyz":[74.963,362.000,131.866]}},{"noteOn":{"time":133.640,"note":105.000,"xyz":[42.401,350.000,28.554]}},{"noteOn":{"time":133.665,"note":99.000,"xyz":[-101.649,278.000,-23.752]}},{"noteOn":{"time":133.735,"note":99.000,"xyz":[-61.549,278.000,60.026]}},{"noteOn":{"time":133.790,"note":99.000,"xyz":[-390.182,278.000,-112.106]}},{"noteOn":{"time":133.820,"note":106.000,"xyz":[418.951,362.000,-170.186]}},{"noteOn":{"time":133.920,"note":110.000,"xyz":[113.875,410.000,-224.483]}},{"noteOn":{"time":134.065,"note":98.000,"xyz":[-25.866,266.000,-8.618]}},{"noteOn":{"time":134.105,"note":99.000,"xyz":[99.382,278.000,2.279]}},{"noteOn":{"time":134.110,"note":108.000,"xyz":[210.446,386.000,-240.507]}},{"noteOn":{"time":134.140,"note":100.000,"xyz":[318.264,290.000,85.459]}},{"noteOn":{"time":134.170,"note":96.000,"xyz":[-92.927,242.000,184.569]}},{"noteOn":{"time":134.215,"note":106.000,"xyz":[-7.321,362.000,463.392]}},{"noteOn":{"time":134.255,"note":89.000,"xyz":[-78.599,158.000,-4.560]}},{"noteOn":{"time":134.280,"note":101.000,"xyz":[-257.206,302.000,154.069]}},{"noteOn":{"time":134.450,"note":103.000,"xyz":[46.274,326.000,134.128]}},{"noteOn":{"time":134.480,"note":108.000,"xyz":[234.819,386.000,-282.737]}},{"noteOn":{"time":134.515,"note":105.000,"xyz":[-389.457,350.000,-311.612]}},{"noteOn":{"time":134.575,"note":106.000,"xyz":[-287.885,362.000,-213.801]}},{"noteOn":{"time":134.665,"note":97.000,"xyz":[209.159,254.000,-271.136]}},{"noteOn":{"time":134.690,"note":101.000,"xyz":[-105.468,302.000,-1.845]}},{"noteOn":{"time":134.690,"note":103.000,"xyz":[-343.794,326.000,-43.429]}},{"noteOn":{"time":134.705,"note":91.000,"xyz":[-215.606,182.000,331.346]}},{"noteOn":{"time":134.875,"note":108.000,"xyz":[101.373,386.000,-195.242]}},{"noteOn":{"time":134.890,"note":103.000,"xyz":[-77.943,326.000,-325.483]}},{"noteOn":{"time":134.985,"note":91.000,"xyz":[-0.957,182.000,-99.147]}},{"noteOn":{"time":135.010,"note":99.000,"xyz":[-15.659,278.000,237.767]}},{"noteOn":{"time":135.020,"note":105.000,"xyz":[-82.722,350.000,-97.718]}},{"noteOn":{"time":135.030,"note":107.000,"xyz":[-16.643,374.000,-104.119]}},{"noteOn":{"time":135.045,"note":96.000,"xyz":[-394.752,242.000,77.388]}},{"noteOn":{"time":135.195,"note":105.000,"xyz":[-188.124,350.000,50.565]}},{"noteOn":{"time":135.235,"note":91.000,"xyz":[-15.002,182.000,15.921]}},{"noteOn":{"time":135.250,"note":109.000,"xyz":[-21.011,398.000,32.528]}},{"noteOn":{"time":135.345,"note":101.000,"xyz":[-28.169,302.000,44.754]}},{"noteOn":{"time":135.350,"note":95.000,"xyz":[-14.270,230.000,17.776]}},{"noteOn":{"time":135.405,"note":101.000,"xyz":[329.607,302.000,5.751]}},{"noteOn":{"time":135.545,"note":101.000,"xyz":[50.662,302.000,-364.716]}},{"noteOn":{"time":135.595,"note":106.000,"xyz":[4.811,362.000,407.443]}},{"noteOn":{"time":135.615,"note":101.000,"xyz":[81.430,302.000,20.726]}},{"noteOn":{"time":135.695,"note":94.000,"xyz":[-125.459,218.000,-239.412]}},{"noteOn":{"time":135.730,"note":99.000,"xyz":[-154.279,278.000,3.650]}},{"noteOn":{"time":135.750,"note":99.000,"xyz":[229.969,278.000,-170.263]}},{"noteOn":{"time":135.855,"note":97.000,"xyz":[-10.499,254.000,-70.262]}},{"noteOn":{"time":135.915,"note":113.000,"xyz":[-429.106,446.000,-155.262]}},{"noteOn":{"time":136.000,"note":109.000,"xyz":[-26.129,398.000,-107.420]}},{"noteOn":{"time":136.050,"note":103.000,"xyz":[487.012,326.000,-106.880]}},{"noteOn":{"time":136.200,"note":99.000,"xyz":[-230.733,278.000,-200.436]}},{"noteOn":{"time":136.250,"note":111.000,"xyz":[-78.311,422.000,-265.992]}},{"noteOn":{"time":136.270,"note":99.000,"xyz":[-129.014,278.000,-19.596]}},{"noteOn":{"time":136.280,"note":93.000,"xyz":[-220.739,206.000,-226.843]}},{"noteOn":{"time":136.315,"note":103.000,"xyz":[215.064,326.000,-131.998]}},{"noteOn":{"time":136.315,"note":98.000,"xyz":[46.707,266.000,137.030]}},{"noteOn":{"time":136.345,"note":101.000,"xyz":[114.054,302.000,-156.006]}},{"noteOn":{"time":136.420,"note":95.000,"xyz":[-179.668,230.000,-211.260]}},{"noteOn":{"time":136.425,"note":107.000,"xyz":[-394.477,374.000,294.549]}},{"noteOn":{"time":136.445,"note":103.000,"xyz":[103.464,326.000,326.680]}},{"noteOn":{"time":136.685,"note":99.000,"xyz":[-284.834,278.000,-381.428]}},{"noteOn":{"time":136.740,"note":97.000,"xyz":[-296.897,254.000,-238.239]}},{"noteOn":{"time":136.760,"note":113.000,"xyz":[48.474,446.000,-29.133]}},{"noteOn":{"time":136.825,"note":101.000,"xyz":[-294.036,302.000,-140.801]}},{"noteOn":{"time":136.865,"note":111.000,"xyz":[53.093,422.000,-108.038]}},{"noteOn":{"time":136.880,"note":97.000,"xyz":[31.730,254.000,-326.464]}},{"noteOn":{"time":136.945,"note":97.000,"xyz":[70.763,254.000,76.751]}},{"noteOn":{"time":136.970,"note":103.000,"xyz":[-420.482,326.000,-133.948]}},{"noteOn":{"time":137.045,"note":109.000,"xyz":[-46.703,398.000,205.742]}},{"noteOn":{"time":137.130,"note":103.000,"xyz":[86.214,326.000,46.769]}},{"noteOn":{"time":137.230,"note":93.000,"xyz":[24.628,206.000,-104.799]}},{"noteOn":{"time":137.240,"note":109.000,"xyz":[179.106,398.000,30.482]}},{"noteOn":{"time":137.285,"note":96.000,"xyz":[-89.902,242.000,-160.958]}},{"noteOn":{"time":137.355,"note":105.000,"xyz":[218.359,350.000,-164.372]}},{"noteOn":{"time":137.405,"note":105.000,"xyz":[-223.755,350.000,-152.704]}},{"noteOn":{"time":137.545,"note":107.000,"xyz":[-81.800,374.000,-170.257]}},{"noteOn":{"time":137.575,"note":111.000,"xyz":[-460.221,422.000,-38.347]}},{"noteOn":{"time":137.615,"note":101.000,"xyz":[110.128,302.000,116.250]}},{"noteOn":{"time":137.635,"note":105.000,"xyz":[87.572,350.000,-23.719]}},{"noteOn":{"time":137.700,"note":97.000,"xyz":[-343.820,254.000,134.015]}},{"noteOn":{"time":137.810,"note":99.000,"xyz":[107.622,278.000,-252.039]}},{"noteOn":{"time":137.830,"note":91.000,"xyz":[-209.548,182.000,-285.459]}},{"noteOn":{"time":137.920,"note":95.000,"xyz":[-2.510,230.000,-47.931]}},{"noteOn":{"time":137.930,"note":101.000,"xyz":[40.507,302.000,-76.556]}},{"noteOn":{"time":137.965,"note":95.000,"xyz":[216.508,230.000,74.262]}},{"noteOn":{"time":138.045,"note":103.000,"xyz":[24.149,326.000,52.971]}},{"noteOn":{"time":138.170,"note":99.000,"xyz":[1.225,278.000,78.413]}},{"noteOn":{"time":138.195,"note":105.000,"xyz":[39.163,350.000,-5.103]}},{"noteOn":{"time":138.230,"note":100.000,"xyz":[-299.858,290.000,-150.960]}},{"noteOn":{"time":138.245,"note":100.000,"xyz":[-46.204,290.000,-5.093]}},{"noteOn":{"time":138.255,"note":103.000,"xyz":[-41.859,326.000,-54.777]}},{"noteOn":{"time":138.325,"note":107.000,"xyz":[52.244,374.000,-3.816]}},{"noteOn":{"time":138.350,"note":109.000,"xyz":[220.611,398.000,-193.626]}},{"noteOn":{"time":138.495,"note":97.000,"xyz":[322.126,254.000,88.849]}},{"noteOn":{"time":138.530,"note":99.000,"xyz":[73.927,278.000,-256.380]}},{"noteOn":{"time":138.535,"note":105.000,"xyz":[126.128,350.000,4.886]}},{"noteOn":{"time":138.625,"note":89.000,"xyz":[487.743,158.000,-55.919]}},{"noteOn":{"time":138.650,"note":100.000,"xyz":[-107.598,290.000,172.031]}},{"noteOn":{"time":138.660,"note":97.000,"xyz":[-93.709,254.000,-62.050]}},{"noteOn":{"time":138.725,"note":101.000,"xyz":[36.044,302.000,225.933]}},{"noteOn":{"time":138.745,"note":105.000,"xyz":[-194.162,350.000,222.395]}},{"noteOn":{"time":138.755,"note":105.000,"xyz":[-247.569,350.000,-275.969]}},{"noteOn":{"time":138.780,"note":107.000,"xyz":[98.777,374.000,65.977]}},{"noteOn":{"time":138.860,"note":107.000,"xyz":[324.181,374.000,274.772]}},{"noteOn":{"time":138.870,"note":102.000,"xyz":[135.952,314.000,-281.412]}},{"noteOn":{"time":139.055,"note":107.000,"xyz":[-153.587,374.000,177.478]}},{"noteOn":{"time":139.145,"note":96.000,"xyz":[60.149,242.000,-36.238]}},{"noteOn":{"time":139.200,"note":90.000,"xyz":[-36.373,170.000,66.430]}},{"noteOn":{"time":139.285,"note":107.000,"xyz":[226.070,374.000,-395.670]}},{"noteOn":{"time":139.365,"note":103.000,"xyz":[201.990,326.000,37.806]}},{"noteOn":{"time":139.370,"note":105.000,"xyz":[217.509,350.000,344.785]}},{"noteOn":{"time":139.395,"note":103.000,"xyz":[436.552,326.000,104.438]}},{"noteOn":{"time":139.425,"note":99.000,"xyz":[-226.996,278.000,-110.128]}},{"noteOn":{"time":139.490,"note":97.000,"xyz":[260.746,254.000,-177.833]}},{"noteOn":{"time":139.520,"note":108.000,"xyz":[157.450,386.000,281.726]}},{"noteOn":{"time":139.600,"note":92.000,"xyz":[205.752,194.000,121.141]}},{"noteOn":{"time":139.635,"note":102.000,"xyz":[459.488,314.000,70.970]}},{"noteOn":{"time":139.645,"note":103.000,"xyz":[-217.806,326.000,310.899]}},{"noteOn":{"time":139.730,"note":109.000,"xyz":[89.191,398.000,-153.488]}},{"noteOn":{"time":139.745,"note":92.000,"xyz":[60.904,194.000,-22.475]}},{"noteOn":{"time":139.765,"note":105.000,"xyz":[-160.090,350.000,166.254]}},{"noteOn":{"time":139.935,"note":102.000,"xyz":[91.312,314.000,-83.256]}},{"noteOn":{"time":140.075,"note":109.000,"xyz":[-20.872,398.000,-12.518]}},{"noteOn":{"time":140.105,"note":100.000,"xyz":[107.428,290.000,-177.039]}},{"noteOn":{"time":140.175,"note":101.000,"xyz":[-16.718,302.000,11.226]}},{"noteOn":{"time":140.195,"note":105.000,"xyz":[138.044,350.000,289.820]}},{"noteOn":{"time":140.245,"note":100.000,"xyz":[38.821,290.000,-88.649]}},{"noteOn":{"time":140.285,"note":94.000,"xyz":[-301.673,218.000,279.127]}},{"noteOn":{"time":140.295,"note":99.000,"xyz":[-344.349,278.000,-158.352]}},{"noteOn":{"time":140.310,"note":96.000,"xyz":[-29.019,242.000,-104.720]}},{"noteOn":{"time":140.385,"note":94.000,"xyz":[285.489,218.000,8.386]}},{"noteOn":{"time":140.425,"note":114.000,"xyz":[-188.136,458.000,-155.765]}},{"noteOn":{"time":140.495,"note":98.000,"xyz":[14.619,266.000,-13.084]}},{"noteOn":{"time":140.580,"note":103.000,"xyz":[-239.867,326.000,76.592]}},{"noteOn":{"time":140.690,"note":108.000,"xyz":[211.442,386.000,-88.560]}},{"noteOn":{"time":140.700,"note":98.000,"xyz":[-94.809,266.000,-42.042]}},{"noteOn":{"time":140.755,"note":101.000,"xyz":[431.399,302.000,-81.105]}},{"noteOn":{"time":140.835,"note":96.000,"xyz":[-37.005,242.000,295.014]}},{"noteOn":{"time":140.885,"note":97.000,"xyz":[-72.268,254.000,-266.248]}},{"noteOn":{"time":140.890,"note":112.000,"xyz":[104.868,434.000,18.978]}},{"noteOn":{"time":140.900,"note":104.000,"xyz":[103.783,338.000,406.612]}},{"noteOn":{"time":140.925,"note":104.000,"xyz":[106.595,338.000,78.858]}},{"noteOn":{"time":140.955,"note":98.000,"xyz":[-53.814,266.000,-199.509]}},{"noteOn":{"time":141.050,"note":110.000,"xyz":[-152.143,410.000,-144.567]}},{"noteOn":{"time":141.200,"note":112.000,"xyz":[309.931,434.000,-72.247]}},{"noteOn":{"time":141.250,"note":96.000,"xyz":[-58.906,242.000,110.960]}},{"noteOn":{"time":141.315,"note":100.000,"xyz":[164.173,290.000,143.689]}},{"noteOn":{"time":141.375,"note":94.000,"xyz":[27.359,218.000,-26.626]}},{"noteOn":{"time":141.405,"note":98.000,"xyz":[-239.350,266.000,-43.150]}},{"noteOn":{"time":141.450,"note":102.000,"xyz":[-127.208,314.000,46.167]}},{"noteOn":{"time":141.470,"note":96.000,"xyz":[196.934,242.000,233.633]}},{"noteOn":{"time":141.560,"note":108.000,"xyz":[15.442,386.000,8.557]}},{"noteOn":{"time":141.660,"note":108.000,"xyz":[280.291,386.000,-111.241]}},{"noteOn":{"time":141.725,"note":106.000,"xyz":[237.112,362.000,-183.522]}},{"noteOn":{"time":141.730,"note":103.000,"xyz":[85.577,326.000,-286.107]}},{"noteOn":{"time":141.760,"note":94.000,"xyz":[49.794,218.000,9.965]}},{"noteOn":{"time":141.820,"note":102.000,"xyz":[-237.874,314.000,-29.658]}},{"noteOn":{"time":141.875,"note":95.000,"xyz":[0.666,230.000,149.071]}},{"noteOn":{"time":141.920,"note":106.000,"xyz":[351.364,362.000,256.156]}},{"noteOn":{"time":141.990,"note":106.000,"xyz":[28.936,362.000,-68.600]}},{"noteOn":{"time":142.055,"note":110.000,"xyz":[-419.331,410.000,-25.639]}},{"noteOn":{"time":142.105,"note":106.000,"xyz":[191.367,362.000,47.337]}},{"noteOn":{"time":142.155,"note":102.000,"xyz":[-84.798,314.000,472.821]}},{"noteOn":{"time":142.200,"note":98.000,"xyz":[478.688,266.000,57.576]}},{"noteOn":{"time":142.235,"note":98.000,"xyz":[141.594,266.000,157.325]}},{"noteOn":{"time":142.245,"note":90.000,"xyz":[-238.422,170.000,206.041]}},{"noteOn":{"time":142.270,"note":104.000,"xyz":[6.287,338.000,26.574]}},{"noteOn":{"time":142.365,"note":96.000,"xyz":[-12.387,242.000,-10.813]}},{"noteOn":{"time":142.440,"note":96.000,"xyz":[12.219,242.000,-475.831]}},{"noteOn":{"time":142.510,"note":100.000,"xyz":[186.665,290.000,218.667]}},{"noteOn":{"time":142.525,"note":104.000,"xyz":[181.749,338.000,-130.488]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[-175.077,386.000,291.664]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[-303.957,386.000,383.299]}},{"noteOn":{"time":142.755,"note":100.000,"xyz":[-79.361,290.000,54.371]}},{"noteOn":{"time":142.775,"note":104.000,"xyz":[327.506,338.000,61.339]}},{"noteOn":{"time":142.800,"note":101.000,"xyz":[163.527,302.000,-52.655]}},{"noteOn":{"time":142.860,"note":106.000,"xyz":[-146.827,362.000,167.091]}},{"noteOn":{"time":142.885,"note":104.000,"xyz":[71.527,338.000,63.790]}},{"noteOn":{"time":142.930,"note":112.000,"xyz":[-49.430,434.000,97.259]}},{"noteOn":{"time":142.945,"note":98.000,"xyz":[21.290,266.000,418.283]}},{"noteOn":{"time":142.950,"note":98.000,"xyz":[26.264,266.000,-62.333]}},{"noteOn":{"time":142.995,"note":90.000,"xyz":[-332.416,170.000,164.662]}},{"noteOn":{"time":143.110,"note":100.000,"xyz":[129.004,290.000,31.080]}},{"noteOn":{"time":143.195,"note":96.000,"xyz":[-214.202,242.000,-396.443]}},{"noteOn":{"time":143.280,"note":102.000,"xyz":[-116.663,314.000,161.382]}},{"noteOn":{"time":143.335,"note":106.000,"xyz":[170.798,362.000,-76.655]}},{"noteOn":{"time":143.460,"note":103.000,"xyz":[-232.081,326.000,290.631]}},{"noteOn":{"time":143.470,"note":102.000,"xyz":[82.770,314.000,-190.311]}},{"noteOn":{"time":143.555,"note":106.000,"xyz":[276.272,362.000,275.238]}},{"noteOn":{"time":143.580,"note":108.000,"xyz":[-33.491,386.000,62.106]}},{"noteOn":{"time":143.620,"note":96.000,"xyz":[310.068,242.000,-132.321]}},{"noteOn":{"time":143.625,"note":106.000,"xyz":[-5.650,362.000,13.368]}},{"noteOn":{"time":143.700,"note":91.000,"xyz":[-80.062,182.000,-213.859]}},{"noteOn":{"time":143.765,"note":106.000,"xyz":[161.269,362.000,102.972]}},{"noteOn":{"time":143.815,"note":98.000,"xyz":[-35.838,266.000,340.560]}},{"noteOn":{"time":143.835,"note":98.000,"xyz":[12.143,266.000,70.419]}},{"noteOn":{"time":143.835,"note":114.000,"xyz":[-303.205,458.000,-1.937]}},{"noteOn":{"time":143.920,"note":100.000,"xyz":[-157.181,290.000,291.840]}},{"noteOn":{"time":143.925,"note":102.000,"xyz":[12.085,314.000,6.046]}},{"noteOn":{"time":144.070,"note":104.000,"xyz":[-203.680,338.000,85.653]}},{"noteOn":{"time":144.155,"note":100.000,"xyz":[58.469,290.000,-23.672]}},{"noteOn":{"time":144.175,"note":102.000,"xyz":[-301.508,314.000,180.197]}},{"noteOn":{"time":144.210,"note":93.000,"xyz":[-64.870,206.000,279.211]}},{"noteOn":{"time":144.260,"note":93.000,"xyz":[15.226,206.000,218.848]}},{"noteOn":{"time":144.315,"note":108.000,"xyz":[152.696,386.000,-2.737]}},{"noteOn":{"time":144.355,"note":104.000,"xyz":[-193.189,338.000,-36.018]}},{"noteOn":{"time":144.465,"note":103.000,"xyz":[-242.728,326.000,175.642]}},{"noteOn":{"time":144.550,"note":110.000,"xyz":[-305.068,410.000,-197.106]}},{"noteOn":{"time":144.585,"note":104.000,"xyz":[-186.529,338.000,-41.349]}},{"noteOn":{"time":144.670,"note":104.000,"xyz":[41.534,338.000,100.905]}},{"noteOn":{"time":144.675,"note":110.000,"xyz":[-158.903,410.000,-16.888]}},{"noteOn":{"time":144.690,"note":100.000,"xyz":[-130.816,290.000,431.858]}},{"noteOn":{"time":144.745,"note":100.000,"xyz":[-14.331,290.000,-42.154]}},{"noteOn":{"time":144.770,"note":96.000,"xyz":[150.778,242.000,294.671]}},{"noteOn":{"time":144.850,"note":102.000,"xyz":[173.622,314.000,167.596]}},{"noteOn":{"time":144.875,"note":95.000,"xyz":[117.725,230.000,133.497]}},{"noteOn":{"time":144.890,"note":100.000,"xyz":[-200.127,290.000,-223.209]}},{"noteOn":{"time":144.975,"note":110.000,"xyz":[-82.675,410.000,199.858]}},{"noteOn":{"time":145.025,"note":114.000,"xyz":[-154.277,458.000,212.143]}},{"noteOn":{"time":145.060,"note":102.000,"xyz":[-66.185,314.000,-174.290]}},{"noteOn":{"time":145.085,"note":98.000,"xyz":[40.304,266.000,256.344]}},{"noteOn":{"time":145.200,"note":97.000,"xyz":[-219.139,254.000,-179.305]}},{"noteOn":{"time":145.295,"note":96.000,"xyz":[-13.268,242.000,-16.986]}},{"noteOn":{"time":145.300,"note":102.000,"xyz":[132.974,314.000,-40.112]}},{"noteOn":{"time":145.320,"note":108.000,"xyz":[379.353,386.000,-100.569]}},{"noteOn":{"time":145.445,"note":103.000,"xyz":[-294.646,326.000,245.444]}},{"noteOn":{"time":145.455,"note":97.000,"xyz":[38.007,254.000,302.735]}},{"noteOn":{"time":145.455,"note":107.000,"xyz":[-269.298,374.000,15.813]}},{"noteOn":{"time":145.480,"note":112.000,"xyz":[-270.239,434.000,-183.225]}},{"noteOn":{"time":145.485,"note":104.000,"xyz":[180.006,338.000,196.639]}},{"noteOn":{"time":145.490,"note":106.000,"xyz":[80.012,362.000,-65.827]}},{"noteOn":{"time":145.525,"note":98.000,"xyz":[29.521,266.000,17.584]}},{"noteOn":{"time":145.575,"note":102.000,"xyz":[-26.098,314.000,58.213]}},{"noteOn":{"time":145.635,"note":112.000,"xyz":[-398.611,434.000,219.909]}},{"noteOn":{"time":145.650,"note":101.000,"xyz":[-119.327,302.000,358.076]}},{"noteOn":{"time":145.685,"note":93.000,"xyz":[-56.889,206.000,-37.342]}},{"noteOn":{"time":145.765,"note":95.000,"xyz":[-229.193,230.000,93.382]}},{"noteOn":{"time":145.910,"note":99.000,"xyz":[-328.645,278.000,-348.710]}},{"noteOn":{"time":146.035,"note":105.000,"xyz":[-125.143,350.000,251.458]}},{"noteOn":{"time":146.070,"note":107.000,"xyz":[-263.395,374.000,-184.289]}},{"noteOn":{"time":146.090,"note":103.000,"xyz":[128.378,326.000,-407.122]}},{"noteOn":{"time":146.135,"note":107.000,"xyz":[118.500,374.000,0.057]}},{"noteOn":{"time":146.140,"note":104.000,"xyz":[-34.100,338.000,322.239]}},{"noteOn":{"time":146.160,"note":96.000,"xyz":[-280.112,242.000,-186.442]}},{"noteOn":{"time":146.250,"note":95.000,"xyz":[-257.585,230.000,-281.429]}},{"noteOn":{"time":146.295,"note":105.000,"xyz":[-109.078,350.000,-439.541]}},{"noteOn":{"time":146.435,"note":109.000,"xyz":[56.940,398.000,-116.917]}},{"noteOn":{"time":146.445,"note":95.000,"xyz":[-266.570,230.000,19.733]}},{"noteOn":{"time":146.460,"note":107.000,"xyz":[-80.750,374.000,-191.568]}},{"noteOn":{"time":146.535,"note":109.000,"xyz":[132.946,398.000,41.665]}},{"noteOn":{"time":146.585,"note":95.000,"xyz":[25.409,230.000,-8.715]}},{"noteOn":{"time":146.670,"note":105.000,"xyz":[286.210,350.000,246.362]}},{"noteOn":{"time":146.695,"note":101.000,"xyz":[480.899,302.000,74.877]}},{"noteOn":{"time":146.700,"note":99.000,"xyz":[-398.754,278.000,163.343]}},{"noteOn":{"time":146.705,"note":89.000,"xyz":[-14.455,158.000,-368.459]}},{"noteOn":{"time":146.810,"note":105.000,"xyz":[183.814,350.000,-313.142]}},{"noteOn":{"time":146.830,"note":98.000,"xyz":[-61.655,266.000,-475.782]}},{"noteOn":{"time":146.875,"note":97.000,"xyz":[134.762,254.000,29.413]}},{"noteOn":{"time":146.910,"note":107.000,"xyz":[4.047,374.000,92.050]}},{"noteOn":{"time":146.925,"note":97.000,"xyz":[-300.878,254.000,362.561]}},{"noteOn":{"time":147.145,"note":107.000,"xyz":[274.454,374.000,311.421]}},{"noteOn":{"time":147.155,"note":103.000,"xyz":[-163.002,326.000,228.986]}},{"noteOn":{"time":147.205,"note":109.000,"xyz":[48.300,398.000,-118.099]}},{"noteOn":{"time":147.265,"note":101.000,"xyz":[13.298,302.000,25.833]}},{"noteOn":{"time":147.330,"note":103.000,"xyz":[70.555,326.000,6.012]}},{"noteOn":{"time":147.350,"note":102.000,"xyz":[364.092,314.000,130.716]}},{"noteOn":{"time":147.410,"note":91.000,"xyz":[-283.891,182.000,346.470]}},{"noteOn":{"time":147.425,"note":97.000,"xyz":[-90.178,254.000,23.206]}},{"noteOn":{"time":147.455,"note":101.000,"xyz":[-443.739,302.000,-137.651]}},{"noteOn":{"time":147.470,"note":107.000,"xyz":[264.853,374.000,346.600]}},{"noteOn":{"time":147.585,"note":101.000,"xyz":[115.785,302.000,14.853]}},{"noteOn":{"time":147.610,"note":97.000,"xyz":[-75.311,254.000,50.613]}},{"noteOn":{"time":147.645,"note":105.000,"xyz":[-1.400,350.000,-111.294]}},{"noteOn":{"time":147.665,"note":99.000,"xyz":[-39.700,278.000,-141.735]}},{"noteOn":{"time":147.690,"note":103.000,"xyz":[-279.017,326.000,-203.033]}},{"noteOn":{"time":147.895,"note":105.000,"xyz":[326.332,350.000,-245.217]}},{"noteOn":{"time":148.010,"note":113.000,"xyz":[304.738,446.000,242.773]}},{"noteOn":{"time":148.035,"note":102.000,"xyz":[14.139,314.000,370.633]}},{"noteOn":{"time":148.060,"note":109.000,"xyz":[-205.880,398.000,-40.076]}},{"noteOn":{"time":148.090,"note":107.000,"xyz":[36.270,374.000,30.412]}},{"noteOn":{"time":148.140,"note":99.000,"xyz":[120.262,278.000,222.500]}},{"noteOn":{"time":148.150,"note":95.000,"xyz":[12.052,230.000,-25.567]}},{"noteOn":{"time":148.200,"note":91.000,"xyz":[260.195,182.000,-15.250]}},{"noteOn":{"time":148.295,"note":97.000,"xyz":[56.183,254.000,-4.198]}},{"noteOn":{"time":148.325,"note":99.000,"xyz":[-59.744,278.000,25.263]}},{"noteOn":{"time":148.365,"note":105.000,"xyz":[-55.192,350.000,87.400]}},{"noteOn":{"time":148.485,"note":101.000,"xyz":[408.160,302.000,-125.577]}},{"noteOn":{"time":148.525,"note":115.000,"xyz":[-33.219,470.000,106.396]}},{"noteOn":{"time":148.560,"note":99.000,"xyz":[4.695,278.000,-33.881]}},{"noteOn":{"time":148.580,"note":101.000,"xyz":[142.737,302.000,-358.898]}},{"noteOn":{"time":148.595,"note":103.000,"xyz":[33.633,326.000,212.115]}},{"noteOn":{"time":148.675,"note":111.000,"xyz":[-190.518,422.000,67.894]}},{"noteOn":{"time":148.770,"note":103.000,"xyz":[148.336,326.000,266.453]}},{"noteOn":{"time":148.770,"note":93.000,"xyz":[-224.664,206.000,55.814]}},{"noteOn":{"time":148.805,"note":94.000,"xyz":[152.010,218.000,-291.425]}},{"noteOn":{"time":148.815,"note":109.000,"xyz":[-36.472,398.000,-4.383]}},{"noteOn":{"time":149.050,"note":103.000,"xyz":[295.934,326.000,-271.945]}},{"noteOn":{"time":149.080,"note":103.000,"xyz":[32.163,326.000,251.016]}},{"noteOn":{"time":149.090,"note":101.000,"xyz":[176.019,302.000,-456.128]}},{"noteOn":{"time":149.195,"note":105.000,"xyz":[221.050,350.000,-314.660]}},{"noteOn":{"time":149.220,"note":101.000,"xyz":[340.459,302.000,67.191]}},{"noteOn":{"time":149.275,"note":95.000,"xyz":[-4.012,230.000,0.825]}},{"noteOn":{"time":149.315,"note":99.000,"xyz":[-29.883,278.000,-308.208]}},{"noteOn":{"time":149.330,"note":109.000,"xyz":[-221.874,398.000,-6.998]}},{"noteOn":{"time":149.330,"note":99.000,"xyz":[324.319,278.000,-231.243]}},{"noteOn":{"time":149.335,"note":113.000,"xyz":[-225.392,446.000,-180.199]}},{"noteOn":{"time":149.365,"note":99.000,"xyz":[95.667,278.000,-235.974]}},{"noteOn":{"time":149.450,"note":96.000,"xyz":[22.071,242.000,-132.710]}},{"noteOn":{"time":149.535,"note":111.000,"xyz":[-79.738,422.000,472.535]}},{"noteOn":{"time":149.535,"note":101.000,"xyz":[412.032,302.000,-33.051]}},{"noteOn":{"time":149.700,"note":96.000,"xyz":[253.360,242.000,-172.494]}},{"noteOn":{"time":149.845,"note":97.000,"xyz":[-80.498,254.000,-62.949]}},{"noteOn":{"time":149.875,"note":107.000,"xyz":[249.399,374.000,-423.486]}},{"noteOn":{"time":149.900,"note":103.000,"xyz":[-124.683,326.000,-244.799]}},{"noteOn":{"time":149.930,"note":105.000,"xyz":[-82.724,350.000,57.409]}},{"noteOn":{"time":149.975,"note":103.000,"xyz":[252.926,326.000,279.269]}},{"noteOn":{"time":149.995,"note":97.000,"xyz":[-243.062,254.000,-229.314]}},{"noteOn":{"time":150.005,"note":96.000,"xyz":[329.201,242.000,-46.285]}},{"noteOn":{"time":150.025,"note":101.000,"xyz":[-337.467,302.000,226.696]}},{"noteOn":{"time":150.060,"note":103.000,"xyz":[-138.980,326.000,280.529]}},{"noteOn":{"time":150.170,"note":109.000,"xyz":[-66.981,398.000,-29.882]}},{"noteOn":{"time":150.265,"note":107.000,"xyz":[-117.530,374.000,-64.603]}},{"noteOn":{"time":150.275,"note":94.000,"xyz":[59.777,218.000,-470.940]}},{"noteOn":{"time":150.335,"note":111.000,"xyz":[-10.357,422.000,119.832]}},{"noteOn":{"time":150.360,"note":111.000,"xyz":[312.468,422.000,113.313]}},{"noteOn":{"time":150.375,"note":103.000,"xyz":[-159.323,326.000,-57.285]}},{"noteOn":{"time":150.400,"note":109.000,"xyz":[-179.118,398.000,318.434]}},{"noteOn":{"time":150.435,"note":107.000,"xyz":[120.155,374.000,83.630]}},{"noteOn":{"time":150.505,"note":99.000,"xyz":[72.307,278.000,-74.728]}},{"noteOn":{"time":150.550,"note":105.000,"xyz":[218.268,350.000,428.191]}},{"noteOn":{"time":150.695,"note":107.000,"xyz":[-4.066,374.000,-30.923]}},{"noteOn":{"time":150.725,"note":96.000,"xyz":[-88.262,242.000,-406.886]}},{"noteOn":{"time":150.750,"note":95.000,"xyz":[-280.294,230.000,-64.401]}},{"noteOn":{"time":150.900,"note":107.000,"xyz":[25.985,374.000,57.085]}},{"noteOn":{"time":150.930,"note":104.000,"xyz":[-22.856,338.000,17.593]}},{"noteOn":{"time":150.975,"note":94.000,"xyz":[231.102,218.000,150.817]}},{"noteOn":{"time":150.985,"note":93.000,"xyz":[386.594,206.000,-170.518]}},{"noteOn":{"time":151.065,"note":109.000,"xyz":[168.619,398.000,-120.402]}},{"noteOn":{"time":151.070,"note":103.000,"xyz":[-307.437,326.000,-211.101]}},{"noteOn":{"time":151.130,"note":106.000,"xyz":[-98.276,362.000,-58.188]}},{"noteOn":{"time":151.200,"note":100.000,"xyz":[-156.997,290.000,47.519]}},{"noteOn":{"time":151.255,"note":90.000,"xyz":[73.378,170.000,75.682]}},{"noteOn":{"time":151.270,"note":106.000,"xyz":[81.833,362.000,-138.252]}},{"noteOn":{"time":151.290,"note":101.000,"xyz":[-162.866,302.000,-221.903]}},{"noteOn":{"time":151.295,"note":98.000,"xyz":[-161.548,266.000,131.380]}},{"noteOn":{"time":151.360,"note":105.000,"xyz":[-92.947,350.000,2.348]}},{"noteOn":{"time":151.380,"note":97.000,"xyz":[34.182,254.000,217.374]}},{"noteOn":{"time":151.430,"note":97.000,"xyz":[144.952,254.000,351.535]}},{"noteOn":{"time":151.670,"note":105.000,"xyz":[334.361,350.000,-358.997]}},{"noteOn":{"time":151.770,"note":110.000,"xyz":[60.328,410.000,-79.097]}},{"noteOn":{"time":151.775,"note":102.000,"xyz":[-65.314,314.000,-169.944]}},{"noteOn":{"time":151.780,"note":107.000,"xyz":[219.066,374.000,344.000]}},{"noteOn":{"time":151.795,"note":96.000,"xyz":[-40.894,242.000,85.018]}},{"noteOn":{"time":151.820,"note":102.000,"xyz":[301.558,314.000,-338.639]}},{"noteOn":{"time":151.860,"note":102.000,"xyz":[-19.811,314.000,462.788]}},{"noteOn":{"time":151.900,"note":96.000,"xyz":[-0.200,242.000,-16.956]}},{"noteOn":{"time":151.900,"note":102.000,"xyz":[-87.436,314.000,-427.162]}},{"noteOn":{"time":151.965,"note":108.000,"xyz":[189.062,386.000,283.689]}},{"noteOn":{"time":151.985,"note":114.000,"xyz":[-251.265,458.000,180.341]}},{"noteOn":{"time":152.020,"note":97.000,"xyz":[-140.705,254.000,149.535]}},{"noteOn":{"time":152.075,"note":104.000,"xyz":[341.887,338.000,286.463]}},{"noteOn":{"time":152.185,"note":104.000,"xyz":[-273.073,338.000,-164.604]}},{"noteOn":{"time":152.270,"note":100.000,"xyz":[131.535,290.000,-52.229]}},{"noteOn":{"time":152.465,"note":104.000,"xyz":[1.122,338.000,44.581]}},{"noteOn":{"time":152.500,"note":108.000,"xyz":[-31.501,386.000,-5.635]}},{"noteOn":{"time":152.540,"note":110.000,"xyz":[-437.924,410.000,35.949]}},{"noteOn":{"time":152.565,"note":101.000,"xyz":[-98.869,302.000,-33.040]}},{"noteOn":{"time":152.585,"note":100.000,"xyz":[-47.186,290.000,-316.720]}},{"noteOn":{"time":152.675,"note":94.000,"xyz":[-265.542,218.000,-124.221]}},{"noteOn":{"time":152.695,"note":92.000,"xyz":[8.407,194.000,136.521]}},{"noteOn":{"time":152.745,"note":100.000,"xyz":[-46.905,290.000,307.134]}},{"noteOn":{"time":152.755,"note":100.000,"xyz":[69.365,290.000,40.836]}},{"noteOn":{"time":152.815,"note":102.000,"xyz":[48.477,314.000,30.278]}},{"noteOn":{"time":152.925,"note":114.000,"xyz":[133.227,458.000,97.650]}},{"noteOn":{"time":152.925,"note":100.000,"xyz":[-73.618,290.000,418.328]}},{"noteOn":{"time":152.940,"note":100.000,"xyz":[71.925,290.000,-152.078]}},{"noteOn":{"time":152.965,"note":105.000,"xyz":[-110.770,350.000,395.798]}},{"noteOn":{"time":153.030,"note":110.000,"xyz":[-4.770,410.000,-14.202]}},{"noteOn":{"time":153.205,"note":102.000,"xyz":[-319.692,314.000,92.158]}},{"noteOn":{"time":153.280,"note":94.000,"xyz":[130.088,218.000,470.423]}},{"noteOn":{"time":153.280,"note":112.000,"xyz":[-80.636,434.000,7.792]}},{"noteOn":{"time":153.360,"note":95.000,"xyz":[321.150,230.000,62.917]}},{"noteOn":{"time":153.415,"note":102.000,"xyz":[-287.319,314.000,-47.175]}},{"noteOn":{"time":153.490,"note":102.000,"xyz":[-337.782,314.000,56.345]}},{"noteOn":{"time":153.535,"note":98.000,"xyz":[41.314,266.000,56.470]}},{"noteOn":{"time":153.555,"note":112.000,"xyz":[-355.760,434.000,337.376]}},{"noteOn":{"time":153.630,"note":104.000,"xyz":[-55.146,338.000,23.489]}},{"noteOn":{"time":153.665,"note":98.000,"xyz":[56.751,266.000,310.431]}},{"noteOn":{"time":153.670,"note":100.000,"xyz":[79.074,290.000,-135.515]}},{"noteOn":{"time":153.695,"note":98.000,"xyz":[-81.457,266.000,171.246]}},{"noteOn":{"time":153.765,"note":100.000,"xyz":[96.860,290.000,-109.793]}},{"noteOn":{"time":153.835,"note":106.000,"xyz":[249.902,362.000,196.842]}},{"noteOn":{"time":153.980,"note":97.000,"xyz":[277.793,254.000,-325.833]}},{"noteOn":{"time":154.030,"note":112.000,"xyz":[-326.803,434.000,72.787]}},{"noteOn":{"time":154.065,"note":102.000,"xyz":[419.865,314.000,86.465]}},{"noteOn":{"time":154.195,"note":96.000,"xyz":[-4.952,242.000,-4.037]}},{"noteOn":{"time":154.385,"note":106.000,"xyz":[171.286,362.000,39.508]}},{"noteOn":{"time":154.395,"note":96.000,"xyz":[279.367,242.000,-297.155]}},{"noteOn":{"time":154.410,"note":110.000,"xyz":[29.649,410.000,-13.386]}},{"noteOn":{"time":154.485,"note":104.000,"xyz":[416.260,338.000,108.242]}},{"noteOn":{"time":154.505,"note":102.000,"xyz":[-9.012,314.000,95.613]}},{"noteOn":{"time":154.515,"note":95.000,"xyz":[-366.714,230.000,-104.184]}},{"noteOn":{"time":154.520,"note":102.000,"xyz":[195.713,314.000,423.014]}},{"noteOn":{"time":154.580,"note":108.000,"xyz":[-368.857,386.000,149.989]}},{"noteOn":{"time":154.610,"note":108.000,"xyz":[236.839,386.000,289.506]}},{"noteOn":{"time":154.625,"note":108.000,"xyz":[-8.533,386.000,1.622]}},{"noteOn":{"time":154.630,"note":112.000,"xyz":[157.670,434.000,59.732]}},{"noteOn":{"time":154.645,"note":110.000,"xyz":[-33.326,410.000,135.039]}},{"noteOn":{"time":154.715,"note":102.000,"xyz":[132.129,314.000,-310.803]}},{"noteOn":{"time":154.780,"note":93.000,"xyz":[198.881,206.000,-339.383]}},{"noteOn":{"time":154.880,"note":104.000,"xyz":[36.184,338.000,-188.240]}},{"noteOn":{"time":155.025,"note":106.000,"xyz":[-2.501,362.000,-6.169]}},{"noteOn":{"time":155.045,"note":106.000,"xyz":[-0.711,362.000,0.917]}},{"noteOn":{"time":155.195,"note":96.000,"xyz":[386.113,242.000,25.688]}},{"noteOn":{"time":155.260,"note":106.000,"xyz":[35.278,362.000,435.718]}},{"noteOn":{"time":155.270,"note":94.000,"xyz":[-34.576,218.000,-62.495]}},{"noteOn":{"time":155.270,"note":104.000,"xyz":[431.564,338.000,122.481]}},{"noteOn":{"time":155.320,"note":106.000,"xyz":[-132.373,362.000,-439.381]}},{"noteOn":{"time":155.370,"note":114.000,"xyz":[-301.562,458.000,-308.052]}},{"noteOn":{"time":155.375,"note":104.000,"xyz":[16.031,338.000,73.231]}},{"noteOn":{"time":155.465,"note":93.000,"xyz":[107.138,206.000,-82.788]}},{"noteOn":{"time":155.475,"note":108.000,"xyz":[-292.643,386.000,-195.059]}},{"noteOn":{"time":155.545,"note":108.000,"xyz":[156.333,386.000,-227.330]}},{"noteOn":{"time":155.560,"note":104.000,"xyz":[-321.181,338.000,133.054]}},{"noteOn":{"time":155.595,"note":108.000,"xyz":[-267.210,386.000,63.410]}},{"noteOn":{"time":155.695,"note":101.000,"xyz":[415.851,302.000,33.719]}},{"noteOn":{"time":155.715,"note":99.000,"xyz":[35.133,278.000,-21.860]}},{"noteOn":{"time":155.945,"note":98.000,"xyz":[-357.094,266.000,-226.537]}},{"noteOn":{"time":155.955,"note":96.000,"xyz":[128.910,242.000,108.279]}},{"noteOn":{"time":156.000,"note":104.000,"xyz":[180.282,338.000,42.637]}},{"noteOn":{"time":156.025,"note":106.000,"xyz":[-458.005,362.000,114.548]}},{"noteOn":{"time":156.105,"note":106.000,"xyz":[-161.495,362.000,-99.653]}},{"noteOn":{"time":156.115,"note":110.000,"xyz":[177.811,410.000,-350.017]}},{"noteOn":{"time":156.135,"note":102.000,"xyz":[49.647,314.000,-312.684]}},{"noteOn":{"time":156.185,"note":106.000,"xyz":[7.149,362.000,-27.909]}},{"noteOn":{"time":156.195,"note":102.000,"xyz":[-67.558,314.000,-3.462]}},{"noteOn":{"time":156.260,"note":94.000,"xyz":[-430.541,218.000,-50.513]}},{"noteOn":{"time":156.285,"note":101.000,"xyz":[-175.892,302.000,-170.369]}},{"noteOn":{"time":156.295,"note":106.000,"xyz":[-197.675,362.000,315.407]}},{"noteOn":{"time":156.330,"note":103.000,"xyz":[123.575,326.000,277.886]}},{"noteOn":{"time":156.350,"note":105.000,"xyz":[-366.479,350.000,261.829]}},{"noteOn":{"time":156.375,"note":95.000,"xyz":[-380.781,230.000,-133.242]}},{"noteOn":{"time":156.555,"note":98.000,"xyz":[84.838,266.000,23.204]}},{"noteOn":{"time":156.585,"note":102.000,"xyz":[-90.207,314.000,-81.260]}},{"noteOn":{"time":156.655,"note":108.000,"xyz":[498.555,386.000,32.613]}},{"noteOn":{"time":156.700,"note":104.000,"xyz":[-22.718,338.000,91.448]}},{"noteOn":{"time":156.730,"note":114.000,"xyz":[-428.299,458.000,231.843]}},{"noteOn":{"time":156.770,"note":109.000,"xyz":[-11.440,398.000,-54.864]}},{"noteOn":{"time":156.900,"note":100.000,"xyz":[-58.949,290.000,146.859]}},{"noteOn":{"time":156.980,"note":96.000,"xyz":[-140.330,242.000,35.019]}},{"noteOn":{"time":157.035,"note":104.000,"xyz":[-28.423,338.000,24.177]}},{"noteOn":{"time":157.055,"note":101.000,"xyz":[406.679,302.000,-259.658]}},{"noteOn":{"time":157.070,"note":110.000,"xyz":[-51.903,410.000,102.905]}},{"noteOn":{"time":157.105,"note":104.000,"xyz":[152.537,338.000,52.312]}},{"noteOn":{"time":157.130,"note":107.000,"xyz":[10.812,374.000,-7.464]}},{"noteOn":{"time":157.150,"note":100.000,"xyz":[258.281,290.000,323.693]}},{"noteOn":{"time":157.195,"note":93.000,"xyz":[-425.780,206.000,-92.564]}},{"noteOn":{"time":157.205,"note":93.000,"xyz":[-93.347,206.000,-259.146]}},{"noteOn":{"time":157.255,"note":99.000,"xyz":[-155.891,278.000,48.833]}},{"noteOn":{"time":157.375,"note":113.000,"xyz":[294.304,446.000,59.694]}},{"noteOn":{"time":157.410,"note":99.000,"xyz":[-44.812,278.000,305.704]}},{"noteOn":{"time":157.415,"note":100.000,"xyz":[236.354,290.000,-363.005]}},{"noteOn":{"time":157.425,"note":104.000,"xyz":[42.881,338.000,245.415]}},{"noteOn":{"time":157.550,"note":109.000,"xyz":[-90.179,398.000,166.269]}},{"noteOn":{"time":157.665,"note":111.000,"xyz":[221.820,422.000,-30.255]}},{"noteOn":{"time":157.680,"note":103.000,"xyz":[-381.740,326.000,64.448]}},{"noteOn":{"time":157.785,"note":95.000,"xyz":[235.540,230.000,-410.178]}},{"noteOn":{"time":157.795,"note":101.000,"xyz":[-199.045,302.000,-88.363]}},{"noteOn":{"time":157.860,"note":103.000,"xyz":[112.011,326.000,106.680]}},{"noteOn":{"time":157.870,"note":95.000,"xyz":[179.240,230.000,22.261]}},{"noteOn":{"time":157.885,"note":107.000,"xyz":[60.515,374.000,-428.652]}},{"noteOn":{"time":157.940,"note":100.000,"xyz":[-23.961,290.000,-30.657]}},{"noteOn":{"time":157.955,"note":101.000,"xyz":[416.093,302.000,-140.509]}},{"noteOn":{"time":157.980,"note":113.000,"xyz":[-32.693,446.000,21.482]}},{"noteOn":{"time":157.985,"note":97.000,"xyz":[-62.865,254.000,345.814]}},{"noteOn":{"time":158.080,"note":97.000,"xyz":[273.973,254.000,296.659]}},{"noteOn":{"time":158.085,"note":102.000,"xyz":[172.983,314.000,-49.176]}},{"noteOn":{"time":158.200,"note":103.000,"xyz":[-206.594,326.000,-24.798]}},{"noteOn":{"time":158.370,"note":109.000,"xyz":[-44.944,398.000,-469.416]}},{"noteOn":{"time":158.375,"note":111.000,"xyz":[97.526,422.000,-247.913]}},{"noteOn":{"time":158.470,"note":98.000,"xyz":[-98.069,266.000,-16.758]}},{"noteOn":{"time":158.470,"note":111.000,"xyz":[-106.721,422.000,386.646]}},{"noteOn":{"time":158.545,"note":101.000,"xyz":[-32.378,302.000,-118.430]}},{"noteOn":{"time":158.545,"note":103.000,"xyz":[-247.451,326.000,-265.750]}},{"noteOn":{"time":158.615,"note":107.000,"xyz":[-406.778,374.000,-169.202]}},{"noteOn":{"time":158.630,"note":97.000,"xyz":[40.847,254.000,-139.553]}},{"noteOn":{"time":158.690,"note":95.000,"xyz":[-76.608,230.000,36.289]}},{"noteOn":{"time":158.715,"note":95.000,"xyz":[376.669,230.000,122.125]}},{"noteOn":{"time":158.725,"note":109.000,"xyz":[-32.313,398.000,-84.963]}},{"noteOn":{"time":158.785,"note":107.000,"xyz":[406.233,374.000,-162.575]}},{"noteOn":{"time":158.860,"note":107.000,"xyz":[21.250,374.000,-1.815]}},{"noteOn":{"time":158.895,"note":105.000,"xyz":[-1.117,350.000,24.838]}},{"noteOn":{"time":158.910,"note":109.000,"xyz":[-154.854,398.000,195.970]}},{"noteOn":{"time":158.985,"note":94.000,"xyz":[225.418,218.000,132.744]}},{"noteOn":{"time":159.015,"note":101.000,"xyz":[246.858,302.000,-247.370]}},{"noteOn":{"time":159.090,"note":105.000,"xyz":[-6.209,350.000,-27.296]}},{"noteOn":{"time":159.245,"note":109.000,"xyz":[-93.066,398.000,-47.604]}},{"noteOn":{"time":159.255,"note":105.000,"xyz":[103.082,350.000,36.221]}},{"noteOn":{"time":159.290,"note":93.000,"xyz":[-55.110,206.000,-40.339]}},{"noteOn":{"time":159.320,"note":113.000,"xyz":[12.107,446.000,113.382]}},{"noteOn":{"time":159.345,"note":103.000,"xyz":[-19.468,326.000,53.719]}},{"noteOn":{"time":159.405,"note":107.000,"xyz":[-129.948,374.000,287.722]}},{"noteOn":{"time":159.560,"note":103.000,"xyz":[-2.328,326.000,161.099]}},{"noteOn":{"time":159.560,"note":105.000,"xyz":[157.464,350.000,446.365]}},{"noteOn":{"time":159.620,"note":107.000,"xyz":[208.777,374.000,-70.302]}},{"noteOn":{"time":159.655,"note":97.000,"xyz":[-66.224,254.000,91.689]}},{"noteOn":{"time":159.675,"note":105.000,"xyz":[78.492,350.000,344.386]}},{"noteOn":{"time":159.705,"note":105.000,"xyz":[127.722,350.000,-280.707]}},{"noteOn":{"time":159.715,"note":95.000,"xyz":[-41.932,230.000,489.323]}},{"noteOn":{"time":159.815,"note":107.000,"xyz":[-30.799,374.000,433.882]}},{"noteOn":{"time":159.910,"note":109.000,"xyz":[-12.810,398.000,-85.303]}},{"noteOn":{"time":159.915,"note":92.000,"xyz":[-150.187,194.000,101.729]}},{"noteOn":{"time":159.935,"note":103.000,"xyz":[148.458,326.000,-30.421]}},{"noteOn":{"time":160.070,"note":107.000,"xyz":[-105.064,374.000,-115.379]}},{"noteOn":{"time":160.130,"note":115.000,"xyz":[218.476,470.000,-49.904]}},{"noteOn":{"time":160.190,"note":99.000,"xyz":[-140.250,278.000,98.323]}},{"noteOn":{"time":160.190,"note":101.000,"xyz":[55.338,302.000,22.640]}},{"noteOn":{"time":160.225,"note":105.000,"xyz":[-1.804,350.000,-28.088]}},{"noteOn":{"time":160.320,"note":107.000,"xyz":[132.451,374.000,-17.888]}},{"noteOn":{"time":160.365,"note":97.000,"xyz":[100.938,254.000,416.971]}},{"noteOn":{"time":160.375,"note":105.000,"xyz":[105.432,350.000,-96.173]}},{"noteOn":{"time":160.420,"note":99.000,"xyz":[-166.972,278.000,191.772]}},{"noteOn":{"time":160.555,"note":101.000,"xyz":[368.665,302.000,-83.365]}},{"noteOn":{"time":160.555,"note":109.000,"xyz":[-61.977,398.000,-359.582]}},{"noteOn":{"time":160.565,"note":103.000,"xyz":[-30.440,326.000,491.785]}},{"noteOn":{"time":160.670,"note":103.000,"xyz":[-48.950,326.000,217.525]}},{"noteOn":{"time":160.695,"note":105.000,"xyz":[-214.333,350.000,367.855]}},{"noteOn":{"time":160.755,"note":102.000,"xyz":[64.111,314.000,-305.173]}},{"noteOn":{"time":160.795,"note":100.000,"xyz":[25.280,290.000,9.016]}},{"noteOn":{"time":160.810,"note":111.000,"xyz":[66.088,422.000,13.925]}},{"noteOn":{"time":160.905,"note":95.000,"xyz":[-272.624,230.000,-245.449]}},{"noteOn":{"time":161.065,"note":105.000,"xyz":[-89.598,350.000,-123.267]}},{"noteOn":{"time":161.090,"note":99.000,"xyz":[208.064,278.000,-160.449]}},{"noteOn":{"time":161.125,"note":95.000,"xyz":[-275.478,230.000,210.761]}},{"noteOn":{"time":161.150,"note":99.000,"xyz":[168.545,278.000,-223.095]}},{"noteOn":{"time":161.195,"note":103.000,"xyz":[489.545,326.000,-99.441]}},{"noteOn":{"time":161.220,"note":101.000,"xyz":[-167.005,302.000,401.783]}},{"noteOn":{"time":161.255,"note":115.000,"xyz":[195.935,470.000,-171.952]}},{"noteOn":{"time":161.270,"note":101.000,"xyz":[-1.694,302.000,1.240]}},{"noteOn":{"time":161.325,"note":105.000,"xyz":[32.453,350.000,-167.613]}},{"noteOn":{"time":161.345,"note":103.000,"xyz":[144.583,326.000,-191.087]}},{"noteOn":{"time":161.375,"note":107.000,"xyz":[361.956,374.000,-226.154]}},{"noteOn":{"time":161.380,"note":109.000,"xyz":[173.749,398.000,72.695]}},{"noteOn":{"time":161.500,"note":100.000,"xyz":[-246.287,290.000,-144.805]}},{"noteOn":{"time":161.595,"note":111.000,"xyz":[135.722,422.000,-102.743]}},{"noteOn":{"time":161.690,"note":94.000,"xyz":[201.144,218.000,-349.655]}},{"noteOn":{"time":161.755,"note":97.000,"xyz":[98.394,254.000,134.212]}},{"noteOn":{"time":161.790,"note":92.000,"xyz":[306.381,194.000,387.529]}},{"noteOn":{"time":161.830,"note":101.000,"xyz":[-0.913,302.000,-18.723]}},{"noteOn":{"time":161.835,"note":103.000,"xyz":[11.620,326.000,227.099]}},{"noteOn":{"time":161.865,"note":99.000,"xyz":[-214.113,278.000,-27.682]}},{"noteOn":{"time":161.925,"note":102.000,"xyz":[-13.483,314.000,-407.084]}},{"noteOn":{"time":162.030,"note":113.000,"xyz":[197.223,446.000,103.650]}},{"noteOn":{"time":162.100,"note":99.000,"xyz":[345.644,278.000,-189.123]}},{"noteOn":{"time":162.150,"note":113.000,"xyz":[-16.164,446.000,-35.466]}},{"noteOn":{"time":162.185,"note":101.000,"xyz":[-289.302,302.000,376.362]}},{"noteOn":{"time":162.295,"note":110.000,"xyz":[359.821,410.000,-159.753]}},{"noteOn":{"time":162.295,"note":96.000,"xyz":[-283.580,242.000,139.665]}},{"noteOn":{"time":162.315,"note":103.000,"xyz":[197.612,326.000,-218.070]}},{"noteOn":{"time":162.335,"note":96.000,"xyz":[129.722,242.000,-88.450]}},{"noteOn":{"time":162.345,"note":108.000,"xyz":[449.842,386.000,89.517]}},{"noteOn":{"time":162.420,"note":103.000,"xyz":[-97.350,326.000,-406.232]}},{"noteOn":{"time":162.445,"note":97.000,"xyz":[-20.917,254.000,-214.209]}},{"noteOn":{"time":162.555,"note":106.000,"xyz":[-361.607,362.000,24.110]}},{"noteOn":{"time":162.625,"note":99.000,"xyz":[479.126,278.000,-127.298]}},{"noteOn":{"time":162.685,"note":101.000,"xyz":[163.392,302.000,27.553]}},{"noteOn":{"time":162.705,"note":97.000,"xyz":[73.652,254.000,420.943]}},{"noteOn":{"time":162.730,"note":102.000,"xyz":[-257.415,314.000,63.092]}},{"noteOn":{"time":162.910,"note":110.000,"xyz":[172.970,410.000,-419.848]}},{"noteOn":{"time":162.915,"note":98.000,"xyz":[-399.614,266.000,176.498]}},{"noteOn":{"time":162.965,"note":108.000,"xyz":[213.439,386.000,-118.325]}},{"noteOn":{"time":163.070,"note":103.000,"xyz":[-59.754,326.000,200.710]}},{"noteOn":{"time":163.085,"note":111.000,"xyz":[41.934,422.000,-67.396]}},{"noteOn":{"time":163.100,"note":102.000,"xyz":[-267.528,314.000,82.153]}},{"noteOn":{"time":163.135,"note":108.000,"xyz":[300.780,386.000,-24.533]}},{"noteOn":{"time":163.155,"note":94.000,"xyz":[72.399,218.000,14.339]}},{"noteOn":{"time":163.190,"note":94.000,"xyz":[343.582,218.000,345.089]}},{"noteOn":{"time":163.220,"note":106.000,"xyz":[-169.200,362.000,-126.398]}},{"noteOn":{"time":163.230,"note":97.000,"xyz":[-27.277,254.000,57.139]}},{"noteOn":{"time":163.305,"note":105.000,"xyz":[-42.972,350.000,34.131]}},{"noteOn":{"time":163.420,"note":106.000,"xyz":[-392.731,362.000,251.958]}},{"noteOn":{"time":163.425,"note":93.000,"xyz":[-286.600,206.000,214.541]}},{"noteOn":{"time":163.485,"note":104.000,"xyz":[-295.957,338.000,-59.239]}},{"noteOn":{"time":163.490,"note":100.000,"xyz":[-480.006,290.000,46.152]}},{"noteOn":{"time":163.545,"note":110.000,"xyz":[143.051,410.000,123.448]}},{"noteOn":{"time":163.650,"note":104.000,"xyz":[-333.856,338.000,-97.518]}},{"noteOn":{"time":163.730,"note":114.000,"xyz":[-94.510,458.000,330.757]}},{"noteOn":{"time":163.750,"note":108.000,"xyz":[237.078,386.000,309.305]}},{"noteOn":{"time":163.800,"note":92.000,"xyz":[142.471,194.000,69.147]}},{"noteOn":{"time":163.870,"note":108.000,"xyz":[410.118,386.000,259.448]}},{"noteOn":{"time":163.970,"note":106.000,"xyz":[-132.941,362.000,-413.340]}},{"noteOn":{"time":164.035,"note":96.000,"xyz":[-180.926,242.000,-36.852]}},{"noteOn":{"time":164.070,"note":103.000,"xyz":[-338.249,326.000,-79.581]}},{"noteOn":{"time":164.075,"note":98.000,"xyz":[381.098,266.000,-71.625]}},{"noteOn":{"time":164.085,"note":104.000,"xyz":[-135.720,338.000,204.651]}},{"noteOn":{"time":164.210,"note":108.000,"xyz":[-337.347,386.000,228.016]}},{"noteOn":{"time":164.215,"note":107.000,"xyz":[24.234,374.000,79.128]}},{"noteOn":{"time":164.285,"note":106.000,"xyz":[247.822,362.000,-258.075]}},{"noteOn":{"time":164.310,"note":102.000,"xyz":[-124.923,314.000,-95.950]}},{"noteOn":{"time":164.330,"note":91.000,"xyz":[-18.694,182.000,173.562]}},{"noteOn":{"time":164.375,"note":116.000,"xyz":[-309.313,482.000,208.078]}},{"noteOn":{"time":164.390,"note":104.000,"xyz":[413.425,338.000,56.476]}},{"noteOn":{"time":164.475,"note":110.000,"xyz":[-32.655,410.000,59.595]}},{"noteOn":{"time":164.545,"note":106.000,"xyz":[-19.324,362.000,-19.047]}},{"noteOn":{"time":164.595,"note":106.000,"xyz":[9.652,362.000,-14.316]}},{"noteOn":{"time":164.650,"note":104.000,"xyz":[-5.620,338.000,35.432]}},{"noteOn":{"time":164.670,"note":100.000,"xyz":[2.134,290.000,114.244]}},{"noteOn":{"time":164.690,"note":102.000,"xyz":[10.771,314.000,44.705]}},{"noteOn":{"time":164.775,"note":98.000,"xyz":[-317.406,266.000,-262.360]}},{"noteOn":{"time":164.830,"note":104.000,"xyz":[35.078,338.000,211.877]}},{"noteOn":{"time":164.895,"note":104.000,"xyz":[304.789,338.000,86.739]}},{"noteOn":{"time":164.980,"note":100.000,"xyz":[-122.202,290.000,-164.581]}},{"noteOn":{"time":165.010,"note":102.000,"xyz":[25.956,314.000,154.746]}},{"noteOn":{"time":165.105,"note":108.000,"xyz":[-215.513,386.000,79.594]}},{"noteOn":{"time":165.150,"note":101.000,"xyz":[201.345,302.000,188.806]}},{"noteOn":{"time":165.185,"note":100.000,"xyz":[-27.839,290.000,58.093]}},{"noteOn":{"time":165.190,"note":110.000,"xyz":[83.284,410.000,93.265]}},{"noteOn":{"time":165.190,"note":112.000,"xyz":[-345.677,434.000,-247.994]}},{"noteOn":{"time":165.250,"note":104.000,"xyz":[29.673,338.000,174.168]}},{"noteOn":{"time":165.265,"note":106.000,"xyz":[27.381,362.000,7.336]}},{"noteOn":{"time":165.305,"note":100.000,"xyz":[-273.158,290.000,-207.957]}},{"noteOn":{"time":165.435,"note":94.000,"xyz":[-120.712,218.000,10.973]}},{"noteOn":{"time":165.440,"note":114.000,"xyz":[257.664,458.000,-417.105]}},{"noteOn":{"time":165.460,"note":96.000,"xyz":[11.931,242.000,22.723]}},{"noteOn":{"time":165.630,"note":102.000,"xyz":[-40.253,314.000,107.085]}},{"noteOn":{"time":165.660,"note":102.000,"xyz":[260.315,314.000,-84.695]}},{"noteOn":{"time":165.710,"note":106.000,"xyz":[-281.829,362.000,255.533]}},{"noteOn":{"time":165.750,"note":100.000,"xyz":[77.241,290.000,-28.496]}},{"noteOn":{"time":165.835,"note":100.000,"xyz":[310.260,290.000,-322.806]}},{"noteOn":{"time":165.915,"note":99.000,"xyz":[-10.550,278.000,206.357]}},{"noteOn":{"time":166.005,"note":98.000,"xyz":[424.206,266.000,94.404]}},{"noteOn":{"time":166.010,"note":100.000,"xyz":[-323.211,290.000,-220.397]}},{"noteOn":{"time":166.045,"note":102.000,"xyz":[13.441,314.000,-3.570]}},{"noteOn":{"time":166.075,"note":112.000,"xyz":[144.827,434.000,259.575]}},{"noteOn":{"time":166.105,"note":110.000,"xyz":[-473.829,410.000,152.361]}},{"noteOn":{"time":166.135,"note":108.000,"xyz":[-58.759,386.000,90.125]}},{"noteOn":{"time":166.245,"note":112.000,"xyz":[347.995,434.000,-218.736]}},{"noteOn":{"time":166.255,"note":102.000,"xyz":[-159.537,314.000,-85.486]}},{"noteOn":{"time":166.325,"note":100.000,"xyz":[137.567,290.000,-454.885]}},{"noteOn":{"time":166.375,"note":92.000,"xyz":[-199.084,194.000,70.848]}},{"noteOn":{"time":166.425,"note":98.000,"xyz":[-177.829,266.000,-144.882]}},{"noteOn":{"time":166.515,"note":102.000,"xyz":[-118.472,314.000,26.966]}},{"noteOn":{"time":166.575,"note":112.000,"xyz":[119.852,434.000,14.394]}},{"noteOn":{"time":166.625,"note":104.000,"xyz":[-377.029,338.000,210.900]}},{"noteOn":{"time":166.705,"note":98.000,"xyz":[-53.610,266.000,436.265]}},{"noteOn":{"time":166.765,"note":110.000,"xyz":[102.758,410.000,-330.699]}},{"noteOn":{"time":166.775,"note":97.000,"xyz":[395.860,254.000,183.400]}},{"noteOn":{"time":166.785,"note":98.000,"xyz":[-211.375,266.000,238.739]}},{"noteOn":{"time":166.815,"note":108.000,"xyz":[141.659,386.000,-310.232]}},{"noteOn":{"time":166.875,"note":112.000,"xyz":[58.143,434.000,251.666]}},{"noteOn":{"time":166.890,"note":102.000,"xyz":[51.614,314.000,-452.721]}},{"noteOn":{"time":166.895,"note":108.000,"xyz":[188.208,386.000,-26.703]}},{"noteOn":{"time":167.050,"note":104.000,"xyz":[264.995,338.000,-242.122]}},{"noteOn":{"time":167.110,"note":110.000,"xyz":[37.908,410.000,42.517]}},{"noteOn":{"time":167.160,"note":96.000,"xyz":[214.720,242.000,-165.463]}},{"noteOn":{"time":167.190,"note":115.000,"xyz":[-236.327,470.000,-210.981]}},{"noteOn":{"time":167.220,"note":100.000,"xyz":[28.089,290.000,154.578]}},{"noteOn":{"time":167.260,"note":101.000,"xyz":[-286.094,302.000,-336.833]}},{"noteOn":{"time":167.305,"note":96.000,"xyz":[-327.420,242.000,54.220]}},{"noteOn":{"time":167.315,"note":102.000,"xyz":[147.131,314.000,277.451]}},{"noteOn":{"time":167.325,"note":98.000,"xyz":[-120.654,266.000,-18.097]}},{"noteOn":{"time":167.330,"note":99.000,"xyz":[66.944,278.000,-176.308]}},{"noteOn":{"time":167.380,"note":107.000,"xyz":[-138.328,374.000,28.345]}},{"noteOn":{"time":167.600,"note":104.000,"xyz":[161.194,338.000,296.298]}},{"noteOn":{"time":167.610,"note":110.000,"xyz":[298.407,410.000,301.538]}},{"noteOn":{"time":167.665,"note":94.000,"xyz":[-150.565,218.000,468.178]}},{"noteOn":{"time":167.785,"note":106.000,"xyz":[-31.611,362.000,-96.155]}},{"noteOn":{"time":167.810,"note":106.000,"xyz":[-280.436,362.000,151.070]}},{"noteOn":{"time":167.860,"note":93.000,"xyz":[-462.785,206.000,94.189]}},{"noteOn":{"time":167.890,"note":110.000,"xyz":[-104.995,410.000,-105.433]}},{"noteOn":{"time":167.965,"note":99.000,"xyz":[-86.437,278.000,-392.444]}},{"noteOn":{"time":167.980,"note":105.000,"xyz":[-30.571,350.000,-82.167]}},{"noteOn":{"time":167.985,"note":106.000,"xyz":[170.079,362.000,-107.029]}},{"noteOn":{"time":168.005,"note":108.000,"xyz":[125.968,386.000,165.553]}},{"noteOn":{"time":168.025,"note":105.000,"xyz":[-65.802,350.000,449.042]}},{"noteOn":{"time":168.055,"note":104.000,"xyz":[-338.318,338.000,-111.247]}},{"noteOn":{"time":168.060,"note":106.000,"xyz":[239.493,362.000,126.344]}},{"noteOn":{"time":168.155,"note":108.000,"xyz":[221.498,386.000,342.975]}},{"noteOn":{"time":168.235,"note":115.000,"xyz":[-327.263,470.000,372.238]}},{"noteOn":{"time":168.350,"note":106.000,"xyz":[-5.151,362.000,172.745]}},{"noteOn":{"time":168.425,"note":96.000,"xyz":[181.563,242.000,328.193]}},{"noteOn":{"time":168.495,"note":99.000,"xyz":[50.408,278.000,292.165]}},{"noteOn":{"time":168.525,"note":107.000,"xyz":[-31.547,374.000,139.003]}},{"noteOn":{"time":168.570,"note":104.000,"xyz":[-54.731,338.000,25.735]}},{"noteOn":{"time":168.595,"note":103.000,"xyz":[351.291,326.000,-305.528]}},{"noteOn":{"time":168.690,"note":108.000,"xyz":[-54.407,386.000,-48.796]}},{"noteOn":{"time":168.705,"note":103.000,"xyz":[204.349,326.000,-140.326]}},{"noteOn":{"time":168.735,"note":105.000,"xyz":[97.567,350.000,-180.946]}},{"noteOn":{"time":168.745,"note":91.000,"xyz":[5.917,182.000,-350.874]}},{"noteOn":{"time":168.860,"note":104.000,"xyz":[329.283,338.000,-31.384]}},{"noteOn":{"time":168.945,"note":101.000,"xyz":[-92.997,302.000,38.019]}},{"noteOn":{"time":168.995,"note":107.000,"xyz":[-130.822,374.000,100.657]}},{"noteOn":{"time":169.045,"note":111.000,"xyz":[-224.038,422.000,64.911]}},{"noteOn":{"time":169.075,"note":105.000,"xyz":[381.354,350.000,-284.876]}},{"noteOn":{"time":169.140,"note":115.000,"xyz":[-65.049,470.000,26.614]}},{"noteOn":{"time":169.145,"note":101.000,"xyz":[-151.278,302.000,-117.477]}},{"noteOn":{"time":169.150,"note":113.000,"xyz":[-84.322,446.000,-372.230]}},{"noteOn":{"time":169.230,"note":105.000,"xyz":[-121.655,350.000,-205.240]}},{"noteOn":{"time":169.295,"note":97.000,"xyz":[354.370,254.000,322.719]}},{"noteOn":{"time":169.320,"note":98.000,"xyz":[-367.042,266.000,184.464]}},{"noteOn":{"time":169.330,"note":101.000,"xyz":[230.131,302.000,126.183]}},{"noteOn":{"time":169.425,"note":101.000,"xyz":[-205.872,302.000,-240.075]}},{"noteOn":{"time":169.545,"note":100.000,"xyz":[32.042,290.000,-65.615]}},{"noteOn":{"time":169.545,"note":103.000,"xyz":[36.362,326.000,195.366]}},{"noteOn":{"time":169.580,"note":109.000,"xyz":[-14.302,398.000,-63.809]}},{"noteOn":{"time":169.720,"note":113.000,"xyz":[45.507,446.000,-318.887]}},{"noteOn":{"time":169.780,"note":103.000,"xyz":[-83.826,326.000,29.320]}},{"noteOn":{"time":169.800,"note":107.000,"xyz":[-12.780,374.000,228.783]}},{"noteOn":{"time":169.815,"note":99.000,"xyz":[-86.611,278.000,186.038]}},{"noteOn":{"time":169.835,"note":99.000,"xyz":[174.001,278.000,258.045]}},{"noteOn":{"time":169.855,"note":111.000,"xyz":[-41.341,422.000,-70.100]}},{"noteOn":{"time":169.875,"note":109.000,"xyz":[-273.405,398.000,-141.481]}},{"noteOn":{"time":169.935,"note":103.000,"xyz":[343.905,326.000,349.480]}},{"noteOn":{"time":169.965,"note":93.000,"xyz":[-54.083,206.000,307.023]}},{"noteOn":{"time":170.130,"note":107.000,"xyz":[98.366,374.000,212.242]}},{"noteOn":{"time":170.160,"note":101.000,"xyz":[-121.544,302.000,165.190]}},{"noteOn":{"time":170.270,"note":111.000,"xyz":[-167.263,422.000,-219.920]}},{"noteOn":{"time":170.280,"note":99.000,"xyz":[296.378,278.000,-260.403]}},{"noteOn":{"time":170.335,"note":98.000,"xyz":[24.542,266.000,-52.256]}},{"noteOn":{"time":170.385,"note":109.000,"xyz":[270.343,398.000,213.208]}},{"noteOn":{"time":170.395,"note":113.000,"xyz":[-5.852,446.000,-48.411]}},{"noteOn":{"time":170.480,"note":103.000,"xyz":[-349.325,326.000,278.705]}},{"noteOn":{"time":170.485,"note":109.000,"xyz":[473.395,398.000,28.088]}},{"noteOn":{"time":170.510,"note":113.000,"xyz":[159.332,446.000,-286.306]}},{"noteOn":{"time":170.530,"note":97.000,"xyz":[-4.678,254.000,-13.747]}},{"noteOn":{"time":170.605,"note":113.000,"xyz":[188.526,446.000,395.497]}},{"noteOn":{"time":170.645,"note":101.000,"xyz":[13.891,302.000,429.740]}},{"noteOn":{"time":170.855,"note":101.000,"xyz":[-281.573,302.000,-269.619]}},{"noteOn":{"time":170.885,"note":97.000,"xyz":[-17.246,254.000,-386.823]}},{"noteOn":{"time":170.915,"note":97.000,"xyz":[91.557,254.000,16.138]}},{"noteOn":{"time":170.965,"note":93.000,"xyz":[-276.880,206.000,22.619]}},{"noteOn":{"time":171.025,"note":107.000,"xyz":[18.155,374.000,-1.120]}},{"noteOn":{"time":171.080,"note":103.000,"xyz":[-118.186,326.000,-153.713]}},{"noteOn":{"time":171.105,"note":95.000,"xyz":[5.383,230.000,-5.645]}},{"noteOn":{"time":171.125,"note":111.000,"xyz":[270.670,422.000,-189.440]}},{"noteOn":{"time":171.160,"note":101.000,"xyz":[0.385,302.000,-77.931]}},{"noteOn":{"time":171.210,"note":109.000,"xyz":[-6.836,398.000,-36.536]}},{"noteOn":{"time":171.210,"note":98.000,"xyz":[213.436,266.000,316.474]}},{"noteOn":{"time":171.265,"note":115.000,"xyz":[82.138,470.000,9.112]}},{"noteOn":{"time":171.290,"note":105.000,"xyz":[-429.200,350.000,72.667]}},{"noteOn":{"time":171.295,"note":101.000,"xyz":[316.827,302.000,243.881]}},{"noteOn":{"time":171.455,"note":111.000,"xyz":[-59.090,422.000,133.067]}},{"noteOn":{"time":171.630,"note":99.000,"xyz":[47.674,278.000,-227.054]}},{"noteOn":{"time":171.730,"note":105.000,"xyz":[-156.607,350.000,-54.388]}},{"noteOn":{"time":171.750,"note":100.000,"xyz":[160.454,290.000,-77.284]}},{"noteOn":{"time":171.755,"note":99.000,"xyz":[390.376,278.000,-63.645]}},{"noteOn":{"time":171.755,"note":103.000,"xyz":[-261.656,326.000,59.838]}},{"noteOn":{"time":171.770,"note":105.000,"xyz":[68.705,350.000,-28.906]}},{"noteOn":{"time":171.775,"note":95.000,"xyz":[23.440,230.000,-253.068]}},{"noteOn":{"time":171.780,"note":103.000,"xyz":[-100.050,326.000,165.812]}},{"noteOn":{"time":171.790,"note":101.000,"xyz":[400.064,302.000,-298.840]}},{"noteOn":{"time":171.835,"note":109.000,"xyz":[-373.979,398.000,127.436]}},{"noteOn":{"time":171.895,"note":109.000,"xyz":[-6.896,398.000,76.849]}},{"noteOn":{"time":171.920,"note":109.000,"xyz":[357.251,398.000,92.547]}},{"noteOn":{"time":171.965,"note":105.000,"xyz":[-14.834,350.000,-31.341]}},{"noteOn":{"time":172.080,"note":105.000,"xyz":[-6.274,350.000,129.493]}},{"noteOn":{"time":172.140,"note":107.000,"xyz":[93.879,374.000,281.998]}},{"noteOn":{"time":172.240,"note":95.000,"xyz":[-60.232,230.000,-124.298]}},{"noteOn":{"time":172.300,"note":92.000,"xyz":[-332.031,194.000,92.298]}},{"noteOn":{"time":172.370,"note":103.000,"xyz":[71.771,326.000,106.568]}},{"noteOn":{"time":172.385,"note":107.000,"xyz":[-73.381,374.000,153.335]}},{"noteOn":{"time":172.410,"note":107.000,"xyz":[-408.922,374.000,-136.029]}},{"noteOn":{"time":172.445,"note":99.000,"xyz":[-35.726,278.000,173.928]}},{"noteOn":{"time":172.445,"note":105.000,"xyz":[-109.699,350.000,108.995]}},{"noteOn":{"time":172.475,"note":111.000,"xyz":[30.968,422.000,7.126]}},{"noteOn":{"time":172.550,"note":105.000,"xyz":[306.098,350.000,381.675]}},{"noteOn":{"time":172.685,"note":107.000,"xyz":[-160.572,374.000,88.395]}},{"noteOn":{"time":172.710,"note":105.000,"xyz":[-124.068,350.000,-233.675]}},{"noteOn":{"time":172.745,"note":105.000,"xyz":[225.900,350.000,208.438]}},{"noteOn":{"time":172.830,"note":115.000,"xyz":[295.954,470.000,-230.231]}},{"noteOn":{"time":172.855,"note":107.000,"xyz":[280.639,374.000,-42.606]}},{"noteOn":{"time":172.880,"note":97.000,"xyz":[294.373,254.000,396.081]}},{"noteOn":{"time":172.935,"note":108.000,"xyz":[90.482,386.000,70.887]}},{"noteOn":{"time":172.970,"note":100.000,"xyz":[192.008,290.000,-43.000]}},{"noteOn":{"time":173.005,"note":97.000,"xyz":[199.218,254.000,-350.607]}},{"noteOn":{"time":173.050,"note":105.000,"xyz":[309.894,350.000,317.672]}},{"noteOn":{"time":173.055,"note":103.000,"xyz":[-98.335,326.000,-118.309]}},{"noteOn":{"time":173.095,"note":107.000,"xyz":[245.624,374.000,388.845]}},{"noteOn":{"time":173.100,"note":107.000,"xyz":[-261.757,374.000,-188.474]}},{"noteOn":{"time":173.165,"note":92.000,"xyz":[492.356,194.000,84.216]}},{"noteOn":{"time":173.165,"note":103.000,"xyz":[171.560,326.000,-129.549]}},{"noteOn":{"time":173.290,"note":103.000,"xyz":[-77.220,326.000,36.195]}},{"noteOn":{"time":173.355,"note":111.000,"xyz":[-13.746,422.000,-37.828]}},{"noteOn":{"time":173.385,"note":114.000,"xyz":[22.525,458.000,-16.414]}},{"noteOn":{"time":173.570,"note":100.000,"xyz":[-241.182,290.000,-5.533]}},{"noteOn":{"time":173.605,"note":105.000,"xyz":[189.678,350.000,155.413]}},{"noteOn":{"time":173.635,"note":99.000,"xyz":[108.515,278.000,98.880]}},{"noteOn":{"time":173.665,"note":101.000,"xyz":[29.404,302.000,0.110]}},{"noteOn":{"time":173.670,"note":102.000,"xyz":[-17.564,314.000,-4.343]}},{"noteOn":{"time":173.755,"note":110.000,"xyz":[155.665,410.000,294.456]}},{"noteOn":{"time":173.795,"note":112.000,"xyz":[20.568,434.000,-349.256]}},{"noteOn":{"time":173.825,"note":104.000,"xyz":[198.030,338.000,-298.244]}},{"noteOn":{"time":173.885,"note":101.000,"xyz":[131.626,302.000,-128.908]}},{"noteOn":{"time":173.895,"note":109.000,"xyz":[429.578,398.000,138.111]}},{"noteOn":{"time":173.920,"note":99.000,"xyz":[78.709,278.000,391.544]}},{"noteOn":{"time":173.940,"note":100.000,"xyz":[-101.082,290.000,195.501]}},{"noteOn":{"time":173.985,"note":105.000,"xyz":[-248.397,350.000,302.139]}},{"noteOn":{"time":174.180,"note":108.000,"xyz":[-70.322,386.000,471.670]}},{"noteOn":{"time":174.195,"note":98.000,"xyz":[-25.761,266.000,-300.774]}},{"noteOn":{"time":174.245,"note":96.000,"xyz":[-292.427,242.000,-95.711]}},{"noteOn":{"time":174.290,"note":114.000,"xyz":[-32.536,458.000,-32.078]}},{"noteOn":{"time":174.355,"note":110.000,"xyz":[-202.123,410.000,298.059]}},{"noteOn":{"time":174.440,"note":112.000,"xyz":[330.073,434.000,15.559]}},{"noteOn":{"time":174.545,"note":92.000,"xyz":[38.377,194.000,39.521]}},{"noteOn":{"time":174.550,"note":104.000,"xyz":[-3.145,338.000,-209.242]}},{"noteOn":{"time":174.555,"note":103.000,"xyz":[169.628,326.000,-412.512]}},{"noteOn":{"time":174.570,"note":101.000,"xyz":[-95.577,302.000,454.154]}},{"noteOn":{"time":174.600,"note":98.000,"xyz":[-94.978,266.000,32.278]}},{"noteOn":{"time":174.605,"note":110.000,"xyz":[341.491,410.000,117.315]}},{"noteOn":{"time":174.670,"note":108.000,"xyz":[-21.595,386.000,236.727]}},{"noteOn":{"time":174.750,"note":97.000,"xyz":[-1.634,254.000,12.798]}},{"noteOn":{"time":174.785,"note":108.000,"xyz":[-188.866,386.000,58.471]}},{"noteOn":{"time":174.810,"note":100.000,"xyz":[322.713,290.000,42.529]}},{"noteOn":{"time":174.905,"note":94.000,"xyz":[-126.410,218.000,-32.865]}},{"noteOn":{"time":174.920,"note":104.000,"xyz":[37.137,338.000,303.368]}},{"noteOn":{"time":174.955,"note":102.000,"xyz":[301.241,314.000,288.830]}},{"noteOn":{"time":175.085,"note":112.000,"xyz":[289.408,434.000,142.925]}},{"noteOn":{"time":175.145,"note":110.000,"xyz":[-76.304,410.000,-283.438]}},{"noteOn":{"time":175.230,"note":98.000,"xyz":[412.622,266.000,-221.083]}},{"noteOn":{"time":175.405,"note":110.000,"xyz":[5.762,410.000,-118.711]}},{"noteOn":{"time":175.445,"note":96.000,"xyz":[-202.945,242.000,58.751]}},{"noteOn":{"time":175.480,"note":104.000,"xyz":[-182.796,338.000,-441.652]}},{"noteOn":{"time":175.495,"note":94.000,"xyz":[340.612,218.000,203.023]}},{"noteOn":{"time":175.520,"note":104.000,"xyz":[282.158,338.000,-68.046]}},{"noteOn":{"time":175.580,"note":114.000,"xyz":[-60.611,458.000,94.521]}},{"noteOn":{"time":175.590,"note":110.000,"xyz":[-109.656,410.000,-131.428]}},{"noteOn":{"time":175.650,"note":99.000,"xyz":[-110.755,278.000,172.566]}},{"noteOn":{"time":175.650,"note":104.000,"xyz":[307.213,338.000,388.793]}},{"noteOn":{"time":175.730,"note":106.000,"xyz":[186.729,362.000,153.743]}},{"noteOn":{"time":175.770,"note":113.000,"xyz":[-92.068,446.000,90.869]}},{"noteOn":{"time":175.785,"note":102.000,"xyz":[-1.960,314.000,-22.874]}},{"noteOn":{"time":175.865,"note":108.000,"xyz":[90.484,386.000,247.111]}},{"noteOn":{"time":176.165,"note":101.000,"xyz":[-172.561,302.000,-354.678]}},{"noteOn":{"time":176.170,"note":102.000,"xyz":[-96.995,314.000,-455.480]}},{"noteOn":{"time":176.215,"note":110.000,"xyz":[-70.668,410.000,-131.030]}},{"noteOn":{"time":176.225,"note":116.000,"xyz":[350.146,482.000,195.516]}},{"noteOn":{"time":176.270,"note":100.000,"xyz":[80.978,290.000,-121.295]}},{"noteOn":{"time":176.295,"note":106.000,"xyz":[62.085,362.000,-35.686]}},{"noteOn":{"time":176.385,"note":106.000,"xyz":[-88.443,362.000,-176.885]}},{"noteOn":{"time":176.400,"note":96.000,"xyz":[10.000,242.000,346.952]}},{"noteOn":{"time":176.485,"note":108.000,"xyz":[361.133,386.000,301.518]}},{"noteOn":{"time":176.570,"note":106.000,"xyz":[-161.828,362.000,228.903]}},{"noteOn":{"time":176.715,"note":98.000,"xyz":[486.096,266.000,-75.983]}},{"noteOn":{"time":176.735,"note":91.000,"xyz":[163.803,182.000,-208.201]}},{"noteOn":{"time":176.745,"note":115.000,"xyz":[88.995,470.000,56.290]}},{"noteOn":{"time":176.865,"note":98.000,"xyz":[106.758,266.000,318.894]}},{"noteOn":{"time":176.910,"note":104.000,"xyz":[-25.858,338.000,86.689]}},{"noteOn":{"time":176.925,"note":96.000,"xyz":[-217.817,242.000,124.719]}},{"noteOn":{"time":177.040,"note":106.000,"xyz":[78.344,362.000,16.712]}},{"noteOn":{"time":177.060,"note":112.000,"xyz":[-300.637,434.000,-39.986]}},{"noteOn":{"time":177.150,"note":116.000,"xyz":[-217.804,482.000,-388.709]}},{"noteOn":{"time":177.165,"note":106.000,"xyz":[58.034,362.000,108.959]}},{"noteOn":{"time":177.435,"note":100.000,"xyz":[16.250,290.000,-0.243]}},{"noteOn":{"time":177.445,"note":98.000,"xyz":[-151.498,266.000,163.369]}},{"noteOn":{"time":177.445,"note":100.000,"xyz":[-231.786,290.000,-261.849]}},{"noteOn":{"time":177.485,"note":102.000,"xyz":[-365.464,314.000,-142.764]}},{"noteOn":{"time":177.560,"note":108.000,"xyz":[361.555,386.000,-4.656]}},{"noteOn":{"time":177.580,"note":93.000,"xyz":[-417.975,206.000,86.264]}},{"noteOn":{"time":177.690,"note":107.000,"xyz":[-251.787,374.000,300.913]}},{"noteOn":{"time":177.955,"note":96.000,"xyz":[-81.154,242.000,122.543]}},{"noteOn":{"time":178.050,"note":112.000,"xyz":[306.164,434.000,-260.131]}},{"noteOn":{"time":178.055,"note":104.000,"xyz":[-36.484,338.000,33.872]}},{"noteOn":{"time":178.110,"note":100.000,"xyz":[146.125,290.000,311.551]}},{"noteOn":{"time":178.145,"note":114.000,"xyz":[180.089,458.000,73.786]}},{"noteOn":{"time":178.200,"note":103.000,"xyz":[-390.065,326.000,-273.679]}},{"noteOn":{"time":178.210,"note":111.000,"xyz":[-313.206,422.000,234.542]}},{"noteOn":{"time":178.335,"note":99.000,"xyz":[-0.807,278.000,-453.115]}},{"noteOn":{"time":178.355,"note":102.000,"xyz":[-187.046,314.000,-409.087]}},{"noteOn":{"time":178.555,"note":107.000,"xyz":[412.412,374.000,-259.159]}},{"noteOn":{"time":178.705,"note":93.000,"xyz":[234.043,206.000,375.722]}},{"noteOn":{"time":178.705,"note":104.000,"xyz":[197.469,338.000,225.421]}},{"noteOn":{"time":178.890,"note":109.000,"xyz":[-120.005,398.000,-103.051]}},{"noteOn":{"time":178.900,"note":108.000,"xyz":[304.519,386.000,-225.168]}},{"noteOn":{"time":178.920,"note":98.000,"xyz":[-347.788,266.000,302.448]}},{"noteOn":{"time":179.130,"note":93.000,"xyz":[432.758,206.000,-144.875]}},{"noteOn":{"time":179.165,"note":97.000,"xyz":[83.669,254.000,162.674]}},{"noteOn":{"time":179.170,"note":104.000,"xyz":[32.798,338.000,421.540]}},{"noteOn":{"time":179.215,"note":103.000,"xyz":[98.379,326.000,-120.261]}},{"noteOn":{"time":179.345,"note":115.000,"xyz":[290.437,470.000,-194.294]}},{"noteOn":{"time":179.405,"note":115.000,"xyz":[-175.145,470.000,133.386]}},{"noteOn":{"time":179.410,"note":111.000,"xyz":[189.250,422.000,157.484]}},{"noteOn":{"time":179.510,"note":112.000,"xyz":[1.722,434.000,133.945]}},{"noteOn":{"time":179.880,"note":104.000,"xyz":[-300.729,338.000,89.001]}},{"noteOn":{"time":179.915,"note":96.000,"xyz":[398.343,242.000,38.648]}},{"noteOn":{"time":179.990,"note":101.000,"xyz":[-0.415,302.000,170.854]}},{"noteOn":{"time":180.025,"note":95.000,"xyz":[-371.939,230.000,173.402]}},{"noteOn":{"time":180.050,"note":113.000,"xyz":[347.196,446.000,-342.484]}},{"noteOn":{"time":180.055,"note":109.000,"xyz":[-258.300,398.000,-293.240]}},{"noteOn":{"time":180.085,"note":99.000,"xyz":[-1.218,278.000,-68.681]}},{"noteOn":{"time":180.145,"note":107.000,"xyz":[-313.184,374.000,211.287]}},{"noteOn":{"time":180.245,"note":117.000,"xyz":[-186.841,494.000,-236.072]}},{"noteOn":{"time":180.535,"note":99.000,"xyz":[205.350,278.000,77.673]}},{"noteOn":{"time":180.595,"note":102.000,"xyz":[-9.458,314.000,-42.338]}},{"noteOn":{"time":180.675,"note":113.000,"xyz":[-264.756,446.000,112.538]}},{"noteOn":{"time":180.715,"note":97.000,"xyz":[-364.379,254.000,-229.557]}},{"noteOn":{"time":180.745,"note":99.000,"xyz":[162.812,278.000,60.037]}},{"noteOn":{"time":180.775,"note":105.000,"xyz":[-353.062,350.000,-164.312]}},{"noteOn":{"time":180.915,"note":107.000,"xyz":[-258.475,374.000,-312.740]}},{"noteOn":{"time":181.120,"note":105.000,"xyz":[167.690,350.000,184.901]}},{"noteOn":{"time":181.190,"note":92.000,"xyz":[196.655,194.000,155.138]}},{"noteOn":{"time":181.215,"note":115.000,"xyz":[141.668,470.000,-373.807]}},{"noteOn":{"time":181.290,"note":97.000,"xyz":[103.804,254.000,76.971]}},{"noteOn":{"time":181.340,"note":101.000,"xyz":[210.696,302.000,318.080]}},{"noteOn":{"time":181.355,"note":103.000,"xyz":[249.455,326.000,-79.778]}},{"noteOn":{"time":181.525,"note":97.000,"xyz":[-98.094,254.000,184.259]}},{"noteOn":{"time":181.755,"note":106.000,"xyz":[-325.083,362.000,-343.886]}},{"noteOn":{"time":181.905,"note":115.000,"xyz":[83.447,470.000,110.542]}},{"noteOn":{"time":181.910,"note":95.000,"xyz":[230.289,230.000,214.364]}},{"noteOn":{"time":181.915,"note":109.000,"xyz":[1.839,398.000,-1.440]}},{"noteOn":{"time":181.925,"note":101.000,"xyz":[454.908,302.000,163.362]}},{"noteOn":{"time":181.945,"note":101.000,"xyz":[204.802,302.000,-8.229]}},{"noteOn":{"time":182.010,"note":94.000,"xyz":[4.596,218.000,25.498]}},{"noteOn":{"time":182.125,"note":99.000,"xyz":[-17.699,278.000,-28.615]}},{"noteOn":{"time":182.370,"note":108.000,"xyz":[213.998,386.000,9.035]}},{"noteOn":{"time":182.445,"note":113.000,"xyz":[93.122,446.000,24.187]}},{"noteOn":{"time":182.670,"note":99.000,"xyz":[-420.216,278.000,-132.795]}},{"noteOn":{"time":182.735,"note":103.000,"xyz":[0.375,326.000,17.280]}},{"noteOn":{"time":182.745,"note":98.000,"xyz":[78.400,266.000,-25.608]}},{"noteOn":{"time":182.745,"note":93.000,"xyz":[-3.294,206.000,3.814]}},{"noteOn":{"time":182.750,"note":111.000,"xyz":[108.260,422.000,246.519]}},{"noteOn":{"time":182.915,"note":103.000,"xyz":[-13.174,326.000,92.337]}},{"noteOn":{"time":183.070,"note":114.000,"xyz":[-2.395,458.000,-0.916]}},{"noteOn":{"time":183.150,"note":109.000,"xyz":[-28.550,398.000,-306.587]}},{"noteOn":{"time":183.345,"note":103.000,"xyz":[-144.210,326.000,6.666]}},{"noteOn":{"time":183.360,"note":97.000,"xyz":[-132.180,254.000,132.618]}},{"noteOn":{"time":183.585,"note":109.000,"xyz":[-21.910,398.000,-338.285]}},{"noteOn":{"time":183.845,"note":112.000,"xyz":[-44.328,434.000,-101.361]}},{"noteOn":{"time":183.885,"note":105.000,"xyz":[210.705,350.000,183.084]}},{"noteOn":{"time":184.200,"note":105.000,"xyz":[-203.164,350.000,41.379]}},{"noteOn":{"time":184.210,"note":100.000,"xyz":[345.888,290.000,-46.438]}},{"noteOn":{"time":184.475,"note":95.000,"xyz":[-221.633,230.000,244.910]}},{"noteOn":{"time":184.580,"note":116.000,"xyz":[-436.982,482.000,207.162]}},{"noteOn":{"time":184.705,"note":114.000,"xyz":[108.561,458.000,103.491]}},{"noteOn":{"time":185.120,"note":97.000,"xyz":[-380.147,254.000,92.821]}},{"noteOn":{"time":185.185,"note":105.000,"xyz":[-168.439,350.000,-436.889]}},{"noteOn":{"time":185.255,"note":116.000,"xyz":[-133.875,482.000,60.466]}},{"noteOn":{"time":185.640,"note":116.000,"xyz":[-309.486,482.000,0.529]}},{"noteOn":{"time":185.920,"note":102.000,"xyz":[174.364,314.000,-281.046]}},{"noteOn":{"time":186.055,"note":98.000,"xyz":[-279.096,266.000,-132.388]}},{"noteOn":{"time":186.095,"note":108.000,"xyz":[401.795,386.000,-64.160]}},{"noteOn":{"time":186.610,"note":110.000,"xyz":[391.632,410.000,-134.313]}},{"noteOn":{"time":186.625,"note":106.000,"xyz":[-15.171,362.000,164.425]}},{"noteOn":{"time":186.660,"note":100.000,"xyz":[294.485,290.000,-327.223]}},{"noteOn":{"time":187.475,"note":104.000,"xyz":[-345.748,338.000,-145.607]}},{"noteOn":{"time":187.530,"note":109.000,"xyz":[-108.450,398.000,-69.146]}},{"noteOn":{"time":188.355,"note":106.000,"xyz":[-7.996,362.000,-44.081]}},{"noteOn":{"time":188.355,"note":113.000,"xyz":[-81.746,446.000,-67.106]}},{"noteOn":{"time":188.920,"note":96.000,"xyz":[-184.392,242.000,-318.486]}},{"noteOn":{"time":189.095,"note":111.000,"xyz":[442.944,422.000,-223.421]}},{"noteOn":{"time":189.430,"note":98.000,"xyz":[36.532,266.000,470.392]}},{"noteOn":{"time":189.760,"note":115.000,"xyz":[-1.529,470.000,6.353]}},{"noteOn":{"time":190.380,"note":102.000,"xyz":[67.546,314.000,-260.158]}},{"noteOn":{"time":191.275,"note":100.000,"xyz":[20.475,290.000,-12.716]}},{"noteOn":{"time":191.940,"note":105.000,"xyz":[-95.120,350.000,24.196]}},{"noteOn":{"time":192.665,"note":107.000,"xyz":[-272.962,374.000,-184.809]}},{"noteOn":{"time":193.385,"note":97.000,"xyz":[180.331,254.000,148.495]}},{"noteOn":{"time":194.050,"note":99.000,"xyz":[31.051,278.000,206.344]}},{"noteOn":{"time":194.945,"note":101.000,"xyz":[127.966,302.000,66.231]}},{"noteOn":{"time":195.895,"note":99.000,"xyz":[371.021,278.000,45.525]}},{"noteOn":{"time":196.410,"note":105.000,"xyz":[-79.835,350.000,-59.354]}},{"noteOn":{"time":196.975,"note":106.000,"xyz":[295.058,362.000,378.568]}},{"noteOn":{"time":197.850,"note":98.000,"xyz":[88.787,266.000,-96.635]}},{"noteOn":{"time":198.670,"note":100.000,"xyz":[262.862,290.000,-92.311]}},{"noteOn":{"time":199.410,"note":100.000,"xyz":[-432.737,290.000,-171.013]}},{"noteOn":{"time":200.210,"note":98.000,"xyz":[-69.984,266.000,-78.640]}},{"noteOn":{"time":200.855,"note":106.000,"xyz":[104.418,362.000,157.330]}},{"noteOn":{"time":201.445,"note":106.000,"xyz":[142.289,362.000,-478.213]}}],"9037b759-36e4-4600-b2cb-03383ebd65c1":[{"instanceName":"","duration":80,"gridColumnCount":30,"gridRowCount":30,"gridCellSize":30,"fullVolumeY":2,"speedY":15,"maxDistance":100,"maxHeight":100},{"noteOn":{"time":117.000,"column":26,"row":14}},{"noteOn":{"time":117.090,"column":8,"row":21}},{"noteOn":{"time":117.180,"column":27,"row":23}},{"noteOn":{"time":117.270,"column":3,"row":13}},{"noteOn":{"time":117.355,"column":0,"row":4}},{"noteOn":{"time":117.445,"column":15,"row":3}},{"noteOn":{"time":117.535,"column":18,"row":13}},{"noteOn":{"time":117.625,"column":25,"row":29}},{"noteOn":{"time":117.710,"column":26,"row":27}},{"noteOn":{"time":117.800,"column":16,"row":24}},{"noteOn":{"time":117.890,"column":20,"row":29}},{"noteOn":{"time":117.980,"column":13,"row":17}},{"noteOn":{"time":118.070,"column":21,"row":10}},{"noteOn":{"time":118.155,"column":0,"row":11}},{"noteOn":{"time":118.245,"column":22,"row":21}},{"noteOn":{"time":118.335,"column":22,"row":22}},{"noteOn":{"time":118.425,"column":7,"row":27}},{"noteOn":{"time":118.510,"column":9,"row":1}},{"noteOn":{"time":118.600,"column":0,"row":26}},{"noteOn":{"time":118.690,"column":16,"row":23}},{"noteOn":{"time":118.780,"column":27,"row":26}},{"noteOn":{"time":118.870,"column":11,"row":29}},{"noteOn":{"time":118.955,"column":18,"row":5}},{"noteOn":{"time":119.045,"column":24,"row":0}},{"noteOn":{"time":119.135,"column":12,"row":29}},{"noteOn":{"time":119.225,"column":20,"row":11}},{"noteOn":{"time":119.310,"column":26,"row":5}},{"noteOn":{"time":119.400,"column":3,"row":17}},{"noteOn":{"time":119.490,"column":24,"row":19}},{"noteOn":{"time":119.580,"column":13,"row":8}},{"noteOn":{"time":119.670,"column":29,"row":0}},{"noteOn":{"time":119.755,"column":6,"row":4}},{"noteOn":{"time":119.845,"column":27,"row":16}},{"noteOn":{"time":119.935,"column":21,"row":28}},{"noteOn":{"time":120.025,"column":12,"row":12}},{"noteOn":{"time":120.110,"column":22,"row":0}},{"noteOn":{"time":120.200,"column":3,"row":22}},{"noteOn":{"time":120.290,"column":9,"row":15}},{"noteOn":{"time":120.380,"column":7,"row":15}},{"noteOn":{"time":120.470,"column":26,"row":21}},{"noteOn":{"time":120.555,"column":12,"row":8}},{"noteOn":{"time":120.645,"column":0,"row":2}},{"noteOn":{"time":120.735,"column":3,"row":28}},{"noteOn":{"time":120.825,"column":21,"row":20}},{"noteOn":{"time":120.910,"column":22,"row":28}},{"noteOn":{"time":121.000,"column":19,"row":2}},{"noteOn":{"time":121.090,"column":10,"row":23}},{"noteOn":{"time":121.180,"column":27,"row":25}},{"noteOn":{"time":121.270,"column":14,"row":12}},{"noteOn":{"time":121.355,"column":14,"row":21}},{"noteOn":{"time":121.445,"column":26,"row":28}},{"noteOn":{"time":121.535,"column":20,"row":17}},{"noteOn":{"time":121.625,"column":2,"row":25}},{"noteOn":{"time":121.710,"column":25,"row":1}},{"noteOn":{"time":121.800,"column":17,"row":1}},{"noteOn":{"time":121.890,"column":23,"row":8}},{"noteOn":{"time":121.980,"column":23,"row":29}},{"noteOn":{"time":122.070,"column":28,"row":10}},{"noteOn":{"time":122.155,"column":6,"row":24}},{"noteOn":{"time":122.245,"column":28,"row":17}},{"noteOn":{"time":122.335,"column":19,"row":15}},{"noteOn":{"time":122.425,"column":24,"row":16}},{"noteOn":{"time":122.510,"column":15,"row":19}},{"noteOn":{"time":122.600,"column":11,"row":6}},{"noteOn":{"time":122.690,"column":28,"row":26}},{"noteOn":{"time":122.780,"column":11,"row":23}},{"noteOn":{"time":122.870,"column":15,"row":5}},{"noteOn":{"time":122.955,"column":22,"row":3}},{"noteOn":{"time":123.045,"column":15,"row":20}},{"noteOn":{"time":123.135,"column":29,"row":8}},{"noteOn":{"time":123.225,"column":8,"row":7}},{"noteOn":{"time":123.310,"column":0,"row":14}},{"noteOn":{"time":123.400,"column":24,"row":29}},{"noteOn":{"time":123.490,"column":3,"row":16}},{"noteOn":{"time":123.580,"column":9,"row":24}},{"noteOn":{"time":123.670,"column":7,"row":28}},{"noteOn":{"time":123.755,"column":6,"row":7}},{"noteOn":{"time":123.845,"column":13,"row":0}},{"noteOn":{"time":123.935,"column":11,"row":19}},{"noteOn":{"time":124.025,"column":29,"row":12}},{"noteOn":{"time":124.110,"column":15,"row":18}},{"noteOn":{"time":124.200,"column":22,"row":20}},{"noteOn":{"time":124.290,"column":25,"row":22}},{"noteOn":{"time":124.380,"column":16,"row":1}},{"noteOn":{"time":124.470,"column":3,"row":7}},{"noteOn":{"time":124.555,"column":21,"row":29}},{"noteOn":{"time":124.645,"column":3,"row":4}},{"noteOn":{"time":124.735,"column":3,"row":19}},{"noteOn":{"time":124.825,"column":24,"row":27}},{"noteOn":{"time":124.910,"column":27,"row":13}},{"noteOn":{"time":125.000,"column":9,"row":3}},{"noteOn":{"time":125.090,"column":0,"row":24}},{"noteOn":{"time":125.180,"column":16,"row":7}},{"noteOn":{"time":125.270,"column":21,"row":0}},{"noteOn":{"time":125.355,"column":16,"row":21}},{"noteOn":{"time":125.445,"column":3,"row":26}},{"noteOn":{"time":125.535,"column":10,"row":0}},{"noteOn":{"time":125.625,"column":27,"row":27}},{"noteOn":{"time":125.710,"column":12,"row":10}},{"noteOn":{"time":125.800,"column":4,"row":1}},{"noteOn":{"time":125.890,"column":10,"row":6}},{"noteOn":{"time":125.980,"column":21,"row":3}},{"noteOn":{"time":126.070,"column":2,"row":26}},{"noteOn":{"time":126.155,"column":19,"row":19}},{"noteOn":{"time":126.245,"column":0,"row":1}},{"noteOn":{"time":126.335,"column":1,"row":10}},{"noteOn":{"time":126.425,"column":1,"row":20}},{"noteOn":{"time":126.510,"column":14,"row":9}},{"noteOn":{"time":126.600,"column":29,"row":28}},{"noteOn":{"time":126.690,"column":6,"row":0}},{"noteOn":{"time":126.780,"column":17,"row":29}},{"noteOn":{"time":126.870,"column":9,"row":2}},{"noteOn":{"time":126.955,"column":10,"row":18}},{"noteOn":{"time":127.045,"column":25,"row":14}},{"noteOn":{"time":127.135,"column":24,"row":18}},{"noteOn":{"time":127.225,"column":0,"row":19}},{"noteOn":{"time":127.310,"column":10,"row":21}},{"noteOn":{"time":127.400,"column":17,"row":11}},{"noteOn":{"time":127.490,"column":28,"row":1}},{"noteOn":{"time":127.580,"column":8,"row":24}},{"noteOn":{"time":127.670,"column":7,"row":10}},{"noteOn":{"time":127.755,"column":2,"row":16}},{"noteOn":{"time":127.845,"column":23,"row":22}},{"noteOn":{"time":127.935,"column":26,"row":26}},{"noteOn":{"time":128.025,"column":28,"row":4}},{"noteOn":{"time":128.110,"column":11,"row":9}},{"noteOn":{"time":128.200,"column":11,"row":14}},{"noteOn":{"time":128.290,"column":3,"row":21}},{"noteOn":{"time":128.380,"column":4,"row":17}},{"noteOn":{"time":128.470,"column":19,"row":18}},{"noteOn":{"time":128.555,"column":6,"row":27}},{"noteOn":{"time":128.645,"column":6,"row":23}},{"noteOn":{"time":128.735,"column":21,"row":11}},{"noteOn":{"time":128.825,"column":21,"row":19}},{"noteOn":{"time":128.910,"column":7,"row":6}},{"noteOn":{"time":129.000,"column":25,"row":11}},{"noteOn":{"time":129.090,"column":0,"row":7}},{"noteOn":{"time":129.180,"column":2,"row":27}},{"noteOn":{"time":129.270,"column":12,"row":23}},{"noteOn":{"time":129.355,"column":17,"row":14}},{"noteOn":{"time":129.445,"column":17,"row":9}},{"noteOn":{"time":129.535,"column":5,"row":10}},{"noteOn":{"time":129.625,"column":11,"row":7}},{"noteOn":{"time":129.710,"column":11,"row":2}},{"noteOn":{"time":129.800,"column":20,"row":24}},{"noteOn":{"time":129.890,"column":6,"row":6}},{"noteOn":{"time":129.980,"column":17,"row":15}},{"noteOn":{"time":130.070,"column":11,"row":0}},{"noteOn":{"time":130.155,"column":7,"row":7}},{"noteOn":{"time":130.245,"column":23,"row":11}},{"noteOn":{"time":130.335,"column":27,"row":6}},{"noteOn":{"time":130.425,"column":10,"row":24}},{"noteOn":{"time":130.510,"column":0,"row":29}},{"noteOn":{"time":130.600,"column":4,"row":3}},{"noteOn":{"time":130.690,"column":23,"row":6}},{"noteOn":{"time":130.780,"column":28,"row":25}},{"noteOn":{"time":130.870,"column":23,"row":25}},{"noteOn":{"time":130.955,"column":16,"row":13}},{"noteOn":{"time":131.045,"column":28,"row":19}},{"noteOn":{"time":131.135,"column":3,"row":11}},{"noteOn":{"time":131.225,"column":7,"row":12}},{"noteOn":{"time":131.310,"column":19,"row":1}},{"noteOn":{"time":131.400,"column":28,"row":12}},{"noteOn":{"time":131.490,"column":20,"row":13}},{"noteOn":{"time":131.580,"column":24,"row":3}},{"noteOn":{"time":131.670,"column":5,"row":7}},{"noteOn":{"time":131.755,"column":11,"row":25}},{"noteOn":{"time":131.845,"column":4,"row":28}},{"noteOn":{"time":131.935,"column":6,"row":11}},{"noteOn":{"time":132.025,"column":24,"row":10}},{"noteOn":{"time":132.110,"column":29,"row":7}},{"noteOn":{"time":132.200,"column":18,"row":18}},{"noteOn":{"time":132.290,"column":27,"row":29}},{"noteOn":{"time":132.380,"column":1,"row":24}},{"noteOn":{"time":132.470,"column":21,"row":21}},{"noteOn":{"time":132.555,"column":21,"row":7}},{"noteOn":{"time":132.645,"column":1,"row":19}},{"noteOn":{"time":132.735,"column":29,"row":4}},{"noteOn":{"time":132.825,"column":24,"row":11}},{"noteOn":{"time":132.910,"column":4,"row":26}},{"noteOn":{"time":133.000,"column":5,"row":9}},{"noteOn":{"time":133.090,"column":20,"row":28}},{"noteOn":{"time":133.180,"column":1,"row":2}},{"noteOn":{"time":133.270,"column":27,"row":22}},{"noteOn":{"time":133.355,"column":12,"row":15}},{"noteOn":{"time":133.445,"column":27,"row":20}},{"noteOn":{"time":133.535,"column":21,"row":4}},{"noteOn":{"time":133.625,"column":12,"row":20}},{"noteOn":{"time":133.710,"column":18,"row":3}},{"noteOn":{"time":133.800,"column":12,"row":3}},{"noteOn":{"time":133.890,"column":25,"row":20}},{"noteOn":{"time":133.980,"column":28,"row":6}},{"noteOn":{"time":134.070,"column":7,"row":24}},{"noteOn":{"time":134.155,"column":18,"row":8}},{"noteOn":{"time":134.245,"column":13,"row":9}},{"noteOn":{"time":134.335,"column":14,"row":26}},{"noteOn":{"time":134.425,"column":23,"row":7}},{"noteOn":{"time":134.510,"column":4,"row":13}},{"noteOn":{"time":134.600,"column":10,"row":25}},{"noteOn":{"time":134.690,"column":22,"row":16}},{"noteOn":{"time":134.780,"column":7,"row":16}},{"noteOn":{"time":134.870,"column":28,"row":5}},{"noteOn":{"time":134.955,"column":18,"row":2}},{"noteOn":{"time":135.045,"column":14,"row":11}},{"noteOn":{"time":135.135,"column":16,"row":10}},{"noteOn":{"time":135.225,"column":0,"row":6}},{"noteOn":{"time":135.310,"column":10,"row":7}},{"noteOn":{"time":135.400,"column":29,"row":9}},{"noteOn":{"time":135.490,"column":19,"row":22}},{"noteOn":{"time":135.580,"column":29,"row":24}},{"noteOn":{"time":135.670,"column":3,"row":5}},{"noteOn":{"time":135.755,"column":8,"row":16}},{"noteOn":{"time":135.845,"column":17,"row":10}},{"noteOn":{"time":135.935,"column":20,"row":21}},{"noteOn":{"time":136.025,"column":13,"row":7}},{"noteOn":{"time":136.110,"column":6,"row":14}},{"noteOn":{"time":136.200,"column":27,"row":8}},{"noteOn":{"time":136.290,"column":17,"row":3}},{"noteOn":{"time":136.380,"column":14,"row":6}},{"noteOn":{"time":136.470,"column":9,"row":16}},{"noteOn":{"time":136.555,"column":11,"row":10}},{"noteOn":{"time":136.645,"column":16,"row":17}},{"noteOn":{"time":136.735,"column":10,"row":10}},{"noteOn":{"time":136.825,"column":15,"row":8}},{"noteOn":{"time":136.910,"column":17,"row":5}},{"noteOn":{"time":137.000,"column":1,"row":12}},{"noteOn":{"time":137.090,"column":14,"row":14}},{"noteOn":{"time":137.180,"column":29,"row":5}},{"noteOn":{"time":137.270,"column":25,"row":2}},{"noteOn":{"time":137.355,"column":20,"row":16}},{"noteOn":{"time":137.445,"column":3,"row":27}},{"noteOn":{"time":137.535,"column":11,"row":22}},{"noteOn":{"time":137.625,"column":0,"row":16}},{"noteOn":{"time":137.710,"column":12,"row":5}},{"noteOn":{"time":137.800,"column":19,"row":10}},{"noteOn":{"time":137.890,"column":25,"row":24}},{"noteOn":{"time":137.980,"column":13,"row":6}},{"noteOn":{"time":138.070,"column":18,"row":11}},{"noteOn":{"time":138.155,"column":15,"row":15}},{"noteOn":{"time":138.245,"column":24,"row":23}},{"noteOn":{"time":138.335,"column":16,"row":29}},{"noteOn":{"time":138.425,"column":24,"row":17}},{"noteOn":{"time":138.510,"column":27,"row":7}},{"noteOn":{"time":138.600,"column":29,"row":13}},{"noteOn":{"time":138.690,"column":27,"row":18}},{"noteOn":{"time":138.780,"column":1,"row":13}},{"noteOn":{"time":138.870,"column":12,"row":16}},{"noteOn":{"time":138.955,"column":29,"row":27}},{"noteOn":{"time":139.045,"column":9,"row":13}},{"noteOn":{"time":139.135,"column":10,"row":17}},{"noteOn":{"time":139.225,"column":9,"row":4}},{"noteOn":{"time":139.310,"column":15,"row":25}},{"noteOn":{"time":139.400,"column":18,"row":7}},{"noteOn":{"time":139.490,"column":3,"row":8}},{"noteOn":{"time":139.580,"column":8,"row":19}},{"noteOn":{"time":139.670,"column":24,"row":9}},{"noteOn":{"time":139.755,"column":10,"row":14}},{"noteOn":{"time":139.845,"column":2,"row":5}},{"noteOn":{"time":139.935,"column":22,"row":2}},{"noteOn":{"time":140.025,"column":22,"row":1}},{"noteOn":{"time":140.110,"column":5,"row":14}},{"noteOn":{"time":140.200,"column":25,"row":5}},{"noteOn":{"time":140.290,"column":22,"row":27}},{"noteOn":{"time":140.380,"column":11,"row":5}},{"noteOn":{"time":140.470,"column":19,"row":20}},{"noteOn":{"time":140.555,"column":10,"row":11}},{"noteOn":{"time":140.645,"column":23,"row":12}},{"noteOn":{"time":140.735,"column":8,"row":25}},{"noteOn":{"time":140.825,"column":3,"row":20}},{"noteOn":{"time":140.910,"column":28,"row":18}},{"noteOn":{"time":141.000,"column":6,"row":8}},{"noteOn":{"time":141.090,"column":2,"row":8}},{"noteOn":{"time":141.180,"column":16,"row":15}},{"noteOn":{"time":141.270,"column":21,"row":16}},{"noteOn":{"time":141.355,"column":17,"row":26}},{"noteOn":{"time":141.445,"column":23,"row":10}},{"noteOn":{"time":141.535,"column":19,"row":23}},{"noteOn":{"time":141.625,"column":28,"row":21}},{"noteOn":{"time":141.710,"column":11,"row":17}},{"noteOn":{"time":141.800,"column":18,"row":22}},{"noteOn":{"time":141.890,"column":19,"row":27}},{"noteOn":{"time":141.980,"column":23,"row":13}},{"noteOn":{"time":142.070,"column":25,"row":23}},{"noteOn":{"time":142.155,"column":22,"row":13}},{"noteOn":{"time":142.245,"column":9,"row":25}},{"noteOn":{"time":142.335,"column":17,"row":4}},{"noteOn":{"time":142.425,"column":6,"row":13}},{"noteOn":{"time":142.510,"column":27,"row":21}},{"noteOn":{"time":142.600,"column":15,"row":12}},{"noteOn":{"time":142.690,"column":16,"row":6}},{"noteOn":{"time":142.780,"column":22,"row":18}},{"noteOn":{"time":142.870,"column":23,"row":2}},{"noteOn":{"time":142.955,"column":1,"row":0}},{"noteOn":{"time":143.045,"column":15,"row":23}},{"noteOn":{"time":143.135,"column":16,"row":0}},{"noteOn":{"time":143.225,"column":18,"row":10}},{"noteOn":{"time":143.310,"column":18,"row":20}},{"noteOn":{"time":143.400,"column":4,"row":8}},{"noteOn":{"time":143.490,"column":3,"row":1}},{"noteOn":{"time":143.580,"column":4,"row":29}},{"noteOn":{"time":143.670,"column":18,"row":19}},{"noteOn":{"time":143.755,"column":15,"row":11}},{"noteOn":{"time":143.845,"column":0,"row":9}},{"noteOn":{"time":143.935,"column":16,"row":8}},{"noteOn":{"time":144.025,"column":5,"row":11}},{"noteOn":{"time":144.110,"column":19,"row":14}},{"noteOn":{"time":144.200,"column":12,"row":9}},{"noteOn":{"time":144.290,"column":17,"row":18}},{"noteOn":{"time":144.380,"column":8,"row":2}},{"noteOn":{"time":144.470,"column":18,"row":27}},{"noteOn":{"time":144.555,"column":27,"row":4}},{"noteOn":{"time":144.645,"column":2,"row":0}},{"noteOn":{"time":144.735,"column":8,"row":1}},{"noteOn":{"time":144.825,"column":15,"row":17}},{"noteOn":{"time":144.910,"column":4,"row":25}},{"noteOn":{"time":145.000,"column":15,"row":1}},{"noteOn":{"time":145.090,"column":3,"row":12}},{"noteOn":{"time":145.180,"column":29,"row":14}},{"noteOn":{"time":145.270,"column":8,"row":9}},{"noteOn":{"time":145.355,"column":29,"row":23}},{"noteOn":{"time":145.445,"column":23,"row":0}},{"noteOn":{"time":145.535,"column":2,"row":1}},{"noteOn":{"time":145.625,"column":29,"row":29}},{"noteOn":{"time":145.710,"column":11,"row":3}},{"noteOn":{"time":145.800,"column":18,"row":12}},{"noteOn":{"time":145.890,"column":20,"row":26}},{"noteOn":{"time":145.980,"column":25,"row":4}},{"noteOn":{"time":146.070,"column":17,"row":13}},{"noteOn":{"time":146.155,"column":17,"row":24}},{"noteOn":{"time":146.245,"column":8,"row":20}},{"noteOn":{"time":146.335,"column":2,"row":15}},{"noteOn":{"time":146.425,"column":18,"row":28}},{"noteOn":{"time":146.510,"column":14,"row":29}},{"noteOn":{"time":146.600,"column":9,"row":0}},{"noteOn":{"time":146.690,"column":4,"row":4}},{"noteOn":{"time":146.780,"column":6,"row":12}},{"noteOn":{"time":146.870,"column":22,"row":11}},{"noteOn":{"time":146.955,"column":8,"row":4}},{"noteOn":{"time":147.045,"column":14,"row":8}},{"noteOn":{"time":147.135,"column":18,"row":6}},{"noteOn":{"time":147.225,"column":7,"row":13}},{"noteOn":{"time":147.310,"column":6,"row":16}},{"noteOn":{"time":147.400,"column":20,"row":18}},{"noteOn":{"time":147.490,"column":24,"row":7}},{"noteOn":{"time":147.580,"column":20,"row":27}},{"noteOn":{"time":147.670,"column":14,"row":28}},{"noteOn":{"time":147.755,"column":18,"row":26}},{"noteOn":{"time":147.845,"column":5,"row":5}},{"noteOn":{"time":147.935,"column":29,"row":20}},{"noteOn":{"time":148.025,"column":21,"row":15}},{"noteOn":{"time":148.110,"column":8,"row":6}},{"noteOn":{"time":148.200,"column":6,"row":17}},{"noteOn":{"time":148.290,"column":15,"row":24}},{"noteOn":{"time":148.380,"column":25,"row":25}},{"noteOn":{"time":148.470,"column":23,"row":1}},{"noteOn":{"time":148.555,"column":5,"row":1}},{"noteOn":{"time":148.645,"column":5,"row":27}},{"noteOn":{"time":148.735,"column":5,"row":28}},{"noteOn":{"time":148.825,"column":4,"row":23}},{"noteOn":{"time":148.910,"column":10,"row":8}},{"noteOn":{"time":149.000,"column":15,"row":27}},{"noteOn":{"time":149.090,"column":17,"row":21}},{"noteOn":{"time":149.180,"column":17,"row":17}},{"noteOn":{"time":149.270,"column":22,"row":5}},{"noteOn":{"time":149.355,"column":26,"row":2}},{"noteOn":{"time":149.445,"column":21,"row":9}},{"noteOn":{"time":149.535,"column":13,"row":14}},{"noteOn":{"time":149.625,"column":1,"row":27}},{"noteOn":{"time":149.710,"column":10,"row":20}},{"noteOn":{"time":149.800,"column":28,"row":20}},{"noteOn":{"time":149.890,"column":25,"row":28}},{"noteOn":{"time":149.980,"column":11,"row":4}},{"noteOn":{"time":150.070,"column":3,"row":3}},{"noteOn":{"time":150.155,"column":24,"row":5}},{"noteOn":{"time":150.245,"column":16,"row":19}},{"noteOn":{"time":150.335,"column":28,"row":23}},{"noteOn":{"time":150.425,"column":23,"row":28}},{"noteOn":{"time":150.510,"column":25,"row":6}},{"noteOn":{"time":150.600,"column":2,"row":14}},{"noteOn":{"time":150.690,"column":26,"row":24}},{"noteOn":{"time":150.780,"column":15,"row":14}},{"noteOn":{"time":150.870,"column":21,"row":6}},{"noteOn":{"time":150.955,"column":19,"row":17}},{"noteOn":{"time":151.045,"column":27,"row":15}},{"noteOn":{"time":151.135,"column":1,"row":23}},{"noteOn":{"time":151.225,"column":26,"row":22}},{"noteOn":{"time":151.310,"column":8,"row":27}},{"noteOn":{"time":151.400,"column":2,"row":23}},{"noteOn":{"time":151.490,"column":1,"row":21}},{"noteOn":{"time":151.580,"column":25,"row":18}},{"noteOn":{"time":151.670,"column":5,"row":18}},{"noteOn":{"time":151.755,"column":15,"row":2}},{"noteOn":{"time":151.845,"column":19,"row":26}},{"noteOn":{"time":151.935,"column":29,"row":16}},{"noteOn":{"time":152.025,"column":26,"row":15}},{"noteOn":{"time":152.110,"column":9,"row":6}},{"noteOn":{"time":152.200,"column":7,"row":5}},{"noteOn":{"time":152.290,"column":17,"row":25}},{"noteOn":{"time":152.380,"column":14,"row":5}},{"noteOn":{"time":152.470,"column":5,"row":19}},{"noteOn":{"time":152.555,"column":26,"row":7}},{"noteOn":{"time":152.645,"column":22,"row":12}},{"noteOn":{"time":152.735,"column":12,"row":27}},{"noteOn":{"time":152.825,"column":22,"row":19}},{"noteOn":{"time":152.910,"column":10,"row":19}},{"noteOn":{"time":153.000,"column":12,"row":24}},{"noteOn":{"time":153.090,"column":15,"row":4}},{"noteOn":{"time":153.180,"column":5,"row":16}},{"noteOn":{"time":153.270,"column":19,"row":28}},{"noteOn":{"time":153.355,"column":23,"row":20}},{"noteOn":{"time":153.445,"column":21,"row":24}},{"noteOn":{"time":153.535,"column":21,"row":1}},{"noteOn":{"time":153.625,"column":26,"row":1}},{"noteOn":{"time":153.710,"column":8,"row":26}},{"noteOn":{"time":153.800,"column":14,"row":2}},{"noteOn":{"time":153.890,"column":13,"row":25}},{"noteOn":{"time":153.980,"column":8,"row":28}},{"noteOn":{"time":154.070,"column":26,"row":0}},{"noteOn":{"time":154.155,"column":21,"row":14}},{"noteOn":{"time":154.245,"column":12,"row":28}},{"noteOn":{"time":154.335,"column":13,"row":3}},{"noteOn":{"time":154.425,"column":12,"row":17}},{"noteOn":{"time":154.510,"column":20,"row":22}},{"noteOn":{"time":154.600,"column":9,"row":21}},{"noteOn":{"time":154.690,"column":13,"row":18}},{"noteOn":{"time":154.780,"column":17,"row":22}},{"noteOn":{"time":154.870,"column":18,"row":17}},{"noteOn":{"time":154.955,"column":1,"row":6}},{"noteOn":{"time":155.045,"column":22,"row":26}},{"noteOn":{"time":155.135,"column":9,"row":5}},{"noteOn":{"time":155.225,"column":11,"row":24}},{"noteOn":{"time":155.310,"column":22,"row":29}},{"noteOn":{"time":155.400,"column":26,"row":29}},{"noteOn":{"time":155.490,"column":12,"row":26}},{"noteOn":{"time":155.580,"column":1,"row":11}},{"noteOn":{"time":155.670,"column":28,"row":16}},{"noteOn":{"time":155.755,"column":16,"row":18}},{"noteOn":{"time":155.845,"column":3,"row":9}},{"noteOn":{"time":155.935,"column":20,"row":12}},{"noteOn":{"time":156.025,"column":22,"row":9}},{"noteOn":{"time":156.110,"column":20,"row":2}},{"noteOn":{"time":156.200,"column":27,"row":0}},{"noteOn":{"time":156.290,"column":4,"row":22}},{"noteOn":{"time":156.380,"column":13,"row":1}},{"noteOn":{"time":156.470,"column":16,"row":14}},{"noteOn":{"time":156.555,"column":8,"row":11}},{"noteOn":{"time":156.645,"column":14,"row":20}},{"noteOn":{"time":156.735,"column":9,"row":28}},{"noteOn":{"time":156.825,"column":1,"row":8}},{"noteOn":{"time":156.910,"column":3,"row":24}},{"noteOn":{"time":157.000,"column":1,"row":1}},{"noteOn":{"time":157.090,"column":24,"row":28}},{"noteOn":{"time":157.180,"column":20,"row":14}},{"noteOn":{"time":157.270,"column":19,"row":21}},{"noteOn":{"time":157.355,"column":20,"row":3}},{"noteOn":{"time":157.445,"column":16,"row":20}},{"noteOn":{"time":157.535,"column":20,"row":19}},{"noteOn":{"time":157.625,"column":25,"row":12}},{"noteOn":{"time":157.710,"column":25,"row":15}},{"noteOn":{"time":157.800,"column":11,"row":28}},{"noteOn":{"time":157.890,"column":1,"row":4}},{"noteOn":{"time":157.980,"column":18,"row":9}},{"noteOn":{"time":158.070,"column":29,"row":17}},{"noteOn":{"time":158.155,"column":1,"row":5}},{"noteOn":{"time":158.245,"column":24,"row":14}},{"noteOn":{"time":158.335,"column":14,"row":10}},{"noteOn":{"time":158.425,"column":10,"row":5}},{"noteOn":{"time":158.510,"column":13,"row":15}},{"noteOn":{"time":158.600,"column":7,"row":22}},{"noteOn":{"time":158.690,"column":23,"row":26}},{"noteOn":{"time":158.780,"column":9,"row":17}},{"noteOn":{"time":158.870,"column":13,"row":16}},{"noteOn":{"time":158.955,"column":13,"row":23}},{"noteOn":{"time":159.045,"column":26,"row":10}},{"noteOn":{"time":159.135,"column":10,"row":9}},{"noteOn":{"time":159.225,"column":23,"row":17}},{"noteOn":{"time":159.310,"column":23,"row":19}},{"noteOn":{"time":159.400,"column":28,"row":14}},{"noteOn":{"time":159.490,"column":2,"row":17}},{"noteOn":{"time":159.580,"column":2,"row":7}},{"noteOn":{"time":159.670,"column":23,"row":5}},{"noteOn":{"time":159.755,"column":22,"row":14}},{"noteOn":{"time":159.845,"column":3,"row":18}},{"noteOn":{"time":159.935,"column":5,"row":2}},{"noteOn":{"time":160.025,"column":3,"row":0}},{"noteOn":{"time":160.110,"column":6,"row":25}},{"noteOn":{"time":160.200,"column":5,"row":17}},{"noteOn":{"time":160.290,"column":17,"row":16}},{"noteOn":{"time":160.380,"column":10,"row":26}},{"noteOn":{"time":160.470,"column":7,"row":1}},{"noteOn":{"time":160.555,"column":29,"row":15}},{"noteOn":{"time":160.645,"column":23,"row":24}},{"noteOn":{"time":160.735,"column":5,"row":15}},{"noteOn":{"time":160.825,"column":22,"row":15}},{"noteOn":{"time":160.910,"column":18,"row":23}},{"noteOn":{"time":161.000,"column":9,"row":7}},{"noteOn":{"time":161.090,"column":23,"row":15}},{"noteOn":{"time":161.180,"column":3,"row":25}},{"noteOn":{"time":161.270,"column":0,"row":17}},{"noteOn":{"time":161.355,"column":5,"row":4}},{"noteOn":{"time":161.445,"column":2,"row":3}},{"noteOn":{"time":161.535,"column":10,"row":28}},{"noteOn":{"time":161.625,"column":26,"row":8}},{"noteOn":{"time":161.710,"column":22,"row":17}},{"noteOn":{"time":161.800,"column":29,"row":2}},{"noteOn":{"time":161.890,"column":18,"row":0}},{"noteOn":{"time":161.980,"column":21,"row":12}},{"noteOn":{"time":162.070,"column":5,"row":24}},{"noteOn":{"time":162.155,"column":4,"row":10}},{"noteOn":{"time":162.245,"column":28,"row":22}},{"noteOn":{"time":162.335,"column":6,"row":2}},{"noteOn":{"time":162.425,"column":7,"row":14}},{"noteOn":{"time":162.510,"column":23,"row":27}},{"noteOn":{"time":162.600,"column":15,"row":9}},{"noteOn":{"time":162.690,"column":23,"row":16}},{"noteOn":{"time":162.780,"column":21,"row":27}},{"noteOn":{"time":162.870,"column":0,"row":13}},{"noteOn":{"time":162.955,"column":23,"row":9}},{"noteOn":{"time":163.045,"column":13,"row":4}},{"noteOn":{"time":163.135,"column":10,"row":13}},{"noteOn":{"time":163.225,"column":24,"row":12}},{"noteOn":{"time":163.310,"column":16,"row":28}},{"noteOn":{"time":163.400,"column":25,"row":13}},{"noteOn":{"time":163.490,"column":8,"row":13}},{"noteOn":{"time":163.580,"column":26,"row":16}},{"noteOn":{"time":163.670,"column":11,"row":13}},{"noteOn":{"time":163.755,"column":13,"row":12}},{"noteOn":{"time":163.845,"column":1,"row":14}},{"noteOn":{"time":163.935,"column":20,"row":4}},{"noteOn":{"time":164.025,"column":4,"row":21}},{"noteOn":{"time":164.110,"column":12,"row":25}},{"noteOn":{"time":164.200,"column":6,"row":29}},{"noteOn":{"time":164.290,"column":14,"row":19}},{"noteOn":{"time":164.380,"column":21,"row":13}},{"noteOn":{"time":164.470,"column":24,"row":21}},{"noteOn":{"time":164.555,"column":17,"row":2}},{"noteOn":{"time":164.645,"column":8,"row":10}},{"noteOn":{"time":164.735,"column":7,"row":21}},{"noteOn":{"time":164.825,"column":0,"row":3}},{"noteOn":{"time":164.910,"column":0,"row":25}},{"noteOn":{"time":165.000,"column":24,"row":4}},{"noteOn":{"time":165.090,"column":13,"row":26}},{"noteOn":{"time":165.180,"column":14,"row":18}},{"noteOn":{"time":165.270,"column":17,"row":0}},{"noteOn":{"time":165.355,"column":4,"row":2}},{"noteOn":{"time":165.445,"column":28,"row":27}},{"noteOn":{"time":165.535,"column":19,"row":25}},{"noteOn":{"time":165.625,"column":4,"row":14}},{"noteOn":{"time":165.710,"column":22,"row":4}},{"noteOn":{"time":165.800,"column":26,"row":11}},{"noteOn":{"time":165.890,"column":25,"row":21}},{"noteOn":{"time":165.980,"column":11,"row":12}},{"noteOn":{"time":166.070,"column":14,"row":13}},{"noteOn":{"time":166.155,"column":26,"row":3}},{"noteOn":{"time":166.245,"column":18,"row":25}},{"noteOn":{"time":166.335,"column":28,"row":15}},{"noteOn":{"time":166.425,"column":7,"row":4}},{"noteOn":{"time":166.510,"column":19,"row":13}},{"noteOn":{"time":166.600,"column":5,"row":0}},{"noteOn":{"time":166.690,"column":19,"row":4}},{"noteOn":{"time":166.780,"column":7,"row":8}},{"noteOn":{"time":166.870,"column":6,"row":9}},{"noteOn":{"time":166.955,"column":1,"row":28}},{"noteOn":{"time":167.045,"column":5,"row":3}},{"noteOn":{"time":167.135,"column":6,"row":22}},{"noteOn":{"time":167.225,"column":19,"row":6}},{"noteOn":{"time":167.310,"column":26,"row":17}},{"noteOn":{"time":167.400,"column":15,"row":26}},{"noteOn":{"time":167.490,"column":28,"row":0}},{"noteOn":{"time":167.580,"column":4,"row":12}},{"noteOn":{"time":167.670,"column":9,"row":19}},{"noteOn":{"time":167.755,"column":11,"row":21}},{"noteOn":{"time":167.845,"column":11,"row":27}},{"noteOn":{"time":167.935,"column":4,"row":5}},{"noteOn":{"time":168.025,"column":8,"row":17}},{"noteOn":{"time":168.110,"column":26,"row":4}},{"noteOn":{"time":168.200,"column":17,"row":19}},{"noteOn":{"time":168.290,"column":5,"row":20}},{"noteOn":{"time":168.380,"column":11,"row":20}},{"noteOn":{"time":168.470,"column":8,"row":8}},{"noteOn":{"time":168.555,"column":20,"row":5}},{"noteOn":{"time":168.645,"column":1,"row":16}},{"noteOn":{"time":168.735,"column":26,"row":20}},{"noteOn":{"time":168.825,"column":24,"row":1}},{"noteOn":{"time":168.910,"column":9,"row":10}},{"noteOn":{"time":169.000,"column":5,"row":23}},{"noteOn":{"time":169.090,"column":0,"row":12}},{"noteOn":{"time":169.180,"column":15,"row":13}},{"noteOn":{"time":169.270,"column":0,"row":18}},{"noteOn":{"time":169.355,"column":6,"row":3}},{"noteOn":{"time":169.445,"column":3,"row":10}},{"noteOn":{"time":169.535,"column":22,"row":6}},{"noteOn":{"time":169.625,"column":27,"row":11}},{"noteOn":{"time":169.710,"column":16,"row":9}},{"noteOn":{"time":169.800,"column":2,"row":22}},{"noteOn":{"time":169.890,"column":24,"row":22}},{"noteOn":{"time":169.980,"column":25,"row":10}},{"noteOn":{"time":170.070,"column":28,"row":9}},{"noteOn":{"time":170.155,"column":26,"row":13}},{"noteOn":{"time":170.245,"column":22,"row":25}},{"noteOn":{"time":170.335,"column":15,"row":6}},{"noteOn":{"time":170.425,"column":22,"row":23}},{"noteOn":{"time":170.510,"column":8,"row":22}},{"noteOn":{"time":170.600,"column":9,"row":23}},{"noteOn":{"time":170.690,"column":5,"row":22}},{"noteOn":{"time":170.780,"column":0,"row":10}},{"noteOn":{"time":170.870,"column":14,"row":1}},{"noteOn":{"time":170.955,"column":27,"row":9}},{"noteOn":{"time":171.045,"column":24,"row":24}},{"noteOn":{"time":171.135,"column":3,"row":29}},{"noteOn":{"time":171.225,"column":11,"row":18}},{"noteOn":{"time":171.310,"column":12,"row":13}},{"noteOn":{"time":171.400,"column":6,"row":15}},{"noteOn":{"time":171.490,"column":24,"row":20}},{"noteOn":{"time":171.580,"column":5,"row":13}},{"noteOn":{"time":171.670,"column":7,"row":0}},{"noteOn":{"time":171.755,"column":9,"row":18}},{"noteOn":{"time":171.845,"column":0,"row":8}},{"noteOn":{"time":171.935,"column":27,"row":17}},{"noteOn":{"time":172.025,"column":20,"row":23}},{"noteOn":{"time":172.110,"column":9,"row":22}},{"noteOn":{"time":172.200,"column":0,"row":20}},{"noteOn":{"time":172.290,"column":8,"row":18}},{"noteOn":{"time":172.380,"column":28,"row":13}},{"noteOn":{"time":172.470,"column":25,"row":16}},{"noteOn":{"time":172.555,"column":6,"row":20}},{"noteOn":{"time":172.645,"column":20,"row":25}},{"noteOn":{"time":172.735,"column":9,"row":11}},{"noteOn":{"time":172.825,"column":29,"row":11}},{"noteOn":{"time":172.910,"column":8,"row":0}},{"noteOn":{"time":173.000,"column":22,"row":24}},{"noteOn":{"time":173.090,"column":29,"row":18}},{"noteOn":{"time":173.180,"column":2,"row":28}},{"noteOn":{"time":173.270,"column":26,"row":12}},{"noteOn":{"time":173.355,"column":24,"row":26}},{"noteOn":{"time":173.445,"column":17,"row":8}},{"noteOn":{"time":173.535,"column":24,"row":15}},{"noteOn":{"time":173.625,"column":16,"row":5}},{"noteOn":{"time":173.710,"column":18,"row":21}},{"noteOn":{"time":173.800,"column":17,"row":28}},{"noteOn":{"time":173.890,"column":2,"row":12}},{"noteOn":{"time":173.980,"column":10,"row":27}},{"noteOn":{"time":174.070,"column":0,"row":27}},{"noteOn":{"time":174.155,"column":4,"row":7}},{"noteOn":{"time":174.245,"column":20,"row":0}},{"noteOn":{"time":174.335,"column":17,"row":6}},{"noteOn":{"time":174.425,"column":15,"row":22}},{"noteOn":{"time":174.510,"column":29,"row":19}},{"noteOn":{"time":174.600,"column":25,"row":26}},{"noteOn":{"time":174.690,"column":25,"row":7}},{"noteOn":{"time":174.780,"column":20,"row":15}},{"noteOn":{"time":174.870,"column":29,"row":10}},{"noteOn":{"time":174.955,"column":27,"row":24}},{"noteOn":{"time":175.045,"column":15,"row":28}},{"noteOn":{"time":175.135,"column":9,"row":26}},{"noteOn":{"time":175.225,"column":28,"row":11}},{"noteOn":{"time":175.310,"column":2,"row":2}},{"noteOn":{"time":175.400,"column":25,"row":0}},{"noteOn":{"time":175.490,"column":29,"row":25}},{"noteOn":{"time":175.580,"column":4,"row":24}},{"noteOn":{"time":175.670,"column":7,"row":23}},{"noteOn":{"time":175.755,"column":10,"row":2}},{"noteOn":{"time":175.845,"column":19,"row":11}},{"noteOn":{"time":175.935,"column":12,"row":18}},{"noteOn":{"time":176.025,"column":25,"row":17}},{"noteOn":{"time":176.110,"column":10,"row":22}},{"noteOn":{"time":176.200,"column":7,"row":3}},{"noteOn":{"time":176.290,"column":26,"row":9}},{"noteOn":{"time":176.380,"column":14,"row":16}},{"noteOn":{"time":176.470,"column":25,"row":8}},{"noteOn":{"time":176.555,"column":0,"row":5}},{"noteOn":{"time":176.645,"column":2,"row":11}},{"noteOn":{"time":176.735,"column":14,"row":15}},{"noteOn":{"time":176.825,"column":5,"row":29}},{"noteOn":{"time":176.910,"column":13,"row":24}},{"noteOn":{"time":177.000,"column":9,"row":9}},{"noteOn":{"time":177.090,"column":16,"row":2}},{"noteOn":{"time":177.180,"column":24,"row":6}},{"noteOn":{"time":177.270,"column":28,"row":7}},{"noteOn":{"time":177.355,"column":25,"row":3}},{"noteOn":{"time":177.445,"column":14,"row":24}},{"noteOn":{"time":177.535,"column":13,"row":29}},{"noteOn":{"time":177.625,"column":7,"row":17}},{"noteOn":{"time":177.710,"column":16,"row":4}},{"noteOn":{"time":177.800,"column":1,"row":3}},{"noteOn":{"time":177.890,"column":26,"row":18}},{"noteOn":{"time":177.980,"column":14,"row":4}},{"noteOn":{"time":178.070,"column":15,"row":16}},{"noteOn":{"time":178.155,"column":8,"row":3}},{"noteOn":{"time":178.245,"column":24,"row":25}},{"noteOn":{"time":178.335,"column":22,"row":10}},{"noteOn":{"time":178.425,"column":5,"row":25}},{"noteOn":{"time":178.510,"column":12,"row":0}},{"noteOn":{"time":178.600,"column":21,"row":22}},{"noteOn":{"time":178.690,"column":27,"row":2}},{"noteOn":{"time":178.780,"column":1,"row":29}},{"noteOn":{"time":178.870,"column":8,"row":5}},{"noteOn":{"time":178.955,"column":12,"row":4}},{"noteOn":{"time":179.045,"column":7,"row":19}},{"noteOn":{"time":179.135,"column":16,"row":12}},{"noteOn":{"time":179.225,"column":1,"row":22}},{"noteOn":{"time":179.310,"column":6,"row":28}},{"noteOn":{"time":179.400,"column":10,"row":4}},{"noteOn":{"time":179.490,"column":9,"row":8}},{"noteOn":{"time":179.580,"column":1,"row":7}},{"noteOn":{"time":179.670,"column":18,"row":1}},{"noteOn":{"time":179.755,"column":29,"row":1}},{"noteOn":{"time":179.845,"column":6,"row":1}},{"noteOn":{"time":179.935,"column":7,"row":11}},{"noteOn":{"time":180.025,"column":24,"row":2}},{"noteOn":{"time":180.110,"column":11,"row":16}},{"noteOn":{"time":180.200,"column":8,"row":15}},{"noteOn":{"time":180.290,"column":7,"row":9}},{"noteOn":{"time":180.380,"column":0,"row":0}},{"noteOn":{"time":180.470,"column":19,"row":0}},{"noteOn":{"time":180.555,"column":19,"row":9}},{"noteOn":{"time":180.645,"column":10,"row":16}},{"noteOn":{"time":180.735,"column":8,"row":29}},{"noteOn":{"time":180.825,"column":21,"row":23}},{"noteOn":{"time":180.910,"column":19,"row":5}},{"noteOn":{"time":181.000,"column":2,"row":4}},{"noteOn":{"time":181.090,"column":10,"row":12}},{"noteOn":{"time":181.180,"column":1,"row":15}},{"noteOn":{"time":181.270,"column":16,"row":3}},{"noteOn":{"time":181.355,"column":2,"row":20}},{"noteOn":{"time":181.445,"column":4,"row":16}},{"noteOn":{"time":181.535,"column":21,"row":5}},{"noteOn":{"time":181.625,"column":8,"row":23}},{"noteOn":{"time":181.710,"column":4,"row":20}},{"noteOn":{"time":181.800,"column":11,"row":11}},{"noteOn":{"time":181.890,"column":1,"row":17}},{"noteOn":{"time":181.980,"column":1,"row":26}},{"noteOn":{"time":182.070,"column":17,"row":27}},{"noteOn":{"time":182.155,"column":18,"row":16}},{"noteOn":{"time":182.245,"column":6,"row":21}},{"noteOn":{"time":182.335,"column":14,"row":17}},{"noteOn":{"time":182.425,"column":6,"row":5}},{"noteOn":{"time":182.510,"column":11,"row":26}},{"noteOn":{"time":182.600,"column":13,"row":20}},{"noteOn":{"time":182.690,"column":12,"row":11}},{"noteOn":{"time":182.780,"column":5,"row":6}},{"noteOn":{"time":182.870,"column":28,"row":8}},{"noteOn":{"time":182.955,"column":3,"row":15}},{"noteOn":{"time":183.045,"column":9,"row":20}},{"noteOn":{"time":183.135,"column":4,"row":15}},{"noteOn":{"time":183.225,"column":14,"row":7}},{"noteOn":{"time":183.310,"column":14,"row":23}},{"noteOn":{"time":183.400,"column":7,"row":20}},{"noteOn":{"time":183.490,"column":5,"row":26}},{"noteOn":{"time":183.580,"column":20,"row":10}},{"noteOn":{"time":183.670,"column":19,"row":8}},{"noteOn":{"time":183.755,"column":6,"row":26}},{"noteOn":{"time":183.845,"column":18,"row":14}},{"noteOn":{"time":183.935,"column":3,"row":6}},{"noteOn":{"time":184.025,"column":12,"row":6}},{"noteOn":{"time":184.110,"column":21,"row":18}},{"noteOn":{"time":184.200,"column":29,"row":21}},{"noteOn":{"time":184.290,"column":0,"row":21}},{"noteOn":{"time":184.380,"column":23,"row":18}},{"noteOn":{"time":184.470,"column":4,"row":18}},{"noteOn":{"time":184.555,"column":15,"row":21}},{"noteOn":{"time":184.645,"column":20,"row":9}},{"noteOn":{"time":184.735,"column":0,"row":22}},{"noteOn":{"time":184.825,"column":12,"row":7}},{"noteOn":{"time":184.910,"column":0,"row":28}},{"noteOn":{"time":185.000,"column":12,"row":19}},{"noteOn":{"time":185.090,"column":22,"row":7}},{"noteOn":{"time":185.180,"column":27,"row":5}},{"noteOn":{"time":185.270,"column":14,"row":25}},{"noteOn":{"time":185.355,"column":23,"row":4}},{"noteOn":{"time":185.445,"column":26,"row":25}},{"noteOn":{"time":185.535,"column":20,"row":7}},{"noteOn":{"time":185.625,"column":24,"row":8}},{"noteOn":{"time":185.710,"column":12,"row":2}},{"noteOn":{"time":185.800,"column":14,"row":3}},{"noteOn":{"time":185.890,"column":13,"row":5}},{"noteOn":{"time":185.980,"column":18,"row":15}},{"noteOn":{"time":186.070,"column":11,"row":1}},{"noteOn":{"time":186.155,"column":19,"row":24}},{"noteOn":{"time":186.245,"column":1,"row":18}},{"noteOn":{"time":186.335,"column":9,"row":27}},{"noteOn":{"time":186.425,"column":13,"row":10}},{"noteOn":{"time":186.510,"column":10,"row":29}},{"noteOn":{"time":186.600,"column":6,"row":19}},{"noteOn":{"time":186.690,"column":0,"row":23}},{"noteOn":{"time":186.780,"column":20,"row":6}},{"noteOn":{"time":186.870,"column":13,"row":11}},{"noteOn":{"time":186.955,"column":15,"row":10}},{"noteOn":{"time":187.045,"column":25,"row":9}},{"noteOn":{"time":187.135,"column":24,"row":13}},{"noteOn":{"time":187.225,"column":20,"row":1}},{"noteOn":{"time":187.310,"column":8,"row":12}},{"noteOn":{"time":187.400,"column":18,"row":29}},{"noteOn":{"time":187.490,"column":6,"row":10}},{"noteOn":{"time":187.580,"column":2,"row":24}},{"noteOn":{"time":187.670,"column":14,"row":27}},{"noteOn":{"time":187.755,"column":15,"row":7}},{"noteOn":{"time":187.845,"column":5,"row":12}},{"noteOn":{"time":187.935,"column":20,"row":8}},{"noteOn":{"time":188.025,"column":23,"row":21}},{"noteOn":{"time":188.110,"column":2,"row":10}},{"noteOn":{"time":188.200,"column":0,"row":15}},{"noteOn":{"time":188.290,"column":1,"row":9}},{"noteOn":{"time":188.380,"column":13,"row":21}},{"noteOn":{"time":188.470,"column":18,"row":24}},{"noteOn":{"time":188.555,"column":12,"row":1}},{"noteOn":{"time":188.645,"column":29,"row":6}},{"noteOn":{"time":188.735,"column":25,"row":27}},{"noteOn":{"time":188.825,"column":12,"row":14}},{"noteOn":{"time":188.910,"column":7,"row":2}},{"noteOn":{"time":189.000,"column":17,"row":20}},{"noteOn":{"time":189.090,"column":19,"row":16}},{"noteOn":{"time":189.180,"column":29,"row":22}},{"noteOn":{"time":189.270,"column":4,"row":11}},{"noteOn":{"time":189.355,"column":21,"row":8}},{"noteOn":{"time":189.445,"column":26,"row":19}},{"noteOn":{"time":189.535,"column":2,"row":18}},{"noteOn":{"time":189.625,"column":7,"row":26}},{"noteOn":{"time":189.710,"column":19,"row":12}},{"noteOn":{"time":189.800,"column":1,"row":25}},{"noteOn":{"time":189.890,"column":9,"row":29}},{"noteOn":{"time":189.980,"column":29,"row":26}},{"noteOn":{"time":190.070,"column":9,"row":12}},{"noteOn":{"time":190.155,"column":27,"row":1}},{"noteOn":{"time":190.245,"column":3,"row":2}},{"noteOn":{"time":190.335,"column":27,"row":10}},{"noteOn":{"time":190.425,"column":16,"row":27}},{"noteOn":{"time":190.510,"column":5,"row":21}},{"noteOn":{"time":190.600,"column":27,"row":19}},{"noteOn":{"time":190.690,"column":13,"row":13}},{"noteOn":{"time":190.780,"column":13,"row":22}},{"noteOn":{"time":190.870,"column":16,"row":25}},{"noteOn":{"time":190.955,"column":25,"row":19}},{"noteOn":{"time":191.045,"column":26,"row":23}},{"noteOn":{"time":191.135,"column":16,"row":22}},{"noteOn":{"time":191.225,"column":2,"row":19}},{"noteOn":{"time":191.310,"column":2,"row":29}},{"noteOn":{"time":191.400,"column":3,"row":14}},{"noteOn":{"time":191.490,"column":7,"row":25}},{"noteOn":{"time":191.580,"column":6,"row":18}},{"noteOn":{"time":191.670,"column":11,"row":8}},{"noteOn":{"time":191.755,"column":27,"row":14}},{"noteOn":{"time":191.845,"column":28,"row":3}},{"noteOn":{"time":191.935,"column":17,"row":7}},{"noteOn":{"time":192.025,"column":2,"row":6}},{"noteOn":{"time":192.110,"column":7,"row":18}},{"noteOn":{"time":192.200,"column":7,"row":29}},{"noteOn":{"time":192.290,"column":4,"row":19}},{"noteOn":{"time":192.380,"column":12,"row":22}},{"noteOn":{"time":192.470,"column":21,"row":25}},{"noteOn":{"time":192.555,"column":16,"row":16}},{"noteOn":{"time":192.645,"column":21,"row":17}},{"noteOn":{"time":192.735,"column":8,"row":14}},{"noteOn":{"time":192.825,"column":28,"row":29}},{"noteOn":{"time":192.910,"column":15,"row":0}},{"noteOn":{"time":193.000,"column":19,"row":3}},{"noteOn":{"time":193.090,"column":20,"row":20}},{"noteOn":{"time":193.180,"column":23,"row":3}},{"noteOn":{"time":193.270,"column":4,"row":9}},{"noteOn":{"time":193.355,"column":3,"row":23}},{"noteOn":{"time":193.445,"column":15,"row":29}},{"noteOn":{"time":193.535,"column":19,"row":7}},{"noteOn":{"time":193.625,"column":2,"row":13}},{"noteOn":{"time":193.710,"column":22,"row":8}},{"noteOn":{"time":193.800,"column":14,"row":22}},{"noteOn":{"time":193.890,"column":27,"row":3}},{"noteOn":{"time":193.980,"column":4,"row":27}},{"noteOn":{"time":194.070,"column":16,"row":11}},{"noteOn":{"time":194.155,"column":21,"row":26}},{"noteOn":{"time":194.245,"column":18,"row":4}},{"noteOn":{"time":194.335,"column":29,"row":3}},{"noteOn":{"time":194.425,"column":27,"row":28}},{"noteOn":{"time":194.510,"column":17,"row":23}},{"noteOn":{"time":194.600,"column":10,"row":15}},{"noteOn":{"time":194.690,"column":26,"row":6}},{"noteOn":{"time":194.780,"column":2,"row":9}},{"noteOn":{"time":194.870,"column":21,"row":2}},{"noteOn":{"time":194.955,"column":5,"row":8}},{"noteOn":{"time":195.045,"column":28,"row":24}},{"noteOn":{"time":195.135,"column":13,"row":27}},{"noteOn":{"time":195.225,"column":4,"row":6}},{"noteOn":{"time":195.310,"column":19,"row":29}},{"noteOn":{"time":195.400,"column":10,"row":3}},{"noteOn":{"time":195.490,"column":13,"row":2}},{"noteOn":{"time":195.580,"column":11,"row":15}},{"noteOn":{"time":195.670,"column":4,"row":0}},{"noteOn":{"time":195.755,"column":13,"row":28}},{"noteOn":{"time":195.845,"column":28,"row":2}},{"noteOn":{"time":195.935,"column":16,"row":26}},{"noteOn":{"time":196.025,"column":10,"row":1}},{"noteOn":{"time":196.110,"column":27,"row":12}},{"noteOn":{"time":196.200,"column":17,"row":12}},{"noteOn":{"time":196.290,"column":2,"row":21}},{"noteOn":{"time":196.380,"column":9,"row":14}},{"noteOn":{"time":196.470,"column":13,"row":19}},{"noteOn":{"time":196.555,"column":28,"row":28}},{"noteOn":{"time":196.645,"column":23,"row":14}},{"noteOn":{"time":196.735,"column":12,"row":21}},{"noteOn":{"time":196.825,"column":14,"row":0}},{"noteOn":{"time":196.910,"column":23,"row":23}}]}
`
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
