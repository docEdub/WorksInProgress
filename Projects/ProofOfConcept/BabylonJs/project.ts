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
    const logCsoundMessages = true;
    const logDebugMessages = false;

    const csoundCameraUpdatesPerSecond = 30;
    const csoundIoBufferSize = 128;
    const groundSize = 100;
    const groundGridLineMajorColor = new BABYLON.Color4(0.2, 0.2, 0.2, 1);
    const groundGridLineMinorColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

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
    document.body.appendChild(csoundImportScript)

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    let camera = new BABYLON.FreeCamera('', new BABYLON.Vector3(0, 2, 0), scene);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
    camera.speed = 0.25;
    camera.attachControl(canvas, true);
    camera.setTarget(new BABYLON.Vector3(0, 2, 10));

    let light = new BABYLON.DirectionalLight('', new BABYLON.Vector3(0, -1, 0), scene);
    light.intensity = 0.7;

    // For options docs see https://doc.babylonjs.com/typedoc/interfaces/babylon.ienvironmenthelperoptions.
    const environment = scene.createDefaultEnvironment({
        groundOpacity: 0,
        groundSize: groundSize,
        skyboxColor: BABYLON.Color3.BlackReadOnly,
        skyboxSize: groundSize * 2
    });
    environment.ground.checkCollisions = true;

    { // Grid lines

        let majorLine = BABYLON.MeshBuilder.CreateLines('', {
            points: [
                new BABYLON.Vector3(0, 0, -halfGroundSize),
                new BABYLON.Vector3(0, 0, halfGroundSize)
            ],
            colors: [
                groundGridLineMajorColor,
                groundGridLineMajorColor
            ]
        });
        majorLine.isVisible = false;

        let minorLine = BABYLON.MeshBuilder.CreateLines('', {
            points: [
                new BABYLON.Vector3(0, 0, -halfGroundSize),
                new BABYLON.Vector3(0, 0, halfGroundSize)
            ],
            colors: [
                groundGridLineMinorColor,
                groundGridLineMinorColor
            ]
        });
        minorLine.isVisible = false;

        for (let i = -halfGroundSize; i <= halfGroundSize; i++) {
            let zAxisInstance = null;
            let xAxisInstance = null;
            if (i % 10 == 0) {
                zAxisInstance = majorLine.createInstance('');
                xAxisInstance = majorLine.createInstance('');
            }
            else {
                zAxisInstance = minorLine.createInstance('');
                xAxisInstance = minorLine.createInstance('');
            }
            zAxisInstance.setPositionWithLocalVector(new BABYLON.Vector3(i, 0, 0));
            xAxisInstance.setPositionWithLocalVector(new BABYLON.Vector3(0, 0, i));
            xAxisInstance.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
        }

    }
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
    
    // This gets updated when switching between flat-screen camera and XR camera.
    let currentCamera = camera

    const startXr = async () => {
        try {
            const xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [ environment.ground ]});
            if (!!xr) {
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

        // Add point synth mesh instance template.
        const pointSynthMesh = BABYLON.Mesh.CreateSphere('', 8, 0.25, scene)
        pointSynthMesh.isVisible = false
        const pointSynthMeshMaterial = new BABYLON.StandardMaterial('', scene)
        pointSynthMeshMaterial.emissiveColor = BABYLON.Color3.White()
        pointSynthMeshMaterial.disableLighting = true
        pointSynthMeshMaterial.freeze()
        pointSynthMesh.material = pointSynthMeshMaterial

        // Initialize point synth notes.
        const pointSynthData = csdData['b4f7a35c-6198-422f-be6e-fa126f31b007']
        const pointSynthHeader = pointSynthData[0]
        console.debug('pointSynthHeader =', pointSynthHeader)
        for (let i = 1; i < pointSynthData.length; i++) {
            let noteOn = pointSynthData[i].noteOn
            console.debug('noteOn event ', i, '=', noteOn)
            let mesh = pointSynthMesh.createInstance('')
            mesh.isVisible = false // false
            mesh.position = new BABYLON.Vector3(noteOn.xyz[0], noteOn.xyz[1], noteOn.xyz[2]),
            noteOn.mesh = mesh
            noteOn.offTime = noteOn.time + 0.1
        }

        // Incremented as elapsed time passes.
        let nextPointSynthNoteOnIndex = 1
        let nextPointSynthNoteOffIndex = 1

        const previousCameraMatrix = new Float32Array(16)
        const currentCameraMatrix = new Float32Array(16)
        let currentCameraMatrixIsDirty = true    

        // Update animations.
        engine.runRenderLoop(() => {
            if (!isCsoundStarted) {
                nextPointSynthNoteOnIndex = 1
                nextPointSynthNoteOffIndex = 1
                return
            }
            const time = document.audioContext.currentTime - startTime;

            while (nextPointSynthNoteOnIndex < pointSynthData.length
                    && pointSynthData[nextPointSynthNoteOnIndex].noteOn.time <= time) {
                pointSynthData[nextPointSynthNoteOnIndex].noteOn.mesh.isVisible = true
                nextPointSynthNoteOnIndex++
            }

            while (nextPointSynthNoteOffIndex < pointSynthData.length
                    && pointSynthData[nextPointSynthNoteOffIndex].noteOn.offTime <= time) {
                pointSynthData[nextPointSynthNoteOffIndex].noteOn.mesh.isVisible = false
                nextPointSynthNoteOffIndex++
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
                    if (0.1 < Math.abs(currentCameraMatrix[i] - previousCameraMatrix[i])) {
                        currentCameraMatrixIsDirty = true
                        break
                    }
                }
            }
            if (currentCameraMatrixIsDirty) {
                console.debug("Writing table 1 ...")
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
                startTime = document.audioContext.currentTime - (4 - document.latency);
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
            audioContext: new AudioContext({
                latencyHint: 0.17066666667,
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
        document.audioContext = audioContext

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
        --midi-device=0
        --nodisplays
        --nosound
        </CsOptions>
        <CsInstruments>
        giPresetUuidPreallocationCount[] = fillarray( 4, /* instr 3 -- CircleSynth */ 1, /* instr 4 -- PowerLineSynth */ 1 /* instr 5 -- PointSynth */ )
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
            k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder xin
            k_azimuth = 360 - k_azimuth
            k_azimuthRow = AF_3D_Audio_AzimuthLookupTableRow(k_azimuth)
            k_elevationRow = AF_3D_Audio_ElevationLookupTableRow(k_elevation)
            k_spreadRow = AF_3D_Audio_MaxReWeightsLookupTableRow(k_sourceWidth)
            gkAmbisonicChannelGains[0] = gi_AF_3D_Audio_MaxReWeightsLookupTable[k_spreadRow][0]
            k_i = 0
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
            k_direction[] = fillarray(k_sourcePositionX - gk_AF_3D_ListenerPosition[$X],
                k_sourcePositionY - gk_AF_3D_ListenerPosition[$Y],
                k_sourcePositionZ - gk_AF_3D_ListenerPosition[$Z])
            k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
            k_elevation = 0
            AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
            i_minW = 0.79021
            i_maxW = 1.25
            i_diffW = i_maxW - i_minW
            k_distance = sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])
            if (k_distance <= 1) then
                gkAmbisonicChannelGains[0] = i_maxW
                gkAmbisonicChannelGains[1] = 0
                gkAmbisonicChannelGains[2] = 0
                gkAmbisonicChannelGains[3] = 0
            elseif (k_distance <= 2) then
                k_distance -= 1
                gkAmbisonicChannelGains[0] = i_minW + (i_diffW * (1 - k_distance))
                gkAmbisonicChannelGains[1] = gkAmbisonicChannelGains[1] * k_distance
                gkAmbisonicChannelGains[2] = gkAmbisonicChannelGains[2] * k_distance
                gkAmbisonicChannelGains[3] = gkAmbisonicChannelGains[3] * k_distance
            endif
        endop
        opcode AF_3D_Audio_ChannelGains_RTZ, 0, kkkPp
            k_sourcePositionR, k_sourcePositionT, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin
            k_sourcePositionX = k_sourcePositionR * cos(k_sourcePositionT)
            k_sourcePositionY = k_sourcePositionR * sin(k_sourcePositionT)
            k_elevation = taninv2(k_sourcePositionZ, k_sourcePositionR) * $AF_MATH__RADIANS_TO_DEGREES
            AF_3D_Audio_ChannelGains_XYZ(k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth,
                i_ambisonicOrder)
        endop
        giDistanceAttenuationTable = ftgen(0, 0, 513, 6, 1, 32, 1, 128, 0.5, 353, 0)
        opcode AF_3D_Audio_DistanceAttenuation, k, ki
            kDistance, iMaxDistance xin
            xout tablei(kDistance / iMaxDistance, giDistanceAttenuationTable, 1)
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
        gi_AF_3D_ListenerMatrixTableNumber ftgen 1, 0, 16, -2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
        gk_AF_3D_ListenerRotationMatrix[] init 9
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
            gk_AF_3D_ListenerPosition[0] = port(tab:k(12, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerPosition[1] = port(tab:k(13, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
            gk_AF_3D_ListenerPosition[2] = port(tab:k(14, gi_AF_3D_ListenerMatrixTableNumber), i_portamento_halftime)
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
        event_i("i", 1, 0, -1)
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
        giPointSynth_DistanceMin = 5
        giPointSynth_DistanceMax = 100
        giPointSynth_DistanceMinAttenuation = AF_3D_Audio_DistanceAttenuation_i(0, giPointSynth_DistanceMin, giPointSynth_DistanceMax)
         #define POINT_SYNTH_NEXT_XYZ_COUNT #16384#
        giPointSynthNextXYZ[][][] init 1, $POINT_SYNTH_NEXT_XYZ_COUNT, 3
        giPointSynthNextXYZ_i init 0
        iI = 0
        while (iI < 1) do
            seed(1 + iI * 1000)
            iJ = 0
            while (iJ < $POINT_SYNTH_NEXT_XYZ_COUNT) do
                iR = giPointSynth_DistanceMin + rnd(giPointSynth_DistanceMax - giPointSynth_DistanceMin)
                iT = rnd(359.999)
                iXYZ[] = math_rytToXyz(iR, 0, iT)
                giPointSynthNextXYZ[iI][iJ][$X] = iXYZ[$X]
                giPointSynthNextXYZ[iI][iJ][$Y] = iXYZ[$Y]
                giPointSynthNextXYZ[iI][iJ][$Z] = iXYZ[$Z]
                iJ += 1
            od
            iI += 1
        od
        giPointSynth_NoteIndex[] init 1
        gkPointSynth_InstrumentNumberFraction[] init 1
        gkPointSynth_LastNoteOnTime[] init 1
         #ifdef IS_GENERATING_JSON
            setPluginUuid(2, 0, "b4f7a35c-6198-422f-be6e-fa126f31b007")
            instr PointSynth_Json
                SJsonFile = sprintf("json/%s.0.json", "b4f7a35c-6198-422f-be6e-fa126f31b007")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
                iFadeInTime = 0.01
                iFadeOutTime = 0.01
                iTotalTime = iFadeInTime + iFadeOutTime
                    iNoteNumber -= 1000
                    if (iNoteNumber > 127) then
                        igoto end
                        turnoff
                    endif
                    iCps = cpsmidinn(p5 - 1000)
                    iAmp = 0.05
                    kCps = linseg(iCps, iTotalTime, iCps + 100)
                    aOut = oscil(iAmp, kCps)
                    aEnvelope = adsr_linsegr(iFadeInTime, 0, 1, iFadeOutTime)
                    aOut *= aEnvelope
                    iX init giPointSynthNextXYZ[0][giPointSynthNextXYZ_i][$X]
                    iZ init giPointSynthNextXYZ[0][giPointSynthNextXYZ_i][$Z]
                    iY init 10 + 10 * (iNoteNumber / 127)
                    kDistance = AF_3D_Audio_SourceDistance(iX, iY, iZ)
                    kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giPointSynth_DistanceMax)
                    aOutDistanced = aOut * kDistanceAmp
                    giPointSynthNextXYZ_i += 1
                    if (giPointSynthNextXYZ_i == $POINT_SYNTH_NEXT_XYZ_COUNT) then
                        giPointSynthNextXYZ_i = 0
                    endif
                    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
                    a1 = gkAmbisonicChannelGains[0] * aOutDistanced
                    a2 = gkAmbisonicChannelGains[1] * aOutDistanced
                    a3 = gkAmbisonicChannelGains[2] * aOutDistanced
                    a4 = gkAmbisonicChannelGains[3] * aOutDistanced
                        gaInstrumentSignals[2][0] = gaInstrumentSignals[2][0] + a1
                        gaInstrumentSignals[2][1] = gaInstrumentSignals[2][1] + a2
                        gaInstrumentSignals[2][2] = gaInstrumentSignals[2][2] + a3
                        gaInstrumentSignals[2][3] = gaInstrumentSignals[2][3] + a4
                        gaInstrumentSignals[2][4] = gaInstrumentSignals[2][4] + aOut
                        gaInstrumentSignals[2][5] = gaInstrumentSignals[2][5] + aOut
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
            outch(1, ga_masterSignals[4])
            outch(2, ga_masterSignals[5])
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
        i "SendEndedMessage" 0 1
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
        i 8 0.004 1 3 2 0 0.04
        i 8 0.004 1 3 2 1 0.04
        i 8 0.004 1 3 2 2 0.04
        i 8 0.004 1 3 2 3 0.04
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
        i 5.001 2.001 -1 3 48 96
        i 4.001 2.001 -1 3 24 45
        i 4.002 2.001 -1 3 36 63
        i 6.002 2.853 0.020 1 1098 76
        i 6.003 3.825 0.020 1 1095 79
        i 6.004 4.621 0.020 1 1103 52
        i 6.005 5.243 0.020 1 1103 78
        i 6.006 5.799 0.020 1 1095 71
        i 6.007 6.531 0.020 1 1097 58
        i 6.008 7.439 0.020 1 1097 78
        i 6.009 8.356 0.020 1 1095 72
        i 6.010 9.097 0.020 1 1103 52
        i 6.011 9.664 0.020 1 1102 79
        i 4.003 10.001 -1 3 31 45
        i 4.004 10.001 -1 3 43 63
        i -4.001 10.001 0
        i -4.002 10.001 0
        i 6.012 10.237 0.020 1 1096 74
        i 6.013 10.277 0.020 1 1096 77
        i 6.014 10.852 0.020 1 1094 69
        i 6.015 11.061 0.020 1 1098 74
        i 6.016 11.380 0.020 1 1102 57
        i 6.017 12.024 0.020 1 1096 76
        i 6.018 12.321 0.020 1 1101 58
        i 6.019 12.887 0.020 1 1094 55
        i 6.020 13.176 0.020 1 1095 82
        i 6.021 13.573 0.020 1 1104 76
        i 6.022 13.911 0.020 1 1097 60
        i 6.023 14.085 0.020 1 1102 59
        i 6.024 14.732 0.020 1 1095 62
        i 6.025 14.772 0.020 1 1096 73
        i 6.026 15.325 0.020 1 1093 64
        i 6.027 15.592 0.020 1 1099 61
        i 6.028 15.832 0.020 1 1103 75
        i 6.029 15.969 0.020 1 1099 76
        i 6.030 16.576 0.020 1 1095 69
        i 6.031 16.641 0.020 1 1097 56
        i 6.032 16.752 0.020 1 1101 61
        i 6.033 17.207 0.020 1 1103 79
        i 6.034 17.384 0.020 1 1093 72
        i 6.035 17.585 0.020 1 1096 74
        i 6.036 17.908 0.020 1 1105 65
        i 4.005 18.001 -1 3 29 45
        i 4.006 18.001 -1 3 41 63
        i -4.003 18.001 0
        i -4.004 18.001 0
        i 6.037 18.016 0.020 1 1103 69
        i 6.038 18.341 0.020 1 1098 78
        i 6.039 18.444 0.020 1 1095 59
        i 6.040 18.560 0.020 1 1101 75
        i 6.041 19.175 0.020 1 1097 55
        i 6.042 19.215 0.020 1 1094 79
        i 6.043 19.280 0.020 1 1097 83
        i 6.044 19.681 0.020 1 1099 60
        i 6.045 19.756 0.020 1 1092 81
        i 6.046 20.176 0.020 1 1099 57
        i 6.047 20.272 0.020 1 1102 53
        i 6.048 20.441 0.020 1 1097 79
        i 6.049 20.965 0.020 1 1104 60
        i 6.050 21.105 0.020 1 1094 59
        i 6.051 21.171 0.020 1 1100 75
        i 6.052 21.755 0.020 1 1104 64
        i 6.053 21.859 0.020 1 1092 74
        i 6.054 21.981 0.020 1 1096 56
        i 6.055 22.308 0.020 1 1096 79
        i 6.056 22.436 0.020 1 1102 78
        i 6.057 22.759 0.020 1 1098 67
        i 6.058 23.005 0.020 1 1094 73
        i 6.059 23.045 0.020 1 1100 56
        i 6.060 23.127 0.020 1 1098 69
        i 6.061 23.623 0.020 1 1093 58
        i 6.062 23.709 0.020 1 1098 72
        i 6.063 23.749 0.020 1 1092 59
        i 6.064 23.809 0.020 1 1098 67
        i 6.065 24.173 0.020 1 1091 68
        i 6.066 24.509 0.020 1 1102 62
        i 6.067 24.556 0.020 1 1096 60
        i 6.068 24.711 0.020 1 1101 64
        i 6.069 24.760 0.020 1 1100 68
        i 6.070 25.168 0.020 1 1104 66
        i 6.071 25.249 0.020 1 1100 69
        i 6.072 25.587 0.020 1 1099 61
        i 6.073 25.635 0.020 1 1094 82
        i 4.007 26.001 -1 3 33 45
        i 4.008 26.001 -1 3 45 63
        i -4.005 26.001 0
        i -4.006 26.001 0
        i 6.074 26.013 0.020 1 1095 61
        i 6.075 26.053 0.020 1 1103 75
        i 6.076 26.333 0.020 1 1092 80
        i 6.077 26.376 0.020 1 1097 84
        i 6.078 26.685 0.020 1 1097 57
        i 6.079 26.749 0.020 1 1097 62
        i 6.080 26.856 0.020 1 1101 56
        i 6.081 27.175 0.020 1 1099 65
        i 6.082 27.509 0.020 1 1099 68
        i 6.083 27.549 0.020 1 1093 79
        i 6.084 27.591 0.020 1 1099 54
        i 6.085 28.060 0.020 1 1093 65
        i 6.086 28.248 0.020 1 1091 56
        i 6.087 28.288 0.020 1 1097 79
        i 6.088 28.339 0.020 1 1099 55
        i 6.089 28.589 0.020 1 1092 72
        i 6.090 29.019 0.020 1 1101 66
        i 6.091 29.059 0.020 1 1101 78
        i 6.092 29.148 0.020 1 1100 59
        i 6.093 29.196 0.020 1 1095 75
        i 6.094 29.335 0.020 1 1101 75
        i 6.095 29.728 0.020 1 1099 67
        i 6.096 29.768 0.020 1 1099 75
        i 6.097 29.896 0.020 1 1105 74
        i 6.098 30.003 0.020 1 1098 76
        i 6.099 30.155 0.020 1 1093 52
        i 6.100 30.521 0.020 1 1095 71
        i 6.101 30.561 0.020 1 1103 75
        i 6.102 30.771 0.020 1 1098 54
        i 6.103 30.811 0.020 1 1093 52
        i 6.104 30.860 0.020 1 1103 56
        i 6.105 31.245 0.020 1 1098 81
        i 6.106 31.332 0.020 1 1101 57
        i 6.107 31.541 0.020 1 1105 54
        i 6.108 31.589 0.020 1 1097 81
        i 6.109 31.629 0.020 1 1100 78
        i 6.110 32.024 0.020 1 1092 82
        i 6.111 32.064 0.020 1 1098 82
        i 6.112 32.416 0.020 1 1095 82
        i 6.113 32.497 0.020 1 1092 75
        i 6.114 32.583 0.020 1 1100 80
        i 6.115 32.744 0.020 1 1090 75
        i 6.116 32.924 0.020 1 1100 82
        i 6.117 33.005 0.020 1 1092 80
        i 6.118 33.144 0.020 1 1097 55
        i 6.119 33.341 0.020 1 1096 83
        i 6.120 33.527 0.020 1 1100 62
        i 6.121 33.587 0.020 1 1100 55
        i 6.122 33.725 0.020 1 1101 76
        i 6.123 33.865 0.020 1 1102 61
        i 4.009 34.001 -1 3 31 45
        i 4.010 34.001 -1 3 43 63
        i -4.007 34.001 0
        i -4.008 34.001 0
        i 6.124 34.243 0.020 1 1098 59
        i 6.125 34.292 0.020 1 1098 57
        i 6.126 34.332 0.020 1 1094 75
        i 6.127 34.420 0.020 1 1097 58
        i 6.128 34.631 0.020 1 1092 81
        i 6.129 35.004 0.020 1 1104 71
        i 6.130 35.044 0.020 1 1096 71
        i 6.131 35.108 0.020 1 1104 64
        i 6.132 35.167 0.020 1 1099 60
        i 6.133 35.220 0.020 1 1094 80
        i 6.134 35.309 0.020 1 1092 68
        i 6.135 35.741 0.020 1 1098 73
        i 6.136 35.808 0.020 1 1100 74
        i 6.137 35.863 0.020 1 1106 83
        i 6.138 36.008 0.020 1 1101 55
        i 6.139 36.057 0.020 1 1102 67
        i 6.140 36.209 0.020 1 1090 77
        i 6.141 36.532 0.020 1 1092 79
        i 6.142 36.572 0.020 1 1098 74
        i 6.143 36.720 0.020 1 1100 63
        i 6.144 36.859 0.020 1 1096 83
        i 6.145 36.899 0.020 1 1098 79
        i 6.146 36.939 0.020 1 1091 63
        i 6.147 37.240 0.020 1 1091 64
        i 6.148 37.301 0.020 1 1098 77
        i 6.149 37.451 0.020 1 1093 54
        i 6.150 37.511 0.020 1 1100 56
        i 6.151 37.708 0.020 1 1098 66
        i 6.152 37.795 0.020 1 1100 57
        i 6.153 38.035 0.020 1 1099 59
        i 6.154 38.075 0.020 1 1099 74
        i 6.155 38.131 0.020 1 1094 68
        i 6.156 38.397 0.020 1 1103 78
        i 6.157 38.437 0.020 1 1100 70
        i 6.158 38.641 0.020 1 1095 56
        i 6.159 38.740 0.020 1 1097 78
        i 6.160 38.865 0.020 1 1097 74
        i 6.161 38.905 0.020 1 1097 60
        i 6.162 38.967 0.020 1 1098 68
        i 6.163 39.108 0.020 1 1093 56
        i 6.164 39.532 0.020 1 1093 80
        i 6.165 39.572 0.020 1 1097 52
        i 6.166 39.612 0.020 1 1105 58
        i 6.167 39.652 0.020 1 1100 73
        i 6.168 39.692 0.020 1 1095 68
        i 6.169 39.732 0.020 1 1091 60
        i 6.170 40.240 0.020 1 1099 73
        i 6.171 40.285 0.020 1 1099 74
        i 6.172 40.325 0.020 1 1105 60
        i 6.173 40.408 0.020 1 1103 56
        i 6.174 40.453 0.020 1 1102 75
        i 6.175 40.668 0.020 1 1089 76
        i 6.176 41.043 0.020 1 1091 72
        i 6.177 41.104 0.020 1 1097 55
        i 6.178 41.180 0.020 1 1097 76
        i 6.179 41.220 0.020 1 1099 53
        i 6.180 41.269 0.020 1 1101 77
        i 6.181 41.403 0.020 1 1092 77
        i 6.182 41.443 0.020 1 1103 75
        i 6.183 41.740 0.020 1 1091 69
        i 6.184 41.831 0.020 1 1097 53
        i 6.185 41.940 0.020 1 1094 84
        i 6.186 42.097 0.020 1 1101 52
        i 6.187 42.151 0.020 1 1099 81
        i 6.188 42.191 0.020 1 1099 81
        i 6.189 42.381 0.020 1 1101 74
        i 6.190 42.547 0.020 1 1098 72
        i 6.191 42.587 0.020 1 1098 77
        i 6.192 42.627 0.020 1 1095 63
        i 6.193 42.929 0.020 1 1103 54
        i 6.194 42.975 0.020 1 1099 60
        i 6.195 43.015 0.020 1 1103 66
        i 6.196 43.055 0.020 1 1101 62
        i 6.197 43.240 0.020 1 1096 64
        i 6.198 43.308 0.020 1 1097 49
        i 6.199 43.355 0.020 1 1096 68
        i 6.200 43.585 0.020 1 1094 64
        i 6.201 43.644 0.020 1 1105 70
        i 6.202 43.684 0.020 1 1097 80
        i 6.203 43.941 0.020 1 1095 73
        i 6.204 44.051 0.020 1 1098 73
        i 6.205 44.091 0.020 1 1100 65
        i 6.206 44.131 0.020 1 1096 53
        i 6.207 44.183 0.020 1 1105 80
        i 6.208 44.223 0.020 1 1091 49
        i 6.209 44.428 0.020 1 1095 67
        i 6.210 44.740 0.020 1 1100 56
        i 6.211 44.780 0.020 1 1093 81
        i 6.212 44.820 0.020 1 1105 71
        i 6.213 44.860 0.020 1 1098 58
        i 6.214 44.943 0.020 1 1102 62
        i 6.215 45.155 0.020 1 1098 49
        i 6.216 45.196 0.020 1 1090 65
        i 6.217 45.555 0.020 1 1090 67
        i 6.218 45.595 0.020 1 1098 81
        i 6.219 45.677 0.020 1 1096 74
        i 6.220 45.717 0.020 1 1102 71
        i 6.221 45.777 0.020 1 1098 67
        i 6.222 45.915 0.020 1 1093 71
        i 6.223 45.988 0.020 1 1102 55
        i 6.224 46.240 0.020 1 1092 80
        i 6.225 46.449 0.020 1 1096 71
        i 6.226 46.489 0.020 1 1095 74
        i 6.227 46.529 0.020 1 1100 73
        i 6.228 46.569 0.020 1 1100 57
        i 6.229 46.631 0.020 1 1102 84
        i 6.230 46.825 0.020 1 1090 62
        i 6.231 46.879 0.020 1 1100 61
        i 6.232 47.059 0.020 1 1098 54
        i 6.233 47.119 0.020 1 1097 63
        i 6.234 47.188 0.020 1 1096 50
        i 6.235 47.368 0.020 1 1088 62
        i 6.236 47.408 0.020 1 1104 81
        i 6.237 47.448 0.020 1 1098 77
        i 6.238 47.488 0.020 1 1104 76
        i 6.239 47.528 0.020 1 1100 58
        i 6.240 47.740 0.020 1 1096 80
        i 6.241 47.836 0.020 1 1098 75
        i 6.242 47.888 0.020 1 1095 83
        i 6.243 47.937 0.020 1 1106 65
        i -5.001 48.000 0
        i -4.009 48.000 0
        i -4.010 48.000 0
        i 6.244 48.009 0.020 1 1094 67
        i 6.245 48.091 0.020 1 1098 63
        i 6.246 48.217 0.020 1 1096 78
        i 6.247 48.257 0.020 1 1102 78
        i 6.248 48.561 0.020 1 1099 65
        i 6.249 48.601 0.020 1 1101 79
        i 6.250 48.641 0.020 1 1096 73
        i 6.251 48.780 0.020 1 1090 64
        i 6.252 48.869 0.020 1 1106 52
        i 6.253 48.909 0.020 1 1096 50
        i 6.254 48.993 0.020 1 1096 52
        i 6.255 49.197 0.020 1 1094 83
        i 6.256 49.239 0.020 1 1101 67
        i 6.257 49.337 0.020 1 1097 64
        i 6.258 49.377 0.020 1 1104 81
        i 6.259 49.476 0.020 1 1103 72
        i 6.260 49.747 0.020 1 1090 56
        i 6.261 49.787 0.020 1 1098 58
        i 6.262 49.912 0.020 1 1094 75
        i 6.263 49.952 0.020 1 1094 74
        i 6.264 50.017 0.020 1 1098 61
        i 6.265 50.064 0.020 1 1091 74
        i 6.266 50.265 0.020 1 1095 53
        i 6.267 50.372 0.020 1 1097 50
        i 6.268 50.435 0.020 1 1102 64
        i 6.269 50.475 0.020 1 1093 65
        i 6.270 50.653 0.020 1 1096 57
        i 6.271 50.737 0.020 1 1093 56
        i 6.272 50.807 0.020 1 1101 80
        i 6.273 50.861 0.020 1 1102 70
        i 6.274 51.049 0.020 1 1096 61
        i 6.275 51.089 0.020 1 1095 60
        i 6.276 51.164 0.020 1 1103 73
        i 6.277 51.204 0.020 1 1099 70
        i 6.278 51.244 0.020 1 1089 72
        i 6.279 51.547 0.020 1 1099 79
        i 6.280 51.587 0.020 1 1097 59
        i 6.281 51.716 0.020 1 1096 65
        i 6.282 51.756 0.020 1 1097 64
        i 6.283 51.796 0.020 1 1097 49
        i 6.284 51.836 0.020 1 1089 63
        i 6.285 51.879 0.020 1 1105 77
        i 6.286 51.919 0.020 1 1103 62
        i 6.287 52.236 0.020 1 1095 66
        i 6.288 52.385 0.020 1 1099 76
        i 6.289 52.433 0.020 1 1095 62
        i 6.290 52.473 0.020 1 1094 72
        i 6.291 52.513 0.020 1 1101 78
        i 6.292 52.553 0.020 1 1107 72
        i 6.293 52.635 0.020 1 1097 71
        i 6.294 52.675 0.020 1 1095 81
        i 6.295 53.064 0.020 1 1097 77
        i 6.296 53.104 0.020 1 1099 64
        i 6.297 53.144 0.020 1 1103 62
        i 6.298 53.184 0.020 1 1102 65
        i 6.299 53.375 0.020 1 1089 75
        i 6.300 53.435 0.020 1 1105 58
        i 6.301 53.475 0.020 1 1097 57
        i 6.302 53.615 0.020 1 1095 62
        i 6.303 53.735 0.020 1 1102 57
        i 6.304 53.871 0.020 1 1097 70
        i 6.305 54.013 0.020 1 1093 72
        i 6.306 54.053 0.020 1 1102 69
        i 6.307 54.093 0.020 1 1103 57
        i 6.308 54.296 0.020 1 1091 63
        i 6.309 54.405 0.020 1 1099 72
        i 6.310 54.456 0.020 1 1095 55
        i 6.311 54.572 0.020 1 1092 74
        i 6.312 54.612 0.020 1 1099 77
        i 6.313 54.652 0.020 1 1095 62
        i 6.314 54.853 0.020 1 1094 82
        i 6.315 54.929 0.020 1 1101 67
        i 6.316 54.969 0.020 1 1097 49
        i 6.317 55.040 0.020 1 1094 54
        i 6.318 55.117 0.020 1 1097 48
        i 6.319 55.233 0.020 1 1094 56
        i 6.320 55.273 0.020 1 1101 83
        i 6.321 55.503 0.020 1 1101 52
        i 6.322 55.543 0.020 1 1099 48
        i 6.323 55.636 0.020 1 1089 47
        i 6.324 55.676 0.020 1 1096 83
        i 6.325 55.716 0.020 1 1104 72
        i 6.326 55.756 0.020 1 1095 80
        i 6.327 56.065 0.020 1 1097 63
        i 6.328 56.105 0.020 1 1096 80
        i 6.329 56.145 0.020 1 1099 58
        i 6.330 56.329 0.020 1 1096 57
        i 6.331 56.369 0.020 1 1089 54
        i 6.332 56.409 0.020 1 1102 64
        i 6.333 56.449 0.020 1 1105 49
        i 6.334 56.489 0.020 1 1098 55
        i 6.335 56.732 0.020 1 1094 62
        i 6.336 56.875 0.020 1 1096 83
        i 6.337 56.933 0.020 1 1101 57
        i 6.338 56.973 0.020 1 1100 62
        i 6.339 57.025 0.020 1 1094 80
        i 6.340 57.065 0.020 1 1093 53
        i 6.341 57.176 0.020 1 1106 49
        i 6.342 57.216 0.020 1 1096 71
        i 6.343 57.501 0.020 1 1104 67
        i 6.344 57.560 0.020 1 1098 79
        i 6.345 57.600 0.020 1 1100 74
        i 6.346 57.696 0.020 1 1103 72
        i 6.347 57.904 0.020 1 1090 56
        i 6.348 57.944 0.020 1 1104 55
        i 6.349 57.984 0.020 1 1098 76
        i 6.350 58.156 0.020 1 1094 50
        i 6.351 58.231 0.020 1 1102 78
        i 6.352 58.305 0.020 1 1094 62
        i 6.353 58.421 0.020 1 1096 56
        i 6.354 58.645 0.020 1 1101 83
        i 6.355 58.685 0.020 1 1102 67
        i 6.356 58.743 0.020 1 1100 61
        i 6.357 58.783 0.020 1 1092 76
        i 6.358 58.844 0.020 1 1096 76
        i 6.359 58.920 0.020 1 1096 60
        i 6.360 59.080 0.020 1 1092 54
        i 6.361 59.269 0.020 1 1100 68
        i 6.362 59.375 0.020 1 1100 66
        i 6.363 59.415 0.020 1 1094 59
        i 6.364 59.496 0.020 1 1096 49
        i 6.365 59.536 0.020 1 1098 44
        i 6.366 59.611 0.020 1 1095 67
        i 6.367 59.651 0.020 1 1100 82
        i 6.368 59.731 0.020 1 1095 80
        i 6.369 59.816 0.020 1 1102 66
        i 6.370 59.948 0.020 1 1098 76
        i 6.371 60.101 0.020 1 1088 48
        i 6.372 60.141 0.020 1 1098 75
        i 6.373 60.181 0.020 1 1104 76
        i 6.374 60.233 0.020 1 1097 56
        i 6.375 60.303 0.020 1 1094 66
        i 6.376 60.509 0.020 1 1096 55
        i 6.377 60.584 0.020 1 1095 84
        i 6.378 60.788 0.020 1 1101 65
        i 6.379 60.873 0.020 1 1102 70
        i 6.380 60.913 0.020 1 1090 46
        i 6.381 60.953 0.020 1 1098 66
        i 6.382 60.993 0.020 1 1106 68
        i 6.383 61.033 0.020 1 1095 80
        i 6.384 61.231 0.020 1 1093 79
        i 6.385 61.349 0.020 1 1094 72
        i 6.386 61.389 0.020 1 1097 73
        i 6.387 61.429 0.020 1 1104 60
        i 6.388 61.469 0.020 1 1101 75
        i 6.389 61.648 0.020 1 1093 84
        i 6.390 61.836 0.020 1 1096 72
        i 6.391 61.892 0.020 1 1106 57
        i 6.392 62.088 0.020 1 1101 74
        i 6.393 62.128 0.020 1 1099 69
        i 6.394 62.168 0.020 1 1094 79
        i 6.395 62.265 0.020 1 1102 57
        i 6.396 62.336 0.020 1 1103 69
        i 6.397 62.376 0.020 1 1091 49
        i 6.398 62.492 0.020 1 1099 70
        i 6.399 62.661 0.020 1 1097 62
        i 6.400 62.701 0.020 1 1093 73
        i 6.401 62.741 0.020 1 1101 58
        i 6.402 63.008 0.020 1 1095 74
        i 6.403 63.149 0.020 1 1101 67
        i 6.404 63.189 0.020 1 1093 54
        i 6.405 63.229 0.020 1 1101 54
        i 6.406 63.269 0.020 1 1100 56
        i 6.407 63.348 0.020 1 1099 70
        i 6.408 63.388 0.020 1 1097 45
        i 6.409 63.592 0.020 1 1093 66
        i 6.410 63.632 0.020 1 1107 76
        i 6.411 63.676 0.020 1 1109 77
        i 6.412 63.833 0.020 1 1111 78
        i 6.413 63.873 0.020 1 1112 48
        i 6.414 63.913 0.020 1 1112 51
        i 6.415 63.953 0.020 1 1093 80
        i 6.416 63.993 0.020 1 1097 53
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
        {"baeea327-af4b-4b10-a843-6614c20ea958":[],"069e83fd-1c94-47e9-95ec-126e0fbefec3":[],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","soundDistanceMin":5,"soundDistanceMax":100},{"noteOn":{"time":0.005,"note":63.000,"xyz":[-7.790,14.961,97.171]}},{"noteOn":{"time":7.855,"note":98.000,"xyz":[37.826,17.717,68.330]}},{"noteOn":{"time":8.825,"note":95.000,"xyz":[-19.347,17.480,-61.166]}},{"noteOn":{"time":9.620,"note":103.000,"xyz":[59.685,18.110,42.203]}},{"noteOn":{"time":10.245,"note":103.000,"xyz":[2.789,18.110,17.521]}},{"noteOn":{"time":10.800,"note":95.000,"xyz":[26.262,17.480,7.885]}},{"noteOn":{"time":11.530,"note":97.000,"xyz":[-16.228,17.638,-37.392]}},{"noteOn":{"time":12.440,"note":97.000,"xyz":[-52.562,17.638,-2.952]}},{"noteOn":{"time":13.355,"note":95.000,"xyz":[-33.817,17.480,8.435]}},{"noteOn":{"time":14.095,"note":103.000,"xyz":[5.789,18.110,7.229]}},{"noteOn":{"time":14.665,"note":102.000,"xyz":[-10.850,18.031,-71.756]}},{"noteOn":{"time":15.235,"note":96.000,"xyz":[85.770,17.559,41.711]}},{"noteOn":{"time":15.275,"note":96.000,"xyz":[34.704,17.559,-44.318]}},{"noteOn":{"time":15.850,"note":94.000,"xyz":[-9.534,17.402,-6.608]}},{"noteOn":{"time":16.060,"note":98.000,"xyz":[-20.348,17.717,11.040]}},{"noteOn":{"time":16.380,"note":102.000,"xyz":[26.315,18.031,-53.168]}},{"noteOn":{"time":17.025,"note":96.000,"xyz":[82.002,17.559,-0.501]}},{"noteOn":{"time":17.320,"note":101.000,"xyz":[92.346,17.953,-4.405]}},{"noteOn":{"time":17.885,"note":94.000,"xyz":[78.764,17.402,-53.592]}},{"noteOn":{"time":18.175,"note":95.000,"xyz":[-72.304,17.480,-55.217]}},{"noteOn":{"time":18.575,"note":104.000,"xyz":[-27.357,18.189,-61.028]}},{"noteOn":{"time":18.910,"note":97.000,"xyz":[2.360,17.638,-9.322]}},{"noteOn":{"time":19.085,"note":102.000,"xyz":[-23.203,18.031,62.042]}},{"noteOn":{"time":19.730,"note":95.000,"xyz":[26.151,17.480,-25.230]}},{"noteOn":{"time":19.770,"note":96.000,"xyz":[-35.340,17.559,43.963]}},{"noteOn":{"time":20.325,"note":93.000,"xyz":[-80.265,17.323,48.437]}},{"noteOn":{"time":20.590,"note":99.000,"xyz":[28.611,17.795,1.059]}},{"noteOn":{"time":20.830,"note":103.000,"xyz":[22.089,18.110,40.609]}},{"noteOn":{"time":20.970,"note":99.000,"xyz":[-26.789,17.795,-66.071]}},{"noteOn":{"time":21.575,"note":95.000,"xyz":[6.063,17.480,-6.609]}},{"noteOn":{"time":21.640,"note":97.000,"xyz":[-2.150,17.638,-12.916]}},{"noteOn":{"time":21.750,"note":101.000,"xyz":[4.033,17.953,-83.014]}},{"noteOn":{"time":22.205,"note":103.000,"xyz":[-4.871,18.110,-2.511]}},{"noteOn":{"time":22.385,"note":93.000,"xyz":[67.092,17.323,29.925]}},{"noteOn":{"time":22.585,"note":96.000,"xyz":[-22.998,17.559,27.085]}},{"noteOn":{"time":22.910,"note":105.000,"xyz":[-9.566,18.268,-36.073]}},{"noteOn":{"time":23.015,"note":103.000,"xyz":[-35.499,18.110,61.967]}},{"noteOn":{"time":23.340,"note":98.000,"xyz":[26.684,17.717,8.884]}},{"noteOn":{"time":23.445,"note":95.000,"xyz":[-58.758,17.480,-11.941]}},{"noteOn":{"time":23.560,"note":101.000,"xyz":[85.757,17.953,-32.817]}},{"noteOn":{"time":24.175,"note":97.000,"xyz":[41.001,17.638,-29.476]}},{"noteOn":{"time":24.215,"note":94.000,"xyz":[23.128,17.402,25.422]}},{"noteOn":{"time":24.280,"note":97.000,"xyz":[68.632,17.638,-28.544]}},{"noteOn":{"time":24.680,"note":99.000,"xyz":[74.681,17.795,-44.526]}},{"noteOn":{"time":24.755,"note":92.000,"xyz":[20.241,17.244,26.854]}},{"noteOn":{"time":25.175,"note":99.000,"xyz":[21.403,17.795,-9.516]}},{"noteOn":{"time":25.270,"note":102.000,"xyz":[-42.652,18.031,80.723]}},{"noteOn":{"time":25.440,"note":97.000,"xyz":[-69.629,17.638,29.835]}},{"noteOn":{"time":25.965,"note":104.000,"xyz":[67.481,18.189,-46.761]}},{"noteOn":{"time":26.105,"note":94.000,"xyz":[-20.695,17.402,-10.542]}},{"noteOn":{"time":26.170,"note":100.000,"xyz":[-12.139,17.874,54.247]}},{"noteOn":{"time":26.755,"note":104.000,"xyz":[33.849,18.189,8.332]}},{"noteOn":{"time":26.860,"note":92.000,"xyz":[43.611,17.244,71.221]}},{"noteOn":{"time":26.980,"note":96.000,"xyz":[23.922,17.559,27.851]}},{"noteOn":{"time":27.310,"note":96.000,"xyz":[2.976,17.559,8.339]}},{"noteOn":{"time":27.435,"note":102.000,"xyz":[-11.482,18.031,-54.735]}},{"noteOn":{"time":27.760,"note":98.000,"xyz":[23.606,17.717,-1.301]}},{"noteOn":{"time":28.005,"note":94.000,"xyz":[-62.465,17.402,-32.650]}},{"noteOn":{"time":28.045,"note":100.000,"xyz":[10.813,17.874,-8.817]}},{"noteOn":{"time":28.125,"note":98.000,"xyz":[-5.670,17.717,-24.768]}},{"noteOn":{"time":28.625,"note":93.000,"xyz":[-51.198,17.323,12.982]}},{"noteOn":{"time":28.710,"note":98.000,"xyz":[-73.106,17.717,19.662]}},{"noteOn":{"time":28.750,"note":92.000,"xyz":[6.579,17.244,25.283]}},{"noteOn":{"time":28.810,"note":98.000,"xyz":[-5.175,17.717,27.995]}},{"noteOn":{"time":29.175,"note":91.000,"xyz":[31.680,17.165,34.124]}},{"noteOn":{"time":29.510,"note":102.000,"xyz":[-20.709,18.031,12.648]}},{"noteOn":{"time":29.555,"note":96.000,"xyz":[-50.089,17.559,0.841]}},{"noteOn":{"time":29.710,"note":101.000,"xyz":[52.855,17.953,-82.401]}},{"noteOn":{"time":29.760,"note":100.000,"xyz":[62.916,17.874,14.543]}},{"noteOn":{"time":30.170,"note":104.000,"xyz":[62.282,18.189,-15.770]}},{"noteOn":{"time":30.250,"note":100.000,"xyz":[92.656,17.874,12.675]}},{"noteOn":{"time":30.585,"note":99.000,"xyz":[-20.964,17.795,-17.757]}},{"noteOn":{"time":30.635,"note":94.000,"xyz":[-53.212,17.402,51.575]}},{"noteOn":{"time":31.015,"note":95.000,"xyz":[-5.349,17.480,19.556]}},{"noteOn":{"time":31.055,"note":103.000,"xyz":[19.727,18.110,-60.747]}},{"noteOn":{"time":31.335,"note":92.000,"xyz":[3.045,17.244,-28.582]}},{"noteOn":{"time":31.375,"note":97.000,"xyz":[37.523,17.638,73.901]}},{"noteOn":{"time":31.685,"note":97.000,"xyz":[-30.136,17.638,69.586]}},{"noteOn":{"time":31.750,"note":97.000,"xyz":[-20.736,17.638,-23.855]}},{"noteOn":{"time":31.855,"note":101.000,"xyz":[42.387,17.953,8.322]}},{"noteOn":{"time":32.175,"note":99.000,"xyz":[3.139,17.795,-31.025]}},{"noteOn":{"time":32.510,"note":99.000,"xyz":[26.713,17.795,-5.885]}},{"noteOn":{"time":32.550,"note":93.000,"xyz":[42.741,17.323,-35.160]}},{"noteOn":{"time":32.590,"note":99.000,"xyz":[16.289,17.795,-45.684]}},{"noteOn":{"time":33.060,"note":93.000,"xyz":[-46.532,17.323,-10.070]}},{"noteOn":{"time":33.250,"note":91.000,"xyz":[70.871,17.165,-63.478]}},{"noteOn":{"time":33.290,"note":97.000,"xyz":[-11.075,17.638,-15.875]}},{"noteOn":{"time":33.340,"note":99.000,"xyz":[4.789,17.795,14.072]}},{"noteOn":{"time":33.590,"note":92.000,"xyz":[1.495,17.244,14.091]}},{"noteOn":{"time":34.020,"note":101.000,"xyz":[-1.921,17.953,-11.470]}},{"noteOn":{"time":34.060,"note":101.000,"xyz":[15.829,17.953,65.261]}},{"noteOn":{"time":34.150,"note":100.000,"xyz":[23.811,17.874,30.462]}},{"noteOn":{"time":34.195,"note":95.000,"xyz":[8.583,17.480,53.551]}},{"noteOn":{"time":34.335,"note":101.000,"xyz":[-17.923,17.953,16.173]}},{"noteOn":{"time":34.730,"note":99.000,"xyz":[-65.174,17.795,37.018]}},{"noteOn":{"time":34.770,"note":99.000,"xyz":[55.443,17.795,9.145]}},{"noteOn":{"time":34.895,"note":105.000,"xyz":[-40.318,18.268,54.364]}},{"noteOn":{"time":35.005,"note":98.000,"xyz":[91.548,17.717,-31.627]}},{"noteOn":{"time":35.155,"note":93.000,"xyz":[74.448,17.323,-29.005]}},{"noteOn":{"time":35.520,"note":95.000,"xyz":[-2.084,17.480,9.086]}},{"noteOn":{"time":35.560,"note":103.000,"xyz":[69.565,18.110,48.942]}},{"noteOn":{"time":35.770,"note":98.000,"xyz":[-52.484,17.717,-69.952]}},{"noteOn":{"time":35.810,"note":93.000,"xyz":[-76.498,17.323,-59.417]}},{"noteOn":{"time":35.860,"note":103.000,"xyz":[-18.554,18.110,40.963]}},{"noteOn":{"time":36.245,"note":98.000,"xyz":[-88.348,17.717,17.832]}},{"noteOn":{"time":36.330,"note":101.000,"xyz":[-2.916,17.953,-47.595]}},{"noteOn":{"time":36.540,"note":105.000,"xyz":[-8.020,18.268,-81.840]}},{"noteOn":{"time":36.590,"note":97.000,"xyz":[87.770,17.638,-20.951]}},{"noteOn":{"time":36.630,"note":100.000,"xyz":[-4.040,17.874,11.797]}},{"noteOn":{"time":37.025,"note":92.000,"xyz":[-8.141,17.244,2.278]}},{"noteOn":{"time":37.065,"note":98.000,"xyz":[20.943,17.717,16.086]}},{"noteOn":{"time":37.415,"note":95.000,"xyz":[27.403,17.480,-68.704]}},{"noteOn":{"time":37.495,"note":92.000,"xyz":[65.591,17.244,-71.354]}},{"noteOn":{"time":37.585,"note":100.000,"xyz":[30.820,17.874,19.371]}},{"noteOn":{"time":37.745,"note":90.000,"xyz":[1.041,17.087,-18.867]}},{"noteOn":{"time":37.925,"note":100.000,"xyz":[-21.273,17.874,-66.664]}},{"noteOn":{"time":38.005,"note":92.000,"xyz":[-11.653,17.244,7.427]}},{"noteOn":{"time":38.145,"note":97.000,"xyz":[3.514,17.638,-48.850]}},{"noteOn":{"time":38.340,"note":96.000,"xyz":[-56.001,17.559,26.979]}},{"noteOn":{"time":38.525,"note":100.000,"xyz":[-9.907,17.874,-20.009]}},{"noteOn":{"time":38.585,"note":100.000,"xyz":[-31.730,17.874,-20.355]}},{"noteOn":{"time":38.725,"note":101.000,"xyz":[-32.982,17.953,-3.360]}},{"noteOn":{"time":38.865,"note":102.000,"xyz":[7.469,18.031,-4.246]}},{"noteOn":{"time":39.245,"note":98.000,"xyz":[36.920,17.717,-51.502]}},{"noteOn":{"time":39.290,"note":98.000,"xyz":[-87.416,17.717,-46.002]}},{"noteOn":{"time":39.330,"note":94.000,"xyz":[-23.630,17.402,-18.848]}},{"noteOn":{"time":39.420,"note":97.000,"xyz":[-16.912,17.638,4.864]}},{"noteOn":{"time":39.630,"note":92.000,"xyz":[-16.021,17.244,13.443]}},{"noteOn":{"time":40.005,"note":104.000,"xyz":[21.558,18.189,-19.835]}},{"noteOn":{"time":40.045,"note":96.000,"xyz":[63.817,17.559,67.715]}},{"noteOn":{"time":40.110,"note":104.000,"xyz":[51.826,18.189,27.070]}},{"noteOn":{"time":40.165,"note":99.000,"xyz":[72.694,17.795,-52.176]}},{"noteOn":{"time":40.220,"note":94.000,"xyz":[-22.395,17.402,81.301]}},{"noteOn":{"time":40.310,"note":92.000,"xyz":[-26.093,17.244,-81.422]}},{"noteOn":{"time":40.740,"note":98.000,"xyz":[23.455,17.717,33.462]}},{"noteOn":{"time":40.810,"note":100.000,"xyz":[11.089,17.874,-59.096]}},{"noteOn":{"time":40.865,"note":106.000,"xyz":[-36.219,18.346,72.075]}},{"noteOn":{"time":41.010,"note":101.000,"xyz":[47.269,17.953,31.243]}},{"noteOn":{"time":41.055,"note":102.000,"xyz":[-2.968,18.031,5.148]}},{"noteOn":{"time":41.210,"note":90.000,"xyz":[8.788,17.087,-41.460]}},{"noteOn":{"time":41.530,"note":92.000,"xyz":[81.225,17.244,54.862]}},{"noteOn":{"time":41.570,"note":98.000,"xyz":[-35.725,17.717,-88.387]}},{"noteOn":{"time":41.720,"note":100.000,"xyz":[-37.534,17.874,-60.971]}},{"noteOn":{"time":41.860,"note":96.000,"xyz":[-53.297,17.559,-63.980]}},{"noteOn":{"time":41.900,"note":98.000,"xyz":[64.273,17.717,-34.462]}},{"noteOn":{"time":41.940,"note":91.000,"xyz":[-4.990,17.165,15.591]}},{"noteOn":{"time":42.240,"note":91.000,"xyz":[2.751,17.165,-6.830]}},{"noteOn":{"time":42.300,"note":98.000,"xyz":[18.234,17.717,36.890]}},{"noteOn":{"time":42.450,"note":93.000,"xyz":[4.657,17.323,44.603]}},{"noteOn":{"time":42.510,"note":100.000,"xyz":[28.629,17.874,-7.481]}},{"noteOn":{"time":42.710,"note":98.000,"xyz":[71.083,17.717,-58.527]}},{"noteOn":{"time":42.795,"note":100.000,"xyz":[34.695,17.874,-68.941]}},{"noteOn":{"time":43.035,"note":99.000,"xyz":[-33.745,17.795,47.763]}},{"noteOn":{"time":43.075,"note":99.000,"xyz":[-25.589,17.795,10.051]}},{"noteOn":{"time":43.130,"note":94.000,"xyz":[51.952,17.402,73.349]}},{"noteOn":{"time":43.395,"note":103.000,"xyz":[47.410,18.110,-4.085]}},{"noteOn":{"time":43.435,"note":100.000,"xyz":[-27.353,17.874,-12.330]}},{"noteOn":{"time":43.640,"note":95.000,"xyz":[18.174,17.480,70.983]}},{"noteOn":{"time":43.740,"note":97.000,"xyz":[-76.839,17.638,41.534]}},{"noteOn":{"time":43.865,"note":97.000,"xyz":[-3.435,17.638,46.841]}},{"noteOn":{"time":43.905,"note":97.000,"xyz":[-5.839,17.638,6.378]}},{"noteOn":{"time":43.965,"note":98.000,"xyz":[21.781,17.717,-2.659]}},{"noteOn":{"time":44.110,"note":93.000,"xyz":[52.726,17.323,61.943]}},{"noteOn":{"time":44.530,"note":93.000,"xyz":[1.248,17.323,-4.898]}},{"noteOn":{"time":44.570,"note":97.000,"xyz":[-42.850,17.638,-0.933]}},{"noteOn":{"time":44.610,"note":105.000,"xyz":[58.568,18.268,-8.271]}},{"noteOn":{"time":44.650,"note":100.000,"xyz":[-20.400,17.874,9.537]}},{"noteOn":{"time":44.690,"note":95.000,"xyz":[88.362,17.480,-44.634]}},{"noteOn":{"time":44.730,"note":91.000,"xyz":[43.172,17.165,31.353]}},{"noteOn":{"time":45.240,"note":99.000,"xyz":[-29.196,17.795,12.400]}},{"noteOn":{"time":45.285,"note":99.000,"xyz":[70.490,17.795,-19.001]}},{"noteOn":{"time":45.325,"note":105.000,"xyz":[-19.173,18.268,-27.235]}},{"noteOn":{"time":45.410,"note":103.000,"xyz":[29.897,18.110,9.385]}},{"noteOn":{"time":45.455,"note":102.000,"xyz":[7.747,18.031,23.165]}},{"noteOn":{"time":45.670,"note":89.000,"xyz":[-4.047,17.008,-39.171]}},{"noteOn":{"time":46.045,"note":91.000,"xyz":[3.001,17.165,-13.050]}},{"noteOn":{"time":46.105,"note":97.000,"xyz":[-16.285,17.638,-83.282]}},{"noteOn":{"time":46.180,"note":97.000,"xyz":[50.159,17.638,-23.127]}},{"noteOn":{"time":46.220,"note":99.000,"xyz":[-17.968,17.795,-43.065]}},{"noteOn":{"time":46.270,"note":101.000,"xyz":[16.234,17.953,-0.017]}},{"noteOn":{"time":46.405,"note":92.000,"xyz":[89.659,17.244,-28.115]}},{"noteOn":{"time":46.445,"note":103.000,"xyz":[-45.031,18.110,-60.500]}},{"noteOn":{"time":46.740,"note":91.000,"xyz":[38.437,17.165,-47.032]}},{"noteOn":{"time":46.830,"note":97.000,"xyz":[-17.991,17.638,35.370]}},{"noteOn":{"time":46.940,"note":94.000,"xyz":[-64.307,17.402,-73.775]}},{"noteOn":{"time":47.095,"note":101.000,"xyz":[31.966,17.953,-12.245]}},{"noteOn":{"time":47.150,"note":99.000,"xyz":[38.808,17.795,-26.213]}},{"noteOn":{"time":47.190,"note":99.000,"xyz":[-9.899,17.795,-2.518]}},{"noteOn":{"time":47.380,"note":101.000,"xyz":[-26.517,17.953,-30.587]}},{"noteOn":{"time":47.545,"note":98.000,"xyz":[-0.151,17.717,-34.155]}},{"noteOn":{"time":47.585,"note":98.000,"xyz":[57.229,17.717,3.011]}},{"noteOn":{"time":47.625,"note":95.000,"xyz":[46.795,17.480,-37.753]}},{"noteOn":{"time":47.930,"note":103.000,"xyz":[39.206,18.110,-46.618]}},{"noteOn":{"time":47.975,"note":99.000,"xyz":[-32.052,17.795,-64.058]}},{"noteOn":{"time":48.015,"note":103.000,"xyz":[51.246,18.110,-9.655]}},{"noteOn":{"time":48.055,"note":101.000,"xyz":[30.916,17.953,46.864]}},{"noteOn":{"time":48.240,"note":96.000,"xyz":[87.630,17.559,-1.217]}},{"noteOn":{"time":48.310,"note":97.000,"xyz":[-5.599,17.638,-14.250]}},{"noteOn":{"time":48.355,"note":96.000,"xyz":[-10.114,17.559,81.358]}},{"noteOn":{"time":48.585,"note":94.000,"xyz":[-15.585,17.402,57.151]}},{"noteOn":{"time":48.645,"note":105.000,"xyz":[13.220,18.268,70.003]}},{"noteOn":{"time":48.685,"note":97.000,"xyz":[50.232,17.638,-18.648]}},{"noteOn":{"time":48.940,"note":95.000,"xyz":[3.609,17.480,-9.890]}},{"noteOn":{"time":49.050,"note":98.000,"xyz":[-42.081,17.717,-25.214]}},{"noteOn":{"time":49.090,"note":100.000,"xyz":[8.199,17.874,19.690]}},{"noteOn":{"time":49.130,"note":96.000,"xyz":[9.290,17.559,32.746]}},{"noteOn":{"time":49.185,"note":105.000,"xyz":[54.088,18.268,55.377]}},{"noteOn":{"time":49.225,"note":91.000,"xyz":[64.560,17.165,-38.799]}},{"noteOn":{"time":49.430,"note":95.000,"xyz":[-3.525,17.480,3.631]}},{"noteOn":{"time":49.740,"note":100.000,"xyz":[15.061,17.874,-14.814]}},{"noteOn":{"time":49.780,"note":93.000,"xyz":[-3.394,17.323,27.805]}},{"noteOn":{"time":49.820,"note":105.000,"xyz":[17.866,18.268,20.190]}},{"noteOn":{"time":49.860,"note":98.000,"xyz":[-70.964,17.717,-68.939]}},{"noteOn":{"time":49.945,"note":102.000,"xyz":[43.334,18.031,-53.553]}},{"noteOn":{"time":50.155,"note":98.000,"xyz":[19.193,17.717,60.168]}},{"noteOn":{"time":50.195,"note":90.000,"xyz":[-70.580,17.087,-10.311]}},{"noteOn":{"time":50.555,"note":90.000,"xyz":[-6.323,17.087,-6.948]}},{"noteOn":{"time":50.595,"note":98.000,"xyz":[42.894,17.717,20.420]}},{"noteOn":{"time":50.675,"note":96.000,"xyz":[-51.135,17.559,-70.190]}},{"noteOn":{"time":50.715,"note":102.000,"xyz":[-11.028,18.031,84.731]}},{"noteOn":{"time":50.775,"note":98.000,"xyz":[-20.321,17.717,-76.072]}},{"noteOn":{"time":50.915,"note":93.000,"xyz":[1.164,17.323,8.729]}},{"noteOn":{"time":50.990,"note":102.000,"xyz":[89.746,18.031,24.574]}},{"noteOn":{"time":51.240,"note":92.000,"xyz":[-72.403,17.244,-14.213]}},{"noteOn":{"time":51.450,"note":96.000,"xyz":[24.868,17.559,-21.726]}},{"noteOn":{"time":51.490,"note":95.000,"xyz":[-4.091,17.480,-58.191]}},{"noteOn":{"time":51.530,"note":100.000,"xyz":[74.294,17.874,-46.812]}},{"noteOn":{"time":51.570,"note":100.000,"xyz":[-0.871,17.874,62.976]}},{"noteOn":{"time":51.630,"note":102.000,"xyz":[-1.187,18.031,-29.946]}},{"noteOn":{"time":51.825,"note":90.000,"xyz":[-70.471,17.087,8.404]}},{"noteOn":{"time":51.880,"note":100.000,"xyz":[-39.472,17.874,47.060]}},{"noteOn":{"time":52.060,"note":98.000,"xyz":[-19.731,17.717,78.408]}},{"noteOn":{"time":52.120,"note":97.000,"xyz":[80.125,17.638,-10.376]}},{"noteOn":{"time":52.190,"note":96.000,"xyz":[72.220,17.559,-65.555]}},{"noteOn":{"time":52.370,"note":88.000,"xyz":[0.054,16.929,-6.864]}},{"noteOn":{"time":52.410,"note":104.000,"xyz":[32.409,18.189,13.946]}},{"noteOn":{"time":52.450,"note":98.000,"xyz":[-45.810,17.717,55.437]}},{"noteOn":{"time":52.490,"note":104.000,"xyz":[-25.425,18.189,30.508]}},{"noteOn":{"time":52.530,"note":100.000,"xyz":[-36.675,17.874,51.143]}},{"noteOn":{"time":52.740,"note":96.000,"xyz":[-55.955,17.559,0.812]}},{"noteOn":{"time":52.835,"note":98.000,"xyz":[14.119,17.717,30.399]}},{"noteOn":{"time":52.890,"note":95.000,"xyz":[2.848,17.480,22.673]}},{"noteOn":{"time":52.935,"note":106.000,"xyz":[2.308,18.346,-23.076]}},{"noteOn":{"time":53.010,"note":94.000,"xyz":[-43.297,17.402,26.424]}},{"noteOn":{"time":53.090,"note":98.000,"xyz":[6.910,17.717,12.677]}},{"noteOn":{"time":53.215,"note":96.000,"xyz":[-36.816,17.559,52.315]}},{"noteOn":{"time":53.255,"note":102.000,"xyz":[17.095,18.031,-14.186]}},{"noteOn":{"time":53.560,"note":99.000,"xyz":[-5.603,17.795,0.467]}},{"noteOn":{"time":53.600,"note":101.000,"xyz":[-5.652,17.953,54.809]}},{"noteOn":{"time":53.640,"note":96.000,"xyz":[-15.157,17.559,42.891]}},{"noteOn":{"time":53.780,"note":90.000,"xyz":[24.336,17.087,-51.000]}},{"noteOn":{"time":53.870,"note":106.000,"xyz":[-0.806,18.346,-7.021]}},{"noteOn":{"time":53.910,"note":96.000,"xyz":[-13.347,17.559,40.216]}},{"noteOn":{"time":53.995,"note":96.000,"xyz":[6.728,17.559,-2.154]}},{"noteOn":{"time":54.195,"note":94.000,"xyz":[-88.194,17.402,-44.803]}},{"noteOn":{"time":54.240,"note":101.000,"xyz":[65.498,17.953,-64.085]}},{"noteOn":{"time":54.335,"note":97.000,"xyz":[-1.532,17.638,-43.898]}},{"noteOn":{"time":54.375,"note":104.000,"xyz":[0.180,18.189,49.156]}},{"noteOn":{"time":54.475,"note":103.000,"xyz":[-2.077,18.110,89.420]}},{"noteOn":{"time":54.745,"note":90.000,"xyz":[-49.683,17.087,-11.618]}},{"noteOn":{"time":54.785,"note":98.000,"xyz":[60.515,17.717,14.968]}},{"noteOn":{"time":54.910,"note":94.000,"xyz":[20.609,17.402,19.205]}},{"noteOn":{"time":54.950,"note":94.000,"xyz":[-27.228,17.402,-96.194]}},{"noteOn":{"time":55.015,"note":98.000,"xyz":[19.516,17.717,-5.377]}},{"noteOn":{"time":55.065,"note":91.000,"xyz":[16.309,17.165,-93.048]}},{"noteOn":{"time":55.265,"note":95.000,"xyz":[-4.442,17.480,-26.979]}},{"noteOn":{"time":55.370,"note":97.000,"xyz":[-6.895,17.638,15.642]}},{"noteOn":{"time":55.435,"note":102.000,"xyz":[44.937,18.031,49.798]}},{"noteOn":{"time":55.475,"note":93.000,"xyz":[-18.159,17.323,-22.866]}},{"noteOn":{"time":55.655,"note":96.000,"xyz":[68.213,17.559,10.158]}},{"noteOn":{"time":55.735,"note":93.000,"xyz":[21.265,17.323,53.382]}},{"noteOn":{"time":55.805,"note":101.000,"xyz":[-23.924,17.953,-71.028]}},{"noteOn":{"time":55.860,"note":102.000,"xyz":[-4.238,18.031,5.467]}},{"noteOn":{"time":56.050,"note":96.000,"xyz":[61.898,17.559,0.610]}},{"noteOn":{"time":56.090,"note":95.000,"xyz":[-33.685,17.480,-44.724]}},{"noteOn":{"time":56.165,"note":103.000,"xyz":[4.147,18.110,-73.461]}},{"noteOn":{"time":56.205,"note":99.000,"xyz":[59.029,17.795,-60.146]}},{"noteOn":{"time":56.245,"note":89.000,"xyz":[2.098,17.008,26.401]}},{"noteOn":{"time":56.545,"note":99.000,"xyz":[62.562,17.795,39.366]}},{"noteOn":{"time":56.585,"note":97.000,"xyz":[47.430,17.638,-77.557]}},{"noteOn":{"time":56.715,"note":96.000,"xyz":[-18.214,17.559,81.164]}},{"noteOn":{"time":56.755,"note":97.000,"xyz":[-0.075,17.638,-31.168]}},{"noteOn":{"time":56.795,"note":97.000,"xyz":[-35.454,17.638,-27.015]}},{"noteOn":{"time":56.835,"note":89.000,"xyz":[10.030,17.008,-15.208]}},{"noteOn":{"time":56.880,"note":105.000,"xyz":[-39.799,18.268,-20.036]}},{"noteOn":{"time":56.920,"note":103.000,"xyz":[-37.664,18.110,1.955]}},{"noteOn":{"time":57.235,"note":95.000,"xyz":[-22.927,17.480,-28.036]}},{"noteOn":{"time":57.385,"note":99.000,"xyz":[-12.342,17.795,19.043]}},{"noteOn":{"time":57.435,"note":95.000,"xyz":[12.266,17.480,-50.478]}},{"noteOn":{"time":57.475,"note":94.000,"xyz":[-83.714,17.402,11.601]}},{"noteOn":{"time":57.515,"note":101.000,"xyz":[-40.754,17.953,58.086]}},{"noteOn":{"time":57.555,"note":107.000,"xyz":[86.471,18.425,48.711]}},{"noteOn":{"time":57.635,"note":97.000,"xyz":[40.644,17.638,-15.718]}},{"noteOn":{"time":57.675,"note":95.000,"xyz":[-21.952,17.480,-39.169]}},{"noteOn":{"time":58.065,"note":97.000,"xyz":[85.645,17.638,-5.135]}},{"noteOn":{"time":58.105,"note":99.000,"xyz":[-59.483,17.795,-3.642]}},{"noteOn":{"time":58.145,"note":103.000,"xyz":[63.004,18.110,54.651]}},{"noteOn":{"time":58.185,"note":102.000,"xyz":[40.471,18.031,-30.409]}},{"noteOn":{"time":58.375,"note":89.000,"xyz":[-12.025,17.008,-9.454]}},{"noteOn":{"time":58.435,"note":105.000,"xyz":[15.427,18.268,4.742]}},{"noteOn":{"time":58.475,"note":97.000,"xyz":[70.362,17.638,-30.260]}},{"noteOn":{"time":58.615,"note":95.000,"xyz":[34.283,17.480,-14.698]}},{"noteOn":{"time":58.735,"note":102.000,"xyz":[-28.838,18.031,-35.720]}},{"noteOn":{"time":58.870,"note":97.000,"xyz":[-71.738,17.638,45.922]}},{"noteOn":{"time":59.015,"note":93.000,"xyz":[-6.297,17.323,11.393]}},{"noteOn":{"time":59.055,"note":102.000,"xyz":[-49.073,18.031,52.571]}},{"noteOn":{"time":59.095,"note":103.000,"xyz":[-16.587,18.110,-34.216]}},{"noteOn":{"time":59.295,"note":91.000,"xyz":[-70.158,17.165,-66.715]}},{"noteOn":{"time":59.405,"note":99.000,"xyz":[-82.188,17.795,-22.360]}},{"noteOn":{"time":59.455,"note":95.000,"xyz":[-80.646,17.480,25.797]}},{"noteOn":{"time":59.570,"note":92.000,"xyz":[23.169,17.244,14.693]}},{"noteOn":{"time":59.610,"note":99.000,"xyz":[18.050,17.795,-5.198]}},{"noteOn":{"time":59.650,"note":95.000,"xyz":[4.436,17.480,40.527]}},{"noteOn":{"time":59.855,"note":94.000,"xyz":[21.991,17.402,-29.853]}},{"noteOn":{"time":59.930,"note":101.000,"xyz":[8.340,17.953,-11.791]}},{"noteOn":{"time":59.970,"note":97.000,"xyz":[3.245,17.638,25.433]}},{"noteOn":{"time":60.040,"note":94.000,"xyz":[-73.629,17.402,-50.379]}},{"noteOn":{"time":60.115,"note":97.000,"xyz":[38.782,17.638,8.353]}},{"noteOn":{"time":60.235,"note":94.000,"xyz":[-64.368,17.402,-22.964]}},{"noteOn":{"time":60.275,"note":101.000,"xyz":[76.436,17.953,-39.830]}},{"noteOn":{"time":60.505,"note":101.000,"xyz":[66.281,17.953,65.283]}},{"noteOn":{"time":60.545,"note":99.000,"xyz":[19.450,17.795,-71.235]}},{"noteOn":{"time":60.635,"note":89.000,"xyz":[-11.055,17.008,22.134]}},{"noteOn":{"time":60.675,"note":96.000,"xyz":[-67.198,17.559,27.788]}},{"noteOn":{"time":60.715,"note":104.000,"xyz":[1.526,18.189,16.996]}},{"noteOn":{"time":60.755,"note":95.000,"xyz":[-8.899,17.480,-11.892]}},{"noteOn":{"time":61.065,"note":97.000,"xyz":[66.389,17.638,15.443]}},{"noteOn":{"time":61.105,"note":96.000,"xyz":[-60.042,17.559,22.755]}},{"noteOn":{"time":61.145,"note":99.000,"xyz":[-7.826,17.795,36.721]}},{"noteOn":{"time":61.330,"note":96.000,"xyz":[29.487,17.559,27.724]}},{"noteOn":{"time":61.370,"note":89.000,"xyz":[41.481,17.008,-15.184]}},{"noteOn":{"time":61.410,"note":102.000,"xyz":[53.552,18.031,44.692]}},{"noteOn":{"time":61.450,"note":105.000,"xyz":[2.278,18.268,-47.425]}},{"noteOn":{"time":61.490,"note":98.000,"xyz":[7.935,17.717,75.086]}},{"noteOn":{"time":61.730,"note":94.000,"xyz":[54.051,17.402,-30.302]}},{"noteOn":{"time":61.875,"note":96.000,"xyz":[-8.664,17.559,-9.986]}},{"noteOn":{"time":61.935,"note":101.000,"xyz":[-72.995,17.953,-29.737]}},{"noteOn":{"time":61.975,"note":100.000,"xyz":[-48.411,17.874,-31.845]}},{"noteOn":{"time":62.025,"note":94.000,"xyz":[49.617,17.402,77.257]}},{"noteOn":{"time":62.065,"note":93.000,"xyz":[-3.735,17.323,-11.743]}},{"noteOn":{"time":62.175,"note":106.000,"xyz":[-16.503,18.346,65.399]}},{"noteOn":{"time":62.215,"note":96.000,"xyz":[-35.669,17.559,12.447]}},{"noteOn":{"time":62.500,"note":104.000,"xyz":[-76.119,18.189,-30.015]}},{"noteOn":{"time":62.560,"note":98.000,"xyz":[-43.193,17.717,-36.586]}},{"noteOn":{"time":62.600,"note":100.000,"xyz":[-42.775,17.874,30.932]}},{"noteOn":{"time":62.695,"note":103.000,"xyz":[18.482,18.110,-7.459]}},{"noteOn":{"time":62.905,"note":90.000,"xyz":[41.970,17.087,-90.027]}},{"noteOn":{"time":62.945,"note":104.000,"xyz":[8.007,18.189,16.096]}},{"noteOn":{"time":62.985,"note":98.000,"xyz":[-8.831,17.717,-6.427]}},{"noteOn":{"time":63.155,"note":94.000,"xyz":[3.202,17.402,-11.406]}},{"noteOn":{"time":63.230,"note":102.000,"xyz":[43.998,18.031,-4.251]}},{"noteOn":{"time":63.305,"note":94.000,"xyz":[-4.888,17.402,-33.614]}},{"noteOn":{"time":63.420,"note":96.000,"xyz":[20.059,17.559,-38.277]}},{"noteOn":{"time":63.645,"note":101.000,"xyz":[-52.411,17.953,5.441]}},{"noteOn":{"time":63.685,"note":102.000,"xyz":[-3.535,18.031,91.247]}},{"noteOn":{"time":63.745,"note":100.000,"xyz":[-71.337,17.874,19.394]}},{"noteOn":{"time":63.785,"note":92.000,"xyz":[-11.489,17.244,2.974]}},{"noteOn":{"time":63.845,"note":96.000,"xyz":[83.430,17.559,-29.586]}},{"noteOn":{"time":63.920,"note":96.000,"xyz":[-37.637,17.559,-9.357]}},{"noteOn":{"time":64.080,"note":92.000,"xyz":[47.509,17.244,37.126]}},{"noteOn":{"time":64.270,"note":100.000,"xyz":[-50.012,17.874,24.583]}},{"noteOn":{"time":64.375,"note":100.000,"xyz":[-70.875,17.874,0.339]}},{"noteOn":{"time":64.415,"note":94.000,"xyz":[-23.375,17.402,43.330]}},{"noteOn":{"time":64.495,"note":96.000,"xyz":[-72.493,17.559,67.197]}},{"noteOn":{"time":64.535,"note":98.000,"xyz":[-6.585,17.717,3.240]}},{"noteOn":{"time":64.610,"note":95.000,"xyz":[40.961,17.480,10.238]}},{"noteOn":{"time":64.650,"note":100.000,"xyz":[2.360,17.874,-5.970]}},{"noteOn":{"time":64.730,"note":95.000,"xyz":[-79.930,17.480,26.874]}},{"noteOn":{"time":64.815,"note":102.000,"xyz":[-46.483,18.031,34.969]}},{"noteOn":{"time":64.950,"note":98.000,"xyz":[-20.143,17.717,3.582]}},{"noteOn":{"time":65.100,"note":88.000,"xyz":[-48.326,16.929,-14.116]}},{"noteOn":{"time":65.140,"note":98.000,"xyz":[-43.417,17.717,-25.115]}},{"noteOn":{"time":65.180,"note":104.000,"xyz":[21.793,18.189,13.112]}},{"noteOn":{"time":65.235,"note":97.000,"xyz":[50.282,17.638,-19.137]}},{"noteOn":{"time":65.305,"note":94.000,"xyz":[-36.347,17.402,-87.879]}},{"noteOn":{"time":65.510,"note":96.000,"xyz":[-60.371,17.559,-75.686]}},{"noteOn":{"time":65.585,"note":95.000,"xyz":[-78.504,17.480,-21.285]}},{"noteOn":{"time":65.790,"note":101.000,"xyz":[10.313,17.953,27.124]}},{"noteOn":{"time":65.875,"note":102.000,"xyz":[9.860,18.031,33.776]}},{"noteOn":{"time":65.915,"note":90.000,"xyz":[-36.825,17.087,-10.517]}},{"noteOn":{"time":65.955,"note":98.000,"xyz":[12.975,17.717,25.536]}},{"noteOn":{"time":65.995,"note":106.000,"xyz":[30.289,18.346,-92.314]}},{"noteOn":{"time":66.035,"note":95.000,"xyz":[22.179,17.480,-7.237]}},{"noteOn":{"time":66.230,"note":93.000,"xyz":[-68.059,17.323,40.927]}},{"noteOn":{"time":66.350,"note":94.000,"xyz":[10.190,17.402,-9.967]}},{"noteOn":{"time":66.390,"note":97.000,"xyz":[31.658,17.638,92.299]}},{"noteOn":{"time":66.430,"note":104.000,"xyz":[-93.333,18.189,31.731]}},{"noteOn":{"time":66.470,"note":101.000,"xyz":[-7.821,17.953,-48.633]}},{"noteOn":{"time":66.650,"note":93.000,"xyz":[-81.049,17.323,-50.769]}},{"noteOn":{"time":66.835,"note":96.000,"xyz":[58.036,17.559,-26.437]}},{"noteOn":{"time":66.890,"note":106.000,"xyz":[70.660,18.346,58.215]}},{"noteOn":{"time":67.090,"note":101.000,"xyz":[-52.225,17.953,53.365]}},{"noteOn":{"time":67.130,"note":99.000,"xyz":[-16.479,17.795,73.202]}},{"noteOn":{"time":67.170,"note":94.000,"xyz":[-6.496,17.402,4.341]}},{"noteOn":{"time":67.265,"note":102.000,"xyz":[12.517,18.031,-51.388]}},{"noteOn":{"time":67.335,"note":103.000,"xyz":[-1.097,18.110,-41.486]}},{"noteOn":{"time":67.375,"note":91.000,"xyz":[37.145,17.165,82.266]}},{"noteOn":{"time":67.490,"note":99.000,"xyz":[38.091,17.795,-12.832]}},{"noteOn":{"time":67.660,"note":97.000,"xyz":[-47.255,17.638,2.889]}},{"noteOn":{"time":67.700,"note":93.000,"xyz":[-53.679,17.323,-29.942]}},{"noteOn":{"time":67.740,"note":101.000,"xyz":[5.030,17.953,94.090]}},{"noteOn":{"time":68.010,"note":95.000,"xyz":[-4.174,17.480,65.711]}},{"noteOn":{"time":68.150,"note":101.000,"xyz":[2.745,17.953,60.861]}},{"noteOn":{"time":68.190,"note":93.000,"xyz":[-33.971,17.323,78.214]}},{"noteOn":{"time":68.230,"note":101.000,"xyz":[-24.252,17.953,-29.981]}},{"noteOn":{"time":68.270,"note":100.000,"xyz":[-51.395,17.874,-12.374]}},{"noteOn":{"time":68.350,"note":99.000,"xyz":[18.159,17.795,6.105]}},{"noteOn":{"time":68.390,"note":97.000,"xyz":[30.804,17.638,-51.344]}},{"noteOn":{"time":68.590,"note":93.000,"xyz":[-7.315,17.323,13.170]}},{"noteOn":{"time":68.630,"note":107.000,"xyz":[-29.883,18.425,-84.363]}},{"noteOn":{"time":68.675,"note":109.000,"xyz":[10.951,18.583,-1.281]}},{"noteOn":{"time":68.835,"note":111.000,"xyz":[15.741,18.740,-30.733]}},{"noteOn":{"time":68.875,"note":112.000,"xyz":[-14.613,18.819,-78.618]}},{"noteOn":{"time":68.915,"note":112.000,"xyz":[-53.608,18.819,-66.810]}},{"noteOn":{"time":68.955,"note":93.000,"xyz":[33.823,17.323,-91.735]}},{"noteOn":{"time":68.995,"note":97.000,"xyz":[-79.195,17.638,43.398]}}]}
        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
