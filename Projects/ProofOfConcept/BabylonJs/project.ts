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

    const logCsoundMessages = true;
    const logDebugMessages = true;
    const showGroundGrid = true;

    const csoundCameraUpdatesPerSecond = 10;
    const csoundIoBufferSize = 128;
    const groundSize = 200;
    const groundHoleDiameter = 100;

    const halfGroundSize = groundSize / 2;
    const groundHoleRadius = groundHoleDiameter / 2;

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

    let camera = new BABYLON.FreeCamera('', new BABYLON.Vector3(-99, 2, -99), scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.25;
    camera.attachControl(canvas, true);
    camera.setTarget(new BABYLON.Vector3(0, 2, 0));

    // For options docs see https://doc.babylonjs.com/typedoc/interfaces/babylon.ienvironmenthelperoptions.
    const environment = scene.createDefaultEnvironment({
        groundOpacity: 0,
        groundSize: groundSize,
        skyboxColor: BABYLON.Color3.BlackReadOnly,
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
    const groundRing = BABYLON.Mesh.CreateTorus('', groundHoleDiameter, 0.25, 90, scene);
    groundRing.material = grayMaterial;

    // Add cylinder for ground with center tube cut out.
    const groundLedge = BABYLON.MeshBuilder.CreateLathe('', {
        shape: [
            new BABYLON.Vector3(groundSize, 0, 0),
            new BABYLON.Vector3(groundHoleRadius, 0, 0),
            new BABYLON.Vector3(groundHoleRadius, -1000, 0)
        ],
        tessellation: 90
    }, scene);

    if (showGroundGrid) {
        const gridMaterial = new BABYLON_MATERIALS.GridMaterial('', scene);
        // gridMaterial.gridRatio = .25;
        gridMaterial.lineColor.set(0.2, 0.2, 0.2);
        gridMaterial.minorUnitVisibility = 0;
        groundLedge.material = gridMaterial;
    }
    else {
        groundLedge.material = blackMaterial;
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

    const startAudioVisuals = () => {
        let csdData = JSON.parse(csdJson)
        console.debug('csdData =', csdData)

        const noteMeshInstanceCount = 40;
        let noteMeshInstanceIndex = 0;
        let noteMeshInstances = [];
        let noteMeshInstance = whiteSphere.createInstance('');
        noteMeshInstance.isVisible = false;
        noteMeshInstance.scaling.setAll(0.15);
        for (let i = 0; i < noteMeshInstanceCount; i++) {
            noteMeshInstances.push(noteMeshInstance.clone(''));
        }

        const placeholderMesh = graySphere.clone('');
        placeholderMesh.scaling.setAll(0.14);
        placeholderMesh.bakeCurrentTransformIntoVertices();
        placeholderMesh.isVisible = true;

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
            placeholderMesh.thinInstanceAdd(
                BABYLON.Matrix.Translation(noteOn.xyz[0], noteOn.xyz[1], noteOn.xyz[2]), refreshInstances);
            placeholderMesh.thinInstanceAdd(
                BABYLON.Matrix.Translation(noteOn.xyz[0], -noteOn.xyz[1], noteOn.xyz[2]), refreshInstances);
        }

        // Initialized in render loop and incremented as elapsed time passes.
        let nextPointSynthNoteOnIndex = 0;
        let nextPointSynthNoteOffIndex = 0;

        const previousCameraMatrix = new Float32Array(16)
        const currentCameraMatrix = new Float32Array(16)
        let currentCameraMatrixIsDirty = true

        const pointSynthNoteOn = (i) => {
            const note = pointSynthData[i].noteOn;
            note.instanceIndex = noteMeshInstanceIndex;
            let mesh = noteMeshInstances[note.instanceIndex];
            let mirrorMesh = noteMeshInstances[note.instanceIndex + 1];
            mesh.position.x = mirrorMesh.position.x = note.xyz[0];
            mesh.position.y = note.xyz[1];
            mirrorMesh.position.y = -note.xyz[1];
            mesh.position.z = mirrorMesh.position.z = note.xyz[2];
            mesh.isVisible = mirrorMesh.isVisible = true;

            noteMeshInstanceIndex += 2;
            if (noteMeshInstanceIndex == noteMeshInstanceCount) {
                noteMeshInstanceIndex = 0;
            }
        }

        const pointSynthNoteOff = (i) => {
            const note = pointSynthData[i].noteOn;
            noteMeshInstances[note.instanceIndex].isVisible = false;
            noteMeshInstances[note.instanceIndex + 1].isVisible = false;
        }

        // Update animations.
        engine.runRenderLoop(() => {
            if (!isCsoundStarted) {
                nextPointSynthNoteOnIndex = pointSynthNoteStartIndex;
                nextPointSynthNoteOffIndex = pointSynthNoteStartIndex;
                return;
            }
            const time = document.audioContext.currentTime - startTime;

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
        })

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

    const restartCsound = async () => {
        console.debug('Restarting Csound ...')
        isCsoundStarted = false;
        await document.csound.rewindScore();
        console.debug('Restarting Csound - done')
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
        await csound.setOption('--iobufsamps=' + csoundIoBufferSize)
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
        giPresetUuidPreallocationCount[] = fillarray( 4, /* instr 4 -- CircleSynth */ 1, /* instr 5 -- PowerLineSynth */ 9 /* instr 6 -- PointSynth */ )
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
        gSCcInfo_CircleSynth[] = fillarray( \\
        \\
            "example", "bool", "false", "synced", \\
        \\
            "", "", "", "")
         #define gSCcInfo_CircleSynth_Count #8#
         #define CC_INFO_CHANNEL #0#
         #define CC_INFO_TYPE #1#
         #define CC_INFO_VALUE #2#
         #define CC_INFO_SYNC_TYPE #3#
         #define CC_NO_SYNC #0#
         #define CC_SYNC_TO_CHANNEL #1#
         #ifdef gSCcInfo_CircleSynth_Count
            if (lenarray(gSCcInfo_CircleSynth) == $gSCcInfo_CircleSynth_Count) then
                giCcCount_CircleSynth = (lenarray(gSCcInfo_CircleSynth) / 4) - 1
                reshapearray(gSCcInfo_CircleSynth, giCcCount_CircleSynth + 1, 4)
            endif
         #else
            giCcCount_CircleSynth = (lenarray(gSCcInfo_CircleSynth) / 4) - 1
            reshapearray(gSCcInfo_CircleSynth, giCcCount_CircleSynth + 1, 4)
         #end
        opcode ccIndex_CircleSynth, i, S
            SChannel xin
            kgoto end
            iI = 0
            while (iI < giCcCount_CircleSynth) do
                if (strcmp(gSCcInfo_CircleSynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
                iI += 1
            od
            iI = -1
        end:
            xout iI
        endop
        giCcValueDefaults_CircleSynth[] init giCcCount_CircleSynth
        giCcValues_CircleSynth[][] init 1, giCcCount_CircleSynth
        gkCcValues_CircleSynth[][] init 1, giCcCount_CircleSynth
        gkCcSyncTypes_CircleSynth[][] init 1, giCcCount_CircleSynth
        instr CircleSynth_InitializeCcValues
            iI = 0
            while (iI < giCcCount_CircleSynth) do
                SType = gSCcInfo_CircleSynth[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_CircleSynth[iI][$CC_INFO_VALUE]
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
                    giCcValueDefaults_CircleSynth[iI] = iValue
                    giCcValues_CircleSynth[iJ][iI] = iValue
                    iJ += 1
                od
                iI += 1
            od
            igoto end
            kI = 0
            while (kI < giCcCount_CircleSynth) do
                SType = gSCcInfo_CircleSynth[kI][$CC_INFO_TYPE]
                SValue = gSCcInfo_CircleSynth[kI][$CC_INFO_VALUE]
                SSyncType = gSCcInfo_CircleSynth[kI][$CC_INFO_SYNC_TYPE]
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
                    gkCcValues_CircleSynth[kJ][kI] = kValue
                    gkCcSyncTypes_CircleSynth[kJ][kI] = $CC_NO_SYNC
                    if (strcmpk(SSyncType, "synced") == 0) then
                        gkCcSyncTypes_CircleSynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
                    endif
                    kJ += 1
                od
                kI += 1
            od
            turnoff
        end:
        endin
        event_i("i", "CircleSynth_InitializeCcValues", 0, -1)
        instr CircleSynth_CreateCcIndexes
            giCc_CircleSynth_example init ccIndex_CircleSynth("example")
            turnoff
        endin
        event_i("i", "CircleSynth_CreateCcIndexes", 0, -1)
        giCircleSynth_HeightRange init 50 - 1
        giCircleSynth_RadiusRange init 50 - 1
        giCircleSynth_SpreadSpeedRange init 15 - 1
        giCircleSynth_NoteNumberRange init 96 - 24
        giCircleSynth_DistanceMin = 5
        giCircleSynth_DistanceMax = 100
        instr CircleSynth_NoteOn
            iNoteNumber = p4
            iVelocity = p5 / 127
            iOrcInstanceIndex = p6
            iInstrumentTrackIndex = p7
            iSecondsPerKPass = 1 / kr
            kPass init -1
            kPass += 1
            if (iNoteNumber < 24 || iNoteNumber > 96) then
                goto endin
            endif
            iCps = cpsmidinn(iNoteNumber)
            iLowPassCutoffBase = iCps * 16
            iLowPassCutoffBaseOver360 = iLowPassCutoffBase / 260
            iNoteNumberNormalized init (iNoteNumber - 24) / giCircleSynth_NoteNumberRange
            iHeight init 1 + giCircleSynth_HeightRange * iNoteNumberNormalized
            iRadius init 50 - giCircleSynth_RadiusRange * iNoteNumberNormalized
            iSpreadIncrement init iSecondsPerKPass * (1 + iVelocity *
                giCircleSynth_SpreadSpeedRange)
            iSpreadAttenuationDecrement = iSpreadIncrement / (260 / 2)
            kSpread init 1 - iSpreadIncrement
            kSpreadAttenuation init 1 + iSpreadAttenuationDecrement
            kIsFullSpread init 0
            if (kIsFullSpread == 0) then
                kSpread += iSpreadIncrement
                kSpreadAttenuation -= iSpreadAttenuationDecrement
                if (kSpreadAttenuation < 0) then
                    kSpreadAttenuation = 0
                    kSpread = 260
                    kIsFullSpread = 1
                endif
                kLowPassCutoff = iLowPassCutoffBase + kSpread * iLowPassCutoffBaseOver360
            endif
            kAmp = 0.1 * iVelocity * adsr_linsegr:k(1, 0, 1, 1)
            aOut = vco2(kAmp, iCps, 10, 0.5, 0, 0.5)
            aOut = moogladder(aOut, kLowPassCutoff, 0)
            kPosition[] fillarray 0, 0, 0
            kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
            kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, giCircleSynth_DistanceMax)
            aOutDistanced = aOut * kDistanceAttenuation
            aOut = aOut * (kDistanceAttenuation + kDistanceAttenuation) * kSpreadAttenuation
            AF_3D_Audio_ChannelGains(kPosition, kSpread)
                gaInstrumentSignals[0][0] = gaInstrumentSignals[0][0] + gkAmbisonicChannelGains[0] * aOutDistanced
                gaInstrumentSignals[0][1] = gaInstrumentSignals[0][1] + gkAmbisonicChannelGains[1] * aOutDistanced
                gaInstrumentSignals[0][2] = gaInstrumentSignals[0][2] + gkAmbisonicChannelGains[2] * aOutDistanced
                gaInstrumentSignals[0][3] = gaInstrumentSignals[0][3] + gkAmbisonicChannelGains[3] * aOutDistanced
                gaInstrumentSignals[0][4] = gaInstrumentSignals[0][4] + aOut
                gaInstrumentSignals[0][5] = gaInstrumentSignals[0][5] + aOut
        endin:
        endin
        instr CircleSynth_NoteOff
            iNoteNumber = p4
            iVelocity = p5 / 127
            iOrcInstanceIndex = p6
            iInstrumentTrackIndex = p7
        endin
        giCircleSynthNoteInstrumentNumber = nstrnum("CircleSynth_NoteOn")
        giCircleSynth_NoteIndex[] init 1
         #ifdef IS_GENERATING_JSON
            setPluginUuid(0, 0, "baeea327-af4b-4b10-a843-6614c20ea958")
            instr CircleSynth_Json
                SJsonFile = sprintf("json/%s.0.json", "baeea327-af4b-4b10-a843-6614c20ea958")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "CircleSynth 1"))
                fprints(SJsonFile, ",\\"heightMin\\":%d", 1)
                fprints(SJsonFile, ",\\"heightMax\\":%d", 50)
                fprints(SJsonFile, ",\\"radiusMin\\":%d", 50)
                fprints(SJsonFile, ",\\"radiusMax\\":%d", 50)
                fprints(SJsonFile, ",\\"spreadMax\\":%d", 260)
                fprints(SJsonFile, ",\\"spreadSpeedMin\\":%d", 1)
                fprints(SJsonFile, ",\\"spreadSpeedMax\\":%d", 15)
                fprints(SJsonFile, ",\\"noteNumberMin\\":%d", 24)
                fprints(SJsonFile, ",\\"noteNumberMax\\":%d", 96)
                fprints(SJsonFile, ",\\"soundDistanceMin\\":%d", giCircleSynth_DistanceMin)
                fprints(SJsonFile, ",\\"soundDistanceMax\\":%d", giCircleSynth_DistanceMax)
                fprints(SJsonFile, "}")
                turnoff
            endin
         #end
        instr 4
            iEventType = p4
            if (iEventType == 4) then
                turnoff
            elseif (iEventType == 1) then
                iNoteNumber = p5
                iVelocity = p6
                kReleased = release()
                    iInstrumentNumber = p1 + 0.0001
                    SOnEvent = sprintf("i %.4f 0 -1 %d %d %d", iInstrumentNumber, 3, iNoteNumber, iVelocity)
                    scoreline_i(SOnEvent)
                    if (kReleased == 1) then
                        SOffEvent = sprintfk("i -%.4f 0 1", iInstrumentNumber)
                        scoreline(SOffEvent, 1)
                    endif
                    #ifdef IS_GENERATING_JSON
                        if (giCircleSynth_NoteIndex[0] == 0) then
                            scoreline_i("i \\"CircleSynth_Json\\" 0 0")
                        endif
                        giCircleSynth_NoteIndex[0] = giCircleSynth_NoteIndex[0] + 1
                        SJsonFile = sprintf("json/%s.%d.json", "baeea327-af4b-4b10-a843-6614c20ea958", giCircleSynth_NoteIndex[0])
                        fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"velocity\\":%.3f},", times(), iNoteNumber, iVelocity)
                        if (kReleased == 1) then
                            fprintks(SJsonFile, "\\"noteOff\\":{\\"time\\":%.3f}}", times:k())
                        endif
                    #end
                if (kReleased == 1) then
                    turnoff
                endif
            elseif (iEventType == 3) then
                iNoteNumber = p5
                iVelocity = p6
            endif
        endin:
        endin
            instr Preallocate_4
                ii = 0
                while (ii < giPresetUuidPreallocationCount[0]) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 4, ii, 3))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 4))
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
        gSCcInfo_PowerLineSynth[] = fillarray( \\
        \\
            "example", "bool", "false", "synced", \\
        \\
            "", "", "", "")
         #define gSCcInfo_PowerLineSynth_Count #8#
         #define CC_INFO_CHANNEL #0#
         #define CC_INFO_TYPE #1#
         #define CC_INFO_VALUE #2#
         #define CC_INFO_SYNC_TYPE #3#
         #define CC_NO_SYNC #0#
         #define CC_SYNC_TO_CHANNEL #1#
         #ifdef gSCcInfo_PowerLineSynth_Count
            if (lenarray(gSCcInfo_PowerLineSynth) == $gSCcInfo_PowerLineSynth_Count) then
                giCcCount_PowerLineSynth = (lenarray(gSCcInfo_PowerLineSynth) / 4) - 1
                reshapearray(gSCcInfo_PowerLineSynth, giCcCount_PowerLineSynth + 1, 4)
            endif
         #else
            giCcCount_PowerLineSynth = (lenarray(gSCcInfo_PowerLineSynth) / 4) - 1
            reshapearray(gSCcInfo_PowerLineSynth, giCcCount_PowerLineSynth + 1, 4)
         #end
        opcode ccIndex_PowerLineSynth, i, S
            SChannel xin
            kgoto end
            iI = 0
            while (iI < giCcCount_PowerLineSynth) do
                if (strcmp(gSCcInfo_PowerLineSynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
                iI += 1
            od
            iI = -1
        end:
            xout iI
        endop
        giCcValueDefaults_PowerLineSynth[] init giCcCount_PowerLineSynth
        giCcValues_PowerLineSynth[][] init 1, giCcCount_PowerLineSynth
        gkCcValues_PowerLineSynth[][] init 1, giCcCount_PowerLineSynth
        gkCcSyncTypes_PowerLineSynth[][] init 1, giCcCount_PowerLineSynth
        instr PowerLineSynth_InitializeCcValues
            iI = 0
            while (iI < giCcCount_PowerLineSynth) do
                SType = gSCcInfo_PowerLineSynth[iI][$CC_INFO_TYPE]
                SValue = gSCcInfo_PowerLineSynth[iI][$CC_INFO_VALUE]
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
                    giCcValueDefaults_PowerLineSynth[iI] = iValue
                    giCcValues_PowerLineSynth[iJ][iI] = iValue
                    iJ += 1
                od
                iI += 1
            od
            igoto end
            kI = 0
            while (kI < giCcCount_PowerLineSynth) do
                SType = gSCcInfo_PowerLineSynth[kI][$CC_INFO_TYPE]
                SValue = gSCcInfo_PowerLineSynth[kI][$CC_INFO_VALUE]
                SSyncType = gSCcInfo_PowerLineSynth[kI][$CC_INFO_SYNC_TYPE]
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
                    gkCcValues_PowerLineSynth[kJ][kI] = kValue
                    gkCcSyncTypes_PowerLineSynth[kJ][kI] = $CC_NO_SYNC
                    if (strcmpk(SSyncType, "synced") == 0) then
                        gkCcSyncTypes_PowerLineSynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
                    endif
                    kJ += 1
                od
                kI += 1
            od
            turnoff
        end:
        endin
        event_i("i", "PowerLineSynth_InitializeCcValues", 0, -1)
        instr PowerLineSynth_CreateCcIndexes
            giCc_PowerLineSynth_example init ccIndex_PowerLineSynth("example")
            turnoff
        endin
        event_i("i", "PowerLineSynth_CreateCcIndexes", 0, -1)
        giMaxRiseTime = 10
        giNoteOnStartPosition[] = fillarray(10, 0, 20)
        giNoteOnEndPosition[] = fillarray(15, 10, 25)
        giNoteOffEndZ = -1000
        giNoteNumberWobbleStartAmp = 1.5
        giNoteNumberWobbleSpeed = 5
        giRiserTableSize = 1024
        giWobbleTableSize = 1024
        giMinNoteOffSpeed = 50
        giMaxNoteOffSpeed = 100
        giPowerLineSynth_DistanceMin = 5
        giPowerLineSynth_DistanceMax = 100
        giRiserTableId = ftgen(0, 0, giRiserTableSize + 1, 16, 0, giRiserTableSize, -10, 1)
        giWobbleTableId = ftgen(0, 0, 1024, 10, 1)
        instr PowerLineSynth_NoteOn
            iNoteNumber = p4
            iVelocity = p5 / 127
            iOrcInstanceIndex = p6
            iInstrumentTrackIndex = p7
            iSecondsPerKPass = 1 / kr
            iNoteOnDelta[] fillarray giNoteOnEndPosition[$X] - giNoteOnStartPosition[$X], giNoteOnEndPosition[$Y] - giNoteOnStartPosition[$Y], giNoteOnEndPosition[$Z] - giNoteOnStartPosition[$Z]
            iNoteOnIncrementX = iSecondsPerKPass * (iNoteOnDelta[$X] / giMaxRiseTime)
            iNoteOnIncrementZ = iSecondsPerKPass * (iNoteOnDelta[$Z] / giMaxRiseTime)
            kPosition[] fillarray giNoteOnStartPosition[$X], giNoteOnStartPosition[$Y], giNoteOnStartPosition[$Z]
            if (kPosition[$Z] < giNoteOffEndZ) then
                kgoto endin
            endif
            iMaxRiseAmount = iNoteNumber - 36
            iNoteNumber = 36
            kReleased = release()
            iRiserTableIncrementI = iSecondsPerKPass * (giRiserTableSize / giMaxRiseTime)
            kRiserTableI init 0
            if (kRiserTableI < giRiserTableSize && kReleased == 0) then
                kRiserTableI += iRiserTableIncrementI
            endif
            kRiserTableValue = tablei(kRiserTableI, giRiserTableId)
            if (kReleased == 0) then
                if (kRiserTableI < giRiserTableSize) then
                    kPosition[$X] = kPosition[$X] + iNoteOnIncrementX
                    kPosition[$Y] = giNoteOnStartPosition[$Y] + iNoteOnDelta[$Y] * kRiserTableValue
                    kPosition[$Z] = kPosition[$Z] + iNoteOnIncrementZ
                endif
            else
                if (p3 == -1) then
                    iExtraTime = abs(giNoteOffEndZ - giNoteOnStartPosition[$Z]) / giMinNoteOffSpeed
                elseif (p1 > 0) then
                    iExtraTime = 0.01
                endif
                xtratim(iExtraTime)
                kNoteOffSpeed init giMinNoteOffSpeed
                kNoteOffIncrementZ init iSecondsPerKPass * giMinNoteOffSpeed
                kNoteOffSpeedCalculated init 0
                if (kNoteOffSpeedCalculated == 0) then
                    kNoteOffSpeed = giMinNoteOffSpeed +
                        ((giMaxNoteOffSpeed - giMinNoteOffSpeed) * (kRiserTableI / giRiserTableSize))
                    kNoteOffSpeed = min(kNoteOffSpeed, giMaxNoteOffSpeed)
                    kNoteOffIncrementZ = iSecondsPerKPass * kNoteOffSpeed
                    kNoteOffSpeedCalculated = 1
                else
                    kPosition[$Z] = kPosition[$Z] - kNoteOffIncrementZ
                endif
            endif
            iWobbleTableIncrementI = giNoteNumberWobbleSpeed * (iSecondsPerKPass * giWobbleTableSize)
            kWobbleTableI init 0
            kWobbleTableI += iWobbleTableIncrementI
            kWobbleTableI = kWobbleTableI % giWobbleTableSize
            kNoteNumberWobbleAmp = giNoteNumberWobbleStartAmp * (1 - kRiserTableValue)
            kNoteNumber = iNoteNumber
            kNoteNumber += kRiserTableValue * iMaxRiseAmount
            kNoteNumber += tablei(kWobbleTableI, giWobbleTableId) * kNoteNumberWobbleAmp
            if (kNoteNumber > 127) then
                kNoteNumber = 127
                    kLoggedNoteNumberWarning init 0
                    if (kLoggedNoteNumberWarning == 0) then
                        kLoggedNoteNumberWarning = 1
                    endif
            else
                    kLoggedNoteNumberWarning = 0
            endif
            kAmp = 0.1 * iVelocity * kRiserTableValue
            if (kReleased == 1) then
                kAmp *= (giNoteOffEndZ - kPosition[$Z]) / giNoteOffEndZ
            endif
            kCps = cpsmidinn(kNoteNumber)
            aOut = vco2(kAmp, kCps, 10, 0.5, 0, 0.5)
            aOut = tone(aOut, 5000)
            kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
            kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, giPowerLineSynth_DistanceMax)
            aOutDistanced = aOut * kDistanceAttenuation
            aOut = aOut * (2 * kDistanceAttenuation)
            AF_3D_Audio_ChannelGains(kPosition, 1)
                gaInstrumentSignals[1][0] = gaInstrumentSignals[1][0] + gkAmbisonicChannelGains[0] * aOutDistanced
                gaInstrumentSignals[1][1] = gaInstrumentSignals[1][1] + gkAmbisonicChannelGains[1] * aOutDistanced
                gaInstrumentSignals[1][2] = gaInstrumentSignals[1][2] + gkAmbisonicChannelGains[2] * aOutDistanced
                gaInstrumentSignals[1][3] = gaInstrumentSignals[1][3] + gkAmbisonicChannelGains[3] * aOutDistanced
                gaInstrumentSignals[1][4] = gaInstrumentSignals[1][4] + aOut
                gaInstrumentSignals[1][5] = gaInstrumentSignals[1][5] + aOut
        endin:
        endin
        instr PowerLineSynth_NoteOff
            iNoteNumber = p4
            iVelocity = p5 / 127
            iOrcInstanceIndex = p6
            iInstrumentTrackIndex = p7
        endin
        giPowerLineSynthNoteInstrumentNumber = nstrnum("PowerLineSynth_NoteOn")
        giPowerLineSynth_NoteIndex[] init 1
         #ifdef IS_GENERATING_JSON
            setPluginUuid(1, 0, "069e83fd-1c94-47e9-95ec-126e0fbefec3")
            instr PowerLineSynth_Json
                SJsonFile = sprintf("json/%s.0.json", "069e83fd-1c94-47e9-95ec-126e0fbefec3")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
                fprints(SJsonFile, ",\\"maxRiseTime\\":%d", giMaxRiseTime)
                fprints(SJsonFile, ",\\"noteOnStartPosition\\":[%d,%d,%d]", giNoteOnStartPosition[$X], giNoteOnStartPosition[$Y], giNoteOnStartPosition[$Z])
                fprints(SJsonFile, ",\\"noteOnEndPosition\\":[%d,%d,%d]", giNoteOnEndPosition[$X], giNoteOnEndPosition[$Y], giNoteOnEndPosition[$Z])
                fprints(SJsonFile, ",\\"noteOffEndZ\\":%d", giNoteOffEndZ)
                fprints(SJsonFile, ",\\"noteNumberWobbleStartAmp\\":%.3f", giNoteNumberWobbleStartAmp)
                fprints(SJsonFile, ",\\"noteNumberWobbleSpeed\\":%.3f", giNoteNumberWobbleSpeed)
                fprints(SJsonFile, ",\\"minNoteOffSpeed\\":%d", giMinNoteOffSpeed)
                fprints(SJsonFile, ",\\"maxNoteOffSpeed\\":%d", giMaxNoteOffSpeed)
                fprints(SJsonFile, ",\\"soundDistanceMin\\":%d", giPowerLineSynth_DistanceMin)
                fprints(SJsonFile, ",\\"soundDistanceMax\\":%d", giPowerLineSynth_DistanceMax)
                fprints(SJsonFile, "}")
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
                kReleased = release()
                    iInstrumentNumber = p1 + 0.0001
                    SOnEvent = sprintf("i %.4f 0 -1 %d %d %d", iInstrumentNumber, 3, iNoteNumber, iVelocity)
                    scoreline_i(SOnEvent)
                    if (kReleased == 1) then
                        SOffEvent = sprintfk("i -%.4f 0 1", iInstrumentNumber)
                        scoreline(SOffEvent, 1)
                    endif
                    #ifdef IS_GENERATING_JSON
                        if (giPowerLineSynth_NoteIndex[0] == 0) then
                            scoreline_i("i \\"PowerLineSynth_Json\\" 0 0")
                        endif
                        giPowerLineSynth_NoteIndex[0] = giPowerLineSynth_NoteIndex[0] + 1
                        SJsonFile = sprintf("json/%s.%d.json", "069e83fd-1c94-47e9-95ec-126e0fbefec3", giPowerLineSynth_NoteIndex[0])
                        fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"velocity\\":%.3f},", times(), iNoteNumber, iVelocity)
                        if (kReleased == 1) then
                            fprintks(SJsonFile, "\\"noteOff\\":{\\"time\\":%.3f}}", times:k())
                        endif
                    #end
                if (kReleased == 1) then
                    turnoff
                endif
            elseif (iEventType == 3) then
                iNoteNumber = p5
                iVelocity = p6
            endif
        endin:
        endin
            instr Preallocate_5
                ii = 0
                while (ii < giPresetUuidPreallocationCount[1]) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 5, ii, 3))
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
        giPointSynth_DistanceMin = 1
        giPointSynth_DistanceMax = 50
        giPointSynth_ReferenceDistance = 5
        giPointSynth_RolloffFactor = 1
        giPointSynth_PlaybackVolumeAdjustment = 10
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
            setPluginUuid(2, 0, "b4f7a35c-6198-422f-be6e-fa126f31b007")
            instr PointSynth_Json
                SJsonFile = sprintf("json/%s.0.json", "b4f7a35c-6198-422f-be6e-fa126f31b007")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
                fprints(SJsonFile, sprintf(",\\"fadeInTime\\":%.02f", giFadeInTime))
                fprints(SJsonFile, sprintf(",\\"fadeOutTime\\":%.02f", giFadeOutTime))
                fprints(SJsonFile, ",\\"soundDistanceMin\\":%d", giPointSynth_DistanceMin)
                fprints(SJsonFile, ",\\"soundDistanceMax\\":%d", giPointSynth_DistanceMax)
                fprints(SJsonFile, "}")
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
                    iY init 10 + ((iNoteNumber - 80) / 25) * 20
                    kDistance = AF_3D_Audio_SourceDistance(iX, iY, iZ)
                    kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giPointSynth_ReferenceDistance, giPointSynth_RolloffFactor)
                        kDistanceAmp *= giPointSynth_PlaybackVolumeAdjustment
                    aOutDistanced = aOut * kDistanceAmp
                    giPointSynthNextXYZ_i += 1
                    if (giPointSynthNextXYZ_i == $POINT_SYNTH_NEXT_XYZ_COUNT) then
                        giPointSynthNextXYZ_i = 0
                    endif
                    AF_3D_Audio_ChannelGains_XYZ(k(iX), k(iY), k(iZ))
                    a1 = gkAmbisonicChannelGains[0] * aOutDistanced
                    a2 = gkAmbisonicChannelGains[1] * aOutDistanced
                    a3 = gkAmbisonicChannelGains[2] * aOutDistanced
                    a4 = gkAmbisonicChannelGains[3] * aOutDistanced
                    aReverbOut = aOut
                        aReverbOut *= giPointSynth_PlaybackReverbAdjustment
                        gaInstrumentSignals[2][0] = gaInstrumentSignals[2][0] + a1
                        gaInstrumentSignals[2][1] = gaInstrumentSignals[2][1] + a2
                        gaInstrumentSignals[2][2] = gaInstrumentSignals[2][2] + a3
                        gaInstrumentSignals[2][3] = gaInstrumentSignals[2][3] + a4
                        gaInstrumentSignals[2][4] = gaInstrumentSignals[2][4] + aReverbOut
                        gaInstrumentSignals[2][5] = gaInstrumentSignals[2][5] + aReverbOut
                    #ifdef IS_GENERATING_JSON
                        if (giPointSynth_NoteIndex[0] == 0) then
                            scoreline_i("i \\"PointSynth_Json\\" 0 0")
                        endif
                        giPointSynth_NoteIndex[0] = giPointSynth_NoteIndex[0] + 1
                        SJsonFile = sprintf("json/%s.%d.json", "b4f7a35c-6198-422f-be6e-fa126f31b007", giPointSynth_NoteIndex[0])
                        fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"xyz\\":[%.3f,%.3f,%.3f]}}", times(),
                            iNoteNumber, iX, iY, iZ)
                    #end
            endif
        end:
        endin
            instr Preallocate_6
                ii = 0
                while (ii < giPresetUuidPreallocationCount[2]) do
                    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 1063 63", 6, ii, 1))
                    ii += 1
                od
                turnoff
            endin
            scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 6))
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
        i 8 0.004 1 3 0 0 0.46
        i 8 0.004 1 3 0 1 0.46
        i 8 0.004 1 3 0 2 0.46
        i 8 0.004 1 3 0 3 0.46
        i 8 0.004 1 3 0 4 0.48
        i 8 0.004 1 3 0 5 0.48
        i 8 0.004 1 3 1 0 0.46
        i 8 0.004 1 3 1 1 0.46
        i 8 0.004 1 3 1 2 0.46
        i 8 0.004 1 3 1 3 0.46
        i 8 0.004 1 3 1 4 1.00
        i 8 0.004 1 3 1 5 1.00
        i 8 0.004 1 3 2 0 0.06
        i 8 0.004 1 3 2 1 0.06
        i 8 0.004 1 3 2 2 0.06
        i 8 0.004 1 3 2 3 0.06
        i 8 0.004 1 3 2 4 0.02
        i 8 0.004 1 3 2 5 0.02
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
        i 5.001 2.001 -1 3 48 96
        i 4.001 2.001 -1 3 24 45
        i 4.002 2.001 -1 3 36 63
        i 6.001 2.853 0.100 1 1098 76
        i 6.002 3.825 0.100 1 1095 79
        i 6.003 4.621 0.100 1 1103 52
        i 6.004 5.243 0.100 1 1103 78
        i 6.005 5.799 0.100 1 1095 71
        i 6.006 6.531 0.100 1 1097 58
        i 6.007 7.439 0.100 1 1097 78
        i 6.008 8.356 0.100 1 1095 72
        i 6.009 9.097 0.100 1 1103 52
        i 6.010 9.664 0.100 1 1102 79
        i 4.003 10.001 -1 3 31 45
        i 4.004 10.001 -1 3 43 63
        i -4.001 10.001 0
        i -4.002 10.001 0
        i 6.011 10.237 0.100 1 1096 74
        i 6.012 10.275 0.100 1 1096 77
        i 6.013 10.852 0.100 1 1094 69
        i 6.014 11.061 0.100 1 1098 74
        i 6.015 11.380 0.100 1 1102 57
        i 6.016 12.024 0.100 1 1096 76
        i 6.017 12.321 0.100 1 1101 58
        i 6.018 12.887 0.100 1 1094 55
        i 6.019 13.176 0.100 1 1095 82
        i 6.020 13.573 0.100 1 1104 76
        i 6.021 13.911 0.100 1 1097 60
        i 6.022 14.085 0.100 1 1102 59
        i 6.023 14.732 0.100 1 1095 62
        i 6.024 14.751 0.100 1 1096 73
        i 6.025 15.325 0.100 1 1093 64
        i 6.026 15.592 0.100 1 1099 61
        i 6.027 15.832 0.100 1 1103 75
        i 6.028 15.969 0.100 1 1099 76
        i 6.029 16.576 0.100 1 1095 69
        i 6.030 16.641 0.100 1 1097 56
        i 6.031 16.752 0.100 1 1101 61
        i 6.032 17.207 0.100 1 1103 79
        i 6.033 17.384 0.100 1 1093 72
        i 6.034 17.585 0.100 1 1096 74
        i 6.035 17.908 0.100 1 1105 65
        i 4.005 18.001 -1 3 29 45
        i 4.006 18.001 -1 3 41 63
        i -4.003 18.001 0
        i -4.004 18.001 0
        i 6.036 18.016 0.100 1 1103 69
        i 6.037 18.341 0.100 1 1098 78
        i 6.038 18.444 0.100 1 1095 59
        i 6.039 18.560 0.100 1 1101 75
        i 6.040 19.175 0.100 1 1097 55
        i 6.041 19.184 0.100 1 1094 79
        i 6.042 19.280 0.100 1 1097 83
        i 6.043 19.681 0.100 1 1099 60
        i 6.044 19.756 0.100 1 1092 81
        i 6.045 20.176 0.100 1 1099 57
        i 6.046 20.272 0.100 1 1102 53
        i 6.047 20.441 0.100 1 1097 79
        i 6.048 20.965 0.100 1 1104 60
        i 6.049 21.105 0.100 1 1094 59
        i 6.050 21.171 0.100 1 1100 75
        i 6.051 21.755 0.100 1 1104 64
        i 6.052 21.859 0.100 1 1092 74
        i 6.053 21.981 0.100 1 1096 56
        i 6.054 22.308 0.100 1 1096 79
        i 6.055 22.436 0.100 1 1102 78
        i 6.056 22.759 0.100 1 1098 67
        i 6.057 23.005 0.100 1 1094 73
        i 6.058 23.035 0.100 1 1100 56
        i 6.059 23.127 0.100 1 1098 69
        i 6.060 23.623 0.100 1 1093 58
        i 6.061 23.709 0.100 1 1098 72
        i 6.062 23.749 0.100 1 1092 59
        i 6.063 23.809 0.100 1 1098 67
        i 6.064 24.173 0.100 1 1091 68
        i 6.065 24.509 0.100 1 1102 62
        i 6.066 24.556 0.100 1 1096 60
        i 6.067 24.711 0.100 1 1101 64
        i 6.068 24.760 0.100 1 1100 68
        i 6.069 25.168 0.100 1 1104 66
        i 6.070 25.249 0.100 1 1100 69
        i 6.071 25.587 0.100 1 1099 61
        i 6.072 25.635 0.100 1 1094 82
        i 4.007 26.001 -1 3 33 45
        i 4.008 26.001 -1 3 45 63
        i -4.005 26.001 0
        i -4.006 26.001 0
        i 6.073 26.013 0.100 1 1095 61
        i 6.074 26.044 0.100 1 1103 75
        i 6.075 26.333 0.100 1 1092 80
        i 6.076 26.376 0.100 1 1097 84
        i 6.077 26.685 0.100 1 1097 57
        i 6.078 26.749 0.100 1 1097 62
        i 6.079 26.856 0.100 1 1101 56
        i 6.080 27.175 0.100 1 1099 65
        i 6.081 27.509 0.100 1 1099 68
        i 6.082 27.516 0.100 1 1093 79
        i 6.083 27.591 0.100 1 1099 54
        i 6.084 28.060 0.100 1 1093 65
        i 6.085 28.248 0.100 1 1091 56
        i 6.086 28.261 0.100 1 1097 79
        i 6.087 28.339 0.100 1 1099 55
        i 6.088 28.589 0.100 1 1092 72
        i 6.089 29.019 0.100 1 1101 66
        i 6.090 29.041 0.100 1 1101 78
        i 6.091 29.148 0.100 1 1100 59
        i 6.092 29.196 0.100 1 1095 75
        i 6.093 29.335 0.100 1 1101 75
        i 6.094 29.728 0.100 1 1099 67
        i 6.095 29.747 0.100 1 1099 75
        i 6.096 29.896 0.100 1 1105 74
        i 6.097 30.003 0.100 1 1098 76
        i 6.098 30.155 0.100 1 1093 52
        i 6.099 30.521 0.100 1 1095 71
        i 6.100 30.561 0.100 1 1103 75
        i 6.101 30.771 0.100 1 1098 54
        i 6.102 30.799 0.100 1 1093 52
        i 6.103 30.860 0.100 1 1103 56
        i 6.104 31.245 0.100 1 1098 81
        i 6.105 31.332 0.100 1 1101 57
        i 6.106 31.541 0.100 1 1105 54
        i 6.107 31.589 0.100 1 1097 81
        i 6.108 31.591 0.100 1 1100 78
        i 6.109 32.024 0.100 1 1092 82
        i 6.110 32.040 0.100 1 1098 82
        i 6.111 32.416 0.100 1 1095 82
        i 6.112 32.497 0.100 1 1092 75
        i 6.113 32.583 0.100 1 1100 80
        i 6.114 32.744 0.100 1 1090 75
        i 6.115 32.924 0.100 1 1100 82
        i 6.116 33.005 0.100 1 1092 80
        i 6.117 33.144 0.100 1 1097 55
        i 6.118 33.341 0.100 1 1096 83
        i 6.119 33.527 0.100 1 1100 62
        i 6.120 33.587 0.100 1 1100 55
        i 6.121 33.725 0.100 1 1101 76
        i 6.122 33.865 0.100 1 1102 61
        i 4.009 34.001 -1 3 31 45
        i 4.010 34.001 -1 3 43 63
        i -4.007 34.001 0
        i -4.008 34.001 0
        i 6.123 34.243 0.100 1 1098 59
        i 6.124 34.292 0.100 1 1098 57
        i 6.125 34.320 0.100 1 1094 75
        i 6.126 34.420 0.100 1 1097 58
        i 6.127 34.631 0.100 1 1092 81
        i 6.128 35.004 0.100 1 1104 71
        i 6.129 35.029 0.100 1 1096 71
        i 6.130 35.108 0.100 1 1104 64
        i 6.131 35.167 0.100 1 1099 60
        i 6.132 35.220 0.100 1 1094 80
        i 6.133 35.309 0.100 1 1092 68
        i 6.134 35.741 0.100 1 1098 73
        i 6.135 35.808 0.100 1 1100 74
        i 6.136 35.863 0.100 1 1106 83
        i 6.137 36.008 0.100 1 1101 55
        i 6.138 36.057 0.100 1 1102 67
        i 6.139 36.209 0.100 1 1090 77
        i 6.140 36.532 0.100 1 1092 79
        i 6.141 36.572 0.100 1 1098 74
        i 6.142 36.720 0.100 1 1100 63
        i 6.143 36.859 0.100 1 1096 83
        i 6.144 36.875 0.100 1 1098 79
        i 6.145 36.936 0.100 1 1091 63
        i 6.146 37.240 0.100 1 1091 64
        i 6.147 37.301 0.100 1 1098 77
        i 6.148 37.451 0.100 1 1093 54
        i 6.149 37.511 0.100 1 1100 56
        i 6.150 37.708 0.100 1 1098 66
        i 6.151 37.795 0.100 1 1100 57
        i 6.152 38.035 0.100 1 1099 59
        i 6.153 38.053 0.100 1 1099 74
        i 6.154 38.131 0.100 1 1094 68
        i 6.155 38.397 0.100 1 1103 78
        i 6.156 38.411 0.100 1 1100 70
        i 6.157 38.641 0.100 1 1095 56
        i 6.158 38.740 0.100 1 1097 78
        i 6.159 38.865 0.100 1 1097 74
        i 6.160 38.868 0.100 1 1097 60
        i 6.161 38.967 0.100 1 1098 68
        i 6.162 39.108 0.100 1 1093 56
        i 6.163 39.532 0.100 1 1093 80
        i 6.164 39.539 0.100 1 1097 52
        i 6.165 39.559 0.100 1 1105 58
        i 6.166 39.591 0.100 1 1100 73
        i 6.167 39.643 0.100 1 1095 68
        i 6.168 39.723 0.100 1 1091 60
        i 6.169 40.240 0.100 1 1099 73
        i 6.170 40.285 0.100 1 1099 74
        i 6.171 40.296 0.100 1 1105 60
        i 6.172 40.408 0.100 1 1103 56
        i 6.173 40.453 0.100 1 1102 75
        i 6.174 40.668 0.100 1 1089 76
        i 6.175 41.043 0.100 1 1091 72
        i 6.176 41.104 0.100 1 1097 55
        i 6.177 41.180 0.100 1 1097 76
        i 6.178 41.204 0.100 1 1099 53
        i 6.179 41.269 0.100 1 1101 77
        i 6.180 41.403 0.100 1 1092 77
        i 6.181 41.424 0.100 1 1103 75
        i 6.182 41.740 0.100 1 1091 69
        i 6.183 41.831 0.100 1 1097 53
        i 6.184 41.940 0.100 1 1094 84
        i 6.185 42.097 0.100 1 1101 52
        i 6.186 42.151 0.100 1 1099 81
        i 6.187 42.175 0.100 1 1099 81
        i 6.188 42.381 0.100 1 1101 74
        i 6.189 42.547 0.100 1 1098 72
        i 6.190 42.564 0.100 1 1098 77
        i 6.191 42.615 0.100 1 1095 63
        i 6.192 42.929 0.100 1 1103 54
        i 6.193 42.975 0.100 1 1099 60
        i 6.194 42.984 0.100 1 1103 66
        i 6.195 43.007 0.100 1 1101 62
        i 6.196 43.240 0.100 1 1096 64
        i 6.197 43.308 0.100 1 1097 49
        i 6.198 43.355 0.100 1 1096 68
        i 6.199 43.585 0.100 1 1094 64
        i 6.200 43.644 0.100 1 1105 70
        i 6.201 43.652 0.100 1 1097 80
        i 6.202 43.941 0.100 1 1095 73
        i 6.203 44.051 0.100 1 1098 73
        i 6.204 44.059 0.100 1 1100 65
        i 6.205 44.107 0.100 1 1096 53
        i 6.206 44.183 0.100 1 1105 80
        i 6.207 44.207 0.100 1 1091 49
        i 6.208 44.428 0.100 1 1095 67
        i 6.209 44.740 0.100 1 1100 56
        i 6.210 44.744 0.100 1 1093 81
        i 6.211 44.800 0.100 1 1105 71
        i 6.212 44.804 0.100 1 1098 58
        i 6.213 44.943 0.100 1 1102 62
        i 6.214 45.155 0.100 1 1098 49
        i 6.215 45.196 0.100 1 1090 65
        i 6.216 45.555 0.100 1 1090 67
        i 6.217 45.564 0.100 1 1098 81
        i 6.218 45.677 0.100 1 1096 74
        i 6.219 45.708 0.100 1 1102 71
        i 6.220 45.777 0.100 1 1098 67
        i 6.221 45.915 0.100 1 1093 71
        i 6.222 45.988 0.100 1 1102 55
        i 6.223 46.240 0.100 1 1092 80
        i 6.224 46.449 0.100 1 1096 71
        i 6.225 46.473 0.100 1 1095 74
        i 6.226 46.473 0.100 1 1100 73
        i 6.227 46.481 0.100 1 1100 57
        i 6.228 46.631 0.100 1 1102 84
        i 6.229 46.825 0.100 1 1090 62
        i 6.230 46.879 0.100 1 1100 61
        i 6.231 47.059 0.100 1 1098 54
        i 6.232 47.119 0.100 1 1097 63
        i 6.233 47.188 0.100 1 1096 50
        i 6.234 47.368 0.100 1 1088 62
        i 6.235 47.408 0.100 1 1104 81
        i 6.236 47.419 0.100 1 1098 77
        i 6.237 47.432 0.100 1 1104 76
        i 6.238 47.475 0.100 1 1100 58
        i 6.239 47.740 0.100 1 1096 80
        i 6.240 47.836 0.100 1 1098 75
        i 6.241 47.888 0.100 1 1095 83
        i 6.242 47.937 0.100 1 1106 65
        i -5.001 48.000 0
        i -4.009 48.000 0
        i -4.010 48.000 0
        i 6.243 48.009 0.100 1 1094 67
        i 6.244 48.091 0.100 1 1098 63
        i 6.245 48.217 0.100 1 1096 78
        i 6.246 48.219 0.100 1 1102 78
        i 6.247 48.561 0.100 1 1099 65
        i 6.248 48.571 0.100 1 1101 79
        i 6.249 48.585 0.100 1 1096 73
        i 6.250 48.780 0.100 1 1090 64
        i 6.251 48.869 0.100 1 1106 52
        i 6.252 48.876 0.100 1 1096 50
        i 6.253 48.993 0.100 1 1096 52
        i 6.254 49.197 0.100 1 1094 83
        i 6.255 49.239 0.100 1 1101 67
        i 6.256 49.337 0.100 1 1097 64
        i 6.257 49.375 0.100 1 1104 81
        i 6.258 49.476 0.100 1 1103 72
        i 6.259 49.747 0.100 1 1090 56
        i 6.260 49.756 0.100 1 1098 58
        i 6.261 49.912 0.100 1 1094 75
        i 6.262 49.913 0.100 1 1094 74
        i 6.263 50.017 0.100 1 1098 61
        i 6.264 50.064 0.100 1 1091 74
        i 6.265 50.265 0.100 1 1095 53
        i 6.266 50.372 0.100 1 1097 50
        i 6.267 50.435 0.100 1 1102 64
        i 6.268 50.469 0.100 1 1093 65
        i 6.269 50.653 0.100 1 1096 57
        i 6.270 50.737 0.100 1 1093 56
        i 6.271 50.807 0.100 1 1101 80
        i 6.272 50.861 0.100 1 1102 70
        i 6.273 51.049 0.100 1 1096 61
        i 6.274 51.088 0.100 1 1095 60
        i 6.275 51.164 0.100 1 1103 73
        i 6.276 51.171 0.100 1 1099 70
        i 6.277 51.213 0.100 1 1089 72
        i 6.278 51.547 0.100 1 1099 79
        i 6.279 51.567 0.100 1 1097 59
        i 6.280 51.716 0.100 1 1096 65
        i 6.281 51.741 0.100 1 1097 64
        i 6.282 51.783 0.100 1 1097 49
        i 6.283 51.835 0.100 1 1089 63
        i 6.284 51.879 0.100 1 1105 77
        i 6.285 51.887 0.100 1 1103 62
        i 6.286 52.236 0.100 1 1095 66
        i 6.287 52.385 0.100 1 1099 76
        i 6.288 52.433 0.100 1 1095 62
        i 6.289 52.464 0.100 1 1094 72
        i 6.290 52.467 0.100 1 1101 78
        i 6.291 52.529 0.100 1 1107 72
        i 6.292 52.635 0.100 1 1097 71
        i 6.293 52.661 0.100 1 1095 81
        i 6.294 53.064 0.100 1 1097 77
        i 6.295 53.069 0.100 1 1099 64
        i 6.296 53.123 0.100 1 1103 62
        i 6.297 53.125 0.100 1 1102 65
        i 6.298 53.375 0.100 1 1089 75
        i 6.299 53.435 0.100 1 1105 58
        i 6.300 53.439 0.100 1 1097 57
        i 6.301 53.615 0.100 1 1095 62
        i 6.302 53.735 0.100 1 1102 57
        i 6.303 53.871 0.100 1 1097 70
        i 6.304 54.013 0.100 1 1093 72
        i 6.305 54.053 0.100 1 1102 69
        i 6.306 54.061 0.100 1 1103 57
        i 6.307 54.296 0.100 1 1091 63
        i 6.308 54.405 0.100 1 1099 72
        i 6.309 54.456 0.100 1 1095 55
        i 6.310 54.572 0.100 1 1092 74
        i 6.311 54.583 0.100 1 1099 77
        i 6.312 54.640 0.100 1 1095 62
        i 6.313 54.853 0.100 1 1094 82
        i 6.314 54.871 0.100 1 1105 76
        i 6.315 54.929 0.100 1 1101 67
        i 6.316 54.967 0.100 1 1097 49
        i 6.317 55.040 0.100 1 1094 54
        i 6.318 55.117 0.100 1 1097 48
        i 6.319 55.233 0.100 1 1094 56
        i 6.320 55.251 0.100 1 1101 83
        i 6.321 55.469 0.100 1 1103 52
        i 6.322 55.503 0.100 1 1101 52
        i 6.323 55.511 0.100 1 1099 48
        i 6.324 55.636 0.100 1 1089 47
        i 6.325 55.641 0.100 1 1096 83
        i 6.326 55.697 0.100 1 1104 72
        i 6.327 55.728 0.100 1 1095 80
        i 6.328 56.065 0.100 1 1097 63
        i 6.329 56.075 0.100 1 1096 80
        i 6.330 56.100 0.100 1 1099 58
        i 6.331 56.329 0.100 1 1096 57
        i 6.332 56.335 0.100 1 1089 54
        i 6.333 56.340 0.100 1 1103 61
        i 6.334 56.365 0.100 1 1102 64
        i 6.335 56.372 0.100 1 1105 49
        i 6.336 56.377 0.100 1 1098 55
        i 6.337 56.732 0.100 1 1094 62
        i 6.338 56.875 0.100 1 1096 83
        i 6.339 56.933 0.100 1 1101 57
        i 6.340 56.936 0.100 1 1100 62
        i 6.341 57.001 0.100 1 1105 58
        i 6.342 57.025 0.100 1 1094 80
        i 6.343 57.056 0.100 1 1093 53
        i 6.344 57.176 0.100 1 1106 49
        i 6.345 57.213 0.100 1 1096 71
        i 6.346 57.501 0.100 1 1104 67
        i 6.347 57.560 0.100 1 1098 79
        i 6.348 57.577 0.100 1 1100 74
        i 6.349 57.696 0.100 1 1103 72
        i 6.350 57.809 0.100 1 1096 56
        i 6.351 57.904 0.100 1 1090 56
        i 6.352 57.920 0.100 1 1104 55
        i 6.353 57.931 0.100 1 1098 76
        i 6.354 58.156 0.100 1 1094 50
        i 6.355 58.231 0.100 1 1102 78
        i 6.356 58.305 0.100 1 1094 62
        i 6.357 58.421 0.100 1 1096 56
        i 6.358 58.533 0.100 1 1098 79
        i 6.359 58.645 0.100 1 1101 83
        i 6.360 58.668 0.100 1 1102 67
        i 6.361 58.743 0.100 1 1100 61
        i 6.362 58.780 0.100 1 1092 76
        i 6.363 58.844 0.100 1 1096 76
        i 6.364 58.920 0.100 1 1096 60
        i 6.365 59.080 0.100 1 1092 54
        i 6.366 59.269 0.100 1 1100 68
        i 6.367 59.279 0.100 1 1104 70
        i 6.368 59.375 0.100 1 1100 66
        i 6.369 59.385 0.100 1 1094 59
        i 6.370 59.496 0.100 1 1096 49
        i 6.371 59.504 0.100 1 1098 44
        i 6.372 59.611 0.100 1 1095 67
        i 6.373 59.619 0.100 1 1100 82
        i 6.374 59.731 0.100 1 1095 80
        i 6.375 59.816 0.100 1 1102 66
        i 6.376 59.948 0.100 1 1098 76
        i 6.377 60.065 0.100 1 1102 69
        i 6.378 60.101 0.100 1 1088 48
        i 6.379 60.128 0.100 1 1098 75
        i 6.380 60.175 0.100 1 1104 76
        i 6.381 60.233 0.100 1 1097 56
        i 6.382 60.303 0.100 1 1094 66
        i 6.383 60.509 0.100 1 1096 55
        i 6.384 60.584 0.100 1 1095 84
        i 6.385 60.748 0.100 1 1104 53
        i 6.386 60.788 0.100 1 1101 65
        i 6.387 60.873 0.100 1 1102 70
        i 6.388 60.879 0.100 1 1090 46
        i 6.389 60.907 0.100 1 1098 66
        i 6.390 60.933 0.100 1 1106 68
        i 6.391 60.943 0.100 1 1095 80
        i 6.392 61.231 0.100 1 1093 79
        i 6.393 61.349 0.100 1 1094 72
        i 6.394 61.352 0.100 1 1097 73
        i 6.395 61.395 0.100 1 1104 60
        i 6.396 61.420 0.100 1 1101 75
        i 6.397 61.597 0.100 1 1106 52
        i 6.398 61.648 0.100 1 1093 84
        i 6.399 61.836 0.100 1 1096 72
        i 6.400 61.892 0.100 1 1106 57
        i 6.401 62.088 0.100 1 1101 74
        i 6.402 62.092 0.100 1 1099 69
        i 6.403 62.111 0.100 1 1094 79
        i 6.404 62.219 0.100 1 1096 53
        i 6.405 62.265 0.100 1 1102 57
        i 6.406 62.336 0.100 1 1103 69
        i 6.407 62.343 0.100 1 1091 49
        i 6.408 62.492 0.100 1 1099 70
        i 6.409 62.661 0.100 1 1097 62
        i 6.410 62.701 0.100 1 1093 73
        i 6.411 62.731 0.100 1 1101 58
        i 6.412 63.008 0.100 1 1095 74
        i 6.413 63.131 0.100 1 1098 54
        i 6.414 63.149 0.100 1 1101 67
        i 6.415 63.175 0.100 1 1093 54
        i 6.416 63.205 0.100 1 1101 54
        i 6.417 63.236 0.100 1 1100 56
        i 6.418 63.348 0.100 1 1099 70
        i 6.419 63.387 0.100 1 1097 45
        i 6.420 63.592 0.100 1 1093 66
        i 6.421 63.689 0.100 1 1103 61
        i 6.422 63.892 0.100 1 1099 47
        i 6.423 63.917 0.100 1 1093 80
        i 6.424 63.928 0.100 1 1097 53
        i 6.425 63.928 0.100 1 1101 71
        i 6.426 63.935 0.100 1 1095 72
        i 6.427 63.935 0.100 1 1099 67
        i 6.428 64.180 0.100 1 1096 74
        i 6.429 64.231 0.100 1 1095 69
        i 6.430 64.504 0.100 1 1103 79
        i 6.431 64.568 0.100 1 1089 45
        i 6.432 64.585 0.100 1 1103 73
        i 6.433 64.652 0.100 1 1103 83
        i 6.434 64.663 0.100 1 1097 77
        i 6.435 64.664 0.100 1 1101 76
        i 6.436 64.785 0.100 1 1093 54
        i 6.437 64.824 0.100 1 1098 61
        i 6.438 65.076 0.100 1 1095 58
        i 6.439 65.096 0.100 1 1095 72
        i 6.440 65.169 0.100 1 1105 69
        i 6.441 65.195 0.100 1 1105 71
        i 6.442 65.211 0.100 1 1101 75
        i 6.443 65.245 0.100 1 1107 77
        i 6.444 65.344 0.100 1 1099 50
        i 6.445 65.423 0.100 1 1091 56
        i 6.446 65.493 0.100 1 1107 55
        i 6.447 65.555 0.100 1 1094 53
        i 6.448 65.731 0.100 1 1092 70
        i 6.449 65.795 0.100 1 1095 57
        i 6.450 65.823 0.100 1 1095 56
        i 6.451 65.829 0.100 1 1098 72
        i 6.452 65.877 0.100 1 1101 67
        i 6.453 66.005 0.100 1 1105 62
        i 6.454 66.133 0.100 1 1107 56
        i 6.455 66.237 0.100 1 1092 62
        i 6.456 66.381 0.100 1 1105 63
        i 6.457 66.389 0.100 1 1095 57
        i 6.458 66.461 0.100 1 1097 64
        i 6.459 66.600 0.100 1 1102 78
        i 6.460 66.624 0.100 1 1100 70
        i 6.461 66.645 0.100 1 1103 56
        i 6.462 66.660 0.100 1 1103 64
        i 6.463 66.701 0.100 1 1097 74
        i 6.464 66.755 0.100 1 1091 67
        i 6.465 66.833 0.100 1 1102 79
        i 6.466 66.937 0.100 1 1099 69
        i 6.467 67.060 0.100 1 1098 58
        i 6.468 67.176 0.100 1 1093 63
        i 6.469 67.231 0.100 1 1100 57
        i 6.470 67.441 0.100 1 1101 67
        i 6.471 67.541 0.100 1 1094 56
        i 6.472 67.595 0.100 1 1094 81
        i 6.473 67.604 0.100 1 1099 66
        i 6.474 67.628 0.100 1 1106 78
        i 6.475 67.649 0.100 1 1101 64
        i 6.476 67.728 0.100 1 1096 79
        i 6.477 67.783 0.100 1 1097 69
        i 6.478 67.825 0.100 1 1100 59
        i 6.479 68.104 0.100 1 1094 73
        i 6.480 68.235 0.100 1 1103 78
        i 6.481 68.297 0.100 1 1104 54
        i 6.482 68.347 0.100 1 1094 79
        i 6.483 68.356 0.100 1 1100 67
        i 6.484 68.381 0.100 1 1098 80
        i 6.485 68.449 0.100 1 1092 53
        i 6.486 68.493 0.100 1 1102 63
        i 6.487 68.527 0.100 1 1098 77
        i 6.488 68.731 0.100 1 1096 61
        i 6.489 68.748 0.100 1 1097 82
        i 6.490 68.995 0.100 1 1104 71
        i 6.491 69.075 0.100 1 1100 52
        i 6.492 69.109 0.100 1 1090 44
        i 6.493 69.129 0.100 1 1102 62
        i 6.494 69.191 0.100 1 1104 83
        i 6.495 69.243 0.100 1 1092 52
        i 6.496 69.249 0.100 1 1098 77
        i 6.497 69.264 0.100 1 1096 74
        i 6.498 69.413 0.100 1 1099 53
        i 6.499 69.535 0.100 1 1096 60
        i 6.500 69.607 0.100 1 1094 82
        i 6.501 69.633 0.100 1 1100 78
        i 6.502 69.741 0.100 1 1094 62
        i 6.503 69.757 0.100 1 1100 79
        i 6.504 69.768 0.100 1 1106 54
        i 6.505 69.940 0.100 1 1106 66
        i 6.506 70.043 0.100 1 1092 71
        i 6.507 70.092 0.100 1 1106 53
        i 6.508 70.165 0.100 1 1093 57
        i 6.509 70.229 0.100 1 1092 53
        i 6.510 70.261 0.100 1 1098 65
        i 6.511 70.307 0.100 1 1098 62
        i 6.512 70.335 0.100 1 1100 58
        i 6.513 70.339 0.100 1 1096 69
        i 6.514 70.545 0.100 1 1108 63
        i 6.515 70.631 0.100 1 1104 77
        i 6.516 70.675 0.100 1 1104 71
        i 6.517 70.772 0.100 1 1098 59
        i 6.518 70.827 0.100 1 1091 54
        i 6.519 70.931 0.100 1 1094 75
        i 6.520 71.083 0.100 1 1102 76
        i 6.521 71.109 0.100 1 1101 70
        i 6.522 71.156 0.100 1 1100 77
        i 6.523 71.168 0.100 1 1092 64
        i 6.524 71.213 0.100 1 1104 62
        i 6.525 71.301 0.100 1 1098 75
        i 6.526 71.384 0.100 1 1100 73
        i 6.527 71.401 0.100 1 1101 72
        i 6.528 71.528 0.100 1 1096 54
        i 6.529 71.639 0.100 1 1092 51
        i 6.530 71.728 0.100 1 1099 73
        i 6.531 71.909 0.100 1 1094 50
        i 6.532 71.973 0.100 1 1100 78
        i 6.533 72.012 0.100 1 1106 70
        i 6.534 72.016 0.100 1 1100 53
        i 6.535 72.036 0.100 1 1102 80
        i 6.536 72.048 0.100 1 1105 73
        i 6.537 72.132 0.100 1 1093 71
        i 6.538 72.168 0.100 1 1098 66
        i 6.539 72.389 0.100 1 1099 71
        i 6.540 72.612 0.100 1 1095 72
        i 6.541 72.691 0.100 1 1098 56
        i 6.542 72.760 0.100 1 1093 69
        i 6.543 72.820 0.100 1 1100 50
        i 6.544 72.833 0.100 1 1103 70
        i 6.545 72.835 0.100 1 1102 59
        i 6.546 72.932 0.100 1 1093 82
        i 6.547 72.937 0.100 1 1102 58
        i 6.548 72.943 0.100 1 1098 54
        i 6.549 73.227 0.100 1 1097 68
        i 6.550 73.291 0.100 1 1097 66
        i 6.551 73.383 0.100 1 1097 63
        i 6.552 73.487 0.100 1 1100 78
        i 6.553 73.557 0.100 1 1101 82
        i 6.554 73.633 0.100 1 1099 50
        i 6.555 73.652 0.100 1 1091 55
        i 6.556 73.701 0.100 1 1091 71
        i 6.557 73.756 0.100 1 1105 73
        i 6.558 73.907 0.100 1 1095 64
        i 6.559 73.977 0.100 1 1100 56
        i 6.560 74.109 0.100 1 1099 62
        i 6.561 74.115 0.100 1 1093 59
        i 6.562 74.197 0.100 1 1099 53
        i 6.563 74.233 0.100 1 1101 65
        i 6.564 74.367 0.100 1 1106 55
        i 6.565 74.428 0.100 1 1095 61
        i 6.566 74.429 0.100 1 1105 62
        i 6.567 74.572 0.100 1 1105 58
        i 6.568 74.641 0.100 1 1093 51
        i 6.569 74.725 0.100 1 1091 53
        i 6.570 74.752 0.100 1 1092 82
        i 6.571 74.776 0.100 1 1097 59
        i 6.572 74.837 0.100 1 1099 61
        i 6.573 74.856 0.100 1 1099 72
        i 6.574 74.953 0.100 1 1097 53
        i 6.575 74.956 0.100 1 1107 69
        i 6.576 75.009 0.100 1 1103 56
        i 6.577 75.255 0.100 1 1103 50
        i 6.578 75.392 0.100 1 1092 61
        i 6.579 75.452 0.100 1 1093 51
        i 6.580 75.576 0.100 1 1101 78
        i 6.581 75.617 0.100 1 1101 74
        i 6.582 75.620 0.100 1 1095 73
        i 6.583 75.644 0.100 1 1093 63
        i 6.584 75.741 0.100 1 1101 59
        i 6.585 75.873 0.100 1 1101 58
        i 6.586 75.899 0.100 1 1099 51
        i 6.587 75.945 0.100 1 1100 69
        i 6.588 76.059 0.100 1 1105 60
        i 6.589 76.083 0.100 1 1091 73
        i 6.590 76.224 0.100 1 1099 80
        i 6.591 76.228 0.100 1 1105 61
        i 6.592 76.341 0.100 1 1095 72
        i 6.593 76.345 0.100 1 1099 54
        i 6.594 76.425 0.100 1 1101 57
        i 6.595 76.633 0.100 1 1099 68
        i 6.596 76.636 0.100 1 1107 72
        i 6.597 76.663 0.100 1 1093 73
        i 6.598 76.680 0.100 1 1103 59
        i 6.599 76.737 0.100 1 1109 78
        i 6.600 76.912 0.100 1 1098 76
        i 6.601 77.101 0.100 1 1102 78
        i 6.602 77.120 0.100 1 1096 65
        i 6.603 77.180 0.100 1 1097 59
        i 6.604 77.236 0.100 1 1093 75
        i 6.605 77.261 0.100 1 1103 75
        i 6.606 77.364 0.100 1 1099 44
        i 6.607 77.408 0.100 1 1094 82
        i 6.608 77.421 0.100 1 1101 74
        i 6.609 77.432 0.100 1 1097 71
        i 6.610 77.621 0.100 1 1107 72
        i 6.611 77.723 0.100 1 1098 75
        i 6.612 77.739 0.100 1 1098 76
        i 6.613 77.792 0.100 1 1098 75
        i 6.614 77.959 0.100 1 1099 77
        i 6.615 77.979 0.100 1 1100 59
        i 6.616 78.017 0.100 1 1099 60
        i 6.617 78.200 0.100 1 1105 82
        i 6.618 78.223 0.100 1 1091 63
        i 6.619 78.243 0.100 1 1095 79
        i 6.620 78.273 0.100 1 1091 59
        i 6.621 78.500 0.100 1 1100 65
        i 6.622 78.529 0.100 1 1104 51
        i 6.623 78.585 0.100 1 1098 83
        i 6.624 78.623 0.100 1 1092 82
        i 6.625 78.641 0.100 1 1100 51
        i 6.626 78.735 0.100 1 1104 57
        i 6.627 78.800 0.100 1 1100 55
        i 6.628 78.876 0.100 1 1105 72
        i 6.629 78.892 0.100 1 1107 57
        i 6.630 78.992 0.100 1 1095 52
        i 6.631 79.185 0.100 1 1093 55
        i 6.632 79.221 0.100 1 1090 66
        i 6.633 79.228 0.100 1 1106 66
        i 6.634 79.296 0.100 1 1092 58
        i 6.635 79.308 0.100 1 1096 79
        i 6.636 79.368 0.100 1 1100 60
        i 6.637 79.452 0.100 1 1102 64
        i 6.638 79.468 0.100 1 1098 72
        i 6.639 79.491 0.100 1 1107 73
        i 6.640 79.639 0.100 1 1098 53
        i 6.641 79.639 0.100 1 1102 57
        i 6.642 79.740 0.100 1 1100 66
        i 6.643 79.915 0.100 1 1093 59
        i 6.644 79.917 0.100 1 1092 45
        i 6.645 80.125 0.100 1 1100 82
        i 6.646 80.140 0.100 1 1100 80
        i 6.647 80.211 0.100 1 1094 55
        i 6.648 80.239 0.100 1 1094 76
        i 6.649 80.327 0.100 1 1102 82
        i 6.650 80.361 0.100 1 1100 64
        i 6.651 80.435 0.100 1 1102 64
        i 6.652 80.447 0.100 1 1099 75
        i 6.653 80.460 0.100 1 1098 75
        i 6.654 80.469 0.100 1 1090 73
        i 6.655 80.616 0.100 1 1106 59
        i 6.656 80.721 0.100 1 1098 53
        i 6.657 80.788 0.100 1 1098 78
        i 6.658 80.863 0.100 1 1096 67
        i 6.659 80.935 0.100 1 1104 54
        i 6.660 81.023 0.100 1 1102 56
        i 6.661 81.097 0.100 1 1100 51
        i 6.662 81.193 0.100 1 1092 57
        i 6.663 81.260 0.100 1 1108 77
        i 6.664 81.389 0.100 1 1108 68
        i 6.665 81.392 0.100 1 1097 62
        i 6.666 81.395 0.100 1 1104 61
        i 6.667 81.583 0.100 1 1104 70
        i 6.668 81.629 0.100 1 1096 58
        i 6.669 81.803 0.100 1 1092 71
        i 6.670 81.831 0.100 1 1100 69
        i 6.671 81.884 0.100 1 1094 70
        i 6.672 81.895 0.100 1 1102 79
        i 6.673 81.905 0.100 1 1098 69
        i 6.674 81.993 0.100 1 1096 57
        i 6.675 82.024 0.100 1 1098 74
        i 6.676 82.221 0.100 1 1099 69
        i 6.677 82.251 0.100 1 1099 60
        i 6.678 82.252 0.100 1 1106 53
        i 6.679 82.399 0.100 1 1100 68
        i 6.680 82.524 0.100 1 1106 81
        i 6.681 82.555 0.100 1 1098 73
        i 6.682 82.620 0.100 1 1098 80
        i 6.683 82.641 0.100 1 1100 77
        i 6.684 82.649 0.100 1 1096 57
        i 6.685 82.773 0.100 1 1090 49
        i 6.686 82.893 0.100 1 1092 74
        i 6.687 82.907 0.100 1 1104 71
        i 6.688 82.981 0.100 1 1101 81
        i 6.689 83.060 0.100 1 1097 73
        i 6.690 83.133 0.100 1 1091 72
        i 6.691 83.145 0.100 1 1104 52
        i 6.692 83.300 0.100 1 1108 49
        i 6.693 83.395 0.100 1 1100 65
        i 6.694 83.437 0.100 1 1096 70
        i 6.695 83.437 0.100 1 1104 66
        i 6.696 83.463 0.100 1 1107 56
        i 6.697 83.609 0.100 1 1101 56
        i 6.698 83.721 0.100 1 1091 59
        i 6.699 83.727 0.100 1 1094 51
        i 6.700 83.799 0.100 1 1091 78
        i 6.701 83.897 0.100 1 1101 82
        i 6.702 84.021 0.100 1 1102 48
        i 6.703 84.087 0.100 1 1106 79
        i 6.704 84.107 0.100 1 1097 59
        i 6.705 84.168 0.100 1 1102 76
        i 6.706 84.204 0.100 1 1098 84
        i 6.707 84.228 0.100 1 1099 60
        i 6.708 84.364 0.100 1 1095 51
        i 6.709 84.380 0.100 1 1092 53
        i 6.710 84.396 0.100 1 1093 62
        i 6.711 84.637 0.100 1 1099 61
        i 6.712 84.769 0.100 1 1100 50
        i 6.713 84.777 0.100 1 1107 74
        i 6.714 84.804 0.100 1 1095 73
        i 6.715 84.825 0.100 1 1099 63
        i 6.716 84.885 0.100 1 1103 59
        i 6.717 84.907 0.100 1 1099 69
        i 6.718 84.907 0.100 1 1089 62
        i 6.719 84.997 0.100 1 1103 73
        i 6.720 85.203 0.100 1 1099 78
        i 6.721 85.221 0.100 1 1097 67
        i 6.722 85.347 0.100 1 1093 71
        i 6.723 85.352 0.100 1 1097 83
        i 6.724 85.411 0.100 1 1097 76
        i 6.725 85.613 0.100 1 1099 55
        i 6.726 85.619 0.100 1 1102 66
        i 6.727 85.643 0.100 1 1109 49
        i 6.728 85.697 0.100 1 1093 61
        i 6.729 85.831 0.100 1 1096 53
        i 6.730 85.884 0.100 1 1105 49
        i 6.731 86.021 0.100 1 1107 55
        i 6.732 86.025 0.100 1 1105 71
        i 6.733 86.131 0.100 1 1103 56
        i 6.734 86.141 0.100 1 1097 61
        i 6.735 86.240 0.100 1 1099 57
        i 6.736 86.333 0.100 1 1095 64
        i 6.737 86.396 0.100 1 1091 66
        i 6.738 86.441 0.100 1 1095 70
        i 6.739 86.500 0.100 1 1097 53
        i 6.740 86.628 0.100 1 1099 64
        i 6.741 86.631 0.100 1 1105 56
        i 6.742 86.667 0.100 1 1100 76
        i 6.743 86.721 0.100 1 1099 74
        i 6.744 86.845 0.100 1 1105 77
        i 6.745 86.875 0.100 1 1099 65
        i 6.746 86.943 0.100 1 1097 71
        i 6.747 87.084 0.100 1 1101 61
        i 6.748 87.152 0.100 1 1097 61
        i 6.749 87.232 0.100 1 1105 51
        i 6.750 87.233 0.100 1 1101 79
        i 6.751 87.321 0.100 1 1089 51
        i 6.752 87.419 0.100 1 1102 74
        i 6.753 87.435 0.100 1 1093 59
        i 6.754 87.591 0.100 1 1097 63
        i 6.755 87.645 0.100 1 1091 83
        i 6.756 87.711 0.100 1 1107 59
        i 6.757 87.812 0.100 1 1097 55
        i 6.758 87.885 0.100 1 1103 49
        i 6.759 87.897 0.100 1 1099 61
        i 6.760 87.959 0.100 1 1103 49
        i 6.761 87.988 0.100 1 1099 55
        i 6.762 88.043 0.100 1 1107 56
        i 6.763 88.191 0.100 1 1095 43
        i 6.764 88.221 0.100 1 1092 68
        i 6.765 88.257 0.100 1 1092 80
        i 6.766 88.483 0.100 1 1102 64
        i 6.767 88.615 0.100 1 1101 77
        i 6.768 88.685 0.100 1 1105 63
        i 6.769 88.700 0.100 1 1099 70
        i 6.770 88.745 0.100 1 1097 68
        i 6.771 88.767 0.100 1 1091 45
        i 6.772 88.769 0.100 1 1101 50
        i 6.773 88.821 0.100 1 1101 68
        i 6.774 88.833 0.100 1 1094 84
        i 6.775 89.025 0.100 1 1099 76
        i 6.776 89.149 0.100 1 1098 75
        i 6.777 89.151 0.100 1 1107 58
        i 6.778 89.191 0.100 1 1101 49
        i 6.779 89.345 0.100 1 1098 65
        i 6.780 89.372 0.100 1 1089 56
        i 6.781 89.396 0.100 1 1111 79
        i 6.782 89.399 0.100 1 1095 52
        i 6.783 89.416 0.100 1 1104 66
        i 6.784 89.441 0.100 1 1099 77
        i 6.785 89.444 0.100 1 1103 72
        i 6.786 89.664 0.100 1 1094 67
        i 6.787 89.721 0.100 1 1096 74
        i 6.788 89.799 0.100 1 1100 54
        i 6.789 89.923 0.100 1 1108 50
        i 6.790 89.961 0.100 1 1098 53
        i 6.791 90.037 0.100 1 1097 68
        i 6.792 90.067 0.100 1 1108 51
        i 6.793 90.155 0.100 1 1103 75
        i 6.794 90.157 0.100 1 1099 62
        i 6.795 90.173 0.100 1 1094 63
        i 6.796 90.176 0.100 1 1105 56
        i 6.797 90.248 0.100 1 1096 77
        i 6.798 90.363 0.100 1 1106 68
        i 6.799 90.559 0.100 1 1094 69
        i 6.800 90.589 0.100 1 1106 73
        i 6.801 90.599 0.100 1 1104 78
        i 6.802 90.653 0.100 1 1098 56
        i 6.803 90.723 0.100 1 1099 56
        i 6.804 90.755 0.100 1 1096 58
        i 6.805 90.863 0.100 1 1100 59
        i 6.806 90.888 0.100 1 1096 75
        i 6.807 90.933 0.100 1 1090 75
        i 6.808 91.009 0.100 1 1104 61
        i 6.809 91.063 0.100 1 1101 53
        i 6.810 91.121 0.100 1 1096 55
        i 6.811 91.221 0.100 1 1100 53
        i 6.812 91.221 0.100 1 1106 55
        i 6.813 91.288 0.100 1 1104 83
        i 6.814 91.351 0.100 1 1098 71
        i 6.815 91.431 0.100 1 1102 79
        i 6.816 91.541 0.100 1 1098 69
        i 6.817 91.625 0.100 1 1096 73
        i 6.818 91.688 0.100 1 1102 76
        i 6.819 91.803 0.100 1 1102 55
        i 6.820 91.813 0.100 1 1090 66
        i 6.821 91.836 0.100 1 1103 53
        i 6.822 91.864 0.100 1 1106 64
        i 6.823 91.979 0.100 1 1094 69
        i 6.824 92.121 0.100 1 1096 57
        i 6.825 92.133 0.100 1 1098 82
        i 6.826 92.156 0.100 1 1090 77
        i 6.827 92.256 0.100 1 1106 51
        i 6.828 92.296 0.100 1 1100 81
        i 6.829 92.447 0.100 1 1102 65
        i 6.830 92.521 0.100 1 1100 73
        i 6.831 92.525 0.100 1 1098 49
        i 6.832 92.633 0.100 1 1102 58
        i 6.833 92.656 0.100 1 1096 71
        i 6.834 92.696 0.100 1 1093 70
        i 6.835 92.720 0.100 1 1092 69
        i 6.836 92.801 0.100 1 1108 59
        i 6.837 93.037 0.100 1 1110 51
        i 6.838 93.068 0.100 1 1102 69
        i 6.839 93.096 0.100 1 1104 68
        i 6.840 93.125 0.100 1 1100 66
        i 6.841 93.160 0.100 1 1090 59
        i 6.842 93.197 0.100 1 1100 74
        i 6.843 93.200 0.100 1 1100 71
        i 6.844 93.251 0.100 1 1095 80
        i 6.845 93.328 0.100 1 1096 74
        i 6.846 93.409 0.100 1 1100 72
        i 6.847 93.529 0.100 1 1098 73
        i 6.848 93.659 0.100 1 1097 68
        i 6.849 93.784 0.100 1 1097 80
        i 6.850 93.789 0.100 1 1102 69
        i 6.851 93.843 0.100 1 1088 44
        i 6.852 93.852 0.100 1 1108 61
        i 6.853 93.887 0.100 1 1108 65
        i 6.854 93.929 0.100 1 1104 50
        i 6.855 93.936 0.100 1 1096 63
        i 6.856 93.947 0.100 1 1104 54
        i 6.857 93.988 0.100 1 1098 80
        i 6.858 94.033 0.100 1 1102 57
        i 6.859 94.048 0.100 1 1100 70
        i 6.860 94.219 0.100 1 1095 62
        i 6.861 94.453 0.100 1 1098 49
        i 6.862 94.464 0.100 1 1105 48
        i 6.863 94.507 0.100 1 1106 53
        i 6.864 94.567 0.100 1 1104 75
        i 6.865 94.581 0.100 1 1108 55
        i 6.866 94.649 0.100 1 1095 76
        i 6.867 94.664 0.100 1 1095 69
        i 6.868 94.704 0.100 1 1096 69
        i 6.869 94.705 0.100 1 1098 59
        i 6.870 94.739 0.100 1 1106 77
        i 6.871 94.964 0.100 1 1094 65
        i 6.872 95.156 0.100 1 1100 59
        i 6.873 95.161 0.100 1 1099 59
        i 6.874 95.176 0.100 1 1097 78
        i 6.875 95.273 0.100 1 1106 80
        i 6.876 95.323 0.100 1 1098 57
        i 6.877 95.372 0.100 1 1096 75
        i 6.878 95.373 0.100 1 1107 74
        i 6.879 95.380 0.100 1 1089 51
        i 6.880 95.457 0.100 1 1101 53
        i 6.881 95.639 0.100 1 1103 50
        i 6.882 95.664 0.100 1 1096 44
        i 6.883 95.717 0.100 1 1101 70
        i 6.884 95.771 0.100 1 1094 55
        i 6.885 95.827 0.100 1 1097 79
        i 6.886 95.851 0.100 1 1103 82
        i 6.887 96.037 0.100 1 1096 49
        i 6.888 96.081 0.100 1 1101 63
        i 6.889 96.111 0.100 1 1103 52
        i 6.890 96.180 0.100 1 1099 66
        i 6.891 96.216 0.100 1 1091 61
        i 6.892 96.252 0.100 1 1103 62
        i 6.893 96.443 0.100 1 1095 73
        i 6.894 96.531 0.100 1 1107 61
        i 6.895 96.575 0.100 1 1099 68
        i 6.896 96.652 0.100 1 1095 62
        i 6.897 96.664 0.100 1 1091 83
        i 6.898 96.731 0.100 1 1101 70
        i 6.899 96.856 0.100 1 1106 59
        i 6.900 96.931 0.100 1 1101 62
        i 6.901 96.945 0.100 1 1101 60
        i 6.902 96.972 0.100 1 1097 78
        i 6.903 97.041 0.100 1 1097 51
        i 6.904 97.077 0.100 1 1099 75
        i 6.905 97.133 0.100 1 1094 58
        i 6.906 97.213 0.100 1 1109 61
        i 6.907 97.216 0.100 1 1093 74
        i 6.908 97.445 0.100 1 1101 70
        i 6.909 97.508 0.100 1 1099 68
        i 6.910 97.508 0.100 1 1103 78
        i 6.911 97.623 0.100 1 1089 72
        i 6.912 97.652 0.100 1 1103 73
        i 6.913 97.667 0.100 1 1096 76
        i 6.914 97.732 0.100 1 1099 57
        i 6.915 97.739 0.100 1 1099 75
        i 6.916 97.740 0.100 1 1099 78
        i 6.917 97.820 0.100 1 1095 58
        i 6.918 97.881 0.100 1 1109 52
        i 6.919 98.167 0.100 1 1097 80
        i 6.920 98.223 0.100 1 1096 72
        i 6.921 98.375 0.100 1 1105 64
        i 6.922 98.383 0.100 1 1097 52
        i 6.923 98.384 0.100 1 1089 48
        i 6.924 98.388 0.100 1 1103 60
        i 6.925 98.429 0.100 1 1097 65
        i 6.926 98.476 0.100 1 1103 75
        i 6.927 98.476 0.100 1 1101 69
        i 6.928 98.497 0.100 1 1101 79
        i 6.929 98.639 0.100 1 1109 56
        i 6.930 98.715 0.100 1 1095 55
        i 6.931 98.781 0.100 1 1107 62
        i 6.932 98.912 0.100 1 1099 56
        i 6.933 98.952 0.100 1 1107 79
        i 6.934 98.977 0.100 1 1105 61
        i 6.935 99.081 0.100 1 1094 65
        i 6.936 99.124 0.100 1 1095 54
        i 6.937 99.165 0.100 1 1107 69
        i 6.938 99.245 0.100 1 1103 65
        i 6.939 99.267 0.100 1 1095 62
        i 6.940 99.325 0.100 1 1097 67
        i 6.941 99.421 0.100 1 1105 56
        i 6.942 99.653 0.100 1 1098 60
        i 6.943 99.669 0.100 1 1100 61
        i 6.944 99.680 0.100 1 1105 74
        i 6.945 99.793 0.100 1 1089 80
        i 6.946 99.812 0.100 1 1101 72
        i 6.947 99.853 0.100 1 1102 76
        i 6.948 99.920 0.100 1 1097 51
        i 6.949 99.933 0.100 1 1097 74
        i 6.950 99.957 0.100 1 1105 65
        i 6.951 100.205 0.100 1 1095 55
        i 6.952 100.213 0.100 1 1102 66
        i 6.953 100.228 0.100 1 1093 51
        i 6.954 100.269 0.100 1 1103 77
        i 6.955 100.359 0.100 1 1096 56
        i 6.956 100.447 0.100 1 1097 61
        i 6.957 100.484 0.100 1 1107 72
        i 6.958 100.501 0.100 1 1103 63
        i 6.959 100.547 0.100 1 1103 59
        i 6.960 100.584 0.100 1 1091 72
        i 6.961 100.669 0.100 1 1102 52
        i 6.962 100.896 0.100 1 1099 50
        i 6.963 100.907 0.100 1 1095 70
        i 6.964 100.908 0.100 1 1108 59
        i 6.965 100.947 0.100 1 1095 79
        i 6.966 101.104 0.100 1 1099 63
        i 6.967 101.160 0.100 1 1100 73
        i 6.968 101.172 0.100 1 1092 71
        i 6.969 101.239 0.100 1 1094 59
        i 6.970 101.385 0.100 1 1096 78
        i 6.971 101.428 0.100 1 1097 62
        i 6.972 101.443 0.100 1 1105 57
        i 6.973 101.479 0.100 1 1100 61
        i 6.974 101.480 0.100 1 1110 61
        i 6.975 101.492 0.100 1 1101 58
        i 6.976 101.572 0.100 1 1094 57
        i 6.977 101.713 0.100 1 1094 65
        i 6.978 101.853 0.100 1 1102 79
        i 6.979 101.900 0.100 1 1101 81
        i 6.980 101.980 0.100 1 1103 50
        i 6.981 102.031 0.100 1 1112 49
        i 6.982 102.084 0.100 1 1097 66
        i 6.983 102.088 0.100 1 1088 67
        i 6.984 102.147 0.100 1 1098 58
        i 6.985 102.153 0.100 1 1098 67
        i 6.986 102.184 0.100 1 1104 84
        i 6.987 102.188 0.100 1 1100 48
        i 6.988 102.261 0.100 1 1100 54
        i 6.989 102.277 0.100 1 1094 68
        i 6.990 102.589 0.100 1 1098 56
        i 6.991 102.661 0.100 1 1095 66
        i 6.992 102.676 0.100 1 1096 62
        i 6.993 102.749 0.100 1 1096 63
        i 6.994 102.796 0.100 1 1098 64
        i 6.995 102.863 0.100 1 1110 60
        i 6.996 102.913 0.100 1 1103 73
        i 6.997 102.928 0.100 1 1090 65
        i 6.998 102.936 0.100 1 1106 48
        i 6.999 102.953 0.100 1 1102 57
        i 6.001 103.027 0.100 1 1108 62
        i 6.002 103.099 0.100 1 1108 79
        i 6.003 103.213 0.100 1 1094 81
        i 6.004 103.251 0.100 1 1102 64
        i 6.005 103.369 0.100 1 1100 69
        i 6.006 103.499 0.100 1 1093 72
        i 6.007 103.512 0.100 1 1106 66
        i 6.008 103.513 0.100 1 1102 74
        i 6.009 103.547 0.100 1 1096 83
        i 6.010 103.668 0.100 1 1106 51
        i 6.011 103.708 0.100 1 1094 58
        i 6.012 103.712 0.100 1 1106 65
        i 6.013 103.775 0.100 1 1106 72
        i 6.014 103.808 0.100 1 1104 73
        i 6.015 103.911 0.100 1 1096 47
        i 6.016 104.053 0.100 1 1104 79
        i 6.017 104.131 0.100 1 1098 72
        i 6.018 104.173 0.100 1 1104 69
        i 6.019 104.180 0.100 1 1100 56
        i 6.020 104.205 0.100 1 1090 60
        i 6.021 104.249 0.100 1 1103 66
        i 6.022 104.383 0.100 1 1096 71
        i 6.023 104.495 0.100 1 1098 51
        i 6.024 104.520 0.100 1 1104 69
        i 6.025 104.527 0.100 1 1106 69
        i 6.026 104.643 0.100 1 1102 74
        i 6.027 104.647 0.100 1 1102 69
        i 6.028 104.713 0.100 1 1101 79
        i 6.029 104.713 0.100 1 1094 63
        i 6.030 104.751 0.100 1 1106 75
        i 6.031 104.891 0.100 1 1096 67
        i 6.032 104.951 0.100 1 1092 75
        i 6.033 105.044 0.100 1 1098 57
        i 6.034 105.044 0.100 1 1108 74
        i 6.035 105.068 0.100 1 1094 67
        i 6.036 105.087 0.100 1 1101 75
        i 6.037 105.156 0.100 1 1104 57
        i 6.038 105.185 0.100 1 1102 80
        i 6.039 105.264 0.100 1 1108 80
        i 6.040 105.336 0.100 1 1096 67
        i 6.041 105.379 0.100 1 1100 76
        i 6.042 105.580 0.100 1 1104 76
        i 6.043 105.684 0.100 1 1093 79
        i 6.044 105.699 0.100 1 1096 71
        i 6.045 105.704 0.100 1 1100 58
        i 6.046 105.764 0.100 1 1100 56
        i 6.047 105.764 0.100 1 1100 73
        i 6.048 105.797 0.100 1 1096 57
        i 6.049 105.825 0.100 1 1093 64
        i 6.050 105.852 0.100 1 1104 54
        i 6.051 105.895 0.100 1 1098 60
        i 6.052 105.937 0.100 1 1100 75
        i 6.053 106.011 0.100 1 1095 53
        i 6.054 106.089 0.100 1 1110 63
        i 6.055 106.213 0.100 1 1095 64
        i 6.056 106.296 0.100 1 1102 71
        i 6.057 106.332 0.100 1 1102 66
        i 6.058 106.344 0.100 1 1101 62
        i 6.059 106.439 0.100 1 1098 57
        i 6.060 106.523 0.100 1 1097 82
        i 6.061 106.537 0.100 1 1098 73
        i 6.062 106.564 0.100 1 1100 69
        i 6.063 106.576 0.100 1 1102 70
        i 6.064 106.632 0.100 1 1088 61
        i 6.065 106.716 0.100 1 1103 52
        i 6.066 106.735 0.100 1 1093 58
        i 6.067 106.899 0.100 1 1112 67
        i 6.068 106.968 0.100 1 1107 70
        i 6.069 107.056 0.100 1 1101 69
        i 6.070 107.107 0.100 1 1096 75
        i 6.071 107.121 0.100 1 1095 61
        i 6.072 107.165 0.100 1 1098 80
        i 6.073 107.188 0.100 1 1095 63
        i 6.074 107.191 0.100 1 1107 52
        i 6.075 107.263 0.100 1 1099 54
        i 6.076 107.321 0.100 1 1104 65
        i 6.077 107.383 0.100 1 1107 69
        i 6.078 107.411 0.100 1 1109 69
        i 6.079 107.431 0.100 1 1101 59
        i 6.080 107.549 0.100 1 1091 62
        i 6.081 107.644 0.100 1 1105 53
        i 6.082 107.713 0.100 1 1093 75
        i 6.083 107.813 0.100 1 1103 70
        i 6.084 107.881 0.100 1 1101 56
        i 6.085 107.937 0.100 1 1092 71
        i 6.086 107.969 0.100 1 1097 61
        i 6.087 108.001 0.100 1 1102 61
        i 6.088 108.028 0.100 1 1095 74
        i 6.089 108.036 0.100 1 1105 57
        i 6.090 108.108 0.100 1 1106 61
        i 6.091 108.159 0.100 1 1105 48
        i 6.092 108.172 0.100 1 1107 48
        i 6.093 108.269 0.100 1 1105 48
        i 6.094 108.361 0.100 1 1103 63
        i 6.095 108.453 0.100 1 1095 61
        i 6.096 108.573 0.100 1 1105 55
        i 6.097 108.608 0.100 1 1099 58
        i 6.098 108.667 0.100 1 1102 63
        i 6.099 108.673 0.100 1 1091 52
        i 6.100 108.692 0.100 1 1101 74
        i 6.101 108.773 0.100 1 1107 60
        i 6.102 108.791 0.100 1 1097 52
        i 6.103 108.941 0.100 1 1099 51
        i 6.104 108.943 0.100 1 1109 73
        i 6.105 108.961 0.100 1 1103 74
        i 6.106 109.023 0.100 1 1101 53
        i 6.107 109.072 0.100 1 1103 80
        i 6.108 109.177 0.100 1 1093 49
        i 6.109 109.213 0.100 1 1101 58
        i 6.110 109.375 0.100 1 1093 50
        i 6.111 109.380 0.100 1 1095 62
        i 6.112 109.423 0.100 1 1095 53
        i 6.113 109.512 0.100 1 1099 59
        i 6.114 109.525 0.100 1 1100 59
        i 6.115 109.624 0.100 1 1103 66
        i 6.116 109.640 0.100 1 1099 52
        i 6.117 109.672 0.100 1 1101 78
        i 6.118 109.721 0.100 1 1097 74
        i 6.119 109.748 0.100 1 1101 65
        i 6.120 109.780 0.100 1 1105 73
        i 6.121 109.893 0.100 1 1109 53
        i 6.122 109.923 0.100 1 1097 57
        i 6.123 110.196 0.100 1 1093 52
        i 6.124 110.261 0.100 1 1103 65
        i 6.125 110.265 0.100 1 1095 55
        i 6.126 110.357 0.100 1 1099 69
        i 6.127 110.379 0.100 1 1101 59
        i 6.128 110.385 0.100 1 1099 74
        i 6.129 110.388 0.100 1 1101 77
        i 6.130 110.412 0.100 1 1093 63
        i 6.131 110.471 0.100 1 1096 68
        i 6.132 110.588 0.100 1 1101 71
        i 6.133 110.609 0.100 1 1099 64
        i 6.134 110.701 0.100 1 1099 59
        i 6.135 110.713 0.100 1 1096 62
        i 6.136 110.815 0.100 1 1109 75
        i 6.137 110.896 0.100 1 1103 72
        i 6.138 111.004 0.100 1 1098 64
        i 6.139 111.041 0.100 1 1097 80
        i 6.140 111.044 0.100 1 1107 64
        i 6.141 111.161 0.100 1 1097 52
        i 6.142 111.173 0.100 1 1089 44
        i 6.143 111.173 0.100 1 1101 71
        i 6.144 111.215 0.100 1 1097 51
        i 6.145 111.248 0.100 1 1103 60
        i 6.146 111.248 0.100 1 1093 53
        i 6.147 111.512 0.100 1 1111 49
        i 6.148 111.527 0.100 1 1101 63
        i 6.149 111.551 0.100 1 1095 75
        i 6.150 111.624 0.100 1 1094 57
        i 6.151 111.700 0.100 1 1094 72
        i 6.152 111.731 0.100 1 1107 64
        i 6.153 111.732 0.100 1 1105 61
        i 6.154 111.821 0.100 1 1099 74
        i 6.155 111.908 0.100 1 1100 82
        i 6.156 111.944 0.100 1 1107 68
        i 6.157 111.964 0.100 1 1103 79
        i 6.158 112.007 0.100 1 1104 77
        i 6.159 112.031 0.100 1 1104 75
        i 6.160 112.169 0.100 1 1091 43
        i 6.161 112.213 0.100 1 1092 72
        i 6.162 112.323 0.100 1 1109 68
        i 6.163 112.351 0.100 1 1095 65
        i 6.164 112.419 0.100 1 1092 78
        i 6.165 112.425 0.100 1 1098 81
        i 6.166 112.481 0.100 1 1105 74
        i 6.167 112.485 0.100 1 1100 54
        i 6.168 112.543 0.100 1 1104 50
        i 6.169 112.707 0.100 1 1107 53
        i 6.170 112.737 0.100 1 1102 59
        i 6.171 112.767 0.100 1 1108 60
        i 6.172 112.904 0.100 1 1105 59
        i 6.173 112.995 0.100 1 1095 48
        i 6.174 113.020 0.100 1 1105 65
        i 6.175 113.119 0.100 1 1100 62
        i 6.176 113.127 0.100 1 1101 81
        i 6.177 113.201 0.100 1 1096 54
        i 6.178 113.203 0.100 1 1102 83
        i 6.179 113.212 0.100 1 1097 65
        i 6.180 113.232 0.100 1 1092 58
        i 6.181 113.235 0.100 1 1104 74
        i 6.182 113.297 0.100 1 1102 67
        i 6.183 113.423 0.100 1 1100 61
        i 6.184 113.604 0.100 1 1108 56
        i 6.185 113.641 0.100 1 1092 61
        i 6.186 113.653 0.100 1 1100 61
        i 6.187 113.709 0.100 1 1110 71
        i 6.188 113.712 0.100 1 1100 82
        i 6.189 113.748 0.100 1 1098 69
        i 6.190 113.888 0.100 1 1094 75
        i 6.191 113.988 0.100 1 1094 58
        i 6.192 113.999 0.100 1 1102 53
        i 6.193 114.007 0.100 1 1099 63
        i 6.194 114.135 0.100 1 1102 78
        i 6.195 114.164 0.100 1 1106 76
        i 6.196 114.176 0.100 1 1098 72
        i 6.197 114.176 0.100 1 1099 66
        i 6.198 114.205 0.100 1 1100 83
        i 6.199 114.439 0.100 1 1098 82
        i 6.200 114.523 0.100 1 1112 50
        i 6.201 114.529 0.100 1 1110 73
        i 6.202 114.565 0.100 1 1100 49
        i 6.203 114.705 0.100 1 1094 69
        i 6.204 114.744 0.100 1 1102 75
        i 6.205 114.779 0.100 1 1100 74
        i 6.206 114.824 0.100 1 1094 55
        i 6.207 114.867 0.100 1 1098 54
        i 6.208 114.891 0.100 1 1100 52
        i 6.209 114.945 0.100 1 1092 81
        i 6.210 114.967 0.100 1 1102 54
        i 6.211 114.975 0.100 1 1097 63
        i 6.212 115.015 0.100 1 1096 79
        i 6.213 115.116 0.100 1 1098 66
        i 6.214 115.197 0.100 1 1108 76
        i 6.215 115.211 0.100 1 1096 53
        i 6.216 115.335 0.100 1 1112 70
        i 6.217 115.413 0.100 1 1102 52
        i 6.218 115.529 0.100 1 1099 52
        i 6.219 115.536 0.100 1 1110 58
        i 6.220 115.581 0.100 1 1104 74
        i 6.221 115.647 0.100 1 1100 52
        i 6.222 115.676 0.100 1 1104 72
        i 6.223 115.677 0.100 1 1096 74
        i 6.224 115.727 0.100 1 1102 64
        i 6.225 115.740 0.100 1 1102 79
        i 6.226 115.785 0.100 1 1090 73
        i 6.227 115.785 0.100 1 1098 77
        i 6.228 115.799 0.100 1 1092 49
        i 6.229 116.048 0.100 1 1104 69
        i 6.230 116.115 0.100 1 1094 73
        i 6.231 116.171 0.100 1 1093 62
        i 6.232 116.208 0.100 1 1093 53
        i 6.233 116.277 0.100 1 1106 59
        i 6.234 116.281 0.100 1 1104 54
        i 6.235 116.332 0.100 1 1100 65
        i 6.236 116.365 0.100 1 1106 68
        i 6.237 116.407 0.100 1 1108 69
        i 6.238 116.416 0.100 1 1100 55
        i 6.239 116.427 0.100 1 1106 54
        i 6.240 116.492 0.100 1 1104 71
        i 6.241 116.575 0.100 1 1106 75
        i 6.242 116.709 0.100 1 1091 82
        i 6.243 116.713 0.100 1 1092 48
        i 6.244 116.785 0.100 1 1106 63
        i 6.245 116.795 0.100 1 1096 54
        i 6.246 116.904 0.100 1 1099 81
        i 6.247 116.913 0.100 1 1096 65
        i 6.248 116.944 0.100 1 1091 79
        i 6.249 117.117 0.100 1 1108 55
        i 6.250 117.117 0.100 1 1104 67
        i 6.251 117.125 0.100 1 1100 69
        i 6.252 117.167 0.100 1 1104 68
        i 6.253 117.233 0.100 1 1104 74
        i 6.254 117.391 0.100 1 1106 74
        i 6.255 117.452 0.100 1 1102 55
        i 6.256 117.461 0.100 1 1094 45
        i 6.257 117.524 0.100 1 1106 65
        i 6.258 117.548 0.100 1 1098 79
        i 6.259 117.620 0.100 1 1102 69
        i 6.260 117.631 0.100 1 1101 74
        i 6.261 117.652 0.100 1 1101 66
        i 6.262 117.696 0.100 1 1104 80
        i 6.263 117.709 0.100 1 1101 58
        i 6.264 117.811 0.100 1 1098 56
        i 6.265 117.827 0.100 1 1093 52
        i 6.266 117.871 0.100 1 1100 69
        i 6.267 118.029 0.100 1 1092 53
        i 6.268 118.071 0.100 1 1109 63
        i 6.269 118.151 0.100 1 1097 75
        i 6.270 118.213 0.100 1 1099 75
        i 6.271 118.239 0.100 1 1104 69
        i 6.272 118.284 0.100 1 1099 66
        i 6.273 118.295 0.100 1 1108 56
        i 6.274 118.437 0.100 1 1095 76
        i 6.275 118.451 0.100 1 1103 71
        i 6.276 118.533 0.100 1 1099 56
        i 6.277 118.547 0.100 1 1107 69
        i 6.278 118.576 0.100 1 1093 61
        i 6.279 118.588 0.100 1 1100 59
        i 6.280 118.592 0.100 1 1100 73
        i 6.281 118.643 0.100 1 1098 48
        i 6.282 118.727 0.100 1 1111 71
        i 6.283 118.815 0.100 1 1095 81
        i 6.284 118.907 0.100 1 1109 77
        i 6.285 119.049 0.100 1 1113 50
        i 6.286 119.085 0.100 1 1101 72
        i 6.287 119.209 0.100 1 1095 84
        i 6.288 119.277 0.100 1 1097 61
        i 6.289 119.344 0.100 1 1102 74
        i 6.290 119.388 0.100 1 1105 54
        i 6.291 119.419 0.100 1 1093 74
        i 6.292 119.429 0.100 1 1097 48
        i 6.293 119.436 0.100 1 1099 73
        i 6.294 119.475 0.100 1 1103 56
        i 6.295 119.479 0.100 1 1093 82
        i 6.296 119.495 0.100 1 1107 51
        i 6.297 119.523 0.100 1 1098 70
        i 6.298 119.585 0.100 1 1101 78
        i 6.299 119.717 0.100 1 1097 72
        i 6.300 119.763 0.100 1 1101 54
        i 6.301 119.885 0.100 1 1111 77
        i 6.302 120.059 0.100 1 1099 49
        i 6.303 120.081 0.100 1 1103 55
        i 6.304 120.099 0.100 1 1100 58
        i 6.305 120.145 0.100 1 1103 56
        i 6.306 120.168 0.100 1 1099 70
        i 6.307 120.205 0.100 1 1101 59
        i 6.308 120.211 0.100 1 1105 59
        i 6.309 120.291 0.100 1 1103 67
        i 6.310 120.327 0.100 1 1109 64
        i 6.311 120.348 0.100 1 1091 76
        i 6.312 120.393 0.100 1 1095 56
        i 6.313 120.408 0.100 1 1091 51
        i 6.314 120.527 0.100 1 1105 66
        i 6.315 120.625 0.100 1 1097 57
        i 6.316 120.709 0.100 1 1093 65
        i 6.317 120.756 0.100 1 1099 79
        i 6.318 120.761 0.100 1 1092 53
        i 6.319 120.800 0.100 1 1095 82
        i 6.320 120.877 0.100 1 1107 62
        i 6.321 120.877 0.100 1 1107 55
        i 6.322 120.908 0.100 1 1105 66
        i 6.323 120.988 0.100 1 1105 74
        i 6.324 121.011 0.100 1 1101 58
        i 6.325 121.144 0.100 1 1107 78
        i 6.326 121.159 0.100 1 1105 68
        i 6.327 121.221 0.100 1 1091 83
        i 6.328 121.257 0.100 1 1093 57
        i 6.329 121.287 0.100 1 1105 54
        i 6.330 121.348 0.100 1 1099 63
        i 6.331 121.359 0.100 1 1097 70
        i 6.332 121.383 0.100 1 1099 67
        i 6.333 121.445 0.100 1 1103 49
        i 6.334 121.513 0.100 1 1092 67
        i 6.335 121.529 0.100 1 1107 51
        i 6.336 121.541 0.100 1 1107 67
        i 6.337 121.640 0.100 1 1103 57
        i 6.338 121.764 0.100 1 1099 50
        i 6.339 121.789 0.100 1 1103 67
        i 6.340 121.863 0.100 1 1097 75
        i 6.341 121.927 0.100 1 1093 61
        i 6.342 122.053 0.100 1 1105 69
        i 6.343 122.064 0.100 1 1101 73
        i 6.344 122.073 0.100 1 1101 78
        i 6.345 122.112 0.100 1 1109 50
        i 6.346 122.179 0.100 1 1100 65
        i 6.347 122.185 0.100 1 1101 60
        i 6.348 122.209 0.100 1 1100 73
        i 6.349 122.319 0.100 1 1109 53
        i 6.350 122.409 0.100 1 1099 70
        i 6.351 122.421 0.100 1 1093 75
        i 6.352 122.432 0.100 1 1101 70
        i 6.353 122.439 0.100 1 1091 50
        i 6.354 122.540 0.100 1 1105 58
        i 6.355 122.615 0.100 1 1094 78
        i 6.356 122.651 0.100 1 1099 74
        i 6.357 122.724 0.100 1 1098 61
        i 6.358 122.744 0.100 1 1111 49
        i 6.359 122.915 0.100 1 1099 75
        i 6.360 122.987 0.100 1 1103 67
        i 6.361 122.988 0.100 1 1095 75
        i 6.362 122.999 0.100 1 1101 58
        i 6.363 123.103 0.100 1 1098 73
        i 6.364 123.129 0.100 1 1099 54
        i 6.365 123.131 0.100 1 1104 76
        i 6.366 123.164 0.100 1 1092 82
        i 6.367 123.167 0.100 1 1103 74
        i 6.368 123.171 0.100 1 1107 59
        i 6.369 123.209 0.100 1 1101 72
        i 6.370 123.283 0.100 1 1108 71
        i 6.371 123.315 0.100 1 1102 54
        i 6.372 123.531 0.100 1 1113 78
        i 6.373 123.681 0.100 1 1098 56
        i 6.374 123.708 0.100 1 1096 53
        i 6.375 123.912 0.100 1 1102 75
        i 6.376 123.912 0.100 1 1103 55
        i 6.377 123.941 0.100 1 1101 55
        i 6.378 123.963 0.100 1 1092 69
        i 6.379 123.992 0.100 1 1097 62
        i 6.380 124.000 0.100 1 1099 73
        i 6.381 124.012 0.100 1 1094 65
        i 6.382 124.043 0.100 1 1104 59
        i 6.383 124.049 0.100 1 1110 74
        i 6.384 124.093 0.100 1 1098 56
        i 6.385 124.124 0.100 1 1106 50
        i 6.386 124.207 0.100 1 1101 49
        i 6.387 124.227 0.100 1 1098 56
        i 6.388 124.457 0.100 1 1098 59
        i 6.389 124.468 0.100 1 1099 70
        i 6.390 124.569 0.100 1 1104 76
        i 6.391 124.572 0.100 1 1100 50
        i 6.392 124.684 0.100 1 1100 75
        i 6.393 124.691 0.100 1 1101 64
        i 6.394 124.769 0.100 1 1106 76
        i 6.395 124.847 0.100 1 1090 76
        i 6.396 124.875 0.100 1 1096 77
        i 6.397 124.951 0.100 1 1092 44
        i 6.398 125.044 0.100 1 1106 56
        i 6.399 125.075 0.100 1 1104 75
        i 6.400 125.091 0.100 1 1108 71
        i 6.401 125.189 0.100 1 1098 73
        i 6.402 125.207 0.100 1 1092 80
        i 6.403 125.268 0.100 1 1100 65
        i 6.404 125.343 0.100 1 1104 60
        i 6.405 125.375 0.100 1 1091 74
        i 6.406 125.393 0.100 1 1102 55
        i 6.407 125.436 0.100 1 1104 48
        i 6.408 125.464 0.100 1 1107 75
        i 6.409 125.480 0.100 1 1096 56
        i 6.410 125.555 0.100 1 1100 54
        i 6.411 125.721 0.100 1 1094 52
        i 6.412 125.729 0.100 1 1090 60
        i 6.413 125.816 0.100 1 1106 54
        i 6.414 125.843 0.100 1 1096 62
        i 6.415 125.861 0.100 1 1106 77
        i 6.416 125.871 0.100 1 1100 81
        i 6.417 125.940 0.100 1 1102 73
        i 6.418 126.001 0.100 1 1106 59
        i 6.419 126.015 0.100 1 1110 52
        i 6.420 126.015 0.100 1 1108 73
        i 6.421 126.044 0.100 1 1098 80
        i 6.422 126.105 0.100 1 1093 70
        i 6.423 126.193 0.100 1 1102 78
        i 6.424 126.313 0.100 1 1092 47
        i 6.425 126.349 0.100 1 1100 61
        i 6.426 126.353 0.100 1 1098 76
        i 6.427 126.515 0.100 1 1112 51
        i 6.428 126.519 0.100 1 1108 61
        i 6.429 126.571 0.100 1 1104 63
        i 6.430 126.628 0.100 1 1100 78
        i 6.431 126.683 0.100 1 1094 63
        i 6.432 126.705 0.100 1 1100 78
        i 6.433 126.728 0.100 1 1102 67
        i 6.434 126.748 0.100 1 1099 78
        i 6.435 126.885 0.100 1 1102 61
        i 6.436 126.903 0.100 1 1090 47
        i 6.437 126.935 0.100 1 1100 62
        i 6.438 126.935 0.100 1 1110 48
        i 6.439 126.965 0.100 1 1094 78
        i 6.440 127.027 0.100 1 1098 65
        i 6.441 127.061 0.100 1 1114 48
        i 6.442 127.063 0.100 1 1110 49
        i 6.443 127.151 0.100 1 1102 68
        i 6.444 127.165 0.100 1 1106 71
        i 6.445 127.232 0.100 1 1097 67
        i 6.446 127.287 0.100 1 1104 62
        i 6.447 127.359 0.100 1 1098 68
        i 6.448 127.487 0.100 1 1096 69
        i 6.449 127.533 0.100 1 1102 63
        i 6.450 127.633 0.100 1 1100 76
        i 6.451 127.652 0.100 1 1102 52
        i 6.452 127.672 0.100 1 1100 53
        i 6.453 127.693 0.100 1 1097 57
        i 6.454 127.696 0.100 1 1092 78
        i 6.455 127.757 0.100 1 1108 59
        i 6.456 127.773 0.100 1 1104 75
        i 6.457 127.913 0.100 1 1108 64
        i 6.458 128.044 0.100 1 1104 64
        i 6.459 128.048 0.100 1 1112 69
        i 6.460 128.156 0.100 1 1101 56
        i 6.461 128.204 0.100 1 1097 66
        i 6.462 128.235 0.100 1 1104 62
        i 6.463 128.316 0.100 1 1102 72
        i 6.464 128.404 0.100 1 1100 49
        i 6.465 128.417 0.100 1 1092 68
        i 6.466 128.444 0.100 1 1096 74
        i 6.467 128.469 0.100 1 1098 61
        i 6.468 128.489 0.100 1 1095 66
        i 6.469 128.621 0.100 1 1098 58
        i 6.470 128.628 0.100 1 1106 51
        i 6.471 128.639 0.100 1 1105 53
        i 6.472 128.663 0.100 1 1099 60
        i 6.473 128.735 0.100 1 1099 78
        i 6.474 128.789 0.100 1 1099 73
        i 6.475 128.819 0.100 1 1106 66
        i 6.476 128.921 0.100 1 1110 73
        i 6.477 129.065 0.100 1 1098 63
        i 6.478 129.107 0.100 1 1099 80
        i 6.479 129.112 0.100 1 1108 57
        i 6.480 129.139 0.100 1 1100 73
        i 6.481 129.172 0.100 1 1096 64
        i 6.482 129.213 0.100 1 1106 53
        i 6.483 129.257 0.100 1 1089 56
        i 6.484 129.281 0.100 1 1101 60
        i 6.485 129.452 0.100 1 1103 54
        i 6.486 129.481 0.100 1 1108 55
        i 6.487 129.495 0.100 1 1092 55
        i 6.488 129.516 0.100 1 1105 63
        i 6.489 129.575 0.100 1 1106 80
        i 6.490 129.667 0.100 1 1097 62
        i 6.491 129.688 0.100 1 1101 68
        i 6.492 129.688 0.100 1 1103 73
        i 6.493 129.703 0.100 1 1091 71
        i 6.494 129.873 0.100 1 1108 75
        i 6.495 129.888 0.100 1 1103 64
        i 6.496 129.987 0.100 1 1091 81
        i 6.497 130.009 0.100 1 1099 79
        i 6.498 130.021 0.100 1 1105 65
        i 6.499 130.029 0.100 1 1107 77
        i 6.500 130.045 0.100 1 1096 81
        i 6.501 130.188 0.100 1 1094 55
        i 6.502 130.193 0.100 1 1105 68
        i 6.503 130.237 0.100 1 1091 63
        i 6.504 130.252 0.100 1 1109 70
        i 6.505 130.343 0.100 1 1101 58
        i 6.506 130.351 0.100 1 1095 80
        i 6.507 130.403 0.100 1 1101 72
        i 6.508 130.545 0.100 1 1101 61
        i 6.509 130.597 0.100 1 1106 72
        i 6.510 130.617 0.100 1 1101 73
        i 6.511 130.696 0.100 1 1094 55
        i 6.512 130.701 0.100 1 1091 52
        i 6.513 130.731 0.100 1 1099 56
        i 6.514 130.752 0.100 1 1099 70
        i 6.515 130.853 0.100 1 1097 71
        i 6.516 130.917 0.100 1 1113 65
        i 6.517 131.000 0.100 1 1109 78
        i 6.518 131.052 0.100 1 1103 71
        i 6.519 131.201 0.100 1 1099 57
        i 6.520 131.252 0.100 1 1111 70
        i 6.521 131.269 0.100 1 1099 53
        i 6.522 131.279 0.100 1 1093 61
        i 6.523 131.315 0.100 1 1103 82
        i 6.524 131.317 0.100 1 1098 79
        i 6.525 131.343 0.100 1 1101 52
        i 6.526 131.369 0.100 1 1089 45
        i 6.527 131.420 0.100 1 1095 78
        i 6.528 131.427 0.100 1 1107 55
        i 6.529 131.447 0.100 1 1103 77
        i 6.530 131.683 0.100 1 1099 56
        i 6.531 131.740 0.100 1 1097 62
        i 6.532 131.759 0.100 1 1113 54
        i 6.533 131.827 0.100 1 1101 78
        i 6.534 131.865 0.100 1 1111 79
        i 6.535 131.879 0.100 1 1097 68
        i 6.536 131.945 0.100 1 1097 58
        i 6.537 131.971 0.100 1 1103 71
        i 6.538 132.047 0.100 1 1109 53
        i 6.539 132.129 0.100 1 1103 79
        i 6.540 132.217 0.100 1 1099 74
        i 6.541 132.228 0.100 1 1093 75
        i 6.542 132.239 0.100 1 1109 53
        i 6.543 132.284 0.100 1 1096 53
        i 6.544 132.355 0.100 1 1105 76
        i 6.545 132.405 0.100 1 1105 57
        i 6.546 132.544 0.100 1 1107 71
        i 6.547 132.577 0.100 1 1111 57
        i 6.548 132.617 0.100 1 1101 55
        i 6.549 132.635 0.100 1 1105 58
        i 6.550 132.700 0.100 1 1097 58
        i 6.551 132.812 0.100 1 1099 58
        i 6.552 132.831 0.100 1 1091 66
        i 6.553 132.921 0.100 1 1095 65
        i 6.554 132.928 0.100 1 1101 68
        i 6.555 132.965 0.100 1 1095 61
        i 6.556 133.044 0.100 1 1103 54
        i 6.557 133.171 0.100 1 1099 57
        i 6.558 133.192 0.100 1 1097 73
        i 6.559 133.196 0.100 1 1105 63
        i 6.560 133.232 0.100 1 1100 60
        i 6.561 133.243 0.100 1 1100 53
        i 6.562 133.256 0.100 1 1103 74
        i 6.563 133.325 0.100 1 1107 64
        i 6.564 133.352 0.100 1 1109 57
        i 6.565 133.495 0.100 1 1097 78
        i 6.566 133.528 0.100 1 1099 82
        i 6.567 133.537 0.100 1 1105 84
        i 6.568 133.625 0.100 1 1089 59
        i 6.569 133.649 0.100 1 1100 73
        i 6.570 133.661 0.100 1 1097 74
        i 6.571 133.723 0.100 1 1101 70
        i 6.572 133.743 0.100 1 1105 66
        i 6.573 133.755 0.100 1 1105 55
        i 6.574 133.781 0.100 1 1107 70
        i 6.575 133.860 0.100 1 1107 72
        i 6.576 133.872 0.100 1 1102 69
        i 6.577 133.987 0.100 1 1093 65
        i 6.578 134.053 0.100 1 1107 54
        i 6.579 134.143 0.100 1 1096 66
        i 6.580 134.200 0.100 1 1090 79
        i 6.581 134.283 0.100 1 1107 77
        i 6.582 134.364 0.100 1 1103 50
        i 6.583 134.371 0.100 1 1105 77
        i 6.584 134.395 0.100 1 1103 69
        i 6.585 134.423 0.100 1 1099 48
        i 6.586 134.491 0.100 1 1097 55
        i 6.587 134.521 0.100 1 1108 66
        i 6.588 134.599 0.100 1 1092 63
        i 6.589 134.601 0.100 1 1095 56
        i 6.590 134.636 0.100 1 1102 59
        i 6.591 134.644 0.100 1 1103 59
        i 6.592 134.731 0.100 1 1109 65
        i 6.593 134.747 0.100 1 1092 53
        i 6.594 134.763 0.100 1 1105 63
        i 6.595 134.933 0.100 1 1102 58
        i 6.596 135.073 0.100 1 1109 79
        i 6.597 135.104 0.100 1 1100 60
        i 6.598 135.168 0.100 1 1091 65
        i 6.599 135.176 0.100 1 1101 61
        i 6.600 135.195 0.100 1 1105 53
        i 6.601 135.247 0.100 1 1100 64
        i 6.602 135.285 0.100 1 1094 58
        i 6.603 135.297 0.100 1 1099 70
        i 6.604 135.311 0.100 1 1096 59
        i 6.605 135.387 0.100 1 1094 83
        i 6.606 135.427 0.100 1 1114 75
        i 6.607 135.497 0.100 1 1098 79
        i 6.608 135.579 0.100 1 1103 53
        i 6.609 135.692 0.100 1 1108 50
        i 6.610 135.700 0.100 1 1098 66
        i 6.611 135.753 0.100 1 1101 67
        i 6.612 135.833 0.100 1 1096 65
        i 6.613 135.885 0.100 1 1097 71
        i 6.614 135.889 0.100 1 1112 55
        i 6.615 135.900 0.100 1 1104 73
        i 6.616 135.913 0.100 1 1088 47
        i 6.617 135.923 0.100 1 1104 58
        i 6.618 135.957 0.100 1 1098 68
        i 6.619 136.052 0.100 1 1110 78
        i 6.620 136.200 0.100 1 1112 49
        i 6.621 136.251 0.100 1 1096 80
        i 6.622 136.313 0.100 1 1100 66
        i 6.623 136.373 0.100 1 1094 74
        i 6.624 136.404 0.100 1 1098 76
        i 6.625 136.452 0.100 1 1102 71
        i 6.626 136.471 0.100 1 1096 64
        i 6.627 136.560 0.100 1 1108 50
        i 6.628 136.660 0.100 1 1108 59
        i 6.629 136.727 0.100 1 1106 72
        i 6.630 136.728 0.100 1 1103 80
        i 6.631 136.759 0.100 1 1094 69
        i 6.632 136.819 0.100 1 1102 77
        i 6.633 136.839 0.100 1 1098 56
        i 6.634 136.873 0.100 1 1095 76
        i 6.635 136.920 0.100 1 1106 77
        i 6.636 136.992 0.100 1 1106 79
        i 6.637 137.056 0.100 1 1110 78
        i 6.638 137.105 0.100 1 1106 62
        i 6.639 137.153 0.100 1 1102 69
        i 6.640 137.200 0.100 1 1098 63
        i 6.641 137.233 0.100 1 1098 53
        i 6.642 137.244 0.100 1 1090 67
        i 6.643 137.269 0.100 1 1104 77
        i 6.644 137.365 0.100 1 1096 53
        i 6.645 137.441 0.100 1 1096 61
        i 6.646 137.508 0.100 1 1100 63
        i 6.647 137.523 0.100 1 1104 72
        i 6.648 137.636 0.100 1 1108 78
        i 6.649 137.636 0.100 1 1108 57
        i 6.650 137.735 0.100 1 1096 69
        i 6.651 137.755 0.100 1 1100 62
        i 6.652 137.777 0.100 1 1104 75
        i 6.653 137.800 0.100 1 1101 69
        i 6.654 137.859 0.100 1 1106 64
        i 6.655 137.887 0.100 1 1104 70
        i 6.656 137.932 0.100 1 1112 52
        i 6.657 137.947 0.100 1 1098 54
        i 6.658 137.949 0.100 1 1098 57
        i 6.659 137.993 0.100 1 1090 69
        i 6.660 138.111 0.100 1 1100 60
        i 6.661 138.197 0.100 1 1096 61
        i 6.662 138.281 0.100 1 1102 73
        i 6.663 138.335 0.100 1 1106 50
        i 6.664 138.451 0.100 1 1094 54
        i 6.665 138.461 0.100 1 1103 54
        i 6.666 138.472 0.100 1 1102 56
        i 6.667 138.557 0.100 1 1106 49
        i 6.668 138.581 0.100 1 1108 62
        i 6.669 138.619 0.100 1 1096 77
        i 6.670 138.623 0.100 1 1106 61
        i 6.671 138.700 0.100 1 1091 55
        i 6.672 138.765 0.100 1 1106 66
        i 6.673 138.815 0.100 1 1098 71
        i 6.674 138.836 0.100 1 1098 71
        i 6.675 138.836 0.100 1 1114 59
        i 6.676 138.920 0.100 1 1100 69
        i 6.677 138.924 0.100 1 1102 69
        i 6.678 138.988 0.100 1 1096 52
        i 6.679 139.072 0.100 1 1104 62
        i 6.680 139.157 0.100 1 1100 53
        i 6.681 139.175 0.100 1 1102 77
        i 6.682 139.211 0.100 1 1093 78
        i 6.683 139.259 0.100 1 1093 58
        i 6.684 139.315 0.100 1 1108 64
        i 6.685 139.355 0.100 1 1104 49
        i 6.686 139.464 0.100 1 1103 61
        i 6.687 139.552 0.100 1 1110 59
        i 6.688 139.587 0.100 1 1104 59
        i 6.689 139.632 0.100 1 1090 50
        i 6.690 139.668 0.100 1 1104 67
        i 6.691 139.676 0.100 1 1110 53
        i 6.692 139.688 0.100 1 1100 51
        i 6.693 139.743 0.100 1 1100 70
        i 6.694 139.769 0.100 1 1096 67
        i 6.695 139.848 0.100 1 1102 64
        i 6.696 139.876 0.100 1 1095 55
        i 6.697 139.891 0.100 1 1100 52
        i 6.698 139.973 0.100 1 1110 63
        i 6.699 140.023 0.100 1 1114 49
        i 6.700 140.059 0.100 1 1102 71
        i 6.701 140.085 0.100 1 1098 66
        i 6.702 140.200 0.100 1 1097 65
        i 6.703 140.293 0.100 1 1096 65
        i 6.704 140.299 0.100 1 1102 72
        i 6.705 140.321 0.100 1 1108 64
        i 6.706 140.444 0.100 1 1103 77
        i 6.707 140.455 0.100 1 1097 59
        i 6.708 140.456 0.100 1 1088 61
        i 6.709 140.457 0.100 1 1107 65
        i 6.710 140.479 0.100 1 1112 52
        i 6.711 140.483 0.100 1 1104 79
        i 6.712 140.491 0.100 1 1106 71
        i 6.713 140.524 0.100 1 1098 68
        i 6.714 140.577 0.100 1 1102 60
        i 6.715 140.637 0.100 1 1112 77
        i 6.716 140.648 0.100 1 1101 55
        i 6.717 140.687 0.100 1 1093 60
        i 6.718 140.763 0.100 1 1095 67
        i 6.719 140.908 0.100 1 1099 68
        i 6.720 141.036 0.100 1 1105 78
        i 6.721 141.069 0.100 1 1107 70
        i 6.722 141.088 0.100 1 1103 57
        i 6.723 141.133 0.100 1 1107 79
        i 6.724 141.139 0.100 1 1104 79
        i 6.725 141.159 0.100 1 1096 78
        i 6.726 141.248 0.100 1 1095 64
        i 6.727 141.296 0.100 1 1105 72
        i 6.728 141.435 0.100 1 1109 76
        i 6.729 141.447 0.100 1 1095 82
        i 6.730 141.453 0.100 1 1098 67
        i 6.731 141.459 0.100 1 1107 53
        i 6.732 141.535 0.100 1 1109 79
        i 6.733 141.585 0.100 1 1095 73
        i 6.734 141.672 0.100 1 1105 62
        i 6.735 141.697 0.100 1 1101 67
        i 6.736 141.700 0.100 1 1099 53
        i 6.737 141.704 0.100 1 1089 76
        i 6.738 141.811 0.100 1 1105 67
        i 6.739 141.832 0.100 1 1098 79
        i 6.740 141.876 0.100 1 1097 83
        i 6.741 141.912 0.100 1 1107 53
        i 6.742 141.927 0.100 1 1097 60
        i 6.743 142.145 0.100 1 1107 66
        i 6.744 142.153 0.100 1 1103 65
        i 6.745 142.203 0.100 1 1109 52
        i 6.746 142.267 0.100 1 1101 60
        i 6.747 142.272 0.100 1 1095 66
        i 6.748 142.332 0.100 1 1103 81
        i 6.749 142.352 0.100 1 1102 73
        i 6.750 142.409 0.100 1 1091 75
        i 6.751 142.424 0.100 1 1097 83
        i 6.752 142.453 0.100 1 1101 56
        i 6.753 142.468 0.100 1 1107 63
        i 6.754 142.587 0.100 1 1101 79
        i 6.755 142.609 0.100 1 1097 78
        i 6.756 142.647 0.100 1 1105 53
        i 6.757 142.663 0.100 1 1099 61
        i 6.758 142.691 0.100 1 1103 55
        i 6.759 142.896 0.100 1 1105 70
        i 6.760 142.911 0.100 1 1095 72
        i 6.761 143.009 0.100 1 1113 80
        i 6.762 143.035 0.100 1 1102 79
        i 6.763 143.060 0.100 1 1109 61
        i 6.764 143.088 0.100 1 1107 48
        i 6.765 143.139 0.100 1 1099 67
        i 6.766 143.148 0.100 1 1095 59
        i 6.767 143.200 0.100 1 1091 80
        i 6.768 143.297 0.100 1 1097 68
        i 6.769 143.323 0.100 1 1099 79
        i 6.770 143.365 0.100 1 1105 63
        i 6.771 143.453 0.100 1 1097 74
        i 6.772 143.485 0.100 1 1101 58
        i 6.773 143.527 0.100 1 1115 62
        i 6.774 143.559 0.100 1 1099 74
        i 6.775 143.579 0.100 1 1101 67
        i 6.776 143.596 0.100 1 1103 50
        i 6.777 143.677 0.100 1 1111 55
        i 6.778 143.769 0.100 1 1103 70
        i 6.779 143.771 0.100 1 1093 77
        i 6.780 143.805 0.100 1 1094 58
        i 6.781 143.815 0.100 1 1109 55
        i 6.782 144.048 0.100 1 1103 75
        i 6.783 144.080 0.100 1 1103 53
        i 6.784 144.092 0.100 1 1101 71
        i 6.785 144.176 0.100 1 1089 66
        i 6.786 144.197 0.100 1 1105 53
        i 6.787 144.220 0.100 1 1101 74
        i 6.788 144.276 0.100 1 1095 64
        i 6.789 144.313 0.100 1 1099 60
        i 6.790 144.329 0.100 1 1109 74
        i 6.791 144.332 0.100 1 1099 77
        i 6.792 144.333 0.100 1 1113 50
        i 6.793 144.365 0.100 1 1099 50
        i 6.794 144.449 0.100 1 1096 57
        i 6.795 144.535 0.100 1 1111 63
        i 6.796 144.537 0.100 1 1101 64
        i 6.797 144.700 0.100 1 1096 52
        i 6.798 144.845 0.100 1 1097 75
        i 6.799 144.875 0.100 1 1107 50
        i 6.800 144.899 0.100 1 1103 70
        i 6.801 144.928 0.100 1 1105 57
        i 6.802 144.973 0.100 1 1103 68
        i 6.803 144.995 0.100 1 1097 68
        i 6.804 145.007 0.100 1 1096 84
        i 6.805 145.025 0.100 1 1101 50
        i 6.806 145.060 0.100 1 1103 77
        i 6.807 145.079 0.100 1 1089 66
        i 6.808 145.168 0.100 1 1109 80
        i 6.809 145.263 0.100 1 1107 59
        i 6.810 145.273 0.100 1 1094 65
        i 6.811 145.333 0.100 1 1111 59
        i 6.812 145.360 0.100 1 1111 55
        i 6.813 145.373 0.100 1 1103 60
        i 6.814 145.399 0.100 1 1109 75
        i 6.815 145.433 0.100 1 1107 76
        i 6.816 145.505 0.100 1 1099 77
        i 6.817 145.551 0.100 1 1105 59
        i 6.818 145.695 0.100 1 1107 50
        i 6.819 145.723 0.100 1 1096 65
        i 6.820 145.751 0.100 1 1095 74
        i 6.821 145.900 0.100 1 1107 73
        i 6.822 145.928 0.100 1 1104 50
        i 6.823 145.977 0.100 1 1094 63
        i 6.824 145.987 0.100 1 1093 71
        i 6.825 145.999 0.100 1 1097 54
        i 6.826 146.064 0.100 1 1109 73
        i 6.827 146.072 0.100 1 1103 73
        i 6.828 146.128 0.100 1 1106 52
        i 6.829 146.199 0.100 1 1100 70
        i 6.830 146.256 0.100 1 1090 70
        i 6.831 146.269 0.100 1 1106 59
        i 6.832 146.289 0.100 1 1101 64
        i 6.833 146.296 0.100 1 1098 81
        i 6.834 146.360 0.100 1 1105 53
        i 6.835 146.381 0.100 1 1097 80
        i 6.836 146.431 0.100 1 1097 52
        i 6.837 146.671 0.100 1 1105 78
        i 6.838 146.739 0.100 1 1095 56
        i 6.839 146.771 0.100 1 1110 78
        i 6.840 146.776 0.100 1 1102 71
        i 6.841 146.779 0.100 1 1107 73
        i 6.842 146.797 0.100 1 1096 66
        i 6.843 146.819 0.100 1 1102 50
        i 6.844 146.861 0.100 1 1102 62
        i 6.845 146.899 0.100 1 1096 83
        i 6.846 146.899 0.100 1 1102 59
        i 6.847 146.916 0.100 1 1092 67
        i 6.848 146.965 0.100 1 1108 72
        i 6.849 146.987 0.100 1 1114 73
        i 6.850 147.020 0.100 1 1097 58
        i 6.851 147.076 0.100 1 1104 54
        i 6.852 147.185 0.100 1 1104 72
        i 6.853 147.272 0.100 1 1100 73
        i 6.854 147.299 0.100 1 1096 45
        i 6.855 147.465 0.100 1 1104 66
        i 6.856 147.500 0.100 1 1108 57
        i 6.857 147.541 0.100 1 1110 76
        i 6.858 147.567 0.100 1 1101 52
        i 6.859 147.584 0.100 1 1100 81
        i 6.860 147.677 0.100 1 1094 74
        i 6.861 147.697 0.100 1 1092 80
        i 6.862 147.743 0.100 1 1100 77
        i 6.863 147.753 0.100 1 1100 72
        i 6.864 147.813 0.100 1 1102 54
        i 6.865 147.848 0.100 1 1096 63
        i 6.866 147.920 0.100 1 1098 63
        i 6.867 147.924 0.100 1 1114 55
        i 6.868 147.927 0.100 1 1100 71
        i 6.869 147.940 0.100 1 1100 55
        i 6.870 147.963 0.100 1 1105 64
        i 6.871 148.029 0.100 1 1110 59
        i 6.872 148.207 0.100 1 1102 61
        i 6.873 148.279 0.100 1 1094 82
        i 6.874 148.279 0.100 1 1112 61
        i 6.875 148.359 0.100 1 1095 71
        i 6.876 148.416 0.100 1 1102 61
        i 6.877 148.489 0.100 1 1102 51
        i 6.878 148.535 0.100 1 1098 81
        i 6.879 148.555 0.100 1 1112 53
        i 6.880 148.632 0.100 1 1104 65
        i 6.881 148.667 0.100 1 1098 76
        i 6.882 148.668 0.100 1 1100 50
        i 6.883 148.697 0.100 1 1098 77
        i 6.884 148.720 0.100 1 1088 53
        i 6.885 148.767 0.100 1 1100 64
        i 6.886 148.827 0.100 1 1094 52
        i 6.887 148.835 0.100 1 1106 70
        i 6.888 148.981 0.100 1 1097 81
        i 6.889 149.031 0.100 1 1112 53
        i 6.890 149.067 0.100 1 1102 68
        i 6.891 149.196 0.100 1 1096 62
        i 6.892 149.384 0.100 1 1106 75
        i 6.893 149.395 0.100 1 1096 53
        i 6.894 149.409 0.100 1 1110 50
        i 6.895 149.440 0.100 1 1098 65
        i 6.896 149.485 0.100 1 1104 65
        i 6.897 149.503 0.100 1 1102 58
        i 6.898 149.517 0.100 1 1095 64
        i 6.899 149.520 0.100 1 1102 74
        i 6.900 149.579 0.100 1 1108 73
        i 6.901 149.612 0.100 1 1108 62
        i 6.902 149.624 0.100 1 1108 51
        i 6.903 149.628 0.100 1 1112 53
        i 6.904 149.644 0.100 1 1110 78
        i 6.905 149.700 0.100 1 1090 46
        i 6.906 149.713 0.100 1 1102 51
        i 6.907 149.781 0.100 1 1093 58
        i 6.908 149.879 0.100 1 1104 60
        i 6.909 150.023 0.100 1 1106 72
        i 6.910 150.044 0.100 1 1106 60
        i 6.911 150.145 0.100 1 1100 56
        i 6.912 150.197 0.100 1 1096 82
        i 6.913 150.259 0.100 1 1106 67
        i 6.914 150.271 0.100 1 1094 53
        i 6.915 150.272 0.100 1 1104 66
        i 6.916 150.319 0.100 1 1106 61
        i 6.917 150.368 0.100 1 1114 69
        i 6.918 150.377 0.100 1 1104 78
        i 6.919 150.467 0.100 1 1093 79
        i 6.920 150.476 0.100 1 1108 66
        i 6.921 150.541 0.100 1 1096 63
        i 6.922 150.544 0.100 1 1108 78
        i 6.923 150.559 0.100 1 1104 72
        i 6.924 150.597 0.100 1 1108 63
        i 6.925 150.695 0.100 1 1101 66
        i 6.926 150.716 0.100 1 1099 81
        i 6.927 150.851 0.100 1 1090 64
        i 6.928 150.943 0.100 1 1098 78
        i 6.929 150.956 0.100 1 1096 54
        i 6.930 151.001 0.100 1 1104 65
        i 6.931 151.027 0.100 1 1106 57
        i 6.932 151.107 0.100 1 1106 61
        i 6.933 151.115 0.100 1 1110 70
        i 6.934 151.133 0.100 1 1102 51
        i 6.935 151.184 0.100 1 1106 76
        i 6.936 151.195 0.100 1 1102 71
        i 6.937 151.203 0.100 1 1094 66
        i 6.938 151.259 0.100 1 1094 80
        i 6.939 151.284 0.100 1 1101 58
        i 6.940 151.297 0.100 1 1106 75
        i 6.941 151.329 0.100 1 1103 62
        i 6.942 151.351 0.100 1 1105 54
        i 6.943 151.373 0.100 1 1095 78
        i 6.944 151.465 0.100 1 1092 74
        i 6.945 151.555 0.100 1 1098 64
        i 6.946 151.585 0.100 1 1102 81
        i 6.947 151.657 0.100 1 1108 68
        i 6.948 151.700 0.100 1 1104 51
        i 6.949 151.721 0.100 1 1096 63
        i 6.950 151.731 0.100 1 1114 60
        i 6.951 151.768 0.100 1 1109 53
        i 6.952 151.900 0.100 1 1100 70
        i 6.953 151.981 0.100 1 1096 64
        i 6.954 152.035 0.100 1 1104 66
        i 6.955 152.056 0.100 1 1101 78
        i 6.956 152.069 0.100 1 1110 74
        i 6.957 152.104 0.100 1 1104 51
        i 6.958 152.128 0.100 1 1107 59
        i 6.959 152.149 0.100 1 1100 59
        i 6.960 152.193 0.100 1 1093 80
        i 6.961 152.207 0.100 1 1093 64
        i 6.962 152.256 0.100 1 1099 52
        i 6.963 152.375 0.100 1 1113 49
        i 6.964 152.409 0.100 1 1099 71
        i 6.965 152.415 0.100 1 1100 69
        i 6.966 152.420 0.100 1 1098 57
        i 6.967 152.425 0.100 1 1104 64
        i 6.968 152.443 0.100 1 1095 80
        i 6.969 152.551 0.100 1 1109 68
        i 6.970 152.663 0.100 1 1111 65
        i 6.971 152.681 0.100 1 1103 48
        i 6.972 152.787 0.100 1 1095 81
        i 6.973 152.797 0.100 1 1101 74
        i 6.974 152.860 0.100 1 1103 63
        i 6.975 152.869 0.100 1 1095 58
        i 6.976 152.885 0.100 1 1107 58
        i 6.977 152.939 0.100 1 1100 61
        i 6.978 152.956 0.100 1 1101 69
        i 6.979 152.979 0.100 1 1113 56
        i 6.980 152.987 0.100 1 1097 56
        i 6.981 153.081 0.100 1 1097 60
        i 6.982 153.087 0.100 1 1102 72
        i 6.983 153.199 0.100 1 1103 66
        i 6.984 153.299 0.100 1 1089 48
        i 6.985 153.371 0.100 1 1109 64
        i 6.986 153.376 0.100 1 1093 73
        i 6.987 153.377 0.100 1 1111 75
        i 6.988 153.471 0.100 1 1098 81
        i 6.989 153.472 0.100 1 1111 68
        i 6.990 153.543 0.100 1 1101 50
        i 6.991 153.545 0.100 1 1103 63
        i 6.992 153.613 0.100 1 1107 71
        i 6.993 153.632 0.100 1 1097 58
        i 6.994 153.692 0.100 1 1095 67
        i 6.995 153.717 0.100 1 1095 76
        i 6.996 153.723 0.100 1 1109 66
        i 6.997 153.787 0.100 1 1107 62
        i 6.998 153.859 0.100 1 1107 57
        i 6.999 153.895 0.100 1 1105 68
        i 6.001 153.912 0.100 1 1109 63
        i 6.002 153.985 0.100 1 1094 82
        i 6.003 154.015 0.100 1 1101 64
        i 6.004 154.035 0.100 1 1099 74
        i 6.005 154.088 0.100 1 1105 49
        i 6.006 154.241 0.100 1 1091 54
        i 6.007 154.247 0.100 1 1109 61
        i 6.008 154.256 0.100 1 1105 58
        i 6.009 154.289 0.100 1 1093 66
        i 6.010 154.321 0.100 1 1113 63
        i 6.011 154.343 0.100 1 1103 63
        i 6.012 154.407 0.100 1 1107 69
        i 6.013 154.560 0.100 1 1103 59
        i 6.014 154.560 0.100 1 1105 61
        i 6.015 154.619 0.100 1 1107 78
        i 6.016 154.655 0.100 1 1097 64
        i 6.017 154.673 0.100 1 1105 69
        i 6.018 154.703 0.100 1 1105 77
        i 6.019 154.715 0.100 1 1095 82
        i 6.020 154.784 0.100 1 1101 56
        i 6.021 154.817 0.100 1 1107 74
        i 6.022 154.908 0.100 1 1109 76
        i 6.023 154.913 0.100 1 1092 64
        i 6.024 154.935 0.100 1 1103 76
        i 6.025 155.005 0.100 1 1095 46
        i 6.026 155.071 0.100 1 1107 52
        i 6.027 155.129 0.100 1 1115 70
        i 6.028 155.192 0.100 1 1099 76
        i 6.029 155.192 0.100 1 1101 56
        i 6.030 155.224 0.100 1 1105 68
        i 6.031 155.321 0.100 1 1107 61
        i 6.032 155.364 0.100 1 1097 75
        i 6.033 155.377 0.100 1 1105 62
        i 6.034 155.419 0.100 1 1099 56
        i 6.035 155.445 0.100 1 1091 75
        i 6.036 155.553 0.100 1 1101 78
        i 6.037 155.555 0.100 1 1109 57
        i 6.038 155.565 0.100 1 1103 66
        i 6.039 155.589 0.100 1 1093 65
        i 6.040 155.668 0.100 1 1103 63
        i 6.041 155.696 0.100 1 1105 62
        i 6.042 155.753 0.100 1 1102 70
        i 6.043 155.793 0.100 1 1100 53
        i 6.044 155.812 0.100 1 1111 64
        i 6.045 155.904 0.100 1 1095 61
        i 6.046 156.015 0.100 1 1093 63
        i 6.047 156.064 0.100 1 1105 74
        i 6.048 156.091 0.100 1 1099 64
        i 6.049 156.123 0.100 1 1095 57
        i 6.050 156.151 0.100 1 1099 69
        i 6.051 156.187 0.100 1 1097 59
        i 6.052 156.196 0.100 1 1103 56
        i 6.053 156.221 0.100 1 1101 69
        i 6.054 156.255 0.100 1 1115 75
        i 6.055 156.271 0.100 1 1101 66
        i 6.056 156.324 0.100 1 1105 61
        i 6.057 156.345 0.100 1 1103 73
        i 6.058 156.373 0.100 1 1107 69
        i 6.059 156.381 0.100 1 1109 51
        i 6.060 156.501 0.100 1 1100 70
        i 6.061 156.596 0.100 1 1111 56
        i 6.062 156.692 0.100 1 1094 79
        i 6.063 156.757 0.100 1 1097 52
        i 6.064 156.792 0.100 1 1092 68
        i 6.065 156.829 0.100 1 1101 78
        i 6.066 156.833 0.100 1 1103 67
        i 6.067 156.863 0.100 1 1099 51
        i 6.068 156.924 0.100 1 1102 62
        i 6.069 156.964 0.100 1 1099 68
        i 6.070 156.993 0.100 1 1095 53
        i 6.071 157.032 0.100 1 1113 61
        i 6.072 157.100 0.100 1 1099 71
        i 6.073 157.152 0.100 1 1113 57
        i 6.074 157.184 0.100 1 1101 60
        i 6.075 157.293 0.100 1 1110 78
        i 6.076 157.297 0.100 1 1096 53
        i 6.077 157.313 0.100 1 1103 79
        i 6.078 157.336 0.100 1 1096 61
        i 6.079 157.345 0.100 1 1108 78
        i 6.080 157.419 0.100 1 1103 74
        i 6.081 157.447 0.100 1 1097 51
        i 6.082 157.556 0.100 1 1106 63
        i 6.083 157.627 0.100 1 1099 69
        i 6.084 157.683 0.100 1 1101 68
        i 6.085 157.705 0.100 1 1097 70
        i 6.086 157.729 0.100 1 1102 82
        i 6.087 157.881 0.100 1 1092 73
        i 6.088 157.911 0.100 1 1110 76
        i 6.089 157.916 0.100 1 1098 82
        i 6.090 157.921 0.100 1 1089 60
        i 6.091 157.963 0.100 1 1108 61
        i 6.092 158.072 0.100 1 1103 60
        i 6.093 158.084 0.100 1 1111 77
        i 6.094 158.101 0.100 1 1102 61
        i 6.095 158.133 0.100 1 1108 55
        i 6.096 158.155 0.100 1 1094 69
        i 6.097 158.192 0.100 1 1094 79
        i 6.098 158.221 0.100 1 1106 77
        i 6.099 158.232 0.100 1 1097 70
        i 6.100 158.304 0.100 1 1105 61
        i 6.101 158.421 0.100 1 1106 62
        i 6.102 158.424 0.100 1 1093 62
        i 6.103 158.485 0.100 1 1104 72
        i 6.104 158.491 0.100 1 1100 73
        i 6.105 158.547 0.100 1 1110 58
        i 6.106 158.585 0.100 1 1100 77
        i 6.107 158.648 0.100 1 1104 60
        i 6.108 158.731 0.100 1 1114 70
        i 6.109 158.751 0.100 1 1108 69
        i 6.110 158.787 0.100 1 1092 48
        i 6.111 158.801 0.100 1 1092 81
        i 6.112 158.871 0.100 1 1108 56
        i 6.113 158.968 0.100 1 1106 58
        i 6.114 159.037 0.100 1 1096 73
        i 6.115 159.072 0.100 1 1103 55
        i 6.116 159.076 0.100 1 1098 61
        i 6.117 159.087 0.100 1 1104 73
        i 6.118 159.212 0.100 1 1108 64
        i 6.119 159.216 0.100 1 1107 72
        i 6.120 159.284 0.100 1 1106 79
        i 6.121 159.312 0.100 1 1102 68
        i 6.122 159.329 0.100 1 1091 56
        i 6.123 159.377 0.100 1 1116 61
        i 6.124 159.380 0.100 1 1100 68
        i 6.125 159.389 0.100 1 1104 77
        i 6.126 159.472 0.100 1 1094 59
        i 6.127 159.477 0.100 1 1110 74
        i 6.128 159.544 0.100 1 1106 49
        i 6.129 159.597 0.100 1 1106 53
        i 6.130 159.648 0.100 1 1104 57
        i 6.131 159.668 0.100 1 1100 68
        i 6.132 159.692 0.100 1 1102 63
        i 6.133 159.775 0.100 1 1098 77
        i 6.134 159.832 0.100 1 1104 72
        i 6.135 159.895 0.100 1 1104 52
        i 6.136 159.977 0.100 1 1092 55
        i 6.137 159.980 0.100 1 1100 52
        i 6.138 159.996 0.100 1 1092 61
        i 6.139 160.009 0.100 1 1102 64
        i 6.140 160.104 0.100 1 1108 78
        i 6.141 160.148 0.100 1 1101 57
        i 6.142 160.185 0.100 1 1100 61
        i 6.143 160.188 0.100 1 1110 59
        i 6.144 160.188 0.100 1 1112 67
        i 6.145 160.252 0.100 1 1104 76
        i 6.146 160.265 0.100 1 1106 62
        i 6.147 160.305 0.100 1 1100 60
        i 6.148 160.435 0.100 1 1094 62
        i 6.149 160.439 0.100 1 1114 60
        i 6.150 160.459 0.100 1 1096 71
        i 6.151 160.521 0.100 1 1094 70
        i 6.152 160.628 0.100 1 1102 57
        i 6.153 160.653 0.100 1 1098 67
        i 6.154 160.659 0.100 1 1102 62
        i 6.155 160.708 0.100 1 1106 72
        i 6.156 160.749 0.100 1 1100 79
        i 6.157 160.835 0.100 1 1100 66
        i 6.158 160.917 0.100 1 1099 78
        i 6.159 161.005 0.100 1 1098 80
        i 6.160 161.011 0.100 1 1100 65
        i 6.161 161.043 0.100 1 1102 60
        i 6.162 161.075 0.100 1 1112 60
        i 6.163 161.105 0.100 1 1110 68
        i 6.164 161.136 0.100 1 1108 57
        i 6.165 161.192 0.100 1 1094 78
        i 6.166 161.243 0.100 1 1112 78
        i 6.167 161.255 0.100 1 1102 78
        i 6.168 161.327 0.100 1 1100 66
        i 6.169 161.377 0.100 1 1092 65
        i 6.170 161.424 0.100 1 1098 50
        i 6.171 161.456 0.100 1 1094 49
        i 6.172 161.508 0.100 1 1100 49
        i 6.173 161.515 0.100 1 1102 60
        i 6.174 161.573 0.100 1 1112 54
        i 6.175 161.624 0.100 1 1104 76
        i 6.176 161.705 0.100 1 1098 55
        i 6.177 161.764 0.100 1 1110 51
        i 6.178 161.773 0.100 1 1097 61
        i 6.179 161.787 0.100 1 1098 51
        i 6.180 161.809 0.100 1 1097 78
        i 6.181 161.816 0.100 1 1108 56
        i 6.182 161.873 0.100 1 1112 51
        i 6.183 161.891 0.100 1 1102 62
        i 6.184 161.893 0.100 1 1108 64
        i 6.185 162.048 0.100 1 1104 61
        i 6.186 162.108 0.100 1 1110 79
        i 6.187 162.161 0.100 1 1096 60
        i 6.188 162.192 0.100 1 1115 79
        i 6.189 162.219 0.100 1 1100 60
        i 6.190 162.260 0.100 1 1101 60
        i 6.191 162.300 0.100 1 1092 68
        i 6.192 162.304 0.100 1 1096 51
        i 6.193 162.317 0.100 1 1102 63
        i 6.194 162.323 0.100 1 1098 75
        i 6.195 162.332 0.100 1 1099 80
        i 6.196 162.379 0.100 1 1107 51
        i 6.197 162.475 0.100 1 1090 72
        i 6.198 162.600 0.100 1 1104 79
        i 6.199 162.608 0.100 1 1110 63
        i 6.200 162.663 0.100 1 1094 60
        i 6.201 162.692 0.100 1 1093 77
        i 6.202 162.787 0.100 1 1106 60
        i 6.203 162.809 0.100 1 1106 67
        i 6.204 162.861 0.100 1 1093 64
        i 6.205 162.891 0.100 1 1110 80
        i 6.206 162.967 0.100 1 1099 77
        i 6.207 162.980 0.100 1 1105 49
        i 6.208 162.983 0.100 1 1106 56
        i 6.209 163.003 0.100 1 1108 61
        i 6.210 163.025 0.100 1 1105 55
        i 6.211 163.049 0.100 1 1100 59
        i 6.212 163.056 0.100 1 1104 60
        i 6.213 163.060 0.100 1 1106 59
        i 6.214 163.156 0.100 1 1108 70
        i 6.215 163.236 0.100 1 1115 71
        i 6.216 163.261 0.100 1 1092 57
        i 6.217 163.313 0.100 1 1091 66
        i 6.218 163.352 0.100 1 1106 53
        i 6.219 163.424 0.100 1 1096 69
        i 6.220 163.497 0.100 1 1099 63
        i 6.221 163.524 0.100 1 1107 79
        i 6.222 163.569 0.100 1 1104 77
        i 6.223 163.595 0.100 1 1103 59
        i 6.224 163.689 0.100 1 1108 55
        i 6.225 163.704 0.100 1 1103 60
        i 6.226 163.735 0.100 1 1105 62
        i 6.227 163.745 0.100 1 1091 61
        i 6.228 163.861 0.100 1 1104 65
        i 6.229 163.868 0.100 1 1094 62
        i 6.230 163.889 0.100 1 1099 58
        i 6.231 163.943 0.100 1 1101 57
        i 6.232 163.996 0.100 1 1107 72
        i 6.233 164.044 0.100 1 1111 53
        i 6.234 164.077 0.100 1 1105 78
        i 6.235 164.139 0.100 1 1115 53
        i 6.236 164.144 0.100 1 1101 61
        i 6.237 164.149 0.100 1 1113 54
        i 6.238 164.192 0.100 1 1101 81
        i 6.239 164.228 0.100 1 1105 57
        i 6.240 164.293 0.100 1 1097 70
        i 6.241 164.320 0.100 1 1098 57
        i 6.242 164.332 0.100 1 1101 67
        i 6.243 164.427 0.100 1 1101 76
        i 6.244 164.441 0.100 1 1091 46
        i 6.245 164.460 0.100 1 1093 79
        i 6.246 164.543 0.100 1 1100 59
        i 6.247 164.545 0.100 1 1103 68
        i 6.248 164.581 0.100 1 1109 74
        i 6.249 164.721 0.100 1 1113 61
        i 6.250 164.779 0.100 1 1103 62
        i 6.251 164.799 0.100 1 1107 63
        i 6.252 164.817 0.100 1 1099 55
        i 6.253 164.817 0.100 1 1099 75
        i 6.254 164.836 0.100 1 1099 78
        i 6.255 164.856 0.100 1 1111 62
        i 6.256 164.876 0.100 1 1109 72
        i 6.257 164.935 0.100 1 1103 57
        i 6.258 164.965 0.100 1 1093 52
        i 6.259 164.981 0.100 1 1095 71
        i 6.260 165.132 0.100 1 1107 76
        i 6.261 165.160 0.100 1 1101 74
        i 6.262 165.195 0.100 1 1099 61
        i 6.263 165.271 0.100 1 1111 66
        i 6.264 165.279 0.100 1 1099 73
        i 6.265 165.333 0.100 1 1098 57
        i 6.266 165.383 0.100 1 1109 48
        i 6.267 165.393 0.100 1 1113 78
        i 6.268 165.481 0.100 1 1103 68
        i 6.269 165.483 0.100 1 1109 61
        i 6.270 165.509 0.100 1 1113 57
        i 6.271 165.531 0.100 1 1097 60
        i 6.272 165.604 0.100 1 1113 64
        i 6.273 165.643 0.100 1 1101 77
        i 6.274 165.692 0.100 1 1095 83
        i 6.275 165.853 0.100 1 1101 74
        i 6.276 165.871 0.100 1 1093 72
        i 6.277 165.884 0.100 1 1097 56
        i 6.278 165.916 0.100 1 1097 58
        i 6.279 165.963 0.100 1 1093 71
        i 6.280 166.027 0.100 1 1107 69
        i 6.281 166.079 0.100 1 1103 60
        i 6.282 166.103 0.100 1 1095 71
        i 6.283 166.127 0.100 1 1111 59
        i 6.284 166.128 0.100 1 1099 51
        i 6.285 166.161 0.100 1 1101 65
        i 6.286 166.208 0.100 1 1109 68
        i 6.287 166.211 0.100 1 1098 76
        i 6.288 166.263 0.100 1 1115 78
        i 6.289 166.288 0.100 1 1105 64
        i 6.290 166.296 0.100 1 1101 51
        i 6.291 166.320 0.100 1 1097 81
        i 6.292 166.453 0.100 1 1111 61
        i 6.293 166.631 0.100 1 1099 70
        i 6.294 166.669 0.100 1 1091 78
        i 6.295 166.732 0.100 1 1105 61
        i 6.296 166.748 0.100 1 1100 74
        i 6.297 166.753 0.100 1 1099 77
        i 6.298 166.755 0.100 1 1103 71
        i 6.299 166.768 0.100 1 1105 74
        i 6.300 166.776 0.100 1 1095 55
        i 6.301 166.780 0.100 1 1103 56
        i 6.302 166.791 0.100 1 1101 77
        i 6.303 166.837 0.100 1 1109 70
        i 6.304 166.897 0.100 1 1109 59
        i 6.305 166.919 0.100 1 1109 51
        i 6.306 166.963 0.100 1 1105 71
        i 6.307 167.016 0.100 1 1091 69
        i 6.308 167.081 0.100 1 1105 76
        i 6.309 167.141 0.100 1 1107 54
        i 6.310 167.191 0.100 1 1092 81
        i 6.311 167.240 0.100 1 1095 83
        i 6.312 167.300 0.100 1 1092 83
        i 6.313 167.369 0.100 1 1103 81
        i 6.314 167.387 0.100 1 1107 57
        i 6.315 167.411 0.100 1 1107 50
        i 6.316 167.443 0.100 1 1099 71
        i 6.317 167.443 0.100 1 1105 72
        i 6.318 167.463 0.100 1 1101 67
        i 6.319 167.475 0.100 1 1111 72
        i 6.320 167.551 0.100 1 1105 53
        i 6.321 167.684 0.100 1 1107 69
        i 6.322 167.711 0.100 1 1105 76
        i 6.323 167.724 0.100 1 1093 48
        i 6.324 167.743 0.100 1 1105 63
        i 6.325 167.823 0.100 1 1090 54
        i 6.326 167.832 0.100 1 1115 68
        i 6.327 167.853 0.100 1 1107 66
        i 6.328 167.880 0.100 1 1097 55
        i 6.329 167.933 0.100 1 1108 55
        i 6.330 167.968 0.100 1 1100 63
        i 6.331 168.005 0.100 1 1097 66
        i 6.332 168.052 0.100 1 1105 50
        i 6.333 168.055 0.100 1 1103 65
        i 6.334 168.097 0.100 1 1107 67
        i 6.335 168.101 0.100 1 1107 61
        i 6.336 168.163 0.100 1 1092 60
        i 6.337 168.167 0.100 1 1103 48
        i 6.338 168.253 0.100 1 1093 53
        i 6.339 168.288 0.100 1 1103 54
        i 6.340 168.347 0.100 1 1099 55
        i 6.341 168.355 0.100 1 1111 49
        i 6.342 168.384 0.100 1 1114 63
        i 6.343 168.572 0.100 1 1100 58
        i 6.344 168.607 0.100 1 1105 66
        i 6.345 168.636 0.100 1 1099 71
        i 6.346 168.667 0.100 1 1101 58
        i 6.347 168.669 0.100 1 1102 60
        i 6.348 168.689 0.100 1 1100 75
        i 6.349 168.755 0.100 1 1110 54
        i 6.350 168.795 0.100 1 1112 49
        i 6.351 168.823 0.100 1 1104 65
        i 6.352 168.873 0.100 1 1094 64
        i 6.353 168.887 0.100 1 1101 77
        i 6.354 168.897 0.100 1 1109 59
        i 6.355 168.905 0.100 1 1091 47
        i 6.356 168.920 0.100 1 1099 49
        i 6.357 168.939 0.100 1 1100 55
        i 6.358 168.985 0.100 1 1105 64
        i 6.359 169.179 0.100 1 1108 80
        i 6.360 169.193 0.100 1 1098 50
        i 6.361 169.243 0.100 1 1096 57
        i 6.362 169.292 0.100 1 1114 59
        i 6.363 169.325 0.100 1 1098 82
        i 6.364 169.353 0.100 1 1110 74
        i 6.365 169.440 0.100 1 1096 77
        i 6.366 169.440 0.100 1 1112 79
        i 6.367 169.545 0.100 1 1092 68
        i 6.368 169.548 0.100 1 1104 66
        i 6.369 169.553 0.100 1 1103 79
        i 6.370 169.572 0.100 1 1101 71
        i 6.371 169.600 0.100 1 1098 83
        i 6.372 169.603 0.100 1 1110 51
        i 6.373 169.668 0.100 1 1108 68
        i 6.374 169.737 0.100 1 1100 51
        i 6.375 169.751 0.100 1 1097 63
        i 6.376 169.783 0.100 1 1108 58
        i 6.377 169.811 0.100 1 1100 51
        i 6.378 169.903 0.100 1 1094 73
        i 6.379 169.920 0.100 1 1104 79
        i 6.380 169.957 0.100 1 1102 58
        i 6.381 170.083 0.100 1 1112 49
        i 6.382 170.143 0.100 1 1110 70
        i 6.383 170.188 0.100 1 1096 72
        i 6.384 170.231 0.100 1 1098 74
        i 6.385 170.284 0.100 1 1092 69
        i 6.386 170.404 0.100 1 1110 65
        i 6.387 170.445 0.100 1 1096 62
        i 6.388 170.452 0.100 1 1101 70
        i 6.389 170.480 0.100 1 1104 72
        i 6.390 170.495 0.100 1 1094 74
        i 6.391 170.521 0.100 1 1104 69
        i 6.392 170.580 0.100 1 1114 67
        i 6.393 170.581 0.100 1 1106 63
        i 6.394 170.588 0.100 1 1110 52
        i 6.395 170.649 0.100 1 1099 64
        i 6.396 170.652 0.100 1 1104 66
        i 6.397 170.727 0.100 1 1098 65
        i 6.398 170.728 0.100 1 1106 70
        i 6.399 170.771 0.100 1 1113 55
        i 6.400 170.785 0.100 1 1102 74
        i 6.401 170.828 0.100 1 1098 52
        i 6.402 170.865 0.100 1 1108 60
        i 6.403 171.037 0.100 1 1090 63
        i 6.404 171.041 0.100 1 1098 63
        i 6.405 171.160 0.100 1 1104 59
        i 6.406 171.164 0.100 1 1101 68
        i 6.407 171.169 0.100 1 1102 56
        i 6.408 171.173 0.100 1 1100 53
        i 6.409 171.215 0.100 1 1110 71
        i 6.410 171.227 0.100 1 1116 67
        i 6.411 171.268 0.100 1 1100 56
        i 6.412 171.296 0.100 1 1106 80
        i 6.413 171.387 0.100 1 1106 74
        i 6.414 171.400 0.100 1 1096 75
        i 6.415 171.485 0.100 1 1108 66
        i 6.416 171.537 0.100 1 1092 73
        i 6.417 171.569 0.100 1 1106 79
        i 6.418 171.575 0.100 1 1104 79
        i 6.419 171.647 0.100 1 1108 76
        i 6.420 171.687 0.100 1 1092 79
        i 6.421 171.717 0.100 1 1098 77
        i 6.422 171.737 0.100 1 1091 59
        i 6.423 171.747 0.100 1 1115 57
        i 6.424 171.865 0.100 1 1098 56
        i 6.425 171.876 0.100 1 1100 60
        i 6.426 171.912 0.100 1 1104 51
        i 6.427 171.924 0.100 1 1096 80
        i 6.428 171.951 0.100 1 1102 77
        i 6.429 171.984 0.100 1 1108 76
        i 6.430 171.996 0.100 1 1104 69
        i 6.431 172.041 0.100 1 1106 53
        i 6.432 172.059 0.100 1 1112 73
        i 6.433 172.151 0.100 1 1116 67
        i 6.434 172.165 0.100 1 1106 66
        i 6.435 172.168 0.100 1 1094 57
        i 6.436 172.331 0.100 1 1090 80
        i 6.437 172.360 0.100 1 1106 72
        i 6.438 172.395 0.100 1 1106 63
        i 6.439 172.436 0.100 1 1100 62
        i 6.440 172.443 0.100 1 1098 81
        i 6.441 172.445 0.100 1 1100 60
        i 6.442 172.483 0.100 1 1102 79
        i 6.443 172.511 0.100 1 1106 68
        i 6.444 172.527 0.100 1 1108 52
        i 6.445 172.539 0.100 1 1110 53
        i 6.446 172.559 0.100 1 1108 73
        i 6.447 172.579 0.100 1 1093 69
        i 6.448 172.692 0.100 1 1107 76
        i 6.449 172.719 0.100 1 1092 67
        i 6.450 172.795 0.100 1 1102 76
        i 6.451 172.805 0.100 1 1098 64
        i 6.452 172.936 0.100 1 1100 57
        i 6.453 172.955 0.100 1 1096 72
        i 6.454 173.029 0.100 1 1108 71
        i 6.455 173.052 0.100 1 1112 67
        i 6.456 173.056 0.100 1 1104 51
        i 6.457 173.096 0.100 1 1104 53
        i 6.458 173.108 0.100 1 1100 53
        i 6.459 173.147 0.100 1 1114 78
        i 6.460 173.185 0.100 1 1099 79
        i 6.461 173.201 0.100 1 1103 80
        i 6.462 173.212 0.100 1 1111 68
        i 6.463 173.325 0.100 1 1094 49
        i 6.464 173.333 0.100 1 1099 58
        i 6.465 173.356 0.100 1 1102 74
        i 6.466 173.425 0.100 1 1110 50
        i 6.467 173.449 0.100 1 1090 45
        i 6.468 173.507 0.100 1 1100 59
        i 6.469 173.551 0.100 1 1110 59
        i 6.470 173.557 0.100 1 1107 67
        i 6.471 173.571 0.100 1 1098 53
        i 6.472 173.603 0.100 1 1114 51
        i 6.473 173.689 0.100 1 1102 51
        i 6.474 173.703 0.100 1 1093 68
        i 6.475 173.707 0.100 1 1104 60
        i 6.476 173.713 0.100 1 1106 77
        i 6.477 173.833 0.100 1 1097 60
        i 6.478 173.892 0.100 1 1109 77
        i 6.479 173.900 0.100 1 1108 66
        i 6.480 173.920 0.100 1 1098 63
        i 6.481 173.936 0.100 1 1096 72
        i 6.482 174.044 0.100 1 1102 57
        i 6.483 174.109 0.100 1 1103 74
        i 6.484 174.132 0.100 1 1093 55
        i 6.485 174.144 0.100 1 1100 66
        i 6.486 174.167 0.100 1 1097 59
        i 6.487 174.172 0.100 1 1104 52
        i 6.488 174.215 0.100 1 1103 64
        i 6.489 174.252 0.100 1 1108 49
        i 6.490 174.343 0.100 1 1115 75
        i 6.491 174.359 0.100 1 1100 50
        i 6.492 174.403 0.100 1 1115 50
        i 6.493 174.412 0.100 1 1111 58
        i 6.494 174.415 0.100 1 1107 54
        i 6.495 174.511 0.100 1 1112 48
        i 6.496 174.573 0.100 1 1112 65
        i 6.497 174.589 0.100 1 1104 80
        i 6.498 174.684 0.100 1 1097 57
        i 6.499 174.736 0.100 1 1091 54
        i 6.500 174.851 0.100 1 1103 72
        i 6.501 174.879 0.100 1 1104 56
        i 6.502 174.911 0.100 1 1099 68
        i 6.503 174.915 0.100 1 1096 67
        i 6.504 174.977 0.100 1 1100 51
        i 6.505 174.992 0.100 1 1101 58
        i 6.506 175.027 0.100 1 1095 66
        i 6.507 175.048 0.100 1 1113 60
        i 6.508 175.055 0.100 1 1109 64
        i 6.509 175.087 0.100 1 1099 82
        i 6.510 175.092 0.100 1 1105 59
        i 6.511 175.144 0.100 1 1107 57
        i 6.512 175.169 0.100 1 1107 63
        i 6.513 175.244 0.100 1 1117 58
        i 6.514 175.271 0.100 1 1098 56
        i 6.515 175.336 0.100 1 1099 52
        i 6.516 175.364 0.100 1 1105 48
        i 6.517 175.432 0.100 1 1109 55
        i 6.518 175.444 0.100 1 1089 50
        i 6.519 175.533 0.100 1 1099 61
        i 6.520 175.576 0.100 1 1098 70
        i 6.521 175.595 0.100 1 1102 70
        i 6.522 175.633 0.100 1 1101 78
        i 6.523 175.665 0.100 1 1111 65
        i 6.524 175.671 0.100 1 1107 62
        i 6.525 175.673 0.100 1 1113 61
        i 6.526 175.715 0.100 1 1097 70
        i 6.527 175.745 0.100 1 1099 81
        i 6.528 175.775 0.100 1 1105 67
        i 6.529 175.872 0.100 1 1103 63
        i 6.530 175.916 0.100 1 1107 68
        i 6.531 176.003 0.100 1 1093 45
        i 6.532 176.027 0.100 1 1107 73
        i 6.533 176.099 0.100 1 1107 51
        i 6.534 176.104 0.100 1 1105 78
        i 6.535 176.119 0.100 1 1105 57
        i 6.536 176.183 0.100 1 1091 66
        i 6.537 176.189 0.100 1 1092 61
        i 6.538 176.217 0.100 1 1115 54
        i 6.539 176.236 0.100 1 1103 79
        i 6.540 176.288 0.100 1 1097 66
        i 6.541 176.328 0.100 1 1099 64
        i 6.542 176.340 0.100 1 1101 52
        i 6.543 176.357 0.100 1 1103 68
        i 6.544 176.403 0.100 1 1113 65
        i 6.545 176.447 0.100 1 1107 51
        i 6.546 176.524 0.100 1 1097 60
        i 6.547 176.555 0.100 1 1095 59
        i 6.548 176.604 0.100 1 1105 79
        i 6.549 176.635 0.100 1 1107 74
        i 6.550 176.735 0.100 1 1105 50
        i 6.551 176.755 0.100 1 1106 48
        i 6.552 176.789 0.100 1 1109 76
        i 6.553 176.796 0.100 1 1101 57
        i 6.554 176.839 0.100 1 1091 55
        i 6.555 176.904 0.100 1 1115 78
        i 6.556 176.911 0.100 1 1095 76
        i 6.557 176.913 0.100 1 1109 62
        i 6.558 176.923 0.100 1 1101 55
        i 6.559 176.943 0.100 1 1101 52
        i 6.560 176.987 0.100 1 1103 73
        i 6.561 177.009 0.100 1 1094 74
        i 6.562 177.108 0.100 1 1105 53
        i 6.563 177.127 0.100 1 1099 77
        i 6.564 177.183 0.100 1 1091 44
        i 6.565 177.219 0.100 1 1101 52
        i 6.566 177.303 0.100 1 1097 61
        i 6.567 177.315 0.100 1 1099 74
        i 6.568 177.372 0.100 1 1108 73
        i 6.569 177.447 0.100 1 1113 58
        i 6.570 177.463 0.100 1 1113 53
        i 6.571 177.559 0.100 1 1109 64
        i 6.572 177.575 0.100 1 1103 50
        i 6.573 177.671 0.100 1 1099 76
        i 6.574 177.672 0.100 1 1111 61
        i 6.575 177.683 0.100 1 1099 68
        i 6.576 177.720 0.100 1 1113 56
        i 6.577 177.733 0.100 1 1103 70
        i 6.578 177.743 0.100 1 1098 54
        i 6.579 177.747 0.100 1 1093 72
        i 6.580 177.748 0.100 1 1111 67
        i 6.581 177.868 0.100 1 1095 72
        i 6.582 177.916 0.100 1 1103 55
        i 6.583 177.916 0.100 1 1101 65
        i 6.584 177.919 0.100 1 1105 78
        i 6.585 177.991 0.100 1 1089 57
        i 6.586 178.069 0.100 1 1114 53
        i 6.587 178.081 0.100 1 1107 56
        i 6.588 178.148 0.100 1 1109 74
        i 6.589 178.203 0.100 1 1099 53
        i 6.590 178.300 0.100 1 1113 59
        i 6.591 178.336 0.100 1 1101 65
        i 6.592 178.343 0.100 1 1096 73
        i 6.593 178.347 0.100 1 1103 63
        i 6.594 178.361 0.100 1 1097 80
        i 6.595 178.388 0.100 1 1115 67
        i 6.596 178.400 0.100 1 1111 64
        i 6.597 178.500 0.100 1 1109 62
        i 6.598 178.524 0.100 1 1097 77
        i 6.599 178.584 0.100 1 1109 78
        i 6.600 178.597 0.100 1 1096 77
        i 6.601 178.640 0.100 1 1103 55
        i 6.602 178.697 0.100 1 1111 50
        i 6.603 178.720 0.100 1 1093 60
        i 6.604 178.841 0.100 1 1109 53
        i 6.605 178.847 0.100 1 1112 79
        i 6.606 178.887 0.100 1 1105 49
        i 6.607 178.899 0.100 1 1105 59
        i 6.608 178.979 0.100 1 1099 45
        i 6.609 179.091 0.100 1 1111 80
        i 6.610 179.100 0.100 1 1111 69
        i 6.611 179.107 0.100 1 1107 53
        i 6.612 179.128 0.100 1 1101 49
        i 6.613 179.183 0.100 1 1098 59
        i 6.614 179.199 0.100 1 1105 84
        i 6.615 179.212 0.100 1 1100 82
        i 6.616 179.213 0.100 1 1109 71
        i 6.617 179.279 0.100 1 1091 76
        i 6.618 179.385 0.100 1 1099 71
        i 6.619 179.472 0.100 1 1103 49
        i 6.620 179.475 0.100 1 1095 72
        i 6.621 179.540 0.100 1 1100 65
        i 6.622 179.560 0.100 1 1096 75
        i 6.623 179.573 0.100 1 1109 58
        i 6.624 179.581 0.100 1 1116 61
        i 6.625 179.704 0.100 1 1114 64
        i 6.626 179.721 0.100 1 1099 74
        i 6.627 179.743 0.100 1 1103 79
        i 6.628 179.801 0.100 1 1104 73
        i 6.629 179.812 0.100 1 1097 56
        i 6.630 179.841 0.100 1 1100 75
        i 6.631 179.847 0.100 1 1100 80
        i 6.632 179.865 0.100 1 1107 78
        i 6.633 179.889 0.100 1 1109 74
        i 6.634 179.907 0.100 1 1106 59
        i 6.635 179.943 0.100 1 1090 72
        i 6.636 180.029 0.100 1 1107 56
        i 6.637 180.069 0.100 1 1102 60
        i 6.638 180.121 0.100 1 1097 53
        i 6.639 180.172 0.100 1 1097 63
        i 6.640 180.183 0.100 1 1105 69
        i 6.641 180.204 0.100 1 1106 65
        i 6.642 180.223 0.100 1 1101 73
        i 6.643 180.224 0.100 1 1098 83
        i 6.644 180.244 0.100 1 1107 62
        i 6.645 180.255 0.100 1 1116 65
        i 6.646 180.316 0.100 1 1106 67
        i 6.647 180.396 0.100 1 1107 75
        i 6.648 180.465 0.100 1 1093 48
        i 6.649 180.480 0.100 1 1104 51
        i 6.650 180.545 0.100 1 1112 75
        i 6.651 180.577 0.100 1 1107 60
        i 6.652 180.641 0.100 1 1116 73
        i 6.653 180.683 0.100 1 1090 72
        i 6.654 180.685 0.100 1 1092 66
        i 6.655 180.724 0.100 1 1117 64
        i 6.656 180.736 0.100 1 1102 82
        i 6.657 180.737 0.100 1 1096 78
        i 6.658 180.843 0.100 1 1102 57
        i 6.659 180.855 0.100 1 1107 49
        i 6.660 180.857 0.100 1 1104 51
        i 6.661 180.871 0.100 1 1098 76
        i 6.662 180.919 0.100 1 1102 73
        i 6.663 180.992 0.100 1 1096 68
        i 6.664 181.040 0.100 1 1108 64
        i 6.665 181.053 0.100 1 1098 70
        i 6.666 181.097 0.100 1 1108 67
        i 6.667 181.139 0.100 1 1102 78
        i 6.668 181.149 0.100 1 1114 50
        i 6.669 181.228 0.100 1 1114 61
        i 6.670 181.241 0.100 1 1110 61
        i 6.671 181.301 0.100 1 1104 65
        i 6.672 181.351 0.100 1 1092 56
        i 6.673 181.395 0.100 1 1094 74
        i 6.674 181.427 0.100 1 1102 54
        i 6.675 181.427 0.100 1 1115 58
        i 6.676 181.484 0.100 1 1095 68
        i 6.677 181.584 0.100 1 1110 57
        i 6.678 181.604 0.100 1 1100 75
        i 6.679 181.609 0.100 1 1110 50
        i 6.680 181.625 0.100 1 1106 76
        i 6.681 181.659 0.100 1 1100 59
        i 6.682 181.699 0.100 1 1090 59
        i 6.683 181.704 0.100 1 1105 67
        i 6.684 181.775 0.100 1 1100 63
        i 6.685 181.777 0.100 1 1100 69
        i 6.686 181.853 0.100 1 1096 58
        i 6.687 181.961 0.100 1 1114 52
        i 6.688 181.973 0.100 1 1098 71
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
{"baeea327-af4b-4b10-a843-6614c20ea958":[],"069e83fd-1c94-47e9-95ec-126e0fbefec3":[],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","fadeInTime":0.05,"fadeOutTime":0.05,"soundDistanceMin":1,"soundDistanceMax":50},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-3.892,-3.600,48.546]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[18.745,-3.600,33.863]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-9.503,-3.600,-30.044]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[29.496,-3.600,20.856]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[1.190,-3.600,7.478]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[12.033,-3.600,3.613]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-7.742,-3.600,-17.838]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-25.535,-3.600,-1.434]}},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-15.910,-3.600,3.969]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[1.999,24.400,2.496]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-5.360,22.000,-35.450]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[42.819,28.400,20.824]}},{"noteOn":{"time":10.245,"note":103.000,"xyz":[16.926,28.400,-21.615]}},{"noteOn":{"time":10.800,"note":95.000,"xyz":[-3.620,22.000,-2.509]}},{"noteOn":{"time":11.530,"note":97.000,"xyz":[-9.107,23.600,4.941]}},{"noteOn":{"time":12.440,"note":97.000,"xyz":[12.873,23.600,-26.008]}},{"noteOn":{"time":13.355,"note":95.000,"xyz":[40.717,22.000,-0.249]}},{"noteOn":{"time":14.095,"note":103.000,"xyz":[46.054,28.400,-2.197]}},{"noteOn":{"time":14.665,"note":102.000,"xyz":[39.320,27.600,-26.754]}},{"noteOn":{"time":15.235,"note":96.000,"xyz":[-36.039,22.800,-27.522]}},{"noteOn":{"time":15.275,"note":96.000,"xyz":[-13.465,22.800,-30.037]}},{"noteOn":{"time":15.850,"note":94.000,"xyz":[0.830,21.200,-3.277]}},{"noteOn":{"time":16.060,"note":98.000,"xyz":[-11.415,24.400,30.522]}},{"noteOn":{"time":16.380,"note":102.000,"xyz":[12.352,27.600,-11.917]}},{"noteOn":{"time":17.025,"note":96.000,"xyz":[-17.239,22.800,21.445]}},{"noteOn":{"time":17.320,"note":101.000,"xyz":[-40.048,26.800,24.168]}},{"noteOn":{"time":17.885,"note":94.000,"xyz":[13.179,21.200,0.488]}},{"noteOn":{"time":18.175,"note":95.000,"xyz":[10.639,22.000,19.559]}},{"noteOn":{"time":18.575,"note":104.000,"xyz":[-13.224,29.200,-32.616]}},{"noteOn":{"time":18.910,"note":97.000,"xyz":[2.060,23.600,-2.245]}},{"noteOn":{"time":19.085,"note":102.000,"xyz":[-0.850,27.600,-5.105]}},{"noteOn":{"time":19.730,"note":95.000,"xyz":[2.004,22.000,-41.241]}},{"noteOn":{"time":19.750,"note":96.000,"xyz":[-1.109,22.800,-0.572]}},{"noteOn":{"time":20.325,"note":93.000,"xyz":[33.163,20.400,14.792]}},{"noteOn":{"time":20.590,"note":99.000,"xyz":[-10.840,25.200,12.767]}},{"noteOn":{"time":20.830,"note":103.000,"xyz":[-4.529,28.400,-17.080]}},{"noteOn":{"time":20.970,"note":99.000,"xyz":[-17.525,25.200,30.592]}},{"noteOn":{"time":21.575,"note":95.000,"xyz":[12.265,22.000,4.083]}},{"noteOn":{"time":21.640,"note":97.000,"xyz":[-28.759,23.600,-5.845]}},{"noteOn":{"time":21.750,"note":101.000,"xyz":[42.758,26.800,-16.362]}},{"noteOn":{"time":22.205,"note":103.000,"xyz":[19.866,28.400,-14.282]}},{"noteOn":{"time":22.385,"note":93.000,"xyz":[10.867,20.400,11.945]}},{"noteOn":{"time":22.585,"note":96.000,"xyz":[33.942,22.800,-14.116]}},{"noteOn":{"time":22.910,"note":105.000,"xyz":[37.163,30.000,-22.157]}},{"noteOn":{"time":23.015,"note":103.000,"xyz":[9.490,28.400,12.590]}},{"noteOn":{"time":23.340,"note":98.000,"xyz":[9.597,24.400,-4.267]}},{"noteOn":{"time":23.445,"note":95.000,"xyz":[-21.262,22.000,40.240]}},{"noteOn":{"time":23.560,"note":101.000,"xyz":[-34.462,26.800,14.767]}},{"noteOn":{"time":24.175,"note":97.000,"xyz":[33.508,23.600,-23.219]}},{"noteOn":{"time":24.185,"note":94.000,"xyz":[-9.267,21.200,-4.721]}},{"noteOn":{"time":24.280,"note":97.000,"xyz":[-5.916,23.600,26.439]}},{"noteOn":{"time":24.680,"note":99.000,"xyz":[15.926,25.200,3.920]}},{"noteOn":{"time":24.755,"note":92.000,"xyz":[21.670,19.600,35.389]}},{"noteOn":{"time":25.175,"note":99.000,"xyz":[11.310,25.200,13.167]}},{"noteOn":{"time":25.270,"note":102.000,"xyz":[1.004,27.600,2.814]}},{"noteOn":{"time":25.440,"note":97.000,"xyz":[-5.598,23.600,-26.686]}},{"noteOn":{"time":25.965,"note":104.000,"xyz":[10.599,29.200,-0.584]}},{"noteOn":{"time":26.105,"note":94.000,"xyz":[-30.820,21.200,-16.109]}},{"noteOn":{"time":26.170,"note":100.000,"xyz":[4.354,26.000,-3.550]}},{"noteOn":{"time":26.755,"note":104.000,"xyz":[-2.572,29.200,-11.236]}},{"noteOn":{"time":26.860,"note":92.000,"xyz":[-24.877,19.600,6.308]}},{"noteOn":{"time":26.980,"note":96.000,"xyz":[-36.183,22.800,9.732]}},{"noteOn":{"time":27.310,"note":96.000,"xyz":[2.996,22.800,11.513]}},{"noteOn":{"time":27.435,"note":102.000,"xyz":[-2.382,27.600,12.887]}},{"noteOn":{"time":27.760,"note":98.000,"xyz":[15.266,24.400,16.443]}},{"noteOn":{"time":28.005,"note":94.000,"xyz":[-9.334,21.200,5.701]}},{"noteOn":{"time":28.035,"note":100.000,"xyz":[-24.257,26.000,0.407]}},{"noteOn":{"time":28.125,"note":98.000,"xyz":[26.410,24.400,-41.173]}},{"noteOn":{"time":28.625,"note":93.000,"xyz":[30.913,20.400,7.145]}},{"noteOn":{"time":28.710,"note":98.000,"xyz":[30.594,24.400,-7.747]}},{"noteOn":{"time":28.750,"note":92.000,"xyz":[46.227,19.600,6.324]}},{"noteOn":{"time":28.810,"note":98.000,"xyz":[-9.608,24.400,-8.138]}},{"noteOn":{"time":29.175,"note":91.000,"xyz":[-26.312,18.800,25.503]}},{"noteOn":{"time":29.510,"note":102.000,"xyz":[-2.342,27.600,8.564]}},{"noteOn":{"time":29.555,"note":96.000,"xyz":[9.687,22.800,-29.831]}},{"noteOn":{"time":29.710,"note":101.000,"xyz":[1.404,26.800,-13.172]}},{"noteOn":{"time":29.760,"note":100.000,"xyz":[18.639,26.000,36.710]}},{"noteOn":{"time":30.170,"note":104.000,"xyz":[-14.916,29.200,34.443]}},{"noteOn":{"time":30.250,"note":100.000,"xyz":[-9.660,26.000,-11.113]}},{"noteOn":{"time":30.585,"note":99.000,"xyz":[20.313,25.200,3.988]}},{"noteOn":{"time":30.635,"note":94.000,"xyz":[1.460,21.200,-14.431]}},{"noteOn":{"time":31.015,"note":95.000,"xyz":[12.237,22.000,-2.696]}},{"noteOn":{"time":31.045,"note":103.000,"xyz":[20.826,28.400,-17.132]}},{"noteOn":{"time":31.335,"note":92.000,"xyz":[7.871,19.600,-22.076]}},{"noteOn":{"time":31.375,"note":97.000,"xyz":[-22.457,23.600,-4.860]}},{"noteOn":{"time":31.685,"note":97.000,"xyz":[35.378,23.600,-31.688]}},{"noteOn":{"time":31.750,"note":97.000,"xyz":[-4.809,23.600,-6.893]}},{"noteOn":{"time":31.855,"note":101.000,"xyz":[1.961,26.800,5.763]}},{"noteOn":{"time":32.175,"note":99.000,"xyz":[0.604,25.200,5.698]}},{"noteOn":{"time":32.510,"note":99.000,"xyz":[-0.730,25.200,-4.359]}},{"noteOn":{"time":32.515,"note":93.000,"xyz":[7.792,20.400,32.126]}},{"noteOn":{"time":32.590,"note":99.000,"xyz":[11.309,25.200,14.468]}},{"noteOn":{"time":33.060,"note":93.000,"xyz":[4.177,20.400,26.062]}},{"noteOn":{"time":33.250,"note":91.000,"xyz":[-8.072,18.800,7.284]}},{"noteOn":{"time":33.260,"note":97.000,"xyz":[-32.243,23.600,18.314]}},{"noteOn":{"time":33.340,"note":99.000,"xyz":[27.039,25.200,4.460]}},{"noteOn":{"time":33.590,"note":92.000,"xyz":[-19.855,19.600,26.772]}},{"noteOn":{"time":34.020,"note":101.000,"xyz":[45.727,26.800,-15.797]}},{"noteOn":{"time":34.040,"note":101.000,"xyz":[36.928,26.800,-14.387]}},{"noteOn":{"time":34.150,"note":100.000,"xyz":[-0.722,26.000,3.147]}},{"noteOn":{"time":34.195,"note":95.000,"xyz":[34.590,22.000,24.335]}},{"noteOn":{"time":34.335,"note":101.000,"xyz":[-26.123,26.800,-34.818]}},{"noteOn":{"time":34.730,"note":99.000,"xyz":[-38.210,25.200,-29.678]}},{"noteOn":{"time":34.745,"note":99.000,"xyz":[-8.918,25.200,19.690]}},{"noteOn":{"time":34.895,"note":105.000,"xyz":[-44.021,30.000,8.885]}},{"noteOn":{"time":35.005,"note":98.000,"xyz":[-1.408,24.400,-22.973]}},{"noteOn":{"time":35.155,"note":93.000,"xyz":[-3.983,20.400,-40.641]}},{"noteOn":{"time":35.520,"note":95.000,"xyz":[43.735,22.000,-10.440]}},{"noteOn":{"time":35.560,"note":103.000,"xyz":[-1.572,28.400,4.591]}},{"noteOn":{"time":35.770,"note":98.000,"xyz":[-2.678,24.400,0.750]}},{"noteOn":{"time":35.800,"note":93.000,"xyz":[9.550,20.400,7.335]}},{"noteOn":{"time":35.860,"note":103.000,"xyz":[13.549,28.400,-33.970]}},{"noteOn":{"time":36.245,"note":98.000,"xyz":[32.763,24.400,-35.641]}},{"noteOn":{"time":36.330,"note":101.000,"xyz":[14.560,26.800,9.151]}},{"noteOn":{"time":36.540,"note":105.000,"xyz":[0.450,30.000,-8.155]}},{"noteOn":{"time":36.590,"note":97.000,"xyz":[-10.492,23.600,-32.880]}},{"noteOn":{"time":36.590,"note":100.000,"xyz":[-4.679,26.000,2.982]}},{"noteOn":{"time":37.025,"note":92.000,"xyz":[1.699,19.600,-23.621]}},{"noteOn":{"time":37.040,"note":98.000,"xyz":[-27.462,24.400,13.230]}},{"noteOn":{"time":37.415,"note":95.000,"xyz":[-4.409,22.000,-8.906]}},{"noteOn":{"time":37.495,"note":92.000,"xyz":[-15.037,19.600,-9.646]}},{"noteOn":{"time":37.585,"note":100.000,"xyz":[-15.441,26.000,-1.573]}},{"noteOn":{"time":37.745,"note":90.000,"xyz":[2.480,18.000,-1.410]}},{"noteOn":{"time":37.925,"note":100.000,"xyz":[18.123,26.000,-25.281]}},{"noteOn":{"time":38.005,"note":92.000,"xyz":[-43.691,19.600,-22.992]}},{"noteOn":{"time":38.145,"note":97.000,"xyz":[-10.954,23.600,-8.737]}},{"noteOn":{"time":38.340,"note":96.000,"xyz":[-7.205,22.800,2.072]}},{"noteOn":{"time":38.525,"note":100.000,"xyz":[-7.054,26.000,5.919]}},{"noteOn":{"time":38.585,"note":100.000,"xyz":[9.957,26.000,-9.161]}},{"noteOn":{"time":38.725,"note":101.000,"xyz":[31.833,26.800,33.778]}},{"noteOn":{"time":38.865,"note":102.000,"xyz":[25.332,27.600,13.231]}},{"noteOn":{"time":39.245,"note":98.000,"xyz":[36.212,24.400,-25.991]}},{"noteOn":{"time":39.290,"note":98.000,"xyz":[-11.132,24.400,40.412]}},{"noteOn":{"time":39.320,"note":94.000,"xyz":[-12.977,21.200,-40.493]}},{"noteOn":{"time":39.420,"note":97.000,"xyz":[11.192,23.600,15.966]}},{"noteOn":{"time":39.630,"note":92.000,"xyz":[5.428,19.600,-28.929]}},{"noteOn":{"time":40.005,"note":104.000,"xyz":[-17.973,29.200,35.765]}},{"noteOn":{"time":40.030,"note":96.000,"xyz":[23.063,22.800,15.244]}},{"noteOn":{"time":40.110,"note":104.000,"xyz":[-0.742,29.200,1.287]}},{"noteOn":{"time":40.165,"note":99.000,"xyz":[4.205,25.200,-19.840]}},{"noteOn":{"time":40.220,"note":94.000,"xyz":[40.587,21.200,27.413]}},{"noteOn":{"time":40.310,"note":92.000,"xyz":[-17.835,19.600,-44.125]}},{"noteOn":{"time":40.740,"note":98.000,"xyz":[-18.532,24.400,-30.103]}},{"noteOn":{"time":40.810,"note":100.000,"xyz":[-26.480,26.000,-31.787]}},{"noteOn":{"time":40.865,"note":106.000,"xyz":[31.760,30.800,-17.029]}},{"noteOn":{"time":41.010,"note":101.000,"xyz":[-2.092,26.800,6.538]}},{"noteOn":{"time":41.055,"note":102.000,"xyz":[0.829,27.600,-2.058]}},{"noteOn":{"time":41.210,"note":90.000,"xyz":[8.705,18.000,17.612]}},{"noteOn":{"time":41.530,"note":92.000,"xyz":[2.238,19.600,21.435]}},{"noteOn":{"time":41.570,"note":98.000,"xyz":[13.239,24.400,-3.459]}},{"noteOn":{"time":41.720,"note":100.000,"xyz":[35.445,26.000,-29.184]}},{"noteOn":{"time":41.860,"note":96.000,"xyz":[17.186,22.800,-34.148]}},{"noteOn":{"time":41.875,"note":98.000,"xyz":[-16.494,24.400,23.346]}},{"noteOn":{"time":41.935,"note":91.000,"xyz":[-11.729,18.800,4.607]}},{"noteOn":{"time":42.240,"note":91.000,"xyz":[25.884,18.800,36.544]}},{"noteOn":{"time":42.300,"note":98.000,"xyz":[22.881,24.400,-1.972]}},{"noteOn":{"time":42.450,"note":93.000,"xyz":[-12.669,20.400,-5.711]}},{"noteOn":{"time":42.510,"note":100.000,"xyz":[8.982,26.000,35.083]}},{"noteOn":{"time":42.710,"note":98.000,"xyz":[-38.244,24.400,20.672]}},{"noteOn":{"time":42.795,"note":100.000,"xyz":[-1.656,26.000,22.585]}},{"noteOn":{"time":43.035,"note":99.000,"xyz":[-1.946,25.200,2.125]}},{"noteOn":{"time":43.055,"note":99.000,"xyz":[9.667,25.200,-1.180]}},{"noteOn":{"time":43.130,"note":94.000,"xyz":[26.172,21.200,30.747]}},{"noteOn":{"time":43.395,"note":103.000,"xyz":[0.254,28.400,-0.996]}},{"noteOn":{"time":43.410,"note":100.000,"xyz":[-20.523,26.000,-0.447]}},{"noteOn":{"time":43.640,"note":95.000,"xyz":[28.645,22.000,-4.045]}},{"noteOn":{"time":43.740,"note":97.000,"xyz":[-9.092,23.600,4.250]}},{"noteOn":{"time":43.865,"note":97.000,"xyz":[44.167,23.600,-22.310]}},{"noteOn":{"time":43.870,"note":97.000,"xyz":[20.990,23.600,15.244]}},{"noteOn":{"time":43.965,"note":98.000,"xyz":[-13.606,24.400,5.779]}},{"noteOn":{"time":44.110,"note":93.000,"xyz":[34.834,20.400,-9.390]}},{"noteOn":{"time":44.530,"note":93.000,"xyz":[-8.980,20.400,-12.757]}},{"noteOn":{"time":44.540,"note":97.000,"xyz":[13.914,23.600,4.368]}},{"noteOn":{"time":44.560,"note":105.000,"xyz":[3.495,30.000,10.451]}},{"noteOn":{"time":44.590,"note":100.000,"xyz":[-1.925,26.000,-18.633]}},{"noteOn":{"time":44.645,"note":95.000,"xyz":[1.194,22.000,-5.192]}},{"noteOn":{"time":44.725,"note":91.000,"xyz":[-8.097,18.800,-41.406]}},{"noteOn":{"time":45.240,"note":99.000,"xyz":[24.438,25.200,-11.268]}},{"noteOn":{"time":45.285,"note":99.000,"xyz":[-8.660,25.200,-20.755]}},{"noteOn":{"time":45.295,"note":105.000,"xyz":[6.794,30.000,-0.007]}},{"noteOn":{"time":45.410,"note":103.000,"xyz":[44.738,28.400,-14.029]}},{"noteOn":{"time":45.455,"note":102.000,"xyz":[-22.284,27.600,-29.939]}},{"noteOn":{"time":45.670,"note":89.000,"xyz":[18.826,17.200,-23.036]}},{"noteOn":{"time":46.045,"note":91.000,"xyz":[-8.564,18.800,16.836]}},{"noteOn":{"time":46.105,"note":97.000,"xyz":[-32.131,23.600,-36.862]}},{"noteOn":{"time":46.180,"note":97.000,"xyz":[15.013,23.600,-5.751]}},{"noteOn":{"time":46.205,"note":99.000,"xyz":[18.708,25.200,-12.636]}},{"noteOn":{"time":46.270,"note":101.000,"xyz":[-3.576,26.800,-0.910]}},{"noteOn":{"time":46.405,"note":92.000,"xyz":[-12.643,19.600,-14.583]}},{"noteOn":{"time":46.425,"note":103.000,"xyz":[-0.071,28.400,-16.038]}},{"noteOn":{"time":46.740,"note":91.000,"xyz":[27.941,18.800,1.470]}},{"noteOn":{"time":46.830,"note":97.000,"xyz":[22.907,23.600,-18.481]}},{"noteOn":{"time":46.940,"note":94.000,"xyz":[19.206,21.200,-22.837]}},{"noteOn":{"time":47.095,"note":101.000,"xyz":[-15.825,26.800,-31.628]}},{"noteOn":{"time":47.150,"note":99.000,"xyz":[24.881,25.200,-4.688]}},{"noteOn":{"time":47.175,"note":99.000,"xyz":[15.077,25.200,22.854]}},{"noteOn":{"time":47.380,"note":101.000,"xyz":[43.620,26.800,-0.606]}},{"noteOn":{"time":47.545,"note":98.000,"xyz":[-2.310,24.400,-5.880]}},{"noteOn":{"time":47.565,"note":98.000,"xyz":[-5.022,24.400,40.397]}},{"noteOn":{"time":47.615,"note":95.000,"xyz":[-7.623,22.000,27.955]}},{"noteOn":{"time":47.930,"note":103.000,"xyz":[6.526,28.400,34.555]}},{"noteOn":{"time":47.975,"note":99.000,"xyz":[24.429,25.200,-9.069]}},{"noteOn":{"time":47.985,"note":103.000,"xyz":[1.320,28.400,-3.618]}},{"noteOn":{"time":48.005,"note":101.000,"xyz":[-20.351,26.800,-12.194]}},{"noteOn":{"time":48.240,"note":96.000,"xyz":[3.622,22.800,8.698]}},{"noteOn":{"time":48.310,"note":97.000,"xyz":[4.361,23.600,15.371]}},{"noteOn":{"time":48.355,"note":96.000,"xyz":[26.795,22.800,27.433]}},{"noteOn":{"time":48.585,"note":94.000,"xyz":[31.946,21.200,-19.199]}},{"noteOn":{"time":48.645,"note":105.000,"xyz":[-0.718,30.000,0.740]}},{"noteOn":{"time":48.650,"note":97.000,"xyz":[6.643,23.600,-6.534]}},{"noteOn":{"time":48.940,"note":95.000,"xyz":[-1.559,22.000,12.774]}},{"noteOn":{"time":49.050,"note":98.000,"xyz":[8.169,24.400,9.231]}},{"noteOn":{"time":49.060,"note":100.000,"xyz":[-35.470,26.000,-34.458]}},{"noteOn":{"time":49.105,"note":96.000,"xyz":[21.358,22.800,-26.394]}},{"noteOn":{"time":49.185,"note":105.000,"xyz":[9.420,30.000,29.530]}},{"noteOn":{"time":49.205,"note":91.000,"xyz":[-34.842,18.800,-5.090]}},{"noteOn":{"time":49.430,"note":95.000,"xyz":[-2.199,22.000,-2.416]}},{"noteOn":{"time":49.740,"note":100.000,"xyz":[20.699,26.000,9.854]}},{"noteOn":{"time":49.745,"note":93.000,"xyz":[-25.445,20.400,-34.927]}},{"noteOn":{"time":49.800,"note":105.000,"xyz":[-5.485,30.000,42.137]}},{"noteOn":{"time":49.805,"note":98.000,"xyz":[-10.074,24.400,-37.712]}},{"noteOn":{"time":49.945,"note":102.000,"xyz":[0.392,27.600,2.937]}},{"noteOn":{"time":50.155,"note":98.000,"xyz":[44.767,24.400,12.258]}},{"noteOn":{"time":50.195,"note":90.000,"xyz":[-35.795,18.000,-7.027]}},{"noteOn":{"time":50.555,"note":90.000,"xyz":[11.638,18.000,-10.167]}},{"noteOn":{"time":50.565,"note":98.000,"xyz":[-2.000,24.400,-28.439]}},{"noteOn":{"time":50.675,"note":96.000,"xyz":[36.984,22.800,-23.304]}},{"noteOn":{"time":50.710,"note":102.000,"xyz":[-0.428,27.600,30.903]}},{"noteOn":{"time":50.775,"note":98.000,"xyz":[-0.550,24.400,-13.868]}},{"noteOn":{"time":50.915,"note":93.000,"xyz":[-34.780,20.400,4.148]}},{"noteOn":{"time":50.990,"note":102.000,"xyz":[-19.344,27.600,23.063]}},{"noteOn":{"time":51.240,"note":92.000,"xyz":[-9.792,19.600,38.911]}},{"noteOn":{"time":51.450,"note":96.000,"xyz":[39.762,22.800,-5.149]}},{"noteOn":{"time":51.475,"note":95.000,"xyz":[36.081,22.000,-32.751]}},{"noteOn":{"time":51.475,"note":100.000,"xyz":[0.015,26.000,-1.961]}},{"noteOn":{"time":51.480,"note":100.000,"xyz":[15.266,26.000,6.569]}},{"noteOn":{"time":51.630,"note":102.000,"xyz":[-22.623,27.600,27.377]}},{"noteOn":{"time":51.825,"note":90.000,"xyz":[-12.103,18.000,14.523]}},{"noteOn":{"time":51.880,"note":100.000,"xyz":[-17.996,26.000,25.096]}},{"noteOn":{"time":52.060,"note":98.000,"xyz":[-27.282,24.400,0.396]}},{"noteOn":{"time":52.120,"note":97.000,"xyz":[6.617,23.600,14.247]}},{"noteOn":{"time":52.190,"note":96.000,"xyz":[1.272,22.800,10.128]}},{"noteOn":{"time":52.370,"note":88.000,"xyz":[1.033,16.400,-10.331]}},{"noteOn":{"time":52.410,"note":104.000,"xyz":[-20.984,29.200,12.807]}},{"noteOn":{"time":52.420,"note":98.000,"xyz":[2.808,24.400,5.152]}},{"noteOn":{"time":52.430,"note":104.000,"xyz":[-18.081,29.200,25.692]}},{"noteOn":{"time":52.475,"note":100.000,"xyz":[7.602,26.000,-6.309]}},{"noteOn":{"time":52.740,"note":96.000,"xyz":[-1.316,22.800,0.110]}},{"noteOn":{"time":52.835,"note":98.000,"xyz":[-2.753,24.400,26.699]}},{"noteOn":{"time":52.890,"note":95.000,"xyz":[-7.292,22.000,20.634]}},{"noteOn":{"time":52.935,"note":106.000,"xyz":[11.872,30.800,-24.880]}},{"noteOn":{"time":53.010,"note":94.000,"xyz":[-0.236,21.200,-2.053]}},{"noteOn":{"time":53.090,"note":98.000,"xyz":[-6.387,24.400,19.244]}},{"noteOn":{"time":53.215,"note":96.000,"xyz":[1.966,22.800,-0.629]}},{"noteOn":{"time":53.220,"note":102.000,"xyz":[-44.082,27.600,-22.394]}},{"noteOn":{"time":53.560,"note":99.000,"xyz":[32.654,25.200,-31.950]}},{"noteOn":{"time":53.570,"note":101.000,"xyz":[-0.735,26.800,-21.064]}},{"noteOn":{"time":53.585,"note":96.000,"xyz":[0.087,22.800,23.775]}},{"noteOn":{"time":53.780,"note":90.000,"xyz":[-1.035,18.000,44.543]}},{"noteOn":{"time":53.870,"note":106.000,"xyz":[-24.089,30.800,-5.633]}},{"noteOn":{"time":53.875,"note":96.000,"xyz":[29.680,22.800,7.341]}},{"noteOn":{"time":53.995,"note":96.000,"xyz":[9.475,22.800,8.829]}},{"noteOn":{"time":54.195,"note":94.000,"xyz":[-13.614,21.200,-48.097]}},{"noteOn":{"time":54.240,"note":101.000,"xyz":[8.544,26.800,-2.354]}},{"noteOn":{"time":54.335,"note":97.000,"xyz":[8.139,23.600,-46.438]}},{"noteOn":{"time":54.375,"note":104.000,"xyz":[-2.035,29.200,-12.357]}},{"noteOn":{"time":54.475,"note":103.000,"xyz":[-2.919,28.400,6.623]}},{"noteOn":{"time":54.745,"note":90.000,"xyz":[22.120,18.000,24.513]}},{"noteOn":{"time":54.755,"note":98.000,"xyz":[-8.384,24.400,-10.558]}},{"noteOn":{"time":54.910,"note":94.000,"xyz":[33.622,21.200,5.007]}},{"noteOn":{"time":54.915,"note":94.000,"xyz":[10.384,21.200,26.067]}},{"noteOn":{"time":55.015,"note":98.000,"xyz":[-11.836,24.400,-35.139]}},{"noteOn":{"time":55.065,"note":91.000,"xyz":[-1.218,18.800,1.572]}},{"noteOn":{"time":55.265,"note":95.000,"xyz":[30.348,22.000,0.299]}},{"noteOn":{"time":55.370,"note":97.000,"xyz":[-16.424,23.600,-21.807]}},{"noteOn":{"time":55.435,"note":102.000,"xyz":[2.050,27.600,-36.314]}},{"noteOn":{"time":55.470,"note":93.000,"xyz":[29.341,20.400,-29.896]}},{"noteOn":{"time":55.655,"note":96.000,"xyz":[0.957,22.800,12.043]}},{"noteOn":{"time":55.735,"note":93.000,"xyz":[30.932,20.400,19.464]}},{"noteOn":{"time":55.805,"note":101.000,"xyz":[23.640,26.800,-38.656]}},{"noteOn":{"time":55.860,"note":102.000,"xyz":[-9.049,27.600,40.323]}},{"noteOn":{"time":56.050,"note":96.000,"xyz":[-0.035,22.800,-14.497]}},{"noteOn":{"time":56.090,"note":95.000,"xyz":[-17.031,22.000,-12.977]}},{"noteOn":{"time":56.165,"note":103.000,"xyz":[4.304,28.400,-6.526]}},{"noteOn":{"time":56.170,"note":99.000,"xyz":[-19.118,25.200,-9.624]}},{"noteOn":{"time":56.215,"note":89.000,"xyz":[-17.850,17.200,0.926]}},{"noteOn":{"time":56.545,"note":99.000,"xyz":[-10.826,25.200,-13.238]}},{"noteOn":{"time":56.565,"note":97.000,"xyz":[-5.507,23.600,8.497]}},{"noteOn":{"time":56.715,"note":96.000,"xyz":[5.954,22.800,-24.502]}},{"noteOn":{"time":56.740,"note":97.000,"xyz":[-41.615,23.600,5.767]}},{"noteOn":{"time":56.785,"note":97.000,"xyz":[-20.114,23.600,28.667]}},{"noteOn":{"time":56.835,"note":89.000,"xyz":[43.225,17.200,24.350]}},{"noteOn":{"time":56.880,"note":105.000,"xyz":[19.491,30.000,-7.538]}},{"noteOn":{"time":56.885,"note":103.000,"xyz":[-10.551,28.400,-18.826]}},{"noteOn":{"time":57.235,"note":95.000,"xyz":[42.599,22.000,-2.554]}},{"noteOn":{"time":57.385,"note":99.000,"xyz":[-29.105,25.200,-1.782]}},{"noteOn":{"time":57.435,"note":95.000,"xyz":[31.304,22.000,27.154]}},{"noteOn":{"time":57.465,"note":94.000,"xyz":[19.612,21.200,-14.736]}},{"noteOn":{"time":57.465,"note":101.000,"xyz":[-4.961,26.800,-3.900]}},{"noteOn":{"time":57.530,"note":107.000,"xyz":[6.448,31.600,1.982]}},{"noteOn":{"time":57.635,"note":97.000,"xyz":[34.842,23.600,-14.984]}},{"noteOn":{"time":57.660,"note":95.000,"xyz":[16.232,22.000,-6.959]}},{"noteOn":{"time":58.065,"note":97.000,"xyz":[-13.882,23.600,-17.195]}},{"noteOn":{"time":58.070,"note":99.000,"xyz":[-35.672,25.200,22.835]}},{"noteOn":{"time":58.125,"note":103.000,"xyz":[-2.484,28.400,4.494]}},{"noteOn":{"time":58.125,"note":102.000,"xyz":[-24.234,27.600,25.961]}},{"noteOn":{"time":58.375,"note":89.000,"xyz":[-7.866,17.200,-16.228]}},{"noteOn":{"time":58.435,"note":105.000,"xyz":[-35.043,30.000,-33.323]}},{"noteOn":{"time":58.440,"note":97.000,"xyz":[-40.868,23.600,-11.118]}},{"noteOn":{"time":58.615,"note":95.000,"xyz":[-40.092,22.000,12.825]}},{"noteOn":{"time":58.735,"note":102.000,"xyz":[10.617,27.600,6.733]}},{"noteOn":{"time":58.870,"note":97.000,"xyz":[7.793,23.600,-2.244]}},{"noteOn":{"time":59.015,"note":93.000,"xyz":[2.116,20.400,19.334]}},{"noteOn":{"time":59.055,"note":102.000,"xyz":[10.406,27.600,-14.127]}},{"noteOn":{"time":59.060,"note":103.000,"xyz":[3.390,28.400,-4.793]}},{"noteOn":{"time":59.295,"note":91.000,"xyz":[1.474,18.800,11.552]}},{"noteOn":{"time":59.405,"note":99.000,"xyz":[-36.674,25.200,-25.093]}},{"noteOn":{"time":59.455,"note":95.000,"xyz":[18.460,22.000,3.976]}},{"noteOn":{"time":59.570,"note":92.000,"xyz":[-31.713,19.600,-11.314]}},{"noteOn":{"time":59.585,"note":99.000,"xyz":[38.025,25.200,-19.814]}},{"noteOn":{"time":59.640,"note":95.000,"xyz":[33.062,22.000,32.564]}},{"noteOn":{"time":59.855,"note":94.000,"xyz":[9.616,21.200,-35.219]}},{"noteOn":{"time":59.870,"note":105.000,"xyz":[-4.996,30.000,10.004]}},{"noteOn":{"time":59.930,"note":101.000,"xyz":[-33.201,26.800,13.729]}},{"noteOn":{"time":59.965,"note":97.000,"xyz":[0.646,23.600,7.193]}},{"noteOn":{"time":60.040,"note":94.000,"xyz":[-3.644,21.200,-4.869]}},{"noteOn":{"time":60.115,"note":97.000,"xyz":[32.705,23.600,7.607]}},{"noteOn":{"time":60.235,"note":94.000,"xyz":[-29.492,21.200,11.177]}},{"noteOn":{"time":60.250,"note":101.000,"xyz":[-3.707,26.800,17.396]}},{"noteOn":{"time":60.470,"note":103.000,"xyz":[14.059,28.400,13.218]}},{"noteOn":{"time":60.505,"note":101.000,"xyz":[19.913,26.800,-7.289]}},{"noteOn":{"time":60.510,"note":99.000,"xyz":[26.409,25.200,22.040]}},{"noteOn":{"time":60.635,"note":89.000,"xyz":[1.099,17.200,-22.884]}},{"noteOn":{"time":60.640,"note":96.000,"xyz":[3.927,22.800,37.158]}},{"noteOn":{"time":60.695,"note":104.000,"xyz":[26.501,29.200,-14.857]}},{"noteOn":{"time":60.730,"note":95.000,"xyz":[-3.434,22.000,-3.958]}},{"noteOn":{"time":61.065,"note":97.000,"xyz":[-36.188,23.600,-14.742]}},{"noteOn":{"time":61.075,"note":96.000,"xyz":[-23.651,22.800,-15.557]}},{"noteOn":{"time":61.100,"note":99.000,"xyz":[24.739,25.200,38.520]}},{"noteOn":{"time":61.330,"note":96.000,"xyz":[-1.448,22.800,-4.552]}},{"noteOn":{"time":61.335,"note":89.000,"xyz":[-8.126,17.200,32.201]}},{"noteOn":{"time":61.340,"note":103.000,"xyz":[-16.907,28.400,5.900]}},{"noteOn":{"time":61.365,"note":102.000,"xyz":[-37.792,27.600,-14.902]}},{"noteOn":{"time":61.370,"note":105.000,"xyz":[-21.074,30.000,-17.850]}},{"noteOn":{"time":61.375,"note":98.000,"xyz":[-20.784,24.400,15.029]}},{"noteOn":{"time":61.730,"note":94.000,"xyz":[8.069,21.200,-3.256]}},{"noteOn":{"time":61.875,"note":96.000,"xyz":[20.980,22.800,-45.004]}},{"noteOn":{"time":61.935,"note":101.000,"xyz":[3.427,26.800,6.888]}},{"noteOn":{"time":61.935,"note":100.000,"xyz":[-3.278,26.000,-2.386]}},{"noteOn":{"time":62.000,"note":105.000,"xyz":[1.225,30.000,-4.363]}},{"noteOn":{"time":62.025,"note":94.000,"xyz":[21.122,21.200,-2.041]}},{"noteOn":{"time":62.055,"note":93.000,"xyz":[-2.294,20.400,-15.775]}},{"noteOn":{"time":62.175,"note":106.000,"xyz":[9.613,30.800,-18.344]}},{"noteOn":{"time":62.215,"note":96.000,"xyz":[-25.462,22.800,2.644]}},{"noteOn":{"time":62.500,"note":104.000,"xyz":[-1.762,29.200,45.486]}},{"noteOn":{"time":62.560,"note":98.000,"xyz":[-35.271,24.400,9.589]}},{"noteOn":{"time":62.575,"note":100.000,"xyz":[-4.398,26.000,1.138]}},{"noteOn":{"time":62.695,"note":103.000,"xyz":[41.544,28.400,-14.733]}},{"noteOn":{"time":62.810,"note":96.000,"xyz":[-17.881,22.800,-4.445]}},{"noteOn":{"time":62.905,"note":90.000,"xyz":[23.260,18.000,18.177]}},{"noteOn":{"time":62.920,"note":104.000,"xyz":[-24.379,29.200,11.983]}},{"noteOn":{"time":62.930,"note":98.000,"xyz":[-34.978,24.400,0.167]}},{"noteOn":{"time":63.155,"note":94.000,"xyz":[-11.307,21.200,20.960]}},{"noteOn":{"time":63.230,"note":102.000,"xyz":[-36.233,27.600,33.586]}},{"noteOn":{"time":63.305,"note":94.000,"xyz":[-1.979,21.200,0.974]}},{"noteOn":{"time":63.420,"note":96.000,"xyz":[19.595,22.800,4.898]}},{"noteOn":{"time":63.535,"note":98.000,"xyz":[0.637,24.400,-1.611]}},{"noteOn":{"time":63.645,"note":101.000,"xyz":[-39.730,26.800,13.358]}},{"noteOn":{"time":63.670,"note":102.000,"xyz":[-22.713,27.600,17.087]}},{"noteOn":{"time":63.745,"note":100.000,"xyz":[-8.835,26.000,1.571]}},{"noteOn":{"time":63.780,"note":92.000,"xyz":[-23.410,19.600,-6.838]}},{"noteOn":{"time":63.845,"note":96.000,"xyz":[-21.027,22.800,-12.163]}},{"noteOn":{"time":63.920,"note":96.000,"xyz":[9.888,22.800,5.949]}},{"noteOn":{"time":64.080,"note":92.000,"xyz":[24.459,19.600,-9.309]}},{"noteOn":{"time":64.270,"note":100.000,"xyz":[-18.144,26.000,-43.868]}},{"noteOn":{"time":64.280,"note":104.000,"xyz":[-30.154,29.200,-37.804]}},{"noteOn":{"time":64.375,"note":100.000,"xyz":[-38.967,26.000,-10.566]}},{"noteOn":{"time":64.385,"note":94.000,"xyz":[4.758,21.200,12.514]}},{"noteOn":{"time":64.495,"note":96.000,"xyz":[4.643,22.800,15.906]}},{"noteOn":{"time":64.505,"note":98.000,"xyz":[-17.476,24.400,-4.991]}},{"noteOn":{"time":64.610,"note":95.000,"xyz":[5.977,22.000,11.764]}},{"noteOn":{"time":64.620,"note":100.000,"xyz":[15.131,26.000,-46.115]}},{"noteOn":{"time":64.730,"note":95.000,"xyz":[9.938,22.000,-3.243]}},{"noteOn":{"time":64.815,"note":102.000,"xyz":[-33.751,27.600,20.296]}},{"noteOn":{"time":64.950,"note":98.000,"xyz":[4.127,24.400,-4.037]}},{"noteOn":{"time":65.065,"note":102.000,"xyz":[15.817,27.600,46.113]}},{"noteOn":{"time":65.100,"note":88.000,"xyz":[-46.645,16.400,15.858]}},{"noteOn":{"time":65.130,"note":98.000,"xyz":[-3.783,24.400,-23.526]}},{"noteOn":{"time":65.175,"note":104.000,"xyz":[-40.466,29.200,-25.348]}},{"noteOn":{"time":65.235,"note":97.000,"xyz":[28.498,23.600,-12.981]}},{"noteOn":{"time":65.305,"note":94.000,"xyz":[35.227,21.200,29.023]}},{"noteOn":{"time":65.510,"note":96.000,"xyz":[-25.833,22.800,26.397]}},{"noteOn":{"time":65.585,"note":95.000,"xyz":[-8.153,22.000,36.216]}},{"noteOn":{"time":65.750,"note":104.000,"xyz":[-2.038,29.200,1.362]}},{"noteOn":{"time":65.790,"note":101.000,"xyz":[6.082,26.800,-24.972]}},{"noteOn":{"time":65.875,"note":102.000,"xyz":[-0.524,27.600,-19.820]}},{"noteOn":{"time":65.880,"note":90.000,"xyz":[18.509,18.000,40.993]}},{"noteOn":{"time":65.905,"note":98.000,"xyz":[18.150,24.400,-6.115]}},{"noteOn":{"time":65.935,"note":106.000,"xyz":[-22.798,30.800,1.394]}},{"noteOn":{"time":65.945,"note":95.000,"xyz":[-26.308,22.000,-14.674]}},{"noteOn":{"time":66.230,"note":93.000,"xyz":[2.510,20.400,46.954]}},{"noteOn":{"time":66.350,"note":94.000,"xyz":[-2.053,21.200,32.318]}},{"noteOn":{"time":66.350,"note":97.000,"xyz":[1.344,23.600,29.814]}},{"noteOn":{"time":66.395,"note":104.000,"xyz":[-16.893,29.200,38.894]}},{"noteOn":{"time":66.420,"note":101.000,"xyz":[-11.516,26.800,-14.237]}},{"noteOn":{"time":66.595,"note":106.000,"xyz":[-24.974,30.800,-6.013]}},{"noteOn":{"time":66.650,"note":93.000,"xyz":[7.869,20.400,2.646]}},{"noteOn":{"time":66.835,"note":96.000,"xyz":[15.076,22.800,-25.129]}},{"noteOn":{"time":66.890,"note":106.000,"xyz":[-3.006,30.800,5.413]}},{"noteOn":{"time":67.090,"note":101.000,"xyz":[-14.886,26.800,-42.025]}},{"noteOn":{"time":67.090,"note":99.000,"xyz":[4.080,25.200,-0.477]}},{"noteOn":{"time":67.110,"note":94.000,"xyz":[7.399,21.200,-14.446]}},{"noteOn":{"time":67.220,"note":96.000,"xyz":[-7.249,22.800,-38.998]}},{"noteOn":{"time":67.265,"note":102.000,"xyz":[-26.662,27.600,-33.228]}},{"noteOn":{"time":67.335,"note":103.000,"xyz":[16.899,28.400,-45.834]}},{"noteOn":{"time":67.345,"note":91.000,"xyz":[-39.463,18.800,21.625]}},{"noteOn":{"time":67.490,"note":99.000,"xyz":[-3.859,25.200,-24.129]}},{"noteOn":{"time":67.660,"note":97.000,"xyz":[11.951,23.600,4.204]}},{"noteOn":{"time":67.700,"note":93.000,"xyz":[20.305,20.400,3.863]}},{"noteOn":{"time":67.730,"note":101.000,"xyz":[25.966,26.800,-35.720]}},{"noteOn":{"time":68.010,"note":95.000,"xyz":[0.314,22.000,-2.148]}},{"noteOn":{"time":68.130,"note":98.000,"xyz":[-0.319,24.400,18.424]}},{"noteOn":{"time":68.150,"note":101.000,"xyz":[5.165,26.800,3.840]}},{"noteOn":{"time":68.175,"note":93.000,"xyz":[-28.125,20.400,27.803]}},{"noteOn":{"time":68.205,"note":101.000,"xyz":[-33.738,26.800,16.908]}},{"noteOn":{"time":68.235,"note":100.000,"xyz":[34.792,26.000,-28.901]}},{"noteOn":{"time":68.350,"note":99.000,"xyz":[-0.572,25.200,12.498]}},{"noteOn":{"time":68.385,"note":97.000,"xyz":[2.421,23.600,-15.122]}},{"noteOn":{"time":68.590,"note":93.000,"xyz":[-8.194,20.400,-35.887]}},{"noteOn":{"time":68.690,"note":103.000,"xyz":[-16.488,28.400,9.675]}},{"noteOn":{"time":68.890,"note":99.000,"xyz":[3.326,25.200,-9.508]}},{"noteOn":{"time":68.915,"note":93.000,"xyz":[-27.435,20.400,-3.873]}},{"noteOn":{"time":68.930,"note":97.000,"xyz":[-0.855,23.600,-1.160]}},{"noteOn":{"time":68.930,"note":101.000,"xyz":[37.518,26.800,-30.352]}},{"noteOn":{"time":68.935,"note":95.000,"xyz":[-5.281,22.000,-6.704]}},{"noteOn":{"time":68.935,"note":99.000,"xyz":[-32.319,25.200,15.029]}},{"noteOn":{"time":69.180,"note":96.000,"xyz":[12.462,22.800,-39.276]}},{"noteOn":{"time":69.230,"note":95.000,"xyz":[-38.686,22.000,16.510]}},{"noteOn":{"time":69.505,"note":103.000,"xyz":[4.783,28.400,-43.231]}},{"noteOn":{"time":69.570,"note":89.000,"xyz":[7.728,17.200,-16.346]}},{"noteOn":{"time":69.585,"note":103.000,"xyz":[-17.187,28.400,36.256]}},{"noteOn":{"time":69.650,"note":103.000,"xyz":[-30.719,28.400,-21.097]}},{"noteOn":{"time":69.665,"note":97.000,"xyz":[34.446,23.600,14.167]}},{"noteOn":{"time":69.665,"note":101.000,"xyz":[9.770,26.800,-0.415]}},{"noteOn":{"time":69.785,"note":93.000,"xyz":[2.160,20.400,-0.714]}},{"noteOn":{"time":69.825,"note":98.000,"xyz":[2.556,24.400,-3.544]}},{"noteOn":{"time":70.075,"note":95.000,"xyz":[16.489,22.000,-4.178]}},{"noteOn":{"time":70.095,"note":95.000,"xyz":[13.137,22.000,3.051]}},{"noteOn":{"time":70.170,"note":105.000,"xyz":[6.509,30.000,39.445]}},{"noteOn":{"time":70.195,"note":105.000,"xyz":[-6.189,30.000,31.473]}},{"noteOn":{"time":70.210,"note":101.000,"xyz":[-14.536,26.800,-3.184]}},{"noteOn":{"time":70.245,"note":107.000,"xyz":[-4.932,31.600,16.107]}},{"noteOn":{"time":70.345,"note":99.000,"xyz":[6.308,25.200,-32.213]}},{"noteOn":{"time":70.425,"note":91.000,"xyz":[-45.564,18.800,9.039]}},{"noteOn":{"time":70.495,"note":107.000,"xyz":[-7.879,31.600,-5.977]}},{"noteOn":{"time":70.555,"note":94.000,"xyz":[-13.706,21.200,-14.406]}},{"noteOn":{"time":70.730,"note":92.000,"xyz":[-1.821,19.600,3.352]}},{"noteOn":{"time":70.795,"note":95.000,"xyz":[5.733,22.000,1.219]}},{"noteOn":{"time":70.825,"note":95.000,"xyz":[2.232,22.000,0.211]}},{"noteOn":{"time":70.830,"note":98.000,"xyz":[-27.936,24.400,-1.498]}},{"noteOn":{"time":70.875,"note":101.000,"xyz":[21.934,26.800,24.809]}},{"noteOn":{"time":71.005,"note":105.000,"xyz":[20.033,30.000,10.511]}},{"noteOn":{"time":71.135,"note":107.000,"xyz":[40.377,31.600,-10.810]}},{"noteOn":{"time":71.235,"note":92.000,"xyz":[24.345,19.600,-27.479]}},{"noteOn":{"time":71.380,"note":105.000,"xyz":[-43.839,30.000,-10.743]}},{"noteOn":{"time":71.390,"note":95.000,"xyz":[-25.012,22.000,-24.577]}},{"noteOn":{"time":71.460,"note":97.000,"xyz":[-21.480,23.600,19.820]}},{"noteOn":{"time":71.600,"note":102.000,"xyz":[-10.235,27.600,-20.942]}},{"noteOn":{"time":71.625,"note":100.000,"xyz":[-0.193,26.000,5.751]}},{"noteOn":{"time":71.645,"note":103.000,"xyz":[2.733,28.400,-29.104]}},{"noteOn":{"time":71.660,"note":103.000,"xyz":[-25.190,28.400,16.601]}},{"noteOn":{"time":71.700,"note":97.000,"xyz":[0.189,23.600,-6.177]}},{"noteOn":{"time":71.755,"note":91.000,"xyz":[-12.812,18.800,4.386]}},{"noteOn":{"time":71.835,"note":102.000,"xyz":[-26.093,27.600,13.452]}},{"noteOn":{"time":71.935,"note":99.000,"xyz":[-9.834,25.200,-47.129]}},{"noteOn":{"time":72.060,"note":98.000,"xyz":[10.922,24.400,-48.238]}},{"noteOn":{"time":72.175,"note":93.000,"xyz":[1.955,20.400,11.652]}},{"noteOn":{"time":72.230,"note":100.000,"xyz":[17.362,26.000,32.399]}},{"noteOn":{"time":72.440,"note":101.000,"xyz":[6.651,26.800,-20.998]}},{"noteOn":{"time":72.540,"note":94.000,"xyz":[-24.064,21.200,-38.817]}},{"noteOn":{"time":72.595,"note":94.000,"xyz":[6.176,21.200,-1.466]}},{"noteOn":{"time":72.605,"note":99.000,"xyz":[-27.793,25.200,-22.003]}},{"noteOn":{"time":72.630,"note":106.000,"xyz":[5.981,30.800,3.013]}},{"noteOn":{"time":72.650,"note":101.000,"xyz":[5.833,26.800,-30.297]}},{"noteOn":{"time":72.730,"note":96.000,"xyz":[7.467,22.800,7.222]}},{"noteOn":{"time":72.785,"note":97.000,"xyz":[-12.373,23.600,-31.551]}},{"noteOn":{"time":72.825,"note":100.000,"xyz":[7.235,26.000,1.218]}},{"noteOn":{"time":73.105,"note":94.000,"xyz":[-4.768,21.200,18.949]}},{"noteOn":{"time":73.235,"note":103.000,"xyz":[1.443,28.400,-9.372]}},{"noteOn":{"time":73.295,"note":104.000,"xyz":[0.572,29.200,1.537]}},{"noteOn":{"time":73.345,"note":94.000,"xyz":[32.969,21.200,21.758]}},{"noteOn":{"time":73.355,"note":100.000,"xyz":[-9.528,26.000,-2.031]}},{"noteOn":{"time":73.380,"note":98.000,"xyz":[-6.173,24.400,-31.297]}},{"noteOn":{"time":73.450,"note":92.000,"xyz":[-2.504,19.600,-1.740]}},{"noteOn":{"time":73.495,"note":102.000,"xyz":[27.886,27.600,10.432]}},{"noteOn":{"time":73.525,"note":98.000,"xyz":[5.620,24.400,-27.203]}},{"noteOn":{"time":73.730,"note":96.000,"xyz":[-8.711,22.800,3.368]}},{"noteOn":{"time":73.750,"note":97.000,"xyz":[-1.880,23.600,17.785]}},{"noteOn":{"time":73.995,"note":104.000,"xyz":[-14.297,29.200,26.481]}},{"noteOn":{"time":74.075,"note":100.000,"xyz":[-1.442,26.000,0.035]}},{"noteOn":{"time":74.110,"note":90.000,"xyz":[-8.441,18.000,10.024]}},{"noteOn":{"time":74.130,"note":102.000,"xyz":[12.463,27.600,8.313]}},{"noteOn":{"time":74.190,"note":104.000,"xyz":[7.977,29.200,15.085]}},{"noteOn":{"time":74.245,"note":92.000,"xyz":[10.675,19.600,39.091]}},{"noteOn":{"time":74.250,"note":98.000,"xyz":[4.453,24.400,7.398]}},{"noteOn":{"time":74.265,"note":96.000,"xyz":[-28.970,22.800,26.742]}},{"noteOn":{"time":74.415,"note":99.000,"xyz":[-0.864,25.200,-0.735]}},{"noteOn":{"time":74.535,"note":96.000,"xyz":[-23.226,22.800,-30.704]}},{"noteOn":{"time":74.605,"note":94.000,"xyz":[9.644,21.200,24.223]}},{"noteOn":{"time":74.635,"note":100.000,"xyz":[14.091,26.000,-7.039]}},{"noteOn":{"time":74.740,"note":94.000,"xyz":[-44.733,21.200,7.186]}},{"noteOn":{"time":74.755,"note":100.000,"xyz":[15.665,26.000,-28.570]}},{"noteOn":{"time":74.770,"note":106.000,"xyz":[4.382,30.800,-18.270]}},{"noteOn":{"time":74.940,"note":106.000,"xyz":[-0.958,30.800,-46.690]}},{"noteOn":{"time":75.045,"note":92.000,"xyz":[38.771,19.600,30.833]}},{"noteOn":{"time":75.090,"note":106.000,"xyz":[-4.100,30.800,5.374]}},{"noteOn":{"time":75.165,"note":93.000,"xyz":[12.894,20.400,42.478]}},{"noteOn":{"time":75.230,"note":92.000,"xyz":[-48.742,19.600,10.182]}},{"noteOn":{"time":75.260,"note":98.000,"xyz":[11.298,24.400,-3.834]}},{"noteOn":{"time":75.305,"note":98.000,"xyz":[5.740,24.400,-4.402]}},{"noteOn":{"time":75.335,"note":100.000,"xyz":[-28.508,26.000,-7.526]}},{"noteOn":{"time":75.340,"note":96.000,"xyz":[-13.748,22.800,10.461]}},{"noteOn":{"time":75.545,"note":108.000,"xyz":[4.203,32.400,1.331]}},{"noteOn":{"time":75.630,"note":104.000,"xyz":[-4.540,29.200,-10.001]}},{"noteOn":{"time":75.675,"note":104.000,"xyz":[2.167,29.200,-3.934]}},{"noteOn":{"time":75.770,"note":98.000,"xyz":[-0.563,24.400,-5.844]}},{"noteOn":{"time":75.825,"note":91.000,"xyz":[-17.659,18.800,12.965]}},{"noteOn":{"time":75.930,"note":94.000,"xyz":[-45.506,21.200,-4.898]}},{"noteOn":{"time":76.085,"note":102.000,"xyz":[-6.666,27.600,27.955]}},{"noteOn":{"time":76.110,"note":101.000,"xyz":[-16.334,26.800,18.441]}},{"noteOn":{"time":76.155,"note":100.000,"xyz":[35.421,26.000,26.423]}},{"noteOn":{"time":76.170,"note":92.000,"xyz":[47.211,19.600,-7.294]}},{"noteOn":{"time":76.215,"note":104.000,"xyz":[-15.708,29.200,-16.956]}},{"noteOn":{"time":76.300,"note":98.000,"xyz":[-7.098,24.400,-8.424]}},{"noteOn":{"time":76.385,"note":100.000,"xyz":[-20.820,26.000,18.530]}},{"noteOn":{"time":76.400,"note":101.000,"xyz":[32.126,26.800,-27.794]}},{"noteOn":{"time":76.530,"note":96.000,"xyz":[36.906,22.800,14.420]}},{"noteOn":{"time":76.640,"note":92.000,"xyz":[-45.600,19.600,-17.639]}},{"noteOn":{"time":76.730,"note":99.000,"xyz":[-1.375,25.200,30.429]}},{"noteOn":{"time":76.910,"note":94.000,"xyz":[-28.344,21.200,-38.293]}},{"noteOn":{"time":76.975,"note":100.000,"xyz":[-42.775,26.000,-8.669]}},{"noteOn":{"time":77.010,"note":106.000,"xyz":[-29.762,30.800,15.921]}},{"noteOn":{"time":77.015,"note":100.000,"xyz":[24.527,26.000,-17.234]}},{"noteOn":{"time":77.035,"note":102.000,"xyz":[3.129,27.600,-2.420]}},{"noteOn":{"time":77.050,"note":105.000,"xyz":[-1.217,30.000,-17.464]}},{"noteOn":{"time":77.130,"note":93.000,"xyz":[-1.252,20.400,3.791]}},{"noteOn":{"time":77.170,"note":98.000,"xyz":[35.243,24.400,-22.474]}},{"noteOn":{"time":77.390,"note":99.000,"xyz":[-1.442,25.200,-41.100]}},{"noteOn":{"time":77.610,"note":95.000,"xyz":[21.864,22.000,6.891]}},{"noteOn":{"time":77.690,"note":98.000,"xyz":[-43.518,24.400,-12.279]}},{"noteOn":{"time":77.760,"note":93.000,"xyz":[-6.187,20.400,7.391]}},{"noteOn":{"time":77.820,"note":100.000,"xyz":[45.147,26.000,6.661]}},{"noteOn":{"time":77.835,"note":103.000,"xyz":[1.861,28.400,-2.544]}},{"noteOn":{"time":77.835,"note":102.000,"xyz":[8.488,27.600,-1.760]}},{"noteOn":{"time":77.930,"note":93.000,"xyz":[-22.913,20.400,-15.462]}},{"noteOn":{"time":77.935,"note":102.000,"xyz":[-4.394,27.600,-2.478]}},{"noteOn":{"time":77.945,"note":98.000,"xyz":[-30.256,24.400,33.388]}},{"noteOn":{"time":78.225,"note":97.000,"xyz":[-12.838,23.600,23.175]}},{"noteOn":{"time":78.290,"note":97.000,"xyz":[37.921,23.600,12.589]}},{"noteOn":{"time":78.385,"note":97.000,"xyz":[-17.039,23.600,-12.146]}},{"noteOn":{"time":78.485,"note":100.000,"xyz":[29.859,26.000,-5.991]}},{"noteOn":{"time":78.555,"note":101.000,"xyz":[3.868,26.800,-31.960]}},{"noteOn":{"time":78.635,"note":99.000,"xyz":[-6.363,25.200,2.254]}},{"noteOn":{"time":78.650,"note":91.000,"xyz":[-43.228,18.800,4.289]}},{"noteOn":{"time":78.700,"note":91.000,"xyz":[40.740,18.800,-22.410]}},{"noteOn":{"time":78.755,"note":105.000,"xyz":[4.221,30.000,-22.261]}},{"noteOn":{"time":78.905,"note":95.000,"xyz":[23.269,22.000,-31.480]}},{"noteOn":{"time":78.975,"note":100.000,"xyz":[32.690,26.000,-7.425]}},{"noteOn":{"time":79.110,"note":99.000,"xyz":[-40.481,25.200,-5.128]}},{"noteOn":{"time":79.115,"note":93.000,"xyz":[-32.605,20.400,30.957]}},{"noteOn":{"time":79.195,"note":99.000,"xyz":[-5.133,25.200,15.283]}},{"noteOn":{"time":79.235,"note":101.000,"xyz":[-38.378,26.800,20.734]}},{"noteOn":{"time":79.365,"note":106.000,"xyz":[-16.875,30.800,1.670]}},{"noteOn":{"time":79.430,"note":95.000,"xyz":[2.155,22.000,-10.157]}},{"noteOn":{"time":79.430,"note":105.000,"xyz":[22.537,30.000,-4.621]}},{"noteOn":{"time":79.570,"note":105.000,"xyz":[-26.519,30.000,-7.686]}},{"noteOn":{"time":79.640,"note":93.000,"xyz":[-29.833,20.400,-25.286]}},{"noteOn":{"time":79.725,"note":91.000,"xyz":[41.343,18.800,12.453]}},{"noteOn":{"time":79.750,"note":92.000,"xyz":[-35.050,19.600,8.700]}},{"noteOn":{"time":79.775,"note":97.000,"xyz":[27.153,23.600,15.051]}},{"noteOn":{"time":79.835,"note":99.000,"xyz":[1.461,25.200,-0.974]}},{"noteOn":{"time":79.855,"note":99.000,"xyz":[8.793,25.200,6.603]}},{"noteOn":{"time":79.955,"note":97.000,"xyz":[49.621,23.600,0.017]}},{"noteOn":{"time":79.955,"note":107.000,"xyz":[18.321,31.600,-10.053]}},{"noteOn":{"time":80.010,"note":103.000,"xyz":[-22.719,28.400,-5.995]}},{"noteOn":{"time":80.255,"note":103.000,"xyz":[-43.900,28.400,4.182]}},{"noteOn":{"time":80.390,"note":92.000,"xyz":[34.740,19.600,29.226]}},{"noteOn":{"time":80.450,"note":93.000,"xyz":[-24.714,20.400,-22.144]}},{"noteOn":{"time":80.575,"note":101.000,"xyz":[9.888,26.800,3.417]}},{"noteOn":{"time":80.615,"note":101.000,"xyz":[-21.901,26.800,5.755]}},{"noteOn":{"time":80.620,"note":95.000,"xyz":[0.308,22.000,33.989]}},{"noteOn":{"time":80.645,"note":93.000,"xyz":[6.175,20.400,4.549]}},{"noteOn":{"time":80.740,"note":101.000,"xyz":[-30.834,26.800,11.959]}},{"noteOn":{"time":80.875,"note":101.000,"xyz":[-24.819,26.800,19.930]}},{"noteOn":{"time":80.900,"note":99.000,"xyz":[-1.143,25.200,-0.306]}},{"noteOn":{"time":80.945,"note":100.000,"xyz":[49.407,26.000,3.706]}},{"noteOn":{"time":81.060,"note":105.000,"xyz":[-6.757,30.000,-4.236]}},{"noteOn":{"time":81.085,"note":91.000,"xyz":[-31.263,18.800,1.730]}},{"noteOn":{"time":81.225,"note":99.000,"xyz":[25.386,25.200,-35.904]}},{"noteOn":{"time":81.230,"note":105.000,"xyz":[-4.927,30.000,44.739]}},{"noteOn":{"time":81.340,"note":95.000,"xyz":[30.829,22.000,-1.844]}},{"noteOn":{"time":81.345,"note":99.000,"xyz":[5.587,25.200,9.207]}},{"noteOn":{"time":81.425,"note":101.000,"xyz":[-4.237,26.800,-4.412]}},{"noteOn":{"time":81.635,"note":99.000,"xyz":[35.159,25.200,0.279]}},{"noteOn":{"time":81.635,"note":107.000,"xyz":[4.130,31.600,-1.186]}},{"noteOn":{"time":81.665,"note":93.000,"xyz":[9.788,20.400,22.934]}},{"noteOn":{"time":81.680,"note":103.000,"xyz":[5.031,28.400,-31.533]}},{"noteOn":{"time":81.735,"note":109.000,"xyz":[-8.983,33.200,14.888]}},{"noteOn":{"time":81.910,"note":98.000,"xyz":[1.654,24.400,-4.028]}},{"noteOn":{"time":82.100,"note":102.000,"xyz":[-35.186,27.600,-0.371]}},{"noteOn":{"time":82.120,"note":96.000,"xyz":[-27.361,22.800,-1.120]}},{"noteOn":{"time":82.180,"note":97.000,"xyz":[1.574,23.600,-4.301]}},{"noteOn":{"time":82.235,"note":93.000,"xyz":[23.078,20.400,-8.945]}},{"noteOn":{"time":82.260,"note":103.000,"xyz":[-16.868,28.400,22.512]}},{"noteOn":{"time":82.365,"note":99.000,"xyz":[2.004,25.200,4.368]}},{"noteOn":{"time":82.410,"note":94.000,"xyz":[7.680,21.200,-4.879]}},{"noteOn":{"time":82.420,"note":101.000,"xyz":[-12.862,26.800,-3.851]}},{"noteOn":{"time":82.430,"note":97.000,"xyz":[-38.616,23.600,24.101]}},{"noteOn":{"time":82.620,"note":107.000,"xyz":[10.489,31.600,-19.910]}},{"noteOn":{"time":82.725,"note":98.000,"xyz":[-24.089,24.400,-14.884]}},{"noteOn":{"time":82.740,"note":98.000,"xyz":[27.098,24.400,-27.764]}},{"noteOn":{"time":82.790,"note":98.000,"xyz":[-24.520,24.400,-8.805]}},{"noteOn":{"time":82.960,"note":99.000,"xyz":[-8.529,25.200,-45.660]}},{"noteOn":{"time":82.980,"note":100.000,"xyz":[36.032,26.000,1.802]}},{"noteOn":{"time":83.015,"note":99.000,"xyz":[-6.421,25.200,9.033]}},{"noteOn":{"time":83.200,"note":105.000,"xyz":[-43.975,30.000,-2.113]}},{"noteOn":{"time":83.225,"note":91.000,"xyz":[-9.177,18.800,7.529]}},{"noteOn":{"time":83.245,"note":95.000,"xyz":[14.740,22.000,-11.779]}},{"noteOn":{"time":83.275,"note":91.000,"xyz":[5.088,18.800,11.130]}},{"noteOn":{"time":83.500,"note":100.000,"xyz":[24.112,26.000,-15.208]}},{"noteOn":{"time":83.530,"note":104.000,"xyz":[8.587,29.200,26.823]}},{"noteOn":{"time":83.585,"note":98.000,"xyz":[35.883,24.400,-12.432]}},{"noteOn":{"time":83.625,"note":92.000,"xyz":[-19.444,19.600,8.591]}},{"noteOn":{"time":83.640,"note":100.000,"xyz":[-35.959,26.000,4.854]}},{"noteOn":{"time":83.735,"note":104.000,"xyz":[-0.265,29.200,1.586]}},{"noteOn":{"time":83.800,"note":100.000,"xyz":[-3.116,26.000,-12.147]}},{"noteOn":{"time":83.875,"note":105.000,"xyz":[-18.589,30.000,38.464]}},{"noteOn":{"time":83.890,"note":107.000,"xyz":[-2.219,31.600,-3.080]}},{"noteOn":{"time":83.990,"note":95.000,"xyz":[-35.029,22.000,20.369]}},{"noteOn":{"time":84.185,"note":93.000,"xyz":[-36.995,20.400,-11.478]}},{"noteOn":{"time":84.220,"note":90.000,"xyz":[12.546,18.000,10.960]}},{"noteOn":{"time":84.230,"note":106.000,"xyz":[-5.502,30.800,-42.704]}},{"noteOn":{"time":84.295,"note":92.000,"xyz":[13.057,19.600,-46.543]}},{"noteOn":{"time":84.310,"note":96.000,"xyz":[38.472,22.800,-15.577]}},{"noteOn":{"time":84.370,"note":100.000,"xyz":[-15.905,26.000,25.721]}},{"noteOn":{"time":84.450,"note":102.000,"xyz":[-3.697,27.600,-43.753]}},{"noteOn":{"time":84.470,"note":98.000,"xyz":[-16.242,24.400,-0.088]}},{"noteOn":{"time":84.490,"note":107.000,"xyz":[-12.355,31.600,-2.821]}},{"noteOn":{"time":84.640,"note":98.000,"xyz":[-18.492,24.400,2.123]}},{"noteOn":{"time":84.640,"note":102.000,"xyz":[11.022,27.600,39.525]}},{"noteOn":{"time":84.740,"note":100.000,"xyz":[2.135,26.000,13.184]}},{"noteOn":{"time":84.915,"note":93.000,"xyz":[-20.191,20.400,38.209]}},{"noteOn":{"time":84.915,"note":92.000,"xyz":[-0.447,19.600,-22.702]}},{"noteOn":{"time":85.125,"note":100.000,"xyz":[-20.230,26.000,42.175]}},{"noteOn":{"time":85.140,"note":100.000,"xyz":[14.317,26.000,16.121]}},{"noteOn":{"time":85.210,"note":94.000,"xyz":[2.026,21.200,15.127]}},{"noteOn":{"time":85.240,"note":94.000,"xyz":[-3.727,21.200,-39.898]}},{"noteOn":{"time":85.325,"note":102.000,"xyz":[14.998,27.600,41.413]}},{"noteOn":{"time":85.360,"note":100.000,"xyz":[22.912,26.000,-11.056]}},{"noteOn":{"time":85.435,"note":102.000,"xyz":[-14.105,27.600,-11.639]}},{"noteOn":{"time":85.445,"note":99.000,"xyz":[-0.266,25.200,1.741]}},{"noteOn":{"time":85.460,"note":98.000,"xyz":[-2.756,24.400,-19.086]}},{"noteOn":{"time":85.470,"note":90.000,"xyz":[22.215,18.000,-4.107]}},{"noteOn":{"time":85.615,"note":106.000,"xyz":[-22.030,30.800,-23.173]}},{"noteOn":{"time":85.720,"note":98.000,"xyz":[33.037,24.400,-27.002]}},{"noteOn":{"time":85.790,"note":98.000,"xyz":[18.067,24.400,41.835]}},{"noteOn":{"time":85.865,"note":96.000,"xyz":[14.589,22.800,-45.343]}},{"noteOn":{"time":85.935,"note":104.000,"xyz":[37.333,29.200,1.410]}},{"noteOn":{"time":86.025,"note":102.000,"xyz":[-7.866,27.600,5.081]}},{"noteOn":{"time":86.095,"note":100.000,"xyz":[44.717,26.000,-16.475]}},{"noteOn":{"time":86.195,"note":92.000,"xyz":[-2.107,19.600,0.081]}},{"noteOn":{"time":86.260,"note":108.000,"xyz":[-0.038,32.400,4.869]}},{"noteOn":{"time":86.390,"note":108.000,"xyz":[40.463,32.400,9.841]}},{"noteOn":{"time":86.390,"note":97.000,"xyz":[6.887,23.600,-42.017]}},{"noteOn":{"time":86.395,"note":104.000,"xyz":[9.874,29.200,1.096]}},{"noteOn":{"time":86.585,"note":104.000,"xyz":[25.007,29.200,-25.881]}},{"noteOn":{"time":86.630,"note":96.000,"xyz":[5.739,22.800,3.451]}},{"noteOn":{"time":86.805,"note":92.000,"xyz":[-23.871,19.600,-17.799]}},{"noteOn":{"time":86.830,"note":100.000,"xyz":[18.153,26.000,8.404]}},{"noteOn":{"time":86.885,"note":94.000,"xyz":[-28.515,21.200,-7.303]}},{"noteOn":{"time":86.895,"note":102.000,"xyz":[-12.351,27.600,-3.116]}},{"noteOn":{"time":86.905,"note":98.000,"xyz":[-7.150,24.400,3.903]}},{"noteOn":{"time":86.995,"note":96.000,"xyz":[-32.670,22.800,-20.073]}},{"noteOn":{"time":87.025,"note":98.000,"xyz":[21.367,24.400,-39.056]}},{"noteOn":{"time":87.220,"note":99.000,"xyz":[1.846,25.200,-1.046]}},{"noteOn":{"time":87.250,"note":99.000,"xyz":[45.991,25.200,-18.738]}},{"noteOn":{"time":87.250,"note":106.000,"xyz":[14.419,30.800,35.718]}},{"noteOn":{"time":87.400,"note":100.000,"xyz":[3.173,26.000,2.062]}},{"noteOn":{"time":87.525,"note":106.000,"xyz":[1.196,30.800,-7.859]}},{"noteOn":{"time":87.555,"note":98.000,"xyz":[7.039,24.400,36.053]}},{"noteOn":{"time":87.620,"note":98.000,"xyz":[9.312,24.400,38.788]}},{"noteOn":{"time":87.640,"note":100.000,"xyz":[15.740,26.000,-4.726]}},{"noteOn":{"time":87.650,"note":96.000,"xyz":[-10.798,22.800,16.372]}},{"noteOn":{"time":87.775,"note":90.000,"xyz":[7.283,18.000,-35.352]}},{"noteOn":{"time":87.895,"note":92.000,"xyz":[-11.831,19.600,11.843]}},{"noteOn":{"time":87.905,"note":104.000,"xyz":[-9.088,29.200,22.100]}},{"noteOn":{"time":87.980,"note":101.000,"xyz":[9.732,26.800,-24.095]}},{"noteOn":{"time":88.060,"note":97.000,"xyz":[16.872,23.600,28.797]}},{"noteOn":{"time":88.135,"note":91.000,"xyz":[3.007,18.800,8.103]}},{"noteOn":{"time":88.145,"note":104.000,"xyz":[24.157,29.200,-16.659]}},{"noteOn":{"time":88.300,"note":108.000,"xyz":[11.319,32.400,4.204]}},{"noteOn":{"time":88.395,"note":100.000,"xyz":[-6.439,26.000,9.310]}},{"noteOn":{"time":88.435,"note":96.000,"xyz":[-6.178,22.800,0.598]}},{"noteOn":{"time":88.435,"note":104.000,"xyz":[15.663,29.200,-2.430]}},{"noteOn":{"time":88.465,"note":107.000,"xyz":[-21.882,31.600,21.269]}},{"noteOn":{"time":88.610,"note":101.000,"xyz":[-29.809,26.800,16.381]}},{"noteOn":{"time":88.720,"note":91.000,"xyz":[17.131,18.800,8.114]}},{"noteOn":{"time":88.725,"note":94.000,"xyz":[-7.766,21.200,-10.197]}},{"noteOn":{"time":88.800,"note":91.000,"xyz":[4.751,18.800,22.010]}},{"noteOn":{"time":88.895,"note":101.000,"xyz":[-26.348,26.800,7.089]}},{"noteOn":{"time":89.020,"note":102.000,"xyz":[18.091,27.600,-6.695]}},{"noteOn":{"time":89.085,"note":106.000,"xyz":[31.453,30.800,-31.607]}},{"noteOn":{"time":89.105,"note":97.000,"xyz":[-12.423,23.600,-26.774]}},{"noteOn":{"time":89.170,"note":102.000,"xyz":[-23.953,27.600,-2.036]}},{"noteOn":{"time":89.205,"note":98.000,"xyz":[-12.724,24.400,-17.540]}},{"noteOn":{"time":89.230,"note":99.000,"xyz":[-9.692,25.200,7.143]}},{"noteOn":{"time":89.365,"note":95.000,"xyz":[-4.586,22.000,-8.743]}},{"noteOn":{"time":89.380,"note":92.000,"xyz":[-8.202,19.600,27.131]}},{"noteOn":{"time":89.395,"note":93.000,"xyz":[-42.738,20.400,-4.901]}},{"noteOn":{"time":89.635,"note":99.000,"xyz":[6.461,25.200,0.012]}},{"noteOn":{"time":89.770,"note":100.000,"xyz":[12.863,26.000,-23.240]}},{"noteOn":{"time":89.775,"note":107.000,"xyz":[4.276,31.600,-25.772]}},{"noteOn":{"time":89.805,"note":95.000,"xyz":[8.863,22.000,-0.165]}},{"noteOn":{"time":89.825,"note":99.000,"xyz":[-0.079,25.200,23.920]}},{"noteOn":{"time":89.885,"note":103.000,"xyz":[-7.642,28.400,-5.450]}},{"noteOn":{"time":89.905,"note":99.000,"xyz":[-5.578,25.200,-6.110]}},{"noteOn":{"time":89.905,"note":89.000,"xyz":[-3.046,17.200,47.776]}},{"noteOn":{"time":89.995,"note":103.000,"xyz":[-41.456,28.400,-24.645]}},{"noteOn":{"time":90.205,"note":99.000,"xyz":[12.589,25.200,-11.223]}},{"noteOn":{"time":90.220,"note":97.000,"xyz":[4.715,23.600,4.439]}},{"noteOn":{"time":90.345,"note":93.000,"xyz":[13.897,20.400,-47.939]}},{"noteOn":{"time":90.350,"note":97.000,"xyz":[8.429,23.600,-16.299]}},{"noteOn":{"time":90.410,"note":97.000,"xyz":[18.047,23.600,10.804]}},{"noteOn":{"time":90.615,"note":99.000,"xyz":[15.578,25.200,25.410]}},{"noteOn":{"time":90.620,"note":102.000,"xyz":[-37.596,27.600,1.978]}},{"noteOn":{"time":90.645,"note":109.000,"xyz":[16.913,33.200,-15.003]}},{"noteOn":{"time":90.695,"note":93.000,"xyz":[20.750,20.400,13.973]}},{"noteOn":{"time":90.830,"note":96.000,"xyz":[-10.949,22.800,10.678]}},{"noteOn":{"time":90.885,"note":105.000,"xyz":[42.687,30.000,-17.340]}},{"noteOn":{"time":91.020,"note":107.000,"xyz":[-31.314,31.600,-10.433]}},{"noteOn":{"time":91.025,"note":105.000,"xyz":[21.071,30.000,-24.081]}},{"noteOn":{"time":91.130,"note":103.000,"xyz":[-12.837,28.400,25.496]}},{"noteOn":{"time":91.140,"note":97.000,"xyz":[-2.704,23.600,-0.157]}},{"noteOn":{"time":91.240,"note":99.000,"xyz":[8.090,25.200,23.449]}},{"noteOn":{"time":91.335,"note":95.000,"xyz":[-1.709,22.000,-1.367]}},{"noteOn":{"time":91.395,"note":91.000,"xyz":[11.397,18.800,-14.774]}},{"noteOn":{"time":91.440,"note":95.000,"xyz":[-11.808,22.000,-1.492]}},{"noteOn":{"time":91.500,"note":97.000,"xyz":[12.247,23.600,-23.588]}},{"noteOn":{"time":91.630,"note":99.000,"xyz":[-0.113,25.200,-11.722]}},{"noteOn":{"time":91.630,"note":105.000,"xyz":[-13.902,30.000,-16.422]}},{"noteOn":{"time":91.665,"note":100.000,"xyz":[-6.458,26.000,1.266]}},{"noteOn":{"time":91.720,"note":99.000,"xyz":[-33.995,25.200,36.076]}},{"noteOn":{"time":91.845,"note":105.000,"xyz":[-16.891,30.000,26.836]}},{"noteOn":{"time":91.875,"note":99.000,"xyz":[18.865,25.200,0.329]}},{"noteOn":{"time":91.945,"note":97.000,"xyz":[0.027,23.600,2.264]}},{"noteOn":{"time":92.085,"note":101.000,"xyz":[-15.632,26.800,-29.830]}},{"noteOn":{"time":92.150,"note":97.000,"xyz":[19.880,23.600,-14.718]}},{"noteOn":{"time":92.230,"note":105.000,"xyz":[-43.984,30.000,-15.914]}},{"noteOn":{"time":92.235,"note":101.000,"xyz":[48.205,26.800,-10.579]}},{"noteOn":{"time":92.320,"note":89.000,"xyz":[-12.030,17.200,-40.860]}},{"noteOn":{"time":92.420,"note":102.000,"xyz":[-1.130,27.600,-1.162]}},{"noteOn":{"time":92.435,"note":93.000,"xyz":[4.830,20.400,14.172]}},{"noteOn":{"time":92.590,"note":97.000,"xyz":[-9.734,23.600,-11.446]}},{"noteOn":{"time":92.645,"note":91.000,"xyz":[6.461,18.800,20.400]}},{"noteOn":{"time":92.710,"note":107.000,"xyz":[-7.852,31.600,-6.300]}},{"noteOn":{"time":92.810,"note":97.000,"xyz":[-3.475,23.600,-1.664]}},{"noteOn":{"time":92.885,"note":103.000,"xyz":[4.351,28.400,-44.770]}},{"noteOn":{"time":92.895,"note":99.000,"xyz":[-7.568,25.200,-2.411]}},{"noteOn":{"time":92.960,"note":103.000,"xyz":[13.632,28.400,7.395]}},{"noteOn":{"time":92.990,"note":99.000,"xyz":[8.121,25.200,1.382]}},{"noteOn":{"time":93.045,"note":107.000,"xyz":[33.309,31.600,-25.074]}},{"noteOn":{"time":93.190,"note":95.000,"xyz":[-4.749,22.000,-9.885]}},{"noteOn":{"time":93.220,"note":92.000,"xyz":[13.472,19.600,14.221]}},{"noteOn":{"time":93.255,"note":92.000,"xyz":[-26.663,19.600,10.393]}},{"noteOn":{"time":93.485,"note":102.000,"xyz":[-13.970,27.600,-19.031]}},{"noteOn":{"time":93.615,"note":101.000,"xyz":[13.470,26.800,-25.458]}},{"noteOn":{"time":93.685,"note":105.000,"xyz":[18.222,30.000,39.972]}},{"noteOn":{"time":93.700,"note":99.000,"xyz":[2.690,25.200,-0.351]}},{"noteOn":{"time":93.745,"note":97.000,"xyz":[-23.670,23.600,-2.609]}},{"noteOn":{"time":93.765,"note":91.000,"xyz":[32.218,18.800,-2.354]}},{"noteOn":{"time":93.770,"note":101.000,"xyz":[29.295,26.800,8.080]}},{"noteOn":{"time":93.820,"note":101.000,"xyz":[35.571,26.800,1.378]}},{"noteOn":{"time":93.835,"note":94.000,"xyz":[-13.803,21.200,22.069]}},{"noteOn":{"time":94.025,"note":99.000,"xyz":[6.174,25.200,38.702]}},{"noteOn":{"time":94.150,"note":98.000,"xyz":[-2.887,24.400,-3.218]}},{"noteOn":{"time":94.150,"note":107.000,"xyz":[24.351,31.600,20.640]}},{"noteOn":{"time":94.190,"note":101.000,"xyz":[-28.316,26.800,32.721]}},{"noteOn":{"time":94.345,"note":98.000,"xyz":[-8.011,24.400,14.632]}},{"noteOn":{"time":94.370,"note":89.000,"xyz":[1.334,17.200,0.250]}},{"noteOn":{"time":94.395,"note":111.000,"xyz":[37.644,34.800,9.006]}},{"noteOn":{"time":94.400,"note":95.000,"xyz":[35.926,22.000,-24.502]}},{"noteOn":{"time":94.415,"note":104.000,"xyz":[11.239,29.200,6.617]}},{"noteOn":{"time":94.440,"note":99.000,"xyz":[-0.684,25.200,0.977]}},{"noteOn":{"time":94.445,"note":103.000,"xyz":[10.098,28.400,-3.726]}},{"noteOn":{"time":94.665,"note":94.000,"xyz":[24.676,21.200,-22.499]}},{"noteOn":{"time":94.720,"note":96.000,"xyz":[10.130,22.800,-16.694]}},{"noteOn":{"time":94.800,"note":100.000,"xyz":[6.992,26.000,14.680]}},{"noteOn":{"time":94.925,"note":108.000,"xyz":[-19.839,32.400,18.356]}},{"noteOn":{"time":94.960,"note":98.000,"xyz":[-4.762,24.400,-17.184]}},{"noteOn":{"time":95.035,"note":97.000,"xyz":[-26.623,23.600,-22.042]}},{"noteOn":{"time":95.065,"note":108.000,"xyz":[-17.545,32.400,5.602]}},{"noteOn":{"time":95.155,"note":103.000,"xyz":[-41.030,28.400,-18.195]}},{"noteOn":{"time":95.155,"note":99.000,"xyz":[-4.518,25.200,36.021]}},{"noteOn":{"time":95.175,"note":94.000,"xyz":[5.648,21.200,1.022]}},{"noteOn":{"time":95.175,"note":105.000,"xyz":[12.519,30.000,9.262]}},{"noteOn":{"time":95.250,"note":96.000,"xyz":[-32.679,22.800,-31.052]}},{"noteOn":{"time":95.365,"note":106.000,"xyz":[-14.218,30.800,26.782]}},{"noteOn":{"time":95.560,"note":94.000,"xyz":[14.283,21.200,-13.901]}},{"noteOn":{"time":95.590,"note":106.000,"xyz":[-32.873,30.800,11.930]}},{"noteOn":{"time":95.600,"note":104.000,"xyz":[31.628,29.200,17.526]}},{"noteOn":{"time":95.655,"note":98.000,"xyz":[7.087,24.400,-5.485]}},{"noteOn":{"time":95.725,"note":99.000,"xyz":[41.613,25.200,8.328]}},{"noteOn":{"time":95.755,"note":96.000,"xyz":[0.065,22.800,14.453]}},{"noteOn":{"time":95.865,"note":100.000,"xyz":[5.092,26.000,-12.071]}},{"noteOn":{"time":95.890,"note":96.000,"xyz":[22.340,22.800,5.526]}},{"noteOn":{"time":95.935,"note":90.000,"xyz":[13.705,18.000,1.648]}},{"noteOn":{"time":96.010,"note":104.000,"xyz":[-20.891,29.200,18.054]}},{"noteOn":{"time":96.065,"note":101.000,"xyz":[-3.354,26.800,-2.928]}},{"noteOn":{"time":96.120,"note":96.000,"xyz":[8.698,22.800,10.189]}},{"noteOn":{"time":96.220,"note":100.000,"xyz":[-7.271,26.000,12.112]}},{"noteOn":{"time":96.220,"note":106.000,"xyz":[-21.915,30.800,15.014]}},{"noteOn":{"time":96.290,"note":104.000,"xyz":[14.970,29.200,-4.820]}},{"noteOn":{"time":96.350,"note":98.000,"xyz":[12.162,24.400,10.846]}},{"noteOn":{"time":96.430,"note":102.000,"xyz":[1.656,27.600,32.537]}},{"noteOn":{"time":96.540,"note":98.000,"xyz":[-27.286,24.400,13.516]}},{"noteOn":{"time":96.625,"note":96.000,"xyz":[-18.856,22.800,-34.898]}},{"noteOn":{"time":96.690,"note":102.000,"xyz":[42.967,27.600,-19.284]}},{"noteOn":{"time":96.805,"note":102.000,"xyz":[17.076,27.600,-39.261]}},{"noteOn":{"time":96.815,"note":90.000,"xyz":[-8.238,18.000,15.277]}},{"noteOn":{"time":96.835,"note":103.000,"xyz":[-13.478,28.400,31.891]}},{"noteOn":{"time":96.865,"note":106.000,"xyz":[35.843,30.800,22.886]}},{"noteOn":{"time":96.980,"note":94.000,"xyz":[4.382,21.200,25.412]}},{"noteOn":{"time":97.120,"note":96.000,"xyz":[-21.865,22.800,40.598]}},{"noteOn":{"time":97.135,"note":98.000,"xyz":[-8.944,24.400,3.761]}},{"noteOn":{"time":97.155,"note":90.000,"xyz":[-24.578,18.000,14.689]}},{"noteOn":{"time":97.255,"note":106.000,"xyz":[0.780,30.800,11.204]}},{"noteOn":{"time":97.295,"note":100.000,"xyz":[-47.436,26.000,-8.844]}},{"noteOn":{"time":97.445,"note":102.000,"xyz":[-40.958,27.600,-26.463]}},{"noteOn":{"time":97.520,"note":100.000,"xyz":[18.192,26.000,44.196]}},{"noteOn":{"time":97.525,"note":98.000,"xyz":[-8.901,24.400,29.386]}},{"noteOn":{"time":97.635,"note":102.000,"xyz":[21.707,27.600,42.423]}},{"noteOn":{"time":97.655,"note":96.000,"xyz":[19.966,22.800,22.641]}},{"noteOn":{"time":97.695,"note":93.000,"xyz":[-6.141,20.400,14.846]}},{"noteOn":{"time":97.720,"note":92.000,"xyz":[-16.112,19.600,-42.429]}},{"noteOn":{"time":97.800,"note":108.000,"xyz":[-28.590,32.400,-23.393]}},{"noteOn":{"time":98.035,"note":110.000,"xyz":[8.003,34.000,-2.414]}},{"noteOn":{"time":98.070,"note":102.000,"xyz":[-27.244,27.600,22.694]}},{"noteOn":{"time":98.095,"note":104.000,"xyz":[-18.944,29.200,1.112]}},{"noteOn":{"time":98.125,"note":100.000,"xyz":[1.054,26.000,1.151]}},{"noteOn":{"time":98.160,"note":90.000,"xyz":[18.023,18.000,10.735]}},{"noteOn":{"time":98.195,"note":100.000,"xyz":[-28.532,26.000,15.741]}},{"noteOn":{"time":98.200,"note":100.000,"xyz":[-5.804,26.000,-3.810]}},{"noteOn":{"time":98.250,"note":95.000,"xyz":[-33.423,22.000,-35.463]}},{"noteOn":{"time":98.330,"note":96.000,"xyz":[-20.388,22.800,-14.265]}},{"noteOn":{"time":98.410,"note":100.000,"xyz":[39.015,26.000,0.019]}},{"noteOn":{"time":98.530,"note":98.000,"xyz":[-33.569,24.400,-22.344]}},{"noteOn":{"time":98.660,"note":97.000,"xyz":[-0.986,23.600,-3.974]}},{"noteOn":{"time":98.785,"note":97.000,"xyz":[-6.479,23.600,0.480]}},{"noteOn":{"time":98.790,"note":102.000,"xyz":[41.402,27.600,12.975]}},{"noteOn":{"time":98.845,"note":88.000,"xyz":[30.121,16.400,25.928]}},{"noteOn":{"time":98.850,"note":108.000,"xyz":[-28.802,32.400,11.798]}},{"noteOn":{"time":98.885,"note":108.000,"xyz":[11.549,32.400,-19.674]}},{"noteOn":{"time":98.930,"note":104.000,"xyz":[20.629,29.200,4.503]}},{"noteOn":{"time":98.935,"note":96.000,"xyz":[-6.104,22.800,7.355]}},{"noteOn":{"time":98.945,"note":104.000,"xyz":[-12.540,29.200,17.616]}},{"noteOn":{"time":98.990,"note":98.000,"xyz":[15.895,24.400,30.877]}},{"noteOn":{"time":99.035,"note":102.000,"xyz":[7.571,27.600,2.718]}},{"noteOn":{"time":99.050,"note":100.000,"xyz":[-19.927,26.000,5.128]}},{"noteOn":{"time":99.220,"note":95.000,"xyz":[22.781,22.000,29.812]}},{"noteOn":{"time":99.455,"note":98.000,"xyz":[-37.194,24.400,24.996]}},{"noteOn":{"time":99.465,"note":105.000,"xyz":[-5.230,30.000,-18.670]}},{"noteOn":{"time":99.505,"note":106.000,"xyz":[21.071,30.800,-15.834]}},{"noteOn":{"time":99.565,"note":104.000,"xyz":[1.086,29.200,28.468]}},{"noteOn":{"time":99.580,"note":108.000,"xyz":[9.757,32.400,8.181]}},{"noteOn":{"time":99.650,"note":95.000,"xyz":[2.278,22.000,-4.833]}},{"noteOn":{"time":99.665,"note":95.000,"xyz":[24.245,22.000,-1.812]}},{"noteOn":{"time":99.705,"note":96.000,"xyz":[-0.905,22.800,1.434]}},{"noteOn":{"time":99.705,"note":98.000,"xyz":[-7.001,24.400,22.422]}},{"noteOn":{"time":99.740,"note":106.000,"xyz":[9.054,30.800,-22.765]}},{"noteOn":{"time":99.965,"note":94.000,"xyz":[-41.242,21.200,14.697]}},{"noteOn":{"time":100.155,"note":100.000,"xyz":[-13.487,26.000,3.351]}},{"noteOn":{"time":100.160,"note":99.000,"xyz":[-45.506,25.200,-5.468]}},{"noteOn":{"time":100.175,"note":97.000,"xyz":[2.341,23.600,18.270]}},{"noteOn":{"time":100.275,"note":106.000,"xyz":[9.149,30.800,-13.024]}},{"noteOn":{"time":100.325,"note":98.000,"xyz":[-31.320,24.400,6.439]}},{"noteOn":{"time":100.370,"note":96.000,"xyz":[-8.278,22.800,-0.261]}},{"noteOn":{"time":100.375,"note":107.000,"xyz":[-2.350,31.600,-1.879]}},{"noteOn":{"time":100.380,"note":89.000,"xyz":[2.751,17.200,-16.542]}},{"noteOn":{"time":100.455,"note":101.000,"xyz":[6.941,26.800,-0.557]}},{"noteOn":{"time":100.640,"note":103.000,"xyz":[-31.336,28.400,-24.505]}},{"noteOn":{"time":100.665,"note":96.000,"xyz":[-21.575,22.800,-42.359]}},{"noteOn":{"time":100.715,"note":101.000,"xyz":[26.417,26.800,29.169]}},{"noteOn":{"time":100.770,"note":94.000,"xyz":[11.686,21.200,-1.643]}},{"noteOn":{"time":100.825,"note":97.000,"xyz":[-11.015,23.600,22.234]}},{"noteOn":{"time":100.850,"note":103.000,"xyz":[-28.369,28.400,-15.594]}},{"noteOn":{"time":101.035,"note":96.000,"xyz":[-0.711,22.800,8.221]}},{"noteOn":{"time":101.080,"note":101.000,"xyz":[-5.122,26.800,-1.841]}},{"noteOn":{"time":101.110,"note":103.000,"xyz":[7.081,28.400,4.928]}},{"noteOn":{"time":101.180,"note":99.000,"xyz":[1.766,25.200,3.464]}},{"noteOn":{"time":101.215,"note":91.000,"xyz":[-0.488,18.800,-2.248]}},{"noteOn":{"time":101.250,"note":103.000,"xyz":[1.376,28.400,3.023]}},{"noteOn":{"time":101.445,"note":95.000,"xyz":[40.840,22.000,26.652]}},{"noteOn":{"time":101.530,"note":107.000,"xyz":[35.834,31.600,-25.587]}},{"noteOn":{"time":101.575,"note":99.000,"xyz":[-15.324,25.200,-9.073]}},{"noteOn":{"time":101.650,"note":95.000,"xyz":[13.077,22.000,13.487]}},{"noteOn":{"time":101.665,"note":91.000,"xyz":[-9.404,18.800,-12.813]}},{"noteOn":{"time":101.730,"note":101.000,"xyz":[-23.107,26.800,0.584]}},{"noteOn":{"time":101.855,"note":106.000,"xyz":[8.866,30.800,21.501]}},{"noteOn":{"time":101.930,"note":101.000,"xyz":[2.360,26.800,-3.094]}},{"noteOn":{"time":101.945,"note":101.000,"xyz":[16.872,26.800,26.494]}},{"noteOn":{"time":101.970,"note":97.000,"xyz":[22.806,23.600,-25.610]}},{"noteOn":{"time":102.040,"note":97.000,"xyz":[-0.163,23.600,-13.821]}},{"noteOn":{"time":102.075,"note":99.000,"xyz":[20.727,25.200,31.100]}},{"noteOn":{"time":102.135,"note":94.000,"xyz":[-20.523,21.200,21.811]}},{"noteOn":{"time":102.215,"note":109.000,"xyz":[-28.058,33.200,-16.913]}},{"noteOn":{"time":102.215,"note":93.000,"xyz":[0.634,20.400,25.203]}},{"noteOn":{"time":102.445,"note":101.000,"xyz":[-49.343,26.800,4.051]}},{"noteOn":{"time":102.510,"note":99.000,"xyz":[-6.410,25.200,-43.028]}},{"noteOn":{"time":102.510,"note":103.000,"xyz":[0.886,28.400,14.383]}},{"noteOn":{"time":102.625,"note":89.000,"xyz":[18.532,17.200,10.910]}},{"noteOn":{"time":102.650,"note":103.000,"xyz":[18.162,28.400,13.312]}},{"noteOn":{"time":102.665,"note":96.000,"xyz":[16.140,22.800,-34.126]}},{"noteOn":{"time":102.730,"note":99.000,"xyz":[-13.920,25.200,-41.449]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[11.389,25.200,41.184]}},{"noteOn":{"time":102.740,"note":99.000,"xyz":[6.659,25.200,1.305]}},{"noteOn":{"time":102.820,"note":95.000,"xyz":[-2.441,22.000,0.407]}},{"noteOn":{"time":102.880,"note":109.000,"xyz":[-33.677,33.200,31.937]}},{"noteOn":{"time":103.165,"note":97.000,"xyz":[1.074,23.600,5.875]}},{"noteOn":{"time":103.225,"note":96.000,"xyz":[-12.338,22.800,25.938]}},{"noteOn":{"time":103.375,"note":105.000,"xyz":[28.589,30.000,22.519]}},{"noteOn":{"time":103.385,"note":97.000,"xyz":[-36.360,23.600,8.098]}},{"noteOn":{"time":103.385,"note":89.000,"xyz":[-11.525,17.200,-9.396]}},{"noteOn":{"time":103.390,"note":103.000,"xyz":[25.413,28.400,-27.032]}},{"noteOn":{"time":103.430,"note":97.000,"xyz":[12.818,23.600,3.333]}},{"noteOn":{"time":103.475,"note":103.000,"xyz":[-15.757,28.400,-4.477]}},{"noteOn":{"time":103.475,"note":101.000,"xyz":[-9.695,26.800,3.942]}},{"noteOn":{"time":103.495,"note":101.000,"xyz":[-28.800,26.800,5.474]}},{"noteOn":{"time":103.640,"note":109.000,"xyz":[-7.656,33.200,31.022]}},{"noteOn":{"time":103.715,"note":95.000,"xyz":[23.611,22.000,-40.291]}},{"noteOn":{"time":103.780,"note":107.000,"xyz":[-15.628,31.600,-38.550]}},{"noteOn":{"time":103.910,"note":99.000,"xyz":[20.535,25.200,1.366]}},{"noteOn":{"time":103.950,"note":107.000,"xyz":[-14.152,31.600,-25.579]}},{"noteOn":{"time":103.975,"note":105.000,"xyz":[-11.194,30.000,-37.156]}},{"noteOn":{"time":104.080,"note":94.000,"xyz":[7.278,21.200,33.244]}},{"noteOn":{"time":104.125,"note":95.000,"xyz":[-18.875,22.000,-12.581]}},{"noteOn":{"time":104.165,"note":107.000,"xyz":[-31.267,31.600,12.953]}},{"noteOn":{"time":104.245,"note":103.000,"xyz":[25.535,28.400,2.071]}},{"noteOn":{"time":104.265,"note":95.000,"xyz":[-20.587,22.000,-13.060]}},{"noteOn":{"time":104.325,"note":97.000,"xyz":[26.889,23.600,6.359]}},{"noteOn":{"time":104.420,"note":105.000,"xyz":[-18.165,30.000,-11.209]}},{"noteOn":{"time":104.655,"note":98.000,"xyz":[6.115,24.400,-38.511]}},{"noteOn":{"time":104.670,"note":100.000,"xyz":[-33.847,26.000,-1.735]}},{"noteOn":{"time":104.680,"note":105.000,"xyz":[-17.139,30.000,-16.601]}},{"noteOn":{"time":104.795,"note":89.000,"xyz":[11.148,17.200,25.068]}},{"noteOn":{"time":104.810,"note":101.000,"xyz":[-36.340,26.800,-12.716]}},{"noteOn":{"time":104.855,"note":102.000,"xyz":[-25.656,27.600,-23.112]}},{"noteOn":{"time":104.920,"note":97.000,"xyz":[-11.425,23.600,45.989]}},{"noteOn":{"time":104.935,"note":97.000,"xyz":[-3.840,23.600,-18.417]}},{"noteOn":{"time":104.955,"note":105.000,"xyz":[-29.962,30.000,7.477]}},{"noteOn":{"time":105.205,"note":95.000,"xyz":[14.439,22.000,-9.219]}},{"noteOn":{"time":105.215,"note":102.000,"xyz":[4.931,27.600,1.691]}},{"noteOn":{"time":105.230,"note":93.000,"xyz":[14.677,20.400,18.394]}},{"noteOn":{"time":105.270,"note":103.000,"xyz":[-0.546,28.400,-1.517]}},{"noteOn":{"time":105.360,"note":96.000,"xyz":[15.898,22.800,3.225]}},{"noteOn":{"time":105.445,"note":97.000,"xyz":[15.467,23.600,-23.755]}},{"noteOn":{"time":105.485,"note":107.000,"xyz":[-16.797,31.600,30.970]}},{"noteOn":{"time":105.500,"note":103.000,"xyz":[-34.946,28.400,5.900]}},{"noteOn":{"time":105.545,"note":103.000,"xyz":[-23.908,28.400,-10.614]}},{"noteOn":{"time":105.585,"note":91.000,"xyz":[46.931,18.800,5.829]}},{"noteOn":{"time":105.670,"note":102.000,"xyz":[-20.880,27.600,-26.715]}},{"noteOn":{"time":105.895,"note":99.000,"xyz":[-38.217,25.200,25.112]}},{"noteOn":{"time":105.905,"note":95.000,"xyz":[18.069,22.000,19.565]}},{"noteOn":{"time":105.910,"note":108.000,"xyz":[-30.113,32.400,-3.615]}},{"noteOn":{"time":105.945,"note":95.000,"xyz":[16.181,22.000,-41.133]}},{"noteOn":{"time":106.105,"note":99.000,"xyz":[-4.754,25.200,17.223]}},{"noteOn":{"time":106.160,"note":100.000,"xyz":[-28.972,26.000,-31.114]}},{"noteOn":{"time":106.170,"note":92.000,"xyz":[9.335,19.600,-31.893]}},{"noteOn":{"time":106.240,"note":94.000,"xyz":[45.549,21.200,14.768]}},{"noteOn":{"time":106.385,"note":96.000,"xyz":[10.105,22.800,-4.044]}},{"noteOn":{"time":106.430,"note":97.000,"xyz":[-0.939,23.600,20.874]}},{"noteOn":{"time":106.445,"note":105.000,"xyz":[36.156,30.000,21.291]}},{"noteOn":{"time":106.480,"note":100.000,"xyz":[-5.415,26.000,-23.804]}},{"noteOn":{"time":106.480,"note":110.000,"xyz":[33.762,34.000,11.863]}},{"noteOn":{"time":106.490,"note":101.000,"xyz":[2.980,26.800,27.908]}},{"noteOn":{"time":106.570,"note":94.000,"xyz":[-10.601,21.200,23.471]}},{"noteOn":{"time":106.715,"note":94.000,"xyz":[6.022,21.200,17.071]}},{"noteOn":{"time":106.855,"note":102.000,"xyz":[-19.264,27.600,26.672]}},{"noteOn":{"time":106.900,"note":101.000,"xyz":[7.865,26.800,-17.285]}},{"noteOn":{"time":106.980,"note":103.000,"xyz":[-0.433,28.400,6.104]}},{"noteOn":{"time":107.030,"note":112.000,"xyz":[-16.068,35.600,10.884]}},{"noteOn":{"time":107.085,"note":97.000,"xyz":[-26.171,23.600,-28.740]}},{"noteOn":{"time":107.090,"note":88.000,"xyz":[-24.828,16.400,17.406]}},{"noteOn":{"time":107.145,"note":98.000,"xyz":[-0.842,24.400,-13.107]}},{"noteOn":{"time":107.155,"note":98.000,"xyz":[11.558,24.400,47.745]}},{"noteOn":{"time":107.185,"note":104.000,"xyz":[-20.519,29.200,23.566]}},{"noteOn":{"time":107.190,"note":100.000,"xyz":[-2.826,26.000,-16.396]}},{"noteOn":{"time":107.260,"note":100.000,"xyz":[-0.593,26.000,2.636]}},{"noteOn":{"time":107.275,"note":94.000,"xyz":[0.718,21.200,-3.419]}},{"noteOn":{"time":107.590,"note":98.000,"xyz":[27.084,24.400,5.707]}},{"noteOn":{"time":107.660,"note":95.000,"xyz":[-15.488,22.000,-21.309]}},{"noteOn":{"time":107.675,"note":96.000,"xyz":[-13.261,22.800,10.146]}},{"noteOn":{"time":107.750,"note":96.000,"xyz":[28.970,22.800,-5.885]}},{"noteOn":{"time":107.795,"note":98.000,"xyz":[1.997,24.400,-1.752]}},{"noteOn":{"time":107.865,"note":110.000,"xyz":[6.669,34.000,-34.441]}},{"noteOn":{"time":107.915,"note":103.000,"xyz":[41.752,28.400,-26.087]}},{"noteOn":{"time":107.930,"note":90.000,"xyz":[-9.847,18.000,-5.789]}},{"noteOn":{"time":107.935,"note":106.000,"xyz":[17.707,30.800,-30.781]}},{"noteOn":{"time":107.955,"note":102.000,"xyz":[15.525,27.600,19.636]}},{"noteOn":{"time":108.025,"note":108.000,"xyz":[2.302,32.400,44.991]}},{"noteOn":{"time":108.100,"note":108.000,"xyz":[-1.498,32.400,-45.215]}},{"noteOn":{"time":108.215,"note":94.000,"xyz":[16.012,21.200,-8.761]}},{"noteOn":{"time":108.250,"note":102.000,"xyz":[-1.948,27.600,2.534]}},{"noteOn":{"time":108.370,"note":100.000,"xyz":[-14.950,26.000,7.363]}},{"noteOn":{"time":108.500,"note":93.000,"xyz":[6.043,20.400,-4.120]}},{"noteOn":{"time":108.510,"note":106.000,"xyz":[-0.875,30.800,-3.649]}},{"noteOn":{"time":108.515,"note":102.000,"xyz":[-42.397,27.600,2.827]}},{"noteOn":{"time":108.545,"note":96.000,"xyz":[18.941,22.800,3.194]}},{"noteOn":{"time":108.670,"note":106.000,"xyz":[-12.623,30.800,3.094]}},{"noteOn":{"time":108.710,"note":94.000,"xyz":[-21.597,21.200,9.539]}},{"noteOn":{"time":108.710,"note":106.000,"xyz":[-13.787,30.800,46.311]}},{"noteOn":{"time":108.775,"note":106.000,"xyz":[-10.285,30.800,3.158]}},{"noteOn":{"time":108.810,"note":104.000,"xyz":[35.597,29.200,7.050]}},{"noteOn":{"time":108.910,"note":96.000,"xyz":[-33.774,22.800,-25.230]}},{"noteOn":{"time":109.055,"note":104.000,"xyz":[-29.532,29.200,23.456]}},{"noteOn":{"time":109.130,"note":98.000,"xyz":[-17.123,24.400,12.818]}},{"noteOn":{"time":109.175,"note":104.000,"xyz":[-48.428,29.200,4.656]}},{"noteOn":{"time":109.180,"note":100.000,"xyz":[-13.386,26.000,-3.910]}},{"noteOn":{"time":109.205,"note":90.000,"xyz":[26.078,18.000,34.023]}},{"noteOn":{"time":109.250,"note":103.000,"xyz":[28.438,28.400,17.990]}},{"noteOn":{"time":109.385,"note":96.000,"xyz":[-8.982,22.800,-1.830]}},{"noteOn":{"time":109.495,"note":98.000,"xyz":[36.883,24.400,-6.932]}},{"noteOn":{"time":109.520,"note":104.000,"xyz":[-3.597,29.200,2.431]}},{"noteOn":{"time":109.525,"note":106.000,"xyz":[26.192,30.800,-27.275]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[-3.097,27.600,28.753]}},{"noteOn":{"time":109.645,"note":102.000,"xyz":[39.837,27.600,5.442]}},{"noteOn":{"time":109.715,"note":101.000,"xyz":[-28.072,26.800,-27.670]}},{"noteOn":{"time":109.715,"note":94.000,"xyz":[-5.570,21.200,35.116]}},{"noteOn":{"time":109.750,"note":106.000,"xyz":[9.049,30.800,37.557]}},{"noteOn":{"time":109.890,"note":96.000,"xyz":[7.377,22.800,44.557]}},{"noteOn":{"time":109.950,"note":92.000,"xyz":[-24.663,19.600,-33.216]}},{"noteOn":{"time":110.045,"note":98.000,"xyz":[-33.049,24.400,12.206]}},{"noteOn":{"time":110.045,"note":108.000,"xyz":[-10.829,32.400,22.597]}},{"noteOn":{"time":110.070,"note":94.000,"xyz":[-29.383,21.200,-21.080]}},{"noteOn":{"time":110.085,"note":101.000,"xyz":[3.466,26.800,0.929]}},{"noteOn":{"time":110.155,"note":104.000,"xyz":[-13.470,29.200,1.225]}},{"noteOn":{"time":110.185,"note":102.000,"xyz":[18.917,27.600,36.028]}},{"noteOn":{"time":110.265,"note":108.000,"xyz":[3.344,32.400,-1.088]}},{"noteOn":{"time":110.335,"note":96.000,"xyz":[36.937,22.800,-13.627]}},{"noteOn":{"time":110.380,"note":100.000,"xyz":[-0.723,26.000,14.133]}},{"noteOn":{"time":110.580,"note":104.000,"xyz":[-9.457,29.200,-6.449]}},{"noteOn":{"time":110.685,"note":93.000,"xyz":[6.026,20.400,10.800]}},{"noteOn":{"time":110.700,"note":96.000,"xyz":[-5.123,22.800,7.858]}},{"noteOn":{"time":110.705,"note":100.000,"xyz":[-34.305,26.000,-18.382]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-37.564,26.000,13.368]}},{"noteOn":{"time":110.765,"note":100.000,"xyz":[-9.849,26.000,2.242]}},{"noteOn":{"time":110.795,"note":96.000,"xyz":[-31.647,22.800,17.702]}},{"noteOn":{"time":110.825,"note":93.000,"xyz":[8.666,20.400,-27.890]}},{"noteOn":{"time":110.850,"note":104.000,"xyz":[-13.238,29.200,14.951]}},{"noteOn":{"time":110.895,"note":98.000,"xyz":[7.239,24.400,31.332]}},{"noteOn":{"time":110.935,"note":100.000,"xyz":[44.582,26.000,-6.325]}},{"noteOn":{"time":111.010,"note":95.000,"xyz":[28.193,22.000,31.621]}},{"noteOn":{"time":111.090,"note":110.000,"xyz":[-16.921,34.000,-15.107]}},{"noteOn":{"time":111.215,"note":95.000,"xyz":[-20.594,22.000,-24.247]}},{"noteOn":{"time":111.295,"note":102.000,"xyz":[20.011,27.600,37.736]}},{"noteOn":{"time":111.330,"note":102.000,"xyz":[8.772,27.600,-23.103]}},{"noteOn":{"time":111.345,"note":101.000,"xyz":[13.467,26.800,24.754]}},{"noteOn":{"time":111.440,"note":98.000,"xyz":[-7.932,24.400,24.663]}},{"noteOn":{"time":111.525,"note":97.000,"xyz":[-23.130,23.600,12.460]}},{"noteOn":{"time":111.535,"note":98.000,"xyz":[-4.195,24.400,-4.212]}},{"noteOn":{"time":111.565,"note":100.000,"xyz":[-4.981,26.000,-13.389]}},{"noteOn":{"time":111.575,"note":102.000,"xyz":[25.639,27.600,33.695]}},{"noteOn":{"time":111.630,"note":88.000,"xyz":[-41.552,16.400,-13.663]}},{"noteOn":{"time":111.715,"note":103.000,"xyz":[22.429,28.400,34.730]}},{"noteOn":{"time":111.735,"note":93.000,"xyz":[-0.333,20.400,11.159]}},{"noteOn":{"time":111.900,"note":112.000,"xyz":[4.689,35.600,27.179]}},{"noteOn":{"time":111.970,"note":107.000,"xyz":[-44.217,31.600,20.791]}},{"noteOn":{"time":112.055,"note":101.000,"xyz":[-16.893,26.800,-15.151]}},{"noteOn":{"time":112.105,"note":96.000,"xyz":[11.574,22.800,-21.465]}},{"noteOn":{"time":112.120,"note":95.000,"xyz":[47.392,22.000,-4.517]}},{"noteOn":{"time":112.165,"note":98.000,"xyz":[-33.877,24.400,26.066]}},{"noteOn":{"time":112.190,"note":95.000,"xyz":[19.160,22.000,-14.313]}},{"noteOn":{"time":112.190,"note":107.000,"xyz":[-38.489,31.600,-29.889]}},{"noteOn":{"time":112.265,"note":99.000,"xyz":[-13.826,25.200,-23.325]}},{"noteOn":{"time":112.320,"note":104.000,"xyz":[-7.872,29.200,3.956]}},{"noteOn":{"time":112.385,"note":107.000,"xyz":[-31.922,31.600,-37.225]}},{"noteOn":{"time":112.410,"note":109.000,"xyz":[6.822,33.200,36.655]}},{"noteOn":{"time":112.430,"note":101.000,"xyz":[1.052,26.800,-7.369]}},{"noteOn":{"time":112.550,"note":91.000,"xyz":[-2.479,18.800,44.379]}},{"noteOn":{"time":112.645,"note":105.000,"xyz":[23.476,30.000,34.815]}},{"noteOn":{"time":112.715,"note":93.000,"xyz":[-33.233,20.400,-17.197]}},{"noteOn":{"time":112.815,"note":103.000,"xyz":[-7.907,28.400,44.886]}},{"noteOn":{"time":112.880,"note":101.000,"xyz":[-18.874,26.800,25.651]}},{"noteOn":{"time":112.935,"note":92.000,"xyz":[29.407,19.600,-25.838]}},{"noteOn":{"time":112.970,"note":97.000,"xyz":[23.905,23.600,18.853]}},{"noteOn":{"time":113.000,"note":102.000,"xyz":[-21.184,27.600,16.902]}},{"noteOn":{"time":113.030,"note":95.000,"xyz":[23.459,22.000,-42.154]}},{"noteOn":{"time":113.035,"note":105.000,"xyz":[12.409,30.000,26.033]}},{"noteOn":{"time":113.110,"note":106.000,"xyz":[-17.403,30.800,-16.664]}},{"noteOn":{"time":113.160,"note":105.000,"xyz":[8.992,30.000,1.585]}},{"noteOn":{"time":113.170,"note":107.000,"xyz":[22.136,31.600,-1.366]}},{"noteOn":{"time":113.270,"note":105.000,"xyz":[24.064,30.000,-25.236]}},{"noteOn":{"time":113.360,"note":103.000,"xyz":[0.184,28.400,-37.215]}},{"noteOn":{"time":113.455,"note":95.000,"xyz":[10.376,22.000,15.385]}},{"noteOn":{"time":113.575,"note":105.000,"xyz":[-43.343,30.000,7.338]}},{"noteOn":{"time":113.610,"note":99.000,"xyz":[-18.158,25.200,40.890]}},{"noteOn":{"time":113.665,"note":102.000,"xyz":[-42.524,27.600,-14.768]}},{"noteOn":{"time":113.675,"note":91.000,"xyz":[45.994,18.800,-7.499]}},{"noteOn":{"time":113.690,"note":101.000,"xyz":[18.095,26.800,-7.613]}},{"noteOn":{"time":113.775,"note":107.000,"xyz":[-4.708,31.600,7.802]}},{"noteOn":{"time":113.790,"note":97.000,"xyz":[-8.517,23.600,2.902]}},{"noteOn":{"time":113.940,"note":99.000,"xyz":[4.268,25.200,1.106]}},{"noteOn":{"time":113.945,"note":109.000,"xyz":[-0.569,33.200,11.737]}},{"noteOn":{"time":113.960,"note":103.000,"xyz":[-19.102,28.400,-39.420]}},{"noteOn":{"time":114.025,"note":101.000,"xyz":[10.970,26.800,16.288]}},{"noteOn":{"time":114.070,"note":103.000,"xyz":[-29.293,28.400,-9.745]}},{"noteOn":{"time":114.175,"note":93.000,"xyz":[-11.610,20.400,11.535]}},{"noteOn":{"time":114.215,"note":101.000,"xyz":[25.353,26.800,31.612]}},{"noteOn":{"time":114.375,"note":93.000,"xyz":[-6.818,20.400,-12.840]}},{"noteOn":{"time":114.380,"note":95.000,"xyz":[31.929,22.000,-24.838]}},{"noteOn":{"time":114.425,"note":95.000,"xyz":[3.287,22.000,4.423]}},{"noteOn":{"time":114.510,"note":99.000,"xyz":[34.478,25.200,-7.721]}},{"noteOn":{"time":114.525,"note":100.000,"xyz":[20.058,26.000,20.561]}},{"noteOn":{"time":114.625,"note":103.000,"xyz":[2.640,28.400,4.179]}},{"noteOn":{"time":114.640,"note":99.000,"xyz":[31.881,25.200,5.453]}},{"noteOn":{"time":114.670,"note":101.000,"xyz":[-35.251,26.800,16.523]}},{"noteOn":{"time":114.720,"note":97.000,"xyz":[21.236,23.600,-15.475]}},{"noteOn":{"time":114.750,"note":101.000,"xyz":[3.252,26.800,2.664]}},{"noteOn":{"time":114.780,"note":105.000,"xyz":[13.941,30.000,0.052]}},{"noteOn":{"time":114.895,"note":109.000,"xyz":[0.752,33.200,1.422]}},{"noteOn":{"time":114.925,"note":97.000,"xyz":[12.139,23.600,-18.282]}},{"noteOn":{"time":115.195,"note":93.000,"xyz":[16.725,20.400,5.377]}},{"noteOn":{"time":115.260,"note":103.000,"xyz":[-6.756,28.400,13.067]}},{"noteOn":{"time":115.265,"note":95.000,"xyz":[-2.151,22.000,14.430]}},{"noteOn":{"time":115.355,"note":99.000,"xyz":[-30.628,25.200,-10.025]}},{"noteOn":{"time":115.380,"note":101.000,"xyz":[-25.821,26.800,38.077]}},{"noteOn":{"time":115.385,"note":99.000,"xyz":[4.416,25.200,4.547]}},{"noteOn":{"time":115.390,"note":101.000,"xyz":[10.626,26.800,-25.842]}},{"noteOn":{"time":115.410,"note":93.000,"xyz":[-33.309,20.400,11.320]}},{"noteOn":{"time":115.470,"note":96.000,"xyz":[-3.602,22.800,39.489]}},{"noteOn":{"time":115.590,"note":101.000,"xyz":[-47.505,26.800,14.707]}},{"noteOn":{"time":115.610,"note":99.000,"xyz":[-22.678,25.200,-5.896]}},{"noteOn":{"time":115.700,"note":99.000,"xyz":[3.820,25.200,3.663]}},{"noteOn":{"time":115.715,"note":96.000,"xyz":[-10.748,22.800,-39.925]}},{"noteOn":{"time":115.815,"note":109.000,"xyz":[0.145,33.200,-2.988]}},{"noteOn":{"time":115.895,"note":103.000,"xyz":[-6.856,28.400,-16.566]}},{"noteOn":{"time":116.005,"note":98.000,"xyz":[44.341,24.400,-10.693]}},{"noteOn":{"time":116.040,"note":97.000,"xyz":[-19.767,23.600,-23.692]}},{"noteOn":{"time":116.045,"note":107.000,"xyz":[14.357,31.600,18.170]}},{"noteOn":{"time":116.160,"note":97.000,"xyz":[-12.971,23.600,12.802]}},{"noteOn":{"time":116.175,"note":89.000,"xyz":[11.375,17.200,31.065]}},{"noteOn":{"time":116.175,"note":101.000,"xyz":[-9.751,26.800,-45.789]}},{"noteOn":{"time":116.215,"note":97.000,"xyz":[23.706,23.600,13.237]}},{"noteOn":{"time":116.250,"note":103.000,"xyz":[27.861,28.400,-16.014]}},{"noteOn":{"time":116.250,"note":93.000,"xyz":[1.300,20.400,45.088]}},{"noteOn":{"time":116.510,"note":111.000,"xyz":[-24.343,34.800,34.433]}},{"noteOn":{"time":116.525,"note":101.000,"xyz":[20.858,26.800,-26.512]}},{"noteOn":{"time":116.550,"note":95.000,"xyz":[1.718,22.000,5.133]}},{"noteOn":{"time":116.625,"note":94.000,"xyz":[-18.645,21.200,10.676]}},{"noteOn":{"time":116.700,"note":94.000,"xyz":[-7.109,21.200,-0.946]}},{"noteOn":{"time":116.730,"note":107.000,"xyz":[11.559,31.600,21.702]}},{"noteOn":{"time":116.730,"note":105.000,"xyz":[-5.479,30.000,5.908]}},{"noteOn":{"time":116.820,"note":99.000,"xyz":[-24.523,25.200,-9.580]}},{"noteOn":{"time":116.910,"note":100.000,"xyz":[-38.881,26.000,8.024]}},{"noteOn":{"time":116.945,"note":107.000,"xyz":[-19.860,31.600,29.989]}},{"noteOn":{"time":116.965,"note":103.000,"xyz":[-20.389,28.400,18.929]}},{"noteOn":{"time":117.005,"note":104.000,"xyz":[8.103,29.200,3.320]}},{"noteOn":{"time":117.030,"note":104.000,"xyz":[-28.629,29.200,21.439]}},{"noteOn":{"time":117.170,"note":91.000,"xyz":[-4.861,18.800,-10.632]}},{"noteOn":{"time":117.215,"note":92.000,"xyz":[4.300,19.600,6.902]}},{"noteOn":{"time":117.325,"note":109.000,"xyz":[-20.946,33.200,-17.987]}},{"noteOn":{"time":117.350,"note":95.000,"xyz":[-24.858,22.000,21.618]}},{"noteOn":{"time":117.420,"note":92.000,"xyz":[3.705,19.600,7.203]}},{"noteOn":{"time":117.425,"note":98.000,"xyz":[4.430,24.400,-5.416]}},{"noteOn":{"time":117.480,"note":105.000,"xyz":[-17.358,30.000,13.220]}},{"noteOn":{"time":117.485,"note":100.000,"xyz":[0.377,26.000,29.339]}},{"noteOn":{"time":117.545,"note":104.000,"xyz":[29.763,29.200,2.888]}},{"noteOn":{"time":117.705,"note":107.000,"xyz":[-10.207,31.600,4.759]}},{"noteOn":{"time":117.735,"note":102.000,"xyz":[-0.872,27.600,-0.990]}},{"noteOn":{"time":117.765,"note":108.000,"xyz":[-11.111,32.400,7.496]}},{"noteOn":{"time":117.905,"note":105.000,"xyz":[29.417,30.000,11.127]}},{"noteOn":{"time":117.995,"note":95.000,"xyz":[-6.064,22.000,2.577]}},{"noteOn":{"time":118.020,"note":105.000,"xyz":[42.391,30.000,15.631]}},{"noteOn":{"time":118.120,"note":100.000,"xyz":[-26.615,26.000,-32.202]}},{"noteOn":{"time":118.125,"note":101.000,"xyz":[30.407,26.800,23.988]}},{"noteOn":{"time":118.200,"note":96.000,"xyz":[12.099,22.800,8.971]}},{"noteOn":{"time":118.205,"note":102.000,"xyz":[38.499,27.600,-12.312]}},{"noteOn":{"time":118.210,"note":97.000,"xyz":[-20.616,23.600,-21.809]}},{"noteOn":{"time":118.230,"note":92.000,"xyz":[35.226,19.600,32.790]}},{"noteOn":{"time":118.235,"note":104.000,"xyz":[26.179,29.200,9.401]}},{"noteOn":{"time":118.295,"note":102.000,"xyz":[8.105,27.600,44.966]}},{"noteOn":{"time":118.425,"note":100.000,"xyz":[31.408,26.000,1.326]}},{"noteOn":{"time":118.605,"note":108.000,"xyz":[-24.773,32.400,-7.829]}},{"noteOn":{"time":118.640,"note":92.000,"xyz":[14.773,19.600,-4.825]}},{"noteOn":{"time":118.655,"note":100.000,"xyz":[15.837,26.000,36.063]}},{"noteOn":{"time":118.710,"note":110.000,"xyz":[-6.508,34.000,-2.488]}},{"noteOn":{"time":118.710,"note":100.000,"xyz":[-29.631,26.000,1.370]}},{"noteOn":{"time":118.750,"note":98.000,"xyz":[-0.389,24.400,-6.012]}},{"noteOn":{"time":118.890,"note":94.000,"xyz":[21.132,21.200,18.362]}},{"noteOn":{"time":118.990,"note":94.000,"xyz":[5.044,21.200,-0.677]}},{"noteOn":{"time":119.000,"note":102.000,"xyz":[-12.405,27.600,5.881]}},{"noteOn":{"time":119.005,"note":99.000,"xyz":[-7.725,25.200,1.886]}},{"noteOn":{"time":119.135,"note":102.000,"xyz":[-14.597,27.600,6.593]}},{"noteOn":{"time":119.165,"note":106.000,"xyz":[15.744,30.800,-25.377]}},{"noteOn":{"time":119.175,"note":98.000,"xyz":[15.074,24.400,-2.407]}},{"noteOn":{"time":119.175,"note":99.000,"xyz":[-1.294,25.200,14.027]}},{"noteOn":{"time":119.205,"note":100.000,"xyz":[-19.352,26.000,-8.150]}},{"noteOn":{"time":119.440,"note":98.000,"xyz":[-2.874,24.400,-15.844]}},{"noteOn":{"time":119.525,"note":112.000,"xyz":[-10.203,35.600,-17.622]}},{"noteOn":{"time":119.530,"note":110.000,"xyz":[2.681,34.000,34.527]}},{"noteOn":{"time":119.565,"note":100.000,"xyz":[10.559,26.000,-40.670]}},{"noteOn":{"time":119.705,"note":94.000,"xyz":[-46.835,21.200,11.913]}},{"noteOn":{"time":119.745,"note":102.000,"xyz":[28.932,27.600,23.825]}},{"noteOn":{"time":119.780,"note":100.000,"xyz":[32.046,26.000,16.586]}},{"noteOn":{"time":119.825,"note":94.000,"xyz":[-37.336,21.200,-27.758]}},{"noteOn":{"time":119.865,"note":98.000,"xyz":[19.832,24.400,-21.585]}},{"noteOn":{"time":119.890,"note":100.000,"xyz":[-41.735,26.000,-16.493]}},{"noteOn":{"time":119.945,"note":92.000,"xyz":[24.490,19.600,36.900]}},{"noteOn":{"time":119.965,"note":102.000,"xyz":[-2.892,27.600,1.113]}},{"noteOn":{"time":119.975,"note":97.000,"xyz":[48.126,23.600,5.807]}},{"noteOn":{"time":120.015,"note":96.000,"xyz":[27.362,22.800,-32.378]}},{"noteOn":{"time":120.115,"note":98.000,"xyz":[-0.205,24.400,-25.190]}},{"noteOn":{"time":120.195,"note":108.000,"xyz":[16.042,32.400,9.699]}},{"noteOn":{"time":120.210,"note":96.000,"xyz":[1.916,22.800,7.317]}},{"noteOn":{"time":120.335,"note":112.000,"xyz":[-14.444,35.600,15.753]}},{"noteOn":{"time":120.415,"note":102.000,"xyz":[5.133,27.600,16.333]}},{"noteOn":{"time":120.530,"note":99.000,"xyz":[16.500,25.200,31.037]}},{"noteOn":{"time":120.535,"note":110.000,"xyz":[41.580,34.000,-17.719]}},{"noteOn":{"time":120.580,"note":104.000,"xyz":[24.175,29.200,-29.183]}},{"noteOn":{"time":120.645,"note":100.000,"xyz":[4.806,26.000,-1.550]}},{"noteOn":{"time":120.675,"note":104.000,"xyz":[3.077,29.200,-2.953]}},{"noteOn":{"time":120.675,"note":96.000,"xyz":[0.196,22.800,12.502]}},{"noteOn":{"time":120.725,"note":102.000,"xyz":[-18.861,27.600,-14.172]}},{"noteOn":{"time":120.740,"note":102.000,"xyz":[-46.345,27.600,-11.763]}},{"noteOn":{"time":120.785,"note":90.000,"xyz":[22.434,18.000,12.454]}},{"noteOn":{"time":120.785,"note":98.000,"xyz":[26.278,24.400,15.037]}},{"noteOn":{"time":120.800,"note":92.000,"xyz":[28.739,19.600,-24.061]}},{"noteOn":{"time":121.050,"note":104.000,"xyz":[3.995,29.200,5.832]}},{"noteOn":{"time":121.115,"note":94.000,"xyz":[-3.517,21.200,5.951]}},{"noteOn":{"time":121.170,"note":93.000,"xyz":[-3.575,20.400,-0.648]}},{"noteOn":{"time":121.210,"note":93.000,"xyz":[-9.104,20.400,-21.183]}},{"noteOn":{"time":121.275,"note":106.000,"xyz":[-6.138,30.800,6.366]}},{"noteOn":{"time":121.280,"note":104.000,"xyz":[-11.681,29.200,-21.353]}},{"noteOn":{"time":121.330,"note":100.000,"xyz":[0.311,26.000,-8.307]}},{"noteOn":{"time":121.365,"note":106.000,"xyz":[-14.332,30.800,46.545]}},{"noteOn":{"time":121.405,"note":108.000,"xyz":[13.279,32.400,-32.978]}},{"noteOn":{"time":121.415,"note":100.000,"xyz":[-37.414,26.000,11.278]}},{"noteOn":{"time":121.425,"note":106.000,"xyz":[-20.840,30.800,-31.906]}},{"noteOn":{"time":121.490,"note":104.000,"xyz":[4.142,29.200,-6.304]}},{"noteOn":{"time":121.575,"note":106.000,"xyz":[-15.136,30.800,-23.293]}},{"noteOn":{"time":121.710,"note":91.000,"xyz":[10.945,18.800,17.436]}},{"noteOn":{"time":121.715,"note":92.000,"xyz":[8.222,19.600,0.358]}},{"noteOn":{"time":121.785,"note":106.000,"xyz":[-1.701,30.800,-0.818]}},{"noteOn":{"time":121.795,"note":96.000,"xyz":[15.799,22.800,13.946]}},{"noteOn":{"time":121.905,"note":99.000,"xyz":[14.623,25.200,36.361]}},{"noteOn":{"time":121.915,"note":96.000,"xyz":[-0.071,22.800,7.555]}},{"noteOn":{"time":121.945,"note":91.000,"xyz":[22.845,18.800,-9.997]}},{"noteOn":{"time":122.115,"note":108.000,"xyz":[5.065,32.400,2.647]}},{"noteOn":{"time":122.115,"note":104.000,"xyz":[-32.284,29.200,8.520]}},{"noteOn":{"time":122.125,"note":100.000,"xyz":[-12.346,26.000,-10.617]}},{"noteOn":{"time":122.165,"note":104.000,"xyz":[-24.263,29.200,36.619]}},{"noteOn":{"time":122.235,"note":104.000,"xyz":[-27.898,29.200,24.465]}},{"noteOn":{"time":122.390,"note":106.000,"xyz":[-0.533,30.800,-8.142]}},{"noteOn":{"time":122.450,"note":102.000,"xyz":[-32.089,27.600,-29.582]}},{"noteOn":{"time":122.460,"note":94.000,"xyz":[-8.609,21.200,-24.423]}},{"noteOn":{"time":122.525,"note":106.000,"xyz":[-32.675,30.800,33.415]}},{"noteOn":{"time":122.550,"note":98.000,"xyz":[-0.826,24.400,-4.738]}},{"noteOn":{"time":122.620,"note":102.000,"xyz":[-1.501,27.600,0.770]}},{"noteOn":{"time":122.630,"note":101.000,"xyz":[-19.647,26.800,-12.313]}},{"noteOn":{"time":122.650,"note":101.000,"xyz":[13.948,26.800,-44.134]}},{"noteOn":{"time":122.695,"note":104.000,"xyz":[-19.199,29.200,45.593]}},{"noteOn":{"time":122.710,"note":101.000,"xyz":[-36.047,26.800,30.454]}},{"noteOn":{"time":122.810,"note":98.000,"xyz":[-7.686,24.400,-7.631]}},{"noteOn":{"time":122.825,"note":93.000,"xyz":[2.798,20.400,-1.520]}},{"noteOn":{"time":122.870,"note":100.000,"xyz":[-20.475,26.000,7.270]}},{"noteOn":{"time":123.030,"note":92.000,"xyz":[-27.752,19.600,1.833]}},{"noteOn":{"time":123.070,"note":109.000,"xyz":[-0.488,33.200,-6.291]}},{"noteOn":{"time":123.150,"note":97.000,"xyz":[37.137,23.600,-23.257]}},{"noteOn":{"time":123.215,"note":99.000,"xyz":[-28.738,25.200,-15.730]}},{"noteOn":{"time":123.240,"note":104.000,"xyz":[17.726,29.200,18.763]}},{"noteOn":{"time":123.285,"note":99.000,"xyz":[-12.024,25.200,-30.073]}},{"noteOn":{"time":123.295,"note":108.000,"xyz":[22.601,32.400,23.421]}},{"noteOn":{"time":123.435,"note":95.000,"xyz":[-15.228,22.000,14.974]}},{"noteOn":{"time":123.450,"note":103.000,"xyz":[21.687,28.400,22.374]}},{"noteOn":{"time":123.535,"note":99.000,"xyz":[-16.441,25.200,13.682]}},{"noteOn":{"time":123.545,"note":107.000,"xyz":[28.250,31.600,-40.517]}},{"noteOn":{"time":123.575,"note":93.000,"xyz":[3.057,20.400,-16.100]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[17.419,26.000,-25.289]}},{"noteOn":{"time":123.590,"note":100.000,"xyz":[19.659,26.000,34.261]}},{"noteOn":{"time":123.645,"note":98.000,"xyz":[1.834,24.400,-2.393]}},{"noteOn":{"time":123.725,"note":111.000,"xyz":[13.237,34.800,-33.501]}},{"noteOn":{"time":123.815,"note":95.000,"xyz":[24.716,22.000,-19.974]}},{"noteOn":{"time":123.905,"note":109.000,"xyz":[21.346,33.200,-44.418]}},{"noteOn":{"time":124.050,"note":113.000,"xyz":[-13.726,36.400,19.937]}},{"noteOn":{"time":124.085,"note":101.000,"xyz":[11.458,26.800,-11.703]}},{"noteOn":{"time":124.210,"note":95.000,"xyz":[18.544,22.000,23.113]}},{"noteOn":{"time":124.275,"note":97.000,"xyz":[15.096,23.600,10.399]}},{"noteOn":{"time":124.345,"note":102.000,"xyz":[-10.100,27.600,5.179]}},{"noteOn":{"time":124.390,"note":105.000,"xyz":[18.451,30.000,-1.841]}},{"noteOn":{"time":124.420,"note":93.000,"xyz":[-22.235,20.400,12.017]}},{"noteOn":{"time":124.430,"note":97.000,"xyz":[5.022,23.600,22.956]}},{"noteOn":{"time":124.435,"note":99.000,"xyz":[7.489,25.200,23.408]}},{"noteOn":{"time":124.475,"note":103.000,"xyz":[30.722,28.400,10.527]}},{"noteOn":{"time":124.480,"note":93.000,"xyz":[-33.819,20.400,30.757]}},{"noteOn":{"time":124.495,"note":107.000,"xyz":[-43.676,31.600,0.269]}},{"noteOn":{"time":124.525,"note":98.000,"xyz":[-2.420,24.400,-6.732]}},{"noteOn":{"time":124.585,"note":101.000,"xyz":[11.501,26.800,20.613]}},{"noteOn":{"time":124.715,"note":97.000,"xyz":[15.113,23.600,26.728]}},{"noteOn":{"time":124.765,"note":101.000,"xyz":[10.309,26.800,0.385]}},{"noteOn":{"time":124.885,"note":111.000,"xyz":[-12.186,34.800,4.447]}},{"noteOn":{"time":125.060,"note":99.000,"xyz":[-40.257,25.200,-24.961]}},{"noteOn":{"time":125.080,"note":103.000,"xyz":[2.046,28.400,-6.122]}},{"noteOn":{"time":125.100,"note":100.000,"xyz":[1.453,26.000,-2.604]}},{"noteOn":{"time":125.145,"note":103.000,"xyz":[15.578,28.400,10.311]}},{"noteOn":{"time":125.170,"note":99.000,"xyz":[10.081,25.200,-13.831]}},{"noteOn":{"time":125.205,"note":101.000,"xyz":[-0.027,26.800,25.373]}},{"noteOn":{"time":125.210,"note":105.000,"xyz":[-48.108,30.000,4.039]}},{"noteOn":{"time":125.290,"note":103.000,"xyz":[-14.506,28.400,26.774]}},{"noteOn":{"time":125.325,"note":109.000,"xyz":[8.398,33.200,-47.793]}},{"noteOn":{"time":125.350,"note":91.000,"xyz":[-14.482,18.800,13.664]}},{"noteOn":{"time":125.395,"note":95.000,"xyz":[4.225,22.000,0.190]}},{"noteOn":{"time":125.410,"note":91.000,"xyz":[-0.248,18.800,-0.982]}},{"noteOn":{"time":125.525,"note":105.000,"xyz":[41.810,30.000,7.508]}},{"noteOn":{"time":125.625,"note":97.000,"xyz":[-19.232,23.600,18.629]}},{"noteOn":{"time":125.710,"note":93.000,"xyz":[19.265,20.400,-10.525]}},{"noteOn":{"time":125.755,"note":99.000,"xyz":[-3.169,25.200,0.341]}},{"noteOn":{"time":125.760,"note":92.000,"xyz":[-4.521,19.600,-11.550]}},{"noteOn":{"time":125.800,"note":95.000,"xyz":[-22.932,22.000,3.207]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[-36.802,31.600,-3.108]}},{"noteOn":{"time":125.875,"note":107.000,"xyz":[17.221,31.600,-17.323]}},{"noteOn":{"time":125.910,"note":105.000,"xyz":[0.208,30.000,6.488]}},{"noteOn":{"time":125.990,"note":105.000,"xyz":[-1.655,30.000,-23.770]}},{"noteOn":{"time":126.010,"note":101.000,"xyz":[-40.852,26.800,22.111]}},{"noteOn":{"time":126.145,"note":107.000,"xyz":[9.268,31.600,-10.784]}},{"noteOn":{"time":126.160,"note":105.000,"xyz":[11.650,30.000,35.231]}},{"noteOn":{"time":126.220,"note":91.000,"xyz":[14.982,18.800,-20.056]}},{"noteOn":{"time":126.255,"note":93.000,"xyz":[22.188,20.400,-3.453]}},{"noteOn":{"time":126.285,"note":105.000,"xyz":[-2.307,30.000,9.976]}},{"noteOn":{"time":126.350,"note":99.000,"xyz":[16.545,25.200,18.385]}},{"noteOn":{"time":126.360,"note":97.000,"xyz":[-19.718,23.600,-16.167]}},{"noteOn":{"time":126.385,"note":99.000,"xyz":[-31.657,25.200,31.210]}},{"noteOn":{"time":126.445,"note":103.000,"xyz":[-22.461,28.400,-8.383]}},{"noteOn":{"time":126.515,"note":92.000,"xyz":[26.224,19.600,9.474]}},{"noteOn":{"time":126.530,"note":107.000,"xyz":[-11.586,31.600,10.894]}},{"noteOn":{"time":126.540,"note":107.000,"xyz":[37.568,31.600,14.097]}},{"noteOn":{"time":126.640,"note":103.000,"xyz":[-0.561,28.400,12.111]}},{"noteOn":{"time":126.765,"note":99.000,"xyz":[-3.413,25.200,-26.939]}},{"noteOn":{"time":126.790,"note":103.000,"xyz":[9.030,28.400,11.913]}},{"noteOn":{"time":126.865,"note":97.000,"xyz":[-36.322,23.600,20.726]}},{"noteOn":{"time":126.925,"note":93.000,"xyz":[21.513,20.400,-4.284]}},{"noteOn":{"time":127.055,"note":105.000,"xyz":[-0.245,30.000,-13.594]}},{"noteOn":{"time":127.065,"note":101.000,"xyz":[42.847,26.800,22.636]}},{"noteOn":{"time":127.075,"note":101.000,"xyz":[2.232,26.800,1.851]}},{"noteOn":{"time":127.110,"note":109.000,"xyz":[16.966,33.200,-6.883]}},{"noteOn":{"time":127.180,"note":100.000,"xyz":[23.751,26.000,41.465]}},{"noteOn":{"time":127.185,"note":101.000,"xyz":[-12.550,26.800,-37.945]}},{"noteOn":{"time":127.210,"note":100.000,"xyz":[-27.516,26.000,-36.127]}},{"noteOn":{"time":127.320,"note":109.000,"xyz":[48.297,33.200,0.132]}},{"noteOn":{"time":127.410,"note":99.000,"xyz":[10.591,25.200,1.673]}},{"noteOn":{"time":127.420,"note":93.000,"xyz":[9.097,20.400,10.640]}},{"noteOn":{"time":127.430,"note":101.000,"xyz":[-8.550,26.800,-13.340]}},{"noteOn":{"time":127.440,"note":91.000,"xyz":[13.492,18.800,11.239]}},{"noteOn":{"time":127.540,"note":105.000,"xyz":[6.477,30.000,-15.255]}},{"noteOn":{"time":127.615,"note":94.000,"xyz":[-1.927,21.200,4.168]}},{"noteOn":{"time":127.650,"note":99.000,"xyz":[-6.551,25.200,-10.617]}},{"noteOn":{"time":127.725,"note":98.000,"xyz":[7.193,24.400,3.964]}},{"noteOn":{"time":127.745,"note":111.000,"xyz":[1.943,34.800,9.848]}},{"noteOn":{"time":127.915,"note":99.000,"xyz":[-10.195,25.200,16.783]}},{"noteOn":{"time":127.985,"note":103.000,"xyz":[-0.036,28.400,14.453]}},{"noteOn":{"time":127.990,"note":95.000,"xyz":[11.979,22.000,-5.052]}},{"noteOn":{"time":128.000,"note":101.000,"xyz":[20.510,26.800,-8.503]}},{"noteOn":{"time":128.105,"note":98.000,"xyz":[13.033,24.400,11.635]}},{"noteOn":{"time":128.130,"note":99.000,"xyz":[-41.489,25.200,24.923]}},{"noteOn":{"time":128.130,"note":104.000,"xyz":[-18.724,29.200,-15.259]}},{"noteOn":{"time":128.165,"note":92.000,"xyz":[-36.370,19.600,-6.327]}},{"noteOn":{"time":128.165,"note":103.000,"xyz":[37.765,28.400,-3.674]}},{"noteOn":{"time":128.170,"note":107.000,"xyz":[-44.692,31.600,-15.842]}},{"noteOn":{"time":128.210,"note":101.000,"xyz":[-13.421,26.800,-4.607]}},{"noteOn":{"time":128.285,"note":108.000,"xyz":[-23.580,32.400,-39.263]}},{"noteOn":{"time":128.315,"note":102.000,"xyz":[26.645,27.600,-22.481]}},{"noteOn":{"time":128.530,"note":113.000,"xyz":[42.908,36.400,-3.448]}},{"noteOn":{"time":128.680,"note":98.000,"xyz":[-31.699,24.400,6.651]}},{"noteOn":{"time":128.710,"note":96.000,"xyz":[-2.975,22.800,-2.194]}},{"noteOn":{"time":128.910,"note":102.000,"xyz":[-5.551,27.600,3.056]}},{"noteOn":{"time":128.910,"note":103.000,"xyz":[-0.089,28.400,-1.429]}},{"noteOn":{"time":128.940,"note":101.000,"xyz":[47.389,26.800,-0.163]}},{"noteOn":{"time":128.965,"note":92.000,"xyz":[6.668,19.600,44.530]}},{"noteOn":{"time":128.990,"note":97.000,"xyz":[17.843,23.600,8.639]}},{"noteOn":{"time":129.000,"note":99.000,"xyz":[1.214,25.200,15.395]}},{"noteOn":{"time":129.010,"note":94.000,"xyz":[-2.064,21.200,-3.461]}},{"noteOn":{"time":129.045,"note":104.000,"xyz":[16.611,29.200,12.661]}},{"noteOn":{"time":129.050,"note":110.000,"xyz":[15.478,34.000,30.136]}},{"noteOn":{"time":129.095,"note":98.000,"xyz":[-2.424,24.400,19.731]}},{"noteOn":{"time":129.125,"note":106.000,"xyz":[-42.073,30.800,-12.111]}},{"noteOn":{"time":129.205,"note":101.000,"xyz":[3.028,26.800,3.877]}},{"noteOn":{"time":129.225,"note":98.000,"xyz":[-6.942,24.400,0.497]}},{"noteOn":{"time":129.455,"note":98.000,"xyz":[-43.270,24.400,2.662]}},{"noteOn":{"time":129.470,"note":99.000,"xyz":[-15.606,25.200,24.770]}},{"noteOn":{"time":129.570,"note":104.000,"xyz":[11.932,29.200,29.424]}},{"noteOn":{"time":129.570,"note":100.000,"xyz":[-41.907,26.000,-15.148]}},{"noteOn":{"time":129.685,"note":100.000,"xyz":[-33.887,26.000,-19.359]}},{"noteOn":{"time":129.690,"note":101.000,"xyz":[-16.582,26.800,-14.088]}},{"noteOn":{"time":129.770,"note":106.000,"xyz":[26.931,30.800,17.589]}},{"noteOn":{"time":129.845,"note":90.000,"xyz":[16.180,18.000,45.902]}},{"noteOn":{"time":129.875,"note":96.000,"xyz":[1.971,22.800,25.239]}},{"noteOn":{"time":129.950,"note":92.000,"xyz":[1.677,19.600,2.685]}},{"noteOn":{"time":130.045,"note":106.000,"xyz":[-1.527,30.800,-14.660]}},{"noteOn":{"time":130.075,"note":104.000,"xyz":[-32.711,29.200,-32.474]}},{"noteOn":{"time":130.090,"note":108.000,"xyz":[-21.253,32.400,41.569]}},{"noteOn":{"time":130.190,"note":98.000,"xyz":[4.489,24.400,-0.474]}},{"noteOn":{"time":130.205,"note":92.000,"xyz":[10.235,19.600,15.791]}},{"noteOn":{"time":130.270,"note":100.000,"xyz":[-29.955,26.000,12.641]}},{"noteOn":{"time":130.345,"note":104.000,"xyz":[22.764,29.200,-3.033]}},{"noteOn":{"time":130.375,"note":91.000,"xyz":[11.317,18.800,9.171]}},{"noteOn":{"time":130.395,"note":102.000,"xyz":[1.919,27.600,-20.279]}},{"noteOn":{"time":130.435,"note":104.000,"xyz":[5.901,29.200,-17.333]}},{"noteOn":{"time":130.465,"note":107.000,"xyz":[-7.531,31.600,8.218]}},{"noteOn":{"time":130.480,"note":96.000,"xyz":[-31.658,22.800,5.297]}},{"noteOn":{"time":130.555,"note":100.000,"xyz":[6.910,26.000,-23.236]}},{"noteOn":{"time":130.720,"note":94.000,"xyz":[33.579,21.200,14.656]}},{"noteOn":{"time":130.730,"note":90.000,"xyz":[-5.241,18.000,44.230]}},{"noteOn":{"time":130.815,"note":106.000,"xyz":[-18.125,30.800,-33.578]}},{"noteOn":{"time":130.845,"note":96.000,"xyz":[10.756,22.800,2.211]}},{"noteOn":{"time":130.860,"note":106.000,"xyz":[-2.146,30.800,21.663]}},{"noteOn":{"time":130.870,"note":100.000,"xyz":[-3.645,26.000,6.159]}},{"noteOn":{"time":130.940,"note":102.000,"xyz":[5.752,27.600,-4.373]}},{"noteOn":{"time":131.000,"note":106.000,"xyz":[29.436,30.800,-22.113]}},{"noteOn":{"time":131.015,"note":110.000,"xyz":[21.282,34.000,38.654]}},{"noteOn":{"time":131.015,"note":108.000,"xyz":[2.515,32.400,1.138]}},{"noteOn":{"time":131.045,"note":98.000,"xyz":[-19.559,24.400,-6.014]}},{"noteOn":{"time":131.105,"note":93.000,"xyz":[-34.387,20.400,-6.951]}},{"noteOn":{"time":131.195,"note":102.000,"xyz":[11.659,27.600,-19.552]}},{"noteOn":{"time":131.315,"note":92.000,"xyz":[-4.645,19.600,-15.699]}},{"noteOn":{"time":131.350,"note":100.000,"xyz":[2.918,26.000,-1.640]}},{"noteOn":{"time":131.355,"note":98.000,"xyz":[1.067,24.400,-1.005]}},{"noteOn":{"time":131.515,"note":112.000,"xyz":[-34.547,35.600,0.203]}},{"noteOn":{"time":131.520,"note":108.000,"xyz":[21.157,32.400,-37.734]}},{"noteOn":{"time":131.570,"note":104.000,"xyz":[0.272,29.200,30.687]}},{"noteOn":{"time":131.630,"note":100.000,"xyz":[-14.790,26.000,-9.919]}},{"noteOn":{"time":131.685,"note":94.000,"xyz":[12.458,21.200,-12.959]}},{"noteOn":{"time":131.705,"note":100.000,"xyz":[22.596,26.000,-24.807]}},{"noteOn":{"time":131.730,"note":102.000,"xyz":[2.621,27.600,19.838]}},{"noteOn":{"time":131.750,"note":99.000,"xyz":[-5.443,25.200,5.215]}},{"noteOn":{"time":131.885,"note":102.000,"xyz":[-8.256,27.600,-26.990]}},{"noteOn":{"time":131.905,"note":90.000,"xyz":[-26.213,18.000,17.184]}},{"noteOn":{"time":131.935,"note":100.000,"xyz":[-20.543,26.000,7.795]}},{"noteOn":{"time":131.935,"note":110.000,"xyz":[-31.240,34.000,5.522]}},{"noteOn":{"time":131.965,"note":94.000,"xyz":[-34.132,21.200,-22.814]}},{"noteOn":{"time":132.025,"note":98.000,"xyz":[-0.669,24.400,-5.064]}},{"noteOn":{"time":132.060,"note":114.000,"xyz":[-19.646,37.200,-8.893]}},{"noteOn":{"time":132.065,"note":110.000,"xyz":[13.932,34.000,10.781]}},{"noteOn":{"time":132.150,"note":102.000,"xyz":[-14.063,27.600,-2.819]}},{"noteOn":{"time":132.165,"note":106.000,"xyz":[2.763,30.800,-4.469]}},{"noteOn":{"time":132.230,"note":97.000,"xyz":[5.983,23.600,-0.431]}},{"noteOn":{"time":132.285,"note":104.000,"xyz":[-26.875,29.200,6.401]}},{"noteOn":{"time":132.360,"note":98.000,"xyz":[23.919,24.400,-20.897]}},{"noteOn":{"time":132.485,"note":96.000,"xyz":[-5.462,22.800,14.633]}},{"noteOn":{"time":132.535,"note":102.000,"xyz":[26.873,27.600,-15.665]}},{"noteOn":{"time":132.635,"note":100.000,"xyz":[43.014,26.000,-4.965]}},{"noteOn":{"time":132.650,"note":102.000,"xyz":[25.527,27.600,-13.969]}},{"noteOn":{"time":132.670,"note":100.000,"xyz":[6.392,26.000,2.821]}},{"noteOn":{"time":132.695,"note":97.000,"xyz":[10.166,23.600,-2.436]}},{"noteOn":{"time":132.695,"note":92.000,"xyz":[11.325,19.600,36.510]}},{"noteOn":{"time":132.755,"note":108.000,"xyz":[-32.744,32.400,-28.398]}},{"noteOn":{"time":132.775,"note":104.000,"xyz":[23.828,29.200,-9.024]}},{"noteOn":{"time":132.915,"note":108.000,"xyz":[-7.284,32.400,-28.133]}},{"noteOn":{"time":133.045,"note":104.000,"xyz":[-10.621,29.200,-9.175]}},{"noteOn":{"time":133.050,"note":112.000,"xyz":[7.457,35.600,32.920]}},{"noteOn":{"time":133.155,"note":101.000,"xyz":[-43.972,26.800,21.063]}},{"noteOn":{"time":133.205,"note":97.000,"xyz":[-6.056,23.600,-20.003]}},{"noteOn":{"time":133.235,"note":104.000,"xyz":[-35.567,29.200,24.432]}},{"noteOn":{"time":133.315,"note":102.000,"xyz":[20.090,27.600,-16.325]}},{"noteOn":{"time":133.405,"note":100.000,"xyz":[-23.402,26.000,-27.918]}},{"noteOn":{"time":133.415,"note":92.000,"xyz":[-0.471,19.600,-0.896]}},{"noteOn":{"time":133.445,"note":96.000,"xyz":[-44.182,22.800,-12.411]}},{"noteOn":{"time":133.470,"note":98.000,"xyz":[42.562,24.400,-4.775]}},{"noteOn":{"time":133.490,"note":95.000,"xyz":[-35.875,22.000,-6.424]}},{"noteOn":{"time":133.620,"note":98.000,"xyz":[-7.036,24.400,-44.714]}},{"noteOn":{"time":133.630,"note":106.000,"xyz":[6.666,30.800,-46.371]}},{"noteOn":{"time":133.640,"note":105.000,"xyz":[20.531,30.000,36.061]}},{"noteOn":{"time":133.665,"note":99.000,"xyz":[1.695,25.200,-16.813]}},{"noteOn":{"time":133.735,"note":99.000,"xyz":[-21.175,25.200,29.864]}},{"noteOn":{"time":133.790,"note":99.000,"xyz":[-10.175,25.200,-5.824]}},{"noteOn":{"time":133.820,"note":106.000,"xyz":[28.295,30.800,-23.108]}},{"noteOn":{"time":133.920,"note":110.000,"xyz":[-17.542,34.000,23.183]}},{"noteOn":{"time":134.065,"note":98.000,"xyz":[20.311,24.400,-33.238]}},{"noteOn":{"time":134.105,"note":99.000,"xyz":[-0.232,25.200,-16.214]}},{"noteOn":{"time":134.110,"note":108.000,"xyz":[-5.019,32.400,-11.431]}},{"noteOn":{"time":134.140,"note":100.000,"xyz":[-33.031,26.000,-34.571]}},{"noteOn":{"time":134.170,"note":96.000,"xyz":[-17.584,22.800,0.428]}},{"noteOn":{"time":134.215,"note":106.000,"xyz":[0.510,30.800,0.935]}},{"noteOn":{"time":134.255,"note":89.000,"xyz":[40.944,17.200,-23.191]}},{"noteOn":{"time":134.280,"note":101.000,"xyz":[21.437,26.800,23.927]}},{"noteOn":{"time":134.450,"note":103.000,"xyz":[-29.028,28.400,15.399]}},{"noteOn":{"time":134.480,"note":108.000,"xyz":[-47.266,32.400,-14.208]}},{"noteOn":{"time":134.495,"note":92.000,"xyz":[-26.151,19.600,17.689]}},{"noteOn":{"time":134.515,"note":105.000,"xyz":[-39.362,30.000,-9.817]}},{"noteOn":{"time":134.575,"note":106.000,"xyz":[-6.418,30.800,-31.613]}},{"noteOn":{"time":134.665,"note":97.000,"xyz":[-0.196,23.600,1.218]}},{"noteOn":{"time":134.690,"note":101.000,"xyz":[3.084,26.800,-29.150]}},{"noteOn":{"time":134.690,"note":103.000,"xyz":[2.086,28.400,4.623]}},{"noteOn":{"time":134.705,"note":91.000,"xyz":[-6.296,18.800,-7.835]}},{"noteOn":{"time":134.875,"note":108.000,"xyz":[10.237,32.400,11.638]}},{"noteOn":{"time":134.890,"note":103.000,"xyz":[10.093,28.400,3.073]}},{"noteOn":{"time":134.985,"note":91.000,"xyz":[19.802,18.800,-34.594]}},{"noteOn":{"time":135.010,"note":99.000,"xyz":[-12.499,25.200,-28.820]}},{"noteOn":{"time":135.020,"note":105.000,"xyz":[2.491,30.000,28.210]}},{"noteOn":{"time":135.030,"note":107.000,"xyz":[19.610,31.600,-9.290]}},{"noteOn":{"time":135.045,"note":96.000,"xyz":[4.751,22.800,-3.901]}},{"noteOn":{"time":135.190,"note":94.000,"xyz":[-13.433,21.200,27.735]}},{"noteOn":{"time":135.195,"note":105.000,"xyz":[10.287,30.000,-38.544]}},{"noteOn":{"time":135.235,"note":91.000,"xyz":[-3.974,18.800,-3.916]}},{"noteOn":{"time":135.250,"note":109.000,"xyz":[2.291,33.200,23.600]}},{"noteOn":{"time":135.345,"note":101.000,"xyz":[6.480,26.800,-2.749]}},{"noteOn":{"time":135.350,"note":95.000,"xyz":[-5.467,22.000,-4.777]}},{"noteOn":{"time":135.405,"note":101.000,"xyz":[-32.698,26.800,-2.814]}},{"noteOn":{"time":135.545,"note":101.000,"xyz":[-21.979,26.800,18.991]}},{"noteOn":{"time":135.595,"note":106.000,"xyz":[-6.525,30.800,6.337]}},{"noteOn":{"time":135.615,"note":101.000,"xyz":[-2.531,26.800,19.915]}},{"noteOn":{"time":135.695,"note":94.000,"xyz":[-41.276,21.200,10.855]}},{"noteOn":{"time":135.700,"note":91.000,"xyz":[-10.343,18.800,-26.351]}},{"noteOn":{"time":135.730,"note":99.000,"xyz":[27.621,25.200,24.486]}},{"noteOn":{"time":135.750,"note":99.000,"xyz":[-30.885,25.200,13.394]}},{"noteOn":{"time":135.855,"note":97.000,"xyz":[-7.234,23.600,-9.716]}},{"noteOn":{"time":135.915,"note":113.000,"xyz":[6.224,36.400,47.736]}},{"noteOn":{"time":136.000,"note":109.000,"xyz":[-3.026,33.200,0.440]}},{"noteOn":{"time":136.050,"note":103.000,"xyz":[13.850,28.400,-30.198]}},{"noteOn":{"time":136.200,"note":99.000,"xyz":[3.924,25.200,-1.442]}},{"noteOn":{"time":136.250,"note":111.000,"xyz":[1.919,34.800,-0.847]}},{"noteOn":{"time":136.270,"note":99.000,"xyz":[12.197,25.200,17.583]}},{"noteOn":{"time":136.280,"note":93.000,"xyz":[-2.127,20.400,-14.232]}},{"noteOn":{"time":136.315,"note":103.000,"xyz":[35.500,28.400,20.985]}},{"noteOn":{"time":136.315,"note":98.000,"xyz":[0.078,24.400,15.953]}},{"noteOn":{"time":136.345,"note":101.000,"xyz":[-6.687,26.800,-3.631]}},{"noteOn":{"time":136.370,"note":89.000,"xyz":[23.289,17.200,-34.348]}},{"noteOn":{"time":136.420,"note":95.000,"xyz":[39.537,22.000,23.796]}},{"noteOn":{"time":136.425,"note":107.000,"xyz":[1.155,31.600,1.748]}},{"noteOn":{"time":136.445,"note":103.000,"xyz":[1.167,28.400,-0.107]}},{"noteOn":{"time":136.685,"note":99.000,"xyz":[10.834,25.200,-12.746]}},{"noteOn":{"time":136.740,"note":97.000,"xyz":[-26.636,23.600,-24.432]}},{"noteOn":{"time":136.760,"note":113.000,"xyz":[-15.609,36.400,32.730]}},{"noteOn":{"time":136.825,"note":101.000,"xyz":[-25.487,26.800,-28.300]}},{"noteOn":{"time":136.865,"note":111.000,"xyz":[-22.998,34.800,-22.178]}},{"noteOn":{"time":136.880,"note":97.000,"xyz":[-0.644,23.600,16.460]}},{"noteOn":{"time":136.945,"note":97.000,"xyz":[-2.095,23.600,3.670]}},{"noteOn":{"time":136.970,"note":103.000,"xyz":[10.520,28.400,17.630]}},{"noteOn":{"time":137.045,"note":109.000,"xyz":[1.590,33.200,10.534]}},{"noteOn":{"time":137.130,"note":103.000,"xyz":[-22.397,28.400,12.248]}},{"noteOn":{"time":137.215,"note":99.000,"xyz":[-12.370,25.200,-15.434]}},{"noteOn":{"time":137.230,"note":93.000,"xyz":[-24.774,20.400,-43.081]}},{"noteOn":{"time":137.240,"note":109.000,"xyz":[31.390,33.200,-11.835]}},{"noteOn":{"time":137.285,"note":96.000,"xyz":[17.915,22.800,-10.179]}},{"noteOn":{"time":137.355,"note":105.000,"xyz":[-14.041,30.000,-6.480]}},{"noteOn":{"time":137.405,"note":105.000,"xyz":[49.731,30.000,3.148]}},{"noteOn":{"time":137.545,"note":107.000,"xyz":[-19.480,31.600,13.643]}},{"noteOn":{"time":137.575,"note":111.000,"xyz":[-3.654,34.800,-22.980]}},{"noteOn":{"time":137.615,"note":101.000,"xyz":[22.587,26.800,31.100]}},{"noteOn":{"time":137.635,"note":105.000,"xyz":[0.550,30.000,-2.800]}},{"noteOn":{"time":137.700,"note":97.000,"xyz":[43.110,23.600,-5.880]}},{"noteOn":{"time":137.810,"note":99.000,"xyz":[21.614,25.200,25.184]}},{"noteOn":{"time":137.830,"note":91.000,"xyz":[-1.134,18.800,4.744]}},{"noteOn":{"time":137.920,"note":95.000,"xyz":[-30.955,22.000,-1.181]}},{"noteOn":{"time":137.930,"note":101.000,"xyz":[12.973,26.800,-18.190]}},{"noteOn":{"time":137.965,"note":95.000,"xyz":[-25.375,22.000,-9.874]}},{"noteOn":{"time":138.045,"note":103.000,"xyz":[0.130,28.400,-12.897]}},{"noteOn":{"time":138.170,"note":99.000,"xyz":[36.579,25.200,-5.940]}},{"noteOn":{"time":138.190,"note":97.000,"xyz":[-2.703,23.600,11.051]}},{"noteOn":{"time":138.195,"note":105.000,"xyz":[3.639,30.000,7.928]}},{"noteOn":{"time":138.230,"note":100.000,"xyz":[-5.322,26.000,-1.385]}},{"noteOn":{"time":138.245,"note":100.000,"xyz":[5.960,26.000,4.010]}},{"noteOn":{"time":138.255,"note":103.000,"xyz":[4.640,28.400,5.061]}},{"noteOn":{"time":138.325,"note":107.000,"xyz":[-7.169,31.600,-15.839]}},{"noteOn":{"time":138.350,"note":109.000,"xyz":[19.675,33.200,-9.864]}},{"noteOn":{"time":138.495,"note":97.000,"xyz":[45.332,23.600,18.413]}},{"noteOn":{"time":138.530,"note":99.000,"xyz":[29.203,25.200,35.479]}},{"noteOn":{"time":138.535,"note":105.000,"xyz":[-17.731,30.000,21.166]}},{"noteOn":{"time":138.625,"note":89.000,"xyz":[1.585,17.200,-6.584]}},{"noteOn":{"time":138.650,"note":100.000,"xyz":[-33.983,26.000,19.729]}},{"noteOn":{"time":138.660,"note":97.000,"xyz":[37.556,23.600,-4.867]}},{"noteOn":{"time":138.725,"note":101.000,"xyz":[11.938,26.800,-11.261]}},{"noteOn":{"time":138.745,"note":105.000,"xyz":[-13.058,30.000,46.698]}},{"noteOn":{"time":138.755,"note":105.000,"xyz":[2.055,30.000,-1.833]}},{"noteOn":{"time":138.780,"note":107.000,"xyz":[-25.760,31.600,-36.270]}},{"noteOn":{"time":138.860,"note":107.000,"xyz":[-16.191,31.600,44.992]}},{"noteOn":{"time":138.870,"note":102.000,"xyz":[-46.270,27.600,-7.746]}},{"noteOn":{"time":138.985,"note":93.000,"xyz":[-0.188,20.400,4.670]}},{"noteOn":{"time":139.055,"note":107.000,"xyz":[-22.522,31.600,-35.706]}},{"noteOn":{"time":139.145,"note":96.000,"xyz":[4.635,22.800,8.931]}},{"noteOn":{"time":139.200,"note":90.000,"xyz":[0.896,18.000,1.267]}},{"noteOn":{"time":139.285,"note":107.000,"xyz":[-24.685,31.600,9.795]}},{"noteOn":{"time":139.365,"note":103.000,"xyz":[19.694,28.400,2.891]}},{"noteOn":{"time":139.370,"note":105.000,"xyz":[16.128,30.000,-40.848]}},{"noteOn":{"time":139.395,"note":103.000,"xyz":[1.672,28.400,-1.446]}},{"noteOn":{"time":139.425,"note":99.000,"xyz":[-20.103,25.200,1.921]}},{"noteOn":{"time":139.490,"note":97.000,"xyz":[3.408,23.600,-9.756]}},{"noteOn":{"time":139.520,"note":108.000,"xyz":[14.386,32.400,8.142]}},{"noteOn":{"time":139.600,"note":92.000,"xyz":[-14.483,19.600,9.401]}},{"noteOn":{"time":139.600,"note":95.000,"xyz":[4.590,22.000,-9.692]}},{"noteOn":{"time":139.635,"note":102.000,"xyz":[32.453,27.600,-2.268]}},{"noteOn":{"time":139.645,"note":103.000,"xyz":[-40.851,28.400,-26.569]}},{"noteOn":{"time":139.730,"note":109.000,"xyz":[18.753,33.200,21.222]}},{"noteOn":{"time":139.745,"note":92.000,"xyz":[-8.004,19.600,29.810]}},{"noteOn":{"time":139.765,"note":105.000,"xyz":[43.939,30.000,17.400]}},{"noteOn":{"time":139.935,"note":102.000,"xyz":[-3.027,27.600,-10.390]}},{"noteOn":{"time":140.075,"note":109.000,"xyz":[3.076,33.200,1.159]}},{"noteOn":{"time":140.105,"note":100.000,"xyz":[10.727,26.000,-3.390]}},{"noteOn":{"time":140.170,"note":91.000,"xyz":[-5.185,18.800,9.167]}},{"noteOn":{"time":140.175,"note":101.000,"xyz":[15.652,26.800,-24.216]}},{"noteOn":{"time":140.195,"note":105.000,"xyz":[-6.324,30.000,-11.475]}},{"noteOn":{"time":140.245,"note":100.000,"xyz":[-21.677,26.000,28.784]}},{"noteOn":{"time":140.285,"note":94.000,"xyz":[13.211,21.200,10.389]}},{"noteOn":{"time":140.295,"note":99.000,"xyz":[32.928,25.200,-19.197]}},{"noteOn":{"time":140.310,"note":96.000,"xyz":[13.759,22.800,-21.784]}},{"noteOn":{"time":140.385,"note":94.000,"xyz":[1.452,21.200,4.792]}},{"noteOn":{"time":140.425,"note":114.000,"xyz":[2.311,37.200,18.176]}},{"noteOn":{"time":140.495,"note":98.000,"xyz":[-1.546,24.400,6.431]}},{"noteOn":{"time":140.580,"note":103.000,"xyz":[-25.744,28.400,25.812]}},{"noteOn":{"time":140.690,"note":108.000,"xyz":[-1.376,32.400,-2.406]}},{"noteOn":{"time":140.700,"note":98.000,"xyz":[-31.057,24.400,-38.337]}},{"noteOn":{"time":140.755,"note":101.000,"xyz":[5.071,26.800,-37.392]}},{"noteOn":{"time":140.835,"note":96.000,"xyz":[-1.752,22.800,-13.825]}},{"noteOn":{"time":140.885,"note":97.000,"xyz":[-13.026,23.600,-30.891]}},{"noteOn":{"time":140.890,"note":112.000,"xyz":[-13.648,35.600,10.120]}},{"noteOn":{"time":140.900,"note":104.000,"xyz":[-28.938,29.200,-23.993]}},{"noteOn":{"time":140.915,"note":88.000,"xyz":[12.477,16.400,-7.614]}},{"noteOn":{"time":140.925,"note":104.000,"xyz":[-27.358,29.200,32.833]}},{"noteOn":{"time":140.955,"note":98.000,"xyz":[-15.308,24.400,30.901]}},{"noteOn":{"time":141.050,"note":110.000,"xyz":[20.009,34.000,-3.629]}},{"noteOn":{"time":141.200,"note":112.000,"xyz":[-26.742,35.600,11.667]}},{"noteOn":{"time":141.250,"note":96.000,"xyz":[-32.524,22.800,-7.898]}},{"noteOn":{"time":141.315,"note":100.000,"xyz":[-33.190,26.000,-0.842]}},{"noteOn":{"time":141.375,"note":94.000,"xyz":[3.893,21.200,-4.362]}},{"noteOn":{"time":141.405,"note":98.000,"xyz":[-23.814,24.400,-21.665]}},{"noteOn":{"time":141.450,"note":102.000,"xyz":[-1.392,27.600,-20.446]}},{"noteOn":{"time":141.470,"note":96.000,"xyz":[17.063,22.800,-32.991]}},{"noteOn":{"time":141.560,"note":108.000,"xyz":[28.722,32.400,-5.686]}},{"noteOn":{"time":141.660,"note":108.000,"xyz":[16.196,32.400,2.079]}},{"noteOn":{"time":141.725,"note":106.000,"xyz":[-5.862,30.800,10.090]}},{"noteOn":{"time":141.730,"note":103.000,"xyz":[12.569,28.400,-2.619]}},{"noteOn":{"time":141.760,"note":94.000,"xyz":[20.154,21.200,-2.096]}},{"noteOn":{"time":141.820,"note":102.000,"xyz":[0.130,27.600,45.617]}},{"noteOn":{"time":141.840,"note":98.000,"xyz":[39.037,24.400,25.153]}},{"noteOn":{"time":141.875,"note":95.000,"xyz":[-1.925,22.000,9.711]}},{"noteOn":{"time":141.920,"note":106.000,"xyz":[9.551,30.800,40.572]}},{"noteOn":{"time":141.990,"note":106.000,"xyz":[13.586,30.800,36.277]}},{"noteOn":{"time":142.055,"note":110.000,"xyz":[48.546,34.000,5.130]}},{"noteOn":{"time":142.105,"note":106.000,"xyz":[1.285,30.800,-6.367]}},{"noteOn":{"time":142.155,"note":102.000,"xyz":[15.234,27.600,7.080]}},{"noteOn":{"time":142.200,"note":98.000,"xyz":[-40.175,24.400,-27.780]}},{"noteOn":{"time":142.235,"note":98.000,"xyz":[21.504,24.400,-6.323]}},{"noteOn":{"time":142.245,"note":90.000,"xyz":[36.761,18.000,32.550]}},{"noteOn":{"time":142.270,"note":104.000,"xyz":[-12.246,29.200,4.930]}},{"noteOn":{"time":142.365,"note":96.000,"xyz":[15.752,22.800,6.979]}},{"noteOn":{"time":142.440,"note":96.000,"xyz":[29.363,22.800,4.284]}},{"noteOn":{"time":142.510,"note":100.000,"xyz":[41.180,26.000,0.148]}},{"noteOn":{"time":142.525,"note":104.000,"xyz":[-26.840,29.200,37.317]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[-18.819,32.400,-38.556]}},{"noteOn":{"time":142.635,"note":108.000,"xyz":[-36.185,32.400,29.206]}},{"noteOn":{"time":142.735,"note":96.000,"xyz":[-15.309,22.800,15.098]}},{"noteOn":{"time":142.755,"note":100.000,"xyz":[-40.355,26.000,20.167]}},{"noteOn":{"time":142.775,"note":104.000,"xyz":[-17.371,29.200,-6.043]}},{"noteOn":{"time":142.800,"note":101.000,"xyz":[-8.310,26.800,-2.823]}},{"noteOn":{"time":142.860,"note":106.000,"xyz":[15.901,30.800,8.793]}},{"noteOn":{"time":142.885,"note":104.000,"xyz":[12.187,29.200,-6.080]}},{"noteOn":{"time":142.930,"note":112.000,"xyz":[-7.727,35.600,-6.415]}},{"noteOn":{"time":142.945,"note":98.000,"xyz":[7.927,24.400,-24.542]}},{"noteOn":{"time":142.950,"note":98.000,"xyz":[-24.476,24.400,-25.641]}},{"noteOn":{"time":142.995,"note":90.000,"xyz":[3.640,18.000,-2.962]}},{"noteOn":{"time":143.110,"note":100.000,"xyz":[-11.334,26.000,-2.015]}},{"noteOn":{"time":143.195,"note":96.000,"xyz":[8.089,22.800,1.942]}},{"noteOn":{"time":143.280,"note":102.000,"xyz":[7.115,27.600,14.105]}},{"noteOn":{"time":143.335,"note":106.000,"xyz":[19.059,30.800,-19.623]}},{"noteOn":{"time":143.450,"note":94.000,"xyz":[3.084,21.200,-12.833]}},{"noteOn":{"time":143.460,"note":103.000,"xyz":[32.572,28.400,11.837]}},{"noteOn":{"time":143.470,"note":102.000,"xyz":[-4.635,27.600,-36.051]}},{"noteOn":{"time":143.555,"note":106.000,"xyz":[10.263,30.800,14.450]}},{"noteOn":{"time":143.580,"note":108.000,"xyz":[-33.393,32.400,-24.424]}},{"noteOn":{"time":143.620,"note":96.000,"xyz":[36.312,22.800,15.713]}},{"noteOn":{"time":143.625,"note":106.000,"xyz":[-1.645,30.800,-1.343]}},{"noteOn":{"time":143.700,"note":91.000,"xyz":[-20.279,18.800,-20.246]}},{"noteOn":{"time":143.765,"note":106.000,"xyz":[8.030,30.800,17.188]}},{"noteOn":{"time":143.815,"note":98.000,"xyz":[-32.819,24.400,-17.217]}},{"noteOn":{"time":143.835,"note":98.000,"xyz":[-17.773,24.400,-43.932]}},{"noteOn":{"time":143.835,"note":114.000,"xyz":[-19.580,37.200,14.174]}},{"noteOn":{"time":143.920,"note":100.000,"xyz":[31.207,26.000,-26.634]}},{"noteOn":{"time":143.925,"note":102.000,"xyz":[3.782,27.600,49.523]}},{"noteOn":{"time":143.990,"note":96.000,"xyz":[3.647,22.800,1.630]}},{"noteOn":{"time":144.070,"note":104.000,"xyz":[-8.847,29.200,-10.833]}},{"noteOn":{"time":144.155,"note":100.000,"xyz":[26.296,26.000,4.067]}},{"noteOn":{"time":144.175,"note":102.000,"xyz":[-12.682,27.600,3.637]}},{"noteOn":{"time":144.210,"note":93.000,"xyz":[-6.610,20.400,-22.164]}},{"noteOn":{"time":144.260,"note":93.000,"xyz":[18.558,20.400,-33.886]}},{"noteOn":{"time":144.315,"note":108.000,"xyz":[-28.763,32.400,11.104]}},{"noteOn":{"time":144.355,"note":104.000,"xyz":[8.093,29.200,11.758]}},{"noteOn":{"time":144.465,"note":103.000,"xyz":[0.604,28.400,7.963]}},{"noteOn":{"time":144.550,"note":110.000,"xyz":[-1.267,34.000,6.615]}},{"noteOn":{"time":144.585,"note":104.000,"xyz":[13.809,29.200,19.920]}},{"noteOn":{"time":144.630,"note":90.000,"xyz":[-4.243,18.000,0.054]}},{"noteOn":{"time":144.670,"note":104.000,"xyz":[-19.631,29.200,4.490]}},{"noteOn":{"time":144.675,"note":110.000,"xyz":[-3.639,34.000,-14.502]}},{"noteOn":{"time":144.690,"note":100.000,"xyz":[-13.427,26.000,-29.393]}},{"noteOn":{"time":144.745,"note":100.000,"xyz":[-1.460,26.000,1.011]}},{"noteOn":{"time":144.770,"note":96.000,"xyz":[32.612,22.800,-26.095]}},{"noteOn":{"time":144.850,"note":102.000,"xyz":[23.222,27.600,0.969]}},{"noteOn":{"time":144.875,"note":95.000,"xyz":[34.080,22.000,-8.349]}},{"noteOn":{"time":144.890,"note":100.000,"xyz":[-12.006,26.000,-22.394]}},{"noteOn":{"time":144.975,"note":110.000,"xyz":[7.941,34.000,-20.648]}},{"noteOn":{"time":145.025,"note":114.000,"xyz":[1.252,37.200,4.931]}},{"noteOn":{"time":145.060,"note":102.000,"xyz":[-4.280,27.600,-41.516]}},{"noteOn":{"time":145.085,"note":98.000,"xyz":[-15.103,24.400,-10.181]}},{"noteOn":{"time":145.200,"note":97.000,"xyz":[-15.005,23.600,14.245]}},{"noteOn":{"time":145.295,"note":96.000,"xyz":[-28.276,22.800,-27.353]}},{"noteOn":{"time":145.300,"note":102.000,"xyz":[20.122,27.600,-12.789]}},{"noteOn":{"time":145.320,"note":108.000,"xyz":[-15.272,32.400,5.338]}},{"noteOn":{"time":145.445,"note":103.000,"xyz":[4.936,28.400,27.299]}},{"noteOn":{"time":145.455,"note":97.000,"xyz":[-2.530,23.600,48.057]}},{"noteOn":{"time":145.455,"note":88.000,"xyz":[13.260,16.400,7.461]}},{"noteOn":{"time":145.455,"note":107.000,"xyz":[47.146,31.600,-12.475]}},{"noteOn":{"time":145.480,"note":112.000,"xyz":[-7.098,35.600,0.136]}},{"noteOn":{"time":145.485,"note":104.000,"xyz":[41.376,29.200,-15.841]}},{"noteOn":{"time":145.490,"note":106.000,"xyz":[-7.085,30.800,3.233]}},{"noteOn":{"time":145.525,"note":98.000,"xyz":[7.304,24.400,38.521]}},{"noteOn":{"time":145.575,"note":102.000,"xyz":[38.321,27.600,7.021]}},{"noteOn":{"time":145.635,"note":112.000,"xyz":[36.242,35.600,-18.006]}},{"noteOn":{"time":145.650,"note":101.000,"xyz":[35.601,26.800,-9.474]}},{"noteOn":{"time":145.685,"note":93.000,"xyz":[-0.948,20.400,16.380]}},{"noteOn":{"time":145.765,"note":95.000,"xyz":[9.894,22.000,-10.044]}},{"noteOn":{"time":145.910,"note":99.000,"xyz":[48.458,25.200,7.392]}},{"noteOn":{"time":146.035,"note":105.000,"xyz":[-16.802,30.000,-2.676]}},{"noteOn":{"time":146.070,"note":107.000,"xyz":[-3.869,31.600,0.715]}},{"noteOn":{"time":146.090,"note":103.000,"xyz":[28.309,28.400,6.869]}},{"noteOn":{"time":146.135,"note":107.000,"xyz":[-15.712,31.600,1.276]}},{"noteOn":{"time":146.140,"note":104.000,"xyz":[-28.521,29.200,-3.241]}},{"noteOn":{"time":146.160,"note":96.000,"xyz":[-33.201,22.800,-2.537]}},{"noteOn":{"time":146.250,"note":95.000,"xyz":[-14.383,22.000,0.696]}},{"noteOn":{"time":146.295,"note":105.000,"xyz":[4.444,30.000,-4.114]}},{"noteOn":{"time":146.435,"note":109.000,"xyz":[8.876,33.200,-33.453]}},{"noteOn":{"time":146.445,"note":95.000,"xyz":[2.885,22.000,-5.983]}},{"noteOn":{"time":146.455,"note":98.000,"xyz":[-6.650,24.400,-3.478]}},{"noteOn":{"time":146.460,"note":107.000,"xyz":[-15.144,31.600,-36.836]}},{"noteOn":{"time":146.535,"note":109.000,"xyz":[-25.254,33.200,36.912]}},{"noteOn":{"time":146.585,"note":95.000,"xyz":[6.524,22.000,-4.926]}},{"noteOn":{"time":146.670,"note":105.000,"xyz":[7.142,30.000,12.723]}},{"noteOn":{"time":146.695,"note":101.000,"xyz":[-40.599,26.800,-9.681]}},{"noteOn":{"time":146.700,"note":99.000,"xyz":[-22.279,25.200,28.290]}},{"noteOn":{"time":146.705,"note":89.000,"xyz":[33.417,17.200,19.466]}},{"noteOn":{"time":146.810,"note":105.000,"xyz":[-14.993,30.000,-12.988]}},{"noteOn":{"time":146.830,"note":98.000,"xyz":[49.561,24.400,0.231]}},{"noteOn":{"time":146.875,"note":97.000,"xyz":[43.042,23.600,-3.713]}},{"noteOn":{"time":146.910,"note":107.000,"xyz":[16.402,31.600,-10.351]}},{"noteOn":{"time":146.925,"note":97.000,"xyz":[-42.541,23.600,-25.293]}},{"noteOn":{"time":147.145,"note":107.000,"xyz":[-49.360,31.600,-1.068]}},{"noteOn":{"time":147.155,"note":103.000,"xyz":[20.540,28.400,-2.451]}},{"noteOn":{"time":147.205,"note":109.000,"xyz":[-19.379,33.200,-27.692]}},{"noteOn":{"time":147.265,"note":101.000,"xyz":[8.525,26.800,10.711]}},{"noteOn":{"time":147.270,"note":95.000,"xyz":[8.493,22.000,20.162]}},{"noteOn":{"time":147.330,"note":103.000,"xyz":[-44.582,28.400,9.618]}},{"noteOn":{"time":147.350,"note":102.000,"xyz":[31.995,27.600,-12.089]}},{"noteOn":{"time":147.410,"note":91.000,"xyz":[1.143,18.800,39.174]}},{"noteOn":{"time":147.425,"note":97.000,"xyz":[2.333,23.600,-0.787]}},{"noteOn":{"time":147.455,"note":101.000,"xyz":[10.433,26.800,-2.837]}},{"noteOn":{"time":147.470,"note":107.000,"xyz":[34.940,31.600,-11.449]}},{"noteOn":{"time":147.585,"note":101.000,"xyz":[-32.692,26.800,-11.803]}},{"noteOn":{"time":147.610,"note":97.000,"xyz":[17.200,23.600,-38.283]}},{"noteOn":{"time":147.645,"note":105.000,"xyz":[32.704,30.000,-25.150]}},{"noteOn":{"time":147.665,"note":99.000,"xyz":[-17.964,25.200,-3.596]}},{"noteOn":{"time":147.690,"note":103.000,"xyz":[26.192,28.400,-10.690]}},{"noteOn":{"time":147.895,"note":105.000,"xyz":[16.840,30.000,-23.903]}},{"noteOn":{"time":147.910,"note":95.000,"xyz":[-7.616,22.000,-13.241]}},{"noteOn":{"time":148.010,"note":113.000,"xyz":[-20.317,36.400,27.994]}},{"noteOn":{"time":148.035,"note":102.000,"xyz":[0.181,27.600,-19.810]}},{"noteOn":{"time":148.060,"note":109.000,"xyz":[5.252,33.200,8.803]}},{"noteOn":{"time":148.090,"note":107.000,"xyz":[8.673,31.600,1.207]}},{"noteOn":{"time":148.140,"note":99.000,"xyz":[-5.247,25.200,-39.030]}},{"noteOn":{"time":148.150,"note":95.000,"xyz":[-1.810,22.000,26.179]}},{"noteOn":{"time":148.200,"note":91.000,"xyz":[-1.019,18.800,-0.236]}},{"noteOn":{"time":148.295,"note":97.000,"xyz":[28.705,23.600,-0.473]}},{"noteOn":{"time":148.325,"note":99.000,"xyz":[-12.028,25.200,-29.081]}},{"noteOn":{"time":148.365,"note":105.000,"xyz":[21.640,30.000,13.156]}},{"noteOn":{"time":148.455,"note":97.000,"xyz":[9.420,23.600,0.279]}},{"noteOn":{"time":148.485,"note":101.000,"xyz":[-32.420,26.800,2.447]}},{"noteOn":{"time":148.525,"note":115.000,"xyz":[11.885,38.000,-13.906]}},{"noteOn":{"time":148.560,"note":99.000,"xyz":[20.166,25.200,3.497]}},{"noteOn":{"time":148.580,"note":101.000,"xyz":[27.961,26.800,17.922]}},{"noteOn":{"time":148.595,"note":103.000,"xyz":[-35.573,28.400,4.862]}},{"noteOn":{"time":148.675,"note":111.000,"xyz":[-21.293,34.800,14.399]}},{"noteOn":{"time":148.770,"note":103.000,"xyz":[-2.789,28.400,-4.738]}},{"noteOn":{"time":148.770,"note":93.000,"xyz":[-36.607,20.400,-25.956]}},{"noteOn":{"time":148.805,"note":94.000,"xyz":[-35.057,21.200,-20.912]}},{"noteOn":{"time":148.815,"note":109.000,"xyz":[-24.178,33.200,1.667]}},{"noteOn":{"time":149.050,"note":103.000,"xyz":[16.247,28.400,16.058]}},{"noteOn":{"time":149.080,"note":103.000,"xyz":[6.278,28.400,12.855]}},{"noteOn":{"time":149.090,"note":101.000,"xyz":[-25.274,26.800,0.052]}},{"noteOn":{"time":149.175,"note":89.000,"xyz":[-5.457,17.200,15.447]}},{"noteOn":{"time":149.195,"note":105.000,"xyz":[-3.360,30.000,32.037]}},{"noteOn":{"time":149.220,"note":101.000,"xyz":[1.901,26.800,-37.450]}},{"noteOn":{"time":149.275,"note":95.000,"xyz":[-3.014,22.000,2.857]}},{"noteOn":{"time":149.315,"note":99.000,"xyz":[-25.557,25.200,22.171]}},{"noteOn":{"time":149.330,"note":109.000,"xyz":[8.106,33.200,1.640]}},{"noteOn":{"time":149.330,"note":99.000,"xyz":[5.979,25.200,-10.026]}},{"noteOn":{"time":149.335,"note":113.000,"xyz":[5.230,36.400,-7.298]}},{"noteOn":{"time":149.365,"note":99.000,"xyz":[3.233,25.200,31.675]}},{"noteOn":{"time":149.450,"note":96.000,"xyz":[-6.763,22.800,-4.553]}},{"noteOn":{"time":149.535,"note":111.000,"xyz":[10.013,34.800,-11.437]}},{"noteOn":{"time":149.535,"note":101.000,"xyz":[32.398,26.800,-11.039]}},{"noteOn":{"time":149.700,"note":96.000,"xyz":[16.358,22.800,-2.439]}},{"noteOn":{"time":149.845,"note":97.000,"xyz":[19.094,23.600,-3.626]}},{"noteOn":{"time":149.875,"note":107.000,"xyz":[-1.495,31.600,6.958]}},{"noteOn":{"time":149.900,"note":103.000,"xyz":[4.837,28.400,-48.603]}},{"noteOn":{"time":149.930,"note":105.000,"xyz":[1.660,30.000,-6.859]}},{"noteOn":{"time":149.975,"note":103.000,"xyz":[2.759,28.400,5.234]}},{"noteOn":{"time":149.995,"note":97.000,"xyz":[29.911,23.600,-19.780]}},{"noteOn":{"time":150.005,"note":96.000,"xyz":[-11.299,22.800,20.982]}},{"noteOn":{"time":150.025,"note":101.000,"xyz":[-11.858,26.800,32.537]}},{"noteOn":{"time":150.060,"note":103.000,"xyz":[9.262,28.400,-34.644]}},{"noteOn":{"time":150.080,"note":89.000,"xyz":[27.255,17.200,20.808]}},{"noteOn":{"time":150.170,"note":109.000,"xyz":[-39.766,33.200,-10.997]}},{"noteOn":{"time":150.265,"note":107.000,"xyz":[-0.883,31.600,-0.925]}},{"noteOn":{"time":150.275,"note":94.000,"xyz":[1.796,21.200,-0.744]}},{"noteOn":{"time":150.335,"note":111.000,"xyz":[13.824,34.800,-4.467]}},{"noteOn":{"time":150.360,"note":111.000,"xyz":[-11.237,34.800,19.679]}},{"noteOn":{"time":150.375,"note":103.000,"xyz":[-27.581,28.400,-13.414]}},{"noteOn":{"time":150.400,"note":109.000,"xyz":[1.330,33.200,3.005]}},{"noteOn":{"time":150.435,"note":107.000,"xyz":[-17.747,31.600,45.465]}},{"noteOn":{"time":150.505,"note":99.000,"xyz":[17.238,25.200,-32.045]}},{"noteOn":{"time":150.550,"note":105.000,"xyz":[13.819,30.000,-15.545]}},{"noteOn":{"time":150.695,"note":107.000,"xyz":[21.770,31.600,32.071]}},{"noteOn":{"time":150.725,"note":96.000,"xyz":[16.625,22.800,25.058]}},{"noteOn":{"time":150.750,"note":95.000,"xyz":[-23.367,22.000,31.482]}},{"noteOn":{"time":150.900,"note":107.000,"xyz":[11.896,31.600,-24.292]}},{"noteOn":{"time":150.930,"note":104.000,"xyz":[1.369,29.200,-4.464]}},{"noteOn":{"time":150.975,"note":94.000,"xyz":[-26.232,21.200,-33.055]}},{"noteOn":{"time":150.985,"note":93.000,"xyz":[2.961,20.400,-26.240]}},{"noteOn":{"time":151.000,"note":97.000,"xyz":[43.270,23.600,11.881]}},{"noteOn":{"time":151.065,"note":109.000,"xyz":[33.198,33.200,-36.780]}},{"noteOn":{"time":151.070,"note":103.000,"xyz":[-14.247,28.400,-15.588]}},{"noteOn":{"time":151.130,"note":106.000,"xyz":[3.017,30.800,-45.888]}},{"noteOn":{"time":151.200,"note":100.000,"xyz":[22.956,26.000,22.959]}},{"noteOn":{"time":151.255,"note":90.000,"xyz":[-29.770,18.000,-35.773]}},{"noteOn":{"time":151.270,"note":106.000,"xyz":[7.543,30.800,-8.147]}},{"noteOn":{"time":151.290,"note":101.000,"xyz":[-23.604,26.800,-1.945]}},{"noteOn":{"time":151.295,"note":98.000,"xyz":[-1.467,24.400,3.704]}},{"noteOn":{"time":151.360,"note":105.000,"xyz":[32.388,30.000,35.903]}},{"noteOn":{"time":151.380,"note":97.000,"xyz":[12.109,23.600,43.283]}},{"noteOn":{"time":151.430,"note":97.000,"xyz":[-39.346,23.600,24.859]}},{"noteOn":{"time":151.670,"note":105.000,"xyz":[-3.982,30.000,31.622]}},{"noteOn":{"time":151.740,"note":95.000,"xyz":[-24.052,22.000,3.523]}},{"noteOn":{"time":151.770,"note":110.000,"xyz":[0.278,34.000,-6.408]}},{"noteOn":{"time":151.775,"note":102.000,"xyz":[43.558,27.600,-6.015]}},{"noteOn":{"time":151.780,"note":107.000,"xyz":[18.968,31.600,27.262]}},{"noteOn":{"time":151.795,"note":96.000,"xyz":[24.473,22.800,-17.758]}},{"noteOn":{"time":151.820,"note":102.000,"xyz":[35.279,27.600,22.775]}},{"noteOn":{"time":151.860,"note":102.000,"xyz":[16.410,27.600,40.015]}},{"noteOn":{"time":151.900,"note":96.000,"xyz":[-2.730,22.800,-5.070]}},{"noteOn":{"time":151.900,"note":102.000,"xyz":[-32.684,27.600,-5.505]}},{"noteOn":{"time":151.915,"note":92.000,"xyz":[-1.253,19.600,-6.433]}},{"noteOn":{"time":151.965,"note":108.000,"xyz":[-42.998,32.400,-23.662]}},{"noteOn":{"time":151.985,"note":114.000,"xyz":[3.542,37.200,-4.203]}},{"noteOn":{"time":152.020,"note":97.000,"xyz":[14.480,23.600,-22.913]}},{"noteOn":{"time":152.075,"note":104.000,"xyz":[48.956,29.200,6.302]}},{"noteOn":{"time":152.185,"note":104.000,"xyz":[-30.192,29.200,-1.710]}},{"noteOn":{"time":152.270,"note":100.000,"xyz":[16.773,26.000,-22.952]}},{"noteOn":{"time":152.300,"note":96.000,"xyz":[6.720,22.800,6.754]}},{"noteOn":{"time":152.465,"note":104.000,"xyz":[-23.137,29.200,-3.952]}},{"noteOn":{"time":152.500,"note":108.000,"xyz":[14.857,32.400,11.119]}},{"noteOn":{"time":152.540,"note":110.000,"xyz":[-16.027,34.000,46.082]}},{"noteOn":{"time":152.565,"note":101.000,"xyz":[2.701,26.800,-0.248]}},{"noteOn":{"time":152.585,"note":100.000,"xyz":[-4.034,26.000,22.912]}},{"noteOn":{"time":152.675,"note":94.000,"xyz":[-16.233,21.200,-33.633]}},{"noteOn":{"time":152.695,"note":92.000,"xyz":[2.654,19.600,4.035]}},{"noteOn":{"time":152.745,"note":100.000,"xyz":[37.771,26.000,-5.049]}},{"noteOn":{"time":152.755,"note":100.000,"xyz":[-6.375,26.000,-26.713]}},{"noteOn":{"time":152.815,"note":102.000,"xyz":[-4.053,27.600,-9.109]}},{"noteOn":{"time":152.850,"note":96.000,"xyz":[22.790,22.800,28.769]}},{"noteOn":{"time":152.920,"note":98.000,"xyz":[-27.097,24.400,3.651]}},{"noteOn":{"time":152.925,"note":114.000,"xyz":[5.723,37.200,-13.521]}},{"noteOn":{"time":152.925,"note":100.000,"xyz":[11.313,26.000,-40.003]}},{"noteOn":{"time":152.940,"note":100.000,"xyz":[27.232,26.000,-19.043]}},{"noteOn":{"time":152.965,"note":105.000,"xyz":[25.040,30.000,28.766]}},{"noteOn":{"time":153.030,"note":110.000,"xyz":[31.948,34.000,6.749]}},{"noteOn":{"time":153.205,"note":102.000,"xyz":[27.885,27.600,15.354]}},{"noteOn":{"time":153.280,"note":94.000,"xyz":[26.019,21.200,13.842]}},{"noteOn":{"time":153.280,"note":112.000,"xyz":[-10.393,35.600,-22.777]}},{"noteOn":{"time":153.360,"note":95.000,"xyz":[4.227,22.000,-37.644]}},{"noteOn":{"time":153.415,"note":102.000,"xyz":[20.757,27.600,-19.087]}},{"noteOn":{"time":153.490,"note":102.000,"xyz":[37.140,27.600,-3.568]}},{"noteOn":{"time":153.535,"note":98.000,"xyz":[-5.335,24.400,3.962]}},{"noteOn":{"time":153.555,"note":112.000,"xyz":[21.491,35.600,-40.498]}},{"noteOn":{"time":153.630,"note":104.000,"xyz":[15.734,29.200,-19.003]}},{"noteOn":{"time":153.665,"note":98.000,"xyz":[7.717,24.400,-8.397]}},{"noteOn":{"time":153.670,"note":100.000,"xyz":[3.295,26.000,-24.369]}},{"noteOn":{"time":153.695,"note":98.000,"xyz":[-40.447,24.400,18.230]}},{"noteOn":{"time":153.720,"note":88.000,"xyz":[2.117,16.400,0.509]}},{"noteOn":{"time":153.765,"note":100.000,"xyz":[32.180,26.000,16.307]}},{"noteOn":{"time":153.825,"note":94.000,"xyz":[3.415,21.200,3.707]}},{"noteOn":{"time":153.835,"note":106.000,"xyz":[-30.185,30.800,-32.347]}},{"noteOn":{"time":153.980,"note":97.000,"xyz":[1.190,23.600,46.121]}},{"noteOn":{"time":154.030,"note":112.000,"xyz":[29.487,35.600,32.686]}},{"noteOn":{"time":154.065,"note":102.000,"xyz":[-3.127,27.600,-2.791]}},{"noteOn":{"time":154.195,"note":96.000,"xyz":[-23.052,22.800,-8.063]}},{"noteOn":{"time":154.385,"note":106.000,"xyz":[20.876,30.800,-37.554]}},{"noteOn":{"time":154.395,"note":96.000,"xyz":[22.141,22.800,-3.973]}},{"noteOn":{"time":154.410,"note":110.000,"xyz":[-6.811,34.000,-21.560]}},{"noteOn":{"time":154.440,"note":98.000,"xyz":[-6.968,24.400,41.029]}},{"noteOn":{"time":154.485,"note":104.000,"xyz":[-29.720,29.200,31.240]}},{"noteOn":{"time":154.505,"note":102.000,"xyz":[6.032,27.600,7.291]}},{"noteOn":{"time":154.515,"note":95.000,"xyz":[-31.546,22.000,6.903]}},{"noteOn":{"time":154.520,"note":102.000,"xyz":[43.328,27.600,-4.220]}},{"noteOn":{"time":154.580,"note":108.000,"xyz":[6.495,32.400,-8.193]}},{"noteOn":{"time":154.610,"note":108.000,"xyz":[28.940,32.400,-38.069]}},{"noteOn":{"time":154.625,"note":108.000,"xyz":[5.608,32.400,38.418]}},{"noteOn":{"time":154.630,"note":112.000,"xyz":[-4.474,35.600,12.652]}},{"noteOn":{"time":154.645,"note":110.000,"xyz":[-22.006,34.000,13.579]}},{"noteOn":{"time":154.700,"note":90.000,"xyz":[9.545,18.000,-6.299]}},{"noteOn":{"time":154.715,"note":102.000,"xyz":[1.588,27.600,40.467]}},{"noteOn":{"time":154.780,"note":93.000,"xyz":[26.195,20.400,-8.482]}},{"noteOn":{"time":154.880,"note":104.000,"xyz":[19.855,29.200,1.622]}},{"noteOn":{"time":155.025,"note":106.000,"xyz":[17.628,30.800,-24.345]}},{"noteOn":{"time":155.045,"note":106.000,"xyz":[-30.286,30.800,-12.620]}},{"noteOn":{"time":155.145,"note":100.000,"xyz":[-13.297,26.000,29.089]}},{"noteOn":{"time":155.195,"note":96.000,"xyz":[-14.352,22.800,1.545]}},{"noteOn":{"time":155.260,"note":106.000,"xyz":[-5.434,30.800,-3.947]}},{"noteOn":{"time":155.270,"note":94.000,"xyz":[-8.941,21.200,-4.573]}},{"noteOn":{"time":155.270,"note":104.000,"xyz":[-24.614,29.200,-15.268]}},{"noteOn":{"time":155.320,"note":106.000,"xyz":[-12.038,30.800,10.141]}},{"noteOn":{"time":155.370,"note":114.000,"xyz":[7.438,37.200,7.844]}},{"noteOn":{"time":155.375,"note":104.000,"xyz":[-8.978,29.200,-19.239]}},{"noteOn":{"time":155.465,"note":93.000,"xyz":[24.419,20.400,26.599]}},{"noteOn":{"time":155.475,"note":108.000,"xyz":[9.309,32.400,-16.896]}},{"noteOn":{"time":155.540,"note":96.000,"xyz":[5.857,22.800,-0.374]}},{"noteOn":{"time":155.545,"note":108.000,"xyz":[-42.101,32.400,-22.615]}},{"noteOn":{"time":155.560,"note":104.000,"xyz":[42.215,29.200,-13.475]}},{"noteOn":{"time":155.595,"note":108.000,"xyz":[12.319,32.400,46.991]}},{"noteOn":{"time":155.695,"note":101.000,"xyz":[25.580,26.800,-8.837]}},{"noteOn":{"time":155.715,"note":99.000,"xyz":[-23.908,25.200,13.780]}},{"noteOn":{"time":155.850,"note":90.000,"xyz":[0.278,18.000,-16.498]}},{"noteOn":{"time":155.945,"note":98.000,"xyz":[-7.095,24.400,-26.748]}},{"noteOn":{"time":155.955,"note":96.000,"xyz":[13.994,22.800,1.890]}},{"noteOn":{"time":156.000,"note":104.000,"xyz":[10.719,29.200,8.157]}},{"noteOn":{"time":156.025,"note":106.000,"xyz":[-39.585,30.800,-28.324]}},{"noteOn":{"time":156.105,"note":106.000,"xyz":[16.417,30.800,25.620]}},{"noteOn":{"time":156.115,"note":110.000,"xyz":[-22.721,34.000,29.305]}},{"noteOn":{"time":156.135,"note":102.000,"xyz":[-26.594,27.600,19.702]}},{"noteOn":{"time":156.185,"note":106.000,"xyz":[-1.756,30.800,13.397]}},{"noteOn":{"time":156.195,"note":102.000,"xyz":[22.781,27.600,-12.412]}},{"noteOn":{"time":156.205,"note":94.000,"xyz":[-28.564,21.200,12.132]}},{"noteOn":{"time":156.260,"note":94.000,"xyz":[4.134,21.200,-25.604]}},{"noteOn":{"time":156.285,"note":101.000,"xyz":[1.907,26.800,-1.732]}},{"noteOn":{"time":156.295,"note":106.000,"xyz":[-11.040,30.800,-2.182]}},{"noteOn":{"time":156.330,"note":103.000,"xyz":[-45.785,28.400,-16.324]}},{"noteOn":{"time":156.350,"note":105.000,"xyz":[-8.620,30.000,12.525]}},{"noteOn":{"time":156.375,"note":95.000,"xyz":[27.636,22.000,-16.541]}},{"noteOn":{"time":156.465,"note":92.000,"xyz":[26.797,19.600,-7.503]}},{"noteOn":{"time":156.555,"note":98.000,"xyz":[8.651,24.400,26.197]}},{"noteOn":{"time":156.585,"note":102.000,"xyz":[-38.259,27.600,20.920]}},{"noteOn":{"time":156.655,"note":108.000,"xyz":[-2.107,32.400,31.745]}},{"noteOn":{"time":156.700,"note":104.000,"xyz":[26.330,29.200,-9.251]}},{"noteOn":{"time":156.720,"note":96.000,"xyz":[3.315,22.800,-1.397]}},{"noteOn":{"time":156.730,"note":114.000,"xyz":[-12.160,37.200,-9.864]}},{"noteOn":{"time":156.770,"note":109.000,"xyz":[-14.954,33.200,-5.143]}},{"noteOn":{"time":156.900,"note":100.000,"xyz":[-1.539,26.000,-7.632]}},{"noteOn":{"time":156.980,"note":96.000,"xyz":[8.693,22.800,10.002]}},{"noteOn":{"time":157.035,"note":104.000,"xyz":[-49.186,29.200,3.685]}},{"noteOn":{"time":157.055,"note":101.000,"xyz":[17.333,26.800,-1.855]}},{"noteOn":{"time":157.070,"note":110.000,"xyz":[3.316,34.000,48.295]}},{"noteOn":{"time":157.105,"note":104.000,"xyz":[-32.361,29.200,3.946]}},{"noteOn":{"time":157.130,"note":107.000,"xyz":[21.645,31.600,28.311]}},{"noteOn":{"time":157.150,"note":100.000,"xyz":[-24.684,26.000,-5.931]}},{"noteOn":{"time":157.195,"note":93.000,"xyz":[-6.245,20.400,4.071]}},{"noteOn":{"time":157.205,"note":93.000,"xyz":[13.174,20.400,16.459]}},{"noteOn":{"time":157.255,"note":99.000,"xyz":[19.800,25.200,21.611]}},{"noteOn":{"time":157.375,"note":113.000,"xyz":[-6.863,36.400,19.830]}},{"noteOn":{"time":157.410,"note":99.000,"xyz":[-5.479,25.200,-0.226]}},{"noteOn":{"time":157.415,"note":100.000,"xyz":[-21.245,26.000,13.265]}},{"noteOn":{"time":157.420,"note":98.000,"xyz":[5.888,24.400,-1.226]}},{"noteOn":{"time":157.425,"note":104.000,"xyz":[7.176,29.200,-12.902]}},{"noteOn":{"time":157.445,"note":95.000,"xyz":[-15.060,22.000,1.088]}},{"noteOn":{"time":157.550,"note":109.000,"xyz":[-0.225,33.200,-17.392]}},{"noteOn":{"time":157.665,"note":111.000,"xyz":[-4.004,34.800,7.695]}},{"noteOn":{"time":157.680,"note":103.000,"xyz":[-31.774,28.400,-18.426]}},{"noteOn":{"time":157.785,"note":95.000,"xyz":[-5.568,22.000,4.041]}},{"noteOn":{"time":157.795,"note":101.000,"xyz":[-12.542,26.800,24.252]}},{"noteOn":{"time":157.860,"note":103.000,"xyz":[7.777,28.400,-14.534]}},{"noteOn":{"time":157.870,"note":95.000,"xyz":[-9.377,22.000,-34.360]}},{"noteOn":{"time":157.885,"note":107.000,"xyz":[-26.426,31.600,27.719]}},{"noteOn":{"time":157.940,"note":100.000,"xyz":[-9.843,26.000,-3.626]}},{"noteOn":{"time":157.955,"note":101.000,"xyz":[-43.032,26.800,14.716]}},{"noteOn":{"time":157.980,"note":113.000,"xyz":[-3.184,36.400,6.428]}},{"noteOn":{"time":157.985,"note":97.000,"xyz":[-28.375,23.600,-31.659]}},{"noteOn":{"time":158.080,"note":97.000,"xyz":[1.400,23.600,-32.927]}},{"noteOn":{"time":158.085,"note":102.000,"xyz":[-3.240,27.600,-8.104]}},{"noteOn":{"time":158.200,"note":103.000,"xyz":[0.436,28.400,0.990]}},{"noteOn":{"time":158.300,"note":89.000,"xyz":[-8.653,17.200,29.821]}},{"noteOn":{"time":158.370,"note":109.000,"xyz":[16.161,33.200,17.659]}},{"noteOn":{"time":158.375,"note":93.000,"xyz":[-3.620,20.400,-3.922]}},{"noteOn":{"time":158.375,"note":111.000,"xyz":[29.974,34.800,38.519]}},{"noteOn":{"time":158.470,"note":98.000,"xyz":[2.260,24.400,0.368]}},{"noteOn":{"time":158.470,"note":111.000,"xyz":[-26.938,34.800,16.621]}},{"noteOn":{"time":158.545,"note":101.000,"xyz":[11.673,26.800,9.479]}},{"noteOn":{"time":158.545,"note":103.000,"xyz":[-9.934,28.400,-8.328]}},{"noteOn":{"time":158.615,"note":107.000,"xyz":[-18.039,31.600,35.312]}},{"noteOn":{"time":158.630,"note":97.000,"xyz":[33.560,23.600,28.811]}},{"noteOn":{"time":158.690,"note":95.000,"xyz":[-0.463,22.000,9.809]}},{"noteOn":{"time":158.715,"note":95.000,"xyz":[-11.207,22.000,16.262]}},{"noteOn":{"time":158.725,"note":109.000,"xyz":[7.124,33.200,-3.908]}},{"noteOn":{"time":158.785,"note":107.000,"xyz":[7.135,31.600,3.288]}},{"noteOn":{"time":158.860,"note":107.000,"xyz":[10.804,31.600,-7.173]}},{"noteOn":{"time":158.895,"note":105.000,"xyz":[3.113,30.000,4.498]}},{"noteOn":{"time":158.910,"note":109.000,"xyz":[-20.426,33.200,10.148]}},{"noteOn":{"time":158.985,"note":94.000,"xyz":[-6.735,21.200,15.023]}},{"noteOn":{"time":159.015,"note":101.000,"xyz":[5.845,26.800,1.764]}},{"noteOn":{"time":159.035,"note":99.000,"xyz":[-2.209,25.200,4.081]}},{"noteOn":{"time":159.090,"note":105.000,"xyz":[12.090,30.000,10.802]}},{"noteOn":{"time":159.240,"note":91.000,"xyz":[27.355,18.800,-6.470]}},{"noteOn":{"time":159.245,"note":109.000,"xyz":[-12.482,33.200,4.467]}},{"noteOn":{"time":159.255,"note":105.000,"xyz":[9.673,30.000,10.004]}},{"noteOn":{"time":159.290,"note":93.000,"xyz":[12.205,20.400,-1.273]}},{"noteOn":{"time":159.320,"note":113.000,"xyz":[16.276,36.400,-4.568]}},{"noteOn":{"time":159.345,"note":103.000,"xyz":[-10.210,28.400,6.227]}},{"noteOn":{"time":159.405,"note":107.000,"xyz":[17.134,31.600,-28.832]}},{"noteOn":{"time":159.560,"note":103.000,"xyz":[24.732,28.400,-28.477]}},{"noteOn":{"time":159.560,"note":105.000,"xyz":[18.822,30.000,-7.743]}},{"noteOn":{"time":159.620,"note":107.000,"xyz":[16.772,31.600,-4.752]}},{"noteOn":{"time":159.655,"note":97.000,"xyz":[1.445,23.600,-1.159]}},{"noteOn":{"time":159.675,"note":105.000,"xyz":[-14.333,30.000,16.094]}},{"noteOn":{"time":159.705,"note":105.000,"xyz":[1.644,30.000,-0.395]}},{"noteOn":{"time":159.715,"note":95.000,"xyz":[14.616,22.000,-6.657]}},{"noteOn":{"time":159.785,"note":101.000,"xyz":[-24.904,26.800,29.030]}},{"noteOn":{"time":159.815,"note":107.000,"xyz":[1.183,31.600,-6.495]}},{"noteOn":{"time":159.910,"note":109.000,"xyz":[-46.749,33.200,12.342]}},{"noteOn":{"time":159.915,"note":92.000,"xyz":[-14.087,19.600,-6.300]}},{"noteOn":{"time":159.935,"note":103.000,"xyz":[-24.250,28.400,18.616]}},{"noteOn":{"time":160.005,"note":95.000,"xyz":[27.876,22.000,9.910]}},{"noteOn":{"time":160.070,"note":107.000,"xyz":[-19.388,31.600,9.663]}},{"noteOn":{"time":160.130,"note":115.000,"xyz":[-7.723,38.000,38.943]}},{"noteOn":{"time":160.190,"note":99.000,"xyz":[-3.188,25.200,2.180]}},{"noteOn":{"time":160.190,"note":101.000,"xyz":[2.198,26.800,-2.950]}},{"noteOn":{"time":160.225,"note":105.000,"xyz":[-45.993,30.000,-11.464]}},{"noteOn":{"time":160.320,"note":107.000,"xyz":[28.352,31.600,10.871]}},{"noteOn":{"time":160.365,"note":97.000,"xyz":[6.232,23.600,3.947]}},{"noteOn":{"time":160.375,"note":105.000,"xyz":[-25.461,30.000,-4.416]}},{"noteOn":{"time":160.420,"note":99.000,"xyz":[-12.756,25.200,9.275]}},{"noteOn":{"time":160.445,"note":91.000,"xyz":[5.034,18.800,28.773]}},{"noteOn":{"time":160.555,"note":101.000,"xyz":[-21.548,26.800,8.367]}},{"noteOn":{"time":160.555,"note":109.000,"xyz":[-24.816,33.200,-13.465]}},{"noteOn":{"time":160.565,"note":103.000,"xyz":[20.696,28.400,-28.415]}},{"noteOn":{"time":160.590,"note":93.000,"xyz":[-19.049,20.400,-16.768]}},{"noteOn":{"time":160.670,"note":103.000,"xyz":[7.695,28.400,1.499]}},{"noteOn":{"time":160.695,"note":105.000,"xyz":[-19.180,30.000,24.617]}},{"noteOn":{"time":160.755,"note":102.000,"xyz":[-4.799,27.600,2.447]}},{"noteOn":{"time":160.795,"note":100.000,"xyz":[-14.460,26.000,-18.083]}},{"noteOn":{"time":160.810,"note":111.000,"xyz":[-19.896,34.800,9.400]}},{"noteOn":{"time":160.905,"note":95.000,"xyz":[2.765,22.000,-1.781]}},{"noteOn":{"time":161.015,"note":93.000,"xyz":[-14.843,20.400,19.742]}},{"noteOn":{"time":161.065,"note":105.000,"xyz":[-14.863,30.000,31.914]}},{"noteOn":{"time":161.090,"note":99.000,"xyz":[-16.502,25.200,-23.990]}},{"noteOn":{"time":161.125,"note":95.000,"xyz":[4.987,22.000,-15.542]}},{"noteOn":{"time":161.150,"note":99.000,"xyz":[-7.090,25.200,38.429]}},{"noteOn":{"time":161.185,"note":97.000,"xyz":[-4.496,23.600,1.970]}},{"noteOn":{"time":161.195,"note":103.000,"xyz":[-2.198,28.400,-37.030]}},{"noteOn":{"time":161.220,"note":101.000,"xyz":[-30.089,26.800,11.945]}},{"noteOn":{"time":161.255,"note":115.000,"xyz":[-20.614,38.000,-3.735]}},{"noteOn":{"time":161.270,"note":101.000,"xyz":[-0.285,26.800,14.619]}},{"noteOn":{"time":161.325,"note":105.000,"xyz":[-4.238,30.000,-1.541]}},{"noteOn":{"time":161.345,"note":103.000,"xyz":[-12.364,28.400,10.105]}},{"noteOn":{"time":161.375,"note":107.000,"xyz":[-22.469,31.600,18.306]}},{"noteOn":{"time":161.380,"note":109.000,"xyz":[17.759,33.200,-6.229]}},{"noteOn":{"time":161.500,"note":100.000,"xyz":[2.736,26.000,-0.038]}},{"noteOn":{"time":161.595,"note":111.000,"xyz":[-0.200,34.800,48.968]}},{"noteOn":{"time":161.690,"note":94.000,"xyz":[39.794,21.200,-9.191]}},{"noteOn":{"time":161.755,"note":97.000,"xyz":[15.779,23.600,-5.719]}},{"noteOn":{"time":161.790,"note":92.000,"xyz":[25.667,19.600,3.596]}},{"noteOn":{"time":161.830,"note":101.000,"xyz":[30.390,26.800,31.834]}},{"noteOn":{"time":161.835,"note":103.000,"xyz":[11.646,28.400,-29.385]}},{"noteOn":{"time":161.865,"note":99.000,"xyz":[-14.097,25.200,7.431]}},{"noteOn":{"time":161.925,"note":102.000,"xyz":[-6.545,27.600,-1.277]}},{"noteOn":{"time":161.965,"note":99.000,"xyz":[6.920,25.200,9.407]}},{"noteOn":{"time":161.995,"note":95.000,"xyz":[-9.602,22.000,19.997]}},{"noteOn":{"time":162.030,"note":113.000,"xyz":[5.511,36.400,-46.154]}},{"noteOn":{"time":162.100,"note":99.000,"xyz":[2.110,25.200,-0.282]}},{"noteOn":{"time":162.150,"note":113.000,"xyz":[36.201,36.400,-6.340]}},{"noteOn":{"time":162.185,"note":101.000,"xyz":[29.840,26.800,36.927]}},{"noteOn":{"time":162.295,"note":110.000,"xyz":[-14.889,34.000,46.480]}},{"noteOn":{"time":162.295,"note":96.000,"xyz":[-30.325,22.800,21.690]}},{"noteOn":{"time":162.315,"note":103.000,"xyz":[20.095,28.400,34.693]}},{"noteOn":{"time":162.335,"note":96.000,"xyz":[-5.933,22.800,31.232]}},{"noteOn":{"time":162.345,"note":108.000,"xyz":[-43.771,32.400,20.501]}},{"noteOn":{"time":162.420,"note":103.000,"xyz":[-32.206,28.400,6.274]}},{"noteOn":{"time":162.445,"note":97.000,"xyz":[29.986,23.600,-27.152]}},{"noteOn":{"time":162.555,"note":106.000,"xyz":[-6.233,30.800,-2.133]}},{"noteOn":{"time":162.625,"note":99.000,"xyz":[-5.088,25.200,34.255]}},{"noteOn":{"time":162.685,"note":101.000,"xyz":[-28.872,26.800,-25.881]}},{"noteOn":{"time":162.705,"note":97.000,"xyz":[22.403,23.600,-2.033]}},{"noteOn":{"time":162.730,"note":102.000,"xyz":[-17.125,27.600,-12.758]}},{"noteOn":{"time":162.880,"note":92.000,"xyz":[10.685,19.600,0.891]}},{"noteOn":{"time":162.910,"note":110.000,"xyz":[-14.255,34.000,4.856]}},{"noteOn":{"time":162.915,"note":98.000,"xyz":[5.390,24.400,-7.271]}},{"noteOn":{"time":162.920,"note":89.000,"xyz":[13.936,17.200,1.956]}},{"noteOn":{"time":162.965,"note":108.000,"xyz":[3.419,32.400,-8.055]}},{"noteOn":{"time":163.070,"note":103.000,"xyz":[-9.983,28.400,-13.301]}},{"noteOn":{"time":163.085,"note":111.000,"xyz":[-0.546,34.800,16.910]}},{"noteOn":{"time":163.100,"note":102.000,"xyz":[5.754,27.600,18.223]}},{"noteOn":{"time":163.135,"note":108.000,"xyz":[-36.712,32.400,3.479]}},{"noteOn":{"time":163.155,"note":94.000,"xyz":[-23.348,21.200,-18.442]}},{"noteOn":{"time":163.190,"note":94.000,"xyz":[11.542,21.200,40.155]}},{"noteOn":{"time":163.220,"note":106.000,"xyz":[-8.883,30.800,-27.721]}},{"noteOn":{"time":163.230,"note":97.000,"xyz":[5.214,23.600,18.788]}},{"noteOn":{"time":163.305,"note":105.000,"xyz":[18.517,30.000,16.076]}},{"noteOn":{"time":163.420,"note":106.000,"xyz":[-41.993,30.800,-9.711]}},{"noteOn":{"time":163.425,"note":93.000,"xyz":[3.808,20.400,-8.469]}},{"noteOn":{"time":163.485,"note":104.000,"xyz":[-46.594,29.200,-10.626]}},{"noteOn":{"time":163.490,"note":100.000,"xyz":[-44.853,26.000,-17.616]}},{"noteOn":{"time":163.545,"note":110.000,"xyz":[1.180,34.000,7.068]}},{"noteOn":{"time":163.585,"note":100.000,"xyz":[-3.670,26.000,9.221]}},{"noteOn":{"time":163.650,"note":104.000,"xyz":[2.816,29.200,16.626]}},{"noteOn":{"time":163.730,"note":114.000,"xyz":[14.931,37.200,-19.731]}},{"noteOn":{"time":163.750,"note":108.000,"xyz":[42.117,32.400,-10.887]}},{"noteOn":{"time":163.785,"note":92.000,"xyz":[-42.124,19.600,3.548]}},{"noteOn":{"time":163.800,"note":92.000,"xyz":[22.406,19.600,-5.464]}},{"noteOn":{"time":163.870,"note":108.000,"xyz":[-23.841,32.400,-8.746]}},{"noteOn":{"time":163.970,"note":106.000,"xyz":[-47.365,30.800,-1.623]}},{"noteOn":{"time":164.035,"note":96.000,"xyz":[15.937,22.800,-37.544]}},{"noteOn":{"time":164.070,"note":103.000,"xyz":[-5.245,28.400,32.704]}},{"noteOn":{"time":164.075,"note":98.000,"xyz":[-1.199,24.400,-2.190]}},{"noteOn":{"time":164.085,"note":104.000,"xyz":[5.575,29.200,-3.186]}},{"noteOn":{"time":164.210,"note":108.000,"xyz":[21.984,32.400,-1.572]}},{"noteOn":{"time":164.215,"note":107.000,"xyz":[-10.548,31.600,-8.721]}},{"noteOn":{"time":164.285,"note":106.000,"xyz":[-19.841,30.800,20.555]}},{"noteOn":{"time":164.310,"note":102.000,"xyz":[-24.635,27.600,5.236]}},{"noteOn":{"time":164.330,"note":91.000,"xyz":[-2.589,18.800,0.738]}},{"noteOn":{"time":164.375,"note":116.000,"xyz":[-22.547,38.800,38.285]}},{"noteOn":{"time":164.380,"note":100.000,"xyz":[-26.962,26.000,-41.996]}},{"noteOn":{"time":164.390,"note":104.000,"xyz":[37.568,29.200,5.984]}},{"noteOn":{"time":164.470,"note":94.000,"xyz":[12.547,21.200,-30.965]}},{"noteOn":{"time":164.475,"note":110.000,"xyz":[-10.951,34.000,2.257]}},{"noteOn":{"time":164.545,"note":106.000,"xyz":[4.672,30.800,-22.405]}},{"noteOn":{"time":164.595,"note":106.000,"xyz":[6.741,30.800,-4.793]}},{"noteOn":{"time":164.650,"note":104.000,"xyz":[-3.515,29.200,23.201]}},{"noteOn":{"time":164.670,"note":100.000,"xyz":[43.833,26.000,-21.618]}},{"noteOn":{"time":164.690,"note":102.000,"xyz":[0.770,27.600,11.847]}},{"noteOn":{"time":164.775,"note":98.000,"xyz":[32.513,24.400,1.516]}},{"noteOn":{"time":164.830,"note":104.000,"xyz":[-31.571,29.200,6.670]}},{"noteOn":{"time":164.895,"note":104.000,"xyz":[-16.486,29.200,-2.003]}},{"noteOn":{"time":164.975,"note":92.000,"xyz":[-1.093,19.600,1.328]}},{"noteOn":{"time":164.980,"note":100.000,"xyz":[21.706,26.000,43.379]}},{"noteOn":{"time":164.995,"note":92.000,"xyz":[47.055,19.600,-7.124]}},{"noteOn":{"time":165.010,"note":102.000,"xyz":[8.339,27.600,4.177]}},{"noteOn":{"time":165.105,"note":108.000,"xyz":[-5.836,32.400,-15.919]}},{"noteOn":{"time":165.150,"note":101.000,"xyz":[-8.549,26.800,39.461]}},{"noteOn":{"time":165.185,"note":100.000,"xyz":[14.529,26.000,33.791]}},{"noteOn":{"time":165.190,"note":110.000,"xyz":[-28.219,34.000,-38.345]}},{"noteOn":{"time":165.190,"note":112.000,"xyz":[23.017,35.600,7.391]}},{"noteOn":{"time":165.250,"note":104.000,"xyz":[-9.502,29.200,21.837]}},{"noteOn":{"time":165.265,"note":106.000,"xyz":[-1.037,30.800,-1.246]}},{"noteOn":{"time":165.305,"note":100.000,"xyz":[-11.193,26.000,-8.166]}},{"noteOn":{"time":165.435,"note":94.000,"xyz":[20.981,21.200,3.012]}},{"noteOn":{"time":165.440,"note":114.000,"xyz":[27.762,37.200,-20.774]}},{"noteOn":{"time":165.460,"note":96.000,"xyz":[-5.292,22.800,-35.460]}},{"noteOn":{"time":165.520,"note":94.000,"xyz":[-47.535,21.200,-2.221]}},{"noteOn":{"time":165.630,"note":102.000,"xyz":[-2.549,27.600,9.858]}},{"noteOn":{"time":165.655,"note":98.000,"xyz":[12.700,24.400,23.952]}},{"noteOn":{"time":165.660,"note":102.000,"xyz":[-11.777,27.600,1.026]}},{"noteOn":{"time":165.710,"note":106.000,"xyz":[0.304,30.800,-5.562]}},{"noteOn":{"time":165.750,"note":100.000,"xyz":[17.729,26.000,6.500]}},{"noteOn":{"time":165.835,"note":100.000,"xyz":[19.395,26.000,25.027]}},{"noteOn":{"time":165.915,"note":99.000,"xyz":[7.398,25.200,30.960]}},{"noteOn":{"time":166.005,"note":98.000,"xyz":[-10.022,24.400,14.299]}},{"noteOn":{"time":166.010,"note":100.000,"xyz":[-26.079,26.000,23.092]}},{"noteOn":{"time":166.045,"note":102.000,"xyz":[-2.071,27.600,-20.159]}},{"noteOn":{"time":166.075,"note":112.000,"xyz":[5.038,35.600,-18.580]}},{"noteOn":{"time":166.105,"note":110.000,"xyz":[45.437,34.000,-8.771]}},{"noteOn":{"time":166.135,"note":108.000,"xyz":[32.247,32.400,25.924]}},{"noteOn":{"time":166.190,"note":94.000,"xyz":[-32.299,21.200,-14.023]}},{"noteOn":{"time":166.245,"note":112.000,"xyz":[44.628,35.600,-18.866]}},{"noteOn":{"time":166.255,"note":102.000,"xyz":[7.085,27.600,21.954]}},{"noteOn":{"time":166.325,"note":100.000,"xyz":[41.081,26.000,-19.333]}},{"noteOn":{"time":166.375,"note":92.000,"xyz":[-24.277,19.600,-17.615]}},{"noteOn":{"time":166.425,"note":98.000,"xyz":[-3.290,24.400,-16.260]}},{"noteOn":{"time":166.455,"note":94.000,"xyz":[-2.705,21.200,47.398]}},{"noteOn":{"time":166.510,"note":100.000,"xyz":[-37.204,26.000,-8.591]}},{"noteOn":{"time":166.515,"note":102.000,"xyz":[0.141,27.600,-1.035]}},{"noteOn":{"time":166.575,"note":112.000,"xyz":[6.811,35.600,-2.858]}},{"noteOn":{"time":166.625,"note":104.000,"xyz":[-13.578,29.200,29.327]}},{"noteOn":{"time":166.705,"note":98.000,"xyz":[20.676,24.400,27.802]}},{"noteOn":{"time":166.765,"note":110.000,"xyz":[-32.100,34.000,14.772]}},{"noteOn":{"time":166.775,"note":97.000,"xyz":[14.802,23.600,-23.850]}},{"noteOn":{"time":166.785,"note":98.000,"xyz":[12.356,24.400,1.975]}},{"noteOn":{"time":166.810,"note":97.000,"xyz":[-3.249,23.600,-36.194]}},{"noteOn":{"time":166.815,"note":108.000,"xyz":[22.809,32.400,-9.116]}},{"noteOn":{"time":166.875,"note":112.000,"xyz":[-18.818,35.600,-11.262]}},{"noteOn":{"time":166.890,"note":102.000,"xyz":[6.542,27.600,-1.357]}},{"noteOn":{"time":166.895,"note":108.000,"xyz":[-4.074,32.400,-4.829]}},{"noteOn":{"time":167.050,"note":104.000,"xyz":[-42.208,29.200,16.761]}},{"noteOn":{"time":167.110,"note":110.000,"xyz":[10.199,34.000,14.848]}},{"noteOn":{"time":167.160,"note":96.000,"xyz":[-18.976,22.800,6.346]}},{"noteOn":{"time":167.190,"note":115.000,"xyz":[35.504,38.000,9.076]}},{"noteOn":{"time":167.220,"note":100.000,"xyz":[-2.122,26.000,-39.415]}},{"noteOn":{"time":167.260,"note":101.000,"xyz":[16.710,26.800,14.543]}},{"noteOn":{"time":167.300,"note":92.000,"xyz":[-17.189,19.600,-42.486]}},{"noteOn":{"time":167.305,"note":96.000,"xyz":[0.741,22.800,2.944]}},{"noteOn":{"time":167.315,"note":102.000,"xyz":[-15.367,27.600,26.374]}},{"noteOn":{"time":167.325,"note":98.000,"xyz":[23.314,24.400,-19.733]}},{"noteOn":{"time":167.330,"note":99.000,"xyz":[-6.547,25.200,-2.866]}},{"noteOn":{"time":167.380,"note":107.000,"xyz":[28.736,31.600,31.614]}},{"noteOn":{"time":167.475,"note":90.000,"xyz":[-16.864,18.000,12.390]}},{"noteOn":{"time":167.600,"note":104.000,"xyz":[14.453,29.200,46.319]}},{"noteOn":{"time":167.610,"note":110.000,"xyz":[11.406,34.000,28.262]}},{"noteOn":{"time":167.665,"note":94.000,"xyz":[38.954,21.200,2.585]}},{"noteOn":{"time":167.690,"note":93.000,"xyz":[9.006,20.400,-14.652]}},{"noteOn":{"time":167.785,"note":106.000,"xyz":[18.537,30.800,24.802]}},{"noteOn":{"time":167.810,"note":106.000,"xyz":[-10.859,30.800,17.489]}},{"noteOn":{"time":167.860,"note":93.000,"xyz":[1.013,20.400,-41.121]}},{"noteOn":{"time":167.890,"note":110.000,"xyz":[0.694,34.000,14.654]}},{"noteOn":{"time":167.965,"note":99.000,"xyz":[-9.888,25.200,2.136]}},{"noteOn":{"time":167.980,"note":105.000,"xyz":[20.977,30.000,3.789]}},{"noteOn":{"time":167.985,"note":106.000,"xyz":[-4.880,30.800,-20.695]}},{"noteOn":{"time":168.005,"note":108.000,"xyz":[2.982,32.400,1.981]}},{"noteOn":{"time":168.025,"note":105.000,"xyz":[11.208,30.000,11.748]}},{"noteOn":{"time":168.050,"note":100.000,"xyz":[4.553,26.000,1.462]}},{"noteOn":{"time":168.055,"note":104.000,"xyz":[-4.977,29.200,-42.957]}},{"noteOn":{"time":168.060,"note":106.000,"xyz":[-3.305,30.800,-4.404]}},{"noteOn":{"time":168.155,"note":108.000,"xyz":[38.902,32.400,-3.894]}},{"noteOn":{"time":168.235,"note":115.000,"xyz":[-16.219,38.000,4.546]}},{"noteOn":{"time":168.260,"note":92.000,"xyz":[6.797,19.600,-17.097]}},{"noteOn":{"time":168.315,"note":91.000,"xyz":[26.749,18.800,4.367]}},{"noteOn":{"time":168.350,"note":106.000,"xyz":[20.730,30.800,-25.032]}},{"noteOn":{"time":168.425,"note":96.000,"xyz":[-32.454,22.800,-25.012]}},{"noteOn":{"time":168.495,"note":99.000,"xyz":[-28.908,25.200,2.993]}},{"noteOn":{"time":168.525,"note":107.000,"xyz":[0.191,31.600,-34.521]}},{"noteOn":{"time":168.570,"note":104.000,"xyz":[-18.364,29.200,38.462]}},{"noteOn":{"time":168.595,"note":103.000,"xyz":[14.132,28.400,1.320]}},{"noteOn":{"time":168.690,"note":108.000,"xyz":[12.723,32.400,43.715]}},{"noteOn":{"time":168.705,"note":103.000,"xyz":[-26.232,28.400,21.317]}},{"noteOn":{"time":168.735,"note":105.000,"xyz":[5.751,30.000,-36.932]}},{"noteOn":{"time":168.745,"note":91.000,"xyz":[-0.241,18.800,15.545]}},{"noteOn":{"time":168.860,"note":104.000,"xyz":[-4.163,29.200,1.879]}},{"noteOn":{"time":168.870,"note":94.000,"xyz":[5.685,21.200,-23.690]}},{"noteOn":{"time":168.890,"note":99.000,"xyz":[-11.155,25.200,21.836]}},{"noteOn":{"time":168.945,"note":101.000,"xyz":[8.327,26.800,-22.454]}},{"noteOn":{"time":168.995,"note":107.000,"xyz":[-7.288,31.600,-26.454]}},{"noteOn":{"time":169.045,"note":111.000,"xyz":[25.576,34.800,-20.289]}},{"noteOn":{"time":169.075,"note":105.000,"xyz":[-0.059,30.000,2.898]}},{"noteOn":{"time":169.140,"note":115.000,"xyz":[-1.588,38.000,-5.111]}},{"noteOn":{"time":169.145,"note":101.000,"xyz":[-1.577,26.800,-27.572]}},{"noteOn":{"time":169.150,"note":113.000,"xyz":[-8.682,36.400,-10.925]}},{"noteOn":{"time":169.190,"note":101.000,"xyz":[6.808,26.800,1.573]}},{"noteOn":{"time":169.230,"note":105.000,"xyz":[0.796,30.000,-13.150]}},{"noteOn":{"time":169.295,"note":97.000,"xyz":[3.910,23.600,9.597]}},{"noteOn":{"time":169.320,"note":98.000,"xyz":[0.741,24.400,0.788]}},{"noteOn":{"time":169.330,"note":101.000,"xyz":[-0.943,26.800,35.949]}},{"noteOn":{"time":169.425,"note":101.000,"xyz":[-42.654,26.800,7.283]}},{"noteOn":{"time":169.440,"note":91.000,"xyz":[1.041,18.800,-6.675]}},{"noteOn":{"time":169.460,"note":93.000,"xyz":[-6.253,20.400,-0.172]}},{"noteOn":{"time":169.545,"note":100.000,"xyz":[16.939,26.000,-7.937]}},{"noteOn":{"time":169.545,"note":103.000,"xyz":[-5.071,28.400,8.254]}},{"noteOn":{"time":169.580,"note":109.000,"xyz":[1.855,33.200,2.833]}},{"noteOn":{"time":169.720,"note":113.000,"xyz":[2.806,36.400,-40.730]}},{"noteOn":{"time":169.780,"note":103.000,"xyz":[-49.653,28.400,5.493]}},{"noteOn":{"time":169.800,"note":107.000,"xyz":[-0.778,31.600,9.665]}},{"noteOn":{"time":169.815,"note":99.000,"xyz":[-0.946,25.200,-2.613]}},{"noteOn":{"time":169.815,"note":99.000,"xyz":[11.245,25.200,-37.827]}},{"noteOn":{"time":169.835,"note":99.000,"xyz":[-10.662,25.200,22.173]}},{"noteOn":{"time":169.855,"note":111.000,"xyz":[24.200,34.800,15.524]}},{"noteOn":{"time":169.875,"note":109.000,"xyz":[5.083,33.200,14.565]}},{"noteOn":{"time":169.935,"note":103.000,"xyz":[-19.352,28.400,-11.521]}},{"noteOn":{"time":169.965,"note":93.000,"xyz":[-28.759,20.400,-20.696]}},{"noteOn":{"time":169.980,"note":95.000,"xyz":[4.483,22.000,21.685]}},{"noteOn":{"time":170.130,"note":107.000,"xyz":[11.461,31.600,42.316]}},{"noteOn":{"time":170.160,"note":101.000,"xyz":[32.586,26.800,-2.447]}},{"noteOn":{"time":170.195,"note":99.000,"xyz":[4.320,25.200,13.041]}},{"noteOn":{"time":170.270,"note":111.000,"xyz":[19.924,34.800,7.918]}},{"noteOn":{"time":170.280,"note":99.000,"xyz":[34.260,25.200,-6.533]}},{"noteOn":{"time":170.335,"note":98.000,"xyz":[14.689,24.400,-14.827]}},{"noteOn":{"time":170.385,"note":109.000,"xyz":[-12.636,33.200,16.076]}},{"noteOn":{"time":170.395,"note":113.000,"xyz":[-17.044,36.400,6.429]}},{"noteOn":{"time":170.480,"note":103.000,"xyz":[-5.899,28.400,33.936]}},{"noteOn":{"time":170.485,"note":109.000,"xyz":[7.991,33.200,-9.548]}},{"noteOn":{"time":170.510,"note":113.000,"xyz":[6.231,36.400,-10.685]}},{"noteOn":{"time":170.530,"note":97.000,"xyz":[-39.322,23.600,-5.696]}},{"noteOn":{"time":170.605,"note":113.000,"xyz":[1.201,36.400,0.697]}},{"noteOn":{"time":170.645,"note":101.000,"xyz":[-0.157,26.800,-4.220]}},{"noteOn":{"time":170.690,"note":95.000,"xyz":[-2.235,22.000,-32.164]}},{"noteOn":{"time":170.855,"note":101.000,"xyz":[3.336,26.800,-13.732]}},{"noteOn":{"time":170.870,"note":93.000,"xyz":[-24.082,20.400,-12.706]}},{"noteOn":{"time":170.885,"note":97.000,"xyz":[0.684,23.600,11.227]}},{"noteOn":{"time":170.915,"note":97.000,"xyz":[12.863,23.600,-30.762]}},{"noteOn":{"time":170.965,"note":93.000,"xyz":[-40.743,20.400,-1.759]}},{"noteOn":{"time":171.025,"note":107.000,"xyz":[-17.800,31.600,-7.546]}},{"noteOn":{"time":171.080,"note":103.000,"xyz":[-37.022,28.400,19.911]}},{"noteOn":{"time":171.105,"note":95.000,"xyz":[-13.327,22.000,12.056]}},{"noteOn":{"time":171.125,"note":111.000,"xyz":[-20.728,34.800,29.734]}},{"noteOn":{"time":171.130,"note":99.000,"xyz":[-1.503,25.200,-0.136]}},{"noteOn":{"time":171.160,"note":101.000,"xyz":[-7.208,26.800,-29.834]}},{"noteOn":{"time":171.210,"note":109.000,"xyz":[-16.329,33.200,-6.020]}},{"noteOn":{"time":171.210,"note":98.000,"xyz":[-14.866,24.400,-11.266]}},{"noteOn":{"time":171.265,"note":115.000,"xyz":[-26.535,38.000,32.647]}},{"noteOn":{"time":171.290,"note":105.000,"xyz":[0.729,30.000,43.089]}},{"noteOn":{"time":171.295,"note":101.000,"xyz":[18.953,26.800,38.432]}},{"noteOn":{"time":171.320,"note":97.000,"xyz":[42.139,23.600,-17.458]}},{"noteOn":{"time":171.455,"note":111.000,"xyz":[10.249,34.800,31.480]}},{"noteOn":{"time":171.630,"note":99.000,"xyz":[3.816,25.200,23.811]}},{"noteOn":{"time":171.670,"note":91.000,"xyz":[21.667,18.800,-21.183]}},{"noteOn":{"time":171.730,"note":105.000,"xyz":[25.058,30.000,-22.923]}},{"noteOn":{"time":171.750,"note":100.000,"xyz":[0.433,26.000,21.442]}},{"noteOn":{"time":171.755,"note":99.000,"xyz":[-10.140,25.200,3.016]}},{"noteOn":{"time":171.755,"note":103.000,"xyz":[-20.261,28.400,-9.594]}},{"noteOn":{"time":171.770,"note":105.000,"xyz":[23.993,30.000,-25.348]}},{"noteOn":{"time":171.775,"note":95.000,"xyz":[-6.119,22.000,-4.670]}},{"noteOn":{"time":171.780,"note":103.000,"xyz":[-5.096,28.400,4.730]}},{"noteOn":{"time":171.790,"note":101.000,"xyz":[-11.452,26.800,1.096]}},{"noteOn":{"time":171.835,"note":109.000,"xyz":[10.499,33.200,-16.579]}},{"noteOn":{"time":171.895,"note":109.000,"xyz":[-16.933,33.200,-18.761]}},{"noteOn":{"time":171.920,"note":109.000,"xyz":[0.680,33.200,-4.236]}},{"noteOn":{"time":171.965,"note":105.000,"xyz":[7.118,30.000,48.130]}},{"noteOn":{"time":172.015,"note":91.000,"xyz":[-27.511,18.800,25.236]}},{"noteOn":{"time":172.080,"note":105.000,"xyz":[33.047,30.000,32.695]}},{"noteOn":{"time":172.140,"note":107.000,"xyz":[5.079,31.600,-10.373]}},{"noteOn":{"time":172.190,"note":92.000,"xyz":[41.667,19.600,-9.221]}},{"noteOn":{"time":172.240,"note":95.000,"xyz":[24.906,22.000,-19.182]}},{"noteOn":{"time":172.300,"note":92.000,"xyz":[34.591,19.600,-10.161]}},{"noteOn":{"time":172.370,"note":103.000,"xyz":[-27.550,28.400,-26.320]}},{"noteOn":{"time":172.385,"note":107.000,"xyz":[-13.942,31.600,-11.771]}},{"noteOn":{"time":172.410,"note":107.000,"xyz":[30.965,31.600,-22.982]}},{"noteOn":{"time":172.445,"note":99.000,"xyz":[21.002,25.200,-36.542]}},{"noteOn":{"time":172.445,"note":105.000,"xyz":[17.382,30.000,-16.815]}},{"noteOn":{"time":172.465,"note":101.000,"xyz":[25.477,26.800,-19.347]}},{"noteOn":{"time":172.475,"note":111.000,"xyz":[18.786,34.800,27.153]}},{"noteOn":{"time":172.550,"note":105.000,"xyz":[-4.138,30.000,-10.862]}},{"noteOn":{"time":172.685,"note":107.000,"xyz":[-21.614,31.600,-29.977]}},{"noteOn":{"time":172.710,"note":105.000,"xyz":[34.871,30.000,-17.059]}},{"noteOn":{"time":172.725,"note":93.000,"xyz":[-38.967,20.400,-27.917]}},{"noteOn":{"time":172.745,"note":105.000,"xyz":[-3.468,30.000,-6.524]}},{"noteOn":{"time":172.825,"note":90.000,"xyz":[-0.125,18.000,7.286]}},{"noteOn":{"time":172.830,"note":115.000,"xyz":[7.301,38.000,42.784]}},{"noteOn":{"time":172.855,"note":107.000,"xyz":[8.350,31.600,-3.676]}},{"noteOn":{"time":172.880,"note":97.000,"xyz":[38.065,23.600,-0.333]}},{"noteOn":{"time":172.935,"note":108.000,"xyz":[0.892,32.400,-13.607]}},{"noteOn":{"time":172.970,"note":100.000,"xyz":[9.131,26.000,4.748]}},{"noteOn":{"time":173.005,"note":97.000,"xyz":[-19.157,23.600,21.469]}},{"noteOn":{"time":173.050,"note":105.000,"xyz":[-9.812,30.000,14.268]}},{"noteOn":{"time":173.055,"note":103.000,"xyz":[-19.510,28.400,-7.851]}},{"noteOn":{"time":173.095,"note":107.000,"xyz":[23.728,31.600,-26.758]}},{"noteOn":{"time":173.100,"note":107.000,"xyz":[18.307,31.600,-0.187]}},{"noteOn":{"time":173.165,"note":92.000,"xyz":[25.959,19.600,-33.493]}},{"noteOn":{"time":173.165,"note":103.000,"xyz":[-16.762,28.400,36.963]}},{"noteOn":{"time":173.255,"note":93.000,"xyz":[-24.499,20.400,28.404]}},{"noteOn":{"time":173.290,"note":103.000,"xyz":[32.359,28.400,3.352]}},{"noteOn":{"time":173.345,"note":99.000,"xyz":[28.937,25.200,-36.062]}},{"noteOn":{"time":173.355,"note":111.000,"xyz":[-32.461,34.800,-22.487]}},{"noteOn":{"time":173.385,"note":114.000,"xyz":[18.181,37.200,9.486]}},{"noteOn":{"time":173.570,"note":100.000,"xyz":[-11.946,26.000,39.002]}},{"noteOn":{"time":173.605,"note":105.000,"xyz":[-30.816,30.000,-2.636]}},{"noteOn":{"time":173.635,"note":99.000,"xyz":[14.207,25.200,-9.369]}},{"noteOn":{"time":173.665,"note":101.000,"xyz":[3.099,26.800,10.474]}},{"noteOn":{"time":173.670,"note":102.000,"xyz":[0.593,27.600,-8.919]}},{"noteOn":{"time":173.690,"note":100.000,"xyz":[-23.534,26.000,-14.820]}},{"noteOn":{"time":173.755,"note":110.000,"xyz":[-28.052,34.000,-36.777]}},{"noteOn":{"time":173.795,"note":112.000,"xyz":[7.873,35.600,-43.140]}},{"noteOn":{"time":173.825,"note":104.000,"xyz":[-15.134,29.200,1.073]}},{"noteOn":{"time":173.875,"note":94.000,"xyz":[30.195,21.200,38.387]}},{"noteOn":{"time":173.885,"note":101.000,"xyz":[13.353,26.800,17.225]}},{"noteOn":{"time":173.895,"note":109.000,"xyz":[43.079,33.200,12.699]}},{"noteOn":{"time":173.905,"note":91.000,"xyz":[2.860,18.800,-11.977]}},{"noteOn":{"time":173.920,"note":99.000,"xyz":[46.589,25.200,-3.419]}},{"noteOn":{"time":173.940,"note":100.000,"xyz":[-9.677,26.000,8.469]}},{"noteOn":{"time":173.985,"note":105.000,"xyz":[8.304,30.000,3.928]}},{"noteOn":{"time":174.180,"note":108.000,"xyz":[14.949,32.400,4.365]}},{"noteOn":{"time":174.195,"note":98.000,"xyz":[-1.166,24.400,-0.048]}},{"noteOn":{"time":174.245,"note":96.000,"xyz":[-11.371,22.800,14.602]}},{"noteOn":{"time":174.290,"note":114.000,"xyz":[-11.807,37.200,17.629]}},{"noteOn":{"time":174.325,"note":98.000,"xyz":[-20.137,24.400,25.369]}},{"noteOn":{"time":174.355,"note":110.000,"xyz":[13.690,34.000,0.161]}},{"noteOn":{"time":174.440,"note":96.000,"xyz":[34.614,22.800,-1.875]}},{"noteOn":{"time":174.440,"note":112.000,"xyz":[34.034,35.600,-7.078]}},{"noteOn":{"time":174.545,"note":92.000,"xyz":[31.208,19.600,34.102]}},{"noteOn":{"time":174.550,"note":104.000,"xyz":[16.683,29.200,-14.367]}},{"noteOn":{"time":174.555,"note":103.000,"xyz":[-32.063,28.400,-31.699]}},{"noteOn":{"time":174.570,"note":101.000,"xyz":[-21.584,26.800,-6.845]}},{"noteOn":{"time":174.600,"note":98.000,"xyz":[-21.524,24.400,-14.327]}},{"noteOn":{"time":174.605,"note":110.000,"xyz":[17.522,34.000,40.354]}},{"noteOn":{"time":174.670,"note":108.000,"xyz":[21.043,32.400,35.549]}},{"noteOn":{"time":174.735,"note":100.000,"xyz":[26.132,26.000,30.512]}},{"noteOn":{"time":174.750,"note":97.000,"xyz":[3.466,23.600,-8.852]}},{"noteOn":{"time":174.785,"note":108.000,"xyz":[-23.788,32.400,8.562]}},{"noteOn":{"time":174.810,"note":100.000,"xyz":[5.794,26.000,-12.682]}},{"noteOn":{"time":174.905,"note":94.000,"xyz":[-16.841,21.200,-6.726]}},{"noteOn":{"time":174.920,"note":104.000,"xyz":[-34.090,29.200,-34.766]}},{"noteOn":{"time":174.955,"note":102.000,"xyz":[13.038,27.600,-1.572]}},{"noteOn":{"time":175.085,"note":112.000,"xyz":[-23.360,35.600,14.085]}},{"noteOn":{"time":175.145,"note":110.000,"xyz":[-1.749,34.000,-30.667]}},{"noteOn":{"time":175.190,"note":96.000,"xyz":[24.043,22.800,-33.982]}},{"noteOn":{"time":175.230,"note":98.000,"xyz":[-19.071,24.400,17.042]}},{"noteOn":{"time":175.285,"note":92.000,"xyz":[-27.619,19.600,2.409]}},{"noteOn":{"time":175.405,"note":110.000,"xyz":[-2.795,34.000,38.832]}},{"noteOn":{"time":175.445,"note":96.000,"xyz":[30.824,22.800,-27.893]}},{"noteOn":{"time":175.450,"note":101.000,"xyz":[-3.874,26.800,-24.859]}},{"noteOn":{"time":175.480,"note":104.000,"xyz":[0.766,29.200,1.206]}},{"noteOn":{"time":175.495,"note":94.000,"xyz":[7.663,21.200,-5.360]}},{"noteOn":{"time":175.520,"note":104.000,"xyz":[9.635,29.200,3.570]}},{"noteOn":{"time":175.580,"note":114.000,"xyz":[-8.251,37.200,44.600]}},{"noteOn":{"time":175.580,"note":106.000,"xyz":[3.821,30.800,-4.552]}},{"noteOn":{"time":175.590,"note":110.000,"xyz":[33.857,34.000,24.716]}},{"noteOn":{"time":175.650,"note":99.000,"xyz":[10.148,25.200,4.130]}},{"noteOn":{"time":175.650,"note":104.000,"xyz":[13.466,29.200,-39.040]}},{"noteOn":{"time":175.725,"note":98.000,"xyz":[-10.424,24.400,-37.337]}},{"noteOn":{"time":175.730,"note":106.000,"xyz":[3.712,30.800,-21.381]}},{"noteOn":{"time":175.770,"note":113.000,"xyz":[-2.257,36.400,-19.812]}},{"noteOn":{"time":175.785,"note":102.000,"xyz":[23.195,27.600,-33.486]}},{"noteOn":{"time":175.830,"note":98.000,"xyz":[44.091,24.400,9.714]}},{"noteOn":{"time":175.865,"note":108.000,"xyz":[-14.101,32.400,-19.809]}},{"noteOn":{"time":176.035,"note":90.000,"xyz":[-0.113,18.000,-32.193]}},{"noteOn":{"time":176.040,"note":98.000,"xyz":[2.242,24.400,8.238]}},{"noteOn":{"time":176.160,"note":104.000,"xyz":[-5.086,29.200,-25.657]}},{"noteOn":{"time":176.165,"note":101.000,"xyz":[-25.843,26.800,21.295]}},{"noteOn":{"time":176.170,"note":102.000,"xyz":[-26.406,27.600,17.700]}},{"noteOn":{"time":176.175,"note":100.000,"xyz":[29.531,26.000,-22.135]}},{"noteOn":{"time":176.215,"note":110.000,"xyz":[4.406,34.000,10.937]}},{"noteOn":{"time":176.225,"note":116.000,"xyz":[-8.311,38.800,-10.077]}},{"noteOn":{"time":176.270,"note":100.000,"xyz":[-26.251,26.000,4.750]}},{"noteOn":{"time":176.295,"note":106.000,"xyz":[3.258,30.800,-2.569]}},{"noteOn":{"time":176.385,"note":106.000,"xyz":[-10.318,30.800,-34.718]}},{"noteOn":{"time":176.400,"note":96.000,"xyz":[-8.918,22.800,39.330]}},{"noteOn":{"time":176.485,"note":108.000,"xyz":[1.776,32.400,-31.950]}},{"noteOn":{"time":176.535,"note":92.000,"xyz":[-37.141,19.600,-8.539]}},{"noteOn":{"time":176.570,"note":106.000,"xyz":[13.626,30.800,12.649]}},{"noteOn":{"time":176.575,"note":104.000,"xyz":[-41.873,29.200,21.513]}},{"noteOn":{"time":176.645,"note":108.000,"xyz":[-10.013,32.400,8.378]}},{"noteOn":{"time":176.685,"note":92.000,"xyz":[7.358,19.600,-2.661]}},{"noteOn":{"time":176.715,"note":98.000,"xyz":[-4.444,24.400,1.736]}},{"noteOn":{"time":176.735,"note":91.000,"xyz":[12.098,18.800,-9.176]}},{"noteOn":{"time":176.745,"note":115.000,"xyz":[-7.341,38.000,45.499]}},{"noteOn":{"time":176.865,"note":98.000,"xyz":[-31.598,24.400,-18.663]}},{"noteOn":{"time":176.875,"note":100.000,"xyz":[-1.978,26.000,36.281]}},{"noteOn":{"time":176.910,"note":104.000,"xyz":[-25.401,29.200,6.352]}},{"noteOn":{"time":176.925,"note":96.000,"xyz":[28.624,22.800,19.566]}},{"noteOn":{"time":176.950,"note":102.000,"xyz":[17.844,27.600,1.874]}},{"noteOn":{"time":176.985,"note":108.000,"xyz":[-0.831,32.400,0.568]}},{"noteOn":{"time":176.995,"note":104.000,"xyz":[-21.979,29.200,-18.311]}},{"noteOn":{"time":177.040,"note":106.000,"xyz":[-7.580,30.800,-13.663]}},{"noteOn":{"time":177.060,"note":112.000,"xyz":[-39.103,35.600,7.753]}},{"noteOn":{"time":177.150,"note":116.000,"xyz":[-3.164,38.800,15.057]}},{"noteOn":{"time":177.165,"note":106.000,"xyz":[0.742,30.800,-2.552]}},{"noteOn":{"time":177.170,"note":94.000,"xyz":[31.052,21.200,-30.130]}},{"noteOn":{"time":177.330,"note":90.000,"xyz":[6.240,18.000,-18.075]}},{"noteOn":{"time":177.360,"note":106.000,"xyz":[-16.204,30.800,-3.527]}},{"noteOn":{"time":177.395,"note":106.000,"xyz":[19.024,30.800,12.109]}},{"noteOn":{"time":177.435,"note":100.000,"xyz":[-9.027,26.000,1.346]}},{"noteOn":{"time":177.445,"note":98.000,"xyz":[-17.034,24.400,25.329]}},{"noteOn":{"time":177.445,"note":100.000,"xyz":[-29.603,26.000,0.813]}},{"noteOn":{"time":177.485,"note":102.000,"xyz":[-1.024,27.600,-0.429]}},{"noteOn":{"time":177.510,"note":106.000,"xyz":[9.621,30.800,12.949]}},{"noteOn":{"time":177.525,"note":108.000,"xyz":[1.104,32.400,-0.158]}},{"noteOn":{"time":177.540,"note":110.000,"xyz":[18.382,34.000,8.389]}},{"noteOn":{"time":177.560,"note":108.000,"xyz":[-40.251,32.400,6.014]}},{"noteOn":{"time":177.580,"note":93.000,"xyz":[-10.085,20.400,14.471]}},{"noteOn":{"time":177.690,"note":107.000,"xyz":[19.037,31.600,2.740]}},{"noteOn":{"time":177.720,"note":92.000,"xyz":[39.969,19.600,3.981]}},{"noteOn":{"time":177.795,"note":102.000,"xyz":[7.424,27.600,26.900]}},{"noteOn":{"time":177.805,"note":98.000,"xyz":[-20.952,24.400,-19.987]}},{"noteOn":{"time":177.935,"note":100.000,"xyz":[-9.146,26.000,-17.958]}},{"noteOn":{"time":177.955,"note":96.000,"xyz":[22.668,22.800,-19.751]}},{"noteOn":{"time":178.030,"note":108.000,"xyz":[-2.986,32.400,-21.937]}},{"noteOn":{"time":178.050,"note":112.000,"xyz":[-41.245,35.600,-21.577]}},{"noteOn":{"time":178.055,"note":104.000,"xyz":[-6.468,29.200,-6.824]}},{"noteOn":{"time":178.095,"note":104.000,"xyz":[-9.966,29.200,38.439]}},{"noteOn":{"time":178.110,"note":100.000,"xyz":[-34.576,26.000,28.227]}},{"noteOn":{"time":178.145,"note":114.000,"xyz":[3.110,37.200,36.234]}},{"noteOn":{"time":178.185,"note":99.000,"xyz":[12.792,25.200,-45.883]}},{"noteOn":{"time":178.200,"note":103.000,"xyz":[33.233,28.400,-18.277]}},{"noteOn":{"time":178.210,"note":111.000,"xyz":[12.452,34.800,14.423]}},{"noteOn":{"time":178.325,"note":94.000,"xyz":[-25.351,21.200,-37.765]}},{"noteOn":{"time":178.335,"note":99.000,"xyz":[28.727,25.200,8.300]}},{"noteOn":{"time":178.355,"note":102.000,"xyz":[-5.762,27.600,6.386]}},{"noteOn":{"time":178.425,"note":110.000,"xyz":[-1.566,34.000,-0.314]}},{"noteOn":{"time":178.450,"note":90.000,"xyz":[44.527,18.000,-10.815]}},{"noteOn":{"time":178.505,"note":100.000,"xyz":[-34.667,26.000,0.323]}},{"noteOn":{"time":178.550,"note":110.000,"xyz":[-8.191,34.000,29.296]}},{"noteOn":{"time":178.555,"note":107.000,"xyz":[-25.888,31.600,19.358]}},{"noteOn":{"time":178.570,"note":98.000,"xyz":[-9.046,24.400,17.966]}},{"noteOn":{"time":178.605,"note":114.000,"xyz":[29.436,37.200,40.185]}},{"noteOn":{"time":178.690,"note":102.000,"xyz":[-0.080,27.600,-25.944]}},{"noteOn":{"time":178.705,"note":93.000,"xyz":[45.463,20.400,-9.941]}},{"noteOn":{"time":178.705,"note":104.000,"xyz":[-30.467,29.200,-2.201]}},{"noteOn":{"time":178.715,"note":106.000,"xyz":[-9.096,30.800,-40.267]}},{"noteOn":{"time":178.835,"note":97.000,"xyz":[3.239,23.600,12.119]}},{"noteOn":{"time":178.890,"note":109.000,"xyz":[36.396,33.200,-14.476]}},{"noteOn":{"time":178.900,"note":108.000,"xyz":[3.330,32.400,0.084]}},{"noteOn":{"time":178.920,"note":98.000,"xyz":[-8.363,24.400,-1.536]}},{"noteOn":{"time":178.935,"note":96.000,"xyz":[8.674,22.800,25.171]}},{"noteOn":{"time":179.045,"note":102.000,"xyz":[18.648,27.600,-25.701]}},{"noteOn":{"time":179.110,"note":103.000,"xyz":[-1.624,28.400,26.207]}},{"noteOn":{"time":179.130,"note":93.000,"xyz":[35.104,20.400,4.279]}},{"noteOn":{"time":179.145,"note":100.000,"xyz":[29.308,26.000,-31.775]}},{"noteOn":{"time":179.165,"note":97.000,"xyz":[-7.768,23.600,-1.349]}},{"noteOn":{"time":179.170,"note":104.000,"xyz":[23.797,29.200,-31.955]}},{"noteOn":{"time":179.215,"note":103.000,"xyz":[-14.471,28.400,4.253]}},{"noteOn":{"time":179.250,"note":108.000,"xyz":[0.895,32.400,-35.250]}},{"noteOn":{"time":179.345,"note":115.000,"xyz":[-4.286,38.000,15.796]}},{"noteOn":{"time":179.360,"note":100.000,"xyz":[-32.705,26.000,35.235]}},{"noteOn":{"time":179.405,"note":115.000,"xyz":[-37.432,38.000,-32.451]}},{"noteOn":{"time":179.410,"note":111.000,"xyz":[-1.238,34.800,2.116]}},{"noteOn":{"time":179.415,"note":107.000,"xyz":[7.838,31.600,31.254]}},{"noteOn":{"time":179.510,"note":112.000,"xyz":[-33.368,35.600,11.070]}},{"noteOn":{"time":179.575,"note":112.000,"xyz":[10.043,35.600,-7.817]}},{"noteOn":{"time":179.590,"note":104.000,"xyz":[31.314,29.200,8.065]}},{"noteOn":{"time":179.685,"note":97.000,"xyz":[36.368,23.600,26.726]}},{"noteOn":{"time":179.735,"note":91.000,"xyz":[-25.641,18.800,20.914]}},{"noteOn":{"time":179.850,"note":103.000,"xyz":[0.486,28.400,21.570]}},{"noteOn":{"time":179.880,"note":104.000,"xyz":[39.281,29.200,1.973]}},{"noteOn":{"time":179.910,"note":99.000,"xyz":[45.009,25.200,-5.077]}},{"noteOn":{"time":179.915,"note":96.000,"xyz":[-42.281,22.800,7.800]}},{"noteOn":{"time":179.975,"note":100.000,"xyz":[10.612,26.000,-31.158]}},{"noteOn":{"time":179.990,"note":101.000,"xyz":[39.899,26.800,11.668]}},{"noteOn":{"time":180.025,"note":95.000,"xyz":[-10.101,22.000,-2.676]}},{"noteOn":{"time":180.050,"note":113.000,"xyz":[33.319,36.400,-10.034]}},{"noteOn":{"time":180.055,"note":109.000,"xyz":[44.574,33.200,15.823]}},{"noteOn":{"time":180.085,"note":99.000,"xyz":[-9.407,25.200,21.400]}},{"noteOn":{"time":180.090,"note":105.000,"xyz":[-12.375,30.000,-25.549]}},{"noteOn":{"time":180.145,"note":107.000,"xyz":[-10.939,31.600,7.201]}},{"noteOn":{"time":180.170,"note":107.000,"xyz":[12.878,31.600,12.875]}},{"noteOn":{"time":180.245,"note":117.000,"xyz":[-8.056,39.600,20.058]}},{"noteOn":{"time":180.270,"note":98.000,"xyz":[-39.919,24.400,-21.906]}},{"noteOn":{"time":180.335,"note":99.000,"xyz":[-10.960,25.200,-39.959]}},{"noteOn":{"time":180.365,"note":105.000,"xyz":[-19.574,30.000,-2.553]}},{"noteOn":{"time":180.430,"note":109.000,"xyz":[-17.049,33.200,-45.616]}},{"noteOn":{"time":180.445,"note":89.000,"xyz":[27.971,17.200,-39.882]}},{"noteOn":{"time":180.535,"note":99.000,"xyz":[-19.722,25.200,-3.008]}},{"noteOn":{"time":180.575,"note":98.000,"xyz":[2.414,24.400,-2.064]}},{"noteOn":{"time":180.595,"note":102.000,"xyz":[-32.072,27.600,2.186]}},{"noteOn":{"time":180.635,"note":101.000,"xyz":[17.449,26.800,21.224]}},{"noteOn":{"time":180.665,"note":111.000,"xyz":[-2.656,34.800,-4.731]}},{"noteOn":{"time":180.670,"note":107.000,"xyz":[12.075,31.600,-5.121]}},{"noteOn":{"time":180.675,"note":113.000,"xyz":[7.561,36.400,-45.492]}},{"noteOn":{"time":180.715,"note":97.000,"xyz":[7.596,23.600,-7.615]}},{"noteOn":{"time":180.745,"note":99.000,"xyz":[11.262,25.200,-45.665]}},{"noteOn":{"time":180.775,"note":105.000,"xyz":[-11.358,30.000,-12.698]}},{"noteOn":{"time":180.870,"note":103.000,"xyz":[20.840,28.400,-1.657]}},{"noteOn":{"time":180.915,"note":107.000,"xyz":[-7.945,31.600,-6.090]}},{"noteOn":{"time":181.005,"note":93.000,"xyz":[1.739,20.400,6.700]}},{"noteOn":{"time":181.025,"note":107.000,"xyz":[6.161,31.600,-4.448]}},{"noteOn":{"time":181.100,"note":107.000,"xyz":[-15.118,31.600,-12.755]}},{"noteOn":{"time":181.105,"note":105.000,"xyz":[0.908,30.000,3.379]}},{"noteOn":{"time":181.120,"note":105.000,"xyz":[27.353,30.000,14.058]}},{"noteOn":{"time":181.185,"note":91.000,"xyz":[-2.420,18.800,23.219]}},{"noteOn":{"time":181.190,"note":92.000,"xyz":[-13.434,19.600,-0.089]}},{"noteOn":{"time":181.215,"note":115.000,"xyz":[-9.978,38.000,41.031]}},{"noteOn":{"time":181.235,"note":103.000,"xyz":[32.885,28.400,-15.649]}},{"noteOn":{"time":181.290,"note":97.000,"xyz":[1.323,23.600,-31.070]}},{"noteOn":{"time":181.330,"note":99.000,"xyz":[-9.712,25.200,-12.865]}},{"noteOn":{"time":181.340,"note":101.000,"xyz":[-5.962,26.800,-10.775]}},{"noteOn":{"time":181.355,"note":103.000,"xyz":[6.514,28.400,5.275]}},{"noteOn":{"time":181.405,"note":113.000,"xyz":[-16.768,36.400,45.231]}},{"noteOn":{"time":181.445,"note":107.000,"xyz":[12.166,31.600,-32.539]}},{"noteOn":{"time":181.525,"note":97.000,"xyz":[-33.244,23.600,-6.838]}},{"noteOn":{"time":181.555,"note":95.000,"xyz":[-4.605,22.000,-25.912]}},{"noteOn":{"time":181.605,"note":105.000,"xyz":[-24.040,30.000,-21.643]}},{"noteOn":{"time":181.635,"note":107.000,"xyz":[-26.382,31.600,6.233]}},{"noteOn":{"time":181.735,"note":105.000,"xyz":[-27.325,30.000,21.036]}},{"noteOn":{"time":181.755,"note":106.000,"xyz":[-1.617,30.800,13.683]}},{"noteOn":{"time":181.790,"note":109.000,"xyz":[18.734,33.200,19.675]}},{"noteOn":{"time":181.795,"note":101.000,"xyz":[-1.191,26.800,12.960]}},{"noteOn":{"time":181.840,"note":91.000,"xyz":[20.341,18.800,17.277]}},{"noteOn":{"time":181.905,"note":115.000,"xyz":[-5.592,38.000,28.787]}},{"noteOn":{"time":181.910,"note":95.000,"xyz":[7.024,22.000,-41.140]}},{"noteOn":{"time":181.915,"note":109.000,"xyz":[-13.011,33.200,-5.919]}},{"noteOn":{"time":181.925,"note":101.000,"xyz":[12.491,26.800,44.590]}},{"noteOn":{"time":181.945,"note":101.000,"xyz":[-35.702,26.800,-16.527]}},{"noteOn":{"time":181.985,"note":103.000,"xyz":[24.586,28.400,-14.763]}},{"noteOn":{"time":182.010,"note":94.000,"xyz":[-13.151,21.200,-14.535]}},{"noteOn":{"time":182.110,"note":105.000,"xyz":[17.191,30.000,-0.485]}},{"noteOn":{"time":182.125,"note":99.000,"xyz":[3.683,25.200,16.254]}},{"noteOn":{"time":182.185,"note":91.000,"xyz":[-23.672,18.800,-12.089]}},{"noteOn":{"time":182.220,"note":101.000,"xyz":[34.460,26.800,0.876]}},{"noteOn":{"time":182.305,"note":97.000,"xyz":[11.989,23.600,-9.079]}},{"noteOn":{"time":182.315,"note":99.000,"xyz":[-14.746,25.200,-28.564]}},{"noteOn":{"time":182.370,"note":108.000,"xyz":[9.415,32.400,-5.115]}},{"noteOn":{"time":182.445,"note":113.000,"xyz":[27.142,36.400,-14.618]}},{"noteOn":{"time":182.465,"note":113.000,"xyz":[-16.272,36.400,11.248]}},{"noteOn":{"time":182.560,"note":109.000,"xyz":[12.638,33.200,-18.406]}},{"noteOn":{"time":182.575,"note":103.000,"xyz":[4.723,28.400,-42.006]}},{"noteOn":{"time":182.670,"note":99.000,"xyz":[42.400,25.200,19.295]}},{"noteOn":{"time":182.670,"note":111.000,"xyz":[3.048,34.800,-25.748]}},{"noteOn":{"time":182.685,"note":99.000,"xyz":[-8.823,25.200,-5.835]}},{"noteOn":{"time":182.720,"note":113.000,"xyz":[9.350,36.400,-3.010]}},{"noteOn":{"time":182.735,"note":103.000,"xyz":[-8.897,28.400,46.733]}},{"noteOn":{"time":182.745,"note":98.000,"xyz":[30.534,24.400,-33.841]}},{"noteOn":{"time":182.745,"note":93.000,"xyz":[4.445,20.400,-19.581]}},{"noteOn":{"time":182.750,"note":111.000,"xyz":[36.685,34.800,8.185]}},{"noteOn":{"time":182.870,"note":95.000,"xyz":[-5.254,22.000,24.575]}},{"noteOn":{"time":182.915,"note":103.000,"xyz":[-21.940,28.400,-2.061]}},{"noteOn":{"time":182.915,"note":101.000,"xyz":[-13.354,26.800,6.838]}},{"noteOn":{"time":182.920,"note":105.000,"xyz":[-12.600,30.000,5.844]}},{"noteOn":{"time":182.990,"note":89.000,"xyz":[-4.602,17.200,5.244]}},{"noteOn":{"time":183.070,"note":114.000,"xyz":[33.932,37.200,20.801]}},{"noteOn":{"time":183.080,"note":107.000,"xyz":[-29.706,31.600,7.730]}},{"noteOn":{"time":183.150,"note":109.000,"xyz":[-34.074,33.200,-21.532]}},{"noteOn":{"time":183.205,"note":99.000,"xyz":[-34.435,25.200,-17.964]}},{"noteOn":{"time":183.300,"note":113.000,"xyz":[-12.176,36.400,-10.315]}},{"noteOn":{"time":183.335,"note":101.000,"xyz":[-0.700,26.800,16.344]}},{"noteOn":{"time":183.345,"note":96.000,"xyz":[-7.324,22.800,6.316]}},{"noteOn":{"time":183.345,"note":103.000,"xyz":[3.499,28.400,-13.272]}},{"noteOn":{"time":183.360,"note":97.000,"xyz":[15.092,23.600,18.915]}},{"noteOn":{"time":183.390,"note":115.000,"xyz":[-16.351,38.000,38.879]}},{"noteOn":{"time":183.400,"note":111.000,"xyz":[15.114,34.800,-25.304]}},{"noteOn":{"time":183.500,"note":109.000,"xyz":[30.612,33.200,35.629]}},{"noteOn":{"time":183.525,"note":97.000,"xyz":[15.509,23.600,33.817]}},{"noteOn":{"time":183.585,"note":109.000,"xyz":[-22.429,33.200,-28.055]}},{"noteOn":{"time":183.595,"note":96.000,"xyz":[13.663,22.800,42.912]}},{"noteOn":{"time":183.640,"note":103.000,"xyz":[-14.728,28.400,-0.374]}},{"noteOn":{"time":183.695,"note":111.000,"xyz":[-9.709,34.800,23.336]}},{"noteOn":{"time":183.720,"note":93.000,"xyz":[12.590,20.400,-30.849]}},{"noteOn":{"time":183.840,"note":109.000,"xyz":[9.515,33.200,-10.381]}},{"noteOn":{"time":183.845,"note":112.000,"xyz":[11.267,35.600,-10.383]}},{"noteOn":{"time":183.885,"note":105.000,"xyz":[18.262,30.000,7.631]}},{"noteOn":{"time":183.900,"note":105.000,"xyz":[-15.487,30.000,-43.110]}},{"noteOn":{"time":183.980,"note":99.000,"xyz":[-8.135,25.200,23.262]}},{"noteOn":{"time":184.090,"note":111.000,"xyz":[9.569,34.800,-41.306]}},{"noteOn":{"time":184.100,"note":111.000,"xyz":[-23.071,34.800,-8.632]}},{"noteOn":{"time":184.105,"note":107.000,"xyz":[-12.201,31.600,-23.894]}},{"noteOn":{"time":184.130,"note":101.000,"xyz":[39.824,26.800,-10.803]}},{"noteOn":{"time":184.185,"note":98.000,"xyz":[5.265,24.400,-0.552]}},{"noteOn":{"time":184.200,"note":105.000,"xyz":[-4.737,30.000,1.154]}},{"noteOn":{"time":184.210,"note":100.000,"xyz":[-13.108,26.000,7.609]}},{"noteOn":{"time":184.215,"note":109.000,"xyz":[11.777,33.200,-17.615]}},{"noteOn":{"time":184.280,"note":91.000,"xyz":[8.317,18.800,-4.109]}},{"noteOn":{"time":184.385,"note":99.000,"xyz":[-34.446,25.200,29.332]}},{"noteOn":{"time":184.470,"note":103.000,"xyz":[-1.176,28.400,1.083]}},{"noteOn":{"time":184.475,"note":95.000,"xyz":[-9.616,22.000,3.986]}},{"noteOn":{"time":184.540,"note":100.000,"xyz":[-17.145,26.000,-27.211]}},{"noteOn":{"time":184.560,"note":96.000,"xyz":[-22.854,22.800,-40.111]}},{"noteOn":{"time":184.575,"note":109.000,"xyz":[-6.311,33.200,24.442]}},{"noteOn":{"time":184.580,"note":116.000,"xyz":[11.330,38.800,-11.201]}},{"noteOn":{"time":184.705,"note":114.000,"xyz":[-12.515,37.200,7.543]}},{"noteOn":{"time":184.720,"note":99.000,"xyz":[-17.507,25.200,-42.920]}},{"noteOn":{"time":184.745,"note":103.000,"xyz":[4.607,28.400,-29.352]}},{"noteOn":{"time":184.800,"note":104.000,"xyz":[10.126,29.200,-10.362]}},{"noteOn":{"time":184.810,"note":97.000,"xyz":[9.743,23.600,-14.670]}},{"noteOn":{"time":184.840,"note":100.000,"xyz":[-36.527,26.000,27.013]}},{"noteOn":{"time":184.845,"note":100.000,"xyz":[-6.321,26.000,2.915]}},{"noteOn":{"time":184.865,"note":107.000,"xyz":[-41.910,31.600,24.514]}},{"noteOn":{"time":184.890,"note":109.000,"xyz":[4.261,33.200,30.226]}},{"noteOn":{"time":184.905,"note":106.000,"xyz":[-32.978,30.800,22.938]}},{"noteOn":{"time":184.945,"note":90.000,"xyz":[12.664,18.000,31.990]}},{"noteOn":{"time":185.030,"note":107.000,"xyz":[-8.261,31.600,1.082]}},{"noteOn":{"time":185.070,"note":102.000,"xyz":[0.132,27.600,-9.984]}},{"noteOn":{"time":185.120,"note":97.000,"xyz":[-6.174,23.600,-14.423]}},{"noteOn":{"time":185.170,"note":97.000,"xyz":[-22.602,23.600,16.949]}},{"noteOn":{"time":185.185,"note":105.000,"xyz":[26.412,30.000,25.647]}},{"noteOn":{"time":185.205,"note":106.000,"xyz":[23.642,30.800,-1.936]}},{"noteOn":{"time":185.225,"note":101.000,"xyz":[19.370,26.800,-10.602]}},{"noteOn":{"time":185.225,"note":98.000,"xyz":[14.971,24.400,-28.186]}},{"noteOn":{"time":185.245,"note":107.000,"xyz":[7.377,31.600,-26.403]}},{"noteOn":{"time":185.255,"note":116.000,"xyz":[-44.657,38.800,-14.713]}},{"noteOn":{"time":185.315,"note":106.000,"xyz":[-1.324,30.800,-4.166]}},{"noteOn":{"time":185.395,"note":107.000,"xyz":[-30.448,31.600,0.787]}},{"noteOn":{"time":185.465,"note":93.000,"xyz":[-18.804,20.400,17.976]}},{"noteOn":{"time":185.480,"note":104.000,"xyz":[-1.336,29.200,0.370]}},{"noteOn":{"time":185.545,"note":112.000,"xyz":[16.624,35.600,-9.991]}},{"noteOn":{"time":185.575,"note":107.000,"xyz":[-45.774,31.600,-17.977]}},{"noteOn":{"time":185.640,"note":116.000,"xyz":[42.752,38.800,17.045]}},{"noteOn":{"time":185.685,"note":90.000,"xyz":[14.210,18.000,-9.915]}},{"noteOn":{"time":185.685,"note":92.000,"xyz":[-2.146,19.600,-4.250]}},{"noteOn":{"time":185.725,"note":117.000,"xyz":[-1.178,39.600,0.544]}},{"noteOn":{"time":185.735,"note":102.000,"xyz":[4.959,27.600,0.992]}},{"noteOn":{"time":185.735,"note":96.000,"xyz":[35.820,22.800,14.190]}},{"noteOn":{"time":185.845,"note":102.000,"xyz":[-3.797,27.600,-7.123]}},{"noteOn":{"time":185.855,"note":107.000,"xyz":[31.349,31.600,10.570]}},{"noteOn":{"time":185.855,"note":104.000,"xyz":[3.809,29.200,-10.016]}},{"noteOn":{"time":185.870,"note":98.000,"xyz":[-37.198,24.400,17.393]}},{"noteOn":{"time":185.920,"note":102.000,"xyz":[-3.258,27.600,12.088]}},{"noteOn":{"time":185.990,"note":96.000,"xyz":[2.230,22.800,-4.233]}},{"noteOn":{"time":186.040,"note":108.000,"xyz":[-5.267,32.400,13.386]}},{"noteOn":{"time":186.055,"note":98.000,"xyz":[18.101,24.400,32.717]}},{"noteOn":{"time":186.095,"note":108.000,"xyz":[-10.413,32.400,9.317]}},{"noteOn":{"time":186.140,"note":102.000,"xyz":[9.723,27.600,-12.321]}},{"noteOn":{"time":186.150,"note":114.000,"xyz":[1.885,37.200,-5.052]}},{"noteOn":{"time":186.230,"note":114.000,"xyz":[-7.830,37.200,-29.124]}},{"noteOn":{"time":186.240,"note":110.000,"xyz":[11.584,34.000,33.351]}},{"noteOn":{"time":186.300,"note":104.000,"xyz":[23.349,29.200,18.667]}},{"noteOn":{"time":186.350,"note":92.000,"xyz":[9.422,19.600,4.221]}},{"noteOn":{"time":186.395,"note":94.000,"xyz":[18.847,21.200,-45.278]}},{"noteOn":{"time":186.425,"note":102.000,"xyz":[-3.038,27.600,13.648]}},{"noteOn":{"time":186.425,"note":115.000,"xyz":[15.970,38.000,-6.574]}},{"noteOn":{"time":186.485,"note":95.000,"xyz":[-4.337,22.000,-0.413]}},{"noteOn":{"time":186.585,"note":110.000,"xyz":[-9.876,34.000,8.589]}},{"noteOn":{"time":186.605,"note":100.000,"xyz":[-27.347,26.000,-3.166]}},{"noteOn":{"time":186.610,"note":110.000,"xyz":[16.719,34.000,-4.963]}},{"noteOn":{"time":186.625,"note":106.000,"xyz":[42.703,30.800,-8.999]}},{"noteOn":{"time":186.660,"note":100.000,"xyz":[-41.983,26.000,10.712]}},{"noteOn":{"time":186.700,"note":90.000,"xyz":[0.069,18.000,5.170]}},{"noteOn":{"time":186.705,"note":105.000,"xyz":[-42.792,30.000,-0.844]}},{"noteOn":{"time":186.775,"note":100.000,"xyz":[-2.243,26.000,11.203]}},{"noteOn":{"time":186.775,"note":100.000,"xyz":[3.315,26.000,-13.579]}},{"noteOn":{"time":186.855,"note":96.000,"xyz":[-19.251,22.800,-7.534]}},{"noteOn":{"time":186.960,"note":114.000,"xyz":[8.370,37.200,36.857]}},{"noteOn":{"time":186.975,"note":98.000,"xyz":[5.082,24.400,-11.589]}}]}
        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
