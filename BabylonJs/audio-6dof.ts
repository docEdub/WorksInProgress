import * as CSOUND from "./@doc.e.dub/csound-browser"

import csdText from "./project.csd"

declare global {
    interface Document {
        Csound: CSOUND.Csound
    }

    const SHARED: any
}

//#region class Csound

class Csound {
    constructor(audioContext) {
        this.#audioContext = audioContext
        this.#csdText = csdText

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

    get #latency() {
        return this.#audioContext.baseLatency + this.#ioBufferSize / this.#audioContext.sampleRate
    }

    #startTime = 0
    get startTime() { return this.#startTime }

    #restartCount = 0
    get restartCount() { return this.#restartCount }

    _updateCameraMatrixTimer = null

    #startUpdatingCameraMatrix = () => {
        // camera.matrixIsDirty = true
        // this._updateCameraMatrixTimer = setInterval(() => {
        //     if (!this.isStarted) {
        //         return
        //     }
        //     if (camera.matrixIsDirty && camera.matrix) {
        //         console.debug('Setting Csound listener position to ['
        //             + camera.matrix[12] + ', '
        //             + camera.matrix[13] + ', '
        //             + camera.matrix[14] + ']')
        //         this.#csoundObj.tableCopyIn("1", camera.matrix)
        //         camera.matrixIsDirty = false
        //     }
        // }, camera.matrixMillisecondsPerUpdate)
    }

    #stopUpdatingCameraMatrix = () => {
        if (this._updateCameraMatrixTimer === null) return
        clearInterval(this._updateCameraMatrixTimer)
    }

    #onImportScriptDone = async () => {
        this.#isLoaded = true
        await this.#startIfRequested()
    }

    #consoleLog = function() {
        AudioEngine.instance.csound.onLogMessage(console, arguments)
    }

    start = async () => {
        if (this.isStarted) return
        this.#startWasRequested = true
        if (!this.audioEngineIsUnlocked) return
        if (!this.isLoaded) return

        console.debug('Starting Csound playback ...')

        this.#startUpdatingCameraMatrix()

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

        // document.latency = audioContext.baseLatency + this.ioBufferSize / audioContext.sampleRate
        // console.debug('Latency =', document.latency)
        console.debug('Csound csd compile succeeded')
        console.debug('Csound starting ...')
        csound.start()
        this.#isStarted = true
        this.volume = 1

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
        this.#stopUpdatingCameraMatrix()
        await this.#csoundObj.stop()
        this.#playbackIsStarted = false
        this.#isStarted = false
        console.log = this.#previousConsoleLog

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
        await this.stop()
        await this.start()
        console.debug('Restarting Csound - done')
        this.#restartCount++
        console.debug('Restart count =', this.restartCount)
    }

    get adjustedAudioContextTime() {
        return this.#audioContext.currentTime - (3 * this.#latency)
    }

    onLogMessage = (console, args) => {
        if (args[0].startsWith('csd:started')) {
            const scoreTime = Number(args[0].split(' at ')[1])
            this.#startTime = this.adjustedAudioContextTime - scoreTime
            this.#playbackIsStarted = true
            console.debug('Playback start message received')
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
        else if (AudioEngine.instance.csound.logMessages) {
            this.#previousConsoleLog.apply(console, args)
        }
    }
}

//#endregion

class AudioEngine {
    static instance = null

    constructor(audioContext) {
        AudioEngine.instance = this
        this.csound = new Csound(audioContext)
        this.csound.onAudioEngineUnlocked()
    }

    csound = null
}

global.AUDIO = {
    Engine: AudioEngine
}
