import * as BABYLON from "babylonjs"
import * as CSOUND from "./@doc.e.dub/csound-browser"

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
    //     var BABYLON_MATERIALS = BABYLON

    const showBabylonInspector = false
    const logCsoundMessages = true
    const logDebugMessages = true
    const showGroundGrid = true

    let animateCamera = false
    const slowCameraSpeed = 0.25
    const fastCameraSpeed = 1.5
    const csoundCameraUpdatesPerSecond = 10
    const csoundIoBufferSize = 128
    const groundSize = 9000
    const groundRingDiameter = 100

    const halfGroundSize = groundSize / 2

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
        let csoundImportScript = document.createElement('script')
        csoundImportScript.type = 'module'
        csoundImportScript.innerText = `
            console.debug("Csound importing ...")
            import { Csound } from "https://unpkg.com/@doc.e.dub/csound-browser@6.17.0-beta5/dist/csound.esm.js"
            document.Csound = Csound
        `
        // csoundImportScript.innerText = `
        //     console.debug("Csound importing ...")
        //     import { Csound } from "./csound.esm.js"
        //     document.Csound = Csound
        // `
        document.body.appendChild(csoundImportScript)
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

    let camera = new BABYLON.FreeCamera('', cameraSetting.position, scene)
    camera.applyGravity = true
    camera.checkCollisions = true
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5)
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
                <rect width="100%" height="100%" style="fill: none; stroke: white; stroke-width: 4;" />
            </svg>
        `)
        grid_Texture.uScale = grid_Texture.vScale = groundSize / 10
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
        let csdData = JSON.parse(csdJson)
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
            if (!isCsoundStarted) {
                updateCamera(0)
                return
            }

            const time = document.audioContext.currentTime - startTime
            updateCamera(time)
        })

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const previousCameraMatrix = new Float32Array(16)
        const currentCameraMatrix = new Float32Array(16)
        let currentCameraMatrixIsDirty = true
        
        // Send the camera matrix to Csound.
        setInterval(() => {
            if (!isCsoundStarted) {
                return
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
                document.csound.tableCopyIn("1", currentCameraMatrix)
                currentCamera.worldMatrixFromCache.copyToArray(previousCameraMatrix)
                currentCameraMatrixIsDirty = false
            }
        }, 1000 / csoundCameraUpdatesPerSecond)
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
        isCsoundStarted = false
        await document.csound.rewindScore()
        console.debug('Restarting Csound - done')
        restartCount++
        console.debug('Restart count =', restartCount)
    }

    const startCsound = async () => {
        if (!isAudioEngineUnlocked) return
        if (!isCsoundLoaded) return
        console.debug('Csound initializing ...')
        const previousConsoleLog = console.log
        const csoundConsoleLog = function() {
            if (arguments[0] === 'csd:started') {
                startTime = document.audioContext.currentTime - (4 - 3 * document.latency)
                isCsoundStarted = true
            }
            else if (arguments[0] === 'csd:ended') {
                restartCsound()
            }
            if (logCsoundMessages) {
                previousConsoleLog.apply(console, arguments)
            }
        }
        console.log = csoundConsoleLog
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
        console.log = previousConsoleLog
        if (!csound) {
            console.error('Csound failed to initialize')
            return
        }
        document.csound = csound
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
        await csound.setOption('--iobufsamps=' + csoundIoBufferSize)
        console.debug('Csound csd compiling ...')
        let csoundErrorCode = await csound.compileCsdText(csdText)
        if (csoundErrorCode != 0) {
            console.error('Csound csd compile failed')
            return
        }
        document.latency = audioContext.baseLatency + csoundIoBufferSize / audioContext.sampleRate
        console.debug('Latency =', document.latency)
        console.debug('Csound csd compile succeeded')
        console.debug('Csound starting ...')
        csound.start()
    }

const csdText = `
`
const csdJson = `
{}
`
    startAudioVisuals()
    return scene
}}



export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas)
    }
}
