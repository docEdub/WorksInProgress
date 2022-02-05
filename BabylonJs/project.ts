import * as BABYLON from "babylonjs"
import * as CSOUND from "./@doc.e.dub/csound-browser"

declare global {
    interface Document {
        audioContext: AudioContext
        Csound: CSOUND.Csound
        latency: number
        isProduction: boolean // If `falsey` then we're running in the playground.
    }
}

document.isProduction = true

// var ConsoleLogHTML = require('console-log-html')
// ConsoleLogHTML.connect(document.getElementById('ConsoleOutput'), {}, false, false, false)

class Playground { public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
    class Csound {
        constructor(csdText) {
            this.#csdText = csdText

            if (document.getElementById('csound-script') === null) {
                let csoundImportScript = document.createElement('script')
                csoundImportScript.type = 'module'
                if (document.isProduction) {
                    csoundImportScript.innerText = `
                        console.debug("Csound importing ...");
                        import { Csound } from "https://unpkg.com/@csound/browser@6.17.0-beta2/dist/csound.js";
                        document.Csound = Csound;
                    `
                }
                else {
                    // Csound WASM 6.17.0-beta2 doesn't work in BabylonJS playground. Use old version.
                    csoundImportScript.innerText = `
                        console.debug("Csound importing ...");
                        import { Csound } from "https://unpkg.com/@doc.e.dub/csound-browser@6.17.0-beta5/dist/csound.esm.js";
                        document.Csound = Csound;
                    `
                }
                // csoundImportScript.innerText = `
                //     console.debug("Csound importing ...");
                //     import { Csound } from "./csound.js";
                //     document.Csound = Csound;
                // `
                document.body.appendChild(csoundImportScript)
            }

            const importScriptTimer = setInterval(() => {
                if (!!document.Csound) {
                    console.debug('Csound importing - done')
                    clearInterval(importScriptTimer)
                    this.#onImportScriptDone()
                }
            })
        }

        onAudioEngineUnlocked = () => {
            document.audioContext.resume()
            this.#audioEngineIsUnlocked = true
            console.debug('Audio engine unlocked')
            this.#generateJsonIfRequested()
            this.#startIfRequested()
        }

        //#region Options

        #cameraMatrixUpdatesPerSecond = 10
        get cameraMatrixUpdatesPerSecond() { return this.#cameraMatrixUpdatesPerSecond }
        set cameraMatrixUpdatesPerSecond(value) { this.#cameraMatrixUpdatesPerSecond = value }
        get cameraMatrixMillisecondsPerUpdate() { return 1000 / this.cameraMatrixUpdatesPerSecond }

        #jsonGenerationSampleRate = 30
        get jsonGenerationSampleRate() { return this.#jsonGenerationSampleRate }

        #ioBufferSize = 128
        get ioBufferSize() { return this.#ioBufferSize }
        set ioBufferSize(value) { this.#ioBufferSize = value }

        #logMessages = true
        get logMessages() { return this.#logMessages }
        set logMessages(value) { this.#logMessages = value }

        //#endregion

        #csdText = null
        get csdText() { return this.#csdText }

        #isGeneratingJson = false
        get isGeneratingJson() { return this.#isGeneratingJson }

        #json = null
        get json() { return this.#json }
        get jsonIsGenerated() { return this.#json != null }

        #previousConsoleLog = null

        #csoundObj = null

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

        #startTime = 0
        get startTime() { return this.#startTime }
        set startTime(value) { this.#startTime = value }

        #restartCount = 0
        get restartCount() { return this.#restartCount }

        //#region Camera matrix

        #cameraMatrix = null
        set cameraMatrix(value) {
            if (this.#cameraMatrix != null && !this.cameraMatrixIsDirty) {
                for (let i = 0; i < 16; i++) {
                    if (0.01 < Math.abs(value[i] - this.#cameraMatrix[i])) {
                        this.#cameraMatrixIsDirty = true
                        break
                    }
                }
            }
            if (this.cameraMatrixIsDirty) {
                this.#cameraMatrix = Array.from(value)
            }
        }

        #cameraMatrixIsDirty = true
        get cameraMatrixIsDirty() { return this.#cameraMatrixIsDirty }

        #startUpdatingCameraMatrix = () => {
            setInterval(() => {
                if (!this.isStarted) {
                    return
                }
                if (this.cameraMatrixIsDirty) {
                    console.debug('Setting Csound listener position to ['
                        + this.#cameraMatrix[12] + ', '
                        + this.#cameraMatrix[13] + ', '
                        + this.#cameraMatrix[14] + ']')
                    this.#csoundObj.tableCopyIn("1", this.#cameraMatrix)
                    this.#cameraMatrixIsDirty = false
                }
            }, this.cameraMatrixMillisecondsPerUpdate)
        }

        //#endregion

        #onImportScriptDone = async () => {
            this.#isLoaded = true
            await this.#generateJsonIfRequested()
            await this.#startIfRequested()
        }

        #consoleLog = function() {
            csound.onLogMessage(console, arguments)
        }

        #generateJson = async () => {
            if (this.jsonIsGenerated) return
            console.debug('Generating JSON ...')
            this.#isGeneratingJson = true

            const maxDurationInMinutes = 5
            let offlineAudioContext = new OfflineAudioContext(2, 48000 * maxDurationInMinutes * 60, 48000)

            this.#previousConsoleLog = console.log
            console.log = this.#consoleLog

            let offlineCsoundObj = await document.Csound({
                audioContext: offlineAudioContext
            })

            console.log = this.#previousConsoleLog

            // TODO: Fix JSON generation in Csound files and uncomment the following lines.
            await offlineCsoundObj.setOption('--omacro:IS_GENERATING_JSON=1')
            await offlineCsoundObj.setOption('--smacro:IS_GENERATING_JSON=1')
            await offlineCsoundObj.setOption('--sample-rate=' + this.jsonGenerationSampleRate)
            await offlineCsoundObj.setOption('--control-rate=' + this.jsonGenerationSampleRate)
            const result = await offlineCsoundObj.compileCsdText(this.csdText)
            if (result != 0) {
                console.debug('Csound compile failed')
                this.#isGeneratingJson = false
                return
            }
            console.debug(`Rendering Csound score ...`)
            offlineCsoundObj.start()
            await offlineAudioContext.startRendering()

            this.#isGeneratingJson = false
            console.debug(`Rendering Csound score - done`)
            console.debug('Generating JSON - done')
        }

        #generateJsonIfRequested = async() => {
            if (this.#jsonGenerationWasRequested) {
                await this.#generateJson()
            }
        }

        start = async () => {
            if (this.isStarted) return
            this.#startWasRequested = true
            if (!this.audioEngineIsUnlocked) return
            if (!this.isLoaded) return

            await this.#generateJson()
			return
            console.debug('Starting Csound playback ...')

            this.#startUpdatingCameraMatrix()

            this.#previousConsoleLog = console.log
            console.log = this.#consoleLog
            this.#csoundObj = await document.Csound({
                audioContext:
                    detectedBrowser === 'Safari'
                        ? document.audioContext
                        : new AudioContext({
                            latencyHint: 0.08533333333333333,
                            sampleRate: 48000
                        }),
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
            document.audioContext = audioContext
    
            if (audioContext.sampleRate != 48000) {
                console.log('Sample restricted to 48000')
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

            console.debug('Starting Csound playback - done')
        }

        #startIfRequested = async () => {
            if (this.#startWasRequested) {
                await this.start()
            }
        }

        #restart = async () => {
            console.debug('Restarting Csound ...')
            this.#playbackIsStarted = false
            await this.#csoundObj.rewindScore()
            console.debug('Restarting Csound - done')
            this.#restartCount++
            console.debug('Restart count =', this.restartCount)
        }

        onLogMessage = (console, args) => {
            if (this.#isGeneratingJson && args[0].startsWith("{\"csJSON\":{")) {
				// console.debug(args[0])
				// const object = JSON.parse(args[0])
				// console.debug(object.csJson)
			}

            // The latest version of Csound WASM is logging the entire csdText contents several times when starting.
            // This filters those messages out.
            if (args[0].startsWith('\n<CsoundSynthesizer>\n<CsOptions>\n')) {
                return
            }
			if (!this.isGeneratingJson) {
				if (args[0] === 'csd:started') {
					this.#startTime = document.audioContext.currentTime - (4 - 3 * document.latency)
					this.#playbackIsStarted = true
					console.debug('Playback start message received')
				}
				else if (args[0] === 'csd:ended') {
					console.debug('Playback end message received')
					this.#restart()
				}
				else if (csound.logMessages) {
					this.#previousConsoleLog.apply(console, args)
				}
			}
        }
    }
    let csound = null

    // The BabylonJS playground adds the materials extension to BABYLON.
    // Uncomment this when copy/pasting to the BabylonJS playground.
    if (!document.isProduction && !BABYLON_MATERIALS)
        var BABYLON_MATERIALS = BABYLON

    const showBabylonInspector = false
    const logDebugMessages = true
    const showGroundGrid = true

    let animateCamera = false
    const slowCameraSpeed = 0.25
    const fastCameraSpeed = 1.5
    const groundSize = 9000
    const groundRingDiameter = 100

    const halfGroundSize = groundSize / 2

    document.audioContext = BABYLON.Engine.audioEngine.audioContext
    BABYLON.Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => { csound.onAudioEngineUnlocked() })
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

    function browser() {
        // Get the user-agent string
        const userAgent = navigator.userAgent
        console.debug('userAgent =', userAgent)
        if (userAgent.indexOf('MSIE') > -1) {
            return 'Explorer'
        }
        if (userAgent.indexOf('Firefox') > -1) {
            return 'Firefox'
        }
        if (userAgent.indexOf('Chrome') > -1) {
            if (userAgent.indexOf('OP') > -1) {
                return 'Opera'
            }
            else {
                return 'Chrome'
            }
        }
        if (userAgent.indexOf('Safari') > -1) {
            return 'Safari'
        }
        return 'Unknown'
    }
    const detectedBrowser = browser()
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
    var scene = new BABYLON.Scene(engine)
    if (showBabylonInspector) {
        scene.debugLayer.show()
    }

    const skyBrightness = 0.05
    scene.clearColor.set(skyBrightness, skyBrightness, skyBrightness, 1)

    const cameraHeight = 2
    const cameraSettings = [
        // 0
        { position: new BABYLON.Vector3(0, cameraHeight, -10), target: new BABYLON.Vector3(0, cameraHeight, 0) },
        // 1
        { position: new BABYLON.Vector3(500, cameraHeight, 500), target: new BABYLON.Vector3(-50, 300, 0) },
        // 2
        { position: new BABYLON.Vector3(halfGroundSize, cameraHeight, halfGroundSize), target: new BABYLON.Vector3(-50, 300, 0) },
        // 3
        { position: new BABYLON.Vector3(-halfGroundSize, cameraHeight, -halfGroundSize), target: new BABYLON.Vector3(-50, 300, 0) },
        // 4
        { position: new BABYLON.Vector3(-80, cameraHeight, 800), target: new BABYLON.Vector3(0, 200, 0) },
        // 5
        { position: new BABYLON.Vector3(-40, cameraHeight, 400), target: new BABYLON.Vector3(225, 180, 0) },
        // 6
        { position: new BABYLON.Vector3(0, cameraHeight, -100), target: new BABYLON.Vector3(0, 180, 0) },
        // 7: Safari mixdown location.
        { position: new BABYLON.Vector3(0, cameraHeight, 335), target: new BABYLON.Vector3(0, 135, 0) }
    ]
    const cameraSetting = cameraSettings[0]

    let camera = new BABYLON.FreeCamera('', cameraSetting.position, scene)
    camera.applyGravity = true
    camera.checkCollisions = true
    camera.ellipsoid = new BABYLON.Vector3(0.5, cameraHeight / 2, 0.5)
    camera.speed = slowCameraSpeed
    camera.attachControl(canvas, true)
    camera.setTarget(cameraSetting.target)

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

    const whiteColor = BABYLON.Color3.White()
    const grayColor = new BABYLON.Color3(0.2, 0.2, 0.2)

    const whiteMaterial = new BABYLON.StandardMaterial('', scene)
    whiteMaterial.emissiveColor = whiteColor
    whiteMaterial.disableLighting = true
    whiteMaterial.freeze()

    const grayMaterial = new BABYLON.StandardMaterial('', scene)
    grayMaterial.emissiveColor = grayColor
    grayMaterial.disableLighting = true
    grayMaterial.freeze()

    const blackMaterial = new BABYLON.StandardMaterial('', scene)
    grayMaterial.disableLighting = true
    grayMaterial.freeze()

    { // Walls

        const wall = BABYLON.MeshBuilder.CreatePlane('', {
            size: groundSize
        })
        wall.isVisible = false
        wall.position.y = halfGroundSize

        const northWall = wall.createInstance('')
        northWall.checkCollisions = true
        northWall.isVisible = false
        northWall.position.z = halfGroundSize + 0.1

        const eastWall = wall.createInstance('')
        eastWall.checkCollisions = true
        eastWall.isVisible = false
        eastWall.position.x = halfGroundSize + 0.1
        eastWall.rotation.y = Math.PI / 2

        const southWall = wall.createInstance('')
        southWall.checkCollisions = true
        southWall.isVisible = false
        southWall.position.z = -halfGroundSize - 0.1
        southWall.rotation.y = Math.PI

        const westWall = wall.createInstance('')
        westWall.checkCollisions = true
        westWall.isVisible = false
        westWall.position.x = -halfGroundSize - 0.1
        westWall.rotation.y = -Math.PI / 2

    }

    const ground = BABYLON.MeshBuilder.CreatePlane('', {
        size: groundSize
    })
    ground.rotation.set(Math.PI / 2, 0, 0)
    ground.checkCollisions = true

    if (showGroundGrid) {
        const grid_Texture = createSvgTexture(`
            <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
                <line x1="0%" y1="0%" x2="100%" y2="0%"/>
                <line x1="0%" y1="50%" x2="100%" y2="50%"/>
                <line x1="0%" y1="100%" x2="100%" y2="100%"/>

                <line x1="0%" y1="50%" x2="25%" y2="0%"/>
                <line x1="25%" y1="0%" x2="50%" y2="50%"/>
                <line x1="50%" y1="50%" x2="75%" y2="0%"/>
                <line x1="75%" y1="0%" x2="100%" y2="50%"/>

                <line x1="0%" y1="50%" x2="25%" y2="100%"/>
                <line x1="25%" y1="100%" x2="50%" y2="50%"/>
                <line x1="50%" y1="50%" x2="75%" y2="100%"/>
                <line x1="75%" y1="100%" x2="100%" y2="50%"/>

                <style>
                    line {
                        fill: none;
                        stroke: white;
                        stroke-width: 4;
                    }
                </style>
            </svg>
        `)
        grid_Texture.uScale = grid_Texture.vScale = groundSize / 2
        const gridMaterial = new BABYLON.StandardMaterial('', scene)
        gridMaterial.emissiveColor.set(0.333, 0.333, 0.333)
        gridMaterial.ambientTexture = grid_Texture
        // gridMaterial.opacityTexture = grid_Texture
        gridMaterial.disableLighting = true
        ground.material = gridMaterial
    }
    else {
        ground.material = blackMaterial
    }
    
    // This gets updated when switching between flat-screen camera and XR camera.
    let currentCamera = camera

    const startXr = async () => {
        try {
            const xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [ ground ]})
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
    startXr()

    let startTime = 0

    const startAudioVisuals = () => {
        let csdData = null //JSON.parse(csdJson)
        // console.debug('csdData =', csdData)

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Camera animation.
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const cameraRadiusMax = 400
        let cameraSpeed = 4000
        let cameraTargetY = 100
        let cameraTarget = new BABYLON.Vector3(0, cameraTargetY, -50)
        let cameraTargetIsUserDefined = false
        let cameraRadius = 65
        let cameraRadiusX = -1
        let cameraAngle = Math.PI

        const updateCamera = (time) => {
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
                    return true
                }
            }
            for (let i = 0; i < camera.keysDownward.length; i++) {
                if (key == camera.keysDown[i]) {
                    return true
                }
            }
            for (let i = 0; i < camera.keysLeft.length; i++) {
                if (key == camera.keysLeft[i]) {
                    return true
                }
            }
            for (let i = 0; i < camera.keysRight.length; i++) {
                if (key == camera.keysRight[i]) {
                    return true
                }
            }
            for (let i = 0; i < camera.keysUp.length; i++) {
                if (key == camera.keysUp[i]) {
                    return true
                }
            }
            for (let i = 0; i < camera.keysUpward.length; i++) {
                if (key == camera.keysUpward[i]) {
                    return true
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
                return
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
            if (!csound.isStarted) {
                updateCamera(0)
                return
            }

            const time = document.audioContext.currentTime - startTime
            updateCamera(time)
        })
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
	sr = 48000
	kr = 200
	nchnls = $OUTPUT_CHANNEL_COUNT
	0dbfs = 1
	#define INSTANCE_NAME #"TestSynth playback"#
	#ifndef CSD_FILE_PATH
	#define CSD_FILE_PATH #"undefined"#
	#end
	#ifndef INSTANCE_NAME
	#define INSTANCE_NAME #""#
	#end
	gS_csdFileName = "undefined"
	gS_csdFilePath = $CSD_FILE_PATH
	gS_instanceName = $INSTANCE_NAME
	giKR init kr
	giSecondsPerKPass init 1 / kr
	giSecondsPerSample init 1 / sr
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
	opcode string_escape_k, S, S
	SUnescaped xin
	SEscaped = sprintfk("%s", "")
	kiStart = 0
	kiCurrent = 0
	kMessageLength = strlenk(SUnescaped)
	while (kiCurrent < kMessageLength) do
	if (strchark(SUnescaped, kiCurrent) == 34) then
	if (kiCurrent > 0) then
	SEscaped = strcatk(SEscaped, strsubk(SUnescaped, kiStart, kiCurrent))
	SEscaped = strcatk(SEscaped, "\\\\\\"")
	else
	SEscaped = strcatk(SEscaped, "\\\\\\"")
	endif
	kiStart = kiCurrent + 1
	endif
	kiCurrent += 1
	od
	if (kiStart < kiCurrent) then
	SEscaped = strcatk(SEscaped, strsubk(SUnescaped, kiStart, kiCurrent + 1))
	endif
	xout SEscaped
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
	0, 0, 0, 1, 1, 1,
	.052336, .034899, .017452, .999848, .999391, .99863,
	.104528, .069756, .034899, .999391, .997564, .994522,
	.156434, .104528, .052336, .99863, .994522, .987688,
	.207912, .139173, .069756, .997564, .990268, .978148,
	.258819, .173648, .087156, .996195, .984808, .965926,
	.309017, .207912, .104528, .994522, .978148, .951057,
	.358368, .241922, .121869, .992546, .970296, .93358,
	.406737, .275637, .139173, .990268, .961262, .913545,
	.45399, .309017, .156434, .987688, .951057, .891007,
	.5, .34202, .173648, .984808, .939693, .866025,
	.544639, .374607, .190809, .981627, .927184, .838671,
	.587785, .406737, .207912, .978148, .913545, .809017,
	.62932, .438371, .224951, .97437, .898794, .777146,
	.669131, .469472, .241922, .970296, .882948, .743145,
	.707107, .5, .258819, .965926, .866025, .707107,
	.743145, .529919, .275637, .961262, .848048, .669131,
	.777146, .559193, .292372, .956305, .829038, .62932,
	.809017, .587785, .309017, .951057, .809017, .587785,
	.838671, .615661, .325568, .945519, .788011, .544639,
	.866025, .642788, .34202, .939693, .766044, .5,
	.891007, .669131, .358368, .93358, .743145, .45399,
	.913545, .694658, .374607, .927184, .71934, .406737,
	.93358, .71934, .390731, .920505, .694658, .358368,
	.951057, .743145, .406737, .913545, .669131, .309017,
	.965926, .766044, .422618, .906308, .642788, .258819,
	.978148, .788011, .438371, .898794, .615661, .207912,
	.987688, .809017, .45399, .891007, .587785, .156434,
	.994522, .829038, .469472, .882948, .559193, .104528,
	.99863, .848048, .48481, .87462, .529919, .052336,
	1, .866025, .5, .866025, .5, 0,
	.99863, .882948, .515038, .857167, .469472, -.052336,
	.994522, .898794, .529919, .848048, .438371, -.104528,
	.987688, .913545, .544639, .838671, .406737, -.156434,
	.978148, .927184, .559193, .829038, .374607, -.207912,
	.965926, .939693, .573576, .819152, .34202, -.258819,
	.951057, .951057, .587785, .809017, .309017, -.309017,
	.93358, .961262, .601815, .798636, .275637, -.358368,
	.913545, .970296, .615661, .788011, .241922, -.406737,
	.891007, .978148, .62932, .777146, .207912, -.45399,
	.866025, .984808, .642788, .766044, .173648, -.5,
	.838671, .990268, .656059, .75471, .139173, -.544639,
	.809017, .994522, .669131, .743145, .104528, -.587785,
	.777146, .997564, .681998, .731354, .069756, -.62932,
	.743145, .999391, .694658, .71934, .034899, -.669131,
	.707107, 1, .707107, .707107, 0, -.707107,
	.669131, .999391, .71934, .694658, -.034899, -.743145,
	.62932, .997564, .731354, .681998, -.069756, -.777146,
	.587785, .994522, .743145, .669131, -.104528, -.809017,
	.544639, .990268, .75471, .656059, -.139173, -.838671,
	.5, .984808, .766044, .642788, -.173648, -.866025,
	.45399, .978148, .777146, .62932, -.207912, -.891007,
	.406737, .970296, .788011, .615661, -.241922, -.913545,
	.358368, .961262, .798636, .601815, -.275637, -.93358,
	.309017, .951057, .809017, .587785, -.309017, -.951057,
	.258819, .939693, .819152, .573576, -.34202, -.965926,
	.207912, .927184, .829038, .559193, -.374607, -.978148,
	.156434, .913545, .838671, .544639, -.406737, -.987688,
	.104528, .898794, .848048, .529919, -.438371, -.994522,
	.052336, .882948, .857167, .515038, -.469472, -.99863,
	0, .866025, .866025, .5, -.5, -1,
	-.052336, .848048, .87462, .48481, -.529919, -.99863,
	-.104528, .829038, .882948, .469472, -.559193, -.994522,
	-.156434, .809017, .891007, .45399, -.587785, -.987688,
	-.207912, .788011, .898794, .438371, -.615661, -.978148,
	-.258819, .766044, .906308, .422618, -.642788, -.965926,
	-.309017, .743145, .913545, .406737, -.669131, -.951057,
	-.358368, .71934, .920505, .390731, -.694658, -.93358,
	-.406737, .694658, .927184, .374607, -.71934, -.913545,
	-.45399, .669131, .93358, .358368, -.743145, -.891007,
	-.5, .642788, .939693, .34202, -.766044, -.866025,
	-.544639, .615661, .945519, .325568, -.788011, -.838671,
	-.587785, .587785, .951057, .309017, -.809017, -.809017,
	-.62932, .559193, .956305, .292372, -.829038, -.777146,
	-.669131, .529919, .961262, .275637, -.848048, -.743145,
	-.707107, .5, .965926, .258819, -.866025, -.707107,
	-.743145, .469472, .970296, .241922, -.882948, -.669131,
	-.777146, .438371, .97437, .224951, -.898794, -.62932,
	-.809017, .406737, .978148, .207912, -.913545, -.587785,
	-.838671, .374607, .981627, .190809, -.927184, -.544639,
	-.866025, .34202, .984808, .173648, -.939693, -.5,
	-.891007, .309017, .987688, .156434, -.951057, -.45399,
	-.913545, .275637, .990268, .139173, -.961262, -.406737,
	-.93358, .241922, .992546, .121869, -.970296, -.358368,
	-.951057, .207912, .994522, .104528, -.978148, -.309017,
	-.965926, .173648, .996195, .087156, -.984808, -.258819,
	-.978148, .139173, .997564, .069756, -.990268, -.207912,
	-.987688, .104528, .99863, .052336, -.994522, -.156434,
	-.994522, .069756, .999391, .034899, -.997564, -.104528,
	-.99863, .034899, .999848, .017452, -.999391, -.052336,
	-1, 0, 1, 0, -1, 0,
	-.99863, -.034899, .999848, -.017452, -.999391, .052336,
	-.994522, -.069756, .999391, -.034899, -.997564, .104528,
	-.987688, -.104528, .99863, -.052336, -.994522, .156434,
	-.978148, -.139173, .997564, -.069756, -.990268, .207912,
	-.965926, -.173648, .996195, -.087156, -.984808, .258819,
	-.951057, -.207912, .994522, -.104528, -.978148, .309017,
	-.93358, -.241922, .992546, -.121869, -.970296, .358368,
	-.913545, -.275637, .990268, -.139173, -.961262, .406737,
	-.891007, -.309017, .987688, -.156434, -.951057, .45399,
	-.866025, -.34202, .984808, -.173648, -.939693, .5,
	-.838671, -.374607, .981627, -.190809, -.927184, .544639,
	-.809017, -.406737, .978148, -.207912, -.913545, .587785,
	-.777146, -.438371, .97437, -.224951, -.898794, .62932,
	-.743145, -.469472, .970296, -.241922, -.882948, .669131,
	-.707107, -.5, .965926, -.258819, -.866025, .707107,
	-.669131, -.529919, .961262, -.275637, -.848048, .743145,
	-.62932, -.559193, .956305, -.292372, -.829038, .777146,
	-.587785, -.587785, .951057, -.309017, -.809017, .809017,
	-.544639, -.615661, .945519, -.325568, -.788011, .838671,
	-.5, -.642788, .939693, -.34202, -.766044, .866025,
	-.45399, -.669131, .93358, -.358368, -.743145, .891007,
	-.406737, -.694658, .927184, -.374607, -.71934, .913545,
	-.358368, -.71934, .920505, -.390731, -.694658, .93358,
	-.309017, -.743145, .913545, -.406737, -.669131, .951057,
	-.258819, -.766044, .906308, -.422618, -.642788, .965926,
	-.207912, -.788011, .898794, -.438371, -.615661, .978148,
	-.156434, -.809017, .891007, -.45399, -.587785, .987688,
	-.104528, -.829038, .882948, -.469472, -.559193, .994522,
	-.052336, -.848048, .87462, -.48481, -.529919, .99863,
	0, -.866025, .866025, -.5, -.5, 1,
	.052336, -.882948, .857167, -.515038, -.469472, .99863,
	.104528, -.898794, .848048, -.529919, -.438371, .994522,
	.156434, -.913545, .838671, -.544639, -.406737, .987688,
	.207912, -.927184, .829038, -.559193, -.374607, .978148,
	.258819, -.939693, .819152, -.573576, -.34202, .965926,
	.309017, -.951057, .809017, -.587785, -.309017, .951057,
	.358368, -.961262, .798636, -.601815, -.275637, .93358,
	.406737, -.970296, .788011, -.615661, -.241922, .913545,
	.45399, -.978148, .777146, -.62932, -.207912, .891007,
	.5, -.984808, .766044, -.642788, -.173648, .866025,
	.544639, -.990268, .75471, -.656059, -.139173, .838671,
	.587785, -.994522, .743145, -.669131, -.104528, .809017,
	.62932, -.997564, .731354, -.681998, -.069756, .777146,
	.669131, -.999391, .71934, -.694658, -.034899, .743145,
	.707107, -1, .707107, -.707107, 0, .707107,
	.743145, -.999391, .694658, -.71934, .034899, .669131,
	.777146, -.997564, .681998, -.731354, .069756, .62932,
	.809017, -.994522, .669131, -.743145, .104528, .587785,
	.838671, -.990268, .656059, -.75471, .139173, .544639,
	.866025, -.984808, .642788, -.766044, .173648, .5,
	.891007, -.978148, .62932, -.777146, .207912, .45399,
	.913545, -.970296, .615661, -.788011, .241922, .406737,
	.93358, -.961262, .601815, -.798636, .275637, .358368,
	.951057, -.951057, .587785, -.809017, .309017, .309017,
	.965926, -.939693, .573576, -.819152, .34202, .258819,
	.978148, -.927184, .559193, -.829038, .374607, .207912,
	.987688, -.913545, .544639, -.838671, .406737, .156434,
	.994522, -.898794, .529919, -.848048, .438371, .104528,
	.99863, -.882948, .515038, -.857167, .469472, .052336,
	1, -.866025, .5, -.866025, .5, 0,
	.99863, -.848048, .48481, -.87462, .529919, -.052336,
	.994522, -.829038, .469472, -.882948, .559193, -.104528,
	.987688, -.809017, .45399, -.891007, .587785, -.156434,
	.978148, -.788011, .438371, -.898794, .615661, -.207912,
	.965926, -.766044, .422618, -.906308, .642788, -.258819,
	.951057, -.743145, .406737, -.913545, .669131, -.309017,
	.93358, -.71934, .390731, -.920505, .694658, -.358368,
	.913545, -.694658, .374607, -.927184, .71934, -.406737,
	.891007, -.669131, .358368, -.93358, .743145, -.45399,
	.866025, -.642788, .34202, -.939693, .766044, -.5,
	.838671, -.615661, .325568, -.945519, .788011, -.544639,
	.809017, -.587785, .309017, -.951057, .809017, -.587785,
	.777146, -.559193, .292372, -.956305, .829038, -.62932,
	.743145, -.529919, .275637, -.961262, .848048, -.669131,
	.707107, -.5, .258819, -.965926, .866025, -.707107,
	.669131, -.469472, .241922, -.970296, .882948, -.743145,
	.62932, -.438371, .224951, -.97437, .898794, -.777146,
	.587785, -.406737, .207912, -.978148, .913545, -.809017,
	.544639, -.374607, .190809, -.981627, .927184, -.838671,
	.5, -.34202, .173648, -.984808, .939693, -.866025,
	.45399, -.309017, .156434, -.987688, .951057, -.891007,
	.406737, -.275637, .139173, -.990268, .961262, -.913545,
	.358368, -.241922, .121869, -.992546, .970296, -.93358,
	.309017, -.207912, .104528, -.994522, .978148, -.951057,
	.258819, -.173648, .087156, -.996195, .984808, -.965926,
	.207912, -.139173, .069756, -.997564, .990268, -.978148,
	.156434, -.104528, .052336, -.99863, .994522, -.987688,
	.104528, -.069756, .034899, -.999391, .997564, -.994522,
	.052336, -.034899, .017452, -.999848, .999391, -.99863
	gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_180_359 fillarray \\
	0, 0, 0, -1, 1, -1,
	-.052336, .034899, -.017452, -.999848, .999391, -.99863,
	-.104528, .069756, -.034899, -.999391, .997564, -.994522,
	-.156434, .104528, -.052336, -.99863, .994522, -.987688,
	-.207912, .139173, -.069756, -.997564, .990268, -.978148,
	-.258819, .173648, -.087156, -.996195, .984808, -.965926,
	-.309017, .207912, -.104528, -.994522, .978148, -.951057,
	-.358368, .241922, -.121869, -.992546, .970296, -.93358,
	-.406737, .275637, -.139173, -.990268, .961262, -.913545,
	-.45399, .309017, -.156434, -.987688, .951057, -.891007,
	-.5, .34202, -.173648, -.984808, .939693, -.866025,
	-.544639, .374607, -.190809, -.981627, .927184, -.838671,
	-.587785, .406737, -.207912, -.978148, .913545, -.809017,
	-.62932, .438371, -.224951, -.97437, .898794, -.777146,
	-.669131, .469472, -.241922, -.970296, .882948, -.743145,
	-.707107, .5, -.258819, -.965926, .866025, -.707107,
	-.743145, .529919, -.275637, -.961262, .848048, -.669131,
	-.777146, .559193, -.292372, -.956305, .829038, -.62932,
	-.809017, .587785, -.309017, -.951057, .809017, -.587785,
	-.838671, .615661, -.325568, -.945519, .788011, -.544639,
	-.866025, .642788, -.34202, -.939693, .766044, -.5,
	-.891007, .669131, -.358368, -.93358, .743145, -.45399,
	-.913545, .694658, -.374607, -.927184, .71934, -.406737,
	-.93358, .71934, -.390731, -.920505, .694658, -.358368,
	-.951057, .743145, -.406737, -.913545, .669131, -.309017,
	-.965926, .766044, -.422618, -.906308, .642788, -.258819,
	-.978148, .788011, -.438371, -.898794, .615661, -.207912,
	-.987688, .809017, -.45399, -.891007, .587785, -.156434,
	-.994522, .829038, -.469472, -.882948, .559193, -.104528,
	-.99863, .848048, -.48481, -.87462, .529919, -.052336,
	-1, .866025, -.5, -.866025, .5, 0,
	-.99863, .882948, -.515038, -.857167, .469472, .052336,
	-.994522, .898794, -.529919, -.848048, .438371, .104528,
	-.987688, .913545, -.544639, -.838671, .406737, .156434,
	-.978148, .927184, -.559193, -.829038, .374607, .207912,
	-.965926, .939693, -.573576, -.819152, .34202, .258819,
	-.951057, .951057, -.587785, -.809017, .309017, .309017,
	-.93358, .961262, -.601815, -.798636, .275637, .358368,
	-.913545, .970296, -.615661, -.788011, .241922, .406737,
	-.891007, .978148, -.62932, -.777146, .207912, .45399,
	-.866025, .984808, -.642788, -.766044, .173648, .5,
	-.838671, .990268, -.656059, -.75471, .139173, .544639,
	-.809017, .994522, -.669131, -.743145, .104528, .587785,
	-.777146, .997564, -.681998, -.731354, .069756, .62932,
	-.743145, .999391, -.694658, -.71934, .034899, .669131,
	-.707107, 1, -.707107, -.707107, 0, .707107,
	-.669131, .999391, -.71934, -.694658, -.034899, .743145,
	-.62932, .997564, -.731354, -.681998, -.069756, .777146,
	-.587785, .994522, -.743145, -.669131, -.104528, .809017,
	-.544639, .990268, -.75471, -.656059, -.139173, .838671,
	-.5, .984808, -.766044, -.642788, -.173648, .866025,
	-.45399, .978148, -.777146, -.62932, -.207912, .891007,
	-.406737, .970296, -.788011, -.615661, -.241922, .913545,
	-.358368, .961262, -.798636, -.601815, -.275637, .93358,
	-.309017, .951057, -.809017, -.587785, -.309017, .951057,
	-.258819, .939693, -.819152, -.573576, -.34202, .965926,
	-.207912, .927184, -.829038, -.559193, -.374607, .978148,
	-.156434, .913545, -.838671, -.544639, -.406737, .987688,
	-.104528, .898794, -.848048, -.529919, -.438371, .994522,
	-.052336, .882948, -.857167, -.515038, -.469472, .99863,
	0, .866025, -.866025, -.5, -.5, 1,
	.052336, .848048, -.87462, -.48481, -.529919, .99863,
	.104528, .829038, -.882948, -.469472, -.559193, .994522,
	.156434, .809017, -.891007, -.45399, -.587785, .987688,
	.207912, .788011, -.898794, -.438371, -.615661, .978148,
	.258819, .766044, -.906308, -.422618, -.642788, .965926,
	.309017, .743145, -.913545, -.406737, -.669131, .951057,
	.358368, .71934, -.920505, -.390731, -.694658, .93358,
	.406737, .694658, -.927184, -.374607, -.71934, .913545,
	.45399, .669131, -.93358, -.358368, -.743145, .891007,
	.5, .642788, -.939693, -.34202, -.766044, .866025,
	.544639, .615661, -.945519, -.325568, -.788011, .838671,
	.587785, .587785, -.951057, -.309017, -.809017, .809017,
	.62932, .559193, -.956305, -.292372, -.829038, .777146,
	.669131, .529919, -.961262, -.275637, -.848048, .743145,
	.707107, .5, -.965926, -.258819, -.866025, .707107,
	.743145, .469472, -.970296, -.241922, -.882948, .669131,
	.777146, .438371, -.97437, -.224951, -.898794, .62932,
	.809017, .406737, -.978148, -.207912, -.913545, .587785,
	.838671, .374607, -.981627, -.190809, -.927184, .544639,
	.866025, .34202, -.984808, -.173648, -.939693, .5,
	.891007, .309017, -.987688, -.156434, -.951057, .45399,
	.913545, .275637, -.990268, -.139173, -.961262, .406737,
	.93358, .241922, -.992546, -.121869, -.970296, .358368,
	.951057, .207912, -.994522, -.104528, -.978148, .309017,
	.965926, .173648, -.996195, -.087156, -.984808, .258819,
	.978148, .139173, -.997564, -.069756, -.990268, .207912,
	.987688, .104528, -.99863, -.052336, -.994522, .156434,
	.994522, .069756, -.999391, -.034899, -.997564, .104528,
	.99863, .034899, -.999848, -.017452, -.999391, .052336,
	1, 0, -1, 0, -1, 0,
	.99863, -.034899, -.999848, .017452, -.999391, -.052336,
	.994522, -.069756, -.999391, .034899, -.997564, -.104528,
	.987688, -.104528, -.99863, .052336, -.994522, -.156434,
	.978148, -.139173, -.997564, .069756, -.990268, -.207912,
	.965926, -.173648, -.996195, .087156, -.984808, -.258819,
	.951057, -.207912, -.994522, .104528, -.978148, -.309017,
	.93358, -.241922, -.992546, .121869, -.970296, -.358368,
	.913545, -.275637, -.990268, .139173, -.961262, -.406737,
	.891007, -.309017, -.987688, .156434, -.951057, -.45399,
	.866025, -.34202, -.984808, .173648, -.939693, -.5,
	.838671, -.374607, -.981627, .190809, -.927184, -.544639,
	.809017, -.406737, -.978148, .207912, -.913545, -.587785,
	.777146, -.438371, -.97437, .224951, -.898794, -.62932,
	.743145, -.469472, -.970296, .241922, -.882948, -.669131,
	.707107, -.5, -.965926, .258819, -.866025, -.707107,
	.669131, -.529919, -.961262, .275637, -.848048, -.743145,
	.62932, -.559193, -.956305, .292372, -.829038, -.777146,
	.587785, -.587785, -.951057, .309017, -.809017, -.809017,
	.544639, -.615661, -.945519, .325568, -.788011, -.838671,
	.5, -.642788, -.939693, .34202, -.766044, -.866025,
	.45399, -.669131, -.93358, .358368, -.743145, -.891007,
	.406737, -.694658, -.927184, .374607, -.71934, -.913545,
	.358368, -.71934, -.920505, .390731, -.694658, -.93358,
	.309017, -.743145, -.913545, .406737, -.669131, -.951057,
	.258819, -.766044, -.906308, .422618, -.642788, -.965926,
	.207912, -.788011, -.898794, .438371, -.615661, -.978148,
	.156434, -.809017, -.891007, .45399, -.587785, -.987688,
	.104528, -.829038, -.882948, .469472, -.559193, -.994522,
	.052336, -.848048, -.87462, .48481, -.529919, -.99863,
	0, -.866025, -.866025, .5, -.5, -1,
	-.052336, -.882948, -.857167, .515038, -.469472, -.99863,
	-.104528, -.898794, -.848048, .529919, -.438371, -.994522,
	-.156434, -.913545, -.838671, .544639, -.406737, -.987688,
	-.207912, -.927184, -.829038, .559193, -.374607, -.978148,
	-.258819, -.939693, -.819152, .573576, -.34202, -.965926,
	-.309017, -.951057, -.809017, .587785, -.309017, -.951057,
	-.358368, -.961262, -.798636, .601815, -.275637, -.93358,
	-.406737, -.970296, -.788011, .615661, -.241922, -.913545,
	-.45399, -.978148, -.777146, .62932, -.207912, -.891007,
	-.5, -.984808, -.766044, .642788, -.173648, -.866025,
	-.544639, -.990268, -.75471, .656059, -.139173, -.838671,
	-.587785, -.994522, -.743145, .669131, -.104528, -.809017,
	-.62932, -.997564, -.731354, .681998, -.069756, -.777146,
	-.669131, -.999391, -.71934, .694658, -.034899, -.743145,
	-.707107, -1, -.707107, .707107, 0, -.707107,
	-.743145, -.999391, -.694658, .71934, .034899, -.669131,
	-.777146, -.997564, -.681998, .731354, .069756, -.62932,
	-.809017, -.994522, -.669131, .743145, .104528, -.587785,
	-.838671, -.990268, -.656059, .75471, .139173, -.544639,
	-.866025, -.984808, -.642788, .766044, .173648, -.5,
	-.891007, -.978148, -.62932, .777146, .207912, -.45399,
	-.913545, -.970296, -.615661, .788011, .241922, -.406737,
	-.93358, -.961262, -.601815, .798636, .275637, -.358368,
	-.951057, -.951057, -.587785, .809017, .309017, -.309017,
	-.965926, -.939693, -.573576, .819152, .34202, -.258819,
	-.978148, -.927184, -.559193, .829038, .374607, -.207912,
	-.987688, -.913545, -.544639, .838671, .406737, -.156434,
	-.994522, -.898794, -.529919, .848048, .438371, -.104528,
	-.99863, -.882948, -.515038, .857167, .469472, -.052336,
	-1, -.866025, -.5, .866025, .5, 0,
	-.99863, -.848048, -.48481, .87462, .529919, .052336,
	-.994522, -.829038, -.469472, .882948, .559193, .104528,
	-.987688, -.809017, -.45399, .891007, .587785, .156434,
	-.978148, -.788011, -.438371, .898794, .615661, .207912,
	-.965926, -.766044, -.422618, .906308, .642788, .258819,
	-.951057, -.743145, -.406737, .913545, .669131, .309017,
	-.93358, -.71934, -.390731, .920505, .694658, .358368,
	-.913545, -.694658, -.374607, .927184, .71934, .406737,
	-.891007, -.669131, -.358368, .93358, .743145, .45399,
	-.866025, -.642788, -.34202, .939693, .766044, .5,
	-.838671, -.615661, -.325568, .945519, .788011, .544639,
	-.809017, -.587785, -.309017, .951057, .809017, .587785,
	-.777146, -.559193, -.292372, .956305, .829038, .62932,
	-.743145, -.529919, -.275637, .961262, .848048, .669131,
	-.707107, -.5, -.258819, .965926, .866025, .707107,
	-.669131, -.469472, -.241922, .970296, .882948, .743145,
	-.62932, -.438371, -.224951, .97437, .898794, .777146,
	-.587785, -.406737, -.207912, .978148, .913545, .809017,
	-.544639, -.374607, -.190809, .981627, .927184, .838671,
	-.5, -.34202, -.173648, .984808, .939693, .866025,
	-.45399, -.309017, -.156434, .987688, .951057, .891007,
	-.406737, -.275637, -.139173, .990268, .961262, .913545,
	-.358368, -.241922, -.121869, .992546, .970296, .93358,
	-.309017, -.207912, -.104528, .994522, .978148, .951057,
	-.258819, -.173648, -.087156, .996195, .984808, .965926,
	-.207912, -.139173, -.069756, .997564, .990268, .978148,
	-.156434, -.104528, -.052336, .99863, .994522, .987688,
	-.104528, -.069756, -.034899, .999391, .997564, .994522,
	-.052336, -.034899, -.017452, .999848, .999391, .99863
	gi_AF_3D_Audio_SphericalHarmonicsElevationLookupTable fillarray \\
	-1, 0, 1, 0, 0, -1, 0, 0, 0,
	-.999848, .017452, .999543, -.030224, .000264, -.999086, .042733, -.00059, .000004,
	-.999391, .034899, .998173, -.060411, .001055, -.996348, .085356, -.002357, .000034,
	-.99863, .052336, .995891, -.090524, .002372, -.991791, .127757, -.005297, .000113,
	-.997564, .069756, .992701, -.120527, .004214, -.985429, .169828, -.0094, .000268,
	-.996195, .087156, .988606, -.150384, .006578, -.977277, .21146, -.014654, .000523,
	-.994522, .104528, .983611, -.180057, .009462, -.967356, .252544, -.021043, .000903,
	-.992546, .121869, .977722, -.209511, .012862, -.955693, .292976, -.028547, .001431,
	-.990268, .139173, .970946, -.238709, .016774, -.942316, .332649, -.037143, .002131,
	-.987688, .156434, .963292, -.267617, .021193, -.927262, .371463, -.046806, .003026,
	-.984808, .173648, .954769, -.296198, .026114, -.910569, .409317, -.057505, .00414,
	-.981627, .190809, .945388, -.324419, .03153, -.892279, .446114, -.069209, .005492,
	-.978148, .207912, .935159, -.352244, .037436, -.872441, .481759, -.08188, .007105,
	-.97437, .224951, .924096, -.379641, .043823, -.851105, .516162, -.095481, .008999,
	-.970296, .241922, .912211, -.406574, .050685, -.828326, .549233, -.109969, .011193,
	-.965926, .258819, .899519, -.433013, .058013, -.804164, .580889, -.1253, .013707,
	-.961262, .275637, .886036, -.458924, .065797, -.77868, .61105, -.141427, .016556,
	-.956305, .292372, .871778, -.484275, .074029, -.75194, .639639, -.158301, .019758,
	-.951057, .309017, .856763, -.509037, .082698, -.724012, .666583, -.175868, .023329,
	-.945519, .325568, .841008, -.533178, .091794, -.694969, .691816, -.194075, .027281,
	-.939693, .34202, .824533, -.55667, .101306, -.664885, .715274, -.212865, .03163,
	-.93358, .358368, .807359, -.579484, .111222, -.633837, .736898, -.23218, .036385,
	-.927184, .374607, .789505, -.601592, .121529, -.601904, .756637, -.25196, .041559,
	-.920505, .390731, .770994, -.622967, .132217, -.569169, .774442, -.272143, .04716,
	-.913545, .406737, .751848, -.643582, .143271, -.535715, .79027, -.292666, .053196,
	-.906308, .422618, .732091, -.663414, .154678, -.501627, .804083, -.313464, .059674,
	-.898794, .438371, .711746, -.682437, .166423, -.466993, .81585, -.334472, .066599,
	-.891007, .45399, .690839, -.700629, .178494, -.431899, .825544, -.355623, .073974,
	-.882948, .469472, .669395, -.717968, .190875, -.396436, .833145, -.376851, .081803,
	-.87462, .48481, .647439, -.734431, .203551, -.360692, .838638, -.398086, .090085,
	-.866025, .5, .625, -.75, .216506, -.32476, .842012, -.419263, .098821,
	-.857167, .515038, .602104, -.764655, .229726, -.288728, .843265, -.440311, .108009,
	-.848048, .529919, .578778, -.778378, .243192, -.252688, .842399, -.461164, .117644,
	-.838671, .544639, .555052, -.791154, .256891, -.21673, .839422, -.481753, .127722,
	-.829038, .559193, .530955, -.802965, .270803, -.180944, .834347, -.502011, .138237,
	-.819152, .573576, .506515, -.813798, .284914, -.14542, .827194, -.521871, .149181,
	-.809017, .587785, .481763, -.823639, .299204, -.110246, .817987, -.541266, .160545,
	-.798636, .601815, .456728, -.832477, .313658, -.075508, .806757, -.560132, .172317,
	-.788011, .615661, .431441, -.840301, .328257, -.041294, .793541, -.578405, .184487,
	-.777146, .62932, .405934, -.847101, .342984, -.007686, .778379, -.596021, .19704,
	-.766044, .642788, .380236, -.852869, .357821, .025233, .761319, -.612921, .209963,
	-.75471, .656059, .35438, -.857597, .372749, .057383, .742412, -.629044, .223238,
	-.743145, .669131, .328396, -.861281, .387751, .088686, .721714, -.644334, .23685,
	-.731354, .681998, .302317, -.863916, .402807, .119068, .699288, -.658734, .250778,
	-.71934, .694658, .276175, -.865498, .417901, .148454, .675199, -.67219, .265005,
	-.707107, .707107, .25, -.866025, .433013, .176777, .649519, -.684653, .279508,
	-.694658, .71934, .223825, -.865498, .448125, .203969, .622322, -.696073, .294267,
	-.681998, .731354, .197683, -.863916, .463218, .229967, .593688, -.706405, .309259,
	-.669131, .743145, .171604, -.861281, .478275, .254712, .5637, -.715605, .324459,
	-.656059, .75471, .14562, -.857597, .493276, .278147, .532443, -.723633, .339844,
	-.642788, .766044, .119764, -.852869, .508205, .300221, .500009, -.730451, .355387,
	-.62932, .777146, .094066, -.847101, .523041, .320884, .46649, -.736025, .371063,
	-.615661, .788011, .068559, -.840301, .537768, .340093, .431982, -.740324, .386845,
	-.601815, .798636, .043272, -.832477, .552367, .357807, .396584, -.74332, .402704,
	-.587785, .809017, .018237, -.823639, .566821, .373991, .360397, -.744989, .418613,
	-.573576, .819152, -.006515, -.813798, .581112, .388612, .323524, -.745308, .434544,
	-.559193, .829038, -.030955, -.802965, .595222, .401645, .286069, -.744262, .450467,
	-.544639, .838671, -.055052, -.791154, .609135, .413066, .24814, -.741835, .466352,
	-.529919, .848048, -.078778, -.778378, .622833, .422856, .209843, -.738017, .482171,
	-.515038, .857167, -.102104, -.764655, .6363, .431004, .171288, -.732801, .497894,
	-.5, .866025, -.125, -.75, .649519, .4375, .132583, -.726184, .51349,
	-.48481, .87462, -.147439, -.734431, .662474, .44234, .093837, -.718167, .528929,
	-.469472, .882948, -.169395, -.717968, .67515, .445524, .05516, -.708753, .544183,
	-.45399, .891007, -.190839, -.700629, .687531, .447059, .016662, -.69795, .55922,
	-.438371, .898794, -.211746, -.682437, .699602, .446953, -.02155, -.685769, .574011,
	-.422618, .906308, -.232091, -.663414, .711348, .445222, -.059368, -.672226, .588528,
	-.406737, .913545, -.251848, -.643582, .722755, .441884, -.096684, -.657339, .602741,
	-.390731, .920505, -.270994, -.622967, .733809, .436964, -.133395, -.64113, .616621,
	-.374607, .927184, -.289505, -.601592, .744496, .430488, -.169397, -.623624, .630141,
	-.358368, .93358, -.307359, -.579484, .754804, .422491, -.204589, -.604851, .643273,
	-.34202, .939693, -.324533, -.55667, .76472, .413008, -.238872, -.584843, .65599,
	-.325568, .945519, -.341008, -.533178, .774231, .402081, -.27215, -.563635, .668267,
	-.309017, .951057, -.356763, -.509037, .783327, .389754, -.304329, -.541266, .680078,
	-.292372, .956305, -.371778, -.484275, .791997, .376077, -.335319, -.517778, .691399,
	-.275637, .961262, -.386036, -.458924, .800228, .361102, -.365034, -.493216, .702207,
	-.258819, .965926, -.399519, -.433013, .808013, .344885, -.393389, -.467627, .712478,
	-.241922, .970296, -.412211, -.406574, .81534, .327486, -.420306, -.441061, .722191,
	-.224951, .97437, -.424096, -.379641, .822202, .308969, -.445709, -.413572, .731327,
	-.207912, .978148, -.435159, -.352244, .828589, .289399, -.469527, -.385215, .739866,
	-.190809, .981627, -.445388, -.324419, .834495, .268846, -.491693, -.356047, .74779,
	-.173648, .984808, -.454769, -.296198, .839912, .247382, -.512145, -.326129, .755082,
	-.156434, .987688, -.463292, -.267617, .844832, .225081, -.530827, -.295521, .761728,
	-.139173, .990268, -.470946, -.238709, .849251, .20202, -.547684, -.264287, .767712,
	-.121869, .992546, -.477722, -.209511, .853163, .178279, -.562672, -.232494, .773023,
	-.104528, .994522, -.483611, -.180057, .856563, .153937, -.575747, -.200207, .777648,
	-.087156, .996195, -.488606, -.150384, .859447, .129078, -.586872, -.167494, .781579,
	-.069756, .997564, -.492701, -.120527, .861811, .103786, -.596018, -.134426, .784806,
	-.052336, .99863, -.495891, -.090524, .863653, .078146, -.603158, -.101071, .787324,
	-.034899, .999391, -.498173, -.060411, .864971, .052243, -.608272, -.0675, .789126,
	-.017452, .999848, -.499543, -.030224, .865762, .026165, -.611347, -.033786, .790208,
	0, 1, -.5, 0, .866025, 0, -.612372, 0, .790569,
	.017452, .999848, -.499543, .030224, .865762, -.026165, -.611347, .033786, .790208,
	.034899, .999391, -.498173, .060411, .864971, -.052243, -.608272, .0675, .789126,
	.052336, .99863, -.495891, .090524, .863653, -.078146, -.603158, .101071, .787324,
	.069756, .997564, -.492701, .120527, .861811, -.103786, -.596018, .134426, .784806,
	.087156, .996195, -.488606, .150384, .859447, -.129078, -.586872, .167494, .781579,
	.104528, .994522, -.483611, .180057, .856563, -.153937, -.575747, .200207, .777648,
	.121869, .992546, -.477722, .209511, .853163, -.178279, -.562672, .232494, .773023,
	.139173, .990268, -.470946, .238709, .849251, -.20202, -.547684, .264287, .767712,
	.156434, .987688, -.463292, .267617, .844832, -.225081, -.530827, .295521, .761728,
	.173648, .984808, -.454769, .296198, .839912, -.247382, -.512145, .326129, .755082,
	.190809, .981627, -.445388, .324419, .834495, -.268846, -.491693, .356047, .74779,
	.207912, .978148, -.435159, .352244, .828589, -.289399, -.469527, .385215, .739866,
	.224951, .97437, -.424096, .379641, .822202, -.308969, -.445709, .413572, .731327,
	.241922, .970296, -.412211, .406574, .81534, -.327486, -.420306, .441061, .722191,
	.258819, .965926, -.399519, .433013, .808013, -.344885, -.393389, .467627, .712478,
	.275637, .961262, -.386036, .458924, .800228, -.361102, -.365034, .493216, .702207,
	.292372, .956305, -.371778, .484275, .791997, -.376077, -.335319, .517778, .691399,
	.309017, .951057, -.356763, .509037, .783327, -.389754, -.304329, .541266, .680078,
	.325568, .945519, -.341008, .533178, .774231, -.402081, -.27215, .563635, .668267,
	.34202, .939693, -.324533, .55667, .76472, -.413008, -.238872, .584843, .65599,
	.358368, .93358, -.307359, .579484, .754804, -.422491, -.204589, .604851, .643273,
	.374607, .927184, -.289505, .601592, .744496, -.430488, -.169397, .623624, .630141,
	.390731, .920505, -.270994, .622967, .733809, -.436964, -.133395, .64113, .616621,
	.406737, .913545, -.251848, .643582, .722755, -.441884, -.096684, .657339, .602741,
	.422618, .906308, -.232091, .663414, .711348, -.445222, -.059368, .672226, .588528,
	.438371, .898794, -.211746, .682437, .699602, -.446953, -.02155, .685769, .574011,
	.45399, .891007, -.190839, .700629, .687531, -.447059, .016662, .69795, .55922,
	.469472, .882948, -.169395, .717968, .67515, -.445524, .05516, .708753, .544183,
	.48481, .87462, -.147439, .734431, .662474, -.44234, .093837, .718167, .528929,
	.5, .866025, -.125, .75, .649519, -.4375, .132583, .726184, .51349,
	.515038, .857167, -.102104, .764655, .6363, -.431004, .171288, .732801, .497894,
	.529919, .848048, -.078778, .778378, .622833, -.422856, .209843, .738017, .482171,
	.544639, .838671, -.055052, .791154, .609135, -.413066, .24814, .741835, .466352,
	.559193, .829038, -.030955, .802965, .595222, -.401645, .286069, .744262, .450467,
	.573576, .819152, -.006515, .813798, .581112, -.388612, .323524, .745308, .434544,
	.587785, .809017, .018237, .823639, .566821, -.373991, .360397, .744989, .418613,
	.601815, .798636, .043272, .832477, .552367, -.357807, .396584, .74332, .402704,
	.615661, .788011, .068559, .840301, .537768, -.340093, .431982, .740324, .386845,
	.62932, .777146, .094066, .847101, .523041, -.320884, .46649, .736025, .371063,
	.642788, .766044, .119764, .852869, .508205, -.300221, .500009, .730451, .355387,
	.656059, .75471, .14562, .857597, .493276, -.278147, .532443, .723633, .339844,
	.669131, .743145, .171604, .861281, .478275, -.254712, .5637, .715605, .324459,
	.681998, .731354, .197683, .863916, .463218, -.229967, .593688, .706405, .309259,
	.694658, .71934, .223825, .865498, .448125, -.203969, .622322, .696073, .294267,
	.707107, .707107, .25, .866025, .433013, -.176777, .649519, .684653, .279508,
	.71934, .694658, .276175, .865498, .417901, -.148454, .675199, .67219, .265005,
	.731354, .681998, .302317, .863916, .402807, -.119068, .699288, .658734, .250778,
	.743145, .669131, .328396, .861281, .387751, -.088686, .721714, .644334, .23685,
	.75471, .656059, .35438, .857597, .372749, -.057383, .742412, .629044, .223238,
	.766044, .642788, .380236, .852869, .357821, -.025233, .761319, .612921, .209963,
	.777146, .62932, .405934, .847101, .342984, .007686, .778379, .596021, .19704,
	.788011, .615661, .431441, .840301, .328257, .041294, .793541, .578405, .184487,
	.798636, .601815, .456728, .832477, .313658, .075508, .806757, .560132, .172317,
	.809017, .587785, .481763, .823639, .299204, .110246, .817987, .541266, .160545,
	.819152, .573576, .506515, .813798, .284914, .14542, .827194, .521871, .149181,
	.829038, .559193, .530955, .802965, .270803, .180944, .834347, .502011, .138237,
	.838671, .544639, .555052, .791154, .256891, .21673, .839422, .481753, .127722,
	.848048, .529919, .578778, .778378, .243192, .252688, .842399, .461164, .117644,
	.857167, .515038, .602104, .764655, .229726, .288728, .843265, .440311, .108009,
	.866025, .5, .625, .75, .216506, .32476, .842012, .419263, .098821,
	.87462, .48481, .647439, .734431, .203551, .360692, .838638, .398086, .090085,
	.882948, .469472, .669395, .717968, .190875, .396436, .833145, .376851, .081803,
	.891007, .45399, .690839, .700629, .178494, .431899, .825544, .355623, .073974,
	.898794, .438371, .711746, .682437, .166423, .466993, .81585, .334472, .066599,
	.906308, .422618, .732091, .663414, .154678, .501627, .804083, .313464, .059674,
	.913545, .406737, .751848, .643582, .143271, .535715, .79027, .292666, .053196,
	.920505, .390731, .770994, .622967, .132217, .569169, .774442, .272143, .04716,
	.927184, .374607, .789505, .601592, .121529, .601904, .756637, .25196, .041559,
	.93358, .358368, .807359, .579484, .111222, .633837, .736898, .23218, .036385,
	.939693, .34202, .824533, .55667, .101306, .664885, .715274, .212865, .03163,
	.945519, .325568, .841008, .533178, .091794, .694969, .691816, .194075, .027281,
	.951057, .309017, .856763, .509037, .082698, .724012, .666583, .175868, .023329,
	.956305, .292372, .871778, .484275, .074029, .75194, .639639, .158301, .019758,
	.961262, .275637, .886036, .458924, .065797, .77868, .61105, .141427, .016556,
	.965926, .258819, .899519, .433013, .058013, .804164, .580889, .1253, .013707,
	.970296, .241922, .912211, .406574, .050685, .828326, .549233, .109969, .011193,
	.97437, .224951, .924096, .379641, .043823, .851105, .516162, .095481, .008999,
	.978148, .207912, .935159, .352244, .037436, .872441, .481759, .08188, .007105,
	.981627, .190809, .945388, .324419, .03153, .892279, .446114, .069209, .005492,
	.984808, .173648, .954769, .296198, .026114, .910569, .409317, .057505, .00414,
	.987688, .156434, .963292, .267617, .021193, .927262, .371463, .046806, .003026,
	.990268, .139173, .970946, .238709, .016774, .942316, .332649, .037143, .002131,
	.992546, .121869, .977722, .209511, .012862, .955693, .292976, .028547, .001431,
	.994522, .104528, .983611, .180057, .009462, .967356, .252544, .021043, .000903,
	.996195, .087156, .988606, .150384, .006578, .977277, .21146, .014654, .000523,
	.997564, .069756, .992701, .120527, .004214, .985429, .169828, .0094, .000268,
	.99863, .052336, .995891, .090524, .002372, .991791, .127757, .005297, .000113,
	.999391, .034899, .998173, .060411, .001055, .996348, .085356, .002357, .000034,
	.999848, .017452, .999543, .030224, .000264, .999086, .042733, .00059, .000004,
	1, 0, 1, 0, 0, 1, 0, 0, 0
	gi_AF_3D_Audio_MaxReWeightsLookupTable fillarray \\
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1, 1, 1, 1,
	1.003236, 1.002156, .999152, .990038,
	1.03237, 1.021194, .990433, .898572,
	1.062694, 1.040231, .979161, .799806,
	1.093999, 1.058954, .964976, .693603,
	1.126003, 1.077006, .947526, .57989,
	1.158345, 1.093982, .926474, .45869,
	1.19059, 1.109437, .901512, .330158,
	1.222228, 1.12289, .87237, .194621,
	1.252684, 1.133837, .838839, .052614,
	1.281987, 1.142358, .801199, 0,
	1.312073, 1.150207, .760839, 0,
	1.343011, 1.157424, .717799, 0,
	1.374649, 1.163859, .671999, 0,
	1.406809, 1.169354, .623371, 0,
	1.439286, 1.173739, .571868, 0,
	1.471846, 1.176837, .517465, 0,
	1.504226, 1.178465, .460174, 0,
	1.536133, 1.178438, .400043, 0,
	1.567253, 1.176573, .337165, 0,
	1.597247, 1.172695, .271688, 0,
	1.625766, 1.166645, .203815, 0,
	1.652455, 1.158285, .133806, 0,
	1.676966, 1.147506, .061983, 0,
	1.699006, 1.134261, 0, 0,
	1.720224, 1.119789, 0, 0,
	1.741631, 1.10481, 0, 0,
	1.763183, 1.08933, 0, 0,
	1.784837, 1.073356, 0, 0,
	1.806548, 1.056898, 0, 0,
	1.828269, 1.039968, 0, 0,
	1.849952, 1.02258, 0, 0,
	1.871552, 1.004752, 0, 0,
	1.893018, .986504, 0, 0,
	1.914305, .967857, 0, 0,
	1.935366, .948837, 0, 0,
	1.956154, .929471, 0, 0,
	1.976625, .90979, 0, 0,
	1.996736, .889823, 0, 0,
	2.016448, .869607, 0, 0,
	2.035721, .849175, 0, 0,
	2.054522, .828565, 0, 0,
	2.072818, .807816, 0, 0,
	2.090581, .786964, 0, 0,
	2.107785, .766051, 0, 0,
	2.124411, .745115, 0, 0,
	2.140439, .724196, 0, 0,
	2.155856, .703332, 0, 0,
	2.170653, .682561, 0, 0,
	2.184823, .661921, 0, 0,
	2.198364, .641445, 0, 0,
	2.211275, .621169, 0, 0,
	2.223562, .601125, 0, 0,
	2.23523, .581341, 0, 0,
	2.246289, .561847, 0, 0,
	2.256751, .542667, 0, 0,
	2.266631, .523826, 0, 0,
	2.275943, .505344, 0, 0,
	2.284707, .487239, 0, 0,
	2.292939, .469528, 0, 0,
	2.300661, .452225, 0, 0,
	2.307892, .435342, 0, 0,
	2.314654, .418888, 0, 0,
	2.320969, .40287, 0, 0,
	2.326858, .387294, 0, 0,
	2.332343, .372164, 0, 0,
	2.337445, .357481, 0, 0,
	2.342186, .343246, 0, 0,
	2.346585, .329458, 0, 0,
	2.350664, .316113, 0, 0,
	2.354442, .303208, 0, 0,
	2.357937, .290738, 0, 0,
	2.361168, .278698, 0, 0,
	2.364152, .26708, 0, 0,
	2.366906, .255878, 0, 0,
	2.369446, .245082, 0, 0,
	2.371786, .234685, 0, 0,
	2.37394, .224677, 0, 0,
	2.375923, .215048, 0, 0,
	2.377745, .20579, 0, 0,
	2.379421, .196891, 0, 0,
	2.380959, .188342, 0, 0,
	2.382372, .180132, 0, 0,
	2.383667, .172251, 0, 0,
	2.384856, .164689, 0, 0,
	2.385945, .157435, 0, 0,
	2.386943, .150479, 0, 0,
	2.387857, .143811, 0, 0,
	2.388694, .137421, 0, 0,
	2.38946, .131299, 0, 0,
	2.39016, .125435, 0, 0,
	2.390801, .11982, 0, 0,
	2.391386, .114445, 0, 0,
	2.391921, .1093, 0, 0,
	2.39241, .104376, 0, 0,
	2.392857, .099666, 0, 0,
	2.393265, .09516, 0, 0,
	2.393637, .090851, 0, 0,
	2.393977, .086731, 0, 0,
	2.394288, .082791, 0, 0,
	2.394571, .079025, 0, 0,
	2.394829, .075426, 0, 0,
	2.395064, .071986, 0, 0,
	2.395279, .068699, 0, 0,
	2.395475, .065558, 0, 0,
	2.395653, .062558, 0, 0,
	2.395816, .059693, 0, 0,
	2.395964, .056955, 0, 0,
	2.396099, .054341, 0, 0,
	2.396222, .051845, 0, 0,
	2.396334, .049462, 0, 0,
	2.396436, .047186, 0, 0,
	2.396529, .045013, 0, 0,
	2.396613, .042939, 0, 0,
	2.396691, .040959, 0, 0,
	2.396761, .039069, 0, 0,
	2.396825, .037266, 0, 0,
	2.396883, .035544, 0, 0,
	2.396936, .033901, 0, 0,
	2.396984, .032334, 0, 0,
	2.397028, .030838, 0, 0,
	2.397068, .02941, 0, 0,
	2.397104, .028048, 0, 0,
	2.397137, .026749, 0, 0,
	2.397167, .025509, 0, 0,
	2.397194, .024326, 0, 0,
	2.397219, .023198, 0, 0,
	2.397242, .022122, 0, 0,
	2.397262, .021095, 0, 0,
	2.397281, .020116, 0, 0,
	2.397298, .019181, 0, 0,
	2.397314, .01829, 0, 0,
	2.397328, .017441, 0, 0,
	2.397341, .01663, 0, 0,
	2.397352, .015857, 0, 0,
	2.397363, .015119, 0, 0,
	2.397372, .014416, 0, 0,
	2.397381, .013745, 0, 0,
	2.397389, .013106, 0, 0,
	2.397396, .012496, 0, 0,
	2.397403, .011914, 0, 0,
	2.397409, .01136, 0, 0,
	2.397414, .010831, 0, 0,
	2.397419, .010326, 0, 0,
	2.397424, .009845, 0, 0,
	2.397428, .009387, 0, 0,
	2.397432, .008949, 0, 0,
	2.397435, .008532, 0, 0,
	2.397438, .008135, 0, 0,
	2.397441, .007755, 0, 0,
	2.397443, .007394, 0, 0,
	2.397446, .007049, 0, 0,
	2.397448, .006721, 0, 0,
	2.39745, .006407, 0, 0,
	2.397451, .006108, 0, 0,
	2.397453, .005824, 0, 0,
	2.397454, .005552, 0, 0,
	2.397456, .005293, 0, 0,
	2.397457, .005046, 0, 0,
	2.397458, .004811, 0, 0,
	2.397459, .004586, 0, 0,
	2.39746, .004372, 0, 0,
	2.397461, .004168, 0, 0,
	2.397461, .003974, 0, 0,
	2.397462, .003788, 0, 0,
	2.397463, .003611, 0, 0,
	2.397463, .003443, 0, 0,
	2.397464, .003282, 0, 0,
	2.397464, .003129, 0, 0,
	2.397465, .002983, 0, 0,
	2.397465, .002844, 0, 0,
	2.397465, .002711, 0, 0,
	2.397466, .002584, 0, 0,
	2.397466, .002464, 0, 0,
	2.397466, .002349, 0, 0,
	2.397466, .002239, 0, 0,
	2.397467, .002135, 0, 0,
	2.397467, .002035, 0, 0,
	2.397467, .00194, 0, 0,
	2.397467, .001849, 0, 0,
	2.397467, .001763, 0, 0,
	2.397467, .001681, 0, 0,
	2.397468, .001602, 0, 0,
	2.397468, .001527, 0, 0,
	2.397468, .001456, 0, 0,
	2.397468, .001388, 0, 0,
	2.397468, .001323, 0, 0,
	2.397468, .001261, 0, 0,
	2.397468, .001202, 0, 0,
	2.397468, .001146, 0, 0,
	2.397468, .001093, 0, 0,
	2.397468, .001042, 0, 0,
	2.397468, .000993, 0, 0,
	2.397468, .000947, 0, 0,
	2.397468, .000902, 0, 0,
	2.397468, .00086, 0, 0,
	2.397468, .00082, 0, 0,
	2.397469, .000782, 0, 0,
	2.397469, .000745, 0, 0,
	2.397469, .00071, 0, 0,
	2.397469, .000677, 0, 0,
	2.397469, .000646, 0, 0,
	2.397469, .000616, 0, 0,
	2.397469, .000587, 0, 0,
	2.397469, .000559, 0, 0,
	2.397469, .000533, 0, 0,
	2.397469, .000508, 0, 0,
	2.397469, .000485, 0, 0,
	2.397469, .000462, 0, 0,
	2.397469, .00044, 0, 0,
	2.397469, .00042, 0, 0,
	2.397469, .0004, 0, 0,
	2.397469, .000381, 0, 0,
	2.397469, .000364, 0, 0,
	2.397469, .000347, 0, 0,
	2.397469, .00033, 0, 0,
	2.397469, .000315, 0, 0,
	2.397469, .0003, 0, 0,
	2.397469, .000286, 0, 0,
	2.397469, .000273, 0, 0,
	2.397469, .00026, 0, 0,
	2.397469, .000248, 0, 0,
	2.397469, .000236, 0, 0,
	2.397469, .000225, 0, 0,
	2.397469, .000215, 0, 0,
	2.397469, .000205, 0, 0,
	2.397469, .000195, 0, 0,
	2.397469, .000186, 0, 0,
	2.397469, .000177, 0, 0,
	2.397469, .000169, 0, 0,
	2.397469, .000161, 0, 0,
	2.397469, .000154, 0, 0,
	2.397469, .000147, 0, 0,
	2.397469, .00014, 0, 0,
	2.397469, .000133, 0, 0,
	2.397469, .000127, 0, 0,
	2.397469, .000121, 0, 0,
	2.397469, .000115, 0, 0,
	2.397469, .00011, 0, 0,
	2.397469, .000105, 0, 0,
	2.397469, .0001, 0, 0,
	2.397469, .000095, 0, 0,
	2.397469, .000091, 0, 0,
	2.397469, .000087, 0, 0,
	2.397469, .000083, 0, 0,
	2.397469, .000079, 0, 0,
	2.397469, .000075, 0, 0,
	2.397469, .000071, 0, 0,
	2.397469, .000068, 0, 0,
	2.397469, .000065, 0, 0,
	2.397469, .000062, 0, 0,
	2.397469, .000059, 0, 0,
	2.397469, .000056, 0, 0,
	2.397469, .000054, 0, 0,
	2.397469, .000051, 0, 0,
	2.397469, .000049, 0, 0,
	2.397469, .000046, 0, 0,
	2.397469, .000044, 0, 0,
	2.397469, .000042, 0, 0,
	2.397469, .00004, 0, 0,
	2.397469, .000038, 0, 0,
	2.397469, .000037, 0, 0,
	2.397469, .000035, 0, 0,
	2.397469, .000033, 0, 0,
	2.397469, .000032, 0, 0,
	2.397469, .00003, 0, 0,
	2.397469, .000029, 0, 0,
	2.397469, .000027, 0, 0,
	2.397469, .000026, 0, 0,
	2.397469, .000025, 0, 0,
	2.397469, .000024, 0, 0,
	2.397469, .000023, 0, 0,
	2.397469, .000022, 0, 0,
	2.397469, .000021, 0, 0,
	2.397469, .00002, 0, 0,
	2.397469, .000019, 0, 0,
	2.397469, .000018, 0, 0,
	2.397469, .000017, 0, 0,
	2.397469, .000016, 0, 0,
	2.397469, .000015, 0, 0,
	2.397469, .000015, 0, 0,
	2.397469, .000014, 0, 0,
	2.397469, .000013, 0, 0,
	2.397469, .000013, 0, 0,
	2.397469, .000012, 0, 0,
	2.397469, .000012, 0, 0,
	2.397469, .000011, 0, 0,
	2.397469, .000011, 0, 0,
	2.397469, .00001, 0, 0,
	2.397469, .00001, 0, 0,
	2.397469, .000009, 0, 0,
	2.397469, .000009, 0, 0,
	2.397469, .000008, 0, 0,
	2.397469, .000008, 0, 0,
	2.397469, .000008, 0, 0,
	2.397469, .000007, 0, 0,
	2.397469, .000007, 0, 0,
	2.397469, .000007, 0, 0,
	2.397469, .000006, 0, 0,
	2.397469, .000006, 0, 0,
	2.397469, .000006, 0, 0,
	2.397469, .000005, 0, 0,
	2.397469, .000005, 0, 0,
	2.397469, .000005, 0, 0,
	2.397469, .000005, 0, 0,
	2.397469, .000004, 0, 0,
	2.397469, .000004, 0, 0,
	2.397469, .000004, 0, 0,
	2.397469, .000004, 0, 0,
	2.397469, .000004, 0, 0,
	2.397469, .000004, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000003, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000002, 0, 0,
	2.397469, .000001, 0, 0,
	2.397469, .000001, 0, 0,
	2.397469, .000001, 0, 0
	gi_AF_3D_HrirChannel1TableNumber = ftgen(0, 0, 256, -2, \\
	-.00027735404243516849874529039965, \\
	-.00138677021217584249372645199827, \\
	-.00069338510608792124686322599914, \\
	-.00027735404243516849874529039965, \\
	-.00027735404243516849874529039965, \\
	-.00013867702121758424937264519983, \\
	-.00069338510608792124686322599914, \\
	.00110941616974067399498116159862, \\
	-.00110941616974067399498116159862, \\
	.00332824850922202198494348479585, \\
	-.00249618638191651670554804809399, \\
	-.00069338510608792124686322599914, \\
	-.00721120510331438140105841938521, \\
	-.07141866592705588268064076373776, \\
	-.13798363611149633278785131551558, \\
	.068922479545139372913986619551, \\
	.48647899043128556284543151377875, \\
	.04312855359866870491591939185128, \\
	-.38039106919983362020687422955234, \\
	-.10373041187075301983178121645324, \\
	-.3638885036749410772927149082534, \\
	-.09208154208847593724662772274314, \\
	-.40049923727638331305556107508892, \\
	-.88933573706836777095219304101192, \\
	-.07599500762723616908989043849942, \\
	.0857023991124670619923264780482, \\
	1, \\
	.86728609069477191617636435694294, \\
	-.1056718901677991956367108628001, \\
	.43128553598668700752583049506939, \\
	.12869227568991817300947388957866, \\
	.18652059353765082505560712888837, \\
	.18249895992234085873029414415214, \\
	.13132713909305229749158172580792, \\
	.34960477048952987022545357831405, \\
	.00624046595479129089650838224657, \\
	.05214255997781167689675285714657, \\
	-.25890999861322977482203100407787, \\
	-.23408681181528220860421640736604, \\
	-.18430176119816946145313352189987, \\
	-.15365413950908335394274217833299, \\
	.16308417695187907292542206505459, \\
	.2135626126750797548758953325887, \\
	.21203716544168632607281210766814, \\
	-.01442241020662876280211683877042, \\
	.1503258909998613224168195756647, \\
	.05339065316876993871897383314717, \\
	.00679517403966162832767983204008, \\
	.11080293995284981600768503540166, \\
	-.03619470253778948876099974540921, \\
	.06240465954791291069980729844247, \\
	-.03147968381639162233076589814118, \\
	.00443766467896269597992464639447, \\
	-.07225072805436139056212141440483, \\
	-.06240465954791291069980729844247, \\
	.02690334211621134286041012728674, \\
	-.03966162806822909336901261667663, \\
	.02731937317986409680115045262028, \\
	-.05089446678685342201342578505319, \\
	-.05366800721120510569983608206712, \\
	-.08015531826376369461950588402033, \\
	-.04382193870475662583752196610476, \\
	-.04978505061711274715108288546617, \\
	-.04520870891693246768072711461173, \\
	.01359034807932325665535966408015, \\
	-.07349882124531964544544848649821, \\
	-.05366800721120510569983608206712, \\
	-.07349882124531964544544848649821, \\
	-.05685757869920954332698670441459, \\
	-.03522396338926640085853492223578, \\
	-.01261960893080016701817136492991, \\
	-.04382193870475662583752196610476, \\
	-.07419220635140758024483886856615, \\
	-.05366800721120510569983608206712, \\
	-.09665788378865622365587739750481, \\
	-.02953820551934544652583625179432, \\
	-.0399389821106642672887687695038, \\
	-.04409929274719179281838421502471, \\
	-.0404936901955346012504932673437, \\
	-.06295936763278324466153179628236, \\
	-.06157259742060740975722055168262, \\
	-.06129524337817223583746439885545, \\
	-.03855221189848841850666971708961, \\
	-.05768964082651505120846735508167, \\
	-.01567050339758702115489086281741, \\
	-.05602551657190403544550605374752, \\
	-.06545555401469976830597374828358, \\
	-.04021633615309943426963101842375, \\
	-.06753570933296353107078147104403, \\
	-.04063236721675218821037134375729, \\
	-.0422964914713631970344387411842, \\
	-.0465954791291083095239322631187, \\
	-.05755096380529746424858927866808, \\
	-.04354458466232145191776581327758, \\
	-.06698100124809319710905697320413, \\
	-.05283594508389959781835543140005, \\
	-.03591734849535432178013749648926, \\
	-.06503952295104700742633951904281, \\
	-.0284287893496047716634933522073, \\
	-.04867563444737207228873998587915, \\
	-.05311329912633476479921768032, \\
	-.03952295104701151334802844417027, \\
	-.04798224934128415136713741162566, \\
	-.05061711274441824809366963222601, \\
	-.0399389821106642672887687695038, \\
	-.0446540008320621267801087128646, \\
	-.05879905699625571913191635076146, \\
	-.03411454721952572599619202264876, \\
	-.05547080848703370148378155590763, \\
	-.04257384551379836401530099010415, \\
	-.03106365275273887185947252476126, \\
	-.0507557897656358350535477086396, \\
	-.03411454721952572599619202264876, \\
	-.03466925530439605995791652048865, \\
	-.04298987657745111795604131543769, \\
	-.03563999445291915479927524756931, \\
	-.03092497573152128836904140030128, \\
	-.04881431146858965230972415838551, \\
	-.03161836083760920929064397455477, \\
	-.03286645402856746417397104664815, \\
	-.0422964914713631970344387411842, \\
	-.02191096935237831291876098305238, \\
	-.0343919012619608929770542715687, \\
	-.0302315906254333674474388260478, \\
	-.02191096935237831291876098305238, \\
	-.03037026764665095093786995050777, \\
	-.03050894466786853442830107496775, \\
	-.02246567743724864688048548089228, \\
	-.03314380807100263809372719947532, \\
	-.03064762168908611791873219942772, \\
	-.02066287616142005456598695900539, \\
	-.03550131743170156783939717115572, \\
	-.02218832339481347989962323197233, \\
	-.02315906254333657127153500709937, \\
	-.03092497573152128836904140030128, \\
	-.01913742892802662576290373408483, \\
	-.02274303147968381733079468176584, \\
	-.02704201913742892982028820370033, \\
	-.01913742892802662576290373408483, \\
	-.0223270004160310633900543564323, \\
	-.02676466509499375936997900282677, \\
	-.01483844127028151500813368812715, \\
	-.02510054084038275054591160539985, \\
	-.02385244764942449219313758135286, \\
	-.01636388850367494207649343707089, \\
	-.02468450977672999660517128006632, \\
	-.01733462765219802997895826024433, \\
	-.01886007488559145878204148516488, \\
	-.02329773956455415476196613155935, \\
	-.0192761059492442092533348585448, \\
	-.01830536680072112135087003537137, \\
	-.02343641658577173825239725601932, \\
	-.02121758424629038852771145684528, \\
	-.02204964637359589640919210751235, \\
	-.02482318679794758009560240452629, \\
	-.0151157953127166837237194130239, \\
	-.01664124254611010905735568599084, \\
	-.01788933573706836741012971003784, \\
	-.01289696297323533573375708982667, \\
	-.01428373318541117757696223833364, \\
	-.01636388850367494207649343707089, \\
	-.01123283871862432344024274044614, \\
	-.01178754680349466087141419023965, \\
	-.01400637914297600886137651343688, \\
	-.00721120510331438140105841938521, \\
	-.01303563999445291922418821428664, \\
	-.0120649008459298295869999151364, \\
	-.00832062127305505452867784299542, \\
	-.01442241020662876280211683877042, \\
	-.01053945361253640251864016619265, \\
	-.00873665233670780846941816832896, \\
	-.01137151573984190866539734088292, \\
	-.00776591318818471796486813119031, \\
	-.00734988212453196489148954384518, \\
	-.01067813063375398774379476662943, \\
	-.00596311191235612304828439533821, \\
	-.00762723616696713360707526874194, \\
	-.00943003744279572939102074258244, \\
	-.00402163361530994290654605904933, \\
	-.00818194425183747103824671853545, \\
	-.00762723616696713360707526874194, \\
	-.00429898765774511162213178394609, \\
	-.00873665233670780846941816832896, \\
	-.00693385106087921268547269448845, \\
	-.00429898765774511162213178394609, \\
	-.0084592982942726397538324434322, \\
	-.00610178893357370653871551979819, \\
	-.00443766467896269597992464639447, \\
	-.00873665233670780846941816832896, \\
	-.00513104978505061690152722064795, \\
	-.00499237276383303341109609618798, \\
	-.0084592982942726397538324434322, \\
	-.00429898765774511162213178394609, \\
	-.00526972680626820125932008309633, \\
	-.00776591318818471796486813119031, \\
	-.00388295659409235898243406559516, \\
	-.00596311191235612304828439533821, \\
	-.00734988212453196489148954384518, \\
	-.0036056025516571907005292096926, \\
	-.00637914297600887525430124469494, \\
	-.00651781999722645961209410714332, \\
	-.00374427957287477462464120314678, \\
	-.00693385106087921268547269448845, \\
	-.00610178893357370653871551979819, \\
	-.00388295659409235898243406559516, \\
	-.00693385106087921268547269448845, \\
	-.00526972680626820125932008309633, \\
	-.00416031063652752726433892149771, \\
	-.00707252808209679704326555693683, \\
	-.00457634170018028033771750884284, \\
	-.00457634170018028033771750884284, \\
	-.0066564970184440439698869695917, \\
	-.00416031063652752726433892149771, \\
	-.0048536957426154490533032337396, \\
	-.00624046595479129089650838224657, \\
	-.00388295659409235898243406559516, \\
	-.00513104978505061690152722064795, \\
	-.00596311191235612304828439533821, \\
	-.00346692553043960634273634724423, \\
	-.0054084038274857856171129455447, \\
	-.00526972680626820125932008309633, \\
	-.0036056025516571907005292096926, \\
	-.00554708084870336997490580799308, \\
	-.00471501872139786469551037129122, \\
	-.0036056025516571907005292096926, \\
	-.00554708084870336997490580799308, \\
	-.00429898765774511162213178394609, \\
	-.00374427957287477462464120314678, \\
	-.0054084038274857856171129455447, \\
	-.00388295659409235898243406559516, \\
	-.00402163361530994290654605904933, \\
	-.00513104978505061690152722064795, \\
	-.00346692553043960634273634724423, \\
	-.00429898765774511162213178394609, \\
	-.0048536957426154490533032337396, \\
	-.00346692553043960634273634724423, \\
	-.00443766467896269597992464639447, \\
	-.00457634170018028033771750884284, \\
	-.00332824850922202198494348479585, \\
	-.00443766467896269597992464639447, \\
	-.00429898765774511162213178394609, \\
	-.00332824850922202198494348479585, \\
	-.00471501872139786469551037129122, \\
	-.00429898765774511162213178394609, \\
	-.00416031063652752726433892149771, \\
	-.00513104978505061690152722064795, \\
	-.0048536957426154490533032337396, \\
	-.00499237276383303341109609618798, \\
	-.0054084038274857856171129455447, \\
	-.00513104978505061690152722064795, \\
	-.00513104978505061690152722064795, \\
	-.00513104978505061690152722064795, \\
	-.0048536957426154490533032337396, \\
	-.00471501872139786469551037129122, \\
	-.00429898765774511162213178394609, \\
	-.00402163361530994290654605904933)
	gi_AF_3D_HrirChannel2TableNumber = ftgen(0, 0, 256, -2, \\
	.00026950545748551405986215279142, \\
	.0021560436598841124788972223314, \\
	.00148228001617032732924184035284, \\
	.00094326910119929920951753476999, \\
	.00161703274491308435917291674855, \\
	.00013475272874275702993107639571, \\
	.00013475272874275702993107639571, \\
	.00053901091497102811972430558285, \\
	-.00080851637245654217958645837427, \\
	.0021560436598841124788972223314, \\
	-.00336881821856892596511734438991, \\
	-.00161703274491308435917291674855, \\
	-.00862417463953644991558888932559, \\
	-.07007141894623365729888320174723, \\
	-.13556124511521358555476979290688, \\
	.06697210618515024582730887914295, \\
	.47069128149845029795983464282472, \\
	.03948254952162780911928408045242, \\
	-.37110901495755288514999392646132, \\
	-.10308583748820912551202866325184, \\
	-.35507344023716475023277894251805, \\
	-.08907155369896239960336714602818, \\
	-.38620132057674166903282753082749, \\
	-.8546018056865650747155882527295, \\
	-.05834793154561379591171998981736, \\
	.1022773211157525924397404537558, \\
	.99999999999999988897769753748435, \\
	.88411265328122889961548480641795, \\
	-.03840452769168575114511199330991, \\
	.47608139064816057395290727072279, \\
	.14593720522840586406587704004778, \\
	.20698019134887479797413334381417, \\
	.16116426357633739652186477542273, \\
	.05484436059830211096510765855783, \\
	.40344966985581454110842969384976, \\
	.16251179086376496552013293239725, \\
	.23797331895970891268987656985701, \\
	.10349009567443739898706667190709, \\
	.04217760409648294711582039440145, \\
	.02681579301980864873944376824966, \\
	.13960382697749629254957426383044, \\
	.08651125185285001017998496308792, \\
	-.17733459102546825225665827474586, \\
	-.05470960786955935545305962364182, \\
	-.26195930467591965751239513338078, \\
	-.27772537393882223977215062404866, \\
	-.20239859857162106893113673322659, \\
	-.0817949063468535186860464136771, \\
	-.09122759735884651555171132031319, \\
	-.14418541975475002159257087441802, \\
	-.11885190675111169389399634610527, \\
	-.2738175448052823091060758997628, \\
	-.11063199029780351745344546543492, \\
	-.14472443066972104364076301408204, \\
	-.05646139334321519792636578927159, \\
	-.01792211292278668433031185713844, \\
	-.10605039752054978841044885484735, \\
	-.09688721196604230256888001804327, \\
	-.18973184206980189814295556516299, \\
	-.06737636437137851930234688779819, \\
	-.09661770650855679154478394821126, \\
	-.04365988411265327856503049019921, \\
	-.07721331356959977576526199527507, \\
	-.09742622288101333849485996552175, \\
	-.06198625522166823637038035599289, \\
	-.14445492521223554649445475206448, \\
	-.06036922247675514940912222527913, \\
	-.08893680097021963715242520720494, \\
	-.03651798948928715315975779276414, \\
	-.0578089206306427669246339462461, \\
	-.0710146880474329528221133500665, \\
	-.071823204419889499772189367377, \\
	-.08678075731033552120408103291993, \\
	-.02519876027489556524763258948951, \\
	-.06535507344023716580494465233642, \\
	-.01145398194313434689362019014425, \\
	-.05888694246058482489880603338861, \\
	-.05214930602344697296857134460879, \\
	-.04851098234739253250991097843325, \\
	-.07451825899474463776872568132603, \\
	-.03611373130305888662361368801612, \\
	-.05012801509230561253227520523978, \\
	-.01724834927907289983117777865118, \\
	-.03570947311683061314857567936087, \\
	-.00727664735210887918259725637427, \\
	-.03800026950545748460896788856189, \\
	-.03301441854197547515203936541184, \\
	-.00539010914971028119724305582849, \\
	-.03045411669586308919810413442519, \\
	.00309931276108341147157432260428, \\
	-.02209944751381215377605826688523, \\
	-.00795041099582266541645481083833, \\
	-.01104972375690607688802913344261, \\
	-.00673763643713785193023468877982, \\
	-.00188653820239859841903506953997, \\
	.00700714189462336555641597257704, \\
	.01037596011319229065417157897855, \\
	-.01078021829942056239448611165699, \\
	.01778736019404392881826382222243, \\
	-.00795041099582266541645481083833, \\
	.00754615280959439367614027815989, \\
	.01590082199164533083290962167666, \\
	.00498585096348201032429026113846, \\
	.01428378924673224560637496693971, \\
	.00848942191079369266881737843278, \\
	.00660288370839509468346317788701, \\
	.00026950545748551405986215279142, \\
	.01468804743296051561196602364134, \\
	-.00067376364371378514965538197856, \\
	.01320576741679018936692635577401, \\
	.00781565826707990816968329994552, \\
	-.0043120873197682249577944446628, \\
	.01401428378924673111283194515408, \\
	.00134752728742757029931076395712, \\
	.01024120738444953340740006808574, \\
	.01468804743296051561196602364134, \\
	.01051071284193504790094308987136, \\
	.00404258186228271046425142287717, \\
	.01212774558684813312747774460831, \\
	.00485109823473925307751875024564, \\
	.00229079638862686972566873322421, \\
	.01293626195930467487338333398839, \\
	-.00471634550599649583074723935283, \\
	.00579436733593855207019585051853, \\
	.0043120873197682249577944446628, \\
	-.00175178547365584138910399314426, \\
	.00579436733593855207019585051853, \\
	.00363832367605443959129862818713, \\
	-.00026950545748551405986215279142, \\
	.00539010914971028119724305582849, \\
	.00565961460719579569078607761412, \\
	-.00148228001617032732924184035284, \\
	.01158873467187710414039170103706, \\
	.00121277455868481326937968756141, \\
	.00026950545748551405986215279142, \\
	.00835466918205093542204586753996, \\
	-.0021560436598841124788972223314, \\
	.00296456003234065465848368070567, \\
	.00552486187845303844401456672131, \\
	-.00040425818622827108979322918714, \\
	.00256030184611238335185001702143, \\
	.00714189462336612280318748346986, \\
	-.00336881821856892596511734438991, \\
	.0032340654898261687183458334971, \\
	.00404258186228271046425142287717, \\
	-.00161703274491308435917291674855, \\
	.0087589273682792071623604002184, \\
	-.00067376364371378514965538197856, \\
	-.00134752728742757029931076395712, \\
	.00377307640479719683807013907995, \\
	-.00175178547365584138910399314426, \\
	-.00121277455868481326937968756141, \\
	.00013475272874275702993107639571, \\
	-.00498585096348201032429026113846, \\
	-.00202129093114135523212571143858, \\
	.00471634550599649583074723935283, \\
	.00040425818622827108979322918714, \\
	.00444684004851098220456595555561, \\
	.00485109823473925307751875024564, \\
	.00282980730359789784539303880706, \\
	.00525535642096752395047154493568, \\
	.00404258186228271046425142287717, \\
	.00471634550599649583074723935283, \\
	.00619862552216682294314864520857, \\
	.00754615280959439367614027815989, \\
	.00485109823473925307751875024564, \\
	.00795041099582266541645481083833, \\
	.00687238916588060830964446168423, \\
	.00498585096348201032429026113846, \\
	.00929793828325023441472296781285, \\
	.00565961460719579569078607761412, \\
	.00525535642096752395047154493568, \\
	.0076809055383371509229117890527, \\
	.00471634550599649583074723935283, \\
	.00350357094731168277820798628852, \\
	.00565961460719579569078607761412, \\
	.00296456003234065465848368070567, \\
	.00269505457485514059862152791425, \\
	.00525535642096752395047154493568, \\
	.00148228001617032732924184035284, \\
	.00269505457485514059862152791425, \\
	.00336881821856892596511734438991, \\
	.00080851637245654217958645837427, \\
	.00269505457485514059862152791425, \\
	.00296456003234065465848368070567, \\
	.00094326910119929920951753476999, \\
	.00269505457485514059862152791425, \\
	.0021560436598841124788972223314, \\
	.00013475272874275702993107639571, \\
	.00269505457485514059862152791425, \\
	.00121277455868481326937968756141, \\
	.00026950545748551405986215279142, \\
	.00242554911736962653875937512282, \\
	.00053901091497102811972430558285, \\
	.00026950545748551405986215279142, \\
	.00175178547365584138910399314426, \\
	-.00026950545748551405986215279142, \\
	.00040425818622827108979322918714, \\
	.00161703274491308435917291674855, \\
	-.00026950545748551405986215279142, \\
	.00080851637245654217958645837427, \\
	.00121277455868481326937968756141, \\
	-.00053901091497102811972430558285, \\
	.00094326910119929920951753476999, \\
	.00094326910119929920951753476999, \\
	-.00053901091497102811972430558285, \\
	.00121277455868481326937968756141, \\
	.00053901091497102811972430558285, \\
	-.00053901091497102811972430558285, \\
	.0010780218299420562394486111657, \\
	-.00013475272874275702993107639571, \\
	-.00040425818622827108979322918714, \\
	.00094326910119929920951753476999, \\
	-.00026950545748551405986215279142, \\
	-.00013475272874275702993107639571, \\
	.00080851637245654217958645837427, \\
	-.00053901091497102811972430558285, \\
	0, \\
	.00067376364371378514965538197856, \\
	-.00067376364371378514965538197856, \\
	.00026950545748551405986215279142, \\
	.00040425818622827108979322918714, \\
	-.00067376364371378514965538197856, \\
	.00053901091497102811972430558285, \\
	.00026950545748551405986215279142, \\
	-.00040425818622827108979322918714, \\
	.00067376364371378514965538197856, \\
	.00013475272874275702993107639571, \\
	-.00026950545748551405986215279142, \\
	.00080851637245654217958645837427, \\
	0, \\
	0, \\
	.00080851637245654217958645837427, \\
	-.00013475272874275702993107639571, \\
	.00026950545748551405986215279142, \\
	.00067376364371378514965538197856, \\
	-.00013475272874275702993107639571, \\
	.00040425818622827108979322918714, \\
	.00067376364371378514965538197856, \\
	-.00013475272874275702993107639571, \\
	.00053901091497102811972430558285, \\
	.00053901091497102811972430558285, \\
	-.00013475272874275702993107639571, \\
	.00067376364371378514965538197856, \\
	.00040425818622827108979322918714, \\
	.00013475272874275702993107639571, \\
	.00053901091497102811972430558285, \\
	.00026950545748551405986215279142, \\
	.00026950545748551405986215279142, \\
	.00040425818622827108979322918714, \\
	.00026950545748551405986215279142, \\
	.00026950545748551405986215279142, \\
	.00026950545748551405986215279142, \\
	.00026950545748551405986215279142, \\
	.00013475272874275702993107639571, \\
	.00013475272874275702993107639571)
	gi_AF_3D_HrirChannel3TableNumber = ftgen(0, 0, 256, -2, \\
	0, \\
	-.00055055973573132682610115073985, \\
	-.00018351991191044227536705024662, \\
	-.00018351991191044227536705024662, \\
	-.00018351991191044227536705024662, \\
	-.00055055973573132682610115073985, \\
	.00036703982382088455073410049323, \\
	-.00128463938337309603598956897486, \\
	.00036703982382088455073410049323, \\
	.00091759955955221137683525123308, \\
	-.00238575885483574947135143595744, \\
	.00477151770967149894270287191489, \\
	-.00789135621214901751552250885879, \\
	.00532207744540282631090510889749, \\
	.00477151770967149894270287191489, \\
	-.0796476417691319438230124205802, \\
	-.14975224811892090537313038112188, \\
	.3712607817948247457273680538492, \\
	.47348137272894108562582005106378, \\
	-.83758487795925851138179041299736, \\
	-.17709671499357679258501718777552, \\
	.63736465406496600749619574344251, \\
	-.59295283538263898748255087411962, \\
	.25986419526518628186906312294013, \\
	.40300972655533123800708494854916, \\
	-.37474766012112314950144309477764, \\
	-.21214901816847125948228836023191, \\
	-.13929161314002569405090525833657, \\
	1, \\
	.04881629656817764589815666909089, \\
	-.97173793356579185598320691497065, \\
	-.03743806202973022634328259528047, \\
	.22205909341163515557937557787227, \\
	.27638098733712607169010766483552, \\
	.16590200036703980912555778104434, \\
	.28500642319691688042482269338507, \\
	-.29858689667828958169693009949697, \\
	-.44375114699944939733455839814269, \\
	.02018719031014865050721596162475, \\
	-.1851715911176362583390186955512, \\
	.2440814828408882364296772493617, \\
	.09928427234354926522730266924555, \\
	-.130299137456414027003148703443, \\
	.00128463938337309603598956897486, \\
	-.05579005322077445344630675094777, \\
	.15048632776656267751036466506775, \\
	.07175628555698293498110729160544, \\
	.08258396035969901849416174854923, \\
	.02881262616993943842524927845261, \\
	-.04643053771334189339103915017404, \\
	-.00330335841438796073976646994197, \\
	-.04055790053220774404874049423597, \\
	.05340429436593870093918923203091, \\
	.04643053771334189339103915017404, \\
	.03193246467241695613070717740811, \\
	.02752798678656634065453623350095, \\
	.00220223894292530730440460295938, \\
	-.05670765278032666167895570197288, \\
	-.02440814828408882294907833454545, \\
	.0739585244999082375150223356286, \\
	.03945678106074508584288906831716, \\
	.01743439163149201540092825268857, \\
	.01449807304092493899505544874273, \\
	.00238575885483574947135143595744, \\
	-.06221325013763993189153111984524, \\
	-.03578638282253624597339936030949, \\
	.00165167920719398036988323497098, \\
	.00550559735731326847785194189555, \\
	.04386125894659570478850696417794, \\
	-.03321710405579005043197327040616, \\
	-.03505230317489447383616507636361, \\
	-.00587263718113415281174560789168, \\
	-.02293998898880528561350367056093, \\
	.0141310332171040546611617827466, \\
	.03707102220590934027466545330753, \\
	-.00055055973573132682610115073985, \\
	.0031198385024775185728196369439, \\
	.03248302440814828523363289036752, \\
	-.02018719031014865050721596162475, \\
	-.01284639383373095862517221377175, \\
	.00146815929528353820293640197292, \\
	-.00752431638832813318162884286266, \\
	.01376399339328317032726811675047, \\
	-.00348687832629840334039417193424, \\
	-.01156175445035786258918264479689, \\
	0, \\
	-.01376399339328317032726811675047, \\
	-.0293631859056707640587280394584, \\
	.01431455312901449769547035373307, \\
	.00403743806202973027491553992263, \\
	-.01578271242429803503104501771759, \\
	.01541567260047715069715135172146, \\
	-.01559919251238759373145992270793, \\
	-.01119471462653697825528897880076, \\
	.00825839603596990184941617485492, \\
	-.00954303541934299788540574382978, \\
	-.00330335841438796073976646994197, \\
	.00330335841438796073976646994197, \\
	-.01633327216002936413397073067699, \\
	-.01137823453844742128959754978723, \\
	.00752431638832813318162884286266, \\
	-.0141310332171040546611617827466, \\
	.00568911726922371064479877489362, \\
	.00991007524316388221929940982591, \\
	-.01798495136722334450385396564798, \\
	.00458799779776105677575603891682, \\
	-.00146815929528353820293640197292, \\
	-.00954303541934299788540574382978, \\
	.01192879427417874865779978676983, \\
	.00256927876674619207197913794971, \\
	-.00513855753349238414395827589942, \\
	.01192879427417874865779978676983, \\
	.00201871903101486513745776996132, \\
	-.00073407964764176910146820098646, \\
	.01945311066250688183942862963249, \\
	.00110111947146265365220230147969, \\
	-.00073407964764176910146820098646, \\
	.01082767480271609392139531280463, \\
	-.00605615709304459497869244088974, \\
	.00091759955955221137683525123308, \\
	.00660671682877592147953293988394, \\
	-.00972655533125344091971431481625, \\
	.0036703982382088455073410049323, \\
	.00972655533125344091971431481625, \\
	-.00880895577170122921761841183752, \\
	.00550559735731326847785194189555, \\
	.00403743806202973027491553992263, \\
	-.01211231418608918995738488177949, \\
	.00440447788585061460880920591876, \\
	.00165167920719398036988323497098, \\
	-.00568911726922371064479877489362, \\
	.00623967700495503714563927388781, \\
	-.00256927876674619207197913794971, \\
	-.00623967700495503714563927388781, \\
	.00660671682877592147953293988394, \\
	-.00458799779776105677575603891682, \\
	-.0036703982382088455073410049323, \\
	.00825839603596990184941617485492, \\
	-.00807487612405946054983107984526, \\
	-.00183519911910442275367050246615, \\
	.00679023674068636451384151087041, \\
	-.00899247568361167225192698282399, \\
	.00073407964764176910146820098646, \\
	.00385391815011928767428783793036, \\
	-.01009359515507432525360798081238, \\
	.00201871903101486513745776996132, \\
	.00385391815011928767428783793036, \\
	-.00477151770967149894270287191489, \\
	.00165167920719398036988323497098, \\
	-.00348687832629840334039417193424, \\
	-.00183519911910442275367050246615, \\
	.00183519911910442275367050246615, \\
	-.00532207744540282631090510889749, \\
	.00183519911910442275367050246615, \\
	-.00018351991191044227536705024662, \\
	-.0073407964764176910146820098646, \\
	.00201871903101486513745776996132, \\
	.00256927876674619207197913794971, \\
	-.00330335841438796073976646994197, \\
	-.00146815929528353820293640197292, \\
	-.00293631859056707640587280394584, \\
	-.00146815929528353820293640197292, \\
	.00073407964764176910146820098646, \\
	-.00201871903101486513745776996132, \\
	.00073407964764176910146820098646, \\
	-.00146815929528353820293640197292, \\
	-.00458799779776105677575603891682, \\
	0, \\
	-.00201871903101486513745776996132, \\
	-.00348687832629840334039417193424, \\
	.00091759955955221137683525123308, \\
	-.0031198385024775185728196369439, \\
	-.00403743806202973027491553992263, \\
	.00128463938337309603598956897486, \\
	-.0036703982382088455073410049323, \\
	-.00220223894292530730440460295938, \\
	.00110111947146265365220230147969, \\
	-.00385391815011928767428783793036, \\
	.00018351991191044227536705024662, \\
	.00110111947146265365220230147969, \\
	-.0031198385024775185728196369439, \\
	.00055055973573132682610115073985, \\
	.00036703982382088455073410049323, \\
	-.0031198385024775185728196369439, \\
	.00110111947146265365220230147969, \\
	.00018351991191044227536705024662, \\
	-.00330335841438796073976646994197, \\
	.00110111947146265365220230147969, \\
	-.00110111947146265365220230147969, \\
	-.00238575885483574947135143595744, \\
	.00165167920719398036988323497098, \\
	-.00146815929528353820293640197292, \\
	-.00146815929528353820293640197292, \\
	.00128463938337309603598956897486, \\
	-.00220223894292530730440460295938, \\
	-.00128463938337309603598956897486, \\
	.00128463938337309603598956897486, \\
	-.00220223894292530730440460295938, \\
	-.00055055973573132682610115073985, \\
	.00055055973573132682610115073985, \\
	-.00275279867865663423892597094778, \\
	-.00018351991191044227536705024662, \\
	-.00018351991191044227536705024662, \\
	-.00238575885483574947135143595744, \\
	.00018351991191044227536705024662, \\
	-.00055055973573132682610115073985, \\
	-.00201871903101486513745776996132, \\
	.00036703982382088455073410049323, \\
	-.00091759955955221137683525123308, \\
	-.00183519911910442275367050246615, \\
	.00055055973573132682610115073985, \\
	-.00128463938337309603598956897486, \\
	-.00128463938337309603598956897486, \\
	.00055055973573132682610115073985, \\
	-.00146815929528353820293640197292, \\
	-.00091759955955221137683525123308, \\
	.00018351991191044227536705024662, \\
	-.00146815929528353820293640197292, \\
	-.00055055973573132682610115073985, \\
	.00018351991191044227536705024662, \\
	-.00165167920719398036988323497098, \\
	-.00018351991191044227536705024662, \\
	-.00018351991191044227536705024662, \\
	-.00146815929528353820293640197292, \\
	0, \\
	-.00055055973573132682610115073985, \\
	-.00128463938337309603598956897486, \\
	0, \\
	-.00073407964764176910146820098646, \\
	-.00110111947146265365220230147969, \\
	0, \\
	-.00091759955955221137683525123308, \\
	-.00073407964764176910146820098646, \\
	0, \\
	-.00110111947146265365220230147969, \\
	-.00073407964764176910146820098646, \\
	-.00018351991191044227536705024662, \\
	-.00110111947146265365220230147969, \\
	-.00036703982382088455073410049323, \\
	-.00036703982382088455073410049323, \\
	-.00091759955955221137683525123308, \\
	-.00018351991191044227536705024662, \\
	-.00036703982382088455073410049323, \\
	-.00091759955955221137683525123308, \\
	-.00018351991191044227536705024662, \\
	-.00055055973573132682610115073985, \\
	-.00055055973573132682610115073985, \\
	-.00036703982382088455073410049323, \\
	-.00055055973573132682610115073985, \\
	-.00055055973573132682610115073985, \\
	-.00036703982382088455073410049323, \\
	-.00055055973573132682610115073985, \\
	-.00055055973573132682610115073985, \\
	-.00036703982382088455073410049323, \\
	-.00036703982382088455073410049323, \\
	-.00036703982382088455073410049323)
	gi_AF_3D_HrirChannel4TableNumber = ftgen(0, 0, 256, -2, \\
	0, \\
	.00048744820862783329708592394702, \\
	.00024372410431391664854296197351, \\
	.00024372410431391664854296197351, \\
	.00024372410431391664854296197351, \\
	0, \\
	-.00048744820862783329708592394702, \\
	0, \\
	-.00097489641725566659417184789405, \\
	.00097489641725566659417184789405, \\
	0, \\
	-.00170606873019741645848557087817, \\
	.00097489641725566659417184789405, \\
	-.0121862052156958330234592935426, \\
	.01584206678040458310396942920306, \\
	.03290275408237874898986774496734, \\
	-.09627102120399708140574546177959, \\
	-.10260784791615891464733323346081, \\
	.46380697050938340941783621929062, \\
	.16475749451620766428128206371184, \\
	-.93663173287838163982854666755884, \\
	.0506946136972946659327021734498, \\
	.30465513039239583426009971844906, \\
	-.53863027053375578390159716946073, \\
	.42432366561052886622107394032355, \\
	-.09505240068242749862381657521837, \\
	-.14501584206678039268290092422831, \\
	1, \\
	.3970265659273702341103273738554, \\
	.0804289544235924913628821286693, \\
	-.16134535705581282138965093508887, \\
	-.48988544967097247262444170701201, \\
	-.3738727760175481473758907213778, \\
	.01949792834511333144975608888672, \\
	.05605654399220082878541049353771, \\
	-.17523763100170605677696755719808, \\
	.07311723129417499467130880930199, \\
	-.20424079941506215196689311142109, \\
	-.00024372410431391664854296197351, \\
	.19644162807701681661143311430351, \\
	-.1311235681208871572955843021191, \\
	.07214233487691933122132326161591, \\
	.12259322446990007782208209619057, \\
	.01096758469412624850680693100458, \\
	.03533999512551791455372551808978, \\
	.22349500365586155714581195752544, \\
	-.03607116743845966561066163080795, \\
	-.19083597367779672748788755143323, \\
	-.04606385571533024719803606217283, \\
	-.17572507921033389544085423494835, \\
	-.0253473068486473329663510867249, \\
	.08725322934438216326835657810079, \\
	.13819156714599073465521428261127, \\
	-.03850840848159883117451940393039, \\
	-.19497928345113332837534869668161, \\
	-.05459419936631732667153826810136, \\
	-.05435047526200341427848883313345, \\
	.03046551303923957995656301989129, \\
	.05020716548866682726881549569953, \\
	-.00877406775530099880544554480366, \\
	-.03923958079454058223145551664857, \\
	-.02827199610041433025520163369038, \\
	-.06068730197416524752007660481468, \\
	-.04508895929807457680915661057952, \\
	.07092371435534974843939437505469, \\
	.036558615647087497335654404651, \\
	.06190592249573483030200549137589, \\
	.05678771630514257984234660625589, \\
	-.04265171825493541124529883745709, \\
	-.04338289056787716230223495017526, \\
	.00243724104313916643121951111084, \\
	-.01389227394589324926510442992367, \\
	.02997806483061174823157024604825, \\
	.03192785766512307860098829337403, \\
	-.07384840360711673878935101811294, \\
	-.00731172312941749929365853333252, \\
	-.00463075798196441613258089731175, \\
	-.02096027297099683009418136236945, \\
	.04338289056787716230223495017526, \\
	-.00584937850353399978187152186138, \\
	-.03436509870826224416484606649647, \\
	-.00365586156470874964682926666626, \\
	-.02193516938825249701361386200915, \\
	-.03875213258591275050646274280552, \\
	.01023641238118449918459429426321, \\
	-.01364854984157933166788456702534, \\
	.00073117231294174997273394023267, \\
	.03533999512551791455372551808978, \\
	-.02559103095296124882884747364642, \\
	-.00097489641725566659417184789405, \\
	.01876675603217158039281997616854, \\
	-.0253473068486473329663510867249, \\
	.00097489641725566659417184789405, \\
	.01462344625883499858731706666504, \\
	-.02802827199610041439270524676886, \\
	.00999268827687058332209790734169, \\
	.00974896417255666572487804444336, \\
	-.02510358274433341363440774784976, \\
	.02071654886668291423168497544793, \\
	-.00292468925176699989093576093069, \\
	-.02047282476236899836918858852641, \\
	.01998537655374116664419581468337, \\
	-.00438703387765049940272277240183, \\
	-.01657323909334633069145858996762, \\
	.02607847916158908055384024748946, \\
	-.00316841335608091662079388584061, \\
	-.01048013648549841504709068118473, \\
	.02656592737021691574827997328612, \\
	-.01584206678040458310396942920306, \\
	-.00292468925176699989093576093069, \\
	.01852303192785766453032358924702, \\
	-.01267365342432366648317554336245, \\
	.01194248111138191542623943064427, \\
	.01779185961491591694283442848246, \\
	-.0173044114062880817483947026858, \\
	.00268096514745308316107763602076, \\
	.00389958566902266637668739157618, \\
	-.02827199610041433025520163369038, \\
	.00828661954667316534572929498381, \\
	-.00024372410431391664854296197351, \\
	-.01779185961491591694283442848246, \\
	.02071654886668291423168497544793, \\
	-.00146234462588349994546788046534, \\
	-.00584937850353399978187152186138, \\
	.02242261759688033220805358780581, \\
	-.00170606873019741645848557087817, \\
	-.00536193029490616632215527204153, \\
	.01340482573726541580538818010382, \\
	-.01486717036314891618453692956336, \\
	-.00584937850353399978187152186138, \\
	.00950524006824274986238165752184, \\
	-.01925420424079941558725970196519, \\
	.00341213746039483291697114175633, \\
	.00779917133804533275337478315237, \\
	-.01462344625883499858731706666504, \\
	.00950524006824274986238165752184, \\
	.00536193029490616632215527204153, \\
	-.01340482573726541580538818010382, \\
	.00950524006824274986238165752184, \\
	-.00121862052156958321560975555542, \\
	-.01169875700706799956374304372275, \\
	.01291737752863758234567193028397, \\
	-.00877406775530099880544554480366, \\
	-.00682427492078966583394228351267, \\
	.01340482573726541580538818010382, \\
	-.0112113087984401661040267939029, \\
	-.00292468925176699989093576093069, \\
	.01169875700706799956374304372275, \\
	-.00999268827687058332209790734169, \\
	-.00243724104313916643121951111084, \\
	.00877406775530099880544554480366, \\
	-.00950524006824274986238165752184, \\
	.00073117231294174997273394023267, \\
	.00536193029490616632215527204153, \\
	-.00901779185961491640266540770199, \\
	.00414330977333658267286464749191, \\
	.0060931026078479165117296467713, \\
	-.00146234462588349994546788046534, \\
	.00658055081647574910408415860275, \\
	.00341213746039483291697114175633, \\
	-.00389958566902266637668739157618, \\
	.00438703387765049940272277240183, \\
	.00121862052156958321560975555542, \\
	-.00268096514745308316107763602076, \\
	.00633682671216183324158777168122, \\
	0, \\
	-.00024372410431391664854296197351, \\
	.0060931026078479165117296467713, \\
	-.00024372410431391664854296197351, \\
	.00121862052156958321560975555542, \\
	.0051182061905922495922971471316, \\
	0, \\
	.00268096514745308316107763602076, \\
	.0051182061905922495922971471316, \\
	.00024372410431391664854296197351, \\
	.00438703387765049940272277240183, \\
	.00268096514745308316107763602076, \\
	-.00048744820862783329708592394702, \\
	.00438703387765049940272277240183, \\
	.00121862052156958321560975555542, \\
	.00048744820862783329708592394702, \\
	.00536193029490616632215527204153, \\
	.00048744820862783329708592394702, \\
	0, \\
	.00463075798196441613258089731175, \\
	-.00073117231294174997273394023267, \\
	.00097489641725566659417184789405, \\
	.00389958566902266637668739157618, \\
	-.00194979283451133318834369578809, \\
	.00121862052156958321560975555542, \\
	.00268096514745308316107763602076, \\
	-.00219351693882524970136138620092, \\
	.00194979283451133318834369578809, \\
	.00243724104313916643121951111084, \\
	-.00170606873019741645848557087817, \\
	.00341213746039483291697114175633, \\
	.00194979283451133318834369578809, \\
	-.00121862052156958321560975555542, \\
	.00341213746039483291697114175633, \\
	.00073117231294174997273394023267, \\
	-.00073117231294174997273394023267, \\
	.00365586156470874964682926666626, \\
	.00024372410431391664854296197351, \\
	-.00024372410431391664854296197351, \\
	.00316841335608091662079388584061, \\
	-.00048744820862783329708592394702, \\
	.00048744820862783329708592394702, \\
	.00316841335608091662079388584061, \\
	-.00097489641725566659417184789405, \\
	.00097489641725566659417184789405, \\
	.00243724104313916643121951111084, \\
	-.00121862052156958321560975555542, \\
	.00146234462588349994546788046534, \\
	.00170606873019741645848557087817, \\
	-.00121862052156958321560975555542, \\
	.00170606873019741645848557087817, \\
	.00097489641725566659417184789405, \\
	-.00097489641725566659417184789405, \\
	.00219351693882524970136138620092, \\
	.00048744820862783329708592394702, \\
	-.00073117231294174997273394023267, \\
	.00219351693882524970136138620092, \\
	-.00024372410431391664854296197351, \\
	-.00024372410431391664854296197351, \\
	.00194979283451133318834369578809, \\
	-.00048744820862783329708592394702, \\
	0, \\
	.00170606873019741645848557087817, \\
	-.00073117231294174997273394023267, \\
	.00048744820862783329708592394702, \\
	.00146234462588349994546788046534, \\
	-.00097489641725566659417184789405, \\
	.00097489641725566659417184789405, \\
	.00097489641725566659417184789405, \\
	-.00073117231294174997273394023267, \\
	.00121862052156958321560975555542, \\
	.00048744820862783329708592394702, \\
	-.00048744820862783329708592394702, \\
	.00121862052156958321560975555542, \\
	.00024372410431391664854296197351, \\
	-.00024372410431391664854296197351, \\
	.00146234462588349994546788046534, \\
	0, \\
	.00024372410431391664854296197351, \\
	.00097489641725566659417184789405, \\
	0, \\
	.00024372410431391664854296197351, \\
	.00073117231294174997273394023267, \\
	0, \\
	.00048744820862783329708592394702, \\
	.00048744820862783329708592394702, \\
	.00024372410431391664854296197351, \\
	.00048744820862783329708592394702, \\
	.00048744820862783329708592394702, \\
	.00024372410431391664854296197351, \\
	.00024372410431391664854296197351)
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
	xout (i(gk_i) + 1) / giKR
	endop
	opcode time_k, k, 0
	xout gk_i / giKR
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
	opcode AF_3D_Audio_DistanceAttenuation, k, kPP
	kDistance, kReferenceDistance, kRolloffFactor xin
	kAttenuation = kReferenceDistance / ((max(kDistance, kReferenceDistance) - kReferenceDistance) * kRolloffFactor + kReferenceDistance)
	xout kAttenuation
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
	gkPlaybackTimeInSeconds init 0
	instr 1
	AF_3D_UpdateListenerRotationMatrix(0.01)
	AF_3D_UpdateListenerPosition(0.01)
	iSecondsPerKPass = 1 / kr
	gkPlaybackTimeInSeconds += iSecondsPerKPass
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
	event_i("i", 14, 1, -1)
	event_i("i", 18, 1, -1)
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
	#define CSOUND_IS_PLAYBACK #1#
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
	gSCcInfo_TR_808[] = fillarray( \\
	\\
	"positionEnabled", "bool", "true", "synced", "positionMaxAmpWhenClose", "number", "1", "synced", "positionReferenceDistance", "number", "0.1", "synced", "positionRolloffFactor", "number", "0.01", "synced", "positionOpcodeComboBoxIndex", "number", "0", "synced", "positionOpcode", "string", "", "synced", "positionXScale", "number", "100", "synced", "positionYScale", "number", "100", "synced", "positionZScale", "number", "100", "synced", "positionXOffset", "number", "0", "synced", "positionYOffset", "number", "0", "synced", "positionZOffset", "number", "0", "synced",
	\\
	"", "", "", "")
	#define gSCcInfo_TR_808_Count #52#
	#define CC_INFO_CHANNEL #0#
	#define CC_INFO_TYPE #1#
	#define CC_INFO_VALUE #2#
	#define CC_INFO_SYNC_TYPE #3#
	#define CC_NO_SYNC #0#
	#define CC_SYNC_TO_CHANNEL #1#
	#ifdef gSCcInfo_TR_808_Count
	if (lenarray(gSCcInfo_TR_808) == $gSCcInfo_TR_808_Count) then
	giCcCount_TR_808 = (lenarray(gSCcInfo_TR_808) / 4) - 1
	reshapearray(gSCcInfo_TR_808, giCcCount_TR_808 + 1, 4)
	endif
	#else
	giCcCount_TR_808 = (lenarray(gSCcInfo_TR_808) / 4) - 1
	reshapearray(gSCcInfo_TR_808, giCcCount_TR_808 + 1, 4)
	#end
	opcode ccIndex_TR_808, i, S
	SChannel xin
	kgoto end
	iI = 0
	while (iI < giCcCount_TR_808) do
	if (strcmp(gSCcInfo_TR_808[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
	iI += 1
	od
	iI = -1
	end:
	xout iI
	endop
	gSCcValueDefaults_TR_808[] init giCcCount_TR_808
	giCcValueDefaults_TR_808[] init giCcCount_TR_808
	gSCcValues_TR_808[][] init 6, giCcCount_TR_808
	giCcValues_TR_808[][] init 6, giCcCount_TR_808
	gkCcValues_TR_808[][] init 6, giCcCount_TR_808
	gkCcSyncTypes_TR_808[][] init 6, giCcCount_TR_808
	instr TR_808_InitializeCcValues
	iI = 0
	while (iI < giCcCount_TR_808) do
	SType = gSCcInfo_TR_808[iI][$CC_INFO_TYPE]
	SValue = gSCcInfo_TR_808[iI][$CC_INFO_VALUE]
	iJ = 0
	while (iJ < 6) do
	iValue = -1
	if (strcmp(SType, "string") == 0) then
	gSCcValueDefaults_TR_808[iI] = SValue
	gSCcValues_TR_808[iJ][iI] = SValue
	else
	if (strcmp(SType, "bool") == 0) then
	if (strcmp(SValue, "false") == 0) then
	iValue = 0
	else
	iValue = 1
	endif
	elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
	iValue = strtod(SValue)
	endif
	giCcValueDefaults_TR_808[iI] = iValue
	giCcValues_TR_808[iJ][iI] = iValue
	endif
	iJ += 1
	od
	iI += 1
	od
	igoto end
	kI = 0
	while (kI < giCcCount_TR_808) do
	SType = gSCcInfo_TR_808[kI][$CC_INFO_TYPE]
	SValue = gSCcInfo_TR_808[kI][$CC_INFO_VALUE]
	SSyncType = gSCcInfo_TR_808[kI][$CC_INFO_SYNC_TYPE]
	kJ = 0
	while (kJ < 6) do
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
	gkCcValues_TR_808[kJ][kI] = kValue
	gkCcSyncTypes_TR_808[kJ][kI] = $CC_NO_SYNC
	if (strcmpk(SSyncType, "synced") == 0) then
	gkCcSyncTypes_TR_808[kJ][kI] = $CC_SYNC_TO_CHANNEL
	endif
	kJ += 1
	od
	kI += 1
	od
	turnoff
	end:
	endin
	event_i("i", "TR_808_InitializeCcValues", 0, -1)
	instr TR_808_CreateCcIndexes
	giCc_TR_808_positionEnabled init ccIndex_TR_808("positionEnabled")
	giCc_TR_808_positionMaxAmpWhenClose init ccIndex_TR_808("positionMaxAmpWhenClose")
	giCc_TR_808_positionReferenceDistance init ccIndex_TR_808("positionReferenceDistance")
	giCc_TR_808_positionRolloffFactor init ccIndex_TR_808("positionRolloffFactor")
	giCc_TR_808_positionOpcodeComboBoxIndex init ccIndex_TR_808("positionOpcodeComboBoxIndex")
	giCc_TR_808_positionOpcode init ccIndex_TR_808("positionOpcode")
	giCc_TR_808_positionXScale init ccIndex_TR_808("positionXScale")
	giCc_TR_808_positionYScale init ccIndex_TR_808("positionYScale")
	giCc_TR_808_positionZScale init ccIndex_TR_808("positionZScale")
	giCc_TR_808_positionXOffset init ccIndex_TR_808("positionXOffset")
	giCc_TR_808_positionYOffset init ccIndex_TR_808("positionYOffset")
	giCc_TR_808_positionZOffset init ccIndex_TR_808("positionZOffset")
	turnoff
	endin
	event_i("i", "TR_808_CreateCcIndexes", 0, -1)
	opcode jsonPrint_i, 0, S
	SText xin
	prints(SText)
	endop
	opcode jsonPrint_k, 0, S
	SText xin
	printsk(SText)
	endop
	opcode jsonStart_i, 0, S
	SUuid xin
	prints("{\\"csJSON\\":")
	prints("{\\"%s\\":{", SUuid)
	endop
	opcode jsonStart_k, 0, S
	SUuid xin
	printsk("{\\"csJSON\\":")
	printsk("{\\"%s\\":{", SUuid)
	endop
	opcode jsonEnd_i, 0, 0
	prints("}}")
	prints("}\\n")
	endop
	opcode jsonEnd_k, 0, 0
	printsk("}}")
	printsk("}\\n")
	endop
	opcode jsonKey_i, 0, S
	SKey xin
	prints("\\"%s\\":", SKey)
	endop
	opcode jsonKey_k, 0, S
	SKey xin
	printsk("\\"%s\\":", SKey)
	endop
	opcode jsonBool_i, 0, Si
	SKey, iValue xin
	jsonKey_i(SKey)
	if (iValue == 0) then
	prints("false")
	else
	prints("true")
	endif
	endop
	opcode jsonBool_k, 0, Sk
	SKey, kValue xin
	jsonKey_k(SKey)
	if (kValue == 0) then
	printsk("false")
	else
	printsk("true")
	endif
	endop
	opcode jsonInteger_i, 0, Si
	SKey, iValue xin
	jsonKey_i(SKey)
	prints("%d", iValue)
	endop
	opcode jsonInteger_i, 0, Sk
	SKey, kValue xin
	jsonKey_k(SKey)
	prints("%d", kValue)
	endop
	opcode jsonFloat_i, 0, Si
	SKey, iValue xin
	jsonKey_i(SKey)
	prints("%.3f", iValue)
	endop
	opcode jsonFloat_k, 0, Sk
	SKey, kValue xin
	jsonKey_k(SKey)
	printsk("%.3f", kValue)
	endop
	opcode jsonString_i, 0, SS
	SKey, SValue xin
	jsonKey_i(SKey)
	prints("\\"%s\\"", SValue)
	endop
	opcode jsonString_k, 0, SS
	SKey, SValue xin
	jsonKey_k(SKey)
	printsk("\\"%s\\"", SValue)
	endop
	opcode jsonNull_i, 0, S
	SKey xin
	jsonKey_i(SKey)
	prints("null")
	endop
	opcode jsonNull_k, 0, S
	SKey xin
	jsonKey_k(SKey)
	printsk(":null")
	endop
	#ifdef CSOUND_IS_PLAYBACK
	opcode time_PlaybackTime, i, 0
	xout i(gk_i) / giKR
	endop
	opcode time_PlaybackTime, k, 0
	xout gk_i / giKR
	endop
	#else
	opcode time_PlaybackTime, i, 0
	xout time_i() - i(gk_dawPlayStartTime)
	endop
	opcode time_PlaybackTime, k, 0
	xout time_k() - gk_dawPlayStartTime
	endop
	#end
	opcode dEd_circle_XZ, iii, 0
	iPeriod = 1
	iX init 0
	iY init 0
	iZ init 0
	iT = $AF_MATH__PI2 * (wrap(time_PlaybackTime:i(), 0, iPeriod) / iPeriod)
	iX = sin(iT)
	iZ = cos(iT)
	xout iX, iY, iZ
	endop
	opcode dEd_circle_XZ, kkk, 0
	iPeriod = 1
	kX init 0
	kY init 0
	kZ init 0
	kT = $AF_MATH__PI2 * (wrap(time_PlaybackTime:k(), 0, iPeriod) / iPeriod)
	kX = sin(kT)
	kZ = cos(kT)
	xout kX, kY, kZ
	endop
	opcode dEd_random_XZ, iii, 0
	iX init random(-1, 1)
	iY init 0
	iZ init random(-1, 1)
	xout iX, iY, iZ
	endop
	opcode dEd_random_XZ, kkk, 0
	kX init 0
	kY init 0
	kZ init 0
	kTick init 0
	kPreviousTick init 0
	kTick = gkPlaybackTimeInSeconds / 0.0625
	if (kTick - kPreviousTick > 1 || kTick < kPreviousTick) then
	kPreviousTick = kTick
	kX = random:k(-1, 1)
	kZ = random:k(-1, 1)
	endif
	xout kX, kY, kZ
	endop
	opcode time_NoteTime, i, 0
	xout 0
	endop
	opcode time_NoteTime, k, 0
	ki init 0
	ki += 1
	xout ki / kr
	endop
	opcode dEd_ray_XZ, iii, 0
	iXZ init time_NoteTime:i()
	iY init 0
	xout iXZ, iY, iXZ
	endop
	opcode dEd_ray_XZ, kkk, 0
	kXZ init 0
	kY init 0
	kI init 0
	kXZ = time_NoteTime:k()
	kI += 1
	xout kXZ, kY, kXZ
	endop
	opcode dEd_position, iii, i
	iPositionOpcode xin
	iX = 0
	iY = 0
	iZ = 0
	if (iPositionOpcode == 1) then
	elseif (iPositionOpcode == 2) then
	iX, iY, iZ dEd_circle_XZ
	elseif (iPositionOpcode == 3) then
	iX, iY, iZ dEd_random_XZ
	elseif (iPositionOpcode == 4) then
	iX, iY, iZ dEd_ray_XZ
	endif
	xout iX, iY, iZ
	endop
	opcode dEd_position, kkk, k
	kPositionOpcode xin
	kX = 0
	kY = 0
	kZ = 0
	if (kPositionOpcode == 1) then
	elseif (kPositionOpcode == 2) then
	kX, kY, kZ dEd_circle_XZ
	elseif (kPositionOpcode == 3) then
	kX, kY, kZ dEd_random_XZ
	elseif (kPositionOpcode == 4) then
	kX, kY, kZ dEd_ray_XZ
	endif
	xout kX, kY, kZ
	endop
	giTR_808_PlaybackVolumeAdjustment = 1
	giTR_808_PlaybackReverbAdjustment = 1
	giTR_808_BassDrum_Level = 1
	giTR_808_BassDrum_Decay = 1
	giTR_808_BassDrum_Tune init 0
	giTR_808_SnareDrum_Level = 1
	giTR_808_SnareDrum_Decay = 1
	giTR_808_SnareDrum_Tune init 0
	giTR_808_OpenHighHat_Level = 1
	giTR_808_OpenHighHat_Decay = 1
	giTR_808_OpenHighHat_Tune init 0
	giTR_808_ClosedHighHat_Level = 1
	giTR_808_ClosedHighHat_Decay = 1
	giTR_808_ClosedHighHat_Tune init 0
	giTR_808_NoteIndex[] init 6
	giTR_808_Sine_TableNumber = ftgen(0, 0, 1024, 10, 1)
	giTR_808_Cosine_TableNumber = ftgen(0, 0, 65536, 9, 1, 1, 90)
	gisine = giTR_808_Sine_TableNumber
	gicos = giTR_808_Cosine_TableNumber
	gklevel1 init giTR_808_BassDrum_Level
	gkdur1 init giTR_808_BassDrum_Decay
	gktune1 init giTR_808_BassDrum_Tune
	gklevel2 init giTR_808_SnareDrum_Level
	gkdur2 init giTR_808_SnareDrum_Decay
	gktune2 init giTR_808_SnareDrum_Tune
	gklevel3 init giTR_808_OpenHighHat_Level
	gkdur3 init giTR_808_OpenHighHat_Decay
	gktune3 init giTR_808_OpenHighHat_Tune
	gklevel4 init giTR_808_ClosedHighHat_Level
	gkdur4 init giTR_808_ClosedHighHat_Decay
	gktune4 init giTR_808_ClosedHighHat_Tune
	gklevel init 1
	instr 4
	iOrcInstanceIndex = 0
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TR_808[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TR_808[0][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TR_808[0][iCcIndex] = iCcValue
	gkCcValues_TR_808[0][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
	if (iNoteNumber == 37) then
	iNoteDuration = 2 * giTR_808_BassDrum_Decay
	p3 = iNoteDuration
	xtratim(0.1)
	kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
	kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
	asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
	giTR_808_Cosine_TableNumber)
	aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
	aatt = linseg:a(0, 0.004, 1)
	asig = asig * aenv * aatt
	aenv = linseg:a(1, 0.07, 0)
	acps = expsega(400, 0.07, 0.001, 1, 0.001)
	aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)
	aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp
	elseif (iNoteNumber == 39) then
	ifrq = 342
	iNseDur = 0.3 * giTR_808_SnareDrum_Decay
	iPchDur = 0.1 * giTR_808_SnareDrum_Decay
	iNoteDuration = iNseDur
	p3 = iNoteDuration
	aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
	apitch1 = oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch2 = oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch = (apitch1 + apitch2) * 0.75
	aenv2 = expon(1, iNoteDuration, 0.0005)
	anoise = noise(0.75, 0)
	anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
	anoise = buthp(anoise, 1000)
	kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
	anoise = butlp(anoise, kcf)
	aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp
	elseif (iNoteNumber == 51) then
	xtratim(0.1)
	kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)
	iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
	p3 = iNoteDuration
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55
	elseif (iNoteNumber == 49) then
	xtratim 0.1
	kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)
	iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
	p3 = iNoteDuration
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55
	endif
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	iPositionMaxAmpWhenClose = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionMaxAmpWhenClose]
	iPositionReferenceDistance = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionReferenceDistance]
	iPositionRolloffFactor = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionRolloffFactor]
	iX, iY, iZ dEd_position giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionOpcodeComboBoxIndex]
	iX *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXScale]
	iY *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYScale]
	iZ *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZScale]
	iX += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXOffset]
	iY += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYOffset]
	iZ += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZOffset]
	kX init iX
	kY init iY
	kZ init iZ
	kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
	kPositionReferenceDistance init iPositionReferenceDistance
	kPositionRolloffFactor init iPositionRolloffFactor
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[0][0] = a1
	gaInstrumentSignals[0][1] = a2
	gaInstrumentSignals[0][2] = a3
	gaInstrumentSignals[0][3] = a4
	gaInstrumentSignals[0][4] = aOut
	gaInstrumentSignals[0][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[0] == 0) then
	jsonStart_i("e274e9138ef048c4ba9c4d42e836c85c")
	jsonString_i("instanceName", "")
	jsonEnd_i()
	endif
	giTR_808_NoteIndex[0] = giTR_808_NoteIndex[0] + 1
	jsonStart_i("e274e9138ef048c4ba9c4d42e836c85c")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"time\\":%.3f}}",
	giTR_808_NoteIndex[0],
	times()))
	jsonEnd_i()
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	jsonStart_i("e274e9138ef048c4ba9c4d42e836c85c")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"xyz\\":[%.3f,%.3f,%.3f]}}",
	giTR_808_NoteIndex[0],
	iX, iY, iZ))
	jsonEnd_i()
	endif
	#end
	endif
	end:
	endin
	instr 5
	iOrcInstanceIndex = 1
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TR_808[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TR_808[1][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TR_808[1][iCcIndex] = iCcValue
	gkCcValues_TR_808[1][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
	if (iNoteNumber == 37) then
	iNoteDuration = 2 * giTR_808_BassDrum_Decay
	p3 = iNoteDuration
	xtratim(0.1)
	kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
	kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
	asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
	giTR_808_Cosine_TableNumber)
	aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
	aatt = linseg:a(0, 0.004, 1)
	asig = asig * aenv * aatt
	aenv = linseg:a(1, 0.07, 0)
	acps = expsega(400, 0.07, 0.001, 1, 0.001)
	aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)
	aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp
	elseif (iNoteNumber == 39) then
	ifrq = 342
	iNseDur = 0.3 * giTR_808_SnareDrum_Decay
	iPchDur = 0.1 * giTR_808_SnareDrum_Decay
	iNoteDuration = iNseDur
	p3 = iNoteDuration
	aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
	apitch1 = oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch2 = oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch = (apitch1 + apitch2) * 0.75
	aenv2 = expon(1, iNoteDuration, 0.0005)
	anoise = noise(0.75, 0)
	anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
	anoise = buthp(anoise, 1000)
	kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
	anoise = butlp(anoise, kcf)
	aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp
	elseif (iNoteNumber == 51) then
	xtratim(0.1)
	kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)
	iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
	p3 = iNoteDuration
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55
	elseif (iNoteNumber == 49) then
	xtratim 0.1
	kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)
	iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
	p3 = iNoteDuration
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55
	endif
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	iPositionMaxAmpWhenClose = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionMaxAmpWhenClose]
	iPositionReferenceDistance = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionReferenceDistance]
	iPositionRolloffFactor = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionRolloffFactor]
	iX, iY, iZ dEd_position giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionOpcodeComboBoxIndex]
	iX *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXScale]
	iY *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYScale]
	iZ *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZScale]
	iX += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXOffset]
	iY += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYOffset]
	iZ += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZOffset]
	kX init iX
	kY init iY
	kZ init iZ
	kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
	kPositionReferenceDistance init iPositionReferenceDistance
	kPositionRolloffFactor init iPositionRolloffFactor
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[1][0] = a1
	gaInstrumentSignals[1][1] = a2
	gaInstrumentSignals[1][2] = a3
	gaInstrumentSignals[1][3] = a4
	gaInstrumentSignals[1][4] = aOut
	gaInstrumentSignals[1][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[1] == 0) then
	jsonStart_i("8aac7747b6b44366b1080319e34a8616")
	jsonString_i("instanceName", "")
	jsonEnd_i()
	endif
	giTR_808_NoteIndex[1] = giTR_808_NoteIndex[1] + 1
	jsonStart_i("8aac7747b6b44366b1080319e34a8616")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"time\\":%.3f}}",
	giTR_808_NoteIndex[1],
	times()))
	jsonEnd_i()
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	jsonStart_i("8aac7747b6b44366b1080319e34a8616")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"xyz\\":[%.3f,%.3f,%.3f]}}",
	giTR_808_NoteIndex[1],
	iX, iY, iZ))
	jsonEnd_i()
	endif
	#end
	endif
	end:
	endin
	instr 6
	iOrcInstanceIndex = 2
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TR_808[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TR_808[2][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TR_808[2][iCcIndex] = iCcValue
	gkCcValues_TR_808[2][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
	if (iNoteNumber == 37) then
	iNoteDuration = 2 * giTR_808_BassDrum_Decay
	p3 = iNoteDuration
	xtratim(0.1)
	kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
	kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
	asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
	giTR_808_Cosine_TableNumber)
	aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
	aatt = linseg:a(0, 0.004, 1)
	asig = asig * aenv * aatt
	aenv = linseg:a(1, 0.07, 0)
	acps = expsega(400, 0.07, 0.001, 1, 0.001)
	aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)
	aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp
	elseif (iNoteNumber == 39) then
	ifrq = 342
	iNseDur = 0.3 * giTR_808_SnareDrum_Decay
	iPchDur = 0.1 * giTR_808_SnareDrum_Decay
	iNoteDuration = iNseDur
	p3 = iNoteDuration
	aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
	apitch1 = oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch2 = oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch = (apitch1 + apitch2) * 0.75
	aenv2 = expon(1, iNoteDuration, 0.0005)
	anoise = noise(0.75, 0)
	anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
	anoise = buthp(anoise, 1000)
	kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
	anoise = butlp(anoise, kcf)
	aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp
	elseif (iNoteNumber == 51) then
	xtratim(0.1)
	kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)
	iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
	p3 = iNoteDuration
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55
	elseif (iNoteNumber == 49) then
	xtratim 0.1
	kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)
	iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
	p3 = iNoteDuration
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55
	endif
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	iPositionMaxAmpWhenClose = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionMaxAmpWhenClose]
	iPositionReferenceDistance = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionReferenceDistance]
	iPositionRolloffFactor = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionRolloffFactor]
	iX, iY, iZ dEd_position giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionOpcodeComboBoxIndex]
	iX *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXScale]
	iY *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYScale]
	iZ *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZScale]
	iX += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXOffset]
	iY += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYOffset]
	iZ += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZOffset]
	kX init iX
	kY init iY
	kZ init iZ
	kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
	kPositionReferenceDistance init iPositionReferenceDistance
	kPositionRolloffFactor init iPositionRolloffFactor
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[2][0] = a1
	gaInstrumentSignals[2][1] = a2
	gaInstrumentSignals[2][2] = a3
	gaInstrumentSignals[2][3] = a4
	gaInstrumentSignals[2][4] = aOut
	gaInstrumentSignals[2][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[2] == 0) then
	jsonStart_i("8e12ccc0dff44a4283211d553199a8cd")
	jsonString_i("instanceName", "")
	jsonEnd_i()
	endif
	giTR_808_NoteIndex[2] = giTR_808_NoteIndex[2] + 1
	jsonStart_i("8e12ccc0dff44a4283211d553199a8cd")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"time\\":%.3f}}",
	giTR_808_NoteIndex[2],
	times()))
	jsonEnd_i()
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	jsonStart_i("8e12ccc0dff44a4283211d553199a8cd")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"xyz\\":[%.3f,%.3f,%.3f]}}",
	giTR_808_NoteIndex[2],
	iX, iY, iZ))
	jsonEnd_i()
	endif
	#end
	endif
	end:
	endin
	instr 7
	iOrcInstanceIndex = 3
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TR_808[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TR_808[3][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TR_808[3][iCcIndex] = iCcValue
	gkCcValues_TR_808[3][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
	if (iNoteNumber == 37) then
	iNoteDuration = 2 * giTR_808_BassDrum_Decay
	p3 = iNoteDuration
	xtratim(0.1)
	kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
	kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
	asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
	giTR_808_Cosine_TableNumber)
	aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
	aatt = linseg:a(0, 0.004, 1)
	asig = asig * aenv * aatt
	aenv = linseg:a(1, 0.07, 0)
	acps = expsega(400, 0.07, 0.001, 1, 0.001)
	aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)
	aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp
	elseif (iNoteNumber == 39) then
	ifrq = 342
	iNseDur = 0.3 * giTR_808_SnareDrum_Decay
	iPchDur = 0.1 * giTR_808_SnareDrum_Decay
	iNoteDuration = iNseDur
	p3 = iNoteDuration
	aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
	apitch1 = oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch2 = oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch = (apitch1 + apitch2) * 0.75
	aenv2 = expon(1, iNoteDuration, 0.0005)
	anoise = noise(0.75, 0)
	anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
	anoise = buthp(anoise, 1000)
	kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
	anoise = butlp(anoise, kcf)
	aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp
	elseif (iNoteNumber == 51) then
	xtratim(0.1)
	kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)
	iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
	p3 = iNoteDuration
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55
	elseif (iNoteNumber == 49) then
	xtratim 0.1
	kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)
	iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
	p3 = iNoteDuration
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55
	endif
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	iPositionMaxAmpWhenClose = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionMaxAmpWhenClose]
	iPositionReferenceDistance = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionReferenceDistance]
	iPositionRolloffFactor = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionRolloffFactor]
	iX, iY, iZ dEd_position giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionOpcodeComboBoxIndex]
	iX *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXScale]
	iY *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYScale]
	iZ *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZScale]
	iX += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXOffset]
	iY += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYOffset]
	iZ += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZOffset]
	kX init iX
	kY init iY
	kZ init iZ
	kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
	kPositionReferenceDistance init iPositionReferenceDistance
	kPositionRolloffFactor init iPositionRolloffFactor
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[3][0] = a1
	gaInstrumentSignals[3][1] = a2
	gaInstrumentSignals[3][2] = a3
	gaInstrumentSignals[3][3] = a4
	gaInstrumentSignals[3][4] = aOut
	gaInstrumentSignals[3][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[3] == 0) then
	jsonStart_i("6aecd056fd3f4c6d9a108de531c48ddf")
	jsonString_i("instanceName", "")
	jsonEnd_i()
	endif
	giTR_808_NoteIndex[3] = giTR_808_NoteIndex[3] + 1
	jsonStart_i("6aecd056fd3f4c6d9a108de531c48ddf")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"time\\":%.3f}}",
	giTR_808_NoteIndex[3],
	times()))
	jsonEnd_i()
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	jsonStart_i("6aecd056fd3f4c6d9a108de531c48ddf")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"xyz\\":[%.3f,%.3f,%.3f]}}",
	giTR_808_NoteIndex[3],
	iX, iY, iZ))
	jsonEnd_i()
	endif
	#end
	endif
	end:
	endin
	instr 8
	iOrcInstanceIndex = 4
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TR_808[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TR_808[4][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TR_808[4][iCcIndex] = iCcValue
	gkCcValues_TR_808[4][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
	if (iNoteNumber == 37) then
	iNoteDuration = 2 * giTR_808_BassDrum_Decay
	p3 = iNoteDuration
	xtratim(0.1)
	kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
	kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
	asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
	giTR_808_Cosine_TableNumber)
	aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
	aatt = linseg:a(0, 0.004, 1)
	asig = asig * aenv * aatt
	aenv = linseg:a(1, 0.07, 0)
	acps = expsega(400, 0.07, 0.001, 1, 0.001)
	aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)
	aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp
	elseif (iNoteNumber == 39) then
	ifrq = 342
	iNseDur = 0.3 * giTR_808_SnareDrum_Decay
	iPchDur = 0.1 * giTR_808_SnareDrum_Decay
	iNoteDuration = iNseDur
	p3 = iNoteDuration
	aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
	apitch1 = oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch2 = oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch = (apitch1 + apitch2) * 0.75
	aenv2 = expon(1, iNoteDuration, 0.0005)
	anoise = noise(0.75, 0)
	anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
	anoise = buthp(anoise, 1000)
	kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
	anoise = butlp(anoise, kcf)
	aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp
	elseif (iNoteNumber == 51) then
	xtratim(0.1)
	kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)
	iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
	p3 = iNoteDuration
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55
	elseif (iNoteNumber == 49) then
	xtratim 0.1
	kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)
	iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
	p3 = iNoteDuration
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55
	endif
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	iPositionMaxAmpWhenClose = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionMaxAmpWhenClose]
	iPositionReferenceDistance = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionReferenceDistance]
	iPositionRolloffFactor = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionRolloffFactor]
	iX, iY, iZ dEd_position giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionOpcodeComboBoxIndex]
	iX *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXScale]
	iY *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYScale]
	iZ *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZScale]
	iX += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXOffset]
	iY += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYOffset]
	iZ += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZOffset]
	kX init iX
	kY init iY
	kZ init iZ
	kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
	kPositionReferenceDistance init iPositionReferenceDistance
	kPositionRolloffFactor init iPositionRolloffFactor
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[4][0] = a1
	gaInstrumentSignals[4][1] = a2
	gaInstrumentSignals[4][2] = a3
	gaInstrumentSignals[4][3] = a4
	gaInstrumentSignals[4][4] = aOut
	gaInstrumentSignals[4][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[4] == 0) then
	jsonStart_i("e3e7d57082834a28b53e021beaeb783d")
	jsonString_i("instanceName", "")
	jsonEnd_i()
	endif
	giTR_808_NoteIndex[4] = giTR_808_NoteIndex[4] + 1
	jsonStart_i("e3e7d57082834a28b53e021beaeb783d")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"time\\":%.3f}}",
	giTR_808_NoteIndex[4],
	times()))
	jsonEnd_i()
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	jsonStart_i("e3e7d57082834a28b53e021beaeb783d")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"xyz\\":[%.3f,%.3f,%.3f]}}",
	giTR_808_NoteIndex[4],
	iX, iY, iZ))
	jsonEnd_i()
	endif
	#end
	endif
	end:
	endin
	instr 9
	iOrcInstanceIndex = 5
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TR_808[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TR_808[5][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TR_808[5][iCcIndex] = iCcValue
	gkCcValues_TR_808[5][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
	if (iNoteNumber == 37) then
	iNoteDuration = 2 * giTR_808_BassDrum_Decay
	p3 = iNoteDuration
	xtratim(0.1)
	kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
	kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
	asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
	giTR_808_Cosine_TableNumber)
	aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
	aatt = linseg:a(0, 0.004, 1)
	asig = asig * aenv * aatt
	aenv = linseg:a(1, 0.07, 0)
	acps = expsega(400, 0.07, 0.001, 1, 0.001)
	aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)
	aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp
	elseif (iNoteNumber == 39) then
	ifrq = 342
	iNseDur = 0.3 * giTR_808_SnareDrum_Decay
	iPchDur = 0.1 * giTR_808_SnareDrum_Decay
	iNoteDuration = iNseDur
	p3 = iNoteDuration
	aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
	apitch1 = oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch2 = oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
	apitch = (apitch1 + apitch2) * 0.75
	aenv2 = expon(1, iNoteDuration, 0.0005)
	anoise = noise(0.75, 0)
	anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
	anoise = buthp(anoise, 1000)
	kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
	anoise = butlp(anoise, kcf)
	aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp
	elseif (iNoteNumber == 51) then
	xtratim(0.1)
	kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)
	iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
	p3 = iNoteDuration
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55
	elseif (iNoteNumber == 49) then
	xtratim 0.1
	kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
	kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)
	iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
	p3 = iNoteDuration
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	ipw = 0.25
	a1 = vco2(0.5, kFrq1, 2, ipw)
	a2 = vco2(0.5, kFrq2, 2, ipw)
	a3 = vco2(0.5, kFrq3, 2, ipw)
	a4 = vco2(0.5, kFrq4, 2, ipw)
	a5 = vco2(0.5, kFrq5, 2, ipw)
	a6 = vco2(0.5, kFrq6, 2, ipw)
	amix = sum(a1, a2, a3, a4, a5, a6)
	amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
	amix = buthp(amix, 5000)
	amix = buthp(amix, 5000)
	amix = (amix * aenv)
	aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
	anoise = noise(0.8, 0)
	kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
	anoise = butlp(anoise, kcf)
	anoise = buthp(anoise, 8000)
	anoise = anoise * aenv
	aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55
	endif
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	iPositionMaxAmpWhenClose = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionMaxAmpWhenClose]
	iPositionReferenceDistance = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionReferenceDistance]
	iPositionRolloffFactor = giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionRolloffFactor]
	iX, iY, iZ dEd_position giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionOpcodeComboBoxIndex]
	iX *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXScale]
	iY *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYScale]
	iZ *= giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZScale]
	iX += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionXOffset]
	iY += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionYOffset]
	iZ += giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionZOffset]
	kX init iX
	kY init iY
	kZ init iZ
	kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
	kPositionReferenceDistance init iPositionReferenceDistance
	kPositionRolloffFactor init iPositionRolloffFactor
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[5][0] = a1
	gaInstrumentSignals[5][1] = a2
	gaInstrumentSignals[5][2] = a3
	gaInstrumentSignals[5][3] = a4
	gaInstrumentSignals[5][4] = aOut
	gaInstrumentSignals[5][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[5] == 0) then
	jsonStart_i("02c103e8fcef483292ebc49d3898ef96")
	jsonString_i("instanceName", "")
	jsonEnd_i()
	endif
	giTR_808_NoteIndex[5] = giTR_808_NoteIndex[5] + 1
	jsonStart_i("02c103e8fcef483292ebc49d3898ef96")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"time\\":%.3f}}",
	giTR_808_NoteIndex[5],
	times()))
	jsonEnd_i()
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	jsonStart_i("02c103e8fcef483292ebc49d3898ef96")
	jsonString_i("notes", sprintf("{\\"%d\\":{\\"xyz\\":[%.3f,%.3f,%.3f]}}",
	giTR_808_NoteIndex[5],
	iX, iY, iZ))
	jsonEnd_i()
	endif
	#end
	endif
	end:
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
	gSCcInfo_Triangle2Synth[] = fillarray( \\
	\\
	"positionEnabled", "bool", "true", "synced", "positionMaxAmpWhenClose", "number", "1", "synced", "positionReferenceDistance", "number", "0.1", "synced", "positionRolloffFactor", "number", "0.01", "synced", "positionOpcodeComboBoxIndex", "number", "0", "synced", "positionOpcode", "string", "", "synced", "positionXScale", "number", "100", "synced", "positionYScale", "number", "100", "synced", "positionZScale", "number", "100", "synced", "positionXOffset", "number", "0", "synced", "positionYOffset", "number", "0", "synced", "positionZOffset", "number", "0", "synced",
	\\
	"", "", "", "")
	#define gSCcInfo_Triangle2Synth_Count #52#
	#define CC_INFO_CHANNEL #0#
	#define CC_INFO_TYPE #1#
	#define CC_INFO_VALUE #2#
	#define CC_INFO_SYNC_TYPE #3#
	#define CC_NO_SYNC #0#
	#define CC_SYNC_TO_CHANNEL #1#
	#ifdef gSCcInfo_Triangle2Synth_Count
	if (lenarray(gSCcInfo_Triangle2Synth) == $gSCcInfo_Triangle2Synth_Count) then
	giCcCount_Triangle2Synth = (lenarray(gSCcInfo_Triangle2Synth) / 4) - 1
	reshapearray(gSCcInfo_Triangle2Synth, giCcCount_Triangle2Synth + 1, 4)
	endif
	#else
	giCcCount_Triangle2Synth = (lenarray(gSCcInfo_Triangle2Synth) / 4) - 1
	reshapearray(gSCcInfo_Triangle2Synth, giCcCount_Triangle2Synth + 1, 4)
	#end
	opcode ccIndex_Triangle2Synth, i, S
	SChannel xin
	kgoto end
	iI = 0
	while (iI < giCcCount_Triangle2Synth) do
	if (strcmp(gSCcInfo_Triangle2Synth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
	iI += 1
	od
	iI = -1
	end:
	xout iI
	endop
	gSCcValueDefaults_Triangle2Synth[] init giCcCount_Triangle2Synth
	giCcValueDefaults_Triangle2Synth[] init giCcCount_Triangle2Synth
	gSCcValues_Triangle2Synth[][] init 1, giCcCount_Triangle2Synth
	giCcValues_Triangle2Synth[][] init 1, giCcCount_Triangle2Synth
	gkCcValues_Triangle2Synth[][] init 1, giCcCount_Triangle2Synth
	gkCcSyncTypes_Triangle2Synth[][] init 1, giCcCount_Triangle2Synth
	instr Triangle2Synth_InitializeCcValues
	iI = 0
	while (iI < giCcCount_Triangle2Synth) do
	SType = gSCcInfo_Triangle2Synth[iI][$CC_INFO_TYPE]
	SValue = gSCcInfo_Triangle2Synth[iI][$CC_INFO_VALUE]
	iJ = 0
	while (iJ < 1) do
	iValue = -1
	if (strcmp(SType, "string") == 0) then
	gSCcValueDefaults_Triangle2Synth[iI] = SValue
	gSCcValues_Triangle2Synth[iJ][iI] = SValue
	else
	if (strcmp(SType, "bool") == 0) then
	if (strcmp(SValue, "false") == 0) then
	iValue = 0
	else
	iValue = 1
	endif
	elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
	iValue = strtod(SValue)
	endif
	giCcValueDefaults_Triangle2Synth[iI] = iValue
	giCcValues_Triangle2Synth[iJ][iI] = iValue
	endif
	iJ += 1
	od
	iI += 1
	od
	igoto end
	kI = 0
	while (kI < giCcCount_Triangle2Synth) do
	SType = gSCcInfo_Triangle2Synth[kI][$CC_INFO_TYPE]
	SValue = gSCcInfo_Triangle2Synth[kI][$CC_INFO_VALUE]
	SSyncType = gSCcInfo_Triangle2Synth[kI][$CC_INFO_SYNC_TYPE]
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
	gkCcValues_Triangle2Synth[kJ][kI] = kValue
	gkCcSyncTypes_Triangle2Synth[kJ][kI] = $CC_NO_SYNC
	if (strcmpk(SSyncType, "synced") == 0) then
	gkCcSyncTypes_Triangle2Synth[kJ][kI] = $CC_SYNC_TO_CHANNEL
	endif
	kJ += 1
	od
	kI += 1
	od
	turnoff
	end:
	endin
	event_i("i", "Triangle2Synth_InitializeCcValues", 0, -1)
	instr Triangle2Synth_CreateCcIndexes
	giCc_Triangle2Synth_positionEnabled init ccIndex_Triangle2Synth("positionEnabled")
	giCc_Triangle2Synth_positionMaxAmpWhenClose init ccIndex_Triangle2Synth("positionMaxAmpWhenClose")
	giCc_Triangle2Synth_positionReferenceDistance init ccIndex_Triangle2Synth("positionReferenceDistance")
	giCc_Triangle2Synth_positionRolloffFactor init ccIndex_Triangle2Synth("positionRolloffFactor")
	giCc_Triangle2Synth_positionOpcodeComboBoxIndex init ccIndex_Triangle2Synth("positionOpcodeComboBoxIndex")
	giCc_Triangle2Synth_positionOpcode init ccIndex_Triangle2Synth("positionOpcode")
	giCc_Triangle2Synth_positionXScale init ccIndex_Triangle2Synth("positionXScale")
	giCc_Triangle2Synth_positionYScale init ccIndex_Triangle2Synth("positionYScale")
	giCc_Triangle2Synth_positionZScale init ccIndex_Triangle2Synth("positionZScale")
	giCc_Triangle2Synth_positionXOffset init ccIndex_Triangle2Synth("positionXOffset")
	giCc_Triangle2Synth_positionYOffset init ccIndex_Triangle2Synth("positionYOffset")
	giCc_Triangle2Synth_positionZOffset init ccIndex_Triangle2Synth("positionZOffset")
	turnoff
	endin
	event_i("i", "Triangle2Synth_CreateCcIndexes", 0, -1)
	giTriangle2Synth_PlaybackVolumeAdjustment = 0.9
	giTriangle2Synth_PlaybackReverbAdjustment = 1.5
	giTriangle2Synth_NoteIndex[] init 1
	#ifdef IS_GENERATING_JSON
	setPluginUuid(6, 0, "fd575f03378047af835c19ef4f7d5991")
	instr Triangle2Synth_Json
	SJsonFile = sprintf("json/%s.0.json", "fd575f03378047af835c19ef4f7d5991")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
	fprints(SJsonFile, "}")
	turnoff
	endin
	#end
	gkNoteNumberLfo init 0
	instr GlobalNoteNumberLfo_10
	gkNoteNumberLfo = lfo(33, .03, 1)
	endin
	event_i("i", "GlobalNoteNumberLfo_10", 0, -1)
	instr 10
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_Triangle2Synth[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_Triangle2Synth[0][iCcIndex] = strget(iCcValue)
	else
	giCcValues_Triangle2Synth[0][iCcIndex] = iCcValue
	gkCcValues_Triangle2Synth[0][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	iOrcInstanceIndex = 0
	aOut = 0
	a1 = 0
	a2 = 0
	a3 = 0
	a4 = 0
	kAmp init 0.333 * (iVelocity / 127)
	kNoteNumber init iNoteNumber
	kNoteNumberLfo init 0
	kNoteNumberLfo = lfo(0.333, gkNoteNumberLfo, 1)
	kCps = cpsmidinn(kNoteNumber + kNoteNumberLfo)
	aOut = vco2(kAmp, kCps, 12)
	iEnvelopeA = 0.01
	iEnvelopeD = 0.1
	iEnvelopeS = 0.667
	iEnvelopeR = 0.1
	iEnvelopeS_decayTime = 0.333 + 33 * (1 - iNoteNumber / 127)
	iEnvelopeS_decayAmountMinimum = 0.001 * (1 - iNoteNumber / 127)
	aOut *= mxadsr:a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)
	iEnvelopeS_decayStartTime = p2 + iEnvelopeA + iEnvelopeD
	iEnvelopeS_decayEndTime = iEnvelopeS_decayStartTime + iEnvelopeS_decayTime
	aEnvelopeS_decayAmount init 1
	kTime = time_k()
	if (kTime >= iEnvelopeS_decayStartTime && kTime < iEnvelopeS_decayEndTime) then
	aEnvelopeS_decayAmount = expon(1, iEnvelopeS_decayTime, iEnvelopeS_decayAmountMinimum)
	endif
	aOut *= aEnvelopeS_decayAmount
	aOut = tone(aOut, 999 + 333)
	if (gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionEnabled] == 1) then
	iPositionPortTime = 50 / giKR
	kPositionMaxAmpWhenClose = portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionMaxAmpWhenClose], iPositionPortTime)
	kPositionReferenceDistance = portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionReferenceDistance], iPositionPortTime)
	kPositionRolloffFactor = portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionRolloffFactor], iPositionPortTime)
	kX, kY, kZ dEd_position gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionOpcodeComboBoxIndex]
	kX *= portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionXScale], iPositionPortTime)
	kY *= portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionYScale], iPositionPortTime)
	kZ *= portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionZScale], iPositionPortTime)
	kX += portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionXOffset], iPositionPortTime)
	kY += portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionYOffset], iPositionPortTime)
	kZ += portk(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionZOffset], iPositionPortTime)
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance, kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = 0
	a2 = 0
	a3 = 0
	a4 = aOut
	endif
	gaInstrumentSignals[6][0] = a1
	gaInstrumentSignals[6][1] = a2
	gaInstrumentSignals[6][2] = a3
	gaInstrumentSignals[6][3] = a4
	gaInstrumentSignals[6][4] = aOut
	gaInstrumentSignals[6][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTriangle2Synth_NoteIndex[0] == 0) then
	scoreline_i("i \\"Triangle2Synth_Json\\" 0 0")
	endif
	giTriangle2Synth_NoteIndex[0] = giTriangle2Synth_NoteIndex[0] + 1
	SJsonFile = sprintf("json/%s.%d.json",
	"fd575f03378047af835c19ef4f7d5991",
	giTriangle2Synth_NoteIndex[0])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f}}", times())
	ficlose(SJsonFile)
	#end
	endif
	end:
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
	gSCcInfo_Triangle4BassMonoSynth[] = fillarray( \\
	\\
	"positionEnabled", "bool", "true", "synced", "positionMaxAmpWhenClose", "number", "1", "synced", "positionReferenceDistance", "number", "0.1", "synced", "positionRolloffFactor", "number", "0.01", "synced", "positionOpcodeComboBoxIndex", "number", "0", "synced", "positionOpcode", "string", "", "synced", "positionXScale", "number", "100", "synced", "positionYScale", "number", "100", "synced", "positionZScale", "number", "100", "synced", "positionXOffset", "number", "0", "synced", "positionYOffset", "number", "0", "synced", "positionZOffset", "number", "0", "synced",
	\\
	"", "", "", "")
	#define gSCcInfo_Triangle4BassMonoSynth_Count #52#
	#define CC_INFO_CHANNEL #0#
	#define CC_INFO_TYPE #1#
	#define CC_INFO_VALUE #2#
	#define CC_INFO_SYNC_TYPE #3#
	#define CC_NO_SYNC #0#
	#define CC_SYNC_TO_CHANNEL #1#
	#ifdef gSCcInfo_Triangle4BassMonoSynth_Count
	if (lenarray(gSCcInfo_Triangle4BassMonoSynth) == $gSCcInfo_Triangle4BassMonoSynth_Count) then
	giCcCount_Triangle4BassMonoSynth = (lenarray(gSCcInfo_Triangle4BassMonoSynth) / 4) - 1
	reshapearray(gSCcInfo_Triangle4BassMonoSynth, giCcCount_Triangle4BassMonoSynth + 1, 4)
	endif
	#else
	giCcCount_Triangle4BassMonoSynth = (lenarray(gSCcInfo_Triangle4BassMonoSynth) / 4) - 1
	reshapearray(gSCcInfo_Triangle4BassMonoSynth, giCcCount_Triangle4BassMonoSynth + 1, 4)
	#end
	opcode ccIndex_Triangle4BassMonoSynth, i, S
	SChannel xin
	kgoto end
	iI = 0
	while (iI < giCcCount_Triangle4BassMonoSynth) do
	if (strcmp(gSCcInfo_Triangle4BassMonoSynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
	iI += 1
	od
	iI = -1
	end:
	xout iI
	endop
	gSCcValueDefaults_Triangle4BassMonoSynth[] init giCcCount_Triangle4BassMonoSynth
	giCcValueDefaults_Triangle4BassMonoSynth[] init giCcCount_Triangle4BassMonoSynth
	gSCcValues_Triangle4BassMonoSynth[][] init 2, giCcCount_Triangle4BassMonoSynth
	giCcValues_Triangle4BassMonoSynth[][] init 2, giCcCount_Triangle4BassMonoSynth
	gkCcValues_Triangle4BassMonoSynth[][] init 2, giCcCount_Triangle4BassMonoSynth
	gkCcSyncTypes_Triangle4BassMonoSynth[][] init 2, giCcCount_Triangle4BassMonoSynth
	instr Triangle4BassMonoSynth_InitializeCcValues
	iI = 0
	while (iI < giCcCount_Triangle4BassMonoSynth) do
	SType = gSCcInfo_Triangle4BassMonoSynth[iI][$CC_INFO_TYPE]
	SValue = gSCcInfo_Triangle4BassMonoSynth[iI][$CC_INFO_VALUE]
	iJ = 0
	while (iJ < 2) do
	iValue = -1
	if (strcmp(SType, "string") == 0) then
	gSCcValueDefaults_Triangle4BassMonoSynth[iI] = SValue
	gSCcValues_Triangle4BassMonoSynth[iJ][iI] = SValue
	else
	if (strcmp(SType, "bool") == 0) then
	if (strcmp(SValue, "false") == 0) then
	iValue = 0
	else
	iValue = 1
	endif
	elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
	iValue = strtod(SValue)
	endif
	giCcValueDefaults_Triangle4BassMonoSynth[iI] = iValue
	giCcValues_Triangle4BassMonoSynth[iJ][iI] = iValue
	endif
	iJ += 1
	od
	iI += 1
	od
	igoto end
	kI = 0
	while (kI < giCcCount_Triangle4BassMonoSynth) do
	SType = gSCcInfo_Triangle4BassMonoSynth[kI][$CC_INFO_TYPE]
	SValue = gSCcInfo_Triangle4BassMonoSynth[kI][$CC_INFO_VALUE]
	SSyncType = gSCcInfo_Triangle4BassMonoSynth[kI][$CC_INFO_SYNC_TYPE]
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
	gkCcValues_Triangle4BassMonoSynth[kJ][kI] = kValue
	gkCcSyncTypes_Triangle4BassMonoSynth[kJ][kI] = $CC_NO_SYNC
	if (strcmpk(SSyncType, "synced") == 0) then
	gkCcSyncTypes_Triangle4BassMonoSynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
	endif
	kJ += 1
	od
	kI += 1
	od
	turnoff
	end:
	endin
	event_i("i", "Triangle4BassMonoSynth_InitializeCcValues", 0, -1)
	instr Triangle4BassMonoSynth_CreateCcIndexes
	giCc_Triangle4BassMonoSynth_positionEnabled init ccIndex_Triangle4BassMonoSynth("positionEnabled")
	giCc_Triangle4BassMonoSynth_positionMaxAmpWhenClose init ccIndex_Triangle4BassMonoSynth("positionMaxAmpWhenClose")
	giCc_Triangle4BassMonoSynth_positionReferenceDistance init ccIndex_Triangle4BassMonoSynth("positionReferenceDistance")
	giCc_Triangle4BassMonoSynth_positionRolloffFactor init ccIndex_Triangle4BassMonoSynth("positionRolloffFactor")
	giCc_Triangle4BassMonoSynth_positionOpcodeComboBoxIndex init ccIndex_Triangle4BassMonoSynth("positionOpcodeComboBoxIndex")
	giCc_Triangle4BassMonoSynth_positionOpcode init ccIndex_Triangle4BassMonoSynth("positionOpcode")
	giCc_Triangle4BassMonoSynth_positionXScale init ccIndex_Triangle4BassMonoSynth("positionXScale")
	giCc_Triangle4BassMonoSynth_positionYScale init ccIndex_Triangle4BassMonoSynth("positionYScale")
	giCc_Triangle4BassMonoSynth_positionZScale init ccIndex_Triangle4BassMonoSynth("positionZScale")
	giCc_Triangle4BassMonoSynth_positionXOffset init ccIndex_Triangle4BassMonoSynth("positionXOffset")
	giCc_Triangle4BassMonoSynth_positionYOffset init ccIndex_Triangle4BassMonoSynth("positionYOffset")
	giCc_Triangle4BassMonoSynth_positionZOffset init ccIndex_Triangle4BassMonoSynth("positionZOffset")
	turnoff
	endin
	event_i("i", "Triangle4BassMonoSynth_CreateCcIndexes", 0, -1)
	gkTriangle4BassMonoSynth_ActiveNoteCount[] init 2
	giTriangle4BassMonoSynth_MonoHandlerIsActive[] init 2
	giTriangle4BassMonoSynth_NoteIndex[] init 2
	gkTriangle4BassMonoSynth_NoteNumber[] init 2
	giTriangle4BassMonoSynth_PlaybackVolumeAdjustment = 0.9
	giTriangle4BassMonoSynth_PlaybackReverbAdjustment = 1.5
	#ifdef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
	#undef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
	#end
	#ifdef TriangleBassMonoSynth_NoteNumberPortamentoTime
	#undef TriangleBassMonoSynth_NoteNumberPortamentoTime
	#end
	#ifdef TriangleMonoSynth_VcoBandwith
	#undef TriangleMonoSynth_VcoBandwith
	#end
	#define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05 #
	#define TriangleMonoSynth_NoteNumberPortamentoTime # 0.025 #
	#define TriangleMonoSynth_VcoBandwith # 0.075 #
	#ifndef TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
	#define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime #0.05#
	#end
	#ifndef TriangleMonoSynth_NoteNumberPortamentoTime
	#define TriangleMonoSynth_NoteNumberPortamentoTime #0.01#
	#end
	#ifndef TriangleMonoSynth_VcoBandwith
	#define TriangleMonoSynth_VcoBandwith #0.5#
	#end
	#ifdef IS_GENERATING_JSON
	instr Json_11
	jsonStart_i("ab018f191c70470f98ac3becb76e6d13")
	jsonString_i("instanceName", "\\"\\"")
	turnoff
	endin
	#end
	instr 11
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_Triangle4BassMonoSynth[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_Triangle4BassMonoSynth[0][iCcIndex] = strget(iCcValue)
	else
	giCcValues_Triangle4BassMonoSynth[0][iCcIndex] = iCcValue
	gkCcValues_Triangle4BassMonoSynth[0][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 2) then
	gkTriangle4BassMonoSynth_ActiveNoteCount[0] =
	gkTriangle4BassMonoSynth_ActiveNoteCount[0] - 1
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	kActiveNoteCountIncremented init 0
	if (kActiveNoteCountIncremented == 0) then
	gkTriangle4BassMonoSynth_ActiveNoteCount[0] =
	gkTriangle4BassMonoSynth_ActiveNoteCount[0] + 1
	kActiveNoteCountIncremented = 1
	endif
	xtratim(1 / kr)
	kReleased = release()
	if (kReleased == 1) then
	event("i", int(p1), 0, 1, 2, 0, 0)
	turnoff
	endif
	if (giTriangle4BassMonoSynth_MonoHandlerIsActive[0] == 0) then
	event_i("i", int(p1) + .9999 , 0, -1, 6, 0, 0)
	endif
	gkTriangle4BassMonoSynth_NoteNumber[0] = iNoteNumber
	#ifdef IS_GENERATING_JSON
	if (giTriangle4BassMonoSynth_NoteIndex[0] == 0) then
	scoreline_i("i \\"Triangle4BassMonoSynth_Json\\" 0 0")
	endif
	giTriangle4BassMonoSynth_NoteIndex[0] = giTriangle4BassMonoSynth_NoteIndex[0] + 1
	SJsonFile = sprintf("json/%s.%d.json",
	"ab018f191c70470f98ac3becb76e6d13",
	giTriangle4BassMonoSynth_NoteIndex[0])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f}}", times())
	ficlose(SJsonFile)
	#end
	elseif (iEventType == 7) then
	giTriangle4BassMonoSynth_MonoHandlerIsActive[0] = 0
	turnoff
	elseif (iEventType == 6) then
	giTriangle4BassMonoSynth_MonoHandlerIsActive[0] = 1
	iOrcInstanceIndex = 0
	iAmp = 0.4
	aOut = 0
	a1 = 0
	a2 = 0
	a3 = 0
	a4 = 0
	iVolumeEnvelopeSlope = giSecondsPerSample / $TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
	kVolumeEnvelopeModifier init 0
	kActiveNoteCount = gkTriangle4BassMonoSynth_ActiveNoteCount[0]
	kActiveNoteCountPrevious init 0
	kNoteNumberWhenActivated init 0
	kActiveNoteCountChanged = 0
	kNoteNumberNeedsPortamento init 0
	if (changed2(kActiveNoteCount) == 1 || kActiveNoteCountPrevious == 0) then
	if (kActiveNoteCount == 1 && kActiveNoteCountPrevious == 0) then
	kNoteNumberWhenActivated = gkTriangle4BassMonoSynth_NoteNumber[0]
	kActiveNoteCountChanged = 1
	kNoteNumberNeedsPortamento = 0
	kVolumeEnvelopeModifier = iVolumeEnvelopeSlope
	elseif (kActiveNoteCount == 0) then
	kVolumeEnvelopeModifier = -iVolumeEnvelopeSlope
	endif
	kActiveNoteCountPrevious = kActiveNoteCount
	endif
	aVolumeEnvelope init 0
	kVolumeEnvelope init 0
	if (kVolumeEnvelopeModifier == 0) then
	aVolumeEnvelope = kVolumeEnvelope
	else
	kI = 0
	while (kI < ksmps) do
	vaset(kVolumeEnvelope, kI, aVolumeEnvelope)
	kVolumeEnvelope += kVolumeEnvelopeModifier
	if (kVolumeEnvelope < 0) then
	kVolumeEnvelope = 0
	kVolumeEnvelopeModifier = 0
	elseif (kVolumeEnvelope > 1) then
	kVolumeEnvelope = 1
	kVolumeEnvelopeModifier = 0
	endif
	kI += 1
	od
	endif
	if (kVolumeEnvelope == 0) then
	if (kActiveNoteCount == 0) then
	event("i", int(p1), 0, 1, 7, 0, 0)
	turnoff
	endif
	kgoto end__mono_handler
	endif
	kNoteNumber init 0
	kCurrentNoteNumber = gkTriangle4BassMonoSynth_NoteNumber[0]
	if (changed2(kCurrentNoteNumber) == 1) then
	if (kActiveNoteCountChanged == 0) then
	kNoteNumberNeedsPortamento = 1
	endif
	endif
	kNoteNumberPortamentoTime init 0
	if (kNoteNumberNeedsPortamento == 0) then
	kNoteNumberPortamentoTime = 0
	else
	kNoteNumberPortamentoTime = $TriangleMonoSynth_NoteNumberPortamentoTime
	endif
	kNoteNumber = portk(kCurrentNoteNumber, kNoteNumberPortamentoTime)
	kCps = cpsmidinn(kNoteNumber)
	aOut = vco2(iAmp, kCps, 12, 0.5, 0, $TriangleMonoSynth_VcoBandwith)
	aOut *= aVolumeEnvelope
	if (gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionEnabled] == 1) then
	iPositionPortTime = 50 / giKR
	kPositionMaxAmpWhenClose = portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionMaxAmpWhenClose], iPositionPortTime)
	kPositionReferenceDistance = portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionReferenceDistance], iPositionPortTime)
	kPositionRolloffFactor = portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionRolloffFactor], iPositionPortTime)
	kX, kY, kZ dEd_position gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionOpcodeComboBoxIndex]
	kX *= portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXScale], iPositionPortTime)
	kY *= portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYScale], iPositionPortTime)
	kZ *= portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZScale], iPositionPortTime)
	kX += portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXOffset], iPositionPortTime)
	kY += portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYOffset], iPositionPortTime)
	kZ += portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZOffset], iPositionPortTime)
	iScaleFactorX = random:i(-20, 20)
	kX *= iScaleFactorX
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance, kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	end__mono_handler:
	gaInstrumentSignals[7][0] = a1
	gaInstrumentSignals[7][1] = a2
	gaInstrumentSignals[7][2] = a3
	gaInstrumentSignals[7][3] = a4
	gaInstrumentSignals[7][4] = aOut
	gaInstrumentSignals[7][5] = aOut
	endif
	end:
	endin
	#ifdef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
	#undef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
	#end
	#ifdef TriangleBassMonoSynth_NoteNumberPortamentoTime
	#undef TriangleBassMonoSynth_NoteNumberPortamentoTime
	#end
	#ifdef TriangleMonoSynth_VcoBandwith
	#undef TriangleMonoSynth_VcoBandwith
	#end
	#define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05 #
	#define TriangleMonoSynth_NoteNumberPortamentoTime # 0.025 #
	#define TriangleMonoSynth_VcoBandwith # 0.075 #
	#ifndef TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
	#define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime #0.05#
	#end
	#ifndef TriangleMonoSynth_NoteNumberPortamentoTime
	#define TriangleMonoSynth_NoteNumberPortamentoTime #0.01#
	#end
	#ifndef TriangleMonoSynth_VcoBandwith
	#define TriangleMonoSynth_VcoBandwith #0.5#
	#end
	#ifdef IS_GENERATING_JSON
	instr Json_12
	jsonStart_i("b0ba6f144fac4f668ba6981c691277d6")
	jsonString_i("instanceName", "\\"\\"")
	turnoff
	endin
	#end
	instr 12
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_Triangle4BassMonoSynth[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_Triangle4BassMonoSynth[1][iCcIndex] = strget(iCcValue)
	else
	giCcValues_Triangle4BassMonoSynth[1][iCcIndex] = iCcValue
	gkCcValues_Triangle4BassMonoSynth[1][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 2) then
	gkTriangle4BassMonoSynth_ActiveNoteCount[1] =
	gkTriangle4BassMonoSynth_ActiveNoteCount[1] - 1
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	kActiveNoteCountIncremented init 0
	if (kActiveNoteCountIncremented == 0) then
	gkTriangle4BassMonoSynth_ActiveNoteCount[1] =
	gkTriangle4BassMonoSynth_ActiveNoteCount[1] + 1
	kActiveNoteCountIncremented = 1
	endif
	xtratim(1 / kr)
	kReleased = release()
	if (kReleased == 1) then
	event("i", int(p1), 0, 1, 2, 0, 0)
	turnoff
	endif
	if (giTriangle4BassMonoSynth_MonoHandlerIsActive[1] == 0) then
	event_i("i", int(p1) + .9999 , 0, -1, 6, 0, 0)
	endif
	gkTriangle4BassMonoSynth_NoteNumber[1] = iNoteNumber
	#ifdef IS_GENERATING_JSON
	if (giTriangle4BassMonoSynth_NoteIndex[1] == 0) then
	scoreline_i("i \\"Triangle4BassMonoSynth_Json\\" 0 0")
	endif
	giTriangle4BassMonoSynth_NoteIndex[1] = giTriangle4BassMonoSynth_NoteIndex[1] + 1
	SJsonFile = sprintf("json/%s.%d.json",
	"b0ba6f144fac4f668ba6981c691277d6",
	giTriangle4BassMonoSynth_NoteIndex[1])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f}}", times())
	ficlose(SJsonFile)
	#end
	elseif (iEventType == 7) then
	giTriangle4BassMonoSynth_MonoHandlerIsActive[1] = 0
	turnoff
	elseif (iEventType == 6) then
	giTriangle4BassMonoSynth_MonoHandlerIsActive[1] = 1
	iOrcInstanceIndex = 1
	iAmp = 0.4
	aOut = 0
	a1 = 0
	a2 = 0
	a3 = 0
	a4 = 0
	iVolumeEnvelopeSlope = giSecondsPerSample / $TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
	kVolumeEnvelopeModifier init 0
	kActiveNoteCount = gkTriangle4BassMonoSynth_ActiveNoteCount[1]
	kActiveNoteCountPrevious init 0
	kNoteNumberWhenActivated init 0
	kActiveNoteCountChanged = 0
	kNoteNumberNeedsPortamento init 0
	if (changed2(kActiveNoteCount) == 1 || kActiveNoteCountPrevious == 0) then
	if (kActiveNoteCount == 1 && kActiveNoteCountPrevious == 0) then
	kNoteNumberWhenActivated = gkTriangle4BassMonoSynth_NoteNumber[1]
	kActiveNoteCountChanged = 1
	kNoteNumberNeedsPortamento = 0
	kVolumeEnvelopeModifier = iVolumeEnvelopeSlope
	elseif (kActiveNoteCount == 0) then
	kVolumeEnvelopeModifier = -iVolumeEnvelopeSlope
	endif
	kActiveNoteCountPrevious = kActiveNoteCount
	endif
	aVolumeEnvelope init 0
	kVolumeEnvelope init 0
	if (kVolumeEnvelopeModifier == 0) then
	aVolumeEnvelope = kVolumeEnvelope
	else
	kI = 0
	while (kI < ksmps) do
	vaset(kVolumeEnvelope, kI, aVolumeEnvelope)
	kVolumeEnvelope += kVolumeEnvelopeModifier
	if (kVolumeEnvelope < 0) then
	kVolumeEnvelope = 0
	kVolumeEnvelopeModifier = 0
	elseif (kVolumeEnvelope > 1) then
	kVolumeEnvelope = 1
	kVolumeEnvelopeModifier = 0
	endif
	kI += 1
	od
	endif
	if (kVolumeEnvelope == 0) then
	if (kActiveNoteCount == 0) then
	event("i", int(p1), 0, 1, 7, 0, 0)
	turnoff
	endif
	kgoto end__mono_handler
	endif
	kNoteNumber init 0
	kCurrentNoteNumber = gkTriangle4BassMonoSynth_NoteNumber[1]
	if (changed2(kCurrentNoteNumber) == 1) then
	if (kActiveNoteCountChanged == 0) then
	kNoteNumberNeedsPortamento = 1
	endif
	endif
	kNoteNumberPortamentoTime init 0
	if (kNoteNumberNeedsPortamento == 0) then
	kNoteNumberPortamentoTime = 0
	else
	kNoteNumberPortamentoTime = $TriangleMonoSynth_NoteNumberPortamentoTime
	endif
	kNoteNumber = portk(kCurrentNoteNumber, kNoteNumberPortamentoTime)
	kCps = cpsmidinn(kNoteNumber)
	aOut = vco2(iAmp, kCps, 12, 0.5, 0, $TriangleMonoSynth_VcoBandwith)
	aOut *= aVolumeEnvelope
	if (gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionEnabled] == 1) then
	iPositionPortTime = 50 / giKR
	kPositionMaxAmpWhenClose = portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionMaxAmpWhenClose], iPositionPortTime)
	kPositionReferenceDistance = portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionReferenceDistance], iPositionPortTime)
	kPositionRolloffFactor = portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionRolloffFactor], iPositionPortTime)
	kX, kY, kZ dEd_position gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionOpcodeComboBoxIndex]
	kX *= portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXScale], iPositionPortTime)
	kY *= portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYScale], iPositionPortTime)
	kZ *= portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZScale], iPositionPortTime)
	kX += portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXOffset], iPositionPortTime)
	kY += portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYOffset], iPositionPortTime)
	kZ += portk(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZOffset], iPositionPortTime)
	iScaleFactorX = random:i(-20, 20)
	kX *= iScaleFactorX
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance, kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	end__mono_handler:
	gaInstrumentSignals[8][0] = a1
	gaInstrumentSignals[8][1] = a2
	gaInstrumentSignals[8][2] = a3
	gaInstrumentSignals[8][3] = a4
	gaInstrumentSignals[8][4] = aOut
	gaInstrumentSignals[8][5] = aOut
	endif
	end:
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
	gSCcInfo_TriangleUdoTriggerSynth[] = fillarray( \\
	\\
	"positionEnabled", "bool", "true", "synced", "positionMaxAmpWhenClose", "number", "1", "synced", "positionReferenceDistance", "number", "0.1", "synced", "positionRolloffFactor", "number", "0.01", "synced", "positionOpcodeComboBoxIndex", "number", "0", "synced", "positionOpcode", "string", "", "synced", "positionXScale", "number", "100", "synced", "positionYScale", "number", "100", "synced", "positionZScale", "number", "100", "synced", "positionXOffset", "number", "0", "synced", "positionYOffset", "number", "0", "synced", "positionZOffset", "number", "0", "synced",
	\\
	"", "", "", "")
	#define gSCcInfo_TriangleUdoTriggerSynth_Count #52#
	#define CC_INFO_CHANNEL #0#
	#define CC_INFO_TYPE #1#
	#define CC_INFO_VALUE #2#
	#define CC_INFO_SYNC_TYPE #3#
	#define CC_NO_SYNC #0#
	#define CC_SYNC_TO_CHANNEL #1#
	#ifdef gSCcInfo_TriangleUdoTriggerSynth_Count
	if (lenarray(gSCcInfo_TriangleUdoTriggerSynth) == $gSCcInfo_TriangleUdoTriggerSynth_Count) then
	giCcCount_TriangleUdoTriggerSynth = (lenarray(gSCcInfo_TriangleUdoTriggerSynth) / 4) - 1
	reshapearray(gSCcInfo_TriangleUdoTriggerSynth, giCcCount_TriangleUdoTriggerSynth + 1, 4)
	endif
	#else
	giCcCount_TriangleUdoTriggerSynth = (lenarray(gSCcInfo_TriangleUdoTriggerSynth) / 4) - 1
	reshapearray(gSCcInfo_TriangleUdoTriggerSynth, giCcCount_TriangleUdoTriggerSynth + 1, 4)
	#end
	opcode ccIndex_TriangleUdoTriggerSynth, i, S
	SChannel xin
	kgoto end
	iI = 0
	while (iI < giCcCount_TriangleUdoTriggerSynth) do
	if (strcmp(gSCcInfo_TriangleUdoTriggerSynth[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
	iI += 1
	od
	iI = -1
	end:
	xout iI
	endop
	gSCcValueDefaults_TriangleUdoTriggerSynth[] init giCcCount_TriangleUdoTriggerSynth
	giCcValueDefaults_TriangleUdoTriggerSynth[] init giCcCount_TriangleUdoTriggerSynth
	gSCcValues_TriangleUdoTriggerSynth[][] init 1, giCcCount_TriangleUdoTriggerSynth
	giCcValues_TriangleUdoTriggerSynth[][] init 1, giCcCount_TriangleUdoTriggerSynth
	gkCcValues_TriangleUdoTriggerSynth[][] init 1, giCcCount_TriangleUdoTriggerSynth
	gkCcSyncTypes_TriangleUdoTriggerSynth[][] init 1, giCcCount_TriangleUdoTriggerSynth
	instr TriangleUdoTriggerSynth_InitializeCcValues
	iI = 0
	while (iI < giCcCount_TriangleUdoTriggerSynth) do
	SType = gSCcInfo_TriangleUdoTriggerSynth[iI][$CC_INFO_TYPE]
	SValue = gSCcInfo_TriangleUdoTriggerSynth[iI][$CC_INFO_VALUE]
	iJ = 0
	while (iJ < 1) do
	iValue = -1
	if (strcmp(SType, "string") == 0) then
	gSCcValueDefaults_TriangleUdoTriggerSynth[iI] = SValue
	gSCcValues_TriangleUdoTriggerSynth[iJ][iI] = SValue
	else
	if (strcmp(SType, "bool") == 0) then
	if (strcmp(SValue, "false") == 0) then
	iValue = 0
	else
	iValue = 1
	endif
	elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
	iValue = strtod(SValue)
	endif
	giCcValueDefaults_TriangleUdoTriggerSynth[iI] = iValue
	giCcValues_TriangleUdoTriggerSynth[iJ][iI] = iValue
	endif
	iJ += 1
	od
	iI += 1
	od
	igoto end
	kI = 0
	while (kI < giCcCount_TriangleUdoTriggerSynth) do
	SType = gSCcInfo_TriangleUdoTriggerSynth[kI][$CC_INFO_TYPE]
	SValue = gSCcInfo_TriangleUdoTriggerSynth[kI][$CC_INFO_VALUE]
	SSyncType = gSCcInfo_TriangleUdoTriggerSynth[kI][$CC_INFO_SYNC_TYPE]
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
	gkCcValues_TriangleUdoTriggerSynth[kJ][kI] = kValue
	gkCcSyncTypes_TriangleUdoTriggerSynth[kJ][kI] = $CC_NO_SYNC
	if (strcmpk(SSyncType, "synced") == 0) then
	gkCcSyncTypes_TriangleUdoTriggerSynth[kJ][kI] = $CC_SYNC_TO_CHANNEL
	endif
	kJ += 1
	od
	kI += 1
	od
	turnoff
	end:
	endin
	event_i("i", "TriangleUdoTriggerSynth_InitializeCcValues", 0, -1)
	instr TriangleUdoTriggerSynth_CreateCcIndexes
	giCc_TriangleUdoTriggerSynth_positionEnabled init ccIndex_TriangleUdoTriggerSynth("positionEnabled")
	giCc_TriangleUdoTriggerSynth_positionMaxAmpWhenClose init ccIndex_TriangleUdoTriggerSynth("positionMaxAmpWhenClose")
	giCc_TriangleUdoTriggerSynth_positionReferenceDistance init ccIndex_TriangleUdoTriggerSynth("positionReferenceDistance")
	giCc_TriangleUdoTriggerSynth_positionRolloffFactor init ccIndex_TriangleUdoTriggerSynth("positionRolloffFactor")
	giCc_TriangleUdoTriggerSynth_positionOpcodeComboBoxIndex init ccIndex_TriangleUdoTriggerSynth("positionOpcodeComboBoxIndex")
	giCc_TriangleUdoTriggerSynth_positionOpcode init ccIndex_TriangleUdoTriggerSynth("positionOpcode")
	giCc_TriangleUdoTriggerSynth_positionXScale init ccIndex_TriangleUdoTriggerSynth("positionXScale")
	giCc_TriangleUdoTriggerSynth_positionYScale init ccIndex_TriangleUdoTriggerSynth("positionYScale")
	giCc_TriangleUdoTriggerSynth_positionZScale init ccIndex_TriangleUdoTriggerSynth("positionZScale")
	giCc_TriangleUdoTriggerSynth_positionXOffset init ccIndex_TriangleUdoTriggerSynth("positionXOffset")
	giCc_TriangleUdoTriggerSynth_positionYOffset init ccIndex_TriangleUdoTriggerSynth("positionYOffset")
	giCc_TriangleUdoTriggerSynth_positionZOffset init ccIndex_TriangleUdoTriggerSynth("positionZOffset")
	turnoff
	endin
	event_i("i", "TriangleUdoTriggerSynth_CreateCcIndexes", 0, -1)
	giTriangle3MonoSynth_PlaybackVolumeAdjustment = 0.9
	giTriangle3MonoSynth_PlaybackReverbAdjustment = 1.5
	giTriangle3MonoSynth_NoteIndex[] init 1
	gkTriangle3MonoSynth_NoteNumber[] init 1
	opcode dEd_TriangleUdo1, a, 0
	xtratim(5)
	iAmp = 0.4
	iCps = cpsmidinn:i(60)
	aOut = vco2(iAmp, iCps, 12)
	xout aOut
	endop
	#ifdef IS_GENERATING_JSON
	setPluginUuid(9, 0, "f6341a2a81244ea79dd0e1486eb93386")
	instr TR_808_Json
	SJsonFile = sprintf("json/%s.0.json", "f6341a2a81244ea79dd0e1486eb93386")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
	fprints(SJsonFile, "}")
	turnoff
	endin
	#end
	instr 13
	iOrcInstanceIndex = 0
	iEventType = p4
	if (iEventType == 4) then
	iCcIndex = p5
	iCcValue = p6
	if (strcmp(gSCcInfo_TriangleUdoTriggerSynth[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
	gSCcValues_TriangleUdoTriggerSynth[0][iCcIndex] = strget(iCcValue)
	else
	giCcValues_TriangleUdoTriggerSynth[0][iCcIndex] = iCcValue
	gkCcValues_TriangleUdoTriggerSynth[0][iCcIndex] = iCcValue
	endif
	turnoff
	elseif (iEventType == 1) then
	iNoteNumber = p5
	iVelocity = p6
	aOut init 0
	if (iNoteNumber == 60) then
	aOut = dEd_TriangleUdo1()
	endif
	if (giCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionEnabled] == 1) then
	iPositionPortTime = 50 / giKR
	kPositionMaxAmpWhenClose = portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionMaxAmpWhenClose], iPositionPortTime)
	kPositionReferenceDistance = portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionReferenceDistance], iPositionPortTime)
	kPositionRolloffFactor = portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionRolloffFactor], iPositionPortTime)
	kX, kY, kZ dEd_position gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionOpcodeComboBoxIndex]
	kX *= portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionXScale], iPositionPortTime)
	kY *= portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionYScale], iPositionPortTime)
	kZ *= portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionZScale], iPositionPortTime)
	kX += portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionXOffset], iPositionPortTime)
	kY += portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionYOffset], iPositionPortTime)
	kZ += portk(gkCcValues_TriangleUdoTriggerSynth[iOrcInstanceIndex][giCc_TriangleUdoTriggerSynth_positionZOffset], iPositionPortTime)
	kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
	kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
	kPositionRolloffFactor)
	aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)
	AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
	a1 = gkAmbisonicChannelGains[0] * aOut
	a2 = gkAmbisonicChannelGains[1] * aOut
	a3 = gkAmbisonicChannelGains[2] * aOut
	a4 = gkAmbisonicChannelGains[3] * aOut
	else
	a1 = aOut
	a2 = 0
	a3 = 0
	a4 = 0
	endif
	gaInstrumentSignals[9][0] = a1
	gaInstrumentSignals[9][1] = a2
	gaInstrumentSignals[9][2] = a3
	gaInstrumentSignals[9][3] = a4
	gaInstrumentSignals[9][4] = aOut
	gaInstrumentSignals[9][5] = aOut
	#ifdef IS_GENERATING_JSON
	if (giTR_808_NoteIndex[0] == 0) then
	scoreline_i("i \\"TR_808_Json\\" 0 0")
	endif
	giTR_808_NoteIndex[0] = giTR_808_NoteIndex[0] + 1
	SJsonFile = sprintf("json/%s.%d.json",
	"f6341a2a81244ea79dd0e1486eb93386",
	giTR_808_NoteIndex[0])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f}}", times())
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
	#define gSCcInfo_Reverb_Count #28#
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
	gSCcValueDefaults_Reverb[] init giCcCount_Reverb
	giCcValueDefaults_Reverb[] init giCcCount_Reverb
	gSCcValues_Reverb[][] init 1, giCcCount_Reverb
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
	if (strcmp(SType, "string") == 0) then
	gSCcValueDefaults_Reverb[iI] = SValue
	gSCcValues_Reverb[iJ][iI] = SValue
	else
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
	endif
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
	instr 16
	#ifdef IS_GENERATING_JSON
	goto end
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
	if (10 < gi_instrumentCount) then
	aIn[kI] = gaInstrumentSignals[10][kJ]
	else
	iAuxTrackIndex = 10 - gi_instrumentCount
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
	iAuxTrackIndex = 10
	if (iAuxTrackIndex >= gi_instrumentCount) then
	iAuxTrackIndex -= gi_instrumentCount
	endif
	ga_auxSignals[iAuxTrackIndex][kJ] = aOut[kI]
	kJ += 1
	kI += 1
	od
	endif
	end:
	endin
	instr Preallocate_16
	ii = 0
	while (ii < 10) do
	scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", 16, ii))
	ii += 1
	od
	turnoff
	endin
	scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 16))
	instr 14
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
	instr 15
	k_aux = p4 - gi_auxIndexOffset
	k_track = p5 - gi_instrumentIndexOffset
	k_channel = p6
	k_volume = p7
	ga_auxVolumes[k_aux][k_track][k_channel] = k_volume
	turnoff
	endin
	instr 17
	k_track = p4 - gi_instrumentIndexOffset
	k_channel = p5
	k_volume = p6
	ga_masterVolumes[k_track][k_channel] = k_volume
	turnoff
	endin
	instr 18
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
	#ifdef IS_MIXDOWN
	i "SetMixdownListenerPosition" 1 -1
	#end
	i 2 0 -1 10 0 1 10
	i 16.1 0 -1 1 0 0
	i 15 0.004 1 10 0 0 0.33
	i 15 0.004 1 10 0 1 0.33
	i 15 0.004 1 10 0 2 0.33
	i 15 0.004 1 10 0 3 0.33
	i 15 0.004 1 10 0 4 0.03
	i 15 0.004 1 10 0 5 0.03
	i 15 0.004 1 10 1 0 0.16
	i 15 0.004 1 10 1 1 0.16
	i 15 0.004 1 10 1 2 0.16
	i 15 0.004 1 10 1 3 0.16
	i 15 0.004 1 10 1 4 0.02
	i 15 0.004 1 10 1 5 0.02
	i 15 0.004 1 10 2 0 0.16
	i 15 0.004 1 10 2 1 0.16
	i 15 0.004 1 10 2 2 0.16
	i 15 0.004 1 10 2 3 0.16
	i 15 0.004 1 10 3 0 0.52
	i 15 0.004 1 10 3 1 0.52
	i 15 0.004 1 10 3 2 0.52
	i 15 0.004 1 10 3 3 0.52
	i 15 0.004 1 10 3 4 0.21
	i 15 0.004 1 10 3 5 0.21
	i 15 0.004 1 10 4 0 0.42
	i 15 0.004 1 10 4 1 0.42
	i 15 0.004 1 10 4 2 0.42
	i 15 0.004 1 10 4 3 0.42
	i 15 0.004 1 10 4 4 0.20
	i 15 0.004 1 10 4 5 0.20
	i 15 0.004 1 10 5 0 0.07
	i 15 0.004 1 10 5 1 0.07
	i 15 0.004 1 10 5 2 0.07
	i 15 0.004 1 10 5 3 0.07
	i 15 0.004 1 10 5 4 0.03
	i 15 0.004 1 10 5 5 0.03
	i 15 0.004 1 10 6 0 0.05
	i 15 0.004 1 10 6 1 0.05
	i 15 0.004 1 10 6 2 0.05
	i 15 0.004 1 10 6 3 0.05
	i 15 0.004 1 10 6 4 0.01
	i 15 0.004 1 10 6 5 0.01
	i 15 0.004 1 10 7 0 0.42
	i 15 0.004 1 10 7 1 0.42
	i 15 0.004 1 10 7 2 0.42
	i 15 0.004 1 10 7 3 0.42
	i 15 0.004 1 10 8 0 0.16
	i 15 0.004 1 10 8 1 0.16
	i 15 0.004 1 10 8 2 0.16
	i 15 0.004 1 10 8 3 0.16
	i 15 0.004 1 10 8 4 0.15
	i 15 0.004 1 10 8 5 0.15
	i 15 0.004 1 10 9 0 0.36
	i 15 0.004 1 10 9 1 0.36
	i 15 0.004 1 10 9 2 0.36
	i 15 0.004 1 10 9 3 0.36
	i 17 0.004 1 10 0 0.71
	i 17 0.004 1 10 1 0.71
	i 17 0.004 1 10 2 0.71
	i 17 0.004 1 10 3 0.71
	i 17 0.004 1 10 4 0.71
	i 17 0.004 1 10 5 0.71
	i "EndOfInstrumentAllocations" 3 -1
	i "SendStartupMessage" 0 1
	i "SendStartupMessage" 4 -1
	b $SCORE_START_DELAY
	i 13 0.01 1 4 0 0.00
	i 13 0.01 1 4 4 1.00
	i 12 0.01 1 4 0 0.00
	i 13 0.01 1 4 5 ""
	i 4 0.01 1 4 4 1.00
	i 5 0.01 1 4 4 1.00
	i 12 0.01 1 4 4 1.00
	i 4 0.01 1 4 5 "<none>"
	i 5 0.01 1 4 5 "<none>"
	i 12 0.01 1 4 5 ""
	i 6 0.01 1 4 4 1.00
	i 5 0.01 1 4 9 -20.00
	i 6 0.01 1 4 5 "<none>"
	i 5 0.01 1 4 11 20.00
	i 6 0.01 1 4 9 20.00
	i 6 0.01 1 4 11 20.00
	i 7 0.01 1 4 4 1.00
	i 7 0.01 1 4 5 "<none>"
	i 7 0.01 1 4 11 50.00
	i 8 0.01 1 4 4 3.00
	i 8 0.01 1 4 5 "random_XZ"
	i 9 0.01 1 4 4 3.00
	i 9 0.01 1 4 5 "random_XZ"
	i 10 0.01 1 4 4 1.00
	i 10 0.01 1 4 5 "<none>"
	i 10 0.01 1 4 11 100.00
	i 11 0.01 1 4 0 0.00
	i 11 0.01 1 4 4 1.00
	i 11 0.01 1 4 5 ""
	i 16 0.01 1 4 0 1.00
	i 16 0.01 1 4 1 0.95
	i 16 0.01 1 4 2 14160.00
	i 16 0.01 1 4 5 1.00
	i 9.069 2.000 0.001 1 49 127
	i 8.036 2.000 0.001 1 49 127
	i 4.007 2.000 0.001 1 37 127
	i 9.070 2.061 0.001 1 49 127
	i 8.037 2.124 0.001 1 49 127
	i 9.071 2.124 0.001 1 49 127
	i 9.072 2.187 0.001 1 49 127
	i 9.073 2.249 0.001 1 49 127
	i 8.038 2.249 0.001 1 49 127
	i 9.074 2.312 0.001 1 49 127
	i 9.075 2.375 0.001 1 49 127
	i 8.039 2.375 0.001 1 49 127
	i 9.076 2.437 0.001 1 49 127
	i 7.005 2.500 0.001 1 39 127
	i 9.077 2.500 0.001 1 49 127
	i 8.040 2.500 0.001 1 49 127
	i 9.078 2.561 0.001 1 49 127
	i 9.079 2.624 0.001 1 49 127
	i 8.041 2.624 0.001 1 49 127
	i 9.080 2.687 0.001 1 49 127
	i 9.081 2.749 0.001 1 49 127
	i 8.042 2.749 0.001 1 49 127
	i 9.082 2.812 0.001 1 49 127
	i 8.043 2.875 0.001 1 49 127
	i 9.083 2.875 0.001 1 49 127
	i 9.084 2.937 0.001 1 49 127
	i 4.008 3.000 0.001 1 37 127
	i 9.085 3.000 0.001 1 49 127
	i 8.044 3.000 0.001 1 49 127
	i 10.007 3.000 -1.000 1 72 127
	i 10.008 3.000 -1.000 1 76 127
	i 9.086 3.061 0.001 1 49 127
	i 9.087 3.124 0.001 1 49 127
	i 8.045 3.124 0.001 1 49 127
	i 9.088 3.187 0.001 1 49 127
	i 9.089 3.249 0.001 1 49 127
	i 8.046 3.249 0.001 1 49 127
	i 9.090 3.312 0.001 1 49 127
	i 8.047 3.375 0.001 1 49 127
	i 9.091 3.375 0.001 1 49 127
	i 9.092 3.437 0.001 1 49 127
	i 7.006 3.500 0.001 1 39 127
	i 8.048 3.500 0.001 1 49 127
	i 9.093 3.500 0.001 1 49 127
	i 9.094 3.561 0.001 1 49 127
	i 9.095 3.624 0.001 1 49 127
	i 8.049 3.624 0.001 1 49 127
	i 9.096 3.687 0.001 1 49 127
	i 8.050 3.749 0.001 1 49 127
	i 9.097 3.749 0.001 1 49 127
	i 9.098 3.812 0.001 1 49 127
	i 9.099 3.875 0.001 1 49 127
	i 8.051 3.875 0.001 1 49 113
	i 9.100 3.937 0.001 1 49 127
	i 4.009 4.000 0.001 1 37 127
	i 8.052 4.000 0.001 1 49 127
	i 9.101 4.000 0.001 1 49 127
	i -10.007 3.999 0
	i -10.008 3.999 0
	i 9.102 4.061 0.001 1 49 127
	i 9.103 4.124 0.001 1 49 127
	i 8.053 4.124 0.001 1 49 127
	i 9.104 4.187 0.001 1 49 127
	i 9.105 4.249 0.001 1 49 127
	i 8.054 4.249 0.001 1 49 127
	i 9.106 4.312 0.001 1 49 127
	i 8.055 4.375 0.001 1 49 127
	i 9.107 4.375 0.001 1 49 127
	i 9.108 4.437 0.001 1 49 127
	i 7.007 4.500 0.001 1 39 127
	i 8.056 4.500 0.001 1 49 127
	i 9.109 4.500 0.001 1 49 127
	i 9.110 4.561 0.001 1 49 127
	i 8.057 4.624 0.001 1 49 127
	i 9.111 4.624 0.001 1 49 127
	i 9.112 4.687 0.001 1 49 127
	i 8.058 4.749 0.001 1 49 127
	i 9.113 4.749 0.001 1 49 127
	i 9.114 4.812 0.001 1 49 127
	i 9.115 4.875 0.001 1 49 127
	i 8.059 4.875 0.001 1 49 127
	i 9.116 4.937 0.001 1 49 127
	i 4.010 5.000 0.001 1 37 127
	i 8.060 5.000 0.001 1 49 127
	i 9.117 5.000 0.001 1 49 127
	i 10.009 5.000 -1.000 1 72 127
	i 10.010 5.000 -1.000 1 76 127
	i 9.118 5.061 0.001 1 49 127
	i 8.061 5.124 0.001 1 49 127
	i 9.119 5.124 0.001 1 49 127
	i 9.120 5.187 0.001 1 49 127
	i 9.121 5.249 0.001 1 49 127
	i 8.062 5.249 0.001 1 49 127
	i 9.122 5.312 0.001 1 49 127
	i 8.063 5.375 0.001 1 49 127
	i 9.123 5.375 0.001 1 49 127
	i 9.124 5.437 0.001 1 49 127
	i 7.008 5.500 0.001 1 39 127
	i 8.064 5.500 0.001 1 49 127
	i 9.125 5.500 0.001 1 49 127
	i 9.126 5.561 0.001 1 49 127
	i 9.127 5.624 0.001 1 49 127
	i 8.065 5.624 0.001 1 49 127
	i 9.128 5.687 0.001 1 49 127
	i 8.066 5.749 0.001 1 49 127
	i 9.129 5.749 0.001 1 49 127
	i 9.130 5.812 0.001 1 49 127
	i 9.131 5.875 0.001 1 49 127
	i 8.067 5.875 0.001 1 49 113
	i 9.132 5.937 0.001 1 49 127
	i -10.009 6.000 0
	i -10.010 6.000 0
	i 8.068 6.000 0.001 1 49 127
	i 4.011 6.000 0.001 1 37 127
	i 9.133 6.000 0.001 1 49 127
	i 9.134 6.061 0.001 1 49 127
	i 8.069 6.124 0.001 1 49 127
	i 9.135 6.124 0.001 1 49 127
	i 9.136 6.187 0.001 1 49 127
	i 8.070 6.249 0.001 1 49 127
	i 9.137 6.249 0.001 1 49 127
	i 9.138 6.312 0.001 1 49 127
	i 8.071 6.375 0.001 1 49 127
	i 9.139 6.375 0.001 1 49 127
	i 9.140 6.437 0.001 1 49 127
	i 7.009 6.500 0.001 1 39 127
	i 8.072 6.500 0.001 1 49 127
	i 9.141 6.500 0.001 1 49 127
	i 9.142 6.561 0.001 1 49 127
	i 8.073 6.624 0.001 1 49 127
	i 9.143 6.624 0.001 1 49 127
	i 9.144 6.687 0.001 1 49 127
	i 8.074 6.749 0.001 1 49 127
	i 9.145 6.749 0.001 1 49 127
	i 9.146 6.812 0.001 1 49 127
	i 8.075 6.875 0.001 1 49 127
	i 9.147 6.875 0.001 1 49 127
	i 9.148 6.937 0.001 1 49 127
	i 9.149 7.000 0.001 1 49 127
	i 4.012 7.000 0.001 1 37 127
	i 10.011 7.000 -1.000 1 72 127
	i 10.012 7.000 -1.000 1 76 127
	i 8.076 7.000 0.001 1 49 127
	i 9.150 7.061 0.001 1 49 127
	i 8.077 7.124 0.001 1 49 127
	i 9.151 7.124 0.001 1 49 127
	i 9.152 7.187 0.001 1 49 127
	i 8.078 7.249 0.001 1 49 127
	i 9.153 7.249 0.001 1 49 127
	i 9.154 7.312 0.001 1 49 127
	i 8.079 7.375 0.001 1 49 127
	i 9.155 7.375 0.001 1 49 127
	i 9.156 7.437 0.001 1 49 127
	i 7.010 7.500 0.001 1 39 127
	i 8.080 7.500 0.001 1 49 127
	i 9.157 7.500 0.001 1 49 127
	i 9.158 7.561 0.001 1 49 127
	i 8.081 7.624 0.001 1 49 127
	i 9.159 7.624 0.001 1 49 127
	i 9.160 7.687 0.001 1 49 127
	i 8.082 7.749 0.001 1 49 127
	i 9.161 7.749 0.001 1 49 127
	i 9.162 7.812 0.001 1 49 127
	i 9.163 7.875 0.001 1 49 127
	i 8.083 7.875 0.001 1 49 113
	i 9.164 7.937 0.001 1 49 127
	i 4.013 8.000 0.001 1 37 127
	i 8.084 8.000 0.001 1 49 127
	i 9.165 8.000 0.001 1 49 127
	i -10.011 7.999 0
	i -10.012 7.999 0
	i 9.166 8.061 0.001 1 49 127
	i 8.085 8.124 0.001 1 49 127
	i 9.167 8.124 0.001 1 49 127
	i 9.168 8.187 0.001 1 49 127
	i 8.086 8.249 0.001 1 49 127
	i 9.169 8.249 0.001 1 49 127
	i 9.170 8.312 0.001 1 49 127
	i 9.171 8.375 0.001 1 49 127
	i 8.087 8.375 0.001 1 49 127
	i 9.172 8.437 0.001 1 49 127
	i 7.011 8.500 0.001 1 39 127
	i 9.173 8.500 0.001 1 49 127
	i 8.088 8.500 0.001 1 49 127
	i 9.174 8.561 0.001 1 49 127
	i 8.089 8.624 0.001 1 49 127
	i 9.175 8.624 0.001 1 49 127
	i 9.176 8.687 0.001 1 49 127
	i 8.090 8.749 0.001 1 49 127
	i 9.177 8.749 0.001 1 49 127
	i 9.178 8.812 0.001 1 49 127
	i 9.179 8.875 0.001 1 49 127
	i 8.091 8.875 0.001 1 49 127
	i 9.180 8.937 0.001 1 49 127
	i 10.013 9.000 -1.000 1 72 127
	i 10.014 9.000 -1.000 1 76 127
	i 8.092 9.000 0.001 1 49 127
	i 9.181 9.000 0.001 1 49 127
	i 4.014 9.000 0.001 1 37 127
	i 9.182 9.061 0.001 1 49 127
	i 8.093 9.124 0.001 1 49 127
	i 9.183 9.124 0.001 1 49 127
	i 9.184 9.187 0.001 1 49 127
	i 9.185 9.249 0.001 1 49 127
	i 8.094 9.249 0.001 1 49 127
	i 9.186 9.312 0.001 1 49 127
	i 9.187 9.375 0.001 1 49 127
	i 8.095 9.375 0.001 1 49 127
	i 9.188 9.437 0.001 1 49 127
	i 7.012 9.500 0.001 1 39 127
	i 8.096 9.500 0.001 1 49 127
	i 9.189 9.500 0.001 1 49 127
	i 9.190 9.561 0.001 1 49 127
	i 9.191 9.624 0.001 1 49 127
	i 8.097 9.624 0.001 1 49 127
	i 9.192 9.687 0.001 1 49 127
	i 9.193 9.749 0.001 1 49 127
	i 8.098 9.749 0.001 1 49 127
	i 9.194 9.812 0.001 1 49 127
	i 9.195 9.875 0.001 1 49 127
	i 8.099 9.875 0.001 1 49 113
	i 9.196 9.937 0.001 1 49 127
	i 4.015 10.000 0.001 1 37 127
	i 8.100 10.000 0.001 1 49 127
	i 9.197 10.000 0.001 1 49 127
	i -10.013 10.000 0
	i -10.014 10.000 0
	i 11.001 10.000 -1.000 1 38 81
	i 9.198 10.061 0.001 1 49 127
	i 9.199 10.124 0.001 1 49 127
	i 8.101 10.124 0.001 1 49 127
	i 9.200 10.187 0.001 1 49 127
	i 8.102 10.249 0.001 1 49 127
	i 9.201 10.249 0.001 1 49 127
	i 9.202 10.312 0.001 1 49 127
	i 8.103 10.375 0.001 1 49 127
	i 9.203 10.375 0.001 1 49 127
	i 9.204 10.437 0.001 1 49 127
	i 7.013 10.500 0.001 1 39 127
	i 9.205 10.500 0.001 1 49 127
	i 8.104 10.500 0.001 1 49 127
	i 9.206 10.561 0.001 1 49 127
	i 9.207 10.624 0.001 1 49 127
	i 8.105 10.624 0.001 1 49 127
	i 9.208 10.687 0.001 1 49 127
	i 11.002 10.737 -1.000 1 41 89
	i -11.001 10.744 0
	i 9.209 10.749 0.001 1 49 127
	i 8.106 10.749 0.001 1 49 127
	i 9.210 10.812 0.001 1 49 127
	i 9.211 10.875 0.001 1 49 127
	i 8.107 10.875 0.001 1 49 127
	i 9.212 10.937 0.001 1 49 127
	i 4.016 11.000 0.001 1 37 127
	i 8.108 11.000 0.001 1 49 127
	i 9.213 11.000 0.001 1 49 127
	i 10.015 11.000 -1.000 1 72 127
	i 10.016 11.000 -1.000 1 76 127
	i 9.214 11.061 0.001 1 49 127
	i 8.109 11.124 0.001 1 49 127
	i 9.215 11.124 0.001 1 49 127
	i 9.216 11.187 0.001 1 49 127
	i 8.110 11.249 0.001 1 49 127
	i 9.217 11.249 0.001 1 49 127
	i 11.003 11.255 -1.000 1 38 68
	i -11.002 11.260 0
	i 9.218 11.312 0.001 1 49 127
	i 9.219 11.375 0.001 1 49 127
	i 8.111 11.375 0.001 1 49 127
	i 9.220 11.437 0.001 1 49 127
	i 8.112 11.500 0.001 1 49 127
	i 11.004 11.501 -1.000 1 41 78
	i 7.014 11.500 0.001 1 39 127
	i 9.221 11.500 0.001 1 49 127
	i -11.003 11.509 0
	i 9.222 11.561 0.001 1 49 127
	i 9.223 11.624 0.001 1 49 127
	i 8.113 11.624 0.001 1 49 127
	i 9.224 11.687 0.001 1 49 127
	i 8.114 11.749 0.001 1 49 127
	i 9.225 11.749 0.001 1 49 127
	i 9.226 11.812 0.001 1 49 127
	i 8.115 11.875 0.001 1 49 113
	i 9.227 11.875 0.001 1 49 127
	i 9.228 11.937 0.001 1 49 127
	i -10.015 11.999 0
	i -10.016 11.999 0
	i 4.017 12.000 0.001 1 37 127
	i 8.116 12.000 0.001 1 49 127
	i 9.229 12.000 0.001 1 49 127
	i 11.005 12.012 -1.000 1 38 78
	i -11.004 12.031 0
	i 9.230 12.061 0.001 1 49 127
	i 8.117 12.124 0.001 1 49 127
	i 9.231 12.124 0.001 1 49 127
	i 9.232 12.187 0.001 1 49 127
	i 8.118 12.249 0.001 1 49 127
	i 9.233 12.249 0.001 1 49 127
	i 9.234 12.312 0.001 1 49 127
	i 9.235 12.375 0.001 1 49 127
	i 8.119 12.375 0.001 1 49 127
	i 9.236 12.437 0.001 1 49 127
	i 7.015 12.500 0.001 1 39 127
	i 9.237 12.500 0.001 1 49 127
	i 8.120 12.500 0.001 1 49 127
	i 9.238 12.561 0.001 1 49 127
	i 8.121 12.624 0.001 1 49 127
	i 9.239 12.624 0.001 1 49 127
	i 9.240 12.687 0.001 1 49 127
	i 8.122 12.749 0.001 1 49 127
	i 9.241 12.749 0.001 1 49 127
	i 11.006 12.760 -1.000 1 36 86
	i -11.005 12.768 0
	i 9.242 12.812 0.001 1 49 127
	i 9.243 12.875 0.001 1 49 127
	i 8.123 12.875 0.001 1 49 127
	i 9.244 12.937 0.001 1 49 127
	i 4.018 13.000 0.001 1 37 127
	i 9.245 13.000 0.001 1 49 127
	i 8.124 13.000 0.001 1 49 127
	i 10.017 13.000 -1.000 1 72 127
	i 10.018 13.000 -1.000 1 76 127
	i 9.246 13.061 0.001 1 49 127
	i 9.247 13.124 0.001 1 49 127
	i 8.125 13.124 0.001 1 49 127
	i 9.248 13.187 0.001 1 49 127
	i 8.126 13.249 0.001 1 49 127
	i 9.249 13.249 0.001 1 49 127
	i -11.006 13.257 0
	i 11.007 13.259 -1.000 1 33 74
	i 9.250 13.312 0.001 1 49 127
	i 8.127 13.375 0.001 1 49 127
	i 9.251 13.375 0.001 1 49 127
	i 9.252 13.437 0.001 1 49 127
	i 7.016 13.500 0.001 1 39 127
	i 9.253 13.500 0.001 1 49 127
	i 8.128 13.500 0.001 1 49 127
	i 11.008 13.508 -1.000 1 36 91
	i -11.007 13.517 0
	i 9.254 13.561 0.001 1 49 127
	i 9.255 13.624 0.001 1 49 127
	i 8.129 13.624 0.001 1 49 127
	i 9.256 13.687 0.001 1 49 127
	i 9.257 13.749 0.001 1 49 127
	i 8.130 13.749 0.001 1 49 127
	i 9.258 13.812 0.001 1 49 127
	i 8.131 13.875 0.001 1 49 113
	i 9.259 13.875 0.001 1 49 127
	i 9.260 13.937 0.001 1 49 127
	i 4.019 14.000 0.001 1 37 127
	i 8.132 14.000 0.001 1 49 127
	i 9.261 14.000 0.001 1 49 127
	i -11.008 14.000 0
	i -10.017 14.000 0
	i 11.009 14.000 -1.000 1 38 81
	i -10.018 14.000 0
	i 9.262 14.061 0.001 1 49 127
	i 8.133 14.124 0.001 1 49 127
	i 9.263 14.124 0.001 1 49 127
	i 9.264 14.187 0.001 1 49 127
	i 9.265 14.249 0.001 1 49 127
	i 8.134 14.249 0.001 1 49 127
	i 9.266 14.312 0.001 1 49 127
	i 8.135 14.375 0.001 1 49 127
	i 9.267 14.375 0.001 1 49 127
	i 9.268 14.437 0.001 1 49 127
	i 8.136 14.500 0.001 1 49 127
	i 7.017 14.500 0.001 1 39 127
	i 9.269 14.500 0.001 1 49 127
	i 9.270 14.561 0.001 1 49 127
	i 9.271 14.624 0.001 1 49 127
	i 8.137 14.624 0.001 1 49 127
	i 9.272 14.687 0.001 1 49 127
	i 11.010 14.737 -1.000 1 41 89
	i -11.009 14.744 0
	i 8.138 14.749 0.001 1 49 127
	i 9.273 14.749 0.001 1 49 127
	i 9.274 14.812 0.001 1 49 127
	i 8.139 14.875 0.001 1 49 127
	i 9.275 14.875 0.001 1 49 127
	i 9.276 14.937 0.001 1 49 127
	i 4.020 15.000 0.001 1 37 127
	i 9.277 15.000 0.001 1 49 127
	i 10.019 15.000 -1.000 1 72 127
	i 8.140 15.000 0.001 1 49 127
	i 10.020 15.000 -1.000 1 76 127
	i 9.278 15.061 0.001 1 49 127
	i 8.141 15.124 0.001 1 49 127
	i 9.279 15.124 0.001 1 49 127
	i 9.280 15.187 0.001 1 49 127
	i 8.142 15.249 0.001 1 49 127
	i 9.281 15.249 0.001 1 49 127
	i 11.011 15.255 -1.000 1 38 68
	i -11.010 15.260 0
	i 9.282 15.312 0.001 1 49 127
	i 8.143 15.375 0.001 1 49 127
	i 9.283 15.375 0.001 1 49 127
	i 9.284 15.437 0.001 1 49 127
	i 11.012 15.501 -1.000 1 41 78
	i 7.018 15.500 0.001 1 39 127
	i 8.144 15.500 0.001 1 49 127
	i 9.285 15.500 0.001 1 49 127
	i -11.011 15.509 0
	i 9.286 15.561 0.001 1 49 127
	i 9.287 15.624 0.001 1 49 127
	i 8.145 15.624 0.001 1 49 127
	i 9.288 15.687 0.001 1 49 127
	i 8.146 15.749 0.001 1 49 127
	i 9.289 15.749 0.001 1 49 127
	i 9.290 15.812 0.001 1 49 127
	i 8.147 15.875 0.001 1 49 113
	i 9.291 15.875 0.001 1 49 127
	i 9.292 15.937 0.001 1 49 127
	i 9.293 16.000 0.001 1 49 127
	i 8.148 16.000 0.001 1 49 127
	i -10.019 15.999 0
	i 4.021 16.000 0.001 1 37 127
	i -10.020 15.999 0
	i 11.013 16.012 -1.000 1 38 78
	i -11.012 16.031 0
	i 9.294 16.061 0.001 1 49 127
	i 9.295 16.124 0.001 1 49 127
	i 8.149 16.124 0.001 1 49 127
	i 9.296 16.187 0.001 1 49 127
	i 8.150 16.249 0.001 1 49 127
	i 9.297 16.249 0.001 1 49 127
	i 9.298 16.312 0.001 1 49 127
	i 8.151 16.375 0.001 1 49 127
	i 9.299 16.375 0.001 1 49 127
	i 9.300 16.437 0.001 1 49 127
	i 8.152 16.500 0.001 1 49 127
	i 9.301 16.500 0.001 1 49 127
	i 7.019 16.500 0.001 1 39 127
	i 9.302 16.561 0.001 1 49 127
	i 9.303 16.624 0.001 1 49 127
	i 8.153 16.624 0.001 1 49 127
	i 9.304 16.687 0.001 1 49 127
	i 9.305 16.749 0.001 1 49 127
	i 8.154 16.749 0.001 1 49 127
	i 11.014 16.760 -1.000 1 36 86
	i -11.013 16.768 0
	i 9.306 16.812 0.001 1 49 127
	i 9.307 16.875 0.001 1 49 127
	i 8.155 16.875 0.001 1 49 127
	i 9.308 16.937 0.001 1 49 127
	i 4.022 17.000 0.001 1 37 127
	i 8.156 17.000 0.001 1 49 127
	i 9.309 17.000 0.001 1 49 127
	i 10.021 17.000 -1.000 1 72 127
	i 10.022 17.000 -1.000 1 76 127
	i 9.310 17.061 0.001 1 49 127
	i 8.157 17.124 0.001 1 49 127
	i 9.311 17.124 0.001 1 49 127
	i 9.312 17.187 0.001 1 49 127
	i 8.158 17.249 0.001 1 49 127
	i 9.313 17.249 0.001 1 49 127
	i -11.014 17.257 0
	i 11.015 17.259 -1.000 1 33 74
	i 9.314 17.312 0.001 1 49 127
	i 8.159 17.375 0.001 1 49 127
	i 9.315 17.375 0.001 1 49 127
	i 9.316 17.437 0.001 1 49 127
	i 7.020 17.500 0.001 1 39 127
	i 9.317 17.500 0.001 1 49 127
	i 8.160 17.500 0.001 1 49 127
	i 11.016 17.508 -1.000 1 36 91
	i -11.015 17.517 0
	i 9.318 17.561 0.001 1 49 127
	i 9.319 17.624 0.001 1 49 127
	i 8.161 17.624 0.001 1 49 127
	i 9.320 17.687 0.001 1 49 127
	i 9.321 17.749 0.001 1 49 127
	i 8.162 17.749 0.001 1 49 127
	i 9.322 17.812 0.001 1 49 127
	i 8.163 17.875 0.001 1 49 113
	i 9.323 17.875 0.001 1 49 127
	i 9.324 17.937 0.001 1 49 127
	i 8.164 18.000 0.001 1 49 127
	i -10.021 18.000 0
	i -11.016 18.000 0
	i -10.022 18.000 0
	i 11.017 18.000 -1.000 1 38 81
	i 4.023 18.000 0.001 1 37 127
	i 9.325 18.000 0.001 1 49 127
	i 9.326 18.061 0.001 1 49 127
	i 8.165 18.124 0.001 1 49 127
	i 9.327 18.124 0.001 1 49 127
	i 9.328 18.187 0.001 1 49 127
	i 8.166 18.249 0.001 1 49 127
	i 9.329 18.249 0.001 1 49 127
	i 9.330 18.312 0.001 1 49 127
	i 9.331 18.375 0.001 1 49 127
	i 8.167 18.375 0.001 1 49 127
	i 9.332 18.437 0.001 1 49 127
	i 8.168 18.500 0.001 1 49 127
	i 7.021 18.500 0.001 1 39 127
	i 9.333 18.500 0.001 1 49 127
	i 9.334 18.561 0.001 1 49 127
	i 8.169 18.624 0.001 1 49 127
	i 9.335 18.624 0.001 1 49 127
	i 9.336 18.687 0.001 1 49 127
	i 11.018 18.737 -1.000 1 41 89
	i -11.017 18.744 0
	i 8.170 18.749 0.001 1 49 127
	i 9.337 18.749 0.001 1 49 127
	i 9.338 18.812 0.001 1 49 127
	i 8.171 18.875 0.001 1 49 127
	i 9.339 18.875 0.001 1 49 127
	i 9.340 18.937 0.001 1 49 127
	i 4.024 19.000 0.001 1 37 127
	i 8.172 19.000 0.001 1 49 127
	i 10.023 19.000 -1.000 1 72 127
	i 10.024 19.000 -1.000 1 76 127
	i 9.341 19.000 0.001 1 49 127
	i 9.342 19.061 0.001 1 49 127
	i 9.343 19.124 0.001 1 49 127
	i 8.173 19.124 0.001 1 49 127
	i 9.344 19.187 0.001 1 49 127
	i 9.345 19.249 0.001 1 49 127
	i 8.174 19.249 0.001 1 49 127
	i 11.019 19.255 -1.000 1 38 68
	i -11.018 19.260 0
	i 9.346 19.312 0.001 1 49 127
	i 9.347 19.375 0.001 1 49 127
	i 8.175 19.375 0.001 1 49 127
	i 9.348 19.437 0.001 1 49 127
	i 9.349 19.500 0.001 1 49 127
	i 7.022 19.500 0.001 1 39 127
	i 11.020 19.501 -1.000 1 41 78
	i 8.176 19.500 0.001 1 49 127
	i -11.019 19.509 0
	i 9.350 19.561 0.001 1 49 127
	i 9.351 19.624 0.001 1 49 127
	i 8.177 19.624 0.001 1 49 127
	i 9.352 19.687 0.001 1 49 127
	i 8.178 19.749 0.001 1 49 127
	i 9.353 19.749 0.001 1 49 127
	i 9.354 19.812 0.001 1 49 127
	i 8.179 19.875 0.001 1 49 113
	i 9.355 19.875 0.001 1 49 127
	i 9.356 19.937 0.001 1 49 127
	i 4.025 20.000 0.001 1 37 127
	i 8.180 20.000 0.001 1 49 127
	i 9.357 20.000 0.001 1 49 127
	i -10.023 19.999 0
	i -10.024 19.999 0
	i 11.021 20.012 -1.000 1 38 78
	i -11.020 20.031 0
	i 9.358 20.061 0.001 1 49 127
	i 8.181 20.124 0.001 1 49 127
	i 9.359 20.124 0.001 1 49 127
	i 9.360 20.187 0.001 1 49 127
	i 8.182 20.249 0.001 1 49 127
	i 9.361 20.249 0.001 1 49 127
	i 9.362 20.312 0.001 1 49 127
	i 8.183 20.375 0.001 1 49 127
	i 9.363 20.375 0.001 1 49 127
	i 9.364 20.437 0.001 1 49 127
	i 9.365 20.500 0.001 1 49 127
	i 8.184 20.500 0.001 1 49 127
	i 7.023 20.500 0.001 1 39 127
	i 9.366 20.561 0.001 1 49 127
	i 9.367 20.624 0.001 1 49 127
	i 8.185 20.624 0.001 1 49 127
	i 9.368 20.687 0.001 1 49 127
	i 8.186 20.749 0.001 1 49 127
	i 9.369 20.749 0.001 1 49 127
	i 11.022 20.760 -1.000 1 36 86
	i -11.021 20.768 0
	i 9.370 20.812 0.001 1 49 127
	i 8.187 20.875 0.001 1 49 127
	i 9.371 20.875 0.001 1 49 127
	i 9.372 20.937 0.001 1 49 127
	i 4.026 21.000 0.001 1 37 127
	i 10.025 21.000 -1.000 1 72 127
	i 8.188 21.000 0.001 1 49 127
	i 9.373 21.000 0.001 1 49 127
	i 10.026 21.000 -1.000 1 76 127
	i 9.374 21.061 0.001 1 49 127
	i 8.189 21.124 0.001 1 49 127
	i 9.375 21.124 0.001 1 49 127
	i 9.376 21.187 0.001 1 49 127
	i 9.377 21.249 0.001 1 49 127
	i 8.190 21.249 0.001 1 49 127
	i -11.022 21.257 0
	i 11.023 21.259 -1.000 1 33 74
	i 9.378 21.312 0.001 1 49 127
	i 9.379 21.375 0.001 1 49 127
	i 8.191 21.375 0.001 1 49 127
	i 9.380 21.437 0.001 1 49 127
	i 8.192 21.500 0.001 1 49 127
	i 7.024 21.500 0.001 1 39 127
	i 9.381 21.500 0.001 1 49 127
	i 11.024 21.508 -1.000 1 36 91
	i -11.023 21.517 0
	i 9.382 21.561 0.001 1 49 127
	i 8.193 21.624 0.001 1 49 127
	i 9.383 21.624 0.001 1 49 127
	i 9.384 21.687 0.001 1 49 127
	i 9.385 21.749 0.001 1 49 127
	i 8.194 21.749 0.001 1 49 127
	i 9.386 21.812 0.001 1 49 127
	i 8.195 21.875 0.001 1 49 113
	i 9.387 21.875 0.001 1 49 127
	i 9.388 21.937 0.001 1 49 127
	i 4.027 22.000 0.001 1 37 127
	i 9.389 22.000 0.001 1 49 127
	i 8.196 22.000 0.001 1 49 127
	i -10.025 22.000 0
	i -10.026 22.000 0
	i -11.024 22.000 0
	i 11.025 22.000 -1.000 1 38 81
	i 9.390 22.061 0.001 1 49 127
	i 8.197 22.124 0.001 1 49 127
	i 9.391 22.124 0.001 1 49 127
	i 9.392 22.187 0.001 1 49 127
	i 8.198 22.249 0.001 1 49 127
	i 9.393 22.249 0.001 1 49 127
	i 9.394 22.312 0.001 1 49 127
	i 8.199 22.375 0.001 1 49 127
	i 9.395 22.375 0.001 1 49 127
	i 9.396 22.437 0.001 1 49 127
	i 9.397 22.500 0.001 1 49 127
	i 7.025 22.500 0.001 1 39 127
	i 8.200 22.500 0.001 1 49 127
	i 9.398 22.561 0.001 1 49 127
	i 8.201 22.624 0.001 1 49 127
	i 9.399 22.624 0.001 1 49 127
	i 9.400 22.687 0.001 1 49 127
	i 11.026 22.737 -1.000 1 41 89
	i -11.025 22.744 0
	i 8.202 22.749 0.001 1 49 127
	i 9.401 22.749 0.001 1 49 127
	i 9.402 22.812 0.001 1 49 127
	i 8.203 22.875 0.001 1 49 127
	i 9.403 22.875 0.001 1 49 127
	i 9.404 22.937 0.001 1 49 127
	i 9.405 23.000 0.001 1 49 127
	i 10.027 23.000 -1.000 1 72 127
	i 10.028 23.000 -1.000 1 76 127
	i 8.204 23.000 0.001 1 49 127
	i 4.028 23.000 0.001 1 37 127
	i 9.406 23.061 0.001 1 49 127
	i 9.407 23.124 0.001 1 49 127
	i 8.205 23.124 0.001 1 49 127
	i 9.408 23.187 0.001 1 49 127
	i 9.409 23.249 0.001 1 49 127
	i 8.206 23.249 0.001 1 49 127
	i 11.027 23.255 -1.000 1 38 68
	i -11.026 23.260 0
	i 9.410 23.312 0.001 1 49 127
	i 9.411 23.375 0.001 1 49 127
	i 8.207 23.375 0.001 1 49 127
	i 9.412 23.437 0.001 1 49 127
	i 11.028 23.501 -1.000 1 41 78
	i 7.026 23.500 0.001 1 39 127
	i 9.413 23.500 0.001 1 49 127
	i 8.208 23.500 0.001 1 49 127
	i -11.027 23.509 0
	i 9.414 23.561 0.001 1 49 127
	i 9.415 23.624 0.001 1 49 127
	i 8.209 23.624 0.001 1 49 127
	i 9.416 23.687 0.001 1 49 127
	i 8.210 23.749 0.001 1 49 127
	i 9.417 23.749 0.001 1 49 127
	i 9.418 23.812 0.001 1 49 127
	i 8.211 23.875 0.001 1 49 113
	i 9.419 23.875 0.001 1 49 127
	i 9.420 23.937 0.001 1 49 127
	i 4.029 24.000 0.001 1 37 127
	i 8.212 24.000 0.001 1 49 127
	i 9.421 24.000 0.001 1 49 127
	i -10.027 23.999 0
	i -10.028 23.999 0
	i 11.029 24.012 -1.000 1 38 78
	i -11.028 24.031 0
	i 9.422 24.061 0.001 1 49 127
	i 9.423 24.124 0.001 1 49 127
	i 8.213 24.124 0.001 1 49 127
	i 9.424 24.187 0.001 1 49 127
	i 8.214 24.249 0.001 1 49 127
	i 9.425 24.249 0.001 1 49 127
	i 9.426 24.312 0.001 1 49 127
	i 9.427 24.375 0.001 1 49 127
	i 8.215 24.375 0.001 1 49 127
	i 9.428 24.437 0.001 1 49 127
	i 8.216 24.500 0.001 1 49 127
	i 9.429 24.500 0.001 1 49 127
	i 7.027 24.500 0.001 1 39 127
	i 9.430 24.561 0.001 1 49 127
	i 9.431 24.624 0.001 1 49 127
	i 8.217 24.624 0.001 1 49 127
	i 9.432 24.687 0.001 1 49 127
	i 8.218 24.749 0.001 1 49 127
	i 9.433 24.749 0.001 1 49 127
	i 11.030 24.760 -1.000 1 36 86
	i -11.029 24.768 0
	i 9.434 24.812 0.001 1 49 127
	i 8.219 24.875 0.001 1 49 127
	i 9.435 24.875 0.001 1 49 127
	i 9.436 24.937 0.001 1 49 127
	i 4.030 25.000 0.001 1 37 127
	i 9.437 25.000 0.001 1 49 127
	i 8.220 25.000 0.001 1 49 127
	i 10.029 25.000 -1.000 1 72 127
	i 10.030 25.000 -1.000 1 76 127
	i 9.438 25.061 0.001 1 49 127
	i 8.221 25.124 0.001 1 49 127
	i 9.439 25.124 0.001 1 49 127
	i 9.440 25.187 0.001 1 49 127
	i 9.441 25.249 0.001 1 49 127
	i 8.222 25.249 0.001 1 49 127
	i -11.030 25.257 0
	i 11.031 25.259 -1.000 1 33 74
	i 9.442 25.312 0.001 1 49 127
	i 8.223 25.375 0.001 1 49 127
	i 9.443 25.375 0.001 1 49 127
	i 9.444 25.437 0.001 1 49 127
	i 8.224 25.500 0.001 1 49 127
	i 9.445 25.500 0.001 1 49 127
	i 7.028 25.500 0.001 1 39 127
	i 11.032 25.508 -1.000 1 36 91
	i -11.031 25.517 0
	i 9.446 25.561 0.001 1 49 127
	i 8.225 25.624 0.001 1 49 127
	i 9.447 25.624 0.001 1 49 127
	i 9.448 25.687 0.001 1 49 127
	i 8.226 25.749 0.001 1 49 127
	i 9.449 25.749 0.001 1 49 127
	i 9.450 25.812 0.001 1 49 127
	i 8.227 25.875 0.001 1 49 113
	i 9.451 25.875 0.001 1 49 127
	i 9.452 25.937 0.001 1 49 127
	i 4.031 26.000 0.001 1 37 127
	i 8.228 26.000 0.001 1 49 127
	i 9.453 26.000 0.001 1 49 127
	i -10.029 26.000 0
	i -10.030 26.000 0
	i -11.032 26.000 0
	i 11.033 26.000 -1.000 1 38 81
	i 9.454 26.061 0.001 1 49 127
	i 9.455 26.124 0.001 1 49 127
	i 8.229 26.124 0.001 1 49 127
	i 9.456 26.187 0.001 1 49 127
	i 9.457 26.249 0.001 1 49 127
	i 8.230 26.249 0.001 1 49 127
	i 9.458 26.312 0.001 1 49 127
	i 9.459 26.375 0.001 1 49 127
	i 8.231 26.375 0.001 1 49 127
	i 9.460 26.437 0.001 1 49 127
	i 9.461 26.500 0.001 1 49 127
	i 8.232 26.500 0.001 1 49 127
	i 7.029 26.500 0.001 1 39 127
	i 9.462 26.561 0.001 1 49 127
	i 8.233 26.624 0.001 1 49 127
	i 9.463 26.624 0.001 1 49 127
	i 9.464 26.687 0.001 1 49 127
	i 11.034 26.737 -1.000 1 41 89
	i -11.033 26.744 0
	i 9.465 26.749 0.001 1 49 127
	i 8.234 26.749 0.001 1 49 127
	i 9.466 26.812 0.001 1 49 127
	i 8.235 26.875 0.001 1 49 127
	i 9.467 26.875 0.001 1 49 127
	i 9.468 26.937 0.001 1 49 127
	i 4.032 27.000 0.001 1 37 127
	i 8.236 27.000 0.001 1 49 127
	i 9.469 27.000 0.001 1 49 127
	i 10.031 27.000 -1.000 1 72 127
	i 10.032 27.000 -1.000 1 76 127
	i 9.470 27.061 0.001 1 49 127
	i 9.471 27.124 0.001 1 49 127
	i 8.237 27.124 0.001 1 49 127
	i 9.472 27.187 0.001 1 49 127
	i 9.473 27.249 0.001 1 49 127
	i 8.238 27.249 0.001 1 49 127
	i 11.035 27.255 -1.000 1 38 68
	i -11.034 27.260 0
	i 9.474 27.312 0.001 1 49 127
	i 8.239 27.375 0.001 1 49 127
	i 9.475 27.375 0.001 1 49 127
	i 9.476 27.437 0.001 1 49 127
	i 9.477 27.500 0.001 1 49 127
	i 11.036 27.501 -1.000 1 41 78
	i 7.030 27.500 0.001 1 39 127
	i 8.240 27.500 0.001 1 49 127
	i -11.035 27.509 0
	i 9.478 27.561 0.001 1 49 127
	i 9.479 27.624 0.001 1 49 127
	i 8.241 27.624 0.001 1 49 127
	i 9.480 27.687 0.001 1 49 127
	i 8.242 27.749 0.001 1 49 127
	i 9.481 27.749 0.001 1 49 127
	i 9.482 27.812 0.001 1 49 127
	i 8.243 27.875 0.001 1 49 113
	i 9.483 27.875 0.001 1 49 127
	i 9.484 27.937 0.001 1 49 127
	i 4.033 28.000 0.001 1 37 127
	i -10.031 27.999 0
	i 9.485 28.000 0.001 1 49 127
	i -10.032 27.999 0
	i 8.244 28.000 0.001 1 49 127
	i 11.037 28.012 -1.000 1 38 78
	i -11.036 28.031 0
	i 9.486 28.061 0.001 1 49 127
	i 8.245 28.124 0.001 1 49 127
	i 9.487 28.124 0.001 1 49 127
	i 9.488 28.187 0.001 1 49 127
	i 8.246 28.249 0.001 1 49 127
	i 9.489 28.249 0.001 1 49 127
	i 9.490 28.312 0.001 1 49 127
	i 9.491 28.375 0.001 1 49 127
	i 8.247 28.375 0.001 1 49 127
	i 9.492 28.437 0.001 1 49 127
	i 8.248 28.500 0.001 1 49 127
	i 9.493 28.500 0.001 1 49 127
	i 7.031 28.500 0.001 1 39 127
	i 9.494 28.561 0.001 1 49 127
	i 9.495 28.624 0.001 1 49 127
	i 8.249 28.624 0.001 1 49 127
	i 9.496 28.687 0.001 1 49 127
	i 9.497 28.749 0.001 1 49 127
	i 8.250 28.749 0.001 1 49 127
	i 11.038 28.760 -1.000 1 36 86
	i -11.037 28.768 0
	i 9.498 28.812 0.001 1 49 127
	i 8.251 28.875 0.001 1 49 127
	i 9.499 28.875 0.001 1 49 127
	i 9.500 28.937 0.001 1 49 127
	i 10.033 29.000 -1.000 1 72 127
	i 10.034 29.000 -1.000 1 76 127
	i 4.034 29.000 0.001 1 37 127
	i 8.252 29.000 0.001 1 49 127
	i 9.501 29.000 0.001 1 49 127
	i 9.502 29.061 0.001 1 49 127
	i 8.253 29.124 0.001 1 49 127
	i 9.503 29.124 0.001 1 49 127
	i 9.504 29.187 0.001 1 49 127
	i 8.254 29.249 0.001 1 49 127
	i 9.505 29.249 0.001 1 49 127
	i -11.038 29.257 0
	i 11.039 29.259 -1.000 1 33 74
	i 9.506 29.312 0.001 1 49 127
	i 9.507 29.375 0.001 1 49 127
	i 8.255 29.375 0.001 1 49 127
	i 9.508 29.437 0.001 1 49 127
	i 9.509 29.500 0.001 1 49 127
	i 8.256 29.500 0.001 1 49 127
	i 7.032 29.500 0.001 1 39 127
	i 11.040 29.508 -1.000 1 36 91
	i -11.039 29.517 0
	i 9.510 29.561 0.001 1 49 127
	i 9.511 29.624 0.001 1 49 127
	i 8.257 29.624 0.001 1 49 127
	i 9.512 29.687 0.001 1 49 127
	i 9.513 29.749 0.001 1 49 127
	i 8.258 29.749 0.001 1 49 127
	i 9.514 29.812 0.001 1 49 127
	i 8.259 29.875 0.001 1 49 113
	i 9.515 29.875 0.001 1 49 127
	i 9.516 29.937 0.001 1 49 127
	i 4.035 30.000 0.001 1 37 127
	i 8.260 30.000 0.001 1 49 127
	i 9.517 30.000 0.001 1 49 127
	i -10.033 30.000 0
	i -10.034 30.000 0
	i -11.040 30.000 0
	i 11.041 30.000 -1.000 1 38 81
	i 9.518 30.061 0.001 1 49 127
	i 8.261 30.124 0.001 1 49 127
	i 9.519 30.124 0.001 1 49 127
	i 9.520 30.187 0.001 1 49 127
	i 8.262 30.249 0.001 1 49 127
	i 9.521 30.249 0.001 1 49 127
	i 9.522 30.312 0.001 1 49 127
	i 8.263 30.375 0.001 1 49 127
	i 9.523 30.375 0.001 1 49 127
	i 9.524 30.437 0.001 1 49 127
	i 7.033 30.500 0.001 1 39 127
	i 8.264 30.500 0.001 1 49 127
	i 9.525 30.500 0.001 1 49 127
	i 9.526 30.561 0.001 1 49 127
	i 8.265 30.624 0.001 1 49 127
	i 9.527 30.624 0.001 1 49 127
	i 9.528 30.687 0.001 1 49 127
	i 11.042 30.737 -1.000 1 41 89
	i -11.041 30.744 0
	i 9.529 30.749 0.001 1 49 127
	i 8.266 30.749 0.001 1 49 127
	i 9.530 30.812 0.001 1 49 127
	i 9.531 30.875 0.001 1 49 127
	i 8.267 30.875 0.001 1 49 127
	i 9.532 30.937 0.001 1 49 127
	i 4.036 31.000 0.001 1 37 127
	i 9.533 31.000 0.001 1 49 127
	i 8.268 31.000 0.001 1 49 127
	i 10.035 31.000 -1.000 1 72 127
	i 10.036 31.000 -1.000 1 76 127
	i 9.534 31.061 0.001 1 49 127
	i 8.269 31.124 0.001 1 49 127
	i 9.535 31.124 0.001 1 49 127
	i 9.536 31.187 0.001 1 49 127
	i 8.270 31.249 0.001 1 49 127
	i 9.537 31.249 0.001 1 49 127
	i 11.043 31.255 -1.000 1 38 68
	i -11.042 31.260 0
	i 9.538 31.312 0.001 1 49 127
	i 8.271 31.375 0.001 1 49 127
	i 9.539 31.375 0.001 1 49 127
	i 9.540 31.437 0.001 1 49 127
	i 8.272 31.500 0.001 1 49 127
	i 9.541 31.500 0.001 1 49 127
	i 7.034 31.500 0.001 1 39 127
	i 11.044 31.501 -1.000 1 41 78
	i -11.043 31.509 0
	i 9.542 31.561 0.001 1 49 127
	i 8.273 31.624 0.001 1 49 127
	i 9.543 31.624 0.001 1 49 127
	i 9.544 31.687 0.001 1 49 127
	i 8.274 31.749 0.001 1 49 127
	i 9.545 31.749 0.001 1 49 127
	i 9.546 31.812 0.001 1 49 127
	i 9.547 31.875 0.001 1 49 127
	i 8.275 31.875 0.001 1 49 113
	i 9.548 31.937 0.001 1 49 127
	i 9.549 32.000 0.001 1 49 127
	i -10.035 31.999 0
	i -10.036 31.999 0
	i 8.276 32.000 0.001 1 49 127
	i 4.037 32.000 0.001 1 37 127
	i 11.045 32.012 -1.000 1 38 78
	i -11.044 32.031 0
	i 9.550 32.061 0.001 1 49 127
	i 8.277 32.124 0.001 1 49 127
	i 9.551 32.124 0.001 1 49 127
	i 9.552 32.187 0.001 1 49 127
	i 8.278 32.249 0.001 1 49 127
	i 9.553 32.249 0.001 1 49 127
	i 9.554 32.312 0.001 1 49 127
	i 9.555 32.375 0.001 1 49 127
	i 8.279 32.375 0.001 1 49 127
	i 9.556 32.437 0.001 1 49 127
	i 8.280 32.500 0.001 1 49 127
	i 9.557 32.500 0.001 1 49 127
	i 7.035 32.500 0.001 1 39 127
	i 9.558 32.561 0.001 1 49 127
	i 9.559 32.624 0.001 1 49 127
	i 8.281 32.624 0.001 1 49 127
	i 9.560 32.687 0.001 1 49 127
	i 8.282 32.749 0.001 1 49 127
	i 9.561 32.749 0.001 1 49 127
	i 11.046 32.760 -1.000 1 36 86
	i -11.045 32.768 0
	i 9.562 32.812 0.001 1 49 127
	i 8.283 32.875 0.001 1 49 127
	i 9.563 32.875 0.001 1 49 127
	i 9.564 32.937 0.001 1 49 127
	i 10.037 33.000 -1.000 1 72 127
	i 4.038 33.000 0.001 1 37 127
	i 10.038 33.000 -1.000 1 76 127
	i 8.284 33.000 0.001 1 49 127
	i 9.565 33.000 0.001 1 49 127
	i 9.566 33.061 0.001 1 49 127
	i 9.567 33.124 0.001 1 49 127
	i 8.285 33.124 0.001 1 49 127
	i 9.568 33.187 0.001 1 49 127
	i 8.286 33.249 0.001 1 49 127
	i 9.569 33.249 0.001 1 49 127
	i -11.046 33.257 0
	i 11.047 33.259 -1.000 1 33 74
	i 9.570 33.312 0.001 1 49 127
	i 9.571 33.375 0.001 1 49 127
	i 8.287 33.375 0.001 1 49 127
	i 9.572 33.437 0.001 1 49 127
	i 9.573 33.500 0.001 1 49 127
	i 7.036 33.500 0.001 1 39 127
	i 8.288 33.500 0.001 1 49 127
	i 11.048 33.508 -1.000 1 36 91
	i -11.047 33.517 0
	i 9.574 33.561 0.001 1 49 127
	i 8.289 33.624 0.001 1 49 127
	i 9.575 33.624 0.001 1 49 127
	i 9.576 33.687 0.001 1 49 127
	i 8.290 33.749 0.001 1 49 127
	i 9.577 33.749 0.001 1 49 127
	i 9.578 33.812 0.001 1 49 127
	i 9.579 33.875 0.001 1 49 127
	i 8.291 33.875 0.001 1 49 113
	i 9.580 33.937 0.001 1 49 127
	i -11.048 34.000 0
	i 4.039 34.000 0.001 1 37 127
	i 9.581 34.000 0.001 1 49 127
	i 11.049 34.000 -1.000 1 38 81
	i 8.292 34.000 0.001 1 49 127
	i -10.037 34.000 0
	i -10.038 34.000 0
	i 9.582 34.061 0.001 1 49 127
	i 9.583 34.124 0.001 1 49 127
	i 8.293 34.124 0.001 1 49 127
	i 9.584 34.187 0.001 1 49 127
	i 8.294 34.249 0.001 1 49 127
	i 9.585 34.249 0.001 1 49 127
	i 9.586 34.312 0.001 1 49 127
	i 9.587 34.375 0.001 1 49 127
	i 8.295 34.375 0.001 1 49 127
	i 9.588 34.437 0.001 1 49 127
	i 8.296 34.500 0.001 1 49 127
	i 9.589 34.500 0.001 1 49 127
	i 7.037 34.500 0.001 1 39 127
	i 9.590 34.561 0.001 1 49 127
	i 9.591 34.624 0.001 1 49 127
	i 8.297 34.624 0.001 1 49 127
	i 9.592 34.687 0.001 1 49 127
	i 11.050 34.737 -1.000 1 41 89
	i -11.049 34.744 0
	i 9.593 34.749 0.001 1 49 127
	i 8.298 34.749 0.001 1 49 127
	i 9.594 34.812 0.001 1 49 127
	i 8.299 34.875 0.001 1 49 127
	i 9.595 34.875 0.001 1 49 127
	i 9.596 34.937 0.001 1 49 127
	i 4.040 35.000 0.001 1 37 127
	i 9.597 35.000 0.001 1 49 127
	i 8.300 35.000 0.001 1 49 127
	i 10.039 35.000 -1.000 1 72 127
	i 10.040 35.000 -1.000 1 76 127
	i 9.598 35.061 0.001 1 49 127
	i 9.599 35.124 0.001 1 49 127
	i 8.301 35.124 0.001 1 49 127
	i 9.600 35.187 0.001 1 49 127
	i 8.302 35.249 0.001 1 49 127
	i 9.601 35.249 0.001 1 49 127
	i 11.051 35.255 -1.000 1 38 68
	i -11.050 35.260 0
	i 9.602 35.312 0.001 1 49 127
	i 9.603 35.375 0.001 1 49 127
	i 8.303 35.375 0.001 1 49 127
	i 9.604 35.437 0.001 1 49 127
	i 7.038 35.500 0.001 1 39 127
	i 9.605 35.500 0.001 1 49 127
	i 8.304 35.500 0.001 1 49 127
	i 11.052 35.501 -1.000 1 41 78
	i -11.051 35.509 0
	i 9.606 35.561 0.001 1 49 127
	i 9.607 35.624 0.001 1 49 127
	i 8.305 35.624 0.001 1 49 127
	i 9.608 35.687 0.001 1 49 127
	i 9.609 35.749 0.001 1 49 127
	i 8.306 35.749 0.001 1 49 127
	i 9.610 35.812 0.001 1 49 127
	i 8.307 35.875 0.001 1 49 113
	i 9.611 35.875 0.001 1 49 127
	i 9.612 35.937 0.001 1 49 127
	i -10.039 35.999 0
	i -10.040 35.999 0
	i 4.041 36.000 0.001 1 37 127
	i 9.613 36.000 0.001 1 49 127
	i 8.308 36.000 0.001 1 49 127
	i 11.053 36.012 -1.000 1 38 78
	i -11.052 36.031 0
	i 9.614 36.061 0.001 1 49 127
	i 9.615 36.124 0.001 1 49 127
	i 8.309 36.124 0.001 1 49 127
	i 9.616 36.187 0.001 1 49 127
	i 8.310 36.249 0.001 1 49 127
	i 9.617 36.249 0.001 1 49 127
	i 9.618 36.312 0.001 1 49 127
	i 9.619 36.375 0.001 1 49 127
	i 8.311 36.375 0.001 1 49 127
	i 9.620 36.437 0.001 1 49 127
	i 7.039 36.500 0.001 1 39 127
	i 9.621 36.500 0.001 1 49 127
	i 8.312 36.500 0.001 1 49 127
	i 9.622 36.561 0.001 1 49 127
	i 8.313 36.624 0.001 1 49 127
	i 9.623 36.624 0.001 1 49 127
	i 9.624 36.687 0.001 1 49 127
	i 9.625 36.749 0.001 1 49 127
	i 8.314 36.749 0.001 1 49 127
	i 11.054 36.760 -1.000 1 36 86
	i -11.053 36.768 0
	i 9.626 36.812 0.001 1 49 127
	i 8.315 36.875 0.001 1 49 127
	i 9.627 36.875 0.001 1 49 127
	i 9.628 36.937 0.001 1 49 127
	i 4.042 37.000 0.001 1 37 127
	i 8.316 37.000 0.001 1 49 127
	i 10.041 37.000 -1.000 1 72 127
	i 9.629 37.000 0.001 1 49 127
	i 10.042 37.000 -1.000 1 76 127
	i 9.630 37.061 0.001 1 49 127
	i 9.631 37.124 0.001 1 49 127
	i 8.317 37.124 0.001 1 49 127
	i 9.632 37.187 0.001 1 49 127
	i 8.318 37.249 0.001 1 49 127
	i 9.633 37.249 0.001 1 49 127
	i -11.054 37.257 0
	i 11.055 37.259 -1.000 1 33 74
	i 9.634 37.312 0.001 1 49 127
	i 8.319 37.375 0.001 1 49 127
	i 9.635 37.375 0.001 1 49 127
	i 9.636 37.437 0.001 1 49 127
	i 8.320 37.500 0.001 1 49 127
	i 7.040 37.500 0.001 1 39 127
	i 9.637 37.500 0.001 1 49 127
	i 11.056 37.508 -1.000 1 36 91
	i -11.055 37.517 0
	i 9.638 37.561 0.001 1 49 127
	i 9.639 37.624 0.001 1 49 127
	i 8.321 37.624 0.001 1 49 127
	i 9.640 37.687 0.001 1 49 127
	i 9.641 37.749 0.001 1 49 127
	i 8.322 37.749 0.001 1 49 127
	i 9.642 37.812 0.001 1 49 127
	i 8.323 37.875 0.001 1 49 113
	i 9.643 37.875 0.001 1 49 127
	i 9.644 37.937 0.001 1 49 127
	i 8.324 38.000 0.001 1 49 127
	i 9.645 38.000 0.001 1 49 127
	i 4.043 38.000 0.001 1 37 127
	i -10.041 38.000 0
	i -10.042 38.000 0
	i -11.056 38.000 0
	i 11.057 38.000 -1.000 1 38 81
	i 9.646 38.061 0.001 1 49 127
	i 8.325 38.124 0.001 1 49 127
	i 9.647 38.124 0.001 1 49 127
	i 9.648 38.187 0.001 1 49 127
	i 9.649 38.249 0.001 1 49 127
	i 8.326 38.249 0.001 1 49 127
	i 9.650 38.312 0.001 1 49 127
	i 9.651 38.375 0.001 1 49 127
	i 8.327 38.375 0.001 1 49 127
	i 9.652 38.437 0.001 1 49 127
	i 8.328 38.500 0.001 1 49 127
	i 9.653 38.500 0.001 1 49 127
	i 7.041 38.500 0.001 1 39 127
	i 9.654 38.561 0.001 1 49 127
	i 9.655 38.624 0.001 1 49 127
	i 8.329 38.624 0.001 1 49 127
	i 9.656 38.687 0.001 1 49 127
	i 11.058 38.737 -1.000 1 41 89
	i -11.057 38.744 0
	i 8.330 38.749 0.001 1 49 127
	i 9.657 38.749 0.001 1 49 127
	i 9.658 38.812 0.001 1 49 127
	i 8.331 38.875 0.001 1 49 127
	i 9.659 38.875 0.001 1 49 127
	i 9.660 38.937 0.001 1 49 127
	i 4.044 39.000 0.001 1 37 127
	i 9.661 39.000 0.001 1 49 127
	i 8.332 39.000 0.001 1 49 127
	i 10.043 39.000 -1.000 1 72 127
	i 10.044 39.000 -1.000 1 76 127
	i 9.662 39.061 0.001 1 49 127
	i 9.663 39.124 0.001 1 49 127
	i 8.333 39.124 0.001 1 49 127
	i 9.664 39.187 0.001 1 49 127
	i 9.665 39.249 0.001 1 49 127
	i 8.334 39.249 0.001 1 49 127
	i 11.059 39.255 -1.000 1 38 68
	i -11.058 39.260 0
	i 9.666 39.312 0.001 1 49 127
	i 9.667 39.375 0.001 1 49 127
	i 8.335 39.375 0.001 1 49 127
	i 9.668 39.437 0.001 1 49 127
	i 7.042 39.500 0.001 1 39 127
	i 8.336 39.500 0.001 1 49 127
	i 9.669 39.500 0.001 1 49 127
	i 11.060 39.501 -1.000 1 41 78
	i -11.059 39.509 0
	i 9.670 39.561 0.001 1 49 127
	i 8.337 39.624 0.001 1 49 127
	i 9.671 39.624 0.001 1 49 127
	i 9.672 39.687 0.001 1 49 127
	i 9.673 39.749 0.001 1 49 127
	i 8.338 39.749 0.001 1 49 127
	i 9.674 39.812 0.001 1 49 127
	i 8.339 39.875 0.001 1 49 113
	i 9.675 39.875 0.001 1 49 127
	i 9.676 39.937 0.001 1 49 127
	i 8.340 40.000 0.001 1 49 127
	i -10.043 39.999 0
	i 9.677 40.000 0.001 1 49 127
	i -10.044 39.999 0
	i 4.045 40.000 0.001 1 37 127
	i 11.061 40.012 -1.000 1 38 78
	i -11.060 40.031 0
	i 9.678 40.061 0.001 1 49 127
	i 9.679 40.124 0.001 1 49 127
	i 8.341 40.124 0.001 1 49 127
	i 9.680 40.187 0.001 1 49 127
	i 8.342 40.249 0.001 1 49 127
	i 9.681 40.249 0.001 1 49 127
	i 9.682 40.312 0.001 1 49 127
	i 9.683 40.375 0.001 1 49 127
	i 8.343 40.375 0.001 1 49 127
	i 9.684 40.437 0.001 1 49 127
	i 7.043 40.500 0.001 1 39 127
	i 8.344 40.500 0.001 1 49 127
	i 9.685 40.500 0.001 1 49 127
	i 9.686 40.561 0.001 1 49 127
	i 9.687 40.624 0.001 1 49 127
	i 8.345 40.624 0.001 1 49 127
	i 9.688 40.687 0.001 1 49 127
	i 9.689 40.749 0.001 1 49 127
	i 8.346 40.749 0.001 1 49 127
	i 11.062 40.760 -1.000 1 36 86
	i -11.061 40.768 0
	i 9.690 40.812 0.001 1 49 127
	i 9.691 40.875 0.001 1 49 127
	i 8.347 40.875 0.001 1 49 127
	i 9.692 40.937 0.001 1 49 127
	i 4.046 41.000 0.001 1 37 127
	i 8.348 41.000 0.001 1 49 127
	i 9.693 41.000 0.001 1 49 127
	i 10.045 41.000 -1.000 1 72 127
	i 10.046 41.000 -1.000 1 76 127
	i 9.694 41.061 0.001 1 49 127
	i 8.349 41.124 0.001 1 49 127
	i 9.695 41.124 0.001 1 49 127
	i 9.696 41.187 0.001 1 49 127
	i 8.350 41.249 0.001 1 49 127
	i 9.697 41.249 0.001 1 49 127
	i -11.062 41.257 0
	i 11.063 41.259 -1.000 1 33 74
	i 9.698 41.312 0.001 1 49 127
	i 8.351 41.375 0.001 1 49 127
	i 9.699 41.375 0.001 1 49 127
	i 9.700 41.437 0.001 1 49 127
	i 8.352 41.500 0.001 1 49 127
	i 9.701 41.500 0.001 1 49 127
	i 7.044 41.500 0.001 1 39 127
	i 11.064 41.508 -1.000 1 36 91
	i -11.063 41.517 0
	i 9.702 41.561 0.001 1 49 127
	i 9.703 41.624 0.001 1 49 127
	i 8.353 41.624 0.001 1 49 127
	i 9.704 41.687 0.001 1 49 127
	i 8.354 41.749 0.001 1 49 127
	i 9.705 41.749 0.001 1 49 127
	i 9.706 41.812 0.001 1 49 127
	i 9.707 41.875 0.001 1 49 127
	i 8.355 41.875 0.001 1 49 113
	i 9.708 41.937 0.001 1 49 127
	i -10.045 42.000 0
	i -11.064 41.999 0
	i -10.046 42.000 0
	i 11.065 42.000 -1.000 1 38 83
	i 5.001 42.000 0.001 1 37 127
	i 6.001 42.000 0.001 1 37 127
	i -11.065 42.312 0
	i 10.047 43.000 -1.000 1 72 127
	i 10.048 43.000 -1.000 1 76 127
	i 6.002 43.749 0.001 1 37 127
	i 5.002 43.749 0.001 1 37 127
	i 6.003 44.000 0.001 1 37 127
	i 5.003 44.000 0.001 1 37 127
	i -10.047 43.999 0
	i -10.048 43.999 0
	i 10.049 45.000 -1.000 1 72 127
	i 10.050 45.000 -1.000 1 76 127
	i 5.004 46.000 0.001 1 37 127
	i -10.049 46.000 0
	i -10.050 46.000 0
	i 6.004 46.000 0.001 1 37 127
	i 10.051 47.000 -1.000 1 72 127
	i 10.052 47.000 -1.000 1 76 127
	i 6.005 47.749 0.001 1 37 127
	i 5.005 47.749 0.001 1 37 127
	i 5.006 48.000 0.001 1 37 127
	i 6.006 48.000 0.001 1 37 127
	i -10.051 47.999 0
	i -10.052 47.999 0
	i 10.053 49.000 -1.000 1 72 127
	i 10.054 49.000 -1.000 1 76 127
	i 12.001 50.000 -1.000 1 38 81
	i 5.007 50.000 0.001 1 37 127
	i 6.007 50.000 0.001 1 37 127
	i 9.709 50.000 0.001 1 49 127
	i -10.053 50.000 0
	i -10.054 50.000 0
	i 9.710 50.061 0.001 1 49 127
	i 9.711 50.124 0.001 1 49 127
	i 9.712 50.187 0.001 1 49 127
	i 9.713 50.249 0.001 1 49 127
	i 9.714 50.312 0.001 1 49 127
	i 9.715 50.375 0.001 1 49 127
	i 9.716 50.437 0.001 1 49 127
	i 9.717 50.500 0.001 1 49 127
	i 9.718 50.561 0.001 1 49 127
	i 9.719 50.624 0.001 1 49 127
	i 9.720 50.687 0.001 1 49 127
	i 12.002 50.737 -1.000 1 41 89
	i -12.001 50.744 0
	i 9.721 50.749 0.001 1 49 127
	i 9.722 50.812 0.001 1 49 127
	i 9.723 50.875 0.001 1 49 127
	i 9.724 50.937 0.001 1 49 127
	i 9.725 51.000 0.001 1 49 127
	i 10.055 51.000 -1.000 1 72 127
	i 10.056 51.000 -1.000 1 76 127
	i 9.726 51.061 0.001 1 49 127
	i 9.727 51.124 0.001 1 49 127
	i 9.728 51.187 0.001 1 49 127
	i 9.729 51.249 0.001 1 49 127
	i 12.003 51.255 -1.000 1 38 68
	i -12.002 51.260 0
	i 9.730 51.312 0.001 1 49 127
	i 9.731 51.375 0.001 1 49 127
	i 9.732 51.437 0.001 1 49 127
	i 9.733 51.500 0.001 1 49 127
	i 12.004 51.501 -1.000 1 41 78
	i -12.003 51.509 0
	i 9.734 51.561 0.001 1 49 127
	i 9.735 51.624 0.001 1 49 127
	i 9.736 51.687 0.001 1 49 127
	i 5.008 51.749 0.001 1 37 127
	i 6.008 51.749 0.001 1 37 127
	i 9.737 51.749 0.001 1 49 127
	i 9.738 51.812 0.001 1 49 127
	i 9.739 51.875 0.001 1 49 127
	i 9.740 51.937 0.001 1 49 127
	i -10.055 51.999 0
	i -10.056 51.999 0
	i 5.009 52.000 0.001 1 37 127
	i 6.009 52.000 0.001 1 37 127
	i 9.741 52.000 0.001 1 49 127
	i 12.005 52.012 -1.000 1 38 78
	i -12.004 52.031 0
	i 9.742 52.061 0.001 1 49 127
	i 9.743 52.124 0.001 1 49 127
	i 9.744 52.187 0.001 1 49 127
	i 9.745 52.249 0.001 1 49 127
	i 9.746 52.312 0.001 1 49 127
	i 9.747 52.375 0.001 1 49 127
	i 9.748 52.437 0.001 1 49 127
	i -12.005 52.500 0
	i 9.749 52.500 0.001 1 49 127
	i 9.750 52.561 0.001 1 49 127
	i 9.751 52.624 0.001 1 49 127
	i 9.752 52.687 0.001 1 49 127
	i 9.753 52.749 0.001 1 49 127
	i 9.754 52.812 0.001 1 49 127
	i 9.755 52.875 0.001 1 49 127
	i 9.756 52.937 0.001 1 49 127
	i 10.057 53.000 -1.000 1 72 127
	i 9.757 53.000 0.001 1 49 127
	i 10.058 53.000 -1.000 1 76 127
	i 9.758 53.061 0.001 1 49 127
	i 9.759 53.124 0.001 1 49 127
	i 9.760 53.187 0.001 1 49 127
	i 9.761 53.249 0.001 1 49 127
	i 9.762 53.312 0.001 1 49 127
	i 9.763 53.375 0.001 1 49 127
	i 9.764 53.437 0.001 1 49 127
	i 9.765 53.500 0.001 1 49 127
	i 9.766 53.561 0.001 1 49 127
	i 9.767 53.624 0.001 1 49 127
	i 9.768 53.687 0.001 1 49 127
	i 9.769 53.749 0.001 1 49 127
	i 9.770 53.812 0.001 1 49 127
	i 9.771 53.875 0.001 1 49 127
	i 9.772 53.937 0.001 1 49 127
	i 9.773 54.000 0.001 1 49 127
	i 12.006 54.000 -1.000 1 38 81
	i -10.057 54.000 0
	i 5.010 54.000 0.001 1 37 127
	i 6.010 54.000 0.001 1 37 127
	i -10.058 54.000 0
	i 9.774 54.061 0.001 1 49 127
	i 9.775 54.124 0.001 1 49 127
	i 9.776 54.187 0.001 1 49 127
	i 9.777 54.249 0.001 1 49 127
	i 9.778 54.312 0.001 1 49 127
	i 9.779 54.375 0.001 1 49 127
	i 9.780 54.437 0.001 1 49 127
	i 9.781 54.500 0.001 1 49 127
	i 9.782 54.561 0.001 1 49 127
	i 9.783 54.624 0.001 1 49 127
	i 9.784 54.687 0.001 1 49 127
	i 12.007 54.737 -1.000 1 41 89
	i -12.006 54.744 0
	i 9.785 54.749 0.001 1 49 127
	i 9.786 54.812 0.001 1 49 127
	i 9.787 54.875 0.001 1 49 127
	i 9.788 54.937 0.001 1 49 127
	i 10.059 55.000 -1.000 1 72 127
	i 10.060 55.000 -1.000 1 76 127
	i 9.789 55.000 0.001 1 49 127
	i 9.790 55.061 0.001 1 49 127
	i 9.791 55.124 0.001 1 49 127
	i 9.792 55.187 0.001 1 49 127
	i 9.793 55.249 0.001 1 49 127
	i 12.008 55.255 -1.000 1 38 68
	i -12.007 55.260 0
	i 9.794 55.312 0.001 1 49 127
	i 9.795 55.375 0.001 1 49 127
	i 9.796 55.437 0.001 1 49 127
	i 12.009 55.501 -1.000 1 41 78
	i 9.797 55.500 0.001 1 49 127
	i -12.008 55.509 0
	i 9.798 55.561 0.001 1 49 127
	i 9.799 55.624 0.001 1 49 127
	i 9.800 55.687 0.001 1 49 127
	i 9.801 55.749 0.001 1 49 127
	i 6.011 55.749 0.001 1 37 127
	i 5.011 55.749 0.001 1 37 127
	i 9.802 55.812 0.001 1 49 127
	i 9.803 55.875 0.001 1 49 127
	i 9.804 55.937 0.001 1 49 127
	i 6.012 56.000 0.001 1 37 127
	i 5.012 56.000 0.001 1 37 127
	i -10.059 55.999 0
	i -10.060 55.999 0
	i 9.805 56.000 0.001 1 49 127
	i 12.010 56.012 -1.000 1 38 78
	i -12.009 56.031 0
	i 9.806 56.061 0.001 1 49 127
	i 9.807 56.124 0.001 1 49 127
	i 9.808 56.187 0.001 1 49 127
	i 9.809 56.249 0.001 1 49 127
	i 9.810 56.312 0.001 1 49 127
	i 9.811 56.375 0.001 1 49 127
	i 9.812 56.437 0.001 1 49 127
	i -12.010 56.500 0
	i 9.813 56.500 0.001 1 49 127
	i 9.814 56.561 0.001 1 49 127
	i 9.815 56.624 0.001 1 49 127
	i 9.816 56.687 0.001 1 49 127
	i 9.817 56.749 0.001 1 49 127
	i 9.818 56.812 0.001 1 49 127
	i 9.819 56.875 0.001 1 49 127
	i 9.820 56.937 0.001 1 49 127
	i 9.821 57.000 0.001 1 49 127
	i 10.061 57.000 -1.000 1 72 127
	i 10.062 57.000 -1.000 1 76 127
	i 9.822 57.061 0.001 1 49 127
	i 9.823 57.124 0.001 1 49 127
	i 9.824 57.187 0.001 1 49 127
	i 9.825 57.249 0.001 1 49 127
	i 9.826 57.312 0.001 1 49 127
	i 9.827 57.375 0.001 1 49 127
	i 9.828 57.437 0.001 1 49 127
	i 9.829 57.500 0.001 1 49 127
	i 9.830 57.561 0.001 1 49 127
	i 9.831 57.624 0.001 1 49 127
	i 9.832 57.687 0.001 1 49 127
	i 9.833 57.749 0.001 1 49 127
	i 9.834 57.812 0.001 1 49 127
	i 9.835 57.875 0.001 1 49 127
	i 9.836 57.937 0.001 1 49 127
	i 9.837 58.000 0.001 1 49 127
	i 5.013 58.000 0.001 1 37 127
	i 11.066 58.000 -1.000 1 38 81
	i 6.013 58.000 0.001 1 37 127
	i -10.061 58.000 0
	i 8.356 58.000 0.001 1 49 127
	i -10.062 58.000 0
	i 4.047 58.000 0.001 1 37 127
	i 9.838 58.061 0.001 1 49 127
	i 9.839 58.124 0.001 1 49 127
	i 8.357 58.124 0.001 1 49 127
	i 9.840 58.187 0.001 1 49 127
	i 9.841 58.249 0.001 1 49 127
	i 8.358 58.249 0.001 1 49 127
	i 9.842 58.312 0.001 1 49 127
	i 8.359 58.375 0.001 1 49 127
	i 9.843 58.375 0.001 1 49 127
	i 9.844 58.437 0.001 1 49 127
	i 9.845 58.500 0.001 1 49 127
	i 8.360 58.500 0.001 1 49 127
	i 7.045 58.500 0.001 1 39 127
	i 9.846 58.561 0.001 1 49 127
	i 8.361 58.624 0.001 1 49 127
	i 9.847 58.624 0.001 1 49 127
	i 9.848 58.687 0.001 1 49 127
	i 11.067 58.737 -1.000 1 41 89
	i -11.066 58.744 0
	i 9.849 58.749 0.001 1 49 127
	i 8.362 58.749 0.001 1 49 127
	i 9.850 58.812 0.001 1 49 127
	i 8.363 58.875 0.001 1 49 127
	i 9.851 58.875 0.001 1 49 127
	i 9.852 58.937 0.001 1 49 127
	i 10.063 59.000 -1.000 1 72 127
	i 4.048 59.000 0.001 1 37 127
	i 10.064 59.000 -1.000 1 76 127
	i 8.364 59.000 0.001 1 49 127
	i 9.853 59.000 0.001 1 49 127
	i 9.854 59.061 0.001 1 49 127
	i 9.855 59.124 0.001 1 49 127
	i 8.365 59.124 0.001 1 49 127
	i 9.856 59.187 0.001 1 49 127
	i 9.857 59.249 0.001 1 49 127
	i 8.366 59.249 0.001 1 49 127
	i 11.068 59.255 -1.000 1 38 68
	i -11.067 59.260 0
	i 9.858 59.312 0.001 1 49 127
	i 9.859 59.375 0.001 1 49 127
	i 8.367 59.375 0.001 1 49 127
	i 9.860 59.437 0.001 1 49 127
	i 11.069 59.501 -1.000 1 41 78
	i 9.861 59.500 0.001 1 49 127
	i 8.368 59.500 0.001 1 49 127
	i 7.046 59.500 0.001 1 39 127
	i -11.068 59.509 0
	i 9.862 59.561 0.001 1 49 127
	i 8.369 59.624 0.001 1 49 127
	i 9.863 59.624 0.001 1 49 127
	i 9.864 59.687 0.001 1 49 127
	i 8.370 59.749 0.001 1 49 127
	i 9.865 59.749 0.001 1 49 127
	i 6.014 59.749 0.001 1 37 127
	i 5.014 59.749 0.001 1 37 127
	i 9.866 59.812 0.001 1 49 127
	i 9.867 59.875 0.001 1 49 127
	i 8.371 59.875 0.001 1 49 113
	i 9.868 59.937 0.001 1 49 127
	i 5.015 60.000 0.001 1 37 127
	i 6.015 60.000 0.001 1 37 127
	i 4.049 60.000 0.001 1 37 127
	i 8.372 60.000 0.001 1 49 127
	i -10.063 59.999 0
	i -10.064 59.999 0
	i 9.869 60.000 0.001 1 49 127
	i 11.070 60.012 -1.000 1 38 78
	i -11.069 60.031 0
	i 9.870 60.061 0.001 1 49 127
	i 9.871 60.124 0.001 1 49 127
	i 8.373 60.124 0.001 1 49 127
	i 9.872 60.187 0.001 1 49 127
	i 9.873 60.249 0.001 1 49 127
	i 8.374 60.249 0.001 1 49 127
	i 9.874 60.312 0.001 1 49 127
	i 8.375 60.375 0.001 1 49 127
	i 9.875 60.375 0.001 1 49 127
	i 9.876 60.437 0.001 1 49 127
	i 9.877 60.500 0.001 1 49 127
	i 7.047 60.500 0.001 1 39 127
	i 8.376 60.500 0.001 1 49 127
	i 9.878 60.561 0.001 1 49 127
	i 8.377 60.624 0.001 1 49 127
	i 9.879 60.624 0.001 1 49 127
	i 9.880 60.687 0.001 1 49 127
	i 9.881 60.749 0.001 1 49 127
	i 8.378 60.749 0.001 1 49 127
	i 11.071 60.760 -1.000 1 36 86
	i -11.070 60.768 0
	i 9.882 60.812 0.001 1 49 127
	i 8.379 60.875 0.001 1 49 127
	i 9.883 60.875 0.001 1 49 127
	i 9.884 60.937 0.001 1 49 127
	i 4.050 61.000 0.001 1 37 127
	i 9.885 61.000 0.001 1 49 127
	i 8.380 61.000 0.001 1 49 127
	i 10.065 61.000 -1.000 1 72 127
	i 10.066 61.000 -1.000 1 76 127
	i 9.886 61.061 0.001 1 49 127
	i 8.381 61.124 0.001 1 49 127
	i 9.887 61.124 0.001 1 49 127
	i 9.888 61.187 0.001 1 49 127
	i 9.889 61.249 0.001 1 49 127
	i 8.382 61.249 0.001 1 49 127
	i -11.071 61.257 0
	i 11.072 61.259 -1.000 1 33 74
	i 9.890 61.312 0.001 1 49 127
	i 8.383 61.375 0.001 1 49 127
	i 9.891 61.375 0.001 1 49 127
	i 9.892 61.437 0.001 1 49 127
	i 7.048 61.500 0.001 1 39 127
	i 9.893 61.500 0.001 1 49 127
	i 8.384 61.500 0.001 1 49 127
	i 11.073 61.508 -1.000 1 36 91
	i -11.072 61.517 0
	i 9.894 61.561 0.001 1 49 127
	i 8.385 61.624 0.001 1 49 127
	i 9.895 61.624 0.001 1 49 127
	i 9.896 61.687 0.001 1 49 127
	i 9.897 61.749 0.001 1 49 127
	i 8.386 61.749 0.001 1 49 127
	i 9.898 61.812 0.001 1 49 127
	i 9.899 61.875 0.001 1 49 127
	i 8.387 61.875 0.001 1 49 113
	i 9.900 61.937 0.001 1 49 127
	i 6.016 62.000 0.001 1 37 127
	i 5.016 62.000 0.001 1 37 127
	i 9.901 62.000 0.001 1 49 127
	i -10.065 62.000 0
	i -11.073 62.000 0
	i -10.066 62.000 0
	i 11.074 62.000 -1.000 1 38 81
	i 4.051 62.000 0.001 1 37 127
	i 8.388 62.000 0.001 1 49 127
	i 9.902 62.061 0.001 1 49 127
	i 8.389 62.124 0.001 1 49 127
	i 9.903 62.124 0.001 1 49 127
	i 9.904 62.187 0.001 1 49 127
	i 8.390 62.249 0.001 1 49 127
	i 9.905 62.249 0.001 1 49 127
	i 9.906 62.312 0.001 1 49 127
	i 8.391 62.375 0.001 1 49 127
	i 9.907 62.375 0.001 1 49 127
	i 9.908 62.437 0.001 1 49 127
	i 7.049 62.500 0.001 1 39 127
	i 8.392 62.500 0.001 1 49 127
	i 9.909 62.500 0.001 1 49 127
	i 9.910 62.561 0.001 1 49 127
	i 9.911 62.624 0.001 1 49 127
	i 8.393 62.624 0.001 1 49 127
	i 9.912 62.687 0.001 1 49 127
	i 11.075 62.737 -1.000 1 41 89
	i -11.074 62.744 0
	i 9.913 62.749 0.001 1 49 127
	i 8.394 62.749 0.001 1 49 127
	i 9.914 62.812 0.001 1 49 127
	i 8.395 62.875 0.001 1 49 127
	i 9.915 62.875 0.001 1 49 127
	i 9.916 62.937 0.001 1 49 127
	i 9.917 63.000 0.001 1 49 127
	i 10.067 63.000 -1.000 1 72 127
	i 10.068 63.000 -1.000 1 76 127
	i 4.052 63.000 0.001 1 37 127
	i 8.396 63.000 0.001 1 49 127
	i 9.918 63.061 0.001 1 49 127
	i 9.919 63.124 0.001 1 49 127
	i 8.397 63.124 0.001 1 49 127
	i 9.920 63.187 0.001 1 49 127
	i 8.398 63.249 0.001 1 49 127
	i 9.921 63.249 0.001 1 49 127
	i 11.076 63.255 -1.000 1 38 68
	i -11.075 63.260 0
	i 9.922 63.312 0.001 1 49 127
	i 9.923 63.375 0.001 1 49 127
	i 8.399 63.375 0.001 1 49 127
	i 9.924 63.437 0.001 1 49 127
	i 9.925 63.500 0.001 1 49 127
	i 11.077 63.501 -1.000 1 41 78
	i 8.400 63.500 0.001 1 49 127
	i 7.050 63.500 0.001 1 39 127
	i -11.076 63.509 0
	i 9.926 63.561 0.001 1 49 127
	i 8.401 63.624 0.001 1 49 127
	i 9.927 63.624 0.001 1 49 127
	i 9.928 63.687 0.001 1 49 127
	i 8.402 63.749 0.001 1 49 127
	i 6.017 63.749 0.001 1 37 127
	i 5.017 63.749 0.001 1 37 127
	i 9.929 63.749 0.001 1 49 127
	i 9.930 63.812 0.001 1 49 127
	i 9.931 63.875 0.001 1 49 127
	i 8.403 63.875 0.001 1 49 113
	i 9.932 63.937 0.001 1 49 127
	i 6.018 64.000 0.001 1 37 127
	i 5.018 64.000 0.001 1 37 127
	i 4.053 64.000 0.001 1 37 127
	i 9.933 64.000 0.001 1 49 127
	i -10.067 63.999 0
	i 8.404 64.000 0.001 1 49 127
	i -10.068 63.999 0
	i 11.078 64.012 -1.000 1 38 78
	i -11.077 64.031 0
	i 9.934 64.061 0.001 1 49 127
	i 8.405 64.124 0.001 1 49 127
	i 9.935 64.124 0.001 1 49 127
	i 9.936 64.187 0.001 1 49 127
	i 8.406 64.249 0.001 1 49 127
	i 9.937 64.249 0.001 1 49 127
	i 9.938 64.312 0.001 1 49 127
	i 8.407 64.375 0.001 1 49 127
	i 9.939 64.375 0.001 1 49 127
	i 9.940 64.437 0.001 1 49 127
	i 9.941 64.500 0.001 1 49 127
	i 8.408 64.500 0.001 1 49 127
	i 7.051 64.500 0.001 1 39 127
	i 9.942 64.561 0.001 1 49 127
	i 9.943 64.624 0.001 1 49 127
	i 8.409 64.624 0.001 1 49 127
	i 9.944 64.687 0.001 1 49 127
	i 8.410 64.749 0.001 1 49 127
	i 9.945 64.749 0.001 1 49 127
	i 11.079 64.760 -1.000 1 36 86
	i -11.078 64.768 0
	i 9.946 64.812 0.001 1 49 127
	i 8.411 64.875 0.001 1 49 127
	i 9.947 64.875 0.001 1 49 127
	i 9.948 64.937 0.001 1 49 127
	i 8.412 65.000 0.001 1 49 127
	i 9.949 65.000 0.001 1 49 127
	i 10.069 65.000 -1.000 1 72 127
	i 4.054 65.000 0.001 1 37 127
	i 10.070 65.000 -1.000 1 76 127
	i 9.950 65.061 0.001 1 49 127
	i 9.951 65.124 0.001 1 49 127
	i 8.413 65.124 0.001 1 49 127
	i 9.952 65.187 0.001 1 49 127
	i 8.414 65.249 0.001 1 49 127
	i 9.953 65.249 0.001 1 49 127
	i -11.079 65.257 0
	i 11.080 65.259 -1.000 1 33 74
	i 9.954 65.312 0.001 1 49 127
	i 8.415 65.375 0.001 1 49 127
	i 9.955 65.375 0.001 1 49 127
	i 9.956 65.437 0.001 1 49 127
	i 7.052 65.500 0.001 1 39 127
	i 9.957 65.500 0.001 1 49 127
	i 8.416 65.500 0.001 1 49 127
	i 11.081 65.508 -1.000 1 36 91
	i -11.080 65.517 0
	i 9.958 65.561 0.001 1 49 127
	i 8.417 65.624 0.001 1 49 127
	i 9.959 65.624 0.001 1 49 127
	i 9.960 65.687 0.001 1 49 127
	i 8.418 65.749 0.001 1 49 127
	i 9.961 65.749 0.001 1 49 127
	i 9.962 65.812 0.001 1 49 127
	i 8.419 65.875 0.001 1 49 113
	i 9.963 65.875 0.001 1 49 127
	i 9.964 65.937 0.001 1 49 127
	i 4.055 66.000 0.001 1 37 127
	i -11.081 66.000 0
	i 5.019 66.000 0.001 1 37 127
	i 11.082 66.000 -1.000 1 38 81
	i 9.965 66.000 0.001 1 49 127
	i 8.420 66.000 0.001 1 49 127
	i 6.019 66.000 0.001 1 37 127
	i -10.069 66.000 0
	i -10.070 66.000 0
	i 9.966 66.061 0.001 1 49 127
	i 9.967 66.124 0.001 1 49 127
	i 8.421 66.124 0.001 1 49 127
	i 9.968 66.187 0.001 1 49 127
	i 9.969 66.249 0.001 1 49 127
	i 8.422 66.249 0.001 1 49 127
	i 9.970 66.312 0.001 1 49 127
	i 9.971 66.375 0.001 1 49 127
	i 8.423 66.375 0.001 1 49 127
	i 9.972 66.437 0.001 1 49 127
	i 7.053 66.500 0.001 1 39 127
	i 8.424 66.500 0.001 1 49 127
	i 9.973 66.500 0.001 1 49 127
	i 9.974 66.561 0.001 1 49 127
	i 9.975 66.624 0.001 1 49 127
	i 8.425 66.624 0.001 1 49 127
	i 9.976 66.687 0.001 1 49 127
	i 11.083 66.737 -1.000 1 41 89
	i -11.082 66.744 0
	i 8.426 66.749 0.001 1 49 127
	i 9.977 66.749 0.001 1 49 127
	i 9.978 66.812 0.001 1 49 127
	i 8.427 66.875 0.001 1 49 127
	i 9.979 66.875 0.001 1 49 127
	i 9.980 66.937 0.001 1 49 127
	i 8.428 67.000 0.001 1 49 127
	i 9.981 67.000 0.001 1 49 127
	i 10.071 67.000 -1.000 1 72 127
	i 10.072 67.000 -1.000 1 76 127
	i 4.056 67.000 0.001 1 37 127
	i 9.982 67.061 0.001 1 49 127
	i 9.983 67.124 0.001 1 49 127
	i 8.429 67.124 0.001 1 49 127
	i 9.984 67.187 0.001 1 49 127
	i 9.985 67.249 0.001 1 49 127
	i 8.430 67.249 0.001 1 49 127
	i 11.084 67.255 -1.000 1 38 68
	i -11.083 67.260 0
	i 9.986 67.312 0.001 1 49 127
	i 8.431 67.375 0.001 1 49 127
	i 9.987 67.375 0.001 1 49 127
	i 9.988 67.437 0.001 1 49 127
	i 11.085 67.501 -1.000 1 41 78
	i 7.054 67.500 0.001 1 39 127
	i 9.989 67.500 0.001 1 49 127
	i 8.432 67.500 0.001 1 49 127
	i -11.084 67.509 0
	i 9.990 67.561 0.001 1 49 127
	i 8.433 67.624 0.001 1 49 127
	i 9.991 67.624 0.001 1 49 127
	i 9.992 67.687 0.001 1 49 127
	i 9.993 67.749 0.001 1 49 127
	i 5.020 67.749 0.001 1 37 127
	i 6.020 67.749 0.001 1 37 127
	i 8.434 67.749 0.001 1 49 127
	i 9.994 67.812 0.001 1 49 127
	i 9.995 67.875 0.001 1 49 127
	i 8.435 67.875 0.001 1 49 113
	i 9.996 67.937 0.001 1 49 127
	i -10.071 67.999 0
	i 4.057 68.000 0.001 1 37 127
	i 5.021 68.000 0.001 1 37 127
	i 6.021 68.000 0.001 1 37 127
	i 8.436 68.000 0.001 1 49 127
	i -10.072 67.999 0
	i 9.997 68.000 0.001 1 49 127
	i 11.086 68.012 -1.000 1 38 78
	i -11.085 68.031 0
	i 9.998 68.061 0.001 1 49 127
	i 8.437 68.124 0.001 1 49 127
	i 9.999 68.124 0.001 1 49 127
	i 9.001 68.187 0.001 1 49 127
	i 8.438 68.249 0.001 1 49 127
	i 9.002 68.249 0.001 1 49 127
	i 9.003 68.312 0.001 1 49 127
	i 8.439 68.375 0.001 1 49 127
	i 9.004 68.375 0.001 1 49 127
	i 9.005 68.437 0.001 1 49 127
	i 8.440 68.500 0.001 1 49 127
	i 7.055 68.500 0.001 1 39 127
	i 9.006 68.500 0.001 1 49 127
	i 9.007 68.561 0.001 1 49 127
	i 8.441 68.624 0.001 1 49 127
	i 9.008 68.624 0.001 1 49 127
	i 9.009 68.687 0.001 1 49 127
	i 8.442 68.749 0.001 1 49 127
	i 9.010 68.749 0.001 1 49 127
	i 11.087 68.760 -1.000 1 36 86
	i -11.086 68.768 0
	i 9.011 68.812 0.001 1 49 127
	i 8.443 68.875 0.001 1 49 127
	i 9.012 68.875 0.001 1 49 127
	i 9.013 68.937 0.001 1 49 127
	i 8.444 69.000 0.001 1 49 127
	i 4.058 69.000 0.001 1 37 127
	i 9.014 69.000 0.001 1 49 127
	i 10.073 69.000 -1.000 1 72 127
	i 10.074 69.000 -1.000 1 76 127
	i 9.015 69.061 0.001 1 49 127
	i 8.445 69.124 0.001 1 49 127
	i 9.016 69.124 0.001 1 49 127
	i 9.017 69.187 0.001 1 49 127
	i 8.446 69.249 0.001 1 49 127
	i 9.018 69.249 0.001 1 49 127
	i -11.087 69.257 0
	i 11.088 69.259 -1.000 1 33 74
	i 9.019 69.312 0.001 1 49 127
	i 9.020 69.375 0.001 1 49 127
	i 8.447 69.375 0.001 1 49 127
	i 9.021 69.437 0.001 1 49 127
	i 8.448 69.500 0.001 1 49 127
	i 9.022 69.500 0.001 1 49 127
	i 7.056 69.500 0.001 1 39 127
	i 11.089 69.508 -1.000 1 36 91
	i -11.088 69.517 0
	i 9.023 69.561 0.001 1 49 127
	i 9.024 69.624 0.001 1 49 127
	i 8.449 69.624 0.001 1 49 127
	i 9.025 69.687 0.001 1 49 127
	i 8.450 69.749 0.001 1 49 127
	i 9.026 69.749 0.001 1 49 127
	i 9.027 69.812 0.001 1 49 127
	i 8.451 69.875 0.001 1 49 113
	i 9.028 69.875 0.001 1 49 127
	i 9.029 69.937 0.001 1 49 127
	i 4.059 70.000 0.001 1 37 127
	i -11.089 69.999 0
	i 11.090 70.000 -1.000 1 38 83
	i 5.022 70.000 0.001 1 37 127
	i 6.022 70.000 0.001 1 37 127
	i 8.452 70.000 0.001 1 49 127
	i 9.030 70.000 0.001 1 49 127
	i -10.073 70.000 0
	i -10.074 70.000 0
	i 9.031 70.061 0.001 1 49 127
	i 8.453 70.124 0.001 1 49 127
	i 9.032 70.124 0.001 1 49 127
	i 9.033 70.187 0.001 1 49 127
	i 9.034 70.249 0.001 1 49 127
	i 8.454 70.249 0.001 1 49 127
	i 9.035 70.312 0.001 1 49 127
	i 8.455 70.375 0.001 1 49 127
	i 9.036 70.375 0.001 1 49 127
	i 9.037 70.437 0.001 1 49 127
	i 7.057 70.500 0.001 1 39 127
	i 9.038 70.500 0.001 1 49 127
	i 8.456 70.500 0.001 1 49 127
	i 9.039 70.561 0.001 1 49 127
	i 9.040 70.624 0.001 1 49 127
	i 8.457 70.624 0.001 1 49 127
	i 9.041 70.687 0.001 1 49 127
	i 11.091 70.737 -1.000 1 41 103
	i 8.458 70.749 0.001 1 49 127
	i 9.042 70.749 0.001 1 49 127
	i -11.090 70.756 0
	i 9.043 70.812 0.001 1 49 127
	i 8.459 70.875 0.001 1 49 127
	i 9.044 70.875 0.001 1 49 127
	i 9.045 70.937 0.001 1 49 127
	i 9.046 71.000 0.001 1 49 127
	i 10.075 71.000 -1.000 1 72 127
	i 10.076 71.000 -1.000 1 76 127
	i 4.060 71.000 0.001 1 37 127
	i 8.460 71.000 0.001 1 49 127
	i 9.047 71.061 0.001 1 49 127
	i 8.461 71.124 0.001 1 49 127
	i 9.048 71.124 0.001 1 49 127
	i 9.049 71.187 0.001 1 49 127
	i 11.092 71.223 -1.000 1 44 76
	i -11.091 71.235 0
	i 9.050 71.249 0.001 1 49 127
	i 8.462 71.249 0.001 1 49 127
	i 9.051 71.312 0.001 1 49 127
	i 8.463 71.375 0.001 1 49 127
	i 9.052 71.375 0.001 1 49 127
	i 9.053 71.437 0.001 1 49 127
	i 8.464 71.500 0.001 1 49 127
	i 7.058 71.500 0.001 1 39 127
	i 9.054 71.500 0.001 1 49 127
	i -11.092 71.523 0
	i 11.093 71.523 -1.000 1 43 89
	i 9.055 71.561 0.001 1 49 127
	i 8.465 71.624 0.001 1 49 127
	i 9.056 71.624 0.001 1 49 127
	i 9.057 71.687 0.001 1 49 127
	i 8.466 71.749 0.001 1 49 127
	i 5.023 71.749 0.001 1 37 127
	i 9.058 71.749 0.001 1 49 127
	i 6.023 71.749 0.001 1 37 127
	i 9.059 71.812 0.001 1 49 127
	i 8.467 71.875 0.001 1 49 113
	i 9.060 71.875 0.001 1 49 127
	i 9.061 71.937 0.001 1 49 127
	i 6.024 72.000 0.001 1 37 127
	i 8.468 72.000 0.001 1 49 127
	i 5.024 72.000 0.001 1 37 127
	i -11.093 71.997 0
	i 9.062 72.000 0.001 1 49 127
	i 4.061 72.000 0.001 1 37 127
	i -10.075 71.999 0
	i 11.094 71.997 -1.000 1 41 97
	i -10.076 71.999 0
	i 9.063 72.061 0.001 1 49 127
	i 8.469 72.124 0.001 1 49 127
	i 9.064 72.124 0.001 1 49 127
	i 9.065 72.187 0.001 1 49 127
	i 8.470 72.249 0.001 1 49 127
	i 9.066 72.249 0.001 1 49 127
	i 9.067 72.312 0.001 1 49 127
	i 8.471 72.375 0.001 1 49 127
	i 9.068 72.375 0.001 1 49 127
	i 9.069 72.437 0.001 1 49 127
	i 9.070 72.500 0.001 1 49 127
	i 8.472 72.500 0.001 1 49 127
	i 7.059 72.500 0.001 1 39 127
	i 9.071 72.561 0.001 1 49 127
	i 9.072 72.624 0.001 1 49 127
	i 8.473 72.624 0.001 1 49 127
	i 9.073 72.687 0.001 1 49 127
	i 9.074 72.749 0.001 1 49 127
	i 8.474 72.749 0.001 1 49 127
	i -11.094 72.756 0
	i 11.095 72.759 -1.000 1 38 80
	i 9.075 72.812 0.001 1 49 127
	i 8.475 72.875 0.001 1 49 127
	i 9.076 72.875 0.001 1 49 127
	i 9.077 72.937 0.001 1 49 127
	i 4.062 73.000 0.001 1 37 127
	i 9.078 73.000 0.001 1 49 127
	i 10.077 73.000 -1.000 1 72 127
	i 10.078 73.000 -1.000 1 76 127
	i 8.476 73.000 0.001 1 49 127
	i 9.079 73.061 0.001 1 49 127
	i 8.477 73.124 0.001 1 49 127
	i 9.080 73.124 0.001 1 49 127
	i 9.081 73.187 0.001 1 49 127
	i 11.096 73.205 -1.000 1 33 79
	i -11.095 73.229 0
	i 8.478 73.249 0.001 1 49 127
	i 9.082 73.249 0.001 1 49 127
	i 9.083 73.312 0.001 1 49 127
	i 8.479 73.375 0.001 1 49 127
	i 9.084 73.375 0.001 1 49 127
	i 9.085 73.437 0.001 1 49 127
	i 9.086 73.500 0.001 1 49 127
	i 8.480 73.500 0.001 1 49 127
	i 7.060 73.500 0.001 1 39 127
	i 11.097 73.507 -1.000 1 36 89
	i -11.096 73.508 0
	i 9.087 73.561 0.001 1 49 127
	i 8.481 73.624 0.001 1 49 127
	i 9.088 73.624 0.001 1 49 127
	i 9.089 73.687 0.001 1 49 127
	i 9.090 73.749 0.001 1 49 127
	i 8.482 73.749 0.001 1 49 127
	i 9.091 73.812 0.001 1 49 127
	i 8.483 73.875 0.001 1 49 113
	i 9.092 73.875 0.001 1 49 127
	i 9.093 73.937 0.001 1 49 127
	i 5.025 74.000 0.001 1 37 127
	i 4.063 74.000 0.001 1 37 127
	i 6.025 74.000 0.001 1 37 127
	i 8.484 74.000 0.001 1 49 127
	i -11.097 73.999 0
	i 9.094 74.000 0.001 1 49 127
	i 11.098 74.000 -1.000 1 38 81
	i -10.077 74.000 0
	i -10.078 74.000 0
	i 9.095 74.061 0.001 1 49 127
	i 8.485 74.124 0.001 1 49 127
	i 9.096 74.124 0.001 1 49 127
	i 9.097 74.187 0.001 1 49 127
	i 8.486 74.249 0.001 1 49 127
	i 9.098 74.249 0.001 1 49 127
	i 9.099 74.312 0.001 1 49 127
	i 8.487 74.375 0.001 1 49 127
	i 9.100 74.375 0.001 1 49 127
	i 9.101 74.437 0.001 1 49 127
	i 9.102 74.500 0.001 1 49 127
	i 7.061 74.500 0.001 1 39 127
	i 8.488 74.500 0.001 1 49 127
	i 9.103 74.561 0.001 1 49 127
	i 9.104 74.624 0.001 1 49 127
	i 8.489 74.624 0.001 1 49 127
	i 9.105 74.687 0.001 1 49 127
	i 11.099 74.737 -1.000 1 41 89
	i -11.098 74.744 0
	i 9.106 74.749 0.001 1 49 127
	i 8.490 74.749 0.001 1 49 127
	i 9.107 74.812 0.001 1 49 127
	i 8.491 74.875 0.001 1 49 127
	i 9.108 74.875 0.001 1 49 127
	i 9.109 74.937 0.001 1 49 127
	i 9.110 75.000 0.001 1 49 127
	i 10.079 75.000 -1.000 1 72 127
	i 4.064 75.000 0.001 1 37 127
	i 10.080 75.000 -1.000 1 76 127
	i 8.492 75.000 0.001 1 49 127
	i 9.111 75.061 0.001 1 49 127
	i 8.493 75.124 0.001 1 49 127
	i 9.112 75.124 0.001 1 49 127
	i 9.113 75.187 0.001 1 49 127
	i 8.494 75.249 0.001 1 49 127
	i 9.114 75.249 0.001 1 49 127
	i 11.100 75.255 -1.000 1 38 68
	i -11.099 75.260 0
	i 9.115 75.312 0.001 1 49 127
	i 8.495 75.375 0.001 1 49 127
	i 9.116 75.375 0.001 1 49 127
	i 9.117 75.437 0.001 1 49 127
	i 8.496 75.500 0.001 1 49 127
	i 11.101 75.501 -1.000 1 41 78
	i 9.118 75.500 0.001 1 49 127
	i 7.062 75.500 0.001 1 39 127
	i -11.100 75.509 0
	i 9.119 75.561 0.001 1 49 127
	i 8.497 75.624 0.001 1 49 127
	i 9.120 75.624 0.001 1 49 127
	i 9.121 75.687 0.001 1 49 127
	i 9.122 75.749 0.001 1 49 127
	i 6.026 75.749 0.001 1 37 127
	i 8.498 75.749 0.001 1 49 127
	i 5.026 75.749 0.001 1 37 127
	i 9.123 75.812 0.001 1 49 127
	i 8.499 75.875 0.001 1 49 113
	i 9.124 75.875 0.001 1 49 127
	i 9.125 75.937 0.001 1 49 127
	i 8.500 76.000 0.001 1 49 127
	i 6.027 76.000 0.001 1 37 127
	i 9.126 76.000 0.001 1 49 127
	i -10.079 75.999 0
	i 4.065 76.000 0.001 1 37 127
	i -10.080 75.999 0
	i 5.027 76.000 0.001 1 37 127
	i 11.102 76.012 -1.000 1 38 78
	i -11.101 76.031 0
	i 9.127 76.061 0.001 1 49 127
	i 9.128 76.124 0.001 1 49 127
	i 8.501 76.124 0.001 1 49 127
	i 9.129 76.187 0.001 1 49 127
	i 8.502 76.249 0.001 1 49 127
	i 9.130 76.249 0.001 1 49 127
	i 9.131 76.312 0.001 1 49 127
	i 8.503 76.375 0.001 1 49 127
	i 9.132 76.375 0.001 1 49 127
	i 9.133 76.437 0.001 1 49 127
	i 7.063 76.500 0.001 1 39 127
	i 9.134 76.500 0.001 1 49 127
	i 8.504 76.500 0.001 1 49 127
	i 9.135 76.561 0.001 1 49 127
	i 8.505 76.624 0.001 1 49 127
	i 9.136 76.624 0.001 1 49 127
	i 9.137 76.687 0.001 1 49 127
	i 9.138 76.749 0.001 1 49 127
	i 8.506 76.749 0.001 1 49 127
	i 11.103 76.760 -1.000 1 36 86
	i -11.102 76.768 0
	i 9.139 76.812 0.001 1 49 127
	i 8.507 76.875 0.001 1 49 127
	i 9.140 76.875 0.001 1 49 127
	i 9.141 76.937 0.001 1 49 127
	i 4.066 77.000 0.001 1 37 127
	i 8.508 77.000 0.001 1 49 127
	i 9.142 77.000 0.001 1 49 127
	i 10.081 77.000 -1.000 1 72 127
	i 10.082 77.000 -1.000 1 76 127
	i 9.143 77.061 0.001 1 49 127
	i 9.144 77.124 0.001 1 49 127
	i 8.509 77.124 0.001 1 49 127
	i 9.145 77.187 0.001 1 49 127
	i 8.510 77.249 0.001 1 49 127
	i 9.146 77.249 0.001 1 49 127
	i -11.103 77.257 0
	i 11.104 77.259 -1.000 1 33 74
	i 9.147 77.312 0.001 1 49 127
	i 8.511 77.375 0.001 1 49 127
	i 9.148 77.375 0.001 1 49 127
	i 9.149 77.437 0.001 1 49 127
	i 9.150 77.500 0.001 1 49 127
	i 7.064 77.500 0.001 1 39 127
	i 8.512 77.500 0.001 1 49 127
	i 11.105 77.508 -1.000 1 36 91
	i -11.104 77.517 0
	i 9.151 77.561 0.001 1 49 127
	i 9.152 77.624 0.001 1 49 127
	i 8.513 77.624 0.001 1 49 127
	i 9.153 77.687 0.001 1 49 127
	i 9.154 77.749 0.001 1 49 127
	i 8.514 77.749 0.001 1 49 127
	i 9.155 77.812 0.001 1 49 127
	i 8.515 77.875 0.001 1 49 113
	i 9.156 77.875 0.001 1 49 127
	i 9.157 77.937 0.001 1 49 127
	i -10.081 78.000 0
	i 8.516 78.000 0.001 1 49 127
	i -10.082 78.000 0
	i 9.158 78.000 0.001 1 49 127
	i 4.067 78.000 0.001 1 37 127
	i 5.028 78.000 0.001 1 37 127
	i -11.105 78.000 0
	i 11.106 78.000 -1.000 1 38 81
	i 6.028 78.000 0.001 1 37 127
	i 9.159 78.061 0.001 1 49 127
	i 8.517 78.124 0.001 1 49 127
	i 9.160 78.124 0.001 1 49 127
	i 9.161 78.187 0.001 1 49 127
	i 8.518 78.249 0.001 1 49 127
	i 9.162 78.249 0.001 1 49 127
	i 9.163 78.312 0.001 1 49 127
	i 8.519 78.375 0.001 1 49 127
	i 9.164 78.375 0.001 1 49 127
	i 9.165 78.437 0.001 1 49 127
	i 8.520 78.500 0.001 1 49 127
	i 9.166 78.500 0.001 1 49 127
	i 7.065 78.500 0.001 1 39 127
	i 9.167 78.561 0.001 1 49 127
	i 9.168 78.624 0.001 1 49 127
	i 8.521 78.624 0.001 1 49 127
	i 9.169 78.687 0.001 1 49 127
	i 11.107 78.737 -1.000 1 41 89
	i -11.106 78.744 0
	i 8.522 78.749 0.001 1 49 127
	i 9.170 78.749 0.001 1 49 127
	i 9.171 78.812 0.001 1 49 127
	i 8.523 78.875 0.001 1 49 127
	i 9.172 78.875 0.001 1 49 127
	i 9.173 78.937 0.001 1 49 127
	i 9.174 79.000 0.001 1 49 127
	i 8.524 79.000 0.001 1 49 127
	i 10.083 79.000 -1.000 1 72 127
	i 10.084 79.000 -1.000 1 76 127
	i 4.068 79.000 0.001 1 37 127
	i 9.175 79.061 0.001 1 49 127
	i 8.525 79.124 0.001 1 49 127
	i 9.176 79.124 0.001 1 49 127
	i 9.177 79.187 0.001 1 49 127
	i 8.526 79.249 0.001 1 49 127
	i 9.178 79.249 0.001 1 49 127
	i 11.108 79.255 -1.000 1 38 68
	i -11.107 79.260 0
	i 9.179 79.312 0.001 1 49 127
	i 9.180 79.375 0.001 1 49 127
	i 8.527 79.375 0.001 1 49 127
	i 9.181 79.437 0.001 1 49 127
	i 11.109 79.501 -1.000 1 41 78
	i 7.066 79.500 0.001 1 39 127
	i 8.528 79.500 0.001 1 49 127
	i 9.182 79.500 0.001 1 49 127
	i -11.108 79.509 0
	i 9.183 79.561 0.001 1 49 127
	i 8.529 79.624 0.001 1 49 127
	i 9.184 79.624 0.001 1 49 127
	i 9.185 79.687 0.001 1 49 127
	i 9.186 79.749 0.001 1 49 127
	i 5.029 79.749 0.001 1 37 127
	i 6.029 79.749 0.001 1 37 127
	i 8.530 79.749 0.001 1 49 127
	i 9.187 79.812 0.001 1 49 127
	i 8.531 79.875 0.001 1 49 113
	i 9.188 79.875 0.001 1 49 127
	i 9.189 79.937 0.001 1 49 127
	i 6.030 80.000 0.001 1 37 127
	i 5.030 80.000 0.001 1 37 127
	i 8.532 80.000 0.001 1 49 127
	i -10.083 79.999 0
	i -10.084 79.999 0
	i 4.069 80.000 0.001 1 37 127
	i 9.190 80.000 0.001 1 49 127
	i 11.110 80.012 -1.000 1 38 78
	i -11.109 80.031 0
	i 9.191 80.061 0.001 1 49 127
	i 9.192 80.124 0.001 1 49 127
	i 8.533 80.124 0.001 1 49 127
	i 9.193 80.187 0.001 1 49 127
	i 8.534 80.249 0.001 1 49 127
	i 9.194 80.249 0.001 1 49 127
	i 9.195 80.312 0.001 1 49 127
	i 8.535 80.375 0.001 1 49 127
	i 9.196 80.375 0.001 1 49 127
	i 9.197 80.437 0.001 1 49 127
	i 8.536 80.500 0.001 1 49 127
	i 9.198 80.500 0.001 1 49 127
	i 7.067 80.500 0.001 1 39 127
	i 9.199 80.561 0.001 1 49 127
	i 9.200 80.624 0.001 1 49 127
	i 8.537 80.624 0.001 1 49 127
	i 9.201 80.687 0.001 1 49 127
	i 8.538 80.749 0.001 1 49 127
	i 9.202 80.749 0.001 1 49 127
	i 11.111 80.760 -1.000 1 36 86
	i -11.110 80.768 0
	i 9.203 80.812 0.001 1 49 127
	i 8.539 80.875 0.001 1 49 127
	i 9.204 80.875 0.001 1 49 127
	i 9.205 80.937 0.001 1 49 127
	i 4.070 81.000 0.001 1 37 127
	i 8.540 81.000 0.001 1 49 127
	i 9.206 81.000 0.001 1 49 127
	i 10.085 81.000 -1.000 1 72 127
	i 10.086 81.000 -1.000 1 76 127
	i 9.207 81.061 0.001 1 49 127
	i 9.208 81.124 0.001 1 49 127
	i 8.541 81.124 0.001 1 49 127
	i 9.209 81.187 0.001 1 49 127
	i 9.210 81.249 0.001 1 49 127
	i 8.542 81.249 0.001 1 49 127
	i -11.111 81.257 0
	i 11.112 81.259 -1.000 1 33 74
	i 9.211 81.312 0.001 1 49 127
	i 8.543 81.375 0.001 1 49 127
	i 9.212 81.375 0.001 1 49 127
	i 9.213 81.437 0.001 1 49 127
	i 7.068 81.500 0.001 1 39 127
	i 8.544 81.500 0.001 1 49 127
	i 9.214 81.500 0.001 1 49 127
	i 11.113 81.508 -1.000 1 36 91
	i -11.112 81.517 0
	i 9.215 81.561 0.001 1 49 127
	i 9.216 81.624 0.001 1 49 127
	i 8.545 81.624 0.001 1 49 127
	i 9.217 81.687 0.001 1 49 127
	i 9.218 81.749 0.001 1 49 127
	i 8.546 81.749 0.001 1 49 127
	i 9.219 81.812 0.001 1 49 127
	i 8.547 81.875 0.001 1 49 113
	i 9.220 81.875 0.001 1 49 127
	i 9.221 81.937 0.001 1 49 127
	i 8.548 82.000 0.001 1 49 127
	i 5.031 82.000 0.001 1 37 127
	i 4.071 82.000 0.001 1 37 127
	i 9.222 82.000 0.001 1 49 127
	i -10.085 82.000 0
	i -10.086 82.000 0
	i -11.113 82.000 0
	i 6.031 82.000 0.001 1 37 127
	i 11.114 82.000 -1.000 1 38 81
	i 9.223 82.061 0.001 1 49 127
	i 8.549 82.124 0.001 1 49 127
	i 9.224 82.124 0.001 1 49 127
	i 9.225 82.187 0.001 1 49 127
	i 9.226 82.249 0.001 1 49 127
	i 8.550 82.249 0.001 1 49 127
	i 9.227 82.312 0.001 1 49 127
	i 8.551 82.375 0.001 1 49 127
	i 9.228 82.375 0.001 1 49 127
	i 9.229 82.437 0.001 1 49 127
	i 7.069 82.500 0.001 1 39 127
	i 9.230 82.500 0.001 1 49 127
	i 8.552 82.500 0.001 1 49 127
	i 9.231 82.561 0.001 1 49 127
	i 8.553 82.624 0.001 1 49 127
	i 9.232 82.624 0.001 1 49 127
	i 9.233 82.687 0.001 1 49 127
	i 11.115 82.737 -1.000 1 41 89
	i -11.114 82.744 0
	i 9.234 82.749 0.001 1 49 127
	i 8.554 82.749 0.001 1 49 127
	i 9.235 82.812 0.001 1 49 127
	i 8.555 82.875 0.001 1 49 127
	i 9.236 82.875 0.001 1 49 127
	i 9.237 82.937 0.001 1 49 127
	i 4.072 83.000 0.001 1 37 127
	i 8.556 83.000 0.001 1 49 127
	i 9.238 83.000 0.001 1 49 127
	i 10.087 83.000 -1.000 1 72 127
	i 10.088 83.000 -1.000 1 76 127
	i 9.239 83.061 0.001 1 49 127
	i 8.557 83.124 0.001 1 49 127
	i 9.240 83.124 0.001 1 49 127
	i 9.241 83.187 0.001 1 49 127
	i 8.558 83.249 0.001 1 49 127
	i 9.242 83.249 0.001 1 49 127
	i 11.116 83.255 -1.000 1 38 68
	i -11.115 83.260 0
	i 9.243 83.312 0.001 1 49 127
	i 8.559 83.375 0.001 1 49 127
	i 9.244 83.375 0.001 1 49 127
	i 9.245 83.437 0.001 1 49 127
	i 7.070 83.500 0.001 1 39 127
	i 9.246 83.500 0.001 1 49 127
	i 11.117 83.501 -1.000 1 41 78
	i 8.560 83.500 0.001 1 49 127
	i -11.116 83.509 0
	i 9.247 83.561 0.001 1 49 127
	i 8.561 83.624 0.001 1 49 127
	i 9.248 83.624 0.001 1 49 127
	i 9.249 83.687 0.001 1 49 127
	i 5.032 83.749 0.001 1 37 127
	i 8.562 83.749 0.001 1 49 127
	i 6.032 83.749 0.001 1 37 127
	i 9.250 83.749 0.001 1 49 127
	i 9.251 83.812 0.001 1 49 127
	i 9.252 83.875 0.001 1 49 127
	i 8.563 83.875 0.001 1 49 113
	i 9.253 83.937 0.001 1 49 127
	i -10.087 83.999 0
	i -10.088 83.999 0
	i 9.254 84.000 0.001 1 49 127
	i 4.073 84.000 0.001 1 37 127
	i 6.033 84.000 0.001 1 37 127
	i 5.033 84.000 0.001 1 37 127
	i 8.564 84.000 0.001 1 49 127
	i 11.118 84.012 -1.000 1 38 78
	i -11.117 84.031 0
	i 9.255 84.061 0.001 1 49 127
	i 8.565 84.124 0.001 1 49 127
	i 9.256 84.124 0.001 1 49 127
	i 9.257 84.187 0.001 1 49 127
	i 8.566 84.249 0.001 1 49 127
	i 9.258 84.249 0.001 1 49 127
	i 9.259 84.312 0.001 1 49 127
	i 8.567 84.375 0.001 1 49 127
	i 9.260 84.375 0.001 1 49 127
	i 9.261 84.437 0.001 1 49 127
	i 7.071 84.500 0.001 1 39 127
	i 9.262 84.500 0.001 1 49 127
	i 8.568 84.500 0.001 1 49 127
	i 9.263 84.561 0.001 1 49 127
	i 8.569 84.624 0.001 1 49 127
	i 9.264 84.624 0.001 1 49 127
	i 9.265 84.687 0.001 1 49 127
	i 9.266 84.749 0.001 1 49 127
	i 8.570 84.749 0.001 1 49 127
	i 11.119 84.760 -1.000 1 36 86
	i -11.118 84.768 0
	i 9.267 84.812 0.001 1 49 127
	i 8.571 84.875 0.001 1 49 127
	i 9.268 84.875 0.001 1 49 127
	i 9.269 84.937 0.001 1 49 127
	i 4.074 85.000 0.001 1 37 127
	i 8.572 85.000 0.001 1 49 127
	i 9.270 85.000 0.001 1 49 127
	i 10.089 85.000 -1.000 1 72 127
	i 10.090 85.000 -1.000 1 76 127
	i 9.271 85.061 0.001 1 49 127
	i 8.573 85.124 0.001 1 49 127
	i 9.272 85.124 0.001 1 49 127
	i 9.273 85.187 0.001 1 49 127
	i 8.574 85.249 0.001 1 49 127
	i 9.274 85.249 0.001 1 49 127
	i -11.119 85.257 0
	i 11.120 85.259 -1.000 1 33 74
	i 9.275 85.312 0.001 1 49 127
	i 9.276 85.375 0.001 1 49 127
	i 8.575 85.375 0.001 1 49 127
	i 9.277 85.437 0.001 1 49 127
	i 7.072 85.500 0.001 1 39 127
	i 9.278 85.500 0.001 1 49 127
	i 8.576 85.500 0.001 1 49 127
	i 11.121 85.508 -1.000 1 36 91
	i -11.120 85.517 0
	i 9.279 85.561 0.001 1 49 127
	i 9.280 85.624 0.001 1 49 127
	i 8.577 85.624 0.001 1 49 127
	i 9.281 85.687 0.001 1 49 127
	i 9.282 85.749 0.001 1 49 127
	i 8.578 85.749 0.001 1 49 127
	i 9.283 85.812 0.001 1 49 127
	i 9.284 85.875 0.001 1 49 127
	i 8.579 85.875 0.001 1 49 113
	i 9.285 85.937 0.001 1 49 127
	i -10.089 86.000 0
	i -11.121 85.999 0
	i 9.286 86.000 0.001 1 49 127
	i -10.090 86.000 0
	i 8.580 86.000 0.001 1 49 127
	i 11.122 86.000 -1.000 1 38 83
	i 4.075 86.000 0.001 1 37 127
	i 5.034 86.000 0.001 1 37 127
	i 6.034 86.000 0.001 1 37 127
	i 9.287 86.061 0.001 1 49 127
	i 9.288 86.124 0.001 1 49 127
	i 8.581 86.124 0.001 1 49 127
	i 9.289 86.187 0.001 1 49 127
	i 8.582 86.249 0.001 1 49 127
	i 9.290 86.249 0.001 1 49 127
	i 9.291 86.312 0.001 1 49 127
	i 9.292 86.375 0.001 1 49 127
	i 8.583 86.375 0.001 1 49 127
	i 9.293 86.437 0.001 1 49 127
	i 9.294 86.500 0.001 1 49 127
	i 7.073 86.500 0.001 1 39 127
	i 8.584 86.500 0.001 1 49 127
	i 9.295 86.561 0.001 1 49 127
	i 8.585 86.624 0.001 1 49 127
	i 9.296 86.624 0.001 1 49 127
	i 9.297 86.687 0.001 1 49 127
	i 11.123 86.737 -1.000 1 41 103
	i -11.122 86.756 0
	i 8.586 86.749 0.001 1 49 127
	i 9.298 86.749 0.001 1 49 127
	i 9.299 86.812 0.001 1 49 127
	i 8.587 86.875 0.001 1 49 127
	i 9.300 86.875 0.001 1 49 127
	i 9.301 86.937 0.001 1 49 127
	i 8.588 87.000 0.001 1 49 127
	i 4.076 87.000 0.001 1 37 127
	i 9.302 87.000 0.001 1 49 127
	i 10.091 87.000 -1.000 1 72 127
	i 10.092 87.000 -1.000 1 76 127
	i 9.303 87.061 0.001 1 49 127
	i 9.304 87.124 0.001 1 49 127
	i 8.589 87.124 0.001 1 49 127
	i 9.305 87.187 0.001 1 49 127
	i 11.124 87.223 -1.000 1 44 76
	i -11.123 87.235 0
	i 8.590 87.249 0.001 1 49 127
	i 9.306 87.249 0.001 1 49 127
	i 9.307 87.312 0.001 1 49 127
	i 9.308 87.375 0.001 1 49 127
	i 8.591 87.375 0.001 1 49 127
	i 9.309 87.437 0.001 1 49 127
	i 9.310 87.500 0.001 1 49 127
	i 8.592 87.500 0.001 1 49 127
	i 7.074 87.500 0.001 1 39 127
	i -11.124 87.523 0
	i 11.125 87.523 -1.000 1 43 89
	i 9.311 87.561 0.001 1 49 127
	i 9.312 87.624 0.001 1 49 127
	i 8.593 87.624 0.001 1 49 127
	i 9.313 87.687 0.001 1 49 127
	i 6.035 87.749 0.001 1 37 127
	i 5.035 87.749 0.001 1 37 127
	i 8.594 87.749 0.001 1 49 127
	i 9.314 87.749 0.001 1 49 127
	i 9.315 87.812 0.001 1 49 127
	i 8.595 87.875 0.001 1 49 113
	i 9.316 87.875 0.001 1 49 127
	i 9.317 87.937 0.001 1 49 127
	i 4.077 88.000 0.001 1 37 127
	i -11.125 87.997 0
	i 11.126 87.997 -1.000 1 41 97
	i 5.036 88.000 0.001 1 37 127
	i 6.036 88.000 0.001 1 37 127
	i 8.596 88.000 0.001 1 49 127
	i 9.318 88.000 0.001 1 49 127
	i -10.091 87.999 0
	i -10.092 87.999 0
	i 9.319 88.061 0.001 1 49 127
	i 8.597 88.124 0.001 1 49 127
	i 9.320 88.124 0.001 1 49 127
	i 9.321 88.187 0.001 1 49 127
	i 8.598 88.249 0.001 1 49 127
	i 9.322 88.249 0.001 1 49 127
	i 9.323 88.312 0.001 1 49 127
	i 9.324 88.375 0.001 1 49 127
	i 8.599 88.375 0.001 1 49 127
	i 9.325 88.437 0.001 1 49 127
	i 8.600 88.500 0.001 1 49 127
	i 7.075 88.500 0.001 1 39 127
	i 9.326 88.500 0.001 1 49 127
	i 9.327 88.561 0.001 1 49 127
	i 8.601 88.624 0.001 1 49 127
	i 9.328 88.624 0.001 1 49 127
	i 9.329 88.687 0.001 1 49 127
	i 8.602 88.749 0.001 1 49 127
	i 9.330 88.749 0.001 1 49 127
	i -11.126 88.756 0
	i 11.127 88.759 -1.000 1 38 80
	i 9.331 88.812 0.001 1 49 127
	i 8.603 88.875 0.001 1 49 127
	i 9.332 88.875 0.001 1 49 127
	i 9.333 88.937 0.001 1 49 127
	i 4.078 89.000 0.001 1 37 127
	i 9.334 89.000 0.001 1 49 127
	i 10.093 89.000 -1.000 1 72 127
	i 10.094 89.000 -1.000 1 76 127
	i 8.604 89.000 0.001 1 49 127
	i 9.335 89.061 0.001 1 49 127
	i 9.336 89.124 0.001 1 49 127
	i 8.605 89.124 0.001 1 49 127
	i 9.337 89.187 0.001 1 49 127
	i 11.128 89.205 -1.000 1 33 79
	i -11.127 89.229 0
	i 9.338 89.249 0.001 1 49 127
	i 8.606 89.249 0.001 1 49 127
	i 9.339 89.312 0.001 1 49 127
	i 9.340 89.375 0.001 1 49 127
	i 8.607 89.375 0.001 1 49 127
	i 9.341 89.437 0.001 1 49 127
	i 7.076 89.500 0.001 1 39 127
	i 9.342 89.500 0.001 1 49 127
	i 8.608 89.500 0.001 1 49 127
	i 11.129 89.507 -1.000 1 36 89
	i -11.128 89.508 0
	i 9.343 89.561 0.001 1 49 127
	i 8.609 89.624 0.001 1 49 127
	i 9.344 89.624 0.001 1 49 127
	i 9.345 89.687 0.001 1 49 127
	i 8.610 89.749 0.001 1 49 127
	i 9.346 89.749 0.001 1 49 127
	i 9.347 89.812 0.001 1 49 127
	i 9.348 89.875 0.001 1 49 127
	i 8.611 89.875 0.001 1 49 113
	i 9.349 89.937 0.001 1 49 127
	i -10.093 90.000 0
	i -10.094 90.000 0
	i 4.079 90.000 0.001 1 37 127
	i 6.037 90.000 0.001 1 37 127
	i 5.037 90.000 0.001 1 37 127
	i -11.129 89.999 0
	i 11.130 90.000 -1.000 1 38 81
	i 8.612 90.000 0.001 1 49 127
	i 9.350 90.000 0.001 1 49 127
	i 9.351 90.061 0.001 1 49 127
	i 8.613 90.124 0.001 1 49 127
	i 9.352 90.124 0.001 1 49 127
	i 9.353 90.187 0.001 1 49 127
	i 9.354 90.249 0.001 1 49 127
	i 8.614 90.249 0.001 1 49 127
	i 9.355 90.312 0.001 1 49 127
	i 9.356 90.375 0.001 1 49 127
	i 8.615 90.375 0.001 1 49 127
	i 9.357 90.437 0.001 1 49 127
	i 7.077 90.500 0.001 1 39 127
	i 9.358 90.500 0.001 1 49 127
	i 8.616 90.500 0.001 1 49 127
	i 9.359 90.561 0.001 1 49 127
	i 8.617 90.624 0.001 1 49 127
	i 9.360 90.624 0.001 1 49 127
	i 9.361 90.687 0.001 1 49 127
	i 11.131 90.737 -1.000 1 41 89
	i -11.130 90.744 0
	i 8.618 90.749 0.001 1 49 127
	i 9.362 90.749 0.001 1 49 127
	i 9.363 90.812 0.001 1 49 127
	i 9.364 90.875 0.001 1 49 127
	i 8.619 90.875 0.001 1 49 127
	i 9.365 90.937 0.001 1 49 127
	i 8.620 91.000 0.001 1 49 127
	i 9.366 91.000 0.001 1 49 127
	i 10.095 91.000 -1.000 1 72 127
	i 10.096 91.000 -1.000 1 76 127
	i 4.080 91.000 0.001 1 37 127
	i 9.367 91.061 0.001 1 49 127
	i 8.621 91.124 0.001 1 49 127
	i 9.368 91.124 0.001 1 49 127
	i 9.369 91.187 0.001 1 49 127
	i 9.370 91.249 0.001 1 49 127
	i 8.622 91.249 0.001 1 49 127
	i 11.132 91.255 -1.000 1 38 68
	i -11.131 91.260 0
	i 9.371 91.312 0.001 1 49 127
	i 9.372 91.375 0.001 1 49 127
	i 8.623 91.375 0.001 1 49 127
	i 9.373 91.437 0.001 1 49 127
	i 7.078 91.500 0.001 1 39 127
	i 11.133 91.501 -1.000 1 41 78
	i 8.624 91.500 0.001 1 49 127
	i 9.374 91.500 0.001 1 49 127
	i -11.132 91.509 0
	i 9.375 91.561 0.001 1 49 127
	i 8.625 91.624 0.001 1 49 127
	i 9.376 91.624 0.001 1 49 127
	i 9.377 91.687 0.001 1 49 127
	i 8.626 91.749 0.001 1 49 127
	i 5.038 91.749 0.001 1 37 127
	i 6.038 91.749 0.001 1 37 127
	i 9.378 91.749 0.001 1 49 127
	i 9.379 91.812 0.001 1 49 127
	i 8.627 91.875 0.001 1 49 113
	i 9.380 91.875 0.001 1 49 127
	i 9.381 91.937 0.001 1 49 127
	i 6.039 92.000 0.001 1 37 127
	i 8.628 92.000 0.001 1 49 127
	i 9.382 92.000 0.001 1 49 127
	i -10.095 91.999 0
	i -10.096 91.999 0
	i 5.039 92.000 0.001 1 37 127
	i 4.081 92.000 0.001 1 37 127
	i 11.134 92.012 -1.000 1 38 78
	i -11.133 92.031 0
	i 9.383 92.061 0.001 1 49 127
	i 8.629 92.124 0.001 1 49 127
	i 9.384 92.124 0.001 1 49 127
	i 9.385 92.187 0.001 1 49 127
	i 8.630 92.249 0.001 1 49 127
	i 9.386 92.249 0.001 1 49 127
	i 9.387 92.312 0.001 1 49 127
	i 8.631 92.375 0.001 1 49 127
	i 9.388 92.375 0.001 1 49 127
	i 9.389 92.437 0.001 1 49 127
	i 9.390 92.500 0.001 1 49 127
	i 8.632 92.500 0.001 1 49 127
	i 7.079 92.500 0.001 1 39 127
	i 9.391 92.561 0.001 1 49 127
	i 8.633 92.624 0.001 1 49 127
	i 9.392 92.624 0.001 1 49 127
	i 9.393 92.687 0.001 1 49 127
	i 9.394 92.749 0.001 1 49 127
	i 8.634 92.749 0.001 1 49 127
	i 11.135 92.760 -1.000 1 36 86
	i -11.134 92.768 0
	i 9.395 92.812 0.001 1 49 127
	i 8.635 92.875 0.001 1 49 127
	i 9.396 92.875 0.001 1 49 127
	i 9.397 92.937 0.001 1 49 127
	i 4.082 93.000 0.001 1 37 127
	i 9.398 93.000 0.001 1 49 127
	i 8.636 93.000 0.001 1 49 127
	i 10.097 93.000 -1.000 1 72 127
	i 10.098 93.000 -1.000 1 76 127
	i 9.399 93.061 0.001 1 49 127
	i 9.400 93.124 0.001 1 49 127
	i 8.637 93.124 0.001 1 49 127
	i 9.401 93.187 0.001 1 49 127
	i 9.402 93.249 0.001 1 49 127
	i 8.638 93.249 0.001 1 49 127
	i -11.135 93.257 0
	i 11.136 93.259 -1.000 1 33 74
	i 9.403 93.312 0.001 1 49 127
	i 8.639 93.375 0.001 1 49 127
	i 9.404 93.375 0.001 1 49 127
	i 9.405 93.437 0.001 1 49 127
	i 7.080 93.500 0.001 1 39 127
	i 8.640 93.500 0.001 1 49 127
	i 9.406 93.500 0.001 1 49 127
	i 11.137 93.508 -1.000 1 36 91
	i -11.136 93.517 0
	i 9.407 93.561 0.001 1 49 127
	i 9.408 93.624 0.001 1 49 127
	i 8.641 93.624 0.001 1 49 127
	i 9.409 93.687 0.001 1 49 127
	i 9.410 93.749 0.001 1 49 127
	i 8.642 93.749 0.001 1 49 127
	i 9.411 93.812 0.001 1 49 127
	i 8.643 93.875 0.001 1 49 113
	i 9.412 93.875 0.001 1 49 127
	i 9.413 93.937 0.001 1 49 127
	i -10.097 94.000 0
	i 4.083 94.000 0.001 1 37 127
	i 5.040 94.000 0.001 1 37 127
	i -11.137 94.000 0
	i 11.138 94.000 -1.000 1 38 81
	i 6.040 94.000 0.001 1 37 127
	i -10.098 94.000 0
	i 8.644 94.000 0.001 1 49 127
	i 9.414 94.000 0.001 1 49 127
	i 9.415 94.061 0.001 1 49 127
	i 9.416 94.124 0.001 1 49 127
	i 8.645 94.124 0.001 1 49 127
	i 9.417 94.187 0.001 1 49 127
	i 8.646 94.249 0.001 1 49 127
	i 9.418 94.249 0.001 1 49 127
	i 9.419 94.312 0.001 1 49 127
	i 9.420 94.375 0.001 1 49 127
	i 8.647 94.375 0.001 1 49 127
	i 9.421 94.437 0.001 1 49 127
	i 9.422 94.500 0.001 1 49 127
	i 7.081 94.500 0.001 1 39 127
	i 8.648 94.500 0.001 1 49 127
	i 9.423 94.561 0.001 1 49 127
	i 9.424 94.624 0.001 1 49 127
	i 8.649 94.624 0.001 1 49 127
	i 9.425 94.687 0.001 1 49 127
	i 11.139 94.737 -1.000 1 41 89
	i -11.138 94.744 0
	i 8.650 94.749 0.001 1 49 127
	i 9.426 94.749 0.001 1 49 127
	i 9.427 94.812 0.001 1 49 127
	i 9.428 94.875 0.001 1 49 127
	i 8.651 94.875 0.001 1 49 127
	i 9.429 94.937 0.001 1 49 127
	i 4.084 95.000 0.001 1 37 127
	i 9.430 95.000 0.001 1 49 127
	i 8.652 95.000 0.001 1 49 127
	i 10.099 95.000 -1.000 1 72 127
	i 10.100 95.000 -1.000 1 76 127
	i 9.431 95.061 0.001 1 49 127
	i 9.432 95.124 0.001 1 49 127
	i 8.653 95.124 0.001 1 49 127
	i 9.433 95.187 0.001 1 49 127
	i 8.654 95.249 0.001 1 49 127
	i 9.434 95.249 0.001 1 49 127
	i 11.140 95.255 -1.000 1 38 68
	i -11.139 95.260 0
	i 9.435 95.312 0.001 1 49 127
	i 9.436 95.375 0.001 1 49 127
	i 8.655 95.375 0.001 1 49 127
	i 9.437 95.437 0.001 1 49 127
	i 11.141 95.501 -1.000 1 41 78
	i 7.082 95.500 0.001 1 39 127
	i 8.656 95.500 0.001 1 49 127
	i 9.438 95.500 0.001 1 49 127
	i -11.140 95.509 0
	i 9.439 95.561 0.001 1 49 127
	i 9.440 95.624 0.001 1 49 127
	i 8.657 95.624 0.001 1 49 127
	i 9.441 95.687 0.001 1 49 127
	i 5.041 95.749 0.001 1 37 127
	i 9.442 95.749 0.001 1 49 127
	i 6.041 95.749 0.001 1 37 127
	i 8.658 95.749 0.001 1 49 127
	i 9.443 95.812 0.001 1 49 127
	i 8.659 95.875 0.001 1 49 113
	i 9.444 95.875 0.001 1 49 127
	i 9.445 95.937 0.001 1 49 127
	i 4.085 96.000 0.001 1 37 127
	i 6.042 96.000 0.001 1 37 127
	i 5.042 96.000 0.001 1 37 127
	i -10.099 95.999 0
	i 9.446 96.000 0.001 1 49 127
	i -10.100 95.999 0
	i 8.660 96.000 0.001 1 49 127
	i 11.142 96.012 -1.000 1 38 78
	i -11.141 96.031 0
	i 9.447 96.061 0.001 1 49 127
	i 9.448 96.124 0.001 1 49 127
	i 8.661 96.124 0.001 1 49 127
	i 9.449 96.187 0.001 1 49 127
	i 9.450 96.249 0.001 1 49 127
	i 8.662 96.249 0.001 1 49 127
	i 9.451 96.312 0.001 1 49 127
	i 9.452 96.375 0.001 1 49 127
	i 8.663 96.375 0.001 1 49 127
	i 9.453 96.437 0.001 1 49 127
	i 7.083 96.500 0.001 1 39 127
	i 9.454 96.500 0.001 1 49 127
	i 8.664 96.500 0.001 1 49 127
	i 9.455 96.561 0.001 1 49 127
	i 8.665 96.624 0.001 1 49 127
	i 9.456 96.624 0.001 1 49 127
	i 9.457 96.687 0.001 1 49 127
	i 9.458 96.749 0.001 1 49 127
	i 8.666 96.749 0.001 1 49 127
	i 11.143 96.760 -1.000 1 36 86
	i -11.142 96.768 0
	i 9.459 96.812 0.001 1 49 127
	i 8.667 96.875 0.001 1 49 127
	i 9.460 96.875 0.001 1 49 127
	i 9.461 96.937 0.001 1 49 127
	i 10.101 97.000 -1.000 1 72 127
	i 9.462 97.000 0.001 1 49 127
	i 10.102 97.000 -1.000 1 76 127
	i 8.668 97.000 0.001 1 49 127
	i 4.086 97.000 0.001 1 37 127
	i 9.463 97.061 0.001 1 49 127
	i 9.464 97.124 0.001 1 49 127
	i 8.669 97.124 0.001 1 49 127
	i 9.465 97.187 0.001 1 49 127
	i 9.466 97.249 0.001 1 49 127
	i 8.670 97.249 0.001 1 49 127
	i -11.143 97.257 0
	i 11.144 97.259 -1.000 1 33 74
	i 9.467 97.312 0.001 1 49 127
	i 8.671 97.375 0.001 1 49 127
	i 9.468 97.375 0.001 1 49 127
	i 9.469 97.437 0.001 1 49 127
	i 9.470 97.500 0.001 1 49 127
	i 8.672 97.500 0.001 1 49 127
	i 7.084 97.500 0.001 1 39 127
	i 11.145 97.508 -1.000 1 36 91
	i -11.144 97.517 0
	i 9.471 97.561 0.001 1 49 127
	i 9.472 97.624 0.001 1 49 127
	i 8.673 97.624 0.001 1 49 127
	i 9.473 97.687 0.001 1 49 127
	i 9.474 97.749 0.001 1 49 127
	i 8.674 97.749 0.001 1 49 127
	i 9.475 97.812 0.001 1 49 127
	i 9.476 97.875 0.001 1 49 127
	i 8.675 97.875 0.001 1 49 113
	i 9.477 97.937 0.001 1 49 127
	i 4.087 98.000 0.001 1 37 127
	i -11.145 98.000 0
	i 11.146 98.000 -1.000 1 38 81
	i 5.043 98.000 0.001 1 37 127
	i 8.676 98.000 0.001 1 49 127
	i 6.043 98.000 0.001 1 37 127
	i 9.478 98.000 0.001 1 49 127
	i -10.101 98.000 0
	i -10.102 98.000 0
	i 9.479 98.061 0.001 1 49 127
	i 8.677 98.124 0.001 1 49 127
	i 9.480 98.124 0.001 1 49 127
	i 9.481 98.187 0.001 1 49 127
	i 8.678 98.249 0.001 1 49 127
	i 9.482 98.249 0.001 1 49 127
	i 9.483 98.312 0.001 1 49 127
	i 8.679 98.375 0.001 1 49 127
	i 9.484 98.375 0.001 1 49 127
	i 9.485 98.437 0.001 1 49 127
	i 9.486 98.500 0.001 1 49 127
	i 7.085 98.500 0.001 1 39 127
	i 8.680 98.500 0.001 1 49 127
	i 9.487 98.561 0.001 1 49 127
	i 9.488 98.624 0.001 1 49 127
	i 8.681 98.624 0.001 1 49 127
	i 9.489 98.687 0.001 1 49 127
	i 11.147 98.737 -1.000 1 41 89
	i -11.146 98.744 0
	i 8.682 98.749 0.001 1 49 127
	i 9.490 98.749 0.001 1 49 127
	i 9.491 98.812 0.001 1 49 127
	i 8.683 98.875 0.001 1 49 127
	i 9.492 98.875 0.001 1 49 127
	i 9.493 98.937 0.001 1 49 127
	i 10.103 99.000 -1.000 1 72 127
	i 9.494 99.000 0.001 1 49 127
	i 8.684 99.000 0.001 1 49 127
	i 10.104 99.000 -1.000 1 76 127
	i 4.088 99.000 0.001 1 37 127
	i 9.495 99.061 0.001 1 49 127
	i 9.496 99.124 0.001 1 49 127
	i 8.685 99.124 0.001 1 49 127
	i 9.497 99.187 0.001 1 49 127
	i 8.686 99.249 0.001 1 49 127
	i 9.498 99.249 0.001 1 49 127
	i 11.148 99.255 -1.000 1 38 68
	i -11.147 99.260 0
	i 9.499 99.312 0.001 1 49 127
	i 9.500 99.375 0.001 1 49 127
	i 8.687 99.375 0.001 1 49 127
	i 9.501 99.437 0.001 1 49 127
	i 9.502 99.500 0.001 1 49 127
	i 8.688 99.500 0.001 1 49 127
	i 7.086 99.500 0.001 1 39 127
	i 11.149 99.501 -1.000 1 41 78
	i -11.148 99.509 0
	i 9.503 99.561 0.001 1 49 127
	i 8.689 99.624 0.001 1 49 127
	i 9.504 99.624 0.001 1 49 127
	i 9.505 99.687 0.001 1 49 127
	i 6.044 99.749 0.001 1 37 127
	i 8.690 99.749 0.001 1 49 127
	i 5.044 99.749 0.001 1 37 127
	i 9.506 99.749 0.001 1 49 127
	i 9.507 99.812 0.001 1 49 127
	i 9.508 99.875 0.001 1 49 127
	i 8.691 99.875 0.001 1 49 113
	i 9.509 99.937 0.001 1 49 127
	i -10.103 99.999 0
	i 8.692 100.000 0.001 1 49 127
	i 9.510 100.000 0.001 1 49 127
	i -10.104 99.999 0
	i 4.089 100.000 0.001 1 37 127
	i 6.045 100.000 0.001 1 37 127
	i 5.045 100.000 0.001 1 37 127
	i 11.150 100.012 -1.000 1 38 78
	i -11.149 100.031 0
	i 9.511 100.061 0.001 1 49 127
	i 9.512 100.124 0.001 1 49 127
	i 8.693 100.124 0.001 1 49 127
	i 9.513 100.187 0.001 1 49 127
	i 8.694 100.249 0.001 1 49 127
	i 9.514 100.249 0.001 1 49 127
	i 9.515 100.312 0.001 1 49 127
	i 8.695 100.375 0.001 1 49 127
	i 9.516 100.375 0.001 1 49 127
	i 9.517 100.437 0.001 1 49 127
	i 9.518 100.500 0.001 1 49 127
	i 8.696 100.500 0.001 1 49 127
	i 7.087 100.500 0.001 1 39 127
	i 9.519 100.561 0.001 1 49 127
	i 9.520 100.624 0.001 1 49 127
	i 8.697 100.624 0.001 1 49 127
	i 9.521 100.687 0.001 1 49 127
	i 9.522 100.749 0.001 1 49 127
	i 8.698 100.749 0.001 1 49 127
	i 11.151 100.760 -1.000 1 36 86
	i -11.150 100.768 0
	i 9.523 100.812 0.001 1 49 127
	i 8.699 100.875 0.001 1 49 127
	i 9.524 100.875 0.001 1 49 127
	i 9.525 100.937 0.001 1 49 127
	i 9.526 101.000 0.001 1 49 127
	i 8.700 101.000 0.001 1 49 127
	i 10.105 101.000 -1.000 1 72 127
	i 10.106 101.000 -1.000 1 76 127
	i 4.090 101.000 0.001 1 37 127
	i 9.527 101.061 0.001 1 49 127
	i 9.528 101.124 0.001 1 49 127
	i 8.701 101.124 0.001 1 49 127
	i 9.529 101.187 0.001 1 49 127
	i 9.530 101.249 0.001 1 49 127
	i 8.702 101.249 0.001 1 49 127
	i -11.151 101.257 0
	i 11.152 101.259 -1.000 1 33 74
	i 9.531 101.312 0.001 1 49 127
	i 9.532 101.375 0.001 1 49 127
	i 8.703 101.375 0.001 1 49 127
	i 9.533 101.437 0.001 1 49 127
	i 8.704 101.500 0.001 1 49 127
	i 7.088 101.500 0.001 1 39 127
	i 9.534 101.500 0.001 1 49 127
	i 11.153 101.508 -1.000 1 36 91
	i -11.152 101.517 0
	i 9.535 101.561 0.001 1 49 127
	i 8.705 101.624 0.001 1 49 127
	i 9.536 101.624 0.001 1 49 127
	i 9.537 101.687 0.001 1 49 127
	i 9.538 101.749 0.001 1 49 127
	i 8.706 101.749 0.001 1 49 127
	i 9.539 101.812 0.001 1 49 127
	i 8.707 101.875 0.001 1 49 113
	i 9.540 101.875 0.001 1 49 127
	i 9.541 101.937 0.001 1 49 127
	i 9.542 102.000 0.001 1 49 127
	i 6.046 102.000 0.001 1 37 127
	i -11.153 101.999 0
	i 11.154 102.000 -1.000 1 38 83
	i 4.091 102.000 0.001 1 37 127
	i 8.708 102.000 0.001 1 49 127
	i -10.105 102.000 0
	i -10.106 102.000 0
	i 5.046 102.000 0.001 1 37 127
	i 9.543 102.061 0.001 1 49 127
	i 8.709 102.124 0.001 1 49 127
	i 9.544 102.124 0.001 1 49 127
	i 9.545 102.187 0.001 1 49 127
	i 8.710 102.249 0.001 1 49 127
	i 9.546 102.249 0.001 1 49 127
	i 9.547 102.312 0.001 1 49 127
	i 9.548 102.375 0.001 1 49 127
	i 8.711 102.375 0.001 1 49 127
	i 9.549 102.437 0.001 1 49 127
	i 7.089 102.500 0.001 1 39 127
	i 8.712 102.500 0.001 1 49 127
	i 9.550 102.500 0.001 1 49 127
	i 9.551 102.561 0.001 1 49 127
	i 9.552 102.624 0.001 1 49 127
	i 8.713 102.624 0.001 1 49 127
	i 9.553 102.687 0.001 1 49 127
	i 11.155 102.737 -1.000 1 41 103
	i -11.154 102.756 0
	i 8.714 102.749 0.001 1 49 127
	i 9.554 102.749 0.001 1 49 127
	i 9.555 102.812 0.001 1 49 127
	i 9.556 102.875 0.001 1 49 127
	i 8.715 102.875 0.001 1 49 127
	i 9.557 102.937 0.001 1 49 127
	i 4.092 103.000 0.001 1 37 127
	i 8.716 103.000 0.001 1 49 127
	i 10.107 103.000 -1.000 1 72 127
	i 9.558 103.000 0.001 1 49 127
	i 10.108 103.000 -1.000 1 76 127
	i 9.559 103.061 0.001 1 49 127
	i 8.717 103.124 0.001 1 49 127
	i 9.560 103.124 0.001 1 49 127
	i 9.561 103.187 0.001 1 49 127
	i 11.156 103.223 -1.000 1 44 76
	i -11.155 103.235 0
	i 9.562 103.249 0.001 1 49 127
	i 8.718 103.249 0.001 1 49 127
	i 9.563 103.312 0.001 1 49 127
	i 8.719 103.375 0.001 1 49 127
	i 9.564 103.375 0.001 1 49 127
	i 9.565 103.437 0.001 1 49 127
	i 9.566 103.500 0.001 1 49 127
	i 8.720 103.500 0.001 1 49 127
	i 7.090 103.500 0.001 1 39 127
	i -11.156 103.523 0
	i 11.157 103.523 -1.000 1 43 89
	i 9.567 103.561 0.001 1 49 127
	i 8.721 103.624 0.001 1 49 127
	i 9.568 103.624 0.001 1 49 127
	i 9.569 103.687 0.001 1 49 127
	i 5.047 103.749 0.001 1 37 127
	i 9.570 103.749 0.001 1 49 127
	i 8.722 103.749 0.001 1 49 127
	i 6.047 103.749 0.001 1 37 127
	i 9.571 103.812 0.001 1 49 127
	i 8.723 103.875 0.001 1 49 113
	i 9.572 103.875 0.001 1 49 127
	i 9.573 103.937 0.001 1 49 127
	i 5.048 104.000 0.001 1 37 127
	i 6.048 104.000 0.001 1 37 127
	i -11.157 103.997 0
	i 11.158 103.997 -1.000 1 41 97
	i 4.093 104.000 0.001 1 37 127
	i 8.724 104.000 0.001 1 49 127
	i -10.107 103.999 0
	i 9.574 104.000 0.001 1 49 127
	i -10.108 103.999 0
	i 9.575 104.061 0.001 1 49 127
	i 8.725 104.124 0.001 1 49 127
	i 9.576 104.124 0.001 1 49 127
	i 9.577 104.187 0.001 1 49 127
	i 8.726 104.249 0.001 1 49 127
	i 9.578 104.249 0.001 1 49 127
	i 9.579 104.312 0.001 1 49 127
	i 9.580 104.375 0.001 1 49 127
	i 8.727 104.375 0.001 1 49 127
	i 9.581 104.437 0.001 1 49 127
	i 7.091 104.500 0.001 1 39 127
	i 9.582 104.500 0.001 1 49 127
	i 8.728 104.500 0.001 1 49 127
	i 9.583 104.561 0.001 1 49 127
	i 8.729 104.624 0.001 1 49 127
	i 9.584 104.624 0.001 1 49 127
	i 9.585 104.687 0.001 1 49 127
	i 9.586 104.749 0.001 1 49 127
	i 8.730 104.749 0.001 1 49 127
	i -11.158 104.756 0
	i 11.159 104.759 -1.000 1 38 80
	i 9.587 104.812 0.001 1 49 127
	i 9.588 104.875 0.001 1 49 127
	i 8.731 104.875 0.001 1 49 127
	i 9.589 104.937 0.001 1 49 127
	i 4.094 105.000 0.001 1 37 127
	i 8.732 105.000 0.001 1 49 127
	i 9.590 105.000 0.001 1 49 127
	i 10.109 105.000 -1.000 1 72 127
	i 10.110 105.000 -1.000 1 76 127
	i 9.591 105.061 0.001 1 49 127
	i 8.733 105.124 0.001 1 49 127
	i 9.592 105.124 0.001 1 49 127
	i 9.593 105.187 0.001 1 49 127
	i 11.160 105.205 -1.000 1 33 79
	i -11.159 105.229 0
	i 8.734 105.249 0.001 1 49 127
	i 9.594 105.249 0.001 1 49 127
	i 9.595 105.312 0.001 1 49 127
	i 8.735 105.375 0.001 1 49 127
	i 9.596 105.375 0.001 1 49 127
	i 9.597 105.437 0.001 1 49 127
	i 7.092 105.500 0.001 1 39 127
	i 8.736 105.500 0.001 1 49 127
	i 9.598 105.500 0.001 1 49 127
	i 11.161 105.507 -1.000 1 36 89
	i -11.160 105.508 0
	i 9.599 105.561 0.001 1 49 127
	i 9.600 105.624 0.001 1 49 127
	i 8.737 105.624 0.001 1 49 127
	i 9.601 105.687 0.001 1 49 127
	i 9.602 105.749 0.001 1 49 127
	i 8.738 105.749 0.001 1 49 127
	i 9.603 105.812 0.001 1 49 127
	i 9.604 105.875 0.001 1 49 127
	i 8.739 105.875 0.001 1 49 113
	i 9.605 105.937 0.001 1 49 127
	i 5.049 106.000 0.001 1 37 127
	i 6.049 106.000 0.001 1 37 127
	i -11.161 105.999 0
	i -10.109 106.000 0
	i 11.162 106.000 -1.000 1 38 83
	i -10.110 106.000 0
	i -11.162 106.312 0
	i 10.111 107.000 -1.000 1 72 127
	i 10.112 107.000 -1.000 1 76 127
	i 5.050 107.749 0.001 1 37 127
	i 6.050 107.749 0.001 1 37 127
	i -10.111 107.999 0
	i -10.112 107.999 0
	i 5.051 108.000 0.001 1 37 127
	i 6.051 108.000 0.001 1 37 127
	i 10.113 109.000 -1.000 1 72 127
	i 10.114 109.000 -1.000 1 76 127
	i -10.113 110.000 0
	i -10.114 110.000 0
	i 5.052 110.000 0.001 1 37 127
	i 6.052 110.000 0.001 1 37 127
	i 10.115 111.000 -1.000 1 72 127
	i 10.116 111.000 -1.000 1 76 127
	i 5.053 111.749 0.001 1 37 127
	i 6.053 111.749 0.001 1 37 127
	i 5.054 112.000 0.001 1 37 127
	i 6.054 112.000 0.001 1 37 127
	i -10.115 111.999 0
	i -10.116 111.999 0
	i 10.117 113.000 -1.000 1 72 127
	i 10.118 113.000 -1.000 1 76 127
	i 6.055 113.749 0.001 1 37 127
	i 5.055 113.749 0.001 1 37 127
	i 6.056 114.000 0.001 1 37 127
	i 5.056 114.000 0.001 1 37 127
	i -10.117 114.000 0
	i -10.118 114.000 0
	i 10.119 115.000 -1.000 1 72 127
	i 10.120 115.000 -1.000 1 76 127
	i 6.057 115.749 0.001 1 37 127
	i 5.057 115.749 0.001 1 37 127
	i 6.058 116.000 0.001 1 37 127
	i -10.119 115.999 0
	i 5.058 116.000 0.001 1 37 127
	i -10.120 115.999 0
	i 10.121 117.000 -1.000 1 72 127
	i 10.122 117.000 -1.000 1 76 127
	i 5.059 117.749 0.001 1 37 127
	i 6.059 117.749 0.001 1 37 127
	i 5.060 118.000 0.001 1 37 127
	i 6.060 118.000 0.001 1 37 127
	i -10.121 118.000 0
	i -10.122 118.000 0
	i 10.123 119.000 -1.000 1 72 127
	i 10.124 119.000 -1.000 1 76 127
	i 4.095 119.000 0.001 1 37 127
	i 6.061 119.749 0.001 1 37 127
	i 5.061 119.749 0.001 1 37 127
	i 5.062 120.000 0.001 1 37 127
	i -10.123 119.999 0
	i -10.124 119.999 0
	i 6.062 120.000 0.001 1 37 127
	i 10.125 121.000 -1.000 1 72 127
	i 4.096 121.000 0.001 1 37 127
	i 10.126 121.000 -1.000 1 76 127
	i 7.093 121.500 0.001 1 39 127
	i 6.063 121.749 0.001 1 37 127
	i 5.063 121.749 0.001 1 37 127
	i 5.064 122.000 0.001 1 37 127
	i 6.064 122.000 0.001 1 37 127
	i 9.606 122.000 0.001 1 49 127
	i 4.097 122.000 0.001 1 37 127
	i -10.125 122.000 0
	i 8.740 122.000 0.001 1 49 127
	i -10.126 122.000 0
	i 11.163 122.000 -1.000 1 38 81
	i 9.607 122.061 0.001 1 49 127
	i 9.608 122.124 0.001 1 49 127
	i 8.741 122.124 0.001 1 49 127
	i 9.609 122.187 0.001 1 49 127
	i 9.610 122.249 0.001 1 49 127
	i 8.742 122.249 0.001 1 49 127
	i 9.611 122.312 0.001 1 49 127
	i 8.743 122.375 0.001 1 49 127
	i 9.612 122.375 0.001 1 49 127
	i 9.613 122.437 0.001 1 49 127
	i 4.098 122.500 0.001 1 37 127
	i 7.094 122.500 0.001 1 39 127
	i 8.744 122.500 0.001 1 49 127
	i 9.614 122.500 0.001 1 49 127
	i 9.615 122.561 0.001 1 49 127
	i 9.616 122.624 0.001 1 49 127
	i 8.745 122.624 0.001 1 49 127
	i 9.617 122.687 0.001 1 49 127
	i 11.164 122.737 -1.000 1 41 89
	i -11.163 122.744 0
	i 9.618 122.749 0.001 1 49 127
	i 8.746 122.749 0.001 1 49 127
	i 9.619 122.812 0.001 1 49 127
	i 9.620 122.875 0.001 1 49 127
	i 8.747 122.875 0.001 1 49 127
	i 9.621 122.937 0.001 1 49 127
	i 4.099 123.000 0.001 1 37 127
	i 10.127 123.000 -1.000 1 72 127
	i 9.622 123.000 0.001 1 49 127
	i 8.748 123.000 0.001 1 49 127
	i 10.128 123.000 -1.000 1 76 127
	i 9.623 123.061 0.001 1 49 127
	i 8.749 123.124 0.001 1 49 127
	i 9.624 123.124 0.001 1 49 127
	i 9.625 123.187 0.001 1 49 127
	i 8.750 123.249 0.001 1 49 127
	i 9.626 123.249 0.001 1 49 127
	i 11.165 123.255 -1.000 1 38 68
	i -11.164 123.260 0
	i 9.627 123.312 0.001 1 49 127
	i 8.751 123.375 0.001 1 49 127
	i 9.628 123.375 0.001 1 49 127
	i 9.629 123.437 0.001 1 49 127
	i 11.166 123.501 -1.000 1 41 78
	i 9.630 123.500 0.001 1 49 127
	i 8.752 123.500 0.001 1 49 127
	i 4.100 123.500 0.001 1 37 127
	i 7.095 123.500 0.001 1 39 127
	i -11.165 123.509 0
	i 9.631 123.561 0.001 1 49 127
	i 9.632 123.624 0.001 1 49 127
	i 8.753 123.624 0.001 1 49 127
	i 9.633 123.687 0.001 1 49 127
	i 5.065 123.749 0.001 1 37 127
	i 6.065 123.749 0.001 1 37 127
	i 8.754 123.749 0.001 1 49 127
	i 9.634 123.749 0.001 1 49 127
	i 9.635 123.812 0.001 1 49 127
	i 9.636 123.875 0.001 1 49 127
	i 8.755 123.875 0.001 1 49 113
	i 9.637 123.937 0.001 1 49 127
	i 4.101 124.000 0.001 1 37 127
	i 5.066 124.000 0.001 1 37 127
	i 6.066 124.000 0.001 1 37 127
	i -10.127 123.999 0
	i 9.638 124.000 0.001 1 49 127
	i -10.128 123.999 0
	i 8.756 124.000 0.001 1 49 127
	i 11.167 124.012 -1.000 1 38 78
	i -11.166 124.031 0
	i 9.639 124.061 0.001 1 49 127
	i 9.640 124.124 0.001 1 49 127
	i 8.757 124.124 0.001 1 49 127
	i 9.641 124.187 0.001 1 49 127
	i 8.758 124.249 0.001 1 49 127
	i 9.642 124.249 0.001 1 49 127
	i 9.643 124.312 0.001 1 49 127
	i 9.644 124.375 0.001 1 49 127
	i 8.759 124.375 0.001 1 49 127
	i 9.645 124.437 0.001 1 49 127
	i 4.102 124.500 0.001 1 37 127
	i 8.760 124.500 0.001 1 49 127
	i 9.646 124.500 0.001 1 49 127
	i 7.096 124.500 0.001 1 39 127
	i 9.647 124.561 0.001 1 49 127
	i 8.761 124.624 0.001 1 49 127
	i 9.648 124.624 0.001 1 49 127
	i 9.649 124.687 0.001 1 49 127
	i 8.762 124.749 0.001 1 49 127
	i 9.650 124.749 0.001 1 49 127
	i 11.168 124.760 -1.000 1 36 86
	i -11.167 124.768 0
	i 9.651 124.812 0.001 1 49 127
	i 8.763 124.875 0.001 1 49 127
	i 9.652 124.875 0.001 1 49 127
	i 9.653 124.937 0.001 1 49 127
	i 8.764 125.000 0.001 1 49 127
	i 4.103 125.000 0.001 1 37 127
	i 9.654 125.000 0.001 1 49 127
	i 10.129 125.000 -1.000 1 72 127
	i 10.130 125.000 -1.000 1 76 127
	i 9.655 125.061 0.001 1 49 127
	i 8.765 125.124 0.001 1 49 127
	i 9.656 125.124 0.001 1 49 127
	i 9.657 125.187 0.001 1 49 127
	i 9.658 125.249 0.001 1 49 127
	i 8.766 125.249 0.001 1 49 127
	i -11.168 125.257 0
	i 11.169 125.259 -1.000 1 33 74
	i 9.659 125.312 0.001 1 49 127
	i 8.767 125.375 0.001 1 49 127
	i 9.660 125.375 0.001 1 49 127
	i 9.661 125.437 0.001 1 49 127
	i 8.768 125.500 0.001 1 49 127
	i 7.097 125.500 0.001 1 39 127
	i 9.662 125.500 0.001 1 49 127
	i 4.104 125.500 0.001 1 37 127
	i 11.170 125.508 -1.000 1 36 91
	i -11.169 125.517 0
	i 9.663 125.561 0.001 1 49 127
	i 9.664 125.624 0.001 1 49 127
	i 8.769 125.624 0.001 1 49 127
	i 9.665 125.687 0.001 1 49 127
	i 5.067 125.749 0.001 1 37 127
	i 9.666 125.749 0.001 1 49 127
	i 8.770 125.749 0.001 1 49 127
	i 6.067 125.749 0.001 1 37 127
	i 9.667 125.812 0.001 1 49 127
	i 8.771 125.875 0.001 1 49 113
	i 9.668 125.875 0.001 1 49 127
	i 9.669 125.937 0.001 1 49 127
	i 4.105 126.000 0.001 1 37 127
	i -11.170 126.000 0
	i 11.171 126.000 -1.000 1 38 81
	i 5.068 126.000 0.001 1 37 127
	i 6.068 126.000 0.001 1 37 127
	i 9.670 126.000 0.001 1 49 127
	i -10.129 126.000 0
	i -10.130 126.000 0
	i 8.772 126.000 0.001 1 49 127
	i 9.671 126.061 0.001 1 49 127
	i 8.773 126.124 0.001 1 49 127
	i 9.672 126.124 0.001 1 49 127
	i 9.673 126.187 0.001 1 49 127
	i 9.674 126.249 0.001 1 49 127
	i 8.774 126.249 0.001 1 49 127
	i 9.675 126.312 0.001 1 49 127
	i 8.775 126.375 0.001 1 49 127
	i 9.676 126.375 0.001 1 49 127
	i 9.677 126.437 0.001 1 49 127
	i 4.106 126.500 0.001 1 37 127
	i 8.776 126.500 0.001 1 49 127
	i 7.098 126.500 0.001 1 39 127
	i 9.678 126.500 0.001 1 49 127
	i 9.679 126.561 0.001 1 49 127
	i 9.680 126.624 0.001 1 49 127
	i 8.777 126.624 0.001 1 49 127
	i 9.681 126.687 0.001 1 49 127
	i 11.172 126.737 -1.000 1 41 89
	i -11.171 126.744 0
	i 9.682 126.749 0.001 1 49 127
	i 8.778 126.749 0.001 1 49 127
	i 9.683 126.812 0.001 1 49 127
	i 8.779 126.875 0.001 1 49 127
	i 9.684 126.875 0.001 1 49 127
	i 9.685 126.937 0.001 1 49 127
	i 9.686 127.000 0.001 1 49 127
	i 8.780 127.000 0.001 1 49 127
	i 10.131 127.000 -1.000 1 72 127
	i 10.132 127.000 -1.000 1 76 127
	i 4.107 127.000 0.001 1 37 127
	i 9.687 127.061 0.001 1 49 127
	i 9.688 127.124 0.001 1 49 127
	i 8.781 127.124 0.001 1 49 127
	i 9.689 127.187 0.001 1 49 127
	i 9.690 127.249 0.001 1 49 127
	i 8.782 127.249 0.001 1 49 127
	i 11.173 127.255 -1.000 1 38 68
	i -11.172 127.260 0
	i 9.691 127.312 0.001 1 49 127
	i 8.783 127.375 0.001 1 49 127
	i 9.692 127.375 0.001 1 49 127
	i 9.693 127.437 0.001 1 49 127
	i 11.174 127.501 -1.000 1 41 78
	i 4.108 127.500 0.001 1 37 127
	i 7.099 127.500 0.001 1 39 127
	i 8.784 127.500 0.001 1 49 127
	i 9.694 127.500 0.001 1 49 127
	i -11.173 127.509 0
	i 9.695 127.561 0.001 1 49 127
	i 9.696 127.624 0.001 1 49 127
	i 8.785 127.624 0.001 1 49 127
	i 9.697 127.687 0.001 1 49 127
	i 5.069 127.749 0.001 1 37 127
	i 6.069 127.749 0.001 1 37 127
	i 8.786 127.749 0.001 1 49 127
	i 9.698 127.749 0.001 1 49 127
	i 9.699 127.812 0.001 1 49 127
	i 9.700 127.875 0.001 1 49 127
	i 8.787 127.875 0.001 1 49 113
	i 9.701 127.937 0.001 1 49 127
	i 4.109 128.000 0.001 1 37 127
	i 5.070 128.000 0.001 1 37 127
	i 8.788 128.000 0.001 1 49 127
	i 9.702 128.000 0.001 1 49 127
	i -10.131 127.999 0
	i -10.132 127.999 0
	i 6.070 128.000 0.001 1 37 127
	i 11.175 128.012 -1.000 1 38 78
	i -11.174 128.031 0
	i 9.703 128.061 0.001 1 49 127
	i 8.789 128.124 0.001 1 49 127
	i 9.704 128.124 0.001 1 49 127
	i 9.705 128.187 0.001 1 49 127
	i 9.706 128.249 0.001 1 49 127
	i 8.790 128.249 0.001 1 49 127
	i 9.707 128.312 0.001 1 49 127
	i 8.791 128.375 0.001 1 49 127
	i 9.708 128.375 0.001 1 49 127
	i 9.709 128.437 0.001 1 49 127
	i 4.110 128.500 0.001 1 37 127
	i 9.710 128.500 0.001 1 49 127
	i 7.100 128.500 0.001 1 39 127
	i 8.792 128.500 0.001 1 49 127
	i 9.711 128.561 0.001 1 49 127
	i 8.793 128.624 0.001 1 49 127
	i 9.712 128.624 0.001 1 49 127
	i 9.713 128.687 0.001 1 49 127
	i 8.794 128.749 0.001 1 49 127
	i 9.714 128.749 0.001 1 49 127
	i 11.176 128.760 -1.000 1 36 86
	i -11.175 128.768 0
	i 9.715 128.812 0.001 1 49 127
	i 8.795 128.875 0.001 1 49 127
	i 9.716 128.875 0.001 1 49 127
	i 9.717 128.937 0.001 1 49 127
	i 10.133 129.000 -1.000 1 72 127
	i 4.111 129.000 0.001 1 37 127
	i 8.796 129.000 0.001 1 49 127
	i 10.134 129.000 -1.000 1 76 127
	i 9.718 129.000 0.001 1 49 127
	i 9.719 129.061 0.001 1 49 127
	i 9.720 129.124 0.001 1 49 127
	i 8.797 129.124 0.001 1 49 127
	i 9.721 129.187 0.001 1 49 127
	i 9.722 129.249 0.001 1 49 127
	i 8.798 129.249 0.001 1 49 127
	i -11.176 129.257 0
	i 11.177 129.259 -1.000 1 33 74
	i 9.723 129.312 0.001 1 49 127
	i 9.724 129.375 0.001 1 49 127
	i 8.799 129.375 0.001 1 49 127
	i 9.725 129.437 0.001 1 49 127
	i 9.726 129.500 0.001 1 49 127
	i 4.112 129.500 0.001 1 37 127
	i 8.800 129.500 0.001 1 49 127
	i 7.101 129.500 0.001 1 39 127
	i 11.178 129.508 -1.000 1 36 91
	i -11.177 129.517 0
	i 9.727 129.561 0.001 1 49 127
	i 8.801 129.624 0.001 1 49 127
	i 9.728 129.624 0.001 1 49 127
	i 9.729 129.687 0.001 1 49 127
	i 8.802 129.749 0.001 1 49 127
	i 6.071 129.749 0.001 1 37 127
	i 9.730 129.749 0.001 1 49 127
	i 5.071 129.749 0.001 1 37 127
	i 9.731 129.812 0.001 1 49 127
	i 9.732 129.875 0.001 1 49 127
	i 8.803 129.875 0.001 1 49 113
	i 9.733 129.937 0.001 1 49 127
	i -11.178 130.000 0
	i 4.113 130.000 0.001 1 37 127
	i 5.072 130.000 0.001 1 37 127
	i 11.179 130.000 -1.000 1 38 81
	i 6.072 130.000 0.001 1 37 127
	i 8.804 130.000 0.001 1 49 127
	i 9.734 130.000 0.001 1 49 127
	i -10.133 130.000 0
	i -10.134 130.000 0
	i 9.735 130.061 0.001 1 49 127
	i 9.736 130.124 0.001 1 49 127
	i 8.805 130.124 0.001 1 49 127
	i 9.737 130.187 0.001 1 49 127
	i 8.806 130.249 0.001 1 49 127
	i 9.738 130.249 0.001 1 49 127
	i 9.739 130.312 0.001 1 49 127
	i 8.807 130.375 0.001 1 49 127
	i 9.740 130.375 0.001 1 49 127
	i 9.741 130.437 0.001 1 49 127
	i 4.114 130.500 0.001 1 37 127
	i 7.102 130.500 0.001 1 39 127
	i 8.808 130.500 0.001 1 49 127
	i 9.742 130.500 0.001 1 49 127
	i 9.743 130.561 0.001 1 49 127
	i 8.809 130.624 0.001 1 49 127
	i 9.744 130.624 0.001 1 49 127
	i 9.745 130.687 0.001 1 49 127
	i 11.180 130.737 -1.000 1 41 89
	i -11.179 130.744 0
	i 9.746 130.749 0.001 1 49 127
	i 8.810 130.749 0.001 1 49 127
	i 9.747 130.812 0.001 1 49 127
	i 8.811 130.875 0.001 1 49 127
	i 9.748 130.875 0.001 1 49 127
	i 9.749 130.937 0.001 1 49 127
	i 10.135 131.000 -1.000 1 72 127
	i 8.812 131.000 0.001 1 49 127
	i 10.136 131.000 -1.000 1 76 127
	i 4.115 131.000 0.001 1 37 127
	i 9.750 131.000 0.001 1 49 127
	i 9.751 131.061 0.001 1 49 127
	i 9.752 131.124 0.001 1 49 127
	i 8.813 131.124 0.001 1 49 127
	i 9.753 131.187 0.001 1 49 127
	i 8.814 131.249 0.001 1 49 127
	i 9.754 131.249 0.001 1 49 127
	i 11.181 131.255 -1.000 1 38 68
	i -11.180 131.260 0
	i 9.755 131.312 0.001 1 49 127
	i 9.756 131.375 0.001 1 49 127
	i 8.815 131.375 0.001 1 49 127
	i 9.757 131.437 0.001 1 49 127
	i 4.116 131.500 0.001 1 37 127
	i 11.182 131.501 -1.000 1 41 78
	i 7.103 131.500 0.001 1 39 127
	i 8.816 131.500 0.001 1 49 127
	i 9.758 131.500 0.001 1 49 127
	i -11.181 131.509 0
	i 9.759 131.561 0.001 1 49 127
	i 8.817 131.624 0.001 1 49 127
	i 9.760 131.624 0.001 1 49 127
	i 9.761 131.687 0.001 1 49 127
	i 5.073 131.749 0.001 1 37 127
	i 8.818 131.749 0.001 1 49 127
	i 9.762 131.749 0.001 1 49 127
	i 6.073 131.749 0.001 1 37 127
	i 9.763 131.812 0.001 1 49 127
	i 9.764 131.875 0.001 1 49 127
	i 8.819 131.875 0.001 1 49 113
	i 9.765 131.937 0.001 1 49 127
	i 6.074 132.000 0.001 1 37 127
	i 5.074 132.000 0.001 1 37 127
	i 4.117 132.000 0.001 1 37 127
	i 8.820 132.000 0.001 1 49 127
	i 9.766 132.000 0.001 1 49 127
	i -10.135 131.999 0
	i -10.136 131.999 0
	i 11.183 132.012 -1.000 1 38 78
	i -11.182 132.031 0
	i 9.767 132.061 0.001 1 49 127
	i 8.821 132.124 0.001 1 49 127
	i 9.768 132.124 0.001 1 49 127
	i 9.769 132.187 0.001 1 49 127
	i 9.770 132.249 0.001 1 49 127
	i 8.822 132.249 0.001 1 49 127
	i 9.771 132.312 0.001 1 49 127
	i 8.823 132.375 0.001 1 49 127
	i 9.772 132.375 0.001 1 49 127
	i 9.773 132.437 0.001 1 49 127
	i 7.104 132.500 0.001 1 39 127
	i 9.774 132.500 0.001 1 49 127
	i 4.118 132.500 0.001 1 37 127
	i 8.824 132.500 0.001 1 49 127
	i 9.775 132.561 0.001 1 49 127
	i 8.825 132.624 0.001 1 49 127
	i 9.776 132.624 0.001 1 49 127
	i 9.777 132.687 0.001 1 49 127
	i 8.826 132.749 0.001 1 49 127
	i 9.778 132.749 0.001 1 49 127
	i 11.184 132.760 -1.000 1 36 86
	i -11.183 132.768 0
	i 9.779 132.812 0.001 1 49 127
	i 8.827 132.875 0.001 1 49 127
	i 9.780 132.875 0.001 1 49 127
	i 9.781 132.937 0.001 1 49 127
	i 4.119 133.000 0.001 1 37 127
	i 8.828 133.000 0.001 1 49 127
	i 9.782 133.000 0.001 1 49 127
	i 10.137 133.000 -1.000 1 72 127
	i 10.138 133.000 -1.000 1 76 127
	i 9.783 133.061 0.001 1 49 127
	i 9.784 133.124 0.001 1 49 127
	i 8.829 133.124 0.001 1 49 127
	i 9.785 133.187 0.001 1 49 127
	i 8.830 133.249 0.001 1 49 127
	i 9.786 133.249 0.001 1 49 127
	i -11.184 133.257 0
	i 11.185 133.259 -1.000 1 33 74
	i 9.787 133.312 0.001 1 49 127
	i 8.831 133.375 0.001 1 49 127
	i 9.788 133.375 0.001 1 49 127
	i 9.789 133.437 0.001 1 49 127
	i 4.120 133.500 0.001 1 37 127
	i 7.105 133.500 0.001 1 39 127
	i 8.832 133.500 0.001 1 49 127
	i 9.790 133.500 0.001 1 49 127
	i 11.186 133.508 -1.000 1 36 91
	i -11.185 133.517 0
	i 9.791 133.561 0.001 1 49 127
	i 9.792 133.624 0.001 1 49 127
	i 8.833 133.624 0.001 1 49 127
	i 9.793 133.687 0.001 1 49 127
	i 9.794 133.749 0.001 1 49 127
	i 6.075 133.749 0.001 1 37 127
	i 5.075 133.749 0.001 1 37 127
	i 8.834 133.749 0.001 1 49 127
	i 9.795 133.812 0.001 1 49 127
	i 8.835 133.875 0.001 1 49 113
	i 9.796 133.875 0.001 1 49 127
	i 9.797 133.937 0.001 1 49 127
	i 4.121 134.000 0.001 1 37 127
	i 5.076 134.000 0.001 1 37 127
	i 6.076 134.000 0.001 1 37 127
	i 8.836 134.000 0.001 1 49 127
	i 9.798 134.000 0.001 1 49 127
	i -10.137 134.000 0
	i -10.138 134.000 0
	i -11.186 133.999 0
	i 11.187 134.000 -1.000 1 38 83
	i 9.799 134.061 0.001 1 49 127
	i 9.800 134.124 0.001 1 49 127
	i 8.837 134.124 0.001 1 49 127
	i 9.801 134.187 0.001 1 49 127
	i 8.838 134.249 0.001 1 49 127
	i 9.802 134.249 0.001 1 49 127
	i 9.803 134.312 0.001 1 49 127
	i 8.839 134.375 0.001 1 49 127
	i 9.804 134.375 0.001 1 49 127
	i 9.805 134.437 0.001 1 49 127
	i 8.840 134.500 0.001 1 49 127
	i 9.806 134.500 0.001 1 49 127
	i 7.106 134.500 0.001 1 39 127
	i 4.122 134.500 0.001 1 37 127
	i 9.807 134.561 0.001 1 49 127
	i 8.841 134.624 0.001 1 49 127
	i 9.808 134.624 0.001 1 49 127
	i 9.809 134.687 0.001 1 49 127
	i 11.188 134.737 -1.000 1 41 103
	i 9.810 134.749 0.001 1 49 127
	i 8.842 134.749 0.001 1 49 127
	i -11.187 134.756 0
	i 9.811 134.812 0.001 1 49 127
	i 9.812 134.875 0.001 1 49 127
	i 8.843 134.875 0.001 1 49 127
	i 9.813 134.937 0.001 1 49 127
	i 4.123 135.000 0.001 1 37 127
	i 10.139 135.000 -1.000 1 72 127
	i 10.140 135.000 -1.000 1 76 127
	i 8.844 135.000 0.001 1 49 127
	i 9.814 135.000 0.001 1 49 127
	i 9.815 135.061 0.001 1 49 127
	i 9.816 135.124 0.001 1 49 127
	i 8.845 135.124 0.001 1 49 127
	i 9.817 135.187 0.001 1 49 127
	i 11.189 135.223 -1.000 1 44 76
	i -11.188 135.235 0
	i 9.818 135.249 0.001 1 49 127
	i 8.846 135.249 0.001 1 49 127
	i 9.819 135.312 0.001 1 49 127
	i 9.820 135.375 0.001 1 49 127
	i 8.847 135.375 0.001 1 49 127
	i 9.821 135.437 0.001 1 49 127
	i 4.124 135.500 0.001 1 37 127
	i 7.107 135.500 0.001 1 39 127
	i 9.822 135.500 0.001 1 49 127
	i 8.848 135.500 0.001 1 49 127
	i -11.189 135.523 0
	i 11.190 135.523 -1.000 1 43 89
	i 9.823 135.561 0.001 1 49 127
	i 8.849 135.624 0.001 1 49 127
	i 9.824 135.624 0.001 1 49 127
	i 9.825 135.687 0.001 1 49 127
	i 5.077 135.749 0.001 1 37 127
	i 8.850 135.749 0.001 1 49 127
	i 6.077 135.749 0.001 1 37 127
	i 9.826 135.749 0.001 1 49 127
	i 9.827 135.812 0.001 1 49 127
	i 8.851 135.875 0.001 1 49 113
	i 9.828 135.875 0.001 1 49 127
	i 9.829 135.937 0.001 1 49 127
	i -11.190 135.997 0
	i 9.830 136.000 0.001 1 49 127
	i 8.852 136.000 0.001 1 49 127
	i 11.191 135.997 -1.000 1 41 97
	i 4.125 136.000 0.001 1 37 127
	i -10.139 135.999 0
	i -10.140 135.999 0
	i 6.078 136.000 0.001 1 37 127
	i 5.078 136.000 0.001 1 37 127
	i 9.831 136.061 0.001 1 49 127
	i 8.853 136.124 0.001 1 49 127
	i 9.832 136.124 0.001 1 49 127
	i 9.833 136.187 0.001 1 49 127
	i 9.834 136.249 0.001 1 49 127
	i 8.854 136.249 0.001 1 49 127
	i 9.835 136.312 0.001 1 49 127
	i 9.836 136.375 0.001 1 49 127
	i 8.855 136.375 0.001 1 49 127
	i 9.837 136.437 0.001 1 49 127
	i 9.838 136.500 0.001 1 49 127
	i 7.108 136.500 0.001 1 39 127
	i 4.126 136.500 0.001 1 37 127
	i 8.856 136.500 0.001 1 49 127
	i 9.839 136.561 0.001 1 49 127
	i 9.840 136.624 0.001 1 49 127
	i 8.857 136.624 0.001 1 49 127
	i 9.841 136.687 0.001 1 49 127
	i 9.842 136.749 0.001 1 49 127
	i 8.858 136.749 0.001 1 49 127
	i -11.191 136.756 0
	i 11.192 136.759 -1.000 1 38 80
	i 9.843 136.812 0.001 1 49 127
	i 8.859 136.875 0.001 1 49 127
	i 9.844 136.875 0.001 1 49 127
	i 9.845 136.937 0.001 1 49 127
	i 4.127 137.000 0.001 1 37 127
	i 8.860 137.000 0.001 1 49 127
	i 10.141 137.000 -1.000 1 72 127
	i 9.846 137.000 0.001 1 49 127
	i 10.142 137.000 -1.000 1 76 127
	i 9.847 137.061 0.001 1 49 127
	i 8.861 137.124 0.001 1 49 127
	i 9.848 137.124 0.001 1 49 127
	i 9.849 137.187 0.001 1 49 127
	i 11.193 137.205 -1.000 1 33 79
	i -11.192 137.229 0
	i 8.862 137.249 0.001 1 49 127
	i 9.850 137.249 0.001 1 49 127
	i 9.851 137.312 0.001 1 49 127
	i 9.852 137.375 0.001 1 49 127
	i 8.863 137.375 0.001 1 49 127
	i 9.853 137.437 0.001 1 49 127
	i 4.128 137.500 0.001 1 37 127
	i 8.864 137.500 0.001 1 49 127
	i 9.854 137.500 0.001 1 49 127
	i 7.109 137.500 0.001 1 39 127
	i 11.194 137.507 -1.000 1 36 89
	i -11.193 137.508 0
	i 9.855 137.561 0.001 1 49 127
	i 8.865 137.624 0.001 1 49 127
	i 9.856 137.624 0.001 1 49 127
	i 9.857 137.687 0.001 1 49 127
	i 9.858 137.749 0.001 1 49 127
	i 5.079 137.749 0.001 1 37 127
	i 8.866 137.749 0.001 1 49 127
	i 6.079 137.749 0.001 1 37 127
	i 9.859 137.812 0.001 1 49 127
	i 9.860 137.875 0.001 1 49 127
	i 8.867 137.875 0.001 1 49 113
	i 9.861 137.937 0.001 1 49 127
	i 8.868 138.000 0.001 1 49 127
	i 9.862 138.000 0.001 1 49 127
	i 5.080 138.000 0.001 1 37 127
	i 6.080 138.000 0.001 1 37 127
	i 4.129 138.000 0.001 1 37 127
	i -11.194 137.999 0
	i -10.141 138.000 0
	i -10.142 138.000 0
	i 11.195 138.000 -1.000 1 38 81
	i 9.863 138.061 0.001 1 49 127
	i 8.869 138.124 0.001 1 49 127
	i 9.864 138.124 0.001 1 49 127
	i 9.865 138.187 0.001 1 49 127
	i 9.866 138.249 0.001 1 49 127
	i 8.870 138.249 0.001 1 49 127
	i 9.867 138.312 0.001 1 49 127
	i 9.868 138.375 0.001 1 49 127
	i 8.871 138.375 0.001 1 49 127
	i 9.869 138.437 0.001 1 49 127
	i 4.130 138.500 0.001 1 37 127
	i 8.872 138.500 0.001 1 49 127
	i 7.110 138.500 0.001 1 39 127
	i 9.870 138.500 0.001 1 49 127
	i 9.871 138.561 0.001 1 49 127
	i 9.872 138.624 0.001 1 49 127
	i 8.873 138.624 0.001 1 49 127
	i 9.873 138.687 0.001 1 49 127
	i 11.196 138.737 -1.000 1 41 89
	i -11.195 138.744 0
	i 9.874 138.749 0.001 1 49 127
	i 8.874 138.749 0.001 1 49 127
	i 9.875 138.812 0.001 1 49 127
	i 8.875 138.875 0.001 1 49 127
	i 9.876 138.875 0.001 1 49 127
	i 9.877 138.937 0.001 1 49 127
	i 8.876 139.000 0.001 1 49 127
	i 9.878 139.000 0.001 1 49 127
	i 10.143 139.000 -1.000 1 72 127
	i 4.131 139.000 0.001 1 37 127
	i 10.144 139.000 -1.000 1 76 127
	i 9.879 139.061 0.001 1 49 127
	i 9.880 139.124 0.001 1 49 127
	i 8.877 139.124 0.001 1 49 127
	i 9.881 139.187 0.001 1 49 127
	i 9.882 139.249 0.001 1 49 127
	i 8.878 139.249 0.001 1 49 127
	i 11.197 139.255 -1.000 1 38 68
	i -11.196 139.260 0
	i 9.883 139.312 0.001 1 49 127
	i 9.884 139.375 0.001 1 49 127
	i 8.879 139.375 0.001 1 49 127
	i 9.885 139.437 0.001 1 49 127
	i 7.111 139.500 0.001 1 39 127
	i 9.886 139.500 0.001 1 49 127
	i 11.198 139.501 -1.000 1 41 78
	i 4.132 139.500 0.001 1 37 127
	i 8.880 139.500 0.001 1 49 127
	i -11.197 139.509 0
	i 9.887 139.561 0.001 1 49 127
	i 8.881 139.624 0.001 1 49 127
	i 9.888 139.624 0.001 1 49 127
	i 9.889 139.687 0.001 1 49 127
	i 6.081 139.749 0.001 1 37 127
	i 9.890 139.749 0.001 1 49 127
	i 8.882 139.749 0.001 1 49 127
	i 5.081 139.749 0.001 1 37 127
	i 9.891 139.812 0.001 1 49 127
	i 8.883 139.875 0.001 1 49 113
	i 9.892 139.875 0.001 1 49 127
	i 9.893 139.937 0.001 1 49 127
	i 4.133 140.000 0.001 1 37 127
	i 5.082 140.000 0.001 1 37 127
	i 6.082 140.000 0.001 1 37 127
	i -10.143 139.999 0
	i 8.884 140.000 0.001 1 49 127
	i 9.894 140.000 0.001 1 49 127
	i -10.144 139.999 0
	i 11.199 140.012 -1.000 1 38 78
	i -11.198 140.031 0
	i 9.895 140.061 0.001 1 49 127
	i 9.896 140.124 0.001 1 49 127
	i 8.885 140.124 0.001 1 49 127
	i 9.897 140.187 0.001 1 49 127
	i 9.898 140.249 0.001 1 49 127
	i 8.886 140.249 0.001 1 49 127
	i 9.899 140.312 0.001 1 49 127
	i 8.887 140.375 0.001 1 49 127
	i 9.900 140.375 0.001 1 49 127
	i 9.901 140.437 0.001 1 49 127
	i 7.112 140.500 0.001 1 39 127
	i 9.902 140.500 0.001 1 49 127
	i 4.134 140.500 0.001 1 37 127
	i 8.888 140.500 0.001 1 49 127
	i 9.903 140.561 0.001 1 49 127
	i 9.904 140.624 0.001 1 49 127
	i 8.889 140.624 0.001 1 49 127
	i 9.905 140.687 0.001 1 49 127
	i 9.906 140.749 0.001 1 49 127
	i 8.890 140.749 0.001 1 49 127
	i 11.200 140.760 -1.000 1 36 86
	i -11.199 140.768 0
	i 9.907 140.812 0.001 1 49 127
	i 8.891 140.875 0.001 1 49 127
	i 9.908 140.875 0.001 1 49 127
	i 9.909 140.937 0.001 1 49 127
	i 4.135 141.000 0.001 1 37 127
	i 8.892 141.000 0.001 1 49 127
	i 9.910 141.000 0.001 1 49 127
	i 10.145 141.000 -1.000 1 72 127
	i 10.146 141.000 -1.000 1 76 127
	i 9.911 141.061 0.001 1 49 127
	i 9.912 141.124 0.001 1 49 127
	i 8.893 141.124 0.001 1 49 127
	i 9.913 141.187 0.001 1 49 127
	i 8.894 141.249 0.001 1 49 127
	i 9.914 141.249 0.001 1 49 127
	i -11.200 141.257 0
	i 11.201 141.259 -1.000 1 33 74
	i 9.915 141.312 0.001 1 49 127
	i 9.916 141.375 0.001 1 49 127
	i 8.895 141.375 0.001 1 49 127
	i 9.917 141.437 0.001 1 49 127
	i 4.136 141.500 0.001 1 37 127
	i 7.113 141.500 0.001 1 39 127
	i 9.918 141.500 0.001 1 49 127
	i 8.896 141.500 0.001 1 49 127
	i 11.202 141.508 -1.000 1 36 91
	i -11.201 141.517 0
	i 9.919 141.561 0.001 1 49 127
	i 9.920 141.624 0.001 1 49 127
	i 8.897 141.624 0.001 1 49 127
	i 9.921 141.687 0.001 1 49 127
	i 6.083 141.749 0.001 1 37 127
	i 8.898 141.749 0.001 1 49 127
	i 5.083 141.749 0.001 1 37 127
	i 9.922 141.749 0.001 1 49 127
	i 9.923 141.812 0.001 1 49 127
	i 8.899 141.875 0.001 1 49 113
	i 9.924 141.875 0.001 1 49 127
	i 9.925 141.937 0.001 1 49 127
	i -11.202 142.000 0
	i 4.137 142.000 0.001 1 37 127
	i 5.084 142.000 0.001 1 37 127
	i 11.203 142.000 -1.000 1 38 81
	i 6.084 142.000 0.001 1 37 127
	i 8.900 142.000 0.001 1 49 127
	i 9.926 142.000 0.001 1 49 127
	i -10.145 142.000 0
	i -10.146 142.000 0
	i 9.927 142.061 0.001 1 49 127
	i 8.901 142.124 0.001 1 49 127
	i 9.928 142.124 0.001 1 49 127
	i 9.929 142.187 0.001 1 49 127
	i 8.902 142.249 0.001 1 49 127
	i 9.930 142.249 0.001 1 49 127
	i 9.931 142.312 0.001 1 49 127
	i 8.903 142.375 0.001 1 49 127
	i 9.932 142.375 0.001 1 49 127
	i 9.933 142.437 0.001 1 49 127
	i 4.138 142.500 0.001 1 37 127
	i 8.904 142.500 0.001 1 49 127
	i 9.934 142.500 0.001 1 49 127
	i 7.114 142.500 0.001 1 39 127
	i 9.935 142.561 0.001 1 49 127
	i 8.905 142.624 0.001 1 49 127
	i 9.936 142.624 0.001 1 49 127
	i 9.937 142.687 0.001 1 49 127
	i 11.204 142.737 -1.000 1 41 89
	i -11.203 142.744 0
	i 8.906 142.749 0.001 1 49 127
	i 9.938 142.749 0.001 1 49 127
	i 9.939 142.812 0.001 1 49 127
	i 8.907 142.875 0.001 1 49 127
	i 9.940 142.875 0.001 1 49 127
	i 9.941 142.937 0.001 1 49 127
	i 8.908 143.000 0.001 1 49 127
	i 9.942 143.000 0.001 1 49 127
	i 10.147 143.000 -1.000 1 72 127
	i 4.139 143.000 0.001 1 37 127
	i 10.148 143.000 -1.000 1 76 127
	i 9.943 143.061 0.001 1 49 127
	i 8.909 143.124 0.001 1 49 127
	i 9.944 143.124 0.001 1 49 127
	i 9.945 143.187 0.001 1 49 127
	i 9.946 143.249 0.001 1 49 127
	i 8.910 143.249 0.001 1 49 127
	i 11.205 143.255 -1.000 1 38 68
	i -11.204 143.260 0
	i 9.947 143.312 0.001 1 49 127
	i 9.948 143.375 0.001 1 49 127
	i 8.911 143.375 0.001 1 49 127
	i 9.949 143.437 0.001 1 49 127
	i 9.950 143.500 0.001 1 49 127
	i 8.912 143.500 0.001 1 49 127
	i 7.115 143.500 0.001 1 39 127
	i 11.206 143.501 -1.000 1 41 78
	i 4.140 143.500 0.001 1 37 127
	i -11.205 143.509 0
	i 9.951 143.561 0.001 1 49 127
	i 8.913 143.624 0.001 1 49 127
	i 9.952 143.624 0.001 1 49 127
	i 9.953 143.687 0.001 1 49 127
	i 5.085 143.749 0.001 1 37 127
	i 6.085 143.749 0.001 1 37 127
	i 8.914 143.749 0.001 1 49 127
	i 9.954 143.749 0.001 1 49 127
	i 9.955 143.812 0.001 1 49 127
	i 8.915 143.875 0.001 1 49 113
	i 9.956 143.875 0.001 1 49 127
	i 9.957 143.937 0.001 1 49 127
	i 4.141 144.000 0.001 1 37 127
	i 5.086 144.000 0.001 1 37 127
	i 6.086 144.000 0.001 1 37 127
	i 9.958 144.000 0.001 1 49 127
	i 8.916 144.000 0.001 1 49 127
	i -10.147 143.999 0
	i -10.148 143.999 0
	i 11.207 144.012 -1.000 1 38 78
	i -11.206 144.031 0
	i 9.959 144.061 0.001 1 49 127
	i 9.960 144.124 0.001 1 49 127
	i 8.917 144.124 0.001 1 49 127
	i 9.961 144.187 0.001 1 49 127
	i 8.918 144.249 0.001 1 49 127
	i 9.962 144.249 0.001 1 49 127
	i 9.963 144.312 0.001 1 49 127
	i 8.919 144.375 0.001 1 49 127
	i 9.964 144.375 0.001 1 49 127
	i 9.965 144.437 0.001 1 49 127
	i 4.142 144.500 0.001 1 37 127
	i 8.920 144.500 0.001 1 49 127
	i 7.116 144.500 0.001 1 39 127
	i 9.966 144.500 0.001 1 49 127
	i 9.967 144.561 0.001 1 49 127
	i 9.968 144.624 0.001 1 49 127
	i 8.921 144.624 0.001 1 49 127
	i 9.969 144.687 0.001 1 49 127
	i 9.970 144.749 0.001 1 49 127
	i 8.922 144.749 0.001 1 49 127
	i 11.208 144.760 -1.000 1 36 86
	i -11.207 144.768 0
	i 9.971 144.812 0.001 1 49 127
	i 9.972 144.875 0.001 1 49 127
	i 8.923 144.875 0.001 1 49 127
	i 9.973 144.937 0.001 1 49 127
	i 8.924 145.000 0.001 1 49 127
	i 9.974 145.000 0.001 1 49 127
	i 10.149 145.000 -1.000 1 72 127
	i 10.150 145.000 -1.000 1 76 127
	i 4.143 145.000 0.001 1 37 127
	i 9.975 145.061 0.001 1 49 127
	i 8.925 145.124 0.001 1 49 127
	i 9.976 145.124 0.001 1 49 127
	i 9.977 145.187 0.001 1 49 127
	i 8.926 145.249 0.001 1 49 127
	i 9.978 145.249 0.001 1 49 127
	i -11.208 145.257 0
	i 11.209 145.259 -1.000 1 33 74
	i 9.979 145.312 0.001 1 49 127
	i 9.980 145.375 0.001 1 49 127
	i 8.927 145.375 0.001 1 49 127
	i 9.981 145.437 0.001 1 49 127
	i 7.117 145.500 0.001 1 39 127
	i 8.928 145.500 0.001 1 49 127
	i 9.982 145.500 0.001 1 49 127
	i 4.144 145.500 0.001 1 37 127
	i 11.210 145.508 -1.000 1 36 91
	i -11.209 145.517 0
	i 9.983 145.561 0.001 1 49 127
	i 9.984 145.624 0.001 1 49 127
	i 8.929 145.624 0.001 1 49 127
	i 9.985 145.687 0.001 1 49 127
	i 6.087 145.749 0.001 1 37 127
	i 9.986 145.749 0.001 1 49 127
	i 5.087 145.749 0.001 1 37 127
	i 8.930 145.749 0.001 1 49 127
	i 9.987 145.812 0.001 1 49 127
	i 9.988 145.875 0.001 1 49 127
	i 8.931 145.875 0.001 1 49 113
	i 9.989 145.937 0.001 1 49 127
	i 4.145 146.000 0.001 1 37 127
	i 6.088 146.000 0.001 1 37 127
	i 5.088 146.000 0.001 1 37 127
	i 8.932 146.000 0.001 1 49 127
	i 9.990 146.000 0.001 1 49 127
	i -10.149 146.000 0
	i -10.150 146.000 0
	i -11.210 146.000 0
	i 11.211 146.000 -1.000 1 38 81
	i 9.991 146.061 0.001 1 49 127
	i 8.933 146.124 0.001 1 49 127
	i 9.992 146.124 0.001 1 49 127
	i 9.993 146.187 0.001 1 49 127
	i 8.934 146.249 0.001 1 49 127
	i 9.994 146.249 0.001 1 49 127
	i 9.995 146.312 0.001 1 49 127
	i 8.935 146.375 0.001 1 49 127
	i 9.996 146.375 0.001 1 49 127
	i 9.997 146.437 0.001 1 49 127
	i 8.936 146.500 0.001 1 49 127
	i 9.998 146.500 0.001 1 49 127
	i 7.118 146.500 0.001 1 39 127
	i 4.146 146.500 0.001 1 37 127
	i 9.999 146.561 0.001 1 49 127
	i 9.001 146.624 0.001 1 49 127
	i 8.937 146.624 0.001 1 49 127
	i 9.002 146.687 0.001 1 49 127
	i 11.212 146.737 -1.000 1 41 89
	i -11.211 146.744 0
	i 8.938 146.749 0.001 1 49 127
	i 9.003 146.749 0.001 1 49 127
	i 9.004 146.812 0.001 1 49 127
	i 9.005 146.875 0.001 1 49 127
	i 8.939 146.875 0.001 1 49 127
	i 9.006 146.937 0.001 1 49 127
	i 4.147 147.000 0.001 1 37 127
	i 10.151 147.000 -1.000 1 72 127
	i 10.152 147.000 -1.000 1 76 127
	i 8.940 147.000 0.001 1 49 127
	i 9.007 147.000 0.001 1 49 127
	i 9.008 147.061 0.001 1 49 127
	i 8.941 147.124 0.001 1 49 127
	i 9.009 147.124 0.001 1 49 127
	i 9.010 147.187 0.001 1 49 127
	i 8.942 147.249 0.001 1 49 127
	i 9.011 147.249 0.001 1 49 127
	i 11.213 147.255 -1.000 1 38 68
	i -11.212 147.260 0
	i 9.012 147.312 0.001 1 49 127
	i 9.013 147.375 0.001 1 49 127
	i 8.943 147.375 0.001 1 49 127
	i 9.014 147.437 0.001 1 49 127
	i 4.148 147.500 0.001 1 37 127
	i 7.119 147.500 0.001 1 39 127
	i 8.944 147.500 0.001 1 49 127
	i 9.015 147.500 0.001 1 49 127
	i 11.214 147.501 -1.000 1 41 78
	i -11.213 147.509 0
	i 9.016 147.561 0.001 1 49 127
	i 9.017 147.624 0.001 1 49 127
	i 8.945 147.624 0.001 1 49 127
	i 9.018 147.687 0.001 1 49 127
	i 9.019 147.749 0.001 1 49 127
	i 8.946 147.749 0.001 1 49 127
	i 5.089 147.749 0.001 1 37 127
	i 6.089 147.749 0.001 1 37 127
	i 9.020 147.812 0.001 1 49 127
	i 8.947 147.875 0.001 1 49 113
	i 9.021 147.875 0.001 1 49 127
	i 9.022 147.937 0.001 1 49 127
	i 4.149 148.000 0.001 1 37 127
	i 5.090 148.000 0.001 1 37 127
	i 8.948 148.000 0.001 1 49 127
	i 9.023 148.000 0.001 1 49 127
	i 6.090 148.000 0.001 1 37 127
	i -10.151 147.999 0
	i -10.152 147.999 0
	i 11.215 148.012 -1.000 1 38 78
	i -11.214 148.031 0
	i 9.024 148.061 0.001 1 49 127
	i 8.949 148.124 0.001 1 49 127
	i 9.025 148.124 0.001 1 49 127
	i 9.026 148.187 0.001 1 49 127
	i 8.950 148.249 0.001 1 49 127
	i 9.027 148.249 0.001 1 49 127
	i 9.028 148.312 0.001 1 49 127
	i 8.951 148.375 0.001 1 49 127
	i 9.029 148.375 0.001 1 49 127
	i 9.030 148.437 0.001 1 49 127
	i 4.150 148.500 0.001 1 37 127
	i 7.120 148.500 0.001 1 39 127
	i 8.952 148.500 0.001 1 49 127
	i 9.031 148.500 0.001 1 49 127
	i 9.032 148.561 0.001 1 49 127
	i 8.953 148.624 0.001 1 49 127
	i 9.033 148.624 0.001 1 49 127
	i 9.034 148.687 0.001 1 49 127
	i 9.035 148.749 0.001 1 49 127
	i 8.954 148.749 0.001 1 49 127
	i 11.216 148.760 -1.000 1 36 86
	i -11.215 148.768 0
	i 9.036 148.812 0.001 1 49 127
	i 8.955 148.875 0.001 1 49 127
	i 9.037 148.875 0.001 1 49 127
	i 9.038 148.937 0.001 1 49 127
	i 4.151 149.000 0.001 1 37 127
	i 9.039 149.000 0.001 1 49 127
	i 8.956 149.000 0.001 1 49 127
	i 10.153 149.000 -1.000 1 72 127
	i 10.154 149.000 -1.000 1 76 127
	i 9.040 149.061 0.001 1 49 127
	i 8.957 149.124 0.001 1 49 127
	i 9.041 149.124 0.001 1 49 127
	i 9.042 149.187 0.001 1 49 127
	i 9.043 149.249 0.001 1 49 127
	i 8.958 149.249 0.001 1 49 127
	i -11.216 149.257 0
	i 11.217 149.259 -1.000 1 33 74
	i 9.044 149.312 0.001 1 49 127
	i 9.045 149.375 0.001 1 49 127
	i 8.959 149.375 0.001 1 49 127
	i 9.046 149.437 0.001 1 49 127
	i 7.121 149.500 0.001 1 39 127
	i 9.047 149.500 0.001 1 49 127
	i 8.960 149.500 0.001 1 49 127
	i 4.152 149.500 0.001 1 37 127
	i 11.218 149.508 -1.000 1 36 91
	i -11.217 149.517 0
	i 9.048 149.561 0.001 1 49 127
	i 9.049 149.624 0.001 1 49 127
	i 8.961 149.624 0.001 1 49 127
	i 9.050 149.687 0.001 1 49 127
	i 5.091 149.749 0.001 1 37 127
	i 6.091 149.749 0.001 1 37 127
	i 9.051 149.749 0.001 1 49 127
	i 8.962 149.749 0.001 1 49 127
	i 9.052 149.812 0.001 1 49 127
	i 9.053 149.875 0.001 1 49 127
	i 8.963 149.875 0.001 1 49 113
	i 9.054 149.937 0.001 1 49 127
	i -11.218 149.999 0
	i -10.153 150.000 0
	i -10.154 150.000 0
	i 11.219 150.000 -1.000 1 38 83
	i 4.153 150.000 0.001 1 37 127
	i 6.092 150.000 0.001 1 37 127
	i 5.092 150.000 0.001 1 37 127
	i 8.964 150.000 0.001 1 49 127
	i 9.055 150.000 0.001 1 49 127
	i 9.056 150.061 0.001 1 49 127
	i 8.965 150.124 0.001 1 49 127
	i 9.057 150.124 0.001 1 49 127
	i 9.058 150.187 0.001 1 49 127
	i 9.059 150.249 0.001 1 49 127
	i 8.966 150.249 0.001 1 49 127
	i 9.060 150.312 0.001 1 49 127
	i 8.967 150.375 0.001 1 49 127
	i 9.061 150.375 0.001 1 49 127
	i 9.062 150.437 0.001 1 49 127
	i 4.154 150.500 0.001 1 37 127
	i 7.122 150.500 0.001 1 39 127
	i 8.968 150.500 0.001 1 49 127
	i 9.063 150.500 0.001 1 49 127
	i 9.064 150.561 0.001 1 49 127
	i 8.969 150.624 0.001 1 49 127
	i 9.065 150.624 0.001 1 49 127
	i 9.066 150.687 0.001 1 49 127
	i 11.220 150.737 -1.000 1 41 103
	i -11.219 150.756 0
	i 8.970 150.749 0.001 1 49 127
	i 9.067 150.749 0.001 1 49 127
	i 9.068 150.812 0.001 1 49 127
	i 8.971 150.875 0.001 1 49 127
	i 9.069 150.875 0.001 1 49 127
	i 9.070 150.937 0.001 1 49 127
	i 8.972 151.000 0.001 1 49 127
	i 10.155 151.000 -1.000 1 72 127
	i 10.156 151.000 -1.000 1 76 127
	i 4.155 151.000 0.001 1 37 127
	i 9.071 151.000 0.001 1 49 127
	i 9.072 151.061 0.001 1 49 127
	i 9.073 151.124 0.001 1 49 127
	i 8.973 151.124 0.001 1 49 127
	i 9.074 151.187 0.001 1 49 127
	i 11.221 151.223 -1.000 1 44 76
	i -11.220 151.235 0
	i 9.075 151.249 0.001 1 49 127
	i 8.974 151.249 0.001 1 49 127
	i 9.076 151.312 0.001 1 49 127
	i 8.975 151.375 0.001 1 49 127
	i 9.077 151.375 0.001 1 49 127
	i 9.078 151.437 0.001 1 49 127
	i 9.079 151.500 0.001 1 49 127
	i 4.156 151.500 0.001 1 37 127
	i 7.123 151.500 0.001 1 39 127
	i 8.976 151.500 0.001 1 49 127
	i -11.221 151.523 0
	i 11.222 151.523 -1.000 1 43 89
	i 9.080 151.561 0.001 1 49 127
	i 8.977 151.624 0.001 1 49 127
	i 9.081 151.624 0.001 1 49 127
	i 9.082 151.687 0.001 1 49 127
	i 5.093 151.749 0.001 1 37 127
	i 8.978 151.749 0.001 1 49 127
	i 9.083 151.749 0.001 1 49 127
	i 6.093 151.749 0.001 1 37 127
	i 9.084 151.812 0.001 1 49 127
	i 8.979 151.875 0.001 1 49 113
	i 9.085 151.875 0.001 1 49 127
	i 9.086 151.937 0.001 1 49 127
	i -11.222 151.997 0
	i 4.157 152.000 0.001 1 37 127
	i 11.223 151.997 -1.000 1 41 97
	i 6.094 152.000 0.001 1 37 127
	i 5.094 152.000 0.001 1 37 127
	i 8.980 152.000 0.001 1 49 127
	i 9.087 152.000 0.001 1 49 127
	i -10.155 151.999 0
	i -10.156 151.999 0
	i 9.088 152.061 0.001 1 49 127
	i 9.089 152.124 0.001 1 49 127
	i 8.981 152.124 0.001 1 49 127
	i 9.090 152.187 0.001 1 49 127
	i 8.982 152.249 0.001 1 49 127
	i 9.091 152.249 0.001 1 49 127
	i 9.092 152.312 0.001 1 49 127
	i 9.093 152.375 0.001 1 49 127
	i 8.983 152.375 0.001 1 49 127
	i 9.094 152.437 0.001 1 49 127
	i 4.158 152.500 0.001 1 37 127
	i 8.984 152.500 0.001 1 49 127
	i 7.124 152.500 0.001 1 39 127
	i 9.095 152.500 0.001 1 49 127
	i 9.096 152.561 0.001 1 49 127
	i 8.985 152.624 0.001 1 49 127
	i 9.097 152.624 0.001 1 49 127
	i 9.098 152.687 0.001 1 49 127
	i 8.986 152.749 0.001 1 49 127
	i 9.099 152.749 0.001 1 49 127
	i -11.223 152.756 0
	i 11.224 152.759 -1.000 1 38 80
	i 9.100 152.812 0.001 1 49 127
	i 8.987 152.875 0.001 1 49 127
	i 9.101 152.875 0.001 1 49 127
	i 9.102 152.937 0.001 1 49 127
	i 9.103 153.000 0.001 1 49 127
	i 10.157 153.000 -1.000 1 72 127
	i 10.158 153.000 -1.000 1 76 127
	i 4.159 153.000 0.001 1 37 127
	i 8.988 153.000 0.001 1 49 127
	i 9.104 153.061 0.001 1 49 127
	i 9.105 153.124 0.001 1 49 127
	i 8.989 153.124 0.001 1 49 127
	i 9.106 153.187 0.001 1 49 127
	i 11.225 153.205 -1.000 1 33 79
	i -11.224 153.229 0
	i 8.990 153.249 0.001 1 49 127
	i 9.107 153.249 0.001 1 49 127
	i 9.108 153.312 0.001 1 49 127
	i 9.109 153.375 0.001 1 49 127
	i 8.991 153.375 0.001 1 49 127
	i 9.110 153.437 0.001 1 49 127
	i 9.111 153.500 0.001 1 49 127
	i 7.125 153.500 0.001 1 39 127
	i 4.160 153.500 0.001 1 37 127
	i 8.992 153.500 0.001 1 49 127
	i 11.226 153.507 -1.000 1 36 89
	i -11.225 153.508 0
	i 9.112 153.561 0.001 1 49 127
	i 9.113 153.624 0.001 1 49 127
	i 8.993 153.624 0.001 1 49 127
	i 9.114 153.687 0.001 1 49 127
	i 6.095 153.749 0.001 1 37 127
	i 8.994 153.749 0.001 1 49 127
	i 9.115 153.749 0.001 1 49 127
	i 5.095 153.749 0.001 1 37 127
	i 9.116 153.812 0.001 1 49 127
	i 9.117 153.875 0.001 1 49 127
	i 8.995 153.875 0.001 1 49 113
	i 9.118 153.937 0.001 1 49 127
	i 5.096 154.000 0.001 1 37 127
	i 4.161 154.000 0.001 1 37 127
	i 6.096 154.000 0.001 1 37 127
	i 8.996 154.000 0.001 1 49 127
	i 9.119 154.000 0.001 1 49 127
	i -10.157 154.000 0
	i -10.158 154.000 0
	i -11.226 153.999 0
	i 11.227 154.000 -1.000 1 38 81
	i 9.120 154.061 0.001 1 49 127
	i 9.121 154.124 0.001 1 49 127
	i 8.997 154.124 0.001 1 49 127
	i 9.122 154.187 0.001 1 49 127
	i 8.998 154.249 0.001 1 49 127
	i 9.123 154.249 0.001 1 49 127
	i 9.124 154.312 0.001 1 49 127
	i 9.125 154.375 0.001 1 49 127
	i 8.999 154.375 0.001 1 49 127
	i 9.126 154.437 0.001 1 49 127
	i 4.162 154.500 0.001 1 37 127
	i 7.126 154.500 0.001 1 39 127
	i 8.001 154.500 0.001 1 49 127
	i 9.127 154.500 0.001 1 49 127
	i 9.128 154.561 0.001 1 49 127
	i 9.129 154.624 0.001 1 49 127
	i 8.002 154.624 0.001 1 49 127
	i 9.130 154.687 0.001 1 49 127
	i 11.228 154.737 -1.000 1 41 89
	i -11.227 154.744 0
	i 8.003 154.749 0.001 1 49 127
	i 9.131 154.749 0.001 1 49 127
	i 9.132 154.812 0.001 1 49 127
	i 9.133 154.875 0.001 1 49 127
	i 8.004 154.875 0.001 1 49 127
	i 9.134 154.937 0.001 1 49 127
	i 4.163 155.000 0.001 1 37 127
	i 9.135 155.000 0.001 1 49 127
	i 8.005 155.000 0.001 1 49 127
	i 10.159 155.000 -1.000 1 72 127
	i 10.160 155.000 -1.000 1 76 127
	i 9.136 155.061 0.001 1 49 127
	i 9.137 155.124 0.001 1 49 127
	i 8.006 155.124 0.001 1 49 127
	i 9.138 155.187 0.001 1 49 127
	i 9.139 155.249 0.001 1 49 127
	i 8.007 155.249 0.001 1 49 127
	i 11.229 155.255 -1.000 1 38 68
	i -11.228 155.260 0
	i 9.140 155.312 0.001 1 49 127
	i 8.008 155.375 0.001 1 49 127
	i 9.141 155.375 0.001 1 49 127
	i 9.142 155.437 0.001 1 49 127
	i 8.009 155.500 0.001 1 49 127
	i 11.230 155.501 -1.000 1 41 78
	i 7.127 155.500 0.001 1 39 127
	i 4.164 155.500 0.001 1 37 127
	i 9.143 155.500 0.001 1 49 127
	i -11.229 155.509 0
	i 9.144 155.561 0.001 1 49 127
	i 8.010 155.624 0.001 1 49 127
	i 9.145 155.624 0.001 1 49 127
	i 9.146 155.687 0.001 1 49 127
	i 6.097 155.749 0.001 1 37 127
	i 9.147 155.749 0.001 1 49 127
	i 8.011 155.749 0.001 1 49 127
	i 5.097 155.749 0.001 1 37 127
	i 9.148 155.812 0.001 1 49 127
	i 8.012 155.875 0.001 1 49 113
	i 9.149 155.875 0.001 1 49 127
	i 9.150 155.937 0.001 1 49 127
	i -10.159 155.999 0
	i -10.160 155.999 0
	i 8.013 156.000 0.001 1 49 127
	i 6.098 156.000 0.001 1 37 127
	i 4.165 156.000 0.001 1 37 127
	i 5.098 156.000 0.001 1 37 127
	i 9.151 156.000 0.001 1 49 127
	i 11.231 156.012 -1.000 1 38 78
	i -11.230 156.031 0
	i 9.152 156.061 0.001 1 49 127
	i 8.014 156.124 0.001 1 49 127
	i 9.153 156.124 0.001 1 49 127
	i 9.154 156.187 0.001 1 49 127
	i 8.015 156.249 0.001 1 49 127
	i 9.155 156.249 0.001 1 49 127
	i 9.156 156.312 0.001 1 49 127
	i 9.157 156.375 0.001 1 49 127
	i 8.016 156.375 0.001 1 49 127
	i 9.158 156.437 0.001 1 49 127
	i 9.159 156.500 0.001 1 49 127
	i 7.128 156.500 0.001 1 39 127
	i 4.166 156.500 0.001 1 37 127
	i 8.017 156.500 0.001 1 49 127
	i 9.160 156.561 0.001 1 49 127
	i 8.018 156.624 0.001 1 49 127
	i 9.161 156.624 0.001 1 49 127
	i 9.162 156.687 0.001 1 49 127
	i 8.019 156.749 0.001 1 49 127
	i 9.163 156.749 0.001 1 49 127
	i 11.232 156.760 -1.000 1 36 86
	i -11.231 156.768 0
	i 9.164 156.812 0.001 1 49 127
	i 8.020 156.875 0.001 1 49 127
	i 9.165 156.875 0.001 1 49 127
	i 9.166 156.937 0.001 1 49 127
	i 9.167 157.000 0.001 1 49 127
	i 8.021 157.000 0.001 1 49 127
	i 10.161 157.000 -1.000 1 72 127
	i 4.167 157.000 0.001 1 37 127
	i 10.162 157.000 -1.000 1 76 127
	i 9.168 157.061 0.001 1 49 127
	i 8.022 157.124 0.001 1 49 127
	i 9.169 157.124 0.001 1 49 127
	i 9.170 157.187 0.001 1 49 127
	i 8.023 157.249 0.001 1 49 127
	i 9.171 157.249 0.001 1 49 127
	i -11.232 157.257 0
	i 11.233 157.259 -1.000 1 33 74
	i 9.172 157.312 0.001 1 49 127
	i 8.024 157.375 0.001 1 49 127
	i 9.173 157.375 0.001 1 49 127
	i 9.174 157.437 0.001 1 49 127
	i 4.168 157.500 0.001 1 37 127
	i 9.175 157.500 0.001 1 49 127
	i 8.025 157.500 0.001 1 49 127
	i 7.129 157.500 0.001 1 39 127
	i 11.234 157.508 -1.000 1 36 91
	i -11.233 157.517 0
	i 9.176 157.561 0.001 1 49 127
	i 8.026 157.624 0.001 1 49 127
	i 9.177 157.624 0.001 1 49 127
	i 9.178 157.687 0.001 1 49 127
	i 6.099 157.749 0.001 1 37 127
	i 5.099 157.749 0.001 1 37 127
	i 8.027 157.749 0.001 1 49 127
	i 9.179 157.749 0.001 1 49 127
	i 9.180 157.812 0.001 1 49 127
	i 9.181 157.875 0.001 1 49 127
	i 8.028 157.875 0.001 1 49 113
	i 9.182 157.937 0.001 1 49 127
	i -10.161 158.000 0
	i 4.169 158.000 0.001 1 37 127
	i 9.183 158.000 0.001 1 49 127
	i -10.162 158.000 0
	i 5.100 158.000 0.001 1 37 127
	i -11.234 157.999 0
	i 11.235 158.000 -1.000 1 38 83
	i 6.100 158.000 0.001 1 37 127
	i 8.029 158.000 0.001 1 49 127
	i 9.184 158.061 0.001 1 49 127
	i 9.185 158.124 0.001 1 49 127
	i 8.030 158.124 0.001 1 49 127
	i 9.186 158.187 0.001 1 49 127
	i 8.031 158.249 0.001 1 49 127
	i 9.187 158.249 0.001 1 49 127
	i 9.188 158.312 0.001 1 49 127
	i 9.189 158.375 0.001 1 49 127
	i 8.032 158.375 0.001 1 49 127
	i 9.190 158.437 0.001 1 49 127
	i 4.170 158.500 0.001 1 37 127
	i 8.033 158.500 0.001 1 49 127
	i 9.191 158.500 0.001 1 49 127
	i 7.130 158.500 0.001 1 39 127
	i 9.192 158.561 0.001 1 49 127
	i 9.193 158.624 0.001 1 49 127
	i 8.034 158.624 0.001 1 49 127
	i 9.194 158.687 0.001 1 49 127
	i 11.236 158.737 -1.000 1 41 103
	i -11.235 158.756 0
	i 9.195 158.749 0.001 1 49 127
	i 8.035 158.749 0.001 1 49 127
	i 9.196 158.812 0.001 1 49 127
	i 8.036 158.875 0.001 1 49 127
	i 9.197 158.875 0.001 1 49 127
	i 9.198 158.937 0.001 1 49 127
	i 4.171 159.000 0.001 1 37 127
	i 8.037 159.000 0.001 1 49 127
	i 10.163 159.000 -1.000 1 72 127
	i 10.164 159.000 -1.000 1 76 127
	i 9.199 159.000 0.001 1 49 127
	i 9.200 159.061 0.001 1 49 127
	i 9.201 159.124 0.001 1 49 127
	i 8.038 159.124 0.001 1 49 127
	i 9.202 159.187 0.001 1 49 127
	i 11.237 159.223 -1.000 1 44 76
	i -11.236 159.235 0
	i 8.039 159.249 0.001 1 49 127
	i 9.203 159.249 0.001 1 49 127
	i 9.204 159.312 0.001 1 49 127
	i 8.040 159.375 0.001 1 49 127
	i 9.205 159.375 0.001 1 49 127
	i 9.206 159.437 0.001 1 49 127
	i 9.207 159.500 0.001 1 49 127
	i 8.041 159.500 0.001 1 49 127
	i 4.172 159.500 0.001 1 37 127
	i 7.131 159.500 0.001 1 39 127
	i -11.237 159.523 0
	i 11.238 159.523 -1.000 1 43 89
	i 9.208 159.561 0.001 1 49 127
	i 8.042 159.624 0.001 1 49 127
	i 9.209 159.624 0.001 1 49 127
	i 9.210 159.687 0.001 1 49 127
	i 9.211 159.749 0.001 1 49 127
	i 6.101 159.749 0.001 1 37 127
	i 8.043 159.749 0.001 1 49 127
	i 5.101 159.749 0.001 1 37 127
	i 9.212 159.812 0.001 1 49 127
	i 8.044 159.875 0.001 1 49 113
	i 9.213 159.875 0.001 1 49 127
	i 9.214 159.937 0.001 1 49 127
	i 6.102 160.000 0.001 1 37 127
	i 4.173 160.000 0.001 1 37 127
	i 8.045 160.000 0.001 1 49 127
	i -11.238 159.997 0
	i 11.239 159.997 -1.000 1 41 97
	i -10.163 159.999 0
	i -10.164 159.999 0
	i 9.215 160.000 0.001 1 49 127
	i 5.102 160.000 0.001 1 37 127
	i 9.216 160.061 0.001 1 49 127
	i 8.046 160.124 0.001 1 49 127
	i 9.217 160.124 0.001 1 49 127
	i 9.218 160.187 0.001 1 49 127
	i 8.047 160.249 0.001 1 49 127
	i 9.219 160.249 0.001 1 49 127
	i 9.220 160.312 0.001 1 49 127
	i 9.221 160.375 0.001 1 49 127
	i 8.048 160.375 0.001 1 49 127
	i 9.222 160.437 0.001 1 49 127
	i 9.223 160.500 0.001 1 49 127
	i 4.174 160.500 0.001 1 37 127
	i 7.132 160.500 0.001 1 39 127
	i 8.049 160.500 0.001 1 49 127
	i 9.224 160.561 0.001 1 49 127
	i 9.225 160.624 0.001 1 49 127
	i 8.050 160.624 0.001 1 49 127
	i 9.226 160.687 0.001 1 49 127
	i 9.227 160.749 0.001 1 49 127
	i 8.051 160.749 0.001 1 49 127
	i -11.239 160.756 0
	i 11.240 160.759 -1.000 1 38 80
	i 9.228 160.812 0.001 1 49 127
	i 9.229 160.875 0.001 1 49 127
	i 8.052 160.875 0.001 1 49 127
	i 9.230 160.937 0.001 1 49 127
	i 4.175 161.000 0.001 1 37 127
	i 9.231 161.000 0.001 1 49 127
	i 8.053 161.000 0.001 1 49 127
	i 10.165 161.000 -1.000 1 72 127
	i 10.166 161.000 -1.000 1 76 127
	i 9.232 161.061 0.001 1 49 127
	i 8.054 161.124 0.001 1 49 127
	i 9.233 161.124 0.001 1 49 127
	i 9.234 161.187 0.001 1 49 127
	i 11.241 161.205 -1.000 1 33 79
	i -11.240 161.229 0
	i 8.055 161.249 0.001 1 49 127
	i 9.235 161.249 0.001 1 49 127
	i 9.236 161.312 0.001 1 49 127
	i 8.056 161.375 0.001 1 49 127
	i 9.237 161.375 0.001 1 49 127
	i 9.238 161.437 0.001 1 49 127
	i 4.176 161.500 0.001 1 37 127
	i 8.057 161.500 0.001 1 49 127
	i 9.239 161.500 0.001 1 49 127
	i 7.133 161.500 0.001 1 39 127
	i 11.242 161.507 -1.000 1 36 89
	i -11.241 161.508 0
	i 9.240 161.561 0.001 1 49 127
	i 8.058 161.624 0.001 1 49 127
	i 9.241 161.624 0.001 1 49 127
	i 9.242 161.687 0.001 1 49 127
	i 8.059 161.749 0.001 1 49 127
	i 5.103 161.749 0.001 1 37 127
	i 6.103 161.749 0.001 1 37 127
	i 9.243 161.749 0.001 1 49 127
	i 9.244 161.812 0.001 1 49 127
	i 8.060 161.875 0.001 1 49 113
	i 9.245 161.875 0.001 1 49 127
	i 9.246 161.937 0.001 1 49 127
	i -11.242 161.999 0
	i -10.165 162.000 0
	i 9.247 162.000 0.001 1 49 127
	i -10.166 162.000 0
	i 4.177 162.000 0.001 1 37 127
	i 11.243 162.000 -1.000 1 38 81
	i 6.104 162.000 0.001 1 37 127
	i 5.104 162.000 0.001 1 37 127
	i 8.061 162.000 0.001 1 49 127
	i 9.248 162.061 0.001 1 49 127
	i 8.062 162.124 0.001 1 49 127
	i 9.249 162.124 0.001 1 49 127
	i 9.250 162.187 0.001 1 49 127
	i 9.251 162.249 0.001 1 49 127
	i 8.063 162.249 0.001 1 49 127
	i 9.252 162.312 0.001 1 49 127
	i 8.064 162.375 0.001 1 49 127
	i 9.253 162.375 0.001 1 49 127
	i 9.254 162.437 0.001 1 49 127
	i 4.178 162.500 0.001 1 37 127
	i 7.134 162.500 0.001 1 39 127
	i 8.065 162.500 0.001 1 49 127
	i 9.255 162.500 0.001 1 49 127
	i 9.256 162.561 0.001 1 49 127
	i 9.257 162.624 0.001 1 49 127
	i 8.066 162.624 0.001 1 49 127
	i 9.258 162.687 0.001 1 49 127
	i 11.244 162.737 -1.000 1 41 89
	i -11.243 162.744 0
	i 8.067 162.749 0.001 1 49 127
	i 9.259 162.749 0.001 1 49 127
	i 9.260 162.812 0.001 1 49 127
	i 9.261 162.875 0.001 1 49 127
	i 8.068 162.875 0.001 1 49 127
	i 9.262 162.937 0.001 1 49 127
	i 9.263 163.000 0.001 1 49 127
	i 8.069 163.000 0.001 1 49 127
	i 4.179 163.000 0.001 1 37 127
	i 10.167 163.000 -1.000 1 72 127
	i 10.168 163.000 -1.000 1 76 127
	i 9.264 163.061 0.001 1 49 127
	i 8.070 163.124 0.001 1 49 127
	i 9.265 163.124 0.001 1 49 127
	i 9.266 163.187 0.001 1 49 127
	i 9.267 163.249 0.001 1 49 127
	i 8.071 163.249 0.001 1 49 127
	i 11.245 163.255 -1.000 1 38 68
	i -11.244 163.260 0
	i 9.268 163.312 0.001 1 49 127
	i 8.072 163.375 0.001 1 49 127
	i 9.269 163.375 0.001 1 49 127
	i 9.270 163.437 0.001 1 49 127
	i 11.246 163.501 -1.000 1 41 78
	i 8.073 163.500 0.001 1 49 127
	i 7.135 163.500 0.001 1 39 127
	i 9.271 163.500 0.001 1 49 127
	i 4.180 163.500 0.001 1 37 127
	i -11.245 163.509 0
	i 9.272 163.561 0.001 1 49 127
	i 9.273 163.624 0.001 1 49 127
	i 8.074 163.624 0.001 1 49 127
	i 9.274 163.687 0.001 1 49 127
	i 5.105 163.749 0.001 1 37 127
	i 8.075 163.749 0.001 1 49 127
	i 9.275 163.749 0.001 1 49 127
	i 6.105 163.749 0.001 1 37 127
	i 9.276 163.812 0.001 1 49 127
	i 8.076 163.875 0.001 1 49 113
	i 9.277 163.875 0.001 1 49 127
	i 9.278 163.937 0.001 1 49 127
	i 4.181 164.000 0.001 1 37 127
	i 5.106 164.000 0.001 1 37 127
	i 8.077 164.000 0.001 1 49 127
	i 9.279 164.000 0.001 1 49 127
	i -10.167 163.999 0
	i -10.168 163.999 0
	i 6.106 164.000 0.001 1 37 127
	i 11.247 164.012 -1.000 1 38 78
	i -11.246 164.031 0
	i 9.280 164.061 0.001 1 49 127
	i 9.281 164.124 0.001 1 49 127
	i 8.078 164.124 0.001 1 49 127
	i 9.282 164.187 0.001 1 49 127
	i 8.079 164.249 0.001 1 49 127
	i 9.283 164.249 0.001 1 49 127
	i 9.284 164.312 0.001 1 49 127
	i 8.080 164.375 0.001 1 49 127
	i 9.285 164.375 0.001 1 49 127
	i 9.286 164.437 0.001 1 49 127
	i 4.182 164.500 0.001 1 37 127
	i 7.136 164.500 0.001 1 39 127
	i 8.081 164.500 0.001 1 49 127
	i 9.287 164.500 0.001 1 49 127
	i 9.288 164.561 0.001 1 49 127
	i 9.289 164.624 0.001 1 49 127
	i 8.082 164.624 0.001 1 49 127
	i 9.290 164.687 0.001 1 49 127
	i 8.083 164.749 0.001 1 49 127
	i 9.291 164.749 0.001 1 49 127
	i 11.248 164.760 -1.000 1 36 86
	i -11.247 164.768 0
	i 9.292 164.812 0.001 1 49 127
	i 8.084 164.875 0.001 1 49 127
	i 9.293 164.875 0.001 1 49 127
	i 9.294 164.937 0.001 1 49 127
	i 9.295 165.000 0.001 1 49 127
	i 4.183 165.000 0.001 1 37 127
	i 10.169 165.000 -1.000 1 72 127
	i 10.170 165.000 -1.000 1 76 127
	i 8.085 165.000 0.001 1 49 127
	i 9.296 165.061 0.001 1 49 127
	i 8.086 165.124 0.001 1 49 127
	i 9.297 165.124 0.001 1 49 127
	i 9.298 165.187 0.001 1 49 127
	i 8.087 165.249 0.001 1 49 127
	i 9.299 165.249 0.001 1 49 127
	i -11.248 165.257 0
	i 11.249 165.259 -1.000 1 33 74
	i 9.300 165.312 0.001 1 49 127
	i 9.301 165.375 0.001 1 49 127
	i 8.088 165.375 0.001 1 49 127
	i 9.302 165.437 0.001 1 49 127
	i 8.089 165.500 0.001 1 49 127
	i 7.137 165.500 0.001 1 39 127
	i 4.184 165.500 0.001 1 37 127
	i 9.303 165.500 0.001 1 49 127
	i 11.250 165.508 -1.000 1 36 91
	i -11.249 165.517 0
	i 9.304 165.561 0.001 1 49 127
	i 9.305 165.624 0.001 1 49 127
	i 8.090 165.624 0.001 1 49 127
	i 9.306 165.687 0.001 1 49 127
	i 5.107 165.749 0.001 1 37 127
	i 8.091 165.749 0.001 1 49 127
	i 9.307 165.749 0.001 1 49 127
	i 6.107 165.749 0.001 1 37 127
	i 9.308 165.812 0.001 1 49 127
	i 8.092 165.875 0.001 1 49 113
	i 9.309 165.875 0.001 1 49 127
	i 9.310 165.937 0.001 1 49 127
	i -11.250 165.999 0
	i 4.185 166.000 0.001 1 37 127
	i 11.251 166.000 -1.000 1 38 83
	i 5.108 166.000 0.001 1 37 127
	i 6.108 166.000 0.001 1 37 127
	i 9.311 166.000 0.001 1 49 127
	i 8.093 166.000 0.001 1 49 127
	i -10.169 166.000 0
	i -10.170 166.000 0
	i 9.312 166.061 0.001 1 49 127
	i 9.313 166.124 0.001 1 49 127
	i 8.094 166.124 0.001 1 49 127
	i 9.314 166.187 0.001 1 49 127
	i 9.315 166.249 0.001 1 49 127
	i 8.095 166.249 0.001 1 49 127
	i 9.316 166.312 0.001 1 49 127
	i 8.096 166.375 0.001 1 49 127
	i 9.317 166.375 0.001 1 49 127
	i 9.318 166.437 0.001 1 49 127
	i 8.097 166.500 0.001 1 49 127
	i 7.138 166.500 0.001 1 39 127
	i 4.186 166.500 0.001 1 37 127
	i 9.319 166.500 0.001 1 49 127
	i 9.320 166.561 0.001 1 49 127
	i 8.098 166.624 0.001 1 49 127
	i 9.321 166.624 0.001 1 49 127
	i 9.322 166.687 0.001 1 49 127
	i 11.252 166.737 -1.000 1 41 103
	i 8.099 166.749 0.001 1 49 127
	i 9.323 166.749 0.001 1 49 127
	i -11.251 166.756 0
	i 9.324 166.812 0.001 1 49 127
	i 9.325 166.875 0.001 1 49 127
	i 8.100 166.875 0.001 1 49 127
	i 9.326 166.937 0.001 1 49 127
	i 10.171 167.000 -1.000 1 72 127
	i 10.172 167.000 -1.000 1 76 127
	i 4.187 167.000 0.001 1 37 127
	i 9.327 167.000 0.001 1 49 127
	i 8.101 167.000 0.001 1 49 127
	i 9.328 167.061 0.001 1 49 127
	i 8.102 167.124 0.001 1 49 127
	i 9.329 167.124 0.001 1 49 127
	i 9.330 167.187 0.001 1 49 127
	i 11.253 167.223 -1.000 1 44 76
	i -11.252 167.235 0
	i 8.103 167.249 0.001 1 49 127
	i 9.331 167.249 0.001 1 49 127
	i 9.332 167.312 0.001 1 49 127
	i 9.333 167.375 0.001 1 49 127
	i 8.104 167.375 0.001 1 49 127
	i 9.334 167.437 0.001 1 49 127
	i 4.188 167.500 0.001 1 37 127
	i 7.139 167.500 0.001 1 39 127
	i 8.105 167.500 0.001 1 49 127
	i 9.335 167.500 0.001 1 49 127
	i -11.253 167.523 0
	i 11.254 167.523 -1.000 1 43 89
	i 9.336 167.561 0.001 1 49 127
	i 9.337 167.624 0.001 1 49 127
	i 8.106 167.624 0.001 1 49 127
	i 9.338 167.687 0.001 1 49 127
	i 8.107 167.749 0.001 1 49 127
	i 6.109 167.749 0.001 1 37 127
	i 5.109 167.749 0.001 1 37 127
	i 9.339 167.749 0.001 1 49 127
	i 9.340 167.812 0.001 1 49 127
	i 9.341 167.875 0.001 1 49 127
	i 8.108 167.875 0.001 1 49 113
	i 9.342 167.937 0.001 1 49 127
	i -11.254 167.997 0
	i 4.189 168.000 0.001 1 37 127
	i 11.255 167.997 -1.000 1 41 97
	i -10.171 167.999 0
	i -10.172 167.999 0
	i 5.110 168.000 0.001 1 37 127
	i 6.110 168.000 0.001 1 37 127
	i 8.109 168.000 0.001 1 49 127
	i 9.343 168.000 0.001 1 49 127
	i 9.344 168.061 0.001 1 49 127
	i 8.110 168.124 0.001 1 49 127
	i 9.345 168.124 0.001 1 49 127
	i 9.346 168.187 0.001 1 49 127
	i 9.347 168.249 0.001 1 49 127
	i 8.111 168.249 0.001 1 49 127
	i 9.348 168.312 0.001 1 49 127
	i 9.349 168.375 0.001 1 49 127
	i 8.112 168.375 0.001 1 49 127
	i 9.350 168.437 0.001 1 49 127
	i 4.190 168.500 0.001 1 37 127
	i 7.140 168.500 0.001 1 39 127
	i 8.113 168.500 0.001 1 49 127
	i 9.351 168.500 0.001 1 49 127
	i 9.352 168.561 0.001 1 49 127
	i 8.114 168.624 0.001 1 49 127
	i 9.353 168.624 0.001 1 49 127
	i 9.354 168.687 0.001 1 49 127
	i 9.355 168.749 0.001 1 49 127
	i 8.115 168.749 0.001 1 49 127
	i -11.255 168.756 0
	i 11.256 168.759 -1.000 1 38 80
	i 9.356 168.812 0.001 1 49 127
	i 9.357 168.875 0.001 1 49 127
	i 8.116 168.875 0.001 1 49 127
	i 9.358 168.937 0.001 1 49 127
	i 4.191 169.000 0.001 1 37 127
	i 8.117 169.000 0.001 1 49 127
	i 9.359 169.000 0.001 1 49 127
	i 10.173 169.000 -1.000 1 72 127
	i 10.174 169.000 -1.000 1 76 127
	i 9.360 169.061 0.001 1 49 127
	i 8.118 169.124 0.001 1 49 127
	i 9.361 169.124 0.001 1 49 127
	i 9.362 169.187 0.001 1 49 127
	i 11.257 169.205 -1.000 1 33 79
	i -11.256 169.229 0
	i 8.119 169.249 0.001 1 49 127
	i 9.363 169.249 0.001 1 49 127
	i 9.364 169.312 0.001 1 49 127
	i 8.120 169.375 0.001 1 49 127
	i 9.365 169.375 0.001 1 49 127
	i 9.366 169.437 0.001 1 49 127
	i 4.192 169.500 0.001 1 37 127
	i 8.121 169.500 0.001 1 49 127
	i 7.141 169.500 0.001 1 39 127
	i 9.367 169.500 0.001 1 49 127
	i 11.258 169.507 -1.000 1 36 89
	i -11.257 169.508 0
	i 9.368 169.561 0.001 1 49 127
	i 9.369 169.624 0.001 1 49 127
	i 8.122 169.624 0.001 1 49 127
	i 9.370 169.687 0.001 1 49 127
	i 5.111 169.749 0.001 1 37 127
	i 8.123 169.749 0.001 1 49 127
	i 9.371 169.749 0.001 1 49 127
	i 6.111 169.749 0.001 1 37 127
	i 9.372 169.812 0.001 1 49 127
	i 9.373 169.875 0.001 1 49 127
	i 8.124 169.875 0.001 1 49 113
	i 9.374 169.937 0.001 1 49 127
	i 9.375 170.000 0.001 1 49 127
	i -10.173 170.000 0
	i -11.258 169.999 0
	i 11.259 170.000 -1.000 1 38 81
	i 4.193 170.000 0.001 1 37 127
	i 5.112 170.000 0.001 1 37 127
	i 6.112 170.000 0.001 1 37 127
	i -10.174 170.000 0
	i 8.125 170.000 0.001 1 49 127
	i 9.376 170.061 0.001 1 49 127
	i 8.126 170.124 0.001 1 49 127
	i 9.377 170.124 0.001 1 49 127
	i 9.378 170.187 0.001 1 49 127
	i 9.379 170.249 0.001 1 49 127
	i 8.127 170.249 0.001 1 49 127
	i 9.380 170.312 0.001 1 49 127
	i 9.381 170.375 0.001 1 49 127
	i 8.128 170.375 0.001 1 49 127
	i 9.382 170.437 0.001 1 49 127
	i 4.194 170.500 0.001 1 37 127
	i 7.142 170.500 0.001 1 39 127
	i 9.383 170.500 0.001 1 49 127
	i 8.129 170.500 0.001 1 49 127
	i 9.384 170.561 0.001 1 49 127
	i 8.130 170.624 0.001 1 49 127
	i 9.385 170.624 0.001 1 49 127
	i 9.386 170.687 0.001 1 49 127
	i 11.260 170.737 -1.000 1 41 89
	i -11.259 170.744 0
	i 9.387 170.749 0.001 1 49 127
	i 8.131 170.749 0.001 1 49 127
	i 9.388 170.812 0.001 1 49 127
	i 9.389 170.875 0.001 1 49 127
	i 8.132 170.875 0.001 1 49 127
	i 9.390 170.937 0.001 1 49 127
	i 4.195 171.000 0.001 1 37 127
	i 9.391 171.000 0.001 1 49 127
	i 10.175 171.000 -1.000 1 72 127
	i 10.176 171.000 -1.000 1 76 127
	i 8.133 171.000 0.001 1 49 127
	i 9.392 171.061 0.001 1 49 127
	i 8.134 171.124 0.001 1 49 127
	i 9.393 171.124 0.001 1 49 127
	i 9.394 171.187 0.001 1 49 127
	i 8.135 171.249 0.001 1 49 127
	i 9.395 171.249 0.001 1 49 127
	i 11.261 171.255 -1.000 1 38 68
	i -11.260 171.260 0
	i 9.396 171.312 0.001 1 49 127
	i 8.136 171.375 0.001 1 49 127
	i 9.397 171.375 0.001 1 49 127
	i 9.398 171.437 0.001 1 49 127
	i 11.262 171.501 -1.000 1 41 78
	i 8.137 171.500 0.001 1 49 127
	i 9.399 171.500 0.001 1 49 127
	i 4.196 171.500 0.001 1 37 127
	i 7.143 171.500 0.001 1 39 127
	i -11.261 171.509 0
	i 9.400 171.561 0.001 1 49 127
	i 8.138 171.624 0.001 1 49 127
	i 9.401 171.624 0.001 1 49 127
	i 9.402 171.687 0.001 1 49 127
	i 5.113 171.749 0.001 1 37 127
	i 8.139 171.749 0.001 1 49 127
	i 9.403 171.749 0.001 1 49 127
	i 6.113 171.749 0.001 1 37 127
	i 9.404 171.812 0.001 1 49 127
	i 8.140 171.875 0.001 1 49 113
	i 9.405 171.875 0.001 1 49 127
	i 9.406 171.937 0.001 1 49 127
	i 4.197 172.000 0.001 1 37 127
	i 5.114 172.000 0.001 1 37 127
	i 6.114 172.000 0.001 1 37 127
	i 8.141 172.000 0.001 1 49 127
	i 9.407 172.000 0.001 1 49 127
	i -10.175 171.999 0
	i -10.176 171.999 0
	i 11.263 172.012 -1.000 1 38 78
	i -11.262 172.031 0
	i 9.408 172.061 0.001 1 49 127
	i 8.142 172.124 0.001 1 49 127
	i 9.409 172.124 0.001 1 49 127
	i 9.410 172.187 0.001 1 49 127
	i 9.411 172.249 0.001 1 49 127
	i 8.143 172.249 0.001 1 49 127
	i 9.412 172.312 0.001 1 49 127
	i 8.144 172.375 0.001 1 49 127
	i 9.413 172.375 0.001 1 49 127
	i 9.414 172.437 0.001 1 49 127
	i 4.198 172.500 0.001 1 37 127
	i 7.144 172.500 0.001 1 39 127
	i 8.145 172.500 0.001 1 49 127
	i 9.415 172.500 0.001 1 49 127
	i 9.416 172.561 0.001 1 49 127
	i 9.417 172.624 0.001 1 49 127
	i 8.146 172.624 0.001 1 49 127
	i 9.418 172.687 0.001 1 49 127
	i 8.147 172.749 0.001 1 49 127
	i 9.419 172.749 0.001 1 49 127
	i 11.264 172.760 -1.000 1 36 86
	i -11.263 172.768 0
	i 9.420 172.812 0.001 1 49 127
	i 8.148 172.875 0.001 1 49 127
	i 9.421 172.875 0.001 1 49 127
	i 9.422 172.937 0.001 1 49 127
	i 10.177 173.000 -1.000 1 72 127
	i 10.178 173.000 -1.000 1 76 127
	i 4.199 173.000 0.001 1 37 127
	i 9.423 173.000 0.001 1 49 127
	i 8.149 173.000 0.001 1 49 127
	i 9.424 173.061 0.001 1 49 127
	i 8.150 173.124 0.001 1 49 127
	i 9.425 173.124 0.001 1 49 127
	i 9.426 173.187 0.001 1 49 127
	i 8.151 173.249 0.001 1 49 127
	i 9.427 173.249 0.001 1 49 127
	i -11.264 173.257 0
	i 11.265 173.259 -1.000 1 33 74
	i 9.428 173.312 0.001 1 49 127
	i 8.152 173.375 0.001 1 49 127
	i 9.429 173.375 0.001 1 49 127
	i 9.430 173.437 0.001 1 49 127
	i 7.145 173.500 0.001 1 39 127
	i 8.153 173.500 0.001 1 49 127
	i 9.431 173.500 0.001 1 49 127
	i 4.200 173.500 0.001 1 37 127
	i 11.266 173.508 -1.000 1 36 91
	i -11.265 173.517 0
	i 9.432 173.561 0.001 1 49 127
	i 8.154 173.624 0.001 1 49 127
	i 9.433 173.624 0.001 1 49 127
	i 9.434 173.687 0.001 1 49 127
	i 5.115 173.749 0.001 1 37 127
	i 6.115 173.749 0.001 1 37 127
	i 8.155 173.749 0.001 1 49 127
	i 9.435 173.749 0.001 1 49 127
	i 9.436 173.812 0.001 1 49 127
	i 8.156 173.875 0.001 1 49 113
	i 9.437 173.875 0.001 1 49 127
	i 9.438 173.937 0.001 1 49 127
	i 5.116 174.000 0.001 1 37 127
	i 4.201 174.000 0.001 1 37 127
	i 6.116 174.000 0.001 1 37 127
	i 8.157 174.000 0.001 1 49 127
	i 9.439 174.000 0.001 1 49 127
	i -11.266 173.999 0
	i 11.267 174.000 -1.000 1 38 83
	i -10.177 174.000 0
	i -10.178 174.000 0
	i 9.440 174.061 0.001 1 49 127
	i 9.441 174.124 0.001 1 49 127
	i 8.158 174.124 0.001 1 49 127
	i 9.442 174.187 0.001 1 49 127
	i 8.159 174.249 0.001 1 49 127
	i 9.443 174.249 0.001 1 49 127
	i 9.444 174.312 0.001 1 49 127
	i 8.160 174.375 0.001 1 49 127
	i 9.445 174.375 0.001 1 49 127
	i 9.446 174.437 0.001 1 49 127
	i 9.447 174.500 0.001 1 49 127
	i 7.146 174.500 0.001 1 39 127
	i 4.202 174.500 0.001 1 37 127
	i 8.161 174.500 0.001 1 49 127
	i 9.448 174.561 0.001 1 49 127
	i 9.449 174.624 0.001 1 49 127
	i 8.162 174.624 0.001 1 49 127
	i 9.450 174.687 0.001 1 49 127
	i 11.268 174.737 -1.000 1 41 103
	i 8.163 174.749 0.001 1 49 127
	i 9.451 174.749 0.001 1 49 127
	i -11.267 174.756 0
	i 9.452 174.812 0.001 1 49 127
	i 9.453 174.875 0.001 1 49 127
	i 8.164 174.875 0.001 1 49 127
	i 9.454 174.937 0.001 1 49 127
	i 4.203 175.000 0.001 1 37 127
	i 8.165 175.000 0.001 1 49 127
	i 9.455 175.000 0.001 1 49 127
	i 10.179 175.000 -1.000 1 72 127
	i 10.180 175.000 -1.000 1 76 127
	i 9.456 175.061 0.001 1 49 127
	i 9.457 175.124 0.001 1 49 127
	i 8.166 175.124 0.001 1 49 127
	i 9.458 175.187 0.001 1 49 127
	i 11.269 175.223 -1.000 1 44 76
	i -11.268 175.235 0
	i 9.459 175.249 0.001 1 49 127
	i 8.167 175.249 0.001 1 49 127
	i 9.460 175.312 0.001 1 49 127
	i 8.168 175.375 0.001 1 49 127
	i 9.461 175.375 0.001 1 49 127
	i 9.462 175.437 0.001 1 49 127
	i 4.204 175.500 0.001 1 37 127
	i 8.169 175.500 0.001 1 49 127
	i 7.147 175.500 0.001 1 39 127
	i 9.463 175.500 0.001 1 49 127
	i -11.269 175.523 0
	i 11.270 175.523 -1.000 1 43 89
	i 9.464 175.561 0.001 1 49 127
	i 8.170 175.624 0.001 1 49 127
	i 9.465 175.624 0.001 1 49 127
	i 9.466 175.687 0.001 1 49 127
	i 5.117 175.749 0.001 1 37 127
	i 8.171 175.749 0.001 1 49 127
	i 9.467 175.749 0.001 1 49 127
	i 6.117 175.749 0.001 1 37 127
	i 9.468 175.812 0.001 1 49 127
	i 9.469 175.875 0.001 1 49 127
	i 8.172 175.875 0.001 1 49 113
	i 9.470 175.937 0.001 1 49 127
	i 4.205 176.000 0.001 1 37 127
	i -10.179 175.999 0
	i -10.180 175.999 0
	i -11.270 175.997 0
	i 11.271 175.997 -1.000 1 41 97
	i 5.118 176.000 0.001 1 37 127
	i 6.118 176.000 0.001 1 37 127
	i 9.471 176.000 0.001 1 49 127
	i 8.173 176.000 0.001 1 49 127
	i 9.472 176.061 0.001 1 49 127
	i 9.473 176.124 0.001 1 49 127
	i 8.174 176.124 0.001 1 49 127
	i 9.474 176.187 0.001 1 49 127
	i 8.175 176.249 0.001 1 49 127
	i 9.475 176.249 0.001 1 49 127
	i 9.476 176.312 0.001 1 49 127
	i 8.176 176.375 0.001 1 49 127
	i 9.477 176.375 0.001 1 49 127
	i 9.478 176.437 0.001 1 49 127
	i 7.148 176.500 0.001 1 39 127
	i 9.479 176.500 0.001 1 49 127
	i 8.177 176.500 0.001 1 49 127
	i 4.206 176.500 0.001 1 37 127
	i 9.480 176.561 0.001 1 49 127
	i 9.481 176.624 0.001 1 49 127
	i 8.178 176.624 0.001 1 49 127
	i 9.482 176.687 0.001 1 49 127
	i 9.483 176.749 0.001 1 49 127
	i 8.179 176.749 0.001 1 49 127
	i -11.271 176.756 0
	i 11.272 176.759 -1.000 1 38 80
	i 9.484 176.812 0.001 1 49 127
	i 8.180 176.875 0.001 1 49 127
	i 9.485 176.875 0.001 1 49 127
	i 9.486 176.937 0.001 1 49 127
	i 4.207 177.000 0.001 1 37 127
	i 8.181 177.000 0.001 1 49 127
	i 9.487 177.000 0.001 1 49 127
	i 10.181 177.000 -1.000 1 72 127
	i 10.182 177.000 -1.000 1 76 127
	i 9.488 177.061 0.001 1 49 127
	i 8.182 177.124 0.001 1 49 127
	i 9.489 177.124 0.001 1 49 127
	i 9.490 177.187 0.001 1 49 127
	i 11.273 177.205 -1.000 1 33 79
	i -11.272 177.229 0
	i 8.183 177.249 0.001 1 49 127
	i 9.491 177.249 0.001 1 49 127
	i 9.492 177.312 0.001 1 49 127
	i 8.184 177.375 0.001 1 49 127
	i 9.493 177.375 0.001 1 49 127
	i 9.494 177.437 0.001 1 49 127
	i 4.208 177.500 0.001 1 37 127
	i 9.495 177.500 0.001 1 49 127
	i 8.185 177.500 0.001 1 49 127
	i 7.149 177.500 0.001 1 39 127
	i 11.274 177.507 -1.000 1 36 89
	i -11.273 177.508 0
	i 9.496 177.561 0.001 1 49 127
	i 9.497 177.624 0.001 1 49 127
	i 8.186 177.624 0.001 1 49 127
	i 9.498 177.687 0.001 1 49 127
	i 6.119 177.749 0.001 1 37 127
	i 5.119 177.749 0.001 1 37 127
	i 9.499 177.749 0.001 1 49 127
	i 8.187 177.749 0.001 1 49 127
	i 9.500 177.812 0.001 1 49 127
	i 9.501 177.875 0.001 1 49 127
	i 8.188 177.875 0.001 1 49 113
	i 9.502 177.937 0.001 1 49 127
	i -11.274 177.999 0
	i 11.275 178.000 -1.000 1 38 81
	i 6.120 178.000 0.001 1 37 127
	i 8.189 178.000 0.001 1 49 127
	i 4.209 178.000 0.001 1 37 127
	i 5.120 178.000 0.001 1 37 127
	i 9.503 178.000 0.001 1 49 127
	i -10.181 178.000 0
	i -10.182 178.000 0
	i 9.504 178.061 0.001 1 49 127
	i 9.505 178.124 0.001 1 49 127
	i 8.190 178.124 0.001 1 49 127
	i 9.506 178.187 0.001 1 49 127
	i 9.507 178.249 0.001 1 49 127
	i 8.191 178.249 0.001 1 49 127
	i 9.508 178.312 0.001 1 49 127
	i 8.192 178.375 0.001 1 49 127
	i 9.509 178.375 0.001 1 49 127
	i 9.510 178.437 0.001 1 49 127
	i 4.210 178.500 0.001 1 37 127
	i 9.511 178.500 0.001 1 49 127
	i 7.150 178.500 0.001 1 39 127
	i 8.193 178.500 0.001 1 49 127
	i 9.512 178.561 0.001 1 49 127
	i 9.513 178.624 0.001 1 49 127
	i 8.194 178.624 0.001 1 49 127
	i 9.514 178.687 0.001 1 49 127
	i 11.276 178.737 -1.000 1 41 89
	i -11.275 178.744 0
	i 9.515 178.749 0.001 1 49 127
	i 8.195 178.749 0.001 1 49 127
	i 9.516 178.812 0.001 1 49 127
	i 8.196 178.875 0.001 1 49 127
	i 9.517 178.875 0.001 1 49 127
	i 9.518 178.937 0.001 1 49 127
	i 9.519 179.000 0.001 1 49 127
	i 10.183 179.000 -1.000 1 72 127
	i 10.184 179.000 -1.000 1 76 127
	i 8.197 179.000 0.001 1 49 127
	i 4.211 179.000 0.001 1 37 127
	i 9.520 179.061 0.001 1 49 127
	i 8.198 179.124 0.001 1 49 127
	i 9.521 179.124 0.001 1 49 127
	i 9.522 179.187 0.001 1 49 127
	i 9.523 179.249 0.001 1 49 127
	i 8.199 179.249 0.001 1 49 127
	i 11.277 179.255 -1.000 1 38 68
	i -11.276 179.260 0
	i 9.524 179.312 0.001 1 49 127
	i 9.525 179.375 0.001 1 49 127
	i 8.200 179.375 0.001 1 49 127
	i 9.526 179.437 0.001 1 49 127
	i 4.212 179.500 0.001 1 37 127
	i 11.278 179.501 -1.000 1 41 78
	i 7.151 179.500 0.001 1 39 127
	i 8.201 179.500 0.001 1 49 127
	i 9.527 179.500 0.001 1 49 127
	i -11.277 179.509 0
	i 9.528 179.561 0.001 1 49 127
	i 9.529 179.624 0.001 1 49 127
	i 8.202 179.624 0.001 1 49 127
	i 9.530 179.687 0.001 1 49 127
	i 5.121 179.749 0.001 1 37 127
	i 8.203 179.749 0.001 1 49 127
	i 9.531 179.749 0.001 1 49 127
	i 6.121 179.749 0.001 1 37 127
	i 9.532 179.812 0.001 1 49 127
	i 9.533 179.875 0.001 1 49 127
	i 8.204 179.875 0.001 1 49 113
	i 9.534 179.937 0.001 1 49 127
	i 6.122 180.000 0.001 1 37 127
	i 5.122 180.000 0.001 1 37 127
	i 9.535 180.000 0.001 1 49 127
	i 8.205 180.000 0.001 1 49 127
	i -10.183 179.999 0
	i -10.184 179.999 0
	i 4.213 180.000 0.001 1 37 127
	i 11.279 180.012 -1.000 1 38 78
	i -11.278 180.031 0
	i 9.536 180.061 0.001 1 49 127
	i 8.206 180.124 0.001 1 49 127
	i 9.537 180.124 0.001 1 49 127
	i 9.538 180.187 0.001 1 49 127
	i 9.539 180.249 0.001 1 49 127
	i 8.207 180.249 0.001 1 49 127
	i 9.540 180.312 0.001 1 49 127
	i 8.208 180.375 0.001 1 49 127
	i 9.541 180.375 0.001 1 49 127
	i 9.542 180.437 0.001 1 49 127
	i 8.209 180.500 0.001 1 49 127
	i 9.543 180.500 0.001 1 49 127
	i 4.214 180.500 0.001 1 37 127
	i 7.152 180.500 0.001 1 39 127
	i 9.544 180.561 0.001 1 49 127
	i 9.545 180.624 0.001 1 49 127
	i 8.210 180.624 0.001 1 49 127
	i 9.546 180.687 0.001 1 49 127
	i 8.211 180.749 0.001 1 49 127
	i 9.547 180.749 0.001 1 49 127
	i 11.280 180.760 -1.000 1 36 86
	i -11.279 180.768 0
	i 9.548 180.812 0.001 1 49 127
	i 9.549 180.875 0.001 1 49 127
	i 8.212 180.875 0.001 1 49 127
	i 9.550 180.937 0.001 1 49 127
	i 4.215 181.000 0.001 1 37 127
	i 8.213 181.000 0.001 1 49 127
	i 9.551 181.000 0.001 1 49 127
	i 10.185 181.000 -1.000 1 72 127
	i 10.186 181.000 -1.000 1 76 127
	i 9.552 181.061 0.001 1 49 127
	i 8.214 181.124 0.001 1 49 127
	i 9.553 181.124 0.001 1 49 127
	i 9.554 181.187 0.001 1 49 127
	i 9.555 181.249 0.001 1 49 127
	i 8.215 181.249 0.001 1 49 127
	i -11.280 181.257 0
	i 11.281 181.259 -1.000 1 33 74
	i 9.556 181.312 0.001 1 49 127
	i 8.216 181.375 0.001 1 49 127
	i 9.557 181.375 0.001 1 49 127
	i 9.558 181.437 0.001 1 49 127
	i 4.216 181.500 0.001 1 37 127
	i 7.153 181.500 0.001 1 39 127
	i 9.559 181.500 0.001 1 49 127
	i 8.217 181.500 0.001 1 49 127
	i 11.282 181.508 -1.000 1 36 91
	i -11.281 181.517 0
	i 9.560 181.561 0.001 1 49 127
	i 8.218 181.624 0.001 1 49 127
	i 9.561 181.624 0.001 1 49 127
	i 9.562 181.687 0.001 1 49 127
	i 5.123 181.749 0.001 1 37 127
	i 8.219 181.749 0.001 1 49 127
	i 6.123 181.749 0.001 1 37 127
	i 9.563 181.749 0.001 1 49 127
	i 9.564 181.812 0.001 1 49 127
	i 8.220 181.875 0.001 1 49 113
	i 9.565 181.875 0.001 1 49 127
	i 9.566 181.937 0.001 1 49 127
	i 5.124 182.000 0.001 1 37 127
	i 8.221 182.000 0.001 1 49 127
	i 6.124 182.000 0.001 1 37 127
	i 4.217 182.000 0.001 1 37 127
	i 9.567 182.000 0.001 1 49 127
	i -10.185 182.000 0
	i -10.186 182.000 0
	i -11.282 181.999 0
	i 11.283 182.000 -1.000 1 38 83
	i 9.568 182.061 0.001 1 49 127
	i 9.569 182.124 0.001 1 49 127
	i 8.222 182.124 0.001 1 49 127
	i 9.570 182.187 0.001 1 49 127
	i 8.223 182.249 0.001 1 49 127
	i 9.571 182.249 0.001 1 49 127
	i 9.572 182.312 0.001 1 49 127
	i 9.573 182.375 0.001 1 49 127
	i 8.224 182.375 0.001 1 49 127
	i 9.574 182.437 0.001 1 49 127
	i 9.575 182.500 0.001 1 49 127
	i 7.154 182.500 0.001 1 39 127
	i 8.225 182.500 0.001 1 49 127
	i 4.218 182.500 0.001 1 37 127
	i 9.576 182.561 0.001 1 49 127
	i 9.577 182.624 0.001 1 49 127
	i 8.226 182.624 0.001 1 49 127
	i 9.578 182.687 0.001 1 49 127
	i 11.284 182.737 -1.000 1 41 103
	i 9.579 182.749 0.001 1 49 127
	i -11.283 182.756 0
	i 8.227 182.749 0.001 1 49 127
	i 9.580 182.812 0.001 1 49 127
	i 9.581 182.875 0.001 1 49 127
	i 8.228 182.875 0.001 1 49 127
	i 9.582 182.937 0.001 1 49 127
	i 4.219 183.000 0.001 1 37 127
	i 8.229 183.000 0.001 1 49 127
	i 9.583 183.000 0.001 1 49 127
	i 10.187 183.000 -1.000 1 72 127
	i 10.188 183.000 -1.000 1 76 127
	i 9.584 183.061 0.001 1 49 127
	i 8.230 183.124 0.001 1 49 127
	i 9.585 183.124 0.001 1 49 127
	i 9.586 183.187 0.001 1 49 127
	i 11.285 183.223 -1.000 1 44 76
	i -11.284 183.235 0
	i 9.587 183.249 0.001 1 49 127
	i 8.231 183.249 0.001 1 49 127
	i 9.588 183.312 0.001 1 49 127
	i 8.232 183.375 0.001 1 49 127
	i 9.589 183.375 0.001 1 49 127
	i 9.590 183.437 0.001 1 49 127
	i 4.220 183.500 0.001 1 37 127
	i 8.233 183.500 0.001 1 49 127
	i 7.155 183.500 0.001 1 39 127
	i 9.591 183.500 0.001 1 49 127
	i -11.285 183.523 0
	i 11.286 183.523 -1.000 1 43 89
	i 9.592 183.561 0.001 1 49 127
	i 9.593 183.624 0.001 1 49 127
	i 8.234 183.624 0.001 1 49 127
	i 9.594 183.687 0.001 1 49 127
	i 5.125 183.749 0.001 1 37 127
	i 6.125 183.749 0.001 1 37 127
	i 8.235 183.749 0.001 1 49 127
	i 9.595 183.749 0.001 1 49 127
	i 9.596 183.812 0.001 1 49 127
	i 8.236 183.875 0.001 1 49 113
	i 9.597 183.875 0.001 1 49 127
	i 9.598 183.937 0.001 1 49 127
	i 9.599 184.000 0.001 1 49 127
	i -11.286 183.997 0
	i 11.287 183.997 -1.000 1 41 97
	i 4.221 184.000 0.001 1 37 127
	i -10.187 183.999 0
	i -10.188 183.999 0
	i 6.126 184.000 0.001 1 37 127
	i 8.237 184.000 0.001 1 49 127
	i 5.126 184.000 0.001 1 37 127
	i 9.600 184.061 0.001 1 49 127
	i 8.238 184.124 0.001 1 49 127
	i 9.601 184.124 0.001 1 49 127
	i 9.602 184.187 0.001 1 49 127
	i 8.239 184.249 0.001 1 49 127
	i 9.603 184.249 0.001 1 49 127
	i 9.604 184.312 0.001 1 49 127
	i 9.605 184.375 0.001 1 49 127
	i 8.240 184.375 0.001 1 49 127
	i 9.606 184.437 0.001 1 49 127
	i 4.222 184.500 0.001 1 37 127
	i 7.156 184.500 0.001 1 39 127
	i 8.241 184.500 0.001 1 49 127
	i 9.607 184.500 0.001 1 49 127
	i 9.608 184.561 0.001 1 49 127
	i 8.242 184.624 0.001 1 49 127
	i 9.609 184.624 0.001 1 49 127
	i 9.610 184.687 0.001 1 49 127
	i 9.611 184.749 0.001 1 49 127
	i 8.243 184.749 0.001 1 49 127
	i -11.287 184.756 0
	i 11.288 184.759 -1.000 1 38 80
	i 9.612 184.812 0.001 1 49 127
	i 8.244 184.875 0.001 1 49 127
	i 9.613 184.875 0.001 1 49 127
	i 9.614 184.937 0.001 1 49 127
	i 8.245 185.000 0.001 1 49 127
	i 10.189 185.000 -1.000 1 72 127
	i 10.190 185.000 -1.000 1 76 127
	i 4.223 185.000 0.001 1 37 127
	i 9.615 185.000 0.001 1 49 127
	i 9.616 185.061 0.001 1 49 127
	i 9.617 185.124 0.001 1 49 127
	i 8.246 185.124 0.001 1 49 127
	i 9.618 185.187 0.001 1 49 127
	i 11.289 185.205 -1.000 1 33 79
	i -11.288 185.229 0
	i 8.247 185.249 0.001 1 49 127
	i 9.619 185.249 0.001 1 49 127
	i 9.620 185.312 0.001 1 49 127
	i 9.621 185.375 0.001 1 49 127
	i 8.248 185.375 0.001 1 49 127
	i 9.622 185.437 0.001 1 49 127
	i 8.249 185.500 0.001 1 49 127
	i 9.623 185.500 0.001 1 49 127
	i 7.157 185.500 0.001 1 39 127
	i 4.224 185.500 0.001 1 37 127
	i 11.290 185.507 -1.000 1 36 89
	i -11.289 185.508 0
	i 9.624 185.561 0.001 1 49 127
	i 9.625 185.624 0.001 1 49 127
	i 8.250 185.624 0.001 1 49 127
	i 9.626 185.687 0.001 1 49 127
	i 6.127 185.749 0.001 1 37 127
	i 8.251 185.749 0.001 1 49 127
	i 9.627 185.749 0.001 1 49 127
	i 5.127 185.749 0.001 1 37 127
	i 9.628 185.812 0.001 1 49 127
	i 8.252 185.875 0.001 1 49 113
	i 9.629 185.875 0.001 1 49 127
	i 9.630 185.937 0.001 1 49 127
	i -10.189 186.000 0
	i -10.190 186.000 0
	i -11.290 185.999 0
	i 11.291 186.000 -1.000 1 38 83
	i 5.128 186.000 0.001 1 37 127
	i 6.128 186.000 0.001 1 37 127
	i 9.631 186.000 0.001 1 49 127
	i 9.632 186.061 0.001 1 49 127
	i 9.633 186.124 0.001 1 49 127
	i 9.634 186.187 0.001 1 49 127
	i 9.635 186.249 0.001 1 49 127
	i -11.291 186.312 0
	i 9.636 186.312 0.001 1 49 127
	i 9.637 186.375 0.001 1 49 127
	i 9.638 186.437 0.001 1 49 127
	i 9.639 186.500 0.001 1 49 127
	i 9.640 186.561 0.001 1 49 127
	i 9.641 186.624 0.001 1 49 127
	i 9.642 186.687 0.001 1 49 127
	i 9.643 186.749 0.001 1 49 127
	i 9.644 186.812 0.001 1 49 127
	i 9.645 186.875 0.001 1 49 127
	i 9.646 186.937 0.001 1 49 127
	i 9.647 187.000 0.001 1 49 127
	i 10.191 187.000 -1.000 1 72 127
	i 10.192 187.000 -1.000 1 76 127
	i 9.648 187.061 0.001 1 49 127
	i 9.649 187.124 0.001 1 49 127
	i 9.650 187.187 0.001 1 49 127
	i 9.651 187.249 0.001 1 49 127
	i 9.652 187.312 0.001 1 49 127
	i 9.653 187.375 0.001 1 49 127
	i 9.654 187.437 0.001 1 49 127
	i 9.655 187.500 0.001 1 49 127
	i 9.656 187.561 0.001 1 49 127
	i 9.657 187.624 0.001 1 49 127
	i 9.658 187.687 0.001 1 49 127
	i 6.129 187.749 0.001 1 37 127
	i 5.129 187.749 0.001 1 37 127
	i 9.659 187.749 0.001 1 49 127
	i 9.660 187.812 0.001 1 49 127
	i 9.661 187.875 0.001 1 49 127
	i 9.662 187.937 0.001 1 49 127
	i 5.130 188.000 0.001 1 37 127
	i 6.130 188.000 0.001 1 37 127
	i 9.663 188.000 0.001 1 49 127
	i -10.191 187.999 0
	i -10.192 187.999 0
	i 9.664 188.061 0.001 1 49 127
	i 9.665 188.124 0.001 1 49 127
	i 9.666 188.187 0.001 1 49 127
	i 9.667 188.249 0.001 1 49 127
	i 9.668 188.312 0.001 1 49 127
	i 9.669 188.375 0.001 1 49 127
	i 9.670 188.437 0.001 1 49 127
	i 9.671 188.500 0.001 1 49 127
	i 9.672 188.561 0.001 1 49 127
	i 9.673 188.624 0.001 1 49 127
	i 9.674 188.687 0.001 1 49 127
	i 9.675 188.749 0.001 1 49 127
	i 9.676 188.812 0.001 1 49 127
	i 9.677 188.875 0.001 1 49 127
	i 9.678 188.937 0.001 1 49 127
	i 9.679 189.000 0.001 1 49 127
	i 10.193 189.000 -1.000 1 72 127
	i 10.194 189.000 -1.000 1 76 127
	i 9.680 189.061 0.001 1 49 127
	i 9.681 189.124 0.001 1 49 127
	i 9.682 189.187 0.001 1 49 127
	i 9.683 189.249 0.001 1 49 127
	i 9.684 189.312 0.001 1 49 127
	i 9.685 189.375 0.001 1 49 127
	i 9.686 189.437 0.001 1 49 127
	i 9.687 189.500 0.001 1 49 127
	i 9.688 189.561 0.001 1 49 127
	i 9.689 189.624 0.001 1 49 127
	i 9.690 189.687 0.001 1 49 127
	i 9.691 189.749 0.001 1 49 127
	i 9.692 189.812 0.001 1 49 127
	i 9.693 189.875 0.001 1 49 127
	i 9.694 189.937 0.001 1 49 127
	i 9.695 190.000 0.001 1 49 127
	i -10.193 190.000 0
	i -10.194 190.000 0
	i 5.131 190.000 0.001 1 37 127
	i 6.131 190.000 0.001 1 37 127
	i 9.696 190.061 0.001 1 49 127
	i 9.697 190.124 0.001 1 49 127
	i 9.698 190.187 0.001 1 49 127
	i 9.699 190.249 0.001 1 49 127
	i 9.700 190.312 0.001 1 49 127
	i 9.701 190.375 0.001 1 49 127
	i 9.702 190.437 0.001 1 49 127
	i 9.703 190.500 0.001 1 49 127
	i 9.704 190.561 0.001 1 49 127
	i 9.705 190.624 0.001 1 49 127
	i 9.706 190.687 0.001 1 49 127
	i 9.707 190.749 0.001 1 49 127
	i 9.708 190.812 0.001 1 49 127
	i 9.709 190.875 0.001 1 49 127
	i 9.710 190.937 0.001 1 49 127
	i 10.195 191.000 -1.000 1 72 127
	i 9.711 191.000 0.001 1 49 127
	i 10.196 191.000 -1.000 1 76 127
	i 9.712 191.061 0.001 1 49 127
	i 9.713 191.124 0.001 1 49 127
	i 9.714 191.187 0.001 1 49 127
	i 9.715 191.249 0.001 1 49 127
	i 9.716 191.312 0.001 1 49 127
	i 9.717 191.375 0.001 1 49 127
	i 9.718 191.437 0.001 1 49 127
	i 9.719 191.500 0.001 1 49 127
	i 9.720 191.561 0.001 1 49 127
	i 9.721 191.624 0.001 1 49 127
	i 9.722 191.687 0.001 1 49 127
	i 5.132 191.749 0.001 1 37 127
	i 9.723 191.749 0.001 1 49 127
	i 6.132 191.749 0.001 1 37 127
	i 9.724 191.812 0.001 1 49 127
	i 9.725 191.875 0.001 1 49 127
	i 9.726 191.937 0.001 1 49 127
	i 5.133 192.000 0.001 1 37 127
	i 9.727 192.000 0.001 1 49 127
	i -10.195 191.999 0
	i 6.133 192.000 0.001 1 37 127
	i -10.196 191.999 0
	i 9.728 192.061 0.001 1 49 127
	i 9.729 192.124 0.001 1 49 127
	i 9.730 192.187 0.001 1 49 127
	i 9.731 192.249 0.001 1 49 127
	i 9.732 192.312 0.001 1 49 127
	i 9.733 192.375 0.001 1 49 127
	i 9.734 192.437 0.001 1 49 127
	i 9.735 192.500 0.001 1 49 127
	i 9.736 192.561 0.001 1 49 127
	i 9.737 192.624 0.001 1 49 127
	i 9.738 192.687 0.001 1 49 127
	i 9.739 192.749 0.001 1 49 127
	i 9.740 192.812 0.001 1 49 127
	i 9.741 192.875 0.001 1 49 127
	i 9.742 192.937 0.001 1 49 127
	i 9.743 193.000 0.001 1 49 127
	i 10.197 193.000 -1.000 1 72 127
	i 10.198 193.000 -1.000 1 76 127
	i 9.744 193.061 0.001 1 49 127
	i 9.745 193.124 0.001 1 49 127
	i 9.746 193.187 0.001 1 49 127
	i 9.747 193.249 0.001 1 49 127
	i 9.748 193.312 0.001 1 49 127
	i 9.749 193.375 0.001 1 49 127
	i 9.750 193.437 0.001 1 49 127
	i 9.751 193.500 0.001 1 49 127
	i 9.752 193.561 0.001 1 49 127
	i 9.753 193.624 0.001 1 49 127
	i 9.754 193.687 0.001 1 49 127
	i 9.755 193.749 0.001 1 49 127
	i 9.756 193.812 0.001 1 49 127
	i 9.757 193.875 0.001 1 49 127
	i 9.758 193.937 0.001 1 49 127
	i -10.197 193.999 0
	i -10.198 193.999 0
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
    csound = new Csound(csdText)
    csound.start()
    return scene
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas)
    }
}
