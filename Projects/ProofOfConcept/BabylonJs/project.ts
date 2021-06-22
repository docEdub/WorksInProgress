import * as BABYLON from "babylonjs";
import * as CSOUND from "./@doc.e.dub/csound-browser";

declare global {
    interface Document {
        audioContext: AudioContext
        Csound: CSOUND.Csound
    }
}

var ConsoleLogHTML = require('console-log-html')
ConsoleLogHTML.connect(document.getElementById('ConsoleOutput'), {}, false, false, false)

class Playground { public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {

    document.audioContext = BABYLON.Engine.audioEngine.audioContext
    BABYLON.Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => { onAudioEngineUnlocked() })
    BABYLON.Engine.audioEngine.lock()
    
    const originalConsoleDebug = console.debug
    console.debug = (message) => {
        // originalConsoleDebug(message)
    }

    const originalConsoleLog = console.log
    console.log = function() {
        if (arguments[0] === 'csd:started') {
            isCsoundStarted = true
            return
        }
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

    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // For options docs see https://doc.babylonjs.com/typedoc/interfaces/babylon.ienvironmenthelperoptions.
    const environmentSettings = scene.createDefaultEnvironment({
        groundColor: BABYLON.Color3.BlackReadOnly,
        groundOpacity: 0,
        groundSize: 999,
        skyboxColor: BABYLON.Color3.BlackReadOnly,
        skyboxSize: 999
    });

    // XR
    const xrHelper = scene.createDefaultXRExperienceAsync({});

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
            mesh.position = new BABYLON.Vector3(
                -10 + (20 * i / 500), //noteOn.rtz[0] * Math.sin(noteOn.rtz[1]),
                100 * (noteOn.rtz[2] / 127) - 20, //0, //noteOn.rtz[2], // Put them on the ground for now. TODO: Update Csound note positions to 0, too?
                20, //noteOn.rtz[0] * Math.cos(noteOn.rtz[1])
            )
            noteOn.mesh = mesh
            noteOn.offTime = noteOn.time + 0.1
        }

        // Incremented as elapsed time passes.
        let nextPointSynthNoteOnIndex = 1
        let nextPointSynthNoteOffIndex = 1

        // Naive latency calculation.
        //const latency = 0.285759637188209 //  = 8192 / 44100 + 0.1  = iobufsamps / sr + latencyHint
        let clockStarted = false
        let clock = 0

        engine.runRenderLoop(() => {
            if (!isCsoundStarted) {
                return
            }

            if (!clockStarted) {
                const latency = 8192 / 44100
                clock -= latency
                clockStarted = true
                return
            }
            clock += engine.getDeltaTime() / 1000

            while (nextPointSynthNoteOnIndex < pointSynthData.length
                    && pointSynthData[nextPointSynthNoteOnIndex].noteOn.time <= clock) {
                pointSynthData[nextPointSynthNoteOnIndex].noteOn.mesh.isVisible = true
                nextPointSynthNoteOnIndex++
            }

            while (nextPointSynthNoteOffIndex < pointSynthData.length
                    && pointSynthData[nextPointSynthNoteOffIndex].noteOn.offTime <= clock) {
                pointSynthData[nextPointSynthNoteOffIndex].noteOn.mesh.isVisible = false
                nextPointSynthNoteOffIndex++
            }
        })
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
        console.log('Audio engine unlocked')
        startCsound()
    }
    
    const onCsoundLoaded = () => {
        isCsoundLoaded = true
        startCsound()
    }

    const startCsound = async () => {
        if (!isAudioEngineUnlocked) return
        if (!isCsoundLoaded) return
        console.debug('Csound initializing ...')
        const csound = await document.Csound({
            audioContext: new AudioContext({
                latencyHint: 0.17066666667,
                sampleRate: 48000
            }),
            useSAB: false
        })
        if (!csound) {
            console.error('Csound failed to initialize')
            return
        }
        const audioContext = await csound.getAudioContext()

        // const audioContext = document.audioContext
        // const audioContext = new AudioContext({
        //     sampleRate: 48000,
        //     latencyHint: 0.17066666667
        // })
        console.log('audioContext =', audioContext)
        console.log('audioContext.audioWorklet =', audioContext.audioWorklet)
        console.log('audioContext.baseLatency =', audioContext.baseLatency)
        console.log('audioContext.outputLatency =', audioContext.outputLatency)
        console.log('audioContext.sampleRate =', audioContext.sampleRate)
        console.log('audioContext.state =', audioContext.state)

        document.audioContext = audioContext
        console.debug('Csound initialized successfully');
        await csound.setOption('--iobufsamps=16384')
        console.debug('Csound csd compiling ...')
        let csoundErrorCode = await csound.compileCsdText(csdText)
        if (csoundErrorCode != 0) {
            console.error('Csound csd compile failed')
            return
        }
        console.debug('Csound csd compile succeeded')

        const csoundStartDelay = 4 // seconds
        let currentStartDelay = 0
        const csoundLoadTimer = setInterval(() => {
            currentStartDelay += 1
            console.log('Csound starting in', csoundStartDelay - currentStartDelay)
            if (currentStartDelay >= csoundStartDelay) {
                console.debug('Csound starting ...')
                csound.start()
                clearInterval(csoundLoadTimer)
            }
        }, 1000)
    }
    // startCsound()

    const csdText = `
        <CsoundSynthesizer>
        <CsOptions>
        --midi-device=0
        --nodisplays
        --nosound
        </CsOptions>
        <CsInstruments>
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
            event_i("i", 2, 0, -1)
            event_i("i", 6, 1, -1)
            event_i("i", 10, 1, -1)
            turnoff
        endin
        instr 2
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
                    SFileName = sprintf("%s.%d.json", SPluginUuid, iI)
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
        opcode AF_3D_Audio_DistanceAttenuation, k, kkk
            k_distance, k_minDistance, k_maxDistance xin
            k_linearFadeOutDistance = k_maxDistance - 1
            if (k_linearFadeOutDistance < k_distance) then
                k_fadeOutDistance = k_distance - k_linearFadeOutDistance
                if (k_fadeOutDistance < 1) then
                    k_linearFadeFrom = 1 / k_maxDistance
                    k_gain = k_linearFadeFrom * (1 - k_fadeOutDistance)
                else
                    k_gain = 0
                endif
            else
                k_gain = 1 / (max(k_minDistance, k_distance) + 1)
            endif
            xout k_gain
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
        opcode AF_3D_Audio_SourceDistance, k, i[]
            i_sourcePosition[] xin
            k_direction[] = fillarray(i_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
                i_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
                i_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
            xout sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y] + k_direction[$Z] * k_direction[$Z])
        endop
        opcode AF_3D_Audio_SourceDistance, k, k[]
            k_sourcePosition[] xin
            k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
                k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
                k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
            xout sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y] + k_direction[$Z] * k_direction[$Z])
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
            kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giCircleSynth_DistanceMin),
                k(giCircleSynth_DistanceMax))
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
                SJsonFile = sprintf("%s.0.json", "baeea327-af4b-4b10-a843-6614c20ea958")
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
        instr 3
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
                        SJsonFile = sprintf("%s.%d.json", "baeea327-af4b-4b10-a843-6614c20ea958", giCircleSynth_NoteIndex[0])
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
                    aDummy subinstr giCircleSynthNoteInstrumentNumber,
                        iNoteNumber,
                        iVelocity,
                        0,
                        0
            endif
        endin:
        endin
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
            kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giPowerLineSynth_DistanceMin), k(giPowerLineSynth_DistanceMax))
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
                SJsonFile = sprintf("%s.0.json", "069e83fd-1c94-47e9-95ec-126e0fbefec3")
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
                        if (giPowerLineSynth_NoteIndex[0] == 0) then
                            scoreline_i("i \\"PowerLineSynth_Json\\" 0 0")
                        endif
                        giPowerLineSynth_NoteIndex[0] = giPowerLineSynth_NoteIndex[0] + 1
                        SJsonFile = sprintf("%s.%d.json", "069e83fd-1c94-47e9-95ec-126e0fbefec3", giPowerLineSynth_NoteIndex[0])
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
                    aDummy subinstr giPowerLineSynthNoteInstrumentNumber,
                        iNoteNumber,
                        iVelocity,
                        0,
                        1
            endif
        endin:
        endin
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
        opcode math_fastSquare, k, k
            kI xin
            xout tablei(kI, giFastSquareTable)
        endop
        giFastSqrtMaxI init 10001
        giFastSqrtTable ftgen 0, 0, giFastSqrtMaxI, 2, 0
        instr math_InitFastSqrtTable
            iI = 0
            while (iI < giFastSqrtMaxI) do
                tablew(sqrt(iI), iI, giFastSqrtTable)
                iI += 1
            od
            turnoff
        endin
        scoreline_i("i \\"math_InitFastSqrtTable\\" 0 -1")
        opcode math_fastSqrt, k, k
            kI xin
            xout tablei(kI, giFastSqrtTable)
        endop
        giPointSynth_DistanceMin = 5
        giPointSynth_DistanceMax = 100
        giPointSynth_DistanceMinAttenuation = AF_3D_Audio_DistanceAttenuation_i(0, giPointSynth_DistanceMin, giPointSynth_DistanceMax)
         #define POINT_SYNTH_NEXT_RTZ_COUNT #16384#
        giPointSynthNextRT[][][] init 1, $POINT_SYNTH_NEXT_RTZ_COUNT, 2
        giPointSynthNextRTZ_i init 0
        iI = 0
        while (iI < 1) do
            seed(1 + iI * 1000)
            iJ = 0
            while (iJ < $POINT_SYNTH_NEXT_RTZ_COUNT) do
                giPointSynthNextRT[iI][iJ][$R] = giPointSynth_DistanceMin + rnd(giPointSynth_DistanceMax - giPointSynth_DistanceMin)
                giPointSynthNextRT[iI][iJ][$T] = rnd(359.999)
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
                SJsonFile = sprintf("%s.0.json", "b4f7a35c-6198-422f-be6e-fa126f31b007")
                fprints(SJsonFile, "{")
                fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
                fprints(SJsonFile, ",\\"soundDistanceMin\\":%d", giPointSynth_DistanceMin)
                fprints(SJsonFile, ",\\"soundDistanceMax\\":%d", giPointSynth_DistanceMax)
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
                    iR init giPointSynthNextRT[0][giPointSynthNextRTZ_i][$R]
                    iT init giPointSynthNextRT[0][giPointSynthNextRTZ_i][$T]
                    iZ init 10 + 10 * (iNoteNumber / 127)
                    kR init iR
                    kT init iT
                    kZ init iZ
                    kDistanceAmp = AF_3D_Audio_DistanceAttenuation(math_fastSqrt(math_fastSquare(kR) + math_fastSquare(kZ)),
                        giPointSynth_DistanceMin, giPointSynth_DistanceMax)
                    aOutDistanced = aOut * kDistanceAmp
                    giPointSynthNextRTZ_i += 1
                    if (giPointSynthNextRTZ_i == $POINT_SYNTH_NEXT_RTZ_COUNT) then
                        giPointSynthNextRTZ_i = 0
                    endif
                    AF_3D_Audio_ChannelGains_RTZ(kR, kT, kZ)
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
                        SJsonFile = sprintf("%s.%d.json", "b4f7a35c-6198-422f-be6e-fa126f31b007", giPointSynth_NoteIndex[0])
                        fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f,\\"note\\":%.3f,\\"rtz\\":[%.3f,%.3f,%.3f]}}", times(),
                            iNoteNumber, iR, iT, iZ)
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
            outch(1, ga_masterSignals[4])
            outch(2, ga_masterSignals[5])
        endin
        </CsInstruments>
        <CsScore>
        i 1 0 -1 3 0 1 3
        i 8.1 0 -1 1
        i 7 0.004 1 3 0 0 0.46
        i 7 0.004 1 3 0 1 0.46
        i 7 0.004 1 3 0 2 0.46
        i 7 0.004 1 3 0 3 0.46
        i 7 0.004 1 3 0 4 0.48
        i 7 0.004 1 3 0 5 0.48
        i 7 0.004 1 3 1 0 0.46
        i 7 0.004 1 3 1 1 0.46
        i 7 0.004 1 3 1 2 0.46
        i 7 0.004 1 3 1 3 0.46
        i 7 0.004 1 3 1 4 1.00
        i 7 0.004 1 3 1 5 1.00
        i 7 0.004 1 3 2 0 0.04
        i 7 0.004 1 3 2 1 0.04
        i 7 0.004 1 3 2 2 0.04
        i 7 0.004 1 3 2 3 0.04
        i 7 0.004 1 3 2 4 1.00
        i 7 0.004 1 3 2 5 1.00
        i 9 0.004 1 3 0 1.00
        i 9 0.004 1 3 1 1.00
        i 9 0.004 1 3 2 1.00
        i 9 0.004 1 3 3 1.00
        i 9 0.004 1 3 4 1.00
        i 9 0.004 1 3 5 1.00
        i 7 3.293 1 3 1 0 0.00
        i 7 3.293 1 3 1 1 0.00
        i 7 3.293 1 3 1 2 0.00
        i 7 3.293 1 3 1 3 0.00
        i 7 3.293 1 3 1 4 0.00
        i 7 3.293 1 3 1 5 0.00
        i 4.001 0 0.1 3 48 63
        i 4.002 0 0.1 3 48 63
        i 3.001 0 0.1 3 63 63
        i 3.002 0 0.1 3 63 63
        i 3.003 0 0.1 3 63 63
        i 3.004 0 0.1 3 63 63
        i 5.001 0 0.1 1 1063 63
        i 8 0.01 1 4 0 1.00
        i 8 0.01 1 4 1 0.98
        i 8 0.01 1 4 5 1.00
        b 2
        i 4.001 2.001 -1 3 48 96
        i 3.001 2.001 -1 3 24 45
        i 3.002 2.001 -1 3 36 63
        i 5.007 2.853 0.020 1 1098 76
        i 5.008 3.825 0.020 1 1095 79
        i 5.009 4.621 0.020 1 1103 52
        i 5.010 5.243 0.020 1 1103 78
        i 5.011 5.799 0.020 1 1095 71
        i 5.012 6.531 0.020 1 1097 58
        i 5.013 7.439 0.020 1 1097 78
        i 5.014 8.356 0.020 1 1095 72
        i 5.015 9.097 0.020 1 1103 52
        i 5.016 9.664 0.020 1 1102 79
        i 3.003 10.001 -1 3 31 45
        i 3.004 10.001 -1 3 43 63
        i -3.001 10.001 0
        i -3.002 10.001 0
        i 5.017 10.237 0.020 1 1096 74
        i 5.018 10.277 0.020 1 1096 77
        i 5.019 10.852 0.020 1 1094 69
        i 5.020 11.061 0.020 1 1098 74
        i 5.021 11.380 0.020 1 1102 57
        i 5.022 12.024 0.020 1 1096 76
        i 5.023 12.321 0.020 1 1101 58
        i 5.024 12.887 0.020 1 1094 55
        i 5.025 13.176 0.020 1 1095 82
        i 5.026 13.573 0.020 1 1104 76
        i 5.027 13.911 0.020 1 1097 60
        i 5.028 14.085 0.020 1 1102 59
        i 5.029 14.732 0.020 1 1095 62
        i 5.030 14.772 0.020 1 1096 73
        i 5.031 15.325 0.020 1 1093 64
        i 5.032 15.592 0.020 1 1099 61
        i 5.033 15.832 0.020 1 1103 75
        i 5.034 15.969 0.020 1 1099 76
        i 5.035 16.576 0.020 1 1095 69
        i 5.036 16.641 0.020 1 1097 56
        i 5.037 16.752 0.020 1 1101 61
        i 5.038 17.207 0.020 1 1103 79
        i 5.039 17.384 0.020 1 1093 72
        i 5.040 17.585 0.020 1 1096 74
        i 5.041 17.908 0.020 1 1105 65
        i 3.005 18.001 -1 3 29 45
        i 3.006 18.001 -1 3 41 63
        i -3.003 18.001 0
        i -3.004 18.001 0
        i 5.042 18.016 0.020 1 1103 69
        i 5.043 18.341 0.020 1 1098 78
        i 5.044 18.444 0.020 1 1095 59
        i 5.045 18.560 0.020 1 1101 75
        i 5.046 19.175 0.020 1 1097 55
        i 5.047 19.215 0.020 1 1094 79
        i 5.048 19.280 0.020 1 1097 83
        i 5.049 19.681 0.020 1 1099 60
        i 5.050 19.756 0.020 1 1092 81
        i 5.051 20.176 0.020 1 1099 57
        i 5.052 20.272 0.020 1 1102 53
        i 5.053 20.441 0.020 1 1097 79
        i 5.054 20.965 0.020 1 1104 60
        i 5.055 21.105 0.020 1 1094 59
        i 5.056 21.171 0.020 1 1100 75
        i 5.057 21.755 0.020 1 1104 64
        i 5.058 21.859 0.020 1 1092 74
        i 5.059 21.981 0.020 1 1096 56
        i 5.060 22.308 0.020 1 1096 79
        i 5.061 22.436 0.020 1 1102 78
        i 5.062 22.759 0.020 1 1098 67
        i 5.063 23.005 0.020 1 1094 73
        i 5.064 23.045 0.020 1 1100 56
        i 5.065 23.127 0.020 1 1098 69
        i 5.066 23.623 0.020 1 1093 58
        i 5.067 23.709 0.020 1 1098 72
        i 5.068 23.749 0.020 1 1092 59
        i 5.069 23.809 0.020 1 1098 67
        i 5.070 24.173 0.020 1 1091 68
        i 5.071 24.509 0.020 1 1102 62
        i 5.072 24.556 0.020 1 1096 60
        i 5.073 24.711 0.020 1 1101 64
        i 5.074 24.760 0.020 1 1100 68
        i 5.075 25.168 0.020 1 1104 66
        i 5.076 25.249 0.020 1 1100 69
        i 5.077 25.587 0.020 1 1099 61
        i 5.078 25.635 0.020 1 1094 82
        i 3.007 26.001 -1 3 33 45
        i 3.008 26.001 -1 3 45 63
        i -3.005 26.001 0
        i -3.006 26.001 0
        i 5.079 26.013 0.020 1 1095 61
        i 5.080 26.053 0.020 1 1103 75
        i 5.081 26.333 0.020 1 1092 80
        i 5.082 26.376 0.020 1 1097 84
        i 5.083 26.685 0.020 1 1097 57
        i 5.084 26.749 0.020 1 1097 62
        i 5.085 26.856 0.020 1 1101 56
        i 5.086 27.175 0.020 1 1099 65
        i 5.087 27.509 0.020 1 1099 68
        i 5.088 27.549 0.020 1 1093 79
        i 5.089 27.591 0.020 1 1099 54
        i 5.090 28.060 0.020 1 1093 65
        i 5.091 28.248 0.020 1 1091 56
        i 5.092 28.288 0.020 1 1097 79
        i 5.093 28.339 0.020 1 1099 55
        i 5.094 28.589 0.020 1 1092 72
        i 5.095 29.019 0.020 1 1101 66
        i 5.096 29.059 0.020 1 1101 78
        i 5.097 29.148 0.020 1 1100 59
        i 5.098 29.196 0.020 1 1095 75
        i 5.099 29.335 0.020 1 1101 75
        i 5.100 29.728 0.020 1 1099 67
        i 5.101 29.768 0.020 1 1099 75
        i 5.102 29.896 0.020 1 1105 74
        i 5.103 30.003 0.020 1 1098 76
        i 5.104 30.155 0.020 1 1093 52
        i 5.105 30.521 0.020 1 1095 71
        i 5.106 30.561 0.020 1 1103 75
        i 5.107 30.771 0.020 1 1098 54
        i 5.108 30.811 0.020 1 1093 52
        i 5.109 30.860 0.020 1 1103 56
        i 5.110 31.245 0.020 1 1098 81
        i 5.111 31.332 0.020 1 1101 57
        i 5.112 31.541 0.020 1 1105 54
        i 5.113 31.589 0.020 1 1097 81
        i 5.114 31.629 0.020 1 1100 78
        i 5.115 32.024 0.020 1 1092 82
        i 5.116 32.064 0.020 1 1098 82
        i 5.117 32.416 0.020 1 1095 82
        i 5.118 32.497 0.020 1 1092 75
        i 5.119 32.583 0.020 1 1100 80
        i 5.120 32.744 0.020 1 1090 75
        i 5.121 32.924 0.020 1 1100 82
        i 5.122 33.005 0.020 1 1092 80
        i 5.123 33.144 0.020 1 1097 55
        i 5.124 33.341 0.020 1 1096 83
        i 5.125 33.527 0.020 1 1100 62
        i 5.126 33.587 0.020 1 1100 55
        i 5.127 33.725 0.020 1 1101 76
        i 5.128 33.865 0.020 1 1102 61
        i 3.009 34.001 -1 3 31 45
        i 3.010 34.001 -1 3 43 63
        i -3.007 34.001 0
        i -3.008 34.001 0
        i 5.129 34.243 0.020 1 1098 59
        i 5.130 34.292 0.020 1 1098 57
        i 5.131 34.332 0.020 1 1094 75
        i 5.132 34.420 0.020 1 1097 58
        i 5.133 34.631 0.020 1 1092 81
        i 5.134 35.004 0.020 1 1104 71
        i 5.135 35.044 0.020 1 1096 71
        i 5.136 35.108 0.020 1 1104 64
        i 5.137 35.167 0.020 1 1099 60
        i 5.138 35.220 0.020 1 1094 80
        i 5.139 35.309 0.020 1 1092 68
        i 5.140 35.741 0.020 1 1098 73
        i 5.141 35.808 0.020 1 1100 74
        i 5.142 35.863 0.020 1 1106 83
        i 5.143 36.008 0.020 1 1101 55
        i 5.144 36.057 0.020 1 1102 67
        i 5.145 36.209 0.020 1 1090 77
        i 5.146 36.532 0.020 1 1092 79
        i 5.147 36.572 0.020 1 1098 74
        i 5.148 36.720 0.020 1 1100 63
        i 5.149 36.859 0.020 1 1096 83
        i 5.150 36.899 0.020 1 1098 79
        i 5.151 36.939 0.020 1 1091 63
        i 5.152 37.240 0.020 1 1091 64
        i 5.153 37.301 0.020 1 1098 77
        i 5.154 37.451 0.020 1 1093 54
        i 5.155 37.511 0.020 1 1100 56
        i 5.156 37.708 0.020 1 1098 66
        i 5.157 37.795 0.020 1 1100 57
        i 5.158 38.035 0.020 1 1099 59
        i 5.159 38.075 0.020 1 1099 74
        i 5.160 38.131 0.020 1 1094 68
        i 5.161 38.397 0.020 1 1103 78
        i 5.162 38.437 0.020 1 1100 70
        i 5.163 38.641 0.020 1 1095 56
        i 5.164 38.740 0.020 1 1097 78
        i 5.165 38.865 0.020 1 1097 74
        i 5.166 38.905 0.020 1 1097 60
        i 5.167 38.967 0.020 1 1098 68
        i 5.168 39.108 0.020 1 1093 56
        i 5.169 39.532 0.020 1 1093 80
        i 5.170 39.572 0.020 1 1097 52
        i 5.171 39.612 0.020 1 1105 58
        i 5.172 39.652 0.020 1 1100 73
        i 5.173 39.692 0.020 1 1095 68
        i 5.174 39.732 0.020 1 1091 60
        i 5.175 40.240 0.020 1 1099 73
        i 5.176 40.285 0.020 1 1099 74
        i 5.177 40.325 0.020 1 1105 60
        i 5.178 40.408 0.020 1 1103 56
        i 5.179 40.453 0.020 1 1102 75
        i 5.180 40.668 0.020 1 1089 76
        i 5.181 41.043 0.020 1 1091 72
        i 5.182 41.104 0.020 1 1097 55
        i 5.183 41.180 0.020 1 1097 76
        i 5.184 41.220 0.020 1 1099 53
        i 5.185 41.269 0.020 1 1101 77
        i 5.186 41.403 0.020 1 1092 77
        i 5.187 41.443 0.020 1 1103 75
        i 5.188 41.740 0.020 1 1091 69
        i 5.189 41.831 0.020 1 1097 53
        i 5.190 41.940 0.020 1 1094 84
        i 5.191 42.097 0.020 1 1101 52
        i 5.192 42.151 0.020 1 1099 81
        i 5.193 42.191 0.020 1 1099 81
        i 5.194 42.381 0.020 1 1101 74
        i 5.195 42.547 0.020 1 1098 72
        i 5.196 42.587 0.020 1 1098 77
        i 5.197 42.627 0.020 1 1095 63
        i 5.198 42.929 0.020 1 1103 54
        i 5.199 42.975 0.020 1 1099 60
        i 5.200 43.015 0.020 1 1103 66
        i 5.201 43.055 0.020 1 1101 62
        i 5.202 43.240 0.020 1 1096 64
        i 5.203 43.308 0.020 1 1097 49
        i 5.204 43.355 0.020 1 1096 68
        i 5.205 43.585 0.020 1 1094 64
        i 5.206 43.644 0.020 1 1105 70
        i 5.207 43.684 0.020 1 1097 80
        i 5.208 43.941 0.020 1 1095 73
        i 5.209 44.051 0.020 1 1098 73
        i 5.210 44.091 0.020 1 1100 65
        i 5.211 44.131 0.020 1 1096 53
        i 5.212 44.183 0.020 1 1105 80
        i 5.213 44.223 0.020 1 1091 49
        i 5.214 44.428 0.020 1 1095 67
        i 5.215 44.740 0.020 1 1100 56
        i 5.216 44.780 0.020 1 1093 81
        i 5.217 44.820 0.020 1 1105 71
        i 5.218 44.860 0.020 1 1098 58
        i 5.219 44.943 0.020 1 1102 62
        i 5.220 45.155 0.020 1 1098 49
        i 5.221 45.196 0.020 1 1090 65
        i 5.222 45.555 0.020 1 1090 67
        i 5.223 45.595 0.020 1 1098 81
        i 5.224 45.677 0.020 1 1096 74
        i 5.225 45.717 0.020 1 1102 71
        i 5.226 45.777 0.020 1 1098 67
        i 5.227 45.915 0.020 1 1093 71
        i 5.228 45.988 0.020 1 1102 55
        i 5.229 46.240 0.020 1 1092 80
        i 5.230 46.449 0.020 1 1096 71
        i 5.231 46.489 0.020 1 1095 74
        i 5.232 46.529 0.020 1 1100 73
        i 5.233 46.569 0.020 1 1100 57
        i 5.234 46.631 0.020 1 1102 84
        i 5.235 46.825 0.020 1 1090 62
        i 5.236 46.879 0.020 1 1100 61
        i 5.237 47.059 0.020 1 1098 54
        i 5.238 47.119 0.020 1 1097 63
        i 5.239 47.188 0.020 1 1096 50
        i 5.240 47.368 0.020 1 1088 62
        i 5.241 47.408 0.020 1 1104 81
        i 5.242 47.448 0.020 1 1098 77
        i 5.243 47.488 0.020 1 1104 76
        i 5.244 47.528 0.020 1 1100 58
        i 5.245 47.740 0.020 1 1096 80
        i 5.246 47.836 0.020 1 1098 75
        i 5.247 47.888 0.020 1 1095 83
        i 5.248 47.937 0.020 1 1106 65
        i -4.001 48.000 0
        i -3.009 48.000 0
        i -3.010 48.000 0
        i 5.249 48.009 0.020 1 1094 67
        i 5.250 48.091 0.020 1 1098 63
        i 5.251 48.217 0.020 1 1096 78
        i 5.252 48.257 0.020 1 1102 78
        i 5.253 48.561 0.020 1 1099 65
        i 5.254 48.601 0.020 1 1101 79
        i 5.255 48.641 0.020 1 1096 73
        i 5.256 48.780 0.020 1 1090 64
        i 5.257 48.869 0.020 1 1106 52
        i 5.258 48.909 0.020 1 1096 50
        i 5.259 48.993 0.020 1 1096 52
        i 5.260 49.197 0.020 1 1094 83
        i 5.261 49.239 0.020 1 1101 67
        i 5.262 49.337 0.020 1 1097 64
        i 5.263 49.377 0.020 1 1104 81
        i 5.264 49.476 0.020 1 1103 72
        i 5.265 49.747 0.020 1 1090 56
        i 5.266 49.787 0.020 1 1098 58
        i 5.267 49.912 0.020 1 1094 75
        i 5.268 49.952 0.020 1 1094 74
        i 5.269 50.017 0.020 1 1098 61
        i 5.270 50.064 0.020 1 1091 74
        i 5.271 50.265 0.020 1 1095 53
        i 5.272 50.372 0.020 1 1097 50
        i 5.273 50.435 0.020 1 1102 64
        i 5.274 50.475 0.020 1 1093 65
        i 5.275 50.653 0.020 1 1096 57
        i 5.276 50.737 0.020 1 1093 56
        i 5.277 50.807 0.020 1 1101 80
        i 5.278 50.861 0.020 1 1102 70
        i 5.279 51.049 0.020 1 1096 61
        i 5.280 51.089 0.020 1 1095 60
        i 5.281 51.164 0.020 1 1103 73
        i 5.282 51.204 0.020 1 1099 70
        i 5.283 51.244 0.020 1 1089 72
        i 5.284 51.547 0.020 1 1099 79
        i 5.285 51.587 0.020 1 1097 59
        i 5.286 51.716 0.020 1 1096 65
        i 5.287 51.756 0.020 1 1097 64
        i 5.288 51.796 0.020 1 1097 49
        i 5.289 51.836 0.020 1 1089 63
        i 5.290 51.879 0.020 1 1105 77
        i 5.291 51.919 0.020 1 1103 62
        i 5.292 52.236 0.020 1 1095 66
        i 5.293 52.385 0.020 1 1099 76
        i 5.294 52.433 0.020 1 1095 62
        i 5.295 52.473 0.020 1 1094 72
        i 5.296 52.513 0.020 1 1101 78
        i 5.297 52.553 0.020 1 1107 72
        i 5.298 52.635 0.020 1 1097 71
        i 5.299 52.675 0.020 1 1095 81
        i 5.300 53.064 0.020 1 1097 77
        i 5.301 53.104 0.020 1 1099 64
        i 5.302 53.144 0.020 1 1103 62
        i 5.303 53.184 0.020 1 1102 65
        i 5.304 53.375 0.020 1 1089 75
        i 5.305 53.435 0.020 1 1105 58
        i 5.306 53.475 0.020 1 1097 57
        i 5.307 53.615 0.020 1 1095 62
        i 5.308 53.735 0.020 1 1102 57
        i 5.309 53.871 0.020 1 1097 70
        i 5.310 54.013 0.020 1 1093 72
        i 5.311 54.053 0.020 1 1102 69
        i 5.312 54.093 0.020 1 1103 57
        i 5.313 54.296 0.020 1 1091 63
        i 5.314 54.405 0.020 1 1099 72
        i 5.315 54.456 0.020 1 1095 55
        i 5.316 54.572 0.020 1 1092 74
        i 5.317 54.612 0.020 1 1099 77
        i 5.318 54.652 0.020 1 1095 62
        i 5.319 54.853 0.020 1 1094 82
        i 5.320 54.929 0.020 1 1101 67
        i 5.321 54.969 0.020 1 1097 49
        i 5.322 55.040 0.020 1 1094 54
        i 5.323 55.117 0.020 1 1097 48
        i 5.324 55.233 0.020 1 1094 56
        i 5.325 55.273 0.020 1 1101 83
        i 5.326 55.503 0.020 1 1101 52
        i 5.327 55.543 0.020 1 1099 48
        i 5.328 55.636 0.020 1 1089 47
        i 5.329 55.676 0.020 1 1096 83
        i 5.330 55.716 0.020 1 1104 72
        i 5.331 55.756 0.020 1 1095 80
        i 5.332 56.065 0.020 1 1097 63
        i 5.333 56.105 0.020 1 1096 80
        i 5.334 56.145 0.020 1 1099 58
        i 5.335 56.329 0.020 1 1096 57
        i 5.336 56.369 0.020 1 1089 54
        i 5.337 56.409 0.020 1 1102 64
        i 5.338 56.449 0.020 1 1105 49
        i 5.339 56.489 0.020 1 1098 55
        i 5.340 56.732 0.020 1 1094 62
        i 5.341 56.875 0.020 1 1096 83
        i 5.342 56.933 0.020 1 1101 57
        i 5.343 56.973 0.020 1 1100 62
        i 5.344 57.025 0.020 1 1094 80
        i 5.345 57.065 0.020 1 1093 53
        i 5.346 57.176 0.020 1 1106 49
        i 5.347 57.216 0.020 1 1096 71
        i 5.348 57.501 0.020 1 1104 67
        i 5.349 57.560 0.020 1 1098 79
        i 5.350 57.600 0.020 1 1100 74
        i 5.351 57.696 0.020 1 1103 72
        i 5.352 57.904 0.020 1 1090 56
        i 5.353 57.944 0.020 1 1104 55
        i 5.354 57.984 0.020 1 1098 76
        i 5.355 58.156 0.020 1 1094 50
        i 5.356 58.231 0.020 1 1102 78
        i 5.357 58.305 0.020 1 1094 62
        i 5.358 58.421 0.020 1 1096 56
        i 5.359 58.645 0.020 1 1101 83
        i 5.360 58.685 0.020 1 1102 67
        i 5.361 58.743 0.020 1 1100 61
        i 5.362 58.783 0.020 1 1092 76
        i 5.363 58.844 0.020 1 1096 76
        i 5.364 58.920 0.020 1 1096 60
        i 5.365 59.080 0.020 1 1092 54
        i 5.366 59.269 0.020 1 1100 68
        i 5.367 59.375 0.020 1 1100 66
        i 5.368 59.415 0.020 1 1094 59
        i 5.369 59.496 0.020 1 1096 49
        i 5.370 59.536 0.020 1 1098 44
        i 5.371 59.611 0.020 1 1095 67
        i 5.372 59.651 0.020 1 1100 82
        i 5.373 59.731 0.020 1 1095 80
        i 5.374 59.816 0.020 1 1102 66
        i 5.375 59.948 0.020 1 1098 76
        i 5.376 60.101 0.020 1 1088 48
        i 5.377 60.141 0.020 1 1098 75
        i 5.378 60.181 0.020 1 1104 76
        i 5.379 60.233 0.020 1 1097 56
        i 5.380 60.303 0.020 1 1094 66
        i 5.381 60.509 0.020 1 1096 55
        i 5.382 60.584 0.020 1 1095 84
        i 5.383 60.788 0.020 1 1101 65
        i 5.384 60.873 0.020 1 1102 70
        i 5.385 60.913 0.020 1 1090 46
        i 5.386 60.953 0.020 1 1098 66
        i 5.387 60.993 0.020 1 1106 68
        i 5.388 61.033 0.020 1 1095 80
        i 5.389 61.231 0.020 1 1093 79
        i 5.390 61.349 0.020 1 1094 72
        i 5.391 61.389 0.020 1 1097 73
        i 5.392 61.429 0.020 1 1104 60
        i 5.393 61.469 0.020 1 1101 75
        i 5.394 61.648 0.020 1 1093 84
        i 5.395 61.836 0.020 1 1096 72
        i 5.396 61.892 0.020 1 1106 57
        i 5.397 62.088 0.020 1 1101 74
        i 5.398 62.128 0.020 1 1099 69
        i 5.399 62.168 0.020 1 1094 79
        i 5.400 62.265 0.020 1 1102 57
        i 5.401 62.336 0.020 1 1103 69
        i 5.402 62.376 0.020 1 1091 49
        i 5.403 62.492 0.020 1 1099 70
        i 5.404 62.661 0.020 1 1097 62
        i 5.405 62.701 0.020 1 1093 73
        i 5.406 62.741 0.020 1 1101 58
        i 5.407 63.008 0.020 1 1095 74
        i 5.408 63.149 0.020 1 1101 67
        i 5.409 63.189 0.020 1 1093 54
        i 5.410 63.229 0.020 1 1101 54
        i 5.411 63.269 0.020 1 1100 56
        i 5.412 63.348 0.020 1 1099 70
        i 5.413 63.388 0.020 1 1097 45
        i 5.414 63.592 0.020 1 1093 66
        i 5.415 63.632 0.020 1 1107 76
        i 5.416 63.676 0.020 1 1109 77
        i 5.417 63.833 0.020 1 1111 78
        i 5.418 63.873 0.020 1 1112 48
        i 5.419 63.913 0.020 1 1112 51
        i 5.420 63.953 0.020 1 1093 80
        i 5.421 63.993 0.020 1 1097 53
         #ifdef IS_GENERATING_JSON
            s
            i "GenerateJson" 0 1
         #end
        </CsScore>
        </CsoundSynthesizer>
        `
    const csdJson = `
        {"069e83fd-1c94-47e9-95ec-126e0fbefec3":[{"instanceName":"","maxRiseTime":10,"noteOnStartPosition":[10,0,20],"noteOnEndPosition":[15,10,25],"noteOffEndZ":-1000,"noteNumberWobbleStartAmp":1.500,"noteNumberWobbleSpeed":5.000,"minNoteOffSpeed":50,"maxNoteOffSpeed":100,"soundDistanceMin":5,"soundDistanceMax":100},{"noteOn":{"time":2.000,"note":48.000,"velocity":96.000},"noteOff":{"time":48.000}},{"noteOn":{"time":2.000,"note":36.000,"velocity":63.000},"noteOff":{"time":10.002}},{"noteOn":{"time":10.001,"note":31.000,"velocity":45.000},"noteOff":{"time":18.001}},{"noteOn":{"time":10.001,"note":43.000,"velocity":63.000},"noteOff":{"time":18.001}},{"noteOn":{"time":18.000,"note":29.000,"velocity":45.000},"noteOff":{"time":26.002}},{"noteOn":{"time":18.000,"note":41.000,"velocity":63.000},"noteOff":{"time":26.002}},{"noteOn":{"time":26.001,"note":33.000,"velocity":45.000},"noteOff":{"time":34.001}},{"noteOn":{"time":26.001,"note":45.000,"velocity":63.000},"noteOff":{"time":34.001}},{"noteOn":{"time":34.000,"note":31.000,"velocity":45.000},"noteOff":{"time":48.000}},{"noteOn":{"time":34.000,"note":43.000,"velocity":63.000},"noteOff":{"time":48.000}}],"baeea327-af4b-4b10-a843-6614c20ea958":[{"instanceName":"CircleSynth 1","heightMin":1,"heightMax":50,"radiusMin":50,"radiusMax":50,"spreadMax":260,"spreadSpeedMin":1,"spreadSpeedMax":15,"noteNumberMin":24,"noteNumberMax":96,"soundDistanceMin":5,"soundDistanceMax":100},{"noteOn":{"time":2.000,"note":24.000,"velocity":45.000},"noteOff":{"time":10.002}},{"noteOn":{"time":2.000,"note":36.000,"velocity":63.000},"noteOff":{"time":10.002}},{"noteOn":{"time":10.001,"note":31.000,"velocity":45.000},"noteOff":{"time":18.001}},{"noteOn":{"time":10.001,"note":43.000,"velocity":63.000},"noteOff":{"time":18.001}},{"noteOn":{"time":18.000,"note":29.000,"velocity":45.000},"noteOff":{"time":26.002}},{"noteOn":{"time":18.000,"note":41.000,"velocity":63.000},"noteOff":{"time":26.002}},{"noteOn":{"time":26.001,"note":33.000,"velocity":45.000},"noteOff":{"time":34.001}},{"noteOn":{"time":26.001,"note":45.000,"velocity":63.000},"noteOff":{"time":34.001}},{"noteOn":{"time":34.000,"note":31.000,"velocity":45.000},"noteOff":{"time":48.000}},{"noteOn":{"time":34.000,"note":43.000,"velocity":63.000},"noteOff":{"time":48.000}}],"b4f7a35c-6198-422f-be6e-fa126f31b007":[{"instanceName":"","soundDistanceMin":5,"soundDistanceMax":100},{"noteOn":{"time":2.853,"note":97.625,"rtz":[97.483,50.185,17.687]}},{"noteOn":{"time":3.825,"note":95.493,"rtz":[78.101,189.001,17.519]}},{"noteOn":{"time":4.622,"note":102.640,"rtz":[64.153,349.023,18.082]}},{"noteOn":{"time":5.243,"note":103.227,"rtz":[73.098,340.247,18.128]}},{"noteOn":{"time":5.799,"note":94.906,"rtz":[17.742,75.556,17.473]}},{"noteOn":{"time":6.532,"note":97.039,"rtz":[27.420,1.279,17.641]}},{"noteOn":{"time":7.441,"note":96.828,"rtz":[40.762,317.710,17.624]}},{"noteOn":{"time":8.358,"note":94.696,"rtz":[52.645,48.639,17.456]}},{"noteOn":{"time":9.099,"note":103.437,"rtz":[34.853,105.488,18.145]}},{"noteOn":{"time":9.665,"note":102.430,"rtz":[9.261,270.852,18.065]}},{"noteOn":{"time":10.237,"note":95.782,"rtz":[72.572,128.955,17.542]}},{"noteOn":{"time":10.276,"note":95.703,"rtz":[95.375,283.861,17.536]}},{"noteOn":{"time":10.852,"note":93.649,"rtz":[56.289,71.592,17.374]}},{"noteOn":{"time":11.063,"note":97.836,"rtz":[11.600,129.770,17.704]}},{"noteOn":{"time":11.381,"note":102.484,"rtz":[23.150,86.891,18.070]}},{"noteOn":{"time":12.025,"note":96.032,"rtz":[59.324,210.027,17.562]}},{"noteOn":{"time":12.323,"note":101.383,"rtz":[82.004,315.736,17.983]}},{"noteOn":{"time":12.889,"note":93.899,"rtz":[92.451,190.114,17.394]}},{"noteOn":{"time":13.177,"note":94.750,"rtz":[95.268,240.929,17.461]}},{"noteOn":{"time":13.576,"note":103.766,"rtz":[90.977,318.219,18.171]}},{"noteOn":{"time":13.912,"note":96.882,"rtz":[66.879,3.563,17.629]}},{"noteOn":{"time":14.087,"note":101.633,"rtz":[9.616,53.159,18.003]}},{"noteOn":{"time":14.733,"note":94.985,"rtz":[66.239,106.456,17.479]}},{"noteOn":{"time":14.753,"note":96.500,"rtz":[36.338,341.630,17.598]}},{"noteOn":{"time":15.327,"note":92.852,"rtz":[56.406,118.703,17.311]}},{"noteOn":{"time":15.595,"note":98.632,"rtz":[93.748,350.831,17.766]}},{"noteOn":{"time":15.833,"note":102.719,"rtz":[28.630,127.198,18.088]}},{"noteOn":{"time":15.970,"note":99.469,"rtz":[46.228,352.357,17.832]}},{"noteOn":{"time":16.579,"note":95.235,"rtz":[71.295,336.536,17.499]}},{"noteOn":{"time":16.641,"note":97.336,"rtz":[8.968,153.196,17.664]}},{"noteOn":{"time":16.753,"note":100.586,"rtz":[13.094,9.590,17.920]}},{"noteOn":{"time":17.206,"note":102.797,"rtz":[83.112,40.792,18.094]}},{"noteOn":{"time":17.387,"note":93.102,"rtz":[5.480,192.732,17.331]}},{"noteOn":{"time":17.586,"note":95.547,"rtz":[73.463,126.815,17.523]}},{"noteOn":{"time":17.907,"note":104.929,"rtz":[35.532,18.146,18.262]}},{"noteOn":{"time":18.020,"note":102.969,"rtz":[37.320,15.967,18.108]}},{"noteOn":{"time":18.342,"note":97.679,"rtz":[71.415,24.613,17.691]}},{"noteOn":{"time":18.442,"note":95.062,"rtz":[28.124,283.993,17.485]}},{"noteOn":{"time":18.564,"note":100.836,"rtz":[59.959,105.043,17.940]}},{"noteOn":{"time":19.172,"note":97.195,"rtz":[91.821,297.246,17.653]}},{"noteOn":{"time":19.185,"note":94.188,"rtz":[50.497,266.088,17.416]}},{"noteOn":{"time":19.284,"note":97.297,"rtz":[34.368,270.915,17.661]}},{"noteOn":{"time":19.679,"note":98.672,"rtz":[74.331,115.062,17.769]}},{"noteOn":{"time":19.757,"note":92.055,"rtz":[86.947,140.339,17.248]}},{"noteOn":{"time":20.181,"note":99.429,"rtz":[33.628,333.655,17.829]}},{"noteOn":{"time":20.274,"note":101.922,"rtz":[23.424,196.768,18.025]}},{"noteOn":{"time":20.438,"note":96.539,"rtz":[91.299,87.479,17.601]}},{"noteOn":{"time":20.962,"note":103.593,"rtz":[75.752,325.560,18.157]}},{"noteOn":{"time":21.110,"note":94.438,"rtz":[82.099,354.035,17.436]}},{"noteOn":{"time":21.172,"note":99.789,"rtz":[23.226,117.339,17.857]}},{"noteOn":{"time":21.751,"note":104.274,"rtz":[55.589,150.576,18.211]}},{"noteOn":{"time":21.863,"note":92.305,"rtz":[34.860,108.144,17.268]}},{"noteOn":{"time":21.983,"note":96.343,"rtz":[83.513,201.611,17.586]}},{"noteOn":{"time":22.304,"note":95.859,"rtz":[36.714,132.657,17.548]}},{"noteOn":{"time":22.441,"note":102.172,"rtz":[8.854,107.157,18.045]}},{"noteOn":{"time":22.760,"note":98.476,"rtz":[55.926,286.092,17.754]}},{"noteOn":{"time":23.005,"note":93.938,"rtz":[23.642,284.369,17.397]}},{"noteOn":{"time":23.040,"note":100.039,"rtz":[70.483,10.514,17.877]}},{"noteOn":{"time":23.123,"note":97.992,"rtz":[13.952,354.113,17.716]}},{"noteOn":{"time":23.623,"note":93.391,"rtz":[25.408,273.544,17.354]}},{"noteOn":{"time":23.706,"note":97.875,"rtz":[52.818,118.058,17.707]}},{"noteOn":{"time":23.750,"note":91.805,"rtz":[75.704,306.568,17.229]}},{"noteOn":{"time":23.815,"note":98.093,"rtz":[26.125,201.316,17.724]}},{"noteOn":{"time":24.173,"note":91.258,"rtz":[28.470,62.649,17.186]}},{"noteOn":{"time":24.509,"note":101.672,"rtz":[46.562,126.412,18.006]}},{"noteOn":{"time":24.554,"note":95.743,"rtz":[24.266,174.907,17.539]}},{"noteOn":{"time":24.712,"note":101.125,"rtz":[50.096,105.260,17.963]}},{"noteOn":{"time":24.766,"note":100.226,"rtz":[97.896,216.200,17.892]}},{"noteOn":{"time":25.166,"note":104.390,"rtz":[64.575,158.423,18.220]}},{"noteOn":{"time":25.249,"note":99.539,"rtz":[64.248,26.952,17.838]}},{"noteOn":{"time":25.588,"note":98.993,"rtz":[93.519,259.045,17.795]}},{"noteOn":{"time":25.641,"note":93.641,"rtz":[27.474,22.859,17.373]}},{"noteOn":{"time":26.012,"note":94.593,"rtz":[74.105,24.332,17.448]}},{"noteOn":{"time":26.043,"note":103.477,"rtz":[20.274,12.299,18.148]}},{"noteOn":{"time":26.340,"note":92.492,"rtz":[63.870,235.305,17.283]}},{"noteOn":{"time":26.378,"note":97.140,"rtz":[28.744,172.681,17.649]}},{"noteOn":{"time":26.684,"note":96.656,"rtz":[82.882,308.346,17.611]}},{"noteOn":{"time":26.748,"note":96.726,"rtz":[75.832,357.733,17.616]}},{"noteOn":{"time":26.864,"note":101.375,"rtz":[31.608,242.618,17.982]}},{"noteOn":{"time":27.176,"note":99.273,"rtz":[43.196,215.005,17.817]}},{"noteOn":{"time":27.516,"note":93.141,"rtz":[31.183,72.156,17.334]}},{"noteOn":{"time":27.519,"note":99.243,"rtz":[27.354,334.796,17.814]}},{"noteOn":{"time":27.590,"note":98.789,"rtz":[55.345,52.525,17.779]}},{"noteOn":{"time":28.061,"note":92.594,"rtz":[48.501,185.011,17.291]}},{"noteOn":{"time":28.249,"note":91.008,"rtz":[47.609,186.712,17.166]}},{"noteOn":{"time":28.260,"note":97.078,"rtz":[95.143,190.797,17.644]}},{"noteOn":{"time":28.349,"note":98.890,"rtz":[19.356,3.751,17.787]}},{"noteOn":{"time":28.591,"note":91.539,"rtz":[14.864,0.328,17.208]}},{"noteOn":{"time":29.019,"note":100.875,"rtz":[14.170,81.787,17.943]}},{"noteOn":{"time":29.041,"note":101.313,"rtz":[11.629,141.538,17.977]}},{"noteOn":{"time":29.150,"note":100.328,"rtz":[67.153,113.335,17.900]}},{"noteOn":{"time":29.195,"note":94.946,"rtz":[38.664,195.442,17.476]}},{"noteOn":{"time":29.344,"note":101.023,"rtz":[54.235,326.885,17.955]}},{"noteOn":{"time":29.729,"note":99.180,"rtz":[24.141,124.827,17.809]}},{"noteOn":{"time":29.748,"note":98.743,"rtz":[74.954,5.229,17.775]}},{"noteOn":{"time":29.894,"note":104.813,"rtz":[56.192,32.823,18.253]}},{"noteOn":{"time":30.005,"note":98.196,"rtz":[67.683,326.088,17.732]}},{"noteOn":{"time":30.164,"note":92.844,"rtz":[96.857,158.983,17.311]}},{"noteOn":{"time":30.523,"note":95.390,"rtz":[79.898,190.438,17.511]}},{"noteOn":{"time":30.563,"note":102.953,"rtz":[9.322,295.084,18.107]}},{"noteOn":{"time":30.772,"note":97.937,"rtz":[85.057,101.489,17.712]}},{"noteOn":{"time":30.809,"note":93.289,"rtz":[87.452,343.077,17.346]}},{"noteOn":{"time":30.859,"note":102.680,"rtz":[96.862,161.132,18.085]}},{"noteOn":{"time":31.247,"note":97.523,"rtz":[44.969,206.920,17.679]}},{"noteOn":{"time":31.341,"note":100.578,"rtz":[90.129,337.920,17.920]}},{"noteOn":{"time":31.543,"note":105.086,"rtz":[47.684,216.831,18.274]}},{"noteOn":{"time":31.588,"note":97.453,"rtz":[82.232,47.222,17.673]}},{"noteOn":{"time":31.592,"note":100.070,"rtz":[90.236,20.655,17.880]}},{"noteOn":{"time":32.026,"note":92.344,"rtz":[12.470,119.051,17.271]}},{"noteOn":{"time":32.049,"note":98.446,"rtz":[8.454,306.578,17.752]}},{"noteOn":{"time":32.418,"note":95.218,"rtz":[26.408,315.075,17.497]}},{"noteOn":{"time":32.499,"note":91.797,"rtz":[73.968,329.488,17.228]}},{"noteOn":{"time":32.582,"note":99.586,"rtz":[96.921,184.611,17.841]}},{"noteOn":{"time":32.746,"note":90.211,"rtz":[36.402,7.293,17.103]}},{"noteOn":{"time":32.933,"note":99.687,"rtz":[18.896,179.016,17.849]}},{"noteOn":{"time":33.007,"note":92.336,"rtz":[69.976,166.813,17.271]}},{"noteOn":{"time":33.146,"note":97.351,"rtz":[13.819,300.590,17.665]}},{"noteOn":{"time":33.341,"note":96.282,"rtz":[48.976,15.636,17.581]}},{"noteOn":{"time":33.530,"note":100.078,"rtz":[62.161,269.055,17.880]}},{"noteOn":{"time":33.588,"note":99.532,"rtz":[22.327,116.699,17.837]}},{"noteOn":{"time":33.728,"note":100.516,"rtz":[37.698,167.505,17.915]}},{"noteOn":{"time":33.875,"note":101.820,"rtz":[33.153,142.841,18.017]}},{"noteOn":{"time":34.247,"note":97.946,"rtz":[8.592,2.088,17.712]}},{"noteOn":{"time":34.294,"note":98.383,"rtz":[63.368,33.936,17.747]}},{"noteOn":{"time":34.319,"note":94.149,"rtz":[98.781,211.573,17.413]}},{"noteOn":{"time":34.422,"note":97.399,"rtz":[30.227,48.021,17.669]}},{"noteOn":{"time":34.640,"note":92.047,"rtz":[17.597,17.559,17.248]}},{"noteOn":{"time":35.007,"note":103.750,"rtz":[20.914,269.304,18.169]}},{"noteOn":{"time":35.033,"note":96.187,"rtz":[29.294,33.731,17.574]}},{"noteOn":{"time":35.107,"note":104.016,"rtz":[93.048,69.871,18.190]}},{"noteOn":{"time":35.170,"note":98.734,"rtz":[58.470,227.284,17.774]}},{"noteOn":{"time":35.229,"note":94.086,"rtz":[89.481,77.592,17.408]}},{"noteOn":{"time":35.310,"note":92.094,"rtz":[84.329,169.377,17.251]}},{"noteOn":{"time":35.746,"note":98.320,"rtz":[85.501,279.912,17.742]}},{"noteOn":{"time":35.817,"note":99.782,"rtz":[40.864,358.753,17.857]}},{"noteOn":{"time":35.866,"note":105.882,"rtz":[60.127,172.602,18.337]}},{"noteOn":{"time":36.011,"note":100.867,"rtz":[80.664,137.764,17.942]}},{"noteOn":{"time":36.056,"note":101.883,"rtz":[56.661,220.898,18.022]}},{"noteOn":{"time":36.210,"note":89.961,"rtz":[5.942,18.327,17.084]}},{"noteOn":{"time":36.537,"note":91.547,"rtz":[42.381,247.977,17.208]}},{"noteOn":{"time":36.580,"note":97.649,"rtz":[98.017,264.871,17.689]}},{"noteOn":{"time":36.721,"note":99.828,"rtz":[95.334,267.419,17.860]}},{"noteOn":{"time":36.862,"note":96.015,"rtz":[71.598,97.941,17.560]}},{"noteOn":{"time":36.873,"note":98.250,"rtz":[83.271,104.367,17.736]}},{"noteOn":{"time":36.940,"note":91.000,"rtz":[72.929,272.240,17.165]}},{"noteOn":{"time":37.245,"note":90.586,"rtz":[16.370,244.734,17.133]}},{"noteOn":{"time":37.303,"note":97.696,"rtz":[7.364,228.953,17.693]}},{"noteOn":{"time":37.455,"note":93.132,"rtz":[41.150,113.556,17.333]}},{"noteOn":{"time":37.519,"note":100.484,"rtz":[44.845,157.184,17.912]}},{"noteOn":{"time":37.711,"note":98.148,"rtz":[29.590,152.623,17.728]}},{"noteOn":{"time":37.793,"note":100.382,"rtz":[92.077,39.959,17.904]}},{"noteOn":{"time":38.040,"note":99.282,"rtz":[77.179,178.605,17.817]}},{"noteOn":{"time":38.058,"note":98.735,"rtz":[58.481,231.863,17.774]}},{"noteOn":{"time":38.132,"note":94.437,"rtz":[27.492,30.219,17.436]}},{"noteOn":{"time":38.406,"note":102.617,"rtz":[89.884,239.377,18.080]}},{"noteOn":{"time":38.413,"note":99.719,"rtz":[47.586,177.586,17.852]}},{"noteOn":{"time":38.639,"note":95.485,"rtz":[30.003,318.448,17.519]}},{"noteOn":{"time":38.745,"note":97.149,"rtz":[73.273,50.516,17.650]}},{"noteOn":{"time":38.870,"note":96.602,"rtz":[87.346,300.518,17.606]}},{"noteOn":{"time":38.870,"note":96.570,"rtz":[46.967,288.953,17.604]}},{"noteOn":{"time":38.969,"note":97.586,"rtz":[8.647,24.391,17.684]}},{"noteOn":{"time":39.117,"note":92.750,"rtz":[21.943,322.135,17.303]}},{"noteOn":{"time":39.531,"note":93.352,"rtz":[81.344,50.971,17.351]}},{"noteOn":{"time":39.544,"note":96.984,"rtz":[5.054,21.742,17.637]}},{"noteOn":{"time":39.561,"note":104.547,"rtz":[42.860,80.089,18.232]}},{"noteOn":{"time":39.596,"note":99.531,"rtz":[59.149,139.941,17.837]}},{"noteOn":{"time":39.652,"note":94.882,"rtz":[22.519,193.645,17.471]}},{"noteOn":{"time":39.725,"note":91.297,"rtz":[98.995,297.348,17.189]}},{"noteOn":{"time":40.245,"note":99.117,"rtz":[53.356,333.951,17.804]}},{"noteOn":{"time":40.295,"note":98.985,"rtz":[31.721,287.857,17.794]}},{"noteOn":{"time":40.300,"note":105.321,"rtz":[73.006,303.427,18.293]}},{"noteOn":{"time":40.406,"note":103.219,"rtz":[33.307,204.817,18.127]}},{"noteOn":{"time":40.459,"note":101.664,"rtz":[31.335,133.214,18.005]}},{"noteOn":{"time":40.670,"note":89.164,"rtz":[24.426,239.084,17.021]}},{"noteOn":{"time":41.047,"note":90.750,"rtz":[39.379,122.625,17.146]}},{"noteOn":{"time":41.114,"note":96.852,"rtz":[13.390,128.579,17.626]}},{"noteOn":{"time":41.183,"note":96.812,"rtz":[84.859,22.184,17.623]}},{"noteOn":{"time":41.205,"note":99.032,"rtz":[55.234,8.286,17.798]}},{"noteOn":{"time":41.266,"note":101.086,"rtz":[46.663,166.900,17.960]}},{"noteOn":{"time":41.410,"note":91.797,"rtz":[16.234,190.067,17.228]}},{"noteOn":{"time":41.424,"note":103.157,"rtz":[93.963,77.273,18.123]}},{"noteOn":{"time":41.744,"note":91.382,"rtz":[75.420,192.277,17.195]}},{"noteOn":{"time":41.832,"note":96.899,"rtz":[60.741,59.005,17.630]}},{"noteOn":{"time":41.947,"note":93.929,"rtz":[39.683,244.574,17.396]}},{"noteOn":{"time":42.108,"note":101.281,"rtz":[97.868,204.920,17.975]}},{"noteOn":{"time":42.154,"note":98.945,"rtz":[34.231,215.565,17.791]}},{"noteOn":{"time":42.172,"note":99.047,"rtz":[46.831,234.643,17.799]}},{"noteOn":{"time":42.381,"note":101.024,"rtz":[10.214,293.490,17.955]}},{"noteOn":{"time":42.551,"note":98.485,"rtz":[40.481,204.918,17.755]}},{"noteOn":{"time":42.571,"note":97.938,"rtz":[34.155,185.358,17.712]}},{"noteOn":{"time":42.616,"note":95.234,"rtz":[57.308,120.899,17.499]}},{"noteOn":{"time":42.940,"note":103.414,"rtz":[60.125,171.896,18.143]}},{"noteOn":{"time":42.979,"note":98.922,"rtz":[60.913,128.106,17.789]}},{"noteOn":{"time":42.983,"note":103.109,"rtz":[71.629,110.420,18.119]}},{"noteOn":{"time":43.003,"note":101.179,"rtz":[52.148,209.102,17.967]}},{"noteOn":{"time":43.244,"note":96.352,"rtz":[56.143,13.150,17.587]}},{"noteOn":{"time":43.310,"note":97.367,"rtz":[87.639,58.133,17.667]}},{"noteOn":{"time":43.362,"note":95.805,"rtz":[15.310,179.445,17.544]}},{"noteOn":{"time":43.595,"note":93.547,"rtz":[81.984,307.752,17.366]}},{"noteOn":{"time":43.643,"note":105.242,"rtz":[59.238,175.663,18.287]}},{"noteOn":{"time":43.656,"note":96.789,"rtz":[71.240,314.346,17.621]}},{"noteOn":{"time":43.938,"note":94.688,"rtz":[53.582,64.758,17.456]}},{"noteOn":{"time":44.054,"note":97.781,"rtz":[10.528,59.340,17.699]}},{"noteOn":{"time":44.066,"note":100.328,"rtz":[49.057,48.155,17.900]}},{"noteOn":{"time":44.116,"note":95.679,"rtz":[21.329,75.793,17.534]}},{"noteOn":{"time":44.188,"note":105.343,"rtz":[34.039,138.507,18.295]}},{"noteOn":{"time":44.209,"note":90.500,"rtz":[77.409,270.951,17.126]}},{"noteOn":{"time":44.427,"note":95.375,"rtz":[75.321,152.908,17.510]}},{"noteOn":{"time":44.740,"note":93.445,"rtz":[5.061,24.362,17.358]}},{"noteOn":{"time":44.743,"note":99.914,"rtz":[21.126,354.206,17.867]}},{"noteOn":{"time":44.804,"note":104.524,"rtz":[28.011,238.640,18.230]}},{"noteOn":{"time":44.813,"note":98.188,"rtz":[26.960,176.654,17.731]}},{"noteOn":{"time":44.949,"note":102.461,"rtz":[98.937,274.118,18.068]}},{"noteOn":{"time":45.153,"note":97.507,"rtz":[68.889,90.426,17.678]}},{"noteOn":{"time":45.199,"note":89.632,"rtz":[63.155,308.185,17.058]}},{"noteOn":{"time":45.558,"note":90.047,"rtz":[71.329,350.143,17.090]}},{"noteOn":{"time":45.568,"note":97.609,"rtz":[9.395,324.322,17.686]}},{"noteOn":{"time":45.685,"note":96.055,"rtz":[47.506,145.640,17.563]}},{"noteOn":{"time":45.704,"note":102.422,"rtz":[86.842,98.019,18.065]}},{"noteOn":{"time":45.780,"note":98.235,"rtz":[85.445,257.481,17.735]}},{"noteOn":{"time":45.920,"note":92.593,"rtz":[78.739,85.084,17.291]}},{"noteOn":{"time":45.986,"note":102.360,"rtz":[8.806,88.097,18.060]}},{"noteOn":{"time":46.243,"note":92.179,"rtz":[93.050,70.419,17.258]}},{"noteOn":{"time":46.452,"note":96.102,"rtz":[73.785,255.846,17.567]}},{"noteOn":{"time":46.478,"note":100.289,"rtz":[33.022,90.253,17.897]}},{"noteOn":{"time":46.478,"note":99.742,"rtz":[58.334,172.858,17.854]}},{"noteOn":{"time":46.479,"note":94.726,"rtz":[87.812,127.797,17.459]}},{"noteOn":{"time":46.639,"note":102.078,"rtz":[62.982,238.747,18.038]}},{"noteOn":{"time":46.826,"note":90.250,"rtz":[29.969,304.774,17.106]}},{"noteOn":{"time":46.877,"note":100.227,"rtz":[70.970,205.893,17.892]}},{"noteOn":{"time":47.061,"note":97.688,"rtz":[61.422,332.311,17.692]}},{"noteOn":{"time":47.125,"note":97.141,"rtz":[80.852,213.382,17.649]}},{"noteOn":{"time":47.190,"note":96.031,"rtz":[80.794,190.195,17.561]}},{"noteOn":{"time":47.369,"note":88.118,"rtz":[97.535,71.423,16.938]}},{"noteOn":{"time":47.415,"note":103.789,"rtz":[6.864,28.266,18.172]}},{"noteOn":{"time":47.422,"note":98.125,"rtz":[35.282,277.625,17.726]}},{"noteOn":{"time":47.430,"note":103.906,"rtz":[71.916,225.504,18.182]}},{"noteOn":{"time":47.470,"note":99.843,"rtz":[39.714,256.916,17.862]}},{"noteOn":{"time":47.743,"note":95.555,"rtz":[62.933,219.289,17.524]}},{"noteOn":{"time":47.839,"note":98.164,"rtz":[55.961,300.037,17.729]}},{"noteOn":{"time":47.894,"note":95.008,"rtz":[33.518,289.461,17.481]}},{"noteOn":{"time":47.935,"note":106.039,"rtz":[22.851,326.851,18.350]}},{"noteOn":{"time":48.016,"note":94.343,"rtz":[23.191,103.573,17.429]}},{"noteOn":{"time":48.091,"note":97.985,"rtz":[50.723,357.119,17.715]}},{"noteOn":{"time":48.215,"note":101.976,"rtz":[14.437,188.995,18.030]}},{"noteOn":{"time":48.221,"note":95.993,"rtz":[63.971,275.847,17.559]}},{"noteOn":{"time":48.565,"note":98.578,"rtz":[22.215,71.378,17.762]}},{"noteOn":{"time":48.576,"note":101.125,"rtz":[5.622,249.840,17.963]}},{"noteOn":{"time":48.592,"note":96.476,"rtz":[55.099,314.057,17.597]}},{"noteOn":{"time":48.784,"note":89.703,"rtz":[45.490,56.209,17.063]}},{"noteOn":{"time":48.872,"note":105.860,"rtz":[56.508,159.776,18.335]}},{"noteOn":{"time":48.872,"note":96.172,"rtz":[7.068,110.070,17.573]}},{"noteOn":{"time":48.994,"note":95.852,"rtz":[42.373,244.724,17.547]}},{"noteOn":{"time":49.194,"note":93.891,"rtz":[7.064,108.695,17.393]}},{"noteOn":{"time":49.242,"note":100.711,"rtz":[98.922,268.136,17.930]}},{"noteOn":{"time":49.344,"note":97.391,"rtz":[91.634,222.257,17.669]}},{"noteOn":{"time":49.377,"note":103.727,"rtz":[43.925,147.690,18.167]}},{"noteOn":{"time":49.482,"note":102.743,"rtz":[49.156,87.968,18.090]}},{"noteOn":{"time":49.750,"note":90.429,"rtz":[89.444,62.809,17.120]}},{"noteOn":{"time":49.753,"note":98.304,"rtz":[51.023,117.580,17.740]}},{"noteOn":{"time":49.908,"note":94.242,"rtz":[62.339,340.620,17.421]}},{"noteOn":{"time":49.914,"note":94.281,"rtz":[28.170,302.414,17.424]}},{"noteOn":{"time":50.020,"note":98.406,"rtz":[99.973,330.143,17.749]}},{"noteOn":{"time":50.068,"note":90.843,"rtz":[20.243,359.981,17.153]}},{"noteOn":{"time":50.271,"note":95.258,"rtz":[94.467,279.428,17.501]}},{"noteOn":{"time":50.376,"note":97.438,"rtz":[27.342,330.030,17.672]}},{"noteOn":{"time":50.432,"note":101.563,"rtz":[17.094,175.514,17.997]}},{"noteOn":{"time":50.474,"note":93.390,"rtz":[67.076,82.416,17.354]}},{"noteOn":{"time":50.654,"note":96.414,"rtz":[29.199,355.671,17.592]}},{"noteOn":{"time":50.741,"note":92.976,"rtz":[68.965,120.803,17.321]}},{"noteOn":{"time":50.810,"note":100.539,"rtz":[57.462,182.591,17.916]}},{"noteOn":{"time":50.859,"note":101.625,"rtz":[74.949,3.466,18.002]}},{"noteOn":{"time":51.055,"note":95.523,"rtz":[6.917,49.606,17.521]}},{"noteOn":{"time":51.093,"note":95.305,"rtz":[61.901,164.924,17.504]}},{"noteOn":{"time":51.168,"note":99.430,"rtz":[55.990,311.663,17.829]}},{"noteOn":{"time":51.170,"note":102.875,"rtz":[73.578,172.731,18.100]}},{"noteOn":{"time":51.215,"note":89.453,"rtz":[84.273,146.879,17.044]}},{"noteOn":{"time":51.544,"note":99.493,"rtz":[26.484,345.654,17.834]}},{"noteOn":{"time":51.572,"note":96.891,"rtz":[73.917,308.885,17.629]}},{"noteOn":{"time":51.721,"note":96.344,"rtz":[90.910,291.619,17.586]}},{"noteOn":{"time":51.744,"note":97.328,"rtz":[83.182,68.894,17.664]}},{"noteOn":{"time":51.786,"note":96.828,"rtz":[31.168,65.976,17.624]}},{"noteOn":{"time":51.836,"note":88.679,"rtz":[44.573,48.044,16.983]}},{"noteOn":{"time":51.876,"note":104.703,"rtz":[18.217,266.452,18.244]}},{"noteOn":{"time":51.892,"note":102.993,"rtz":[44.558,41.945,18.110]}},{"noteOn":{"time":52.241,"note":94.758,"rtz":[37.715,174.410,17.461]}},{"noteOn":{"time":52.390,"note":98.961,"rtz":[36.216,292.854,17.792]}},{"noteOn":{"time":52.439,"note":95.140,"rtz":[22.693,263.319,17.491]}},{"noteOn":{"time":52.464,"note":100.640,"rtz":[51.947,128.567,17.924]}},{"noteOn":{"time":52.468,"note":94.211,"rtz":[84.514,243.611,17.418]}},{"noteOn":{"time":52.526,"note":106.836,"rtz":[70.957,200.450,18.412]}},{"noteOn":{"time":52.637,"note":97.188,"rtz":[99.247,38.757,17.653]}},{"noteOn":{"time":52.664,"note":95.196,"rtz":[43.577,8.223,17.496]}},{"noteOn":{"time":53.071,"note":97.273,"rtz":[44.901,179.582,17.659]}},{"noteOn":{"time":53.075,"note":99.375,"rtz":[85.799,39.330,17.825]}},{"noteOn":{"time":53.120,"note":102.773,"rtz":[59.595,318.811,18.092]}},{"noteOn":{"time":53.129,"note":101.922,"rtz":[83.404,157.936,18.025]}},{"noteOn":{"time":53.378,"note":89.093,"rtz":[50.622,316.374,17.015]}},{"noteOn":{"time":53.435,"note":96.968,"rtz":[15.296,173.692,17.635]}},{"noteOn":{"time":53.438,"note":105.063,"rtz":[16.139,152.069,18.273]}},{"noteOn":{"time":53.616,"note":95.055,"rtz":[76.593,303.570,17.485]}},{"noteOn":{"time":53.741,"note":101.507,"rtz":[37.301,8.259,17.993]}},{"noteOn":{"time":53.878,"note":96.594,"rtz":[45.908,223.732,17.606]}},{"noteOn":{"time":54.011,"note":93.094,"rtz":[85.177,149.795,17.330]}},{"noteOn":{"time":54.056,"note":101.946,"rtz":[13.017,338.787,18.027]}},{"noteOn":{"time":54.065,"note":102.930,"rtz":[71.915,225.444,18.105]}},{"noteOn":{"time":54.300,"note":91.226,"rtz":[38.025,298.903,17.183]}},{"noteOn":{"time":54.401,"note":99.101,"rtz":[96.815,142.182,17.803]}},{"noteOn":{"time":54.458,"note":95.078,"rtz":[85.175,148.960,17.486]}},{"noteOn":{"time":54.579,"note":91.640,"rtz":[84.671,306.615,17.216]}},{"noteOn":{"time":54.586,"note":99.203,"rtz":[27.435,7.289,17.811]}},{"noteOn":{"time":54.638,"note":95.039,"rtz":[18.783,133.798,17.483]}},{"noteOn":{"time":54.860,"note":94.461,"rtz":[40.769,320.551,17.438]}},{"noteOn":{"time":54.925,"note":100.766,"rtz":[37.078,278.967,17.934]}},{"noteOn":{"time":54.970,"note":96.641,"rtz":[14.443,191.022,17.610]}},{"noteOn":{"time":55.043,"note":94.187,"rtz":[25.639,6.410,17.416]}},{"noteOn":{"time":55.120,"note":97.211,"rtz":[89.215,330.838,17.654]}},{"noteOn":{"time":55.240,"note":93.773,"rtz":[39.672,240.120,17.384]}},{"noteOn":{"time":55.253,"note":101.336,"rtz":[68.342,230.564,17.979]}},{"noteOn":{"time":55.500,"note":100.828,"rtz":[86.191,196.830,17.939]}},{"noteOn":{"time":55.507,"note":98.633,"rtz":[93.033,63.625,17.766]}},{"noteOn":{"time":55.639,"note":88.657,"rtz":[73.843,279.335,16.981]}},{"noteOn":{"time":55.644,"note":96.320,"rtz":[24.741,5.820,17.584]}},{"noteOn":{"time":55.703,"note":103.672,"rtz":[72.717,187.317,18.163]}},{"noteOn":{"time":55.732,"note":94.508,"rtz":[17.064,163.452,17.442]}},{"noteOn":{"time":56.067,"note":96.532,"rtz":[14.853,355.642,17.601]}},{"noteOn":{"time":56.082,"note":96.094,"rtz":[68.162,158.422,17.566]}},{"noteOn":{"time":56.098,"note":98.696,"rtz":[64.209,11.358,17.771]}},{"noteOn":{"time":56.332,"note":95.547,"rtz":[37.546,106.604,17.523]}},{"noteOn":{"time":56.339,"note":89.476,"rtz":[40.473,201.878,17.045]}},{"noteOn":{"time":56.369,"note":105.500,"rtz":[44.172,246.966,18.307]}},{"noteOn":{"time":56.371,"note":102.196,"rtz":[69.751,76.274,18.047]}},{"noteOn":{"time":56.381,"note":97.625,"rtz":[47.480,135.040,17.687]}},{"noteOn":{"time":56.739,"note":93.961,"rtz":[75.504,226.300,17.399]}},{"noteOn":{"time":56.880,"note":95.937,"rtz":[61.965,190.577,17.554]}},{"noteOn":{"time":56.931,"note":101.437,"rtz":[13.221,60.405,17.987]}},{"noteOn":{"time":56.940,"note":99.757,"rtz":[78.820,117.423,17.855]}},{"noteOn":{"time":57.028,"note":94.399,"rtz":[57.945,16.697,17.433]}},{"noteOn":{"time":57.057,"note":93.414,"rtz":[91.818,295.881,17.355]}},{"noteOn":{"time":57.173,"note":106.368,"rtz":[12.323,59.998,18.375]}},{"noteOn":{"time":57.217,"note":96.391,"rtz":[67.449,232.231,17.590]}},{"noteOn":{"time":57.498,"note":103.570,"rtz":[37.778,199.827,18.155]}},{"noteOn":{"time":57.565,"note":98.070,"rtz":[81.823,243.098,17.722]}},{"noteOn":{"time":57.585,"note":100.172,"rtz":[56.606,198.788,17.888]}},{"noteOn":{"time":57.697,"note":102.718,"rtz":[52.787,105.869,18.088]}},{"noteOn":{"time":57.908,"note":89.890,"rtz":[19.931,234.432,17.078]}},{"noteOn":{"time":57.922,"note":104.266,"rtz":[99.330,71.820,18.210]}},{"noteOn":{"time":57.928,"note":97.765,"rtz":[17.977,170.108,17.698]}},{"noteOn":{"time":58.160,"note":94.258,"rtz":[10.922,217.712,17.422]}},{"noteOn":{"time":58.240,"note":101.696,"rtz":[11.847,229.063,18.008]}},{"noteOn":{"time":58.302,"note":93.703,"rtz":[44.203,259.278,17.378]}},{"noteOn":{"time":58.426,"note":95.797,"rtz":[33.968,110.100,17.543]}},{"noteOn":{"time":58.646,"note":101.149,"rtz":[43.215,222.570,17.964]}},{"noteOn":{"time":58.670,"note":102.133,"rtz":[52.692,67.648,18.042]}},{"noteOn":{"time":58.741,"note":99.898,"rtz":[91.315,94.209,17.866]}},{"noteOn":{"time":58.784,"note":92.023,"rtz":[73.927,312.854,17.246]}},{"noteOn":{"time":58.841,"note":95.836,"rtz":[11.868,237.444,17.546]}},{"noteOn":{"time":58.924,"note":95.875,"rtz":[88.521,52.177,17.549]}},{"noteOn":{"time":59.089,"note":92.437,"rtz":[38.783,243.230,17.279]}},{"noteOn":{"time":59.270,"note":100.000,"rtz":[60.294,239.669,17.874]}},{"noteOn":{"time":59.372,"note":99.969,"rtz":[55.727,206.231,17.872]}},{"noteOn":{"time":59.391,"note":93.664,"rtz":[70.876,168.080,17.375]}},{"noteOn":{"time":59.500,"note":95.844,"rtz":[49.233,118.886,17.547]}},{"noteOn":{"time":59.507,"note":98.007,"rtz":[98.847,237.938,17.717]}},{"noteOn":{"time":59.611,"note":94.984,"rtz":[7.338,218.798,17.479]}},{"noteOn":{"time":59.614,"note":100.032,"rtz":[42.221,183.538,17.877]}},{"noteOn":{"time":59.739,"note":94.570,"rtz":[6.420,210.110,17.446]}},{"noteOn":{"time":59.818,"note":102.132,"rtz":[84.327,168.400,18.042]}},{"noteOn":{"time":59.945,"note":97.836,"rtz":[58.168,105.888,17.704]}},{"noteOn":{"time":60.105,"note":88.140,"rtz":[20.459,86.570,16.940]}},{"noteOn":{"time":60.124,"note":97.899,"rtz":[50.346,205.490,17.709]}},{"noteOn":{"time":60.180,"note":103.532,"rtz":[50.157,129.852,18.152]}},{"noteOn":{"time":60.234,"note":97.117,"rtz":[25.434,283.773,17.647]}},{"noteOn":{"time":60.307,"note":93.711,"rtz":[53.801,152.731,17.379]}},{"noteOn":{"time":60.511,"note":95.735,"rtz":[95.099,173.180,17.538]}},{"noteOn":{"time":60.592,"note":95.297,"rtz":[96.815,142.045,17.504]}},{"noteOn":{"time":60.793,"note":101.399,"rtz":[81.338,48.430,17.984]}},{"noteOn":{"time":60.868,"note":102.234,"rtz":[29.019,283.107,18.050]}},{"noteOn":{"time":60.881,"note":90.273,"rtz":[35.186,239.045,17.108]}},{"noteOn":{"time":60.910,"note":98.422,"rtz":[38.298,48.416,17.750]}},{"noteOn":{"time":60.931,"note":106.297,"rtz":[28.643,132.417,18.370]}},{"noteOn":{"time":60.944,"note":94.750,"rtz":[97.156,279.285,17.461]}},{"noteOn":{"time":61.238,"note":93.164,"rtz":[23.329,158.966,17.336]}},{"noteOn":{"time":61.351,"note":94.398,"rtz":[79.417,357.112,17.433]}},{"noteOn":{"time":61.357,"note":96.734,"rtz":[14.254,115.442,17.617]}},{"noteOn":{"time":61.389,"note":104.367,"rtz":[97.577,88.295,18.218]}},{"noteOn":{"time":61.424,"note":100.554,"rtz":[98.580,130.704,17.918]}},{"noteOn":{"time":61.649,"note":92.618,"rtz":[49.258,128.965,17.293]}},{"noteOn":{"time":61.838,"note":95.594,"rtz":[95.637,29.286,17.527]}},{"noteOn":{"time":61.890,"note":105.571,"rtz":[63.774,196.777,18.313]}},{"noteOn":{"time":62.096,"note":100.968,"rtz":[91.552,189.377,17.950]}},{"noteOn":{"time":62.097,"note":98.867,"rtz":[74.668,250.553,17.785]}},{"noteOn":{"time":62.105,"note":94.500,"rtz":[75.034,37.478,17.441]}},{"noteOn":{"time":62.267,"note":102.485,"rtz":[7.813,49.284,18.070]}},{"noteOn":{"time":62.337,"note":103.469,"rtz":[52.891,147.416,18.147]}},{"noteOn":{"time":62.347,"note":90.687,"rtz":[41.501,254.495,17.141]}},{"noteOn":{"time":62.491,"note":98.562,"rtz":[90.263,31.840,17.761]}},{"noteOn":{"time":62.655,"note":96.632,"rtz":[40.194,89.860,17.609]}},{"noteOn":{"time":62.703,"note":93.461,"rtz":[47.343,80.172,17.359]}},{"noteOn":{"time":62.739,"note":100.899,"rtz":[61.465,349.779,17.945]}},{"noteOn":{"time":63.013,"note":95.000,"rtz":[94.225,182.266,17.480]}},{"noteOn":{"time":63.148,"note":100.695,"rtz":[65.844,307.813,17.929]}},{"noteOn":{"time":63.179,"note":92.820,"rtz":[60.923,131.992,17.309]}},{"noteOn":{"time":63.206,"note":101.336,"rtz":[85.273,188.086,17.979]}},{"noteOn":{"time":63.238,"note":100.352,"rtz":[38.562,154.618,17.902]}},{"noteOn":{"time":63.341,"note":99.235,"rtz":[52.864,136.423,17.814]}},{"noteOn":{"time":63.388,"note":96.672,"rtz":[19.157,283.990,17.612]}},{"noteOn":{"time":63.599,"note":93.234,"rtz":[59.876,71.716,17.341]}},{"noteOn":{"time":63.621,"note":106.844,"rtz":[15.066,81.174,18.413]}},{"noteOn":{"time":63.675,"note":108.688,"rtz":[89.500,85.163,18.558]}},{"noteOn":{"time":63.833,"note":110.532,"rtz":[11.026,259.298,18.703]}},{"noteOn":{"time":63.842,"note":111.625,"rtz":[34.530,335.677,18.789]}},{"noteOn":{"time":63.869,"note":112.093,"rtz":[79.964,216.954,18.826]}},{"noteOn":{"time":63.922,"note":97.102,"rtz":[85.659,343.110,17.646]}},{"noteOn":{"time":63.923,"note":92.868,"rtz":[97.771,166.151,17.312]}}]}
        `
    startAudioVisuals()
    return scene;
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas);
    }
}
