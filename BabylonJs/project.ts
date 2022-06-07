import * as BABYLON from "babylonjs"
import * as CSOUND from "./@doc.e.dub/csound-browser"

//#region Non-playground setup

declare global {
    interface Document {
        Csound: CSOUND.Csound
        isProduction: boolean	// If falsey then we're running in the playground.
        useDawTiming: boolean	// If falsey then use Csound; otherwise use OSC messages from DAW to drive animations.
        debugAsserts: boolean	// If truthy then call `debugger` to break in `assert` function.
        alwaysRun: boolean	    // Always move camera fast on keyboard input, not just when caps lock is on.
        visible: boolean        // Set to `true` when browser/tab is visible; otherwise `false`.
    }

    class OSC {
        constructor()
        constructor(args)
        on: any
        open: any
        send: any
        status: any
    }

    namespace OSC {
        class Message {
            constructor(address)
            constructor(address, ...args)
            add(any)
        }
        class WebsocketClientPlugin {
            constructor(args)
        }
        class WebsocketServerPlugin {
            constructor(args)
        }
    }
}

document.isProduction = true
document.useDawTiming = false
document.debugAsserts = true
document.alwaysRun = true

// var ConsoleLogHTML = require('console-log-html')
// ConsoleLogHTML.connect(document.getElementById('ConsoleOutput'), {}, false, false, false)

//#endregion

class Playground { public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {

    //#region Options

    const groundSize = 9000
    const logDebugMessages = true
    const showBabylonInspector = false
    const showGroundGrid = true

    //#endregion

    //#region Constants

    const halfGroundSize = groundSize / 2

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

    //#endregion

    //#region Babylon scene setup

    // The BabylonJS playground adds the materials extension to BABYLON.
    if (!document.isProduction && !BABYLON_MATERIALS)
        var BABYLON_MATERIALS = BABYLON

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine)
    if (showBabylonInspector) {
        scene.debugLayer.show()
    }

    //#endregion

    //#region class Csound

    class Csound {
        constructor(csdText) {
            this.#csdText = csdText

            if (document.getElementById('csound-script') === null) {
                const csoundJsUrl = document.isProduction
                    ? "https://unpkg.com/@csound/browser@6.17.0-beta2/dist/csound.js"
                    : "https://unpkg.com/@doc.e.dub/csound-browser@6.17.0-beta5/dist/csound.esm.js"
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
        #audioContext = BABYLON.Engine.audioEngine.audioContext
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

        #startUpdatingCameraMatrix = () => {
            setInterval(() => {
                if (!this.isStarted) {
                    return
                }
                if (camera.matrixIsDirty) {
                    console.debug('Setting Csound listener position to ['
                        + camera.matrix[12] + ', '
                        + camera.matrix[13] + ', '
                        + camera.matrix[14] + ']')
                    this.#csoundObj.tableCopyIn("1", camera.matrix)
                    camera.matrixIsDirty = false
                }
            }, camera.matrixMillisecondsPerUpdate)
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

            this.#startUpdatingCameraMatrix()

            this.#previousConsoleLog = console.log
            console.log = this.#consoleLog
            this.#csoundObj = await document.Csound({
                audioContext: BABYLON.Engine.audioEngine.audioContext,
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

            console.debug('Starting Csound playback - done')
        }

        pause = () => {
            this.#csoundObj.pause()
            this.#audioContext.suspend()
        }

        resume = () => {
            this.#csoundObj.resume()
            this.#audioContext.resume()
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
            if (args[0] === 'csd:started') {
                this.#startTime = this.#audioContext.currentTime - (4 - 3 * this.#latency)
                this.#playbackIsStarted = true
                console.debug('Playback start message received')
            }
            else if (args[0] === 'csd:ended') {
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
    }
    let csound = null

    //#endregion

    //#region class Camera

    class Camera {
        set position(value) {
            this.#flatScreenCamera.position.x = value[0]
            this.#flatScreenCamera.position.y = value[1]
            this.#flatScreenCamera.position.z = value[2]
        }

        _target = new BABYLON.Vector3()
        set target(value) {
            this._target.x = value[0]
            this._target.y = value[1]
            this._target.z = value[2]
            this.#flatScreenCamera.setTarget(this._target)
        }

        constructor() {
            let camera = new BABYLON.FreeCamera('', this.setting.position, scene)
            camera.applyGravity = true
            camera.checkCollisions = true
            camera.ellipsoid = new BABYLON.Vector3(0.5, this.height / 2, 0.5)
            camera.speed = this.slowSpeed
            camera.attachControl(canvas, true)
            camera.setTarget(this.setting.target)
            camera.keysUp.push(KeyCode.W)
            camera.keysLeft.push(KeyCode.A)
            camera.keysDown.push(KeyCode.S)
            camera.keysRight.push(KeyCode.D)
            this.#flatScreenCamera = camera
            this.switchToFlatScreen()

            scene.registerBeforeRender(() => {
                this.matrix = this.#camera.worldMatrixFromCache.m
            })
        }

        //#region Options

        _matrixUpdatesPerSecond = 10
        get matrixUpdatesPerSecond() { return this._matrixUpdatesPerSecond }
        set matrixUpdatesPerSecond(value) { this._matrixUpdatesPerSecond = value }
        get matrixMillisecondsPerUpdate() { return 1000 / this.matrixUpdatesPerSecond }

        #slowSpeed = 0.25
        get slowSpeed() { return this.#slowSpeed }

        #fastSpeed = 1.5
        get fastSpeed() { return this.#fastSpeed }

        #height = 2
        get height() { return this.#height }

        #settingIndex = 1
        #settings = [
            // 0
            { position: new BABYLON.Vector3(0, this.height, -10), target: new BABYLON.Vector3(0, this.height, 0) },
            // 1
            { position: new BABYLON.Vector3(0, this.height, -400), target: new BABYLON.Vector3(0, 100, 0) },
            // 2
            { position: new BABYLON.Vector3(-137, this.height, -298), target: new BABYLON.Vector3(0, 100, 0) },
            // 3
            { position: new BABYLON.Vector3(-1370, this.height, -2980), target: new BABYLON.Vector3(0, 100, 0) },
            // 4
            { position: new BABYLON.Vector3(0, this.height, 160), target: new BABYLON.Vector3(0, 0, 170) },
            // 5
            { position: new BABYLON.Vector3(-40, this.height, 400), target: new BABYLON.Vector3(225, 180, 0) },
            // 6
            { position: new BABYLON.Vector3(0, this.height, -100), target: new BABYLON.Vector3(0, 180, 0) },
            // 7: Safari mixdown location.
            { position: new BABYLON.Vector3(0, this.height, 335), target: new BABYLON.Vector3(0, 135, 0) }
        ]

        get setting() { return this.#settings[this.#settingIndex] }

        //#endregion

        #flatScreenCamera = null

        #xrCamera = null
        set xrCamera(value) { this.#xrCamera = value }

        #camera = null
        get camera() { return this.#camera }

        switchToFlatScreen = () => {
            this.#camera = this.#flatScreenCamera
        }

        switchToXR = () => {
            this.#camera = this.#xrCamera
        }

        #speed = this.slowSpeed

        onInputChanged = (input) => {
            if (document.alwaysRun
                    || input.heldKeys[KeyCode.CapsLock]
                    || input.heldKeys[KeyCode.Shift]
                    || input.heldKeys[KeyCode.Space]) {
                this.#flatScreenCamera.speed = this.fastSpeed
            }
            else {
                this.#flatScreenCamera.speed = this.slowSpeed
            }
        }

        #usesInputKey = (key) => {
            for (let i = 0; i < this.#flatScreenCamera.keysDown.length; i++) {
                if (key == this.#flatScreenCamera.keysDown[i]) {
                    return true
                }
            }
            for (let i = 0; i < this.#flatScreenCamera.keysDownward.length; i++) {
                if (key == this.#flatScreenCamera.keysDown[i]) {
                    return true
                }
            }
            for (let i = 0; i < this.#flatScreenCamera.keysLeft.length; i++) {
                if (key == this.#flatScreenCamera.keysLeft[i]) {
                    return true
                }
            }
            for (let i = 0; i < this.#flatScreenCamera.keysRight.length; i++) {
                if (key == this.#flatScreenCamera.keysRight[i]) {
                    return true
                }
            }
            for (let i = 0; i < this.#flatScreenCamera.keysUp.length; i++) {
                if (key == this.#flatScreenCamera.keysUp[i]) {
                    return true
                }
            }
            for (let i = 0; i < this.#flatScreenCamera.keysUpward.length; i++) {
                if (key == this.#flatScreenCamera.keysUpward[i]) {
                    return true
                }
            }
            return false
        }

        _matrix = null
        _matrixIsDirty = true
        get matrixIsDirty() { return this._matrixIsDirty }
        set matrixIsDirty(value) { this._matrixIsDirty = value }

        get matrix() { return this._matrix }
        set matrix(value) {
            if (this._matrix != null && !this.matrixIsDirty) {
                for (let i = 0; i < 16; i++) {
                    if (0.01 < Math.abs(value[i] - this._matrix[i])) {
                        this._matrixIsDirty = true
                        break
                    }
                }
            }
            if (this.matrixIsDirty) {
                this._matrix = Array.from(value)
            }
        }
    }
    let camera = new Camera

    //#endregion

    //#region class Input

    class Input {
        constructor() {
            document.addEventListener("keydown", this.#onKeyDown, false)
            document.addEventListener("keyup", this.#onKeyUp, false)
        }

        #heldKeys = {}
        get heldKeys() { return this.#heldKeys }

        #onInputEvent = (e) => {
            this.#heldKeys[KeyCode.CapsLock] = e.getModifierState("CapsLock")
            this.#heldKeys[KeyCode.Shift] = e.getModifierState("Shift")
            camera.onInputChanged(this)
        }

        #onKeyDown = (e) => {
            this.#heldKeys[e.keyCode] = true
            this.#onInputEvent(e)
        }

        #onKeyUp = (e) => {
            this.#heldKeys[e.keyCode] = false
            this.#onInputEvent(e)
        }
    }
    let input = new Input

    //#endregion

    //#region Babylon audio engine setup

    if (!document.useDawTiming) {
        BABYLON.Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => { csound.onAudioEngineUnlocked() })
        BABYLON.Engine.audioEngine.lock()
    }

    //#endregion

    //#region Console overrides

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

    //#endregion

    //#region Utility functions

    const assert = (value, message) => {
        if (value) {
            return
        }
        console.error(`Assertion failed: ${message}`)
        console.trace()
        if (document.debugAsserts) {
            debugger
        }
    }

    const makeMesh = (positions, indices) => {
        let normals = []
        BABYLON.VertexData.ComputeNormals(positions, indices, normals)
        let vertexData = new BABYLON.VertexData()
        vertexData.positions = positions
        vertexData.indices = indices
        vertexData.normals = normals
        let mesh = new BABYLON.Mesh('', scene)
        vertexData.applyToMesh(mesh)
        mesh.position.set(0, 1, 0)
        mesh.isVisible = false
        return mesh
    }

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

    //#endregion

    //#region Scene environment setup

    const skyBrightness = 0.05
    scene.clearColor.set(skyBrightness, skyBrightness, skyBrightness, 1)

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

    //#endregion

    //#region XR experience handler

    const startXr = async () => {
        try {
            const xr = await scene.createDefaultXRExperienceAsync({floorMeshes: [ ground ]})
            if (!!xr && !!xr.enterExitUI) {
                xr.enterExitUI.activeButtonChangedObservable.add((eventData) => {
                    if (eventData == null) {
                        camera.switchToFlatScreen()
                    }
                    else {
                        camera.xrCamera = xr.baseExperience.camera
                        camera.switchToXR()
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

    //#endregion

    //#region MainTriangles mesh

    const mainTrianglesOuterMeshScale = 20
    const mainTrianglesOuterMeshRotationY = BABYLON.Angle.FromDegrees(60).radians()
    const mainTrianglesDefaultColor = [ 0.05, 0.05, 0.05 ]

    let mainTriangleMesh = null
    let mainTriangleMeshHeight = 1

    const meshString_MainTriangles = `
    {"producer":{"name":"Blender","version":"2.93.4","exporter_version":"2.93.5","file":"MainTriangles.babylon"},
    "autoClear":true,"clearColor":[0.0509,0.0509,0.0509],"gravity":[0,-9.81,0],
    "meshes":[{"name":"MainTriangles","id":"MainTriangles","billboardMode":0,"position":[0,0,0],"rotation":[0,0,0],"scaling":[1,1,1],"isVisible":true,"isEnabled":true,"pickable":false
    ,"positions":[0,202.4602,13.9867,0,220.4601,0,12.1128,202.4602,-6.9933,0,202.4602,13.9867,12.1128,202.4602,-6.9933,-12.1128,202.4602,-6.9933,12.1128,202.4602,-6.9933,0,220.4601,0,-12.1128,202.4602,-6.9933,-12.1128,202.4602,-6.9933,0,220.4601,0,0,202.4602,13.9867,0,0,197.34,0,220.46,0,15,0,171.34,15,0,171.34,0,220.46,0
    ,-15,0,171.34,-15,0,171.34,0,220.46,0,0,0,197.34,170.9015,0,-98.67,0,220.46,0,140.8848,0,-98.6604,140.8848,0,-98.6604,0,220.46,0,155.8848,0,-72.6796,155.8848,0,-72.6796,0,220.46,0,170.9015,0,-98.67,-170.9015,0,-98.67,0,220.46,0,-155.8848,0,-72.6796,-155.8848,0,-72.6796
    ,0,220.46,0,-140.8848,0,-98.6604,-140.8848,0,-98.6604,0,220.46,0,-170.9015,0,-98.67]
    ,"normals":[0.807,0.362,0.466,0.807,0.362,0.466,0.807,0.362,0.466,0,-1,0,0,-1,0,0,-1,0,0,0.362,-0.932,0,0.362,-0.932,0,0.362,-0.932,-0.807,0.362,0.466,-0.807,0.362,0.466,-0.807,0.362,0.466,0.791,0.408,0.456,0.791,0.408,0.456,0.791,0.408,0.456,0,-0.614,-0.79,0,-0.614,-0.79
    ,0,-0.614,-0.79,-0.791,0.408,0.456,-0.791,0.408,0.456,-0.791,0.408,0.456,0,0.408,-0.913,0,0.408,-0.913,0,0.408,-0.913,-0.684,-0.614,0.395,-0.684,-0.614,0.395,-0.684,-0.614,0.395,0.79,0.408,0.457,0.79,0.408,0.457,0.79,0.408,0.457,-0.79,0.408,0.457,-0.79,0.408,0.457,-0.79,0.408,0.457,0.684,-0.614,0.395
    ,0.684,-0.614,0.395,0.684,-0.614,0.395,0,0.408,-0.913,0,0.408,-0.913,0,0.408,-0.913]
    ,"uvs":[0.25,0.49,0.25,0.25,0.458,0.13,0.75,0.49,0.958,0.13,0.542,0.13,0.458,0.13,0.25,0.25,0.042,0.13,0.042,0.13,0.25,0.25,0.25,0.49,0.25,0.49,0.25,0.25,0.458,0.13,0.458,0.13,0.25,0.25,0.042,0.13,0.042,0.13,0.25,0.25,0.25,0.49,0.25,0.49,0.25,0.25,0.458,0.13,0.458,0.13
    ,0.25,0.25,0.042,0.13,0.042,0.13,0.25,0.25,0.25,0.49,0.25,0.49,0.25,0.25,0.458,0.13,0.458,0.13,0.25,0.25,0.042,0.13,0.042,0.13,0.25,0.25,0.25,0.49]
    ,"indices":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38]
    ,"subMeshes":[{"materialIndex":0,"verticesStart":0,"verticesCount":39,"indexStart":0,"indexCount":39}]
    ,"instances":[]}
    ]
    }
    `
    BABYLON.SceneLoader.Append(
        '',
        'data: ' + meshString_MainTriangles,
        scene,
        (scene) => {
            const material = new BABYLON.StandardMaterial('', scene)
            material.ambientColor.set(1, 1, 1)
            material.diffuseColor.set(1, 1, 1)
            material.emissiveColor.set(
                mainTrianglesDefaultColor[0],
                mainTrianglesDefaultColor[1],
                mainTrianglesDefaultColor[2])
            material.specularColor.set(0.25, 0.25, 0.25)
            material.specularPower = 2
            mainTriangleMesh = scene.getMeshByName('MainTriangles')
            mainTriangleMesh.material = material
            mainTriangleMeshHeight = mainTriangleMesh.getBoundingInfo().boundingBox.maximumWorld.y
            const outerMesh = mainTriangleMesh.clone('OuterMainTriangles', mainTriangleMesh.parent)
            outerMesh.scaling.setAll(mainTrianglesOuterMeshScale)
            outerMesh.rotation.y = mainTrianglesOuterMeshRotationY
            outerMesh.material = material.clone('')
        },
        () => {},
        () => {},
        '.babylon'
    )

    //#endregion

    //#region Project-specific utility functions

    const makeTrianglePlaneMesh = () => {
        return makeMesh(
            [ 0, 0, 0.867,
              0.75, 0, -0.433,
              -0.75, 0, -0.433
            ],
            [ 0, 1, 2 ]
        )
    }
    const trianglePlaneMesh = makeTrianglePlaneMesh()

    const makeTrianglePolygonMesh = () => {
        const mesh = makeMesh(
            [ 0, 1.225, 0,
              0, 0, 0.867,
              0.75, 0, -0.433,
              -0.75, 0, -0.433
            ],
            [ 0, 2, 1,
              0, 3, 2,
              0, 1, 3,
              2, 3, 1
            ]
        )
        const boundingInfo = mesh.getBoundingInfo()
        boundingInfo.centerOn(BABYLON.Vector3.ZeroReadOnly, new BABYLON.Vector3(0.867, 1.225, 0.867))
        mesh.setBoundingInfo(boundingInfo)
        return mesh
    }
    const trianglePolygonMesh = makeTrianglePolygonMesh()

    //#endregion

    //#region class SunLight

    class SunLight {
        get color() { return this._light.diffuse.asArray() }
        set color(value) {
            this._light.specular.r = this._light.diffuse.r = value[0]
            this._light.specular.g = this._light.diffuse.g = value[1]
            this._light.specular.b = this._light.diffuse.b = value[2]
        }

        _light = new BABYLON.DirectionalLight('', new BABYLON.Vector3(0, -1, 0), scene)

        reset = () => {
        }

        render = () => {
            this.color = [ 1, 1, 1 ]
            this._light.intensity = 1
        }
    }
    const sunLight = new SunLight

    //#endregion

    //#region class CameraAnimator

    class CameraAnimator {
        radius = 350
        spinAngleDegrees = 145
        spinAngleDegreesPerSecond = 1.5

        reset() {
            camera.target = [ 0, 120, 0 ]
        }

        render(deltaTime) {
            this.spinAngleDegrees += deltaTime * this.spinAngleDegreesPerSecond
            const radians = BABYLON.Angle.FromDegrees(this.spinAngleDegrees).radians()
            const x = Math.sin(radians) * this.radius
            const z = Math.cos(radians) * this.radius
            camera.position = [ x, camera.height, z ]
            this.reset()
        }
    }

    // const cameraAnimator = new CameraAnimator
    // scene.registerBeforeRender(() => {
    // 	cameraAnimator.render(engine.getDeltaTime() / 1000)
    // })

    //#endregion

    // ECS base classes

    //#region class EcsObject

    class EcsObject {
        isA = (Type) => {
            return Type === this.constructor || Type.isPrototypeOf(this.constructor)
        }
    }

    //#endregion

    //#region class Entity

    class Entity extends EcsObject {
        #id = ''
        get id() { return this.#id }
        set id(value) { this.#id = value }

        #components = []
        get components() { return this.#components }

        addComponent = (component) => {
            if (!component) {
                return
            }
            if (!component.isA(Component)) {
                return
            }
            if (this.#components.includes(component)) {
                return
            }
            this.#components.push(component)
        }

        /// Finds and returns the components matching the class types listed in the componentTypes array argument.
        /// Returns null if any of the componentTypes array argument's class types are not found.
        ///
        findComponents = (ComponentTypes) => {
            let components = []
            for (let i = 0; i < ComponentTypes.length; i++) {
                const ComponentType = ComponentTypes[i]
                let found = false
                for (let j = 0; j < this.#components.length; j++) {
                    const component = this.#components[j]
                    if (component.isA(ComponentType)) {
                        found = true
                        components.push(component)
                    }
                }
                if (!found) {
                    return null
                }
            }
            return components
        }
    }

    //#endregion

    //#region class Component

    class Component extends EcsObject {
        entity: null
    }

    //#endregion

    //#region class System

    class System extends EcsObject {
        static hasSubclass = (Type) => {
            return System === Type || System.isPrototypeOf(Type)
        }

        entity = null

        // Subclasses should reimplement the following functions.
        static requiredComponentTypes = () => { return [] }
        constructor(components) { super() }
        run = (time, deltaTime) => {}
    }

    //#endregion

    //#region class World

    class World {
        #entities = []
        get entities() { return this.#entities }

        #SystemTypes = []
        get SystemTypes() { return this.#SystemTypes }

        #systems = []
        get systems() { return this.#systems }

        #addEntity = (entity) => {
            this.#entities.push(entity)
        }

        #addSystemType = (SystemType) => {
            if (this.#SystemTypes.includes(SystemType)) {
                return
            }
            this.#SystemTypes.push(SystemType)
        }

        add = (ecsObjectOrType) => {
            if (!ecsObjectOrType) {
                return
            }
            const isObject = typeof(ecsObjectOrType) === 'object'
            if (isObject && ecsObjectOrType.isA(Entity)) {
                this.#addEntity(ecsObjectOrType)
                return
            }
            const isType = typeof(ecsObjectOrType) === 'function'
            if (isType && System.hasSubclass(ecsObjectOrType)) {
                this.#addSystemType(ecsObjectOrType)
                return
            }
        }

        build = () => {
            for (let i = 0; i < this.#SystemTypes.length; i++) {
                const SystemType = this.#SystemTypes[i]
                for (let j = 0; j < this.#entities.length; j++) {
                    const entity = this.#entities[j]
                    let components = entity.findComponents(SystemType.requiredComponentTypes())
                    if (components) {
                        const system = new SystemType(components)
                        system.entity = entity
                        this.#systems.push(system)
                    }
                }
            }
        }

        run = (time, deltaTime) => {
            for (let i = 0; i < this.#systems.length; i++) {
                this.#systems[i].run(time, deltaTime)
            }
        }
    }

    const world = new World

    //#endregion

    // ECS common classes

    //#region class ObjectPropertyResetComponent

    class ObjectPropertyResetComponent extends Component {
        object = null
        keys = []
    }

    //#endregion

    //#region class ObjectPropertyResetSystem

    class ObjectPropertyResetSystem extends System {
        static requiredComponentTypes = () => { return [
            ObjectPropertyResetComponent
        ]}

        reset = null

        previousValues = {}

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(ObjectPropertyResetComponent)) {
                    this.reset = component
                }
            }
            assert(this.reset, `${ObjectPropertyResetComponent.name} missing.`)
            this.#checkKeys()
            this.#initializePreviousValues()
        }

        run = (time, deltaTime) => {
            const object = this.reset.object
            const keys = this.reset.keys
            const previousValues = this.previousValues
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]
                object[key] = previousValues[key]
            }
        }

        #checkKeys = () => {
            const object = this.reset.object
            const keys = this.reset.keys
            for (let i = 0; i < keys.length; i++) {
                if (object[keys[i]] === undefined) {
                    console.warn(`Object key not found. Key = ${keys[i]}. Object = ${object}.`)
                }
            }
        }

        #initializePreviousValues = () => {
            const object = this.reset.object
            const keys = this.reset.keys
            const previousValues = this.previousValues
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]
                previousValues[key] = object[key]
            }
        }
    }

    world.add(ObjectPropertyResetSystem)

    //#endregion

    //#region class TrackComponent

    class TrackComponent extends Component {
        name = ''
        header = null
        notes = []
        activeNotes = []
        activeNotesChanged = false
    }

    //#endregion

    //#region class TrackNoteActivationSystem

    class TrackNoteActivationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent
        ]}

        track = null

        noteOffIndex = 0
        noteOnIndex = 0

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            this.track.activeNotesChanged = false
            if (deltaTime < 0) {
                this.#reset()
            }
            this.#updateActiveNotes(time)
        }

        #reset = () => {
            if (0 < this.track.activeNotes.length) {
                this.track.activeNotesChanged = true
            }
            this.track.activeNotes.length = 0
            this.noteOnIndex = 0
            this.noteOffIndex = 0
        }

        #updateActiveNotes = (time) => {
            while (this.noteOnIndex < this.track.notes.length) {
                const note = this.track.notes[this.noteOnIndex]
                if (time < note.onTime) {
                    break
                }
                if (time < note.offTime) {
                    this.#activate(note)
                }
                this.noteOnIndex++
                // console.debug(`${this.entity.id}: ${this.track.name} noteOnIndex = ${this.noteOnIndex}.`)
            }
            while (this.noteOffIndex < this.track.notes.length) {
                const note = this.track.notes[this.noteOffIndex]
                if (time < note.offTime) {
                    break
                }
                if (note.offTime <= time) {
                    this.#deactivate(note)
                }
                this.noteOffIndex++
                // console.debug(`${this.entity.id}: ${this.track.name} noteOffIndex = ${this.noteOffIndex}.`)
            }
        }

        #activate = (note) => {
            note.isActive = true
            this.track.activeNotes.push(note)
            this.track.activeNotesChanged = true
        }

        #deactivate = (note) => {
            note.isActive = false
            const noteIndex = this.track.activeNotes.indexOf(note)
            if (noteIndex < 0) {
                return
            }
            this.track.activeNotes.splice(noteIndex, 1)
            this.track.activeNotesChanged = true
        }
    }

    world.add(TrackNoteActivationSystem)

    //#endregion

    //#region class TrackActiveNotesChangedCallbackComponent

    class TrackActiveNotesChangedCallbackComponent extends Component {
        function = (activeNotes) => {}
    }

    //#endregion

    //#region class TrackActiveNotesChangedCallbackSystem

    class TrackActiveNotesChangedCallbackSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackActiveNotesChangedCallbackComponent
        ]}

        track = null
        callback = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(TrackActiveNotesChangedCallbackComponent)) {
                    this.callback = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.callback, `${TrackActiveNotesChangedCallbackComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            if (this.track.activeNotesChanged) {
                this.callback.function(this.track.activeNotes)
            }
        }
    }

    world.add(TrackActiveNotesChangedCallbackSystem)

    //#endregion

    //#region class TrackNoteDurationComponent

    class TrackNoteDurationComponent extends Component {
    }

    //#endregion

    //#region class TrackNoteDurationSystem

    class TrackNoteDurationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackNoteDurationComponent
        ]}

        track = null

        activeNotes = []

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            this.#initializeNoteValues()
        }

        run = (time, deltaTime) => {
            // Set final durations for previously active notes that got deactivated.
            for (let i = 0; i < this.activeNotes.length; i++) {
                const note = this.activeNotes[i]
                if (!note.isActive) {
                    assert(time < note.onTime || note.offTime <= time, `Note should be active.`)
                    note.duration = time < note.onTime ? 0 : note.totalDuration
                }
            }

            // Refresh this system's active notes list if the track's active notes list changed.
            if (this.track.activeNotesChanged) {
                this.activeNotes.length = this.track.activeNotes.length
                for (let i = 0; i < this.activeNotes.length; i++) {
                    this.activeNotes[i] = this.track.activeNotes[i]
                }
            }

            // Update durations for current active notes.
            for (let i = 0; i < this.activeNotes.length; i++) {
                const note = this.activeNotes[i]
                if (note.offTime <= time) {
                    note.duration = note.totalDuration
                }
                else {
                    note.duration = time - note.onTime
                }
            }
        }

        #initializeNoteValues = () => {
            for (let i = 0; i < this.track.notes.length; i++) {
                const note = this.track.notes[i]
                note.totalDuration = note.offTime - note.onTime
                note.duration = 0
            }
        }
    }

    world.add(TrackNoteDurationSystem)

    //#endregion

    //#region class TrackNoteNormalizedDurationComponent

    class TrackNoteNormalizedDurationComponent extends Component {
    }

    //#endregion

    //#region class TrackNoteNormalizedDurationSystem

    class TrackNoteNormalizedDurationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackNoteDurationComponent,
            TrackNoteNormalizedDurationComponent
        ]}

        track = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            this.#initializeNoteValues()
        }

        run = (time, deltaTime) => {
            for (let i = 0; i < this.track.activeNotes.length; i++) {
                const note = this.track.activeNotes[i]
                note.normalizedDuration = note.duration / note.totalDuration
            }
        }

        #initializeNoteValues = () => {
            for (let i = 0; i < this.track.notes.length; i++) {
                const note = this.track.notes[i]
                note.normalizedDuration = 0
            }
        }
    }

    world.add(TrackNoteNormalizedDurationSystem)

    //#endregion

    //#region class TrackActiveNoteControllerComponent

    class TrackActiveNoteControllerComponent extends Component {
        key = ''
        defaultValue = 0
    }

    //#endregion

    //#region class TrackActiveNoteControllerSystem

    class TrackActiveNoteControllerSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackActiveNoteControllerComponent
        ]}

        track = null
        controller = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(TrackActiveNoteControllerComponent)) {
                    this.controller = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.controller, `${TrackActiveNoteControllerComponent.name} missing.`)
            this.#initializeControllerValues()
            this.#reset()
        }

        run = (time, deltaTime) => {
            if (deltaTime < 0) {
                this.#reset()
            }
            this.#updateControllerValues(time)
        }

        #initializeControllerValues = () => {
            const notes = this.track.notes
            const key = this.controller.key
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i]
                for (let j = 0; j < note.k.length; j++) {
                    note.k[j].time += note.onTime
                }
            }
        }

        #reset = () => {
            const notes = this.track.notes
            const key = this.controller.key
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i]
                note[key] = this.controller.defaultValue
                note.kIndex = 0
            }
        }

        #updateControllerValues = (time) => {
            const activeNotes = this.track.activeNotes
            const key = this.controller.key
            for (let i = 0; i < activeNotes.length; i++) {
                const note = activeNotes[i]
                while (note.kIndex < note.k.length) {
                    const k = note.k[note.kIndex]
                    if (time < k.time) {
                        break
                    }
                    if (k[key] !== undefined) {
                        note[key] = k[key]
                        // console.debug(`${key} = ${note[key]}`)
                    }
                    note.kIndex++
                }
            }
        }
    }

    world.add(TrackActiveNoteControllerSystem)

    //#endregion

    //#region class TrackActiveNoteLfoComponent

    class TrackActiveNoteLfoComponent extends Component {
        amp = 1
        shape = [] // Expects 60 normalized values for 1 full cycle of LFO.
        timeKey = ''
        valueKey = ''
        defaultValue = 0
        animationRate = 1
    }

    //#endregion

    //#region class TrackActiveNoteLfoSystem

    class TrackActiveNoteLfoSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackNoteDurationComponent,
            TrackActiveNoteLfoComponent
        ]}

        track = null
        lfo = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(TrackActiveNoteLfoComponent)) {
                    this.lfo = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.lfo, `${TrackActiveNoteLfoComponent.name} missing.`)
            this.#reset()
        }

        run = (time, deltaTime) => {
            if (deltaTime < 0) {
                this.#reset()
            }
            this.#updateLfoValues()
        }

        #reset = () => {
            const notes = this.track.notes
            const noteLfoValueKey = this.lfo.noteLfoValueKey
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i]
                note[noteLfoValueKey] = this.lfo.defaultValue
            }
        }

        #updateLfoValues = () => {
            const activeNotes = this.track.activeNotes
            const lfo = this.lfo
            const valueKey = lfo.valueKey
            for (let i = 0; i < activeNotes.length; i++) {
                const note = activeNotes[i]
                const shapeIndex = Math.round(lfo.shape.length * note.duration * note[lfo.timeKey] * lfo.animationRate)
                note[valueKey] = lfo.amp * lfo.shape[shapeIndex % lfo.shape.length]
                // if (i == 0) {
                //     console.debug(`lfo: shapeIndex = ${shapeIndex}, duration = ${note.duration}, value = ${note[valueKey]}`)
                // }
            }
        }
    }

    world.add(TrackActiveNoteLfoSystem)

    //#endregion

    // ECS track classes

    //#region class DrumAnimationComponent

    class DrumAnimationComponent extends Component {
        flashScalingMin = 10
        flashScalingMax = 100

        get color() { return this._flashMeshMaterial.emissiveColor.asArray() }
        set color(value) {
            this._flashMeshMaterial.emissiveColor.fromArray(value)
            this._strikerLegsMeshMaterial.emissiveColor.fromArray(value)
        }

        set duration(value) {
            value = Math.max(0, value)
            const oneMinusValue = 1 - value

            this._flashMeshMaterial.alpha = oneMinusValue

            if (!this.isRunning) {
                return
            }

            const color = this.color
            const redRange = 1 - color[0]
            const greenRange = 1 - color[1]
            const blueRange = 1 - color[2]
            const redDelta = redRange * oneMinusValue
            const greenDelta = greenRange * oneMinusValue
            const blueDelta = blueRange * oneMinusValue
            const r = color[0] + redDelta
            const g = color[1] + greenDelta
            const b = color[2] + blueDelta
            this._strikerLegsMeshMaterial.emissiveColor.set(r, g, b)

            const white = 0.5 + 0.5 * oneMinusValue
            this._strikerGlassMeshMaterial.emissiveColor.set(white, white, white)

            this._strikerLegsMesh.position.y = this.strikerMeshY + (oneMinusValue * -this.strikerMeshY)
            this.scaling = this.flashScalingMin + this.flashScalingTotal * value
        }

        get flashScalingTotal() { return this.flashScalingMax - this.flashScalingMin }

        get isRunning() { return this._flashMesh.isVisible }
        set isRunning(value) { this._flashMesh.isVisible = value }

        set position(value) {
            this._flashMesh.position.fromArray(value)
            this._strikerLegsMesh.position.set(value[0], this.strikerMeshY, value[2])
        }

        set rotation(value) {
            this._flashMesh.rotation.fromArray(value)
            this._strikerLegsMesh.rotation.fromArray(value)
        }

        set scaling(value) { this._flashMesh.scaling.set(value, 1, value) }

        set strikerMeshScaling(value) { this._strikerLegsMesh.scaling.fromArray(value) }

        _strikerMeshY = 0
        get strikerMeshY() { return this._strikerMeshY }
        set strikerMeshY(value) {
            this._strikerMeshY = value
            this._strikerLegsMesh.position.y = value
        }

        _flashScalingRange = this.flashScalingMax - this.flashScalingMin

        _flashMesh = null
        _flashMeshMaterial = null

        _strikerLegsMesh = null
        _strikerLegsMeshMaterial = null

        _strikerGlassMesh = null
        _strikerGlassMeshMaterial = null

        constructor() {
            super()

            this._flashScalingRange = this.flashScalingMax - this.flashScalingMin

            this._flashMesh = makeTrianglePolygonMesh()
            this._flashMesh.position.setAll(0)
            this._flashMesh.scaling.set(this.flashScalingMin, 1, this.flashScalingMin)
            this._flashMesh.bakeCurrentTransformIntoVertices()

            this._flashMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._flashMeshMaterial.alpha = 0.999
            this._flashMeshMaterial.emissiveColor.set(0.5, 0.5, 0.5)
            this._flashMesh.material = this._flashMeshMaterial

            this._strikerLegsMesh = mainTriangleMesh.clone(`Drum striker legs mesh`, mainTriangleMesh.parent)
            this._strikerLegsMesh.makeGeometryUnique()
            this._strikerLegsMesh.isVisible = true

            this._strikerLegsMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._strikerLegsMeshMaterial.emissiveColor.set(0.5, 0.5, 0.5)
            this._strikerLegsMesh.material = this._strikerLegsMeshMaterial

            this._strikerGlassMesh = makeTrianglePolygonMesh()
            this._strikerGlassMesh.isVisible = true
            this._strikerGlassMesh.scaling.set(210, 180, 210)
            this._strikerGlassMesh.parent = this._strikerLegsMesh

            this._strikerGlassMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._strikerGlassMeshMaterial.alpha = 0.5
            this._strikerGlassMeshMaterial.backFaceCulling = false
            this._strikerGlassMeshMaterial.emissiveColor.set(0.5, 0.5, 0.5)
            this._strikerGlassMesh.material = this._strikerGlassMeshMaterial

            this.isRunning = false
        }
    }

    //#endregion

    //#region class DrumAnimationSystem

    class DrumAnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackNoteDurationComponent,
            TrackNoteNormalizedDurationComponent,
            DrumAnimationComponent
        ]}

        track = null
        animation = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(DrumAnimationComponent)) {
                    this.animation = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${HiHatAnimationComponent.name} missing.`)

            this.animation.position = this.track.notes[0].xyz
        }

        run = (time, deltaTime) => {
            if (0 < this.track.activeNotes.length) {
                this.animation.isRunning = true
                this.animation.duration = this.track.activeNotes[0].normalizedDuration
            }
            else {
                this.animation.duration = 1
                this.animation.isRunning = false
            }
        }
    }

    world.add(DrumAnimationSystem)

    //#endregion

    //#region class HiHatAnimationComponent

    class HiHatAnimationComponent extends Component {
        laserWidth = 0.25
        y = 1

        get color() { return this._meshMaterial.emissiveColor.asArray() }
        set color(value) { this._meshMaterial.emissiveColor.fromArray(value) }

        get isVisible() { return this._mesh.isVisible }
        set isVisible(value) { this._mesh.isVisible = value }

        set position(values) {
            const x = values[0]
            const y = this.y
            const z = values[2]

            for (let i = 0; i < 4; i++) {
                const j = 9 + 3 * i
                this._meshPositions[j] = x + this._meshStartPositions[j]
                this._meshPositions[j + 1] = y + this._meshStartPositions[j + 1] + y
                this._meshPositions[j + 2] = z + this._meshStartPositions[j + 2]
            }
            this._updateMeshNormals()
            this._updateMeshVertices()
        }

        _mesh = new BABYLON.Mesh('', scene)
        _meshStartPositions = [
            // Legs match the inside faces of the MainTriangle mesh's legs at y = 0.

            // [0] Leg point 1
            0, 0, 171.34,

            // [1] Leg point 2
            -148.385, 0, -85.67,

            // [2] Leg point 3
            148.385, 0, -86.67,

            // Center triangle's peak points down from origin.

            // [3] Center triangle point 1
            0, this.laserWidth, -0.707 * this.laserWidth,

            // [4] Center triangle point 2
            0.612 * this.laserWidth, this.laserWidth, 0.354 * this.laserWidth,

            // [5] Center triangle point 3
            -0.612 * this.laserWidth, this.laserWidth, 0.354 * this.laserWidth,

            // [6] Center triangle bottom point
            0, 0, 0,

            // [7] Ceiling point matches the inside face of the MainTriangle mesh's top triangle y at the origin.
            0, 202.46, 0
        ]
        _meshPositions = [ ...this._meshStartPositions ]
        _meshIndices = [
            // Leg 1 laser
            0, 4, 6,
            0, 6, 5,
            0, 5, 4,

            // Leg 2 laser
            1, 5, 6,
            1, 6, 3,
            1, 3, 5,

            // Leg 3 laser
            2, 3, 6,
            2, 6, 4,
            2, 4, 3,

            // Ceiling laser
            7, 3, 4,
            7, 4, 5,
            7, 5, 3
        ]
        _meshNormals = []
        _meshMaterial = new BABYLON.StandardMaterial('', scene)

        _updateMeshNormals = () => {
            BABYLON.VertexData.ComputeNormals(this._meshPositions, this._meshIndices, this._meshNormals)
        }

        _updateMeshVertices = () => {
            this._mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this._meshPositions)
            this._mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, this._meshNormals)
        }

        constructor() {
            super()
            this.color = [1, 1, 1]
            this.isVisible = false
            this._mesh.material = this._meshMaterial

            this._updateMeshNormals()
            let vertexData = new BABYLON.VertexData()
            vertexData.positions = this._meshPositions
            vertexData.indices = this._meshIndices
            vertexData.normals = this._meshNormals
            vertexData.applyToMesh(this._mesh, true)
        }
    }

    //#endregion

    //#region class HiHatAnimationSystem

    class HiHatAnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            HiHatAnimationComponent
        ]}

        track = null
        animation = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(HiHatAnimationComponent)) {
                    this.animation = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${HiHatAnimationComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            if (!this.track.activeNotesChanged) {
                return
            }
            if (0 < this.track.activeNotes.length) {
                this.animation.isVisible = true
                this.animation.position = this.track.activeNotes[0].xyz
            }
            else {
                this.animation.isVisible = false
            }
        }
    }

    world.add(HiHatAnimationSystem)

    //#endregion

    //#region class BeaconAnimationComponent

    class BeaconAnimationComponent extends Component {
        pitchFloor = 60
        rotationSpeed = 2

        set maximumActiveNoteCount(value) {
            this._activeNoteData.length = value
            for (let i = 0; i < value; i++) {
                const activeNoteData = this._activeNoteData[i] = {
                    scale: new BABYLON.Vector3,
                    yaw: 0,
                    rotation: new BABYLON.Quaternion,
                    translation: new BABYLON.Vector3,
                    matrix: new BABYLON.Matrix,
                    thinInstanceIndex: -1
                }
                activeNoteData.thinInstanceIndex = this._mesh.thinInstanceAdd(activeNoteData.matrix)
            }
        }

        set position(value) {
            this._mesh.position.fromArray(value)
            this._pillarMesh.position.fromArray(value)
        }

        updateActiveNoteDataMatrixes = () => {
            for (let i = 0; i < this._activeNoteData.length; i++) {
                const activeNoteData = this._activeNoteData[i]
                BABYLON.Quaternion.RotationYawPitchRollToRef(activeNoteData.yaw, 0, 0, activeNoteData.rotation)
                BABYLON.Matrix.ComposeToRef(
                    activeNoteData.scale,
                    activeNoteData.rotation,
                    activeNoteData.translation,
                    activeNoteData.matrix)
                this._mesh.thinInstanceSetMatrixAt(activeNoteData.thinInstanceIndex, activeNoteData.matrix)
            }
        }

        setActiveNoteDataAt = (index, scale, yawDelta, pitch) => {
            this._activeNoteData[index].scale.setAll(scale)
            this._activeNoteData[index].yaw += yawDelta
            this._activeNoteData[index].translation.y = (pitch - this.pitchFloor) / 2
            if (index == 0) {
                this._pillarMesh.rotation.y += yawDelta
            }
        }

        _activeNoteData = []
        _mesh = null
        _meshMaterial = null

        _pillarMesh = null
        _pillarMeshMaterial = null

        constructor() {
            super()

            const triangleMesh1 = makeTrianglePolygonMesh()
            triangleMesh1.position.x = 1.225
            triangleMesh1.rotation.x = triangleMesh1.rotation.z = Math.PI / 2
            triangleMesh1.bakeCurrentTransformIntoVertices()
            const triangleMesh2 = makeTrianglePolygonMesh()
            triangleMesh2.position.x = 1.225
            triangleMesh2.rotation.x = triangleMesh2.rotation.z = Math.PI / 2
            triangleMesh2.rotateAround(BABYLON.Vector3.ZeroReadOnly, BABYLON.Vector3.UpReadOnly, -0.667 * Math.PI)
            triangleMesh2.bakeCurrentTransformIntoVertices()
            const triangleMesh3 = makeTrianglePolygonMesh()
            triangleMesh3.position.x = 1.225
            triangleMesh3.rotation.x = triangleMesh3.rotation.z = Math.PI / 2
            triangleMesh3.rotateAround(BABYLON.Vector3.ZeroReadOnly, BABYLON.Vector3.UpReadOnly, 0.667 * Math.PI)
            triangleMesh3.bakeCurrentTransformIntoVertices()

            this._mesh = BABYLON.Mesh.MergeMeshes([ triangleMesh1, triangleMesh2, triangleMesh3 ], true)
            this._meshMaterial = new BABYLON.StandardMaterial('', scene)
            this._meshMaterial.emissiveColor.set(1, 0, 0)
            this._meshMaterial.specularPower = 0.25
            this._mesh.material = this._meshMaterial

            this._pillarMesh = makeTrianglePolygonMesh()
            this._pillarMesh.isVisible = true
            this._pillarMesh.scaling.set(1, 10, 1)
            this._pillarMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._pillarMeshMaterial.diffuseColor.set(1, 0, 0)
            this._pillarMeshMaterial.emissiveColor.set(1, 0, 0)
            this._pillarMeshMaterial.specularPower = 0.25
            this._pillarMesh.material = this._pillarMeshMaterial
        }
    }

    //#endregion

    //#region class BeaconAnimationSystem

    class BeaconAnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackNoteDurationComponent,
            TrackNoteNormalizedDurationComponent,
            TrackActiveNoteLfoComponent,
            BeaconAnimationComponent
        ]}

        track = null
        animation = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(BeaconAnimationComponent)) {
                    this.animation = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${BeaconAnimationComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            for (let i = 0; i < this.track.activeNotes.length; i++) {
                const activeNote = this.track.activeNotes[i]
                const scale = 1
                const yawDelta = deltaTime * this.animation.rotationSpeed * 2 * Math.PI
                const pitch = activeNote.pitch + activeNote.pitchLfo
                this.animation.setActiveNoteDataAt(i, scale, yawDelta, pitch)
            }
            this.animation.updateActiveNoteDataMatrixes()
        }
    }

    world.add(BeaconAnimationSystem)

    //#endregion

    //#region class BassAnimationComponent

    class BassAnimationComponent extends Component {
        baseScale = 1
        meshesToColor = []

        get isVisible() { return this._mesh.isVisible }
        set isVisible(value) {
            if (this.isVisible == value) {
                return
            }
            this._mesh.isVisible = this._frameMesh.isVisible = value
            for (let i = 0; i < this.meshesToColor.length; i++) {
                this.meshesToColor[i].material.emissiveColor.fromArray(mainTrianglesDefaultColor)
            }
        }

        set pitch(value) {
            this.#setColorFromPitch(value)
            this._mesh.position.y = this._frameMesh.position.y = this.#yFromPitch(value)
            // console.debug(`Bass y = ${this.mesh.position.y}`)
            const scaleXZ = this.#scaleXZFromY(this._mesh.position.y)
            this._mesh.scaling.set(scaleXZ, 1, scaleXZ)
            this._frameMesh.scaling.set(scaleXZ / 197.624, 1, scaleXZ / 197.624)
        }

        get rotation() { return this._mesh.rotation.y }
        set rotation(value) {
            this._mesh.rotation.y = value
            this._frameMesh.rotation.y = value
        }

        _mesh = null
        _meshMaterial = null

        _frameMesh = new BABYLON.Mesh('BassFrameMesh', scene)
        _frameMeshMaterial = null
        _frameMeshPositions = [
            // [0] Leg point 1
            0, 0, 171.34,

            // [1] Leg point 2
            -148.385, 0, -85.67,

            // [2] Leg point 3
            148.385, 0, -86.67,

            // [3 and 4] Frame left
            -77.05, -1, 44.485,
            -77.05, 1, 44.485,

            // [5 and 6] Frame bottom
            0, -1, -88.97,
            0, 1, -88.97,

            // [7 and 8] Frame right
            77.05, -1, 44.485,
            77.05, 1, 44.485,
        ]
        _frameMeshIndices = [
            // Frame left
            0, 3, 4,
            4, 3, 1,
            1, 0, 4,
            0, 1, 3,

            // Frame bottom
            1, 5, 6,
            6, 5, 2,
            2, 1, 6,
            1, 2, 5,

            // Frame right
            2, 7, 8,
            8, 7, 0,
            0, 2, 8,
            2, 0, 7
        ]
        _frameMeshNormals = []

        #setColorFromPitch = (pitch) => {
            const hue = 256 * ((pitch - 32) / 15)
            BABYLON.Color3.HSVtoRGBToRef(hue, 1, 0.667, this._meshMaterial.emissiveColor)
            for (let i = 0; i < this.meshesToColor.length; i++) {
                BABYLON.Color3.HSVtoRGBToRef(hue, 0.95, 0.175, this.meshesToColor[i].material.emissiveColor)
            }
        }

        #yFromPitch = (pitch) => {
            return ((pitch - 28) / 23) * (mainTriangleMeshHeight * this.baseScale)
        }

        #scaleXZFromY = (y) => {
            // Main triangle mesh height.
            const maxHeight = 220.46 * this.baseScale

            // Triangle plane mesh scale at y = 0 (spreads points to inside edge of main triangle mesh legs).
            const maxScaleXZ = 197.624 * this.baseScale

            return Math.max(0, maxScaleXZ * ((maxHeight - y) / maxHeight))
        }

        constructor() {
            super()

            this._mesh = trianglePlaneMesh.clone('Bass')
            this._meshMaterial = new BABYLON.StandardMaterial('', scene)
            this._meshMaterial.emissiveColor.set(1, 1, 1)
            this._meshMaterial.backFaceCulling = false
            this._meshMaterial.alpha = 0.75
            this._mesh.material = this._meshMaterial

            this._frameMesh = new BABYLON.Mesh('', scene)
            this._frameMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._frameMeshMaterial.emissiveColor.set(1, 0, 0)
            this._frameMesh.material = this._frameMeshMaterial
            this._frameMesh.isVisible = false

            BABYLON.VertexData.ComputeNormals(this._frameMeshPositions, this._frameMeshIndices, this._frameMeshNormals)
            const frameMeshVertexData = new BABYLON.VertexData()
            frameMeshVertexData.positions = this._frameMeshPositions
            frameMeshVertexData.indices = this._frameMeshIndices
            frameMeshVertexData.normals = this._frameMeshNormals
            frameMeshVertexData.applyToMesh(this._frameMesh, true)

            this.meshesToColor.push(this._frameMesh)
        }
    }

    //#endregion

    //#region class BassAnimationSystem

    class BassAnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            BassAnimationComponent
        ]}

        track = null
        animation = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(BassAnimationComponent)) {
                    this.animation = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${BassAnimationComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            if (this.track.activeNotesChanged) {
                this.animation.isVisible = 0 < this.track.activeNotes.length
            }
            if (this.animation.isVisible) {
                this.animation.pitch = this.track.activeNotes[0].pitch
            }
        }
    }

    world.add(BassAnimationSystem)

    //#endregion

    // World setup

    //#region World center light setup

    class CenterLight {
        get intensity() { return this._light.intensity }
        set intensity(value) { this._light.intensity = value }

        constructor() {
            this._light.intensity = 0.25
            this._light.range = 200

            const entity = new Entity
            const reset = new ObjectPropertyResetComponent
            reset.object = this
            reset.keys = [ 'intensity' ]
            entity.addComponent(reset)
            world.add(entity)
        }

        _light = new BABYLON.PointLight('', new BABYLON.Vector3(0, 0, 0), scene)
    }

    const centerLight = new CenterLight

    const addCenterLightFlashComponent = (entity) => {
        const callback = new TrackActiveNotesChangedCallbackComponent
        callback.function = (activeNotes) => {
            if (0 < activeNotes.length) {
                centerLight.intensity += 0.25
            }
        }
        entity.addComponent(callback)
    }

    //#endregion

    //#region World track setup

    const createTrack = (id, json, options) => {
        const entity = new Entity
        entity.id = id
        const track = new TrackComponent
        track.name = options.name
        track.header = json[0]
        for (let i = 1; i < json.length; i++) {
            const note = json[i].note

            // Skip preallocation notes.
            if (note.onTime <= 0.005) {
                continue
            }

            if (options.totalDuration) {
                note.offTime = note.onTime + options.totalDuration
            }
            else if (note.offTime === undefined && note.k !== undefined) {
                // Use the last controller value's time for the off time.
                note.offTime = note.onTime + note.k[note.k.length - 1].time
            }
            track.notes.push(note)
        }
        entity.addComponent(track)
        return entity
    }

    const createDrumAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)
        const duration = new TrackNoteDurationComponent
        entity.addComponent(duration)
        const normalizedDuration = new TrackNoteNormalizedDurationComponent
        entity.addComponent(normalizedDuration)
        const animation = new DrumAnimationComponent
        if (options.color !== undefined) {
            animation.color = options.color
        }
        if (options.flashScalingMin !== undefined) {
            animation.flashScalingMin = options.flashScalingMin
        }
        if (options.flashScalingMax !== undefined) {
            animation.flashScalingMax = options.flashScalingMax
        }
        if (options.strikerMeshScaling !== undefined) {
            animation.strikerMeshScaling = options.strikerMeshScaling
        }
        if (options.strikerMeshY !== undefined) {
            animation.strikerMeshY = options.strikerMeshY
        }
        entity.addComponent(animation)
        addCenterLightFlashComponent(entity)
        return entity
    }

    const createHiHatAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)
        const animation = new HiHatAnimationComponent
        if (options.color !== undefined) {
            animation.color = options.color
        }
        if (options.y !== undefined) {
            animation.y = options.y
        }
        entity.addComponent(animation)
        addCenterLightFlashComponent(entity)
        return entity
    }

    const createBeaconAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)
        const duration = new TrackNoteDurationComponent
        entity.addComponent(duration)
        const normalizedDuration = new TrackNoteNormalizedDurationComponent
        entity.addComponent(normalizedDuration)
        const pitchLfo = new TrackActiveNoteLfoComponent
        const header = json[0]
        pitchLfo.amp = header.pitchLfoAmp
        pitchLfo.shape = header.pitchLfoShape
        pitchLfo.timeKey = 'pitchLfoTime'
        pitchLfo.valueKey = 'pitchLfo'
        pitchLfo.animationRate = 0.2
        entity.addComponent(pitchLfo)
        const animation = new BeaconAnimationComponent
        animation.maximumActiveNoteCount = 2
        animation.position = json[1].note.xyz
        entity.addComponent(animation)
        return entity
    }

    const createBassAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)
        const pitchController = new TrackActiveNoteControllerComponent
        pitchController.key = 'pitch'
        entity.addComponent(pitchController)
        const animation = new BassAnimationComponent
        if (options.baseScale !== undefined) {
            animation.baseScale = options.baseScale
        }
        if (options.rotation !== undefined) {
            animation.rotation = options.rotation
        }
        if (options.meshesToColor !== undefined) {
            animation.meshesToColor.push(...options.meshesToColor)
        }
        entity.addComponent(animation)
        return entity
    }

    const kickOptions = {
        totalDuration: 0.1,
        flashScalingMin: 1,
        flashScalingMax: 40,
        strikerMeshY: 2,
        strikerMeshScaling: new Array(3).fill(30 / mainTriangleMeshHeight)
    }

    const snareOptions = {
        totalDuration: 0.25,
        flashScalingMin: 0.24,
        flashScalingMax: 60,
        strikerMeshY: 1,
        strikerMeshScaling: new Array(3).fill(20 / mainTriangleMeshHeight)
    }

    const createTrackMap = {
        'e274e9138ef048c4ba9c4d42e836c85c': {
            function: createDrumAnimation,
            options: {
                name: '00: Kick 1',
                totalDuration: kickOptions.totalDuration,
                color: [ 1, 0.5, 0.1 ],
                flashScalingMin: kickOptions.flashScalingMin,
                flashScalingMax: kickOptions.flashScalingMax,
                strikerMeshScaling: kickOptions.strikerMeshScaling,
                strikerMeshY: kickOptions.strikerMeshY
            }
        },
        '8aac7747b6b44366b1080319e34a8616': {
            function: createDrumAnimation,
            options: {
                name: '01: Kick 2: Left',
                totalDuration: kickOptions.totalDuration,
                color: [ 0.1, 1, 0.5 ],
                flashScalingMin: kickOptions.flashScalingMin,
                flashScalingMax: kickOptions.flashScalingMax,
                strikerMeshScaling: kickOptions.strikerMeshScaling,
                strikerMeshY: kickOptions.strikerMeshY
            }
        },
        '8e12ccc0dff44a4283211d553199a8cd': {
            function: createDrumAnimation,
            options: {
                name: '02: Kick 2: Right',
                totalDuration: kickOptions.totalDuration,
                color: [ 0.5, 0.1, 1 ],
                flashScalingMin: kickOptions.flashScalingMin,
                flashScalingMax: kickOptions.flashScalingMax,
                strikerMeshScaling: kickOptions.strikerMeshScaling,
                strikerMeshY: kickOptions.strikerMeshY
            }
        },
        '6aecd056fd3f4c6d9a108de531c48ddf': {
            function: createDrumAnimation,
            options: {
                name: '03: Snare',
                totalDuration: snareOptions.totalDuration,
                color: [ 0.1, 0.1, 1 ],
                flashScalingMin: snareOptions.flashScalingMin,
                flashScalingMax: snareOptions.flashScalingMax,
                strikerMeshScaling: snareOptions.strikerMeshScaling,
                strikerMeshY: snareOptions.strikerMeshY
            }
        },
        'e3e7d57082834a28b53e021beaeb783d': {
            function: createHiHatAnimation,
            options: {
                name: '04: HiHat 1',
                totalDuration: 0.034,
                color: [ 1, 0.333, 0.333 ],
                y: 20
            }
        },
        '02c103e8fcef483292ebc49d3898ef96': {
            function: createHiHatAnimation,
            options: {
                name: '05: HiHat 2',
                totalDuration: 0.034,
                color: [ 0.333, 0.333, 1 ],
                y: 60
            }
        },
        'fd575f03378047af835c19ef4f7d5991': {
            function: createBeaconAnimation,
            options: {
                name: '06: Beacon'
            }
        },
        'ab018f191c70470f98ac3becb76e6d13': {
            function: createBassAnimation,
            options: {
                name: '07: Bass 1+2: Edited',
                meshesToColor: [
                    scene.getMeshByName('MainTriangles')
                ]
            }
        },
        'b0ba6f144fac4f668ba6981c691277d6': {
            function: createBassAnimation,
            options: {
                name: '08: Bass 1+2: Distant',
                baseScale: mainTrianglesOuterMeshScale,
                rotation: mainTrianglesOuterMeshRotationY,
                meshesToColor: [
                    scene.getMeshByName('MainTriangles'),
                    scene.getMeshByName('OuterMainTriangles')
                ]
            }
        }
    }

    //#endregion

    //#region Csound output (.csd and .json)
    const csdText = `
    <CsoundSynthesizer>
    <CsOptions>
    --messagelevel=134
    --midi-device=0
    --nodisplays
    --nosound
    </CsOptions>
    <CsInstruments>
    giPresetUuidPreallocationCount[] = fillarray( 5, /* instr 4  -- 00: Kick 1 */ 6, /* instr 5  -- 01: Kick 2: Left */ 6, /* instr 6  -- 02: Kick 2: Right */ 4, /* instr 7  -- 03: Snare */ 5, /* instr 8  -- 04: HiHat 1 */ 7, /* instr 9  -- 05: HiHat 2 */ 5, /* instr 10 -- 06: Beacon */ 4, /* instr 11 -- 07: Bass 1+2: Edited */ 4, /* instr 12 -- 08: Bass 1+2: Distant */ 0 /* dummy */ )
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
    opcode string_escape_i, S, S
    SUnescaped xin
    SEscaped = sprintf("%s", "")
    iiStart = 0
    iiCurrent = 0
    iMessageLength = strlen(SUnescaped)
    while (iiCurrent < iMessageLength) do
    if (strchar(SUnescaped, iiCurrent) == 34) then
    if (iiCurrent > 0) then
    SEscaped = strcat(SEscaped, strsub(SUnescaped, iiStart, iiCurrent))
    SEscaped = strcat(SEscaped, "\\\\\\"")
    else
    SEscaped = strcatk(SEscaped, "\\\\\\"")
    endif
    iiStart = iiCurrent + 1
    endif
    iiCurrent += 1
    od
    if (iiStart < iiCurrent) then
    SEscaped = strcat(SEscaped, strsub(SUnescaped, iiStart, iiCurrent + 1))
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
    #define AF_3D_FRAME_DURATION_OVER_2 #0.001#
    #define AF_3D_LISTENER_LAG_TIME #0.025#
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
    k_azimuth = -(round(k_azimuth % 360) + 180)
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
    kLagAzimuth = lag:k(k_azimuth, $AF_3D_LISTENER_LAG_TIME)
    kLagElevation = lag:k(k_elevation, $AF_3D_LISTENER_LAG_TIME)
    k_azimuthRow = AF_3D_Audio_AzimuthLookupTableRow(kLagAzimuth)
    k_elevationRow = AF_3D_Audio_ElevationLookupTableRow(kLagElevation)
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
    k_azimuth = taninv2(k_direction[$X], k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Y],
    sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Z] * k_direction[$Z])) * $AF_MATH__RADIANS_TO_DEGREES
    AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
    endop
    opcode AF_3D_Audio_ChannelGains, 0, k[]kp
    k_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
    k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
    k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
    k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
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
    k_azimuth = taninv2(k_direction[$X], k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES
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
    opcode AF_3D_Audio_DistanceAttenuation, a, aPP
    aDistance, kReferenceDistance, kRolloffFactor xin
    aAttenuation = kReferenceDistance / ((max(aDistance, a(kReferenceDistance)) - kReferenceDistance) * kRolloffFactor + kReferenceDistance)
    xout aAttenuation
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
    opcode AF_3D_Audio_SourceDistance_a, a, kkk
    kSourcePositionX, kSourcePositionY, kSourcePositionZ xin
    kVector[] init 3
    kVector[$X] = kSourcePositionX - gk_AF_3D_ListenerPosition[$X]
    kVector[$Y] = kSourcePositionY - gk_AF_3D_ListenerPosition[$Y]
    kVector[$Z] = kSourcePositionZ - gk_AF_3D_ListenerPosition[$Z]
    xout lag:a(a(sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])), $AF_3D_LISTENER_LAG_TIME)
    endop
    opcode AF_3D_Audio_SourceDistance, k, i[]
    iSourcePosition[] xin
    kVector[] init 3
    kVector[$X] = lag:k(iSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X], $AF_3D_LISTENER_LAG_TIME)
    kVector[$Y] = lag:k(iSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y], $AF_3D_LISTENER_LAG_TIME)
    kVector[$Z] = lag:k(iSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z], $AF_3D_LISTENER_LAG_TIME)
    xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
    endop
    opcode AF_3D_Audio_SourceDistance, k, k[]
    kSourcePosition[] xin
    kVector[] init 3
    kVector[$X] = lag:k(kSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X], $AF_3D_LISTENER_LAG_TIME)
    kVector[$Y] = lag:k(kSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y], $AF_3D_LISTENER_LAG_TIME)
    kVector[$Z] = lag:k(kSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z], $AF_3D_LISTENER_LAG_TIME)
    xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
    endop
    opcode AF_3D_Audio_SourceDistance_a, a, k[]
    kSourcePosition[] xin
    kVector[] init 3
    kVector[$X] = kSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X]
    kVector[$Y] = kSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y]
    kVector[$Z] = kSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z]
    xout lag:a(a(sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])), $AF_3D_LISTENER_LAG_TIME)
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
    k_dopplerShift = lag:k($AF_3D_AUDIO__SPEED_OF_SOUND / ($AF_3D_AUDIO__SPEED_OF_SOUND + k_velocity),
    $AF_3D_FRAME_DURATION_OVER_2, 1)
    endif
    xout k_dopplerShift
    endop
    opcode AF_3D_UpdateListenerRotationMatrix, 0, 0
    gk_AF_3D_ListenerRotationMatrix[0] = tab:k(0, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[1] = tab:k(1, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[2] = tab:k(2, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[3] = tab:k(4, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[4] = tab:k(5, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[5] = tab:k(6, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[6] = tab:k(8, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[7] = tab:k(9, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[8] = tab:k(10, gi_AF_3D_ListenerMatrixTableNumber)
    endop
    opcode AF_3D_UpdateListenerPosition, 0, 0
    gk_AF_3D_ListenerPosition[0] = tab:k(12, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerPosition[1] = tab:k(13, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerPosition[2] = tab:k(14, gi_AF_3D_ListenerMatrixTableNumber)
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
    iDummy = vco2init(31)
    instr 1
    AF_3D_UpdateListenerRotationMatrix()
    AF_3D_UpdateListenerPosition()
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
    event_i("i", 13, 1, -1)
    event_i("i", 17, 1, -1)
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
    iLineNumber = 0
    while (iLineNumber != -1) do
    SLine, iLineNumber readfi SFileName
    if (iLineNumber == -1) then
    else
    if (iWriteComma == 1) then
    fprints("DawPlayback.json", ",")
    else
    iWriteComma = 1
    endif
    if (strcmp(strsub(SLine, strlen(SLine) - 1, strlen(SLine)), "\\n") == 0) then
    SLine = strsub(SLine, 0, strlen(SLine) - 1)
    endif
    if (iLineNumber > 1) then
    SLine = strsub(SLine, 1, strlen(SLine))
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
    if (strlen(gSPluginUuids[iI][0]) == 32) then
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
    #ifdef IS_GENERATING_JSON
    setPluginUuid(0, 0, "e274e9138ef048c4ba9c4d42e836c85c")
    instr Json_4
    SJsonFile = sprintf("json/%s.0.json", "e274e9138ef048c4ba9c4d42e836c85c")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    #end
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
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    aDistancedOut = aOut * aDistanceAmp
    aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))
    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    else
    a1 = aDistancedOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    gaInstrumentSignals[0][0] = a1
    gaInstrumentSignals[0][1] = a2
    gaInstrumentSignals[0][2] = a3
    gaInstrumentSignals[0][3] = a4
    gaInstrumentSignals[0][4] = aAuxOut
    gaInstrumentSignals[0][5] = aAuxOut
    #ifdef IS_GENERATING_JSON
    if (giTR_808_NoteIndex[0] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_4"))
    endif
    giTR_808_NoteIndex[0] = giTR_808_NoteIndex[0] + 1
    SJsonFile = sprintf("json/%s.%d.json", "e274e9138ef048c4ba9c4d42e836c85c", giTR_808_NoteIndex[0])
    fprints(SJsonFile, "{\\"note\\":{\\"onTime\\":%.3f", times())
    if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
    fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
    endif
    fprints(SJsonFile, "}}")
    ficlose(SJsonFile)
    #end
    endif
    end:
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
    #ifdef IS_GENERATING_JSON
    setPluginUuid(1, 0, "8aac7747b6b44366b1080319e34a8616")
    instr Json_5
    SJsonFile = sprintf("json/%s.0.json", "8aac7747b6b44366b1080319e34a8616")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    #end
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
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    aDistancedOut = aOut * aDistanceAmp
    aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))
    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    else
    a1 = aDistancedOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    gaInstrumentSignals[1][0] = a1
    gaInstrumentSignals[1][1] = a2
    gaInstrumentSignals[1][2] = a3
    gaInstrumentSignals[1][3] = a4
    gaInstrumentSignals[1][4] = aAuxOut
    gaInstrumentSignals[1][5] = aAuxOut
    #ifdef IS_GENERATING_JSON
    if (giTR_808_NoteIndex[1] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_5"))
    endif
    giTR_808_NoteIndex[1] = giTR_808_NoteIndex[1] + 1
    SJsonFile = sprintf("json/%s.%d.json", "8aac7747b6b44366b1080319e34a8616", giTR_808_NoteIndex[1])
    fprints(SJsonFile, "{\\"note\\":{\\"onTime\\":%.3f", times())
    if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
    fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
    endif
    fprints(SJsonFile, "}}")
    ficlose(SJsonFile)
    #end
    endif
    end:
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
    #ifdef IS_GENERATING_JSON
    setPluginUuid(2, 0, "8e12ccc0dff44a4283211d553199a8cd")
    instr Json_6
    SJsonFile = sprintf("json/%s.0.json", "8e12ccc0dff44a4283211d553199a8cd")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    #end
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
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    aDistancedOut = aOut * aDistanceAmp
    aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))
    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    else
    a1 = aDistancedOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    gaInstrumentSignals[2][0] = a1
    gaInstrumentSignals[2][1] = a2
    gaInstrumentSignals[2][2] = a3
    gaInstrumentSignals[2][3] = a4
    gaInstrumentSignals[2][4] = aAuxOut
    gaInstrumentSignals[2][5] = aAuxOut
    #ifdef IS_GENERATING_JSON
    if (giTR_808_NoteIndex[2] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_6"))
    endif
    giTR_808_NoteIndex[2] = giTR_808_NoteIndex[2] + 1
    SJsonFile = sprintf("json/%s.%d.json", "8e12ccc0dff44a4283211d553199a8cd", giTR_808_NoteIndex[2])
    fprints(SJsonFile, "{\\"note\\":{\\"onTime\\":%.3f", times())
    if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
    fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
    endif
    fprints(SJsonFile, "}}")
    ficlose(SJsonFile)
    #end
    endif
    end:
    endin
    instr Preallocate_6
    ii = 0
    while (ii < giPresetUuidPreallocationCount[2]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 6, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 6))
    #ifdef IS_GENERATING_JSON
    setPluginUuid(3, 0, "6aecd056fd3f4c6d9a108de531c48ddf")
    instr Json_7
    SJsonFile = sprintf("json/%s.0.json", "6aecd056fd3f4c6d9a108de531c48ddf")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    #end
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
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    aDistancedOut = aOut * aDistanceAmp
    aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))
    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    else
    a1 = aDistancedOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    gaInstrumentSignals[3][0] = a1
    gaInstrumentSignals[3][1] = a2
    gaInstrumentSignals[3][2] = a3
    gaInstrumentSignals[3][3] = a4
    gaInstrumentSignals[3][4] = aAuxOut
    gaInstrumentSignals[3][5] = aAuxOut
    #ifdef IS_GENERATING_JSON
    if (giTR_808_NoteIndex[3] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_7"))
    endif
    giTR_808_NoteIndex[3] = giTR_808_NoteIndex[3] + 1
    SJsonFile = sprintf("json/%s.%d.json", "6aecd056fd3f4c6d9a108de531c48ddf", giTR_808_NoteIndex[3])
    fprints(SJsonFile, "{\\"note\\":{\\"onTime\\":%.3f", times())
    if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
    fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
    endif
    fprints(SJsonFile, "}}")
    ficlose(SJsonFile)
    #end
    endif
    end:
    endin
    instr Preallocate_7
    ii = 0
    while (ii < giPresetUuidPreallocationCount[3]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 7, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 7))
    #ifdef IS_GENERATING_JSON
    setPluginUuid(4, 0, "e3e7d57082834a28b53e021beaeb783d")
    instr Json_8
    SJsonFile = sprintf("json/%s.0.json", "e3e7d57082834a28b53e021beaeb783d")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    #end
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
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    aDistancedOut = aOut * aDistanceAmp
    aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))
    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    else
    a1 = aDistancedOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    gaInstrumentSignals[4][0] = a1
    gaInstrumentSignals[4][1] = a2
    gaInstrumentSignals[4][2] = a3
    gaInstrumentSignals[4][3] = a4
    gaInstrumentSignals[4][4] = aAuxOut
    gaInstrumentSignals[4][5] = aAuxOut
    #ifdef IS_GENERATING_JSON
    if (giTR_808_NoteIndex[4] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_8"))
    endif
    giTR_808_NoteIndex[4] = giTR_808_NoteIndex[4] + 1
    SJsonFile = sprintf("json/%s.%d.json", "e3e7d57082834a28b53e021beaeb783d", giTR_808_NoteIndex[4])
    fprints(SJsonFile, "{\\"note\\":{\\"onTime\\":%.3f", times())
    if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
    fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
    endif
    fprints(SJsonFile, "}}")
    ficlose(SJsonFile)
    #end
    endif
    end:
    endin
    instr Preallocate_8
    ii = 0
    while (ii < giPresetUuidPreallocationCount[4]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 8, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 8))
    #ifdef IS_GENERATING_JSON
    setPluginUuid(5, 0, "02c103e8fcef483292ebc49d3898ef96")
    instr Json_9
    SJsonFile = sprintf("json/%s.0.json", "02c103e8fcef483292ebc49d3898ef96")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    #end
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
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    aDistancedOut = aOut * aDistanceAmp
    aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))
    AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aDistancedOut
    else
    a1 = aDistancedOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    gaInstrumentSignals[5][0] = a1
    gaInstrumentSignals[5][1] = a2
    gaInstrumentSignals[5][2] = a3
    gaInstrumentSignals[5][3] = a4
    gaInstrumentSignals[5][4] = aAuxOut
    gaInstrumentSignals[5][5] = aAuxOut
    #ifdef IS_GENERATING_JSON
    if (giTR_808_NoteIndex[5] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_9"))
    endif
    giTR_808_NoteIndex[5] = giTR_808_NoteIndex[5] + 1
    SJsonFile = sprintf("json/%s.%d.json", "02c103e8fcef483292ebc49d3898ef96", giTR_808_NoteIndex[5])
    fprints(SJsonFile, "{\\"note\\":{\\"onTime\\":%.3f", times())
    if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
    fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
    endif
    fprints(SJsonFile, "}}")
    ficlose(SJsonFile)
    #end
    endif
    end:
    endin
    instr Preallocate_9
    ii = 0
    while (ii < giPresetUuidPreallocationCount[5]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 9, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 9))
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
    opcode json_start_i, 0, 0
    prints("{\\"csound\\":{")
    endop
    opcode json_start_k, 0, 0
    printsk("{\\"csound\\":{")
    endop
    opcode json_end_i, 0, 0
    prints("}}")
    endop
    opcode json_end_k, 0, 0
    printsk("}}")
    endop
    instr Json_CloseFile
    ficlose(strget(p4))
    turnoff
    endin
    giTriangle2Synth_PlaybackVolumeAdjustment = 0.9
    giTriangle2Synth_PlaybackReverbAdjustment = 1.5
    giTriangle2Synth_NoteNumberLfoAmp = 0.333
    giTriangle2Synth_NoteIndex[] init 1
    giTriangle2Synth_LfoShapeTable = ftgen(0, 0, 60, 7, 0, 15, 1, 30, -1, 15, 0)
    #ifdef IS_GENERATING_JSON
    setPluginUuid(6, 0, "fd575f03378047af835c19ef4f7d5991")
    instr Json_10
    SJsonFile = sprintf("json/%s.0.json", "fd575f03378047af835c19ef4f7d5991")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, sprintf(",\\"pitchLfoAmp\\":%.3f", giTriangle2Synth_NoteNumberLfoAmp))
    fprints(SJsonFile, ",\\"pitchLfoShape\\":[")
    iLfoShapeTableIndex = 0
    while (iLfoShapeTableIndex < 60) do
    if (iLfoShapeTableIndex > 0) then
    fprints(SJsonFile, ",")
    endif
    fprints(SJsonFile, sprintf("%.3f", tab_i(iLfoShapeTableIndex, giTriangle2Synth_LfoShapeTable)))
    iLfoShapeTableIndex += 1
    od
    fprints(SJsonFile, "]}")
    turnoff
    endin
    #end
    gkNoteNumberLfo init 0
    instr GlobalNoteNumberLfo_10
    gkNoteNumberLfo = abs(lfo(33, .03, 1))
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
    iNoteNumberLfoTime = i(gkNoteNumberLfo)
    iOrcInstanceIndex = 0
    aOut = 0
    a1 = 0
    a2 = 0
    a3 = 0
    a4 = 0
    kAmp init 0.333 * (iVelocity / 127)
    kNoteNumber = iNoteNumber + lfo(giTriangle2Synth_NoteNumberLfoAmp, iNoteNumberLfoTime, 1)
    aOut = vco2(kAmp, cpsmidinn(kNoteNumber), 12)
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
    iPositionLagTime = 2
    kPositionMaxAmpWhenClose = lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionMaxAmpWhenClose], iPositionLagTime)
    kPositionReferenceDistance = lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionReferenceDistance], iPositionLagTime)
    kPositionRolloffFactor = lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionRolloffFactor], iPositionLagTime)
    kX, kY, kZ dEd_position gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionOpcodeComboBoxIndex]
    kX *= lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionXScale], iPositionLagTime)
    kY *= lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionYScale], iPositionLagTime)
    kZ *= lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionZScale], iPositionLagTime)
    kX += lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionXOffset], iPositionLagTime)
    kY += lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionYOffset], iPositionLagTime)
    kZ += lag:k(gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionZOffset], iPositionLagTime)
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aOut *= min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aOut
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
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_10"))
    endif
    giTriangle2Synth_NoteIndex[0] = giTriangle2Synth_NoteIndex[0] + 1
    SJsonFile = sprintf("json/%s.%d.json",
    "fd575f03378047af835c19ef4f7d5991",
    giTriangle2Synth_NoteIndex[0])
    iOnTime = times()
    SJsonData = sprintf("{\\"note\\":{\\"onTime\\":%.3f,\\"pitch\\":%.3f,\\"pitchLfoTime\\":%.3f",
    iOnTime, iNoteNumber, iNoteNumberLfoTime)
    if (lastcycle() == 1) then
    fprintks(SJsonFile, SJsonData)
    if (gkCcValues_Triangle2Synth[iOrcInstanceIndex][giCc_Triangle2Synth_positionEnabled] == 1 && giTriangle2Synth_NoteIndex[0] == 1) then
    fprintks(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", kX, kY, kZ)
    endif
    fprintks(SJsonFile, ",\\"offTime\\":%.3f}}", timeinsts() + iOnTime)
    scoreline(sprintfk("i \\"Json_CloseFile\\" 0 -1 \\"%s\\"", SJsonFile), 1)
    endif
    #end
    endif
    end:
    endin
    instr Preallocate_10
    ii = 0
    while (ii < giPresetUuidPreallocationCount[6]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 10, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 10))
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
    gSTriangle4BassMonoSynth_Json[] init 2
    giTriangle4BassMonoSynth_PlaybackVolumeAdjustment = 0.9
    giTriangle4BassMonoSynth_PlaybackReverbAdjustment = 1.5
    #ifdef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
    #undef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
    #end
    #ifdef TriangleBassMonoSynth_NoteNumberLagTime
    #undef TriangleBassMonoSynth_NoteNumberLagTime
    #end
    #ifdef TriangleMonoSynth_VcoBandwith
    #undef TriangleMonoSynth_VcoBandwith
    #end
    #define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05 #
    #define TriangleMonoSynth_NoteNumberLagTime # 0.215 #
    #define TriangleMonoSynth_VcoBandwith # 0.075 #
    #ifndef TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
    #define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime #0.05#
    #end
    #ifndef TriangleMonoSynth_NoteNumberLagTime
    #define TriangleMonoSynth_NoteNumberLagTime #0.1#
    #end
    #ifndef TriangleMonoSynth_VcoBandwith
    #define TriangleMonoSynth_VcoBandwith #0.5#
    #end
    #ifdef IS_GENERATING_JSON
    setPluginUuid(7, 0, "ab018f191c70470f98ac3becb76e6d13")
    instr Json_11
    SJsonFile = sprintf("json/%s.0.json", "ab018f191c70470f98ac3becb76e6d13")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    instr JsonAppend_11
    gSTriangle4BassMonoSynth_Json[0] = strcat(gSTriangle4BassMonoSynth_Json[0], strget(p4))
    turnoff
    endin
    instr JsonWrite_11
    SJsonFile = sprintf("json/%s.%d.json",
    "ab018f191c70470f98ac3becb76e6d13",
    giTriangle4BassMonoSynth_NoteIndex[0])
    iStringLength = strlen(gSTriangle4BassMonoSynth_Json[0])
    ii = 0
    while (ii < iStringLength / 100) do
    fprints(SJsonFile, strsub(gSTriangle4BassMonoSynth_Json[0], 100 * ii, 100 * ii + 100))
    ii += 1
    od
    if (100 * ii < iStringLength) then
    fprints(SJsonFile, strsub(gSTriangle4BassMonoSynth_Json[0], 100 * ii, iStringLength))
    endif
    fprints(SJsonFile, "]}}")
    ficlose(SJsonFile)
    gSTriangle4BassMonoSynth_Json[0] = ""
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
    elseif (iEventType == 7) then
    giTriangle4BassMonoSynth_MonoHandlerIsActive[0] = 0
    #ifdef IS_GENERATING_JSON
    event_i("i", "JsonWrite_11", 0, -1)
    #end
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
    #ifdef IS_GENERATING_JSON
    if (giTriangle4BassMonoSynth_NoteIndex[0] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_11"))
    endif
    giTriangle4BassMonoSynth_NoteIndex[0] = giTriangle4BassMonoSynth_NoteIndex[0] + 1
    iStartTime = times()
    kTime = (times:k() - 1 / kr) - iStartTime
    SiJson = sprintf("{\\"note\\":{\\"onTime\\":%.3f", iStartTime)
    SiJson = strcat(SiJson, ",\\"k\\":[")
    scoreline_i(sprintf("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_11", string_escape_i(SiJson)))
    #end
    iVolumeEnvelopeSlope = giSecondsPerSample / $TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
    kVolumeEnvelopeModifier init 0
    kActiveNoteCount = gkTriangle4BassMonoSynth_ActiveNoteCount[0]
    kActiveNoteCountPrevious init 0
    kNoteNumberWhenActivated init 0
    kActiveNoteCountChanged = 0
    kNoteNumberNeedsLag init 0
    if (changed2(kActiveNoteCount) == 1 || kActiveNoteCountPrevious == 0) then
    if (kActiveNoteCount == 1 && kActiveNoteCountPrevious == 0) then
    kNoteNumberWhenActivated = gkTriangle4BassMonoSynth_NoteNumber[0]
    kActiveNoteCountChanged = 1
    kNoteNumberNeedsLag = 0
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
    #ifdef IS_GENERATING_JSON
    SkJson = sprintfk(",{\\"time\\":%.3f,\\"volume\\":0}", kTime)
    scoreline(sprintfk("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_11", string_escape_k(SkJson)), k(1))
    #end
    turnoff
    endif
    kgoto end__mono_handler
    endif
    kNoteNumber init 0
    kCurrentNoteNumber = gkTriangle4BassMonoSynth_NoteNumber[0]
    if (changed2(kCurrentNoteNumber) == 1) then
    if (kActiveNoteCountChanged == 0) then
    kNoteNumberNeedsLag = 1
    endif
    endif
    kNoteNumberLagTime init 0
    if (kNoteNumberNeedsLag == 0) then
    kNoteNumberLagTime = 0
    else
    kNoteNumberLagTime = $TriangleMonoSynth_NoteNumberLagTime
    endif
    kNoteNumber = lag:k(kCurrentNoteNumber, kNoteNumberLagTime)
    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(iAmp, kCps, 12, 0.5, 0, $TriangleMonoSynth_VcoBandwith)
    aOut *= aVolumeEnvelope
    if (gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionEnabled] == 1) then
    iPositionLagTime = 2
    kPositionMaxAmpWhenClose = lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionMaxAmpWhenClose], iPositionLagTime)
    kPositionReferenceDistance = lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionReferenceDistance], iPositionLagTime)
    kPositionRolloffFactor = lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionRolloffFactor], iPositionLagTime)
    kX, kY, kZ dEd_position gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionOpcodeComboBoxIndex]
    kX *= lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXScale], iPositionLagTime)
    kY *= lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYScale], iPositionLagTime)
    kZ *= lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZScale], iPositionLagTime)
    kX += lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXOffset], iPositionLagTime)
    kY += lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYOffset], iPositionLagTime)
    kZ += lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZOffset], iPositionLagTime)
    iScaleFactorX = random:i(-20, 20)
    kX *= iScaleFactorX
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aOut *= min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aOut
    else
    a1 = aOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    #ifdef IS_GENERATING_JSON
    kJsonChanged_Any init 1
    kJsonChanged_NoteNumber init 1
    kJsonChanged_Volume init 1
    kJsonChanged_X init 1
    kJsonChanged_Y init 1
    kJsonChanged_Z init 1
    kJsonPrevious_NoteNumber init 0
    kJsonPrevious_Volume init 0
    kJsonPrevious_X init 0
    kJsonPrevious_Y init 0
    kJsonPrevious_Z init 0
    kNoteNumber_Rounded = round:k(kNoteNumber * 1000) / 1000
    kVolume_Rounded = round:k(kVolumeEnvelope * 1000) / 1000
    kX_Rounded = round:k(kX * 1000) / 1000
    kY_Rounded = round:k(kY * 1000) / 1000
    kZ_Rounded = round:k(kZ * 1000) / 1000
    kJsonFirstPass init 1
    if (kJsonFirstPass == 0) then
    kJsonChanged_Any = 0
    kJsonChanged_NoteNumber = 0
    kJsonChanged_Volume = 0
    kJsonChanged_X = 0
    kJsonChanged_Y = 0
    kJsonChanged_Z = 0
    if (kJsonPrevious_NoteNumber != kNoteNumber_Rounded) then
    kJsonPrevious_NoteNumber = kNoteNumber_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_NoteNumber = 1
    endif
    if (kJsonPrevious_Volume != kVolume_Rounded) then
    kJsonPrevious_Volume = kVolume_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_Volume = 1
    endif
    if (kJsonPrevious_X != kX_Rounded) then
    kJsonPrevious_X = kX_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_X = 1
    endif
    if (kJsonPrevious_Y != kY_Rounded) then
    kJsonPrevious_Y = kY_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_Y = 1
    endif
    if (kJsonPrevious_Z != kZ_Rounded) then
    kJsonPrevious_Z = kZ_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_Z = 1
    endif
    endif
    if (kJsonChanged_Any == 1) then
    SkJson = sprintfk("%s", "")
    if (kJsonFirstPass == 0) then
    SkJson = strcatk(SkJson, "\\n,")
    endif
    SkJson = strcatk(SkJson, "{")
    SkJson = strcatk(SkJson, sprintfk("\\"time\\":%.3f", kTime))
    if (kJsonChanged_NoteNumber == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"pitch\\":%.3f", kNoteNumber_Rounded))
    endif
    if (kJsonChanged_Volume == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"volume\\":%.3f", kVolume_Rounded))
    endif
    if (gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionEnabled] == 1) then
    if (kJsonChanged_X == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"x\\":%.3f", kX_Rounded))
    endif
    if (kJsonChanged_Y == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"y\\":%.3f", kY_Rounded))
    endif
    if (kJsonChanged_Z == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"z\\":%.3f", kZ_Rounded))
    endif
    endif
    SkJson = strcatk(SkJson, "}")
    scoreline(sprintfk("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_11", string_escape_k(SkJson)), k(1))
    endif
    kJsonFirstPass = 0
    #end
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
    instr Preallocate_11
    ii = 0
    while (ii < giPresetUuidPreallocationCount[7]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 11, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 11))
    #ifdef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
    #undef TriangleBassMonoSynth_VolumeEnvelopeAttackAndDecayTime
    #end
    #ifdef TriangleBassMonoSynth_NoteNumberLagTime
    #undef TriangleBassMonoSynth_NoteNumberLagTime
    #end
    #ifdef TriangleMonoSynth_VcoBandwith
    #undef TriangleMonoSynth_VcoBandwith
    #end
    #define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05 #
    #define TriangleMonoSynth_NoteNumberLagTime # 0.215 #
    #define TriangleMonoSynth_VcoBandwith # 0.075 #
    #ifndef TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
    #define TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime #0.05#
    #end
    #ifndef TriangleMonoSynth_NoteNumberLagTime
    #define TriangleMonoSynth_NoteNumberLagTime #0.1#
    #end
    #ifndef TriangleMonoSynth_VcoBandwith
    #define TriangleMonoSynth_VcoBandwith #0.5#
    #end
    #ifdef IS_GENERATING_JSON
    setPluginUuid(8, 0, "b0ba6f144fac4f668ba6981c691277d6")
    instr Json_12
    SJsonFile = sprintf("json/%s.0.json", "b0ba6f144fac4f668ba6981c691277d6")
    fprints(SJsonFile, "{")
    fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", "-"))
    fprints(SJsonFile, "}")
    turnoff
    endin
    instr JsonAppend_12
    gSTriangle4BassMonoSynth_Json[1] = strcat(gSTriangle4BassMonoSynth_Json[1], strget(p4))
    turnoff
    endin
    instr JsonWrite_12
    SJsonFile = sprintf("json/%s.%d.json",
    "b0ba6f144fac4f668ba6981c691277d6",
    giTriangle4BassMonoSynth_NoteIndex[1])
    iStringLength = strlen(gSTriangle4BassMonoSynth_Json[1])
    ii = 0
    while (ii < iStringLength / 100) do
    fprints(SJsonFile, strsub(gSTriangle4BassMonoSynth_Json[1], 100 * ii, 100 * ii + 100))
    ii += 1
    od
    if (100 * ii < iStringLength) then
    fprints(SJsonFile, strsub(gSTriangle4BassMonoSynth_Json[1], 100 * ii, iStringLength))
    endif
    fprints(SJsonFile, "]}}")
    ficlose(SJsonFile)
    gSTriangle4BassMonoSynth_Json[1] = ""
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
    elseif (iEventType == 7) then
    giTriangle4BassMonoSynth_MonoHandlerIsActive[1] = 0
    #ifdef IS_GENERATING_JSON
    event_i("i", "JsonWrite_12", 0, -1)
    #end
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
    #ifdef IS_GENERATING_JSON
    if (giTriangle4BassMonoSynth_NoteIndex[1] == 0) then
    scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_12"))
    endif
    giTriangle4BassMonoSynth_NoteIndex[1] = giTriangle4BassMonoSynth_NoteIndex[1] + 1
    iStartTime = times()
    kTime = (times:k() - 1 / kr) - iStartTime
    SiJson = sprintf("{\\"note\\":{\\"onTime\\":%.3f", iStartTime)
    SiJson = strcat(SiJson, ",\\"k\\":[")
    scoreline_i(sprintf("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_12", string_escape_i(SiJson)))
    #end
    iVolumeEnvelopeSlope = giSecondsPerSample / $TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
    kVolumeEnvelopeModifier init 0
    kActiveNoteCount = gkTriangle4BassMonoSynth_ActiveNoteCount[1]
    kActiveNoteCountPrevious init 0
    kNoteNumberWhenActivated init 0
    kActiveNoteCountChanged = 0
    kNoteNumberNeedsLag init 0
    if (changed2(kActiveNoteCount) == 1 || kActiveNoteCountPrevious == 0) then
    if (kActiveNoteCount == 1 && kActiveNoteCountPrevious == 0) then
    kNoteNumberWhenActivated = gkTriangle4BassMonoSynth_NoteNumber[1]
    kActiveNoteCountChanged = 1
    kNoteNumberNeedsLag = 0
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
    #ifdef IS_GENERATING_JSON
    SkJson = sprintfk(",{\\"time\\":%.3f,\\"volume\\":0}", kTime)
    scoreline(sprintfk("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_12", string_escape_k(SkJson)), k(1))
    #end
    turnoff
    endif
    kgoto end__mono_handler
    endif
    kNoteNumber init 0
    kCurrentNoteNumber = gkTriangle4BassMonoSynth_NoteNumber[1]
    if (changed2(kCurrentNoteNumber) == 1) then
    if (kActiveNoteCountChanged == 0) then
    kNoteNumberNeedsLag = 1
    endif
    endif
    kNoteNumberLagTime init 0
    if (kNoteNumberNeedsLag == 0) then
    kNoteNumberLagTime = 0
    else
    kNoteNumberLagTime = $TriangleMonoSynth_NoteNumberLagTime
    endif
    kNoteNumber = lag:k(kCurrentNoteNumber, kNoteNumberLagTime)
    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(iAmp, kCps, 12, 0.5, 0, $TriangleMonoSynth_VcoBandwith)
    aOut *= aVolumeEnvelope
    if (gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionEnabled] == 1) then
    iPositionLagTime = 2
    kPositionMaxAmpWhenClose = lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionMaxAmpWhenClose], iPositionLagTime)
    kPositionReferenceDistance = lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionReferenceDistance], iPositionLagTime)
    kPositionRolloffFactor = lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionRolloffFactor], iPositionLagTime)
    kX, kY, kZ dEd_position gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionOpcodeComboBoxIndex]
    kX *= lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXScale], iPositionLagTime)
    kY *= lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYScale], iPositionLagTime)
    kZ *= lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZScale], iPositionLagTime)
    kX += lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionXOffset], iPositionLagTime)
    kY += lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionYOffset], iPositionLagTime)
    kZ += lag:k(gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionZOffset], iPositionLagTime)
    iScaleFactorX = random:i(-20, 20)
    kX *= iScaleFactorX
    aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
    aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
    aOut *= min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
    AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
    a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aOut
    a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aOut
    else
    a1 = aOut
    a2 = 0
    a3 = 0
    a4 = 0
    endif
    #ifdef IS_GENERATING_JSON
    kJsonChanged_Any init 1
    kJsonChanged_NoteNumber init 1
    kJsonChanged_Volume init 1
    kJsonChanged_X init 1
    kJsonChanged_Y init 1
    kJsonChanged_Z init 1
    kJsonPrevious_NoteNumber init 0
    kJsonPrevious_Volume init 0
    kJsonPrevious_X init 0
    kJsonPrevious_Y init 0
    kJsonPrevious_Z init 0
    kNoteNumber_Rounded = round:k(kNoteNumber * 1000) / 1000
    kVolume_Rounded = round:k(kVolumeEnvelope * 1000) / 1000
    kX_Rounded = round:k(kX * 1000) / 1000
    kY_Rounded = round:k(kY * 1000) / 1000
    kZ_Rounded = round:k(kZ * 1000) / 1000
    kJsonFirstPass init 1
    if (kJsonFirstPass == 0) then
    kJsonChanged_Any = 0
    kJsonChanged_NoteNumber = 0
    kJsonChanged_Volume = 0
    kJsonChanged_X = 0
    kJsonChanged_Y = 0
    kJsonChanged_Z = 0
    if (kJsonPrevious_NoteNumber != kNoteNumber_Rounded) then
    kJsonPrevious_NoteNumber = kNoteNumber_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_NoteNumber = 1
    endif
    if (kJsonPrevious_Volume != kVolume_Rounded) then
    kJsonPrevious_Volume = kVolume_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_Volume = 1
    endif
    if (kJsonPrevious_X != kX_Rounded) then
    kJsonPrevious_X = kX_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_X = 1
    endif
    if (kJsonPrevious_Y != kY_Rounded) then
    kJsonPrevious_Y = kY_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_Y = 1
    endif
    if (kJsonPrevious_Z != kZ_Rounded) then
    kJsonPrevious_Z = kZ_Rounded
    kJsonChanged_Any = 1
    kJsonChanged_Z = 1
    endif
    endif
    if (kJsonChanged_Any == 1) then
    SkJson = sprintfk("%s", "")
    if (kJsonFirstPass == 0) then
    SkJson = strcatk(SkJson, "\\n,")
    endif
    SkJson = strcatk(SkJson, "{")
    SkJson = strcatk(SkJson, sprintfk("\\"time\\":%.3f", kTime))
    if (kJsonChanged_NoteNumber == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"pitch\\":%.3f", kNoteNumber_Rounded))
    endif
    if (kJsonChanged_Volume == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"volume\\":%.3f", kVolume_Rounded))
    endif
    if (gkCcValues_Triangle4BassMonoSynth[iOrcInstanceIndex][giCc_Triangle4BassMonoSynth_positionEnabled] == 1) then
    if (kJsonChanged_X == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"x\\":%.3f", kX_Rounded))
    endif
    if (kJsonChanged_Y == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"y\\":%.3f", kY_Rounded))
    endif
    if (kJsonChanged_Z == 1) then
    SkJson = strcatk(SkJson, sprintfk(",\\"z\\":%.3f", kZ_Rounded))
    endif
    endif
    SkJson = strcatk(SkJson, "}")
    scoreline(sprintfk("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_12", string_escape_k(SkJson)), k(1))
    endif
    kJsonFirstPass = 0
    #end
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
    instr Preallocate_12
    ii = 0
    while (ii < giPresetUuidPreallocationCount[8]) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", 12, ii, 3))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 12))
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
    instr 15
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
    if (9 < gi_instrumentCount) then
    aIn[kI] = gaInstrumentSignals[9][kJ]
    else
    iAuxTrackIndex = 9 - gi_instrumentCount
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
    iAuxTrackIndex = 9
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
    instr Preallocate_15
    ii = 0
    while (ii < 4) do
    scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", 15, ii))
    ii += 1
    od
    turnoff
    endin
    scoreline_i(sprintf("i \\"Preallocate_%d\\" 0 -1", 15))
    instr 13
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
    instr 14
    k_aux = p4 - gi_auxIndexOffset
    k_track = p5 - gi_instrumentIndexOffset
    k_channel = p6
    k_volume = p7
    ga_auxVolumes[k_aux][k_track][k_channel] = k_volume
    turnoff
    endin
    instr 16
    k_track = p4 - gi_instrumentIndexOffset
    k_channel = p5
    k_volume = p6
    ga_masterVolumes[k_track][k_channel] = k_volume
    turnoff
    endin
    instr 17
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
    am0 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[0]), $AF_3D_LISTENER_LAG_TIME)
    am1 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[1]), $AF_3D_LISTENER_LAG_TIME)
    am2 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[2]), $AF_3D_LISTENER_LAG_TIME)
    am3 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[3]), $AF_3D_LISTENER_LAG_TIME)
    am4 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[4]), $AF_3D_LISTENER_LAG_TIME)
    am5 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[5]), $AF_3D_LISTENER_LAG_TIME)
    am6 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[6]), $AF_3D_LISTENER_LAG_TIME)
    am7 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[7]), $AF_3D_LISTENER_LAG_TIME)
    am8 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[8]), $AF_3D_LISTENER_LAG_TIME)
    ayr = -(ay * am0 + az * am3 + ax * am6)
    azr = ay * am1 + az * am4 + ax * am7
    axr = -(ay * am2 + az * am5 + ax * am8)
    iHrirLength = ftlen(gi_AF_3D_HrirChannel1TableNumber)
    aw ftconv aw, gi_AF_3D_HrirChannel1TableNumber, iHrirLength
    ay ftconv ayr, gi_AF_3D_HrirChannel2TableNumber, iHrirLength
    az ftconv azr, gi_AF_3D_HrirChannel3TableNumber, iHrirLength
    ax ftconv axr, gi_AF_3D_HrirChannel4TableNumber, iHrirLength
    aL = aw + ay + az + ax
    aR = aw - ay + az + ax
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
    #define SCORE_START_DELAY #3.5#
    #end
    i 1 0 -1
    i "SendEndedMessage" 0 1
    #ifdef IS_MIXDOWN
    i "SetMixdownListenerPosition" 1 -1
    #end
    i 2 0 -1 9 0 1 9
    i 15.1 0 -1 1 0 0
    i 14 0.004 1 9 0 0 0.33
    i 14 0.004 1 9 0 1 0.33
    i 14 0.004 1 9 0 2 0.33
    i 14 0.004 1 9 0 3 0.33
    i 14 0.004 1 9 0 4 0.12
    i 14 0.004 1 9 0 5 0.12
    i 14 0.004 1 9 1 0 0.20
    i 14 0.004 1 9 1 1 0.20
    i 14 0.004 1 9 1 2 0.20
    i 14 0.004 1 9 1 3 0.20
    i 14 0.004 1 9 1 4 0.07
    i 14 0.004 1 9 1 5 0.07
    i 14 0.004 1 9 2 0 0.20
    i 14 0.004 1 9 2 1 0.20
    i 14 0.004 1 9 2 2 0.20
    i 14 0.004 1 9 2 3 0.20
    i 14 0.004 1 9 2 4 0.07
    i 14 0.004 1 9 2 5 0.07
    i 14 0.004 1 9 3 0 0.06
    i 14 0.004 1 9 3 1 0.06
    i 14 0.004 1 9 3 2 0.06
    i 14 0.004 1 9 3 3 0.06
    i 14 0.004 1 9 3 4 0.06
    i 14 0.004 1 9 3 5 0.06
    i 14 0.004 1 9 4 0 0.06
    i 14 0.004 1 9 4 1 0.06
    i 14 0.004 1 9 4 2 0.06
    i 14 0.004 1 9 4 3 0.06
    i 14 0.004 1 9 4 4 0.06
    i 14 0.004 1 9 4 5 0.06
    i 14 0.004 1 9 5 0 0.03
    i 14 0.004 1 9 5 1 0.03
    i 14 0.004 1 9 5 2 0.03
    i 14 0.004 1 9 5 3 0.03
    i 14 0.004 1 9 5 4 0.03
    i 14 0.004 1 9 5 5 0.03
    i 14 0.004 1 9 6 0 0.12
    i 14 0.004 1 9 6 1 0.12
    i 14 0.004 1 9 6 2 0.12
    i 14 0.004 1 9 6 3 0.12
    i 14 0.004 1 9 6 4 0.03
    i 14 0.004 1 9 6 5 0.03
    i 14 0.004 1 9 7 0 0.43
    i 14 0.004 1 9 7 1 0.43
    i 14 0.004 1 9 7 2 0.43
    i 14 0.004 1 9 7 3 0.43
    i 14 0.004 1 9 8 0 0.43
    i 14 0.004 1 9 8 1 0.43
    i 14 0.004 1 9 8 2 0.43
    i 14 0.004 1 9 8 3 0.43
    i 14 0.004 1 9 8 4 0.41
    i 14 0.004 1 9 8 5 0.41
    i 16 0.004 1 9 0 0.71
    i 16 0.004 1 9 1 0.71
    i 16 0.004 1 9 2 0.71
    i 16 0.004 1 9 3 0.71
    i 16 0.004 1 9 4 0.71
    i 16 0.004 1 9 5 0.71
    i "EndOfInstrumentAllocations" 3 -1
    i "SendStartupMessage" 0 1
    i "SendStartupMessage" 4 -1
    b $SCORE_START_DELAY
    i 11 0.01 1 4 2 100.00
    i 11 0.01 1 4 3 0.25
    i 11 0.01 1 4 4 1.00
    i 11 0.01 1 4 5 ""
    i 12 0.01 1 4 0 0.00
    i 7 0.01 1 4 2 100.00
    i 4 0.01 1 4 2 100.00
    i 5 0.01 1 4 2 50.00
    i 6 0.01 1 4 2 50.00
    i 12 0.01 1 4 2 100.00
    i 4 0.01 1 4 3 1.00
    i 6 0.01 1 4 3 1.00
    i 12 0.01 1 4 4 1.00
    i 6 0.01 1 4 4 1.00
    i 7 0.01 1 4 3 1.00
    i 8 0.01 1 4 2 100.00
    i 5 0.01 1 4 3 1.00
    i 4 0.01 1 4 4 1.00
    i 12 0.01 1 4 5 ""
    i 6 0.01 1 4 5 "<none>"
    i 8 0.01 1 4 3 1.00
    i 5 0.01 1 4 4 1.00
    i 4 0.01 1 4 5 "<none>"
    i 7 0.01 1 4 4 1.00
    i 8 0.01 1 4 4 3.00
    i 5 0.01 1 4 5 "<none>"
    i 6 0.01 1 4 9 92.72
    i 8 0.01 1 4 5 "random_XZ"
    i 9 0.01 1 4 2 100.00
    i 5 0.01 1 4 9 -92.72
    i 7 0.01 1 4 5 "<none>"
    i 4 0.01 1 4 11 -107.09
    i 8 0.01 1 4 10 20.00
    i 9 0.01 1 4 3 1.00
    i 5 0.01 1 4 11 53.54
    i 6 0.01 1 4 11 53.54
    i 9 0.01 1 4 4 3.00
    i 9 0.01 1 4 5 "random_XZ"
    i 9 0.01 1 4 6 50.00
    i 9 0.01 1 4 8 50.00
    i 9 0.01 1 4 10 60.00
    i 10 0.01 1 4 2 50.00
    i 10 0.01 1 4 3 1.00
    i 10 0.01 1 4 4 1.00
    i 10 0.01 1 4 5 "<none>"
    i 10 0.01 1 4 11 -300.00
    i 15 0.01 1 4 0 1.00
    i 15 0.01 1 4 1 0.95
    i 15 0.01 1 4 2 14160.00
    i 15 0.01 1 4 5 1.00
    i 8.021 2.000 0.001 1 49 127
    i 8.022 2.124 0.001 1 49 127
    i 8.023 2.249 0.001 1 49 127
    i 8.024 2.375 0.001 1 49 127
    i 8.025 2.500 0.001 1 49 127
    i 8.026 2.624 0.001 1 49 127
    i 8.027 2.749 0.001 1 49 127
    i 8.028 2.875 0.001 1 49 127
    i 8.029 3.000 0.001 1 49 127
    i 10.003 3.000 -1.000 1 72 127
    i 10.004 3.000 -1.000 1 76 127
    i 8.030 3.124 0.001 1 49 127
    i 8.031 3.249 0.001 1 49 127
    i 8.032 3.375 0.001 1 49 127
    i 8.033 3.500 0.001 1 49 127
    i 8.034 3.624 0.001 1 49 127
    i 8.035 3.749 0.001 1 49 127
    i 8.036 3.875 0.001 1 49 113
    i 8.037 4.000 0.001 1 49 127
    i -10.003 3.999 0
    i -10.004 3.999 0
    i 8.038 4.124 0.001 1 49 127
    i 8.039 4.249 0.001 1 49 127
    i 8.040 4.375 0.001 1 49 127
    i 8.041 4.500 0.001 1 49 127
    i 8.042 4.624 0.001 1 49 127
    i 8.043 4.749 0.001 1 49 127
    i 8.044 4.875 0.001 1 49 127
    i 8.045 5.000 0.001 1 49 127
    i 10.005 5.000 -1.000 1 72 127
    i 10.006 5.000 -1.000 1 76 127
    i 8.046 5.124 0.001 1 49 127
    i 8.047 5.249 0.001 1 49 127
    i 8.048 5.375 0.001 1 49 127
    i 8.049 5.500 0.001 1 49 127
    i 8.050 5.624 0.001 1 49 127
    i 8.051 5.749 0.001 1 49 127
    i 8.052 5.875 0.001 1 49 113
    i 8.053 6.000 0.001 1 49 127
    i -10.005 6.000 0
    i -10.006 6.000 0
    i 4.001 6.000 0.001 1 37 127
    i 8.054 6.124 0.001 1 49 127
    i 8.055 6.249 0.001 1 49 127
    i 8.056 6.375 0.001 1 49 127
    i 8.057 6.500 0.001 1 49 127
    i 7.001 6.500 0.001 1 39 127
    i 8.058 6.624 0.001 1 49 127
    i 8.059 6.749 0.001 1 49 127
    i 8.060 6.875 0.001 1 49 127
    i 8.061 7.000 0.001 1 49 127
    i 10.007 7.000 -1.000 1 72 127
    i 10.008 7.000 -1.000 1 76 127
    i 4.002 7.000 0.001 1 37 127
    i 8.062 7.124 0.001 1 49 127
    i 8.063 7.249 0.001 1 49 127
    i 8.064 7.375 0.001 1 49 127
    i 8.065 7.500 0.001 1 49 127
    i 7.002 7.500 0.001 1 39 127
    i 8.066 7.624 0.001 1 49 127
    i 8.067 7.749 0.001 1 49 127
    i 8.068 7.875 0.001 1 49 113
    i -10.007 7.999 0
    i 4.003 8.000 0.001 1 37 127
    i -10.008 7.999 0
    i 8.069 8.000 0.001 1 49 127
    i 8.070 8.124 0.001 1 49 127
    i 8.071 8.249 0.001 1 49 127
    i 8.072 8.375 0.001 1 49 127
    i 7.003 8.500 0.001 1 39 127
    i 8.073 8.500 0.001 1 49 127
    i 8.074 8.624 0.001 1 49 127
    i 8.075 8.749 0.001 1 49 127
    i 8.076 8.875 0.001 1 49 127
    i 4.004 9.000 0.001 1 37 127
    i 8.077 9.000 0.001 1 49 127
    i 10.009 9.000 -1.000 1 72 127
    i 10.010 9.000 -1.000 1 76 127
    i 8.078 9.124 0.001 1 49 127
    i 8.079 9.249 0.001 1 49 127
    i 8.080 9.375 0.001 1 49 127
    i 8.081 9.500 0.001 1 49 127
    i 7.004 9.500 0.001 1 39 127
    i 8.082 9.624 0.001 1 49 127
    i 8.083 9.749 0.001 1 49 127
    i 8.084 9.875 0.001 1 49 113
    i -10.009 10.000 0
    i -10.010 10.000 0
    i 4.005 10.000 0.001 1 37 127
    i 8.085 10.000 0.001 1 49 127
    i 8.086 10.124 0.001 1 49 127
    i 8.087 10.249 0.001 1 49 127
    i 8.088 10.375 0.001 1 49 127
    i 7.005 10.500 0.001 1 39 127
    i 8.089 10.500 0.001 1 49 127
    i 8.090 10.624 0.001 1 49 127
    i 8.091 10.749 0.001 1 49 127
    i 8.092 10.875 0.001 1 49 127
    i 4.006 11.000 0.001 1 37 127
    i 8.093 11.000 0.001 1 49 127
    i 10.011 11.000 -1.000 1 72 127
    i 10.012 11.000 -1.000 1 76 127
    i 8.094 11.124 0.001 1 49 127
    i 8.095 11.249 0.001 1 49 127
    i 8.096 11.375 0.001 1 49 127
    i 7.006 11.500 0.001 1 39 127
    i 8.097 11.500 0.001 1 49 127
    i 8.098 11.624 0.001 1 49 127
    i 8.099 11.749 0.001 1 49 127
    i 8.100 11.875 0.001 1 49 113
    i 4.007 12.000 0.001 1 37 127
    i -10.011 11.999 0
    i 8.101 12.000 0.001 1 49 127
    i -10.012 11.999 0
    i 8.102 12.124 0.001 1 49 127
    i 8.103 12.249 0.001 1 49 127
    i 8.104 12.375 0.001 1 49 127
    i 7.007 12.500 0.001 1 39 127
    i 8.105 12.500 0.001 1 49 127
    i 8.106 12.624 0.001 1 49 127
    i 8.107 12.749 0.001 1 49 127
    i 8.108 12.875 0.001 1 49 127
    i 4.008 13.000 0.001 1 37 127
    i 8.109 13.000 0.001 1 49 127
    i 10.013 13.000 -1.000 1 72 127
    i 10.014 13.000 -1.000 1 76 127
    i 8.110 13.124 0.001 1 49 127
    i 8.111 13.249 0.001 1 49 127
    i 8.112 13.375 0.001 1 49 127
    i 8.113 13.500 0.001 1 49 127
    i 7.008 13.500 0.001 1 39 127
    i 8.114 13.624 0.001 1 49 127
    i 8.115 13.749 0.001 1 49 127
    i 8.116 13.875 0.001 1 49 113
    i 8.117 14.000 0.001 1 49 127
    i 4.009 14.000 0.001 1 37 127
    i -10.013 14.000 0
    i -10.014 14.000 0
    i 11.001 14.000 -1.000 1 38 81
    i 8.118 14.124 0.001 1 49 127
    i 8.119 14.249 0.001 1 49 127
    i 8.120 14.375 0.001 1 49 127
    i 8.121 14.500 0.001 1 49 127
    i 7.009 14.500 0.001 1 39 127
    i 8.122 14.624 0.001 1 49 127
    i 11.002 14.737 -1.000 1 41 89
    i -11.001 14.744 0
    i 8.123 14.749 0.001 1 49 127
    i 8.124 14.875 0.001 1 49 127
    i 4.010 15.000 0.001 1 37 127
    i 8.125 15.000 0.001 1 49 127
    i 10.015 15.000 -1.000 1 72 127
    i 10.016 15.000 -1.000 1 76 127
    i 8.126 15.124 0.001 1 49 127
    i 8.127 15.249 0.001 1 49 127
    i 11.003 15.255 -1.000 1 38 68
    i -11.002 15.260 0
    i 8.128 15.375 0.001 1 49 127
    i 8.129 15.500 0.001 1 49 127
    i 7.010 15.500 0.001 1 39 127
    i 11.004 15.501 -1.000 1 41 78
    i -11.003 15.509 0
    i 8.130 15.624 0.001 1 49 127
    i 8.131 15.749 0.001 1 49 127
    i 8.132 15.875 0.001 1 49 113
    i 8.133 16.000 0.001 1 49 127
    i -10.015 15.999 0
    i -10.016 15.999 0
    i 4.011 16.000 0.001 1 37 127
    i 11.005 16.012 -1.000 1 38 78
    i -11.004 16.031 0
    i 8.134 16.124 0.001 1 49 127
    i 8.135 16.249 0.001 1 49 127
    i 8.136 16.375 0.001 1 49 127
    i 8.137 16.500 0.001 1 49 127
    i 7.011 16.500 0.001 1 39 127
    i 8.138 16.624 0.001 1 49 127
    i 8.139 16.749 0.001 1 49 127
    i 11.006 16.760 -1.000 1 36 86
    i -11.005 16.768 0
    i 8.140 16.875 0.001 1 49 127
    i 4.012 17.000 0.001 1 37 127
    i 8.141 17.000 0.001 1 49 127
    i 10.017 17.000 -1.000 1 72 127
    i 10.018 17.000 -1.000 1 76 127
    i 8.142 17.124 0.001 1 49 127
    i 8.143 17.249 0.001 1 49 127
    i -11.006 17.257 0
    i 11.007 17.259 -1.000 1 33 74
    i 8.144 17.375 0.001 1 49 127
    i 8.145 17.500 0.001 1 49 127
    i 7.012 17.500 0.001 1 39 127
    i 11.008 17.508 -1.000 1 36 91
    i -11.007 17.517 0
    i 8.146 17.624 0.001 1 49 127
    i 8.147 17.749 0.001 1 49 127
    i 8.148 17.875 0.001 1 49 113
    i 4.013 18.000 0.001 1 37 127
    i 8.149 18.000 0.001 1 49 127
    i -10.017 18.000 0
    i -10.018 18.000 0
    i -11.008 18.000 0
    i 11.009 18.000 -1.000 1 38 81
    i 8.150 18.124 0.001 1 49 127
    i 8.151 18.249 0.001 1 49 127
    i 8.152 18.375 0.001 1 49 127
    i 8.153 18.500 0.001 1 49 127
    i 7.013 18.500 0.001 1 39 127
    i 8.154 18.624 0.001 1 49 127
    i 11.010 18.737 -1.000 1 41 89
    i -11.009 18.744 0
    i 8.155 18.749 0.001 1 49 127
    i 8.156 18.875 0.001 1 49 127
    i 8.157 19.000 0.001 1 49 127
    i 10.019 19.000 -1.000 1 72 127
    i 4.014 19.000 0.001 1 37 127
    i 10.020 19.000 -1.000 1 76 127
    i 8.158 19.124 0.001 1 49 127
    i 8.159 19.249 0.001 1 49 127
    i 11.011 19.255 -1.000 1 38 68
    i -11.010 19.260 0
    i 8.160 19.375 0.001 1 49 127
    i 8.161 19.500 0.001 1 49 127
    i 11.012 19.501 -1.000 1 41 78
    i 7.014 19.500 0.001 1 39 127
    i -11.011 19.509 0
    i 8.162 19.624 0.001 1 49 127
    i 8.163 19.749 0.001 1 49 127
    i 8.164 19.875 0.001 1 49 113
    i 4.015 20.000 0.001 1 37 127
    i 8.165 20.000 0.001 1 49 127
    i -10.019 19.999 0
    i -10.020 19.999 0
    i 11.013 20.012 -1.000 1 38 78
    i -11.012 20.031 0
    i 8.166 20.124 0.001 1 49 127
    i 8.167 20.249 0.001 1 49 127
    i 8.168 20.375 0.001 1 49 127
    i 8.169 20.500 0.001 1 49 127
    i 7.015 20.500 0.001 1 39 127
    i 8.170 20.624 0.001 1 49 127
    i 8.171 20.749 0.001 1 49 127
    i 11.014 20.760 -1.000 1 36 86
    i -11.013 20.768 0
    i 8.172 20.875 0.001 1 49 127
    i 8.173 21.000 0.001 1 49 127
    i 4.016 21.000 0.001 1 37 127
    i 10.021 21.000 -1.000 1 72 127
    i 10.022 21.000 -1.000 1 76 127
    i 8.174 21.124 0.001 1 49 127
    i 8.175 21.249 0.001 1 49 127
    i -11.014 21.257 0
    i 11.015 21.259 -1.000 1 33 74
    i 8.176 21.375 0.001 1 49 127
    i 8.177 21.500 0.001 1 49 127
    i 7.016 21.500 0.001 1 39 127
    i 11.016 21.508 -1.000 1 36 91
    i -11.015 21.517 0
    i 8.178 21.624 0.001 1 49 127
    i 8.179 21.749 0.001 1 49 127
    i 8.180 21.875 0.001 1 49 113
    i -11.016 22.000 0
    i 11.017 22.000 -1.000 1 38 81
    i -10.021 22.000 0
    i -10.022 22.000 0
    i 4.017 22.000 0.001 1 37 127
    i 8.181 22.000 0.001 1 49 127
    i 8.182 22.124 0.001 1 49 127
    i 8.183 22.249 0.001 1 49 127
    i 8.184 22.375 0.001 1 49 127
    i 8.185 22.500 0.001 1 49 127
    i 7.017 22.500 0.001 1 39 127
    i 8.186 22.624 0.001 1 49 127
    i 11.018 22.737 -1.000 1 41 89
    i -11.017 22.744 0
    i 8.187 22.749 0.001 1 49 127
    i 8.188 22.875 0.001 1 49 127
    i 4.018 23.000 0.001 1 37 127
    i 8.189 23.000 0.001 1 49 127
    i 10.023 23.000 -1.000 1 72 127
    i 10.024 23.000 -1.000 1 76 127
    i 8.190 23.124 0.001 1 49 127
    i 8.191 23.249 0.001 1 49 127
    i 11.019 23.255 -1.000 1 38 68
    i -11.018 23.260 0
    i 8.192 23.375 0.001 1 49 127
    i 7.018 23.500 0.001 1 39 127
    i 8.193 23.500 0.001 1 49 127
    i 11.020 23.501 -1.000 1 41 78
    i -11.019 23.509 0
    i 8.194 23.624 0.001 1 49 127
    i 8.195 23.749 0.001 1 49 127
    i 8.196 23.875 0.001 1 49 113
    i 4.019 24.000 0.001 1 37 127
    i -10.023 23.999 0
    i 8.197 24.000 0.001 1 49 127
    i -10.024 23.999 0
    i 11.021 24.012 -1.000 1 38 78
    i -11.020 24.031 0
    i 8.198 24.124 0.001 1 49 127
    i 8.199 24.249 0.001 1 49 127
    i 8.200 24.375 0.001 1 49 127
    i 7.019 24.500 0.001 1 39 127
    i 8.201 24.500 0.001 1 49 127
    i 8.202 24.624 0.001 1 49 127
    i 8.203 24.749 0.001 1 49 127
    i 11.022 24.760 -1.000 1 36 86
    i -11.021 24.768 0
    i 8.204 24.875 0.001 1 49 127
    i 4.020 25.000 0.001 1 37 127
    i 8.205 25.000 0.001 1 49 127
    i 10.025 25.000 -1.000 1 72 127
    i 10.026 25.000 -1.000 1 76 127
    i 8.206 25.124 0.001 1 49 127
    i 8.207 25.249 0.001 1 49 127
    i -11.022 25.257 0
    i 11.023 25.259 -1.000 1 33 74
    i 8.208 25.375 0.001 1 49 127
    i 7.020 25.500 0.001 1 39 127
    i 8.209 25.500 0.001 1 49 127
    i 11.024 25.508 -1.000 1 36 91
    i -11.023 25.517 0
    i 8.210 25.624 0.001 1 49 127
    i 8.211 25.749 0.001 1 49 127
    i 8.212 25.875 0.001 1 49 113
    i 8.213 26.000 0.001 1 49 127
    i 4.021 26.000 0.001 1 37 127
    i -11.024 26.000 0
    i -10.025 26.000 0
    i 11.025 26.000 -1.000 1 38 81
    i -10.026 26.000 0
    i 8.214 26.124 0.001 1 49 127
    i 8.215 26.249 0.001 1 49 127
    i 8.216 26.375 0.001 1 49 127
    i 8.217 26.500 0.001 1 49 127
    i 7.021 26.500 0.001 1 39 127
    i 8.218 26.624 0.001 1 49 127
    i 11.026 26.737 -1.000 1 41 89
    i -11.025 26.744 0
    i 8.219 26.749 0.001 1 49 127
    i 8.220 26.875 0.001 1 49 127
    i 8.221 27.000 0.001 1 49 127
    i 4.022 27.000 0.001 1 37 127
    i 10.027 27.000 -1.000 1 72 127
    i 10.028 27.000 -1.000 1 76 127
    i 8.222 27.124 0.001 1 49 127
    i 8.223 27.249 0.001 1 49 127
    i 11.027 27.255 -1.000 1 38 68
    i -11.026 27.260 0
    i 8.224 27.375 0.001 1 49 127
    i 11.028 27.501 -1.000 1 41 78
    i 8.225 27.500 0.001 1 49 127
    i 7.022 27.500 0.001 1 39 127
    i -11.027 27.509 0
    i 8.226 27.624 0.001 1 49 127
    i 8.227 27.749 0.001 1 49 127
    i 8.228 27.875 0.001 1 49 113
    i -10.027 27.999 0
    i 4.023 28.000 0.001 1 37 127
    i 8.229 28.000 0.001 1 49 127
    i -10.028 27.999 0
    i 11.029 28.012 -1.000 1 38 78
    i -11.028 28.031 0
    i 8.230 28.124 0.001 1 49 127
    i 8.231 28.249 0.001 1 49 127
    i 8.232 28.375 0.001 1 49 127
    i 8.233 28.500 0.001 1 49 127
    i 7.023 28.500 0.001 1 39 127
    i 8.234 28.624 0.001 1 49 127
    i 8.235 28.749 0.001 1 49 127
    i 11.030 28.760 -1.000 1 36 86
    i -11.029 28.768 0
    i 8.236 28.875 0.001 1 49 127
    i 8.237 29.000 0.001 1 49 127
    i 4.024 29.000 0.001 1 37 127
    i 10.029 29.000 -1.000 1 72 127
    i 10.030 29.000 -1.000 1 76 127
    i 8.238 29.124 0.001 1 49 127
    i 8.239 29.249 0.001 1 49 127
    i -11.030 29.257 0
    i 11.031 29.259 -1.000 1 33 74
    i 8.240 29.375 0.001 1 49 127
    i 7.024 29.500 0.001 1 39 127
    i 8.241 29.500 0.001 1 49 127
    i 11.032 29.508 -1.000 1 36 91
    i -11.031 29.517 0
    i 8.242 29.624 0.001 1 49 127
    i 8.243 29.749 0.001 1 49 127
    i 8.244 29.875 0.001 1 49 113
    i 4.025 30.000 0.001 1 37 127
    i 8.245 30.000 0.001 1 49 127
    i -10.029 30.000 0
    i -10.030 30.000 0
    i -11.032 30.000 0
    i 11.033 30.000 -1.000 1 38 81
    i 8.246 30.124 0.001 1 49 127
    i 8.247 30.249 0.001 1 49 127
    i 8.248 30.375 0.001 1 49 127
    i 7.025 30.500 0.001 1 39 127
    i 8.249 30.500 0.001 1 49 127
    i 8.250 30.624 0.001 1 49 127
    i 11.034 30.737 -1.000 1 41 89
    i -11.033 30.744 0
    i 8.251 30.749 0.001 1 49 127
    i 8.252 30.875 0.001 1 49 127
    i 4.026 31.000 0.001 1 37 127
    i 8.253 31.000 0.001 1 49 127
    i 10.031 31.000 -1.000 1 72 127
    i 10.032 31.000 -1.000 1 76 127
    i 8.254 31.124 0.001 1 49 127
    i 8.255 31.249 0.001 1 49 127
    i 11.035 31.255 -1.000 1 38 68
    i -11.034 31.260 0
    i 8.256 31.375 0.001 1 49 127
    i 8.257 31.500 0.001 1 49 127
    i 7.026 31.500 0.001 1 39 127
    i 11.036 31.501 -1.000 1 41 78
    i -11.035 31.509 0
    i 8.258 31.624 0.001 1 49 127
    i 8.259 31.749 0.001 1 49 127
    i 8.260 31.875 0.001 1 49 113
    i 4.027 32.000 0.001 1 37 127
    i -10.031 31.999 0
    i 8.261 32.000 0.001 1 49 127
    i -10.032 31.999 0
    i 11.037 32.012 -1.000 1 38 78
    i -11.036 32.031 0
    i 8.262 32.124 0.001 1 49 127
    i 8.263 32.249 0.001 1 49 127
    i 8.264 32.375 0.001 1 49 127
    i 8.265 32.500 0.001 1 49 127
    i 7.027 32.500 0.001 1 39 127
    i 8.266 32.624 0.001 1 49 127
    i 8.267 32.749 0.001 1 49 127
    i 11.038 32.760 -1.000 1 36 86
    i -11.037 32.768 0
    i 8.268 32.875 0.001 1 49 127
    i 8.269 33.000 0.001 1 49 127
    i 4.028 33.000 0.001 1 37 127
    i 10.033 33.000 -1.000 1 72 127
    i 10.034 33.000 -1.000 1 76 127
    i 8.270 33.124 0.001 1 49 127
    i 8.271 33.249 0.001 1 49 127
    i -11.038 33.257 0
    i 11.039 33.259 -1.000 1 33 74
    i 8.272 33.375 0.001 1 49 127
    i 7.028 33.500 0.001 1 39 127
    i 8.273 33.500 0.001 1 49 127
    i 11.040 33.508 -1.000 1 36 91
    i -11.039 33.517 0
    i 8.274 33.624 0.001 1 49 127
    i 8.275 33.749 0.001 1 49 127
    i 8.276 33.875 0.001 1 49 113
    i 4.029 34.000 0.001 1 37 127
    i 8.277 34.000 0.001 1 49 127
    i -10.033 34.000 0
    i -10.034 34.000 0
    i -11.040 34.000 0
    i 11.041 34.000 -1.000 1 38 81
    i 8.278 34.124 0.001 1 49 127
    i 8.279 34.249 0.001 1 49 127
    i 8.280 34.375 0.001 1 49 127
    i 7.029 34.500 0.001 1 39 127
    i 8.281 34.500 0.001 1 49 127
    i 8.282 34.624 0.001 1 49 127
    i 11.042 34.737 -1.000 1 41 89
    i -11.041 34.744 0
    i 8.283 34.749 0.001 1 49 127
    i 8.284 34.875 0.001 1 49 127
    i 4.030 35.000 0.001 1 37 127
    i 8.285 35.000 0.001 1 49 127
    i 10.035 35.000 -1.000 1 72 127
    i 10.036 35.000 -1.000 1 76 127
    i 8.286 35.124 0.001 1 49 127
    i 8.287 35.249 0.001 1 49 127
    i 11.043 35.255 -1.000 1 38 68
    i -11.042 35.260 0
    i 8.288 35.375 0.001 1 49 127
    i 8.289 35.500 0.001 1 49 127
    i 7.030 35.500 0.001 1 39 127
    i 11.044 35.501 -1.000 1 41 78
    i -11.043 35.509 0
    i 8.290 35.624 0.001 1 49 127
    i 8.291 35.749 0.001 1 49 127
    i 8.292 35.875 0.001 1 49 113
    i -10.035 35.999 0
    i 4.031 36.000 0.001 1 37 127
    i -10.036 35.999 0
    i 8.293 36.000 0.001 1 49 127
    i 11.045 36.012 -1.000 1 38 78
    i -11.044 36.031 0
    i 8.294 36.124 0.001 1 49 127
    i 8.295 36.249 0.001 1 49 127
    i 8.296 36.375 0.001 1 49 127
    i 8.297 36.500 0.001 1 49 127
    i 7.031 36.500 0.001 1 39 127
    i 8.298 36.624 0.001 1 49 127
    i 8.299 36.749 0.001 1 49 127
    i 11.046 36.760 -1.000 1 36 86
    i -11.045 36.768 0
    i 8.300 36.875 0.001 1 49 127
    i 8.301 37.000 0.001 1 49 127
    i 4.032 37.000 0.001 1 37 127
    i 10.037 37.000 -1.000 1 72 127
    i 10.038 37.000 -1.000 1 76 127
    i 8.302 37.124 0.001 1 49 127
    i 8.303 37.249 0.001 1 49 127
    i -11.046 37.257 0
    i 11.047 37.259 -1.000 1 33 74
    i 8.304 37.375 0.001 1 49 127
    i 7.032 37.500 0.001 1 39 127
    i 8.305 37.500 0.001 1 49 127
    i 11.048 37.508 -1.000 1 36 91
    i -11.047 37.517 0
    i 8.306 37.624 0.001 1 49 127
    i 8.307 37.749 0.001 1 49 127
    i 8.308 37.875 0.001 1 49 113
    i 4.033 38.000 0.001 1 37 127
    i 8.309 38.000 0.001 1 49 127
    i -10.037 38.000 0
    i -10.038 38.000 0
    i -11.048 38.000 0
    i 11.049 38.000 -1.000 1 38 81
    i 8.310 38.124 0.001 1 49 127
    i 8.311 38.249 0.001 1 49 127
    i 8.312 38.375 0.001 1 49 127
    i 8.313 38.500 0.001 1 49 127
    i 7.033 38.500 0.001 1 39 127
    i 8.314 38.624 0.001 1 49 127
    i 11.050 38.737 -1.000 1 41 89
    i -11.049 38.744 0
    i 8.315 38.749 0.001 1 49 127
    i 8.316 38.875 0.001 1 49 127
    i 4.034 39.000 0.001 1 37 127
    i 10.039 39.000 -1.000 1 72 127
    i 8.317 39.000 0.001 1 49 127
    i 10.040 39.000 -1.000 1 76 127
    i 8.318 39.124 0.001 1 49 127
    i 8.319 39.249 0.001 1 49 127
    i 11.051 39.255 -1.000 1 38 68
    i -11.050 39.260 0
    i 8.320 39.375 0.001 1 49 127
    i 7.034 39.500 0.001 1 39 127
    i 8.321 39.500 0.001 1 49 127
    i 11.052 39.501 -1.000 1 41 78
    i -11.051 39.509 0
    i 8.322 39.624 0.001 1 49 127
    i 8.323 39.749 0.001 1 49 127
    i 8.324 39.875 0.001 1 49 113
    i 4.035 40.000 0.001 1 37 127
    i 8.325 40.000 0.001 1 49 127
    i -10.039 39.999 0
    i -10.040 39.999 0
    i 11.053 40.012 -1.000 1 38 78
    i -11.052 40.031 0
    i 8.326 40.124 0.001 1 49 127
    i 8.327 40.249 0.001 1 49 127
    i 8.328 40.375 0.001 1 49 127
    i 7.035 40.500 0.001 1 39 127
    i 8.329 40.500 0.001 1 49 127
    i 8.330 40.624 0.001 1 49 127
    i 8.331 40.749 0.001 1 49 127
    i 11.054 40.760 -1.000 1 36 86
    i -11.053 40.768 0
    i 8.332 40.875 0.001 1 49 127
    i 4.036 41.000 0.001 1 37 127
    i 8.333 41.000 0.001 1 49 127
    i 10.041 41.000 -1.000 1 72 127
    i 10.042 41.000 -1.000 1 76 127
    i 8.334 41.124 0.001 1 49 127
    i 8.335 41.249 0.001 1 49 127
    i -11.054 41.257 0
    i 11.055 41.259 -1.000 1 33 74
    i 8.336 41.375 0.001 1 49 127
    i 7.036 41.500 0.001 1 39 127
    i 8.337 41.500 0.001 1 49 127
    i 11.056 41.508 -1.000 1 36 91
    i -11.055 41.517 0
    i 8.338 41.624 0.001 1 49 127
    i 8.339 41.749 0.001 1 49 127
    i 8.340 41.875 0.001 1 49 113
    i 8.341 42.000 0.001 1 49 127
    i 4.037 42.000 0.001 1 37 127
    i -11.056 42.000 0
    i -10.041 42.000 0
    i 11.057 42.000 -1.000 1 38 81
    i -10.042 42.000 0
    i 8.342 42.124 0.001 1 49 127
    i 8.343 42.249 0.001 1 49 127
    i 8.344 42.375 0.001 1 49 127
    i 8.345 42.500 0.001 1 49 127
    i 7.037 42.500 0.001 1 39 127
    i 8.346 42.624 0.001 1 49 127
    i 11.058 42.737 -1.000 1 41 89
    i -11.057 42.744 0
    i 8.347 42.749 0.001 1 49 127
    i 8.348 42.875 0.001 1 49 127
    i 4.038 43.000 0.001 1 37 127
    i 8.349 43.000 0.001 1 49 127
    i 10.043 43.000 -1.000 1 72 127
    i 10.044 43.000 -1.000 1 76 127
    i 8.350 43.124 0.001 1 49 127
    i 8.351 43.249 0.001 1 49 127
    i 11.059 43.255 -1.000 1 38 68
    i -11.058 43.260 0
    i 8.352 43.375 0.001 1 49 127
    i 8.353 43.500 0.001 1 49 127
    i 7.038 43.500 0.001 1 39 127
    i 11.060 43.501 -1.000 1 41 78
    i -11.059 43.509 0
    i 8.354 43.624 0.001 1 49 127
    i 8.355 43.749 0.001 1 49 127
    i 8.356 43.875 0.001 1 49 113
    i 4.039 44.000 0.001 1 37 127
    i 8.357 44.000 0.001 1 49 127
    i -10.043 43.999 0
    i -10.044 43.999 0
    i 11.061 44.012 -1.000 1 38 78
    i -11.060 44.031 0
    i 8.358 44.124 0.001 1 49 127
    i 8.359 44.249 0.001 1 49 127
    i 8.360 44.375 0.001 1 49 127
    i 7.039 44.500 0.001 1 39 127
    i 8.361 44.500 0.001 1 49 127
    i 8.362 44.624 0.001 1 49 127
    i 8.363 44.749 0.001 1 49 127
    i 11.062 44.760 -1.000 1 36 86
    i -11.061 44.768 0
    i 8.364 44.875 0.001 1 49 127
    i 4.040 45.000 0.001 1 37 127
    i 8.365 45.000 0.001 1 49 127
    i 10.045 45.000 -1.000 1 72 127
    i 10.046 45.000 -1.000 1 76 127
    i 8.366 45.124 0.001 1 49 127
    i 8.367 45.249 0.001 1 49 127
    i -11.062 45.257 0
    i 11.063 45.259 -1.000 1 33 74
    i 8.368 45.375 0.001 1 49 127
    i 7.040 45.500 0.001 1 39 127
    i 8.369 45.500 0.001 1 49 127
    i 11.064 45.508 -1.000 1 36 91
    i -11.063 45.517 0
    i 8.370 45.624 0.001 1 49 127
    i 8.371 45.749 0.001 1 49 127
    i 8.372 45.875 0.001 1 49 113
    i 5.001 46.000 0.001 1 37 127
    i 6.001 46.000 0.001 1 37 127
    i -10.045 46.000 0
    i -10.046 46.000 0
    i -11.064 45.999 0
    i 11.065 46.000 -1.000 1 38 83
    i -11.065 46.312 0
    i 10.047 47.000 -1.000 1 72 127
    i 10.048 47.000 -1.000 1 76 127
    i 5.002 47.749 0.001 1 37 127
    i 6.002 47.749 0.001 1 37 127
    i -10.047 47.999 0
    i -10.048 47.999 0
    i 5.003 48.000 0.001 1 37 127
    i 6.003 48.000 0.001 1 37 127
    i 10.049 49.000 -1.000 1 72 127
    i 10.050 49.000 -1.000 1 76 127
    i 6.004 50.000 0.001 1 37 127
    i 5.004 50.000 0.001 1 37 127
    i -10.049 50.000 0
    i -10.050 50.000 0
    i 10.051 51.000 -1.000 1 72 127
    i 10.052 51.000 -1.000 1 76 127
    i 6.005 51.749 0.001 1 37 127
    i 5.005 51.749 0.001 1 37 127
    i 6.006 52.000 0.001 1 37 127
    i -10.051 51.999 0
    i 5.006 52.000 0.001 1 37 127
    i -10.052 51.999 0
    i 10.053 53.000 -1.000 1 72 127
    i 10.054 53.000 -1.000 1 76 127
    i 6.007 54.000 0.001 1 37 127
    i 9.001 54.000 0.001 1 49 127
    i -10.053 54.000 0
    i -10.054 54.000 0
    i 12.001 54.000 -1.000 1 38 81
    i 5.007 54.000 0.001 1 37 127
    i 9.002 54.061 0.001 1 49 127
    i 9.003 54.124 0.001 1 49 127
    i 9.004 54.187 0.001 1 49 127
    i 9.005 54.249 0.001 1 49 127
    i 9.006 54.312 0.001 1 49 127
    i 9.007 54.375 0.001 1 49 127
    i 9.008 54.437 0.001 1 49 127
    i 9.009 54.500 0.001 1 49 127
    i 9.010 54.561 0.001 1 49 127
    i 9.011 54.624 0.001 1 49 127
    i 9.012 54.687 0.001 1 49 127
    i 12.002 54.737 -1.000 1 41 89
    i -12.001 54.744 0
    i 9.013 54.749 0.001 1 49 127
    i 9.014 54.812 0.001 1 49 127
    i 9.015 54.875 0.001 1 49 127
    i 9.016 54.937 0.001 1 49 127
    i 10.055 55.000 -1.000 1 72 127
    i 9.017 55.000 0.001 1 49 127
    i 10.056 55.000 -1.000 1 76 127
    i 9.018 55.061 0.001 1 49 127
    i 9.019 55.124 0.001 1 49 127
    i 9.020 55.187 0.001 1 49 127
    i 9.021 55.249 0.001 1 49 127
    i 12.003 55.255 -1.000 1 38 68
    i -12.002 55.260 0
    i 9.022 55.312 0.001 1 49 127
    i 9.023 55.375 0.001 1 49 127
    i 9.024 55.437 0.001 1 49 127
    i 12.004 55.501 -1.000 1 41 78
    i 9.025 55.500 0.001 1 49 127
    i -12.003 55.509 0
    i 9.026 55.561 0.001 1 49 127
    i 9.027 55.624 0.001 1 49 127
    i 9.028 55.687 0.001 1 49 127
    i 5.008 55.749 0.001 1 37 127
    i 9.029 55.749 0.001 1 49 127
    i 6.008 55.749 0.001 1 37 127
    i 9.030 55.812 0.001 1 49 127
    i 9.031 55.875 0.001 1 49 127
    i 9.032 55.937 0.001 1 49 127
    i 5.009 56.000 0.001 1 37 127
    i 9.033 56.000 0.001 1 49 127
    i -10.055 55.999 0
    i -10.056 55.999 0
    i 6.009 56.000 0.001 1 37 127
    i 12.005 56.012 -1.000 1 38 78
    i -12.004 56.031 0
    i 9.034 56.061 0.001 1 49 127
    i 9.035 56.124 0.001 1 49 127
    i 9.036 56.187 0.001 1 49 127
    i 9.037 56.249 0.001 1 49 127
    i 9.038 56.312 0.001 1 49 127
    i 9.039 56.375 0.001 1 49 127
    i 9.040 56.437 0.001 1 49 127
    i 9.041 56.500 0.001 1 49 127
    i -12.005 56.500 0
    i 9.042 56.561 0.001 1 49 127
    i 9.043 56.624 0.001 1 49 127
    i 9.044 56.687 0.001 1 49 127
    i 9.045 56.749 0.001 1 49 127
    i 9.046 56.812 0.001 1 49 127
    i 9.047 56.875 0.001 1 49 127
    i 9.048 56.937 0.001 1 49 127
    i 9.049 57.000 0.001 1 49 127
    i 10.057 57.000 -1.000 1 72 127
    i 10.058 57.000 -1.000 1 76 127
    i 9.050 57.061 0.001 1 49 127
    i 9.051 57.124 0.001 1 49 127
    i 9.052 57.187 0.001 1 49 127
    i 9.053 57.249 0.001 1 49 127
    i 9.054 57.312 0.001 1 49 127
    i 9.055 57.375 0.001 1 49 127
    i 9.056 57.437 0.001 1 49 127
    i 9.057 57.500 0.001 1 49 127
    i 9.058 57.561 0.001 1 49 127
    i 9.059 57.624 0.001 1 49 127
    i 9.060 57.687 0.001 1 49 127
    i 9.061 57.749 0.001 1 49 127
    i 9.062 57.812 0.001 1 49 127
    i 9.063 57.875 0.001 1 49 127
    i 9.064 57.937 0.001 1 49 127
    i 5.010 58.000 0.001 1 37 127
    i 9.065 58.000 0.001 1 49 127
    i -10.057 58.000 0
    i -10.058 58.000 0
    i 12.006 58.000 -1.000 1 38 81
    i 6.010 58.000 0.001 1 37 127
    i 9.066 58.061 0.001 1 49 127
    i 9.067 58.124 0.001 1 49 127
    i 9.068 58.187 0.001 1 49 127
    i 9.069 58.249 0.001 1 49 127
    i 9.070 58.312 0.001 1 49 127
    i 9.071 58.375 0.001 1 49 127
    i 9.072 58.437 0.001 1 49 127
    i 9.073 58.500 0.001 1 49 127
    i 9.074 58.561 0.001 1 49 127
    i 9.075 58.624 0.001 1 49 127
    i 9.076 58.687 0.001 1 49 127
    i 12.007 58.737 -1.000 1 41 89
    i -12.006 58.744 0
    i 9.077 58.749 0.001 1 49 127
    i 9.078 58.812 0.001 1 49 127
    i 9.079 58.875 0.001 1 49 127
    i 9.080 58.937 0.001 1 49 127
    i 9.081 59.000 0.001 1 49 127
    i 10.059 59.000 -1.000 1 72 127
    i 10.060 59.000 -1.000 1 76 127
    i 9.082 59.061 0.001 1 49 127
    i 9.083 59.124 0.001 1 49 127
    i 9.084 59.187 0.001 1 49 127
    i 9.085 59.249 0.001 1 49 127
    i 12.008 59.255 -1.000 1 38 68
    i -12.007 59.260 0
    i 9.086 59.312 0.001 1 49 127
    i 9.087 59.375 0.001 1 49 127
    i 9.088 59.437 0.001 1 49 127
    i 12.009 59.501 -1.000 1 41 78
    i 9.089 59.500 0.001 1 49 127
    i -12.008 59.509 0
    i 9.090 59.561 0.001 1 49 127
    i 9.091 59.624 0.001 1 49 127
    i 9.092 59.687 0.001 1 49 127
    i 6.011 59.749 0.001 1 37 127
    i 5.011 59.749 0.001 1 37 127
    i 9.093 59.749 0.001 1 49 127
    i 9.094 59.812 0.001 1 49 127
    i 9.095 59.875 0.001 1 49 127
    i 9.096 59.937 0.001 1 49 127
    i 9.097 60.000 0.001 1 49 127
    i 5.012 60.000 0.001 1 37 127
    i -10.059 59.999 0
    i 6.012 60.000 0.001 1 37 127
    i -10.060 59.999 0
    i 12.010 60.012 -1.000 1 38 78
    i -12.009 60.031 0
    i 9.098 60.061 0.001 1 49 127
    i 9.099 60.124 0.001 1 49 127
    i 9.100 60.187 0.001 1 49 127
    i 9.101 60.249 0.001 1 49 127
    i 9.102 60.312 0.001 1 49 127
    i 9.103 60.375 0.001 1 49 127
    i 9.104 60.437 0.001 1 49 127
    i 9.105 60.500 0.001 1 49 127
    i -12.010 60.500 0
    i 9.106 60.561 0.001 1 49 127
    i 9.107 60.624 0.001 1 49 127
    i 9.108 60.687 0.001 1 49 127
    i 9.109 60.749 0.001 1 49 127
    i 9.110 60.812 0.001 1 49 127
    i 9.111 60.875 0.001 1 49 127
    i 9.112 60.937 0.001 1 49 127
    i 9.113 61.000 0.001 1 49 127
    i 10.061 61.000 -1.000 1 72 127
    i 10.062 61.000 -1.000 1 76 127
    i 9.114 61.061 0.001 1 49 127
    i 9.115 61.124 0.001 1 49 127
    i 9.116 61.187 0.001 1 49 127
    i 9.117 61.249 0.001 1 49 127
    i 9.118 61.312 0.001 1 49 127
    i 9.119 61.375 0.001 1 49 127
    i 9.120 61.437 0.001 1 49 127
    i 9.121 61.500 0.001 1 49 127
    i 9.122 61.561 0.001 1 49 127
    i 9.123 61.624 0.001 1 49 127
    i 9.124 61.687 0.001 1 49 127
    i 9.125 61.749 0.001 1 49 127
    i 9.126 61.812 0.001 1 49 127
    i 9.127 61.875 0.001 1 49 127
    i 9.128 61.937 0.001 1 49 127
    i 11.066 62.000 -1.000 1 38 81
    i 4.041 62.000 0.001 1 37 127
    i 5.013 62.000 0.001 1 37 127
    i 9.129 62.000 0.001 1 49 127
    i 6.013 62.000 0.001 1 37 127
    i 8.373 62.000 0.001 1 49 127
    i -10.061 62.000 0
    i -10.062 62.000 0
    i 9.130 62.061 0.001 1 49 127
    i 8.374 62.124 0.001 1 49 127
    i 9.131 62.124 0.001 1 49 127
    i 9.132 62.187 0.001 1 49 127
    i 9.133 62.249 0.001 1 49 127
    i 8.375 62.249 0.001 1 49 127
    i 9.134 62.312 0.001 1 49 127
    i 8.376 62.375 0.001 1 49 127
    i 9.135 62.375 0.001 1 49 127
    i 9.136 62.437 0.001 1 49 127
    i 9.137 62.500 0.001 1 49 127
    i 7.041 62.500 0.001 1 39 127
    i 8.377 62.500 0.001 1 49 127
    i 9.138 62.561 0.001 1 49 127
    i 8.378 62.624 0.001 1 49 127
    i 9.139 62.624 0.001 1 49 127
    i 9.140 62.687 0.001 1 49 127
    i 11.067 62.737 -1.000 1 41 89
    i -11.066 62.744 0
    i 9.141 62.749 0.001 1 49 127
    i 8.379 62.749 0.001 1 49 127
    i 9.142 62.812 0.001 1 49 127
    i 8.380 62.875 0.001 1 49 127
    i 9.143 62.875 0.001 1 49 127
    i 9.144 62.937 0.001 1 49 127
    i 10.063 63.000 -1.000 1 72 127
    i 10.064 63.000 -1.000 1 76 127
    i 4.042 63.000 0.001 1 37 127
    i 8.381 63.000 0.001 1 49 127
    i 9.145 63.000 0.001 1 49 127
    i 9.146 63.061 0.001 1 49 127
    i 8.382 63.124 0.001 1 49 127
    i 9.147 63.124 0.001 1 49 127
    i 9.148 63.187 0.001 1 49 127
    i 8.383 63.249 0.001 1 49 127
    i 9.149 63.249 0.001 1 49 127
    i 11.068 63.255 -1.000 1 38 68
    i -11.067 63.260 0
    i 9.150 63.312 0.001 1 49 127
    i 9.151 63.375 0.001 1 49 127
    i 8.384 63.375 0.001 1 49 127
    i 9.152 63.437 0.001 1 49 127
    i 7.042 63.500 0.001 1 39 127
    i 8.385 63.500 0.001 1 49 127
    i 11.069 63.501 -1.000 1 41 78
    i 9.153 63.500 0.001 1 49 127
    i -11.068 63.509 0
    i 9.154 63.561 0.001 1 49 127
    i 9.155 63.624 0.001 1 49 127
    i 8.386 63.624 0.001 1 49 127
    i 9.156 63.687 0.001 1 49 127
    i 6.014 63.749 0.001 1 37 127
    i 8.387 63.749 0.001 1 49 127
    i 9.157 63.749 0.001 1 49 127
    i 5.014 63.749 0.001 1 37 127
    i 9.158 63.812 0.001 1 49 127
    i 8.388 63.875 0.001 1 49 113
    i 9.159 63.875 0.001 1 49 127
    i 9.160 63.937 0.001 1 49 127
    i 6.015 64.000 0.001 1 37 127
    i 8.389 64.000 0.001 1 49 127
    i 5.015 64.000 0.001 1 37 127
    i 4.043 64.000 0.001 1 37 127
    i -10.063 63.999 0
    i 9.161 64.000 0.001 1 49 127
    i -10.064 63.999 0
    i 11.070 64.012 -1.000 1 38 78
    i -11.069 64.031 0
    i 9.162 64.061 0.001 1 49 127
    i 8.390 64.124 0.001 1 49 127
    i 9.163 64.124 0.001 1 49 127
    i 9.164 64.187 0.001 1 49 127
    i 8.391 64.249 0.001 1 49 127
    i 9.165 64.249 0.001 1 49 127
    i 9.166 64.312 0.001 1 49 127
    i 8.392 64.375 0.001 1 49 127
    i 9.167 64.375 0.001 1 49 127
    i 9.168 64.437 0.001 1 49 127
    i 7.043 64.500 0.001 1 39 127
    i 8.393 64.500 0.001 1 49 127
    i 9.169 64.500 0.001 1 49 127
    i 9.170 64.561 0.001 1 49 127
    i 8.394 64.624 0.001 1 49 127
    i 9.171 64.624 0.001 1 49 127
    i 9.172 64.687 0.001 1 49 127
    i 9.173 64.749 0.001 1 49 127
    i 8.395 64.749 0.001 1 49 127
    i 11.071 64.760 -1.000 1 36 86
    i -11.070 64.768 0
    i 9.174 64.812 0.001 1 49 127
    i 8.396 64.875 0.001 1 49 127
    i 9.175 64.875 0.001 1 49 127
    i 9.176 64.937 0.001 1 49 127
    i 4.044 65.000 0.001 1 37 127
    i 9.177 65.000 0.001 1 49 127
    i 8.397 65.000 0.001 1 49 127
    i 10.065 65.000 -1.000 1 72 127
    i 10.066 65.000 -1.000 1 76 127
    i 9.178 65.061 0.001 1 49 127
    i 9.179 65.124 0.001 1 49 127
    i 8.398 65.124 0.001 1 49 127
    i 9.180 65.187 0.001 1 49 127
    i 9.181 65.249 0.001 1 49 127
    i 8.399 65.249 0.001 1 49 127
    i -11.071 65.257 0
    i 11.072 65.259 -1.000 1 33 74
    i 9.182 65.312 0.001 1 49 127
    i 9.183 65.375 0.001 1 49 127
    i 8.400 65.375 0.001 1 49 127
    i 9.184 65.437 0.001 1 49 127
    i 9.185 65.500 0.001 1 49 127
    i 8.401 65.500 0.001 1 49 127
    i 7.044 65.500 0.001 1 39 127
    i 11.073 65.508 -1.000 1 36 91
    i -11.072 65.517 0
    i 9.186 65.561 0.001 1 49 127
    i 9.187 65.624 0.001 1 49 127
    i 8.402 65.624 0.001 1 49 127
    i 9.188 65.687 0.001 1 49 127
    i 9.189 65.749 0.001 1 49 127
    i 8.403 65.749 0.001 1 49 127
    i 9.190 65.812 0.001 1 49 127
    i 8.404 65.875 0.001 1 49 113
    i 9.191 65.875 0.001 1 49 127
    i 9.192 65.937 0.001 1 49 127
    i 6.016 66.000 0.001 1 37 127
    i -10.065 66.000 0
    i 4.045 66.000 0.001 1 37 127
    i 9.193 66.000 0.001 1 49 127
    i -10.066 66.000 0
    i 8.405 66.000 0.001 1 49 127
    i 5.016 66.000 0.001 1 37 127
    i -11.073 66.000 0
    i 11.074 66.000 -1.000 1 38 81
    i 9.194 66.061 0.001 1 49 127
    i 8.406 66.124 0.001 1 49 127
    i 9.195 66.124 0.001 1 49 127
    i 9.196 66.187 0.001 1 49 127
    i 9.197 66.249 0.001 1 49 127
    i 8.407 66.249 0.001 1 49 127
    i 9.198 66.312 0.001 1 49 127
    i 9.199 66.375 0.001 1 49 127
    i 8.408 66.375 0.001 1 49 127
    i 9.200 66.437 0.001 1 49 127
    i 9.201 66.500 0.001 1 49 127
    i 7.045 66.500 0.001 1 39 127
    i 8.409 66.500 0.001 1 49 127
    i 9.202 66.561 0.001 1 49 127
    i 8.410 66.624 0.001 1 49 127
    i 9.203 66.624 0.001 1 49 127
    i 9.204 66.687 0.001 1 49 127
    i 11.075 66.737 -1.000 1 41 89
    i -11.074 66.744 0
    i 8.411 66.749 0.001 1 49 127
    i 9.205 66.749 0.001 1 49 127
    i 9.206 66.812 0.001 1 49 127
    i 9.207 66.875 0.001 1 49 127
    i 8.412 66.875 0.001 1 49 127
    i 9.208 66.937 0.001 1 49 127
    i 4.046 67.000 0.001 1 37 127
    i 8.413 67.000 0.001 1 49 127
    i 9.209 67.000 0.001 1 49 127
    i 10.067 67.000 -1.000 1 72 127
    i 10.068 67.000 -1.000 1 76 127
    i 9.210 67.061 0.001 1 49 127
    i 8.414 67.124 0.001 1 49 127
    i 9.211 67.124 0.001 1 49 127
    i 9.212 67.187 0.001 1 49 127
    i 9.213 67.249 0.001 1 49 127
    i 8.415 67.249 0.001 1 49 127
    i 11.076 67.255 -1.000 1 38 68
    i -11.075 67.260 0
    i 9.214 67.312 0.001 1 49 127
    i 8.416 67.375 0.001 1 49 127
    i 9.215 67.375 0.001 1 49 127
    i 9.216 67.437 0.001 1 49 127
    i 11.077 67.501 -1.000 1 41 78
    i 9.217 67.500 0.001 1 49 127
    i 7.046 67.500 0.001 1 39 127
    i 8.417 67.500 0.001 1 49 127
    i -11.076 67.509 0
    i 9.218 67.561 0.001 1 49 127
    i 8.418 67.624 0.001 1 49 127
    i 9.219 67.624 0.001 1 49 127
    i 9.220 67.687 0.001 1 49 127
    i 8.419 67.749 0.001 1 49 127
    i 9.221 67.749 0.001 1 49 127
    i 6.017 67.749 0.001 1 37 127
    i 5.017 67.749 0.001 1 37 127
    i 9.222 67.812 0.001 1 49 127
    i 8.420 67.875 0.001 1 49 113
    i 9.223 67.875 0.001 1 49 127
    i 9.224 67.937 0.001 1 49 127
    i 9.225 68.000 0.001 1 49 127
    i 4.047 68.000 0.001 1 37 127
    i -10.067 67.999 0
    i 5.018 68.000 0.001 1 37 127
    i 6.018 68.000 0.001 1 37 127
    i -10.068 67.999 0
    i 8.421 68.000 0.001 1 49 127
    i 11.078 68.012 -1.000 1 38 78
    i -11.077 68.031 0
    i 9.226 68.061 0.001 1 49 127
    i 8.422 68.124 0.001 1 49 127
    i 9.227 68.124 0.001 1 49 127
    i 9.228 68.187 0.001 1 49 127
    i 9.229 68.249 0.001 1 49 127
    i 8.423 68.249 0.001 1 49 127
    i 9.230 68.312 0.001 1 49 127
    i 8.424 68.375 0.001 1 49 127
    i 9.231 68.375 0.001 1 49 127
    i 9.232 68.437 0.001 1 49 127
    i 8.425 68.500 0.001 1 49 127
    i 9.233 68.500 0.001 1 49 127
    i 7.047 68.500 0.001 1 39 127
    i 9.234 68.561 0.001 1 49 127
    i 9.235 68.624 0.001 1 49 127
    i 8.426 68.624 0.001 1 49 127
    i 9.236 68.687 0.001 1 49 127
    i 9.237 68.749 0.001 1 49 127
    i 8.427 68.749 0.001 1 49 127
    i 11.079 68.760 -1.000 1 36 86
    i -11.078 68.768 0
    i 9.238 68.812 0.001 1 49 127
    i 8.428 68.875 0.001 1 49 127
    i 9.239 68.875 0.001 1 49 127
    i 9.240 68.937 0.001 1 49 127
    i 4.048 69.000 0.001 1 37 127
    i 8.429 69.000 0.001 1 49 127
    i 9.241 69.000 0.001 1 49 127
    i 10.069 69.000 -1.000 1 72 127
    i 10.070 69.000 -1.000 1 76 127
    i 9.242 69.061 0.001 1 49 127
    i 8.430 69.124 0.001 1 49 127
    i 9.243 69.124 0.001 1 49 127
    i 9.244 69.187 0.001 1 49 127
    i 8.431 69.249 0.001 1 49 127
    i 9.245 69.249 0.001 1 49 127
    i -11.079 69.257 0
    i 11.080 69.259 -1.000 1 33 74
    i 9.246 69.312 0.001 1 49 127
    i 8.432 69.375 0.001 1 49 127
    i 9.247 69.375 0.001 1 49 127
    i 9.248 69.437 0.001 1 49 127
    i 7.048 69.500 0.001 1 39 127
    i 9.249 69.500 0.001 1 49 127
    i 8.433 69.500 0.001 1 49 127
    i 11.081 69.508 -1.000 1 36 91
    i -11.080 69.517 0
    i 9.250 69.561 0.001 1 49 127
    i 9.251 69.624 0.001 1 49 127
    i 8.434 69.624 0.001 1 49 127
    i 9.252 69.687 0.001 1 49 127
    i 9.253 69.749 0.001 1 49 127
    i 8.435 69.749 0.001 1 49 127
    i 9.254 69.812 0.001 1 49 127
    i 8.436 69.875 0.001 1 49 113
    i 9.255 69.875 0.001 1 49 127
    i 9.256 69.937 0.001 1 49 127
    i 8.437 70.000 0.001 1 49 127
    i 6.019 70.000 0.001 1 37 127
    i 4.049 70.000 0.001 1 37 127
    i -11.081 70.000 0
    i 9.257 70.000 0.001 1 49 127
    i 5.019 70.000 0.001 1 37 127
    i 11.082 70.000 -1.000 1 38 81
    i -10.069 70.000 0
    i -10.070 70.000 0
    i 9.258 70.061 0.001 1 49 127
    i 9.259 70.124 0.001 1 49 127
    i 8.438 70.124 0.001 1 49 127
    i 9.260 70.187 0.001 1 49 127
    i 9.261 70.249 0.001 1 49 127
    i 8.439 70.249 0.001 1 49 127
    i 9.262 70.312 0.001 1 49 127
    i 8.440 70.375 0.001 1 49 127
    i 9.263 70.375 0.001 1 49 127
    i 9.264 70.437 0.001 1 49 127
    i 8.441 70.500 0.001 1 49 127
    i 9.265 70.500 0.001 1 49 127
    i 7.049 70.500 0.001 1 39 127
    i 9.266 70.561 0.001 1 49 127
    i 8.442 70.624 0.001 1 49 127
    i 9.267 70.624 0.001 1 49 127
    i 9.268 70.687 0.001 1 49 127
    i 11.083 70.737 -1.000 1 41 89
    i -11.082 70.744 0
    i 9.269 70.749 0.001 1 49 127
    i 8.443 70.749 0.001 1 49 127
    i 9.270 70.812 0.001 1 49 127
    i 8.444 70.875 0.001 1 49 127
    i 9.271 70.875 0.001 1 49 127
    i 9.272 70.937 0.001 1 49 127
    i 8.445 71.000 0.001 1 49 127
    i 9.273 71.000 0.001 1 49 127
    i 4.050 71.000 0.001 1 37 127
    i 10.071 71.000 -1.000 1 72 127
    i 10.072 71.000 -1.000 1 76 127
    i 9.274 71.061 0.001 1 49 127
    i 8.446 71.124 0.001 1 49 127
    i 9.275 71.124 0.001 1 49 127
    i 9.276 71.187 0.001 1 49 127
    i 8.447 71.249 0.001 1 49 127
    i 9.277 71.249 0.001 1 49 127
    i 11.084 71.255 -1.000 1 38 68
    i -11.083 71.260 0
    i 9.278 71.312 0.001 1 49 127
    i 8.448 71.375 0.001 1 49 127
    i 9.279 71.375 0.001 1 49 127
    i 9.280 71.437 0.001 1 49 127
    i 7.050 71.500 0.001 1 39 127
    i 9.281 71.500 0.001 1 49 127
    i 8.449 71.500 0.001 1 49 127
    i 11.085 71.501 -1.000 1 41 78
    i -11.084 71.509 0
    i 9.282 71.561 0.001 1 49 127
    i 8.450 71.624 0.001 1 49 127
    i 9.283 71.624 0.001 1 49 127
    i 9.284 71.687 0.001 1 49 127
    i 5.020 71.749 0.001 1 37 127
    i 8.451 71.749 0.001 1 49 127
    i 9.285 71.749 0.001 1 49 127
    i 6.020 71.749 0.001 1 37 127
    i 9.286 71.812 0.001 1 49 127
    i 8.452 71.875 0.001 1 49 113
    i 9.287 71.875 0.001 1 49 127
    i 9.288 71.937 0.001 1 49 127
    i 4.051 72.000 0.001 1 37 127
    i 5.021 72.000 0.001 1 37 127
    i 6.021 72.000 0.001 1 37 127
    i 8.453 72.000 0.001 1 49 127
    i 9.289 72.000 0.001 1 49 127
    i -10.071 71.999 0
    i -10.072 71.999 0
    i 11.086 72.012 -1.000 1 38 78
    i -11.085 72.031 0
    i 9.290 72.061 0.001 1 49 127
    i 9.291 72.124 0.001 1 49 127
    i 8.454 72.124 0.001 1 49 127
    i 9.292 72.187 0.001 1 49 127
    i 8.455 72.249 0.001 1 49 127
    i 9.293 72.249 0.001 1 49 127
    i 9.294 72.312 0.001 1 49 127
    i 9.295 72.375 0.001 1 49 127
    i 8.456 72.375 0.001 1 49 127
    i 9.296 72.437 0.001 1 49 127
    i 7.051 72.500 0.001 1 39 127
    i 8.457 72.500 0.001 1 49 127
    i 9.297 72.500 0.001 1 49 127
    i 9.298 72.561 0.001 1 49 127
    i 8.458 72.624 0.001 1 49 127
    i 9.299 72.624 0.001 1 49 127
    i 9.300 72.687 0.001 1 49 127
    i 9.301 72.749 0.001 1 49 127
    i 8.459 72.749 0.001 1 49 127
    i 11.087 72.760 -1.000 1 36 86
    i -11.086 72.768 0
    i 9.302 72.812 0.001 1 49 127
    i 8.460 72.875 0.001 1 49 127
    i 9.303 72.875 0.001 1 49 127
    i 9.304 72.937 0.001 1 49 127
    i 4.052 73.000 0.001 1 37 127
    i 8.461 73.000 0.001 1 49 127
    i 9.305 73.000 0.001 1 49 127
    i 10.073 73.000 -1.000 1 72 127
    i 10.074 73.000 -1.000 1 76 127
    i 9.306 73.061 0.001 1 49 127
    i 8.462 73.124 0.001 1 49 127
    i 9.307 73.124 0.001 1 49 127
    i 9.308 73.187 0.001 1 49 127
    i 8.463 73.249 0.001 1 49 127
    i 9.309 73.249 0.001 1 49 127
    i -11.087 73.257 0
    i 11.088 73.259 -1.000 1 33 74
    i 9.310 73.312 0.001 1 49 127
    i 9.311 73.375 0.001 1 49 127
    i 8.464 73.375 0.001 1 49 127
    i 9.312 73.437 0.001 1 49 127
    i 7.052 73.500 0.001 1 39 127
    i 8.465 73.500 0.001 1 49 127
    i 9.313 73.500 0.001 1 49 127
    i 11.089 73.508 -1.000 1 36 91
    i -11.088 73.517 0
    i 9.314 73.561 0.001 1 49 127
    i 8.466 73.624 0.001 1 49 127
    i 9.315 73.624 0.001 1 49 127
    i 9.316 73.687 0.001 1 49 127
    i 8.467 73.749 0.001 1 49 127
    i 9.317 73.749 0.001 1 49 127
    i 9.318 73.812 0.001 1 49 127
    i 8.468 73.875 0.001 1 49 113
    i 9.319 73.875 0.001 1 49 127
    i 9.320 73.937 0.001 1 49 127
    i 5.022 74.000 0.001 1 37 127
    i 8.469 74.000 0.001 1 49 127
    i -10.073 74.000 0
    i -10.074 74.000 0
    i -11.089 73.999 0
    i 11.090 74.000 -1.000 1 38 83
    i 4.053 74.000 0.001 1 37 127
    i 6.022 74.000 0.001 1 37 127
    i 9.321 74.000 0.001 1 49 127
    i 9.322 74.061 0.001 1 49 127
    i 8.470 74.124 0.001 1 49 127
    i 9.323 74.124 0.001 1 49 127
    i 9.324 74.187 0.001 1 49 127
    i 8.471 74.249 0.001 1 49 127
    i 9.325 74.249 0.001 1 49 127
    i 9.326 74.312 0.001 1 49 127
    i 8.472 74.375 0.001 1 49 127
    i 9.327 74.375 0.001 1 49 127
    i 9.328 74.437 0.001 1 49 127
    i 9.329 74.500 0.001 1 49 127
    i 8.473 74.500 0.001 1 49 127
    i 7.053 74.500 0.001 1 39 127
    i 9.330 74.561 0.001 1 49 127
    i 8.474 74.624 0.001 1 49 127
    i 9.331 74.624 0.001 1 49 127
    i 9.332 74.687 0.001 1 49 127
    i 11.091 74.737 -1.000 1 41 103
    i -11.090 74.756 0
    i 8.475 74.749 0.001 1 49 127
    i 9.333 74.749 0.001 1 49 127
    i 9.334 74.812 0.001 1 49 127
    i 9.335 74.875 0.001 1 49 127
    i 8.476 74.875 0.001 1 49 127
    i 9.336 74.937 0.001 1 49 127
    i 8.477 75.000 0.001 1 49 127
    i 10.075 75.000 -1.000 1 72 127
    i 4.054 75.000 0.001 1 37 127
    i 9.337 75.000 0.001 1 49 127
    i 10.076 75.000 -1.000 1 76 127
    i 9.338 75.061 0.001 1 49 127
    i 8.478 75.124 0.001 1 49 127
    i 9.339 75.124 0.001 1 49 127
    i 9.340 75.187 0.001 1 49 127
    i 11.092 75.223 -1.000 1 44 76
    i -11.091 75.235 0
    i 9.341 75.249 0.001 1 49 127
    i 8.479 75.249 0.001 1 49 127
    i 9.342 75.312 0.001 1 49 127
    i 9.343 75.375 0.001 1 49 127
    i 8.480 75.375 0.001 1 49 127
    i 9.344 75.437 0.001 1 49 127
    i 7.054 75.500 0.001 1 39 127
    i 8.481 75.500 0.001 1 49 127
    i 9.345 75.500 0.001 1 49 127
    i -11.092 75.523 0
    i 11.093 75.523 -1.000 1 43 89
    i 9.346 75.561 0.001 1 49 127
    i 9.347 75.624 0.001 1 49 127
    i 8.482 75.624 0.001 1 49 127
    i 9.348 75.687 0.001 1 49 127
    i 5.023 75.749 0.001 1 37 127
    i 6.023 75.749 0.001 1 37 127
    i 8.483 75.749 0.001 1 49 127
    i 9.349 75.749 0.001 1 49 127
    i 9.350 75.812 0.001 1 49 127
    i 8.484 75.875 0.001 1 49 113
    i 9.351 75.875 0.001 1 49 127
    i 9.352 75.937 0.001 1 49 127
    i 5.024 76.000 0.001 1 37 127
    i 8.485 76.000 0.001 1 49 127
    i 9.353 76.000 0.001 1 49 127
    i -10.075 75.999 0
    i -10.076 75.999 0
    i -11.093 75.997 0
    i 11.094 75.997 -1.000 1 41 97
    i 4.055 76.000 0.001 1 37 127
    i 6.024 76.000 0.001 1 37 127
    i 9.354 76.061 0.001 1 49 127
    i 8.486 76.124 0.001 1 49 127
    i 9.355 76.124 0.001 1 49 127
    i 9.356 76.187 0.001 1 49 127
    i 8.487 76.249 0.001 1 49 127
    i 9.357 76.249 0.001 1 49 127
    i 9.358 76.312 0.001 1 49 127
    i 9.359 76.375 0.001 1 49 127
    i 8.488 76.375 0.001 1 49 127
    i 9.360 76.437 0.001 1 49 127
    i 7.055 76.500 0.001 1 39 127
    i 9.361 76.500 0.001 1 49 127
    i 8.489 76.500 0.001 1 49 127
    i 9.362 76.561 0.001 1 49 127
    i 8.490 76.624 0.001 1 49 127
    i 9.363 76.624 0.001 1 49 127
    i 9.364 76.687 0.001 1 49 127
    i 8.491 76.749 0.001 1 49 127
    i 9.365 76.749 0.001 1 49 127
    i -11.094 76.756 0
    i 11.095 76.759 -1.000 1 38 80
    i 9.366 76.812 0.001 1 49 127
    i 8.492 76.875 0.001 1 49 127
    i 9.367 76.875 0.001 1 49 127
    i 9.368 76.937 0.001 1 49 127
    i 8.493 77.000 0.001 1 49 127
    i 4.056 77.000 0.001 1 37 127
    i 10.077 77.000 -1.000 1 72 127
    i 9.369 77.000 0.001 1 49 127
    i 10.078 77.000 -1.000 1 76 127
    i 9.370 77.061 0.001 1 49 127
    i 8.494 77.124 0.001 1 49 127
    i 9.371 77.124 0.001 1 49 127
    i 9.372 77.187 0.001 1 49 127
    i 11.096 77.205 -1.000 1 33 79
    i -11.095 77.229 0
    i 8.495 77.249 0.001 1 49 127
    i 9.373 77.249 0.001 1 49 127
    i 9.374 77.312 0.001 1 49 127
    i 9.375 77.375 0.001 1 49 127
    i 8.496 77.375 0.001 1 49 127
    i 9.376 77.437 0.001 1 49 127
    i 7.056 77.500 0.001 1 39 127
    i 8.497 77.500 0.001 1 49 127
    i 9.377 77.500 0.001 1 49 127
    i 11.097 77.507 -1.000 1 36 89
    i -11.096 77.508 0
    i 9.378 77.561 0.001 1 49 127
    i 8.498 77.624 0.001 1 49 127
    i 9.379 77.624 0.001 1 49 127
    i 9.380 77.687 0.001 1 49 127
    i 8.499 77.749 0.001 1 49 127
    i 9.381 77.749 0.001 1 49 127
    i 9.382 77.812 0.001 1 49 127
    i 9.383 77.875 0.001 1 49 127
    i 8.500 77.875 0.001 1 49 113
    i 9.384 77.937 0.001 1 49 127
    i -11.097 77.999 0
    i 11.098 78.000 -1.000 1 38 81
    i 4.057 78.000 0.001 1 37 127
    i 5.025 78.000 0.001 1 37 127
    i 6.025 78.000 0.001 1 37 127
    i 8.501 78.000 0.001 1 49 127
    i -10.077 78.000 0
    i -10.078 78.000 0
    i 9.385 78.000 0.001 1 49 127
    i 9.386 78.061 0.001 1 49 127
    i 9.387 78.124 0.001 1 49 127
    i 8.502 78.124 0.001 1 49 127
    i 9.388 78.187 0.001 1 49 127
    i 8.503 78.249 0.001 1 49 127
    i 9.389 78.249 0.001 1 49 127
    i 9.390 78.312 0.001 1 49 127
    i 8.504 78.375 0.001 1 49 127
    i 9.391 78.375 0.001 1 49 127
    i 9.392 78.437 0.001 1 49 127
    i 8.505 78.500 0.001 1 49 127
    i 7.057 78.500 0.001 1 39 127
    i 9.393 78.500 0.001 1 49 127
    i 9.394 78.561 0.001 1 49 127
    i 8.506 78.624 0.001 1 49 127
    i 9.395 78.624 0.001 1 49 127
    i 9.396 78.687 0.001 1 49 127
    i 11.099 78.737 -1.000 1 41 89
    i -11.098 78.744 0
    i 9.397 78.749 0.001 1 49 127
    i 8.507 78.749 0.001 1 49 127
    i 9.398 78.812 0.001 1 49 127
    i 8.508 78.875 0.001 1 49 127
    i 9.399 78.875 0.001 1 49 127
    i 9.400 78.937 0.001 1 49 127
    i 8.509 79.000 0.001 1 49 127
    i 4.058 79.000 0.001 1 37 127
    i 9.401 79.000 0.001 1 49 127
    i 10.079 79.000 -1.000 1 72 127
    i 10.080 79.000 -1.000 1 76 127
    i 9.402 79.061 0.001 1 49 127
    i 9.403 79.124 0.001 1 49 127
    i 8.510 79.124 0.001 1 49 127
    i 9.404 79.187 0.001 1 49 127
    i 8.511 79.249 0.001 1 49 127
    i 9.405 79.249 0.001 1 49 127
    i 11.100 79.255 -1.000 1 38 68
    i -11.099 79.260 0
    i 9.406 79.312 0.001 1 49 127
    i 8.512 79.375 0.001 1 49 127
    i 9.407 79.375 0.001 1 49 127
    i 9.408 79.437 0.001 1 49 127
    i 7.058 79.500 0.001 1 39 127
    i 8.513 79.500 0.001 1 49 127
    i 9.409 79.500 0.001 1 49 127
    i 11.101 79.501 -1.000 1 41 78
    i -11.100 79.509 0
    i 9.410 79.561 0.001 1 49 127
    i 8.514 79.624 0.001 1 49 127
    i 9.411 79.624 0.001 1 49 127
    i 9.412 79.687 0.001 1 49 127
    i 8.515 79.749 0.001 1 49 127
    i 9.413 79.749 0.001 1 49 127
    i 5.026 79.749 0.001 1 37 127
    i 6.026 79.749 0.001 1 37 127
    i 9.414 79.812 0.001 1 49 127
    i 8.516 79.875 0.001 1 49 113
    i 9.415 79.875 0.001 1 49 127
    i 9.416 79.937 0.001 1 49 127
    i 5.027 80.000 0.001 1 37 127
    i 4.059 80.000 0.001 1 37 127
    i 6.027 80.000 0.001 1 37 127
    i 8.517 80.000 0.001 1 49 127
    i 9.417 80.000 0.001 1 49 127
    i -10.079 79.999 0
    i -10.080 79.999 0
    i 11.102 80.012 -1.000 1 38 78
    i -11.101 80.031 0
    i 9.418 80.061 0.001 1 49 127
    i 8.518 80.124 0.001 1 49 127
    i 9.419 80.124 0.001 1 49 127
    i 9.420 80.187 0.001 1 49 127
    i 8.519 80.249 0.001 1 49 127
    i 9.421 80.249 0.001 1 49 127
    i 9.422 80.312 0.001 1 49 127
    i 8.520 80.375 0.001 1 49 127
    i 9.423 80.375 0.001 1 49 127
    i 9.424 80.437 0.001 1 49 127
    i 7.059 80.500 0.001 1 39 127
    i 9.425 80.500 0.001 1 49 127
    i 8.521 80.500 0.001 1 49 127
    i 9.426 80.561 0.001 1 49 127
    i 8.522 80.624 0.001 1 49 127
    i 9.427 80.624 0.001 1 49 127
    i 9.428 80.687 0.001 1 49 127
    i 8.523 80.749 0.001 1 49 127
    i 9.429 80.749 0.001 1 49 127
    i 11.103 80.760 -1.000 1 36 86
    i -11.102 80.768 0
    i 9.430 80.812 0.001 1 49 127
    i 8.524 80.875 0.001 1 49 127
    i 9.431 80.875 0.001 1 49 127
    i 9.432 80.937 0.001 1 49 127
    i 9.433 81.000 0.001 1 49 127
    i 4.060 81.000 0.001 1 37 127
    i 8.525 81.000 0.001 1 49 127
    i 10.081 81.000 -1.000 1 72 127
    i 10.082 81.000 -1.000 1 76 127
    i 9.434 81.061 0.001 1 49 127
    i 8.526 81.124 0.001 1 49 127
    i 9.435 81.124 0.001 1 49 127
    i 9.436 81.187 0.001 1 49 127
    i 8.527 81.249 0.001 1 49 127
    i 9.437 81.249 0.001 1 49 127
    i -11.103 81.257 0
    i 11.104 81.259 -1.000 1 33 74
    i 9.438 81.312 0.001 1 49 127
    i 9.439 81.375 0.001 1 49 127
    i 8.528 81.375 0.001 1 49 127
    i 9.440 81.437 0.001 1 49 127
    i 8.529 81.500 0.001 1 49 127
    i 7.060 81.500 0.001 1 39 127
    i 9.441 81.500 0.001 1 49 127
    i 11.105 81.508 -1.000 1 36 91
    i -11.104 81.517 0
    i 9.442 81.561 0.001 1 49 127
    i 9.443 81.624 0.001 1 49 127
    i 8.530 81.624 0.001 1 49 127
    i 9.444 81.687 0.001 1 49 127
    i 9.445 81.749 0.001 1 49 127
    i 8.531 81.749 0.001 1 49 127
    i 9.446 81.812 0.001 1 49 127
    i 9.447 81.875 0.001 1 49 127
    i 8.532 81.875 0.001 1 49 113
    i 9.448 81.937 0.001 1 49 127
    i 6.028 82.000 0.001 1 37 127
    i 8.533 82.000 0.001 1 49 127
    i 9.449 82.000 0.001 1 49 127
    i -10.081 82.000 0
    i -10.082 82.000 0
    i -11.105 82.000 0
    i 11.106 82.000 -1.000 1 38 81
    i 4.061 82.000 0.001 1 37 127
    i 5.028 82.000 0.001 1 37 127
    i 9.450 82.061 0.001 1 49 127
    i 8.534 82.124 0.001 1 49 127
    i 9.451 82.124 0.001 1 49 127
    i 9.452 82.187 0.001 1 49 127
    i 8.535 82.249 0.001 1 49 127
    i 9.453 82.249 0.001 1 49 127
    i 9.454 82.312 0.001 1 49 127
    i 9.455 82.375 0.001 1 49 127
    i 8.536 82.375 0.001 1 49 127
    i 9.456 82.437 0.001 1 49 127
    i 7.061 82.500 0.001 1 39 127
    i 8.537 82.500 0.001 1 49 127
    i 9.457 82.500 0.001 1 49 127
    i 9.458 82.561 0.001 1 49 127
    i 8.538 82.624 0.001 1 49 127
    i 9.459 82.624 0.001 1 49 127
    i 9.460 82.687 0.001 1 49 127
    i 11.107 82.737 -1.000 1 41 89
    i -11.106 82.744 0
    i 8.539 82.749 0.001 1 49 127
    i 9.461 82.749 0.001 1 49 127
    i 9.462 82.812 0.001 1 49 127
    i 8.540 82.875 0.001 1 49 127
    i 9.463 82.875 0.001 1 49 127
    i 9.464 82.937 0.001 1 49 127
    i 8.541 83.000 0.001 1 49 127
    i 4.062 83.000 0.001 1 37 127
    i 9.465 83.000 0.001 1 49 127
    i 10.083 83.000 -1.000 1 72 127
    i 10.084 83.000 -1.000 1 76 127
    i 9.466 83.061 0.001 1 49 127
    i 8.542 83.124 0.001 1 49 127
    i 9.467 83.124 0.001 1 49 127
    i 9.468 83.187 0.001 1 49 127
    i 8.543 83.249 0.001 1 49 127
    i 9.469 83.249 0.001 1 49 127
    i 11.108 83.255 -1.000 1 38 68
    i -11.107 83.260 0
    i 9.470 83.312 0.001 1 49 127
    i 9.471 83.375 0.001 1 49 127
    i 8.544 83.375 0.001 1 49 127
    i 9.472 83.437 0.001 1 49 127
    i 11.109 83.501 -1.000 1 41 78
    i 8.545 83.500 0.001 1 49 127
    i 7.062 83.500 0.001 1 39 127
    i 9.473 83.500 0.001 1 49 127
    i -11.108 83.509 0
    i 9.474 83.561 0.001 1 49 127
    i 8.546 83.624 0.001 1 49 127
    i 9.475 83.624 0.001 1 49 127
    i 9.476 83.687 0.001 1 49 127
    i 5.029 83.749 0.001 1 37 127
    i 6.029 83.749 0.001 1 37 127
    i 8.547 83.749 0.001 1 49 127
    i 9.477 83.749 0.001 1 49 127
    i 9.478 83.812 0.001 1 49 127
    i 9.479 83.875 0.001 1 49 127
    i 8.548 83.875 0.001 1 49 113
    i 9.480 83.937 0.001 1 49 127
    i 4.063 84.000 0.001 1 37 127
    i 5.030 84.000 0.001 1 37 127
    i 6.030 84.000 0.001 1 37 127
    i 9.481 84.000 0.001 1 49 127
    i -10.083 83.999 0
    i 8.549 84.000 0.001 1 49 127
    i -10.084 83.999 0
    i 11.110 84.012 -1.000 1 38 78
    i -11.109 84.031 0
    i 9.482 84.061 0.001 1 49 127
    i 9.483 84.124 0.001 1 49 127
    i 8.550 84.124 0.001 1 49 127
    i 9.484 84.187 0.001 1 49 127
    i 9.485 84.249 0.001 1 49 127
    i 8.551 84.249 0.001 1 49 127
    i 9.486 84.312 0.001 1 49 127
    i 9.487 84.375 0.001 1 49 127
    i 8.552 84.375 0.001 1 49 127
    i 9.488 84.437 0.001 1 49 127
    i 7.063 84.500 0.001 1 39 127
    i 9.489 84.500 0.001 1 49 127
    i 8.553 84.500 0.001 1 49 127
    i 9.490 84.561 0.001 1 49 127
    i 8.554 84.624 0.001 1 49 127
    i 9.491 84.624 0.001 1 49 127
    i 9.492 84.687 0.001 1 49 127
    i 8.555 84.749 0.001 1 49 127
    i 9.493 84.749 0.001 1 49 127
    i 11.111 84.760 -1.000 1 36 86
    i -11.110 84.768 0
    i 9.494 84.812 0.001 1 49 127
    i 8.556 84.875 0.001 1 49 127
    i 9.495 84.875 0.001 1 49 127
    i 9.496 84.937 0.001 1 49 127
    i 9.497 85.000 0.001 1 49 127
    i 10.085 85.000 -1.000 1 72 127
    i 10.086 85.000 -1.000 1 76 127
    i 4.064 85.000 0.001 1 37 127
    i 8.557 85.000 0.001 1 49 127
    i 9.498 85.061 0.001 1 49 127
    i 8.558 85.124 0.001 1 49 127
    i 9.499 85.124 0.001 1 49 127
    i 9.500 85.187 0.001 1 49 127
    i 9.501 85.249 0.001 1 49 127
    i 8.559 85.249 0.001 1 49 127
    i -11.111 85.257 0
    i 11.112 85.259 -1.000 1 33 74
    i 9.502 85.312 0.001 1 49 127
    i 8.560 85.375 0.001 1 49 127
    i 9.503 85.375 0.001 1 49 127
    i 9.504 85.437 0.001 1 49 127
    i 7.064 85.500 0.001 1 39 127
    i 8.561 85.500 0.001 1 49 127
    i 9.505 85.500 0.001 1 49 127
    i 11.113 85.508 -1.000 1 36 91
    i -11.112 85.517 0
    i 9.506 85.561 0.001 1 49 127
    i 8.562 85.624 0.001 1 49 127
    i 9.507 85.624 0.001 1 49 127
    i 9.508 85.687 0.001 1 49 127
    i 9.509 85.749 0.001 1 49 127
    i 8.563 85.749 0.001 1 49 127
    i 9.510 85.812 0.001 1 49 127
    i 8.564 85.875 0.001 1 49 113
    i 9.511 85.875 0.001 1 49 127
    i 9.512 85.937 0.001 1 49 127
    i 5.031 86.000 0.001 1 37 127
    i 6.031 86.000 0.001 1 37 127
    i 4.065 86.000 0.001 1 37 127
    i 9.513 86.000 0.001 1 49 127
    i -11.113 86.000 0
    i 8.565 86.000 0.001 1 49 127
    i 11.114 86.000 -1.000 1 38 81
    i -10.085 86.000 0
    i -10.086 86.000 0
    i 9.514 86.061 0.001 1 49 127
    i 9.515 86.124 0.001 1 49 127
    i 8.566 86.124 0.001 1 49 127
    i 9.516 86.187 0.001 1 49 127
    i 8.567 86.249 0.001 1 49 127
    i 9.517 86.249 0.001 1 49 127
    i 9.518 86.312 0.001 1 49 127
    i 9.519 86.375 0.001 1 49 127
    i 8.568 86.375 0.001 1 49 127
    i 9.520 86.437 0.001 1 49 127
    i 8.569 86.500 0.001 1 49 127
    i 7.065 86.500 0.001 1 39 127
    i 9.521 86.500 0.001 1 49 127
    i 9.522 86.561 0.001 1 49 127
    i 8.570 86.624 0.001 1 49 127
    i 9.523 86.624 0.001 1 49 127
    i 9.524 86.687 0.001 1 49 127
    i 11.115 86.737 -1.000 1 41 89
    i -11.114 86.744 0
    i 9.525 86.749 0.001 1 49 127
    i 8.571 86.749 0.001 1 49 127
    i 9.526 86.812 0.001 1 49 127
    i 8.572 86.875 0.001 1 49 127
    i 9.527 86.875 0.001 1 49 127
    i 9.528 86.937 0.001 1 49 127
    i 9.529 87.000 0.001 1 49 127
    i 4.066 87.000 0.001 1 37 127
    i 8.573 87.000 0.001 1 49 127
    i 10.087 87.000 -1.000 1 72 127
    i 10.088 87.000 -1.000 1 76 127
    i 9.530 87.061 0.001 1 49 127
    i 8.574 87.124 0.001 1 49 127
    i 9.531 87.124 0.001 1 49 127
    i 9.532 87.187 0.001 1 49 127
    i 9.533 87.249 0.001 1 49 127
    i 8.575 87.249 0.001 1 49 127
    i 11.116 87.255 -1.000 1 38 68
    i -11.115 87.260 0
    i 9.534 87.312 0.001 1 49 127
    i 8.576 87.375 0.001 1 49 127
    i 9.535 87.375 0.001 1 49 127
    i 9.536 87.437 0.001 1 49 127
    i 9.537 87.500 0.001 1 49 127
    i 11.117 87.501 -1.000 1 41 78
    i 7.066 87.500 0.001 1 39 127
    i 8.577 87.500 0.001 1 49 127
    i -11.116 87.509 0
    i 9.538 87.561 0.001 1 49 127
    i 9.539 87.624 0.001 1 49 127
    i 8.578 87.624 0.001 1 49 127
    i 9.540 87.687 0.001 1 49 127
    i 5.032 87.749 0.001 1 37 127
    i 6.032 87.749 0.001 1 37 127
    i 9.541 87.749 0.001 1 49 127
    i 8.579 87.749 0.001 1 49 127
    i 9.542 87.812 0.001 1 49 127
    i 9.543 87.875 0.001 1 49 127
    i 8.580 87.875 0.001 1 49 113
    i 9.544 87.937 0.001 1 49 127
    i -10.087 87.999 0
    i 4.067 88.000 0.001 1 37 127
    i 9.545 88.000 0.001 1 49 127
    i 5.033 88.000 0.001 1 37 127
    i -10.088 87.999 0
    i 8.581 88.000 0.001 1 49 127
    i 6.033 88.000 0.001 1 37 127
    i 11.118 88.012 -1.000 1 38 78
    i -11.117 88.031 0
    i 9.546 88.061 0.001 1 49 127
    i 8.582 88.124 0.001 1 49 127
    i 9.547 88.124 0.001 1 49 127
    i 9.548 88.187 0.001 1 49 127
    i 9.549 88.249 0.001 1 49 127
    i 8.583 88.249 0.001 1 49 127
    i 9.550 88.312 0.001 1 49 127
    i 9.551 88.375 0.001 1 49 127
    i 8.584 88.375 0.001 1 49 127
    i 9.552 88.437 0.001 1 49 127
    i 7.067 88.500 0.001 1 39 127
    i 8.585 88.500 0.001 1 49 127
    i 9.553 88.500 0.001 1 49 127
    i 9.554 88.561 0.001 1 49 127
    i 8.586 88.624 0.001 1 49 127
    i 9.555 88.624 0.001 1 49 127
    i 9.556 88.687 0.001 1 49 127
    i 8.587 88.749 0.001 1 49 127
    i 9.557 88.749 0.001 1 49 127
    i 11.119 88.760 -1.000 1 36 86
    i -11.118 88.768 0
    i 9.558 88.812 0.001 1 49 127
    i 8.588 88.875 0.001 1 49 127
    i 9.559 88.875 0.001 1 49 127
    i 9.560 88.937 0.001 1 49 127
    i 4.068 89.000 0.001 1 37 127
    i 8.589 89.000 0.001 1 49 127
    i 9.561 89.000 0.001 1 49 127
    i 10.089 89.000 -1.000 1 72 127
    i 10.090 89.000 -1.000 1 76 127
    i 9.562 89.061 0.001 1 49 127
    i 9.563 89.124 0.001 1 49 127
    i 8.590 89.124 0.001 1 49 127
    i 9.564 89.187 0.001 1 49 127
    i 8.591 89.249 0.001 1 49 127
    i 9.565 89.249 0.001 1 49 127
    i -11.119 89.257 0
    i 11.120 89.259 -1.000 1 33 74
    i 9.566 89.312 0.001 1 49 127
    i 8.592 89.375 0.001 1 49 127
    i 9.567 89.375 0.001 1 49 127
    i 9.568 89.437 0.001 1 49 127
    i 9.569 89.500 0.001 1 49 127
    i 8.593 89.500 0.001 1 49 127
    i 7.068 89.500 0.001 1 39 127
    i 11.121 89.508 -1.000 1 36 91
    i -11.120 89.517 0
    i 9.570 89.561 0.001 1 49 127
    i 8.594 89.624 0.001 1 49 127
    i 9.571 89.624 0.001 1 49 127
    i 9.572 89.687 0.001 1 49 127
    i 9.573 89.749 0.001 1 49 127
    i 8.595 89.749 0.001 1 49 127
    i 9.574 89.812 0.001 1 49 127
    i 8.596 89.875 0.001 1 49 113
    i 9.575 89.875 0.001 1 49 127
    i 9.576 89.937 0.001 1 49 127
    i 9.577 90.000 0.001 1 49 127
    i 6.034 90.000 0.001 1 37 127
    i 4.069 90.000 0.001 1 37 127
    i 8.597 90.000 0.001 1 49 127
    i -10.089 90.000 0
    i 5.034 90.000 0.001 1 37 127
    i -10.090 90.000 0
    i -11.121 89.999 0
    i 11.122 90.000 -1.000 1 38 83
    i 9.578 90.061 0.001 1 49 127
    i 8.598 90.124 0.001 1 49 127
    i 9.579 90.124 0.001 1 49 127
    i 9.580 90.187 0.001 1 49 127
    i 8.599 90.249 0.001 1 49 127
    i 9.581 90.249 0.001 1 49 127
    i 9.582 90.312 0.001 1 49 127
    i 8.600 90.375 0.001 1 49 127
    i 9.583 90.375 0.001 1 49 127
    i 9.584 90.437 0.001 1 49 127
    i 7.069 90.500 0.001 1 39 127
    i 8.601 90.500 0.001 1 49 127
    i 9.585 90.500 0.001 1 49 127
    i 9.586 90.561 0.001 1 49 127
    i 8.602 90.624 0.001 1 49 127
    i 9.587 90.624 0.001 1 49 127
    i 9.588 90.687 0.001 1 49 127
    i 11.123 90.737 -1.000 1 41 103
    i 8.603 90.749 0.001 1 49 127
    i 9.589 90.749 0.001 1 49 127
    i -11.122 90.756 0
    i 9.590 90.812 0.001 1 49 127
    i 8.604 90.875 0.001 1 49 127
    i 9.591 90.875 0.001 1 49 127
    i 9.592 90.937 0.001 1 49 127
    i 9.593 91.000 0.001 1 49 127
    i 10.091 91.000 -1.000 1 72 127
    i 8.605 91.000 0.001 1 49 127
    i 4.070 91.000 0.001 1 37 127
    i 10.092 91.000 -1.000 1 76 127
    i 9.594 91.061 0.001 1 49 127
    i 8.606 91.124 0.001 1 49 127
    i 9.595 91.124 0.001 1 49 127
    i 9.596 91.187 0.001 1 49 127
    i 11.124 91.223 -1.000 1 44 76
    i -11.123 91.235 0
    i 8.607 91.249 0.001 1 49 127
    i 9.597 91.249 0.001 1 49 127
    i 9.598 91.312 0.001 1 49 127
    i 8.608 91.375 0.001 1 49 127
    i 9.599 91.375 0.001 1 49 127
    i 9.600 91.437 0.001 1 49 127
    i 7.070 91.500 0.001 1 39 127
    i 9.601 91.500 0.001 1 49 127
    i 8.609 91.500 0.001 1 49 127
    i -11.124 91.523 0
    i 11.125 91.523 -1.000 1 43 89
    i 9.602 91.561 0.001 1 49 127
    i 9.603 91.624 0.001 1 49 127
    i 8.610 91.624 0.001 1 49 127
    i 9.604 91.687 0.001 1 49 127
    i 5.035 91.749 0.001 1 37 127
    i 6.035 91.749 0.001 1 37 127
    i 8.611 91.749 0.001 1 49 127
    i 9.605 91.749 0.001 1 49 127
    i 9.606 91.812 0.001 1 49 127
    i 8.612 91.875 0.001 1 49 113
    i 9.607 91.875 0.001 1 49 127
    i 9.608 91.937 0.001 1 49 127
    i -11.125 91.997 0
    i 4.071 92.000 0.001 1 37 127
    i 5.036 92.000 0.001 1 37 127
    i 6.036 92.000 0.001 1 37 127
    i 9.609 92.000 0.001 1 49 127
    i 8.613 92.000 0.001 1 49 127
    i -10.091 91.999 0
    i 11.126 91.997 -1.000 1 41 97
    i -10.092 91.999 0
    i 9.610 92.061 0.001 1 49 127
    i 9.611 92.124 0.001 1 49 127
    i 8.614 92.124 0.001 1 49 127
    i 9.612 92.187 0.001 1 49 127
    i 9.613 92.249 0.001 1 49 127
    i 8.615 92.249 0.001 1 49 127
    i 9.614 92.312 0.001 1 49 127
    i 8.616 92.375 0.001 1 49 127
    i 9.615 92.375 0.001 1 49 127
    i 9.616 92.437 0.001 1 49 127
    i 7.071 92.500 0.001 1 39 127
    i 8.617 92.500 0.001 1 49 127
    i 9.617 92.500 0.001 1 49 127
    i 9.618 92.561 0.001 1 49 127
    i 8.618 92.624 0.001 1 49 127
    i 9.619 92.624 0.001 1 49 127
    i 9.620 92.687 0.001 1 49 127
    i 9.621 92.749 0.001 1 49 127
    i 8.619 92.749 0.001 1 49 127
    i -11.126 92.756 0
    i 11.127 92.759 -1.000 1 38 80
    i 9.622 92.812 0.001 1 49 127
    i 8.620 92.875 0.001 1 49 127
    i 9.623 92.875 0.001 1 49 127
    i 9.624 92.937 0.001 1 49 127
    i 8.621 93.000 0.001 1 49 127
    i 9.625 93.000 0.001 1 49 127
    i 10.093 93.000 -1.000 1 72 127
    i 10.094 93.000 -1.000 1 76 127
    i 4.072 93.000 0.001 1 37 127
    i 9.626 93.061 0.001 1 49 127
    i 8.622 93.124 0.001 1 49 127
    i 9.627 93.124 0.001 1 49 127
    i 9.628 93.187 0.001 1 49 127
    i 11.128 93.205 -1.000 1 33 79
    i -11.127 93.229 0
    i 9.629 93.249 0.001 1 49 127
    i 8.623 93.249 0.001 1 49 127
    i 9.630 93.312 0.001 1 49 127
    i 8.624 93.375 0.001 1 49 127
    i 9.631 93.375 0.001 1 49 127
    i 9.632 93.437 0.001 1 49 127
    i 7.072 93.500 0.001 1 39 127
    i 8.625 93.500 0.001 1 49 127
    i 9.633 93.500 0.001 1 49 127
    i 11.129 93.507 -1.000 1 36 89
    i -11.128 93.508 0
    i 9.634 93.561 0.001 1 49 127
    i 8.626 93.624 0.001 1 49 127
    i 9.635 93.624 0.001 1 49 127
    i 9.636 93.687 0.001 1 49 127
    i 8.627 93.749 0.001 1 49 127
    i 9.637 93.749 0.001 1 49 127
    i 9.638 93.812 0.001 1 49 127
    i 8.628 93.875 0.001 1 49 113
    i 9.639 93.875 0.001 1 49 127
    i 9.640 93.937 0.001 1 49 127
    i -11.129 93.999 0
    i -10.093 94.000 0
    i 8.629 94.000 0.001 1 49 127
    i 9.641 94.000 0.001 1 49 127
    i 4.073 94.000 0.001 1 37 127
    i 5.037 94.000 0.001 1 37 127
    i 6.037 94.000 0.001 1 37 127
    i -10.094 94.000 0
    i 11.130 94.000 -1.000 1 38 81
    i 9.642 94.061 0.001 1 49 127
    i 8.630 94.124 0.001 1 49 127
    i 9.643 94.124 0.001 1 49 127
    i 9.644 94.187 0.001 1 49 127
    i 8.631 94.249 0.001 1 49 127
    i 9.645 94.249 0.001 1 49 127
    i 9.646 94.312 0.001 1 49 127
    i 9.647 94.375 0.001 1 49 127
    i 8.632 94.375 0.001 1 49 127
    i 9.648 94.437 0.001 1 49 127
    i 7.073 94.500 0.001 1 39 127
    i 9.649 94.500 0.001 1 49 127
    i 8.633 94.500 0.001 1 49 127
    i 9.650 94.561 0.001 1 49 127
    i 8.634 94.624 0.001 1 49 127
    i 9.651 94.624 0.001 1 49 127
    i 9.652 94.687 0.001 1 49 127
    i 11.131 94.737 -1.000 1 41 89
    i -11.130 94.744 0
    i 8.635 94.749 0.001 1 49 127
    i 9.653 94.749 0.001 1 49 127
    i 9.654 94.812 0.001 1 49 127
    i 8.636 94.875 0.001 1 49 127
    i 9.655 94.875 0.001 1 49 127
    i 9.656 94.937 0.001 1 49 127
    i 9.657 95.000 0.001 1 49 127
    i 10.095 95.000 -1.000 1 72 127
    i 8.637 95.000 0.001 1 49 127
    i 10.096 95.000 -1.000 1 76 127
    i 4.074 95.000 0.001 1 37 127
    i 9.658 95.061 0.001 1 49 127
    i 8.638 95.124 0.001 1 49 127
    i 9.659 95.124 0.001 1 49 127
    i 9.660 95.187 0.001 1 49 127
    i 8.639 95.249 0.001 1 49 127
    i 9.661 95.249 0.001 1 49 127
    i 11.132 95.255 -1.000 1 38 68
    i -11.131 95.260 0
    i 9.662 95.312 0.001 1 49 127
    i 8.640 95.375 0.001 1 49 127
    i 9.663 95.375 0.001 1 49 127
    i 9.664 95.437 0.001 1 49 127
    i 11.133 95.501 -1.000 1 41 78
    i 7.074 95.500 0.001 1 39 127
    i 8.641 95.500 0.001 1 49 127
    i 9.665 95.500 0.001 1 49 127
    i -11.132 95.509 0
    i 9.666 95.561 0.001 1 49 127
    i 8.642 95.624 0.001 1 49 127
    i 9.667 95.624 0.001 1 49 127
    i 9.668 95.687 0.001 1 49 127
    i 6.038 95.749 0.001 1 37 127
    i 5.038 95.749 0.001 1 37 127
    i 8.643 95.749 0.001 1 49 127
    i 9.669 95.749 0.001 1 49 127
    i 9.670 95.812 0.001 1 49 127
    i 8.644 95.875 0.001 1 49 113
    i 9.671 95.875 0.001 1 49 127
    i 9.672 95.937 0.001 1 49 127
    i 4.075 96.000 0.001 1 37 127
    i 5.039 96.000 0.001 1 37 127
    i 6.039 96.000 0.001 1 37 127
    i 8.645 96.000 0.001 1 49 127
    i 9.673 96.000 0.001 1 49 127
    i -10.095 95.999 0
    i -10.096 95.999 0
    i 11.134 96.012 -1.000 1 38 78
    i -11.133 96.031 0
    i 9.674 96.061 0.001 1 49 127
    i 8.646 96.124 0.001 1 49 127
    i 9.675 96.124 0.001 1 49 127
    i 9.676 96.187 0.001 1 49 127
    i 8.647 96.249 0.001 1 49 127
    i 9.677 96.249 0.001 1 49 127
    i 9.678 96.312 0.001 1 49 127
    i 8.648 96.375 0.001 1 49 127
    i 9.679 96.375 0.001 1 49 127
    i 9.680 96.437 0.001 1 49 127
    i 7.075 96.500 0.001 1 39 127
    i 8.649 96.500 0.001 1 49 127
    i 9.681 96.500 0.001 1 49 127
    i 9.682 96.561 0.001 1 49 127
    i 9.683 96.624 0.001 1 49 127
    i 8.650 96.624 0.001 1 49 127
    i 9.684 96.687 0.001 1 49 127
    i 8.651 96.749 0.001 1 49 127
    i 9.685 96.749 0.001 1 49 127
    i 11.135 96.760 -1.000 1 36 86
    i -11.134 96.768 0
    i 9.686 96.812 0.001 1 49 127
    i 8.652 96.875 0.001 1 49 127
    i 9.687 96.875 0.001 1 49 127
    i 9.688 96.937 0.001 1 49 127
    i 4.076 97.000 0.001 1 37 127
    i 8.653 97.000 0.001 1 49 127
    i 9.689 97.000 0.001 1 49 127
    i 10.097 97.000 -1.000 1 72 127
    i 10.098 97.000 -1.000 1 76 127
    i 9.690 97.061 0.001 1 49 127
    i 8.654 97.124 0.001 1 49 127
    i 9.691 97.124 0.001 1 49 127
    i 9.692 97.187 0.001 1 49 127
    i 8.655 97.249 0.001 1 49 127
    i 9.693 97.249 0.001 1 49 127
    i -11.135 97.257 0
    i 11.136 97.259 -1.000 1 33 74
    i 9.694 97.312 0.001 1 49 127
    i 8.656 97.375 0.001 1 49 127
    i 9.695 97.375 0.001 1 49 127
    i 9.696 97.437 0.001 1 49 127
    i 7.076 97.500 0.001 1 39 127
    i 9.697 97.500 0.001 1 49 127
    i 8.657 97.500 0.001 1 49 127
    i 11.137 97.508 -1.000 1 36 91
    i -11.136 97.517 0
    i 9.698 97.561 0.001 1 49 127
    i 8.658 97.624 0.001 1 49 127
    i 9.699 97.624 0.001 1 49 127
    i 9.700 97.687 0.001 1 49 127
    i 8.659 97.749 0.001 1 49 127
    i 9.701 97.749 0.001 1 49 127
    i 9.702 97.812 0.001 1 49 127
    i 8.660 97.875 0.001 1 49 113
    i 9.703 97.875 0.001 1 49 127
    i 9.704 97.937 0.001 1 49 127
    i 9.705 98.000 0.001 1 49 127
    i -10.097 98.000 0
    i -10.098 98.000 0
    i -11.137 98.000 0
    i 11.138 98.000 -1.000 1 38 81
    i 4.077 98.000 0.001 1 37 127
    i 5.040 98.000 0.001 1 37 127
    i 6.040 98.000 0.001 1 37 127
    i 8.661 98.000 0.001 1 49 127
    i 9.706 98.061 0.001 1 49 127
    i 9.707 98.124 0.001 1 49 127
    i 8.662 98.124 0.001 1 49 127
    i 9.708 98.187 0.001 1 49 127
    i 8.663 98.249 0.001 1 49 127
    i 9.709 98.249 0.001 1 49 127
    i 9.710 98.312 0.001 1 49 127
    i 9.711 98.375 0.001 1 49 127
    i 8.664 98.375 0.001 1 49 127
    i 9.712 98.437 0.001 1 49 127
    i 7.077 98.500 0.001 1 39 127
    i 8.665 98.500 0.001 1 49 127
    i 9.713 98.500 0.001 1 49 127
    i 9.714 98.561 0.001 1 49 127
    i 8.666 98.624 0.001 1 49 127
    i 9.715 98.624 0.001 1 49 127
    i 9.716 98.687 0.001 1 49 127
    i 11.139 98.737 -1.000 1 41 89
    i -11.138 98.744 0
    i 8.667 98.749 0.001 1 49 127
    i 9.717 98.749 0.001 1 49 127
    i 9.718 98.812 0.001 1 49 127
    i 9.719 98.875 0.001 1 49 127
    i 8.668 98.875 0.001 1 49 127
    i 9.720 98.937 0.001 1 49 127
    i 4.078 99.000 0.001 1 37 127
    i 9.721 99.000 0.001 1 49 127
    i 8.669 99.000 0.001 1 49 127
    i 10.099 99.000 -1.000 1 72 127
    i 10.100 99.000 -1.000 1 76 127
    i 9.722 99.061 0.001 1 49 127
    i 8.670 99.124 0.001 1 49 127
    i 9.723 99.124 0.001 1 49 127
    i 9.724 99.187 0.001 1 49 127
    i 9.725 99.249 0.001 1 49 127
    i 8.671 99.249 0.001 1 49 127
    i 11.140 99.255 -1.000 1 38 68
    i -11.139 99.260 0
    i 9.726 99.312 0.001 1 49 127
    i 8.672 99.375 0.001 1 49 127
    i 9.727 99.375 0.001 1 49 127
    i 9.728 99.437 0.001 1 49 127
    i 8.673 99.500 0.001 1 49 127
    i 11.141 99.501 -1.000 1 41 78
    i 7.078 99.500 0.001 1 39 127
    i 9.729 99.500 0.001 1 49 127
    i -11.140 99.509 0
    i 9.730 99.561 0.001 1 49 127
    i 8.674 99.624 0.001 1 49 127
    i 9.731 99.624 0.001 1 49 127
    i 9.732 99.687 0.001 1 49 127
    i 5.041 99.749 0.001 1 37 127
    i 6.041 99.749 0.001 1 37 127
    i 8.675 99.749 0.001 1 49 127
    i 9.733 99.749 0.001 1 49 127
    i 9.734 99.812 0.001 1 49 127
    i 9.735 99.875 0.001 1 49 127
    i 8.676 99.875 0.001 1 49 113
    i 9.736 99.937 0.001 1 49 127
    i 5.042 100.000 0.001 1 37 127
    i 6.042 100.000 0.001 1 37 127
    i 8.677 100.000 0.001 1 49 127
    i 9.737 100.000 0.001 1 49 127
    i -10.099 99.999 0
    i -10.100 99.999 0
    i 4.079 100.000 0.001 1 37 127
    i 11.142 100.012 -1.000 1 38 78
    i -11.141 100.031 0
    i 9.738 100.061 0.001 1 49 127
    i 8.678 100.124 0.001 1 49 127
    i 9.739 100.124 0.001 1 49 127
    i 9.740 100.187 0.001 1 49 127
    i 8.679 100.249 0.001 1 49 127
    i 9.741 100.249 0.001 1 49 127
    i 9.742 100.312 0.001 1 49 127
    i 8.680 100.375 0.001 1 49 127
    i 9.743 100.375 0.001 1 49 127
    i 9.744 100.437 0.001 1 49 127
    i 9.745 100.500 0.001 1 49 127
    i 8.681 100.500 0.001 1 49 127
    i 7.079 100.500 0.001 1 39 127
    i 9.746 100.561 0.001 1 49 127
    i 8.682 100.624 0.001 1 49 127
    i 9.747 100.624 0.001 1 49 127
    i 9.748 100.687 0.001 1 49 127
    i 8.683 100.749 0.001 1 49 127
    i 9.749 100.749 0.001 1 49 127
    i 11.143 100.760 -1.000 1 36 86
    i -11.142 100.768 0
    i 9.750 100.812 0.001 1 49 127
    i 8.684 100.875 0.001 1 49 127
    i 9.751 100.875 0.001 1 49 127
    i 9.752 100.937 0.001 1 49 127
    i 8.685 101.000 0.001 1 49 127
    i 9.753 101.000 0.001 1 49 127
    i 10.101 101.000 -1.000 1 72 127
    i 10.102 101.000 -1.000 1 76 127
    i 4.080 101.000 0.001 1 37 127
    i 9.754 101.061 0.001 1 49 127
    i 8.686 101.124 0.001 1 49 127
    i 9.755 101.124 0.001 1 49 127
    i 9.756 101.187 0.001 1 49 127
    i 9.757 101.249 0.001 1 49 127
    i 8.687 101.249 0.001 1 49 127
    i -11.143 101.257 0
    i 11.144 101.259 -1.000 1 33 74
    i 9.758 101.312 0.001 1 49 127
    i 8.688 101.375 0.001 1 49 127
    i 9.759 101.375 0.001 1 49 127
    i 9.760 101.437 0.001 1 49 127
    i 7.080 101.500 0.001 1 39 127
    i 8.689 101.500 0.001 1 49 127
    i 9.761 101.500 0.001 1 49 127
    i 11.145 101.508 -1.000 1 36 91
    i -11.144 101.517 0
    i 9.762 101.561 0.001 1 49 127
    i 8.690 101.624 0.001 1 49 127
    i 9.763 101.624 0.001 1 49 127
    i 9.764 101.687 0.001 1 49 127
    i 8.691 101.749 0.001 1 49 127
    i 9.765 101.749 0.001 1 49 127
    i 9.766 101.812 0.001 1 49 127
    i 8.692 101.875 0.001 1 49 113
    i 9.767 101.875 0.001 1 49 127
    i 9.768 101.937 0.001 1 49 127
    i -11.145 102.000 0
    i 11.146 102.000 -1.000 1 38 81
    i 4.081 102.000 0.001 1 37 127
    i 5.043 102.000 0.001 1 37 127
    i 6.043 102.000 0.001 1 37 127
    i 8.693 102.000 0.001 1 49 127
    i 9.769 102.000 0.001 1 49 127
    i -10.101 102.000 0
    i -10.102 102.000 0
    i 9.770 102.061 0.001 1 49 127
    i 8.694 102.124 0.001 1 49 127
    i 9.771 102.124 0.001 1 49 127
    i 9.772 102.187 0.001 1 49 127
    i 8.695 102.249 0.001 1 49 127
    i 9.773 102.249 0.001 1 49 127
    i 9.774 102.312 0.001 1 49 127
    i 9.775 102.375 0.001 1 49 127
    i 8.696 102.375 0.001 1 49 127
    i 9.776 102.437 0.001 1 49 127
    i 8.697 102.500 0.001 1 49 127
    i 7.081 102.500 0.001 1 39 127
    i 9.777 102.500 0.001 1 49 127
    i 9.778 102.561 0.001 1 49 127
    i 8.698 102.624 0.001 1 49 127
    i 9.779 102.624 0.001 1 49 127
    i 9.780 102.687 0.001 1 49 127
    i 11.147 102.737 -1.000 1 41 89
    i -11.146 102.744 0
    i 9.781 102.749 0.001 1 49 127
    i 8.699 102.749 0.001 1 49 127
    i 9.782 102.812 0.001 1 49 127
    i 8.700 102.875 0.001 1 49 127
    i 9.783 102.875 0.001 1 49 127
    i 9.784 102.937 0.001 1 49 127
    i 8.701 103.000 0.001 1 49 127
    i 9.785 103.000 0.001 1 49 127
    i 10.103 103.000 -1.000 1 72 127
    i 10.104 103.000 -1.000 1 76 127
    i 4.082 103.000 0.001 1 37 127
    i 9.786 103.061 0.001 1 49 127
    i 8.702 103.124 0.001 1 49 127
    i 9.787 103.124 0.001 1 49 127
    i 9.788 103.187 0.001 1 49 127
    i 8.703 103.249 0.001 1 49 127
    i 9.789 103.249 0.001 1 49 127
    i 11.148 103.255 -1.000 1 38 68
    i -11.147 103.260 0
    i 9.790 103.312 0.001 1 49 127
    i 9.791 103.375 0.001 1 49 127
    i 8.704 103.375 0.001 1 49 127
    i 9.792 103.437 0.001 1 49 127
    i 11.149 103.501 -1.000 1 41 78
    i 7.082 103.500 0.001 1 39 127
    i 8.705 103.500 0.001 1 49 127
    i 9.793 103.500 0.001 1 49 127
    i -11.148 103.509 0
    i 9.794 103.561 0.001 1 49 127
    i 9.795 103.624 0.001 1 49 127
    i 8.706 103.624 0.001 1 49 127
    i 9.796 103.687 0.001 1 49 127
    i 6.044 103.749 0.001 1 37 127
    i 9.797 103.749 0.001 1 49 127
    i 8.707 103.749 0.001 1 49 127
    i 5.044 103.749 0.001 1 37 127
    i 9.798 103.812 0.001 1 49 127
    i 9.799 103.875 0.001 1 49 127
    i 8.708 103.875 0.001 1 49 113
    i 9.800 103.937 0.001 1 49 127
    i 9.801 104.000 0.001 1 49 127
    i 4.083 104.000 0.001 1 37 127
    i 8.709 104.000 0.001 1 49 127
    i 6.045 104.000 0.001 1 37 127
    i -10.103 103.999 0
    i 5.045 104.000 0.001 1 37 127
    i -10.104 103.999 0
    i 11.150 104.012 -1.000 1 38 78
    i -11.149 104.031 0
    i 9.802 104.061 0.001 1 49 127
    i 9.803 104.124 0.001 1 49 127
    i 8.710 104.124 0.001 1 49 127
    i 9.804 104.187 0.001 1 49 127
    i 8.711 104.249 0.001 1 49 127
    i 9.805 104.249 0.001 1 49 127
    i 9.806 104.312 0.001 1 49 127
    i 8.712 104.375 0.001 1 49 127
    i 9.807 104.375 0.001 1 49 127
    i 9.808 104.437 0.001 1 49 127
    i 9.809 104.500 0.001 1 49 127
    i 8.713 104.500 0.001 1 49 127
    i 7.083 104.500 0.001 1 39 127
    i 9.810 104.561 0.001 1 49 127
    i 8.714 104.624 0.001 1 49 127
    i 9.811 104.624 0.001 1 49 127
    i 9.812 104.687 0.001 1 49 127
    i 8.715 104.749 0.001 1 49 127
    i 9.813 104.749 0.001 1 49 127
    i 11.151 104.760 -1.000 1 36 86
    i -11.150 104.768 0
    i 9.814 104.812 0.001 1 49 127
    i 9.815 104.875 0.001 1 49 127
    i 8.716 104.875 0.001 1 49 127
    i 9.816 104.937 0.001 1 49 127
    i 4.084 105.000 0.001 1 37 127
    i 8.717 105.000 0.001 1 49 127
    i 10.105 105.000 -1.000 1 72 127
    i 9.817 105.000 0.001 1 49 127
    i 10.106 105.000 -1.000 1 76 127
    i 9.818 105.061 0.001 1 49 127
    i 8.718 105.124 0.001 1 49 127
    i 9.819 105.124 0.001 1 49 127
    i 9.820 105.187 0.001 1 49 127
    i 8.719 105.249 0.001 1 49 127
    i 9.821 105.249 0.001 1 49 127
    i -11.151 105.257 0
    i 11.152 105.259 -1.000 1 33 74
    i 9.822 105.312 0.001 1 49 127
    i 9.823 105.375 0.001 1 49 127
    i 8.720 105.375 0.001 1 49 127
    i 9.824 105.437 0.001 1 49 127
    i 7.084 105.500 0.001 1 39 127
    i 8.721 105.500 0.001 1 49 127
    i 9.825 105.500 0.001 1 49 127
    i 11.153 105.508 -1.000 1 36 91
    i -11.152 105.517 0
    i 9.826 105.561 0.001 1 49 127
    i 9.827 105.624 0.001 1 49 127
    i 8.722 105.624 0.001 1 49 127
    i 9.828 105.687 0.001 1 49 127
    i 8.723 105.749 0.001 1 49 127
    i 9.829 105.749 0.001 1 49 127
    i 9.830 105.812 0.001 1 49 127
    i 8.724 105.875 0.001 1 49 113
    i 9.831 105.875 0.001 1 49 127
    i 9.832 105.937 0.001 1 49 127
    i -10.105 106.000 0
    i -10.106 106.000 0
    i 4.085 106.000 0.001 1 37 127
    i -11.153 105.999 0
    i 6.046 106.000 0.001 1 37 127
    i 5.046 106.000 0.001 1 37 127
    i 8.725 106.000 0.001 1 49 127
    i 9.833 106.000 0.001 1 49 127
    i 11.154 106.000 -1.000 1 38 83
    i 9.834 106.061 0.001 1 49 127
    i 8.726 106.124 0.001 1 49 127
    i 9.835 106.124 0.001 1 49 127
    i 9.836 106.187 0.001 1 49 127
    i 9.837 106.249 0.001 1 49 127
    i 8.727 106.249 0.001 1 49 127
    i 9.838 106.312 0.001 1 49 127
    i 8.728 106.375 0.001 1 49 127
    i 9.839 106.375 0.001 1 49 127
    i 9.840 106.437 0.001 1 49 127
    i 7.085 106.500 0.001 1 39 127
    i 9.841 106.500 0.001 1 49 127
    i 8.729 106.500 0.001 1 49 127
    i 9.842 106.561 0.001 1 49 127
    i 8.730 106.624 0.001 1 49 127
    i 9.843 106.624 0.001 1 49 127
    i 9.844 106.687 0.001 1 49 127
    i 11.155 106.737 -1.000 1 41 103
    i 8.731 106.749 0.001 1 49 127
    i 9.845 106.749 0.001 1 49 127
    i -11.154 106.756 0
    i 9.846 106.812 0.001 1 49 127
    i 9.847 106.875 0.001 1 49 127
    i 8.732 106.875 0.001 1 49 127
    i 9.848 106.937 0.001 1 49 127
    i 4.086 107.000 0.001 1 37 127
    i 10.107 107.000 -1.000 1 72 127
    i 10.108 107.000 -1.000 1 76 127
    i 9.849 107.000 0.001 1 49 127
    i 8.733 107.000 0.001 1 49 127
    i 9.850 107.061 0.001 1 49 127
    i 9.851 107.124 0.001 1 49 127
    i 8.734 107.124 0.001 1 49 127
    i 9.852 107.187 0.001 1 49 127
    i 11.156 107.223 -1.000 1 44 76
    i -11.155 107.235 0
    i 8.735 107.249 0.001 1 49 127
    i 9.853 107.249 0.001 1 49 127
    i 9.854 107.312 0.001 1 49 127
    i 9.855 107.375 0.001 1 49 127
    i 8.736 107.375 0.001 1 49 127
    i 9.856 107.437 0.001 1 49 127
    i 7.086 107.500 0.001 1 39 127
    i 8.737 107.500 0.001 1 49 127
    i 9.857 107.500 0.001 1 49 127
    i -11.156 107.523 0
    i 11.157 107.523 -1.000 1 43 89
    i 9.858 107.561 0.001 1 49 127
    i 8.738 107.624 0.001 1 49 127
    i 9.859 107.624 0.001 1 49 127
    i 9.860 107.687 0.001 1 49 127
    i 8.739 107.749 0.001 1 49 127
    i 9.861 107.749 0.001 1 49 127
    i 5.047 107.749 0.001 1 37 127
    i 6.047 107.749 0.001 1 37 127
    i 9.862 107.812 0.001 1 49 127
    i 8.740 107.875 0.001 1 49 113
    i 9.863 107.875 0.001 1 49 127
    i 9.864 107.937 0.001 1 49 127
    i -11.157 107.997 0
    i 9.865 108.000 0.001 1 49 127
    i 11.158 107.997 -1.000 1 41 97
    i 8.741 108.000 0.001 1 49 127
    i 4.087 108.000 0.001 1 37 127
    i 5.048 108.000 0.001 1 37 127
    i -10.107 107.999 0
    i -10.108 107.999 0
    i 6.048 108.000 0.001 1 37 127
    i 9.866 108.061 0.001 1 49 127
    i 8.742 108.124 0.001 1 49 127
    i 9.867 108.124 0.001 1 49 127
    i 9.868 108.187 0.001 1 49 127
    i 9.869 108.249 0.001 1 49 127
    i 8.743 108.249 0.001 1 49 127
    i 9.870 108.312 0.001 1 49 127
    i 8.744 108.375 0.001 1 49 127
    i 9.871 108.375 0.001 1 49 127
    i 9.872 108.437 0.001 1 49 127
    i 9.873 108.500 0.001 1 49 127
    i 7.087 108.500 0.001 1 39 127
    i 8.745 108.500 0.001 1 49 127
    i 9.874 108.561 0.001 1 49 127
    i 8.746 108.624 0.001 1 49 127
    i 9.875 108.624 0.001 1 49 127
    i 9.876 108.687 0.001 1 49 127
    i 8.747 108.749 0.001 1 49 127
    i 9.877 108.749 0.001 1 49 127
    i -11.158 108.756 0
    i 11.159 108.759 -1.000 1 38 80
    i 9.878 108.812 0.001 1 49 127
    i 8.748 108.875 0.001 1 49 127
    i 9.879 108.875 0.001 1 49 127
    i 9.880 108.937 0.001 1 49 127
    i 9.881 109.000 0.001 1 49 127
    i 4.088 109.000 0.001 1 37 127
    i 8.749 109.000 0.001 1 49 127
    i 10.109 109.000 -1.000 1 72 127
    i 10.110 109.000 -1.000 1 76 127
    i 9.882 109.061 0.001 1 49 127
    i 8.750 109.124 0.001 1 49 127
    i 9.883 109.124 0.001 1 49 127
    i 9.884 109.187 0.001 1 49 127
    i 11.160 109.205 -1.000 1 33 79
    i -11.159 109.229 0
    i 9.885 109.249 0.001 1 49 127
    i 8.751 109.249 0.001 1 49 127
    i 9.886 109.312 0.001 1 49 127
    i 8.752 109.375 0.001 1 49 127
    i 9.887 109.375 0.001 1 49 127
    i 9.888 109.437 0.001 1 49 127
    i 7.088 109.500 0.001 1 39 127
    i 9.889 109.500 0.001 1 49 127
    i 8.753 109.500 0.001 1 49 127
    i 11.161 109.507 -1.000 1 36 89
    i -11.160 109.508 0
    i 9.890 109.561 0.001 1 49 127
    i 8.754 109.624 0.001 1 49 127
    i 9.891 109.624 0.001 1 49 127
    i 9.892 109.687 0.001 1 49 127
    i 9.893 109.749 0.001 1 49 127
    i 8.755 109.749 0.001 1 49 127
    i 9.894 109.812 0.001 1 49 127
    i 8.756 109.875 0.001 1 49 113
    i 9.895 109.875 0.001 1 49 127
    i 9.896 109.937 0.001 1 49 127
    i -11.161 109.999 0
    i 6.049 110.000 0.001 1 37 127
    i 5.049 110.000 0.001 1 37 127
    i -10.109 110.000 0
    i 11.162 110.000 -1.000 1 38 83
    i -10.110 110.000 0
    i -11.162 110.312 0
    i 10.111 111.000 -1.000 1 72 127
    i 10.112 111.000 -1.000 1 76 127
    i 6.050 111.749 0.001 1 37 127
    i 5.050 111.749 0.001 1 37 127
    i -10.111 111.999 0
    i 6.051 112.000 0.001 1 37 127
    i 5.051 112.000 0.001 1 37 127
    i -10.112 111.999 0
    i 10.113 113.000 -1.000 1 72 127
    i 10.114 113.000 -1.000 1 76 127
    i -10.113 114.000 0
    i -10.114 114.000 0
    i 12.011 114.000 -1.000 1 38 81
    i 5.052 114.000 0.001 1 37 127
    i 6.052 114.000 0.001 1 37 127
    i 12.012 114.737 -1.000 1 41 89
    i -12.011 114.744 0
    i 10.115 115.000 -1.000 1 72 127
    i 10.116 115.000 -1.000 1 76 127
    i 12.013 115.255 -1.000 1 38 68
    i -12.012 115.260 0
    i 12.014 115.501 -1.000 1 41 78
    i -12.013 115.509 0
    i 5.053 115.749 0.001 1 37 127
    i 6.053 115.749 0.001 1 37 127
    i 6.054 116.000 0.001 1 37 127
    i -10.115 115.999 0
    i -10.116 115.999 0
    i 5.054 116.000 0.001 1 37 127
    i 12.015 116.012 -1.000 1 38 78
    i -12.014 116.031 0
    i -12.015 116.500 0
    i 10.117 117.000 -1.000 1 72 127
    i 10.118 117.000 -1.000 1 76 127
    i 6.055 117.749 0.001 1 37 127
    i 5.055 117.749 0.001 1 37 127
    i -10.117 118.000 0
    i 12.016 118.000 -1.000 1 38 81
    i -10.118 118.000 0
    i 5.056 118.000 0.001 1 37 127
    i 6.056 118.000 0.001 1 37 127
    i 12.017 118.737 -1.000 1 41 89
    i -12.016 118.744 0
    i 10.119 119.000 -1.000 1 72 127
    i 10.120 119.000 -1.000 1 76 127
    i 12.018 119.255 -1.000 1 38 68
    i -12.017 119.260 0
    i 12.019 119.501 -1.000 1 41 78
    i -12.018 119.509 0
    i 5.057 119.749 0.001 1 37 127
    i 6.057 119.749 0.001 1 37 127
    i 6.058 120.000 0.001 1 37 127
    i 5.058 120.000 0.001 1 37 127
    i -10.119 119.999 0
    i -10.120 119.999 0
    i 12.020 120.012 -1.000 1 38 78
    i -12.019 120.031 0
    i -12.020 120.500 0
    i 10.121 121.000 -1.000 1 72 127
    i 10.122 121.000 -1.000 1 76 127
    i 6.059 121.749 0.001 1 37 127
    i 5.059 121.749 0.001 1 37 127
    i 5.060 122.000 0.001 1 37 127
    i 6.060 122.000 0.001 1 37 127
    i -10.121 122.000 0
    i -10.122 122.000 0
    i 4.089 123.000 0.001 1 37 127
    i 10.123 123.000 -1.000 1 72 127
    i 10.124 123.000 -1.000 1 76 127
    i 5.061 123.749 0.001 1 37 127
    i 6.061 123.749 0.001 1 37 127
    i -10.123 123.999 0
    i -10.124 123.999 0
    i 6.062 124.000 0.001 1 37 127
    i 5.062 124.000 0.001 1 37 127
    i 4.090 125.000 0.001 1 37 127
    i 10.125 125.000 -1.000 1 72 127
    i 10.126 125.000 -1.000 1 76 127
    i 7.089 125.500 0.001 1 39 127
    i 6.063 125.749 0.001 1 37 127
    i 5.063 125.749 0.001 1 37 127
    i 6.064 126.000 0.001 1 37 127
    i 8.757 126.000 0.001 1 49 127
    i 4.091 126.000 0.001 1 37 127
    i 9.897 126.000 0.001 1 49 127
    i 5.064 126.000 0.001 1 37 127
    i 11.163 126.000 -1.000 1 38 81
    i -10.125 126.000 0
    i -10.126 126.000 0
    i 9.898 126.061 0.001 1 49 127
    i 9.899 126.124 0.001 1 49 127
    i 8.758 126.124 0.001 1 49 127
    i 9.900 126.187 0.001 1 49 127
    i 9.901 126.249 0.001 1 49 127
    i 8.759 126.249 0.001 1 49 127
    i 9.902 126.312 0.001 1 49 127
    i 8.760 126.375 0.001 1 49 127
    i 9.903 126.375 0.001 1 49 127
    i 9.904 126.437 0.001 1 49 127
    i 7.090 126.500 0.001 1 39 127
    i 4.092 126.500 0.001 1 37 127
    i 9.905 126.500 0.001 1 49 127
    i 8.761 126.500 0.001 1 49 127
    i 9.906 126.561 0.001 1 49 127
    i 8.762 126.624 0.001 1 49 127
    i 9.907 126.624 0.001 1 49 127
    i 9.908 126.687 0.001 1 49 127
    i 11.164 126.737 -1.000 1 41 89
    i -11.163 126.744 0
    i 9.909 126.749 0.001 1 49 127
    i 8.763 126.749 0.001 1 49 127
    i 9.910 126.812 0.001 1 49 127
    i 8.764 126.875 0.001 1 49 127
    i 9.911 126.875 0.001 1 49 127
    i 9.912 126.937 0.001 1 49 127
    i 4.093 127.000 0.001 1 37 127
    i 10.127 127.000 -1.000 1 72 127
    i 9.913 127.000 0.001 1 49 127
    i 8.765 127.000 0.001 1 49 127
    i 10.128 127.000 -1.000 1 76 127
    i 9.914 127.061 0.001 1 49 127
    i 8.766 127.124 0.001 1 49 127
    i 9.915 127.124 0.001 1 49 127
    i 9.916 127.187 0.001 1 49 127
    i 9.917 127.249 0.001 1 49 127
    i 8.767 127.249 0.001 1 49 127
    i 11.165 127.255 -1.000 1 38 68
    i -11.164 127.260 0
    i 9.918 127.312 0.001 1 49 127
    i 8.768 127.375 0.001 1 49 127
    i 9.919 127.375 0.001 1 49 127
    i 9.920 127.437 0.001 1 49 127
    i 11.166 127.501 -1.000 1 41 78
    i 4.094 127.500 0.001 1 37 127
    i 8.769 127.500 0.001 1 49 127
    i 7.091 127.500 0.001 1 39 127
    i 9.921 127.500 0.001 1 49 127
    i -11.165 127.509 0
    i 9.922 127.561 0.001 1 49 127
    i 8.770 127.624 0.001 1 49 127
    i 9.923 127.624 0.001 1 49 127
    i 9.924 127.687 0.001 1 49 127
    i 5.065 127.749 0.001 1 37 127
    i 6.065 127.749 0.001 1 37 127
    i 8.771 127.749 0.001 1 49 127
    i 9.925 127.749 0.001 1 49 127
    i 9.926 127.812 0.001 1 49 127
    i 9.927 127.875 0.001 1 49 127
    i 8.772 127.875 0.001 1 49 113
    i 9.928 127.937 0.001 1 49 127
    i 4.095 128.000 0.001 1 37 127
    i 5.066 128.000 0.001 1 37 127
    i 8.773 128.000 0.001 1 49 127
    i 9.929 128.000 0.001 1 49 127
    i 6.066 128.000 0.001 1 37 127
    i -10.127 127.999 0
    i -10.128 127.999 0
    i 11.167 128.012 -1.000 1 38 78
    i -11.166 128.031 0
    i 9.930 128.061 0.001 1 49 127
    i 8.774 128.124 0.001 1 49 127
    i 9.931 128.124 0.001 1 49 127
    i 9.932 128.187 0.001 1 49 127
    i 8.775 128.249 0.001 1 49 127
    i 9.933 128.249 0.001 1 49 127
    i 9.934 128.312 0.001 1 49 127
    i 8.776 128.375 0.001 1 49 127
    i 9.935 128.375 0.001 1 49 127
    i 9.936 128.437 0.001 1 49 127
    i 8.777 128.500 0.001 1 49 127
    i 4.096 128.500 0.001 1 37 127
    i 7.092 128.500 0.001 1 39 127
    i 9.937 128.500 0.001 1 49 127
    i 9.938 128.561 0.001 1 49 127
    i 9.939 128.624 0.001 1 49 127
    i 8.778 128.624 0.001 1 49 127
    i 9.940 128.687 0.001 1 49 127
    i 8.779 128.749 0.001 1 49 127
    i 9.941 128.749 0.001 1 49 127
    i 11.168 128.760 -1.000 1 36 86
    i -11.167 128.768 0
    i 9.942 128.812 0.001 1 49 127
    i 8.780 128.875 0.001 1 49 127
    i 9.943 128.875 0.001 1 49 127
    i 9.944 128.937 0.001 1 49 127
    i 8.781 129.000 0.001 1 49 127
    i 9.945 129.000 0.001 1 49 127
    i 10.129 129.000 -1.000 1 72 127
    i 10.130 129.000 -1.000 1 76 127
    i 4.097 129.000 0.001 1 37 127
    i 9.946 129.061 0.001 1 49 127
    i 8.782 129.124 0.001 1 49 127
    i 9.947 129.124 0.001 1 49 127
    i 9.948 129.187 0.001 1 49 127
    i 8.783 129.249 0.001 1 49 127
    i 9.949 129.249 0.001 1 49 127
    i -11.168 129.257 0
    i 11.169 129.259 -1.000 1 33 74
    i 9.950 129.312 0.001 1 49 127
    i 8.784 129.375 0.001 1 49 127
    i 9.951 129.375 0.001 1 49 127
    i 9.952 129.437 0.001 1 49 127
    i 9.953 129.500 0.001 1 49 127
    i 4.098 129.500 0.001 1 37 127
    i 7.093 129.500 0.001 1 39 127
    i 8.785 129.500 0.001 1 49 127
    i 11.170 129.508 -1.000 1 36 91
    i -11.169 129.517 0
    i 9.954 129.561 0.001 1 49 127
    i 9.955 129.624 0.001 1 49 127
    i 8.786 129.624 0.001 1 49 127
    i 9.956 129.687 0.001 1 49 127
    i 8.787 129.749 0.001 1 49 127
    i 5.067 129.749 0.001 1 37 127
    i 9.957 129.749 0.001 1 49 127
    i 6.067 129.749 0.001 1 37 127
    i 9.958 129.812 0.001 1 49 127
    i 8.788 129.875 0.001 1 49 113
    i 9.959 129.875 0.001 1 49 127
    i 9.960 129.937 0.001 1 49 127
    i 6.068 130.000 0.001 1 37 127
    i 4.099 130.000 0.001 1 37 127
    i -11.170 130.000 0
    i 5.068 130.000 0.001 1 37 127
    i 8.789 130.000 0.001 1 49 127
    i 11.171 130.000 -1.000 1 38 81
    i -10.129 130.000 0
    i -10.130 130.000 0
    i 9.961 130.000 0.001 1 49 127
    i 9.962 130.061 0.001 1 49 127
    i 8.790 130.124 0.001 1 49 127
    i 9.963 130.124 0.001 1 49 127
    i 9.964 130.187 0.001 1 49 127
    i 8.791 130.249 0.001 1 49 127
    i 9.965 130.249 0.001 1 49 127
    i 9.966 130.312 0.001 1 49 127
    i 8.792 130.375 0.001 1 49 127
    i 9.967 130.375 0.001 1 49 127
    i 9.968 130.437 0.001 1 49 127
    i 4.100 130.500 0.001 1 37 127
    i 8.793 130.500 0.001 1 49 127
    i 7.094 130.500 0.001 1 39 127
    i 9.969 130.500 0.001 1 49 127
    i 9.970 130.561 0.001 1 49 127
    i 9.971 130.624 0.001 1 49 127
    i 8.794 130.624 0.001 1 49 127
    i 9.972 130.687 0.001 1 49 127
    i 11.172 130.737 -1.000 1 41 89
    i -11.171 130.744 0
    i 8.795 130.749 0.001 1 49 127
    i 9.973 130.749 0.001 1 49 127
    i 9.974 130.812 0.001 1 49 127
    i 8.796 130.875 0.001 1 49 127
    i 9.975 130.875 0.001 1 49 127
    i 9.976 130.937 0.001 1 49 127
    i 10.131 131.000 -1.000 1 72 127
    i 9.977 131.000 0.001 1 49 127
    i 8.797 131.000 0.001 1 49 127
    i 4.101 131.000 0.001 1 37 127
    i 10.132 131.000 -1.000 1 76 127
    i 9.978 131.061 0.001 1 49 127
    i 8.798 131.124 0.001 1 49 127
    i 9.979 131.124 0.001 1 49 127
    i 9.980 131.187 0.001 1 49 127
    i 9.981 131.249 0.001 1 49 127
    i 8.799 131.249 0.001 1 49 127
    i 11.173 131.255 -1.000 1 38 68
    i -11.172 131.260 0
    i 9.982 131.312 0.001 1 49 127
    i 8.800 131.375 0.001 1 49 127
    i 9.983 131.375 0.001 1 49 127
    i 9.984 131.437 0.001 1 49 127
    i 11.174 131.501 -1.000 1 41 78
    i 8.801 131.500 0.001 1 49 127
    i 7.095 131.500 0.001 1 39 127
    i 4.102 131.500 0.001 1 37 127
    i 9.985 131.500 0.001 1 49 127
    i -11.173 131.509 0
    i 9.986 131.561 0.001 1 49 127
    i 9.987 131.624 0.001 1 49 127
    i 8.802 131.624 0.001 1 49 127
    i 9.988 131.687 0.001 1 49 127
    i 5.069 131.749 0.001 1 37 127
    i 9.989 131.749 0.001 1 49 127
    i 8.803 131.749 0.001 1 49 127
    i 6.069 131.749 0.001 1 37 127
    i 9.990 131.812 0.001 1 49 127
    i 8.804 131.875 0.001 1 49 113
    i 9.991 131.875 0.001 1 49 127
    i 9.992 131.937 0.001 1 49 127
    i 8.805 132.000 0.001 1 49 127
    i 9.993 132.000 0.001 1 49 127
    i -10.131 131.999 0
    i -10.132 131.999 0
    i 5.070 132.000 0.001 1 37 127
    i 4.103 132.000 0.001 1 37 127
    i 6.070 132.000 0.001 1 37 127
    i 11.175 132.012 -1.000 1 38 78
    i -11.174 132.031 0
    i 9.994 132.061 0.001 1 49 127
    i 9.995 132.124 0.001 1 49 127
    i 8.806 132.124 0.001 1 49 127
    i 9.996 132.187 0.001 1 49 127
    i 8.807 132.249 0.001 1 49 127
    i 9.997 132.249 0.001 1 49 127
    i 9.998 132.312 0.001 1 49 127
    i 8.808 132.375 0.001 1 49 127
    i 9.999 132.375 0.001 1 49 127
    i 9.001 132.437 0.001 1 49 127
    i 7.096 132.500 0.001 1 39 127
    i 8.809 132.500 0.001 1 49 127
    i 9.002 132.500 0.001 1 49 127
    i 4.104 132.500 0.001 1 37 127
    i 9.003 132.561 0.001 1 49 127
    i 8.810 132.624 0.001 1 49 127
    i 9.004 132.624 0.001 1 49 127
    i 9.005 132.687 0.001 1 49 127
    i 8.811 132.749 0.001 1 49 127
    i 9.006 132.749 0.001 1 49 127
    i 11.176 132.760 -1.000 1 36 86
    i -11.175 132.768 0
    i 9.007 132.812 0.001 1 49 127
    i 8.812 132.875 0.001 1 49 127
    i 9.008 132.875 0.001 1 49 127
    i 9.009 132.937 0.001 1 49 127
    i 4.105 133.000 0.001 1 37 127
    i 9.010 133.000 0.001 1 49 127
    i 10.133 133.000 -1.000 1 72 127
    i 10.134 133.000 -1.000 1 76 127
    i 8.813 133.000 0.001 1 49 127
    i 9.011 133.061 0.001 1 49 127
    i 8.814 133.124 0.001 1 49 127
    i 9.012 133.124 0.001 1 49 127
    i 9.013 133.187 0.001 1 49 127
    i 9.014 133.249 0.001 1 49 127
    i 8.815 133.249 0.001 1 49 127
    i -11.176 133.257 0
    i 11.177 133.259 -1.000 1 33 74
    i 9.015 133.312 0.001 1 49 127
    i 9.016 133.375 0.001 1 49 127
    i 8.816 133.375 0.001 1 49 127
    i 9.017 133.437 0.001 1 49 127
    i 4.106 133.500 0.001 1 37 127
    i 7.097 133.500 0.001 1 39 127
    i 8.817 133.500 0.001 1 49 127
    i 9.018 133.500 0.001 1 49 127
    i 11.178 133.508 -1.000 1 36 91
    i -11.177 133.517 0
    i 9.019 133.561 0.001 1 49 127
    i 8.818 133.624 0.001 1 49 127
    i 9.020 133.624 0.001 1 49 127
    i 9.021 133.687 0.001 1 49 127
    i 9.022 133.749 0.001 1 49 127
    i 5.071 133.749 0.001 1 37 127
    i 6.071 133.749 0.001 1 37 127
    i 8.819 133.749 0.001 1 49 127
    i 9.023 133.812 0.001 1 49 127
    i 8.820 133.875 0.001 1 49 113
    i 9.024 133.875 0.001 1 49 127
    i 9.025 133.937 0.001 1 49 127
    i -11.178 134.000 0
    i 11.179 134.000 -1.000 1 38 81
    i 4.107 134.000 0.001 1 37 127
    i 5.072 134.000 0.001 1 37 127
    i 6.072 134.000 0.001 1 37 127
    i 9.026 134.000 0.001 1 49 127
    i 8.821 134.000 0.001 1 49 127
    i -10.133 134.000 0
    i -10.134 134.000 0
    i 9.027 134.061 0.001 1 49 127
    i 9.028 134.124 0.001 1 49 127
    i 8.822 134.124 0.001 1 49 127
    i 9.029 134.187 0.001 1 49 127
    i 9.030 134.249 0.001 1 49 127
    i 8.823 134.249 0.001 1 49 127
    i 9.031 134.312 0.001 1 49 127
    i 9.032 134.375 0.001 1 49 127
    i 8.824 134.375 0.001 1 49 127
    i 9.033 134.437 0.001 1 49 127
    i 4.108 134.500 0.001 1 37 127
    i 8.825 134.500 0.001 1 49 127
    i 7.098 134.500 0.001 1 39 127
    i 9.034 134.500 0.001 1 49 127
    i 9.035 134.561 0.001 1 49 127
    i 9.036 134.624 0.001 1 49 127
    i 8.826 134.624 0.001 1 49 127
    i 9.037 134.687 0.001 1 49 127
    i 11.180 134.737 -1.000 1 41 89
    i -11.179 134.744 0
    i 9.038 134.749 0.001 1 49 127
    i 8.827 134.749 0.001 1 49 127
    i 9.039 134.812 0.001 1 49 127
    i 8.828 134.875 0.001 1 49 127
    i 9.040 134.875 0.001 1 49 127
    i 9.041 134.937 0.001 1 49 127
    i 4.109 135.000 0.001 1 37 127
    i 10.135 135.000 -1.000 1 72 127
    i 8.829 135.000 0.001 1 49 127
    i 10.136 135.000 -1.000 1 76 127
    i 9.042 135.000 0.001 1 49 127
    i 9.043 135.061 0.001 1 49 127
    i 8.830 135.124 0.001 1 49 127
    i 9.044 135.124 0.001 1 49 127
    i 9.045 135.187 0.001 1 49 127
    i 8.831 135.249 0.001 1 49 127
    i 9.046 135.249 0.001 1 49 127
    i 11.181 135.255 -1.000 1 38 68
    i -11.180 135.260 0
    i 9.047 135.312 0.001 1 49 127
    i 8.832 135.375 0.001 1 49 127
    i 9.048 135.375 0.001 1 49 127
    i 9.049 135.437 0.001 1 49 127
    i 8.833 135.500 0.001 1 49 127
    i 9.050 135.500 0.001 1 49 127
    i 7.099 135.500 0.001 1 39 127
    i 11.182 135.501 -1.000 1 41 78
    i 4.110 135.500 0.001 1 37 127
    i -11.181 135.509 0
    i 9.051 135.561 0.001 1 49 127
    i 8.834 135.624 0.001 1 49 127
    i 9.052 135.624 0.001 1 49 127
    i 9.053 135.687 0.001 1 49 127
    i 5.073 135.749 0.001 1 37 127
    i 6.073 135.749 0.001 1 37 127
    i 8.835 135.749 0.001 1 49 127
    i 9.054 135.749 0.001 1 49 127
    i 9.055 135.812 0.001 1 49 127
    i 9.056 135.875 0.001 1 49 127
    i 8.836 135.875 0.001 1 49 113
    i 9.057 135.937 0.001 1 49 127
    i 4.111 136.000 0.001 1 37 127
    i 9.058 136.000 0.001 1 49 127
    i -10.135 135.999 0
    i 5.074 136.000 0.001 1 37 127
    i 6.074 136.000 0.001 1 37 127
    i 8.837 136.000 0.001 1 49 127
    i -10.136 135.999 0
    i 11.183 136.012 -1.000 1 38 78
    i -11.182 136.031 0
    i 9.059 136.061 0.001 1 49 127
    i 8.838 136.124 0.001 1 49 127
    i 9.060 136.124 0.001 1 49 127
    i 9.061 136.187 0.001 1 49 127
    i 9.062 136.249 0.001 1 49 127
    i 8.839 136.249 0.001 1 49 127
    i 9.063 136.312 0.001 1 49 127
    i 8.840 136.375 0.001 1 49 127
    i 9.064 136.375 0.001 1 49 127
    i 9.065 136.437 0.001 1 49 127
    i 9.066 136.500 0.001 1 49 127
    i 4.112 136.500 0.001 1 37 127
    i 7.100 136.500 0.001 1 39 127
    i 8.841 136.500 0.001 1 49 127
    i 9.067 136.561 0.001 1 49 127
    i 9.068 136.624 0.001 1 49 127
    i 8.842 136.624 0.001 1 49 127
    i 9.069 136.687 0.001 1 49 127
    i 9.070 136.749 0.001 1 49 127
    i 8.843 136.749 0.001 1 49 127
    i 11.184 136.760 -1.000 1 36 86
    i -11.183 136.768 0
    i 9.071 136.812 0.001 1 49 127
    i 8.844 136.875 0.001 1 49 127
    i 9.072 136.875 0.001 1 49 127
    i 9.073 136.937 0.001 1 49 127
    i 10.137 137.000 -1.000 1 72 127
    i 8.845 137.000 0.001 1 49 127
    i 10.138 137.000 -1.000 1 76 127
    i 4.113 137.000 0.001 1 37 127
    i 9.074 137.000 0.001 1 49 127
    i 9.075 137.061 0.001 1 49 127
    i 8.846 137.124 0.001 1 49 127
    i 9.076 137.124 0.001 1 49 127
    i 9.077 137.187 0.001 1 49 127
    i 8.847 137.249 0.001 1 49 127
    i 9.078 137.249 0.001 1 49 127
    i -11.184 137.257 0
    i 11.185 137.259 -1.000 1 33 74
    i 9.079 137.312 0.001 1 49 127
    i 8.848 137.375 0.001 1 49 127
    i 9.080 137.375 0.001 1 49 127
    i 9.081 137.437 0.001 1 49 127
    i 4.114 137.500 0.001 1 37 127
    i 7.101 137.500 0.001 1 39 127
    i 8.849 137.500 0.001 1 49 127
    i 9.082 137.500 0.001 1 49 127
    i 11.186 137.508 -1.000 1 36 91
    i -11.185 137.517 0
    i 9.083 137.561 0.001 1 49 127
    i 8.850 137.624 0.001 1 49 127
    i 9.084 137.624 0.001 1 49 127
    i 9.085 137.687 0.001 1 49 127
    i 6.075 137.749 0.001 1 37 127
    i 9.086 137.749 0.001 1 49 127
    i 8.851 137.749 0.001 1 49 127
    i 5.075 137.749 0.001 1 37 127
    i 9.087 137.812 0.001 1 49 127
    i 8.852 137.875 0.001 1 49 113
    i 9.088 137.875 0.001 1 49 127
    i 9.089 137.937 0.001 1 49 127
    i -11.186 137.999 0
    i 4.115 138.000 0.001 1 37 127
    i -10.137 138.000 0
    i 8.853 138.000 0.001 1 49 127
    i 6.076 138.000 0.001 1 37 127
    i 9.090 138.000 0.001 1 49 127
    i -10.138 138.000 0
    i 5.076 138.000 0.001 1 37 127
    i 11.187 138.000 -1.000 1 38 83
    i 9.091 138.061 0.001 1 49 127
    i 8.854 138.124 0.001 1 49 127
    i 9.092 138.124 0.001 1 49 127
    i 9.093 138.187 0.001 1 49 127
    i 9.094 138.249 0.001 1 49 127
    i 8.855 138.249 0.001 1 49 127
    i 9.095 138.312 0.001 1 49 127
    i 9.096 138.375 0.001 1 49 127
    i 8.856 138.375 0.001 1 49 127
    i 9.097 138.437 0.001 1 49 127
    i 4.116 138.500 0.001 1 37 127
    i 9.098 138.500 0.001 1 49 127
    i 8.857 138.500 0.001 1 49 127
    i 7.102 138.500 0.001 1 39 127
    i 9.099 138.561 0.001 1 49 127
    i 9.100 138.624 0.001 1 49 127
    i 8.858 138.624 0.001 1 49 127
    i 9.101 138.687 0.001 1 49 127
    i 11.188 138.737 -1.000 1 41 103
    i 8.859 138.749 0.001 1 49 127
    i 9.102 138.749 0.001 1 49 127
    i -11.187 138.756 0
    i 9.103 138.812 0.001 1 49 127
    i 8.860 138.875 0.001 1 49 127
    i 9.104 138.875 0.001 1 49 127
    i 9.105 138.937 0.001 1 49 127
    i 8.861 139.000 0.001 1 49 127
    i 4.117 139.000 0.001 1 37 127
    i 9.106 139.000 0.001 1 49 127
    i 10.139 139.000 -1.000 1 72 127
    i 10.140 139.000 -1.000 1 76 127
    i 9.107 139.061 0.001 1 49 127
    i 9.108 139.124 0.001 1 49 127
    i 8.862 139.124 0.001 1 49 127
    i 9.109 139.187 0.001 1 49 127
    i 11.189 139.223 -1.000 1 44 76
    i -11.188 139.235 0
    i 9.110 139.249 0.001 1 49 127
    i 8.863 139.249 0.001 1 49 127
    i 9.111 139.312 0.001 1 49 127
    i 8.864 139.375 0.001 1 49 127
    i 9.112 139.375 0.001 1 49 127
    i 9.113 139.437 0.001 1 49 127
    i 7.103 139.500 0.001 1 39 127
    i 4.118 139.500 0.001 1 37 127
    i 8.865 139.500 0.001 1 49 127
    i 9.114 139.500 0.001 1 49 127
    i -11.189 139.523 0
    i 11.190 139.523 -1.000 1 43 89
    i 9.115 139.561 0.001 1 49 127
    i 8.866 139.624 0.001 1 49 127
    i 9.116 139.624 0.001 1 49 127
    i 9.117 139.687 0.001 1 49 127
    i 5.077 139.749 0.001 1 37 127
    i 6.077 139.749 0.001 1 37 127
    i 8.867 139.749 0.001 1 49 127
    i 9.118 139.749 0.001 1 49 127
    i 9.119 139.812 0.001 1 49 127
    i 8.868 139.875 0.001 1 49 113
    i 9.120 139.875 0.001 1 49 127
    i 9.121 139.937 0.001 1 49 127
    i 6.078 140.000 0.001 1 37 127
    i 5.078 140.000 0.001 1 37 127
    i -10.139 139.999 0
    i -11.190 139.997 0
    i 9.122 140.000 0.001 1 49 127
    i 8.869 140.000 0.001 1 49 127
    i 4.119 140.000 0.001 1 37 127
    i -10.140 139.999 0
    i 11.191 139.997 -1.000 1 41 97
    i 9.123 140.061 0.001 1 49 127
    i 9.124 140.124 0.001 1 49 127
    i 8.870 140.124 0.001 1 49 127
    i 9.125 140.187 0.001 1 49 127
    i 9.126 140.249 0.001 1 49 127
    i 8.871 140.249 0.001 1 49 127
    i 9.127 140.312 0.001 1 49 127
    i 8.872 140.375 0.001 1 49 127
    i 9.128 140.375 0.001 1 49 127
    i 9.129 140.437 0.001 1 49 127
    i 7.104 140.500 0.001 1 39 127
    i 4.120 140.500 0.001 1 37 127
    i 9.130 140.500 0.001 1 49 127
    i 8.873 140.500 0.001 1 49 127
    i 9.131 140.561 0.001 1 49 127
    i 8.874 140.624 0.001 1 49 127
    i 9.132 140.624 0.001 1 49 127
    i 9.133 140.687 0.001 1 49 127
    i 8.875 140.749 0.001 1 49 127
    i 9.134 140.749 0.001 1 49 127
    i -11.191 140.756 0
    i 11.192 140.759 -1.000 1 38 80
    i 9.135 140.812 0.001 1 49 127
    i 8.876 140.875 0.001 1 49 127
    i 9.136 140.875 0.001 1 49 127
    i 9.137 140.937 0.001 1 49 127
    i 4.121 141.000 0.001 1 37 127
    i 9.138 141.000 0.001 1 49 127
    i 10.141 141.000 -1.000 1 72 127
    i 8.877 141.000 0.001 1 49 127
    i 10.142 141.000 -1.000 1 76 127
    i 9.139 141.061 0.001 1 49 127
    i 8.878 141.124 0.001 1 49 127
    i 9.140 141.124 0.001 1 49 127
    i 9.141 141.187 0.001 1 49 127
    i 11.193 141.205 -1.000 1 33 79
    i -11.192 141.229 0
    i 8.879 141.249 0.001 1 49 127
    i 9.142 141.249 0.001 1 49 127
    i 9.143 141.312 0.001 1 49 127
    i 8.880 141.375 0.001 1 49 127
    i 9.144 141.375 0.001 1 49 127
    i 9.145 141.437 0.001 1 49 127
    i 8.881 141.500 0.001 1 49 127
    i 7.105 141.500 0.001 1 39 127
    i 9.146 141.500 0.001 1 49 127
    i 4.122 141.500 0.001 1 37 127
    i 11.194 141.507 -1.000 1 36 89
    i -11.193 141.508 0
    i 9.147 141.561 0.001 1 49 127
    i 8.882 141.624 0.001 1 49 127
    i 9.148 141.624 0.001 1 49 127
    i 9.149 141.687 0.001 1 49 127
    i 5.079 141.749 0.001 1 37 127
    i 8.883 141.749 0.001 1 49 127
    i 9.150 141.749 0.001 1 49 127
    i 6.079 141.749 0.001 1 37 127
    i 9.151 141.812 0.001 1 49 127
    i 8.884 141.875 0.001 1 49 113
    i 9.152 141.875 0.001 1 49 127
    i 9.153 141.937 0.001 1 49 127
    i 4.123 142.000 0.001 1 37 127
    i 5.080 142.000 0.001 1 37 127
    i 6.080 142.000 0.001 1 37 127
    i 8.885 142.000 0.001 1 49 127
    i 9.154 142.000 0.001 1 49 127
    i -10.141 142.000 0
    i -10.142 142.000 0
    i -11.194 141.999 0
    i 11.195 142.000 -1.000 1 38 81
    i 9.155 142.061 0.001 1 49 127
    i 8.886 142.124 0.001 1 49 127
    i 9.156 142.124 0.001 1 49 127
    i 9.157 142.187 0.001 1 49 127
    i 8.887 142.249 0.001 1 49 127
    i 9.158 142.249 0.001 1 49 127
    i 9.159 142.312 0.001 1 49 127
    i 8.888 142.375 0.001 1 49 127
    i 9.160 142.375 0.001 1 49 127
    i 9.161 142.437 0.001 1 49 127
    i 4.124 142.500 0.001 1 37 127
    i 7.106 142.500 0.001 1 39 127
    i 8.889 142.500 0.001 1 49 127
    i 9.162 142.500 0.001 1 49 127
    i 9.163 142.561 0.001 1 49 127
    i 9.164 142.624 0.001 1 49 127
    i 8.890 142.624 0.001 1 49 127
    i 9.165 142.687 0.001 1 49 127
    i 11.196 142.737 -1.000 1 41 89
    i -11.195 142.744 0
    i 9.166 142.749 0.001 1 49 127
    i 8.891 142.749 0.001 1 49 127
    i 9.167 142.812 0.001 1 49 127
    i 9.168 142.875 0.001 1 49 127
    i 8.892 142.875 0.001 1 49 127
    i 9.169 142.937 0.001 1 49 127
    i 4.125 143.000 0.001 1 37 127
    i 8.893 143.000 0.001 1 49 127
    i 9.170 143.000 0.001 1 49 127
    i 10.143 143.000 -1.000 1 72 127
    i 10.144 143.000 -1.000 1 76 127
    i 9.171 143.061 0.001 1 49 127
    i 8.894 143.124 0.001 1 49 127
    i 9.172 143.124 0.001 1 49 127
    i 9.173 143.187 0.001 1 49 127
    i 8.895 143.249 0.001 1 49 127
    i 9.174 143.249 0.001 1 49 127
    i 11.197 143.255 -1.000 1 38 68
    i -11.196 143.260 0
    i 9.175 143.312 0.001 1 49 127
    i 8.896 143.375 0.001 1 49 127
    i 9.176 143.375 0.001 1 49 127
    i 9.177 143.437 0.001 1 49 127
    i 4.126 143.500 0.001 1 37 127
    i 7.107 143.500 0.001 1 39 127
    i 8.897 143.500 0.001 1 49 127
    i 11.198 143.501 -1.000 1 41 78
    i 9.178 143.500 0.001 1 49 127
    i -11.197 143.509 0
    i 9.179 143.561 0.001 1 49 127
    i 9.180 143.624 0.001 1 49 127
    i 8.898 143.624 0.001 1 49 127
    i 9.181 143.687 0.001 1 49 127
    i 5.081 143.749 0.001 1 37 127
    i 6.081 143.749 0.001 1 37 127
    i 8.899 143.749 0.001 1 49 127
    i 9.182 143.749 0.001 1 49 127
    i 9.183 143.812 0.001 1 49 127
    i 8.900 143.875 0.001 1 49 113
    i 9.184 143.875 0.001 1 49 127
    i 9.185 143.937 0.001 1 49 127
    i 4.127 144.000 0.001 1 37 127
    i 5.082 144.000 0.001 1 37 127
    i 6.082 144.000 0.001 1 37 127
    i 9.186 144.000 0.001 1 49 127
    i 8.901 144.000 0.001 1 49 127
    i -10.143 143.999 0
    i -10.144 143.999 0
    i 11.199 144.012 -1.000 1 38 78
    i -11.198 144.031 0
    i 9.187 144.061 0.001 1 49 127
    i 8.902 144.124 0.001 1 49 127
    i 9.188 144.124 0.001 1 49 127
    i 9.189 144.187 0.001 1 49 127
    i 8.903 144.249 0.001 1 49 127
    i 9.190 144.249 0.001 1 49 127
    i 9.191 144.312 0.001 1 49 127
    i 9.192 144.375 0.001 1 49 127
    i 8.904 144.375 0.001 1 49 127
    i 9.193 144.437 0.001 1 49 127
    i 7.108 144.500 0.001 1 39 127
    i 4.128 144.500 0.001 1 37 127
    i 8.905 144.500 0.001 1 49 127
    i 9.194 144.500 0.001 1 49 127
    i 9.195 144.561 0.001 1 49 127
    i 9.196 144.624 0.001 1 49 127
    i 8.906 144.624 0.001 1 49 127
    i 9.197 144.687 0.001 1 49 127
    i 8.907 144.749 0.001 1 49 127
    i 9.198 144.749 0.001 1 49 127
    i 11.200 144.760 -1.000 1 36 86
    i -11.199 144.768 0
    i 9.199 144.812 0.001 1 49 127
    i 8.908 144.875 0.001 1 49 127
    i 9.200 144.875 0.001 1 49 127
    i 9.201 144.937 0.001 1 49 127
    i 4.129 145.000 0.001 1 37 127
    i 9.202 145.000 0.001 1 49 127
    i 8.909 145.000 0.001 1 49 127
    i 10.145 145.000 -1.000 1 72 127
    i 10.146 145.000 -1.000 1 76 127
    i 9.203 145.061 0.001 1 49 127
    i 9.204 145.124 0.001 1 49 127
    i 8.910 145.124 0.001 1 49 127
    i 9.205 145.187 0.001 1 49 127
    i 8.911 145.249 0.001 1 49 127
    i 9.206 145.249 0.001 1 49 127
    i -11.200 145.257 0
    i 11.201 145.259 -1.000 1 33 74
    i 9.207 145.312 0.001 1 49 127
    i 8.912 145.375 0.001 1 49 127
    i 9.208 145.375 0.001 1 49 127
    i 9.209 145.437 0.001 1 49 127
    i 8.913 145.500 0.001 1 49 127
    i 4.130 145.500 0.001 1 37 127
    i 9.210 145.500 0.001 1 49 127
    i 7.109 145.500 0.001 1 39 127
    i 11.202 145.508 -1.000 1 36 91
    i -11.201 145.517 0
    i 9.211 145.561 0.001 1 49 127
    i 8.914 145.624 0.001 1 49 127
    i 9.212 145.624 0.001 1 49 127
    i 9.213 145.687 0.001 1 49 127
    i 6.083 145.749 0.001 1 37 127
    i 9.214 145.749 0.001 1 49 127
    i 8.915 145.749 0.001 1 49 127
    i 5.083 145.749 0.001 1 37 127
    i 9.215 145.812 0.001 1 49 127
    i 9.216 145.875 0.001 1 49 127
    i 8.916 145.875 0.001 1 49 113
    i 9.217 145.937 0.001 1 49 127
    i 6.084 146.000 0.001 1 37 127
    i -11.202 146.000 0
    i 8.917 146.000 0.001 1 49 127
    i 4.131 146.000 0.001 1 37 127
    i 5.084 146.000 0.001 1 37 127
    i 9.218 146.000 0.001 1 49 127
    i 11.203 146.000 -1.000 1 38 81
    i -10.145 146.000 0
    i -10.146 146.000 0
    i 9.219 146.061 0.001 1 49 127
    i 8.918 146.124 0.001 1 49 127
    i 9.220 146.124 0.001 1 49 127
    i 9.221 146.187 0.001 1 49 127
    i 8.919 146.249 0.001 1 49 127
    i 9.222 146.249 0.001 1 49 127
    i 9.223 146.312 0.001 1 49 127
    i 8.920 146.375 0.001 1 49 127
    i 9.224 146.375 0.001 1 49 127
    i 9.225 146.437 0.001 1 49 127
    i 8.921 146.500 0.001 1 49 127
    i 7.110 146.500 0.001 1 39 127
    i 9.226 146.500 0.001 1 49 127
    i 4.132 146.500 0.001 1 37 127
    i 9.227 146.561 0.001 1 49 127
    i 8.922 146.624 0.001 1 49 127
    i 9.228 146.624 0.001 1 49 127
    i 9.229 146.687 0.001 1 49 127
    i 11.204 146.737 -1.000 1 41 89
    i -11.203 146.744 0
    i 8.923 146.749 0.001 1 49 127
    i 9.230 146.749 0.001 1 49 127
    i 9.231 146.812 0.001 1 49 127
    i 9.232 146.875 0.001 1 49 127
    i 8.924 146.875 0.001 1 49 127
    i 9.233 146.937 0.001 1 49 127
    i 9.234 147.000 0.001 1 49 127
    i 8.925 147.000 0.001 1 49 127
    i 4.133 147.000 0.001 1 37 127
    i 10.147 147.000 -1.000 1 72 127
    i 10.148 147.000 -1.000 1 76 127
    i 9.235 147.061 0.001 1 49 127
    i 9.236 147.124 0.001 1 49 127
    i 8.926 147.124 0.001 1 49 127
    i 9.237 147.187 0.001 1 49 127
    i 8.927 147.249 0.001 1 49 127
    i 9.238 147.249 0.001 1 49 127
    i 11.205 147.255 -1.000 1 38 68
    i -11.204 147.260 0
    i 9.239 147.312 0.001 1 49 127
    i 8.928 147.375 0.001 1 49 127
    i 9.240 147.375 0.001 1 49 127
    i 9.241 147.437 0.001 1 49 127
    i 4.134 147.500 0.001 1 37 127
    i 7.111 147.500 0.001 1 39 127
    i 8.929 147.500 0.001 1 49 127
    i 9.242 147.500 0.001 1 49 127
    i 11.206 147.501 -1.000 1 41 78
    i -11.205 147.509 0
    i 9.243 147.561 0.001 1 49 127
    i 8.930 147.624 0.001 1 49 127
    i 9.244 147.624 0.001 1 49 127
    i 9.245 147.687 0.001 1 49 127
    i 5.085 147.749 0.001 1 37 127
    i 8.931 147.749 0.001 1 49 127
    i 6.085 147.749 0.001 1 37 127
    i 9.246 147.749 0.001 1 49 127
    i 9.247 147.812 0.001 1 49 127
    i 8.932 147.875 0.001 1 49 113
    i 9.248 147.875 0.001 1 49 127
    i 9.249 147.937 0.001 1 49 127
    i 4.135 148.000 0.001 1 37 127
    i 5.086 148.000 0.001 1 37 127
    i 6.086 148.000 0.001 1 37 127
    i 9.250 148.000 0.001 1 49 127
    i 8.933 148.000 0.001 1 49 127
    i -10.147 147.999 0
    i -10.148 147.999 0
    i 11.207 148.012 -1.000 1 38 78
    i -11.206 148.031 0
    i 9.251 148.061 0.001 1 49 127
    i 8.934 148.124 0.001 1 49 127
    i 9.252 148.124 0.001 1 49 127
    i 9.253 148.187 0.001 1 49 127
    i 8.935 148.249 0.001 1 49 127
    i 9.254 148.249 0.001 1 49 127
    i 9.255 148.312 0.001 1 49 127
    i 9.256 148.375 0.001 1 49 127
    i 8.936 148.375 0.001 1 49 127
    i 9.257 148.437 0.001 1 49 127
    i 7.112 148.500 0.001 1 39 127
    i 8.937 148.500 0.001 1 49 127
    i 4.136 148.500 0.001 1 37 127
    i 9.258 148.500 0.001 1 49 127
    i 9.259 148.561 0.001 1 49 127
    i 8.938 148.624 0.001 1 49 127
    i 9.260 148.624 0.001 1 49 127
    i 9.261 148.687 0.001 1 49 127
    i 8.939 148.749 0.001 1 49 127
    i 9.262 148.749 0.001 1 49 127
    i 11.208 148.760 -1.000 1 36 86
    i -11.207 148.768 0
    i 9.263 148.812 0.001 1 49 127
    i 9.264 148.875 0.001 1 49 127
    i 8.940 148.875 0.001 1 49 127
    i 9.265 148.937 0.001 1 49 127
    i 4.137 149.000 0.001 1 37 127
    i 9.266 149.000 0.001 1 49 127
    i 10.149 149.000 -1.000 1 72 127
    i 8.941 149.000 0.001 1 49 127
    i 10.150 149.000 -1.000 1 76 127
    i 9.267 149.061 0.001 1 49 127
    i 9.268 149.124 0.001 1 49 127
    i 8.942 149.124 0.001 1 49 127
    i 9.269 149.187 0.001 1 49 127
    i 9.270 149.249 0.001 1 49 127
    i 8.943 149.249 0.001 1 49 127
    i -11.208 149.257 0
    i 11.209 149.259 -1.000 1 33 74
    i 9.271 149.312 0.001 1 49 127
    i 8.944 149.375 0.001 1 49 127
    i 9.272 149.375 0.001 1 49 127
    i 9.273 149.437 0.001 1 49 127
    i 4.138 149.500 0.001 1 37 127
    i 8.945 149.500 0.001 1 49 127
    i 9.274 149.500 0.001 1 49 127
    i 7.113 149.500 0.001 1 39 127
    i 11.210 149.508 -1.000 1 36 91
    i -11.209 149.517 0
    i 9.275 149.561 0.001 1 49 127
    i 8.946 149.624 0.001 1 49 127
    i 9.276 149.624 0.001 1 49 127
    i 9.277 149.687 0.001 1 49 127
    i 5.087 149.749 0.001 1 37 127
    i 6.087 149.749 0.001 1 37 127
    i 9.278 149.749 0.001 1 49 127
    i 8.947 149.749 0.001 1 49 127
    i 9.279 149.812 0.001 1 49 127
    i 8.948 149.875 0.001 1 49 113
    i 9.280 149.875 0.001 1 49 127
    i 9.281 149.937 0.001 1 49 127
    i 6.088 150.000 0.001 1 37 127
    i -10.149 150.000 0
    i 4.139 150.000 0.001 1 37 127
    i -11.210 150.000 0
    i 5.088 150.000 0.001 1 37 127
    i 9.282 150.000 0.001 1 49 127
    i 8.949 150.000 0.001 1 49 127
    i -10.150 150.000 0
    i 11.211 150.000 -1.000 1 38 81
    i 9.283 150.061 0.001 1 49 127
    i 8.950 150.124 0.001 1 49 127
    i 9.284 150.124 0.001 1 49 127
    i 9.285 150.187 0.001 1 49 127
    i 8.951 150.249 0.001 1 49 127
    i 9.286 150.249 0.001 1 49 127
    i 9.287 150.312 0.001 1 49 127
    i 8.952 150.375 0.001 1 49 127
    i 9.288 150.375 0.001 1 49 127
    i 9.289 150.437 0.001 1 49 127
    i 7.114 150.500 0.001 1 39 127
    i 8.953 150.500 0.001 1 49 127
    i 9.290 150.500 0.001 1 49 127
    i 4.140 150.500 0.001 1 37 127
    i 9.291 150.561 0.001 1 49 127
    i 8.954 150.624 0.001 1 49 127
    i 9.292 150.624 0.001 1 49 127
    i 9.293 150.687 0.001 1 49 127
    i 11.212 150.737 -1.000 1 41 89
    i -11.211 150.744 0
    i 8.955 150.749 0.001 1 49 127
    i 9.294 150.749 0.001 1 49 127
    i 9.295 150.812 0.001 1 49 127
    i 8.956 150.875 0.001 1 49 127
    i 9.296 150.875 0.001 1 49 127
    i 9.297 150.937 0.001 1 49 127
    i 8.957 151.000 0.001 1 49 127
    i 9.298 151.000 0.001 1 49 127
    i 4.141 151.000 0.001 1 37 127
    i 10.151 151.000 -1.000 1 72 127
    i 10.152 151.000 -1.000 1 76 127
    i 9.299 151.061 0.001 1 49 127
    i 9.300 151.124 0.001 1 49 127
    i 8.958 151.124 0.001 1 49 127
    i 9.301 151.187 0.001 1 49 127
    i 8.959 151.249 0.001 1 49 127
    i 9.302 151.249 0.001 1 49 127
    i 11.213 151.255 -1.000 1 38 68
    i -11.212 151.260 0
    i 9.303 151.312 0.001 1 49 127
    i 9.304 151.375 0.001 1 49 127
    i 8.960 151.375 0.001 1 49 127
    i 9.305 151.437 0.001 1 49 127
    i 8.961 151.500 0.001 1 49 127
    i 11.214 151.501 -1.000 1 41 78
    i 4.142 151.500 0.001 1 37 127
    i 9.306 151.500 0.001 1 49 127
    i 7.115 151.500 0.001 1 39 127
    i -11.213 151.509 0
    i 9.307 151.561 0.001 1 49 127
    i 8.962 151.624 0.001 1 49 127
    i 9.308 151.624 0.001 1 49 127
    i 9.309 151.687 0.001 1 49 127
    i 6.089 151.749 0.001 1 37 127
    i 9.310 151.749 0.001 1 49 127
    i 5.089 151.749 0.001 1 37 127
    i 8.963 151.749 0.001 1 49 127
    i 9.311 151.812 0.001 1 49 127
    i 8.964 151.875 0.001 1 49 113
    i 9.312 151.875 0.001 1 49 127
    i 9.313 151.937 0.001 1 49 127
    i 8.965 152.000 0.001 1 49 127
    i 4.143 152.000 0.001 1 37 127
    i 9.314 152.000 0.001 1 49 127
    i 6.090 152.000 0.001 1 37 127
    i -10.151 151.999 0
    i 5.090 152.000 0.001 1 37 127
    i -10.152 151.999 0
    i 11.215 152.012 -1.000 1 38 78
    i -11.214 152.031 0
    i 9.315 152.061 0.001 1 49 127
    i 8.966 152.124 0.001 1 49 127
    i 9.316 152.124 0.001 1 49 127
    i 9.317 152.187 0.001 1 49 127
    i 8.967 152.249 0.001 1 49 127
    i 9.318 152.249 0.001 1 49 127
    i 9.319 152.312 0.001 1 49 127
    i 8.968 152.375 0.001 1 49 127
    i 9.320 152.375 0.001 1 49 127
    i 9.321 152.437 0.001 1 49 127
    i 8.969 152.500 0.001 1 49 127
    i 7.116 152.500 0.001 1 39 127
    i 4.144 152.500 0.001 1 37 127
    i 9.322 152.500 0.001 1 49 127
    i 9.323 152.561 0.001 1 49 127
    i 8.970 152.624 0.001 1 49 127
    i 9.324 152.624 0.001 1 49 127
    i 9.325 152.687 0.001 1 49 127
    i 8.971 152.749 0.001 1 49 127
    i 9.326 152.749 0.001 1 49 127
    i 11.216 152.760 -1.000 1 36 86
    i -11.215 152.768 0
    i 9.327 152.812 0.001 1 49 127
    i 9.328 152.875 0.001 1 49 127
    i 8.972 152.875 0.001 1 49 127
    i 9.329 152.937 0.001 1 49 127
    i 4.145 153.000 0.001 1 37 127
    i 8.973 153.000 0.001 1 49 127
    i 9.330 153.000 0.001 1 49 127
    i 10.153 153.000 -1.000 1 72 127
    i 10.154 153.000 -1.000 1 76 127
    i 9.331 153.061 0.001 1 49 127
    i 9.332 153.124 0.001 1 49 127
    i 8.974 153.124 0.001 1 49 127
    i 9.333 153.187 0.001 1 49 127
    i 9.334 153.249 0.001 1 49 127
    i 8.975 153.249 0.001 1 49 127
    i -11.216 153.257 0
    i 11.217 153.259 -1.000 1 33 74
    i 9.335 153.312 0.001 1 49 127
    i 8.976 153.375 0.001 1 49 127
    i 9.336 153.375 0.001 1 49 127
    i 9.337 153.437 0.001 1 49 127
    i 4.146 153.500 0.001 1 37 127
    i 7.117 153.500 0.001 1 39 127
    i 8.977 153.500 0.001 1 49 127
    i 9.338 153.500 0.001 1 49 127
    i 11.218 153.508 -1.000 1 36 91
    i -11.217 153.517 0
    i 9.339 153.561 0.001 1 49 127
    i 8.978 153.624 0.001 1 49 127
    i 9.340 153.624 0.001 1 49 127
    i 9.341 153.687 0.001 1 49 127
    i 6.091 153.749 0.001 1 37 127
    i 5.091 153.749 0.001 1 37 127
    i 8.979 153.749 0.001 1 49 127
    i 9.342 153.749 0.001 1 49 127
    i 9.343 153.812 0.001 1 49 127
    i 8.980 153.875 0.001 1 49 113
    i 9.344 153.875 0.001 1 49 127
    i 9.345 153.937 0.001 1 49 127
    i 8.981 154.000 0.001 1 49 127
    i 4.147 154.000 0.001 1 37 127
    i -10.153 154.000 0
    i 6.092 154.000 0.001 1 37 127
    i 9.346 154.000 0.001 1 49 127
    i 5.092 154.000 0.001 1 37 127
    i -11.218 153.999 0
    i -10.154 154.000 0
    i 11.219 154.000 -1.000 1 38 83
    i 9.347 154.061 0.001 1 49 127
    i 8.982 154.124 0.001 1 49 127
    i 9.348 154.124 0.001 1 49 127
    i 9.349 154.187 0.001 1 49 127
    i 9.350 154.249 0.001 1 49 127
    i 8.983 154.249 0.001 1 49 127
    i 9.351 154.312 0.001 1 49 127
    i 8.984 154.375 0.001 1 49 127
    i 9.352 154.375 0.001 1 49 127
    i 9.353 154.437 0.001 1 49 127
    i 8.985 154.500 0.001 1 49 127
    i 9.354 154.500 0.001 1 49 127
    i 4.148 154.500 0.001 1 37 127
    i 7.118 154.500 0.001 1 39 127
    i 9.355 154.561 0.001 1 49 127
    i 9.356 154.624 0.001 1 49 127
    i 8.986 154.624 0.001 1 49 127
    i 9.357 154.687 0.001 1 49 127
    i 11.220 154.737 -1.000 1 41 103
    i -11.219 154.756 0
    i 9.358 154.749 0.001 1 49 127
    i 8.987 154.749 0.001 1 49 127
    i 9.359 154.812 0.001 1 49 127
    i 8.988 154.875 0.001 1 49 127
    i 9.360 154.875 0.001 1 49 127
    i 9.361 154.937 0.001 1 49 127
    i 4.149 155.000 0.001 1 37 127
    i 8.989 155.000 0.001 1 49 127
    i 9.362 155.000 0.001 1 49 127
    i 10.155 155.000 -1.000 1 72 127
    i 10.156 155.000 -1.000 1 76 127
    i 9.363 155.061 0.001 1 49 127
    i 9.364 155.124 0.001 1 49 127
    i 8.990 155.124 0.001 1 49 127
    i 9.365 155.187 0.001 1 49 127
    i 11.221 155.223 -1.000 1 44 76
    i -11.220 155.235 0
    i 8.991 155.249 0.001 1 49 127
    i 9.366 155.249 0.001 1 49 127
    i 9.367 155.312 0.001 1 49 127
    i 9.368 155.375 0.001 1 49 127
    i 8.992 155.375 0.001 1 49 127
    i 9.369 155.437 0.001 1 49 127
    i 4.150 155.500 0.001 1 37 127
    i 7.119 155.500 0.001 1 39 127
    i 8.993 155.500 0.001 1 49 127
    i 9.370 155.500 0.001 1 49 127
    i -11.221 155.523 0
    i 11.222 155.523 -1.000 1 43 89
    i 9.371 155.561 0.001 1 49 127
    i 8.994 155.624 0.001 1 49 127
    i 9.372 155.624 0.001 1 49 127
    i 9.373 155.687 0.001 1 49 127
    i 5.093 155.749 0.001 1 37 127
    i 9.374 155.749 0.001 1 49 127
    i 8.995 155.749 0.001 1 49 127
    i 6.093 155.749 0.001 1 37 127
    i 9.375 155.812 0.001 1 49 127
    i 8.996 155.875 0.001 1 49 113
    i 9.376 155.875 0.001 1 49 127
    i 9.377 155.937 0.001 1 49 127
    i -10.155 155.999 0
    i 4.151 156.000 0.001 1 37 127
    i 9.378 156.000 0.001 1 49 127
    i 8.997 156.000 0.001 1 49 127
    i -10.156 155.999 0
    i -11.222 155.997 0
    i 5.094 156.000 0.001 1 37 127
    i 11.223 155.997 -1.000 1 41 97
    i 6.094 156.000 0.001 1 37 127
    i 9.379 156.061 0.001 1 49 127
    i 8.998 156.124 0.001 1 49 127
    i 9.380 156.124 0.001 1 49 127
    i 9.381 156.187 0.001 1 49 127
    i 8.999 156.249 0.001 1 49 127
    i 9.382 156.249 0.001 1 49 127
    i 9.383 156.312 0.001 1 49 127
    i 9.384 156.375 0.001 1 49 127
    i 8.001 156.375 0.001 1 49 127
    i 9.385 156.437 0.001 1 49 127
    i 4.152 156.500 0.001 1 37 127
    i 9.386 156.500 0.001 1 49 127
    i 8.002 156.500 0.001 1 49 127
    i 7.120 156.500 0.001 1 39 127
    i 9.387 156.561 0.001 1 49 127
    i 9.388 156.624 0.001 1 49 127
    i 8.003 156.624 0.001 1 49 127
    i 9.389 156.687 0.001 1 49 127
    i 8.004 156.749 0.001 1 49 127
    i 9.390 156.749 0.001 1 49 127
    i -11.223 156.756 0
    i 11.224 156.759 -1.000 1 38 80
    i 9.391 156.812 0.001 1 49 127
    i 9.392 156.875 0.001 1 49 127
    i 8.005 156.875 0.001 1 49 127
    i 9.393 156.937 0.001 1 49 127
    i 9.394 157.000 0.001 1 49 127
    i 8.006 157.000 0.001 1 49 127
    i 4.153 157.000 0.001 1 37 127
    i 10.157 157.000 -1.000 1 72 127
    i 10.158 157.000 -1.000 1 76 127
    i 9.395 157.061 0.001 1 49 127
    i 8.007 157.124 0.001 1 49 127
    i 9.396 157.124 0.001 1 49 127
    i 9.397 157.187 0.001 1 49 127
    i 11.225 157.205 -1.000 1 33 79
    i -11.224 157.229 0
    i 8.008 157.249 0.001 1 49 127
    i 9.398 157.249 0.001 1 49 127
    i 9.399 157.312 0.001 1 49 127
    i 8.009 157.375 0.001 1 49 127
    i 9.400 157.375 0.001 1 49 127
    i 9.401 157.437 0.001 1 49 127
    i 8.010 157.500 0.001 1 49 127
    i 7.121 157.500 0.001 1 39 127
    i 4.154 157.500 0.001 1 37 127
    i 9.402 157.500 0.001 1 49 127
    i 11.226 157.507 -1.000 1 36 89
    i -11.225 157.508 0
    i 9.403 157.561 0.001 1 49 127
    i 8.011 157.624 0.001 1 49 127
    i 9.404 157.624 0.001 1 49 127
    i 9.405 157.687 0.001 1 49 127
    i 6.095 157.749 0.001 1 37 127
    i 8.012 157.749 0.001 1 49 127
    i 5.095 157.749 0.001 1 37 127
    i 9.406 157.749 0.001 1 49 127
    i 9.407 157.812 0.001 1 49 127
    i 8.013 157.875 0.001 1 49 113
    i 9.408 157.875 0.001 1 49 127
    i 9.409 157.937 0.001 1 49 127
    i 5.096 158.000 0.001 1 37 127
    i 8.014 158.000 0.001 1 49 127
    i 6.096 158.000 0.001 1 37 127
    i -11.226 157.999 0
    i -10.157 158.000 0
    i 9.410 158.000 0.001 1 49 127
    i 4.155 158.000 0.001 1 37 127
    i -10.158 158.000 0
    i 11.227 158.000 -1.000 1 38 81
    i 9.411 158.061 0.001 1 49 127
    i 9.412 158.124 0.001 1 49 127
    i 8.015 158.124 0.001 1 49 127
    i 9.413 158.187 0.001 1 49 127
    i 8.016 158.249 0.001 1 49 127
    i 9.414 158.249 0.001 1 49 127
    i 9.415 158.312 0.001 1 49 127
    i 8.017 158.375 0.001 1 49 127
    i 9.416 158.375 0.001 1 49 127
    i 9.417 158.437 0.001 1 49 127
    i 7.122 158.500 0.001 1 39 127
    i 4.156 158.500 0.001 1 37 127
    i 8.018 158.500 0.001 1 49 127
    i 9.418 158.500 0.001 1 49 127
    i 9.419 158.561 0.001 1 49 127
    i 9.420 158.624 0.001 1 49 127
    i 8.019 158.624 0.001 1 49 127
    i 9.421 158.687 0.001 1 49 127
    i 11.228 158.737 -1.000 1 41 89
    i -11.227 158.744 0
    i 9.422 158.749 0.001 1 49 127
    i 8.020 158.749 0.001 1 49 127
    i 9.423 158.812 0.001 1 49 127
    i 8.021 158.875 0.001 1 49 127
    i 9.424 158.875 0.001 1 49 127
    i 9.425 158.937 0.001 1 49 127
    i 4.157 159.000 0.001 1 37 127
    i 9.426 159.000 0.001 1 49 127
    i 8.022 159.000 0.001 1 49 127
    i 10.159 159.000 -1.000 1 72 127
    i 10.160 159.000 -1.000 1 76 127
    i 9.427 159.061 0.001 1 49 127
    i 9.428 159.124 0.001 1 49 127
    i 8.023 159.124 0.001 1 49 127
    i 9.429 159.187 0.001 1 49 127
    i 8.024 159.249 0.001 1 49 127
    i 9.430 159.249 0.001 1 49 127
    i 11.229 159.255 -1.000 1 38 68
    i -11.228 159.260 0
    i 9.431 159.312 0.001 1 49 127
    i 8.025 159.375 0.001 1 49 127
    i 9.432 159.375 0.001 1 49 127
    i 9.433 159.437 0.001 1 49 127
    i 4.158 159.500 0.001 1 37 127
    i 7.123 159.500 0.001 1 39 127
    i 8.026 159.500 0.001 1 49 127
    i 9.434 159.500 0.001 1 49 127
    i 11.230 159.501 -1.000 1 41 78
    i -11.229 159.509 0
    i 9.435 159.561 0.001 1 49 127
    i 8.027 159.624 0.001 1 49 127
    i 9.436 159.624 0.001 1 49 127
    i 9.437 159.687 0.001 1 49 127
    i 5.097 159.749 0.001 1 37 127
    i 6.097 159.749 0.001 1 37 127
    i 8.028 159.749 0.001 1 49 127
    i 9.438 159.749 0.001 1 49 127
    i 9.439 159.812 0.001 1 49 127
    i 8.029 159.875 0.001 1 49 113
    i 9.440 159.875 0.001 1 49 127
    i 9.441 159.937 0.001 1 49 127
    i 4.159 160.000 0.001 1 37 127
    i 6.098 160.000 0.001 1 37 127
    i 8.030 160.000 0.001 1 49 127
    i 9.442 160.000 0.001 1 49 127
    i 5.098 160.000 0.001 1 37 127
    i -10.159 159.999 0
    i -10.160 159.999 0
    i 11.231 160.012 -1.000 1 38 78
    i -11.230 160.031 0
    i 9.443 160.061 0.001 1 49 127
    i 8.031 160.124 0.001 1 49 127
    i 9.444 160.124 0.001 1 49 127
    i 9.445 160.187 0.001 1 49 127
    i 8.032 160.249 0.001 1 49 127
    i 9.446 160.249 0.001 1 49 127
    i 9.447 160.312 0.001 1 49 127
    i 8.033 160.375 0.001 1 49 127
    i 9.448 160.375 0.001 1 49 127
    i 9.449 160.437 0.001 1 49 127
    i 7.124 160.500 0.001 1 39 127
    i 8.034 160.500 0.001 1 49 127
    i 9.450 160.500 0.001 1 49 127
    i 4.160 160.500 0.001 1 37 127
    i 9.451 160.561 0.001 1 49 127
    i 8.035 160.624 0.001 1 49 127
    i 9.452 160.624 0.001 1 49 127
    i 9.453 160.687 0.001 1 49 127
    i 8.036 160.749 0.001 1 49 127
    i 9.454 160.749 0.001 1 49 127
    i 11.232 160.760 -1.000 1 36 86
    i -11.231 160.768 0
    i 9.455 160.812 0.001 1 49 127
    i 8.037 160.875 0.001 1 49 127
    i 9.456 160.875 0.001 1 49 127
    i 9.457 160.937 0.001 1 49 127
    i 4.161 161.000 0.001 1 37 127
    i 9.458 161.000 0.001 1 49 127
    i 8.038 161.000 0.001 1 49 127
    i 10.161 161.000 -1.000 1 72 127
    i 10.162 161.000 -1.000 1 76 127
    i 9.459 161.061 0.001 1 49 127
    i 8.039 161.124 0.001 1 49 127
    i 9.460 161.124 0.001 1 49 127
    i 9.461 161.187 0.001 1 49 127
    i 8.040 161.249 0.001 1 49 127
    i 9.462 161.249 0.001 1 49 127
    i -11.232 161.257 0
    i 11.233 161.259 -1.000 1 33 74
    i 9.463 161.312 0.001 1 49 127
    i 8.041 161.375 0.001 1 49 127
    i 9.464 161.375 0.001 1 49 127
    i 9.465 161.437 0.001 1 49 127
    i 4.162 161.500 0.001 1 37 127
    i 7.125 161.500 0.001 1 39 127
    i 8.042 161.500 0.001 1 49 127
    i 9.466 161.500 0.001 1 49 127
    i 11.234 161.508 -1.000 1 36 91
    i -11.233 161.517 0
    i 9.467 161.561 0.001 1 49 127
    i 9.468 161.624 0.001 1 49 127
    i 8.043 161.624 0.001 1 49 127
    i 9.469 161.687 0.001 1 49 127
    i 5.099 161.749 0.001 1 37 127
    i 6.099 161.749 0.001 1 37 127
    i 8.044 161.749 0.001 1 49 127
    i 9.470 161.749 0.001 1 49 127
    i 9.471 161.812 0.001 1 49 127
    i 8.045 161.875 0.001 1 49 113
    i 9.472 161.875 0.001 1 49 127
    i 9.473 161.937 0.001 1 49 127
    i 5.100 162.000 0.001 1 37 127
    i 8.046 162.000 0.001 1 49 127
    i 4.163 162.000 0.001 1 37 127
    i -10.161 162.000 0
    i -11.234 161.999 0
    i 9.474 162.000 0.001 1 49 127
    i 6.100 162.000 0.001 1 37 127
    i -10.162 162.000 0
    i 11.235 162.000 -1.000 1 38 83
    i 9.475 162.061 0.001 1 49 127
    i 8.047 162.124 0.001 1 49 127
    i 9.476 162.124 0.001 1 49 127
    i 9.477 162.187 0.001 1 49 127
    i 9.478 162.249 0.001 1 49 127
    i 8.048 162.249 0.001 1 49 127
    i 9.479 162.312 0.001 1 49 127
    i 8.049 162.375 0.001 1 49 127
    i 9.480 162.375 0.001 1 49 127
    i 9.481 162.437 0.001 1 49 127
    i 4.164 162.500 0.001 1 37 127
    i 7.126 162.500 0.001 1 39 127
    i 8.050 162.500 0.001 1 49 127
    i 9.482 162.500 0.001 1 49 127
    i 9.483 162.561 0.001 1 49 127
    i 8.051 162.624 0.001 1 49 127
    i 9.484 162.624 0.001 1 49 127
    i 9.485 162.687 0.001 1 49 127
    i 11.236 162.737 -1.000 1 41 103
    i 8.052 162.749 0.001 1 49 127
    i -11.235 162.756 0
    i 9.486 162.749 0.001 1 49 127
    i 9.487 162.812 0.001 1 49 127
    i 8.053 162.875 0.001 1 49 127
    i 9.488 162.875 0.001 1 49 127
    i 9.489 162.937 0.001 1 49 127
    i 4.165 163.000 0.001 1 37 127
    i 8.054 163.000 0.001 1 49 127
    i 9.490 163.000 0.001 1 49 127
    i 10.163 163.000 -1.000 1 72 127
    i 10.164 163.000 -1.000 1 76 127
    i 9.491 163.061 0.001 1 49 127
    i 9.492 163.124 0.001 1 49 127
    i 8.055 163.124 0.001 1 49 127
    i 9.493 163.187 0.001 1 49 127
    i 11.237 163.223 -1.000 1 44 76
    i -11.236 163.235 0
    i 8.056 163.249 0.001 1 49 127
    i 9.494 163.249 0.001 1 49 127
    i 9.495 163.312 0.001 1 49 127
    i 9.496 163.375 0.001 1 49 127
    i 8.057 163.375 0.001 1 49 127
    i 9.497 163.437 0.001 1 49 127
    i 4.166 163.500 0.001 1 37 127
    i 7.127 163.500 0.001 1 39 127
    i 8.058 163.500 0.001 1 49 127
    i 9.498 163.500 0.001 1 49 127
    i -11.237 163.523 0
    i 11.238 163.523 -1.000 1 43 89
    i 9.499 163.561 0.001 1 49 127
    i 9.500 163.624 0.001 1 49 127
    i 8.059 163.624 0.001 1 49 127
    i 9.501 163.687 0.001 1 49 127
    i 5.101 163.749 0.001 1 37 127
    i 8.060 163.749 0.001 1 49 127
    i 9.502 163.749 0.001 1 49 127
    i 6.101 163.749 0.001 1 37 127
    i 9.503 163.812 0.001 1 49 127
    i 8.061 163.875 0.001 1 49 113
    i 9.504 163.875 0.001 1 49 127
    i 9.505 163.937 0.001 1 49 127
    i -10.163 163.999 0
    i -11.238 163.997 0
    i 11.239 163.997 -1.000 1 41 97
    i 4.167 164.000 0.001 1 37 127
    i 6.102 164.000 0.001 1 37 127
    i 8.062 164.000 0.001 1 49 127
    i 9.506 164.000 0.001 1 49 127
    i -10.164 163.999 0
    i 5.102 164.000 0.001 1 37 127
    i 9.507 164.061 0.001 1 49 127
    i 8.063 164.124 0.001 1 49 127
    i 9.508 164.124 0.001 1 49 127
    i 9.509 164.187 0.001 1 49 127
    i 9.510 164.249 0.001 1 49 127
    i 8.064 164.249 0.001 1 49 127
    i 9.511 164.312 0.001 1 49 127
    i 9.512 164.375 0.001 1 49 127
    i 8.065 164.375 0.001 1 49 127
    i 9.513 164.437 0.001 1 49 127
    i 4.168 164.500 0.001 1 37 127
    i 8.066 164.500 0.001 1 49 127
    i 7.128 164.500 0.001 1 39 127
    i 9.514 164.500 0.001 1 49 127
    i 9.515 164.561 0.001 1 49 127
    i 8.067 164.624 0.001 1 49 127
    i 9.516 164.624 0.001 1 49 127
    i 9.517 164.687 0.001 1 49 127
    i 9.518 164.749 0.001 1 49 127
    i 8.068 164.749 0.001 1 49 127
    i -11.239 164.756 0
    i 11.240 164.759 -1.000 1 38 80
    i 9.519 164.812 0.001 1 49 127
    i 8.069 164.875 0.001 1 49 127
    i 9.520 164.875 0.001 1 49 127
    i 9.521 164.937 0.001 1 49 127
    i 8.070 165.000 0.001 1 49 127
    i 9.522 165.000 0.001 1 49 127
    i 10.165 165.000 -1.000 1 72 127
    i 10.166 165.000 -1.000 1 76 127
    i 4.169 165.000 0.001 1 37 127
    i 9.523 165.061 0.001 1 49 127
    i 9.524 165.124 0.001 1 49 127
    i 8.071 165.124 0.001 1 49 127
    i 9.525 165.187 0.001 1 49 127
    i 11.241 165.205 -1.000 1 33 79
    i -11.240 165.229 0
    i 8.072 165.249 0.001 1 49 127
    i 9.526 165.249 0.001 1 49 127
    i 9.527 165.312 0.001 1 49 127
    i 8.073 165.375 0.001 1 49 127
    i 9.528 165.375 0.001 1 49 127
    i 9.529 165.437 0.001 1 49 127
    i 4.170 165.500 0.001 1 37 127
    i 7.129 165.500 0.001 1 39 127
    i 9.530 165.500 0.001 1 49 127
    i 8.074 165.500 0.001 1 49 127
    i 11.242 165.507 -1.000 1 36 89
    i -11.241 165.508 0
    i 9.531 165.561 0.001 1 49 127
    i 8.075 165.624 0.001 1 49 127
    i 9.532 165.624 0.001 1 49 127
    i 9.533 165.687 0.001 1 49 127
    i 5.103 165.749 0.001 1 37 127
    i 6.103 165.749 0.001 1 37 127
    i 8.076 165.749 0.001 1 49 127
    i 9.534 165.749 0.001 1 49 127
    i 9.535 165.812 0.001 1 49 127
    i 9.536 165.875 0.001 1 49 127
    i 8.077 165.875 0.001 1 49 113
    i 9.537 165.937 0.001 1 49 127
    i -11.242 165.999 0
    i 11.243 166.000 -1.000 1 38 81
    i 4.171 166.000 0.001 1 37 127
    i 5.104 166.000 0.001 1 37 127
    i 6.104 166.000 0.001 1 37 127
    i 9.538 166.000 0.001 1 49 127
    i -10.165 166.000 0
    i -10.166 166.000 0
    i 8.078 166.000 0.001 1 49 127
    i 9.539 166.061 0.001 1 49 127
    i 9.540 166.124 0.001 1 49 127
    i 8.079 166.124 0.001 1 49 127
    i 9.541 166.187 0.001 1 49 127
    i 8.080 166.249 0.001 1 49 127
    i 9.542 166.249 0.001 1 49 127
    i 9.543 166.312 0.001 1 49 127
    i 9.544 166.375 0.001 1 49 127
    i 8.081 166.375 0.001 1 49 127
    i 9.545 166.437 0.001 1 49 127
    i 4.172 166.500 0.001 1 37 127
    i 7.130 166.500 0.001 1 39 127
    i 8.082 166.500 0.001 1 49 127
    i 9.546 166.500 0.001 1 49 127
    i 9.547 166.561 0.001 1 49 127
    i 8.083 166.624 0.001 1 49 127
    i 9.548 166.624 0.001 1 49 127
    i 9.549 166.687 0.001 1 49 127
    i 11.244 166.737 -1.000 1 41 89
    i -11.243 166.744 0
    i 9.550 166.749 0.001 1 49 127
    i 8.084 166.749 0.001 1 49 127
    i 9.551 166.812 0.001 1 49 127
    i 8.085 166.875 0.001 1 49 127
    i 9.552 166.875 0.001 1 49 127
    i 9.553 166.937 0.001 1 49 127
    i 9.554 167.000 0.001 1 49 127
    i 4.173 167.000 0.001 1 37 127
    i 10.167 167.000 -1.000 1 72 127
    i 8.086 167.000 0.001 1 49 127
    i 10.168 167.000 -1.000 1 76 127
    i 9.555 167.061 0.001 1 49 127
    i 9.556 167.124 0.001 1 49 127
    i 8.087 167.124 0.001 1 49 127
    i 9.557 167.187 0.001 1 49 127
    i 8.088 167.249 0.001 1 49 127
    i 9.558 167.249 0.001 1 49 127
    i 11.245 167.255 -1.000 1 38 68
    i -11.244 167.260 0
    i 9.559 167.312 0.001 1 49 127
    i 9.560 167.375 0.001 1 49 127
    i 8.089 167.375 0.001 1 49 127
    i 9.561 167.437 0.001 1 49 127
    i 8.090 167.500 0.001 1 49 127
    i 9.562 167.500 0.001 1 49 127
    i 11.246 167.501 -1.000 1 41 78
    i 4.174 167.500 0.001 1 37 127
    i 7.131 167.500 0.001 1 39 127
    i -11.245 167.509 0
    i 9.563 167.561 0.001 1 49 127
    i 9.564 167.624 0.001 1 49 127
    i 8.091 167.624 0.001 1 49 127
    i 9.565 167.687 0.001 1 49 127
    i 6.105 167.749 0.001 1 37 127
    i 8.092 167.749 0.001 1 49 127
    i 5.105 167.749 0.001 1 37 127
    i 9.566 167.749 0.001 1 49 127
    i 9.567 167.812 0.001 1 49 127
    i 8.093 167.875 0.001 1 49 113
    i 9.568 167.875 0.001 1 49 127
    i 9.569 167.937 0.001 1 49 127
    i 4.175 168.000 0.001 1 37 127
    i 5.106 168.000 0.001 1 37 127
    i 8.094 168.000 0.001 1 49 127
    i 6.106 168.000 0.001 1 37 127
    i 9.570 168.000 0.001 1 49 127
    i -10.167 167.999 0
    i -10.168 167.999 0
    i 11.247 168.012 -1.000 1 38 78
    i -11.246 168.031 0
    i 9.571 168.061 0.001 1 49 127
    i 8.095 168.124 0.001 1 49 127
    i 9.572 168.124 0.001 1 49 127
    i 9.573 168.187 0.001 1 49 127
    i 8.096 168.249 0.001 1 49 127
    i 9.574 168.249 0.001 1 49 127
    i 9.575 168.312 0.001 1 49 127
    i 8.097 168.375 0.001 1 49 127
    i 9.576 168.375 0.001 1 49 127
    i 9.577 168.437 0.001 1 49 127
    i 7.132 168.500 0.001 1 39 127
    i 8.098 168.500 0.001 1 49 127
    i 9.578 168.500 0.001 1 49 127
    i 4.176 168.500 0.001 1 37 127
    i 9.579 168.561 0.001 1 49 127
    i 9.580 168.624 0.001 1 49 127
    i 8.099 168.624 0.001 1 49 127
    i 9.581 168.687 0.001 1 49 127
    i 8.100 168.749 0.001 1 49 127
    i 9.582 168.749 0.001 1 49 127
    i 11.248 168.760 -1.000 1 36 86
    i -11.247 168.768 0
    i 9.583 168.812 0.001 1 49 127
    i 8.101 168.875 0.001 1 49 127
    i 9.584 168.875 0.001 1 49 127
    i 9.585 168.937 0.001 1 49 127
    i 4.177 169.000 0.001 1 37 127
    i 9.586 169.000 0.001 1 49 127
    i 8.102 169.000 0.001 1 49 127
    i 10.169 169.000 -1.000 1 72 127
    i 10.170 169.000 -1.000 1 76 127
    i 9.587 169.061 0.001 1 49 127
    i 9.588 169.124 0.001 1 49 127
    i 8.103 169.124 0.001 1 49 127
    i 9.589 169.187 0.001 1 49 127
    i 8.104 169.249 0.001 1 49 127
    i 9.590 169.249 0.001 1 49 127
    i -11.248 169.257 0
    i 11.249 169.259 -1.000 1 33 74
    i 9.591 169.312 0.001 1 49 127
    i 8.105 169.375 0.001 1 49 127
    i 9.592 169.375 0.001 1 49 127
    i 9.593 169.437 0.001 1 49 127
    i 7.133 169.500 0.001 1 39 127
    i 9.594 169.500 0.001 1 49 127
    i 4.178 169.500 0.001 1 37 127
    i 8.106 169.500 0.001 1 49 127
    i 11.250 169.508 -1.000 1 36 91
    i -11.249 169.517 0
    i 9.595 169.561 0.001 1 49 127
    i 9.596 169.624 0.001 1 49 127
    i 8.107 169.624 0.001 1 49 127
    i 9.597 169.687 0.001 1 49 127
    i 9.598 169.749 0.001 1 49 127
    i 5.107 169.749 0.001 1 37 127
    i 8.108 169.749 0.001 1 49 127
    i 6.107 169.749 0.001 1 37 127
    i 9.599 169.812 0.001 1 49 127
    i 9.600 169.875 0.001 1 49 127
    i 8.109 169.875 0.001 1 49 113
    i 9.601 169.937 0.001 1 49 127
    i 4.179 170.000 0.001 1 37 127
    i -11.250 169.999 0
    i 6.108 170.000 0.001 1 37 127
    i -10.169 170.000 0
    i 9.602 170.000 0.001 1 49 127
    i 5.108 170.000 0.001 1 37 127
    i -10.170 170.000 0
    i 8.110 170.000 0.001 1 49 127
    i 11.251 170.000 -1.000 1 38 83
    i 9.603 170.061 0.001 1 49 127
    i 9.604 170.124 0.001 1 49 127
    i 8.111 170.124 0.001 1 49 127
    i 9.605 170.187 0.001 1 49 127
    i 9.606 170.249 0.001 1 49 127
    i 8.112 170.249 0.001 1 49 127
    i 9.607 170.312 0.001 1 49 127
    i 8.113 170.375 0.001 1 49 127
    i 9.608 170.375 0.001 1 49 127
    i 9.609 170.437 0.001 1 49 127
    i 8.114 170.500 0.001 1 49 127
    i 4.180 170.500 0.001 1 37 127
    i 9.610 170.500 0.001 1 49 127
    i 7.134 170.500 0.001 1 39 127
    i 9.611 170.561 0.001 1 49 127
    i 9.612 170.624 0.001 1 49 127
    i 8.115 170.624 0.001 1 49 127
    i 9.613 170.687 0.001 1 49 127
    i 11.252 170.737 -1.000 1 41 103
    i 8.116 170.749 0.001 1 49 127
    i 9.614 170.749 0.001 1 49 127
    i -11.251 170.756 0
    i 9.615 170.812 0.001 1 49 127
    i 9.616 170.875 0.001 1 49 127
    i 8.117 170.875 0.001 1 49 127
    i 9.617 170.937 0.001 1 49 127
    i 4.181 171.000 0.001 1 37 127
    i 8.118 171.000 0.001 1 49 127
    i 9.618 171.000 0.001 1 49 127
    i 10.171 171.000 -1.000 1 72 127
    i 10.172 171.000 -1.000 1 76 127
    i 9.619 171.061 0.001 1 49 127
    i 8.119 171.124 0.001 1 49 127
    i 9.620 171.124 0.001 1 49 127
    i 9.621 171.187 0.001 1 49 127
    i 11.253 171.223 -1.000 1 44 76
    i -11.252 171.235 0
    i 8.120 171.249 0.001 1 49 127
    i 9.622 171.249 0.001 1 49 127
    i 9.623 171.312 0.001 1 49 127
    i 9.624 171.375 0.001 1 49 127
    i 8.121 171.375 0.001 1 49 127
    i 9.625 171.437 0.001 1 49 127
    i 9.626 171.500 0.001 1 49 127
    i 4.182 171.500 0.001 1 37 127
    i 7.135 171.500 0.001 1 39 127
    i 8.122 171.500 0.001 1 49 127
    i -11.253 171.523 0
    i 11.254 171.523 -1.000 1 43 89
    i 9.627 171.561 0.001 1 49 127
    i 9.628 171.624 0.001 1 49 127
    i 8.123 171.624 0.001 1 49 127
    i 9.629 171.687 0.001 1 49 127
    i 5.109 171.749 0.001 1 37 127
    i 6.109 171.749 0.001 1 37 127
    i 8.124 171.749 0.001 1 49 127
    i 9.630 171.749 0.001 1 49 127
    i 9.631 171.812 0.001 1 49 127
    i 9.632 171.875 0.001 1 49 127
    i 8.125 171.875 0.001 1 49 113
    i 9.633 171.937 0.001 1 49 127
    i -11.254 171.997 0
    i -10.171 171.999 0
    i -10.172 171.999 0
    i 11.255 171.997 -1.000 1 41 97
    i 4.183 172.000 0.001 1 37 127
    i 5.110 172.000 0.001 1 37 127
    i 6.110 172.000 0.001 1 37 127
    i 8.126 172.000 0.001 1 49 127
    i 9.634 172.000 0.001 1 49 127
    i 9.635 172.061 0.001 1 49 127
    i 8.127 172.124 0.001 1 49 127
    i 9.636 172.124 0.001 1 49 127
    i 9.637 172.187 0.001 1 49 127
    i 9.638 172.249 0.001 1 49 127
    i 8.128 172.249 0.001 1 49 127
    i 9.639 172.312 0.001 1 49 127
    i 8.129 172.375 0.001 1 49 127
    i 9.640 172.375 0.001 1 49 127
    i 9.641 172.437 0.001 1 49 127
    i 4.184 172.500 0.001 1 37 127
    i 7.136 172.500 0.001 1 39 127
    i 8.130 172.500 0.001 1 49 127
    i 9.642 172.500 0.001 1 49 127
    i 9.643 172.561 0.001 1 49 127
    i 9.644 172.624 0.001 1 49 127
    i 8.131 172.624 0.001 1 49 127
    i 9.645 172.687 0.001 1 49 127
    i 8.132 172.749 0.001 1 49 127
    i 9.646 172.749 0.001 1 49 127
    i -11.255 172.756 0
    i 11.256 172.759 -1.000 1 38 80
    i 9.647 172.812 0.001 1 49 127
    i 8.133 172.875 0.001 1 49 127
    i 9.648 172.875 0.001 1 49 127
    i 9.649 172.937 0.001 1 49 127
    i 4.185 173.000 0.001 1 37 127
    i 9.650 173.000 0.001 1 49 127
    i 8.134 173.000 0.001 1 49 127
    i 10.173 173.000 -1.000 1 72 127
    i 10.174 173.000 -1.000 1 76 127
    i 9.651 173.061 0.001 1 49 127
    i 8.135 173.124 0.001 1 49 127
    i 9.652 173.124 0.001 1 49 127
    i 9.653 173.187 0.001 1 49 127
    i 11.257 173.205 -1.000 1 33 79
    i -11.256 173.229 0
    i 8.136 173.249 0.001 1 49 127
    i 9.654 173.249 0.001 1 49 127
    i 9.655 173.312 0.001 1 49 127
    i 8.137 173.375 0.001 1 49 127
    i 9.656 173.375 0.001 1 49 127
    i 9.657 173.437 0.001 1 49 127
    i 4.186 173.500 0.001 1 37 127
    i 7.137 173.500 0.001 1 39 127
    i 8.138 173.500 0.001 1 49 127
    i 9.658 173.500 0.001 1 49 127
    i 11.258 173.507 -1.000 1 36 89
    i -11.257 173.508 0
    i 9.659 173.561 0.001 1 49 127
    i 9.660 173.624 0.001 1 49 127
    i 8.139 173.624 0.001 1 49 127
    i 9.661 173.687 0.001 1 49 127
    i 9.662 173.749 0.001 1 49 127
    i 5.111 173.749 0.001 1 37 127
    i 6.111 173.749 0.001 1 37 127
    i 8.140 173.749 0.001 1 49 127
    i 9.663 173.812 0.001 1 49 127
    i 8.141 173.875 0.001 1 49 113
    i 9.664 173.875 0.001 1 49 127
    i 9.665 173.937 0.001 1 49 127
    i -11.258 173.999 0
    i 4.187 174.000 0.001 1 37 127
    i 11.259 174.000 -1.000 1 38 81
    i 5.112 174.000 0.001 1 37 127
    i 6.112 174.000 0.001 1 37 127
    i 8.142 174.000 0.001 1 49 127
    i 9.666 174.000 0.001 1 49 127
    i -10.173 174.000 0
    i -10.174 174.000 0
    i 9.667 174.061 0.001 1 49 127
    i 9.668 174.124 0.001 1 49 127
    i 8.143 174.124 0.001 1 49 127
    i 9.669 174.187 0.001 1 49 127
    i 9.670 174.249 0.001 1 49 127
    i 8.144 174.249 0.001 1 49 127
    i 9.671 174.312 0.001 1 49 127
    i 8.145 174.375 0.001 1 49 127
    i 9.672 174.375 0.001 1 49 127
    i 9.673 174.437 0.001 1 49 127
    i 7.138 174.500 0.001 1 39 127
    i 4.188 174.500 0.001 1 37 127
    i 9.674 174.500 0.001 1 49 127
    i 8.146 174.500 0.001 1 49 127
    i 9.675 174.561 0.001 1 49 127
    i 9.676 174.624 0.001 1 49 127
    i 8.147 174.624 0.001 1 49 127
    i 9.677 174.687 0.001 1 49 127
    i 11.260 174.737 -1.000 1 41 89
    i -11.259 174.744 0
    i 8.148 174.749 0.001 1 49 127
    i 9.678 174.749 0.001 1 49 127
    i 9.679 174.812 0.001 1 49 127
    i 8.149 174.875 0.001 1 49 127
    i 9.680 174.875 0.001 1 49 127
    i 9.681 174.937 0.001 1 49 127
    i 8.150 175.000 0.001 1 49 127
    i 9.682 175.000 0.001 1 49 127
    i 10.175 175.000 -1.000 1 72 127
    i 4.189 175.000 0.001 1 37 127
    i 10.176 175.000 -1.000 1 76 127
    i 9.683 175.061 0.001 1 49 127
    i 8.151 175.124 0.001 1 49 127
    i 9.684 175.124 0.001 1 49 127
    i 9.685 175.187 0.001 1 49 127
    i 8.152 175.249 0.001 1 49 127
    i 9.686 175.249 0.001 1 49 127
    i 11.261 175.255 -1.000 1 38 68
    i -11.260 175.260 0
    i 9.687 175.312 0.001 1 49 127
    i 8.153 175.375 0.001 1 49 127
    i 9.688 175.375 0.001 1 49 127
    i 9.689 175.437 0.001 1 49 127
    i 7.139 175.500 0.001 1 39 127
    i 9.690 175.500 0.001 1 49 127
    i 11.262 175.501 -1.000 1 41 78
    i 4.190 175.500 0.001 1 37 127
    i 8.154 175.500 0.001 1 49 127
    i -11.261 175.509 0
    i 9.691 175.561 0.001 1 49 127
    i 8.155 175.624 0.001 1 49 127
    i 9.692 175.624 0.001 1 49 127
    i 9.693 175.687 0.001 1 49 127
    i 5.113 175.749 0.001 1 37 127
    i 6.113 175.749 0.001 1 37 127
    i 9.694 175.749 0.001 1 49 127
    i 8.156 175.749 0.001 1 49 127
    i 9.695 175.812 0.001 1 49 127
    i 9.696 175.875 0.001 1 49 127
    i 8.157 175.875 0.001 1 49 113
    i 9.697 175.937 0.001 1 49 127
    i 8.158 176.000 0.001 1 49 127
    i 9.698 176.000 0.001 1 49 127
    i 6.114 176.000 0.001 1 37 127
    i 5.114 176.000 0.001 1 37 127
    i 4.191 176.000 0.001 1 37 127
    i -10.175 175.999 0
    i -10.176 175.999 0
    i 11.263 176.012 -1.000 1 38 78
    i -11.262 176.031 0
    i 9.699 176.061 0.001 1 49 127
    i 8.159 176.124 0.001 1 49 127
    i 9.700 176.124 0.001 1 49 127
    i 9.701 176.187 0.001 1 49 127
    i 9.702 176.249 0.001 1 49 127
    i 8.160 176.249 0.001 1 49 127
    i 9.703 176.312 0.001 1 49 127
    i 8.161 176.375 0.001 1 49 127
    i 9.704 176.375 0.001 1 49 127
    i 9.705 176.437 0.001 1 49 127
    i 4.192 176.500 0.001 1 37 127
    i 7.140 176.500 0.001 1 39 127
    i 9.706 176.500 0.001 1 49 127
    i 8.162 176.500 0.001 1 49 127
    i 9.707 176.561 0.001 1 49 127
    i 9.708 176.624 0.001 1 49 127
    i 8.163 176.624 0.001 1 49 127
    i 9.709 176.687 0.001 1 49 127
    i 8.164 176.749 0.001 1 49 127
    i 9.710 176.749 0.001 1 49 127
    i 11.264 176.760 -1.000 1 36 86
    i -11.263 176.768 0
    i 9.711 176.812 0.001 1 49 127
    i 8.165 176.875 0.001 1 49 127
    i 9.712 176.875 0.001 1 49 127
    i 9.713 176.937 0.001 1 49 127
    i 8.166 177.000 0.001 1 49 127
    i 10.177 177.000 -1.000 1 72 127
    i 4.193 177.000 0.001 1 37 127
    i 9.714 177.000 0.001 1 49 127
    i 10.178 177.000 -1.000 1 76 127
    i 9.715 177.061 0.001 1 49 127
    i 8.167 177.124 0.001 1 49 127
    i 9.716 177.124 0.001 1 49 127
    i 9.717 177.187 0.001 1 49 127
    i 8.168 177.249 0.001 1 49 127
    i 9.718 177.249 0.001 1 49 127
    i -11.264 177.257 0
    i 11.265 177.259 -1.000 1 33 74
    i 9.719 177.312 0.001 1 49 127
    i 8.169 177.375 0.001 1 49 127
    i 9.720 177.375 0.001 1 49 127
    i 9.721 177.437 0.001 1 49 127
    i 8.170 177.500 0.001 1 49 127
    i 9.722 177.500 0.001 1 49 127
    i 7.141 177.500 0.001 1 39 127
    i 4.194 177.500 0.001 1 37 127
    i 11.266 177.508 -1.000 1 36 91
    i -11.265 177.517 0
    i 9.723 177.561 0.001 1 49 127
    i 8.171 177.624 0.001 1 49 127
    i 9.724 177.624 0.001 1 49 127
    i 9.725 177.687 0.001 1 49 127
    i 5.115 177.749 0.001 1 37 127
    i 8.172 177.749 0.001 1 49 127
    i 9.726 177.749 0.001 1 49 127
    i 6.115 177.749 0.001 1 37 127
    i 9.727 177.812 0.001 1 49 127
    i 9.728 177.875 0.001 1 49 127
    i 8.173 177.875 0.001 1 49 113
    i 9.729 177.937 0.001 1 49 127
    i 9.730 178.000 0.001 1 49 127
    i 6.116 178.000 0.001 1 37 127
    i 5.116 178.000 0.001 1 37 127
    i 8.174 178.000 0.001 1 49 127
    i -11.266 177.999 0
    i 4.195 178.000 0.001 1 37 127
    i -10.177 178.000 0
    i 11.267 178.000 -1.000 1 38 83
    i -10.178 178.000 0
    i 9.731 178.061 0.001 1 49 127
    i 9.732 178.124 0.001 1 49 127
    i 8.175 178.124 0.001 1 49 127
    i 9.733 178.187 0.001 1 49 127
    i 8.176 178.249 0.001 1 49 127
    i 9.734 178.249 0.001 1 49 127
    i 9.735 178.312 0.001 1 49 127
    i 9.736 178.375 0.001 1 49 127
    i 8.177 178.375 0.001 1 49 127
    i 9.737 178.437 0.001 1 49 127
    i 4.196 178.500 0.001 1 37 127
    i 7.142 178.500 0.001 1 39 127
    i 9.738 178.500 0.001 1 49 127
    i 8.178 178.500 0.001 1 49 127
    i 9.739 178.561 0.001 1 49 127
    i 8.179 178.624 0.001 1 49 127
    i 9.740 178.624 0.001 1 49 127
    i 9.741 178.687 0.001 1 49 127
    i 11.268 178.737 -1.000 1 41 103
    i -11.267 178.756 0
    i 8.180 178.749 0.001 1 49 127
    i 9.742 178.749 0.001 1 49 127
    i 9.743 178.812 0.001 1 49 127
    i 9.744 178.875 0.001 1 49 127
    i 8.181 178.875 0.001 1 49 127
    i 9.745 178.937 0.001 1 49 127
    i 8.182 179.000 0.001 1 49 127
    i 4.197 179.000 0.001 1 37 127
    i 9.746 179.000 0.001 1 49 127
    i 10.179 179.000 -1.000 1 72 127
    i 10.180 179.000 -1.000 1 76 127
    i 9.747 179.061 0.001 1 49 127
    i 9.748 179.124 0.001 1 49 127
    i 8.183 179.124 0.001 1 49 127
    i 9.749 179.187 0.001 1 49 127
    i 11.269 179.223 -1.000 1 44 76
    i -11.268 179.235 0
    i 8.184 179.249 0.001 1 49 127
    i 9.750 179.249 0.001 1 49 127
    i 9.751 179.312 0.001 1 49 127
    i 8.185 179.375 0.001 1 49 127
    i 9.752 179.375 0.001 1 49 127
    i 9.753 179.437 0.001 1 49 127
    i 7.143 179.500 0.001 1 39 127
    i 9.754 179.500 0.001 1 49 127
    i 8.186 179.500 0.001 1 49 127
    i 4.198 179.500 0.001 1 37 127
    i -11.269 179.523 0
    i 11.270 179.523 -1.000 1 43 89
    i 9.755 179.561 0.001 1 49 127
    i 8.187 179.624 0.001 1 49 127
    i 9.756 179.624 0.001 1 49 127
    i 9.757 179.687 0.001 1 49 127
    i 6.117 179.749 0.001 1 37 127
    i 5.117 179.749 0.001 1 37 127
    i 8.188 179.749 0.001 1 49 127
    i 9.758 179.749 0.001 1 49 127
    i 9.759 179.812 0.001 1 49 127
    i 8.189 179.875 0.001 1 49 113
    i 9.760 179.875 0.001 1 49 127
    i 9.761 179.937 0.001 1 49 127
    i -11.270 179.997 0
    i 4.199 180.000 0.001 1 37 127
    i 8.190 180.000 0.001 1 49 127
    i 5.118 180.000 0.001 1 37 127
    i 6.118 180.000 0.001 1 37 127
    i 9.762 180.000 0.001 1 49 127
    i 11.271 179.997 -1.000 1 41 97
    i -10.179 179.999 0
    i -10.180 179.999 0
    i 9.763 180.061 0.001 1 49 127
    i 9.764 180.124 0.001 1 49 127
    i 8.191 180.124 0.001 1 49 127
    i 9.765 180.187 0.001 1 49 127
    i 8.192 180.249 0.001 1 49 127
    i 9.766 180.249 0.001 1 49 127
    i 9.767 180.312 0.001 1 49 127
    i 8.193 180.375 0.001 1 49 127
    i 9.768 180.375 0.001 1 49 127
    i 9.769 180.437 0.001 1 49 127
    i 4.200 180.500 0.001 1 37 127
    i 7.144 180.500 0.001 1 39 127
    i 8.194 180.500 0.001 1 49 127
    i 9.770 180.500 0.001 1 49 127
    i 9.771 180.561 0.001 1 49 127
    i 8.195 180.624 0.001 1 49 127
    i 9.772 180.624 0.001 1 49 127
    i 9.773 180.687 0.001 1 49 127
    i 9.774 180.749 0.001 1 49 127
    i 8.196 180.749 0.001 1 49 127
    i -11.271 180.756 0
    i 11.272 180.759 -1.000 1 38 80
    i 9.775 180.812 0.001 1 49 127
    i 8.197 180.875 0.001 1 49 127
    i 9.776 180.875 0.001 1 49 127
    i 9.777 180.937 0.001 1 49 127
    i 4.201 181.000 0.001 1 37 127
    i 10.181 181.000 -1.000 1 72 127
    i 9.778 181.000 0.001 1 49 127
    i 10.182 181.000 -1.000 1 76 127
    i 8.198 181.000 0.001 1 49 127
    i 9.779 181.061 0.001 1 49 127
    i 8.199 181.124 0.001 1 49 127
    i 9.780 181.124 0.001 1 49 127
    i 9.781 181.187 0.001 1 49 127
    i 11.273 181.205 -1.000 1 33 79
    i -11.272 181.229 0
    i 9.782 181.249 0.001 1 49 127
    i 8.200 181.249 0.001 1 49 127
    i 9.783 181.312 0.001 1 49 127
    i 9.784 181.375 0.001 1 49 127
    i 8.201 181.375 0.001 1 49 127
    i 9.785 181.437 0.001 1 49 127
    i 4.202 181.500 0.001 1 37 127
    i 9.786 181.500 0.001 1 49 127
    i 8.202 181.500 0.001 1 49 127
    i 7.145 181.500 0.001 1 39 127
    i 11.274 181.507 -1.000 1 36 89
    i -11.273 181.508 0
    i 9.787 181.561 0.001 1 49 127
    i 8.203 181.624 0.001 1 49 127
    i 9.788 181.624 0.001 1 49 127
    i 9.789 181.687 0.001 1 49 127
    i 8.204 181.749 0.001 1 49 127
    i 9.790 181.749 0.001 1 49 127
    i 5.119 181.749 0.001 1 37 127
    i 6.119 181.749 0.001 1 37 127
    i 9.791 181.812 0.001 1 49 127
    i 8.205 181.875 0.001 1 49 113
    i 9.792 181.875 0.001 1 49 127
    i 9.793 181.937 0.001 1 49 127
    i 6.120 182.000 0.001 1 37 127
    i 5.120 182.000 0.001 1 37 127
    i -10.181 182.000 0
    i 8.206 182.000 0.001 1 49 127
    i 4.203 182.000 0.001 1 37 127
    i -11.274 181.999 0
    i -10.182 182.000 0
    i 9.794 182.000 0.001 1 49 127
    i 11.275 182.000 -1.000 1 38 81
    i 9.795 182.061 0.001 1 49 127
    i 8.207 182.124 0.001 1 49 127
    i 9.796 182.124 0.001 1 49 127
    i 9.797 182.187 0.001 1 49 127
    i 8.208 182.249 0.001 1 49 127
    i 9.798 182.249 0.001 1 49 127
    i 9.799 182.312 0.001 1 49 127
    i 8.209 182.375 0.001 1 49 127
    i 9.800 182.375 0.001 1 49 127
    i 9.801 182.437 0.001 1 49 127
    i 9.802 182.500 0.001 1 49 127
    i 7.146 182.500 0.001 1 39 127
    i 8.210 182.500 0.001 1 49 127
    i 4.204 182.500 0.001 1 37 127
    i 9.803 182.561 0.001 1 49 127
    i 8.211 182.624 0.001 1 49 127
    i 9.804 182.624 0.001 1 49 127
    i 9.805 182.687 0.001 1 49 127
    i 11.276 182.737 -1.000 1 41 89
    i -11.275 182.744 0
    i 8.212 182.749 0.001 1 49 127
    i 9.806 182.749 0.001 1 49 127
    i 9.807 182.812 0.001 1 49 127
    i 9.808 182.875 0.001 1 49 127
    i 8.213 182.875 0.001 1 49 127
    i 9.809 182.937 0.001 1 49 127
    i 4.205 183.000 0.001 1 37 127
    i 8.214 183.000 0.001 1 49 127
    i 9.810 183.000 0.001 1 49 127
    i 10.183 183.000 -1.000 1 72 127
    i 10.184 183.000 -1.000 1 76 127
    i 9.811 183.061 0.001 1 49 127
    i 9.812 183.124 0.001 1 49 127
    i 8.215 183.124 0.001 1 49 127
    i 9.813 183.187 0.001 1 49 127
    i 8.216 183.249 0.001 1 49 127
    i 9.814 183.249 0.001 1 49 127
    i 11.277 183.255 -1.000 1 38 68
    i -11.276 183.260 0
    i 9.815 183.312 0.001 1 49 127
    i 9.816 183.375 0.001 1 49 127
    i 8.217 183.375 0.001 1 49 127
    i 9.817 183.437 0.001 1 49 127
    i 11.278 183.501 -1.000 1 41 78
    i 4.206 183.500 0.001 1 37 127
    i 7.147 183.500 0.001 1 39 127
    i 8.218 183.500 0.001 1 49 127
    i 9.818 183.500 0.001 1 49 127
    i -11.277 183.509 0
    i 9.819 183.561 0.001 1 49 127
    i 8.219 183.624 0.001 1 49 127
    i 9.820 183.624 0.001 1 49 127
    i 9.821 183.687 0.001 1 49 127
    i 5.121 183.749 0.001 1 37 127
    i 6.121 183.749 0.001 1 37 127
    i 8.220 183.749 0.001 1 49 127
    i 9.822 183.749 0.001 1 49 127
    i 9.823 183.812 0.001 1 49 127
    i 8.221 183.875 0.001 1 49 113
    i 9.824 183.875 0.001 1 49 127
    i 9.825 183.937 0.001 1 49 127
    i 8.222 184.000 0.001 1 49 127
    i 6.122 184.000 0.001 1 37 127
    i 4.207 184.000 0.001 1 37 127
    i 9.826 184.000 0.001 1 49 127
    i -10.183 183.999 0
    i 5.122 184.000 0.001 1 37 127
    i -10.184 183.999 0
    i 11.279 184.012 -1.000 1 38 78
    i -11.278 184.031 0
    i 9.827 184.061 0.001 1 49 127
    i 9.828 184.124 0.001 1 49 127
    i 8.223 184.124 0.001 1 49 127
    i 9.829 184.187 0.001 1 49 127
    i 9.830 184.249 0.001 1 49 127
    i 8.224 184.249 0.001 1 49 127
    i 9.831 184.312 0.001 1 49 127
    i 8.225 184.375 0.001 1 49 127
    i 9.832 184.375 0.001 1 49 127
    i 9.833 184.437 0.001 1 49 127
    i 7.148 184.500 0.001 1 39 127
    i 9.834 184.500 0.001 1 49 127
    i 8.226 184.500 0.001 1 49 127
    i 4.208 184.500 0.001 1 37 127
    i 9.835 184.561 0.001 1 49 127
    i 8.227 184.624 0.001 1 49 127
    i 9.836 184.624 0.001 1 49 127
    i 9.837 184.687 0.001 1 49 127
    i 8.228 184.749 0.001 1 49 127
    i 9.838 184.749 0.001 1 49 127
    i 11.280 184.760 -1.000 1 36 86
    i -11.279 184.768 0
    i 9.839 184.812 0.001 1 49 127
    i 8.229 184.875 0.001 1 49 127
    i 9.840 184.875 0.001 1 49 127
    i 9.841 184.937 0.001 1 49 127
    i 4.209 185.000 0.001 1 37 127
    i 10.185 185.000 -1.000 1 72 127
    i 9.842 185.000 0.001 1 49 127
    i 10.186 185.000 -1.000 1 76 127
    i 8.230 185.000 0.001 1 49 127
    i 9.843 185.061 0.001 1 49 127
    i 8.231 185.124 0.001 1 49 127
    i 9.844 185.124 0.001 1 49 127
    i 9.845 185.187 0.001 1 49 127
    i 8.232 185.249 0.001 1 49 127
    i 9.846 185.249 0.001 1 49 127
    i -11.280 185.257 0
    i 11.281 185.259 -1.000 1 33 74
    i 9.847 185.312 0.001 1 49 127
    i 8.233 185.375 0.001 1 49 127
    i 9.848 185.375 0.001 1 49 127
    i 9.849 185.437 0.001 1 49 127
    i 7.149 185.500 0.001 1 39 127
    i 9.850 185.500 0.001 1 49 127
    i 8.234 185.500 0.001 1 49 127
    i 4.210 185.500 0.001 1 37 127
    i 11.282 185.508 -1.000 1 36 91
    i -11.281 185.517 0
    i 9.851 185.561 0.001 1 49 127
    i 8.235 185.624 0.001 1 49 127
    i 9.852 185.624 0.001 1 49 127
    i 9.853 185.687 0.001 1 49 127
    i 9.854 185.749 0.001 1 49 127
    i 5.123 185.749 0.001 1 37 127
    i 6.123 185.749 0.001 1 37 127
    i 8.236 185.749 0.001 1 49 127
    i 9.855 185.812 0.001 1 49 127
    i 9.856 185.875 0.001 1 49 127
    i 8.237 185.875 0.001 1 49 113
    i 9.857 185.937 0.001 1 49 127
    i 4.211 186.000 0.001 1 37 127
    i -11.282 185.999 0
    i 8.238 186.000 0.001 1 49 127
    i 6.124 186.000 0.001 1 37 127
    i 5.124 186.000 0.001 1 37 127
    i -10.185 186.000 0
    i -10.186 186.000 0
    i 9.858 186.000 0.001 1 49 127
    i 11.283 186.000 -1.000 1 38 83
    i 9.859 186.061 0.001 1 49 127
    i 8.239 186.124 0.001 1 49 127
    i 9.860 186.124 0.001 1 49 127
    i 9.861 186.187 0.001 1 49 127
    i 9.862 186.249 0.001 1 49 127
    i 8.240 186.249 0.001 1 49 127
    i 9.863 186.312 0.001 1 49 127
    i 9.864 186.375 0.001 1 49 127
    i 8.241 186.375 0.001 1 49 127
    i 9.865 186.437 0.001 1 49 127
    i 4.212 186.500 0.001 1 37 127
    i 8.242 186.500 0.001 1 49 127
    i 7.150 186.500 0.001 1 39 127
    i 9.866 186.500 0.001 1 49 127
    i 9.867 186.561 0.001 1 49 127
    i 9.868 186.624 0.001 1 49 127
    i 8.243 186.624 0.001 1 49 127
    i 9.869 186.687 0.001 1 49 127
    i 11.284 186.737 -1.000 1 41 103
    i -11.283 186.756 0
    i 9.870 186.749 0.001 1 49 127
    i 8.244 186.749 0.001 1 49 127
    i 9.871 186.812 0.001 1 49 127
    i 8.245 186.875 0.001 1 49 127
    i 9.872 186.875 0.001 1 49 127
    i 9.873 186.937 0.001 1 49 127
    i 9.874 187.000 0.001 1 49 127
    i 8.246 187.000 0.001 1 49 127
    i 4.213 187.000 0.001 1 37 127
    i 10.187 187.000 -1.000 1 72 127
    i 10.188 187.000 -1.000 1 76 127
    i 9.875 187.061 0.001 1 49 127
    i 8.247 187.124 0.001 1 49 127
    i 9.876 187.124 0.001 1 49 127
    i 9.877 187.187 0.001 1 49 127
    i 11.285 187.223 -1.000 1 44 76
    i -11.284 187.235 0
    i 8.248 187.249 0.001 1 49 127
    i 9.878 187.249 0.001 1 49 127
    i 9.879 187.312 0.001 1 49 127
    i 8.249 187.375 0.001 1 49 127
    i 9.880 187.375 0.001 1 49 127
    i 9.881 187.437 0.001 1 49 127
    i 8.250 187.500 0.001 1 49 127
    i 9.882 187.500 0.001 1 49 127
    i 7.151 187.500 0.001 1 39 127
    i 4.214 187.500 0.001 1 37 127
    i -11.285 187.523 0
    i 11.286 187.523 -1.000 1 43 89
    i 9.883 187.561 0.001 1 49 127
    i 9.884 187.624 0.001 1 49 127
    i 8.251 187.624 0.001 1 49 127
    i 9.885 187.687 0.001 1 49 127
    i 6.125 187.749 0.001 1 37 127
    i 5.125 187.749 0.001 1 37 127
    i 8.252 187.749 0.001 1 49 127
    i 9.886 187.749 0.001 1 49 127
    i 9.887 187.812 0.001 1 49 127
    i 8.253 187.875 0.001 1 49 113
    i 9.888 187.875 0.001 1 49 127
    i 9.889 187.937 0.001 1 49 127
    i -11.286 187.997 0
    i 4.215 188.000 0.001 1 37 127
    i 6.126 188.000 0.001 1 37 127
    i 5.126 188.000 0.001 1 37 127
    i 9.890 188.000 0.001 1 49 127
    i 8.254 188.000 0.001 1 49 127
    i -10.187 187.999 0
    i 11.287 187.997 -1.000 1 41 97
    i -10.188 187.999 0
    i 9.891 188.061 0.001 1 49 127
    i 8.255 188.124 0.001 1 49 127
    i 9.892 188.124 0.001 1 49 127
    i 9.893 188.187 0.001 1 49 127
    i 8.256 188.249 0.001 1 49 127
    i 9.894 188.249 0.001 1 49 127
    i 9.895 188.312 0.001 1 49 127
    i 8.257 188.375 0.001 1 49 127
    i 9.896 188.375 0.001 1 49 127
    i 9.897 188.437 0.001 1 49 127
    i 4.216 188.500 0.001 1 37 127
    i 8.258 188.500 0.001 1 49 127
    i 9.898 188.500 0.001 1 49 127
    i 7.152 188.500 0.001 1 39 127
    i 9.899 188.561 0.001 1 49 127
    i 9.900 188.624 0.001 1 49 127
    i 8.259 188.624 0.001 1 49 127
    i 9.901 188.687 0.001 1 49 127
    i 8.260 188.749 0.001 1 49 127
    i 9.902 188.749 0.001 1 49 127
    i -11.287 188.756 0
    i 11.288 188.759 -1.000 1 38 80
    i 9.903 188.812 0.001 1 49 127
    i 9.904 188.875 0.001 1 49 127
    i 8.261 188.875 0.001 1 49 127
    i 9.905 188.937 0.001 1 49 127
    i 4.217 189.000 0.001 1 37 127
    i 10.189 189.000 -1.000 1 72 127
    i 9.906 189.000 0.001 1 49 127
    i 8.262 189.000 0.001 1 49 127
    i 10.190 189.000 -1.000 1 76 127
    i 9.907 189.061 0.001 1 49 127
    i 8.263 189.124 0.001 1 49 127
    i 9.908 189.124 0.001 1 49 127
    i 9.909 189.187 0.001 1 49 127
    i 11.289 189.205 -1.000 1 33 79
    i -11.288 189.229 0
    i 9.910 189.249 0.001 1 49 127
    i 8.264 189.249 0.001 1 49 127
    i 9.911 189.312 0.001 1 49 127
    i 9.912 189.375 0.001 1 49 127
    i 8.265 189.375 0.001 1 49 127
    i 9.913 189.437 0.001 1 49 127
    i 7.153 189.500 0.001 1 39 127
    i 4.218 189.500 0.001 1 37 127
    i 8.266 189.500 0.001 1 49 127
    i 9.914 189.500 0.001 1 49 127
    i 11.290 189.507 -1.000 1 36 89
    i -11.289 189.508 0
    i 9.915 189.561 0.001 1 49 127
    i 8.267 189.624 0.001 1 49 127
    i 9.916 189.624 0.001 1 49 127
    i 9.917 189.687 0.001 1 49 127
    i 9.918 189.749 0.001 1 49 127
    i 8.268 189.749 0.001 1 49 127
    i 6.127 189.749 0.001 1 37 127
    i 5.127 189.749 0.001 1 37 127
    i 9.919 189.812 0.001 1 49 127
    i 8.269 189.875 0.001 1 49 113
    i 9.920 189.875 0.001 1 49 127
    i 9.921 189.937 0.001 1 49 127
    i 6.128 190.000 0.001 1 37 127
    i 5.128 190.000 0.001 1 37 127
    i -10.189 190.000 0
    i -11.290 189.999 0
    i 9.922 190.000 0.001 1 49 127
    i -10.190 190.000 0
    i 11.291 190.000 -1.000 1 38 83
    i 9.923 190.061 0.001 1 49 127
    i 9.924 190.124 0.001 1 49 127
    i 9.925 190.187 0.001 1 49 127
    i 9.926 190.249 0.001 1 49 127
    i -11.291 190.312 0
    i 9.927 190.312 0.001 1 49 127
    i 9.928 190.375 0.001 1 49 127
    i 9.929 190.437 0.001 1 49 127
    i 9.930 190.500 0.001 1 49 127
    i 9.931 190.561 0.001 1 49 127
    i 9.932 190.624 0.001 1 49 127
    i 9.933 190.687 0.001 1 49 127
    i 9.934 190.749 0.001 1 49 127
    i 9.935 190.812 0.001 1 49 127
    i 9.936 190.875 0.001 1 49 127
    i 9.937 190.937 0.001 1 49 127
    i 9.938 191.000 0.001 1 49 127
    i 10.191 191.000 -1.000 1 72 127
    i 10.192 191.000 -1.000 1 76 127
    i 9.939 191.061 0.001 1 49 127
    i 9.940 191.124 0.001 1 49 127
    i 9.941 191.187 0.001 1 49 127
    i 9.942 191.249 0.001 1 49 127
    i 9.943 191.312 0.001 1 49 127
    i 9.944 191.375 0.001 1 49 127
    i 9.945 191.437 0.001 1 49 127
    i 9.946 191.500 0.001 1 49 127
    i 9.947 191.561 0.001 1 49 127
    i 9.948 191.624 0.001 1 49 127
    i 9.949 191.687 0.001 1 49 127
    i 5.129 191.749 0.001 1 37 127
    i 6.129 191.749 0.001 1 37 127
    i 9.950 191.749 0.001 1 49 127
    i 9.951 191.812 0.001 1 49 127
    i 9.952 191.875 0.001 1 49 127
    i 9.953 191.937 0.001 1 49 127
    i 5.130 192.000 0.001 1 37 127
    i 6.130 192.000 0.001 1 37 127
    i 9.954 192.000 0.001 1 49 127
    i -10.191 191.999 0
    i -10.192 191.999 0
    i 9.955 192.061 0.001 1 49 127
    i 9.956 192.124 0.001 1 49 127
    i 9.957 192.187 0.001 1 49 127
    i 9.958 192.249 0.001 1 49 127
    i 9.959 192.312 0.001 1 49 127
    i 9.960 192.375 0.001 1 49 127
    i 9.961 192.437 0.001 1 49 127
    i 9.962 192.500 0.001 1 49 127
    i 9.963 192.561 0.001 1 49 127
    i 9.964 192.624 0.001 1 49 127
    i 9.965 192.687 0.001 1 49 127
    i 9.966 192.749 0.001 1 49 127
    i 9.967 192.812 0.001 1 49 127
    i 9.968 192.875 0.001 1 49 127
    i 9.969 192.937 0.001 1 49 127
    i 9.970 193.000 0.001 1 49 127
    i 10.193 193.000 -1.000 1 72 127
    i 10.194 193.000 -1.000 1 76 127
    i 9.971 193.061 0.001 1 49 127
    i 9.972 193.124 0.001 1 49 127
    i 9.973 193.187 0.001 1 49 127
    i 9.974 193.249 0.001 1 49 127
    i 9.975 193.312 0.001 1 49 127
    i 9.976 193.375 0.001 1 49 127
    i 9.977 193.437 0.001 1 49 127
    i 9.978 193.500 0.001 1 49 127
    i 9.979 193.561 0.001 1 49 127
    i 9.980 193.624 0.001 1 49 127
    i 9.981 193.687 0.001 1 49 127
    i 9.982 193.749 0.001 1 49 127
    i 9.983 193.812 0.001 1 49 127
    i 9.984 193.875 0.001 1 49 127
    i 9.985 193.937 0.001 1 49 127
    i 5.131 194.000 0.001 1 37 127
    i 6.131 194.000 0.001 1 37 127
    i 9.986 194.000 0.001 1 49 127
    i -10.193 194.000 0
    i -10.194 194.000 0
    i 9.987 194.061 0.001 1 49 127
    i 9.988 194.124 0.001 1 49 127
    i 9.989 194.187 0.001 1 49 127
    i 9.990 194.249 0.001 1 49 127
    i 9.991 194.312 0.001 1 49 127
    i 9.992 194.375 0.001 1 49 127
    i 9.993 194.437 0.001 1 49 127
    i 9.994 194.500 0.001 1 49 127
    i 9.995 194.561 0.001 1 49 127
    i 9.996 194.624 0.001 1 49 127
    i 9.997 194.687 0.001 1 49 127
    i 9.998 194.749 0.001 1 49 127
    i 9.999 194.812 0.001 1 49 127
    i 9.001 194.875 0.001 1 49 127
    i 9.002 194.937 0.001 1 49 127
    i 9.003 195.000 0.001 1 49 127
    i 10.195 195.000 -1.000 1 72 127
    i 10.196 195.000 -1.000 1 76 127
    i 9.004 195.061 0.001 1 49 127
    i 9.005 195.124 0.001 1 49 127
    i 9.006 195.187 0.001 1 49 127
    i 9.007 195.249 0.001 1 49 127
    i 9.008 195.312 0.001 1 49 127
    i 9.009 195.375 0.001 1 49 127
    i 9.010 195.437 0.001 1 49 127
    i 9.011 195.500 0.001 1 49 127
    i 9.012 195.561 0.001 1 49 127
    i 9.013 195.624 0.001 1 49 127
    i 9.014 195.687 0.001 1 49 127
    i 5.132 195.749 0.001 1 37 127
    i 6.132 195.749 0.001 1 37 127
    i 9.015 195.749 0.001 1 49 127
    i 9.016 195.812 0.001 1 49 127
    i 9.017 195.875 0.001 1 49 127
    i 9.018 195.937 0.001 1 49 127
    i 9.019 196.000 0.001 1 49 127
    i 6.133 196.000 0.001 1 37 127
    i 5.133 196.000 0.001 1 37 127
    i -10.195 195.999 0
    i -10.196 195.999 0
    i 9.020 196.061 0.001 1 49 127
    i 9.021 196.124 0.001 1 49 127
    i 9.022 196.187 0.001 1 49 127
    i 9.023 196.249 0.001 1 49 127
    i 9.024 196.312 0.001 1 49 127
    i 9.025 196.375 0.001 1 49 127
    i 9.026 196.437 0.001 1 49 127
    i 9.027 196.500 0.001 1 49 127
    i 9.028 196.561 0.001 1 49 127
    i 9.029 196.624 0.001 1 49 127
    i 9.030 196.687 0.001 1 49 127
    i 9.031 196.749 0.001 1 49 127
    i 9.032 196.812 0.001 1 49 127
    i 9.033 196.875 0.001 1 49 127
    i 9.034 196.937 0.001 1 49 127
    i 9.035 197.000 0.001 1 49 127
    i 10.197 197.000 -1.000 1 72 127
    i 10.198 197.000 -1.000 1 76 127
    i 9.036 197.061 0.001 1 49 127
    i 9.037 197.124 0.001 1 49 127
    i 9.038 197.187 0.001 1 49 127
    i 9.039 197.249 0.001 1 49 127
    i 9.040 197.312 0.001 1 49 127
    i 9.041 197.375 0.001 1 49 127
    i 9.042 197.437 0.001 1 49 127
    i 9.043 197.500 0.001 1 49 127
    i 9.044 197.561 0.001 1 49 127
    i 9.045 197.624 0.001 1 49 127
    i 9.046 197.687 0.001 1 49 127
    i 9.047 197.749 0.001 1 49 127
    i 9.048 197.812 0.001 1 49 127
    i 9.049 197.875 0.001 1 49 127
    i 9.050 197.937 0.001 1 49 127
    i -10.197 197.999 0
    i -10.198 197.999 0
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
    {"e274e9138ef048c4ba9c4d42e836c85c":[{"instanceName":"-"},{"note":{"onTime":9.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":10.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":11.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":12.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":13.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":14.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":15.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":16.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":17.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":18.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":19.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":20.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":21.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":22.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":23.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":24.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":25.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":26.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":27.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":28.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":29.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":30.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":31.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":32.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":33.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":34.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":35.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":36.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":37.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":38.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":39.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":40.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":41.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":42.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":43.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":44.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":45.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":46.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":47.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":48.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":65.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":66.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":67.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":68.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":69.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":70.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":71.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":72.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":73.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":74.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":75.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":76.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":77.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":78.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":79.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":80.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":81.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":82.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":83.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":84.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":85.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":86.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":87.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":88.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":89.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":90.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":91.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":92.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":93.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":94.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":95.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":96.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":97.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":98.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":99.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":100.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":101.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":102.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":103.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":104.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":105.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":106.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":107.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":108.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":109.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":110.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":111.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":112.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":126.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":128.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":129.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":130,"xyz":[0,0,-107.09]}},{"note":{"onTime":130.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":131,"xyz":[0,0,-107.09]}},{"note":{"onTime":131.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":132,"xyz":[0,0,-107.09]}},{"note":{"onTime":132.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":133,"xyz":[0,0,-107.09]}},{"note":{"onTime":133.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":134,"xyz":[0,0,-107.09]}},{"note":{"onTime":134.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":135,"xyz":[0,0,-107.09]}},{"note":{"onTime":135.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":136,"xyz":[0,0,-107.09]}},{"note":{"onTime":136.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":137,"xyz":[0,0,-107.09]}},{"note":{"onTime":137.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":138,"xyz":[0,0,-107.09]}},{"note":{"onTime":138.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":139,"xyz":[0,0,-107.09]}},{"note":{"onTime":139.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":140,"xyz":[0,0,-107.09]}},{"note":{"onTime":140.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":141,"xyz":[0,0,-107.09]}},{"note":{"onTime":141.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":142,"xyz":[0,0,-107.09]}},{"note":{"onTime":142.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":143,"xyz":[0,0,-107.09]}},{"note":{"onTime":143.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":144,"xyz":[0,0,-107.09]}},{"note":{"onTime":144.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":145,"xyz":[0,0,-107.09]}},{"note":{"onTime":145.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":146,"xyz":[0,0,-107.09]}},{"note":{"onTime":146.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":147,"xyz":[0,0,-107.09]}},{"note":{"onTime":147.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":148,"xyz":[0,0,-107.09]}},{"note":{"onTime":148.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":149,"xyz":[0,0,-107.09]}},{"note":{"onTime":149.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":150,"xyz":[0,0,-107.09]}},{"note":{"onTime":150.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":151,"xyz":[0,0,-107.09]}},{"note":{"onTime":151.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":152,"xyz":[0,0,-107.09]}},{"note":{"onTime":152.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":153,"xyz":[0,0,-107.09]}},{"note":{"onTime":153.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":154,"xyz":[0,0,-107.09]}},{"note":{"onTime":154.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":155,"xyz":[0,0,-107.09]}},{"note":{"onTime":155.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":156,"xyz":[0,0,-107.09]}},{"note":{"onTime":156.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":157,"xyz":[0,0,-107.09]}},{"note":{"onTime":157.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":158,"xyz":[0,0,-107.09]}},{"note":{"onTime":158.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":159,"xyz":[0,0,-107.09]}},{"note":{"onTime":159.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":160,"xyz":[0,0,-107.09]}},{"note":{"onTime":160.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":161,"xyz":[0,0,-107.09]}},{"note":{"onTime":161.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":162,"xyz":[0,0,-107.09]}},{"note":{"onTime":162.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":163,"xyz":[0,0,-107.09]}},{"note":{"onTime":163.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":164,"xyz":[0,0,-107.09]}},{"note":{"onTime":164.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":165,"xyz":[0,0,-107.09]}},{"note":{"onTime":165.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":166,"xyz":[0,0,-107.09]}},{"note":{"onTime":166.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":167,"xyz":[0,0,-107.09]}},{"note":{"onTime":167.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":168,"xyz":[0,0,-107.09]}},{"note":{"onTime":168.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":169,"xyz":[0,0,-107.09]}},{"note":{"onTime":169.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":170,"xyz":[0,0,-107.09]}},{"note":{"onTime":170.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":171,"xyz":[0,0,-107.09]}},{"note":{"onTime":171.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":172,"xyz":[0,0,-107.09]}},{"note":{"onTime":172.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":173,"xyz":[0,0,-107.09]}},{"note":{"onTime":173.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":174,"xyz":[0,0,-107.09]}},{"note":{"onTime":174.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":175,"xyz":[0,0,-107.09]}},{"note":{"onTime":175.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":176,"xyz":[0,0,-107.09]}},{"note":{"onTime":176.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":177,"xyz":[0,0,-107.09]}},{"note":{"onTime":177.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":178,"xyz":[0,0,-107.09]}},{"note":{"onTime":178.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":179,"xyz":[0,0,-107.09]}},{"note":{"onTime":179.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":180,"xyz":[0,0,-107.09]}},{"note":{"onTime":180.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":181,"xyz":[0,0,-107.09]}},{"note":{"onTime":181.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":182,"xyz":[0,0,-107.09]}},{"note":{"onTime":182.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":183,"xyz":[0,0,-107.09]}},{"note":{"onTime":183.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":184,"xyz":[0,0,-107.09]}},{"note":{"onTime":184.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":185,"xyz":[0,0,-107.09]}},{"note":{"onTime":185.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":186,"xyz":[0,0,-107.09]}},{"note":{"onTime":186.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":187,"xyz":[0,0,-107.09]}},{"note":{"onTime":187.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":188,"xyz":[0,0,-107.09]}},{"note":{"onTime":188.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":189,"xyz":[0,0,-107.09]}},{"note":{"onTime":189.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":190,"xyz":[0,0,-107.09]}},{"note":{"onTime":190.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":191,"xyz":[0,0,-107.09]}},{"note":{"onTime":191.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":192,"xyz":[0,0,-107.09]}},{"note":{"onTime":192.5,"xyz":[0,0,-107.09]}},{"note":{"onTime":193,"xyz":[0,0,-107.09]}}],"8aac7747b6b44366b1080319e34a8616":[{"instanceName":"-"},{"note":{"onTime":49.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":51.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":51.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":53.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":55.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":55.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":57.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":59.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":59.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":61.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":63.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":63.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":65.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":67.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":67.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":69.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":71.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":71.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":73.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":75.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":75.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":77.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":79.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":79.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":81.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":83.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":83.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":85.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":87.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":87.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":89.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":91.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":91.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":93.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":95.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":95.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":97.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":99.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":99.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":101.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":103.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":103.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":105.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":107.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":107.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":109.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":111.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":111.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":113.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":115.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":115.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":117.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":119.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":119.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":121.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":121.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":123.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":123.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":125.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":125.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":127.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":127.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":129.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":129.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":131.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":131.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":133.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":133.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":135.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":135.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":137.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":137.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":139.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":139.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":141.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":141.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":143.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":143.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":145.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":145.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":147.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":147.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":149.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":149.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":151.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":151.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":153.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":153.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":155.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":155.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":157.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":157.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":159.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":159.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":161.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":161.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":163.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":163.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":165.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":165.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":167.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":167.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":169.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":169.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":171.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":171.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":173.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":173.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":175.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":175.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":177.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":177.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":179.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":179.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":181.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":181.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":183.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":183.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":185.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":185.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":187.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":187.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":189.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":189.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":191.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":191.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":193.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":193.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":195.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":195.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":197.5,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":199.25,"xyz":[-92.72,0,53.54]}},{"note":{"onTime":199.5,"xyz":[-92.72,0,53.54]}}],"8e12ccc0dff44a4283211d553199a8cd":[{"instanceName":"-"},{"note":{"onTime":49.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":51.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":51.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":53.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":55.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":55.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":57.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":59.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":59.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":61.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":63.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":63.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":65.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":67.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":67.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":69.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":71.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":71.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":73.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":75.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":75.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":77.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":79.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":79.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":81.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":83.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":83.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":85.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":87.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":87.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":89.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":91.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":91.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":93.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":95.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":95.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":97.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":99.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":99.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":101.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":103.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":103.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":105.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":107.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":107.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":109.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":111.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":111.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":113.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":115.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":115.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":117.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":119.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":119.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":121.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":121.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":123.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":123.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":125.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":125.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":127.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":127.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":129.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":129.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":131.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":131.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":133.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":133.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":135.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":135.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":137.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":137.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":139.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":139.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":141.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":141.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":143.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":143.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":145.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":145.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":147.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":147.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":149.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":149.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":151.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":151.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":153.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":153.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":155.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":155.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":157.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":157.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":159.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":159.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":161.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":161.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":163.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":163.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":165.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":165.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":167.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":167.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":169.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":169.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":171.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":171.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":173.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":173.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":175.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":175.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":177.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":177.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":179.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":179.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":181.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":181.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":183.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":183.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":185.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":185.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":187.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":187.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":189.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":189.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":191.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":191.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":193.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":193.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":195.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":195.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":197.5,"xyz":[92.72,0,53.54]}},{"note":{"onTime":199.25,"xyz":[92.72,0,53.54]}},{"note":{"onTime":199.5,"xyz":[92.72,0,53.54]}}],"6aecd056fd3f4c6d9a108de531c48ddf":[{"instanceName":"-"},{"note":{"onTime":10,"xyz":[0,0,0]}},{"note":{"onTime":11,"xyz":[0,0,0]}},{"note":{"onTime":12,"xyz":[0,0,0]}},{"note":{"onTime":13,"xyz":[0,0,0]}},{"note":{"onTime":14,"xyz":[0,0,0]}},{"note":{"onTime":15,"xyz":[0,0,0]}},{"note":{"onTime":16,"xyz":[0,0,0]}},{"note":{"onTime":17,"xyz":[0,0,0]}},{"note":{"onTime":18,"xyz":[0,0,0]}},{"note":{"onTime":19,"xyz":[0,0,0]}},{"note":{"onTime":20,"xyz":[0,0,0]}},{"note":{"onTime":21,"xyz":[0,0,0]}},{"note":{"onTime":22,"xyz":[0,0,0]}},{"note":{"onTime":23,"xyz":[0,0,0]}},{"note":{"onTime":24,"xyz":[0,0,0]}},{"note":{"onTime":25,"xyz":[0,0,0]}},{"note":{"onTime":26,"xyz":[0,0,0]}},{"note":{"onTime":27,"xyz":[0,0,0]}},{"note":{"onTime":28,"xyz":[0,0,0]}},{"note":{"onTime":29,"xyz":[0,0,0]}},{"note":{"onTime":30,"xyz":[0,0,0]}},{"note":{"onTime":31,"xyz":[0,0,0]}},{"note":{"onTime":32,"xyz":[0,0,0]}},{"note":{"onTime":33,"xyz":[0,0,0]}},{"note":{"onTime":34,"xyz":[0,0,0]}},{"note":{"onTime":35,"xyz":[0,0,0]}},{"note":{"onTime":36,"xyz":[0,0,0]}},{"note":{"onTime":37,"xyz":[0,0,0]}},{"note":{"onTime":38,"xyz":[0,0,0]}},{"note":{"onTime":39,"xyz":[0,0,0]}},{"note":{"onTime":40,"xyz":[0,0,0]}},{"note":{"onTime":41,"xyz":[0,0,0]}},{"note":{"onTime":42,"xyz":[0,0,0]}},{"note":{"onTime":43,"xyz":[0,0,0]}},{"note":{"onTime":44,"xyz":[0,0,0]}},{"note":{"onTime":45,"xyz":[0,0,0]}},{"note":{"onTime":46,"xyz":[0,0,0]}},{"note":{"onTime":47,"xyz":[0,0,0]}},{"note":{"onTime":48,"xyz":[0,0,0]}},{"note":{"onTime":49,"xyz":[0,0,0]}},{"note":{"onTime":66,"xyz":[0,0,0]}},{"note":{"onTime":67,"xyz":[0,0,0]}},{"note":{"onTime":68,"xyz":[0,0,0]}},{"note":{"onTime":69,"xyz":[0,0,0]}},{"note":{"onTime":70,"xyz":[0,0,0]}},{"note":{"onTime":71,"xyz":[0,0,0]}},{"note":{"onTime":72,"xyz":[0,0,0]}},{"note":{"onTime":73,"xyz":[0,0,0]}},{"note":{"onTime":74,"xyz":[0,0,0]}},{"note":{"onTime":75,"xyz":[0,0,0]}},{"note":{"onTime":76,"xyz":[0,0,0]}},{"note":{"onTime":77,"xyz":[0,0,0]}},{"note":{"onTime":78,"xyz":[0,0,0]}},{"note":{"onTime":79,"xyz":[0,0,0]}},{"note":{"onTime":80,"xyz":[0,0,0]}},{"note":{"onTime":81,"xyz":[0,0,0]}},{"note":{"onTime":82,"xyz":[0,0,0]}},{"note":{"onTime":83,"xyz":[0,0,0]}},{"note":{"onTime":84,"xyz":[0,0,0]}},{"note":{"onTime":85,"xyz":[0,0,0]}},{"note":{"onTime":86,"xyz":[0,0,0]}},{"note":{"onTime":87,"xyz":[0,0,0]}},{"note":{"onTime":88,"xyz":[0,0,0]}},{"note":{"onTime":89,"xyz":[0,0,0]}},{"note":{"onTime":90,"xyz":[0,0,0]}},{"note":{"onTime":91,"xyz":[0,0,0]}},{"note":{"onTime":92,"xyz":[0,0,0]}},{"note":{"onTime":93,"xyz":[0,0,0]}},{"note":{"onTime":94,"xyz":[0,0,0]}},{"note":{"onTime":95,"xyz":[0,0,0]}},{"note":{"onTime":96,"xyz":[0,0,0]}},{"note":{"onTime":97,"xyz":[0,0,0]}},{"note":{"onTime":98,"xyz":[0,0,0]}},{"note":{"onTime":99,"xyz":[0,0,0]}},{"note":{"onTime":100,"xyz":[0,0,0]}},{"note":{"onTime":101,"xyz":[0,0,0]}},{"note":{"onTime":102,"xyz":[0,0,0]}},{"note":{"onTime":103,"xyz":[0,0,0]}},{"note":{"onTime":104,"xyz":[0,0,0]}},{"note":{"onTime":105,"xyz":[0,0,0]}},{"note":{"onTime":106,"xyz":[0,0,0]}},{"note":{"onTime":107,"xyz":[0,0,0]}},{"note":{"onTime":108,"xyz":[0,0,0]}},{"note":{"onTime":109,"xyz":[0,0,0]}},{"note":{"onTime":110,"xyz":[0,0,0]}},{"note":{"onTime":111,"xyz":[0,0,0]}},{"note":{"onTime":112,"xyz":[0,0,0]}},{"note":{"onTime":113,"xyz":[0,0,0]}},{"note":{"onTime":129,"xyz":[0,0,0]}},{"note":{"onTime":130,"xyz":[0,0,0]}},{"note":{"onTime":131,"xyz":[0,0,0]}},{"note":{"onTime":132,"xyz":[0,0,0]}},{"note":{"onTime":133,"xyz":[0,0,0]}},{"note":{"onTime":134,"xyz":[0,0,0]}},{"note":{"onTime":135,"xyz":[0,0,0]}},{"note":{"onTime":136,"xyz":[0,0,0]}},{"note":{"onTime":137,"xyz":[0,0,0]}},{"note":{"onTime":138,"xyz":[0,0,0]}},{"note":{"onTime":139,"xyz":[0,0,0]}},{"note":{"onTime":140,"xyz":[0,0,0]}},{"note":{"onTime":141,"xyz":[0,0,0]}},{"note":{"onTime":142,"xyz":[0,0,0]}},{"note":{"onTime":143,"xyz":[0,0,0]}},{"note":{"onTime":144,"xyz":[0,0,0]}},{"note":{"onTime":145,"xyz":[0,0,0]}},{"note":{"onTime":146,"xyz":[0,0,0]}},{"note":{"onTime":147,"xyz":[0,0,0]}},{"note":{"onTime":148,"xyz":[0,0,0]}},{"note":{"onTime":149,"xyz":[0,0,0]}},{"note":{"onTime":150,"xyz":[0,0,0]}},{"note":{"onTime":151,"xyz":[0,0,0]}},{"note":{"onTime":152,"xyz":[0,0,0]}},{"note":{"onTime":153,"xyz":[0,0,0]}},{"note":{"onTime":154,"xyz":[0,0,0]}},{"note":{"onTime":155,"xyz":[0,0,0]}},{"note":{"onTime":156,"xyz":[0,0,0]}},{"note":{"onTime":157,"xyz":[0,0,0]}},{"note":{"onTime":158,"xyz":[0,0,0]}},{"note":{"onTime":159,"xyz":[0,0,0]}},{"note":{"onTime":160,"xyz":[0,0,0]}},{"note":{"onTime":161,"xyz":[0,0,0]}},{"note":{"onTime":162,"xyz":[0,0,0]}},{"note":{"onTime":163,"xyz":[0,0,0]}},{"note":{"onTime":164,"xyz":[0,0,0]}},{"note":{"onTime":165,"xyz":[0,0,0]}},{"note":{"onTime":166,"xyz":[0,0,0]}},{"note":{"onTime":167,"xyz":[0,0,0]}},{"note":{"onTime":168,"xyz":[0,0,0]}},{"note":{"onTime":169,"xyz":[0,0,0]}},{"note":{"onTime":170,"xyz":[0,0,0]}},{"note":{"onTime":171,"xyz":[0,0,0]}},{"note":{"onTime":172,"xyz":[0,0,0]}},{"note":{"onTime":173,"xyz":[0,0,0]}},{"note":{"onTime":174,"xyz":[0,0,0]}},{"note":{"onTime":175,"xyz":[0,0,0]}},{"note":{"onTime":176,"xyz":[0,0,0]}},{"note":{"onTime":177,"xyz":[0,0,0]}},{"note":{"onTime":178,"xyz":[0,0,0]}},{"note":{"onTime":179,"xyz":[0,0,0]}},{"note":{"onTime":180,"xyz":[0,0,0]}},{"note":{"onTime":181,"xyz":[0,0,0]}},{"note":{"onTime":182,"xyz":[0,0,0]}},{"note":{"onTime":183,"xyz":[0,0,0]}},{"note":{"onTime":184,"xyz":[0,0,0]}},{"note":{"onTime":185,"xyz":[0,0,0]}},{"note":{"onTime":186,"xyz":[0,0,0]}},{"note":{"onTime":187,"xyz":[0,0,0]}},{"note":{"onTime":188,"xyz":[0,0,0]}},{"note":{"onTime":189,"xyz":[0,0,0]}},{"note":{"onTime":190,"xyz":[0,0,0]}},{"note":{"onTime":191,"xyz":[0,0,0]}},{"note":{"onTime":192,"xyz":[0,0,0]}},{"note":{"onTime":193,"xyz":[0,0,0]}}],"e3e7d57082834a28b53e021beaeb783d":[{"instanceName":"-"},{"note":{"onTime":5.5,"xyz":[76.575,20,-41.732]}},{"note":{"onTime":5.625,"xyz":[85.142,20,-77.018]}},{"note":{"onTime":5.75,"xyz":[-98.899,20,0.763]}},{"note":{"onTime":5.875,"xyz":[22.912,20,73.484]}},{"note":{"onTime":6,"xyz":[79.449,20,12.289]}},{"note":{"onTime":6.125,"xyz":[40.222,20,-8.918]}},{"note":{"onTime":6.25,"xyz":[42.486,20,-97.556]}},{"note":{"onTime":6.375,"xyz":[51.69,20,51.698]}},{"note":{"onTime":6.5,"xyz":[-46.879,20,-39.526]}},{"note":{"onTime":6.625,"xyz":[-94.356,20,12.151]}},{"note":{"onTime":6.75,"xyz":[85.474,20,-19.716]}},{"note":{"onTime":6.875,"xyz":[21.588,20,60.273]}},{"note":{"onTime":7,"xyz":[-12.961,20,36.429]}},{"note":{"onTime":7.125,"xyz":[74.731,20,-76.198]}},{"note":{"onTime":7.25,"xyz":[64.492,20,-10.794]}},{"note":{"onTime":7.375,"xyz":[93.219,20,-58.801]}},{"note":{"onTime":7.5,"xyz":[83.75,20,46.966]}},{"note":{"onTime":7.625,"xyz":[-16.314,20,47.499]}},{"note":{"onTime":7.75,"xyz":[-75.084,20,-36.212]}},{"note":{"onTime":7.875,"xyz":[-49.256,20,78.324]}},{"note":{"onTime":8,"xyz":[-17.272,20,-99.381]}},{"note":{"onTime":8.125,"xyz":[-73.948,20,45.195]}},{"note":{"onTime":8.25,"xyz":[53.147,20,28.023]}},{"note":{"onTime":8.375,"xyz":[-27.426,20,85.243]}},{"note":{"onTime":8.5,"xyz":[-3.301,20,-1.343]}},{"note":{"onTime":8.625,"xyz":[79.66,20,38.476]}},{"note":{"onTime":8.75,"xyz":[-80.803,20,67.588]}},{"note":{"onTime":8.875,"xyz":[14.572,20,55.692]}},{"note":{"onTime":9,"xyz":[60.475,20,88.602]}},{"note":{"onTime":9.125,"xyz":[-53.918,20,90.199]}},{"note":{"onTime":9.25,"xyz":[31.757,20,64.604]}},{"note":{"onTime":9.375,"xyz":[5.76,20,-23.564]}},{"note":{"onTime":9.5,"xyz":[92.277,20,-19.755]}},{"note":{"onTime":9.625,"xyz":[2.589,20,48.635]}},{"note":{"onTime":9.75,"xyz":[5.784,20,94.908]}},{"note":{"onTime":9.875,"xyz":[-43.481,20,-97.341]}},{"note":{"onTime":10,"xyz":[67.563,20,-75.839]}},{"note":{"onTime":10.125,"xyz":[-33.402,20,-45.893]}},{"note":{"onTime":10.25,"xyz":[-57.426,20,-12.183]}},{"note":{"onTime":10.375,"xyz":[-20.708,20,95.858]}},{"note":{"onTime":10.5,"xyz":[5.361,20,52.721]}},{"note":{"onTime":10.625,"xyz":[72.63,20,8.132]}},{"note":{"onTime":10.75,"xyz":[-77.66,20,48.389]}},{"note":{"onTime":10.875,"xyz":[-78.21,20,-75.769]}},{"note":{"onTime":11,"xyz":[67.092,20,83.616]}},{"note":{"onTime":11.125,"xyz":[-38.239,20,-94.939]}},{"note":{"onTime":11.25,"xyz":[9.293,20,42.197]}},{"note":{"onTime":11.375,"xyz":[12.692,20,-74.431]}},{"note":{"onTime":11.5,"xyz":[-32.1,20,85.864]}},{"note":{"onTime":11.625,"xyz":[-16.426,20,-73.779]}},{"note":{"onTime":11.75,"xyz":[-30.78,20,42.585]}},{"note":{"onTime":11.875,"xyz":[-80.15,20,32.644]}},{"note":{"onTime":12,"xyz":[-99.517,20,-91.671]}},{"note":{"onTime":12.125,"xyz":[-89.386,20,-3.445]}},{"note":{"onTime":12.25,"xyz":[99.558,20,-59.558]}},{"note":{"onTime":12.375,"xyz":[20.99,20,-38.896]}},{"note":{"onTime":12.5,"xyz":[-28.585,20,70.74]}},{"note":{"onTime":12.625,"xyz":[65.341,20,-96.239]}},{"note":{"onTime":12.75,"xyz":[-28.023,20,16.463]}},{"note":{"onTime":12.875,"xyz":[86.919,20,-40.141]}},{"note":{"onTime":13,"xyz":[-50.021,20,-82.8]}},{"note":{"onTime":13.125,"xyz":[59.584,20,79.935]}},{"note":{"onTime":13.25,"xyz":[87.456,20,-24.085]}},{"note":{"onTime":13.375,"xyz":[-22.777,20,-76.025]}},{"note":{"onTime":13.5,"xyz":[-70.506,20,32.206]}},{"note":{"onTime":13.625,"xyz":[-53.511,20,-54.29]}},{"note":{"onTime":13.75,"xyz":[43.86,20,45.905]}},{"note":{"onTime":13.875,"xyz":[-51.524,20,70.064]}},{"note":{"onTime":14,"xyz":[-98.858,20,-80.834]}},{"note":{"onTime":14.125,"xyz":[-15.021,20,16.898]}},{"note":{"onTime":14.25,"xyz":[16.02,20,-64.857]}},{"note":{"onTime":14.375,"xyz":[-25.062,20,-25.829]}},{"note":{"onTime":14.5,"xyz":[40.297,20,-58.592]}},{"note":{"onTime":14.625,"xyz":[16.704,20,-26.371]}},{"note":{"onTime":14.75,"xyz":[-51.689,20,56.208]}},{"note":{"onTime":14.875,"xyz":[81.759,20,-27.829]}},{"note":{"onTime":15,"xyz":[-94.646,20,-74.295]}},{"note":{"onTime":15.125,"xyz":[55.493,20,91.994]}},{"note":{"onTime":15.25,"xyz":[59.728,20,10.316]}},{"note":{"onTime":15.375,"xyz":[90.687,20,-77.344]}},{"note":{"onTime":15.5,"xyz":[-50.945,20,28.281]}},{"note":{"onTime":15.625,"xyz":[89.309,20,38.181]}},{"note":{"onTime":15.75,"xyz":[61.468,20,-65.419]}},{"note":{"onTime":15.875,"xyz":[-21.737,20,-67.677]}},{"note":{"onTime":16,"xyz":[-57.682,20,63.334]}},{"note":{"onTime":16.125,"xyz":[94.7,20,25.122]}},{"note":{"onTime":16.25,"xyz":[87.004,20,-88.212]}},{"note":{"onTime":16.375,"xyz":[46.531,20,43.872]}},{"note":{"onTime":16.5,"xyz":[-89.433,20,94.048]}},{"note":{"onTime":16.625,"xyz":[63.756,20,-68.371]}},{"note":{"onTime":16.75,"xyz":[-65.335,20,42.649]}},{"note":{"onTime":16.875,"xyz":[-93.761,20,86.387]}},{"note":{"onTime":17,"xyz":[-17.443,20,86.109]}},{"note":{"onTime":17.125,"xyz":[43.557,20,-15.964]}},{"note":{"onTime":17.25,"xyz":[22.715,20,-19.422]}},{"note":{"onTime":17.375,"xyz":[72.54,20,88.236]}},{"note":{"onTime":17.5,"xyz":[-48.296,20,23.722]}},{"note":{"onTime":17.625,"xyz":[0.339,20,56.931]}},{"note":{"onTime":17.75,"xyz":[-71.05,20,-26.802]}},{"note":{"onTime":17.875,"xyz":[52.456,20,-50.086]}},{"note":{"onTime":18,"xyz":[88.125,20,22.905]}},{"note":{"onTime":18.125,"xyz":[-3.162,20,10.677]}},{"note":{"onTime":18.25,"xyz":[-99.131,20,-30.71]}},{"note":{"onTime":18.375,"xyz":[94.645,20,33.908]}},{"note":{"onTime":18.5,"xyz":[98.605,20,-78.344]}},{"note":{"onTime":18.625,"xyz":[-42.723,20,17.49]}},{"note":{"onTime":18.75,"xyz":[41.436,20,-11.591]}},{"note":{"onTime":18.875,"xyz":[-56.649,20,84.053]}},{"note":{"onTime":19,"xyz":[16.015,20,-4.033]}},{"note":{"onTime":19.125,"xyz":[-35.517,20,-23.851]}},{"note":{"onTime":19.25,"xyz":[12.508,20,-29.634]}},{"note":{"onTime":19.375,"xyz":[2.968,20,15.689]}},{"note":{"onTime":19.5,"xyz":[-91.212,20,-2.819]}},{"note":{"onTime":19.625,"xyz":[94.511,20,68.261]}},{"note":{"onTime":19.75,"xyz":[39.973,20,-74.603]}},{"note":{"onTime":19.875,"xyz":[-20.88,20,-97.042]}},{"note":{"onTime":20,"xyz":[-18.547,20,30.85]}},{"note":{"onTime":20.125,"xyz":[73.28,20,-11.665]}},{"note":{"onTime":20.25,"xyz":[23.506,20,4.861]}},{"note":{"onTime":20.375,"xyz":[66.554,20,15.13]}},{"note":{"onTime":20.5,"xyz":[65.651,20,83.692]}},{"note":{"onTime":20.625,"xyz":[95.713,20,86.361]}},{"note":{"onTime":20.75,"xyz":[-91.158,20,-15.554]}},{"note":{"onTime":20.875,"xyz":[99.534,20,-34.566]}},{"note":{"onTime":21,"xyz":[-26.35,20,-36.958]}},{"note":{"onTime":21.125,"xyz":[7.385,20,22.886]}},{"note":{"onTime":21.25,"xyz":[-77.463,20,-40.126]}},{"note":{"onTime":21.375,"xyz":[64.727,20,-27.617]}},{"note":{"onTime":21.5,"xyz":[-85.638,20,48.806]}},{"note":{"onTime":21.625,"xyz":[48.654,20,-63.402]}},{"note":{"onTime":21.75,"xyz":[69.237,20,55.098]}},{"note":{"onTime":21.875,"xyz":[-23.405,20,33.604]}},{"note":{"onTime":22,"xyz":[-28.142,20,57.914]}},{"note":{"onTime":22.125,"xyz":[-38.691,20,-75.603]}},{"note":{"onTime":22.25,"xyz":[91.441,20,-56.987]}},{"note":{"onTime":22.375,"xyz":[-84.713,20,12.169]}},{"note":{"onTime":22.5,"xyz":[46.381,20,21.274]}},{"note":{"onTime":22.625,"xyz":[57.706,20,33.978]}},{"note":{"onTime":22.75,"xyz":[91.767,20,-21.347]}},{"note":{"onTime":22.875,"xyz":[27.029,20,35.415]}},{"note":{"onTime":23,"xyz":[57.867,20,73.222]}},{"note":{"onTime":23.125,"xyz":[52.413,20,-31.092]}},{"note":{"onTime":23.25,"xyz":[17.72,20,-55.105]}},{"note":{"onTime":23.375,"xyz":[87.013,20,6.281]}},{"note":{"onTime":23.5,"xyz":[11.955,20,53.479]}},{"note":{"onTime":23.625,"xyz":[56.345,20,-93.798]}},{"note":{"onTime":23.75,"xyz":[8.955,20,10.667]}},{"note":{"onTime":23.875,"xyz":[24.79,20,27.131]}},{"note":{"onTime":24,"xyz":[-71.494,20,-78.397]}},{"note":{"onTime":24.125,"xyz":[-66.59,20,26.405]}},{"note":{"onTime":24.25,"xyz":[7.042,20,-98.357]}},{"note":{"onTime":24.375,"xyz":[12.159,20,-63.917]}},{"note":{"onTime":24.5,"xyz":[32.619,20,-16.062]}},{"note":{"onTime":24.625,"xyz":[19.646,20,-43.834]}},{"note":{"onTime":24.75,"xyz":[27.736,20,83.455]}},{"note":{"onTime":24.875,"xyz":[-86.443,20,-44.163]}},{"note":{"onTime":25,"xyz":[8.143,20,-66.924]}},{"note":{"onTime":25.125,"xyz":[4.865,20,-76.68]}},{"note":{"onTime":25.25,"xyz":[95.738,20,-42.611]}},{"note":{"onTime":25.375,"xyz":[98.954,20,55.007]}},{"note":{"onTime":25.5,"xyz":[-86.302,20,99.8]}},{"note":{"onTime":25.625,"xyz":[-23.212,20,24.462]}},{"note":{"onTime":25.75,"xyz":[41.962,20,68.591]}},{"note":{"onTime":25.875,"xyz":[19.237,20,21.941]}},{"note":{"onTime":26,"xyz":[-38.814,20,-82.455]}},{"note":{"onTime":26.125,"xyz":[27.694,20,5.029]}},{"note":{"onTime":26.25,"xyz":[-36.697,20,-73.229]}},{"note":{"onTime":26.375,"xyz":[-55.894,20,51.057]}},{"note":{"onTime":26.5,"xyz":[-43.192,20,-0.653]}},{"note":{"onTime":26.625,"xyz":[23.551,20,-48.124]}},{"note":{"onTime":26.75,"xyz":[-55.102,20,39.405]}},{"note":{"onTime":26.875,"xyz":[62.463,20,41.667]}},{"note":{"onTime":27,"xyz":[4.581,20,27.296]}},{"note":{"onTime":27.125,"xyz":[-64.336,20,98.355]}},{"note":{"onTime":27.25,"xyz":[44.896,20,-42.562]}},{"note":{"onTime":27.375,"xyz":[-54.7,20,9.306]}},{"note":{"onTime":27.5,"xyz":[72.352,20,54.493]}},{"note":{"onTime":27.625,"xyz":[-65.186,20,-58.109]}},{"note":{"onTime":27.75,"xyz":[-58.278,20,-66.514]}},{"note":{"onTime":27.875,"xyz":[-28.907,20,9.562]}},{"note":{"onTime":28,"xyz":[20.314,20,19.497]}},{"note":{"onTime":28.125,"xyz":[47.896,20,74.064]}},{"note":{"onTime":28.25,"xyz":[43.841,20,-7.457]}},{"note":{"onTime":28.375,"xyz":[-86.306,20,-25.6]}},{"note":{"onTime":28.5,"xyz":[92.022,20,73.285]}},{"note":{"onTime":28.625,"xyz":[-22.939,20,-76.817]}},{"note":{"onTime":28.75,"xyz":[62.027,20,15.18]}},{"note":{"onTime":28.875,"xyz":[92.715,20,60.994]}},{"note":{"onTime":29,"xyz":[67.909,20,-81.3]}},{"note":{"onTime":29.125,"xyz":[81.359,20,9.369]}},{"note":{"onTime":29.25,"xyz":[44.126,20,33.25]}},{"note":{"onTime":29.375,"xyz":[86.426,20,-86.948]}},{"note":{"onTime":29.5,"xyz":[81.3,20,-37.595]}},{"note":{"onTime":29.625,"xyz":[-79.125,20,-87.874]}},{"note":{"onTime":29.75,"xyz":[72.321,20,-61.909]}},{"note":{"onTime":29.875,"xyz":[7.141,20,34.649]}},{"note":{"onTime":30,"xyz":[96.929,20,79.338]}},{"note":{"onTime":30.125,"xyz":[-36.624,20,-49.573]}},{"note":{"onTime":30.25,"xyz":[22.9,20,1.229]}},{"note":{"onTime":30.375,"xyz":[-60.89,20,76.548]}},{"note":{"onTime":30.5,"xyz":[51.956,20,-10.336]}},{"note":{"onTime":30.625,"xyz":[53.443,20,-24.713]}},{"note":{"onTime":30.75,"xyz":[-11.477,20,7.581]}},{"note":{"onTime":30.875,"xyz":[-61.091,20,35.035]}},{"note":{"onTime":31,"xyz":[59.478,20,48.229]}},{"note":{"onTime":31.125,"xyz":[44.121,20,74.843]}},{"note":{"onTime":31.25,"xyz":[-37.018,20,1.158]}},{"note":{"onTime":31.375,"xyz":[-1.665,20,-36.758]}},{"note":{"onTime":31.5,"xyz":[74.55,20,46.51]}},{"note":{"onTime":31.625,"xyz":[-8.948,20,-8.07]}},{"note":{"onTime":31.75,"xyz":[-11.53,20,43.269]}},{"note":{"onTime":31.875,"xyz":[-30.213,20,-5.021]}},{"note":{"onTime":32,"xyz":[22.697,20,27.073]}},{"note":{"onTime":32.125,"xyz":[-90.88,20,54.164]}},{"note":{"onTime":32.25,"xyz":[-34.651,20,-16.776]}},{"note":{"onTime":32.375,"xyz":[54.167,20,81.06]}},{"note":{"onTime":32.5,"xyz":[-9.069,20,-89.479]}},{"note":{"onTime":32.625,"xyz":[91.59,20,16.514]}},{"note":{"onTime":32.75,"xyz":[-75.59,20,41.534]}},{"note":{"onTime":32.875,"xyz":[51.265,20,38.13]}},{"note":{"onTime":33,"xyz":[81.267,20,-65.048]}},{"note":{"onTime":33.125,"xyz":[-8.251,20,16.384]}},{"note":{"onTime":33.25,"xyz":[-38.355,20,5.62]}},{"note":{"onTime":33.375,"xyz":[-27.349,20,-90.003]}},{"note":{"onTime":33.5,"xyz":[-73.263,20,-92.092]}},{"note":{"onTime":33.625,"xyz":[67.048,20,41.191]}},{"note":{"onTime":33.75,"xyz":[35.507,20,38.011]}},{"note":{"onTime":33.875,"xyz":[17.064,20,41.456]}},{"note":{"onTime":34,"xyz":[69.907,20,70.831]}},{"note":{"onTime":34.125,"xyz":[-14.262,20,-91.558]}},{"note":{"onTime":34.25,"xyz":[26.679,20,97.049]}},{"note":{"onTime":34.375,"xyz":[-91.695,20,64.619]}},{"note":{"onTime":34.5,"xyz":[3.894,20,-23.985]}},{"note":{"onTime":34.625,"xyz":[-3.983,20,-41.688]}},{"note":{"onTime":34.75,"xyz":[60.338,20,-29.908]}},{"note":{"onTime":34.875,"xyz":[-4.373,20,-2.255]}},{"note":{"onTime":35,"xyz":[75.878,20,-23.94]}},{"note":{"onTime":35.125,"xyz":[57.666,20,58.723]}},{"note":{"onTime":35.25,"xyz":[90.922,20,-80.781]}},{"note":{"onTime":35.375,"xyz":[-83.374,20,56.564]}},{"note":{"onTime":35.5,"xyz":[53.119,20,-74.179]}},{"note":{"onTime":35.625,"xyz":[-63.809,20,-77.079]}},{"note":{"onTime":35.75,"xyz":[-50.606,20,-60.57]}},{"note":{"onTime":35.875,"xyz":[22.628,20,-21.892]}},{"note":{"onTime":36,"xyz":[-48.525,20,96.868]}},{"note":{"onTime":36.125,"xyz":[59.465,20,-60.444]}},{"note":{"onTime":36.25,"xyz":[53.01,20,29.349]}},{"note":{"onTime":36.375,"xyz":[-33.414,20,57.037]}},{"note":{"onTime":36.5,"xyz":[-73.584,20,-95.566]}},{"note":{"onTime":36.625,"xyz":[-63.134,20,-84.742]}},{"note":{"onTime":36.75,"xyz":[-22.419,20,74.432]}},{"note":{"onTime":36.875,"xyz":[53.465,20,94.472]}},{"note":{"onTime":37,"xyz":[26.538,20,46.871]}},{"note":{"onTime":37.125,"xyz":[-59.081,20,-70.283]}},{"note":{"onTime":37.25,"xyz":[92.243,20,-57.336]}},{"note":{"onTime":37.375,"xyz":[-46.864,20,59.316]}},{"note":{"onTime":37.5,"xyz":[9.58,20,57.599]}},{"note":{"onTime":37.625,"xyz":[51.438,20,-96.742]}},{"note":{"onTime":37.75,"xyz":[56.718,20,-7.234]}},{"note":{"onTime":37.875,"xyz":[-24.237,20,62.088]}},{"note":{"onTime":38,"xyz":[20.941,20,69.564]}},{"note":{"onTime":38.125,"xyz":[-37.838,20,76.925]}},{"note":{"onTime":38.25,"xyz":[-18.916,20,-5.104]}},{"note":{"onTime":38.375,"xyz":[-90.3,20,41.248]}},{"note":{"onTime":38.5,"xyz":[-65.306,20,-7.811]}},{"note":{"onTime":38.625,"xyz":[-50.096,20,5.052]}},{"note":{"onTime":38.75,"xyz":[48.039,20,63.855]}},{"note":{"onTime":38.875,"xyz":[21.874,20,-37.975]}},{"note":{"onTime":39,"xyz":[-42.9,20,-99.173]}},{"note":{"onTime":39.125,"xyz":[-93.818,20,60.347]}},{"note":{"onTime":39.25,"xyz":[-2.337,20,4.787]}},{"note":{"onTime":39.375,"xyz":[20.682,20,-72.25]}},{"note":{"onTime":39.5,"xyz":[92.629,20,38.714]}},{"note":{"onTime":39.625,"xyz":[-68.635,20,51.465]}},{"note":{"onTime":39.75,"xyz":[74.69,20,71.382]}},{"note":{"onTime":39.875,"xyz":[-18.624,20,3.675]}},{"note":{"onTime":40,"xyz":[72.47,20,31.423]}},{"note":{"onTime":40.125,"xyz":[91.315,20,-46.907]}},{"note":{"onTime":40.25,"xyz":[38.27,20,-63.416]}},{"note":{"onTime":40.375,"xyz":[33.959,20,-46.69]}},{"note":{"onTime":40.5,"xyz":[-54.452,20,-86.185]}},{"note":{"onTime":40.625,"xyz":[-63.478,20,-51.481]}},{"note":{"onTime":40.75,"xyz":[34.235,20,75.788]}},{"note":{"onTime":40.875,"xyz":[13.573,20,87.247]}},{"note":{"onTime":41,"xyz":[-67.958,20,-30.504]}},{"note":{"onTime":41.125,"xyz":[-16.249,20,-15.281]}},{"note":{"onTime":41.25,"xyz":[-70.137,20,-37.454]}},{"note":{"onTime":41.375,"xyz":[73.389,20,24.487]}},{"note":{"onTime":41.5,"xyz":[-60.6,20,-17.234]}},{"note":{"onTime":41.625,"xyz":[-39.822,20,39.93]}},{"note":{"onTime":41.75,"xyz":[-88.852,20,76.769]}},{"note":{"onTime":41.875,"xyz":[59.998,20,-33.728]}},{"note":{"onTime":42,"xyz":[-59.149,20,-96.925]}},{"note":{"onTime":42.125,"xyz":[10.033,20,-96.272]}},{"note":{"onTime":42.25,"xyz":[-57.439,20,-74.565]}},{"note":{"onTime":42.375,"xyz":[51.303,20,82.409]}},{"note":{"onTime":42.5,"xyz":[16.425,20,-78.026]}},{"note":{"onTime":42.625,"xyz":[63.738,20,69.609]}},{"note":{"onTime":42.75,"xyz":[89.319,20,75.783]}},{"note":{"onTime":42.875,"xyz":[56.908,20,10.102]}},{"note":{"onTime":43,"xyz":[56.466,20,-37.43]}},{"note":{"onTime":43.125,"xyz":[-30.449,20,-59.934]}},{"note":{"onTime":43.25,"xyz":[-97.851,20,1.024]}},{"note":{"onTime":43.375,"xyz":[81.009,20,65.275]}},{"note":{"onTime":43.5,"xyz":[-72.349,20,-18.521]}},{"note":{"onTime":43.625,"xyz":[-12.294,20,-55.836]}},{"note":{"onTime":43.75,"xyz":[64.553,20,-61.459]}},{"note":{"onTime":43.875,"xyz":[-52.213,20,-33.593]}},{"note":{"onTime":44,"xyz":[-98.5,20,83.276]}},{"note":{"onTime":44.125,"xyz":[47.051,20,-32.375]}},{"note":{"onTime":44.25,"xyz":[-97.425,20,-39.407]}},{"note":{"onTime":44.375,"xyz":[89.294,20,70.854]}},{"note":{"onTime":44.5,"xyz":[-54.604,20,47.452]}},{"note":{"onTime":44.625,"xyz":[-35.809,20,95.398]}},{"note":{"onTime":44.75,"xyz":[-42.934,20,57.516]}},{"note":{"onTime":44.875,"xyz":[95.847,20,-76.319]}},{"note":{"onTime":45,"xyz":[76.1,20,67.867]}},{"note":{"onTime":45.125,"xyz":[25.129,20,66.743]}},{"note":{"onTime":45.25,"xyz":[18.451,20,33.429]}},{"note":{"onTime":45.375,"xyz":[28.918,20,-81.014]}},{"note":{"onTime":45.5,"xyz":[-24.234,20,-95.3]}},{"note":{"onTime":45.625,"xyz":[-70.597,20,42.807]}},{"note":{"onTime":45.75,"xyz":[23.992,20,14.436]}},{"note":{"onTime":45.875,"xyz":[96.525,20,73.734]}},{"note":{"onTime":46,"xyz":[70.457,20,48.904]}},{"note":{"onTime":46.125,"xyz":[96.731,20,86.702]}},{"note":{"onTime":46.25,"xyz":[17.555,20,-30.672]}},{"note":{"onTime":46.375,"xyz":[91.121,20,-85.92]}},{"note":{"onTime":46.5,"xyz":[71.158,20,99.16]}},{"note":{"onTime":46.625,"xyz":[-63.85,20,-43.915]}},{"note":{"onTime":46.75,"xyz":[-28.124,20,42.789]}},{"note":{"onTime":46.875,"xyz":[-10.014,20,74.2]}},{"note":{"onTime":47,"xyz":[-22.704,20,-48.671]}},{"note":{"onTime":47.125,"xyz":[77.657,20,8.232]}},{"note":{"onTime":47.25,"xyz":[73.326,20,-98.906]}},{"note":{"onTime":47.375,"xyz":[-81.883,20,7.617]}},{"note":{"onTime":47.5,"xyz":[-57.245,20,0.404]}},{"note":{"onTime":47.625,"xyz":[-33.653,20,17.62]}},{"note":{"onTime":47.75,"xyz":[69.178,20,90.319]}},{"note":{"onTime":47.875,"xyz":[73.62,20,11.031]}},{"note":{"onTime":48,"xyz":[4.386,20,-45.035]}},{"note":{"onTime":48.125,"xyz":[19.057,20,-93.996]}},{"note":{"onTime":48.25,"xyz":[77.369,20,7.038]}},{"note":{"onTime":48.375,"xyz":[15.598,20,-39.353]}},{"note":{"onTime":48.5,"xyz":[73.031,20,64.134]}},{"note":{"onTime":48.625,"xyz":[-56.494,20,-15.004]}},{"note":{"onTime":48.75,"xyz":[58.772,20,81.529]}},{"note":{"onTime":48.875,"xyz":[-85.456,20,-39]}},{"note":{"onTime":49,"xyz":[-12.968,20,-42.978]}},{"note":{"onTime":49.125,"xyz":[19.934,20,-88.861]}},{"note":{"onTime":49.25,"xyz":[-48.047,20,-26.522]}},{"note":{"onTime":49.375,"xyz":[-34.768,20,-93.71]}},{"note":{"onTime":65.5,"xyz":[-52.574,20,56.33]}},{"note":{"onTime":65.625,"xyz":[76.681,20,71.046]}},{"note":{"onTime":65.75,"xyz":[39.263,20,12.312]}},{"note":{"onTime":65.875,"xyz":[-4.004,20,-49.931]}},{"note":{"onTime":66,"xyz":[-61.932,20,42.659]}},{"note":{"onTime":66.125,"xyz":[-42.448,20,-66.301]}},{"note":{"onTime":66.25,"xyz":[27.955,20,-69.624]}},{"note":{"onTime":66.375,"xyz":[-25.933,20,-83.068]}},{"note":{"onTime":66.5,"xyz":[92.328,20,94.735]}},{"note":{"onTime":66.625,"xyz":[90.933,20,16.277]}},{"note":{"onTime":66.75,"xyz":[56.559,20,67.386]}},{"note":{"onTime":66.875,"xyz":[34.543,20,-87.728]}},{"note":{"onTime":67,"xyz":[43.835,20,-87.688]}},{"note":{"onTime":67.125,"xyz":[-50.123,20,-75.771]}},{"note":{"onTime":67.25,"xyz":[99.951,20,38.953]}},{"note":{"onTime":67.375,"xyz":[-0.785,20,-98.42]}},{"note":{"onTime":67.5,"xyz":[83.923,20,-82.132]}},{"note":{"onTime":67.625,"xyz":[43.873,20,66.195]}},{"note":{"onTime":67.75,"xyz":[71.298,20,58.308]}},{"note":{"onTime":67.875,"xyz":[80.803,20,-9.942]}},{"note":{"onTime":68,"xyz":[67.027,20,57.085]}},{"note":{"onTime":68.125,"xyz":[-44.039,20,-57.332]}},{"note":{"onTime":68.25,"xyz":[74.795,20,-21.902]}},{"note":{"onTime":68.375,"xyz":[-73.687,20,92.539]}},{"note":{"onTime":68.5,"xyz":[19.662,20,-28.1]}},{"note":{"onTime":68.625,"xyz":[92.335,20,97.176]}},{"note":{"onTime":68.75,"xyz":[70.902,20,94.682]}},{"note":{"onTime":68.875,"xyz":[-27.094,20,65.908]}},{"note":{"onTime":69,"xyz":[-38.088,20,-63.954]}},{"note":{"onTime":69.125,"xyz":[-55.545,20,-70.056]}},{"note":{"onTime":69.25,"xyz":[-45.928,20,-85.067]}},{"note":{"onTime":69.375,"xyz":[-83.754,20,-95.972]}},{"note":{"onTime":69.5,"xyz":[-58.588,20,-46.896]}},{"note":{"onTime":69.625,"xyz":[63.659,20,-25.926]}},{"note":{"onTime":69.75,"xyz":[42.99,20,85.526]}},{"note":{"onTime":69.875,"xyz":[91.367,20,-4.846]}},{"note":{"onTime":70,"xyz":[79.831,20,17.049]}},{"note":{"onTime":70.125,"xyz":[-51.734,20,34.21]}},{"note":{"onTime":70.25,"xyz":[-16.691,20,84.746]}},{"note":{"onTime":70.375,"xyz":[-33.969,20,41.865]}},{"note":{"onTime":70.5,"xyz":[31.859,20,-64.706]}},{"note":{"onTime":70.625,"xyz":[43.193,20,-12.283]}},{"note":{"onTime":70.75,"xyz":[62.878,20,76.773]}},{"note":{"onTime":70.875,"xyz":[-53.415,20,43.478]}},{"note":{"onTime":71,"xyz":[56.692,20,-85.76]}},{"note":{"onTime":71.125,"xyz":[52.058,20,48.346]}},{"note":{"onTime":71.25,"xyz":[-60.518,20,-71.512]}},{"note":{"onTime":71.375,"xyz":[96.321,20,-59.027]}},{"note":{"onTime":71.5,"xyz":[-97.987,20,-92.678]}},{"note":{"onTime":71.625,"xyz":[-38.207,20,92.412]}},{"note":{"onTime":71.75,"xyz":[-18.926,20,-11.233]}},{"note":{"onTime":71.875,"xyz":[-33.662,20,-75.585]}},{"note":{"onTime":72,"xyz":[-99.522,20,-74.446]}},{"note":{"onTime":72.125,"xyz":[-20.246,20,47.46]}},{"note":{"onTime":72.25,"xyz":[18.51,20,30.275]}},{"note":{"onTime":72.375,"xyz":[-61.101,20,2.874]}},{"note":{"onTime":72.5,"xyz":[78.7,20,-89.422]}},{"note":{"onTime":72.625,"xyz":[-16.675,20,-56.559]}},{"note":{"onTime":72.75,"xyz":[-89.216,20,-46.231]}},{"note":{"onTime":72.875,"xyz":[83.29,20,36.851]}},{"note":{"onTime":73,"xyz":[78.737,20,-29.788]}},{"note":{"onTime":73.125,"xyz":[82.034,20,26.384]}},{"note":{"onTime":73.25,"xyz":[-77.241,20,54.887]}},{"note":{"onTime":73.375,"xyz":[-75.818,20,33.193]}},{"note":{"onTime":73.5,"xyz":[92.07,20,-23.507]}},{"note":{"onTime":73.625,"xyz":[92.16,20,-65.436]}},{"note":{"onTime":73.75,"xyz":[-84.593,20,53.453]}},{"note":{"onTime":73.875,"xyz":[-77.513,20,-97.477]}},{"note":{"onTime":74,"xyz":[6.092,20,-73.773]}},{"note":{"onTime":74.125,"xyz":[-76.162,20,-62.822]}},{"note":{"onTime":74.25,"xyz":[-51.461,20,85.268]}},{"note":{"onTime":74.375,"xyz":[68.72,20,79.156]}},{"note":{"onTime":74.5,"xyz":[-36.91,20,64.035]}},{"note":{"onTime":74.625,"xyz":[80.677,20,35.516]}},{"note":{"onTime":74.75,"xyz":[96.04,20,56.408]}},{"note":{"onTime":74.875,"xyz":[-11.142,20,3.522]}},{"note":{"onTime":75,"xyz":[-68.267,20,-32.1]}},{"note":{"onTime":75.125,"xyz":[71.861,20,-73.37]}},{"note":{"onTime":75.25,"xyz":[73.606,20,-39.975]}},{"note":{"onTime":75.375,"xyz":[-37.304,20,67.089]}},{"note":{"onTime":75.5,"xyz":[91.051,20,-2.787]}},{"note":{"onTime":75.625,"xyz":[-63.236,20,29.509]}},{"note":{"onTime":75.75,"xyz":[78.973,20,-44.364]}},{"note":{"onTime":75.875,"xyz":[54.713,20,19.786]}},{"note":{"onTime":76,"xyz":[26.922,20,-96.679]}},{"note":{"onTime":76.125,"xyz":[82.057,20,-26.248]}},{"note":{"onTime":76.25,"xyz":[44.66,20,10.929]}},{"note":{"onTime":76.375,"xyz":[-42.576,20,39.923]}},{"note":{"onTime":76.5,"xyz":[-58.94,20,2.574]}},{"note":{"onTime":76.625,"xyz":[31.317,20,-49.267]}},{"note":{"onTime":76.75,"xyz":[-96.807,20,-93.946]}},{"note":{"onTime":76.875,"xyz":[-52.753,20,66.61]}},{"note":{"onTime":77,"xyz":[72.491,20,-88.13]}},{"note":{"onTime":77.125,"xyz":[87.137,20,-72.717]}},{"note":{"onTime":77.25,"xyz":[64.848,20,0.418]}},{"note":{"onTime":77.375,"xyz":[-47.147,20,-5.313]}},{"note":{"onTime":77.5,"xyz":[-68.453,20,46.705]}},{"note":{"onTime":77.625,"xyz":[-94.262,20,-78.147]}},{"note":{"onTime":77.75,"xyz":[-92.119,20,-38.009]}},{"note":{"onTime":77.875,"xyz":[-63.964,20,-67.863]}},{"note":{"onTime":78,"xyz":[-53.657,20,81.715]}},{"note":{"onTime":78.125,"xyz":[-15.927,20,-56.81]}},{"note":{"onTime":78.25,"xyz":[81.263,20,59.091]}},{"note":{"onTime":78.375,"xyz":[-14.936,20,-79.986]}},{"note":{"onTime":78.5,"xyz":[-78.236,20,-26.27]}},{"note":{"onTime":78.625,"xyz":[59.439,20,-8.49]}},{"note":{"onTime":78.75,"xyz":[19.914,20,14.692]}},{"note":{"onTime":78.875,"xyz":[-79.458,20,-85.137]}},{"note":{"onTime":79,"xyz":[-89.051,20,-52.686]}},{"note":{"onTime":79.125,"xyz":[21.59,20,-77.834]}},{"note":{"onTime":79.25,"xyz":[72.44,20,23.212]}},{"note":{"onTime":79.375,"xyz":[13.77,20,33.639]}},{"note":{"onTime":79.5,"xyz":[99.278,20,42.815]}},{"note":{"onTime":79.625,"xyz":[-62.661,20,-28.177]}},{"note":{"onTime":79.75,"xyz":[41.364,20,-70.184]}},{"note":{"onTime":79.875,"xyz":[17.606,20,61.133]}},{"note":{"onTime":80,"xyz":[-99.147,20,26.912]}},{"note":{"onTime":80.125,"xyz":[-12.326,20,-52.87]}},{"note":{"onTime":80.25,"xyz":[-64.138,20,-27.791]}},{"note":{"onTime":80.375,"xyz":[-90.181,20,19.895]}},{"note":{"onTime":80.5,"xyz":[67.482,20,65.662]}},{"note":{"onTime":80.625,"xyz":[-82.636,20,75.888]}},{"note":{"onTime":80.75,"xyz":[-63.002,20,84.935]}},{"note":{"onTime":80.875,"xyz":[-51.046,20,2.648]}},{"note":{"onTime":81,"xyz":[10.167,20,-39.954]}},{"note":{"onTime":81.125,"xyz":[-2.931,20,-79.273]}},{"note":{"onTime":81.25,"xyz":[-24.544,20,-33.826]}},{"note":{"onTime":81.375,"xyz":[42.688,20,67.22]}},{"note":{"onTime":81.5,"xyz":[-66.914,20,-55.986]}},{"note":{"onTime":81.625,"xyz":[97.949,20,-44.725]}},{"note":{"onTime":81.75,"xyz":[-78.221,20,-92.963]}},{"note":{"onTime":81.875,"xyz":[28.694,20,-6.043]}},{"note":{"onTime":82,"xyz":[-19.924,20,45.039]}},{"note":{"onTime":82.125,"xyz":[78.775,20,2.831]}},{"note":{"onTime":82.25,"xyz":[-10.903,20,-16.636]}},{"note":{"onTime":82.375,"xyz":[67.992,20,-94.348]}},{"note":{"onTime":82.5,"xyz":[-6.379,20,7.154]}},{"note":{"onTime":82.625,"xyz":[85.536,20,-62.466]}},{"note":{"onTime":82.75,"xyz":[-51.634,20,10.021]}},{"note":{"onTime":82.875,"xyz":[-49.183,20,-50.038]}},{"note":{"onTime":83,"xyz":[86.333,20,-23.494]}},{"note":{"onTime":83.125,"xyz":[-36.45,20,48.04]}},{"note":{"onTime":83.25,"xyz":[-43.899,20,57.698]}},{"note":{"onTime":83.375,"xyz":[-85.026,20,44.332]}},{"note":{"onTime":83.5,"xyz":[24.938,20,-50.599]}},{"note":{"onTime":83.625,"xyz":[-17.926,20,63.689]}},{"note":{"onTime":83.75,"xyz":[-5.389,20,-67.797]}},{"note":{"onTime":83.875,"xyz":[-23.303,20,83.417]}},{"note":{"onTime":84,"xyz":[26.762,20,-17.151]}},{"note":{"onTime":84.125,"xyz":[71.412,20,43.18]}},{"note":{"onTime":84.25,"xyz":[-75.267,20,16.262]}},{"note":{"onTime":84.375,"xyz":[-25.988,20,9.001]}},{"note":{"onTime":84.5,"xyz":[-31.29,20,-32.385]}},{"note":{"onTime":84.625,"xyz":[-27.477,20,-74.259]}},{"note":{"onTime":84.75,"xyz":[-48.936,20,73.812]}},{"note":{"onTime":84.875,"xyz":[-77.409,20,-57.575]}},{"note":{"onTime":85,"xyz":[8.757,20,-36.24]}},{"note":{"onTime":85.125,"xyz":[99.134,20,-55.197]}},{"note":{"onTime":85.25,"xyz":[99.701,20,16.803]}},{"note":{"onTime":85.375,"xyz":[84.117,20,-20.497]}},{"note":{"onTime":85.5,"xyz":[19.928,20,98.695]}},{"note":{"onTime":85.625,"xyz":[-87.653,20,-95.832]}},{"note":{"onTime":85.75,"xyz":[-91.532,20,34.49]}},{"note":{"onTime":85.875,"xyz":[-52.861,20,47.944]}},{"note":{"onTime":86,"xyz":[36.784,20,27.72]}},{"note":{"onTime":86.125,"xyz":[7.749,20,-83.313]}},{"note":{"onTime":86.25,"xyz":[-70.341,20,85.234]}},{"note":{"onTime":86.375,"xyz":[-79.567,20,27.281]}},{"note":{"onTime":86.5,"xyz":[-85.595,20,-42.921]}},{"note":{"onTime":86.625,"xyz":[-84.98,20,5.425]}},{"note":{"onTime":86.75,"xyz":[45.263,20,-49.205]}},{"note":{"onTime":86.875,"xyz":[-61.138,20,-68.718]}},{"note":{"onTime":87,"xyz":[-0.123,20,29.499]}},{"note":{"onTime":87.125,"xyz":[10.046,20,-32.662]}},{"note":{"onTime":87.25,"xyz":[-5.293,20,53.132]}},{"note":{"onTime":87.375,"xyz":[-18.265,20,-47.118]}},{"note":{"onTime":87.5,"xyz":[16.273,20,72.244]}},{"note":{"onTime":87.625,"xyz":[-60.476,20,99.443]}},{"note":{"onTime":87.75,"xyz":[-84.916,20,33.698]}},{"note":{"onTime":87.875,"xyz":[-96.334,20,-28.402]}},{"note":{"onTime":88,"xyz":[-40.859,20,-92.344]}},{"note":{"onTime":88.125,"xyz":[-41.926,20,-12.512]}},{"note":{"onTime":88.25,"xyz":[93.89,20,95.237]}},{"note":{"onTime":88.375,"xyz":[-22.066,20,-76.546]}},{"note":{"onTime":88.5,"xyz":[5.486,20,26.206]}},{"note":{"onTime":88.625,"xyz":[-22.153,20,-42.871]}},{"note":{"onTime":88.75,"xyz":[-65.74,20,-93.917]}},{"note":{"onTime":88.875,"xyz":[-47.661,20,33.402]}},{"note":{"onTime":89,"xyz":[35.253,20,22.038]}},{"note":{"onTime":89.125,"xyz":[-69.363,20,-12.405]}},{"note":{"onTime":89.25,"xyz":[-67.302,20,66.954]}},{"note":{"onTime":89.375,"xyz":[17.57,20,-89.754]}},{"note":{"onTime":89.5,"xyz":[-34.684,20,-8.981]}},{"note":{"onTime":89.625,"xyz":[42.487,20,87.867]}},{"note":{"onTime":89.75,"xyz":[69.316,20,-59.75]}},{"note":{"onTime":89.875,"xyz":[88.052,20,-95.941]}},{"note":{"onTime":90,"xyz":[95.958,20,91.283]}},{"note":{"onTime":90.125,"xyz":[20.799,20,-64.656]}},{"note":{"onTime":90.25,"xyz":[10.566,20,41.851]}},{"note":{"onTime":90.375,"xyz":[-4.682,20,-73.89]}},{"note":{"onTime":90.5,"xyz":[69.858,20,66.279]}},{"note":{"onTime":90.625,"xyz":[-46.052,20,-22.981]}},{"note":{"onTime":90.75,"xyz":[-75.526,20,-4.588]}},{"note":{"onTime":90.875,"xyz":[-6.142,20,-68.718]}},{"note":{"onTime":91,"xyz":[43.573,20,-69.682]}},{"note":{"onTime":91.125,"xyz":[-76.618,20,-6.853]}},{"note":{"onTime":91.25,"xyz":[-91.625,20,49.161]}},{"note":{"onTime":91.375,"xyz":[-20.514,20,62.997]}},{"note":{"onTime":91.5,"xyz":[71.525,20,16.618]}},{"note":{"onTime":91.625,"xyz":[-71.758,20,-76.579]}},{"note":{"onTime":91.75,"xyz":[29.148,20,-44.803]}},{"note":{"onTime":91.875,"xyz":[20.193,20,60.637]}},{"note":{"onTime":92,"xyz":[-97.517,20,-12.144]}},{"note":{"onTime":92.125,"xyz":[-77.536,20,-44.359]}},{"note":{"onTime":92.25,"xyz":[-24.049,20,11.282]}},{"note":{"onTime":92.375,"xyz":[-0.486,20,-70.538]}},{"note":{"onTime":92.5,"xyz":[-11.449,20,9.209]}},{"note":{"onTime":92.625,"xyz":[-35.609,20,76.887]}},{"note":{"onTime":92.75,"xyz":[-74.548,20,65.145]}},{"note":{"onTime":92.875,"xyz":[-27.622,20,73.04]}},{"note":{"onTime":93,"xyz":[-93.353,20,83.903]}},{"note":{"onTime":93.125,"xyz":[78.883,20,87.191]}},{"note":{"onTime":93.25,"xyz":[19.566,20,81.274]}},{"note":{"onTime":93.375,"xyz":[33.475,20,88.161]}},{"note":{"onTime":93.5,"xyz":[-7.508,20,-48.738]}},{"note":{"onTime":93.625,"xyz":[31.923,20,75.708]}},{"note":{"onTime":93.75,"xyz":[55.689,20,70.213]}},{"note":{"onTime":93.875,"xyz":[98.113,20,22.263]}},{"note":{"onTime":94,"xyz":[-12.909,20,-52.749]}},{"note":{"onTime":94.125,"xyz":[17.731,20,-40.611]}},{"note":{"onTime":94.25,"xyz":[-10.565,20,-19.638]}},{"note":{"onTime":94.375,"xyz":[-4.425,20,93.351]}},{"note":{"onTime":94.5,"xyz":[95.721,20,27.528]}},{"note":{"onTime":94.625,"xyz":[58.373,20,84.151]}},{"note":{"onTime":94.75,"xyz":[49.864,20,-47.73]}},{"note":{"onTime":94.875,"xyz":[74.984,20,72.423]}},{"note":{"onTime":95,"xyz":[59.413,20,-47.016]}},{"note":{"onTime":95.125,"xyz":[-84.137,20,88.552]}},{"note":{"onTime":95.25,"xyz":[67.222,20,-64.565]}},{"note":{"onTime":95.375,"xyz":[-76.346,20,-71.61]}},{"note":{"onTime":95.5,"xyz":[38.935,20,37.797]}},{"note":{"onTime":95.625,"xyz":[-83.215,20,29.959]}},{"note":{"onTime":95.75,"xyz":[13.172,20,67.599]}},{"note":{"onTime":95.875,"xyz":[-2.042,20,-64.505]}},{"note":{"onTime":96,"xyz":[-88.72,20,59.973]}},{"note":{"onTime":96.125,"xyz":[89.389,20,-26.776]}},{"note":{"onTime":96.25,"xyz":[-46.467,20,16.547]}},{"note":{"onTime":96.375,"xyz":[-33.318,20,43.239]}},{"note":{"onTime":96.5,"xyz":[-21.351,20,-65.603]}},{"note":{"onTime":96.625,"xyz":[13.211,20,41.852]}},{"note":{"onTime":96.75,"xyz":[13.507,20,84.399]}},{"note":{"onTime":96.875,"xyz":[-33.114,20,-91.199]}},{"note":{"onTime":97,"xyz":[89.932,20,-51.623]}},{"note":{"onTime":97.125,"xyz":[-18.824,20,-68.324]}},{"note":{"onTime":97.25,"xyz":[-44.579,20,74.413]}},{"note":{"onTime":97.375,"xyz":[-27.737,20,-8.041]}},{"note":{"onTime":97.5,"xyz":[-25.302,20,-40.305]}},{"note":{"onTime":97.625,"xyz":[74.21,20,87.027]}},{"note":{"onTime":97.75,"xyz":[-31.044,20,-79.72]}},{"note":{"onTime":97.875,"xyz":[74.001,20,-87.484]}},{"note":{"onTime":98,"xyz":[-10.325,20,-42.852]}},{"note":{"onTime":98.125,"xyz":[-51.65,20,-60.594]}},{"note":{"onTime":98.25,"xyz":[73.884,20,77.917]}},{"note":{"onTime":98.375,"xyz":[74.136,20,70.215]}},{"note":{"onTime":98.5,"xyz":[77.738,20,-16.401]}},{"note":{"onTime":98.625,"xyz":[-65.65,20,8.658]}},{"note":{"onTime":98.75,"xyz":[-64.699,20,79.768]}},{"note":{"onTime":98.875,"xyz":[-8.581,20,-72.833]}},{"note":{"onTime":99,"xyz":[-60.61,20,21.522]}},{"note":{"onTime":99.125,"xyz":[49.794,20,66.638]}},{"note":{"onTime":99.25,"xyz":[91.365,20,51.602]}},{"note":{"onTime":99.375,"xyz":[79.67,20,-47.229]}},{"note":{"onTime":99.5,"xyz":[16.747,20,41.053]}},{"note":{"onTime":99.625,"xyz":[-76.295,20,-36.607]}},{"note":{"onTime":99.75,"xyz":[-6.477,20,-8.196]}},{"note":{"onTime":99.875,"xyz":[-41.361,20,31.133]}},{"note":{"onTime":100,"xyz":[90.024,20,10.529]}},{"note":{"onTime":100.125,"xyz":[33.652,20,-84.177]}},{"note":{"onTime":100.25,"xyz":[59.253,20,13.178]}},{"note":{"onTime":100.375,"xyz":[57.367,20,-69.006]}},{"note":{"onTime":100.5,"xyz":[86.52,20,69.543]}},{"note":{"onTime":100.625,"xyz":[55.36,20,58.859]}},{"note":{"onTime":100.75,"xyz":[-62.707,20,-52.759]}},{"note":{"onTime":100.875,"xyz":[-29.957,20,38.144]}},{"note":{"onTime":101,"xyz":[-97.901,20,64.485]}},{"note":{"onTime":101.125,"xyz":[-75.179,20,59.136]}},{"note":{"onTime":101.25,"xyz":[-14.619,20,-88.981]}},{"note":{"onTime":101.375,"xyz":[-75.636,20,-49.649]}},{"note":{"onTime":101.5,"xyz":[35.176,20,46.593]}},{"note":{"onTime":101.625,"xyz":[12.903,20,-8.84]}},{"note":{"onTime":101.75,"xyz":[-39.518,20,36.347]}},{"note":{"onTime":101.875,"xyz":[-37.605,20,-65.22]}},{"note":{"onTime":102,"xyz":[33.202,20,-67.504]}},{"note":{"onTime":102.125,"xyz":[12.458,20,75.983]}},{"note":{"onTime":102.25,"xyz":[-78.471,20,-38.337]}},{"note":{"onTime":102.375,"xyz":[33.929,20,47.913]}},{"note":{"onTime":102.5,"xyz":[-48.35,20,-72.735]}},{"note":{"onTime":102.625,"xyz":[-62.066,20,82.374]}},{"note":{"onTime":102.75,"xyz":[-55.347,20,86.305]}},{"note":{"onTime":102.875,"xyz":[2.343,20,-82.025]}},{"note":{"onTime":103,"xyz":[25.495,20,-90.044]}},{"note":{"onTime":103.125,"xyz":[37.48,20,-9.507]}},{"note":{"onTime":103.25,"xyz":[50.921,20,-12.69]}},{"note":{"onTime":103.375,"xyz":[-37.037,20,-10.149]}},{"note":{"onTime":103.5,"xyz":[-46.798,20,-18.339]}},{"note":{"onTime":103.625,"xyz":[17.559,20,-81.941]}},{"note":{"onTime":103.75,"xyz":[-53.433,20,-1.291]}},{"note":{"onTime":103.875,"xyz":[73.917,20,32.513]}},{"note":{"onTime":104,"xyz":[-6.792,20,-23.95]}},{"note":{"onTime":104.125,"xyz":[-19.942,20,-90.977]}},{"note":{"onTime":104.25,"xyz":[-24.273,20,-46.674]}},{"note":{"onTime":104.375,"xyz":[99.5,20,-91.062]}},{"note":{"onTime":104.5,"xyz":[72.908,20,-67.578]}},{"note":{"onTime":104.625,"xyz":[71.893,20,-15.255]}},{"note":{"onTime":104.75,"xyz":[85.677,20,87.071]}},{"note":{"onTime":104.875,"xyz":[66.03,20,8.531]}},{"note":{"onTime":105,"xyz":[-89.859,20,-68.75]}},{"note":{"onTime":105.125,"xyz":[47.123,20,57.657]}},{"note":{"onTime":105.25,"xyz":[4.563,20,-94.259]}},{"note":{"onTime":105.375,"xyz":[30.207,20,-57.953]}},{"note":{"onTime":105.5,"xyz":[-52.832,20,92.228]}},{"note":{"onTime":105.625,"xyz":[-58.444,20,-92.557]}},{"note":{"onTime":105.75,"xyz":[31.636,20,14.314]}},{"note":{"onTime":105.875,"xyz":[-40.023,20,99.015]}},{"note":{"onTime":106,"xyz":[97.165,20,-65.181]}},{"note":{"onTime":106.125,"xyz":[59.863,20,19.704]}},{"note":{"onTime":106.25,"xyz":[39.988,20,-91.251]}},{"note":{"onTime":106.375,"xyz":[-72.116,20,67.656]}},{"note":{"onTime":106.5,"xyz":[-96.8,20,-98.701]}},{"note":{"onTime":106.625,"xyz":[75.18,20,87.138]}},{"note":{"onTime":106.75,"xyz":[91.787,20,-69.722]}},{"note":{"onTime":106.875,"xyz":[16.937,20,-82.694]}},{"note":{"onTime":107,"xyz":[-90.278,20,42.308]}},{"note":{"onTime":107.125,"xyz":[41.224,20,-26.798]}},{"note":{"onTime":107.25,"xyz":[66.008,20,-17.793]}},{"note":{"onTime":107.375,"xyz":[-61.037,20,-56.659]}},{"note":{"onTime":107.5,"xyz":[46.542,20,64.893]}},{"note":{"onTime":107.625,"xyz":[-83.099,20,-61.708]}},{"note":{"onTime":107.75,"xyz":[98.672,20,9.213]}},{"note":{"onTime":107.875,"xyz":[-34.528,20,74.595]}},{"note":{"onTime":108,"xyz":[25.322,20,-56.943]}},{"note":{"onTime":108.125,"xyz":[3.412,20,-71.588]}},{"note":{"onTime":108.25,"xyz":[35.575,20,39.137]}},{"note":{"onTime":108.375,"xyz":[-28.99,20,-56.718]}},{"note":{"onTime":108.5,"xyz":[-51.445,20,90.806]}},{"note":{"onTime":108.625,"xyz":[93.865,20,-73.655]}},{"note":{"onTime":108.75,"xyz":[97.527,20,-12.713]}},{"note":{"onTime":108.875,"xyz":[-10.975,20,17.422]}},{"note":{"onTime":109,"xyz":[-68.95,20,97.695]}},{"note":{"onTime":109.125,"xyz":[-64.614,20,-34.675]}},{"note":{"onTime":109.25,"xyz":[-41.916,20,23.226]}},{"note":{"onTime":109.375,"xyz":[80.222,20,-4.241]}},{"note":{"onTime":109.5,"xyz":[-66.083,20,26.876]}},{"note":{"onTime":109.625,"xyz":[3.725,20,5.211]}},{"note":{"onTime":109.75,"xyz":[33.783,20,-99.921]}},{"note":{"onTime":109.875,"xyz":[-86.576,20,65.183]}},{"note":{"onTime":110,"xyz":[11.055,20,75.641]}},{"note":{"onTime":110.125,"xyz":[-9.633,20,71.157]}},{"note":{"onTime":110.25,"xyz":[-13.122,20,46.323]}},{"note":{"onTime":110.375,"xyz":[58.931,20,20.655]}},{"note":{"onTime":110.5,"xyz":[-31.871,20,-1.524]}},{"note":{"onTime":110.625,"xyz":[2.142,20,54.783]}},{"note":{"onTime":110.75,"xyz":[40.569,20,20.086]}},{"note":{"onTime":110.875,"xyz":[-5.621,20,47.623]}},{"note":{"onTime":111,"xyz":[34.061,20,92.602]}},{"note":{"onTime":111.125,"xyz":[73.333,20,-22.15]}},{"note":{"onTime":111.25,"xyz":[-93.257,20,-74.058]}},{"note":{"onTime":111.375,"xyz":[23.1,20,-33.048]}},{"note":{"onTime":111.5,"xyz":[-54.989,20,-53.977]}},{"note":{"onTime":111.625,"xyz":[-9.715,20,-81.571]}},{"note":{"onTime":111.75,"xyz":[-73.796,20,-5.786]}},{"note":{"onTime":111.875,"xyz":[-95.018,20,-57.661]}},{"note":{"onTime":112,"xyz":[40.861,20,-51.925]}},{"note":{"onTime":112.125,"xyz":[28.518,20,-0.426]}},{"note":{"onTime":112.25,"xyz":[21.411,20,-77.238]}},{"note":{"onTime":112.375,"xyz":[-0.174,20,50.238]}},{"note":{"onTime":112.5,"xyz":[-25.798,20,-37.531]}},{"note":{"onTime":112.625,"xyz":[2.331,20,40.495]}},{"note":{"onTime":112.75,"xyz":[61.708,20,-18.713]}},{"note":{"onTime":112.875,"xyz":[-76.791,20,-87.72]}},{"note":{"onTime":113,"xyz":[31.818,20,-37.156]}},{"note":{"onTime":113.125,"xyz":[26.916,20,70.226]}},{"note":{"onTime":113.25,"xyz":[41.061,20,78.124]}},{"note":{"onTime":113.375,"xyz":[-85.161,20,-9.803]}},{"note":{"onTime":129.5,"xyz":[6.444,20,86.264]}},{"note":{"onTime":129.625,"xyz":[22.037,20,-6.957]}},{"note":{"onTime":129.75,"xyz":[-80.647,20,-59.219]}},{"note":{"onTime":129.875,"xyz":[-62.387,20,72.334]}},{"note":{"onTime":130,"xyz":[83.976,20,79.844]}},{"note":{"onTime":130.125,"xyz":[79.324,20,39.911]}},{"note":{"onTime":130.25,"xyz":[-74.206,20,73.127]}},{"note":{"onTime":130.375,"xyz":[75.428,20,15.833]}},{"note":{"onTime":130.5,"xyz":[47.419,20,-63.232]}},{"note":{"onTime":130.625,"xyz":[-74.859,20,-20.056]}},{"note":{"onTime":130.75,"xyz":[-53.561,20,68.388]}},{"note":{"onTime":130.875,"xyz":[43.789,20,73.908]}},{"note":{"onTime":131,"xyz":[57.541,20,58.212]}},{"note":{"onTime":131.125,"xyz":[98.004,20,-66.864]}},{"note":{"onTime":131.25,"xyz":[-66.884,20,84.757]}},{"note":{"onTime":131.375,"xyz":[-9.673,20,-29.537]}},{"note":{"onTime":131.5,"xyz":[-53.286,20,-58.026]}},{"note":{"onTime":131.625,"xyz":[2.605,20,-16.541]}},{"note":{"onTime":131.75,"xyz":[-46.274,20,-5.302]}},{"note":{"onTime":131.875,"xyz":[-42.445,20,-92.749]}},{"note":{"onTime":132,"xyz":[-6.336,20,9.305]}},{"note":{"onTime":132.125,"xyz":[-92.142,20,-15.277]}},{"note":{"onTime":132.25,"xyz":[-31.578,20,56.429]}},{"note":{"onTime":132.375,"xyz":[-87.827,20,75.977]}},{"note":{"onTime":132.5,"xyz":[80.886,20,-67.364]}},{"note":{"onTime":132.625,"xyz":[-92.558,20,78.93]}},{"note":{"onTime":132.75,"xyz":[68.274,20,-2.094]}},{"note":{"onTime":132.875,"xyz":[-63.144,20,82.909]}},{"note":{"onTime":133,"xyz":[-85.429,20,-24.18]}},{"note":{"onTime":133.125,"xyz":[42.855,20,-72.86]}},{"note":{"onTime":133.25,"xyz":[-23.552,20,-86.69]}},{"note":{"onTime":133.375,"xyz":[-15.444,20,85.986]}},{"note":{"onTime":133.5,"xyz":[-92.975,20,-53.138]}},{"note":{"onTime":133.625,"xyz":[-11.047,20,52.826]}},{"note":{"onTime":133.75,"xyz":[11.87,20,-27.972]}},{"note":{"onTime":133.875,"xyz":[-4.702,20,44.432]}},{"note":{"onTime":134,"xyz":[-78.409,20,-36.849]}},{"note":{"onTime":134.125,"xyz":[-97.996,20,97.737]}},{"note":{"onTime":134.25,"xyz":[-84.594,20,-59.86]}},{"note":{"onTime":134.375,"xyz":[-24.523,20,80.858]}},{"note":{"onTime":134.5,"xyz":[80.071,20,29.203]}},{"note":{"onTime":134.625,"xyz":[30.228,20,-9.747]}},{"note":{"onTime":134.75,"xyz":[-61.473,20,-85.6]}},{"note":{"onTime":134.875,"xyz":[39.653,20,-44.12]}},{"note":{"onTime":135,"xyz":[32.65,20,26.886]}},{"note":{"onTime":135.125,"xyz":[86.851,20,26.248]}},{"note":{"onTime":135.25,"xyz":[-5.515,20,68.725]}},{"note":{"onTime":135.375,"xyz":[14.853,20,55.219]}},{"note":{"onTime":135.5,"xyz":[90.317,20,-81.842]}},{"note":{"onTime":135.625,"xyz":[-14.354,20,62.447]}},{"note":{"onTime":135.75,"xyz":[71.984,20,13.177]}},{"note":{"onTime":135.875,"xyz":[7.359,20,89.32]}},{"note":{"onTime":136,"xyz":[19.782,20,-39.694]}},{"note":{"onTime":136.125,"xyz":[-61.017,20,22.288]}},{"note":{"onTime":136.25,"xyz":[-88.65,20,-34.554]}},{"note":{"onTime":136.375,"xyz":[-67.986,20,-94.547]}},{"note":{"onTime":136.5,"xyz":[-99.094,20,-66.329]}},{"note":{"onTime":136.625,"xyz":[-81.624,20,-85.721]}},{"note":{"onTime":136.75,"xyz":[-56.793,20,-65.163]}},{"note":{"onTime":136.875,"xyz":[4.014,20,12.327]}},{"note":{"onTime":137,"xyz":[46.617,20,-18.109]}},{"note":{"onTime":137.125,"xyz":[77.526,20,-37.142]}},{"note":{"onTime":137.25,"xyz":[89.644,20,-81.249]}},{"note":{"onTime":137.375,"xyz":[-6.795,20,17.2]}},{"note":{"onTime":137.5,"xyz":[-14.666,20,64.63]}},{"note":{"onTime":137.625,"xyz":[-62.126,20,51.751]}},{"note":{"onTime":137.75,"xyz":[27.889,20,-88.325]}},{"note":{"onTime":137.875,"xyz":[40.882,20,-24.515]}},{"note":{"onTime":138,"xyz":[-94.111,20,22.814]}},{"note":{"onTime":138.125,"xyz":[-63.357,20,79.837]}},{"note":{"onTime":138.25,"xyz":[-83.516,20,-73.34]}},{"note":{"onTime":138.375,"xyz":[39.085,20,52.861]}},{"note":{"onTime":138.5,"xyz":[-35.052,20,56.368]}},{"note":{"onTime":138.625,"xyz":[-62.612,20,29.5]}},{"note":{"onTime":138.75,"xyz":[-16.049,20,29.309]}},{"note":{"onTime":138.875,"xyz":[-27.607,20,99.883]}},{"note":{"onTime":139,"xyz":[56.934,20,14.445]}},{"note":{"onTime":139.125,"xyz":[-96.961,20,-52.508]}},{"note":{"onTime":139.25,"xyz":[-20.033,20,-15.738]}},{"note":{"onTime":139.375,"xyz":[22.225,20,-60.909]}},{"note":{"onTime":139.5,"xyz":[46.447,20,98.164]}},{"note":{"onTime":139.625,"xyz":[-68.547,20,38.292]}},{"note":{"onTime":139.75,"xyz":[89.036,20,-85.823]}},{"note":{"onTime":139.875,"xyz":[33.637,20,-35.38]}},{"note":{"onTime":140,"xyz":[63.189,20,-24.153]}},{"note":{"onTime":140.125,"xyz":[53.456,20,69.968]}},{"note":{"onTime":140.25,"xyz":[-93.337,20,-28.783]}},{"note":{"onTime":140.375,"xyz":[-55.386,20,54.308]}},{"note":{"onTime":140.5,"xyz":[59.381,20,-89.255]}},{"note":{"onTime":140.625,"xyz":[-6.607,20,92.531]}},{"note":{"onTime":140.75,"xyz":[78.019,20,21.035]}},{"note":{"onTime":140.875,"xyz":[-22.129,20,-5.696]}},{"note":{"onTime":141,"xyz":[29.691,20,-98.72]}},{"note":{"onTime":141.125,"xyz":[92.175,20,68.797]}},{"note":{"onTime":141.25,"xyz":[-0.88,20,-60.744]}},{"note":{"onTime":141.375,"xyz":[-4.849,20,16.182]}},{"note":{"onTime":141.5,"xyz":[93.651,20,33.778]}},{"note":{"onTime":141.625,"xyz":[-7.177,20,17.749]}},{"note":{"onTime":141.75,"xyz":[-19.503,20,-79.537]}},{"note":{"onTime":141.875,"xyz":[14.016,20,46.547]}},{"note":{"onTime":142,"xyz":[40.582,20,47.7]}},{"note":{"onTime":142.125,"xyz":[88.517,20,70.392]}},{"note":{"onTime":142.25,"xyz":[73.365,20,-0.32]}},{"note":{"onTime":142.375,"xyz":[87.151,20,69.144]}},{"note":{"onTime":142.5,"xyz":[-62.988,20,-86.621]}},{"note":{"onTime":142.625,"xyz":[-66.856,20,38.114]}},{"note":{"onTime":142.75,"xyz":[-41.703,20,-13.642]}},{"note":{"onTime":142.875,"xyz":[-55.844,20,-0.529]}},{"note":{"onTime":143,"xyz":[-3.398,20,22.256]}},{"note":{"onTime":143.125,"xyz":[14.343,20,93.547]}},{"note":{"onTime":143.25,"xyz":[96.397,20,10.859]}},{"note":{"onTime":143.375,"xyz":[-4.156,20,71.884]}},{"note":{"onTime":143.5,"xyz":[-87.433,20,-10.391]}},{"note":{"onTime":143.625,"xyz":[89.05,20,-36.075]}},{"note":{"onTime":143.75,"xyz":[-57.03,20,83.439]}},{"note":{"onTime":143.875,"xyz":[-98.962,20,-60.792]}},{"note":{"onTime":144,"xyz":[52.595,20,69.794]}},{"note":{"onTime":144.125,"xyz":[81.549,20,36.942]}},{"note":{"onTime":144.25,"xyz":[23.695,20,65.734]}},{"note":{"onTime":144.375,"xyz":[95.871,20,84.847]}},{"note":{"onTime":144.5,"xyz":[-83.727,20,-16.026]}},{"note":{"onTime":144.625,"xyz":[-55.981,20,-20.885]}},{"note":{"onTime":144.75,"xyz":[73.296,20,54.745]}},{"note":{"onTime":144.875,"xyz":[85.577,20,-52.607]}},{"note":{"onTime":145,"xyz":[55.006,20,-39.645]}},{"note":{"onTime":145.125,"xyz":[79.576,20,66.638]}},{"note":{"onTime":145.25,"xyz":[36.714,20,-20.682]}},{"note":{"onTime":145.375,"xyz":[98.791,20,-42.264]}},{"note":{"onTime":145.5,"xyz":[54.439,20,-13.077]}},{"note":{"onTime":145.625,"xyz":[-72.177,20,28.749]}},{"note":{"onTime":145.75,"xyz":[-67.221,20,9.134]}},{"note":{"onTime":145.875,"xyz":[-95.653,20,88.673]}},{"note":{"onTime":146,"xyz":[-20.62,20,76.675]}},{"note":{"onTime":146.125,"xyz":[-87.101,20,3.58]}},{"note":{"onTime":146.25,"xyz":[-19.617,20,-23.808]}},{"note":{"onTime":146.375,"xyz":[-9.426,20,-82.985]}},{"note":{"onTime":146.5,"xyz":[81.223,20,-54.645]}},{"note":{"onTime":146.625,"xyz":[-45.979,20,6.525]}},{"note":{"onTime":146.75,"xyz":[-12.849,20,8.788]}},{"note":{"onTime":146.875,"xyz":[-92.909,20,-1.8]}},{"note":{"onTime":147,"xyz":[-32.134,20,-98.314]}},{"note":{"onTime":147.125,"xyz":[-61.466,20,-88.906]}},{"note":{"onTime":147.25,"xyz":[0.612,20,-21.992]}},{"note":{"onTime":147.375,"xyz":[-30.895,20,-46.598]}},{"note":{"onTime":147.5,"xyz":[36.137,20,-49.89]}},{"note":{"onTime":147.625,"xyz":[-42.541,20,-57.726]}},{"note":{"onTime":147.75,"xyz":[21.871,20,-43.295]}},{"note":{"onTime":147.875,"xyz":[-75.789,20,69.136]}},{"note":{"onTime":148,"xyz":[-33.287,20,-93.985]}},{"note":{"onTime":148.125,"xyz":[-96.463,20,82.39]}},{"note":{"onTime":148.25,"xyz":[-18.216,20,90.989]}},{"note":{"onTime":148.375,"xyz":[-18.316,20,9.374]}},{"note":{"onTime":148.5,"xyz":[81.543,20,-76.525]}},{"note":{"onTime":148.625,"xyz":[31.777,20,-10.54]}},{"note":{"onTime":148.75,"xyz":[-20.376,20,84.206]}},{"note":{"onTime":148.875,"xyz":[4.278,20,40.15]}},{"note":{"onTime":149,"xyz":[-36.228,20,35.483]}},{"note":{"onTime":149.125,"xyz":[82.502,20,28.061]}},{"note":{"onTime":149.25,"xyz":[-15.741,20,93.428]}},{"note":{"onTime":149.375,"xyz":[62.524,20,-33.332]}},{"note":{"onTime":149.5,"xyz":[-59.844,20,-93.317]}},{"note":{"onTime":149.625,"xyz":[-33.102,20,12.68]}},{"note":{"onTime":149.75,"xyz":[-2.179,20,38.432]}},{"note":{"onTime":149.875,"xyz":[-48.476,20,-17.083]}},{"note":{"onTime":150,"xyz":[25.995,20,-1.392]}},{"note":{"onTime":150.125,"xyz":[15.061,20,63.582]}},{"note":{"onTime":150.25,"xyz":[81.876,20,-76.812]}},{"note":{"onTime":150.375,"xyz":[70.252,20,33.776]}},{"note":{"onTime":150.5,"xyz":[-67.458,20,-52.588]}},{"note":{"onTime":150.625,"xyz":[-13.46,20,-24.838]}},{"note":{"onTime":150.75,"xyz":[46.1,20,-30.158]}},{"note":{"onTime":150.875,"xyz":[63.346,20,89.624]}},{"note":{"onTime":151,"xyz":[-63.064,20,-45.896]}},{"note":{"onTime":151.125,"xyz":[43.388,20,96.811]}},{"note":{"onTime":151.25,"xyz":[-0.552,20,-34.798]}},{"note":{"onTime":151.375,"xyz":[25.409,20,-66.551]}},{"note":{"onTime":151.5,"xyz":[14.618,20,-12.716]}},{"note":{"onTime":151.625,"xyz":[85.706,20,-73.73]}},{"note":{"onTime":151.75,"xyz":[-36.174,20,19.719]}},{"note":{"onTime":151.875,"xyz":[67.805,20,60.461]}},{"note":{"onTime":152,"xyz":[34.252,20,-1.623]}},{"note":{"onTime":152.125,"xyz":[49.692,20,15.491]}},{"note":{"onTime":152.25,"xyz":[-49.736,20,-61.026]}},{"note":{"onTime":152.375,"xyz":[47.952,20,90.196]}},{"note":{"onTime":152.5,"xyz":[15.152,20,-50.633]}},{"note":{"onTime":152.625,"xyz":[-31.811,20,-11.003]}},{"note":{"onTime":152.75,"xyz":[97.589,20,7.663]}},{"note":{"onTime":152.875,"xyz":[61.125,20,91.129]}},{"note":{"onTime":153,"xyz":[47.199,20,53.031]}},{"note":{"onTime":153.125,"xyz":[-6.274,20,74.743]}},{"note":{"onTime":153.25,"xyz":[73.594,20,-13.921]}},{"note":{"onTime":153.375,"xyz":[94.749,20,17.782]}},{"note":{"onTime":153.5,"xyz":[73.266,20,25.675]}},{"note":{"onTime":153.625,"xyz":[-15.928,20,-52.527]}},{"note":{"onTime":153.75,"xyz":[-61.291,20,-80.903]}},{"note":{"onTime":153.875,"xyz":[45.196,20,60.335]}},{"note":{"onTime":154,"xyz":[-65.864,20,-47.634]}},{"note":{"onTime":154.125,"xyz":[50.278,20,84.577]}},{"note":{"onTime":154.25,"xyz":[72.179,20,-42.34]}},{"note":{"onTime":154.375,"xyz":[97.083,20,-93.267]}},{"note":{"onTime":154.5,"xyz":[75.931,20,-35.332]}},{"note":{"onTime":154.625,"xyz":[67.226,20,34.456]}},{"note":{"onTime":154.75,"xyz":[-39.271,20,-7.238]}},{"note":{"onTime":154.875,"xyz":[65.07,20,-82.703]}},{"note":{"onTime":155,"xyz":[-79.976,20,-69.125]}},{"note":{"onTime":155.125,"xyz":[-53.324,20,-2.621]}},{"note":{"onTime":155.25,"xyz":[49.74,20,-98.067]}},{"note":{"onTime":155.375,"xyz":[98.154,20,11.831]}},{"note":{"onTime":155.5,"xyz":[95.471,20,-41.252]}},{"note":{"onTime":155.625,"xyz":[72.812,20,-81.158]}},{"note":{"onTime":155.75,"xyz":[56.919,20,8.221]}},{"note":{"onTime":155.875,"xyz":[-53.534,20,69.236]}},{"note":{"onTime":156,"xyz":[-66.076,20,-89.253]}},{"note":{"onTime":156.125,"xyz":[-99.711,20,95.425]}},{"note":{"onTime":156.25,"xyz":[-51.527,20,-48.318]}},{"note":{"onTime":156.375,"xyz":[-9.428,20,39.615]}},{"note":{"onTime":156.5,"xyz":[27.061,20,-68.234]}},{"note":{"onTime":156.625,"xyz":[-85.221,20,93.155]}},{"note":{"onTime":156.75,"xyz":[-22.222,20,-26.643]}},{"note":{"onTime":156.875,"xyz":[33.264,20,-31.115]}},{"note":{"onTime":157,"xyz":[46.5,20,-10.633]}},{"note":{"onTime":157.125,"xyz":[-43.978,20,-21.633]}},{"note":{"onTime":157.25,"xyz":[-13.448,20,11.763]}},{"note":{"onTime":157.375,"xyz":[53.863,20,-64.117]}},{"note":{"onTime":157.5,"xyz":[26.228,20,26.516]}},{"note":{"onTime":157.625,"xyz":[-96.633,20,61.056]}},{"note":{"onTime":157.75,"xyz":[-31.471,20,11.872]}},{"note":{"onTime":157.875,"xyz":[-74.99,20,-98.018]}},{"note":{"onTime":158,"xyz":[-92.484,20,-73.185]}},{"note":{"onTime":158.125,"xyz":[-76.178,20,-49.256]}},{"note":{"onTime":158.25,"xyz":[95.627,20,46.601]}},{"note":{"onTime":158.375,"xyz":[91.967,20,73.191]}},{"note":{"onTime":158.5,"xyz":[-53.651,20,92.239]}},{"note":{"onTime":158.625,"xyz":[82.602,20,-75.164]}},{"note":{"onTime":158.75,"xyz":[6.623,20,50.791]}},{"note":{"onTime":158.875,"xyz":[14.412,20,-25.226]}},{"note":{"onTime":159,"xyz":[-16.66,20,33.367]}},{"note":{"onTime":159.125,"xyz":[-83.827,20,9.478]}},{"note":{"onTime":159.25,"xyz":[-41.676,20,-32.307]}},{"note":{"onTime":159.375,"xyz":[-29.263,20,38.352]}},{"note":{"onTime":159.5,"xyz":[-23.844,20,-27.88]}},{"note":{"onTime":159.625,"xyz":[-32.198,20,-27.08]}},{"note":{"onTime":159.75,"xyz":[39.237,20,-92.045]}},{"note":{"onTime":159.875,"xyz":[24.845,20,-98.483]}},{"note":{"onTime":160,"xyz":[-5.56,20,56.992]}},{"note":{"onTime":160.125,"xyz":[85.6,20,31.371]}},{"note":{"onTime":160.25,"xyz":[45.745,20,-78.896]}},{"note":{"onTime":160.375,"xyz":[-44.557,20,19.937]}},{"note":{"onTime":160.5,"xyz":[77.23,20,-9.211]}},{"note":{"onTime":160.625,"xyz":[83.072,20,67.364]}},{"note":{"onTime":160.75,"xyz":[20.775,20,-20.47]}},{"note":{"onTime":160.875,"xyz":[-52.155,20,-8.028]}},{"note":{"onTime":161,"xyz":[-47.115,20,70.857]}},{"note":{"onTime":161.125,"xyz":[-37.836,20,-39.39]}},{"note":{"onTime":161.25,"xyz":[54.971,20,-25.028]}},{"note":{"onTime":161.375,"xyz":[48.265,20,-4.224]}},{"note":{"onTime":161.5,"xyz":[21.503,20,41.823]}},{"note":{"onTime":161.625,"xyz":[98.807,20,31.361]}},{"note":{"onTime":161.75,"xyz":[-49.633,20,-72.5]}},{"note":{"onTime":161.875,"xyz":[-19.385,20,-61.09]}},{"note":{"onTime":162,"xyz":[-0.154,20,-39.177]}},{"note":{"onTime":162.125,"xyz":[-9.032,20,-3.735]}},{"note":{"onTime":162.25,"xyz":[-53.443,20,7.003]}},{"note":{"onTime":162.375,"xyz":[-74.2,20,-79.546]}},{"note":{"onTime":162.5,"xyz":[28.759,20,75.243]}},{"note":{"onTime":162.625,"xyz":[-30.808,20,36.731]}},{"note":{"onTime":162.75,"xyz":[-90.63,20,-32.831]}},{"note":{"onTime":162.875,"xyz":[63.52,20,5.61]}},{"note":{"onTime":163,"xyz":[43.096,20,-87.053]}},{"note":{"onTime":163.125,"xyz":[69.653,20,-20.214]}},{"note":{"onTime":163.25,"xyz":[-17.963,20,-8.026]}},{"note":{"onTime":163.375,"xyz":[76.558,20,-87.183]}},{"note":{"onTime":163.5,"xyz":[4.136,20,-14.984]}},{"note":{"onTime":163.625,"xyz":[69.699,20,-8.567]}},{"note":{"onTime":163.75,"xyz":[98.867,20,-45.338]}},{"note":{"onTime":163.875,"xyz":[17.589,20,13.357]}},{"note":{"onTime":164,"xyz":[-5.49,20,-99.02]}},{"note":{"onTime":164.125,"xyz":[85.898,20,-17.49]}},{"note":{"onTime":164.25,"xyz":[-38.582,20,89.233]}},{"note":{"onTime":164.375,"xyz":[-61.536,20,43.467]}},{"note":{"onTime":164.5,"xyz":[-24.379,20,96.553]}},{"note":{"onTime":164.625,"xyz":[-65.41,20,-72.946]}},{"note":{"onTime":164.75,"xyz":[77.168,20,74.425]}},{"note":{"onTime":164.875,"xyz":[82.016,20,-71.054]}},{"note":{"onTime":165,"xyz":[7.564,20,-26.131]}},{"note":{"onTime":165.125,"xyz":[54.924,20,93.154]}},{"note":{"onTime":165.25,"xyz":[60.687,20,-69.802]}},{"note":{"onTime":165.375,"xyz":[36.354,20,-77.736]}},{"note":{"onTime":165.5,"xyz":[-68.448,20,54.213]}},{"note":{"onTime":165.625,"xyz":[-5.584,20,-13.685]}},{"note":{"onTime":165.75,"xyz":[-2.691,20,-73.278]}},{"note":{"onTime":165.875,"xyz":[51.66,20,52.177]}},{"note":{"onTime":166,"xyz":[-85.165,20,-56.742]}},{"note":{"onTime":166.125,"xyz":[56.988,20,5.317]}},{"note":{"onTime":166.25,"xyz":[69.306,20,-94.143]}},{"note":{"onTime":166.375,"xyz":[-80.517,20,85.827]}},{"note":{"onTime":166.5,"xyz":[58.121,20,-91.203]}},{"note":{"onTime":166.625,"xyz":[-86.482,20,10.572]}},{"note":{"onTime":166.75,"xyz":[44.554,20,15.14]}},{"note":{"onTime":166.875,"xyz":[14.541,20,3.36]}},{"note":{"onTime":167,"xyz":[65.502,20,70.982]}},{"note":{"onTime":167.125,"xyz":[-25.112,20,4.985]}},{"note":{"onTime":167.25,"xyz":[27.714,20,54.269]}},{"note":{"onTime":167.375,"xyz":[99.015,20,-14.969]}},{"note":{"onTime":167.5,"xyz":[-23.129,20,5.054]}},{"note":{"onTime":167.625,"xyz":[-72.474,20,-72.688]}},{"note":{"onTime":167.75,"xyz":[73.893,20,34.085]}},{"note":{"onTime":167.875,"xyz":[89.346,20,-89.187]}},{"note":{"onTime":168,"xyz":[-37.154,20,-43.423]}},{"note":{"onTime":168.125,"xyz":[31.459,20,-41.979]}},{"note":{"onTime":168.25,"xyz":[64.826,20,-51.939]}},{"note":{"onTime":168.375,"xyz":[-14.467,20,-27.491]}},{"note":{"onTime":168.5,"xyz":[-17.806,20,69.177]}},{"note":{"onTime":168.625,"xyz":[-19.144,20,-62.347]}},{"note":{"onTime":168.75,"xyz":[47.541,20,-43.717]}},{"note":{"onTime":168.875,"xyz":[-37.074,20,-1.64]}},{"note":{"onTime":169,"xyz":[-98.251,20,24.77]}},{"note":{"onTime":169.125,"xyz":[-72.923,20,97.677]}},{"note":{"onTime":169.25,"xyz":[35.534,20,-18.066]}},{"note":{"onTime":169.375,"xyz":[26.529,20,90.154]}},{"note":{"onTime":169.5,"xyz":[78.837,20,96.304]}},{"note":{"onTime":169.625,"xyz":[64.217,20,-96.15]}},{"note":{"onTime":169.75,"xyz":[72.441,20,-79.719]}},{"note":{"onTime":169.875,"xyz":[27.793,20,-27.165]}},{"note":{"onTime":170,"xyz":[6.195,20,12.985]}},{"note":{"onTime":170.125,"xyz":[-22.843,20,12.082]}},{"note":{"onTime":170.25,"xyz":[-41.793,20,60.157]}},{"note":{"onTime":170.375,"xyz":[43.913,20,56.615]}},{"note":{"onTime":170.5,"xyz":[19.396,20,38.019]}},{"note":{"onTime":170.625,"xyz":[-47.895,20,-63.212]}},{"note":{"onTime":170.75,"xyz":[37.763,20,-82.054]}},{"note":{"onTime":170.875,"xyz":[-80.375,20,11.578]}},{"note":{"onTime":171,"xyz":[66.769,20,58.841]}},{"note":{"onTime":171.125,"xyz":[49.651,20,31.752]}},{"note":{"onTime":171.25,"xyz":[52.191,20,84.069]}},{"note":{"onTime":171.375,"xyz":[-28.493,20,54.798]}},{"note":{"onTime":171.5,"xyz":[-58.179,20,89.851]}},{"note":{"onTime":171.625,"xyz":[-59.694,20,-16.515]}},{"note":{"onTime":171.75,"xyz":[52.402,20,81.966]}},{"note":{"onTime":171.875,"xyz":[54.767,20,-50.062]}},{"note":{"onTime":172,"xyz":[-21.842,20,-12.349]}},{"note":{"onTime":172.125,"xyz":[-97.446,20,17.084]}},{"note":{"onTime":172.25,"xyz":[-24.695,20,39.581]}},{"note":{"onTime":172.375,"xyz":[-7.452,20,-80.632]}},{"note":{"onTime":172.5,"xyz":[6.911,20,-21.224]}},{"note":{"onTime":172.625,"xyz":[-16.605,20,14.593]}},{"note":{"onTime":172.75,"xyz":[82.481,20,-26.653]}},{"note":{"onTime":172.875,"xyz":[-32.278,20,68.771]}},{"note":{"onTime":173,"xyz":[-23.349,20,-0.073]}},{"note":{"onTime":173.125,"xyz":[-78.605,20,-54.141]}},{"note":{"onTime":173.25,"xyz":[61.35,20,84.672]}},{"note":{"onTime":173.375,"xyz":[77.187,20,-75.751]}},{"note":{"onTime":173.5,"xyz":[35.818,20,50.712]}},{"note":{"onTime":173.625,"xyz":[32.234,20,11.895]}},{"note":{"onTime":173.75,"xyz":[-11.151,20,68.919]}},{"note":{"onTime":173.875,"xyz":[48.662,20,81.941]}},{"note":{"onTime":174,"xyz":[77.637,20,-41.127]}},{"note":{"onTime":174.125,"xyz":[56.747,20,-99.262]}},{"note":{"onTime":174.25,"xyz":[-42.401,20,36.894]}},{"note":{"onTime":174.375,"xyz":[-80.012,20,-29.879]}},{"note":{"onTime":174.5,"xyz":[-52.455,20,-41.975]}},{"note":{"onTime":174.625,"xyz":[-28.524,20,-44.191]}},{"note":{"onTime":174.75,"xyz":[-35.419,20,48.829]}},{"note":{"onTime":174.875,"xyz":[80.921,20,-76.181]}},{"note":{"onTime":175,"xyz":[-86.892,20,77.888]}},{"note":{"onTime":175.125,"xyz":[-38.282,20,56.769]}},{"note":{"onTime":175.25,"xyz":[62.304,20,60.867]}},{"note":{"onTime":175.375,"xyz":[77.431,20,-28.078]}},{"note":{"onTime":175.5,"xyz":[-3.552,20,-52.975]}},{"note":{"onTime":175.625,"xyz":[-42.936,20,12.883]}},{"note":{"onTime":175.75,"xyz":[-27.52,20,84.046]}},{"note":{"onTime":175.875,"xyz":[-21.503,20,-63.213]}},{"note":{"onTime":176,"xyz":[-30.842,20,8.07]}},{"note":{"onTime":176.125,"xyz":[-70.543,20,68.879]}},{"note":{"onTime":176.25,"xyz":[-37.807,20,-44.217]}},{"note":{"onTime":176.375,"xyz":[-94.592,20,46.349]}},{"note":{"onTime":176.5,"xyz":[9.732,20,-54.532]}},{"note":{"onTime":176.625,"xyz":[-46.271,20,-76.698]}},{"note":{"onTime":176.75,"xyz":[-17.426,20,-76.141]}},{"note":{"onTime":176.875,"xyz":[-76.446,20,58.731]}},{"note":{"onTime":177,"xyz":[23.48,20,-74.292]}},{"note":{"onTime":177.125,"xyz":[30.653,20,59.38]}},{"note":{"onTime":177.25,"xyz":[69.97,20,42.904]}},{"note":{"onTime":177.375,"xyz":[96.726,20,99.355]}},{"note":{"onTime":177.5,"xyz":[24.956,20,50.055]}},{"note":{"onTime":177.625,"xyz":[72.489,20,-11.621]}},{"note":{"onTime":177.75,"xyz":[9.618,20,-16.622]}},{"note":{"onTime":177.875,"xyz":[-96.084,20,10.547]}},{"note":{"onTime":178,"xyz":[-17.128,20,19.788]}},{"note":{"onTime":178.125,"xyz":[51.032,20,5.466]}},{"note":{"onTime":178.25,"xyz":[61.816,20,53.06]}},{"note":{"onTime":178.375,"xyz":[18.607,20,13.652]}},{"note":{"onTime":178.5,"xyz":[-72.471,20,13.932]}},{"note":{"onTime":178.625,"xyz":[-91.846,20,58.064]}},{"note":{"onTime":178.75,"xyz":[-49.405,20,31.031]}},{"note":{"onTime":178.875,"xyz":[50.576,20,83.638]}},{"note":{"onTime":179,"xyz":[-79.269,20,-20.507]}},{"note":{"onTime":179.125,"xyz":[28.86,20,-73.286]}},{"note":{"onTime":179.25,"xyz":[-85.111,20,14.155]}},{"note":{"onTime":179.375,"xyz":[50.186,20,36.21]}},{"note":{"onTime":179.5,"xyz":[88.212,20,-65.808]}},{"note":{"onTime":179.625,"xyz":[76.823,20,-81.564]}},{"note":{"onTime":179.75,"xyz":[22.212,20,76.069]}},{"note":{"onTime":179.875,"xyz":[-24.813,20,-72.585]}},{"note":{"onTime":180,"xyz":[-85.444,20,81.699]}},{"note":{"onTime":180.125,"xyz":[-7.558,20,72.584]}},{"note":{"onTime":180.25,"xyz":[-55.176,20,-61.338]}},{"note":{"onTime":180.375,"xyz":[-79.989,20,-34.244]}},{"note":{"onTime":180.5,"xyz":[0.618,20,-60.63]}},{"note":{"onTime":180.625,"xyz":[-46.618,20,79.21]}},{"note":{"onTime":180.75,"xyz":[-1.595,20,56.062]}},{"note":{"onTime":180.875,"xyz":[-92.431,20,-63.203]}},{"note":{"onTime":181,"xyz":[83.449,20,78.478]}},{"note":{"onTime":181.125,"xyz":[97.623,20,-90.081]}},{"note":{"onTime":181.25,"xyz":[43.23,20,-88.879]}},{"note":{"onTime":181.375,"xyz":[43.547,20,-59.725]}},{"note":{"onTime":181.5,"xyz":[-81.288,20,76.95]}},{"note":{"onTime":181.625,"xyz":[9.007,20,-38.767]}},{"note":{"onTime":181.75,"xyz":[47.835,20,-75.6]}},{"note":{"onTime":181.875,"xyz":[33.204,20,39.71]}},{"note":{"onTime":182,"xyz":[25.611,20,84.598]}},{"note":{"onTime":182.125,"xyz":[-34.715,20,-89.556]}},{"note":{"onTime":182.25,"xyz":[-84.805,20,-24.352]}},{"note":{"onTime":182.375,"xyz":[60.669,20,24.511]}},{"note":{"onTime":182.5,"xyz":[94.308,20,0.859]}},{"note":{"onTime":182.625,"xyz":[-51.337,20,83.983]}},{"note":{"onTime":182.75,"xyz":[-28.61,20,-62.206]}},{"note":{"onTime":182.875,"xyz":[30.739,20,84.589]}},{"note":{"onTime":183,"xyz":[55.847,20,65.022]}},{"note":{"onTime":183.125,"xyz":[18.851,20,-61.732]}},{"note":{"onTime":183.25,"xyz":[-83.217,20,23.426]}},{"note":{"onTime":183.375,"xyz":[-26.829,20,-2.535]}},{"note":{"onTime":183.5,"xyz":[14.575,20,58.969]}},{"note":{"onTime":183.625,"xyz":[48.606,20,53.073]}},{"note":{"onTime":183.75,"xyz":[39.685,20,-56.224]}},{"note":{"onTime":183.875,"xyz":[9.485,20,27.877]}},{"note":{"onTime":184,"xyz":[43.063,20,-77.593]}},{"note":{"onTime":184.125,"xyz":[21.782,20,37.381]}},{"note":{"onTime":184.25,"xyz":[92.534,20,80.208]}},{"note":{"onTime":184.375,"xyz":[82.256,20,-60.106]}},{"note":{"onTime":184.5,"xyz":[39.531,20,-19.4]}},{"note":{"onTime":184.625,"xyz":[93.877,20,-52.253]}},{"note":{"onTime":184.75,"xyz":[30.561,20,68.197]}},{"note":{"onTime":184.875,"xyz":[46.916,20,-78.478]}},{"note":{"onTime":185,"xyz":[47.766,20,-15.393]}},{"note":{"onTime":185.125,"xyz":[15.079,20,19.157]}},{"note":{"onTime":185.25,"xyz":[12.966,20,-6.182]}},{"note":{"onTime":185.375,"xyz":[-73.954,20,21.816]}},{"note":{"onTime":185.5,"xyz":[39.547,20,-35.986]}},{"note":{"onTime":185.625,"xyz":[-84.19,20,-91.615]}},{"note":{"onTime":185.75,"xyz":[66.586,20,2.728]}},{"note":{"onTime":185.875,"xyz":[-73.827,20,-99.516]}},{"note":{"onTime":186,"xyz":[-40.435,20,92.171]}},{"note":{"onTime":186.125,"xyz":[54.78,20,49.854]}},{"note":{"onTime":186.25,"xyz":[12.071,20,-78.35]}},{"note":{"onTime":186.375,"xyz":[17.072,20,90.004]}},{"note":{"onTime":186.5,"xyz":[32.845,20,-36.079]}},{"note":{"onTime":186.625,"xyz":[-70.474,20,-76.005]}},{"note":{"onTime":186.75,"xyz":[52.553,20,92.361]}},{"note":{"onTime":186.875,"xyz":[73.558,20,-29.772]}},{"note":{"onTime":187,"xyz":[-65.331,20,85.842]}},{"note":{"onTime":187.125,"xyz":[-50.535,20,38.11]}},{"note":{"onTime":187.25,"xyz":[24.82,20,18.171]}},{"note":{"onTime":187.375,"xyz":[-20.216,20,55.491]}},{"note":{"onTime":187.5,"xyz":[22.998,20,-21.025]}},{"note":{"onTime":187.625,"xyz":[71.436,20,19.723]}},{"note":{"onTime":187.75,"xyz":[-87.015,20,22.91]}},{"note":{"onTime":187.875,"xyz":[96.038,20,-5.774]}},{"note":{"onTime":188,"xyz":[33.391,20,94.06]}},{"note":{"onTime":188.125,"xyz":[-2.249,20,22.448]}},{"note":{"onTime":188.25,"xyz":[24.66,20,-77.587]}},{"note":{"onTime":188.375,"xyz":[88.042,20,81.067]}},{"note":{"onTime":188.5,"xyz":[36.431,20,-60.726]}},{"note":{"onTime":188.625,"xyz":[-63.261,20,44.343]}},{"note":{"onTime":188.75,"xyz":[29.628,20,-91.494]}},{"note":{"onTime":188.875,"xyz":[-81.255,20,81.462]}},{"note":{"onTime":189,"xyz":[57.644,20,20.46]}},{"note":{"onTime":189.125,"xyz":[-74.206,20,-41.227]}},{"note":{"onTime":189.25,"xyz":[61.013,20,45.484]}},{"note":{"onTime":189.375,"xyz":[2.622,20,-31.22]}},{"note":{"onTime":189.5,"xyz":[-40.078,20,-6.135]}},{"note":{"onTime":189.625,"xyz":[-83.077,20,57.766]}},{"note":{"onTime":189.75,"xyz":[78.956,20,-20.897]}},{"note":{"onTime":189.875,"xyz":[-77.527,20,-26.077]}},{"note":{"onTime":190,"xyz":[-11.556,20,31.372]}},{"note":{"onTime":190.125,"xyz":[24.791,20,-92.127]}},{"note":{"onTime":190.25,"xyz":[96.78,20,58.058]}},{"note":{"onTime":190.375,"xyz":[-91.285,20,-52.565]}},{"note":{"onTime":190.5,"xyz":[-21.901,20,-1.763]}},{"note":{"onTime":190.625,"xyz":[-62.733,20,-81.468]}},{"note":{"onTime":190.75,"xyz":[69.67,20,67.974]}},{"note":{"onTime":190.875,"xyz":[81.182,20,34.107]}},{"note":{"onTime":191,"xyz":[23.406,20,43.321]}},{"note":{"onTime":191.125,"xyz":[88.475,20,22.919]}},{"note":{"onTime":191.25,"xyz":[45.837,20,-22.118]}},{"note":{"onTime":191.375,"xyz":[53.423,20,60.095]}},{"note":{"onTime":191.5,"xyz":[10.94,20,1.825]}},{"note":{"onTime":191.625,"xyz":[-5.663,20,71.317]}},{"note":{"onTime":191.75,"xyz":[-19.803,20,99.212]}},{"note":{"onTime":191.875,"xyz":[99.496,20,32.519]}},{"note":{"onTime":192,"xyz":[14.25,20,10.527]}},{"note":{"onTime":192.125,"xyz":[-49.379,20,-63.035]}},{"note":{"onTime":192.25,"xyz":[10.537,20,57.271]}},{"note":{"onTime":192.375,"xyz":[83.266,20,-48.419]}},{"note":{"onTime":192.5,"xyz":[-48.721,20,-64.489]}},{"note":{"onTime":192.625,"xyz":[93.489,20,-65.573]}},{"note":{"onTime":192.75,"xyz":[-3.809,20,-24.768]}},{"note":{"onTime":192.875,"xyz":[-49.798,20,-64.829]}},{"note":{"onTime":193,"xyz":[-95.706,20,12.406]}},{"note":{"onTime":193.125,"xyz":[22.542,20,-49.554]}},{"note":{"onTime":193.25,"xyz":[-80.791,20,70.613]}},{"note":{"onTime":193.375,"xyz":[-18.326,20,55.974]}}],"02c103e8fcef483292ebc49d3898ef96":[{"instanceName":"-"},{"note":{"onTime":57.5,"xyz":[14.125,60,47.344]}},{"note":{"onTime":57.558,"xyz":[-23.254,60,35.223]}},{"note":{"onTime":57.625,"xyz":[-9.91,60,-18.948]}},{"note":{"onTime":57.683,"xyz":[-22.899,60,-49.71]}},{"note":{"onTime":57.75,"xyz":[17.295,60,19.82]}},{"note":{"onTime":57.808,"xyz":[-13.15,60,-18.745]}},{"note":{"onTime":57.875,"xyz":[28.621,60,18.581]}},{"note":{"onTime":57.933,"xyz":[-43.881,60,-14.518]}},{"note":{"onTime":58,"xyz":[-46.232,60,7.888]}},{"note":{"onTime":58.058,"xyz":[-40.71,60,-33.298]}},{"note":{"onTime":58.125,"xyz":[25.894,60,-19.817]}},{"note":{"onTime":58.183,"xyz":[-31.726,60,-13.545]}},{"note":{"onTime":58.25,"xyz":[-46.43,60,-44.809]}},{"note":{"onTime":58.308,"xyz":[12.598,60,15.07]}},{"note":{"onTime":58.375,"xyz":[-25.919,60,1.256]}},{"note":{"onTime":58.433,"xyz":[-28.374,60,-13.745]}},{"note":{"onTime":58.5,"xyz":[-4.111,60,-10.79]}},{"note":{"onTime":58.558,"xyz":[-30.783,60,44.38]}},{"note":{"onTime":58.625,"xyz":[-36.934,60,-19.684]}},{"note":{"onTime":58.683,"xyz":[-33.863,60,-1.525]}},{"note":{"onTime":58.75,"xyz":[-0.484,60,-25.142]}},{"note":{"onTime":58.808,"xyz":[-29.459,60,22.049]}},{"note":{"onTime":58.875,"xyz":[15.792,60,-27.06]}},{"note":{"onTime":58.933,"xyz":[11.832,60,-37.238]}},{"note":{"onTime":59,"xyz":[-13.675,60,24.05]}},{"note":{"onTime":59.058,"xyz":[48.207,60,-48.977]}},{"note":{"onTime":59.125,"xyz":[29.871,60,-33.039]}},{"note":{"onTime":59.183,"xyz":[3.216,60,21.579]}},{"note":{"onTime":59.25,"xyz":[-48.999,60,-13.475]}},{"note":{"onTime":59.308,"xyz":[-48.37,60,-12.843]}},{"note":{"onTime":59.375,"xyz":[25.429,60,38.918]}},{"note":{"onTime":59.433,"xyz":[-0.062,60,28.211]}},{"note":{"onTime":59.5,"xyz":[37.01,60,21.917]}},{"note":{"onTime":59.558,"xyz":[31.792,60,-12.147]}},{"note":{"onTime":59.625,"xyz":[-0.793,60,-8.256]}},{"note":{"onTime":59.683,"xyz":[13.7,60,-13.981]}},{"note":{"onTime":59.75,"xyz":[18.836,60,-46.928]}},{"note":{"onTime":59.808,"xyz":[-18.714,60,-8.063]}},{"note":{"onTime":59.875,"xyz":[-15.081,60,-26.282]}},{"note":{"onTime":59.933,"xyz":[-48.571,60,18.955]}},{"note":{"onTime":60,"xyz":[-9.555,60,0.623]}},{"note":{"onTime":60.058,"xyz":[30.599,60,30.799]}},{"note":{"onTime":60.125,"xyz":[19.847,60,-21.346]}},{"note":{"onTime":60.183,"xyz":[14.685,60,-26.685]}},{"note":{"onTime":60.25,"xyz":[-39.977,60,-1.195]}},{"note":{"onTime":60.308,"xyz":[0.655,60,-29.233]}},{"note":{"onTime":60.375,"xyz":[17.697,60,27.352]}},{"note":{"onTime":60.433,"xyz":[-44.672,60,-49.255]}},{"note":{"onTime":60.5,"xyz":[-49.055,60,-7.47]}},{"note":{"onTime":60.558,"xyz":[11.603,60,-13.253]}},{"note":{"onTime":60.625,"xyz":[47.696,60,30.291]}},{"note":{"onTime":60.683,"xyz":[-12.57,60,-27.495]}},{"note":{"onTime":60.75,"xyz":[9.007,60,15.705]}},{"note":{"onTime":60.808,"xyz":[47.855,60,-32.896]}},{"note":{"onTime":60.875,"xyz":[19.948,60,31.573]}},{"note":{"onTime":60.933,"xyz":[-44.559,60,-25.028]}},{"note":{"onTime":61,"xyz":[15.895,60,-49.198]}},{"note":{"onTime":61.058,"xyz":[-20.622,60,49.792]}},{"note":{"onTime":61.125,"xyz":[-22.965,60,34.12]}},{"note":{"onTime":61.183,"xyz":[-41.398,60,36.4]}},{"note":{"onTime":61.25,"xyz":[8.921,60,-30.32]}},{"note":{"onTime":61.308,"xyz":[39.227,60,-10.261]}},{"note":{"onTime":61.375,"xyz":[-8.135,60,6.12]}},{"note":{"onTime":61.433,"xyz":[31.609,60,34.925]}},{"note":{"onTime":61.5,"xyz":[6.993,60,-44.348]}},{"note":{"onTime":61.558,"xyz":[-42.518,60,-28.223]}},{"note":{"onTime":61.625,"xyz":[-31.279,60,-18.472]}},{"note":{"onTime":61.683,"xyz":[37.827,60,42.844]}},{"note":{"onTime":61.75,"xyz":[6.812,60,-49.415]}},{"note":{"onTime":61.808,"xyz":[-30.954,60,-31.109]}},{"note":{"onTime":61.875,"xyz":[-35.026,60,-19.041]}},{"note":{"onTime":61.933,"xyz":[22.036,60,1.506]}},{"note":{"onTime":62,"xyz":[20.596,60,-30.981]}},{"note":{"onTime":62.058,"xyz":[47.077,60,-3.289]}},{"note":{"onTime":62.125,"xyz":[10.033,60,17.448]}},{"note":{"onTime":62.183,"xyz":[25.886,60,-34.958]}},{"note":{"onTime":62.25,"xyz":[-40.389,60,-1.537]}},{"note":{"onTime":62.308,"xyz":[13.227,60,-47.025]}},{"note":{"onTime":62.375,"xyz":[22.599,60,-0.847]}},{"note":{"onTime":62.433,"xyz":[32.131,60,-36.484]}},{"note":{"onTime":62.5,"xyz":[-1.301,60,19.27]}},{"note":{"onTime":62.558,"xyz":[11.789,60,48.757]}},{"note":{"onTime":62.625,"xyz":[37.613,60,16.759]}},{"note":{"onTime":62.683,"xyz":[-17.806,60,32.224]}},{"note":{"onTime":62.75,"xyz":[-46.739,60,21.37]}},{"note":{"onTime":62.808,"xyz":[-35.428,60,43.819]}},{"note":{"onTime":62.875,"xyz":[0.202,60,-38.361]}},{"note":{"onTime":62.933,"xyz":[21.681,60,-24.829]}},{"note":{"onTime":63,"xyz":[-11.174,60,-24.44]}},{"note":{"onTime":63.058,"xyz":[-42.96,60,-11.787]}},{"note":{"onTime":63.125,"xyz":[40.877,60,0.27]}},{"note":{"onTime":63.183,"xyz":[-22.862,60,34.793]}},{"note":{"onTime":63.25,"xyz":[11.872,60,-38.961]}},{"note":{"onTime":63.308,"xyz":[-44.304,60,-29.87]}},{"note":{"onTime":63.375,"xyz":[31.976,60,4.898]}},{"note":{"onTime":63.433,"xyz":[-35.947,60,-32.063]}},{"note":{"onTime":63.5,"xyz":[41.896,60,49.201]}},{"note":{"onTime":63.558,"xyz":[-43.29,60,-29.994]}},{"note":{"onTime":63.625,"xyz":[25.358,60,40.449]}},{"note":{"onTime":63.683,"xyz":[26.124,60,28.089]}},{"note":{"onTime":63.75,"xyz":[-35.268,60,43.672]}},{"note":{"onTime":63.808,"xyz":[-34.197,60,20.869]}},{"note":{"onTime":63.875,"xyz":[-28.647,60,7.697]}},{"note":{"onTime":63.933,"xyz":[5.757,60,-46.154]}},{"note":{"onTime":64,"xyz":[-32.875,60,-23.399]}},{"note":{"onTime":64.058,"xyz":[9.383,60,-25.058]}},{"note":{"onTime":64.125,"xyz":[18.95,60,42.675]}},{"note":{"onTime":64.183,"xyz":[45.83,60,-36.354]}},{"note":{"onTime":64.25,"xyz":[-47.449,60,-38.803]}},{"note":{"onTime":64.308,"xyz":[-23.076,60,-23.502]}},{"note":{"onTime":64.375,"xyz":[-2.748,60,-27.66]}},{"note":{"onTime":64.433,"xyz":[22.698,60,-43.256]}},{"note":{"onTime":64.5,"xyz":[38.283,60,0.518]}},{"note":{"onTime":64.558,"xyz":[-5.398,60,40.956]}},{"note":{"onTime":64.625,"xyz":[-21.839,60,26.487]}},{"note":{"onTime":64.683,"xyz":[10.451,60,20.439]}},{"note":{"onTime":64.75,"xyz":[33.717,60,-47.488]}},{"note":{"onTime":64.808,"xyz":[30.175,60,40.237]}},{"note":{"onTime":64.875,"xyz":[20.332,60,5.914]}},{"note":{"onTime":64.933,"xyz":[-23.575,60,43.548]}},{"note":{"onTime":65,"xyz":[-0.061,60,-48.695]}},{"note":{"onTime":65.058,"xyz":[29.116,60,-5.638]}},{"note":{"onTime":65.125,"xyz":[-5.638,60,6.834]}},{"note":{"onTime":65.183,"xyz":[7.953,60,36.135]}},{"note":{"onTime":65.25,"xyz":[-9.455,60,-15.26]}},{"note":{"onTime":65.308,"xyz":[-17.999,60,-30.693]}},{"note":{"onTime":65.375,"xyz":[-10.761,60,1.542]}},{"note":{"onTime":65.433,"xyz":[-29.619,60,-44.513]}},{"note":{"onTime":65.5,"xyz":[23.133,60,-18.898]}},{"note":{"onTime":65.558,"xyz":[-24.675,60,-3.68]}},{"note":{"onTime":65.625,"xyz":[34.475,60,-39.568]}},{"note":{"onTime":65.683,"xyz":[6.184,60,-3.141]}},{"note":{"onTime":65.75,"xyz":[39.358,60,-35.474]}},{"note":{"onTime":65.808,"xyz":[-19.603,60,36.566]}},{"note":{"onTime":65.875,"xyz":[-18.52,60,-40.193]}},{"note":{"onTime":65.933,"xyz":[-24.145,60,17.566]}},{"note":{"onTime":66,"xyz":[9.848,60,-13.436]}},{"note":{"onTime":66.058,"xyz":[-30.874,60,39.732]}},{"note":{"onTime":66.125,"xyz":[-11.351,60,35.284]}},{"note":{"onTime":66.183,"xyz":[24.001,60,-47.185]}},{"note":{"onTime":66.25,"xyz":[49.92,60,28.266]}},{"note":{"onTime":66.308,"xyz":[27.707,60,4.636]}},{"note":{"onTime":66.375,"xyz":[-11.245,60,37.737]}},{"note":{"onTime":66.433,"xyz":[25.42,60,-29.043]}},{"note":{"onTime":66.5,"xyz":[-48.561,60,26.703]}},{"note":{"onTime":66.558,"xyz":[-18.092,60,18.006]}},{"note":{"onTime":66.625,"xyz":[3.006,60,-9.375]}},{"note":{"onTime":66.683,"xyz":[23.476,60,-24.336]}},{"note":{"onTime":66.75,"xyz":[30.286,60,-30.83]}},{"note":{"onTime":66.808,"xyz":[40.037,60,19.349]}},{"note":{"onTime":66.875,"xyz":[-3.98,60,18.825]}},{"note":{"onTime":66.933,"xyz":[-37.632,60,-47.124]}},{"note":{"onTime":67,"xyz":[15.17,60,-29.503]}},{"note":{"onTime":67.058,"xyz":[29.75,60,-15.734]}},{"note":{"onTime":67.125,"xyz":[32.457,60,-27.528]}},{"note":{"onTime":67.183,"xyz":[34.336,60,-27.086]}},{"note":{"onTime":67.25,"xyz":[46.689,60,19.598]}},{"note":{"onTime":67.308,"xyz":[27.148,60,30.916]}},{"note":{"onTime":67.375,"xyz":[8.751,60,25.518]}},{"note":{"onTime":67.433,"xyz":[2.755,60,-35.036]}},{"note":{"onTime":67.5,"xyz":[22.597,60,-12.547]}},{"note":{"onTime":67.558,"xyz":[1.593,60,-20.686]}},{"note":{"onTime":67.625,"xyz":[-41.621,60,-46.322]}},{"note":{"onTime":67.683,"xyz":[-12.959,60,6.108]}},{"note":{"onTime":67.75,"xyz":[-49.818,60,13.696]}},{"note":{"onTime":67.808,"xyz":[24.687,60,18.141]}},{"note":{"onTime":67.875,"xyz":[-45.896,60,21.457]}},{"note":{"onTime":67.933,"xyz":[20.308,60,-7.906]}},{"note":{"onTime":68,"xyz":[-8.279,60,14.004]}},{"note":{"onTime":68.058,"xyz":[16.85,60,-41.226]}},{"note":{"onTime":68.125,"xyz":[-44.383,60,32.956]}},{"note":{"onTime":68.183,"xyz":[15.722,60,-17.967]}},{"note":{"onTime":68.25,"xyz":[13.941,60,-24.516]}},{"note":{"onTime":68.308,"xyz":[29.927,60,-18.803]}},{"note":{"onTime":68.375,"xyz":[-23.958,60,26.124]}},{"note":{"onTime":68.433,"xyz":[2.48,60,34.208]}},{"note":{"onTime":68.5,"xyz":[-22.588,60,32.219]}},{"note":{"onTime":68.558,"xyz":[-10.725,60,1.499]}},{"note":{"onTime":68.625,"xyz":[-34.283,60,15.157]}},{"note":{"onTime":68.683,"xyz":[17.358,60,-24.817]}},{"note":{"onTime":68.75,"xyz":[26.826,60,38.194]}},{"note":{"onTime":68.808,"xyz":[43.759,60,15.648]}},{"note":{"onTime":68.875,"xyz":[36.698,60,10.738]}},{"note":{"onTime":68.933,"xyz":[-37.241,60,-30.596]}},{"note":{"onTime":69,"xyz":[-31.909,60,-20.238]}},{"note":{"onTime":69.058,"xyz":[-2.915,60,-0.789]}},{"note":{"onTime":69.125,"xyz":[-23.574,60,-27.215]}},{"note":{"onTime":69.183,"xyz":[-32.794,60,-18.531]}},{"note":{"onTime":69.25,"xyz":[43.178,60,-5.146]}},{"note":{"onTime":69.308,"xyz":[18.937,60,-32.275]}},{"note":{"onTime":69.375,"xyz":[23.99,60,-24.59]}},{"note":{"onTime":69.433,"xyz":[9.214,60,48.271]}},{"note":{"onTime":69.5,"xyz":[38.66,60,-8.892]}},{"note":{"onTime":69.558,"xyz":[-40.68,60,27.402]}},{"note":{"onTime":69.625,"xyz":[7.428,60,-11.223]}},{"note":{"onTime":69.683,"xyz":[-9.522,60,3.181]}},{"note":{"onTime":69.75,"xyz":[-11.121,60,-19.878]}},{"note":{"onTime":69.808,"xyz":[14.571,60,-29.153]}},{"note":{"onTime":69.875,"xyz":[-34.507,60,7.535]}},{"note":{"onTime":69.933,"xyz":[-30.691,60,19.478]}},{"note":{"onTime":70,"xyz":[-40.318,60,-30.003]}},{"note":{"onTime":70.058,"xyz":[18.466,60,-2.514]}},{"note":{"onTime":70.125,"xyz":[2.34,60,-19.475]}},{"note":{"onTime":70.183,"xyz":[-9.725,60,-34.803]}},{"note":{"onTime":70.25,"xyz":[23.655,60,-16.624]}},{"note":{"onTime":70.308,"xyz":[-43.137,60,-36.606]}},{"note":{"onTime":70.375,"xyz":[48.552,60,21.442]}},{"note":{"onTime":70.433,"xyz":[-29.047,60,-13.397]}},{"note":{"onTime":70.5,"xyz":[-37.191,60,-6.848]}},{"note":{"onTime":70.558,"xyz":[29.317,60,-9.806]}},{"note":{"onTime":70.625,"xyz":[26.954,60,5.146]}},{"note":{"onTime":70.683,"xyz":[31.764,60,-37.554]}},{"note":{"onTime":70.75,"xyz":[-40.369,60,-6.952]}},{"note":{"onTime":70.808,"xyz":[6.105,60,-12.266]}},{"note":{"onTime":70.875,"xyz":[46.652,60,-20.705]}},{"note":{"onTime":70.933,"xyz":[-20.198,60,-3.773]}},{"note":{"onTime":71,"xyz":[-37.535,60,45.236]}},{"note":{"onTime":71.058,"xyz":[-45.902,60,-29.78]}},{"note":{"onTime":71.125,"xyz":[-26.273,60,46.011]}},{"note":{"onTime":71.183,"xyz":[-17.392,60,38.618]}},{"note":{"onTime":71.25,"xyz":[36.135,60,-27.792]}},{"note":{"onTime":71.308,"xyz":[29.919,60,-29.509]}},{"note":{"onTime":71.375,"xyz":[-47.967,60,-6.761]}},{"note":{"onTime":71.433,"xyz":[-7.179,60,-42.736]}},{"note":{"onTime":71.5,"xyz":[33.77,60,-14.939]}},{"note":{"onTime":71.558,"xyz":[-36.174,60,-17.873]}},{"note":{"onTime":71.625,"xyz":[-27.475,60,-19.486]}},{"note":{"onTime":71.683,"xyz":[9.648,60,-3.877]}},{"note":{"onTime":71.75,"xyz":[-49.249,60,-34.596]}},{"note":{"onTime":71.808,"xyz":[-17.249,60,-15.925]}},{"note":{"onTime":71.875,"xyz":[14.56,60,8.799]}},{"note":{"onTime":71.933,"xyz":[-11.917,60,-8.45]}},{"note":{"onTime":72,"xyz":[46.726,60,43.056]}},{"note":{"onTime":72.058,"xyz":[45.935,60,27.487]}},{"note":{"onTime":72.125,"xyz":[7.614,60,29.099]}},{"note":{"onTime":72.183,"xyz":[31.827,60,37.306]}},{"note":{"onTime":72.25,"xyz":[46.629,60,36.744]}},{"note":{"onTime":72.308,"xyz":[-8.392,60,-10.552]}},{"note":{"onTime":72.375,"xyz":[-13.162,60,-30.47]}},{"note":{"onTime":72.433,"xyz":[30.824,60,15.678]}},{"note":{"onTime":72.5,"xyz":[-43.357,60,49.969]}},{"note":{"onTime":72.558,"xyz":[18.133,60,23.286]}},{"note":{"onTime":72.625,"xyz":[40.904,60,-14.47]}},{"note":{"onTime":72.683,"xyz":[29.376,60,36.905]}},{"note":{"onTime":72.75,"xyz":[-43.965,60,39.236]}},{"note":{"onTime":72.808,"xyz":[48.059,60,-39.845]}},{"note":{"onTime":72.875,"xyz":[-24.423,60,-37.09]}},{"note":{"onTime":72.933,"xyz":[35.752,60,-45.915]}},{"note":{"onTime":73,"xyz":[-49.182,60,-3.164]}},{"note":{"onTime":73.058,"xyz":[48.529,60,41.57]}},{"note":{"onTime":73.125,"xyz":[41.439,60,28.416]}},{"note":{"onTime":73.183,"xyz":[9.242,60,45.763]}},{"note":{"onTime":73.25,"xyz":[0.157,60,15.369]}},{"note":{"onTime":73.308,"xyz":[6.468,60,-12.409]}},{"note":{"onTime":73.375,"xyz":[-0.784,60,47.498]}},{"note":{"onTime":73.433,"xyz":[-14.405,60,-16.616]}},{"note":{"onTime":73.5,"xyz":[-48.53,60,26.187]}},{"note":{"onTime":73.558,"xyz":[-18.006,60,30.34]}},{"note":{"onTime":73.625,"xyz":[21.14,60,13.984]}},{"note":{"onTime":73.683,"xyz":[26.764,60,25.789]}},{"note":{"onTime":73.75,"xyz":[45.16,60,28.953]}},{"note":{"onTime":73.808,"xyz":[-11.509,60,-32.471]}},{"note":{"onTime":73.875,"xyz":[-48.217,60,-38.678]}},{"note":{"onTime":73.933,"xyz":[5.913,60,7.957]}},{"note":{"onTime":74,"xyz":[-25.088,60,-45.494]}},{"note":{"onTime":74.058,"xyz":[-27.22,60,15.707]}},{"note":{"onTime":74.125,"xyz":[-23.202,60,-49.896]}},{"note":{"onTime":74.183,"xyz":[-36.392,60,16.168]}},{"note":{"onTime":74.25,"xyz":[14.49,60,28.204]}},{"note":{"onTime":74.308,"xyz":[-6.181,60,-32.109]}},{"note":{"onTime":74.375,"xyz":[-26.984,60,11.536]}},{"note":{"onTime":74.433,"xyz":[-3.854,60,-33.217]}},{"note":{"onTime":74.5,"xyz":[46.986,60,25.949]}},{"note":{"onTime":74.558,"xyz":[23.388,60,-14.713]}},{"note":{"onTime":74.625,"xyz":[38.317,60,-48.438]}},{"note":{"onTime":74.683,"xyz":[-38.058,60,30.822]}},{"note":{"onTime":74.75,"xyz":[-42.569,60,40.078]}},{"note":{"onTime":74.808,"xyz":[17.168,60,-22.228]}},{"note":{"onTime":74.875,"xyz":[24.731,60,45.312]}},{"note":{"onTime":74.933,"xyz":[16.924,60,-28.469]}},{"note":{"onTime":75,"xyz":[-25.259,60,-2.704]}},{"note":{"onTime":75.058,"xyz":[29.684,60,-47.154]}},{"note":{"onTime":75.125,"xyz":[23.201,60,-23.42]}},{"note":{"onTime":75.183,"xyz":[14.869,60,-12.877]}},{"note":{"onTime":75.25,"xyz":[-26.095,60,-4.141]}},{"note":{"onTime":75.308,"xyz":[-28.479,60,37.714]}},{"note":{"onTime":75.375,"xyz":[-26.565,60,1.993]}},{"note":{"onTime":75.433,"xyz":[33.617,60,-24.111]}},{"note":{"onTime":75.5,"xyz":[-25.635,60,-45.832]}},{"note":{"onTime":75.558,"xyz":[32.267,60,4.208]}},{"note":{"onTime":75.625,"xyz":[-2.697,60,44.594]}},{"note":{"onTime":75.683,"xyz":[13.105,60,-34.149]}},{"note":{"onTime":75.75,"xyz":[-4.468,60,-12.006]}},{"note":{"onTime":75.808,"xyz":[17.621,60,-48.772]}},{"note":{"onTime":75.875,"xyz":[-20.802,60,46.488]}},{"note":{"onTime":75.933,"xyz":[16.146,60,-23.842]}},{"note":{"onTime":76,"xyz":[-44.64,60,-41.513]}},{"note":{"onTime":76.058,"xyz":[-25.914,60,24.391]}},{"note":{"onTime":76.125,"xyz":[41.814,60,35.275]}},{"note":{"onTime":76.183,"xyz":[47.911,60,2.407]}},{"note":{"onTime":76.25,"xyz":[22.93,60,-41.818]}},{"note":{"onTime":76.308,"xyz":[-0.286,60,-22.431]}},{"note":{"onTime":76.375,"xyz":[-9.233,60,-16.076]}},{"note":{"onTime":76.433,"xyz":[-4.97,60,43.079]}},{"note":{"onTime":76.5,"xyz":[-39.026,60,27.182]}},{"note":{"onTime":76.558,"xyz":[-35.693,60,6.016]}},{"note":{"onTime":76.625,"xyz":[26.504,60,-31.195]}},{"note":{"onTime":76.683,"xyz":[-29.732,60,9.274]}},{"note":{"onTime":76.75,"xyz":[19.275,60,16.702]}},{"note":{"onTime":76.808,"xyz":[-12.459,60,5.759]}},{"note":{"onTime":76.875,"xyz":[46.933,60,-44.459]}},{"note":{"onTime":76.933,"xyz":[-26.304,60,-15.071]}},{"note":{"onTime":77,"xyz":[-35.115,60,42.159]}},{"note":{"onTime":77.058,"xyz":[48.429,60,38.951]}},{"note":{"onTime":77.125,"xyz":[-10.784,60,-32.605]}},{"note":{"onTime":77.183,"xyz":[6.311,60,29.725]}},{"note":{"onTime":77.25,"xyz":[-39.9,60,-6.991]}},{"note":{"onTime":77.308,"xyz":[24.577,60,9.861]}},{"note":{"onTime":77.375,"xyz":[-15.848,60,15.843]}},{"note":{"onTime":77.433,"xyz":[-2.968,60,41.845]}},{"note":{"onTime":77.5,"xyz":[24.122,60,-8.496]}},{"note":{"onTime":77.558,"xyz":[-15.346,60,-18.793]}},{"note":{"onTime":77.625,"xyz":[21.608,60,-1.936]}},{"note":{"onTime":77.683,"xyz":[29.009,60,22.789]}},{"note":{"onTime":77.75,"xyz":[39.353,60,17.563]}},{"note":{"onTime":77.808,"xyz":[-17.471,60,-14.5]}},{"note":{"onTime":77.875,"xyz":[-49.592,60,-9.006]}},{"note":{"onTime":77.933,"xyz":[-23.807,60,11.423]}},{"note":{"onTime":78,"xyz":[-11.747,60,41.947]}},{"note":{"onTime":78.058,"xyz":[26.502,60,11.094]}},{"note":{"onTime":78.125,"xyz":[-38.855,60,-3.34]}},{"note":{"onTime":78.183,"xyz":[-13.91,60,-20.542]}},{"note":{"onTime":78.25,"xyz":[31.702,60,34.917]}},{"note":{"onTime":78.308,"xyz":[22.073,60,-32.361]}},{"note":{"onTime":78.375,"xyz":[25.331,60,18.469]}},{"note":{"onTime":78.433,"xyz":[-30.348,60,5.541]}},{"note":{"onTime":78.5,"xyz":[-35.192,60,42.573]}},{"note":{"onTime":78.558,"xyz":[11.679,60,-39.391]}},{"note":{"onTime":78.625,"xyz":[-10.66,60,-26.865]}},{"note":{"onTime":78.683,"xyz":[-15.775,60,-29.853]}},{"note":{"onTime":78.75,"xyz":[11.087,60,48.053]}},{"note":{"onTime":78.808,"xyz":[-40.152,60,29.602]}},{"note":{"onTime":78.875,"xyz":[46.567,60,-32.049]}},{"note":{"onTime":78.933,"xyz":[20.51,60,38.456]}},{"note":{"onTime":79,"xyz":[40.964,60,-40.217]}},{"note":{"onTime":79.058,"xyz":[-42.807,60,30.094]}},{"note":{"onTime":79.125,"xyz":[36.249,60,-1.935]}},{"note":{"onTime":79.183,"xyz":[29.457,60,23.411]}},{"note":{"onTime":79.25,"xyz":[25.527,60,-6.032]}},{"note":{"onTime":79.308,"xyz":[41.699,60,-36.654]}},{"note":{"onTime":79.375,"xyz":[42.39,60,43.479]}},{"note":{"onTime":79.433,"xyz":[-49.954,60,46.134]}},{"note":{"onTime":79.5,"xyz":[-38.528,60,43.504]}},{"note":{"onTime":79.558,"xyz":[-39.276,60,-15.87]}},{"note":{"onTime":79.625,"xyz":[-8.79,60,-29.573]}},{"note":{"onTime":79.683,"xyz":[23.878,60,35.898]}},{"note":{"onTime":79.75,"xyz":[28.176,60,-49.49]}},{"note":{"onTime":79.808,"xyz":[22.169,60,40.987]}},{"note":{"onTime":79.875,"xyz":[-29.424,60,-33.152]}},{"note":{"onTime":79.933,"xyz":[7.524,60,36.835]}},{"note":{"onTime":80,"xyz":[-37.163,60,24.651]}},{"note":{"onTime":80.058,"xyz":[8.238,60,28.685]}},{"note":{"onTime":80.125,"xyz":[19.837,60,-33.379]}},{"note":{"onTime":80.183,"xyz":[18.563,60,13.567]}},{"note":{"onTime":80.25,"xyz":[-35.378,60,-25.537]}},{"note":{"onTime":80.308,"xyz":[-49.761,60,-42.429]}},{"note":{"onTime":80.375,"xyz":[-36.486,60,42.257]}},{"note":{"onTime":80.433,"xyz":[-23.751,60,-27.045]}},{"note":{"onTime":80.5,"xyz":[-36.253,60,43.838]}},{"note":{"onTime":80.558,"xyz":[-12.145,60,-30.488]}},{"note":{"onTime":80.625,"xyz":[-12.737,60,-29.257]}},{"note":{"onTime":80.683,"xyz":[22.747,60,44.144]}},{"note":{"onTime":80.75,"xyz":[16.448,60,-29.115]}},{"note":{"onTime":80.808,"xyz":[-38.676,60,-44.902]}},{"note":{"onTime":80.875,"xyz":[-20.424,60,2.206]}},{"note":{"onTime":80.933,"xyz":[35.868,60,-15.897]}},{"note":{"onTime":81,"xyz":[11.755,60,11.337]}},{"note":{"onTime":81.058,"xyz":[9.969,60,-48.197]}},{"note":{"onTime":81.125,"xyz":[-12.372,60,-13.891]}},{"note":{"onTime":81.183,"xyz":[-30.747,60,0.834]}},{"note":{"onTime":81.25,"xyz":[1.034,60,-6.308]}},{"note":{"onTime":81.308,"xyz":[-24.489,60,27.796]}},{"note":{"onTime":81.375,"xyz":[-39.266,60,34.645]}},{"note":{"onTime":81.433,"xyz":[-19.073,60,11.447]}},{"note":{"onTime":81.5,"xyz":[-13.793,60,-1.709]}},{"note":{"onTime":81.558,"xyz":[33.61,60,-18.921]}},{"note":{"onTime":81.625,"xyz":[-20.172,60,28.029]}},{"note":{"onTime":81.683,"xyz":[36.177,60,-22.714]}},{"note":{"onTime":81.75,"xyz":[27.611,60,-22.505]}},{"note":{"onTime":81.808,"xyz":[2.056,60,8.645]}},{"note":{"onTime":81.875,"xyz":[-3.572,60,-8.627]}},{"note":{"onTime":81.933,"xyz":[-4.324,60,-16.708]}},{"note":{"onTime":82,"xyz":[-42.58,60,-40.825]}},{"note":{"onTime":82.058,"xyz":[-0.933,60,25.345]}},{"note":{"onTime":82.125,"xyz":[29.501,60,-2.17]}},{"note":{"onTime":82.183,"xyz":[24.811,60,-46.204]}},{"note":{"onTime":82.25,"xyz":[9.568,60,0.684]}},{"note":{"onTime":82.308,"xyz":[-49.881,60,37.148]}},{"note":{"onTime":82.375,"xyz":[-6.319,60,-22.311]}},{"note":{"onTime":82.433,"xyz":[-14.877,60,21.919]}},{"note":{"onTime":82.5,"xyz":[2.116,60,-14.495]}},{"note":{"onTime":82.558,"xyz":[-33.251,60,-1.515]}},{"note":{"onTime":82.625,"xyz":[-42.729,60,38.128]}},{"note":{"onTime":82.683,"xyz":[-6.171,60,-5.223]}},{"note":{"onTime":82.75,"xyz":[33.002,60,-20.233]}},{"note":{"onTime":82.808,"xyz":[45.765,60,8.359]}},{"note":{"onTime":82.875,"xyz":[-46.533,60,23.284]}},{"note":{"onTime":82.933,"xyz":[-37.662,60,-18.328]}},{"note":{"onTime":83,"xyz":[-24.902,60,-9.198]}},{"note":{"onTime":83.058,"xyz":[-37.691,60,24.913]}},{"note":{"onTime":83.125,"xyz":[-6.757,60,-30.646]}},{"note":{"onTime":83.183,"xyz":[49.712,60,-22.538]}},{"note":{"onTime":83.25,"xyz":[-18.47,60,-5.046]}},{"note":{"onTime":83.308,"xyz":[-44.799,60,3.15]}},{"note":{"onTime":83.375,"xyz":[-46.668,60,34.396]}},{"note":{"onTime":83.433,"xyz":[-7.991,60,18.291]}},{"note":{"onTime":83.5,"xyz":[37.182,60,26.799]}},{"note":{"onTime":83.558,"xyz":[28.006,60,-14.531]}},{"note":{"onTime":83.625,"xyz":[37.742,60,7.527]}},{"note":{"onTime":83.683,"xyz":[-6.569,60,-48.129]}},{"note":{"onTime":83.75,"xyz":[17.336,60,46.993]}},{"note":{"onTime":83.808,"xyz":[14.266,60,-0.26]}},{"note":{"onTime":83.875,"xyz":[36.252,60,27.203]}},{"note":{"onTime":83.933,"xyz":[-9.755,60,-10.499]}},{"note":{"onTime":84,"xyz":[39.373,60,30.906]}},{"note":{"onTime":84.058,"xyz":[-19.677,60,44.568]}},{"note":{"onTime":84.125,"xyz":[28.306,60,-36.727]}},{"note":{"onTime":84.183,"xyz":[23.375,60,32.017]}},{"note":{"onTime":84.25,"xyz":[18.481,60,45.257]}},{"note":{"onTime":84.308,"xyz":[-35.819,60,-33.534]}},{"note":{"onTime":84.375,"xyz":[5.762,60,42.477]}},{"note":{"onTime":84.433,"xyz":[-19.365,60,-13.153]}},{"note":{"onTime":84.5,"xyz":[-36.699,60,4.917]}},{"note":{"onTime":84.558,"xyz":[-26.163,60,-41.4]}},{"note":{"onTime":84.625,"xyz":[12.927,60,22.106]}},{"note":{"onTime":84.683,"xyz":[-5.471,60,18.372]}},{"note":{"onTime":84.75,"xyz":[-27.544,60,27.078]}},{"note":{"onTime":84.808,"xyz":[-6.469,60,35.807]}},{"note":{"onTime":84.875,"xyz":[27.312,60,41.477]}},{"note":{"onTime":84.933,"xyz":[6.546,60,-1.223]}},{"note":{"onTime":85,"xyz":[17.894,60,24.974]}},{"note":{"onTime":85.058,"xyz":[-28.668,60,-34.424]}},{"note":{"onTime":85.125,"xyz":[29.547,60,5.945]}},{"note":{"onTime":85.183,"xyz":[33.908,60,-48.428]}},{"note":{"onTime":85.25,"xyz":[25.986,60,8.336]}},{"note":{"onTime":85.308,"xyz":[-13.483,60,-40.342]}},{"note":{"onTime":85.375,"xyz":[35.894,60,-16.898]}},{"note":{"onTime":85.433,"xyz":[-0.317,60,4.983]}},{"note":{"onTime":85.5,"xyz":[-7.687,60,-17.223]}},{"note":{"onTime":85.558,"xyz":[20.17,60,-43.971]}},{"note":{"onTime":85.625,"xyz":[-8.204,60,15.891]}},{"note":{"onTime":85.683,"xyz":[12.232,60,-2.615]}},{"note":{"onTime":85.75,"xyz":[-8.914,60,-34.709]}},{"note":{"onTime":85.808,"xyz":[-22.558,60,45.851]}},{"note":{"onTime":85.875,"xyz":[49.9,60,-17.715]}},{"note":{"onTime":85.933,"xyz":[4.891,60,1.984]}},{"note":{"onTime":86,"xyz":[-34.871,60,-41.955]}},{"note":{"onTime":86.058,"xyz":[34.906,60,25.16]}},{"note":{"onTime":86.125,"xyz":[-19.014,60,-43.751]}},{"note":{"onTime":86.183,"xyz":[-28.14,60,-37.085]}},{"note":{"onTime":86.25,"xyz":[7.365,60,47.672]}},{"note":{"onTime":86.308,"xyz":[11.454,60,-24.068]}},{"note":{"onTime":86.375,"xyz":[-8.752,60,49.646]}},{"note":{"onTime":86.433,"xyz":[-38.788,60,-40.039]}},{"note":{"onTime":86.5,"xyz":[-30.25,60,22.226]}},{"note":{"onTime":86.558,"xyz":[-13.843,60,6.24]}},{"note":{"onTime":86.625,"xyz":[44.355,60,39.802]}},{"note":{"onTime":86.683,"xyz":[10.968,60,44.067]}},{"note":{"onTime":86.75,"xyz":[-39.421,60,23.012]}},{"note":{"onTime":86.808,"xyz":[11.542,60,4.18]}},{"note":{"onTime":86.875,"xyz":[11.742,60,12.388]}},{"note":{"onTime":86.933,"xyz":[39.185,60,10.845]}},{"note":{"onTime":87,"xyz":[16.108,60,-26.541]}},{"note":{"onTime":87.058,"xyz":[-4.284,60,-14.748]}},{"note":{"onTime":87.125,"xyz":[-0.446,60,-25.666]}},{"note":{"onTime":87.183,"xyz":[23.975,60,4.257]}},{"note":{"onTime":87.25,"xyz":[-42.561,60,-47.766]}},{"note":{"onTime":87.308,"xyz":[-48.228,60,37.886]}},{"note":{"onTime":87.375,"xyz":[25.693,60,16.444]}},{"note":{"onTime":87.433,"xyz":[34.408,60,-32.347]}},{"note":{"onTime":87.5,"xyz":[-31.417,60,2.785]}},{"note":{"onTime":87.558,"xyz":[37.922,60,-3.202]}},{"note":{"onTime":87.625,"xyz":[45.395,60,30.404]}},{"note":{"onTime":87.683,"xyz":[-1.77,60,-15.627]}},{"note":{"onTime":87.75,"xyz":[-43.336,60,-3.513]}},{"note":{"onTime":87.808,"xyz":[36.784,60,-1.128]}},{"note":{"onTime":87.875,"xyz":[48.785,60,9.878]}},{"note":{"onTime":87.933,"xyz":[17.336,60,-24.927]}},{"note":{"onTime":88,"xyz":[-19.818,60,-8.394]}},{"note":{"onTime":88.058,"xyz":[47.276,60,1.24]}},{"note":{"onTime":88.125,"xyz":[-21.16,60,-9.632]}},{"note":{"onTime":88.183,"xyz":[-33.065,60,43.987]}},{"note":{"onTime":88.25,"xyz":[-43.715,60,-44.769]}},{"note":{"onTime":88.308,"xyz":[-12.466,60,-33.734]}},{"note":{"onTime":88.375,"xyz":[43.194,60,7.534]}},{"note":{"onTime":88.433,"xyz":[39.34,60,-8.702]}},{"note":{"onTime":88.5,"xyz":[-17.025,60,40.4]}},{"note":{"onTime":88.558,"xyz":[32.31,60,43.102]}},{"note":{"onTime":88.625,"xyz":[18.242,60,-21.344]}},{"note":{"onTime":88.683,"xyz":[18.328,60,33.812]}},{"note":{"onTime":88.75,"xyz":[37.202,60,35.574]}},{"note":{"onTime":88.808,"xyz":[33.282,60,0.525]}},{"note":{"onTime":88.875,"xyz":[-31.048,60,36.931]}},{"note":{"onTime":88.933,"xyz":[-4.993,60,1.117]}},{"note":{"onTime":89,"xyz":[34.767,60,28.677]}},{"note":{"onTime":89.058,"xyz":[-4.298,60,-9.282]}},{"note":{"onTime":89.125,"xyz":[32.843,60,-26.711]}},{"note":{"onTime":89.183,"xyz":[-38.886,60,-0.581]}},{"note":{"onTime":89.25,"xyz":[-37.016,60,-47.142]}},{"note":{"onTime":89.308,"xyz":[9.84,60,48.709]}},{"note":{"onTime":89.375,"xyz":[41.565,60,-34.586]}},{"note":{"onTime":89.433,"xyz":[40.702,60,-39.755]}},{"note":{"onTime":89.5,"xyz":[22.032,60,6.194]}},{"note":{"onTime":89.558,"xyz":[-39.357,60,-42.869]}},{"note":{"onTime":89.625,"xyz":[-21.492,60,-1.339]}},{"note":{"onTime":89.683,"xyz":[46.14,60,16.192]}},{"note":{"onTime":89.75,"xyz":[35.931,60,-37.506]}},{"note":{"onTime":89.808,"xyz":[-35.941,60,31.006]}},{"note":{"onTime":89.875,"xyz":[-4.116,60,8.554]}},{"note":{"onTime":89.933,"xyz":[-30.635,60,-29.085]}},{"note":{"onTime":90,"xyz":[19.093,60,15.414]}},{"note":{"onTime":90.058,"xyz":[3.455,60,2.239]}},{"note":{"onTime":90.125,"xyz":[39.724,60,-0.446]}},{"note":{"onTime":90.183,"xyz":[44.328,60,-44.457]}},{"note":{"onTime":90.25,"xyz":[9.371,60,23.049]}},{"note":{"onTime":90.308,"xyz":[-35.425,60,8.5]}},{"note":{"onTime":90.375,"xyz":[-43.783,60,19.79]}},{"note":{"onTime":90.433,"xyz":[41.57,60,-11.292]}},{"note":{"onTime":90.5,"xyz":[3.55,60,45.216]}},{"note":{"onTime":90.558,"xyz":[-7.539,60,16.196]}},{"note":{"onTime":90.625,"xyz":[-22.162,60,-3.582]}},{"note":{"onTime":90.683,"xyz":[-19.143,60,-17.628]}},{"note":{"onTime":90.75,"xyz":[-43.781,60,-9.418]}},{"note":{"onTime":90.808,"xyz":[18.798,60,32.202]}},{"note":{"onTime":90.875,"xyz":[12.699,60,-38.665]}},{"note":{"onTime":90.933,"xyz":[-27.171,60,-39.356]}},{"note":{"onTime":91,"xyz":[27.959,60,15.859]}},{"note":{"onTime":91.058,"xyz":[33.096,60,-15.939]}},{"note":{"onTime":91.125,"xyz":[-14.447,60,21.89]}},{"note":{"onTime":91.183,"xyz":[25.585,60,-16.224]}},{"note":{"onTime":91.25,"xyz":[-6.218,60,44.228]}},{"note":{"onTime":91.308,"xyz":[-3.842,60,-26.683]}},{"note":{"onTime":91.375,"xyz":[3.908,60,-43.679]}},{"note":{"onTime":91.433,"xyz":[-22.853,60,-5.486]}},{"note":{"onTime":91.5,"xyz":[47.766,60,-4.81]}},{"note":{"onTime":91.558,"xyz":[19.279,60,31.692]}},{"note":{"onTime":91.625,"xyz":[47.665,60,38.57]}},{"note":{"onTime":91.683,"xyz":[39.738,60,29.011]}},{"note":{"onTime":91.75,"xyz":[-35.187,60,43.036]}},{"note":{"onTime":91.808,"xyz":[-42.407,60,34.77]}},{"note":{"onTime":91.875,"xyz":[5.734,60,22.196]}},{"note":{"onTime":91.933,"xyz":[-33.176,60,-40.531]}},{"note":{"onTime":92,"xyz":[5.48,60,46.107]}},{"note":{"onTime":92.058,"xyz":[-8.97,60,-47.1]}},{"note":{"onTime":92.125,"xyz":[8.06,60,38.043]}},{"note":{"onTime":92.183,"xyz":[-21.167,60,-39.293]}},{"note":{"onTime":92.25,"xyz":[-25.188,60,14.054]}},{"note":{"onTime":92.308,"xyz":[-8.705,60,43.981]}},{"note":{"onTime":92.375,"xyz":[26.495,60,-14.624]}},{"note":{"onTime":92.433,"xyz":[8.515,60,17.853]}},{"note":{"onTime":92.5,"xyz":[-28.89,60,5.266]}},{"note":{"onTime":92.558,"xyz":[-1.666,60,17.844]}},{"note":{"onTime":92.625,"xyz":[42.955,60,21.154]}},{"note":{"onTime":92.683,"xyz":[-48.14,60,17.321]}},{"note":{"onTime":92.75,"xyz":[-14.413,60,-28.334]}},{"note":{"onTime":92.808,"xyz":[-45.301,60,26.886]}},{"note":{"onTime":92.875,"xyz":[8.303,60,-22.86]}},{"note":{"onTime":92.933,"xyz":[35.529,60,-11.708]}},{"note":{"onTime":93,"xyz":[38.837,60,-6.95]}},{"note":{"onTime":93.058,"xyz":[-28.737,60,-37.32]}},{"note":{"onTime":93.125,"xyz":[40.387,60,-40.471]}},{"note":{"onTime":93.183,"xyz":[36.713,60,-13.145]}},{"note":{"onTime":93.25,"xyz":[-34.945,60,-31.823]}},{"note":{"onTime":93.308,"xyz":[22.726,60,-36.789]}},{"note":{"onTime":93.375,"xyz":[34.682,60,10.781]}},{"note":{"onTime":93.433,"xyz":[16.386,60,40.027]}},{"note":{"onTime":93.5,"xyz":[-20.048,60,-45.229]}},{"note":{"onTime":93.558,"xyz":[-3.663,60,-39.541]}},{"note":{"onTime":93.625,"xyz":[-14.04,60,38.352]}},{"note":{"onTime":93.683,"xyz":[-48.135,60,-8.187]}},{"note":{"onTime":93.75,"xyz":[-6.703,60,-24.352]}},{"note":{"onTime":93.808,"xyz":[42.278,60,22.995]}},{"note":{"onTime":93.875,"xyz":[44.438,60,40.003]}},{"note":{"onTime":93.933,"xyz":[-20.376,60,18.504]}},{"note":{"onTime":94,"xyz":[-47.972,60,33.135]}},{"note":{"onTime":94.058,"xyz":[-0.853,60,-26.72]}},{"note":{"onTime":94.125,"xyz":[-45.167,60,-19.617]}},{"note":{"onTime":94.183,"xyz":[-15.695,60,5.413]}},{"note":{"onTime":94.25,"xyz":[24.863,60,-1.016]}},{"note":{"onTime":94.308,"xyz":[-7.024,60,-15.634]}},{"note":{"onTime":94.375,"xyz":[-48.229,60,-1.432]}},{"note":{"onTime":94.433,"xyz":[-5.15,60,2.205]}},{"note":{"onTime":94.5,"xyz":[-35.646,60,-28.045]}},{"note":{"onTime":94.558,"xyz":[33.219,60,-14.321]}},{"note":{"onTime":94.625,"xyz":[9.967,60,-48.761]}},{"note":{"onTime":94.683,"xyz":[-26.29,60,-0.952]}},{"note":{"onTime":94.75,"xyz":[7.325,60,20.269]}},{"note":{"onTime":94.808,"xyz":[-45.845,60,32.562]}},{"note":{"onTime":94.875,"xyz":[-27.354,60,21.2]}},{"note":{"onTime":94.933,"xyz":[10.047,60,-9.263]}},{"note":{"onTime":95,"xyz":[-0.384,60,-48.892]}},{"note":{"onTime":95.058,"xyz":[-24.867,60,19.287]}},{"note":{"onTime":95.125,"xyz":[6.611,60,45.911]}},{"note":{"onTime":95.183,"xyz":[-47.118,60,20.999]}},{"note":{"onTime":95.25,"xyz":[-43.912,60,-25.649]}},{"note":{"onTime":95.308,"xyz":[-21.894,60,40.204]}},{"note":{"onTime":95.375,"xyz":[-42.59,60,45.727]}},{"note":{"onTime":95.433,"xyz":[45.127,60,24.166]}},{"note":{"onTime":95.5,"xyz":[-8.18,60,-47.254]}},{"note":{"onTime":95.558,"xyz":[25.887,60,28.724]}},{"note":{"onTime":95.625,"xyz":[3.048,60,-43.462]}},{"note":{"onTime":95.683,"xyz":[44.422,60,6.391]}},{"note":{"onTime":95.75,"xyz":[-14.566,60,-44.319]}},{"note":{"onTime":95.808,"xyz":[-30.435,60,28.822]}},{"note":{"onTime":95.875,"xyz":[29.658,60,-3.518]}},{"note":{"onTime":95.933,"xyz":[41.737,60,33.606]}},{"note":{"onTime":96,"xyz":[-39.519,60,-41.237]}},{"note":{"onTime":96.058,"xyz":[18.518,60,-21.253]}},{"note":{"onTime":96.125,"xyz":[-22.411,60,21.435]}},{"note":{"onTime":96.183,"xyz":[13.66,60,18.408]}},{"note":{"onTime":96.25,"xyz":[-4.162,60,-43.607]}},{"note":{"onTime":96.308,"xyz":[-28.539,60,11.625]}},{"note":{"onTime":96.375,"xyz":[31.348,60,48.953]}},{"note":{"onTime":96.433,"xyz":[-30.686,60,23.053]}},{"note":{"onTime":96.5,"xyz":[1.045,60,-20.502]}},{"note":{"onTime":96.558,"xyz":[31.967,60,2.649]}},{"note":{"onTime":96.625,"xyz":[-48.189,60,-44.637]}},{"note":{"onTime":96.683,"xyz":[-22.16,60,20.754]}},{"note":{"onTime":96.75,"xyz":[17.515,60,35.647]}},{"note":{"onTime":96.808,"xyz":[-43.098,60,17.529]}},{"note":{"onTime":96.875,"xyz":[-25.826,60,-24.32]}},{"note":{"onTime":96.933,"xyz":[-12.612,60,-17.531]}},{"note":{"onTime":97,"xyz":[31.571,60,13.7]}},{"note":{"onTime":97.058,"xyz":[11.198,60,41.909]}},{"note":{"onTime":97.125,"xyz":[20.051,60,-38.949]}},{"note":{"onTime":97.183,"xyz":[-28.457,60,-18.639]}},{"note":{"onTime":97.25,"xyz":[10.227,60,20.21]}},{"note":{"onTime":97.308,"xyz":[27.422,60,-3.576]}},{"note":{"onTime":97.375,"xyz":[-2.822,60,-26.599]}},{"note":{"onTime":97.433,"xyz":[-35.862,60,32.122]}},{"note":{"onTime":97.5,"xyz":[-4.336,60,39.739]}},{"note":{"onTime":97.558,"xyz":[-6.439,60,-32.911]}},{"note":{"onTime":97.625,"xyz":[-14.852,60,21.974]}},{"note":{"onTime":97.683,"xyz":[-31.627,60,7.352]}},{"note":{"onTime":97.75,"xyz":[19.337,60,36.295]}},{"note":{"onTime":97.808,"xyz":[17.47,60,5.706]}},{"note":{"onTime":97.875,"xyz":[30.62,60,-28.543]}},{"note":{"onTime":97.933,"xyz":[-48.803,60,-1.83]}},{"note":{"onTime":98,"xyz":[21.648,60,38.066]}},{"note":{"onTime":98.058,"xyz":[41.415,60,-20.018]}},{"note":{"onTime":98.125,"xyz":[0.437,60,-23.628]}},{"note":{"onTime":98.183,"xyz":[-41.121,60,11.253]}},{"note":{"onTime":98.25,"xyz":[-11.882,60,-27.356]}},{"note":{"onTime":98.308,"xyz":[5.155,60,-21.959]}},{"note":{"onTime":98.375,"xyz":[-33.907,60,21.431]}},{"note":{"onTime":98.433,"xyz":[14.705,60,19.494]}},{"note":{"onTime":98.5,"xyz":[38.004,60,44.924]}},{"note":{"onTime":98.558,"xyz":[-19.009,60,-2.987]}},{"note":{"onTime":98.625,"xyz":[17.987,60,-27.474]}},{"note":{"onTime":98.683,"xyz":[-15.256,60,8.451]}},{"note":{"onTime":98.75,"xyz":[26.3,60,-25.133]}},{"note":{"onTime":98.808,"xyz":[29.235,60,-29.603]}},{"note":{"onTime":98.875,"xyz":[32.893,60,-31.942]}},{"note":{"onTime":98.933,"xyz":[22.616,60,-14.209]}},{"note":{"onTime":99,"xyz":[45.043,60,37.31]}},{"note":{"onTime":99.058,"xyz":[47.511,60,13.882]}},{"note":{"onTime":99.125,"xyz":[43.098,60,5.281]}},{"note":{"onTime":99.183,"xyz":[29.206,60,45.907]}},{"note":{"onTime":99.25,"xyz":[34.882,60,-28.976]}},{"note":{"onTime":99.308,"xyz":[12.361,60,-5.69]}},{"note":{"onTime":99.375,"xyz":[-19.367,60,1.361]}},{"note":{"onTime":99.433,"xyz":[-11.749,60,6.902]}},{"note":{"onTime":99.5,"xyz":[42.836,60,49.184]}},{"note":{"onTime":99.558,"xyz":[36.554,60,-48.53]}},{"note":{"onTime":99.625,"xyz":[-4.959,60,33.818]}},{"note":{"onTime":99.683,"xyz":[-36.255,60,-37.883]}},{"note":{"onTime":99.75,"xyz":[-12.819,60,28.466]}},{"note":{"onTime":99.808,"xyz":[-9.43,60,27.414]}},{"note":{"onTime":99.875,"xyz":[-31.886,60,-9.94]}},{"note":{"onTime":99.933,"xyz":[-29.899,60,13.404]}},{"note":{"onTime":100,"xyz":[15.4,60,18.932]}},{"note":{"onTime":100.058,"xyz":[-38.326,60,-17.02]}},{"note":{"onTime":100.125,"xyz":[-25.953,60,-19.32]}},{"note":{"onTime":100.183,"xyz":[-48.995,60,-21.679]}},{"note":{"onTime":100.25,"xyz":[-33.858,60,41.916]}},{"note":{"onTime":100.308,"xyz":[49.026,60,6.209]}},{"note":{"onTime":100.375,"xyz":[-41.564,60,-3.785]}},{"note":{"onTime":100.433,"xyz":[27.888,60,-11.558]}},{"note":{"onTime":100.5,"xyz":[-28.88,60,-31.925]}},{"note":{"onTime":100.558,"xyz":[18.268,60,42.342]}},{"note":{"onTime":100.625,"xyz":[34.557,60,12.044]}},{"note":{"onTime":100.683,"xyz":[3.981,60,20.966]}},{"note":{"onTime":100.75,"xyz":[-42.113,60,-47.191]}},{"note":{"onTime":100.808,"xyz":[-35.988,60,0.089]}},{"note":{"onTime":100.875,"xyz":[20.374,60,-28.876]}},{"note":{"onTime":100.933,"xyz":[34.862,60,30.817]}},{"note":{"onTime":101,"xyz":[39.433,60,11.232]}},{"note":{"onTime":101.058,"xyz":[-46.31,60,13.856]}},{"note":{"onTime":101.125,"xyz":[-35.295,60,-0.758]}},{"note":{"onTime":101.183,"xyz":[1.446,60,-24.583]}},{"note":{"onTime":101.25,"xyz":[1.526,60,-0.124]}},{"note":{"onTime":101.308,"xyz":[-48.827,60,-33.388]}},{"note":{"onTime":101.375,"xyz":[35.987,60,32.474]}},{"note":{"onTime":101.433,"xyz":[46.36,60,49.323]}},{"note":{"onTime":101.5,"xyz":[23.756,60,-2.671]}},{"note":{"onTime":101.558,"xyz":[43.624,60,3.094]}},{"note":{"onTime":101.625,"xyz":[-27.931,60,-38.46]}},{"note":{"onTime":101.683,"xyz":[-40.373,60,-29.084]}},{"note":{"onTime":101.75,"xyz":[-4.796,60,0.979]}},{"note":{"onTime":101.808,"xyz":[20.006,60,-11.975]}},{"note":{"onTime":101.875,"xyz":[14.489,60,22.74]}},{"note":{"onTime":101.933,"xyz":[24.61,60,-11.671]}},{"note":{"onTime":102,"xyz":[10.669,60,-17.939]}},{"note":{"onTime":102.058,"xyz":[-25.307,60,-10.954]}},{"note":{"onTime":102.125,"xyz":[-24.345,60,-9.842]}},{"note":{"onTime":102.183,"xyz":[-39.858,60,-3.205]}},{"note":{"onTime":102.25,"xyz":[-41.586,60,-33.802]}},{"note":{"onTime":102.308,"xyz":[34.607,60,-10.963]}},{"note":{"onTime":102.375,"xyz":[12.368,60,48.828]}},{"note":{"onTime":102.433,"xyz":[19.787,60,-15.381]}},{"note":{"onTime":102.5,"xyz":[35.34,60,31.604]}},{"note":{"onTime":102.558,"xyz":[33.335,60,-42.479]}},{"note":{"onTime":102.625,"xyz":[4.145,60,-46.459]}},{"note":{"onTime":102.683,"xyz":[34.172,60,49.936]}},{"note":{"onTime":102.75,"xyz":[-49.454,60,42.167]}},{"note":{"onTime":102.808,"xyz":[-19.343,60,35.842]}},{"note":{"onTime":102.875,"xyz":[-40.252,60,2.982]}},{"note":{"onTime":102.933,"xyz":[7.314,60,-44.525]}},{"note":{"onTime":103,"xyz":[3.205,60,-42.428]}},{"note":{"onTime":103.058,"xyz":[0.914,60,15.794]}},{"note":{"onTime":103.125,"xyz":[0.387,60,-16.111]}},{"note":{"onTime":103.183,"xyz":[2.897,60,13.481]}},{"note":{"onTime":103.25,"xyz":[45.692,60,-12.337]}},{"note":{"onTime":103.308,"xyz":[38.67,60,16.395]}},{"note":{"onTime":103.375,"xyz":[-6.989,60,-35.077]}},{"note":{"onTime":103.433,"xyz":[-18.579,60,18.015]}},{"note":{"onTime":103.5,"xyz":[-32.096,60,-16.766]}},{"note":{"onTime":103.558,"xyz":[-44.911,60,-11.498]}},{"note":{"onTime":103.625,"xyz":[32.138,60,44.923]}},{"note":{"onTime":103.683,"xyz":[-25.828,60,-33.205]}},{"note":{"onTime":103.75,"xyz":[-36.294,60,-19.567]}},{"note":{"onTime":103.808,"xyz":[-36.52,60,1.932]}},{"note":{"onTime":103.875,"xyz":[-6.339,60,-14.745]}},{"note":{"onTime":103.933,"xyz":[4.945,60,39.779]}},{"note":{"onTime":104,"xyz":[-34.548,60,40.967]}},{"note":{"onTime":104.058,"xyz":[-22.568,60,-5.201]}},{"note":{"onTime":104.125,"xyz":[9.055,60,-19.084]}},{"note":{"onTime":104.183,"xyz":[-4.543,60,26.675]}},{"note":{"onTime":104.25,"xyz":[-42.5,60,-44.709]}},{"note":{"onTime":104.308,"xyz":[-30.011,60,-10.256]}},{"note":{"onTime":104.375,"xyz":[33.444,60,-49.89]}},{"note":{"onTime":104.433,"xyz":[15.39,60,20.562]}},{"note":{"onTime":104.5,"xyz":[4.675,60,0.977]}},{"note":{"onTime":104.558,"xyz":[-32.705,60,6.747]}},{"note":{"onTime":104.625,"xyz":[5.938,60,46.958]}},{"note":{"onTime":104.683,"xyz":[-37,60,19.813]}},{"note":{"onTime":104.75,"xyz":[-43.393,60,-26.553]}},{"note":{"onTime":104.808,"xyz":[25.152,60,27.204]}},{"note":{"onTime":104.875,"xyz":[25.711,60,27.046]}},{"note":{"onTime":104.933,"xyz":[-12.772,60,5.504]}},{"note":{"onTime":105,"xyz":[13.887,60,31.251]}},{"note":{"onTime":105.058,"xyz":[-38.076,60,-11.031]}},{"note":{"onTime":105.125,"xyz":[-7.778,60,20.488]}},{"note":{"onTime":105.183,"xyz":[-12.74,60,-13.496]}},{"note":{"onTime":105.25,"xyz":[-33.02,60,23.092]}},{"note":{"onTime":105.308,"xyz":[46.226,60,17.035]}},{"note":{"onTime":105.375,"xyz":[-16.958,60,-7.801]}},{"note":{"onTime":105.433,"xyz":[-49.546,60,29.422]}},{"note":{"onTime":105.5,"xyz":[43.821,60,-11.229]}},{"note":{"onTime":105.558,"xyz":[-37.167,60,19.548]}},{"note":{"onTime":105.625,"xyz":[-32.282,60,-5.938]}},{"note":{"onTime":105.683,"xyz":[14.594,60,15.61]}},{"note":{"onTime":105.75,"xyz":[27.05,60,-48.759]}},{"note":{"onTime":105.808,"xyz":[5.258,60,3.839]}},{"note":{"onTime":105.875,"xyz":[-18.895,60,38.676]}},{"note":{"onTime":105.933,"xyz":[-34.609,60,-7.6]}},{"note":{"onTime":106,"xyz":[26.806,60,41.976]}},{"note":{"onTime":106.058,"xyz":[-31.586,60,-7.83]}},{"note":{"onTime":106.125,"xyz":[4.608,60,49.377]}},{"note":{"onTime":106.183,"xyz":[5.182,60,10.77]}},{"note":{"onTime":106.25,"xyz":[20.028,60,26.812]}},{"note":{"onTime":106.308,"xyz":[39.828,60,41.865]}},{"note":{"onTime":106.375,"xyz":[28.779,60,-33.792]}},{"note":{"onTime":106.433,"xyz":[-46.252,60,-33.379]}},{"note":{"onTime":106.5,"xyz":[-7.8,60,24.474]}},{"note":{"onTime":106.558,"xyz":[12.809,60,-0.471]}},{"note":{"onTime":106.625,"xyz":[-4.314,60,12.546]}},{"note":{"onTime":106.683,"xyz":[-32.791,60,-12.142]}},{"note":{"onTime":106.75,"xyz":[42.464,60,34.965]}},{"note":{"onTime":106.808,"xyz":[-29.956,60,44.036]}},{"note":{"onTime":106.875,"xyz":[44.52,60,-47.954]}},{"note":{"onTime":106.933,"xyz":[-14.082,60,34.456]}},{"note":{"onTime":107,"xyz":[38.068,60,19.999]}},{"note":{"onTime":107.058,"xyz":[11.025,60,-2.029]}},{"note":{"onTime":107.125,"xyz":[8.848,60,-9.38]}},{"note":{"onTime":107.183,"xyz":[47.294,60,3.701]}},{"note":{"onTime":107.25,"xyz":[29.047,60,2.686]}},{"note":{"onTime":107.308,"xyz":[21.778,60,12.222]}},{"note":{"onTime":107.375,"xyz":[38.977,60,3.111]}},{"note":{"onTime":107.433,"xyz":[24.539,60,-42.202]}},{"note":{"onTime":107.5,"xyz":[-40.888,60,-21.375]}},{"note":{"onTime":107.558,"xyz":[10.301,60,-46.604]}},{"note":{"onTime":107.625,"xyz":[47.838,60,-10.635]}},{"note":{"onTime":107.683,"xyz":[-22.831,60,16.031]}},{"note":{"onTime":107.75,"xyz":[33.66,60,-44.373]}},{"note":{"onTime":107.808,"xyz":[-43.834,60,48.763]}},{"note":{"onTime":107.875,"xyz":[3.859,60,-10.61]}},{"note":{"onTime":107.933,"xyz":[24.296,60,-21.35]}},{"note":{"onTime":108,"xyz":[30.851,60,-35.774]}},{"note":{"onTime":108.058,"xyz":[47.725,60,-31.598]}},{"note":{"onTime":108.125,"xyz":[19.235,60,12.278]}},{"note":{"onTime":108.183,"xyz":[-23.392,60,-25.298]}},{"note":{"onTime":108.25,"xyz":[-33.31,60,6.187]}},{"note":{"onTime":108.308,"xyz":[5.343,60,49.243]}},{"note":{"onTime":108.375,"xyz":[7.054,60,-41.413]}},{"note":{"onTime":108.433,"xyz":[-12.027,60,-49.043]}},{"note":{"onTime":108.5,"xyz":[-49.95,60,33.186]}},{"note":{"onTime":108.558,"xyz":[14.106,60,-9.312]}},{"note":{"onTime":108.625,"xyz":[5.701,60,40.868]}},{"note":{"onTime":108.683,"xyz":[12.61,60,44.149]}},{"note":{"onTime":108.75,"xyz":[-11.425,60,-27.148]}},{"note":{"onTime":108.808,"xyz":[14.441,60,-23.49]}},{"note":{"onTime":108.875,"xyz":[-6.006,60,32.022]}},{"note":{"onTime":108.933,"xyz":[-21.236,60,3.697]}},{"note":{"onTime":109,"xyz":[31.399,60,44.362]}},{"note":{"onTime":109.058,"xyz":[24.083,60,2.699]}},{"note":{"onTime":109.125,"xyz":[45.471,60,-3.823]}},{"note":{"onTime":109.183,"xyz":[14.825,60,-42.898]}},{"note":{"onTime":109.25,"xyz":[-40.384,60,30.777]}},{"note":{"onTime":109.308,"xyz":[-10.174,60,15.956]}},{"note":{"onTime":109.375,"xyz":[-4.724,60,-18.225]}},{"note":{"onTime":109.433,"xyz":[-11.178,60,35.213]}},{"note":{"onTime":109.5,"xyz":[-39.554,60,0.295]}},{"note":{"onTime":109.558,"xyz":[-7.501,60,-7.475]}},{"note":{"onTime":109.625,"xyz":[18.091,60,-18.449]}},{"note":{"onTime":109.683,"xyz":[47.237,60,-0.461]}},{"note":{"onTime":109.75,"xyz":[46.026,60,-6.374]}},{"note":{"onTime":109.808,"xyz":[-46.405,60,12.035]}},{"note":{"onTime":109.875,"xyz":[40.524,60,-10.909]}},{"note":{"onTime":109.933,"xyz":[-35.932,60,38.8]}},{"note":{"onTime":110,"xyz":[2.772,60,19.667]}},{"note":{"onTime":110.058,"xyz":[17.013,60,6.053]}},{"note":{"onTime":110.125,"xyz":[36.419,60,6.666]}},{"note":{"onTime":110.183,"xyz":[36.09,60,26.906]}},{"note":{"onTime":110.25,"xyz":[-17.762,60,26.656]}},{"note":{"onTime":110.308,"xyz":[4.315,60,-13.964]}},{"note":{"onTime":110.375,"xyz":[-21.491,60,-15.979]}},{"note":{"onTime":110.433,"xyz":[-14.76,60,-40.456]}},{"note":{"onTime":110.5,"xyz":[-30.576,60,41.016]}},{"note":{"onTime":110.558,"xyz":[-33.027,60,-19.64]}},{"note":{"onTime":110.625,"xyz":[44.858,60,-7.198]}},{"note":{"onTime":110.683,"xyz":[-45.929,60,11.574]}},{"note":{"onTime":110.75,"xyz":[-10.541,60,-8.949]}},{"note":{"onTime":110.808,"xyz":[-15.984,60,35.114]}},{"note":{"onTime":110.875,"xyz":[3.517,60,-33.674]}},{"note":{"onTime":110.933,"xyz":[5.206,60,-17.597]}},{"note":{"onTime":111,"xyz":[38.596,60,-42.303]}},{"note":{"onTime":111.058,"xyz":[-21.472,60,-41.636]}},{"note":{"onTime":111.125,"xyz":[23.853,60,-40.637]}},{"note":{"onTime":111.183,"xyz":[-39.262,60,21.547]}},{"note":{"onTime":111.25,"xyz":[-49.528,60,19.512]}},{"note":{"onTime":111.308,"xyz":[-48.568,60,12.552]}},{"note":{"onTime":111.375,"xyz":[-12.036,60,7.625]}},{"note":{"onTime":111.433,"xyz":[42.509,60,-48.455]}},{"note":{"onTime":111.5,"xyz":[33.552,60,-15.91]}},{"note":{"onTime":111.558,"xyz":[-44.003,60,-15.274]}},{"note":{"onTime":111.625,"xyz":[0.635,60,-8.346]}},{"note":{"onTime":111.683,"xyz":[-0.8,60,30.429]}},{"note":{"onTime":111.75,"xyz":[40.697,60,23.089]}},{"note":{"onTime":111.808,"xyz":[-38.501,60,-10.705]}},{"note":{"onTime":111.875,"xyz":[21.265,60,34.789]}},{"note":{"onTime":111.933,"xyz":[31.18,60,20.935]}},{"note":{"onTime":112,"xyz":[-43.187,60,-46.938]}},{"note":{"onTime":112.058,"xyz":[-20.512,60,-17.01]}},{"note":{"onTime":112.125,"xyz":[-33.793,60,-10.097]}},{"note":{"onTime":112.183,"xyz":[49.046,60,-41.369]}},{"note":{"onTime":112.25,"xyz":[15.489,60,29.271]}},{"note":{"onTime":112.308,"xyz":[-48.913,60,-3.284]}},{"note":{"onTime":112.375,"xyz":[-45.05,60,-5.404]}},{"note":{"onTime":112.433,"xyz":[26.788,60,36.17]}},{"note":{"onTime":112.5,"xyz":[-19.415,60,44.681]}},{"note":{"onTime":112.558,"xyz":[18.761,60,13.99]}},{"note":{"onTime":112.625,"xyz":[-1.408,60,-0.465]}},{"note":{"onTime":112.683,"xyz":[35.527,60,45.832]}},{"note":{"onTime":112.75,"xyz":[-46.304,60,-48.682]}},{"note":{"onTime":112.808,"xyz":[31.001,60,-49.356]}},{"note":{"onTime":112.875,"xyz":[-45.968,60,-0.376]}},{"note":{"onTime":112.933,"xyz":[-31.253,60,47.564]}},{"note":{"onTime":113,"xyz":[-6.566,60,46.172]}},{"note":{"onTime":113.058,"xyz":[-46.649,60,15.493]}},{"note":{"onTime":113.125,"xyz":[-7.677,60,22.694]}},{"note":{"onTime":113.183,"xyz":[-5.018,60,-45.309]}},{"note":{"onTime":113.25,"xyz":[-42.538,60,-11.152]}},{"note":{"onTime":113.308,"xyz":[-15.779,60,-43.364]}},{"note":{"onTime":113.375,"xyz":[-45.375,60,-44.598]}},{"note":{"onTime":113.433,"xyz":[-1.132,60,-45.512]}},{"note":{"onTime":129.5,"xyz":[-1.072,60,23.1]}},{"note":{"onTime":129.558,"xyz":[-48.099,60,-5.815]}},{"note":{"onTime":129.625,"xyz":[5.809,60,34.146]}},{"note":{"onTime":129.683,"xyz":[-5.23,60,8.286]}},{"note":{"onTime":129.75,"xyz":[-3.501,60,-40.291]}},{"note":{"onTime":129.808,"xyz":[-28.378,60,27.807]}},{"note":{"onTime":129.875,"xyz":[-19.051,60,27.182]}},{"note":{"onTime":129.933,"xyz":[-41.757,60,-3.717]}},{"note":{"onTime":130,"xyz":[-27.605,60,-23.112]}},{"note":{"onTime":130.058,"xyz":[-9.537,60,45.207]}},{"note":{"onTime":130.125,"xyz":[43.936,60,-15.092]}},{"note":{"onTime":130.183,"xyz":[-24.233,60,-20.679]}},{"note":{"onTime":130.25,"xyz":[-3.936,60,-10]}},{"note":{"onTime":130.308,"xyz":[24.06,60,49.742]}},{"note":{"onTime":130.375,"xyz":[-17.568,60,16.09]}},{"note":{"onTime":130.433,"xyz":[-19.215,60,-47.146]}},{"note":{"onTime":130.5,"xyz":[-17.662,60,12.438]}},{"note":{"onTime":130.558,"xyz":[33.573,60,28.905]}},{"note":{"onTime":130.625,"xyz":[35.437,60,-47.567]}},{"note":{"onTime":130.683,"xyz":[7.064,60,3.93]}},{"note":{"onTime":130.75,"xyz":[-25.787,60,-28.075]}},{"note":{"onTime":130.808,"xyz":[40.693,60,-21.952]}},{"note":{"onTime":130.875,"xyz":[-16.017,60,45.253]}},{"note":{"onTime":130.933,"xyz":[-7.569,60,18.753]}},{"note":{"onTime":131,"xyz":[19.922,60,-1.945]}},{"note":{"onTime":131.058,"xyz":[8.762,60,25.772]}},{"note":{"onTime":131.125,"xyz":[-3,60,-3.379]}},{"note":{"onTime":131.183,"xyz":[-20.918,60,0.496]}},{"note":{"onTime":131.25,"xyz":[-26.853,60,40.402]}},{"note":{"onTime":131.308,"xyz":[32.198,60,34.406]}},{"note":{"onTime":131.375,"xyz":[49.547,60,-26.576]}},{"note":{"onTime":131.433,"xyz":[-34.837,60,33.312]}},{"note":{"onTime":131.5,"xyz":[46.065,60,28.133]}},{"note":{"onTime":131.558,"xyz":[1.403,60,-25.975]}},{"note":{"onTime":131.625,"xyz":[-44.403,60,-22.234]}},{"note":{"onTime":131.683,"xyz":[-12.695,60,-46.531]}},{"note":{"onTime":131.75,"xyz":[-30.087,60,7.064]}},{"note":{"onTime":131.808,"xyz":[35.354,60,-6.562]}},{"note":{"onTime":131.875,"xyz":[-17.449,60,-27.843]}},{"note":{"onTime":131.933,"xyz":[38.813,60,13.552]}},{"note":{"onTime":132,"xyz":[42.761,60,15.091]}},{"note":{"onTime":132.058,"xyz":[-0.952,60,36.592]}},{"note":{"onTime":132.125,"xyz":[39.694,60,-17.073]}},{"note":{"onTime":132.183,"xyz":[-46.826,60,-49.326]}},{"note":{"onTime":132.25,"xyz":[-30.824,60,-18.06]}},{"note":{"onTime":132.308,"xyz":[48.008,60,-22.184]}},{"note":{"onTime":132.375,"xyz":[-42.257,60,30.296]}},{"note":{"onTime":132.433,"xyz":[7.593,60,-5.381]}},{"note":{"onTime":132.5,"xyz":[21.476,60,-35.827]}},{"note":{"onTime":132.558,"xyz":[-32.985,60,-25.643]}},{"note":{"onTime":132.625,"xyz":[1.716,60,-41.455]}},{"note":{"onTime":132.683,"xyz":[26.235,60,-23.13]}},{"note":{"onTime":132.75,"xyz":[-22.757,60,-48.619]}},{"note":{"onTime":132.808,"xyz":[-4.718,60,-40.367]}},{"note":{"onTime":132.875,"xyz":[-15.725,60,-35.282]}},{"note":{"onTime":132.933,"xyz":[-12.14,60,26.456]}},{"note":{"onTime":133,"xyz":[12.802,60,4.508]}},{"note":{"onTime":133.058,"xyz":[-44.778,60,25.651]}},{"note":{"onTime":133.125,"xyz":[-28.247,60,49.306]}},{"note":{"onTime":133.183,"xyz":[-32.459,60,-36.454]}},{"note":{"onTime":133.25,"xyz":[-42.663,60,12.243]}},{"note":{"onTime":133.308,"xyz":[27.037,60,-31.98]}},{"note":{"onTime":133.375,"xyz":[0.041,60,37.327]}},{"note":{"onTime":133.433,"xyz":[-32.851,60,26.739]}},{"note":{"onTime":133.5,"xyz":[37.348,60,-23.587]}},{"note":{"onTime":133.558,"xyz":[36.274,60,-8.004]}},{"note":{"onTime":133.625,"xyz":[42.525,60,43.266]}},{"note":{"onTime":133.683,"xyz":[14.299,60,-5.018]}},{"note":{"onTime":133.75,"xyz":[-33.882,60,-37.682]}},{"note":{"onTime":133.808,"xyz":[46.58,60,3.011]}},{"note":{"onTime":133.875,"xyz":[-2.737,60,-21.707]}},{"note":{"onTime":133.933,"xyz":[34.438,60,-9.946]}},{"note":{"onTime":134,"xyz":[-42.106,60,-25.052]}},{"note":{"onTime":134.058,"xyz":[-25.201,60,30.095]}},{"note":{"onTime":134.125,"xyz":[-14.411,60,23.209]}},{"note":{"onTime":134.183,"xyz":[25.766,60,-29.447]}},{"note":{"onTime":134.25,"xyz":[-28.541,60,47.01]}},{"note":{"onTime":134.308,"xyz":[-29.369,60,-44.338]}},{"note":{"onTime":134.375,"xyz":[-20.673,60,15.548]}},{"note":{"onTime":134.433,"xyz":[-8.324,60,-46.672]}},{"note":{"onTime":134.5,"xyz":[12.788,60,49.717]}},{"note":{"onTime":134.558,"xyz":[28.032,60,-49.926]}},{"note":{"onTime":134.625,"xyz":[-1.195,60,24.274]}},{"note":{"onTime":134.683,"xyz":[10.4,60,23.283]}},{"note":{"onTime":134.75,"xyz":[-48.529,60,-37.736]}},{"note":{"onTime":134.808,"xyz":[20.528,60,34.421]}},{"note":{"onTime":134.875,"xyz":[48.865,60,10.524]}},{"note":{"onTime":134.933,"xyz":[46.555,60,17.506]}},{"note":{"onTime":135,"xyz":[30.594,60,-39.07]}},{"note":{"onTime":135.058,"xyz":[-22.345,60,19.977]}},{"note":{"onTime":135.125,"xyz":[-14.959,60,-2.188]}},{"note":{"onTime":135.183,"xyz":[34.261,60,-5.354]}},{"note":{"onTime":135.25,"xyz":[-25.231,60,13.752]}},{"note":{"onTime":135.308,"xyz":[44.691,60,-2.262]}},{"note":{"onTime":135.375,"xyz":[27.099,60,0.149]}},{"note":{"onTime":135.433,"xyz":[-13.464,60,25.483]}},{"note":{"onTime":135.5,"xyz":[25.989,60,-8.3]}},{"note":{"onTime":135.558,"xyz":[-7.121,60,-23.495]}},{"note":{"onTime":135.625,"xyz":[-37.862,60,-18.489]}},{"note":{"onTime":135.683,"xyz":[10.651,60,-34.373]}},{"note":{"onTime":135.75,"xyz":[-37.995,60,32.295]}},{"note":{"onTime":135.808,"xyz":[-27.669,60,-7.063]}},{"note":{"onTime":135.875,"xyz":[4.418,60,45.089]}},{"note":{"onTime":135.933,"xyz":[34.118,60,-3.716]}},{"note":{"onTime":136,"xyz":[-23.086,60,16.603]}},{"note":{"onTime":136.058,"xyz":[24.782,60,42.012]}},{"note":{"onTime":136.125,"xyz":[4.12,60,-24.239]}},{"note":{"onTime":136.183,"xyz":[-28.979,60,44.024]}},{"note":{"onTime":136.25,"xyz":[28.634,60,45.549]}},{"note":{"onTime":136.308,"xyz":[-1.587,60,1.336]}},{"note":{"onTime":136.375,"xyz":[22.22,60,-15.766]}},{"note":{"onTime":136.433,"xyz":[-16.637,60,15.492]}},{"note":{"onTime":136.5,"xyz":[-17.029,60,26.481]}},{"note":{"onTime":136.558,"xyz":[31.895,60,47.742]}},{"note":{"onTime":136.625,"xyz":[13.656,60,26.269]}},{"note":{"onTime":136.683,"xyz":[17.117,60,8]}},{"note":{"onTime":136.75,"xyz":[8.943,60,5.93]}},{"note":{"onTime":136.808,"xyz":[-0.132,60,-10.394]}},{"note":{"onTime":136.875,"xyz":[-14.005,60,-4.55]}},{"note":{"onTime":136.933,"xyz":[17.674,60,-18.07]}},{"note":{"onTime":137,"xyz":[5.074,60,9.496]}},{"note":{"onTime":137.058,"xyz":[37.034,60,-36.675]}},{"note":{"onTime":137.125,"xyz":[25.767,60,12.927]}},{"note":{"onTime":137.183,"xyz":[-45.625,60,5.893]}},{"note":{"onTime":137.25,"xyz":[-38.68,60,-25.202]}},{"note":{"onTime":137.308,"xyz":[-16.951,60,-32.605]}},{"note":{"onTime":137.375,"xyz":[9.664,60,-37.437]}},{"note":{"onTime":137.433,"xyz":[8.81,60,10.586]}},{"note":{"onTime":137.5,"xyz":[-13.659,60,-11.566]}},{"note":{"onTime":137.558,"xyz":[15.395,60,32.52]}},{"note":{"onTime":137.625,"xyz":[42.792,60,44.933]}},{"note":{"onTime":137.683,"xyz":[6.573,60,12.266]}},{"note":{"onTime":137.75,"xyz":[-45.221,60,-37.119]}},{"note":{"onTime":137.808,"xyz":[-37.554,60,-48.805]}},{"note":{"onTime":137.875,"xyz":[-8.839,60,48.606]}},{"note":{"onTime":137.933,"xyz":[-2.833,60,-8.2]}},{"note":{"onTime":138,"xyz":[-45.749,60,14.264]}},{"note":{"onTime":138.058,"xyz":[13.879,60,15.202]}},{"note":{"onTime":138.125,"xyz":[0.597,60,-37.848]}},{"note":{"onTime":138.183,"xyz":[11.731,60,40.214]}},{"note":{"onTime":138.25,"xyz":[36.734,60,26.96]}},{"note":{"onTime":138.308,"xyz":[-29.353,60,34.453]}},{"note":{"onTime":138.375,"xyz":[19.271,60,-24.692]}},{"note":{"onTime":138.433,"xyz":[-46.702,60,6.686]}},{"note":{"onTime":138.5,"xyz":[4.034,60,15.937]}},{"note":{"onTime":138.558,"xyz":[1.686,60,35.611]}},{"note":{"onTime":138.625,"xyz":[-33.968,60,42.739]}},{"note":{"onTime":138.683,"xyz":[-0.748,60,9.917]}},{"note":{"onTime":138.75,"xyz":[-17.977,60,22.797]}},{"note":{"onTime":138.808,"xyz":[-0.452,60,-36.055]}},{"note":{"onTime":138.875,"xyz":[11.717,60,8.84]}},{"note":{"onTime":138.933,"xyz":[20.686,60,-1.183]}},{"note":{"onTime":139,"xyz":[-36.672,60,6.444]}},{"note":{"onTime":139.058,"xyz":[-47.853,60,36.838]}},{"note":{"onTime":139.125,"xyz":[-34.351,60,17.002]}},{"note":{"onTime":139.183,"xyz":[48.331,60,-26.552]}},{"note":{"onTime":139.25,"xyz":[23.179,60,14.314]}},{"note":{"onTime":139.308,"xyz":[-27.189,60,22.391]}},{"note":{"onTime":139.375,"xyz":[-15.508,60,-48.198]}},{"note":{"onTime":139.433,"xyz":[39.769,60,2.154]}},{"note":{"onTime":139.5,"xyz":[38.07,60,45.12]}},{"note":{"onTime":139.558,"xyz":[-44.189,60,41.571]}},{"note":{"onTime":139.625,"xyz":[45.658,60,-12.479]}},{"note":{"onTime":139.683,"xyz":[27.592,60,-4.175]}},{"note":{"onTime":139.75,"xyz":[-38.043,60,39.024]}},{"note":{"onTime":139.808,"xyz":[49.58,60,17.321]}},{"note":{"onTime":139.875,"xyz":[-47.548,60,41.47]}},{"note":{"onTime":139.933,"xyz":[-46.788,60,25.222]}},{"note":{"onTime":140,"xyz":[39.648,60,-43.801]}},{"note":{"onTime":140.058,"xyz":[-35.218,60,19.087]}},{"note":{"onTime":140.125,"xyz":[-36.859,60,-44.485]}},{"note":{"onTime":140.183,"xyz":[15.998,60,-7.686]}},{"note":{"onTime":140.25,"xyz":[-37.897,60,29.706]}},{"note":{"onTime":140.308,"xyz":[-40.559,60,-23.808]}},{"note":{"onTime":140.375,"xyz":[-38.857,60,-45.715]}},{"note":{"onTime":140.433,"xyz":[-7.566,60,-8.455]}},{"note":{"onTime":140.5,"xyz":[-6.701,60,3.619]}},{"note":{"onTime":140.558,"xyz":[-31.697,60,-41.507]}},{"note":{"onTime":140.625,"xyz":[8.508,60,-46.541]}},{"note":{"onTime":140.683,"xyz":[4.989,60,21.99]}},{"note":{"onTime":140.75,"xyz":[23.382,60,-7.656]}},{"note":{"onTime":140.808,"xyz":[-31.372,60,47.759]}},{"note":{"onTime":140.875,"xyz":[49.894,60,16.599]}},{"note":{"onTime":140.933,"xyz":[45.374,60,36.321]}},{"note":{"onTime":141,"xyz":[27.758,60,22.074]}},{"note":{"onTime":141.058,"xyz":[-0.408,60,48.216]}},{"note":{"onTime":141.125,"xyz":[-40.785,60,-16.048]}},{"note":{"onTime":141.183,"xyz":[-18.113,60,37.533]}},{"note":{"onTime":141.25,"xyz":[36.847,60,40.297]}},{"note":{"onTime":141.308,"xyz":[-22.51,60,9.685]}},{"note":{"onTime":141.375,"xyz":[46.151,60,21.662]}},{"note":{"onTime":141.433,"xyz":[5.523,60,-40.646]}},{"note":{"onTime":141.5,"xyz":[46.155,60,4.323]}},{"note":{"onTime":141.558,"xyz":[-26.07,60,-38.248]}},{"note":{"onTime":141.625,"xyz":[-35.283,60,-35.168]}},{"note":{"onTime":141.683,"xyz":[-5.456,60,-8.709]}},{"note":{"onTime":141.75,"xyz":[21.368,60,-15.265]}},{"note":{"onTime":141.808,"xyz":[49.2,60,-17.583]}},{"note":{"onTime":141.875,"xyz":[-8.939,60,-47.133]}},{"note":{"onTime":141.933,"xyz":[2.193,60,34.235]}},{"note":{"onTime":142,"xyz":[-21.837,60,44.74]}},{"note":{"onTime":142.058,"xyz":[-42.003,60,49.651]}},{"note":{"onTime":142.125,"xyz":[-37.312,60,-19.455]}},{"note":{"onTime":142.183,"xyz":[-2.763,60,-2.421]}},{"note":{"onTime":142.25,"xyz":[41.399,60,-18.685]}},{"note":{"onTime":142.308,"xyz":[-30.287,60,49.297]}},{"note":{"onTime":142.375,"xyz":[-3.691,60,13.243]}},{"note":{"onTime":142.433,"xyz":[12.038,60,-26.232]}},{"note":{"onTime":142.5,"xyz":[13.401,60,39.124]}},{"note":{"onTime":142.558,"xyz":[-29.547,60,37.762]}},{"note":{"onTime":142.625,"xyz":[26.473,60,39.764]}},{"note":{"onTime":142.683,"xyz":[-22.181,60,-48.763]}},{"note":{"onTime":142.75,"xyz":[6.006,60,33.114]}},{"note":{"onTime":142.808,"xyz":[38.981,60,-17.071]}},{"note":{"onTime":142.875,"xyz":[32.205,60,-38.803]}},{"note":{"onTime":142.933,"xyz":[-48.166,60,-48.346]}},{"note":{"onTime":143,"xyz":[16.075,60,40.749]}},{"note":{"onTime":143.058,"xyz":[13.781,60,31.727]}},{"note":{"onTime":143.125,"xyz":[43.805,60,39.251]}},{"note":{"onTime":143.183,"xyz":[-33.883,60,2.431]}},{"note":{"onTime":143.25,"xyz":[49.139,60,49.805]}},{"note":{"onTime":143.308,"xyz":[-6.587,60,-22.199]}},{"note":{"onTime":143.375,"xyz":[47.021,60,-47.498]}},{"note":{"onTime":143.433,"xyz":[-47.503,60,-19.584]}},{"note":{"onTime":143.5,"xyz":[20.885,60,-27.329]}},{"note":{"onTime":143.558,"xyz":[37.367,60,27.719]}},{"note":{"onTime":143.625,"xyz":[26.764,60,33.98]}},{"note":{"onTime":143.683,"xyz":[23.579,60,-12.286]}},{"note":{"onTime":143.75,"xyz":[-8.844,60,-36.911]}},{"note":{"onTime":143.808,"xyz":[-40.417,60,-10.852]}},{"note":{"onTime":143.875,"xyz":[17.571,60,-11.453]}},{"note":{"onTime":143.933,"xyz":[14.359,60,45.583]}},{"note":{"onTime":144,"xyz":[10.164,60,-3.719]}},{"note":{"onTime":144.058,"xyz":[31.841,60,29.44]}},{"note":{"onTime":144.125,"xyz":[-47.014,60,13.499]}},{"note":{"onTime":144.183,"xyz":[14.177,60,17.323]}},{"note":{"onTime":144.25,"xyz":[-18.407,60,-1.624]}},{"note":{"onTime":144.308,"xyz":[39.196,60,-21.93]}},{"note":{"onTime":144.375,"xyz":[31.055,60,-29.178]}},{"note":{"onTime":144.433,"xyz":[43.69,60,-3.883]}},{"note":{"onTime":144.5,"xyz":[-27.715,60,36.113]}},{"note":{"onTime":144.558,"xyz":[-45.342,60,-28.644]}},{"note":{"onTime":144.625,"xyz":[38.128,60,-15.449]}},{"note":{"onTime":144.683,"xyz":[-43.451,60,18.74]}},{"note":{"onTime":144.75,"xyz":[23.195,60,2.712]}},{"note":{"onTime":144.808,"xyz":[25.293,60,-37.099]}},{"note":{"onTime":144.875,"xyz":[-1.86,60,-38.338]}},{"note":{"onTime":144.933,"xyz":[-29.527,60,-8.906]}},{"note":{"onTime":145,"xyz":[41.305,60,-39.106]}},{"note":{"onTime":145.058,"xyz":[-13.063,60,48.196]}},{"note":{"onTime":145.125,"xyz":[39.575,60,-40.061]}},{"note":{"onTime":145.183,"xyz":[-42.597,60,36.491]}},{"note":{"onTime":145.25,"xyz":[-22.819,60,28.957]}},{"note":{"onTime":145.308,"xyz":[49.717,60,-23.177]}},{"note":{"onTime":145.375,"xyz":[-2.706,60,-48.756]}},{"note":{"onTime":145.433,"xyz":[47.426,60,2.632]}},{"note":{"onTime":145.5,"xyz":[17.863,60,20.855]}},{"note":{"onTime":145.558,"xyz":[21.548,60,-49.31]}},{"note":{"onTime":145.625,"xyz":[-8.595,60,-46.355]}},{"note":{"onTime":145.683,"xyz":[26.16,60,-11.792]}},{"note":{"onTime":145.75,"xyz":[49.773,60,-23.778]}},{"note":{"onTime":145.808,"xyz":[-38.178,60,31.738]}},{"note":{"onTime":145.875,"xyz":[-49.62,60,30.822]}},{"note":{"onTime":145.933,"xyz":[30.276,60,-24.926]}},{"note":{"onTime":146,"xyz":[-28.669,60,41.278]}},{"note":{"onTime":146.058,"xyz":[-17.555,60,7.562]}},{"note":{"onTime":146.125,"xyz":[-29.405,60,-17.804]}},{"note":{"onTime":146.183,"xyz":[-29.141,60,-23.074]}},{"note":{"onTime":146.25,"xyz":[-40.033,60,-13.459]}},{"note":{"onTime":146.308,"xyz":[38.434,60,-11.622]}},{"note":{"onTime":146.375,"xyz":[29.482,60,-27.777]}},{"note":{"onTime":146.433,"xyz":[39.283,60,40.415]}},{"note":{"onTime":146.5,"xyz":[23.212,60,-27.694]}},{"note":{"onTime":146.558,"xyz":[-24.749,60,33.774]}},{"note":{"onTime":146.625,"xyz":[-5.515,60,-27.719]}},{"note":{"onTime":146.683,"xyz":[-24.701,60,-40.357]}},{"note":{"onTime":146.75,"xyz":[-11.442,60,-2.196]}},{"note":{"onTime":146.808,"xyz":[25.06,60,32.681]}},{"note":{"onTime":146.875,"xyz":[-5.001,60,13.59]}},{"note":{"onTime":146.933,"xyz":[2.012,60,-10.02]}},{"note":{"onTime":147,"xyz":[11.784,60,-5.002]}},{"note":{"onTime":147.058,"xyz":[-30.901,60,-14.986]}},{"note":{"onTime":147.125,"xyz":[49.491,60,-25.383]}},{"note":{"onTime":147.183,"xyz":[-42.557,60,-27.878]}},{"note":{"onTime":147.25,"xyz":[8.411,60,-47.062]}},{"note":{"onTime":147.308,"xyz":[8.353,60,-41.6]}},{"note":{"onTime":147.375,"xyz":[-35.023,60,-48.628]}},{"note":{"onTime":147.433,"xyz":[-22.642,60,2.358]}},{"note":{"onTime":147.5,"xyz":[38.006,60,-16.371]}},{"note":{"onTime":147.558,"xyz":[9.714,60,18.445]}},{"note":{"onTime":147.625,"xyz":[-48.94,60,-15.93]}},{"note":{"onTime":147.683,"xyz":[9.061,60,9.948]}},{"note":{"onTime":147.75,"xyz":[-4.012,60,-34.667]}},{"note":{"onTime":147.808,"xyz":[19.82,60,-44.024]}},{"note":{"onTime":147.875,"xyz":[15.695,60,38.567]}},{"note":{"onTime":147.933,"xyz":[-39.18,60,27.58]}},{"note":{"onTime":148,"xyz":[-7.341,60,24.25]}},{"note":{"onTime":148.058,"xyz":[-36.249,60,-40.31]}},{"note":{"onTime":148.125,"xyz":[34.887,60,-33.98]}},{"note":{"onTime":148.183,"xyz":[16.634,60,-34.172]}},{"note":{"onTime":148.25,"xyz":[24.117,60,40.524]}},{"note":{"onTime":148.308,"xyz":[-29.216,60,7.651]}},{"note":{"onTime":148.375,"xyz":[13.501,60,-10.786]}},{"note":{"onTime":148.433,"xyz":[-28.98,60,27.548]}},{"note":{"onTime":148.5,"xyz":[-35.248,60,-10.51]}},{"note":{"onTime":148.558,"xyz":[-5.622,60,-23.923]}},{"note":{"onTime":148.625,"xyz":[-20.629,60,-11.024]}},{"note":{"onTime":148.683,"xyz":[-36.501,60,23.153]}},{"note":{"onTime":148.75,"xyz":[36.02,60,-45.878]}},{"note":{"onTime":148.808,"xyz":[18.593,60,-11.16]}},{"note":{"onTime":148.875,"xyz":[-22.101,60,-10.864]}},{"note":{"onTime":148.933,"xyz":[17.483,60,-27.287]}},{"note":{"onTime":149,"xyz":[31.162,60,-30.39]}},{"note":{"onTime":149.058,"xyz":[-31.886,60,-43.865]}},{"note":{"onTime":149.125,"xyz":[-40.67,60,-36.552]}},{"note":{"onTime":149.183,"xyz":[13.245,60,5.796]}},{"note":{"onTime":149.25,"xyz":[0.582,60,-14.008]}},{"note":{"onTime":149.308,"xyz":[-35.916,60,-24.258]}},{"note":{"onTime":149.375,"xyz":[-24.113,60,12.932]}},{"note":{"onTime":149.433,"xyz":[49.655,60,-4.99]}},{"note":{"onTime":149.5,"xyz":[27.54,60,-40.191]}},{"note":{"onTime":149.558,"xyz":[-7.083,60,-4.672]}},{"note":{"onTime":149.625,"xyz":[30.961,60,-12.942]}},{"note":{"onTime":149.683,"xyz":[-25.63,60,-15.829]}},{"note":{"onTime":149.75,"xyz":[48.88,60,10.682]}},{"note":{"onTime":149.808,"xyz":[-19.706,60,-40.786]}},{"note":{"onTime":149.875,"xyz":[47.537,60,47.218]}},{"note":{"onTime":149.933,"xyz":[-12.821,60,-2.967]}},{"note":{"onTime":150,"xyz":[0.454,60,3.78]}},{"note":{"onTime":150.058,"xyz":[-12.484,60,-11.944]}},{"note":{"onTime":150.125,"xyz":[48.047,60,-4.086]}},{"note":{"onTime":150.183,"xyz":[46.17,60,37.533]}},{"note":{"onTime":150.25,"xyz":[-8.05,60,44.102]}},{"note":{"onTime":150.308,"xyz":[-27.585,60,-35.119]}},{"note":{"onTime":150.375,"xyz":[-37.165,60,20.12]}},{"note":{"onTime":150.433,"xyz":[31.419,60,17.465]}},{"note":{"onTime":150.5,"xyz":[40.791,60,-6.489]}},{"note":{"onTime":150.558,"xyz":[-18.003,60,25.891]}},{"note":{"onTime":150.625,"xyz":[9.423,60,22.223]}},{"note":{"onTime":150.683,"xyz":[45.892,60,-27.461]}},{"note":{"onTime":150.75,"xyz":[19.815,60,46.458]}},{"note":{"onTime":150.808,"xyz":[-30.986,60,-20.49]}},{"note":{"onTime":150.875,"xyz":[9.767,60,37.017]}},{"note":{"onTime":150.933,"xyz":[-41.769,60,-47.241]}},{"note":{"onTime":151,"xyz":[-1.597,60,25.343]}},{"note":{"onTime":151.058,"xyz":[49.645,60,2.072]}},{"note":{"onTime":151.125,"xyz":[37.685,60,-41.842]}},{"note":{"onTime":151.183,"xyz":[17.133,60,-1.952]}},{"note":{"onTime":151.25,"xyz":[-18.243,60,-18.572]}},{"note":{"onTime":151.308,"xyz":[44.486,60,-16.377]}},{"note":{"onTime":151.375,"xyz":[13.654,60,22.532]}},{"note":{"onTime":151.433,"xyz":[-8.011,60,35.07]}},{"note":{"onTime":151.5,"xyz":[-21.993,60,12.273]}},{"note":{"onTime":151.558,"xyz":[-29.978,60,22.245]}},{"note":{"onTime":151.625,"xyz":[-10.848,60,25.976]}},{"note":{"onTime":151.683,"xyz":[19.487,60,-43.823]}},{"note":{"onTime":151.75,"xyz":[47.841,60,31.593]}},{"note":{"onTime":151.808,"xyz":[-27.229,60,-9.636]}},{"note":{"onTime":151.875,"xyz":[-12.261,60,-31.225]}},{"note":{"onTime":151.933,"xyz":[-39.144,60,-33.571]}},{"note":{"onTime":152,"xyz":[16.334,60,-47.49]}},{"note":{"onTime":152.058,"xyz":[23.306,60,21.459]}},{"note":{"onTime":152.125,"xyz":[-4.927,60,-45.613]}},{"note":{"onTime":152.183,"xyz":[-0.557,60,9.606]}},{"note":{"onTime":152.25,"xyz":[-48.314,60,-29.886]}},{"note":{"onTime":152.308,"xyz":[12.31,60,-9.379]}},{"note":{"onTime":152.375,"xyz":[15.021,60,-10.167]}},{"note":{"onTime":152.433,"xyz":[33.31,60,9.177]}},{"note":{"onTime":152.5,"xyz":[40.525,60,-45.722]}},{"note":{"onTime":152.558,"xyz":[15.881,60,-12.597]}},{"note":{"onTime":152.625,"xyz":[34.092,60,-38.831]}},{"note":{"onTime":152.683,"xyz":[42.535,60,-14.868]}},{"note":{"onTime":152.75,"xyz":[14.493,60,-11.333]}},{"note":{"onTime":152.808,"xyz":[22.258,60,4.385]}},{"note":{"onTime":152.875,"xyz":[-38.658,60,-17.485]}},{"note":{"onTime":152.933,"xyz":[35.915,60,32.644]}},{"note":{"onTime":153,"xyz":[7.78,60,16.872]}},{"note":{"onTime":153.058,"xyz":[37.165,60,-10.096]}},{"note":{"onTime":153.125,"xyz":[35.96,60,42.036]}},{"note":{"onTime":153.183,"xyz":[6.74,60,-26.525]}},{"note":{"onTime":153.25,"xyz":[-49.687,60,-18.383]}},{"note":{"onTime":153.308,"xyz":[9.948,60,38.376]}},{"note":{"onTime":153.375,"xyz":[19.722,60,-6.655]}},{"note":{"onTime":153.433,"xyz":[-47.654,60,16.079]}},{"note":{"onTime":153.5,"xyz":[26.26,60,-32.038]}},{"note":{"onTime":153.558,"xyz":[47.705,60,16.664]}},{"note":{"onTime":153.625,"xyz":[16.49,60,-34.247]}},{"note":{"onTime":153.683,"xyz":[37.124,60,-14.669]}},{"note":{"onTime":153.75,"xyz":[-47.425,60,-13.547]}},{"note":{"onTime":153.808,"xyz":[9.595,60,49.904]}},{"note":{"onTime":153.875,"xyz":[-14.051,60,-8.2]}},{"note":{"onTime":153.933,"xyz":[3.664,60,7.826]}},{"note":{"onTime":154,"xyz":[-42.769,60,-42.852]}},{"note":{"onTime":154.058,"xyz":[-1.497,60,15.255]}},{"note":{"onTime":154.125,"xyz":[43.774,60,-24.492]}},{"note":{"onTime":154.183,"xyz":[-38.255,60,-36.323]}},{"note":{"onTime":154.25,"xyz":[-38.142,60,-19.538]}},{"note":{"onTime":154.308,"xyz":[-7.737,60,16.988]}},{"note":{"onTime":154.375,"xyz":[-34.591,60,49.804]}},{"note":{"onTime":154.433,"xyz":[9.834,60,40.758]}},{"note":{"onTime":154.5,"xyz":[-1.537,60,5.765]}},{"note":{"onTime":154.558,"xyz":[-18.389,60,41.362]}},{"note":{"onTime":154.625,"xyz":[35.642,60,-3.475]}},{"note":{"onTime":154.683,"xyz":[-31.203,60,-47.673]}},{"note":{"onTime":154.75,"xyz":[14.913,60,33.665]}},{"note":{"onTime":154.808,"xyz":[7.074,60,14.724]}},{"note":{"onTime":154.875,"xyz":[11.176,60,27.473]}},{"note":{"onTime":154.933,"xyz":[32.504,60,3.958]}},{"note":{"onTime":155,"xyz":[48.882,60,12.936]}},{"note":{"onTime":155.058,"xyz":[11.962,60,13.271]}},{"note":{"onTime":155.125,"xyz":[-11.63,60,49.933]}},{"note":{"onTime":155.183,"xyz":[-34.988,60,20.737]}},{"note":{"onTime":155.25,"xyz":[-25.062,60,17.991]}},{"note":{"onTime":155.308,"xyz":[-46.331,60,-2.098]}},{"note":{"onTime":155.375,"xyz":[-6.654,60,-34.896]}},{"note":{"onTime":155.433,"xyz":[-0.974,60,-29.358]}},{"note":{"onTime":155.5,"xyz":[-45.535,60,17.879]}},{"note":{"onTime":155.558,"xyz":[40.456,60,-27.385]}},{"note":{"onTime":155.625,"xyz":[36.645,60,-27.119]}},{"note":{"onTime":155.683,"xyz":[15.306,60,45.056]}},{"note":{"onTime":155.75,"xyz":[43.101,60,-27.29]}},{"note":{"onTime":155.808,"xyz":[-14.083,60,-10.128]}},{"note":{"onTime":155.875,"xyz":[-0.376,60,-18.583]}},{"note":{"onTime":155.933,"xyz":[7.729,60,-17.656]}},{"note":{"onTime":156,"xyz":[35.388,60,18.462]}},{"note":{"onTime":156.058,"xyz":[-1.701,60,-48.632]}},{"note":{"onTime":156.125,"xyz":[44.775,60,44.91]}},{"note":{"onTime":156.183,"xyz":[-36.322,60,45.435]}},{"note":{"onTime":156.25,"xyz":[-48.688,60,26.111]}},{"note":{"onTime":156.308,"xyz":[46.88,60,-22.338]}},{"note":{"onTime":156.375,"xyz":[-32.84,60,-21.95]}},{"note":{"onTime":156.433,"xyz":[14.446,60,-10.655]}},{"note":{"onTime":156.5,"xyz":[-5.572,60,46.005]}},{"note":{"onTime":156.558,"xyz":[-27.415,60,45.079]}},{"note":{"onTime":156.625,"xyz":[29.147,60,20.564]}},{"note":{"onTime":156.683,"xyz":[35.359,60,-20.42]}},{"note":{"onTime":156.75,"xyz":[36.25,60,-26.566]}},{"note":{"onTime":156.808,"xyz":[35.02,60,13.346]}},{"note":{"onTime":156.875,"xyz":[45.634,60,-49.703]}},{"note":{"onTime":156.933,"xyz":[0.281,60,47.352]}},{"note":{"onTime":157,"xyz":[6.608,60,-3.666]}},{"note":{"onTime":157.058,"xyz":[13.134,60,-7.625]}},{"note":{"onTime":157.125,"xyz":[11.944,60,-31.738]}},{"note":{"onTime":157.183,"xyz":[20.209,60,-7.445]}},{"note":{"onTime":157.25,"xyz":[-5.366,60,11.047]}},{"note":{"onTime":157.308,"xyz":[1.663,60,21.659]}},{"note":{"onTime":157.375,"xyz":[-8.407,60,4.105]}},{"note":{"onTime":157.433,"xyz":[20.637,60,-29.573]}},{"note":{"onTime":157.5,"xyz":[-9.902,60,17.091]}},{"note":{"onTime":157.558,"xyz":[-29.421,60,-39.307]}},{"note":{"onTime":157.625,"xyz":[6.098,60,15.414]}},{"note":{"onTime":157.683,"xyz":[37.37,60,22.841]}},{"note":{"onTime":157.75,"xyz":[19.746,60,26.876]}},{"note":{"onTime":157.808,"xyz":[-20.294,60,13.868]}},{"note":{"onTime":157.875,"xyz":[-5.965,60,-20.686]}},{"note":{"onTime":157.933,"xyz":[35.491,60,40.167]}},{"note":{"onTime":158,"xyz":[-41.639,60,-48.715]}},{"note":{"onTime":158.058,"xyz":[-34.301,60,38.28]}},{"note":{"onTime":158.125,"xyz":[31.508,60,-0.214]}},{"note":{"onTime":158.183,"xyz":[-18.842,60,-35.365]}},{"note":{"onTime":158.25,"xyz":[19.205,60,47.088]}},{"note":{"onTime":158.308,"xyz":[43.582,60,7.883]}},{"note":{"onTime":158.375,"xyz":[31.248,60,-20.853]}},{"note":{"onTime":158.433,"xyz":[20.913,60,-28.864]}},{"note":{"onTime":158.5,"xyz":[-46.447,60,37.095]}},{"note":{"onTime":158.558,"xyz":[-9.99,60,32.43]}},{"note":{"onTime":158.625,"xyz":[-37.503,60,27.121]}},{"note":{"onTime":158.683,"xyz":[48.213,60,-13.591]}},{"note":{"onTime":158.75,"xyz":[13.99,60,39.015]}},{"note":{"onTime":158.808,"xyz":[0.47,60,-45.368]}},{"note":{"onTime":158.875,"xyz":[-41.106,60,5.955]}},{"note":{"onTime":158.933,"xyz":[-38.159,60,32.541]}},{"note":{"onTime":159,"xyz":[-38.83,60,-36.071]}},{"note":{"onTime":159.058,"xyz":[37.592,60,-26.019]}},{"note":{"onTime":159.125,"xyz":[6.524,60,35]}},{"note":{"onTime":159.183,"xyz":[45.904,60,5.715]}},{"note":{"onTime":159.25,"xyz":[18.716,60,-29.659]}},{"note":{"onTime":159.308,"xyz":[12.755,60,-29.329]}},{"note":{"onTime":159.375,"xyz":[29.344,60,3.208]}},{"note":{"onTime":159.433,"xyz":[26.105,60,26.163]}},{"note":{"onTime":159.5,"xyz":[5.951,60,-15.274]}},{"note":{"onTime":159.558,"xyz":[-31.813,60,28.052]}},{"note":{"onTime":159.625,"xyz":[14.145,60,-37.031]}},{"note":{"onTime":159.683,"xyz":[-18.033,60,20.235]}},{"note":{"onTime":159.75,"xyz":[3.154,60,24.524]}},{"note":{"onTime":159.808,"xyz":[-48.262,60,-22.944]}},{"note":{"onTime":159.875,"xyz":[42.266,60,3.74]}},{"note":{"onTime":159.933,"xyz":[19.702,60,20.54]}},{"note":{"onTime":160,"xyz":[29.019,60,-15.49]}},{"note":{"onTime":160.058,"xyz":[1.522,60,11.038]}},{"note":{"onTime":160.125,"xyz":[20.223,60,28.896]}},{"note":{"onTime":160.183,"xyz":[35.412,60,-4.908]}},{"note":{"onTime":160.25,"xyz":[35.007,60,-27.519]}},{"note":{"onTime":160.308,"xyz":[-17.4,60,44.457]}},{"note":{"onTime":160.375,"xyz":[26.46,60,-15.764]}},{"note":{"onTime":160.433,"xyz":[23.315,60,41.392]}},{"note":{"onTime":160.5,"xyz":[46.285,60,5.197]}},{"note":{"onTime":160.558,"xyz":[42.907,60,13.852]}},{"note":{"onTime":160.625,"xyz":[16.392,60,11.593]}},{"note":{"onTime":160.683,"xyz":[8.668,60,6.397]}},{"note":{"onTime":160.75,"xyz":[3.93,60,0.514]}},{"note":{"onTime":160.808,"xyz":[-19.391,60,44.529]}},{"note":{"onTime":160.875,"xyz":[-47.055,60,25.977]}},{"note":{"onTime":160.933,"xyz":[10.092,60,18.301]}},{"note":{"onTime":161,"xyz":[-11.906,60,26.648]}},{"note":{"onTime":161.058,"xyz":[40.062,60,31.418]}},{"note":{"onTime":161.125,"xyz":[-45.236,60,39.686]}},{"note":{"onTime":161.183,"xyz":[-39.021,60,41.064]}},{"note":{"onTime":161.25,"xyz":[26.809,60,-5.504]}},{"note":{"onTime":161.308,"xyz":[-21.415,60,7.524]}},{"note":{"onTime":161.375,"xyz":[-20.709,60,-18.166]}},{"note":{"onTime":161.433,"xyz":[44.665,60,-12.356]}},{"note":{"onTime":161.5,"xyz":[20.127,60,3.974]}},{"note":{"onTime":161.558,"xyz":[-28.793,60,-1.589]}},{"note":{"onTime":161.625,"xyz":[-17.109,60,-13.275]}},{"note":{"onTime":161.683,"xyz":[23.059,60,-47.147]}},{"note":{"onTime":161.75,"xyz":[34.279,60,-19.709]}},{"note":{"onTime":161.808,"xyz":[45.607,60,-13.837]}},{"note":{"onTime":161.875,"xyz":[25.212,60,49.507]}},{"note":{"onTime":161.933,"xyz":[-36.576,60,-48.228]}},{"note":{"onTime":162,"xyz":[45.543,60,-38.907]}},{"note":{"onTime":162.058,"xyz":[-35.602,60,31.251]}},{"note":{"onTime":162.125,"xyz":[9.979,60,-27.443]}},{"note":{"onTime":162.183,"xyz":[-7.017,60,-25.316]}},{"note":{"onTime":162.25,"xyz":[38.501,60,20.442]}},{"note":{"onTime":162.308,"xyz":[-3.022,60,25.751]}},{"note":{"onTime":162.375,"xyz":[-20.605,60,-48.981]}},{"note":{"onTime":162.433,"xyz":[36.044,60,-5.564]}},{"note":{"onTime":162.5,"xyz":[-11.617,60,40.53]}},{"note":{"onTime":162.558,"xyz":[48.111,60,-23.656]}},{"note":{"onTime":162.625,"xyz":[4.345,60,-29.058]}},{"note":{"onTime":162.683,"xyz":[13.34,60,-12.812]}},{"note":{"onTime":162.75,"xyz":[-17.818,60,-32.902]}},{"note":{"onTime":162.808,"xyz":[35.434,60,40.543]}},{"note":{"onTime":162.875,"xyz":[37.589,60,18.457]}},{"note":{"onTime":162.933,"xyz":[8.254,60,-47.528]}},{"note":{"onTime":163,"xyz":[-41.783,60,9.476]}},{"note":{"onTime":163.058,"xyz":[33.08,60,-35.425]}},{"note":{"onTime":163.125,"xyz":[22.129,60,23.419]}},{"note":{"onTime":163.183,"xyz":[29.633,60,43.51]}},{"note":{"onTime":163.25,"xyz":[-31.147,60,-28.807]}},{"note":{"onTime":163.308,"xyz":[23.601,60,-3.635]}},{"note":{"onTime":163.375,"xyz":[-28.059,60,-14.034]}},{"note":{"onTime":163.433,"xyz":[25.864,60,43.724]}},{"note":{"onTime":163.5,"xyz":[-3.959,60,22.09]}},{"note":{"onTime":163.558,"xyz":[25.381,60,-27.949]}},{"note":{"onTime":163.625,"xyz":[-32.743,60,-40.577]}},{"note":{"onTime":163.683,"xyz":[29.92,60,-49.632]}},{"note":{"onTime":163.75,"xyz":[-25.612,60,47.875]}},{"note":{"onTime":163.808,"xyz":[-12.285,60,-0.523]}},{"note":{"onTime":163.875,"xyz":[31.583,60,-12.01]}},{"note":{"onTime":163.933,"xyz":[40.035,60,-48.767]}},{"note":{"onTime":164,"xyz":[1.427,60,38.055]}},{"note":{"onTime":164.058,"xyz":[-29.231,60,-12.91]}},{"note":{"onTime":164.125,"xyz":[-17.351,60,22.654]}},{"note":{"onTime":164.183,"xyz":[-34.279,60,5.353]}},{"note":{"onTime":164.25,"xyz":[39.782,60,-1.813]}},{"note":{"onTime":164.308,"xyz":[-47.426,60,-8.308]}},{"note":{"onTime":164.375,"xyz":[-25.536,60,-36.238]}},{"note":{"onTime":164.433,"xyz":[-6.196,60,-36.344]}},{"note":{"onTime":164.5,"xyz":[40.92,60,-2.618]}},{"note":{"onTime":164.558,"xyz":[30.267,60,-16.532]}},{"note":{"onTime":164.625,"xyz":[-27.318,60,3.691]}},{"note":{"onTime":164.683,"xyz":[-45.838,60,-9.512]}},{"note":{"onTime":164.75,"xyz":[45.168,60,-13.002]}},{"note":{"onTime":164.808,"xyz":[7.754,60,-48.256]}},{"note":{"onTime":164.875,"xyz":[30.441,60,-31.949]}},{"note":{"onTime":164.933,"xyz":[-10.139,60,-28.045]}},{"note":{"onTime":165,"xyz":[37.689,60,-48.534]}},{"note":{"onTime":165.058,"xyz":[-13.006,60,-0.095]}},{"note":{"onTime":165.125,"xyz":[-43.101,60,-21.135]}},{"note":{"onTime":165.183,"xyz":[-38.627,60,22.028]}},{"note":{"onTime":165.25,"xyz":[-34.902,60,-22.821]}},{"note":{"onTime":165.308,"xyz":[5.069,60,2.905]}},{"note":{"onTime":165.375,"xyz":[-4.389,60,-11.848]}},{"note":{"onTime":165.433,"xyz":[39.565,60,22.321]}},{"note":{"onTime":165.5,"xyz":[42.421,60,-49.612]}},{"note":{"onTime":165.558,"xyz":[-15.741,60,25.815]}},{"note":{"onTime":165.625,"xyz":[-45.026,60,-44.632]}},{"note":{"onTime":165.683,"xyz":[-32.862,60,-43.481]}},{"note":{"onTime":165.75,"xyz":[5.061,60,20.037]}},{"note":{"onTime":165.808,"xyz":[-12.721,60,26.848]}},{"note":{"onTime":165.875,"xyz":[-42.101,60,-32.875]}},{"note":{"onTime":165.933,"xyz":[-6.777,60,25.356]}},{"note":{"onTime":166,"xyz":[-14.523,60,-13.525]}},{"note":{"onTime":166.058,"xyz":[-5.108,60,-6.71]}},{"note":{"onTime":166.125,"xyz":[2.917,60,22.63]}},{"note":{"onTime":166.183,"xyz":[10.794,60,-46.897]}},{"note":{"onTime":166.25,"xyz":[19.258,60,1.991]}},{"note":{"onTime":166.308,"xyz":[48.057,60,-16.227]}},{"note":{"onTime":166.375,"xyz":[-46.107,60,33.292]}},{"note":{"onTime":166.433,"xyz":[-48.387,60,21.5]}},{"note":{"onTime":166.5,"xyz":[10.279,60,-5.903]}},{"note":{"onTime":166.558,"xyz":[21.833,60,-24.652]}},{"note":{"onTime":166.625,"xyz":[0.54,60,9.925]}},{"note":{"onTime":166.683,"xyz":[18.377,60,-7.934]}},{"note":{"onTime":166.75,"xyz":[9.625,60,47.504]}},{"note":{"onTime":166.808,"xyz":[23.194,60,38.765]}},{"note":{"onTime":166.875,"xyz":[-43.071,60,35.978]}},{"note":{"onTime":166.933,"xyz":[-41.244,60,2.716]}},{"note":{"onTime":167,"xyz":[-12.029,60,5.728]}},{"note":{"onTime":167.058,"xyz":[29.966,60,-9.577]}},{"note":{"onTime":167.125,"xyz":[-9.835,60,-49.752]}},{"note":{"onTime":167.183,"xyz":[11.022,60,49.65]}},{"note":{"onTime":167.25,"xyz":[6.11,60,-21.738]}},{"note":{"onTime":167.308,"xyz":[13.063,60,-5.584]}},{"note":{"onTime":167.375,"xyz":[-3.568,60,-12.501]}},{"note":{"onTime":167.433,"xyz":[-24.061,60,-9.585]}},{"note":{"onTime":167.5,"xyz":[13.309,60,-35.752]}},{"note":{"onTime":167.558,"xyz":[9.206,60,13.108]}},{"note":{"onTime":167.625,"xyz":[-33.413,60,-49.573]}},{"note":{"onTime":167.683,"xyz":[-5.386,60,29.107]}},{"note":{"onTime":167.75,"xyz":[28.19,60,28.602]}},{"note":{"onTime":167.808,"xyz":[36.328,60,29.692]}},{"note":{"onTime":167.875,"xyz":[8.494,60,11.412]}},{"note":{"onTime":167.933,"xyz":[36.99,60,-30.364]}},{"note":{"onTime":168,"xyz":[-18.189,60,-8.501]}},{"note":{"onTime":168.058,"xyz":[-31.167,60,-8.854]}},{"note":{"onTime":168.125,"xyz":[18.282,60,-32.508]}},{"note":{"onTime":168.183,"xyz":[30.679,60,47.998]}},{"note":{"onTime":168.25,"xyz":[27.649,60,17.195]}},{"note":{"onTime":168.308,"xyz":[14.909,60,45.049]}},{"note":{"onTime":168.375,"xyz":[17.716,60,-3]}},{"note":{"onTime":168.433,"xyz":[-15.2,60,-20.521]}},{"note":{"onTime":168.5,"xyz":[48.158,60,13.087]}},{"note":{"onTime":168.558,"xyz":[-36.919,60,-31.328]}},{"note":{"onTime":168.625,"xyz":[-0.129,60,-8.709]}},{"note":{"onTime":168.683,"xyz":[-11.459,60,-18.247]}},{"note":{"onTime":168.75,"xyz":[12.601,60,-25.027]}},{"note":{"onTime":168.808,"xyz":[-9.812,60,13.8]}},{"note":{"onTime":168.875,"xyz":[-49.707,60,-39.984]}},{"note":{"onTime":168.933,"xyz":[-10.901,60,-40.219]}},{"note":{"onTime":169,"xyz":[-34.16,60,39.44]}},{"note":{"onTime":169.058,"xyz":[47.971,60,15.707]}},{"note":{"onTime":169.125,"xyz":[35.831,60,33.358]}},{"note":{"onTime":169.183,"xyz":[-21.285,60,-36.525]}},{"note":{"onTime":169.25,"xyz":[-47.236,60,29.312]}},{"note":{"onTime":169.308,"xyz":[-29.529,60,39.735]}},{"note":{"onTime":169.375,"xyz":[-21.654,60,9.68]}},{"note":{"onTime":169.433,"xyz":[45.474,60,-45.952]}},{"note":{"onTime":169.5,"xyz":[8.056,60,3.111]}},{"note":{"onTime":169.558,"xyz":[-30.6,60,-36.1]}},{"note":{"onTime":169.625,"xyz":[-44.548,60,22.029]}},{"note":{"onTime":169.683,"xyz":[-32.442,60,39.993]}},{"note":{"onTime":169.75,"xyz":[-34.022,60,44.455]}},{"note":{"onTime":169.808,"xyz":[9.703,60,20.983]}},{"note":{"onTime":169.875,"xyz":[-4.487,60,21.913]}},{"note":{"onTime":169.933,"xyz":[-44.35,60,-31.367]}},{"note":{"onTime":170,"xyz":[-30.139,60,-47.667]}},{"note":{"onTime":170.058,"xyz":[-17.526,60,48.518]}},{"note":{"onTime":170.125,"xyz":[-40.947,60,3.812]}},{"note":{"onTime":170.183,"xyz":[-26.834,60,-15.833]}},{"note":{"onTime":170.25,"xyz":[-14.012,60,18.199]}},{"note":{"onTime":170.308,"xyz":[17.424,60,20.135]}},{"note":{"onTime":170.375,"xyz":[23.784,60,18.837]}},{"note":{"onTime":170.433,"xyz":[-10.992,60,-11.833]}},{"note":{"onTime":170.5,"xyz":[-48.435,60,0.823]}},{"note":{"onTime":170.558,"xyz":[2.094,60,-43.311]}},{"note":{"onTime":170.625,"xyz":[15.439,60,-48.999]}},{"note":{"onTime":170.683,"xyz":[42.522,60,-36.556]}},{"note":{"onTime":170.75,"xyz":[11.457,60,34.823]}},{"note":{"onTime":170.808,"xyz":[-0.018,60,40.607]}},{"note":{"onTime":170.875,"xyz":[-48.417,60,-45.489]}},{"note":{"onTime":170.933,"xyz":[25.358,60,47.239]}},{"note":{"onTime":171,"xyz":[23.382,60,33.838]}},{"note":{"onTime":171.058,"xyz":[-15.204,60,-18.103]}},{"note":{"onTime":171.125,"xyz":[-9.387,60,-24.455]}},{"note":{"onTime":171.183,"xyz":[9.898,60,-35.338]}},{"note":{"onTime":171.25,"xyz":[36.249,60,-25.738]}},{"note":{"onTime":171.308,"xyz":[32.995,60,9.258]}},{"note":{"onTime":171.375,"xyz":[3.108,60,6.928]}},{"note":{"onTime":171.433,"xyz":[-21.033,60,-41.675]}},{"note":{"onTime":171.5,"xyz":[-28.671,60,-29.521]}},{"note":{"onTime":171.558,"xyz":[41.831,60,-15.28]}},{"note":{"onTime":171.625,"xyz":[7.74,60,49.165]}},{"note":{"onTime":171.683,"xyz":[36.497,60,-24.896]}},{"note":{"onTime":171.75,"xyz":[-39.055,60,-22.455]}},{"note":{"onTime":171.808,"xyz":[-34.942,60,-34.74]}},{"note":{"onTime":171.875,"xyz":[38.916,60,-23.747]}},{"note":{"onTime":171.933,"xyz":[3.83,60,-4.034]}},{"note":{"onTime":172,"xyz":[24.37,60,-17.755]}},{"note":{"onTime":172.058,"xyz":[-16.494,60,-40.174]}},{"note":{"onTime":172.125,"xyz":[38.353,60,29.72]}},{"note":{"onTime":172.183,"xyz":[31.359,60,19.802]}},{"note":{"onTime":172.25,"xyz":[-14.38,60,-31.531]}},{"note":{"onTime":172.308,"xyz":[-47.29,60,-44.789]}},{"note":{"onTime":172.375,"xyz":[-12.242,60,-10.68]}},{"note":{"onTime":172.433,"xyz":[-19.81,60,37.2]}},{"note":{"onTime":172.5,"xyz":[-37.177,60,-32.16]}},{"note":{"onTime":172.558,"xyz":[-5.232,60,9.211]}},{"note":{"onTime":172.625,"xyz":[24.817,60,-6.173]}},{"note":{"onTime":172.683,"xyz":[-46.497,60,-44.904]}},{"note":{"onTime":172.75,"xyz":[-16.133,60,31.532]}},{"note":{"onTime":172.808,"xyz":[26.639,60,34.505]}},{"note":{"onTime":172.875,"xyz":[9.666,60,10.368]}},{"note":{"onTime":172.933,"xyz":[-17.683,60,-41.757]}},{"note":{"onTime":173,"xyz":[7.998,60,-15.777]}},{"note":{"onTime":173.058,"xyz":[42.038,60,21.695]}},{"note":{"onTime":173.125,"xyz":[34.04,60,-24.277]}},{"note":{"onTime":173.183,"xyz":[-4.67,60,18.433]}},{"note":{"onTime":173.25,"xyz":[-41.933,60,46.108]}},{"note":{"onTime":173.308,"xyz":[-10.853,60,-25.053]}},{"note":{"onTime":173.375,"xyz":[-9.713,60,-41.96]}},{"note":{"onTime":173.433,"xyz":[27.53,60,-12.587]}},{"note":{"onTime":173.5,"xyz":[-6.895,60,33.919]}},{"note":{"onTime":173.558,"xyz":[11.301,60,-41.337]}},{"note":{"onTime":173.625,"xyz":[42.432,60,12.39]}},{"note":{"onTime":173.683,"xyz":[47.268,60,34.426]}},{"note":{"onTime":173.75,"xyz":[-24.082,60,-23.116]}},{"note":{"onTime":173.808,"xyz":[42.859,60,-21.375]}},{"note":{"onTime":173.875,"xyz":[-33.527,60,28.619]}},{"note":{"onTime":173.933,"xyz":[6.467,60,14.318]}},{"note":{"onTime":174,"xyz":[15.395,60,8.569]}},{"note":{"onTime":174.058,"xyz":[-22.563,60,46.055]}},{"note":{"onTime":174.125,"xyz":[-47.883,60,-5.087]}},{"note":{"onTime":174.183,"xyz":[43.673,60,-22.845]}},{"note":{"onTime":174.25,"xyz":[-11.797,60,20.532]}},{"note":{"onTime":174.308,"xyz":[-49.315,60,-1.981]}},{"note":{"onTime":174.375,"xyz":[-16.888,60,25.525]}},{"note":{"onTime":174.433,"xyz":[-5.386,60,-44.723]}},{"note":{"onTime":174.5,"xyz":[-30.435,60,-11.265]}},{"note":{"onTime":174.558,"xyz":[4.812,60,-27.387]}},{"note":{"onTime":174.625,"xyz":[38.395,60,26.104]}},{"note":{"onTime":174.683,"xyz":[-10.024,60,-11.273]}},{"note":{"onTime":174.75,"xyz":[27.815,60,8.644]}},{"note":{"onTime":174.808,"xyz":[27.029,60,-37.623]}},{"note":{"onTime":174.875,"xyz":[-18.782,60,-4.945]}},{"note":{"onTime":174.933,"xyz":[45.071,60,-24.994]}},{"note":{"onTime":175,"xyz":[-37.601,60,-0.042]}},{"note":{"onTime":175.058,"xyz":[-20.889,60,-5.633]}},{"note":{"onTime":175.125,"xyz":[28.453,60,-15.631]}},{"note":{"onTime":175.183,"xyz":[-28.917,60,-45.927]}},{"note":{"onTime":175.25,"xyz":[-9.968,60,-33.091]}},{"note":{"onTime":175.308,"xyz":[-39.747,60,10.325]}},{"note":{"onTime":175.375,"xyz":[17.263,60,-31.626]}},{"note":{"onTime":175.433,"xyz":[-37.415,60,-35.456]}},{"note":{"onTime":175.5,"xyz":[8.675,60,25.059]}},{"note":{"onTime":175.558,"xyz":[-29.576,60,45.383]}},{"note":{"onTime":175.625,"xyz":[11.322,60,-6.18]}},{"note":{"onTime":175.683,"xyz":[41.02,60,32.011]}},{"note":{"onTime":175.75,"xyz":[-5.959,60,30.545]}},{"note":{"onTime":175.808,"xyz":[-33.615,60,28.74]}},{"note":{"onTime":175.875,"xyz":[13.768,60,9.759]}},{"note":{"onTime":175.933,"xyz":[-41.185,60,-24.564]}},{"note":{"onTime":176,"xyz":[8.305,60,-27.304]}},{"note":{"onTime":176.058,"xyz":[27.582,60,-45.248]}},{"note":{"onTime":176.125,"xyz":[-20.908,60,0.646]}},{"note":{"onTime":176.183,"xyz":[-6.164,60,42.544]}},{"note":{"onTime":176.25,"xyz":[25.706,60,15.976]}},{"note":{"onTime":176.308,"xyz":[-25.919,60,-2.137]}},{"note":{"onTime":176.375,"xyz":[41.133,60,-28.907]}},{"note":{"onTime":176.433,"xyz":[-11.141,60,10.159]}},{"note":{"onTime":176.5,"xyz":[4.739,60,2.168]}},{"note":{"onTime":176.558,"xyz":[3.746,60,-30.169]}},{"note":{"onTime":176.625,"xyz":[-0.626,60,-44.268]}},{"note":{"onTime":176.683,"xyz":[15.748,60,10.418]}},{"note":{"onTime":176.75,"xyz":[-38.4,60,48.763]}},{"note":{"onTime":176.808,"xyz":[40.838,60,42.667]}},{"note":{"onTime":176.875,"xyz":[30.729,60,-47.398]}},{"note":{"onTime":176.933,"xyz":[-30.972,60,-31.195]}},{"note":{"onTime":177,"xyz":[24.612,60,4.468]}},{"note":{"onTime":177.058,"xyz":[13.237,60,-14.26]}},{"note":{"onTime":177.125,"xyz":[19.006,60,3.52]}},{"note":{"onTime":177.183,"xyz":[18.541,60,-35.071]}},{"note":{"onTime":177.25,"xyz":[-25.73,60,47.784]}},{"note":{"onTime":177.308,"xyz":[0.451,60,-9.523]}},{"note":{"onTime":177.375,"xyz":[19.229,60,-30.148]}},{"note":{"onTime":177.433,"xyz":[-24.131,60,-47.992]}},{"note":{"onTime":177.5,"xyz":[-1.358,60,39.59]}},{"note":{"onTime":177.558,"xyz":[19.627,60,-18.901]}},{"note":{"onTime":177.625,"xyz":[-0.983,60,-22.866]}},{"note":{"onTime":177.683,"xyz":[-45.784,60,-4.03]}},{"note":{"onTime":177.75,"xyz":[18.767,60,-34.336]}},{"note":{"onTime":177.808,"xyz":[41.727,60,34.833]}},{"note":{"onTime":177.875,"xyz":[24.196,60,26.987]}},{"note":{"onTime":177.933,"xyz":[26.436,60,20.126]}},{"note":{"onTime":178,"xyz":[-36.221,60,30.085]}},{"note":{"onTime":178.058,"xyz":[-44.926,60,-39.976]}},{"note":{"onTime":178.125,"xyz":[-19.161,60,-0.259]}},{"note":{"onTime":178.183,"xyz":[10.889,60,-33.655]}},{"note":{"onTime":178.25,"xyz":[0.414,60,-14.547]}},{"note":{"onTime":178.308,"xyz":[18.444,60,5.61]}},{"note":{"onTime":178.375,"xyz":[-49.08,60,-3.773]}},{"note":{"onTime":178.433,"xyz":[39.818,60,8.669]}},{"note":{"onTime":178.5,"xyz":[46.603,60,10.86]}},{"note":{"onTime":178.558,"xyz":[-29.096,60,0.366]}},{"note":{"onTime":178.625,"xyz":[-16.234,60,-7.831]}},{"note":{"onTime":178.683,"xyz":[-10.063,60,-19.685]}},{"note":{"onTime":178.75,"xyz":[23.834,60,-26.443]}},{"note":{"onTime":178.808,"xyz":[-9.436,60,45.384]}},{"note":{"onTime":178.875,"xyz":[30.502,60,3.604]}},{"note":{"onTime":178.933,"xyz":[-20.092,60,-0.02]}},{"note":{"onTime":179,"xyz":[27.972,60,35.24]}},{"note":{"onTime":179.058,"xyz":[19.454,60,8.205]}},{"note":{"onTime":179.125,"xyz":[33.665,60,-13.221]}},{"note":{"onTime":179.183,"xyz":[-35.598,60,8.411]}},{"note":{"onTime":179.25,"xyz":[23.221,60,-11.083]}},{"note":{"onTime":179.308,"xyz":[-3.307,60,-7.949]}},{"note":{"onTime":179.375,"xyz":[-10.81,60,20.958]}},{"note":{"onTime":179.433,"xyz":[-20.57,60,-48.838]}},{"note":{"onTime":179.5,"xyz":[-11.079,60,37.266]}},{"note":{"onTime":179.558,"xyz":[-32.849,60,-21.407]}},{"note":{"onTime":179.625,"xyz":[22.938,60,47.575]}},{"note":{"onTime":179.683,"xyz":[18.631,60,-31.52]}},{"note":{"onTime":179.75,"xyz":[-26.136,60,48.44]}},{"note":{"onTime":179.808,"xyz":[-42.211,60,-32.309]}},{"note":{"onTime":179.875,"xyz":[48.967,60,-35.823]}},{"note":{"onTime":179.933,"xyz":[45.208,60,-21.739]}},{"note":{"onTime":180,"xyz":[37.812,60,-49.746]}},{"note":{"onTime":180.058,"xyz":[38.854,60,-37.456]}},{"note":{"onTime":180.125,"xyz":[1.731,60,-3.421]}},{"note":{"onTime":180.183,"xyz":[-30.816,60,-37]}},{"note":{"onTime":180.25,"xyz":[-15.08,60,48.678]}},{"note":{"onTime":180.308,"xyz":[12.13,60,-26.312]}},{"note":{"onTime":180.375,"xyz":[-40.615,60,-2.309]}},{"note":{"onTime":180.433,"xyz":[44.695,60,-3.305]}},{"note":{"onTime":180.5,"xyz":[18.73,60,-18.402]}},{"note":{"onTime":180.558,"xyz":[-6.568,60,40.278]}},{"note":{"onTime":180.625,"xyz":[0.398,60,46.44]}},{"note":{"onTime":180.683,"xyz":[-33.025,60,-27.377]}},{"note":{"onTime":180.75,"xyz":[-26.561,60,43.756]}},{"note":{"onTime":180.808,"xyz":[-18.483,60,-7.904]}},{"note":{"onTime":180.875,"xyz":[-39.349,60,45.215]}},{"note":{"onTime":180.933,"xyz":[-26.256,60,17.932]}},{"note":{"onTime":181,"xyz":[1.13,60,43.826]}},{"note":{"onTime":181.058,"xyz":[30.611,60,0.713]}},{"note":{"onTime":181.125,"xyz":[-16.79,60,39.307]}},{"note":{"onTime":181.183,"xyz":[-19.326,60,5.99]}},{"note":{"onTime":181.25,"xyz":[19.635,60,-20.447]}},{"note":{"onTime":181.308,"xyz":[-31.26,60,-6.743]}},{"note":{"onTime":181.375,"xyz":[-22.036,60,6.737]}},{"note":{"onTime":181.433,"xyz":[5.628,60,2.422]}},{"note":{"onTime":181.5,"xyz":[-49.258,60,41.902]}},{"note":{"onTime":181.558,"xyz":[29.048,60,27.206]}},{"note":{"onTime":181.625,"xyz":[33.315,60,-8.053]}},{"note":{"onTime":181.683,"xyz":[-38.647,60,5.779]}},{"note":{"onTime":181.75,"xyz":[3.411,60,-15.865]}},{"note":{"onTime":181.808,"xyz":[-13.712,60,49.665]}},{"note":{"onTime":181.875,"xyz":[47.101,60,-18.235]}},{"note":{"onTime":181.933,"xyz":[21.319,60,-31.227]}},{"note":{"onTime":182,"xyz":[-18.289,60,16.784]}},{"note":{"onTime":182.058,"xyz":[15.678,60,-10.455]}},{"note":{"onTime":182.125,"xyz":[-31.049,60,47.105]}},{"note":{"onTime":182.183,"xyz":[-11.612,60,11.012]}},{"note":{"onTime":182.25,"xyz":[22.133,60,14.428]}},{"note":{"onTime":182.308,"xyz":[16.308,60,-43.91]}},{"note":{"onTime":182.375,"xyz":[-28.749,60,-1.186]}},{"note":{"onTime":182.433,"xyz":[21.008,60,-40.816]}},{"note":{"onTime":182.5,"xyz":[-9.997,60,45.227]}},{"note":{"onTime":182.558,"xyz":[-33.711,60,42.194]}},{"note":{"onTime":182.625,"xyz":[-9.093,60,31.128]}},{"note":{"onTime":182.683,"xyz":[-3.395,60,-24.388]}},{"note":{"onTime":182.75,"xyz":[-10.348,60,-40.848]}},{"note":{"onTime":182.808,"xyz":[1.819,60,-44.064]}},{"note":{"onTime":182.875,"xyz":[9.103,60,-48.845]}},{"note":{"onTime":182.933,"xyz":[16.88,60,-38.873]}},{"note":{"onTime":183,"xyz":[-31.951,60,-4.163]}},{"note":{"onTime":183.058,"xyz":[37.369,60,28.781]}},{"note":{"onTime":183.125,"xyz":[-38.77,60,17.832]}},{"note":{"onTime":183.183,"xyz":[-15.321,60,43.202]}},{"note":{"onTime":183.25,"xyz":[16.577,60,-1.999]}},{"note":{"onTime":183.308,"xyz":[-30.83,60,-26.132]}},{"note":{"onTime":183.375,"xyz":[-5.819,60,38.8]}},{"note":{"onTime":183.433,"xyz":[7.137,60,-14.732]}},{"note":{"onTime":183.5,"xyz":[0.643,60,41.377]}},{"note":{"onTime":183.558,"xyz":[29.183,60,-7.155]}},{"note":{"onTime":183.625,"xyz":[13.193,60,-1.385]}},{"note":{"onTime":183.683,"xyz":[4.78,60,-21.835]}},{"note":{"onTime":183.75,"xyz":[-28.199,60,17.072]}},{"note":{"onTime":183.808,"xyz":[-18.248,60,-45.33]}},{"note":{"onTime":183.875,"xyz":[-14.569,60,16.751]}},{"note":{"onTime":183.933,"xyz":[31.27,60,-0.343]}},{"note":{"onTime":184,"xyz":[42.093,60,27.32]}},{"note":{"onTime":184.058,"xyz":[-19.887,60,-5.176]}},{"note":{"onTime":184.125,"xyz":[-7.502,60,-41.174]}},{"note":{"onTime":184.183,"xyz":[33.478,60,-47.052]}},{"note":{"onTime":184.25,"xyz":[25.273,60,-19.459]}},{"note":{"onTime":184.308,"xyz":[24.961,60,8.369]}},{"note":{"onTime":184.375,"xyz":[49.055,60,49.485]}},{"note":{"onTime":184.433,"xyz":[6.585,60,20.149]}},{"note":{"onTime":184.5,"xyz":[-25.38,60,-3.342]}},{"note":{"onTime":184.558,"xyz":[-7.755,60,35.299]}},{"note":{"onTime":184.625,"xyz":[29.744,60,-39.616]}},{"note":{"onTime":184.683,"xyz":[23.884,60,-8.388]}},{"note":{"onTime":184.75,"xyz":[-27.98,60,-41.399]}},{"note":{"onTime":184.808,"xyz":[22.405,60,-38.4]}},{"note":{"onTime":184.875,"xyz":[-28.402,60,-28.297]}},{"note":{"onTime":184.933,"xyz":[45.975,60,-42.91]}},{"note":{"onTime":185,"xyz":[48.003,60,-29.051]}},{"note":{"onTime":185.058,"xyz":[-11.797,60,-15.514]}},{"note":{"onTime":185.125,"xyz":[44.132,60,30.643]}},{"note":{"onTime":185.183,"xyz":[39.051,60,-30.357]}},{"note":{"onTime":185.25,"xyz":[37.423,60,11.631]}},{"note":{"onTime":185.308,"xyz":[-16.631,60,15.22]}},{"note":{"onTime":185.375,"xyz":[4.285,60,-44.682]}},{"note":{"onTime":185.433,"xyz":[-43.057,60,18.244]}},{"note":{"onTime":185.5,"xyz":[0.478,60,-12.369]}},{"note":{"onTime":185.558,"xyz":[-0.768,60,17.978]}},{"note":{"onTime":185.625,"xyz":[-21.57,60,-42.49]}},{"note":{"onTime":185.683,"xyz":[-33.373,60,-29.997]}},{"note":{"onTime":185.75,"xyz":[-36.262,60,30.637]}},{"note":{"onTime":185.808,"xyz":[-18.478,60,8.181]}},{"note":{"onTime":185.875,"xyz":[38.605,60,-17.303]}},{"note":{"onTime":185.933,"xyz":[21.876,60,-32.029]}},{"note":{"onTime":186,"xyz":[-39.109,60,-6.431]}},{"note":{"onTime":186.058,"xyz":[-15.459,60,-41.261]}},{"note":{"onTime":186.125,"xyz":[-34.818,60,-9.187]}},{"note":{"onTime":186.183,"xyz":[14.745,60,-4.565]}},{"note":{"onTime":186.25,"xyz":[-22.127,60,33.921]}},{"note":{"onTime":186.308,"xyz":[-35.118,60,-12.357]}},{"note":{"onTime":186.375,"xyz":[13.147,60,26.158]}},{"note":{"onTime":186.433,"xyz":[-40.431,60,42.662]}},{"note":{"onTime":186.5,"xyz":[32.09,60,-5.138]}},{"note":{"onTime":186.558,"xyz":[-18.115,60,25.343]}},{"note":{"onTime":186.625,"xyz":[24.172,60,49.916]}},{"note":{"onTime":186.683,"xyz":[-10.821,60,37.019]}},{"note":{"onTime":186.75,"xyz":[40.405,60,20.019]}},{"note":{"onTime":186.808,"xyz":[-2.977,60,-14.657]}},{"note":{"onTime":186.875,"xyz":[-48.311,60,33.704]}},{"note":{"onTime":186.933,"xyz":[-32.001,60,22.412]}},{"note":{"onTime":187,"xyz":[-44.421,60,-37.099]}},{"note":{"onTime":187.058,"xyz":[-10.602,60,-13.533]}},{"note":{"onTime":187.125,"xyz":[-8.871,60,37.589]}},{"note":{"onTime":187.183,"xyz":[-48.262,60,-1.026]}},{"note":{"onTime":187.25,"xyz":[-24.138,60,-23.123]}},{"note":{"onTime":187.308,"xyz":[29.539,60,0.211]}},{"note":{"onTime":187.375,"xyz":[32.53,60,21.024]}},{"note":{"onTime":187.433,"xyz":[48.344,60,-41.047]}},{"note":{"onTime":187.5,"xyz":[-42.587,60,-3.331]}},{"note":{"onTime":187.558,"xyz":[-21.314,60,21.636]}},{"note":{"onTime":187.625,"xyz":[-22.306,60,-39.877]}},{"note":{"onTime":187.683,"xyz":[-40.084,60,-20.282]}},{"note":{"onTime":187.75,"xyz":[-15.761,60,47.279]}},{"note":{"onTime":187.808,"xyz":[5.753,60,-12.763]}},{"note":{"onTime":187.875,"xyz":[-10.921,60,-30.271]}},{"note":{"onTime":187.933,"xyz":[10.263,60,-40.162]}},{"note":{"onTime":188,"xyz":[-24.653,60,41.298]}},{"note":{"onTime":188.058,"xyz":[39.155,60,-11.788]}},{"note":{"onTime":188.125,"xyz":[-37.374,60,-46.303]}},{"note":{"onTime":188.183,"xyz":[-12.209,60,9.165]}},{"note":{"onTime":188.25,"xyz":[33.777,60,-49.469]}},{"note":{"onTime":188.308,"xyz":[-4.321,60,-47.409]}},{"note":{"onTime":188.375,"xyz":[41.688,60,31.846]}},{"note":{"onTime":188.433,"xyz":[-41.585,60,28.86]}},{"note":{"onTime":188.5,"xyz":[-32.765,60,-37.126]}},{"note":{"onTime":188.558,"xyz":[-46.397,60,-5.362]}},{"note":{"onTime":188.625,"xyz":[14.267,60,16.998]}},{"note":{"onTime":188.683,"xyz":[28.172,60,42.288]}},{"note":{"onTime":188.75,"xyz":[34.98,60,-39.612]}},{"note":{"onTime":188.808,"xyz":[-37.767,60,-45.013]}},{"note":{"onTime":188.875,"xyz":[-39.26,60,40.562]}},{"note":{"onTime":188.933,"xyz":[-39.766,60,-37.257]}},{"note":{"onTime":189,"xyz":[0.678,60,-20.509]}},{"note":{"onTime":189.058,"xyz":[5.055,60,-20.072]}},{"note":{"onTime":189.125,"xyz":[44.252,60,-49.915]}},{"note":{"onTime":189.183,"xyz":[-24.002,60,8.917]}},{"note":{"onTime":189.25,"xyz":[-4.104,60,39.233]}},{"note":{"onTime":189.308,"xyz":[-41.307,60,13.301]}},{"note":{"onTime":189.375,"xyz":[-39.015,60,27.214]}},{"note":{"onTime":189.433,"xyz":[-5.049,60,4.065]}},{"note":{"onTime":189.5,"xyz":[23.925,60,48.556]}},{"note":{"onTime":189.558,"xyz":[14.846,60,-0.588]}},{"note":{"onTime":189.625,"xyz":[-7.533,60,-0.492]}},{"note":{"onTime":189.683,"xyz":[-7.013,60,19.797]}},{"note":{"onTime":189.75,"xyz":[-41.366,60,28.509]}},{"note":{"onTime":189.808,"xyz":[-42.59,60,20.439]}},{"note":{"onTime":189.875,"xyz":[27.126,60,44.531]}},{"note":{"onTime":189.933,"xyz":[-16.13,60,-49.562]}},{"note":{"onTime":190,"xyz":[18.017,60,10.341]}},{"note":{"onTime":190.058,"xyz":[11.958,60,16.728]}},{"note":{"onTime":190.125,"xyz":[43.264,60,9.674]}},{"note":{"onTime":190.183,"xyz":[-46.467,60,28.891]}},{"note":{"onTime":190.25,"xyz":[17.143,60,-4.602]}},{"note":{"onTime":190.308,"xyz":[9.771,60,-36.546]}},{"note":{"onTime":190.375,"xyz":[-29.348,60,-3.872]}},{"note":{"onTime":190.433,"xyz":[1.89,60,19.942]}},{"note":{"onTime":190.5,"xyz":[30.188,60,-12.208]}},{"note":{"onTime":190.558,"xyz":[33.609,60,2.059]}},{"note":{"onTime":190.625,"xyz":[-27.082,60,-19.534]}},{"note":{"onTime":190.683,"xyz":[-28.142,60,-48.061]}},{"note":{"onTime":190.75,"xyz":[16.23,60,35.748]}},{"note":{"onTime":190.808,"xyz":[37.407,60,49.913]}},{"note":{"onTime":190.875,"xyz":[17.928,60,-27.753]}},{"note":{"onTime":190.933,"xyz":[-29.724,60,-27.201]}},{"note":{"onTime":191,"xyz":[-11.487,60,42.584]}},{"note":{"onTime":191.058,"xyz":[-42.915,60,36.634]}},{"note":{"onTime":191.125,"xyz":[28.342,60,31.107]}},{"note":{"onTime":191.183,"xyz":[10.404,60,41.256]}},{"note":{"onTime":191.25,"xyz":[31.838,60,33.258]}},{"note":{"onTime":191.308,"xyz":[-45.344,60,40.513]}},{"note":{"onTime":191.375,"xyz":[29.53,60,-8.252]}},{"note":{"onTime":191.433,"xyz":[30.688,60,-10.693]}},{"note":{"onTime":191.5,"xyz":[-2.194,60,-12.58]}},{"note":{"onTime":191.558,"xyz":[-37.172,60,23.463]}},{"note":{"onTime":191.625,"xyz":[37.045,60,-29.718]}},{"note":{"onTime":191.683,"xyz":[-30.512,60,16.79]}},{"note":{"onTime":191.75,"xyz":[32.565,60,-25.098]}},{"note":{"onTime":191.808,"xyz":[22.273,60,-12.05]}},{"note":{"onTime":191.875,"xyz":[-49.172,60,-49.645]}},{"note":{"onTime":191.933,"xyz":[0.449,60,4.018]}},{"note":{"onTime":192,"xyz":[16.771,60,-45.41]}},{"note":{"onTime":192.058,"xyz":[28.77,60,4.331]}},{"note":{"onTime":192.125,"xyz":[48.344,60,-27.499]}},{"note":{"onTime":192.183,"xyz":[-41.801,60,-46.571]}},{"note":{"onTime":192.25,"xyz":[22.443,60,22.611]}},{"note":{"onTime":192.308,"xyz":[32.39,60,-17.964]}},{"note":{"onTime":192.375,"xyz":[-6.175,60,-24.855]}},{"note":{"onTime":192.433,"xyz":[9.072,60,-3.832]}},{"note":{"onTime":192.5,"xyz":[16.397,60,20.776]}},{"note":{"onTime":192.558,"xyz":[-44.076,60,-16.957]}},{"note":{"onTime":192.625,"xyz":[5.824,60,-39.284]}},{"note":{"onTime":192.683,"xyz":[46.541,60,24.553]}},{"note":{"onTime":192.75,"xyz":[-35.045,60,41.206]}},{"note":{"onTime":192.808,"xyz":[24.731,60,1.066]}},{"note":{"onTime":192.875,"xyz":[-49.756,60,-14.712]}},{"note":{"onTime":192.933,"xyz":[16.032,60,36.356]}},{"note":{"onTime":193,"xyz":[19.607,60,-11.896]}},{"note":{"onTime":193.058,"xyz":[25.212,60,-45.088]}},{"note":{"onTime":193.125,"xyz":[-48.948,60,-4.807]}},{"note":{"onTime":193.183,"xyz":[-1.161,60,1.838]}},{"note":{"onTime":193.25,"xyz":[-11.685,60,-17.427]}},{"note":{"onTime":193.308,"xyz":[34.067,60,-30.568]}},{"note":{"onTime":193.375,"xyz":[35.857,60,-40.953]}},{"note":{"onTime":193.433,"xyz":[9.79,60,-10.526]}},{"note":{"onTime":193.5,"xyz":[-48.851,60,49.56]}},{"note":{"onTime":193.558,"xyz":[22.158,60,21.452]}},{"note":{"onTime":193.625,"xyz":[-14.442,60,42.505]}},{"note":{"onTime":193.683,"xyz":[-6.816,60,43.652]}},{"note":{"onTime":193.75,"xyz":[-41.467,60,-31.376]}},{"note":{"onTime":193.808,"xyz":[-11.617,60,11.311]}},{"note":{"onTime":193.875,"xyz":[-25.984,60,32.134]}},{"note":{"onTime":193.933,"xyz":[-28.014,60,26.092]}},{"note":{"onTime":194,"xyz":[-31.068,60,21.497]}},{"note":{"onTime":194.058,"xyz":[5.876,60,45.541]}},{"note":{"onTime":194.125,"xyz":[-33.918,60,7.013]}},{"note":{"onTime":194.183,"xyz":[-11.937,60,-26.113]}},{"note":{"onTime":194.25,"xyz":[-17.02,60,-29.465]}},{"note":{"onTime":194.308,"xyz":[-5.21,60,42.002]}},{"note":{"onTime":194.375,"xyz":[-26.779,60,37.631]}},{"note":{"onTime":194.433,"xyz":[15.295,60,9.341]}},{"note":{"onTime":194.5,"xyz":[1.926,60,7.497]}},{"note":{"onTime":194.558,"xyz":[-6.672,60,45.658]}},{"note":{"onTime":194.625,"xyz":[-18.17,60,0.932]}},{"note":{"onTime":194.683,"xyz":[14.457,60,-24.677]}},{"note":{"onTime":194.75,"xyz":[21.581,60,-28.295]}},{"note":{"onTime":194.808,"xyz":[3.247,60,-7.946]}},{"note":{"onTime":194.875,"xyz":[-37.192,60,-48.403]}},{"note":{"onTime":194.933,"xyz":[19.355,60,-23.136]}},{"note":{"onTime":195,"xyz":[7.516,60,24.461]}},{"note":{"onTime":195.058,"xyz":[-33.379,60,-22.954]}},{"note":{"onTime":195.125,"xyz":[-37.62,60,49.589]}},{"note":{"onTime":195.183,"xyz":[-45.796,60,29.011]}},{"note":{"onTime":195.25,"xyz":[-48.5,60,-20.29]}},{"note":{"onTime":195.308,"xyz":[-26.159,60,32.775]}},{"note":{"onTime":195.375,"xyz":[-25.837,60,43.937]}},{"note":{"onTime":195.433,"xyz":[-17.735,60,10.929]}},{"note":{"onTime":195.5,"xyz":[9.202,60,-9.047]}},{"note":{"onTime":195.558,"xyz":[2.88,60,9.892]}},{"note":{"onTime":195.625,"xyz":[-7.512,60,12.78]}},{"note":{"onTime":195.683,"xyz":[-14.277,60,26.254]}},{"note":{"onTime":195.75,"xyz":[19.135,60,-5.588]}},{"note":{"onTime":195.808,"xyz":[-10.202,60,-33.961]}},{"note":{"onTime":195.875,"xyz":[46.972,60,-40.347]}},{"note":{"onTime":195.933,"xyz":[-23.173,60,-30.312]}},{"note":{"onTime":196,"xyz":[2.849,60,8.445]}},{"note":{"onTime":196.058,"xyz":[30.5,60,-39.427]}},{"note":{"onTime":196.125,"xyz":[18.335,60,-33.974]}},{"note":{"onTime":196.183,"xyz":[40.266,60,-0.14]}},{"note":{"onTime":196.25,"xyz":[46.377,60,-10.793]}},{"note":{"onTime":196.308,"xyz":[13.744,60,-44.46]}},{"note":{"onTime":196.375,"xyz":[35.473,60,0.095]}},{"note":{"onTime":196.433,"xyz":[6.805,60,18.419]}},{"note":{"onTime":196.5,"xyz":[-37.068,60,42.569]}},{"note":{"onTime":196.558,"xyz":[-14.603,60,22.907]}},{"note":{"onTime":196.625,"xyz":[-46.223,60,-18.18]}},{"note":{"onTime":196.683,"xyz":[-41.834,60,-44.608]}},{"note":{"onTime":196.75,"xyz":[36.852,60,-7.724]}},{"note":{"onTime":196.808,"xyz":[43.946,60,-41.966]}},{"note":{"onTime":196.875,"xyz":[14.704,60,4.213]}},{"note":{"onTime":196.933,"xyz":[-36.835,60,-39.22]}},{"note":{"onTime":197,"xyz":[48.792,60,4.368]}},{"note":{"onTime":197.058,"xyz":[-32.747,60,-0.595]}},{"note":{"onTime":197.125,"xyz":[-13.404,60,10.878]}},{"note":{"onTime":197.183,"xyz":[45.089,60,2.414]}},{"note":{"onTime":197.25,"xyz":[-17.825,60,-32.164]}},{"note":{"onTime":197.308,"xyz":[-29.433,60,-45.402]}},{"note":{"onTime":197.375,"xyz":[-13.247,60,29.8]}},{"note":{"onTime":197.433,"xyz":[-19.666,60,-29.944]}},{"note":{"onTime":197.5,"xyz":[10.882,60,31.545]}},{"note":{"onTime":197.558,"xyz":[-4.226,60,32.518]}},{"note":{"onTime":197.625,"xyz":[-15.249,60,-36.613]}},{"note":{"onTime":197.683,"xyz":[28.283,60,-14.253]}},{"note":{"onTime":197.75,"xyz":[-31.799,60,-2.611]}},{"note":{"onTime":197.808,"xyz":[31.913,60,-18.13]}},{"note":{"onTime":197.875,"xyz":[-12.989,60,34.752]}},{"note":{"onTime":197.933,"xyz":[-7.557,60,20.414]}},{"note":{"onTime":198,"xyz":[-2.982,60,-30.287]}},{"note":{"onTime":198.058,"xyz":[-33.069,60,35.888]}},{"note":{"onTime":198.125,"xyz":[2.625,60,-9.741]}},{"note":{"onTime":198.183,"xyz":[12.826,60,16.715]}},{"note":{"onTime":198.25,"xyz":[-18.73,60,-39.029]}},{"note":{"onTime":198.308,"xyz":[-29.312,60,-36.69]}},{"note":{"onTime":198.375,"xyz":[-9.582,60,-41.691]}},{"note":{"onTime":198.433,"xyz":[-10.418,60,18.147]}},{"note":{"onTime":198.5,"xyz":[-41.37,60,-46.355]}},{"note":{"onTime":198.558,"xyz":[9.218,60,25.602]}},{"note":{"onTime":198.625,"xyz":[-12.723,60,-35.622]}},{"note":{"onTime":198.683,"xyz":[37.882,60,4.394]}},{"note":{"onTime":198.75,"xyz":[14.463,60,18.405]}},{"note":{"onTime":198.808,"xyz":[-9.763,60,40.44]}},{"note":{"onTime":198.875,"xyz":[17.715,60,2.309]}},{"note":{"onTime":198.933,"xyz":[-25.952,60,32.929]}},{"note":{"onTime":199,"xyz":[-42.989,60,-11.474]}},{"note":{"onTime":199.058,"xyz":[39.897,60,-48.567]}},{"note":{"onTime":199.125,"xyz":[-15.306,60,-38.151]}},{"note":{"onTime":199.183,"xyz":[32.943,60,-13.134]}},{"note":{"onTime":199.25,"xyz":[-26.152,60,-9.452]}},{"note":{"onTime":199.308,"xyz":[10.8,60,4.1]}},{"note":{"onTime":199.375,"xyz":[41.695,60,12.439]}},{"note":{"onTime":199.433,"xyz":[16.594,60,29.061]}},{"note":{"onTime":199.5,"xyz":[-30.432,60,31.197]}},{"note":{"onTime":199.558,"xyz":[21.25,60,28.099]}},{"note":{"onTime":199.625,"xyz":[46.037,60,43.251]}},{"note":{"onTime":199.683,"xyz":[-25.915,60,-37.534]}},{"note":{"onTime":199.75,"xyz":[-15.267,60,40.543]}},{"note":{"onTime":199.808,"xyz":[25.764,60,25.698]}},{"note":{"onTime":199.875,"xyz":[-6.551,60,-40.518]}},{"note":{"onTime":199.933,"xyz":[12.681,60,-3.275]}},{"note":{"onTime":200,"xyz":[-3.931,60,-28.586]}},{"note":{"onTime":200.058,"xyz":[16.828,60,-33.491]}},{"note":{"onTime":200.125,"xyz":[33.892,60,34.887]}},{"note":{"onTime":200.183,"xyz":[40.216,60,21.033]}},{"note":{"onTime":200.25,"xyz":[-2.088,60,-44.934]}},{"note":{"onTime":200.308,"xyz":[-42.092,60,-11.543]}},{"note":{"onTime":200.375,"xyz":[-31.377,60,20.572]}},{"note":{"onTime":200.433,"xyz":[38.726,60,-16.769]}},{"note":{"onTime":200.5,"xyz":[-35.102,60,13.09]}},{"note":{"onTime":200.558,"xyz":[47.702,60,5.012]}},{"note":{"onTime":200.625,"xyz":[28.522,60,10.031]}},{"note":{"onTime":200.683,"xyz":[-30.673,60,-24.839]}},{"note":{"onTime":200.75,"xyz":[-4.082,60,25.58]}},{"note":{"onTime":200.808,"xyz":[15.656,60,18.664]}},{"note":{"onTime":200.875,"xyz":[33.659,60,-39.564]}},{"note":{"onTime":200.933,"xyz":[8.353,60,24.267]}},{"note":{"onTime":201,"xyz":[39.302,60,-44.452]}},{"note":{"onTime":201.058,"xyz":[48.713,60,40.65]}},{"note":{"onTime":201.125,"xyz":[34.116,60,-29.822]}},{"note":{"onTime":201.183,"xyz":[14.737,60,-8.553]}},{"note":{"onTime":201.25,"xyz":[-0.727,60,29.584]}},{"note":{"onTime":201.308,"xyz":[49.327,60,16.928]}},{"note":{"onTime":201.375,"xyz":[32.054,60,12.652]}},{"note":{"onTime":201.433,"xyz":[28.644,60,-24.848]}}],"fd575f03378047af835c19ef4f7d5991":[{"instanceName":"-","pitchLfoAmp":0.333,"pitchLfoShape":[0,0.067,0.133,0.2,0.267,0.333,0.4,0.467,0.533,0.6,0.667,0.733,0.8,0.867,0.933,1,0.933,0.867,0.8,0.733,0.667,0.6,0.533,0.467,0.4,0.333,0.267,0.2,0.133,0.067,0,-0.067,-0.133,-0.2,-0.267,-0.333,-0.4,-0.467,-0.533,-0.6,-0.667,-0.733,-0.8,-0.867,-0.933,-1,-0.933,-0.867,-0.8,-0.733,-0.667,-0.6,-0.533,-0.467,-0.4,-0.333,-0.267,-0.2,-0.133,-0.067]},{"note":{"onTime":6.5,"pitch":72,"pitchLfoTime":25.705,"xyz":[0,0,-300],"offTime":7.6}},{"note":{"onTime":6.5,"pitch":76,"pitchLfoTime":25.705,"offTime":7.6}},{"note":{"onTime":8.5,"pitch":72,"pitchLfoTime":32.375,"offTime":9.6}},{"note":{"onTime":8.5,"pitch":76,"pitchLfoTime":32.375,"offTime":9.6}},{"note":{"onTime":10.5,"pitch":72,"pitchLfoTime":24.456,"offTime":11.6}},{"note":{"onTime":10.5,"pitch":76,"pitchLfoTime":24.456,"offTime":11.6}},{"note":{"onTime":12.5,"pitch":72,"pitchLfoTime":16.537,"offTime":13.6}},{"note":{"onTime":12.5,"pitch":76,"pitchLfoTime":16.537,"offTime":13.6}},{"note":{"onTime":14.5,"pitch":72,"pitchLfoTime":8.617,"offTime":15.6}},{"note":{"onTime":14.5,"pitch":76,"pitchLfoTime":8.617,"offTime":15.6}},{"note":{"onTime":16.5,"pitch":72,"pitchLfoTime":0.698,"offTime":17.6}},{"note":{"onTime":16.5,"pitch":76,"pitchLfoTime":0.698,"offTime":17.6}},{"note":{"onTime":18.5,"pitch":72,"pitchLfoTime":7.222,"offTime":19.6}},{"note":{"onTime":18.5,"pitch":76,"pitchLfoTime":7.222,"offTime":19.6}},{"note":{"onTime":20.5,"pitch":72,"pitchLfoTime":15.141,"offTime":21.6}},{"note":{"onTime":20.5,"pitch":76,"pitchLfoTime":15.141,"offTime":21.6}},{"note":{"onTime":22.5,"pitch":72,"pitchLfoTime":23.061,"offTime":23.6}},{"note":{"onTime":22.5,"pitch":76,"pitchLfoTime":23.061,"offTime":23.6}},{"note":{"onTime":24.5,"pitch":72,"pitchLfoTime":30.98,"offTime":25.6}},{"note":{"onTime":24.5,"pitch":76,"pitchLfoTime":30.98,"offTime":25.6}},{"note":{"onTime":26.5,"pitch":72,"pitchLfoTime":27.101,"offTime":27.6}},{"note":{"onTime":26.5,"pitch":76,"pitchLfoTime":27.101,"offTime":27.6}},{"note":{"onTime":28.5,"pitch":72,"pitchLfoTime":19.181,"offTime":29.6}},{"note":{"onTime":28.5,"pitch":76,"pitchLfoTime":19.181,"offTime":29.6}},{"note":{"onTime":30.5,"pitch":72,"pitchLfoTime":11.262,"offTime":31.6}},{"note":{"onTime":30.5,"pitch":76,"pitchLfoTime":11.262,"offTime":31.6}},{"note":{"onTime":32.5,"pitch":72,"pitchLfoTime":3.342,"offTime":33.6}},{"note":{"onTime":32.5,"pitch":76,"pitchLfoTime":3.342,"offTime":33.6}},{"note":{"onTime":34.5,"pitch":72,"pitchLfoTime":4.577,"offTime":35.6}},{"note":{"onTime":34.5,"pitch":76,"pitchLfoTime":4.577,"offTime":35.6}},{"note":{"onTime":36.5,"pitch":72,"pitchLfoTime":12.497,"offTime":37.6}},{"note":{"onTime":36.5,"pitch":76,"pitchLfoTime":12.497,"offTime":37.6}},{"note":{"onTime":38.5,"pitch":72,"pitchLfoTime":20.416,"offTime":39.6}},{"note":{"onTime":38.5,"pitch":76,"pitchLfoTime":20.416,"offTime":39.6}},{"note":{"onTime":40.5,"pitch":72,"pitchLfoTime":28.335,"offTime":41.6}},{"note":{"onTime":40.5,"pitch":76,"pitchLfoTime":28.335,"offTime":41.6}},{"note":{"onTime":42.5,"pitch":72,"pitchLfoTime":29.745,"offTime":43.6}},{"note":{"onTime":42.5,"pitch":76,"pitchLfoTime":29.745,"offTime":43.6}},{"note":{"onTime":44.5,"pitch":72,"pitchLfoTime":21.826,"offTime":45.6}},{"note":{"onTime":44.5,"pitch":76,"pitchLfoTime":21.826,"offTime":45.6}},{"note":{"onTime":46.5,"pitch":72,"pitchLfoTime":13.906,"offTime":47.6}},{"note":{"onTime":46.5,"pitch":76,"pitchLfoTime":13.906,"offTime":47.6}},{"note":{"onTime":48.5,"pitch":72,"pitchLfoTime":5.987,"offTime":49.6}},{"note":{"onTime":48.5,"pitch":76,"pitchLfoTime":5.987,"offTime":49.6}},{"note":{"onTime":50.5,"pitch":72,"pitchLfoTime":1.933,"offTime":51.6}},{"note":{"onTime":50.5,"pitch":76,"pitchLfoTime":1.933,"offTime":51.6}},{"note":{"onTime":52.5,"pitch":72,"pitchLfoTime":9.852,"offTime":53.6}},{"note":{"onTime":52.5,"pitch":76,"pitchLfoTime":9.852,"offTime":53.6}},{"note":{"onTime":54.5,"pitch":72,"pitchLfoTime":17.771,"offTime":55.6}},{"note":{"onTime":54.5,"pitch":76,"pitchLfoTime":17.771,"offTime":55.6}},{"note":{"onTime":56.5,"pitch":72,"pitchLfoTime":25.691,"offTime":57.6}},{"note":{"onTime":56.5,"pitch":76,"pitchLfoTime":25.691,"offTime":57.6}},{"note":{"onTime":58.5,"pitch":72,"pitchLfoTime":32.39,"offTime":59.6}},{"note":{"onTime":58.5,"pitch":76,"pitchLfoTime":32.39,"offTime":59.6}},{"note":{"onTime":60.5,"pitch":72,"pitchLfoTime":24.47,"offTime":61.6}},{"note":{"onTime":60.5,"pitch":76,"pitchLfoTime":24.47,"offTime":61.6}},{"note":{"onTime":62.5,"pitch":72,"pitchLfoTime":16.551,"offTime":63.6}},{"note":{"onTime":62.5,"pitch":76,"pitchLfoTime":16.551,"offTime":63.6}},{"note":{"onTime":64.5,"pitch":72,"pitchLfoTime":8.632,"offTime":65.6}},{"note":{"onTime":64.5,"pitch":76,"pitchLfoTime":8.632,"offTime":65.6}},{"note":{"onTime":66.5,"pitch":72,"pitchLfoTime":0.712,"offTime":67.6}},{"note":{"onTime":66.5,"pitch":76,"pitchLfoTime":0.712,"offTime":67.6}},{"note":{"onTime":68.5,"pitch":72,"pitchLfoTime":7.207,"offTime":69.6}},{"note":{"onTime":68.5,"pitch":76,"pitchLfoTime":7.207,"offTime":69.6}},{"note":{"onTime":70.5,"pitch":72,"pitchLfoTime":15.127,"offTime":71.6}},{"note":{"onTime":70.5,"pitch":76,"pitchLfoTime":15.127,"offTime":71.6}},{"note":{"onTime":72.5,"pitch":72,"pitchLfoTime":23.046,"offTime":73.6}},{"note":{"onTime":72.5,"pitch":76,"pitchLfoTime":23.046,"offTime":73.6}},{"note":{"onTime":74.5,"pitch":72,"pitchLfoTime":30.966,"offTime":75.6}},{"note":{"onTime":74.5,"pitch":76,"pitchLfoTime":30.966,"offTime":75.6}},{"note":{"onTime":76.5,"pitch":72,"pitchLfoTime":27.115,"offTime":77.6}},{"note":{"onTime":76.5,"pitch":76,"pitchLfoTime":27.115,"offTime":77.6}},{"note":{"onTime":78.5,"pitch":72,"pitchLfoTime":19.196,"offTime":79.6}},{"note":{"onTime":78.5,"pitch":76,"pitchLfoTime":19.196,"offTime":79.6}},{"note":{"onTime":80.5,"pitch":72,"pitchLfoTime":11.276,"offTime":81.6}},{"note":{"onTime":80.5,"pitch":76,"pitchLfoTime":11.276,"offTime":81.6}},{"note":{"onTime":82.5,"pitch":72,"pitchLfoTime":3.357,"offTime":83.6}},{"note":{"onTime":82.5,"pitch":76,"pitchLfoTime":3.357,"offTime":83.6}},{"note":{"onTime":84.5,"pitch":72,"pitchLfoTime":4.563,"offTime":85.6}},{"note":{"onTime":84.5,"pitch":76,"pitchLfoTime":4.563,"offTime":85.6}},{"note":{"onTime":86.5,"pitch":72,"pitchLfoTime":12.482,"offTime":87.6}},{"note":{"onTime":86.5,"pitch":76,"pitchLfoTime":12.482,"offTime":87.6}},{"note":{"onTime":88.5,"pitch":72,"pitchLfoTime":20.402,"offTime":89.6}},{"note":{"onTime":88.5,"pitch":76,"pitchLfoTime":20.402,"offTime":89.6}},{"note":{"onTime":90.5,"pitch":72,"pitchLfoTime":28.321,"offTime":91.6}},{"note":{"onTime":90.5,"pitch":76,"pitchLfoTime":28.321,"offTime":91.6}},{"note":{"onTime":92.5,"pitch":72,"pitchLfoTime":29.76,"offTime":93.6}},{"note":{"onTime":92.5,"pitch":76,"pitchLfoTime":29.76,"offTime":93.6}},{"note":{"onTime":94.5,"pitch":72,"pitchLfoTime":21.84,"offTime":95.6}},{"note":{"onTime":94.5,"pitch":76,"pitchLfoTime":21.84,"offTime":95.6}},{"note":{"onTime":96.5,"pitch":72,"pitchLfoTime":13.921,"offTime":97.6}},{"note":{"onTime":96.5,"pitch":76,"pitchLfoTime":13.921,"offTime":97.6}},{"note":{"onTime":98.5,"pitch":72,"pitchLfoTime":6.001,"offTime":99.6}},{"note":{"onTime":98.5,"pitch":76,"pitchLfoTime":6.001,"offTime":99.6}},{"note":{"onTime":100.5,"pitch":72,"pitchLfoTime":1.918,"offTime":101.6}},{"note":{"onTime":100.5,"pitch":76,"pitchLfoTime":1.918,"offTime":101.6}},{"note":{"onTime":102.5,"pitch":72,"pitchLfoTime":9.838,"offTime":103.6}},{"note":{"onTime":102.5,"pitch":76,"pitchLfoTime":9.838,"offTime":103.6}},{"note":{"onTime":104.5,"pitch":72,"pitchLfoTime":17.757,"offTime":105.6}},{"note":{"onTime":104.5,"pitch":76,"pitchLfoTime":17.757,"offTime":105.6}},{"note":{"onTime":106.5,"pitch":72,"pitchLfoTime":25.676,"offTime":107.6}},{"note":{"onTime":106.5,"pitch":76,"pitchLfoTime":25.676,"offTime":107.6}},{"note":{"onTime":108.5,"pitch":72,"pitchLfoTime":32.404,"offTime":109.6}},{"note":{"onTime":108.5,"pitch":76,"pitchLfoTime":32.404,"offTime":109.6}},{"note":{"onTime":110.5,"pitch":72,"pitchLfoTime":24.485,"offTime":111.6}},{"note":{"onTime":110.5,"pitch":76,"pitchLfoTime":24.485,"offTime":111.6}},{"note":{"onTime":112.5,"pitch":72,"pitchLfoTime":16.565,"offTime":113.6}},{"note":{"onTime":112.5,"pitch":76,"pitchLfoTime":16.565,"offTime":113.6}},{"note":{"onTime":114.5,"pitch":72,"pitchLfoTime":8.646,"offTime":115.6}},{"note":{"onTime":114.5,"pitch":76,"pitchLfoTime":8.646,"offTime":115.6}},{"note":{"onTime":116.5,"pitch":72,"pitchLfoTime":0.726,"offTime":117.6}},{"note":{"onTime":116.5,"pitch":76,"pitchLfoTime":0.726,"offTime":117.6}},{"note":{"onTime":118.5,"pitch":72,"pitchLfoTime":7.193,"offTime":119.6}},{"note":{"onTime":118.5,"pitch":76,"pitchLfoTime":7.193,"offTime":119.6}},{"note":{"onTime":120.5,"pitch":72,"pitchLfoTime":15.112,"offTime":121.6}},{"note":{"onTime":120.5,"pitch":76,"pitchLfoTime":15.112,"offTime":121.6}},{"note":{"onTime":122.5,"pitch":72,"pitchLfoTime":23.032,"offTime":123.6}},{"note":{"onTime":122.5,"pitch":76,"pitchLfoTime":23.032,"offTime":123.6}},{"note":{"onTime":124.5,"pitch":72,"pitchLfoTime":30.951,"offTime":125.6}},{"note":{"onTime":124.5,"pitch":76,"pitchLfoTime":30.951,"offTime":125.6}},{"note":{"onTime":126.5,"pitch":72,"pitchLfoTime":27.129,"offTime":127.6}},{"note":{"onTime":126.5,"pitch":76,"pitchLfoTime":27.129,"offTime":127.6}},{"note":{"onTime":128.5,"pitch":72,"pitchLfoTime":19.21,"offTime":129.6}},{"note":{"onTime":128.5,"pitch":76,"pitchLfoTime":19.21,"offTime":129.6}},{"note":{"onTime":130.5,"pitch":72,"pitchLfoTime":11.29,"offTime":131.6}},{"note":{"onTime":130.5,"pitch":76,"pitchLfoTime":11.29,"offTime":131.6}},{"note":{"onTime":132.5,"pitch":72,"pitchLfoTime":3.371,"offTime":133.6}},{"note":{"onTime":132.5,"pitch":76,"pitchLfoTime":3.371,"offTime":133.6}},{"note":{"onTime":134.5,"pitch":72,"pitchLfoTime":4.548,"offTime":135.6}},{"note":{"onTime":134.5,"pitch":76,"pitchLfoTime":4.548,"offTime":135.6}},{"note":{"onTime":136.5,"pitch":72,"pitchLfoTime":12.468,"offTime":137.6}},{"note":{"onTime":136.5,"pitch":76,"pitchLfoTime":12.468,"offTime":137.6}},{"note":{"onTime":138.5,"pitch":72,"pitchLfoTime":20.387,"offTime":139.6}},{"note":{"onTime":138.5,"pitch":76,"pitchLfoTime":20.387,"offTime":139.6}},{"note":{"onTime":140.5,"pitch":72,"pitchLfoTime":28.307,"offTime":141.6}},{"note":{"onTime":140.5,"pitch":76,"pitchLfoTime":28.307,"offTime":141.6}},{"note":{"onTime":142.5,"pitch":72,"pitchLfoTime":29.774,"offTime":143.6}},{"note":{"onTime":142.5,"pitch":76,"pitchLfoTime":29.774,"offTime":143.6}},{"note":{"onTime":144.5,"pitch":72,"pitchLfoTime":21.854,"offTime":145.6}},{"note":{"onTime":144.5,"pitch":76,"pitchLfoTime":21.854,"offTime":145.6}},{"note":{"onTime":146.5,"pitch":72,"pitchLfoTime":13.935,"offTime":147.6}},{"note":{"onTime":146.5,"pitch":76,"pitchLfoTime":13.935,"offTime":147.6}},{"note":{"onTime":148.5,"pitch":72,"pitchLfoTime":6.016,"offTime":149.6}},{"note":{"onTime":148.5,"pitch":76,"pitchLfoTime":6.016,"offTime":149.6}},{"note":{"onTime":150.5,"pitch":72,"pitchLfoTime":1.904,"offTime":151.6}},{"note":{"onTime":150.5,"pitch":76,"pitchLfoTime":1.904,"offTime":151.6}},{"note":{"onTime":152.5,"pitch":72,"pitchLfoTime":9.823,"offTime":153.6}},{"note":{"onTime":152.5,"pitch":76,"pitchLfoTime":9.823,"offTime":153.6}},{"note":{"onTime":154.5,"pitch":72,"pitchLfoTime":17.743,"offTime":155.6}},{"note":{"onTime":154.5,"pitch":76,"pitchLfoTime":17.743,"offTime":155.6}},{"note":{"onTime":156.5,"pitch":72,"pitchLfoTime":25.662,"offTime":157.6}},{"note":{"onTime":156.5,"pitch":76,"pitchLfoTime":25.662,"offTime":157.6}},{"note":{"onTime":158.5,"pitch":72,"pitchLfoTime":32.418,"offTime":159.6}},{"note":{"onTime":158.5,"pitch":76,"pitchLfoTime":32.418,"offTime":159.6}},{"note":{"onTime":160.5,"pitch":72,"pitchLfoTime":24.499,"offTime":161.6}},{"note":{"onTime":160.5,"pitch":76,"pitchLfoTime":24.499,"offTime":161.6}},{"note":{"onTime":162.5,"pitch":72,"pitchLfoTime":16.58,"offTime":163.6}},{"note":{"onTime":162.5,"pitch":76,"pitchLfoTime":16.58,"offTime":163.6}},{"note":{"onTime":164.5,"pitch":72,"pitchLfoTime":8.66,"offTime":165.6}},{"note":{"onTime":164.5,"pitch":76,"pitchLfoTime":8.66,"offTime":165.6}},{"note":{"onTime":166.5,"pitch":72,"pitchLfoTime":0.741,"offTime":167.6}},{"note":{"onTime":166.5,"pitch":76,"pitchLfoTime":0.741,"offTime":167.6}},{"note":{"onTime":168.5,"pitch":72,"pitchLfoTime":7.179,"offTime":169.6}},{"note":{"onTime":168.5,"pitch":76,"pitchLfoTime":7.179,"offTime":169.6}},{"note":{"onTime":170.5,"pitch":72,"pitchLfoTime":15.098,"offTime":171.6}},{"note":{"onTime":170.5,"pitch":76,"pitchLfoTime":15.098,"offTime":171.6}},{"note":{"onTime":172.5,"pitch":72,"pitchLfoTime":23.017,"offTime":173.6}},{"note":{"onTime":172.5,"pitch":76,"pitchLfoTime":23.017,"offTime":173.6}},{"note":{"onTime":174.5,"pitch":72,"pitchLfoTime":30.937,"offTime":175.6}},{"note":{"onTime":174.5,"pitch":76,"pitchLfoTime":30.937,"offTime":175.6}},{"note":{"onTime":176.5,"pitch":72,"pitchLfoTime":27.144,"offTime":177.6}},{"note":{"onTime":176.5,"pitch":76,"pitchLfoTime":27.144,"offTime":177.6}},{"note":{"onTime":178.5,"pitch":72,"pitchLfoTime":19.224,"offTime":179.6}},{"note":{"onTime":178.5,"pitch":76,"pitchLfoTime":19.224,"offTime":179.6}},{"note":{"onTime":180.5,"pitch":72,"pitchLfoTime":11.305,"offTime":181.6}},{"note":{"onTime":180.5,"pitch":76,"pitchLfoTime":11.305,"offTime":181.6}},{"note":{"onTime":182.5,"pitch":72,"pitchLfoTime":3.385,"offTime":183.6}},{"note":{"onTime":182.5,"pitch":76,"pitchLfoTime":3.385,"offTime":183.6}},{"note":{"onTime":184.5,"pitch":72,"pitchLfoTime":4.534,"offTime":185.6}},{"note":{"onTime":184.5,"pitch":76,"pitchLfoTime":4.534,"offTime":185.6}},{"note":{"onTime":186.5,"pitch":72,"pitchLfoTime":12.453,"offTime":187.6}},{"note":{"onTime":186.5,"pitch":76,"pitchLfoTime":12.453,"offTime":187.6}},{"note":{"onTime":188.5,"pitch":72,"pitchLfoTime":20.373,"offTime":189.6}},{"note":{"onTime":188.5,"pitch":76,"pitchLfoTime":20.373,"offTime":189.6}},{"note":{"onTime":190.5,"pitch":72,"pitchLfoTime":28.292,"offTime":191.6}},{"note":{"onTime":190.5,"pitch":76,"pitchLfoTime":28.292,"offTime":191.6}},{"note":{"onTime":192.5,"pitch":72,"pitchLfoTime":29.788,"offTime":193.6}},{"note":{"onTime":192.5,"pitch":76,"pitchLfoTime":29.788,"offTime":193.6}},{"note":{"onTime":194.5,"pitch":72,"pitchLfoTime":21.869,"offTime":195.6}},{"note":{"onTime":194.5,"pitch":76,"pitchLfoTime":21.869,"offTime":195.6}},{"note":{"onTime":196.5,"pitch":72,"pitchLfoTime":13.949,"offTime":197.6}},{"note":{"onTime":196.5,"pitch":76,"pitchLfoTime":13.949,"offTime":197.6}},{"note":{"onTime":198.5,"pitch":72,"pitchLfoTime":6.03,"offTime":199.6}},{"note":{"onTime":198.5,"pitch":76,"pitchLfoTime":6.03,"offTime":199.6}},{"note":{"onTime":200.5,"pitch":72,"pitchLfoTime":1.889,"offTime":201.6}},{"note":{"onTime":200.5,"pitch":76,"pitchLfoTime":1.889,"offTime":201.6}}],"ab018f191c70470f98ac3becb76e6d13":[{"instanceName":"-"},{"note":{"onTime":17.5,"k":[{"time":0,"pitch":38,"volume":0.167,"x":0,"y":0,"z":0},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.758,"pitch":37.53},{"time":2.767,"pitch":37.171},{"time":2.775,"pitch":36.896},{"time":2.783,"pitch":36.685},{"time":2.792,"pitch":36.524},{"time":2.8,"pitch":36.401},{"time":2.808,"pitch":36.307},{"time":2.817,"pitch":36.235},{"time":2.825,"pitch":36.18},{"time":2.833,"pitch":36.137},{"time":2.842,"pitch":36.105},{"time":2.85,"pitch":36.08},{"time":2.858,"pitch":36.062},{"time":2.867,"pitch":36.047},{"time":2.875,"pitch":36.036},{"time":2.883,"pitch":36.028},{"time":2.892,"pitch":36.021},{"time":2.9,"pitch":36.016},{"time":2.908,"pitch":36.012},{"time":2.917,"pitch":36.009},{"time":2.925,"pitch":36.007},{"time":2.933,"pitch":36.006},{"time":2.942,"pitch":36.004},{"time":2.95,"pitch":36.003},{"time":2.958,"pitch":36.002},{"time":2.975,"pitch":36.001},{"time":3.008,"pitch":36},{"time":3.258,"pitch":35.295},{"time":3.267,"pitch":34.756},{"time":3.275,"pitch":34.344},{"time":3.283,"pitch":34.028},{"time":3.292,"pitch":33.787},{"time":3.3,"pitch":33.602},{"time":3.308,"pitch":33.46},{"time":3.317,"pitch":33.352},{"time":3.325,"pitch":33.27},{"time":3.333,"pitch":33.206},{"time":3.342,"pitch":33.158},{"time":3.35,"pitch":33.121},{"time":3.358,"pitch":33.092},{"time":3.367,"pitch":33.071},{"time":3.375,"pitch":33.054},{"time":3.383,"pitch":33.041},{"time":3.392,"pitch":33.032},{"time":3.4,"pitch":33.024},{"time":3.408,"pitch":33.019},{"time":3.417,"pitch":33.014},{"time":3.425,"pitch":33.011},{"time":3.433,"pitch":33.008},{"time":3.442,"pitch":33.006},{"time":3.45,"pitch":33.005},{"time":3.458,"pitch":33.004},{"time":3.467,"pitch":33.003},{"time":3.475,"pitch":33.002},{"time":3.492,"pitch":33.001},{"time":3.508,"pitch":33.705},{"time":3.517,"pitch":34.244},{"time":3.525,"pitch":34.657},{"time":3.533,"pitch":34.972},{"time":3.542,"pitch":35.214},{"time":3.55,"pitch":35.398},{"time":3.558,"pitch":35.54},{"time":3.567,"pitch":35.648},{"time":3.575,"pitch":35.731},{"time":3.583,"pitch":35.794},{"time":3.592,"pitch":35.842},{"time":3.6,"pitch":35.879},{"time":3.608,"pitch":35.908},{"time":3.617,"pitch":35.929},{"time":3.625,"pitch":35.946},{"time":3.633,"pitch":35.959},{"time":3.642,"pitch":35.968},{"time":3.65,"pitch":35.976},{"time":3.658,"pitch":35.981},{"time":3.667,"pitch":35.986},{"time":3.675,"pitch":35.989},{"time":3.683,"pitch":35.992},{"time":3.692,"pitch":35.994},{"time":3.7,"pitch":35.995},{"time":3.708,"pitch":35.996},{"time":3.717,"pitch":35.997},{"time":3.725,"pitch":35.998},{"time":3.742,"pitch":35.999},{"time":3.775,"pitch":36},{"time":4,"pitch":36.47},{"time":4.008,"pitch":36.829},{"time":4.017,"pitch":37.104},{"time":4.025,"pitch":37.315},{"time":4.033,"pitch":37.476},{"time":4.042,"pitch":37.599},{"time":4.05,"pitch":37.693},{"time":4.058,"pitch":37.765},{"time":4.067,"pitch":37.82},{"time":4.075,"pitch":37.863},{"time":4.083,"pitch":37.895},{"time":4.092,"pitch":37.92},{"time":4.1,"pitch":37.938},{"time":4.108,"pitch":37.953},{"time":4.117,"pitch":37.964},{"time":4.125,"pitch":37.972},{"time":4.133,"pitch":37.979},{"time":4.142,"pitch":37.984},{"time":4.15,"pitch":37.988},{"time":4.158,"pitch":37.991},{"time":4.167,"pitch":37.993},{"time":4.175,"pitch":37.994},{"time":4.183,"pitch":37.996},{"time":4.192,"pitch":37.997},{"time":4.2,"pitch":37.998},{"time":4.217,"pitch":37.999},{"time":4.25,"pitch":38},{"time":4.733,"pitch":38.705},{"time":4.742,"pitch":39.244},{"time":4.75,"pitch":39.656},{"time":4.758,"pitch":39.972},{"time":4.767,"pitch":40.213},{"time":4.775,"pitch":40.398},{"time":4.783,"pitch":40.54},{"time":4.792,"pitch":40.648},{"time":4.8,"pitch":40.73},{"time":4.808,"pitch":40.794},{"time":4.817,"pitch":40.842},{"time":4.825,"pitch":40.879},{"time":4.833,"pitch":40.908},{"time":4.842,"pitch":40.929},{"time":4.85,"pitch":40.946},{"time":4.858,"pitch":40.959},{"time":4.867,"pitch":40.968},{"time":4.875,"pitch":40.976},{"time":4.883,"pitch":40.981},{"time":4.892,"pitch":40.986},{"time":4.9,"pitch":40.989},{"time":4.908,"pitch":40.992},{"time":4.917,"pitch":40.994},{"time":4.925,"pitch":40.995},{"time":4.933,"pitch":40.996},{"time":4.942,"pitch":40.997},{"time":4.95,"pitch":40.998},{"time":4.967,"pitch":40.999},{"time":5,"pitch":41},{"time":5.258,"pitch":40.295},{"time":5.267,"pitch":39.756},{"time":5.275,"pitch":39.344},{"time":5.283,"pitch":39.028},{"time":5.292,"pitch":38.787},{"time":5.3,"pitch":38.602},{"time":5.308,"pitch":38.46},{"time":5.317,"pitch":38.352},{"time":5.325,"pitch":38.27},{"time":5.333,"pitch":38.206},{"time":5.342,"pitch":38.158},{"time":5.35,"pitch":38.121},{"time":5.358,"pitch":38.092},{"time":5.367,"pitch":38.071},{"time":5.375,"pitch":38.054},{"time":5.383,"pitch":38.041},{"time":5.392,"pitch":38.032},{"time":5.4,"pitch":38.024},{"time":5.408,"pitch":38.019},{"time":5.417,"pitch":38.014},{"time":5.425,"pitch":38.011},{"time":5.433,"pitch":38.008},{"time":5.442,"pitch":38.006},{"time":5.45,"pitch":38.005},{"time":5.458,"pitch":38.004},{"time":5.467,"pitch":38.003},{"time":5.475,"pitch":38.002},{"time":5.492,"pitch":38.001},{"time":5.5,"pitch":38.706},{"time":5.508,"pitch":39.245},{"time":5.517,"pitch":39.657},{"time":5.525,"pitch":39.972},{"time":5.533,"pitch":40.214},{"time":5.542,"pitch":40.398},{"time":5.55,"pitch":40.54},{"time":5.558,"pitch":40.648},{"time":5.567,"pitch":40.731},{"time":5.575,"pitch":40.794},{"time":5.583,"pitch":40.842},{"time":5.592,"pitch":40.879},{"time":5.6,"pitch":40.908},{"time":5.608,"pitch":40.929},{"time":5.617,"pitch":40.946},{"time":5.625,"pitch":40.959},{"time":5.633,"pitch":40.968},{"time":5.642,"pitch":40.976},{"time":5.65,"pitch":40.981},{"time":5.658,"pitch":40.986},{"time":5.667,"pitch":40.989},{"time":5.675,"pitch":40.992},{"time":5.683,"pitch":40.994},{"time":5.692,"pitch":40.995},{"time":5.7,"pitch":40.996},{"time":5.708,"pitch":40.997},{"time":5.717,"pitch":40.998},{"time":5.733,"pitch":40.999},{"time":5.767,"pitch":41},{"time":6.008,"pitch":40.295},{"time":6.017,"pitch":39.756},{"time":6.025,"pitch":39.344},{"time":6.033,"pitch":39.028},{"time":6.042,"pitch":38.787},{"time":6.05,"pitch":38.602},{"time":6.058,"pitch":38.46},{"time":6.067,"pitch":38.352},{"time":6.075,"pitch":38.27},{"time":6.083,"pitch":38.206},{"time":6.092,"pitch":38.158},{"time":6.1,"pitch":38.121},{"time":6.108,"pitch":38.092},{"time":6.117,"pitch":38.071},{"time":6.125,"pitch":38.054},{"time":6.133,"pitch":38.041},{"time":6.142,"pitch":38.032},{"time":6.15,"pitch":38.024},{"time":6.158,"pitch":38.019},{"time":6.167,"pitch":38.014},{"time":6.175,"pitch":38.011},{"time":6.183,"pitch":38.008},{"time":6.192,"pitch":38.006},{"time":6.2,"pitch":38.005},{"time":6.208,"pitch":38.004},{"time":6.217,"pitch":38.003},{"time":6.225,"pitch":38.002},{"time":6.242,"pitch":38.001},{"time":6.275,"pitch":38},{"time":6.758,"pitch":37.53},{"time":6.767,"pitch":37.171},{"time":6.775,"pitch":36.896},{"time":6.783,"pitch":36.685},{"time":6.792,"pitch":36.524},{"time":6.8,"pitch":36.401},{"time":6.808,"pitch":36.307},{"time":6.817,"pitch":36.235},{"time":6.825,"pitch":36.18},{"time":6.833,"pitch":36.137},{"time":6.842,"pitch":36.105},{"time":6.85,"pitch":36.08},{"time":6.858,"pitch":36.062},{"time":6.867,"pitch":36.047},{"time":6.875,"pitch":36.036},{"time":6.883,"pitch":36.028},{"time":6.892,"pitch":36.021},{"time":6.9,"pitch":36.016},{"time":6.908,"pitch":36.012},{"time":6.917,"pitch":36.009},{"time":6.925,"pitch":36.007},{"time":6.933,"pitch":36.006},{"time":6.942,"pitch":36.004},{"time":6.95,"pitch":36.003},{"time":6.958,"pitch":36.002},{"time":6.975,"pitch":36.001},{"time":7.008,"pitch":36},{"time":7.258,"pitch":35.295},{"time":7.267,"pitch":34.756},{"time":7.275,"pitch":34.344},{"time":7.283,"pitch":34.028},{"time":7.292,"pitch":33.787},{"time":7.3,"pitch":33.602},{"time":7.308,"pitch":33.46},{"time":7.317,"pitch":33.352},{"time":7.325,"pitch":33.27},{"time":7.333,"pitch":33.206},{"time":7.342,"pitch":33.158},{"time":7.35,"pitch":33.121},{"time":7.358,"pitch":33.092},{"time":7.367,"pitch":33.071},{"time":7.375,"pitch":33.054},{"time":7.383,"pitch":33.041},{"time":7.392,"pitch":33.032},{"time":7.4,"pitch":33.024},{"time":7.408,"pitch":33.019},{"time":7.417,"pitch":33.014},{"time":7.425,"pitch":33.011},{"time":7.433,"pitch":33.008},{"time":7.442,"pitch":33.006},{"time":7.45,"pitch":33.005},{"time":7.458,"pitch":33.004},{"time":7.467,"pitch":33.003},{"time":7.475,"pitch":33.002},{"time":7.492,"pitch":33.001},{"time":7.508,"pitch":33.705},{"time":7.517,"pitch":34.244},{"time":7.525,"pitch":34.657},{"time":7.533,"pitch":34.972},{"time":7.542,"pitch":35.214},{"time":7.55,"pitch":35.398},{"time":7.558,"pitch":35.54},{"time":7.567,"pitch":35.648},{"time":7.575,"pitch":35.731},{"time":7.583,"pitch":35.794},{"time":7.592,"pitch":35.842},{"time":7.6,"pitch":35.879},{"time":7.608,"pitch":35.908},{"time":7.617,"pitch":35.929},{"time":7.625,"pitch":35.946},{"time":7.633,"pitch":35.959},{"time":7.642,"pitch":35.968},{"time":7.65,"pitch":35.976},{"time":7.658,"pitch":35.981},{"time":7.667,"pitch":35.986},{"time":7.675,"pitch":35.989},{"time":7.683,"pitch":35.992},{"time":7.692,"pitch":35.994},{"time":7.7,"pitch":35.995},{"time":7.708,"pitch":35.996},{"time":7.717,"pitch":35.997},{"time":7.725,"pitch":35.998},{"time":7.742,"pitch":35.999},{"time":7.775,"pitch":36},{"time":8,"pitch":36.47},{"time":8.008,"pitch":36.829},{"time":8.017,"pitch":37.104},{"time":8.025,"pitch":37.315},{"time":8.033,"pitch":37.476},{"time":8.042,"pitch":37.599},{"time":8.05,"pitch":37.693},{"time":8.058,"pitch":37.765},{"time":8.067,"pitch":37.82},{"time":8.075,"pitch":37.863},{"time":8.083,"pitch":37.895},{"time":8.092,"pitch":37.92},{"time":8.1,"pitch":37.938},{"time":8.108,"pitch":37.953},{"time":8.117,"pitch":37.964},{"time":8.125,"pitch":37.972},{"time":8.133,"pitch":37.979},{"time":8.142,"pitch":37.984},{"time":8.15,"pitch":37.988},{"time":8.158,"pitch":37.991},{"time":8.167,"pitch":37.993},{"time":8.175,"pitch":37.994},{"time":8.183,"pitch":37.996},{"time":8.192,"pitch":37.997},{"time":8.2,"pitch":37.998},{"time":8.217,"pitch":37.999},{"time":8.25,"pitch":38},{"time":8.733,"pitch":38.705},{"time":8.742,"pitch":39.244},{"time":8.75,"pitch":39.656},{"time":8.758,"pitch":39.972},{"time":8.767,"pitch":40.213},{"time":8.775,"pitch":40.398},{"time":8.783,"pitch":40.54},{"time":8.792,"pitch":40.648},{"time":8.8,"pitch":40.73},{"time":8.808,"pitch":40.794},{"time":8.817,"pitch":40.842},{"time":8.825,"pitch":40.879},{"time":8.833,"pitch":40.908},{"time":8.842,"pitch":40.929},{"time":8.85,"pitch":40.946},{"time":8.858,"pitch":40.959},{"time":8.867,"pitch":40.968},{"time":8.875,"pitch":40.976},{"time":8.883,"pitch":40.981},{"time":8.892,"pitch":40.986},{"time":8.9,"pitch":40.989},{"time":8.908,"pitch":40.992},{"time":8.917,"pitch":40.994},{"time":8.925,"pitch":40.995},{"time":8.933,"pitch":40.996},{"time":8.942,"pitch":40.997},{"time":8.95,"pitch":40.998},{"time":8.967,"pitch":40.999},{"time":9,"pitch":41},{"time":9.258,"pitch":40.295},{"time":9.267,"pitch":39.756},{"time":9.275,"pitch":39.344},{"time":9.283,"pitch":39.028},{"time":9.292,"pitch":38.787},{"time":9.3,"pitch":38.602},{"time":9.308,"pitch":38.46},{"time":9.317,"pitch":38.352},{"time":9.325,"pitch":38.27},{"time":9.333,"pitch":38.206},{"time":9.342,"pitch":38.158},{"time":9.35,"pitch":38.121},{"time":9.358,"pitch":38.092},{"time":9.367,"pitch":38.071},{"time":9.375,"pitch":38.054},{"time":9.383,"pitch":38.041},{"time":9.392,"pitch":38.032},{"time":9.4,"pitch":38.024},{"time":9.408,"pitch":38.019},{"time":9.417,"pitch":38.014},{"time":9.425,"pitch":38.011},{"time":9.433,"pitch":38.008},{"time":9.442,"pitch":38.006},{"time":9.45,"pitch":38.005},{"time":9.458,"pitch":38.004},{"time":9.467,"pitch":38.003},{"time":9.475,"pitch":38.002},{"time":9.492,"pitch":38.001},{"time":9.5,"pitch":38.706},{"time":9.508,"pitch":39.245},{"time":9.517,"pitch":39.657},{"time":9.525,"pitch":39.972},{"time":9.533,"pitch":40.214},{"time":9.542,"pitch":40.398},{"time":9.55,"pitch":40.54},{"time":9.558,"pitch":40.648},{"time":9.567,"pitch":40.731},{"time":9.575,"pitch":40.794},{"time":9.583,"pitch":40.842},{"time":9.592,"pitch":40.879},{"time":9.6,"pitch":40.908},{"time":9.608,"pitch":40.929},{"time":9.617,"pitch":40.946},{"time":9.625,"pitch":40.959},{"time":9.633,"pitch":40.968},{"time":9.642,"pitch":40.976},{"time":9.65,"pitch":40.981},{"time":9.658,"pitch":40.986},{"time":9.667,"pitch":40.989},{"time":9.675,"pitch":40.992},{"time":9.683,"pitch":40.994},{"time":9.692,"pitch":40.995},{"time":9.7,"pitch":40.996},{"time":9.708,"pitch":40.997},{"time":9.717,"pitch":40.998},{"time":9.733,"pitch":40.999},{"time":9.767,"pitch":41},{"time":10.008,"pitch":40.295},{"time":10.017,"pitch":39.756},{"time":10.025,"pitch":39.344},{"time":10.033,"pitch":39.028},{"time":10.042,"pitch":38.787},{"time":10.05,"pitch":38.602},{"time":10.058,"pitch":38.46},{"time":10.067,"pitch":38.352},{"time":10.075,"pitch":38.27},{"time":10.083,"pitch":38.206},{"time":10.092,"pitch":38.158},{"time":10.1,"pitch":38.121},{"time":10.108,"pitch":38.092},{"time":10.117,"pitch":38.071},{"time":10.125,"pitch":38.054},{"time":10.133,"pitch":38.041},{"time":10.142,"pitch":38.032},{"time":10.15,"pitch":38.024},{"time":10.158,"pitch":38.019},{"time":10.167,"pitch":38.014},{"time":10.175,"pitch":38.011},{"time":10.183,"pitch":38.008},{"time":10.192,"pitch":38.006},{"time":10.2,"pitch":38.005},{"time":10.208,"pitch":38.004},{"time":10.217,"pitch":38.003},{"time":10.225,"pitch":38.002},{"time":10.242,"pitch":38.001},{"time":10.275,"pitch":38},{"time":10.758,"pitch":37.53},{"time":10.767,"pitch":37.171},{"time":10.775,"pitch":36.896},{"time":10.783,"pitch":36.685},{"time":10.792,"pitch":36.524},{"time":10.8,"pitch":36.401},{"time":10.808,"pitch":36.307},{"time":10.817,"pitch":36.235},{"time":10.825,"pitch":36.18},{"time":10.833,"pitch":36.137},{"time":10.842,"pitch":36.105},{"time":10.85,"pitch":36.08},{"time":10.858,"pitch":36.062},{"time":10.867,"pitch":36.047},{"time":10.875,"pitch":36.036},{"time":10.883,"pitch":36.028},{"time":10.892,"pitch":36.021},{"time":10.9,"pitch":36.016},{"time":10.908,"pitch":36.012},{"time":10.917,"pitch":36.009},{"time":10.925,"pitch":36.007},{"time":10.933,"pitch":36.006},{"time":10.942,"pitch":36.004},{"time":10.95,"pitch":36.003},{"time":10.958,"pitch":36.002},{"time":10.975,"pitch":36.001},{"time":11.008,"pitch":36},{"time":11.258,"pitch":35.295},{"time":11.267,"pitch":34.756},{"time":11.275,"pitch":34.344},{"time":11.283,"pitch":34.028},{"time":11.292,"pitch":33.787},{"time":11.3,"pitch":33.602},{"time":11.308,"pitch":33.46},{"time":11.317,"pitch":33.352},{"time":11.325,"pitch":33.27},{"time":11.333,"pitch":33.206},{"time":11.342,"pitch":33.158},{"time":11.35,"pitch":33.121},{"time":11.358,"pitch":33.092},{"time":11.367,"pitch":33.071},{"time":11.375,"pitch":33.054},{"time":11.383,"pitch":33.041},{"time":11.392,"pitch":33.032},{"time":11.4,"pitch":33.024},{"time":11.408,"pitch":33.019},{"time":11.417,"pitch":33.014},{"time":11.425,"pitch":33.011},{"time":11.433,"pitch":33.008},{"time":11.442,"pitch":33.006},{"time":11.45,"pitch":33.005},{"time":11.458,"pitch":33.004},{"time":11.467,"pitch":33.003},{"time":11.475,"pitch":33.002},{"time":11.492,"pitch":33.001},{"time":11.508,"pitch":33.705},{"time":11.517,"pitch":34.244},{"time":11.525,"pitch":34.657},{"time":11.533,"pitch":34.972},{"time":11.542,"pitch":35.214},{"time":11.55,"pitch":35.398},{"time":11.558,"pitch":35.54},{"time":11.567,"pitch":35.648},{"time":11.575,"pitch":35.731},{"time":11.583,"pitch":35.794},{"time":11.592,"pitch":35.842},{"time":11.6,"pitch":35.879},{"time":11.608,"pitch":35.908},{"time":11.617,"pitch":35.929},{"time":11.625,"pitch":35.946},{"time":11.633,"pitch":35.959},{"time":11.642,"pitch":35.968},{"time":11.65,"pitch":35.976},{"time":11.658,"pitch":35.981},{"time":11.667,"pitch":35.986},{"time":11.675,"pitch":35.989},{"time":11.683,"pitch":35.992},{"time":11.692,"pitch":35.994},{"time":11.7,"pitch":35.995},{"time":11.708,"pitch":35.996},{"time":11.717,"pitch":35.997},{"time":11.725,"pitch":35.998},{"time":11.742,"pitch":35.999},{"time":11.775,"pitch":36},{"time":12,"pitch":36.47},{"time":12.008,"pitch":36.829},{"time":12.017,"pitch":37.104},{"time":12.025,"pitch":37.315},{"time":12.033,"pitch":37.476},{"time":12.042,"pitch":37.599},{"time":12.05,"pitch":37.693},{"time":12.058,"pitch":37.765},{"time":12.067,"pitch":37.82},{"time":12.075,"pitch":37.863},{"time":12.083,"pitch":37.895},{"time":12.092,"pitch":37.92},{"time":12.1,"pitch":37.938},{"time":12.108,"pitch":37.953},{"time":12.117,"pitch":37.964},{"time":12.125,"pitch":37.972},{"time":12.133,"pitch":37.979},{"time":12.142,"pitch":37.984},{"time":12.15,"pitch":37.988},{"time":12.158,"pitch":37.991},{"time":12.167,"pitch":37.993},{"time":12.175,"pitch":37.994},{"time":12.183,"pitch":37.996},{"time":12.192,"pitch":37.997},{"time":12.2,"pitch":37.998},{"time":12.217,"pitch":37.999},{"time":12.25,"pitch":38},{"time":12.733,"pitch":38.705},{"time":12.742,"pitch":39.244},{"time":12.75,"pitch":39.656},{"time":12.758,"pitch":39.972},{"time":12.767,"pitch":40.213},{"time":12.775,"pitch":40.398},{"time":12.783,"pitch":40.54},{"time":12.792,"pitch":40.648},{"time":12.8,"pitch":40.73},{"time":12.808,"pitch":40.794},{"time":12.817,"pitch":40.842},{"time":12.825,"pitch":40.879},{"time":12.833,"pitch":40.908},{"time":12.842,"pitch":40.929},{"time":12.85,"pitch":40.946},{"time":12.858,"pitch":40.959},{"time":12.867,"pitch":40.968},{"time":12.875,"pitch":40.976},{"time":12.883,"pitch":40.981},{"time":12.892,"pitch":40.986},{"time":12.9,"pitch":40.989},{"time":12.908,"pitch":40.992},{"time":12.917,"pitch":40.994},{"time":12.925,"pitch":40.995},{"time":12.933,"pitch":40.996},{"time":12.942,"pitch":40.997},{"time":12.95,"pitch":40.998},{"time":12.967,"pitch":40.999},{"time":13,"pitch":41},{"time":13.258,"pitch":40.295},{"time":13.267,"pitch":39.756},{"time":13.275,"pitch":39.344},{"time":13.283,"pitch":39.028},{"time":13.292,"pitch":38.787},{"time":13.3,"pitch":38.602},{"time":13.308,"pitch":38.46},{"time":13.317,"pitch":38.352},{"time":13.325,"pitch":38.27},{"time":13.333,"pitch":38.206},{"time":13.342,"pitch":38.158},{"time":13.35,"pitch":38.121},{"time":13.358,"pitch":38.092},{"time":13.367,"pitch":38.071},{"time":13.375,"pitch":38.054},{"time":13.383,"pitch":38.041},{"time":13.392,"pitch":38.032},{"time":13.4,"pitch":38.024},{"time":13.408,"pitch":38.019},{"time":13.417,"pitch":38.014},{"time":13.425,"pitch":38.011},{"time":13.433,"pitch":38.008},{"time":13.442,"pitch":38.006},{"time":13.45,"pitch":38.005},{"time":13.458,"pitch":38.004},{"time":13.467,"pitch":38.003},{"time":13.475,"pitch":38.002},{"time":13.492,"pitch":38.001},{"time":13.5,"pitch":38.706},{"time":13.508,"pitch":39.245},{"time":13.517,"pitch":39.657},{"time":13.525,"pitch":39.972},{"time":13.533,"pitch":40.214},{"time":13.542,"pitch":40.398},{"time":13.55,"pitch":40.54},{"time":13.558,"pitch":40.648},{"time":13.567,"pitch":40.731},{"time":13.575,"pitch":40.794},{"time":13.583,"pitch":40.842},{"time":13.592,"pitch":40.879},{"time":13.6,"pitch":40.908},{"time":13.608,"pitch":40.929},{"time":13.617,"pitch":40.946},{"time":13.625,"pitch":40.959},{"time":13.633,"pitch":40.968},{"time":13.642,"pitch":40.976},{"time":13.65,"pitch":40.981},{"time":13.658,"pitch":40.986},{"time":13.667,"pitch":40.989},{"time":13.675,"pitch":40.992},{"time":13.683,"pitch":40.994},{"time":13.692,"pitch":40.995},{"time":13.7,"pitch":40.996},{"time":13.708,"pitch":40.997},{"time":13.717,"pitch":40.998},{"time":13.733,"pitch":40.999},{"time":13.767,"pitch":41},{"time":14.008,"pitch":40.295},{"time":14.017,"pitch":39.756},{"time":14.025,"pitch":39.344},{"time":14.033,"pitch":39.028},{"time":14.042,"pitch":38.787},{"time":14.05,"pitch":38.602},{"time":14.058,"pitch":38.46},{"time":14.067,"pitch":38.352},{"time":14.075,"pitch":38.27},{"time":14.083,"pitch":38.206},{"time":14.092,"pitch":38.158},{"time":14.1,"pitch":38.121},{"time":14.108,"pitch":38.092},{"time":14.117,"pitch":38.071},{"time":14.125,"pitch":38.054},{"time":14.133,"pitch":38.041},{"time":14.142,"pitch":38.032},{"time":14.15,"pitch":38.024},{"time":14.158,"pitch":38.019},{"time":14.167,"pitch":38.014},{"time":14.175,"pitch":38.011},{"time":14.183,"pitch":38.008},{"time":14.192,"pitch":38.006},{"time":14.2,"pitch":38.005},{"time":14.208,"pitch":38.004},{"time":14.217,"pitch":38.003},{"time":14.225,"pitch":38.002},{"time":14.242,"pitch":38.001},{"time":14.275,"pitch":38},{"time":14.758,"pitch":37.53},{"time":14.767,"pitch":37.171},{"time":14.775,"pitch":36.896},{"time":14.783,"pitch":36.685},{"time":14.792,"pitch":36.524},{"time":14.8,"pitch":36.401},{"time":14.808,"pitch":36.307},{"time":14.817,"pitch":36.235},{"time":14.825,"pitch":36.18},{"time":14.833,"pitch":36.137},{"time":14.842,"pitch":36.105},{"time":14.85,"pitch":36.08},{"time":14.858,"pitch":36.062},{"time":14.867,"pitch":36.047},{"time":14.875,"pitch":36.036},{"time":14.883,"pitch":36.028},{"time":14.892,"pitch":36.021},{"time":14.9,"pitch":36.016},{"time":14.908,"pitch":36.012},{"time":14.917,"pitch":36.009},{"time":14.925,"pitch":36.007},{"time":14.933,"pitch":36.006},{"time":14.942,"pitch":36.004},{"time":14.95,"pitch":36.003},{"time":14.958,"pitch":36.002},{"time":14.975,"pitch":36.001},{"time":15.008,"pitch":36},{"time":15.258,"pitch":35.295},{"time":15.267,"pitch":34.756},{"time":15.275,"pitch":34.344},{"time":15.283,"pitch":34.028},{"time":15.292,"pitch":33.787},{"time":15.3,"pitch":33.602},{"time":15.308,"pitch":33.46},{"time":15.317,"pitch":33.352},{"time":15.325,"pitch":33.27},{"time":15.333,"pitch":33.206},{"time":15.342,"pitch":33.158},{"time":15.35,"pitch":33.121},{"time":15.358,"pitch":33.092},{"time":15.367,"pitch":33.071},{"time":15.375,"pitch":33.054},{"time":15.383,"pitch":33.041},{"time":15.392,"pitch":33.032},{"time":15.4,"pitch":33.024},{"time":15.408,"pitch":33.019},{"time":15.417,"pitch":33.014},{"time":15.425,"pitch":33.011},{"time":15.433,"pitch":33.008},{"time":15.442,"pitch":33.006},{"time":15.45,"pitch":33.005},{"time":15.458,"pitch":33.004},{"time":15.467,"pitch":33.003},{"time":15.475,"pitch":33.002},{"time":15.492,"pitch":33.001},{"time":15.508,"pitch":33.705},{"time":15.517,"pitch":34.244},{"time":15.525,"pitch":34.657},{"time":15.533,"pitch":34.972},{"time":15.542,"pitch":35.214},{"time":15.55,"pitch":35.398},{"time":15.558,"pitch":35.54},{"time":15.567,"pitch":35.648},{"time":15.575,"pitch":35.731},{"time":15.583,"pitch":35.794},{"time":15.592,"pitch":35.842},{"time":15.6,"pitch":35.879},{"time":15.608,"pitch":35.908},{"time":15.617,"pitch":35.929},{"time":15.625,"pitch":35.946},{"time":15.633,"pitch":35.959},{"time":15.642,"pitch":35.968},{"time":15.65,"pitch":35.976},{"time":15.658,"pitch":35.981},{"time":15.667,"pitch":35.986},{"time":15.675,"pitch":35.989},{"time":15.683,"pitch":35.992},{"time":15.692,"pitch":35.994},{"time":15.7,"pitch":35.995},{"time":15.708,"pitch":35.996},{"time":15.717,"pitch":35.997},{"time":15.725,"pitch":35.998},{"time":15.742,"pitch":35.999},{"time":15.775,"pitch":36},{"time":16,"pitch":36.47},{"time":16.008,"pitch":36.829},{"time":16.017,"pitch":37.104},{"time":16.025,"pitch":37.315},{"time":16.033,"pitch":37.476},{"time":16.042,"pitch":37.599},{"time":16.05,"pitch":37.693},{"time":16.058,"pitch":37.765},{"time":16.067,"pitch":37.82},{"time":16.075,"pitch":37.863},{"time":16.083,"pitch":37.895},{"time":16.092,"pitch":37.92},{"time":16.1,"pitch":37.938},{"time":16.108,"pitch":37.953},{"time":16.117,"pitch":37.964},{"time":16.125,"pitch":37.972},{"time":16.133,"pitch":37.979},{"time":16.142,"pitch":37.984},{"time":16.15,"pitch":37.988},{"time":16.158,"pitch":37.991},{"time":16.167,"pitch":37.993},{"time":16.175,"pitch":37.994},{"time":16.183,"pitch":37.996},{"time":16.192,"pitch":37.997},{"time":16.2,"pitch":37.998},{"time":16.217,"pitch":37.999},{"time":16.25,"pitch":38},{"time":16.733,"pitch":38.705},{"time":16.742,"pitch":39.244},{"time":16.75,"pitch":39.656},{"time":16.758,"pitch":39.972},{"time":16.767,"pitch":40.213},{"time":16.775,"pitch":40.398},{"time":16.783,"pitch":40.54},{"time":16.792,"pitch":40.648},{"time":16.8,"pitch":40.73},{"time":16.808,"pitch":40.794},{"time":16.817,"pitch":40.842},{"time":16.825,"pitch":40.879},{"time":16.833,"pitch":40.908},{"time":16.842,"pitch":40.929},{"time":16.85,"pitch":40.946},{"time":16.858,"pitch":40.959},{"time":16.867,"pitch":40.968},{"time":16.875,"pitch":40.976},{"time":16.883,"pitch":40.981},{"time":16.892,"pitch":40.986},{"time":16.9,"pitch":40.989},{"time":16.908,"pitch":40.992},{"time":16.917,"pitch":40.994},{"time":16.925,"pitch":40.995},{"time":16.933,"pitch":40.996},{"time":16.942,"pitch":40.997},{"time":16.95,"pitch":40.998},{"time":16.967,"pitch":40.999},{"time":17,"pitch":41},{"time":17.258,"pitch":40.295},{"time":17.267,"pitch":39.756},{"time":17.275,"pitch":39.344},{"time":17.283,"pitch":39.028},{"time":17.292,"pitch":38.787},{"time":17.3,"pitch":38.602},{"time":17.308,"pitch":38.46},{"time":17.317,"pitch":38.352},{"time":17.325,"pitch":38.27},{"time":17.333,"pitch":38.206},{"time":17.342,"pitch":38.158},{"time":17.35,"pitch":38.121},{"time":17.358,"pitch":38.092},{"time":17.367,"pitch":38.071},{"time":17.375,"pitch":38.054},{"time":17.383,"pitch":38.041},{"time":17.392,"pitch":38.032},{"time":17.4,"pitch":38.024},{"time":17.408,"pitch":38.019},{"time":17.417,"pitch":38.014},{"time":17.425,"pitch":38.011},{"time":17.433,"pitch":38.008},{"time":17.442,"pitch":38.006},{"time":17.45,"pitch":38.005},{"time":17.458,"pitch":38.004},{"time":17.467,"pitch":38.003},{"time":17.475,"pitch":38.002},{"time":17.492,"pitch":38.001},{"time":17.5,"pitch":38.706},{"time":17.508,"pitch":39.245},{"time":17.517,"pitch":39.657},{"time":17.525,"pitch":39.972},{"time":17.533,"pitch":40.214},{"time":17.542,"pitch":40.398},{"time":17.55,"pitch":40.54},{"time":17.558,"pitch":40.648},{"time":17.567,"pitch":40.731},{"time":17.575,"pitch":40.794},{"time":17.583,"pitch":40.842},{"time":17.592,"pitch":40.879},{"time":17.6,"pitch":40.908},{"time":17.608,"pitch":40.929},{"time":17.617,"pitch":40.946},{"time":17.625,"pitch":40.959},{"time":17.633,"pitch":40.968},{"time":17.642,"pitch":40.976},{"time":17.65,"pitch":40.981},{"time":17.658,"pitch":40.986},{"time":17.667,"pitch":40.989},{"time":17.675,"pitch":40.992},{"time":17.683,"pitch":40.994},{"time":17.692,"pitch":40.995},{"time":17.7,"pitch":40.996},{"time":17.708,"pitch":40.997},{"time":17.717,"pitch":40.998},{"time":17.733,"pitch":40.999},{"time":17.767,"pitch":41},{"time":18.008,"pitch":40.295},{"time":18.017,"pitch":39.756},{"time":18.025,"pitch":39.344},{"time":18.033,"pitch":39.028},{"time":18.042,"pitch":38.787},{"time":18.05,"pitch":38.602},{"time":18.058,"pitch":38.46},{"time":18.067,"pitch":38.352},{"time":18.075,"pitch":38.27},{"time":18.083,"pitch":38.206},{"time":18.092,"pitch":38.158},{"time":18.1,"pitch":38.121},{"time":18.108,"pitch":38.092},{"time":18.117,"pitch":38.071},{"time":18.125,"pitch":38.054},{"time":18.133,"pitch":38.041},{"time":18.142,"pitch":38.032},{"time":18.15,"pitch":38.024},{"time":18.158,"pitch":38.019},{"time":18.167,"pitch":38.014},{"time":18.175,"pitch":38.011},{"time":18.183,"pitch":38.008},{"time":18.192,"pitch":38.006},{"time":18.2,"pitch":38.005},{"time":18.208,"pitch":38.004},{"time":18.217,"pitch":38.003},{"time":18.225,"pitch":38.002},{"time":18.242,"pitch":38.001},{"time":18.275,"pitch":38},{"time":18.758,"pitch":37.53},{"time":18.767,"pitch":37.171},{"time":18.775,"pitch":36.896},{"time":18.783,"pitch":36.685},{"time":18.792,"pitch":36.524},{"time":18.8,"pitch":36.401},{"time":18.808,"pitch":36.307},{"time":18.817,"pitch":36.235},{"time":18.825,"pitch":36.18},{"time":18.833,"pitch":36.137},{"time":18.842,"pitch":36.105},{"time":18.85,"pitch":36.08},{"time":18.858,"pitch":36.062},{"time":18.867,"pitch":36.047},{"time":18.875,"pitch":36.036},{"time":18.883,"pitch":36.028},{"time":18.892,"pitch":36.021},{"time":18.9,"pitch":36.016},{"time":18.908,"pitch":36.012},{"time":18.917,"pitch":36.009},{"time":18.925,"pitch":36.007},{"time":18.933,"pitch":36.006},{"time":18.942,"pitch":36.004},{"time":18.95,"pitch":36.003},{"time":18.958,"pitch":36.002},{"time":18.975,"pitch":36.001},{"time":19.008,"pitch":36},{"time":19.258,"pitch":35.295},{"time":19.267,"pitch":34.756},{"time":19.275,"pitch":34.344},{"time":19.283,"pitch":34.028},{"time":19.292,"pitch":33.787},{"time":19.3,"pitch":33.602},{"time":19.308,"pitch":33.46},{"time":19.317,"pitch":33.352},{"time":19.325,"pitch":33.27},{"time":19.333,"pitch":33.206},{"time":19.342,"pitch":33.158},{"time":19.35,"pitch":33.121},{"time":19.358,"pitch":33.092},{"time":19.367,"pitch":33.071},{"time":19.375,"pitch":33.054},{"time":19.383,"pitch":33.041},{"time":19.392,"pitch":33.032},{"time":19.4,"pitch":33.024},{"time":19.408,"pitch":33.019},{"time":19.417,"pitch":33.014},{"time":19.425,"pitch":33.011},{"time":19.433,"pitch":33.008},{"time":19.442,"pitch":33.006},{"time":19.45,"pitch":33.005},{"time":19.458,"pitch":33.004},{"time":19.467,"pitch":33.003},{"time":19.475,"pitch":33.002},{"time":19.492,"pitch":33.001},{"time":19.508,"pitch":33.705},{"time":19.517,"pitch":34.244},{"time":19.525,"pitch":34.657},{"time":19.533,"pitch":34.972},{"time":19.542,"pitch":35.214},{"time":19.55,"pitch":35.398},{"time":19.558,"pitch":35.54},{"time":19.567,"pitch":35.648},{"time":19.575,"pitch":35.731},{"time":19.583,"pitch":35.794},{"time":19.592,"pitch":35.842},{"time":19.6,"pitch":35.879},{"time":19.608,"pitch":35.908},{"time":19.617,"pitch":35.929},{"time":19.625,"pitch":35.946},{"time":19.633,"pitch":35.959},{"time":19.642,"pitch":35.968},{"time":19.65,"pitch":35.976},{"time":19.658,"pitch":35.981},{"time":19.667,"pitch":35.986},{"time":19.675,"pitch":35.989},{"time":19.683,"pitch":35.992},{"time":19.692,"pitch":35.994},{"time":19.7,"pitch":35.995},{"time":19.708,"pitch":35.996},{"time":19.717,"pitch":35.997},{"time":19.725,"pitch":35.998},{"time":19.742,"pitch":35.999},{"time":19.775,"pitch":36},{"time":20,"pitch":36.47},{"time":20.008,"pitch":36.829},{"time":20.017,"pitch":37.104},{"time":20.025,"pitch":37.315},{"time":20.033,"pitch":37.476},{"time":20.042,"pitch":37.599},{"time":20.05,"pitch":37.693},{"time":20.058,"pitch":37.765},{"time":20.067,"pitch":37.82},{"time":20.075,"pitch":37.863},{"time":20.083,"pitch":37.895},{"time":20.092,"pitch":37.92},{"time":20.1,"pitch":37.938},{"time":20.108,"pitch":37.953},{"time":20.117,"pitch":37.964},{"time":20.125,"pitch":37.972},{"time":20.133,"pitch":37.979},{"time":20.142,"pitch":37.984},{"time":20.15,"pitch":37.988},{"time":20.158,"pitch":37.991},{"time":20.167,"pitch":37.993},{"time":20.175,"pitch":37.994},{"time":20.183,"pitch":37.996},{"time":20.192,"pitch":37.997},{"time":20.2,"pitch":37.998},{"time":20.217,"pitch":37.999},{"time":20.25,"pitch":38},{"time":20.733,"pitch":38.705},{"time":20.742,"pitch":39.244},{"time":20.75,"pitch":39.656},{"time":20.758,"pitch":39.972},{"time":20.767,"pitch":40.213},{"time":20.775,"pitch":40.398},{"time":20.783,"pitch":40.54},{"time":20.792,"pitch":40.648},{"time":20.8,"pitch":40.73},{"time":20.808,"pitch":40.794},{"time":20.817,"pitch":40.842},{"time":20.825,"pitch":40.879},{"time":20.833,"pitch":40.908},{"time":20.842,"pitch":40.929},{"time":20.85,"pitch":40.946},{"time":20.858,"pitch":40.959},{"time":20.867,"pitch":40.968},{"time":20.875,"pitch":40.976},{"time":20.883,"pitch":40.981},{"time":20.892,"pitch":40.986},{"time":20.9,"pitch":40.989},{"time":20.908,"pitch":40.992},{"time":20.917,"pitch":40.994},{"time":20.925,"pitch":40.995},{"time":20.933,"pitch":40.996},{"time":20.942,"pitch":40.997},{"time":20.95,"pitch":40.998},{"time":20.967,"pitch":40.999},{"time":21,"pitch":41},{"time":21.258,"pitch":40.295},{"time":21.267,"pitch":39.756},{"time":21.275,"pitch":39.344},{"time":21.283,"pitch":39.028},{"time":21.292,"pitch":38.787},{"time":21.3,"pitch":38.602},{"time":21.308,"pitch":38.46},{"time":21.317,"pitch":38.352},{"time":21.325,"pitch":38.27},{"time":21.333,"pitch":38.206},{"time":21.342,"pitch":38.158},{"time":21.35,"pitch":38.121},{"time":21.358,"pitch":38.092},{"time":21.367,"pitch":38.071},{"time":21.375,"pitch":38.054},{"time":21.383,"pitch":38.041},{"time":21.392,"pitch":38.032},{"time":21.4,"pitch":38.024},{"time":21.408,"pitch":38.019},{"time":21.417,"pitch":38.014},{"time":21.425,"pitch":38.011},{"time":21.433,"pitch":38.008},{"time":21.442,"pitch":38.006},{"time":21.45,"pitch":38.005},{"time":21.458,"pitch":38.004},{"time":21.467,"pitch":38.003},{"time":21.475,"pitch":38.002},{"time":21.492,"pitch":38.001},{"time":21.5,"pitch":38.706},{"time":21.508,"pitch":39.245},{"time":21.517,"pitch":39.657},{"time":21.525,"pitch":39.972},{"time":21.533,"pitch":40.214},{"time":21.542,"pitch":40.398},{"time":21.55,"pitch":40.54},{"time":21.558,"pitch":40.648},{"time":21.567,"pitch":40.731},{"time":21.575,"pitch":40.794},{"time":21.583,"pitch":40.842},{"time":21.592,"pitch":40.879},{"time":21.6,"pitch":40.908},{"time":21.608,"pitch":40.929},{"time":21.617,"pitch":40.946},{"time":21.625,"pitch":40.959},{"time":21.633,"pitch":40.968},{"time":21.642,"pitch":40.976},{"time":21.65,"pitch":40.981},{"time":21.658,"pitch":40.986},{"time":21.667,"pitch":40.989},{"time":21.675,"pitch":40.992},{"time":21.683,"pitch":40.994},{"time":21.692,"pitch":40.995},{"time":21.7,"pitch":40.996},{"time":21.708,"pitch":40.997},{"time":21.717,"pitch":40.998},{"time":21.733,"pitch":40.999},{"time":21.767,"pitch":41},{"time":22.008,"pitch":40.295},{"time":22.017,"pitch":39.756},{"time":22.025,"pitch":39.344},{"time":22.033,"pitch":39.028},{"time":22.042,"pitch":38.787},{"time":22.05,"pitch":38.602},{"time":22.058,"pitch":38.46},{"time":22.067,"pitch":38.352},{"time":22.075,"pitch":38.27},{"time":22.083,"pitch":38.206},{"time":22.092,"pitch":38.158},{"time":22.1,"pitch":38.121},{"time":22.108,"pitch":38.092},{"time":22.117,"pitch":38.071},{"time":22.125,"pitch":38.054},{"time":22.133,"pitch":38.041},{"time":22.142,"pitch":38.032},{"time":22.15,"pitch":38.024},{"time":22.158,"pitch":38.019},{"time":22.167,"pitch":38.014},{"time":22.175,"pitch":38.011},{"time":22.183,"pitch":38.008},{"time":22.192,"pitch":38.006},{"time":22.2,"pitch":38.005},{"time":22.208,"pitch":38.004},{"time":22.217,"pitch":38.003},{"time":22.225,"pitch":38.002},{"time":22.242,"pitch":38.001},{"time":22.275,"pitch":38},{"time":22.758,"pitch":37.53},{"time":22.767,"pitch":37.171},{"time":22.775,"pitch":36.896},{"time":22.783,"pitch":36.685},{"time":22.792,"pitch":36.524},{"time":22.8,"pitch":36.401},{"time":22.808,"pitch":36.307},{"time":22.817,"pitch":36.235},{"time":22.825,"pitch":36.18},{"time":22.833,"pitch":36.137},{"time":22.842,"pitch":36.105},{"time":22.85,"pitch":36.08},{"time":22.858,"pitch":36.062},{"time":22.867,"pitch":36.047},{"time":22.875,"pitch":36.036},{"time":22.883,"pitch":36.028},{"time":22.892,"pitch":36.021},{"time":22.9,"pitch":36.016},{"time":22.908,"pitch":36.012},{"time":22.917,"pitch":36.009},{"time":22.925,"pitch":36.007},{"time":22.933,"pitch":36.006},{"time":22.942,"pitch":36.004},{"time":22.95,"pitch":36.003},{"time":22.958,"pitch":36.002},{"time":22.975,"pitch":36.001},{"time":23.008,"pitch":36},{"time":23.258,"pitch":35.295},{"time":23.267,"pitch":34.756},{"time":23.275,"pitch":34.344},{"time":23.283,"pitch":34.028},{"time":23.292,"pitch":33.787},{"time":23.3,"pitch":33.602},{"time":23.308,"pitch":33.46},{"time":23.317,"pitch":33.352},{"time":23.325,"pitch":33.27},{"time":23.333,"pitch":33.206},{"time":23.342,"pitch":33.158},{"time":23.35,"pitch":33.121},{"time":23.358,"pitch":33.092},{"time":23.367,"pitch":33.071},{"time":23.375,"pitch":33.054},{"time":23.383,"pitch":33.041},{"time":23.392,"pitch":33.032},{"time":23.4,"pitch":33.024},{"time":23.408,"pitch":33.019},{"time":23.417,"pitch":33.014},{"time":23.425,"pitch":33.011},{"time":23.433,"pitch":33.008},{"time":23.442,"pitch":33.006},{"time":23.45,"pitch":33.005},{"time":23.458,"pitch":33.004},{"time":23.467,"pitch":33.003},{"time":23.475,"pitch":33.002},{"time":23.492,"pitch":33.001},{"time":23.508,"pitch":33.705},{"time":23.517,"pitch":34.244},{"time":23.525,"pitch":34.657},{"time":23.533,"pitch":34.972},{"time":23.542,"pitch":35.214},{"time":23.55,"pitch":35.398},{"time":23.558,"pitch":35.54},{"time":23.567,"pitch":35.648},{"time":23.575,"pitch":35.731},{"time":23.583,"pitch":35.794},{"time":23.592,"pitch":35.842},{"time":23.6,"pitch":35.879},{"time":23.608,"pitch":35.908},{"time":23.617,"pitch":35.929},{"time":23.625,"pitch":35.946},{"time":23.633,"pitch":35.959},{"time":23.642,"pitch":35.968},{"time":23.65,"pitch":35.976},{"time":23.658,"pitch":35.981},{"time":23.667,"pitch":35.986},{"time":23.675,"pitch":35.989},{"time":23.683,"pitch":35.992},{"time":23.692,"pitch":35.994},{"time":23.7,"pitch":35.995},{"time":23.708,"pitch":35.996},{"time":23.717,"pitch":35.997},{"time":23.725,"pitch":35.998},{"time":23.742,"pitch":35.999},{"time":23.775,"pitch":36},{"time":24,"pitch":36.47},{"time":24.008,"pitch":36.829},{"time":24.017,"pitch":37.104},{"time":24.025,"pitch":37.315},{"time":24.033,"pitch":37.476},{"time":24.042,"pitch":37.599},{"time":24.05,"pitch":37.693},{"time":24.058,"pitch":37.765},{"time":24.067,"pitch":37.82},{"time":24.075,"pitch":37.863},{"time":24.083,"pitch":37.895},{"time":24.092,"pitch":37.92},{"time":24.1,"pitch":37.938},{"time":24.108,"pitch":37.953},{"time":24.117,"pitch":37.964},{"time":24.125,"pitch":37.972},{"time":24.133,"pitch":37.979},{"time":24.142,"pitch":37.984},{"time":24.15,"pitch":37.988},{"time":24.158,"pitch":37.991},{"time":24.167,"pitch":37.993},{"time":24.175,"pitch":37.994},{"time":24.183,"pitch":37.996},{"time":24.192,"pitch":37.997},{"time":24.2,"pitch":37.998},{"time":24.217,"pitch":37.999},{"time":24.25,"pitch":38},{"time":24.733,"pitch":38.705},{"time":24.742,"pitch":39.244},{"time":24.75,"pitch":39.656},{"time":24.758,"pitch":39.972},{"time":24.767,"pitch":40.213},{"time":24.775,"pitch":40.398},{"time":24.783,"pitch":40.54},{"time":24.792,"pitch":40.648},{"time":24.8,"pitch":40.73},{"time":24.808,"pitch":40.794},{"time":24.817,"pitch":40.842},{"time":24.825,"pitch":40.879},{"time":24.833,"pitch":40.908},{"time":24.842,"pitch":40.929},{"time":24.85,"pitch":40.946},{"time":24.858,"pitch":40.959},{"time":24.867,"pitch":40.968},{"time":24.875,"pitch":40.976},{"time":24.883,"pitch":40.981},{"time":24.892,"pitch":40.986},{"time":24.9,"pitch":40.989},{"time":24.908,"pitch":40.992},{"time":24.917,"pitch":40.994},{"time":24.925,"pitch":40.995},{"time":24.933,"pitch":40.996},{"time":24.942,"pitch":40.997},{"time":24.95,"pitch":40.998},{"time":24.967,"pitch":40.999},{"time":25,"pitch":41},{"time":25.258,"pitch":40.295},{"time":25.267,"pitch":39.756},{"time":25.275,"pitch":39.344},{"time":25.283,"pitch":39.028},{"time":25.292,"pitch":38.787},{"time":25.3,"pitch":38.602},{"time":25.308,"pitch":38.46},{"time":25.317,"pitch":38.352},{"time":25.325,"pitch":38.27},{"time":25.333,"pitch":38.206},{"time":25.342,"pitch":38.158},{"time":25.35,"pitch":38.121},{"time":25.358,"pitch":38.092},{"time":25.367,"pitch":38.071},{"time":25.375,"pitch":38.054},{"time":25.383,"pitch":38.041},{"time":25.392,"pitch":38.032},{"time":25.4,"pitch":38.024},{"time":25.408,"pitch":38.019},{"time":25.417,"pitch":38.014},{"time":25.425,"pitch":38.011},{"time":25.433,"pitch":38.008},{"time":25.442,"pitch":38.006},{"time":25.45,"pitch":38.005},{"time":25.458,"pitch":38.004},{"time":25.467,"pitch":38.003},{"time":25.475,"pitch":38.002},{"time":25.492,"pitch":38.001},{"time":25.5,"pitch":38.706},{"time":25.508,"pitch":39.245},{"time":25.517,"pitch":39.657},{"time":25.525,"pitch":39.972},{"time":25.533,"pitch":40.214},{"time":25.542,"pitch":40.398},{"time":25.55,"pitch":40.54},{"time":25.558,"pitch":40.648},{"time":25.567,"pitch":40.731},{"time":25.575,"pitch":40.794},{"time":25.583,"pitch":40.842},{"time":25.592,"pitch":40.879},{"time":25.6,"pitch":40.908},{"time":25.608,"pitch":40.929},{"time":25.617,"pitch":40.946},{"time":25.625,"pitch":40.959},{"time":25.633,"pitch":40.968},{"time":25.642,"pitch":40.976},{"time":25.65,"pitch":40.981},{"time":25.658,"pitch":40.986},{"time":25.667,"pitch":40.989},{"time":25.675,"pitch":40.992},{"time":25.683,"pitch":40.994},{"time":25.692,"pitch":40.995},{"time":25.7,"pitch":40.996},{"time":25.708,"pitch":40.997},{"time":25.717,"pitch":40.998},{"time":25.733,"pitch":40.999},{"time":25.767,"pitch":41},{"time":26.008,"pitch":40.295},{"time":26.017,"pitch":39.756},{"time":26.025,"pitch":39.344},{"time":26.033,"pitch":39.028},{"time":26.042,"pitch":38.787},{"time":26.05,"pitch":38.602},{"time":26.058,"pitch":38.46},{"time":26.067,"pitch":38.352},{"time":26.075,"pitch":38.27},{"time":26.083,"pitch":38.206},{"time":26.092,"pitch":38.158},{"time":26.1,"pitch":38.121},{"time":26.108,"pitch":38.092},{"time":26.117,"pitch":38.071},{"time":26.125,"pitch":38.054},{"time":26.133,"pitch":38.041},{"time":26.142,"pitch":38.032},{"time":26.15,"pitch":38.024},{"time":26.158,"pitch":38.019},{"time":26.167,"pitch":38.014},{"time":26.175,"pitch":38.011},{"time":26.183,"pitch":38.008},{"time":26.192,"pitch":38.006},{"time":26.2,"pitch":38.005},{"time":26.208,"pitch":38.004},{"time":26.217,"pitch":38.003},{"time":26.225,"pitch":38.002},{"time":26.242,"pitch":38.001},{"time":26.275,"pitch":38},{"time":26.758,"pitch":37.53},{"time":26.767,"pitch":37.171},{"time":26.775,"pitch":36.896},{"time":26.783,"pitch":36.685},{"time":26.792,"pitch":36.524},{"time":26.8,"pitch":36.401},{"time":26.808,"pitch":36.307},{"time":26.817,"pitch":36.235},{"time":26.825,"pitch":36.18},{"time":26.833,"pitch":36.137},{"time":26.842,"pitch":36.105},{"time":26.85,"pitch":36.08},{"time":26.858,"pitch":36.062},{"time":26.867,"pitch":36.047},{"time":26.875,"pitch":36.036},{"time":26.883,"pitch":36.028},{"time":26.892,"pitch":36.021},{"time":26.9,"pitch":36.016},{"time":26.908,"pitch":36.012},{"time":26.917,"pitch":36.009},{"time":26.925,"pitch":36.007},{"time":26.933,"pitch":36.006},{"time":26.942,"pitch":36.004},{"time":26.95,"pitch":36.003},{"time":26.958,"pitch":36.002},{"time":26.975,"pitch":36.001},{"time":27.008,"pitch":36},{"time":27.258,"pitch":35.295},{"time":27.267,"pitch":34.756},{"time":27.275,"pitch":34.344},{"time":27.283,"pitch":34.028},{"time":27.292,"pitch":33.787},{"time":27.3,"pitch":33.602},{"time":27.308,"pitch":33.46},{"time":27.317,"pitch":33.352},{"time":27.325,"pitch":33.27},{"time":27.333,"pitch":33.206},{"time":27.342,"pitch":33.158},{"time":27.35,"pitch":33.121},{"time":27.358,"pitch":33.092},{"time":27.367,"pitch":33.071},{"time":27.375,"pitch":33.054},{"time":27.383,"pitch":33.041},{"time":27.392,"pitch":33.032},{"time":27.4,"pitch":33.024},{"time":27.408,"pitch":33.019},{"time":27.417,"pitch":33.014},{"time":27.425,"pitch":33.011},{"time":27.433,"pitch":33.008},{"time":27.442,"pitch":33.006},{"time":27.45,"pitch":33.005},{"time":27.458,"pitch":33.004},{"time":27.467,"pitch":33.003},{"time":27.475,"pitch":33.002},{"time":27.492,"pitch":33.001},{"time":27.508,"pitch":33.705},{"time":27.517,"pitch":34.244},{"time":27.525,"pitch":34.657},{"time":27.533,"pitch":34.972},{"time":27.542,"pitch":35.214},{"time":27.55,"pitch":35.398},{"time":27.558,"pitch":35.54},{"time":27.567,"pitch":35.648},{"time":27.575,"pitch":35.731},{"time":27.583,"pitch":35.794},{"time":27.592,"pitch":35.842},{"time":27.6,"pitch":35.879},{"time":27.608,"pitch":35.908},{"time":27.617,"pitch":35.929},{"time":27.625,"pitch":35.946},{"time":27.633,"pitch":35.959},{"time":27.642,"pitch":35.968},{"time":27.65,"pitch":35.976},{"time":27.658,"pitch":35.981},{"time":27.667,"pitch":35.986},{"time":27.675,"pitch":35.989},{"time":27.683,"pitch":35.992},{"time":27.692,"pitch":35.994},{"time":27.7,"pitch":35.995},{"time":27.708,"pitch":35.996},{"time":27.717,"pitch":35.997},{"time":27.725,"pitch":35.998},{"time":27.742,"pitch":35.999},{"time":27.775,"pitch":36},{"time":28,"pitch":36.47},{"time":28.008,"pitch":36.829},{"time":28.017,"pitch":37.104},{"time":28.025,"pitch":37.315},{"time":28.033,"pitch":37.476},{"time":28.042,"pitch":37.599},{"time":28.05,"pitch":37.693},{"time":28.058,"pitch":37.765},{"time":28.067,"pitch":37.82},{"time":28.075,"pitch":37.863},{"time":28.083,"pitch":37.895},{"time":28.092,"pitch":37.92},{"time":28.1,"pitch":37.938},{"time":28.108,"pitch":37.953},{"time":28.117,"pitch":37.964},{"time":28.125,"pitch":37.972},{"time":28.133,"pitch":37.979},{"time":28.142,"pitch":37.984},{"time":28.15,"pitch":37.988},{"time":28.158,"pitch":37.991},{"time":28.167,"pitch":37.993},{"time":28.175,"pitch":37.994},{"time":28.183,"pitch":37.996},{"time":28.192,"pitch":37.997},{"time":28.2,"pitch":37.998},{"time":28.217,"pitch":37.999},{"time":28.25,"pitch":38},{"time":28.733,"pitch":38.705},{"time":28.742,"pitch":39.244},{"time":28.75,"pitch":39.656},{"time":28.758,"pitch":39.972},{"time":28.767,"pitch":40.213},{"time":28.775,"pitch":40.398},{"time":28.783,"pitch":40.54},{"time":28.792,"pitch":40.648},{"time":28.8,"pitch":40.73},{"time":28.808,"pitch":40.794},{"time":28.817,"pitch":40.842},{"time":28.825,"pitch":40.879},{"time":28.833,"pitch":40.908},{"time":28.842,"pitch":40.929},{"time":28.85,"pitch":40.946},{"time":28.858,"pitch":40.959},{"time":28.867,"pitch":40.968},{"time":28.875,"pitch":40.976},{"time":28.883,"pitch":40.981},{"time":28.892,"pitch":40.986},{"time":28.9,"pitch":40.989},{"time":28.908,"pitch":40.992},{"time":28.917,"pitch":40.994},{"time":28.925,"pitch":40.995},{"time":28.933,"pitch":40.996},{"time":28.942,"pitch":40.997},{"time":28.95,"pitch":40.998},{"time":28.967,"pitch":40.999},{"time":29,"pitch":41},{"time":29.258,"pitch":40.295},{"time":29.267,"pitch":39.756},{"time":29.275,"pitch":39.344},{"time":29.283,"pitch":39.028},{"time":29.292,"pitch":38.787},{"time":29.3,"pitch":38.602},{"time":29.308,"pitch":38.46},{"time":29.317,"pitch":38.352},{"time":29.325,"pitch":38.27},{"time":29.333,"pitch":38.206},{"time":29.342,"pitch":38.158},{"time":29.35,"pitch":38.121},{"time":29.358,"pitch":38.092},{"time":29.367,"pitch":38.071},{"time":29.375,"pitch":38.054},{"time":29.383,"pitch":38.041},{"time":29.392,"pitch":38.032},{"time":29.4,"pitch":38.024},{"time":29.408,"pitch":38.019},{"time":29.417,"pitch":38.014},{"time":29.425,"pitch":38.011},{"time":29.433,"pitch":38.008},{"time":29.442,"pitch":38.006},{"time":29.45,"pitch":38.005},{"time":29.458,"pitch":38.004},{"time":29.467,"pitch":38.003},{"time":29.475,"pitch":38.002},{"time":29.492,"pitch":38.001},{"time":29.5,"pitch":38.706},{"time":29.508,"pitch":39.245},{"time":29.517,"pitch":39.657},{"time":29.525,"pitch":39.972},{"time":29.533,"pitch":40.214},{"time":29.542,"pitch":40.398},{"time":29.55,"pitch":40.54},{"time":29.558,"pitch":40.648},{"time":29.567,"pitch":40.731},{"time":29.575,"pitch":40.794},{"time":29.583,"pitch":40.842},{"time":29.592,"pitch":40.879},{"time":29.6,"pitch":40.908},{"time":29.608,"pitch":40.929},{"time":29.617,"pitch":40.946},{"time":29.625,"pitch":40.959},{"time":29.633,"pitch":40.968},{"time":29.642,"pitch":40.976},{"time":29.65,"pitch":40.981},{"time":29.658,"pitch":40.986},{"time":29.667,"pitch":40.989},{"time":29.675,"pitch":40.992},{"time":29.683,"pitch":40.994},{"time":29.692,"pitch":40.995},{"time":29.7,"pitch":40.996},{"time":29.708,"pitch":40.997},{"time":29.717,"pitch":40.998},{"time":29.733,"pitch":40.999},{"time":29.767,"pitch":41},{"time":30.008,"pitch":40.295},{"time":30.017,"pitch":39.756},{"time":30.025,"pitch":39.344},{"time":30.033,"pitch":39.028},{"time":30.042,"pitch":38.787},{"time":30.05,"pitch":38.602},{"time":30.058,"pitch":38.46},{"time":30.067,"pitch":38.352},{"time":30.075,"pitch":38.27},{"time":30.083,"pitch":38.206},{"time":30.092,"pitch":38.158},{"time":30.1,"pitch":38.121},{"time":30.108,"pitch":38.092},{"time":30.117,"pitch":38.071},{"time":30.125,"pitch":38.054},{"time":30.133,"pitch":38.041},{"time":30.142,"pitch":38.032},{"time":30.15,"pitch":38.024},{"time":30.158,"pitch":38.019},{"time":30.167,"pitch":38.014},{"time":30.175,"pitch":38.011},{"time":30.183,"pitch":38.008},{"time":30.192,"pitch":38.006},{"time":30.2,"pitch":38.005},{"time":30.208,"pitch":38.004},{"time":30.217,"pitch":38.003},{"time":30.225,"pitch":38.002},{"time":30.242,"pitch":38.001},{"time":30.275,"pitch":38},{"time":30.758,"pitch":37.53},{"time":30.767,"pitch":37.171},{"time":30.775,"pitch":36.896},{"time":30.783,"pitch":36.685},{"time":30.792,"pitch":36.524},{"time":30.8,"pitch":36.401},{"time":30.808,"pitch":36.307},{"time":30.817,"pitch":36.235},{"time":30.825,"pitch":36.18},{"time":30.833,"pitch":36.137},{"time":30.842,"pitch":36.105},{"time":30.85,"pitch":36.08},{"time":30.858,"pitch":36.062},{"time":30.867,"pitch":36.047},{"time":30.875,"pitch":36.036},{"time":30.883,"pitch":36.028},{"time":30.892,"pitch":36.021},{"time":30.9,"pitch":36.016},{"time":30.908,"pitch":36.012},{"time":30.917,"pitch":36.009},{"time":30.925,"pitch":36.007},{"time":30.933,"pitch":36.006},{"time":30.942,"pitch":36.004},{"time":30.95,"pitch":36.003},{"time":30.958,"pitch":36.002},{"time":30.975,"pitch":36.001},{"time":31.008,"pitch":36},{"time":31.258,"pitch":35.295},{"time":31.267,"pitch":34.756},{"time":31.275,"pitch":34.344},{"time":31.283,"pitch":34.028},{"time":31.292,"pitch":33.787},{"time":31.3,"pitch":33.602},{"time":31.308,"pitch":33.46},{"time":31.317,"pitch":33.352},{"time":31.325,"pitch":33.27},{"time":31.333,"pitch":33.206},{"time":31.342,"pitch":33.158},{"time":31.35,"pitch":33.121},{"time":31.358,"pitch":33.092},{"time":31.367,"pitch":33.071},{"time":31.375,"pitch":33.054},{"time":31.383,"pitch":33.041},{"time":31.392,"pitch":33.032},{"time":31.4,"pitch":33.024},{"time":31.408,"pitch":33.019},{"time":31.417,"pitch":33.014},{"time":31.425,"pitch":33.011},{"time":31.433,"pitch":33.008},{"time":31.442,"pitch":33.006},{"time":31.45,"pitch":33.005},{"time":31.458,"pitch":33.004},{"time":31.467,"pitch":33.003},{"time":31.475,"pitch":33.002},{"time":31.492,"pitch":33.001},{"time":31.508,"pitch":33.705},{"time":31.517,"pitch":34.244},{"time":31.525,"pitch":34.657},{"time":31.533,"pitch":34.972},{"time":31.542,"pitch":35.214},{"time":31.55,"pitch":35.398},{"time":31.558,"pitch":35.54},{"time":31.567,"pitch":35.648},{"time":31.575,"pitch":35.731},{"time":31.583,"pitch":35.794},{"time":31.592,"pitch":35.842},{"time":31.6,"pitch":35.879},{"time":31.608,"pitch":35.908},{"time":31.617,"pitch":35.929},{"time":31.625,"pitch":35.946},{"time":31.633,"pitch":35.959},{"time":31.642,"pitch":35.968},{"time":31.65,"pitch":35.976},{"time":31.658,"pitch":35.981},{"time":31.667,"pitch":35.986},{"time":31.675,"pitch":35.989},{"time":31.683,"pitch":35.992},{"time":31.692,"pitch":35.994},{"time":31.7,"pitch":35.995},{"time":31.708,"pitch":35.996},{"time":31.717,"pitch":35.997},{"time":31.725,"pitch":35.998},{"time":31.742,"pitch":35.999},{"time":31.775,"pitch":36},{"time":32,"pitch":36.47},{"time":32.008,"pitch":36.829},{"time":32.017,"pitch":37.104},{"time":32.025,"pitch":37.315},{"time":32.033,"pitch":37.476},{"time":32.042,"pitch":37.599},{"time":32.05,"pitch":37.693},{"time":32.058,"pitch":37.765},{"time":32.067,"pitch":37.82},{"time":32.075,"pitch":37.863},{"time":32.083,"pitch":37.895},{"time":32.092,"pitch":37.92},{"time":32.1,"pitch":37.938},{"time":32.108,"pitch":37.953},{"time":32.117,"pitch":37.964},{"time":32.125,"pitch":37.972},{"time":32.133,"pitch":37.979},{"time":32.142,"pitch":37.984},{"time":32.15,"pitch":37.988},{"time":32.158,"pitch":37.991},{"time":32.167,"pitch":37.993},{"time":32.175,"pitch":37.994},{"time":32.183,"pitch":37.996},{"time":32.192,"pitch":37.997},{"time":32.2,"pitch":37.998},{"time":32.217,"pitch":37.999},{"time":32.25,"pitch":38},{"time":32.317,"volume":0.833},{"time":32.325,"volume":0.667},{"time":32.333,"volume":0.5},{"time":32.342,"volume":0.333},{"time":32.35,"volume":0.167},{"time":32.358,"volume":0},{"time":32.367,"volume":0}]}},{"note":{"onTime":65.5,"k":[{"time":0,"pitch":38,"volume":0.167,"x":0,"y":0,"z":0},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.758,"pitch":37.53},{"time":2.767,"pitch":37.171},{"time":2.775,"pitch":36.896},{"time":2.783,"pitch":36.685},{"time":2.792,"pitch":36.524},{"time":2.8,"pitch":36.401},{"time":2.808,"pitch":36.307},{"time":2.817,"pitch":36.235},{"time":2.825,"pitch":36.18},{"time":2.833,"pitch":36.137},{"time":2.842,"pitch":36.105},{"time":2.85,"pitch":36.08},{"time":2.858,"pitch":36.062},{"time":2.867,"pitch":36.047},{"time":2.875,"pitch":36.036},{"time":2.883,"pitch":36.028},{"time":2.892,"pitch":36.021},{"time":2.9,"pitch":36.016},{"time":2.908,"pitch":36.012},{"time":2.917,"pitch":36.009},{"time":2.925,"pitch":36.007},{"time":2.933,"pitch":36.006},{"time":2.942,"pitch":36.004},{"time":2.95,"pitch":36.003},{"time":2.958,"pitch":36.002},{"time":2.975,"pitch":36.001},{"time":3.008,"pitch":36},{"time":3.258,"pitch":35.295},{"time":3.267,"pitch":34.756},{"time":3.275,"pitch":34.344},{"time":3.283,"pitch":34.028},{"time":3.292,"pitch":33.787},{"time":3.3,"pitch":33.602},{"time":3.308,"pitch":33.46},{"time":3.317,"pitch":33.352},{"time":3.325,"pitch":33.27},{"time":3.333,"pitch":33.206},{"time":3.342,"pitch":33.158},{"time":3.35,"pitch":33.121},{"time":3.358,"pitch":33.092},{"time":3.367,"pitch":33.071},{"time":3.375,"pitch":33.054},{"time":3.383,"pitch":33.041},{"time":3.392,"pitch":33.032},{"time":3.4,"pitch":33.024},{"time":3.408,"pitch":33.019},{"time":3.417,"pitch":33.014},{"time":3.425,"pitch":33.011},{"time":3.433,"pitch":33.008},{"time":3.442,"pitch":33.006},{"time":3.45,"pitch":33.005},{"time":3.458,"pitch":33.004},{"time":3.467,"pitch":33.003},{"time":3.475,"pitch":33.002},{"time":3.492,"pitch":33.001},{"time":3.508,"pitch":33.705},{"time":3.517,"pitch":34.244},{"time":3.525,"pitch":34.657},{"time":3.533,"pitch":34.972},{"time":3.542,"pitch":35.214},{"time":3.55,"pitch":35.398},{"time":3.558,"pitch":35.54},{"time":3.567,"pitch":35.648},{"time":3.575,"pitch":35.731},{"time":3.583,"pitch":35.794},{"time":3.592,"pitch":35.842},{"time":3.6,"pitch":35.879},{"time":3.608,"pitch":35.908},{"time":3.617,"pitch":35.929},{"time":3.625,"pitch":35.946},{"time":3.633,"pitch":35.959},{"time":3.642,"pitch":35.968},{"time":3.65,"pitch":35.976},{"time":3.658,"pitch":35.981},{"time":3.667,"pitch":35.986},{"time":3.675,"pitch":35.989},{"time":3.683,"pitch":35.992},{"time":3.692,"pitch":35.994},{"time":3.7,"pitch":35.995},{"time":3.708,"pitch":35.996},{"time":3.717,"pitch":35.997},{"time":3.725,"pitch":35.998},{"time":3.742,"pitch":35.999},{"time":3.775,"pitch":36},{"time":4,"pitch":36.47},{"time":4.008,"pitch":36.829},{"time":4.017,"pitch":37.104},{"time":4.025,"pitch":37.315},{"time":4.033,"pitch":37.476},{"time":4.042,"pitch":37.599},{"time":4.05,"pitch":37.693},{"time":4.058,"pitch":37.765},{"time":4.067,"pitch":37.82},{"time":4.075,"pitch":37.863},{"time":4.083,"pitch":37.895},{"time":4.092,"pitch":37.92},{"time":4.1,"pitch":37.938},{"time":4.108,"pitch":37.953},{"time":4.117,"pitch":37.964},{"time":4.125,"pitch":37.972},{"time":4.133,"pitch":37.979},{"time":4.142,"pitch":37.984},{"time":4.15,"pitch":37.988},{"time":4.158,"pitch":37.991},{"time":4.167,"pitch":37.993},{"time":4.175,"pitch":37.994},{"time":4.183,"pitch":37.996},{"time":4.192,"pitch":37.997},{"time":4.2,"pitch":37.998},{"time":4.217,"pitch":37.999},{"time":4.25,"pitch":38},{"time":4.733,"pitch":38.705},{"time":4.742,"pitch":39.244},{"time":4.75,"pitch":39.656},{"time":4.758,"pitch":39.972},{"time":4.767,"pitch":40.213},{"time":4.775,"pitch":40.398},{"time":4.783,"pitch":40.54},{"time":4.792,"pitch":40.648},{"time":4.8,"pitch":40.73},{"time":4.808,"pitch":40.794},{"time":4.817,"pitch":40.842},{"time":4.825,"pitch":40.879},{"time":4.833,"pitch":40.908},{"time":4.842,"pitch":40.929},{"time":4.85,"pitch":40.946},{"time":4.858,"pitch":40.959},{"time":4.867,"pitch":40.968},{"time":4.875,"pitch":40.976},{"time":4.883,"pitch":40.981},{"time":4.892,"pitch":40.986},{"time":4.9,"pitch":40.989},{"time":4.908,"pitch":40.992},{"time":4.917,"pitch":40.994},{"time":4.925,"pitch":40.995},{"time":4.933,"pitch":40.996},{"time":4.942,"pitch":40.997},{"time":4.95,"pitch":40.998},{"time":4.967,"pitch":40.999},{"time":5,"pitch":41},{"time":5.258,"pitch":40.295},{"time":5.267,"pitch":39.756},{"time":5.275,"pitch":39.344},{"time":5.283,"pitch":39.028},{"time":5.292,"pitch":38.787},{"time":5.3,"pitch":38.602},{"time":5.308,"pitch":38.46},{"time":5.317,"pitch":38.352},{"time":5.325,"pitch":38.27},{"time":5.333,"pitch":38.206},{"time":5.342,"pitch":38.158},{"time":5.35,"pitch":38.121},{"time":5.358,"pitch":38.092},{"time":5.367,"pitch":38.071},{"time":5.375,"pitch":38.054},{"time":5.383,"pitch":38.041},{"time":5.392,"pitch":38.032},{"time":5.4,"pitch":38.024},{"time":5.408,"pitch":38.019},{"time":5.417,"pitch":38.014},{"time":5.425,"pitch":38.011},{"time":5.433,"pitch":38.008},{"time":5.442,"pitch":38.006},{"time":5.45,"pitch":38.005},{"time":5.458,"pitch":38.004},{"time":5.467,"pitch":38.003},{"time":5.475,"pitch":38.002},{"time":5.492,"pitch":38.001},{"time":5.5,"pitch":38.706},{"time":5.508,"pitch":39.245},{"time":5.517,"pitch":39.657},{"time":5.525,"pitch":39.972},{"time":5.533,"pitch":40.214},{"time":5.542,"pitch":40.398},{"time":5.55,"pitch":40.54},{"time":5.558,"pitch":40.648},{"time":5.567,"pitch":40.731},{"time":5.575,"pitch":40.794},{"time":5.583,"pitch":40.842},{"time":5.592,"pitch":40.879},{"time":5.6,"pitch":40.908},{"time":5.608,"pitch":40.929},{"time":5.617,"pitch":40.946},{"time":5.625,"pitch":40.959},{"time":5.633,"pitch":40.968},{"time":5.642,"pitch":40.976},{"time":5.65,"pitch":40.981},{"time":5.658,"pitch":40.986},{"time":5.667,"pitch":40.989},{"time":5.675,"pitch":40.992},{"time":5.683,"pitch":40.994},{"time":5.692,"pitch":40.995},{"time":5.7,"pitch":40.996},{"time":5.708,"pitch":40.997},{"time":5.717,"pitch":40.998},{"time":5.733,"pitch":40.999},{"time":5.767,"pitch":41},{"time":6.008,"pitch":40.295},{"time":6.017,"pitch":39.756},{"time":6.025,"pitch":39.344},{"time":6.033,"pitch":39.028},{"time":6.042,"pitch":38.787},{"time":6.05,"pitch":38.602},{"time":6.058,"pitch":38.46},{"time":6.067,"pitch":38.352},{"time":6.075,"pitch":38.27},{"time":6.083,"pitch":38.206},{"time":6.092,"pitch":38.158},{"time":6.1,"pitch":38.121},{"time":6.108,"pitch":38.092},{"time":6.117,"pitch":38.071},{"time":6.125,"pitch":38.054},{"time":6.133,"pitch":38.041},{"time":6.142,"pitch":38.032},{"time":6.15,"pitch":38.024},{"time":6.158,"pitch":38.019},{"time":6.167,"pitch":38.014},{"time":6.175,"pitch":38.011},{"time":6.183,"pitch":38.008},{"time":6.192,"pitch":38.006},{"time":6.2,"pitch":38.005},{"time":6.208,"pitch":38.004},{"time":6.217,"pitch":38.003},{"time":6.225,"pitch":38.002},{"time":6.242,"pitch":38.001},{"time":6.275,"pitch":38},{"time":6.758,"pitch":37.53},{"time":6.767,"pitch":37.171},{"time":6.775,"pitch":36.896},{"time":6.783,"pitch":36.685},{"time":6.792,"pitch":36.524},{"time":6.8,"pitch":36.401},{"time":6.808,"pitch":36.307},{"time":6.817,"pitch":36.235},{"time":6.825,"pitch":36.18},{"time":6.833,"pitch":36.137},{"time":6.842,"pitch":36.105},{"time":6.85,"pitch":36.08},{"time":6.858,"pitch":36.062},{"time":6.867,"pitch":36.047},{"time":6.875,"pitch":36.036},{"time":6.883,"pitch":36.028},{"time":6.892,"pitch":36.021},{"time":6.9,"pitch":36.016},{"time":6.908,"pitch":36.012},{"time":6.917,"pitch":36.009},{"time":6.925,"pitch":36.007},{"time":6.933,"pitch":36.006},{"time":6.942,"pitch":36.004},{"time":6.95,"pitch":36.003},{"time":6.958,"pitch":36.002},{"time":6.975,"pitch":36.001},{"time":7.008,"pitch":36},{"time":7.258,"pitch":35.295},{"time":7.267,"pitch":34.756},{"time":7.275,"pitch":34.344},{"time":7.283,"pitch":34.028},{"time":7.292,"pitch":33.787},{"time":7.3,"pitch":33.602},{"time":7.308,"pitch":33.46},{"time":7.317,"pitch":33.352},{"time":7.325,"pitch":33.27},{"time":7.333,"pitch":33.206},{"time":7.342,"pitch":33.158},{"time":7.35,"pitch":33.121},{"time":7.358,"pitch":33.092},{"time":7.367,"pitch":33.071},{"time":7.375,"pitch":33.054},{"time":7.383,"pitch":33.041},{"time":7.392,"pitch":33.032},{"time":7.4,"pitch":33.024},{"time":7.408,"pitch":33.019},{"time":7.417,"pitch":33.014},{"time":7.425,"pitch":33.011},{"time":7.433,"pitch":33.008},{"time":7.442,"pitch":33.006},{"time":7.45,"pitch":33.005},{"time":7.458,"pitch":33.004},{"time":7.467,"pitch":33.003},{"time":7.475,"pitch":33.002},{"time":7.492,"pitch":33.001},{"time":7.508,"pitch":33.705},{"time":7.517,"pitch":34.244},{"time":7.525,"pitch":34.657},{"time":7.533,"pitch":34.972},{"time":7.542,"pitch":35.214},{"time":7.55,"pitch":35.398},{"time":7.558,"pitch":35.54},{"time":7.567,"pitch":35.648},{"time":7.575,"pitch":35.731},{"time":7.583,"pitch":35.794},{"time":7.592,"pitch":35.842},{"time":7.6,"pitch":35.879},{"time":7.608,"pitch":35.908},{"time":7.617,"pitch":35.929},{"time":7.625,"pitch":35.946},{"time":7.633,"pitch":35.959},{"time":7.642,"pitch":35.968},{"time":7.65,"pitch":35.976},{"time":7.658,"pitch":35.981},{"time":7.667,"pitch":35.986},{"time":7.675,"pitch":35.989},{"time":7.683,"pitch":35.992},{"time":7.692,"pitch":35.994},{"time":7.7,"pitch":35.995},{"time":7.708,"pitch":35.996},{"time":7.717,"pitch":35.997},{"time":7.725,"pitch":35.998},{"time":7.742,"pitch":35.999},{"time":7.775,"pitch":36},{"time":8,"pitch":36.47},{"time":8.008,"pitch":36.829},{"time":8.017,"pitch":37.104},{"time":8.025,"pitch":37.315},{"time":8.033,"pitch":37.476},{"time":8.042,"pitch":37.599},{"time":8.05,"pitch":37.693},{"time":8.058,"pitch":37.765},{"time":8.067,"pitch":37.82},{"time":8.075,"pitch":37.863},{"time":8.083,"pitch":37.895},{"time":8.092,"pitch":37.92},{"time":8.1,"pitch":37.938},{"time":8.108,"pitch":37.953},{"time":8.117,"pitch":37.964},{"time":8.125,"pitch":37.972},{"time":8.133,"pitch":37.979},{"time":8.142,"pitch":37.984},{"time":8.15,"pitch":37.988},{"time":8.158,"pitch":37.991},{"time":8.167,"pitch":37.993},{"time":8.175,"pitch":37.994},{"time":8.183,"pitch":37.996},{"time":8.192,"pitch":37.997},{"time":8.2,"pitch":37.998},{"time":8.217,"pitch":37.999},{"time":8.25,"pitch":38},{"time":8.733,"pitch":38.705},{"time":8.742,"pitch":39.244},{"time":8.75,"pitch":39.656},{"time":8.758,"pitch":39.972},{"time":8.767,"pitch":40.213},{"time":8.775,"pitch":40.398},{"time":8.783,"pitch":40.54},{"time":8.792,"pitch":40.648},{"time":8.8,"pitch":40.73},{"time":8.808,"pitch":40.794},{"time":8.817,"pitch":40.842},{"time":8.825,"pitch":40.879},{"time":8.833,"pitch":40.908},{"time":8.842,"pitch":40.929},{"time":8.85,"pitch":40.946},{"time":8.858,"pitch":40.959},{"time":8.867,"pitch":40.968},{"time":8.875,"pitch":40.976},{"time":8.883,"pitch":40.981},{"time":8.892,"pitch":40.986},{"time":8.9,"pitch":40.989},{"time":8.908,"pitch":40.992},{"time":8.917,"pitch":40.994},{"time":8.925,"pitch":40.995},{"time":8.933,"pitch":40.996},{"time":8.942,"pitch":40.997},{"time":8.95,"pitch":40.998},{"time":8.967,"pitch":40.999},{"time":9,"pitch":41},{"time":9.258,"pitch":40.295},{"time":9.267,"pitch":39.756},{"time":9.275,"pitch":39.344},{"time":9.283,"pitch":39.028},{"time":9.292,"pitch":38.787},{"time":9.3,"pitch":38.602},{"time":9.308,"pitch":38.46},{"time":9.317,"pitch":38.352},{"time":9.325,"pitch":38.27},{"time":9.333,"pitch":38.206},{"time":9.342,"pitch":38.158},{"time":9.35,"pitch":38.121},{"time":9.358,"pitch":38.092},{"time":9.367,"pitch":38.071},{"time":9.375,"pitch":38.054},{"time":9.383,"pitch":38.041},{"time":9.392,"pitch":38.032},{"time":9.4,"pitch":38.024},{"time":9.408,"pitch":38.019},{"time":9.417,"pitch":38.014},{"time":9.425,"pitch":38.011},{"time":9.433,"pitch":38.008},{"time":9.442,"pitch":38.006},{"time":9.45,"pitch":38.005},{"time":9.458,"pitch":38.004},{"time":9.467,"pitch":38.003},{"time":9.475,"pitch":38.002},{"time":9.492,"pitch":38.001},{"time":9.5,"pitch":38.706},{"time":9.508,"pitch":39.245},{"time":9.517,"pitch":39.657},{"time":9.525,"pitch":39.972},{"time":9.533,"pitch":40.214},{"time":9.542,"pitch":40.398},{"time":9.55,"pitch":40.54},{"time":9.558,"pitch":40.648},{"time":9.567,"pitch":40.731},{"time":9.575,"pitch":40.794},{"time":9.583,"pitch":40.842},{"time":9.592,"pitch":40.879},{"time":9.6,"pitch":40.908},{"time":9.608,"pitch":40.929},{"time":9.617,"pitch":40.946},{"time":9.625,"pitch":40.959},{"time":9.633,"pitch":40.968},{"time":9.642,"pitch":40.976},{"time":9.65,"pitch":40.981},{"time":9.658,"pitch":40.986},{"time":9.667,"pitch":40.989},{"time":9.675,"pitch":40.992},{"time":9.683,"pitch":40.994},{"time":9.692,"pitch":40.995},{"time":9.7,"pitch":40.996},{"time":9.708,"pitch":40.997},{"time":9.717,"pitch":40.998},{"time":9.733,"pitch":40.999},{"time":9.767,"pitch":41},{"time":10.008,"pitch":40.295},{"time":10.017,"pitch":39.756},{"time":10.025,"pitch":39.344},{"time":10.033,"pitch":39.028},{"time":10.042,"pitch":38.787},{"time":10.05,"pitch":38.602},{"time":10.058,"pitch":38.46},{"time":10.067,"pitch":38.352},{"time":10.075,"pitch":38.27},{"time":10.083,"pitch":38.206},{"time":10.092,"pitch":38.158},{"time":10.1,"pitch":38.121},{"time":10.108,"pitch":38.092},{"time":10.117,"pitch":38.071},{"time":10.125,"pitch":38.054},{"time":10.133,"pitch":38.041},{"time":10.142,"pitch":38.032},{"time":10.15,"pitch":38.024},{"time":10.158,"pitch":38.019},{"time":10.167,"pitch":38.014},{"time":10.175,"pitch":38.011},{"time":10.183,"pitch":38.008},{"time":10.192,"pitch":38.006},{"time":10.2,"pitch":38.005},{"time":10.208,"pitch":38.004},{"time":10.217,"pitch":38.003},{"time":10.225,"pitch":38.002},{"time":10.242,"pitch":38.001},{"time":10.275,"pitch":38},{"time":10.758,"pitch":37.53},{"time":10.767,"pitch":37.171},{"time":10.775,"pitch":36.896},{"time":10.783,"pitch":36.685},{"time":10.792,"pitch":36.524},{"time":10.8,"pitch":36.401},{"time":10.808,"pitch":36.307},{"time":10.817,"pitch":36.235},{"time":10.825,"pitch":36.18},{"time":10.833,"pitch":36.137},{"time":10.842,"pitch":36.105},{"time":10.85,"pitch":36.08},{"time":10.858,"pitch":36.062},{"time":10.867,"pitch":36.047},{"time":10.875,"pitch":36.036},{"time":10.883,"pitch":36.028},{"time":10.892,"pitch":36.021},{"time":10.9,"pitch":36.016},{"time":10.908,"pitch":36.012},{"time":10.917,"pitch":36.009},{"time":10.925,"pitch":36.007},{"time":10.933,"pitch":36.006},{"time":10.942,"pitch":36.004},{"time":10.95,"pitch":36.003},{"time":10.958,"pitch":36.002},{"time":10.975,"pitch":36.001},{"time":11.008,"pitch":36},{"time":11.258,"pitch":35.295},{"time":11.267,"pitch":34.756},{"time":11.275,"pitch":34.344},{"time":11.283,"pitch":34.028},{"time":11.292,"pitch":33.787},{"time":11.3,"pitch":33.602},{"time":11.308,"pitch":33.46},{"time":11.317,"pitch":33.352},{"time":11.325,"pitch":33.27},{"time":11.333,"pitch":33.206},{"time":11.342,"pitch":33.158},{"time":11.35,"pitch":33.121},{"time":11.358,"pitch":33.092},{"time":11.367,"pitch":33.071},{"time":11.375,"pitch":33.054},{"time":11.383,"pitch":33.041},{"time":11.392,"pitch":33.032},{"time":11.4,"pitch":33.024},{"time":11.408,"pitch":33.019},{"time":11.417,"pitch":33.014},{"time":11.425,"pitch":33.011},{"time":11.433,"pitch":33.008},{"time":11.442,"pitch":33.006},{"time":11.45,"pitch":33.005},{"time":11.458,"pitch":33.004},{"time":11.467,"pitch":33.003},{"time":11.475,"pitch":33.002},{"time":11.492,"pitch":33.001},{"time":11.508,"pitch":33.705},{"time":11.517,"pitch":34.244},{"time":11.525,"pitch":34.657},{"time":11.533,"pitch":34.972},{"time":11.542,"pitch":35.214},{"time":11.55,"pitch":35.398},{"time":11.558,"pitch":35.54},{"time":11.567,"pitch":35.648},{"time":11.575,"pitch":35.731},{"time":11.583,"pitch":35.794},{"time":11.592,"pitch":35.842},{"time":11.6,"pitch":35.879},{"time":11.608,"pitch":35.908},{"time":11.617,"pitch":35.929},{"time":11.625,"pitch":35.946},{"time":11.633,"pitch":35.959},{"time":11.642,"pitch":35.968},{"time":11.65,"pitch":35.976},{"time":11.658,"pitch":35.981},{"time":11.667,"pitch":35.986},{"time":11.675,"pitch":35.989},{"time":11.683,"pitch":35.992},{"time":11.692,"pitch":35.994},{"time":11.7,"pitch":35.995},{"time":11.708,"pitch":35.996},{"time":11.717,"pitch":35.997},{"time":11.725,"pitch":35.998},{"time":11.742,"pitch":35.999},{"time":11.775,"pitch":36},{"time":12,"pitch":36.47},{"time":12.008,"pitch":36.829},{"time":12.017,"pitch":37.104},{"time":12.025,"pitch":37.315},{"time":12.033,"pitch":37.476},{"time":12.042,"pitch":37.599},{"time":12.05,"pitch":37.693},{"time":12.058,"pitch":37.765},{"time":12.067,"pitch":37.82},{"time":12.075,"pitch":37.863},{"time":12.083,"pitch":37.895},{"time":12.092,"pitch":37.92},{"time":12.1,"pitch":37.938},{"time":12.108,"pitch":37.953},{"time":12.117,"pitch":37.964},{"time":12.125,"pitch":37.972},{"time":12.133,"pitch":37.979},{"time":12.142,"pitch":37.984},{"time":12.15,"pitch":37.988},{"time":12.158,"pitch":37.991},{"time":12.167,"pitch":37.993},{"time":12.175,"pitch":37.994},{"time":12.183,"pitch":37.996},{"time":12.192,"pitch":37.997},{"time":12.2,"pitch":37.998},{"time":12.217,"pitch":37.999},{"time":12.25,"pitch":38},{"time":12.733,"pitch":38.705},{"time":12.742,"pitch":39.244},{"time":12.75,"pitch":39.656},{"time":12.758,"pitch":39.972},{"time":12.767,"pitch":40.213},{"time":12.775,"pitch":40.398},{"time":12.783,"pitch":40.54},{"time":12.792,"pitch":40.648},{"time":12.8,"pitch":40.73},{"time":12.808,"pitch":40.794},{"time":12.817,"pitch":40.842},{"time":12.825,"pitch":40.879},{"time":12.833,"pitch":40.908},{"time":12.842,"pitch":40.929},{"time":12.85,"pitch":40.946},{"time":12.858,"pitch":40.959},{"time":12.867,"pitch":40.968},{"time":12.875,"pitch":40.976},{"time":12.883,"pitch":40.981},{"time":12.892,"pitch":40.986},{"time":12.9,"pitch":40.989},{"time":12.908,"pitch":40.992},{"time":12.917,"pitch":40.994},{"time":12.925,"pitch":40.995},{"time":12.933,"pitch":40.996},{"time":12.942,"pitch":40.997},{"time":12.95,"pitch":40.998},{"time":12.967,"pitch":40.999},{"time":13,"pitch":41},{"time":13.225,"pitch":41.705},{"time":13.233,"pitch":42.244},{"time":13.242,"pitch":42.656},{"time":13.25,"pitch":42.972},{"time":13.258,"pitch":43.213},{"time":13.267,"pitch":43.398},{"time":13.275,"pitch":43.54},{"time":13.283,"pitch":43.648},{"time":13.292,"pitch":43.73},{"time":13.3,"pitch":43.794},{"time":13.308,"pitch":43.842},{"time":13.317,"pitch":43.879},{"time":13.325,"pitch":43.908},{"time":13.333,"pitch":43.929},{"time":13.342,"pitch":43.946},{"time":13.35,"pitch":43.959},{"time":13.358,"pitch":43.968},{"time":13.367,"pitch":43.976},{"time":13.375,"pitch":43.981},{"time":13.383,"pitch":43.986},{"time":13.392,"pitch":43.989},{"time":13.4,"pitch":43.992},{"time":13.408,"pitch":43.994},{"time":13.417,"pitch":43.995},{"time":13.425,"pitch":43.996},{"time":13.433,"pitch":43.997},{"time":13.442,"pitch":43.998},{"time":13.458,"pitch":43.999},{"time":13.492,"pitch":44},{"time":13.525,"pitch":43.765},{"time":13.533,"pitch":43.585},{"time":13.542,"pitch":43.448},{"time":13.55,"pitch":43.343},{"time":13.558,"pitch":43.262},{"time":13.567,"pitch":43.201},{"time":13.575,"pitch":43.153},{"time":13.583,"pitch":43.117},{"time":13.592,"pitch":43.09},{"time":13.6,"pitch":43.069},{"time":13.608,"pitch":43.053},{"time":13.617,"pitch":43.04},{"time":13.625,"pitch":43.031},{"time":13.633,"pitch":43.024},{"time":13.642,"pitch":43.018},{"time":13.65,"pitch":43.014},{"time":13.658,"pitch":43.011},{"time":13.667,"pitch":43.008},{"time":13.675,"pitch":43.006},{"time":13.683,"pitch":43.005},{"time":13.692,"pitch":43.004},{"time":13.7,"pitch":43.003},{"time":13.708,"pitch":43.002},{"time":13.725,"pitch":43.001},{"time":13.758,"pitch":43},{"time":14,"pitch":42.53},{"time":14.008,"pitch":42.171},{"time":14.017,"pitch":41.896},{"time":14.025,"pitch":41.685},{"time":14.033,"pitch":41.524},{"time":14.042,"pitch":41.401},{"time":14.05,"pitch":41.307},{"time":14.058,"pitch":41.235},{"time":14.067,"pitch":41.18},{"time":14.075,"pitch":41.137},{"time":14.083,"pitch":41.105},{"time":14.092,"pitch":41.08},{"time":14.1,"pitch":41.062},{"time":14.108,"pitch":41.047},{"time":14.117,"pitch":41.036},{"time":14.125,"pitch":41.028},{"time":14.133,"pitch":41.021},{"time":14.142,"pitch":41.016},{"time":14.15,"pitch":41.012},{"time":14.158,"pitch":41.009},{"time":14.167,"pitch":41.007},{"time":14.175,"pitch":41.006},{"time":14.183,"pitch":41.004},{"time":14.192,"pitch":41.003},{"time":14.2,"pitch":41.002},{"time":14.217,"pitch":41.001},{"time":14.25,"pitch":41},{"time":14.758,"pitch":40.295},{"time":14.767,"pitch":39.756},{"time":14.775,"pitch":39.344},{"time":14.783,"pitch":39.028},{"time":14.792,"pitch":38.787},{"time":14.8,"pitch":38.602},{"time":14.808,"pitch":38.46},{"time":14.817,"pitch":38.352},{"time":14.825,"pitch":38.27},{"time":14.833,"pitch":38.206},{"time":14.842,"pitch":38.158},{"time":14.85,"pitch":38.121},{"time":14.858,"pitch":38.092},{"time":14.867,"pitch":38.071},{"time":14.875,"pitch":38.054},{"time":14.883,"pitch":38.041},{"time":14.892,"pitch":38.032},{"time":14.9,"pitch":38.024},{"time":14.908,"pitch":38.019},{"time":14.917,"pitch":38.014},{"time":14.925,"pitch":38.011},{"time":14.933,"pitch":38.008},{"time":14.942,"pitch":38.006},{"time":14.95,"pitch":38.005},{"time":14.958,"pitch":38.004},{"time":14.967,"pitch":38.003},{"time":14.975,"pitch":38.002},{"time":14.992,"pitch":38.001},{"time":15.025,"pitch":38},{"time":15.208,"pitch":36.826},{"time":15.217,"pitch":35.927},{"time":15.225,"pitch":35.239},{"time":15.233,"pitch":34.713},{"time":15.242,"pitch":34.311},{"time":15.25,"pitch":34.003},{"time":15.258,"pitch":33.767},{"time":15.267,"pitch":33.587},{"time":15.275,"pitch":33.449},{"time":15.283,"pitch":33.344},{"time":15.292,"pitch":33.263},{"time":15.3,"pitch":33.201},{"time":15.308,"pitch":33.154},{"time":15.317,"pitch":33.118},{"time":15.325,"pitch":33.09},{"time":15.333,"pitch":33.069},{"time":15.342,"pitch":33.053},{"time":15.35,"pitch":33.04},{"time":15.358,"pitch":33.031},{"time":15.367,"pitch":33.024},{"time":15.375,"pitch":33.018},{"time":15.383,"pitch":33.014},{"time":15.392,"pitch":33.011},{"time":15.4,"pitch":33.008},{"time":15.408,"pitch":33.006},{"time":15.417,"pitch":33.005},{"time":15.425,"pitch":33.004},{"time":15.433,"pitch":33.003},{"time":15.442,"pitch":33.002},{"time":15.458,"pitch":33.001},{"time":15.492,"pitch":33},{"time":15.508,"pitch":33.705},{"time":15.517,"pitch":34.244},{"time":15.525,"pitch":34.657},{"time":15.533,"pitch":34.972},{"time":15.542,"pitch":35.214},{"time":15.55,"pitch":35.398},{"time":15.558,"pitch":35.54},{"time":15.567,"pitch":35.648},{"time":15.575,"pitch":35.73},{"time":15.583,"pitch":35.794},{"time":15.592,"pitch":35.842},{"time":15.6,"pitch":35.879},{"time":15.608,"pitch":35.908},{"time":15.617,"pitch":35.929},{"time":15.625,"pitch":35.946},{"time":15.633,"pitch":35.959},{"time":15.642,"pitch":35.968},{"time":15.65,"pitch":35.976},{"time":15.658,"pitch":35.981},{"time":15.667,"pitch":35.986},{"time":15.675,"pitch":35.989},{"time":15.683,"pitch":35.992},{"time":15.692,"pitch":35.994},{"time":15.7,"pitch":35.995},{"time":15.708,"pitch":35.996},{"time":15.717,"pitch":35.997},{"time":15.725,"pitch":35.998},{"time":15.742,"pitch":35.999},{"time":15.775,"pitch":36},{"time":16,"pitch":36.47},{"time":16.008,"pitch":36.829},{"time":16.017,"pitch":37.104},{"time":16.025,"pitch":37.315},{"time":16.033,"pitch":37.476},{"time":16.042,"pitch":37.599},{"time":16.05,"pitch":37.693},{"time":16.058,"pitch":37.765},{"time":16.067,"pitch":37.82},{"time":16.075,"pitch":37.863},{"time":16.083,"pitch":37.895},{"time":16.092,"pitch":37.92},{"time":16.1,"pitch":37.938},{"time":16.108,"pitch":37.953},{"time":16.117,"pitch":37.964},{"time":16.125,"pitch":37.972},{"time":16.133,"pitch":37.979},{"time":16.142,"pitch":37.984},{"time":16.15,"pitch":37.988},{"time":16.158,"pitch":37.991},{"time":16.167,"pitch":37.993},{"time":16.175,"pitch":37.994},{"time":16.183,"pitch":37.996},{"time":16.192,"pitch":37.997},{"time":16.2,"pitch":37.998},{"time":16.217,"pitch":37.999},{"time":16.25,"pitch":38},{"time":16.733,"pitch":38.705},{"time":16.742,"pitch":39.244},{"time":16.75,"pitch":39.656},{"time":16.758,"pitch":39.972},{"time":16.767,"pitch":40.213},{"time":16.775,"pitch":40.398},{"time":16.783,"pitch":40.54},{"time":16.792,"pitch":40.648},{"time":16.8,"pitch":40.73},{"time":16.808,"pitch":40.794},{"time":16.817,"pitch":40.842},{"time":16.825,"pitch":40.879},{"time":16.833,"pitch":40.908},{"time":16.842,"pitch":40.929},{"time":16.85,"pitch":40.946},{"time":16.858,"pitch":40.959},{"time":16.867,"pitch":40.968},{"time":16.875,"pitch":40.976},{"time":16.883,"pitch":40.981},{"time":16.892,"pitch":40.986},{"time":16.9,"pitch":40.989},{"time":16.908,"pitch":40.992},{"time":16.917,"pitch":40.994},{"time":16.925,"pitch":40.995},{"time":16.933,"pitch":40.996},{"time":16.942,"pitch":40.997},{"time":16.95,"pitch":40.998},{"time":16.967,"pitch":40.999},{"time":17,"pitch":41},{"time":17.258,"pitch":40.295},{"time":17.267,"pitch":39.756},{"time":17.275,"pitch":39.344},{"time":17.283,"pitch":39.028},{"time":17.292,"pitch":38.787},{"time":17.3,"pitch":38.602},{"time":17.308,"pitch":38.46},{"time":17.317,"pitch":38.352},{"time":17.325,"pitch":38.27},{"time":17.333,"pitch":38.206},{"time":17.342,"pitch":38.158},{"time":17.35,"pitch":38.121},{"time":17.358,"pitch":38.092},{"time":17.367,"pitch":38.071},{"time":17.375,"pitch":38.054},{"time":17.383,"pitch":38.041},{"time":17.392,"pitch":38.032},{"time":17.4,"pitch":38.024},{"time":17.408,"pitch":38.019},{"time":17.417,"pitch":38.014},{"time":17.425,"pitch":38.011},{"time":17.433,"pitch":38.008},{"time":17.442,"pitch":38.006},{"time":17.45,"pitch":38.005},{"time":17.458,"pitch":38.004},{"time":17.467,"pitch":38.003},{"time":17.475,"pitch":38.002},{"time":17.492,"pitch":38.001},{"time":17.5,"pitch":38.706},{"time":17.508,"pitch":39.245},{"time":17.517,"pitch":39.657},{"time":17.525,"pitch":39.972},{"time":17.533,"pitch":40.214},{"time":17.542,"pitch":40.398},{"time":17.55,"pitch":40.54},{"time":17.558,"pitch":40.648},{"time":17.567,"pitch":40.731},{"time":17.575,"pitch":40.794},{"time":17.583,"pitch":40.842},{"time":17.592,"pitch":40.879},{"time":17.6,"pitch":40.908},{"time":17.608,"pitch":40.929},{"time":17.617,"pitch":40.946},{"time":17.625,"pitch":40.959},{"time":17.633,"pitch":40.968},{"time":17.642,"pitch":40.976},{"time":17.65,"pitch":40.981},{"time":17.658,"pitch":40.986},{"time":17.667,"pitch":40.989},{"time":17.675,"pitch":40.992},{"time":17.683,"pitch":40.994},{"time":17.692,"pitch":40.995},{"time":17.7,"pitch":40.996},{"time":17.708,"pitch":40.997},{"time":17.717,"pitch":40.998},{"time":17.733,"pitch":40.999},{"time":17.767,"pitch":41},{"time":18.008,"pitch":40.295},{"time":18.017,"pitch":39.756},{"time":18.025,"pitch":39.344},{"time":18.033,"pitch":39.028},{"time":18.042,"pitch":38.787},{"time":18.05,"pitch":38.602},{"time":18.058,"pitch":38.46},{"time":18.067,"pitch":38.352},{"time":18.075,"pitch":38.27},{"time":18.083,"pitch":38.206},{"time":18.092,"pitch":38.158},{"time":18.1,"pitch":38.121},{"time":18.108,"pitch":38.092},{"time":18.117,"pitch":38.071},{"time":18.125,"pitch":38.054},{"time":18.133,"pitch":38.041},{"time":18.142,"pitch":38.032},{"time":18.15,"pitch":38.024},{"time":18.158,"pitch":38.019},{"time":18.167,"pitch":38.014},{"time":18.175,"pitch":38.011},{"time":18.183,"pitch":38.008},{"time":18.192,"pitch":38.006},{"time":18.2,"pitch":38.005},{"time":18.208,"pitch":38.004},{"time":18.217,"pitch":38.003},{"time":18.225,"pitch":38.002},{"time":18.242,"pitch":38.001},{"time":18.275,"pitch":38},{"time":18.758,"pitch":37.53},{"time":18.767,"pitch":37.171},{"time":18.775,"pitch":36.896},{"time":18.783,"pitch":36.685},{"time":18.792,"pitch":36.524},{"time":18.8,"pitch":36.401},{"time":18.808,"pitch":36.307},{"time":18.817,"pitch":36.235},{"time":18.825,"pitch":36.18},{"time":18.833,"pitch":36.137},{"time":18.842,"pitch":36.105},{"time":18.85,"pitch":36.08},{"time":18.858,"pitch":36.062},{"time":18.867,"pitch":36.047},{"time":18.875,"pitch":36.036},{"time":18.883,"pitch":36.028},{"time":18.892,"pitch":36.021},{"time":18.9,"pitch":36.016},{"time":18.908,"pitch":36.012},{"time":18.917,"pitch":36.009},{"time":18.925,"pitch":36.007},{"time":18.933,"pitch":36.006},{"time":18.942,"pitch":36.004},{"time":18.95,"pitch":36.003},{"time":18.958,"pitch":36.002},{"time":18.975,"pitch":36.001},{"time":19.008,"pitch":36},{"time":19.258,"pitch":35.295},{"time":19.267,"pitch":34.756},{"time":19.275,"pitch":34.344},{"time":19.283,"pitch":34.028},{"time":19.292,"pitch":33.787},{"time":19.3,"pitch":33.602},{"time":19.308,"pitch":33.46},{"time":19.317,"pitch":33.352},{"time":19.325,"pitch":33.27},{"time":19.333,"pitch":33.206},{"time":19.342,"pitch":33.158},{"time":19.35,"pitch":33.121},{"time":19.358,"pitch":33.092},{"time":19.367,"pitch":33.071},{"time":19.375,"pitch":33.054},{"time":19.383,"pitch":33.041},{"time":19.392,"pitch":33.032},{"time":19.4,"pitch":33.024},{"time":19.408,"pitch":33.019},{"time":19.417,"pitch":33.014},{"time":19.425,"pitch":33.011},{"time":19.433,"pitch":33.008},{"time":19.442,"pitch":33.006},{"time":19.45,"pitch":33.005},{"time":19.458,"pitch":33.004},{"time":19.467,"pitch":33.003},{"time":19.475,"pitch":33.002},{"time":19.492,"pitch":33.001},{"time":19.508,"pitch":33.705},{"time":19.517,"pitch":34.244},{"time":19.525,"pitch":34.657},{"time":19.533,"pitch":34.972},{"time":19.542,"pitch":35.214},{"time":19.55,"pitch":35.398},{"time":19.558,"pitch":35.54},{"time":19.567,"pitch":35.648},{"time":19.575,"pitch":35.731},{"time":19.583,"pitch":35.794},{"time":19.592,"pitch":35.842},{"time":19.6,"pitch":35.879},{"time":19.608,"pitch":35.908},{"time":19.617,"pitch":35.929},{"time":19.625,"pitch":35.946},{"time":19.633,"pitch":35.959},{"time":19.642,"pitch":35.968},{"time":19.65,"pitch":35.976},{"time":19.658,"pitch":35.981},{"time":19.667,"pitch":35.986},{"time":19.675,"pitch":35.989},{"time":19.683,"pitch":35.992},{"time":19.692,"pitch":35.994},{"time":19.7,"pitch":35.995},{"time":19.708,"pitch":35.996},{"time":19.717,"pitch":35.997},{"time":19.725,"pitch":35.998},{"time":19.742,"pitch":35.999},{"time":19.775,"pitch":36},{"time":20,"pitch":36.47},{"time":20.008,"pitch":36.829},{"time":20.017,"pitch":37.104},{"time":20.025,"pitch":37.315},{"time":20.033,"pitch":37.476},{"time":20.042,"pitch":37.599},{"time":20.05,"pitch":37.693},{"time":20.058,"pitch":37.765},{"time":20.067,"pitch":37.82},{"time":20.075,"pitch":37.863},{"time":20.083,"pitch":37.895},{"time":20.092,"pitch":37.92},{"time":20.1,"pitch":37.938},{"time":20.108,"pitch":37.953},{"time":20.117,"pitch":37.964},{"time":20.125,"pitch":37.972},{"time":20.133,"pitch":37.979},{"time":20.142,"pitch":37.984},{"time":20.15,"pitch":37.988},{"time":20.158,"pitch":37.991},{"time":20.167,"pitch":37.993},{"time":20.175,"pitch":37.994},{"time":20.183,"pitch":37.996},{"time":20.192,"pitch":37.997},{"time":20.2,"pitch":37.998},{"time":20.217,"pitch":37.999},{"time":20.25,"pitch":38},{"time":20.733,"pitch":38.705},{"time":20.742,"pitch":39.244},{"time":20.75,"pitch":39.656},{"time":20.758,"pitch":39.972},{"time":20.767,"pitch":40.213},{"time":20.775,"pitch":40.398},{"time":20.783,"pitch":40.54},{"time":20.792,"pitch":40.648},{"time":20.8,"pitch":40.73},{"time":20.808,"pitch":40.794},{"time":20.817,"pitch":40.842},{"time":20.825,"pitch":40.879},{"time":20.833,"pitch":40.908},{"time":20.842,"pitch":40.929},{"time":20.85,"pitch":40.946},{"time":20.858,"pitch":40.959},{"time":20.867,"pitch":40.968},{"time":20.875,"pitch":40.976},{"time":20.883,"pitch":40.981},{"time":20.892,"pitch":40.986},{"time":20.9,"pitch":40.989},{"time":20.908,"pitch":40.992},{"time":20.917,"pitch":40.994},{"time":20.925,"pitch":40.995},{"time":20.933,"pitch":40.996},{"time":20.942,"pitch":40.997},{"time":20.95,"pitch":40.998},{"time":20.967,"pitch":40.999},{"time":21,"pitch":41},{"time":21.258,"pitch":40.295},{"time":21.267,"pitch":39.756},{"time":21.275,"pitch":39.344},{"time":21.283,"pitch":39.028},{"time":21.292,"pitch":38.787},{"time":21.3,"pitch":38.602},{"time":21.308,"pitch":38.46},{"time":21.317,"pitch":38.352},{"time":21.325,"pitch":38.27},{"time":21.333,"pitch":38.206},{"time":21.342,"pitch":38.158},{"time":21.35,"pitch":38.121},{"time":21.358,"pitch":38.092},{"time":21.367,"pitch":38.071},{"time":21.375,"pitch":38.054},{"time":21.383,"pitch":38.041},{"time":21.392,"pitch":38.032},{"time":21.4,"pitch":38.024},{"time":21.408,"pitch":38.019},{"time":21.417,"pitch":38.014},{"time":21.425,"pitch":38.011},{"time":21.433,"pitch":38.008},{"time":21.442,"pitch":38.006},{"time":21.45,"pitch":38.005},{"time":21.458,"pitch":38.004},{"time":21.467,"pitch":38.003},{"time":21.475,"pitch":38.002},{"time":21.492,"pitch":38.001},{"time":21.5,"pitch":38.706},{"time":21.508,"pitch":39.245},{"time":21.517,"pitch":39.657},{"time":21.525,"pitch":39.972},{"time":21.533,"pitch":40.214},{"time":21.542,"pitch":40.398},{"time":21.55,"pitch":40.54},{"time":21.558,"pitch":40.648},{"time":21.567,"pitch":40.731},{"time":21.575,"pitch":40.794},{"time":21.583,"pitch":40.842},{"time":21.592,"pitch":40.879},{"time":21.6,"pitch":40.908},{"time":21.608,"pitch":40.929},{"time":21.617,"pitch":40.946},{"time":21.625,"pitch":40.959},{"time":21.633,"pitch":40.968},{"time":21.642,"pitch":40.976},{"time":21.65,"pitch":40.981},{"time":21.658,"pitch":40.986},{"time":21.667,"pitch":40.989},{"time":21.675,"pitch":40.992},{"time":21.683,"pitch":40.994},{"time":21.692,"pitch":40.995},{"time":21.7,"pitch":40.996},{"time":21.708,"pitch":40.997},{"time":21.717,"pitch":40.998},{"time":21.733,"pitch":40.999},{"time":21.767,"pitch":41},{"time":22.008,"pitch":40.295},{"time":22.017,"pitch":39.756},{"time":22.025,"pitch":39.344},{"time":22.033,"pitch":39.028},{"time":22.042,"pitch":38.787},{"time":22.05,"pitch":38.602},{"time":22.058,"pitch":38.46},{"time":22.067,"pitch":38.352},{"time":22.075,"pitch":38.27},{"time":22.083,"pitch":38.206},{"time":22.092,"pitch":38.158},{"time":22.1,"pitch":38.121},{"time":22.108,"pitch":38.092},{"time":22.117,"pitch":38.071},{"time":22.125,"pitch":38.054},{"time":22.133,"pitch":38.041},{"time":22.142,"pitch":38.032},{"time":22.15,"pitch":38.024},{"time":22.158,"pitch":38.019},{"time":22.167,"pitch":38.014},{"time":22.175,"pitch":38.011},{"time":22.183,"pitch":38.008},{"time":22.192,"pitch":38.006},{"time":22.2,"pitch":38.005},{"time":22.208,"pitch":38.004},{"time":22.217,"pitch":38.003},{"time":22.225,"pitch":38.002},{"time":22.242,"pitch":38.001},{"time":22.275,"pitch":38},{"time":22.758,"pitch":37.53},{"time":22.767,"pitch":37.171},{"time":22.775,"pitch":36.896},{"time":22.783,"pitch":36.685},{"time":22.792,"pitch":36.524},{"time":22.8,"pitch":36.401},{"time":22.808,"pitch":36.307},{"time":22.817,"pitch":36.235},{"time":22.825,"pitch":36.18},{"time":22.833,"pitch":36.137},{"time":22.842,"pitch":36.105},{"time":22.85,"pitch":36.08},{"time":22.858,"pitch":36.062},{"time":22.867,"pitch":36.047},{"time":22.875,"pitch":36.036},{"time":22.883,"pitch":36.028},{"time":22.892,"pitch":36.021},{"time":22.9,"pitch":36.016},{"time":22.908,"pitch":36.012},{"time":22.917,"pitch":36.009},{"time":22.925,"pitch":36.007},{"time":22.933,"pitch":36.006},{"time":22.942,"pitch":36.004},{"time":22.95,"pitch":36.003},{"time":22.958,"pitch":36.002},{"time":22.975,"pitch":36.001},{"time":23.008,"pitch":36},{"time":23.258,"pitch":35.295},{"time":23.267,"pitch":34.756},{"time":23.275,"pitch":34.344},{"time":23.283,"pitch":34.028},{"time":23.292,"pitch":33.787},{"time":23.3,"pitch":33.602},{"time":23.308,"pitch":33.46},{"time":23.317,"pitch":33.352},{"time":23.325,"pitch":33.27},{"time":23.333,"pitch":33.206},{"time":23.342,"pitch":33.158},{"time":23.35,"pitch":33.121},{"time":23.358,"pitch":33.092},{"time":23.367,"pitch":33.071},{"time":23.375,"pitch":33.054},{"time":23.383,"pitch":33.041},{"time":23.392,"pitch":33.032},{"time":23.4,"pitch":33.024},{"time":23.408,"pitch":33.019},{"time":23.417,"pitch":33.014},{"time":23.425,"pitch":33.011},{"time":23.433,"pitch":33.008},{"time":23.442,"pitch":33.006},{"time":23.45,"pitch":33.005},{"time":23.458,"pitch":33.004},{"time":23.467,"pitch":33.003},{"time":23.475,"pitch":33.002},{"time":23.492,"pitch":33.001},{"time":23.508,"pitch":33.705},{"time":23.517,"pitch":34.244},{"time":23.525,"pitch":34.657},{"time":23.533,"pitch":34.972},{"time":23.542,"pitch":35.214},{"time":23.55,"pitch":35.398},{"time":23.558,"pitch":35.54},{"time":23.567,"pitch":35.648},{"time":23.575,"pitch":35.731},{"time":23.583,"pitch":35.794},{"time":23.592,"pitch":35.842},{"time":23.6,"pitch":35.879},{"time":23.608,"pitch":35.908},{"time":23.617,"pitch":35.929},{"time":23.625,"pitch":35.946},{"time":23.633,"pitch":35.959},{"time":23.642,"pitch":35.968},{"time":23.65,"pitch":35.976},{"time":23.658,"pitch":35.981},{"time":23.667,"pitch":35.986},{"time":23.675,"pitch":35.989},{"time":23.683,"pitch":35.992},{"time":23.692,"pitch":35.994},{"time":23.7,"pitch":35.995},{"time":23.708,"pitch":35.996},{"time":23.717,"pitch":35.997},{"time":23.725,"pitch":35.998},{"time":23.742,"pitch":35.999},{"time":23.775,"pitch":36},{"time":24,"pitch":36.47},{"time":24.008,"pitch":36.829},{"time":24.017,"pitch":37.104},{"time":24.025,"pitch":37.315},{"time":24.033,"pitch":37.476},{"time":24.042,"pitch":37.599},{"time":24.05,"pitch":37.693},{"time":24.058,"pitch":37.765},{"time":24.067,"pitch":37.82},{"time":24.075,"pitch":37.863},{"time":24.083,"pitch":37.895},{"time":24.092,"pitch":37.92},{"time":24.1,"pitch":37.938},{"time":24.108,"pitch":37.953},{"time":24.117,"pitch":37.964},{"time":24.125,"pitch":37.972},{"time":24.133,"pitch":37.979},{"time":24.142,"pitch":37.984},{"time":24.15,"pitch":37.988},{"time":24.158,"pitch":37.991},{"time":24.167,"pitch":37.993},{"time":24.175,"pitch":37.994},{"time":24.183,"pitch":37.996},{"time":24.192,"pitch":37.997},{"time":24.2,"pitch":37.998},{"time":24.217,"pitch":37.999},{"time":24.25,"pitch":38},{"time":24.733,"pitch":38.705},{"time":24.742,"pitch":39.244},{"time":24.75,"pitch":39.656},{"time":24.758,"pitch":39.972},{"time":24.767,"pitch":40.213},{"time":24.775,"pitch":40.398},{"time":24.783,"pitch":40.54},{"time":24.792,"pitch":40.648},{"time":24.8,"pitch":40.73},{"time":24.808,"pitch":40.794},{"time":24.817,"pitch":40.842},{"time":24.825,"pitch":40.879},{"time":24.833,"pitch":40.908},{"time":24.842,"pitch":40.929},{"time":24.85,"pitch":40.946},{"time":24.858,"pitch":40.959},{"time":24.867,"pitch":40.968},{"time":24.875,"pitch":40.976},{"time":24.883,"pitch":40.981},{"time":24.892,"pitch":40.986},{"time":24.9,"pitch":40.989},{"time":24.908,"pitch":40.992},{"time":24.917,"pitch":40.994},{"time":24.925,"pitch":40.995},{"time":24.933,"pitch":40.996},{"time":24.942,"pitch":40.997},{"time":24.95,"pitch":40.998},{"time":24.967,"pitch":40.999},{"time":25,"pitch":41},{"time":25.258,"pitch":40.295},{"time":25.267,"pitch":39.756},{"time":25.275,"pitch":39.344},{"time":25.283,"pitch":39.028},{"time":25.292,"pitch":38.787},{"time":25.3,"pitch":38.602},{"time":25.308,"pitch":38.46},{"time":25.317,"pitch":38.352},{"time":25.325,"pitch":38.27},{"time":25.333,"pitch":38.206},{"time":25.342,"pitch":38.158},{"time":25.35,"pitch":38.121},{"time":25.358,"pitch":38.092},{"time":25.367,"pitch":38.071},{"time":25.375,"pitch":38.054},{"time":25.383,"pitch":38.041},{"time":25.392,"pitch":38.032},{"time":25.4,"pitch":38.024},{"time":25.408,"pitch":38.019},{"time":25.417,"pitch":38.014},{"time":25.425,"pitch":38.011},{"time":25.433,"pitch":38.008},{"time":25.442,"pitch":38.006},{"time":25.45,"pitch":38.005},{"time":25.458,"pitch":38.004},{"time":25.467,"pitch":38.003},{"time":25.475,"pitch":38.002},{"time":25.492,"pitch":38.001},{"time":25.5,"pitch":38.706},{"time":25.508,"pitch":39.245},{"time":25.517,"pitch":39.657},{"time":25.525,"pitch":39.972},{"time":25.533,"pitch":40.214},{"time":25.542,"pitch":40.398},{"time":25.55,"pitch":40.54},{"time":25.558,"pitch":40.648},{"time":25.567,"pitch":40.731},{"time":25.575,"pitch":40.794},{"time":25.583,"pitch":40.842},{"time":25.592,"pitch":40.879},{"time":25.6,"pitch":40.908},{"time":25.608,"pitch":40.929},{"time":25.617,"pitch":40.946},{"time":25.625,"pitch":40.959},{"time":25.633,"pitch":40.968},{"time":25.642,"pitch":40.976},{"time":25.65,"pitch":40.981},{"time":25.658,"pitch":40.986},{"time":25.667,"pitch":40.989},{"time":25.675,"pitch":40.992},{"time":25.683,"pitch":40.994},{"time":25.692,"pitch":40.995},{"time":25.7,"pitch":40.996},{"time":25.708,"pitch":40.997},{"time":25.717,"pitch":40.998},{"time":25.733,"pitch":40.999},{"time":25.767,"pitch":41},{"time":26.008,"pitch":40.295},{"time":26.017,"pitch":39.756},{"time":26.025,"pitch":39.344},{"time":26.033,"pitch":39.028},{"time":26.042,"pitch":38.787},{"time":26.05,"pitch":38.602},{"time":26.058,"pitch":38.46},{"time":26.067,"pitch":38.352},{"time":26.075,"pitch":38.27},{"time":26.083,"pitch":38.206},{"time":26.092,"pitch":38.158},{"time":26.1,"pitch":38.121},{"time":26.108,"pitch":38.092},{"time":26.117,"pitch":38.071},{"time":26.125,"pitch":38.054},{"time":26.133,"pitch":38.041},{"time":26.142,"pitch":38.032},{"time":26.15,"pitch":38.024},{"time":26.158,"pitch":38.019},{"time":26.167,"pitch":38.014},{"time":26.175,"pitch":38.011},{"time":26.183,"pitch":38.008},{"time":26.192,"pitch":38.006},{"time":26.2,"pitch":38.005},{"time":26.208,"pitch":38.004},{"time":26.217,"pitch":38.003},{"time":26.225,"pitch":38.002},{"time":26.242,"pitch":38.001},{"time":26.275,"pitch":38},{"time":26.758,"pitch":37.53},{"time":26.767,"pitch":37.171},{"time":26.775,"pitch":36.896},{"time":26.783,"pitch":36.685},{"time":26.792,"pitch":36.524},{"time":26.8,"pitch":36.401},{"time":26.808,"pitch":36.307},{"time":26.817,"pitch":36.235},{"time":26.825,"pitch":36.18},{"time":26.833,"pitch":36.137},{"time":26.842,"pitch":36.105},{"time":26.85,"pitch":36.08},{"time":26.858,"pitch":36.062},{"time":26.867,"pitch":36.047},{"time":26.875,"pitch":36.036},{"time":26.883,"pitch":36.028},{"time":26.892,"pitch":36.021},{"time":26.9,"pitch":36.016},{"time":26.908,"pitch":36.012},{"time":26.917,"pitch":36.009},{"time":26.925,"pitch":36.007},{"time":26.933,"pitch":36.006},{"time":26.942,"pitch":36.004},{"time":26.95,"pitch":36.003},{"time":26.958,"pitch":36.002},{"time":26.975,"pitch":36.001},{"time":27.008,"pitch":36},{"time":27.258,"pitch":35.295},{"time":27.267,"pitch":34.756},{"time":27.275,"pitch":34.344},{"time":27.283,"pitch":34.028},{"time":27.292,"pitch":33.787},{"time":27.3,"pitch":33.602},{"time":27.308,"pitch":33.46},{"time":27.317,"pitch":33.352},{"time":27.325,"pitch":33.27},{"time":27.333,"pitch":33.206},{"time":27.342,"pitch":33.158},{"time":27.35,"pitch":33.121},{"time":27.358,"pitch":33.092},{"time":27.367,"pitch":33.071},{"time":27.375,"pitch":33.054},{"time":27.383,"pitch":33.041},{"time":27.392,"pitch":33.032},{"time":27.4,"pitch":33.024},{"time":27.408,"pitch":33.019},{"time":27.417,"pitch":33.014},{"time":27.425,"pitch":33.011},{"time":27.433,"pitch":33.008},{"time":27.442,"pitch":33.006},{"time":27.45,"pitch":33.005},{"time":27.458,"pitch":33.004},{"time":27.467,"pitch":33.003},{"time":27.475,"pitch":33.002},{"time":27.492,"pitch":33.001},{"time":27.508,"pitch":33.705},{"time":27.517,"pitch":34.244},{"time":27.525,"pitch":34.657},{"time":27.533,"pitch":34.972},{"time":27.542,"pitch":35.214},{"time":27.55,"pitch":35.398},{"time":27.558,"pitch":35.54},{"time":27.567,"pitch":35.648},{"time":27.575,"pitch":35.731},{"time":27.583,"pitch":35.794},{"time":27.592,"pitch":35.842},{"time":27.6,"pitch":35.879},{"time":27.608,"pitch":35.908},{"time":27.617,"pitch":35.929},{"time":27.625,"pitch":35.946},{"time":27.633,"pitch":35.959},{"time":27.642,"pitch":35.968},{"time":27.65,"pitch":35.976},{"time":27.658,"pitch":35.981},{"time":27.667,"pitch":35.986},{"time":27.675,"pitch":35.989},{"time":27.683,"pitch":35.992},{"time":27.692,"pitch":35.994},{"time":27.7,"pitch":35.995},{"time":27.708,"pitch":35.996},{"time":27.717,"pitch":35.997},{"time":27.725,"pitch":35.998},{"time":27.742,"pitch":35.999},{"time":27.775,"pitch":36},{"time":28,"pitch":36.47},{"time":28.008,"pitch":36.829},{"time":28.017,"pitch":37.104},{"time":28.025,"pitch":37.315},{"time":28.033,"pitch":37.476},{"time":28.042,"pitch":37.599},{"time":28.05,"pitch":37.693},{"time":28.058,"pitch":37.765},{"time":28.067,"pitch":37.82},{"time":28.075,"pitch":37.863},{"time":28.083,"pitch":37.895},{"time":28.092,"pitch":37.92},{"time":28.1,"pitch":37.938},{"time":28.108,"pitch":37.953},{"time":28.117,"pitch":37.964},{"time":28.125,"pitch":37.972},{"time":28.133,"pitch":37.979},{"time":28.142,"pitch":37.984},{"time":28.15,"pitch":37.988},{"time":28.158,"pitch":37.991},{"time":28.167,"pitch":37.993},{"time":28.175,"pitch":37.994},{"time":28.183,"pitch":37.996},{"time":28.192,"pitch":37.997},{"time":28.2,"pitch":37.998},{"time":28.217,"pitch":37.999},{"time":28.25,"pitch":38},{"time":28.733,"pitch":38.705},{"time":28.742,"pitch":39.244},{"time":28.75,"pitch":39.656},{"time":28.758,"pitch":39.972},{"time":28.767,"pitch":40.213},{"time":28.775,"pitch":40.398},{"time":28.783,"pitch":40.54},{"time":28.792,"pitch":40.648},{"time":28.8,"pitch":40.73},{"time":28.808,"pitch":40.794},{"time":28.817,"pitch":40.842},{"time":28.825,"pitch":40.879},{"time":28.833,"pitch":40.908},{"time":28.842,"pitch":40.929},{"time":28.85,"pitch":40.946},{"time":28.858,"pitch":40.959},{"time":28.867,"pitch":40.968},{"time":28.875,"pitch":40.976},{"time":28.883,"pitch":40.981},{"time":28.892,"pitch":40.986},{"time":28.9,"pitch":40.989},{"time":28.908,"pitch":40.992},{"time":28.917,"pitch":40.994},{"time":28.925,"pitch":40.995},{"time":28.933,"pitch":40.996},{"time":28.942,"pitch":40.997},{"time":28.95,"pitch":40.998},{"time":28.967,"pitch":40.999},{"time":29,"pitch":41},{"time":29.225,"pitch":41.705},{"time":29.233,"pitch":42.244},{"time":29.242,"pitch":42.656},{"time":29.25,"pitch":42.972},{"time":29.258,"pitch":43.213},{"time":29.267,"pitch":43.398},{"time":29.275,"pitch":43.54},{"time":29.283,"pitch":43.648},{"time":29.292,"pitch":43.73},{"time":29.3,"pitch":43.794},{"time":29.308,"pitch":43.842},{"time":29.317,"pitch":43.879},{"time":29.325,"pitch":43.908},{"time":29.333,"pitch":43.929},{"time":29.342,"pitch":43.946},{"time":29.35,"pitch":43.959},{"time":29.358,"pitch":43.968},{"time":29.367,"pitch":43.976},{"time":29.375,"pitch":43.981},{"time":29.383,"pitch":43.986},{"time":29.392,"pitch":43.989},{"time":29.4,"pitch":43.992},{"time":29.408,"pitch":43.994},{"time":29.417,"pitch":43.995},{"time":29.425,"pitch":43.996},{"time":29.433,"pitch":43.997},{"time":29.442,"pitch":43.998},{"time":29.458,"pitch":43.999},{"time":29.492,"pitch":44},{"time":29.525,"pitch":43.765},{"time":29.533,"pitch":43.585},{"time":29.542,"pitch":43.448},{"time":29.55,"pitch":43.343},{"time":29.558,"pitch":43.262},{"time":29.567,"pitch":43.201},{"time":29.575,"pitch":43.153},{"time":29.583,"pitch":43.117},{"time":29.592,"pitch":43.09},{"time":29.6,"pitch":43.069},{"time":29.608,"pitch":43.053},{"time":29.617,"pitch":43.04},{"time":29.625,"pitch":43.031},{"time":29.633,"pitch":43.024},{"time":29.642,"pitch":43.018},{"time":29.65,"pitch":43.014},{"time":29.658,"pitch":43.011},{"time":29.667,"pitch":43.008},{"time":29.675,"pitch":43.006},{"time":29.683,"pitch":43.005},{"time":29.692,"pitch":43.004},{"time":29.7,"pitch":43.003},{"time":29.708,"pitch":43.002},{"time":29.725,"pitch":43.001},{"time":29.758,"pitch":43},{"time":30,"pitch":42.53},{"time":30.008,"pitch":42.171},{"time":30.017,"pitch":41.896},{"time":30.025,"pitch":41.685},{"time":30.033,"pitch":41.524},{"time":30.042,"pitch":41.401},{"time":30.05,"pitch":41.307},{"time":30.058,"pitch":41.235},{"time":30.067,"pitch":41.18},{"time":30.075,"pitch":41.137},{"time":30.083,"pitch":41.105},{"time":30.092,"pitch":41.08},{"time":30.1,"pitch":41.062},{"time":30.108,"pitch":41.047},{"time":30.117,"pitch":41.036},{"time":30.125,"pitch":41.028},{"time":30.133,"pitch":41.021},{"time":30.142,"pitch":41.016},{"time":30.15,"pitch":41.012},{"time":30.158,"pitch":41.009},{"time":30.167,"pitch":41.007},{"time":30.175,"pitch":41.006},{"time":30.183,"pitch":41.004},{"time":30.192,"pitch":41.003},{"time":30.2,"pitch":41.002},{"time":30.217,"pitch":41.001},{"time":30.25,"pitch":41},{"time":30.758,"pitch":40.295},{"time":30.767,"pitch":39.756},{"time":30.775,"pitch":39.344},{"time":30.783,"pitch":39.028},{"time":30.792,"pitch":38.787},{"time":30.8,"pitch":38.602},{"time":30.808,"pitch":38.46},{"time":30.817,"pitch":38.352},{"time":30.825,"pitch":38.27},{"time":30.833,"pitch":38.206},{"time":30.842,"pitch":38.158},{"time":30.85,"pitch":38.121},{"time":30.858,"pitch":38.092},{"time":30.867,"pitch":38.071},{"time":30.875,"pitch":38.054},{"time":30.883,"pitch":38.041},{"time":30.892,"pitch":38.032},{"time":30.9,"pitch":38.024},{"time":30.908,"pitch":38.019},{"time":30.917,"pitch":38.014},{"time":30.925,"pitch":38.011},{"time":30.933,"pitch":38.008},{"time":30.942,"pitch":38.006},{"time":30.95,"pitch":38.005},{"time":30.958,"pitch":38.004},{"time":30.967,"pitch":38.003},{"time":30.975,"pitch":38.002},{"time":30.992,"pitch":38.001},{"time":31.025,"pitch":38},{"time":31.208,"pitch":36.826},{"time":31.217,"pitch":35.927},{"time":31.225,"pitch":35.239},{"time":31.233,"pitch":34.713},{"time":31.242,"pitch":34.311},{"time":31.25,"pitch":34.003},{"time":31.258,"pitch":33.767},{"time":31.267,"pitch":33.587},{"time":31.275,"pitch":33.449},{"time":31.283,"pitch":33.344},{"time":31.292,"pitch":33.263},{"time":31.3,"pitch":33.201},{"time":31.308,"pitch":33.154},{"time":31.317,"pitch":33.118},{"time":31.325,"pitch":33.09},{"time":31.333,"pitch":33.069},{"time":31.342,"pitch":33.053},{"time":31.35,"pitch":33.04},{"time":31.358,"pitch":33.031},{"time":31.367,"pitch":33.024},{"time":31.375,"pitch":33.018},{"time":31.383,"pitch":33.014},{"time":31.392,"pitch":33.011},{"time":31.4,"pitch":33.008},{"time":31.408,"pitch":33.006},{"time":31.417,"pitch":33.005},{"time":31.425,"pitch":33.004},{"time":31.433,"pitch":33.003},{"time":31.442,"pitch":33.002},{"time":31.458,"pitch":33.001},{"time":31.492,"pitch":33},{"time":31.508,"pitch":33.705},{"time":31.517,"pitch":34.244},{"time":31.525,"pitch":34.657},{"time":31.533,"pitch":34.972},{"time":31.542,"pitch":35.214},{"time":31.55,"pitch":35.398},{"time":31.558,"pitch":35.54},{"time":31.567,"pitch":35.648},{"time":31.575,"pitch":35.73},{"time":31.583,"pitch":35.794},{"time":31.592,"pitch":35.842},{"time":31.6,"pitch":35.879},{"time":31.608,"pitch":35.908},{"time":31.617,"pitch":35.929},{"time":31.625,"pitch":35.946},{"time":31.633,"pitch":35.959},{"time":31.642,"pitch":35.968},{"time":31.65,"pitch":35.976},{"time":31.658,"pitch":35.981},{"time":31.667,"pitch":35.986},{"time":31.675,"pitch":35.989},{"time":31.683,"pitch":35.992},{"time":31.692,"pitch":35.994},{"time":31.7,"pitch":35.995},{"time":31.708,"pitch":35.996},{"time":31.717,"pitch":35.997},{"time":31.725,"pitch":35.998},{"time":31.742,"pitch":35.999},{"time":31.775,"pitch":36},{"time":32,"pitch":36.47},{"time":32.008,"pitch":36.829},{"time":32.017,"pitch":37.104},{"time":32.025,"pitch":37.315},{"time":32.033,"pitch":37.476},{"time":32.042,"pitch":37.599},{"time":32.05,"pitch":37.693},{"time":32.058,"pitch":37.765},{"time":32.067,"pitch":37.82},{"time":32.075,"pitch":37.863},{"time":32.083,"pitch":37.895},{"time":32.092,"pitch":37.92},{"time":32.1,"pitch":37.938},{"time":32.108,"pitch":37.953},{"time":32.117,"pitch":37.964},{"time":32.125,"pitch":37.972},{"time":32.133,"pitch":37.979},{"time":32.142,"pitch":37.984},{"time":32.15,"pitch":37.988},{"time":32.158,"pitch":37.991},{"time":32.167,"pitch":37.993},{"time":32.175,"pitch":37.994},{"time":32.183,"pitch":37.996},{"time":32.192,"pitch":37.997},{"time":32.2,"pitch":37.998},{"time":32.217,"pitch":37.999},{"time":32.25,"pitch":38},{"time":32.733,"pitch":38.705},{"time":32.742,"pitch":39.244},{"time":32.75,"pitch":39.656},{"time":32.758,"pitch":39.972},{"time":32.767,"pitch":40.213},{"time":32.775,"pitch":40.398},{"time":32.783,"pitch":40.54},{"time":32.792,"pitch":40.648},{"time":32.8,"pitch":40.73},{"time":32.808,"pitch":40.794},{"time":32.817,"pitch":40.842},{"time":32.825,"pitch":40.879},{"time":32.833,"pitch":40.908},{"time":32.842,"pitch":40.929},{"time":32.85,"pitch":40.946},{"time":32.858,"pitch":40.959},{"time":32.867,"pitch":40.968},{"time":32.875,"pitch":40.976},{"time":32.883,"pitch":40.981},{"time":32.892,"pitch":40.986},{"time":32.9,"pitch":40.989},{"time":32.908,"pitch":40.992},{"time":32.917,"pitch":40.994},{"time":32.925,"pitch":40.995},{"time":32.933,"pitch":40.996},{"time":32.942,"pitch":40.997},{"time":32.95,"pitch":40.998},{"time":32.967,"pitch":40.999},{"time":33,"pitch":41},{"time":33.258,"pitch":40.295},{"time":33.267,"pitch":39.756},{"time":33.275,"pitch":39.344},{"time":33.283,"pitch":39.028},{"time":33.292,"pitch":38.787},{"time":33.3,"pitch":38.602},{"time":33.308,"pitch":38.46},{"time":33.317,"pitch":38.352},{"time":33.325,"pitch":38.27},{"time":33.333,"pitch":38.206},{"time":33.342,"pitch":38.158},{"time":33.35,"pitch":38.121},{"time":33.358,"pitch":38.092},{"time":33.367,"pitch":38.071},{"time":33.375,"pitch":38.054},{"time":33.383,"pitch":38.041},{"time":33.392,"pitch":38.032},{"time":33.4,"pitch":38.024},{"time":33.408,"pitch":38.019},{"time":33.417,"pitch":38.014},{"time":33.425,"pitch":38.011},{"time":33.433,"pitch":38.008},{"time":33.442,"pitch":38.006},{"time":33.45,"pitch":38.005},{"time":33.458,"pitch":38.004},{"time":33.467,"pitch":38.003},{"time":33.475,"pitch":38.002},{"time":33.492,"pitch":38.001},{"time":33.5,"pitch":38.706},{"time":33.508,"pitch":39.245},{"time":33.517,"pitch":39.657},{"time":33.525,"pitch":39.972},{"time":33.533,"pitch":40.214},{"time":33.542,"pitch":40.398},{"time":33.55,"pitch":40.54},{"time":33.558,"pitch":40.648},{"time":33.567,"pitch":40.731},{"time":33.575,"pitch":40.794},{"time":33.583,"pitch":40.842},{"time":33.592,"pitch":40.879},{"time":33.6,"pitch":40.908},{"time":33.608,"pitch":40.929},{"time":33.617,"pitch":40.946},{"time":33.625,"pitch":40.959},{"time":33.633,"pitch":40.968},{"time":33.642,"pitch":40.976},{"time":33.65,"pitch":40.981},{"time":33.658,"pitch":40.986},{"time":33.667,"pitch":40.989},{"time":33.675,"pitch":40.992},{"time":33.683,"pitch":40.994},{"time":33.692,"pitch":40.995},{"time":33.7,"pitch":40.996},{"time":33.708,"pitch":40.997},{"time":33.717,"pitch":40.998},{"time":33.733,"pitch":40.999},{"time":33.767,"pitch":41},{"time":34.008,"pitch":40.295},{"time":34.017,"pitch":39.756},{"time":34.025,"pitch":39.344},{"time":34.033,"pitch":39.028},{"time":34.042,"pitch":38.787},{"time":34.05,"pitch":38.602},{"time":34.058,"pitch":38.46},{"time":34.067,"pitch":38.352},{"time":34.075,"pitch":38.27},{"time":34.083,"pitch":38.206},{"time":34.092,"pitch":38.158},{"time":34.1,"pitch":38.121},{"time":34.108,"pitch":38.092},{"time":34.117,"pitch":38.071},{"time":34.125,"pitch":38.054},{"time":34.133,"pitch":38.041},{"time":34.142,"pitch":38.032},{"time":34.15,"pitch":38.024},{"time":34.158,"pitch":38.019},{"time":34.167,"pitch":38.014},{"time":34.175,"pitch":38.011},{"time":34.183,"pitch":38.008},{"time":34.192,"pitch":38.006},{"time":34.2,"pitch":38.005},{"time":34.208,"pitch":38.004},{"time":34.217,"pitch":38.003},{"time":34.225,"pitch":38.002},{"time":34.242,"pitch":38.001},{"time":34.275,"pitch":38},{"time":34.758,"pitch":37.53},{"time":34.767,"pitch":37.171},{"time":34.775,"pitch":36.896},{"time":34.783,"pitch":36.685},{"time":34.792,"pitch":36.524},{"time":34.8,"pitch":36.401},{"time":34.808,"pitch":36.307},{"time":34.817,"pitch":36.235},{"time":34.825,"pitch":36.18},{"time":34.833,"pitch":36.137},{"time":34.842,"pitch":36.105},{"time":34.85,"pitch":36.08},{"time":34.858,"pitch":36.062},{"time":34.867,"pitch":36.047},{"time":34.875,"pitch":36.036},{"time":34.883,"pitch":36.028},{"time":34.892,"pitch":36.021},{"time":34.9,"pitch":36.016},{"time":34.908,"pitch":36.012},{"time":34.917,"pitch":36.009},{"time":34.925,"pitch":36.007},{"time":34.933,"pitch":36.006},{"time":34.942,"pitch":36.004},{"time":34.95,"pitch":36.003},{"time":34.958,"pitch":36.002},{"time":34.975,"pitch":36.001},{"time":35.008,"pitch":36},{"time":35.258,"pitch":35.295},{"time":35.267,"pitch":34.756},{"time":35.275,"pitch":34.344},{"time":35.283,"pitch":34.028},{"time":35.292,"pitch":33.787},{"time":35.3,"pitch":33.602},{"time":35.308,"pitch":33.46},{"time":35.317,"pitch":33.352},{"time":35.325,"pitch":33.27},{"time":35.333,"pitch":33.206},{"time":35.342,"pitch":33.158},{"time":35.35,"pitch":33.121},{"time":35.358,"pitch":33.092},{"time":35.367,"pitch":33.071},{"time":35.375,"pitch":33.054},{"time":35.383,"pitch":33.041},{"time":35.392,"pitch":33.032},{"time":35.4,"pitch":33.024},{"time":35.408,"pitch":33.019},{"time":35.417,"pitch":33.014},{"time":35.425,"pitch":33.011},{"time":35.433,"pitch":33.008},{"time":35.442,"pitch":33.006},{"time":35.45,"pitch":33.005},{"time":35.458,"pitch":33.004},{"time":35.467,"pitch":33.003},{"time":35.475,"pitch":33.002},{"time":35.492,"pitch":33.001},{"time":35.508,"pitch":33.705},{"time":35.517,"pitch":34.244},{"time":35.525,"pitch":34.657},{"time":35.533,"pitch":34.972},{"time":35.542,"pitch":35.214},{"time":35.55,"pitch":35.398},{"time":35.558,"pitch":35.54},{"time":35.567,"pitch":35.648},{"time":35.575,"pitch":35.731},{"time":35.583,"pitch":35.794},{"time":35.592,"pitch":35.842},{"time":35.6,"pitch":35.879},{"time":35.608,"pitch":35.908},{"time":35.617,"pitch":35.929},{"time":35.625,"pitch":35.946},{"time":35.633,"pitch":35.959},{"time":35.642,"pitch":35.968},{"time":35.65,"pitch":35.976},{"time":35.658,"pitch":35.981},{"time":35.667,"pitch":35.986},{"time":35.675,"pitch":35.989},{"time":35.683,"pitch":35.992},{"time":35.692,"pitch":35.994},{"time":35.7,"pitch":35.995},{"time":35.708,"pitch":35.996},{"time":35.717,"pitch":35.997},{"time":35.725,"pitch":35.998},{"time":35.742,"pitch":35.999},{"time":35.775,"pitch":36},{"time":36,"pitch":36.47},{"time":36.008,"pitch":36.829},{"time":36.017,"pitch":37.104},{"time":36.025,"pitch":37.315},{"time":36.033,"pitch":37.476},{"time":36.042,"pitch":37.599},{"time":36.05,"pitch":37.693},{"time":36.058,"pitch":37.765},{"time":36.067,"pitch":37.82},{"time":36.075,"pitch":37.863},{"time":36.083,"pitch":37.895},{"time":36.092,"pitch":37.92},{"time":36.1,"pitch":37.938},{"time":36.108,"pitch":37.953},{"time":36.117,"pitch":37.964},{"time":36.125,"pitch":37.972},{"time":36.133,"pitch":37.979},{"time":36.142,"pitch":37.984},{"time":36.15,"pitch":37.988},{"time":36.158,"pitch":37.991},{"time":36.167,"pitch":37.993},{"time":36.175,"pitch":37.994},{"time":36.183,"pitch":37.996},{"time":36.192,"pitch":37.997},{"time":36.2,"pitch":37.998},{"time":36.217,"pitch":37.999},{"time":36.25,"pitch":38},{"time":36.733,"pitch":38.705},{"time":36.742,"pitch":39.244},{"time":36.75,"pitch":39.656},{"time":36.758,"pitch":39.972},{"time":36.767,"pitch":40.213},{"time":36.775,"pitch":40.398},{"time":36.783,"pitch":40.54},{"time":36.792,"pitch":40.648},{"time":36.8,"pitch":40.73},{"time":36.808,"pitch":40.794},{"time":36.817,"pitch":40.842},{"time":36.825,"pitch":40.879},{"time":36.833,"pitch":40.908},{"time":36.842,"pitch":40.929},{"time":36.85,"pitch":40.946},{"time":36.858,"pitch":40.959},{"time":36.867,"pitch":40.968},{"time":36.875,"pitch":40.976},{"time":36.883,"pitch":40.981},{"time":36.892,"pitch":40.986},{"time":36.9,"pitch":40.989},{"time":36.908,"pitch":40.992},{"time":36.917,"pitch":40.994},{"time":36.925,"pitch":40.995},{"time":36.933,"pitch":40.996},{"time":36.942,"pitch":40.997},{"time":36.95,"pitch":40.998},{"time":36.967,"pitch":40.999},{"time":37,"pitch":41},{"time":37.258,"pitch":40.295},{"time":37.267,"pitch":39.756},{"time":37.275,"pitch":39.344},{"time":37.283,"pitch":39.028},{"time":37.292,"pitch":38.787},{"time":37.3,"pitch":38.602},{"time":37.308,"pitch":38.46},{"time":37.317,"pitch":38.352},{"time":37.325,"pitch":38.27},{"time":37.333,"pitch":38.206},{"time":37.342,"pitch":38.158},{"time":37.35,"pitch":38.121},{"time":37.358,"pitch":38.092},{"time":37.367,"pitch":38.071},{"time":37.375,"pitch":38.054},{"time":37.383,"pitch":38.041},{"time":37.392,"pitch":38.032},{"time":37.4,"pitch":38.024},{"time":37.408,"pitch":38.019},{"time":37.417,"pitch":38.014},{"time":37.425,"pitch":38.011},{"time":37.433,"pitch":38.008},{"time":37.442,"pitch":38.006},{"time":37.45,"pitch":38.005},{"time":37.458,"pitch":38.004},{"time":37.467,"pitch":38.003},{"time":37.475,"pitch":38.002},{"time":37.492,"pitch":38.001},{"time":37.5,"pitch":38.706},{"time":37.508,"pitch":39.245},{"time":37.517,"pitch":39.657},{"time":37.525,"pitch":39.972},{"time":37.533,"pitch":40.214},{"time":37.542,"pitch":40.398},{"time":37.55,"pitch":40.54},{"time":37.558,"pitch":40.648},{"time":37.567,"pitch":40.731},{"time":37.575,"pitch":40.794},{"time":37.583,"pitch":40.842},{"time":37.592,"pitch":40.879},{"time":37.6,"pitch":40.908},{"time":37.608,"pitch":40.929},{"time":37.617,"pitch":40.946},{"time":37.625,"pitch":40.959},{"time":37.633,"pitch":40.968},{"time":37.642,"pitch":40.976},{"time":37.65,"pitch":40.981},{"time":37.658,"pitch":40.986},{"time":37.667,"pitch":40.989},{"time":37.675,"pitch":40.992},{"time":37.683,"pitch":40.994},{"time":37.692,"pitch":40.995},{"time":37.7,"pitch":40.996},{"time":37.708,"pitch":40.997},{"time":37.717,"pitch":40.998},{"time":37.733,"pitch":40.999},{"time":37.767,"pitch":41},{"time":38.008,"pitch":40.295},{"time":38.017,"pitch":39.756},{"time":38.025,"pitch":39.344},{"time":38.033,"pitch":39.028},{"time":38.042,"pitch":38.787},{"time":38.05,"pitch":38.602},{"time":38.058,"pitch":38.46},{"time":38.067,"pitch":38.352},{"time":38.075,"pitch":38.27},{"time":38.083,"pitch":38.206},{"time":38.092,"pitch":38.158},{"time":38.1,"pitch":38.121},{"time":38.108,"pitch":38.092},{"time":38.117,"pitch":38.071},{"time":38.125,"pitch":38.054},{"time":38.133,"pitch":38.041},{"time":38.142,"pitch":38.032},{"time":38.15,"pitch":38.024},{"time":38.158,"pitch":38.019},{"time":38.167,"pitch":38.014},{"time":38.175,"pitch":38.011},{"time":38.183,"pitch":38.008},{"time":38.192,"pitch":38.006},{"time":38.2,"pitch":38.005},{"time":38.208,"pitch":38.004},{"time":38.217,"pitch":38.003},{"time":38.225,"pitch":38.002},{"time":38.242,"pitch":38.001},{"time":38.275,"pitch":38},{"time":38.758,"pitch":37.53},{"time":38.767,"pitch":37.171},{"time":38.775,"pitch":36.896},{"time":38.783,"pitch":36.685},{"time":38.792,"pitch":36.524},{"time":38.8,"pitch":36.401},{"time":38.808,"pitch":36.307},{"time":38.817,"pitch":36.235},{"time":38.825,"pitch":36.18},{"time":38.833,"pitch":36.137},{"time":38.842,"pitch":36.105},{"time":38.85,"pitch":36.08},{"time":38.858,"pitch":36.062},{"time":38.867,"pitch":36.047},{"time":38.875,"pitch":36.036},{"time":38.883,"pitch":36.028},{"time":38.892,"pitch":36.021},{"time":38.9,"pitch":36.016},{"time":38.908,"pitch":36.012},{"time":38.917,"pitch":36.009},{"time":38.925,"pitch":36.007},{"time":38.933,"pitch":36.006},{"time":38.942,"pitch":36.004},{"time":38.95,"pitch":36.003},{"time":38.958,"pitch":36.002},{"time":38.975,"pitch":36.001},{"time":39.008,"pitch":36},{"time":39.258,"pitch":35.295},{"time":39.267,"pitch":34.756},{"time":39.275,"pitch":34.344},{"time":39.283,"pitch":34.028},{"time":39.292,"pitch":33.787},{"time":39.3,"pitch":33.602},{"time":39.308,"pitch":33.46},{"time":39.317,"pitch":33.352},{"time":39.325,"pitch":33.27},{"time":39.333,"pitch":33.206},{"time":39.342,"pitch":33.158},{"time":39.35,"pitch":33.121},{"time":39.358,"pitch":33.092},{"time":39.367,"pitch":33.071},{"time":39.375,"pitch":33.054},{"time":39.383,"pitch":33.041},{"time":39.392,"pitch":33.032},{"time":39.4,"pitch":33.024},{"time":39.408,"pitch":33.019},{"time":39.417,"pitch":33.014},{"time":39.425,"pitch":33.011},{"time":39.433,"pitch":33.008},{"time":39.442,"pitch":33.006},{"time":39.45,"pitch":33.005},{"time":39.458,"pitch":33.004},{"time":39.467,"pitch":33.003},{"time":39.475,"pitch":33.002},{"time":39.492,"pitch":33.001},{"time":39.508,"pitch":33.705},{"time":39.517,"pitch":34.244},{"time":39.525,"pitch":34.657},{"time":39.533,"pitch":34.972},{"time":39.542,"pitch":35.214},{"time":39.55,"pitch":35.398},{"time":39.558,"pitch":35.54},{"time":39.567,"pitch":35.648},{"time":39.575,"pitch":35.731},{"time":39.583,"pitch":35.794},{"time":39.592,"pitch":35.842},{"time":39.6,"pitch":35.879},{"time":39.608,"pitch":35.908},{"time":39.617,"pitch":35.929},{"time":39.625,"pitch":35.946},{"time":39.633,"pitch":35.959},{"time":39.642,"pitch":35.968},{"time":39.65,"pitch":35.976},{"time":39.658,"pitch":35.981},{"time":39.667,"pitch":35.986},{"time":39.675,"pitch":35.989},{"time":39.683,"pitch":35.992},{"time":39.692,"pitch":35.994},{"time":39.7,"pitch":35.995},{"time":39.708,"pitch":35.996},{"time":39.717,"pitch":35.997},{"time":39.725,"pitch":35.998},{"time":39.742,"pitch":35.999},{"time":39.775,"pitch":36},{"time":40,"pitch":36.47},{"time":40.008,"pitch":36.829},{"time":40.017,"pitch":37.104},{"time":40.025,"pitch":37.315},{"time":40.033,"pitch":37.476},{"time":40.042,"pitch":37.599},{"time":40.05,"pitch":37.693},{"time":40.058,"pitch":37.765},{"time":40.067,"pitch":37.82},{"time":40.075,"pitch":37.863},{"time":40.083,"pitch":37.895},{"time":40.092,"pitch":37.92},{"time":40.1,"pitch":37.938},{"time":40.108,"pitch":37.953},{"time":40.117,"pitch":37.964},{"time":40.125,"pitch":37.972},{"time":40.133,"pitch":37.979},{"time":40.142,"pitch":37.984},{"time":40.15,"pitch":37.988},{"time":40.158,"pitch":37.991},{"time":40.167,"pitch":37.993},{"time":40.175,"pitch":37.994},{"time":40.183,"pitch":37.996},{"time":40.192,"pitch":37.997},{"time":40.2,"pitch":37.998},{"time":40.217,"pitch":37.999},{"time":40.25,"pitch":38},{"time":40.733,"pitch":38.705},{"time":40.742,"pitch":39.244},{"time":40.75,"pitch":39.656},{"time":40.758,"pitch":39.972},{"time":40.767,"pitch":40.213},{"time":40.775,"pitch":40.398},{"time":40.783,"pitch":40.54},{"time":40.792,"pitch":40.648},{"time":40.8,"pitch":40.73},{"time":40.808,"pitch":40.794},{"time":40.817,"pitch":40.842},{"time":40.825,"pitch":40.879},{"time":40.833,"pitch":40.908},{"time":40.842,"pitch":40.929},{"time":40.85,"pitch":40.946},{"time":40.858,"pitch":40.959},{"time":40.867,"pitch":40.968},{"time":40.875,"pitch":40.976},{"time":40.883,"pitch":40.981},{"time":40.892,"pitch":40.986},{"time":40.9,"pitch":40.989},{"time":40.908,"pitch":40.992},{"time":40.917,"pitch":40.994},{"time":40.925,"pitch":40.995},{"time":40.933,"pitch":40.996},{"time":40.942,"pitch":40.997},{"time":40.95,"pitch":40.998},{"time":40.967,"pitch":40.999},{"time":41,"pitch":41},{"time":41.258,"pitch":40.295},{"time":41.267,"pitch":39.756},{"time":41.275,"pitch":39.344},{"time":41.283,"pitch":39.028},{"time":41.292,"pitch":38.787},{"time":41.3,"pitch":38.602},{"time":41.308,"pitch":38.46},{"time":41.317,"pitch":38.352},{"time":41.325,"pitch":38.27},{"time":41.333,"pitch":38.206},{"time":41.342,"pitch":38.158},{"time":41.35,"pitch":38.121},{"time":41.358,"pitch":38.092},{"time":41.367,"pitch":38.071},{"time":41.375,"pitch":38.054},{"time":41.383,"pitch":38.041},{"time":41.392,"pitch":38.032},{"time":41.4,"pitch":38.024},{"time":41.408,"pitch":38.019},{"time":41.417,"pitch":38.014},{"time":41.425,"pitch":38.011},{"time":41.433,"pitch":38.008},{"time":41.442,"pitch":38.006},{"time":41.45,"pitch":38.005},{"time":41.458,"pitch":38.004},{"time":41.467,"pitch":38.003},{"time":41.475,"pitch":38.002},{"time":41.492,"pitch":38.001},{"time":41.5,"pitch":38.706},{"time":41.508,"pitch":39.245},{"time":41.517,"pitch":39.657},{"time":41.525,"pitch":39.972},{"time":41.533,"pitch":40.214},{"time":41.542,"pitch":40.398},{"time":41.55,"pitch":40.54},{"time":41.558,"pitch":40.648},{"time":41.567,"pitch":40.731},{"time":41.575,"pitch":40.794},{"time":41.583,"pitch":40.842},{"time":41.592,"pitch":40.879},{"time":41.6,"pitch":40.908},{"time":41.608,"pitch":40.929},{"time":41.617,"pitch":40.946},{"time":41.625,"pitch":40.959},{"time":41.633,"pitch":40.968},{"time":41.642,"pitch":40.976},{"time":41.65,"pitch":40.981},{"time":41.658,"pitch":40.986},{"time":41.667,"pitch":40.989},{"time":41.675,"pitch":40.992},{"time":41.683,"pitch":40.994},{"time":41.692,"pitch":40.995},{"time":41.7,"pitch":40.996},{"time":41.708,"pitch":40.997},{"time":41.717,"pitch":40.998},{"time":41.733,"pitch":40.999},{"time":41.767,"pitch":41},{"time":42.008,"pitch":40.295},{"time":42.017,"pitch":39.756},{"time":42.025,"pitch":39.344},{"time":42.033,"pitch":39.028},{"time":42.042,"pitch":38.787},{"time":42.05,"pitch":38.602},{"time":42.058,"pitch":38.46},{"time":42.067,"pitch":38.352},{"time":42.075,"pitch":38.27},{"time":42.083,"pitch":38.206},{"time":42.092,"pitch":38.158},{"time":42.1,"pitch":38.121},{"time":42.108,"pitch":38.092},{"time":42.117,"pitch":38.071},{"time":42.125,"pitch":38.054},{"time":42.133,"pitch":38.041},{"time":42.142,"pitch":38.032},{"time":42.15,"pitch":38.024},{"time":42.158,"pitch":38.019},{"time":42.167,"pitch":38.014},{"time":42.175,"pitch":38.011},{"time":42.183,"pitch":38.008},{"time":42.192,"pitch":38.006},{"time":42.2,"pitch":38.005},{"time":42.208,"pitch":38.004},{"time":42.217,"pitch":38.003},{"time":42.225,"pitch":38.002},{"time":42.242,"pitch":38.001},{"time":42.275,"pitch":38},{"time":42.758,"pitch":37.53},{"time":42.767,"pitch":37.171},{"time":42.775,"pitch":36.896},{"time":42.783,"pitch":36.685},{"time":42.792,"pitch":36.524},{"time":42.8,"pitch":36.401},{"time":42.808,"pitch":36.307},{"time":42.817,"pitch":36.235},{"time":42.825,"pitch":36.18},{"time":42.833,"pitch":36.137},{"time":42.842,"pitch":36.105},{"time":42.85,"pitch":36.08},{"time":42.858,"pitch":36.062},{"time":42.867,"pitch":36.047},{"time":42.875,"pitch":36.036},{"time":42.883,"pitch":36.028},{"time":42.892,"pitch":36.021},{"time":42.9,"pitch":36.016},{"time":42.908,"pitch":36.012},{"time":42.917,"pitch":36.009},{"time":42.925,"pitch":36.007},{"time":42.933,"pitch":36.006},{"time":42.942,"pitch":36.004},{"time":42.95,"pitch":36.003},{"time":42.958,"pitch":36.002},{"time":42.975,"pitch":36.001},{"time":43.008,"pitch":36},{"time":43.258,"pitch":35.295},{"time":43.267,"pitch":34.756},{"time":43.275,"pitch":34.344},{"time":43.283,"pitch":34.028},{"time":43.292,"pitch":33.787},{"time":43.3,"pitch":33.602},{"time":43.308,"pitch":33.46},{"time":43.317,"pitch":33.352},{"time":43.325,"pitch":33.27},{"time":43.333,"pitch":33.206},{"time":43.342,"pitch":33.158},{"time":43.35,"pitch":33.121},{"time":43.358,"pitch":33.092},{"time":43.367,"pitch":33.071},{"time":43.375,"pitch":33.054},{"time":43.383,"pitch":33.041},{"time":43.392,"pitch":33.032},{"time":43.4,"pitch":33.024},{"time":43.408,"pitch":33.019},{"time":43.417,"pitch":33.014},{"time":43.425,"pitch":33.011},{"time":43.433,"pitch":33.008},{"time":43.442,"pitch":33.006},{"time":43.45,"pitch":33.005},{"time":43.458,"pitch":33.004},{"time":43.467,"pitch":33.003},{"time":43.475,"pitch":33.002},{"time":43.492,"pitch":33.001},{"time":43.508,"pitch":33.705},{"time":43.517,"pitch":34.244},{"time":43.525,"pitch":34.657},{"time":43.533,"pitch":34.972},{"time":43.542,"pitch":35.214},{"time":43.55,"pitch":35.398},{"time":43.558,"pitch":35.54},{"time":43.567,"pitch":35.648},{"time":43.575,"pitch":35.731},{"time":43.583,"pitch":35.794},{"time":43.592,"pitch":35.842},{"time":43.6,"pitch":35.879},{"time":43.608,"pitch":35.908},{"time":43.617,"pitch":35.929},{"time":43.625,"pitch":35.946},{"time":43.633,"pitch":35.959},{"time":43.642,"pitch":35.968},{"time":43.65,"pitch":35.976},{"time":43.658,"pitch":35.981},{"time":43.667,"pitch":35.986},{"time":43.675,"pitch":35.989},{"time":43.683,"pitch":35.992},{"time":43.692,"pitch":35.994},{"time":43.7,"pitch":35.995},{"time":43.708,"pitch":35.996},{"time":43.717,"pitch":35.997},{"time":43.725,"pitch":35.998},{"time":43.742,"pitch":35.999},{"time":43.775,"pitch":36},{"time":44,"pitch":36.47},{"time":44.008,"pitch":36.829},{"time":44.017,"pitch":37.104},{"time":44.025,"pitch":37.315},{"time":44.033,"pitch":37.476},{"time":44.042,"pitch":37.599},{"time":44.05,"pitch":37.693},{"time":44.058,"pitch":37.765},{"time":44.067,"pitch":37.82},{"time":44.075,"pitch":37.863},{"time":44.083,"pitch":37.895},{"time":44.092,"pitch":37.92},{"time":44.1,"pitch":37.938},{"time":44.108,"pitch":37.953},{"time":44.117,"pitch":37.964},{"time":44.125,"pitch":37.972},{"time":44.133,"pitch":37.979},{"time":44.142,"pitch":37.984},{"time":44.15,"pitch":37.988},{"time":44.158,"pitch":37.991},{"time":44.167,"pitch":37.993},{"time":44.175,"pitch":37.994},{"time":44.183,"pitch":37.996},{"time":44.192,"pitch":37.997},{"time":44.2,"pitch":37.998},{"time":44.217,"pitch":37.999},{"time":44.25,"pitch":38},{"time":44.733,"pitch":38.705},{"time":44.742,"pitch":39.244},{"time":44.75,"pitch":39.656},{"time":44.758,"pitch":39.972},{"time":44.767,"pitch":40.213},{"time":44.775,"pitch":40.398},{"time":44.783,"pitch":40.54},{"time":44.792,"pitch":40.648},{"time":44.8,"pitch":40.73},{"time":44.808,"pitch":40.794},{"time":44.817,"pitch":40.842},{"time":44.825,"pitch":40.879},{"time":44.833,"pitch":40.908},{"time":44.842,"pitch":40.929},{"time":44.85,"pitch":40.946},{"time":44.858,"pitch":40.959},{"time":44.867,"pitch":40.968},{"time":44.875,"pitch":40.976},{"time":44.883,"pitch":40.981},{"time":44.892,"pitch":40.986},{"time":44.9,"pitch":40.989},{"time":44.908,"pitch":40.992},{"time":44.917,"pitch":40.994},{"time":44.925,"pitch":40.995},{"time":44.933,"pitch":40.996},{"time":44.942,"pitch":40.997},{"time":44.95,"pitch":40.998},{"time":44.967,"pitch":40.999},{"time":45,"pitch":41},{"time":45.225,"pitch":41.705},{"time":45.233,"pitch":42.244},{"time":45.242,"pitch":42.656},{"time":45.25,"pitch":42.972},{"time":45.258,"pitch":43.213},{"time":45.267,"pitch":43.398},{"time":45.275,"pitch":43.54},{"time":45.283,"pitch":43.648},{"time":45.292,"pitch":43.73},{"time":45.3,"pitch":43.794},{"time":45.308,"pitch":43.842},{"time":45.317,"pitch":43.879},{"time":45.325,"pitch":43.908},{"time":45.333,"pitch":43.929},{"time":45.342,"pitch":43.946},{"time":45.35,"pitch":43.959},{"time":45.358,"pitch":43.968},{"time":45.367,"pitch":43.976},{"time":45.375,"pitch":43.981},{"time":45.383,"pitch":43.986},{"time":45.392,"pitch":43.989},{"time":45.4,"pitch":43.992},{"time":45.408,"pitch":43.994},{"time":45.417,"pitch":43.995},{"time":45.425,"pitch":43.996},{"time":45.433,"pitch":43.997},{"time":45.442,"pitch":43.998},{"time":45.458,"pitch":43.999},{"time":45.492,"pitch":44},{"time":45.525,"pitch":43.765},{"time":45.533,"pitch":43.585},{"time":45.542,"pitch":43.448},{"time":45.55,"pitch":43.343},{"time":45.558,"pitch":43.262},{"time":45.567,"pitch":43.201},{"time":45.575,"pitch":43.153},{"time":45.583,"pitch":43.117},{"time":45.592,"pitch":43.09},{"time":45.6,"pitch":43.069},{"time":45.608,"pitch":43.053},{"time":45.617,"pitch":43.04},{"time":45.625,"pitch":43.031},{"time":45.633,"pitch":43.024},{"time":45.642,"pitch":43.018},{"time":45.65,"pitch":43.014},{"time":45.658,"pitch":43.011},{"time":45.667,"pitch":43.008},{"time":45.675,"pitch":43.006},{"time":45.683,"pitch":43.005},{"time":45.692,"pitch":43.004},{"time":45.7,"pitch":43.003},{"time":45.708,"pitch":43.002},{"time":45.725,"pitch":43.001},{"time":45.758,"pitch":43},{"time":46,"pitch":42.53},{"time":46.008,"pitch":42.171},{"time":46.017,"pitch":41.896},{"time":46.025,"pitch":41.685},{"time":46.033,"pitch":41.524},{"time":46.042,"pitch":41.401},{"time":46.05,"pitch":41.307},{"time":46.058,"pitch":41.235},{"time":46.067,"pitch":41.18},{"time":46.075,"pitch":41.137},{"time":46.083,"pitch":41.105},{"time":46.092,"pitch":41.08},{"time":46.1,"pitch":41.062},{"time":46.108,"pitch":41.047},{"time":46.117,"pitch":41.036},{"time":46.125,"pitch":41.028},{"time":46.133,"pitch":41.021},{"time":46.142,"pitch":41.016},{"time":46.15,"pitch":41.012},{"time":46.158,"pitch":41.009},{"time":46.167,"pitch":41.007},{"time":46.175,"pitch":41.006},{"time":46.183,"pitch":41.004},{"time":46.192,"pitch":41.003},{"time":46.2,"pitch":41.002},{"time":46.217,"pitch":41.001},{"time":46.25,"pitch":41},{"time":46.758,"pitch":40.295},{"time":46.767,"pitch":39.756},{"time":46.775,"pitch":39.344},{"time":46.783,"pitch":39.028},{"time":46.792,"pitch":38.787},{"time":46.8,"pitch":38.602},{"time":46.808,"pitch":38.46},{"time":46.817,"pitch":38.352},{"time":46.825,"pitch":38.27},{"time":46.833,"pitch":38.206},{"time":46.842,"pitch":38.158},{"time":46.85,"pitch":38.121},{"time":46.858,"pitch":38.092},{"time":46.867,"pitch":38.071},{"time":46.875,"pitch":38.054},{"time":46.883,"pitch":38.041},{"time":46.892,"pitch":38.032},{"time":46.9,"pitch":38.024},{"time":46.908,"pitch":38.019},{"time":46.917,"pitch":38.014},{"time":46.925,"pitch":38.011},{"time":46.933,"pitch":38.008},{"time":46.942,"pitch":38.006},{"time":46.95,"pitch":38.005},{"time":46.958,"pitch":38.004},{"time":46.967,"pitch":38.003},{"time":46.975,"pitch":38.002},{"time":46.992,"pitch":38.001},{"time":47.025,"pitch":38},{"time":47.208,"pitch":36.826},{"time":47.217,"pitch":35.927},{"time":47.225,"pitch":35.239},{"time":47.233,"pitch":34.713},{"time":47.242,"pitch":34.311},{"time":47.25,"pitch":34.003},{"time":47.258,"pitch":33.767},{"time":47.267,"pitch":33.587},{"time":47.275,"pitch":33.449},{"time":47.283,"pitch":33.344},{"time":47.292,"pitch":33.263},{"time":47.3,"pitch":33.201},{"time":47.308,"pitch":33.154},{"time":47.317,"pitch":33.118},{"time":47.325,"pitch":33.09},{"time":47.333,"pitch":33.069},{"time":47.342,"pitch":33.053},{"time":47.35,"pitch":33.04},{"time":47.358,"pitch":33.031},{"time":47.367,"pitch":33.024},{"time":47.375,"pitch":33.018},{"time":47.383,"pitch":33.014},{"time":47.392,"pitch":33.011},{"time":47.4,"pitch":33.008},{"time":47.408,"pitch":33.006},{"time":47.417,"pitch":33.005},{"time":47.425,"pitch":33.004},{"time":47.433,"pitch":33.003},{"time":47.442,"pitch":33.002},{"time":47.458,"pitch":33.001},{"time":47.492,"pitch":33},{"time":47.508,"pitch":33.705},{"time":47.517,"pitch":34.244},{"time":47.525,"pitch":34.657},{"time":47.533,"pitch":34.972},{"time":47.542,"pitch":35.214},{"time":47.55,"pitch":35.398},{"time":47.558,"pitch":35.54},{"time":47.567,"pitch":35.648},{"time":47.575,"pitch":35.73},{"time":47.583,"pitch":35.794},{"time":47.592,"pitch":35.842},{"time":47.6,"pitch":35.879},{"time":47.608,"pitch":35.908},{"time":47.617,"pitch":35.929},{"time":47.625,"pitch":35.946},{"time":47.633,"pitch":35.959},{"time":47.642,"pitch":35.968},{"time":47.65,"pitch":35.976},{"time":47.658,"pitch":35.981},{"time":47.667,"pitch":35.986},{"time":47.675,"pitch":35.989},{"time":47.683,"pitch":35.992},{"time":47.692,"pitch":35.994},{"time":47.7,"pitch":35.995},{"time":47.708,"pitch":35.996},{"time":47.717,"pitch":35.997},{"time":47.725,"pitch":35.998},{"time":47.742,"pitch":35.999},{"time":47.775,"pitch":36},{"time":48,"pitch":36.47},{"time":48.008,"pitch":36.829},{"time":48.017,"pitch":37.104},{"time":48.025,"pitch":37.315},{"time":48.033,"pitch":37.476},{"time":48.042,"pitch":37.599},{"time":48.05,"pitch":37.693},{"time":48.058,"pitch":37.765},{"time":48.067,"pitch":37.82},{"time":48.075,"pitch":37.863},{"time":48.083,"pitch":37.895},{"time":48.092,"pitch":37.92},{"time":48.1,"pitch":37.938},{"time":48.108,"pitch":37.953},{"time":48.117,"pitch":37.964},{"time":48.125,"pitch":37.972},{"time":48.133,"pitch":37.979},{"time":48.142,"pitch":37.984},{"time":48.15,"pitch":37.988},{"time":48.158,"pitch":37.991},{"time":48.167,"pitch":37.993},{"time":48.175,"pitch":37.994},{"time":48.183,"pitch":37.996},{"time":48.192,"pitch":37.997},{"time":48.2,"pitch":37.998},{"time":48.217,"pitch":37.999},{"time":48.25,"pitch":38},{"time":48.317,"volume":0.833},{"time":48.325,"volume":0.667},{"time":48.333,"volume":0.5},{"time":48.342,"volume":0.333},{"time":48.35,"volume":0.167},{"time":48.358,"volume":0},{"time":48.367,"volume":0}]}},{"note":{"onTime":129.5,"k":[{"time":0,"pitch":38,"volume":0.167,"x":0,"y":0,"z":0},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.758,"pitch":37.53},{"time":2.767,"pitch":37.171},{"time":2.775,"pitch":36.896},{"time":2.783,"pitch":36.685},{"time":2.792,"pitch":36.524},{"time":2.8,"pitch":36.401},{"time":2.808,"pitch":36.307},{"time":2.817,"pitch":36.235},{"time":2.825,"pitch":36.18},{"time":2.833,"pitch":36.137},{"time":2.842,"pitch":36.105},{"time":2.85,"pitch":36.08},{"time":2.858,"pitch":36.062},{"time":2.867,"pitch":36.047},{"time":2.875,"pitch":36.036},{"time":2.883,"pitch":36.028},{"time":2.892,"pitch":36.021},{"time":2.9,"pitch":36.016},{"time":2.908,"pitch":36.012},{"time":2.917,"pitch":36.009},{"time":2.925,"pitch":36.007},{"time":2.933,"pitch":36.006},{"time":2.942,"pitch":36.004},{"time":2.95,"pitch":36.003},{"time":2.958,"pitch":36.002},{"time":2.975,"pitch":36.001},{"time":3.008,"pitch":36},{"time":3.258,"pitch":35.295},{"time":3.267,"pitch":34.756},{"time":3.275,"pitch":34.344},{"time":3.283,"pitch":34.028},{"time":3.292,"pitch":33.787},{"time":3.3,"pitch":33.602},{"time":3.308,"pitch":33.46},{"time":3.317,"pitch":33.352},{"time":3.325,"pitch":33.27},{"time":3.333,"pitch":33.206},{"time":3.342,"pitch":33.158},{"time":3.35,"pitch":33.121},{"time":3.358,"pitch":33.092},{"time":3.367,"pitch":33.071},{"time":3.375,"pitch":33.054},{"time":3.383,"pitch":33.041},{"time":3.392,"pitch":33.032},{"time":3.4,"pitch":33.024},{"time":3.408,"pitch":33.019},{"time":3.417,"pitch":33.014},{"time":3.425,"pitch":33.011},{"time":3.433,"pitch":33.008},{"time":3.442,"pitch":33.006},{"time":3.45,"pitch":33.005},{"time":3.458,"pitch":33.004},{"time":3.467,"pitch":33.003},{"time":3.475,"pitch":33.002},{"time":3.492,"pitch":33.001},{"time":3.508,"pitch":33.705},{"time":3.517,"pitch":34.244},{"time":3.525,"pitch":34.657},{"time":3.533,"pitch":34.972},{"time":3.542,"pitch":35.214},{"time":3.55,"pitch":35.398},{"time":3.558,"pitch":35.54},{"time":3.567,"pitch":35.648},{"time":3.575,"pitch":35.731},{"time":3.583,"pitch":35.794},{"time":3.592,"pitch":35.842},{"time":3.6,"pitch":35.879},{"time":3.608,"pitch":35.908},{"time":3.617,"pitch":35.929},{"time":3.625,"pitch":35.946},{"time":3.633,"pitch":35.959},{"time":3.642,"pitch":35.968},{"time":3.65,"pitch":35.976},{"time":3.658,"pitch":35.981},{"time":3.667,"pitch":35.986},{"time":3.675,"pitch":35.989},{"time":3.683,"pitch":35.992},{"time":3.692,"pitch":35.994},{"time":3.7,"pitch":35.995},{"time":3.708,"pitch":35.996},{"time":3.717,"pitch":35.997},{"time":3.725,"pitch":35.998},{"time":3.742,"pitch":35.999},{"time":3.775,"pitch":36},{"time":4,"pitch":36.47},{"time":4.008,"pitch":36.829},{"time":4.017,"pitch":37.104},{"time":4.025,"pitch":37.315},{"time":4.033,"pitch":37.476},{"time":4.042,"pitch":37.599},{"time":4.05,"pitch":37.693},{"time":4.058,"pitch":37.765},{"time":4.067,"pitch":37.82},{"time":4.075,"pitch":37.863},{"time":4.083,"pitch":37.895},{"time":4.092,"pitch":37.92},{"time":4.1,"pitch":37.938},{"time":4.108,"pitch":37.953},{"time":4.117,"pitch":37.964},{"time":4.125,"pitch":37.972},{"time":4.133,"pitch":37.979},{"time":4.142,"pitch":37.984},{"time":4.15,"pitch":37.988},{"time":4.158,"pitch":37.991},{"time":4.167,"pitch":37.993},{"time":4.175,"pitch":37.994},{"time":4.183,"pitch":37.996},{"time":4.192,"pitch":37.997},{"time":4.2,"pitch":37.998},{"time":4.217,"pitch":37.999},{"time":4.25,"pitch":38},{"time":4.733,"pitch":38.705},{"time":4.742,"pitch":39.244},{"time":4.75,"pitch":39.656},{"time":4.758,"pitch":39.972},{"time":4.767,"pitch":40.213},{"time":4.775,"pitch":40.398},{"time":4.783,"pitch":40.54},{"time":4.792,"pitch":40.648},{"time":4.8,"pitch":40.73},{"time":4.808,"pitch":40.794},{"time":4.817,"pitch":40.842},{"time":4.825,"pitch":40.879},{"time":4.833,"pitch":40.908},{"time":4.842,"pitch":40.929},{"time":4.85,"pitch":40.946},{"time":4.858,"pitch":40.959},{"time":4.867,"pitch":40.968},{"time":4.875,"pitch":40.976},{"time":4.883,"pitch":40.981},{"time":4.892,"pitch":40.986},{"time":4.9,"pitch":40.989},{"time":4.908,"pitch":40.992},{"time":4.917,"pitch":40.994},{"time":4.925,"pitch":40.995},{"time":4.933,"pitch":40.996},{"time":4.942,"pitch":40.997},{"time":4.95,"pitch":40.998},{"time":4.967,"pitch":40.999},{"time":5,"pitch":41},{"time":5.258,"pitch":40.295},{"time":5.267,"pitch":39.756},{"time":5.275,"pitch":39.344},{"time":5.283,"pitch":39.028},{"time":5.292,"pitch":38.787},{"time":5.3,"pitch":38.602},{"time":5.308,"pitch":38.46},{"time":5.317,"pitch":38.352},{"time":5.325,"pitch":38.27},{"time":5.333,"pitch":38.206},{"time":5.342,"pitch":38.158},{"time":5.35,"pitch":38.121},{"time":5.358,"pitch":38.092},{"time":5.367,"pitch":38.071},{"time":5.375,"pitch":38.054},{"time":5.383,"pitch":38.041},{"time":5.392,"pitch":38.032},{"time":5.4,"pitch":38.024},{"time":5.408,"pitch":38.019},{"time":5.417,"pitch":38.014},{"time":5.425,"pitch":38.011},{"time":5.433,"pitch":38.008},{"time":5.442,"pitch":38.006},{"time":5.45,"pitch":38.005},{"time":5.458,"pitch":38.004},{"time":5.467,"pitch":38.003},{"time":5.475,"pitch":38.002},{"time":5.492,"pitch":38.001},{"time":5.5,"pitch":38.706},{"time":5.508,"pitch":39.245},{"time":5.517,"pitch":39.657},{"time":5.525,"pitch":39.972},{"time":5.533,"pitch":40.214},{"time":5.542,"pitch":40.398},{"time":5.55,"pitch":40.54},{"time":5.558,"pitch":40.648},{"time":5.567,"pitch":40.731},{"time":5.575,"pitch":40.794},{"time":5.583,"pitch":40.842},{"time":5.592,"pitch":40.879},{"time":5.6,"pitch":40.908},{"time":5.608,"pitch":40.929},{"time":5.617,"pitch":40.946},{"time":5.625,"pitch":40.959},{"time":5.633,"pitch":40.968},{"time":5.642,"pitch":40.976},{"time":5.65,"pitch":40.981},{"time":5.658,"pitch":40.986},{"time":5.667,"pitch":40.989},{"time":5.675,"pitch":40.992},{"time":5.683,"pitch":40.994},{"time":5.692,"pitch":40.995},{"time":5.7,"pitch":40.996},{"time":5.708,"pitch":40.997},{"time":5.717,"pitch":40.998},{"time":5.733,"pitch":40.999},{"time":5.767,"pitch":41},{"time":6.008,"pitch":40.295},{"time":6.017,"pitch":39.756},{"time":6.025,"pitch":39.344},{"time":6.033,"pitch":39.028},{"time":6.042,"pitch":38.787},{"time":6.05,"pitch":38.602},{"time":6.058,"pitch":38.46},{"time":6.067,"pitch":38.352},{"time":6.075,"pitch":38.27},{"time":6.083,"pitch":38.206},{"time":6.092,"pitch":38.158},{"time":6.1,"pitch":38.121},{"time":6.108,"pitch":38.092},{"time":6.117,"pitch":38.071},{"time":6.125,"pitch":38.054},{"time":6.133,"pitch":38.041},{"time":6.142,"pitch":38.032},{"time":6.15,"pitch":38.024},{"time":6.158,"pitch":38.019},{"time":6.167,"pitch":38.014},{"time":6.175,"pitch":38.011},{"time":6.183,"pitch":38.008},{"time":6.192,"pitch":38.006},{"time":6.2,"pitch":38.005},{"time":6.208,"pitch":38.004},{"time":6.217,"pitch":38.003},{"time":6.225,"pitch":38.002},{"time":6.242,"pitch":38.001},{"time":6.275,"pitch":38},{"time":6.758,"pitch":37.53},{"time":6.767,"pitch":37.171},{"time":6.775,"pitch":36.896},{"time":6.783,"pitch":36.685},{"time":6.792,"pitch":36.524},{"time":6.8,"pitch":36.401},{"time":6.808,"pitch":36.307},{"time":6.817,"pitch":36.235},{"time":6.825,"pitch":36.18},{"time":6.833,"pitch":36.137},{"time":6.842,"pitch":36.105},{"time":6.85,"pitch":36.08},{"time":6.858,"pitch":36.062},{"time":6.867,"pitch":36.047},{"time":6.875,"pitch":36.036},{"time":6.883,"pitch":36.028},{"time":6.892,"pitch":36.021},{"time":6.9,"pitch":36.016},{"time":6.908,"pitch":36.012},{"time":6.917,"pitch":36.009},{"time":6.925,"pitch":36.007},{"time":6.933,"pitch":36.006},{"time":6.942,"pitch":36.004},{"time":6.95,"pitch":36.003},{"time":6.958,"pitch":36.002},{"time":6.975,"pitch":36.001},{"time":7.008,"pitch":36},{"time":7.258,"pitch":35.295},{"time":7.267,"pitch":34.756},{"time":7.275,"pitch":34.344},{"time":7.283,"pitch":34.028},{"time":7.292,"pitch":33.787},{"time":7.3,"pitch":33.602},{"time":7.308,"pitch":33.46},{"time":7.317,"pitch":33.352},{"time":7.325,"pitch":33.27},{"time":7.333,"pitch":33.206},{"time":7.342,"pitch":33.158},{"time":7.35,"pitch":33.121},{"time":7.358,"pitch":33.092},{"time":7.367,"pitch":33.071},{"time":7.375,"pitch":33.054},{"time":7.383,"pitch":33.041},{"time":7.392,"pitch":33.032},{"time":7.4,"pitch":33.024},{"time":7.408,"pitch":33.019},{"time":7.417,"pitch":33.014},{"time":7.425,"pitch":33.011},{"time":7.433,"pitch":33.008},{"time":7.442,"pitch":33.006},{"time":7.45,"pitch":33.005},{"time":7.458,"pitch":33.004},{"time":7.467,"pitch":33.003},{"time":7.475,"pitch":33.002},{"time":7.492,"pitch":33.001},{"time":7.508,"pitch":33.705},{"time":7.517,"pitch":34.244},{"time":7.525,"pitch":34.657},{"time":7.533,"pitch":34.972},{"time":7.542,"pitch":35.214},{"time":7.55,"pitch":35.398},{"time":7.558,"pitch":35.54},{"time":7.567,"pitch":35.648},{"time":7.575,"pitch":35.731},{"time":7.583,"pitch":35.794},{"time":7.592,"pitch":35.842},{"time":7.6,"pitch":35.879},{"time":7.608,"pitch":35.908},{"time":7.617,"pitch":35.929},{"time":7.625,"pitch":35.946},{"time":7.633,"pitch":35.959},{"time":7.642,"pitch":35.968},{"time":7.65,"pitch":35.976},{"time":7.658,"pitch":35.981},{"time":7.667,"pitch":35.986},{"time":7.675,"pitch":35.989},{"time":7.683,"pitch":35.992},{"time":7.692,"pitch":35.994},{"time":7.7,"pitch":35.995},{"time":7.708,"pitch":35.996},{"time":7.717,"pitch":35.997},{"time":7.725,"pitch":35.998},{"time":7.742,"pitch":35.999},{"time":7.775,"pitch":36},{"time":8,"pitch":36.47},{"time":8.008,"pitch":36.829},{"time":8.017,"pitch":37.104},{"time":8.025,"pitch":37.315},{"time":8.033,"pitch":37.476},{"time":8.042,"pitch":37.599},{"time":8.05,"pitch":37.693},{"time":8.058,"pitch":37.765},{"time":8.067,"pitch":37.82},{"time":8.075,"pitch":37.863},{"time":8.083,"pitch":37.895},{"time":8.092,"pitch":37.92},{"time":8.1,"pitch":37.938},{"time":8.108,"pitch":37.953},{"time":8.117,"pitch":37.964},{"time":8.125,"pitch":37.972},{"time":8.133,"pitch":37.979},{"time":8.142,"pitch":37.984},{"time":8.15,"pitch":37.988},{"time":8.158,"pitch":37.991},{"time":8.167,"pitch":37.993},{"time":8.175,"pitch":37.994},{"time":8.183,"pitch":37.996},{"time":8.192,"pitch":37.997},{"time":8.2,"pitch":37.998},{"time":8.217,"pitch":37.999},{"time":8.25,"pitch":38},{"time":8.733,"pitch":38.705},{"time":8.742,"pitch":39.244},{"time":8.75,"pitch":39.656},{"time":8.758,"pitch":39.972},{"time":8.767,"pitch":40.213},{"time":8.775,"pitch":40.398},{"time":8.783,"pitch":40.54},{"time":8.792,"pitch":40.648},{"time":8.8,"pitch":40.73},{"time":8.808,"pitch":40.794},{"time":8.817,"pitch":40.842},{"time":8.825,"pitch":40.879},{"time":8.833,"pitch":40.908},{"time":8.842,"pitch":40.929},{"time":8.85,"pitch":40.946},{"time":8.858,"pitch":40.959},{"time":8.867,"pitch":40.968},{"time":8.875,"pitch":40.976},{"time":8.883,"pitch":40.981},{"time":8.892,"pitch":40.986},{"time":8.9,"pitch":40.989},{"time":8.908,"pitch":40.992},{"time":8.917,"pitch":40.994},{"time":8.925,"pitch":40.995},{"time":8.933,"pitch":40.996},{"time":8.942,"pitch":40.997},{"time":8.95,"pitch":40.998},{"time":8.967,"pitch":40.999},{"time":9,"pitch":41},{"time":9.258,"pitch":40.295},{"time":9.267,"pitch":39.756},{"time":9.275,"pitch":39.344},{"time":9.283,"pitch":39.028},{"time":9.292,"pitch":38.787},{"time":9.3,"pitch":38.602},{"time":9.308,"pitch":38.46},{"time":9.317,"pitch":38.352},{"time":9.325,"pitch":38.27},{"time":9.333,"pitch":38.206},{"time":9.342,"pitch":38.158},{"time":9.35,"pitch":38.121},{"time":9.358,"pitch":38.092},{"time":9.367,"pitch":38.071},{"time":9.375,"pitch":38.054},{"time":9.383,"pitch":38.041},{"time":9.392,"pitch":38.032},{"time":9.4,"pitch":38.024},{"time":9.408,"pitch":38.019},{"time":9.417,"pitch":38.014},{"time":9.425,"pitch":38.011},{"time":9.433,"pitch":38.008},{"time":9.442,"pitch":38.006},{"time":9.45,"pitch":38.005},{"time":9.458,"pitch":38.004},{"time":9.467,"pitch":38.003},{"time":9.475,"pitch":38.002},{"time":9.492,"pitch":38.001},{"time":9.5,"pitch":38.706},{"time":9.508,"pitch":39.245},{"time":9.517,"pitch":39.657},{"time":9.525,"pitch":39.972},{"time":9.533,"pitch":40.214},{"time":9.542,"pitch":40.398},{"time":9.55,"pitch":40.54},{"time":9.558,"pitch":40.648},{"time":9.567,"pitch":40.731},{"time":9.575,"pitch":40.794},{"time":9.583,"pitch":40.842},{"time":9.592,"pitch":40.879},{"time":9.6,"pitch":40.908},{"time":9.608,"pitch":40.929},{"time":9.617,"pitch":40.946},{"time":9.625,"pitch":40.959},{"time":9.633,"pitch":40.968},{"time":9.642,"pitch":40.976},{"time":9.65,"pitch":40.981},{"time":9.658,"pitch":40.986},{"time":9.667,"pitch":40.989},{"time":9.675,"pitch":40.992},{"time":9.683,"pitch":40.994},{"time":9.692,"pitch":40.995},{"time":9.7,"pitch":40.996},{"time":9.708,"pitch":40.997},{"time":9.717,"pitch":40.998},{"time":9.733,"pitch":40.999},{"time":9.767,"pitch":41},{"time":10.008,"pitch":40.295},{"time":10.017,"pitch":39.756},{"time":10.025,"pitch":39.344},{"time":10.033,"pitch":39.028},{"time":10.042,"pitch":38.787},{"time":10.05,"pitch":38.602},{"time":10.058,"pitch":38.46},{"time":10.067,"pitch":38.352},{"time":10.075,"pitch":38.27},{"time":10.083,"pitch":38.206},{"time":10.092,"pitch":38.158},{"time":10.1,"pitch":38.121},{"time":10.108,"pitch":38.092},{"time":10.117,"pitch":38.071},{"time":10.125,"pitch":38.054},{"time":10.133,"pitch":38.041},{"time":10.142,"pitch":38.032},{"time":10.15,"pitch":38.024},{"time":10.158,"pitch":38.019},{"time":10.167,"pitch":38.014},{"time":10.175,"pitch":38.011},{"time":10.183,"pitch":38.008},{"time":10.192,"pitch":38.006},{"time":10.2,"pitch":38.005},{"time":10.208,"pitch":38.004},{"time":10.217,"pitch":38.003},{"time":10.225,"pitch":38.002},{"time":10.242,"pitch":38.001},{"time":10.275,"pitch":38},{"time":10.758,"pitch":37.53},{"time":10.767,"pitch":37.171},{"time":10.775,"pitch":36.896},{"time":10.783,"pitch":36.685},{"time":10.792,"pitch":36.524},{"time":10.8,"pitch":36.401},{"time":10.808,"pitch":36.307},{"time":10.817,"pitch":36.235},{"time":10.825,"pitch":36.18},{"time":10.833,"pitch":36.137},{"time":10.842,"pitch":36.105},{"time":10.85,"pitch":36.08},{"time":10.858,"pitch":36.062},{"time":10.867,"pitch":36.047},{"time":10.875,"pitch":36.036},{"time":10.883,"pitch":36.028},{"time":10.892,"pitch":36.021},{"time":10.9,"pitch":36.016},{"time":10.908,"pitch":36.012},{"time":10.917,"pitch":36.009},{"time":10.925,"pitch":36.007},{"time":10.933,"pitch":36.006},{"time":10.942,"pitch":36.004},{"time":10.95,"pitch":36.003},{"time":10.958,"pitch":36.002},{"time":10.975,"pitch":36.001},{"time":11.008,"pitch":36},{"time":11.258,"pitch":35.295},{"time":11.267,"pitch":34.756},{"time":11.275,"pitch":34.344},{"time":11.283,"pitch":34.028},{"time":11.292,"pitch":33.787},{"time":11.3,"pitch":33.602},{"time":11.308,"pitch":33.46},{"time":11.317,"pitch":33.352},{"time":11.325,"pitch":33.27},{"time":11.333,"pitch":33.206},{"time":11.342,"pitch":33.158},{"time":11.35,"pitch":33.121},{"time":11.358,"pitch":33.092},{"time":11.367,"pitch":33.071},{"time":11.375,"pitch":33.054},{"time":11.383,"pitch":33.041},{"time":11.392,"pitch":33.032},{"time":11.4,"pitch":33.024},{"time":11.408,"pitch":33.019},{"time":11.417,"pitch":33.014},{"time":11.425,"pitch":33.011},{"time":11.433,"pitch":33.008},{"time":11.442,"pitch":33.006},{"time":11.45,"pitch":33.005},{"time":11.458,"pitch":33.004},{"time":11.467,"pitch":33.003},{"time":11.475,"pitch":33.002},{"time":11.492,"pitch":33.001},{"time":11.508,"pitch":33.705},{"time":11.517,"pitch":34.244},{"time":11.525,"pitch":34.657},{"time":11.533,"pitch":34.972},{"time":11.542,"pitch":35.214},{"time":11.55,"pitch":35.398},{"time":11.558,"pitch":35.54},{"time":11.567,"pitch":35.648},{"time":11.575,"pitch":35.731},{"time":11.583,"pitch":35.794},{"time":11.592,"pitch":35.842},{"time":11.6,"pitch":35.879},{"time":11.608,"pitch":35.908},{"time":11.617,"pitch":35.929},{"time":11.625,"pitch":35.946},{"time":11.633,"pitch":35.959},{"time":11.642,"pitch":35.968},{"time":11.65,"pitch":35.976},{"time":11.658,"pitch":35.981},{"time":11.667,"pitch":35.986},{"time":11.675,"pitch":35.989},{"time":11.683,"pitch":35.992},{"time":11.692,"pitch":35.994},{"time":11.7,"pitch":35.995},{"time":11.708,"pitch":35.996},{"time":11.717,"pitch":35.997},{"time":11.725,"pitch":35.998},{"time":11.742,"pitch":35.999},{"time":11.775,"pitch":36},{"time":12,"pitch":36.47},{"time":12.008,"pitch":36.829},{"time":12.017,"pitch":37.104},{"time":12.025,"pitch":37.315},{"time":12.033,"pitch":37.476},{"time":12.042,"pitch":37.599},{"time":12.05,"pitch":37.693},{"time":12.058,"pitch":37.765},{"time":12.067,"pitch":37.82},{"time":12.075,"pitch":37.863},{"time":12.083,"pitch":37.895},{"time":12.092,"pitch":37.92},{"time":12.1,"pitch":37.938},{"time":12.108,"pitch":37.953},{"time":12.117,"pitch":37.964},{"time":12.125,"pitch":37.972},{"time":12.133,"pitch":37.979},{"time":12.142,"pitch":37.984},{"time":12.15,"pitch":37.988},{"time":12.158,"pitch":37.991},{"time":12.167,"pitch":37.993},{"time":12.175,"pitch":37.994},{"time":12.183,"pitch":37.996},{"time":12.192,"pitch":37.997},{"time":12.2,"pitch":37.998},{"time":12.217,"pitch":37.999},{"time":12.25,"pitch":38},{"time":12.733,"pitch":38.705},{"time":12.742,"pitch":39.244},{"time":12.75,"pitch":39.656},{"time":12.758,"pitch":39.972},{"time":12.767,"pitch":40.213},{"time":12.775,"pitch":40.398},{"time":12.783,"pitch":40.54},{"time":12.792,"pitch":40.648},{"time":12.8,"pitch":40.73},{"time":12.808,"pitch":40.794},{"time":12.817,"pitch":40.842},{"time":12.825,"pitch":40.879},{"time":12.833,"pitch":40.908},{"time":12.842,"pitch":40.929},{"time":12.85,"pitch":40.946},{"time":12.858,"pitch":40.959},{"time":12.867,"pitch":40.968},{"time":12.875,"pitch":40.976},{"time":12.883,"pitch":40.981},{"time":12.892,"pitch":40.986},{"time":12.9,"pitch":40.989},{"time":12.908,"pitch":40.992},{"time":12.917,"pitch":40.994},{"time":12.925,"pitch":40.995},{"time":12.933,"pitch":40.996},{"time":12.942,"pitch":40.997},{"time":12.95,"pitch":40.998},{"time":12.967,"pitch":40.999},{"time":13,"pitch":41},{"time":13.225,"pitch":41.705},{"time":13.233,"pitch":42.244},{"time":13.242,"pitch":42.656},{"time":13.25,"pitch":42.972},{"time":13.258,"pitch":43.213},{"time":13.267,"pitch":43.398},{"time":13.275,"pitch":43.54},{"time":13.283,"pitch":43.648},{"time":13.292,"pitch":43.73},{"time":13.3,"pitch":43.794},{"time":13.308,"pitch":43.842},{"time":13.317,"pitch":43.879},{"time":13.325,"pitch":43.908},{"time":13.333,"pitch":43.929},{"time":13.342,"pitch":43.946},{"time":13.35,"pitch":43.959},{"time":13.358,"pitch":43.968},{"time":13.367,"pitch":43.976},{"time":13.375,"pitch":43.981},{"time":13.383,"pitch":43.986},{"time":13.392,"pitch":43.989},{"time":13.4,"pitch":43.992},{"time":13.408,"pitch":43.994},{"time":13.417,"pitch":43.995},{"time":13.425,"pitch":43.996},{"time":13.433,"pitch":43.997},{"time":13.442,"pitch":43.998},{"time":13.458,"pitch":43.999},{"time":13.492,"pitch":44},{"time":13.525,"pitch":43.765},{"time":13.533,"pitch":43.585},{"time":13.542,"pitch":43.448},{"time":13.55,"pitch":43.343},{"time":13.558,"pitch":43.262},{"time":13.567,"pitch":43.201},{"time":13.575,"pitch":43.153},{"time":13.583,"pitch":43.117},{"time":13.592,"pitch":43.09},{"time":13.6,"pitch":43.069},{"time":13.608,"pitch":43.053},{"time":13.617,"pitch":43.04},{"time":13.625,"pitch":43.031},{"time":13.633,"pitch":43.024},{"time":13.642,"pitch":43.018},{"time":13.65,"pitch":43.014},{"time":13.658,"pitch":43.011},{"time":13.667,"pitch":43.008},{"time":13.675,"pitch":43.006},{"time":13.683,"pitch":43.005},{"time":13.692,"pitch":43.004},{"time":13.7,"pitch":43.003},{"time":13.708,"pitch":43.002},{"time":13.725,"pitch":43.001},{"time":13.758,"pitch":43},{"time":14,"pitch":42.53},{"time":14.008,"pitch":42.171},{"time":14.017,"pitch":41.896},{"time":14.025,"pitch":41.685},{"time":14.033,"pitch":41.524},{"time":14.042,"pitch":41.401},{"time":14.05,"pitch":41.307},{"time":14.058,"pitch":41.235},{"time":14.067,"pitch":41.18},{"time":14.075,"pitch":41.137},{"time":14.083,"pitch":41.105},{"time":14.092,"pitch":41.08},{"time":14.1,"pitch":41.062},{"time":14.108,"pitch":41.047},{"time":14.117,"pitch":41.036},{"time":14.125,"pitch":41.028},{"time":14.133,"pitch":41.021},{"time":14.142,"pitch":41.016},{"time":14.15,"pitch":41.012},{"time":14.158,"pitch":41.009},{"time":14.167,"pitch":41.007},{"time":14.175,"pitch":41.006},{"time":14.183,"pitch":41.004},{"time":14.192,"pitch":41.003},{"time":14.2,"pitch":41.002},{"time":14.217,"pitch":41.001},{"time":14.25,"pitch":41},{"time":14.758,"pitch":40.295},{"time":14.767,"pitch":39.756},{"time":14.775,"pitch":39.344},{"time":14.783,"pitch":39.028},{"time":14.792,"pitch":38.787},{"time":14.8,"pitch":38.602},{"time":14.808,"pitch":38.46},{"time":14.817,"pitch":38.352},{"time":14.825,"pitch":38.27},{"time":14.833,"pitch":38.206},{"time":14.842,"pitch":38.158},{"time":14.85,"pitch":38.121},{"time":14.858,"pitch":38.092},{"time":14.867,"pitch":38.071},{"time":14.875,"pitch":38.054},{"time":14.883,"pitch":38.041},{"time":14.892,"pitch":38.032},{"time":14.9,"pitch":38.024},{"time":14.908,"pitch":38.019},{"time":14.917,"pitch":38.014},{"time":14.925,"pitch":38.011},{"time":14.933,"pitch":38.008},{"time":14.942,"pitch":38.006},{"time":14.95,"pitch":38.005},{"time":14.958,"pitch":38.004},{"time":14.967,"pitch":38.003},{"time":14.975,"pitch":38.002},{"time":14.992,"pitch":38.001},{"time":15.025,"pitch":38},{"time":15.208,"pitch":36.826},{"time":15.217,"pitch":35.927},{"time":15.225,"pitch":35.239},{"time":15.233,"pitch":34.713},{"time":15.242,"pitch":34.311},{"time":15.25,"pitch":34.003},{"time":15.258,"pitch":33.767},{"time":15.267,"pitch":33.587},{"time":15.275,"pitch":33.449},{"time":15.283,"pitch":33.344},{"time":15.292,"pitch":33.263},{"time":15.3,"pitch":33.201},{"time":15.308,"pitch":33.154},{"time":15.317,"pitch":33.118},{"time":15.325,"pitch":33.09},{"time":15.333,"pitch":33.069},{"time":15.342,"pitch":33.053},{"time":15.35,"pitch":33.04},{"time":15.358,"pitch":33.031},{"time":15.367,"pitch":33.024},{"time":15.375,"pitch":33.018},{"time":15.383,"pitch":33.014},{"time":15.392,"pitch":33.011},{"time":15.4,"pitch":33.008},{"time":15.408,"pitch":33.006},{"time":15.417,"pitch":33.005},{"time":15.425,"pitch":33.004},{"time":15.433,"pitch":33.003},{"time":15.442,"pitch":33.002},{"time":15.458,"pitch":33.001},{"time":15.492,"pitch":33},{"time":15.508,"pitch":33.705},{"time":15.517,"pitch":34.244},{"time":15.525,"pitch":34.657},{"time":15.533,"pitch":34.972},{"time":15.542,"pitch":35.214},{"time":15.55,"pitch":35.398},{"time":15.558,"pitch":35.54},{"time":15.567,"pitch":35.648},{"time":15.575,"pitch":35.73},{"time":15.583,"pitch":35.794},{"time":15.592,"pitch":35.842},{"time":15.6,"pitch":35.879},{"time":15.608,"pitch":35.908},{"time":15.617,"pitch":35.929},{"time":15.625,"pitch":35.946},{"time":15.633,"pitch":35.959},{"time":15.642,"pitch":35.968},{"time":15.65,"pitch":35.976},{"time":15.658,"pitch":35.981},{"time":15.667,"pitch":35.986},{"time":15.675,"pitch":35.989},{"time":15.683,"pitch":35.992},{"time":15.692,"pitch":35.994},{"time":15.7,"pitch":35.995},{"time":15.708,"pitch":35.996},{"time":15.717,"pitch":35.997},{"time":15.725,"pitch":35.998},{"time":15.742,"pitch":35.999},{"time":15.775,"pitch":36},{"time":16,"pitch":36.47},{"time":16.008,"pitch":36.829},{"time":16.017,"pitch":37.104},{"time":16.025,"pitch":37.315},{"time":16.033,"pitch":37.476},{"time":16.042,"pitch":37.599},{"time":16.05,"pitch":37.693},{"time":16.058,"pitch":37.765},{"time":16.067,"pitch":37.82},{"time":16.075,"pitch":37.863},{"time":16.083,"pitch":37.895},{"time":16.092,"pitch":37.92},{"time":16.1,"pitch":37.938},{"time":16.108,"pitch":37.953},{"time":16.117,"pitch":37.964},{"time":16.125,"pitch":37.972},{"time":16.133,"pitch":37.979},{"time":16.142,"pitch":37.984},{"time":16.15,"pitch":37.988},{"time":16.158,"pitch":37.991},{"time":16.167,"pitch":37.993},{"time":16.175,"pitch":37.994},{"time":16.183,"pitch":37.996},{"time":16.192,"pitch":37.997},{"time":16.2,"pitch":37.998},{"time":16.217,"pitch":37.999},{"time":16.25,"pitch":38},{"time":16.733,"pitch":38.705},{"time":16.742,"pitch":39.244},{"time":16.75,"pitch":39.656},{"time":16.758,"pitch":39.972},{"time":16.767,"pitch":40.213},{"time":16.775,"pitch":40.398},{"time":16.783,"pitch":40.54},{"time":16.792,"pitch":40.648},{"time":16.8,"pitch":40.73},{"time":16.808,"pitch":40.794},{"time":16.817,"pitch":40.842},{"time":16.825,"pitch":40.879},{"time":16.833,"pitch":40.908},{"time":16.842,"pitch":40.929},{"time":16.85,"pitch":40.946},{"time":16.858,"pitch":40.959},{"time":16.867,"pitch":40.968},{"time":16.875,"pitch":40.976},{"time":16.883,"pitch":40.981},{"time":16.892,"pitch":40.986},{"time":16.9,"pitch":40.989},{"time":16.908,"pitch":40.992},{"time":16.917,"pitch":40.994},{"time":16.925,"pitch":40.995},{"time":16.933,"pitch":40.996},{"time":16.942,"pitch":40.997},{"time":16.95,"pitch":40.998},{"time":16.967,"pitch":40.999},{"time":17,"pitch":41},{"time":17.258,"pitch":40.295},{"time":17.267,"pitch":39.756},{"time":17.275,"pitch":39.344},{"time":17.283,"pitch":39.028},{"time":17.292,"pitch":38.787},{"time":17.3,"pitch":38.602},{"time":17.308,"pitch":38.46},{"time":17.317,"pitch":38.352},{"time":17.325,"pitch":38.27},{"time":17.333,"pitch":38.206},{"time":17.342,"pitch":38.158},{"time":17.35,"pitch":38.121},{"time":17.358,"pitch":38.092},{"time":17.367,"pitch":38.071},{"time":17.375,"pitch":38.054},{"time":17.383,"pitch":38.041},{"time":17.392,"pitch":38.032},{"time":17.4,"pitch":38.024},{"time":17.408,"pitch":38.019},{"time":17.417,"pitch":38.014},{"time":17.425,"pitch":38.011},{"time":17.433,"pitch":38.008},{"time":17.442,"pitch":38.006},{"time":17.45,"pitch":38.005},{"time":17.458,"pitch":38.004},{"time":17.467,"pitch":38.003},{"time":17.475,"pitch":38.002},{"time":17.492,"pitch":38.001},{"time":17.5,"pitch":38.706},{"time":17.508,"pitch":39.245},{"time":17.517,"pitch":39.657},{"time":17.525,"pitch":39.972},{"time":17.533,"pitch":40.214},{"time":17.542,"pitch":40.398},{"time":17.55,"pitch":40.54},{"time":17.558,"pitch":40.648},{"time":17.567,"pitch":40.731},{"time":17.575,"pitch":40.794},{"time":17.583,"pitch":40.842},{"time":17.592,"pitch":40.879},{"time":17.6,"pitch":40.908},{"time":17.608,"pitch":40.929},{"time":17.617,"pitch":40.946},{"time":17.625,"pitch":40.959},{"time":17.633,"pitch":40.968},{"time":17.642,"pitch":40.976},{"time":17.65,"pitch":40.981},{"time":17.658,"pitch":40.986},{"time":17.667,"pitch":40.989},{"time":17.675,"pitch":40.992},{"time":17.683,"pitch":40.994},{"time":17.692,"pitch":40.995},{"time":17.7,"pitch":40.996},{"time":17.708,"pitch":40.997},{"time":17.717,"pitch":40.998},{"time":17.733,"pitch":40.999},{"time":17.767,"pitch":41},{"time":18.008,"pitch":40.295},{"time":18.017,"pitch":39.756},{"time":18.025,"pitch":39.344},{"time":18.033,"pitch":39.028},{"time":18.042,"pitch":38.787},{"time":18.05,"pitch":38.602},{"time":18.058,"pitch":38.46},{"time":18.067,"pitch":38.352},{"time":18.075,"pitch":38.27},{"time":18.083,"pitch":38.206},{"time":18.092,"pitch":38.158},{"time":18.1,"pitch":38.121},{"time":18.108,"pitch":38.092},{"time":18.117,"pitch":38.071},{"time":18.125,"pitch":38.054},{"time":18.133,"pitch":38.041},{"time":18.142,"pitch":38.032},{"time":18.15,"pitch":38.024},{"time":18.158,"pitch":38.019},{"time":18.167,"pitch":38.014},{"time":18.175,"pitch":38.011},{"time":18.183,"pitch":38.008},{"time":18.192,"pitch":38.006},{"time":18.2,"pitch":38.005},{"time":18.208,"pitch":38.004},{"time":18.217,"pitch":38.003},{"time":18.225,"pitch":38.002},{"time":18.242,"pitch":38.001},{"time":18.275,"pitch":38},{"time":18.758,"pitch":37.53},{"time":18.767,"pitch":37.171},{"time":18.775,"pitch":36.896},{"time":18.783,"pitch":36.685},{"time":18.792,"pitch":36.524},{"time":18.8,"pitch":36.401},{"time":18.808,"pitch":36.307},{"time":18.817,"pitch":36.235},{"time":18.825,"pitch":36.18},{"time":18.833,"pitch":36.137},{"time":18.842,"pitch":36.105},{"time":18.85,"pitch":36.08},{"time":18.858,"pitch":36.062},{"time":18.867,"pitch":36.047},{"time":18.875,"pitch":36.036},{"time":18.883,"pitch":36.028},{"time":18.892,"pitch":36.021},{"time":18.9,"pitch":36.016},{"time":18.908,"pitch":36.012},{"time":18.917,"pitch":36.009},{"time":18.925,"pitch":36.007},{"time":18.933,"pitch":36.006},{"time":18.942,"pitch":36.004},{"time":18.95,"pitch":36.003},{"time":18.958,"pitch":36.002},{"time":18.975,"pitch":36.001},{"time":19.008,"pitch":36},{"time":19.258,"pitch":35.295},{"time":19.267,"pitch":34.756},{"time":19.275,"pitch":34.344},{"time":19.283,"pitch":34.028},{"time":19.292,"pitch":33.787},{"time":19.3,"pitch":33.602},{"time":19.308,"pitch":33.46},{"time":19.317,"pitch":33.352},{"time":19.325,"pitch":33.27},{"time":19.333,"pitch":33.206},{"time":19.342,"pitch":33.158},{"time":19.35,"pitch":33.121},{"time":19.358,"pitch":33.092},{"time":19.367,"pitch":33.071},{"time":19.375,"pitch":33.054},{"time":19.383,"pitch":33.041},{"time":19.392,"pitch":33.032},{"time":19.4,"pitch":33.024},{"time":19.408,"pitch":33.019},{"time":19.417,"pitch":33.014},{"time":19.425,"pitch":33.011},{"time":19.433,"pitch":33.008},{"time":19.442,"pitch":33.006},{"time":19.45,"pitch":33.005},{"time":19.458,"pitch":33.004},{"time":19.467,"pitch":33.003},{"time":19.475,"pitch":33.002},{"time":19.492,"pitch":33.001},{"time":19.508,"pitch":33.705},{"time":19.517,"pitch":34.244},{"time":19.525,"pitch":34.657},{"time":19.533,"pitch":34.972},{"time":19.542,"pitch":35.214},{"time":19.55,"pitch":35.398},{"time":19.558,"pitch":35.54},{"time":19.567,"pitch":35.648},{"time":19.575,"pitch":35.731},{"time":19.583,"pitch":35.794},{"time":19.592,"pitch":35.842},{"time":19.6,"pitch":35.879},{"time":19.608,"pitch":35.908},{"time":19.617,"pitch":35.929},{"time":19.625,"pitch":35.946},{"time":19.633,"pitch":35.959},{"time":19.642,"pitch":35.968},{"time":19.65,"pitch":35.976},{"time":19.658,"pitch":35.981},{"time":19.667,"pitch":35.986},{"time":19.675,"pitch":35.989},{"time":19.683,"pitch":35.992},{"time":19.692,"pitch":35.994},{"time":19.7,"pitch":35.995},{"time":19.708,"pitch":35.996},{"time":19.717,"pitch":35.997},{"time":19.725,"pitch":35.998},{"time":19.742,"pitch":35.999},{"time":19.775,"pitch":36},{"time":20,"pitch":36.47},{"time":20.008,"pitch":36.829},{"time":20.017,"pitch":37.104},{"time":20.025,"pitch":37.315},{"time":20.033,"pitch":37.476},{"time":20.042,"pitch":37.599},{"time":20.05,"pitch":37.693},{"time":20.058,"pitch":37.765},{"time":20.067,"pitch":37.82},{"time":20.075,"pitch":37.863},{"time":20.083,"pitch":37.895},{"time":20.092,"pitch":37.92},{"time":20.1,"pitch":37.938},{"time":20.108,"pitch":37.953},{"time":20.117,"pitch":37.964},{"time":20.125,"pitch":37.972},{"time":20.133,"pitch":37.979},{"time":20.142,"pitch":37.984},{"time":20.15,"pitch":37.988},{"time":20.158,"pitch":37.991},{"time":20.167,"pitch":37.993},{"time":20.175,"pitch":37.994},{"time":20.183,"pitch":37.996},{"time":20.192,"pitch":37.997},{"time":20.2,"pitch":37.998},{"time":20.217,"pitch":37.999},{"time":20.25,"pitch":38},{"time":20.733,"pitch":38.705},{"time":20.742,"pitch":39.244},{"time":20.75,"pitch":39.656},{"time":20.758,"pitch":39.972},{"time":20.767,"pitch":40.213},{"time":20.775,"pitch":40.398},{"time":20.783,"pitch":40.54},{"time":20.792,"pitch":40.648},{"time":20.8,"pitch":40.73},{"time":20.808,"pitch":40.794},{"time":20.817,"pitch":40.842},{"time":20.825,"pitch":40.879},{"time":20.833,"pitch":40.908},{"time":20.842,"pitch":40.929},{"time":20.85,"pitch":40.946},{"time":20.858,"pitch":40.959},{"time":20.867,"pitch":40.968},{"time":20.875,"pitch":40.976},{"time":20.883,"pitch":40.981},{"time":20.892,"pitch":40.986},{"time":20.9,"pitch":40.989},{"time":20.908,"pitch":40.992},{"time":20.917,"pitch":40.994},{"time":20.925,"pitch":40.995},{"time":20.933,"pitch":40.996},{"time":20.942,"pitch":40.997},{"time":20.95,"pitch":40.998},{"time":20.967,"pitch":40.999},{"time":21,"pitch":41},{"time":21.258,"pitch":40.295},{"time":21.267,"pitch":39.756},{"time":21.275,"pitch":39.344},{"time":21.283,"pitch":39.028},{"time":21.292,"pitch":38.787},{"time":21.3,"pitch":38.602},{"time":21.308,"pitch":38.46},{"time":21.317,"pitch":38.352},{"time":21.325,"pitch":38.27},{"time":21.333,"pitch":38.206},{"time":21.342,"pitch":38.158},{"time":21.35,"pitch":38.121},{"time":21.358,"pitch":38.092},{"time":21.367,"pitch":38.071},{"time":21.375,"pitch":38.054},{"time":21.383,"pitch":38.041},{"time":21.392,"pitch":38.032},{"time":21.4,"pitch":38.024},{"time":21.408,"pitch":38.019},{"time":21.417,"pitch":38.014},{"time":21.425,"pitch":38.011},{"time":21.433,"pitch":38.008},{"time":21.442,"pitch":38.006},{"time":21.45,"pitch":38.005},{"time":21.458,"pitch":38.004},{"time":21.467,"pitch":38.003},{"time":21.475,"pitch":38.002},{"time":21.492,"pitch":38.001},{"time":21.5,"pitch":38.706},{"time":21.508,"pitch":39.245},{"time":21.517,"pitch":39.657},{"time":21.525,"pitch":39.972},{"time":21.533,"pitch":40.214},{"time":21.542,"pitch":40.398},{"time":21.55,"pitch":40.54},{"time":21.558,"pitch":40.648},{"time":21.567,"pitch":40.731},{"time":21.575,"pitch":40.794},{"time":21.583,"pitch":40.842},{"time":21.592,"pitch":40.879},{"time":21.6,"pitch":40.908},{"time":21.608,"pitch":40.929},{"time":21.617,"pitch":40.946},{"time":21.625,"pitch":40.959},{"time":21.633,"pitch":40.968},{"time":21.642,"pitch":40.976},{"time":21.65,"pitch":40.981},{"time":21.658,"pitch":40.986},{"time":21.667,"pitch":40.989},{"time":21.675,"pitch":40.992},{"time":21.683,"pitch":40.994},{"time":21.692,"pitch":40.995},{"time":21.7,"pitch":40.996},{"time":21.708,"pitch":40.997},{"time":21.717,"pitch":40.998},{"time":21.733,"pitch":40.999},{"time":21.767,"pitch":41},{"time":22.008,"pitch":40.295},{"time":22.017,"pitch":39.756},{"time":22.025,"pitch":39.344},{"time":22.033,"pitch":39.028},{"time":22.042,"pitch":38.787},{"time":22.05,"pitch":38.602},{"time":22.058,"pitch":38.46},{"time":22.067,"pitch":38.352},{"time":22.075,"pitch":38.27},{"time":22.083,"pitch":38.206},{"time":22.092,"pitch":38.158},{"time":22.1,"pitch":38.121},{"time":22.108,"pitch":38.092},{"time":22.117,"pitch":38.071},{"time":22.125,"pitch":38.054},{"time":22.133,"pitch":38.041},{"time":22.142,"pitch":38.032},{"time":22.15,"pitch":38.024},{"time":22.158,"pitch":38.019},{"time":22.167,"pitch":38.014},{"time":22.175,"pitch":38.011},{"time":22.183,"pitch":38.008},{"time":22.192,"pitch":38.006},{"time":22.2,"pitch":38.005},{"time":22.208,"pitch":38.004},{"time":22.217,"pitch":38.003},{"time":22.225,"pitch":38.002},{"time":22.242,"pitch":38.001},{"time":22.275,"pitch":38},{"time":22.758,"pitch":37.53},{"time":22.767,"pitch":37.171},{"time":22.775,"pitch":36.896},{"time":22.783,"pitch":36.685},{"time":22.792,"pitch":36.524},{"time":22.8,"pitch":36.401},{"time":22.808,"pitch":36.307},{"time":22.817,"pitch":36.235},{"time":22.825,"pitch":36.18},{"time":22.833,"pitch":36.137},{"time":22.842,"pitch":36.105},{"time":22.85,"pitch":36.08},{"time":22.858,"pitch":36.062},{"time":22.867,"pitch":36.047},{"time":22.875,"pitch":36.036},{"time":22.883,"pitch":36.028},{"time":22.892,"pitch":36.021},{"time":22.9,"pitch":36.016},{"time":22.908,"pitch":36.012},{"time":22.917,"pitch":36.009},{"time":22.925,"pitch":36.007},{"time":22.933,"pitch":36.006},{"time":22.942,"pitch":36.004},{"time":22.95,"pitch":36.003},{"time":22.958,"pitch":36.002},{"time":22.975,"pitch":36.001},{"time":23.008,"pitch":36},{"time":23.258,"pitch":35.295},{"time":23.267,"pitch":34.756},{"time":23.275,"pitch":34.344},{"time":23.283,"pitch":34.028},{"time":23.292,"pitch":33.787},{"time":23.3,"pitch":33.602},{"time":23.308,"pitch":33.46},{"time":23.317,"pitch":33.352},{"time":23.325,"pitch":33.27},{"time":23.333,"pitch":33.206},{"time":23.342,"pitch":33.158},{"time":23.35,"pitch":33.121},{"time":23.358,"pitch":33.092},{"time":23.367,"pitch":33.071},{"time":23.375,"pitch":33.054},{"time":23.383,"pitch":33.041},{"time":23.392,"pitch":33.032},{"time":23.4,"pitch":33.024},{"time":23.408,"pitch":33.019},{"time":23.417,"pitch":33.014},{"time":23.425,"pitch":33.011},{"time":23.433,"pitch":33.008},{"time":23.442,"pitch":33.006},{"time":23.45,"pitch":33.005},{"time":23.458,"pitch":33.004},{"time":23.467,"pitch":33.003},{"time":23.475,"pitch":33.002},{"time":23.492,"pitch":33.001},{"time":23.508,"pitch":33.705},{"time":23.517,"pitch":34.244},{"time":23.525,"pitch":34.657},{"time":23.533,"pitch":34.972},{"time":23.542,"pitch":35.214},{"time":23.55,"pitch":35.398},{"time":23.558,"pitch":35.54},{"time":23.567,"pitch":35.648},{"time":23.575,"pitch":35.731},{"time":23.583,"pitch":35.794},{"time":23.592,"pitch":35.842},{"time":23.6,"pitch":35.879},{"time":23.608,"pitch":35.908},{"time":23.617,"pitch":35.929},{"time":23.625,"pitch":35.946},{"time":23.633,"pitch":35.959},{"time":23.642,"pitch":35.968},{"time":23.65,"pitch":35.976},{"time":23.658,"pitch":35.981},{"time":23.667,"pitch":35.986},{"time":23.675,"pitch":35.989},{"time":23.683,"pitch":35.992},{"time":23.692,"pitch":35.994},{"time":23.7,"pitch":35.995},{"time":23.708,"pitch":35.996},{"time":23.717,"pitch":35.997},{"time":23.725,"pitch":35.998},{"time":23.742,"pitch":35.999},{"time":23.775,"pitch":36},{"time":24,"pitch":36.47},{"time":24.008,"pitch":36.829},{"time":24.017,"pitch":37.104},{"time":24.025,"pitch":37.315},{"time":24.033,"pitch":37.476},{"time":24.042,"pitch":37.599},{"time":24.05,"pitch":37.693},{"time":24.058,"pitch":37.765},{"time":24.067,"pitch":37.82},{"time":24.075,"pitch":37.863},{"time":24.083,"pitch":37.895},{"time":24.092,"pitch":37.92},{"time":24.1,"pitch":37.938},{"time":24.108,"pitch":37.953},{"time":24.117,"pitch":37.964},{"time":24.125,"pitch":37.972},{"time":24.133,"pitch":37.979},{"time":24.142,"pitch":37.984},{"time":24.15,"pitch":37.988},{"time":24.158,"pitch":37.991},{"time":24.167,"pitch":37.993},{"time":24.175,"pitch":37.994},{"time":24.183,"pitch":37.996},{"time":24.192,"pitch":37.997},{"time":24.2,"pitch":37.998},{"time":24.217,"pitch":37.999},{"time":24.25,"pitch":38},{"time":24.733,"pitch":38.705},{"time":24.742,"pitch":39.244},{"time":24.75,"pitch":39.656},{"time":24.758,"pitch":39.972},{"time":24.767,"pitch":40.213},{"time":24.775,"pitch":40.398},{"time":24.783,"pitch":40.54},{"time":24.792,"pitch":40.648},{"time":24.8,"pitch":40.73},{"time":24.808,"pitch":40.794},{"time":24.817,"pitch":40.842},{"time":24.825,"pitch":40.879},{"time":24.833,"pitch":40.908},{"time":24.842,"pitch":40.929},{"time":24.85,"pitch":40.946},{"time":24.858,"pitch":40.959},{"time":24.867,"pitch":40.968},{"time":24.875,"pitch":40.976},{"time":24.883,"pitch":40.981},{"time":24.892,"pitch":40.986},{"time":24.9,"pitch":40.989},{"time":24.908,"pitch":40.992},{"time":24.917,"pitch":40.994},{"time":24.925,"pitch":40.995},{"time":24.933,"pitch":40.996},{"time":24.942,"pitch":40.997},{"time":24.95,"pitch":40.998},{"time":24.967,"pitch":40.999},{"time":25,"pitch":41},{"time":25.258,"pitch":40.295},{"time":25.267,"pitch":39.756},{"time":25.275,"pitch":39.344},{"time":25.283,"pitch":39.028},{"time":25.292,"pitch":38.787},{"time":25.3,"pitch":38.602},{"time":25.308,"pitch":38.46},{"time":25.317,"pitch":38.352},{"time":25.325,"pitch":38.27},{"time":25.333,"pitch":38.206},{"time":25.342,"pitch":38.158},{"time":25.35,"pitch":38.121},{"time":25.358,"pitch":38.092},{"time":25.367,"pitch":38.071},{"time":25.375,"pitch":38.054},{"time":25.383,"pitch":38.041},{"time":25.392,"pitch":38.032},{"time":25.4,"pitch":38.024},{"time":25.408,"pitch":38.019},{"time":25.417,"pitch":38.014},{"time":25.425,"pitch":38.011},{"time":25.433,"pitch":38.008},{"time":25.442,"pitch":38.006},{"time":25.45,"pitch":38.005},{"time":25.458,"pitch":38.004},{"time":25.467,"pitch":38.003},{"time":25.475,"pitch":38.002},{"time":25.492,"pitch":38.001},{"time":25.5,"pitch":38.706},{"time":25.508,"pitch":39.245},{"time":25.517,"pitch":39.657},{"time":25.525,"pitch":39.972},{"time":25.533,"pitch":40.214},{"time":25.542,"pitch":40.398},{"time":25.55,"pitch":40.54},{"time":25.558,"pitch":40.648},{"time":25.567,"pitch":40.731},{"time":25.575,"pitch":40.794},{"time":25.583,"pitch":40.842},{"time":25.592,"pitch":40.879},{"time":25.6,"pitch":40.908},{"time":25.608,"pitch":40.929},{"time":25.617,"pitch":40.946},{"time":25.625,"pitch":40.959},{"time":25.633,"pitch":40.968},{"time":25.642,"pitch":40.976},{"time":25.65,"pitch":40.981},{"time":25.658,"pitch":40.986},{"time":25.667,"pitch":40.989},{"time":25.675,"pitch":40.992},{"time":25.683,"pitch":40.994},{"time":25.692,"pitch":40.995},{"time":25.7,"pitch":40.996},{"time":25.708,"pitch":40.997},{"time":25.717,"pitch":40.998},{"time":25.733,"pitch":40.999},{"time":25.767,"pitch":41},{"time":26.008,"pitch":40.295},{"time":26.017,"pitch":39.756},{"time":26.025,"pitch":39.344},{"time":26.033,"pitch":39.028},{"time":26.042,"pitch":38.787},{"time":26.05,"pitch":38.602},{"time":26.058,"pitch":38.46},{"time":26.067,"pitch":38.352},{"time":26.075,"pitch":38.27},{"time":26.083,"pitch":38.206},{"time":26.092,"pitch":38.158},{"time":26.1,"pitch":38.121},{"time":26.108,"pitch":38.092},{"time":26.117,"pitch":38.071},{"time":26.125,"pitch":38.054},{"time":26.133,"pitch":38.041},{"time":26.142,"pitch":38.032},{"time":26.15,"pitch":38.024},{"time":26.158,"pitch":38.019},{"time":26.167,"pitch":38.014},{"time":26.175,"pitch":38.011},{"time":26.183,"pitch":38.008},{"time":26.192,"pitch":38.006},{"time":26.2,"pitch":38.005},{"time":26.208,"pitch":38.004},{"time":26.217,"pitch":38.003},{"time":26.225,"pitch":38.002},{"time":26.242,"pitch":38.001},{"time":26.275,"pitch":38},{"time":26.758,"pitch":37.53},{"time":26.767,"pitch":37.171},{"time":26.775,"pitch":36.896},{"time":26.783,"pitch":36.685},{"time":26.792,"pitch":36.524},{"time":26.8,"pitch":36.401},{"time":26.808,"pitch":36.307},{"time":26.817,"pitch":36.235},{"time":26.825,"pitch":36.18},{"time":26.833,"pitch":36.137},{"time":26.842,"pitch":36.105},{"time":26.85,"pitch":36.08},{"time":26.858,"pitch":36.062},{"time":26.867,"pitch":36.047},{"time":26.875,"pitch":36.036},{"time":26.883,"pitch":36.028},{"time":26.892,"pitch":36.021},{"time":26.9,"pitch":36.016},{"time":26.908,"pitch":36.012},{"time":26.917,"pitch":36.009},{"time":26.925,"pitch":36.007},{"time":26.933,"pitch":36.006},{"time":26.942,"pitch":36.004},{"time":26.95,"pitch":36.003},{"time":26.958,"pitch":36.002},{"time":26.975,"pitch":36.001},{"time":27.008,"pitch":36},{"time":27.258,"pitch":35.295},{"time":27.267,"pitch":34.756},{"time":27.275,"pitch":34.344},{"time":27.283,"pitch":34.028},{"time":27.292,"pitch":33.787},{"time":27.3,"pitch":33.602},{"time":27.308,"pitch":33.46},{"time":27.317,"pitch":33.352},{"time":27.325,"pitch":33.27},{"time":27.333,"pitch":33.206},{"time":27.342,"pitch":33.158},{"time":27.35,"pitch":33.121},{"time":27.358,"pitch":33.092},{"time":27.367,"pitch":33.071},{"time":27.375,"pitch":33.054},{"time":27.383,"pitch":33.041},{"time":27.392,"pitch":33.032},{"time":27.4,"pitch":33.024},{"time":27.408,"pitch":33.019},{"time":27.417,"pitch":33.014},{"time":27.425,"pitch":33.011},{"time":27.433,"pitch":33.008},{"time":27.442,"pitch":33.006},{"time":27.45,"pitch":33.005},{"time":27.458,"pitch":33.004},{"time":27.467,"pitch":33.003},{"time":27.475,"pitch":33.002},{"time":27.492,"pitch":33.001},{"time":27.508,"pitch":33.705},{"time":27.517,"pitch":34.244},{"time":27.525,"pitch":34.657},{"time":27.533,"pitch":34.972},{"time":27.542,"pitch":35.214},{"time":27.55,"pitch":35.398},{"time":27.558,"pitch":35.54},{"time":27.567,"pitch":35.648},{"time":27.575,"pitch":35.731},{"time":27.583,"pitch":35.794},{"time":27.592,"pitch":35.842},{"time":27.6,"pitch":35.879},{"time":27.608,"pitch":35.908},{"time":27.617,"pitch":35.929},{"time":27.625,"pitch":35.946},{"time":27.633,"pitch":35.959},{"time":27.642,"pitch":35.968},{"time":27.65,"pitch":35.976},{"time":27.658,"pitch":35.981},{"time":27.667,"pitch":35.986},{"time":27.675,"pitch":35.989},{"time":27.683,"pitch":35.992},{"time":27.692,"pitch":35.994},{"time":27.7,"pitch":35.995},{"time":27.708,"pitch":35.996},{"time":27.717,"pitch":35.997},{"time":27.725,"pitch":35.998},{"time":27.742,"pitch":35.999},{"time":27.775,"pitch":36},{"time":28,"pitch":36.47},{"time":28.008,"pitch":36.829},{"time":28.017,"pitch":37.104},{"time":28.025,"pitch":37.315},{"time":28.033,"pitch":37.476},{"time":28.042,"pitch":37.599},{"time":28.05,"pitch":37.693},{"time":28.058,"pitch":37.765},{"time":28.067,"pitch":37.82},{"time":28.075,"pitch":37.863},{"time":28.083,"pitch":37.895},{"time":28.092,"pitch":37.92},{"time":28.1,"pitch":37.938},{"time":28.108,"pitch":37.953},{"time":28.117,"pitch":37.964},{"time":28.125,"pitch":37.972},{"time":28.133,"pitch":37.979},{"time":28.142,"pitch":37.984},{"time":28.15,"pitch":37.988},{"time":28.158,"pitch":37.991},{"time":28.167,"pitch":37.993},{"time":28.175,"pitch":37.994},{"time":28.183,"pitch":37.996},{"time":28.192,"pitch":37.997},{"time":28.2,"pitch":37.998},{"time":28.217,"pitch":37.999},{"time":28.25,"pitch":38},{"time":28.733,"pitch":38.705},{"time":28.742,"pitch":39.244},{"time":28.75,"pitch":39.656},{"time":28.758,"pitch":39.972},{"time":28.767,"pitch":40.213},{"time":28.775,"pitch":40.398},{"time":28.783,"pitch":40.54},{"time":28.792,"pitch":40.648},{"time":28.8,"pitch":40.73},{"time":28.808,"pitch":40.794},{"time":28.817,"pitch":40.842},{"time":28.825,"pitch":40.879},{"time":28.833,"pitch":40.908},{"time":28.842,"pitch":40.929},{"time":28.85,"pitch":40.946},{"time":28.858,"pitch":40.959},{"time":28.867,"pitch":40.968},{"time":28.875,"pitch":40.976},{"time":28.883,"pitch":40.981},{"time":28.892,"pitch":40.986},{"time":28.9,"pitch":40.989},{"time":28.908,"pitch":40.992},{"time":28.917,"pitch":40.994},{"time":28.925,"pitch":40.995},{"time":28.933,"pitch":40.996},{"time":28.942,"pitch":40.997},{"time":28.95,"pitch":40.998},{"time":28.967,"pitch":40.999},{"time":29,"pitch":41},{"time":29.225,"pitch":41.705},{"time":29.233,"pitch":42.244},{"time":29.242,"pitch":42.656},{"time":29.25,"pitch":42.972},{"time":29.258,"pitch":43.213},{"time":29.267,"pitch":43.398},{"time":29.275,"pitch":43.54},{"time":29.283,"pitch":43.648},{"time":29.292,"pitch":43.73},{"time":29.3,"pitch":43.794},{"time":29.308,"pitch":43.842},{"time":29.317,"pitch":43.879},{"time":29.325,"pitch":43.908},{"time":29.333,"pitch":43.929},{"time":29.342,"pitch":43.946},{"time":29.35,"pitch":43.959},{"time":29.358,"pitch":43.968},{"time":29.367,"pitch":43.976},{"time":29.375,"pitch":43.981},{"time":29.383,"pitch":43.986},{"time":29.392,"pitch":43.989},{"time":29.4,"pitch":43.992},{"time":29.408,"pitch":43.994},{"time":29.417,"pitch":43.995},{"time":29.425,"pitch":43.996},{"time":29.433,"pitch":43.997},{"time":29.442,"pitch":43.998},{"time":29.458,"pitch":43.999},{"time":29.492,"pitch":44},{"time":29.525,"pitch":43.765},{"time":29.533,"pitch":43.585},{"time":29.542,"pitch":43.448},{"time":29.55,"pitch":43.343},{"time":29.558,"pitch":43.262},{"time":29.567,"pitch":43.201},{"time":29.575,"pitch":43.153},{"time":29.583,"pitch":43.117},{"time":29.592,"pitch":43.09},{"time":29.6,"pitch":43.069},{"time":29.608,"pitch":43.053},{"time":29.617,"pitch":43.04},{"time":29.625,"pitch":43.031},{"time":29.633,"pitch":43.024},{"time":29.642,"pitch":43.018},{"time":29.65,"pitch":43.014},{"time":29.658,"pitch":43.011},{"time":29.667,"pitch":43.008},{"time":29.675,"pitch":43.006},{"time":29.683,"pitch":43.005},{"time":29.692,"pitch":43.004},{"time":29.7,"pitch":43.003},{"time":29.708,"pitch":43.002},{"time":29.725,"pitch":43.001},{"time":29.758,"pitch":43},{"time":30,"pitch":42.53},{"time":30.008,"pitch":42.171},{"time":30.017,"pitch":41.896},{"time":30.025,"pitch":41.685},{"time":30.033,"pitch":41.524},{"time":30.042,"pitch":41.401},{"time":30.05,"pitch":41.307},{"time":30.058,"pitch":41.235},{"time":30.067,"pitch":41.18},{"time":30.075,"pitch":41.137},{"time":30.083,"pitch":41.105},{"time":30.092,"pitch":41.08},{"time":30.1,"pitch":41.062},{"time":30.108,"pitch":41.047},{"time":30.117,"pitch":41.036},{"time":30.125,"pitch":41.028},{"time":30.133,"pitch":41.021},{"time":30.142,"pitch":41.016},{"time":30.15,"pitch":41.012},{"time":30.158,"pitch":41.009},{"time":30.167,"pitch":41.007},{"time":30.175,"pitch":41.006},{"time":30.183,"pitch":41.004},{"time":30.192,"pitch":41.003},{"time":30.2,"pitch":41.002},{"time":30.217,"pitch":41.001},{"time":30.25,"pitch":41},{"time":30.758,"pitch":40.295},{"time":30.767,"pitch":39.756},{"time":30.775,"pitch":39.344},{"time":30.783,"pitch":39.028},{"time":30.792,"pitch":38.787},{"time":30.8,"pitch":38.602},{"time":30.808,"pitch":38.46},{"time":30.817,"pitch":38.352},{"time":30.825,"pitch":38.27},{"time":30.833,"pitch":38.206},{"time":30.842,"pitch":38.158},{"time":30.85,"pitch":38.121},{"time":30.858,"pitch":38.092},{"time":30.867,"pitch":38.071},{"time":30.875,"pitch":38.054},{"time":30.883,"pitch":38.041},{"time":30.892,"pitch":38.032},{"time":30.9,"pitch":38.024},{"time":30.908,"pitch":38.019},{"time":30.917,"pitch":38.014},{"time":30.925,"pitch":38.011},{"time":30.933,"pitch":38.008},{"time":30.942,"pitch":38.006},{"time":30.95,"pitch":38.005},{"time":30.958,"pitch":38.004},{"time":30.967,"pitch":38.003},{"time":30.975,"pitch":38.002},{"time":30.992,"pitch":38.001},{"time":31.025,"pitch":38},{"time":31.208,"pitch":36.826},{"time":31.217,"pitch":35.927},{"time":31.225,"pitch":35.239},{"time":31.233,"pitch":34.713},{"time":31.242,"pitch":34.311},{"time":31.25,"pitch":34.003},{"time":31.258,"pitch":33.767},{"time":31.267,"pitch":33.587},{"time":31.275,"pitch":33.449},{"time":31.283,"pitch":33.344},{"time":31.292,"pitch":33.263},{"time":31.3,"pitch":33.201},{"time":31.308,"pitch":33.154},{"time":31.317,"pitch":33.118},{"time":31.325,"pitch":33.09},{"time":31.333,"pitch":33.069},{"time":31.342,"pitch":33.053},{"time":31.35,"pitch":33.04},{"time":31.358,"pitch":33.031},{"time":31.367,"pitch":33.024},{"time":31.375,"pitch":33.018},{"time":31.383,"pitch":33.014},{"time":31.392,"pitch":33.011},{"time":31.4,"pitch":33.008},{"time":31.408,"pitch":33.006},{"time":31.417,"pitch":33.005},{"time":31.425,"pitch":33.004},{"time":31.433,"pitch":33.003},{"time":31.442,"pitch":33.002},{"time":31.458,"pitch":33.001},{"time":31.492,"pitch":33},{"time":31.508,"pitch":33.705},{"time":31.517,"pitch":34.244},{"time":31.525,"pitch":34.657},{"time":31.533,"pitch":34.972},{"time":31.542,"pitch":35.214},{"time":31.55,"pitch":35.398},{"time":31.558,"pitch":35.54},{"time":31.567,"pitch":35.648},{"time":31.575,"pitch":35.73},{"time":31.583,"pitch":35.794},{"time":31.592,"pitch":35.842},{"time":31.6,"pitch":35.879},{"time":31.608,"pitch":35.908},{"time":31.617,"pitch":35.929},{"time":31.625,"pitch":35.946},{"time":31.633,"pitch":35.959},{"time":31.642,"pitch":35.968},{"time":31.65,"pitch":35.976},{"time":31.658,"pitch":35.981},{"time":31.667,"pitch":35.986},{"time":31.675,"pitch":35.989},{"time":31.683,"pitch":35.992},{"time":31.692,"pitch":35.994},{"time":31.7,"pitch":35.995},{"time":31.708,"pitch":35.996},{"time":31.717,"pitch":35.997},{"time":31.725,"pitch":35.998},{"time":31.742,"pitch":35.999},{"time":31.775,"pitch":36},{"time":32,"pitch":36.47},{"time":32.008,"pitch":36.829},{"time":32.017,"pitch":37.104},{"time":32.025,"pitch":37.315},{"time":32.033,"pitch":37.476},{"time":32.042,"pitch":37.599},{"time":32.05,"pitch":37.693},{"time":32.058,"pitch":37.765},{"time":32.067,"pitch":37.82},{"time":32.075,"pitch":37.863},{"time":32.083,"pitch":37.895},{"time":32.092,"pitch":37.92},{"time":32.1,"pitch":37.938},{"time":32.108,"pitch":37.953},{"time":32.117,"pitch":37.964},{"time":32.125,"pitch":37.972},{"time":32.133,"pitch":37.979},{"time":32.142,"pitch":37.984},{"time":32.15,"pitch":37.988},{"time":32.158,"pitch":37.991},{"time":32.167,"pitch":37.993},{"time":32.175,"pitch":37.994},{"time":32.183,"pitch":37.996},{"time":32.192,"pitch":37.997},{"time":32.2,"pitch":37.998},{"time":32.217,"pitch":37.999},{"time":32.25,"pitch":38},{"time":32.733,"pitch":38.705},{"time":32.742,"pitch":39.244},{"time":32.75,"pitch":39.656},{"time":32.758,"pitch":39.972},{"time":32.767,"pitch":40.213},{"time":32.775,"pitch":40.398},{"time":32.783,"pitch":40.54},{"time":32.792,"pitch":40.648},{"time":32.8,"pitch":40.73},{"time":32.808,"pitch":40.794},{"time":32.817,"pitch":40.842},{"time":32.825,"pitch":40.879},{"time":32.833,"pitch":40.908},{"time":32.842,"pitch":40.929},{"time":32.85,"pitch":40.946},{"time":32.858,"pitch":40.959},{"time":32.867,"pitch":40.968},{"time":32.875,"pitch":40.976},{"time":32.883,"pitch":40.981},{"time":32.892,"pitch":40.986},{"time":32.9,"pitch":40.989},{"time":32.908,"pitch":40.992},{"time":32.917,"pitch":40.994},{"time":32.925,"pitch":40.995},{"time":32.933,"pitch":40.996},{"time":32.942,"pitch":40.997},{"time":32.95,"pitch":40.998},{"time":32.967,"pitch":40.999},{"time":33,"pitch":41},{"time":33.258,"pitch":40.295},{"time":33.267,"pitch":39.756},{"time":33.275,"pitch":39.344},{"time":33.283,"pitch":39.028},{"time":33.292,"pitch":38.787},{"time":33.3,"pitch":38.602},{"time":33.308,"pitch":38.46},{"time":33.317,"pitch":38.352},{"time":33.325,"pitch":38.27},{"time":33.333,"pitch":38.206},{"time":33.342,"pitch":38.158},{"time":33.35,"pitch":38.121},{"time":33.358,"pitch":38.092},{"time":33.367,"pitch":38.071},{"time":33.375,"pitch":38.054},{"time":33.383,"pitch":38.041},{"time":33.392,"pitch":38.032},{"time":33.4,"pitch":38.024},{"time":33.408,"pitch":38.019},{"time":33.417,"pitch":38.014},{"time":33.425,"pitch":38.011},{"time":33.433,"pitch":38.008},{"time":33.442,"pitch":38.006},{"time":33.45,"pitch":38.005},{"time":33.458,"pitch":38.004},{"time":33.467,"pitch":38.003},{"time":33.475,"pitch":38.002},{"time":33.492,"pitch":38.001},{"time":33.5,"pitch":38.706},{"time":33.508,"pitch":39.245},{"time":33.517,"pitch":39.657},{"time":33.525,"pitch":39.972},{"time":33.533,"pitch":40.214},{"time":33.542,"pitch":40.398},{"time":33.55,"pitch":40.54},{"time":33.558,"pitch":40.648},{"time":33.567,"pitch":40.731},{"time":33.575,"pitch":40.794},{"time":33.583,"pitch":40.842},{"time":33.592,"pitch":40.879},{"time":33.6,"pitch":40.908},{"time":33.608,"pitch":40.929},{"time":33.617,"pitch":40.946},{"time":33.625,"pitch":40.959},{"time":33.633,"pitch":40.968},{"time":33.642,"pitch":40.976},{"time":33.65,"pitch":40.981},{"time":33.658,"pitch":40.986},{"time":33.667,"pitch":40.989},{"time":33.675,"pitch":40.992},{"time":33.683,"pitch":40.994},{"time":33.692,"pitch":40.995},{"time":33.7,"pitch":40.996},{"time":33.708,"pitch":40.997},{"time":33.717,"pitch":40.998},{"time":33.733,"pitch":40.999},{"time":33.767,"pitch":41},{"time":34.008,"pitch":40.295},{"time":34.017,"pitch":39.756},{"time":34.025,"pitch":39.344},{"time":34.033,"pitch":39.028},{"time":34.042,"pitch":38.787},{"time":34.05,"pitch":38.602},{"time":34.058,"pitch":38.46},{"time":34.067,"pitch":38.352},{"time":34.075,"pitch":38.27},{"time":34.083,"pitch":38.206},{"time":34.092,"pitch":38.158},{"time":34.1,"pitch":38.121},{"time":34.108,"pitch":38.092},{"time":34.117,"pitch":38.071},{"time":34.125,"pitch":38.054},{"time":34.133,"pitch":38.041},{"time":34.142,"pitch":38.032},{"time":34.15,"pitch":38.024},{"time":34.158,"pitch":38.019},{"time":34.167,"pitch":38.014},{"time":34.175,"pitch":38.011},{"time":34.183,"pitch":38.008},{"time":34.192,"pitch":38.006},{"time":34.2,"pitch":38.005},{"time":34.208,"pitch":38.004},{"time":34.217,"pitch":38.003},{"time":34.225,"pitch":38.002},{"time":34.242,"pitch":38.001},{"time":34.275,"pitch":38},{"time":34.758,"pitch":37.53},{"time":34.767,"pitch":37.171},{"time":34.775,"pitch":36.896},{"time":34.783,"pitch":36.685},{"time":34.792,"pitch":36.524},{"time":34.8,"pitch":36.401},{"time":34.808,"pitch":36.307},{"time":34.817,"pitch":36.235},{"time":34.825,"pitch":36.18},{"time":34.833,"pitch":36.137},{"time":34.842,"pitch":36.105},{"time":34.85,"pitch":36.08},{"time":34.858,"pitch":36.062},{"time":34.867,"pitch":36.047},{"time":34.875,"pitch":36.036},{"time":34.883,"pitch":36.028},{"time":34.892,"pitch":36.021},{"time":34.9,"pitch":36.016},{"time":34.908,"pitch":36.012},{"time":34.917,"pitch":36.009},{"time":34.925,"pitch":36.007},{"time":34.933,"pitch":36.006},{"time":34.942,"pitch":36.004},{"time":34.95,"pitch":36.003},{"time":34.958,"pitch":36.002},{"time":34.975,"pitch":36.001},{"time":35.008,"pitch":36},{"time":35.258,"pitch":35.295},{"time":35.267,"pitch":34.756},{"time":35.275,"pitch":34.344},{"time":35.283,"pitch":34.028},{"time":35.292,"pitch":33.787},{"time":35.3,"pitch":33.602},{"time":35.308,"pitch":33.46},{"time":35.317,"pitch":33.352},{"time":35.325,"pitch":33.27},{"time":35.333,"pitch":33.206},{"time":35.342,"pitch":33.158},{"time":35.35,"pitch":33.121},{"time":35.358,"pitch":33.092},{"time":35.367,"pitch":33.071},{"time":35.375,"pitch":33.054},{"time":35.383,"pitch":33.041},{"time":35.392,"pitch":33.032},{"time":35.4,"pitch":33.024},{"time":35.408,"pitch":33.019},{"time":35.417,"pitch":33.014},{"time":35.425,"pitch":33.011},{"time":35.433,"pitch":33.008},{"time":35.442,"pitch":33.006},{"time":35.45,"pitch":33.005},{"time":35.458,"pitch":33.004},{"time":35.467,"pitch":33.003},{"time":35.475,"pitch":33.002},{"time":35.492,"pitch":33.001},{"time":35.508,"pitch":33.705},{"time":35.517,"pitch":34.244},{"time":35.525,"pitch":34.657},{"time":35.533,"pitch":34.972},{"time":35.542,"pitch":35.214},{"time":35.55,"pitch":35.398},{"time":35.558,"pitch":35.54},{"time":35.567,"pitch":35.648},{"time":35.575,"pitch":35.731},{"time":35.583,"pitch":35.794},{"time":35.592,"pitch":35.842},{"time":35.6,"pitch":35.879},{"time":35.608,"pitch":35.908},{"time":35.617,"pitch":35.929},{"time":35.625,"pitch":35.946},{"time":35.633,"pitch":35.959},{"time":35.642,"pitch":35.968},{"time":35.65,"pitch":35.976},{"time":35.658,"pitch":35.981},{"time":35.667,"pitch":35.986},{"time":35.675,"pitch":35.989},{"time":35.683,"pitch":35.992},{"time":35.692,"pitch":35.994},{"time":35.7,"pitch":35.995},{"time":35.708,"pitch":35.996},{"time":35.717,"pitch":35.997},{"time":35.725,"pitch":35.998},{"time":35.742,"pitch":35.999},{"time":35.775,"pitch":36},{"time":36,"pitch":36.47},{"time":36.008,"pitch":36.829},{"time":36.017,"pitch":37.104},{"time":36.025,"pitch":37.315},{"time":36.033,"pitch":37.476},{"time":36.042,"pitch":37.599},{"time":36.05,"pitch":37.693},{"time":36.058,"pitch":37.765},{"time":36.067,"pitch":37.82},{"time":36.075,"pitch":37.863},{"time":36.083,"pitch":37.895},{"time":36.092,"pitch":37.92},{"time":36.1,"pitch":37.938},{"time":36.108,"pitch":37.953},{"time":36.117,"pitch":37.964},{"time":36.125,"pitch":37.972},{"time":36.133,"pitch":37.979},{"time":36.142,"pitch":37.984},{"time":36.15,"pitch":37.988},{"time":36.158,"pitch":37.991},{"time":36.167,"pitch":37.993},{"time":36.175,"pitch":37.994},{"time":36.183,"pitch":37.996},{"time":36.192,"pitch":37.997},{"time":36.2,"pitch":37.998},{"time":36.217,"pitch":37.999},{"time":36.25,"pitch":38},{"time":36.733,"pitch":38.705},{"time":36.742,"pitch":39.244},{"time":36.75,"pitch":39.656},{"time":36.758,"pitch":39.972},{"time":36.767,"pitch":40.213},{"time":36.775,"pitch":40.398},{"time":36.783,"pitch":40.54},{"time":36.792,"pitch":40.648},{"time":36.8,"pitch":40.73},{"time":36.808,"pitch":40.794},{"time":36.817,"pitch":40.842},{"time":36.825,"pitch":40.879},{"time":36.833,"pitch":40.908},{"time":36.842,"pitch":40.929},{"time":36.85,"pitch":40.946},{"time":36.858,"pitch":40.959},{"time":36.867,"pitch":40.968},{"time":36.875,"pitch":40.976},{"time":36.883,"pitch":40.981},{"time":36.892,"pitch":40.986},{"time":36.9,"pitch":40.989},{"time":36.908,"pitch":40.992},{"time":36.917,"pitch":40.994},{"time":36.925,"pitch":40.995},{"time":36.933,"pitch":40.996},{"time":36.942,"pitch":40.997},{"time":36.95,"pitch":40.998},{"time":36.967,"pitch":40.999},{"time":37,"pitch":41},{"time":37.225,"pitch":41.705},{"time":37.233,"pitch":42.244},{"time":37.242,"pitch":42.656},{"time":37.25,"pitch":42.972},{"time":37.258,"pitch":43.213},{"time":37.267,"pitch":43.398},{"time":37.275,"pitch":43.54},{"time":37.283,"pitch":43.648},{"time":37.292,"pitch":43.73},{"time":37.3,"pitch":43.794},{"time":37.308,"pitch":43.842},{"time":37.317,"pitch":43.879},{"time":37.325,"pitch":43.908},{"time":37.333,"pitch":43.929},{"time":37.342,"pitch":43.946},{"time":37.35,"pitch":43.959},{"time":37.358,"pitch":43.968},{"time":37.367,"pitch":43.976},{"time":37.375,"pitch":43.981},{"time":37.383,"pitch":43.986},{"time":37.392,"pitch":43.989},{"time":37.4,"pitch":43.992},{"time":37.408,"pitch":43.994},{"time":37.417,"pitch":43.995},{"time":37.425,"pitch":43.996},{"time":37.433,"pitch":43.997},{"time":37.442,"pitch":43.998},{"time":37.458,"pitch":43.999},{"time":37.492,"pitch":44},{"time":37.525,"pitch":43.765},{"time":37.533,"pitch":43.585},{"time":37.542,"pitch":43.448},{"time":37.55,"pitch":43.343},{"time":37.558,"pitch":43.262},{"time":37.567,"pitch":43.201},{"time":37.575,"pitch":43.153},{"time":37.583,"pitch":43.117},{"time":37.592,"pitch":43.09},{"time":37.6,"pitch":43.069},{"time":37.608,"pitch":43.053},{"time":37.617,"pitch":43.04},{"time":37.625,"pitch":43.031},{"time":37.633,"pitch":43.024},{"time":37.642,"pitch":43.018},{"time":37.65,"pitch":43.014},{"time":37.658,"pitch":43.011},{"time":37.667,"pitch":43.008},{"time":37.675,"pitch":43.006},{"time":37.683,"pitch":43.005},{"time":37.692,"pitch":43.004},{"time":37.7,"pitch":43.003},{"time":37.708,"pitch":43.002},{"time":37.725,"pitch":43.001},{"time":37.758,"pitch":43},{"time":38,"pitch":42.53},{"time":38.008,"pitch":42.171},{"time":38.017,"pitch":41.896},{"time":38.025,"pitch":41.685},{"time":38.033,"pitch":41.524},{"time":38.042,"pitch":41.401},{"time":38.05,"pitch":41.307},{"time":38.058,"pitch":41.235},{"time":38.067,"pitch":41.18},{"time":38.075,"pitch":41.137},{"time":38.083,"pitch":41.105},{"time":38.092,"pitch":41.08},{"time":38.1,"pitch":41.062},{"time":38.108,"pitch":41.047},{"time":38.117,"pitch":41.036},{"time":38.125,"pitch":41.028},{"time":38.133,"pitch":41.021},{"time":38.142,"pitch":41.016},{"time":38.15,"pitch":41.012},{"time":38.158,"pitch":41.009},{"time":38.167,"pitch":41.007},{"time":38.175,"pitch":41.006},{"time":38.183,"pitch":41.004},{"time":38.192,"pitch":41.003},{"time":38.2,"pitch":41.002},{"time":38.217,"pitch":41.001},{"time":38.25,"pitch":41},{"time":38.758,"pitch":40.295},{"time":38.767,"pitch":39.756},{"time":38.775,"pitch":39.344},{"time":38.783,"pitch":39.028},{"time":38.792,"pitch":38.787},{"time":38.8,"pitch":38.602},{"time":38.808,"pitch":38.46},{"time":38.817,"pitch":38.352},{"time":38.825,"pitch":38.27},{"time":38.833,"pitch":38.206},{"time":38.842,"pitch":38.158},{"time":38.85,"pitch":38.121},{"time":38.858,"pitch":38.092},{"time":38.867,"pitch":38.071},{"time":38.875,"pitch":38.054},{"time":38.883,"pitch":38.041},{"time":38.892,"pitch":38.032},{"time":38.9,"pitch":38.024},{"time":38.908,"pitch":38.019},{"time":38.917,"pitch":38.014},{"time":38.925,"pitch":38.011},{"time":38.933,"pitch":38.008},{"time":38.942,"pitch":38.006},{"time":38.95,"pitch":38.005},{"time":38.958,"pitch":38.004},{"time":38.967,"pitch":38.003},{"time":38.975,"pitch":38.002},{"time":38.992,"pitch":38.001},{"time":39.025,"pitch":38},{"time":39.208,"pitch":36.826},{"time":39.217,"pitch":35.927},{"time":39.225,"pitch":35.239},{"time":39.233,"pitch":34.713},{"time":39.242,"pitch":34.311},{"time":39.25,"pitch":34.003},{"time":39.258,"pitch":33.767},{"time":39.267,"pitch":33.587},{"time":39.275,"pitch":33.449},{"time":39.283,"pitch":33.344},{"time":39.292,"pitch":33.263},{"time":39.3,"pitch":33.201},{"time":39.308,"pitch":33.154},{"time":39.317,"pitch":33.118},{"time":39.325,"pitch":33.09},{"time":39.333,"pitch":33.069},{"time":39.342,"pitch":33.053},{"time":39.35,"pitch":33.04},{"time":39.358,"pitch":33.031},{"time":39.367,"pitch":33.024},{"time":39.375,"pitch":33.018},{"time":39.383,"pitch":33.014},{"time":39.392,"pitch":33.011},{"time":39.4,"pitch":33.008},{"time":39.408,"pitch":33.006},{"time":39.417,"pitch":33.005},{"time":39.425,"pitch":33.004},{"time":39.433,"pitch":33.003},{"time":39.442,"pitch":33.002},{"time":39.458,"pitch":33.001},{"time":39.492,"pitch":33},{"time":39.508,"pitch":33.705},{"time":39.517,"pitch":34.244},{"time":39.525,"pitch":34.657},{"time":39.533,"pitch":34.972},{"time":39.542,"pitch":35.214},{"time":39.55,"pitch":35.398},{"time":39.558,"pitch":35.54},{"time":39.567,"pitch":35.648},{"time":39.575,"pitch":35.73},{"time":39.583,"pitch":35.794},{"time":39.592,"pitch":35.842},{"time":39.6,"pitch":35.879},{"time":39.608,"pitch":35.908},{"time":39.617,"pitch":35.929},{"time":39.625,"pitch":35.946},{"time":39.633,"pitch":35.959},{"time":39.642,"pitch":35.968},{"time":39.65,"pitch":35.976},{"time":39.658,"pitch":35.981},{"time":39.667,"pitch":35.986},{"time":39.675,"pitch":35.989},{"time":39.683,"pitch":35.992},{"time":39.692,"pitch":35.994},{"time":39.7,"pitch":35.995},{"time":39.708,"pitch":35.996},{"time":39.717,"pitch":35.997},{"time":39.725,"pitch":35.998},{"time":39.742,"pitch":35.999},{"time":39.775,"pitch":36},{"time":40,"pitch":36.47},{"time":40.008,"pitch":36.829},{"time":40.017,"pitch":37.104},{"time":40.025,"pitch":37.315},{"time":40.033,"pitch":37.476},{"time":40.042,"pitch":37.599},{"time":40.05,"pitch":37.693},{"time":40.058,"pitch":37.765},{"time":40.067,"pitch":37.82},{"time":40.075,"pitch":37.863},{"time":40.083,"pitch":37.895},{"time":40.092,"pitch":37.92},{"time":40.1,"pitch":37.938},{"time":40.108,"pitch":37.953},{"time":40.117,"pitch":37.964},{"time":40.125,"pitch":37.972},{"time":40.133,"pitch":37.979},{"time":40.142,"pitch":37.984},{"time":40.15,"pitch":37.988},{"time":40.158,"pitch":37.991},{"time":40.167,"pitch":37.993},{"time":40.175,"pitch":37.994},{"time":40.183,"pitch":37.996},{"time":40.192,"pitch":37.997},{"time":40.2,"pitch":37.998},{"time":40.217,"pitch":37.999},{"time":40.25,"pitch":38},{"time":40.733,"pitch":38.705},{"time":40.742,"pitch":39.244},{"time":40.75,"pitch":39.656},{"time":40.758,"pitch":39.972},{"time":40.767,"pitch":40.213},{"time":40.775,"pitch":40.398},{"time":40.783,"pitch":40.54},{"time":40.792,"pitch":40.648},{"time":40.8,"pitch":40.73},{"time":40.808,"pitch":40.794},{"time":40.817,"pitch":40.842},{"time":40.825,"pitch":40.879},{"time":40.833,"pitch":40.908},{"time":40.842,"pitch":40.929},{"time":40.85,"pitch":40.946},{"time":40.858,"pitch":40.959},{"time":40.867,"pitch":40.968},{"time":40.875,"pitch":40.976},{"time":40.883,"pitch":40.981},{"time":40.892,"pitch":40.986},{"time":40.9,"pitch":40.989},{"time":40.908,"pitch":40.992},{"time":40.917,"pitch":40.994},{"time":40.925,"pitch":40.995},{"time":40.933,"pitch":40.996},{"time":40.942,"pitch":40.997},{"time":40.95,"pitch":40.998},{"time":40.967,"pitch":40.999},{"time":41,"pitch":41},{"time":41.258,"pitch":40.295},{"time":41.267,"pitch":39.756},{"time":41.275,"pitch":39.344},{"time":41.283,"pitch":39.028},{"time":41.292,"pitch":38.787},{"time":41.3,"pitch":38.602},{"time":41.308,"pitch":38.46},{"time":41.317,"pitch":38.352},{"time":41.325,"pitch":38.27},{"time":41.333,"pitch":38.206},{"time":41.342,"pitch":38.158},{"time":41.35,"pitch":38.121},{"time":41.358,"pitch":38.092},{"time":41.367,"pitch":38.071},{"time":41.375,"pitch":38.054},{"time":41.383,"pitch":38.041},{"time":41.392,"pitch":38.032},{"time":41.4,"pitch":38.024},{"time":41.408,"pitch":38.019},{"time":41.417,"pitch":38.014},{"time":41.425,"pitch":38.011},{"time":41.433,"pitch":38.008},{"time":41.442,"pitch":38.006},{"time":41.45,"pitch":38.005},{"time":41.458,"pitch":38.004},{"time":41.467,"pitch":38.003},{"time":41.475,"pitch":38.002},{"time":41.492,"pitch":38.001},{"time":41.5,"pitch":38.706},{"time":41.508,"pitch":39.245},{"time":41.517,"pitch":39.657},{"time":41.525,"pitch":39.972},{"time":41.533,"pitch":40.214},{"time":41.542,"pitch":40.398},{"time":41.55,"pitch":40.54},{"time":41.558,"pitch":40.648},{"time":41.567,"pitch":40.731},{"time":41.575,"pitch":40.794},{"time":41.583,"pitch":40.842},{"time":41.592,"pitch":40.879},{"time":41.6,"pitch":40.908},{"time":41.608,"pitch":40.929},{"time":41.617,"pitch":40.946},{"time":41.625,"pitch":40.959},{"time":41.633,"pitch":40.968},{"time":41.642,"pitch":40.976},{"time":41.65,"pitch":40.981},{"time":41.658,"pitch":40.986},{"time":41.667,"pitch":40.989},{"time":41.675,"pitch":40.992},{"time":41.683,"pitch":40.994},{"time":41.692,"pitch":40.995},{"time":41.7,"pitch":40.996},{"time":41.708,"pitch":40.997},{"time":41.717,"pitch":40.998},{"time":41.733,"pitch":40.999},{"time":41.767,"pitch":41},{"time":42.008,"pitch":40.295},{"time":42.017,"pitch":39.756},{"time":42.025,"pitch":39.344},{"time":42.033,"pitch":39.028},{"time":42.042,"pitch":38.787},{"time":42.05,"pitch":38.602},{"time":42.058,"pitch":38.46},{"time":42.067,"pitch":38.352},{"time":42.075,"pitch":38.27},{"time":42.083,"pitch":38.206},{"time":42.092,"pitch":38.158},{"time":42.1,"pitch":38.121},{"time":42.108,"pitch":38.092},{"time":42.117,"pitch":38.071},{"time":42.125,"pitch":38.054},{"time":42.133,"pitch":38.041},{"time":42.142,"pitch":38.032},{"time":42.15,"pitch":38.024},{"time":42.158,"pitch":38.019},{"time":42.167,"pitch":38.014},{"time":42.175,"pitch":38.011},{"time":42.183,"pitch":38.008},{"time":42.192,"pitch":38.006},{"time":42.2,"pitch":38.005},{"time":42.208,"pitch":38.004},{"time":42.217,"pitch":38.003},{"time":42.225,"pitch":38.002},{"time":42.242,"pitch":38.001},{"time":42.275,"pitch":38},{"time":42.758,"pitch":37.53},{"time":42.767,"pitch":37.171},{"time":42.775,"pitch":36.896},{"time":42.783,"pitch":36.685},{"time":42.792,"pitch":36.524},{"time":42.8,"pitch":36.401},{"time":42.808,"pitch":36.307},{"time":42.817,"pitch":36.235},{"time":42.825,"pitch":36.18},{"time":42.833,"pitch":36.137},{"time":42.842,"pitch":36.105},{"time":42.85,"pitch":36.08},{"time":42.858,"pitch":36.062},{"time":42.867,"pitch":36.047},{"time":42.875,"pitch":36.036},{"time":42.883,"pitch":36.028},{"time":42.892,"pitch":36.021},{"time":42.9,"pitch":36.016},{"time":42.908,"pitch":36.012},{"time":42.917,"pitch":36.009},{"time":42.925,"pitch":36.007},{"time":42.933,"pitch":36.006},{"time":42.942,"pitch":36.004},{"time":42.95,"pitch":36.003},{"time":42.958,"pitch":36.002},{"time":42.975,"pitch":36.001},{"time":43.008,"pitch":36},{"time":43.258,"pitch":35.295},{"time":43.267,"pitch":34.756},{"time":43.275,"pitch":34.344},{"time":43.283,"pitch":34.028},{"time":43.292,"pitch":33.787},{"time":43.3,"pitch":33.602},{"time":43.308,"pitch":33.46},{"time":43.317,"pitch":33.352},{"time":43.325,"pitch":33.27},{"time":43.333,"pitch":33.206},{"time":43.342,"pitch":33.158},{"time":43.35,"pitch":33.121},{"time":43.358,"pitch":33.092},{"time":43.367,"pitch":33.071},{"time":43.375,"pitch":33.054},{"time":43.383,"pitch":33.041},{"time":43.392,"pitch":33.032},{"time":43.4,"pitch":33.024},{"time":43.408,"pitch":33.019},{"time":43.417,"pitch":33.014},{"time":43.425,"pitch":33.011},{"time":43.433,"pitch":33.008},{"time":43.442,"pitch":33.006},{"time":43.45,"pitch":33.005},{"time":43.458,"pitch":33.004},{"time":43.467,"pitch":33.003},{"time":43.475,"pitch":33.002},{"time":43.492,"pitch":33.001},{"time":43.508,"pitch":33.705},{"time":43.517,"pitch":34.244},{"time":43.525,"pitch":34.657},{"time":43.533,"pitch":34.972},{"time":43.542,"pitch":35.214},{"time":43.55,"pitch":35.398},{"time":43.558,"pitch":35.54},{"time":43.567,"pitch":35.648},{"time":43.575,"pitch":35.731},{"time":43.583,"pitch":35.794},{"time":43.592,"pitch":35.842},{"time":43.6,"pitch":35.879},{"time":43.608,"pitch":35.908},{"time":43.617,"pitch":35.929},{"time":43.625,"pitch":35.946},{"time":43.633,"pitch":35.959},{"time":43.642,"pitch":35.968},{"time":43.65,"pitch":35.976},{"time":43.658,"pitch":35.981},{"time":43.667,"pitch":35.986},{"time":43.675,"pitch":35.989},{"time":43.683,"pitch":35.992},{"time":43.692,"pitch":35.994},{"time":43.7,"pitch":35.995},{"time":43.708,"pitch":35.996},{"time":43.717,"pitch":35.997},{"time":43.725,"pitch":35.998},{"time":43.742,"pitch":35.999},{"time":43.775,"pitch":36},{"time":44,"pitch":36.47},{"time":44.008,"pitch":36.829},{"time":44.017,"pitch":37.104},{"time":44.025,"pitch":37.315},{"time":44.033,"pitch":37.476},{"time":44.042,"pitch":37.599},{"time":44.05,"pitch":37.693},{"time":44.058,"pitch":37.765},{"time":44.067,"pitch":37.82},{"time":44.075,"pitch":37.863},{"time":44.083,"pitch":37.895},{"time":44.092,"pitch":37.92},{"time":44.1,"pitch":37.938},{"time":44.108,"pitch":37.953},{"time":44.117,"pitch":37.964},{"time":44.125,"pitch":37.972},{"time":44.133,"pitch":37.979},{"time":44.142,"pitch":37.984},{"time":44.15,"pitch":37.988},{"time":44.158,"pitch":37.991},{"time":44.167,"pitch":37.993},{"time":44.175,"pitch":37.994},{"time":44.183,"pitch":37.996},{"time":44.192,"pitch":37.997},{"time":44.2,"pitch":37.998},{"time":44.217,"pitch":37.999},{"time":44.25,"pitch":38},{"time":44.733,"pitch":38.705},{"time":44.742,"pitch":39.244},{"time":44.75,"pitch":39.656},{"time":44.758,"pitch":39.972},{"time":44.767,"pitch":40.213},{"time":44.775,"pitch":40.398},{"time":44.783,"pitch":40.54},{"time":44.792,"pitch":40.648},{"time":44.8,"pitch":40.73},{"time":44.808,"pitch":40.794},{"time":44.817,"pitch":40.842},{"time":44.825,"pitch":40.879},{"time":44.833,"pitch":40.908},{"time":44.842,"pitch":40.929},{"time":44.85,"pitch":40.946},{"time":44.858,"pitch":40.959},{"time":44.867,"pitch":40.968},{"time":44.875,"pitch":40.976},{"time":44.883,"pitch":40.981},{"time":44.892,"pitch":40.986},{"time":44.9,"pitch":40.989},{"time":44.908,"pitch":40.992},{"time":44.917,"pitch":40.994},{"time":44.925,"pitch":40.995},{"time":44.933,"pitch":40.996},{"time":44.942,"pitch":40.997},{"time":44.95,"pitch":40.998},{"time":44.967,"pitch":40.999},{"time":45,"pitch":41},{"time":45.225,"pitch":41.705},{"time":45.233,"pitch":42.244},{"time":45.242,"pitch":42.656},{"time":45.25,"pitch":42.972},{"time":45.258,"pitch":43.213},{"time":45.267,"pitch":43.398},{"time":45.275,"pitch":43.54},{"time":45.283,"pitch":43.648},{"time":45.292,"pitch":43.73},{"time":45.3,"pitch":43.794},{"time":45.308,"pitch":43.842},{"time":45.317,"pitch":43.879},{"time":45.325,"pitch":43.908},{"time":45.333,"pitch":43.929},{"time":45.342,"pitch":43.946},{"time":45.35,"pitch":43.959},{"time":45.358,"pitch":43.968},{"time":45.367,"pitch":43.976},{"time":45.375,"pitch":43.981},{"time":45.383,"pitch":43.986},{"time":45.392,"pitch":43.989},{"time":45.4,"pitch":43.992},{"time":45.408,"pitch":43.994},{"time":45.417,"pitch":43.995},{"time":45.425,"pitch":43.996},{"time":45.433,"pitch":43.997},{"time":45.442,"pitch":43.998},{"time":45.458,"pitch":43.999},{"time":45.492,"pitch":44},{"time":45.525,"pitch":43.765},{"time":45.533,"pitch":43.585},{"time":45.542,"pitch":43.448},{"time":45.55,"pitch":43.343},{"time":45.558,"pitch":43.262},{"time":45.567,"pitch":43.201},{"time":45.575,"pitch":43.153},{"time":45.583,"pitch":43.117},{"time":45.592,"pitch":43.09},{"time":45.6,"pitch":43.069},{"time":45.608,"pitch":43.053},{"time":45.617,"pitch":43.04},{"time":45.625,"pitch":43.031},{"time":45.633,"pitch":43.024},{"time":45.642,"pitch":43.018},{"time":45.65,"pitch":43.014},{"time":45.658,"pitch":43.011},{"time":45.667,"pitch":43.008},{"time":45.675,"pitch":43.006},{"time":45.683,"pitch":43.005},{"time":45.692,"pitch":43.004},{"time":45.7,"pitch":43.003},{"time":45.708,"pitch":43.002},{"time":45.725,"pitch":43.001},{"time":45.758,"pitch":43},{"time":46,"pitch":42.53},{"time":46.008,"pitch":42.171},{"time":46.017,"pitch":41.896},{"time":46.025,"pitch":41.685},{"time":46.033,"pitch":41.524},{"time":46.042,"pitch":41.401},{"time":46.05,"pitch":41.307},{"time":46.058,"pitch":41.235},{"time":46.067,"pitch":41.18},{"time":46.075,"pitch":41.137},{"time":46.083,"pitch":41.105},{"time":46.092,"pitch":41.08},{"time":46.1,"pitch":41.062},{"time":46.108,"pitch":41.047},{"time":46.117,"pitch":41.036},{"time":46.125,"pitch":41.028},{"time":46.133,"pitch":41.021},{"time":46.142,"pitch":41.016},{"time":46.15,"pitch":41.012},{"time":46.158,"pitch":41.009},{"time":46.167,"pitch":41.007},{"time":46.175,"pitch":41.006},{"time":46.183,"pitch":41.004},{"time":46.192,"pitch":41.003},{"time":46.2,"pitch":41.002},{"time":46.217,"pitch":41.001},{"time":46.25,"pitch":41},{"time":46.758,"pitch":40.295},{"time":46.767,"pitch":39.756},{"time":46.775,"pitch":39.344},{"time":46.783,"pitch":39.028},{"time":46.792,"pitch":38.787},{"time":46.8,"pitch":38.602},{"time":46.808,"pitch":38.46},{"time":46.817,"pitch":38.352},{"time":46.825,"pitch":38.27},{"time":46.833,"pitch":38.206},{"time":46.842,"pitch":38.158},{"time":46.85,"pitch":38.121},{"time":46.858,"pitch":38.092},{"time":46.867,"pitch":38.071},{"time":46.875,"pitch":38.054},{"time":46.883,"pitch":38.041},{"time":46.892,"pitch":38.032},{"time":46.9,"pitch":38.024},{"time":46.908,"pitch":38.019},{"time":46.917,"pitch":38.014},{"time":46.925,"pitch":38.011},{"time":46.933,"pitch":38.008},{"time":46.942,"pitch":38.006},{"time":46.95,"pitch":38.005},{"time":46.958,"pitch":38.004},{"time":46.967,"pitch":38.003},{"time":46.975,"pitch":38.002},{"time":46.992,"pitch":38.001},{"time":47.025,"pitch":38},{"time":47.208,"pitch":36.826},{"time":47.217,"pitch":35.927},{"time":47.225,"pitch":35.239},{"time":47.233,"pitch":34.713},{"time":47.242,"pitch":34.311},{"time":47.25,"pitch":34.003},{"time":47.258,"pitch":33.767},{"time":47.267,"pitch":33.587},{"time":47.275,"pitch":33.449},{"time":47.283,"pitch":33.344},{"time":47.292,"pitch":33.263},{"time":47.3,"pitch":33.201},{"time":47.308,"pitch":33.154},{"time":47.317,"pitch":33.118},{"time":47.325,"pitch":33.09},{"time":47.333,"pitch":33.069},{"time":47.342,"pitch":33.053},{"time":47.35,"pitch":33.04},{"time":47.358,"pitch":33.031},{"time":47.367,"pitch":33.024},{"time":47.375,"pitch":33.018},{"time":47.383,"pitch":33.014},{"time":47.392,"pitch":33.011},{"time":47.4,"pitch":33.008},{"time":47.408,"pitch":33.006},{"time":47.417,"pitch":33.005},{"time":47.425,"pitch":33.004},{"time":47.433,"pitch":33.003},{"time":47.442,"pitch":33.002},{"time":47.458,"pitch":33.001},{"time":47.492,"pitch":33},{"time":47.508,"pitch":33.705},{"time":47.517,"pitch":34.244},{"time":47.525,"pitch":34.657},{"time":47.533,"pitch":34.972},{"time":47.542,"pitch":35.214},{"time":47.55,"pitch":35.398},{"time":47.558,"pitch":35.54},{"time":47.567,"pitch":35.648},{"time":47.575,"pitch":35.73},{"time":47.583,"pitch":35.794},{"time":47.592,"pitch":35.842},{"time":47.6,"pitch":35.879},{"time":47.608,"pitch":35.908},{"time":47.617,"pitch":35.929},{"time":47.625,"pitch":35.946},{"time":47.633,"pitch":35.959},{"time":47.642,"pitch":35.968},{"time":47.65,"pitch":35.976},{"time":47.658,"pitch":35.981},{"time":47.667,"pitch":35.986},{"time":47.675,"pitch":35.989},{"time":47.683,"pitch":35.992},{"time":47.692,"pitch":35.994},{"time":47.7,"pitch":35.995},{"time":47.708,"pitch":35.996},{"time":47.717,"pitch":35.997},{"time":47.725,"pitch":35.998},{"time":47.742,"pitch":35.999},{"time":47.775,"pitch":36},{"time":48,"pitch":36.47},{"time":48.008,"pitch":36.829},{"time":48.017,"pitch":37.104},{"time":48.025,"pitch":37.315},{"time":48.033,"pitch":37.476},{"time":48.042,"pitch":37.599},{"time":48.05,"pitch":37.693},{"time":48.058,"pitch":37.765},{"time":48.067,"pitch":37.82},{"time":48.075,"pitch":37.863},{"time":48.083,"pitch":37.895},{"time":48.092,"pitch":37.92},{"time":48.1,"pitch":37.938},{"time":48.108,"pitch":37.953},{"time":48.117,"pitch":37.964},{"time":48.125,"pitch":37.972},{"time":48.133,"pitch":37.979},{"time":48.142,"pitch":37.984},{"time":48.15,"pitch":37.988},{"time":48.158,"pitch":37.991},{"time":48.167,"pitch":37.993},{"time":48.175,"pitch":37.994},{"time":48.183,"pitch":37.996},{"time":48.192,"pitch":37.997},{"time":48.2,"pitch":37.998},{"time":48.217,"pitch":37.999},{"time":48.25,"pitch":38},{"time":48.733,"pitch":38.705},{"time":48.742,"pitch":39.244},{"time":48.75,"pitch":39.656},{"time":48.758,"pitch":39.972},{"time":48.767,"pitch":40.213},{"time":48.775,"pitch":40.398},{"time":48.783,"pitch":40.54},{"time":48.792,"pitch":40.648},{"time":48.8,"pitch":40.73},{"time":48.808,"pitch":40.794},{"time":48.817,"pitch":40.842},{"time":48.825,"pitch":40.879},{"time":48.833,"pitch":40.908},{"time":48.842,"pitch":40.929},{"time":48.85,"pitch":40.946},{"time":48.858,"pitch":40.959},{"time":48.867,"pitch":40.968},{"time":48.875,"pitch":40.976},{"time":48.883,"pitch":40.981},{"time":48.892,"pitch":40.986},{"time":48.9,"pitch":40.989},{"time":48.908,"pitch":40.992},{"time":48.917,"pitch":40.994},{"time":48.925,"pitch":40.995},{"time":48.933,"pitch":40.996},{"time":48.942,"pitch":40.997},{"time":48.95,"pitch":40.998},{"time":48.967,"pitch":40.999},{"time":49,"pitch":41},{"time":49.258,"pitch":40.295},{"time":49.267,"pitch":39.756},{"time":49.275,"pitch":39.344},{"time":49.283,"pitch":39.028},{"time":49.292,"pitch":38.787},{"time":49.3,"pitch":38.602},{"time":49.308,"pitch":38.46},{"time":49.317,"pitch":38.352},{"time":49.325,"pitch":38.27},{"time":49.333,"pitch":38.206},{"time":49.342,"pitch":38.158},{"time":49.35,"pitch":38.121},{"time":49.358,"pitch":38.092},{"time":49.367,"pitch":38.071},{"time":49.375,"pitch":38.054},{"time":49.383,"pitch":38.041},{"time":49.392,"pitch":38.032},{"time":49.4,"pitch":38.024},{"time":49.408,"pitch":38.019},{"time":49.417,"pitch":38.014},{"time":49.425,"pitch":38.011},{"time":49.433,"pitch":38.008},{"time":49.442,"pitch":38.006},{"time":49.45,"pitch":38.005},{"time":49.458,"pitch":38.004},{"time":49.467,"pitch":38.003},{"time":49.475,"pitch":38.002},{"time":49.492,"pitch":38.001},{"time":49.5,"pitch":38.706},{"time":49.508,"pitch":39.245},{"time":49.517,"pitch":39.657},{"time":49.525,"pitch":39.972},{"time":49.533,"pitch":40.214},{"time":49.542,"pitch":40.398},{"time":49.55,"pitch":40.54},{"time":49.558,"pitch":40.648},{"time":49.567,"pitch":40.731},{"time":49.575,"pitch":40.794},{"time":49.583,"pitch":40.842},{"time":49.592,"pitch":40.879},{"time":49.6,"pitch":40.908},{"time":49.608,"pitch":40.929},{"time":49.617,"pitch":40.946},{"time":49.625,"pitch":40.959},{"time":49.633,"pitch":40.968},{"time":49.642,"pitch":40.976},{"time":49.65,"pitch":40.981},{"time":49.658,"pitch":40.986},{"time":49.667,"pitch":40.989},{"time":49.675,"pitch":40.992},{"time":49.683,"pitch":40.994},{"time":49.692,"pitch":40.995},{"time":49.7,"pitch":40.996},{"time":49.708,"pitch":40.997},{"time":49.717,"pitch":40.998},{"time":49.733,"pitch":40.999},{"time":49.767,"pitch":41},{"time":50.008,"pitch":40.295},{"time":50.017,"pitch":39.756},{"time":50.025,"pitch":39.344},{"time":50.033,"pitch":39.028},{"time":50.042,"pitch":38.787},{"time":50.05,"pitch":38.602},{"time":50.058,"pitch":38.46},{"time":50.067,"pitch":38.352},{"time":50.075,"pitch":38.27},{"time":50.083,"pitch":38.206},{"time":50.092,"pitch":38.158},{"time":50.1,"pitch":38.121},{"time":50.108,"pitch":38.092},{"time":50.117,"pitch":38.071},{"time":50.125,"pitch":38.054},{"time":50.133,"pitch":38.041},{"time":50.142,"pitch":38.032},{"time":50.15,"pitch":38.024},{"time":50.158,"pitch":38.019},{"time":50.167,"pitch":38.014},{"time":50.175,"pitch":38.011},{"time":50.183,"pitch":38.008},{"time":50.192,"pitch":38.006},{"time":50.2,"pitch":38.005},{"time":50.208,"pitch":38.004},{"time":50.217,"pitch":38.003},{"time":50.225,"pitch":38.002},{"time":50.242,"pitch":38.001},{"time":50.275,"pitch":38},{"time":50.758,"pitch":37.53},{"time":50.767,"pitch":37.171},{"time":50.775,"pitch":36.896},{"time":50.783,"pitch":36.685},{"time":50.792,"pitch":36.524},{"time":50.8,"pitch":36.401},{"time":50.808,"pitch":36.307},{"time":50.817,"pitch":36.235},{"time":50.825,"pitch":36.18},{"time":50.833,"pitch":36.137},{"time":50.842,"pitch":36.105},{"time":50.85,"pitch":36.08},{"time":50.858,"pitch":36.062},{"time":50.867,"pitch":36.047},{"time":50.875,"pitch":36.036},{"time":50.883,"pitch":36.028},{"time":50.892,"pitch":36.021},{"time":50.9,"pitch":36.016},{"time":50.908,"pitch":36.012},{"time":50.917,"pitch":36.009},{"time":50.925,"pitch":36.007},{"time":50.933,"pitch":36.006},{"time":50.942,"pitch":36.004},{"time":50.95,"pitch":36.003},{"time":50.958,"pitch":36.002},{"time":50.975,"pitch":36.001},{"time":51.008,"pitch":36},{"time":51.258,"pitch":35.295},{"time":51.267,"pitch":34.756},{"time":51.275,"pitch":34.344},{"time":51.283,"pitch":34.028},{"time":51.292,"pitch":33.787},{"time":51.3,"pitch":33.602},{"time":51.308,"pitch":33.46},{"time":51.317,"pitch":33.352},{"time":51.325,"pitch":33.27},{"time":51.333,"pitch":33.206},{"time":51.342,"pitch":33.158},{"time":51.35,"pitch":33.121},{"time":51.358,"pitch":33.092},{"time":51.367,"pitch":33.071},{"time":51.375,"pitch":33.054},{"time":51.383,"pitch":33.041},{"time":51.392,"pitch":33.032},{"time":51.4,"pitch":33.024},{"time":51.408,"pitch":33.019},{"time":51.417,"pitch":33.014},{"time":51.425,"pitch":33.011},{"time":51.433,"pitch":33.008},{"time":51.442,"pitch":33.006},{"time":51.45,"pitch":33.005},{"time":51.458,"pitch":33.004},{"time":51.467,"pitch":33.003},{"time":51.475,"pitch":33.002},{"time":51.492,"pitch":33.001},{"time":51.508,"pitch":33.705},{"time":51.517,"pitch":34.244},{"time":51.525,"pitch":34.657},{"time":51.533,"pitch":34.972},{"time":51.542,"pitch":35.214},{"time":51.55,"pitch":35.398},{"time":51.558,"pitch":35.54},{"time":51.567,"pitch":35.648},{"time":51.575,"pitch":35.731},{"time":51.583,"pitch":35.794},{"time":51.592,"pitch":35.842},{"time":51.6,"pitch":35.879},{"time":51.608,"pitch":35.908},{"time":51.617,"pitch":35.929},{"time":51.625,"pitch":35.946},{"time":51.633,"pitch":35.959},{"time":51.642,"pitch":35.968},{"time":51.65,"pitch":35.976},{"time":51.658,"pitch":35.981},{"time":51.667,"pitch":35.986},{"time":51.675,"pitch":35.989},{"time":51.683,"pitch":35.992},{"time":51.692,"pitch":35.994},{"time":51.7,"pitch":35.995},{"time":51.708,"pitch":35.996},{"time":51.717,"pitch":35.997},{"time":51.725,"pitch":35.998},{"time":51.742,"pitch":35.999},{"time":51.775,"pitch":36},{"time":52,"pitch":36.47},{"time":52.008,"pitch":36.829},{"time":52.017,"pitch":37.104},{"time":52.025,"pitch":37.315},{"time":52.033,"pitch":37.476},{"time":52.042,"pitch":37.599},{"time":52.05,"pitch":37.693},{"time":52.058,"pitch":37.765},{"time":52.067,"pitch":37.82},{"time":52.075,"pitch":37.863},{"time":52.083,"pitch":37.895},{"time":52.092,"pitch":37.92},{"time":52.1,"pitch":37.938},{"time":52.108,"pitch":37.953},{"time":52.117,"pitch":37.964},{"time":52.125,"pitch":37.972},{"time":52.133,"pitch":37.979},{"time":52.142,"pitch":37.984},{"time":52.15,"pitch":37.988},{"time":52.158,"pitch":37.991},{"time":52.167,"pitch":37.993},{"time":52.175,"pitch":37.994},{"time":52.183,"pitch":37.996},{"time":52.192,"pitch":37.997},{"time":52.2,"pitch":37.998},{"time":52.217,"pitch":37.999},{"time":52.25,"pitch":38},{"time":52.733,"pitch":38.705},{"time":52.742,"pitch":39.244},{"time":52.75,"pitch":39.656},{"time":52.758,"pitch":39.972},{"time":52.767,"pitch":40.213},{"time":52.775,"pitch":40.398},{"time":52.783,"pitch":40.54},{"time":52.792,"pitch":40.648},{"time":52.8,"pitch":40.73},{"time":52.808,"pitch":40.794},{"time":52.817,"pitch":40.842},{"time":52.825,"pitch":40.879},{"time":52.833,"pitch":40.908},{"time":52.842,"pitch":40.929},{"time":52.85,"pitch":40.946},{"time":52.858,"pitch":40.959},{"time":52.867,"pitch":40.968},{"time":52.875,"pitch":40.976},{"time":52.883,"pitch":40.981},{"time":52.892,"pitch":40.986},{"time":52.9,"pitch":40.989},{"time":52.908,"pitch":40.992},{"time":52.917,"pitch":40.994},{"time":52.925,"pitch":40.995},{"time":52.933,"pitch":40.996},{"time":52.942,"pitch":40.997},{"time":52.95,"pitch":40.998},{"time":52.967,"pitch":40.999},{"time":53,"pitch":41},{"time":53.225,"pitch":41.705},{"time":53.233,"pitch":42.244},{"time":53.242,"pitch":42.656},{"time":53.25,"pitch":42.972},{"time":53.258,"pitch":43.213},{"time":53.267,"pitch":43.398},{"time":53.275,"pitch":43.54},{"time":53.283,"pitch":43.648},{"time":53.292,"pitch":43.73},{"time":53.3,"pitch":43.794},{"time":53.308,"pitch":43.842},{"time":53.317,"pitch":43.879},{"time":53.325,"pitch":43.908},{"time":53.333,"pitch":43.929},{"time":53.342,"pitch":43.946},{"time":53.35,"pitch":43.959},{"time":53.358,"pitch":43.968},{"time":53.367,"pitch":43.976},{"time":53.375,"pitch":43.981},{"time":53.383,"pitch":43.986},{"time":53.392,"pitch":43.989},{"time":53.4,"pitch":43.992},{"time":53.408,"pitch":43.994},{"time":53.417,"pitch":43.995},{"time":53.425,"pitch":43.996},{"time":53.433,"pitch":43.997},{"time":53.442,"pitch":43.998},{"time":53.458,"pitch":43.999},{"time":53.492,"pitch":44},{"time":53.525,"pitch":43.765},{"time":53.533,"pitch":43.585},{"time":53.542,"pitch":43.448},{"time":53.55,"pitch":43.343},{"time":53.558,"pitch":43.262},{"time":53.567,"pitch":43.201},{"time":53.575,"pitch":43.153},{"time":53.583,"pitch":43.117},{"time":53.592,"pitch":43.09},{"time":53.6,"pitch":43.069},{"time":53.608,"pitch":43.053},{"time":53.617,"pitch":43.04},{"time":53.625,"pitch":43.031},{"time":53.633,"pitch":43.024},{"time":53.642,"pitch":43.018},{"time":53.65,"pitch":43.014},{"time":53.658,"pitch":43.011},{"time":53.667,"pitch":43.008},{"time":53.675,"pitch":43.006},{"time":53.683,"pitch":43.005},{"time":53.692,"pitch":43.004},{"time":53.7,"pitch":43.003},{"time":53.708,"pitch":43.002},{"time":53.725,"pitch":43.001},{"time":53.758,"pitch":43},{"time":54,"pitch":42.53},{"time":54.008,"pitch":42.171},{"time":54.017,"pitch":41.896},{"time":54.025,"pitch":41.685},{"time":54.033,"pitch":41.524},{"time":54.042,"pitch":41.401},{"time":54.05,"pitch":41.307},{"time":54.058,"pitch":41.235},{"time":54.067,"pitch":41.18},{"time":54.075,"pitch":41.137},{"time":54.083,"pitch":41.105},{"time":54.092,"pitch":41.08},{"time":54.1,"pitch":41.062},{"time":54.108,"pitch":41.047},{"time":54.117,"pitch":41.036},{"time":54.125,"pitch":41.028},{"time":54.133,"pitch":41.021},{"time":54.142,"pitch":41.016},{"time":54.15,"pitch":41.012},{"time":54.158,"pitch":41.009},{"time":54.167,"pitch":41.007},{"time":54.175,"pitch":41.006},{"time":54.183,"pitch":41.004},{"time":54.192,"pitch":41.003},{"time":54.2,"pitch":41.002},{"time":54.217,"pitch":41.001},{"time":54.25,"pitch":41},{"time":54.758,"pitch":40.295},{"time":54.767,"pitch":39.756},{"time":54.775,"pitch":39.344},{"time":54.783,"pitch":39.028},{"time":54.792,"pitch":38.787},{"time":54.8,"pitch":38.602},{"time":54.808,"pitch":38.46},{"time":54.817,"pitch":38.352},{"time":54.825,"pitch":38.27},{"time":54.833,"pitch":38.206},{"time":54.842,"pitch":38.158},{"time":54.85,"pitch":38.121},{"time":54.858,"pitch":38.092},{"time":54.867,"pitch":38.071},{"time":54.875,"pitch":38.054},{"time":54.883,"pitch":38.041},{"time":54.892,"pitch":38.032},{"time":54.9,"pitch":38.024},{"time":54.908,"pitch":38.019},{"time":54.917,"pitch":38.014},{"time":54.925,"pitch":38.011},{"time":54.933,"pitch":38.008},{"time":54.942,"pitch":38.006},{"time":54.95,"pitch":38.005},{"time":54.958,"pitch":38.004},{"time":54.967,"pitch":38.003},{"time":54.975,"pitch":38.002},{"time":54.992,"pitch":38.001},{"time":55.025,"pitch":38},{"time":55.208,"pitch":36.826},{"time":55.217,"pitch":35.927},{"time":55.225,"pitch":35.239},{"time":55.233,"pitch":34.713},{"time":55.242,"pitch":34.311},{"time":55.25,"pitch":34.003},{"time":55.258,"pitch":33.767},{"time":55.267,"pitch":33.587},{"time":55.275,"pitch":33.449},{"time":55.283,"pitch":33.344},{"time":55.292,"pitch":33.263},{"time":55.3,"pitch":33.201},{"time":55.308,"pitch":33.154},{"time":55.317,"pitch":33.118},{"time":55.325,"pitch":33.09},{"time":55.333,"pitch":33.069},{"time":55.342,"pitch":33.053},{"time":55.35,"pitch":33.04},{"time":55.358,"pitch":33.031},{"time":55.367,"pitch":33.024},{"time":55.375,"pitch":33.018},{"time":55.383,"pitch":33.014},{"time":55.392,"pitch":33.011},{"time":55.4,"pitch":33.008},{"time":55.408,"pitch":33.006},{"time":55.417,"pitch":33.005},{"time":55.425,"pitch":33.004},{"time":55.433,"pitch":33.003},{"time":55.442,"pitch":33.002},{"time":55.458,"pitch":33.001},{"time":55.492,"pitch":33},{"time":55.508,"pitch":33.705},{"time":55.517,"pitch":34.244},{"time":55.525,"pitch":34.657},{"time":55.533,"pitch":34.972},{"time":55.542,"pitch":35.214},{"time":55.55,"pitch":35.398},{"time":55.558,"pitch":35.54},{"time":55.567,"pitch":35.648},{"time":55.575,"pitch":35.73},{"time":55.583,"pitch":35.794},{"time":55.592,"pitch":35.842},{"time":55.6,"pitch":35.879},{"time":55.608,"pitch":35.908},{"time":55.617,"pitch":35.929},{"time":55.625,"pitch":35.946},{"time":55.633,"pitch":35.959},{"time":55.642,"pitch":35.968},{"time":55.65,"pitch":35.976},{"time":55.658,"pitch":35.981},{"time":55.667,"pitch":35.986},{"time":55.675,"pitch":35.989},{"time":55.683,"pitch":35.992},{"time":55.692,"pitch":35.994},{"time":55.7,"pitch":35.995},{"time":55.708,"pitch":35.996},{"time":55.717,"pitch":35.997},{"time":55.725,"pitch":35.998},{"time":55.742,"pitch":35.999},{"time":55.775,"pitch":36},{"time":56,"pitch":36.47},{"time":56.008,"pitch":36.829},{"time":56.017,"pitch":37.104},{"time":56.025,"pitch":37.315},{"time":56.033,"pitch":37.476},{"time":56.042,"pitch":37.599},{"time":56.05,"pitch":37.693},{"time":56.058,"pitch":37.765},{"time":56.067,"pitch":37.82},{"time":56.075,"pitch":37.863},{"time":56.083,"pitch":37.895},{"time":56.092,"pitch":37.92},{"time":56.1,"pitch":37.938},{"time":56.108,"pitch":37.953},{"time":56.117,"pitch":37.964},{"time":56.125,"pitch":37.972},{"time":56.133,"pitch":37.979},{"time":56.142,"pitch":37.984},{"time":56.15,"pitch":37.988},{"time":56.158,"pitch":37.991},{"time":56.167,"pitch":37.993},{"time":56.175,"pitch":37.994},{"time":56.183,"pitch":37.996},{"time":56.192,"pitch":37.997},{"time":56.2,"pitch":37.998},{"time":56.217,"pitch":37.999},{"time":56.25,"pitch":38},{"time":56.733,"pitch":38.705},{"time":56.742,"pitch":39.244},{"time":56.75,"pitch":39.656},{"time":56.758,"pitch":39.972},{"time":56.767,"pitch":40.213},{"time":56.775,"pitch":40.398},{"time":56.783,"pitch":40.54},{"time":56.792,"pitch":40.648},{"time":56.8,"pitch":40.73},{"time":56.808,"pitch":40.794},{"time":56.817,"pitch":40.842},{"time":56.825,"pitch":40.879},{"time":56.833,"pitch":40.908},{"time":56.842,"pitch":40.929},{"time":56.85,"pitch":40.946},{"time":56.858,"pitch":40.959},{"time":56.867,"pitch":40.968},{"time":56.875,"pitch":40.976},{"time":56.883,"pitch":40.981},{"time":56.892,"pitch":40.986},{"time":56.9,"pitch":40.989},{"time":56.908,"pitch":40.992},{"time":56.917,"pitch":40.994},{"time":56.925,"pitch":40.995},{"time":56.933,"pitch":40.996},{"time":56.942,"pitch":40.997},{"time":56.95,"pitch":40.998},{"time":56.967,"pitch":40.999},{"time":57,"pitch":41},{"time":57.258,"pitch":40.295},{"time":57.267,"pitch":39.756},{"time":57.275,"pitch":39.344},{"time":57.283,"pitch":39.028},{"time":57.292,"pitch":38.787},{"time":57.3,"pitch":38.602},{"time":57.308,"pitch":38.46},{"time":57.317,"pitch":38.352},{"time":57.325,"pitch":38.27},{"time":57.333,"pitch":38.206},{"time":57.342,"pitch":38.158},{"time":57.35,"pitch":38.121},{"time":57.358,"pitch":38.092},{"time":57.367,"pitch":38.071},{"time":57.375,"pitch":38.054},{"time":57.383,"pitch":38.041},{"time":57.392,"pitch":38.032},{"time":57.4,"pitch":38.024},{"time":57.408,"pitch":38.019},{"time":57.417,"pitch":38.014},{"time":57.425,"pitch":38.011},{"time":57.433,"pitch":38.008},{"time":57.442,"pitch":38.006},{"time":57.45,"pitch":38.005},{"time":57.458,"pitch":38.004},{"time":57.467,"pitch":38.003},{"time":57.475,"pitch":38.002},{"time":57.492,"pitch":38.001},{"time":57.5,"pitch":38.706},{"time":57.508,"pitch":39.245},{"time":57.517,"pitch":39.657},{"time":57.525,"pitch":39.972},{"time":57.533,"pitch":40.214},{"time":57.542,"pitch":40.398},{"time":57.55,"pitch":40.54},{"time":57.558,"pitch":40.648},{"time":57.567,"pitch":40.731},{"time":57.575,"pitch":40.794},{"time":57.583,"pitch":40.842},{"time":57.592,"pitch":40.879},{"time":57.6,"pitch":40.908},{"time":57.608,"pitch":40.929},{"time":57.617,"pitch":40.946},{"time":57.625,"pitch":40.959},{"time":57.633,"pitch":40.968},{"time":57.642,"pitch":40.976},{"time":57.65,"pitch":40.981},{"time":57.658,"pitch":40.986},{"time":57.667,"pitch":40.989},{"time":57.675,"pitch":40.992},{"time":57.683,"pitch":40.994},{"time":57.692,"pitch":40.995},{"time":57.7,"pitch":40.996},{"time":57.708,"pitch":40.997},{"time":57.717,"pitch":40.998},{"time":57.733,"pitch":40.999},{"time":57.767,"pitch":41},{"time":58.008,"pitch":40.295},{"time":58.017,"pitch":39.756},{"time":58.025,"pitch":39.344},{"time":58.033,"pitch":39.028},{"time":58.042,"pitch":38.787},{"time":58.05,"pitch":38.602},{"time":58.058,"pitch":38.46},{"time":58.067,"pitch":38.352},{"time":58.075,"pitch":38.27},{"time":58.083,"pitch":38.206},{"time":58.092,"pitch":38.158},{"time":58.1,"pitch":38.121},{"time":58.108,"pitch":38.092},{"time":58.117,"pitch":38.071},{"time":58.125,"pitch":38.054},{"time":58.133,"pitch":38.041},{"time":58.142,"pitch":38.032},{"time":58.15,"pitch":38.024},{"time":58.158,"pitch":38.019},{"time":58.167,"pitch":38.014},{"time":58.175,"pitch":38.011},{"time":58.183,"pitch":38.008},{"time":58.192,"pitch":38.006},{"time":58.2,"pitch":38.005},{"time":58.208,"pitch":38.004},{"time":58.217,"pitch":38.003},{"time":58.225,"pitch":38.002},{"time":58.242,"pitch":38.001},{"time":58.275,"pitch":38},{"time":58.758,"pitch":37.53},{"time":58.767,"pitch":37.171},{"time":58.775,"pitch":36.896},{"time":58.783,"pitch":36.685},{"time":58.792,"pitch":36.524},{"time":58.8,"pitch":36.401},{"time":58.808,"pitch":36.307},{"time":58.817,"pitch":36.235},{"time":58.825,"pitch":36.18},{"time":58.833,"pitch":36.137},{"time":58.842,"pitch":36.105},{"time":58.85,"pitch":36.08},{"time":58.858,"pitch":36.062},{"time":58.867,"pitch":36.047},{"time":58.875,"pitch":36.036},{"time":58.883,"pitch":36.028},{"time":58.892,"pitch":36.021},{"time":58.9,"pitch":36.016},{"time":58.908,"pitch":36.012},{"time":58.917,"pitch":36.009},{"time":58.925,"pitch":36.007},{"time":58.933,"pitch":36.006},{"time":58.942,"pitch":36.004},{"time":58.95,"pitch":36.003},{"time":58.958,"pitch":36.002},{"time":58.975,"pitch":36.001},{"time":59.008,"pitch":36},{"time":59.258,"pitch":35.295},{"time":59.267,"pitch":34.756},{"time":59.275,"pitch":34.344},{"time":59.283,"pitch":34.028},{"time":59.292,"pitch":33.787},{"time":59.3,"pitch":33.602},{"time":59.308,"pitch":33.46},{"time":59.317,"pitch":33.352},{"time":59.325,"pitch":33.27},{"time":59.333,"pitch":33.206},{"time":59.342,"pitch":33.158},{"time":59.35,"pitch":33.121},{"time":59.358,"pitch":33.092},{"time":59.367,"pitch":33.071},{"time":59.375,"pitch":33.054},{"time":59.383,"pitch":33.041},{"time":59.392,"pitch":33.032},{"time":59.4,"pitch":33.024},{"time":59.408,"pitch":33.019},{"time":59.417,"pitch":33.014},{"time":59.425,"pitch":33.011},{"time":59.433,"pitch":33.008},{"time":59.442,"pitch":33.006},{"time":59.45,"pitch":33.005},{"time":59.458,"pitch":33.004},{"time":59.467,"pitch":33.003},{"time":59.475,"pitch":33.002},{"time":59.492,"pitch":33.001},{"time":59.508,"pitch":33.705},{"time":59.517,"pitch":34.244},{"time":59.525,"pitch":34.657},{"time":59.533,"pitch":34.972},{"time":59.542,"pitch":35.214},{"time":59.55,"pitch":35.398},{"time":59.558,"pitch":35.54},{"time":59.567,"pitch":35.648},{"time":59.575,"pitch":35.731},{"time":59.583,"pitch":35.794},{"time":59.592,"pitch":35.842},{"time":59.6,"pitch":35.879},{"time":59.608,"pitch":35.908},{"time":59.617,"pitch":35.929},{"time":59.625,"pitch":35.946},{"time":59.633,"pitch":35.959},{"time":59.642,"pitch":35.968},{"time":59.65,"pitch":35.976},{"time":59.658,"pitch":35.981},{"time":59.667,"pitch":35.986},{"time":59.675,"pitch":35.989},{"time":59.683,"pitch":35.992},{"time":59.692,"pitch":35.994},{"time":59.7,"pitch":35.995},{"time":59.708,"pitch":35.996},{"time":59.717,"pitch":35.997},{"time":59.725,"pitch":35.998},{"time":59.742,"pitch":35.999},{"time":59.775,"pitch":36},{"time":60,"pitch":36.47},{"time":60.008,"pitch":36.829},{"time":60.017,"pitch":37.104},{"time":60.025,"pitch":37.315},{"time":60.033,"pitch":37.476},{"time":60.042,"pitch":37.599},{"time":60.05,"pitch":37.693},{"time":60.058,"pitch":37.765},{"time":60.067,"pitch":37.82},{"time":60.075,"pitch":37.863},{"time":60.083,"pitch":37.895},{"time":60.092,"pitch":37.92},{"time":60.1,"pitch":37.938},{"time":60.108,"pitch":37.953},{"time":60.117,"pitch":37.964},{"time":60.125,"pitch":37.972},{"time":60.133,"pitch":37.979},{"time":60.142,"pitch":37.984},{"time":60.15,"pitch":37.988},{"time":60.158,"pitch":37.991},{"time":60.167,"pitch":37.993},{"time":60.175,"pitch":37.994},{"time":60.183,"pitch":37.996},{"time":60.192,"pitch":37.997},{"time":60.2,"pitch":37.998},{"time":60.217,"pitch":37.999},{"time":60.25,"pitch":38},{"time":60.733,"pitch":38.705},{"time":60.742,"pitch":39.244},{"time":60.75,"pitch":39.656},{"time":60.758,"pitch":39.972},{"time":60.767,"pitch":40.213},{"time":60.775,"pitch":40.398},{"time":60.783,"pitch":40.54},{"time":60.792,"pitch":40.648},{"time":60.8,"pitch":40.73},{"time":60.808,"pitch":40.794},{"time":60.817,"pitch":40.842},{"time":60.825,"pitch":40.879},{"time":60.833,"pitch":40.908},{"time":60.842,"pitch":40.929},{"time":60.85,"pitch":40.946},{"time":60.858,"pitch":40.959},{"time":60.867,"pitch":40.968},{"time":60.875,"pitch":40.976},{"time":60.883,"pitch":40.981},{"time":60.892,"pitch":40.986},{"time":60.9,"pitch":40.989},{"time":60.908,"pitch":40.992},{"time":60.917,"pitch":40.994},{"time":60.925,"pitch":40.995},{"time":60.933,"pitch":40.996},{"time":60.942,"pitch":40.997},{"time":60.95,"pitch":40.998},{"time":60.967,"pitch":40.999},{"time":61,"pitch":41},{"time":61.225,"pitch":41.705},{"time":61.233,"pitch":42.244},{"time":61.242,"pitch":42.656},{"time":61.25,"pitch":42.972},{"time":61.258,"pitch":43.213},{"time":61.267,"pitch":43.398},{"time":61.275,"pitch":43.54},{"time":61.283,"pitch":43.648},{"time":61.292,"pitch":43.73},{"time":61.3,"pitch":43.794},{"time":61.308,"pitch":43.842},{"time":61.317,"pitch":43.879},{"time":61.325,"pitch":43.908},{"time":61.333,"pitch":43.929},{"time":61.342,"pitch":43.946},{"time":61.35,"pitch":43.959},{"time":61.358,"pitch":43.968},{"time":61.367,"pitch":43.976},{"time":61.375,"pitch":43.981},{"time":61.383,"pitch":43.986},{"time":61.392,"pitch":43.989},{"time":61.4,"pitch":43.992},{"time":61.408,"pitch":43.994},{"time":61.417,"pitch":43.995},{"time":61.425,"pitch":43.996},{"time":61.433,"pitch":43.997},{"time":61.442,"pitch":43.998},{"time":61.458,"pitch":43.999},{"time":61.492,"pitch":44},{"time":61.525,"pitch":43.765},{"time":61.533,"pitch":43.585},{"time":61.542,"pitch":43.448},{"time":61.55,"pitch":43.343},{"time":61.558,"pitch":43.262},{"time":61.567,"pitch":43.201},{"time":61.575,"pitch":43.153},{"time":61.583,"pitch":43.117},{"time":61.592,"pitch":43.09},{"time":61.6,"pitch":43.069},{"time":61.608,"pitch":43.053},{"time":61.617,"pitch":43.04},{"time":61.625,"pitch":43.031},{"time":61.633,"pitch":43.024},{"time":61.642,"pitch":43.018},{"time":61.65,"pitch":43.014},{"time":61.658,"pitch":43.011},{"time":61.667,"pitch":43.008},{"time":61.675,"pitch":43.006},{"time":61.683,"pitch":43.005},{"time":61.692,"pitch":43.004},{"time":61.7,"pitch":43.003},{"time":61.708,"pitch":43.002},{"time":61.725,"pitch":43.001},{"time":61.758,"pitch":43},{"time":62,"pitch":42.53},{"time":62.008,"pitch":42.171},{"time":62.017,"pitch":41.896},{"time":62.025,"pitch":41.685},{"time":62.033,"pitch":41.524},{"time":62.042,"pitch":41.401},{"time":62.05,"pitch":41.307},{"time":62.058,"pitch":41.235},{"time":62.067,"pitch":41.18},{"time":62.075,"pitch":41.137},{"time":62.083,"pitch":41.105},{"time":62.092,"pitch":41.08},{"time":62.1,"pitch":41.062},{"time":62.108,"pitch":41.047},{"time":62.117,"pitch":41.036},{"time":62.125,"pitch":41.028},{"time":62.133,"pitch":41.021},{"time":62.142,"pitch":41.016},{"time":62.15,"pitch":41.012},{"time":62.158,"pitch":41.009},{"time":62.167,"pitch":41.007},{"time":62.175,"pitch":41.006},{"time":62.183,"pitch":41.004},{"time":62.192,"pitch":41.003},{"time":62.2,"pitch":41.002},{"time":62.217,"pitch":41.001},{"time":62.25,"pitch":41},{"time":62.758,"pitch":40.295},{"time":62.767,"pitch":39.756},{"time":62.775,"pitch":39.344},{"time":62.783,"pitch":39.028},{"time":62.792,"pitch":38.787},{"time":62.8,"pitch":38.602},{"time":62.808,"pitch":38.46},{"time":62.817,"pitch":38.352},{"time":62.825,"pitch":38.27},{"time":62.833,"pitch":38.206},{"time":62.842,"pitch":38.158},{"time":62.85,"pitch":38.121},{"time":62.858,"pitch":38.092},{"time":62.867,"pitch":38.071},{"time":62.875,"pitch":38.054},{"time":62.883,"pitch":38.041},{"time":62.892,"pitch":38.032},{"time":62.9,"pitch":38.024},{"time":62.908,"pitch":38.019},{"time":62.917,"pitch":38.014},{"time":62.925,"pitch":38.011},{"time":62.933,"pitch":38.008},{"time":62.942,"pitch":38.006},{"time":62.95,"pitch":38.005},{"time":62.958,"pitch":38.004},{"time":62.967,"pitch":38.003},{"time":62.975,"pitch":38.002},{"time":62.992,"pitch":38.001},{"time":63.025,"pitch":38},{"time":63.208,"pitch":36.826},{"time":63.217,"pitch":35.927},{"time":63.225,"pitch":35.239},{"time":63.233,"pitch":34.713},{"time":63.242,"pitch":34.311},{"time":63.25,"pitch":34.003},{"time":63.258,"pitch":33.767},{"time":63.267,"pitch":33.587},{"time":63.275,"pitch":33.449},{"time":63.283,"pitch":33.344},{"time":63.292,"pitch":33.263},{"time":63.3,"pitch":33.201},{"time":63.308,"pitch":33.154},{"time":63.317,"pitch":33.118},{"time":63.325,"pitch":33.09},{"time":63.333,"pitch":33.069},{"time":63.342,"pitch":33.053},{"time":63.35,"pitch":33.04},{"time":63.358,"pitch":33.031},{"time":63.367,"pitch":33.024},{"time":63.375,"pitch":33.018},{"time":63.383,"pitch":33.014},{"time":63.392,"pitch":33.011},{"time":63.4,"pitch":33.008},{"time":63.408,"pitch":33.006},{"time":63.417,"pitch":33.005},{"time":63.425,"pitch":33.004},{"time":63.433,"pitch":33.003},{"time":63.442,"pitch":33.002},{"time":63.458,"pitch":33.001},{"time":63.492,"pitch":33},{"time":63.508,"pitch":33.705},{"time":63.517,"pitch":34.244},{"time":63.525,"pitch":34.657},{"time":63.533,"pitch":34.972},{"time":63.542,"pitch":35.214},{"time":63.55,"pitch":35.398},{"time":63.558,"pitch":35.54},{"time":63.567,"pitch":35.648},{"time":63.575,"pitch":35.73},{"time":63.583,"pitch":35.794},{"time":63.592,"pitch":35.842},{"time":63.6,"pitch":35.879},{"time":63.608,"pitch":35.908},{"time":63.617,"pitch":35.929},{"time":63.625,"pitch":35.946},{"time":63.633,"pitch":35.959},{"time":63.642,"pitch":35.968},{"time":63.65,"pitch":35.976},{"time":63.658,"pitch":35.981},{"time":63.667,"pitch":35.986},{"time":63.675,"pitch":35.989},{"time":63.683,"pitch":35.992},{"time":63.692,"pitch":35.994},{"time":63.7,"pitch":35.995},{"time":63.708,"pitch":35.996},{"time":63.717,"pitch":35.997},{"time":63.725,"pitch":35.998},{"time":63.742,"pitch":35.999},{"time":63.775,"pitch":36},{"time":64,"pitch":36.47},{"time":64.008,"pitch":36.829},{"time":64.017,"pitch":37.104},{"time":64.025,"pitch":37.315},{"time":64.033,"pitch":37.476},{"time":64.042,"pitch":37.599},{"time":64.05,"pitch":37.693},{"time":64.058,"pitch":37.765},{"time":64.067,"pitch":37.82},{"time":64.075,"pitch":37.863},{"time":64.083,"pitch":37.895},{"time":64.092,"pitch":37.92},{"time":64.1,"pitch":37.938},{"time":64.108,"pitch":37.953},{"time":64.117,"pitch":37.964},{"time":64.125,"pitch":37.972},{"time":64.133,"pitch":37.979},{"time":64.142,"pitch":37.984},{"time":64.15,"pitch":37.988},{"time":64.158,"pitch":37.991},{"time":64.167,"pitch":37.993},{"time":64.175,"pitch":37.994},{"time":64.183,"pitch":37.996},{"time":64.192,"pitch":37.997},{"time":64.2,"pitch":37.998},{"time":64.217,"pitch":37.999},{"time":64.25,"pitch":38},{"time":64.317,"volume":0.833},{"time":64.325,"volume":0.667},{"time":64.333,"volume":0.5},{"time":64.342,"volume":0.333},{"time":64.35,"volume":0.167},{"time":64.358,"volume":0},{"time":64.367,"volume":0}]}}],"b0ba6f144fac4f668ba6981c691277d6":[{"instanceName":"-"},{"note":{"onTime":57.5,"k":[{"time":0,"pitch":38,"volume":0.167},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.508,"volume":0.833},{"time":2.517,"volume":0.667},{"time":2.525,"volume":0.5},{"time":2.533,"volume":0.333},{"time":2.542,"volume":0.167},{"time":2.55,"volume":0},{"time":2.558,"volume":0}]}},{"note":{"onTime":61.5,"k":[{"time":0,"pitch":38,"volume":0.167},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.508,"volume":0.833},{"time":2.517,"volume":0.667},{"time":2.525,"volume":0.5},{"time":2.533,"volume":0.333},{"time":2.542,"volume":0.167},{"time":2.55,"volume":0},{"time":2.558,"volume":0}]}},{"note":{"onTime":117.5,"k":[{"time":0,"pitch":38,"volume":0.167},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.508,"volume":0.833},{"time":2.517,"volume":0.667},{"time":2.525,"volume":0.5},{"time":2.533,"volume":0.333},{"time":2.542,"volume":0.167},{"time":2.55,"volume":0},{"time":2.558,"volume":0}]}},{"note":{"onTime":121.5,"k":[{"time":0,"pitch":38,"volume":0.167},{"time":0.008,"pitch":38,"volume":0.333},{"time":0.017,"volume":0.5},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1},{"time":0.733,"pitch":38.705},{"time":0.75,"pitch":39.244},{"time":0.758,"pitch":39.656},{"time":0.767,"pitch":39.972},{"time":0.775,"pitch":40.213},{"time":0.783,"pitch":40.398},{"time":0.792,"pitch":40.54},{"time":0.8,"pitch":40.648},{"time":0.808,"pitch":40.73},{"time":0.817,"pitch":40.794},{"time":0.825,"pitch":40.842},{"time":0.833,"pitch":40.879},{"time":0.842,"pitch":40.908},{"time":0.85,"pitch":40.929},{"time":0.858,"pitch":40.946},{"time":0.867,"pitch":40.959},{"time":0.875,"pitch":40.968},{"time":0.883,"pitch":40.976},{"time":0.892,"pitch":40.981},{"time":0.9,"pitch":40.986},{"time":0.908,"pitch":40.989},{"time":0.917,"pitch":40.992},{"time":0.925,"pitch":40.994},{"time":0.933,"pitch":40.995},{"time":0.942,"pitch":40.996},{"time":0.95,"pitch":40.997},{"time":0.958,"pitch":40.998},{"time":0.975,"pitch":40.999},{"time":1.008,"pitch":41},{"time":1.258,"pitch":40.295},{"time":1.267,"pitch":39.756},{"time":1.275,"pitch":39.344},{"time":1.283,"pitch":39.028},{"time":1.292,"pitch":38.787},{"time":1.3,"pitch":38.602},{"time":1.308,"pitch":38.46},{"time":1.317,"pitch":38.352},{"time":1.325,"pitch":38.27},{"time":1.333,"pitch":38.206},{"time":1.342,"pitch":38.158},{"time":1.35,"pitch":38.121},{"time":1.358,"pitch":38.092},{"time":1.367,"pitch":38.071},{"time":1.375,"pitch":38.054},{"time":1.383,"pitch":38.041},{"time":1.392,"pitch":38.032},{"time":1.4,"pitch":38.024},{"time":1.408,"pitch":38.019},{"time":1.417,"pitch":38.014},{"time":1.425,"pitch":38.011},{"time":1.433,"pitch":38.008},{"time":1.442,"pitch":38.006},{"time":1.45,"pitch":38.005},{"time":1.458,"pitch":38.004},{"time":1.467,"pitch":38.003},{"time":1.475,"pitch":38.002},{"time":1.492,"pitch":38.001},{"time":1.5,"pitch":38.706},{"time":1.508,"pitch":39.245},{"time":1.517,"pitch":39.657},{"time":1.525,"pitch":39.972},{"time":1.533,"pitch":40.214},{"time":1.542,"pitch":40.398},{"time":1.55,"pitch":40.54},{"time":1.558,"pitch":40.648},{"time":1.567,"pitch":40.731},{"time":1.575,"pitch":40.794},{"time":1.583,"pitch":40.842},{"time":1.592,"pitch":40.879},{"time":1.6,"pitch":40.908},{"time":1.608,"pitch":40.929},{"time":1.617,"pitch":40.946},{"time":1.625,"pitch":40.959},{"time":1.633,"pitch":40.968},{"time":1.642,"pitch":40.976},{"time":1.65,"pitch":40.981},{"time":1.658,"pitch":40.986},{"time":1.667,"pitch":40.989},{"time":1.675,"pitch":40.992},{"time":1.683,"pitch":40.994},{"time":1.692,"pitch":40.995},{"time":1.7,"pitch":40.996},{"time":1.708,"pitch":40.997},{"time":1.717,"pitch":40.998},{"time":1.733,"pitch":40.999},{"time":1.767,"pitch":41},{"time":2.008,"pitch":40.295},{"time":2.017,"pitch":39.756},{"time":2.025,"pitch":39.344},{"time":2.033,"pitch":39.028},{"time":2.042,"pitch":38.787},{"time":2.05,"pitch":38.602},{"time":2.058,"pitch":38.46},{"time":2.067,"pitch":38.352},{"time":2.075,"pitch":38.27},{"time":2.083,"pitch":38.206},{"time":2.092,"pitch":38.158},{"time":2.1,"pitch":38.121},{"time":2.108,"pitch":38.092},{"time":2.117,"pitch":38.071},{"time":2.125,"pitch":38.054},{"time":2.133,"pitch":38.041},{"time":2.142,"pitch":38.032},{"time":2.15,"pitch":38.024},{"time":2.158,"pitch":38.019},{"time":2.167,"pitch":38.014},{"time":2.175,"pitch":38.011},{"time":2.183,"pitch":38.008},{"time":2.192,"pitch":38.006},{"time":2.2,"pitch":38.005},{"time":2.208,"pitch":38.004},{"time":2.217,"pitch":38.003},{"time":2.225,"pitch":38.002},{"time":2.242,"pitch":38.001},{"time":2.275,"pitch":38},{"time":2.508,"volume":0.833},{"time":2.517,"volume":0.667},{"time":2.525,"volume":0.5},{"time":2.533,"volume":0.333},{"time":2.542,"volume":0.167},{"time":2.55,"volume":0},{"time":2.558,"volume":0}]}}]}
    `
    //#endregion

    //#region Audio initialization

    let dawOscTimeInSeconds = -1
    let dawOscLastSentTimeInSeconds = -1
    let dawNeedsRender = true

    if (document.useDawTiming) {
        const OSC_STATUS = {
            IS_NOT_INITIALIZED: -1,
            IS_CONNECTING: 0,
            IS_OPEN: 1,
            IS_CLOSING: 2,
            IS_CLOSED: 3
        }

        const clientPlugin = new OSC.WebsocketClientPlugin({ port: 8080 })
        const clientOsc = new OSC({ plugin: clientPlugin })
        clientOsc.on('/daw/time_in_seconds', message => {
            dawOscTimeInSeconds = message.args[0] + 3.5 // + 3.5 for score start delay
            if (dawOscLastSentTimeInSeconds !== dawOscTimeInSeconds) {
                dawOscLastSentTimeInSeconds = dawOscTimeInSeconds
                // console.debug(`dawOscTimeInSeconds = ${dawOscTimeInSeconds}`)
                dawNeedsRender = true
            }
        })
        console.debug("Opening OSC client")
        clientOsc.open()

        const serverOsc = new OSC()
        console.debug("Opening OSC server")
        serverOsc.open()

        setInterval(() => {
            if (clientOsc.status() == OSC_STATUS.IS_CLOSED) {
                console.debug("Re-openinig OSC client")
                serverOsc.open()
            }
            if (serverOsc.status() == OSC_STATUS.IS_CLOSED) {
                console.debug("Re-openinig OSC server")
                serverOsc.open()
            }
        }, 1000)

        setInterval(() => {
            if (serverOsc.status() !== OSC_STATUS.IS_OPEN) {
                return
            }
            if (camera.matrixIsDirty) {
                const message = new OSC.Message('/DawService/camera_matrix')
                for (let i = 0; i < 16; i++) {
                    message.add(camera.matrix[i])
                }
                serverOsc.send(message)
                console.debug('Setting DAW listener position to ['
                    + camera.matrix[12] + ', '
                    + camera.matrix[13] + ', '
                    + camera.matrix[14] + ']')
                camera.matrixIsDirty = false
            }
        }, camera.matrixMillisecondsPerUpdate)
    }
    else {
        csound = new Csound(csdText)
        csound.start()
    }

    //#endregion

    //#region World initialization

    const csdData = JSON.parse(csdJson)
    const csdDataUuids = Object.keys(csdData)
    for (let i = 0; i < csdDataUuids.length; i++) {
        const id = csdDataUuids[i]
        if (createTrackMap[id]) {
            const trackEntity = createTrackMap[id].function(id, csdData[id], createTrackMap[id].options)
            world.add(trackEntity)
        }
        else {
            console.warn(`No create track function found for id ${id}.`)
        }
    }

    world.build()

    let previousTime = 0
    let time = -1

    scene.registerBeforeRender(() => {
        if (document.useDawTiming) {
            if (!dawNeedsRender) {
                return
            }
        }
        else if (!csound.playbackIsStarted) {
            return
        }

        if (document.useDawTiming) {
            previousTime = time
            time = dawOscTimeInSeconds
            dawNeedsRender = false
        }
        else {
            previousTime = time
            time = csound.audioContext.currentTime - csound.startTime;
        }

        world.run(time, time - previousTime)
    })

    let documentWasVisible = true
    setInterval(() => {
        if (document.visible !== undefined) {
            if (documentWasVisible && !document.visible) {
                console.debug(`Pausing Csound`)
                csound.pause()
                documentWasVisible = false
            }
            else if (!documentWasVisible && document.visible) {
                console.debug(`Resuming Csound`)
                csound.resume()
                documentWasVisible = true
            }
        }
    }, 100)

    //#endregion

    return scene
}}

//#region class Project

export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas)
    }
}

 //#endregion
