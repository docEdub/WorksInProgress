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
        --messagelevel=0
        --midi-device=0
        --nodisplays
        --nosound
        </CsOptions>
        <CsInstruments>
        sr = 48000
        kr = 480
        nchnls = 2
        0dbfs = 1
        instr 1
            kamp = .6
            kcps = 440
            ifn  = p4
            asig oscil kamp, kcps, ifn
            outs asig,asig    
        endin
        </CsInstruments>
        <CsScore>
        f1 0 16384 10 1
        i 1 0 9999 1
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
