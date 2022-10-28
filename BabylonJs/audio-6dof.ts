import * as BABYLON from "babylonjs"
import * as CSOUND from "./@doc.e.dub/csound-browser"

import csdText from "./project.csd"

declare global {
    interface Document {
        Csound: CSOUND.Csound
    }

    const SHARED: any
}

let csound: Csound = null

//#region class Csound

class Csound {
    constructor(audioContext: AudioContext, readyObservable: BABYLON.Observable<void>) {
        this.#audioContext = audioContext
        this.#csdText = csdText
        this.readyObservable = readyObservable

        if (document.getElementById('csound-script') === null) {
            const csoundJsUrl = "https://unpkg.com/@doc.e.dub/csound-browser@6.17.0-beta5/dist/csound.esm.js"
            // const csoundJsUrl = document.isProduction
            //     ? "https://unpkg.com/@csound/browser@6.17.0-beta2/dist/csound.js"
            //     : "https://unpkg.com/@doc.e.dub/csound-browser@6.17.0-beta5/dist/csound.esm.js"
            // const csoundJsUrl = "./csound.js"
            let csoundImportScript = document.createElement('script')
            csoundImportScript.type = 'module'
            csoundImportScript.innerText = `
                console.debug("Csound importing ...");
                import { Csound } from "${csoundJsUrl}";
                document.Csound = Csound;
            `
            document.body.appendChild(csoundImportScript)
        }

        const importScriptTimer = setInterval(() => {
            if (!!document.Csound) {
                console.debug('Csound importing - done')
                clearInterval(importScriptTimer)
                this.#onImportScriptDone()
                this.start()
            }
        })
    }

    onAudioEngineUnlocked = () => {
        this.#audioContext.resume()
        this.#audioEngineIsUnlocked = true
        console.debug('Audio engine unlocked')
        this.#startIfRequested()
    }

    //#region Options

    #ioBufferSize = 128
    get ioBufferSize() { return this.#ioBufferSize }
    set ioBufferSize(value) { this.#ioBufferSize = value }

    #logMessages = true
    get logMessages() { return this.#logMessages }
    set logMessages(value) { this.#logMessages = value }

    //#endregion

    #csdText = null
    get csdText() { return this.#csdText }

    #json = null
    get json() { return this.#json }
    get jsonIsGenerated() { return this.#json != null }

    #previousConsoleLog = null

    #csoundObj = null
    #audioContext = null
    get audioContext() { return this.#audioContext }

    #isLoaded = false
    get isLoaded() { return this.#isLoaded }

    #audioEngineIsUnlocked = false
    get audioEngineIsUnlocked() { return this.#audioEngineIsUnlocked }

    #jsonGenerationWasRequested = false
    get jsonGenerationWasRequested() { return this.#jsonGenerationWasRequested }

    #startWasRequested = false
    get startWasRequested() { return this.#startWasRequested }

    #isStarted = false
    get isStarted() { return this.#isStarted }

    #playbackIsStarted = false
    get playbackIsStarted() { return this.#playbackIsStarted }
    set playbackIsStarted(value) { this.#playbackIsStarted = value }

    #latency = 0

    #startTime = 0
    get startTime() { return this.#startTime }

    #restartCount = 0
    get restartCount() { return this.#restartCount }

    private cameraMatrix = null
    private pendingCameraMatrix = new BABYLON.Matrix
    private hasPendingCameraMatrixChange = false

    onCameraMatrixChanged = (matrix: BABYLON.Matrix) => {
        if (this.isStarted) {
            this.cameraMatrix = matrix
            this.#csoundObj.tableCopyIn("1", matrix.m)
        }
        else {
            this.pendingCameraMatrix.copyFrom(matrix)
            this.hasPendingCameraMatrixChange = true
        }
    }

    #onImportScriptDone = async () => {
        this.#isLoaded = true
        await this.#startIfRequested()
    }

    #consoleLog = function() {
        csound.onLogMessage(console, arguments)
    }

    start = async () => {
        if (this.isStarted) return
        this.#startWasRequested = true
        if (!this.audioEngineIsUnlocked) return
        if (!this.isLoaded) return

        console.debug('Starting Csound playback ...')

        this.#previousConsoleLog = console.log
        console.log = this.#consoleLog
        this.#csoundObj = await document.Csound({
            audioContext: this.#audioContext,
            useSAB: false
        })
        console.log = this.#previousConsoleLog

        if (!this.#csoundObj) {
            'Csound failed to initialize'
            return
        }

        const csound = this.#csoundObj
        console.log('Csound version =', await csound.getVersion())

        const audioContext = await csound.getAudioContext()
        console.debug('audioContext =', audioContext)
        console.debug('audioContext.audioWorklet =', audioContext.audioWorklet)
        console.debug('audioContext.baseLatency =', audioContext.baseLatency)
        console.debug('audioContext.sampleRate =', audioContext.sampleRate)
        console.debug('audioContext.state =', audioContext.state)
        this.#audioContext = audioContext

        if (audioContext.sampleRate != 48000) {
            console.log('Sample rate must be 48000')
            return
        }

        console.debug('Csound initialized successfully')
        await csound.setOption('--iobufsamps=' + this.ioBufferSize)
        console.debug('Csound csd compiling ...')
        let csoundErrorCode = await csound.compileCsdText(this.csdText)
        if (csoundErrorCode != 0) {
            console.error('Csound csd compile failed')
            return
        }

        console.debug('Csound csd compile succeeded')
        console.debug('Csound starting ...')
        csound.start()
        if (this.hasPendingCameraMatrixChange) {
            this.#csoundObj.tableCopyIn("1", this.pendingCameraMatrix.m)
            this.hasPendingCameraMatrixChange = false
        }
        this.#isStarted = true
        this.volume = 1

        this.listenForEarliestNoteOn()

        console.debug('Starting Csound playback - done')
    }

    stop = async () => {
        if (!this.isStarted) return
        if (!this.#previousConsoleLog) return
        this.#startWasRequested = false
        if (!this.audioEngineIsUnlocked) return
        if (!this.isLoaded) return

        console.debug('Stopping Csound playback ...')

        this.volume = 0
        await this.#csoundObj.stop()
        this.#playbackIsStarted = false
        this.#isStarted = false
        console.log = this.#previousConsoleLog

        this.pendingCameraMatrix.copyFrom(this.cameraMatrix)
        this.hasPendingCameraMatrixChange = true

        console.debug('Stopping Csound playback - done')
    }

    _isPaused = false
    _isResumed = false

    pause = () => {
        if (!this.isStarted) {
            return
        }
        console.debug(`setting pause control channel to 1`)
        this.#csoundObj.setControlChannel('pause', 1)
        this._isResumed = false
        setTimeout(async () => {
            if (this._isResumed) {
                return
            }
            this._isPaused = true
            this.#csoundObj.pause()
        }, 500)
    }

    resume = () => {
        if (!this.isStarted) {
            return
        }
        console.debug(`setting pause control channel to 0`)
        this.#csoundObj.setControlChannel('pause', 0)
        this._isResumed = true
        if (!this._isPaused) {
            return
        }
        this._isPaused = false
        this.#csoundObj.resume()
    }

    _volume = 0
    set volume(value) {
        if (this._volume == value) {
            return
        }
        this._volume = value
        this.#csoundObj.setControlChannel('main-volume', value)
    }

    #startIfRequested = async () => {
        if (this.#startWasRequested) {
            await this.start()
        }
    }

    #restart = async () => {
        console.debug('Restarting Csound ...')
        this.earliestNoteWasHeard = false
        await this.stop()
        await this.start()
        console.debug('Restarting Csound - done')
        this.#restartCount++
        console.debug('Restart count =', this.restartCount)
    }

    get adjustedAudioContextTime() {
        return this.#audioContext.currentTime - this.#latency
    }

    onLogMessage = (console, args) => {
        if (args[0].startsWith('csd:started')) {
            const scoreTime = Number(args[0].split(' at ')[1])
            // this.#startTime -= scoreTime
            this.#playbackIsStarted = true
            console.debug(`Playback start message received. Score time = ${scoreTime}`)
            this.readyObservable.notifyObservers()
        }
        else if (args[0].startsWith('csd:resumed')) {
            const scoreTime = Number(args[0].split(' at ')[1])
            this.#startTime = this.adjustedAudioContextTime - scoreTime - 1 // - 1 offsets FinalMixInstrument's start time
            console.debug('Playback resumed message received')
        }
        else if (args[0].startsWith('csd:ended')) {
            console.debug('Playback end message received')
            this.#restart()
        }
        // The latest version of Csound WASM is logging the entire csdText contents several times when starting.
        // This filters those messages out.
        else if (args[0].startsWith('\n<CsoundSynthesizer>\n<CsOptions>\n')) {
            return
        }
        else if (csound.logMessages) {
            this.#previousConsoleLog.apply(console, args)
        }
    }

    private readyObservable: BABYLON.Observable<void> = null

    private listenForEarliestNoteOn = async () => {
        let scene = BABYLON.Engine.LastCreatedScene!
        if (!this.audioAnalyzer) {
            const analyzer = new BABYLON.Analyser(scene) as any
            analyzer.FFT_SIZE = 32
            analyzer.SMOOTHING = 0
            this.audioAnalyzer = analyzer
        }
        const csound = this.#csoundObj
        const audioOutputNode = await csound.getNode()
        audioOutputNode.connect(this.audioAnalyzerNode)

        this.earliestNoteWasHeard = false
        this.#startTime = -this.earliestNoteOnTime
        const beforeRender = () => {
            const bin = this.audioAnalyzer.getByteFrequencyData()
            for (let i = 0; i < bin.length; i++) {
                if (0 < bin[i]) {
                    this.earliestNoteWasHeard = true
                    this.#startTime += this.#audioContext.currentTime
                    scene.unregisterBeforeRender(beforeRender)
                    this.audioAnalyzerNode.disconnect()
                    console.debug(`start heard at ${this.#audioContext.currentTime}`)
                    console.debug(`start time = ${this.#startTime}`)
                    break
                }
            }
        }

        scene.registerBeforeRender(beforeRender)
    }

    public earliestNoteWasHeard = false
    private earliestNoteOnTime: number = 0
    private audioAnalyzer: BABYLON.Analyser = null
    private get audioAnalyzerNode() {
        return (<any>this.audioAnalyzer)._webAudioAnalyser
    }
}

//#endregion

class AudioEngine {
    constructor(audioContext) {
        this.audioContext = audioContext
        this.csound = new Csound(audioContext, this.readyObservable)
        this.csound.onAudioEngineUnlocked()
        csound = this.csound
    }

    public set earliestNoteOnTime(value: number) {
        this.csound.earliestNoteOnTime = value
    }

    onCameraMatrixChanged = (matrix: BABYLON.Matrix): void => {
        return csound.onCameraMatrixChanged(matrix)
    }

    public get sequenceTime(): number {
        return this.csound.earliestNoteWasHeard ? this.audioContext.currentTime - this.csound.startTime : 0
    }

    public readyObservable = new BABYLON.Observable<void>()

    public pause = () => {
        this.csound.pause()
    }

    public resume = () => {
        this.csound.resume()
    }

    private audioContext = null
    private csound = null
}

global.AUDIO = {
    Engine: AudioEngine
}
